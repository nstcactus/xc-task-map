<script setup lang="ts">
import { renderMessageTemplate, xcTaskMapMessages } from '../messages';
import { getTurnpointLabel } from './utils';
import { useI18n } from 'vue-i18n';
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
</script>

<template>
    <aside
        class="xc-task-map-sidebar"
        :class="{ 'is-open': props.isOpen, 'is-closed': !props.isOpen }"
    >
        <div class="xc-task-map-sidebar__header">
            <div class="xc-task-map-sidebar__tabs">
                <button
                    type="button"
                    class="xc-task-map-sidebar__tab-button"
                    :class="{ 'is-active': props.activeTab === 'turnpoints' }"
                    @click="emit('update:activeTab', 'turnpoints')"
                >
                    {{ tf('xc-task-map.sidebar.tabs.turnpoints') }}
                </button>
                <button
                    type="button"
                    class="xc-task-map-sidebar__tab-button"
                    :class="{ 'is-active': props.activeTab === 'tracks' }"
                    @click="emit('update:activeTab', 'tracks')"
                >
                    {{ tf('xc-task-map.sidebar.tabs.tracks') }}
                </button>
            </div>
            <p class="xc-task-map-sidebar__meta" v-if="props.activeTab === 'tracks'">{{ tf('xc-task-map.sidebar.meta.available', { n: props.normalizedTracks.length }) }}</p>
        </div>

        <div class="xc-task-map-sidebar__content" v-if="props.activeTab === 'turnpoints'">
            <slot name="loading" v-if="props.isLoading">
                <p class="xc-task-map-sidebar__state-message">{{ tf('xc-task-map.sidebar.loading') }}</p>
            </slot>
            <slot name="error" v-else-if="props.loadError" :error="props.loadError">
                <p class="xc-task-map-sidebar__state-message xc-task-map-sidebar__state-message--error">{{ props.loadError }}</p>
            </slot>
            <slot name="empty-turnpoints" v-else-if="!props.turnpoints.length">
                <p class="xc-task-map-sidebar__state-message">{{ tf('xc-task-map.sidebar.empty-turnpoints') }}</p>
            </slot>

            <ul v-else class="xc-task-map-sidebar__list">
                <li v-for="(turnpoint, index) in props.turnpoints"
                    :key="`tp-${index}`"
                    class="xc-task-map-sidebar__turnpoint-item"
                    :class="{ 'is-hovered': props.hoveredTurnpointIndex === index }"
                    @mouseenter="emit('hover-turnpoint', index)"
                    @mouseleave="emit('clear-hovered-turnpoint')"
                >
                    <p class="xc-task-map-sidebar__turnpoint-title">{{ getTurnpointLabel(turnpoint, index) }}</p>
                    <p class="xc-task-map-sidebar__turnpoint-meta">
                        {{ turnpoint?.radius || 0 }} m
                        -
                        {{ turnpoint?.waypoint?.lat?.toFixed?.(5) ?? 'n/a' }}, {{ turnpoint?.waypoint?.lon?.toFixed?.(5) ?? 'n/a' }}
                    </p>
                </li>
            </ul>
        </div>

        <div class="xc-task-map-sidebar__content" v-else>
            <slot name="empty-tracks" v-if="!props.normalizedTracks.length">
                <p class="xc-task-map-sidebar__state-message">{{ tf('xc-task-map.sidebar.empty-tracks') }}</p>
            </slot>

            <ul v-else class="xc-task-map-sidebar__list">
                <li v-for="(track, index) in props.normalizedTracks"
                    :key="`track-${track.contestId}-${index}`"
                    class="xc-task-map-sidebar__track-item"
                >
                    <slot
                        name="track-item"
                        :track="track"
                        :index="index"
                        :track-state="props.trackStates[index]"
                        :toggle-track="() => emit('toggle-track', index)"
                    >
                        <div class="xc-task-map-sidebar__track-row">
                            <div class="xc-task-map-sidebar__track-main">
                                <div class="xc-task-map-sidebar__track-heading">
                                    <span class="xc-task-map-sidebar__track-dot" :style="{ backgroundColor: props.trackStates[index]?.color }"></span>
                                    <p class="xc-task-map-sidebar__track-pilot">{{ track.pilot }}</p>
                                </div>
                                <p class="xc-task-map-sidebar__track-date">{{ track.date }}</p>
                                <p class="xc-task-map-sidebar__track-meta" v-if="props.trackStates[index]?.maxGpsAltitude != null">
                                    {{ tf('xc-task-map.sidebar.track.max-gps-alt', { n: Math.round(props.trackStates[index].maxGpsAltitude) }) }}
                                </p>
                                <p v-if="props.trackStates[index]?.error" class="xc-task-map-sidebar__track-error">{{ props.trackStates[index].error }}</p>
                            </div>

                            <div class="xc-task-map-sidebar__track-actions">
                                <svg v-if="props.trackStates[index]?.loading" class="xc-task-map-sidebar__spinner" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                                </svg>
                                <input
                                    type="checkbox"
                                    class="xc-task-map-sidebar__track-toggle"
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
.xc-task-map-sidebar {
    flex-shrink: 0;
    overflow: hidden;
    background: #f8fafc;
    border-left: 1px solid #e2e8f0;
    transition: width 0.3s ease-in-out, opacity 0.3s ease-in-out;

    &.is-open {
        width: 20rem;
        opacity: 1;
        pointer-events: auto;
    }

    &.is-closed {
        width: 0;
        opacity: 0;
        border-left: 0;
        pointer-events: none;
    }
}

.xc-task-map-sidebar__header {
    padding: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
}

.xc-task-map-sidebar__tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
    padding: 0.25rem;
    border-radius: 0.375rem;
    background: #f1f5f9;
}

.xc-task-map-sidebar__tab-button {
    padding: 0.25rem 0.5rem;
    border: 0;
    border-radius: 0.25rem;
    background: transparent;
    color: #475569;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;

    &:hover {
        color: #0f172a;
    }

    &.is-active {
        background: #fff;
        color: #0f172a;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
    }
}

.xc-task-map-sidebar__meta {
    margin: 0.5rem 0 0;
    padding: 0 0.5rem;
    color: #64748b;
    font-size: 0.75rem;
}

.xc-task-map-sidebar__content {
    height: calc(75vh - 70px);
    padding: 0.75rem;
    overflow-y: auto;
}

.xc-task-map-sidebar__state-message {
    margin: 0;
    color: #64748b;
    font-size: 0.875rem;
}

.xc-task-map-sidebar__state-message--error {
    color: #dc2626;
}

.xc-task-map-sidebar__list {
    margin: 0;
    padding: 0;
    list-style: none;

    > li + li {
        margin-top: 0.5rem;
    }
}

.xc-task-map-sidebar__turnpoint-item,
.xc-task-map-sidebar__track-item {
    padding: 0.5rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    background: #fff;
}

.xc-task-map-sidebar__turnpoint-item {
    transition: border-color 0.15s ease, background-color 0.15s ease;

    &.is-hovered {
        border-color: #94a3b8;
        background: #f1f5f9;
    }
}

.xc-task-map-sidebar__turnpoint-title {
    margin: 0;
    color: #1e293b;
    font-size: 0.875rem;
    font-weight: 500;
}

.xc-task-map-sidebar__turnpoint-meta {
    margin: 0;
    color: #64748b;
    font-size: 0.75rem;
}

.xc-task-map-sidebar__track-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
}

.xc-task-map-sidebar__track-main {
    min-width: 0;
}

.xc-task-map-sidebar__track-heading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.xc-task-map-sidebar__track-dot {
    display: inline-block;
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
}

.xc-task-map-sidebar__track-pilot,
.xc-task-map-sidebar__track-title,
.xc-task-map-sidebar__track-meta,
.xc-task-map-sidebar__track-error {
    margin: 0;
}

.xc-task-map-sidebar__track-pilot {
    overflow: hidden;
    color: #1e293b;
    font-size: 0.875rem;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.xc-task-map-sidebar__track-title,
.xc-task-map-sidebar__track-meta {
    overflow: hidden;
    color: #64748b;
    font-size: 0.75rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.xc-task-map-sidebar__track-meta,
.xc-task-map-sidebar__track-error {
    margin-top: 0.25rem;
}

.xc-task-map-sidebar__track-error {
    color: #dc2626;
    font-size: 0.75rem;
}

.xc-task-map-sidebar__track-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.xc-task-map-sidebar__spinner {
    width: 1rem;
    height: 1rem;
    color: #64748b;
    animation: xc-task-map-sidebar-spin 1s linear infinite;
}

.xc-task-map-sidebar__track-toggle {
    width: 1rem;
    height: 1rem;
    margin: 0;
    accent-color: #0f172a;
    cursor: pointer;

    &:disabled {
        cursor: not-allowed;
    }
}

@keyframes xc-task-map-sidebar-spin {
    to {
        transform: rotate(360deg);
    }
}

</style>
