/**
 * Description
 * ===========
 * create a threejs object (two cubes, one above the other) that can be interacted 
 * with and has some networked attributes.
 *
 */
import { interactiveComponentTemplate, registerSharedAFRAMEComponents } from "../utils/interaction";

///////////////////////////////////////////////////////////////////////////////
// simple convenience functions 
function randomColor() {
    return new THREE.Color(Math.random(), Math.random(), Math.random());
}

function almostEqualVec3 (u, v, epsilon) {
    return Math.abs(u.x-v.x)<epsilon && Math.abs(u.y-v.y)<epsilon && Math.abs(u.z-v.z)<epsilon;
 };
 function almostEqualColor (u, v, epsilon) {
    return Math.abs(u.r-v.r)<epsilon && Math.abs(u.g-v.g)<epsilon && Math.abs(u.b-v.b)<epsilon;
 };  

// a lot of the complexity has been pulled out into methods in the object
// created by interactiveComponentTemplate() and registerSharedAFRAMEcomponents().
// Here, we define methods that are used by the object there, to do our object-specific
// work.

// We need to define:
// - AFRAME 
//   - schema
//   - init() method, which should can startInit() and finishInit()
//   - update() and play() if you need them
//   - tick() and tick2() to handle frame updates
//
// - change isNetworked, isInteractive, isDraggable (default: false)
// - loadData() is an async function that does any slow work (loading things, etc)
//   and is called by finishInit(), which waits till it's done before setting things up
// - initializeData() is called to set up the initial state of the object, a good 
//   place to create the 3D content.  The three.js scene should be added to 
//   this.simpleContainter
// - clicked() is called when the object is clicked
// - dragStart() is called right after clicked() if isDraggable is true, to set up drag
// - dragEnd() is called when the drag is done
// - drag() should be called each frame while the object is being dragged (between 
//   dragStart() and dragEnd())

// the componentName must be lowercase, can have hyphens, start with a letter, 
// but no underscores
let componentName = "test-cube";

// get the template part of the object need for the AFRAME component
let template = interactiveComponentTemplate(componentName);

// create the additional parts of the object needed for the AFRAME component
let child = {
    schema: {
        // name is hopefully unique for each instance
        name: { type: "string", default: ""},

        // the template will look for these properties. If they aren't there, then
        // the lookup (this.data.*) will evaluate to falsey
        isNetworked: { type: "boolean", default: false},
        isInteractive: { type: "boolean", default: true},
        isDraggable: { type: "boolean", default: true},

        // our data
        width: { type: "number", default: 1},
        parameter1: { type: "string", default: ""}
    },

    // fullName is used to generate names for the AFRame objects we create.  Should be
    // unique for each instance of an object, which we specify with name.  If name does
    // name get used as a scheme parameter, it defaults to the name of it's parent glTF
    // object, which only works if those are uniquely named.
    init: function () {
        this.startInit();

        // the template uses these to set things up.  relativeWidth and relativeHeight
        // are used to set the size of the object relative to the size of the image
        // that it's attached to: 1,1 will be "the width and height of the object below
        // will be the same as the width and height of the image if it's 1,1".  Larger
        // relative scales will make the object smaller, and vice versa.  For example,
        // if the object below is 2,2 in size and we set relative scale to 2,2, then
        // the object will remain the same size as the image.  If we leave it at 1,1,
        // then the object will be twice the size of the image. 
        this.relativeWidth = 1/this.data.width;
        this.relativeHeight = 1/this.data.width;
        this.isDraggable = this.data.isDraggable;
        this.isInteractive = this.data.isInteractive;
        this.isNetworked = this.data.isNetworked;

        // our potentiall-shared object state (two roations and two colors for the boxes) 
        this.sharedData = {
            color: new THREE.Color(randomColor()),
            rotation: new THREE.Euler(),
            position: new THREE.Vector3()
        };

        // some local state
        this.initialEuler = new THREE.Euler()
       
        // some click/drag state
        this.clickEvent = null
        this.clickIntersection = null

        // we should set fullName if we have a meaningful name
        if (this.data.name && this.data.name.length > 0) {
            this.fullName = this.data.name;
        }

        // finish the initialization
        this.finishInit();
    },

    // if anything changed in this.data, we need to update the object.  
    // this is probably not going to happen, but could if another of 
    // our scripts modifies the component properties in the DOM
    update: function () {
    },

    // do some stuff to get async data.  Called by initTemplate()
    loadData: async function () {
        return
    },

    // called by initTemplate() when the component is being processed.  Here, we create
    // the three.js objects we want, and add them to simpleContainer (an AFrame node 
    // the template created for us).
    initializeData: function () {
        this.box = new THREE.Mesh(
            new THREE.BoxGeometry(1,1,1,2,2,2), 
            new THREE.MeshBasicMaterial({color: this.sharedData.color})
        );
        this.box.matrixAutoUpdate = true;
        this.simpleContainer.setObject3D('box', this.box)
        
        this.box2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.1,0.1,0.1,2,2,2), 
            new THREE.MeshBasicMaterial({color: "black"})
        );
        this.box2.matrixAutoUpdate = true;
        this.box2.position.y += 0.5;
        this.box.add(this.box2)
    },

    // handle "interact" events for clickable entities
    clicked: function(evt) {
        // the evt.target will point at the object3D in this entity.  We can use
        // handleInteraction.getInteractionTarget() to get the more precise 
        // hit information for all the object3Ds in our object
        this.clickIntersection = this.handleInteraction.getIntersection(evt.object3D, evt.target);
        this.clickEvent = evt;

        if (!this.clickIntersection) {
            console.warn("click didn't hit anything; shouldn't happen");
            return;
        }

        if (this.clickIntersection.object == this.box) {
            // new random color on each click
            let newColor = randomColor()

            this.box.material.color.set(newColor)
            this.sharedData.color.set(newColor)
            this.setSharedData()
        } else if (this.clickIntersection.object == this.box2) {
        }
    },
     
    // called to start the drag.  Will be called after clicked() if isDraggable is true
    dragStart: function(evt) {
        // set up the drag state
        this.handleInteraction.startDrag(evt)

        // grab a copy of the current orientation of the object we clicked
        if (this.clickIntersection.object == this.box) {
            this.initialEuler.copy(this.box.rotation)
        } else if (this.clickIntersection.object == this.box2) {
            this.box2.material.color.set("red")
        }
    },

    // called when the button is released to finish the drag
    dragEnd: function (evt) {
        this.handleInteraction.endDrag(evt)
        if (this.clickIntersection.object == this.box) {
        } else if (this.clickIntersection.object == this.box2) {
            this.box2.material.color.set("black")
        }
    },

    // the method setSharedData() always sets the shared data, causing a network update.  
    // We can be smarter here by calling it only when significant changes happen, 
    // which we'll do in the setSharedEuler methods
    setSharedEuler: function (newEuler) {
        if (!almostEqualVec3(this.sharedData.rotation, newEuler, 0.05)) {
            this.sharedData.rotation.copy(newEuler)
            this.setSharedData()
        }
    },
    setSharedPosition: function (newPos) {
        if (!almostEqualVec3(this.sharedData.position, newPos, 0.05)) {
            this.sharedData.position.copy(newPos)
            this.setSharedData()
        }
    },

    // if the object is networked, this.stateSync will exist and should be called
    setSharedData: function() {
        if (this.stateSync) {
            return this.stateSync.setSharedData(this.sharedData)
        }
        return true
    },

    // this is called from the networked data entity to get the initial data 
    // from the component
    getSharedData: function() {
        return this.sharedData
    },

    // per frame stuff
    tick: function (time) {
        if (!this.box) {
            // haven't finished initializing yet
            return;
        }

        // if it's interactive, we'll handle drag and hover events
        if (this.isInteractive) {

            // if we're dragging, update the rotation
            if (this.isDraggable && this.handleInteraction.isDragging) {

                // do something with the dragging. Here, we'll use delta.x and delta.y
                // to rotate the object.  These values are set as a relative offset in
                // the plane perpendicular to the view, so we'll use them to offset the
                // x and y rotation of the object.  This is a TERRIBLE way to do rotate,
                // but it's a simple example.
                if (this.clickIntersection.object == this.box) {
                    // update drag state
                    this.handleInteraction.drag()

                    this.box.rotation.set(this.initialEuler.x - this.handleInteraction.delta.x,
                        this.initialEuler.y + this.handleInteraction.delta.y, 
                        this.initialEuler.z)
                    this.setSharedEuler(this.box.rotation)
                } else if (this.clickIntersection.object == this.box2) {
                    this.box2.visible = false
                    let intersect = this.handleInteraction.getIntersection(this.clickEvent.object3D, this.clickEvent.target)
                    this.box2.visible = true
                    if (intersect) {
                        let position = this.box.worldToLocal(intersect.point)
                        this.box2.position.copy(position)
                        this.setSharedPosition(this.box2.position)
                    }
                }
            } else {
                // do something with the rays when not dragging or clicking.
                // For example, we could display some additional content when hovering
                let passthruInteractor = this.handleInteraction.getInteractors(this.simpleContainer);

                let setIt = false;
                for (let i = 0;  i< passthruInteractor.length; i++) {
                    let interactor = passthruInteractor[i]
                    let intersection = this.handleInteraction.getIntersection(interactor.cursor, this.simpleContainer.object3D)
                    if (intersection && intersection.object === this.box2) {
                        this.box2.material.color.set("yellow")
                        setIt = true
                    }
                }
                if (!setIt) {
                    this.box2.material.color.set("black")
                }
                // TODO: get the intersection point on the surface for
                // the interactors.
                
                // passthruInteractor is an array of the 0, 1, or 2 interactors that are 
                // hovering over this entity

                // DO SOMETHING WITH THE INTERACTORS if you want hover feedback
            }
        }

        if (this.isNetworked) {
            // if we haven't finished setting up the networked entity don't do anything.
            if (!this.netEntity || !this.stateSync) { return }

            // if the state has changed in the networked data, update our html object
            if (this.stateSync.changed) {
                this.stateSync.changed = false
                
                // got the data, now do something with it
                let newData = this.stateSync.dataObject
                this.sharedData.color.set(newData.color)
                this.sharedData.rotation.copy(newData.rotation)
                this.sharedData.position.copy(newData.position)
                this.box.material.color.set(newData.color)
                this.box.rotation.copy(newData.rotation)
                this.box2.position.copy(newData.position)
            }
        }
    }
}

// register the component with the AFrame scene
AFRAME.registerComponent(componentName, {...child, ...template})

// create and register the data component and it's NAF component with the AFrame scene
registerSharedAFRAMEComponents(componentName)
