import { NextResponse } from 'next/server';
import { getCacheStatus, testDataSources } from '@/lib/gazetteer/data';

export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('Starting gazetteer debug endpoint');
    
    const cacheStatus = getCacheStatus();
    
    // Test basic connectivity to AnnoRepo
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

    // Try a simple test of data sources if cache is empty
    if (!cacheStatus.hasData) {
      try {
        console.log('Cache empty, testing data sources...');
        const dataSources = await testDataSources();
        testResults.dataSources = dataSources;
      } catch (error) {
        console.error('Data source test failed:', error);
        testResults.dataSourceError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    const duration = Date.now() - startTime;
    testResults.duration = duration;

    console.log(`Debug endpoint completed in ${duration}ms`);

    return NextResponse.json(testResults);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Debug endpoint error after ${duration}ms:`, error);

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
