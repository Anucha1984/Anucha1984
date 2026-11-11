// Static file helpers for the studio server: safe path resolution + HTTP Range streaming.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.srt': 'application/x-subrip; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

/** A path segment we are willing to join onto a directory. */
export function isSafeSegment(seg) {
  return (
    typeof seg === 'string' &&
    seg.length > 0 &&
    seg.length <= 120 &&
    seg !== '.' &&
    seg !== '..' &&
    !seg.startsWith('.') &&
    !/[\\/\0:]/.test(seg) &&
    !/[\u0000-\u001f]/.test(seg)
  );
}

/**
 * Resolve `segments` under `root`. Returns the absolute path, or null when the
 * path is unsafe, escapes the root (also via symlinks) or is not a regular file.
 */
export async function resolveInside(root, segments) {
  if (!segments.length || !segments.every(isSafeSegment)) return null;
  const base = path.resolve(root);
  const file = path.resolve(base, ...segments);
  if (!file.startsWith(base + path.sep)) return null;
  try {
    const [realBase, realFile] = await Promise.all([fsp.realpath(base), fsp.realpath(file)]);
    if (!realFile.startsWith(realBase + path.sep)) return null;
    const st = await fsp.stat(realFile);
    if (!st.isFile()) return null;
    return { file: realFile, stat: st };
  } catch {
    return null;
  }
}

/** Stream a file with ETag + single-range support. */
export function sendFile(req, res, { file, stat }, extraHeaders = {}) {
  const ext = path.extname(file).toLowerCase();
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Last-Modified': stat.mtime.toUTCString(),
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache',
    ...extraHeaders,
  };
  if (req.headers['if-none-match'] === etag && !req.headers.range) {
    res.writeHead(304, headers);
    return res.end();
  }
  let start = 0;
  let end = stat.size - 1;
  let status = 200;
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
    let ok = Boolean(m) && (m[1] !== '' || m[2] !== '');
    if (ok) {
      if (m[1] === '') {
        const n = Number(m[2]); // suffix range: last N bytes
        if (n <= 0) ok = false;
        start = Math.max(0, stat.size - n);
      } else {
        start = Number(m[1]);
        if (m[2] !== '') end = Math.min(Number(m[2]), stat.size - 1);
      }
      if (start > end || start >= stat.size) ok = false;
    }
    if (!ok) {
      res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}`, 'Content-Length': 0 });
      return res.end();
    }
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
  }
  headers['Content-Length'] = stat.size === 0 ? 0 : end - start + 1;
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || stat.size === 0) return res.end();
  const stream = fs.createReadStream(file, { start, end });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
