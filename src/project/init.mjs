// `da init <dir>`: prepares the folders a person can fill. It never touches a script and never writes one,
// unless --sample asks for the sample (an agent must not turn a made-up script into someone's video).
import path from 'node:path';
import { ensureDir, writeText, exists, log, rel } from '../lib/util.mjs';
import { scanProject } from './config.mjs';

const DIALOGUE = `# My first video

## Kitchen
Narrator: It was an ordinary morning. Until someone opened the tea box.
@sfx knock
Ali: Good morning! Did you make tea?
Su: (shrugs) I did... but the tea is gone. [sad]
Ali: What?! The whole box?
Su: Relax. I have a plan. [smug]
`;

const README = `This folder is a dialogue-animator project. You bring what you have; everything except dialogue.md is optional.

  dialogue.md   The script. One utterance per line:
                  Ali: Is the tea gone? [surprised]     [tag] = expression
                  Su: (shrugs) Yes.                     (direction) = gesture hint, not spoken
                  Narrator: It was morning.             narration: heard, nobody on screen speaks it
                  Ali (voice-over): I knew it.          this character is heard, not seen speaking
                  ## Kitchen                            a new scene (kitchen, cafe, office, street, park, palace ...)
                  @sfx thunder                          a sound effect, just before the next line
                  @sfx thunder 12.5 -3dB                ... at 12.5 s, 3 dB quieter
                  0-5 s - a stage direction             optional timed beat

  audio/        Voice for dialogue AND narration. Best: one numbered file per spoken line, in script order:
                01_narrator.wav, 02_ali.wav, 03_su.wav ... Or one file with everything.
  sfx/          Your sound effects. thunder.wav plays where the script says @sfx thunder.
                A file named door, bolt, clink, knock or whoosh replaces the built-in sound of that name.
  music/        One music file you have the rights to. It is looped, faded and ducked under speech.
                Empty: original music is generated. To have none: da answer . --music none
  characters/   ali.md (a short description), ali.png (colours are taken from it) or ali.json (exact).

With an AI agent: "Follow SKILL.md in the dialogue-animator folder and make the video in this folder."
By hand: da next .   then do what it prints, and repeat until it prints DONE.

---
Türkçe: Bu klasöre elinizdekini koyun; dialogue.md dışındaki her şey isteğe bağlı.
  Diyalog ve dış anlatım dialogue.md'ye ("Anlatıcı: metin"), sesler audio/ klasörüne (satır sırasıyla numaralı),
  ses efektleri sfx/ klasörüne (metinde "@sfx adı"), müzik music/ klasörüne, karakter tarifleri characters/ klasörüne.
`;

export async function cli(args) {
  const dir = path.resolve(args._[0] || 'my-video');
  ensureDir(dir);
  const script = scanProject(dir).dialogue;
  if (args.sample && script) throw new Error(`${rel(dir)} already has ${path.basename(script)} — not replacing it with the sample.`);
  const made = [];
  for (const d of ['audio', 'sfx', 'music', 'characters']) if (!exists(path.join(dir, d))) { ensureDir(path.join(dir, d)); made.push(`${d}/`); }
  if (!exists(path.join(dir, 'README.txt'))) { writeText(path.join(dir, 'README.txt'), README); made.push('README.txt'); }
  if (args.sample) {
    writeText(path.join(dir, 'dialogue.md'), DIALOGUE);
    writeText(path.join(dir, 'characters', 'ali.md'), 'Ali is tall, has short black hair, a mustard sweater and round glasses. Energetic.\n');
    made.push('a sample dialogue.md');
  }
  log.ok(made.length ? `${rel(dir)}: created ${made.join(', ')}` : `${rel(dir)}: everything was already there`);
  if (script) log.info(`your script was left as it is: ${path.basename(script)}`);
  else if (!args.sample) log.info(`write your script to ${rel(path.join(dir, 'dialogue.md'))}`);
  log.info(`next: da next ${rel(dir)}`);
  return 0;
}
