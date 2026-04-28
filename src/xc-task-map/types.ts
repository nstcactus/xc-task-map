export type SidebarTab = 'turnpoints' | 'tracks';

export type TurnpointType = 'TakeOff' | 'SSS' | 'ESS' | 'Goal' | 'Regular' | string;

export interface TurnpointWaypoint {
    name?: string;
    lat?: number;
    lon?: number;
}

export interface Turnpoint {
    type?: TurnpointType;
    radius?: number;
    waypoint?: TurnpointWaypoint;
}

export interface TimelinePoint {
    x: number;
    y: number;
    lng: number;
    lat: number;
}

export interface RawTrack {
    title?: string;
    trackURL?: string;
    igcText?: string;
    pilot?: string;
    contestId?: number | string;
}

export interface NormalizedTrack {
    title: string;
    trackURL: string;
    igcText: string;
    pilot: string;
    contestId: number;
}

export interface TaskData {
    turnpoints?: Turnpoint[];
}

export type TrackColorResolver = (track: NormalizedTrack, index: number) => string;

export type TaskLoader = () => Promise<TaskData>;

export type TrackLoader = (track: NormalizedTrack, index: number) => Promise<string>;

export interface TrackState {
    visible: boolean;
    loading: boolean;
    loaded: boolean;
    error: string;
    maxGpsAltitude: number | null;
    timelinePoints: TimelinePoint[];
    color: string;
  timezoneOffsetSeconds: number;
}

export interface ChartTrack {
    index: number;
    title: string;
    color: string;
    points: TimelinePoint[];
  timezoneOffsetSeconds: number;
}

export interface TimeDomain {
    min: number;
    max: number;
}

export interface HoveredProfilePointPayload {
    trackIndex: number;
    point: TimelinePoint;
}
