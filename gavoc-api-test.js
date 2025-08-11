// GAVOC API Test Script
// This demonstrates the comprehensive API structure for accessing GAVOC concepts

const API_BASE = 'http://localhost:3001/api/gavoc';

console.log('🚀 GAVOC Thesaurus API - Comprehensive Test Suite');
console.log('==================================================\n');

// Test functions
const testEndpoints = async () => {
  console.log('📋 Available API Endpoints:');
  console.log('');

  // 1. API Documentation
  console.log('1️⃣ API Documentation:');
  console.log(`   GET ${API_BASE}`);
  console.log('   → Complete API documentation and examples\n');

  // 2. List Concepts
  console.log('2️⃣ List All Concepts:');
  console.log(`   GET ${API_BASE}/concepts`);
  console.log('   → Paginated list of all geographic concepts');
  console.log(
    '   Parameters: category, search, coordinates, limit, offset, format\n',
  );

  // 3. Get Specific Concept
  console.log('3️⃣ Get Specific Concept:');
  console.log(`   GET ${API_BASE}/concepts/{identifier}`);
  console.log('   → Detailed info about a specific concept');
  console.log('   Example: /concepts/batavia or /concepts/amsterdam\n');

  // 4. Search Concepts
  console.log('4️⃣ Advanced Search:');
  console.log(`   GET ${API_BASE}/search`);
  console.log('   → Search with relevance scoring and geographic filters');
  console.log(
    '   Parameters: q (required), category, coordinates, bbox, sort, limit, offset\n',
  );

  // 5. List Categories
  console.log('5️⃣ Geographic Categories:');
  console.log(`   GET ${API_BASE}/categories`);
  console.log('   → All available geographic categories with statistics');
  console.log('   Parameters: stats (optional)\n');

  // 6. System Statistics
  console.log('6️⃣ System Statistics:');
  console.log(`   GET ${API_BASE}/stats`);
  console.log('   → Comprehensive statistics about the thesaurus\n');

  console.log('🎯 Example API Calls:');
  console.log('');

  // Example queries
  const examples = [
    {
      title: 'Search for Amsterdam',
      url: `${API_BASE}/search?q=amsterdam&limit=5`,
      description: 'Find all concepts related to Amsterdam',
    },
    {
      title: 'Get Island Categories',
      url: `${API_BASE}/concepts?category=eiland/island&coordinates=true&limit=10`,
      description: 'List islands with coordinates',
    },
    {
      title: 'Geographic Search in Indonesia',
      url: `${API_BASE}/search?q=fort&bbox=95,-11,141,6&limit=20`,
      description: 'Find forts within Indonesian archipelago bounds',
    },
    {
      title: 'Category Statistics',
      url: `${API_BASE}/categories?stats=true`,
      description: 'Get detailed statistics for each category',
    },
    {
      title: 'Export as CSV',
      url: `${API_BASE}/concepts?format=csv&limit=100`,
      description: 'Export first 100 concepts as CSV',
    },
  ];

  examples.forEach((example, index) => {
    console.log(`${index + 1}. ${example.title}:`);
    console.log(`   ${example.url}`);
    console.log(`   → ${example.description}\n`);
  });

  console.log('✨ Key Features:');
  console.log('• 🎯 Canonical URI consistency - same place = same URI');
  console.log('• 🔍 Advanced search with relevance scoring');
  console.log('• 🗺️ Geographic bounding box filtering');
  console.log('• 📊 Comprehensive statistics and analytics');
  console.log('• 📁 Multiple export formats (JSON, CSV)');
  console.log('• 🚀 Fast response times with intelligent caching');
  console.log('• 🌐 CORS-enabled for cross-domain access');
  console.log('• 📖 Self-documenting with complete API docs');
  console.log('');

  console.log('🛠️ Integration Examples:');
  console.log('');
  console.log('JavaScript/Fetch:');
  console.log('```javascript');
  console.log(`fetch('${API_BASE}/search?q=batavia')`);
  console.log('  .then(response => response.json())');
  console.log('  .then(data => console.log(data.results));');
  console.log('```');
  console.log('');

  console.log('Python/Requests:');
  console.log('```python');
  console.log('import requests');
  console.log(
    `response = requests.get('${API_BASE}/concepts?category=plaats/settlement')`,
  );
  console.log('concepts = response.json()["concepts"]');
  console.log('```');
  console.log('');

  console.log('cURL:');
  console.log('```bash');
  console.log(`curl "${API_BASE}/stats" | jq '.overview'`);
  console.log('```');
  console.log('');

  console.log('🎓 Use Cases:');
  console.log('• Academic research and citations');
  console.log('• Mobile app development');
  console.log('• Data visualization projects');
  console.log('• Historical mapping applications');
  console.log('• Cross-reference with other datasets');
  console.log('• Educational tools and resources');
  console.log('');

  console.log('🧪 Test the API now:');
  console.log('1. Open your browser or API client');
  console.log(`2. Try: ${API_BASE}`);
  console.log('3. Explore the endpoints listed above');
  console.log('4. Check the clean, simple URIs in action!');
};

// Auto-run the test
testEndpoints();
