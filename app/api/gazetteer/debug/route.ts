import { NextResponse } from 'next/server';
import {
  getCacheStatus,
  testDataSources,
} from '../../../../lib/gazetteer/data';

interface CacheStatus {
  hasData: boolean;
  [key: string]: unknown;
}

interface DataSourceResult {
  [key: string]: unknown;
}

interface TestResults {
  cache: CacheStatus;
  timestamp: string;
  environment: {
    nodeEnv: string | undefined;
    hasAnnoToken: boolean;
    platform: string;
    runtime: string;
  };
  dataSources?: DataSourceResult;
  dataSourceError?: string;
  duration?: number;
}

interface ErrorResponse {
  error: string;
  duration: number;
  timestamp: string;
}

export async function GET(): Promise<
  NextResponse<TestResults | ErrorResponse>
> {
  const startTime = Date.now();

  try {
    const cacheStatus = getCacheStatus() as CacheStatus;

    const testResults: TestResults = {
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
        const dataSources = (await testDataSources()) as DataSourceResult;
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
