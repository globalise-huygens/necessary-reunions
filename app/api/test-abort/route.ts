import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const tests = {
    hasAbortSignal: typeof AbortSignal !== 'undefined',
    hasAbortSignalTimeout:
      typeof AbortSignal !== 'undefined' &&
      typeof AbortSignal.timeout === 'function',
    hasAbortController: typeof AbortController !== 'undefined',
  };

  let abortSignalTimeoutWorks = false;
  let abortSignalTimeoutError = null;

  try {
    const signal = AbortSignal.timeout(1000);
    abortSignalTimeoutWorks = true;
  } catch (error) {
    abortSignalTimeoutError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json({
    tests,
    abortSignalTimeoutWorks,
    abortSignalTimeoutError,
    runtime: 'edge',
  });
}
