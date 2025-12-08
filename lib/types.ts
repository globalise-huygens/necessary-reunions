export interface Manifest {
  id: string;
  type: string;
  label: {
    en: string[];
  };
  items: Canvas[];
}

export interface Canvas {
  id: string;
  type: string;
  label: {
    en: string[];
  };
  height: number;
  width: number;
  items: {
    id: string;
    type: string;
    items: {
      id: string;
      type: string;
      motivation: string;
      body: {
        id: string;
        type: string;
        height: number;
        width: number;
        service: {
          '@id': string;
          '@type': string;
          profile: string;
        }[];
        format: string;
      };
      target: string;
    }[];
  }[];
  metadata?: {
    label: {
      en: string[];
    };
    value: {
      none: string[];
    };
  }[];
}

type JsonRecord = Record<string, unknown>;

export interface AnnotationAgent {
  id?: string;
  type?: string;
  label?: string;
}

export interface TextualBody {
  type: 'TextualBody';
  purpose?: string;
  value?: string;
  id?: string;
  generator?: AnnotationAgent;
  creator?: AnnotationAgent;
}

export interface SpecificResourceBody {
  type: 'SpecificResource';
  purpose?: string;
  source?: unknown;
  selector?: JsonRecord;
  creator?: AnnotationAgent;
  created?: string;
}

export type AnnotationBody =
  | TextualBody
  | SpecificResourceBody
  | JsonRecord
  | Array<TextualBody | SpecificResourceBody | JsonRecord>;

export interface AnnotationSelector extends JsonRecord {
  type?: string;
  value?: string;
}

export interface AnnotationTarget extends Record<string, unknown> {
  source?: string | { id?: string };
  type?: string;
  selector?: AnnotationSelector | AnnotationSelector[];
  generator?: AnnotationAgent;
}

export interface Annotation {
  id: string;
  type: string;
  motivation: string;
  body: AnnotationBody;
  target: AnnotationTarget | JsonRecord;
  creator?: AnnotationAgent;
  created?: string;
  modified?: string;
}

export interface LinkingAnnotation {
  '@context'?: string | string[];
  id: string;
  type: string;
  motivation: 'linking';
  target: string[];
  body: LinkingBody[];
  creator?: {
    id: string;
    type: string;
    label: string;
  };
  created?: string;
  modified?: string;
}

export interface LinkingBody {
  type: 'SpecificResource';
  purpose: 'identifying' | 'geotagging' | 'selecting';
  source?: GeoLocation | CanvasLocation;
  selector?: PointSelector;
  creator?: {
    id: string;
    type: string;
    label: string;
  };
  created?: string;
}

export interface GeoLocation {
  id: string;
  type: 'Place' | 'Feature';
  label: string;
  defined_by?: string;
  properties?: {
    title: string;
    description: string;
  };
  geometry?: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface CanvasLocation {
  id: string;
  type: string;
}

export interface PointSelector {
  type: 'PointSelector';
  x: number;
  y: number;
}

export interface GeoSearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  importance: number;
  boundingbox: [string, string, string, string];
}

export interface SvgSelector {
  type: string;
  value: string;
}
