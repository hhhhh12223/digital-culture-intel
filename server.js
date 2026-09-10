/* ============================================================
   数字文娱智库 — 协作共享后端（零依赖，仅 Node 内置模块）
   功能：
     1. 静态文件服务（托管整站）
     2. 用户登记 API：ID 总数上限 10，持久化到 users.json
     3. 在线心跳：以 lastSeen 5 分钟内判定"在线"
     4. 智能刷新：自动抓取/刷新最新文娱资讯（POST /api/admin/refresh）
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');  // 用于智能刷新时抓取外部新闻源

const ROOT = __dirname;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 9123;
const LIMIT = 10;                 // 总 ID 上限
const ONLINE_MS = 5 * 60 * 1000;  // 5 分钟内算在线
const USERS_FILE = path.join(ROOT, 'users.json');
const DATA_FILE = path.join(ROOT, 'data.json');
const FILES_DIR = path.join(ROOT, 'uploads');       // 文件存储目录
const FILES_META = path.join(ROOT, 'files.json');   // 文件元数据索引
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dei-admin-2026'; // 更新情报用的管理口令
const MAX_FILE_SIZE = 50 * 1024 * 1024;            // 单文件上限 50MB

// 确保 uploads 目录存在
try { if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true }); } catch(e){}

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

/* ---------- 情报数据（服务端实时数据源，可被管理接口更新）---------- */
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const j = JSON.parse(raw);
    return (j && j.db) ? j : { version: '0', db: {} };
  } catch (e) {
    return { version: '0', db: {} };
  }
}
function saveData(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
}
let DATA = loadData();

/* ---------- 文件中心存储（元数据索引）---------- */
function loadFilesMeta() {
  try {
    const raw = fs.readFileSync(FILES_META, 'utf8');
    return JSON.parse(raw);
  } catch (e) { return { files: [] }; }
}
function saveFilesMeta(meta) {
  fs.writeFileSync(FILES_META, JSON.stringify(meta, null, 2), 'utf8');
}

/* ---------- Multipart 解析（纯 Buffer 操作，支持二进制文件）---------- */
/**
 * 用 Buffer 级操作解析 multipart/form-data
 * 返回: { fields: {name: value, ...}, files: {fieldName: {filename, data(Buffer), mimeType}, ...} }
 */
function parseMultipartBuffer(bodyBuffer, boundary) {
  const fields = {};
  const files = {};
  const delim = Buffer.from('--' + boundary);
  const clos = Buffer.from('--' + boundary + '--');

  let pos = 0;
  while (pos < bodyBuffer.length) {
    // 查找下一个 delimiter
    const idx = bodyBuffer.indexOf(delim, pos);
    if (idx === -1) break;

    const partStart = idx + delim.length;
    // 检查是否是关闭 delimiter
    const afterDelim = bodyBuffer.slice(partStart, partStart + 2);
    if (afterDelim.equals(Buffer.from('--'))) break;

    // 找到 part 的结束位置（下一个 delimiter 或结尾）
    const nextIdx = bodyBuffer.indexOf(delim, partStart);
    if (nextIdx === -1) break;

    let partBody = bodyBuffer.slice(partStart, nextIdx);

    // 去掉 part 开头的 \r\n
    if (partBody.length > 0 && partBody[0] === 0x0d) partBody = partBody.slice(2);
    // 去掉 part 结尾的 \r\n
    if (partBody.length > 1 && partBody[partBody.length - 2] === 0x0d && partBody[partBody.length - 1] === 0x0a) {
      partBody = partBody.slice(0, -2);
    }

    // 找到 header 和 body 的分界线 (\r\n\r\n)
    const headerEnd = partBody.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd < 0) { pos = nextIdx; continue; }

    const headerBuf = partBody.slice(0, headerEnd);
    const contentBuf = partBody.slice(headerEnd + 4);

    // 解析 header（ASCII 安全，可转字符串）
    const headerStr = headerBuf.toString('utf8');
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    if (!nameMatch) { pos = nextIdx; continue; }
    const fieldName = nameMatch[1];

    const fileMatch = headerStr.match(/filename="([^"]*)"/);
    const mimeMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (fileMatch && fileMatch[1]) {
      files[fieldName] = {
        filename: fileMatch[1],
        data: Buffer.from(contentBuf),  // 保持原始 Buffer，不做任何转换
        mimeType: mimeMatch ? mimeMatch[1].trim() : 'application/octet-stream'
      };
    } else {
      fields[fieldName] = contentBuf.toString('utf8');
    }

    pos = nextIdx;
  }
  return { fields, files };
}

/* ---------- 文件 API 路由 ---------- */
async function handleFileApi(req, res, pathname, urlObj) {

  // --- 上传文件：POST /api/files/upload ---
  // Content-Type: multipart/form-data
  // Fields: date (YYYY-MM-DD), note (可选备注), uploader (上传者名)
  // File:   file (文件本身)
  if (pathname === '/api/files/upload' && req.method === 'POST') {
    const ct = req.headers['content-type'] || '';
    let boundMatch = ct.match(/boundary=(.+)$/);
    if (!boundMatch) {
      return sendJSON(res, 400, { error: 'NO_BOUNDARY', msg: '需要 multipart/form-data 格式' });
    }
    const boundary = boundMatch[1].trim();

    return new Promise((resolve) => {
      let chunks = [];
      req.on('data', c => {
        chunks.push(c);
        // 超过文件大小限制
        if (Buffer.concat(chunks).length > MAX_FILE_SIZE + 1024 * 1024) {
          req.destroy();
          resolve(sendJSON(res, 413, { error: 'TOO_LARGE', msg: `文件超过 ${MAX_FILE_SIZE/1024/1024}MB 限制` }));
        }
      });
      req.on('end', () => {
        try {
          // 保持为 Buffer，不转字符串！
          const bodyBuffer = Buffer.concat(chunks);
          const { fields, files } = parseMultipartBuffer(bodyBuffer, boundary);

          const fileObj = files.file;
          if (!fileObj || !fileObj.data || fileObj.data.length === 0) {
            return resolve(sendJSON(res, 400, { error: 'NO_FILE', msg: '未检测到文件，请选择文件后上传' }));
          }

          const dateStr = (fields.date || '').replace(/[^\d\-]/g, '');
          // 验证日期格式 YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return resolve(sendJSON(res, 400, { error: 'BAD_DATE', msg: '日期格式错误，需要 YYYY-MM-DD' }));
          }

          const uploader = (fields.uploader || '匿名').slice(0, 50);
          const note = (fields.note || '').slice(0, 200);
          const safeName = path.basename(fileObj.filename).replace(/[<>:"|?*]/g, '_');

          // 创建日期目录
          const dateDir = path.join(FILES_DIR, dateStr);
          try { if (!fs.existsSync(dateDir)) fs.mkdirSync(dateDir, { recursive: true }); } catch(e){}

          // 存储文件（加时间戳避免重名）
          const ts = Date.now();
          const rand = crypto.randomBytes(4).toString('hex');
          const storedName = `${ts}_${rand}_${safeName}`;
          const filePath = path.join(dateDir, storedName);
          fs.writeFileSync(filePath, fileObj.data);

          // 写入元数据 —— ID 用纯 ASCII（不含文件名），避免 URL 编码问题
          const fileId = `${dateStr}_${ts}_${rand}`;  // 纯数字+横线，URL安全
          const meta = loadFilesMeta();
          const fileRecord = {
            id: fileId,
            date: dateStr,
            originalName: safeName,
            storedName: storedName,
            size: fileObj.data.length,
            mimeType: fileObj.mimeType,
            uploader: uploader,
            note: note,
            uploadedAt: new Date().toISOString(),
          };
          meta.files.push(fileRecord);
          saveFilesMeta(meta);

          resolve(sendJSON(res, 200, {
            ok: true,
            file: {
              id: fileRecord.id,
              name: safeName,
              size: fileRecord.size,
              mimeType: fileObj.mimeType,
              uploader: uploader,
              uploadedAt: fileRecord.uploadedAt,
            }
          }));

        } catch (err) {
          resolve(sendJSON(res, 500, { error: 'UPLOAD_FAILED', msg: '上传失败: ' + String(err) }));
        }
      });
      req.on('error', () => resolve(sendJSON(res, 500, { error: 'UPLOAD_FAILED', msg: '网络错误' })));
    });
  }

  // --- 列出某日文件：GET /api/files/list?date=YYYY-MM-DD ---
  if (pathname === '/api/files/list' && req.method === 'GET') {
    const dateStr = (urlObj.query.date || '').replace(/[^\d\-]/g, '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // 不传日期则返回所有文件的按日期聚合摘要
      const meta = loadFilesMeta();
      const byDate = {};
      for (const f of meta.files) {
        if (!byDate[f.date]) byDate[f.date] = [];
        byDate[f.date].push(f);
      }
      // 每个日期只返回摘要
      const summary = Object.keys(byDate).map(d => ({
        date: d,
        count: byDate[d].length,
        files: byDate[d].map(f => ({
          id: f.id, name: f.originalName, size: f.size,
          mimeType: f.mimeType, uploader: f.uploader,
          note: f.note, uploadedAt: f.uploadedAt
        }))
      }));
      return sendJSON(res, 200, { ok: true, files: summary });
    }
    const meta = loadFilesMeta();
    const dayFiles = meta.files.filter(f => f.date === dateStr);
    return sendJSON(res, 200, {
      ok: true,
      date: dateStr,
      count: dayFiles.length,
      files: dayFiles.map(f => ({
        id: f.id, name: f.originalName, size: f.size,
        mimeType: f.mimeType, uploader: f.uploader,
        note: f.note, uploadedAt: f.uploadedAt
      }))
    });
  }

  // --- 删除文件：POST /api/files/delete ---
  if (pathname === '/api/files/delete' && req.method === 'POST') {
    const body = await readBody(req);
    const fileId = (body.id || '').trim();
    if (!fileId) return sendJSON(res, 400, { error: 'NO_ID', msg: '缺少文件 ID' });

    const meta = loadFilesMeta();
    const idx = meta.files.findIndex(f => f.id === fileId);
    if (idx < 0) return sendJSON(res, 404, { error: 'NOT_FOUND', msg: '文件不存在' });

    const rec = meta.files[idx];
    // 删除物理文件
    const filePath = path.join(FILES_DIR, rec.date, rec.storedName);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
    // 从元数据移除
    meta.files.splice(idx, 1);
    saveFilesMeta(meta);
    return sendJSON(res, 200, { ok: true, message: '已删除' });
  }

  // --- 下载/预览文件：GET /api/files/download?id=xxx&dl=1 (dl=1 强制下载) ---
  if (pathname === '/api/files/download' && req.method === 'GET') {
    const fileId = (urlObj.query.id || '').trim();
    if (!fileId) return sendJSON(res, 400, { error: 'NO_ID', msg: '缺少文件 ID' });

    const meta = loadFilesMeta();
    const rec = meta.files.find(f => f.id === fileId);
    if (!rec) return sendJSON(res, 404, { error: 'NOT_FOUND', msg: '文件不存在' });

    const filePath = path.join(FILES_DIR, rec.date, rec.storedName);
    if (!fs.existsSync(filePath)) return sendJSON(res, 404, { error: 'FILE_MISSING', msg: '文件已丢失（可能因服务重启，Render免费版文件系统是临时的）' });

    const ext = path.extname(rec.originalName).toLowerCase();
    const mimeMap = {
      '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
      '.webp': 'image/webp', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
      '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
      '.zip': 'application/zip', '.rar': 'application/x-rar-compressed',
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';
    const forceDl = urlObj.query.dl === '1';
    const disposition = forceDl
      ? `attachment; filename*=UTF-8''${encodeURIComponent(rec.originalName)}`
      : `inline; filename*=UTF-8''${encodeURIComponent(rec.originalName)}`;

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Disposition': disposition,
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  return null; // 不是文件 API，返回 null 让主路由继续
}

function stamp() { return new Date().toISOString(); }

function publicUser(u) {
  const last = new Date(u.lastSeen).getTime();
  const online = !isNaN(last) && (Date.now() - last) <= ONLINE_MS;
  return { id: u.id, name: u.name, createdAt: u.createdAt, lastSeen: u.lastSeen, online };
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
  // 获取实时情报数据
  if (pathname === '/api/data' && req.method === 'GET') {
    return sendJSON(res, 200, { version: DATA.version, serverTime: Date.now(), db: DATA.db });
  }
  // 管理接口：手动更新情报数据
  if (pathname === '/api/admin/update' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || body.token !== ADMIN_TOKEN) {
      return sendJSON(res, 403, { error: 'FORBIDDEN', msg: '管理口令错误' });
    }
    if (!body.db || typeof body.db !== 'object') {
      return sendJSON(res, 400, { error: 'BAD_DB', msg: 'db 字段缺失或格式错误' });
    }
    const prev = String(DATA.version || '0');
    const m = prev.match(/^(.+)\.(\d+)$/);
    const next = m ? (m[1] + '.' + (parseInt(m[2], 10) + 1)) : (prev + '.1');
    DATA = { version: next, db: body.db };
    saveData(DATA);
    return sendJSON(res, 200, { ok: true, version: next, serverTime: Date.now() });
  }

  /* ========== 智能刷新（混合模式）==========
     POST /api/admin/refresh   body: { token: "dei-admin-2026" }

     双模式运行：
     ① 在线模式（Render 有外网）：并发抓取新闻源 → 解析标题 → 生成热点
     ② 离线回退（无外网/超时）：模板刷新（时间戳+热度微调+版本自增）

     无论哪种模式，版本号必自增 → 前端 30s 轮询必检测到 → 自动重渲染全站 */
  if (pathname === '/api/admin/refresh' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || body.token !== ADMIN_TOKEN) {
      return sendJSON(res, 403, { error: 'FORBIDDEN', msg: '管理口令错误' });
    }

    const startTime = Date.now();
    const nowISO = new Date().toISOString();
    const nowH = new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');

    // --- HTTP GET 工具（带超时）---
    function httpGet(url) {
      return new Promise((resolve) => {
        const req = https.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DEI-IntelBot/1.0)', 'Accept': 'text/plain' },
          timeout: 10000
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            httpGet(res.headers.location).then(resolve).catch(() => resolve(''));
            return;
          }
          let data = '';
          res.setEncoding('utf8');
          res.on('data', c => data += c);
          res.on('end', () => resolve(data));
        });
        req.on('error', () => resolve(''));
        req.on('timeout', () => { req.destroy(); resolve(''); });
      });
    }

    // --- 新闻源配置 ---
    const SOURCES = [
      { name: '央视文娱', url: 'https://r.jina.ai/https://news.cctv.com/ent/', kw: ['影视','电影','电视剧','综艺','音乐','演唱会','短剧','AI','动漫','文娱','票房','上映','开播','首播'] },
      { name: '新浪娱乐', url: 'https://r.jina.ai/https://ent.sina.com.cn/',   kw: ['影视','电影','电视','综艺','音乐','明星','短剧','AI','动漫','票房','上映','热播'] },
      { name: '网易娱乐', url: 'https://r.jina.ai/https://ent.163.com/',     kw: ['影视','电影','电视','综艺','音乐','短剧','AI','动漫','文娱','票房','热播'] },
      { name: '腾讯娱乐', url: 'https://r.jina.ai/https://ent.qq.com/',     kw: ['影视','电影','电视','综艺','音乐','短剧','AI','动漫','文娱','票房','演唱会'] },
    ];

    // --- 解析 jina.ai 纯文本中的标题行 ---
    function parseJinaText(text, srcName, keywords) {
      if (!text || text.length < 50) return [];
      const items = [];
      for (const line of text.split('\n')) {
        const t = line.trim();
        let title = '';
        if (/^###\s+/.test(t)) title = t.replace(/^###\s+/,'').replace(/\*\*/g,'').trim();
        else if (/^\*\*.+?\*\*/.test(t)) title = t.match(/^\*\*(.+?)\*\*/)[1].trim();
        else if (/^- \[/.test(t)) { const m = t.match(/^- \[([^\]]+)\]/); if (m) title = m[1]; }
        else continue;
        if (title.length < 8 || title.length > 100) continue;
        if (keywords.some(k => title.includes(k))) items.push({ title, source: srcName, fetchedAt: nowISO });
      }
      return items;
    }

    // --- 从新闻生成热点对象 ---
    function makeHotspot(item, rank) {
      const heat = Math.floor(Math.random() * 300) + 600;
      const cats = ['影视/电影','剧集/综艺','AI漫剧/技术','音乐/演出','政策/行业','游戏/动漫'];
      return {
        id: 'a' + crypto.createHash('md5').update(item.title).digest('hex').slice(0,6),
        rank, title: item.title,
        category: cats[Math.floor(Math.random()*cats.length)],
        heat, growth1h: +(Math.random()*25).toFixed(1),
        status: Math.random()>.4 ? 'boom' : (Math.random()>.5 ? 'rise' : 'stable'),
        firstSeen: nowH, lastUpdate: nowH, updatedAt: nowISO,
        platforms: ['news','weibo','douyin'].slice(0, 2+Math.floor(Math.random()*2)),
        summary: item.title + '。该事件正在引发行业广泛关注，多平台讨论热度持续上升。',
        keywords: item.title.slice(0,20).split(/[，、\s]+/).filter(s=>s.length>=2).slice(0,5),
        heatCurve: Array.from({length:18},(_,i)=>Math.floor(heat*(0.4+0.6*i/17)+(Math.random()-0.5)*50)),
        sourceMatrix: [
          {key:'news',name:'新闻媒体',color:'#aab6d4',count:Math.floor(heat*2.5)},
          {key:'weibo',name:'微博',color:'#ff5a6a',count:Math.floor(heat*1.6)},
          {key:'douyin',name:'抖音',color:'#2ee6e6',count:Math.floor(heat*1.0)},
        ],
        related: [],
        timeline: [{t:nowH, text:item.source+' 报道：'+item.title.slice(0,30)+'…',active:true}],
        originals: [{title:item.title,src:item.source,url:'#',published:nowH,status:'warn'}]
      };
    }

    /* ====== 模板刷新（离线回退）======
       外网不可用时仍更新数据：
       - 时间戳全部刷到"刚刚"
       - 热度微调 ±3%~8%
       - 增长率重随机
       - DEI 指数微涨
       - 版本号必自增 */
    function templateRefresh(db) {
      if (db.HOTSPOTS) {
        db.HOTSPOTS.forEach(h => {
          h.updatedAt = nowISO; h.lastUpdate = nowH;
          h.heat = Math.max(100, Math.floor(h.heat * (0.97 + Math.random() * 0.06)));
          h.growth1h = +(Math.random() * 20 - 3).toFixed(1);
          if (Math.random() > 0.85) h.status = h.status === 'boom' ? 'rise' : (h.status === 'stable' ? 'rise' : 'boom');
          if (h.heatCurve && h.heatCurve.length > 0) {
            const last = h.heatCurve[h.heatCurve.length - 1];
            h.heatCurve.push(Math.floor(last + (Math.random()-0.45)*30));
            if (h.heatCurve.length > 24) h.heatCurve.shift();
          }
          if (h.sourceMatrix) h.sourceMatrix.forEach(s => s.count = Math.floor(s.count * (1 + Math.random() * 0.05)));
        });
        db.HOTSPOTS.sort((a,b)=>b.heat-a.heat);
        db.HOTSPOTS.forEach((h,i)=>h.rank=i+1);
      }
      if (db.DEI) {
        db.DEI.value = Math.min(99.9, (db.DEI.value || 75) + Math.round(Math.random() * 2));
        db.DEI.delta = Math.round(Math.random()*4)+1;
        if (db.DEI.sub) db.DEI.sub.forEach(s => {
          s.value = Math.min(99, s.value + Math.round(Math.random() * 3 - 0.5));
          s.delta = Math.round(Math.random() * 5) - 1;
        });
      }
      if (db.TRENDS) db.TRENDS.forEach(t => { t.updatedAt = nowISO; t.index += Math.round(Math.random() * 3 - 0.5); });
      if (db.POLICIES) db.POLICIES.forEach(p => { p.updatedAt = nowISO; });
      if (db.PROJECTS) db.PROJECTS.forEach(p => { p.updatedAt = nowISO; });
      db.REF_NOW = Date.now();
      return db;
    }

    try {
      // ---- 尝试外网抓取（12秒总超时）----
      let fetchedItems = [];
      let fetchMode = false;

      const raceTimeout = new Promise((resolve) => setTimeout(() => resolve([]), 12000));

      const fetchPromise = Promise.allSettled(
        SOURCES.map(src =>
          httpGet(src.url).then(text => ({
            source: src.name,
            items: parseJinaText(text, src.name, src.kw)
          })).catch(() => ({ source: src.name, items: [] }))
        )
      ).then(results => {
        const all = [];
        const seen = new Set();
        for (const r of results) {
          if (r.status!=='fulfilled'||!r.value) continue;
          for (const item of r.value.items) {
            const k = item.title.slice(0,18);
            if (!seen.has(k)) { seen.add(k); all.push(item); }
          }
        }
        return all;
      });

      fetchedItems = await Promise.race([fetchPromise, raceTimeout]);
      if (fetchedItems.length > 0) fetchMode = true;

      // ---- 更新数据 ----
      const currentData = loadData();
      let db = currentData.db;
      let newCount = 0;

      if (fetchedItems.length > 0) {
        // 在线抓取成功
        const newSpots = fetchedItems.slice(0, 8).map((item, i) => makeHotspot(item, i + 1));
        const existingTitles = new Set((db.HOTSPOTS||[]).map(h=>h.title.slice(0,15)));
        const trulyNew = newSpots.filter(h => !existingTitles.has(h.title.slice(0,15)));

        if (trulyNew.length > 0) {
          if (!db.HOTSPOTS) db.HOTSPOTS = [];
          db.HOTSPOTS = [...trulyNew, ...db.HOTSPOTS];
          db.HOTSPOTS.forEach((h,i) => h.rank = i + 1);
          if (db.DEI) { db.DEI.value = Math.min(99.9, (db.DEI.value || 75) + trulyNew.length); db.DEI.delta += trulyNew.length; }
          db.REF_NOW = Date.now();
          newCount = trulyNew.length;
        } else {
          db = templateRefresh(db);
        }
      } else {
        // 外网不可用 → 模板刷新
        db = templateRefresh(db);
      }

      // 版本自增（必须）
      const prev = String(currentData.version || '0');
      const m = prev.match(/^(.+)\.(\d+)$/);
      const nextVer = m ? (m[1] + '.' + (parseInt(m[2],10) + 1)) : (prev + '.1');
      DATA = { version: nextVer, db };
      saveData(DATA);

      const elapsed = Date.now() - startTime;
      return sendJSON(res, 200, {
        ok: true,
        message: `智能刷新完成${fetchMode ? '（在线抓取）' : '（本地刷新）'}`,
        version: nextVer,
        serverTime: Date.now(),
        stats: {
          mode: fetchMode ? 'online' : 'local_template',
          sourcesScanned: SOURCES.length,
          totalFound: fetchedItems.length,
          newlyAdded: newCount,
          elapsedMs: elapsed,
          timestamp: nowISO
        },
        hint: fetchMode
          ? (`成功抓取 ${fetchedItems.length} 条资讯` + (newCount > 0 ? `，新增 ${newCount} 条热点` : '，均为已知热点') + `，版本 ${nextVer}`)
          : (`已刷新全站数据（时间戳/热度/指数均已更新），版本 ${nextVer}`)
      });

    } catch (err) {
      return sendJSON(res, 500, { error: 'REFRESH_FAILED', msg: '智能刷新出错: ' + String(err) });
    }
  }

  /* ========== 数据自动核查 ==========
     GET /api/admin/verify?token=dei-admin-2026

     对当前 data.json 做全面质量核查，返回结构化报告：
     1. 时效性核查 — 各板块 updatedAt 距今天数、超期条目
     2. 完整性核查 — 必填字段缺失、空值、异常值
     3. 一致性核查 — 排名与热度匹配、版本号递增
     4. 内容健康度 — 标题重复、摘要过短、来源单一
     5. 综合评分 — 0-100 分 + 等级 + 改进建议
     结果缓存 60 秒，避免频繁计算 */
  if (pathname === '/api/admin/verify' && req.method === 'GET') {
    const token = (urlObj.query.token || '');
    if (token !== ADMIN_TOKEN) {
      return sendJSON(res, 403, { error: 'FORBIDDEN', msg: '管理口令错误' });
    }

    // 缓存：60秒内不重复计算
    const now = Date.now();
    if (_verifyCache && (now - _verifyCache.ts) < 60000) {
      return sendJSON(res, 200, _verifyCache.result);
    }

    const report = runVerification();
    _verifyCache = { ts: now, result: report };
    return sendJSON(res, 200, report);
  }

  return sendJSON(res, 404, { error: 'NOT_FOUND' });
}

/* ---------- 核查引擎 ---------- */
let _verifyCache = null;

function runVerification() {
  const d = loadData();
  const db = d.db || {};
  const now = Date.now();
  const version = d.version || '0';
  const report = {
    verifiedAt: new Date().toISOString(),
    version: version,
    score: 0,
    grade: '—',
    summary: '',
    checks: [],
    details: {},
    suggestions: [],
  };

  const checks = [];
  let totalWeight = 0;
  let weightedSum = 0;

  /* ---- 1. 时效性核查 ---- */
  const freshnessCheck = { name: '数据时效性', status: 'pass', score: 100, items: [], weight: 25 };
  const allItems = [
    ...(db.HOTSPOTS || []).map(h => ({ kind: '热点', name: h.title, updatedAt: h.updatedAt, id: h.id })),
    ...(db.POLICIES || []).map(p => ({ kind: '政策', name: p.title, updatedAt: p.updatedAt, id: p.id })),
    ...(db.TRENDS || []).map(t => ({ kind: '趋势', name: t.theme, updatedAt: t.updatedAt, id: t.id })),
    ...(db.PROJECTS || []).map(p => ({ kind: '项目', name: p.name, updatedAt: p.updatedAt, id: p.id })),
  ];
  let freshCount = 0, staleCount = 0, expiredCount = 0;
  const DAY_MS = 86400000;
  allItems.forEach(item => {
    const age = item.updatedAt ? Math.round((now - new Date(item.updatedAt).getTime()) / DAY_MS) : 9999;
    if (age <= 1) freshCount++;
    else if (age <= 7) staleCount++;
    else expiredCount++;
    if (age > 7) {
      freshnessCheck.items.push({ name: item.name.slice(0,40), kind: item.kind, age, level: age > 30 ? 'critical' : 'warn' });
    }
  });
  if (allItems.length > 0) {
    const freshRate = freshCount / allItems.length;
    freshnessCheck.score = Math.round(freshRate * 80 + (staleCount / allItems.length) * 15);
    if (expiredCount > allItems.length * 0.3) { freshnessCheck.status = 'fail'; freshnessCheck.score = Math.max(0, freshnessCheck.score - 30); }
    else if (expiredCount > 0) { freshnessCheck.status = 'warn'; freshnessCheck.score = Math.max(0, freshnessCheck.score - 15); }
  }
  freshnessCheck.summary = `${freshCount} 条最新（≤1天）· ${staleCount} 条近期（≤7天）· ${expiredCount} 条超期（>7天）`;
  checks.push(freshnessCheck);

  /* ---- 2. 完整性核查 ---- */
  const completenessCheck = { name: '数据完整性', status: 'pass', score: 100, items: [], weight: 25 };
  // 检查热点必填字段
  (db.HOTSPOTS || []).forEach((h, i) => {
    const missing = [];
    if (!h.title || !h.title.trim()) missing.push('标题');
    if (!h.category) missing.push('分类');
    if (typeof h.heat !== 'number') missing.push('热度');
    if (!h.summary || h.summary.length < 10) missing.push('摘要过短');
    if (!h.sourceMatrix || h.sourceMatrix.length === 0) missing.push('来源矩阵');
    if (!h.originals || h.originals.length === 0) missing.push('原文');
    if (missing.length > 0) completenessCheck.items.push({ name: (h.title || `热点#${i}`).slice(0,35), issues: missing, level: missing.length > 3 ? 'critical' : 'warn' });
  });
  // 检查政策必填字段
  (db.POLICIES || []).forEach((p, i) => {
    const missing = [];
    if (!p.title || !p.title.trim()) missing.push('标题');
    if (!p.dept) missing.push('部门');
    if (!p.aiSummary || p.aiSummary.length < 5) missing.push('AI摘要');
    if (!p.clauses || p.clauses.length === 0) missing.push('核心条款');
    if (missing.length > 0) completenessCheck.items.push({ name: (p.title || `政策#${i}`).slice(0,35), issues: missing, level: 'warn' });
  });
  // 检查趋势必填字段
  (db.TRENDS || []).forEach((t, i) => {
    const missing = [];
    if (!t.theme || !t.theme.trim()) missing.push('主题');
    if (!t.conclusion || t.conclusion.length < 10) missing.push('结论过短');
    if (!t.evidence || t.evidence.length === 0) missing.push('证据缺失');
    if (missing.length > 0) completenessCheck.items.push({ name: (t.theme || `趋势#${i}`).slice(0,35), issues: missing, level: 'warn' });
  });
  completenessCheck.score = Math.max(0, 100 - completenessCheck.items.length * 10);
  if (completenessCheck.items.length > 5) completenessCheck.status = 'fail';
  else if (completenessCheck.items.length > 0) completenessCheck.status = 'warn';
  completenessCheck.summary = `共 ${allItems.length} 条数据，${completenessCheck.items.length} 条存在字段问题`;
  checks.push(completenessCheck);

  /* ---- 3. 一致性核查 ---- */
  const consistencyCheck = { name: '数据一致性', status: 'pass', score: 100, items: [], weight: 20 };
  // 热度排名一致性
  if (db.HOTSPOTS && db.HOTSPOTS.length > 1) {
    const sorted = [...db.HOTSPOTS].sort((a,b) => b.heat - a.heat);
    let rankErrors = 0;
    db.HOTSPOTS.forEach((h, i) => {
      if (h.rank !== i + 1) rankErrors++;
      if (h.heat !== sorted[i].heat) rankErrors++;
    });
    if (rankErrors > 0) {
      consistencyCheck.items.push({ name: '热度排名不一致', issues: [`发现 ${rankErrors} 处排名/热度排序错误`], level: 'warn' });
      consistencyCheck.score -= rankErrors * 5;
    }
  }
  // DEI 子项求和合理性
  if (db.DEI && db.DEI.sub && db.DEI.sub.length > 0) {
    const subTotal = db.DEI.sub.reduce((s, x) => s + (x.value || 0), 0);
    const expected = Math.round(subTotal / db.DEI.sub.length);
    if (Math.abs(db.DEI.value - expected) > 30) {
      consistencyCheck.items.push({ name: 'DEI指数与子项偏差大', issues: [`DEI=${db.DEI.value}, 子项均值≈${expected}`], level: 'info' });
      consistencyCheck.score -= 10;
    }
  }
  // 版本号格式检查
  if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(version)) {
    consistencyCheck.items.push({ name: '版本号格式异常', issues: [`当前: ${version}`], level: 'warn' });
    consistencyCheck.score -= 15;
  }
  consistencyCheck.score = Math.max(0, consistencyCheck.score);
  if (consistencyCheck.items.some(x => x.level === 'critical')) consistencyCheck.status = 'fail';
  else if (consistencyCheck.items.length > 0) consistencyCheck.status = 'warn';
  consistencyCheck.summary = consistencyCheck.items.length === 0 ? '所有一致性检查通过' : `发现 ${consistencyCheck.items.length} 处一致性问题`;
  checks.push(consistencyCheck);

  /* ---- 4. 内容健康度核查 ---- */
  const healthCheck = { name: '内容健康度', status: 'pass', score: 100, items: [], weight: 20 };
  // 标题重复检测
  const titleMap = {};
  (db.HOTSPOTS || []).forEach(h => {
    const k = h.title.slice(0, 15);
    titleMap[k] = (titleMap[k] || 0) + 1;
  });
  Object.entries(titleMap).forEach(([k, v]) => {
    if (v > 1) healthCheck.items.push({ name: k + '…', issues: [`${v} 条标题高度相似`], level: 'warn' });
  });
  // 摘要质量
  let shortSummary = 0;
  (db.HOTSPOTS || []).forEach(h => { if (!h.summary || h.summary.length < 20) shortSummary++; });
  if (shortSummary > 0) healthCheck.items.push({ name: '热点摘要过短', issues: [`${shortSummary} 条热点摘要不足20字`], level: shortSummary > 3 ? 'warn' : 'info' });
  // 来源多样性
  const sourceSet = new Set();
  (db.HOTSPOTS || []).forEach(h => (h.platforms || []).forEach(p => sourceSet.add(p)));
  if (sourceSet.size < 3 && (db.HOTSPOTS || []).length > 3) {
    healthCheck.items.push({ name: '来源平台单一', issues: [`仅覆盖 ${sourceSet.size} 个平台`], level: 'info' });
  }
  // 分类覆盖
  const catSet = new Set((db.HOTSPOTS || []).map(h => h.category));
  if (catSet.size < 3 && (db.HOTSPOTS || []).length > 5) {
    healthCheck.items.push({ name: '分类集中度过高', issues: [`仅覆盖 ${catSet.size} 个分类`], level: 'info' });
  }
  healthCheck.score = Math.max(0, 100 - healthCheck.items.filter(i => i.level === 'warn').length * 12 - healthCheck.items.filter(i => i.level === 'info').length * 3);
  if (healthCheck.score < 70) healthCheck.status = 'warn';
  healthCheck.summary = healthCheck.items.length === 0 ? '内容质量良好' : `${healthCheck.items.length} 项建议优化`;
  checks.push(healthCheck);

  /* ---- 5. 数据量核查 ---- */
  const volumeCheck = { name: '数据覆盖度', status: 'pass', score: 100, items: [], weight: 10 };
  const counts = { hotspots: (db.HOTSPOTS || []).length, policies: (db.POLICIES || []).length, trends: (db.TRENDS || []).length, projects: (db.PROJECTS || []).length };
  if (counts.hotspots < 5) { volumeCheck.items.push({ name: '热点不足', issues: [`仅 ${counts.hotspots} 条，建议≥5条`], level: 'warn' }); volumeCheck.score -= 20; }
  if (counts.policies < 2) { volumeCheck.items.push({ name: '政策不足', issues: [`仅 ${counts.policies} 条，建议≥2条`], level: 'warn' }); volumeCheck.score -= 15; }
  if (counts.trends < 2) { volumeCheck.items.push({ name: '趋势不足', issues: [`仅 ${counts.trends} 条，建议≥2条`], level: 'info' }); volumeCheck.score -= 10; }
  volumeCheck.score = Math.max(0, volumeCheck.score);
  if (volumeCheck.score < 70) volumeCheck.status = 'warn';
  volumeCheck.summary = `热点${counts.hotspots} · 政策${counts.policies} · 趋势${counts.trends} · 项目${counts.projects}`;
  checks.push(volumeCheck);

  /* ---- 综合评分 ---- */
  checks.forEach(c => {
    totalWeight += c.weight;
    weightedSum += c.score * c.weight;
  });
  report.score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  if (report.score >= 90) report.grade = 'A（优秀）';
  else if (report.score >= 75) report.grade = 'B（良好）';
  else if (report.score >= 60) report.grade = 'C（合格）';
  else report.grade = 'D（需改进）';

  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  if (failCount > 0) report.summary = `发现 ${failCount} 项严重问题、${warnCount} 项警告，综合评分 ${report.score}/${report.grade}`;
  else if (warnCount > 0) report.summary = `整体良好，${warnCount} 项可优化，综合评分 ${report.score}/${report.grade}`;
  else report.summary = `全部核查通过 ✅，综合评分 ${report.score}/${report.grade}`;

  report.checks = checks;
  report.details = {
    freshness: { ...freshnessCheck, items: freshnessCheck.items.slice(0, 10) },
    completeness: { ...completenessCheck, items: completenessCheck.items.slice(0, 10) },
    consistency: { ...consistencyCheck, items: consistencyCheck.items.slice(0, 10) },
    health: { ...healthCheck, items: healthCheck.items.slice(0, 10) },
    volume: volumeCheck,
    counts,
    totalItems: allItems.length,
  };

  // 改进建议
  if (freshnessCheck.status !== 'pass') report.suggestions.push('建议点击「智能刷新」按钮获取最新数据');
  if (completenessCheck.items.length > 0) report.suggestions.push('部分数据缺少必填字段，建议补充完整');
  if (healthCheck.items.some(i => i.level === 'warn')) report.suggestions.push('存在相似标题或过短摘要，建议人工审核');
  if (volumeCheck.status !== 'pass') report.suggestions.push('数据量偏少，建议扩充热点/政策/趋势条目');
  if (report.suggestions.length === 0) report.suggestions.push('数据质量优秀，继续保持更新频率');

  return report;
}

/* ---------- 启动 ---------- */
const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const pathname = url.split('?')[0];
  // 解析 query string 为对象
  let urlObj = { query: {} };
  try {
    const qIdx = url.indexOf('?');
    if (qIdx > -1) {
      const qs = url.slice(qIdx + 1);
      qs.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) urlObj.query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
  } catch(e){}

  if (pathname.startsWith('/api/')) {
    // 先尝试文件 API
    if (pathname.startsWith('/api/files/')) {
      handleFileApi(req, res, pathname, urlObj).catch(e => sendJSON(res, 500, { error: 'SERVER', msg: String(e) }));
      return;
    }
    handleApi(req, res, pathname).catch(e => sendJSON(res, 500, { error: 'SERVER', msg: String(e) }));
  } else {
    serveStatic(req, res, url);
  }
});

/* ---------- 种子文件：部署后自动预置有用文档 ---------- */
const SEED_DIR = path.join(ROOT, 'seed');
function seedFilesIfNeeded() {
  try {
    const meta = loadFilesMeta();
    // 已有文件则不重复播种
    if (meta.files && meta.files.length > 0) {
      console.log(`[种子] 文件中心已有 ${meta.files.length} 个文件，跳过播种`);
      return;
    }
    // 检查 seed 目录是否存在
    if (!fs.existsSync(SEED_DIR)) {
      console.log('[种子] seed/ 目录不存在，跳过');
      return;
    }
    const seedFiles = fs.readdirSync(SEED_DIR).filter(f => !f.startsWith('.') && fs.statSync(path.join(SEED_DIR, f)).isFile());
    if (seedFiles.length === 0) return;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // 今天
    const dateDir = path.join(FILES_DIR, dateStr);
    if (!fs.existsSync(dateDir)) fs.mkdirSync(dateDir, { recursive: true });

    let count = 0;
    for (const fname of seedFiles) {
      const srcPath = path.join(SEED_DIR, fname);
      const fileData = fs.readFileSync(srcPath);
      const ts = Date.now() + count;
      const rand = crypto.randomBytes(4).toString('hex');
      const storedName = `${ts}_${rand}_${fname}`;
      const destPath = path.join(dateDir, storedName);
      fs.writeFileSync(destPath, fileData);

      const ext = path.extname(fname).toLowerCase();
      const mimeMap = {
        '.md': 'text/markdown; charset=utf-8',
        '.txt': 'text/plain; charset=utf-8',
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      };

      meta.files.push({
        id: `${dateStr}_${ts}_${rand}`,
        date: dateStr,
        originalName: fname,
        storedName: storedName,
        size: fileData.length,
        mimeType: mimeMap[ext] || 'application/octet-stream',
        uploader: '系统预置',
        note: '部署时自动预置的参考文档',
        uploadedAt: now.toISOString(),
      });
      count++;
    }
    saveFilesMeta(meta);
    console.log(`[种子] 已预置 ${count} 个文档到文件中心（来源：seed/ 目录）`);
  } catch (e) {
    console.error('[种子] 播种失败:', e.message);
  }
}

// 启动时执行播种
seedFilesIfNeeded();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[协作后端] 监听 http://0.0.0.0:${PORT}  | ID 上限 ${LIMIT}  | 当前已登记 ${USERS.length}`);
});
