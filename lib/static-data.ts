// Static manifest data for deployment environments
// This bypasses API calls that are failing in production

export const STATIC_MANIFEST = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://globalise-huygens.github.io/necessary-reunions/manifest.json',
  type: 'Manifest',
  label: { en: ['Necessary Reunions - VOC Maps'] },
  summary: { en: ['Historical maps from the VOC archives'] },
  items: [
    {
      id: 'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1',
      type: 'Canvas',
      label: { en: ['Kaart van de zuidkust van India, van Goa aan de westzijde tot aan de rivier Samgam aan de oostzijde'] },
      height: 10902,
      width: 8983,
      items: [
        {
          id: 'https://globalise-huygens.github.io/necessary-reunions/manifest.json/MAL_1/p1/page',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://globalise-huygens.github.io/necessary-reunions/manifest.json/MAL_1/p1/page/anno',
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: 'https://service.archief.nl/iip/iipsrv?IIIF=/55/e6/2e/89/2d/ed/40/93/ac/54/51/7e/9f/6c/f1/6f/fa7f27fc-6c2e-430e-9004-a99f888b14bf.jp2/full/full/0/default.jpg',
                type: 'Image',
                format: 'image/jpeg',
                height: 10902,
                width: 8983,
                service: [
                  {
                    '@id': 'https://service.archief.nl/iip/iipsrv?IIIF=/55/e6/2e/89/2d/ed/40/93/ac/54/51/7e/9f/6c/f1/6f/fa7f27fc-6c2e-430e-9004-a99f888b14bf.jp2',
                    '@type': 'ImageService2',
                    profile: 'http://iiif.io/api/image/2/level1',
                  },
                ],
              },
              target: 'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1',
            },
          ],
        },
      ],
    },
  ],
};

export const STATIC_ANNOTATIONS = [
  // Sample annotation for demonstration
  {
    id: 'static-annotation-1',
    type: 'Annotation',
    motivation: 'commenting',
    body: {
      type: 'TextualBody',
      value: 'Sample text annotation',
      purpose: 'commenting',
    },
    target: {
      source:
        'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1',
      selector: {
        type: 'FragmentSelector',
        conformsTo: 'http://www.w3.org/TR/media-frags/',
        value: 'xywh=1000,1000,500,300',
      },
    },
  },
];

export const STATIC_LINKING_ANNOTATIONS = [
  // Empty for now - can be populated with static linking data if needed
];

export function isDeploymentEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.location.hostname.includes('netlify') ||
    window.location.hostname.includes('vercel') ||
    window.location.hostname.includes('deploy-preview') ||
    window.location.hostname === 'necessaryreunions.org'
  );
}

export function shouldUseStaticData(): boolean {
  return isDeploymentEnvironment();
}
