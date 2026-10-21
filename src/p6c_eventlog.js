/* =====================================================================
   Event Log (Super Admin only): everything every role does, in one place
   ===================================================================== */
const EV_CATS=[['Auth','Sign-ins and sign-outs'],['Page','Pages and tabs opened'],['Click','Buttons clicked'],['Change','Fields and switches changed'],['Form','Forms saved or refused'],['Audit','Business actions (fees, students, settings)'],['Email','Receipt emails'],['Error','Errors']];
const EV_NOISE=['Page','Click','Change'];
const evTone={Auth:'acc',Error:'bad',Audit:'good',Email:'warn',Form:'',Page:'',Click:'',Change:''};
const fmtTs=ts=>{const d=new Date(ts);return fmtD(isoOf(d)).replace(/ \d{4}$/,'')+', '+d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',second:'2-digit'})};
const evF=()=>ui.f.ev=ui.f.ev||{q:'',role:'',user:'',cat:'',status:'',from:'',to:'',quiet:false,limit:100};
function evAll(){evFlush();return evRead()}
function evFilter(list,f){
  const q=f.q.trim().toLowerCase();
  return list.filter(e=>(!f.role||e.r===f.role)&&(!f.user||(f.user==='_none'?!e.uid:e.uid===f.user))&&(!f.cat||e.c===f.cat)&&(!f.status||e.s===f.status)
    &&(!f.from||isoOf(new Date(e.ts))>=f.from)&&(!f.to||isoOf(new Date(e.ts))<=f.to)&&(!f.quiet||!EV_NOISE.includes(e.c))
    &&(!q||(e.n+' '+e.un+' '+e.r+' '+e.c+' '+e.a+' '+e.d+' '+e.p).toLowerCase().includes(q)));
}
const evWhere=e=>{const n=NAV.concat(PNAV,SNAV).find(x=>x[0]===e.p);return (n?n[1]:e.p||'Login')+' · '+e.v};
const evRow=e=>`<tr class="click" data-act="evOpen" data-id="${E(e.id)}"><td class="mono evt">${E(fmtTs(e.ts))}</td>
  <td><div class="who"><div class="av">${E(initials(e.n))}</div><div>${E(e.n)}<br><small class="muted">${E(e.r==='-'?'':e.r)}${e.un?(e.r==='-'?'':' · ')+E(e.un):''}</small></div></div></td>
  <td>${pill(e.c,evTone[e.c]||'')}</td><td><b>${E(e.a)}</b>${e.x>1?` <small class="muted">×${e.x}</small>`:''}</td><td style="white-space:normal;min-width:150px">${E(e.d)}</td>
  <td>${e.s==='fail'?pill('Failed','bad'):pill('OK','good')}</td><td>${E(evWhere(e))}</td></tr>`;
function evRowsHtml(){
  const f=evF(),all=evAll(),m=evFilter(all,f),shown=m.slice(0,f.limit);
  return{count:`${m.length.toLocaleString('en-IN')} matching of ${all.length.toLocaleString('en-IN')} stored`,rows:shown.map(evRow).join('')||'<tr><td colspan="7" class="empty">No events match these filters.</td></tr>',more:m.length>shown.length,left:m.length-shown.length};
}
function evStats(all){
  const T=today(),day=all.filter(e=>isoOf(new Date(e.ts))===T);
  return{today:day.length,signins:day.filter(e=>e.c==='Auth'&&e.a==='Signed in').length,people:new Set(day.filter(e=>e.uid).map(e=>e.uid)).size,failed:day.filter(e=>e.s==='fail').length,total:all.length};
}
function viewEventLog(){
  if(!cur()||cur().role!=='Super Admin')return head('Event Log','Only the Super Admin can open this page.');
  const t=ui.tab.eventlog||'timeline',all=evAll(),st=evStats(all);
  const body=t==='people'?evPeople(all):evTimeline(all);
  return head('Event Log','Every sign-in, page opened, click, form, change, email and error from every role, newest first. The Audit Log keeps only business actions.',
    `<button class="btn" data-act="evExport">Export CSV</button><button class="btn danger" data-act="evClear">Clear log</button>`)+
  `<div class="kpis"><div class="kpi"><span class="label">Events today</span><div class="v">${st.today.toLocaleString('en-IN')}</div><div class="s">${st.total.toLocaleString('en-IN')} stored in total</div></div>
   <div class="kpi"><span class="label">Sign-ins today</span><div class="v">${st.signins}</div><div class="s">All roles</div></div>
   <div class="kpi"><span class="label">People active today</span><div class="v">${st.people}</div><div class="s">Different logins</div></div>
   <div class="kpi"><span class="label">Failed today</span><div class="v" ${st.failed?'style="color:var(--bad)"':''}>${st.failed}</div><div class="s">Wrong passwords, refused forms, errors</div></div></div>`+
  tabsBar('eventlog',[['timeline','Timeline'],['people','People']],t)+body;
}
function evTimeline(all){
  const f=evF(),r=evRowsHtml();
  const users=[];const seen=new Set();all.forEach(e=>{const k=e.uid||'_none';if(!seen.has(k)){seen.add(k);users.push([k,e.uid?e.n+' ('+e.r+')':'Not signed in / unknown'])}});users.sort((a,b)=>a[1].localeCompare(b[1]));
  const sel=(k,label,opts,val)=>`<div class="field"><label class="label" for="ev_${k}">${label}</label><select id="ev_${k}" data-change="evF" data-k="${k}">${opts.map(o=>{const[v,l]=Array.isArray(o)?o:[o,o];return`<option value="${E(v)}" ${String(v)===String(val)?'selected':''}>${E(l)}</option>`}).join('')}</select></div>`;
  return`<div class="panel"><div class="filters"><input type="search" id="evQ" placeholder="Search name, username, action or details" value="${E(f.q)}" data-live="evQ" aria-label="Search the event log">
   ${sel('role','Role',[['','All roles'],...['Super Admin','Principal','Accountant','Clerk','Faculty','Parent','Student'].map(x=>[x,x])],f.role)}
   ${sel('user','Person',[['','Everyone'],...users],f.user)}
   ${sel('cat','Type',[['','All types'],...EV_CATS.map(c=>[c[0],c[0]+' · '+c[1]])],f.cat)}
   ${sel('status','Result',[['','Any result'],['ok','OK only'],['fail','Failed only']],f.status)}
   <div class="field"><label class="label" for="ev_from">From</label><input type="date" id="ev_from" value="${E(f.from)}" data-change="evF" data-k="from"></div>
   <div class="field"><label class="label" for="ev_to">To</label><input type="date" id="ev_to" value="${E(f.to)}" data-change="evF" data-k="to"></div>
   <label class="chk"><input type="checkbox" id="ev_quiet" ${f.quiet?'checked':''} data-change="evF" data-k="quiet"> Hide page views, clicks and changes</label>
   <button class="btn sm" data-act="evReset">Clear filters</button></div>
   <p class="note" id="evCount" style="margin:10px 0 6px">${r.count}</p>
   <div class="tablewrap"><table class="evtbl"><thead><tr><th>When</th><th>Who</th><th>Type</th><th>Action</th><th>Details</th><th>Result</th><th>Where</th></tr></thead><tbody id="evRows">${r.rows}</tbody></table></div>
   <div class="actions" id="evMoreBox" style="margin-top:10px;justify-content:center">${r.more?`<button class="btn" data-act="evMore">Show ${Math.min(100,r.left)} more (${r.left} left)</button>`:''}</div></div>
   <p class="note">This demo keeps the latest ${EV_MAX.toLocaleString('en-IN')} events in this browser. The live system keeps every event in the database. Passwords are never written to the log.</p>`;
}
function evPeople(all){
  const S={};all.forEach(e=>{const k=e.uid||'_none';const s=S[k]=S[k]||{id:k,n:e.n,r:e.r,un:e.un,last:0,signins:0,count:0,fail:0,page:''};s.count++;if(e.ts>s.last)s.last=e.ts;if(e.c==='Auth'&&e.a==='Signed in')s.signins++;if(e.s==='fail')s.fail++;if(!s.page&&e.c==='Page'&&/^Opened /.test(e.a)&&!/tab/.test(e.a))s.page=e.a.replace(/^Opened /,'')});
  db.users.filter(u=>u.role!=='Parent'&&u.role!=='Student'&&!S[u.id]).forEach(u=>S[u.id]={id:u.id,n:u.name,r:u.role,un:u.username,last:0,signins:0,count:0,fail:0,page:''});
  const list=Object.values(S).sort((a,b)=>b.last-a.last);
  return`<div class="panel" style="padding:6px 8px"><div class="tablewrap"><table><thead><tr><th>Person</th><th>Role</th><th>Last active</th><th class="num">Sign-ins</th><th class="num">Events</th><th class="num">Failed</th><th>Last page</th></tr></thead><tbody>
  ${list.map(s=>`<tr class="click" data-act="evUser" data-id="${E(s.id)}"><td><div class="who"><div class="av">${E(initials(s.n))}</div><div>${E(s.n)}<br><small class="muted">${E(s.un||'')}</small></div></div></td><td>${s.r==='-'?pill('Not signed in'):pill(s.r,'acc')}</td><td>${s.last?E(fmtT(s.last)):'No activity yet'}</td><td class="num">${s.signins}</td><td class="num">${s.count}</td><td class="num">${s.fail?pill(String(s.fail),'bad'):'0'}</td><td>${E(s.page||'-')}</td></tr>`).join('')}</tbody></table></div></div><p class="note">Select a person to see everything they did.</p>`;
}
LIVE.evQ=el=>{evF().q=el.value;evF().limit=100;const r=evRowsHtml();$('#evRows').innerHTML=r.rows;$('#evCount').textContent=r.count;$('#evMoreBox').innerHTML=r.more?`<button class="btn" data-act="evMore">Show ${Math.min(100,r.left)} more (${r.left} left)</button>`:''};
CHG.evF=el=>{const f=evF(),k=el.dataset.k;f[k]=el.type==='checkbox'?el.checked:el.value;f.limit=100;renderPage()};
ACT.evReset=()=>{ui.f.ev=null;renderPage()};
ACT.evMore=()=>{evF().limit+=100;renderPage()};
ACT.evUser=el=>{if(cur().role!=='Super Admin')throw new Error('Only the Super Admin can open the event log');ui.f.ev=null;evF().user=el.dataset.id;ui.tab.eventlog='timeline';renderPage();window.scrollTo(0,0)};
ACT.evOpen=el=>{
  if(cur().role!=='Super Admin')throw new Error('Only the Super Admin can open the event log');
  const e=evAll().find(x=>x.id===el.dataset.id);if(!e)throw new Error('Event not found');const L=(k,v)=>`<div class="rline"><span>${k}</span><b style="font-weight:500;text-align:right;overflow-wrap:anywhere">${E(v||'-')}</b></div>`;
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Event</h2><div style="margin:10px 0">${pill(e.c,evTone[e.c]||'')} ${e.s==='fail'?pill('Failed','bad'):pill('OK','good')}</div>
   <div class="panel" style="padding:12px">${L('Action',e.a+(e.x>1?' (×'+e.x+')':''))}${L('Details',e.d)}${L('Time',new Date(e.ts).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'medium'}))}${L('Person',e.n)}${L('Role',e.r==='-'?'Not signed in':e.r)}${L('Username',e.un)}${L('Page',evWhere(e))}${L('Event id',e.id)}</div>
   ${e.uid?`<div class="actions" style="margin-top:14px"><button class="btn" data-act="evUser" data-id="${E(e.uid)}">Everything by ${E(firstName(e.n))}</button></div>`:''}`);
};
ACT.evExport=()=>{
  if(cur().role!=='Super Admin')throw new Error('Only the Super Admin can export the event log');
  const m=evFilter(evAll(),evF());
  showCsv('Event log',['Time','Person','Username','Role','Type','Action','Details','Result','Page','Device','Count'],m.map(e=>[new Date(e.ts).toISOString(),e.n,e.un,e.r,e.c,e.a,e.d,e.s==='fail'?'Failed':'OK',e.p,e.v,e.x]));
};
ACT.evClear=()=>{
  if(cur().role!=='Super Admin')throw new Error('Only the Super Admin can clear the event log');
  confirmBox('Clear the event log','Every stored event will be deleted. This cannot be undone. A note that you cleared it is kept.','Clear log',()=>{const n=evAll().length;evBuf=[];lsDel(EV_KEY);ev('Audit','Event log cleared',`${n} events deleted`);log('Event log cleared',`${n} events deleted`);save();evFlush();renderPage();toast('Event log cleared')},true);
};
/* a second tab doing things shows up here without a refresh */
let evLiveT=null;
window.addEventListener('storage',e=>{
  if(e.key!==EV_KEY||!cur()||ui.route!=='eventlog')return;clearTimeout(evLiveT);
  evLiveT=setTimeout(()=>{const busy=$('#layer').innerHTML||$('#dlg').innerHTML||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');if(!busy&&$('#page'))renderPage()},500);
});
