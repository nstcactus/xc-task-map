import type { Component } from 'vue';

export interface XcTaskMapBounds {
  extend: (coordinate: [number, number]) => void;
  isEmpty: () => boolean;
}

export interface XcTaskMapAdapter {
  component: Component;
  getCanvasProps: (context: { accessToken?: string; mapAdapterProps?: Record<string, unknown> }) => Record<string, unknown>;
  getMapInstance: (componentRef: unknown) => unknown | null;
  onStyleLoad: (mapInstance: unknown, callback: () => void) => () => void;
  isStyleLoaded: (mapInstance: unknown) => boolean;
  createBounds: () => XcTaskMapBounds;
  fitBounds: (mapInstance: unknown, bounds: XcTaskMapBounds, options: Record<string, unknown>) => void;
  getSource: (mapInstance: unknown, sourceId: string) => unknown;
  addSource: (mapInstance: unknown, sourceId: string, source: Record<string, unknown>) => void;
  setSourceData: (source: unknown, data: Record<string, unknown>) => void;
  getLayer: (mapInstance: unknown, layerId: string) => unknown;
  addLayer: (mapInstance: unknown, layerConfig: Record<string, unknown>) => void;
  setLayoutProperty: (mapInstance: unknown, layerId: string, property: string, value: unknown) => void;
  setPaintProperty: (mapInstance: unknown, layerId: string, property: string, value: unknown) => void;
}
