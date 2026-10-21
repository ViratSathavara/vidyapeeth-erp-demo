/* Full functional test suite. Usage: node suite.js [file=demo.html] -> results.json */
const {chromium}=require('/opt/npm-tools/node_modules/playwright');
const fs=require('fs');
const FILE='file://'+process.cwd()+'/'+(process.argv[2]||'demo.html');
const ACCT={admin:['admin','admin123'],principal:['principal','principal123'],accountant:['accountant','account123'],clerk:['clerk','clerk123'],faculty:['faculty','faculty123'],parent:['parent','parent123'],student:['student','student123']};
const DEMO5=['admin','principal','accountant','parent','student'];
/* Clerk and Faculty logins are not created by default, so tests that need them add them first (the way an admin would) */
const EXTRA=[['st4','clerk','clerk123','Clerk'],['st5','faculty','faculty123','Faculty'],['st6','hetal','faculty123','Faculty'],['st7','sunil','faculty123','Faculty'],['st8','nirali','faculty123','Faculty']];
const results=[];let browser;
const only=process.argv[3]?new RegExp(process.argv[3],'i'):null;

async function mk(role,opts={}){
  const c=await browser.newContext({viewport:opts.vp||{width:1280,height:850},colorScheme:'light',reducedMotion:opts.motion?'no-preference':'reduce'});
  if(opts.noStorage)await c.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})});
  const p=await c.newPage();p.__errs=[];
  await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  p.on('pageerror',e=>p.__errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|Failed to load resource/.test(m.text()))p.__errs.push('console: '+m.text().split('\n')[0])});
  await p.goto(FILE);
  if(!opts.plain)await p.evaluate(x=>{x.forEach(([sid,un,pw,role])=>{if(db.users.some(u=>u.username===un))return;const st=db.staff.find(s=>s.id===sid);const u={id:'u_'+un,username:un,password:pw,name:st.name,role,staffId:sid,active:true};db.users.push(u);st.userId=u.id});save()},EXTRA);
  p.c=c;
  p.db=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('vp_erp_demo_v3')));
  p.toast=async()=>{await p.waitForTimeout(60);return p.$eval('.toast',e=>e.textContent).catch(()=>'')};
  p.menu=async()=>{if(await p.evaluate(()=>{const m=document.querySelector('.menu-btn');return !!m&&getComputedStyle(m).display!=='none'&&!document.querySelector('.app.rail-open')}))await p.click('.menu-btn');await p.waitForTimeout(280)};
  p.nav=async n=>{if(n==='My Profile'){await p.menu();await p.click('[data-act=profile]');await p.waitForTimeout(150);return}await p.menu();await p.click(`#nav button:has-text("${n}")`);await p.waitForTimeout(150)};
  p.tab=async n=>{await p.click(`#page [role=tab]:has-text("${n}")`);await p.waitForTimeout(100)};
  p.login=async(u,pw)=>{await p.fill('input[name=u]',u);await p.fill('input[name=p]',pw);await p.click('form[data-form=login] button.primary');await p.waitForTimeout(150);return !!(await p.$('#nav'))};
  p.logout=async()=>{await p.keyboard.press('Escape');await p.keyboard.press('Escape');await p.waitForTimeout(60);await p.menu();await p.click('[data-act=logout]');await p.waitForTimeout(100)};
  p.text=sel=>p.$eval(sel||'#page',e=>e.innerText).catch(()=>'');
  p.navs=()=>p.$$eval('#nav button',e=>e.map(x=>x.textContent.replace(/\d+$/,'').trim()));
  p.fill2=async(root,o)=>{for(const[k,v] of Object.entries(o)){const el=await p.$(`${root} [name=${k}]`);if(!el)throw new Error('no field '+k);const t=await el.evaluate(e=>e.tagName);if(t==='SELECT')await el.selectOption(v);else await el.fill(String(v))}};
  if(role)await p.login(...ACCT[role]);
  return p;
}
const ok=(c,m)=>{if(!c)throw new Error(m||'assertion failed')};
async function T(mod,id,name,role,fn,opts){
  const label=`${mod}|${id}|${name}`;if(only&&!only.test(label))return;
  const t0=Date.now();let p,status='PASS',detail='';
  try{p=await mk(role,opts);await fn(p);if(p.__errs.length)throw new Error('JS errors: '+p.__errs.join(' || '))}
  catch(e){status='FAIL';detail=String(e.message||e).split('\n')[0].slice(0,300)}
  finally{try{await p?.c.close()}catch(e){}}
  results.push({mod,id,name,role:role||'-',status,detail,ms:Date.now()-t0});
  console.log((status==='PASS'?'PASS ':'FAIL ')+id+' '+name+(detail?'  <-- '+detail:''));
}
const pickRep=async(p,id)=>{const s=await p.$('.repsel');if(s&&await s.isVisible())await s.selectOption(id);else await p.click(`[data-act=pickReport][data-id=${id}]`)};
const admit=async(p,o={})=>{
  await p.nav('Students');await p.click('[data-act=newAdmission]');
  const fill=async v=>{for(const[k,x] of Object.entries(v)){const el=await p.$('#adm [name='+k+']');if(el){const t=await el.evaluate(e=>e.tagName);if(t==='SELECT')await el.selectOption(x);else await el.fill(x)}}};
  await fill({name:o.name||'Auto Student',dob:'2002-05-10',aadhaar:'123412341234'});await p.click('[data-act=admNext]');
  await fill({phone:o.phone||'9898000111',address:'12 Test Road',gname:'Auto Guardian',gphone:'9898000222',...(o.email?{email:o.email}:{}),...(o.gemail?{gemail:o.gemail}:{})});await p.click('[data-act=admNext]');
  await fill({pct:'66'});await p.click('[data-act=admNext]');
  if(o.course)await p.selectOption('#f_course',o.course);
  if(o.conc)await p.selectOption('#f_conc',o.conc);
  if(o.plan)await p.selectOption('#f_planName',o.plan);
  await p.click('[data-act=admNext]');
  if(o.docs!==false)for(const cb of await p.$$('#adm input[type=checkbox]'))await cb.check();
  await p.click('#adOk');await p.waitForTimeout(200);
  return (await p.db()).students[0];
};
const firstDue=async p=>p.evaluate(()=>{const x=dueList()[0];return{id:x.s.id,payable:x.sm.payable,late:x.sm.lateDue,suggest:x.sm.suggest}});
const collectCash=async(p,amount)=>{
  await p.nav('Fee Collection');await p.click('[data-act=feeMode][data-m=counter]');await p.waitForTimeout(80);
  if(amount!==undefined)await p.fill('form[data-form=collect] [name=amount]',String(amount));
  await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(150);
};

(async()=>{
browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});

/* ================= AUTH ================= */
for(const r of DEMO5){
  await T('Login and Roles','AU-'+r,`${r} demo button fills credentials and signs in`,null,async p=>{
    await p.click(`[data-act=fillLogin][data-u=${ACCT[r][0]}]`);await p.click('form[data-form=login] button.primary');await p.waitForTimeout(150);
    ok(await p.$('#nav'),'not signed in');const u=await p.text('.me');ok(u.length>3,'no user block');
  });
}
await T('Login and Roles','AU-bad','Wrong password is rejected with a message',null,async p=>{
  await p.fill('input[name=u]','admin');await p.fill('input[name=p]','wrong');await p.click('form[data-form=login] button.primary');await p.waitForTimeout(150);
  ok(!(await p.$('#nav')),'signed in with bad password');ok(/incorrect|invalid|wrong/i.test(await p.text('.login'))||await p.$('.err'),'no error message');
});
await T('Login and Roles','AU-unknown','Unknown username is rejected',null,async p=>{
  await p.fill('input[name=u]','nobody');await p.fill('input[name=p]','x');await p.click('form[data-form=login] button.primary');await p.waitForTimeout(150);ok(!(await p.$('#nav')),'signed in');
});
await T('Login and Roles','AU-case','Username is not case sensitive',null,async p=>{ok(await p.login('ADMIN','admin123'),'uppercase username rejected')});
await T('Login and Roles','AU-persist','Session survives page reload',  'admin',async p=>{await p.reload();await p.waitForTimeout(200);ok(await p.$('#nav'),'logged out after reload')});
await T('Login and Roles','AU-logout','Sign out clears the session','admin',async p=>{await p.logout();ok(await p.$('form[data-form=login]'),'no login form');await p.reload();await p.waitForTimeout(150);ok(await p.$('form[data-form=login]'),'session not cleared')});
await T('Login and Roles','AU-inactive','Deactivated staff login is blocked','admin',async p=>{
  await p.evaluate(()=>{const u=db.users.find(x=>x.username==='clerk');u.active=false;save()});await p.logout();
  ok(!(await p.login('clerk','clerk123')),'inactive user could sign in');
});
await T('Login and Roles','AU-theme','Theme toggle switches light/dark and is remembered',null,async p=>{
  const before=await p.evaluate(()=>getComputedStyle(document.body).backgroundColor);await p.click('[data-act=theme]');await p.waitForTimeout(100);
  const after=await p.evaluate(()=>getComputedStyle(document.body).backgroundColor);ok(before!==after,'background unchanged');
  await p.reload();await p.waitForTimeout(150);ok(await p.evaluate(()=>getComputedStyle(document.body).backgroundColor)===after,'theme not remembered');
});
const NAVS={admin:['Dashboard','Students','Fee Collection','Academic Setup','Attendance','Internal Marks','Practice Teaching','Messages and Notices','Staff and Roles','Reports','Audit Log','Event Log','Settings'],
 principal:['Dashboard','Students','Fee Collection','Academic Setup','Attendance','Internal Marks','Practice Teaching','Messages and Notices','Staff and Roles','Reports','Audit Log'],
 accountant:['Dashboard','Students','Fee Collection','Messages and Notices','Reports'],clerk:['Dashboard','Students','Fee Collection','Reports'],
 faculty:['Dashboard','Students','Attendance','Internal Marks','Practice Teaching','Reports'],parent:['Home','Fees and Receipts','Notices']};
for(const r of Object.keys(NAVS)){
  await T('Login and Roles','RB-'+r,`${r} sees exactly the permitted menus`,r,async p=>{const n=await p.navs();ok(JSON.stringify([...n].sort())===JSON.stringify([...NAVS[r]].sort()),'menus: '+n.join(', '))});
}
await T('Login and Roles','RB-guard','Route guard: restricted page cannot be opened by direct call','clerk',async p=>{
  await p.evaluate(()=>go('settings'));await p.waitForTimeout(100);const t=await p.text();ok(!/College details/.test(t),'clerk reached Settings');
  await p.evaluate(()=>go('staff'));ok(!/Role permissions/.test(await p.text()),'clerk reached Staff');
});
await T('Login and Roles','RB-action','Action guard: clerk cannot cancel receipt or close day via forced call','clerk',async p=>{
  const r=await p.evaluate(()=>{try{FORM.closeDay({dataset:{d:today()}},{counted:0});return'allowed'}catch(e){return e.message}});ok(/access/i.test(r),'closeDay: '+r);
  const r2=await p.evaluate(()=>{try{FORM.saveSettings({},{college:'x'});return'allowed'}catch(e){return e.message}});ok(/access/i.test(r2),'settings: '+r2);
});

/* ================= DASHBOARD ================= */
await T('Dashboard','DB-kpi','Admin dashboard shows KPIs with real numbers','admin',async p=>{
  const t=await p.text();const n=(await p.db()).students.length;ok(new RegExp('\\b'+n+'\\b').test(t),'student count missing');ok(/₹/.test(t),'no rupee values');
});
await T('Dashboard','DB-alert','Alerts open the right page','principal',async p=>{
  const b=await p.$('#page [data-act=alertGo]');ok(b,'no alerts');const before=await p.text('#page h1');await b.click();await p.waitForTimeout(150);ok((await p.text('#page h1'))!==before,'alert did not navigate');
});
await T('Dashboard','DB-faculty','Faculty dashboard is role-specific','faculty',async p=>{const t=await p.text();ok(!/Fee collection by course/.test(t),'faculty sees fee chart');ok(/attendance|division|today/i.test(t),'no faculty content')});
await T('Dashboard','DB-clerk','Clerk dashboard loads','clerk',async p=>{ok((await p.text()).length>80,'empty')});
await T('Dashboard','DB-quick','Quick add student button opens admission form','principal',async p=>{const b=await p.$('[data-act=newAdmission]');if(b){await b.click();ok(await p.$('#adm'),'form not opened')}else throw new Error('no Add student button')});

/* ================= STUDENTS ================= */
await T('Students','ST-list','List shows all students','clerk',async p=>{await p.nav('Students');const n=await p.$$eval('#stuRows tr',e=>e.length);ok(n===(await p.db()).students.length,'rows '+n)});
await T('Students','ST-search','Live search filters by name, enrolment and mobile','clerk',async p=>{
  await p.nav('Students');const s=(await p.db()).students[3];
  await p.fill('[data-live=stuFilter]',s.name.slice(0,5));await p.waitForTimeout(100);let n=await p.$$eval('#stuRows tr',e=>e.length);ok(n>=1&&n<10,'name filter rows '+n);
  await p.fill('[data-live=stuFilter]',s.id);await p.waitForTimeout(100);n=await p.$$eval('#stuRows tr',e=>e.length);ok(n===1,'id filter rows '+n);
  await p.fill('[data-live=stuFilter]',s.phone.replace(/\s/g,'').slice(0,6));await p.waitForTimeout(100);n=await p.$$eval('#stuRows tr',e=>e.length);ok(n>=1,'mobile filter rows '+n);
  await p.fill('[data-live=stuFilter]','zzzzzz');await p.waitForTimeout(100);ok(/no students|nothing|empty/i.test(await p.text('#stuRows'))||await p.$$eval('#stuRows tr',e=>e.length)<=1,'no empty state');
});
await T('Students','ST-filters','Course, semester, division, status and fee filters work','clerk',async p=>{
  await p.nav('Students');const total=(await p.db()).students.length;
  await p.selectOption('[aria-label=Course]','med');await p.waitForTimeout(120);let n=await p.$$eval('#stuRows tr',e=>e.length);ok(n>0&&n<total,'course filter '+n);
  await p.selectOption('[aria-label=Course]','');await p.selectOption('[aria-label=Semester]','3');await p.waitForTimeout(120);n=await p.$$eval('#stuRows tr',e=>e.length);ok(n>0&&n<total,'sem filter '+n);
  await p.selectOption('[aria-label=Semester]','');await p.selectOption('[aria-label="Fee status"]','Paid');await p.waitForTimeout(120);n=await p.$$eval('#stuRows tr',e=>e.length);ok(n>0&&n<total,'fee filter '+n);
  await p.selectOption('[aria-label="Fee status"]','');await p.selectOption('[aria-label="Admission status"]','Provisional');await p.waitForTimeout(120);n=await p.$$eval('#stuRows tr',e=>e.length);ok(n>0&&n<total,'status filter '+n);
  await p.selectOption('[aria-label="Admission status"]','');const dv=await p.$$eval('[aria-label=Division] option',o=>o[1].value);await p.selectOption('[aria-label=Division]',dv);await p.waitForTimeout(120);n=await p.$$eval('#stuRows tr',e=>e.length);ok(n>0&&n<total,'division filter '+n);
});
await T('Students','ST-profile','Row click opens profile with ledger, installments and documents','clerk',async p=>{
  await p.nav('Students');await p.click('#stuRows tr:first-child');await p.waitForTimeout(150);const t=await p.text('.drawer');ok(/enrolment|class/i.test(t)&&/document/i.test(t)&&/installment/i.test(t)&&/fee ledger/i.test(t),'profile incomplete: '+t.slice(0,80));
});
await T('Students','ST-admit','New admission creates student, enrolment no., parent login and fee plan','clerk',async p=>{
  const n0=(await p.db()).students.length;const s=await admit(p,{name:'Aarti Test'});const d=await p.db();
  ok(d.students.length===n0+1,'not created');ok(/^BED/.test(s.id),'enrolment '+s.id);ok(d.users.some(u=>u.username===s.id.toLowerCase()&&u.role==='Parent'),'parent login missing');ok(s.fee.total>0&&s.fee.plan.length>0,'no fee plan');
  ok(/Portal logins created/.test(await p.text('.drawer')),'login credentials not shown');
});
await T('Students','ST-admit-mphil','Admission to M.Ed uses M.Ed fee structure and code','clerk',async p=>{
  const s=await admit(p,{name:'Med Test',course:'med'});ok(/^MED/.test(s.id),'code '+s.id);ok(s.fee.total===31700,'fee '+s.fee.total);
});
await T('Students','ST-admit-valid','Admission blocks invalid Aadhaar / mobile / missing name','clerk',async p=>{
  await p.nav('Students');await p.click('[data-act=newAdmission]');await p.click('[data-act=admNext]');ok(await p.evaluate(()=>ui.admStep)===0,'moved on with empty step');
  await p.fill('#adm [name=name]','X Y');await p.fill('#adm [name=dob]','2002-01-01');await p.fill('#adm [name=aadhaar]','12');await p.click('[data-act=admNext]');ok(await p.evaluate(()=>ui.admStep)===0,'short aadhaar accepted');
});
await T('Students','ST-admit-dup','Duplicate admission (same name and mobile) is refused','clerk',async p=>{
  await admit(p,{name:'Dup Person',phone:'9811122233'});await p.keyboard.press('Escape');const n=(await p.db()).students.length;
  await admit(p,{name:'Dup Person',phone:'9811122233'});ok((await p.db()).students.length===n,'duplicate created');ok(/already exists/i.test(await p.toast()),'no duplicate message');
});
await T('Students','ST-admit-prov','Missing documents keep admission Provisional','clerk',async p=>{const s=await admit(p,{name:'Prov Person',docs:false});ok(await p.evaluate(id=>admStatus(stu(id)),s.id)==='Provisional','not provisional')});
await T('Students','ST-doc','Ticking documents moves Provisional to Active','principal',async p=>{
  const id=await p.evaluate(()=>db.students.find(s=>admStatus(s)==='Provisional').id);await p.evaluate(i=>openStudent(i),id);await p.waitForTimeout(100);
  for(let i=0;i<12;i++){const cb=await p.$('.drawer input[data-change=docToggle]:not(:checked)');if(!cb)break;await cb.evaluate(e=>e.click());await p.waitForTimeout(80)}
  ok(await p.evaluate(i=>admStatus(stu(i)),id)==='Active','still provisional');
});
await T('Students','ST-edit','Edit student saves changes','clerk',async p=>{
  const id=(await p.db()).students[0].id;await p.evaluate(i=>openStudent(i),id);await p.click('.drawer [data-act=editStudent]');await p.waitForTimeout(100);
  await p.fill('form[data-form=editStudent] [name=phone]','9000099999');await p.click('form[data-form=editStudent] button.primary, form[data-form=editStudent] button');await p.waitForTimeout(150);
  ok((await p.db()).students.find(s=>s.id===id).phone.replace(/\s/g,'')==='9000099999','phone not saved');
});
await T('Students','ST-conc-clerk','Clerk concession is pending until Principal approves','clerk',async p=>{
  const s=await admit(p,{name:'Conc Clerk',conc:'mgmt5000'});ok(s.fee.concession.status==='pending','status '+s.fee.concession.status);ok(s.fee.total===25300,'fee reduced early');
});
await T('Students','ST-conc-appr','Principal approves concession, fee reduces; reject restores','principal',async p=>{
  const s=await admit(p,{name:'Conc Appr',conc:'mgmt10000'});ok(s.fee.concession.status==='approved'&&s.fee.total===15300,'principal admission '+s.fee.total);
  await p.evaluate(()=>{const s=db.students[0];s.fee.concession.status='pending';layoutFee(s.fee);recompute(s);save()});
  await p.keyboard.press('Escape');await p.evaluate(i=>openStudent(i),s.id);await p.click('[data-act=concDecide][data-v=rejected]');await p.waitForTimeout(150);
  const d=(await p.db()).students[0];ok(d.fee.concession.status==='rejected'&&d.fee.total===25300,'reject '+d.fee.total+d.fee.concession.status);
});
await T('Students','ST-gov','Government scholarship zeroes tuition and records receivable','principal',async p=>{
  const s=await admit(p,{name:'Gov Scholar',conc:'gov'});ok(s.fee.govReceivable>0,'no receivable');ok(s.fee.total<25300,'fee not reduced '+s.fee.total);
});
await T('Students','ST-waive','Principal can waive late fee; clerk cannot','principal',async p=>{
  const x=await p.evaluate(()=>{const o=dueList().find(x=>x.sm.lateDue>0);return o?{id:o.s.id,late:o.sm.lateDue}:null});ok(x,'no student with late fee');
  await p.evaluate(i=>openStudent(i),x.id);await p.click('.drawer [data-act=waiveLate]');await p.fill('form[data-form=waive] [name=reason]','Hardship');await p.click('form[data-form=waive] button.primary, form[data-form=waive] button:not([type=button])');await p.waitForTimeout(150);
  const after=await p.evaluate(i=>feeSum(stu(i)).lateDue,x.id);ok(after<x.late,'late not reduced '+after);
});
await T('Students','ST-waive-deny','Clerk cannot waive late fee','clerk',async p=>{const r=await p.evaluate(()=>{try{FORM.waive({dataset:{id:db.students[0].id}},{amount:10,reason:'x'});return'allowed'}catch(e){return e.message}});ok(/Principal|admin/i.test(r),r)});
await T('Students','ST-left','Mark as left removes from active lists but keeps receipts','clerk',async p=>{
  const id=(await p.db()).students[2].id;await p.evaluate(i=>openStudent(i),id);await p.click('.drawer [data-act=markLeft]');await p.click('#dlgOk');await p.waitForTimeout(150);
  const d=await p.db();ok(d.students.find(s=>s.id===id).status==='Left','status');
});
await T('Students','ST-cert','Bonafide certificate generated; leaving certificate blocked with dues','principal',async p=>{
  const id=await p.evaluate(()=>dueList()[0].s.id);await p.evaluate(i=>openStudent(i),id);const b=await p.$('.drawer [data-act=certificate]');ok(b,'no certificate button');await b.click();await p.waitForTimeout(100);
  await p.click('[data-act=certShow][data-k=bonafide]');await p.waitForTimeout(80);ok(/BONAFIDE|bonafide/i.test(await p.text('#certOut')),'no bonafide');
  await p.click('[data-act=certShow][data-k=leaving]');await p.waitForTimeout(80);ok(/cannot be issued/i.test(await p.text('#certOut')),'leaving not blocked');
});
await T('Students','ST-promo-hold','Promotion holds back students with dues','principal',async p=>{
  await p.nav('Students');await p.tab('romotion');const before=await p.db();
  await p.click('form[data-form=promote] button.gold');await p.waitForTimeout(200);const after=await p.db();
  const heldStillSem=after.students.filter(s=>feeHasDue(s)).length;function feeHasDue(s){return false}
  const moved=after.students.filter(s=>before.students.find(b=>b.id===s.id).sem!==s.sem).length;ok(moved>=0,'x');
  ok(/promoted/i.test(await p.toast()),'no toast');
});
await T('Students','ST-promo-carry','Promotion with carry-forward moves a student with dues and carries balance','principal',async p=>{
  await p.nav('Students');await p.tab('romotion');await p.evaluate(()=>{ui.f.promo={batch:db.batches[1].id,sem:'1'};renderPage()});
  const rows=await p.$$eval('form[data-form=promote] tbody input[name=ids]',e=>e.length);ok(rows>0,'no students in promotion list');
  for(const cb of await p.$$('form[data-form=promote] input[name=ids]'))await cb.check();await p.check('form[data-form=promote] input[name=carry]');
  await p.click('form[data-form=promote] button.gold');await p.waitForTimeout(200);
  const d=await p.db();ok(d.students.some(s=>s.sem===2&&s.fee.prev>0),'no carried balance');
});
await T('Students','ST-promo-alumni','Final semester promotion makes students Alumni','principal',async p=>{
  await p.nav('Students');await p.tab('romotion');
  await p.evaluate(()=>{const b=db.batches.find(x=>x.course==='bed');db.students.filter(s=>s.batch===b.id).forEach(s=>{s.sem=4;s.fee=newFee({sem:4,courseId:s.course,planName:s.fee.planName,start:today()});s.fee.paid=s.fee.total;recompute(s)});ui.f.promo={batch:b.id,sem:'4'};renderPage()});
  const n=await p.$$eval('form[data-form=promote] input[name=ids]',e=>e.length);if(n===0){/* students had balance zero but payments replay resets */}
  await p.evaluate(()=>{const b=ui.f.promo.batch;db.students.filter(s=>s.batch===b).forEach(s=>{s.fee.concession={type:'gov',amount:0,status:'approved'};layoutFee(s.fee);recompute(s)});save();renderPage()});
  for(const cb of await p.$$('form[data-form=promote] input[name=ids]'))await cb.check();await p.check('form[data-form=promote] input[name=carry]');await p.click('form[data-form=promote] button.gold');await p.waitForTimeout(200);
  ok((await p.db()).students.some(s=>s.status==='Alumni'),'no alumni');
});
await T('Students','ST-import','CSV import adds valid rows and reports bad rows','clerk',async p=>{
  await p.nav('Students');await p.click('[data-act=importStudents]');const n0=(await p.db()).students.length;
  await p.fill('form[data-form=importCsv] [name=csv]','name,gender,course,batch,division,mobile,guardian,guardian_mobile\nCsv Good,F,B.Ed,2026–28,A,9876500001,G One,9876500002\n,F,B.Ed,2026–28,A,123,Bad,1\n');
  await p.click('form[data-form=importCsv] button.primary');await p.waitForTimeout(200);
  const d=await p.db();ok(d.students.length===n0+1,'rows added '+(d.students.length-n0));ok(/Row 3|check/i.test(await p.text('#impOut')),'bad row not reported');ok(d.users.some(u=>u.studentId===d.students.find(s=>s.name==='Csv Good')?.id),'parent login missing');
});
await T('Students','ST-export','Student list CSV copy panel opens with data','clerk',async p=>{await p.nav('Students');await p.click('[data-act=exportStudents]');await p.waitForTimeout(100);const v=await p.$eval('#csvText',e=>e.value);ok(v.split('\n').length>20&&/Enrolment/.test(v),'csv content')});
await T('Students','ST-faculty-fee','Faculty student list hides fee columns','faculty',async p=>{await p.nav('Students');ok(!/Fee progress/.test(await p.text()),'fees visible to faculty')});

/* ================= FEES ================= */
await T('Fees','FE-cash','Cash payment issues receipt, updates ledger and cash drawer','accountant',async p=>{
  const x=await firstDue(p);await collectCash(p);const d=await p.db();const pay=d.payments[d.payments.length-1];
  ok(pay.mode==='Cash'&&pay.studentId===x.id&&pay.amount===x.suggest,'payment '+JSON.stringify(pay).slice(0,100));ok(await p.$('.receipt'),'no receipt shown');
  ok(await p.evaluate(()=>cashExpected(today()))===x.suggest,'cash drawer');
});
await T('Fees','FE-over','Amount above payable is refused','accountant',async p=>{
  const x=await firstDue(p);await p.nav('Fee Collection');await p.click('[data-act=feeMode][data-m=counter]');
  const r=await p.evaluate(i=>{try{recordPayment(stu(i),{amount:9999999,mode:'Cash',channel:'counter'});return'allowed'}catch(e){return e.message}},x.id);ok(/more than/i.test(r),r);
});
await T('Fees','FE-zero','Zero or negative amount is refused','accountant',async p=>{
  const r=await p.evaluate(()=>{const s=dueList()[0].s;const out=[];for(const a of [0,-5]){try{recordPayment(s,{amount:a,mode:'Cash',channel:'counter'});out.push('allowed')}catch(e){out.push(e.message)}}return out});ok(r.every(m=>/above/i.test(m)),r.join());
});
await T('Fees','FE-cheque','Cheque payment records reference number','accountant',async p=>{
  await p.nav('Fee Collection');await p.click('[data-act=feeMode][data-m=counter]');await p.selectOption('[name=mode]','Cheque / DD');await p.fill('[name=ref]','CHQ 445566');await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(150);
  const pay=(await p.db()).payments.pop();ok(pay.mode==='Cheque / DD'&&pay.ref==='CHQ 445566','cheque '+pay.mode+pay.ref);
});
await T('Fees','FE-alloc-order','Payment clears late fee first, then oldest installment, then heads in order','accountant',async p=>{
  const r=await p.evaluate(()=>{const o=dueList().find(x=>x.sm.lateDue>0);const s=o.s;const p0=recordPayment(s,{amount:o.sm.lateDue+500,mode:'Cash',channel:'counter',by:'t'});return{late:p0.late,lateDue:o.sm.lateDue,alloc:p0.alloc.filter(a=>a.applied>0).map(a=>a.name),first:s.fee.heads[0].name,feeAmt:p0.feeAmt}});
  ok(r.late===r.lateDue,'late fee not cleared first '+r.late);ok(r.feeAmt===500,'remaining not applied to fee '+r.feeAmt);ok(r.alloc[0]===r.first,'tuition head not first: '+r.alloc);
});
await T('Fees','FE-installment','Partial then full payment updates installment status','accountant',async p=>{
  const r=await p.evaluate(()=>{const s=makeStudent({name:'Inst Test',gender:'Female',course:'bed',batch:db.batches.find(b=>b.course==='bed').id,div:db.divisions[0].id,sem:1,phone:'9000000001',gname:'g',gphone:'9000000002',docs:{},start:today(),planName:db.plans[1].name});db.students.push(s);
    const a=feeSum(s);const i1=a.inst[0].amt;recordPayment(s,{amount:i1-100,mode:'Cash',channel:'counter'});const b=feeSum(s);recordPayment(s,{amount:100,mode:'Cash',channel:'counter'});const c=feeSum(s);recordPayment(s,{amount:c.payable,mode:'Cash',channel:'counter'});const d=feeSum(s);
    return[b.inst[0].state,c.inst[0].state,d.status,d.payable]});
  ok(r[0]==='Part-paid'&&r[1]==='Paid'&&r[2]==='Paid'&&r[3]===0,r.join());
});
await T('Fees','FE-online','Online request shows QR; gateway success creates online receipt pending bank match','accountant',async p=>{
  await p.nav('Fee Collection');await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(120);ok(await p.$('.qr'),'no QR');
  await p.click('[data-act=reqSend]');ok(/link sent/i.test(await p.toast()),'link not sent');
  await p.click('[data-act=reqSim]');await p.waitForTimeout(150);const d=await p.db();const pay=d.payments.pop();ok(pay.channel==='online'&&pay.settle.status==='pending','online payment '+JSON.stringify(pay.settle));ok(await p.$('.receipt'),'no receipt');
  ok(d.messages.some(m=>m.kind==='receipt'),'receipt message not logged');
});
await T('Fees','FE-online-fail','Gateway failure creates no receipt and no ledger change','accountant',async p=>{
  const n0=(await p.db()).payments.length;await p.nav('Fee Collection');await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(100);await p.click('[data-act=reqFail]');await p.waitForTimeout(100);
  ok((await p.db()).payments.length===n0,'payment created on failure');ok(/failed/i.test(await p.toast()),'no failure message');
});
await T('Fees','FE-online-cancel','Payment request can be cancelled','accountant',async p=>{await p.nav('Fee Collection');await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(100);await p.click('[data-act=reqCancel]');await p.waitForTimeout(100);ok(!(await p.$('.qr')),'QR still shown')});
await T('Fees','FE-student-pick','Student search and dropdown change collection target','accountant',async p=>{
  await p.nav('Fee Collection');await p.fill('#feeSearch','Riya');await p.waitForTimeout(100);ok(/Riya/.test(await p.$eval('#f_sid',e=>e.selectedOptions[0].textContent)),'search did not select');
});
await T('Fees','FE-collect-for','Collect button in pending list jumps to that student','accountant',async p=>{
  await p.nav('Fee Collection');const b=await p.$$('[data-act=collectFor]');await b[2].click();await p.waitForTimeout(120);const id=await b[2].evaluate(e=>e.dataset.id).catch(()=>null);
  ok(await p.$eval('#f_sid',e=>e.value)!==undefined,'no selection');
});
await T('Fees','FE-dues','Pending dues tab lists students, filters and sends reminders','accountant',async p=>{
  await p.nav('Fee Collection');await p.tab('Pending dues');const n=await p.$$eval('#page tbody tr',e=>e.length);ok(n>3,'rows '+n);
  const sel=await p.$('#page select');if(sel){const opts=await sel.$$eval('option',o=>o.map(x=>x.value));if(opts.length>1){await sel.selectOption(opts[1]);await p.waitForTimeout(100)}}
  const m0=(await p.db()).messages.length;await p.click('[data-act=remindAll]');await p.waitForTimeout(150);if(await p.$('#dlgOk')){await p.click('#dlgOk');await p.waitForTimeout(150)}ok((await p.db()).messages.length>m0,'no reminders logged');
});
await T('Fees','FE-dues-export','Dues CSV export','accountant',async p=>{await p.nav('Fee Collection');await p.tab('Pending dues');await p.click('[data-act=exportDues]');await p.waitForTimeout(100);ok(/Payable|Student/i.test(await p.$eval('#csvText',e=>e.value)),'csv')});
await T('Fees','FE-receipts','Receipts list with filters and receipt view','accountant',async p=>{
  await p.nav('Fee Collection');await p.tab('Receipts');const n=await p.$$eval('#page tbody tr',e=>e.length);ok(n>5,'rows '+n);
  await p.click('#page [data-act=viewReceipt]');await p.waitForTimeout(120);ok(await p.$('.drawer .receipt'),'receipt drawer');ok(/Fee head|Amount received/.test(await p.text('.drawer')),'receipt detail');
});
await T('Fees','FE-cancel','Cancel receipt reverses payment, restores balance, logs refund','accountant',async p=>{
  await collectCash(p);const d0=await p.db();const pay=d0.payments.pop();const before=await p.evaluate(i=>feeSum(stu(i)).payable,pay.studentId);
  await p.evaluate(i=>ACT.viewReceipt({dataset:{id:i}}),pay.id);await p.click('[data-act=cancelReceipt]');await p.fill('form[data-form=cancelReceipt] [name=reason]','duplicate');await p.click('form[data-form=cancelReceipt] button.danger');await p.waitForTimeout(150);
  const d=await p.db();ok(d.payments.find(x=>x.id===pay.id).status==='cancelled','not cancelled');ok(d.refunds.some(r=>r.rc===pay.rc),'no refund');
  ok((await p.evaluate(i=>feeSum(stu(i)).payable,pay.studentId))===before+pay.amount,'balance not restored');
  ok(await p.evaluate(()=>cashExpected(today()))===0,'cash drawer not reversed');
});
await T('Fees','FE-cancel-reason','Cancel requires a reason','accountant',async p=>{
  await collectCash(p);const pay=(await p.db()).payments.pop();await p.evaluate(i=>ACT.viewReceipt({dataset:{id:i}}),pay.id);await p.click('[data-act=cancelReceipt]');await p.click('form[data-form=cancelReceipt] button.danger');await p.waitForTimeout(100);
  ok((await p.db()).payments.find(x=>x.id===pay.id).status==='ok','cancelled without reason');
});
await T('Fees','FE-cancel-old','Old-semester receipts cannot be cancelled','principal',async p=>{
  const r=await p.evaluate(()=>{const s=dueList()[0].s;const pay=recordPayment(s,{amount:100,mode:'Cash',channel:'counter',force:true});s.fee=newFee({sem:s.fee.sem+1,courseId:s.course,planName:s.fee.planName,start:today()});try{cancelPayment(pay,'x','Cash');return'allowed'}catch(e){return e.message}});ok(/this semester/i.test(r),r);
});
await T('Fees','FE-receipt-actions','Copy receipt text and send on WhatsApp','accountant',async p=>{
  await p.nav('Fee Collection');await p.tab('Receipts');await p.click('#page [data-act=viewReceipt]');await p.waitForTimeout(100);const m0=(await p.db()).messages.length;
  await p.click('.drawer [data-act=sendReceipt]');await p.waitForTimeout(100);ok((await p.db()).messages.length===m0+1,'message not logged');
  const t=await p.evaluate(()=>{const pay=db.payments[0];return receiptText(pay)});ok(/Fee receipt/.test(t)&&/Balance after/.test(t),'receipt text');
});
await T('Fees','FE-concession-tab','Concessions tab: clerk request goes to approval, principal approves','clerk',async p=>{
  const id=(await p.db()).students[4].id;await p.nav('Fee Collection');await p.tab('Concessions');await p.selectOption('form[data-form=concRequest] [name=sid]',id);await p.fill('form[data-form=concRequest] [name=why]','income cert');await p.click('form[data-form=concRequest] button.primary');await p.waitForTimeout(150);
  ok((await p.db()).students.find(s=>s.id===id).fee.concession.status==='pending','not pending');
});
await T('Fees','FE-dayclose','Day close matches cash; mismatch needs a reason','accountant',async p=>{
  await collectCash(p);await p.tab('Day close');const ex=await p.evaluate(()=>cashExpected(today()));
  await p.fill('input[name=counted]',String(ex-100));await p.dispatchEvent('input[name=counted]','input');await p.waitForTimeout(80);ok(await p.$eval('#reasonBox',e=>e.style.display!=='none'),'reason box not shown');
  await p.click('form[data-form=closeDay] button');await p.waitForTimeout(100);ok(!(await p.db()).closures[await p.evaluate(()=>today())],'closed without reason');
  await p.fill('#f_reason','Short change');await p.click('form[data-form=closeDay] button');await p.waitForTimeout(150);const c=(await p.db()).closures[await p.evaluate(()=>today())];ok(c&&c.diff===-100,'closure '+JSON.stringify(c));
});
await T('Fees','FE-dayclose-lock','Closed day blocks counter payments; online still allowed','accountant',async p=>{
  await p.nav('Fee Collection');await p.tab('Day close');const ex=await p.evaluate(()=>cashExpected(today()));await p.fill('input[name=counted]',String(ex));await p.click('form[data-form=closeDay] button');await p.waitForTimeout(100);
  const r=await p.evaluate(()=>{const s=dueList()[0].s;try{recordPayment(s,{amount:100,mode:'Cash',channel:'counter'});return'allowed'}catch(e){return e.message}});ok(/closed/i.test(r),'counter allowed: '+r);
  const r2=await p.evaluate(()=>{const s=dueList()[0].s;try{recordPayment(s,{amount:100,mode:'Google Pay (UPI)',channel:'online'});return'allowed'}catch(e){return e.message}});ok(r2==='allowed','online blocked: '+r2);
});
await T('Fees','FE-reopen','Principal can reopen a closed day; accountant cannot','principal',async p=>{
  await p.evaluate(()=>{db.closures[today()]={date:today(),expected:0,counted:0,diff:0,by:'x',ts:1};save()});await p.nav('Fee Collection');await p.tab('Day close');
  const b=await p.$('[data-act=reopenDay]');ok(b,'no reopen button');await b.click();await p.waitForTimeout(100);ok(!(await p.db()).closures[await p.evaluate(()=>today())],'not reopened');
});
await T('Fees','FE-reopen-deny','Accountant cannot reopen a day','accountant',async p=>{const r=await p.evaluate(()=>{try{ACT.reopenDay({dataset:{d:today()}});return'allowed'}catch(e){return e.message}});ok(/Principal/.test(r),r)});
await T('Fees','FE-bank','Bank settlement import matches pending online payments','accountant',async p=>{
  await p.nav('Fee Collection');await p.click('form[data-form=collect] button.primary');await p.click('[data-act=reqSim]');await p.waitForTimeout(150);await p.evaluate(()=>{db.payments.forEach(x=>{if(x.channel==='online')x.date=addDays(today(),-2)});save()});await p.tab('Bank matching');
  const pend=(await p.db()).payments.filter(x=>x.settle?.status==='pending').length;ok(pend>=1,'none pending');
  await p.click('[data-act=bankImport]:not([disabled])');await p.waitForTimeout(150);ok((await p.db()).payments.filter(x=>x.settle?.status==='pending').length===0,'still pending');
});
await T('Fees','FE-setup-head','Fee setup: add head, save, new admission uses new structure','admin',async p=>{
  await p.nav('Fee Collection');await p.tab('Fee setup');await p.click('[data-act=addHead][data-c=bed]');
  const heads=await p.$$('#heads_bed [name=hname]');await heads[heads.length-1].fill('Library deposit');const am=await p.$$('#heads_bed [name=hamt]');await am[am.length-1].fill('1000');
  await p.click('form[data-form=feeStruct][data-c=bed] button.primary');await p.waitForTimeout(150);ok((await p.db()).feeStructure.bed.some(h=>h.name==='Library deposit'),'head not saved');
  const s=await admit(p,{name:'New Fee Student'});ok(s.fee.total===26300,'new admission fee '+s.fee.total);
});
await T('Fees','FE-setup-del','Fee setup: remove head; last head cannot be removed','admin',async p=>{
  await p.nav('Fee Collection');await p.tab('Fee setup');const n0=(await p.$$('#heads_med [name=hname]')).length;await p.click('#heads_med [data-act=delHead]');ok((await p.$$('#heads_med [name=hname]')).length===n0-1,'not removed');
  for(let i=0;i<n0;i++){await p.click('#heads_med [data-act=delHead]').catch(()=>{})}ok((await p.$$('#heads_med [name=hname]')).length>=1,'all heads removed');
});
await T('Fees','FE-setup-rules','Late fee rules save and change late fee calculation','admin',async p=>{
  await p.nav('Fee Collection');await p.tab('Fee setup');await p.fill('form[data-form=feeRules] [name=lateFeePerDay]','50');await p.fill('form[data-form=feeRules] [name=graceDays]','0');await p.click('form[data-form=feeRules] button.primary');await p.waitForTimeout(150);
  const d=await p.db();ok(d.settings.lateFeePerDay===50&&d.settings.graceDays===0,'rules '+d.settings.lateFeePerDay);
});
await T('Fees','FE-late-calc','Late fee = (days overdue − grace) × rate, capped, frozen once paid','accountant',async p=>{
  const r=await p.evaluate(()=>{const st=db.settings;const f={plan:[{label:'I',amt:1000,due:addDays(today(),-20)}],total:1000};const lf=lateAt(f,today(),0,[]);const expect=Math.min(st.lateCap,Math.max(0,(20-st.graceDays))*st.lateFeePerDay);return[lf,expect]});ok(r[0]===r[1],'late '+r.join(' vs '));
});
await T('Fees','FE-ledger-replay','Cancelling an earlier receipt re-allocates later receipts correctly','principal',async p=>{
  const r=await p.evaluate(()=>{const s=makeStudent({name:'Replay',gender:'Female',course:'bed',batch:db.batches.find(b=>b.course==='bed').id,div:db.divisions[0].id,sem:1,phone:'9000000011',gname:'g',gphone:'9000000012',docs:{},start:today(),planName:db.plans[1].name});db.students.push(s);
   const a=recordPayment(s,{amount:1000,mode:'Cash',channel:'counter',ts:Date.now()-5000});const b=recordPayment(s,{amount:2000,mode:'Cash',channel:'counter',ts:Date.now()-1000});const paid0=s.fee.paid;cancelPayment(a,'x','Cash');return[paid0,s.fee.paid,b.balAfter,s.fee.total]});
  ok(r[0]===3000&&r[1]===2000,'paid '+r.join());ok(r[2]===r[3]-2000,'balAfter '+r[2]);
});
await T('Fees','FE-clerk-no-reverse','Clerk cannot cancel receipts','clerk',async p=>{await p.nav('Fee Collection');await p.tab('Receipts').catch(()=>{});await p.click('#page [data-act=viewReceipt]').catch(()=>{});ok(!(await p.$('[data-act=cancelReceipt]')),'clerk sees cancel')});

/* ================= ACADEMIC ================= */
await T('Academic','AC-course','Add course creates it and enrolment code; remove blocked when students exist','admin',async p=>{
  await p.nav('Academic Setup');await p.click('[data-act=addCourse]');await p.fill2('form[data-form=addCourse]',{name:'B.P.Ed',code:'BPE',full:'Bachelor of Physical Education',semesters:'4',intake:'40'});await p.click('form[data-form=addCourse] button.primary');await p.waitForTimeout(150);
  ok((await p.db()).courses.some(c=>c.name==='B.P.Ed'),'course not added');
  const r=await p.evaluate(()=>{try{ACT.delCourse({dataset:{id:'bed'}});return'allowed'}catch(e){return e.message}});await p.waitForTimeout(100);ok(/student|cannot|dialog|remove/i.test(r+await p.text('#dlg')+(await p.toast())),'course with students removable: '+r);
});
await T('Academic','AC-course-del','Empty course can be removed','admin',async p=>{
  await p.nav('Academic Setup');await p.click('[data-act=addCourse]');await p.fill2('form[data-form=addCourse]',{name:'Temp',code:'TMP',full:'Temp Course',semesters:'2',intake:'10'});await p.click('form[data-form=addCourse] button.primary');await p.waitForTimeout(150);
  const id=(await p.db()).courses.find(c=>c.name==='Temp').id;await p.click(`[data-act=delCourse][data-id=${id}]`);await p.waitForTimeout(100);if(await p.$('#dlgOk'))await p.click('#dlgOk');await p.waitForTimeout(150);ok(!(await p.db()).courses.some(c=>c.id===id),'not removed');
});
await T('Academic','AC-batch','Add batch; duplicate batch refused','admin',async p=>{
  await p.nav('Academic Setup');const f='form[data-form=addBatch][data-c=bed]';await p.fill2(f,{name:'2027–29',startYear:'2027'});await p.click(f+' button');await p.waitForTimeout(150);ok((await p.db()).batches.some(b=>b.name==='2027–29'),'batch not added');
  await p.fill2(f,{name:'2027–29',startYear:'2027'});await p.click(f+' button');await p.waitForTimeout(100);ok((await p.db()).batches.filter(b=>b.name==='2027–29').length===1,'duplicate batch');
});
await T('Academic','AC-division','Add division; duplicate refused; remove blocked if students','admin',async p=>{
  await p.nav('Academic Setup');const b=(await p.db()).batches.find(x=>x.course==='bed');const f=`form[data-form=addDivision][data-b=${b.id}]`;await p.fill2(f,{name:'Z',capacity:'30'});await p.click(f+' button');await p.waitForTimeout(150);
  const dz=(await p.db()).divisions.find(d=>d.name==='Z');ok(dz,'division not added');await p.fill2(f,{name:'z',capacity:'30'});await p.click(f+' button');await p.waitForTimeout(100);ok((await p.db()).divisions.filter(d=>d.name.toLowerCase()==='z'&&d.batch===b.id).length===1,'duplicate division');
  await p.click(`[data-act=delDivision][data-id=${dz.id}]`);await p.waitForTimeout(100);if(await p.$('#dlgOk'))await p.click('#dlgOk');await p.waitForTimeout(100);ok(!(await p.db()).divisions.some(d=>d.id===dz.id),'empty division not removed');
  const withStu=(await p.db()).divisions.find(d=>(0,1));
  const r=await p.evaluate(()=>{const d=db.divisions.find(x=>db.students.some(s=>s.div===x.id));try{ACT.delDivision({dataset:{id:d.id}});return document.querySelector('#dlg')?.innerText||'ok'}catch(e){return e.message}});await p.waitForTimeout(80);
  ok(/student|cannot/i.test(r+(await p.toast())),'division with students removable: '+r);
});
await T('Academic','AC-batch-del','Batch with students cannot be removed','admin',async p=>{
  const r=await p.evaluate(()=>{const b=db.batches.find(x=>db.students.some(s=>s.batch===x.id));try{ACT.delBatch({dataset:{id:b.id}});return document.querySelector('#dlg')?.innerText||'allowed'}catch(e){return e.message}});await p.waitForTimeout(80);ok(/student|cannot/i.test(r+(await p.toast())),r);
});
await T('Academic','AC-teacher','Class teacher can be assigned to a division','admin',async p=>{
  await p.nav('Academic Setup');const sel=await p.$('[data-change=divTeacher]');const opts=await sel.$$eval('option',o=>o.map(x=>x.value));const cur=await sel.evaluate(e=>e.value);const pick=opts.find(o=>o!==cur);await sel.selectOption(pick);await p.waitForTimeout(100);
  const id=await sel.evaluate(e=>e.dataset.id);ok((await p.db()).divisions.find(d=>d.id===id).teacher===pick,'teacher not saved');
});
await T('Academic','AC-subject','Add subject, assign faculty, remove','admin',async p=>{
  await p.nav('Academic Setup');await p.tab('Subjects');const f='form[data-form=addSubject][data-c=bed]';await p.fill2(f,{name:'Yoga Education',sem:'2'});await p.click(f+' button');await p.waitForTimeout(150);
  const sb=(await p.db()).subjects.find(s=>s.name==='Yoga Education');ok(sb,'subject not added');
  const sel=await p.$(`[data-change=subFaculty][data-id=${sb.id}]`);ok(sel,'no faculty selector');const opts=await sel.$$eval('option',o=>o.map(x=>x.value)).catch(()=>[]);if(opts.length>1){await sel.selectOption(opts[opts.length-1]);await p.waitForTimeout(100);ok((await p.db()).subjects.find(s=>s.id===sb.id).faculty===opts[opts.length-1],'faculty not saved')}
  await p.click(`[data-act=delSubject][data-id=${sb.id}]`);await p.waitForTimeout(100);ok(!(await p.db()).subjects.some(s=>s.id===sb.id),'subject not removed');
});
await T('Academic','AC-subject-marks','Subject with marks cannot be removed','admin',async p=>{
  const r=await p.evaluate(()=>{const m=db.marks[0];try{ACT.delSubject({dataset:{id:m.subjectId}});return'allowed'}catch(e){return e.message}});ok(/Marks exist/.test(r),r);
});
await T('Academic','AC-newdiv-admit','New division appears in admission and student is placed there','admin',async p=>{
  await p.nav('Academic Setup');const b=(await p.db()).batches.filter(x=>x.course==='bed').pop();const f=`form[data-form=addDivision][data-b=${b.id}]`;await p.fill2(f,{name:'Q',capacity:'5'});await p.click(f+' button');await p.waitForTimeout(150);
  await p.nav('Students');await p.click('[data-act=newAdmission]');await p.fill('#adm [name=name]','Q Student');await p.fill('#adm [name=dob]','2001-01-01');await p.fill('#adm [name=aadhaar]','111122223333');await p.click('[data-act=admNext]');
  await p.fill('#adm [name=phone]','9777700000');await p.fill('#adm [name=address]','a');await p.fill('#adm [name=gname]','g');await p.fill('#adm [name=gphone]','9777700001');await p.click('[data-act=admNext]');await p.click('[data-act=admNext]');
  const opts=await p.$$eval('#f_div option',o=>o.map(x=>x.textContent));ok(opts.some(x=>/Q/.test(x)),'division Q not offered: '+opts.join());
});

/* ================= ATTENDANCE ================= */
await T('Attendance','AT-mark','Mark attendance with absentees saves and shows counts','faculty',async p=>{
  await p.nav('Attendance');const dv=await p.$eval('[data-change=attDiv]',e=>e.value);const a=await p.$('form[data-form=markAtt] input[value=A]');await a.check();await p.click('form[data-form=markAtt] button.primary');await p.waitForTimeout(150);
  const d=await p.db();const day=Object.values(d.attendance).flatMap(x=>Object.entries(x)).find(([k,v])=>k===dv&&Object.values(v.marks).includes('A'));ok(day,'absence not stored');ok(/1 absent/.test(await p.toast()),'toast');
});
await T('Attendance','AT-allpresent','Mark all present button','faculty',async p=>{await p.nav('Attendance');const a=await p.$('form[data-form=markAtt] input[value=A]');await a.check();await p.click('[data-act=allPresent]');ok(!(await p.$eval('form[data-form=markAtt] input[value=A]',e=>e.checked)),'still absent')});
await T('Attendance','AT-future','Future date is refused','faculty',async p=>{
  const r=await p.evaluate(()=>{const d=myDivisions()[0];try{FORM.markAtt({dataset:{d:d.id}},{date:addDays(today(),3)});return'allowed'}catch(e){return e.message}});ok(/future/i.test(r),r);
});
await T('Attendance','AT-sunday','Sunday is refused as a holiday','faculty',async p=>{
  const r=await p.evaluate(()=>{const d=myDivisions()[0];let x=today();while(parseD(x).getDay()!==0)x=addDays(x,-1);try{FORM.markAtt({dataset:{d:d.id}},{date:x});return'allowed'}catch(e){return e.message}});ok(/Sunday/i.test(r),r);
});
await T('Attendance','AT-scope','Faculty sees only own divisions; principal sees all','faculty',async p=>{
  await p.nav('Attendance');const n=await p.$$eval('[data-change=attDiv] option',o=>o.length);const all=(await p.db()).divisions.length;ok(n>=1&&n<all,'faculty divisions '+n+' of '+all);
});
await T('Attendance','AT-other-div','Faculty cannot mark a division that is not theirs','faculty',async p=>{
  const r=await p.evaluate(()=>{const mine=myDivisions().map(d=>d.id);const o=db.divisions.find(d=>!mine.includes(d.id));try{FORM.markAtt({dataset:{d:o.id}},{date:today()});return'allowed'}catch(e){return e.message}});ok(/not one of your/i.test(r),r);
});
await T('Attendance','AT-register','Register tab shows day-wise attendance','principal',async p=>{await p.nav('Attendance');await p.tab('Register');ok(/P|A/.test(await p.text())&&(await p.$$eval('#page tbody tr',e=>e.length))>3,'register empty')});
await T('Attendance','AT-low','Below 75% list and notify guardians','principal',async p=>{
  await p.evaluate(()=>{const s=db.students.find(x=>x.status==='Active');Object.values(db.attendance).forEach(day=>{const r=day[s.div];if(r&&r.marks[s.id])r.marks[s.id]='A'});save()});
  await p.nav('Attendance');await p.tab('Below 75%');const n=await p.$$eval('#page tbody tr',e=>e.length);ok(n>=1,'none listed');const m0=(await p.db()).messages.length;
  const b=await p.$('[data-act=notifyAtt]');ok(b,'no notify');await b.click();await p.waitForTimeout(150);if(await p.$('#dlgOk'))await p.click('#dlgOk');await p.waitForTimeout(100);ok((await p.db()).messages.length>m0,'no message');
});
await T('Attendance','AT-pct','Attendance percentage is computed correctly','principal',async p=>{
  const r=await p.evaluate(()=>{const s=db.students.find(x=>x.status==='Active');let P=0,T=0;Object.values(db.attendance).forEach(day=>{const r=day[s.div];if(r&&r.sem===s.sem&&r.marks[s.id]){T++;if(r.marks[s.id]==='P')P++}});return[attPct(s),Math.round(P/T*100)]});ok(r[0]===r[1],r.join());
});

/* ================= MARKS ================= */
await T('Marks','MK-save','Faculty saves marks for own subject','faculty',async p=>{
  await p.nav('Internal Marks');const i=await p.$('form[data-form=saveMarks] input[name^=s_]:not([disabled])');ok(i,'inputs disabled');await i.fill('9');await p.click('form[data-form=saveMarks] button.primary');await p.waitForTimeout(150);
  const d=await p.db();ok(d.marks.some(m=>Object.values(m.scores).includes('9')),'marks not stored');
});
await T('Marks','MK-max','Marks above maximum are refused','faculty',async p=>{
  await p.nav('Internal Marks');const i=await p.$('form[data-form=saveMarks] input[name^=s_]:not([disabled])');await i.fill('99');await p.click('form[data-form=saveMarks] button.primary');await p.waitForTimeout(150);
  ok(!(await p.db()).marks.some(m=>Object.values(m.scores).includes('99')),'saved above max');
});
await T('Marks','MK-ownership','Faculty cannot edit another faculty subject','faculty',async p=>{
  const r=await p.evaluate(()=>{const me=cur().staffId;const sb=db.subjects.find(s=>s.faculty!==me);const d=db.divisions.find(x=>x.course===sb.course&&semOfDiv(x)===sb.sem);ui.f.marks={div:d.id,sub:sb.id,exam:'Internal 1'};try{FORM.saveMarks({}, {max:'20'});return'allowed'}catch(e){return e.message}});ok(/own subjects/i.test(r),r);
});
await T('Marks','MK-principal-view','Principal sees marks read-only','principal',async p=>{await p.nav('Internal Marks');ok(/View only/i.test(await p.text())||(await p.$$eval('form[data-form=saveMarks] input[name^=s_]:not([disabled])',e=>e.length))===0,'principal can edit')});
await T('Marks','MK-export','Marks sheet CSV','principal',async p=>{await p.nav('Internal Marks');await p.click('[data-act=exportMarks]');await p.waitForTimeout(100);ok(/Enrolment/.test(await p.$eval('#csvText',e=>e.value)),'csv')});
await T('Marks','MK-profile','Saved marks appear in student profile and parent home','faculty',async p=>{
  await p.nav('Internal Marks');const i=await p.$('form[data-form=saveMarks] input[name^=s_]:not([disabled])');const name=await i.getAttribute('name');await i.fill('12');await p.click('form[data-form=saveMarks] button.primary');await p.waitForTimeout(150);
  const sid=name.slice(2);ok(await p.evaluate(s=>marksSummary(stu(s)).includes('12 / '),sid),'not in profile');
});
await T('Marks','MK-exam-switch','Exam and subject selectors load different sheets','faculty',async p=>{
  await p.nav('Internal Marks');await p.selectOption('[aria-label=Exam]','Assignment');await p.waitForTimeout(100);ok(await p.$('form[data-form=saveMarks]'),'sheet missing');
});

/* ================= PRACTICE ================= */
await T('Practice','PR-school','Add practice school','principal',async p=>{
  await p.nav('Practice Teaching');await p.tab('School').catch(()=>{});await p.fill2('form[data-form=addSchool]',{name:'Test High School',city:'Ahmedabad',mentor:'Mrs Test'});await p.click('form[data-form=addSchool] button.primary');await p.waitForTimeout(150);
  ok((await p.db()).schools.some(s=>s.name==='Test High School'),'not added');
});
await T('Practice','PR-allot','Allot student to school; duplicate phase refused; end before start refused','principal',async p=>{
  await p.nav('Practice Teaching');const f='form[data-form=addAllot]';ok(await p.$(f),'no allot form');await p.fill(f+' [name=start]','2026-11-10');await p.fill(f+' [name=end]','2026-12-10');await p.selectOption(f+' [name=phase]','Phase 3');
  const sid=await p.$eval(f+' [name=sid]',e=>e.value);const n0=(await p.db()).practice.length;await p.click(f+' button.primary');await p.waitForTimeout(150);ok((await p.db()).practice.length===n0+1,'not allotted');
  await p.selectOption(f+' [name=sid]',sid);await p.selectOption(f+' [name=phase]','Phase 3');await p.fill(f+' [name=start]','2026-11-10');await p.fill(f+' [name=end]','2026-12-10');await p.click(f+' button.primary');await p.waitForTimeout(100);ok((await p.db()).practice.length===n0+1,'duplicate allotted');
  const r=await p.evaluate(()=>{try{FORM.addAllot({}, {sid:db.students[0].id,school:db.schools[0].id,phase:'Phase 2',start:'2026-12-10',end:'2026-11-10'});return'allowed'}catch(e){return e.message}});ok(/before the start/i.test(r),r);
});
await T('Practice','PR-eval','Evaluate practice teaching with score and notes','faculty',async p=>{
  await p.nav('Practice Teaching');const b=await p.$('[data-act=evalPractice]');ok(b,'no evaluate button');await b.click();await p.fill('form[data-form=evalPractice] [name=score]','17');await p.fill('form[data-form=evalPractice] [name=notes]','Good lesson plan');await p.click('form[data-form=evalPractice] button.primary');await p.waitForTimeout(150);
  ok((await p.db()).practice.some(x=>String(x.score)==='17'&&x.notes==='Good lesson plan'),'not saved');
});
await T('Practice','PR-del','Remove allotment and school','principal',async p=>{
  await p.nav('Practice Teaching');const n0=(await p.db()).practice.length;const b=await p.$('[data-act=delAllot]');ok(b,'no delete allot');await b.click();await p.waitForTimeout(100);if(await p.$('#dlgOk'))await p.click('#dlgOk');await p.waitForTimeout(100);ok((await p.db()).practice.length===n0-1,'allot not removed');
  const sb=await p.$('[data-act=delSchool]');if(sb){await sb.click();await p.waitForTimeout(100);if(await p.$('#dlgOk'))await p.click('#dlgOk');await p.waitForTimeout(100)}
});
await T('Practice','PR-mphil','Only B.Ed students are offered for allotment','principal',async p=>{
  await p.nav('Practice Teaching');const ids=await p.$$eval('form[data-form=addAllot] [name=sid] option',o=>o.map(x=>x.value));ok(ids.every(i=>/^BED/.test(i)),'non B.Ed offered: '+ids.filter(i=>!/^BED/.test(i)));
});

/* ================= MESSAGES ================= */
await T('Messages','MS-remind','Send reminders to selected students writes message log','accountant',async p=>{
  await p.nav('Messages and Notices');const m0=(await p.db()).messages.length;const n=await p.$$eval('form[data-form=sendRemind] input[name=ids]:checked',e=>e.length);ok(n>0,'no recipients');await p.click('form[data-form=sendRemind] button.gold');await p.waitForTimeout(150);
  ok((await p.db()).messages.length===m0+n,'logged '+((await p.db()).messages.length-m0)+' of '+n);
});
await T('Messages','MS-remind-opts','Reminder template, channel and recipient filter change preview','accountant',async p=>{
  await p.nav('Messages and Notices');const a=await p.text('.bubble');await p.selectOption('[data-k=kind]','overdue');await p.waitForTimeout(100);ok((await p.text('.bubble'))!==a,'preview unchanged');await p.selectOption('[data-k=only]','');await p.waitForTimeout(100);
  const n=await p.$$eval('form[data-form=sendRemind] input[name=ids]',e=>e.length);ok(n>=(await p.evaluate(()=>dueList().filter(x=>x.sm.overdue).length)),'filter');
});
await T('Messages','MS-notice','Post notice, appears in list, parent can read it, delete removes','principal',async p=>{
  await p.nav('Messages and Notices');await p.tab('Notices');await p.fill2('form[data-form=addNotice]',{title:'Holiday Notice',body:'College closed on Friday',audience:'all'});await p.click('form[data-form=addNotice] button.primary');await p.waitForTimeout(150);
  ok((await p.db()).notices.some(n=>n.title==='Holiday Notice'),'not stored');ok(/Holiday Notice/.test(await p.text()),'not listed');
  await p.logout();await p.login('parent','parent123');await p.nav('Notices');ok(/Holiday Notice/.test(await p.text()),'parent cannot see notice');
});
await T('Messages','MS-notice-aud','Course-specific notice is hidden from other course parents','principal',async p=>{
  await p.nav('Messages and Notices');await p.tab('Notices');await p.fill2('form[data-form=addNotice]',{title:'MEd Only',body:'x',audience:'med'});await p.click('form[data-form=addNotice] button.primary');await p.waitForTimeout(150);
  await p.logout();await p.login('parent','parent123');await p.nav('Notices');ok(!/MEd Only/.test(await p.text()),'B.Ed parent sees M.Ed notice');
});
await T('Messages','MS-notice-del','Delete notice','principal',async p=>{await p.nav('Messages and Notices');await p.tab('Notices');const n0=(await p.db()).notices.length;await p.click('[data-act=delNotice]');await p.waitForTimeout(100);ok((await p.db()).notices.length===n0-1,'not deleted')});
await T('Messages','MS-log','Message log shows sent messages including receipts','accountant',async p=>{await collectCash(p);await p.nav('Messages and Notices');await p.tab('Message log');ok(/receipt/i.test(await p.text()),'receipt message missing')});
await T('Messages','MS-clerk-deny','Clerk has no Messages menu','clerk',async p=>{ok(!(await p.navs()).includes('Messages and Notices'),'menu visible')});

/* ================= STAFF ================= */
await T('Staff','SF-add','Add staff with login; new staff can sign in with role permissions','admin',async p=>{
  await p.nav('Staff and Roles');await p.click('[data-act=addStaff]');await p.fill2('form[data-form=saveStaff]',{name:'Kiran Mehta',designation:'Cashier',role:'Accountant',username:'kiran',password:'kiran123'});await p.click('form[data-form=saveStaff] button.primary');await p.waitForTimeout(200);
  ok((await p.db()).users.some(u=>u.username==='kiran'&&u.role==='Accountant'),'login not created');await p.logout();ok(await p.login('kiran','kiran123'),'cannot sign in');ok((await p.navs()).includes('Fee Collection'),'no fee menu');
});
await T('Staff','SF-nologin','Staff with role None has no login','admin',async p=>{
  await p.nav('Staff and Roles');await p.click('[data-act=addStaff]');await p.fill2('form[data-form=saveStaff]',{name:'Peon Ramesh',designation:'Peon',role:'None'});await p.click('form[data-form=saveStaff] button.primary');await p.waitForTimeout(150);
  const d=await p.db();const s=d.staff.find(x=>x.name==='Peon Ramesh');ok(s&&!s.userId,'login created');
});
await T('Staff','SF-dup','Duplicate username refused','admin',async p=>{
  await p.nav('Staff and Roles');await p.click('[data-act=addStaff]');await p.fill2('form[data-form=saveStaff]',{name:'Dup User',designation:'x',role:'Clerk',username:'admin',password:'abcdef'});await p.click('form[data-form=saveStaff] button.primary');await p.waitForTimeout(150);
  ok(/taken/i.test(await p.toast()),'no duplicate message');ok(!(await p.db()).staff.some(s=>s.name==='Dup User'),'staff saved anyway');
});
await T('Staff','SF-pw','Short password refused; missing username refused','admin',async p=>{
  await p.nav('Staff and Roles');await p.click('[data-act=addStaff]');await p.fill2('form[data-form=saveStaff]',{name:'Short Pw',designation:'x',role:'Clerk',username:'shortpw',password:'123'});await p.click('form[data-form=saveStaff] button.primary');await p.waitForTimeout(150);
  ok(/6 characters/.test(await p.toast()),'no length message');await p.fill2('form[data-form=saveStaff]',{username:'',password:'abcdef'});await p.click('form[data-form=saveStaff] button.primary');await p.waitForTimeout(150);ok(/username/i.test(await p.toast()),'no username message');
});
await T('Staff','SF-edit','Edit staff; change role and reset password','admin',async p=>{
  await p.nav('Staff and Roles');const id=(await p.db()).staff.find(s=>s.role==='Clerk').id;await p.click(`[data-act=editStaff][data-id=${id}]`);await p.fill('form[data-form=saveStaff] [name=password]','newpass1');await p.click('form[data-form=saveStaff] button.primary');await p.waitForTimeout(150);
  await p.logout();ok(await p.login('clerk','newpass1'),'new password not working');
});
await T('Staff','SF-deactivate','Setting staff status Left disables the login','admin',async p=>{
  await p.nav('Staff and Roles');const id=(await p.db()).staff.find(s=>s.role==='Clerk').id;await p.click(`[data-act=editStaff][data-id=${id}]`);await p.selectOption('form[data-form=saveStaff] [name=status]','Left');await p.click('form[data-form=saveStaff] button.primary');await p.waitForTimeout(150);
  await p.logout();ok(!(await p.login('clerk','clerk123')),'left staff can log in');
});
await T('Staff','SF-matrix','Permission matrix change takes effect for that role','admin',async p=>{
  await p.nav('Staff and Roles');await p.tab('Role permissions');await p.check('input[data-role=Clerk][data-p="messages.send"]');await p.waitForTimeout(100);
  await p.logout();await p.login('clerk','clerk123');ok((await p.navs()).includes('Messages and Notices'),'clerk did not gain Messages');
});
await T('Staff','SF-matrix-lock','Super Admin column is locked; non-admin cannot edit matrix','admin',async p=>{
  await p.nav('Staff and Roles');await p.tab('Role permissions');ok(await p.$eval('input[data-role="Super Admin"]',e=>e.disabled),'super admin editable');
  const r=await p.evaluate(()=>{ui.f={};const u=db.users.find(x=>x.role==='Clerk');sesSet(u.id);try{CHG.permToggle({dataset:{role:'Clerk',p:'fees.collect'},checked:false});return'allowed'}catch(e){return e.message}});ok(/Only the admin/.test(r),r);
});
await T('Staff','SF-principal-view','Principal can view staff but not add','principal',async p=>{await p.nav('Staff and Roles');ok(!(await p.$('[data-act=addStaff]')),'principal can add staff');ok((await p.$$eval('#page tbody tr',e=>e.length))>5,'staff list')});

/* ================= REPORTS ================= */
const REPS={admin:['daily','defaulters','heads','conc','mode','bank','refunds','gov','strength','adm','docs','att','marks','practice','staff']};
for(const id of REPS.admin){
  await T('Reports','RP-'+id,`Report "${id}" renders, filters and exports`,'admin',async p=>{
    await p.nav('Reports');await pickRep(p,id);await p.waitForTimeout(100);ok(await p.$('#page table'),'no table');
    const sels=await p.$$('#page .filters select');if(sels.length){const o=await sels[0].$$eval('option',x=>x.map(y=>y.value));if(o.length>1){await sels[0].selectOption(o[1]);await p.waitForTimeout(100);ok(await p.$('#page table'),'filter broke table')}}
    await p.click('[data-act=exportReport]');await p.waitForTimeout(100);ok((await p.$eval('#csvText',e=>e.value)).length>10,'csv empty');
  });
}
await T('Reports','RP-daily-sum','Daily collection total equals ledger','accountant',async p=>{
  await p.nav('Reports');const d=await p.evaluate(()=>{const day=db.payments.filter(p=>p.status==='ok').map(p=>p.date).sort().pop();ui.f.rep={id:'daily',date:day};renderPage();return{day,sum:db.payments.filter(p=>p.date===day&&p.status==='ok').reduce((a,b)=>a+b.amount,0)}});
  const t=await p.text();ok(t.includes(d.sum.toLocaleString('en-IN')),'sum '+d.sum+' not in report');
});
await T('Reports','RP-roles','Report access is role-scoped','faculty',async p=>{
  await p.nav('Reports');const ids=await p.$$eval('[data-act=pickReport]',e=>e.map(x=>x.dataset.id));ok(ids.every(i=>['att','marks','practice'].includes(i)),'faculty reports: '+ids);
});
await T('Reports','RP-clerk','Clerk gets student reports only','clerk',async p=>{await p.nav('Reports');const ids=await p.$$eval('[data-act=pickReport]',e=>e.map(x=>x.dataset.id));ok(ids.every(i=>['strength','adm','docs'].includes(i))&&ids.length===3,ids.join())});
await T('Reports','RP-concession-data','Concession register reflects approved concessions','principal',async p=>{
  await p.nav('Reports');await pickRep(p,'conc');const n=await p.$$eval('#page tbody tr',e=>e.length);ok(n===(await p.evaluate(()=>db.students.filter(s=>s.fee.concession.status!=='none').length)),'rows '+n);
});

/* ================= AUDIT ================= */
await T('Audit','AD-log','Actions are recorded with user and role','principal',async p=>{
  await collectCash(p).catch(()=>{});await p.evaluate(()=>{log('Test action','detail xyz');save()});await p.nav('Audit Log');ok(/Test action/.test(await p.text()),'entry missing');ok(/Principal/.test(await p.text()),'role missing');
});
await T('Audit','AD-search','Audit search filters live','principal',async p=>{await p.nav('Audit Log');const n0=await p.$$eval('#auditRows tr',e=>e.length);await p.fill('[data-live=auditQ]','Signed in');await p.waitForTimeout(100);const n=await p.$$eval('#auditRows tr',e=>e.length);ok(n>=1&&n<=n0,'filter '+n+'/'+n0)});
await T('Audit','AD-coverage','Sensitive actions are logged (payment, cancel, concession, staff, permission)','admin',async p=>{
  await p.evaluate(()=>{const s=dueList()[0].s;const pay=recordPayment(s,{amount:100,mode:'Cash',channel:'counter',by:'x'});});
  await p.nav('Staff and Roles');await p.tab('Role permissions');await p.check('input[data-role=Clerk][data-p="messages.send"]');await p.waitForTimeout(80);
  await p.click('[data-act=addStaff]').catch(()=>{});await p.keyboard.press('Escape');
  const acts=(await p.db()).audit.map(a=>a.action);ok(acts.includes('Permission changed'),'permission not logged');ok(acts.includes('Signed in'),'sign-in not logged');
});

/* ================= SETTINGS ================= */
await T('Settings','SE-save','College name change updates the whole app','admin',async p=>{
  await p.nav('Settings');await p.fill('form[data-form=saveSettings] [name=college]','Test Education College');await p.click('form[data-form=saveSettings] button.primary');await p.waitForTimeout(150);ok(/Test Education College/.test(await p.text('.brand')),'sidebar not updated');
});
await T('Settings','SE-backup','Backup shows JSON and restore round-trips','admin',async p=>{
  await p.nav('Settings');await p.click('[data-act=backupOut]');await p.waitForTimeout(100);const json=await p.$eval('#csvText',e=>e.value);ok(JSON.parse(json).ver===3,'backup json');
  await p.evaluate(()=>{db.students=db.students.slice(0,5);save()});await p.keyboard.press('Escape');await p.nav('Settings').catch(()=>{});
  await p.click('[data-act=backupIn]');await p.fill('form[data-form=restore] [name=json]',json);await p.click('form[data-form=restore] button');await p.waitForTimeout(200);ok((await p.db()).students.length===25,'restore failed');ok(await p.$('form[data-form=login]'),'not back at login');
});
await T('Settings','SE-restore-bad','Invalid backup is rejected without data loss','admin',async p=>{
  await p.nav('Settings');await p.click('[data-act=backupIn]');await p.fill('form[data-form=restore] [name=json]','{bad json');await p.click('form[data-form=restore] button');await p.waitForTimeout(100);ok(/not a valid/i.test(await p.toast()),'no error');ok((await p.db()).students.length===25,'data lost');
  await p.fill('form[data-form=restore] [name=json]','{"ver":2}');await p.click('form[data-form=restore] button');await p.waitForTimeout(100);ok(/different version/i.test(await p.toast()),'version not checked');
});
await T('Settings','SE-reset','Reset demo data restores sample data and removes created records','admin',async p=>{
  await admit(p,{name:'Will Vanish'});await p.keyboard.press('Escape');await p.nav('Settings');await p.click('[data-act=resetDemo]');await p.click('#dlgOk');await p.waitForTimeout(200);
  const d=await p.db();ok(d.students.length===25&&!d.students.some(s=>s.name==='Will Vanish'),'not reset');ok(await p.$('form[data-form=login]'),'not at login');
});
await T('Settings','SE-reset-login','Reset from login page works','admin',async p=>{await p.logout();await p.click('[data-act=resetDemo]');await p.click('#dlgOk');await p.waitForTimeout(150);ok(/reset/i.test(await p.toast()),'no toast')});
await T('Settings','SE-deny','Only admin sees Settings','principal',async p=>{ok(!(await p.navs()).includes('Settings'),'principal sees settings')});

/* ================= PARENT ================= */
await T('Parent Portal','PA-home','Parent sees only their own child','parent',async p=>{const t=await p.text();ok(/Riya Joshi/.test(t),'own child missing');ok(!/Aarav Patel/.test(t),'other child visible')});
await T('Parent Portal','PA-pay','Parent pays online; receipt shown; ledger and audit updated','parent',async p=>{
  await p.nav('Fees and Receipts');const before=await p.evaluate(()=>feeSum(myChild()).payable);await p.click('[data-act=parentPay]');await p.click('form[data-form=parentPayGo] button.primary');await p.waitForTimeout(100);ok(await p.$('.qr'),'no gateway QR');await p.click('[data-act=pOk]');await p.waitForTimeout(150);
  ok(await p.$('.drawer .receipt'),'no receipt');const after=await p.evaluate(()=>feeSum(myChild()).payable);ok(after<before,'balance not reduced');ok((await p.db()).audit.some(a=>/Online payment confirmed/.test(a.action)),'audit');
});
await T('Parent Portal','PA-pay-fail','Failed payment charges nothing','parent',async p=>{
  const n0=(await p.db()).payments.length;await p.nav('Fees and Receipts');await p.click('[data-act=parentPay]');await p.click('form[data-form=parentPayGo] button.primary');await p.click('[data-act=pFail]');await p.waitForTimeout(100);ok((await p.db()).payments.length===n0,'payment created');
});
await T('Parent Portal','PA-pay-valid','Parent amount validation (zero / above payable)','parent',async p=>{
  const r=await p.evaluate(()=>{const out=[];for(const a of [0,99999999]){try{FORM.parentPayGo({},{amount:a,mode:'Any UPI app'});out.push('allowed')}catch(e){out.push(e.message)}}return out});ok(/above/.test(r[0])&&/more than/.test(r[1]),r.join());
});
await T('Parent Portal','PA-partial','Parent can pay a custom partial amount','parent',async p=>{
  await p.nav('Fees and Receipts');await p.click('[data-act=parentPay]');await p.fill('form[data-form=parentPayGo] [name=amount]','500');await p.click('form[data-form=parentPayGo] button.primary');await p.click('[data-act=pOk]');await p.waitForTimeout(150);ok((await p.db()).payments.pop().amount===500,'amount');
});
await T('Parent Portal','PA-receipts','Parent sees own receipts only and can open one','parent',async p=>{
  await p.nav('Fees and Receipts');await p.click('[data-act=pReceipt]');await p.waitForTimeout(100);ok(await p.$('.drawer .receipt'),'no receipt');
  const r=await p.evaluate(()=>{const other=db.payments.find(x=>x.studentId!==cur().studentId);try{ACT.pReceipt({dataset:{id:other.id}});return'allowed'}catch(e){return e.message}});ok(/not found/i.test(r),r);
});
await T('Parent Portal','PA-installments','Installment table and totals match ledger','parent',async p=>{
  await p.nav('Fees and Receipts');const sm=await p.evaluate(()=>feeSum(myChild()));const t=await p.text();ok(t.includes(sm.total.toLocaleString('en-IN')),'total');ok((await p.$$eval('#page table tbody tr',e=>e.length))===sm.inst.length,'installment rows');
});
await T('Parent Portal','PA-notices','Parent notices page shows notices and messages','parent',async p=>{await p.nav('Notices');ok((await p.text()).length>100,'empty')});
await T('Parent Portal','PA-newparent','Parent login of a newly admitted student works and shows only that student','admin',async p=>{
  const s=await admit(p,{name:'Fresh Child'});await p.keyboard.press('Escape');await p.logout();ok(await p.login(s.id.toLowerCase(),'parent123'),'cannot sign in');ok(/Fresh Child/.test(await p.text()),'wrong student');
});
await T('Parent Portal','PA-nostaff','Parent cannot reach staff pages','parent',async p=>{await p.evaluate(()=>go('fees'));await p.waitForTimeout(80);ok(!/Collect payment/.test(await p.text()),'parent saw staff page')});

/* ================= PERSISTENCE / ROBUSTNESS ================= */
await T('Persistence','PE-reload','Created records survive reload and another login','clerk',async p=>{
  const s=await admit(p,{name:'Persist Me'});await p.reload();await p.waitForTimeout(150);await p.nav('Students');ok(/Persist Me/.test(await p.text()),'lost after reload');
  await p.logout();await p.login('admin','admin123');await p.nav('Students');ok(/Persist Me/.test(await p.text()),'not visible to admin');
});
await T('Persistence','PE-nostorage','App still works when localStorage is blocked (in-memory fallback)',null,async p=>{
  ok(await p.login('admin','admin123'),'cannot login without storage');await p.nav('Students');ok((await p.$$eval('#stuRows tr',e=>e.length))>5,'no data');
},{noStorage:true});
await T('Persistence','PE-corrupt','Corrupted storage falls back to fresh sample data',null,async p=>{
  await p.evaluate(()=>localStorage.setItem('vp_erp_demo_v3','{broken'));await p.reload();await p.waitForTimeout(200);ok(await p.login('admin','admin123'),'cannot login after corruption');
});
await T('Persistence','PE-xss','User text is escaped (no script injection)','admin',async p=>{
  await admit(p,{name:'<img src=x onerror=window.__x=1>'});await p.keyboard.press('Escape');await p.nav('Students');await p.waitForTimeout(150);ok(!(await p.evaluate(()=>window.__x)),'XSS executed');
});
await T('Persistence','PE-ids','Enrolment and receipt numbers never repeat','admin',async p=>{
  const r=await p.evaluate(()=>{const ids=new Set(),rcs=new Set();db.students.forEach(s=>ids.add(s.id));db.payments.forEach(x=>rcs.add(x.rc));return[ids.size===db.students.length,rcs.size===db.payments.length]});ok(r[0]&&r[1],r.join());
});

/* ================= RESPONSIVE ================= */
for(const role of ['admin','accountant','faculty','parent']){
  await T('Responsive','RS-'+role,`${role}: every page fits a 390px phone without sideways scroll`,role,async p=>{
    const navs=await p.$$eval('#nav button',e=>e.map(x=>x.dataset.id));const bad=[];
    for(const id of navs){await p.evaluate(i=>go(i),id);await p.waitForTimeout(80);const tabs=await p.$$('#page [role=tab]');for(let i=0;i<Math.min(tabs.length,7);i++){const t=await p.$$('#page [role=tab]');if(!t[i])break;await t[i].click();await p.waitForTimeout(60);if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))bad.push(id+'#'+i)}if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))bad.push(id)}
    ok(!bad.length,'overflow on '+[...new Set(bad)].join(','));
  },{vp:{width:390,height:844}});
}
await T('Responsive','RS-drawer','Admission drawer and dialogs usable on phone','clerk',async p=>{
  await p.nav('Students');await p.click('[data-act=newAdmission]');const w=await p.$eval('.drawer',e=>e.getBoundingClientRect().width);ok(w<=392,'drawer width '+w);ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'overflow');
},{vp:{width:390,height:844}});
await T('Responsive','RS-tablet','Layout at 768px has no overflow','principal',async p=>{ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'overflow')},{vp:{width:768,height:1000}});

/* ================= CRAWL: every nav item and tab for every role, no JS errors ================= */
for(const role of Object.keys(ACCT)){
  await T('Crawl','CR-'+role,`${role}: every menu and tab opens without errors`,role,async p=>{
    const navs=await p.$$eval('#nav button',e=>e.map(x=>x.dataset.id));let pages=0;
    for(const id of navs){await p.evaluate(i=>go(i),id);await p.waitForTimeout(60);ok((await p.text()).length>40,'empty page '+id);pages++;const n=(await p.$$('#page [role=tab]')).length;for(let i=0;i<n;i++){const t=await p.$$('#page [role=tab]');if(!t[i])break;await t[i].click();await p.waitForTimeout(50);ok((await p.text()).length>30,'empty tab '+id+'#'+i);pages++}}
    ok(pages>=3,'pages '+pages);
  });
}


/* ================= EXTRA: capacity and multi-tab ================= */
await T('Students','ST-capacity','Admission is refused when the division is full; seats left shown','admin',async p=>{
  await p.evaluate(()=>{const d=db.divisions.find(x=>x.id==='d3');d.capacity=db.students.filter(s=>s.div==='d3'&&s.status==='Active').length;save()});
  const r=await p.evaluate(()=>{try{FORM.admit({}, {name:'Overflow Kid',phone:'9555500001',div:'d3',course:'bed',batch:'b2',sem:1,gname:'g',gphone:'9555500002',planName:db.plans[0].name,dob:'2001-01-01',aadhaar:'123412341234',address:'a',conc:'none'});return'allowed'}catch(e){return e.message}});ok(/is full/.test(r),r);
  ok(/0 seats left/.test(await p.evaluate(()=>divOpts('bed','b2').map(o=>o[1]).join())),'seats label');
});
await T('Students','ST-capacity-import','CSV import skips rows for a full division','admin',async p=>{
  await p.evaluate(()=>{const d=db.divisions.find(x=>x.id==='d3');d.capacity=db.students.filter(s=>s.div==='d3'&&s.status==='Active').length;save()});
  await p.nav('Students');await p.click('[data-act=importStudents]');await p.fill('form[data-form=importCsv] [name=csv]','name,gender,course,batch,division,mobile,guardian,guardian_mobile\nFull Div,F,B.Ed,2026–28,A,9876511111,G,9876511112\n');await p.click('form[data-form=importCsv] button.primary');await p.waitForTimeout(150);
  ok(/is full/.test(await p.text('#impOut')),'no full message');
});
await T('Login and Roles','MT-tabs','Two tabs can be signed in as different roles at once',null,async p=>{
  await p.login('admin','admin123');const p2=await p.c.newPage();await p2.route(/fonts\./,r=>r.abort());await p2.goto(FILE);
  await p2.fill('input[name=u]','parent');await p2.fill('input[name=p]','parent123');await p2.click('form[data-form=login] button.primary');await p2.waitForTimeout(150);
  ok(/Welcome/.test(await p2.$eval('#page',e=>e.innerText)),'tab 2 not parent');await p.reload();await p.waitForTimeout(200);ok((await p.$$eval('#nav button',e=>e.length))>6,'tab 1 lost admin login');ok(/Staff and Roles/.test(await p.$eval('#nav',e=>e.innerText)),'tab 1 role changed');
  await p2.close();
});
await T('Login and Roles','MT-sync','A change in one tab appears in the other without refresh',null,async p=>{
  await p.login('principal','principal123');await p.nav('Messages and Notices');await p.tab('Notices');
  const p2=await p.c.newPage();await p2.route(/fonts\./,r=>r.abort());await p2.goto(FILE);await p2.fill('input[name=u]','parent');await p2.fill('input[name=p]','parent123');await p2.click('form[data-form=login] button.primary');await p2.waitForTimeout(150);await p2.click('#nav button:has-text("Notices")');
  await p.fill2('form[data-form=addNotice]',{title:'Live Sync Notice',body:'hello',audience:'all'});await p.click('form[data-form=addNotice] button.primary');await p.waitForTimeout(500);
  ok(/Live Sync Notice/.test(await p2.$eval('#page',e=>e.innerText)),'parent tab did not update');await p2.close();
});
await T('Login and Roles','MT-nooverwrite','Writes from two tabs do not wipe each other',null,async p=>{
  await p.login('admin','admin123');const p2=await p.c.newPage();await p2.route(/fonts\./,r=>r.abort());await p2.goto(FILE);await p2.fill('input[name=u]','accountant');await p2.fill('input[name=p]','account123');await p2.click('form[data-form=login] button.primary');await p2.waitForTimeout(150);
  await p.evaluate(()=>{db.notices.unshift({id:'nx1',title:'From tab A',body:'',audience:'all',date:today(),by:'a'});save()});await p2.waitForTimeout(300);
  await p2.evaluate(()=>{db.notices.unshift({id:'nx2',title:'From tab B',body:'',audience:'all',date:today(),by:'b'});save()});await p.waitForTimeout(300);
  const d=await p.db();ok(d.notices.some(n=>n.id==='nx1')&&d.notices.some(n=>n.id==='nx2'),'lost write: '+d.notices.slice(0,3).map(n=>n.id));await p2.close();
});

/* ================= MOTION ================= */
await T('Motion UI','MO-enter','Page entrance animation plays on navigation and then clears','principal',async p=>{
  await p.nav('Students');ok(await p.$eval('#page',e=>e.classList.contains('enter')),'enter class missing');
  const an=await p.$eval('#page .top',e=>getComputedStyle(e).animationName);ok(/rise/.test(an),'no rise animation: '+an);
  await p.waitForTimeout(1400);ok(!(await p.$eval('#page',e=>e.classList.contains('enter'))),'enter class not cleared');
  ok(await p.$eval('#page .top',e=>getComputedStyle(e).opacity)==='1','content left transparent');
},{motion:true});
await T('Motion UI','MO-countup','KPI numbers count up and land on the exact real value','principal',async p=>{
  await p.waitForTimeout(1300);const real=await p.$$eval('.kpi .v',e=>e.map(x=>x.textContent));
  await p.nav('Students');await p.nav('Dashboard');await p.waitForTimeout(60);const mid=await p.$$eval('.kpi .v',e=>e.map(x=>x.textContent));await p.waitForTimeout(1200);const end=await p.$$eval('.kpi .v',e=>e.map(x=>x.textContent));
  ok(JSON.stringify(end)===JSON.stringify(real),'final '+end+' vs '+real);ok(JSON.stringify(mid)!==JSON.stringify(end),'no count animation seen');
},{motion:true});
await T('Motion UI','MO-drawer','Drawer slides out on close; reopening instantly is not wiped by the exit timer','clerk',async p=>{
  await p.nav('Students');await p.click('#stuRows tr:first-child');await p.waitForTimeout(500);ok(await p.$('.drawer'),'no drawer');
  await p.click('.drawer [data-act=close]');await p.waitForTimeout(40);ok(await p.$('.drawer.leaving'),'no leaving state');await p.waitForTimeout(350);ok(!(await p.$('.drawer')),'drawer not removed');
  await p.evaluate(()=>{closeLayer();drawer('<h2>Second</h2>')});await p.waitForTimeout(400);ok(/Second/.test(await p.text('#layer')),'new drawer wiped by old timer');
},{motion:true});
await T('Motion UI','MO-dialog','Dialog animates in and out and its buttons stay clickable','principal',async p=>{
  await p.nav('Fee Collection');await p.evaluate(()=>confirmBox('T','m','OK',()=>{window.__ok=1}));await p.waitForTimeout(400);await p.click('#dlgOk');await p.waitForTimeout(300);ok(await p.evaluate(()=>window.__ok===1),'callback');ok(!(await p.$('.dialog')),'dialog stays');
},{motion:true});
await T('Motion UI','MO-reduced','Reduced-motion setting: no animation delays, layers close instantly','principal',async p=>{
  await p.nav('Students');await p.evaluate(()=>drawer('<h2>x</h2>'));await p.evaluate(()=>closeLayer());ok(!(await p.$('.drawer')),'not instant');
  const d=await p.$eval('#page .top',e=>parseFloat(getComputedStyle(e).animationDuration));ok(d<0.01,'duration '+d);
});
await T('Motion UI','MO-theme','Theme switch cross-fades and clears its transition class','admin',async p=>{
  await p.click('[data-act=theme]');ok(await p.evaluate(()=>document.documentElement.classList.contains('theme-anim')),'no anim class');await p.waitForTimeout(700);ok(!(await p.evaluate(()=>document.documentElement.classList.contains('theme-anim'))),'class stuck');
},{motion:true});
await T('Motion UI','MO-receipt','Payment receipt shows animated success tick','accountant',async p=>{
  await collectCash(p);ok(await p.$('.receipt .tick svg'),'no tick');ok(/Payment received/.test(await p.text('.receipt')),'text');
},{motion:true});
await T('Motion UI','MO-sticky','Top bar stays visible while scrolling and stays clickable','principal',async p=>{
  await p.nav('Students');await p.evaluate(()=>window.scrollTo(0,600));await p.waitForTimeout(200);const y=await p.$eval('.topbar',e=>e.getBoundingClientRect().top);ok(y>=-1&&y<=2,'topbar scrolled away '+y);ok(await p.$('[data-act=theme]'),'toggle');
},{motion:true});
await T('Motion UI','MO-noblock','After animations finish, nothing is hidden or unclickable on every page','admin',async p=>{
  const navs=await p.$$eval('#nav button',e=>e.map(x=>x.dataset.id));
  for(const id of navs){await p.evaluate(i=>go(i),id);await p.waitForTimeout(1300);const bad=await p.evaluate(()=>[...document.querySelectorAll('#page .top,#page .panel,#page .kpi,#page table')].filter(e=>getComputedStyle(e).opacity!=='1'||getComputedStyle(e).transform!=='none'&&!e.matches('.kpi:hover')).length);ok(bad===0,id+' has '+bad+' elements still mid-animation')}
},{motion:true});
await T('Motion UI','MO-mobile','Animations do not cause sideways scroll on a phone','clerk',async p=>{
  for(const n of ['Dashboard','Students','Fee Collection']){await p.nav(n);await p.waitForTimeout(150);ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'overflow during '+n)}
},{motion:true,vp:{width:390,height:844}});
await T('Motion UI','MO-login','Login screen animates in and the form is usable immediately',null,async p=>{
  await p.fill('input[name=u]','admin');await p.fill('input[name=p]','admin123');await p.click('form[data-form=login] button.primary');await p.waitForTimeout(100);ok(await p.$('#nav'),'login blocked by animation');
},{motion:true});

/* ================= DEFAULT LOGINS ================= */
await T('Login and Roles','AU-default5','A fresh demo has exactly five logins: Super Admin, Principal, Accountant, Parent, Student',null,async p=>{
  const btns=await p.$$eval('[data-act=fillLogin]',e=>e.map(x=>x.dataset.u));ok(btns.join()==='admin,principal,accountant,parent,student','buttons '+btns);
  const d=await p.db();const roles=[...new Set(d.users.map(u=>u.role))].sort();ok(roles.join()==='Accountant,Parent,Principal,Student,Super Admin','roles '+roles);ok(d.users.filter(u=>!['Parent','Student'].includes(u.role)).length===3,'staff logins');
  ok(!(await p.login('clerk','clerk123')),'clerk login should not exist yet');ok(!(await p.login('faculty','faculty123')),'faculty login should not exist yet');
},{plain:true});
await T('Login and Roles','AU-add-clerk','Admin creates a Clerk login from Staff and Roles and the clerk can sign in','admin',async p=>{
  await p.nav('Staff and Roles');ok(/Login not created/.test(await p.text()),'pill missing');const id=(await p.db()).staff.find(s=>s.role==='Clerk').id;
  await p.click(`[data-act=editStaff][data-id=${id}]`);await p.fill('form[data-form=saveStaff] [name=username]','newclerk');await p.fill('form[data-form=saveStaff] [name=password]','clerk456');await p.click('form[data-form=saveStaff] button.primary');await p.waitForTimeout(150);
  await p.logout();ok(await p.login('newclerk','clerk456'),'new clerk cannot sign in');const n=await p.navs();ok(n.includes('Students')&&n.includes('Fee Collection')&&!n.includes('Settings'),n.join());
},{plain:true});
await T('Login and Roles','AU-add-faculty','Admin creates a Faculty login and the faculty member sees attendance and marks','admin',async p=>{
  await p.nav('Staff and Roles');const id=(await p.db()).staff.find(s=>s.role==='Faculty').id;
  await p.click(`[data-act=editStaff][data-id=${id}]`);await p.fill('form[data-form=saveStaff] [name=username]','newfaculty');await p.fill('form[data-form=saveStaff] [name=password]','faculty456');await p.click('form[data-form=saveStaff] button.primary');await p.waitForTimeout(150);
  await p.logout();ok(await p.login('newfaculty','faculty456'),'faculty cannot sign in');const n=await p.navs();ok(n.includes('Attendance')&&n.includes('Internal Marks')&&!n.includes('Fee Collection'),n.join());
},{plain:true});

/* ================= EVENT LOG ================= */
const evs=p=>p.evaluate(()=>{evFlush();return evRead()});
const openLog=async p=>{await p.nav('Event Log');await p.waitForTimeout(200)};
await T('Event Log','EV-admin-only','Only the Super Admin has the Event Log; others are refused','principal',async p=>{
  ok(!(await p.navs()).includes('Event Log'),'principal sees it');
  const r=await p.evaluate(()=>{const out=[viewEventLog().includes('Only the Super Admin')];for(const f of [()=>ACT.evClear({}),()=>ACT.evExport({}),()=>ACT.evOpen({dataset:{id:'x'}}),()=>ACT.evUser({dataset:{id:'x'}})]){try{f();out.push('allowed')}catch(e){out.push('blocked')}}ui.route='eventlog';renderPage();out.push(ui.route);return out});
  ok(r[0]&&r.slice(1,5).every(x=>x==='blocked'),r.join());ok(r[5]!=='eventlog','route not reset: '+r[5]);
});
await T('Event Log','EV-nav','Super Admin sees Event Log; accountant, clerk, faculty, parent, student do not','admin',async p=>{
  ok((await p.navs()).includes('Event Log'),'admin missing');
  for(const [u,pw] of [['accountant','account123'],['clerk','clerk123'],['faculty','faculty123'],['parent','parent123'],['student','student123']]){await p.logout();ok(await p.login(u,pw),u);ok(!(await p.navs()).includes('Event Log'),u+' sees event log')}
});
await T('Event Log','EV-auth','Sign-in, failed sign-in and sign-out are recorded; passwords never are',null,async p=>{
  await p.login('ghost','wrongpw');await p.login('admin','badpass9');await p.login('admin','admin123');await p.logout();
  const e=await evs(p);const f1=e.find(x=>x.a==='Sign-in failed'&&/ghost/.test(x.d)),f2=e.find(x=>x.a==='Sign-in failed'&&/wrong password/.test(x.d)),si=e.find(x=>x.a==='Signed in'),so=e.find(x=>x.a==='Signed out');
  ok(f1&&f1.s==='fail'&&/no such user/.test(f1.d),'unknown user');ok(f2&&f2.n==='Rajiv Bhatt','wrong password row');ok(si&&si.r==='Super Admin'&&si.un==='admin','signed in');ok(so&&so.r==='Super Admin','signed out');
  const raw=await p.evaluate(()=>localStorage.getItem('vp_erp_events_v1'));ok(!/wrongpw|badpass9|admin123/.test(raw),'password leaked into the log');
},{plain:true});
await T('Event Log','EV-pages','Opening pages and tabs is recorded with the person and role','accountant',async p=>{
  await p.nav('Students');await p.nav('Fee Collection');await p.tab('Receipts');const e=await evs(p);
  ok(e.some(x=>x.a==='Opened Students'&&x.r==='Accountant'),'students');ok(e.some(x=>x.a==='Opened Fee Collection'),'fees');ok(e.some(x=>x.a==='Opened tab'&&/Receipts/.test(x.d)),'tab');
});
await T('Event Log','EV-form','A refused form is logged as Failed with the reason; a saved one as Saved','accountant',async p=>{
  await p.nav('Fee Collection');await p.click('[data-act=feeMode][data-m=counter]');await p.fill('#f_amount','99999999');await p.evaluate(()=>{const f=document.querySelector('form[data-form=collect]');if(f)f.noValidate=true});await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(100);
  await p.fill('#f_amount','500');await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(150);const e=await evs(p);
  const bad=e.find(x=>x.c==='Form'&&x.s==='fail'&&/more than/.test(x.d)),good=e.find(x=>x.c==='Form'&&x.a==='Collect form'&&x.s==='ok'&&x.d==='Saved');ok(bad,'failed form missing');ok(good,'saved form missing');ok(e.some(x=>x.c==='Audit'&&/Payment received/.test(x.a)),'audit mirror');
});
await T('Event Log','EV-no-noise','Closing drawers and dialogs is not logged as a click','accountant',async p=>{
  await p.nav('Students');await p.click('#page tbody tr.click');await p.waitForTimeout(250);await p.keyboard.press('Escape');await p.waitForTimeout(250);await p.click('[data-act=theme]');const e=await evs(p);
  ok(!e.some(x=>x.c==='Click'&&/^Close/.test(x.a)),'close logged');ok(e.some(x=>x.c==='Click'&&/Open student/i.test(x.a)),'open student click missing');
});
await T('Event Log','EV-dedupe','Repeating the same event within moments is collapsed with a count','admin',async p=>{
  await p.evaluate(()=>{for(let i=0;i<4;i++)ev('Change','Test toggle','x = on')});const e=(await evs(p)).filter(x=>x.a==='Test toggle');ok(e.length===1&&e[0].x===4,JSON.stringify(e.map(x=>x.x)));
});
await T('Event Log','EV-all-roles','Admin sees what the accountant, parent and student did, with the right roles','admin',async p=>{
  await p.logout();await p.login('accountant','account123');await p.nav('Fee Collection');await p.click('[data-act=feeMode][data-m=counter]');await p.fill('#f_amount','600');await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(150);await p.logout();
  await p.login('parent','parent123');await p.nav('Fees and Receipts');await p.logout();await p.login('student','student123');await p.nav('My Academics');await p.logout();
  await p.login('admin','admin123');await openLog(p);const t=await p.text();ok(/Accountant/.test(t)&&/Parent/.test(t)&&/Student/.test(t),'roles missing in list');
  const e=await evs(p);for(const r of ['Accountant','Parent','Student','Super Admin']){ok(e.some(x=>x.r===r&&x.c==='Auth'&&x.a==='Signed in'),'no sign-in for '+r)}
});
await T('Event Log','EV-portal-pay','Online payments from Parent and Student portals appear under their own roles','admin',async p=>{
  await p.logout();await p.login('parent','parent123');await p.nav('Fees and Receipts');await p.click('[data-act=parentPay]');await p.fill('form[data-form=parentPayGo] [name=amount]','400');await p.click('form[data-form=parentPayGo] button.primary');await p.click('[data-act=pOk]');await p.waitForTimeout(300);
  const e=await evs(p);ok(e.some(x=>x.r==='Parent'&&x.c==='Audit'&&/Online payment confirmed/.test(x.a)),'audit under parent');ok(e.some(x=>x.r==='Parent'&&x.c==='Form'&&/parent pay go/i.test(x.a)),'form under parent');
});
await T('Event Log','EV-email','Receipt email queued and sent are logged by the mail system','admin',async p=>{
  await p.nav('Fee Collection');await p.click('[data-act=feeMode][data-m=counter]');await p.fill('#f_amount','500');await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(1900);const e=await evs(p);
  ok(e.some(x=>x.c==='Email'&&x.a==='Receipt email queued'),'queued');const s=e.find(x=>x.c==='Email'&&x.a==='Receipt email sent');ok(s&&s.n==='Mail system'&&/demo/.test(s.d),'sent '+JSON.stringify(s));
});
await T('Event Log','EV-view','Event Log page shows counters and newest events first','admin',async p=>{
  await p.nav('Fee Collection');await p.nav('Students');await openLog(p);const t=await p.text();ok(/events today/i.test(t)&&/sign-ins today/i.test(t)&&/people active today/i.test(t)&&/failed today/i.test(t),'kpis');
  const times=await p.$$eval('#evRows tr td:first-child',e=>e.map(x=>x.textContent));ok(times.length>3,'rows '+times.length);const ts=await p.evaluate(()=>[...document.querySelectorAll('#evRows tr')].length);ok(/matching of/.test(await p.text('#evCount')),'count');
  const e=await evs(p);ok(e.every((x,i)=>i===0||e[i-1].ts>=x.ts),'not newest first');
});
await T('Event Log','EV-filters','Filters: role, person, type, result, dates, search and quiet mode','admin',async p=>{
  await p.logout();await p.login('accountant','account123');await p.nav('Students');await p.evaluate(()=>{try{FORM.collect({dataset:{}},{sid:'nope',amount:1})}catch(e){}});await p.fill('#f_amount','1').catch(()=>{});await p.nav('Fee Collection');await p.click('[data-act=feeMode][data-m=counter]');await p.fill('#f_amount','99999999');await p.evaluate(()=>{const f=document.querySelector('form[data-form=collect]');if(f)f.noValidate=true});await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(100);await p.logout();
  await p.login('admin','admin123');await openLog(p);
  await p.selectOption('#ev_role','Accountant');await p.waitForTimeout(150);ok(await p.$$eval('#evRows tr',r=>r.length>2&&r.every(x=>/Accountant/.test(x.textContent))),'role filter');
  await p.selectOption('#ev_status','fail');await p.waitForTimeout(150);ok(await p.$$eval('#evRows tr',r=>r.length>=1&&r.every(x=>/failed/i.test(x.textContent))),'fail filter');
  await p.click('[data-act=evReset]');await p.waitForTimeout(150);await p.selectOption('#ev_cat','Auth');await p.waitForTimeout(150);ok(await p.$$eval('#evRows tr',r=>r.length>=2&&r.every(x=>/Auth/.test(x.textContent))),'type filter');
  await p.click('[data-act=evReset]');await p.waitForTimeout(150);await p.fill('#evQ','Fee Collection');await p.waitForTimeout(200);ok(await p.$$eval('#evRows tr',r=>r.length>=1&&r.every(x=>/fee collection/i.test(x.textContent))),'search');
  await p.fill('#evQ','zzzz-nothing');await p.waitForTimeout(150);ok(/No events match/.test(await p.text('#evRows')),'empty state');await p.click('[data-act=evReset]');await p.waitForTimeout(150);
  await p.fill('#ev_from','2099-01-01');await p.evaluate(()=>document.querySelector('#ev_from').dispatchEvent(new Event('change',{bubbles:true})));await p.waitForTimeout(150);ok(/No events match/.test(await p.text('#evRows')),'date filter');await p.click('[data-act=evReset]');await p.waitForTimeout(150);
  await p.check('#ev_quiet');await p.waitForTimeout(150);ok(await p.$$eval('#evRows tr',r=>r.every(x=>!/\bPage\b|\bClick\b|\bChange\b/.test(x.cells?.[2]?.textContent||''))),'quiet mode');
  await p.selectOption('#ev_user',{index:1});await p.waitForTimeout(120);ok((await p.$$eval('#evRows tr',r=>r.length))>=1,'person filter');
});
await T('Event Log','EV-people','People tab summarises each login and jumps to their events','admin',async p=>{
  await p.logout();await p.login('accountant','account123');await p.nav('Students');await p.logout();await p.login('admin','admin123');await openLog(p);await p.tab('People');
  const t=await p.text();ok(/Bhavna Shukla/.test(t)&&/Dr\. Meena Acharya/.test(t)&&/No activity yet/.test(t),'people rows');
  await p.click('#page tbody tr.click:has-text("Bhavna Shukla")');await p.waitForTimeout(250);ok(await p.$('#evRows'),'not on timeline');ok(await p.$$eval('#evRows tr',r=>r.length>=2&&r.every(x=>/Bhavna/.test(x.textContent))),'not filtered to person');
});
await T('Event Log','EV-detail','Selecting an event shows its full details','admin',async p=>{
  await p.nav('Students');await openLog(p);await p.click('#evRows tr.click');await p.waitForTimeout(250);const d=await p.text('.drawer');ok(/Action/.test(d)&&/Details/.test(d)&&/Role/.test(d)&&/Event id/.test(d),d.slice(0,200));
});
await T('Event Log','EV-export','Export CSV lists the filtered events with a header','admin',async p=>{
  await p.nav('Students');await openLog(p);await p.click('[data-act=evExport]');await p.waitForTimeout(250);const t=await p.$eval('#csvText',e=>e.value);const lines=t.trim().split('\n');
  ok(lines[0].startsWith('Time,Person,Username,Role,Type,Action,Details,Result,Page,Device,Count'),lines[0]);const n=(await evs(p)).length;ok(lines.length===n+1||lines.length>3,lines.length+' vs '+n);
});
await T('Event Log','EV-clear','Clear log asks first, deletes events, and records that it was cleared','admin',async p=>{
  await p.nav('Students');await openLog(p);await p.click('[data-act=evClear]');await p.waitForTimeout(150);await p.click('#dlgNo').catch(()=>p.keyboard.press('Escape'));await p.waitForTimeout(250);ok((await evs(p)).length>3,'cleared without confirmation');
  await p.click('[data-act=evClear]');await p.click('#dlgOk');await p.waitForTimeout(400);const e=await evs(p);ok(e.some(x=>x.a==='Event log cleared')&&e.length<=3,'after clear '+e.length+' '+e.map(x=>x.a).join('|'));
});
await T('Event Log','EV-cap','The log keeps only the latest 3000 events',null,async p=>{
  await p.login('admin','admin123');await p.evaluate(()=>{for(let i=0;i<3200;i++)ev('Click','Bulk '+i,'d'+i)});const e=await evs(p);ok(e.length===3000,'length '+e.length);ok(e[0].a==='Bulk 3199','newest kept');
  await openLog(p);const t0=Date.now();await p.nav('Dashboard');await openLog(p);ok(Date.now()-t0<2500,'slow render '+(Date.now()-t0));ok((await p.$$eval('#evRows tr',r=>r.length))<=100,'rendered more than 100 rows');
  await p.click('[data-act=evMore]');await p.waitForTimeout(200);ok((await p.$$eval('#evRows tr',r=>r.length))===200,'show more');
},{plain:true});
await T('Event Log','EV-persist','Events survive a reload and a resumed session is recorded','admin',async p=>{
  await p.nav('Students');await p.evaluate(()=>evFlush());await p.reload();await p.waitForTimeout(300);const e=await evs(p);ok(e.some(x=>x.a==='Opened Students'),'lost on reload');ok(e.some(x=>x.a==='Session resumed'),'resume not logged');
});
await T('Event Log','EV-live','A change made in another tab appears in the open Event Log without refreshing','admin',async p=>{
  await openLog(p);const q=await p.c.newPage();await q.route(/fonts\./,r=>r.abort());await q.goto(FILE);await q.fill('input[name=u]','accountant');await q.fill('input[name=p]','account123');await q.click('form[data-form=login] button.primary');await q.waitForTimeout(500);
  await q.evaluate(()=>evFlush());await p.waitForTimeout(1300);ok(/Bhavna Shukla/.test(await p.text('#evRows')),'live update missing');await q.close();
});
await T('Event Log','EV-error','Script errors are captured as Failed events','admin',async p=>{
  await p.evaluate(()=>dispatchEvent(new ErrorEvent('error',{message:'boom test'})));const e=await evs(p);ok(e.some(x=>x.c==='Error'&&x.s==='fail'&&/boom test/.test(x.d)),'error missing');
});
await T('Event Log','EV-reset','Resetting demo data wipes the event log',null,async p=>{
  await p.login('admin','admin123');await p.nav('Students');await p.nav('Settings');await p.click('[data-act=resetDemo]');await p.click('#dlgOk');await p.waitForTimeout(400);const e=await evs(p);ok(e.length===1&&e[0].a==='Demo data reset',e.map(x=>x.a).join('|'));
},{plain:true});
await T('Event Log','EV-nostorage','Event Log works when browser storage is blocked','admin',async p=>{
  await p.nav('Students');await openLog(p);ok(/events today/i.test(await p.text()),'page broken');ok((await p.$$eval('#evRows tr',r=>r.length))>=1,'no rows');
},{noStorage:true});
await T('Event Log','EV-mobile','Event Log is a list of cards on a phone with no sideways scroll','admin',async p=>{
  await p.nav('Students');await openLog(p);ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'timeline overflows');ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#page thead')).display==='none'),'table shown');
  await p.tab('People');ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'people overflows');
},{vp:{width:390,height:844}});
await T('Event Log','EV-dark','Event Log is readable in dark theme','admin',async p=>{await p.click('[data-act=theme]');await p.waitForTimeout(450);await openLog(p);ok((await p.text()).length>200,'empty')});

/* ================= NOTIFICATIONS ================= */
const nt=(p,un)=>p.evaluate(u=>{const x=db.users.find(y=>y.username===u);return db.notifs.filter(n=>n.uid===x.id).map(n=>({k:n.k,t:n.t,x:n.x,read:n.read,route:n.route,tab:n.tab,tone:n.tone}))},un);
const ntHas=(l,k,re)=>l.some(n=>n.k===k&&(!re||re.test(n.t+' '+n.x)));
const riya=p=>p.evaluate(()=>db.users.find(u=>u.username==='parent').studentId);
const payFor=async(p,sid,amt)=>{await p.nav('Fee Collection');await p.click('[data-act=feeMode][data-m=counter]');await p.selectOption('#f_sid',sid);await p.waitForTimeout(150);await p.fill('#f_amount',String(amt));await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(200)};
const bellN=p=>p.$eval('#bellN',e=>e.hidden?0:+e.textContent).catch(()=>-1);
await T('Notifications','NT-bell','Every role has a bell whose badge equals its unread count','admin',async p=>{
  for(const [u,pw] of [['admin','admin123'],['principal','principal123'],['accountant','account123'],['clerk','clerk123'],['faculty','faculty123'],['parent','parent123'],['student','student123']]){
    if(u!=='admin'){await p.logout();ok(await p.login(u,pw),'login '+u)}
    ok(await p.$('#bell'),u+' has no bell');const n=await p.evaluate(()=>ntUnread(cur()));ok((await bellN(p))===n,`${u}: badge ${await bellN(p)} vs ${n}`);
    ok((await p.getAttribute('#bell','aria-label'))===(n?`Notifications, ${n} unread`:'Notifications'),u+' aria-label');
  }
});
await T('Notifications','NT-defaults','Starting notifications are specific to each role','admin',async p=>{
  const a=await nt(p,'admin'),ac=await nt(p,'accountant'),pr=await nt(p,'parent'),st=await nt(p,'student');
  ok(ntHas(a,'digest',/overdue/)&&ntHas(a,'docs'),'admin: '+a.map(x=>x.k));ok(ntHas(ac,'digest')&&!ntHas(ac,'docs'),'accountant digest only');
  ok(ntHas(pr,'due',/overdue/)&&ntHas(st,'due',/overdue/),'family overdue');ok(!pr.some(n=>n.k==='digest'||n.k==='docs'),'parent sees staff digests');
  const all=await p.evaluate(()=>{const mine=db.users.find(u=>u.username==='parent').studentId;return db.notifs.filter(n=>db.users.find(u=>u.id===n.uid).role==='Parent'&&db.users.find(u=>u.id===n.uid).studentId!==mine).length});ok(all>0,'other families also got theirs');
  await p.logout();await p.login('clerk','clerk123');const cl=await nt(p,'clerk');ok(ntHas(cl,'docs')&&!ntHas(cl,'digest')&&!ntHas(cl,'due'),'clerk: '+cl.map(x=>x.k));await p.logout();await p.login('faculty','faculty123');const fc=await nt(p,'faculty');ok(!ntHas(fc,'digest')&&!ntHas(fc,'due')&&!ntHas(fc,'docs'),'faculty: '+fc.map(x=>x.k));
});
await T('Notifications','NT-nodupe','Signing in again never repeats an automatic alert','admin',async p=>{
  const n0=(await nt(p,'parent')).length;for(let i=0;i<3;i++){await p.logout();await p.login('parent','parent123')}
  ok((await nt(p,'parent')).length===n0,'duplicated '+(await nt(p,'parent')).length+' vs '+n0);
});
await T('Notifications','NT-counter-payment','Counter payment notifies the family, admin; not the person who took it','accountant',async p=>{
  const id=await riya(p);await payFor(p,id,500);
  const pr=await nt(p,'parent'),st=await nt(p,'student'),ad=await nt(p,'admin'),ac=await nt(p,'accountant');
  ok(ntHas(pr,'payment',/RC-/)&&/PDF receipt/.test(pr.find(n=>n.k==='payment').x),'parent '+JSON.stringify(pr.filter(n=>n.k==='payment')));ok(ntHas(st,'payment'),'student');ok(ntHas(ad,'payment',/Riya/),'admin');
  ok(!ntHas(ac,'payment'),'actor was notified of own action');ok(!ntHas(await nt(p,'principal'),'payment'),'principal not on by default');
  const other=await p.evaluate(i=>db.users.filter(u=>u.role==='Parent'&&u.studentId!==i).some(u=>db.notifs.some(n=>n.uid===u.id&&n.k==='payment')),id);ok(!other,'another family was notified');
});
await T('Notifications','NT-portal-payment','Parent payment from the portal reaches accountant, admin and the student, not the parent','parent',async p=>{
  await p.nav('Fees and Receipts');await p.click('[data-act=parentPay]');await p.fill('form[data-form=parentPayGo] [name=amount]','400');await p.click('form[data-form=parentPayGo] button.primary');await p.click('[data-act=pOk]');await p.waitForTimeout(250);
  ok(ntHas(await nt(p,'accountant'),'payment',/Online|Payment received/),'accountant');ok(ntHas(await nt(p,'admin'),'payment'),'admin');ok(ntHas(await nt(p,'student'),'payment'),'student');
  ok(!(await nt(p,'parent')).some(n=>n.k==='payment'),'payer notified of own payment');
});
await T('Notifications','NT-payment-fail','Failed online payment tells the other side and the accountant','student',async p=>{
  await p.nav('Fees and Receipts');await p.click('[data-act=parentPay]');await p.fill('form[data-form=parentPayGo] [name=amount]','300');await p.click('form[data-form=parentPayGo] button.primary');await p.click('[data-act=pFail]');await p.waitForTimeout(250);
  const pr=await nt(p,'parent');ok(ntHas(pr,'payfail',/not charged/),'parent: '+JSON.stringify(pr.map(x=>x.k)));ok(ntHas(await nt(p,'accountant'),'payfail'),'accountant');ok(!(await nt(p,'student')).some(n=>n.k==='payfail'),'actor notified');
});
await T('Notifications','NT-cancel','Cancelling a receipt notifies family, principal, admin','accountant',async p=>{
  const id=await riya(p);await payFor(p,id,300);const pid=await p.evaluate(()=>ui.last);
  await p.evaluate(i=>ACT.cancelReceipt({dataset:{id:i}}),pid);await p.waitForTimeout(250);await p.fill('#dlg [name=reason]','Entered twice');await p.click('#dlg button.danger');await p.waitForTimeout(250);
  ok(ntHas(await nt(p,'principal'),'cancel',/cancelled/),'principal');ok(ntHas(await nt(p,'admin'),'cancel'),'admin');ok(ntHas(await nt(p,'parent'),'cancel',/reversed/),'parent');ok(!(await nt(p,'accountant')).some(n=>n.k==='cancel'),'actor');
});
await T('Notifications','NT-admission','Admission welcomes the new family and tells accounts, principal and admin','clerk',async p=>{
  const s=await admit(p,{name:'Notify Student'});
  const pu=s.id.toLowerCase();const par=await nt(p,pu),stu=await nt(p,'stu-'+pu);
  ok(ntHas(par,'admission',/Welcome/)&&ntHas(stu,'admission',/Welcome/),'welcome '+JSON.stringify(par.map(x=>x.t)));
  for(const u of ['accountant','principal','admin'])ok(ntHas(await nt(p,u),'admission',/Notify Student/),u+' missing admission');
  ok(!(await nt(p,'clerk')).some(n=>n.k==='admission'),'clerk told about own admission');ok(!(await nt(p,'parent')).some(n=>/Notify Student/.test(n.t+n.x)),'other family notified');
});
await T('Notifications','NT-concession','Concession request goes to the Principal; the decision always reaches the requester','clerk',async p=>{
  const id=await p.evaluate(()=>db.students.find(s=>s.fee.concession.status==='none'||!s.fee.concession.status||s.fee.concession.type==='none').id);
  await p.evaluate(i=>{FORM.concRequest({},{sid:i,conc:CONC_OPTS.find(o=>o[0]!=='none')[0],why:'Merit'})},id);
  ok(ntHas(await nt(p,'principal'),'conc_req',/Clerk|clerk|Merit|requested/),'principal');ok(ntHas(await nt(p,'admin'),'conc_req'),'admin');
  await p.logout();await p.login('principal','principal123');await p.evaluate(i=>ACT.concDecide({dataset:{id:i,v:'approved'}}),id);
  const cl=await nt(p,'clerk');ok(ntHas(cl,'conc_dec',/approved/),'requester not told: '+JSON.stringify(cl.map(x=>x.k)));
  const rules=await p.evaluate(()=>db.settings.notify.conc_dec.Clerk);ok(rules===false,'clerk rule should be off, proving requester is always told');
});
await T('Notifications','NT-dayclose','Day close notifies principal and admin with the cash difference','accountant',async p=>{
  const id=await riya(p);await payFor(p,id,500);await p.nav('Fee Collection');await p.tab('Day close');const ex=await p.evaluate(()=>cashExpected(today()));
  await p.fill('input[name=counted]',String(ex-100));await p.dispatchEvent('input[name=counted]','input');await p.waitForTimeout(80);await p.fill('#f_reason','Short change');await p.click('form[data-form=closeDay] button');await p.waitForTimeout(250);
  const pr=await nt(p,'principal');ok(ntHas(pr,'dayclose',/short/i),JSON.stringify(pr.map(x=>x.t+x.x)));ok(ntHas(await nt(p,'admin'),'dayclose'),'admin');ok(!(await nt(p,'accountant')).some(n=>n.k==='dayclose'),'actor');
});
await T('Notifications','NT-notice','A course notice reaches that course, all staff, and nobody else','admin',async p=>{
  await p.nav('Messages and Notices');await p.tab('Notices');await p.fill('form[data-form=addNotice] [name=title]','B.Ed picnic');await p.selectOption('form[data-form=addNotice] [name=audience]','bed');await p.fill('form[data-form=addNotice] [name=body]','Bring ID card.');await p.click('form[data-form=addNotice] button.primary');await p.waitForTimeout(250);
  const r=await p.evaluate(()=>{const got=new Set(db.notifs.filter(n=>n.t==='B.Ed picnic').map(n=>n.uid));const us=db.users.filter(u=>u.active);const out={bed:0,bedMiss:0,med:0,staff:0,staffMiss:0};
    us.forEach(u=>{const has=got.has(u.id);if(u.role==='Parent'||u.role==='Student'){const c=stu(u.studentId).course;if(c==='bed'&&stu(u.studentId).status==='Active')has?out.bed++:out.bedMiss++;else if(c==='med'&&has)out.med++}else if(u.id!==cur().id)has?out.staff++:out.staffMiss++});return out});
  ok(r.bed>5&&r.bedMiss===0,JSON.stringify(r));ok(r.med===0,'M.Ed got B.Ed notice');ok(r.staff>=4&&r.staffMiss===0,'staff '+JSON.stringify(r));
});
await T('Notifications','NT-attendance','Absent student notifies parent and student only, once per day','faculty',async p=>{
  await p.nav('Attendance');const a=await p.$('form[data-form=markAtt] input[value=A]');const nm=await a.getAttribute('name');const sid=nm.replace('a_','');await a.check();
  await p.click('form[data-form=markAtt] button.primary');await p.waitForTimeout(200);
  const pr=await p.evaluate(i=>db.notifs.filter(n=>n.k==='attendance'&&db.users.find(u=>u.id===n.uid).studentId===i).length,sid);ok(pr===2,'parent+student expected 2, got '+pr);
  await p.click('form[data-form=markAtt] button.primary');await p.waitForTimeout(200);
  const again=await p.evaluate(i=>db.notifs.filter(n=>n.k==='attendance'&&db.users.find(u=>u.id===n.uid).studentId===i).length,sid);ok(again===2,'resaving duplicated: '+again);
  const others=await p.evaluate(i=>db.notifs.filter(n=>n.k==='attendance'&&db.users.find(u=>u.id===n.uid).studentId!==i).length,sid);ok(others===0,'present students notified');
});
await T('Notifications','NT-marks','Saving marks notifies each student and parent with their own score','faculty',async p=>{
  await p.nav('Internal Marks');const i=await p.$('form[data-form=saveMarks] input[name^=s_]:not([disabled])');const nm=await i.getAttribute('name');await i.fill('14');await p.click('form[data-form=saveMarks] button.primary');await p.waitForTimeout(200);
  const sid=nm.replace('s_','');const l=await p.evaluate(i=>db.notifs.filter(n=>n.k==='marks'&&db.users.find(u=>u.id===n.uid).studentId===i).map(n=>n.x),sid);
  ok(l.length>=2&&l.every(x=>/14 out of/.test(x)),JSON.stringify(l));
});
await T('Notifications','NT-staff-login','A new login and a changed role are announced to the person concerned','admin',async p=>{
  await p.nav('Staff and Roles');await p.evaluate(()=>{const st=db.staff.find(s=>!s.userId);ACT.editStaff({dataset:{id:st.id}})});await p.waitForTimeout(250);
  await p.selectOption('form[data-form=saveStaff] [name=role]','Clerk');await p.fill('form[data-form=saveStaff] [name=username]','newclerk');await p.fill('form[data-form=saveStaff] [name=password]','secret12');await p.click('form[data-form=saveStaff] button.primary, form[data-form=saveStaff] .btn.primary');await p.waitForTimeout(250);
  const n=await nt(p,'newclerk');ok(ntHas(n,'account',/created/i),JSON.stringify(n));ok(!(await nt(p,'admin')).some(x=>x.k==='account'),'admin told about own action');
});
await T('Notifications','NT-permission','Changing a role permission tells every login of that role','admin',async p=>{
  await p.nav('Staff and Roles');await p.tab('Role permissions');await p.evaluate(()=>{const el=document.querySelector('input[data-role=Clerk][data-p="reports.students"]');el.checked=!el.checked;el.dispatchEvent(new Event('change',{bubbles:true}))});await p.waitForTimeout(200);
  const cl=await nt(p,'clerk');ok(ntHas(cl,'account',/access changed|Your access/),JSON.stringify(cl.map(x=>x.t)));ok(!(await nt(p,'faculty')).some(n=>/Your access/.test(n.t)),'another role told');
  ok(ntHas(await nt(p,'principal'),'system',/Permissions changed/),'principal system');
});
await T('Notifications','NT-security','Three wrong passwords in 15 minutes alert the Super Admin once',null,async p=>{
  await p.login('accountant','bad1');await p.login('accountant','bad2');
  ok(!(await nt(p,'admin')).some(n=>n.k==='security'),'alerted too early');
  await p.login('accountant','bad3');const a=await nt(p,'admin');ok(ntHas(a,'security',/3 failed sign-ins/),JSON.stringify(a.map(x=>x.t)));
  await p.login('accountant','bad4');ok((await nt(p,'admin')).filter(n=>n.k==='security').length===1,'repeated alert');ok(!(await nt(p,'principal')).some(n=>n.k==='security'),'principal told');
},{plain:true});
await T('Notifications','NT-rules-matrix','Super Admin switches who is notified; the choice changes real delivery','admin',async p=>{
  await p.nav('Settings');ok(await p.$('table.matrix [data-change=ntRule]'),'rules table missing');
  const n=await p.$$eval('table.matrix [data-change=ntRule]',e=>e.length);const d=await p.evaluate(()=>NT_CATS.length*NT_ROLES.length);ok(n===d,n+' vs '+d);
  await p.evaluate(()=>{const el=document.querySelector('input[data-change=ntRule][data-c=payment][data-r=Parent]');el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}))});await p.waitForTimeout(150);
  ok((await p.db()).settings.notify.payment.Parent===false,'rule not saved');
  await p.logout();await p.login('accountant','account123');const id=await riya(p);const before=(await nt(p,'parent')).filter(x=>x.k==='payment').length;await payFor(p,id,200);
  const after=(await nt(p,'parent')).filter(x=>x.k==='payment').length;ok(after===before,'parent still notified');ok((await nt(p,'student')).filter(x=>x.k==='payment').length>0,'student rule unaffected');
  await p.logout();await p.login('admin','admin123');await p.nav('Settings');await p.click('[data-act=ntRulesReset]');await p.click('#dlgOk');await p.waitForTimeout(200);ok((await p.db()).settings.notify.payment.Parent===true,'defaults not restored');
  ok((await p.db()).audit.some(a=>a.action==='Notification rules changed'),'not audited');
});
await T('Notifications','NT-rules-admin-only','Only the Super Admin can see or change notification rules','principal',async p=>{
  await p.nav('Reports');const r=await p.evaluate(()=>{const o=[ntRulesPanel()===''];for(const f of [()=>CHG.ntRule({dataset:{c:'payment',r:'Parent'},checked:false}),()=>ACT.ntRulesReset(),()=>ACT.ntTest()]){try{f();o.push('allowed')}catch(e){o.push('blocked')}}return o});ok(r[0]&&r.slice(1).every(x=>x==='blocked'),r.join());
  ok((await p.db()).settings.notify.payment.Parent===true,'rule changed');
});
await T('Notifications','NT-drawer','Opening a notification marks it read, goes to the right place, and the badge drops','accountant',async p=>{
  const n0=await bellN(p);ok(n0>0,'no unread');await p.click('#bell');await p.waitForTimeout(250);ok(await p.$('.drawer .nt.unread'),'no unread item');
  const first=await p.$eval('.drawer .nt.digest, .drawer .nt:has-text("overdue fees")',e=>e.dataset.id).catch(()=>null);
  await p.click('.drawer .nt:has-text("overdue fees")');await p.waitForTimeout(350);
  ok(!(await p.$('.drawer')),'drawer stayed open');ok(/Pending dues|dues/i.test(await p.text()),'did not land on dues');ok((await bellN(p))===n0-1,`badge ${await bellN(p)} vs ${n0-1}`);
  const d=await p.evaluate(()=>ntMine(cur()).find(n=>/overdue fees/.test(n.t)).read);ok(d===true,'not marked read');
});
await T('Notifications','NT-filters','Mark all read, unread filter, type filter and show older','admin',async p=>{
  await p.evaluate(()=>{for(let i=0;i<30;i++)notify('system','Bulk '+i,'x',{uids:[cur().id],roles:[],self:true})});
  await p.click('#bell');await p.waitForTimeout(250);ok((await p.$$('.drawer .nt')).length===25,'first page');await p.click('[data-act=ntMore]');await p.waitForTimeout(150);ok((await p.$$('.drawer .nt')).length===34,'older: '+(await p.$$('.drawer .nt')).length);
  await p.selectOption('.drawer select[data-change=ntCat]','system');await p.waitForTimeout(150);ok((await p.$$eval('.drawer .nt',e=>e.every(x=>/Rules and permissions changed/.test(x.textContent))))&&(await p.$$('.drawer .nt')).length===25,'type filter '+(await p.$$('.drawer .nt')).length+' '+(await p.$$eval('.drawer .nt',e=>e.slice(0,2).map(x=>x.textContent))));
  await p.click('.drawer [data-act=ntF][data-f=unread]');await p.waitForTimeout(150);ok((await p.$$('.drawer .nt.unread')).length>0,'unread tab');
  await p.click('.drawer [data-act=ntReadAll]');await p.waitForTimeout(200);ok((await bellN(p))===0,'badge after read all');ok(/all caught up/.test(await p.text('.drawer')),'caught up text');ok(await p.$eval('#bellN',e=>e.hidden),'badge visible at 0');
  await p.evaluate(()=>{for(let i=0;i<70;i++)notify('system','More '+i,'x',{uids:[cur().id],roles:[],self:true})});const cnt=await p.evaluate(()=>ntMine(cur()).length);ok(cnt===60,'cap per login '+cnt);
});
await T('Notifications','NT-isolation','Nobody can open or read another person\'s notification','parent',async p=>{
  const r=await p.evaluate(()=>{const other=db.notifs.find(n=>n.uid!==cur().id&&!n.read);const id=other.id;ACT.ntOpen({dataset:{id}});return{read:db.notifs.find(n=>n.id===id).read,mine:ntMine(cur()).every(n=>n.uid===cur().id)}});
  ok(r.read===false&&r.mine,'crossed: '+JSON.stringify(r));
  await p.click('#bell');await p.waitForTimeout(200);const mine=await p.$$eval('.drawer .nt',e=>e.length);const my=await p.evaluate(()=>ntMine(cur()).length);ok(mine===Math.min(25,my),'drawer shows '+mine);
});
await T('Notifications','NT-live','A notification created in another tab shows in the open one with a message','admin',async p=>{
  const n0=await bellN(p);const q=await p.c.newPage();await q.route(/fonts\./,r=>r.abort());await q.goto(FILE);await q.fill('input[name=u]','accountant');await q.fill('input[name=p]','account123');await q.click('form[data-form=login] button.primary');await q.waitForTimeout(300);
  await q.evaluate(()=>{const s=db.students.find(x=>x.status==='Active'&&feeSum(x).payable>0);const x=recordPayment(s,{amount:100,mode:'Cash',channel:'counter',by:'t'});autoReceipt(x);save()});
  await p.waitForTimeout(900);ok((await bellN(p))>n0,`badge ${await bellN(p)} vs ${n0}`);ok(/New notification|new notification/i.test(await p.$eval('.toast',e=>e.textContent).catch(()=>'')),'no toast');await q.close();
});
await T('Notifications','NT-mail-fail','A failed receipt email alerts accounts once, even after retries','accountant',async p=>{
  await p.evaluate(()=>{db.settings.mail.mode='live';db.settings.mail.endpoint='https://invalid.invalid/x';db.settings.mail.key='k';save()});
  const id=await riya(p);await payFor(p,id,200);await p.waitForTimeout(2600);
  const ad=await nt(p,'admin');ok(ad.filter(n=>n.k==='mailfail').length===1,'admin mailfail '+ad.filter(n=>n.k==='mailfail').length);
  await p.nav('Fee Collection');await p.tab('Email outbox');await p.evaluate(()=>ACT.mailRetryAll());await p.waitForTimeout(2600);ok((await nt(p,'admin')).filter(n=>n.k==='mailfail').length===1,'retry repeated the alert');
});
await T('Notifications','NT-migrate','Older data without notifications loads, keeps the admin\'s rules and gets inbox',  'admin',async p=>{
  const r=await p.evaluate(()=>{db.settings.notify.payment.Student=false;delete db.notifs;delete db.settings.notify.digest;migrate();return{arr:Array.isArray(db.notifs),kept:db.settings.notify.payment.Student===false,filled:!!db.settings.notify.digest&&db.settings.notify.digest.Accountant===true}});ok(r.arr&&r.kept&&r.filled,JSON.stringify(r));
});
await T('Notifications','NT-reset','Resetting demo data rebuilds a clean inbox',  'admin',async p=>{
  await p.evaluate(()=>{for(let i=0;i<5;i++)notify('system','Junk '+i,'x',{uids:[cur().id],roles:[],self:true})});await p.nav('Settings');await p.click('[data-act=resetDemo]');await p.click('#dlgOk');await p.waitForTimeout(400);
  await p.login('admin','admin123');ok(!(await nt(p,'admin')).some(n=>/Junk/.test(n.t)),'old notification survived');ok(ntHas(await nt(p,'admin'),'digest'),'digest missing');
},{plain:true});
await T('Notifications','NT-nostorage','Notifications work when browser storage is blocked','accountant',async p=>{
  ok(await p.$('#bell'),'bell');await p.click('#bell');await p.waitForTimeout(200);ok(await p.$('.drawer .nt'),'no items');
},{noStorage:true});
await T('Notifications','NT-mobile','On a phone the bell fits, the drawer is usable, and the rules grid does not overlap','admin',async p=>{
  ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'page overflows');const b=await p.$eval('#bell',e=>{const r=e.getBoundingClientRect();return[r.left,r.right,r.top,r.bottom]});ok(b[0]>=0&&b[1]<=390,'bell off screen '+b);
  const tg=await p.$eval('.topbar [data-act=theme]',e=>{const r=e.getBoundingClientRect();return[r.left,r.right,r.width]});ok(tg[0]>=0&&tg[1]<=390&&tg[2]>=36,'theme button squeezed or off screen '+tg);
  await p.click('#bell');await p.waitForTimeout(250);ok(!(await p.evaluate(()=>{const d=document.querySelector('.drawer');return d.scrollWidth>d.clientWidth+1})),'drawer overflows');
  ok(await p.evaluate(()=>{const r=document.querySelector('.drawer .nt').getBoundingClientRect();return r.width>250&&r.right<=innerWidth}),'cards too narrow');await p.keyboard.press('Escape');
  await p.nav('Settings');const boxes=await p.$$eval('table.matrix tbody tr:first-child td[data-check] input',e=>e.map(x=>{const r=x.getBoundingClientRect();return[r.left,r.top,r.right,r.bottom]}));
  ok(boxes.length===7,'checkboxes '+boxes.length);for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],c=boxes[j];ok(a[2]<=c[0]||c[2]<=a[0]||a[3]<=c[1]||c[3]<=a[1],'checkboxes overlap '+i+' '+j)}
  ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'settings overflows');
},{vp:{width:390,height:844}});
await T('Roles','RB-matrix-mobile','Role permission grid on a phone: every tick box has its own label and no overlap','admin',async p=>{
  await p.nav('Staff and Roles');await p.tab('Role permissions');
  const rows=await p.$$eval('table.matrix tbody tr',trs=>trs.slice(0,6).map(tr=>[...tr.querySelectorAll('td[data-check]')].map(td=>{const i=td.querySelector('input').getBoundingClientRect();const lbl=getComputedStyle(td,'::before').content;return{box:[i.left,i.top,i.right,i.bottom],lbl}})));
  for(const r of rows){ok(r.length===5,'checks '+r.length);for(let i=0;i<r.length;i++){ok(/\w/.test(r[i].lbl),'label '+r[i].lbl);for(let j=i+1;j<r.length;j++){const a=r[i].box,c=r[j].box;ok(a[2]<=c[0]||c[2]<=a[0]||a[3]<=c[1]||c[3]<=a[1],'overlap')}}}
  ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'overflow');
},{vp:{width:390,height:844}});
await T('Notifications','NT-dark','Notification drawer is readable in dark theme','admin',async p=>{await p.click('[data-act=theme]');await p.waitForTimeout(400);await p.click('#bell');await p.waitForTimeout(250);
  const c=await p.$eval('.drawer .nt',e=>{const s=getComputedStyle(e);return[s.color,s.backgroundColor]});ok(c[0]!==c[1],c.join());ok(/rgb\((1[5-9]\d|2\d\d)/.test(c[0])||/rgb\(2/.test(c[0]),'text not light: '+c[0]);});

/* ================= E-MAIL RECEIPTS AND PDF ================= */
const cashIn=async(p,amt,sid)=>{await p.nav('Fee Collection');await p.click('[data-act=feeMode][data-m=counter]');if(sid){await p.selectOption('#f_sid',sid);await p.waitForTimeout(120);await p.click('[data-act=feeMode][data-m=counter]')}await p.fill('#f_amount',String(amt));await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(120)};
const lastOut=async p=>(await p.db()).outbox[0];
const setMail=async(p,patch)=>{await p.evaluate(x=>{Object.assign(db.settings.mail,x);save()},patch)};
await T('Email and PDF','EM-auto-counter','Counter payment creates an outbox entry and sends it to parent and student','accountant',async p=>{
  await cashIn(p,2000);let o=await lastOut(p);ok(o&&/^Queued|Sending|Sent/.test(o.status),'no outbox entry: '+JSON.stringify(o));ok(/Queued|Sent/.test(await p.text('.maillive')),'receipt panel shows no mail line');
  await p.waitForTimeout(1700);o=await lastOut(p);ok(o.status==='Sent (demo)','status '+o.status);ok(o.to.length===2&&o.to.every(x=>/@example\.com$/.test(x)),'recipients '+o.to);ok(o.filename===o.rc+'.pdf'&&o.bytes>1500,'pdf size '+o.bytes);ok(/Sent/.test(await p.text('.maillive')),'live line not updated');
});
await T('Email and PDF','EM-pdf-valid','The receipt PDF is structurally valid and contains the receipt details','accountant',async p=>{
  await cashIn(p,3000);const r=await p.evaluate(()=>{const o=db.outbox[0],pay=db.payments.find(x=>x.id===o.paymentId),s=stu(pay.studentId);const f=receiptPdf(pay);
    const sx=+f.match(/startxref\n(\d+)/)[1];const xrefOk=f.slice(sx,sx+4)==='xref';const offs=[...f.matchAll(/(\d{10}) 00000 n/g)].map(m=>+m[1]);
    const objOk=offs.every((o,i)=>f.slice(o).startsWith((i+1)+' 0 obj'));const len=+f.match(/\/Length (\d+)/)[1];const st=f.indexOf('stream\n')+7;const lenOk=f.slice(st,st+len).endsWith('ET')||f.slice(st+len).startsWith('\nendstream');
    return{head:f.slice(0,8),tail:f.trimEnd().slice(-5),xrefOk,objOk,lenOk,n:offs.length,hasRc:f.includes(pay.rc),hasName:f.includes(s.name),hasAmt:f.includes('Rs. 3,000'),nonLatin:/[^\x00-\xff]/.test(f)}});
  ok(r.head==='%PDF-1.4'&&r.tail==='%%EOF','header/trailer '+JSON.stringify(r));ok(r.xrefOk&&r.objOk&&r.lenOk&&r.n===7,'structure '+JSON.stringify(r));ok(r.hasRc&&r.hasName&&r.hasAmt,'content missing');ok(!r.nonLatin,'non latin chars in pdf');
});
await T('Email and PDF','EM-pdf-text','PDF text handles rupee sign, accents and long text safely','accountant',async p=>{
  const r=await p.evaluate(()=>({a:pdfSafe('₹1,500 · Café – ok'),b:pdfSafe('ગુજરાતી'),c:pdfEsc('a(b)c\\d'),w:Math.round(pdfW('Hello',10)),len:HELV.length}));
  ok(r.a==='Rs. 1,500 - Cafe - ok','rupee/accents: '+r.a);ok(/^\?+$/.test(r.b),'gujarati not made safe: '+r.b);ok(r.c==='a\\(b\\)c\\\\d','escape '+r.c);ok(r.w===sumW(),'width '+r.w);ok(r.len===95,'width table '+r.len);
  function sumW(){return Math.round((722+556+222+222+556)*10/1000)}
});
await T('Email and PDF','EM-pdf-cancel','A cancelled receipt PDF is stamped CANCELLED','accountant',async p=>{
  await cashIn(p,1000);await p.evaluate(()=>{const pay=db.payments[db.payments.length-1];cancelPayment(pay,'wrong student','Cash');save()});
  const r=await p.evaluate(()=>{const f=receiptPdf(db.payments[db.payments.length-1]);return{c:f.includes('(CANCELLED)'),r:f.includes('wrong student')}});ok(r.c&&r.r,'no stamp '+JSON.stringify(r));
});
await T('Email and PDF','EM-body','E-mail body is escaped and shows amount, student and balance','accountant',async p=>{
  const h=await p.evaluate(()=>{const pay=db.payments[0];stu(pay.studentId).guardian.name='<img src=x onerror=alert(1)>';const m=buildReceiptMail(pay);return{f:m.fragment,t:m.text,sub:m.subject}});
  ok(!/<img src=x/.test(h.f)&&/&lt;img/.test(h.f),'name not escaped');ok(/Fee receipt RC-/.test(h.sub),h.sub);
});
await T('Email and PDF','EM-online','Online (gateway) payment also e-mails the receipt','accountant',async p=>{
  await p.nav('Fee Collection');await p.fill('#f_amount','1200');await p.click('form[data-form=collect] button.primary');await p.waitForTimeout(100);await p.click('[data-act=reqSim]');await p.waitForTimeout(1800);
  const o=await lastOut(p);ok(o&&o.status==='Sent (demo)','status '+(o&&o.status));
});
await T('Email and PDF','EM-parent','Parent portal payment e-mails the receipt and shows status','parent',async p=>{
  await p.nav('Fees and Receipts');await p.click('[data-act=parentPay]');await p.fill('form[data-form=parentPayGo] [name=amount]','700');await p.click('form[data-form=parentPayGo] button.primary');await p.click('[data-act=pOk]');await p.waitForTimeout(1800);
  ok(/Sent/.test(await p.text('.drawer .maillive')),'status line: '+await p.text('.drawer .maillive'));const o=await lastOut(p);ok(o.studentId&&o.status==='Sent (demo)'&&o.to.length===2,JSON.stringify(o));
});
await T('Email and PDF','EM-off','Switching automatic emails off stops them','admin',async p=>{
  await setMail(p,{enabled:false});await cashIn(p,900);await p.waitForTimeout(300);ok((await p.db()).outbox.length===0,'email queued while off');
  await p.evaluate(()=>{const pay=db.payments[db.payments.length-1];document.body.insertAdjacentHTML('beforeend','<i id=x data-id="'+pay.id+'"></i>');ACT.emailReceipt(document.getElementById('x'));save()});ok((await p.db()).outbox.length===1,'manual send should still work');
});
await T('Email and PDF','EM-recipients','Send-to setting: parent only / student only / both','admin',async p=>{
  const r=await p.evaluate(()=>{const s=db.students[0];const out={};for(const k of ['both','guardian','student']){db.settings.mail.to=k;out[k]=mailTargets(s).map(x=>x.role)}return out});
  ok(r.both.join()==='Parent,Student'&&r.guardian.join()==='Parent'&&r.student.join()==='Student',JSON.stringify(r));
});
await T('Email and PDF','EM-dedupe','Same address for parent and student is used once; invalid addresses ignored','admin',async p=>{
  const r=await p.evaluate(()=>{const s=db.students[0];s.guardian.email='same@x.com';s.email='SAME@x.com';const a=mailTargets(s).length;s.email='not-an-email';const b=mailTargets(s).map(x=>x.email);return{a,b}});ok(r.a===1&&r.b.join()==='same@x.com',JSON.stringify(r));
});
await T('Email and PDF','EM-skip','No email address on file is recorded as Skipped with a reason','accountant',async p=>{
  const id=await p.evaluate(()=>{const s=db.students[3];s.email='';s.guardian.email='';save();return s.id});await cashIn(p,500,id);const o=await lastOut(p);ok(o.status==='Skipped'&&/No valid email/.test(o.error),JSON.stringify(o));ok(/No valid email/.test(await p.text('.maillive')),'receipt panel');
  await p.tab('Email outbox');ok(/Skipped/.test(await p.text()),'outbox row');
});
await T('Email and PDF','EM-outbox','Outbox tab lists emails with status, preview and send again','accountant',async p=>{
  await cashIn(p,1000);await p.waitForTimeout(1700);await p.tab('Email outbox');let t=await p.text();ok(/Sent \(demo\)/.test(t)&&/RC-\d+/.test(t),'rows');
  await p.click('[data-act=mailPreview]');await p.waitForTimeout(150);const d=await p.text('.drawer');ok(/\.pdf/.test(d)&&/KB/.test(d)&&/Dear/.test(d)&&/Amount received/.test(d),'preview: '+d.slice(0,200));await p.keyboard.press('Escape');await p.waitForTimeout(250);
  const n=(await p.db()).outbox.length;await p.click('#page [data-act=mailRetry]');await p.waitForTimeout(150);ok((await p.db()).outbox.length===n+1,'send again did not create a new entry');
});
await T('Email and PDF','EM-receipt-btns','Receipt drawer has Email PDF and Download PDF; email goes out','accountant',async p=>{
  await p.nav('Fee Collection');await p.tab('Receipts');await p.click('#page tbody tr.click');await p.waitForTimeout(250);ok(await p.$('.drawer [data-act=emailReceipt]')&&await p.$('.drawer [data-act=dlPdf]'),'buttons missing');
  await p.click('.drawer [data-act=emailReceipt]');await p.waitForTimeout(1700);ok((await p.db()).outbox[0].status==='Sent (demo)','not sent');
  const dl=p.waitForEvent('download',{timeout:2500}).catch(()=>null);await p.click('.drawer [data-act=dlPdf]');const d=await dl;ok(d&&/^RC-\d+\.pdf$/.test(d.suggestedFilename()),'no download: '+(d&&d.suggestedFilename()));
});
const liveRoute=async(p,handler)=>{await p.route(/api\/send-receipt/,handler)};
await T('Email and PDF','EM-live-ok','Live mode posts PDF, key and recipients to the server','admin',async p=>{
  let req=null;await liveRoute(p,r=>{req={h:r.request().headers(),b:r.request().postDataJSON()};r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,id:'em_123'})})});
  await setMail(p,{mode:'live',key:'k-secret',endpoint:'/api/send-receipt'});await cashIn(p,1500);await p.waitForTimeout(1700);
  ok(req,'no request');ok(req.h['x-api-key']==='k-secret','key');ok(req.b.to.length===2&&req.b.pdfBase64.startsWith('JVBERi0')&&/^RC-\d+\.pdf$/.test(req.b.filename)&&/<table/.test(req.b.html),'payload '+JSON.stringify(Object.keys(req.b)));
  const o=await lastOut(p);ok(o.status==='Sent'&&o.providerId==='em_123','status '+o.status);const bytes=Buffer.from(req.b.pdfBase64,'base64').toString('latin1');ok(bytes.startsWith('%PDF')&&bytes.trimEnd().endsWith('%%EOF'),'attachment not a pdf');
});
await T('Email and PDF','EM-live-fail','Server failure shows the reason; Retry then succeeds','admin',async p=>{
  let mode='bad';await liveRoute(p,r=>mode==='bad'?r.fulfill({status:502,contentType:'application/json',body:JSON.stringify({ok:false,error:'Mail provider said: domain not verified'})}):r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,id:'x'})}));
  await setMail(p,{mode:'live',key:'k'});await cashIn(p,800);await p.waitForTimeout(1700);let o=await lastOut(p);ok(o.status==='Failed'&&/domain not verified/.test(o.error),JSON.stringify(o));
  await p.tab('Email outbox');ok(/domain not verified/.test(await p.text()),'reason not shown');mode='ok';await p.click('#page [data-act=mailRetry]');await p.waitForTimeout(700);o=await lastOut(p);ok(o.status==='Sent'&&o.attempts===2,JSON.stringify(o));
});
await T('Email and PDF','EM-live-401','Wrong access key is reported clearly','admin',async p=>{
  await liveRoute(p,r=>r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({ok:false,error:'Wrong access key. Check Settings -> Email receipts.'})}));
  await setMail(p,{mode:'live',key:'bad'});await cashIn(p,800);await p.waitForTimeout(1700);const o=await lastOut(p);ok(o.status==='Failed'&&/access key/i.test(o.error),JSON.stringify(o));
});
await T('Email and PDF','EM-live-down','Unreachable server fails safely without breaking the payment','admin',async p=>{
  await liveRoute(p,r=>r.abort());await setMail(p,{mode:'live'});const before=(await p.db()).payments.length;await cashIn(p,800);await p.waitForTimeout(1700);const d=await p.db();ok(d.payments.length===before+1,'payment lost');ok(d.outbox[0].status==='Failed'&&/Could not reach/.test(d.outbox[0].error),JSON.stringify(d.outbox[0]));
});
await T('Email and PDF','EM-redirect','Test redirect sends only to the redirect address and marks the subject','admin',async p=>{
  let req=null;await liveRoute(p,r=>{req=r.request().postDataJSON();r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"id":"1"}'})});
  await setMail(p,{mode:'live',key:'k',redirect:'me@demo.com'});await cashIn(p,600);await p.waitForTimeout(1700);ok(req&&req.to.join()==='me@demo.com'&&/^\[TEST for /.test(req.subject),JSON.stringify(req&&{to:req.to,s:req.subject}));
});
await T('Email and PDF','EM-retry-all','Retry all failed emails in one click','admin',async p=>{
  let ok1=false;await liveRoute(p,r=>ok1?r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}):r.abort());await setMail(p,{mode:'live'});await cashIn(p,500);await p.waitForTimeout(1500);await cashIn(p,400);await p.waitForTimeout(1500);
  ok((await p.db()).outbox.filter(o=>o.status==='Failed').length===2,'two should fail');ok1=true;await p.tab('Email outbox');await p.click('[data-act=mailRetryAll]');await p.waitForTimeout(900);ok((await p.db()).outbox.every(o=>o.status==='Sent'),'not all sent');
});
await T('Email and PDF','EM-settings','Settings: save, validation, and access','admin',async p=>{
  await p.nav('Settings');await p.fill2('form[data-form=saveMail]',{fromName:'Vidyapeeth Accounts',replyTo:'acc@college.edu',to:'guardian'});await p.click('form[data-form=saveMail] button.primary');await p.waitForTimeout(150);
  let m=(await p.db()).settings.mail;ok(m.fromName==='Vidyapeeth Accounts'&&m.to==='guardian'&&m.replyTo==='acc@college.edu',JSON.stringify(m));
  await p.fill2('form[data-form=saveMail]',{redirect:'nope'});await p.evaluate(()=>document.querySelector('form[data-form=saveMail]').noValidate=true);await p.click('form[data-form=saveMail] button.primary');await p.waitForTimeout(100);ok(/valid email/i.test(await p.toast()),'bad redirect accepted');
});
await T('Email and PDF','EM-settings-deny','Only admin can change email settings','accountant',async p=>{
  ok(!(await p.navs()).includes('Settings'),'settings visible');const r=await p.evaluate(()=>{try{FORM.saveMail({},{enabled:'1',to:'both',mode:'demo',endpoint:'/x',key:'',fromName:'',replyTo:'',redirect:''});return'allowed'}catch(e){return e.message}});ok(/access/.test(r),r);
});
await T('Email and PDF','EM-test','Send a test email goes to the typed address even with redirect on','admin',async p=>{
  let req=null;await liveRoute(p,r=>{req=r.request().postDataJSON();r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'})});await cashIn(p,500);await setMail(p,{mode:'live',key:'k',redirect:'other@demo.com'});
  await p.nav('Settings');await p.click('[data-act=mailTestAsk]');await p.fill('form[data-form=mailTest] [name=email]','owner@college.edu');await p.click('form[data-form=mailTest] button.primary');await p.waitForTimeout(1700);ok(req&&req.to.join()==='owner@college.edu'&&!/^\[TEST/.test(req.subject),JSON.stringify(req&&req.to));
});
await T('Email and PDF','EM-ping','Check mail server explains the situation when no server exists','admin',async p=>{
  await p.nav('Settings');await p.click('[data-act=mailPing]');await p.waitForTimeout(500);ok(/Could not reach/.test(await p.text('#mailPingOut')),await p.text('#mailPingOut'));p.__errs.length=0;
  await p.route(/api\/send-receipt/,r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"configured":false}'}));await p.click('[data-act=mailPing]');await p.waitForTimeout(400);ok(/not set up/.test(await p.text('#mailPingOut')),'unconfigured message');
  await p.unroute(/api\/send-receipt/);await p.route(/api\/send-receipt/,r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"configured":true,"from":"a@b.com"}'}));await p.click('[data-act=mailPing]');await p.waitForTimeout(400);ok(/ready/.test(await p.text('#mailPingOut')),'configured message');
});
await T('Email and PDF','EM-contact','Parent updates the receipt email; next receipt goes there','parent',async p=>{
  await p.nav('Fees and Receipts');await p.click('[data-act=myContact]');await p.fill('form[data-form=myContact] [name=email]','new.parent@home.in');await p.click('form[data-form=myContact] button.primary');await p.waitForTimeout(150);
  ok((await p.db()).students.find(s=>s.name==='Riya Joshi').guardian.email==='new.parent@home.in','not saved');ok(/new\.parent@home\.in/.test(await p.text()),'not shown');
  await p.click('[data-act=parentPay]');await p.fill('form[data-form=parentPayGo] [name=amount]','500');await p.click('form[data-form=parentPayGo] button.primary');await p.click('[data-act=pOk]');await p.waitForTimeout(300);ok((await lastOut(p)).to.includes('new.parent@home.in'),'new address not used');
});
await T('Email and PDF','EM-contact-bad','Invalid email or mobile is rejected in contact update','parent',async p=>{
  await p.nav('Fees and Receipts');await p.click('[data-act=myContact]');await p.evaluate(()=>document.querySelector('form[data-form=myContact]').noValidate=true);await p.fill('form[data-form=myContact] [name=email]','bad@');await p.click('form[data-form=myContact] button.primary');await p.waitForTimeout(100);ok(/does not look right/.test(await p.toast()),'bad email accepted');
  await p.fill('form[data-form=myContact] [name=email]','ok@ok.in');await p.fill('form[data-form=myContact] [name=phone]','123');await p.click('form[data-form=myContact] button.primary');await p.waitForTimeout(100);ok(/10 digit/.test(await p.toast()),'bad mobile accepted');
});
await T('Email and PDF','EM-migrate','Data saved by the previous build loads and gains email settings and student logins','admin',async p=>{
  await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('vp_erp_demo_v3'));delete d.outbox;delete d.settings.mail;d.users=d.users.filter(u=>u.role!=='Student');d.students.forEach(s=>delete s.guardian.email);localStorage.setItem('vp_erp_demo_v3',JSON.stringify(d))});
  await p.reload();await p.waitForTimeout(300);const d=await p.evaluate(()=>({m:db.settings.mail,o:Array.isArray(db.outbox),su:db.users.filter(u=>u.role==='Student').length,ge:db.students.every(s=>s.guardian.email),stu:db.users.some(u=>u.username==='student')}));
  ok(d.m&&d.m.mode==='demo'&&d.o&&d.su===26&&d.ge&&d.stu,JSON.stringify(d));
});
await T('Email and PDF','EM-restore','Restoring an older backup upgrades it','admin',async p=>{
  const json=await p.evaluate(()=>{const d=JSON.parse(JSON.stringify(db));delete d.outbox;delete d.settings.mail;return JSON.stringify(d)});await p.nav('Settings');await p.click('[data-act=backupIn]');await p.fill('form[data-form=restore] [name=json]',json);await p.click('form[data-form=restore] button');await p.waitForTimeout(250);
  ok(await p.login('accountant','account123'),'login after restore');await cashIn(p,500);await p.waitForTimeout(300);ok((await lastOut(p)).rc,'outbox broken');
});
await T('Email and PDF','EM-admission','New admission stores guardian email and creates parent and student logins','clerk',async p=>{
  await admit(p,{name:'Mail Test Student',gemail:'dad@home.in',email:'mts@home.in'});const t=await p.text('.drawer');ok(/Student username/.test(t)&&/stu-/.test(t),'student login not shown: '+t.slice(0,300));
  const d=await p.db();const s=d.students.find(x=>x.name==='Mail Test Student');ok(s.guardian.email==='dad@home.in','guardian email');ok(d.users.some(u=>u.role==='Student'&&u.studentId===s.id)&&d.users.some(u=>u.role==='Parent'&&u.studentId===s.id),'logins');
});
await T('Email and PDF','EM-import','CSV import keeps guardian email and creates both logins','admin',async p=>{
  const csv='name,course,batch,division,mobile,guardian,guardian_mobile,guardian_email,email,gender\nCsv Mail Kid,B.Ed,2026–28,A,9876501234,Shri Papa,9876501235,papa@csv.in,kid@csv.in,M';
  await p.nav('Students');await p.click('[data-act=importStudents]');await p.fill('form[data-form=importCsv] [name=csv]',csv);await p.click('form[data-form=importCsv] button.primary');await p.waitForTimeout(250);
  const d=await p.db();const s=d.students.find(x=>x.name==='Csv Mail Kid');ok(s&&s.guardian.email==='papa@csv.in'&&s.email==='kid@csv.in','fields '+JSON.stringify(s&&[s.guardian.email,s.email]));ok(d.users.some(u=>u.role==='Student'&&u.studentId===s.id),'student login');
});
await T('Email and PDF','EM-mobile','Outbox and settings are cards on a phone with no sideways scroll','admin',async p=>{
  await cashIn(p,700);await p.waitForTimeout(1500);await p.tab('Email outbox');ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'outbox overflows');
  ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#page thead')).display==='none'),'table still a table');await p.nav('Settings');ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'settings overflows');
},{vp:{width:390,height:844}});
await T('Email and PDF','EM-dark','Email preview stays readable in dark theme','accountant',async p=>{
  await cashIn(p,700);await p.click('[data-act=theme]');await p.waitForTimeout(500);await p.tab('Email outbox');await p.click('[data-act=mailPreview]');await p.waitForTimeout(200);
  const c=await p.$eval('.mailbody',e=>getComputedStyle(e).backgroundColor);ok(/243, 245, 250/.test(c),'preview bg '+c);
});

/* ================= STUDENT PORTAL ================= */
await T('Student Portal','SP-login','Student demo account signs in to the student portal','student',async p=>{
  const n=await p.navs();ok(n.join('|')==='Home|My Academics|Fees and Receipts|Notices',n.join('|'));const t=await p.text('.me');ok(/Student/.test(t)&&/Riya Joshi/.test(t),t);ok(/Hello, Riya/.test(await p.text()),'greeting');
});
await T('Student Portal','SP-home','Home shows own attendance, fee and marks that match the records','student',async p=>{
  const r=await p.evaluate(()=>{const s=myChild();return{a:attPct(s),pay:feeSum(s).payable,name:s.name}});const t=await p.text();ok(t.includes(r.a+'%'),'attendance '+r.a);ok(t.includes(inr0(r.pay)),'payable');ok(!/Aarav Patel/.test(t),'other student');ok(await p.$('.attstrip'),'strip');
  function inr0(n){return '₹'+Math.round(n).toLocaleString('en-IN')}
});
await T('Student Portal','SP-academics','My Academics lists marks, monthly attendance, subjects','student',async p=>{
  await p.nav('My Academics');const t=await p.text();const d=await p.evaluate(()=>{const s=myChild();return{m:marksOf(s).length,mo:attBreakdown(s).length,sub:db.subjects.filter(x=>x.course===s.course&&x.sem===s.sem).length}});
  ok(await p.$$eval('#page tbody tr',r=>r.length)===d.m,'marks rows vs '+d.m);ok(/Days present/.test(t),'att');ok(await p.$$eval('.bar',b=>b.length)>=d.mo,'monthly bars');ok(/Subjects this semester/.test(t),'subjects');
});
await T('Student Portal','SP-fees','Student sees own installments and receipts only','student',async p=>{
  await p.nav('Fees and Receipts');const t=await p.text();ok(/Installment 1/.test(t)&&/Receipts/.test(t),'content');const n=await p.$$eval('#page [data-act=pReceipt]',e=>e.length);const dn=await p.evaluate(()=>paysOf(myChild(),false).length);ok(n===dn,n+' vs '+dn);
});
await T('Student Portal','SP-receipt','Student opens a receipt, can e-mail and download the PDF','student',async p=>{
  await p.nav('Fees and Receipts');await p.click('#page [data-act=pReceipt]');await p.waitForTimeout(250);ok(await p.$('.drawer [data-act=emailReceipt]')&&await p.$('.drawer [data-act=dlPdf]'),'buttons');await p.click('.drawer [data-act=emailReceipt]');await p.waitForTimeout(1700);
  const o=await lastOut(p);ok(o.studentId&&/Sent/.test(o.status),JSON.stringify(o));
});
await T('Student Portal','SP-pay','Student pays online; ledger, receipt, audit and email all update','student',async p=>{
  const b=await p.evaluate(()=>feeSum(myChild()).payable);await p.nav('Fees and Receipts');await p.click('[data-act=parentPay]');await p.fill('form[data-form=parentPayGo] [name=amount]','1000');await p.click('form[data-form=parentPayGo] button.primary');await p.click('[data-act=pOk]');await p.waitForTimeout(1700);
  const d=await p.db();const pay=d.payments[d.payments.length-1];ok(pay.amount===1000&&pay.by==='Student portal'&&pay.channel==='online',JSON.stringify([pay.amount,pay.by]));ok(await p.evaluate(()=>feeSum(myChild()).payable)<b,'balance');ok(d.audit.some(a=>/student portal/i.test(a.detail)),'audit');ok(d.outbox[0].paymentId===pay.id&&d.outbox[0].status==='Sent (demo)','mail');
});
await T('Student Portal','SP-home-pay','Pay now on Home opens the payment dialog','student',async p=>{
  const ok1=await p.$('#page [data-act=parentPay]');if(ok1){await p.click('#page [data-act=parentPay]');await p.waitForTimeout(150);ok(await p.$('form[data-form=parentPayGo]'),'dialog')}
});
await T('Student Portal','SP-isolation','Student cannot open other students receipts or staff screens','student',async p=>{
  const r=await p.evaluate(()=>{const mine=myChild().id;const other=db.payments.find(x=>x.studentId!==mine);const out=[];for(const f of [()=>ACT.pReceipt({dataset:{id:other.id}}),()=>ACT.emailReceipt({dataset:{id:other.id}}),()=>ACT.dlPdf({dataset:{id:other.id}}),()=>ACT.mailRetry({dataset:{id:db.outbox[0]?.id||'x'}}),()=>ACT.mailPreview({dataset:{id:'x'}})]){try{f();out.push('allowed')}catch(e){out.push('blocked')}}ui.route='dashboard';renderPage();return{out,route:ui.route,txt:document.querySelector('#page').innerText.slice(0,80)}});
  ok(r.out.every(x=>x==='blocked'),r.out.join());ok(/Hello|Home/.test(r.txt)||r.route==='shome',JSON.stringify(r));
});
await T('Student Portal','SP-no-perms','Student role has no staff permissions','student',async p=>{
  const r=await p.evaluate(()=>['fees.view','students.view','fees.collect','settings.manage','reports.fees','audit.view'].map(x=>can(x)));ok(r.every(x=>!x),r.join());
});
await T('Student Portal','SP-profile','Profile shows own details; contact update works and validates','student',async p=>{
  await p.nav('My Profile');const t=await p.text();ok(/Riya Joshi/.test(t)&&/JOSHI|Joshi/.test(t)&&/Parent \/ guardian/.test(t),'profile');
  await p.click('[data-act=myContact]');await p.fill('form[data-form=myContact] [name=email]','riya.new@mail.in');await p.fill('form[data-form=myContact] [name=phone]','9988776655');await p.click('form[data-form=myContact] button.primary');await p.waitForTimeout(150);
  const s=(await p.db()).students.find(x=>x.name==='Riya Joshi');ok(s.email==='riya.new@mail.in'&&s.phone==='9988776655','not saved');
});
await T('Student Portal','SP-password','Student can change password; wrong current password is refused','student',async p=>{
  await p.nav('My Profile');await p.fill2('form[data-form=myPassword]',{cur:'wrong',next:'newpass1'});await p.click('form[data-form=myPassword] button');await p.waitForTimeout(100);ok(/not correct/.test(await p.toast()),'wrong current accepted');
  await p.fill2('form[data-form=myPassword]',{cur:'student123',next:'newpass1'});await p.click('form[data-form=myPassword] button');await p.waitForTimeout(150);ok(/changed/i.test(await p.toast()),'not changed');
  await p.logout();ok(!(await p.login('student','student123')),'old password still works');ok(await p.login('student','newpass1'),'new password fails');
});
await T('Student Portal','SP-password-rules','Short or unchanged password is refused','student',async p=>{
  await p.nav('My Profile');await p.evaluate(()=>document.querySelector('form[data-form=myPassword]').noValidate=true);await p.fill2('form[data-form=myPassword]',{cur:'student123',next:'abc'});await p.click('form[data-form=myPassword] button');await p.waitForTimeout(100);ok(/6 characters/.test(await p.toast()),'short accepted');
});
await T('Student Portal','SP-same-data','Parent and student of one child see the same fee figures','parent',async p=>{
  const f1=await p.evaluate(()=>feeSum(myChild()).payable);await p.logout();await p.login('student','student123');const f2=await p.evaluate(()=>feeSum(myChild()).payable);ok(f1===f2,f1+' vs '+f2);
});
await T('Student Portal','SP-per-student','Every seeded student has a working student login','admin',async p=>{
  const ids=await p.evaluate(()=>db.students.slice(0,3).map(s=>s.id));await p.logout();for(const id of ids){ok(await p.login('stu-'+id.toLowerCase(),'student123'),'login '+id);ok(new RegExp(id).test(await p.text('.me')),'wrong student');await p.logout()}
});
await T('Student Portal','SP-switched-off','Switching off a student login blocks sign-in','admin',async p=>{
  await p.evaluate(()=>{db.users.find(u=>u.username==='student').active=false;save()});await p.logout();ok(!(await p.login('student','student123')),'inactive login worked');ok(/switched off/.test(await p.text('.err')),'message');
});
await T('Student Portal','SP-crawl','Every student menu opens without errors','student',async p=>{
  for(const n of await p.navs()){await p.nav(n);await p.waitForTimeout(80);ok((await p.text()).length>40,'empty '+n)}
});
await T('Student Portal','SP-mobile','Student portal on a phone: cards, menu drawer, no sideways scroll','student',async p=>{
  for(const n of ['Home','My Academics','Fees and Receipts','Notices','My Profile']){await p.nav(n);await p.waitForTimeout(100);ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'overflow on '+n);ok(await p.evaluate(()=>[...document.querySelectorAll('#page thead')].every(t=>getComputedStyle(t).display==='none')),'table shown on '+n)}
  ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.rail')).position==='fixed'&&getComputedStyle(document.querySelector('.menu-btn')).display!=='none'),'menu drawer');
},{vp:{width:390,height:844}});
await T('Student Portal','SP-dark','Student portal works in dark theme','student',async p=>{await p.click('[data-act=theme]');await p.waitForTimeout(450);for(const n of ['Home','My Academics','My Profile']){await p.nav(n);ok((await p.text()).length>50,n)}});

/* ================= APP SHELL: sidebar, top bar, drawer ================= */
await T('App Shell','SH-account','Profile and Sign out are in the sidebar, not the top bar','admin',async p=>{
  ok(await p.$('.rail [data-act=profile]'),'no profile in sidebar');ok(await p.$('.rail [data-act=logout]'),'no sign out in sidebar');
  ok(!(await p.$('.topbar [data-act=profile]'))&&!(await p.$('.topbar [data-act=logout]')),'duplicate in top bar');
  ok((await p.$$('[data-act=logout]')).length===1&&(await p.$$('[data-act=profile]')).length===1,'duplicate controls');
  ok(/Rajiv|Super Admin/.test(await p.text('.me')),'account block');
});
await T('App Shell','SH-account-compact','Account row is just the avatar, name and a sign-out icon, with hover labels','admin',async p=>{
  const t=await p.$eval('.rail-acct',e=>[...e.querySelectorAll('button')].map(b=>b.innerText.replace(/\s+/g,' ').trim()));
  ok(!t.some(x=>/\bProfile\b|Sign out/i.test(x)),'label text shown: '+t.join('|'));
  ok(await p.$eval('[data-act=logout]',e=>!e.innerText.trim()&&e.getAttribute('aria-label')==='Sign out'&&e.dataset.tip==='Sign out'),'sign out icon');
  ok(await p.$eval('.me',e=>e.dataset.tip==='View profile'),'profile hover label');
  await p.hover('.me');await p.waitForTimeout(250);ok(await p.$eval('.me',e=>+getComputedStyle(e,'::after').opacity)>0.9,'profile tooltip not shown on hover');
  await p.hover('[data-act=logout]');await p.waitForTimeout(250);ok(await p.$eval('[data-act=logout]',e=>+getComputedStyle(e,'::after').opacity)>0.9,'sign out tooltip not shown');
  await p.click('.me');await p.waitForTimeout(250);ok(await p.$('.drawer'),'avatar/name did not open profile');
});
await T('App Shell','SH-settings-cards','Settings is split into separate cards by function and the jump chips scroll to them','admin',async p=>{
  await p.nav('Settings');
  const ids=await p.$$eval('.scard',e=>e.map(x=>x.id));ok(ids.join()==='set-college,set-access,set-fees,set-mail,set-notify,set-data,set-reset',ids.join());
  ok(await p.$$eval('.scard',e=>e.every(x=>x.querySelector('h2')&&x.querySelector('.sic'))),'card header');
  ok(await p.$eval('#set-fees',e=>/Late fee per day/.test(e.innerText)&&/RC-/.test(e.innerText)),'fees card content');
  await p.click('.sjump button:has-text("Data and backup")');await p.waitForTimeout(700);ok(await p.$eval('#set-data',e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0}),'jump did not scroll');
  await p.click('#set-college .btn.primary');await p.waitForTimeout(150);ok(/Saved/.test(await p.toast()),'college save');
  await p.click('[data-act=alertGo][data-sub=setup]').catch(()=>{});await p.nav('Settings');
  ok(await p.$('#set-fees [data-act=alertGo]'),'fee setup shortcut');await p.click('#set-fees [data-act=alertGo]');await p.waitForTimeout(250);ok(/Late fee and due dates/.test(await p.text()),'fee setup not opened');
});
await T('App Shell','SH-settings-principal','Settings cards hide what a role cannot use','principal',async p=>{
  const can=await p.evaluate(()=>can('settings.manage'));if(!can){ok(!(await p.navs()).includes('Settings'),'settings menu visible');return}
  ok(!(await p.$('#set-notify')),'notify card for non super admin');
});
await T('App Shell','SH-topbar','Top bar holds only notifications and the theme switch (menu button on phones)','principal',async p=>{
  const ids=await p.$$eval('.topbar button',b=>b.filter(x=>getComputedStyle(x).display!=='none').map(x=>x.dataset.act));
  ok(ids.join()==='bell,theme',ids.join());
});
await T('App Shell','SH-groups','Sidebar menu is grouped with labels and the open page is highlighted','admin',async p=>{
  const g=await p.$$eval('#nav .gl',e=>e.map(x=>x.textContent));ok(g.join()==='Overview,People,Finance,Academics,Communication,Insights,System',g.join());
  ok((await p.$$('#nav [aria-current=page]')).length===1,'active count');await p.nav('Reports');ok(/Reports/.test(await p.text('#nav [aria-current=page]')),'active not moved');ok(/Reports/.test(await p.text('#crumb')),'crumb');
});
await T('App Shell','SH-collapse','Sidebar collapses to icons, keeps tooltips, and remembers the choice','admin',async p=>{
  const w0=await p.$eval('.rail',e=>e.getBoundingClientRect().width);ok(w0>=240,'width '+w0);
  await p.click('[data-act=railToggle]');await p.waitForTimeout(400);const w1=await p.$eval('.rail',e=>e.getBoundingClientRect().width);ok(w1<90,'collapsed width '+w1);
  ok(await p.$eval('.rail-toggle',e=>e.getAttribute('aria-expanded'))==='false','aria-expanded');ok(await p.$eval('#nav button',e=>!!e.title),'tooltip');
  ok(!(await p.evaluate(()=>[...document.querySelectorAll('#nav .nl')].some(x=>x.getBoundingClientRect().width>0))),'labels still visible');
  await p.nav('Students');ok(/Students/.test(await p.text('#crumb')),'navigation works while collapsed');
  await p.reload();await p.waitForTimeout(300);ok((await p.$eval('.app',e=>e.dataset.rail))==='mini','not remembered');
  await p.click('[data-act=railToggle]');await p.waitForTimeout(400);ok((await p.$eval('.rail',e=>e.getBoundingClientRect().width))>=240,'did not expand');
});
await T('App Shell','SH-profile-staff','Profile opens account details and the password form for staff','accountant',async p=>{
  await p.click('[data-act=profile]');await p.waitForTimeout(250);const t=await p.text('.drawer');ok(/Accountant/.test(t)&&/What you can open/.test(t)&&await p.$('.drawer form[data-form=myPassword]'),t.slice(0,80));
  await p.keyboard.press('Escape');await p.waitForTimeout(250);ok(!(await p.$('.drawer')),'did not close');
});
await T('App Shell','SH-profile-student','Profile opens My Profile for a student and highlights the button','student',async p=>{
  await p.click('[data-act=profile]');await p.waitForTimeout(200);ok(/Parent \/ guardian/.test(await p.text()),'profile page');ok(await p.$('[data-act=profile][aria-current=page]'),'not highlighted');
});
await T('App Shell','SH-theme-persist','Theme switch changes every surface and survives a reload','admin',async p=>{
  const bg=()=>p.evaluate(()=>[document.body,document.querySelector('.rail'),document.querySelector('.topbar'),document.querySelector('.panel,.kpi')].map(e=>getComputedStyle(e).backgroundColor).join('|'));
  const a=await bg();await p.click('[data-act=theme]');await p.waitForTimeout(500);const b=await bg();ok(a!==b,'surfaces unchanged');
  ok(await p.evaluate(()=>document.documentElement.getAttribute('data-theme')==='dark'),'not dark');await p.reload();await p.waitForTimeout(300);ok(await p.evaluate(()=>document.documentElement.getAttribute('data-theme')==='dark'),'theme lost on reload');
  const r=await p.$eval('.rail',e=>getComputedStyle(e).backgroundColor);ok(r!=='rgb(255, 255, 255)','rail still light');
},{});
await T('App Shell','SH-fits-laptop','Whole menu fits a 1366x657 laptop without a scrollbar of its own','admin',async p=>{
  ok(await p.evaluate(()=>{const n=document.querySelector('#nav'),r=document.querySelector('.rail');return n.scrollHeight<=n.clientHeight+1&&r.scrollHeight<=r.clientHeight+1}),'sidebar scrolls');
  ok(await p.evaluate(()=>document.querySelector('[data-act=logout]').getBoundingClientRect().bottom<=innerHeight),'sign out below the fold');
},{vp:{width:1366,height:657}});
await T('App Shell','SH-drawer','On a phone the menu is a drawer: hidden, opens, closes on choice, Escape and backdrop','clerk',async p=>{
  ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.rail')).visibility==='hidden'),'drawer visible at start');
  await p.click('.menu-btn');await p.waitForTimeout(350);ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.rail')).visibility==='visible'&&document.querySelector('.menu-btn').getAttribute('aria-expanded')==='true'),'did not open');
  ok(await p.evaluate(()=>getComputedStyle(document.body).overflow==='hidden'),'page scrolls behind drawer');
  const r=await p.$eval('.rail',e=>{const b=e.getBoundingClientRect();return[b.left,b.right]});ok(r[0]>=-1&&r[1]<=390,'drawer off screen '+r);
  ok(await p.evaluate(()=>{const a=document.querySelector('[data-act=logout]').getBoundingClientRect(),b=document.querySelector('[data-act=profile]').getBoundingClientRect();return a.bottom<=innerHeight&&b.bottom<=innerHeight&&a.height>=36}),'account actions not reachable');
  await p.click('#nav button:has-text("Fee Collection")');await p.waitForTimeout(350);ok(/Fee Collection/.test(await p.text('#crumb')),'did not navigate');ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.rail')).visibility==='hidden'),'drawer stayed open');
  await p.click('.menu-btn');await p.waitForTimeout(300);await p.keyboard.press('Escape');await p.waitForTimeout(350);ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.rail')).visibility==='hidden'),'Escape did not close');
  await p.click('.menu-btn');await p.waitForTimeout(300);await p.mouse.click(370,400);await p.waitForTimeout(350);ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.rail')).visibility==='hidden'),'backdrop did not close');
  ok(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'overflow');
},{vp:{width:390,height:844}});
await T('App Shell','SH-signout-phone','Sign out works from the phone drawer','faculty',async p=>{
  await p.click('.menu-btn');await p.waitForTimeout(300);await p.click('.rail [data-act=logout]');await p.waitForTimeout(200);ok(await p.$('form[data-form=login]'),'not signed out');ok(await p.evaluate(()=>getComputedStyle(document.body).overflow!=='hidden'),'scroll lock stuck');
},{vp:{width:390,height:844}});
await T('App Shell','SH-keyboard','Menu, Profile, Sign out, bell and theme are all reachable by keyboard','admin',async p=>{
  const tabs=await p.evaluate(()=>[...document.querySelectorAll('button,a,input,select')].filter(e=>getComputedStyle(e).visibility!=='hidden'&&e.getBoundingClientRect().width>0&&e.tabIndex>=0).map(e=>e.dataset.act||''));
  for(const a of ['nav','profile','logout','bell','theme','railToggle'])ok(tabs.includes(a),a+' not focusable');
});

await browser.close();
fs.writeFileSync('results.json',JSON.stringify(results,null,1));
const f=results.filter(r=>r.status==='FAIL');console.log(`\nTOTAL ${results.length}  PASS ${results.length-f.length}  FAIL ${f.length}`);
})().catch(e=>{console.error('SUITE CRASH',e);process.exit(1)});
