'use strict';
/* =====================================================================
   NPCTE College ERP - Phase 1 demo (browser only, data in localStorage).
   Spec: docs/NPCTE-ERP-Phase1-Spec.md. Money is stored as integer paise.
   Dates are kept as ISO yyyy-mm-dd (Asia/Kolkata) and shown as DD-MM-YYYY.
   ===================================================================== */
const LS_KEY='npcte_erp_v1', SES_KEY='npcte_erp_session_v1', THEME_KEY='npcte_erp_theme', DB_VER=1;
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
function save(){const ok=lsSet(LS_KEY,JSON.stringify(db));saveBad=!ok;if(!ok){saveTick=true;Promise.resolve().then(()=>{saveTick=false})}saveBanner(!ok);return ok}
function load(){const raw=lsGet(LS_KEY);if(raw){try{db=JSON.parse(raw);if(db&&db.ver===DB_VER){migrate();return}}catch(e){}}seed();save()}
function migrate(){
  const s=db.settings;s.flags=Object.assign({expenseReducesDue:false,fundingAllCategories:false,lateFee:false},s.flags||{});
  if(!db.outbox)db.outbox=[];if(!db.notifs)db.notifs=[];if(!db.deposits)db.deposits=[];if(!db.upiOrders)db.upiOrders=[];if(!db.expenses)db.expenses=[];
  if(!db.enquiries)db.enquiries=[];
}
const NAME_MAX=80;
const capText=(v,label,max=NAME_MAX)=>{v=String(v??'').trim();if(v.length>max)throw new Error(`${label} is too long (${v.length} characters; the limit is ${max}).`);return v};

/* ---------- roles and permissions (checked in every handler; the real server must check the same) ---------- */
const PERMS=[
 ['dashboard.view','See the dashboard'],
 ['students.view','View students'],['students.edit','Add and edit students, resend logins'],
 ['fees.view','Open Fee Collection'],['fees.collect','Collect payments (Cash, Cheque, UPI)'],['fees.cancel','Cancel a receipt (with reason)'],
 ['fees.editdate','Edit invoice date of Cash / Cheque / Expense'],['expenses.manage','Add expenses'],['fees.setup','Fee setup (default fees, receipt prefix, UPI)'],
 ['audit.view','Transactions audit and exports'],['audit.deposit','Mark cash / cheque as deposited'],['activity.view','Activity log (every action)'],
 ['notices.post','Post notices and fee reminders'],['enquiries.view','Admission enquiries'],
 ['settings.manage','College settings'],['roles.manage','Roles and permissions']];
const ROLE_NAMES=['Super Admin','Principal','Clerk','Student'];
const STAFF_ROLES=['Principal','Clerk'];
const ALL_STAFF_PERMS=PERMS.map(p=>p[0]);
const DEFAULT_ROLES=()=>({
 'Principal':ALL_STAFF_PERMS.slice(),
 'Clerk':['dashboard.view','students.view','students.edit','fees.view','fees.collect','fees.cancel','fees.editdate','expenses.manage','audit.view','audit.deposit','notices.post','enquiries.view']});
const cur=()=>db&&db.users.find(u=>u.id===sesGet()&&u.active);
const can=p=>{const u=cur();if(!u)return false;if(u.role==='Super Admin')return true;if(u.role==='Student')return false;return (db.roles[u.role]||[]).includes(p)};
const canAny=(...p)=>p.some(can);
const need=(p,what)=>{if(!can(p))throw new Error('You do not have access'+(what?' to '+what:''))};
const isStudentUser=u=>!!u&&u.role==='Student';
/* a student login may open only its own record (spec §14: another student's id -> 403) */
const mayStudent=id=>{const u=cur();if(!u)return false;if(u.role==='Student')return !!id&&u.studentId===id;return can('students.view')};
function guardStudent(id){if(!mayStudent(id))throw new Error('403 · You can only open your own record')}

/* ---------- lookups ---------- */
const stu=id=>db.students.find(s=>s.id===id);
const course=id=>db.courses.find(c=>c.id===id);
const CATS=['General','OBC','SC','ST','EWS'];
const fundingApplies=cat=>db.settings.flags.fundingAllCategories||cat==='SC'||cat==='ST';
const classLabel=s=>`${course(s.course).name} · Sem ${s.sem}`;

/* ---------- audit log: every action with before / after ---------- */
const device=()=>{const ua=navigator.userAgent;const t=/Mobi|Android|iPhone/i.test(ua)?'Phone':'Desktop';const b=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Browser';return t+' · '+b};
function log(action,entity,entityId,before,after,detail){
  const u=cur();
  db.audit.unshift({id:uid('a'),at:Date.now(),actorId:u?u.id:'',actor:u?u.name:'System',role:u?u.role:'System',action,entity:entity||'',entityId:entityId||'',before:before??null,after:after??null,detail:detail||'',ip:'127.0.0.1 (demo)',device:device()});
  if(db.audit.length>1500)db.audit.length=1500;
}
/* kept for the shared UI plumbing: page views and clicks are not stored in this build */
const humanize=n=>String(n||'').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase());
function ev(){}
function evFlush(){}
const EV_KEY='npcte_events_unused';let evBuf=[];

/* ---------- fees: per semester ---------- */
const semFee=(s,n)=>s.fees.find(f=>f.sem===n);
const okPays=s=>db.payments.filter(p=>p.studentId===s.id&&p.status==='SUCCESS');
function semSummary(s,n){
  const f=semFee(s,n);const amount=f?f.amount:0;
  const paid=sum(okPays(s).filter(p=>p.sem===n),p=>p.amount);
  const adj=db.settings.flags.expenseReducesDue?sum(db.expenses.filter(x=>x.studentId===s.id&&x.sem===n),x=>x.amount):0;
  const due=Math.max(0,amount-paid-adj);const dueDate=f&&f.due||'';
  const started=n<=s.sem;
  const T=today();const overdue=started&&due>0&&dueDate&&dueDate<T;
  const status=amount===0?'No fee':due===0?'Paid':paid+adj>0?'Partial':started?'Not paid':'Upcoming';
  return{sem:n,amount,paid,adj,due,dueDate,started,overdue,status};
}
function feeSum(s){
  const sems=[1,2,3,4].map(n=>semSummary(s,n));
  const cur_=sems.filter(x=>x.started);
  return{sems,total:sum(sems,x=>x.amount),paid:sum(sems,x=>x.paid),payable:s.status==='ACTIVE'?sum(cur_,x=>x.due):0,upcoming:sum(sems.filter(x=>!x.started),x=>x.due),overdue:cur_.some(x=>x.overdue)};
}
/* invoice date rules (spec §5.2)
   CASH / CHEQUE / EXPENSE -> the date the user enters (default today, editable later)
   UPI -> payment date in India + 1 day, never editable */
const upiInvoiceDate=paidAt=>addDays(istDate(paidAt),1);
function nextReceiptNo(){const c=db.college;const n=c.nextReceipt++;return`${c.receiptPrefix}${pad(n,4)}`}
function recordPayment(s,o){
  /* o: {sem, mode, amount(paise), invoiceDate?, chequeNo?, bank?, chequeDate?, upiRef?, providerTxnId?, note?, paidAt?} */
  const sm=semSummary(s,o.sem);
  if(!(o.amount>0))throw new Error('Enter an amount greater than zero');
  if(o.amount>sm.due)throw new Error(`Amount is more than the semester ${o.sem} due (${inr(sm.due)})`);
  const entryAt=Date.now();
  const invoiceDate=o.mode==='UPI'?upiInvoiceDate(o.paidAt||entryAt):o.invoiceDate;
  if(!validIso(invoiceDate))throw new Error('Choose a valid invoice date');
  const u=cur();
  const p={id:uid('p'),studentId:s.id,sem:o.sem,mode:o.mode,amount:o.amount,invoiceDate,entryAt,paidAt:o.paidAt||entryAt,
    chequeNo:o.chequeNo||'',bank:o.bank||'',chequeDate:o.chequeDate||'',upiRef:o.upiRef||'',providerTxnId:o.providerTxnId||'',note:o.note||'',
    status:'SUCCESS',cancelReason:'',rc:nextReceiptNo(),depositId:'',by:u?u.name:'Payment gateway',byId:u?u.id:'',dateEdits:[]};
  db.payments.push(p);
  log('Payment recorded','Payment',p.rc,null,{student:s.enrol,sem:p.sem,mode:p.mode,amount:inr(p.amount),invoiceDate:fmtD(p.invoiceDate)});
  return p;
}
function cancelPayment(p,reason){
  need('fees.cancel','cancel receipts');
  reason=capText(reason,'Reason',200);if(reason.length<4)throw new Error('Write the reason for cancelling (at least 4 characters)');
  if(p.status!=='SUCCESS')throw new Error('Only a successful receipt can be cancelled');
  if(p.depositId)throw new Error('This money is already marked as deposited. Undo the deposit first.');
  p.status='CANCELLED';p.cancelReason=reason;p.cancelledAt=Date.now();p.cancelledBy=cur().name;
  log('Receipt cancelled','Payment',p.rc,{status:'SUCCESS'},{status:'CANCELLED',reason});
}
function editInvoiceDate(kind,rec,iso){
  need('fees.editdate','change invoice dates');
  if(!validIso(iso))throw new Error('Choose a valid date');
  if(kind==='p'&&rec.mode==='UPI')throw new Error('UPI invoice date is fixed (payment date + 1 day)');
  if(kind==='p'&&rec.status!=='SUCCESS')throw new Error('A cancelled receipt cannot be changed');
  const field=kind==='p'?'invoiceDate':'date';const old=rec[field];if(old===iso)return false;
  rec[field]=iso;(rec.dateEdits=rec.dateEdits||[]).push({at:Date.now(),from:old,to:iso,by:cur().name});
  log('Invoice date changed',kind==='p'?'Payment':'Expense',kind==='p'?rec.rc:rec.ref,{date:fmtD(old)},{date:fmtD(iso)},'Receipt regenerated');
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
    course:d.course,admissionYear:+d.admissionYear,sem:+d.sem||1,category:d.category||'General',funding:d.funding||'CASH',scholarshipNote:d.scholarshipNote||'',status:d.status||'ACTIVE',
    createdBy:d.createdBy||'System',createdAt:d.createdAt||Date.now(),
    fees:[1,2,3,4].map(n=>({sem:n,amount:d.fees?d.fees[n-1]:db.settings.feeDefault[d.course][n-1],due:d.dues?d.dues[n-1]:defaultDue(d.course,d.admissionYear,n)}))};
  if(!fundingApplies(s.category))s.funding='CASH';
  return s;
}
function createStudentLogin(s,pw,must){
  const u={id:uid('u'),role:'Student',name:s.name,username:s.enrol.toLowerCase(),email:s.email,phone:s.phone,password:pw,mustChange:must,active:true,studentId:s.id,lastLoginAt:0};
  db.users.push(u);s.userId=u.id;return u;
}

/* ---------- sample data (spec §12: 1 Super Admin, 1 Principal, 1 Clerk, ~20 students, all 4 modes, a few notices) ---------- */
function seed(){
  _seed=11;const T=today();const Y=+T.slice(0,4);const yNow=+T.slice(5,7)>=7?Y:Y-1;
  db={ver:DB_VER,
    college:{name:"The New Progressive College of Teachers' Education",short:'NPCTE',trust:'Karve Trust',address:"'PRASAD' Building, Karve Campus, Mahesana 384001",phone:'02762 220395',email:'npcte@yahoo.co.in',website:'https://npcte.org',receiptPrefix:'NPCTE/'+String(yNow).slice(2)+'-',nextReceipt:1,year:`${yNow}-${String(yNow+1).slice(2)}`},
    settings:{feeDefault:{BED:[3000000,3000000,3000000,3000000],MED:[3000000,3000000,3000000,3000000]},
      dueDates:{BED:['11-15','04-30','11-15','04-30'],MED:['11-15','04-30','11-15','04-30']},reminderDays:7,
      flags:{expenseReducesDue:false,fundingAllCategories:false,lateFee:false},
      upi:{provider:'Razorpay',vpa:'npcte@okaxis',mode:'Sandbox',googlePay:false},
      mail:{mode:'demo',fromName:"NPCTE Accounts",replyTo:'npcte@yahoo.co.in',sendReceipts:true,sendCredentials:true},
      sound:true,expenseCats:['Purchase','Fee adjustment','Maintenance','Other']},
    courses:[{id:'BED',name:'B.Ed',semesters:4},{id:'MED',name:'M.Ed',semesters:4}],
    roles:DEFAULT_ROLES(),
    users:[
      {id:'u_admin',role:'Super Admin',name:'Virat Sathavara',username:'admin',email:'admin@npcte.org',phone:'',password:'admin123',mustChange:false,active:true,lastLoginAt:0},
      {id:'u_prin',role:'Principal',name:'Principal, NPCTE',username:'principal',email:'principal@npcte.org',phone:'',password:'principal123',mustChange:false,active:true,lastLoginAt:0},
      {id:'u_clerk',role:'Clerk',name:'Accounts Clerk',username:'clerk',email:'accounts@npcte.org',phone:'',password:'clerk123',mustChange:false,active:true,lastLoginAt:0}],
    students:[],payments:[],expenses:[],deposits:[],notices:[],notifs:[],audit:[],outbox:[],upiOrders:[],enquiries:[],
    counters:{enrol:{},exp:1}};
  /* sample names only (demo) */
  const names=[['Riya Joshi','F'],['Hardik Patel','M'],['Kinjal Prajapati','F'],['Mehul Chaudhary','M'],['Nirali Desai','F'],['Jignesh Rabari','M'],['Pooja Solanki','F'],['Ankit Thakor','M'],['Bhumi Modi','F'],['Kaushal Vaghela','M'],
    ['Dhara Shah','F'],['Nikunj Parmar','M'],['Foram Raval','F'],['Ravi Makwana','M'],['Krupa Trivedi','F'],['Vishal Dabhi','M'],['Sneha Panchal','F'],['Darshan Zala','M'],['Hetal Barot','F'],['Sagar Vankar','M']];
  const cats=['General','OBC','SC','General','EWS','ST','OBC','SC','General','ST','General','OBC','SC','EWS','General','ST','OBC','General','SC','OBC'];
  names.forEach(([n,g],i)=>{
    const c=i<13?'BED':'MED';const yr=i%2?yNow-1:yNow;const sem=yr===yNow?1:3;const cat=cats[i];
    const fees=[3000000,3000000,3000000,3000000];if(i===4)fees[1]=2500000;if(i===9)fees.fill(2000000);
    const s=makeStudent({name:n,gender:g,dob:`${2000+(i%5)}-${pad(1+i%12)}-${pad(3+i)}`,phone:'98'+String(25000000+i*7919).padStart(8,'0'),email:n.toLowerCase().replace(/\s+/g,'.')+'@example.com',address:['Mahesana','Visnagar','Unjha','Kadi','Patan'][i%5]+', Gujarat',
      course:c,admissionYear:yr,sem,category:cat,funding:(cat==='SC'||cat==='ST')&&i%2===0?'SCHOLARSHIP':'CASH',scholarshipNote:(cat==='SC'||cat==='ST')&&i%2===0?'Government post-matric scholarship':'',fees,createdBy:'System',createdAt:Date.now()-(40-i)*864e5});
    db.students.push(s);createStudentLogin(s,'student123',false);
    s.cred={status:'Sent (demo)',at:Date.now()-(40-i)*864e5,to:s.email};
  });
  /* payments in all 4 modes, dated in the last few weeks */
  const by=db.users[2];const mk=(s,sem,mode,amt,dAgo,extra={})=>{const ts=Date.now()-dAgo*864e5-3600e3*(1+(dAgo%5));const inv=mode==='UPI'?upiInvoiceDate(ts):addDays(today(),-dAgo-(extra.back||0));
    db.payments.push(Object.assign({id:uid('p'),studentId:s.id,sem,mode,amount:amt,invoiceDate:inv,entryAt:ts,paidAt:ts,chequeNo:'',bank:'',chequeDate:'',upiRef:'',providerTxnId:'',note:'',status:'SUCCESS',cancelReason:'',rc:`${db.college.receiptPrefix}${pad(db.college.nextReceipt++,4)}`,depositId:'',by:mode==='UPI'?'Payment gateway':by.name,byId:mode==='UPI'?'':by.id,dateEdits:[]},extra.f||{}))};
  const S=db.students;
  S.forEach((s,i)=>{
    const f1=semFee(s,1).amount;
    if(i%5===0)mk(s,1,'UPI',f1,2+i);
    else if(i%5===1)mk(s,1,'CASH',f1,3+i,{back:i%3});
    else if(i%5===2)mk(s,1,'CHEQUE',Math.round(f1/2),4+i,{f:{chequeNo:String(100200+i),bank:['SBI','Bank of Baroda','Mehsana Urban Co-op Bank'][i%3],chequeDate:addDays(today(),-6-i)}});
    else if(i%5===3)mk(s,1,'CASH',1500000,1+i);
    if(s.sem===3){mk(s,2,i%2?'UPI':'CASH',semFee(s,2).amount,60+i);mk(s,1,'CASH',f1,200+i)}
  });
  /* one cancelled receipt */
  const pc=db.payments.find(p=>p.mode==='CASH');if(pc){const s=stu(pc.studentId);const extra={id:uid('p'),studentId:s.id,sem:pc.sem,mode:'CASH',amount:500000,invoiceDate:addDays(today(),-9),entryAt:Date.now()-9*864e5,paidAt:Date.now()-9*864e5,chequeNo:'',bank:'',chequeDate:'',upiRef:'',providerTxnId:'',note:'',status:'CANCELLED',cancelReason:'Entered twice by mistake',cancelledAt:Date.now()-9*864e5+6e5,cancelledBy:by.name,rc:`${db.college.receiptPrefix}${pad(db.college.nextReceipt++,4)}`,depositId:'',by:by.name,byId:by.id,dateEdits:[]};db.payments.push(extra)}
  db.payments.forEach(p=>{if(p.mode==='UPI'){p.upiRef='UTR'+String(400000000000+Math.floor(rnd()*9e10));p.providerTxnId='pay_'+Math.floor(rnd()*1e12).toString(36)}});
  /* expenses */
  [['Library books purchase','Purchase',350000,5,null],['Fee adjustment – sem 1 duplicate entry','Fee adjustment',200000,8,S[3]],['Projector repair','Maintenance',180000,12,null],['Stationery for exam cell','Purchase',95000,20,null]]
    .forEach(([r,c,a,d,s])=>db.expenses.push({id:uid('x'),ref:'EXP-'+pad(db.counters.exp++,4),studentId:s?s.id:'',sem:s?1:null,amount:a,reason:r,category:c,date:addDays(today(),-d),entryAt:Date.now()-d*864e5,by:by.name,byId:by.id,dateEdits:[]}));
  /* an older deposit so the report shows both deposited and pending money */
  const old=db.payments.filter(p=>p.status==='SUCCESS'&&(p.mode==='CASH'||p.mode==='CHEQUE')&&diffDays(today(),p.invoiceDate)>40);
  if(old.length){const dp={id:uid('d'),type:'CASH+CHEQUE',periodFrom:old.map(p=>p.invoiceDate).sort()[0],periodTo:addDays(today(),-41),total:sum(old,p=>p.amount),depositedOn:addDays(today(),-40),bankRef:'SBI slip 55821',by:by.name,at:Date.now()-40*864e5,count:old.length};db.deposits.push(dp);old.forEach(p=>p.depositId=dp.id)}
  /* notices */
  db.notices=[
    {id:uid('n'),title:'Semester 1 fee – last date',body:'All B.Ed and M.Ed Semester 1 students: please pay the semester fee at the accounts office or online (UPI) by the last date. Keep the receipt for your record.',audience:{type:'all'},isFeeAlert:true,isPublic:false,publishAt:Date.now()-3*864e5,createdBy:'Principal, NPCTE',attachment:null},
    {id:uid('n'),title:'Internship (practice teaching) orientation',body:'B.Ed Semester 3 students must attend the orientation in the seminar hall on Monday at 10:30 am.',audience:{type:'sem',course:'BED',sem:3},isFeeAlert:false,isPublic:false,publishAt:Date.now()-6*864e5,createdBy:'Principal, NPCTE',attachment:null},
    {id:uid('n'),title:'Library timings',body:'The college library is open from 9:00 am to 5:00 pm on all working days.',audience:{type:'all'},isFeeAlert:false,isPublic:true,publishAt:Date.now()-10*864e5,createdBy:'Accounts Clerk',attachment:null}];
  db.audit=[];log('Sample data loaded','System','',null,null,'Demo data created');
  if(typeof ntSeed==='function')ntSeed();
}
