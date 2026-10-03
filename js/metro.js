import { haversine, walkKm, walkMin, walkRange } from './geo.js';
const validPoint = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng);

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
  const minutes = walkMin(wk);
  return {
    station: best,
    straightKm: bestKm,
    walkKm: wk,
    walkMin: minutes,
    estimatedWalkingDistanceKm: wk,
    estimatedWalkingMinutes: minutes,
    estimatedWalkingTime: walkRange(minutes)
  };
}

export function nearbyStations(point, stations, radiusKm = 1.5) {
  return stations
    .map((station) => ({ station, straightKm: haversine(point, station) }))
    .filter(({ straightKm }) => straightKm <= radiusKm)
    .sort((a, b) => a.straightKm - b.straightKm)
    .map(({ station, straightKm }) => ({
      station,
      straightKm,
      walkKm: walkKm(straightKm),
      walkMin: walkMin(walkKm(straightKm)),
      estimatedWalkingDistanceKm: walkKm(straightKm),
      estimatedWalkingMinutes: walkMin(walkKm(straightKm)),
      estimatedWalkingTime: walkRange(walkMin(walkKm(straightKm)))
    }));
}

export function getPandalsNearMetro(station, pandals, radiusKm = 2) {
  return pandals
    .map((p) => ({ pandal: p, distanceKm: validPoint(p) && p.locationVerified ? haversine(p, station) : null }))
    .filter(({ distanceKm }) => distanceKm != null && distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function getMetroStationsByRegion(region, stations) {
  if (!region) return stations;
  return stations.filter((s) => {
    if (region === 'north') return s.lat >= 22.59;
    if (region === 'south') return s.lat <= 22.55;
    return s.lat > 22.55 && s.lat < 22.59;
  });
}

/** Computed once at load and cached on each pandal as `p.metro`. */
export function attachNearestMetro(pandals, stations, radiusKm = 1.5) {
  for (const p of pandals) {
    if (!p.locationVerified || !validPoint(p)) {
      p.metro = null;
      p.nearbyMetro = [];
      continue;
    }
    p.metro = nearestStation(p, stations);
    const withinRadius = nearbyStations(p, stations, radiusKm);
    const allNearby = nearbyStations(p, stations, Infinity);
    p.nearbyMetro = [...withinRadius, ...allNearby
      .filter((candidate) => !withinRadius.some((near) => near.station.id === candidate.station.id))]
      .slice(0, 3);
  }

  return pandals;
}

export const lineColor = (lines, station) => lines[station.lines[0]]?.color || '#555555';
