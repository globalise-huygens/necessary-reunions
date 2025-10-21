import { NextResponse } from 'next/server';
import { invalidateCache } from '../../../../lib/gazetteer/data';

interface SuccessResponse {
  success: true;
  message: string;
}

interface ErrorResponse {
  success: false;
  error: string;
}

export async function POST(): Promise<
  NextResponse<SuccessResponse | ErrorResponse>
> {
  await Promise.resolve();
  try {
    invalidateCache();
    return NextResponse.json({
      success: true,
      message: 'Cache invalidated successfully',
    });
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to invalidate cache' },
      { status: 500 },
    );
  }
}
