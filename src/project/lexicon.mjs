// Small multilingual lexicons (Turkish + English to start). Stems are matched as prefixes on folded
// words (see foldKey), so Turkish suffixes ("sevindim", "üzüldüm") still match. Extend freely —
// these only provide defaults; explicit [tags] in the dialogue and agent annotations always win.
import { foldKey } from '../lib/text.mjs';

export const EXPRESSIONS = ['neutral', 'happy', 'laugh', 'sad', 'angry', 'surprised', 'scared', 'thinking', 'worried', 'smug', 'stern', 'downcast'];

/** Tag words (inside [brackets]) -> canonical expression. */
export const TAGS = {
  neutral: ['neutral', 'notr', 'normal', 'sakin', 'calm'],
  happy: ['happy', 'mutlu', 'sevincli', 'neseli', 'joyful', 'glad', 'excited', 'heyecanli', 'gulumser', 'smiling'],
  laugh: ['laugh', 'laughing', 'guler', 'gulerek', 'kahkaha', 'giggle', 'kikirdar'],
  sad: ['sad', 'uzgun', 'uzulur', 'huzunlu', 'mutsuz', 'upset', 'aglamakli', 'crying', 'aglar'],
  angry: ['angry', 'kizgin', 'sinirli', 'ofkeli', 'mad', 'furious', 'bagirir', 'shouting', 'kizar'],
  surprised: ['surprised', 'saskin', 'sasirir', 'sasirmis', 'shocked', 'sok', 'hayret', 'amazed'],
  scared: ['scared', 'korkmus', 'korkar', 'afraid', 'frightened', 'urkek', 'terrified'],
  thinking: ['thinking', 'dusunceli', 'dusunur', 'pensive', 'curious', 'merakli', 'wondering'],
  worried: ['worried', 'endiseli', 'kaygili', 'tedirgin', 'nervous', 'anxious', 'gergin'],
  smug: ['smug', 'kendinden', 'kurnaz', 'sly', 'alayci', 'ukala', 'proud', 'gururlu', 'sirit'],
  stern: ['stern', 'sert', 'soguk', 'cold', 'hard', 'tehditkar', 'menacing', 'ciddi', 'serious', 'buz gibi', 'icy'],
  downcast: ['downcast', 'boynu bukuk', 'mahcup', 'ashamed', 'eziklik', 'yenik', 'defeated', 'boyun eg', 'submissive'],
};

/** Words in the spoken text that hint at an emotion (prefix stems on folded words). */
export const HINTS = {
  happy: ['harika', 'super', 'mukemmel', 'yasasin', 'sevin', 'mutlu', 'tesekkur', 'bravo', 'guzel', 'nefis', 'great', 'awesome', 'amazing', 'love', 'perfect', 'thank', 'hooray', 'wonderful', 'yay', 'nice', 'cool'],
  laugh: ['haha', 'hehe', 'ahah', 'lol', 'kahkaha'],
  sad: ['maalesef', 'uzgun', 'uzul', 'yazik', 'agla', 'kotu', 'sorry', 'sad', 'unfortunately', 'cry', 'miss'],
  angry: ['yeter', 'sinir', 'kizgin', 'saçma', 'sacma', 'offf', 'enough', 'angry', 'stop', 'ridiculous', 'hate', 'annoy'],
  surprised: ['vay', 'inanamiyorum', 'gercektenmi', 'oha', 'nasilyani', 'wow', 'whoa', 'noway', 'really', 'what'],
  scared: ['korku', 'kork', 'imdat', 'eyvah', 'eyvahlar', 'help', 'scary', 'afraid', 'eek', 'yikes'],
  worried: ['endise', 'acaba', 'umarim', 'galiba', 'worried', 'hopefully', 'nervous', 'uhoh'],
  thinking: ['hmm', 'hm', 'bilmem', 'dusun', 'belki', 'sanirim', 'think', 'maybe', 'perhaps', 'wonder', 'idea', 'fikir'],
};

/** Stage directions "(...)" or "*...*" -> gesture and/or expression. */
export const DIRECTIONS = [
  { stems: ['el salla', 'elsalla', 'wave', 'selam ver'], gesture: 'wave' },
  { stems: ['goster', 'isaret', 'point'], gesture: 'point' },
  { stems: ['omuz silk', 'shrug'], gesture: 'shrug' },
  { stems: ['yuzunu kapat', 'alnina vur', 'facepalm', 'kafasina vur'], gesture: 'facepalm', expression: 'worried' },
  { stems: ['sevin', 'zipla', 'cheer', 'kollarini kaldir', 'jump'], gesture: 'cheer', expression: 'happy' },
  { stems: ['anlat', 'explain', 'acikla'], gesture: 'explain' },
  { stems: ['ic cek', 'iccek', 'sigh'], expression: 'sad' },
  { stems: ['gul', 'laugh', 'kikir'], expression: 'laugh' },
  { stems: ['bagir', 'shout', 'yell'], expression: 'angry' },
  { stems: ['fisilda', 'whisper'], expression: 'worried' },
  { stems: ['dusun', 'think', 'hmm'], gesture: 'think', expression: 'thinking' },
  { stems: ['sasir', 'surprise', 'gasp'], expression: 'surprised' },
  { stems: ['kork', 'scare', 'titre'], expression: 'scared' },
  { stems: ['sirit', 'smirk'], expression: 'smug' },
  { stems: ['basini salla', 'nod'], gesture: 'nod' },
];

/**
 * Stage actions in beat directions ("0–5 sn — Süleyman kâsesini sofraya bırakır."). Each match becomes
 * timed events: posture changes, gestures, expressions, prop changes, sound effects, a fade.
 */
export const ACTIONS = [
  { stems: ['ayaga kalk', 'kalkar', 'stands up', 'stand up', 'gets up', 'rises'], posture: 'stand' },
  { stems: ['oturur', 'oturuyor', 'otururlar', 'sits down', 'sits', 'sitting', 'seated'], posture: 'sit' },
  { stems: ['birak', 'koyar', 'puts down', 'put down', 'sets down', 'places'], gesture: 'place', sfx: 'clink', prop: 'bowl' },
  { stems: ['gozunu ayirmaz', 'gozlerini ayirmaz', 'ayirmaz', 'dik dik', 'stares', 'staring', 'does not look away', 'never takes'], expression: 'stern', noBlink: true },
  { stems: ['bakisini indir', 'basini eg', 'gozlerini kacir', 'gozunu kacir', 'looks down', 'looks away', 'lowers his gaze', 'lowers her gaze', 'lowers their gaze'], expression: 'downcast' },
  { stems: ['kapi kapan', 'kapiyi kapat', 'door closes', 'door shuts', 'closes the door', 'shuts the door'], door: 'close', sfx: 'door' },
  { stems: ['kapi acil', 'kapiyi ac', 'door opens', 'opens the door'], door: 'open', sfx: 'door' },
  { stems: ['surgu', 'kilitlen', 'kilit', 'bolt', 'locks', 'locked'], sfx: 'bolt' },
  { stems: ['ekran karar', 'kararir', 'karanlik', 'fade out', 'fades out', 'fade to black', 'blackout', 'goes dark'], fade: 'out' },
  { stems: ['el salla', 'waves'], gesture: 'wave' },
  { stems: ['omuz silk', 'shrugs'], gesture: 'shrug' },
];

/** Verbs of movement and handling, read by the first draft of staging.json (src/project/staging.mjs). */
export const STAGE_VERBS = [
  { stems: ['yuruy', 'yurur', 'walks', 'walking', 'strolls'], do: 'walk' },
  { stems: ['kosar', 'kosuy', 'runs', 'running', 'rushes', 'sprints'], do: 'run' },
  { stems: ['yaklas', 'gelir', 'geliyor', 'girer', 'giriyor', 'enters', 'comes in', 'approaches', 'arrives'], do: 'approach' },
  { stems: ['uzaklas', 'gider', 'gidiyor', 'ayrilir', 'kacar', 'kaciyor', 'leaves', 'exits', 'walks away', 'goes away', 'flees'], do: 'leave' },
  { stems: ['sakla', 'gizle', 'hides', 'conceals'], do: 'hide' },
  { stems: ['verir', 'veriyor', 'uzatir', 'gives', 'hands'], do: 'give' },
  { stems: ['cikarir', 'cikartir', 'alir', 'aliyor', 'kapar', 'takes', 'picks up', 'pulls out', 'grabs'], do: 'take' },
  { stems: ['getirir', 'getiriyor', 'tasir', 'tasiyor', 'carries', 'brings'], do: 'carry' },
  { stems: ['birak', 'koyar', 'koyuyor', 'puts down', 'sets down', 'places'], do: 'put' },
  { stems: ['bakar', 'bakiyor', 'goz ucuyla', 'looks at', 'glances'], do: 'look' },
];

/** Things people handle -> a catalogue part. A trailing $ means the whole word only (bag must not match "bagirir"). */
export const CARRY_WORDS = { kazan: 'cauldron', tencere: 'pot', kase: 'bowl', cuval: 'sack', kutu: 'box', sandik: 'box', sepet: 'basket', kilic: 'sword', mektup: 'letter', anahtar: 'key', canta: 'bag', fener: 'lantern', cauldron: 'cauldron', basket: 'basket', sword: 'sword', letter: 'letter', 'pot$': 'pot', 'sack$': 'sack', 'box$': 'box', 'key$': 'key', 'bag$': 'bag', 'bowl$': 'bowl' };

/** Split a direction into sentences and turn each into actions. `names` maps folded first names -> speaker id. */
export function parseActions(text, names = {}, fallbackTarget = null) {
  const out = [];
  for (const sentence of String(text).split(/(?<=[.!?…])\s+/).filter((x) => x.trim())) {
    const k = ' ' + sentence.split(/\s+/).map(foldKey).join(' ') + ' ';
    const kj = k.replace(/\s+/g, '');
    // the subject is the name that appears first in the sentence ("Süleyman gözünü İbrahim'den ayırmaz")
    let target = fallbackTarget, best = Infinity;
    for (const [nm, id] of Object.entries(names)) { const i = k.indexOf(' ' + nm); if (i >= 0 && i < best) { best = i; target = id; } }
    for (const a of ACTIONS) {
      if (a.stems.some((s) => { const f = s.split(' ').map(foldKey).join(' '); return k.includes(' ' + f) || (f.length > 6 && kj.includes(f.replace(/\s+/g, ''))); })) {
        const { stems, ...rest } = a;
        out.push({ ...rest, target, text: sentence.trim() });
      }
    }
  }
  return out;
}

/** Speaker names that mean an off-screen voice (folded). More can be declared with "@narrator Name". */
export const NARRATOR_NAMES = ['anlatici', 'disses', 'disanlatim', 'disanlatici', 'hikayeanlaticisi', 'narrator', 'voiceover', 'vo', 'storyteller'];
export const isNarratorName = (name) => NARRATOR_NAMES.includes(foldKey(name));

/** Greeting words -> wave gesture at the start of the line. */
export const GREETINGS = ['merhaba', 'selam', 'gunaydin', 'iyiaksamlar', 'hosgeldin', 'hello', 'hi', 'hey', 'goodmorning', 'bye', 'gorusuruz', 'hoscakal'];

/** Words that name a prop the director can show in a cutaway (stage props, see engine/props.mjs). */
export const PROP_WORDS = {
  teapot: ['cay', 'caydanlik', 'demlik', 'tea', 'teapot', 'kettle'],
  mug: ['kahve', 'fincan', 'kupa', 'bardak', 'coffee', 'mug', 'cup', 'espresso'],
  clock: ['saat', 'gec kaldi', 'gec', 'dakika', 'zaman', 'clock', 'time', 'late', 'minute', 'hour'],
  phone: ['telefon', 'mesaj', 'ara', 'phone', 'call', 'message', 'text'],
  book: ['kitap', 'roman', 'oku', 'book', 'read', 'novel'],
  plant: ['cicek', 'bitki', 'saksi', 'plant', 'flower'],
  cake: ['pasta', 'kek', 'dogum gunu', 'cake', 'birthday'],
  umbrella: ['yagmur', 'semsiye', 'rain', 'umbrella'],
};

/** Setting words (scene headers or dialogue) -> stage setting id (engine/settings.mjs). */
export const SETTING_WORDS = {
  'palace-garden': ['saray bahcesi', 'hasbahce', 'palace garden'],
  'throne-room': ['taht odasi', 'throne room', 'taht', 'throne', 'sato', 'castle'],
  classroom: ['sinif', 'sinifta', 'classroom', 'okul', 'school', 'ogretmen', 'teacher', 'ders', 'lesson'],
  schoolyard: ['okul bahcesi', 'teneffus', 'schoolyard', 'playground'],
  bedroom: ['yatak odasi', 'bedroom', 'yatak', 'uyandi'],
  hospital: ['hastane', 'hospital', 'doktor', 'doctor', 'ameliyat', 'revir', 'klinik', 'clinic'],
  bazaar: ['pazar', 'carsi', 'bazaar', 'market', 'bedesten'],
  forest: ['orman', 'forest', 'woods', 'koruluk'],
  mountain: ['dag', 'dagda', 'zirve', 'mountain', 'yayla', 'kayalik'],
  beach: ['sahil', 'plaj', 'deniz', 'beach', 'seaside', 'kumsal', 'liman', 'harbor', 'iskele'],
  desert: ['col', 'colde', 'desert', 'sahra', 'vaha', 'oasis', 'kervan'],
  village: ['koy', 'koyde', 'village', 'tarla', 'farm', 'ciftlik', 'kasaba'],
  courtroom: ['mahkeme', 'courtroom', 'hakim', 'judge', 'savci', 'durusma'],
  library: ['kutuphane', 'library'],
  palace: ['saray', 'sarayda', 'palace', 'iftar', 'sofra', 'divan', 'hunkar', 'padisah', 'sultan', 'kosk', 'pasa', 'vezir', 'konak'],
  kitchen: ['mutfak', 'kitchen', 'yemek', 'cay', 'caydanlik', 'buzdolabi', 'fridge'],
  cafe: ['kafe', 'cafe', 'kahveci', 'coffee shop', 'kahve dukkani', 'restoran', 'restaurant'],
  'living-room': ['salon', 'oturma', 'living', 'ev', 'home', 'koltuk', 'sofa', 'kanepe'],
  office: ['ofis', 'office', 'is yeri', 'toplanti', 'meeting', 'patron', 'boss', 'masa'],
  street: ['sokak', 'cadde', 'sehir', 'street', 'city', 'otobus', 'bus', 'durak'],
  park: ['park', 'bahce', 'garden', 'piknik', 'picnic', 'disari', 'outside'],
  studio: ['studyo', 'studio', 'bos', 'empty', 'abstract'],
};

export const foldWords = (text) => String(text).split(/[\s.,!?;:…"'()[\]{}«»“”‘’\-–—]+/).map(foldKey).filter(Boolean);

export function tagToExpression(tag) {
  const k = foldKey(tag);
  for (const [expr, words] of Object.entries(TAGS)) if (words.some((w) => k === w || k.startsWith(w))) return expr;
  return null;
}

/** Infer an expression from the spoken text. Returns { expression, source, trigger } (trigger = word index). */
export function inferExpression(text) {
  const words = foldWords(text);
  const joined = words.join('');
  let best = null;
  words.forEach((w, i) => {
    for (const [expr, stems] of Object.entries(HINTS)) {
      if (stems.some((s) => w.startsWith(s) || (s.length > 5 && joined.includes(s)))) { if (!best) best = { expression: expr, source: 'lexicon', trigger: i }; }
    }
  });
  if (best) return best;
  const t = String(text).trim();
  if (/[?][!]|[!][?]/.test(t)) return { expression: 'surprised', source: 'punctuation', trigger: words.length - 1 };
  if (/!\s*$/.test(t)) return { expression: 'happy', source: 'punctuation', trigger: words.length - 1 };
  if (/(\.\.\.|…)\s*$/.test(t)) return { expression: 'thinking', source: 'punctuation', trigger: words.length - 1 };
  return { expression: 'neutral', source: 'none', trigger: null };
}

export function parseDirection(dir) {
  const k = ' ' + String(dir).split(/\s+/).map(foldKey).join(' ') + ' ';
  const out = {};
  for (const d of DIRECTIONS) {
    if (d.stems.some((s) => k.includes(' ' + s.split(' ').map(foldKey).join(' ')))) {
      if (d.gesture && !out.gesture) out.gesture = d.gesture;
      if (d.expression && !out.expression) out.expression = d.expression;
    }
  }
  return out;
}

export function isGreeting(text) {
  const w = foldWords(text).slice(0, 2).join('');
  return GREETINGS.some((g) => w.startsWith(g));
}

export function findProps(text) {
  const words = foldWords(text);
  const hits = [];
  words.forEach((w, i) => {
    for (const [prop, stems] of Object.entries(PROP_WORDS)) {
      if (stems.some((s) => !s.includes(' ') && (w === s || (s.length >= 4 && w.startsWith(s))))) hits.push({ prop, word: i });
    }
  });
  return hits;
}

export function findSetting(text) {
  const k = ' ' + foldWords(text).join(' ') + ' ';
  let best = null, bestScore = 0;
  for (const [setting, stems] of Object.entries(SETTING_WORDS)) {
    const score = stems.filter((s) => k.includes(' ' + s.split(' ').map(foldKey).join(' '))).length;
    if (score > bestScore) { best = setting; bestScore = score; }
  }
  return best;
}
