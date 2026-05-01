<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { mapboxAdapter } from './adapters';
import type { XcTaskMapAdapter } from './adapters';

interface Props {
    accessToken?: string;
    mapAdapter?: XcTaskMapAdapter;
    mapAdapterProps?: Record<string, unknown>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (event: 'map-ready', map: unknown): void;
    (event: 'style-load'): void;
}>();

const map = ref<unknown>(null);
const adapter = computed(() => props.mapAdapter || mapboxAdapter);
const canvasProps = computed(() => adapter.value.getCanvasProps({
    accessToken: props.accessToken,
    mapAdapterProps: props.mapAdapterProps,
}));

onMounted(async () => {
    await nextTick();

    const mapInstance = adapter.value.getMapInstance(map.value);
    if (!mapInstance) return;

    emit('map-ready', mapInstance);

    const handleStyleLoad = (): void => {
        emit('style-load');
    };

    if (adapter.value.isStyleLoaded(mapInstance)) {
        handleStyleLoad();
    }

    const disposeStyleLoad = adapter.value.onStyleLoad(mapInstance, handleStyleLoad);

    onBeforeUnmount(() => {
        disposeStyleLoad();
    });
});
</script>

<template>
    <component
        :is="adapter.component"
        ref="map"
        class="xc-task-map-canvas"
        v-bind="canvasProps"
    />
</template>

<style lang="scss">
.xc-task-map-canvas {
    width: 100%;
    height: 100%;
}

</style>
