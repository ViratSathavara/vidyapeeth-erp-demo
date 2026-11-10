/* =====================================================================
   Login, forced password change, app shell (sidebar, top bar, student bottom tabs)
   ===================================================================== */
const DEMO_ACCTS=()=>{const s=db.students[0];return[['admin','admin123','Super Admin','Platform owner · everything'],['principal','principal123','Principal','B.Ed only'],['principalmed','principal123','Principal','M.Ed only'],['clerk','clerk123','Clerk / Accountant','B.Ed + M.Ed · fees, students'],[s?s.enrol.toLowerCase():'','student123','Student',s?s.name+' · own portal':'']]};
const LOGO=()=>`<div class="seal" aria-hidden="true">N</div>`;
function renderLogin(msg){
  document.body.classList.remove('rail-lock','portal');const c=db.college;document.title='Sign in · '+c.short+' ERP';
  $('#root').innerHTML=`<div class="login"><section class="login-art"><div><div class="brandline">${LOGO()}<span>${E(c.trust)}</span></div><h1>${E(c.name)}</h1><p>B.Ed and M.Ed college office: students, semester fees, receipts, audit and notices in one place. Students use the same address as an app on their phone.</p></div>
   <div class="points"><span>Cash, Cheque, UPI and Expense in one ledger</span><span>Receipt PDF and email for every payment</span><span>Live notifications for staff and students</span></div>
   <small class="artfoot">${E(c.address)} · ${E(c.phone)}</small></section>
   <section class="login-form"><div><h2>Sign in</h2><p class="muted" style="margin:4px 0 0">Staff use their username. Students use their enrolment number or email.</p></div>
   <div id="loginInstall" class="install-holder"></div>
   <form data-form="login" class="grid" style="gap:12px">${msg?`<div class="err" role="alert">${E(msg)}</div>`:''}
    <div class="field"><label class="label" for="lu">Username, enrolment no. or email</label><input id="lu" name="u" autocomplete="username" required autocapitalize="off" spellcheck="false"></div>
    <div class="field"><label class="label" for="lp">Password</label><input id="lp" name="p" type="password" autocomplete="current-password" required></div>
    <button class="btn primary big">Sign in</button></form>
   <div><span class="label">Demo accounts (tap to fill)</span><div class="demo-accts" style="margin-top:8px">${DEMO_ACCTS().map(a=>`<button class="acct" type="button" data-act="fillLogin" data-u="${E(a[0])}" data-p="${E(a[1])}"><b>${E(a[2])}</b><small>${E(a[0])} / ${E(a[1])}</small><small>${E(a[3])}</small></button>`).join('')}</div></div>
   <div class="actions"><button class="btn sm" data-act="theme" type="button">Dark mode</button><button class="btn sm danger" data-act="resetDemo" type="button">Reset demo data</button></div></section></div>`;
  if(typeof renderInstallUI==='function')renderInstallUI();
}
ACT.fillLogin=el=>{$('#lu').value=el.dataset.u;$('#lp').value=el.dataset.p;$('#lp').focus()};
/* demo rate limit: 5 wrong passwords in 10 minutes locks that username for 10 minutes (the server does this per IP + user) */
const LOCK={};
FORM.login=(f,d)=>{
  const id=d.u.trim().toLowerCase();const now=Date.now();
  const l=LOCK[id]=(LOCK[id]||[]).filter(t=>now-t<6e5);if(l.length>=5){renderLogin('Too many wrong attempts. Try again in 10 minutes.');return}
  const st=db.students.find(s=>s.email&&s.email.toLowerCase()===id);
  const u=db.users.find(x=>x.active&&x.password===d.p&&(x.username.toLowerCase()===id||(x.email&&x.email.toLowerCase()===id)||(st&&x.studentId===st.id)));
  if(!u){const ex=db.users.find(x=>x.username.toLowerCase()===id||(x.email||'').toLowerCase()===id);l.push(now);ntFailed(id,!!ex);
    if(ex)log('Sign-in failed','User',ex.username,null,null,'Wrong password');ev('Auth','Sign-in failed',id,{status:'fail',who:id});save();renderLogin(ex&&!ex.active?'This account is switched off. Ask the office.':'Wrong login or password.');return}
  delete LOCK[id];sesSet(u.id);u.lastLoginAt=now;ui.route=u.role==='Student'?'shome':'dashboard';ui.tab={};ui.f={};
  log('Signed in','User',u.username,null,null,u.role);ev('Auth','Signed in',u.username+' · '+device());ntSync();save();
  if(u.mustChange){renderForceChange();return}
  setTimeout(()=>{if(typeof askNotifyGently==='function'&&cur())askNotifyGently()},1200);
  renderApp();
};
/* first login: the temporary password must be changed before anything else (spec §6.2) */
function renderForceChange(msg){
  const u=cur();document.body.classList.remove('portal');
  $('#root').innerHTML=`<div class="center-card"><div class="panel" style="max-width:440px;width:100%"><div class="brandline" style="margin-bottom:12px">${LOGO()}<b>${E(db.college.short)}</b></div>
   <h1 style="font-size:22px;margin:0 0 4px">Set your own password</h1><p class="muted" style="margin:0 0 14px">Welcome, ${E(u.name)}. You signed in with a temporary password. Choose a new one to continue.</p>
   <form data-form="forcePw" class="grid" style="gap:12px">${msg?`<div class="err" role="alert">${E(msg)}</div>`:''}
    ${F('p1','New password',{type:'password',req:true,attrs:'autocomplete="new-password" minlength="8"'})}${F('p2','Type it again',{type:'password',req:true,attrs:'autocomplete="new-password"'})}
    <p class="note" style="margin:0">At least 8 characters with a letter and a number.</p>
    <button class="btn primary big">Save and continue</button><button class="btn" type="button" data-act="logout">Sign out</button></form></div></div>`;
  $('#f_p1').focus();
}
const pwOk=p=>p.length>=8&&/[A-Za-z]/.test(p)&&/\d/.test(p);
FORM.forcePw=(f,d)=>{const u=cur();if(!pwOk(d.p1))return renderForceChange('Use at least 8 characters with a letter and a number.');if(d.p1!==d.p2)return renderForceChange('The two passwords are not the same.');if(d.p1===u.password)return renderForceChange('Choose a password different from the temporary one.');
  u.password=d.p1;u.mustChange=false;log('Password changed','User',u.username,null,null,'First login');save();renderApp();toast('Password saved. Welcome!');setTimeout(()=>typeof askInstall==='function'&&askInstall(),600)};
ACT.logout=()=>{const u=cur();if(u){log('Signed out','User',u.username);ev('Auth','Signed out',u.username)}save();sesDel();closeLayer();renderLogin();const h=$('.login-form h2');if(h){h.tabIndex=-1;softFocus(h)}};
ACT.resetDemo=()=>{const u=cur();if(u&&u.role!=='Super Admin')throw new Error('Only the Super Admin can reset the data');confirmBox('Reset demo data','All students, payments and changes in this browser will be replaced by fresh sample data.','Reset',()=>{seed();save();sesDel();closeLayer();renderLogin();toast('Demo data reset')},true)};

/* ---------- shell ---------- */
const ICONS={dashboard:'<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 9h8V3h-8z"/>',students:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
 fees:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M7 15h3"/>',notices:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
 audit:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
 shome:'<path d="M3 11l9-8 9 8v10H3z"/><path d="M9 21v-6h6v6"/>',sfees:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M7 15h3"/>',snotices:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',sprofile:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>'};
const NAV=[
 ['dashboard','Dashboard',()=>can('dashboard.view'),()=>viewDashboard()],
 ['students','Students',()=>can('students.view'),()=>viewStudents()],
 ['fees','Fee Collection',()=>can('fees.view'),()=>viewFees()],
 ['audit','Audit',()=>canAny('audit.view','activity.view'),()=>viewAudit()],
 ['notices','Notice Board',()=>can('notices.post'),()=>viewNotices()],
 ['settings','Settings',()=>canAny('settings.manage','roles.manage','fees.setup'),()=>viewSettings()]];
const SNAV=[['shome','Home',()=>true,()=>viewStudentHome()],['sfees','Fees',()=>true,()=>viewStudentFees()],['snotices','Notices',()=>true,()=>viewStudentNotices()],['sprofile','Profile',()=>true,()=>viewStudentProfile()]];
const isPortal=u=>isStudentUser(u);
const navFor=u=>u.role==='Student'?SNAV:NAV.filter(n=>n[2]());
const NAV_GROUP={dashboard:'Overview',students:'Office',fees:'Office',audit:'Office',notices:'Communication',settings:'System'};
const badgeCount=id=>{const u=cur();if(id==='snotices'&&u&&u.role==='Student')return unreadNotices(u);return 0};
function badgeFor(id){const n=badgeCount(id);return n?`<span class="badge" title="${n} unread">${n}</span>`:''}
const RAIL_KEY='npcte_erp_rail';const NAV_HIDDEN=new Set();
const ICON_MENU=IC('<path d="M4 6h16M4 12h16M4 18h16"/>'),ICON_PANEL=IC('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),ICON_X=IC('<path d="M6 6l12 12M18 6 6 18"/>');
const railMini=()=>{const p=lsGet(RAIL_KEY);return p?p==='mini':innerWidth<1100};
function navGroups(u){const items=navFor(u),map=new Map();items.forEach(n=>{const g=u.role==='Student'?'Student portal':NAV_GROUP[n[0]]||'More';if(!map.has(g))map.set(g,[]);map.get(g).push(n)});return[...map]}
function renderApp(){
  const u=cur();if(!u){renderLogin();return}if(u.mustChange){renderForceChange();return}
  const nav=navFor(u);if(!nav.find(n=>n[0]===ui.route))ui.route=nav[0][0];
  const mini=railMini(),portal=isPortal(u),s=portal?stu(u.studentId):null;
  const who=portal?E(s.enrol)+' · '+E(classLabel(s)):E(u.role);
  document.body.classList.remove('rail-lock');document.body.classList.toggle('portal',portal);
  $('#root').innerHTML=`<a class="skip" href="#page" data-act="skip">Skip to content</a><div class="app" data-rail="${E(mini?'mini':'open')}"><aside class="rail" id="rail" aria-label="Sidebar">
   <div class="rail-head"><div class="brand">${LOGO()}<div class="bt"><b>${E(db.college.short)} ERP</b><small>${E(db.college.trust)} · ${E(db.college.year)}</small></div></div>
    <button class="rail-toggle" data-act="railToggle" type="button" aria-expanded="${!mini}" aria-label="${mini?'Expand sidebar':'Collapse sidebar'}" title="${E(mini?'Expand sidebar':'Collapse sidebar')}">${ICON_PANEL}</button>
    <button class="rail-close" data-act="railClose" type="button" aria-label="Close menu">${ICON_X}</button></div>
   <nav class="nav" id="nav" aria-label="Main menu"></nav>
   <div class="rail-acct" role="group" aria-label="Your account"><div class="acct-row">
    <button class="me" data-act="profile" type="button" data-tip="View profile" aria-label="View profile, signed in as ${E(u.name)}"><span class="av">${E(initials(u.name))}</span><span class="mt"><b>${E(u.name)}</b><small>${who}</small></span></button>
    <button class="out" data-act="logout" type="button" data-tip="Sign out" aria-label="Sign out">${ICON_OUT}</button></div>
    <div class="rail-foot">Demo · data saved in this browser</div></div></aside>
   <div class="rail-scrim" data-act="railClose"></div>
   <main><div class="topbar"><button class="iconbtn menu-btn" data-act="railOpen" type="button" aria-label="Open menu" aria-controls="rail" aria-expanded="false">${ICON_MENU}</button>
    <div class="tb-brand">${LOGO()}<b>${E(db.college.short)}</b></div><div class="crumb" id="crumb"></div>
    <div class="tb-end">${portal?'':courseSwitch()}<span id="tbInstall" class="install-holder"></span>${bellHtml()}<button class="iconbtn" data-act="theme" type="button" title="Switch between light and dark theme" aria-label="Dark mode">${isDark()?ICON_SUN:ICON_MOON}<span class="lbl sr">${isDark()?'Light mode':'Dark mode'}</span></button>
    ${portal?'':`<button class="iconbtn" data-act="logout" type="button" title="Sign out" aria-label="Sign out">${ICON_OUT}</button>`}</div></div>
    <div id="installSlot" class="install-holder"></div><div id="notifySlot" class="install-holder"></div><div id="page"></div></main>
   ${portal?`<nav class="btabs" id="btabs" aria-label="Student menu"></nav>`:''}</div>`;
  renderNav();renderPage();playEnter('enter');
  if(typeof renderInstallUI==='function')renderInstallUI();renderNotifyBar();
  if(userDriven&&(!document.activeElement||document.activeElement===document.body))focusH1();
}
function renderNav(){
  const u=cur(),nv=$('#nav');if(!nv)return;
  keepFocus(nv,()=>{nv.innerHTML=navGroups(u).map(([g,items],i)=>`<div class="ng" role="group" aria-labelledby="gl${i}"><div class="gl" id="gl${i}">${E(g)}</div>${items.map(n=>{const bc=badgeCount(n[0]);return`<button data-act="nav" data-id="${E(n[0])}" data-tip="${E(n[1])}" aria-label="${E(n[1])}${bc?', '+bc+' unread':''}" ${ui.route===n[0]?'aria-current="page"':''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n[0]]||ICONS.dashboard}</svg><span class="nl">${E(n[1])}</span>${badgeFor(n[0])}</button>`}).join('')}</div>`).join('')});
  const bt=$('#btabs');if(bt)bt.innerHTML=SNAV.map(n=>`<button data-act="nav" data-id="${E(n[0])}" ${ui.route===n[0]?'aria-current="page"':''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n[0]]}</svg><span>${E(n[1])}</span>${badgeFor(n[0])}</button>`).join('');
  const cur_=navFor(u).find(x=>x[0]===ui.route);
  const cr=$('#crumb');if(cr)cr.textContent=cur_?cur_[1]:'';
  if(cur_)document.title=cur_[1]+' · '+db.college.short+' ERP';
}
function placeTip(e){const b=e.target.closest&&e.target.closest('.app[data-rail=mini] .nav button[data-tip]');if(!b)return;const r=b.getBoundingClientRect();b.style.setProperty('--tipx',(r.right+10)+'px');b.style.setProperty('--tipy',(r.top+r.height/2)+'px')}
document.addEventListener('pointerover',placeTip);document.addEventListener('focusin',placeTip);
function railSet(open){
  const a=$('.app');if(!a)return;a.classList.toggle('rail-open',open);document.body.classList.toggle('rail-lock',open);
  const m=$('.menu-btn'),r=$('#rail');if(m)m.setAttribute('aria-expanded',String(open));
  if(r){if(open&&phoneWidth()){r.setAttribute('role','dialog');r.setAttribute('aria-modal','true')}else{r.removeAttribute('role');r.removeAttribute('aria-modal')}}
  syncInert();
  if(open){const f=$('#nav [aria-current]')||$('#nav button');if(f)f.focus({preventScroll:true})}else if(m&&a._viaMenu){a._viaMenu=false;try{m.focus({preventScroll:true})}catch(e){}}
}
function railClose(){railSet(false)}
ACT.railOpen=()=>{const a=$('.app');if(a)a._viaMenu=true;railSet(true)};
ACT.railClose=railClose;
ACT.railToggle=()=>{const a=$('.app');if(!a)return;const mini=a.dataset.rail!=='mini';a.dataset.rail=mini?'mini':'open';lsSet(RAIL_KEY,mini?'mini':'open');const b=$('.rail-toggle');if(b){b.setAttribute('aria-expanded',String(!mini));const t=mini?'Expand sidebar':'Collapse sidebar';b.setAttribute('aria-label',t);b.setAttribute('title',t)}};
try{matchMedia('(min-width:821px)').addEventListener('change',e=>{if(e.matches)railClose()})}catch(e){}
ACT.profile=()=>{const u=cur();railClose();if(u.role==='Student'){go('sprofile');return}drawer(staffProfileHtml(),false,'Your profile')};
ACT.skip=()=>{if(!focusH1()){const pg=$('#page');if(pg){pg.tabIndex=-1;softFocus(pg)}}};
/* course switch in the top bar: shown when the login has more than one course */
function courseSwitch(){const my=myCourses();if(my.length<2)return'';const p=pickedCourse();
  return`<label class="cswitch" title="Show data for"><span class="sr">Show data for</span><select data-change="pickCourse" aria-label="Show data for course"><option value="">${my.length===db.courses.length?'All courses':'All my courses'}</option>${my.map(id=>`<option value="${E(id)}" ${p===id?'selected':''}>${E(course(id).name)}</option>`).join('')}</select></label>`}
CHG.pickCourse=el=>{setPickedCourse(el.value);ui.f={};ui.col=null;renderApp();toast('Showing '+scopeLabel())};
function renderPage(){const u=cur();if(!u)return renderLogin();let n=navFor(u).find(x=>x[0]===ui.route);if(!n){n=navFor(u)[0];ui.route=n[0]}const pg=$('#page');if(!pg)return renderApp();keepFocus(pg,()=>{pg.innerHTML=n?n[3]():''});renderNav()}
function go(route,tab){if(tab)ui.tab[route]=tab;const prev=ui.route;ui.route=route;ev('Page','Opened page',humanize(route)+(ui.tab[route]?' › '+humanize(ui.tab[route]):''));renderPage();window.scrollTo(0,0);playEnter('enter');const a=document.activeElement;if(route!==prev||!a||a===document.body)focusH1()}
ACT.nav=el=>{closeLayer();railClose();go(el.dataset.id)};
function refresh(){save();renderPage()}
/* drill-down links: data-to=route, data-sub=tab, data-f=JSON filters */
ACT.goto=el=>{closeLayer();const r=el.dataset.to;if(el.dataset.f){try{ui.f[r+(el.dataset.sub?'.'+el.dataset.sub:'')]=JSON.parse(el.dataset.f)}catch(e){}}go(r,el.dataset.sub)};
