/* Lumi — habit & goals dashboard. Vanilla JS, zero dependencies. */
(() => {
  'use strict';
  const LS_KEY = 'lumi.habits.v1';
  const LS_THEME = 'lumi.theme';
  const LS_NAME = 'lumi.name';
  const EMOJIS = ['💪','📚','🏃','🧘','💧','🛌','🍎','📝','🎸','🧠','🌅','🧹','💻','🎨','🌱','☕'];
  const COLORS = ['#7c5cff','#3ddc97','#ff9f43','#ff5a6a','#4dabf7','#f368e0','#feca57','#1dd1a1'];
  const DAY_MS = 86400000;

  /* ---------- state ---------- */
  let habits = load();
  let editingId = null;
  let pick = { emoji: EMOJIS[0], color: COLORS[0] };
  let currentView = 'dashboard';
  let detailId = null;

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY));
      if (Array.isArray(raw) && raw.length) return raw;
    } catch (e) {}
    return seed();
  }
  function save() { localStorage.setItem(LS_KEY, JSON.stringify(habits)); }

  function seed() {
    const t = todayKey();
    const mk = (name, emoji, color, hist) => ({
      id: uid(), name, emoji, color, goal: 'daily', created: Date.now(), log: hist
    });
    // build some plausible history for the last 40 days
    const hist = (prob, includeToday) => {
      const o = {};
      for (let i = 39; i >= 0; i--) {
        if (i === 0 && !includeToday) continue;
        const k = dayKey(Date.now() - i * DAY_MS);
        if (Math.random() < prob) o[k] = true;
      }
      return o;
    };
    return [
      mk('Пить воду', '💧', '#4dabf7', hist(.82, true)),
      mk('Читать 30 мин', '📚', '#7c5cff', hist(.6, false)),
      mk('Тренировка', '💪', '#3ddc97', hist(.5, false)),
      mk('Медитация', '🧘', '#ff9f43', hist(.7, true)),
    ];
  }

  /* ---------- date helpers ---------- */
  function dayKey(ts){ const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
  function todayKey(){ return dayKey(Date.now()); }
  function uid(){ return Math.random().toString(36).slice(2,9); }

  function streak(h){
    let s = 0;
    for (let i = 0; i < 400; i++){
      const k = dayKey(Date.now() - i*DAY_MS);
      if (h.log[k]) s++;
      else if (i === 0) continue; // today not done yet doesn't break streak
      else break;
    }
    return s;
  }
  function bestStreak(h){
    const keys = Object.keys(h.log).filter(k=>h.log[k])
      .map(k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d).getTime();})
      .sort((a,b)=>a-b);
    let best=0,cur=0,prev=null;
    keys.forEach(t=>{ if(prev!==null && Math.round((t-prev)/DAY_MS)===1) cur++; else cur=1; best=Math.max(best,cur); prev=t; });
    return best;
  }
  function rate(h, days){
    let done=0; for(let i=0;i<days;i++){ if(h.log[dayKey(Date.now()-i*DAY_MS)]) done++; } return Math.round(done/days*100);
  }
  function totalDone(h){ return Object.values(h.log).filter(Boolean).length; }

  /* ---------- rendering ---------- */
  const root = document.getElementById('viewRoot');

  function render(){
    if (currentView === 'dashboard') renderDashboard();
    else if (currentView === 'stats') renderStats();
    else if (currentView === 'settings') renderSettings();
    else if (currentView === 'detail') renderDetail();
    renderGreeting();
  }

  function renderGreeting(){
    const h = new Date().getHours();
    const name = localStorage.getItem(LS_NAME) || '';
    let g = 'Добрый день'; let em='☀️';
    if (h < 6){ g='Доброй ночи'; em='🌙'; }
    else if (h < 12){ g='Доброе утро'; em='🌅'; }
    else if (h < 18){ g='Добрый день'; em='☀️'; }
    else { g='Добрый вечер'; em='🌆'; }
    document.getElementById('greet').textContent = `${g}${name?', '+name:''} ${em}`;
    const tk = todayKey();
    const done = habits.filter(x=>x.log[tk]).length;
    const total = habits.length;
    let sub;
    if (total===0) sub='Начни с первой привычки — нажми «Новая привычка».';
    else if (done===total) sub=`🎉 Все ${total} привычек выполнены. Отличный день!`;
    else sub=`Выполнено ${done} из ${total} на сегодня · осталось ${total-done}`;
    document.getElementById('subgreet').textContent = sub;
  }

  function ring(pct, color, size){
    const r = size/2 - 4, c = 2*Math.PI*r, off = c*(1-pct/100);
    return `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--ring-track)" stroke-width="5"/>`+
      `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .7s var(--ease)"/></svg>`;
  }

  function renderDashboard(){
    const tk = todayKey();
    const done = habits.filter(x=>x.log[tk]).length;
    const total = habits.length;
    const pct = total? Math.round(done/total*100):0;
    const topStreak = habits.reduce((m,h)=>Math.max(m,streak(h)),0);
    const avg = total? Math.round(habits.reduce((s,h)=>s+rate(h,30),0)/total):0;
    const totalAll = habits.reduce((s,h)=>s+totalDone(h),0);

    let html = `<div class="stat-row">
      <div class="stat"><div class="stat-label">${ic('check')}Сегодня</div><div class="stat-value">${done}<small>/${total}</small></div></div>
      <div class="stat"><span class="stat-flame">🔥</span><div class="stat-label">${ic('flame')}Лучший streak</div><div class="stat-value">${topStreak}<small> дн.</small></div></div>
      <div class="stat"><div class="stat-label">${ic('chart')}Средний за 30д</div><div class="stat-value">${avg}<small>%</small></div></div>
      <div class="stat"><div class="stat-label">${ic('star')}Всего отметок</div><div class="stat-value">${totalAll}</div></div>
    </div>`;

    html += `<div class="section"><div class="section-head"><h3>Сегодня, ${niceDate()}</h3><span>${pct}% выполнено</span></div>`;
    if (!total){
      html += `<div class="empty"><div class="em">🌱</div><h3>Пока пусто</h3><p>Создай первую привычку и начни отслеживать прогресс каждый день.</p><button class="btn-primary" style="margin:0 auto" onclick="Lumi.openAdd()">+ Создать привычку</button></div>`;
    } else {
      html += `<div class="habit-grid">`;
      habits.forEach(h=>{
        const on = !!h.log[tk]; const st = streak(h); const r30 = rate(h,30);
        html += `<div class="habit-card ${on?'done':''}" style="--hc:${h.color};--hc-soft:${h.color}22" onclick="Lumi.openDetail('${h.id}')">
          <div class="habit-top">
            <div class="habit-emoji">${h.emoji}</div>
            <div class="habit-ring">${ring(r30,h.color,54)}<div class="habit-ring-label">${r30}%</div></div>
          </div>
          <div class="habit-name">${esc(h.name)}</div>
          <div class="habit-meta">${ic('cal')} ежедневно</div>
          <div class="habit-foot">
            <div class="streak-chip">🔥 ${st} дн.</div>
            <button class="check-btn ${on?'on':''}" onclick="event.stopPropagation();Lumi.toggle('${h.id}')">${ic('tick')}</button>
          </div>
        </div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;

    // weekly heatmap
    html += `<div class="section"><div class="section-head"><h3>Активность за последние недели</h3></div><div class="heatmap-card">${heatmap()}</div></div>`;
    root.innerHTML = html;
  }

  function heatmap(){
    // 18 weeks grid, intensity = fraction of habits done that day
    const weeks = 18, cells = weeks*7;
    let cellsHtml = '';
    const total = habits.length || 1;
    for (let i = cells-1; i >= 0; i--){
      const ts = Date.now() - i*DAY_MS;
      const k = dayKey(ts);
      const done = habits.filter(h=>h.log[k]).length;
      const frac = done/total;
      let bg = 'var(--ring-track)';
      if (frac>0) bg = `color-mix(in srgb, var(--accent) ${Math.round(25+frac*75)}%, transparent)`;
      cellsHtml += `<div class="hm-cell" style="background:${bg}" title="${k}: ${done}/${total}"></div>`;
    }
    return `<div class="heatmap">${cellsHtml}</div>
      <div class="hm-legend">Меньше
        <div class="hm-cell" style="background:var(--ring-track)"></div>
        <div class="hm-cell" style="background:color-mix(in srgb,var(--accent) 40%,transparent)"></div>
        <div class="hm-cell" style="background:color-mix(in srgb,var(--accent) 70%,transparent)"></div>
        <div class="hm-cell" style="background:var(--accent)"></div>Больше</div>`;
  }

  function renderDetail(){
    const h = habits.find(x=>x.id===detailId);
    if (!h){ currentView='dashboard'; return render(); }
    const tk = todayKey(); const on=!!h.log[tk];
    let html = `<button class="back-btn" onclick="Lumi.go('dashboard')">${ic('back')} Назад</button>`;
    html += `<div class="section"><div class="section-head"><h3><span style="font-size:22px;margin-right:8px">${h.emoji}</span>${esc(h.name)}</h3>
      <button class="check-btn ${on?'on':''}" style="--hc:${h.color}" onclick="Lumi.toggle('${h.id}')">${ic('tick')}</button></div>
      <div class="detail-grid">
        <div class="mini-stat"><div class="l">Текущий streak</div><div class="v">🔥 ${streak(h)} дн.</div></div>
        <div class="mini-stat"><div class="l">Лучший streak</div><div class="v">${bestStreak(h)} дн.</div></div>
        <div class="mini-stat"><div class="l">% за 30 дней</div><div class="v">${rate(h,30)}%</div></div>
        <div class="mini-stat"><div class="l">Всего выполнено</div><div class="v">${totalDone(h)}</div></div>
      </div></div>`;
    // last 7 weeks bar chart (weekly completion)
    html += `<div class="section"><div class="section-head"><h3>По неделям</h3><span>% выполнения</span></div><div class="heatmap-card"><div class="bars">`;
    for (let w=7; w>=0; w--){
      let done=0; for(let d=0; d<7; d++){ const k=dayKey(Date.now()-(w*7+d)*DAY_MS); if(h.log[k]) done++; }
      const p=Math.round(done/7*100);
      const lbl = w===0?'Сейчас':`-${w}н`;
      html += `<div class="bar" style="height:${Math.max(p,4)}%;background:linear-gradient(180deg,${h.color},${h.color}99)"><span>${lbl}</span></div>`;
    }
    html += `</div></div></div>`;
    html += `<div class="section"><button class="btn-ghost" style="width:auto;padding:0 20px" onclick="Lumi.openEdit('${h.id}')">Редактировать привычку</button></div>`;
    root.innerHTML = html;
  }

  function renderStats(){
    const total = habits.length;
    const avg = total? Math.round(habits.reduce((s,h)=>s+rate(h,30),0)/total):0;
    const top = [...habits].sort((a,b)=>streak(b)-streak(a))[0];
    let html = `<div class="stat-row">
      <div class="stat"><div class="stat-label">${ic('star')}Привычек</div><div class="stat-value">${total}</div></div>
      <div class="stat"><div class="stat-label">${ic('chart')}Средний %</div><div class="stat-value">${avg}<small>%</small></div></div>
      <div class="stat"><div class="stat-label">${ic('flame')}Лидер</div><div class="stat-value" style="font-size:18px">${top?esc(top.name):'—'}</div></div>
      <div class="stat"><div class="stat-label">${ic('check')}Отметок всего</div><div class="stat-value">${habits.reduce((s,h)=>s+totalDone(h),0)}</div></div>
    </div>`;
    html += `<div class="section"><div class="section-head"><h3>Рейтинг привычек · 30 дней</h3></div><div class="heatmap-card">`;
    if(!total){ html+='<p style="color:var(--text-2)">Нет данных.</p>'; }
    [...habits].sort((a,b)=>rate(b,30)-rate(a,30)).forEach(h=>{
      const r=rate(h,30);
      html+=`<div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:550;margin-bottom:7px"><span>${h.emoji} ${esc(h.name)}</span><span style="color:var(--text-2)">${r}%</span></div>
        <div style="height:9px;border-radius:6px;background:var(--ring-track);overflow:hidden"><div style="height:100%;width:${r}%;border-radius:6px;background:linear-gradient(90deg,${h.color},${h.color}aa);transition:width .8s var(--ease)"></div></div>
      </div>`;
    });
    html += `</div></div>`;
    html += `<div class="section"><div class="section-head"><h3>Общая активность</h3></div><div class="heatmap-card">${heatmap()}</div></div>`;
    root.innerHTML = html;
  }

  function renderSettings(){
    const name = localStorage.getItem(LS_NAME) || '';
    const html = `<div class="section"><div class="section-head"><h3>Настройки</h3></div>
      <div class="heatmap-card">
        <div class="field"><label>Твоё имя</label><input id="nameInput" value="${esc(name)}" placeholder="Как к тебе обращаться?"></div>
        <div class="field"><label>Тема</label>
          <div style="display:flex;gap:10px">
            <button class="btn-ghost" onclick="Lumi.setTheme('dark')">🌙 Тёмная</button>
            <button class="btn-ghost" onclick="Lumi.setTheme('light')">☀️ Светлая</button>
          </div>
        </div>
        <div class="field"><label>Данные</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn-ghost" style="flex:none;padding:0 18px" onclick="Lumi.exportData()">⬇️ Экспорт JSON</button>
            <button class="btn-ghost" style="flex:none;padding:0 18px" onclick="Lumi.resetData()">♻️ Сбросить демо-данные</button>
          </div>
        </div>
      </div></div>
      <p style="color:var(--text-3);font-size:13px;margin-top:8px">Lumi хранит все данные локально в браузере (localStorage). Ничего не отправляется на сервер.</p>`;
    root.innerHTML = html;
    const ni = document.getElementById('nameInput');
    ni.addEventListener('input', e=>{ localStorage.setItem(LS_NAME, e.target.value.trim()); renderGreeting(); });
  }

  /* ---------- modal ---------- */
  function openModal(isEdit){
    const h = isEdit ? habits.find(x=>x.id===editingId) : null;
    pick = h ? {emoji:h.emoji,color:h.color} : {emoji:EMOJIS[0],color:COLORS[0]};
    const modal = document.getElementById('modal');
    modal.innerHTML = `<h3>${isEdit?'Редактировать привычку':'Новая привычка'}</h3>
      <div class="field"><label>Название</label>
        <input id="hName" maxlength="40" placeholder="Например: Читать 30 минут" value="${h?esc(h.name):''}">
        <div class="err-msg" id="nameErr">Введи название привычки</div></div>
      <div class="field"><label>Иконка</label><div class="picker" id="emojiPick">${EMOJIS.map(e=>`<button class="pick ${e===pick.emoji?'sel':''}" data-e="${e}">${e}</button>`).join('')}</div></div>
      <div class="field"><label>Цвет</label><div class="picker" id="colorPick">${COLORS.map(c=>`<button class="swatch ${c===pick.color?'sel':''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div></div>
      <div class="modal-foot"><button class="btn-ghost" onclick="Lumi.closeModal()">Отмена</button><button class="btn-save" onclick="Lumi.saveHabit()">${isEdit?'Сохранить':'Добавить'}</button></div>
      ${isEdit?`<button class="btn-del" onclick="Lumi.deleteHabit()">Удалить привычку</button>`:''}`;
    document.getElementById('overlay').classList.add('show');
    modal.querySelectorAll('#emojiPick .pick').forEach(b=>b.onclick=()=>{pick.emoji=b.dataset.e;modal.querySelectorAll('#emojiPick .pick').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');});
    modal.querySelectorAll('#colorPick .swatch').forEach(b=>b.onclick=()=>{pick.color=b.dataset.c;modal.querySelectorAll('#colorPick .swatch').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');});
    setTimeout(()=>document.getElementById('hName').focus(),120);
    document.getElementById('hName').addEventListener('input',e=>{ if(e.target.value.trim()){e.target.classList.remove('err');document.getElementById('nameErr').classList.remove('show');} });
  }

  /* ---------- confetti ---------- */
  function confetti(){
    const cv = document.getElementById('confetti'); const ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const N=140, parts=[];
    for(let i=0;i<N;i++) parts.push({x:innerWidth/2,y:innerHeight/3,vx:(Math.random()-.5)*14,vy:Math.random()*-14-4,
      c:COLORS[i%COLORS.length],s:Math.random()*7+4,a:1,rot:Math.random()*6,vr:(Math.random()-.5)*.4});
    let frame=0;
    (function loop(){
      ctx.clearRect(0,0,cv.width,cv.height); frame++;
      parts.forEach(p=>{ p.vy+=.42; p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr; p.a-=.012;
        ctx.save();ctx.globalAlpha=Math.max(p.a,0);ctx.translate(p.x,p.y);ctx.rotate(p.rot);
        ctx.fillStyle=p.c;ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);ctx.restore();});
      if(frame<120) requestAnimationFrame(loop); else ctx.clearRect(0,0,cv.width,cv.height);
    })();
  }

  function toast(msg){
    const t=document.getElementById('toast'); document.getElementById('toastMsg').textContent=msg;
    t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2400);
  }

  /* ---------- icons ---------- */
  function ic(n){
    const s='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">';
    const p={
      check:'<path d="M20 6 9 17l-5-5"/>',
      tick:'<path d="M20 6 9 17l-5-5"/>',
      flame:'<path d="M12 2s4 4 4 9a4 4 0 0 1-8 0c0-2 1-3 1-3s-2 1-2 4a6 6 0 0 0 12 0c0-6-7-10-7-10z"/>',
      chart:'<path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 5-7"/>',
      star:'<path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.8 6.5 19.5l1-6.3L3 8.9 9 8z"/>',
      cal:'<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/>',
      back:'<path d="M15 18l-6-6 6-6"/>'
    };
    return s+(p[n]||'')+'</svg>';
  }
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function niceDate(){return new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'});}

  /* ---------- public API ---------- */
  window.Lumi = {
    go(v){ currentView=v; document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===v)); render(); },
    openDetail(id){ detailId=id; currentView='detail'; document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active')); render(); },
    openAdd(){ editingId=null; openModal(false); },
    openEdit(id){ editingId=id; openModal(true); },
    closeModal(){ document.getElementById('overlay').classList.remove('show'); },
    toggle(id){
      const h=habits.find(x=>x.id===id); if(!h)return; const k=todayKey();
      if(h.log[k]) delete h.log[k]; else h.log[k]=true;
      save();
      const tk=todayKey(); const allDone = habits.length && habits.every(x=>x.log[tk]);
      render();
      if(h.log[k] && allDone){ confetti(); toast('🎉 Все привычки на сегодня выполнены!'); }
      else if(h.log[k]) toast(`«${h.name}» отмечено ✓`);
    },
    saveHabit(){
      const inp=document.getElementById('hName'); const name=inp.value.trim();
      if(!name){ inp.classList.add('err'); document.getElementById('nameErr').classList.add('show'); inp.focus(); return; }
      if(editingId){ const h=habits.find(x=>x.id===editingId); h.name=name; h.emoji=pick.emoji; h.color=pick.color; toast('Изменения сохранены'); }
      else { habits.push({id:uid(),name,emoji:pick.emoji,color:pick.color,goal:'daily',created:Date.now(),log:{}}); toast('Привычка добавлена 🌱'); }
      save(); this.closeModal();
      if(currentView==='detail') render(); else this.go(currentView==='settings'?'dashboard':currentView);
    },
    deleteHabit(){ habits=habits.filter(x=>x.id!==editingId); save(); this.closeModal(); toast('Привычка удалена'); this.go('dashboard'); },
    setTheme(t){ document.documentElement.setAttribute('data-theme',t); localStorage.setItem(LS_THEME,t); updateThemeBtn(); },
    exportData(){
      const blob=new Blob([JSON.stringify(habits,null,2)],{type:'application/json'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='lumi-habits.json'; a.click(); toast('Данные экспортированы');
    },
    resetData(){ habits=seed(); save(); toast('Демо-данные восстановлены'); this.go('dashboard'); }
  };

  function updateThemeBtn(){
    const dark = document.documentElement.getAttribute('data-theme')==='dark';
    document.getElementById('themeBtn').innerHTML = dark
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  }

  /* ---------- init ---------- */
  document.getElementById('themeBtn').onclick=()=>Lumi.setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');
  document.getElementById('addBtn').onclick=()=>Lumi.openAdd();
  document.getElementById('overlay').onclick=e=>{ if(e.target.id==='overlay') Lumi.closeModal(); };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') Lumi.closeModal(); });
  document.querySelectorAll('.nav-item').forEach(n=>n.onclick=()=>Lumi.go(n.dataset.view));
  window.addEventListener('resize',()=>{const c=document.getElementById('confetti');c.width=innerWidth;c.height=innerHeight;});
  document.documentElement.setAttribute('data-theme', localStorage.getItem(LS_THEME)||'dark');
  updateThemeBtn();
  render();
})();
