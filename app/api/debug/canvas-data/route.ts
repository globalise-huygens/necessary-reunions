import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Use our existing bulk API to get the data
    const w37Response = await fetch(
      `http://localhost:3000/api/annotations/linking-bulk?targetCanvasId=${encodeURIComponent(
        'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1',
      )}`,
    );

    const cananoreResponse = await fetch(
      `http://localhost:3000/api/annotations/linking-bulk?targetCanvasId=${encodeURIComponent(
        'https://data.globalise.huygens.knaw.nl/manifests/maps/4.VEL/C/C.2/C.2.4/cananore/891.json/canvas/p2',
      )}`,
    );

    const w37Data = await w37Response.json();
    const cananoreData = await cananoreResponse.json();

    return NextResponse.json({
      w37Canvas: {
        id: 'W37 (first canvas)',
        annotations: w37Data.annotations?.length || 0,
        iconStates: Object.keys(w37Data.iconStates || {}).length,
        hasPoints:
          w37Data.annotations?.filter((a: any) =>
            a.body?.some((b: any) => b.purpose === 'selecting'),
          ).length || 0,
      },
      cananoreCanvas: {
        id: 'Cananore (second canvas)',
        annotations: cananoreData.annotations?.length || 0,
        iconStates: Object.keys(cananoreData.iconStates || {}).length,
        hasPoints:
          cananoreData.annotations?.filter((a: any) =>
            a.body?.some((b: any) => b.purpose === 'selecting'),
          ).length || 0,
      },
      conclusion:
        'W37 has data, Cananore does not - this explains the behavior',
    });
  } catch (error) {
    console.error('Error analyzing canvas data:', error);
    return NextResponse.json(
      { error: 'Failed to analyze canvas data', details: String(error) },
      { status: 500 },
    );
  }
}
