const API_BASE =
  'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions';

async function analyzeNewDuplicate() {
  console.log('Analyzing new duplicate annotation...');

  const newAnnotation = {
    id: 'bdfb2bb2-d4f7-4128-80be-049409b4307e',
    created: '2025-08-25T08:35:27.093Z',
    targets: [
      'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/b0955cbe-ae51-448e-91f4-a5417f5688ec',
      'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/270d897d-6c4e-4a4d-8c44-7c23730e13ff',
    ],
    pointSelector: { x: 3931, y: 4602 },
  };

  try {
    // Get all annotations from the collection
    const response = await fetch(`${API_BASE}/`);
    const collection = await response.json();

    console.log(`Total annotations in collection: ${collection.items.length}`);

    // Find all linking annotations with same targets
    const sameTargets = collection.items.filter((item) => {
      if (item.motivation !== 'linking') return false;
      if (!Array.isArray(item.target) || item.target.length !== 2) return false;

      const targetSet1 = new Set(newAnnotation.targets);
      const targetSet2 = new Set(item.target);

      return (
        targetSet1.size === targetSet2.size &&
        [...targetSet1].every((target) => targetSet2.has(target))
      );
    });

    console.log(`\nFound ${sameTargets.length} annotations with same targets:`);

    sameTargets.forEach((annotation) => {
      console.log(`- ${annotation.id}`);
      console.log(`  Created: ${annotation.created}`);
      console.log(
        `  Target order: [${annotation.target
          .map((t) => t.split('/').pop())
          .join(', ')}]`,
      );

      // Check for PointSelector
      if (
        annotation.body &&
        annotation.body[0] &&
        annotation.body[0].selector
      ) {
        const selector = annotation.body[0].selector;
        if (selector.type === 'PointSelector') {
          console.log(`  PointSelector: (${selector.x}, ${selector.y})`);

          // Check if coordinates match
          if (
            selector.x === newAnnotation.pointSelector.x &&
            selector.y === newAnnotation.pointSelector.y
          ) {
            console.log(`  EXACT COORDINATE MATCH!`);
          }
        }
      }

      // Calculate time difference
      const annotationTime = new Date(annotation.created);
      const newTime = new Date(newAnnotation.created);
      const timeDiff = Math.abs(newTime - annotationTime) / (1000 * 60 * 60); // hours
      console.log(`  Time difference: ${timeDiff.toFixed(1)} hours`);
      console.log('');
    });

    // Show the most recent duplicates
    const recentDuplicates = sameTargets
      .filter((item) => item.id !== newAnnotation.id)
      .sort((a, b) => new Date(b.created) - new Date(a.created))
      .slice(0, 3);

    console.log('\nMost recent potential duplicates:');
    recentDuplicates.forEach((dup, index) => {
      console.log(`${index + 1}. ${dup.id} (${dup.created})`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeNewDuplicate();
