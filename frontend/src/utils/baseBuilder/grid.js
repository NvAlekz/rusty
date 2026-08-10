import * as THREE from 'three';

export const GRID_SIZE = 20;
export const CELL_SIZE = 1;

export function createGridHelper() {
  const grid = new THREE.Group();
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x2a3f5c, transparent: true, opacity: 0.45 });
  const axisMaterial = new THREE.LineBasicMaterial({ color: 0x4a7c59, transparent: true, opacity: 0.7 });

  for (let i = -GRID_SIZE; i <= GRID_SIZE; i++) {
    if (i === 0) continue;

    const geomX = new THREE.BufferGeometry();
    geomX.setAttribute('position', new THREE.Float32BufferAttribute([-GRID_SIZE, 0, i, GRID_SIZE, 0, i], 3));
    grid.add(new THREE.Line(geomX, lineMaterial));

    const geomZ = new THREE.BufferGeometry();
    geomZ.setAttribute('position', new THREE.Float32BufferAttribute([i, 0, -GRID_SIZE, i, 0, GRID_SIZE], 3));
    grid.add(new THREE.Line(geomZ, lineMaterial));
  }

  const axisX = new THREE.BufferGeometry();
  axisX.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.01, -GRID_SIZE, 0, 0.01, GRID_SIZE], 3));
  grid.add(new THREE.Line(axisX, axisMaterial));

  const axisZ = new THREE.BufferGeometry();
  axisZ.setAttribute('position', new THREE.Float32BufferAttribute([-GRID_SIZE, 0.01, 0, GRID_SIZE, 0.01, 0], 3));
  grid.add(new THREE.Line(axisZ, axisMaterial));

  return grid;
}

function createTriangleShapeGeometry() {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -0.5, 0.02, -0.5,
     0.5, 0.02, -0.5,
    -0.5, 0.02,  0.5,
    -0.5,-0.02, -0.5,
     0.5,-0.02, -0.5,
    -0.5,-0.02,  0.5,
  ]);
  const indices = [
    0,1,2, 3,5,4,
    0,3,1, 1,3,4,
    1,4,2, 2,4,5,
    2,5,0, 0,5,3,
  ];
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createHoverHighlight(shape, pieceType) {
  let geom;
  if (pieceType === 'wall' || pieceType === 'frame') {
    geom = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.02, 0.04));
  } else if (shape === 'triangle') {
    geom = new THREE.EdgesGeometry(createTriangleShapeGeometry());
  } else {
    geom = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.02, 1));
  }

  const material = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 });
  const highlight = new THREE.LineSegments(geom, material);
  highlight.visible = false;
  highlight.renderOrder = 2;
  return highlight;
}

export function raycastGround(camera, renderer, clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersect = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, intersect);
  return intersect;
}

/** Snap world position to nearest grid cell corner for foundations. */
export function getGridPosition(worldPos, shape, pieceType) {
  if (pieceType === 'wall' || pieceType === 'frame') {
    const x = Math.floor(worldPos.x + 0.5);
    const z = Math.floor(worldPos.z + 0.5);
    return { x, z };
  }

  if (shape === 'triangle') {
    const gx = Math.floor(worldPos.x);
    const gz = Math.floor(worldPos.z);
    const fx = worldPos.x - gx;
    const fz = worldPos.z - gz;
    const isUpper = fx + fz >= 1;
    return { x: gx, z: gz, isUpper };
  }

  const x = Math.floor(worldPos.x + 0.5);
  const z = Math.floor(worldPos.z + 0.5);
  return { x, z, isUpper: true };
}