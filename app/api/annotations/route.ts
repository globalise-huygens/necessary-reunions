import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const slug = request.headers.get('slug');
    const annorepoUrl =
      'https://annorepo.globalise.huygens.knaw.nl/w3c/necessary-reunions/';
    const headers: Record<string, string> = {
      'Content-Type':
        'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Accept: 'application/ld+json; profile="http://www.w3.org/ns/anno.jsonld"',
      Authorization: `Bearer ${process.env.ANNO_REPO_TOKEN_GLOBALISE}`,
    };
    if (slug) headers['Slug'] = slug;
    const res = await fetch(annorepoUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const etag = res.headers.get('etag') || '';
    const text = await res.clone().text();
    if (!res.ok) {
      return new NextResponse(
        JSON.stringify({
          error: `AnnoRepo error: ${res.status} ${res.statusText}\n${text}`,
        }),
        {
          status: res.status,
          headers: { 'content-type': 'application/json' },
        },
      );
    }
    const created = JSON.parse(text);
    return NextResponse.json({ ...created, etag }, { status: 201 });
  } catch (err: any) {
    return new NextResponse(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
