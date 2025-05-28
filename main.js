import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// Scene setup
const scene = new THREE.Scene();
const activeDucks = [];
let lastDuckTime = 0;
const duckSpawnInterval = 5000;
let duckModel = null;

const raycaster = new THREE.Raycaster();
let controller = null;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 100);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local');
document.body.appendChild(VRButton.createButton(renderer));

// Lighting
scene.add(new THREE.AmbientLight(0x040404));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(5, 10, 7);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-5, 5, 5);
scene.add(fillLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
backLight.position.set(0, 5, -10);
scene.add(backLight);

// Skybox
const cubePath = 'cubemap/';
const cubeFormat = '.png';
const cubeUrls = [
  cubePath + 'px' + cubeFormat, cubePath + 'nx' + cubeFormat,
  cubePath + 'py' + cubeFormat, cubePath + 'ny' + cubeFormat,
  cubePath + 'pz' + cubeFormat, cubePath + 'nz' + cubeFormat
];
const skybox = new THREE.CubeTextureLoader().load(cubeUrls);
scene.background = skybox;

// Crosshair
function createCrosshair() {
    const geometry = new THREE.RingGeometry(0.01, 0.02, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.8,
        transparent: true,
        depthTest: false
    });
    const crosshair = new THREE.Mesh(geometry, material);
    crosshair.position.z = -2;
    camera.add(crosshair);
    scene.add(camera);
}
createCrosshair();

// Load environment models
const loader = new GLTFLoader();
loader.load('source/arbol.glb', gltf => scene.add(gltf.scene));
loader.load('source/arbustos.glb', gltf => scene.add(gltf.scene));
loader.load('source/piso.glb', gltf => scene.add(gltf.scene));
loader.load('source/cerca.glb', gltf => scene.add(gltf.scene));

// Load weapon and attach to camera
loader.load('source/arma.glb', gltf => {
    const weapon = gltf.scene;
    weapon.position.set(0.2, -0.2, -0.5); // Adjust for better placement
    weapon.scale.set(0.5, 0.5, 0.5);
    camera.add(weapon);
    scene.add(camera);
});

// Load duck (not added to scene immediately)
loader.load('source/duck.glb', gltf => {
    duckModel = gltf.scene;
});

// XR controller setup
function setupXRController() {
    controller = renderer.xr.getController(0);
    controller.addEventListener('selectstart', onSelectStart);
    scene.add(controller);

    const controllerModel = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1).multiplyScalar(5)
        ]),
        new THREE.LineBasicMaterial({ color: 0x00ff00 })
    );
    controller.add(controllerModel);
}

function onSelectStart() {
    castRay();
}

function castRay() {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = raycaster.intersectObjects(activeDucks.map(d => d.getObject()), true);
    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const index = activeDucks.findIndex(d =>
            d.getObject() === hit || d.getObject().children.includes(hit)
        );
        if (index !== -1) {
            activeDucks[index].dispose();
            activeDucks.splice(index, 1);
        }
    }
}

class MovingDuck {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Object3D();
        this.duck = duckModel.clone();
        this.group.add(this.duck);

        const startX = Math.random() < 0.5 ? -40 : 40;
        this.direction = startX > 0 ? -1 : 1;
        this.group.position.set(startX, 5, -30);
        this.group.rotation.y = this.direction === 1 ? Math.PI / 2 : -Math.PI / 2;
        this.group.scale.set(0.5, 0.5, 0.5);

        this.scene.add(this.group);
    }

    update() {
        if (!this.group) return false;

        this.group.position.x += this.direction * 0.1;
        if (Math.abs(this.group.position.x) > 50) {
            this.dispose();
            return false;
        }

        return true;
    }

    dispose() {
        if (this.group) {
            this.scene.remove(this.group);
            this.group.traverse(child => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
            this.group = null;
        }
    }

    getObject() {
        return this.group;
    }
}

// Animate loop
function animate(time) {
    // Spawn duck
    if (duckModel && (!lastDuckTime || time - lastDuckTime > duckSpawnInterval)) {
        activeDucks.push(new MovingDuck(scene));
        lastDuckTime = time;
    }

    // Update ducks
    for (let i = activeDucks.length - 1; i >= 0; i--) {
        if (!activeDucks[i].update()) {
            activeDucks.splice(i, 1);
        }
    }

    // Gaze interaction
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(
        activeDucks.map(d => d.getObject()), true
    );

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const index = activeDucks.findIndex(d =>
            d.getObject() === hit || d.getObject().children.includes(hit)
        );
        if (index !== -1) {
            activeDucks[index].dispose();
            activeDucks.splice(index, 1);
        }
    }

    renderer.render(scene, camera);
}

renderer.xr.addEventListener('sessionstart', () => {
    setupXRController();
});

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
