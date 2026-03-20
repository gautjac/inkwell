// Inkwell Recording Engine — standalone + overdub
// Stores takes in IndexedDB

let mediaRecorder = null;
let recChunks = [];
let recStartTime = 0;
let recTimerInterval = null;
let recDb = null;
let overdubSourceId = null;   // take id being overdubbed
let overdubAudio = null;      // Audio element playing the backing take

// ── IndexedDB ─────────────────────────────────────
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

async function getDb() {
  if (!recDb) recDb = await openRecDb();
  return recDb;
}

async function saveTake(blob, label) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', 'readwrite');
    tx.objectStore('takes').add({ blob, label, ts: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

async function getAllTakes() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', 'readonly');
    const req = tx.objectStore('takes').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = reject;
  });
}

async function deleteTake(id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', 'readwrite');
    tx.objectStore('takes').delete(id);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

// ── Recording ─────────────────────────────────────
async function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    startRecording(null);
  }
}

async function startRecording(overdubId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recChunks = [];
    recStartTime = Date.now();
    overdubSourceId = overdubId || null;

    // If overdubbing, play the source take through speakers
    if (overdubId) {
      const db = await getDb();
      const take = await new Promise((res, rej) => {
        const tx = db.transaction('takes', 'readonly');
        const req = tx.objectStore('takes').get(overdubId);
        req.onsuccess = () => res(req.result);
        req.onerror = rej;
      });
      if (take) {
        overdubAudio = new Audio(URL.createObjectURL(take.blob));
        overdubAudio.play();
      }
    }

    // If backing track is loaded and playing, keep it going (user can hear it)
    // MediaRecorder captures mic only, so no bleed from speakers into recording
    // (in a quiet room the speakers will bleed — advise headphones)

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recChunks.push(e.data); };
    mediaRecorder.onstop = () => finalizeRecording(stream);
    mediaRecorder.start(100);

    updateRecBtn(true, !!overdubId);
    recTimerInterval = setInterval(updateRecTimer, 1000);

  } catch(e) {
    alert('Mic access needed to record: ' + e.message);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  if (overdubAudio) {
    overdubAudio.pause();
    overdubAudio = null;
  }
  clearInterval(recTimerInterval);
  updateRecBtn(false, false);
  document.getElementById('recTimer').textContent = '';
}

async function finalizeRecording(stream) {
  stream.getTracks().forEach(t => t.stop());
  const blob = new Blob(recChunks, { type: recChunks[0]?.type || 'audio/webm' });
  const sectionName = typeof sections !== 'undefined' && sections[current]
    ? sections[current].name
    : 'Take';
  const timeStr = new Date(recStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let label;
  if (overdubSourceId) {
    label = sectionName + ' (overdub) — ' + timeStr;
  } else {
    label = sectionName + ' — ' + timeStr;
  }

  await saveTake(blob, label);
  overdubSourceId = null;
  renderTakesList();
}

function updateRecBtn(recording, isOverdub) {
  const btn = document.getElementById('recBtn');
  if (!btn) return;
  if (recording) {
    btn.textContent = '⏹ Stop';
    btn.style.background = '#c4602a';
    btn.style.color = '#f8f4ed';
    btn.style.borderColor = '#c4602a';
    btn.style.boxShadow = '0 0 0 3px rgba(196,96,42,0.2)';
  } else {
    btn.textContent = '● Record';
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.style.boxShadow = '';
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
  const takes = await getAllTakes();
  container.innerHTML = '';

  if (!takes.length) {
    container.innerHTML = '<div style="font-size:11px;color:var(--ink-faint);font-style:italic;padding:6px 2px;font-family:\'Cormorant Garamond\',serif;">No recordings yet — press ● Record to capture an idea</div>';
    return;
  }

  // Most recent first
  [...takes].reverse().forEach(take => {
    const url = URL.createObjectURL(take.blob);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px solid var(--rule);';

    // Play/stop button
    const playBtn = document.createElement('button');
    playBtn.className = 'audio-btn';
    playBtn.style.cssText = 'width:28px;height:28px;font-size:11px;flex-shrink:0;';
    playBtn.textContent = '▶';
    playBtn.title = 'Play take';

    let audio = null;
    playBtn.onclick = () => {
      if (audio && !audio.paused) {
        audio.pause(); audio.currentTime = 0;
        playBtn.textContent = '▶';
      } else {
        // Stop any other playing audio
        document.querySelectorAll('#takesList .play-audio').forEach(a => {
          a.pause(); a.currentTime = 0;
        });
        document.querySelectorAll('#takesList button').forEach(b => {
          if (b !== playBtn) b.textContent = '▶';
        });
        audio = new Audio(url);
        audio.className = 'play-audio';
        audio.play();
        playBtn.textContent = '⏹';
        audio.onended = () => { playBtn.textContent = '▶'; };
      }
    };

    // Label
    const label = document.createElement('span');
    label.style.cssText = 'flex:1;font-family:"Crimson Pro",serif;font-size:14px;font-style:italic;color:var(--ink-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    label.textContent = take.label;
    label.title = take.label;

    // Overdub button
    const overdubBtn = document.createElement('button');
    overdubBtn.className = 'audio-btn';
    overdubBtn.style.cssText = 'width:auto;padding:0 8px;height:26px;font-size:10px;border-radius:20px;flex-shrink:0;font-family:\'DM Sans\',sans-serif;letter-spacing:0.02em;color:var(--amber);border-color:var(--amber-pale);';
    overdubBtn.textContent = '+ Overdub';
    overdubBtn.title = 'Record a new take while listening to this one';
    overdubBtn.onclick = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') return;
      if (audio && !audio.paused) { audio.pause(); playBtn.textContent = '▶'; }
      startRecording(take.id);
    };

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'audio-btn';
    delBtn.style.cssText = 'width:22px;height:22px;font-size:11px;flex-shrink:0;color:var(--ink-faint);';
    delBtn.textContent = '×';
    delBtn.title = 'Delete take';
    delBtn.onclick = async () => {
      if (audio) { audio.pause(); }
      await deleteTake(take.id);
      renderTakesList();
    };

    row.appendChild(playBtn);
    row.appendChild(label);
    row.appendChild(overdubBtn);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  renderTakesList();
});
