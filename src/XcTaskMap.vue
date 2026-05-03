<script setup lang="ts">
import XcTaskElevationProfile from './xc-task-map/XcTaskElevationProfile.vue';
import XcTaskMapCanvas from './xc-task-map/XcTaskMapCanvas.vue';
import XcTaskMapSidebar from './xc-task-map/XcTaskMapSidebar.vue';
import { useI18n } from 'vue-i18n';
import { renderMessageTemplate, xcTaskMapMessages } from './messages';
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

const { t } = useI18n({ useScope: 'global' });
const fallbackMessages: Record<string, string> = xcTaskMapMessages.en;

function tf(key: string, params: Record<string, unknown> = {}): string {
    const translated = t(key, params);

    if (translated !== key) {
        return translated;
    }

    const fallback = fallbackMessages[key] ?? key;
    return renderMessageTemplate(fallback, params);
}

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
    <div class="xc-task-map">
        <div class="xc-task-map__main">
            <button
                class="xc-task-map__toggle-button"
                type="button"
                @click="toggleSidebar"
            >
                {{ isSidebarOpen ? tf('xc-task-map.sidebar.toggle.hide') : tf('xc-task-map.sidebar.toggle.show') }}
            </button>
            <button
                class="xc-task-map__toggle-button xc-task-map__toggle-button--secondary"
                type="button"
                @click="toggleElevationOverlay"
            >
                {{ isElevationOverlayOpen ? tf('xc-task-map.elevation.toggle.hide') : tf('xc-task-map.elevation.toggle.show') }}
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
.xc-task-map {
    display: flex;
    height: 75vh;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    background: #fff;
}

.xc-task-map__main {
    position: relative;
    flex: 1;
    height: 100%;
}

.xc-task-map__toggle-button {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 10;
    padding: 0.375rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    background: #fff;
    color: #334155;
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.2;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
    cursor: pointer;

    &:hover {
        background: #f8fafc;
    }
}

.xc-task-map__toggle-button--secondary {
    top: 3.5rem;
}

</style>
