import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json(
      { error: 'Name parameter is required' },
      { status: 400 },
    );
  }

  try {
    const localResponse = await fetch(
      `${
        request.nextUrl.origin
      }/api/globalise/local-places?name=${encodeURIComponent(name)}`,
      {
        headers: {
          'User-Agent': request.headers.get('user-agent') || '',
        },
      },
    );

    if (localResponse.ok) {
      const localData = await localResponse.json();
      return NextResponse.json({
        ...localData,
        source: 'globalise-local',
        note: 'Using local GLOBALISE dataset',
      });
    }
  } catch (error) {
    console.warn(
      'Local GLOBALISE dataset unavailable, falling back to external API',
    );
  }

  const cookies = request.headers.get('cookie');

  try {
    const globaliseUrl = new URL(
      'https://globalise-refdata.huc.knaw.nl/api/places',
    );
    globaliseUrl.searchParams.set('q', name);
    globaliseUrl.searchParams.set('limit', '10');

    const headers: HeadersInit = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      Referer: 'https://globalise-refdata.huc.knaw.nl/',
      Origin: 'https://globalise-refdata.huc.knaw.nl',
    };

    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const response = await fetch(globaliseUrl.toString(), {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        return getDemoData(name);
      }

      throw new Error(
        `GLOBALISE API returned ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();

    const transformedResults =
      data.features?.map((place: any) => {
        const description = place.properties.description || '';

        let preferredLabel = place.properties.title || 'Unknown Place';
        let alternativeLabels: string[] = [];
        let placeTypes: string[] = [];

        const labelMatch = description.match(/Label\(s\):\s*([^|]+)/);
        if (labelMatch) {
          const labelsPart = labelMatch[1].trim();
          const labelItems = labelsPart
            .split(',')
            .map((item: string) => item.trim());

          for (const item of labelItems) {
            if (item.includes('(PREF)')) {
              preferredLabel = item.replace('(PREF)', '').trim();
            } else if (item.includes('(ALT)')) {
              alternativeLabels.push(item.replace('(ALT)', '').trim());
            }
          }
        }

        const typeMatch = description.match(/Type\(s\):\s*([^|]+)/);
        if (typeMatch) {
          const typesPart = typeMatch[1].trim();
          const typeItems = typesPart
            .split(',')
            .map((item: string) => item.trim());

          for (const item of typeItems) {
            if (item.includes('/')) {
              const parts = item.split('/');
              if (parts.length > 1) {
                placeTypes.push(parts[1].trim());
              }
            } else if (!item.startsWith('https://')) {
              placeTypes.push(item);
            }
          }
        }

        return {
          id: place.id,
          type: 'Feature',
          geometry: place.geometry,
          properties: {
            preferredTitle: preferredLabel,
            title: preferredLabel,
            alternativeNames: alternativeLabels,
            type: placeTypes.length > 0 ? placeTypes[0] : 'place',
            types: placeTypes,
            originalDescription: description,
          },
        };
      }) || [];

    return NextResponse.json({
      features: transformedResults,
      source: 'globalise',
      query: name,
    });

    return NextResponse.json({
      features: transformedResults,
      source: 'globalise',
      query: name,
    });
  } catch (error) {
    return getDemoData(name);
  }
}

function getDemoData(query: string) {
  const demoPlaces = [
    {
      id: 'demo-batavia-1',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [106.8456, -6.2088],
      },
      properties: {
        title: 'Batavia',
        description:
          'Type(s): steden / cities | Label(s): Jakarta (ALT), Jayakarta (ALT), Sunda Kelapa (ALT), Djakarta (ALT), Batavia (PREF)',
      },
    },
    {
      id: 'demo-sitawaka-1',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [80.212616, 6.951796],
      },
      properties: {
        title: 'Sitawaka',
        description:
          'Type(s): koninkrijk / kingdom | Label(s): Sitavacca (ALT), Sitavaque (ALT), Sitwaka (ALT), Sitawaka (PREF)',
      },
    },
    {
      id: 'demo-combir-1',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [129.94306, -4.51806],
      },
      properties: {
        title: 'Desa Combir Kasestoren',
        description:
          'Type(s): perken | Label(s): Caytortorre (ALT), Tortorre (ALT), Keizerstoren (ALT), Kaitortorre (ALT), Desa Combir Kasestoren (PREF)',
      },
    },
    {
      id: 'demo-colombo-1',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [79.8612, 6.9271],
      },
      properties: {
        title: 'Colombo',
        description:
          'Type(s): steden / cities | Label(s): Kolombo (ALT), Kolamba (ALT), Kolambu (ALT), Colombo (PREF)',
      },
    },
    {
      id: 'demo-cape-1',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [18.4964, -34.3587],
      },
      properties: {
        title: 'Cape of Good Hope',
        description:
          'Type(s): kapen / capes | Label(s): Kaap de Goede Hoop (ALT), Cape Town (ALT), Kaapstad (ALT), Cape of Good Hope (PREF)',
      },
    },
    {
      id: 'demo-malacca-1',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [102.2493, 2.2055],
      },
      properties: {
        preferredTitle: 'Malacca',
        title: 'Malacca',
        alternativeNames: ['Melaka', 'Malaka', 'Malakka'],
        type: 'city',
        types: ['cities'],
        originalDescription:
          'Type(s): steden / cities | Label(s): Melaka (ALT), Malaka (ALT), Malakka (ALT), Malacca (PREF)',
      },
    },
    {
      id: 'demo-ceylan-1',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [80.7718, 7.8731],
      },
      properties: {
        preferredTitle: 'Ceylon',
        title: 'Ceylon',
        alternativeNames: ['Sri Lanka', 'Ceilão', 'Seilan'],
        type: 'island',
        types: ['islands'],
        originalDescription:
          'Type(s): eilanden / islands | Label(s): Sri Lanka (ALT), Ceilão (ALT), Seilan (ALT), Ceylon (PREF)',
      },
    },
    {
      id: 'demo-coromandel-1',
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [79.8551, 11.0168],
      },
      properties: {
        preferredTitle: 'Coromandel Coast',
        title: 'Coromandel Coast',
        alternativeNames: ['Cholamandalam', 'Kosta Koromandel'],
        type: 'coast',
        types: ['coasts'],
        originalDescription:
          'Type(s): kusten / coasts | Label(s): Cholamandalam (ALT), Kosta Koromandel (ALT), Coromandel Coast (PREF)',
      },
    },
  ];

  const filteredPlaces = demoPlaces.filter((place) => {
    const searchLower = query.toLowerCase();

    if (place.properties.title?.toLowerCase().includes(searchLower)) {
      return true;
    }

    if (place.properties.description) {
      const labelMatch = place.properties.description.match(
        /Label\(s\):\s*([^|]+)/,
      );
      if (labelMatch) {
        const labelsPart = labelMatch[1].toLowerCase();
        if (labelsPart.includes(searchLower)) {
          return true;
        }
      }
    }

    return false;
  });

  return NextResponse.json({
    features: filteredPlaces,
    source: 'globalise',
    query,
    note: 'Demo data - authentication required for live GLOBALISE API access',
  });
}
