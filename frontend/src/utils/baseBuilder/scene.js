import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getPieceDef } from './pieces.js';

const FRUSTUM_SIZE = 16;
const CAMERA_DISTANCE = 28;
const CAMERA_ELEVATION = 0.541; /* ~31° iso */

export function getCentroid(pieces) {
  if (!pieces.length) return { x: 0, y: 0, z: 0 };
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const p of pieces) {
    const def = getPieceDef(p.id);
    const h = (def?.height || 0) / 2;
    cx += p.x + 0.5;
    cz += p.z + 0.5;
    cy += p.y + h;
  }
  return { x: cx / pieces.length, y: cy / pieces.length, z: cz / pieces.length };
}

export function createScene(mountContainer) {
  const container = mountContainer;
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(
    (FRUSTUM_SIZE * aspect) / -2,
    (FRUSTUM_SIZE * aspect) / 2,
    FRUSTUM_SIZE / 2,
    FRUSTUM_SIZE / -2,
    0.1,
    200
  );

  const initial = {
    x: Math.cos(CAMERA_ELEVATION) * CAMERA_DISTANCE,
    y: Math.sin(CAMERA_ELEVATION) * CAMERA_DISTANCE,
    z: Math.cos(CAMERA_ELEVATION) * CAMERA_DISTANCE,
  };
  camera.position.set(initial.x, initial.y, initial.z);
  camera.lookAt(0, 0, 0);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04070b);
  scene.fog = new THREE.FogExp2(0x04070b, 0.012);

  const hemiLight = new THREE.HemisphereLight(0x9fc2e8, 0x1a2430, 0.55);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(14, 22, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 60;
  dirLight.shadow.camera.left = -25;
  dirLight.shadow.camera.right = 25;
  dirLight.shadow.camera.top = 25;
  dirLight.shadow.camera.bottom = -25;
  dirLight.shadow.bias = -0.001;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x4a7c9b, 0.35);
  fillLight.position.set(-10, 8, -10);
  scene.add(fillLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ color: 0x0b1320, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.panSpeed = 1.0;
  controls.enableZoom = true;
  controls.zoomSpeed = 1.4;
  controls.minZoom = 0.6;
  controls.maxZoom = 3.2;
  controls.enableRotate = true;
  controls.rotateSpeed = 0.8;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.15;
  controls.target.set(0, 1.5, 0);
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.update();

  let targetGoal = null;
  function setTarget(x, y, z) {
    targetGoal = new THREE.Vector3(x, y, z);
  }

  let animationId = null;
  function animate() {
    animationId = requestAnimationFrame(animate);
    if (targetGoal) {
      controls.target.lerp(targetGoal, 0.08);
      if (controls.target.distanceTo(targetGoal) < 0.02) {
        controls.target.copy(targetGoal);
        targetGoal = null;
      }
    }
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    const a = w / h;
    camera.left = (FRUSTUM_SIZE * a) / -2;
    camera.right = (FRUSTUM_SIZE * a) / 2;
    camera.top = FRUSTUM_SIZE / 2;
    camera.bottom = FRUSTUM_SIZE / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  function dispose() {
    cancelAnimationFrame(animationId);
    resizeObserver.disconnect();
    controls.dispose();
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  return { scene, camera, renderer, controls, setTarget, dispose };
}
