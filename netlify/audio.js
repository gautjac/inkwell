
// ── State ─────────────────────────────────────────
let audioCtx = null;
let audioBuffer = null;
let audioSource = null;
let audioStartTime = 0;
let audioOffset = 0;
let audioPlaying = false;
let audioLoopOn = false;
let loopStart = 0;
let loopEnd = 0;
let audioDuration = 0;
let rafId = null;
let waveformData = null;
let audioBarVisible = false;

// ── Bar toggle ────────────────────────────────────
function toggleAudioBar() {
  audioBarVisible = !audioBarVisible;
  document.getElementById('audioBar').classList.toggle('visible', audioBarVisible);
  document.getElementById('audioToggleBtn').classList.toggle('has-audio', audioBarVisible && !!audioBuffer);
}

// ── Load ──────────────────────────────────────────
// Load a decoded AudioBuffer directly (used by recording.js)
function loadAudioBuffer(buffer, label) {
  if (!audioCtx) audioCtx = new AudioContext();
  stopPlayback();
  audioBuffer = buffer;
  audioDuration = buffer.duration;
  audioOffset = 0;
  loopStart = audioDuration * 0.25;
  loopEnd   = audioDuration * 0.75;
  audioLoopOn = false;
  const fnEl = document.getElementById('audioFilename');
  if (fnEl) { fnEl.textContent = label || 'Recording'; fnEl.style.display = 'block'; }
  const wsEl = document.getElementById('waveformSection');
  if (wsEl) wsEl.style.display = 'block';
  const tdEl = document.getElementById('audioTimeDisplay');
  if (tdEl) tdEl.style.display = 'block';
  const toggleBtn = document.getElementById('audioToggleBtn');
  if (toggleBtn) toggleBtn.classList.add('has-audio');
  const loopTag = document.getElementById('loopToggleTag');
  if (loopTag) { loopTag.textContent = '⟲ Loop off'; loopTag.classList.remove('loop-on'); }
  // Show the audio bar if hidden
  const bar = document.getElementById('audioBar');
  if (bar && !bar.classList.contains('visible')) {
    bar.classList.add('visible');
    audioBarVisible = true;
  }
  drawWaveform();
  renderLoop();
  updateTimeDisplay(0);
}

function loadAudioFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (!audioCtx) audioCtx = new AudioContext();
  const reader = new FileReader();
  reader.onload = e => {
    audioCtx.decodeAudioData(e.target.result, buffer => {
      stopPlayback();
      audioBuffer = buffer;
      audioDuration = buffer.duration;
      audioOffset = 0;
      loopStart = audioDuration * 0.25;
      loopEnd   = audioDuration * 0.75;
      audioLoopOn = false;
      const fnEl = document.getElementById('audioFilename');
      if (fnEl) { fnEl.textContent = file.name.replace(/\\.[^.]+$/, ''); fnEl.style.display = 'block'; }
      const wsEl = document.getElementById('waveformSection');
      if (wsEl) wsEl.style.display = 'block';
      const tdEl = document.getElementById('audioTimeDisplay');
      if (tdEl) tdEl.style.display = 'block';
      document.getElementById('audioToggleBtn').classList.add('has-audio');
      document.getElementById('loopToggleTag').textContent = '⟲ Loop off';
      document.getElementById('loopToggleTag').classList.remove('loop-on');
      drawWaveform();
      renderLoop();
      updateTimeDisplay(0);
    }, err => alert('Could not decode audio: ' + err));
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}

// ── Waveform ──────────────────────────────────────
function drawWaveform() {
  const canvas = document.getElementById('waveCanvas');
  const wrap   = document.getElementById('waveformWrap');
  canvas.width  = wrap.clientWidth  * window.devicePixelRatio;
  canvas.height = wrap.clientHeight * window.devicePixelRatio;
  canvas.style.width  = wrap.clientWidth  + 'px';
  canvas.style.height = wrap.clientHeight + 'px';
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, mid = H / 2;
  const data = audioBuffer.getChannelData(0);
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
  const playX = Math.floor((currentTime / audioDuration) * W);

  ctx.fillStyle = '#e8dfd0';
  ctx.fillRect(0, 0, W, H);

  // Loop region tint (behind waveform, only when loop on)
  if (audioLoopOn) {
    const lx = Math.floor((loopStart / audioDuration) * W);
    const rx = Math.ceil((loopEnd   / audioDuration) * W);
    ctx.fillStyle = 'rgba(196,96,42,0.10)';
    ctx.fillRect(lx, 0, rx - lx, H);
  }

  // Waveform bars — played portion slightly brighter
  for (let x = 0; x < W; x++) {
    const amp = waveformData[x] * mid * 0.9;
    ctx.fillStyle = x < playX ? '#9e8e7e' : '#3d3428';
    ctx.fillRect(x, mid - amp, 1, amp * 2);
  }
}

// ── Loop overlay (DOM, not canvas) ───────────────
function renderLoop() {
  const wrap   = document.getElementById('waveformWrap');
  const region = document.getElementById('loopRegion');
  const hl     = document.getElementById('loopHandleL');
  const hr     = document.getElementById('loopHandleR');
  if (!wrap || !audioDuration) return;

  if (!audioLoopOn) {
    region.style.display = 'none';
    hl.style.display = 'none';
    hr.style.display = 'none';
    return;
  }

  const W  = wrap.clientWidth;
  const lx = (loopStart / audioDuration) * W;
  const rx = (loopEnd   / audioDuration) * W;

  region.style.display = 'block';
  region.style.left    = lx + 'px';
  region.style.width   = (rx - lx) + 'px';

  hl.style.display = 'flex';
  hr.style.display = 'flex';
  hl.style.left = (lx - 12) + 'px';
  hr.style.left = (rx - 12) + 'px';

  updateLoopLabel();
}

function updateLoopLabel() {
  const fmt = s => { const m = Math.floor(s/60); return m + ':' + (s % 60).toFixed(1).padStart(4,'0'); };
  const el = document.getElementById('loopRangeLabel');
  if (el) el.textContent = audioLoopOn ? fmt(loopStart) + ' → ' + fmt(loopEnd) : 'turn loop on, then drag to select';
}

// ── Playback ──────────────────────────────────────
function togglePlayback() { if (audioPlaying) pausePlayback(); else startPlayback(audioOffset); }

function startPlayback(offset) {
  if (!audioBuffer || !audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  stopSourceOnly();
  if (audioLoopOn && (offset < loopStart || offset >= loopEnd)) offset = loopStart;
  audioSource = audioCtx.createBufferSource();
  audioSource.buffer = audioBuffer;
  audioSource.playbackRate.value = parseFloat(document.getElementById('speedSelect').value);
  audioSource.connect(audioCtx.destination);
  if (audioLoopOn) {
    audioSource.loopStart = loopStart;
    audioSource.loopEnd   = loopEnd;
    audioSource.loop      = true;
  } else {
    audioSource.loop = false;
    audioSource.onended = () => {
      if (audioPlaying) {
        audioPlaying = false; audioOffset = 0;
        updatePlayBtn(); cancelAnimationFrame(rafId);
        paintWaveform(0); updateTimeDisplay(0);
        document.getElementById('playhead').style.left = '0px';
      }
    };
  }
  audioSource.start(0, offset);
  // audioStartTime: the audioCtx time at which position=offset was playing
  audioStartTime = audioCtx.currentTime;
  audioOffset = offset;  // remember where we started
  audioPlaying = true;
  updatePlayBtn();
  rafLoop();
}

function pausePlayback() {
  audioOffset = getPos(); stopSourceOnly();
  audioPlaying = false; updatePlayBtn(); cancelAnimationFrame(rafId);
}

function stopPlayback() {
  audioOffset = 0; stopSourceOnly();
  audioPlaying = false; updatePlayBtn(); cancelAnimationFrame(rafId);
}

function stopSourceOnly() {
  if (audioSource) { try { audioSource.stop(); } catch(e) {} audioSource.disconnect(); audioSource = null; }
}

function getPos() {
  if (!audioPlaying || !audioSource) return audioOffset;
  const rate = audioSource.playbackRate.value;
  // How much buffer time has elapsed since we called start()
  const elapsed = (audioCtx.currentTime - audioStartTime) * rate;
  if (audioLoopOn && loopEnd > loopStart) {
    const len = loopEnd - loopStart;
    // We started at audioOffset; after (loopEnd - audioOffset) seconds
    // Web Audio wraps back to loopStart. So model accordingly:
    const intoLoop = elapsed - Math.max(0, loopStart - audioOffset);
    if (intoLoop < 0) return audioOffset + elapsed; // pre-loop
    return loopStart + (intoLoop % len);
  }
  return Math.min(audioOffset + elapsed, audioDuration);
}

function audioSkip(secs) {
  const pos = Math.max(0, Math.min(audioDuration, getPos() + secs));
  audioOffset = pos;
  if (audioPlaying) startPlayback(pos);
  else { paintWaveform(pos); updateTimeDisplay(pos); updatePlayheadEl(pos / audioDuration); }
}

function setSpeed(val) {
  if (audioSource) audioSource.playbackRate.value = parseFloat(val);
  if (audioPlaying) startPlayback(getPos());
}

function rafLoop() {
  const pos = getPos();
  paintWaveform(pos);
  updatePlayheadEl(pos / audioDuration);
  updateTimeDisplay(pos);
  rafId = requestAnimationFrame(rafLoop);
}

function updatePlayheadEl(frac) {
  const wrap = document.getElementById('waveformWrap');
  if (wrap) document.getElementById('playhead').style.left = Math.round(frac * wrap.clientWidth) + 'px';
}

function updatePlayBtn() {
  const btn = document.getElementById('playPauseBtn');
  if (btn) { btn.textContent = audioPlaying ? '⏸' : '▶'; btn.classList.toggle('active', audioPlaying); }
}

function updateTimeDisplay(t) {
  const fmt = s => { const m = Math.floor(s/60); return m+':'+Math.floor(s%60).toString().padStart(2,'0'); };
  const el = document.getElementById('audioTimeDisplay');
  if (el) el.textContent = fmt(t) + ' / ' + fmt(audioDuration);
}

// ── Loop toggle ───────────────────────────────────
function toggleLoop() {
  audioLoopOn = !audioLoopOn;
  const tag = document.getElementById('loopToggleTag');
  tag.textContent = audioLoopOn ? '⟲ Loop on' : '⟲ Loop off';
  tag.classList.toggle('loop-on', audioLoopOn);
  renderLoop();
  paintWaveform(getPos());
  if (audioPlaying) startPlayback(getPos());
}

function clearLoop() {
  loopStart = audioDuration * 0.25;
  loopEnd   = audioDuration * 0.75;
  renderLoop();
  paintWaveform(getPos());
  if (audioPlaying && audioLoopOn) startPlayback(loopStart);
}

// ── Interactions ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('waveformWrap');
  let interacting = false;

  // ── Drag on waveform to draw loop region ─────────
  let drawDrag = false;
  let drawStartX = 0;

  wrap.addEventListener('mousedown', e => {
    if (!audioBuffer) return;
    // Only start a draw-drag if loop is on and we're not on a handle/region
    if (!audioLoopOn) {
      // Regular seek
      return;
    }
    const tgt = e.target;
    if (tgt.id === 'loopHandleL' || tgt.closest('#loopHandleL') ||
        tgt.id === 'loopHandleR' || tgt.closest('#loopHandleR') ||
        tgt.id === 'loopRegion') return; // handled elsewhere

    drawDrag = true;
    interacting = true;
    drawStartX = e.clientX;
    const rect = wrap.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    loopStart = frac * audioDuration;
    loopEnd   = loopStart + 0.01;
    renderLoop();
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!drawDrag) return;
    const wrap = document.getElementById('waveformWrap');
    const rect = wrap.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = frac * audioDuration;
    if (time > loopStart) {
      loopEnd = time;
    } else {
      loopEnd   = loopStart + 0.01;
      loopStart = time;
    }
    renderLoop();
    paintWaveform(getPos());
  });

  document.addEventListener('mouseup', () => {
    if (drawDrag) {
      drawDrag = false;
      setTimeout(() => { interacting = false; }, 50);
      if (loopEnd - loopStart < 0.25) { loopEnd = Math.min(audioDuration, loopStart + 0.5); }
      renderLoop();
      if (audioPlaying && audioLoopOn) startPlayback(loopStart);
    }
  });

  // ── Click to seek (when loop off, or clicking outside region) ──
  wrap.addEventListener('click', e => {
    if (!audioBuffer || interacting || audioLoopOn) return;
    const rect = wrap.getBoundingClientRect();
    const pos  = ((e.clientX - rect.left) / rect.width) * audioDuration;
    audioOffset = pos;
    if (audioPlaying) startPlayback(pos);
    else { paintWaveform(pos); updateTimeDisplay(pos); updatePlayheadEl(pos / audioDuration); }
  });

  // ── Handle drag (left / right) ────────────────────
  function makeHandleDrag(handleId, side) {
    const handle = document.getElementById(handleId);
    if (!handle) return;
    let active = false;

    handle.addEventListener('mousedown', e => {
      e.stopPropagation(); active = true; interacting = true;
      document.body.style.cursor = 'ew-resize';
    });

    document.addEventListener('mousemove', e => {
      if (!active) return;
      const wrap = document.getElementById('waveformWrap');
      const rect = wrap.getBoundingClientRect();
      const t = Math.max(0, Math.min(audioDuration, ((e.clientX - rect.left) / rect.width) * audioDuration));
      if (side === 'left')  loopStart = Math.min(t, loopEnd - 0.25);
      else                  loopEnd   = Math.max(t, loopStart + 0.25);
      renderLoop();
      paintWaveform(getPos());
    });

    document.addEventListener('mouseup', () => {
      if (active) {
        active = false; document.body.style.cursor = '';
        setTimeout(() => { interacting = false; }, 50);
        if (audioPlaying && audioLoopOn) startPlayback(loopStart);
      }
    });
  }

  makeHandleDrag('loopHandleL', 'left');
  makeHandleDrag('loopHandleR', 'right');

  // ── Region drag (move whole selection) ────────────
  const region = document.getElementById('loopRegion');
  let regActive = false, regStartX = 0, regLS = 0, regLE = 0;

  region.addEventListener('mousedown', e => {
    e.stopPropagation(); regActive = true; interacting = true;
    regStartX = e.clientX; regLS = loopStart; regLE = loopEnd;
    document.body.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', e => {
    if (!regActive) return;
    const W   = document.getElementById('waveformWrap').clientWidth;
    const dt  = ((e.clientX - regStartX) / W) * audioDuration;
    const len = regLE - regLS;
    loopStart = Math.max(0, Math.min(audioDuration - len, regLS + dt));
    loopEnd   = loopStart + len;
    renderLoop();
    paintWaveform(getPos());
  });

  document.addEventListener('mouseup', () => {
    if (regActive) {
      regActive = false; document.body.style.cursor = '';
      setTimeout(() => { interacting = false; }, 50);
      if (audioPlaying && audioLoopOn) startPlayback(loopStart);
    }
  });

  // ── Keyboard ──────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (!audioBuffer || !audioBarVisible) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlayback(); }
    if (e.code === 'KeyL')  { toggleLoop(); }
  });
});
`;

// ════════════════════════════════════════════════
// RECORDING ENGINE
// ════════════════════════════════════════════════

const REC_JS = `
let mediaRecorder = null;
let recChunks = [];
let recStartTime = 0;
let recTimerInterval = null;
let recDb = null;

// ── IndexedDB setup ───────────────────────────────
function openRecDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('inkwell-recordings', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('takes')) {
        db.createObjectStore('takes', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e);
  });
}

async function saveRecording(blob, label) {
  const db = recDb || (recDb = await openRecDb());
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', 'readwrite');
    tx.objectStore('takes').add({ blob, label, ts: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e);
  });
}

async function getAllRecordings() {
  const db = recDb || (recDb = await openRecDb());
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', 'readonly');
    const req = tx.objectStore('takes').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e);
  });
}

async function deleteRecording(id) {
  const db = recDb || (recDb = await openRecDb());
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', 'readwrite');
    tx.objectStore('takes').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e);
  });
}

// ── Recording ──────────────────────────────────────
async function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    startRecording();
  }
}

async function startRecording() {
  try {
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
  clearInterval(recTimerInterval);
  updateRecBtn(false);
  document.getElementById('recTimer').textContent = '';
}

async function finalizeRecording(stream) {
  stream.getTracks().forEach(t => t.stop());
  const blob = new Blob(recChunks, { type: recChunks[0]?.type || 'audio/webm' });
  const sectionName = typeof sections !== 'undefined' && sections[current]
    ? sections[current].name
    : 'Take';
  const label = sectionName + ' — ' + new Date(recStartTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  await saveRecording(blob, label);
  renderTakesList();
}

function updateRecBtn(recording) {
  const btn = document.getElementById('recBtn');
  if (!btn) return;
  if (recording) {
    btn.textContent = '⏹ Stop';
    btn.style.background = '#c4602a';
    btn.style.color = '#f8f4ed';
    btn.style.borderColor = '#c4602a';
  } else {
    btn.textContent = '● Record';
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
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

// ── Takes list ─────────────────────────────────────
async function renderTakesList() {
  const container = document.getElementById('takesList');
  if (!container) return;
  const takes = await getAllRecordings();
  container.innerHTML = '';

  if (!takes.length) {
    container.innerHTML = '<div style="font-size:11px;color:#b8a99a;font-style:italic;padding:4px 0">No recordings yet</div>';
    return;
  }

  takes.reverse().forEach(take => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #e8dfd0;';

    const label = document.createElement('span');
    label.style.cssText = 'flex:1;font-family:"Crimson Pro",serif;font-size:14px;color:#3d3428;font-style:italic;';
    label.textContent = take.label;

    const url = URL.createObjectURL(take.blob);

    const playBtn = document.createElement('button');
    playBtn.className = 'audio-btn';
    playBtn.style.cssText = 'width:26px;height:26px;font-size:11px;flex-shrink:0';
    playBtn.textContent = '▶';
    playBtn.title = 'Play';

    let audio = null;
    playBtn.onclick = () => {
      if (audio && !audio.paused) {
        audio.pause(); audio.currentTime = 0;
        playBtn.textContent = '▶';
      } else {
        audio = new Audio(url);
        audio.play();
        playBtn.textContent = '⏹';
        audio.onended = () => { playBtn.textContent = '▶'; };
      }
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'audio-btn';
    delBtn.style.cssText = 'width:22px;height:22px;font-size:10px;flex-shrink:0;color:#b8a99a;';
    delBtn.textContent = '×';
    delBtn.title = 'Delete';
    delBtn.onclick = async () => {
      if (audio) { audio.pause(); }
      await deleteRecording(take.id);
      renderTakesList();
    };

    row.appendChild(playBtn);
    row.appendChild(label);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderTakesList();
});