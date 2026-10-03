import assert from 'node:assert/strict';
import fs from 'node:fs';
import { haversine, walkKm } from '../js/geo.js';
import { nearestStation, nearbyStations, attachNearestMetro } from '../js/metro.js';
import * as route from '../js/route.js';
import * as timeline from '../js/timeline.js';
import * as ui from '../js/ui.js';
import { parseUrl } from '../js/share.js';
import { validatePandals, normalizePandalName } from '../js/data.js';

const pandals = JSON.parse(fs.readFileSync(new URL('../data/pandals.json', import.meta.url), 'utf8'));
const metro = JSON.parse(fs.readFileSync(new URL('../data/metro.json', import.meta.url), 'utf8'));
const config = JSON.parse(fs.readFileSync(new URL('../data/config.json', import.meta.url), 'utf8'));

assert.ok(pandals.length > 100);
assert.equal(new Set(pandals.map((p) => p.id)).size, pandals.length);
assert.ok(pandals.every((p) => p.googleMapsQuery && p.googleMapsUrl && p.lat === null && p.lng === null && !p.locationVerified));
assert.equal(new Set(pandals.map((p) => `${normalizePandalName(p.name)}|${p.areaGroup}`)).size, pandals.length);
assert.equal(validatePandals([...pandals, pandals[0]]).length, pandals.length);

const sample = [
  { id: 'a', name: 'A', lat: 22.576, lng: 88.362, locationVerified: true },
  { id: 'b', name: 'B', lat: 22.58, lng: 88.365, locationVerified: true }
];
assert.ok(Math.abs(haversine({ lat: 22, lng: 88 }, { lat: 23, lng: 88 }) - 111.19) < 0.5);
assert.equal(haversine(sample[0], sample[0]), 0);
attachNearestMetro(sample, metro.stations);
assert.ok(sample[0].metro);
assert.ok(nearbyStations(sample[0], metro.stations, 1.5).length > 0);
assert.equal(nearbyStations(sample[0], metro.stations, 0.001).length, 0);
const unverified = [{ id: 'u', name: 'Unknown', lat: null, lng: null, locationVerified: false }];
attachNearestMetro(unverified, metro.stations);
assert.equal(unverified[0].metro, null);

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

assert.deepEqual(parseUrl('?stops=3,7,x,12&start=howrah'), { stops: ['3', '7', 'x', '12'], start: 'howrah' });
assert.deepEqual(parseUrl(''), { stops: [], start: null });

const at = (s) => timeline.status(config, new Date(s));
assert.equal(at('2026-10-18T22:00:00').crowd, 'peak');
assert.equal(at('2026-10-21T08:00:00').state, 'after');

const evil = { ...unverifiedPlace, name: '<img src=x onerror=1>', nameBn: '' };
const html = ui.cardHtml(evil, { planIndex: -1, fav: false, distKm: null, lines: metro.lines });
assert.ok(!html.includes('<img src=x'));
console.log(`dataset: ${pandals.length} unique pandals; ALL TESTS PASSED`);
