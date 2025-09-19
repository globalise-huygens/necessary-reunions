import fs from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';
import { promisify } from 'util';
import { gzip } from 'zlib';

const gzipAsync = promisify(gzip);

// In-memory cache for annotations with TTL
interface CacheEntry {
  data: any[];
  timestamp: number;
  etag: string;
}

const annotationCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 1000; // 30 seconds cache
const CACHE_KEY = 'local-annotations';

// Pre-computed file list cache
let fileListCache: { files: string[]; timestamp: number } | null = null;
const FILE_LIST_TTL = 60 * 1000; // 1 minute

function getFileList(): string[] {
  const now = Date.now();
  const annotationsDir = path.join(
    process.cwd(),
    'data',
    'annotations',
    'georeferencing',
  );

  if (!fs.existsSync(annotationsDir)) {
    return [];
  }

  // Use cached file list if still valid
  if (fileListCache && now - fileListCache.timestamp < FILE_LIST_TTL) {
    return fileListCache.files;
  }

  const files = fs
    .readdirSync(annotationsDir)
    .filter((file) => file.endsWith('.json'))
    .sort(); // Sort for consistent ordering

  fileListCache = { files, timestamp: now };
  return files;
}

function generateETag(files: string[]): string {
  const annotationsDir = path.join(
    process.cwd(),
    'data',
    'annotations',
    'georeferencing',
  );

  // Generate ETag based on file modification times
  let combinedMtime = 0;
  for (const file of files) {
    try {
      const filePath = path.join(annotationsDir, file);
      const stats = fs.statSync(filePath);
      combinedMtime += stats.mtimeMs;
    } catch (error) {
      // File might have been deleted, include timestamp in ETag
      combinedMtime += Date.now();
    }
  }

  return `"${Math.round(combinedMtime).toString(36)}-${files.length}"`;
}

async function loadAnnotations(files: string[]): Promise<any[]> {
  const annotationsDir = path.join(
    process.cwd(),
    'data',
    'annotations',
    'georeferencing',
  );
  const annotations: any[] = [];

  // Process files in batches for better memory management
  const batchSize = 5;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    const batchPromises = batch.map(async (file) => {
      try {
        const filePath = path.join(annotationsDir, file);
        const content = await fs.promises.readFile(filePath, 'utf8');
        const annotationPage = JSON.parse(content);

        if (annotationPage.items && Array.isArray(annotationPage.items)) {
          return annotationPage.items;
        }
        return [];
      } catch (error) {
        console.error(`Error reading annotation file ${file}:`, error);
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    annotations.push(...batchResults.flat());
  }

  return annotations;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const acceptEncoding = request.headers.get('accept-encoding') || '';
    const ifNoneMatch = request.headers.get('if-none-match');
    const canvasId = url.searchParams.get('canvasId'); // Optional filtering

    const files = getFileList();
    const etag = generateETag(files);

    // Check if client has cached version
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304 });
    }

    const now = Date.now();
    const cached = annotationCache.get(CACHE_KEY);

    let annotations: any[];

    // Use cache if valid and ETag matches
    if (cached && now - cached.timestamp < CACHE_TTL && cached.etag === etag) {
      annotations = cached.data;
    } else {
      // Load fresh data
      annotations = await loadAnnotations(files);

      // Update cache
      annotationCache.set(CACHE_KEY, {
        data: annotations,
        timestamp: now,
        etag,
      });

      // Cleanup old cache entries
      if (annotationCache.size > 10) {
        const oldestKey = annotationCache.keys().next().value;
        if (oldestKey) {
          annotationCache.delete(oldestKey);
        }
      }
    }

    // Filter by canvas if requested
    let filteredAnnotations = annotations;
    if (canvasId) {
      filteredAnnotations = annotations.filter((annotation: any) => {
        const targetSource =
          annotation.target?.source?.id || annotation.target?.source;
        return targetSource === canvasId;
      });
    }

    const responseData = {
      annotations: filteredAnnotations,
      count: filteredAnnotations.length,
      cached: cached?.etag === etag,
    };

    let responseBody: BodyInit = JSON.stringify(responseData);
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ETag: etag,
      'Cache-Control': 'private, max-age=30, must-revalidate',
      'X-Annotation-Count': filteredAnnotations.length.toString(),
    };

    // Compress response if client supports it and response is large enough
    const originalBody = JSON.stringify(responseData);
    if (acceptEncoding.includes('gzip') && originalBody.length > 1024) {
      try {
        const compressed = await gzipAsync(Buffer.from(originalBody));
        responseBody = new Uint8Array(compressed);
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = compressed.length.toString();
      } catch (error) {
        console.warn('Gzip compression failed:', error);
        // Fall back to uncompressed response
        responseBody = originalBody;
      }
    }

    return new Response(responseBody, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error loading optimized local annotations:', error);
    return NextResponse.json(
      { error: 'Failed to load local annotations' },
      { status: 500 },
    );
  }
}
