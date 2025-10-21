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

export interface Annotation {
  id: string;
  type: string;
  motivation: string;
  body:
    | {
        type: string;
        purpose?: string;
        value?: string;
        id?: string;
        generator?: {
          id: string;
          type: string;
          label?: string;
        };
      }
    | any;
  target:
    | {
        source: string;
        type?: string;
        selector?: {
          type: string;
          value: string;
        };
        generator?: {
          id: string;
          type: string;
        };
      }
    | any;
  creator?: {
    id: string;
    type: string;
    label: string;
  };
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
