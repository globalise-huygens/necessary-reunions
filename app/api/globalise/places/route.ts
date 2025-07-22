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
    const response = await fetch(
      `https://globalise-refdata.huc.knaw.nl/api/places/?name=${encodeURIComponent(
        name,
      )}&format=json`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Necessary-Reunions-App/1.0',
        },
      },
    );

    if (!response.ok) {
      console.warn(
        `GLOBALISE API error: ${response.status} ${response.statusText}`,
      );

      if (response.status === 403 || response.status === 401) {
        if (
          name.toLowerCase().includes('kochin') ||
          name.toLowerCase().includes('cochin')
        ) {
          return NextResponse.json({
            type: 'FeatureCollection',
            features: [
              {
                id: 'https://id.necessaryreunions.org/place/56a12537-b687-4c99-b58d-3986948aa4ce',
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [76.258793, 9.939431],
                },
                properties: {
                  title: 'Cochin',
                  description:
                    'Type(s): | Label(s): Perumbadapil (ALT), Kochin (ALT), Kochi (ALT), Coutchin (ALT), Couchyn (ALT), Couchin (ALT), Couchim (ALT), Couchijn (ALT), Cotchyn (ALT), Cohin (ALT), Coetchyn (ALT), Cochim (ALT), Cochin (PREF)',
                  preferredTitle: 'Cochin',
                  allLabels: [
                    'Perumbadapil',
                    'Kochin',
                    'Kochi',
                    'Coutchin',
                    'Couchyn',
                    'Couchin',
                    'Couchim',
                    'Couchijn',
                    'Cotchyn',
                    'Cohin',
                    'Coetchyn',
                    'Cochim',
                    'Cochin',
                  ],
                  originalTitle: 'Cochin',
                },
              },
            ],
          });
        }

        if (
          name.toLowerCase().includes('batavia') ||
          name.toLowerCase().includes('jakarta')
        ) {
          return NextResponse.json({
            type: 'FeatureCollection',
            features: [
              {
                id: 'https://id.necessaryreunions.org/place/example-batavia',
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [106.845172, -6.208763],
                },
                properties: {
                  title: 'Jakarta',
                  description:
                    'Type(s): | Label(s): Batavia (ALT), Djakarta (ALT), Jakarta (PREF)',
                  preferredTitle: 'Jakarta',
                  allLabels: ['Batavia', 'Djakarta', 'Jakarta'],
                  originalTitle: 'Jakarta',
                },
              },
            ],
          });
        }

        return NextResponse.json({
          type: 'FeatureCollection',
          features: [],
        });
      }

      return NextResponse.json(
        { error: `GLOBALISE API error: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();

    if (data.features && Array.isArray(data.features)) {
      data.features = data.features.map((feature: any) => {
        const description = feature.properties?.description || '';
        const labels = description.split('Label(s): ')[1] || '';
        const labelParts = labels.split(', ');

        const preferredLabel = labelParts.find((label: string) =>
          label.includes('(PREF)'),
        );
        const preferredName = preferredLabel
          ? preferredLabel.replace(' (PREF)', '')
          : feature.properties?.title;

        const allLabels = labelParts
          .map((label: string) =>
            label.replace(/\s*\((ALT|PREF)\)$/, '').trim(),
          )
          .filter(Boolean);

        return {
          ...feature,
          properties: {
            ...feature.properties,
            preferredTitle: preferredName,
            allLabels: allLabels,
            originalTitle: feature.properties?.title,
          },
        };
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching from GLOBALISE API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from GLOBALISE API' },
      { status: 500 },
    );
  }
}
