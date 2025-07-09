import fs from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';

export async function GET() {
  try {
    const annotationsDir = path.join(
      process.cwd(),
      'data',
      'annotations',
      'georeferencing',
    );

    if (!fs.existsSync(annotationsDir)) {
      return NextResponse.json({ annotations: [] });
    }

    const files = fs
      .readdirSync(annotationsDir)
      .filter((file) => file.endsWith('.json'));
    const annotations: any[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(annotationsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const annotationPage = JSON.parse(content);

        if (annotationPage.items && Array.isArray(annotationPage.items)) {
          annotations.push(...annotationPage.items);
        }
      } catch (error) {
        console.error(`Error reading annotation file ${file}:`, error);
      }
    }

    return NextResponse.json({ annotations });
  } catch (error) {
    console.error('Error loading local annotations:', error);
    return NextResponse.json(
      { error: 'Failed to load local annotations' },
      { status: 500 },
    );
  }
}
