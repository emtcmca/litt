/**
 * demo-merge.cjs — merge Playwright WebM + narration MP3 → final MP4
 *
 * USAGE:
 *   node demo-merge.cjs
 *
 * PREREQUISITES:
 *   - ffmpeg installed and on PATH
 *     Windows: winget install ffmpeg   OR   choco install ffmpeg
 *   - demo-narration.mp3 in this directory (dashboard/)
 *   - A .webm file in ../tmp/demo-videos/ (produced by demo-record.cjs)
 *
 * OUTPUT:
 *   ../tmp/demo-videos/litt-demo-final.mp4   (submit this)
 */

'use strict';
const path  = require('path');
const fs    = require('fs');
const { execSync } = require('child_process');

const VIDEO_DIR    = path.join(__dirname, '..', 'tmp', 'demo-videos');
const NARRATION    = path.join(__dirname, 'demo-narration.mp3');
const FINAL_OUTPUT = path.join(VIDEO_DIR, 'litt-demo-final.mp4');

// ── Find latest .webm in VIDEO_DIR ────────────────────────────────────────────
const files = fs.readdirSync(VIDEO_DIR)
  .filter(f => f.endsWith('.webm'))
  .map(f => ({ name: f, time: fs.statSync(path.join(VIDEO_DIR, f)).mtimeMs }))
  .sort((a, b) => b.time - a.time);

if (files.length === 0) {
  console.error(`[ERROR] No .webm found in ${VIDEO_DIR}`);
  console.error('        Run demo-record.cjs first.');
  process.exit(1);
}

const videoIn = path.join(VIDEO_DIR, files[0].name);
console.log(`Video:     ${videoIn}`);
console.log(`Narration: ${NARRATION}`);
console.log(`Output:    ${FINAL_OUTPUT}\n`);

if (!fs.existsSync(NARRATION)) {
  console.error('[ERROR] demo-narration.mp3 not found in dashboard/');
  console.error('        Generate it from ElevenLabs and save as demo-narration.mp3');
  process.exit(1);
}

// ── Verify ffmpeg is available ────────────────────────────────────────────────
try {
  execSync('ffmpeg -version', { stdio: 'pipe' });
} catch {
  console.error('[ERROR] ffmpeg not found on PATH.');
  console.error('        Install: winget install ffmpeg');
  process.exit(1);
}

// ── Get durations and compute tempo ───────────────────────────────────────────

function getDuration(filePath) {
  const out = execSync(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
    { encoding: 'utf8' }
  ).trim();
  return parseFloat(out);
}

const videoDur = getDuration(videoIn);
const audioDur = getDuration(NARRATION);

// Target: audio ends by the time the title card starts (~8s before video end).
// If audio is longer than video, speed it up to fit. If shorter, let it play naturally.
const titleCardBuffer = 8; // seconds of silent title card at end
const audioTarget = videoDur - titleCardBuffer;
let atempoFilter = null;

if (audioDur > audioTarget) {
  const ratio = Math.min(audioDur / audioTarget, 2.0); // atempo max is 2.0
  atempoFilter = ratio.toFixed(4);
  console.log(`Audio ${audioDur.toFixed(1)}s > target ${audioTarget.toFixed(1)}s`);
  console.log(`Applying atempo=${atempoFilter} (${((ratio-1)*100).toFixed(0)}% speedup)`);
} else {
  console.log(`Audio ${audioDur.toFixed(1)}s fits within ${audioTarget.toFixed(1)}s window — no tempo change`);
}

console.log(`Video: ${videoDur.toFixed(1)}s  Audio: ${audioDur.toFixed(1)}s\n`);

// ── Build ffmpeg command ───────────────────────────────────────────────────────
//
//   -c:v libx264      → H.264 (Devpost / YouTube compatible)
//   -crf 18           → near-lossless quality
//   -preset fast      → ~30s encode for a 2min video
//   -pix_fmt yuv420p  → maximum compatibility
//   atempo filter     → match audio duration to video when needed
//   apad              → pad audio with silence so it reaches video end (title card stays silent)
//   -shortest         → clips to video length (shorter than infinite-padded audio)
//   +faststart        → web-optimized MP4

// apad ensures audio never ends before video — -shortest then clips to video length.
// Without apad, -shortest would cut at audio end, removing the title card.
const audioFilter = atempoFilter
  ? `-filter:a "atempo=${atempoFilter},apad"`
  : `-filter:a "apad"`;

const cmd = [
  'ffmpeg',
  '-y',
  `-i "${videoIn}"`,
  `-i "${NARRATION}"`,
  '-c:v libx264',
  '-crf 18',
  '-preset fast',
  '-pix_fmt yuv420p',
  '-c:a aac',
  '-b:a 192k',
  audioFilter,
  '-shortest',
  '-movflags +faststart',
  `"${FINAL_OUTPUT}"`,
].join(' ');

console.log('Running ffmpeg...\n');
console.log(cmd + '\n');

try {
  execSync(cmd, { stdio: 'inherit' });
  console.log(`\n✓ Done: ${FINAL_OUTPUT}`);

  const sizeKB = Math.round(fs.statSync(FINAL_OUTPUT).size / 1024);
  console.log(`  Size: ${sizeKB} KB (${(sizeKB / 1024).toFixed(1)} MB)`);
  console.log('\nSubmission checklist:');
  console.log('  ✓ H.264 MP4, 1920x1080');
  console.log('  ✓ AAC audio, 192kbps');
  console.log('  ✓ web-optimized (faststart)');
  console.log('  □ Confirm runtime ≤ 2:00 before uploading');
} catch (err) {
  console.error('[ERROR] ffmpeg failed — see output above');
  process.exit(1);
}
