import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const ANNOREPO_BASE_URL = 'https://annorepo.globalise.huygens.knaw.nl';
    const CONTAINER = 'necessary-reunions';
    
    // Test basic connection
    const testUrl = `${ANNOREPO_BASE_URL}/services/${CONTAINER}/custom-query/with-target-and-motivation-or-purpose:target=,motivationorpurpose=bGlua2luZw==`;
    
    const headers: HeadersInit = {
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
    };

    // Add authorization header if token is available
    const authToken = process.env.ANNO_REPO_TOKEN_JONA;
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(testUrl, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = {
        url: testUrl,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        hasAuthToken: !!authToken,
        timestamp: new Date().toISOString(),
      };

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          ...result,
          success: true,
          itemCount: data.items?.length || 0,
          sampleItem: data.items?.[0] || null,
        });
      } else {
        const errorText = await response.text().catch(() => 'Could not read error text');
        return NextResponse.json({
          ...result,
          success: false,
          error: errorText,
        });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      return NextResponse.json({
        success: false,
        error: error.message,
        errorType: error.name,
        url: testUrl,
        hasAuthToken: !!authToken,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}