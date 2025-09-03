import { invalidateCache } from '@/lib/gazetteer/data';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    invalidateCache();
    console.log('Cache invalidated manually');
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
