import * as THREE from 'three';

export const MATERIAL_TIERS = {
  twig: { name: 'Twig', color: 0x9a7b5a, hp: 10,   roughness: 0.9, metalness: 0.0, resource: 'wood' },
  wood: { name: 'Madera', color: 0xc9a46a, hp: 250,  roughness: 0.8, metalness: 0.0, resource: 'wood' },
  stone: { name: 'Piedra', color: 0x8e8e8e, hp: 500,  roughness: 0.75, metalness: 0.1, resource: 'stone' },
  metal: { name: 'Metal', color: 0x8b9bb4, hp: 1000, roughness: 0.4, metalness: 0.8, resource: 'metalFragments' },
  hqm:  { name: 'HDQ',  color: 0xc9c9e8, hp: 2000, roughness: 0.3, metalness: 0.9, resource: 'hqm' },
};

export const TIER_ORDER = ['twig', 'wood', 'stone', 'metal', 'hqm'];

export const PREVIEW_COLOR = 0xfb923c;

const RESOURCE_LABELS = {
  wood: 'Madera',
  stone: 'Piedra',
  metalFragments: 'Fragmentos',
  hqm: 'HDQ',
};

export function getResourceLabel(resource) {
  return RESOURCE_LABELS[resource] ?? resource;
}

export function getTierMaterial(tier, options = {}) {
  const config = MATERIAL_TIERS[tier];
  if (!config) return null;

  return new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: config.roughness,
    metalness: config.metalness,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1.0,
    depthWrite: !options.transparent,
    side: THREE.DoubleSide,
  });
}

export function createEdgeLines(geometry, color = 0xffffff, opacity = 0.4) {
  const edges = new THREE.EdgesGeometry(geometry);
  return new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
}

export function getPieceLinesColor(tier) {
  const config = MATERIAL_TIERS[tier];
  return config ? new THREE.Color(config.color).multiplyScalar(0.6).getHex() : 0xffffff;
}

export function getPreviewMaterial() {
  return new THREE.MeshStandardMaterial({
    color: PREVIEW_COLOR,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function getPreviewLineMaterial() {
  return new THREE.LineBasicMaterial({
    color: PREVIEW_COLOR,
    transparent: true,
    opacity: 0.75,
  });
}

export function getTierColor(tier) {
  const config = MATERIAL_TIERS[tier];
  return config ? config.color : 0x808080;
}

export function getTierHP(tier) {
  const config = MATERIAL_TIERS[tier];
  return config ? config.hp : 0;
}

export function getNextTier(tier) {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx === -1 || idx === TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

export function getPrevTier(tier) {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx <= 0) return null;
  return TIER_ORDER[idx - 1];
}

export function getTierIcon(tier) {
  const config = MATERIAL_TIERS[tier];
  return config ? config.name.charAt(0) : '?';
}
