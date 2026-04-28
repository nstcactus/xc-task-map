<script setup lang="ts">
import {Chart, registerables} from 'chart.js';
import {getRelativePosition} from 'chart.js/helpers';
import {computed, markRaw, nextTick, onBeforeUnmount, ref, shallowRef, watch} from 'vue';
import {findNearestPointByX, formatTimeOfDay, formatUtcTime} from './utils';
import type {ChartTrack, HoveredProfilePointPayload, TimeDomain, TimelinePoint} from './types';

Chart.register(...registerables);

interface Props {
    isOpen: boolean;
    tracks: ChartTrack[];
    timeDomain: TimeDomain | null;
}

interface HoverEventPosition {
    x: number;
    y: number;
}

interface TooltipState {
    chartX: number;
    chartY: number;
    track: ChartTrack;
    point: TimelinePoint;
    elevationMeters: number;
    utcTime: string;
    localTime: string;
    timezoneOffsetSeconds: number;
}

const props = withDefaults(defineProps<Props>(), {
    isOpen: true,
    tracks: () => [],
    timeDomain: null,
});

const emit = defineEmits<{
    (event: 'hover-point', payload: HoveredProfilePointPayload): void;
    (event: 'clear-hovered-point'): void;
}>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
const elevationChart = shallowRef<Chart<'line'> | null>(null);
const tooltipState = ref<TooltipState | null>(null);

const tracksSignature = computed(() => props.tracks
        .map((track) => {
            const firstX = track.points[0]?.x ?? 'none';
            const lastX = track.points[track.points.length - 1]?.x ?? 'none';
            return `${track.index}:${track.points.length}:${firstX}:${lastX}:${track.color}`;
        })
        .join('|'));

function toPlainDatasets() {
    return props.tracks.map((track) => ({
        label: track.title,
        data: track.points.map((point) => ({x: Number(point.x), y: Number(point.y)})),
        borderColor: String(track.color),
        pointRadius: 0,
        borderWidth: 2,
        tension: 0,
    }));
}

function destroyChart(): void {
    if (!elevationChart.value) return;
    elevationChart.value.destroy();
    elevationChart.value = null;
}

function clearTooltipState(): void {
    tooltipState.value = null;
}

function resolveHoveredTrackPoint(chart: any, event: HoverEventPosition | null): void {
    if (!chart || !event || !props.tracks.length) {
        emit('clear-hovered-point');
        return;
    }

    const xScale = chart?.scales?.x;
    const yScale = chart?.scales?.y;
    if (!xScale || !yScale || typeof xScale.getValueForPixel !== 'function' || typeof yScale.getValueForPixel !== 'function') {
        emit('clear-hovered-point');
        return;
    }

    const chartArea = chart.chartArea;
    if (!chartArea) {
        emit('clear-hovered-point');
        return;
    }

    if (event.x < chartArea.left || event.x > chartArea.right || event.y < chartArea.top || event.y > chartArea.bottom) {
        emit('clear-hovered-point');
        return;
    }

    const xValue = xScale.getValueForPixel(event.x);
    const yValue = yScale.getValueForPixel(event.y);

    if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
        emit('clear-hovered-point');
        return;
    }

    let closest: (HoveredProfilePointPayload & { score: number }) | null = null;

    props.tracks.forEach((track) => {
        const point = findNearestPointByX(track.points, xValue);
        if (!point) return;

        const score = Math.abs(point.y - yValue);
        if (!closest || score < closest.score) {
            closest = {
                trackIndex: track.index,
                point: {...point},
                score,
            };
        }
    });

    if (!closest) {
        clearTooltipState();
        emit('clear-hovered-point');
        return;
    }

    const track = props.tracks.find((candidate) => candidate.index === closest.trackIndex);
    if (track) {
        const utcTime = formatUtcTime(closest.point.x);
        const localTime = formatUtcTime(closest.point.x + (track.timezoneOffsetSeconds * 1000));

        tooltipState.value = {
            chartX: event.x,
            chartY: event.y,
            track,
            point: {...closest.point},
            elevationMeters: Math.round(closest.point.y),
            utcTime,
            localTime,
            timezoneOffsetSeconds: track.timezoneOffsetSeconds ?? 0,
        };
    } else {
        clearTooltipState();
    }

    emit('hover-point', closest);
}

function handleChartMouseMove(event: MouseEvent): void {
    const chart = elevationChart.value;

    if (!event || !chartCanvas.value || !chart) {
        clearTooltipState();
        emit('clear-hovered-point');
        return;
    }

    let position: HoverEventPosition;

    try {
        position = getRelativePosition(event as any, chart as any) as HoverEventPosition;
    } catch (error) {
        // Fallback to DOM coordinates if Chart.js helper cannot resolve the native event.
        const rect = chartCanvas.value.getBoundingClientRect();
        position = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };

        console.error('Failed to resolve chart hover position:', error);
    }

    resolveHoveredTrackPoint(chart, position);
}

function syncElevationChart(): void {
    if (!props.isOpen || !chartCanvas.value) return;

    const datasets = toPlainDatasets();
    const shouldRecreate = !elevationChart.value || elevationChart.value.data.datasets.length !== datasets.length;

    if (shouldRecreate) {
        destroyChart();
        elevationChart.value = markRaw(new Chart(chartCanvas.value, {
            type: 'line',
            data: {datasets},
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                normalized: false,
                parsing: false,
                interaction: {
                    intersect: false,
                    mode: 'nearest',
                },
                scales: {
                    x: {
                        type: 'linear',
                        ticks: {
                            callback: (value) => formatUtcTime(Number(value)),
                            maxRotation: 0,
                            autoSkipPadding: 18,
                        },
                        title: {
                            display: true,
                            text: 'Heure UTC',
                        },
                    },
                    y: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Elevation (m)',
                        },
                    },
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    subtitle: {
                        display: false,
                    },
                    tooltip: {
                                enabled: false,
                        callbacks: {
                            title: (items) => {
                                const first = items[0];
                                if (!first) return '';
                                const datasetIndex = first.datasetIndex ?? 0;
                                const track = props.tracks[datasetIndex];
                                const offset = track?.timezoneOffsetSeconds ?? 0;
                                return formatTimeOfDay(first.parsed.x, offset);
                            },
                            label: (item) => {
                                const elevationMeters = Number(item.parsed?.y);
                                if (!Number.isFinite(elevationMeters)) return '';

                                const trackLabel = item.dataset?.label ? `${item.dataset.label}: ` : '';
                                return `${trackLabel}${Math.round(elevationMeters)} m`;
                            },
                        },
                    },
                },
            },
        }));
    }

    if (!elevationChart.value) return;

    elevationChart.value.data.datasets = datasets;
    const min = props.timeDomain?.min;
    const max = props.timeDomain?.max;
    const hasValidDomain = Number.isFinite(min) && Number.isFinite(max) && min < max;

    if (elevationChart.value.options.scales?.x) {
        elevationChart.value.options.scales.x.min = hasValidDomain ? min : undefined;
        elevationChart.value.options.scales.x.max = hasValidDomain ? max : undefined;
    }

    elevationChart.value.update('none');
}

watch([
    () => props.isOpen,
    tracksSignature,
    () => props.timeDomain?.min ?? null,
    () => props.timeDomain?.max ?? null,
], async () => {
    if (!props.isOpen) {
        clearTooltipState();
        emit('clear-hovered-point');
        destroyChart();
        return;
    }

    await nextTick();
    syncElevationChart();
});

watch(chartCanvas, () => {
    destroyChart();

    if (!props.isOpen) return;

    nextTick(() => {
        syncElevationChart();
    });
});

onBeforeUnmount(() => {
    clearTooltipState();
    destroyChart();
});
</script>

<template>
    <div
            v-if="props.isOpen"
            class="absolute bottom-0 left-0 right-0 z-10 h-48 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur"
    >
        <p v-if="!props.tracks.length" class="flex h-full items-center justify-center text-sm text-slate-500">
            Select at least one loaded track to display elevation timeline.
        </p>
        <canvas
                v-else
                ref="chartCanvas"
                class="h-full w-full"
                @mouseleave="() => { clearTooltipState(); emit('clear-hovered-point'); }"
                @mousemove="handleChartMouseMove"
        ></canvas>

        <div
            v-if="tooltipState"
            class="pointer-events-none absolute z-20 max-w-xs rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg"
            :style="{
                left: `${tooltipState.chartX + 16}px`,
                top: `${tooltipState.chartY - 16}px`,
                transform: 'translateY(-100%)',
            }"
        >
            <slot
                name="tooltip"
                :track="tooltipState.track"
                :point="tooltipState.point"
                :elevation-meters="tooltipState.elevationMeters"
                :utc-time="tooltipState.utcTime"
                :local-time="tooltipState.localTime"
                :timezone-offset-seconds="tooltipState.timezoneOffsetSeconds"
            >
                <p class="font-semibold text-slate-900">{{ tooltipState.track.title }}</p>
                <p>{{ tooltipState.elevationMeters }} m</p>
                <p>{{ tooltipState.localTime }} (local)</p>
                <p>{{ tooltipState.utcTime }} (UTC)</p>
            </slot>
        </div>
    </div>
</template>

<style lang="scss" scoped>

</style>
