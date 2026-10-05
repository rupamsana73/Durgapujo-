import assert from 'node:assert';
import fs from 'node:fs';
import { PUJA_AI_DATA } from '../Puja_ai/puja-ai-data.js';

console.log('Testing PUJA_AI_DATA structure...');

// 1. Verify 6 quick actions
assert.strictEqual(PUJA_AI_DATA.quickActions.length, 6, 'Should have 6 quick actions');
const qaIds = PUJA_AI_DATA.quickActions.map(q => q.id);
assert(qaIds.includes('puja-guide'), 'Must have puja-guide');
assert(qaIds.includes('find-pandal'), 'Must have find-pandal');
assert(qaIds.includes('find-metro'), 'Must have find-metro');
assert(qaIds.includes('go-somewhere'), 'Must have go-somewhere');
assert(qaIds.includes('puja-plan'), 'Must have puja-plan');
assert(qaIds.includes('popular-pandals'), 'Must have popular-pandals');
console.log('✔ Quick actions test passed (6/6)');

// 2. Verify guide traditions
const guideSecIds = PUJA_AI_DATA.guide.sections.map(s => s.id);
const requiredTraditions = [
  'mahalaya', 'shasthi', 'saptami', 'ashtami', 'navami',
  'dashami', 'sindoor-khela', 'bijoya', 'planning', 'metro',
  'crowd', 'safety', 'family-planning', 'night-hopping', 'maps'
];
for (const req of requiredTraditions) {
  assert(guideSecIds.includes(req), `Guide missing section: ${req}`);
}
console.log('✔ Guide sections test passed (' + requiredTraditions.length + '/' + requiredTraditions.length + ')');

// 3. Verify destinations
const destNames = PUJA_AI_DATA.destinations.map(d => d.name);
assert(destNames.includes('Dum Dum'), 'Must include Dum Dum');
assert(destNames.includes('Dakshineswar'), 'Must include Dakshineswar');
assert(destNames.includes('Deshapriya Park'), 'Must include Deshapriya Park');
assert(destNames.includes('Baghbazar'), 'Must include Baghbazar');
assert(destNames.includes('Kumartuli'), 'Must include Kumartuli');

for (const d of PUJA_AI_DATA.destinations) {
  assert(d.googleMapsQuery, `Destination ${d.name} missing googleMapsQuery`);
  assert(d.nameBn, `Destination ${d.name} missing nameBn`);
}
console.log('✔ Destinations test passed');

// 4. Verify canonical data
const pandals = JSON.parse(fs.readFileSync('data/pandals.json', 'utf8'));
const metro = JSON.parse(fs.readFileSync('data/metro.json', 'utf8'));
assert.strictEqual(pandals.length, 123, 'Canonical 123 pandals intact');
assert.strictEqual(metro.stations.length, 28, 'Canonical 28 metro stations intact');
const featured = pandals.filter(p => p.featured);
assert.strictEqual(featured.length, 8, '8 featured pandals intact');
console.log('✔ Canonical datasets intact (123 pandals, 28 stations, 8 featured)');

// 5. Verify HTML files have Puja AI tags
const pages = [
  'index.html',
  'pages/explore.html',
  'pages/map.html',
  'pages/metro.html',
  'pages/metro-station.html',
  'pages/pandal.html',
  'pages/planner.html',
  'pages/favourites.html',
  'pages/guide.html'
];
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  assert(html.includes('puja-ai.css'), `${page} missing puja-ai.css`);
  assert(html.includes('puja-ai.js'), `${page} missing puja-ai.js`);
}
console.log('✔ All 9 HTML pages contain Puja AI scripts and stylesheets');

// 6. Verify no API keys in frontend files
const checkFiles = [
  'index.html',
  'Puja_ai/puja-ai.js',
  'Puja_ai/puja-ai-data.js',
  'Puja_ai/puja-ai.css',
  'js/app.js',
  'js/main.js'
];
for (const f of checkFiles) {
  const content = fs.readFileSync(f, 'utf8');
  assert(!content.includes('sk-or-v1-'), `API key leak detected in ${f}`);
  assert(!/const\s+API_KEY\s*=\s*['"]/.test(content), `Hardcoded API_KEY detected in ${f}`);
}
console.log('✔ Security check passed: No API keys exposed in frontend source files');

console.log('\nALL PUJA AI UNIT CHECKS PASSED SUCCESSFULLY!');
