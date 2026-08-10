import * as THREE from 'three';

export const FOUNDATION_HEIGHT = 0.16;
const FH = FOUNDATION_HEIGHT;

/* ================================================================
   Geometrías con forma fiel a Rust
   ================================================================ */

function createFoundationGeometry() {
  /* Cimiento ocupa la celda completa (1x1), altura sutil. */
  return new THREE.BoxGeometry(1, FH, 1);
}

function createFoundationHalfGeometry() {
  /* Medio cimiento: triángulo isósceles ocupando ½ celda. */
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.5);
  shape.lineTo(0.5, -0.5);
  shape.lineTo(-0.5, 0.5);
  shape.closePath();
  const extrudeSettings = { steps: 1, depth: FH, bevelEnabled: false };
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
}

function createWallGeometry() {
  /* Pared ocupa 1 celda de ancho en una dirección y 0.04 de espesor.
     Altura Rust: ~3m → 1 unidad. Base abierta (sin cara inferior). */
  const w = 1.0;
  const d = 0.04;
  const h = 1.0;

  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, -h);
  shape.lineTo(-w / 2, -h);
  shape.closePath();

  const extrudeSettings = { steps: 1, depth: d, bevelEnabled: false };
  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  /* Rotar para que quede vertical con el frente hacia z+. */
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, h / 2, -d / 2);
  return geom;
}

function createHalfWallGeometry() {
  const w = 1.0;
  const d = 0.04;
  const h = FH; /* Medio cimiento de alto */

  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, -h);
  shape.lineTo(-w / 2, -h);
  shape.closePath();

  const extrudeSettings = { steps: 1, depth: d, bevelEnabled: false };
  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, h / 2, -d / 2);
  return geom;
}

function createLowWallGeometry() {
  const w = 1.0;
  const d = 0.04;
  const h = 0.35;

  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, -h);
  shape.lineTo(-w / 2, -h);
  shape.closePath();

  const extrudeSettings = { steps: 1, depth: d, bevelEnabled: false };
  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, h / 2, -d / 2);
  return geom;
}

function createFrameGeometry() {
  /* Marco = pared con agujero. Simplificado: misma geometría que pared. */
  return createWallGeometry();
}

function createDoorFrameGeometry() {
  /* Puerta: pared con hueco en estadio de sólo la geometría. */
  return createWallGeometry();
}

function createWindowFrameGeometry() {
  return createWallGeometry();
}

function createFloorGeometry() {
  /* Suelo: caja plana 1x1 con altura sutil. */
  return new THREE.BoxGeometry(1, 0.05, 1);
}

function createStairsGeometry() {
  /* Stair en L: bloque 1x1 en la base + plataforma elevada de 0.25 en un lateral. */
  const group = new THREE.BoxGeometry(1, 0.5, 1);
  return group;
}

function createLStairsGeometry() {
  return createStairsGeometry();
}

function createUStairsGeometry() {
  return createStairsGeometry();
}

function createRampGeometry() {
  /* Rampa simple: triángulo extrudido. */
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1, 0);
  shape.lineTo(0, 1);
  shape.closePath();
  const extrudeSettings = { steps: 1, depth: 1, bevelEnabled: false };
  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.translate(-0.5, 0, -0.5);
  return geom;
}

function createFloorFrameGeometry() {
  return createFloorGeometry();
}

function createRoofGeometry() {
  /* Techo en ángulo: triángulo 2D extrudido. Base 1×1, pico centrado. */
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  shape.lineTo(0, FH + 0.4);
  shape.closePath();
  const extrudeSettings = { steps: 1, depth: 1, bevelEnabled: false };
  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.translate(0, 0, -0.5);
  return geom;
}

/* ============================================================
   Definiciones de piezas
   ============================================================ */

export const PIECE_DEFINITIONS = {
  /* ---------- Fundaciones ---------- */
  square_foundation: {
    id: 'square_foundation',
    name: 'Cimiento',
    type: 'foundation',
    shape: 'square',
    height: FH,
    costTable: { wood: 50, stone: 100 },
    createGeometry: createFoundationGeometry,
    placementOffset: { x: 0, z: 0 }, /* centro de la celda */
  },
  triangle_foundation: {
    id: 'triangle_foundation',
    name: 'Triángulo',
    type: 'foundation',
    shape: 'triangle',
    height: FH,
    costTable: { wood: 25, stone: 50 },
    createGeometry: createFoundationHalfGeometry,
    placementOffset: { x: 0, z: 0 },
  },

  /* ---------- Paredes ---------- */
  wall: {
    id: 'wall',
    name: 'Pared',
    type: 'wall',
    shape: 'line',
    height: 1.0,
    costTable: { wood: 50, stone: 100 },
    createGeometry: createWallGeometry,
    placementOffset: { x: 0, z: 0 },
  },
  half_wall: {
    id: 'half_wall',
    name: 'Media pared',
    type: 'wall',
    shape: 'line',
    height: 0.5,
    costTable: { wood: 25, stone: 50 },
    createGeometry: createHalfWallGeometry,
    placementOffset: { x: 0, z: 0 },
  },
  low_wall: {
    id: 'low_wall',
    name: 'Pared baja',
    type: 'wall',
    shape: 'line',
    height: 0.35,
    costTable: { wood: 15, stone: 30 },
    createGeometry: createLowWallGeometry,
    placementOffset: { x: 0, z: 0 },
  },

  /* ---------- Marcos ---------- */
  frame: {
    id: 'frame',
    name: 'Marco',
    type: 'frame',
    shape: 'line',
    height: 1.0,
    costTable: { wood: 30, stone: 60 },
    createGeometry: createFrameGeometry,
    placementOffset: { x: 0, z: 0 },
  },
  door_frame: {
    id: 'door_frame',
    name: 'Marco puerta',
    type: 'frame',
    shape: 'line',
    height: 1.0,
    costTable: { wood: 20, stone: 40 },
    createGeometry: createDoorFrameGeometry,
    placementOffset: { x: 0, z: 0 },
  },
  window_frame: {
    id: 'window_frame',
    name: 'Marco ventana',
    type: 'frame',
    shape: 'line',
    height: 1.0,
    costTable: { wood: 15, stone: 30 },
    createGeometry: createWindowFrameGeometry,
    placementOffset: { x: 0, z: 0 },
  },

  /* ---------- Suelos ---------- */
  square_floor: {
    id: 'square_floor',
    name: 'Suelo',
    type: 'floor',
    shape: 'square',
    height: 0.05,
    costTable: { wood: 40, stone: 80 },
    createGeometry: createFloorGeometry,
    placementOffset: { x: 0, z: 0 },
  },
  triangle_floor: {
    id: 'triangle_floor',
    name: 'Suelo triángulo',
    type: 'floor',
    shape: 'triangle',
    height: 0.05,
    costTable: { wood: 20, stone: 40 },
    createGeometry: createFoundationHalfGeometry,
    placementOffset: { x: 0, z: 0 },
  },
  square_floor_frame: {
    id: 'square_floor_frame',
    name: 'Marco suelo',
    type: 'floor_frame',
    shape: 'square',
    height: 0.05,
    costTable: { wood: 25, stone: 50 },
    createGeometry: createFloorFrameGeometry,
    placementOffset: { x: 0, z: 0 },
  },
  triangle_floor_frame: {
    id: 'triangle_floor_frame',
    name: 'Marco suelo Δ',
    type: 'floor_frame',
    shape: 'triangle',
    height: 0.05,
    costTable: { wood: 12, stone: 25 },
    createGeometry: createFoundationHalfGeometry,
    placementOffset: { x: 0, z: 0 },
  },

  /* ---------- Escaleras ---------- */
  stairs: {
    id: 'stairs',
    name: 'Escaleras U',
    type: 'stair',
    shape: 'square',
    height: 0.75,
    costTable: { wood: 30, stone: 60 },
    createGeometry: createStairsGeometry,
    placementOffset: { x: 0, z: 0 },
  },
  lstair: {
    id: 'lstair',
    name: 'Escaleras L',
    type: 'stair',
    shape: 'square',
    height: 0.75,
    costTable: { wood: 30, stone: 60 },
    createGeometry: createLStairsGeometry,
    placementOffset: { x: 0, z: 0 },
  },
  ustair: {
    id: 'ustair',
    name: 'Escaleras',
    type: 'stair',
    shape: 'square',
    height: 0.75,
    costTable: { wood: 30, stone: 60 },
    createGeometry: createUStairsGeometry,
    placementOffset: { x: 0, z: 0 },
  },
  ramp: {
    id: 'ramp',
    name: 'Rampa',
    type: 'stair',
    shape: 'square',
    height: 0.75,
    costTable: { wood: 30, stone: 60 },
    createGeometry: createRampGeometry,
    placementOffset: { x: 0, z: 0 },
  },
  /* ---------- Techo ---------- */
  triangle_roof: {
    id: 'triangle_roof',
    name: 'Techo',
    type: 'roof',
    shape: 'triangle',
    height: 0.4,
    costTable: { wood: 30, stone: 60 },
    createGeometry: createRoofGeometry,
    placementOffset: { x: 0, z: 0 },
  },
};

/* ================================================================
   Categorías para la UI
   ================================================================ */

export const PIECE_CATEGORIES = [
  {
    id: 'foundations',
    name: 'Fundaciones',
    pieces: ['square_foundation', 'triangle_foundation'],
  },
  {
    id: 'walls',
    name: 'Paredes',
    pieces: ['wall', 'half_wall', 'low_wall'],
  },
  {
    id: 'frames',
    name: 'Marcos',
    pieces: ['frame', 'door_frame', 'window_frame'],
  },
  {
    id: 'floors',
    name: 'Suelos',
    pieces: ['square_floor', 'triangle_floor', 'square_floor_frame', 'triangle_floor_frame'],
  },
  {
    id: 'stair',
    name: 'Escaleras',
    pieces: ['stairs', 'lstair', 'ustair', 'ramp'],
  },
  {
    id: 'roof',
    name: 'Techos',
    pieces: ['triangle_roof'],
  },
];

/* ================================================================
   Helpers
   ================================================================ */

export function getPieceDef(pieceId) {
  return PIECE_DEFINITIONS[pieceId] || null;
}

export function getPieceCost(pieceId, tier) {
  const def = PIECE_DEFINITIONS[pieceId];
  if (!def || !def.costTable) return 0;
  return def.costTable[tier] || 0;
}

export function getPiecePreviewGeometry(pieceId) {
  const def = PIECE_DEFINITIONS[pieceId];
  if (!def) return new THREE.BoxGeometry(1, 0.02, 1);
  return def.createGeometry();
}