import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// Scene setup
const scene = new THREE.Scene();
const activePlanes = [];
let lastSpawnTime = 0;
const spawnInterval = 5000; // milliseconds

// Raycaster setup
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

// Lighting
scene.add(new THREE.AmbientLight(0x404040));
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
scene.background = new THREE.CubeTextureLoader().load(cubeUrls);

// Load texture
const textureLoader = new THREE.TextureLoader();
const duckTexture = textureLoader.load('source/duck.png');

// Set up controller for VR
function setupXRController() {
    controller = renderer.xr.getController(0);
    controller.addEventListener('selectstart', onSelectStart);
    scene.add(controller);

    const controllerModel = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1).multiplyScalar(5)
        ]),
        new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 4 })
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
    const intersects = raycaster.intersectObjects(activePlanes.map(plane => plane.mesh));

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const index = activePlanes.findIndex(p => p.mesh === hit);
        if (index !== -1) {
            activePlanes[index].dispose();
            activePlanes.splice(index, 1);
        }
    }
}

class MovingPlane {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.speed = 0.1;
        this.init();
    }

    init() {
        const startX = Math.random() < 0.5 ? -40 : 40;
        const direction = startX > 0 ? -1 : 1;

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshBasicMaterial({ map: duckTexture, transparent: true });
        this.mesh = new THREE.Mesh(geometry, material);

        this.mesh.position.set(startX, 5, -30);
        this.mesh.rotation.y = direction === -1 ? Math.PI / 2 : -Math.PI / 2;

        this.scene.add(this.mesh);
        this.direction = direction;
    }

    update() {
        if (!this.mesh) return false;
        this.mesh.position.x += this.speed * this.direction;
        if (Math.abs(this.mesh.position.x) > 50) {
            this.dispose();
            return false;
        }
        return true;
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
    }
}

function animate(time) {
    if (!lastSpawnTime || time - lastSpawnTime > spawnInterval) {
        activePlanes.push(new MovingPlane(scene));
        lastSpawnTime = time;
    }

    for (let i = activePlanes.length - 1; i >= 0; i--) {
        if (!activePlanes[i].update()) {
            activePlanes.splice(i, 1);
        }
    }

    // Gaze-based raycasting
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(activePlanes.map(p => p.mesh));
    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const index = activePlanes.findIndex(p => p.mesh === hit);
        if (index !== -1) {
            activePlanes[index].dispose();
            activePlanes.splice(index, 1);
        }
    }

    renderer.render(scene, camera);
}

renderer.xr.addEventListener('sessionstart', () => {
    setupXRController();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

