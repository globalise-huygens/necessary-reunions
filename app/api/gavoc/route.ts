import { NextResponse } from 'next/server';

export async function GET() {
  const apiDocumentation = {
    name: 'Grote Atlas Thesaurus API',
    version: '1.0',
    description:
      'API for accessing the Grote Atlas geographic concepts and historical location data',
    baseUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    endpoints: {
      '/api/gavoc/concepts': {
        method: 'GET',
        description:
          'List all geographic concepts with pagination and filtering',
        parameters: {
          category: 'Filter by geographic category (optional)',
          search: 'Search terms to filter concepts (optional)',
          coordinates:
            'Set to "true" to only return concepts with coordinates (optional)',
          limit: 'Number of results per page (default: 100, max: 1000)',
          offset: 'Number of results to skip for pagination (default: 0)',
          format: 'Response format: "json" or "csv" (default: json)',
        },
        example:
          '/api/gavoc/concepts?category=plaats/settlement&limit=50&coordinates=true',
      },
      '/api/gavoc/concepts/{identifier}': {
        method: 'GET',
        description:
          'Get detailed information about a specific concept by ID or slug',
        parameters: {
          identifier: 'Concept ID, slug, or preferred term',
        },
        example: '/api/gavoc/concepts/batavia',
      },
      '/api/gavoc/search': {
        method: 'GET',
        description:
          'Advanced search with relevance scoring and geographic filtering',
        parameters: {
          q: 'Search query (required)',
          category: 'Filter by geographic category (optional)',
          coordinates:
            'Set to "true" to only return concepts with coordinates (optional)',
          bbox: 'Bounding box filter: "minLng,minLat,maxLng,maxLat" (optional)',
          sort: 'Sort order: "relevance", "name", or "category" (default: relevance)',
          limit: 'Number of results per page (default: 50)',
          offset: 'Number of results to skip for pagination (default: 0)',
        },
        example: '/api/gavoc/search?q=amsterdam&sort=relevance&limit=10',
      },
      '/api/gavoc/categories': {
        method: 'GET',
        description:
          'List all available geographic categories with concept counts',
        parameters: {
          stats:
            'Set to "true" to include detailed statistics for each category (optional)',
        },
        example: '/api/gavoc/categories?stats=true',
      },
      '/api/gavoc/stats': {
        method: 'GET',
        description: 'Get comprehensive statistics about the GAVOC thesaurus',
        parameters: 'None',
        example: '/api/gavoc/stats',
      },
    },
    responseFormat: {
      success: {
        statusCode: 200,
        contentType: 'application/json',
        structure: {
          data: 'Main response data',
          pagination: 'Pagination information (where applicable)',
          metadata: 'API metadata including version and timestamp',
        },
      },
      error: {
        statusCodes: {
          400: 'Bad Request - Invalid parameters',
          404: 'Not Found - Concept not found',
          500: 'Internal Server Error',
        },
        structure: {
          error: 'Error type',
          message: 'Human-readable error description',
        },
      },
    },
    dataModel: {
      concept: {
        id: 'string - Unique concept identifier',
        preferredTerm: 'string - Primary name for the geographic entity',
        alternativeTerms: 'array - Alternative historical names',
        category: 'string - Geographic category (e.g., "plaats/settlement")',
        coordinates: 'object - Latitude and longitude (if available)',
        uri: 'string - Canonical URI for this concept',
        urlPath: 'string - URL path for web access',
        locationCount: 'number - Number of source locations for this concept',
      },
      location: {
        id: 'string - Unique location identifier',
        originalNameOnMap: 'string - Name as it appears on historical map',
        presentName: 'string - Modern name',
        category: 'string - Geographic category',
        coordinates: 'string - Original coordinate notation',
        latitude: 'number - Decimal latitude',
        longitude: 'number - Decimal longitude',
        map: 'string - Source map name',
        page: 'string - Page reference in source',
      },
    },
    rateLimits: {
      current: 'None implemented',
      planned: 'Rate limiting may be added in future versions',
    },
    caching: {
      policy: 'Responses are cached for 1-10 minutes depending on endpoint',
      headers: 'Cache-Control headers indicate cache duration',
    },
    cors: {
      policy: 'Open CORS - accessible from any domain',
      headers: 'Access-Control-Allow-Origin: *',
    },
    examples: {
      searchingForCities: {
        url: '/api/gavoc/search?q=amsterdam&category=plaats/settlement',
        description: 'Find all settlement concepts matching "amsterdam"',
      },
      gettingIslands: {
        url: '/api/gavoc/concepts?category=eiland/island&coordinates=true',
        description: 'Get all island concepts that have coordinates',
      },
      conceptDetails: {
        url: '/api/gavoc/concepts/batavia',
        description: 'Get detailed information about Batavia concept',
      },
      geographicBounds: {
        url: '/api/gavoc/search?q=fort&bbox=100,-10,140,10',
        description: 'Search for forts within Indonesia region',
      },
      csvExport: {
        url: '/api/gavoc/concepts?format=csv&limit=1000',
        description: 'Export up to 1000 concepts as CSV',
      },
    },
    technicalDetails: {
      framework: 'Next.js 15.2.4',
      dataSource: 'GAVOC Atlas CSV index',
      processing: 'Real-time thesaurus generation with concept deduplication',
      uriGeneration: 'Canonical URIs ensure same geographic entity = same URI',
    },
    contact: {
      project: 'Necessary Reunions',
      organization: 'Globalise Huygens',
      repository: 'https://github.com/globalise-huygens/necessary-reunions',
    },
    license: {
      note: 'Please check project repository for current license terms',
    },
  };

  return NextResponse.json(apiDocumentation, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
