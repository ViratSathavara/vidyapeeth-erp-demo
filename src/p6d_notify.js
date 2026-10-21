/* =====================================================================
   Notifications: bell, inbox drawer, and the rules table in Settings
   ===================================================================== */
const BELL_SVG='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
function bellHtml(){const n=ntUnread(cur());return`<button class="iconbtn bell" id="bell" data-act="bell" type="button" aria-label="${n?`Notifications, ${n} unread`:'Notifications'}" title="Notifications">${BELL_SVG}<span class="bdg" id="bellN" ${n?'':'hidden'}>${n>99?'99+':n}</span></button>`}
let ntKnown=null;
function updateBell(){
  const u=cur();ntKnown=new Set(ntMine(u).map(n=>n.id));
  const b=$('#bell'),g=$('#bellN');if(!b||!g||!u)return;const n=ntUnread(u);
  g.textContent=n>99?'99+':String(n);g.hidden=!n;b.setAttribute('aria-label',n?`Notifications, ${n} unread`:'Notifications');
}
const NT_TONE_LABEL={good:'Good news',warn:'Needs attention',bad:'Problem',info:''};
function ntItem(n){
  const c=ntCat(n.k)||{l:'Notification'};
  return`<button type="button" class="nt ${n.read?'':'unread'} ${n.tone||'info'}" data-act="ntOpen" data-id="${E(n.id)}"><span class="ntdot" aria-hidden="true"></span><span class="ntb"><b>${E(n.t)}</b>${n.x?`<span class="ntx">${E(n.x)}</span>`:''}<small>${E(c.l)} · ${E(ago(n.ts))}${n.read?'':' · <em>New</em>'}</small></span></button>`;
}
function ntHtml(){
  const u=cur();const st=ui.nt=ui.nt||{f:'all',cat:'',n:25};const all=ntMine(u);const un=all.filter(n=>!n.read).length;
  const list=all.filter(n=>(st.f==='all'||!n.read)&&(!st.cat||n.k===st.cat));const shown=list.slice(0,st.n);
  const cats=[...new Set(all.map(n=>n.k))].map(k=>[k,(ntCat(k)||{l:k}).l]);
  return`<button class="btn x" data-act="close">Close</button><h2>Notifications</h2>
   <p class="muted" style="margin:2px 0 12px">${un?`${un} unread`:'You are all caught up'}${all.length?` · ${all.length} in total`:''}</p>
   <div class="tabs" role="tablist" style="margin-bottom:10px"><button role="tab" aria-selected="${st.f==='all'}" data-act="ntF" data-f="all">All</button><button role="tab" aria-selected="${st.f==='unread'}" data-act="ntF" data-f="unread">Unread${un?` (${un})`:''}</button></div>
   <div class="actions" style="margin-bottom:12px;align-items:center">${cats.length>1?`<select aria-label="Type of notification" data-change="ntCat" style="flex:1;min-width:0"><option value="">All types</option>${cats.map(([k,l])=>`<option value="${E(k)}" ${st.cat===k?'selected':''}>${E(l)}</option>`).join('')}</select>`:''}<button class="btn" data-act="ntReadAll" ${un?'':'disabled'}>Mark all as read</button></div>
   <div class="ntlist">${shown.length?shown.map(ntItem).join(''):`<p class="note">${all.length?'Nothing matches this filter.':'No notifications yet. Payments, notices, dues and approvals for your role will show up here.'}</p>`}</div>
   ${list.length>shown.length?`<div class="actions" style="justify-content:center;margin-top:12px"><button class="btn" data-act="ntMore">Show ${Math.min(25,list.length-shown.length)} older</button></div>`:''}`;
}
const ntRedraw=()=>{const d=$('.drawer');if(!d||!/^Notifications/.test(d.querySelector('h2')?.textContent||''))return;const sc=d.scrollTop;d.innerHTML=ntHtml();d.scrollTop=sc};
ACT.bell=()=>{ui.nt={f:'all',cat:'',n:25};drawer(ntHtml());updateBell()};
ACT.ntF=el=>{ui.nt.f=el.dataset.f;ui.nt.n=25;ntRedraw()};
CHG.ntCat=el=>{ui.nt.cat=el.value;ui.nt.n=25;ntRedraw()};
ACT.ntMore=()=>{ui.nt.n+=25;ntRedraw()};
ACT.ntReadAll=()=>{const u=cur();let n=0;db.notifs.forEach(x=>{if(x.uid===u.id&&!x.read){x.read=true;n++}});if(n){save();updateBell()}ntRedraw();toast(n?`${n} marked as read`:'Nothing to mark')};
ACT.ntOpen=el=>{
  const u=cur();const n=db.notifs.find(x=>x.id===el.dataset.id&&x.uid===u.id);if(!n)return;
  if(!n.read){n.read=true;save();updateBell()}
  closeLayer();
  if(n.route&&navFor(u).some(x=>x[0]===n.route)){if(n.tab)ui.tab[n.route]=n.tab;go(n.route);if(n.open==='student'&&n.sid&&can('students.view')&&db.students.some(s=>s.id===n.sid))setTimeout(()=>openStudent(n.sid),60)}
  else renderPage();
};

/* a change made in another tab: update the bell and say so */
window.addEventListener('storage',e=>{
  if(e.key!==LS_KEY||!e.newValue)return;const u=cur();if(!u)return;
  let n;try{n=JSON.parse(e.newValue)}catch(x){return}if(!n||!Array.isArray(n.notifs))return;
  if(!ntKnown)ntKnown=new Set(ntMine(u).map(x=>x.id));
  const fresh=n.notifs.filter(x=>x.uid===u.id&&!x.read&&!ntKnown.has(x.id));
  setTimeout(()=>{updateBell();if($('.drawer')&&/Notifications/.test($('.drawer h2')?.textContent||''))ntRedraw();if(fresh.length)toast(fresh.length===1?'New notification: '+fresh[0].t:fresh.length+' new notifications')},40);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden||!cur())return;const n0=db.notifs.length;ntSync();if(db.notifs.length!==n0){save();updateBell()}});

/* ---------- Settings: who is notified about what ---------- */
function ntRulesPanel(){
  if(!cur()||cur().role!=='Super Admin')return'';
  return setCard('notify','bell','Notification rules','Choose who is notified about each event. Everyone sees theirs under the bell at the top. The person who does something is never notified about their own action, and the people directly concerned (the one who asked for a concession, the owner of a login) are always told.',`
   <div class="actions" style="margin-bottom:12px"><button class="btn" data-act="ntTest">Send me a test notification</button><button class="btn" data-act="ntRulesReset">Restore default rules</button></div>
   <div class="tablewrap"><table class="matrix"><thead><tr><th>Event</th>${NT_ROLES.map(r=>`<th>${E(r)}</th>`).join('')}</tr></thead><tbody>
   ${NT_CATS.map(c=>`<tr><td><div><b>${E(c.l)}</b><small style="display:block;color:var(--muted);font-weight:400;margin-top:2px">${E(c.d)}</small></div></td>${NT_ROLES.map(r=>`<td><input type="checkbox" aria-label="${E(r)}: ${E(c.l)}" ${ntOn(c.k,r)?'checked':''} data-change="ntRule" data-c="${c.k}" data-r="${E(r)}"></td>`).join('')}</tr>`).join('')}
   </tbody></table></div>`,'wide');
}
CHG.ntRule=el=>{
  if(!cur()||cur().role!=='Super Admin')throw new Error('Only the Super Admin can change notification rules');
  const c=ntCat(el.dataset.c);if(!c||!NT_ROLES.includes(el.dataset.r))throw new Error('Unknown notification rule');
  db.settings.notify[c.k][el.dataset.r]=!!el.checked;log('Notification rules changed',`${c.l}: ${el.dataset.r} ${el.checked?'will be notified':'will not be notified'}`);save();
};
ACT.ntRulesReset=()=>{
  if(!cur()||cur().role!=='Super Admin')throw new Error('Only the Super Admin can change notification rules');
  confirmBox('Restore default rules','Every notification type goes back to its original recipients.','Restore',()=>{db.settings.notify=NT_DEFAULTS();log('Notification rules changed','Defaults restored');save();renderPage();toast('Default rules restored')});
};
ACT.ntTest=()=>{
  const u=cur();if(!u||u.role!=='Super Admin')throw new Error('Only the Super Admin can send a test');
  notify('system','Test notification',`Sent by you at ${new Date().toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})}. Tap to open Settings.`,{uids:[u.id],roles:[],self:true,tone:'good',go:{staff:['settings']}});save();toast('Test sent. Open the bell at the top.');
};
