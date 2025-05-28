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

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.001, 100);
camera.position.set(0, 0, 0); // Always at origin

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local');
document.body.appendChild(VRButton.createButton(renderer));

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
const skybox = new THREE.CubeTextureLoader().load(cubeUrls);
scene.background = skybox;

// Load models
const loader = new GLTFLoader();

loader.load('source/arbol.glb', gltf => scene.add(gltf.scene));
loader.load('source/arbustos.glb', gltf => scene.add(gltf.scene));
loader.load('source/piso.glb', gltf => scene.add(gltf.scene));
loader.load('source/cerca.glb', gltf => scene.add(gltf.scene));
loader.load('source/arma.glb', gltf => {
    weaponModel = gltf.scene;
    // Position the weapon in front of the camera (right hand position)
    weaponModel.position.set(0.3, -0.5, -1);
    // Rotate to make it face forward properly (adjust as needed)
    weaponModel.rotation.set(0, 0, 0);
    // Scale if necessary
    weaponModel.scale.set(1, 1, 1);
    // Parent to camera so it follows head movement
    camera.add(weaponModel);
});
loader.load('source/duck.glb', gltf => { duckModel = gltf.scene; });

class MovingCube {
    constructor(scene) {
        this.scene = scene;
        this.cube = null;
        this.speed = 0.1; // Movement speed
        this.init();
    }

    init() {
        // Randomly choose left (-40) or right (40) starting position
        const startX = Math.random() < 0.5 ? -40 : 40;
        
        // Create cube with slightly more interesting appearance
        const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const material = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5),
            metalness: 0.2,
            roughness: 0.7
        });
        this.cube = new THREE.Mesh(geometry, material);
        
        // Set initial position (Y=5, Z=-10)
        this.cube.position.set(startX, 5, -30);
        
        // Add to scene
        this.scene.add(this.cube);
        
        // Set movement direction (opposite of starting X)
        this.direction = startX > 0 ? -1 : 1;
    }

    update() {
        if (!this.cube) return;
        
        // Move cube in the opposite X direction
        this.cube.position.x += this.speed * this.direction;
        
        // Remove cube if it's far off screen (50 units)
        if (Math.abs(this.cube.position.x) > 50) {
            this.dispose();
            return false; // Indicates this cube should be removed from tracking
        }
        
        return true; // Cube is still active
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
    // Spawn new cubes every 5 seconds
    if (!lastCubeTime || time - lastCubeTime > cubeSpawnInterval) {
        activeCubes.push(new MovingCube(scene));
        lastCubeTime = time;
    }
    
    // Update all cubes
    for (let i = activeCubes.length - 1; i >= 0; i--) {
        if (!activeCubes[i].update()) {
            activeCubes.splice(i, 1); // Remove disposed cubes
        }
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
