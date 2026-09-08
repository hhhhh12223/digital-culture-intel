/* ============================================================
   图表组件 — 纯 SVG，无外部依赖
   ============================================================ */
(function(){
  const NS='http://www.w3.org/2000/svg';
  const esc = s => String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

  function scale(data, w, h, pad){
    const min=Math.min(...data), max=Math.max(...data);
    const span=(max-min)||1;
    return data.map((v,i)=>{
      const x = pad.l + (w-pad.l-pad.r)*(i/(data.length-1||1));
      const y = h-pad.b - (h-pad.t-pad.b)*((v-min)/span);
      return [x,y];
    });
  }

  // 折线/面积图
  function line(data, opt={}){
    const w=opt.w||640, h=opt.h||200;
    const pad={l:opt.padL||8,r:opt.padR||8,t:opt.padT||14,b:opt.padB||22};
    const pts=scale(data,w,h,pad);
    const dLine=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const dArea=dLine+` L${pts[pts.length-1][0].toFixed(1)} ${(h-pad.b).toFixed(1)} L${pts[0][0].toFixed(1)} ${(h-pad.b).toFixed(1)} Z`;
    const id='g'+Math.random().toString(36).slice(2,8);
    const color=opt.color||'#2ee6e6';
    const grid=[]; for(let i=0;i<=3;i++){const y=pad.t+(h-pad.t-pad.b)*i/3; grid.push(`<line x1="${pad.l}" y1="${y}" x2="${w-pad.r}" y2="${y}" stroke="#1e2b46" stroke-width="1"/>`);}
    // x labels
    let xl='';
    const labels=opt.labels||[];
    if(labels.length){
      const step=Math.max(1,Math.floor(labels.length/ (opt.maxLabels||5)));
      labels.forEach((lb,i)=>{ if(i%step===0||i===labels.length-1){ const x=pts[i][0]; xl+=`<text x="${x}" y="${h-6}" fill="#6b7a9e" font-size="10" text-anchor="middle">${esc(lb)}</text>`; }});
    }
    const last=pts[pts.length-1];
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="none" style="display:block">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid.join('')}
      <path d="${dArea}" fill="url(#${id})"/>
      <path d="${dLine}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.6" fill="${color}"/>
      ${xl}
    </svg>`;
  }

  // 迷你 sparkline
  function spark(data, opt={}){
    const w=opt.w||120,h=opt.h||34,pad={l:2,r:2,t:4,b:4};
    const pts=scale(data,w,h,pad);
    const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const color=opt.color||'#2ee6e6';
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block"><path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // 来源占比条 (横向堆叠)
  function sourcesBar(items, opt={}){
    const total=items.reduce((s,i)=>s+i.count,0)||1;
    let x=0; const w=opt.w||300;
    const segs=items.map(it=>{
      const ww=w*it.count/total;
      const seg=`<rect x="${x}" y="0" width="${ww-2}" height="14" rx="4" fill="${it.color}"/>`;
      x+=ww; return seg;
    }).join('');
    return `<svg viewBox="0 0 ${w} 14" width="100%" style="display:block">${segs}</svg>`;
  }

  // 环形图 (占比)
  function donut(segments, opt={}){
    const size=opt.size||160, r=size/2-14, cx=size/2, cy=size/2, sw=opt.sw||16;
    const total=segments.reduce((s,s2)=>s+s2.value,0)||1;
    let a0=-Math.PI/2; const arcs=[];
    segments.forEach(s=>{
      const a1=a0+2*Math.PI*s.value/total;
      const large=(a1-a0)>Math.PI?1:0;
      const x0=cx+r*Math.cos(a0), y0=cy+r*Math.sin(a0);
      const x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1);
      arcs.push(`<path d="M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-linecap="butt"/>`);
      a0=a1;
    });
    const center=opt.center?`<text x="${cx}" y="${cy-2}" text-anchor="middle" fill="#eaf1ff" font-size="18" font-weight="800">${esc(opt.center)}</text><text x="${cx}" y="${cy+14}" text-anchor="middle" fill="#6b7a9e" font-size="10">${esc(opt.centerSub||'')}</text>`:'';
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display:block">${arcs.join('')}${center}</svg>`;
  }

  // 水平条形 (榜单热度条)
  function hbar(items, opt={}){
    const max=Math.max(...items.map(i=>i.value))||1;
    return items.map(it=>{
      const pct=100*it.value/max;
      const color=it.color||'linear-gradient(90deg,#2ee6e6,#4d8dff)';
      return `<div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(0)}%;background:${color}"></div></div><span class="bar-val">${it.value}</span></div>`;
    }).join('');
  }

  window.Charts={ line, spark, sourcesBar, donut, hbar, scale };
})();
