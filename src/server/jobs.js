// In-process job queue: one job runs at a time, every job keeps its event history
// so a reloaded page can re-attach to the Server-Sent Events stream.
import crypto from 'node:crypto';

const MAX_EVENTS = 600;
const MAX_FINISHED = 40;

export class JobQueue {
  constructor({ maxQueued = 20 } = {}) {
    this.jobs = new Map();
    this.pending = [];
    this.running = null;
    this.maxQueued = maxQueued;
  }

  get isFull() {
    return this.pending.length >= this.maxQueued;
  }

  /**
   * @param {{kind:string, title?:string, projectId?:string|null, input?:object}} info
   * @param {(emit:(ev:object)=>void, job:object)=>Promise<void>} run
   */
  add(info, run) {
    const job = {
      id: 'j' + crypto.randomBytes(6).toString('hex'),
      kind: info.kind,
      title: info.title || '',
      projectId: info.projectId || null,
      input: info.input || null,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      message: 'รอคิวอยู่…',
      error: null,
      createdAt: new Date().toISOString(),
      finishedAt: null,
      events: [],
      subscribers: new Set(),
      run,
    };
    this.jobs.set(job.id, job);
    this.pending.push(job);
    this.#emit(job, { stage: 'queued', progress: 0, message: this.running ? 'รอคิวอยู่… งานก่อนหน้ากำลังทำ' : 'กำลังเริ่ม…' });
    queueMicrotask(() => this.#pump());
    return job;
  }

  get(id) {
    return this.jobs.get(id) || null;
  }

  /** Is a queued/running job touching this project? */
  activeFor(projectId) {
    for (const j of this.jobs.values()) {
      if (j.projectId === projectId && (j.status === 'queued' || j.status === 'running')) return j;
    }
    return null;
  }

  list() {
    return [...this.jobs.values()].map((j) => this.snapshot(j)).reverse();
  }

  snapshot(job) {
    return {
      id: job.id,
      kind: job.kind,
      title: job.title,
      projectId: job.projectId,
      input: job.input,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      message: job.message,
      error: job.error,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      queuePosition: job.status === 'queued' ? this.pending.indexOf(job) + 1 : 0,
    };
  }

  /** Subscribe to a job: replays history, then streams live. Returns unsubscribe(). */
  subscribe(job, send, onEnd) {
    for (const ev of job.events) send(ev);
    if (job.status === 'done' || job.status === 'error') {
      onEnd();
      return () => {};
    }
    const sub = { send, onEnd };
    job.subscribers.add(sub);
    return () => job.subscribers.delete(sub);
  }

  #emit(job, ev) {
    const event = {
      stage: String(ev.stage || job.stage),
      progress: Math.max(0, Math.min(1, Number(ev.progress) || 0)),
      message: String(ev.message || ''),
      ...(ev.detail ? { detail: ev.detail } : {}),
      at: Date.now(),
    };
    if (event.stage !== 'error') job.progress = Math.max(event.stage === 'queued' ? 0 : job.progress, event.progress);
    job.stage = event.stage;
    if (event.message) job.message = event.message;
    const sb = event.detail?.storyboard;
    if (sb?.id) job.projectId = sb.id;
    if (sb?.title) job.title = sb.title;
    if (event.detail?.projectId) job.projectId = event.detail.projectId;

    // Collapse chatty progress ticks (same stage, no payload) so history stays small.
    const last = job.events[job.events.length - 1];
    if (last && last.stage === event.stage && !last.detail && !event.detail) job.events[job.events.length - 1] = event;
    else if (job.events.length < MAX_EVENTS) job.events.push(event);
    for (const s of job.subscribers) {
      try {
        s.send(event);
      } catch {
        job.subscribers.delete(s);
      }
    }
  }

  async #pump() {
    if (this.running || this.pending.length === 0) return;
    const job = this.pending.shift();
    this.running = job;
    job.status = 'running';
    const emit = (ev) => {
      // The pipeline reports its own terminal events; the queue owns those.
      if (!ev || ev.stage === 'error' || ev.stage === 'done') {
        if (ev?.detail?.projectId) job.projectId = ev.detail.projectId;
        if (ev?.stage === 'done') job.doneDetail = ev.detail;
        return;
      }
      this.#emit(job, ev);
    };
    try {
      const detail = await job.run(emit, job);
      job.status = 'done';
      this.#emit(job, {
        stage: 'done',
        progress: 1,
        message: 'เสร็จแล้ว! วิดีโอพร้อมดู',
        detail: { ...(job.doneDetail || {}), ...(detail || {}), projectId: job.projectId },
      });
    } catch (err) {
      job.status = 'error';
      job.error = friendlyError(err);
      this.#emit(job, {
        stage: 'error',
        progress: job.progress,
        message: job.error,
        detail: { projectId: job.projectId, failedStage: job.stage, raw: String(err?.message || err).slice(0, 600) },
      });
    } finally {
      job.finishedAt = new Date().toISOString();
      job.run = null;
      for (const s of job.subscribers) s.onEnd();
      job.subscribers.clear();
      this.running = null;
      this.#trim();
      queueMicrotask(() => this.#pump());
    }
  }

  #trim() {
    const finished = [...this.jobs.values()].filter((j) => j.status === 'done' || j.status === 'error');
    for (const j of finished.slice(0, Math.max(0, finished.length - MAX_FINISHED))) this.jobs.delete(j.id);
  }

  /** Resolve once nothing is queued or running (used on shutdown/tests). */
  async idle() {
    while (this.running || this.pending.length) await new Promise((r) => setTimeout(r, 25));
  }
}

/** Turn internal errors into a short Thai message the UI can show as-is. */
export function friendlyError(err) {
  const raw = String(err?.message || err || '');
  if (err?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find (module|package)/i.test(raw)) {
    if (/render/i.test(raw)) return 'ยังไม่พบตัวตัดต่อวิดีโอ (src/render) บทและภาพถูกบันทึกไว้แล้ว เปิดดูสตอรี่บอร์ดแล้วสั่งเรนเดอร์ใหม่ได้ภายหลัง';
    if (/engine/i.test(raw)) return 'ยังไม่พบเอนจิน Claude (src/engine) ลองเปิด “โหมดทดลอง” ในตั้งค่าเพิ่มเติมเพื่อดูขั้นตอนทั้งหมดก่อน';
    return 'ระบบยังติดตั้งไม่ครบ: ' + raw.slice(0, 200);
  }
  if (/ENOSPC/.test(raw)) return 'พื้นที่ดิสก์เต็ม ลบวิดีโอเก่าในคลังแล้วลองใหม่';
  if (/Invalid storyboard/i.test(raw)) return 'บทที่ได้ยังไม่สมบูรณ์ ลองสร้างใหม่อีกครั้ง (' + raw.slice(0, 160) + ')';
  return raw.slice(0, 400) || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
}
