import assert from 'node:assert/strict';
import fs from 'node:fs';
import { haversine, walkKm, walkRange } from '../js/geo.js';
import { nearestStation, nearbyStations, attachNearestMetro, getPandalsNearMetro, getMetroStationsByRegion } from '../js/metro.js';
import * as route from '../js/route.js';
import * as timeline from '../js/timeline.js';
import * as ui from '../js/ui.js';
import { parseUrl } from '../js/share.js';
import { validatePandals, normalizePandalName, validatePandalCoordinates } from '../js/data.js';

const pandals = JSON.parse(fs.readFileSync(new URL('../data/pandals.json', import.meta.url), 'utf8'));
const metro = JSON.parse(fs.readFileSync(new URL('../data/metro.json', import.meta.url), 'utf8'));
const config = JSON.parse(fs.readFileSync(new URL('../data/config.json', import.meta.url), 'utf8'));

assert.ok(pandals.length > 100);
assert.equal(new Set(pandals.map((p) => p.id)).size, pandals.length);
assert.equal(new Set(pandals.map((p) => p.slug || p.id)).size, pandals.length);
assert.ok(pandals.every((p) => p.googleMapsQuery && p.googleMapsUrl));
assert.ok(pandals.some((p) => p.locationVerified && p.lat !== null && p.lng !== null));
assert.ok(pandals.some((p) => !p.locationVerified && p.lat === null && p.lng === null));
assert.ok(pandals.find((p) => p.name === 'Baghbazar Sarbojanin')?.locationVerified);
const validMapPandals = pandals.filter((p) => p.locationVerified && Number.isFinite(p.lat) && Number.isFinite(p.lng));
assert.equal(validMapPandals.length, 32);
assert.equal(new Set(validMapPandals.map((p) => `${p.lat},${p.lng}`)).size, validMapPandals.length);
assert.ok(validMapPandals.every(validatePandalCoordinates));
for (const name of ['Kumartuli Sarbojanin', 'College Square', 'Chetla Agrani', 'Deshapriya Park']) {
  assert.ok(pandals.find((p) => p.name === name)?.locationVerified, `${name} should have a verified map location`);
}
assert.equal(new Set(pandals.map((p) => `${normalizePandalName(p.name)}|${p.areaGroup}`)).size, pandals.length);
assert.equal(validatePandals([...pandals, pandals[0]]).length, pandals.length);
assert.deepEqual(
  pandals.reduce((counts, p) => ({ ...counts, [p.region]: (counts[p.region] || 0) + 1 }), {}),
  { north: 65, central: 4, south: 54 }
);
const featured = pandals.filter((p) => p.featured);
assert.equal(featured.length, 8);
const famousHome = featured.slice(0, 5);
assert.equal(famousHome.length, 5);
assert.equal(famousHome.filter((p) => p.region === 'north').length, 2);
assert.equal(famousHome.filter((p) => p.region === 'south').length, 2);
assert.equal(famousHome.filter((p) => p.region === 'central').length, 1);

const sample = [
  { id: 'a', name: 'A', lat: 22.576, lng: 88.362, locationVerified: true },
  { id: 'b', name: 'B', lat: 22.58, lng: 88.365, locationVerified: true }
];
assert.ok(Math.abs(haversine({ lat: 22, lng: 88 }, { lat: 23, lng: 88 }) - 111.19) < 0.5);
assert.equal(haversine(sample[0], sample[0]), 0);
attachNearestMetro(sample, metro.stations);
assert.ok(sample[0].metro);
assert.equal(sample[0].metro.estimatedWalkingDistanceKm, sample[0].metro.walkKm);
assert.match(sample[0].metro.estimatedWalkingTime, /^~/);
assert.match(walkRange(10), /^~\d+(–\d+)?$/);
assert.ok(nearbyStations(sample[0], metro.stations, 1.5).length > 0);
assert.ok(nearbyStations(sample[0], metro.stations, 1.5).every((a, i, all) => i === 0 || all[i - 1].straightKm <= a.straightKm));
assert.equal(nearbyStations(sample[0], metro.stations, 0.001).length, 0);
assert.equal(sample[0].nearbyMetro.length, 3);
assert.ok(getMetroStationsByRegion('north', metro.stations).every((s) => s.lat >= 22.59));
const unverified = [{ id: 'u', name: 'Unknown', lat: null, lng: null, locationVerified: false }];
attachNearestMetro(unverified, metro.stations);
assert.equal(unverified[0].metro, null);
assert.equal(unverified[0].nearbyMetro.length, 0);
assert.equal(getPandalsNearMetro(metro.stations[5], unverified, 2).length, 0);

const start = { lat: 22.58, lng: 88.34 };
const picks = [
  { id: 1, lat: 22.60, lng: 88.36 },
  { id: 2, lat: 22.57, lng: 88.36 },
  { id: 3, lat: 22.53, lng: 88.36 }
];
const ordered = route.orderStops(start, picks);
assert.equal(ordered.length, 3);
assert.equal(new Set(ordered.map((p) => p.id)).size, 3);
assert.ok(route.totalKm(start, picks) > 0);

const unverifiedPlace = { name: 'Unknown Pandal', googleMapsQuery: 'Unknown Pandal Durga Puja Kolkata' };
assert.ok(route.placeUrl(unverifiedPlace).includes(encodeURIComponent(unverifiedPlace.googleMapsQuery)));
const walking = route.dirUrl({ origin: { name: 'Central Metro' }, dest: unverifiedPlace, mode: 'walking' });
assert.ok(walking.includes('origin=Central+Metro') && walking.includes('travelmode=walking'));
const transit = route.dirUrl({ dest: unverifiedPlace, mode: 'transit' });
assert.ok(transit.includes('travelmode=transit'));
assert.ok(route.dirUrl({ dest: unverifiedPlace, mode: 'driving' }).includes('travelmode=driving'));
assert.ok(route.dirUrl({ dest: unverifiedPlace, mode: 'walking', navigate: true }).includes('dir_action=navigate'));

assert.deepEqual(parseUrl('?stops=3,7,x,12&start=howrah'), { stops: ['3', '7', 'x', '12'], start: 'howrah' });
assert.deepEqual(parseUrl(''), { stops: [], start: null });

const at = (s) => timeline.status(config, new Date(s));
assert.equal(at('2026-10-18T22:00:00').crowd, 'peak');
assert.equal(at('2026-10-21T08:00:00').state, 'after');

const evil = { ...unverifiedPlace, name: '<img src=x onerror=1>', nameBn: '' };
const html = ui.cardHtml(evil, { planIndex: -1, fav: false, distKm: null, lines: metro.lines });
assert.ok(!html.includes('<img src=x'));
const detail = ui.detailViewHtml(unverifiedPlace, metro.lines, false);
assert.ok(detail.includes('Google Maps') && detail.includes('সঠিক') || detail.includes('pending'));
const wishlist = ui.wishlistHtml([pandals.find((p) => p.name === 'Baghbazar Sarbojanin')], metro.lines);
assert.ok(wishlist.includes('Baghbazar Sarbojanin'));
assert.ok(wishlist.includes('data-action="fav"'));
console.log(`dataset: ${pandals.length} unique pandals; ALL TESTS PASSED`);
