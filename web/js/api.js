// Thin client for the studio JSON API.

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('เชื่อมต่อสตูดิโอไม่ได้ ตรวจว่าเซิร์ฟเวอร์ยังเปิดอยู่ (npm run studio)');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `คำขอไม่สำเร็จ (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

let presetsPromise = null;

export const api = {
  presets: () => (presetsPromise ??= request('GET', '/api/presets').catch((e) => ((presetsPromise = null), Promise.reject(e)))),
  createJob: (input) => request('POST', '/api/jobs', input),
  job: (id) => request('GET', `/api/jobs/${encodeURIComponent(id)}`),
  jobs: () => request('GET', '/api/jobs'),
  projects: () => request('GET', '/api/projects'),
  project: (id) => request('GET', `/api/projects/${encodeURIComponent(id)}`),
  saveProject: (id, edits) => request('PUT', `/api/projects/${encodeURIComponent(id)}`, edits),
  deleteProject: (id) => request('DELETE', `/api/projects/${encodeURIComponent(id)}`),
  render: (id, opts = {}) => request('POST', `/api/projects/${encodeURIComponent(id)}/render`, opts),
  redraw: (id, sceneId, opts = {}) => request('POST', `/api/projects/${encodeURIComponent(id)}/scenes/${encodeURIComponent(sceneId)}/redraw`, opts),
  settings: () => request('GET', '/api/settings'),
  saveSettings: (changes) => request('PUT', '/api/settings', changes).then((r) => ((presetsPromise = null), r)),
  nextEpisode: (id, opts = {}) => request('POST', `/api/projects/${encodeURIComponent(id)}/next-episode`, opts),
};

/** URL of a file inside a project dir. `rel` comes from the storyboard, so encode every segment. */
export function mediaUrl(projectId, rel, version, download = false) {
  if (!projectId || typeof rel !== 'string' || !rel) return '';
  const path = rel
    .replace(/\\/g, '/')
    .split('/')
    .filter((s) => s && s !== '.' && s !== '..')
    .map(encodeURIComponent)
    .join('/');
  const qs = [version ? `v=${encodeURIComponent(version)}` : '', download ? 'download=1' : ''].filter(Boolean).join('&');
  return `/media/${encodeURIComponent(projectId)}/${path}${qs ? '?' + qs : ''}`;
}

/**
 * Follow a job's Server-Sent Events. History is replayed on connect, so handlers must be idempotent.
 * Returns stop().
 */
export function followJob(jobId, { onEvent, onLost }) {
  let closed = false;
  const es = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/events`);
  const stop = () => {
    closed = true;
    es.close();
  };
  es.onmessage = (e) => {
    let ev;
    try {
      ev = JSON.parse(e.data);
    } catch {
      return;
    }
    if (ev.stage === 'done' || ev.stage === 'error') stop();
    onEvent(ev);
  };
  es.onerror = () => {
    if (closed) return;
    // EventSource retries by itself; if the job no longer exists the retry fails for good.
    onLost?.(es.readyState === EventSource.CLOSED);
  };
  return stop;
}
