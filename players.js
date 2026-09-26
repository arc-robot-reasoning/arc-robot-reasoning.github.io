/** Hardware comparisons share elapsed playback time, never normalized progress. */
const POLICIES = { arc: 'π₀.₅ + ARC', cosmos: 'Cosmos3-Nano-Policy', pi: 'π₀.₅' };
const ROLE_ORDER = ['arc', 'cosmos', 'pi'];
const TRACE_LABELS = {
  state: 'State', perceived_state: 'State', cause: 'Cause', relevant_cause: 'Cause',
  consequence: 'Consequence', possible_consequence: 'Consequence', effect: 'Effect',
  chosen_effect: 'Effect', action: 'Action', action_implication: 'Action',
  avoid: 'Avoid', forbidden_effect: 'Avoid', completion: 'Completion',
};
const TRACE_ORDER = ['State', 'Cause', 'Consequence', 'Effect', 'Action', 'Avoid', 'Completion'];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function timeLabel(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function traceTimeLabel(seconds) {
  const tenths = Math.max(0, Math.round((Number(seconds) || 0) * 10));
  return `${Math.floor(tenths / 600)}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
}

function modelLabel(role) {
  const label = element('span', 'video-model');
  if (role === 'cosmos') {
    label.textContent = POLICIES.cosmos;
  } else {
    label.append(document.createTextNode('π'), element('sub', '', '0.5'));
    if (role === 'arc') {
      const logo = element('img');
      logo.src = 'assets/figures/arc.png';
      logo.alt = '';
      logo.width = 17;
      logo.height = 17;
      label.append(document.createTextNode(' + '), logo, document.createTextNode('ARC'));
    }
  }
  return label;
}

/** Only supplied trace text is rendered. Missing/unknown provenance stays hidden. */
function traceView(container, supplied) {
  container.replaceChildren();
  container.hidden = true;
  const validProvenance = supplied && ['recorded', 'authored'].includes(supplied.provenance);
  const segments = validProvenance && Array.isArray(supplied.segments)
    ? supplied.segments.filter((segment) => {
      if (!finite(segment.start) || !finite(segment.end) || segment.start < 0 || segment.end <= segment.start) return false;
      if (typeof segment.text === 'string' && segment.text.trim()) return true;
      return segment.fields && typeof segment.fields === 'object' &&
        Object.values(segment.fields).some((value) => typeof value === 'string' && value.trim());
    }).slice().sort((a, b) => a.start - b.start)
    : [];
  if (!segments.length) return { update() {} };

  const header = element('div', 'trace-panel-header');
  const name = element('span', 'trace-name', 'Action-grounded reasoning traces');
  const provenance = element('span', 'trace-provenance', supplied.provenance === 'authored' ? 'Authored trace' : 'Recorded trace');
  const position = element('span', 'trace-position');
  const meta = element('span', 'trace-meta');
  const body = element('div', 'trace-panel-body');
  body.setAttribute('aria-live', 'polite');
  body.setAttribute('aria-atomic', 'true');
  meta.append(provenance, position);
  header.append(name, meta);
  container.append(header, body);
  let previous = null;
  return {
    update(time) {
      // Once the clip finishes, retain its final supplied explanation while
      // longer comparison clips continue. Keep the original phase time range.
      const finalSegment = segments[segments.length - 1];
      const current = segments.find((segment) => time >= segment.start && time < segment.end)
        || (time >= finalSegment.end ? finalSegment : null);
      if (current === previous) return;
      previous = current;
      container.hidden = !current;
      if (!current) return;
      position.textContent = `${traceTimeLabel(current.start)}–${traceTimeLabel(current.end)}`;
      body.replaceChildren();
      let paragraph;
      if (typeof current.text === 'string' && current.text.trim()) {
        paragraph = current.text.trim();
      } else {
        const fields = Object.entries(current.fields)
          .filter(([, value]) => typeof value === 'string' && value.trim())
          .map(([key, value]) => {
            const normalized = key.toLowerCase().replace(/[\s-]+/g, '_');
            const label = TRACE_LABELS[normalized] || key.replaceAll('_', ' ');
            const order = TRACE_ORDER.indexOf(label);
            return { label, value, order: order < 0 ? TRACE_ORDER.length : order };
          })
          .sort((a, b) => a.order - b.order);
        paragraph = fields.map(({ value }) => value.trim()).join(' ');
      }
      body.append(element('p', 'trace-paragraph', paragraph));
    },
  };
}

function mediaError(video) {
  const code = video.error?.code;
  if (code === 2) return 'Video could not load. Check the connection and retry this task.';
  if (code === 3) return 'This browser could not decode the video.';
  if (code === 4) return 'Video unavailable or unsupported in this browser.';
  return 'Video unavailable. Retry this task to load it again.';
}

function makeVideoCard(clip, group, signal, onChange, dynamic = false) {
  const card = element('article', dynamic ? 'dynamic-card' : `video-card${clip.role === 'arc' ? ' ours' : ''}`);
  const policy = POLICIES[clip.role] || clip.policy || 'Policy';
  card.setAttribute('aria-label', `${policy}: ${group.instruction}`);
  if (dynamic) card.append(element('h4', 'dynamic-instruction', group.instruction));
  const heading = element('div', 'video-card-heading');
  heading.append(modelLabel(clip.role), element('span', 'video-tag', clip.role === 'arc' ? 'Fine-tuned' : 'Base policy'));
  const viewport = element('div', 'video-viewport');
  const video = element('video');
  video.preload = 'metadata';
  video.playsInline = true;
  video.muted = true;
  video.defaultMuted = true;
  video.controls = dynamic;
  video.setAttribute('aria-label', `${policy} recorded rollout: ${group.instruction}`);
  video.poster = clip.poster || '';
  if (!dynamic) video.tabIndex = -1;
  const status = element('span', 'video-status', 'Loading video…');
  status.setAttribute('role', 'status');
  const foot = element('div', 'video-foot');
  const description = element('span', '', dynamic ? `${clip.sourceSpeed || group.sourceSpeed || 3}× recorded speed` : 'Recorded rollout');
  const durationLabel = element('span', '', timeLabel(clip.duration));
  foot.append(description, durationLabel);
  viewport.append(video, status);
  card.append(heading, viewport, foot);

  let settle;
  const record = {
    card, video, clip, status, description, ready: false, failed: false,
    duration: finite(clip.duration) ? clip.duration : 0,
    metadata: new Promise((resolve) => { settle = resolve; }),
    setStatus(message) {
      if (status.textContent !== message) status.textContent = message;
      status.hidden = !message;
    },
    fail(message) {
      record.failed = true;
      record.setStatus('Video unavailable');
      description.textContent = message;
      description.setAttribute('role', 'alert');
      video.pause();
      settle();
      onChange(record);
    },
  };
  const timeout = window.setTimeout(() => {
    if (!record.ready && !signal.aborted) record.fail('Video metadata did not load. Retry this task.');
  }, 12000);
  video.addEventListener('loadedmetadata', () => {
    window.clearTimeout(timeout);
    record.ready = true;
    record.failed = false;
    record.duration = finite(video.duration) ? video.duration : record.duration;
    durationLabel.textContent = timeLabel(record.duration);
    description.textContent = dynamic ? `${clip.sourceSpeed || group.sourceSpeed || 3}× recorded speed` : 'Recorded rollout';
    description.removeAttribute('role');
    record.setStatus('');
    settle();
    onChange(record);
  }, { signal });
  video.addEventListener('error', () => record.fail(mediaError(video)), { signal });
  video.addEventListener('waiting', () => record.setStatus(record.failed ? 'Video unavailable' : 'Buffering…'), { signal });
  video.addEventListener('playing', () => {
    record.setStatus('');
    description.textContent = dynamic ? `${clip.sourceSpeed || group.sourceSpeed || 3}× recorded speed` : 'Recorded rollout';
  }, { signal });
  video.addEventListener('seeked', () => {
    if (!record.failed) record.setStatus(video.ended ? 'Clip ended' : '');
  }, { signal });
  video.addEventListener('ended', () => record.setStatus('Clip ended'), { signal });
  signal.addEventListener('abort', () => {
    window.clearTimeout(timeout);
    settle();
    video.pause();
    video.removeAttribute('src');
    video.load();
  }, { once: true });
  video.src = clip.video;
  return record;
}

function setVideoTime(record, requested) {
  if (!record.ready || record.failed) return;
  const target = clamp(requested, 0, Math.max(0, record.duration - 0.001));
  if (Math.abs(record.video.currentTime - target) < 0.015) return;
  try {
    record.video.currentTime = target;
  } catch {
    record.setStatus('Seeking…');
  }
}

/** Resolve after pending media seeks; superseded selections are always ignored. */
function seekSettled(record, signal) {
  if (record.failed || !record.video.seeking || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let timeout;
    const done = () => {
      window.clearTimeout(timeout);
      record.video.removeEventListener('seeked', done);
      record.video.removeEventListener('error', done);
      signal.removeEventListener('abort', done);
      resolve();
    };
    timeout = window.setTimeout(done, 2500);
    record.video.addEventListener('seeked', done, { once: true });
    record.video.addEventListener('error', done, { once: true });
    signal.addEventListener('abort', done, { once: true });
  });
}

/**
 * groups: assets/data/videos.json.groups
 * traces[group.id]: { provenance: 'recorded'|'authored', segments: [{start,end,text|fields}] }
 * Trace times are seconds on the supplied, already-accelerated media timeline.
 */
export async function initHardware(groups, traces = {}) {
  const get = (selector) => {
    const node = document.querySelector(selector);
    if (!node) throw new Error(`Hardware player requires ${selector}`);
    return node;
  };
  const tabs = get('#task-tabs');
  const panel = get('#comparison-panel');
  const grid = get('#comparison-videos');
  const category = get('#demo-category');
  const instruction = get('#demo-instruction');
  const transport = get('#comparison-transport');
  const playButton = get('#comparison-transport .play-all');
  const playIcon = get('#comparison-transport .play-icon');
  const playText = get('#comparison-transport .play-text');
  const restartButton = get('#comparison-transport .restart');
  const timeline = get('#comparison-transport .timeline');
  const readout = get('#comparison-transport .time-readout');
  const rateSelect = get('#comparison-transport .playback-rate');
  const tracePanel = get('#comparison-trace');
  const dynamicGrid = get('#dynamic-videos');
  const allGroups = Array.isArray(groups) ? groups : (groups?.groups || []);
  const comparisons = allGroups.filter((group) => group.pairing === 'three-policy');
  const dynamicGroups = allGroups.filter((group) => group.pairing === 'arc-only');
  const lifetime = new AbortController();
  let selection = null;
  let disposed = false;
  let operation = 0;
  let rate = Number(rateSelect.value) || 1;
  const dynamicRecords = [];
  tabs.replaceChildren();
  grid.replaceChildren();
  dynamicGrid.replaceChildren();
  tabs.setAttribute('aria-orientation', 'horizontal');

  function available(current = selection) {
    return current ? current.records.filter((record) => record.ready && !record.failed) : [];
  }

  function master(current = selection) {
    return available(current).reduce((longest, record) => !longest || record.duration > longest.duration ? record : longest, null);
  }

  function updateTransport() {
    if (!selection) return;
    const current = selection;
    const usable = available(current);
    playButton.disabled = !current.metadataSettled || !usable.length;
    restartButton.disabled = !usable.length;
    timeline.disabled = !usable.length;
    playIcon.textContent = current.playing ? 'Ⅱ' : '▶';
    playText.textContent = !current.metadataSettled ? 'Loading videos…' : current.playing ? 'Pause comparison' : 'Play comparison';
    playButton.setAttribute('aria-label', `${current.playing ? 'Pause' : 'Play'} ${usable.length === 3 ? 'all three' : 'available'} videos`);
    playButton.setAttribute('aria-pressed', String(current.playing));
    timeline.max = String(current.duration || 1);
    if (!current.scrubbing) timeline.value = String(clamp(current.time, 0, current.duration));
    const text = `${timeLabel(current.time)} / ${timeLabel(current.duration)}`;
    if (readout.textContent !== text) readout.textContent = text;
    timeline.setAttribute('aria-valuetext', `${timeLabel(current.time)} of ${timeLabel(current.duration)}`);
  }

  function pause() {
    operation += 1;
    if (!selection) return;
    selection.playing = false;
    selection.records.forEach(({ video }) => video.pause());
    updateTransport();
  }

  async function play() {
    const current = selection;
    if (!current || disposed || !current.metadataSettled) return;
    const request = ++operation;
    if (current.time >= current.duration - 0.04) {
      current.time = 0;
      current.records.forEach((record) => setVideoTime(record, 0));
    }
    await Promise.all(current.records.map((record) => seekSettled(record, current.controller.signal)));
    if (selection !== current || request !== operation || disposed || document.hidden) return;
    const toPlay = available(current).filter((record) => current.time < record.duration - 0.025);
    if (!toPlay.length) return;
    current.playing = true;
    updateTransport();
    const results = await Promise.allSettled(toPlay.map((record) => {
      record.video.playbackRate = rate;
      return Promise.resolve(record.video.play());
    }));
    if (selection !== current || request !== operation || disposed) return;
    let failed = false;
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed = true;
        toPlay[index].setStatus('Playback did not start');
        toPlay[index].description.textContent = 'Playback was blocked or interrupted. Press Play to retry.';
      }
    });
    if (failed) pause();
  }

  function seek(time) {
    if (!selection) return;
    selection.time = clamp(Number(time) || 0, 0, selection.duration);
    selection.records.forEach((record) => {
      setVideoTime(record, selection.time);
      if (!record.failed) record.setStatus(selection.time >= record.duration - 0.025 ? 'Clip ended' : '');
    });
    selection.trace.update(selection.time);
    updateTransport();
  }

  function selectTask(id, { focus = false } = {}) {
    const group = comparisons.find((candidate) => candidate.id === id);
    if (!group || disposed) return false;
    pause();
    selection?.controller.abort();
    const controller = new AbortController();
    const current = {
      group, controller, records: [], time: 0, duration: Math.max(0, ...group.videos.map((video) => Number(video.duration) || 0)),
      playing: false, scrubbing: false, resumeAfterSeek: false, metadataSettled: false,
      trace: traceView(tracePanel, traces[group.id]),
    };
    selection = current;
    category.textContent = group.category;
    instruction.textContent = group.instruction;
    panel.setAttribute('aria-labelledby', `hardware-tab-${group.id}`);
    panel.setAttribute('aria-busy', 'true');
    // Keep the same trace panel across task changes before removing its old card.
    tracePanel.remove();
    grid.replaceChildren();
    for (const tab of tabs.querySelectorAll('[role="tab"]')) {
      const selected = tab.dataset.task === group.id;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) {
        tab.focus();
        tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
    for (const clip of group.videos.slice().sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))) {
      const record = makeVideoCard(clip, group, controller.signal, () => {
        if (selection !== current) return;
        const durationRecords = current.metadataSettled ? available(current) : current.records;
        current.duration = Math.max(0, ...durationRecords.map((item) => item.duration));
        if (current.playing && current.records.some((item) => item.failed)) pause();
        updateTransport();
      });
      record.video.playbackRate = rate;
      current.records.push(record);
      grid.append(record.card);
    }
    const arcCard = current.records.find((record) => record.clip.role === 'arc')?.card;
    if (arcCard) arcCard.append(tracePanel);
    current.trace.update(0);
    updateTransport();
    Promise.all(current.records.map((record) => record.metadata)).then(() => {
      if (selection !== current || disposed) return;
      current.metadataSettled = true;
      current.duration = Math.max(0, ...available(current).map((record) => record.duration));
      panel.setAttribute('aria-busy', 'false');
      updateTransport();
    });
    return true;
  }

  comparisons.forEach((group) => {
    const tab = element('button', '', group.title);
    tab.type = 'button';
    tab.id = `hardware-tab-${group.id}`;
    tab.dataset.task = group.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'comparison-panel');
    tab.setAttribute('aria-selected', 'false');
    tab.tabIndex = -1;
    tab.addEventListener('click', () => selectTask(group.id), { signal: lifetime.signal });
    tabs.append(tab);
  });
  tabs.addEventListener('keydown', (event) => {
    const buttons = [...tabs.querySelectorAll('[role="tab"]')];
    const index = buttons.indexOf(event.target);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    selectTask(buttons[next].dataset.task, { focus: true });
  }, { signal: lifetime.signal });
  playButton.addEventListener('click', () => selection?.playing ? pause() : void play(), { signal: lifetime.signal });
  restartButton.addEventListener('click', () => {
    const resume = selection?.playing;
    pause();
    seek(0);
    if (resume) void play();
  }, { signal: lifetime.signal });
  timeline.addEventListener('input', () => {
    if (!selection) return;
    if (!selection.scrubbing) {
      selection.resumeAfterSeek = selection.playing;
      selection.scrubbing = true;
      pause();
    }
    seek(timeline.value);
  }, { signal: lifetime.signal });
  timeline.addEventListener('change', () => {
    if (!selection) return;
    const resume = selection.resumeAfterSeek;
    selection.scrubbing = false;
    selection.resumeAfterSeek = false;
    seek(timeline.value);
    if (resume) void play();
  }, { signal: lifetime.signal });
  rateSelect.addEventListener('change', () => {
    const requested = Number(rateSelect.value);
    if (!finite(requested) || requested <= 0 || requested > 4) return;
    rate = requested;
    selection?.records.forEach(({ video }) => { video.playbackRate = rate; });
  }, { signal: lifetime.signal });

  for (const group of dynamicGroups) {
    const clip = group.videos.find((video) => video.role === 'arc');
    if (!clip) continue;
    const record = makeVideoCard(clip, group, lifetime.signal, () => {}, true);
    const traceContainer = element('div', 'trace-panel');
    record.card.append(traceContainer);
    record.trace = traceView(traceContainer, traces[group.id]);
    ['seeked', 'pause', 'ended', 'loadedmetadata'].forEach((event) => {
      record.video.addEventListener(event, () => record.trace.update(record.video.currentTime), { signal: lifetime.signal });
    });
    dynamicRecords.push(record);
    dynamicGrid.append(record.card);
    record.trace.update(0);
  }

  function tick() {
    if (disposed || document.hidden) return;
    const current = selection;
    if (current?.playing && !current.scrubbing) {
      const lead = master(current);
      if (!lead) {
        pause();
      } else {
        current.time = clamp(lead.video.currentTime, 0, current.duration);
        for (const record of available(current)) {
          const video = record.video;
          if (current.time >= record.duration - 0.025) {
            video.pause();
            setVideoTime(record, record.duration);
            record.setStatus('Clip ended');
          } else if (record !== lead && !video.seeking && Math.abs(video.currentTime - current.time) > 0.25) {
            setVideoTime(record, current.time);
          }
        }
        current.trace.update(current.time);
        if (lead.video.ended || current.time >= current.duration - 0.025) {
          current.time = current.duration;
          pause();
        }
        updateTransport();
      }
    }
    dynamicRecords.forEach((record) => {
      if (!record.video.paused) record.trace.update(record.video.currentTime);
    });
  }
  const timer = window.setInterval(tick, 1000 / 15);
  const pauseAll = () => {
    pause();
    dynamicRecords.forEach(({ video }) => video.pause());
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAll();
  }, { signal: lifetime.signal });
  window.addEventListener('pagehide', pauseAll, { signal: lifetime.signal });
  if (comparisons.length) {
    selectTask(comparisons[0].id);
  } else {
    grid.append(element('p', 'load-error', 'No comparison videos are available.'));
    transport.hidden = true;
    tracePanel.hidden = true;
  }

  return {
    selectTask,
    pause: pauseAll,
    getState: () => ({ task: selection?.group.id || null, time: selection?.time || 0, duration: selection?.duration || 0, playing: selection?.playing || false, rate }),
    destroy() {
      if (disposed) return;
      pauseAll();
      disposed = true;
      window.clearInterval(timer);
      selection?.controller.abort();
      lifetime.abort();
    },
  };
}
