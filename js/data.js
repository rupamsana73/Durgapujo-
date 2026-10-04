const getJson = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

export const validCoord = (p) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;

export const validatePandalCoordinates = (p) =>
  validCoord(p) && p.lat >= 22.3 && p.lat <= 22.8 && p.lng >= 88.1 && p.lng <= 88.6;

export const normalizePandalName = (name) =>
  String(name).toLowerCase().replace(/[’'./-]/g, ' ').replace(/\s+/g, ' ').trim();

export function validatePandals(records) {
  const ids = new Set();
  const names = new Set();
  return records.filter((p) => {
    const coordsEmpty = p.lat == null && p.lng == null;
    const good = p.id && !ids.has(p.id) && p.name && p.googleMapsQuery && p.googleMapsUrl &&
      ['north', 'south', 'central'].includes(p.region) && (coordsEmpty || validatePandalCoordinates(p));
    const nameKey = `${normalizePandalName(p.name)}|${p.areaGroup || p.area}`;
    if (!good || names.has(nameKey)) {
      console.warn('Skipping invalid or duplicate pandal:', p);
      return false;
    }
    ids.add(p.id); names.add(nameKey); return true;
  });
}

export function normalizeId(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/^north-|^south-|^central-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function findPandal(pandals, identifier) {
  if (!identifier || !pandals?.length) return null;
  const raw = String(identifier).trim().toLowerCase();
  // 1. Exact id or slug match
  let match = pandals.find((p) => (p.id && p.id.toLowerCase() === raw) || (p.slug && p.slug.toLowerCase() === raw));
  if (match) return match;

  // 2. Normalized id or slug match
  const norm = normalizeId(raw);
  match = pandals.find((p) => normalizeId(p.id) === norm || normalizeId(p.slug) === norm);
  if (match) return match;

  // 3. Normalized name match
  match = pandals.find((p) => normalizeId(p.name) === norm);
  if (match) return match;

  // 4. Substring / slug containment
  match = pandals.find((p) => {
    const pNorm = normalizeId(p.id);
    const sNorm = normalizeId(p.slug || '');
    return (norm.length >= 4 && (pNorm.includes(norm) || sNorm.includes(norm) || norm.includes(pNorm)));
  });
  if (match) return match;

  // 5. Bengali name match if provided
  match = pandals.find((p) => p.nameBn && p.nameBn.trim().toLowerCase() === raw);
  return match || null;
}

export function findStation(stations, identifier) {
  if (!identifier || !stations?.length) return null;
  const raw = String(identifier).trim().toLowerCase();
  // 1. Exact id or name match
  let match = stations.find((s) => (s.id && s.id.toLowerCase() === raw) || (s.name && s.name.toLowerCase() === raw));
  if (match) return match;

  // 2. Normalized id or name
  const norm = normalizeId(raw);
  match = stations.find((s) => normalizeId(s.id) === norm || normalizeId(s.name) === norm);
  if (match) return match;

  // 3. Containment
  match = stations.find((s) => {
    const sNorm = normalizeId(s.name);
    return (norm.length >= 3 && (sNorm.includes(norm) || norm.includes(sNorm) || normalizeId(s.id).includes(norm)));
  });
  return match || null;
}

export function getHomeFeatured(pandals) {
  if (!pandals?.length) return [];
  const north = pandals.filter((p) => p.featured && p.region === 'north').slice(0, 2);
  const south = pandals.filter((p) => p.featured && p.region === 'south').slice(0, 2);
  const central = pandals.filter((p) => p.featured && p.region === 'central').slice(0, 1);
  return [...north, ...south, ...central];
}

/** Load and validate all data; unverified pandals remain searchable but are not mapped. */
export async function loadAll() {
  const root = typeof document !== 'undefined' && document.body?.dataset.page === 'home' ? '' : '../';
  const [pandals, metro, config] = await Promise.all([
    getJson(`${root}data/pandals.json`),
    getJson(`${root}data/metro.json`),
    getJson(`${root}data/config.json`)
  ]);
  const ok = validatePandals(pandals);
  metro.stations = metro.stations.filter((s) => {
    const good = validCoord(s);
    if (!good) console.warn('Skipping station with bad coordinates:', s);
    return good;
  });
  return { pandals: ok, metro, config };
}

