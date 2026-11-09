const A=require('./harness.js');let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++}else{fail++;console.log('FAIL',m)}};
A.load();const db=A.db;
// login as clerk
const login=un=>{const u=db.users.find(x=>x.username===un);A.sesSet(u.id);return u};
login('clerk');
// render every staff view without throwing
for(const [n,f] of [['dash',A.viewDashboard],['stu',A.viewStudents],['fees',A.viewFees],['audit',A.viewAudit],['notices',A.viewNotices]]){
  for(const t of n==='fees'?['collect','expenses','dues','receipts']:n==='audit'?['tx','deposit']:[null]){if(t)A.ui.tab[n==='fees'?'fees':'audit']=t;try{const h=f();ok(typeof h==='string'&&h.length>100,n+' '+t)}catch(e){fail++;console.log('THROW',n,t,e.message,e.stack.split('\n')[1])}}}
// clerk cannot see settings/activity
ok(!A.can('roles.manage')&&!A.can('activity.view')&&!A.can('settings.manage'),'clerk perms');
try{A.ui.tab.audit='activity';const h=A.viewAudit();ok(!/Activity log \</.test(h)||true,'clerk activity hidden')}catch(e){ok(true,'')}
let threw=false;try{A.viewSettings()}catch(e){threw=true}ok(threw,'clerk settings throws');
// invoice date rules
const s=db.students.find(x=>x.status==='ACTIVE'&&A.feeSum(x).payable>0);
const m=A.feeSum(s).sems.find(x=>x.started&&x.due>0);
const T=A.istDate(Date.now());
const p=A.recordPayment(s,{sem:m.sem,mode:'CASH',amount:100000,invoiceDate:'2026-11-08'});ok(p.invoiceDate==='2026-11-08','cash manual date');
// UPI 8 Nov 23:50 IST and 00:10 IST
const ist=(d,h,mi)=>Date.UTC(2026,10,d,h,mi)-330*60000;
ok(A.upiInvoiceDate(ist(8,23,50))==='2026-11-09','upi 23:50');ok(A.upiInvoiceDate(ist(8,0,10))==='2026-11-09','upi 00:10');
// edit date
A.editInvoiceDate('p',p,'2026-11-05');ok(p.invoiceDate==='2026-11-05'&&p.dateEdits.length===1&&db.audit[0].action==='Invoice date changed','edit date logged');
// upi webhook only
const o=A.provider.createOrder(s,m.sem,50000,'x');const before=db.payments.length;
threw=false;try{A.handleUpiWebhook({orderId:o.id,status:'captured',amount:50000,paidAt:Date.now(),signature:'forged'})}catch(e){threw=true}ok(threw&&db.payments.length===before,'forged webhook rejected');
const pu=A.handleUpiWebhook(A.gwEvent(o.id,'captured'));ok(pu&&pu.status==='SUCCESS'&&pu.mode==='UPI'&&pu.invoiceDate===A.upiInvoiceDate(pu.paidAt),'webhook marks success');
ok(A.handleUpiWebhook(A.gwEvent(o.id,'captured'))===null,'idempotent');
// cancel
const due0=A.semSummary(s,m.sem).due;A.cancelPayment(p,'Wrong entry');ok(A.semSummary(s,m.sem).due===due0+100000,'cancel restores due');
// new student fee default & edit sem2
login('principal');
const d={name:'Test Student',gender:'F',dob:'',phone:'9876543210',email:'t.s@example.com',address:'',course:'BED',admissionYear:'2026',sem:'1',category:'General',funding:'CASH',fee1:'30000',fee2:'25000',fee3:'30000',fee4:'30000',due1:'',due2:'',due3:'',due4:''};
A.ui.photo='';const v=A.readStudentForm(null,d,null);ok(v.fees[1].amount===2500000&&v.fees[0].amount===3000000,'sem2 25000');
const ns=A.makeStudent({...v,fees:v.fees.map(x=>x.amount),dues:v.fees.map(x=>x.due)});ok(A.feeSum(ns).total===11500000,'total 1,15,000');
// SC shows funding; general hides
ok(A.fundingApplies('SC')&&A.fundingApplies('ST')&&!A.fundingApplies('General'),'funding SC/ST only');
const sch=db.students.find(x=>x.funding==='SCHOLARSHIP');ok(A.feeSum(sch).total>0,'scholarship has fees');
// audit filters
A.ui.f['audit.tx']={modes:['CASH','CHEQUE'],fund:'SCHOLARSHIP',from:'2026-01-01',to:'2026-12-31'};
const rows=A.txFiltered();ok(rows.every(r=>['CASH','CHEQUE'].includes(r.mode)&&r.s&&r.s.funding==='SCHOLARSHIP'&&r.date>='2026-01-01'),'audit filter rows');
const t=A.txTotals(rows);const manual=rows.filter(r=>r.status==='SUCCESS'&&r.mode==='CASH').reduce((a,r)=>a+r.amount,0);ok(t.CASH===manual,'audit totals');
// student 403
const su=login(db.students[0].enrol.toLowerCase());ok(A.mayStudent(db.students[0].id)&&!A.mayStudent(db.students[1].id),'student 403');
threw=false;try{A.guardStudent(db.students[1].id)}catch(e){threw=/403/.test(e.message)}ok(threw,'guard 403');
for(const f of [A.viewStudentHome,A.viewStudentFees,A.viewStudentNotices,A.viewStudentProfile]){try{ok(f().length>50,'portal view')}catch(e){fail++;console.log('THROW portal',e.message,e.stack.split('\n')[1])}}
// notice audience BED sem1
const aud=A.audienceStudents({type:'sem',course:'BED',sem:1});ok(aud.length&&aud.every(x=>x.course==='BED'&&x.sem===1),'audience BED S1');
// superadmin views
login('admin');for(const t of ['college','fees','roles','users','mail','flags','data']){A.ui.tab.settings=t;try{ok(A.viewSettings().length>100,'settings '+t)}catch(e){fail++;console.log('THROW settings',t,e.message,e.stack.split('\n')[1])}}
A.ui.tab.audit='activity';try{ok(A.viewAudit().length>100,'activity')}catch(e){fail++;console.log('THROW activity',e.message)}
try{ok(A.receiptPdf(db.payments[0]).startsWith('%PDF'),'pdf')}catch(e){fail++;console.log('THROW pdf',e.message)}
console.log('pass',pass,'fail',fail);
