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

// Lighting (same as before)
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

// Skybox (same as before)
const cubePath = 'cubemap/';
const cubeFormat = '.png';
const cubeUrls = [
  cubePath + 'px' + cubeFormat, cubePath + 'nx' + cubeFormat,
  cubePath + 'py' + cubeFormat, cubePath + 'ny' + cubeFormat,
  cubePath + 'pz' + cubeFormat, cubePath + 'nz' + cubeFormat
];
const skybox = new THREE.CubeTextureLoader().load(cubeUrls);
scene.background = skybox;

// Load models (same as before)
const loader = new GLTFLoader();
loader.load('source/arbol.glb', gltf => scene.add(gltf.scene));
loader.load('source/arbustos.glb', gltf => scene.add(gltf.scene));
loader.load('source/piso.glb', gltf => scene.add(gltf.scene));
loader.load('source/cerca.glb', gltf => scene.add(gltf.scene));
loader.load('source/arma.glb', gltf => scene.add(gltf.scene));
loader.load('source/duck.glb', gltf => { duckModel = gltf.scene; });

// Set up controller for VR
function setupXRController() {
  controller = renderer.xr.getController(0);
  controller.addEventListener('selectstart', onSelectStart);
  scene.add(controller);
  
  // Add a visual representation of the controller ray
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
  // Cast a ray when the controller trigger is pressed
  castRay();
}

function castRay() {
  // Update the raycaster with controller position and direction
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  
  // Check for intersections with cubes
  const intersects = raycaster.intersectObjects(activeCubes.map(cube => cube.cube));
  
  if (intersects.length > 0) {
    // Find the cube in our activeCubes array and remove it
    const hitCube = intersects[0].object;
    const cubeIndex = activeCubes.findIndex(cube => cube.cube === hitCube);
    
    if (cubeIndex !== -1) {
      activeCubes[cubeIndex].dispose();
      activeCubes.splice(cubeIndex, 1);
    }
  }
}

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

    // Perform gaze-based raycasting from camera
    raycaster.setFromCamera({ x: 0, y: 0 }, camera); // center of screen in NDC
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
