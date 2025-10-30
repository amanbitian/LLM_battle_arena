/* ======= Pratap LLM Battle Arena - Frontend (single file) =======
 * - Populates models from /api/models
 * - Single & Battle modes
 * - Renders responses + metrics
 * - Text-to-Speech:
 *      USE_SERVER_TTS=false -> Browser Web Speech API (recommended)
 *      USE_SERVER_TTS=true  -> POST /api/tts and play returned audio
 * ================================================================= */

const USE_SERVER_TTS = false; // set to true if your /api/tts route is live

// --- Elements ---
const form = document.getElementById('chat-form');
const promptEl = document.getElementById('prompt');
const statusEl = document.getElementById('status');

const singleRow = document.getElementById('single-row');
const battleRow = document.getElementById('battle-row');
const modeInputs = [...document.querySelectorAll('input[name="mode"]')];

const modelEl  = document.getElementById('model');    // single
const modelAEl = document.getElementById('model_a');  // battle
const modelBEl = document.getElementById('model_b');  // battle

// single mode output + metrics
const respEl = document.getElementById('response');

// battle elements
const br    = document.getElementById('battle-responses');
const hdrA  = document.getElementById('hdr-a');
const hdrB  = document.getElementById('hdr-b');
const respA = document.getElementById('resp-a');
const respB = document.getElementById('resp-b');
const metA  = document.getElementById('metrics-a');
const metB  = document.getElementById('metrics-b');

// optional speak buttons (only if you added them in HTML)
const speakSingleBtn = document.getElementById('speak-single'); // <button id="speak-single">🔊 Speak</button>
const speakABtn      = document.getElementById('speak-a');      // <button id="speak-a">🔊 A</button>
const speakBBtn      = document.getElementById('speak-b');      // <button id="speak-b">🔊 B</button>

// ---------- Helpers ----------
function setSingleMetrics(d) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('m-model', d.model);
  set('m-wall', d.wall_time_sec);
  set('m-total', d.total_time_sec);
  set('m-load', d.load_time_sec);
  set('m-peval', d.prompt_eval_time_sec);
  set('m-eval', d.eval_time_sec);
  set('m-ptok', d.prompt_tokens);
  set('m-otok', d.output_tokens);
  set('m-tpsw', d.tokens_per_sec_wall);
  set('m-tpsg', d.tokens_per_sec_generate);
}

function fillMetricsTable(tbody, d) {
  if (!tbody) return;
  tbody.innerHTML = `
    <tr><th>Model</th><td>${d.model}</td></tr>
    <tr><th>Wall time (s)</th><td>${d.wall_time_sec}</td></tr>
    <tr><th>Total (s)</th><td>${d.total_time_sec}</td></tr>
    <tr><th>Load (s)</th><td>${d.load_time_sec}</td></tr>
    <tr><th>Prompt eval (s)</th><td>${d.prompt_eval_time_sec}</td></tr>
    <tr><th>Generate (s)</th><td>${d.eval_time_sec}</td></tr>
    <tr><th>Prompt tokens</th><td>${d.prompt_tokens}</td></tr>
    <tr><th>Output tokens</th><td>${d.output_tokens}</td></tr>
    <tr><th>Tok/s (wall)</th><td>${d.tokens_per_sec_wall}</td></tr>
    <tr><th>Tok/s (generate)</th><td>${d.tokens_per_sec_generate}</td></tr>
  `;
}

async function loadModels() {
  try {
    const r = await fetch('/api/models');
    if (!r.ok) throw new Error('Failed to load models');
    const data = await r.json();
    const names = (data.models || []).sort();

    const fill = (sel) => {
      if (!sel) return;
      sel.innerHTML = '';
      names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });
    };

    fill(modelEl);
    fill(modelAEl);
    fill(modelBEl);

    // Smart defaults
    const llama = names.find(n => n.toLowerCase().startsWith('llama')) || names[0];
    const phi   = names.find(n => n.toLowerCase().startsWith('phi3'))  || names[1] || names[0];

    if (llama && modelEl)  modelEl.value  = llama;
    if (llama && modelAEl) modelAEl.value = llama;
    if (phi   && modelBEl) modelBEl.value = phi;
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Error loading models';
  }
}

function updateModeUI() {
  const mode = modeInputs.find(i => i.checked)?.value || 'single';
  const single = mode === 'single';
  if (singleRow) singleRow.style.display = single ? '' : 'none';
  if (battleRow) battleRow.style.display = single ? 'none' : '';
  const h2 = document.querySelector('section.card h2');
  if (h2) h2.textContent = single ? 'Response' : 'Response (Single)';
  if (br) br.style.display = single ? 'none' : '';
}

modeInputs.forEach(i => i.addEventListener('change', updateModeUI));

// ---------- Text-to-Speech ----------
// A) Browser-side (Web Speech API)
function speakClient(text, { voiceName=null, rate=1.0, pitch=1.0, volume=1.0 } = {}) {
  if (!text || !text.trim()) return;
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = rate;     // 0.1–10
  utter.pitch = pitch;   // 0–2
  utter.volume = volume; // 0–1
  if (voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.name === voiceName);
    if (v) utter.voice = v;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

// B) Server-side (calls /api/tts)
async function playServerTTS(text, opts = {}) {
  if (!text || !text.trim()) return;
  const r = await fetch('/api/tts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ text, ...opts })
  });
  if (!r.ok) {
    console.warn('Server TTS failed:', await r.text());
    return;
  }
  const data = await r.json();
  if (data.audio_url) {
    const audio = new Audio(data.audio_url);
    await audio.play();
  }
}

// Decide which to use
function speak(text) {
  if (USE_SERVER_TTS) return playServerTTS(text);
  return speakClient(text);
}

// Wire optional speak buttons
speakSingleBtn?.addEventListener('click', () => {
  const text = respEl?.textContent || '';
  speak(text);
});
speakABtn?.addEventListener('click', () => speak(respA?.textContent || ''));
speakBBtn?.addEventListener('click', () => speak(respB?.textContent || ''));

// ---------- Submit handler ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const mode = modeInputs.find(i => i.checked)?.value || 'single';
  const prompt = (promptEl?.value || '').trim();
  if (!prompt) return;

  statusEl.textContent = 'Thinking...';
  const btn = form.querySelector('button');
  if (btn) btn.disabled = true;

  try {
    if (mode === 'single') {
      const model = modelEl?.value;
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model })
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();

      // Render
      if (respEl) respEl.textContent = data.content || '';
      setSingleMetrics(data);
      if (br) br.style.display = 'none';

      // Auto-speak? (uncomment if you want automatic)
      // speak(data.content || '');

    } else {
      const model_a = modelAEl?.value;
      const model_b = modelBEl?.value;
      const r = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model_a, model_b })
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();

      const [A, B] = data.results || [];
      if (hdrA)  hdrA.textContent  = `Model A: ${A?.model || ''}`;
      if (hdrB)  hdrB.textContent  = `Model B: ${B?.model || ''}`;
      if (respA) respA.textContent = A?.content || '';
      if (respB) respB.textContent = B?.content || '';
      fillMetricsTable(metA, A || {});
      fillMetricsTable(metB, B || {});
      if (br) br.style.display = '';

      // Auto-speak? (uncomment if you want automatic)
      // speak(A?.content || '');
      // speak(B?.content || '');
    }

    statusEl.textContent = 'Done';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error';
    alert(String(err));
  } finally {
    if (btn) btn.disabled = false;
  }
});

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  await loadModels();
  updateModeUI();

  // Web Speech API loads voices asynchronously in some browsers
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {};
  }
});
