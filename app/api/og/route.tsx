import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export default function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#f6f6f6',
        }}
      >
        <h1 style={{ fontSize: 128 }}>re:Charted</h1>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
