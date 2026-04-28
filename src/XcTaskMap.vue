<script setup lang="ts">
import XcTaskElevationProfile from './xc-task-map/XcTaskElevationProfile.vue';
import XcTaskMapCanvas from './xc-task-map/XcTaskMapCanvas.vue';
import XcTaskMapSidebar from './xc-task-map/XcTaskMapSidebar.vue';
import { useXcTaskMapStore } from './composables/useXcTaskMapStore';
import type { XcTaskMapAdapter } from './xc-task-map/adapters';
import type { HoveredProfilePointPayload, RawTrack, TaskData, TaskLoader, TrackColorResolver, TrackLoader } from './xc-task-map/types';

interface Props {
    xctskFileUrl?: string;
    accessToken?: string;
    tracks?: RawTrack[] | string;
    taskData?: TaskData | string;
    loadTask?: TaskLoader;
    loadTrack?: TrackLoader;
    trackColorResolver?: TrackColorResolver;
    mapAdapter?: XcTaskMapAdapter;
    mapAdapterProps?: Record<string, unknown>;
}

const props = withDefaults(defineProps<Props>(), {
    tracks: () => [],
});

const {
    activeTab,
    chartTimeDomain,
    clearHoveredTrackPoint,
    clearHoveredTurnpoint,
    handleMapStyleLoad,
    hoveredTurnpointIndex,
    isElevationOverlayOpen,
    isLoading,
    isSidebarOpen,
    loadError,
    normalizedTracks,
    selectedChartTracks,
    setHoveredTrackPoint,
    setHoveredTurnpoint,
    setMapInstance,
    toggleElevationOverlay,
    toggleSidebar,
    toggleTrack,
    trackStates,
    turnpoints,
} = useXcTaskMapStore(props);

function handleHoveredProfilePoint(payload: HoveredProfilePointPayload): void {
    setHoveredTrackPoint(payload.trackIndex, payload.point);
}

function handleMapReady(instance: unknown): void {
    setMapInstance(instance as any);
}
</script>

<template>
    <div class="flex h-[75vh] overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div class="relative h-full flex-1">
            <button
                class="absolute right-3 top-3 z-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                type="button"
                @click="toggleSidebar"
            >
                {{ isSidebarOpen ? 'Hide sidebar' : 'Show sidebar' }}
            </button>
            <button
                class="absolute right-3 top-14 z-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                type="button"
                @click="toggleElevationOverlay"
            >
                {{ isElevationOverlayOpen ? 'Hide elevation' : 'Show elevation' }}
            </button>

            <XcTaskMapCanvas
                :access-token="props.accessToken"
                :map-adapter="props.mapAdapter"
                :map-adapter-props="props.mapAdapterProps"
                @map-ready="handleMapReady"
                @style-load="handleMapStyleLoad"
            />

            <XcTaskElevationProfile
                :is-open="isElevationOverlayOpen"
                :tracks="selectedChartTracks"
                :time-domain="chartTimeDomain"
                @hover-point="handleHoveredProfilePoint"
                @clear-hovered-point="clearHoveredTrackPoint"
            >
                <template #tooltip="slotProps">
                    <slot name="tooltip" v-bind="slotProps" />
                </template>
            </XcTaskElevationProfile>
        </div>

        <XcTaskMapSidebar
            :is-open="isSidebarOpen"
            :active-tab="activeTab"
            :turnpoints="turnpoints"
            :is-loading="isLoading"
            :load-error="loadError"
            :normalized-tracks="normalizedTracks"
            :track-states="trackStates"
            :hovered-turnpoint-index="hoveredTurnpointIndex"
            @update:active-tab="activeTab = $event"
            @toggle-track="toggleTrack"
            @hover-turnpoint="setHoveredTurnpoint"
            @clear-hovered-turnpoint="clearHoveredTurnpoint"
        >
            <template #loading="slotProps">
                <slot name="loading" v-bind="slotProps" />
            </template>
            <template #error="slotProps">
                <slot name="error" v-bind="slotProps" />
            </template>
            <template #empty-turnpoints="slotProps">
                <slot name="empty-turnpoints" v-bind="slotProps" />
            </template>
            <template #empty-tracks="slotProps">
                <slot name="empty-tracks" v-bind="slotProps" />
            </template>
            <template #track-item="slotProps">
                <slot name="track-item" v-bind="slotProps" />
            </template>
        </XcTaskMapSidebar>
    </div>
</template>

<style scoped lang="scss">

</style>
