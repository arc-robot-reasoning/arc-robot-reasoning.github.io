import { initHardware } from './players.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fixed = (n, places = 1) => n == null ? '—' : Number(n).toFixed(places).replace('-', '−');
let results;
const state = { benchmark: 'robolab', condition: 'default', detailed: false };

function model(name) {
  let text = escape(name).replace(/π0\.5|π₀\.₅/g, 'π<sub>0.5</sub>').replace(/π0(?=-)|π₀(?=-)/g, 'π<sub>0</sub>');
  return text.replace('+ ARC', '+ <img src="assets/figures/arc.png" width="16" height="16" alt=""> ARC');
}
function rate(row, withBar = true) {
  const bar = withBar ? `<span class="sr-bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, row.sr))}%"></i></span>` : '';
  const pm = row.sr_pm_pp != null ? `<span class="uncertainty">± ${fixed(row.sr_pm_pp)}</span>` : '';
  const gain = row.gain_pp != null ? `<span class="gain" title="Gain over the corresponding base policy, in percentage points">+${fixed(row.gain_pp)}</span>` : '';
  return `${bar}<span>${fixed(row.sr)}</span>${pm}${gain}`;
}
function metric(value, pm) {
  return `${fixed(value, 2)}${pm != null ? `<span class="uncertainty">± ${fixed(pm, 2)}</span>` : ''}`;
}
function compactTable(rows, title) {
  return `<div class="table-scroll" tabindex="0" aria-label="${escape(title)} results, scroll horizontally if needed"><table><caption>${escape(title)}</caption><thead><tr><th scope="col">Policy</th><th scope="col" class="numeric">Success rate (%)</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.ours ? 'arc-row' : ''}"><th scope="row" class="model-cell">${model(r.policy)}</th><td class="numeric rate-cell">${rate(r, false)}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderResults() {
  const target = $('#results-tables');
  const toolbar = $('.table-toolbar');
  const note = $('#table-note');
  toolbar.hidden = state.benchmark !== 'robolab';
  if (state.benchmark === 'robolab') {
    target.setAttribute('role', 'tabpanel');
    target.setAttribute('aria-labelledby', `condition-${state.condition}`);
  } else {
    target.removeAttribute('role');
    target.removeAttribute('aria-labelledby');
  }
  if (state.benchmark === 'robolab') {
    const rows = results.robolab[state.condition];
    const detailed = state.detailed;
    const title = `RoboLab-120 · ${state.condition.charAt(0).toUpperCase() + state.condition.slice(1)} instructions`;
    target.innerHTML = `<div class="table-scroll" tabindex="0" aria-label="${title} results, scroll horizontally if needed"><table><caption>${title}</caption><thead><tr><th scope="col" class="rank">#</th><th scope="col">Policy</th><th scope="col">Type</th>${detailed ? '<th scope="col" class="numeric">N</th>' : ''}<th scope="col" class="numeric">Success rate (%)</th>${detailed ? '<th scope="col" class="numeric">EE speed (cm/s)</th><th scope="col" class="numeric">EE SPARC</th><th scope="col">Obs.</th>' : ''}</tr></thead><tbody>${rows.map(r => `<tr class="${r.ours ? 'arc-row' : ''}"><td class="rank">${r.rank}</td><th scope="row" class="model-cell">${model(r.policy)}</th><td class="type">${escape(r.type)}</td>${detailed ? `<td class="numeric detail-cell">${r.success_count == null ? '—' : `${r.success_count}/${r.total}`}</td>` : ''}<td class="numeric rate-cell">${rate(r, !detailed)}</td>${detailed ? `<td class="numeric detail-cell">${metric(r.ee_speed, r.speed_pm)}</td><td class="numeric detail-cell">${metric(r.ee_sparc, r.ee_sparc_pm)}</td><td class="detail-cell">${escape(r.obs.join('+'))}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
    note.textContent = `Top 11 policies, including both ARC variants. Green values are gains over the corresponding base policy in percentage points. ${results.uncertaintyNote}${detailed ? ' N denotes successes/trials; — denotes an unreported value.' : ''}`;
  } else if (state.benchmark === 'molmo') {
    target.innerHTML = `<p class="table-intro">General manipulation on MolmoSpaces, without training on MolmoSpaces data.</p><div class="table-scroll" tabindex="0" aria-label="MolmoSpaces results"><table><caption>MolmoSpaces</caption><thead><tr><th scope="col" class="rank">#</th><th scope="col">Policy</th><th scope="col" class="numeric">Success rate (%)</th><th scope="col" class="numeric">Tasks</th></tr></thead><tbody>${results.molmo.map(r => `<tr class="${r.ours ? 'arc-row' : ''}"><td class="rank">${r.rank}</td><th scope="row" class="model-cell">${model(r.policy)}</th><td class="numeric rate-cell">${rate(r)}</td><td class="numeric">${escape(r.tasks)}</td></tr>`).join('')}</tbody></table></div>`;
    note.textContent = 'Reported benchmark results. Task coverage differs for TiPToP (7/9); the other listed policies report 9/9. Green values are gains over the corresponding base policy in percentage points.';
  } else {
    target.innerHTML = `<p class="table-intro">Reasoning-focused tasks span context, long-horizon execution, discovery, and negation.</p><div class="reasoning-tables">${compactTable(results.reasoning.sim, 'RoboLab-Reasoning-50')}${compactTable(results.reasoning.hardware, 'RoboLab-Reasoning-Hardware')}</div>`;
    note.textContent = 'Simulation: 50 tasks, 10 episodes per task. Hardware uses the simulation checkpoints with no hardware-specific fine-tuning. Green values are gains over the corresponding base policy in percentage points.';
  }
}

function setTabs(list, active) {
  for (const tab of list.querySelectorAll('[role="tab"]')) {
    const selected = tab === active;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.classList.toggle('active', selected);
  }
}
function keyboardTabs(list) {
  list.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...list.querySelectorAll('[role="tab"]')];
    const current = buttons.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus(); buttons[next].click();
  });
}

const architectures = {
  vla: {
    html: '<h3>π<sub>0.5</sub>-DROID + ARC</h3><p>Jointly fine-tune the vision-language backbone, trace encoder, and action expert. Factual examples use flow matching; contradictory traces receive a counterfactual margin loss.</p><ul><li>Continuous action prediction</li><li>Trace-conditioned action expert</li><li>Counterfactual supervision</li></ul>',
    asset: 'arc-pi05-finetuning', title: 'ARC fine-tuning: π0.5-DROID', alt: 'ARC joint fine-tuning architecture for π0.5-DROID, with flow matching and a counterfactual margin loss.', width: 1976, height: 2000
  },
  wam: {
    html: '<h3>Cosmos3-Nano-Policy + ARC</h3><p>Jointly fine-tune the reasoner and generator. The reasoner learns causal-trace tokens; the generator predicts velocities for actions and future observations, conditioned on the ground-truth trace.</p><ul><li>Next-token trace supervision</li><li>Separate action and observation flow losses</li><li>Action flow-matching loss weighted by 10</li></ul>',
    asset: 'arc-cosmos-finetuning', title: 'ARC fine-tuning: Cosmos3-Nano-Policy', alt: 'ARC joint fine-tuning of the Cosmos3-Nano-Policy reasoner and generator, with trace prediction and two velocity flow-matching objectives.', width: 2000, height: 1976
  }
};
for (const button of $$('[data-architecture]')) button.addEventListener('click', () => {
  const data = architectures[button.dataset.architecture];
  setTabs(button.parentElement, button);
  $('#architecture-content').innerHTML = data.html;
  $('#architecture-content').setAttribute('aria-labelledby', button.id);
  const image = $('#architecture-image');
  Object.assign(image, { src: `assets/figures/${data.asset}.webp`, alt: data.alt, width: data.width, height: data.height });
  Object.assign($('#architecture-figure').dataset, { zoom: image.src, pdf: `assets/figures/${data.asset}.pdf`, title: data.title });
});

const dialog = $('#figure-dialog');
let lastFigureButton;
document.addEventListener('click', event => {
  const button = event.target.closest('[data-zoom]');
  if (!button) return;
  lastFigureButton = button;
  $('#dialog-title').textContent = button.dataset.title;
  $('#dialog-image').src = button.dataset.zoom;
  $('#dialog-image').alt = button.querySelector('img')?.alt || button.dataset.title;
  $('#dialog-pdf').href = button.dataset.pdf;
  dialog.showModal();
  document.body.style.overflow = 'hidden';
  $('#close-dialog').focus();
});
$('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => { document.body.style.overflow = ''; lastFigureButton?.focus({preventScroll: true}); });
$$('[role="tablist"]').filter(el => el.id !== 'task-tabs').forEach(keyboardTabs);

for (const button of $$('[data-benchmark]')) button.addEventListener('click', () => {
  if (!results) return;
  state.benchmark = button.dataset.benchmark;
  setTabs(button.parentElement, button);
  $('#benchmark-panel').setAttribute('aria-labelledby', button.id);
  renderResults();
});
for (const button of $$('[data-condition]')) {
  button.id = `condition-${button.dataset.condition}`;
  button.setAttribute('aria-controls', 'results-tables');
  button.addEventListener('click', () => {
    if (!results) return;
    state.condition = button.dataset.condition;
    setTabs(button.parentElement, button);
    renderResults();
  });
}
$('#detailed-metrics').addEventListener('change', event => { state.detailed = event.target.checked; if (results) renderResults(); });

async function getJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${response.status}: ${path}`);
  return response.json();
}

await Promise.all([
  getJSON('assets/data/results.json').then(data => {
    results = data;
    const abstract = data.abstract.replace(/https?:\/\/\S+/g, '').trim();
    const paragraph = document.createElement('p'); paragraph.textContent = abstract;
    $('#full-abstract').append(paragraph);
    renderResults();
  }).catch(error => {
    console.error(error);
    $('#results-tables').innerHTML = '<p class="load-error">The benchmark tables could not load. <a href="assets/paper/arc-paper.pdf">Read the results in the paper.</a></p>';
  }),
  Promise.all([getJSON('assets/data/videos.json'), getJSON('assets/data/traces.json')]).then(([media, traces]) => initHardware(media.groups, traces.groups)).catch(error => {
    console.error(error);
    $('#comparison-panel').innerHTML = '<p class="load-error">The video gallery could not load. Please refresh the page.</p>';
  })
]);

const sectionObserver = new IntersectionObserver(entries => {
  const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
  if (!visible) return;
  for (const link of $$('.nav-links a')) link.classList.toggle('active', link.hash === `#${visible.target.id}`);
}, {rootMargin:'-15% 0px -55% 0px', threshold: [0, .1, .3]});
for (const section of $$('#hardware, #method, #results, #dataset, #analysis')) sectionObserver.observe(section);
