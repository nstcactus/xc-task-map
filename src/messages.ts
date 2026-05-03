export const xcTaskMapMessages = {
  en: {
    'xc-task-map.sidebar.toggle.show': 'Show sidebar',
    'xc-task-map.sidebar.toggle.hide': 'Hide sidebar',
    'xc-task-map.elevation.toggle.show': 'Show elevation',
    'xc-task-map.elevation.toggle.hide': 'Hide elevation',
    'xc-task-map.sidebar.tabs.turnpoints': 'Turnpoints',
    'xc-task-map.sidebar.tabs.tracks': 'Tracks',
    'xc-task-map.sidebar.meta.available': '{n} available',
    'xc-task-map.sidebar.loading': 'Loading task...',
    'xc-task-map.sidebar.empty-turnpoints': 'No turnpoints',
    'xc-task-map.sidebar.empty-tracks': 'No tracks',
    'xc-task-map.sidebar.track.max-gps-alt': 'Max alt: {n} m',
    'xc-task-map.track.download-tooltip': "Download {name}'s IGC track",
    'xc-task-map.tooltip.local-time': 'Local time: {time}',
    'xc-task-map.tooltip.utc-time': 'UTC time: {time}',
  },
} satisfies Record<string, Record<string, string>>;

export function renderMessageTemplate(template: string, params: Record<string, unknown>): string {
  let output = template;

  for (const [key, value] of Object.entries(params)) {
    output = output.split(`{${key}}`).join(String(value));
  }

  return output;
}
