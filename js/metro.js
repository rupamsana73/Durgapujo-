import { haversine, walkKm, walkMin } from './geo.js';

/** Nearest metro station to any {lat,lng} point. */
export function nearestStation(point, stations) {
  let best = null;
  let bestKm = Infinity;
  for (const s of stations) {
    const d = haversine(point, s);
    if (d < bestKm) { bestKm = d; best = s; }
  }
  if (!best) return null;
  const wk = walkKm(bestKm);
  return { station: best, straightKm: bestKm, walkKm: wk, walkMin: walkMin(wk) };
}

/** Computed once at load and cached on each pandal as `p.metro`. */
export function attachNearestMetro(pandals, stations) {
  for (const p of pandals) p.metro = nearestStation(p, stations);
  return pandals;
}

export const lineColor = (lines, station) => lines[station.lines[0]]?.color || '#555555';
