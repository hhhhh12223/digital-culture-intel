/* ============================================================
   数字文娱智库 — 协作共享后端（零依赖，仅 Node 内置模块）
   功能：
     1. 静态文件服务（托管整站）
     2. 用户登记 API：ID 总数上限 10，持久化到 users.json
     3. 在线心跳：以 lastSeen 5 分钟内判定“在线”
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 9123;
const LIMIT = 10;                 // 总 ID 上限
const ONLINE_MS = 5 * 60 * 1000;  // 5 分钟内算在线
const USERS_FILE = path.join(ROOT, 'users.json');

/* ---------- 用户存储（文件持久化）---------- */
function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}
let USERS = loadUsers();

function stamp() { return new Date().toISOString(); }

function publicUser(u) {
  const last = new Date(u.lastSeen).getTime();
  const online = !isNaN(last) && (Date.now() - last) <= ONLINE_MS;
  return {
    id: u.id,
    name: u.name,
    createdAt: u.createdAt,
    lastSeen: u.lastSeen,
    online,
  };
}
function stateView() {
  const list = USERS.map(publicUser);
  const online = list.filter(u => u.online).length;
  return { limit: LIMIT, count: USERS.length, online, users: list };
}

/* ---------- 工具 ---------- */
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { resolve({}); }
    });
  });
}
const ID_RE = /^[一-龥a-zA-Z0-9_]{2,20}$/;
function sanitizeId(s) {
  return String(s || '').trim().replace(/\s+/g, '_');
}

/* ---------- 静态文件 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ---------- API 路由 ---------- */
async function handleApi(req, res, pathname) {
  // 查询状态
  if (pathname === '/api/state' && req.method === 'GET') {
    return sendJSON(res, 200, stateView());
  }
  // 加入 / 登记
  if (pathname === '/api/join' && req.method === 'POST') {
    const body = await readBody(req);
    let id = sanitizeId(body.id);
    const name = sanitizeId(body.name) || id;
    if (!ID_RE.test(id)) {
      return sendJSON(res, 400, { error: 'ID_INVALID', msg: 'ID 需为 2-20 位中英文/数字/下划线' });
    }
    const exist = USERS.find(u => u.id.toLowerCase() === id.toLowerCase());
    if (exist) {
      exist.lastSeen = stamp();
      exist.name = name || exist.name;
      saveUsers(USERS);
      return sendJSON(res, 200, { ok: true, resumed: true, user: publicUser(exist), state: stateView() });
    }
    if (USERS.length >= LIMIT) {
      return sendJSON(res, 409, { error: 'LIMIT', msg: `ID 已达上限 ${LIMIT} 个`, state: stateView() });
    }
    const u = { id, name, createdAt: stamp(), lastSeen: stamp() };
    USERS.push(u);
    saveUsers(USERS);
    return sendJSON(res, 200, { ok: true, user: publicUser(u), state: stateView() });
  }
  // 心跳
  if (pathname === '/api/heartbeat' && req.method === 'POST') {
    const body = await readBody(req);
    const id = sanitizeId(body.id);
    const u = USERS.find(x => x.id.toLowerCase() === id.toLowerCase());
    if (u) { u.lastSeen = stamp(); saveUsers(USERS); }
    return sendJSON(res, 200, stateView());
  }
  // 退出（置为离线）
  if (pathname === '/api/leave' && req.method === 'POST') {
    const body = await readBody(req);
    const id = sanitizeId(body.id);
    const u = USERS.find(x => x.id.toLowerCase() === id.toLowerCase());
    if (u) { u.lastSeen = new Date(0).toISOString(); saveUsers(USERS); }
    return sendJSON(res, 200, stateView());
  }
  return sendJSON(res, 404, { error: 'NOT_FOUND' });
}

/* ---------- 启动 ---------- */
const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const pathname = url.split('?')[0];
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch(e => sendJSON(res, 500, { error: 'SERVER', msg: String(e) }));
  } else {
    serveStatic(req, res, url);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[协作后端] 监听 http://0.0.0.0:${PORT}  | ID 上限 ${LIMIT}  | 当前已登记 ${USERS.length}`);
});
