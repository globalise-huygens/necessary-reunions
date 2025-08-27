// Test script to validate orphaned targets with your specific examples
async function testBrokenTarget() {
  // The broken target you mentioned
  const brokenTargetUrl =
    'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/e7ab0abc-91f8-4b77-9451-73111b369838';

  console.log(`Testing broken target URL: ${brokenTargetUrl}`);

  try {
    const response = await fetch(brokenTargetUrl, {
      method: 'HEAD',
      headers: {
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });

    console.log(`Response status: ${response.status} ${response.statusText}`);
    console.log(`Response ok: ${response.ok}`);

    if (!response.ok) {
      console.log(
        '🚨 ORPHANED TARGET DETECTED! This should be caught by the system.',
      );
    } else {
      console.log('✅ Target exists and is valid.');
    }
  } catch (error) {
    console.log(`❌ Network error: ${error.message}`);
    console.log('🚨 This should also be caught as orphaned target.');
  }
}

// Test your specific linking annotations
async function testYourLinkingAnnotations() {
  const linkingAnnotations = [
    'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/56d73ffb-c02d-4322-b748-b00fe09bade1',
    'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/cd11c590-e0a4-4a2a-b681-edbb75c9f476',
    'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/32180718-6c70-4f5b-a79e-7ed9c435bba4',
  ];

  for (const annotationUrl of linkingAnnotations) {
    console.log(`\n🔍 Testing linking annotation: ${annotationUrl}`);

    try {
      const response = await fetch(annotationUrl, {
        headers: {
          Accept:
            'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
        },
      });

      if (response.ok) {
        const annotation = await response.json();
        console.log(`Motivation: ${annotation.motivation}`);
        console.log('Targets:', annotation.target);

        // Test each target
        if (annotation.target) {
          const targets = Array.isArray(annotation.target)
            ? annotation.target
            : [annotation.target];
          for (const target of targets) {
            const targetUrl =
              typeof target === 'string' ? target : target.id || target.source;
            if (targetUrl) {
              console.log(`  🎯 Testing target: ${targetUrl}`);
              try {
                const targetResponse = await fetch(targetUrl, {
                  method: 'HEAD',
                });
                console.log(
                  `     Status: ${targetResponse.status} ${targetResponse.statusText}`,
                );
                if (!targetResponse.ok) {
                  console.log('     🚨 BROKEN TARGET FOUND!');
                }
              } catch (error) {
                console.log(`     ❌ Network error: ${error.message}`);
              }
            }
          }
        }
      } else {
        console.log(`Could not fetch annotation: ${response.status}`);
      }
    } catch (error) {
      console.log(`Error fetching annotation: ${error.message}`);
    }
  }
}

// Run tests
console.log('='.repeat(60));
console.log('TESTING ORPHANED TARGET DETECTION');
console.log('='.repeat(60));

testBrokenTarget()
  .then(() => testYourLinkingAnnotations())
  .then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('TESTING COMPLETE');
    console.log('='.repeat(60));
  });
