// Inkwell Recording Engine — Vocal Takes + Backing Track Recording
// This file is for local dev. The deployed version is extracted from audio-engine.js by build.js.
// See audio-engine.js REC_JS for the canonical source.

// Recording state is declared here; DB functions are in audio.js (from AUDIO_JS)
let mediaRecorder = null;
let recChunks = [];
let recStartTime = 0;
let recTimerInterval = null;
let _recMode = null; // 'backing' or 'vocal'

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

    if (_recMode === 'vocal' && backingBuffer) {
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
    await saveBackingTrack(songId, blob, label);
    ensureAudioCtx();
    const arrBuf = await blob.arrayBuffer();
    const buffer = await audioCtx.decodeAudioData(arrBuf);
    loadBackingBuffer(buffer, label);
  } else {
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
  if (backBtn) backBtn.style.display = recording ? 'none' : '';
}

function updateRecTimer() {
  const el = document.getElementById('recTimer');
  if (!el) return;
  const elapsed = Math.floor((Date.now() - recStartTime) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  el.textContent = m + ':' + s.toString().padStart(2, '0');
}

async function renderTakesList(filterSection) {
  const container = document.getElementById('takesList');
  if (!container) return;
  const songId = (typeof currentSongId !== 'undefined') ? currentSongId : '';
  let takes = await getTakesForSong(songId);
  if (filterSection && filterSection !== 'all') {
    takes = takes.filter(t => t.section === filterSection);
  }
  container.innerHTML = '';
  if (!takes.length) {
    container.innerHTML = '<div style="font-size:11px;color:var(--ink-faint);font-style:italic;padding:6px 2px;font-family:var(--font-display);">No vocal takes yet — record one over your backing track</div>';
    return;
  }
  [...takes].reverse().forEach(take => {
    const row = document.createElement('div');
    row.className = 'take-row' + (activeTakeId === take.id ? ' active-take' : '');
    const playBtn = document.createElement('button');
    playBtn.className = 'audio-btn take-play-btn' + (activeTakeId === take.id ? ' active' : '');
    playBtn.textContent = activeTakeId === take.id ? '🔊' : '▶';
    playBtn.title = activeTakeId === take.id ? 'Playing (click to deselect)' : 'Play with backing track';
    playBtn.onclick = () => selectTake(take.id);
    const starBtn = document.createElement('button');
    starBtn.className = 'take-star-btn' + (take.starred ? ' starred' : '');
    starBtn.textContent = take.starred ? '★' : '☆';
    starBtn.title = take.starred ? 'Unstar' : 'Star this take';
    starBtn.onclick = async (e) => { e.stopPropagation(); await updateTake(take.id, { starred: !take.starred }); renderTakesList(filterSection); };
    const labelEl = document.createElement('span');
    labelEl.className = 'take-label';
    labelEl.textContent = take.label;
    labelEl.title = 'Double-click to rename';
    labelEl.ondblclick = () => {
      const input = document.createElement('input');
      input.type = 'text'; input.value = take.label; input.className = 'take-rename-input';
      input.onblur = async () => { const v = input.value.trim(); if (v && v !== take.label) await updateTake(take.id, { label: v }); renderTakesList(filterSection); };
      input.onkeydown = e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = take.label; input.blur(); } };
      labelEl.replaceWith(input); input.focus(); input.select();
    };
    const sectionBadge = document.createElement('span');
    sectionBadge.className = 'take-section-badge';
    sectionBadge.textContent = take.section || '';
    const backingBtn = document.createElement('button');
    backingBtn.className = 'take-action-btn';
    backingBtn.textContent = '♫';
    backingBtn.title = 'Set as backing track';
    backingBtn.onclick = async (e) => { e.stopPropagation(); if (confirm('Set this take as the backing track?')) await setTakeAsBackingTrack(take.id); };
    const delBtn = document.createElement('button');
    delBtn.className = 'take-action-btn take-del-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Delete take';
    delBtn.onclick = async (e) => { e.stopPropagation(); if (activeTakeId === take.id) deselectTake(); await deleteTake(take.id); renderTakesList(filterSection); };
    row.appendChild(playBtn); row.appendChild(starBtn); row.appendChild(labelEl); row.appendChild(sectionBadge); row.appendChild(backingBtn); row.appendChild(delBtn);
    container.appendChild(row);
  });
  renderSectionFilter();
}

function renderSectionFilter() {
  const el = document.getElementById('takeSectionFilter');
  if (!el) return;
  const sections_list = typeof sections !== 'undefined' ? sections : [];
  el.innerHTML = '<option value="all">All sections</option>';
  const seen = new Set();
  sections_list.forEach(s => { if (!seen.has(s.name)) { seen.add(s.name); const opt = document.createElement('option'); opt.value = s.name; opt.textContent = s.name; el.appendChild(opt); } });
}

document.addEventListener('DOMContentLoaded', () => {
  renderTakesList();
  if (typeof currentSongId !== 'undefined' && currentSongId) loadBackingTrackForSong(currentSongId);
  const filterEl = document.getElementById('takeSectionFilter');
  if (filterEl) filterEl.addEventListener('change', () => renderTakesList(filterEl.value));
});
