/* Strict Single ↔ Battle toggle with clean blocks */

const USE_SERVER_TTS = false;

// Elements
const form = document.getElementById('chat-form');
const promptEl = document.getElementById('prompt');
const statusEl = document.getElementById('status');

const singleRow = document.getElementById('single-row');
const battleRow = document.getElementById('battle-row');
const modeInputs = [...document.querySelectorAll('input[name="mode"]')];

const modelEl  = document.getElementById('model');
const modelAEl = document.getElementById('model_a');
const modelBEl = document.getElementById('model_b');

// Blocks
const singleBlock = document.getElementById('single-block');
const battleBlock = document.getElementById('battle-block');

// Single outputs
const respEl = document.getElementById('response');

// Battle outputs
const hdrA  = document.getElementById('hdr-a');
const hdrB  = document.getElementById('hdr-b');
const respA = document.getElementById('resp-a');
const respB = document.getElementById('resp-b');
const metA  = document.getElementById('metrics-a');
const metB  = document.getElementById('metrics-b');

// Speak buttons
const btnSpeakSingle = document.getElementById('speak-single');
const btnSpeakA      = document.getElementById('speak-a');
const btnSpeakB      = document.getElementById('speak-b');

// Hide legacy speak element if present
const legacySpeak = document.getElementById('speak');

// Helpers
function show(el, on) { if (el) el.style.display = on ? '' : 'none'; }
function currentMode() { return modeInputs.find(i => i.checked)?.value || 'single'; }

function applyUI() {
  const single = currentMode() === 'single';

  // selectors for models
  show(singleRow, single);
  show(battleRow, !single);

  // whole blocks
  show(singleBlock, single);
  show(battleBlock, !single);

  // if a legacy speak button exists, hide it in battle
  if (legacySpeak) show(legacySpeak, single);
}

function setSingleMetrics(d = {}) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '–'; };
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

function fillMetricsTable(tbody, d = {}) {
  if (!tbody) return;
  tbody.innerHTML = `
    <tr><th>Model</th><td>${d.model ?? '–'}</td></tr>
    <tr><th>Wall time (s)</th><td>${d.wall_time_sec ?? '–'}</td></tr>
    <tr><th>Total (s)</th><td>${d.total_time_sec ?? '–'}</td></tr>
    <tr><th>Load (s)</th><td>${d.load_time_sec ?? '–'}</td></tr>
    <tr><th>Prompt eval (s)</th><td>${d.prompt_eval_time_sec ?? '–'}</td></tr>
    <tr><th>Generate (s)</th><td>${d.eval_time_sec ?? '–'}</td></tr>
    <tr><th>Prompt tokens</th><td>${d.prompt_tokens ?? '–'}</td></tr>
    <tr><th>Output tokens</th><td>${d.output_tokens ?? '–'}</td></tr>
    <tr><th>Tok/s (wall)</th><td>${d.tokens_per_sec_wall ?? '–'}</td></tr>
    <tr><th>Tok/s (generate)</th><td>${d.tokens_per_sec_generate ?? '–'}</td></tr>
  `;
}

// Load models
async function loadModels() {
  try {
    const r = await fetch('/api/models');
    if (!r.ok) throw new Error('Failed to load models');
    const data = await r.json();
    const names = (data.models || []).sort();

    const fill = (sel) => {
      if (!sel) return;
      sel.innerHTML = '';
      names.forEach(n => {
        const o = document.createElement('option');
        o.value = o.textContent = n;
        sel.appendChild(o);
      });
    };
    fill(modelEl); fill(modelAEl); fill(modelBEl);

    const llama = names.find(n => n.toLowerCase().startsWith('llama')) || names[0];
    const phi   = names.find(n => n.toLowerCase().startsWith('phi3'))  || names[1] || names[0];
    if (llama) { if (modelEl) modelEl.value = llama; if (modelAEl) modelAEl.value = llama; }
    if (phi && modelBEl) modelBEl.value = phi;
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Error loading models';
  }
}

// TTS
function speakClient(text) {
  if (!text?.trim() || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
async function speakServer(text) {
  const r = await fetch('/api/tts', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text}) });
  if (!r.ok) return;
  const { audio_url } = await r.json();
  if (audio_url) new Audio(audio_url).play();
}
function speak(text){ return USE_SERVER_TTS ? speakServer(text) : speakClient(text); }

btnSpeakSingle?.addEventListener('click', () => speak(respEl?.textContent || ''));
btnSpeakA?.addEventListener('click', () => speak(respA?.textContent || ''));
btnSpeakB?.addEventListener('click', () => speak(respB?.textContent || ''));

// Mode change
modeInputs.forEach(i => i.addEventListener('change', applyUI));

// Submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  applyUI(); // lock correct block instantly

  const prompt = (promptEl?.value || '').trim();
  if (!prompt) return;

  statusEl.textContent = 'Thinking...';
  const btn = document.getElementById('send'); btn.disabled = true;

  try {
    if (currentMode() === 'single') {
      const model = modelEl?.value;
      const r = await fetch('/api/chat', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ prompt, model })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Chat failed');

      respEl.textContent = data.content || '';
      setSingleMetrics(data);

    } else {
      const model_a = modelAEl?.value;
      const model_b = modelBEl?.value;
      const r = await fetch('/api/battle', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ prompt, model_a, model_b })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Battle failed');

      const [A, B] = data.results || [];
      hdrA.textContent  = `Model A: ${A?.model || ''}`;
      hdrB.textContent  = `Model B: ${B?.model || ''}`;
      respA.textContent = A?.content || '';
      respB.textContent = B?.content || '';
      fillMetricsTable(metA, A || {});
      fillMetricsTable(metB, B || {});
    }

    statusEl.textContent = 'Done';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error';
    alert(String(err));
  } finally {
    btn.disabled = false;
  }
});

// Init
document.addEventListener('DOMContentLoaded', async () => {
  await loadModels();
  applyUI();               // enforce the correct block on load
  if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => {};
});
