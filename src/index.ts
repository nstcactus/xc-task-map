import XcTaskMap from './XcTaskMap.vue';

export { XcTaskMap };
export { useXcTaskMapStore } from './composables/useXcTaskMapStore';
export { mapboxAdapter } from './xc-task-map/adapters';
export type { XcTaskMapAdapter, XcTaskMapBounds } from './xc-task-map/adapters';
export type {
  ChartTrack,
  HoveredProfilePointPayload,
  NormalizedTrack,
  RawTrack,
  SidebarTab,
  TaskData,
  TaskLoader,
  TimeDomain,
  TimelinePoint,
  TrackColorResolver,
  TrackLoader,
  TrackState,
  Turnpoint,
  TurnpointType,
} from './xc-task-map/types';
