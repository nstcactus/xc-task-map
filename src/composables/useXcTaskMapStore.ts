import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import * as IGCParser from 'igc-parser';
import { optimizeTask } from 'xc-task-optimizer';
import { mapboxAdapter, type XcTaskMapAdapter } from '../xc-task-map/adapters';
import {
	buildTimelinePoints,
	createGeoJSONCircle,
	getPointBorderColor,
	getPointColor,
	getPointTypeForDisplay,
	getTrackColor,
	getTrackKey,
	getTrackLayerId,
	getTrackSourceId,
	mapToOptimizerType,
} from '../xc-task-map/utils';
import {
	getIanaTimeZoneFromCoordinates,
	getUtcOffsetSecondsAtTimestamp,
} from '../xc-task-map/timezone';
import type {
	ChartTrack,
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
} from '../xc-task-map/types';

const TRACK_HOVER_SOURCE_ID = 'track-hover-point';
const TRACK_HOVER_LAYER_ID = 'track-hover-point-circle';

function getFixTimestampMs(fix: ParsedIgcFix): number | null {
	const timestamp = fix?.timestamp;

	if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
		return timestamp;
	}

	if (timestamp instanceof Date && Number.isFinite(timestamp.getTime())) {
		return timestamp.getTime();
	}

	if (typeof timestamp === 'string' && timestamp.trim()) {
		const parsed = new Date(timestamp).getTime();
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

interface UseXcTaskMapStoreProps {
	xctskFileUrl?: string;
	accessToken?: string;
	tracks?: RawTrack[] | string;
	taskData?: TaskData | string;
	loadTask?: TaskLoader;
	loadTrack?: TrackLoader;
	trackColorResolver?: TrackColorResolver;
	mapAdapter?: XcTaskMapAdapter;
}

interface ParsedIgcFix {
	longitude?: number;
	latitude?: number;
	gpsAltitude?: number;
	pressureAltitude?: number;
	timestamp?: number | string | Date;
	time?: number | string;
}

interface ParsedIgc {
	fixes?: ParsedIgcFix[];
}

interface OptimizerTurnpoint {
	lat: number;
	lng: number;
	radius: number;
	type: ReturnType<typeof mapToOptimizerType>;
	name: string;
}

interface OptimizedTaskPath {
	optimizedPoints: Array<{ lat: number; lng: number }>;
	geodesicDistanceMeters: number;
	planarDistanceMeters: number;
}

interface StoreApi {
	activeTab: Ref<SidebarTab>;
	chartTimeDomain: ComputedRef<TimeDomain | null>;
	clearHoveredTrackPoint: () => void;
	clearHoveredTurnpoint: () => void;
	fetchAndDrawTask: () => Promise<void>;
	handleMapStyleLoad: () => void;
	hoveredTurnpointIndex: Ref<number | null>;
	isElevationOverlayOpen: Ref<boolean>;
	isLoading: Ref<boolean>;
	isSidebarOpen: Ref<boolean>;
	loadError: Ref<string>;
	normalizedTracks: ComputedRef<NormalizedTrack[]>;
	selectedChartTracks: ComputedRef<ChartTrack[]>;
	setHoveredTrackPoint: (trackIndex: number, point: TimelinePoint) => void;
	setHoveredTurnpoint: (index: number) => void;
	setMapInstance: (instance: unknown) => void;
	toggleElevationOverlay: () => void;
	toggleSidebar: () => void;
	toggleTrack: (index: number) => Promise<void>;
	trackStates: Ref<TrackState[]>;
	turnpoints: Ref<Turnpoint[]>;
}

export function useXcTaskMapStore(props: UseXcTaskMapStoreProps): StoreApi {
	const mapInstance = ref<unknown | null>(null);
	const resolvedMapAdapter = computed<XcTaskMapAdapter>(() => props.mapAdapter || mapboxAdapter);
	const turnpoints = ref<Turnpoint[]>([]);
	const isLoading = ref(false);
	const loadError = ref('');
	const isSidebarOpen = ref(true);
	const hoveredTurnpointIndex = ref<number | null>(null);
	const activeTab = ref<SidebarTab>('turnpoints');
	const trackStates = ref<TrackState[]>([]);
	const isElevationOverlayOpen = ref(true);

	const parsedTracks = computed<RawTrack[]>(() => {
		if (Array.isArray(props.tracks)) return props.tracks;

		if (typeof props.tracks === 'string' && props.tracks.trim()) {
			try {
				return JSON.parse(props.tracks) as RawTrack[];
			} catch (error) {
				console.error('Failed to parse tracks prop JSON:', error);
				return [];
			}
		}

		return [];
	});

	const normalizedTracks = computed<NormalizedTrack[]>(() => parsedTracks.value.map((track, index) => ({
		date: track.date,
		trackURL: String(track?.trackURL ?? ''),
		igcText: String(track?.igcText ?? ''),
		pilot: String(track?.pilot ?? ''),
		contestId: Number(track?.contestId),
	})));

	watch(normalizedTracks, (tracks, previousTracks: NormalizedTrack[] = []) => {
		const previousStateByKey = new Map<string, TrackState | undefined>();

		previousTracks.forEach((track, index) => {
			previousStateByKey.set(getTrackKey(track, index), trackStates.value[index]);
		});

		trackStates.value = tracks.map((track, index) => {
			const previousState = previousStateByKey.get(getTrackKey(track, index));
			const fallbackColor = props.trackColorResolver?.(track, index) || getTrackColor(track.contestId, index);

			if (!previousState) {
				return {
					visible: false,
					loading: false,
					loaded: false,
					error: '',
					maxGpsAltitude: null,
					timelinePoints: [],
					color: fallbackColor,
					timezoneOffsetSeconds: 0,
				};
			}

			return {
				...previousState,
				color: previousState.color || fallbackColor,
				timelinePoints: Array.isArray(previousState.timelinePoints) ? previousState.timelinePoints : [],
			};
		});
	}, { immediate: true });

	const selectedChartTracks = computed<ChartTrack[]>(() => trackStates.value
		.map((state, index) => ({
			index,
			title: normalizedTracks.value[index]?.pilot || `Track ${index + 1}`,
			date: normalizedTracks.value[index]?.date,
			color: state?.color,
			points: Array.isArray(state?.timelinePoints) ? state.timelinePoints : [],
			timezoneOffsetSeconds: state?.timezoneOffsetSeconds ?? 0,
		}))
		.filter((track) => {
			const state = trackStates.value[track.index];
			return Boolean(state?.visible && state?.loaded && track.points.length);
		}));

	const chartTimeDomain = computed<TimeDomain | null>(() => {
		if (!selectedChartTracks.value.length) return null;

		let min = Number.POSITIVE_INFINITY;
		let max = Number.NEGATIVE_INFINITY;

		selectedChartTracks.value.forEach((track) => {
			track.points.forEach((point) => {
				if (!Number.isFinite(point?.x)) return;
				min = Math.min(min, point.x);
				max = Math.max(max, point.x);
			});
		});

		if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
			return null;
		}

		return { min, max };
	});


	function setMapInstance(instance: unknown): void {
		mapInstance.value = instance;
	}

	function toggleSidebar(): void {
		isSidebarOpen.value = !isSidebarOpen.value;
	}

	function toggleElevationOverlay(): void {
		isElevationOverlayOpen.value = !isElevationOverlayOpen.value;
		if (!isElevationOverlayOpen.value) {
			clearHoveredTrackPoint();
		}
	}

	function ensureHoveredTrackPointLayer(): void {
		if (!mapInstance.value || !resolvedMapAdapter.value.isStyleLoaded(mapInstance.value)) return;

		if (!resolvedMapAdapter.value.getSource(mapInstance.value, TRACK_HOVER_SOURCE_ID)) {
			resolvedMapAdapter.value.addSource(mapInstance.value, TRACK_HOVER_SOURCE_ID, {
				type: 'geojson',
				data: {
					type: 'FeatureCollection',
					features: [],
				},
			});
		}

		if (!resolvedMapAdapter.value.getLayer(mapInstance.value, TRACK_HOVER_LAYER_ID)) {
			resolvedMapAdapter.value.addLayer(mapInstance.value, {
				id: TRACK_HOVER_LAYER_ID,
				type: 'circle',
				source: TRACK_HOVER_SOURCE_ID,
				paint: {
					'circle-radius': 10,
					'circle-color': ['coalesce', ['get', 'color'], '#111827'],
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 1,
				},
				layout: {
					visibility: 'none',
				},
			});
		}
	}

	function setHoveredTrackPoint(trackIndex: number, point: TimelinePoint): void {
		const color = trackStates.value[trackIndex]?.color;

		if (!mapInstance.value || !point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) return;
		if (!resolvedMapAdapter.value.isStyleLoaded(mapInstance.value)) return;

		try {
			ensureHoveredTrackPointLayer();

			const source = resolvedMapAdapter.value.getSource(mapInstance.value, TRACK_HOVER_SOURCE_ID);
			if (!source) return;

			resolvedMapAdapter.value.setSourceData(source, {
				type: 'FeatureCollection',
				features: [{
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: [point.lng, point.lat],
					},
					properties: {
						color,
					},
				}],
			});

			if (resolvedMapAdapter.value.getLayer(mapInstance.value, TRACK_HOVER_LAYER_ID)) {
				resolvedMapAdapter.value.setLayoutProperty(mapInstance.value, TRACK_HOVER_LAYER_ID, 'visibility', 'visible');
			}
		} catch (error) {
			console.error('Failed to update hovered track point layer:', error);
		}
	}

	function clearHoveredTrackPoint(): void {
		if (!mapInstance.value || !resolvedMapAdapter.value.isStyleLoaded(mapInstance.value)) return;

		try {
			if (!resolvedMapAdapter.value.getLayer(mapInstance.value, TRACK_HOVER_LAYER_ID)) return;

			resolvedMapAdapter.value.setLayoutProperty(mapInstance.value, TRACK_HOVER_LAYER_ID, 'visibility', 'none');
		} catch (error) {
			console.error('Failed to clear hovered track point layer:', error);
		}
	}

	function setTrackVisibility(index: number, visible: boolean): void {
		const layerId = getTrackLayerId(index);

		if (!mapInstance.value || !resolvedMapAdapter.value.getLayer(mapInstance.value, layerId)) return;

		resolvedMapAdapter.value.setLayoutProperty(mapInstance.value, layerId, 'visibility', visible ? 'visible' : 'none');
	}

	function applyTurnpointHighlightStyles(): void {
		if (!mapInstance.value) return;

		turnpoints.value.forEach((point, index) => {
			const fillLayerId = `task-point-circle-${index}`;
			const borderLayerId = `task-point-circle-border-${index}`;
			const pointType = getPointTypeForDisplay(point, index, turnpoints.value.length);
			const isHovered = hoveredTurnpointIndex.value === index;

			if (mapInstance.value && resolvedMapAdapter.value.getLayer(mapInstance.value, fillLayerId)) {
				resolvedMapAdapter.value.setPaintProperty(mapInstance.value, fillLayerId, 'fill-color', getPointColor(pointType));
				resolvedMapAdapter.value.setPaintProperty(mapInstance.value, fillLayerId, 'fill-opacity', isHovered ? 0.85 : 0.5);
			}

			if (mapInstance.value && resolvedMapAdapter.value.getLayer(mapInstance.value, borderLayerId)) {
				resolvedMapAdapter.value.setPaintProperty(mapInstance.value, borderLayerId, 'line-width', isHovered ? 5 : 2);
				resolvedMapAdapter.value.setPaintProperty(mapInstance.value, borderLayerId, 'line-color', getPointBorderColor(pointType));
			}
		});
	}

	async function resolveTrackIgcText(track: NormalizedTrack, index: number): Promise<string> {
		if (track.igcText) {
			return track.igcText;
		}

		if (props.loadTrack) {
			return props.loadTrack(track, index);
		}

		if (!track.trackURL) {
			throw new Error('Track has no data source');
		}

		const response = await fetch(track.trackURL);
		if (!response.ok) {
			throw new Error(`Failed to fetch IGC: ${response.statusText}`);
		}

		return response.text();
	}

	function setHoveredTurnpoint(index: number): void {
		hoveredTurnpointIndex.value = index;
		applyTurnpointHighlightStyles();
	}

	function clearHoveredTurnpoint(): void {
		hoveredTurnpointIndex.value = null;
		applyTurnpointHighlightStyles();
	}

	async function toggleTrack(index: number): Promise<void> {
		const state = trackStates.value[index];
		if (!state || state.loading) return;

		if (!state.loaded) {
			await loadTrack(index);
			return;
		}

		state.visible = !state.visible;
		setTrackVisibility(index, state.visible);
	}

	async function loadTrack(index: number): Promise<void> {
		const track = normalizedTracks.value[index];
		const state = trackStates.value[index];

		if (!mapInstance.value || !track || !state) return;

		state.loading = true;
		state.error = '';

		try {
			const igcText = await resolveTrackIgcText(track, index);
			const parsed = IGCParser.parse(igcText, { lenient: true }) as ParsedIgc;
			const fixes = Array.isArray(parsed?.fixes) ? parsed.fixes : [];

			// Compute timezone offset for this track from first fix location and timestamp
			let trackTimezoneOffsetSeconds = 0;
			const firstValidFix = fixes.find((fix) => Number.isFinite(fix?.latitude) && Number.isFinite(fix?.longitude) && Number.isFinite(getFixTimestampMs(fix)));
			if (firstValidFix) {
				const firstFixTimestampMs = getFixTimestampMs(firstValidFix);
				const ianaTimeZone = getIanaTimeZoneFromCoordinates(firstValidFix.latitude || 0, firstValidFix.longitude || 0);
				if (ianaTimeZone && Number.isFinite(firstFixTimestampMs)) {
					const utcOffsetSeconds = getUtcOffsetSecondsAtTimestamp(firstFixTimestampMs, ianaTimeZone);
					if (Number.isFinite(utcOffsetSeconds)) {
						trackTimezoneOffsetSeconds = utcOffsetSeconds;
					}
				}
			}

			state.timezoneOffsetSeconds = trackTimezoneOffsetSeconds;

			const coordinates = fixes
				.filter((fix) => Number.isFinite(fix?.longitude) && Number.isFinite(fix?.latitude))
				.map((fix) => [fix.longitude as number, fix.latitude as number] as [number, number]);

			if (coordinates.length < 2) {
				throw new Error('Track has insufficient GPS fixes');
			}

			const gpsAltitudes = fixes
				.map((fix) => fix?.gpsAltitude)
				.filter((altitude): altitude is number => Number.isFinite(altitude));
			const timelinePoints = buildTimelinePoints(fixes);

			const sourceId = getTrackSourceId(index);
			const layerId = getTrackLayerId(index);
			const geoJson = {
				type: 'FeatureCollection' as const,
				features: [{
					type: 'Feature' as const,
					geometry: {
						type: 'LineString' as const,
						coordinates,
					},
					properties: {
						date: track.date,
						pilot: track.pilot,
						contestId: track.contestId,
					},
				}],
			};

			if (!resolvedMapAdapter.value.getSource(mapInstance.value, sourceId)) {
				resolvedMapAdapter.value.addSource(mapInstance.value, sourceId, {
					type: 'geojson',
					data: geoJson,
				});
			} else {
				const source = resolvedMapAdapter.value.getSource(mapInstance.value, sourceId);
				if (source) {
					resolvedMapAdapter.value.setSourceData(source, geoJson);
				}
			}

			if (!resolvedMapAdapter.value.getLayer(mapInstance.value, layerId)) {
				resolvedMapAdapter.value.addLayer(mapInstance.value, {
					id: layerId,
					type: 'line',
					source: sourceId,
					layout: {
						'line-cap': 'round',
						'line-join': 'round',
						visibility: 'visible',
					},
					paint: {
						'line-color': state.color,
						'line-width': 3,
						'line-opacity': 0.9,
					},
				});
			} else {
				resolvedMapAdapter.value.setLayoutProperty(mapInstance.value, layerId, 'visibility', 'visible');
			}

			state.maxGpsAltitude = gpsAltitudes.length ? Math.max(...gpsAltitudes) : null;
			state.timelinePoints = timelinePoints;
			state.loaded = true;
			state.visible = true;
		} catch (error) {
			state.error = error instanceof Error ? error.message : 'Failed to load track';
			state.timelinePoints = [];
			console.error('Error loading track:', error);
		} finally {
			state.loading = false;
		}
	}

	async function fetchAndDrawTask(): Promise<void> {
		isLoading.value = true;
		loadError.value = '';

		try {
			if (!mapInstance.value) {
				return;
			}

			let taskData: TaskData | null = null;

			if (props.taskData) {
				taskData = typeof props.taskData === 'string'
					? JSON.parse(props.taskData) as TaskData
					: props.taskData;
			} else if (props.loadTask) {
				taskData = await props.loadTask();
			} else if (props.xctskFileUrl) {
				const response = await fetch(props.xctskFileUrl);
				if (!response.ok) {
					throw new Error(`Failed to fetch XCTSK file: ${response.statusText}`);
				}

				taskData = await response.json() as TaskData;
			}

			if (!taskData) {
				turnpoints.value = [];
				return;
			}

			if (!taskData.turnpoints || !Array.isArray(taskData.turnpoints)) {
				turnpoints.value = [];
				return;
			}

			turnpoints.value = taskData.turnpoints;
			hoveredTurnpointIndex.value = null;

			const bounds = resolvedMapAdapter.value.createBounds();

			turnpoints.value.forEach((point, index) => {
				const lat = point?.waypoint?.lat;
				const lon = point?.waypoint?.lon;
				const radius = point?.radius || 0;

				if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
					return;
				}

				const pointType = getPointTypeForDisplay(point, index, taskData.turnpoints?.length ?? 0);

				bounds.extend([lon, lat]);

				const sourceId = `task-point-${index}`;
				const layerId = `task-point-circle-${index}`;
				const borderLayerId = `task-point-circle-border-${index}`;

				if (mapInstance.value && !resolvedMapAdapter.value.getSource(mapInstance.value, sourceId)) {
					resolvedMapAdapter.value.addSource(mapInstance.value, sourceId, createGeoJSONCircle([lon, lat], radius / 1000));

					resolvedMapAdapter.value.addLayer(mapInstance.value, {
						id: layerId,
						type: 'fill',
						source: sourceId,
						paint: {
							'fill-color': getPointColor(pointType),
							'fill-opacity': 0.5,
							'fill-color-transition': { duration: 180, delay: 0 },
							'fill-opacity-transition': { duration: 180, delay: 0 },
						},
					});

					resolvedMapAdapter.value.addLayer(mapInstance.value, {
						id: borderLayerId,
						type: 'line',
						source: sourceId,
						paint: {
							'line-color': getPointBorderColor(pointType),
							'line-width': 2,
							'line-width-transition': { duration: 180, delay: 0 },
							'line-color-transition': { duration: 180, delay: 0 },
						},
					});
				}
			});

			applyTurnpointHighlightStyles();

			const optimizerTurnpoints = turnpoints.value
				.map<OptimizerTurnpoint | null>((point, index) => {
					const lat = point?.waypoint?.lat;
					const lon = point?.waypoint?.lon;

					if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
						return null;
					}

					return {
						lat,
						lng: lon,
						radius: point.radius || 0,
						type: mapToOptimizerType(point.type),
						name: point.waypoint?.name || `Task Point ${index}`,
					};
				})
				.filter((point): point is OptimizerTurnpoint => point !== null);

			if (optimizerTurnpoints.length >= 2) {
				try {
					const optimized = optimizeTask(optimizerTurnpoints) as OptimizedTaskPath;
					const optimizedCoordinates = optimized.optimizedPoints.map(({ lng, lat }) => [lng, lat] as [number, number]);

					const optimizedPathGeoJson = {
						type: 'FeatureCollection' as const,
						features: [{
							type: 'Feature' as const,
							geometry: {
								type: 'LineString' as const,
								coordinates: optimizedCoordinates,
							},
							properties: {
								geodesicDistanceMeters: optimized.geodesicDistanceMeters,
								planarDistanceMeters: optimized.planarDistanceMeters,
							},
						}],
					};

					const optimizedPathSourceId = 'task-optimized-path';
					const optimizedPathLayerId = 'task-optimized-path-line';

					if (!resolvedMapAdapter.value.getSource(mapInstance.value, optimizedPathSourceId)) {
						resolvedMapAdapter.value.addSource(mapInstance.value, optimizedPathSourceId, {
							type: 'geojson',
							lineMetrics: true,
							data: optimizedPathGeoJson,
						});
					} else {
						const source = resolvedMapAdapter.value.getSource(mapInstance.value, optimizedPathSourceId);
						if (source) {
							resolvedMapAdapter.value.setSourceData(source, optimizedPathGeoJson);
						}
					}

					if (!resolvedMapAdapter.value.getLayer(mapInstance.value, optimizedPathLayerId)) {
						resolvedMapAdapter.value.addLayer(mapInstance.value, {
							id: optimizedPathLayerId,
							type: 'line',
							source: optimizedPathSourceId,
							paint: {
								'line-gradient': [
									'interpolate',
									['linear'],
									['line-progress'],
									0,
									'rgba(244, 67, 54, 0.95)',
									1,
									'rgba(76, 175, 80, 0.95)',
								],
								'line-width': 3,
							},
						});
					}
				} catch (optimizerError) {
					console.error('Failed to optimize task path:', optimizerError);
				}
			}

			if (!bounds.isEmpty()) {
				resolvedMapAdapter.value.fitBounds(mapInstance.value, bounds, {
					padding: {
						top: 50,
						bottom: 50,
						left: 100,
						right: 100,
					},
					animate: false,
					maxZoom: window.innerWidth < 768 ? 11 : 12,
				});
			}
		} catch (error) {
			loadError.value = error instanceof Error ? error.message : 'Failed to load task';
			console.error('Error loading task:', error);
		} finally {
			isLoading.value = false;
		}
	}

	function handleMapStyleLoad(): void {
		ensureHoveredTrackPointLayer();
		void fetchAndDrawTask();
	}

	return {
		activeTab,
		chartTimeDomain,
		clearHoveredTrackPoint,
		clearHoveredTurnpoint,
		fetchAndDrawTask,
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
	};
}
