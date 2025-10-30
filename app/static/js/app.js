// ====== DOM refs ======
const form = document.getElementById('chat-form');
const promptEl = document.getElementById('prompt');
const statusEl = document.getElementById('status');

const singleRow = document.getElementById('single-row');
const battleRow = document.getElementById('battle-row');
const modeInputs = [...document.querySelectorAll('input[name="mode"]')];

const modelEl  = document.getElementById('model');     // single
const modelAEl = document.getElementById('model_a');   // battle
const modelBEl = document.getElementById('model_b');   // battle

// ----- Single-mode output + metrics -----
const respEl = document.getElementById('response');
function setSingleMetrics(d) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
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

// ----- Battle elements (support old/new IDs) -----
const arena = document.getElementById('arena') || document.getElementById('battle-responses');
const hdrA  = document.getElementById('hdr-a');
const hdrB  = document.getElementById('hdr-b');
const respA = document.getElementById('resp-a');
const respB = document.getElementById('resp-b');
// prefer new ids; fallback to old
const metA  = document.getElementById('met-a')  || document.getElementById('metrics-a');
const metB  = document.getElementById('met-b')  || document.getElementById('metrics-b');

// ====== Helpers ======
function setBusy(b) {
  const btn = form.querySelector('button');
  if (btn) btn.disabled = b;
  if (statusEl) statusEl.textContent = b ? 'Thinking...' : '';
}

const parseHttpError = async (res) => {
  try { return await res.text(); } catch { return `${res.status} ${res.statusText}`; }
};

function fillMetricsTable(tbody, d) {
  if (!tbody) return; // guard if element not present
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

// ====== Models loader ======
async function loadModels() {
  setBusy(true);
  if (modelEl)  modelEl.disabled  = true;
  if (modelAEl) modelAEl.disabled = true;
  if (modelBEl) modelBEl.disabled = true;

  try {
    const r = await fetch('/api/models');
    if (!r.ok) {
      const msg = await parseHttpError(r);
      console.warn('Failed to load /api/models:', msg);
      if (statusEl) statusEl.textContent = 'Could not load model list. Is /api/models implemented?';
      return;
    }

    const data = await r.json();
    const names = (data.models || []).slice().sort();

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

    // Defaults
    const llama = names.find(n => n.startsWith('llama3.1:8b')) || names[0];
    const phi   = names.find(n => n.startsWith('phi3:3.8b'))   || names.find(n => n.startsWith('phi3')) || names[1] || names[0];

    if (llama && modelEl)  modelEl.value  = llama;   // single default
    if (llama && modelAEl) modelAEl.value = llama;   // battle A
    if (phi   && modelBEl) modelBEl.value = phi;     // battle B
  } catch (err) {
    console.error('loadModels() error:', err);
    if (statusEl) statusEl.textContent = 'Failed to load models (see console).';
  } finally {
    setBusy(false);
    if (modelEl)  modelEl.disabled  = false;
    if (modelAEl) modelAEl.disabled = false;
    if (modelBEl) modelBEl.disabled = false;
  }
}

// ====== Mode toggle ======
function updateModeUI() {
  const mode = modeInputs.find(i => i.checked)?.value || 'single';
  const single = mode === 'single';

  if (singleRow) singleRow.style.display = single ? '' : 'none';
  if (battleRow) battleRow.style.display = single ? 'none' : '';

  // Show/Hide sections
  const singleRespCard   = document.getElementById('response')?.parentElement;
  const singleMetricCard = document.getElementById('metrics')?.parentElement;
  if (singleRespCard)   singleRespCard.style.display   = single ? '' : 'none';
  if (singleMetricCard) singleMetricCard.style.display = single ? '' : 'none';
  if (arena)            arena.style.display            = single ? 'none' : '';
}
modeInputs.forEach(i => i.addEventListener('change', updateModeUI));

// ====== Submit handler ======
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const mode = modeInputs.find(i => i.checked)?.value || 'single';
  const prompt = (promptEl?.value || '').trim();
  if (!prompt) return;

  setBusy(true);

  try {
    if (mode === 'single') {
      const model = modelEl?.value;
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model })
      });
      if (!r.ok) throw new Error(await parseHttpError(r));
      const data = await r.json();

      if (respEl) respEl.textContent = data.content || '';
      setSingleMetrics(data);
    } else {
      const model_a = modelAEl?.value;
      const model_b = modelBEl?.value;
      const r = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model_a, model_b })
      });
      if (!r.ok) throw new Error(await parseHttpError(r));
      const data = await r.json();
      const [A, B] = data.results || [];
      if (!A || !B) throw new Error('Battle response malformed.');

      if (hdrA)  hdrA.textContent  = `Model A: ${A.model}`;
      if (hdrB)  hdrB.textContent  = `Model B: ${B.model}`;
      if (respA) respA.textContent = A.content || '';
      if (respB) respB.textContent = B.content || '';
      fillMetricsTable(metA, A);
      fillMetricsTable(metB, B);
    }

    if (statusEl) statusEl.textContent = 'Done';
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = 'Error';
    alert(String(err));
  } finally {
    setBusy(false);
  }
});

// ====== Bootstrap ======
document.addEventListener('DOMContentLoaded', async () => {
  await loadModels();
  updateModeUI();
});
