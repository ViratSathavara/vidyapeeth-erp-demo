/* =====================================================================
   Students (spec §6): list, add / edit form, profile, login + credentials email
   ===================================================================== */
const SEMS=[1,2,3,4];
const fundLabel=f=>f==='SCHOLARSHIP'?'By Scholarship':'By Cash';
const statusLabel={ACTIVE:'Active',LEFT:'Left',PASSED:'Passed'};
const PAGE=25;
function stuFilter(){return ui.f.students=Object.assign({q:'',course:'',sem:'',cat:'',fund:'',status:'ACTIVE',dues:'',sort:'name',dir:1,page:0},ui.f.students||{})}
function studentsFiltered(){
  const f=stuFilter();const q=f.q.trim().toLowerCase();
  let l=vStudents().map(s=>({s,sm:feeSum(s)})).filter(({s,sm})=>(!f.course||s.course===f.course)&&(!f.sem||s.sem===+f.sem)&&(!f.cat||s.category===f.cat)&&(!f.fund||s.funding===f.fund)&&(!f.status||s.status===f.status)
    &&(!f.dues||(f.dues==='yes'?sm.payable>0:sm.payable===0))&&(!q||[s.name,s.enrol,s.phone,s.email].some(v=>String(v).toLowerCase().includes(q))));
  const key={name:x=>x.s.name.toLowerCase(),enrol:x=>x.s.enrol,course:x=>x.s.course+x.s.sem,cat:x=>x.s.category,fund:x=>x.s.funding,due:x=>x.sm.payable,paid:x=>x.sm.paid}[f.sort]||(x=>x.s.name);
  l.sort((a,b)=>{const A=key(a),B=key(b);return(A<B?-1:A>B?1:0)*f.dir});
  return l;
}
const sortTh=(scope,k,label,num)=>{const f=ui.f[scope]||{};const on=f.sort===k;return`<th class="${num?'num':''}" aria-sort="${on?(f.dir>0?'ascending':'descending'):'none'}"><button class="sortb" data-act="sortBy" data-scope="${E(scope)}" data-k="${E(k)}">${E(label)}<span aria-hidden="true">${on?(f.dir>0?' ▲':' ▼'):''}</span></button></th>`};
ACT.sortBy=el=>{const f=ui.f[el.dataset.scope];if(f.sort===el.dataset.k)f.dir=-f.dir;else{f.sort=el.dataset.k;f.dir=['due','paid','amount','date','entry'].includes(el.dataset.k)?-1:1}f.page=0;renderPage()};
const pager=(scope,total)=>{const f=ui.f[scope];const pages=Math.max(1,Math.ceil(total/PAGE));if(pages<2)return'';return`<div class="pager"><button class="btn sm" data-act="pg" data-scope="${E(scope)}" data-d="-1" ${f.page<=0?'disabled':''}>Previous</button><span class="muted">Page ${f.page+1} of ${pages} · ${total} rows</span><button class="btn sm" data-act="pg" data-scope="${E(scope)}" data-d="1" ${f.page>=pages-1?'disabled':''}>Next</button></div>`};
ACT.pg=el=>{ui.f[el.dataset.scope].page+= +el.dataset.d;renderPage();$('#page h1')&&window.scrollTo(0,0)};
CHG.sf=el=>{const f=ui.f[el.dataset.scope];f[el.dataset.k]=el.value;f.page=0;renderPage()};
LIVE.sq=el=>{const f=ui.f[el.dataset.scope];f.q=el.value;f.page=0;clearTimeout(LIVE._t);LIVE._t=setTimeout(()=>{renderPage();const i=$(`[data-live=sq][data-scope="${el.dataset.scope}"]`);if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},200)};
const sel=(scope,k,label,opts)=>{const f=ui.f[scope];return`<select aria-label="${E(label)}" data-change="sf" data-scope="${E(scope)}" data-k="${E(k)}">${opts.map(([v,l])=>`<option value="${E(v)}" ${String(f[k])===String(v)?'selected':''}>${E(l)}</option>`).join('')}</select>`};
const COURSE_OPTS=()=>[['','All courses'],...scopeCourses().map(c=>[c.id,c.name])];
const SEM_OPTS_=()=>[['','All semesters'],...SEMS_ALL().map(n=>[n,'Semester '+n])];
const CAT_OPTS=[['','All categories'],...CATS.map(c=>[c,c])];
const FUND_OPTS=[['','Cash + Scholarship'],['CASH','By Cash'],['SCHOLARSHIP','By Scholarship']];

function viewStudents(){
  const f=stuFilter();const l=studentsFiltered();const page=l.slice(f.page*PAGE,(f.page+1)*PAGE);
  const acts=`${can('students.edit')?`<button class="btn" data-act="importStudents">Import CSV</button>`:''}<button class="btn" data-act="exportStudents">Export Excel</button>${can('students.edit')?'<button class="btn primary" data-act="newStudent">Add student</button>':''}`;
  const act=vStudents().filter(s=>s.status==='ACTIVE');
  return head('Students',`${act.length} active · ${act.filter(s=>s.course==='BED').length} B.Ed · ${act.filter(s=>s.course==='MED').length} M.Ed · ${act.filter(s=>s.funding==='SCHOLARSHIP').length} on scholarship`,acts)+
  `<div class="panel"><div class="filters"><input type="search" placeholder="Search name, enrolment no, phone or email" aria-label="Search students" data-live="sq" data-scope="students" value="${E(f.q)}">
    ${sel('students','course','Course',COURSE_OPTS())}${sel('students','sem','Semester',SEM_OPTS_())}${sel('students','cat','Category',CAT_OPTS)}${sel('students','fund','Funding type',FUND_OPTS)}
    ${sel('students','status','Status',[['','All status'],['ACTIVE','Active'],['LEFT','Left'],['PASSED','Passed']])}${sel('students','dues','Dues',[['','Dues: any'],['yes','Has dues'],['no','No dues']])}
    ${Object.entries(f).some(([k,v])=>!['sort','dir','page','status'].includes(k)&&v)?'<button class="btn sm" data-act="clearF" data-scope="students">Clear</button>':''}</div>
  <div class="tablewrap"><table><thead><tr>${sortTh('students','name','Student')}${sortTh('students','enrol','Enrolment no')}${sortTh('students','course','Course · Sem')}${sortTh('students','cat','Category')}${sortTh('students','fund','Funding')}${sortTh('students','paid','Paid',1)}${sortTh('students','due','Due now',1)}<th>Status</th></tr></thead><tbody>
  ${page.map(({s,sm})=>`<tr class="click" data-act="openStudent" data-id="${E(s.id)}" tabindex="0"><td><div class="who">${avatar(s)}<div><b>${E(s.name)}</b><small class="muted" style="display:block">${E(s.phone)}</small></div></div></td><td class="mono">${E(s.enrol)}</td><td>${E(classLabel(s))}</td><td>${E(s.category)}</td><td>${s.funding==='SCHOLARSHIP'?pill('Scholarship','acc'):pill('Cash')}</td><td class="num amt">${inr(sm.paid)}</td><td class="num amt">${sm.payable?`<b class="${sm.overdue?'t-bad':''}">${inr(sm.payable)}</b>`:'—'}</td><td>${s.status==='ACTIVE'?(sm.payable?(sm.overdue?pill('Overdue','bad'):pill('Due','warn')):pill('Paid up','good')):pill(statusLabel[s.status])}</td></tr>`).join('')||`<tr><td colspan="8" class="empty">No students match these filters.</td></tr>`}
  </tbody></table></div>${pager('students',l.length)}</div>`;
}
ACT.clearF=el=>{const sc=el.dataset.scope;const keep=ui.f[sc];ui.f[sc]={sort:keep.sort,dir:keep.dir,page:0};if(sc==='students')ui.f[sc].status='ACTIVE';renderPage()};
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches&&e.target.matches('tr.click[data-act]')){e.preventDefault();e.target.click()}});
const avatar=s=>s.photo?`<img class="av" src="${E(s.photo)}" alt="">`:`<div class="av" aria-hidden="true">${E(initials(s.name))}</div>`;
ACT.exportStudents=()=>{need('students.view');showCsv('NPCTE students',['Enrolment no','Name','Gender','DOB','Phone','Email','Address','Course','Batch','Semester','Category','Funding','Status','Sem 1 fee','Sem 2 fee','Sem 3 fee','Sem 4 fee','Paid','Due now'],
  studentsFiltered().map(({s,sm})=>[s.enrol,s.name,s.gender,fmtD(s.dob),s.phone,s.email,s.address,course(s.course).name,defaultBatch(s),s.sem,s.category,fundLabel(s.funding),statusLabel[s.status],...SEMS_ALL().map(n=>semFee(s,n)?semFee(s,n).amount/100:''),sm.paid/100,sm.payable/100]))};

/* ---------- add / edit form ---------- */
function studentForm(s){
  const isNew=!s;const T=today();const y=+T.slice(0,4);const st=db.settings;
  const c0=pickedCourse()||myCourses()[0]||'BED';const y0=+T.slice(5,7)>=6?y:y-1;
  const d=s||{name:'',gender:'',dob:'',phone:'',email:'',address:'',course:c0,admissionYear:y0,sem:1,category:'General',funding:'CASH',scholarshipNote:'',status:'ACTIVE',fees:semsOf(c0).map(n=>({sem:n,amount:(st.feeDefault[c0]||[])[n-1]||0,due:defaultDue(c0,y0,n)}))};
  const canEnrol=!isNew&&(cur().role==='Super Admin'||cur().role==='Principal');
  ui.photo=d.photo||'';
  return`<button class="btn x" data-act="close">Close</button><h2>${isNew?'Add student':'Edit '+E(d.name)}</h2>
  <p class="muted" style="margin:4px 0 14px">${isNew?'A login is created automatically and the details are emailed to the student.':'Enrolment no. '+E(d.enrol)}</p>
  <form data-form="${isNew?'addStudent':'editStudent'}" ${isNew?'':`data-id="${E(d.id)}"`} class="grid" style="gap:18px" novalidate>
   <fieldset class="fs"><legend>Personal</legend><div class="form">
    ${F('name','Full name',{val:d.name,req:true,span:1,attrs:'maxlength="80" autocomplete="off"'})}
    ${F('gender','Gender',{val:d.gender,opts:[['','Select'],['F','Female'],['M','Male'],['O','Other']]})}
    ${F('dob','Date of birth',{type:'date',val:d.dob,attrs:`max="${T}"`})}
    ${F('phone','Mobile',{type:'tel',val:d.phone,req:true,attrs:'inputmode="numeric" maxlength="10" pattern="[6-9][0-9]{9}"'})}
    ${F('email','Email',{type:'email',val:d.email,req:true,attrs:'maxlength="120"'})}
    ${F('address','Address',{type:'textarea',val:d.address,span:1,rows:2})}
    <div class="field span"><span class="label">Photo</span><div class="photo-row"><div id="photoPrev">${ui.photo?`<img class="av lg" src="${E(ui.photo)}" alt="">`:`<div class="av lg">${E(initials(d.name||'?'))}</div>`}</div><label class="btn sm"><input type="file" accept="image/*" data-change="photo" class="sr"> Choose photo</label>${ui.photo?'<button type="button" class="btn sm" data-act="photoClear">Remove</button>':''}</div></div>
   </div></fieldset>
   <fieldset class="fs"><legend>Course</legend><div class="form">
    ${F('course','Course',{val:d.course,opts:db.courses.filter(c=>mayCourse(c.id)&&(c.active!==false||c.id===d.course)).map(c=>[c.id,c.name]),req:true,attrs:'data-change="formCourse"'})}
    <div class="field" id="batchWrap">${batchSelect(d.course,d.admissionYear)}</div>
    <div class="field" id="semWrap">${semSelect(d.course,d.sem)}</div>
    ${isNew?'':F('status','Status',{val:d.status,opts:[['ACTIVE','Active'],['LEFT','Left'],['PASSED','Passed']]})}
    ${canEnrol?F('enrol','Enrolment no.',{val:d.enrol,req:true,attrs:'maxlength="20"'}):''}
   </div></fieldset>
   <fieldset class="fs"><legend>Category</legend><div class="form">
    ${F('category','Category',{val:d.category,opts:CATS.map(c=>[c,c]),req:true,attrs:'data-change="formCat"'})}
    <div class="field" id="fundWrap" ${fundingApplies(d.category)?'':'hidden'}><span class="label">Funding type *</span><div class="seg" role="radiogroup" aria-label="Funding type">
     <label><input type="radio" name="funding" value="CASH" ${d.funding!=='SCHOLARSHIP'?'checked':''}> By Cash</label><label><input type="radio" name="funding" value="SCHOLARSHIP" ${d.funding==='SCHOLARSHIP'?'checked':''}> By Scholarship</label></div></div>
    <div class="field span" id="schNote" ${fundingApplies(d.category)&&d.funding==='SCHOLARSHIP'?'':'hidden'}><label class="label" for="f_scholarshipNote">Scholarship note (optional)</label><input id="f_scholarshipNote" name="scholarshipNote" maxlength="120" value="${E(d.scholarshipNote)}" placeholder="e.g. Government post-matric scholarship"></div>
    <p class="note span" style="margin:0">Funding type is only a label for filters and reports. The fee amount and the way it is collected stay the same.</p>
   </div></fieldset>
   <fieldset class="fs"><legend>Tuition fee per semester</legend><div class="semfees" id="semFees">${semFeeFields(d.course,d.fees)}</div>
    <p class="note" id="feeNote">${feeNoteText(d.course)}</p></fieldset>
   <div class="actions sticky-actions"><button class="btn primary big">${isNew?'Save student and create login':'Save changes'}</button><button type="button" class="btn" data-act="close">Cancel</button></div>
  </form>`;
}
/* batch dropdown (value = admission year), semester dropdown and tuition fields follow the chosen course */
function batchSelect(cid,y){const opts=batchOptions(cid).map(b=>[b.slice(0,4),b]);if(y&&!opts.some(o=>+o[0]===+y))opts.push([String(y),batchLabel(cid,y)]);
  return`<label class="label" for="f_admissionYear">Batch *</label><select id="f_admissionYear" name="admissionYear" required data-change="formCourse">${opts.map(([v,l])=>`<option value="${E(v)}" ${+v===+y?'selected':''}>${E(l)}</option>`).join('')}</select>`}
function semSelect(cid,v){return`<label class="label" for="f_sem">Current semester</label><select id="f_sem" name="sem">${semsOf(cid).map(n=>`<option value="${n}" ${+v===n?'selected':''}>Semester ${n}</option>`).join('')}</select>`}
function semFeeFields(cid,fees){return semsOf(cid).map(n=>{const fe=(fees||[]).find(x=>x.sem===n)||{amount:0,due:''};return`<div class="sfe"><b>Semester ${n}</b>
     <label class="label" for="f_fee${n}">Tuition fee (₹)</label><input id="f_fee${n}" name="fee${n}" inputmode="decimal" value="${fe.amount/100}" required data-live="feeEdit">
     <label class="label" for="f_due${n}">Due date</label><input id="f_due${n}" name="due${n}" type="date" value="${E(fe.due||'')}"></div>`}).join('')}
const feeNoteText=cid=>`Pre-filled from the default tuition fee (${inr(((db.settings.feeDefault[cid]||[])[0])||0)} per semester). Change any semester for this student only.`;
ACT.newStudent=()=>{need('students.edit','add students');ui.feeTouched=false;drawer(studentForm(null),true,'Add student');$('#f_name').focus()};
ACT.editStudent=el=>{need('students.edit','edit students');guardStudent(el.dataset.id);const s=stu(el.dataset.id);ui.feeTouched=true;drawer(studentForm(s),true,'Edit student')};
LIVE.feeEdit=()=>{ui.feeTouched=true};
CHG.formCat=el=>{const on=fundingApplies(el.value);$('#fundWrap').hidden=!on;if(!on){const c=$('input[name=funding][value=CASH]');if(c)c.checked=true}$('#schNote').hidden=!(on&&$('input[name=funding][value=SCHOLARSHIP]').checked)};
document.addEventListener('change',e=>{if(e.target.name==='funding')$('#schNote')&&($('#schNote').hidden=e.target.value!=='SCHOLARSHIP')});
CHG.formCourse=el=>{const f=el.form;if(!f)return;const c=f.course.value,y=+f.admissionYear.value;
  if(el.name==='course'){$('#batchWrap').innerHTML=batchSelect(c,y);$('#semWrap').innerHTML=semSelect(c,Math.min(+f.sem.value||1,semsOf(c).length))}
  const isNew=f.dataset.form==='addStudent';const sameLen=semsOf(c).every(n=>f['fee'+n]);
  if(isNew&&!ui.feeTouched||!sameLen){$('#semFees').innerHTML=semFeeFields(c,semsOf(c).map(n=>({sem:n,amount:(db.settings.feeDefault[c]||[])[n-1]||0,due:defaultDue(c,y,n)})));$('#feeNote').textContent=feeNoteText(c)}};
CHG.photo=el=>{const file=el.files&&el.files[0];if(!file)return;if(!/^image\//.test(file.type))throw new Error('Choose an image file');
  const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{const c=document.createElement('canvas'),S=160;const r=Math.max(S/img.width,S/img.height);c.width=c.height=S;const g=c.getContext('2d');g.drawImage(img,(S-img.width*r)/2,(S-img.height*r)/2,img.width*r,img.height*r);ui.photo=c.toDataURL('image/jpeg',.8);URL.revokeObjectURL(url);$('#photoPrev').innerHTML=`<img class="av lg" src="${ui.photo}" alt="">`};img.onerror=()=>toast('Could not read this image',true);img.src=url};
ACT.photoClear=()=>{ui.photo='';$('#photoPrev').innerHTML='<div class="av lg">?</div>'};
const MAIL_OK=/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;
function readStudentForm(f,d,old){
  const name=capText(d.name,'Name');if(name.length<2)throw new Error('Enter the student\'s full name');
  const phone=String(d.phone||'').replace(/\D/g,'');if(!/^[6-9]\d{9}$/.test(phone))throw new Error('Enter a 10-digit mobile number');
  const email=String(d.email||'').trim().toLowerCase();if(!MAIL_OK.test(email))throw new Error('Enter a valid email (login details are sent there)');
  if(db.students.some(s=>s!==old&&s.email.toLowerCase()===email))throw new Error('Another student already uses this email');
  if(!db.courses.some(c=>c.id===d.course)||!mayCourse(d.course))throw new Error('Choose a course you manage');
  const y=+d.admissionYear;if(!(y>=2015&&y<=+today().slice(0,4)+1))throw new Error('Check the admission year');
  if(!CATS.includes(d.category))throw new Error('Choose a category');
  const fundOn=fundingApplies(d.category);if(fundOn&&!['CASH','SCHOLARSHIP'].includes(d.funding))throw new Error('Choose the funding type: By Cash or By Scholarship');
  if(d.dob&&!validIso(d.dob))throw new Error('Check the date of birth');
  if(!semsOf(d.course).includes(+d.sem||1))throw new Error('Choose a valid semester');
  const fees=semsOf(d.course).map(n=>{const a=toPaise(d['fee'+n]);if(!(a>=0)||a>100000000)throw new Error(`Semester ${n} tuition fee must be a number between 0 and 10,00,000`);const due=d['due'+n]||'';if(due&&!validIso(due))throw new Error(`Check the semester ${n} due date`);return{sem:n,amount:a,due}});
  return{name,gender:d.gender||'',dob:d.dob||'',phone,email,address:capText(d.address,'Address',300),photo:ui.photo||'',course:d.course,admissionYear:y,sem:+d.sem||1,category:d.category,funding:fundOn?d.funding:'CASH',scholarshipNote:fundOn&&d.funding==='SCHOLARSHIP'?capText(d.scholarshipNote,'Scholarship note',120):'',fees};
}
FORM.addStudent=(f,d)=>{
  need('students.edit','add students');const v=readStudentForm(f,d,null);
  const s=makeStudent({...v,fees:v.fees.map(x=>x.amount),dues:v.fees.map(x=>x.due),createdBy:cur().name,createdAt:Date.now()});
  db.students.push(s);const pw=tempPassword();createStudentLogin(s,pw,true);
  log('Student added','Student',s.enrol,null,{name:s.name,course:s.course,sem:s.sem,category:s.category,funding:s.funding,fees:s.fees.map(x=>inr(x.amount)).join(' / ')});
  sendCredentials(s,pw,'new');save();closeLayer();renderPage();
  dialog(`<h3>Student added · ${E(s.enrol)}</h3><p class="muted" style="margin:0 0 10px">A login was created and the details were emailed to <b>${E(s.email)}</b>.</p>
   <div class="panel" style="padding:12px"><div class="rline"><span>Login ID</span><b class="mono">${E(s.enrol.toLowerCase())}</b></div><div class="rline"><span>or</span><b class="mono">${E(s.email)}</b></div><div class="rline"><span>Temporary password</span><b class="mono">${E(pw)}</b></div></div>
   <p class="note">Shown here only because this is a demo. In the live system it is only in the email. The student must change it at first login.</p>
   <div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="closeDialog">Close</button><button class="btn primary" data-act="openStudentD" data-id="${E(s.id)}">Open profile</button></div>`,'Student added',true);
};
ACT.openStudentD=el=>{closeDialog();openStudent(el.dataset.id)};
FORM.editStudent=(f,d)=>{
  need('students.edit','edit students');guardStudent(f.dataset.id);const s=stu(f.dataset.id);if(!s)throw new Error('Student not found');const v=readStudentForm(f,d,s);
  const before={name:s.name,phone:s.phone,email:s.email,course:s.course,sem:s.sem,category:s.category,funding:s.funding,status:s.status,fees:s.fees.map(x=>inr(x.amount)).join(' / '),enrol:s.enrol};
  if(d.enrol!==undefined){const en=capText(d.enrol,'Enrolment no.',20).toUpperCase();if(!/^[A-Z0-9-\/]{3,20}$/.test(en))throw new Error('Enrolment no. can use letters, numbers and -');if(db.students.some(x=>x!==s&&x.enrol===en))throw new Error('This enrolment no. is already used');
    if(en!==s.enrol){const u=db.users.find(x=>x.id===s.userId);if(u)u.username=en.toLowerCase();s.enrol=en}}
  if(v.fees.some(x=>{const sm=semSummary(s,x.sem);return x.amount<sm.paid}))throw new Error('A semester fee cannot be lower than what is already paid for it');
  Object.assign(s,v);if(d.status&&statusLabel[d.status])s.status=d.status;
  const u=db.users.find(x=>x.id===s.userId);if(u){u.name=s.name;u.email=s.email;u.phone=s.phone;u.active=s.status==='ACTIVE'||s.status==='PASSED'}
  const after={name:s.name,phone:s.phone,email:s.email,course:s.course,sem:s.sem,category:s.category,funding:s.funding,status:s.status,fees:s.fees.map(x=>inr(x.amount)).join(' / '),enrol:s.enrol};
  const b={},a={};Object.keys(after).forEach(k=>{if(String(before[k])!==String(after[k])){b[k]=before[k];a[k]=after[k]}});
  if(Object.keys(a).length)log('Student edited','Student',s.enrol,b,a);
  save();closeLayer();renderPage();openStudent(s.id);toast('Saved');
};

/* ---------- login details ---------- */
function sendCredentials(s,pw,why){
  const rec=queueMail({kind:'credentials',studentId:s.id,to:[s.email],subject:`Your ${db.college.short} student login`,why,pw});
  s.cred={status:rec.status,at:Date.now(),to:s.email,mailId:rec.id};
  notify('credentials',why==='new'?'Welcome to the NPCTE student portal':'Your login details were sent again',`Check ${s.email} for your login ID and temporary password.`,{students:[s.id],portal:'sprofile',self:true});
}
ACT.resendCred=el=>{need('students.edit','resend logins');const s=stu(el.dataset.id);const u=db.users.find(x=>x.id===s.userId);const pw=tempPassword();u.password=pw;u.mustChange=true;
  log('Login details resent','Student',s.enrol,null,null,'New temporary password emailed');sendCredentials(s,pw,'resend');save();openStudent(s.id);toast('New temporary password emailed to '+s.email)};
ACT.resetPw=el=>{need('students.edit','reset passwords');const s=stu(el.dataset.id);confirmBox('Reset password',`${s.name} gets a new temporary password by email and must change it at the next sign-in.`,'Reset password',()=>ACT.resendCred(el))};

/* ---------- profile ---------- */
function semCards(s,o={}){
  return`<div class="semcards">${feeSum(s).sems.map(m=>{const pct=m.amount?Math.round((m.paid+m.adj)/m.amount*100):100;const tone=m.status==='Paid'?'good':m.overdue?'bad':m.started&&m.due?'warn':'';
    return`<div class="semcard ${tone}"><div class="sc-h"><b>Semester ${m.sem}</b>${pill(m.overdue?'Overdue':m.status,tone)}</div>
    <div class="sc-r"><span>Fee</span><b>${inr(m.amount)}</b></div><div class="sc-r"><span>Paid</span><b>${inr(m.paid)}</b></div>${m.adj?`<div class="sc-r"><span>Expense adj.</span><b>${inr(m.adj)}</b></div>`:''}<div class="sc-r"><span>Due</span><b class="${m.due?'t-'+(m.overdue?'bad':'warn'):''}">${inr(m.due)}</b></div>
    <div class="bar ${m.overdue?'bad':''}"><i style="width:${Math.min(100,pct)}%"></i></div><small class="muted">${m.dueDate?'Due date '+fmtD(m.dueDate):'No due date'}</small>
    ${o.collect&&m.due>0&&can('fees.collect')&&s.status==='ACTIVE'?`<button class="btn sm primary" data-act="collectFor" data-id="${E(s.id)}" data-sem="${m.sem}">Collect</button>`:''}
    ${o.pay&&m.due>0&&m.started?`<button class="btn primary" data-act="payNow" data-sem="${m.sem}">Pay ${inr(m.due)} with UPI</button>`:''}</div>`}).join('')}</div>`;
}
function openStudent(id){
  if(!mayStudent(id))throw new Error('403 · Not allowed');const s=stu(id);if(!s)throw new Error('Student not found');const sm=feeSum(s);
  const pays=db.payments.filter(p=>p.studentId===s.id).sort((a,b)=>b.entryAt-a.entryAt);
  const notes=db.notices.filter(n=>audienceStudents(n.audience).some(x=>x.id===s.id)&&n.publishAt<=Date.now()).sort((a,b)=>b.publishAt-a.publishAt);
  const trail=db.audit.filter(a=>a.entityId===s.enrol||pays.some(p=>p.rc===a.entityId)).slice(0,30);
  const u=db.users.find(x=>x.id===s.userId);const L=(k,v)=>`<div><span class="label">${E(k)}</span><b>${E(v||'—')}</b></div>`;
  const mail=s.cred?(db.outbox.find(o=>o.id===s.cred.mailId)||s.cred):null;
  drawer(`<button class="btn x" data-act="close">Close</button>
   <div class="who" style="margin:4px 0 6px">${s.photo?`<img class="av lg" src="${E(s.photo)}" alt="">`:`<div class="av lg">${E(initials(s.name))}</div>`}<div><h2 style="margin:0">${E(s.name)}</h2><small class="muted">${E(s.enrol)} · ${E(classLabel(s))} · ${E(statusLabel[s.status])}</small></div></div>
   <div class="actions" style="margin:12px 0">${can('fees.collect')&&sm.payable>0?`<button class="btn primary" data-act="collectFor" data-id="${E(s.id)}">Collect fee</button>`:''}${can('notices.post')&&sm.payable>0?`<button class="btn" data-act="remindOne" data-id="${E(s.id)}">Send fee message</button>`:''}${can('students.edit')?`<button class="btn" data-act="editStudent" data-id="${E(s.id)}">Edit</button>`:''}</div>
   <div class="facts">${L('Mobile',s.phone)}${L('Email',s.email)}${L('Gender',{F:'Female',M:'Male',O:'Other'}[s.gender])}${L('Date of birth',fmtD(s.dob))}${L('Category',s.category)}${L('Funding',fundLabel(s.funding)+(s.scholarshipNote?' · '+s.scholarshipNote:''))}${L('Admission year',s.admissionYear)}${L('Address',s.address)}</div>
   <h3>Semester fees ${pill('Due now '+inr(sm.payable),sm.payable?(sm.overdue?'bad':'warn'):'good')}</h3>${semCards(s,{collect:true})}
   <h3>Payments and receipts</h3><div class="tablewrap"><table><thead><tr><th>Receipt</th><th>Invoice date</th><th>Sem</th><th>Mode</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>
   ${pays.map(p=>`<tr><td class="mono">${E(p.rc)}</td><td>${fmtD(p.invoiceDate)}</td><td>${p.sem}</td><td>${modePill(p.mode)}</td><td class="num amt">${inr(p.amount)}</td><td>${payPill(p.status)}</td><td><button class="btn sm" data-act="viewReceipt" data-id="${E(p.id)}">Receipt</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">No payments yet.</td></tr>'}</tbody></table></div>
   <h3>Login</h3><div class="panel" style="padding:12px"><div class="rline"><span>Login ID</span><b class="mono">${E(u?u.username:'—')} · ${E(s.email)}</b></div>
    <div class="rline"><span>Credentials email</span><span>${mail?mailPill(mail.status)+' <small class="muted">'+E(fmtT(mail.sentAt||mail.at||mail.ts))+'</small>':pill('Not sent','warn')}</span></div>
    <div class="rline"><span>Last sign-in</span><span>${u&&u.lastLoginAt?E(fmtT(u.lastLoginAt)):'Never'}${u&&u.mustChange?' · '+pill('Must change password','warn'):''}</span></div>
    ${can('students.edit')?`<div class="actions" style="margin-top:8px"><button class="btn sm" data-act="resendCred" data-id="${E(s.id)}">Resend credentials</button><button class="btn sm" data-act="resetPw" data-id="${E(s.id)}">Reset password</button></div>`:''}</div>
   <h3>Notices sent to this student</h3><div class="list">${notes.slice(0,8).map(n=>`<div class="li"><div><b>${E(n.title)}</b><small>${fmtT(n.publishAt)} · ${E(audienceLabel(n.audience))}</small></div>${n.isFeeAlert?pill('Fee alert','warn'):''}</div>`).join('')||'<p class="note">No notices yet.</p>'}</div>
   ${can('activity.view')?`<h3>Audit trail</h3><div class="list">${trail.map(a=>`<div class="li"><div><b>${E(a.action)}</b><small>${E(fmtT(a.at))} · ${E(a.actor)} (${E(a.role)})${a.after?' · '+E(diffText(a.before,a.after)):''}</small></div></div>`).join('')||'<p class="note">Nothing yet.</p>'}</div>`:''}`,true,s.name);
}
ACT.openStudent=el=>openStudent(el.dataset.id);
const diffText=(b,a)=>{if(!a)return'';return Object.keys(a).map(k=>`${k}: ${b&&b[k]!==undefined?b[k]+' → ':''}${a[k]}`).join(', ').slice(0,220)};

/* ---------- CSV import (spec §15.6: a template for students only) ---------- */
const IMPORT_COLS=['name','gender','dob','phone','email','address','course','admissionYear','sem','category','funding','fee1','fee2','fee3','fee4'];
ACT.importStudents=()=>{need('students.edit');drawer(`<button class="btn x" data-act="close">Close</button><h2>Import students from CSV</h2>
  <p class="muted">Save your Excel sheet as CSV with these columns (first row = headings). Dates as YYYY-MM-DD, course code (e.g. BED or MED), funding CASH or SCHOLARSHIP, fees in rupees (blank = default). Each imported student gets a login and an email.</p>
  <div class="actions" style="margin:10px 0"><button class="btn" data-act="importTpl">Download template</button><label class="btn"><input type="file" accept=".csv,text/csv" class="sr" data-change="importFile"> Choose CSV file</label></div>
  <div id="importOut"></div>`,true)};
ACT.importTpl=()=>download('npcte-student-import-template.csv','﻿'+csvOf(IMPORT_COLS,[['Riya Patel','F','2003-04-15','9876543210','riya.patel@example.com','Mahesana','BED',today().slice(0,4),'1','SC','SCHOLARSHIP','30000','30000','30000','30000']]),'text/csv;charset=utf-8');
function parseCsv(t){const rows=[];let r=[],v='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'&&t[i+1]==='"'){v+='"';i++}else if(c==='"')q=false;else v+=c}else if(c==='"')q=true;else if(c===','){r.push(v);v=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;r.push(v);rows.push(r);r=[];v=''}else v+=c}if(v||r.length){r.push(v);rows.push(r)}return rows.filter(x=>x.some(y=>y.trim()))}
CHG.importFile=el=>{const file=el.files&&el.files[0];if(!file)return;file.text().then(t=>{
  const rows=parseCsv(t.replace(/^﻿/,''));const hd=rows.shift().map(h=>h.trim());const miss=['name','phone','email','course','admissionYear','category'].filter(c=>!hd.includes(c));
  if(miss.length){$('#importOut').innerHTML=`<div class="err">Missing columns: ${E(miss.join(', '))}</div>`;return}
  const ok=[],bad=[];rows.forEach((r,i)=>{const d={};hd.forEach((h,j)=>d[h]=(r[j]||'').trim());d.course=(d.course||'').toUpperCase();d.funding=(d.funding||'CASH').toUpperCase();d.sem=d.sem||1;
    (course(d.course)?semsOf(d.course):SEMS).forEach(n=>{d['fee'+n]=d['fee'+n]||String(db.settings.feeDefault[d.course]?db.settings.feeDefault[d.course][n-1]/100:'');d['due'+n]=''});
    try{ui.photo='';const v=readStudentForm(null,d,null);if(ok.some(x=>x.email===v.email))throw new Error('Email repeated in the file');ok.push(v)}catch(e){bad.push(`Row ${i+2}: ${e.message}`)}});
  ui.importRows=ok;$('#importOut').innerHTML=`<div class="panel" style="padding:12px"><p style="margin:0"><b>${ok.length}</b> ready to import${bad.length?`, <b class="t-bad">${bad.length}</b> with problems`:''}.</p>${bad.length?`<ul class="note">${bad.slice(0,20).map(b=>`<li>${E(b)}</li>`).join('')}</ul>`:''}
   ${ok.length?`<button class="btn primary" style="margin-top:10px" data-act="importGo">Import ${ok.length} students</button>`:''}</div>`}).catch(()=>toast('Could not read the file',true))};
ACT.importGo=()=>{need('students.edit');const l=ui.importRows||[];l.forEach(v=>{v.dues=semsOf(v.course).map(n=>defaultDue(v.course,v.admissionYear,n));const s=makeStudent({...v,fees:v.fees.map(x=>x.amount),createdBy:cur().name});db.students.push(s);const pw=tempPassword();createStudentLogin(s,pw,true);sendCredentials(s,pw,'new')});
  log('Students imported','Student','',null,{count:l.length});ui.importRows=null;save();closeLayer();renderPage();toast(`${l.length} students imported. Login emails are on their way.`)};
