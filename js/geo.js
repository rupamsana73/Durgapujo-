// Pure geometry helpers. No DOM, no state, so they are easy to unit test.
const R = 6371; // Earth radius, km
const rad = (d) => (d * Math.PI) / 180;

/** Straight-line distance in km between two {lat,lng} points (haversine formula). */
export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Roads are rarely straight, so inflate the straight-line distance for walking estimates.
export const WALK_DETOUR = 1.3;
export const WALK_MIN_PER_KM = 12; // ~5 km/h

export const walkKm = (straightKm) => straightKm * WALK_DETOUR;
export const walkMin = (km) => Math.max(1, Math.round(km * WALK_MIN_PER_KM));
export const fmtKm = (km) => (km < 10 ? km.toFixed(1) : String(Math.round(km)));
export const walkRange = (minutes) => {
  const low = Math.max(1, Math.round(minutes * 0.8));
  const high = Math.max(low, Math.round(minutes * 1.2));
  return low === high ? `~${low}` : `~${low}–${high}`;
};
