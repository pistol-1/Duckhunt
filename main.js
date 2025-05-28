import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// Scene setup
const scene = new THREE.Scene();
const activeCubes = [];
let lastCubeTime = 0;
const cubeSpawnInterval = 5000; // milliseconds
let duckModel = null;

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

// Load texture
const textureLoader = new THREE.TextureLoader();
const duckTexture = textureLoader.load('source/duck.png');

// Add crosshair and direction guide
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
loader.load('source/duck.glb', gltf => { duckModel = gltf.scene; });

// Crosshair and guide
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

// XR Controller Setup
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
    
    const intersects = raycaster.intersectObjects(activeCubes.map(cube => cube.cube));
    if (intersects.length > 0) {
        const hitCube = intersects[0].object;
        const cubeIndex = activeCubes.findIndex(cube => cube.cube === hitCube);
        if (cubeIndex !== -1) {
            activeCubes[cubeIndex].dispose();
            activeCubes.splice(cubeIndex, 1);
        }
    }
}

// Moving cube class with duck texture
class MovingCube {
    constructor(scene) {
        this.scene = scene;
        this.cube = null;
        this.speed = 0.1;
        this.init();
    }

    init() {
        const startX = Math.random() < 0.5 ? -40 : 40;
        const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const material = new THREE.MeshStandardMaterial({ 
            map: duckTexture,
            metalness: 0.2,
            roughness: 0.7,
            side: THREE.DoubleSide
        });
        this.cube = new THREE.Mesh(geometry, material);
        this.cube.position.set(startX, 5, -30);
        this.scene.add(this.cube);
        this.direction = startX > 0 ? -1 : 1;
    }

    update() {
        if (!this.cube) return false;
        this.cube.position.x += this.speed * this.direction;

        if (Math.abs(this.cube.position.x) > 50) {
            this.dispose();
            return false;
        }

        return true;
    }

    dispose() {
        if (this.cube) {
            this.scene.remove(this.cube);
            this.cube.geometry.dispose();
            this.cube.material.dispose();
            this.cube = null;
        }
    }
}

// Animation loop
function animate(time) {
    if (!lastCubeTime || time - lastCubeTime > cubeSpawnInterval) {
        activeCubes.push(new MovingCube(scene));
        lastCubeTime = time;
    }

    for (let i = activeCubes.length - 1; i >= 0; i--) {
        if (!activeCubes[i].update()) {
            activeCubes.splice(i, 1);
        }
    }

    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(activeCubes.map(cube => cube.cube));

    if (intersects.length > 0) {
        const hitCube = intersects[0].object;
        const cubeIndex = activeCubes.findIndex(cube => cube.cube === hitCube);

        if (cubeIndex !== -1) {
            activeCubes[cubeIndex].dispose();
            activeCubes.splice(cubeIndex, 1);
        }
    }

    renderer.render(scene, camera);
}

// Initialize XR controller
setupXRController();
