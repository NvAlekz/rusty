import * as THREE from 'three';
import { getPieceDef, getPiecePreviewGeometry } from './pieces.js';
import { getGridPosition } from './grid.js';
import {
  getTierMaterial,
  createEdgeLines,
  getPieceLinesColor,
  getPreviewMaterial,
  getPreviewLineMaterial,
} from './materials.js';

export const WALL_THICKNESS = 0.04;
export const FOUNDATION_HEIGHT_REF = 0.16;

const ROTATION_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

/* ================================================================
   Piece key & world coords
   ================================================================ */

export function getPieceKey(piece) {
  const id = piece.id || '';
  const r = piece.rotation || 0;
  return `${piece.x},${piece.z},${piece.y},${id},${r}`;
}

export function pieceWorldPosition(piece) {
  const def = getPieceDef(piece.id);
  if (!def) return { x: piece.x + 0.5, y: piece.y, z: piece.z + 0.5 };

  if (def.type === 'wall' || def.type === 'frame') {
    const k = piece.rotation % 2;
    if (k === 0) {
      return { x: piece.x + 0.5, y: piece.y, z: piece.z };
    } else {
      return { x: piece.x, y: piece.y, z: piece.z + 0.5 };
    }
  }

  return { x: piece.x + 0.5, y: piece.y, z: piece.z + 0.5 };
}

export function pieceMeshWorldPosition(mesh) {
  return mesh ? mesh.position.clone() : null;
}

export function getPieceRotation(piece, def) {
  if (!def) def = getPieceDef(piece.id);
  if (!def) return 0;

  if ((def.type === 'floor' || def.type === 'floor_frame') && def.shape === 'triangle') {
    return piece.rotation % 2 === 1 ? Math.PI : 0;
  }
  return ROTATION_ANGLES[(piece.rotation || 0) % 4] || 0;
}

/* ================================================================
   Mesh construction
   ================================================================ */

export function createPieceMesh(piece, tier) {
  const def = getPieceDef(piece.id);
  if (!def) return new THREE.Group();

  const geometry = def.createGeometry();
  const material = getTierMaterial(tier);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const lines = createEdgeLines(geometry, getPieceLinesColor(tier), 0.45);
  lines.renderOrder = 1;

  mesh.userData.disposableGeom = true;
  lines.userData.disposableGeom = true;

  const group = new THREE.Group();
  const pos = pieceWorldPosition(piece);
  group.position.set(pos.x, pos.y, pos.z);
  group.rotation.y = getPieceRotation(piece, def);
  group.add(mesh);
  group.add(lines);

  return group;
}

export function createPreviewMesh(placement) {
  const def = getPieceDef(placement.id);
  if (!def) return null;

  const geometry = getPiecePreviewGeometry(placement.id);
  const mesh = new THREE.Mesh(geometry, getPreviewMaterial());
  const lines = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    getPreviewLineMaterial()
  );
  lines.renderOrder = 1;

  const group = new THREE.Group();

  if (def.type === 'wall' || def.type === 'frame') {
    const k = placement.rotation % 2;
    if (k === 0) {
      group.position.set(placement.x + 0.5, placement.y, placement.z);
    } else {
      group.position.set(placement.x, placement.y, placement.z + 0.5);
    }
  } else {
    group.position.set(placement.x + 0.5, placement.y, placement.z + 0.5);
  }

  group.rotation.y = getPieceRotation(placement, def);
  group.add(mesh);
  group.add(lines);

  lines.userData.disposableGeom = true;

  const key = getPieceKey(placement);
  group.userData.previewKey = key;
  group.userData.placement = placement;
  mesh.userData.previewKey = key;
  lines.userData.previewKey = key;

  return group;
}

export function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry && obj.userData.disposableGeom) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m.dispose());
    }
  });
}

/* ================================================================
   Sistema de soporte & colisiones
   ================================================================

   Reglas:
   1  Fundación → solo pisa el suelo (y=0).                No puede haber 2 en misma celda.
   2  Pared     → se apoya sobre fundación o suelo.         Colisión a ese nivel.
   3  Suelo     → requiere soporte en las 4 esquinas de su celda.
   4  Stair     → se apoya sobre top en la celda.
   5  Rojo      → se apoya sobre cualquier top en la celda, no bloquea layered.
=============================================================== */

function forCell(pieces, x, z) {
  return pieces.filter((p) => p.x === x && p.z === z);
}

function cellTop(pieces, x, z) {
  let highest = -1;
  for (const p of pieces) {
    const d = getPieceDef(p.id);
    if (!d) continue;

    if (d.type === 'foundation'
      || d.type === 'floor'
      || d.type === 'floor_frame'
      || d.type === 'stair'
      || d.type === 'roof') {

      if (p.x === x && p.z === z) {
        const top = p.y + (d.height || 0);
        if (top > highest) highest = top;
      }
    }

    if (d.type === 'wall' || d.type === 'frame') {
      const k = (p.rotation || 0) % 2;
      if (k === 0) {
        if ((p.x === x && p.z === z) || (p.x + 1 === x && p.z === z)) {
          const top = p.y + (d.height || 0);
          if (top > highest) highest = top;
        }
      } else {
        if ((p.x === x && p.z === z) || (p.x === x && p.z + 1 === z)) {
          const top = p.y + (d.height || 0);
          if(top > highest) highest = top;
        }
      }
    }
  }
  return highest;
}

function sameLayerExists(pieces, x, z, y, pieceId) {
  const def = getPieceDef(pieceId);
  if (!def) return false;
  const myType = def.type;

  for (const p of pieces) {
    const pDef = getPieceDef(p.id);
    if (!pDef) continue;
    const pType = pDef.type;

    if (myType === 'foundation') {
      if (p.x === x && p.z === z && pType === 'foundation') return true;
      continue;
    }

    if (myType === 'wall' || myType === 'frame') {
      if (pType !== 'wall' && pType !== 'frame') continue;
      if (Math.abs(p.y - y) > 0.04) continue;
      if (p.x === x && p.z === z) return true;

      const kr = (p.rotation || 0) % 2;
      if (kr === 0 && p.x + 1 === x && p.z === z) return true;
      if (kr === 1 && p.x === x && p.z + 1 === z) return true;
      continue;
    }

    if (myType === 'floor' || myType === 'floor_frame') {
      if (pType !== 'floor' && pType !== 'floor_frame') continue;
      if (Math.abs(p.y - y) < 0.04 && p.x === x && p.z === z) return true;
      continue;
    }

    if (myType === 'stair') {
      if (pType !== 'stair') continue;
      if (Math.abs(p.y - y) > 0.04 && p.x === x && p.z === z) return true;
      continue;
    }

    if (myType === 'roof') {
      if (pType !== 'roof') continue;
      if (p.x === x && p.z === z && Math.abs(p.y - y) < 0.04) return true;
      continue;
    }
  }
  return false;
}

function cornerTops(pieces, cx, cz) {
  return [
    cellTop(pieces, cx, cz),
    cellTop(pieces, cx + 1, cz),
    cellTop(pieces, cx, cz + 1),
    cellTop(pieces, cx + 1, cz + 1),
  ];
}

/* ================================================================
   computePlacement
   ================================================================ */

export function computePlacement(pieces, pieceId, tier, gridPos, rotation) {
  const def = getPieceDef(pieceId);
  if (!def) return { valid: false, reason: 'unknown' };

  const { x: gx, z: gz } = gridPos;
  const type = def.type;
  const shape = def.shape || 'square';

  /* Foundation */
  if (type === 'foundation') {
    if (sameLayerExists(pieces, gx, gz, 0, pieceId)) {
      return { valid: false, reason: 'occupied' };
    }
    return {
      valid: true,
      id: pieceId,
      x: gx,
      z: gz,
      y: 0,
      tier,
      rotation,
      isUpper: shape === 'triangle' ? rotation % 2 === 1 : false,
    };
  }

  /* Wall / Frame */
  if (type === 'wall' || type === 'frame') {
    const sup = cellTop(pieces, gx, gz);
    if (sup < 0) return { valid: false, reason: 'no-support' };

    if (sameLayerExists(pieces, gx, gz, sup, pieceId)) {
      return { valid: false, reason: 'occupied' };
    }

    return {
      valid: true,
      id: pieceId,
      x: gx,
      z: gz,
      y: sup,
      tier,
      rotation,
    };
  }

  /* Floor / Floor_frame */
  if (type === 'floor' || type === 'floor_frame') {
    const [c0, c1, c2, c3] = cornerTops(pieces, gx, gz);
    if (Math.min(c0, c1, c2, c3) < 0.04) return { valid: false, reason: 'no-support' };

    const h = Math.max(c0, c1, c2, c3);
    if (h < 0.17) return { valid: false, reason: 'no-support' };

    if (sameLayerExists(pieces, gx, gz, h, pieceId)) {
      return { valid: false, reason: 'occupied' };
    }

    return {
      valid: true,
      id: pieceId,
      x: gx,
      z: gz,
      y: h,
      tier,
      rotation,
    };
  }

  /* Stair / Roof */
  if (type === 'stair' || type === 'roof') {
    const top = cellTop(pieces, gx, gz);
    if (top < 0) return { valid: false, reason: 'no-support' };

    if (sameLayerExists(pieces, gx, gz, top, pieceId)) {
      return { valid: false, reason: 'occupied' };
    }

    return {
      valid: true,
      id: pieceId,
      x: gx,
      z: gz,
      y: top,
      tier,
      rotation,
    };
  }

  return { valid: false, reason: 'unknown' };
}

/* ================================================================  Raycast ================================================================ */

export function raycastToPiece(camera, renderer, event, pieceMeshes) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

  const objects = pieceMeshes.map((m) => (m.mesh ? m.mesh : m)).filter(Boolean);
  const intersects = raycaster.intersectObjects(objects, true);
  if (intersects.length === 0) return null;

  let obj = intersects[0].object;
  while (obj && !obj.userData.pieceKey) {
    obj = obj.parent;
  }
  return obj && obj.userData.pieceKey ? obj.userData.pieceKey : null;
}

export function raycastPreview(camera, renderer, event, previewMeshes) {
  const rect = renderer.domElement.getBoundingClientRect();
  const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

  const objects = previewMeshes.filter(Boolean);
  const intersects = raycaster.intersectObjects(objects, true);
  if (intersects.length === 0) return null;

  let obj = intersects[0].object;
  while (obj && !obj.userData.placement) {
    obj = obj.parent;
  }
  if (obj && obj.userData.placement) return obj.userData.placement;
  return null;
}

export { getGridPosition };