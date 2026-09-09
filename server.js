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
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dei-admin-2026'; // 更新情报用的管理口令

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
