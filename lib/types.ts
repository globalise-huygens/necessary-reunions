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

export interface SvgSelector {
  type: string;
  value: string;
}

export interface ParsedPolygon {
  points: number[][];
}
