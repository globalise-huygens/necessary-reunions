import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { ParsedPolygon } from './types';

export function parseSvgPolygon(svgValue: string): ParsedPolygon | null {
  try {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgValue, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    const polygon = svgElement.querySelector('polygon');
    const rect = svgElement.querySelector('rect');
    const path = svgElement.querySelector('path');

    if (polygon) {
      const pointsAttr = polygon.getAttribute('points');
      if (!pointsAttr) return null;

      const pointPairs = pointsAttr.trim().split(/[\s,]+/);
      const points: number[][] = [];

      for (let i = 0; i < pointPairs.length; i += 2) {
        if (i + 1 < pointPairs.length) {
          const x = Number.parseFloat(pointPairs[i]);
          const y = Number.parseFloat(pointPairs[i + 1]);
          if (!isNaN(x) && !isNaN(y)) {
            points.push([x, y]);
          }
        }
      }

      return { points };
    }

    if (rect) {
      const x = Number.parseFloat(rect.getAttribute('x') || '0');
      const y = Number.parseFloat(rect.getAttribute('y') || '0');
      const width = Number.parseFloat(rect.getAttribute('width') || '0');
      const height = Number.parseFloat(rect.getAttribute('height') || '0');

      return {
        points: [
          [x, y],
          [x + width, y],
          [x + width, y + height],
          [x, y + height],
        ],
      };
    }

    if (path) {
      const d = path.getAttribute('d');
      if (!d) return null;

      return parsePathData(d);
    }

    const pointsMatch = svgValue.match(/points="([^"]+)"/);
    if (!pointsMatch || !pointsMatch[1]) {
      const pathMatch = svgValue.match(/d="([^"]+)"/);
      if (pathMatch && pathMatch[1]) {
        return parsePathData(pathMatch[1]);
      }
      return null;
    }

    const pointsString = pointsMatch[1];

    const pointPairs = pointsString.trim().split(/\s+/);

    const points = pointPairs.map((pair) => {
      const parts = pair.includes(',') ? pair.split(',') : pair.split(' ');

      if (parts.length >= 2) {
        const x = Number.parseFloat(parts[0]);
        const y = Number.parseFloat(parts[1]);
        if (!isNaN(x) && !isNaN(y)) {
          return [x, y];
        }
      }

      console.warn('Invalid point format:', pair);
      return [0, 0];
    });

    return { points };
  } catch (error) {
    console.error('Error parsing SVG polygon:', error);
    return null;
  }
}

function parsePathData(pathData: string): ParsedPolygon | null {
  try {
    const points: number[][] = [];
    const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g) || [];

    let currentX = 0;
    let currentY = 0;

    commands.forEach((cmd) => {
      const type = cmd[0];
      const args = cmd
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map(Number.parseFloat);

      switch (type) {
        case 'M':
          currentX = args[0];
          currentY = args[1];
          points.push([currentX, currentY]);
          break;
        case 'm':
          currentX += args[0];
          currentY += args[1];
          points.push([currentX, currentY]);
          break;
        case 'L':
          currentX = args[0];
          currentY = args[1];
          points.push([currentX, currentY]);
          break;
        case 'l':
          currentX += args[0];
          currentY += args[1];
          points.push([currentX, currentY]);
          break;
        case 'H':
          currentX = args[0];
          points.push([currentX, currentY]);
          break;
        case 'h':
          currentX += args[0];
          points.push([currentX, currentY]);
          break;
        case 'V':
          currentY = args[0];
          points.push([currentX, currentY]);
          break;
        case 'v':
          currentY += args[0];
          points.push([currentX, currentY]);
          break;
        case 'Z':
        case 'z':
          if (points.length > 0) {
            points.push([points[0][0], points[0][1]]);
          }
          break;
      }
    });

    return { points };
  } catch (error) {
    console.error('Error parsing SVG path data:', error);
    return null;
  }
}

export function normalizeTarget(annotation: any): string | null {
  if (!annotation.target) {
    return null;
  }

  if (typeof annotation.target === 'string') {
    return annotation.target;
  }

  if (annotation.target.source) {
    return annotation.target.source;
  }

  if (Array.isArray(annotation.target) && annotation.target.length > 0) {
    const firstTarget = annotation.target[0];
    if (typeof firstTarget === 'string') {
      return firstTarget;
    }
    if (firstTarget && firstTarget.source) {
      return firstTarget.source;
    }
  }

  if (annotation.target.id) {
    return annotation.target.id;
  }

  return null;
}

export function getLastPathSegment(url: string): string {
  const cleanUrl = url.split('?')[0].split('#')[0];
  const segments = cleanUrl.split('/').filter(Boolean);
  return segments[segments.length - 1];
}

export function getCanvasIdentifier(url: string): string {
  const canvasMatch = url.match(/canvas\/([^/?#]+)/);
  if (canvasMatch && canvasMatch[1]) {
    return canvasMatch[1];
  }

  return getLastPathSegment(url);
}

export function targetMatchesCanvas(
  target: string | null,
  canvasId: string,
): boolean {
  if (!target || !canvasId) return false;

  const targetIdentifier = getCanvasIdentifier(target);
  const canvasIdentifier = getCanvasIdentifier(canvasId);

  return targetIdentifier === canvasIdentifier;
}

export function encodeCanvasUri(uri: string): string {
  const base64 =
    typeof window !== 'undefined'
      ? btoa(uri)
      : Buffer.from(uri).toString('base64');

  return encodeURIComponent(base64);
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
