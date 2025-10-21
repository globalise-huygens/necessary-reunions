import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

interface AnnotationPage {
  items?: unknown[];
}

interface LocalAnnotation {
  id: string;
  type: string;
  [key: string]: unknown;
}

export async function GET(): Promise<
  NextResponse<{ annotations: LocalAnnotation[] } | { error: string }>
> {
  try {
    const annotationsDir = path.join(
      process.cwd(),
      'data',
      'annotations',
      'georeferencing',
    );

    if (!existsSync(annotationsDir)) {
      return NextResponse.json({ annotations: [] });
    }

    const allFiles = await fs.readdir(annotationsDir);
    const files = allFiles.filter((file: string) => file.endsWith('.json'));
    const annotations: LocalAnnotation[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(annotationsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const annotationPage = JSON.parse(content) as AnnotationPage;

        if (annotationPage.items && Array.isArray(annotationPage.items)) {
          annotations.push(...(annotationPage.items as LocalAnnotation[]));
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error reading annotation file ${file}:`, errorMessage);
      }
    }

    return NextResponse.json({ annotations });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error loading local annotations:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to load local annotations' },
      { status: 500 },
    );
  }
}
