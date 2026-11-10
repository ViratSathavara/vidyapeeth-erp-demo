/* =====================================================================
   Bell, inbox (All / Unread / Fees / Notices), boot and live sync between tabs
   ===================================================================== */
const BELL_SVG='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
function bellHtml(){const n=ntUnread(cur());return`<button class="iconbtn bell" id="bell" data-act="bell" type="button" aria-label="${n?`Notifications, ${n} unread`:'Notifications'}" title="Notifications">${BELL_SVG}<span class="bdg" id="bellN" ${n?'':'hidden'}>${n>99?'99+':n}</span></button>`}
let ntKnown=null;
function updateBell(){
  const u=cur();ntKnown=new Set(ntMine(u).map(n=>n.id));const b=$('#bell'),g=$('#bellN');if(!b||!g||!u)return;const n=ntUnread(u);
  g.textContent=n>99?'99+':String(n);g.hidden=!n;b.setAttribute('aria-label',n?`Notifications, ${n} unread`:'Notifications');
  if(typeof renderNav==='function'&&$('#nav'))renderNav();
  try{if(navigator.setAppBadge)n?navigator.setAppBadge(n):navigator.clearAppBadge()}catch(e){}
}
function ntItem(n){const c=ntCat(n.k);return`<button type="button" class="nt ${n.read?'':'unread'} ${n.tone||'info'}" data-act="ntOpen" data-id="${E(n.id)}"><span class="ntdot" aria-hidden="true"></span><span class="ntb"><b>${E(n.t)}</b>${n.x?`<span class="ntx">${E(n.x)}</span>`:''}<small>${E(c.l)} · ${E(ago(n.ts))}${n.read?'':' · <em>New</em>'}</small></span></button>`}
function ntHtml(){
  const u=cur();const st=ui.nt=ui.nt||{f:'all',n:30};const all=ntMine(u);const un=all.filter(n=>!n.read).length;
  const list=all.filter(n=>st.f==='all'||(st.f==='unread'?!n.read:ntCat(n.k).g===st.f));const shown=list.slice(0,st.n);
  return`<button class="btn x" data-act="close">Close</button><h2>Notifications</h2><p class="muted" style="margin:2px 0 12px">${un?`${un} unread`:'You are all caught up'}</p>
   <div class="tabs" role="tablist" style="margin-bottom:10px">${[['all','All'],['unread','Unread'+(un?` (${un})`:'')],['fees','Fees'],['notices','Notices']].map(([k,l])=>`<button role="tab" aria-selected="${st.f===k}" data-act="ntF" data-f="${k}">${E(l)}</button>`).join('')}</div>
   <div class="actions" style="margin-bottom:12px"><button class="btn" data-act="ntReadAll" ${un?'':'disabled'}>Mark all as read</button><label class="chk"><input type="checkbox" data-change="mute" ${muted()?'':'checked'}> Sound</label></div>
   <div class="ntlist">${shown.length?shown.map(ntItem).join(''):`<p class="note">${all.length?'Nothing here.':'No notifications yet.'}</p>`}</div>
   ${list.length>shown.length?`<div class="actions" style="justify-content:center;margin-top:12px"><button class="btn" data-act="ntMore">Show older</button></div>`:''}`;
}
const ntRedraw=()=>{const d=$('.drawer');if(!d||!/^Notifications/.test(d.querySelector('h2')?.textContent||''))return;const sc=d.scrollTop;keepFocus(d,()=>{d.innerHTML=ntHtml()});d.scrollTop=sc};
ACT.bell=()=>{ui.nt={f:'all',n:30};drawer(ntHtml(),false,'Notifications');updateBell()};
ACT.ntF=el=>{ui.nt.f=el.dataset.f;ui.nt.n=30;ntRedraw()};
ACT.ntMore=()=>{ui.nt.n+=30;ntRedraw()};
ACT.ntReadAll=()=>{const u=cur();let n=0;db.notifs.forEach(x=>{if(x.uid===u.id&&!x.read){x.read=true;n++}});if(n){save();updateBell()}ntRedraw();toast(n?`${n} marked as read`:'Nothing to mark')};
ACT.ntOpen=el=>{
  const u=cur();const n=db.notifs.find(x=>x.id===el.dataset.id&&x.uid===u.id);if(!n)return;el.closest('#livebox')&&el.remove();
  if(!n.read){n.read=true;save();updateBell()}closeLayer();
  if(n.route&&navFor(u).some(x=>x[0]===n.route)){go(n.route,n.tab||undefined);if(n.sid&&can('students.view')&&stu(n.sid))setTimeout(()=>openStudent(n.sid),60)}else renderPage();
};

/* ---------- live sync: another tab saved -> this tab updates, toasts, rings, pops up ---------- */
window.addEventListener('storage',e=>{
  if(e.key!==LS_KEY||!e.newValue)return;let n;try{n=JSON.parse(e.newValue)}catch(x){return}if(!n||n.ver!==DB_VER)return;
  const u0=cur();const known=ntKnown||new Set(ntMine(u0).map(x=>x.id));
  db=n;if(typeof PAY_ID!=='undefined'&&PAY_ID){renderPayPage(PAY_ID);return}const u=cur();if(!u){if(!$('form[data-form=login]'))renderLogin();return}
  const fresh=ntMine(u).filter(x=>!x.read&&!known.has(x.id));
  if($('#page')){const busy=$('#layer').innerHTML||$('#dlg').innerHTML||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');if(!busy)renderPage();else if($('.drawer')&&/^Notifications/.test($('.drawer h2')?.textContent||''))ntRedraw()}
  updateBell();deliverLive(fresh);
});
/* coming back to the tab (= socket reconnect): sync anything missed since last seen */
document.addEventListener('visibilitychange',()=>{if(document.hidden||!cur()||(typeof PAY_ID!=='undefined'&&PAY_ID))return;const raw=lsGet(LS_KEY);if(raw){try{const n=JSON.parse(raw);if(n&&n.ver===DB_VER)db=n}catch(e){}}const n0=db.notifs.length;ntSync();if(db.notifs.length!==n0)save();updateBell();if($('#page')&&!$('#layer').innerHTML&&!$('#dlg').innerHTML)renderPage()});

/* ---------- boot ---------- */
load();applyTheme();
const PAY_ID=new URLSearchParams(location.search).get('pay');
if(PAY_ID)renderPayPage(PAY_ID);else if(cur()){ntSync();save();renderApp()}else renderLogin();
setTimeout(()=>{ntLive=true},1500);
themeLabels();new MutationObserver(themeLabels).observe($('#root'),{childList:true,subtree:true});try{matchMedia('(prefers-color-scheme:dark)').addEventListener('change',themeLabels)}catch(e){}
