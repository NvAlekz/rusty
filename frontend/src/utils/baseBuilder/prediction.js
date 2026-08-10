import { getPieceDef } from './pieces.js';
import { computePlacement } from './interaction.js';

const MAX_PLACEMENTS = 400;

function toCells(set) {
  return Array.from(set).map((key) => {
    const [x, z] = key.split(',').map(Number);
    return { x, z };
  });
}

/* Celdas candidatas: bbox de las piezas ±2 celdas. Sin piezas → región ±6 alrededor del cursor. */
export function computeCandidateCells(pieces, pieceId, cursorCell = null) {
  const def = getPieceDef(pieceId);
  if (!def) return [];

  const candidates = new Set();

  if (pieces.length === 0) {
    if (!cursorCell || cursorCell.x === null || cursorCell.x === undefined) return [];
    const cx = cursorCell.x;
    const cz = cursorCell.z;
    for (let dx = -6; dx <= 6; dx++) {
      for (let dz = -6; dz <= 6; dz++) {
        candidates.add(`${cx + dx},${cz + dz}`);
      }
    }
    return toCells(candidates);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of pieces) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  for (let x = minX - 2; x <= maxX + 2; x++) {
    for (let z = minZ - 2; z <= maxZ + 2; z++) {
      candidates.add(`${x},${z}`);
    }
  }
  return toCells(candidates);
}

/* Todos los placements válidos para la pieza seleccionada, hasta un tope. */
export function computeAllValidPlacements(pieces, pieceId, tier, rotation, cursorCell = null) {
  const def = getPieceDef(pieceId);
  if (!def) return [];

  const cells = computeCandidateCells(pieces, pieceId, cursorCell);
  const placements = [];

  const rotations =
    def.shape === 'triangle' ? [rotation % 2, (rotation % 2) + 1] : [rotation % 4];

  for (const cell of cells) {
    for (const r of rotations) {
      const result = computePlacement(pieces, pieceId, tier, cell, r);
      if (result.valid) placements.push(result);
      if (placements.length >= MAX_PLACEMENTS) return placements;
    }
  }
  return placements;
}
