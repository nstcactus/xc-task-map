import type {Feature, FeatureCollection, GeoJsonProperties, Polygon,} from 'geojson';
import type {TimelinePoint, Turnpoint} from './types';

type PointType = 'SSS' | 'ESS' | 'TakeOff' | 'Goal' | 'Regular' | string;

interface GenericFix {
	longitude?: number;
	latitude?: number;
	gpsAltitude?: number;
	pressureAltitude?: number;
	timestamp?: number | string | Date;
	time?: number | string;
}

type OptimizerTurnpointType = 'takeoff' | 'start' | 'end-of-speed-section' | 'goal' | 'turnpoint';

export function getTrackColor(contestId: number, fallbackIndex = 0): string {
	const baseIndex = Number.isFinite(contestId) ? contestId - 1 : fallbackIndex;
	const hue = ((baseIndex + 1) * 47) % 360;
	return `hsl(${hue}, 78%, 46%)`;
}

export function getTrackKey(track: { trackURL?: string; contestId?: number }, index: number): string {
	if (track?.trackURL) return `url:${track.trackURL}`;
	if (Number.isFinite(track?.contestId)) return `contest:${track.contestId}`;
	return `index:${index}`;
}

export function getTrackSourceId(index: number): string {
	return `pilot-track-${index}`;
}

export function getTrackLayerId(index: number): string {
	return `pilot-track-line-${index}`;
}

export function getFixSecondsOfDay(fix: GenericFix): number | null {
	const timestamp = fix?.timestamp;

	if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
		if (timestamp >= 0 && timestamp < 86400) {
			return timestamp;
		}

		const parsed = new Date(timestamp);
		if (Number.isFinite(parsed.getTime())) {
			return (parsed.getUTCHours() * 3600) + (parsed.getUTCMinutes() * 60) + parsed.getUTCSeconds();
		}
	}

	if (timestamp instanceof Date && Number.isFinite(timestamp.getTime())) {
		return (timestamp.getUTCHours() * 3600) + (timestamp.getUTCMinutes() * 60) + timestamp.getUTCSeconds();
	}

	if (typeof timestamp === 'string' && timestamp.trim()) {
		const parsed = new Date(timestamp);
		if (Number.isFinite(parsed.getTime())) {
			return (parsed.getUTCHours() * 3600) + (parsed.getUTCMinutes() * 60) + parsed.getUTCSeconds();
		}
	}

	if (typeof fix?.time === 'string') {
		const match = fix.time.match(/(\d{2}):(\d{2}):(\d{2})/);
		if (match) {
			return (Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3]);
		}
	}

	if (typeof fix?.time === 'number' && fix.time >= 0 && fix.time < 86400) {
		return fix.time;
	}

	return null;
}

export function buildTimelinePoints(fixes: GenericFix[]): TimelinePoint[] {
	let previousSeconds: number | null = null;
	let dayOffsetSeconds = 0;

	const points = fixes
		.map((fix): TimelinePoint | null => {
			if (!Number.isFinite(fix?.longitude) || !Number.isFinite(fix?.latitude)) {
				return null;
			}

			const elevation = Number.isFinite(fix?.gpsAltitude)
				? fix.gpsAltitude
				: Number.isFinite(fix?.pressureAltitude)
					? fix.pressureAltitude
					: null;
			const secondsOfDay = getFixSecondsOfDay(fix);

			if (!Number.isFinite(elevation) || !Number.isFinite(secondsOfDay)) {
				return null;
			}

			if (previousSeconds !== null && secondsOfDay < previousSeconds - 60) {
				dayOffsetSeconds += 86400;
			}
			previousSeconds = secondsOfDay;

			return {
				x: (secondsOfDay + dayOffsetSeconds) * 1000,
				y: elevation,
				lng: fix.longitude,
				lat: fix.latitude,
			};
		})
		.filter((point): point is TimelinePoint => point !== null);

	return points.sort((a, b) => a.x - b.x);
}

const utcTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
	timeZone: 'UTC',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false,
});

export function formatUtcTime(valueMs: number): string {
	return utcTimeFormatter.format(new Date(valueMs));
}

export function formatTimeOfDay(valueMs: number, offsetSeconds = 0): string {
	const utcTime = formatUtcTime(valueMs);
	const localTime = utcTimeFormatter.format(new Date(valueMs + offsetSeconds * 1000));
	const offsetHours = offsetSeconds / 3600;

	return `Heure locale : ${localTime} (UTC+${offsetHours})\nHeure UTC : ${utcTime}`;
}

export function findNearestPointByX(points: TimelinePoint[], xValue: number): TimelinePoint | null {
	if (!Array.isArray(points) || !points.length || !Number.isFinite(xValue)) return null;

	let left = 0;
	let right = points.length - 1;

	while (left < right) {
		const mid = Math.floor((left + right) / 2);
		if (points[mid].x < xValue) {
			left = mid + 1;
		} else {
			right = mid;
		}
	}

	const current = points[left];
	const previous = points[left - 1];

	if (!previous) return current;
	return Math.abs(current.x - xValue) < Math.abs(previous.x - xValue) ? current : previous;
}

export function getPointTypeForDisplay(point: Turnpoint, index: number, total: number): PointType {
	return point?.type || (index === 0 ? 'TakeOff' : index === total - 1 ? 'Goal' : 'Regular');
}

export function getPointColor(pointType: PointType): string {
	const colorMap: Record<string, string> = {
		SSS: 'rgba(76, 175, 80, 0.4)',
		ESS: 'rgba(244, 67, 54, 0.4)',
		TakeOff: 'rgba(255, 193, 7, 0.4)',
		Goal: 'rgba(156, 39, 176, 0.4)',
	};

	return colorMap[pointType] || 'rgba(33, 150, 243, 0.4)';
}

export function getPointBorderColor(pointType: PointType): string {
	const colorMap: Record<string, string> = {
		SSS: 'rgba(76, 175, 80, 1)',
		ESS: 'rgba(244, 67, 54, 1)',
		TakeOff: 'rgba(255, 193, 7, 1)',
		Goal: 'rgba(156, 39, 176, 1)',
	};

	return colorMap[pointType] || 'rgba(33, 150, 243, 1)';
}

export function mapToOptimizerType(type: string | undefined): OptimizerTurnpointType {
	const normalizedType = String(type || '').toLowerCase();

	if (normalizedType === 'takeoff') return 'takeoff';
	if (normalizedType === 'sss' || normalizedType === 'start') return 'start';
	if (normalizedType === 'ess' || normalizedType === 'end-of-speed-section') return 'end-of-speed-section';
	if (normalizedType === 'goal') return 'goal';

	return 'turnpoint';
}

export function getTurnpointLabel(turnpoint: Turnpoint, index: number): string {
	const name = turnpoint?.waypoint?.name || `Task Point ${index}`;
	const type = turnpoint?.type;

	return type ? `${type}: ${name}` : name;
}

export function createGeoJSONCircle(center: [number, number], radiusInKm: number, points = 64): {
	type: 'geojson';
	data: FeatureCollection<Polygon, GeoJsonProperties>;
} {
	const coords = {
		latitude: center[1],
		longitude: center[0],
	};

	const ring: [number, number][] = [];
	const distanceX = radiusInKm / (111.320 * Math.cos((coords.latitude * Math.PI) / 180));
	const distanceY = radiusInKm / 110.574;

	for (let i = 0; i < points; i++) {
		const theta = (i / points) * (2 * Math.PI);
		const x = distanceX * Math.cos(theta);
		const y = distanceY * Math.sin(theta);

		ring.push([coords.longitude + x, coords.latitude + y]);
	}

	ring.push(ring[0]);

	const feature: Feature<Polygon, GeoJsonProperties> = {
		type: 'Feature',
		geometry: {
			type: 'Polygon',
			coordinates: [ring],
		},
		properties: {},
	};

	return {
		type: 'geojson',
		data: {
			type: 'FeatureCollection',
			features: [feature],
		},
	};
}
