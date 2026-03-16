import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function getLastPathSegment(url: string): string {
  const cleanUrl = url.split('?')[0]?.split('#')[0] ?? '';
  const segments = cleanUrl.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

export function encodeCanvasUri(uri: string): string {
  return typeof window !== 'undefined'
    ? btoa(uri)
    : Buffer.from(uri).toString('base64');
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function safeJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    const text = await response.text();
    throw new Error(
      `Expected JSON but got ${contentType || 'unknown content-type'}: ${text.slice(0, 200)}`,
    );
  }
  const data: unknown = await response.json();
  return data as T;
}
