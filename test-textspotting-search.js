// Test script to debug textspotting annotation search

async function testTextspottingSearch() {
  const baseUrl = 'https://annorepo.globalise.huygens.knaw.nl';
  const container = 'necessary-reunions';

  console.log(
    'Testing different search approaches for textspotting annotations...\n',
  );

  // Test 1: Try the original search endpoint
  console.log('1. Testing original search endpoint...');
  try {
    const endpoint = `${baseUrl}/services/${container}/search?motivation=textspotting&page=0`;
    console.log(`Endpoint: ${endpoint}`);
    const response = await fetch(endpoint);
    console.log(`Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`Found ${data.items ? data.items.length : 0} items`);
    } else {
      const text = await response.text();
      console.log(`Error: ${text}`);
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  console.log('\n2. Testing annotations endpoint...');
  try {
    const endpoint = `${baseUrl}/services/${container}/annotations?page=0`;
    console.log(`Endpoint: ${endpoint}`);
    const response = await fetch(endpoint, {
      headers: {
        Accept:
          'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      },
    });
    console.log(`Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`Response structure:`, Object.keys(data));
      const items = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];
      console.log(`Total items: ${items.length}`);

      const textspottingItems = items.filter(
        (item) =>
          item.motivation === 'textspotting' ||
          (Array.isArray(item.motivation) &&
            item.motivation.includes('textspotting')),
      );
      console.log(`Textspotting items: ${textspottingItems.length}`);

      // Show first few motivations to debug
      const motivations = items.slice(0, 10).map((item) => item.motivation);
      console.log(`First 10 motivations:`, motivations);
    } else {
      const text = await response.text();
      console.log(`Error: ${text}`);
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }

  console.log('\n3. Testing container info...');
  try {
    const endpoint = `${baseUrl}/services/${container}`;
    console.log(`Endpoint: ${endpoint}`);
    const response = await fetch(endpoint);
    console.log(`Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`Container info:`, JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
}

testTextspottingSearch().catch(console.error);
