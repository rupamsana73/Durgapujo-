import assert from 'node:assert/strict';
import fs from 'node:fs';
import { haversine, walkKm } from '../js/geo.js';
import { nearestStation, attachNearestMetro } from '../js/metro.js';
import * as route from '../js/route.js';
import * as timeline from '../js/timeline.js';
import * as ui from '../js/ui.js';
import { parseUrl } from '../js/share.js';

const pandals = JSON.parse(fs.readFileSync(new URL('../data/pandals.json', import.meta.url), 'utf8'));
const metro = JSON.parse(fs.readFileSync(new URL('../data/metro.json', import.meta.url), 'utf8'));
const config = JSON.parse(fs.readFileSync(new URL('../data/config.json', import.meta.url), 'utf8'));

// haversine sanity: 1 degree of latitude is about 111.2 km; zero distance is zero
assert.ok(Math.abs(haversine({lat:22,lng:88},{lat:23,lng:88}) - 111.19) < 0.5);
assert.equal(haversine(pandals[0], pandals[0]), 0);

// every pandal has a nearest station within a sane distance, and ids are unique
attachNearestMetro(pandals, metro.stations);
assert.equal(new Set(pandals.map(p=>p.id)).size, pandals.length);
assert.equal(new Set(metro.stations.map(s=>s.id)).size, metro.stations.length);
for (const p of pandals) { assert.ok(p.metro, p.name); assert.ok(p.metro.straightKm < 5, `${p.name} ${p.metro.straightKm}`); }
for (const s of metro.stations) for (const l of s.lines) assert.ok(metro.lines[l], `unknown line ${l}`);
console.log('nearest metro samples:', pandals.slice(0,4).map(p=>`${p.name} -> ${p.metro.station.name} (${p.metro.walkKm.toFixed(2)} km, ${p.metro.walkMin} min)`));

// ordering: nearest neighbour from Howrah visits a connected path, includes all stops once
const start = config.startPoints[0];
const picks = [1,6,11,17,8].map(id => pandals.find(p=>p.id===id));
const ordered = route.orderStops(start, picks);
assert.equal(ordered.length, picks.length);
assert.equal(new Set(ordered.map(p=>p.id)).size, picks.length);
const brute = [...picks].sort((a,b)=>haversine(start,a)-haversine(start,b))[0];
assert.equal(ordered[0].id, brute.id, 'first stop must be the one closest to the start');
for (let i=1;i<ordered.length;i++){ // each hop goes to the closest remaining stop
  const remaining = ordered.slice(i);
  const best = [...remaining].sort((a,b)=>haversine(ordered[i-1],a)-haversine(ordered[i-1],b))[0];
  assert.equal(ordered[i].id, best.id);
}
const noStart = route.orderStops(null, picks);
assert.equal(noStart[0].id, picks[0].id);

// URLs
const leg = route.buildLegs(null, picks.slice(0,2), 'transit');
assert.ok(!leg[0].url.includes('origin='), 'my-location start omits origin');
assert.ok(leg[1].url.includes('origin=') && leg[1].url.includes('travelmode=transit'));
const many = Array.from({length: 14}, (_, i) => pandals[i % pandals.length]);
const full = route.fullRoute(start, many, 'walking');
assert.equal(full.truncated, true);
assert.equal(decodeURIComponent(new URL(full.url).searchParams.get('waypoints')).split('|').length, 9);
assert.ok(!route.fullRoute(start, [], 'walking'));
assert.ok(route.totalKm(start, picks) > 0);

// share parsing
assert.deepEqual(parseUrl('?stops=3,7,x,12&start=howrah'), { stops: [3,7,12], start: 'howrah' });
assert.deepEqual(parseUrl(''), { stops: [], start: null });

// timeline
const at = (s) => timeline.status(config, new Date(s));
assert.deepEqual(at('2026-10-04T10:00:00'), { state:'before', target:'mahalaya', days:6 });
assert.equal(at('2026-10-12T10:00:00').target, 'shashthi');
assert.equal(at('2026-10-18T22:00:00').crowd, 'peak');
assert.equal(at('2026-10-17T08:00:00').crowd, 'low');
assert.equal(at('2026-10-21T08:00:00').state, 'after');

// templates render, escape HTML, and contain the Google Maps links
const evil = { ...pandals[0], name: '<img src=x onerror=1>', nameBn: '' };
const html = ui.cardHtml(evil, { planIndex: -1, fav: false, distKm: null, lines: metro.lines });
assert.ok(!html.includes('<img src=x'), 'name must be escaped');
const card = ui.cardHtml(pandals[0], { planIndex: 0, fav: true, distKm: 2.3, lines: metro.lines });
assert.ok(card.includes('google.com/maps/search/?api=1&query=22.6012%2C88.3652') || card.includes('google.com/maps/search/?api=1&query=22.6012,88.3652'));
assert.ok(card.includes('travelmode=transit'));
const planHtml = ui.planHtml({ stops: picks, start: 'howrah', startLabel: 'x', startPoints: config.startPoints, mode: 'walking',
  legs: route.buildLegs(start, picks), full, total: 12.3, waUrl: 'https://wa.me/?text=hi' });
assert.ok(planHtml.includes('data-change="start"') && planHtml.includes('data-action="up"'));
assert.ok(ui.guideHtml({ config, status: at('2026-10-18T22:00:00'), lang: 'en' }).includes('class="day today"'));
console.log('ALL TESTS PASSED');
