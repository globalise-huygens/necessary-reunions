import { getCacheStatus, testDataSources } from '@/lib/gazetteer/data';
import { NextResponse } from 'next/server';

export async function GET() {
  const startTime = Date.now();

  try {
    const cacheStatus = getCacheStatus();

    const testResults: any = {
      cache: cacheStatus,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasAnnoToken: !!process.env.ANNO_REPO_TOKEN_JONA,
        platform: process.platform,
        runtime: 'nodejs',
      },
    };

    if (!cacheStatus.hasData) {
      try {
        const dataSources = await testDataSources();
        testResults.dataSources = dataSources;
      } catch (error) {
        console.error('Data source test failed:', error);
        testResults.dataSourceError =
          error instanceof Error ? error.message : 'Unknown error';
      }
    }

    const duration = Date.now() - startTime;
    testResults.duration = duration;

    return NextResponse.json(testResults);
  } catch (error) {
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
