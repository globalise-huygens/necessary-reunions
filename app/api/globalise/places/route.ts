import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('GLOBALISE API proxy called');

  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json(
      { error: 'Name parameter is required' },
      { status: 400 },
    );
  }

  console.log('Searching for:', name);

  const cookies = request.headers.get('cookie');
  console.log(
    '🍪 Received cookies from frontend:',
    cookies ? 'Yes (forwarding)' : 'None',
  );

  try {
    const globaliseUrl = new URL(
      'https://globalise-refdata.huc.knaw.nl/api/places',
    );
    globaliseUrl.searchParams.set('q', name);
    globaliseUrl.searchParams.set('limit', '10');

    console.log('📡 Making request to GLOBALISE API:', globaliseUrl.toString());

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

    console.log('GLOBALISE API response status:', response.status);
    console.log(
      'GLOBALISE API response headers:',
      Object.fromEntries(response.headers.entries()),
    );

    if (!response.ok) {
      console.error(
        'GLOBALISE API error:',
        response.status,
        response.statusText,
      );

      if (response.status === 403 || response.status === 401) {
        console.log('Authentication failed, returning demo data');
        return getDemoData(name);
      }

      throw new Error(
        `GLOBALISE API returned ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log(
      'GLOBALISE API success, received',
      data?.results?.length || 0,
      'results',
    );

    const transformedResults =
      data.results?.map((place: any) => {
        const labels = place.labels || [];
        const preferredLabel =
          labels.find((label: any) => label.preferred)?.name ||
          place.name ||
          'Unknown Place';
        const alternativeLabels = labels
          .filter((label: any) => !label.preferred)
          .map((label: any) => label.name)
          .filter(Boolean);

        return {
          id: place.id,
          name: preferredLabel,
          display_name: preferredLabel,
          lat: parseFloat(place.latitude) || 0,
          lon: parseFloat(place.longitude) || 0,
          source: 'globalise' as const,
          alternative_names: alternativeLabels,
          type: place.type || 'place',
          boundingbox: place.boundingbox || [
            (parseFloat(place.latitude) - 0.01).toString(),
            (parseFloat(place.latitude) + 0.01).toString(),
            (parseFloat(place.longitude) - 0.01).toString(),
            (parseFloat(place.longitude) + 0.01).toString(),
          ],
        };
      }) || [];

    return NextResponse.json({
      results: transformedResults,
      source: 'globalise',
      query: name,
    });
  } catch (error) {
    console.error('💥 Error fetching from GLOBALISE API:', error);

    console.log('🎭 Returning demo data as fallback');
    return getDemoData(name);
  }
}

function getDemoData(query: string) {
  const demoPlaces = [
    {
      id: 'demo-batavia-1',
      name: 'Batavia',
      display_name: 'Batavia (Jakarta, Indonesia)',
      lat: -6.2088,
      lon: 106.8456,
      source: 'globalise' as const,
      alternative_names: ['Jakarta', 'Jayakarta', 'Sunda Kelapa', 'Djakarta'],
      type: 'city',
      boundingbox: ['-6.3', '-6.1', '106.7', '107.0'],
    },
    {
      id: 'demo-colombo-1',
      name: 'Colombo',
      display_name: 'Colombo (Sri Lanka)',
      lat: 6.9271,
      lon: 79.8612,
      source: 'globalise' as const,
      alternative_names: ['Kolombo', 'Kolamba', 'Kolambu'],
      type: 'city',
      boundingbox: ['6.8', '7.0', '79.7', '80.0'],
    },
    {
      id: 'demo-cape-1',
      name: 'Cape of Good Hope',
      display_name: 'Cape of Good Hope (South Africa)',
      lat: -34.3587,
      lon: 18.4964,
      source: 'globalise' as const,
      alternative_names: ['Kaap de Goede Hoop', 'Cape Town', 'Kaapstad'],
      type: 'cape',
      boundingbox: ['-34.5', '-34.2', '18.3', '18.7'],
    },
    {
      id: 'demo-malacca-1',
      name: 'Malacca',
      display_name: 'Malacca (Malaysia)',
      lat: 2.2055,
      lon: 102.2493,
      source: 'globalise' as const,
      alternative_names: ['Melaka', 'Malaka', 'Malakka'],
      type: 'city',
      boundingbox: ['2.1', '2.3', '102.1', '102.4'],
    },
    {
      id: 'demo-ceylan-1',
      name: 'Ceylon',
      display_name: 'Ceylon (Sri Lanka)',
      lat: 7.8731,
      lon: 80.7718,
      source: 'globalise' as const,
      alternative_names: ['Sri Lanka', 'Ceilão', 'Seilan'],
      type: 'island',
      boundingbox: ['5.9', '9.8', '79.6', '81.9'],
    },
    {
      id: 'demo-coromandel-1',
      name: 'Coromandel Coast',
      display_name: 'Coromandel Coast (India)',
      lat: 11.0168,
      lon: 79.8551,
      source: 'globalise' as const,
      alternative_names: ['Cholamandalam', 'Kosta Koromandel'],
      type: 'coast',
      boundingbox: ['10.0', '14.0', '79.0', '81.0'],
    },
  ];

  const filteredPlaces = demoPlaces.filter((place) => {
    const searchLower = query.toLowerCase();
    return (
      place.name.toLowerCase().includes(searchLower) ||
      place.display_name.toLowerCase().includes(searchLower) ||
      place.alternative_names.some((alt) =>
        alt.toLowerCase().includes(searchLower),
      )
    );
  });

  return NextResponse.json({
    results: filteredPlaces,
    source: 'globalise',
    query,
    note: 'Demo data - authentication required for live GLOBALISE API access',
  });
}
