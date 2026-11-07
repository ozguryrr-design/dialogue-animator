// `da init <dir>`: a starter project folder with every optional part explained.
import path from 'node:path';
import { ensureDir, writeText, writeJSON, exists, log, rel } from '../lib/util.mjs';

const DIALOGUE = `# My first dialogue

## Kitchen
Ali: Good morning! Did you make tea?
Su: (shrugs) I did... but the tea is gone. [sad]
Ali: What?! The whole box?
Su: Relax. I have a plan. [smug]
`;

const README = `This folder is a dialogue-animator project.

  dialogue.md     required — one line per utterance: "Name: text"
                  [tag] sets an expression (happy, sad, angry, surprised, thinking, worried, smug, laugh, scared)
                  (direction) or *direction* is a gesture hint: waves, points, shrugs, facepalm, cheers ...
                  "## Scene name" starts a new scene; words like kitchen / cafe / park / office pick the set
  audio/          optional — best: one file per line, numbered: 01_ali.wav, 02_su.wav ...
                  or one file with the whole dialogue (word timings via whisper if installed)
  characters/     optional — ali.md (a short description) or ali.png (colours are taken from it)
                  or ali.json (exact parameters, see schemas/character.schema.json)
  music/          optional — one music file you have the rights to; otherwise music is synthesized
  project.json    optional — answers: style, format, captions, music, voice ... (schemas/project.schema.json)

Then run:  da doctor .   and   da make .
`;

export async function cli(args) {
  const dir = path.resolve(args._[0] || 'my-video');
  if (exists(path.join(dir, 'dialogue.md'))) throw new Error(`${rel(dir)} already has a dialogue.md — not overwriting.`);
  ensureDir(path.join(dir, 'audio'));
  ensureDir(path.join(dir, 'characters'));
  ensureDir(path.join(dir, 'music'));
  writeText(path.join(dir, 'dialogue.md'), DIALOGUE);
  writeText(path.join(dir, 'README.txt'), README);
  writeText(path.join(dir, 'characters', 'ali.md'), 'Ali is tall, has short black hair, a mustard sweater and round glasses. Energetic.\n');
  writeJSON(path.join(dir, 'project.json'), {
    style: 'kesik-kagit', format: '9:16', captions: 'word', music: 'synth', voice: 'auto',
  });
  log.ok(`created ${rel(dir)}/ (dialogue.md, project.json, characters/ali.md, empty audio/ and music/)`);
  log.info(`next: da doctor ${rel(dir)}  then  da make ${rel(dir)}`);
  return 0;
}
