import { haversine } from './geo.js';

const BASE = 'https://www.google.com/maps';
const pt = (p) => `${p.lat},${p.lng}`;

export const MAX_WAYPOINTS = 9; // Google Maps URL limit for waypoints

export const placeUrl = (p) => `${BASE}/search/?api=1&query=${pt(p)}`;

/** Google Maps directions deep link. `origin: null` makes Google use the person's live location. */
export function dirUrl({ origin = null, dest, mode = 'transit', waypoints = [] }) {
  const q = new URLSearchParams({ api: '1', destination: pt(dest), travelmode: mode });
  if (origin) q.set('origin', pt(origin));
  if (waypoints.length) q.set('waypoints', waypoints.map(pt).join('|'));
  return `${BASE}/dir/?${q}`;
}

/** Nearest-neighbour ordering. Not optimal (TSP), but fine for 5-8 stops. */
export function orderStops(start, stops) {
  const rest = [...stops];
  const out = [];
  let cur = start;
  if (!cur && rest.length) { cur = rest.shift(); out.push(cur); }
  while (rest.length) {
    let bi = 0;
    let bd = Infinity;
    rest.forEach((s, i) => { const d = haversine(cur, s); if (d < bd) { bd = d; bi = i; } });
    cur = rest.splice(bi, 1)[0];
    out.push(cur);
  }
  return out;
}

/** One leg per consecutive pair. Transit mode works for single legs (waypoints do not support it). */
export function buildLegs(origin, stops, mode = 'transit') {
  return stops.map((to, i) => {
    const from = i === 0 ? origin : stops[i - 1];
    return { fromIndex: i - 1, to, url: dirUrl({ origin: from || null, dest: to, mode }) };
  });
}

/** Whole plan in one link. Only walking/driving/bicycling support waypoints. */
export function fullRoute(origin, stops, mode = 'walking') {
  if (!stops.length) return null;
  const dest = stops[stops.length - 1];
  const mids = stops.slice(0, -1);
  const truncated = mids.length > MAX_WAYPOINTS;
  const waypoints = mids.slice(0, MAX_WAYPOINTS);
  return { url: dirUrl({ origin, dest, mode, waypoints }), truncated };
}

/** Straight-line total in km along start -> stops. */
export function totalKm(startPoint, stops) {
  const path = startPoint ? [startPoint, ...stops] : stops;
  let sum = 0;
  for (let i = 1; i < path.length; i++) sum += haversine(path[i - 1], path[i]);
  return sum;
}
