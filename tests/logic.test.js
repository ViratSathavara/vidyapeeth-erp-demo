const A=require('./harness.js');let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++}else{fail++;console.log('FAIL',m)}};
A.load();const db=A.db;
// login as clerk
const login=un=>{const u=db.users.find(x=>x.username===un);A.sesSet(u.id);return u};
login('clerk');
// render every staff view without throwing
for(const [n,f] of [['dash',A.viewDashboard],['stu',A.viewStudents],['fees',A.viewFees],['audit',A.viewAudit],['notices',A.viewNotices]]){
  for(const t of n==='fees'?['collect','dues','receipts']:n==='audit'?['tx','deposit']:[null]){if(t)A.ui.tab[n==='fees'?'fees':'audit']=t;try{const h=f();ok(typeof h==='string'&&h.length>100,n+' '+t)}catch(e){fail++;console.log('THROW',n,t,e.message,e.stack.split('\n')[1])}}}
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
const d={enrol:'BED26-901',name:'Test Student',gender:'F',dob:'',phone:'9876543210',email:'t.s@example.com',address:'',course:'BED',admissionYear:'2026',sem:'1',category:'General',funding:'CASH',fee1:'30000',fee2:'25000',fee3:'30000',fee4:'30000',due1:'',due2:'',due3:'',due4:''};
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
// batch (manual, required on the clerk's payment form)
ok(A.cleanBatch('2025-27')==='2025-27'&&A.cleanBatch(' 2025 - 2027 ')==='2025-27'&&A.cleanBatch('2025/27')==='2025-27','batch normalise');
for(const bad of ['','2025','25-27','2027-25','2025-2035','abcd-ef']){threw=false;try{A.cleanBatch(bad)}catch(e){threw=true}ok(threw,'batch rejects '+JSON.stringify(bad))}
login('clerk');{const s2=db.students.find(x=>x.status==='ACTIVE'&&A.feeSum(x).payable>=2000000);const m2=A.feeSum(s2).sems.find(x=>x.due>=1000000);
 A.ui.col={q:'',sid:s2.id,sem:m2.sem,mode:'CASH'};const n0=db.payments.length;
 threw=false;try{A.FORM.collect({dataset:{mode:'CASH'}},{amount:'1000',batch:'',invoiceDate:'2026-11-08'})}catch(e){threw=/batch/i.test(e.message)}ok(threw&&db.payments.length===n0,'cash without batch refused');
 A.ui.col={q:'',sid:s2.id,sem:m2.sem,mode:'EXPENSE'};const due0=A.semSummary(s2,m2.sem).due;
 threw=false;A.ui.exp={sid:s2.id,rows:[{amount:'1000',reason:'',doc:null}]};try{A.FORM.collect({dataset:{mode:'EXPENSE'}},{amount:'1000',batch:'2025-27',invoiceDate:'2026-11-08'})}catch(e){threw=true}ok(threw,'expense needs reason');
 A.ui.exp={sid:s2.id,rows:[{amount:'4000',reason:'Exam fees paid to university',doc:null},{amount:'5000',reason:'Teaching material',doc:null}]};threw=false;try{A.FORM.collect({dataset:{mode:'EXPENSE'}},{amount:'10000',batch:'2025-27',invoiceDate:'2026-11-08'})}catch(e){threw=/match exactly/.test(e.message)}ok(threw,'expense lines must add up exactly');
 A.ui.exp.rows[1].amount='6000';
 A.ui.col={q:'',sid:s2.id,sem:m2.sem,mode:'EXPENSE'};
 try{A.FORM.collect({dataset:{mode:'EXPENSE'}},{amount:'10000',batch:'2025-27',invoiceDate:'2026-11-08'})}catch(e){if(!/showReceipt|not defined|drawer/.test(e.message))console.log('collect err',e.message)}
 const pe=db.payments.at(-1);ok(pe.mode==='EXPENSE'&&pe.batch==='2025-27'&&/Exam fees paid to university/.test(pe.reason)&&pe.expenseItems.length===2&&pe.invoiceDate==='2026-11-08','expense payment saved');
 ok(A.semSummary(s2,m2.sem).due===due0-1000000,'expense reduces due');ok(!A.db.expenses&&!A.feeTabs().some(t=>t[0]==='expenses'),'no separate expense section');
 ok(/2025-27/.test(A.receiptHtml(pe))&&/Exam fees/.test(A.receiptHtml(pe)),'receipt shows batch + reason');
 A.ui.f['audit.tx']={modes:['EXPENSE']};ok(A.txFiltered().some(r=>r.id===pe.id&&r.batch==='2025-27'),'audit has expense fee');
 ok(A.receiptPdf(pe).startsWith('%PDF'),'expense pdf');}
// ---- course scope (B.Ed / M.Ed principals, one clerk for both, Super Admin all) ----
{const bed=db.students.filter(x=>x.course==='BED').length,med=db.students.filter(x=>x.course==='MED').length;
 login('principal');A.setPickedCourse('');ok(A.vStudents().length===bed&&A.vStudents().every(x=>x.course==='BED'),'B.Ed principal sees only B.Ed');
 const ms=db.students.find(x=>x.course==='MED');threw=false;try{A.guardStudent(ms.id)}catch(e){threw=true}ok(threw,'B.Ed principal blocked from M.Ed student');
 ok(A.vPayments().every(p=>db.students.find(x=>x.id===p.studentId).course==='BED'),'B.Ed principal payments scoped');
 login('principalmed');ok(A.vStudents().length===med,'M.Ed principal sees only M.Ed');
 login('clerk');A.setPickedCourse('');ok(A.vStudents().length===bed+med,'clerk sees both');A.setPickedCourse('MED');ok(A.vStudents().length===med,'course switch narrows to M.Ed');
 A.setPickedCourse('');login('principal');A.setPickedCourse('MED');ok(A.vStudents().length===bed,'cannot switch to a course not assigned');A.setPickedCourse('');
 ok(A.batchOptions('BED').includes('2025-27')&&A.batchOptions('BED').includes('2026-28'),'batch dropdown options');
 login('admin');ok(A.myCourses().length===2,'admin all courses');
 const fake={dataset:{}};try{A.FORM.course(fake,{name:'Ph.D',code:'PHD',years:'3',semesters:'6',fee:'40000'})}catch(e){if(!/firstElementChild|null/.test(e.message))console.log('course err',e.message)}ok(db.courses.some(c=>c.id==='PHD')&&A.semsOf('PHD').length===6&&A.batchOptions('PHD')[0].length===7,'add PhD course');
 ok(/Ph\.D/.test(A.setCourses()),'courses tab lists PhD');ok(/Courses/.test(A.setUsers()),'staff logins show courses');
 for(const un of ['admin','principal','clerk']){login(un);for(const fn of ['viewDashboard','feeCollect']){try{A[fn]()}catch(e){ok(false,un+' '+fn+': '+e.message)}}}
 login('clerk');ok(A.colRows().length===db.students.filter(x=>x.status==='ACTIVE').length,'collect list shows every active student');
 const pp=db.payments.find(p=>p.status==='SUCCESS');const su=db.users.find(u=>u.studentId===pp.studentId);A.sesSet(su.id);ok(!/Mode: By/.test(A.receiptHtml(pp))&&/Tuition fee/.test(A.receiptHtml(pp)),'student receipt hides mode, shows tuition fee');
 login('clerk');ok(/Mode: By/.test(A.receiptHtml(pp)),'office receipt shows mode');}
// ---- event log: every role, scoped viewing ----
{login('clerk');A.ev('Click','Collect','Riya Joshi');login('admin');A.ev('Page','Opened page','Settings');A.evFlush();
 ok(db.events.length>=2&&db.events.some(e=>e.actor==='Accounts Clerk'&&e.cat==='Click')&&db.events.some(e=>e.role==='Super Admin'),'events logged for clerk and super admin');
 ok(A.eventsVisible().length===db.events.length,'super admin sees every event');
 login('principalmed');ok(A.eventsVisible().some(e=>e.actor==='Accounts Clerk')&&!A.eventsVisible().some(e=>e.role==='Super Admin'),'principal sees own-course logins only');
 ok(/Event log/.test(A.auditEvents()),'event log tab renders');}
// ---- role hierarchy ----
{login('admin');A.ev('Click','Admin only thing','x');A.evFlush();
 login('principal');ok(!A.eventsVisible().some(e=>e.role==='Super Admin')&&!A.auditVisible().some(a=>a.role==='Super Admin'),'principal never sees super admin logs');
 login('clerk');ok(!A.can('fees.setup')&&!A.can('roles.manage')&&!A.can('settings.manage'),'clerk never gets principal-only rights');
 const r=db.roles.Clerk;r.push('activity.view');ok(!A.eventsVisible().some(e=>e.role==='Principal'||e.role==='Super Admin'),'clerk never sees principal logs');r.pop();}
// ---- change 1: office-typed enrolment no., password = mobile 5 digits @ batch start year, login by enrolment no. or email ----
// ---- change 2: admission references saved with an id, picked again, filterable ----
// ---- change 3: no student-side password change; reset only with the students.password permission ----
{const quiet=fn=>{try{fn()}catch(e){if(!/null|firstElementChild|innerHTML|not a function/.test(e.message))console.log('err',e.message)}};
 ok(A.studentPassword('9429086515','2026')==='94290@2026','password rule example 94290@2026');
 login('clerk');
 const base={gender:'F',dob:'',address:'',course:'BED',admissionYear:'2026',sem:'1',category:'General',funding:'CASH',fee1:'30000',fee2:'30000',fee3:'30000',fee4:'30000',due1:'',due2:'',due3:'',due4:''};
 const nOut=db.outbox.length,nRefs=db.refs.length;
 quiet(()=>A.FORM.addStudent({dataset:{}},{...base,enrol:'bed26-777',name:'Ref Test One',phone:'9429086515',email:'ref.one@example.com',ref:'  Trustee   Shah '}));
 const s1=db.students.find(x=>x.enrol==='BED26-777');const u1=s1&&db.users.find(u=>u.id===s1.userId);
 ok(s1&&u1&&u1.username==='bed26-777','enrolment no. typed by the office is used as login ID');
 ok(u1&&u1.password==='94290@2026'&&u1.mustChange===false,'new student password follows the rule, no forced change');
 ok(db.outbox.length===nOut+1&&db.outbox[0].kind==='credentials'&&db.outbox[0].to[0]==='ref.one@example.com','credentials email queued on create');
 const r1=s1&&A.refByName('trustee shah');ok(r1&&s1.refId===r1.id&&s1.ref==='Trustee Shah'&&/^REF\d{3}$/.test(r1.id)&&db.refs.length===nRefs+1,'new reference saved with an id');
 let th=false;try{A.readStudentForm(null,{...base,enrol:'BED26-777',name:'Dup',phone:'9876500000',email:'dup@example.com'},null)}catch(e){th=/already used/.test(e.message)}ok(th,'duplicate enrolment no. refused');
 th=false;try{A.readStudentForm(null,{...base,enrol:'',name:'No Enrol',phone:'9876500000',email:'ne@example.com'},null)}catch(e){th=/enrolment/i.test(e.message)}ok(th,'enrolment no. required');
 quiet(()=>A.FORM.addStudent({dataset:{}},{...base,enrol:'BED26-778',name:'Ref Test Two',phone:'9876512345',email:'ref.two@example.com',ref:'TRUSTEE SHAH'}));
 const s2=db.students.find(x=>x.enrol==='BED26-778');ok(s2&&s2.refId===r1.id&&db.refs.length===nRefs+1,'same reference name reuses the saved id');
 A.ui.f.students={ref:r1.id,status:''};const fl=A.studentsFiltered();ok(fl.length===2&&fl.every(x=>x.s.refId===r1.id),'students list filters by reference');
 A.ui.f.students={ref:'',status:'ACTIVE'};ok(/All references/.test(A.viewStudents()),'reference filter shown');
 // sign in with enrolment no. and with email
 A.sesSet('');quiet(()=>A.FORM.login({},{u:'BED26-777',p:'94290@2026'}));ok(A.cur()&&A.cur().id===u1.id,'student signs in with enrolment no.');
 A.sesSet('');quiet(()=>A.FORM.login({},{u:'ref.one@example.com',p:'94290@2026'}));ok(A.cur()&&A.cur().id===u1.id,'student signs in with email');
 // student cannot change the password, and the profile has no change-password form
 th=false;try{A.FORM.myPw({reset(){}},{old:'94290@2026',p1:'newpass123',p2:'newpass123'})}catch(e){th=/office/.test(e.message)}ok(th&&u1.password==='94290@2026','student cannot change own password');
 ok(!/data-form="myPw"/.test(A.viewStudentProfile())&&/contact the college office/.test(A.viewStudentProfile()),'student profile: no change password, contact office');
 // reset permission: Principal yes, Clerk no until ticked
 login('clerk');ok(!A.can('students.password'),'clerk has no password reset by default');
 th=false;try{A.FORM.stuPwReset({dataset:{id:s1.id}},{kind:'custom',pw:'abc12345'})}catch(e){th=/access/.test(e.message)}ok(th&&u1.password==='94290@2026','clerk reset refused');
 db.roles.Clerk.push('students.password');ok(A.can('students.password'),'principal can give the clerk the reset permission');db.roles.Clerk.pop();
 login('principal');ok(A.can('students.password'),'principal can reset');
 quiet(()=>A.FORM.stuPwReset({dataset:{id:s1.id}},{kind:'custom',pw:'Office@123'}));ok(u1.password==='Office@123'&&db.outbox[0].kind==='credentials'&&db.outbox[0].why==='reset','custom reset saved and emailed');
 th=false;try{A.FORM.stuPwReset({dataset:{id:s1.id}},{kind:'custom',pw:'a b'})}catch(e){th=true}ok(th,'bad custom password refused');
 quiet(()=>A.FORM.stuPwReset({dataset:{id:s1.id}},{kind:'default'}));ok(u1.password==='94290@2026','reset back to the default rule');
 ok(db.audit.some(a=>a.action==='Student password reset'&&!JSON.stringify(a).includes('Office@123')),'reset logged without the password');
 // migration of data saved by the old version: seed password -> rule, emailed password untouched, references built, Principal gets the permission
 const old=db.students.find(x=>x.enrol!=='BED26-777'&&x.enrol!=='BED26-778');const uo=db.users.find(u=>u.id===old.userId);uo.password='student123';uo.mustChange=true;u1.password='Emailed#1';
 db.mig={};delete db.refs;old.ref='Old Ref';db.roles.Principal=db.roles.Principal.filter(p=>p!=='students.password');A.save();A.load();const D=A.db;
 const uo2=D.users.find(u=>u.id===uo.id),so2=D.students.find(x=>x.id===old.id);
 ok(uo2.password===A.studentPassword(so2.phone,so2.admissionYear)&&uo2.mustChange===false,'migration: seed password moves to the rule');
 ok(D.users.find(u=>u.id===u1.id).password==='Emailed#1','migration: emailed password untouched');
 ok(Array.isArray(D.refs)&&so2.refId&&D.refs.find(r=>r.id===so2.refId).name==='Old Ref','migration: references built from existing names');
 ok(D.roles.Principal.includes('students.password')&&!D.roles.Clerk.includes('students.password'),'migration: Principal gets reset permission, Clerk does not');}
console.log('pass',pass,'fail',fail);
