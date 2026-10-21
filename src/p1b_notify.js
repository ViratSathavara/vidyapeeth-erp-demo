/* =====================================================================
   Notifications: one inbox per login. notify() writes one record for every
   person who should hear about something; the Super Admin chooses, per type
   and per role, who that is (Settings > Notification rules).
   ===================================================================== */
const NT_ROLES=['Super Admin','Principal','Accountant','Clerk','Faculty','Parent','Student'];
const NT_MAX=60; /* newest notifications kept per login */
const NT_CATS=[
 {k:'payment',l:'Payment received',d:'A fee payment, receipt or late-fee waiver was recorded.',on:['Super Admin','Accountant','Parent','Student']},
 {k:'payfail',l:'Online payment failed',d:'A Google Pay / UPI payment did not go through.',on:['Accountant','Parent','Student']},
 {k:'cancel',l:'Receipt cancelled',d:'A receipt was cancelled and the money reversed.',on:['Super Admin','Principal','Accountant','Parent','Student']},
 {k:'mailfail',l:'Receipt email failed',d:'A receipt email could not be sent.',on:['Super Admin','Accountant']},
 {k:'admission',l:'New admission',d:'A student was admitted. The family gets a welcome with their logins.',on:['Super Admin','Principal','Accountant','Parent','Student']},
 {k:'conc_req',l:'Concession requested',d:'A concession needs the Principal to decide.',on:['Super Admin','Principal']},
 {k:'conc_dec',l:'Concession decided',d:'A concession was approved or rejected. The person who asked is always told.',on:['Super Admin','Accountant','Parent']},
 {k:'dayclose',l:'Day closed or reopened',d:'Cash drawer closed, with any difference, or a closed day was reopened.',on:['Super Admin','Principal']},
 {k:'due',l:'Fee due soon or overdue',d:'Sent automatically when an installment is due within 7 days or has become overdue.',on:['Parent','Student']},
 {k:'digest',l:'Overdue fees summary',d:'Once a day: how many students are overdue and how much.',on:['Super Admin','Principal','Accountant']},
 {k:'reminder',l:'Fee reminder sent',d:'The office sent a reminder or message to the family.',on:['Parent','Student']},
 {k:'notice',l:'Notice posted',d:'A notice for everyone or for one course.',on:['Super Admin','Principal','Accountant','Clerk','Faculty','Parent','Student']},
 {k:'attendance',l:'Absence and low attendance',d:'A student was marked absent today, or is below 75%.',on:['Parent','Student']},
 {k:'attpending',l:'Attendance not marked',d:'Once a day: a class teacher has not marked today.',on:['Faculty']},
 {k:'marks',l:'Marks published',d:'Internal marks were saved for a subject.',on:['Parent','Student']},
 {k:'practice',l:'Practice teaching',d:'A school was allotted or the evaluation was saved.',on:['Principal','Faculty','Parent','Student']},
 {k:'bank',l:'Bank settlement',d:'A bank statement was imported and payments were matched.',on:['Super Admin','Accountant']},
 {k:'promotion',l:'Promotion and leaving',d:'Semester promotion, passing out, or a student marked as left.',on:['Super Admin','Principal','Accountant','Parent','Student']},
 {k:'student',l:'Family changed details',d:'A parent or student updated their phone or email.',on:['Super Admin','Clerk']},
 {k:'docs',l:'Documents pending',d:'Once a day: admissions still provisional because documents are missing.',on:['Super Admin','Principal','Clerk']},
 {k:'account',l:'Logins and passwords',d:'A login was created or changed, or someone changed their password. The person concerned is always told.',on:['Super Admin']},
 {k:'security',l:'Repeated failed sign-ins',d:'Three wrong passwords for the same user within 15 minutes.',on:['Super Admin']},
 {k:'system',l:'Rules and permissions changed',d:'Role permissions, fee structure or late-fee rules were changed.',on:['Super Admin','Principal','Accountant']}
];
const NT_DEFAULTS=()=>{const o={};NT_CATS.forEach(c=>{o[c.k]={};NT_ROLES.forEach(r=>o[c.k][r]=c.on.includes(r))});return o};
const ntCat=k=>NT_CATS.find(c=>c.k===k);
const ntOn=(k,role)=>{const n=db.settings&&db.settings.notify;return !!(n&&n[k]&&n[k][role])};
function ntInit(){ /* fill in anything missing, never overwrite the admin's choices */
  if(!Array.isArray(db.notifs))db.notifs=[];
  const d=NT_DEFAULTS();const n=db.settings.notify=db.settings.notify||{};
  Object.keys(d).forEach(k=>{n[k]=n[k]||{};Object.keys(d[k]).forEach(r=>{if(n[k][r]===undefined)n[k][r]=d[k][r]})});
}
/* where a notification takes you, by who is reading it */
const ntGo=(u,go)=>{if(!go)return{r:'',t:''};if(u.role==='Parent'||u.role==='Student'){const p=go.portal;return{r:(p&&typeof p==='object'?p[u.role]:p)||'',t:''}}const s=go.staff||[];return{r:s[0]||'',t:s[1]||''}};
function ntRecipients(cat,o){
  const act=cur();const out=new Map();const roles=o.roles||NT_ROLES.filter(r=>ntOn(cat,r));
  db.users.forEach(u=>{
    if(!u.active||!roles.includes(u.role))return;
    if(u.role==='Parent'||u.role==='Student'){
      const s=stu(u.studentId);if(!s)return;
      if(o.course){if(s.status!=='Active'||(o.course!=='all'&&s.course!==o.course))return}
      else if(!o.sid||u.studentId!==o.sid)return;
    }
    out.set(u.id,u);
  });
  (o.uids||[]).forEach(id=>{const u=db.users.find(x=>x.id===id&&x.active);if(u)out.set(id,u)});
  if(act&&!o.self)out.delete(act.id); /* you do not need a notification about what you just did */
  return[...out.values()];
}
function notify(cat,title,text,o={}){
  if(!db.notifs)ntInit();
  const rs=ntRecipients(cat,o);if(!rs.length)return 0;const c=ntCat(cat)||{};const act=cur();let n=0;
  rs.forEach(u=>{
    const key=o.key?o.key+'|'+u.id:'';if(key&&db.notifs.some(x=>x.key===key))return;
    const portal=u.role==='Parent'||u.role==='Student';const g=ntGo(u,o.go);const p=portal&&o.p?o.p:null;
    db.notifs.unshift({id:uid('nt'),ts:o.ts||Date.now(),uid:u.id,k:cat,t:(p&&p.t)||title,x:(p&&p.x!==undefined?p.x:text)||'',tone:o.tone||c.tone||'info',route:g.r,tab:g.t,sid:o.sid||'',open:o.open||'',read:false,key,by:act?act.name:'System'});n++;
  });
  if(n)ntPrune();
  if(n&&typeof updateBell==='function')updateBell();
  return n;
}
function ntPrune(){
  const seen={};let drop=false;
  db.notifs=db.notifs.filter(x=>{seen[x.uid]=(seen[x.uid]||0)+1;if(seen[x.uid]>NT_MAX){drop=true;return false}return true});
  return drop;
}
const ntUnread=u=>u?db.notifs.reduce((a,n)=>a+(n.uid===u.id&&!n.read?1:0),0):0;
const ntMine=u=>u?db.notifs.filter(n=>n.uid===u.id):[];
const ago=ts=>{const s=Math.max(0,(Date.now()-ts)/1000);if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' h ago';const d=Math.floor(s/86400);return d===1?'yesterday':d<7?d+' days ago':fmtD(isoOf(new Date(ts)))};

/* ---------- automatic alerts: due dates, daily summaries ---------- */
function ntSync(){
  if(!db||!db.students)return;ntInit();const T=today();
  db.students.filter(s=>s.status==='Active').forEach(s=>{
    const sm=feeSum(s);
    sm.inst.forEach((i,ix)=>{
      if(i.state==='Paid'||!(i.remaining>0))return;const left=-diffDays(T,i.due); /* days until due */
      if(i.overdue)notify('due',`Installment ${ix+1} is overdue`,`${inr(i.remaining)} was due on ${fmtD(i.due)}. A late fee applies until it is paid.`,{sid:s.id,key:`over:${s.id}:${s.fee.id||s.sem}:${ix}`,tone:'bad',go:{portal:'pfees'},self:true});
      else if(left>=0&&left<=7)notify('due',`Installment ${ix+1} is due ${left===0?'today':left===1?'tomorrow':'in '+left+' days'}`,`${inr(i.remaining)} is due on ${fmtD(i.due)}. Pay from the Fees page to avoid a late fee.`,{sid:s.id,key:`soon:${s.id}:${s.fee.id||s.sem}:${ix}`,tone:'warn',go:{portal:'pfees'},self:true});
    });
  });
  const od=db.students.filter(s=>s.status==='Active').map(s=>({s,sm:feeSum(s)})).filter(x=>x.sm.overdue&&x.sm.payable>0);
  if(od.length)notify('digest',`${od.length} student${od.length>1?'s have':' has'} overdue fees`,`${inr(sum(od,x=>x.sm.payable))} is outstanding from overdue installments. Open Pending dues to send reminders.`,{key:'digest:'+T,tone:'warn',go:{staff:['fees','dues']},self:true});
  const prov=db.students.filter(s=>s.status==='Active'&&admStatus(s)==='Provisional');
  if(prov.length)notify('docs',`${prov.length} admission${prov.length>1?'s are':' is'} provisional`,'Required documents are still missing. Open Students and look for Provisional.',{key:'docs:'+T,tone:'warn',go:{staff:['students']},self:true});
  if(parseD(T).getDay()!==0&&typeof semOfDiv==='function'){
    db.users.filter(u=>u.active&&u.role==='Faculty'&&u.staffId).forEach(u=>{
      const mine=db.divisions.filter(d=>d.teacher===u.staffId&&db.students.some(s=>s.div===d.id&&s.status==='Active'));
      const todo=mine.filter(d=>!(db.attendance[T]&&db.attendance[T][d.id]));
      if(todo.length)notify('attpending','Attendance not marked yet today',`${todo.map(divName).join(', ')}. Open Attendance and tap only the absent students.`,{uids:[u.id],roles:[],key:'attp:'+T,tone:'warn',go:{staff:['attendance']},self:true});
    });
  }
  ntPrune();
}
/* demo data starts with the existing notices already delivered */
function ntSeed(){ntInit();db.notices.slice().reverse().forEach(n=>notify('notice',n.title,String(n.body||'').slice(0,140),{course:n.audience,key:'notice:'+n.id,go:{staff:['messages','notices'],portal:'pnotices'},self:true,ts:Date.now()-diffDays(today(),n.date)*864e5}));ntSync()}

/* ---------- repeated wrong passwords ---------- */
const ntFails={};
function ntFailed(un,known){
  const k=String(un||'').toLowerCase();if(!k)return;const now=Date.now();const a=(ntFails[k]=(ntFails[k]||[]).filter(t=>now-t<9e5));a.push(now);
  if(a.length>=3){notify('security',`${a.length} failed sign-ins for “${k}”`,`${known?'This login exists. Someone may be guessing the password.':'There is no login with this name.'} Open the Event Log to see when.`,{key:`sec:${k}:${Math.floor(now/9e5)}`,tone:'bad',go:{staff:['eventlog']},self:true});save()}
}
