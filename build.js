#!/usr/bin/env node
// Inkwell — Build + Deploy
// Minimal patches only — keep it close to local version

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT     = path.dirname(__filename);
const SRC      = path.join(ROOT, 'public');
const OUT      = path.join(ROOT, 'netlify');
const DEPLOY   = process.argv.includes('--deploy');
const DRY_RUN  = process.argv.includes('--dry-run');
const SITE_ID  = 'a31584df-8099-4292-8607-89a982ea9cf4';
const TOKEN    = process.env.NETLIFY_AUTH_TOKEN;
if (DEPLOY && !TOKEN) {
  console.error('NETLIFY_AUTH_TOKEN not set. Run: export NETLIFY_AUTH_TOKEN=...');
  process.exit(1);
}

console.log('🔨 Building Inkwell…');

let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
console.log(`   Source: ${(html.length/1024).toFixed(1)}KB`);

// ── PATCHES ───────────────────────────────────────

// 1. AI endpoint
html = html.replace("fetch('/api/ai',", "fetch('/.netlify/functions/ai',");
console.log('   ✓ AI endpoint');

// 2. Remove the config bar (key is server-side)
html = html.replace(
  /<!-- Config Bar -->[\s\S]*?<\/div>\s*\n/,
  '<!-- Config bar removed — key is server-side -->\n'
);
console.log('   ✓ Config bar removed');

// 3. Move AI_TOOLS to top of script block (prevents undefined errors)
const aiStart = html.indexOf('\nvar AI_TOOLS = [');
if (aiStart > 0) {
  // Count brackets properly to find the real end of the array
  let depth = 0, aiEnd = -1;
  for (let i = aiStart + 1; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') {
      depth--;
      if (depth === 0) {
        // Move past ]; and the newline
        aiEnd = html.indexOf('\n', i) + 1;
        break;
      }
    }
  }
  if (aiEnd > 0) {
    const block = html.slice(aiStart, aiEnd);
    const toolCount = (block.match(/mode:/g) || []).length;
    html = html.slice(0, aiStart) + html.slice(aiEnd);
    const insertAt = html.indexOf('<script>') + '<script>'.length;
    html = html.slice(0, insertAt) + '\n' + block + html.slice(insertAt);
    console.log('   ✓ AI_TOOLS hoisted (' + toolCount + ' tools)');
  }
}

// ── WRITE ─────────────────────────────────────────
if (!DRY_RUN) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`   ✓ index.html written (${(html.length/1024).toFixed(1)}KB)`);

  // Copy static files
  for (const [src, dest] of [
    ['translations.js', 'translations.js'],
    ['recording.js',    'recording.js'],
    ['translate.html',  'translate.html'],
  ]) {
    const srcPath = path.join(SRC, src);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(OUT, dest));
      console.log(`   ✓ ${src}`);
    }
  }

  // audio.js — extract AUDIO_JS + REC_JS from template literal wrappers
  const audioSrc = fs.readFileSync(path.join(SRC, 'audio-engine.js'), 'utf8');
  let audioJs = audioSrc;
  const audioStart = audioSrc.indexOf('const AUDIO_JS = `');
  const recStart = audioSrc.indexOf('const REC_JS = `');
  if (audioStart >= 0 && recStart >= 0) {
    // Extract content between backticks for each block
    const audioContent = audioSrc.slice(
      audioStart + 'const AUDIO_JS = `'.length,
      audioSrc.indexOf('\n`;', audioStart + 20)
    );
    const recContent = audioSrc.slice(
      recStart + 'const REC_JS = `'.length,
      audioSrc.indexOf('\n`;', recStart + 20)
    );
    audioJs = audioContent + '\n\n' + recContent;
  }
  fs.writeFileSync(path.join(OUT, 'audio.js'), audioJs);
  console.log('   ✓ audio.js');
}

if (DEPLOY && !DRY_RUN) {
  console.log('\n🚀 Deploying…');
  execSync(`npx netlify-cli deploy --prod --dir=netlify --functions=netlify/functions --site=${SITE_ID}`, {
    cwd: ROOT, stdio: 'inherit',
    env: { ...process.env, NETLIFY_AUTH_TOKEN: TOKEN }
  });
  console.log('\n✅ https://app.carmencowriter.com');
} else if (DRY_RUN) {
  console.log('\n⚠️  Dry run only.');
} else {
  console.log('\n✅ Build done. Run with --deploy to push.');
}
