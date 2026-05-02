/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

declare module '@studiometa/vue-mapbox-gl' {
  import type { Component } from 'vue';
  export const MapboxMap: Component;
}
