'use strict';
/* =====================================================================
   NPCTE College ERP - Phase 1 demo (browser only, data in localStorage).
   Spec: docs/NPCTE-ERP-Phase1-Spec.md. Money is stored as integer paise.
   Dates are kept as ISO yyyy-mm-dd (Asia/Kolkata) and shown as DD-MM-YYYY.
   ===================================================================== */
const LS_KEY='npcte_erp_v1', SES_KEY='npcte_erp_session_v1', THEME_KEY='npcte_erp_theme', DB_VER=4;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* inr takes PAISE */
const inr=p=>{const n=Math.round(p||0)/100;return (n<0?'-':'')+'₹'+Math.abs(n).toLocaleString('en-IN',{maximumFractionDigits:2})};
const toPaise=v=>{const n=Number(String(v??'').replace(/[₹,\s]/g,''));if(!isFinite(n))return NaN;return Math.round(n*100)};
const pad=(n,l=2)=>String(n).padStart(l,'0');
const TZ='Asia/Kolkata';
/* calendar date in India for a timestamp */
const istDate=ts=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ts));const g=t=>p.find(x=>x.type===t).value;return`${g('year')}-${g('month')}-${g('day')}`};
const istTime=ts=>new Date(ts).toLocaleTimeString('en-IN',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:true});
const isoOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>istDate(Date.now());
const parseD=iso=>{const [y,m,d]=String(iso).slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(iso,n)=>{const d=parseD(iso);d.setDate(d.getDate()+n);return isoOf(d)};
const diffDays=(a,b)=>Math.round((parseD(a)-parseD(b))/864e5);
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtD=iso=>{if(!iso)return '—';const [y,m,d]=String(iso).slice(0,10).split('-');return`${d}-${m}-${y}`};
const fmtT=ts=>ts?fmtD(istDate(ts))+', '+istTime(ts):'—';
const validIso=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&isoOf(parseD(v))===v;
const uid=p=>p+Math.random().toString(36).slice(2,9);
const sum=(a,f=x=>x)=>a.reduce((s,x)=>s+(f(x)||0),0);
const initials=n=>String(n).replace(/^(Dr\.|Prof\.|Shri|Smt\.)\s+/,'').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
let _seed=11;const rnd=()=>{_seed=(_seed*16807)%2147483647;return _seed/2147483647};

/* ---------- storage ---------- */
const memStore={};
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return memStore[k]??null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);return true}catch(e){memStore[k]=v;return false}};
const lsDel=k=>{try{localStorage.removeItem(k)}catch(e){delete memStore[k]}};
/* the signed-in user lives in sessionStorage, so two tabs can hold two logins (for example Clerk + Student) and watch live updates */
const sesGet=()=>{try{return sessionStorage.getItem(SES_KEY)}catch(e){return memStore[SES_KEY]??null}};
const sesSet=v=>{try{sessionStorage.setItem(SES_KEY,v)}catch(e){memStore[SES_KEY]=v}};
const sesDel=()=>{try{sessionStorage.removeItem(SES_KEY)}catch(e){delete memStore[SES_KEY]}};
let db=null;
const SAVE_FAIL_MSG='Could not save: changes will be lost on reload';
let saveBad=false,saveTick=false;
function saveBanner(on){
  if(typeof document==='undefined'||!document.body)return;
  let b=document.getElementById('savebar');
  if(!on){if(b)b.remove();document.body.classList.remove('save-bad');return}
  if(!b){b=document.createElement('div');b.id='savebar';b.setAttribute('role','alert');b.textContent=SAVE_FAIL_MSG+'. Browser storage is full or blocked.';document.body.insertBefore(b,document.body.firstChild)}
  document.body.classList.add('save-bad');
}
function save(){if(typeof evMerge==='function')evMerge();const ok=lsSet(LS_KEY,JSON.stringify(db));saveBad=!ok;if(!ok){saveTick=true;Promise.resolve().then(()=>{saveTick=false})}saveBanner(!ok);return ok}
function load(){const raw=lsGet(LS_KEY);if(raw){try{db=JSON.parse(raw);if(db&&db.ver===DB_VER){migrate();return}}catch(e){}}seed();save()}
function migrate(){
  const s=db.settings;s.flags=Object.assign({fundingAllCategories:false,lateFee:false},s.flags||{});delete s.flags.expenseReducesDue;delete s.expenseCats;
  if(!db.outbox)db.outbox=[];if(!db.notifs)db.notifs=[];if(!db.deposits)db.deposits=[];if(!db.upiOrders)db.upiOrders=[];delete db.expenses; /* no old separate expense ledger: expenses are the expense part of a cash fee, or paid from cash in hand (change 4) */
  {const a=(db.users||[]).find(u=>u.id==='u_admin');if(a&&a.email==='admin@npcte.org')a.email='viratsathavara@gmail.com'} /* Super Admin = Virat */
  if(!db.enquiries)db.enquiries=[];if(!Array.isArray(db.events))db.events=[];
  if(!db.college.rcpt&&typeof RCPT_DEFAULT==='function')db.college.rcpt=RCPT_DEFAULT();
  db.courses.forEach(c=>{if(!c.years)c.years=Math.max(1,Math.ceil((c.semesters||4)/2));if(c.active===undefined)c.active=true;if(c.acct===undefined)c.acct={BED:'710',MED:'953'}[c.id]||''}); /* change 16: the college bank account of each course (only its 3-digit identifier is shown) */
  db.users.forEach(u=>{if(STAFF_ROLES.includes(u.role)&&!Array.isArray(u.courses))u.courses=db.courses.map(c=>c.id)});
  db.mig=db.mig||{};
  /* change 1 (21-11-2026): student passwords are set by the office only; the Principal gets the new reset permission, the Clerk does not until it is ticked */
  if(!db.mig.stuPw){db.mig.stuPw=1;const p=db.roles.Principal;if(p&&!p.includes('students.password'))p.push('students.password');db.users.forEach(u=>{if(u.role!=='Student')return;u.mustChange=false;const s=stu(u.studentId);if(s&&u.password==='student123')u.password=studentPwOf(s)})} /* only the old demo seed password moves to the rule; emailed ones stay */
  /* change 2: admission references are saved records with an id */
  if(!Array.isArray(db.refs))syncRefs();
  /* change 4 (21-11-2026): no "By Expense" mode any more. An old Expense invoice becomes a Cash invoice whose whole amount is the expense part. */
  if(!db.mig.cash){db.mig.cash=1;
    db.payments.forEach(p=>{if(p.mode!=='EXPENSE')return;p.mode='CASH';p.wasExpenseMode=true;if(!(p.expenseItems||[]).length)p.expenseItems=[{amount:p.amount,reason:p.reason||'College expense',doc:null}]});
    STAFF_ROLES.forEach(r=>{const l=db.roles[r]=db.roles[r]||[];if(!l.includes('cash.spend'))l.push('cash.spend')})}
  /* change 14 (21-11-2026): invoice numbers are typed by the office; UPI payments wait for a staff member to confirm them and add the number */
  if(!db.mig.rc14){db.mig.rc14=1;STAFF_ROLES.forEach(r=>{const l=db.roles[r]=db.roles[r]||[];if(!l.includes('fees.confirm'))l.push('fees.confirm')})}
  /* change 7: cash is managed in one place (Audit → Cash). Cheque and UPI go to the bank directly. One bank deposit can hold the fee cash and
     students' cash in hand, so cash-in-hand deposits move into db.deposits (cihLines). Viewing and depositing use the audit permissions. */
  if(!db.mig.cash7){db.mig.cash7=1;
    (cashbox().deposits||[]).forEach(d=>db.deposits.push({id:d.id,ref:d.ref,type:'CASH',course:d.course,periodFrom:d.depositedOn,periodTo:d.depositedOn,total:d.total,feeTotal:0,cihTotal:d.total,count:d.lines.length,depositedOn:d.depositedOn,bankRef:d.bankRef,by:d.by,byId:d.byId||'',at:d.at,cihLines:d.lines,demo:d.demo}));
    cashbox().deposits=[];Object.keys(db.roles).forEach(r=>{db.roles[r]=(db.roles[r]||[]).filter(k=>k!=='cash.view'&&k!=='cash.deposit')})}
  cashbox();
  /* change 5: example cash-in-hand data, once, only if nothing of the kind exists yet (a browser that already uses cash in hand is left alone) */
  if(!db.mig.cashDemo){db.mig.cashDemo=1;if(!db.payments.some(p=>payCih(p)>0)&&!cashbox().spends.length&&!db.deposits.some(d=>(d.cihLines||[]).length)){const n=seedCashDemo();if(n)log('Sample cash in hand data added','System','',null,null,n+' cash invoices with cash in hand, with expenses and a bank deposit')}}
}
const NAME_MAX=80;
const capText=(v,label,max=NAME_MAX)=>{v=String(v??'').trim();if(v.length>max)throw new Error(`${label} is too long (${v.length} characters; the limit is ${max}).`);return v};

/* ---------- roles and permissions (checked in every handler; the real server must check the same) ---------- */
const PERMS=[
 ['dashboard.view','See the dashboard'],
 ['students.view','View students'],['students.edit','Add and edit students'],['students.password','Reset student passwords and resend login details'],
 ['fees.view','Open Fee Collection'],['fees.collect','Collect payments (Cash, Cheque, UPI)'],['fees.confirm','Confirm UPI payments (add the invoice no.)'],['fees.cancel','Cancel a invoice (with reason)'],
 ['fees.editdate','Edit invoice date of Cash / Cheque'],['expenses.manage','Split a cash fee: expense now / cash in hand'],
 ['cash.spend','Add expense from cash in hand'],['fees.setup','Fee setup (default fees, due dates, UPI)'],
 ['audit.view','Transactions audit and exports'],['audit.deposit','Deposit cash to the bank'],['activity.view','Activity log (every action)'],
 ['notices.post','Post notices and fee reminders'],['enquiries.view','Admission enquiries'],
 ['settings.manage','College settings'],['roles.manage','Roles and permissions']];
const ROLE_NAMES=['Super Admin','Principal','Clerk','Student'];
const STAFF_ROLES=['Principal','Clerk'];
const ALL_STAFF_PERMS=PERMS.map(p=>p[0]);
const DEFAULT_ROLES=()=>({
 'Principal':ALL_STAFF_PERMS.slice(),
 'Clerk':['dashboard.view','students.view','students.edit','fees.view','fees.collect','fees.confirm','fees.cancel','fees.editdate','expenses.manage','cash.spend','audit.view','audit.deposit','notices.post','enquiries.view']});
const cur=()=>db&&db.users.find(u=>u.id===sesGet()&&u.active);
/* hierarchy: Super Admin > Principal > Clerk > Student. A lower role never gets a higher role's settings or sees its logs. */
const ROLE_RANK={'Super Admin':3,'Principal':2,'Clerk':1,'Student':0};
const PRINCIPAL_ONLY=['roles.manage','settings.manage','fees.setup'];
const can=p=>{const u=cur();if(!u)return false;if(u.role==='Super Admin')return true;if(u.role==='Student')return false;if(u.role==='Clerk'&&PRINCIPAL_ONLY.includes(p))return false;return (db.roles[u.role]||[]).includes(p)};
const canAny=(...p)=>p.some(can);
const need=(p,what)=>{if(!can(p))throw new Error('You do not have access'+(what?' to '+what:''))};
const isStudentUser=u=>!!u&&u.role==='Student';
/* a student login may open only its own record (spec §14: another student's id -> 403) */
const mayStudent=id=>{const u=cur();if(!u)return false;if(u.role==='Student')return !!id&&u.studentId===id;const s=stu(id);return can('students.view')&&!!s&&mayCourse(s.course)};
function guardStudent(id){if(!mayStudent(id))throw new Error('403 · You can only open your own record')}

/* ---------- lookups ---------- */
const stu=id=>db.students.find(s=>s.id===id);
const course=id=>db.courses.find(c=>c.id===id);
/* change 16: "B.Ed · A/c 710": the bank account the course's money goes to */
const courseAc=id=>{const c=course(id);return c?c.name+(c.acct?' · A/c '+c.acct:''):String(id||'')};
/* change 17: every remark on a payment (office at entry, student when paying online, office when confirming) */
const remarksText=p=>{if(!p)return'';const l=[];if(p.studentNote)l.push('Student: '+p.studentNote);if(p.note)l.push((p.studentNote||p.confirmNote?'Office: ':'')+p.note);if(p.confirmNote)l.push('At confirmation: '+p.confirmNote);return l.join(' · ')};
const CATS=['General','OBC','SC','ST','EWS'];
const fundingApplies=cat=>db.settings.flags.fundingAllCategories||cat==='SC'||cat==='ST';
const classLabel=s=>`${course(s.course).name} · Sem ${s.sem}`;
/* semesters of a course (B.Ed / M.Ed = 4; a new course such as PhD can have more) */
const semsOf=cid=>{const c=course(cid);return Array.from({length:c?c.semesters:4},(_,i)=>i+1)};

/* ---------- course scope ----------
   Super Admin: every course. Principal / Clerk: only the courses the Super Admin assigned to that login.
   The course switch in the top bar (All / B.Ed / M.Ed) narrows every screen further. The real server applies the same filter on every query. */
const SCOPE_KEY='npcte_erp_course';
const myCourses=()=>{const u=cur();if(!u)return[];if(u.role==='Super Admin')return db.courses.map(c=>c.id);
  if(u.role==='Student'){const s=stu(u.studentId);return s?[s.course]:[]}return(u.courses||[]).filter(id=>course(id))};
const pickedCourse=()=>{let v='';try{v=sessionStorage.getItem(SCOPE_KEY)||''}catch(e){v=memStore[SCOPE_KEY]||''}return myCourses().includes(v)?v:''};
function setPickedCourse(v){try{v?sessionStorage.setItem(SCOPE_KEY,v):sessionStorage.removeItem(SCOPE_KEY)}catch(e){memStore[SCOPE_KEY]=v}}
const scopeIds=()=>{const p=pickedCourse();return p?[p]:myCourses()};
const inScope=cid=>scopeIds().includes(cid);
const mayCourse=cid=>myCourses().includes(cid);
const scopeCourses=()=>db.courses.filter(c=>inScope(c.id));
const vStudents=()=>db.students.filter(s=>inScope(s.course));
const payCourse=p=>(stu(p.studentId)||{}).course;
const vPayments=()=>db.payments.filter(p=>inScope(payCourse(p)));
const scopeLabel=()=>{const p=pickedCourse();return p?course(p).name:myCourses().length===db.courses.length?'All courses':myCourses().map(id=>course(id).name).join(' + ')};
const maxSems=()=>Math.max(4,...scopeCourses().map(c=>c.semesters));
const SEMS_ALL=()=>Array.from({length:maxSems()},(_,i)=>i+1);

/* ---------- audit log: every action with before / after ---------- */
const device=()=>{const ua=navigator.userAgent;const t=/Mobi|Android|iPhone/i.test(ua)?'Phone':'Desktop';const b=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Browser';return t+' · '+b};
function log(action,entity,entityId,before,after,detail){
  const u=cur();
  db.audit.unshift({id:uid('a'),at:Date.now(),actorId:u?u.id:'',actor:u?u.name:'System',role:u?u.role:'System',action,entity:entity||'',entityId:entityId||'',before:before??null,after:after??null,detail:detail||'',ip:'127.0.0.1 (demo)',device:device()});
  if(db.audit.length>1500)db.audit.length=1500;
}
/* ---------- event log: every sign-in, page, tab, click, form, filter change and error, for every role ----------
   Kept apart from the activity log (which holds data changes with before/after). Buffered and saved every 1.5 s
   so a click does not rewrite the whole store. The real server writes these rows from the API middleware. */
const humanize=n=>String(n||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase());
const EV_MAX=4000;let evBuf=[],evTimer=0;
function ev(cat,label,detail,x){try{if(!db)return;const u=cur();
  evBuf.push({id:uid('e'),at:Date.now(),actorId:u?u.id:'',actor:u?u.name:(x&&x.who)||'Guest',role:u?u.role:'Guest',cat:cat||'Other',label:String(label||'').slice(0,80),detail:String(detail??'').slice(0,160),
    route:(typeof ui!=='undefined'&&ui.route)||'',course:(u&&typeof pickedCourse==='function'&&pickedCourse())||'',status:(x&&x.status)||'ok',device:device()});
  clearTimeout(evTimer);evTimer=setTimeout(evFlush,1500)}catch(e){}}
function evMerge(){if(!evBuf.length||!db)return;if(!Array.isArray(db.events))db.events=[];db.events.unshift(...evBuf.reverse());evBuf=[];if(db.events.length>EV_MAX)db.events.length=EV_MAX}
function evFlush(){clearTimeout(evTimer);if(evBuf.length&&db)save()}
if(typeof addEventListener==='function'){addEventListener('pagehide',evFlush);addEventListener('visibilitychange',()=>{if(typeof document!=='undefined'&&document.hidden)evFlush()})}

/* ---------- fees: per semester ---------- */
const semFee=(s,n)=>s.fees.find(f=>f.sem===n);
const okPays=s=>db.payments.filter(p=>p.studentId===s.id&&p.status==='SUCCESS');
function semSummary(s,n){
  const f=semFee(s,n);const amount=f?f.amount:0;
  const paid=sum(okPays(s).filter(p=>p.sem===n),p=>p.amount);
  const adj=0;
  const due=Math.max(0,amount-paid-adj);const dueDate=f&&f.due||'';
  const started=n<=s.sem;
  const T=today();const overdue=started&&due>0&&dueDate&&dueDate<T;
  const status=amount===0?'No fee':due===0?'Paid':paid+adj>0?'Partial':started?'Not paid':'Upcoming';
  return{sem:n,amount,paid,adj,due,dueDate,started,overdue,status};
}
function feeSum(s){
  const sems=semsOf(s.course).map(n=>semSummary(s,n));
  const cur_=sems.filter(x=>x.started);
  return{sems,total:sum(sems,x=>x.amount),paid:sum(sems,x=>x.paid),payable:s.status==='ACTIVE'?sum(cur_,x=>x.due):0,upcoming:sum(sems.filter(x=>!x.started),x=>x.due),overdue:cur_.some(x=>x.overdue)};
}
/* ---------- change 4: a cash fee can be split ----------
   Fee received in cash = expense now (spent at once, with bills) + cash in hand (kept in the college) + the rest, which goes to the bank.
   The student's fee always counts in full; the split is office bookkeeping only. */
const payExp=p=>p.mode==='CASH'?sum(p.expenseItems||[],x=>x.amount):0;
const payCih=p=>p.mode==='CASH'?(p.cih||0):0;
const payToBank=p=>p.mode==='CASH'?p.amount-payExp(p)-payCih(p):p.amount; /* cash: what the office takes to the bank; cheque and UPI reach the bank directly (change 7) */
/* fee cash still in the office waiting for the bank (change 7: only cash is deposited by the office) */
const feeCashLeft=p=>p.mode==='CASH'&&p.status==='SUCCESS'&&!p.depositId?Math.max(0,payToBank(p)):0;
/* ---------- cash in hand: one pool per course. In = cash-in-hand parts of cash invoices; out = expenses (taken from the oldest
   invoice first, so every rupee stays linked to a student) and deposits to the bank in the student's name. ---------- */
function cashbox(){if(!db.cashbox)db.cashbox={spends:[],deposits:[]};return db.cashbox}
const cihUsed=p=>sum(cashbox().spends.filter(x=>x.status==='ACTIVE'),x=>sum(x.alloc.filter(a=>a.pid===p.id),a=>a.amount));
const cihDeposited=p=>sum(db.deposits,d=>sum((d.cihLines||[]).filter(a=>a.pid===p.id),a=>a.amount));
const cihLeft=p=>p.status==='SUCCESS'?Math.max(0,payCih(p)-cihUsed(p)-cihDeposited(p)):0;
const lotOrder=(a,b)=>a.invoiceDate<b.invoiceDate?-1:a.invoiceDate>b.invoiceDate?1:(a.entryAt||0)-(b.entryAt||0);
/* cash invoices with a cash-in-hand part (oldest first), of one course, received on or before a date */
const cihLots=(cid,onDate)=>db.payments.filter(p=>p.status==='SUCCESS'&&payCih(p)>0&&(!cid||payCourse(p)===cid)&&(!onDate||p.invoiceDate<=onDate)).sort(lotOrder);
const cihBalance=(cid,onDate)=>sum(cihLots(cid,onDate),cihLeft);
/* FIFO: an expense uses the oldest student money first; it cannot use money that came in after the expense date */
function cihAllocate(cid,date,amount){
  const l=cihLots(cid,date).filter(p=>cihLeft(p)>0);const avail=sum(l,cihLeft);
  if(amount>avail)throw new Error(`Cash in hand of ${(course(cid)||{}).name||cid} on ${fmtD(date)} is ${inr(avail)}, less than ${inr(amount)}.`);
  let rest=amount;const out=[];for(const p of l){if(!rest)break;const t=Math.min(rest,cihLeft(p));out.push({pid:p.id,amount:t});rest-=t}return out;
}
/* EXP-0001 for expenses from cash in hand, DEP-0001 for its bank deposits */
function nextCashRef(k){const c=db.counters;const key='cash'+k;c[key]=(c[key]||0)+1;return k+'-'+pad(c[key],4)}
const cihLocked=p=>payCih(p)>0&&(cihUsed(p)>0||cihDeposited(p)>0);
/* invoice date rules (spec §5.2)
   CASH / CHEQUE -> the date the user enters (default today, editable later)
   UPI -> payment date in India + 1 day, never editable */
const upiInvoiceDate=paidAt=>addDays(istDate(paidAt),1);
function nextReceiptNo(){const c=db.college;const n=c.nextReceipt++;return`${c.receiptPrefix}${pad(n,4)}`} /* old automatic numbers; not used for new invoices since change 14 */
/* ---------- change 14: the invoice no. is typed by the office on every invoice ----------
   4 or 5 digits. B.Ed and M.Ed keep separate invoice books, so a number may be used once per course.
   A number counts as used even on a cancelled invoice. Old numbers (NPCTE/26-0012, 1523, 1523.0) compare by their number. */
const rcKey=rc=>{const m=String(rc||'').trim().replace(/\.0+$/,'').match(/(\d+)\D*$/);return m?String(+m[1]):''};
const rcShow=p=>p.rc||'Invoice no. pending';
function rcCheck(v,cid,exceptId){const n=String(v??'').trim();
  if(!/^\d{4,5}$/.test(n))throw new Error('Invoice no.: type 4 or 5 digits (numbers only)');
  const k=rcKey(n);const dup=db.payments.find(p=>p.id!==exceptId&&p.rc&&payCourse(p)===cid&&rcKey(p.rc)===k);
  if(dup){const s=stu(dup.studentId);throw new Error(`Invoice no. ${n} is already used (${dup.rc} · ${s?s.name:''} · ${fmtD(dup.invoiceDate)}${dup.status==='CANCELLED'?' · cancelled':''}). Check the invoice book and type the right number.`)}
  return n}
/* the last invoice no. typed in this course's invoice book, and the highest number used */
function lastRc(cid){const l=db.payments.filter(p=>p.rc&&payCourse(p)===cid);if(!l.length)return null;const at=p=>p.rcAt||p.entryAt||0;
  return{last:l.reduce((a,p)=>at(p)>=at(a)?p:a),hi:l.reduce((a,p)=>(+rcKey(p.rc)>+rcKey(a.rc)?p:a))}}
/* staff roles that hold a permission (Super Admin always): notifications "based on permission" */
const rolesWith=perm=>['Super Admin',...STAFF_ROLES.filter(r=>(db.roles[r]||[]).includes(perm)&&!(r==='Clerk'&&PRINCIPAL_ONLY.includes(perm)))];
/* batch = the student's 2-year course batch, typed by the clerk on every invoice, e.g. 2025-27 */
const courseYears=cid=>(course(cid)||{}).years||2;
const batchLabel=(cid,y)=>`${y}-${String(+y+courseYears(cid)).slice(2)}`;
const defaultBatch=s=>s&&s.admissionYear?batchLabel(s.course,s.admissionYear):'';
/* batch dropdown: 8 years back to 2 years ahead, newest first */
function batchOptions(cid){const y=+today().slice(0,4);const out=[];for(let a=y+1;a>=y-8;a--)out.push(batchLabel(cid,a));return out}
const batchOf=p=>p.batch||defaultBatch(stu(p.studentId));
function cleanBatch(v){const t=String(v||'').replace(/\s+/g,'').replace(/[–—\/]/g,'-');
  const m=t.match(/^(20\d{2})-(\d{2}|20\d{2})$/);if(!m)throw new Error('Enter the batch like 2025-27');
  const a=+m[1],b=m[2].length===4?+m[2]:Math.floor(a/100)*100+(+m[2]);if(!(b>a&&b-a<=5))throw new Error('Batch end year must be after the start year, e.g. 2025-27');
  return`${a}-${String(b).slice(2)}`}
function recordPayment(s,o){
  /* o: {sem, mode, amount(paise), invoiceDate?, chequeNo?, bank?, chequeDate?, upiRef?, providerTxnId?, note?, paidAt?} */
  const sm=semSummary(s,o.sem);
  if(!(o.amount>0))throw new Error('Enter an amount greater than zero');
  if(o.amount>sm.due)throw new Error(`Amount is more than the semester ${o.sem} due (${inr(sm.due)})`);
  /* change 14: cash / cheque need the invoice no. now; a UPI payment gets it when a staff member confirms it */
  const rc=o.mode==='UPI'?'':rcCheck(o.rc,s.course);
  const entryAt=Date.now();
  const invoiceDate=o.mode==='UPI'?upiInvoiceDate(o.paidAt||entryAt):o.invoiceDate;
  if(!validIso(invoiceDate))throw new Error('Choose a valid invoice date');
  if(o.mode!=='CASH'&&((o.expenseItems||[]).length||o.cih))throw new Error('Expense and cash in hand are only for cash');
  if(sum(o.expenseItems||[],x=>x.amount)+(o.cih||0)>o.amount)throw new Error(`Expense + cash in hand is more than the fee amount (${inr(o.amount)})`);
  const u=cur();
  const p={id:uid('p'),studentId:s.id,sem:o.sem,mode:o.mode,amount:o.amount,invoiceDate,entryAt,paidAt:o.paidAt||entryAt,
    chequeNo:o.chequeNo||'',bank:o.bank||'',chequeDate:o.chequeDate||'',upiRef:o.upiRef||'',providerTxnId:o.providerTxnId||'',note:o.note||'',
    batch:o.batch||defaultBatch(s),reason:o.reason||'',category:o.category||'',status:'SUCCESS',cancelReason:'',rc,depositId:'',by:u?u.name:'Payment gateway',byId:u?u.id:'',dateEdits:[]};
  if(rc){p.rcAt=entryAt;p.rcBy=u?u.name:''}else p.needsRc=true;
  if(o.mode==='CASH'){if((o.expenseItems||[]).length)p.expenseItems=o.expenseItems;if(o.cih>0)p.cih=o.cih}
  db.payments.push(p);
  log('Payment recorded','Payment',p.rc||('UPI '+(p.upiRef||'')),null,{student:s.enrol,batch:p.batch,sem:p.sem,mode:p.mode,amount:inr(p.amount),invoiceDate:fmtD(p.invoiceDate),
    ...(payExp(p)?{expense:inr(payExp(p))}:{}),...(payCih(p)?{cashInHand:inr(payCih(p))}:{}),...(payExp(p)||payCih(p)?{toBank:inr(payToBank(p))}:{})});
  return p;
}
function cancelPayment(p,reason){
  need('fees.cancel','cancel invoices');
  reason=capText(reason,'Reason',200);if(reason.length<4)throw new Error('Write the reason for cancelling (at least 4 characters)');
  if(p.status!=='SUCCESS')throw new Error('Only a successful invoice can be cancelled');
  if(p.depositId)throw new Error('This money is already marked as deposited. Undo the deposit first.');
  if(cihLocked(p))throw new Error('The cash in hand of this invoice is already used for an expense or deposited. Cancel that expense or undo that deposit first.');
  p.status='CANCELLED';p.cancelReason=reason;p.cancelledAt=Date.now();p.cancelledBy=cur().name;
  log('Invoice cancelled','Payment',p.rc,{status:'SUCCESS'},{status:'CANCELLED',reason});
}
function editInvoiceDate(kind,rec,iso){
  need('fees.editdate','change invoice dates');
  if(!validIso(iso))throw new Error('Choose a valid date');
  if(kind==='p'&&rec.mode==='UPI')throw new Error('UPI invoice date is fixed (payment date + 1 day)');
  if(kind==='p'&&rec.status!=='SUCCESS')throw new Error('A cancelled invoice cannot be changed');
  if(kind==='p'&&cihLocked(rec))throw new Error('The cash in hand of this invoice is already used or deposited, so its date stays as it is');
  const field=kind==='p'?'invoiceDate':'date';const old=rec[field];if(old===iso)return false;
  rec[field]=iso;(rec.dateEdits=rec.dateEdits||[]).push({at:Date.now(),from:old,to:iso,by:cur().name});
  log('Invoice date changed',kind==='p'?'Payment':'Expense',kind==='p'?rec.rc:rec.ref,{date:fmtD(old)},{date:fmtD(iso)},'Invoice regenerated');
  return true;
}

/* ---------- enrolment numbers BED25-001 ---------- */
function nextEnrol(courseId,year){const k=courseId+String(year).slice(2);const n=(db.counters.enrol[k]||0)+1;db.counters.enrol[k]=n;return`${k}-${pad(n,3)}`}
function tempPassword(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ',a='abcdefghjkmnpqrstuvwxyz',d='23456789',sy='@#$%&*!';const pick=s=>s[Math.floor(Math.random()*s.length)];
  let p=[pick(A),pick(a),pick(d),pick(sy)];const all=A+a+d+sy;while(p.length<10)p.push(pick(all));return p.sort(()=>Math.random()-.5).join('')}
/* due date of semester n: odd semesters fall in the admission's academic year (Jul-Dec), even ones in Jan-Jun of the next calendar year */
function defaultDue(courseId,year,n){const d=db.settings.dueDates[courseId]||[];const md=d[n-1]||'';if(!/^\d{2}-\d{2}$/.test(md))return'';const [m,dd]=md.split('-').map(Number);const y=+year+Math.floor((n-1)/2)+(m<7?1:0);return`${y}-${pad(m)}-${pad(dd)}`}
function makeStudent(d){
  const s={id:uid('s'),enrol:d.enrol||nextEnrol(d.course,d.admissionYear),name:d.name,gender:d.gender||'',dob:d.dob||'',phone:d.phone||'',email:d.email||'',address:d.address||'',photo:d.photo||'',
    course:d.course,admissionYear:+d.admissionYear,sem:+d.sem||1,ref:d.ref||'',refId:d.refId||'',category:d.category||'General',funding:d.funding||'CASH',scholarshipNote:d.scholarshipNote||'',status:d.status||'ACTIVE',
    createdBy:d.createdBy||'System',createdAt:d.createdAt||Date.now(),
    fees:semsOf(d.course).map(n=>({sem:n,amount:d.fees?d.fees[n-1]:(db.settings.feeDefault[d.course]||[])[n-1]||0,due:d.dues?d.dues[n-1]:defaultDue(d.course,d.admissionYear,n)}))};
  if(!fundingApplies(s.category))s.funding='CASH';
  return s;
}
/* student password rule (change 1): first 5 digits of the mobile + "@" + the year the batch starts.
   Mobile 9429086515, batch 2026-28 -> 94290@2026. Students cannot change it; only staff with students.password can reset it. */
const studentPassword=(phone,year)=>String(phone||'').replace(/\D/g,'').slice(0,5)+'@'+String(year||'').slice(0,4);
const studentPwOf=s=>studentPassword(s.phone,s.admissionYear);
function createStudentLogin(s,pw){
  const u={id:uid('u'),role:'Student',name:s.name,username:s.enrol.toLowerCase(),email:s.email,phone:s.phone,password:pw||studentPwOf(s),mustChange:false,active:true,studentId:s.id,lastLoginAt:0};
  db.users.push(u);s.userId=u.id;return u;
}
/* enrolment no. is typed by the office (change 1): letters, numbers, - and /, unique among students and logins */
const ENROL_RE=/^EN\d{8}$/;
function readEnrol(v,s){
  const en=capText(v,'Enrolment no.',20).toUpperCase();if(!en)throw new Error('Enter the enrolment no.');
  /* change 20: the college's format, e.g. EN24022032 = EN + 8 digits. An old number that is not changed is kept as it is. */
  if(!(s&&s.enrol&&s.enrol.toUpperCase()===en)&&!ENROL_RE.test(en))throw new Error('Enrolment no.: EN followed by 8 digits, e.g. EN24022032');
  if(db.students.some(x=>x!==s&&x.enrol.toUpperCase()===en))throw new Error('This enrolment no. is already used by another student');
  if(db.users.some(u=>u.username.toLowerCase()===en.toLowerCase()&&(!s||u.id!==s.userId)))throw new Error('This enrolment no. is already used as a login ID');
  return en;
}

/* ---------- admission references (change 2): each name is saved once with an id and picked from a list next time ---------- */
const refClean=n=>String(n||'').trim().replace(/\s+/g,' ');
const refKey=n=>refClean(n).toLowerCase();
const refById=id=>(db.refs||[]).find(r=>r.id===id);
const refByName=n=>{const k=refKey(n);return k?(db.refs||[]).find(r=>refKey(r.name)===k):null};
/* returns the saved reference for this name, creating it the first time the name is used */
function refEnsure(name,by){
  const n=refClean(name);if(!n)return null;let r=refByName(n);if(r)return r;
  db.counters.ref=(db.counters.ref||0)+1;r={id:'REF'+pad(db.counters.ref,3),name:n,createdAt:Date.now(),createdBy:by||'System'};db.refs.push(r);return r;
}
/* builds the list from the names already on students (old data, seed) and links every student to its reference id */
function syncRefs(){db.refs=Array.isArray(db.refs)?db.refs:[];db.students.forEach(s=>{const r=refEnsure(s.ref,s.createdBy||'Imported');s.refId=r?r.id:'';s.ref=r?r.name:''})}
const refCount=id=>db.students.filter(s=>s.refId===id).length;

/* ---------- real data from the college fee registers (tools/build_vault.py) ----------
   Every student of B.ED_2026-27.xlsx and M.ED_2026-27.xlsx with every invoice exactly as written there:
   invoice number, date, amount, semester, batch and mode. Email and mobile are test values (…test@example.com, 90000 xxxxx).
   Semester fees keep the demo default; a "Sem 1&2" invoice is stored once per semester with the same invoice number. */
let REAL=null;
/* Real fee registers (2026-27). Names, amounts, invoices, dates and payment modes come from the sheets unchanged.
   The sheets have no caste category, scholarship or bank-deposit columns, so for the demo these are filled in a
   fixed, repeatable way (same student always gets the same value) so every screen has something to show:
   - category: about 30% General, 35% OBC, 12% SC, 13% ST, 10% EWS (both courses get all five)
   - SC/ST: about 6 in 10 marked "By Scholarship" (government post-matric scholarship), the rest "By Cash"
   - cash + cheque collections are marked as deposited in the bank early the next month, except last month and
     this month, which stay "not deposited" so the deposit screen has pending money to show
   - each expense invoice gets its expense line(s) from the register's remark, so the invoice shows "used for" */
const DEMO_CATS=[['General',30],['OBC',35],['SC',12],['ST',13],['EWS',10]];
const nameHash=t=>{let h=2166136261;for(const c of String(t))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
function demoCategory(r){let x=nameHash(r.name+'|'+r.ref)%100;for(const[c,w]of DEMO_CATS){if(x<w)return c;x-=w}return'General'}
const regExpText=t=>String(t||'').replace(/^\s*BY\s*EXP[\s.:-]*/i,'').replace(/\s+/g,' ').trim()||'College expense';
/* remarks whose parts add up exactly are split into lines; others stay one line with the register's text */
function expItems(x){
  const t=regExpText(x.reason);
  if(/15 AUGUST/i.test(t)&&x.amt===500000)return[['Costume',200000],['Badges (billa)',48000],['Method room cleaning',120000],['New water jug and ball pens',100000],['Revenue ticket',32000]].map(([r,a])=>({reason:'15 August 2026: '+r,amount:a,doc:null}));
  return[{reason:t.length>150?t.slice(0,147)+'...':t,amount:x.amt,doc:null}]}
function seedReal(R){
  const by=db.users.find(u=>u.id==='u_clerk');const [ty,tm]=today().split('-').map(Number);
  const curSem=(cid,a)=>{const n=(course(cid)||{}).semesters||4;return Math.min(n,Math.max(1,Math.floor(((ty-a)*12+(tm-7))/6)+1))};
  const list=R.students.map(r=>{
    const cat=demoCategory(r),sch=(cat==='SC'||cat==='ST')&&nameHash(r.name)%10<6;
    const s=makeStudent({name:r.name,phone:r.phone,email:r.email,course:r.course,admissionYear:r.adm,sem:curSem(r.course,r.adm),category:cat,funding:sch?'SCHOLARSHIP':'CASH',
      scholarshipNote:sch?'Government post-matric scholarship (Digital Gujarat)':'',ref:r.ref,createdBy:'Imported from fee register 2026-27'});
    db.students.push(s);createStudentLogin(s);return s});
  R.payments.forEach(x=>{const s=list[x.s];const ts=Date.parse(x.date+'T11:00:00+05:30');
    const p={id:uid('p'),studentId:s.id,sem:x.sem,mode:x.mode,amount:x.amt,invoiceDate:x.date,entryAt:ts,paidAt:ts,chequeNo:x.chq||'',bank:'',chequeDate:x.mode==='CHEQUE'?x.date:'',upiRef:'',providerTxnId:'',note:x.note||'',
      status:'SUCCESS',cancelReason:'',rc:x.rc,depositId:'',by:by?by.name:'Accounts Clerk',byId:by?by.id:'',dateEdits:[],batch:x.batch,reason:x.reason||'',category:'',imported:true};
    /* change 4: a register line "BY EXP" is a cash fee that was spent at once -> Cash invoice, whole amount as the expense part */
    if(x.mode==='EXPENSE'){p.mode='CASH';p.wasExpenseMode=true;p.expenseItems=expItems(x);p.reason=p.expenseItems.map(i=>i.reason).join('; ').slice(0,300)}
    db.payments.push(p)});
  /* bank deposits: one per month up to two months ago (cash + cheque), made on the 3rd of the next month */
  const lastMonth=addDays(today().slice(0,7)+'-01',-1).slice(0,7);const months={};
  db.payments.forEach(p=>{if(p.mode==='CASH'&&payToBank(p)>0&&p.invoiceDate.slice(0,7)<lastMonth)(months[p.invoiceDate.slice(0,7)]=months[p.invoiceDate.slice(0,7)]||[]).push(p)});
  Object.keys(months).sort().forEach((m,i)=>{const l=months[m];const [y,mo]=m.split('-').map(Number);const nx=mo===12?`${y+1}-01`:`${y}-${pad(mo+1)}`;
    const on=nx+'-03';const dp={id:uid('d'),type:[...new Set(l.map(p=>p.mode))].join('+'),periodFrom:m+'-01',periodTo:addDays(nx+'-01',-1),total:sum(l,payToBank),depositedOn:on,
      bankRef:`SBI slip ${55800+i*17}`,by:by?by.name:'Accounts Clerk',at:Date.parse(on+'T15:00:00+05:30'),count:l.length};
    db.deposits.push(dp);l.forEach(p=>p.depositId=dp.id)});
}

/* ---------- change 5: example cash in hand, so the screens show how it works ----------
   The fee registers have no cash-in-hand column, so for the demo a few cash invoices per course get one, in a fixed,
   repeatable way (marked demoSplit:true): up to 6 students per course, spread over the dates; 2 of them also have an
   "expense now" part. Then expenses are paid from cash in hand (oldest student money first) and one student's money
   left is deposited to the bank in that student's name; the rest stays in cash in hand.
   Only cash invoices not yet marked as deposited are used, so bank deposits already made do not change. Bills: none. */
const DEMO_CIH=[500000,1000000,1500000,300000,800000,500000];
const DEMO_EXP_NOW={1:'Practical file printing for the class',4:'University exam form fees'};
const DEMO_SPENDS=[[['Stationery and printing for the office',350000]],[['Water cooler repair',400000],['Electrician charges',200000]],
  [['Annual function decoration',450000]],[['Guest lecture: tea and refreshments',250000]],[['Exam hall arrangements: seating charts and bell',300000]]];
function seedCashDemo(){
  const by=db.users.find(u=>u.id==='u_clerk')||db.users.find(u=>u.role==='Clerk')||{name:'Accounts Clerk',id:''};const T=today();let count=0;
  const at=d=>Date.parse(d+'T15:30:00+05:30');
  db.courses.forEach(c=>{
    const seen=new Set();
    const cands=db.payments.filter(p=>p.status==='SUCCESS'&&p.mode==='CASH'&&payCourse(p)===c.id&&!(p.expenseItems||[]).length&&!p.cih&&!p.depositId&&p.amount>=1000000&&p.invoiceDate<=T)
      .sort(lotOrder).filter(p=>!seen.has(p.studentId)&&seen.add(p.studentId));
    if(cands.length<2)return;
    const k=Math.min(DEMO_CIH.length,cands.length);const picks=[...Array(k).keys()].map(i=>cands[Math.floor(i*cands.length/k)]);
    picks.forEach((p,i)=>{const exp=DEMO_EXP_NOW[i]?200000:0;
      if(exp){p.expenseItems=[{amount:exp,reason:DEMO_EXP_NOW[i],doc:null}];if(!p.reason)p.reason=DEMO_EXP_NOW[i]}
      p.cih=Math.min(DEMO_CIH[i],p.amount-exp);p.demoSplit=true;count++});
    /* expenses: each one a couple of days after a later invoice, never more than what is in hand on that date */
    DEMO_SPENDS.forEach((lines,j)=>{const lot=picks[Math.min(j+1,picks.length-1)];let d=addDays(lot.invoiceDate,2+j);if(d>T)d=T;
      const want=sum(lines,l=>l[1]);const have=cihBalance(c.id,d);if(have<want)return;
      const spent=sum(cashbox().spends.filter(x=>x.course===c.id),x=>x.amount);if(spent+want>sum(picks,payCih)*(picks.length>=5?.6:.4))return; /* keep enough in hand (two students) so a deposit can be shown */
      cashbox().spends.push({id:uid('x'),ref:nextCashRef('EXP'),course:c.id,date:d,items:lines.map(([reason,amount])=>({amount,reason,doc:null})),amount:want,alloc:cihAllocate(c.id,d,want),by:by.name,byId:by.id,at:at(d),status:'ACTIVE',demo:true})});
    /* one bank deposit: the whole money left of the second-newest student, in that student's name */
    const open=picks.filter(p=>cihLeft(p)>0).sort(lotOrder);const dl=open.length>1?open[open.length-2]:null;
    if(dl){let d=addDays(dl.invoiceDate,7);if(d>T)d=T;const spentAfter=cashbox().spends.filter(x=>x.course===c.id).map(x=>x.date).sort().pop();if(spentAfter&&d<spentAfter)d=spentAfter;
      const amt=cihLeft(dl);db.deposits.push({id:uid('d'),ref:nextCashRef('DEP'),type:'CASH',course:c.id,periodFrom:dl.invoiceDate,periodTo:dl.invoiceDate,total:amt,feeTotal:0,cihTotal:amt,count:1,depositedOn:d,bankRef:'SBI slip '+(60100+count),cihLines:[{pid:dl.id,amount:amt}],by:by.name,byId:by.id,at:at(d)+3600e3,demo:true})}
  });
  return count;
}

/* ---------- sample data (spec §12: 1 Super Admin, 1 Principal, 1 Clerk, ~20 students, all 4 modes, a few notices) ---------- */
function seed(){
  _seed=11;const T=today();const Y=+T.slice(0,4);const yNow=+T.slice(5,7)>=7?Y:Y-1;
  db={ver:DB_VER,
    college:{name:"The New Progressive College of Teachers' Education",short:'NPCTE',trust:'Karve Trust',address:"'PRASAD' Building, Karve Campus, Mahesana 384001",phone:'02762 220395',email:'npcte@yahoo.co.in',website:'https://npcte.org',receiptPrefix:'NPCTE/'+String(yNow).slice(2)+'-',nextReceipt:1,year:`${yNow}-${String(yNow+1).slice(2)}`},
    settings:{feeDefault:{BED:[3000000,3000000,3000000,3000000],MED:[3000000,3000000,3000000,3000000]},
      dueDates:{BED:['11-15','04-30','11-15','04-30'],MED:['11-15','04-30','11-15','04-30']},reminderDays:7,
      flags:{fundingAllCategories:false,lateFee:false},
      upi:{provider:'Razorpay',vpa:'npcte@okaxis',mode:'Sandbox',googlePay:false},
      mail:{mode:'demo',fromName:"NPCTE Accounts",replyTo:'npcte@yahoo.co.in',sendReceipts:true,sendCredentials:true},
      sound:true},
    courses:[{id:'BED',name:'B.Ed',semesters:4,years:2,active:true,acct:'710'},{id:'MED',name:'M.Ed',semesters:4,years:2,active:true,acct:'953'}],
    roles:DEFAULT_ROLES(),
    users:[
      {id:'u_admin',role:'Super Admin',name:'Virat Sathavara',username:'admin',email:'viratsathavara@gmail.com',phone:'',password:'admin123',mustChange:false,active:true,lastLoginAt:0},
      {id:'u_prin',role:'Principal',name:'Principal, B.Ed',username:'principal',email:'principal@npcte.org',phone:'',password:'principal123',mustChange:false,active:true,lastLoginAt:0,courses:['BED']},
      {id:'u_prinm',role:'Principal',name:'Principal, M.Ed',username:'principalmed',email:'principal.med@npcte.org',phone:'',password:'principal123',mustChange:false,active:true,lastLoginAt:0,courses:['MED']},
      {id:'u_clerk',role:'Clerk',name:'Accounts Clerk',username:'clerk',email:'accounts@npcte.org',phone:'',password:'clerk123',mustChange:false,active:true,lastLoginAt:0,courses:['BED','MED']}],
    students:[],refs:[],payments:[],deposits:[],notices:[],notifs:[],audit:[],events:[],outbox:[],upiOrders:[],enquiries:[],
    cashbox:{spends:[],deposits:[]},counters:{enrol:{},exp:1,ref:0},mig:{stuPw:1,cash:1,cashDemo:1,cash7:1}};
  /* real college data (fee registers 2026-27), available only after the password gate has decrypted it */
  if(typeof REAL!=='undefined'&&REAL){seedReal(REAL)}else{
  /* sample names only (demo) */
  const names=[['Riya Joshi','F'],['Hardik Patel','M'],['Kinjal Prajapati','F'],['Mehul Chaudhary','M'],['Nirali Desai','F'],['Jignesh Rabari','M'],['Pooja Solanki','F'],['Ankit Thakor','M'],['Bhumi Modi','F'],['Kaushal Vaghela','M'],
    ['Dhara Shah','F'],['Nikunj Parmar','M'],['Foram Raval','F'],['Ravi Makwana','M'],['Krupa Trivedi','F'],['Vishal Dabhi','M'],['Sneha Panchal','F'],['Darshan Zala','M'],['Hetal Barot','F'],['Sagar Vankar','M']];
  const cats=['General','OBC','SC','General','EWS','ST','OBC','SC','General','ST','General','OBC','SC','EWS','General','ST','OBC','General','SC','OBC'];
  names.forEach(([n,g],i)=>{
    const c=i<13?'BED':'MED';const yr=i%2?yNow-1:yNow;const sem=yr===yNow?1:3;const cat=cats[i];
    const fees=[3000000,3000000,3000000,3000000];if(i===4)fees[1]=2500000;if(i===9)fees.fill(2000000);
    const s=makeStudent({name:n,gender:g,dob:`${2000+(i%5)}-${pad(1+i%12)}-${pad(3+i)}`,phone:'98'+String(25000000+i*7919).padStart(8,'0'),email:n.toLowerCase().replace(/\s+/g,'.')+'@example.com',address:['Mahesana','Visnagar','Unjha','Kadi','Patan'][i%5]+', Gujarat',
      course:c,admissionYear:yr,sem,category:cat,funding:(cat==='SC'||cat==='ST')&&i%2===0?'SCHOLARSHIP':'CASH',scholarshipNote:(cat==='SC'||cat==='ST')&&i%2===0?'Government post-matric scholarship':'',fees,createdBy:'System',createdAt:Date.now()-(40-i)*864e5});
    db.students.push(s);createStudentLogin(s);
    s.cred={status:'Sent (demo)',at:Date.now()-(40-i)*864e5,to:s.email};
  });
  /* payments in all 4 modes, dated in the last few weeks */
  const by=db.users.find(u=>u.id==='u_clerk')||db.users[2]; /* sample invoices are entered by the Accounts Clerk */const mk=(s,sem,mode,amt,dAgo,extra={})=>{const ts=Date.now()-dAgo*864e5-3600e3*(1+(dAgo%5));const inv=mode==='UPI'?upiInvoiceDate(ts):addDays(today(),-dAgo-(extra.back||0));
    db.payments.push(Object.assign({id:uid('p'),studentId:s.id,sem,mode,amount:amt,invoiceDate:inv,entryAt:ts,paidAt:ts,chequeNo:'',bank:'',chequeDate:'',upiRef:'',providerTxnId:'',note:'',status:'SUCCESS',cancelReason:'',rc:pad(db.college.nextReceipt++,4),depositId:'',by:mode==='UPI'?'Payment gateway':by.name,byId:mode==='UPI'?'':by.id,dateEdits:[],batch:defaultBatch(s),reason:'',category:''},extra.f||{}))};
  const S=db.students;
  S.forEach((s,i)=>{
    const f1=semFee(s,1).amount;
    if(i%5===0)mk(s,1,'UPI',f1,2+i);
    else if(i%5===1)mk(s,1,'CASH',f1,3+i,{back:i%3});
    else if(i%5===2)mk(s,1,'CHEQUE',Math.round(f1/2),4+i,{f:{chequeNo:String(100200+i),bank:['SBI','Bank of Baroda','Mehsana Urban Co-op Bank'][i%3],chequeDate:addDays(today(),-6-i)}});
    else if(i%5===3)mk(s,1,'CASH',1500000,1+i);
    else if(i%10===4){const r=['Exam form fees paid to the university','Practice-teaching school material'][i%2];mk(s,1,'CASH',1000000,5+i,{f:{reason:r,expenseItems:[{amount:1000000,reason:r,doc:null}]}})}
    if(s.sem===3){mk(s,2,i%2?'UPI':'CASH',semFee(s,2).amount,60+i);const r1=semSummary(s,1).due;if(r1>0)mk(s,1,'CASH',r1,200+i)}
  });
  /* one cancelled invoice */
  const pc=db.payments.find(p=>p.mode==='CASH');if(pc){const s=stu(pc.studentId);const extra={id:uid('p'),studentId:s.id,sem:pc.sem,mode:'CASH',amount:500000,invoiceDate:addDays(today(),-9),entryAt:Date.now()-9*864e5,paidAt:Date.now()-9*864e5,chequeNo:'',bank:'',chequeDate:'',upiRef:'',providerTxnId:'',note:'',status:'CANCELLED',cancelReason:'Entered twice by mistake',cancelledAt:Date.now()-9*864e5+6e5,cancelledBy:by.name,rc:pad(db.college.nextReceipt++,4),depositId:'',by:by.name,byId:by.id,dateEdits:[]};db.payments.push(extra)}
  db.payments.forEach(p=>{if(p.mode==='UPI'){p.upiRef='UTR'+String(400000000000+Math.floor(rnd()*9e10));p.providerTxnId='pay_'+Math.floor(rnd()*1e12).toString(36)}});
  /* change 14 (sample only): the newest UPI payment was paid from the student portal and waits for the office to confirm it and add the invoice no. */
  {const up=db.payments.filter(p=>p.mode==='UPI'&&p.status==='SUCCESS').sort((a,b)=>b.entryAt-a.entryAt)[0];if(up){up.rc='';up.needsRc=true;up.by='UPI · student portal'}}
  /* an older deposit so the report shows both deposited and pending money */
  const old=db.payments.filter(p=>p.status==='SUCCESS'&&p.mode==='CASH'&&payToBank(p)>0&&diffDays(today(),p.invoiceDate)>40);
  if(old.length){const dp={id:uid('d'),type:'CASH',periodFrom:old.map(p=>p.invoiceDate).sort()[0],periodTo:addDays(today(),-41),total:sum(old,payToBank),depositedOn:addDays(today(),-40),bankRef:'SBI slip 55821',by:by.name,at:Date.now()-40*864e5,count:old.length};db.deposits.push(dp);old.forEach(p=>p.depositId=dp.id)}
  }
  seedCashDemo(); /* change 5: example cash in hand (both the real registers and the sample data) */
  /* notices */
  db.notices=[
    {id:uid('n'),title:'Semester 1 fee – last date',body:'All B.Ed and M.Ed Semester 1 students: please pay the semester fee at the accounts office or online (UPI) by the last date. Keep the invoice for your record.',audience:{type:'all'},isFeeAlert:true,isPublic:false,publishAt:Date.now()-3*864e5,createdBy:'Principal, NPCTE',attachment:null},
    {id:uid('n'),title:'Internship (practice teaching) orientation',body:'B.Ed Semester 3 students must attend the orientation in the seminar hall on Monday at 10:30 am.',audience:{type:'sem',course:'BED',sem:3},isFeeAlert:false,isPublic:false,publishAt:Date.now()-6*864e5,createdBy:'Principal, NPCTE',attachment:null},
    {id:uid('n'),title:'Library timings',body:'The college library is open from 9:00 am to 5:00 pm on all working days.',audience:{type:'all'},isFeeAlert:false,isPublic:true,publishAt:Date.now()-10*864e5,createdBy:'Accounts Clerk',attachment:null}];
  if(typeof RCPT_DEFAULT==='function')db.college.rcpt=RCPT_DEFAULT();
  db.audit=[];log(REAL?'Fee registers imported':'Sample data loaded','System','',null,null,REAL?`${db.students.length} students, ${db.payments.length} payment records from ${REAL.source}`:'Demo data created');
  syncRefs();
  if(typeof ntSeed==='function')ntSeed();
}
