'use strict';
/**
 * splice-splash.cjs — replace the splash segment in litt-demo-final.mp4
 *
 * Splice point: 90.3s (where /splash starts in the original recording)
 * Steps:
 *   1. Trim litt-demo-final.mp4 at splice point (stream copy — no re-encode)
 *   2. Convert splash-new.webm → H.264 MP4 segment (no audio)
 *   3. Concatenate via ffmpeg concat demuxer
 *   4. Output: litt-demo-final.mp4 (overwrites)
 *
 * Run: node splice-splash.cjs
 */
const path = require('path');
const fs   = require('fs');
const { execSync } = require('child_process');

const VIDEO_DIR  = path.join(__dirname, '..', 'tmp', 'demo-videos');
const FINAL      = path.join(VIDEO_DIR, 'litt-demo-main.mp4');
const SPLASH_SRC = path.join(VIDEO_DIR, 'splash-new.webm');
const PART_A     = path.join(VIDEO_DIR, '_part_a.mp4');
const PART_B     = path.join(VIDEO_DIR, '_part_b.mp4');
const CONCAT_TXT = path.join(VIDEO_DIR, '_concat.txt');
const OUT_FINAL  = path.join(VIDEO_DIR, 'litt-demo-final.mp4');

// Splice point: scene 7 (/splash) starts at this timestamp in the final MP4.
// Adjust if timing drifted. Check with: ffprobe litt-demo-final.mp4
const SPLICE_SEC = 90.3;

if (!fs.existsSync(FINAL))      { console.error('[ERROR] litt-demo-final.mp4 not found'); process.exit(1); }
if (!fs.existsSync(SPLASH_SRC)) { console.error('[ERROR] splash-new.webm not found — run record-splash.cjs first'); process.exit(1); }

console.log(`Splice point: ${SPLICE_SEC}s`);
console.log('Step 1: trim main video...');
execSync(
  `ffmpeg -y -i "${FINAL}" -t ${SPLICE_SEC} -c copy "${PART_A}"`,
  { stdio: 'inherit' }
);

console.log('\nStep 2: encode new splash segment...');
execSync(
  `ffmpeg -y -i "${SPLASH_SRC}" -c:v libx264 -crf 12 -preset slow -pix_fmt yuv420p -b:v 8000k -maxrate 10000k -bufsize 20000k -an "${PART_B}"`,
  { stdio: 'inherit' }
);

console.log('\nStep 3: concatenate...');
fs.writeFileSync(CONCAT_TXT, `file '${PART_A.replace(/\\/g, '/')}'\nfile '${PART_B.replace(/\\/g, '/')}'\n`);
execSync(
  `ffmpeg -y -f concat -safe 0 -i "${CONCAT_TXT}" -c copy -movflags +faststart "${OUT_FINAL}"`,
  { stdio: 'inherit' }
);

// Cleanup temp files
[PART_A, PART_B, CONCAT_TXT].forEach(f => { try { fs.unlinkSync(f); } catch {} });

const size = Math.round(fs.statSync(OUT_FINAL).size / 1024);
console.log(`\n✓ Done: ${OUT_FINAL}`);
console.log(`  Size: ${size} KB  (${(size/1024).toFixed(1)} MB)`);
console.log('  Verify runtime with: ffprobe litt-demo-final.mp4');
