const AUDIO_JS = `
// ══════════════════════════════════════════════════════════════
// INKWELL AUDIO ENGINE — Backing Track + Layered Vocal Takes
// ══════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────
let audioCtx = null;
let backingBuffer = null;      // decoded backing track AudioBuffer
let backingSource = null;      // BufferSource for backing track playback
let takeBuffer = null;         // decoded vocal take AudioBuffer (for layered preview)
let takeSource = null;         // BufferSource for vocal take playback
let audioStartTime = 0;
let audioOffset = 0;
let audioPlaying = false;
let audioLoopOn = false;
let loopStart = 0;
let loopEnd = 0;
let audioDuration = 0;         // duration of backing track
let rafId = null;
let waveformData = null;
let audioBarVisible = false;
let activeTakeId = null;       // ID of take currently layered on backing track
let activeTakeLabel = '';      // label of active take for UI

// Gain nodes for mixing
let backingGain = null;
let takeGain = null;
let metronomeGain = null;

// Metronome state
let metronomeOn = false;
let metronomeBPM = 120;
let _metLastScheduledBeat = -1;  // last beat number we scheduled
let _metScheduledNodes = [];     // oscillator nodes to cancel on stop

// ── IndexedDB (shared by audio + recording) ──────
let _audioDB = null;
const AUDIO_DB_NAME = 'inkwell-audio-v2';
const AUDIO_DB_VERSION = 1;

function openAudioDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      // Backing tracks: one per song, keyed by songId
      if (!db.objectStoreNames.contains('backingTracks')) {
        db.createObjectStore('backingTracks', { keyPath: 'songId' });
      }
      // Vocal takes: auto-increment ID, indexed by songId
      if (!db.objectStoreNames.contains('takes')) {
        const store = db.createObjectStore('takes', { keyPath: 'id', autoIncrement: true });
        store.createIndex('bySong', 'songId', { unique: false });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function audioDB() {
  if (!_audioDB) _audioDB = await openAudioDb();
  return _audioDB;
}

// ── Backing Track DB ─────────────────────────────
async function saveBackingTrack(songId, blob, label) {
  const db = await audioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('backingTracks', 'readwrite');
    tx.objectStore('backingTracks').put({ songId, blob, label, ts: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

async function getBackingTrack(songId) {
  const db = await audioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('backingTracks', 'readonly');
    const req = tx.objectStore('backingTracks').get(songId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = e => reject(e.target.error);
  });
}

async function deleteBackingTrack(songId) {
  const db = await audioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('backingTracks', 'readwrite');
    tx.objectStore('backingTracks').delete(songId);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

// ── Takes DB ─────────────────────────────────────
async function saveTake(songId, blob, label, section) {
  const db = await audioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', 'readwrite');
    tx.objectStore('takes').add({
      songId: songId || '',
      blob,
      label,
      section: section || '',
      ts: Date.now(),
      starred: false
    });
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

async function getTakesForSong(songId) {
  const db = await audioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', 'readonly');
    const idx = tx.objectStore('takes').index('bySong');
    const req = idx.getAll(songId || '');
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = e => reject(e.target.error);
  });
}

async function deleteTake(id) {
  const db = await audioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', 'readwrite');
    tx.objectStore('takes').delete(id);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

async function updateTake(id, updates) {
  const db = await audioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', 'readwrite');
    const store = tx.objectStore('takes');
    const req = store.get(id);
    req.onsuccess = () => {
      const record = req.result;
      if (!record) return resolve();
      Object.assign(record, updates);
      store.put(record);
    };
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

// ── Audio Context + Gain Setup ───────────────────
function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    backingGain = audioCtx.createGain();
    backingGain.gain.value = 1.0;
    backingGain.connect(audioCtx.destination);
    takeGain = audioCtx.createGain();
    takeGain.gain.value = 1.0;
    takeGain.connect(audioCtx.destination);
    metronomeGain = audioCtx.createGain();
    metronomeGain.gain.value = 0.5;
    metronomeGain.connect(audioCtx.destination);
    beatGain = audioCtx.createGain();
    beatGain.gain.value = 0.6;
    beatGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

// ── Bar Toggle ───────────────────────────────────
function toggleAudioBar() {
  audioBarVisible = !audioBarVisible;
  const bar = document.getElementById('audioBar');
  if (bar) bar.classList.toggle('visible', audioBarVisible);
  const btn = document.getElementById('audioToggleBtn');
  if (btn) btn.classList.toggle('has-audio', audioBarVisible && !!backingBuffer);
}

// ── Load Backing Track ───────────────────────────
function loadBackingBuffer(buffer, label) {
  ensureAudioCtx();
  stopPlayback();
  deselectTake();
  backingBuffer = buffer;
  audioDuration = buffer.duration;
  audioOffset = 0;
  loopStart = audioDuration * 0.25;
  loopEnd = audioDuration * 0.75;
  audioLoopOn = false;

  // Update UI
  const nameEl = document.getElementById('backingTrackName');
  if (nameEl) nameEl.textContent = label || 'Backing Track';
  const infoEl = document.getElementById('backingTrackInfo');
  if (infoEl) infoEl.className = 'backing-info has-track';
  const wsEl = document.getElementById('waveformSection');
  if (wsEl) wsEl.style.display = 'block';
  const wrapEl = document.getElementById('waveformWrap');
  if (wrapEl) wrapEl.style.display = '';
  const tdEl = document.getElementById('audioTimeDisplay');
  if (tdEl) tdEl.style.display = 'block';
  const toggleBtn = document.getElementById('audioToggleBtn');
  if (toggleBtn) toggleBtn.classList.add('has-audio');
  const loopTag = document.getElementById('loopToggleTag');
  if (loopTag) { loopTag.textContent = '⟲ Loop off'; loopTag.classList.remove('loop-on'); }

  // Show audio bar if hidden
  const bar = document.getElementById('audioBar');
  if (bar && !bar.classList.contains('visible')) {
    bar.classList.add('visible');
    audioBarVisible = true;
  }

  drawWaveform();
  renderLoop();
  updateTimeDisplay(0);
}

// Load a backing track from a file input
function loadAudioFile(input) {
  const file = input.files[0];
  if (!file) return;
  ensureAudioCtx();
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const buffer = await audioCtx.decodeAudioData(e.target.result);
      const label = file.name.replace(/\\.[^.]+$/, '');
      loadBackingBuffer(buffer, label);
      // Persist as backing track for current song
      if (typeof currentSongId !== 'undefined' && currentSongId) {
        await saveBackingTrack(currentSongId, file, label);
      }
      renderTakesList();
    } catch(err) {
      alert('Could not decode audio: ' + err);
    }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}

// Auto-load backing track for a song (called on song load)
async function loadBackingTrackForSong(songId) {
  if (!songId) return;
  try {
    const record = await getBackingTrack(songId);
    if (record && record.blob) {
      ensureAudioCtx();
      const arrBuf = await record.blob.arrayBuffer();
      const buffer = await audioCtx.decodeAudioData(arrBuf);
      loadBackingBuffer(buffer, record.label || 'Backing Track');
    } else {
      // No backing track for this song — clear the waveform
      clearBackingTrack(true); // silent = true, don't delete from DB
    }
  } catch(e) {
    console.warn('Could not load backing track:', e);
  }
}

// Clear backing track from UI (optionally from DB)
async function clearBackingTrack(silentOnly) {
  stopPlayback();
  deselectTake();
  backingBuffer = null;
  audioDuration = 0;
  waveformData = null;
  const nameEl = document.getElementById('backingTrackName');
  if (nameEl) nameEl.textContent = '';
  const infoEl = document.getElementById('backingTrackInfo');
  if (infoEl) infoEl.className = 'backing-info';
  const wrapEl = document.getElementById('waveformWrap');
  if (wrapEl) wrapEl.style.display = 'none';
  const tdEl = document.getElementById('audioTimeDisplay');
  if (tdEl) tdEl.style.display = 'none';
  if (!silentOnly && typeof currentSongId !== 'undefined' && currentSongId) {
    await deleteBackingTrack(currentSongId);
  }
}

// Set a recorded take as the backing track
async function setTakeAsBackingTrack(takeId) {
  const db = await audioDB();
  const take = await new Promise((res, rej) => {
    const tx = db.transaction('takes', 'readonly');
    const req = tx.objectStore('takes').get(takeId);
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
  if (!take) return;
  ensureAudioCtx();
  const arrBuf = await take.blob.arrayBuffer();
  const buffer = await audioCtx.decodeAudioData(arrBuf);
  const label = take.label || 'Recording';
  loadBackingBuffer(buffer, label);
  // Persist
  if (typeof currentSongId !== 'undefined' && currentSongId) {
    await saveBackingTrack(currentSongId, take.blob, label);
  }
  // Remove from takes list (it's now the backing track)
  await deleteTake(takeId);
  if (activeTakeId === takeId) deselectTake();
  renderTakesList();
}

// ── Waveform ─────────────────────────────────────
function drawWaveform() {
  const canvas = document.getElementById('waveCanvas');
  const wrap = document.getElementById('waveformWrap');
  if (!canvas || !wrap || !backingBuffer) return;
  canvas.width = wrap.clientWidth * window.devicePixelRatio;
  canvas.height = wrap.clientHeight * window.devicePixelRatio;
  canvas.style.width = wrap.clientWidth + 'px';
  canvas.style.height = wrap.clientHeight + 'px';
  const W = canvas.width, H = canvas.height;
  const data = backingBuffer.getChannelData(0);
  const step = Math.ceil(data.length / W);
  waveformData = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let max = 0;
    const s = x * step;
    for (let i = 0; i < step; i++) { const v = Math.abs(data[s + i] || 0); if (v > max) max = v; }
    waveformData[x] = max;
  }
  paintWaveform(0);
}

function paintWaveform(currentTime) {
  const canvas = document.getElementById('waveCanvas');
  if (!canvas || !waveformData) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, mid = H / 2;
  const playX = audioDuration > 0 ? Math.floor((currentTime / audioDuration) * W) : 0;

  ctx.fillStyle = '#e8dfd0';
  ctx.fillRect(0, 0, W, H);

  // Loop region tint
  if (audioLoopOn && audioDuration > 0) {
    const lx = Math.floor((loopStart / audioDuration) * W);
    const rx = Math.ceil((loopEnd / audioDuration) * W);
    ctx.fillStyle = 'rgba(196,96,42,0.10)';
    ctx.fillRect(lx, 0, rx - lx, H);
  }

  // Waveform bars
  for (let x = 0; x < W; x++) {
    const amp = waveformData[x] * mid * 0.9;
    ctx.fillStyle = x < playX ? '#9e8e7e' : '#3d3428';
    ctx.fillRect(x, mid - amp, 1, amp * 2);
  }
}

// ── Loop ─────────────────────────────────────────
function renderLoop() {
  const wrap = document.getElementById('waveformWrap');
  const region = document.getElementById('loopRegion');
  const hl = document.getElementById('loopHandleL');
  const hr = document.getElementById('loopHandleR');
  if (!wrap || !audioDuration) return;

  if (!audioLoopOn) {
    if (region) region.style.display = 'none';
    if (hl) hl.style.display = 'none';
    if (hr) hr.style.display = 'none';
    updateLoopLabel();
    return;
  }

  const W = wrap.clientWidth;
  const lx = (loopStart / audioDuration) * W;
  const rx = (loopEnd / audioDuration) * W;

  if (region) { region.style.display = 'block'; region.style.left = lx + 'px'; region.style.width = (rx - lx) + 'px'; }
  if (hl) { hl.style.display = 'flex'; hl.style.left = (lx - 12) + 'px'; }
  if (hr) { hr.style.display = 'flex'; hr.style.left = (rx - 12) + 'px'; }
  updateLoopLabel();
}

function updateLoopLabel() {
  const fmt = s => { const m = Math.floor(s / 60); return m + ':' + (s % 60).toFixed(1).padStart(4, '0'); };
  const el = document.getElementById('loopRangeLabel');
  if (el) el.textContent = audioLoopOn ? fmt(loopStart) + ' → ' + fmt(loopEnd) : '';
}

function toggleLoop() {
  audioLoopOn = !audioLoopOn;
  const tag = document.getElementById('loopToggleTag');
  if (tag) { tag.textContent = audioLoopOn ? '⟲ Loop on' : '⟲ Loop off'; tag.classList.toggle('loop-on', audioLoopOn); }
  renderLoop();
  paintWaveform(getPos());
  if (audioPlaying) startPlayback(getPos());
}

function clearLoop() {
  if (!audioDuration) return;
  loopStart = audioDuration * 0.25;
  loopEnd = audioDuration * 0.75;
  renderLoop();
  paintWaveform(getPos());
  if (audioPlaying && audioLoopOn) startPlayback(loopStart);
}

// ── Playback (dual-source: backing + take) ───────
function togglePlayback() {
  if (audioPlaying) pausePlayback();
  else startPlayback(audioOffset);
}

function startPlayback(offset) {
  // Allow headless playback (no backing buffer) when beat or metronome is on —
  // this drives the rafLoop so beat/click can play during recording without a backing track.
  if (!backingBuffer && !beatOn && !metronomeOn) return;
  ensureAudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  stopSourcesOnly();
  cancelScheduledClicks();
  cancelBeatScheduled();

  if (audioLoopOn && (offset < loopStart || offset >= loopEnd)) offset = loopStart;
  const rate = parseFloat(document.getElementById('speedSelect')?.value || 1);

  // Backing track source (only if we have one)
  if (backingBuffer) {
    backingSource = audioCtx.createBufferSource();
    backingSource.buffer = backingBuffer;
    backingSource.playbackRate.value = rate;
    backingSource.connect(backingGain);
    if (audioLoopOn) {
      backingSource.loopStart = loopStart;
      backingSource.loopEnd = loopEnd;
      backingSource.loop = true;
    } else {
      backingSource.loop = false;
      backingSource.onended = () => {
        if (audioPlaying) {
          audioPlaying = false;
          audioOffset = 0;
          updatePlayBtn();
          cancelAnimationFrame(rafId);
          paintWaveform(0);
          updateTimeDisplay(0);
          const ph = document.getElementById('playhead');
          if (ph) ph.style.left = '0px';
        }
      };
    }
    backingSource.start(0, offset);
  }

  // Vocal take source (layered on top if active)
  if (takeBuffer && activeTakeId) {
    takeSource = audioCtx.createBufferSource();
    takeSource.buffer = takeBuffer;
    takeSource.playbackRate.value = rate;
    takeSource.connect(takeGain);
    // Vocal take plays from the same offset but clamped to its own duration
    const takeOffset = Math.min(offset, takeBuffer.duration);
    if (audioLoopOn) {
      // Loop the vocal if it's shorter than backing, or loop in sync
      takeSource.loopStart = Math.min(loopStart, takeBuffer.duration);
      takeSource.loopEnd = Math.min(loopEnd, takeBuffer.duration);
      takeSource.loop = true;
    }
    takeSource.start(0, takeOffset);
  }

  audioStartTime = audioCtx.currentTime;
  audioOffset = offset;
  audioPlaying = true;
  updatePlayBtn();
  rafLoop();
}

function pausePlayback() {
  audioOffset = getPos();
  stopSourcesOnly();
  cancelScheduledClicks();
  cancelBeatScheduled();
  audioPlaying = false;
  updatePlayBtn();
  cancelAnimationFrame(rafId);
}

function stopPlayback() {
  audioOffset = 0;
  stopSourcesOnly();
  cancelScheduledClicks();
  cancelBeatScheduled();
  audioPlaying = false;
  updatePlayBtn();
  cancelAnimationFrame(rafId);
}

function stopSourcesOnly() {
  if (backingSource) { try { backingSource.stop(); } catch(e) {} backingSource.disconnect(); backingSource = null; }
  if (takeSource) { try { takeSource.stop(); } catch(e) {} takeSource.disconnect(); takeSource = null; }
}

function getPos() {
  if (!audioPlaying) return audioOffset;
  // Headless mode (beat/metronome only, no backing): just measure elapsed time at 1x rate
  if (!backingSource) return audioOffset + (audioCtx.currentTime - audioStartTime);
  const rate = backingSource.playbackRate.value;
  const elapsed = (audioCtx.currentTime - audioStartTime) * rate;
  if (audioLoopOn && loopEnd > loopStart) {
    const len = loopEnd - loopStart;
    const intoLoop = elapsed - Math.max(0, loopStart - audioOffset);
    if (intoLoop < 0) return audioOffset + elapsed;
    return loopStart + (intoLoop % len);
  }
  return Math.min(audioOffset + elapsed, audioDuration);
}

function audioSkip(secs) {
  if (!audioDuration) return;
  const pos = Math.max(0, Math.min(audioDuration, getPos() + secs));
  audioOffset = pos;
  if (audioPlaying) startPlayback(pos);
  else { paintWaveform(pos); updateTimeDisplay(pos); updatePlayheadEl(pos / audioDuration); }
}

function setSpeed(val) {
  if (backingSource) backingSource.playbackRate.value = parseFloat(val);
  if (takeSource) takeSource.playbackRate.value = parseFloat(val);
  if (audioPlaying) startPlayback(getPos());
}

function rafLoop() {
  const pos = getPos();
  paintWaveform(pos);
  updatePlayheadEl(pos / audioDuration);
  updateTimeDisplay(pos);
  scheduleMetronomeClicks();
  scheduleBeatSteps();
  rafId = requestAnimationFrame(rafLoop);
}

function updatePlayheadEl(frac) {
  const wrap = document.getElementById('waveformWrap');
  const ph = document.getElementById('playhead');
  if (wrap && ph) ph.style.left = Math.round(frac * wrap.clientWidth) + 'px';
}

function updatePlayBtn() {
  const btn = document.getElementById('playPauseBtn');
  if (btn) { btn.textContent = audioPlaying ? '⏸' : '▶'; btn.classList.toggle('active', audioPlaying); }
}

function updateTimeDisplay(t) {
  const fmt = s => { const m = Math.floor(s / 60); return m + ':' + Math.floor(s % 60).toString().padStart(2, '0'); };
  const el = document.getElementById('audioTimeDisplay');
  if (el) el.textContent = fmt(t) + ' / ' + fmt(audioDuration);
}

// ── Take Selection (layered playback) ────────────
async function selectTake(takeId) {
  if (activeTakeId === takeId) { deselectTake(); return; } // toggle off
  const db = await audioDB();
  const take = await new Promise((res, rej) => {
    const tx = db.transaction('takes', 'readonly');
    const req = tx.objectStore('takes').get(takeId);
    req.onsuccess = () => res(req.result);
    req.onerror = rej;
  });
  if (!take) return;
  ensureAudioCtx();
  try {
    const arrBuf = await take.blob.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(arrBuf);
    takeBuffer = buffer;
    activeTakeId = takeId;
    activeTakeLabel = take.label;
    // If playing, restart to layer in the take
    if (audioPlaying) startPlayback(getPos());
    renderTakesList();
    updateActiveTakeUI();
  } catch(e) {
    console.error('Could not decode take:', e);
  }
}

function deselectTake() {
  if (takeSource) { try { takeSource.stop(); } catch(e) {} takeSource.disconnect(); takeSource = null; }
  takeBuffer = null;
  activeTakeId = null;
  activeTakeLabel = '';
  if (audioPlaying) startPlayback(getPos());
  renderTakesList();
  updateActiveTakeUI();
}

function updateActiveTakeUI() {
  const el = document.getElementById('activeTakeLabel');
  if (el) {
    if (activeTakeId) {
      el.textContent = '🎤 ' + activeTakeLabel;
      el.style.display = 'block';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }
}

// ── Metronome ────────────────────────────────────
function getBPM() {
  // Check the dedicated BPM input first, then the song tempo chip
  const bpmInput = document.getElementById('metronomeBpmInput');
  if (bpmInput && bpmInput.value) {
    const v = parseInt(bpmInput.value, 10);
    if (v >= 20 && v <= 300) return v;
  }
  const chipEl = document.getElementById('chipTempo');
  if (chipEl) {
    const match = chipEl.textContent.match(/\\d+/);
    if (match) return parseInt(match[0], 10);
  }
  return metronomeBPM || 120;
}

function toggleMetronome() {
  metronomeOn = !metronomeOn;
  const btn = document.getElementById('metronomeToggle');
  if (btn) {
    btn.classList.toggle('loop-on', metronomeOn);
    btn.textContent = metronomeOn ? '♩ Click on' : '♩ Click';
  }
  if (!metronomeOn) cancelScheduledClicks();
  ensurePlaybackControlsVisible();
  // Stop headless playback if both beat and metronome turn off and no backing
  if (!metronomeOn && !beatOn && !backingBuffer && audioPlaying) stopPlayback();
}

// Show the playback controls (play button, etc.) whenever there's something to play —
// backing buffer, beat, or metronome. Without this, the play button stays hidden
// inside #waveformSection and you can't start beat/metronome without a backing track.
function ensurePlaybackControlsVisible() {
  const ws = document.getElementById('waveformSection');
  if (!ws) return;
  const hasAudio = !!backingBuffer || beatOn || metronomeOn;
  if (hasAudio) {
    ws.style.display = 'block';
    // Hide the waveform itself if no backing buffer — only the controls show
    const wrap = document.getElementById('waveformWrap');
    if (wrap) wrap.style.display = backingBuffer ? '' : 'none';
  } else {
    ws.style.display = 'none';
  }
}

function setMetronomeVolume(val) {
  if (metronomeGain) metronomeGain.gain.value = parseFloat(val);
}

function cancelScheduledClicks() {
  _metScheduledNodes.forEach(n => { try { n.stop(); n.disconnect(); } catch(e) {} });
  _metScheduledNodes = [];
  _metLastScheduledBeat = -1;
}

function scheduleMetronomeClicks() {
  if (!metronomeOn || !audioPlaying || !audioCtx) return;
  const bpm = getBPM();
  const beatDuration = 60.0 / bpm;
  const pos = getPos();
  const rate = backingSource ? backingSource.playbackRate.value : 1;
  const lookahead = 0.15; // schedule 150ms ahead

  // Current beat number based on position
  const currentBeat = Math.floor(pos / beatDuration);
  // How far into the current beat we are
  const beatFrac = (pos / beatDuration) - currentBeat;
  // Time until next beat (in real seconds, accounting for playback rate)
  const timeToNextBeat = (1 - beatFrac) * beatDuration / rate;

  // Schedule beats within the lookahead window
  for (let i = 0; i < 3; i++) {
    const beatNum = currentBeat + i + (beatFrac > 0.95 ? 1 : 0);
    if (beatNum <= _metLastScheduledBeat) continue;

    const beatTime = (i === 0 && beatFrac < 0.05)
      ? audioCtx.currentTime
      : audioCtx.currentTime + timeToNextBeat + ((i - 1 + (beatFrac > 0.95 ? 0 : 1)) * beatDuration / rate);

    if (beatTime < audioCtx.currentTime) continue;
    if (beatTime > audioCtx.currentTime + lookahead) break;

    // Accent: beat 1 of each bar (every 4 beats) gets higher pitch
    const isAccent = (beatNum % 4) === 0;
    const freq = isAccent ? 1200 : 800;
    const dur = isAccent ? 0.04 : 0.03;
    const vol = isAccent ? 1.0 : 0.6;

    // Create oscillator click
    const osc = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    clickGain.gain.setValueAtTime(vol, beatTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, beatTime + dur);
    osc.connect(clickGain);
    clickGain.connect(metronomeGain);
    osc.start(beatTime);
    osc.stop(beatTime + dur + 0.01);
    _metScheduledNodes.push(osc);
    _metLastScheduledBeat = beatNum;

    // Clean up old nodes (keep list manageable)
    osc.onended = () => {
      const idx = _metScheduledNodes.indexOf(osc);
      if (idx >= 0) _metScheduledNodes.splice(idx, 1);
    };
  }
}

// ══════════════════════════════════════════════════
// BEAT SEQUENCER (ported from Strike)
// ══════════════════════════════════════════════════

// ── Instrument definitions ───────────────────────
const BEAT_INSTRUMENTS = [
  // gmNote = General MIDI percussion note (channel 10) so MIDI export triggers
  // sensible drum sounds in any DAW with a GM drum kit loaded.
  { name: 'Shaker',    short: 'SH', gen: 'shakerLight', gmNote: 70 }, // Maracas
  { name: 'Tambourine',short: 'TB', gen: 'tambourine',  gmNote: 54 }, // Tambourine
  { name: 'Clap',      short: 'CL', gen: 'clap',        gmNote: 39 }, // Hand Clap
  { name: 'Snap',      short: 'SN', gen: 'snap',        gmNote: 37 }, // Side Stick
  { name: 'Stomp',     short: 'ST', gen: 'stomp',       gmNote: 36 }, // Bass Drum 1
  { name: 'Cabasa',    short: 'CB', gen: 'cabasa',      gmNote: 69 }, // Cabasa
  { name: 'Cowbell',   short: 'CW', gen: 'cowbell',     gmNote: 56 }, // Cowbell
  { name: 'HiHat',     short: 'HH', gen: 'hihat',       gmNote: 42 }, // Closed Hi-Hat
];
const BEAT_STEPS = 16;
const BEAT_PATTERN_COUNT = 4;
const BEAT_PATTERN_NAMES = ['A', 'B', 'C', 'D'];

// ── State ────────────────────────────────────────
let beatOn = false;             // master on/off
let beatSamples = [];           // AudioBuffer[] for each instrument
let beatSamplesReady = false;
let beatPatterns = [];          // 4 patterns, each = Float32Array(8 * 16)
let beatCurrentPattern = 0;
let beatGain = null;            // GainNode for beat mix
let beatVolume = 0.6;
let beatPlaying = false;
let beatNextStep = 0;           // next step counter to schedule
let beatLastSoundedStep = -1;   // for UI highlight
let beatScheduledNodes = [];    // track scheduled sources to cancel
let beatCurrentStepUI = -1;     // for grid highlight

// ── Procedural sample generator (Phase 3) ────────
// Port of Strike's generate_samples.py to Web Audio offline rendering
function generateBeatSamples() {
  if (beatSamplesReady) return Promise.resolve();
  ensureAudioCtx();
  const SR = audioCtx.sampleRate;

  function makeEnv(length, attack, decay, curve) {
    const e = new Float32Array(length);
    const nA = Math.max(1, Math.floor(attack * SR));
    const nD = Math.max(1, Math.floor(decay * SR));
    for (let i = 0; i < nA && i < length; i++) e[i] = i / nA;
    for (let i = 0; i < nD && (nA + i) < length; i++) e[nA + i] = Math.exp(-curve * (i / nD));
    return e;
  }

  function noise(n) {
    const buf = new Float32Array(n);
    for (let i = 0; i < n; i++) buf[i] = Math.random() * 2 - 1;
    return buf;
  }

  function lpf(x, freq) {
    const rc = 1.0 / (2 * Math.PI * freq);
    const alpha = (1.0 / SR) / (rc + 1.0 / SR);
    const y = new Float32Array(x.length);
    y[0] = x[0] * alpha;
    for (let i = 1; i < x.length; i++) y[i] = y[i-1] + alpha * (x[i] - y[i-1]);
    return y;
  }

  function hpf(x, freq) {
    const rc = 1.0 / (2 * Math.PI * freq);
    const alpha = rc / (rc + 1.0 / SR);
    const y = new Float32Array(x.length);
    y[0] = x[0];
    for (let i = 1; i < x.length; i++) y[i] = alpha * (y[i-1] + x[i] - x[i-1]);
    return y;
  }

  function mul(a, b) {
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] * (i < b.length ? b[i] : 0);
    return out;
  }

  function normalize(buf) {
    let peak = 0;
    for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > peak) peak = v; }
    if (peak > 0) for (let i = 0; i < buf.length; i++) buf[i] = buf[i] / peak * 0.95;
    return buf;
  }

  function toBuffer(samples) {
    normalize(samples);
    const buf = audioCtx.createBuffer(1, samples.length, SR);
    buf.getChannelData(0).set(samples);
    return buf;
  }

  // Shaker Light
  function shakerLight() {
    const n = Math.floor(0.12 * SR);
    return toBuffer(mul(lpf(hpf(noise(n), 4500), 9500), makeEnv(n, 0.005, 0.10, 4.0)));
  }

  // Tambourine
  function tambourine() {
    const n = Math.floor(0.30 * SR);
    const body = hpf(noise(n), 5000);
    const partials = new Float32Array(n);
    [7500, 9200, 11400, 6300].forEach((f, idx) => {
      const amp = [0.6, 0.4, 0.3, 0.5][idx];
      for (let i = 0; i < n; i++) partials[i] += amp * Math.sin(2 * Math.PI * f * i / SR);
    });
    const mix = new Float32Array(n);
    for (let i = 0; i < n; i++) mix[i] = body[i] * 0.6 + partials[i] * 0.4;
    return toBuffer(mul(mix, makeEnv(n, 0.003, 0.28, 3.0)));
  }

  // Clap
  function clap() {
    const n = Math.floor(0.25 * SR);
    const out = new Float32Array(n);
    [[0, 0.7], [11, 1.0], [22, 0.85], [33, 0.6]].forEach(([ms, amp]) => {
      const off = Math.floor(ms / 1000 * SR);
      const bLen = Math.floor(0.018 * SR);
      const burst = lpf(hpf(noise(bLen), 800), 4500);
      for (let i = 0; i < bLen && (off+i) < n; i++) out[off+i] += burst[i] * Math.exp(-6 * i/bLen) * amp;
    });
    const tOff = Math.floor(0.04 * SR);
    const tLen = n - tOff;
    const tail = hpf(noise(tLen), 1200);
    for (let i = 0; i < tLen; i++) out[tOff+i] += tail[i] * Math.exp(-8 * i/tLen) * 0.25;
    return toBuffer(out);
  }

  // Snap
  function snap() {
    const n = Math.floor(0.06 * SR);
    return toBuffer(mul(lpf(hpf(noise(n), 2500), 7000), makeEnv(n, 0.001, 0.04, 8.0)));
  }

  // Stomp
  function stomp() {
    const n = Math.floor(0.22 * SR);
    const out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const f0 = 75 * Math.exp(-t * 12);
      phase += 2 * Math.PI * f0 / SR;
      out[i] = Math.sin(phase) * Math.exp(-t * 14);
    }
    const bodyNoise = lpf(noise(n), 600);
    for (let i = 0; i < n; i++) out[i] += bodyNoise[i] * Math.exp(-(i/SR) * 18) * 0.4;
    return toBuffer(out);
  }

  // Cabasa
  function cabasa() {
    const n = Math.floor(0.10 * SR);
    const nz = noise(n);
    const metallic = bpf(nz, 6500, 2.0);
    const bright = hpf(nz, 5000);
    const mix = new Float32Array(n);
    for (let i = 0; i < n; i++) mix[i] = metallic[i] * 0.7 + bright[i] * 0.4;
    return toBuffer(mul(mix, makeEnv(n, 0.003, 0.085, 4.0)));
  }

  // Bandpass filter for cabasa
  function bpf(x, fCenter, q) {
    const w0 = 2 * Math.PI * fCenter / SR;
    const alpha = Math.sin(w0) / (2 * q);
    const cosw = Math.cos(w0);
    const a0 = 1 + alpha;
    const b0 = alpha / a0, b1 = 0, b2 = -alpha / a0;
    const a1 = -2 * cosw / a0, a2 = (1 - alpha) / a0;
    const y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      y[i] = b0 * x[i]
        + (i >= 1 ? b1 * x[i-1] : 0)
        + (i >= 2 ? b2 * x[i-2] : 0)
        - (i >= 1 ? a1 * y[i-1] : 0)
        - (i >= 2 ? a2 * y[i-2] : 0);
    }
    return y;
  }

  // Cowbell
  function cowbell() {
    const n = Math.floor(0.30 * SR);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      out[i] = (Math.sin(2 * Math.PI * 540 * t) + 0.7 * Math.sin(2 * Math.PI * 800 * t)) * Math.exp(-t * 8);
    }
    const clickLen = Math.floor(0.005 * SR);
    const click = noise(clickLen);
    for (let i = 0; i < clickLen; i++) out[i] += click[i] * Math.exp(-5 * i/clickLen) * 0.6;
    return toBuffer(out);
  }

  // Hi-Hat (not in Strike, but useful for songwriters)
  function hihat() {
    const n = Math.floor(0.08 * SR);
    return toBuffer(mul(lpf(hpf(noise(n), 7000), 14000), makeEnv(n, 0.001, 0.06, 6.0)));
  }

  const generators = { shakerLight, tambourine, clap, snap, stomp, cabasa, cowbell, hihat };

  beatSamples = BEAT_INSTRUMENTS.map(inst => generators[inst.gen]());
  beatSamplesReady = true;
  return Promise.resolve();
}

// ── Pattern data model ───────────────────────────
function initBeatPatterns() {
  if (beatPatterns.length > 0) return;
  for (let p = 0; p < BEAT_PATTERN_COUNT; p++) {
    beatPatterns.push(new Float32Array(BEAT_INSTRUMENTS.length * BEAT_STEPS));
  }
  // Seed pattern A with a basic groove
  const p0 = beatPatterns[0];
  // HiHat on every other step (8th notes)
  for (let s = 0; s < BEAT_STEPS; s += 2) p0[7 * BEAT_STEPS + s] = s % 4 === 0 ? 0.9 : 0.6;
  // Clap on 4 and 12 (backbeat)
  p0[2 * BEAT_STEPS + 4] = 1.0;
  p0[2 * BEAT_STEPS + 12] = 1.0;
  // Stomp on 0 and 8 (downbeats)
  p0[4 * BEAT_STEPS + 0] = 0.9;
  p0[4 * BEAT_STEPS + 8] = 0.85;
  // Snap accent on 6 and 14
  p0[3 * BEAT_STEPS + 6] = 0.7;
  p0[3 * BEAT_STEPS + 14] = 0.7;
}

function beatVelocity(pattern, track, step) {
  return beatPatterns[pattern][track * BEAT_STEPS + step];
}

function setBeatVelocity(pattern, track, step, v) {
  beatPatterns[pattern][track * BEAT_STEPS + step] = Math.max(0, Math.min(1, v));
}

function toggleBeatStep(track, step) {
  const cur = beatVelocity(beatCurrentPattern, track, step);
  setBeatVelocity(beatCurrentPattern, track, step, cur > 0 ? 0 : 0.85);
  renderBeatGrid();
  persistBeatPatterns();
}

function cycleBeatVelocity(track, step, e) {
  if (e) e.preventDefault();
  const levels = [0, 0.4, 0.6, 0.85, 1.0];
  const cur = beatVelocity(beatCurrentPattern, track, step);
  // Find next level
  let idx = 0;
  for (let i = levels.length - 1; i >= 0; i--) { if (Math.abs(cur - levels[i]) < 0.05) { idx = i; break; } }
  const next = levels[(idx + 1) % levels.length];
  setBeatVelocity(beatCurrentPattern, track, step, next);
  renderBeatGrid();
  persistBeatPatterns();
}

function clearBeatPattern() {
  beatPatterns[beatCurrentPattern].fill(0);
  renderBeatGrid();
  persistBeatPatterns();
}

function switchBeatPattern(idx) {
  beatCurrentPattern = idx;
  renderBeatGrid();
  persistBeatPatterns();
}

// ── Beat pattern persistence ──────────────────────
// Serialize patterns to plain arrays (Firestore can't store Float32Array directly).
// Returns null if patterns are uninitialized OR all empty (don't bloat the song doc).
function serializeBeatData() {
  if (!beatPatterns || beatPatterns.length === 0) return null;
  const arrays = beatPatterns.map(p => Array.from(p));
  const allEmpty = arrays.every(a => a.every(v => v === 0));
  if (allEmpty) return null;
  return {
    patterns: arrays,
    activePattern: beatCurrentPattern,
    instrumentCount: BEAT_INSTRUMENTS.length,
    steps: BEAT_STEPS,
    version: 1
  };
}

// Restore patterns from a song document. Handles missing data, mismatched
// instrument/step counts (forward-compat) by truncating or padding with zeros.
function deserializeBeatData(data) {
  // Always start with fresh empty patterns (no demo seed when loading a song)
  beatPatterns = [];
  for (let p = 0; p < BEAT_PATTERN_COUNT; p++) {
    beatPatterns.push(new Float32Array(BEAT_INSTRUMENTS.length * BEAT_STEPS));
  }
  if (!data || !data.patterns) return;

  const savedTracks = data.instrumentCount || BEAT_INSTRUMENTS.length;
  const savedSteps = data.steps || BEAT_STEPS;
  const copyTracks = Math.min(savedTracks, BEAT_INSTRUMENTS.length);
  const copySteps = Math.min(savedSteps, BEAT_STEPS);

  for (let p = 0; p < Math.min(data.patterns.length, BEAT_PATTERN_COUNT); p++) {
    const saved = data.patterns[p];
    if (!Array.isArray(saved)) continue;
    for (let t = 0; t < copyTracks; t++) {
      for (let s = 0; s < copySteps; s++) {
        const v = saved[t * savedSteps + s] || 0;
        beatPatterns[p][t * BEAT_STEPS + s] = v;
      }
    }
  }

  if (typeof data.activePattern === 'number') {
    beatCurrentPattern = Math.max(0, Math.min(BEAT_PATTERN_COUNT - 1, data.activePattern));
  } else {
    beatCurrentPattern = 0;
  }

  if (beatOn) renderBeatGrid();
}

// Save patterns to the current song. Debounced — multiple rapid edits batch into one write.
let _beatSaveTimer = null;
function persistBeatPatterns() {
  if (typeof currentSongId === 'undefined' || !currentSongId) return;
  if (typeof saveSong !== 'function') return;
  clearTimeout(_beatSaveTimer);
  _beatSaveTimer = setTimeout(() => {
    try { saveSong(); } catch(e) { console.warn('Beat save failed:', e); }
  }, 600);
}

// ── Beat sequencer scheduler ─────────────────────
function toggleBeat() {
  beatOn = !beatOn;
  const btn = document.getElementById('beatToggle');
  if (btn) {
    btn.classList.toggle('loop-on', beatOn);
    btn.textContent = beatOn ? '🥁 Beat on' : '🥁 Beat';
  }
  const section = document.getElementById('beatSection');
  if (section) section.style.display = beatOn ? 'block' : 'none';
  if (beatOn && !beatSamplesReady) {
    generateBeatSamples().then(() => renderBeatGrid());
  }
  ensurePlaybackControlsVisible();
  // Stop headless playback if both beat and metronome turn off and no backing
  if (!beatOn && !metronomeOn && !backingBuffer && audioPlaying) stopPlayback();
  if (beatOn) renderBeatGrid();
}

function scheduleBeatSteps() {
  if (!beatOn || !audioPlaying || !beatSamplesReady) return;
  const bpm = getBPM();
  const stepDur = 60.0 / bpm / 4.0; // 16th note
  const rate = backingSource ? backingSource.playbackRate.value : 1;
  const pos = getPos();
  const lookahead = 0.15;

  // Current step based on position
  const currentBeat = Math.floor(pos / stepDur);

  for (let i = 0; i < 4; i++) {
    const stepCounter = currentBeat + i;
    if (stepCounter <= beatLastSoundedStep) continue;

    const stepTime = stepCounter * stepDur;
    const delta = (stepTime - pos) / rate;
    if (delta > lookahead) break;
    if (delta < -0.05) continue; // already passed

    const when = Math.max(audioCtx.currentTime, audioCtx.currentTime + delta);
    const stepInBar = ((stepCounter % BEAT_STEPS) + BEAT_STEPS) % BEAT_STEPS;

    // Schedule hits for each instrument
    for (let t = 0; t < BEAT_INSTRUMENTS.length; t++) {
      const v = beatVelocity(beatCurrentPattern, t, stepInBar);
      if (v <= 0 || !beatSamples[t]) continue;

      const src = audioCtx.createBufferSource();
      src.buffer = beatSamples[t];
      const hitGain = audioCtx.createGain();
      hitGain.gain.value = v * beatVolume;
      src.connect(hitGain);
      hitGain.connect(beatGain);
      src.start(when);
      beatScheduledNodes.push(src);
      src.onended = () => {
        const idx = beatScheduledNodes.indexOf(src);
        if (idx >= 0) beatScheduledNodes.splice(idx, 1);
      };
    }

    beatLastSoundedStep = stepCounter;

    // Update UI step highlight
    if (delta <= 0.05) {
      beatCurrentStepUI = stepInBar;
      highlightBeatStep(stepInBar);
    }
  }
}

function cancelBeatScheduled() {
  beatScheduledNodes.forEach(n => { try { n.stop(); n.disconnect(); } catch(e) {} });
  beatScheduledNodes = [];
  beatLastSoundedStep = -1;
  beatCurrentStepUI = -1;
  highlightBeatStep(-1);
}

// ── Beat grid UI (Phase 2) ───────────────────────
function renderBeatGrid() {
  const container = document.getElementById('beatGrid');
  if (!container) return;
  container.innerHTML = '';

  // Pattern selector row
  const patRow = document.createElement('div');
  patRow.className = 'beat-pattern-row';
  BEAT_PATTERN_NAMES.forEach((name, idx) => {
    const btn = document.createElement('button');
    btn.className = 'beat-pattern-btn' + (idx === beatCurrentPattern ? ' active' : '');
    btn.textContent = name;
    btn.onclick = () => switchBeatPattern(idx);
    patRow.appendChild(btn);
  });
  // Clear button
  const clearBtn = document.createElement('button');
  clearBtn.className = 'beat-clear-btn';
  clearBtn.textContent = '✕';
  clearBtn.title = _tr('Clear pattern', 'Vider le patron');
  clearBtn.onclick = clearBeatPattern;
  patRow.appendChild(clearBtn);
  // Volume slider
  const volWrap = document.createElement('div');
  volWrap.className = 'beat-vol-wrap';
  const volSlider = document.createElement('input');
  volSlider.type = 'range'; volSlider.min = '0'; volSlider.max = '1'; volSlider.step = '0.05';
  volSlider.value = beatVolume; volSlider.className = 'metronome-vol-slider';
  volSlider.title = _tr('Beat volume', 'Volume du rythme');
  volSlider.oninput = function() { beatVolume = parseFloat(this.value); };
  volWrap.appendChild(volSlider);
  patRow.appendChild(volWrap);
  container.appendChild(patRow);

  // Step grid
  const grid = document.createElement('div');
  grid.className = 'beat-grid';
  grid.id = 'beatStepGrid';

  BEAT_INSTRUMENTS.forEach((inst, t) => {
    // Label
    const label = document.createElement('div');
    label.className = 'beat-label';
    label.textContent = inst.short;
    label.title = inst.name;
    grid.appendChild(label);

    // Steps
    for (let s = 0; s < BEAT_STEPS; s++) {
      const cell = document.createElement('div');
      const v = beatVelocity(beatCurrentPattern, t, s);
      cell.className = 'beat-cell'
        + (v > 0 ? ' hit' : '')
        + (s % 4 === 0 ? ' bar-start' : '')
        + (s === beatCurrentStepUI ? ' playing' : '');
      if (v > 0) cell.style.opacity = 0.3 + v * 0.7;
      cell.dataset.t = t;
      cell.dataset.s = s;
      cell.onclick = () => toggleBeatStep(t, s);
      cell.oncontextmenu = (e) => cycleBeatVelocity(t, s, e);
      grid.appendChild(cell);
    }
  });

  container.appendChild(grid);
}

function highlightBeatStep(step) {
  const grid = document.getElementById('beatStepGrid');
  if (!grid) return;
  grid.querySelectorAll('.beat-cell.playing').forEach(c => c.classList.remove('playing'));
  if (step < 0) return;
  grid.querySelectorAll('.beat-cell').forEach(c => {
    if (parseInt(c.dataset.s) === step) c.classList.add('playing');
  });
}

// ── Audio Export ──────────────────────────────────
function showExportDialog() {
  if (!backingBuffer && !takeBuffer) {
    alert('No audio to export. Load a backing track or record a take first.');
    return;
  }
  // Remove existing dialog
  document.getElementById('exportDialog')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'exportDialog';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;background:rgba(26,21,16,0.45);backdrop-filter:blur(3px);';

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--cream-light);border:1px solid var(--rule);border-radius:12px;padding:22px 24px;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(26,21,16,0.25);';

  const title = document.createElement('div');
  title.style.cssText = 'font-family:var(--font-display);font-size:16px;color:var(--ink);margin-bottom:14px;font-weight:500;';
  title.textContent = 'Export Audio Mix';
  box.appendChild(title);

  // Checkboxes
  function makeCheck(id, label, checked, disabled) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;font-family:var(--font-body);font-size:13px;color:var(--ink-mid);cursor:pointer;' + (disabled ? 'opacity:0.4;pointer-events:none;' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.id = id; cb.checked = checked; cb.disabled = disabled;
    cb.style.cssText = 'accent-color:var(--amber);width:16px;height:16px;';
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode(label));
    return wrap;
  }

  box.appendChild(makeCheck('expBacking', _tr('Backing track', "Piste d'accompagnement"), !!backingBuffer, !backingBuffer));
  box.appendChild(makeCheck('expVocal', _tr('Vocal take', 'Prise vocale') + (activeTakeLabel ? ' (' + activeTakeLabel + ')' : ''), !!takeBuffer, !takeBuffer));
  box.appendChild(makeCheck('expBeat', _tr('Beat pattern', 'Patron rythmique'), beatOn && beatSamplesReady, !beatSamplesReady));
  box.appendChild(makeCheck('expMetronome', _tr('Metronome click', 'Clic du metronome'), false, false));

  // Stems checkbox (separates layers into a ZIP for DAW import)
  const stemsWrap = document.createElement('label');
  stemsWrap.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 8px;margin:8px 0 0;font-family:var(--font-body);font-size:13px;color:var(--ink-mid);cursor:pointer;background:var(--cream);border:1px solid var(--rule);border-radius:6px;';
  const stemsCb = document.createElement('input');
  stemsCb.type = 'checkbox'; stemsCb.id = 'expStems';
  stemsCb.style.cssText = 'accent-color:var(--amber);width:16px;height:16px;';
  stemsWrap.appendChild(stemsCb);
  const stemsLabel = document.createElement('div');
  stemsLabel.style.cssText = 'flex:1;';
  stemsLabel.innerHTML = `<div style="font-weight:500;">${_tr('Export as stems (separate WAVs in a ZIP)', 'Exporter en pistes séparées (WAV dans un ZIP)')}</div>` +
    `<div style="font-size:11px;color:var(--ink-faint);margin-top:2px;">${_tr('Best for importing into a DAW (Logic, Ableton, Pro Tools, etc.)', 'Idéal pour importer dans un DAW (Logic, Ableton, Pro Tools, etc.)')}</div>`;
  stemsWrap.appendChild(stemsLabel);
  box.appendChild(stemsWrap);

  // MIDI export option
  if (beatPatterns.length > 0) {
    box.appendChild(makeCheck('expMidi', _tr('Include beat MIDI file (.mid)', 'Inclure un fichier MIDI du patron (.mid)'), false, false));
  }

  // Format
  const fmtWrap = document.createElement('div');
  fmtWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 4px;align-items:center;';
  const fmtLabel = document.createElement('span');
  fmtLabel.style.cssText = 'font-family:var(--font-body);font-size:12px;color:var(--ink-faint);width:100%;margin-bottom:4px;';
  fmtLabel.textContent = _tr('Format:', 'Format :');
  fmtWrap.appendChild(fmtLabel);

  function makeFmtBtn(val, label, selected) {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.fmt = val;
    b.className = 'export-fmt-btn' + (selected ? ' selected' : '');
    b.style.cssText = 'padding:6px 14px;border-radius:6px;font-family:var(--font-body);font-size:12px;cursor:pointer;border:1px solid var(--rule);background:' + (selected ? 'var(--ink)' : 'none') + ';color:' + (selected ? 'var(--cream)' : 'var(--ink-mid)') + ';transition:all 0.1s;';
    b.onclick = () => {
      fmtWrap.querySelectorAll('button').forEach(bb => { bb.style.background = 'none'; bb.style.color = 'var(--ink-mid)'; bb.classList.remove('selected'); });
      b.style.background = 'var(--ink)'; b.style.color = 'var(--cream)'; b.classList.add('selected');
    };
    return b;
  }
  fmtWrap.appendChild(makeFmtBtn('wav16', 'WAV 16-bit', true));
  fmtWrap.appendChild(makeFmtBtn('wav24', 'WAV 24-bit', false));
  fmtWrap.appendChild(makeFmtBtn('mp3', 'MP3', false));
  box.appendChild(fmtWrap);

  // Note when MP3 is selected for stems
  const fmtNote = document.createElement('div');
  fmtNote.id = 'fmtNote';
  fmtNote.style.cssText = 'font-size:11px;color:var(--ink-faint);font-style:italic;margin-top:4px;display:none;';
  fmtNote.textContent = _tr('Note: stems are always exported as WAV (MP3 setting only applies to mixed export).', 'Note : les pistes séparées sont toujours en WAV (le format MP3 ne s\'applique qu\'à l\'export mixé).');
  box.appendChild(fmtNote);

  // Update note when stems is checked
  const updateFmtNote = () => {
    const isStems = stemsCb.checked;
    const fmt = fmtWrap.querySelector('.selected')?.dataset.fmt || 'wav16';
    fmtNote.style.display = (isStems && fmt === 'mp3') ? 'block' : 'none';
  };
  stemsCb.addEventListener('change', updateFmtNote);
  fmtWrap.addEventListener('click', () => setTimeout(updateFmtNote, 0));

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;margin-top:16px;';

  const exportBtn = document.createElement('button');
  exportBtn.textContent = _tr('Export', 'Exporter');
  exportBtn.style.cssText = 'flex:1;padding:10px;background:var(--ink);color:var(--cream);border:none;border-radius:7px;font-family:var(--font-body);font-size:13px;cursor:pointer;font-weight:500;';
  exportBtn.onclick = async () => {
    const fmt = fmtWrap.querySelector('.selected')?.dataset.fmt || 'wav16';
    const opts = {
      backing: document.getElementById('expBacking')?.checked,
      vocal: document.getElementById('expVocal')?.checked,
      beat: document.getElementById('expBeat')?.checked,
      metronome: document.getElementById('expMetronome')?.checked,
      stems: stemsCb.checked,
      midi: document.getElementById('expMidi')?.checked,
      format: fmt,
      bitDepth: fmt === 'wav24' ? 24 : 16
    };
    exportBtn.textContent = _tr('Rendering...', 'Export en cours...');
    exportBtn.disabled = true;
    try {
      await exportAudioMix(opts);
    } catch(e) {
      alert('Export failed: ' + e.message);
    }
    overlay.remove();
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = _tr('Cancel', 'Annuler');
  cancelBtn.style.cssText = 'padding:10px 14px;background:none;border:none;color:var(--ink-faint);cursor:pointer;font-size:13px;font-family:var(--font-body);';
  cancelBtn.onclick = () => overlay.remove();

  btnRow.appendChild(exportBtn);
  btnRow.appendChild(cancelBtn);
  box.appendChild(btnRow);

  overlay.appendChild(box);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function exportAudioMix(opts) {
  const songTitle = document.getElementById('songTitle')?.value || 'Carmen Mix';
  const slug = songTitle.replace(/[^a-zA-Z0-9À-ÿ ]/g, '').replace(/\\s+/g, '-').toLowerCase();

  // ── STEMS PATH: separate WAV per layer in a ZIP ──
  if (opts.stems) {
    if (!opts.backing && !opts.vocal && !opts.beat && !opts.metronome) {
      alert(_tr('Select at least one layer to include.', 'Sélectionnez au moins une piste à inclure.'));
      return;
    }
    const zipBlob = await exportStems(opts, slug);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = slug + '-stems.zip';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 1000);
    return;
  }

  // ── MIXED PATH: render all selected layers into one file ──
  let duration = 0;
  if (opts.backing && backingBuffer) duration = Math.max(duration, backingBuffer.duration);
  if (opts.vocal && takeBuffer) duration = Math.max(duration, takeBuffer.duration);
  // If only beat/metronome, default to backing duration if available, else 30s
  if (duration === 0) {
    if (backingBuffer) duration = backingBuffer.duration;
    else if (opts.beat || opts.metronome) duration = 30;
    else { alert(_tr('Nothing to export.', 'Rien à exporter.')); return; }
  }

  const sampleRate = 44100;
  const channels = 2;
  const offline = new OfflineAudioContext(channels, Math.ceil(duration * sampleRate), sampleRate);

  // Render backing track
  if (opts.backing && backingBuffer) {
    const src = offline.createBufferSource();
    src.buffer = backingBuffer;
    src.connect(offline.destination);
    src.start(0);
  }

  // Render vocal take
  if (opts.vocal && takeBuffer) {
    const src = offline.createBufferSource();
    src.buffer = takeBuffer;
    src.connect(offline.destination);
    src.start(0);
  }

  // Render beat pattern
  if (opts.beat && beatSamplesReady && beatPatterns.length > 0) {
    const bpm = getBPM();
    const stepDur = 60.0 / bpm / 4.0;
    const totalSteps = Math.ceil(duration / stepDur);
    const bGain = offline.createGain();
    bGain.gain.value = beatVolume;
    bGain.connect(offline.destination);
    for (let s = 0; s < totalSteps; s++) {
      const t = s * stepDur;
      if (t >= duration) break;
      const stepInBar = s % BEAT_STEPS;
      for (let tr = 0; tr < BEAT_INSTRUMENTS.length; tr++) {
        const v = beatVelocity(beatCurrentPattern, tr, stepInBar);
        if (v <= 0 || !beatSamples[tr]) continue;
        const src = offline.createBufferSource();
        src.buffer = beatSamples[tr];
        const hGain = offline.createGain();
        hGain.gain.value = v;
        src.connect(hGain);
        hGain.connect(bGain);
        src.start(t);
      }
    }
  }

  // Render metronome clicks
  if (opts.metronome) {
    const bpm = getBPM();
    const beatDuration = 60.0 / bpm;
    const totalBeats = Math.ceil(duration / beatDuration);
    const metGain = offline.createGain();
    metGain.gain.value = 0.5;
    metGain.connect(offline.destination);
    for (let i = 0; i < totalBeats; i++) {
      const t = i * beatDuration;
      if (t >= duration) break;
      const isAccent = (i % 4) === 0;
      const osc = offline.createOscillator();
      const cg = offline.createGain();
      osc.frequency.value = isAccent ? 1200 : 800;
      osc.type = 'sine';
      const clickDur = isAccent ? 0.04 : 0.03;
      cg.gain.setValueAtTime(isAccent ? 1.0 : 0.6, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + clickDur);
      osc.connect(cg);
      cg.connect(metGain);
      osc.start(t);
      osc.stop(t + clickDur + 0.01);
    }
  }

  // Render offline
  const rendered = await offline.startRendering();

  // Encode based on format choice
  let blob, ext;
  if (opts.format === 'mp3') {
    blob = await encodeMP3(rendered);
    ext = '.mp3';
  } else if (opts.format === 'wav24') {
    blob = encodeWAV(rendered, 24);
    ext = '.wav';
  } else {
    blob = encodeWAV(rendered, 16);
    ext = '.wav';
  }

  // Download mix
  const downloads = [{ blob, name: slug + ext }];

  // Optionally add MIDI alongside the mix
  if (opts.midi && beatPatterns.length > 0) {
    downloads.push({ blob: encodeMIDI(), name: slug + '-beat.mid' });
  }

  for (const d of downloads) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(d.blob);
    a.download = d.name;
    document.body.appendChild(a);
    a.click();
    await new Promise(r => setTimeout(r, 200));
    a.remove();
    URL.revokeObjectURL(a.href);
  }
}

function encodeWAV(audioBuffer, bitDepth) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = (bitDepth === 24) ? 24 : 16;
  const length = audioBuffer.length;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, s) { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); }
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels
  const channels = [];
  for (let c = 0; c < numChannels; c++) channels.push(audioBuffer.getChannelData(c));
  let offset = 44;

  if (bitsPerSample === 24) {
    // 24-bit signed little-endian PCM
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]));
        const intVal = sample < 0 ? Math.round(sample * 0x800000) : Math.round(sample * 0x7FFFFF);
        view.setUint8(offset, intVal & 0xFF);
        view.setUint8(offset + 1, (intVal >> 8) & 0xFF);
        view.setUint8(offset + 2, (intVal >> 16) & 0xFF);
        offset += 3;
      }
    }
  } else {
    // 16-bit signed little-endian PCM
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

// ── MIDI Export (Type-0 SMF) ──────────────────────
function encodeMIDI() {
  const ticksPerQuarter = 480;
  const drumChannel = 9; // GM channel 10 (0-indexed)
  const noteLengthTicks = 30;
  const bpm = getBPM();
  const usPerQuarter = Math.floor(60000000 / bpm);
  const ticksPerStep = Math.floor(ticksPerQuarter * 4 / BEAT_STEPS);

  // Collect events
  const events = [];

  // Tempo meta-event at tick 0
  events.push({
    tick: 0,
    bytes: [0xFF, 0x51, 0x03,
      (usPerQuarter >> 16) & 0xFF,
      (usPerQuarter >> 8) & 0xFF,
      usPerQuarter & 0xFF
    ]
  });

  // Pattern note events
  for (let t = 0; t < BEAT_INSTRUMENTS.length; t++) {
    const note = BEAT_INSTRUMENTS[t].gmNote;
    for (let s = 0; s < BEAT_STEPS; s++) {
      const v = beatVelocity(beatCurrentPattern, t, s);
      if (v <= 0) continue;
      const vel = Math.max(1, Math.min(127, Math.round(v * 127)));
      const onTick = s * ticksPerStep;
      const offTick = onTick + noteLengthTicks;
      events.push({ tick: onTick, bytes: [0x90 | drumChannel, note, vel] });
      events.push({ tick: offTick, bytes: [0x80 | drumChannel, note, 0] });
    }
  }

  // End of track
  const endTick = BEAT_STEPS * ticksPerStep;
  events.push({ tick: endTick, bytes: [0xFF, 0x2F, 0x00] });

  // Sort by tick (stable)
  events.sort((a, b) => a.tick - b.tick);

  // Variable-length quantity encoder (MIDI delta times)
  function vlq(value) {
    const buf = [value & 0x7F];
    value >>= 7;
    while (value > 0) {
      buf.unshift((value & 0x7F) | 0x80);
      value >>= 7;
    }
    return buf;
  }

  // Encode track payload with delta times
  const payload = [];
  let lastTick = 0;
  for (const ev of events) {
    const delta = ev.tick - lastTick;
    payload.push(...vlq(delta));
    payload.push(...ev.bytes);
    lastTick = ev.tick;
  }

  // Build full SMF
  const out = [];
  // Header: "MThd"
  out.push(0x4D, 0x54, 0x68, 0x64);
  // Header length = 6
  out.push(0, 0, 0, 6);
  // Format 0
  out.push(0, 0);
  // 1 track
  out.push(0, 1);
  // Ticks per quarter (480)
  out.push((ticksPerQuarter >> 8) & 0xFF, ticksPerQuarter & 0xFF);
  // Track chunk: "MTrk"
  out.push(0x4D, 0x54, 0x72, 0x6B);
  // Track length (big-endian uint32)
  const len = payload.length;
  out.push((len >> 24) & 0xFF, (len >> 16) & 0xFF, (len >> 8) & 0xFF, len & 0xFF);
  // Payload
  out.push(...payload);

  return new Blob([new Uint8Array(out)], { type: 'audio/midi' });
}

// ── Stems Export (separate WAVs in a ZIP) ─────────
async function loadJSZip() {
  if (typeof JSZip !== 'undefined') return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load ZIP encoder'));
    document.head.appendChild(script);
  });
}

async function renderSingleLayer(layer, duration) {
  // Render one layer to its own AudioBuffer for stems export
  const sampleRate = 44100;
  const channels = 2;
  const offline = new OfflineAudioContext(channels, Math.ceil(duration * sampleRate), sampleRate);

  if (layer === 'backing' && backingBuffer) {
    const src = offline.createBufferSource();
    src.buffer = backingBuffer;
    src.connect(offline.destination);
    src.start(0);
  } else if (layer === 'vocal' && takeBuffer) {
    const src = offline.createBufferSource();
    src.buffer = takeBuffer;
    src.connect(offline.destination);
    src.start(0);
  } else if (layer === 'beat' && beatSamplesReady && beatPatterns.length > 0) {
    const bpm = getBPM();
    const stepDur = 60.0 / bpm / 4.0;
    const totalSteps = Math.ceil(duration / stepDur);
    const bGain = offline.createGain();
    bGain.gain.value = beatVolume;
    bGain.connect(offline.destination);
    for (let s = 0; s < totalSteps; s++) {
      const t = s * stepDur;
      if (t >= duration) break;
      const stepInBar = s % BEAT_STEPS;
      for (let tr = 0; tr < BEAT_INSTRUMENTS.length; tr++) {
        const v = beatVelocity(beatCurrentPattern, tr, stepInBar);
        if (v <= 0 || !beatSamples[tr]) continue;
        const src = offline.createBufferSource();
        src.buffer = beatSamples[tr];
        const hGain = offline.createGain();
        hGain.gain.value = v;
        src.connect(hGain);
        hGain.connect(bGain);
        src.start(t);
      }
    }
  } else if (layer === 'metronome') {
    const bpm = getBPM();
    const beatDuration = 60.0 / bpm;
    const totalBeats = Math.ceil(duration / beatDuration);
    const metGain = offline.createGain();
    metGain.gain.value = 0.5;
    metGain.connect(offline.destination);
    for (let i = 0; i < totalBeats; i++) {
      const t = i * beatDuration;
      if (t >= duration) break;
      const isAccent = (i % 4) === 0;
      const osc = offline.createOscillator();
      const cg = offline.createGain();
      osc.frequency.value = isAccent ? 1200 : 800;
      osc.type = 'sine';
      const clickDur = isAccent ? 0.04 : 0.03;
      cg.gain.setValueAtTime(isAccent ? 1.0 : 0.6, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + clickDur);
      osc.connect(cg);
      cg.connect(metGain);
      osc.start(t);
      osc.stop(t + clickDur + 0.01);
    }
  }

  return await offline.startRendering();
}

async function exportStems(opts, slug) {
  await loadJSZip();
  const zip = new JSZip();
  const bitDepth = opts.bitDepth || 16;

  // Determine duration
  let duration = 0;
  if (opts.backing && backingBuffer) duration = Math.max(duration, backingBuffer.duration);
  if (opts.vocal && takeBuffer) duration = Math.max(duration, takeBuffer.duration);
  if (duration === 0) duration = backingBuffer ? backingBuffer.duration : 30;

  const layers = [];
  if (opts.backing && backingBuffer) layers.push({ key: 'backing', name: '01-backing' });
  if (opts.vocal && takeBuffer) layers.push({ key: 'vocal', name: '02-vocal' });
  if (opts.beat && beatSamplesReady) layers.push({ key: 'beat', name: '03-beat' });
  if (opts.metronome) layers.push({ key: 'metronome', name: '04-metronome' });

  for (const layer of layers) {
    const buffer = await renderSingleLayer(layer.key, duration);
    const wav = encodeWAV(buffer, bitDepth);
    const arrayBuffer = await wav.arrayBuffer();
    zip.file(`${slug}-${layer.name}.wav`, arrayBuffer);
  }

  // Optionally include MIDI of beat pattern
  if (opts.midi) {
    const midi = encodeMIDI();
    zip.file(`${slug}-beat.mid`, await midi.arrayBuffer());
  }

  // Add a small README
  const bpm = getBPM();
  const readme = `Carmen Co-Writer Stems Export\n` +
    `Song: ${document.getElementById('songTitle')?.value || slug}\n` +
    `BPM: ${bpm}\n` +
    `Sample rate: 44100 Hz\n` +
    `Bit depth: ${bitDepth}-bit\n` +
    `Channels: 2 (stereo)\n` +
    `Duration: ${duration.toFixed(2)} seconds\n\n` +
    `Files:\n` +
    layers.map(l => `  ${slug}-${l.name}.wav`).join('\n') +
    (opts.midi ? `\n  ${slug}-beat.mid (MIDI, GM percussion channel 10)` : '') +
    `\n\nAll WAVs start at the same time and are the same length.\n` +
    `Drop them into your DAW on separate tracks for a clean multi-track import.\n`;
  zip.file(`README.txt`, readme);

  return await zip.generateAsync({ type: 'blob' });
}

async function encodeMP3(audioBuffer) {
  // Dynamically load lamejs if not already loaded
  if (typeof lamejs === 'undefined') {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load MP3 encoder'));
      document.head.appendChild(script);
    });
  }

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const kbps = 192;
  const mp3enc = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  const left = audioBuffer.getChannelData(0);
  const right = channels > 1 ? audioBuffer.getChannelData(1) : left;
  const length = left.length;
  const blockSize = 1152;
  const mp3Data = [];

  // Convert float samples to Int16
  function floatTo16(buf) {
    const out = new Int16Array(buf.length);
    for (let i = 0; i < buf.length; i++) {
      const s = Math.max(-1, Math.min(1, buf[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }

  for (let i = 0; i < length; i += blockSize) {
    const leftChunk = floatTo16(left.subarray(i, i + blockSize));
    const rightChunk = floatTo16(right.subarray(i, i + blockSize));
    const mp3buf = mp3enc.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }
  const end = mp3enc.flush();
  if (end.length > 0) mp3Data.push(end);

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

// ── Waveform Interactions ────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('waveformWrap');
  if (!wrap) return;
  let interacting = false;

  // Draw loop region
  let drawDrag = false;
  wrap.addEventListener('mousedown', e => {
    if (!backingBuffer) return;
    if (!audioLoopOn) return; // seek handled by click
    const tgt = e.target;
    if (tgt.id === 'loopHandleL' || tgt.closest('#loopHandleL') ||
        tgt.id === 'loopHandleR' || tgt.closest('#loopHandleR') ||
        tgt.id === 'loopRegion') return;
    drawDrag = true; interacting = true;
    const rect = wrap.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    loopStart = frac * audioDuration; loopEnd = loopStart + 0.01;
    renderLoop(); e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!drawDrag) return;
    const rect = wrap.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = frac * audioDuration;
    if (time > loopStart) loopEnd = time;
    else { loopEnd = loopStart + 0.01; loopStart = time; }
    renderLoop(); paintWaveform(getPos());
  });
  document.addEventListener('mouseup', () => {
    if (drawDrag) {
      drawDrag = false; setTimeout(() => { interacting = false; }, 50);
      if (loopEnd - loopStart < 0.25) loopEnd = Math.min(audioDuration, loopStart + 0.5);
      renderLoop();
      if (audioPlaying && audioLoopOn) startPlayback(loopStart);
    }
  });

  // Click to seek (loop off)
  wrap.addEventListener('click', e => {
    if (!backingBuffer || interacting || audioLoopOn) return;
    const rect = wrap.getBoundingClientRect();
    const pos = ((e.clientX - rect.left) / rect.width) * audioDuration;
    audioOffset = pos;
    if (audioPlaying) startPlayback(pos);
    else { paintWaveform(pos); updateTimeDisplay(pos); updatePlayheadEl(pos / audioDuration); }
  });

  // Handle drag
  function makeHandleDrag(handleId, side) {
    const handle = document.getElementById(handleId);
    if (!handle) return;
    let active = false;
    handle.addEventListener('mousedown', e => { e.stopPropagation(); active = true; interacting = true; document.body.style.cursor = 'ew-resize'; });
    document.addEventListener('mousemove', e => {
      if (!active) return;
      const rect = wrap.getBoundingClientRect();
      const t = Math.max(0, Math.min(audioDuration, ((e.clientX - rect.left) / rect.width) * audioDuration));
      if (side === 'left') loopStart = Math.min(t, loopEnd - 0.25);
      else loopEnd = Math.max(t, loopStart + 0.25);
      renderLoop(); paintWaveform(getPos());
    });
    document.addEventListener('mouseup', () => {
      if (active) { active = false; document.body.style.cursor = ''; setTimeout(() => { interacting = false; }, 50); if (audioPlaying && audioLoopOn) startPlayback(loopStart); }
    });
  }
  makeHandleDrag('loopHandleL', 'left');
  makeHandleDrag('loopHandleR', 'right');

  // Region drag
  const region = document.getElementById('loopRegion');
  if (region) {
    let regActive = false, regStartX = 0, regLS = 0, regLE = 0;
    region.addEventListener('mousedown', e => { e.stopPropagation(); regActive = true; interacting = true; regStartX = e.clientX; regLS = loopStart; regLE = loopEnd; document.body.style.cursor = 'grabbing'; });
    document.addEventListener('mousemove', e => {
      if (!regActive) return;
      const W = wrap.clientWidth;
      const dt = ((e.clientX - regStartX) / W) * audioDuration;
      const len = regLE - regLS;
      loopStart = Math.max(0, Math.min(audioDuration - len, regLS + dt));
      loopEnd = loopStart + len;
      renderLoop(); paintWaveform(getPos());
    });
    document.addEventListener('mouseup', () => {
      if (regActive) { regActive = false; document.body.style.cursor = ''; setTimeout(() => { interacting = false; }, 50); if (audioPlaying && audioLoopOn) startPlayback(loopStart); }
    });
  }

  // Keyboard
  document.addEventListener('keydown', e => {
    if (!backingBuffer || !audioBarVisible) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlayback(); }
    if (e.code === 'KeyL') toggleLoop();
  });
});
`;

// ══════════════════════════════════════════════════
// RECORDING ENGINE
// ══════════════════════════════════════════════════

const REC_JS = `
let mediaRecorder = null;
let recChunks = [];
let recStartTime = 0;
let recTimerInterval = null;
let _recMode = null; // 'backing' or 'vocal'

// ── Recording ────────────────────────────────────
async function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    startRecording('vocal');
  }
}

async function startBackingRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;
  await startRecording('backing');
}

async function startRecording(mode) {
  try {
    _recMode = mode || 'vocal';
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recChunks = [];
    recStartTime = Date.now();

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
    mediaRecorder.onstop = () => finalizeRecording(stream);
    mediaRecorder.start(100);

    // If recording a vocal take, start playback so the singer hears the backing
    // track, the beat pattern, and/or the metronome — whatever is enabled.
    // Beat samples need to be ready before they can play.
    if (_recMode === 'vocal' && (backingBuffer || beatOn || metronomeOn)) {
      if (beatOn && !beatSamplesReady) await generateBeatSamples();
      if (!audioPlaying) startPlayback(audioLoopOn ? loopStart : 0);
    }

    updateRecBtn(true);
    recTimerInterval = setInterval(updateRecTimer, 1000);
  } catch(e) {
    alert('Mic access needed to record: ' + e.message);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  // Stop backing track playback if it was auto-started
  if (_recMode === 'vocal' && audioPlaying) {
    pausePlayback();
  }
  clearInterval(recTimerInterval);
  updateRecBtn(false);
  document.getElementById('recTimer').textContent = '';
}

async function finalizeRecording(stream) {
  stream.getTracks().forEach(t => t.stop());
  const blob = new Blob(recChunks, { type: recChunks[0]?.type || 'audio/webm' });
  const sectionName = typeof sections !== 'undefined' && sections[current]
    ? sections[current].name : 'Take';
  const timeStr = new Date(recStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const label = sectionName + ' — ' + timeStr;
  const songId = (typeof currentSongId !== 'undefined') ? currentSongId : '';

  if (_recMode === 'backing') {
    // Save as backing track
    await saveBackingTrack(songId, blob, label);
    // Load into the player
    ensureAudioCtx();
    const arrBuf = await blob.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(arrBuf);
    loadBackingBuffer(buffer, label);
  } else {
    // Save as vocal take
    await saveTake(songId, blob, label, sectionName);
  }
  _recMode = null;
  renderTakesList();
}

function updateRecBtn(recording) {
  const btn = document.getElementById('recBtn');
  if (!btn) return;
  if (recording) {
    btn.innerHTML = '⏹ Stop';
    btn.style.background = '#c4602a';
    btn.style.color = '#f8f4ed';
    btn.style.borderColor = '#c4602a';
    btn.style.boxShadow = '0 0 0 3px rgba(196,96,42,0.2)';
  } else {
    btn.innerHTML = '🎤 Record Take';
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.style.boxShadow = '';
  }
  const backBtn = document.getElementById('recBackingBtn');
  if (backBtn) {
    if (recording) {
      backBtn.style.display = 'none';
    } else {
      backBtn.style.display = '';
    }
  }
}

function updateRecTimer() {
  const el = document.getElementById('recTimer');
  if (!el) return;
  const elapsed = Math.floor((Date.now() - recStartTime) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  el.textContent = m + ':' + s.toString().padStart(2, '0');
}

// ── Takes List ───────────────────────────────────
async function renderTakesList(filterSection) {
  const container = document.getElementById('takesList');
  if (!container) return;
  const songId = (typeof currentSongId !== 'undefined') ? currentSongId : '';
  let takes = await getTakesForSong(songId);

  // Section filter
  if (filterSection && filterSection !== 'all') {
    takes = takes.filter(t => t.section === filterSection);
  }

  container.innerHTML = '';

  if (!takes.length) {
    container.innerHTML = '<div style="font-size:11px;color:var(--ink-faint);font-style:italic;padding:6px 2px;font-family:var(--font-display);">No vocal takes yet — record one over your backing track</div>';
    return;
  }

  // Most recent first
  [...takes].reverse().forEach(take => {
    const row = document.createElement('div');
    row.className = 'take-row' + (activeTakeId === take.id ? ' active-take' : '');

    // Play layered (backing + this take)
    const playBtn = document.createElement('button');
    playBtn.className = 'audio-btn take-play-btn' + (activeTakeId === take.id ? ' active' : '');
    playBtn.textContent = activeTakeId === take.id ? '🔊' : '▶';
    playBtn.title = activeTakeId === take.id ? 'Playing (click to deselect)' : 'Play with backing track';
    playBtn.onclick = () => selectTake(take.id);

    // Star
    const starBtn = document.createElement('button');
    starBtn.className = 'take-star-btn' + (take.starred ? ' starred' : '');
    starBtn.textContent = take.starred ? '★' : '☆';
    starBtn.title = take.starred ? 'Unstar' : 'Star this take';
    starBtn.onclick = async (e) => {
      e.stopPropagation();
      await updateTake(take.id, { starred: !take.starred });
      renderTakesList(filterSection);
    };

    // Label (editable on double-click)
    const labelEl = document.createElement('span');
    labelEl.className = 'take-label';
    labelEl.textContent = take.label;
    labelEl.title = 'Double-click to rename';
    labelEl.ondblclick = () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = take.label;
      input.className = 'take-rename-input';
      input.onblur = async () => {
        const newLabel = input.value.trim();
        if (newLabel && newLabel !== take.label) {
          await updateTake(take.id, { label: newLabel });
        }
        renderTakesList(filterSection);
      };
      input.onkeydown = e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = take.label; input.blur(); } };
      labelEl.replaceWith(input);
      input.focus();
      input.select();
    };

    // Section badge
    const sectionBadge = document.createElement('span');
    sectionBadge.className = 'take-section-badge';
    sectionBadge.textContent = take.section || '';

    // Set as backing track
    const backingBtn = document.createElement('button');
    backingBtn.className = 'take-action-btn';
    backingBtn.textContent = '♫';
    backingBtn.title = 'Set as backing track';
    backingBtn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm('Set this take as the backing track? It will be removed from the takes list.')) {
        await setTakeAsBackingTrack(take.id);
      }
    };

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'take-action-btn take-del-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Delete take';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (activeTakeId === take.id) deselectTake();
      await deleteTake(take.id);
      renderTakesList(filterSection);
    };

    row.appendChild(playBtn);
    row.appendChild(starBtn);
    row.appendChild(labelEl);
    row.appendChild(sectionBadge);
    row.appendChild(backingBtn);
    row.appendChild(delBtn);
    container.appendChild(row);
  });

  // Section filter dropdown
  renderSectionFilter(takes);
}

function renderSectionFilter() {
  const el = document.getElementById('takeSectionFilter');
  if (!el) return;
  const sections_list = typeof sections !== 'undefined' ? sections : [];
  el.innerHTML = '<option value="all">All sections</option>';
  const seen = new Set();
  sections_list.forEach(s => {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      el.appendChild(opt);
    }
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  renderTakesList();
  initBeatPatterns();
  // Load backing track for current song
  if (typeof currentSongId !== 'undefined' && currentSongId) {
    loadBackingTrackForSong(currentSongId);
  }
  // Section filter handler
  const filterEl = document.getElementById('takeSectionFilter');
  if (filterEl) {
    filterEl.addEventListener('change', () => renderTakesList(filterEl.value));
  }
});
`;
