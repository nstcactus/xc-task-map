declare module '@mapbox/timespace' {
  export interface Moment {
    _z?: {
      name: string;
    };
  }

  export function getFuzzyLocalTimeFromPoint(
    timestamp: number,
    coordinates: [longitude: number, latitude: number]
  ): Moment | undefined;
}
