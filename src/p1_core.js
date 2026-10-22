'use strict';
/* =====================================================================
   Vidyapeeth College ERP - demo. All data lives in localStorage.
   ===================================================================== */
const LS_KEY='vp_erp_demo_v3', SES_KEY='vp_erp_session_v3', THEME_KEY='vp_erp_theme';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr=n=>(n<0?'-':'')+'₹'+Math.round(Math.abs(n||0)).toLocaleString('en-IN');
const pad=(n,l=2)=>String(n).padStart(l,'0');
const isoOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>isoOf(new Date());
const parseD=iso=>{const [y,m,d]=iso.slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(iso,n)=>{const d=parseD(iso);d.setDate(d.getDate()+n);return isoOf(d)};
const diffDays=(a,b)=>Math.round((parseD(a)-parseD(b))/864e5);
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtD=iso=>{if(!iso)return '—';const d=parseD(iso);return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`};
const fmtT=ts=>{const d=new Date(ts);return fmtD(isoOf(d))+', '+d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})};
const uid=p=>p+Math.random().toString(36).slice(2,9);
const sum=(a,f=x=>x)=>a.reduce((s,x)=>s+f(x),0);
const initials=n=>String(n).replace(/^(Dr\.|Prof\.|Shri|Smt\.)\s+/,'').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
let _seed=11;const rnd=()=>{_seed=(_seed*16807)%2147483647;return _seed/2147483647};

/* ---------- storage with fallback ---------- */
const memStore={};
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return memStore[k]??null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);return true}catch(e){memStore[k]=v;return false}};
const lsDel=k=>{try{localStorage.removeItem(k)}catch(e){delete memStore[k]}};
/* The signed-in user lives in sessionStorage, so two browser tabs can hold two different logins at once. Data lives in localStorage and is synced between tabs. */
const sesGet=()=>{try{return sessionStorage.getItem(SES_KEY)}catch(e){return memStore[SES_KEY]??null}};
const sesSet=v=>{try{sessionStorage.setItem(SES_KEY,v)}catch(e){memStore[SES_KEY]=v}};
const sesDel=()=>{try{sessionStorage.removeItem(SES_KEY)}catch(e){delete memStore[SES_KEY]}};
let db=null;
/* save() reports whether the browser really stored the data. When it did not (storage full, blocked or switched off) the app keeps working in memory, a banner stays on screen until a later save succeeds, and toast() refuses to say "saved". */
const SAVE_FAIL_MSG='Could not save: changes will be lost on reload';
let saveBad=false,saveTick=false;
function saveBanner(on){
  if(typeof document==='undefined'||!document.body)return;
  let b=document.getElementById('savebar');
  if(!on){if(b)b.remove();document.body.classList.remove('save-bad');document.body.style.removeProperty('--sbh');return}
  if(!b){b=document.createElement('div');b.id='savebar';b.setAttribute('role','alert');b.textContent=SAVE_FAIL_MSG+'. Free up space in this browser, or copy a backup now (Settings, Data and backup).';document.body.insertBefore(b,document.body.firstChild)}
  document.body.classList.add('save-bad');document.body.style.setProperty('--sbh',b.offsetHeight+'px');
}
addEventListener('resize',()=>{if(saveBad)saveBanner(true)});
function save(){
  const ok=lsSet(LS_KEY,JSON.stringify(db));
  saveBad=!ok;if(!ok){saveTick=true;Promise.resolve().then(()=>{saveTick=false})}
  saveBanner(!ok);return ok;
}
function load(){const raw=lsGet(LS_KEY);if(raw){try{db=JSON.parse(raw);if(db&&db.ver===3){migrate();return}}catch(e){}}seed();save()}
/* Adds anything newer builds expect, so data saved by an older build keeps working. Safe to run any number of times. */
const MAIL_DEFAULTS=()=>({enabled:true,to:'both',mode:'demo',endpoint:'/api/send-receipt',key:'',fromName:'',replyTo:'',redirect:''});
const slugMail=n=>String(n||'').replace(/^(Dr\.|Prof\.|Shri|Smt\.)\s+/,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'');
const STU_PW='student123',PAR_PW='parent123';
function ensureUsers(s,alias){
  if(!db.users.some(u=>u.role==='Parent'&&u.studentId===s.id))db.users.push({id:uid('u'),username:s.id.toLowerCase(),password:PAR_PW,name:s.guardian.name,role:'Parent',studentId:s.id,active:true});
  if(!db.users.some(u=>u.role==='Student'&&u.studentId===s.id))db.users.push({id:uid('u'),username:'stu-'+s.id.toLowerCase(),password:STU_PW,name:s.name,role:'Student',studentId:s.id,active:true});
}
function migrate(){
  if(typeof ntInit==='function')ntInit();
  db.settings.mail=Object.assign(MAIL_DEFAULTS(),db.settings.mail||{});if(!db.outbox)db.outbox=[];
  (db.payments||[]).forEach(p=>{if(!p.snap){try{const s=stu(p.studentId);if(s)p.snap=snapOf(p,s)}catch(e){}}});fixCounters(db);
  db.students.forEach(s=>{if(!s.guardian)s.guardian={};if(s.guardian.email===undefined)s.guardian.email=slugMail(s.guardian.name)?slugMail(s.guardian.name)+'@example.com':'';ensureUsers(s)});
  const r=db.students.find(s=>s.name==='Riya Joshi');
  if(r){if(!db.users.some(u=>u.username==='parent'))db.users.push({id:'u_parent',username:'parent',password:PAR_PW,name:r.guardian.name,role:'Parent',studentId:r.id,active:true});
    if(!db.users.some(u=>u.username==='student'))db.users.push({id:'u_student',username:'student',password:STU_PW,name:r.name,role:'Student',studentId:r.id,active:true})}
}

/* An issued receipt never changes. At issue time the amounts stay on the payment record (recompute() no longer rewrites them once p.snap exists) and p.snap keeps the fee heads, the rules, the college name and the class as they were. Old data without a snapshot gets one from the current data the first time it is loaded. */
function snapOf(p,s){
  const own=!!s&&!!s.fee&&s.fee.id===p.feeId,st=db.settings;
  return{at:Date.now(),h:own?s.fee.heads.map(h=>[h.name,h.amount]):null,t:own?s.fee.total:null,r:[st.lateFeePerDay,st.lateCap,st.graceDays],c:st.college,y:st.city,k:s?classLabel(s):''};
}
/* counters must stay above every id already in use, whatever a file or an old save says (they are only ever raised, never lowered) */
function fixCounters(d){
  const c=d.counters,fix=[];if(!c||typeof c!=='object')return fix;
  let m=0;(d.payments||[]).forEach(p=>{const x=/(\d+)$/.exec(String(p.rc));if(x)m=Math.max(m,+x[1])});if(!(c.rc>=m+1)){fix.push('receipt counter '+c.rc+' to '+(m+1));c.rc=m+1}
  m=0;(d.requests||[]).forEach(r=>{const x=/^rq(\d+)$/.exec(String(r.id));if(x)m=Math.max(m,+x[1])});if(!(c.req>=m+1)){fix.push('request counter '+c.req+' to '+(m+1));c.req=m+1}
  if(!c.enrol||typeof c.enrol!=='object')c.enrol={};
  (d.students||[]).forEach(s=>{const x=/^(.+)-(\d+)$/.exec(String(s.id));if(x&&(c.enrol[x[1]]||0)<+x[2]){fix.push('enrolment counter '+x[1]+' to '+(+x[2]));c.enrol[x[1]]=+x[2]}});
  return fix;
}
const NAME_MAX=80;
/* trims and refuses text longer than the limit, with a message that says what to do */
const capText=(v,label,max=NAME_MAX)=>{v=String(v??'').trim();if(v.length>max)throw new Error(`${label} is too long (${v.length} characters; the limit is ${max}). Shorten it and try again.`);return v};

/* ---------- permissions ---------- */
const PERMS=[
 ['dashboard.view','See the dashboard'],['students.view','View students'],['students.edit','Admit and edit students'],['students.promote','Promote students to next semester'],
 ['fees.view','Open fee collection screens'],['fees.collect','Collect fees and issue receipts'],['fees.reverse','Cancel receipts and refund'],
 ['fees.concession.request','Request a concession'],['fees.concession.approve','Approve concessions and waive late fee'],['fees.dayclose','Close the day (cash count)'],
 ['fees.bankmatch','Match bank settlements'],['fees.setup','Change fee structure and late fee rules'],
 ['academic.manage','Set up courses, batches, divisions, subjects'],['attendance.view','View attendance'],['attendance.mark','Mark attendance'],
 ['marks.view','View internal marks'],['marks.enter','Enter internal marks'],['practice.manage','Manage practice teaching'],
 ['staff.view','View staff'],['staff.manage','Add and edit staff and logins'],['roles.manage','Change role permissions'],
 ['messages.send','Send reminders and messages'],['notices.post','Post notices'],
 ['reports.fees','Fee reports'],['reports.students','Student reports'],['reports.academic','Academic reports'],['reports.staff','Staff reports'],
 ['audit.view','View audit log'],['settings.manage','Change college settings and data']];
const ROLE_NAMES=['Super Admin','Principal','Accountant','Clerk','Faculty'];
const DEFAULT_ROLES={
 'Principal':['dashboard.view','students.view','students.edit','students.promote','fees.view','fees.reverse','fees.dayclose','fees.bankmatch','fees.concession.approve','academic.manage','attendance.view','marks.view','practice.manage','staff.view','messages.send','notices.post','reports.fees','reports.students','reports.academic','reports.staff','audit.view'],
 'Accountant':['dashboard.view','students.view','fees.view','fees.collect','fees.reverse','fees.dayclose','fees.bankmatch','messages.send','reports.fees'],
 'Clerk':['dashboard.view','students.view','students.edit','fees.view','fees.collect','fees.concession.request','reports.students'],
 'Faculty':['dashboard.view','students.view','attendance.view','attendance.mark','marks.view','marks.enter','practice.manage','reports.academic']};
const cur=()=>db.users.find(u=>u.id===sesGet()&&u.active);
const can=p=>{const u=cur();if(!u)return false;if(u.role==='Super Admin')return true;return (db.roles[u.role]||[]).includes(p)};
const canAny=(...p)=>p.some(can);
/* Guards used at the top of handlers. They mirror what the server must enforce; in this demo they stop the UI and console calls of a signed-in role that lacks the permission. */
const need=(p,what)=>{if(!can(p))throw new Error('You do not have access'+(what?' to '+what:''))};
const needAny=(p,what)=>{if(!canAny(...p))throw new Error('You do not have access'+(what?' to '+what:''))};
/* Parent and Student logins may open only their own student's record; staff need students.view */
const mayStudent=id=>{const u=cur();if(!u)return false;if(u.role==='Parent'||u.role==='Student')return !!id&&u.studentId===id;return can('students.view')};

/* ---------- lookups ---------- */
const stu=id=>db.students.find(s=>s.id===id);
const course=id=>db.courses.find(c=>c.id===id);
const batchOf=id=>db.batches.find(b=>b.id===id);
const divOf=id=>db.divisions.find(d=>d.id===id);
const staffOf=id=>db.staff.find(s=>s.id===id);
const classLabel=s=>`${course(s.course).name} Sem ${s.sem} · ${divOf(s.div)?.name||'-'}`;
const DOCS=[['d0','Graduation marksheets (all years)',1],['d1','Leaving / transfer certificate',1],['d2','Aadhaar card',1],['d3','Passport photos (4)',1],['d4','Entrance / merit letter',1],['d5','Caste certificate',0],['d6','Income certificate (scholarship)',0],['d7','Gap / migration certificate',0]];
const docsMissing=s=>DOCS.filter(d=>d[2]&&!s.docs[d[0]]).length;
const admStatus=s=>s.status!=='Active'?s.status:(docsMissing(s)?'Provisional':'Active');
function log(action,detail){const u=cur();db.audit.unshift({id:uid('a'),ts:Date.now(),user:u?u.name:'System',role:u?u.role:'-',action,detail});if(db.audit.length>400)db.audit.length=400;if(!/^Signed (in|out)$/.test(action))ev('Audit',action,detail)}

/* ---------- event log: every sign-in, page opened, click, form, change, email and error, for every role.
   Kept in its own storage key so writing events never triggers the cross-tab refresh of the main data. ---------- */
const EV_KEY='vp_erp_events_v1',EV_MAX=3000;
let evBuf=[],evTimer=null;
const humanize=n=>String(n||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase());
function evRead(){try{const l=JSON.parse(lsGet(EV_KEY)||'[]');return Array.isArray(l)?l:[]}catch(e){return[]}}
function evFlush(){
  clearTimeout(evTimer);if(!evBuf.length)return;
  let l=evBuf.slice().reverse().concat(evRead());evBuf=[];if(l.length>EV_MAX)l.length=EV_MAX;
  try{lsSet(EV_KEY,JSON.stringify(l))}catch(e){try{l.length=Math.min(l.length,1500);lsSet(EV_KEY,JSON.stringify(l))}catch(x){}}
}
function ev(cat,action,detail,o={}){
  const u=o.user===undefined?cur():o.user;
  const e={id:uid('e'),ts:Date.now(),uid:u?u.id:'',n:u?u.name:(o.name||'Not signed in'),r:u?u.role:'-',un:u?u.username:(o.un||''),c:cat,a:action,d:String(detail||'').slice(0,300),s:o.status||'ok',p:(typeof ui!=='undefined'&&ui.route)||'',v:innerWidth<720?'Phone':'Desktop',x:1};
  const l=evBuf[evBuf.length-1];
  if(l&&l.uid===e.uid&&l.c===e.c&&l.a===e.a&&l.d===e.d&&l.s===e.s&&e.ts-l.ts<2500){l.x++;l.ts=e.ts}else evBuf.push(e);
  clearTimeout(evTimer);evTimer=setTimeout(evFlush,300);
}
addEventListener('pagehide',evFlush);document.addEventListener('visibilitychange',()=>{if(document.hidden)evFlush()});
addEventListener('error',e=>{try{ev('Error','Script error',e.message||'Unknown error',{status:'fail'})}catch(x){}});
addEventListener('unhandledrejection',e=>{try{ev('Error','Unhandled error',(e.reason&&e.reason.message)||String(e.reason),{status:'fail'})}catch(x){}});

/* ---------- fee engine ---------- */
function planFor(total,planName,start){
  const t=db.plans.find(p=>p.name===planName)||db.plans[0];const off=db.settings.dueOffsets;let used=0;
  return t.pct.map((p,i)=>{const a=i===t.pct.length-1?total-used:Math.round(total*p/100);used+=a;
    return{label:t.pct.length===1?'Full payment':'Installment '+(i+1),amt:a,due:addDays(start,off[i]!==undefined?off[i]:off[off.length-1]+30*i)}});
}
function layoutFee(f){
  let heads=[];if(f.prev>0)heads.push({name:'Previous balance',amount:f.prev});
  heads=heads.concat(f.base.map(h=>({name:h.name,amount:h.amount})));
  const c=f.concession;f.govReceivable=0;
  if(c.status==='approved'){const ti=heads.findIndex(h=>h.name===f.base[0].name);
    if(c.type==='gov'){f.govReceivable=heads[ti].amount;heads[ti].amount=0}
    else if(c.type==='mgmt'){heads[ti].amount-=Math.min(c.amount,heads[ti].amount)}}
  f.heads=heads;f.total=sum(heads,h=>h.amount);f.plan=planFor(f.total,f.planName,f.start);
}
function newFee({sem,courseId,planName,start,concession,prev}){
  const f={id:uid('f'),sem,base:db.feeStructure[courseId].map(h=>({...h})),planName,start,concession:concession||{type:'none',amount:0,status:'none'},prev:prev||0,paid:0,paidLate:0,lateWaived:0,cleared:[],govReceivable:0};
  layoutFee(f);f.cleared=f.plan.map(()=>null);return f;
}
function lateAt(f,onDate,paid,cleared){
  const{lateFeePerDay:pd,lateCap:cap,graceDays:g}=db.settings;let cum=0,tot=0;
  f.plan.forEach((p,i)=>{cum+=p.amt;if(p.amt<=0)return;const end=cleared[i]||onDate;const days=diffDays(end,p.due)-g;if(days>0)tot+=Math.min(cap,days*pd)});
  return tot;
}
/* refresh=true is used only when a receipt is cancelled: the later receipts of that student are re-applied without the cancelled money (an existing rule). Every other caller (rule changes, waivers, concessions, issuing) leaves issued receipts exactly as they were. */
function recompute(s,refresh){
  const f=s.fee;const pays=db.payments.filter(p=>p.studentId===s.id&&p.feeId===f.id&&p.status==='ok').sort((a,b)=>a.ts-b.ts);
  let paid=0,paidLate=0;const cleared=f.plan.map(()=>null);
  for(const p of pays){
    const late=lateAt(f,p.date,paid,cleared);const lateDue=Math.max(0,late-f.lateWaived-paidLate);
    const la=Math.min(p.amount,lateDue);const fa=Math.min(p.amount-la,Math.max(0,f.total-paid));
    const alloc=[];let skip=paid,left=fa;
    f.heads.forEach(h=>{const before=Math.min(h.amount,skip);skip-=before;const take=Math.min(h.amount-before,left);left-=take;alloc.push({name:h.name,amount:h.amount,before,applied:take,after:before+take})});
    paid+=fa;paidLate+=la;
    if(!p.snap||refresh){p.balAfter=Math.max(0,f.total-paid);p.paidAfter=paid;p.late=la;p.feeAmt=fa;p.credit=p.amount-la-fa;p.alloc=alloc}
    let cum=0;f.plan.forEach((pl,i)=>{cum+=pl.amt;if(!cleared[i]&&pl.amt>0&&paid>=cum)cleared[i]=p.date});
  }
  f.paid=paid;f.paidLate=paidLate;f.cleared=cleared;
}
function feeSum(s,on){
  on=on||today();const f=s.fee;const late=lateAt(f,on,f.paid,f.cleared);
  const lateDue=Math.max(0,late-f.lateWaived-f.paidLate);const balance=Math.max(0,f.total-f.paid);let cum=0;
  const inst=f.plan.map(p=>{cum+=p.amt;const state=p.amt<=0||f.paid>=cum?'Paid':(f.paid>cum-p.amt?'Part-paid':'Due');
    return{...p,cum,state,overdue:state!=='Paid'&&diffDays(on,p.due)>0,remaining:Math.max(0,Math.min(p.amt,cum-f.paid))}});
  const payable=balance+lateDue;const nextInst=inst.find(i=>i.state!=='Paid');
  return{total:f.total,paid:f.paid,balance,late,lateDue,payable,inst,nextInst,overdue:inst.some(i=>i.overdue),
    status:payable<=0?'Paid':(f.paid===0&&f.paidLate===0?'Not paid':'Partial'),suggest:(nextInst?nextInst.remaining:0)+lateDue};
}
function recordPayment(s,o){
  const date=o.date||today();const sm=feeSum(s,date);
  if(!(o.amount>0))throw new Error('Enter an amount above ₹0');
  if(o.amount>sm.payable)throw new Error(`Amount is more than the payable ${inr(sm.payable)}`);
  if(o.channel==='counter'&&db.closures[date]&&!o.force)throw new Error('Today is closed. Ask the Principal to reopen the day.');
  const p={id:uid('p'),rc:db.settings.receiptPrefix+(db.counters.rc++),studentId:s.id,feeId:s.fee.id,sem:s.fee.sem,date,ts:o.ts||Date.now(),
    amount:o.amount,mode:o.mode,channel:o.channel,ref:o.ref||'',by:o.by||'System',status:'ok',settle:o.channel==='online'?{status:o.settle||'pending'}:null};
  db.payments.push(p);recompute(s);p.snap=snapOf(p,s);return p;
}
function cancelPayment(p,reason,refundMode){
  if(!p)throw new Error('Receipt not found');
  /* server-style guard: only a valid (Active) receipt can be cancelled, and never twice, so one receipt can never be refunded twice */
  if(p.status!=='ok')throw new Error(`Receipt ${p.rc} is already ${p.status}. A receipt can be cancelled only once.`);
  if(db.refunds.some(r=>r.paymentId===p.id))throw new Error(`Receipt ${p.rc} has already been refunded.`);
  const s=stu(p.studentId);if(p.feeId!==s.fee.id)throw new Error('Only this semester\'s receipts can be cancelled');
  p.status='cancelled';p.cancel={reason,by:cur().name,ts:Date.now(),refundMode};recompute(s,true);
  db.refunds.push({id:uid('r'),paymentId:p.id,rc:p.rc,studentId:p.studentId,amount:p.amount,mode:refundMode,date:today(),reason,by:cur().name});
}
const paysOf=(s,okOnly=true)=>db.payments.filter(p=>p.studentId===s.id&&(!okOnly||p.status==='ok')).sort((a,b)=>b.ts-a.ts);
function cashExpected(date){
  const cash=sum(db.payments.filter(p=>p.channel==='counter'&&p.mode==='Cash'&&p.date===date),p=>p.amount); /* cancelled receipts still count: the cash was received; the refund below takes it back out */
  const ref=sum(db.refunds.filter(r=>r.date===date&&r.mode==='Cash'),r=>r.amount);return cash-ref;
}
function attPct(s){
  let p=0,t=0;Object.values(db.attendance).forEach(day=>{const r=day[s.div];if(r&&r.sem===s.sem&&r.marks[s.id]){t++;if(r.marks[s.id]==='P')p++}});
  return t?Math.round(p/t*100):null;
}
function nextEnrol(courseId,batchId){
  const c=course(courseId),b=batchOf(batchId);const pre=c.code+pad(b.startYear%100);
  db.counters.enrol[pre]=(db.counters.enrol[pre]||0)+1;return pre+'-'+pad(db.counters.enrol[pre],3);
}
function makeStudent(d,by){
  const c=course(d.course),b=batchOf(d.batch);const id=d.id||nextEnrol(d.course,d.batch);
  const docs={};DOCS.forEach(x=>docs[x[0]]=!!d.docs?.[x[0]]);
  const start=d.start||today();
  const s={id,name:d.name,course:d.course,batch:d.batch,div:d.div,sem:d.sem||1,gender:d.gender,dob:d.dob,category:d.category||'General',blood:d.blood||'',nationality:d.nationality||'Indian',
    aadhaar:d.aadhaar||'',phone:d.phone,whatsapp:d.whatsapp||d.phone,email:d.email||'',address:d.address||'',city:d.city||'',pin:d.pin||'',
    guardian:{name:d.gname||'',occupation:d.gocc||'',phone:d.gphone||'',income:d.ginc||'',email:d.gemail||''},
    academic:{degree:d.degree||'',university:d.university||'',year:d.year||'',pct:d.pct||'',pgPct:d.pgPct||'',sub1:d.sub1||'',sub2:d.sub2||'',rank:d.rank||''},
    docs,status:'Active',admittedOn:d.admittedOn||today(),feeHistory:[],note:''};
  s.fee=newFee({sem:s.sem,courseId:s.course,planName:d.planName||db.plans[1].name,start,concession:d.concession});
  return s;
}

/* ---------- seed ---------- */
function seed(){
  const T=today();
  db={ver:3,counters:{rc:2531,req:100,enrol:{}},
   settings:{college:'Vidyapeeth College of Education',short:'Vidyapeeth',year:'2026–27',receiptPrefix:'RC-',lateFeePerDay:50,lateCap:1000,graceDays:5,dueOffsets:[0,45,90],city:'Ahmedabad'},
   roles:JSON.parse(JSON.stringify(DEFAULT_ROLES)),
   plans:[{name:'Full semester (1 payment)',pct:[100]},{name:'2 installments (50 / 50)',pct:[50,50]},{name:'3 installments (40 / 30 / 30)',pct:[40,30,30]}],
   feeStructure:{bed:[{name:'Tuition fee',amount:19000},{name:'Practice teaching',amount:3000},{name:'Library & lab',amount:1500},{name:'University exam fee',amount:1800}],
                 med:[{name:'Tuition fee',amount:24000},{name:'Dissertation & research',amount:4000},{name:'Library & lab',amount:1500},{name:'University exam fee',amount:2200}]},
   courses:[{id:'bed',name:'B.Ed',code:'BED',full:'Bachelor of Education',semesters:4,intake:100,duration:'2 years'},{id:'med',name:'M.Ed',code:'MED',full:'Master of Education',semesters:4,intake:50,duration:'2 years'}],
   batches:[{id:'b1',course:'bed',name:'2025–27',startYear:2025},{id:'b2',course:'bed',name:'2026–28',startYear:2026},{id:'b3',course:'med',name:'2025–27',startYear:2025},{id:'b4',course:'med',name:'2026–28',startYear:2026}],
   divisions:[],subjects:[],staff:[],users:[],students:[],payments:[],refunds:[],requests:[],closures:{},attendance:{},marks:[],schools:[],practice:[],notices:[],messages:[],outbox:[],audit:[]};

  /* staff + logins */
  const S=[['st1','Rajiv Bhatt','College Administrator','Administration','MBA','Super Admin','admin','admin123'],
   ['st2','Dr. Meena Acharya','Principal','Administration','Ph.D. (Education)','Principal','principal','principal123'],
   ['st3','Bhavna Shukla','Accountant','Accounts','M.Com','Accountant','accountant','account123'],
   ['st4','Nilesh Prajapati','Office Clerk','Admissions','B.Com','Clerk','clerk','clerk123'],
   ['st5','Prof. Rakesh Dave','Assistant Professor','Pedagogy of Science','M.Ed, M.Sc','Faculty','faculty','faculty123'],
   ['st6','Dr. Hetal Kothari','Associate Professor','Educational Psychology','Ph.D. (Psychology)','Faculty','hetal','faculty123'],
   ['st7','Prof. Sunil Makwana','Assistant Professor','ICT in Education','M.Ed, M.C.A.','Faculty','sunil','faculty123'],
   ['st8','Prof. Nirali Bhatt','Assistant Professor','Mathematics Education','M.Ed, M.Sc','Faculty','nirali','faculty123'],
   ['st9','Kirti Gohil','Librarian','Library','M.Lib','None',null,null]];
  /* Only five logins exist at first: Super Admin, Principal, Accountant, Parent and Student. Clerk and Faculty logins are created by the admin under Staff and Roles. */
  const DEFAULT_LOGINS=['st1','st2','st3'];
  S.forEach((r,i)=>{const userId=DEFAULT_LOGINS.includes(r[0])?'u_'+r[6]:null;
    db.staff.push({id:r[0],name:r[1],designation:r[2],department:r[3],qualification:r[4],phone:'9'+pad(Math.floor(rnd()*1e4),4)+' '+pad(Math.floor(rnd()*1e5),5),email:(r[6]||'kirti')+'@vidyapeeth.example',joined:addDays(T,-(300+i*190)),role:r[5],status:r[0]==='st7'?'On leave':'Active',userId});
    if(userId)db.users.push({id:userId,username:r[6],password:r[7],name:r[1],role:r[5],staffId:r[0],active:true})});

  db.divisions=[{id:'d1',course:'bed',batch:'b1',name:'A',teacher:'st5',capacity:50},{id:'d2',course:'bed',batch:'b1',name:'B',teacher:'st8',capacity:50},
   {id:'d3',course:'bed',batch:'b2',name:'A',teacher:'st6',capacity:50},{id:'d4',course:'bed',batch:'b2',name:'B',teacher:'st8',capacity:50},
   {id:'d5',course:'med',batch:'b3',name:'A',teacher:'st6',capacity:25},{id:'d6',course:'med',batch:'b4',name:'A',teacher:'st5',capacity:25}];
  const SUB={bed:{1:['Childhood and Growing Up','Contemporary India and Education','Language Across the Curriculum','Pedagogy of Science'],2:['Learning and Teaching','Assessment for Learning','Pedagogy of Mathematics'],3:['Knowledge and Curriculum','Gender, School and Society','ICT in Education','Teaching Internship'],4:['Creating an Inclusive School','Yoga and Health Education','Understanding the Self']},
             med:{1:['Philosophy of Education','Research Methods in Education','Advanced Educational Psychology','Curriculum Studies'],2:['Sociology of Education','Statistics in Education','Teacher Education'],3:['Educational Technology','Educational Measurement','Dissertation Seminar','Comparative Education'],4:['Dissertation','Educational Management','Inclusive Education']}};
  const FAC={1:['st5','st6'],2:['st5','st6'],3:['st7','st8'],4:['st7','st8']};let k=0;
  Object.keys(SUB).forEach(c=>Object.keys(SUB[c]).forEach(sem=>SUB[c][sem].forEach((n,i)=>db.subjects.push({id:'sb'+(++k),course:c,sem:+sem,name:n,faculty:FAC[sem][i%2]}))));

  /* students */
  const names=[
   ['Aarav Patel','M','b1','d1','two',1],['Kinjal Shah','F','b1','d1','full1',1],['Nidhi Trivedi','F','b1','d1','half',1],['Foram Pandya','F','b1','d1','part',1],['Mehul Desai','M','b1','d1','none',1],
   ['Jignesh Rana','M','b1','d2','two',1],['Hetvi Modi','F','b1','d2','two',2],['Parth Joshi','M','b1','d2','half',1],['Zalak Dave','F','b1','d2','full1',0],
   ['Riya Joshi','F','b2','d3','half',1],['Harsh Parmar','M','b2','d3','two',1],['Dhara Gajjar','F','b2','d3','none',1],['Vivek Solanki','M','b2','d3','part',1,{type:'mgmt',amount:5000,status:'pending',requestedBy:'Nilesh Prajapati'}],['Mansi Thakkar','F','b2','d3','full1',0],
   ['Pooja Rathod','F','b2','d4','half',1,{type:'gov',amount:0,status:'approved',approvedBy:'Dr. Meena Acharya'}],['Yash Chauhan','M','b2','d4','two',1],['Tanvi Raval','F','b2','d4','part',1],['Krish Amin','M','b2','d4','none',1],['Disha Bhatt','F','b2','d4','two',1,{type:'mgmt',amount:5000,status:'approved',approvedBy:'Dr. Meena Acharya'}],
   ['Dhruvi Mehta','F','b3','d5','two',1],['Kunal Bhatt','M','b3','d5','half',1],['Ankita Shukla','F','b3','d5','full1',1],
   ['Sneha Vyas','F','b4','d6','two',1],['Jay Solanki','M','b4','d6','none',1],['Hiral Jani','F','b4','d6','part',1]];
  const subj=['Science','Mathematics','English','Gujarati','Social Science','Hindi'];
  const start=addDays(T,-60);
  names.forEach((r,i)=>{
    const b=batchOf(r[2]);const sem=b.startYear===2025?3:1;const last=r[0].split(' ').pop();
    const docs={};DOCS.forEach((x,j)=>docs[x[0]]=j<5?(i%6!==4||j<3):rnd()>.6);
    const s=makeStudent({name:r[0],gender:r[1],course:b.course,batch:b.id,div:r[3],sem,dob:`${1998+Math.floor(rnd()*6)}-${pad(1+Math.floor(rnd()*12))}-${pad(1+Math.floor(rnd()*27))}`,
      category:['General','OBC (SEBC)','General','SC','EWS'][i%5],blood:['A+','B+','O+','AB+'][i%4],aadhaar:`${4000+i*37} ${1000+i*91} ${2000+i*53}`,
      phone:'9'+pad(Math.floor(rnd()*1e4),4)+' '+pad(Math.floor(rnd()*1e5),5),email:r[0].toLowerCase().replace(/\s/g,'.')+'@example.com',address:`${10+i}, Shantinagar Society`,city:'Ahmedabad',pin:'3800'+pad(10+i),
      gname:'Shri '+(['Rajesh','Kishor','Mukesh','Dinesh','Hitesh'][i%5])+' '+last,gemail:slugMail('Shri '+(['Rajesh','Kishor','Mukesh','Dinesh','Hitesh'][i%5])+' '+last)+'@example.com',gocc:['Shop owner','Teacher','Farmer','Clerk','Business'][i%5],gphone:'9'+pad(Math.floor(rnd()*1e4),4)+' '+pad(Math.floor(rnd()*1e5),5),ginc:['₹1–3 lakh','₹3–6 lakh','Below ₹1 lakh'][i%3],
      degree:['B.Sc','B.A.','B.Com'][i%3],university:'Gujarat University',year:String(2023+(i%2)),pct:String(58+Math.floor(rnd()*30)),pgPct:b.course==='med'?String(62+i%20):'',sub1:subj[i%6],sub2:subj[(i+2)%6],rank:String(100+i*17),
      id:null,docs,planName:db.plans[r[5]].name,start,concession:r[6],admittedOn:addDays(T,-62)});
    db.students.push(s);
    /* seeded payments */
    const sm=()=>feeSum(s,T);const ts0=d=>parseD(d).getTime()+(10+i%6)*3600e3;
    const pay=(daysAgo,amt,mode)=>{if(amt<=0)return;const date=addDays(T,-daysAgo);const ch=mode==='Cash'||mode==='Cheque / DD'?'counter':'online';
      const p=recordPayment(s,{amount:amt,mode,channel:ch,date,ts:ts0(date),by:'Bhavna Shukla',ref:ch==='online'?'UTR'+(300000000000+i*7919+daysAgo):(mode==='Cheque / DD'?'Cheque '+(500100+i):''),force:true,settle:daysAgo>3?'matched':'pending'});
      if(p.settle&&p.settle.status==='matched')p.settle.on=addDays(date,1)};
    const modes=['Google Pay (UPI)','Cash','Any UPI app','Cash','Cheque / DD','Card / Net banking'];const m=modes[i%6],m2=modes[(i+3)%6];
    const P=r[4],pl=s.fee.plan;
    if(P==='full1')pay(59,s.fee.total,m);
    else if(P==='half')pay(59,pl[0].amt,m);
    else if(P==='two'){pay(59,pl[0].amt,m);pay(20,pl[1].amt,m2)}
    else if(P==='part')pay(58,Math.min(8000,pl[0].amt-1000),m);
    if(i===9)pay(2,1000,'Google Pay (UPI)');
    if(i===0)pay(0,0,'Cash');
  });
  /* cash day closures for older days */
  [59,58,20].forEach(d=>{const date=addDays(T,-d);const ex=cashExpected(date);db.closures[date]={date,expected:ex,counted:ex,diff:0,reason:'',by:'Bhavna Shukla',ts:parseD(date).getTime()+18*3600e3}});
  /* attendance */
  const dates=[];for(let d=24;d>=1;d--){const dt=addDays(T,-d);if(parseD(dt).getDay()!==0)dates.push(dt)}
  const pr={};db.students.forEach(s=>pr[s.id]=0.7+rnd()*.28);
  dates.forEach(dt=>{db.attendance[dt]={};db.divisions.forEach(dv=>{const marks={};db.students.filter(s=>s.div===dv.id).forEach(s=>marks[s.id]=rnd()<pr[s.id]?'P':'A');db.attendance[dt][dv.id]={sem:db.students.find(s=>s.div===dv.id).sem,marks}})});
  /* marks */
  [['d1',3],['d2',3],['d3',1],['d5',3]].forEach(([dv,sem])=>{const d=divOf(dv);db.subjects.filter(x=>x.course===d.course&&x.sem===sem).slice(0,2).forEach(sb=>{
    const scores={};db.students.filter(s=>s.div===dv).forEach(s=>scores[s.id]=String(10+Math.floor(rnd()*10)));
    db.marks.push({id:uid('m'),divId:dv,subjectId:sb.id,sem,exam:'Internal 1',max:20,scores,by:sb.faculty})})});
  /* practice teaching */
  db.schools=[{id:'sc1',name:'Shardamandir Vidyalaya',city:'Ahmedabad',mentor:'Smt. Jayshree Parikh'},{id:'sc2',name:'Gyan Jyot High School',city:'Ahmedabad',mentor:'Shri Anil Vora'},{id:'sc3',name:'Navrachna Vidyalaya',city:'Gandhinagar',mentor:'Smt. Rupal Shah'},{id:'sc4',name:'Sarvodaya Secondary School',city:'Ahmedabad',mentor:'Shri Manoj Desai'},{id:'sc5',name:'Saraswati Shishu Mandir',city:'Gandhinagar',mentor:'Smt. Heena Trivedi'}];
  db.students.filter(s=>s.course==='bed'&&s.sem===3).forEach((s,i)=>db.practice.push({id:uid('pt'),studentId:s.id,schoolId:db.schools[i%5].id,phase:'Phase 2',start:addDays(T,-14),end:addDays(T,14),score:i<4?String(16+i):'',notes:i<4?'Lesson plans well prepared. Good class control.':''}));
  /* notices + messages + audit */
  db.notices=[{id:uid('n'),title:'Fee deadline for second installment',body:'Second installment was due 15 days ago. Please pay online from the parent portal or at the accounts counter to avoid further late fee.',audience:'all',date:addDays(T,-6),by:'Dr. Meena Acharya'},
    {id:uid('n'),title:'Practice teaching Phase 2',body:'B.Ed Semester 3 students begin Phase 2 school placement. Report to your allotted school by 9 am.',audience:'bed',date:addDays(T,-14),by:'Rajiv Bhatt'}];
  db.messages=[];db.audit=[];
  migrate();ntSeed();
  db.audit.push({id:uid('a'),ts:Date.now()-864e5,user:'System',role:'-',action:'Demo data created',detail:'25 students, 9 staff, receipts and attendance were loaded.'});
}
