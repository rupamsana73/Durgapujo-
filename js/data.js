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
