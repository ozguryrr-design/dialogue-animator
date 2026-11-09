// Stage settings: what stands behind the characters. compose() returns plain data the director stores
// in storyboard.json (scene.background), so a renderer needs nothing but the storyboard to draw it.
// Coordinates are stage units: ground at y = 0, characters 900 units tall, cast centred on x = 0.

export const SETTINGS = ['kitchen', 'cafe', 'living-room', 'office', 'street', 'park', 'studio', 'palace', 'throne-room', 'palace-garden', 'classroom', 'schoolyard', 'bedroom', 'hospital', 'bazaar', 'forest', 'mountain', 'beach', 'desert', 'village', 'courtroom', 'library'];

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
          p('tile-band', mid, -1330, 1, { opts: { w: (b - a) + 3400, h: 130 } }), p('arcade', mid, -1460, 1, { opts: { w: (b - a) + 3400, h: 200 } }),
          p('lattice-window', mid - 430, -640, 1, { opts: { moon: true } }), p('lattice-window', mid, -640, 1), p('lattice-window', mid + 430, -640, 1),
          p('lattice-window', mid - 860, -640, 1), p('lattice-window', mid + 860, -640, 1),
          p('kandil', mid - 215, -1020, 0.9), p('kandil', mid + 215, -1020, 0.9),
          p('tile-band', mid, -440, 1, { opts: { w: (b - a) + 3400, h: 110 } }),
          p('divan', mid, 0, 1, { opts: { w: (b - a) + 1900 } }),
          p('brazier', L - 300, 0, 1), p('ewer', Rr + 200, -2, 1),
          p('carpet', mid, 0, 1, { layer: 'floor', opts: { w: (b - a) + 1200 } }),
          p('door', Rr + 520, 0, 1, { opts: { open: 0 } }),
        ],
      };
    case 'throne-room':
      return {
        place: 'interior', wall: 'wall2', floor: 'floor', stripe: 'accent1',
        props: [
          p('tile-band', mid, -1400, 1, { opts: { w: (b - a) + 3400, h: 130 } }),
          p('column', mid - 520, 0, 1), p('column', mid + 520, 0, 1), p('column', mid - 1000, 0, 1), p('column', mid + 1000, 0, 1),
          p('banner', mid - 300, -560, 1), p('banner', mid + 300, -560, 1), p('throne', mid, 0, 1),
          p('chandelier', mid, -1060, 0.9), p('carpet', mid, 0, 1, { layer: 'floor', opts: { w: (b - a) + 900 } }), p('brazier', L - 120, 0, 1),
        ],
      };
    case 'palace-garden':
      return {
        place: 'exterior', sky: 'sky', ground: 'ground', horizon: -60, hills: 'hill',
        props: [
          p('sun', b + 200, -1420, 0.9), p('cloud', a - 200, -1480, 0.8), p('skyline', mid, -60, 1, { opts: { w: (b - a) + 3200 } }),
          p('cypress', mid - 440, -40, 1), p('cypress', mid + 440, -40, 1), p('cypress', L - 280, -40, 1.1), p('cypress', Rr + 280, -40, 1.1),
          p('fountain', mid, -40, 0.9), p('flowers', mid - 330, 0, 1, { opts: { w: 420 } }), p('flowers', mid + 330, 0, 1, { opts: { w: 420 } }),
        ],
      };
    case 'classroom':
      return {
        place: 'interior', wall: 'wall3', floor: 'floor2', stripe: 'wall2',
        props: [
          p('clock', mid, -1360, 0.7), p('poster', mid - 440, -1120, 0.9), p('poster', mid + 440, -1120, 0.9, { opts: { fill: 'accent3' } }),
          p('blackboard', mid, -640, 1, { opts: { w: (b - a) + 560 } }), p('wall-map', L - 300, -760, 1), p('window', Rr + 280, -900, 1), p('bookshelf', L - 740, 0, 1),
          p('teacher-desk', mid + 310, 0, 0.9), p('globe', mid + 400, -378, 0.7), p('school-desk', L - 170, 0, 1), p('school-desk', Rr + 170, 0, 1), p('backpack', mid - 420, 0, 0.8),
        ],
      };
    case 'schoolyard':
      return {
        place: 'exterior', sky: 'sky', ground: 'ground', horizon: -60, hills: 'hill',
        props: [
          p('sun', b + 180, -1480, 0.8), p('cloud', a - 220, -1520, 0.8), p('school-building', mid, -40, 1, { opts: { w: (b - a) + 1200 } }),
          p('flagpole', a - 330, -30, 1), p('tree', Rr + 240, -40, 0.9), p('basket-hoop', L - 420, -10, 1), p('fence', mid, 0, 1, { opts: { w: (b - a) + 2400 }, layer: 'floor' }), p('backpack', b + 330, 0, 0.8),
        ],
      };
    case 'bedroom':
      return {
        place: 'interior', wall: 'wall2', floor: 'floor', stripe: 'wall3',
        props: [
          p('window', mid + 400, -1010, 0.95), p('frame', mid - 400, -1080, 1), p('poster', mid - 60, -1160, 0.9), p('closet', L - 270, 0, 1), p('bed', mid - 90, 0, 1, { opts: { w: (b - a) + 560 } }), p('lamp', Rr + 120, 0, 1), p('rug', mid, 0, 1, { opts: { w: (b - a) + 900 }, layer: 'floor' }),
        ],
      };
    case 'hospital':
      return {
        place: 'interior', wall: 'wall3', floor: 'floor2', stripe: 'wall',
        props: [
          p('clock', mid, -1320, 0.7), p('window', mid - 420, -980, 0.9), p('curtain-rail', mid + 480, 0, 1, { opts: { w: 620, h: 1300 } }), p('hospital-bed', mid, 0, 1, { opts: { w: (b - a) + 620 } }),
          p('iv-stand', a - 240, 0, 1), p('med-cabinet', L - 300, 0, 1), p('poster', mid, -1130, 0.85),
        ],
      };
    case 'bazaar':
      return {
        place: 'exterior', sky: 'sky', ground: 'light', horizon: -40,
        props: [
          p('cloud', a - 160, -1520, 0.8), p('skyline', mid, -40, 1, { opts: { w: (b - a) + 3200 } }), p('bazaar-stall', mid - 400, -30, 1), p('bazaar-stall', mid + 400, -30, 1, { opts: { fill: 'accent2' } }), p('bazaar-stall', mid - 1140, -30, 1, { opts: { fill: 'accent2' } }), p('bazaar-stall', mid + 1140, -30, 1),
          p('lantern', mid, -1040, 1), p('lantern', mid - 240, -1090, 0.8), p('lantern', mid + 240, -1090, 0.8), p('barrel', L - 80, -2, 0.9), p('barrel', Rr + 100, -2, 0.9),
        ],
      };
    case 'forest':
      return {
        place: 'exterior', sky: 'sky', ground: 'ground', horizon: -60, hills: 'hill',
        props: [
          p('sun', a - 80, -1480, 0.8), p('pine', mid - 470, -70, 1.15), p('pine', mid + 470, -70, 1.25), p('pine', mid, -80, 0.9), p('pine', mid - 240, -80, 0.8), p('pine', mid + 240, -80, 0.86),
          p('pine', mid - 900, -70, 1.1), p('pine', mid + 900, -70, 1.05), p('tree', L - 480, -40, 1), p('tree', Rr + 480, -40, 1), p('rock', mid + 420, 0, 0.8), p('bush', mid - 440, 0, 0.9), p('grass', mid - 240, 8, 1), p('flowers', mid + 220, 8, 0.9, { opts: { w: 320 } }),
        ],
      };
    case 'mountain':
      return {
        place: 'exterior', sky: 'sky', ground: 'light', horizon: -60,
        props: [
          p('sun', b + 200, -1500, 0.8), p('cloud', a - 200, -1380, 0.8), p('mountain', mid + 180, -60, 1.1, { opts: { w: 1800 } }), p('mountain', mid - 900, -60, 0.85, { opts: { w: 1700, fill: 'accent2' } }), p('mountain', mid + 1400, -60, 0.9, { opts: { w: 1500, fill: 'accent2' } }),
          p('pine', mid - 470, -40, 0.72), p('pine', mid + 480, -40, 0.66), p('rock', mid - 330, 0, 0.9), p('rock', mid + 360, 0, 0.7), p('grass', mid, 10, 1, { opts: { w: 900 } }),
        ],
      };
    case 'beach':
      return {
        place: 'exterior', sky: 'sky', ground: 'accent1', horizon: -60,
        props: [
          p('sun', b + 180, -1400, 1), p('cloud', a - 220, -1500, 0.8), p('gull', mid - 280, -1240, 1), p('gull', mid - 120, -1340, 0.8), p('sea', mid, -60, 1, { opts: { h: 300 } }), p('boat', mid + 260, -220, 0.55),
          p('palm', L - 110, -10, 1), p('beach-umbrella', Rr + 100, 0, 1), p('flowers', L - 500, 0, 1, { opts: { w: 200 } }),
        ],
      };
    case 'desert':
      return {
        place: 'exterior', sky: 'sky', ground: 'accent1', horizon: -60,
        props: [
          p('sun', a - 60, -1460, 1.2), p('dune', mid - 520, -60, 1, { opts: { w: 2200, h: 460, fill: 'accent3' } }), p('dune', mid + 720, -60, 1, { opts: { w: 2400, h: 360 } }), p('tent', mid + 410, -30, 1), p('cactus', mid - 450, -10, 0.85), p('palm', L - 350, -10, 0.9), p('rock', Rr + 180, 0, 0.8), p('campfire', mid - 300, 10, 0.75),
        ],
      };
    case 'village':
      return {
        place: 'exterior', sky: 'sky', ground: 'ground', horizon: -60, hills: 'hill',
        props: [
          p('sun', b + 180, -1480, 0.8), p('cloud', a - 200, -1460, 0.8), p('windmill', mid - 520, -60, 0.9), p('house', mid - 80, -50, 1), p('house', mid + 530, -50, 0.9, { opts: { fill: 'wall2' } }), p('house', mid - 1120, -50, 1, { opts: { fill: 'wall2' } }),
          p('tree', Rr + 480, -40, 1), p('well', L - 40, 0, 0.8), p('fence', mid, 0, 1, { opts: { w: (b - a) + 2400 }, layer: 'floor' }), p('flowers', mid + 420, 6, 1, { opts: { w: 300 } }),
        ],
      };
    case 'courtroom':
      return {
        place: 'interior', wall: 'wall2', floor: 'floor', stripe: 'accent3',
        props: [
          p('column', mid - 560, 0, 1), p('column', mid + 560, 0, 1), p('poster', mid, -1320, 0.9), p('flagpole', mid - 400, 0, 1), p('judge-bench', mid, 0, 1, { opts: { w: (b - a) + 460 } }), p('bookshelf', L - 480, 0, 1), p('bookshelf', Rr + 480, 0, 1),
        ],
      };
    case 'library':
      return {
        place: 'interior', wall: 'wall3', floor: 'floor', stripe: 'wall',
        props: [
          p('bookshelf', mid - 420, 0, 1.3), p('bookshelf', mid, 0, 1.3), p('bookshelf', mid + 420, 0, 1.3), p('bookshelf', mid - 840, 0, 1.3), p('bookshelf', mid + 840, 0, 1.3), p('chandelier', mid, -1120, 0.9), p('table', Rr + 40, 0, 1), p('book-stack', Rr + 50, -300, 0.8), p('rug', mid, 0, 1, { opts: { w: (b - a) + 900 }, layer: 'floor' }),
        ],
      };
    case 'studio':
    default:
      return { place: 'studio', wall: 'wall', floor: 'floor', disc: 'wall2', props: [] };
  }
}
