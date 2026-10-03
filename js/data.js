const getJson = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
};

const validCoord = (p) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat > 21 && p.lat < 24 && p.lng > 87 && p.lng < 90;

/** Load all three data files and drop records with missing/implausible coordinates. */
export async function loadAll() {
  const [pandals, metro, config] = await Promise.all([
    getJson('data/pandals.json'),
    getJson('data/metro.json'),
    getJson('data/config.json')
  ]);
  const ok = pandals.filter((p) => {
    const good = validCoord(p);
    if (!good) console.warn('Skipping pandal with bad coordinates:', p);
    return good;
  });
  metro.stations = metro.stations.filter((s) => {
    const good = validCoord(s);
    if (!good) console.warn('Skipping station with bad coordinates:', s);
    return good;
  });
  return { pandals: ok, metro, config };
}
