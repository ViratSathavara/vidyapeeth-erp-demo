/* =====================================================================
   UI plumbing, login, shell, dashboard
   ===================================================================== */
const ui={route:'dashboard',tab:{},f:{}};
const ACT={},FORM={},LIVE={},CHG={};
function toast(msg,bad){$('.toast')?.remove();const t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.setAttribute('role','status');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),bad?4200:2600)}
function drawer(html,wide){$('#layer').innerHTML=`<div class="scrim" data-act="close"></div><aside class="drawer ${wide?'wide':''}" role="dialog" aria-modal="true">${html}</aside>`}
function leave(el){const c=el.firstElementChild;if(!c)return;if(matchMedia('(prefers-reduced-motion:reduce)').matches){el.innerHTML='';return}
  el.querySelectorAll('.scrim,.drawer,.dialog').forEach(x=>x.classList.add('leaving'));setTimeout(()=>{if(el.querySelector('.leaving'))el.innerHTML=''},190)}
function closeLayer(){leave($('#layer'))}
function dialog(html){$('#dlg').innerHTML=`<div class="scrim" style="z-index:54" data-act="closeDialog"></div><div class="dialog" role="dialog" aria-modal="true">${html}</div>`}
function closeDialog(){leave($('#dlg'))}
function confirmBox(title,msg,okLabel,onYes,danger){
  dialog(`<h3>${E(title)}</h3><p class="muted" style="margin:0 0 16px">${E(msg)}</p><div class="actions" style="justify-content:flex-end"><button class="btn" data-act="closeDialog">Cancel</button><button class="btn ${danger?'danger':'primary'}" id="dlgOk">${E(okLabel)}</button></div>`);
  $('#dlgOk').onclick=()=>{closeDialog();onYes()};$('#dlgOk').focus();
}
function F(name,label,o={}){
  const{type='text',val='',opts,span,req,ph='',attrs='',id=name,rows=3}=o;let inner;
  if(opts)inner=`<select name="${name}" id="f_${id}" ${req?'required':''} ${attrs}>${opts.map(x=>{const[v,l]=Array.isArray(x)?x:[x,x];return`<option value="${E(v)}" ${String(v)===String(val)?'selected':''}>${E(l)}</option>`}).join('')}</select>`;
  else if(type==='textarea')inner=`<textarea name="${name}" id="f_${id}" rows="${rows}" placeholder="${E(ph)}" ${req?'required':''} ${attrs}>${E(val)}</textarea>`;
  else inner=`<input name="${name}" id="f_${id}" type="${type}" value="${E(val)}" placeholder="${E(ph)}" ${req?'required':''} ${attrs}>`;
  return`<div class="field ${span?'span':''}"><label class="label" for="f_${id}">${E(label)}${req?' *':''}</label>${inner}</div>`;
}
const pill=(t,tone='')=>`<span class="pill ${tone}">${E(t)}</span>`;
function feePill(sm){return (sm.status==='Paid'?pill('Paid','good'):sm.status==='Partial'?pill('Partial','warn'):pill('Not paid','bad'))+(sm.overdue&&sm.status!=='Paid'?' '+pill('Overdue','bad'):'')}
function head(title,sub,actions=''){return`<div class="top"><div><h1>${E(title)}</h1>${sub?`<p>${E(sub)}</p>`:''}</div><div class="actions">${actions}</div></div>`}
function tabsBar(key,items,cur){return`<div class="tabs" role="tablist">${items.map(([id,l])=>`<button role="tab" aria-selected="${cur===id}" data-act="tab" data-key="${key}" data-id="${id}">${E(l)}</button>`).join('')}</div>`}
function qrSvg(seed){let h=0;for(const ch of seed)h=(h*31+ch.charCodeAt(0))>>>0;h=h||1;
  const r=()=>{h^=h<<13;h>>>=0;h^=h>>>17;h^=h<<5;h>>>=0;return h/4294967296};
  const fz=(x,y)=>`<rect x="${x}" y="${y}" width="7" height="7" fill="#000"/><rect x="${x+1}" y="${y+1}" width="5" height="5" fill="#fff"/><rect x="${x+2}" y="${y+2}" width="3" height="3" fill="#000"/>`;
  let s='';for(let y=0;y<21;y++)for(let x=0;x<21;x++){if((x<8&&y<8)||(x>12&&y<8)||(x<8&&y>12))continue;if(r()>.52)s+=`<rect x="${x}" y="${y}" width="1" height="1" fill="#000"/>`}
  return`<svg viewBox="-2 -2 25 25" width="132" height="132" role="img" aria-label="Sample UPI QR code"><rect x="-2" y="-2" width="25" height="25" fill="#fff"/>${fz(0,0)}${fz(14,0)}${fz(0,14)}${s}</svg>`;
}
function csvOf(cols,rows){const q=v=>{v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};return [cols.map(q).join(','),...rows.map(r=>r.map(q).join(','))].join('\n')}
function showCsv(title,cols,rows){
  const txt=csvOf(cols,rows);
  drawer(`<button class="btn x" data-act="close">Close</button><h2>${E(title)}</h2><p class="note">Downloads are blocked in this preview, so copy the text and paste it into Excel or Sheets.</p>
   <textarea class="csvbox" id="csvText" readonly>${E(txt)}</textarea><div class="actions" style="margin-top:12px"><button class="btn primary" data-act="copyCsv">Copy to clipboard</button></div>`,true);
}
ACT.copyCsv=()=>{const t=$('#csvText');t.select();try{navigator.clipboard.writeText(t.value).then(()=>toast('Copied'),()=>toast('Press Ctrl+C to copy the selected text'))}catch(e){toast('Press Ctrl+C to copy the selected text')}};

/* ---------- events ---------- */
const safe=(fn,...a)=>{try{return fn(...a)}catch(err){toast(err.message||String(err),true);(err instanceof TypeError||err instanceof ReferenceError||err instanceof RangeError?console.error:console.warn)(err)}};
const EV_QUIET=new Set(['close','closeDialog','fillLogin','copyCsv','nav','tab','go','evOpen','evMore']);
const evDetail=el=>{if(el.tagName==='TR'||el.tagName==='LI')return el.dataset.id||'';const t=(el.getAttribute('aria-label')||el.textContent||'').replace(/\s+/g,' ').trim().slice(0,60);return t+(el.dataset.id&&!/\d/.test(t)?' · '+el.dataset.id:'')};
/* run a handler, show errors as a toast, and record the outcome in the event log */
function run(cat,label,detail,fn,...a){
  try{const r=fn(...a);if(r&&typeof r.catch==='function')r.catch(err=>{toast(err.message||String(err),true);ev(cat==='Form'?'Form':'Error',label,err.message||String(err),{status:'fail'})});return true}
  catch(err){toast(err.message||String(err),true);(err instanceof TypeError||err instanceof ReferenceError||err instanceof RangeError?console.error:console.warn)(err);ev(cat==='Form'?'Form':'Error',label,err.message||String(err),{status:'fail'});return false}
}
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const name=el.dataset.act,f=ACT[name];if(f){e.preventDefault();const quiet=EV_QUIET.has(name);if(!quiet)ev('Click',humanize(name),evDetail(el));run('Click',humanize(name),evDetail(el),f,el,e)}});
document.addEventListener('submit',e=>{const f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();const name=f.dataset.form,h=FORM[name];if(h){const ok=run('Form',humanize(name)+' form',name,h,f,Object.fromEntries(new FormData(f)));if(ok&&name!=='login')ev('Form',humanize(name)+' form','Saved')}});
document.addEventListener('input',e=>{const el=e.target.closest('[data-live]');if(el&&LIVE[el.dataset.live])safe(LIVE[el.dataset.live],el,e)});
document.addEventListener('change',e=>{const el=e.target.closest('[data-change]');if(el&&CHG[el.dataset.change]){if(!/^ev/.test(el.dataset.change))ev('Change',humanize(el.dataset.change),((el.name||el.id||'').replace(/^f_/,'')+' = '+(el.type==='checkbox'?(el.checked?'on':'off'):String(el.value).slice(0,60))).trim());run('Change',humanize(el.dataset.change),'',CHG[el.dataset.change],el,e)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#dlg').innerHTML)closeDialog();else if($('#layer').innerHTML)closeLayer();else railClose()}});
ACT.close=closeLayer;ACT.closeDialog=closeDialog;
ACT.tab=el=>{ui.tab[el.dataset.key]=el.dataset.id;ev('Page','Opened tab',humanize(el.dataset.key)+' › '+el.textContent.trim().slice(0,40));renderPage();playEnter('swap')};
ACT.go=el=>{closeLayer();go(el.dataset.to)};

/* ---------- tables become cards on phones: label every cell with its column name ---------- */
function labelTables(root=document){
  $$('table',root).forEach(t=>{
    const heads=$$('thead th',t).map(h=>h.textContent.trim());
    $$('tbody tr:not([data-l])',t).forEach(tr=>{
      tr.dataset.l='1';const tds=[...tr.children].filter(c=>c.tagName==='TD'||c.tagName==='TH');let col=0;
      tds.forEach(td=>{
        const span=td.colSpan||1;
        td.dataset.label=span>1?'':(heads[col]||'');col+=span;
        const txt=td.textContent.trim();
        const hasUi=td.querySelector('input,select,textarea,button,svg,img,.bar,.stack');
        if(!txt&&!hasUi)td.dataset.empty='1';
        else if(!txt&&td.querySelector('input[type=checkbox]')&&!td.querySelector('button'))td.dataset.check='1';
        else if(!td.dataset.label&&td.querySelector('button')&&span===1&&!td.querySelector('input,select'))td.dataset.actions='1';
      });
      if(tds.length>=5)tr.dataset.many='1';
      const prim=tr.querySelector('.who')?.closest('td')||tds.find(td=>!td.dataset.check&&!td.dataset.empty&&!td.dataset.actions&&td.dataset.label!==undefined);
      if(prim&&tds.length>1)prim.dataset.primary='1';
    });
  });
}
new MutationObserver(()=>labelTables()).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('DOMContentLoaded',()=>labelTables());

/* ---------- motion helpers ---------- */
const calm=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
function playEnter(kind){
  const pg=$('#page');if(!pg||calm())return;
  pg.classList.remove('enter','swap');void pg.offsetWidth;pg.classList.add(kind);clearTimeout(pg._t);pg._t=setTimeout(()=>pg.classList.remove('enter','swap'),1100);
  if(kind==='enter')countUp(pg);
}
function countUp(root){
  $$('.kpi .v',root).forEach(el=>{
    const txt=el.textContent.trim();if(!/^₹?[\d,]+$/.test(txt))return;
    const rupee=txt[0]==='₹';const target=+txt.replace(/[^\d]/g,'');if(!target)return;
    const t0=performance.now(),dur=900,fmt=n=>(rupee?'₹':'')+Math.round(n).toLocaleString('en-IN');
    const step=now=>{const k=Math.min(1,(now-t0)/dur);const e=1-Math.pow(1-k,3);el.textContent=k<1?fmt(target*e):txt;if(k<1)requestAnimationFrame(step)};
    el.textContent=fmt(0);requestAnimationFrame(step);
  });
}
document.addEventListener('pointermove',e=>{const c=e.target.closest&&e.target.closest('.kpi,.acct');if(!c)return;const r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px')},{passive:true});

/* ---------- theme ---------- */
const isDark=()=>{const a=document.documentElement.getAttribute('data-theme');return a?a==='dark':matchMedia('(prefers-color-scheme:dark)').matches};
const IC=d=>`<svg class="ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_MOON=IC('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),ICON_SUN=IC('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),ICON_OUT=IC('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>');
function themeLabels(){const dark=isDark();const t=dark?'Light mode':'Dark mode';$$('[data-act=theme]').forEach(b=>{const l=b.querySelector('.lbl');if(l){if(l.textContent!==t){l.textContent=t;const i=b.querySelector('.ic');if(i)i.outerHTML=dark?ICON_SUN:ICON_MOON}b.setAttribute('aria-label',t)}else if(b.textContent!==t)b.textContent=t})}
function applyTheme(){const t=lsGet(THEME_KEY);if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);else document.documentElement.removeAttribute('data-theme');themeLabels()}
ACT.theme=()=>{const dark=document.documentElement.getAttribute('data-theme')==='dark'||(!document.documentElement.getAttribute('data-theme')&&matchMedia('(prefers-color-scheme:dark)').matches);lsSet(THEME_KEY,dark?'light':'dark');const h=document.documentElement;h.classList.add('theme-anim');applyTheme();clearTimeout(h._t);h._t=setTimeout(()=>h.classList.remove('theme-anim'),450)};

/* ---------- login ---------- */
const DEMO_ACCTS=[['admin','admin123','Super Admin','College owner or IT admin'],['principal','principal123','Principal','Approves, reviews, reports'],['accountant','account123','Accountant','Fees, day close, bank match'],['parent','parent123','Parent','Fee portal for one student'],['student','student123','Student','Own fees, marks, attendance']];
function renderLogin(msg){
  document.body.classList.remove('rail-lock');
  $('#root').innerHTML=`<div class="login"><section class="login-art"><div><div class="seal">V</div><h1>${E(db.settings.college)}</h1><p>Admissions, student records, fee collection and staff in one place. This is a working demo: everything you add is saved in this browser.</p></div>
   <div class="points"><span>Online (Google Pay / UPI) and cash fees in one ledger</span><span>Fees applied to heads and installments automatically</span><span>Each role sees only what it is allowed to</span></div></section>
   <section class="login-form"><div><h2>Sign in</h2><p class="muted" style="margin:4px 0 0">Pick a demo account or type a username. The admin can add Clerk and Faculty logins later.</p></div>
   <form data-form="login" class="grid" style="gap:12px">${msg?`<div class="err" role="alert">${E(msg)}</div>`:''}
    <div class="field"><label class="label" for="lu">Username</label><input id="lu" name="u" autocomplete="username" required autocapitalize="off"></div>
    <div class="field"><label class="label" for="lp">Password</label><input id="lp" name="p" type="password" autocomplete="current-password" required></div>
    <button class="btn primary" style="padding:11px">Sign in</button></form>
   <div><span class="label">Demo accounts</span><div class="demo-accts" style="margin-top:8px">${DEMO_ACCTS.map(a=>`<button class="acct" type="button" data-act="fillLogin" data-u="${a[0]}" data-p="${a[1]}"><b>${a[2]}</b><small>${a[0]} / ${a[1]}</small><small>${a[3]}</small></button>`).join('')}</div></div>
   <div class="actions"><button class="btn sm" data-act="theme" type="button">Dark mode</button><button class="btn sm danger" data-act="resetDemo" type="button">Reset demo data</button></div></section></div>`;
}
ACT.fillLogin=el=>{$('#lu').value=el.dataset.u;$('#lp').value=el.dataset.p;$('#lp').focus()};
FORM.login=(f,d)=>{
  const u=db.users.find(x=>x.username.toLowerCase()===d.u.trim().toLowerCase()&&x.password===d.p&&x.active);
  if(!u){const ex=db.users.find(x=>x.username.toLowerCase()===d.u.trim().toLowerCase());ev('Auth','Sign-in failed',`Username tried: ${d.u.trim().slice(0,40)} (${!ex?'no such user':ex.active?'wrong password':'account switched off'})`,{user:null,name:ex?ex.name:'Unknown user',un:d.u.trim().slice(0,40),status:'fail'});ntFailed(d.u.trim(),!!ex);renderLogin(ex&&!ex.active?'This account is switched off. Ask the administrator.':'Wrong username or password.');return}
  sesSet(u.id);ui.route=u.role==='Parent'?'phome':u.role==='Student'?'shome':'dashboard';ui.tab={};ui.f={};ui.pre=null;ui.req=null;ui.last=null;ui.feeMode='online';log('Signed in','Role: '+u.role);ev('Auth','Signed in',`${u.role} · username ${u.username}`);ntSync();save();renderApp();
};
ACT.logout=()=>{log('Signed out','');ev('Auth','Signed out','');evFlush();save();sesDel();closeLayer();renderLogin()};
ACT.resetDemo=()=>confirmBox('Reset demo data','All students, payments and changes in this browser will be replaced by fresh sample data.','Reset',()=>{evBuf=[];lsDel(EV_KEY);seed();ev('Audit','Demo data reset','Sample data restored',{user:null,name:'System'});save();sesDel();closeLayer();renderLogin();toast('Demo data reset')},true);

/* ---------- shell ---------- */
const ICONS={dashboard:'<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 9h8V3h-8z"/>',students:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
 fees:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M7 15h3"/>',academic:'<path d="M12 4 2 9l10 5 10-5-10-5z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/>',
 attendance:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16M9 16l2 2 4-4"/>',marks:'<path d="M5 3h10l4 4v14H5z"/><path d="M9 13h6M9 17h6M9 9h3"/>',
 practice:'<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-7h6v7"/>',messages:'<path d="M4 5h16v11H9l-5 4z"/>',staff:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
 reports:'<path d="M5 20V10M12 20V4M19 20v-7"/>',audit:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
 eventlog:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',phome:'<path d="M3 11l9-8 9 8v10H3z"/>',shome:'<path d="M3 11l9-8 9 8v10H3z"/>',sacademic:'<path d="M12 4 2 9l10 5 10-5-10-5z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/>',sprofile:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.200 2 8 6"/>',pfees:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M7 15h3"/>',pnotices:'<path d="M4 5h16v11H9l-5 4z"/>'};
const NAV=[
 ['dashboard','Dashboard',()=>can('dashboard.view'),()=>viewDashboard()],
 ['students','Students',()=>can('students.view'),()=>viewStudents()],
 ['fees','Fee Collection',()=>can('fees.view'),()=>viewFees()],
 ['academic','Academic Setup',()=>can('academic.manage'),()=>viewAcademic()],
 ['attendance','Attendance',()=>canAny('attendance.view','attendance.mark'),()=>viewAttendance()],
 ['marks','Internal Marks',()=>canAny('marks.view','marks.enter'),()=>viewMarks()],
 ['practice','Practice Teaching',()=>can('practice.manage'),()=>viewPractice()],
 ['messages','Messages and Notices',()=>canAny('messages.send','notices.post'),()=>viewMessages()],
 ['staff','Staff and Roles',()=>can('staff.view'),()=>viewStaff()],
 ['reports','Reports',()=>canAny('reports.fees','reports.students','reports.academic','reports.staff'),()=>viewReports()],
 ['audit','Audit Log',()=>can('audit.view'),()=>viewAudit()],
 ['eventlog','Event Log',()=>!!cur()&&cur().role==='Super Admin',()=>viewEventLog()],
 ['settings','Settings',()=>can('settings.manage'),()=>viewSettings()]];
const PNAV=[['phome','Home',()=>true,()=>viewParentHome()],['pfees','Fees and Receipts',()=>true,()=>viewParentFees()],['pnotices','Notices',()=>true,()=>viewParentNotices()]];
const SNAV=[['shome','Home',()=>true,()=>viewStudentHome()],['sacademic','My Academics',()=>true,()=>viewStudentAcademic()],['pfees','Fees and Receipts',()=>true,()=>viewParentFees()],['pnotices','Notices',()=>true,()=>viewParentNotices()],['sprofile','My Profile',()=>true,()=>viewStudentProfile()]];
const isPortal=u=>!!u&&(u.role==='Parent'||u.role==='Student');
const navFor=u=>u.role==='Parent'?PNAV:u.role==='Student'?SNAV:NAV.filter(n=>n[2]());
function badgeFor(id){
  if(id==='fees'&&can('fees.concession.approve')){const n=db.students.filter(s=>s.fee.concession.status==='pending').length;return n?`<span class="badge" title="Concessions waiting for approval">${n}</span>`:''}
  return'';
}
/* ---------- shell: grouped sidebar (collapsible, drawer on phones), Profile and Sign out live at the bottom of it ---------- */
const RAIL_KEY='vp_erp_rail';
const NAV_HIDDEN=new Set(['sprofile']);
const NAV_GROUP={dashboard:'Overview',students:'People',staff:'People',fees:'Finance',academic:'Academics',attendance:'Academics',marks:'Academics',practice:'Academics',messages:'Communication',reports:'Insights',audit:'Insights',eventlog:'Insights',settings:'System'};
const ICON_MENU=IC('<path d="M4 6h16M4 12h16M4 18h16"/>'),ICON_PANEL=IC('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),ICON_X=IC('<path d="M6 6l12 12M18 6 6 18"/>'),ICON_USER=IC('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>');
const railMini=()=>{const p=lsGet(RAIL_KEY);return p?p==='mini':innerWidth<1100};
function navGroups(u){
  const items=navFor(u).filter(n=>!NAV_HIDDEN.has(n[0])),fixed=u.role==='Parent'?'Parent portal':u.role==='Student'?'Student portal':'',map=new Map();
  items.forEach(n=>{const g=fixed||NAV_GROUP[n[0]]||'More';if(!map.has(g))map.set(g,[]);map.get(g).push(n)});
  return[...map];
}
function renderApp(){
  const u=cur();if(!u){renderLogin();return}
  const nav=navFor(u);if(!nav.find(n=>n[0]===ui.route))ui.route=nav[0][0];
  const mini=railMini(),who=E(u.role)+(u.role==='Parent'?' of '+E(stu(u.studentId).name):'')+(u.role==='Student'?' · '+E(u.studentId):'');
  document.body.classList.remove('rail-lock');
  $('#root').innerHTML=`<div class="app" data-rail="${mini?'mini':'open'}"><aside class="rail" id="rail" aria-label="Sidebar">
   <div class="rail-head"><div class="brand"><div class="seal">V</div><div class="bt"><b>${E(db.settings.college)}</b><small>${E(db.settings.year)}</small></div></div>
    <button class="rail-toggle" data-act="railToggle" type="button" aria-expanded="${!mini}" aria-label="${mini?'Expand sidebar':'Collapse sidebar'}" title="${mini?'Expand sidebar':'Collapse sidebar'}">${ICON_PANEL}</button>
    <button class="rail-close" data-act="railClose" type="button" aria-label="Close menu">${ICON_X}</button></div>
   <nav class="nav" id="nav" aria-label="Main menu"></nav>
   <div class="rail-acct" role="group" aria-label="Your account"><div class="me" title="${E(u.name)}"><div class="av">${E(initials(u.name))}</div><div class="mt"><b>${E(u.name)}</b><small>${who}</small></div></div>
    <button class="rb" data-act="profile" type="button" title="Profile">${ICON_USER}<span>Profile</span></button>
    <button class="rb out" data-act="logout" type="button" title="Sign out">${ICON_OUT}<span>Sign out</span></button>
    <div class="rail-foot">Demo data is saved in this browser only.</div></div></aside>
   <div class="rail-scrim" data-act="railClose"></div>
   <main><div class="topbar"><button class="iconbtn menu-btn" data-act="railOpen" type="button" aria-label="Open menu" aria-controls="rail" aria-expanded="false">${ICON_MENU}</button><div class="crumb" id="crumb"></div>
    <div class="tb-end">${bellHtml()}<button class="iconbtn" data-act="theme" type="button" title="Switch between light and dark theme" aria-label="Dark mode">${isDark()?ICON_SUN:ICON_MOON}<span class="lbl sr">${isDark()?'Light mode':'Dark mode'}</span></button></div></div><div id="page"></div></main></div>`;
  renderNav();renderPage();playEnter('enter');
}
function renderNav(){
  const u=cur();
  $('#nav').innerHTML=navGroups(u).map(([g,items],i)=>`<div class="ng" role="group" aria-labelledby="gl${i}"><div class="gl" id="gl${i}">${E(g)}</div>${items.map(n=>`<button data-act="nav" data-id="${n[0]}" title="${E(n[1])}" ${ui.route===n[0]?'aria-current="page"':''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n[0]]||ICONS.dashboard}</svg><span class="nl">${E(n[1])}</span>${badgeFor(n[0])}</button>`).join('')}</div>`).join('');
  const cr=$('#crumb');if(cr){const n=navFor(u).find(x=>x[0]===ui.route);cr.textContent=n?n[1]:''}
  const pb=document.querySelector('[data-act=profile]');if(pb){if(ui.route==='sprofile')pb.setAttribute('aria-current','page');else pb.removeAttribute('aria-current')}
}
function railSet(open){
  const a=$('.app');if(!a)return;a.classList.toggle('rail-open',open);document.body.classList.toggle('rail-lock',open);
  const m=$('.menu-btn');if(m)m.setAttribute('aria-expanded',String(open));
  if(open){const f=$('#nav [aria-current]')||$('#nav button');if(f)f.focus({preventScroll:true})}else if(m&&a._viaMenu){a._viaMenu=false;try{m.focus({preventScroll:true})}catch(e){}}
}
function railClose(){railSet(false)}
ACT.railOpen=()=>{const a=$('.app');if(a)a._viaMenu=true;railSet(true)};
ACT.railClose=railClose;
ACT.railToggle=()=>{
  const a=$('.app');if(!a)return;const mini=a.dataset.rail!=='mini';a.dataset.rail=mini?'mini':'open';lsSet(RAIL_KEY,mini?'mini':'open');
  const b=$('.rail-toggle');if(b){b.setAttribute('aria-expanded',String(!mini));const t=mini?'Expand sidebar':'Collapse sidebar';b.setAttribute('aria-label',t);b.setAttribute('title',t)}
};
try{matchMedia('(min-width:821px)').addEventListener('change',e=>{if(e.matches)railClose()})}catch(e){}
/* Profile: students have a full My Profile page; everyone else gets their account details and password change in a side panel */
function profileHtml(){
  const u=cur(),st=(db.staff||[]).find(x=>x.userId===u.id),kid=u.role==='Parent'?stu(u.studentId):null;
  const L=(k,v)=>`<div class="rline"><span>${k}</span><b style="overflow-wrap:anywhere;text-align:right;font-weight:500">${E(v||'-')}</b></div>`;
  const mods=navFor(u).filter(n=>!NAV_HIDDEN.has(n[0])).map(n=>n[1]);
  return`<button class="btn x" data-act="close">Close</button><div class="who" style="margin:4px 0 14px"><div class="av">${E(initials(u.name))}</div><div><h2 style="margin:0">${E(u.name)}</h2><small class="muted">${E(u.role)}</small></div></div>
   <div class="panel">${L('Role',u.role)}${L('Status',u.active?'Active':'Switched off')}${st?L('Designation',st.designation)+L('Department',st.department)+L('Mobile',st.phone)+L('Email',st.email):''}${kid?L('Student',kid.name+' · '+kid.id):''}</div>
   <div class="panel" style="margin-top:12px"><h2>What you can open</h2><div class="actions">${mods.map(m=>`<span class="pill">${E(m)}</span>`).join('')}</div></div>
   <div style="margin-top:12px">${accountPanel()}</div>`;
}
ACT.profile=()=>{const u=cur();railClose();if(u.role==='Student'){go('sprofile');return}drawer(profileHtml())};
function renderPage(){const u=cur();if(!u)return renderLogin();let n=navFor(u).find(x=>x[0]===ui.route);if(!n){n=navFor(u)[0];ui.route=n[0]}const pg=$('#page');if(!pg)return renderApp();pg.innerHTML=n?n[3]():'';renderNav()}
function go(route){ui.route=route;{const n=navFor(cur()).find(x=>x[0]===route);if(n)ev('Page','Opened '+n[1],route)}renderPage();window.scrollTo(0,0);playEnter('enter')}
ACT.nav=el=>{closeLayer();railClose();go(el.dataset.id)};
function refresh(){save();renderPage()}

/* ---------- dashboard ---------- */
const live=()=>db.students.filter(s=>s.status==='Active');
function dueList(){return live().map(s=>({s,sm:feeSum(s)})).filter(x=>x.sm.payable>0).sort((a,b)=>b.sm.payable-a.sm.payable)}
function todayTotals(){const T=today();const ok=db.payments.filter(p=>p.status==='ok'&&p.date===T);return{online:sum(ok.filter(p=>p.channel==='online'),p=>p.amount),cash:sum(ok.filter(p=>p.mode==='Cash'),p=>p.amount),cheque:sum(ok.filter(p=>p.mode==='Cheque / DD'),p=>p.amount),count:ok.length}}
function myDivisions(){const u=cur();if(u.role!=='Faculty')return db.divisions;
  return db.divisions.filter(d=>d.teacher===u.staffId||db.subjects.some(s=>s.faculty===u.staffId&&s.course===d.course&&db.students.some(st=>st.div===d.id&&st.sem===s.sem)))}
function alertsFor(){
  const A=[];const T=today();
  const pend=db.students.filter(s=>s.fee.concession.status==='pending');
  if(can('fees.concession.approve')&&pend.length)A.push(['warn',`${pend.length} concession request${pend.length>1?'s':''} waiting`,'Open Fee Collection, then Approvals','fees','approvals']);
  if(can('fees.dayclose')&&!db.closures[T]&&db.payments.some(p=>p.date===T&&p.status==='ok'&&p.channel==='counter'))A.push(['warn','Today\'s cash is not closed yet','Count the drawer and close the day','fees','dayclose']);
  const unm=db.payments.filter(p=>p.settle&&p.settle.status==='pending'&&p.status==='ok'&&p.date<T).length;
  if(can('fees.bankmatch')&&unm)A.push(['warn',`${unm} online payment${unm>1?'s':''} waiting for bank match`,'Import the settlement to match them','fees','bank']);
  const prov=live().filter(s=>docsMissing(s)).length;
  if(can('students.edit')&&prov)A.push(['bad',`${prov} students with required documents pending`,'Admission stays provisional until verified','students','']);
  const low=live().filter(s=>{const p=attPct(s);return p!==null&&p<75}).length;
  if(canAny('attendance.view')&&low)A.push(['bad',`${low} students below 75% attendance`,'See the attendance register','attendance','register']);
  if(can('attendance.mark')){const mine=myDivisions().filter(d=>!(db.attendance[T]&&db.attendance[T][d.id]));if(mine.length&&parseD(T).getDay()!==0)A.push(['warn',`Attendance not marked today for ${mine.length} division${mine.length>1?'s':''}`,'Mark attendance','attendance','mark'])}
  if(can('fees.view')){const od=dueList().filter(x=>x.sm.overdue).length;if(od)A.push(['bad',`${od} students have overdue installments`,'Send reminders from Messages','messages','remind'])}
  return A;
}
function viewDashboard(){
  const u=cur(),T=today();const tt=todayTotals();const dl=dueList();const outst=sum(dl,x=>x.sm.payable);
  const collected=sum(live(),s=>s.fee.paid+s.fee.paidLate);
  let kp;
  if(u.role==='Faculty')kp=[['My divisions',myDivisions().length,'Classes you teach or lead'],['Students',db.students.filter(s=>myDivisions().some(d=>d.id===s.div)).length,'In your divisions'],
    ['Below 75% attendance',db.students.filter(s=>myDivisions().some(d=>d.id===s.div)&&attPct(s)!==null&&attPct(s)<75).length,'Needs a word with the student'],['Subjects',db.subjects.filter(s=>s.faculty===u.staffId).length,'Assigned to you']];
  else if(u.role==='Accountant')kp=[['Online today',inr(tt.online),'Google Pay / UPI, auto-matched'],['Cash today',inr(tt.cash),'In the drawer'],['Receipts today',tt.count,'Issued so far'],['Outstanding',inr(outst),dl.length+' students']];
  else if(u.role==='Clerk')kp=[['Students',live().length,'Active admissions'],['Documents pending',live().filter(s=>docsMissing(s)).length,'Provisional admissions'],['Receipts today',tt.count,'Issued so far'],['Outstanding',inr(outst),dl.length+' students']];
  else kp=[['Students enrolled',live().length,`${live().filter(s=>s.course==='bed').length} B.Ed · ${live().filter(s=>s.course==='med').length} M.Ed`],['Fees collected',inr(collected),'This semester, all courses'],['Outstanding dues',inr(outst),dl.length+' students pending'],['Staff on roll',db.staff.filter(s=>s.status!=='Left').length,`${db.staff.filter(s=>s.role==='Faculty').length} teaching`]];
  const showFees=can('fees.view');const al=alertsFor();
  const byCourse=db.courses.map(c=>{const l=live().filter(s=>s.course===c.id);const tot=sum(l,s=>s.fee.total),pd=sum(l,s=>s.fee.paid);return{c,tot,pd}});
  const acts=(can('students.edit')?'<button class="btn" data-act="newAdmission">Add student</button>':'')+(can('fees.collect')?'<button class="btn primary" data-act="nav" data-id="fees">Collect fee</button>':'')+(can('attendance.mark')?'<button class="btn primary" data-act="nav" data-id="attendance">Mark attendance</button>':'');
  const greet=new Date().getHours()<12?'Good morning':new Date().getHours()<17?'Good afternoon':'Good evening';
  return head(`${greet}, ${u.name.replace(/^(Dr\.|Prof\.)\s/,'').split(' ')[0]}`,`${db.settings.college} · ${fmtD(T)}`,acts)+
  `<div class="kpis">${kp.map(k=>`<div class="kpi"><span class="label">${E(k[0])}</span><div class="v">${E(k[1])}</div><div class="s">${E(k[2])}</div></div>`).join('')}</div>
  <div class="grid two"><div class="grid" style="align-content:start">
   ${showFees?`<div class="panel"><h2>Fee collection by course ${pill(db.settings.year,'acc')}</h2><div class="grid" style="gap:12px">${byCourse.map(b=>`<div class="crow"><b>${E(b.c.name)}</b><div class="stack"><i style="width:${b.tot?b.pd/b.tot*100:0}%;background:var(--accent)"></i></div><span class="amt right">${b.tot?Math.round(b.pd/b.tot*100):0}%</span></div><div class="note" style="margin:-6px 0 0 80px">${inr(b.pd)} of ${inr(b.tot)}</div>`).join('')}</div>
    <h3>Highest pending dues</h3><div class="tablewrap"><table><thead><tr><th>Student</th><th>Class</th><th class="num">Payable</th><th></th></tr></thead><tbody>
    ${dl.slice(0,6).map(x=>`<tr class="click" data-act="openStudent" data-id="${E(x.s.id)}"><td><div class="who"><div class="av">${E(initials(x.s.name))}</div>${E(x.s.name)}</div></td><td>${E(classLabel(x.s))}</td><td class="num amt">${inr(x.sm.payable)}</td><td>${feePill(x.sm)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">No dues. Every student is paid up.</td></tr>'}</tbody></table></div></div>`:''}
   ${u.role==='Faculty'?`<div class="panel"><h2>My divisions</h2><div class="list">${myDivisions().map(d=>`<div class="li"><div><b>${E(course(d.course).name)} ${E(batchOf(d.batch).name)} · Division ${E(d.name)}</b><small>${db.students.filter(s=>s.div===d.id).length} students · Class teacher: ${E(staffOf(d.teacher)?.name||'-')}</small></div>${db.attendance[T]?.[d.id]?pill('Marked today','good'):pill('Not marked','warn')}</div>`).join('')}</div></div>`:''}
  </div><div class="grid" style="align-content:start">
   <div class="panel"><h2>Needs attention</h2><div class="list">${al.map(a=>`<div class="li"><div><b>${E(a[1])}</b><small>${E(a[2])}</small></div><button class="btn sm" data-act="alertGo" data-to="${a[3]}" data-sub="${a[4]}">Open</button></div>`).join('')||'<p class="note">Nothing needs attention right now.</p>'}</div></div>
   ${showFees?`<div class="panel"><h2>Recent payments</h2><div class="list">${db.payments.filter(p=>p.status==='ok').sort((a,b)=>b.ts-a.ts).slice(0,6).map(p=>`<div class="li"><div><b>${E(stu(p.studentId).name)}</b><small>${E(p.rc)} · ${E(p.mode)} · ${fmtD(p.date)}</small></div><span class="amt">${inr(p.amount)}</span></div>`).join('')}</div></div>`:''}
   <div class="panel"><h2>Notices</h2><div class="list">${db.notices.slice(0,3).map(n=>`<div class="li" style="align-items:flex-start"><div><b>${E(n.title)}</b><small>${fmtD(n.date)} · ${E(n.by)}</small></div></div>`).join('')||'<p class="note">No notices yet.</p>'}</div></div>
  </div></div>`;
}
ACT.alertGo=el=>{if(el.dataset.sub)ui.tab[el.dataset.to]=el.dataset.sub;go(el.dataset.to)};
