// Stage settings: what stands behind the characters. compose() returns plain data the director stores
// in storyboard.json (scene.background), so a renderer needs nothing but the storyboard to draw it.
// Coordinates are stage units: ground at y = 0, characters 900 units tall, cast centred on x = 0.

export const SETTINGS = ['kitchen', 'cafe', 'living-room', 'office', 'street', 'park', 'studio', 'palace'];

const p = (type, x, y = 0, s = 1, extra = {}) => ({ type, x, y, s, ...extra });

/** span = [xmin, xmax] of the characters' positions. */
export function compose(setting, span = [-280, 280]) {
  const [a, b] = span, L = a - 330, Rr = b + 330, mid = (a + b) / 2;
  switch (setting) {
    case 'kitchen':
      return {
        place: 'interior', wall: 'wall', floor: 'floor',
        props: [
          p('window', a - 40, -1000, 1), p('shelf', b + 80, -1040, 1), p('clock', mid, -1160, 0.7),
          p('counter', mid, 0, 1, { opts: { w: (b - a) + 1500 } }), p('teapot', mid + 20, -430, 0.95), p('mug', Rr + 120, -430, 0.9),
          p('plant', L - 260, 0, 1),
        ],
      };
    case 'cafe':
      return {
        place: 'interior', wall: 'wall2', floor: 'floor2',
        props: [
          p('menu-board', mid, -1010, 1), p('hanging-lamp', a - 120, -1330, 0.8), p('hanging-lamp', b + 120, -1330, 0.8),
          p('counter', mid, 0, 1, { opts: { w: (b - a) + 1400 } }), p('coffee-machine', mid - 40, -430, 0.9), p('mug', mid + 170, -430, 0.75),
          p('cafe-table', L - 160, 0, 1), p('plant', Rr + 260, 0, 0.9),
        ],
      };
    case 'living-room':
      return {
        place: 'interior', wall: 'wall3', floor: 'floor', stripe: 'wall',
        props: [
          p('frame', mid - 40, -1020, 1), p('window', Rr + 140, -980, 0.9), p('sofa', mid, 0, 1, { opts: { w: (b - a) + 520 } }),
          p('lamp', L - 120, 0, 1), p('plant', Rr + 360, 0, 0.9), p('rug', mid, 0, 1, { opts: { w: (b - a) + 900 }, layer: 'floor' }),
        ],
      };
    case 'office':
      return {
        place: 'interior', wall: 'wall3', floor: 'floor2', stripe: 'wall',
        props: [
          p('clock', mid, -1150, 0.75), p('bookshelf', L - 190, 0, 1), p('desk', Rr + 200, 0, 1), p('frame', a - 60, -1050, 0.8),
          p('plant', mid, 0, 0.75),
        ],
      };
    case 'street':
      return {
        place: 'exterior', sky: 'sky', ground: 'light', horizon: -40,
        props: [
          p('cloud', a - 200, -1450, 0.9), p('cloud', b + 350, -1580, 0.7),
          p('building', L - 380, -40, 1, { opts: { w: 560, h: 1250, fill: 'wall' } }), p('building', mid, -40, 1, { opts: { w: 640, h: 1050, fill: 'wall2' } }),
          p('building', Rr + 380, -40, 1, { opts: { w: 560, h: 1400, fill: 'accent2' } }), p('streetlamp', b + 210, 0, 1),
        ],
      };
    case 'park':
      return {
        place: 'exterior', sky: 'sky', ground: 'ground', horizon: -60, hills: 'hill',
        props: [
          p('sun', b + 160, -1380, 1), p('cloud', a - 150, -1300, 0.8), p('tree', L - 220, -40, 1.05), p('tree', Rr + 330, -40, 0.9),
          p('bench', mid, -30, 0.9), p('bush', Rr + 80, 0, 0.9),
        ],
      };
    case 'palace':
      return {
        place: 'interior', wall: 'accent2', floor: 'floor', stripe: 'accent1',
        props: [
          p('arch', a - 300, -560, 1, { opts: { moon: true } }), p('arch', mid, -600, 0.9), p('arch', b + 300, -560, 1),
          p('kandil', a - 40, -980, 0.9), p('kandil', b + 40, -980, 0.9),
          p('divan', mid, 0, 1, { opts: { w: (b - a) + 1700 } }),
          p('door', Rr + 520, 0, 1, { opts: { open: 0 } }),
        ],
      };
    case 'studio':
    default:
      return { place: 'studio', wall: 'wall', floor: 'floor', disc: 'wall2', props: [] };
  }
}
