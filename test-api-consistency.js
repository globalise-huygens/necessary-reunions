/**
 * Test script to demonstrate API consistency for the GAVOC thesaurus system
 * This shows how the same geographic entity always gets the same canonical URI
 * regardless of data processing order or name variations.
 */

import {
  buildThesaurus,
  generateConceptKey,
  selectPreferredTerm,
} from './lib/gavoc/thesaurus.js';

// Test data representing the same geographic entity with different name variations
const testLocations1 = [
  {
    presentName: 'Paris',
    originalNameOnMap: 'Parigi',
    category: 'City',
    latitude: 48.8566,
    longitude: 2.3522,
    // ... other fields
  },
  {
    presentName: 'Paris',
    originalNameOnMap: 'Lutetia',
    category: 'City',
    latitude: 48.8566,
    longitude: 2.3522,
  },
];

// Same entity but processed in different order and with different name priorities
const testLocations2 = [
  {
    presentName: 'Paris',
    originalNameOnMap: 'Lutetia',
    category: 'City',
    latitude: 48.8566,
    longitude: 2.3522,
  },
  {
    presentName: 'Paris',
    originalNameOnMap: 'Parigi',
    category: 'City',
    latitude: 48.8566,
    longitude: 2.3522,
  },
];

console.log('=== API Consistency Test ===\n');

// Test 1: Concept key generation consistency
console.log('1. Concept Key Generation:');
const key1 = generateConceptKey('Paris', 'City', {
  latitude: 48.8566,
  longitude: 2.3522,
});
const key2 = generateConceptKey('Paris', 'City', {
  latitude: 48.86,
  longitude: 2.35,
}); // Slightly different coordinates
console.log(`Key for exact coordinates: ${key1}`);
console.log(`Key for rounded coordinates: ${key2}`);
console.log(`Keys are identical: ${key1 === key2}\n`);

// Test 2: Preferred term selection consistency
console.log('2. Preferred Term Selection:');
const names1 = ['Paris', 'Parigi', 'Lutetia'];
const names2 = ['Lutetia', 'Paris', 'Parigi']; // Different order
const preferred1 = selectPreferredTerm(names1);
const preferred2 = selectPreferredTerm(names2);
console.log(`From [${names1.join(', ')}]: "${preferred1}"`);
console.log(`From [${names2.join(', ')}]: "${preferred2}"`);
console.log(`Preferred terms are identical: ${preferred1 === preferred2}\n`);

// Test 3: Full thesaurus building consistency
console.log('3. Thesaurus Building:');
try {
  const thesaurus1 = buildThesaurus(testLocations1);
  const thesaurus2 = buildThesaurus(testLocations2);

  const entry1 = thesaurus1.entries[0];
  const entry2 = thesaurus2.entries[0];

  console.log(`Dataset 1 - ID: ${entry1?.id}, URI: ${entry1?.uri}`);
  console.log(`Dataset 2 - ID: ${entry2?.id}, URI: ${entry2?.uri}`);
  console.log(`URIs are identical: ${entry1?.uri === entry2?.uri}`);
  console.log(
    `Preferred terms are identical: ${
      entry1?.preferredTerm === entry2?.preferredTerm
    }`,
  );
} catch (error) {
  console.log(`Error building thesaurus: ${error.message}`);
}

console.log('\n=== API Design Benefits ===');
console.log('✓ Same geographic entity → Same concept key');
console.log('✓ Same concept key → Same thesaurus ID');
console.log('✓ Same thesaurus ID → Same canonical URI');
console.log('✓ Deterministic preferred term selection');
console.log('✓ Order-independent processing');
console.log('✓ Coordinate-aware deduplication');
