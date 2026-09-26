import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.pdf':'application/pdf','.woff':'font/woff','.txt':'text/plain; charset=utf-8'};

const server = http.createServer(async (req, res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405, {'Allow':'GET, HEAD'}).end();return;}
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {res.writeHead(403).end();return;}
    let info = await stat(file);
    if (info.isDirectory()) {file = path.join(file, 'index.html');info = await stat(file);}
    if (!info.isFile()) {res.writeHead(404).end();return;}
    const mime = types[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = {'Content-Type':mime,'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'};
    let start = 0; let end = info.size - 1; let status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) {res.writeHead(416, {'Content-Range':`bytes */${info.size}`}).end();return;}
      if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
      else {start = Number(match[1]);if (match[2]) end = Math.min(end, Number(match[2]));}
      if (start > end || start >= info.size) {res.writeHead(416, {'Content-Range':`bytes */${info.size}`}).end();return;}
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    res.writeHead(status, headers);
    if (req.method === 'HEAD') {res.end();return;}
    const stream = createReadStream(file, {start,end});
    stream.on('error', () => res.destroy()); req.on('close', () => stream.destroy()); stream.pipe(res);
  } catch (error) {
    if (!res.headersSent) res.writeHead(error.code === 'ENOENT' ? 404 : 400, {'Content-Type':'text/plain'});
    res.end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`ARC website: http://127.0.0.1:${port}`));
