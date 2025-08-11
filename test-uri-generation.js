// Test script to see how URIs are generated
import {
  generateLocationPath,
  generateLocationUri,
  generateSlug,
} from '../lib/gavoc/data-processing.js';

const testLocations = [
  {
    id: 'gavoc-1',
    indexPage: '1',
    originalNameOnMap: 'Aajer Gila',
    presentName: '-',
    category: 'rivier/river',
    coordinates: '-',
  },
  {
    id: 'gavoc-2',
    indexPage: '2',
    originalNameOnMap: 'Aandomaon, Ilha de',
    presentName: 'Andamanen/Andaman Islands',
    category: 'eilanden/islands',
    coordinates: '12-30N/92-50E',
  },
  {
    id: 'gavoc-3',
    indexPage: '3',
    originalNameOnMap: 'Aapjesberg',
    presentName: 'Apenberg/Bukit Monyet',
    category: 'berg/mountain',
    coordinates: '00-58S/100-20E',
  },
];

console.log('Sample URI Generation:');
console.log('=====================');

testLocations.forEach((location) => {
  console.log(`\nLocation: ${location.originalNameOnMap}`);
  console.log(`Present: ${location.presentName}`);
  console.log(
    `Slug: "${generateSlug(
      location.presentName !== '-'
        ? location.presentName
        : location.originalNameOnMap,
    )}"`,
  );
  console.log(`URI: ${generateLocationUri(location)}`);
  console.log(`Path: ${generateLocationPath(location)}`);
});
