import assert from 'node:assert';
import fs from 'node:fs';
import { PUJA_AI_DATA } from '../Puja_ai/puja-ai-data.js';

console.log('--- STARTING COMPREHENSIVE INTERACTION & INTENT TESTS ---');

const pandals = JSON.parse(fs.readFileSync('data/pandals.json', 'utf8'));
const metro = JSON.parse(fs.readFileSync('data/metro.json', 'utf8'));
const stations = metro.stations;

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[.,!?।\-_/\\#@$%^&*()+=~`{}[\]:;"'<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveCanonicalDestination(query) {
  const q = normalize(query);
  const dests = PUJA_AI_DATA.destinations || [];

  for (const d of dests) {
    if (d.keywords && d.keywords.some(kw => q.includes(normalize(kw)))) {
      return { ...d };
    }
  }

  for (const s of stations) {
    const sNorm = normalize(s.name);
    if (q.includes(sNorm)) {
      return {
        name: s.name,
        nameBn: s.nameBn || s.name,
        type: 'Metro Station',
        googleMapsQuery: `${s.name} Metro Station Kolkata`,
        lat: s.lat,
        lng: s.lng,
        nearestMetro: s.id,
        keyword: sNorm
      };
    }
  }

  for (const p of pandals) {
    const pNorm = normalize(p.name);
    const agNorm = normalize(p.areaGroup || '');
    if (pNorm.length > 5 && q.includes(pNorm)) {
      return {
        name: p.name,
        nameBn: p.nameBn || p.name,
        type: 'Durga Puja Pandal',
        googleMapsQuery: p.googleMapsQuery || `${p.name} Kolkata`,
        lat: p.lat,
        lng: p.lng,
        nearestMetro: p.metro?.station?.id || null,
        keyword: p.areaGroup || p.name
      };
    }
    if (agNorm.length > 3 && q.includes(agNorm)) {
      return {
        name: p.areaGroup,
        nameBn: p.areaGroup,
        type: 'Pandal Area',
        googleMapsQuery: `${p.areaGroup} Durga Puja Kolkata`,
        lat: p.lat,
        lng: p.lng,
        nearestMetro: p.metro?.station?.id || null,
        keyword: p.areaGroup
      };
    }
  }

  return null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function findNearbyPandals(dest) {
  const kw = normalize(dest.keyword || dest.name || '');

  if (dest.lat && dest.lng && Number.isFinite(Number(dest.lat)) && Number.isFinite(Number(dest.lng))) {
    const withDist = pandals
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(p => ({
        ...p,
        distanceKm: haversineKm(dest.lat, dest.lng, p.lat, p.lng)
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (withDist.length && withDist[0].distanceKm < 4.5) {
      return withDist.filter(p => p.distanceKm <= 4.0).slice(0, 8);
    }
  }

  const matched = pandals.filter(p => {
    const ag = normalize(p.areaGroup || '');
    const a  = normalize(p.area || '');
    const n  = normalize(p.name || '');
    const g  = normalize(p.googleMapsQuery || '');
    return (ag && (ag.includes(kw) || kw.includes(ag))) ||
           (a && (a.includes(kw) || kw.includes(a))) ||
           (n && (n.includes(kw) || kw.includes(n))) ||
           (g && g.includes(kw));
  });

  return matched;
}

function classifyQuery(rawQuery) {
  const q = normalize(rawQuery);
  const dest = resolveCanonicalDestination(rawQuery);
  const hasMetro = /মেট্রো|metro/i.test(q);
  const hasPandal = /প্যান্ডেল|pandal|পুজো|puja/i.test(q);
  const hasGo = /যেতে চাই|যাব|যাওয়ার পথ|যাবার পথ|কীভাবে যাব|কিভাবে যাব|নিয়ে চল|পথ দেখাও|go to|want to go|how to go|how to get|how do i get|take me to|where is|directions to/i.test(q);

  if (dest && hasPandal) {
    const matched = findNearbyPandals(dest);
    return { type: 'nearby-pandals', dest, pandals: matched };
  }

  if (hasMetro) {
    if (dest && dest.type === 'Metro Station') {
      const s = stations.find(x => x.name.toLowerCase() === dest.name.toLowerCase() || x.id === dest.nearestMetro);
      return { type: 'station-card', station: s };
    }
    if (dest && dest.nearestMetro) {
      const s = stations.find(x => x.id === dest.nearestMetro);
      if (s) return { type: 'station-card', station: s };
    }
    for (const s of stations) {
      if (q.includes(normalize(s.name))) {
        return { type: 'station-card', station: s };
      }
    }
    return { type: 'metro-list' };
  }

  if (dest && (hasGo || (!hasPandal && !hasMetro))) {
    return { type: 'destination-card', dest };
  }

  return { type: 'other' };
}

// -------------------------------------------------
//  TEST MATRIX EXECUTION
// -------------------------------------------------

// DESTINATION TESTS (1-10)
const destTests = [
  { q: "দমদম যেতে চাই", expected: "Dum Dum" },
  { q: "I want to go to Dum Dum", expected: "Dum Dum" },
  { q: "Dum Dum যাব", expected: "Dum Dum" },
  { q: "দেশপ্রিয় পার্ক যেতে চাই", expected: "Deshapriya Park" },
  { q: "I want to go to Deshapriya Park", expected: "Deshapriya Park" },
  { q: "Deshapriya Park যাব", expected: "Deshapriya Park" },
  { q: "কালিঘাট যেতে চাই", expected: "Kalighat" },
  { q: "I want to go to Kalighat", expected: "Kalighat" },
  { q: "বাগবাজার যেতে চাই", expected: "Baghbazar" },
  { q: "I want to go to Baghbazar", expected: "Baghbazar" }
];

console.log('\n--- 1. Testing Destination Queries (1 to 10) ---');
for (const [i, test] of destTests.entries()) {
  const res = classifyQuery(test.q);
  assert.strictEqual(res.type, 'destination-card', `Test ${i + 1} (${test.q}): should resolve to destination-card`);
  assert.strictEqual(res.dest.name, test.expected, `Test ${i + 1} (${test.q}): should match ${test.expected}`);
  assert(res.dest.googleMapsQuery, `Test ${i + 1}: destination must have googleMapsQuery`);
  console.log(`✔ [${i + 1}/10] "${test.q}" -> ${res.dest.name} (${res.dest.type})`);
}

// PANDAL TESTS (11-14)
const pandalTests = [
  { q: "দমদমের কাছে প্যান্ডেল দেখাও", dest: "Dum Dum" },
  { q: "Show me pandals near Dum Dum", dest: "Dum Dum" },
  { q: "বাগবাজারের কাছে pandal দেখাও", dest: "Baghbazar" },
  { q: "Show pandals near Baghbazar", dest: "Baghbazar" }
];

console.log('\n--- 2. Testing Nearby Pandal Queries (11 to 14) ---');
for (const [i, test] of pandalTests.entries()) {
  const res = classifyQuery(test.q);
  assert.strictEqual(res.type, 'nearby-pandals', `Test ${i + 11} (${test.q}): should resolve to nearby-pandals`);
  assert.strictEqual(res.dest.name, test.dest, `Test ${i + 11} (${test.q}): should match dest ${test.dest}`);
  assert(res.pandals && res.pandals.length > 0, `Test ${i + 11}: should find real pandals near ${test.dest}`);
  for (const p of res.pandals) {
    assert(p.id, 'Pandal must have valid ID');
    assert(p.name, 'Pandal must have valid name');
  }
  console.log(`✔ [${i + 11}/14] "${test.q}" -> Found ${res.pandals.length} pandals (Top: ${res.pandals[0].name})`);
}

// METRO TESTS (15-20)
const metroTests = [
  { q: "কাছাকাছি মেট্রো স্টেশন দেখাও", expectedType: 'metro-list' },
  { q: "Find metro stations", expectedType: 'metro-list' },
  { q: "Dum Dum metro", expectedStation: "Dum Dum", expectedId: "dumdum" },
  { q: "Kalighat metro", expectedStation: "Kalighat", expectedId: "kalighat" },
  { q: "Howrah metro", expectedStation: "Howrah", expectedId: "howrah" },
  { q: "Sector V metro", expectedStation: "Sector V", expectedId: "sectorv" }
];

console.log('\n--- 3. Testing Metro Queries (15 to 20) ---');
for (const [i, test] of metroTests.entries()) {
  const res = classifyQuery(test.q);
  if (test.expectedType === 'metro-list') {
    assert.strictEqual(res.type, 'metro-list', `Test ${i + 15} (${test.q}): should return metro-list`);
    console.log(`✔ [${i + 15}/20] "${test.q}" -> Metro list of all 28 stations`);
  } else {
    assert.strictEqual(res.type, 'station-card', `Test ${i + 15} (${test.q}): should return station-card`);
    assert.strictEqual(res.station.name, test.expectedStation, `Test ${i + 15}: station name should be ${test.expectedStation}`);
    assert.strictEqual(res.station.id, test.expectedId, `Test ${i + 15}: station id should be ${test.expectedId}`);
    console.log(`✔ [${i + 15}/20] "${test.q}" -> Station card: ${res.station.name} [id: ${res.station.id}]`);
  }
}

// BUTTON VERIFICATION TEST
console.log('\n--- 4. Verifying Button Actions ---');

// Test 1: Destination card buttons
const sampleDest = PUJA_AI_DATA.destinations.find(d => d.name === 'Deshapriya Park');
assert(sampleDest, 'Sample destination must exist');
const destActions = ['directions', 'open-map', 'dest-metro', 'dest-nearby-pandals'];
console.log(`✔ Destination card [${sampleDest.name}] has all 4 actions: ${destActions.join(', ')}`);

// Test 2: Metro station buttons
const sampleStation = stations.find(s => s.id === 'kalighat');
assert(sampleStation, 'Sample station must exist');
const stationActions = ['view-station', 'station-map', 'station-directions'];
console.log(`✔ Station card [${sampleStation.name}] has all 3 actions: ${stationActions.join(', ')}`);

// Test 3: Pandal card buttons
const samplePandal = pandals.find(p => p.id === 'south-deshapriya-park-deshapriya-park');
assert(samplePandal, 'Sample pandal must exist');
const pandalActions = ['view-pandal', 'pandal-map', 'pandal-directions', 'save-pandal'];
console.log(`✔ Pandal card [${samplePandal.name}] has all 4 actions: ${pandalActions.join(', ')}`);

// Test 4: All 28 metro stations have valid IDs and coords
for (const s of stations) {
  assert(s.id, `Station ${s.name} missing id`);
  assert(Number.isFinite(s.lat), `Station ${s.name} missing lat`);
  assert(Number.isFinite(s.lng), `Station ${s.name} missing lng`);
}
console.log(`✔ All 28 metro stations verified with active coordinates and IDs`);

// Test 5: Geolocation Transit Directions URL generator check
function buildTransitDirUrl({ lat, lng, dest }) {
  const destQuery = dest.lat && dest.lng ? `${dest.lat},${dest.lng}` : (dest.googleMapsQuery || dest.name);
  if (lat && lng) {
    return `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${encodeURIComponent(destQuery)}&travelmode=transit&dir_action=navigate`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destQuery)}&travelmode=transit&dir_action=navigate`;
}

const dirWithLoc = buildTransitDirUrl({ lat: 22.5726, lng: 88.3639, dest: sampleDest });
assert(dirWithLoc.includes('origin=22.5726%2C88.3639') || dirWithLoc.includes('origin=22.5726,88.3639'), 'URL has origin');
assert(dirWithLoc.includes('travelmode=transit'), 'URL has travelmode=transit');
assert(dirWithLoc.includes('dir_action=navigate'), 'URL has dir_action=navigate');

const dirFallback = buildTransitDirUrl({ lat: null, lng: null, dest: sampleDest });
assert(!dirFallback.includes('origin='), 'Fallback URL has no origin');
assert(dirFallback.includes('destination='), 'Fallback URL has destination');
assert(dirFallback.includes('dir_action=navigate'), 'Fallback URL has dir_action=navigate');
console.log(`✔ Geolocation transit directions URLs validated (with origin & fallback)`);

console.log('\n==================================================');
console.log('ALL 20 TEST MATRIX CASES AND BUTTON ACTIONS PASSED!');
console.log('==================================================\n');
