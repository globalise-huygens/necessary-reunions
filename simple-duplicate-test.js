// Test duplicate detection by creating two similar annotations
console.log('Testing duplicate detection...');

// First, create a linking annotation
const testAnnotation1 = {
  target: [
    'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/test-1',
    'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/test-2',
  ],
  body: [
    {
      type: 'TextualBody',
      value: 'Test annotation',
      format: 'text/plain',
      purpose: 'commenting',
    },
    {
      purpose: 'selecting',
      selector: {
        type: 'PointSelector',
        x: 1000,
        y: 2000,
      },
    },
  ],
  motivation: 'linking',
};

// Second annotation with same targets and same PointSelector (should be detected as duplicate)
const testAnnotation2 = {
  target: [
    'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/test-1',
    'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/test-2',
  ],
  body: [
    {
      type: 'TextualBody',
      value: 'Another test annotation',
      format: 'text/plain',
      purpose: 'commenting',
    },
    {
      purpose: 'selecting',
      selector: {
        type: 'PointSelector',
        x: 1000,
        y: 2000,
      },
    },
  ],
  motivation: 'linking',
};

async function testDuplicateDetection() {
  try {
    console.log('Creating first annotation...');
    const response1 = await fetch(
      'http://localhost:3001/api/annotations/linking',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testAnnotation1),
      },
    );

    const result1 = await response1.json();
    console.log(
      'First annotation result:',
      response1.status,
      result1.id || result1.error,
    );

    if (response1.ok) {
      console.log('Creating duplicate annotation...');
      const response2 = await fetch(
        'http://localhost:3001/api/annotations/linking',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testAnnotation2),
        },
      );

      const result2 = await response2.json();
      console.log(
        'Second annotation result:',
        response2.status,
        result2.id || result2.error,
      );

      if (response1.ok && response2.ok) {
        if (result1.id === result2.id) {
          console.log(
            'SUCCESS: Duplicate was consolidated into same annotation',
          );
        } else {
          console.log(
            'PROBLEM: Two different IDs created - duplicate not detected',
          );
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDuplicateDetection();
