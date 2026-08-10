import { MATERIAL_TIERS } from './materials.js';
import { getPieceDef, getPieceCost } from './pieces.js';

export const RESOURCE_ORDER = ['wood', 'stone', 'metalFragments', 'hqm'];

export function calculateTotalCost(pieces) {
  const totals = { wood: 0, stone: 0, metalFragments: 0, hqm: 0 };
  pieces.forEach((piece) => {
    const tier = MATERIAL_TIERS[piece.tier];
    const resource = tier ? tier.resource : null;
    if (!resource || totals[resource] === undefined) return;
    totals[resource] += getPieceCost(piece.id, piece.tier);
  });
  return totals;
}

export function countPieces(pieces) {
  return pieces.length;
}

export function formatCost(cost) {
  if (cost >= 1000000) return `${(cost / 1000000).toFixed(1)}M`;
  if (cost >= 1000) return `${(cost / 1000).toFixed(1)}k`;
  return cost.toString();
}

export function getTotalHP(pieces) {
  return pieces.reduce((sum, p) => sum + (MATERIAL_TIERS[p.tier]?.hp ?? 0), 0);
}
