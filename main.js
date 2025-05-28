import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// Scene setup
const scene = new THREE.Scene();

const activeCubes = [];
let lastCubeTime = 0;
const cubeSpawnInterval = 5000; // milliseconds
let duckModel = null;
let weaponModel = null;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100); // Increased near plane
camera.position.set(0, 1.6, 0); // Approximate head height

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local');
document.body.appendChild(VRButton.createButton(renderer));

// Lighting - increased intensity
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
keyLight.position.set(5, 10, 7);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
fillLight.position.set(-5, 5, 5);
scene.add(fillLight);

const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
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

// First load environment models
loader.load('source/arbol.glb', gltf => scene.add(gltf.scene));
loader.load('source/arbustos.glb', gltf => scene.add(gltf.scene));
loader.load('source/piso.glb', gltf => scene.add(gltf.scene));
loader.load('source/cerca.glb', gltf => scene.add(gltf.scene));

// Then load weapon model
loader.load('source/arma.glb', gltf => {
    weaponModel = gltf.scene;
    
    // Debug: Log model information
    console.log('Weapon model loaded:', weaponModel);
    
    // Check if model has proper scale
    weaponModel.scale.set(0.1, 0.1, 0.1); // Start with small scale
    
    // Position the weapon in view (right hand position)
    weaponModel.position.set(0.3, -0.4, -0.8);
    
    // Rotate to make it face forward properly
    weaponModel.rotation.set(0, Math.PI, 0);
    
    // Add bounding box helper for debugging
    const bbox = new THREE.Box3().setFromObject(weaponModel);
    const bboxHelper = new THREE.Box3Helper(bbox, 0xffff00);
    weaponModel.add(bboxHelper);
    
    // Parent to camera
    camera.add(weaponModel);
    
    // Debug: Check camera children
    console.log('Camera children:', camera.children);
}, 
undefined, 
error => {
    console.error('Error loading weapon model:', error);
});

loader.load('source/duck.glb', gltf => { 
    duckModel = gltf.scene;
    scene.add(duckModel);
});

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
            color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
            metalness: 0.2,
            roughness: 0.7
        });
        this.cube = new THREE.Mesh(geometry, material);
        this.cube.position.set(startX, 5, -30);
        this.scene.add(this.cube);
        this.direction = startX > 0 ? -1 : 1;
    }

    update() {
        if (!this.cube) return;
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

function animate(time) {
    // Spawn new cubes
    if (!lastCubeTime || time - lastCubeTime > cubeSpawnInterval) {
        activeCubes.push(new MovingCube(scene));
        lastCubeTime = time;
    }
    
    // Update cubes
    for (let i = activeCubes.length - 1; i >= 0; i--) {
        if (!activeCubes[i].update()) {
            activeCubes.splice(i, 1);
        }
    }
    
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
