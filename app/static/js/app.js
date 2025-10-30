const form = document.getElementById('chat-form');
const promptEl = document.getElementById('prompt');
const statusEl = document.getElementById('status');
const respEl = document.getElementById('response');

function setMetrics(d) {
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

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const prompt = promptEl.value.trim();
  if (!prompt) return;
  statusEl.textContent = 'Thinking...';
  respEl.textContent = '';
  form.querySelector('button').disabled = true;

  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    respEl.textContent = data.content || '';
    setMetrics(data);
    statusEl.textContent = 'Done';
  } catch (err) {
    statusEl.textContent = 'Error';
    respEl.textContent = String(err);
  } finally {
    form.querySelector('button').disabled = false;
  }
});
