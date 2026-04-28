<script setup lang="ts">
import { getTurnpointLabel } from './utils';
import type { NormalizedTrack, SidebarTab, TrackState, Turnpoint } from './types';

interface Props {
    isOpen: boolean;
    activeTab: SidebarTab;
    turnpoints: Turnpoint[];
    isLoading: boolean;
    loadError: string;
    normalizedTracks: NormalizedTrack[];
    trackStates: TrackState[];
    hoveredTurnpointIndex: number | null;
}

const props = withDefaults(defineProps<Props>(), {
    isOpen: true,
    activeTab: 'turnpoints',
    turnpoints: () => [],
    isLoading: false,
    loadError: '',
    normalizedTracks: () => [],
    trackStates: () => [],
    hoveredTurnpointIndex: null,
});

const emit = defineEmits<{
    (event: 'update:activeTab', tab: SidebarTab): void;
    (event: 'toggle-track', index: number): void;
    (event: 'hover-turnpoint', index: number): void;
    (event: 'clear-hovered-turnpoint'): void;
}>();
</script>

<template>
    <aside
        class="shrink-0 overflow-hidden bg-slate-50 transition-all duration-300 ease-in-out"
        :class="props.isOpen ? 'w-80 border-l border-slate-200 opacity-100' : 'w-0 border-l-0 opacity-0 pointer-events-none'"
    >
        <div class="border-b border-slate-200 px-2 py-2">
            <div class="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
                <button
                    type="button"
                    class="rounded px-2 py-1 text-xs font-semibold"
                    :class="props.activeTab === 'turnpoints' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
                    @click="emit('update:activeTab', 'turnpoints')"
                >
                    Turnpoints
                </button>
                <button
                    type="button"
                    class="rounded px-2 py-1 text-xs font-semibold"
                    :class="props.activeTab === 'tracks' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
                    @click="emit('update:activeTab', 'tracks')"
                >
                    Tracks
                </button>
            </div>
            <p class="mt-2 px-2 text-xs text-slate-500" v-if="props.activeTab === 'turnpoints'">{{ props.turnpoints.length }} loaded</p>
            <p class="mt-2 px-2 text-xs text-slate-500" v-else>{{ props.normalizedTracks.length }} available</p>
        </div>

        <div class="h-[calc(75vh-70px)] overflow-y-auto p-3" v-if="props.activeTab === 'turnpoints'">
            <slot name="loading" v-if="props.isLoading">
                <p class="text-sm text-slate-500">Loading task...</p>
            </slot>
            <slot name="error" v-else-if="props.loadError" :error="props.loadError">
                <p class="text-sm text-red-600">{{ props.loadError }}</p>
            </slot>
            <slot name="empty-turnpoints" v-else-if="!props.turnpoints.length">
                <p class="text-sm text-slate-500">No turnpoints available.</p>
            </slot>

            <ul v-else class="space-y-2">
                <li v-for="(turnpoint, index) in props.turnpoints"
                    :key="`tp-${index}`"
                    class="rounded-lg border border-slate-200 bg-white px-3 py-2 transition-colors duration-150"
                    :class="props.hoveredTurnpointIndex === index ? 'border-slate-400 bg-slate-100' : ''"
                    @mouseenter="emit('hover-turnpoint', index)"
                    @mouseleave="emit('clear-hovered-turnpoint')"
                >
                    <p class="text-sm font-medium text-slate-800">{{ getTurnpointLabel(turnpoint, index) }}</p>
                    <p class="text-xs text-slate-500">
                        {{ turnpoint?.radius || 0 }} m
                        -
                        {{ turnpoint?.waypoint?.lat?.toFixed?.(5) ?? 'n/a' }}, {{ turnpoint?.waypoint?.lon?.toFixed?.(5) ?? 'n/a' }}
                    </p>
                </li>
            </ul>
        </div>

        <div class="h-[calc(75vh-70px)] overflow-y-auto p-3" v-else>
            <slot name="empty-tracks" v-if="!props.normalizedTracks.length">
                <p class="text-sm text-slate-500">No tracks available.</p>
            </slot>

            <ul v-else class="space-y-2">
                <li v-for="(track, index) in props.normalizedTracks"
                    :key="`track-${track.contestId}-${index}`"
                    class="rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                    <slot
                        name="track-item"
                        :track="track"
                        :index="index"
                        :track-state="props.trackStates[index]"
                        :toggle-track="() => emit('toggle-track', index)"
                    >
                        <div class="flex items-start justify-between gap-2">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: props.trackStates[index]?.color }"></span>
                                    <p class="truncate text-sm font-medium text-slate-800">{{ track.pilot }}</p>
                                </div>
                                <p class="truncate text-xs text-slate-500">{{ track.title }}</p>
                                <p class="mt-1 text-xs text-slate-500" v-if="props.trackStates[index]?.maxGpsAltitude !== null">
                                    Max GPS alt: {{ Math.round(props.trackStates[index].maxGpsAltitude) }} m
                                </p>
                                <p v-if="props.trackStates[index]?.error" class="mt-1 text-xs text-red-600">{{ props.trackStates[index].error }}</p>
                            </div>

                            <div class="flex items-center gap-2">
                                <svg v-if="props.trackStates[index]?.loading" class="h-4 w-4 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                                </svg>
                                <input
                                    type="checkbox"
                                    class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                    :checked="props.trackStates[index]?.visible"
                                    :disabled="props.trackStates[index]?.loading"
                                    @change="emit('toggle-track', index)"
                                >
                            </div>
                        </div>
                    </slot>
                </li>
            </ul>
        </div>
    </aside>
</template>

<style scoped lang="scss">

</style>
