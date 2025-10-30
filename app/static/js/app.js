const form = document.getElementById('chat-form');
const promptEl = document.getElementById('prompt');
const statusEl = document.getElementById('status');

const singleRow = document.getElementById('single-row');
const battleRow = document.getElementById('battle-row');
const modeInputs = [...document.querySelectorAll('input[name="mode"]')];

const modelEl = document.getElementById('model');     // single
const modelAEl = document.getElementById('model_a');  // battle
const modelBEl = document.getElementById('model_b');  // battle

// single-mode output
const respEl = document.getElementById('response');

// battle elements
const br = document.getElementById('battle-responses');
const hdrA = document.getElementById('hdr-a');
const hdrB = document.getElementById('hdr-b');
const respA = document.getElementById('resp-a');
const respB = document.getElementById('resp-b');
const metA = document.getElementById('metrics-a');
const metB = document.getElementById('metrics-b');

// Optional Speak buttons (add these IDs to your HTML near outputs if not present)
const speakSingleBtn = document.getElementById('speak-single'); // <button id="speak-single">🔊 Speak</button>
const speakABtn = document.getElementById('speak-a');           // <button id="speak-a">🔊 A</button>
const speakBBtn = document.getElementById('speak-b');           // <button id="speak-b">🔊 B</button>

function setSingleMetrics(d) {
  const set = (id, v) => document.getElementById(id).textContent = v;
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
  const r = await fetch('/api/models');
  if (!r.ok) return;
  const data = await r.json();
  const names = (data.models || []).sort();

  const fill = (sel) => {
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

  const llama = names.find(n => n.startsWith('llama3.1:8b')) || names[0];
  const phi = names.find(n => n.startsWith('phi3:3.8b')) || names[1] || names[0];

  if (llama) modelEl.value = llama;
  if (llama) modelAEl.value = llama;
  if (phi)   modelBEl.value = phi;
}

function updateModeUI() {
  const mode = modeInputs.find(i => i.checked).value;
  const single = mode === 'single';
  singleRow.style.display = single ? '' : 'none';
  battleRow.style.display = single ? 'none' : '';
  document.querySelector('section.card h2').textContent = single ? 'Response' : 'Response (Single)';
  br.style.display = single ? 'none' : '';
}

// ---------- TTS helpers ----------
async function playTTS(text, options = {}) {
  try {
    const r = await fetch('/api/tts', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ text, ...options })
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    if (data.audio_url) {
      const audio = new Audio(data.audio_url);
      await audio.play();
    }
  } catch (e) {
    console.error('TTS error:', e);
  }
}

// Wire speak buttons (if present)
speakSingleBtn?.addEventListener('click', () => {
  const text = respEl.textContent || '';
  if (text.trim()) playTTS(text);
});
speakABtn?.addEventListener('click', () => {
  const text = respA.textContent || '';
  if (text.trim()) playTTS(text);
});
speakBBtn?.addEventListener('click', () => {
  const text = respB.textContent || '';
  if (text.trim()) playTTS(text);
});

modeInputs.forEach(i => i.addEventListener('change', updateModeUI));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const mode = modeInputs.find(i => i.checked).value;
  const prompt = promptEl.value.trim();
  if (!prompt) return;

  statusEl.textContent = 'Thinking...';
  form.querySelector('button').disabled = true;

  try {
    if (mode === 'single') {
      const model = modelEl.value;
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model })
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      respEl.textContent = data.content || '';
      setSingleMetrics(data);
      br.style.display = 'none';
      // auto-speak (optional). Comment out if you prefer manual button only.
      // await playTTS(data.content || '');
    } else {
      const model_a = modelAEl.value;
      const model_b = modelBEl.value;
      const r = await fetch('/api/battle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model_a, model_b })
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      const [A, B] = data.results || [];
      hdrA.textContent = `Model A: ${A.model}`;
      hdrB.textContent = `Model B: ${B.model}`;
      respA.textContent = A.content || '';
      respB.textContent = B.content || '';
      fillMetricsTable(metA, A);
      fillMetricsTable(metB, B);
      br.style.display = '';
      // auto-speak both (optional)
      // await playTTS(A.content || '');
      // await playTTS(B.content || '');
    }
    statusEl.textContent = 'Done';
  } catch (err) {
    statusEl.textContent = 'Error';
    console.error(err);
    alert(String(err));
  } finally {
    form.querySelector('button').disabled = false;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadModels();
  updateModeUI();
});
