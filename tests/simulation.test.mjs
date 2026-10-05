import assert from 'node:assert';
import fs from 'node:fs';

// Verify all files exist and syntax is valid
const pandals = JSON.parse(fs.readFileSync('data/pandals.json', 'utf8'));
const metro = JSON.parse(fs.readFileSync('data/metro.json', 'utf8'));

// Test Dum Dum pandal filter
const dumDumPandals = pandals.filter(p =>
  (p.areaGroup || '').toLowerCase().includes('dum dum') ||
  (p.area || '').toLowerCase().includes('dum dum') ||
  (p.name || '').toLowerCase().includes('dum dum') ||
  (p.googleMapsQuery || '').toLowerCase().includes('dum dum')
);
console.log('Dum Dum pandals found:', dumDumPandals.length);
assert(dumDumPandals.length > 0, 'Should find pandals near Dum Dum');

// Test Baghbazar pandals
const baghbazarPandals = pandals.filter(p =>
  (p.areaGroup || '').toLowerCase().includes('baghbazar') ||
  (p.name || '').toLowerCase().includes('baghbazar')
);
console.log('Baghbazar pandals found:', baghbazarPandals.length);
assert(baghbazarPandals.length > 0, 'Should find Baghbazar pandal');

// Test Kumartuli pandals
const kumartuliPandals = pandals.filter(p =>
  (p.areaGroup || '').toLowerCase().includes('kumartuli') ||
  (p.name || '').toLowerCase().includes('kumartuli')
);
console.log('Kumartuli pandals found:', kumartuliPandals.length);
assert(kumartuliPandals.length > 0, 'Should find Kumartuli pandal');

// Test Deshapriya Park pandal
const deshapriyaPandals = pandals.filter(p =>
  (p.areaGroup || '').toLowerCase().includes('deshapriya') ||
  (p.name || '').toLowerCase().includes('deshapriya')
);
console.log('Deshapriya pandals found:', deshapriyaPandals.length);
assert(deshapriyaPandals.length > 0, 'Should find Deshapriya pandal');

// Test Dum Dum metro station
const dumdumStation = metro.stations.find(s => s.name.toLowerCase() === 'dum dum');
console.log('Dum Dum metro station found:', dumdumStation?.name, 'lines:', dumdumStation?.lines);
assert(dumdumStation, 'Should find Dum Dum station');

// Test Featured pandals count
const featured = pandals.filter(p => p.featured);
console.log('Featured pandals:', featured.map(p => p.name));
assert.strictEqual(featured.length, 8, 'Should have exactly 8 featured pandals');

console.log('\nAll dataset & query simulations passed successfully!');
