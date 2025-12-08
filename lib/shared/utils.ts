import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function getLastPathSegment(url: string): string {
  const cleanUrl = url.split('?')[0]?.split('#')[0] ?? '';
  const segments = cleanUrl.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

const toBase64 = (value: string): string => {
  if (typeof window !== 'undefined') {
    return window.btoa(value);
  }

  return Buffer.from(value, 'utf-8').toString('base64');
};

export function encodeCanvasUri(uri: string): string {
  return toBase64(uri);
}

export function normalizeCanvasId(uri?: string | null): string | undefined {
  if (!uri) return undefined;

  let normalized = uri.trim();
  if (!normalized) return undefined;

  const hashIndex = normalized.indexOf('#');
  if (hashIndex >= 0) {
    normalized = normalized.slice(0, hashIndex);
  }

  const queryIndex = normalized.indexOf('?');
  if (queryIndex >= 0) {
    normalized = normalized.slice(0, queryIndex);
  }

  if (normalized.endsWith('/') && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }

  return normalized || undefined;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
