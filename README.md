# xc-task-map

`xc-task-map` is a Vue 3 component package to display XC tasks (XCTSK) and flight tracks (IGC) with an elevation profile, slots, i18n-ready text overrides, and pluggable map adapters.

## Install

```bash
npm install xc-task-map
```

## Basic Usage

```vue
<script setup lang="ts">
import { XcTaskMap } from 'xc-task-map';

const tracks = [
  {
    title: 'Track 1',
    pilot: 'Jane Doe',
    contestId: 42,
    trackURL: 'https://example.com/track.igc',
  },
];
</script>

<template>
  <XcTaskMap
    access-token="YOUR_MAPBOX_TOKEN"
    xctsk-file-url="https://example.com/task.xctsk"
    :tracks="tracks"
  />
</template>
```

## XC Task Only

You can render only task turnpoints and optimized path by providing only task data.

```vue
<script setup lang="ts">
import { XcTaskMap } from 'xc-task-map';

const taskData = {
  turnpoints: [
    {
      type: 'TakeOff',
      radius: 100,
      waypoint: { name: 'TO', lat: 45.9, lon: 6.7 },
    },
  ],
};
</script>

<template>
  <XcTaskMap
    access-token="YOUR_MAPBOX_TOKEN"
    :task-data="taskData"
    :tracks="[]"
  />
</template>
```

## Flight Tracks Only

You can hide task input and only display tracks.

```vue
<script setup lang="ts">
import { XcTaskMap } from 'xc-task-map';

const tracks = [
  {
    title: 'Pilot A',
    pilot: 'Pilot A',
    contestId: 1,
    igcText: 'AXXX...IGC CONTENT...',
  },
];
</script>

<template>
  <XcTaskMap
    access-token="YOUR_MAPBOX_TOKEN"
    :tracks="tracks"
  />
</template>
```

## Slots

Available slots:

- `tooltip`
- `loading`
- `error`
- `empty-turnpoints`
- `empty-tracks`
- `track-item`

```vue
<XcTaskMap :tracks="tracks" :task-data="taskData" access-token="YOUR_MAPBOX_TOKEN">
  <template #tooltip="{ track, elevationMeters, localTime, utcTime }">
    <div>
      <strong>{{ track.title }}</strong><br>
      {{ elevationMeters }} m<br>
      {{ localTime }} / {{ utcTime }}
    </div>
  </template>

  <template #track-item="{ track, trackState, toggleTrack }">
    <button type="button" @click="toggleTrack">
      {{ track.pilot }} - {{ trackState?.visible ? 'Hide' : 'Show' }}
    </button>
  </template>
</XcTaskMap>
```

## i18n

Current text is slot-overridable for state messages and tooltip content. For labels outside slots (for example toggle buttons and tab labels), pass localized wrappers around this component or provide a translated forked wrapper until dedicated `messages` prop is introduced.

## Alternative Map Adapter

Use the built-in `mapboxAdapter` by default, or pass a custom adapter implementing `XcTaskMapAdapter`.

```ts
import { mapboxAdapter, type XcTaskMapAdapter } from 'xc-task-map';

const adapter: XcTaskMapAdapter = mapboxAdapter;
```

```vue
<XcTaskMap
  :map-adapter="adapter"
  :map-adapter-props="{
    mapStyle: 'mapbox://styles/mapbox/light-v11',
    center: [6.7, 45.9],
    zoom: 10,
  }"
/>
```

## Data Input Strategies

This package supports both approaches:

1. Direct data (`taskData`, `tracks`, `igcText`)
2. Delegated loading (`loadTask`, `loadTrack`)

`loadTrack` receives `(normalizedTrack, index)` and should resolve to IGC text.

## API Highlights

- `xctskFileUrl?: string`
- `taskData?: TaskData | string`
- `loadTask?: () => Promise<TaskData>`
- `tracks?: RawTrack[] | string`
- `loadTrack?: (track, index) => Promise<string>`
- `trackColorResolver?: (normalizedTrack, index) => string`
- `mapAdapter?: XcTaskMapAdapter`
- `mapAdapterProps?: Record<string, unknown>`

## Build

```bash
npm run build
```

## Smoke Test

```bash
npm run smoke
```
