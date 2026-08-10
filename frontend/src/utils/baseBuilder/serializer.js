const STORAGE_KEY = 'rust-tracker-build';

function serializePlacement(p) {
  return {
    key: p.key,
    id: p.id,
    tier: p.tier,
    rotation: p.rotation || 0,
    x: p.x,
    z: p.z,
    y: p.y,
  };
}

export function saveDesign(placements, name = '') {
  const data = {
    name: name || 'Sin título',
    version: 1,
    createdAt: new Date().toISOString(),
    placements: placements.map(serializePlacement),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

export function loadDesign() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.placements)) return null;
    return data;
  } catch {
    return null;
  }
}

export function importFromJSON(json) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (!data || !Array.isArray(data.placements)) return null;
    return data;
  } catch {
    return null;
  }
}

export function exportToJSON(placements, name) {
  const data = saveDesign(placements, name);
  return JSON.stringify(data, null, 2);
}

export function clearDesign() {
  localStorage.removeItem(STORAGE_KEY);
}
