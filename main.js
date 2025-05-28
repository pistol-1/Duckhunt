import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// Scene setup
const scene = new THREE.Scene();
const activePlanes = [];
let lastSpawnTime = 0;
const spawnInterval = 5000; // milliseconds
let duckTexture = null;

// Raycaster setup
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
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

// Crosshair and direction guide
createCrosshair();

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

// Load models
const loader = new GLTFLoader();
loader.load('source/arbol.glb', gltf => scene.add(gltf.scene));
loader.load('source/arbustos.glb', gltf => scene.add(gltf.scene));
loader.load('source/piso.glb', gltf => scene.add(gltf.scene));
loader.load('source/cerca.glb', gltf => scene.add(gltf.scene));
loader.load('source/arma.glb', gltf => {
    const weapon = gltf.scene;
    camera.add(weapon);
    scene.add(camera);
});

// Load duck texture
const textureLoader = new THREE.TextureLoader();
duckTexture = textureLoader.load('source/duck.png');

// Create crosshair and guide
function createCrosshair() {
    const ringGeometry = new THREE.RingGeometry(0.01, 0.02, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.9,
        transparent: true,
        depthTest: false
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.z = -2;

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const points = [
        new THREE.Vector3(0, 0, -2),
        new THREE.Vector3(0, 0, -2.2)
    ];
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const guideLine = new THREE.Line(lineGeometry, lineMaterial);

    camera.add(ring);
    camera.add(guideLine);
    scene.add(camera);
}

// Setup VR controller
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

    const intersects = raycaster.intersectObjects(activePlanes.map(obj => obj.plane));
    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const index = activePlanes.findIndex(obj => obj.plane === hit);
        if (index !== -1) {
            activePlanes[index].dispose();
            activePlanes.splice(index, 1);
        }
    }
}

// Moving duck plane class
class MovingDuckPlane {
    constructor(scene, texture) {
        this.scene = scene;
        this.plane = null;
        this.speed = 0.1;
        this.texture = texture;
        this.init();
    }

    init() {
        const startX = Math.random() < 0.5 ? -40 : 40;

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            side: THREE.DoubleSide,
            transparent: true
        });

        this.plane = new THREE.Mesh(geometry, material);
        this.plane.rotation.x = 0;
        this.plane.position.set(startX, 5, -30);
        this.scene.add(this.plane);
        this.direction = startX > 0 ? -1 : 1;
    }

    update() {
        if (!this.plane) return false;
        this.plane.position.x += this.speed * this.direction;

        if (Math.abs(this.plane.position.x) > 50) {
            this.dispose();
            return false;
        }

        return true;
    }

    dispose() {
        if (this.plane) {
            this.scene.remove(this.plane);
            this.plane.geometry.dispose();
            this.plane.material.dispose();
            this.plane = null;
        }
    }
}

// Animation loop
function animate(time) {
    if (!lastSpawnTime || time - lastSpawnTime > spawnInterval) {
        activePlanes.push(new MovingDuckPlane(scene, duckTexture));
        lastSpawnTime = time;
    }

    for (let i = activePlanes.length - 1; i >= 0; i--) {
        if (!activePlanes[i].update()) {
            activePlanes.splice(i, 1);
        }
    }

    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(activePlanes.map(obj => obj.plane));

    if (intersects.length > 0) {
        const hit = intersects[0].object;
        const index = activePlanes.findIndex(obj => obj.plane === hit);
        if (index !== -1) {
            activePlanes[index].dispose();
            activePlanes.splice(index, 1);
        }
    }

    renderer.render(scene, camera);
}

// Initialize controller after everything else
setupXRController();


// Initialize XR controller
setupXRController();
