/* ============================================================
   数字文娱智库 — 应用主逻辑
   路由 + 视图渲染 + 抽屉 + 交互
   ============================================================ */
(function(){
let DB = window.DB || { REF_NOW: Date.now() };
let { DEI, HOTSPOTS, RANKINGS, PROJECTS, POLICIES, TRENDS, CAL, SEARCH_INDEX, SUB_TYPES, PLATFORMS } = DB;
let DATA_VERSION = window.DATA_VERSION || '0';
const C = window.Charts;
const $ = s => document.querySelector(s);
const view = $('#view');

/* ---------------- 数据时效（更新时限）----------------
   默认追踪并保留最近 1 个月（30 天）内更新/复核过的条目；
   超过时限视为超出追踪窗口，提示“已超期·建议重新核查”。 */
let REF_NOW = (window.DB && window.DB.REF_NOW) || Date.now();
const WINDOW_OPTIONS = [
  {d:7,  label:'近 1 周'},
  {d:14, label:'近 2 周'},
  {d:30, label:'近 1 个月'},
  {d:90, label:'近 3 个月'},
];
let TIME_WINDOW = 30;
let pendingReload = false;
try { const s = localStorage.getItem('dei_time_window'); if(s && [7,14,30,90].includes(parseInt(s,10))) TIME_WINDOW = parseInt(s,10); } catch(e){}
const windowLabel = d => (WINDOW_OPTIONS.find(o=>o.d===d)||{}).label || (d+'天');

function ageDays(iso){
  const t = new Date(iso).getTime();
  if(isNaN(t)) return 9999;
  return Math.max(0, Math.round((REF_NOW - t)/86400000));
}
function freshStatus(iso){
  const age = ageDays(iso);
  if(age > TIME_WINDOW) return {age, status:'expired', label:'已超期', cls:'fw-expired', tip:'超出更新时限，建议重新核查/归档'};
  if(age > TIME_WINDOW*0.7) return {age, status:'warning', label:'临期', cls:'fw-warn', tip:'接近更新时限'};
  return {age, status:'fresh', label:'时限内', cls:'fw-fresh', tip:'在更新时限内'};
}
function fmtDT(iso){
  const d=new Date(iso); if(isNaN(d)) return '—';
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function freshBadge(iso, prefix){
  const f=freshStatus(iso); const pre = prefix||'更新';
  return `<span class="fw-badge ${f.cls}" title="${f.tip}（上次${pre}：${fmtDT(iso)}）">● ${f.label} · ${f.age}天前</span>`;
}
function withinWindow(iso){ return ageDays(iso) <= TIME_WINDOW; }
function setWindow(d){
  TIME_WINDOW = d; try{ localStorage.setItem('dei_time_window', String(d)); }catch(e){}
  const lbl=$('#fwLabel'); if(lbl) lbl.textContent = windowLabel(d).replace('近 ','');
  const btn=$('#fwBtn'); if(btn) btn.classList.remove('open');
  const menu=$('#fwMenu');
  if(menu) menu.innerHTML = WINDOW_OPTIONS.map(o=>`<button class="fw-opt ${TIME_WINDOW===o.d?'on':''}" data-d="${o.d}">${o.label}${TIME_WINDOW===o.d?' ✓':''}</button>`).join('');
  router();
}
function bindWindowControl(){
  const btn=$('#fwBtn'), menu=$('#fwMenu');
  $('#fwLabel').textContent = windowLabel(TIME_WINDOW).replace('近 ','');
  menu.innerHTML = WINDOW_OPTIONS.map(o=>`<button class="fw-opt ${TIME_WINDOW===o.d?'on':''}" data-d="${o.d}">${o.label}${TIME_WINDOW===o.d?' ✓':''}</button>`).join('');
  btn.onclick=(e)=>{ e.stopPropagation(); menu.classList.toggle('show'); btn.classList.toggle('open'); };
  menu.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>setWindow(parseInt(b.dataset.d,10)));
  document.addEventListener('click',e=>{ if(!e.target.closest('.fw-control')){ menu.classList.remove('show'); btn.classList.remove('open'); } });
}

/* ---------------- 工具 ---------------- */
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtTime = d => new Date(d).toLocaleString('zh-CN',{hour:'2-digit',minute:'2-digit',month:'numeric',day:'numeric'});
const statusMap = {boom:['st-boom','爆发'],rise:['st-rise','上升'],stable:['st-stable','稳定'],fall:['st-fall','衰退']};
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2200); }

/* ---------------- 导航 ---------------- */
const NAV = [
  {id:'home', ico:'◈', label:'实时文娱驾驶舱', group:'主导航'},
  {id:'hotspots', ico:'🔥', label:'实时热点', group:'主导航', badge:'LIVE'},
  {id:'rankings', ico:'🏆', label:'文娱榜单', group:'主导航'},
  {id:'projects', ico:'🎬', label:'项目库', group:'主导航'},
  {id:'policy', ico:'§', label:'数字文化政策智库', group:'主导航'},
  {id:'trends', ico:'📈', label:'趋势洞察', group:'主导航'},
  {id:'data', ico:'🗄', label:'数据中心', group:'主导航'},
];
function renderNav(){
  const cur = curPath();
  let html='', lastGroup=null;
  NAV.forEach(n=>{
    if(n.group!==lastGroup){ html+=`<div class="nav-group-title">${n.group}</div>`; lastGroup=n.group; }
    html+=`<a class="nav-item ${cur===n.id?'active':''}" href="#/${n.id}"><span class="ico">${n.ico}</span><span>${n.label}</span>${n.badge?`<span class="nav-badge">${n.badge}</span>`:''}</a>`;
  });
  $('#nav').innerHTML=html;
}

/* ---------------- 顶栏 Ticker ---------------- */
function renderTicker(){
  const items=[{ico:'▣',label:'今日文娱指数 DEI',val:DEI.value,delta:DEI.delta}];
  DEI.sub.forEach(s=>items.push({ico:'•',label:s.name,val:s.value,delta:s.delta,color:s.color}));
  $('#ticker').innerHTML = items.map(it=>{
    const up = it.delta>=0;
    return `<div class="ticker-item"><span class="tk-ico">${it.ico}</span>${it.label} <b>${it.val}</b><span class="delta ${up?'up':'down'}">${up?'▲':'▼'}${Math.abs(it.delta)}</span></div>`;
  }).join('');
}

/* ---------------- 路由 ---------------- */
const ROUTES = {
  home: renderHome, hotspots: renderHotspots, rankings: renderRankings,
  projects: renderProjects, policy: renderPolicy, trends: renderTrends,
  data: renderData, search: renderSearch,
};
function router(){
  renderNav();
  const raw = location.hash.replace(/^#\//,'') || 'home';
  const [seg, qs] = raw.split('?');
  const path = seg.split('/')[0] || 'home';
  const params = new URLSearchParams(qs||'');
  const fn = ROUTES[path] || renderHome;
  closeDrawer();
  window.scrollTo(0,0);
  fn(params);
}
function curPath(){ return (location.hash.replace(/^#\//,'')||'home').split('?')[0].split('/')[0]||'home'; }
window.addEventListener('hashchange', router);

/* ---------------- 公共片段 ---------------- */
function kpiCard(label, val, delta, sparkData, color, onClick){
  const up = delta>=0;
  return `<div class="card kpi ${onClick?'kpi-click':''}" ${onClick?`data-act="${onClick}"`:''} style="cursor:${onClick?'pointer':'default'}">
    <div class="k-label">${label}</div>
    <div class="k-val">${val}</div>
    <div class="k-sub"><span class="delta ${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(delta)}</span> 较昨日</div>
    <div class="k-spark">${C.spark(sparkData,{w:120,h:34,color:color||'#2ee6e6'})}</div>
  </div>`;
}
function bindKpiClicks(){
  view.querySelectorAll('.kpi[data-act]').forEach(el=>el.onclick=()=>{
    const a=el.dataset.act;
    if(a==='dei') location.hash='#/data';
    else if(a==='hotspots'||a==='hotspots:boom') location.hash='#/hotspots';
    else if(a==='policy:today') location.hash='#/policy';
    else location.hash='#/home';
  });
}

/* ================= 首页驾驶舱 ================= */
function renderHome(){
  const hots = HOTSPOTS.slice(0,5);
  view.innerHTML = `
  <div class="view-head">
    <div><div class="eyebrow">Real-time Entertainment Cockpit</div>
    <div class="view-title">实时文娱驾驶舱</div>
    <div class="view-sub">核心链路：发现热点 → 聚合来源 → 计算热度 → 分析趋势 → 关联项目/IP → 对照政策 → 追溯原文。看见正在发生的文娱，预见下一场文化浪潮。</div></div>
  </div>

  <div class="grid g-4">
    ${kpiCard('今日文娱指数 DEI', DEI.value, DEI.delta, DEI.curve, '#2ee6e6', 'dei')}
    ${kpiCard('实时热点总量', HOTSPOTS.length*42+1180, +5.6, [60,55,72,81,78,92,96], '#ff5a6a', 'hotspots')}
    ${kpiCard('爆发热点', HOTSPOTS.filter(h=>h.status==='boom').length, +2, [30,42,38,55,60,58,72], '#ffb547', 'hotspots:boom')}
    ${kpiCard('今日政策更新', POLICIES.filter(p=>p.pubDate>='2026-09-04').length, +1, [10,14,12,18,20,19,24], '#34e0a1', 'policy:today')}
  </div>

  <div class="grid g-3" style="margin-top:16px">
    ${DEI.sub.slice(0,3).map(s=>kpiCard(s.name, s.value, s.delta, s.value>70?[50,60,58,68,72,70,80]:[30,38,40,46,52,50,60], s.color)).join('')}
  </div>

  <div class="section-title">正在爆发</div>
  <div class="grid g-2" id="homeHots">${hots.map(hotCard).join('')}</div>

  <div class="section-title">核心交互原则 <span class="muted small">（原文可追溯 · 来源透明 · 不伪造数据）</span></div>
  ${principleTable()}

  <div class="section-title">本期建设优先级（MVP）  </div>
  ${mvcTable()}

  <div class="section-title">数据时效 · 更新时限 <span class="muted small">（默认追踪并保留最近 1 个月内更新/复核的条目，超出时限提示重新核查）</span></div>
  ${freshnessSummaryHTML()}
  `;
  bindHotCards();
  bindKpiClicks();
  view.querySelectorAll('.fw-list-item').forEach(el=>el.onclick=()=>{ location.hash=el.dataset.go; });
}

/* 数据时效汇总 */
function allTracked(){
  return [
    ...HOTSPOTS.map(h=>({kind:'热点',name:h.title,id:'hot:'+h.id,updatedAt:h.updatedAt,route:'#/hotspots'})),
    ...PROJECTS.map(p=>({kind:p.type,name:p.name,id:'proj:'+p.id,updatedAt:p.updatedAt,route:'#/projects'})),
    ...POLICIES.map(p=>({kind:'政策',name:p.title,id:'pol:'+p.id,updatedAt:p.updatedAt,route:'#/policy'})),
    ...TRENDS.map(t=>({kind:'趋势',name:t.theme,id:'trend:'+t.id,updatedAt:t.updatedAt,route:'#/trends'})),
  ];
}
function freshnessSummaryHTML(){
  const all=allTracked();
  const inW=all.filter(x=>withinWindow(x.updatedAt));
  const outW=all.filter(x=>!withinWindow(x.updatedAt));
  const rate=Math.round(inW.length/all.length*100);
  const expired=outW.map(x=>({...x,...freshStatus(x.updatedAt)})).sort((a,b)=>b.age-a.age);
  return `
  <div class="card fw-summary">
    <div class="fw-stats">
      <div class="fw-stat"><div class="fw-num" style="color:var(--green)">${inW.length}</div><div class="fw-lab">更新时限内</div></div>
      <div class="fw-stat"><div class="fw-num" style="color:var(--red)">${outW.length}</div><div class="fw-lab">已超期</div></div>
      <div class="fw-stat"><div class="fw-num">${rate}%</div><div class="fw-lab">达标率</div></div>
      <div class="fw-stat"><div class="fw-num">${windowLabel(TIME_WINDOW)}</div><div class="fw-lab">当前时限</div></div>
    </div>
    <div class="fw-bar"><div class="fw-bar-fill" style="width:${rate}%"></div></div>
    ${expired.length===0
      ? `<div class="fw-ok">✓ 当前时限内所有条目均为最新，无需重新核查。</div>`
      : `<div class="fw-list-title">超出更新时限 · 建议重新核查（${expired.length}）</div>
         <div class="fw-list">${expired.map(x=>`
           <div class="fw-list-item" data-go="${x.route}">
             <span class="fw-badge fw-expired">● 已超期 · ${x.age}天前</span>
             <span class="fw-li-name">${esc(x.name)}</span>
             <span class="muted small">${x.kind}</span>
           </div>`).join('')}</div>`}
    <div class="muted small" style="margin-top:10px">提示：顶栏「更新时限」可切换 1周 / 2周 / 1个月 / 3个月；切换后全站卡片标签与列表筛选同步更新，并自动存档 localStorage。</div>
  </div>`;
}

/* 数据中心 · 数据时效中心面板 */
function dataFreshnessPanelHTML(){
  const all=allTracked();
  const inW=all.filter(x=>withinWindow(x.updatedAt));
  const outW=all.filter(x=>!withinWindow(x.updatedAt));
  const rate=Math.round(inW.length/all.length*100);
  const expired=outW.map(x=>({...x,...freshStatus(x.updatedAt)})).sort((a,b)=>b.age-a.age);
  return `
  <div class="section-title">数据时效中心 · 更新时限 <span class="muted small">（追踪并保留最近 ${windowLabel(TIME_WINDOW)} 内更新/复核的条目）</span></div>
  <div class="card">
    <div class="fw-stats">
      <div class="fw-stat"><div class="fw-num" style="color:var(--green)">${inW.length}</div><div class="fw-lab">时限内</div></div>
      <div class="fw-stat"><div class="fw-num" style="color:var(--red)">${outW.length}</div><div class="fw-lab">已超期</div></div>
      <div class="fw-stat"><div class="fw-num">${rate}%</div><div class="fw-lab">达标率</div></div>
    </div>
    <div class="fw-bar"><div class="fw-bar-fill" style="width:${rate}%"></div></div>
    <div class="f-group" style="margin-top:14px"><span class="f-label">调整更新时限</span>${WINDOW_OPTIONS.map(o=>`<button class="chip ${TIME_WINDOW===o.d?'on':''}" data-winopt="${o.d}">${o.label}</button>`).join('')}</div>
    ${expired.length?`<div class="fw-list-title" style="margin-top:14px">已超期 · 建议重新核查（${expired.length}）</div>
      <div class="fw-list">${expired.map(x=>`<div class="fw-list-item" data-go="${x.route}"><span class="fw-badge fw-expired">● 已超期 · ${x.age}天前</span><span class="fw-li-name">${esc(x.name)}</span><span class="muted small">${x.kind}</span></div>`).join('')}</div>`
      :`<div class="fw-ok">✓ 当前时限内全部条目均为最新。</div>`}
    <div class="note" style="margin-top:14px"><b>数据时效规则</b>　系统默认追踪并保留最近 1 个月（可切换 1周/2周/3个月）内更新或复核过的条目；超过时限的条目标记为「已超期·建议重新核查」，不自动删除，待人工/自动重新抓取核验后回到时限内。此项用于保证情报“新鲜度”与可追溯性。</div>
  </div>`;
}

/* 热点卡 */
function hotCard(h){
  const [sc,sl] = statusMap[h.status];
  const srcChips = h.sourceMatrix.map(s=>`<span class="src-chip" data-src="${s.key}">${s.name} ${s.count}</span>`).join('');
  return `<div class="hot-card ${h.status==='boom'?'boom':''}" data-hot="${h.id}">
    <div class="hc-top">
      <div class="hot-rank">${h.rank}</div>
      <div class="hc-body">
        <div class="hc-title">${esc(h.title)}</div>
        <div class="hc-meta"><span class="tag cy">${esc(h.category)}</span><span class="status ${sc}">${sl}</span>${freshBadge(h.updatedAt)}</div>
        <div class="hc-heat"><span class="hv">${h.heat}</span><span class="muted small">热度</span>
          <span class="delta ${h.growth1h>=0?'up':'down'}">${h.growth1h>=0?'+':''}${h.growth1h}% · 1h</span></div>
        <div class="hc-stats"><span>来源 <b>${h.platforms.length}</b> 平台</span><span>首现 <b>${h.firstSeen}</b></span><span>更新 <b>${h.lastUpdate}</b></span></div>
        <div class="hc-sources">${srcChips}</div>
      </div>
    </div>
    <div class="hc-foot"><span class="muted">点击查看详情 · 来源矩阵可点选筛选</span><a class="link-out" data-orig="${h.id}">原文 ↗</a></div>
  </div>`;
}

function bindHotCards(){
  view.querySelectorAll('[data-hot]').forEach(el=>el.addEventListener('click',e=>{
    if(e.target.closest('[data-src]')){ toast('已按「'+e.target.textContent.split(' ')[0]+'」筛选（演示）'); return; }
    if(e.target.closest('[data-orig]')){ const h=HOTSPOTS.find(x=>x.id===e.target.closest('[data-orig]').dataset.orig); openFirstOriginal(h); return; }
    openHotspot(e.currentTarget.dataset.hot);
  }));
}

/* 原则表 / MVP 表 */
function principleTable(){
  const rows=[
    ['原文可追溯','所有外部信息卡片必须有来源与原文入口；政策优先跳转官方原文。'],
    ['来源透明','展示来源平台、发布时间、数据更新时间、来源数量。'],
    ['外链明确','按钮统一采用「查看原文 ↗」「查看官方政策 ↗」「查看原始内容 ↗」等明确文案。'],
    ['不伪造数据','无法稳定获得的数据不做精确展示；估算值必须明确标注。'],
    ['AI可回溯','AI摘要、判断和预测必须能够回到支撑它的原始来源/数据。'],
    ['新窗口/外部跳转','原文原则上新开标签页，用户不丢失当前分析页面。'],
    ['失效保护','原文链接失效时显示「原文链接暂不可访问」，同时保留来源、标题和历史抓取时间。'],
  ];
  return `<div class="card"><table class="table" style="font-size:13px">
    <thead><tr><th style="width:160px">原则</th><th>产品要求</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td><b style="color:var(--cyan)">${r[0]}</b></td><td class="muted">${r[1]}</td></tr>`).join('')}</tbody>
  </table></div>`;
}
function mvcTable(){
  const rows=[
    ['P0','首页驾驶舱','是'],['P0','实时热点/爆发榜','是'],['P0','热点详情+原文跳转','是'],
    ['P0','政策库+政策详情+官方原文跳转','是'],['P0','全站搜索','是'],['P1','DEI指数','是（基础版）'],
    ['P1','政策日历','建议'],['P1','订阅提醒','建议'],['P2','IP图谱','二期'],['P2','商业机会指数','二期'],
  ];
  return `<div class="card"><table class="table" style="font-size:13px">
    <thead><tr><th>优先级</th><th>功能</th><th>一期是否必须</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td><span class="tag ${r[0]==='P0'?'rd':r[0]==='P1'?'am':'pu'}">${r[0]}</span></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

/* ================= 实时热点 ================= */
const hsState = { cat:'全部', sort:'heat', win:'24h', refresh:'30s', inWindow:false };
function renderHotspots(){
  const cats=['全部',...new Set(HOTSPOTS.map(h=>h.category))];
  let list = HOTSPOTS.slice();
  if(hsState.cat!=='全部') list=list.filter(h=>h.category===hsState.cat);
  if(hsState.inWindow) list=list.filter(h=>withinWindow(h.updatedAt));
  if(hsState.sort==='heat') list.sort((a,b)=>b.heat-a.heat);
  if(hsState.sort==='growth') list.sort((a,b)=>b.growth1h-a.growth1h);
  if(hsState.sort==='latest') list.sort((a,b)=>a.lastUpdate.localeCompare(b.lastUpdate));

  view.innerHTML = `
  <div class="view-head">
    <div><div class="eyebrow">Real-time Hotspots</div><div class="view-title">实时热点</div>
    <div class="view-sub">综合榜 / 上升榜 / 爆发榜 / 衰退榜。每条热点均可追溯到来源、查看原文。</div></div>
  </div>

  <div class="filterbar">
    <div class="f-group"><span class="f-label">品类</span>${cats.map(c=>`<button class="chip ${hsState.cat===c?'on':''}" data-cat="${c}">${c}</button>`).join('')}<button class="chip ${hsState.inWindow?'on':''}" data-hswin="1" title="仅显示更新时限内的实时热点">仅显示更新时限内</button></div>
    <div class="f-group" style="margin-left:auto">
      <span class="refresh-dot"><span class="dot"></span>最后更新 <b id="lastUpd">${fmtTime(Date.now())}</b></span>
      <div class="seg">${['30s','1m','5m'].map(r=>`<button class="${hsState.refresh===r?'on':''}" data-ref="${r}">${r}</button>`).join('')}</div>
      <button class="btn" id="refreshBtn">⟳ 刷新</button>
    </div>
  </div>
  <div class="filterbar">
    <div class="f-group"><span class="f-label">排序</span>
      <button class="chip ${hsState.sort==='heat'?'on':''}" data-sort="heat">热度</button>
      <button class="chip ${hsState.sort==='growth'?'on':''}" data-sort="growth">增长率</button>
      <button class="chip ${hsState.sort==='latest'?'on':''}" data-sort="latest">最新</button>
      <button class="chip ${hsState.sort==='spread'?'on':''}" data-sort="spread">跨平台扩散</button>
    </div>
  </div>

  <div class="grid g-2" id="hsList">${list.map(hotCard).join('')}</div>
  `;
  bindHotCards();
  view.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{hsState.cat=b.dataset.cat;renderHotspots();});
  view.querySelectorAll('[data-hswin]').forEach(b=>b.onclick=()=>{hsState.inWindow=!hsState.inWindow;renderHotspots();});
  view.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{hsState.sort=b.dataset.sort;renderHotspots();});
  view.querySelectorAll('[data-ref]').forEach(b=>b.onclick=()=>{hsState.refresh=b.dataset.ref;toast('刷新频率已设为 '+b.dataset.ref);});
  $('#refreshBtn').onclick=()=>{ const u=$('#lastUpd'); if(u)u.textContent=fmtTime(Date.now()); toast('已拉取最新数据（演示）'); };
}

/* ================= 热点详情抽屉 ================= */
function openHotspot(id){
  const h=HOTSPOTS.find(x=>x.id===id); if(!h)return;
  const [sc,sl]=statusMap[h.status];
  const winData = sliceCurve(h.heatCurve, hsState.win);
  const donut = C.donut(h.sourceMatrix.map(s=>({value:s.count,color:s.color})),{size:150,center:String(h.platforms.length),centerSub:'来源平台'});
  const body=`
  <div class="drawer-head">
    <div><div class="eyebrow">热点详情 · ${esc(h.category)}</div>
      <div style="font-size:19px;font-weight:800;max-width:520px">${esc(h.title)}</div>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="status ${sc}">${sl}</span>
        <span class="tag">当前热度 ${h.heat}</span>
        <span class="tag am">1h ${h.growth1h>=0?'+':''}${h.growth1h}%</span>
        ${freshBadge(h.updatedAt)}
      </div>
      <div class="muted small" style="margin-top:6px">上次更新：${fmtDT(h.updatedAt)}</div></div>
    <button class="close-x" data-close>×</button>
  </div>
  <div class="drawer-body">
    <div class="note"><b>核心摘要</b>　${esc(h.summary)}</div>
    <div class="pill-row" style="margin-top:14px">${(h.platforms.map(p=>{const P=PLATFORMS.find(x=>x.key===p);return `<span class="tag cy">${P?P.name:p}</span>`})).join('')}
      <span class="tag pu">关键词：${h.keywords.join('、')}</span></div>

    <div class="section-title">热度曲线</div>
    <div class="card">
      <div class="seg" id="hsWin" style="margin-bottom:10px">
        ${['1h','6h','24h','7d'].map(w=>`<button class="${hsState.win===w?'on':''}" data-win="${w}">${w}</button>`).join('')}
      </div>
      ${C.line(winData.data,{h:200,color:'#2ee6e6',labels:winData.labels})}
      <div class="legend"><span class="lg"><span class="sw" style="background:#2ee6e6"></span>平台综合热度</span><span class="muted small">数据窗口：${winData.window}（演示样本）</span></div>
    </div>

    <div class="cols" style="margin-top:18px">
      <div>
        <div class="section-title">事件时间线</div>
        <div class="timeline">${h.timeline.map(t=>`<div class="tl-item ${t.active?'active':''}"><div class="tl-time">${t.t}</div><div class="tl-text">${esc(t.text)}</div></div>`).join('')}</div>

        <div class="section-title">关联内容</div>
        <div class="grid g-2">${h.related.map(r=>`<div class="rel-card" data-rel="${r.type}:${r.id}"><div class="rc-ico">◉</div><div><div class="rc-t">${esc(r.name)}</div><div class="rc-s">${r.type}</div></div></div>`).join('')}</div>
      </div>
      <div>
        <div class="section-title">传播来源占比</div>
        <div class="card center">${donut}
          <div class="legend" style="justify-content:center">${h.sourceMatrix.map(s=>`<span class="lg"><span class="sw" style="background:${s.color}"></span>${s.name} ${s.count}</span>`).join('')}</div>
        </div>
        <div class="btn-row">
          <button class="btn primary" id="btnOrig">① 查看原文 ↗</button>
          <button class="btn" data-act="fav">③ 收藏热点</button>
          <button class="btn" data-act="sub">④ 订阅该热点</button>
          <button class="btn" data-act="relproj">⑤ 查看关联项目</button>
        </div>
      </div>
    </div>

    <div class="section-title">原文区 <span class="muted small">（每个来源均可跳转原始页面）</span></div>
    ${h.originals.map(o=>{
      const ss = o.status==='ok'?'<span class="source-status ss-ok">官方原文 ↗</span>':o.status==='redirect'?'<span class="source-status ss-warn">已更新地址 ↗</span>':'<span class="source-status ss-warn">暂不可访问</span>';
      return `<div class="source-row"><div><div class="s-name">${esc(o.title)}</div><div class="muted small">${esc(o.src)} · 发布 ${o.published}</div></div>${ss}<a class="link-out" href="${o.url}" target="_blank" rel="noopener" style="margin-left:10px">↗</a></div>`;
    }).join('')}

    <div class="note" style="margin-top:16px"><b>数据说明</b>　本页热度为演示样本，计算口径见 DEI 指数说明；算法权重版本 ${DEI.modelVersion}；最后更新 ${h.lastUpdate}。外部链接在新标签页打开，若失效将提示「原文链接暂不可访问」并保留历史来源。</div>
  </div>`;
  openDrawer(body);
  // 窗口切换
  $('#hsWin').querySelectorAll('[data-win]').forEach(b=>b.onclick=()=>{hsState.win=b.dataset.win;openHotspot(id);});
  $('#btnOrig').onclick=()=>openFirstOriginal(h);
  $('#drawerBody').querySelectorAll('[data-rel]').forEach(el=>el.onclick=()=>{ const [t,id]=el.dataset.rel.split(':'); if(t==='政策')openPolicy(id); else if(t==='作品'||t==='IP'||t==='活动'||t==='人物'||t==='公司')openProjectLike(id); else toast('关联：'+el.querySelector('.rc-t').textContent); });
  $('#drawerBody').querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{ if(b.dataset.act==='fav')toast('已加入收藏（演示）'); if(b.dataset.act==='sub')openSub(); if(b.dataset.act==='relproj')toast('跳转关联项目（演示）'); });
}
function openFirstOriginal(h){ const o=h.originals[0]; if(o){ window.open(o.url,'_blank'); toast('已新开标签页：'+o.src); } }

function sliceCurve(arr, win){
  if(win==='1h') return {data:arr.slice(-12), labels:range(12,'m','前'), window:'近 1 小时'};
  if(win==='6h') return {data:arr.slice(-24), labels:range(24,'m','前'), window:'近 6 小时'};
  if(win==='24h')return {data:arr.slice(-36), labels:range(36,'m','前'), window:'近 24 小时'};
  return {data:arr, labels:range(arr.length,'d','前'), window:'近 7 天'};
}
function range(n,unit,prefix){ const out=[]; for(let i=n-1;i>=0;i--){ out.push(i===0?'现在':`-${i}${unit==='m'?'min':'d'}`); } return out; }

/* ================= 文娱榜单 ================= */
const rankMeta={ movies:{t:'电影',cols:['影片','类型','热度','票房/讨论']}, concerts:{t:'演唱会',cols:['演出','类型','热度','城市/票务']},
  festivals:{t:'音乐节',cols:['活动','阵容','热度','城市/上升']}, shortdramas:{t:'短剧',cols:['剧名','题材','热度','表现']},
  aimanga:{t:'AI漫剧',cols:['剧名','题材','热度','表现']}, music:{t:'音乐',cols:['单曲','歌手','热度','讨论/播放']},
  artists:{t:'艺人',cols:['艺人','身份','热度','声量']} };
const rankTabs=Object.keys(rankMeta);
let curRank='movies';
function renderRankings(){
  const seg = location.hash.split('/');
  curRank = seg[2] || 'movies';
  if(!rankMeta[curRank])curRank='movies';
  const data=RANKINGS[curRank]; const meta=rankMeta[curRank];
  const max=Math.max(...data.map(d=>d.heat));
  view.innerHTML=`
  <div class="view-head"><div><div class="eyebrow">Entertainment Rankings</div><div class="view-title">文娱榜单</div>
  <div class="view-sub">电影 / 演唱会 / 音乐节 / 短剧 / AI漫剧 / 音乐 / 艺人。每项均提供数据来源、统计周期与更新时间，避免误比不同口径。</div></div></div>
  <div class="filterbar">${rankTabs.map(t=>`<button class="chip ${curRank===t?'on':''}" data-rt="${t}">${rankMeta[t].t}</button>`).join('')}</div>
  <div class="card">
    <table class="table">
      <thead><tr><th style="width:54px">#</th>${meta.cols.map(c=>`<th>${c}</th>`).join('')}<th style="width:200px">热度</th></tr></thead>
      <tbody>${data.map((d,i)=>`<tr>
        <td><div class="rank-badge">${i+1}</div></td>
        <td><b>${esc(d.name)}</b></td>
        <td class="muted">${esc(d.sub)}</td>
        <td><b>${d.heat}</b></td>
        <td class="muted small">${esc(d.meta)} ${d.trend==='up'?'<span class="delta up">↑</span>':d.trend==='down'?'<span class="delta down">↓</span>':d.trend==='new'?'<span class="tag gr">新</span>':'→'}</td>
        <td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${(100*d.heat/max).toFixed(0)}%"></div></div><span class="bar-val">${d.heat}</span></div></td>
      </tr>`).join('')}</tbody>
    </table>
    <div class="note" style="margin-top:14px"><b>口径说明</b>　榜单数据为演示样本，统计周期以各平台公开数据为准；热度指数为多源归一化值，跨品类不可直接比较。</div>
  </div>`;
  view.querySelectorAll('[data-rt]').forEach(b=>b.onclick=()=>{ location.hash='#/rankings/'+b.dataset.rt; });
}

/* ================= 项目库 ================= */
function renderProjects(){
  view.innerHTML=`
  <div class="view-head"><div><div class="eyebrow">Project & IP Library</div><div class="view-title">项目库</div>
  <div class="view-sub">作品 / IP / 项目 / 活动 / 主体。统一结构：基本信息—热度—传播—关联—原文/官方信息。</div></div></div>
  <div class="grid g-3">${PROJECTS.map(projCard).join('')}</div>`;
  view.querySelectorAll('[data-proj]').forEach(el=>el.onclick=()=>openProject(el.dataset.proj));
}
function projCard(p){
  return `<div class="card hov" data-proj="${p.id}" style="cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="tag pu">${p.type}</span><span class="tag">${p.heat} 热度</span>${freshBadge(p.updatedAt)}</div>
    <div style="font-size:16px;font-weight:800;margin:10px 0 4px">${esc(p.name)}</div>
    <div class="muted small">${esc(p.subject)} · ${esc(p.time)}</div>
    <div style="margin:12px 0 4px">${C.spark(p.curve,{w:240,h:40,color:'#a855f7'})}</div>
    <div class="muted small">排名变化 ${p.rankChange} · 平台 ${p.platforms.length}</div>
  </div>`;
}
function openProject(id){
  const p=PROJECTS.find(x=>x.id===id); if(!p)return;
  const body=`
  <div class="drawer-head"><div><div class="eyebrow">项目详情 · ${p.type}</div>
    <div style="font-size:19px;font-weight:800">${esc(p.name)}</div>
    <div class="muted small" style="margin-top:4px">${esc(p.subject)} · ${esc(p.time)}</div>
    <div style="margin-top:8px">${freshBadge(p.updatedAt)} <span class="muted small">上次更新：${fmtDT(p.updatedAt)}</span></div></div>
    <button class="close-x" data-close>×</button></div>
  <div class="drawer-body">
    <div class="note">${esc(p.desc)}</div>
    <div class="section-title">基本信息</div>
    <div class="card">${kv('类型',p.type)}${kv('主体',p.subject)}${kv('时间',p.time)}${kv('当前热度',p.heat)}${kv('排名变化',p.rankChange)}</div>

    <div class="section-title">热度</div>
    <div class="card">${C.line(p.curve,{h:180,color:'#a855f7'})}
      <div class="legend"><span class="lg"><span class="sw" style="background:#a855f7"></span>历史热度曲线（演示）</span></div></div>

    <div class="section-title">传播</div>
    <div class="card">
      <div class="kv"><span class="k">平台分布</span><span class="v">${p.platforms.join('、')}</span></div>
      <div class="kv"><span class="k">相关新闻</span><span class="v" style="text-align:left">${p.news.join(' · ')}</span></div>
      <div class="kv"><span class="k">社交话题</span><span class="v" style="text-align:left">${p.topics.join(' ')}</span></div>
    </div>

    <div class="section-title">关联</div>
    <div class="grid g-2">${p.related.map(r=>`<div class="rel-card"><div class="rc-ico">◉</div><div><div class="rc-t">${esc(r.n)}</div><div class="rc-s">${r.t}</div></div></div>`).join('')}</div>

    <div class="section-title">官方信息</div>
    <div class="source-row"><div><div class="s-name">${esc(p.name)} 官方/平台页面</div><div class="muted small">站内仅展示必要信息，交易等请前往官方</div></div>
      <a class="link-out" href="${p.official}" target="_blank" rel="noopener">前往官方页面 ↗</a></div>

    <div class="btn-row"><button class="btn primary" onclick="window.open('${p.official}','_blank')">前往官方页面 ↗</button>
      <button class="btn" data-act="fav">收藏项目</button><button class="btn" data-act="sub">订阅项目</button></div>
    <div class="note" style="margin-top:14px"><b>合规</b>　售票、官方公告等属外部服务，站内不伪装成站内交易；仅展示入口并明确「前往官方页面 ↗」。</div>
  </div>`;
  openDrawer(body);
  $('#drawerBody').querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>toast(b.dataset.act==='fav'?'已收藏（演示）':'已订阅（演示）'));
}
function openProjectLike(id){
  const p=PROJECTS.find(x=>x.id===id);
  if(p)openProject(id); else toast('关联实体详情（演示）');
}

/* ================= 政策智库 ================= */
const polState={ level:'全部', tag:'全部', inWindow:false };
function renderPolicy(){
  const levels=['全部','国家','地方'];
  const tags=['全部',...new Set(POLICIES.flatMap(p=>p.tags))];
  let list=POLICIES.slice();
  if(polState.level!=='全部')list=list.filter(p=>p.level===polState.level);
  if(polState.tag!=='全部')list=list.filter(p=>p.tags.includes(polState.tag));
  if(polState.inWindow)list=list.filter(p=>withinWindow(p.updatedAt));
  view.innerHTML=`
  <div class="view-head"><div><div class="eyebrow">Digital Culture Policy Think Tank</div><div class="view-title">数字文化政策智库</div>
  <div class="view-sub">国家 / 地方 / 产业扶持 / AI+文化 / 数字文化。每条政策均可跳转官方原文、追溯来源。</div></div></div>
  <div class="filterbar"><div class="f-group"><span class="f-label">层级</span>${levels.map(l=>`<button class="chip ${polState.level===l?'on':''}" data-lv="${l}">${l}</button>`).join('')}<button class="chip ${polState.inWindow?'on':''}" data-pwin="1" title="仅显示更新时限内的政策">仅显示更新时限内</button></div>
  <div class="f-group" style="flex-wrap:wrap"><span class="f-label">标签</span>${tags.map(t=>`<button class="chip ${polState.tag===t?'on':''}" data-tg="${t}">${t}</button>`).join('')}</div></div>
  <div class="grid g-2">${list.map(polCard).join('')}</div>`;
  view.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{polState.level=b.dataset.lv;renderPolicy();});
  view.querySelectorAll('[data-tg]').forEach(b=>b.onclick=()=>{polState.tag=b.dataset.tg;renderPolicy();});
  view.querySelectorAll('[data-pwin]').forEach(b=>b.onclick=()=>{polState.inWindow=!polState.inWindow;renderPolicy();});
  view.querySelectorAll('[data-pol]').forEach(el=>el.onclick=()=>openPolicy(el.dataset.pol));
}
function polCard(p){
  return `<div class="card policy-card hov" data-pol="${p.id}" style="cursor:pointer">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="tag ${p.level==='国家'?'cy':'am'}">${p.level}</span><span class="tag">${p.dept}</span><span class="tag gr">${p.status}</span>${freshBadge(p.updatedAt)}</div>
    <div class="pc-title">${esc(p.title)}</div>
    <div class="pc-meta"><span>文号 ${esc(p.docNo)}</span><span>发布 ${p.pubDate}</span><span>实施 ${p.effDate}</span></div>
    <div class="pc-ai">🤖 ${esc(p.aiSummary)}</div>
    <div class="pill-row">${p.tags.map(t=>`<span class="tag pu">${t}</span>`).join('')}</div>
    <div class="hc-foot" style="border:none;padding:0;margin-top:4px"><span class="muted small">点击查看详情 · 官方原文 ↗</span><span class="link-out">查看 ↗</span></div>
  </div>`;
}
function openPolicy(id){
  const p=POLICIES.find(x=>x.id===id); if(!p)return;
  const ss=p.source.status==='ok'?'<span class="source-status ss-ok">官方原文 ↗</span>':p.source.status==='redirect'?'<span class="source-status ss-warn">已更新地址 ↗</span>':'<span class="source-status ss-warn">暂不可访问</span>';
  const body=`
  <div class="drawer-head"><div><div class="eyebrow">政策详情 · ${p.level}</div>
    <div style="font-size:18px;font-weight:800;max-width:520px">${esc(p.title)}</div>
    <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="tag">${p.dept}</span><span class="tag gr">${p.status}</span><span class="tag">${p.docNo}</span>${freshBadge(p.updatedAt)}</div>
    <div class="muted small" style="margin-top:6px">上次更新：${fmtDT(p.updatedAt)}</div></div>
    <button class="close-x" data-close>×</button></div>
  <div class="drawer-body">
    <button class="btn gold" style="width:100%;justify-content:center;margin-bottom:14px" onclick="window.open('${p.official}','_blank')">📄 官方原文 ↗（一级核心按钮）</button>

    <div class="section-title">AI 一句话摘要</div>
    <div class="card policy-card"><div class="pc-ai" style="border-left-color:var(--purple)">🤖 ${esc(p.aiSummary)}</div></div>

    <div class="cols" style="margin-top:18px">
      <div>
        <div class="section-title">核心条款</div>
        <div class="card">${p.clauses.map(c=>`<div class="kv"><span class="k">·</span><span class="v" style="text-align:left;font-weight:500">${esc(c)}</span></div>`).join('')}</div>
        <div class="section-title">政策影响分析</div>
        <div class="card muted" style="line-height:1.7">${esc(p.impact)}</div>
        <div class="section-title">申报 / 扶持信息</div>
        <div class="card muted" style="line-height:1.7">${esc(p.support)}</div>
      </div>
      <div>
        <div class="section-title">适用范围</div>
        <div class="card kv"><span class="k">发布部门</span><span class="v">${esc(p.dept)}</span></div>
        <div class="card kv" style="border-top:none"><span class="k">发布 / 实施</span><span class="v">${p.pubDate} / ${p.effDate}</span></div>
        <div class="card kv" style="border-top:none"><span class="k">效力状态</span><span class="v">${esc(p.status)}</span></div>
        <div class="section-title">相关政策图谱</div>
        <div class="grid g-1">${p.related.map(r=>`<div class="rel-card" data-pol2="${r.id}"><div class="rc-ico">§</div><div><div class="rc-t">${esc(r.n)}</div><div class="rc-s">关联政策</div></div></div>`).join('')}</div>
      </div>
    </div>

    <div class="section-title">来源追溯 <span class="muted small">（source 对象）</span></div>
    <div class="source-row"><div><div class="s-name">${esc(p.source.source_name)}</div>
      <div class="muted small">publisher: ${esc(p.source.publisher)} · published_at: ${p.source.published_at} · fetched_at: ${p.source.fetched_at} · last_checked: ${p.source.last_checked_at}</div></div>${ss}</div>
    <div class="source-row"><div><div class="s-name">官方原文链接</div><div class="muted small">${esc(p.source.source_url)}</div></div><a class="link-out" href="${p.official}" target="_blank" rel="noopener">↗</a></div>

    <div class="btn-row"><button class="btn gold" onclick="window.open('${p.official}','_blank')">📄 官方原文 ↗</button>
      <button class="btn" data-act="fav">收藏政策</button><button class="btn" data-act="sub">订阅提醒</button></div>

    <div class="note" style="margin-top:14px"><b>合规</b>　政策全文优先跳转官方原文；「官方原文 ↗」在标题区与页底各出现一次，不埋于正文底部。来源、采集时间、更新时间均保留可追溯。</div>
  </div>`;
  openDrawer(body);
  $('#drawerBody').querySelectorAll('[data-pol2]').forEach(el=>el.onclick=()=>openPolicy(el.dataset.pol2));
  $('#drawerBody').querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>toast(b.dataset.act==='fav'?'已收藏（演示）':'已订阅提醒（演示）'));
}

/* ================= 趋势洞察 ================= */
function renderTrends(){
  view.innerHTML=`
  <div class="view-head"><div><div class="eyebrow">Trend Insights</div><div class="view-title">趋势洞察</div>
  <div class="view-sub">从「告诉用户发生了什么」升级为「帮助用户判断发生了什么、为什么、下一步关注什么」。采用「结论—证据—原文」三级结构。</div></div></div>
  <div class="grid g-3">${TRENDS.map(trendCard).join('')}</div>`;
  view.querySelectorAll('[data-trend]').forEach(el=>el.onclick=()=>openTrend(el.dataset.trend));
}
function trendCard(t){
  const up=t.change>=0;
  return `<div class="card hov" data-trend="${t.id}" style="cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="tag cy">趋势</span><span class="muted small">置信度 ${(t.confidence*100).toFixed(0)}%</span>${freshBadge(t.updatedAt)}</div>
    <div style="font-size:16px;font-weight:800;margin:10px 0 4px">${esc(t.theme)}</div>
    <div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:26px;font-weight:800">${t.index}</span><span class="delta ${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(t.change)} · 7日</span></div>
    <div style="margin-top:10px">${C.spark(t.index>75?[40,50,48,60,66,64,76]:[30,36,40,46,52,50,60],{w:240,h:36,color:'#34e0a1'})}</div>
    <div class="muted small" style="margin-top:10px">依据 ${t.evidence.length} 条来源 · 数据窗口 ${t.window} 天</div>
  </div>`;
}
function openTrend(id){
  const t=TRENDS.find(x=>x.id===id); if(!t)return;
  const body=`
  <div class="drawer-head"><div><div class="eyebrow">趋势详情 · 置信度 ${(t.confidence*100).toFixed(0)}%</div>
    <div style="font-size:19px;font-weight:800">${esc(t.theme)}</div>
    <div style="margin-top:6px" class="muted small">当前指数 ${t.index} · 7日变化 ${t.change>=0?'+':''}${t.change} · 数据窗口 ${t.window} 天</div>
    <div style="margin-top:8px">${freshBadge(t.updatedAt)} <span class="muted small">上次更新：${fmtDT(t.updatedAt)}</span></div></div>
    <button class="close-x" data-close>×</button></div>
  <div class="drawer-body">
    <div class="triple">
      <div class="tri-block"><h4><span class="tb-ico" style="background:rgba(168,85,247,.18);color:var(--purple)">✦</span>结论（AI）</h4><div class="muted" style="line-height:1.7">${esc(t.conclusion)}</div>
        <div class="muted small" style="margin-top:8px">依据 ${t.evidence.length} 条来源 · 数据窗口 ${t.window} 天（可展开查看）</div></div>
      <div class="tri-block"><h4><span class="tb-ico" style="background:rgba(46,230,230,.18);color:var(--cyan)">⚑</span>证据（数据/来源）</h4>
        ${t.evidence.map(e=>`<div class="evidence-item"><span class="ei-dot"></span>${esc(e)}</div>`).join('')}</div>
      <div class="tri-block"><h4><span class="tb-ico" style="background:rgba(255,90,106,.18);color:var(--red)">↗</span>原文 / 延伸</h4>
        <div class="kv"><span class="k">相关热点</span><span class="v" style="text-align:left">${t.relatedHot.length} 条</span></div>
        <div class="kv"><span class="k">相关政策</span><span class="v" style="text-align:left">${t.relatedPol.length} 条</span></div>
        <div class="grid g-1" style="margin-top:10px">
          ${t.relatedHot.map(h=>{const H=HOTSPOTS.find(x=>x.id===h);return H?`<div class="rel-card" data-hot2="${H.id}"><div class="rc-ico">🔥</div><div><div class="rc-t">${esc(H.title)}</div><div class="rc-s">热点</div></div></div>`:''}).join('')}
          ${t.relatedPol.map(p=>{const P=POLICIES.find(x=>x.id===p);return P?`<div class="rel-card" data-pol3="${P.id}"><div class="rc-ico">§</div><div><div class="rc-t">${esc(P.title)}</div><div class="rc-s">政策</div></div></div>`:''}).join('')}
        </div></div>
    </div>
    <div class="note" style="margin-top:14px"><b>原则</b>　AI 不直接替代事实来源，采用「结论—证据—原文」三级结构；用户可展开查看支撑 AI 判断的原始信息。</div>
  </div>`;
  openDrawer(body);
  $('#drawerBody').querySelectorAll('[data-hot2]').forEach(el=>el.onclick=()=>openHotspot(el.dataset.hot2));
  $('#drawerBody').querySelectorAll('[data-pol3]').forEach(el=>el.onclick=()=>openPolicy(el.dataset.pol3));
}

/* ================= 协作日历 + 文件中心 ================= */
let calYear, calMonth; // 当前显示的年月
function initCal() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth(); // 0-11
}
initCal();

function renderData(){
  view.innerHTML=`
  <div class="view-head"><div><div class="eyebrow">Data Center</div><div class="view-title">数据中心</div>
  <div class="view-sub">历史数据、报告、导出、API。DEI 指数模型与口径公开，权重变更保留版本号。</div></div></div>

  <div class="section-title">DEI 数字文娱指数 · 模型说明</div>
  <div class="card"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
    <div><div class="muted small">当前指数</div><div style="font-size:30px;font-weight:800">${DEI.value} <span class="delta up">▲ ${DEI.delta}</span></div></div>
    <div class="pill-row" style="align-items:center">${DEI.sub.map(s=>`<span class="tag" style="color:${s.color}">${s.name} ${s.value}</span>`).join('')}</div>
  </div>
    <table class="table" style="font-size:13px"><thead><tr><th>构成维度</th><th style="width:120px">权重</th><th>说明</th></tr></thead>
    <tbody>${DEI.weights.map(w=>`<tr><td><b>${w.name}</b></td><td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${w.w*4}%"></div></div><span class="bar-val">${w.w}%</span></div></td><td class="muted small">${w.on?'启用':'未启用'}</td></tr>`).join('')}</tbody></table>
    <div class="note" style="margin-top:12px"><b>口径</b>　数据来源：搜索热度 / 社交讨论 / 视频传播 / 媒体报道 / 增长速度 / 跨平台扩散。时间窗口：滚动 7 天；标准化方法：分位归一化；权重版本 <b>${DEI.modelVersion}</b>；数据缺失按维度加权回填并标注。正式上线前用历史样本回测。</div>
    <div class="btn-row"><button class="btn" data-x="导出说明(PDF)">导出指数说明</button><button class="btn" data-x="API 文档">查看 API</button></div>
  </div>

  ${dataFreshnessPanelHTML()}

  <div class="section-title">协作空间 · 共享使用 <span class="muted small">（多人共享同一份情报，ID 名额上限 ${AUTH.limit||10}）</span></div>
  <div class="card" id="collabCard">
    <div class="collab-top">
      <div class="collab-stat"><div class="cs-num" id="csUsed">—</div><div class="cs-label">已用 ID</div></div>
      <div class="collab-stat"><div class="cs-num" id="csOnline">—</div><div class="cs-label">当前在线</div></div>
      <div class="collab-stat"><div class="cs-num" id="csLimit">${AUTH.limit||10}</div><div class="cs-label">名额上限</div></div>
      <div class="collab-me" id="csMe">我的身份：—</div>
    </div>
    <div class="bar-cell" style="margin:10px 0"><div class="bar-track"><div class="bar-fill collab-fill" id="csFill" style="width:0%"></div></div></div>
    <div class="collab-list" id="collabList"><div class="muted small">加载中…</div></div>
    <div class="btn-row" style="margin-top:10px"><button class="btn" id="csRefresh">刷新协作状态</button><button class="btn" id="csLogout">切换 / 退出</button></div>
  </div>

  <div class="section-title">协作日历 · 文件中心 <span class="muted small">（点击日期上传/查看文件，团队共享）</span></div>
  <div class="card" id="calCard">${buildCalendar()}</div>

  <div class="section-title">历史数据 / 报告</div>
  <div class="grid g-3" id="reportGrid">
    ${generateDynamicReports()}
  </div>

  <div class="section-title" style="margin-top:20px">📋 数据核查报告 <span class="muted small">（智能刷新后自动生成，点击「立即核查」可手动触发）</span></div>
  <div class="card" id="verifyReportCard">
    <div class="verify-placeholder" id="verifyPlaceholder">
      <div class="verify-loading-text">💡 点击下方按钮运行数据质量核查</div>
      <button class="btn btn-primary" id="btnVerifyNow" style="margin-top:10px">🔍 立即核查</button>
    </div>
    <div class="verify-result" id="verifyResult" style="display:none"></div>
  </div>
  <div class="note" style="margin-top:14px"><b>技术</b>　数据接入优先官方开放数据、授权 API、合法商业数据源；采集层做时间标准化、去重、异常检测、来源可信度评分；AI 层做分类、摘要、实体识别、关系抽取、趋势检测。前端响应式 Web，桌面优先兼容移动端。</div>`;
  view.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>toast(b.dataset.x+'（演示）'));
  view.querySelectorAll('[data-rep]').forEach(b=>b.onclick=()=>toast('导出《'+b.dataset.rep+'》（演示）'));
  view.querySelectorAll('[data-winopt]').forEach(b=>b.onclick=()=>setWindow(parseInt(b.dataset.winopt,10)));
  view.querySelectorAll('[data-pol]').forEach(el=>el.onclick=()=>{ if(el.dataset.pol) openPolicy(el.dataset.pol); });
  bindCollabPanel();
  bindVerifyReport();
}

/* ---------- 动态生成历史数据/报告卡片（基于实际数据）---------- */
function generateDynamicReports() {
  const reports = [];
  // 基于当前数据动态生成报告条目
  const now = new Date();
  const ym = `${now.getFullYear()} ${['一','二','三','四','五','六','七','八','九','十','十一','十二'][now.getMonth()]}月`;
  // 1. 本月文娱热点汇总
  reports.push({
    name: `${ym} 文娱热点月报`,
    desc: `收录 ${HOTSPOTS.length} 条热点 · DEI指数 ${DEI.value} · 更新 ${fmtDate(now)}`,
    tag: '月报'
  });
  // 2. 政策汇编
  const polRecent = POLICIES.filter(p => p.pubDate >= '2026-09-01');
  reports.push({
    name: `近期政策汇编（${polRecent.length}条）`,
    desc: `国家/地方政策 · 微短剧/AI/文化出海 · 最新 ${polRecent.length > 0 ? polRecent[0].pubDate : '—'}`,
    tag: '政策'
  });
  // 3. 趋势洞察报告
  reports.push({
    name: `文娱趋势洞察报告`,
    desc: `${TRENDS.length} 条趋势研判 · 置信度平均 ${TRENDS.length > 0 ? Math.round(TRENDS.reduce((s,t)=>s+t.confidence,0)/TRENDS.length*100) : 0}%`,
    tag: '趋势'
  });
  // 4. AI漫剧专题（如果有AI相关热点）
  const aiHots = HOTSPOTS.filter(h => h.title.includes('AI') || h.title.includes('漫剧') || h.category === 'AI漫剧/技术');
  if (aiHots.length > 0) {
    reports.push({
      name: `AI+文娱产业追踪`,
      desc: `${aiHots.length} 条相关热点 · 涵盖AI漫剧/AI视频/智能制作 · 实时更新`,
      tag: '专题'
    });
  }
  // 5. 短剧赛道报告
  const sdHots = HOTSPOTS.filter(h => h.title.includes('短剧') || h.title.includes('红果') || h.title.includes('微短剧'));
  if (sdHots.length > 0) {
    reports.push({
      name: `微短剧行业动态`,
      desc: `${sdHots.length} 条相关热点 · 政策+市场+平台 · 合规与出海`,
      tag: '短剧'
    });
  }
  // 6. 文化出海
  const outHots = HOTSPOTS.filter(h => h.title.includes('出海') || h.title.includes('服贸会') || h.title.includes('海外'));
  if (outHots.length > 0) {
    reports.push({
      name: `文化出海观察`,
      desc: `${outHots.length} 条相关热点 · 服贸会/平台出海/内容输出`,
      tag: '出海'
    });
  }
  // 如果不足4个，补充通用模板
  const tagColors = { '月报':'cy', '政策':'am', '趋势':'pu', '专题':'rd', '短剧':'gr', '出海':'bl' };
  while (reports.length < 4) {
    const extras = [
      { name: `DEI 指数分析报告`, desc: `当前DEI ${DEI.value}（${DEI.delta>=0?'▲':'▼'}${Math.abs(DEI.delta)}）· 六维权重模型 · 版本 ${DEI.modelVersion}`, tag: '指数' },
      { name: `文娱榜单回顾`, desc: `电影/演唱会/音乐节/短剧/AI漫剧 · 多维度热度排行`, tag: '榜单' },
      { name: `协作空间使用报告`, desc: `文件中心 · 团队共享 · 日历协作记录`, tag: '协作' },
    ];
    reports.push(extras[reports.length % extras.length]);
  }

  return reports.slice(0, 6).map((r, i) => {
    const upd = ['09-10','09-10','09-10','09-09','09-09','09-08'][i] || fmtDate(now).slice(5);
    return `<div class="card hov" style="cursor:pointer" data-rep="${r.name}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="tag ${tagColors[r.tag]||'cy'}">${r.tag}</span>
        <span class="muted small" style="font-size:11px">更新 ${upd}</span>
      </div>
      <div style="font-weight:700;margin:8px 0 4px">${esc(r.name)}</div>
      <div class="muted small">${r.desc} · 可导出 PDF/Excel</div>
    </div>`;
  }).join('');
}

/* ---------- 数据核查报告面板 ---------- */
let _lastVerifyResult = null;

function bindVerifyReport() {
  const btn = document.getElementById('btnVerifyNow');
  if (btn) btn.onclick = () => runVerifyAndShow();
  // 如果有缓存结果，直接显示
  if (_lastVerifyResult) showVerifyResult(_lastVerifyResult);
}

async function runVerifyAndShow() {
  const placeholder = document.getElementById('verifyPlaceholder');
  const resultEl = document.getElementById('verifyResult');
  if (placeholder) placeholder.style.display = 'none';
  if (resultEl) { resultEl.style.display = ''; resultEl.innerHTML = '<div style="padding:20px;text-align:center">🔍 正在运行全面数据核查…</div>'; }

  try {
    const res = await fetch('/api/admin/verify?token=dei-admin-2026', { cache: 'no-store' });
    const j = await res.json();
    if (res.ok && j) {
      _lastVerifyResult = j;
      showVerifyResult(j);
    } else {
      if (resultEl) resultEl.innerHTML = `<div style="padding:20px;color:var(--red)">⚠️ 核查失败：${(j&&j.msg)||'未知错误'}</div>`;
    }
  } catch(e) {
    if (resultEl) resultEl.innerHTML = `<div style="padding:20px;color:var(--red)">❌ 网络错误：${String(e)}</div>`;
  }
}

function showVerifyResult(j) {
  const resultEl = document.getElementById('verifyResult');
  const placeholder = document.getElementById('verifyPlaceholder');
  if (!resultEl) return;
  if (placeholder) placeholder.style.display = 'none';
  resultEl.style.display = '';

  const gradeColor = j.score >= 90 ? 'var(--green)' : j.score >= 75 ? '#ffb547' : j.score >= 60 ? '#ff9244' : 'var(--red)';
  const statusIcon = j.checks.every(c => c.status === 'pass') ? '✅' : (j.checks.some(c => c.status === 'fail') ? '❌' : '⚠️');

  let html = `
    <div class="verify-head">
      <div class="verify-score-ring" style="--score:${j.score};--color:${gradeColor}">
        <svg viewBox="0 0 120 120" width="100" height="100">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--bg3)" stroke-width="8"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="${gradeColor}" stroke-width="8"
            stroke-dasharray="${j.score * 3.27} 327" stroke-linecap="round"
            transform="rotate(-90 60 60)" style="transition:stroke-dasharray 1s ease"/>
        </svg>
        <div class="verify-score-text"><div class="vs-num" style="color:${gradeColor}">${j.score}</div><div class="vs-label">${j.grade}</div></div>
      </div>
      <div class="verify-summary">
        <div class="vs-title">${statusIcon} ${j.summary}</div>
        <div class="vs-meta">核查时间：${fmtDT(j.verifiedAt)} · 数据版本：${esc(j.version)} · 共 ${j.details.totalItems||0} 条数据</div>
        <button class="btn btn-sm" style="margin-top:8px" id="btnReVerify">🔄 重新核查</button>
      </div>
    </div>

    <div class="verify-checks">`;

  // 各项检查详情
  j.checks.forEach(c => {
    const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
    const color = c.status === 'pass' ? 'var(--green)' : c.status === 'warn' ? '#ffb547' : 'var(--red)';
    html += `
      <div class="vcheck-item">
        <div class="vcheck-head">
          <span class="vcheck-icon">${icon}</span>
          <span class="vcheck-name">${c.name}</span>
          <span class="vcheck-status" style="color:${color}">${c.status === 'pass'?'通过':c.status==='warn'?'警告':'不通过'}</span>
          <div class="vcheck-bar"><div class="vcheck-bar-fill" style="width:${c.score}%;background:${color}"></div></div>
          <span class="vcheck-score">${c.score}</span>
        </div>
        <div class="vcheck-summary muted small">${c.summary}</div>`;

    if (c.items && c.items.length > 0) {
      html += `<div class="vcheck-items">`;
      c.items.forEach(item => {
        const lvlColor = item.level === 'critical' ? 'var(--red)' : item.level === 'warn' ? '#ffb547' : 'var(--cyan)';
        html += `<div class="vcheck-item-detail">
          <span class="vcheck-dot" style="background:${lvlColor}"></span>
          <span class="vcheck-item-name">${esc(item.name)}</span>
          <span class="vcheck-issues">${(item.issues||[]).join('；')}</span>
        </div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
  });

  html += `</div>`; // .verify-checks

  // 改进建议
  if (j.suggestions && j.suggestions.length > 0) {
    html += `
    <div class="verify-suggestions">
      <div class="vcheck-name">💡 改进建议</div>
      <ul>${j.suggestions.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    </div>`;
  }

  // 数据概览
  if (j.details.counts) {
    const c = j.details.counts;
    html += `
    <div class="verify-overview">
      <div class="vcheck-name">📊 数据概览</div>
      <div class="grid g-4" style="margin-top:8px">
        <div class="vo-card"><div class="vo-num">${c.hotspots}</div><div class="vo-lab">热点</div></div>
        <div class="vo-card"><div class="vo-num">${c.policies}</div><div class="vo-lab">政策</div></div>
        <div class="vo-card"><div class="vo-num">${c.trends}</div><div class="vo-lab">趋势</div></div>
        <div class="vo-card"><div class="vo-num">${c.projects}</div><div class="vo-lab">项目</div></div>
      </div>
    </div>`;
  }

  resultEl.innerHTML = html;

  // 绑定重新核查按钮
  const reBtn = document.getElementById('btnReVerify');
  if (reBtn) reBtn.onclick = () => runVerifyAndShow();
}
function bindCollabPanel(){
  const refresh = ()=>{
    const card = $('#collabCard'); if(!card) return;
    // 无后端（访客）时显示本地占位
    if (AUTH.guest || !AUTH.state) {
      $('#csUsed').textContent = AUTH.id ? 1 : 0;
      $('#csOnline').textContent = AUTH.id ? 1 : 0;
      $('#csLimit').textContent = AUTH.limit || 10;
      $('#csMe').textContent = '我的身份：' + (AUTH.id || '访客（未连接协作服务）');
      $('#csFill').style.width = (AUTH.id ? 10 : 0) + '%';
      $('#collabList').innerHTML = AUTH.id
        ? `<div class="uc-pop-row on"><span class="uc-pop-dot"></span><span class="uc-pop-name">${esc(AUTH.name||AUTH.id)}</span><span class="uc-pop-tag">我 · 在线</span></div>`
        : `<div class="muted small">未连接协作后端，仅本地浏览。</div>`;
      return;
    }
    const st = AUTH.state;
    $('#csUsed').textContent = st.count;
    $('#csOnline').textContent = st.online;
    $('#csLimit').textContent = st.limit;
    $('#csMe').textContent = '我的身份：' + (AUTH.name || AUTH.id || '—');
    $('#csFill').style.width = Math.min(100, Math.round(st.count / st.limit * 100)) + '%';
    $('#collabList').innerHTML = (st.users||[]).map(u=>`<div class="uc-pop-row ${u.online?'on':''}"><span class="uc-pop-dot"></span><span class="uc-pop-name">${esc(u.name||u.id)}</span><span class="uc-pop-tag">${u.id===AUTH.id?'我':(u.online?'在线':'离线')}</span></div>`).join('');
  };
  $('#csRefresh').onclick = async ()=>{ await doHeartbeat(); refresh(); toast('已刷新协作状态'); };
  $('#csLogout').onclick = ()=> doLogout();
  refresh();
}
/* ---------- 协作月历构建 ---------- */
function buildCalendar() {
  const today = new Date();
  const todayStr = fmtDate(today);
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // 周一=0 ... 周日=6
  const daysInMonth = lastDay.getDate();
  const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const wk = ['一','二','三','四','五','六','日'];

  let h = `<div class="cal-header">
    <button class="cal-nav" id="calPrev" title="上个月">◀</button>
    <div class="cal-title">${calYear}年 ${monthNames[calMonth]}</div>
    <button class="cal-nav" id="calNext" title="下个月">▶</button>
    <button class="cal-today-btn" id="calToday" title回到今天">今天</button>
  </div>
  <div class="cal-grid">`;
  // 星期头
  h += wk.map(w => `<div class="cal-cell head">${w}</div>`).join('');
  // 上月空白
  for (let i = 0; i < startDow; i++) h += `<div class="cal-cell empty"></div>`;
  // 当月日期
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const events = getCalEvents(dateStr);
    const fileCount = getFileCount(dateStr);
    h += `<div class="cal-cell day ${isToday?'today':''} ${fileCount>0?'has-files':''}" data-date="${dateStr}">
      <div class="dnum">${d}</div>
      ${events}
      ${fileCount > 0 ? `<div class="file-badge" title="${fileCount}个文件">📎 ${fileCount}</div>` : ''}
    </div>`;
  }
  // 下月空白（补满6行）
  const totalCells = startDow + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remaining; i++) h += `<div class="cal-cell empty"></div>`;
  h += '</div>';

  // 延迟绑定事件
  setTimeout(() => bindCalEvents(), 0);
  return h;
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getCalEvents(dateStr) {
  // 从 CAL 数据和硬编码事件中查找
  const day = parseInt(dateStr.split('-')[2], 10);
  const map = {
    3: ['ce-pub', '微短剧办法施行', 'pol_weiduanju'],
    7: ['ce-eff', '某市措施生效', 'pol_local1'],
    9: ['ce-pub', '服贸会开幕·微短剧C位', ''],
    10: ['ce-dead', 'XR 征求意见截止', 'pol_xr'],
    13: ['ce-pub', '精品计划申报', 'pol_jingpin'],
    23: ['ce-dead', '某市申报截止', 'pol_local1'],
  };
  const e = map[day];
  if (!e) return '';
  return `<div class="cal-event ${e[0]}" data-pol="${e[2]}" title="${e[1]}">${e[1]}</div>`;
}

let _fileCache = {}; // date -> count
function getFileCount(dateStr) {
  if (_fileCache[dateStr] !== undefined) return _fileCache[dateStr];
  // 异步加载，先返回缓存值
  loadFileCount(dateStr);
  return _fileCache[dateStr] || 0;
}
async function loadFileCount(dateStr) {
  try {
    const r = await fetch('/api/files/list?date=' + dateStr);
    if (!r.ok) return;
    const d = await r.json();
    _fileCache[dateStr] = d.count || 0;
    // 更新 DOM
    const cell = document.querySelector(`.cal-cell[data-date="${dateStr}"] .file-badge`);
    if (cell && _fileCache[dateStr] > 0) {
      cell.textContent = `📎 ${_fileCache[dateStr]}`;
      cell.parentElement.classList.add('has-files');
    }
  } catch(e){}
}

function bindCalEvents() {
  $('#calPrev').onclick = () => { calMonth--; if(calMonth<0){calMonth=11;calYear--;} refreshCal(); };
  $('#calNext').onclick = () => { calMonth++; if(calMonth>11){calMonth=0;calYear++;} refreshCal(); };
  $('#calToday').onclick = () => { initCal(); refreshCal(); };
  // 点击日期 → 打开文件弹窗
  document.querySelectorAll('.cal-cell.day[data-date]').forEach(cell => {
    cell.onclick = () => openDayFiles(cell.dataset.date);
  });
  // 政策事件点击
  document.querySelectorAll('.cal-event[data-pol]').forEach(el => {
    el.onclick = (ev) => { ev.stopPropagation(); if(el.dataset.pol) openPolicy(el.dataset.pol); };
  });
}

function refreshCal() {
  const card = $('#calCard');
  if (card) card.innerHTML = buildCalendar();
  // 重新加载所有已有文件的日期计数
  Object.keys(_fileCache).forEach(d => loadFileCount(d));
}

/* ---------- 日期文件弹窗 ---------- */
let _dayModalDate = '';
function openDayFiles(dateStr) {
  _dayModalDate = dateStr;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'dayFileModal';
  modal.innerHTML = `
    <div class="modal-box modal-lg">
      <div class="modal-head">
        <div><span class="modal-title">📅 ${dateStr} · 文件中心</span></div>
        <button class="modal-close" id="closeDayModal">✕</button>
      </div>
      <div class="modal-body">
        <div class="upload-zone" id="uploadZone">
          <div class="upload-icon">📤</div>
          <div>点击或拖拽文件到此处上传</div>
          <div class="muted small" style="margin-top:4px">支持所有格式，单文件最大 50MB</div>
          <input type="file" id="fileInput" multiple style="display:none">
        </div>
        <div class="file-list" id="dayFileList"><div class="muted small">加载中…</div></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  $('#closeDayModal').onclick = () => modal.remove();
  modal.onclick = (e) => { if(e.target===modal) modal.remove(); };

  // 上传区域交互
  const zone = $('#uploadZone');
  const input = $('#fileInput');
  zone.onclick = () => input.click();
  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('drag-over'); };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = (e) => {
    e.preventDefault(); zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleUploads(e.dataTransfer.files);
  };
  input.onchange = () => { if(input.files.length) handleUploads(input.files); };

  // 加载文件列表
  loadDayFiles(dateStr);
}

async function loadDayFiles(dateStr) {
  const listEl = $('#dayFileList');
  try {
    const r = await fetch('/api/files/list?date=' + dateStr);
    const d = await r.json();
    _fileCache[dateStr] = d.count || 0;
    if (!d.files || d.files.length === 0) {
      listEl.innerHTML = `<div class="empty" style="padding:20px">暂无文件，拖拽或点击上方区域上传</div>`;
      return;
    }
    listEl.innerHTML = d.files.map(f => `
      <div class="file-item" data-id="${f.id}">
        <div class="file-icon">${getFileIcon(f.mimeType, f.name)}</div>
        <div class="file-info">
          <div class="file-name" title="${esc(f.name)}">${esc(f.name)}</div>
          <div class="file-meta">${formatSize(f.size)} · ${f.uploader || '匿名'} · ${fmtTime(f.uploadedAt)}</div>
          ${f.note ? `<div class="file-note muted small">${esc(f.note)}</div>` : ''}
        </div>
        <div class="file-actions">
          <button class="btn btn-sm file-dl" data-id="${f.id}" title="下载文件">⬇️ 下载</button>
          <button class="btn btn-sm file-view" data-id="${f.id}" title="在线预览（新窗口）">👁️ 预览</button>
          <button class="btn btn-sm file-del" data-id="${f.id}" title="删除文件">🗑️</button>
        </div>
      </div>`).join('');
    // 绑定操作 —— 下载（强制下载，不被拦截）
    listEl.querySelectorAll('.file-dl').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.id;
      const a = document.createElement('a');
      a.href = '/api/files/download?id=' + encodeURIComponent(id) + '&dl=1';
      a.download = '';  // 触发浏览器原生下载
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    // 预览（新窗口打开，inline 模式）
    listEl.querySelectorAll('.file-view').forEach(b => b.onclick = () => {
      window.open('/api/files/download?id=' + encodeURIComponent(b.dataset.id), '_blank');
    });
    listEl.querySelectorAll('.file-del').forEach(b => b.onclick = () => confirmDelete(b.dataset.id, b.closest('.file-item')));
  } catch(e) {
    listEl.innerHTML = `<div class="muted small" style="color:var(--red)">加载失败，请重试</div>`;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}

function getFileIcon(mime, name) {
  const ext = (name||'').split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)) return '🖼️';
  if (ext === 'pdf') return '📄';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx','csv'].includes(ext)) return '📊';
  if (['ppt','pptx'].includes(ext)) return '📽️';
  if (['mp4','avi','mkv','mov'].includes(ext)) return '🎬';
  if (['mp3','wav','flac'].includes(ext)) return '🎵';
  if (['zip','rar','7z','tar','gz'].includes(ext)) return '📦';
  return '📎';
}

async function handleUploads(fileList) {
  const uploader = (() => { try { return localStorage.getItem('dei_uname') || ''; } catch(e){ return ''; } })();
  for (const file of fileList) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('date', _dayModalDate);
    fd.append('uploader', uploader || '协作者');
    try {
      const r = await fetch('/api/files/upload', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.ok) toast(`✅ ${file.name} 上传成功`);
      else toast(`❌ ${d.msg || '上传失败'}`);
    } catch(e) {
      toast(`❌ 网络错误：${file.name}`);
    }
  }
  // 刷新文件列表
  loadDayFiles(_dayModalDate);
  // 刷新日历角标
  refreshCal();
}

async function confirmDelete(id, itemEl) {
  if (!confirm('确定删除此文件？')) return;
  try {
    const r = await fetch('/api/files/delete', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ id })
    });
    const d = await r.json();
    if (d.ok) {
      if (itemEl) itemEl.style.opacity = '0.3';
      toast('已删除');
      loadDayFiles(_dayModalDate);
      refreshCal();
    } else toast('删除失败：' + (d.msg||''));
  } catch(e) { toast('网络错误'); }
}

/* ================= 搜索 ================= */
function renderSearch(params){
  const q=params.get('q')||'';
  $('#globalSearch').value=q;
  let res=SEARCH_INDEX.filter(s=>s.name.includes(q));
  const groups={};
  res.forEach(r=>{(groups[r.type]=groups[r.type]||[]).push(r);});
  view.innerHTML=`
  <div class="view-head"><div><div class="eyebrow">Global Search</div><div class="view-title">搜索：${esc(q)}</div>
  <div class="view-sub">支持作品 / 人物 / IP / 公司 / 平台 / 热点 / 政策 / 演出 / 音乐节 / 短剧 / AI漫剧。每个结果显示来源与原文入口。</div></div></div>
  ${res.length===0?`<div class="empty">未找到与「${esc(q)}」相关的结果</div>`:
    Object.keys(groups).map(g=>`
    <div class="section-title">${g} <span class="muted small">${groups[g].length}</span></div>
    <div class="card">${groups[g].map(r=>`<div class="kv" style="cursor:pointer" data-search="${r.id}"><span class="k">${esc(r.name)}</span><span class="v" style="text-align:right;color:var(--cyan)">查看 ↗</span></div>`).join('')}</div>`).join('')}
  <div class="note" style="margin-top:14px"><b>知识图谱</b>　实体详情页互相跳转；结果均提供来源与原文入口。搜索建议含热门实体、历史搜索与相关政策。</div>`;
  view.querySelectorAll('[data-search]').forEach(el=>el.onclick=()=>routeSearchResult(el.dataset.search));
}
function routeSearchResult(id){
  const [type,rid]=id.split(':');
  if(type==='hot')openHotspot(rid);
  else if(type==='pol')openPolicy(rid);
  else if(type==='trend')openTrend(rid);
  else if(type==='proj')openProject(rid);
  else if(type==='ent')toast('实体详情：'+rid+'（演示）');
}

/* 搜索建议 */
function bindSearch(){
  const inp=$('#globalSearch'); const sg=$('#searchSuggest');
  inp.addEventListener('input',()=>{
    const v=inp.value.trim();
    if(!v){ sg.classList.remove('show'); return; }
    const hot=HOTSPOTS.filter(h=>h.title.includes(v)).slice(0,3).map(h=>({type:'热点',name:h.title,id:'hot:'+h.id}));
    const pol=POLICIES.filter(p=>p.title.includes(v)).slice(0,3).map(p=>({type:'政策',name:p.title,id:'pol:'+p.id}));
    const proj=PROJECTS.filter(p=>p.name.includes(v)).slice(0,3).map(p=>({type:p.type,name:p.name,id:'proj:'+p.id}));
    const all=[...hot,...pol,...proj];
    if(!all.length){ sg.classList.remove('show'); return; }
    sg.innerHTML=all.map(r=>`<div class="sg-item" data-go="${r.id}"><span class="sg-type">${r.type}</span>${esc(r.name)}</div>`).join('');
    sg.classList.add('show');
    sg.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{ sg.classList.remove('show'); routeSearchResult(el.dataset.go); });
  });
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const v=inp.value.trim(); if(v){ sg.classList.remove('show'); location.hash='#/search?q='+encodeURIComponent(v);} } });
  inp.addEventListener('blur',()=>setTimeout(()=>sg.classList.remove('show'),150));
  $('#btnSubTop').onclick=openSub;
}

/* ================= 订阅弹窗 ================= */
function openSub(){
  const body=`
  <div class="drawer-head"><div><div class="eyebrow">Subscriptions</div><div style="font-size:18px;font-weight:800">订阅与提醒</div></div><button class="close-x" data-close>×</button></div>
  <div class="drawer-body">
    <div class="grid g-2">${SUB_TYPES.map(s=>`<div class="card hov" style="cursor:pointer;text-align:center" data-sub="${s.key}"><div style="font-size:24px">${s.ico}</div><div style="font-weight:700;margin-top:6px">${s.name}</div></div>`).join('')}</div>
    <div class="section-title">提醒类型</div>
    <div class="pill-row">${['热点突破阈值','热度快速增长','新政策发布','政策即将截止','项目状态变化'].map(t=>`<span class="tag gr">${t}</span>`).join('')}</div>
    <div class="note" style="margin-top:14px"><b>偏好</b>　可设置提醒频率与免打扰时间。订阅关键词、人物/IP、品类、政策主题、地区、具体项目，命中后通过站内/邮件推送。</div>
    <div class="btn-row"><button class="btn primary" id="subOk">完成订阅设置</button></div>
  </div>`;
  openDrawer(body, true);
  $('#drawerBody').querySelectorAll('[data-sub]').forEach(el=>el.onclick=()=>toast('已选择：'+el.querySelector('div:last-child').textContent));
  $('#subOk').onclick=()=>toast('订阅设置已保存（演示）');
}

/* ================= 抽屉控制 ================= */
function openDrawer(html, isModal){
  const d=$('#drawer'); const db=$('#drawerBody');
  db.innerHTML=html;
  d.classList.add('show');
  $('#drawerMask').classList.add('show');
  if(!isModal){ /* 允许点遮罩关闭 */ }
  db.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDrawer);
}
function closeDrawer(){ $('#drawer').classList.remove('show'); $('#drawerMask').classList.remove('show'); if(pendingReload){ pendingReload=false; setTimeout(()=>location.reload(),300); } }
$('#drawerMask').onclick=closeDrawer;
document.addEventListener('keydown',e=>{ if(e.key==='Escape')closeDrawer(); });

/* utils: kv */
function kv(k,v){ return `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`; }

/* hamburger */
$('#hamburger').onclick=()=>$('#sidebar').classList.toggle('show');
document.addEventListener('click',e=>{ if(window.innerWidth<=860 && !e.target.closest('#sidebar') && !e.target.closest('#hamburger')) $('#sidebar').classList.remove('show'); });

/* ---------------- 多人协作（共享使用 + ID 上限 10）---------------- */
const AUTH = {
  id: null, name: null, limit: 10, state: null, guest: false,
  hbTimer: null,
};
async function api(path, opts) {
  try {
    const r = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
    let data = {};
    try { data = await r.json(); } catch (e) {}
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: {}, error: String(e) };
  }
}
function authStore(id, name) {
  try { localStorage.setItem('dei_uid', id); localStorage.setItem('dei_uname', name || id); } catch (e) {}
}
function authClear() {
  try { localStorage.removeItem('dei_uid'); localStorage.removeItem('dei_uname'); } catch (e) {}
}
function avatarText(name) {
  const s = (name || '?').trim();
  return s ? s.slice(0, 1).toUpperCase() : 'U';
}
function renderUserChip() {
  const chip = $('#userChip');
  if (!chip) return;
  if (AUTH.guest || !AUTH.id) { chip.style.display = 'none'; return; }
  chip.style.display = 'flex';
  $('#ucAvatar').textContent = avatarText(AUTH.name || AUTH.id);
  $('#ucName').textContent = AUTH.name || AUTH.id;
  const st = AUTH.state || { online: 0, limit: AUTH.limit };
  $('#ucOnline').textContent = `在线 ${st.online || 0}/${st.limit || AUTH.limit}`;
}
function renderUserPop() {
  const pop = $('#ucPop');
  if (!pop || !AUTH.state) return;
  const list = AUTH.state.users || [];
  pop.innerHTML = `<div class="uc-pop-h">协作名单 ${list.length}/${AUTH.state.limit}</div>` +
    list.map(u => `<div class="uc-pop-row ${u.online ? 'on' : ''}">
        <span class="uc-pop-dot"></span>
        <span class="uc-pop-name">${esc(u.name || u.id)}</span>
        <span class="uc-pop-tag">${u.id === AUTH.id ? '我' : (u.online ? '在线' : '离线')}</span>
      </div>`).join('') +
    `<div class="uc-pop-exit" id="ucExit">退出登录</div>`;
  const ex = $('#ucExit');
  if (ex) ex.onclick = () => doLogout();
}
function showAuthSlots() {
  const st = AUTH.state;
  const limit = (st && st.limit) || AUTH.limit;
  const count = (st && st.count) || 0;
  const el = $('#authSlots'); if (el) el.textContent = `已用 ${count} / ${limit}`;
  const lm = $('#authLimit'); if (lm) lm.textContent = limit;
}
function openAuth(force) {
  const ov = $('#authOverlay');
  if (!ov) return;
  if (!force && AUTH.id && !AUTH.guest) { ov.classList.remove('show'); ov.style.display = 'none'; return; }
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('show'));
  const input = $('#authId');
  if (input) input.focus();
  showAuthSlots();
}
function closeAuth() {
  const ov = $('#authOverlay');
  if (ov) { ov.classList.remove('show'); setTimeout(() => { ov.style.display = 'none'; }, 220); }
}
function authMsg(type, text) {
  const el = $('#authMsg');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'auth-msg ' + (type || '');
}
async function doJoin() {
  const input = $('#authId');
  const id = (input.value || '').trim().replace(/\s+/g, '_');
  if (id.length < 2) { authMsg('err', '请输入至少 2 个字符的 ID'); return; }
  if (!/^[一-龥a-zA-Z0-9_]{2,20}$/.test(id)) { authMsg('err', 'ID 仅允许中文/字母/数字/下划线，2-20 位'); return; }
  authMsg('', '正在登记…');
  const res = await api('/api/join', { method: 'POST', body: JSON.stringify({ id, name: id }) });
  if (res.status === 0) { // 无后端（file:// 等）
    AUTH.guest = true; AUTH.id = id; AUTH.name = id; AUTH.state = { online: 1, count: 1, limit: AUTH.limit, users: [{ id, name: id, online: true }] };
    authStore(id, id); renderUserChip(); closeAuth(); toast('未连接协作服务，已切到本地访客模式');
    return;
  }
  if (!res.ok) {
    if (res.status === 409) {
      authMsg('err', `ID 名额已满（${res.data.state ? res.data.state.limit : AUTH.limit} 个），如有已有 ID 可点击下方登录`);
      const g = $('#authGuest'); if (g) g.style.display = 'inline-block';
      showAuthSlots();
      return;
    }
    if (res.status === 400) { authMsg('err', (res.data && res.data.msg) || 'ID 格式不合法'); return; }
    authMsg('err', '登记失败，请重试'); return;
  }
  const u = res.data.user;
  AUTH.id = u.id; AUTH.name = u.name; AUTH.state = res.data.state; AUTH.guest = false;
  authStore(u.id, u.name);
  authMsg('ok', res.data.resumed ? '欢迎回来' : '登记成功');
  renderUserChip(); renderUserPop(); closeAuth();
  startHeartbeat();
  toast(`已进入协作空间：${u.name}（${res.data.state.online}/${res.data.state.limit} 在线）`);
}
async function doHeartbeat() {
  if (AUTH.guest || !AUTH.id) return;
  const res = await api('/api/heartbeat', { method: 'POST', body: JSON.stringify({ id: AUTH.id }) });
  if (res.ok) { AUTH.state = res.data; renderUserChip(); renderUserPop(); }
}
function startHeartbeat() {
  if (AUTH.hbTimer) clearInterval(AUTH.hbTimer);
  AUTH.hbTimer = setInterval(doHeartbeat, 30000);
  doHeartbeat();
}
async function doLogout() {
  if (!AUTH.guest && AUTH.id) {
    await api('/api/leave', { method: 'POST', body: JSON.stringify({ id: AUTH.id }) });
  }
  authClear();
  AUTH.id = null; AUTH.name = null; AUTH.guest = false; AUTH.state = null;
  if (AUTH.hbTimer) { clearInterval(AUTH.hbTimer); AUTH.hbTimer = null; }
  renderUserChip();
  $('#ucPop').classList.remove('show');
  openAuth(true);
}
async function initAuth() {
  const res = await api('/api/state');
  if (res.status === 0) {
    // 无后端：允许访客继续浏览
    AUTH.guest = true; AUTH.limit = 10;
    const sid = (() => { try { return localStorage.getItem('dei_uid'); } catch (e) { return null; } })();
    if (sid) { AUTH.id = sid; AUTH.name = sid; AUTH.state = { online: 1, count: 1, limit: 10, users: [{ id: sid, name: sid, online: true }] }; renderUserChip(); }
    else { renderUserChip(); }
    return;
  }
  AUTH.limit = res.data.limit;
  AUTH.state = res.data;
  let sid = null, sname = null;
  try { sid = localStorage.getItem('dei_uid'); sname = localStorage.getItem('dei_uname'); } catch (e) {}
  if (sid && res.data.users && res.data.users.some(u => u.id.toLowerCase() === sid.toLowerCase())) {
    AUTH.id = sid; AUTH.name = sname || sid;
    renderUserChip(); renderUserPop(); startHeartbeat();
    return; // 已登记，直接进
  }
  openAuth(true); // 需要登记
}
function bindAuthUI() {
  const join = $('#authJoin'); if (join) join.onclick = doJoin;
  const input = $('#authId');
  if (input) {
    input.onkeydown = (e) => { if (e.key === 'Enter') doJoin(); };
    input.oninput = () => authMsg('', '');
  }
  const guest = $('#authGuest');
  if (guest) guest.onclick = () => { AUTH.guest = true; const id = (input.value || 'guest').trim() || 'guest'; AUTH.id = id; AUTH.name = id; AUTH.state = { online: 1, count: 1, limit: AUTH.limit, users: [{ id, name: id, online: true }] }; authStore(id, id); renderUserChip(); closeAuth(); toast('已进入本地访客模式'); };
  const chip = $('#userChip');
  if (chip) chip.onclick = (e) => {
    const pop = $('#ucPop');
    pop.classList.toggle('show');
    e.stopPropagation();
  };
  document.addEventListener('click', (e) => {
    const pop = $('#ucPop');
    if (pop && !e.target.closest('.user-chip')) pop.classList.remove('show');
  });
}

/* ---------------- 实时数据加载（服务端驱动）----------------
   优先从 /api/data 获取服务端最新情报；失败则回退到打包的 data.js（离线 / file:// 模式）。
   serverTime 作为时效计算的“现在”，保证时效准确、不冻死在旧日期。 */
async function loadLiveData(){
  try{
    const res = await fetch('/api/data', {cache:'no-store'});
    if(!res.ok) return false;
    const j = await res.json();
    if(!j || !j.db || !j.db.HOTSPOTS) return false;
    DB = j.db;
    ({ DEI, HOTSPOTS, RANKINGS, PROJECTS, POLICIES, TRENDS, CAL, SEARCH_INDEX, SUB_TYPES, PLATFORMS } = DB);
    REF_NOW = (typeof j.serverTime === 'number') ? j.serverTime : (DB.REF_NOW || Date.now());
    DATA_VERSION = j.version || '0';
    return true;
  }catch(e){ return false; }
}

/* ---------------- 数据实时同步（被分享者自动获取最新情报）----------------
   原理：每隔 30s 拉取 /api/data；若版本号变化说明情报已更新，
   则在用户不在看抽屉时自动重渲染当前视图（共享实时同步，无需整页刷新）。 */
function startDataWatch(){
  setInterval(async ()=>{
    try{
      const res = await fetch('/api/data', {cache:'no-store'});
      if(!res.ok) return;
      const j = await res.json();
      if(!j || !j.version) return;
      if(j.version !== DATA_VERSION){
        if($('#drawer') && $('#drawer').classList.contains('show')){ pendingReload = true; return; }
        toast('📡 情报数据已更新，正在刷新…');
        await loadLiveData();
        renderTicker();
        router();   // 重渲染当前路由视图
      }
    }catch(e){ /* file:// 或网络异常时忽略 */ }
  }, 30000);
}

/* ---------------- 智能刷新按钮 ----------------
   点击后调用 /api/admin/refresh → 后端自动抓取最新文娱资讯
   → 更新 data.json → 版本自增 → 30s 轮询自动重渲染全站 */
(function bindSmartRefresh(){
  const btn = document.getElementById('smartRefreshBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    // 防止重复点击
    if (btn.disabled || btn.classList.contains('sr-loading')) return;
    btn.classList.add('sr-loading');
    btn.disabled = true;
    const ico = btn.querySelector('.sr-ico');
    const origText = btn.childNodes[btn.childNodes.length - 1].textContent;
    btn.innerHTML = '<span class="sr-ico sr-spin">🔄</span> 正在智能刷新…';

    try {
      const res = await fetch('/api/admin/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'dei-admin-2026' })
      });
      const j = await res.json();
      if (res.ok && j.ok) {
        toast('✅ ' + (j.hint || '智能刷新完成，版本 ' + j.version));
        // 立即触发一次数据加载（不等30s轮询）
        const loaded = await loadLiveData();
        if (loaded) { renderTicker(); router(); }
        // ★ 自动运行数据核查并在页面末尾展示报告
        try {
          const vr = await fetch('/api/admin/verify?token=dei-admin-2026', { cache: 'no-store' });
          const vj = await vr.json();
          if (vr.ok && vj) {
            _lastVerifyResult = vj;
            // 如果当前在数据中心页面，直接渲染核查结果
            if (curPath() === 'data') showVerifyResult(vj);
            else toast(`📋 核查完成：${vj.score}分 ${vj.grade}（前往数据中心查看详情）`);
          }
        } catch(e) { /* 核查失败不阻断主流程 */ }
      } else {
        toast('⚠️ ' + ((j && j.msg) || '刷新失败，请稍后重试'));
      }
    } catch (e) {
      toast('❌ 网络错误：' + String(e));
    } finally {
      btn.classList.remove('sr-loading');
      btn.disabled = false;
      btn.innerHTML = '<span class="sr-ico">🔄</span> 智能刷新';
    }
  });
})();

/* ---------------- 启动 ---------------- */
(async function boot(){
  await loadLiveData();   // 优先加载服务端实时数据（失败则回退打包数据）
  renderTicker();
  bindSearch();
  bindWindowControl();
  bindAuthUI();
  initAuth();
  router();
  startDataWatch();
})();
})();
