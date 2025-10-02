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
      label: { en: ['VOC Map W37'] },
      height: 4000,
      width: 6000,
      items: [
        {
          id: 'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1/page',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1/image',
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: 'https://images.globalise.huygens.knaw.nl/iiif/4.MIKO_III_III.1_III.1.5_W37/full/max/0/default.jpg',
                type: 'Image',
                format: 'image/jpeg',
                height: 4000,
                width: 6000,
                service: [
                  {
                    id: 'https://images.globalise.huygens.knaw.nl/iiif/4.MIKO_III_III.1_III.1.5_W37',
                    type: 'ImageService3',
                    profile: 'level1',
                  },
                ],
              },
              target:
                'https://data.globalise.huygens.knaw.nl/manifests/maps/4.MIKO/III/III.1/III.1.5/W37.json/canvas/p1',
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
