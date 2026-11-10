/* =====================================================================
   Notifications (spec §10). In the real app the server saves a Notification row,
   emits it over Socket.IO to the right rooms and sends a Web Push.
   In this demo: a row is saved, every other open tab of the same browser
   gets it at once (storage event = the "socket"), shows a toast, plays a
   short sound and, when the tab is in the background, a system popup.
   ===================================================================== */
const NT_MAX=80;
const NT_CATS=[
 {k:'payment',l:'Payment received',g:'fees'},{k:'payfail',l:'Payment failed',g:'fees'},{k:'cancel',l:'Receipt cancelled',g:'fees'},
 {k:'datechange',l:'Invoice date changed',g:'fees'},{k:'reminder',l:'Fee reminder',g:'fees'},{k:'due',l:'Fee due / overdue',g:'fees'},
 {k:'notice',l:'Notice',g:'notices'},{k:'credentials',l:'Login details',g:'other'},{k:'mailfail',l:'Email failed',g:'other'},
 {k:'enquiry',l:'Admission enquiry',g:'other'},{k:'security',l:'Security',g:'other'},{k:'system',l:'System',g:'other'}];
const ntCat=k=>NT_CATS.find(c=>c.k===k)||{k,l:'Notification',g:'other'};
function ntInit(){if(!Array.isArray(db.notifs))db.notifs=[]}
/* rooms, as in the Socket.IO design: user:<id>, role:<role>, course:<code>, sem:<course>-<n>, college */
function audienceStudents(a){
  const act=db.students.filter(s=>s.status==='ACTIVE');
  if(!a||a.type==='all')return act;
  if(a.type==='course')return act.filter(s=>s.course===a.course);
  if(a.type==='sem')return act.filter(s=>s.course===a.course&&s.sem===+a.sem);
  if(a.type==='students')return act.filter(s=>(a.ids||[]).includes(s.id));
  return[];
}
const audienceLabel=a=>!a||a.type==='all'?'All students':a.type==='course'?course(a.course).name+' (all semesters)':a.type==='sem'?`${course(a.course).name} Sem ${a.sem}`:a.type==='students'?((a.ids||[]).length===1?(stu(a.ids[0])||{}).name||'1 student':(a.ids||[]).length+' students'):'—';
function ntRecipients(o){
  const out=new Map();const act=cur();
  (o.users||[]).forEach(id=>{const u=db.users.find(x=>x.id===id&&x.active);if(u)out.set(u.id,u)});
  /* staff only hear about students of their own courses */
  const oc=o.course||(o.sid&&stu(o.sid)?stu(o.sid).course:'');
  (o.roles||[]).forEach(r=>db.users.filter(u=>u.active&&u.role===r&&(!oc||u.role==='Super Admin'||(u.courses||[]).includes(oc))).forEach(u=>out.set(u.id,u)));
  const sids=o.students||(o.audience?audienceStudents(o.audience).map(s=>s.id):[]);
  sids.forEach(id=>{const s=stu(id);const u=s&&db.users.find(x=>x.id===s.userId&&x.active);if(u)out.set(u.id,u)});
  if(act&&!o.self)out.delete(act.id);
  return[...out.values()];
}
/* ntLive is switched on after boot: from then on every new notification pops up at once in this tab
   (in-app card + sound + browser / phone popup), and the person who did the action gets a browser popup too */
let ntLive=false;
/* one browser popup per action for the person who did it (an action can notify several groups) */
let actorPopT=0,actorPopV=null;const actorPop=(t,x)=>{actorPopV=[t,x];clearTimeout(actorPopT);actorPopT=setTimeout(()=>{showPopup(actorPopV[0],actorPopV[1],'a'+Date.now(),'/')},250)};
function notify(cat,title,text,o={}){
  ntInit();const rs=ntRecipients(o);const act=cur();
  if(!rs.length){if(ntLive&&act&&!o.key)actorPop(title,text);return 0}let n=0;
  rs.forEach(u=>{
    const key=o.key?o.key+'|'+u.id:'';if(key&&db.notifs.some(x=>x.key===key))return;
    const portal=u.role==='Student';
    db.notifs.unshift({id:uid('nt'),ts:o.ts||Date.now(),uid:u.id,k:cat,t:title,x:text||'',tone:o.tone||'info',route:portal?(o.portal||''):(o.staff||''),tab:portal?'':(o.tab||''),sid:o.sid||'',read:false,key,by:act?act.name:'System'});n++;
  });
  if(ntLive&&act){const mine=db.notifs.slice(0,n).filter(x=>x.uid===act.id);if(mine.length)setTimeout(()=>deliverLive(mine),0);else if(!o.key)actorPop(title,text)}
  if(n)ntPrune();
  if(n&&typeof updateBell==='function')updateBell();
  return n;
}
function ntPrune(){const seen={};db.notifs=db.notifs.filter(x=>{seen[x.uid]=(seen[x.uid]||0)+1;return seen[x.uid]<=NT_MAX})}
const ntUnread=u=>u?db.notifs.reduce((a,n)=>a+(n.uid===u.id&&!n.read?1:0),0):0;
const ntMine=u=>u?db.notifs.filter(n=>n.uid===u.id):[];
const ago=ts=>{const s=Math.max(0,(Date.now()-ts)/1000);if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' h ago';const d=Math.floor(s/86400);return d===1?'yesterday':d<7?d+' days ago':fmtD(istDate(ts))};

/* automatic fee alerts (spec §5.5): X days before the due date and when overdue */
function ntSync(){
  if(!db||!db.students)return;ntInit();const T=today();const X=+db.settings.reminderDays||7;
  db.students.filter(s=>s.status==='ACTIVE').forEach(s=>{
    feeSum(s).sems.forEach(m=>{
      if(!m.started||!(m.due>0)||!m.dueDate)return;const left=diffDays(m.dueDate,T);
      if(left<0)notify('due',`Semester ${m.sem} fee is overdue`,`${inr(m.due)} was due on ${fmtD(m.dueDate)}. Please pay at the office or with UPI.`,{students:[s.id],key:`over:${s.id}:${m.sem}`,tone:'bad',portal:'sfees',self:true});
      else if(left<=X)notify('due',`Semester ${m.sem} fee due ${left===0?'today':left===1?'tomorrow':'in '+left+' days'}`,`${inr(m.due)} is due on ${fmtD(m.dueDate)}.`,{students:[s.id],key:`soon:${s.id}:${m.sem}`,tone:'warn',portal:'sfees',self:true});
    });
  });
  ntPrune();
}
function ntSeed(){ntInit();db.notices.slice().reverse().forEach(n=>notify('notice',n.title,String(n.body||'').slice(0,140),{audience:n.audience,key:'notice:'+n.id,portal:'snotices',staff:'notices',self:true,ts:n.publishAt}));ntSync()}

/* repeated wrong passwords */
const ntFails={};
function ntFailed(un,known){
  const k=String(un||'').toLowerCase();if(!k)return;const now=Date.now();const a=(ntFails[k]=(ntFails[k]||[]).filter(t=>now-t<9e5));a.push(now);
  if(a.length>=3){notify('security',`${a.length} failed sign-ins for “${k}”`,known?'Someone may be guessing this password.':'No login has this name.',{roles:['Super Admin'],key:`sec:${k}:${Math.floor(now/9e5)}`,tone:'bad',staff:'audit',tab:'activity',self:true});save()}
}

/* ---------- live delivery: sound + system popup ---------- */
let audioCtx=null,soundReady=false;
['pointerdown','keydown'].forEach(t=>document.addEventListener(t,()=>{soundReady=true},{capture:true,once:true}));
const muted=()=>lsGet('npcte_mute')==='1';
function ding(){
  if(!soundReady||muted())return; /* browsers allow sound only after the first tap or key press */
  try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();const t=audioCtx.currentTime;
    [[880,0],[1320,.12]].forEach(([f,d])=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(.18,t+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d+.25);o.connect(g);g.connect(audioCtx.destination);o.start(t+d);o.stop(t+d+.3)})}catch(e){}
}
/* phone / desktop popup. Android only allows popups through the service worker (new Notification() throws there),
   so the service worker is always used when it is ready. vibrate + renotify make Android treat it as an alert, not a silent entry. */
const POP_OPTS=(body,tag,link)=>({body:body||'',tag,renotify:true,requireInteraction:false,silent:false,vibrate:[200,100,200],icon:'/icons/icon-192.png',badge:'/icons/badge-96.png',timestamp:Date.now(),data:{link:link||'/'}});
async function showPopup(title,body,tag,link){
  if(!('Notification' in window)||Notification.permission!=='granted')return false;
  try{const reg=navigator.serviceWorker&&await Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),3000))]);
    if(reg){await reg.showNotification(title,POP_OPTS(body,tag,link));return true}
    const x=new Notification(title,POP_OPTS(body,tag,link));x.onclick=()=>{window.focus();x.close()};return true}catch(e){return false}}
function sysPopup(n){showPopup(n.t,n.x,n.id)}
/* "Test notification" on every profile: shows a popup now, or after 10 s so the phone can be locked first */
function notifyPanelHtml(){const perm=!('Notification' in window)?'unsupported':Notification.permission;
  return`<p class="note" style="margin:0 0 8px">Popups for payments, fee alerts and notices on this device.</p>
   <div class="rline"><span>Popups on this device</span><b>${perm==='granted'?'On':perm==='denied'?'Blocked in phone settings':perm==='unsupported'?'Not supported here':'Off'}</b></div>
   ${perm==='default'?'<button class="btn primary" data-act="askNotify">Turn on notifications</button>':''}
   <div class="actions" style="margin-top:8px">${perm==='granted'?'<button class="btn" data-act="testPop" data-d="0">Test notification now</button><button class="btn" data-act="testPop" data-d="10">Test in 10 s (close the app)</button>':''}<button class="btn" data-act="notifCheck">Check this device</button></div>
   ${perm==='denied'?'<p class="note">Open the phone Settings → Apps → NPCTE (or your browser) → Notifications, and allow them.</p>':''}
   <label class="chk" style="margin-top:8px"><input type="checkbox" data-change="mute" ${muted()?'':'checked'}> Sound for live notifications</label>
   <details class="note" style="margin-top:8px"><summary>No popup on the lock screen?</summary><p>Android: Settings → Apps → NPCTE (or Chrome / Samsung Internet) → Notifications → turn on <b>Pop on screen</b> / <b>Alert</b> and <b>Lock screen</b>. Also allow the app in Battery → <b>Unrestricted</b>.<br>iPhone: add the app to the Home Screen from Safari first; then Settings → Notifications → NPCTE → Lock Screen + Banners.</p></details>`}
/* a toast that names the notification and opens it on tap */
function liveToast(n){
  const box=document.getElementById('livebox')||(()=>{const b=document.createElement('div');b.id='livebox';b.setAttribute('aria-live','polite');document.body.appendChild(b);return b})();
  const el=document.createElement('button');el.type='button';el.className='live '+(n.tone||'info');el.dataset.act='ntOpen';el.dataset.id=n.id;
  el.innerHTML=`<span class="ldot" aria-hidden="true"></span><span><b>${E(n.t)}</b>${n.x?`<small>${E(n.x)}</small>`:''}</span>`;
  box.prepend(el);while(box.children.length>3)box.lastChild.remove();setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),300)},6500);
}
function deliverLive(list){if(!list.length)return;list.slice(0,3).forEach(liveToast);ding();list.slice(0,3).forEach(sysPopup)}
