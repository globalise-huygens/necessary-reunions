// Debug script to test Base64 encoding of canvas URIs
const { Buffer } = require('buffer');

// Test canvas URI from the manifest
const testCanvasUri = "https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1";

console.log("Original URI:", testCanvasUri);

// Test the encoding function (both browser and Node.js versions)
function encodeCanvasUri(uri) {
  return typeof window !== 'undefined'
    ? btoa(uri)
    : Buffer.from(uri).toString('base64');
}

const encoded = encodeCanvasUri(testCanvasUri);
console.log("Base64 encoded:", encoded);

// Test decoding to verify
const decoded = Buffer.from(encoded, 'base64').toString('utf8');
console.log("Decoded back:", decoded);
console.log("Roundtrip match:", decoded === testCanvasUri);

// Test API URL construction
const ANNOREPO_BASE_URL = 'https://anno.nl';
const CONTAINER = 'globalise-huygens';
const QUERY_NAME = 'find-annotations-target';

const endpoint = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/${QUERY_NAME}:target=${encoded}`;
console.log("API endpoint:", endpoint);

// Check for problematic characters in the encoded string
console.log("Encoded length:", encoded.length);
console.log("Contains +:", encoded.includes('+'));
console.log("Contains /:", encoded.includes('/'));
console.log("Contains =:", encoded.includes('='));
