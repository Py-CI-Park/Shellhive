export const LAYOUT_PRESETS = Object.freeze({
  'two-columns': {
    name: '2 Columns',
    icon: '||',
    create: () => ({ type: 'vertical', ratio: 0.5, count: 2 })
  },
  'two-rows': {
    name: '2 Rows',
    icon: '==',
    create: () => ({ type: 'horizontal', ratio: 0.5, count: 2 })
  },
  'three-columns': {
    name: '3 Columns',
    icon: '|||',
    create: () => ({ type: 'vertical', ratio: 0.33, count: 3 })
  },
  'main-sidebar': {
    name: 'Main + Sidebar',
    icon: '|:',
    create: () => ({ type: 'vertical', ratio: 0.7, count: 2 })
  },
  'grid-2x2': {
    name: '2x2 Grid',
    icon: '##',
    create: () => ({ type: 'grid', rows: 2, cols: 2 })
  }
});

export const TAB_COLORS = Object.freeze([
  { name: 'Red', value: '#f14c4c' },
  { name: 'Orange', value: '#cca700' },
  { name: 'Yellow', value: '#e5e510' },
  { name: 'Green', value: '#0dbc79' },
  { name: 'Blue', value: '#2472c8' },
  { name: 'Purple', value: '#bc3fbc' },
  { name: 'None', value: null }
]);
