/* =====================================================================
   Students: list, admission, profile, edit, promotion, import
   ===================================================================== */
function visibleStudents(){const u=cur();let l=db.students;if(u.role==='Faculty'){const ds=myDivisions().map(d=>d.id);l=l.filter(s=>ds.includes(s.div))}return l}
function studentsFiltered(){const f=ui.f.students||{};return visibleStudents().filter(s=>(!f.q||(s.name+' '+s.id+' '+s.phone).toLowerCase().includes(f.q.toLowerCase()))&&(!f.course||s.course===f.course)&&(!f.sem||String(s.sem)===f.sem)&&(!f.div||s.div===f.div)&&(!f.status||admStatus(s)===f.status)&&(!f.fee||feeSum(s).status===f.fee))}
function studentRows(){
  const list=studentsFiltered();const showFee=can('fees.view');
  return list.map(s=>{const sm=feeSum(s);return`<tr class="click" data-act="openStudent" data-id="${E(s.id)}"><td class="mono">${E(s.id)}</td><td><div class="who"><div class="av">${E(initials(s.name))}</div><div>${E(s.name)}<br><small class="muted">${E(s.phone)}</small></div></div></td><td>${E(classLabel(s))}</td><td>${E(batchOf(s.batch).name)}</td>
   ${showFee?`<td><div class="bar ${sm.overdue&&sm.status!=='Paid'?'warn':''}"><i style="width:${Math.min(100,sm.total?s.fee.paid/sm.total*100:100)}%"></i></div><small class="muted">${inr(s.fee.paid)} of ${inr(sm.total)}</small></td><td>${feePill(sm)}</td>`:''}
   <td>${(()=>{const a=admStatus(s);return pill(a,a==='Active'?'good':a==='Provisional'?'warn':'')})()}</td></tr>`}).join('')||`<tr><td colspan="7" class="empty">No students match these filters.</td></tr>`;
}
function viewStudents(){
  const f=ui.f.students=ui.f.students||{q:'',course:'',sem:'',div:'',status:'',fee:''};const sub=ui.tab.students||'list';
  const tabs=[['list','Student list']].concat(can('students.promote')?[['promo','Semester promotion']]:[]);
  const acts=(can('students.edit')?'<button class="btn" data-act="importStudents">Import from CSV</button><button class="btn primary" data-act="newAdmission">+ New admission</button>':'')+'<button class="btn" data-act="exportStudents">Copy list as CSV</button>';
  if(sub==='promo'&&can('students.promote'))return head('Students','Move a whole class to the next semester. Students with dues are held back for review.')+tabsBar('students',tabs,sub)+viewPromotion();
  const showFee=can('fees.view');
  return head('Students',`${visibleStudents().length} students on record`,acts)+(tabs.length>1?tabsBar('students',tabs,sub):'')+
  `<div class="filters"><input type="search" placeholder="Search name, enrolment no. or mobile" value="${E(f.q)}" aria-label="Search students" data-live="stuFilter" data-k="q">
   <select aria-label="Course" data-change="stuFilter" data-k="course"><option value="">All courses</option>${db.courses.map(c=>`<option value="${E(c.id)}" ${f.course===c.id?'selected':''}>${E(c.name)}</option>`).join('')}</select>
   <select aria-label="Semester" data-change="stuFilter" data-k="sem"><option value="">All semesters</option>${[1,2,3,4].map(n=>`<option value="${E(n)}" ${f.sem==n?'selected':''}>Semester ${n}</option>`).join('')}</select>
   <select aria-label="Division" data-change="stuFilter" data-k="div"><option value="">All divisions</option>${db.divisions.map(d=>`<option value="${E(d.id)}" ${f.div===d.id?'selected':''}>${E(course(d.course).name)} ${E(batchOf(d.batch).name)} · ${E(d.name)}</option>`).join('')}</select>
   <select aria-label="Admission status" data-change="stuFilter" data-k="status"><option value="">Any admission status</option>${['Active','Provisional','Alumni','Left'].map(x=>`<option ${f.status===x?'selected':''}>${x}</option>`).join('')}</select>
   ${showFee?`<select aria-label="Fee status" data-change="stuFilter" data-k="fee"><option value="">Any fee status</option>${['Paid','Partial','Not paid'].map(x=>`<option ${f.fee===x?'selected':''}>${x}</option>`).join('')}</select>`:''}</div>
  <div class="panel" style="padding:6px 8px"><div class="tablewrap"><table><thead><tr><th>Enrolment</th><th>Student</th><th>Class</th><th>Batch</th>${showFee?'<th>Fee progress</th><th>Fee</th>':''}<th>Admission</th></tr></thead><tbody id="stuRows">${studentRows()}</tbody></table></div></div><p class="note">Select a student to open the profile.</p>`;
}
LIVE.stuFilter=el=>{ui.f.students[el.dataset.k]=el.value;$('#stuRows').innerHTML=studentRows()};
CHG.stuFilter=el=>{ui.f.students[el.dataset.k]=el.value;renderPage()};
ACT.exportStudents=()=>{need('students.view','the student list');const l=studentsFiltered();showCsv('Students (CSV)',['Enrolment','Name','Course','Semester','Division','Batch','Mobile','Guardian','Guardian mobile','Admission status'],l.map(s=>[s.id,s.name,course(s.course).name,s.sem,divOf(s.div)?.name,batchOf(s.batch).name,s.phone,s.guardian.name,s.guardian.phone,admStatus(s)]))};

/* ---------- admission ---------- */
const STEPS=['Personal','Contact and guardian','Academic','Course and fee plan','Documents'];
const CONC_OPTS=[['none','None'],['mgmt5000','Management concession ₹5,000'],['mgmt10000','Management concession ₹10,000'],['gov','Government scholarship (tuition reimbursed)']];
const batchOpts=cid=>db.batches.filter(b=>b.course===cid).map(b=>[b.id,b.name]);
const seatsLeft=d=>Math.max(0,d.capacity-db.students.filter(s=>s.div===d.id&&s.status==='Active').length);
const divOpts=(cid,bid)=>db.divisions.filter(d=>d.course===cid&&d.batch===bid).map(d=>[d.id,'Division '+d.name+' ('+seatsLeft(d)+' seats left)']);
ACT.newAdmission=()=>{if(!can('students.edit'))return toast('You do not have access to admissions',true);admissionForm()};
function concFromKey(k){return k==='gov'?{type:'gov',amount:0}:k==='mgmt5000'?{type:'mgmt',amount:5000}:k==='mgmt10000'?{type:'mgmt',amount:10000}:{type:'none',amount:0}}
function admissionForm(){
  const c0=db.courses[0].id,b0=db.batches.filter(b=>b.course===c0).slice(-1)[0].id;const canConc=can('fees.concession.request')||can('fees.concession.approve');
  drawer(`<button class="btn x" data-act="close">Close</button><h2>New admission</h2><p class="note">Enrolment number and the parent and student logins are created when you confirm.</p>
  <div class="steps" id="adSteps" style="margin:12px 0"></div>
  <form id="adm" data-form="admit" novalidate>
   <div class="form admstep">${F('name','Full name (as per marksheet)',{req:1,span:1,ph:'Full name',attrs:`maxlength="${NAME_MAX}"`})}${F('dob','Date of birth',{type:'date',req:1})}${F('gender','Gender',{opts:['Female','Male','Other']})}
    ${F('category','Category',{opts:['General','OBC (SEBC)','SC','ST','EWS']})}${F('blood','Blood group',{opts:['','A+','B+','O+','AB+','A-','B-','O-','AB-']})}${F('nationality','Nationality',{val:'Indian'})}${F('aadhaar','Aadhaar number',{req:1,ph:'12 digits',attrs:'pattern="[0-9 ]{12,14}" title="12 digit Aadhaar number"'})}</div>
   <div class="form admstep">${F('phone','Student mobile',{req:1,ph:'10 digits',attrs:'pattern="[0-9 ]{10,12}" title="10 digit mobile number"'})}${F('whatsapp','WhatsApp number (receipts)',{ph:'Same as mobile if blank'})}${F('email','Email',{type:'email',span:1})}
    ${F('address','Permanent address',{span:1,req:1})}${F('city','City',{val:db.settings.city})}${F('pin','Pincode',{attrs:'pattern="[0-9]{6}" title="6 digit pincode"'})}
    ${F('gname','Father / guardian name',{req:1,attrs:`maxlength="${NAME_MAX}"`})}${F('gocc','Guardian occupation')}${F('gphone','Guardian mobile',{req:1,attrs:'pattern="[0-9 ]{10,12}" title="10 digit mobile number"'})}${F('gemail','Guardian email (fee receipts)',{type:'email',ph:'parent@example.com'})}${F('ginc','Annual family income',{opts:['Below ₹1 lakh','₹1–3 lakh','₹3–6 lakh','Above ₹6 lakh'],val:'₹1–3 lakh'})}</div>
   <div class="form admstep">${F('degree','Graduation degree',{opts:['B.Sc','B.A.','B.Com','B.C.A.','B.Ed','M.A.','M.Sc','M.Com']})}${F('university','University',{val:'Gujarat University'})}${F('year','Passing year',{val:String(new Date().getFullYear()-1)})}${F('pct','Graduation %',{type:'number',attrs:'min="0" max="100" step="0.01"'})}
    ${F('pgPct','B.Ed % (M.Ed applicants only)',{type:'number',attrs:'min="0" max="100" step="0.01"'})}${F('rank','Entrance score / merit rank')}${F('sub1','Teaching subject 1',{opts:['Science','Mathematics','English','Gujarati','Social Science','Hindi','Sanskrit']})}${F('sub2','Teaching subject 2',{opts:['Mathematics','Science','English','Gujarati','Social Science','Hindi','Sanskrit']})}</div>
   <div class="form admstep">${F('course','Course',{opts:db.courses.map(c=>[c.id,c.name]),val:c0,attrs:'data-change="admCourse"'})}${F('batch','Batch',{opts:batchOpts(c0),val:b0,attrs:'data-change="admCourse"'})}
    ${F('div','Division',{opts:divOpts(c0,b0)})}${F('conc','Concession / scholarship',{opts:canConc?CONC_OPTS:[['none','None']],attrs:'data-change="admSum"'})}${F('planName','Fee payment plan',{opts:db.plans.map(p=>p.name),val:db.plans[1].name,span:1,attrs:'data-change="admSum"'})}
    <div class="panel span" style="padding:14px;background:var(--bg)"><h2 style="margin-bottom:8px">Fee summary</h2><div id="fsum"></div></div></div>
   <div class="admstep"><p class="note" style="margin:0 0 8px">Tick what the student has submitted. Admission stays <b>Provisional</b> until every required document is verified.</p>
    <div class="list">${DOCS.map(d=>`<label class="li" style="cursor:pointer"><span><input type="checkbox" name="${E(d[0])}" value="1"> ${E(d[1])}</span>${pill(d[2]?'Required':'If applicable',d[2]?'bad':'')}</label>`).join('')}</div></div>
   <div class="actions" style="margin-top:18px"><button type="button" class="btn" data-act="admBack">Back</button><span style="flex:1"></span><button type="button" class="btn primary" data-act="admNext">Next</button><button class="btn gold" id="adOk">Confirm admission</button></div>
  </form>`);
  ui.admStep=0;admShow();
}
function admShow(){
  const secs=$$('.admstep');secs.forEach((s,i)=>s.classList.toggle('hide',i!==ui.admStep));
  $('#adSteps').innerHTML=STEPS.map((t,i)=>`<span class="pill ${i===ui.admStep?'cur':''}">${i+1}. ${E(t)}</span>`).join('');
  $('[data-act=admBack]').classList.toggle('hide',ui.admStep===0);$('[data-act=admNext]').classList.toggle('hide',ui.admStep===STEPS.length-1);$('#adOk').classList.toggle('hide',ui.admStep!==STEPS.length-1);
  if(ui.admStep===3)admSummary();$('.drawer').scrollTop=0;
}
ACT.admNext=()=>{const secs=$$('.admstep');const bad=$$('input,select',secs[ui.admStep]).find(i=>!i.checkValidity());if(bad){bad.reportValidity();return}ui.admStep++;admShow()};
ACT.admBack=()=>{ui.admStep--;admShow()};
CHG.admCourse=el=>{const c=$('#f_course').value;if(el.name==='course'){$('#f_batch').innerHTML=batchOpts(c).map((o,i,a)=>`<option value="${E(o[0])}" ${i===a.length-1?'selected':''}>${E(o[1])}</option>`).join('')}
  $('#f_div').innerHTML=divOpts(c,$('#f_batch').value).map(o=>`<option value="${E(o[0])}">${E(o[1])}</option>`).join('')||'<option value="">No division yet</option>';admSummary()};
CHG.admSum=()=>admSummary();
function admSummary(){
  const c=$('#f_course').value,k=$('#f_conc').value;const conc={...concFromKey(k),status:'approved'};
  const gross=newFee({sem:1,courseId:c,planName:$('#f_planName').value,start:today()});const net=newFee({sem:1,courseId:c,planName:$('#f_planName').value,start:today(),concession:conc});
  const willPend=k!=='none'&&!can('fees.concession.approve');const f=willPend?gross:net;
  $('#fsum').innerHTML=gross.heads.map(h=>`<div class="rline"><span>${E(h.name)}</span><span>${inr(h.amount)}</span></div>`).join('')+
   `<div class="rline tot"><span>Semester fee</span><span>${inr(gross.total)}</span></div>`+(k!=='none'?`<div class="rline"><span>${E(CONC_OPTS.find(o=>o[0]===k)[1])}</span><span style="color:var(--good)">− ${inr(gross.total-net.total)}</span></div>`:'')+
   `<div class="rline tot"><span>Payable by the student</span><span>${inr(f.total)}</span></div>`+f.plan.map(p=>`<div class="rline"><span>${E(p.label)} · due ${fmtD(p.due)}</span><span>${inr(p.amt)}</span></div>`).join('')+
   (willPend?`<p class="note">${pill('Needs Principal approval','warn')} Full fee applies until the concession is approved. After approval the payable amount becomes ${inr(net.total)}.</p>`:'');
}
/* Enter inside the admission wizard never submits it before the last step: it moves to the next step, which checks that step's fields. On the last step Enter on a tick box does nothing (Space ticks it). */
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.defaultPrevented||e.isComposing)return;const t=e.target;if(!t||!t.closest||!t.closest('form#adm')||t.tagName!=='INPUT')return;
  if(ui.admStep<STEPS.length-1){e.preventDefault();safe(ACT.admNext)}else if(t.type==='checkbox')e.preventDefault();
});
FORM.admit=(f,d)=>{
  if(!can('students.edit'))throw new Error('You do not have access to admissions');
  /* the same fields the wizard asks for are required here too: the form is submitted without the browser's own checks */
  const need_=[['name','the full name'],['dob','the date of birth'],['aadhaar','the Aadhaar number'],['phone','the student mobile number'],['address','the address'],['gname','the guardian name'],['gphone','the guardian mobile number']];
  for(const[k,w] of need_)if(!String(d[k]??'').trim())throw new Error('Enter '+w+' before confirming the admission');
  d.name=capText(d.name,'The student name');d.gname=capText(d.gname,'The guardian name');
  if(!d.div)throw new Error('Create a division for this batch in Academic Setup first');
  if(seatsLeft(divOf(d.div))<=0)throw new Error('Division '+divOf(d.div).name+' is full. Choose another division or raise its seats in Academic Setup.');
  if(db.students.some(s=>s.name.toLowerCase()===d.name.trim().toLowerCase()&&s.phone.replace(/\s/g,'')===d.phone.replace(/\s/g,'')))throw new Error('A student with this name and mobile already exists');
  const k=d.conc||'none';const cc=concFromKey(k);const u=cur();
  const conc=k==='none'?undefined:{...cc,status:can('fees.concession.approve')?'approved':'pending',requestedBy:u.name,approvedBy:can('fees.concession.approve')?u.name:''};
  const docs={};DOCS.forEach(x=>docs[x[0]]=!!d[x[0]]);
  const s=makeStudent({...d,name:d.name,docs,concession:conc,start:today(),sem:1});
  if(!s.whatsapp.trim())s.whatsapp=s.phone;
  db.students.unshift(s);
  ensureUsers(s);const pu=db.users.find(u=>u.role==='Parent'&&u.studentId===s.id),su=db.users.find(u=>u.role==='Student'&&u.studentId===s.id);
  log('Admission',`${s.name} (${s.id}) admitted to ${course(s.course).name}`);
  notify('admission',`New admission · ${s.name}`,`${s.id} · ${course(s.course).name} · fee ${inr(s.fee.total)}`,{sid:s.id,tone:'good',go:{staff:['students']},open:'student',p:{t:`Welcome to ${db.settings.short||db.settings.college}`,x:`${s.name} is admitted to ${course(s.course).name}. Your fee plan is ready under Fees and Receipts.`}});
  if(s.fee.concession&&s.fee.concession.status==='pending')notify('conc_req',`Concession to decide · ${s.name}`,`Requested by ${cur().name} at admission.`,{sid:s.id,tone:'warn',go:{staff:['fees','approvals']},open:'student'});
  save();
  const sm=feeSum(s);
  $('.drawer').innerHTML=`<button class="btn x" data-act="close">Close</button>${pill('Admission saved','good')}<h2 style="margin-top:8px">${E(s.name)}</h2>
   <div class="facts"><div><span class="label">Enrolment no.</span><b class="mono">${E(s.id)}</b></div><div><span class="label">Class</span><b>${E(classLabel(s))}</b></div><div><span class="label">Fee payable</span><b>${inr(sm.total)}</b></div><div><span class="label">Documents</span><b>${docsMissing(s)?docsMissing(s)+' required pending':'All received'}</b></div></div>
   ${s.fee.concession.status==='pending'?`<p class="hl">Concession request sent to the Principal for approval.</p>`:''}
   <div class="panel" style="padding:14px"><h2>Portal logins created</h2><div class="rline"><span>Parent username</span><b class="mono">${E(pu.username)}</b></div><div class="rline"><span>Parent password</span><b class="mono">${E(pu.password)}</b></div><div class="rline"><span>Student username</span><b class="mono">${E(su.username)}</b></div><div class="rline"><span>Student password</span><b class="mono">${E(su.password)}</b></div><p class="note">Both can sign in to see fees, pay online and get receipts by email${s.guardian.email||s.email?'':'. Add an email address so receipts can be sent'}.</p></div>
   <div class="actions" style="margin-top:14px">${can('fees.collect')?`<button class="btn primary" data-act="collectFor" data-id="${E(s.id)}">Collect ${E(sm.nextInst?sm.nextInst.label.toLowerCase():'fee')} · ${inr(sm.suggest)}</button>`:''}<button class="btn" data-act="openStudent" data-id="${E(s.id)}">Open profile</button></div>`;
  if(ui.route==='students')renderPage();else renderNav();
};
ACT.collectFor=el=>{need('fees.collect','collect fees');ui.pre=el.dataset.id;ui.tab.fees='collect';closeLayer();go('fees')};

/* ---------- profile ---------- */
ACT.openStudent=el=>{if(!mayStudent(el.dataset.id))throw new Error('Student not found');openStudent(el.dataset.id)};
function openStudent(id){
  const s=stu(id);if(!s)return;const sm=feeSum(s);const showFee=can('fees.view');const att=attPct(s);const sch=db.practice.find(p=>p.studentId===s.id);
  const conc=s.fee.concession;const adm=admStatus(s);
  drawer(`<button class="btn x" data-act="close">Close</button><span class="mono muted">${E(s.id)}</span><h2>${E(s.name)}</h2>
  <p style="margin:6px 0 0;display:flex;gap:6px;flex-wrap:wrap">${pill(adm,adm==='Active'?'good':adm==='Provisional'?'warn':'')}${showFee&&s.status==='Active'?feePill(sm):''}${att!==null?pill('Attendance '+att+'%',att<75?'bad':'acc'):''}</p>
  <div class="facts"><div><span class="label">Class</span><b>${E(classLabel(s))}</b></div><div><span class="label">Batch</span><b>${E(batchOf(s.batch).name)}</b></div><div><span class="label">Mobile</span><b>${E(s.phone)}</b></div><div><span class="label">WhatsApp</span><b>${E(s.whatsapp)}</b></div>
   <div><span class="label">Date of birth</span><b>${fmtD(s.dob)}</b></div><div><span class="label">Category</span><b>${E(s.category)}</b></div><div><span class="label">Guardian</span><b>${E(s.guardian.name)}<br><small class="muted">${E(s.guardian.phone)}</small></b></div><div><span class="label">Email</span><b>${E(s.email||'—')}</b></div>
   <div style="grid-column:1/-1"><span class="label">Address</span><b>${E(s.address)}, ${E(s.city)} ${E(s.pin)}</b></div>
   <div><span class="label">Graduation</span><b>${E(s.academic.degree)} ${E(s.academic.pct)}% · ${E(s.academic.year)}</b></div><div><span class="label">Teaching subjects</span><b>${E(s.academic.sub1)}, ${E(s.academic.sub2)}</b></div>
   ${sch?`<div style="grid-column:1/-1"><span class="label">Practice school</span><b>${E(db.schools.find(x=>x.id===sch.schoolId)?.name||'-')} · ${E(sch.phase)}</b></div>`:''}</div>
  <div class="actions">${can('students.edit')?`<button class="btn" data-act="editStudent" data-id="${E(s.id)}">Edit details</button>`:''}${can('fees.collect')&&s.status==='Active'&&sm.payable>0?`<button class="btn primary" data-act="collectFor" data-id="${E(s.id)}">Collect fee</button>`:''}<button class="btn" data-act="certificate" data-id="${E(s.id)}">Certificates</button></div>
  ${showFee?`<h3 style="margin-top:20px">Fee ledger · Semester ${E(s.fee.sem)}</h3><div class="panel" style="padding:14px">
   ${s.fee.heads.map(h=>`<div class="rline"><span>${E(h.name)}</span><span>${inr(h.amount)}</span></div>`).join('')}
   <div class="rline tot"><span>Total</span><span>${inr(sm.total)}</span></div><div class="rline"><span>Paid</span><span style="color:var(--good)">${inr(s.fee.paid)}</span></div>
   ${sm.late>0||s.fee.paidLate>0?`<div class="rline"><span>Late fee so far</span><span>${inr(sm.late)}</span></div>${s.fee.lateWaived?`<div class="rline"><span>Late fee waived</span><span>− ${inr(s.fee.lateWaived)}</span></div>`:''}${s.fee.paidLate?`<div class="rline"><span>Late fee paid</span><span style="color:var(--good)">${inr(s.fee.paidLate)}</span></div>`:''}`:''}
   <div class="rline tot"><span>Payable now</span><span style="color:${sm.payable>0?'var(--bad)':'var(--good)'}">${inr(sm.payable)}</span></div>
   ${sm.lateDue>0&&can('fees.concession.approve')?`<button class="btn sm" data-act="waiveLate" data-id="${E(s.id)}" style="margin-top:6px">Waive late fee</button>`:''}</div>
   ${conc.status!=='none'?`<div class="hl" style="margin-top:10px"><b>${conc.type==='gov'?'Government scholarship':'Management concession '+inr(conc.amount)}</b> · ${pill(conc.status,conc.status==='approved'?'good':conc.status==='pending'?'warn':'bad')}${conc.status==='pending'&&can('fees.concession.approve')?` <button class="btn sm primary" data-act="concDecide" data-id="${E(s.id)}" data-v="approved">Approve</button> <button class="btn sm danger" data-act="concDecide" data-id="${E(s.id)}" data-v="rejected">Reject</button>`:''}${conc.requestedBy?`<div class="note">Requested by ${E(conc.requestedBy)}${conc.approvedBy?' · decided by '+E(conc.approvedBy):''}</div>`:''}${s.fee.govReceivable?`<div class="note">Due from scholarship portal: ${inr(s.fee.govReceivable)}</div>`:''}</div>`:''}
   <h3>Installments · ${E(s.fee.planName)}</h3><div class="list">${sm.inst.map(i=>`<div class="li"><div><b>${E(i.label)}</b><small>Due ${fmtD(i.due)}${i.overdue?' · overdue':''}</small></div><div class="right"><span class="amt">${inr(i.amt)}</span><br>${pill(i.state,i.state==='Paid'?'good':i.state==='Part-paid'?'acc':i.overdue?'bad':'warn')}</div></div>`).join('')}</div>
   <h3>Payment history</h3><div class="list">${paysOf(s,false).map(p=>`<div class="li"><div><b class="${p.status==='ok'?'':'cancelled'}">${E(p.rc)}</b><small>${fmtD(p.date)} · ${E(p.mode)}${p.status!=='ok'?' · cancelled':''}</small></div><div class="right"><span class="amt ${p.status==='ok'?'':'cancelled'}">${inr(p.amount)}</span><br><button class="btn sm" data-act="viewReceipt" data-id="${E(p.id)}">Receipt</button></div></div>`).join('')||'<p class="note">No payments yet.</p>'}</div>
   ${s.feeHistory.length?`<h3>Earlier semesters</h3><div class="list">${s.feeHistory.map(h=>`<div class="li"><div><b>Semester ${E(h.sem)}</b><small>${h.balanceCarried?'Balance of '+inr(h.balanceCarried)+' carried forward':'Closed'}</small></div><span class="amt">${inr(h.total)}</span></div>`).join('')}</div>`:''}`:''}
  <h3>Documents</h3><div class="list">${DOCS.map(d=>`<label class="li" style="cursor:${can('students.edit')?'pointer':'default'}"><span><input type="checkbox" data-change="docToggle" data-id="${E(s.id)}" data-k="${E(d[0])}" ${s.docs[d[0]]?'checked':''} ${can('students.edit')?'':'disabled'}> ${E(d[1])}</span>${pill(d[2]?'Required':'If applicable',d[2]&&!s.docs[d[0]]?'bad':'')}</label>`).join('')}</div>
  <h3>Internal marks</h3>${marksSummary(s)}
  ${can('students.edit')&&s.status==='Active'?`<div class="actions" style="margin-top:18px"><button class="btn danger" data-act="markLeft" data-id="${E(s.id)}">Mark as left</button></div>`:''}`,true);
}
function marksSummary(s){
  const rows=db.marks.filter(m=>m.divId===s.div&&m.sem===s.sem&&m.scores[s.id]!==undefined&&m.scores[s.id]!=='');
  return rows.length?`<div class="list">${rows.map(m=>`<div class="li"><div><b>${E(db.subjects.find(x=>x.id===m.subjectId)?.name||'-')}</b><small>${E(m.exam)}</small></div><span class="amt">${E(m.scores[s.id])} / ${E(m.max)}</span></div>`).join('')}</div>`:'<p class="note">No marks entered yet.</p>';
}
CHG.docToggle=el=>{need('students.edit','change documents');const s=stu(el.dataset.id);if(!s)throw new Error('Student not found');s.docs[el.dataset.k]=el.checked;log('Documents',`${s.name}: ${DOCS.find(d=>d[0]===el.dataset.k)[1]} ${el.checked?'received':'removed'}`);save();const sc=$('.drawer').scrollTop;openStudent(s.id);$('.drawer').scrollTop=sc;renderPage()};
/* money already paid above the fee that would apply with this concession (0 means the concession fits) */
function concCredit(s,c){const f=JSON.parse(JSON.stringify(s.fee));f.concession=c;layoutFee(f);return Math.max(0,f.paid-f.total)}
function concBlock(s,c){const cr=concCredit(s,c);if(cr>0)throw new Error(`Cannot approve: ${s.name} has already paid ${inr(s.fee.paid)}, more than the fee after this concession, so ${inr(cr)} would be left with nowhere to go. Cancel and refund the receipts first, or reject the concession.`)}
ACT.concDecide=el=>{
  if(!can('fees.concession.approve'))throw new Error('Only the Principal or admin can decide concessions');
  const s=stu(el.dataset.id);if(!s)throw new Error('Student not found');const c=s.fee.concession;
  if(el.dataset.v!=='approved'&&el.dataset.v!=='rejected')throw new Error('Choose approve or reject');
  if(c.status!=='pending')throw new Error('There is no pending concession request for this student');
  if(el.dataset.v==='approved')concBlock(s,{...c,status:'approved'});
  c.status=el.dataset.v;c.approvedBy=cur().name;layoutFee(s.fee);recompute(s);
  log('Concession '+c.status,`${s.name}: ${c.type==='gov'?'government scholarship':inr(c.amount)}`);
  {const rq=db.users.find(x=>x.name===c.requestedBy&&x.active);const what=c.type==='gov'?'Government scholarship':inr(c.amount);notify('conc_dec',`Concession ${c.status} · ${s.name}`,`${what} ${c.status} by ${cur().name}.`,{sid:s.id,uids:rq?[rq.id]:[],tone:c.status==='approved'?'good':'warn',go:{staff:['fees','approvals'],portal:'pfees'},open:'student',p:{t:`Concession ${c.status}`,x:c.status==='approved'?`${what}: your fee plan has been updated.`:`${what} was not approved. Contact the office for details.`}})}
  save();toast('Concession '+c.status);openStudent(s.id);renderPage();
};
ACT.waiveLate=el=>{
  need('fees.concession.approve','waive late fee');const s=stu(el.dataset.id);if(!s)throw new Error('Student not found');const sm=feeSum(s);
  dialog(`<h3>Waive late fee</h3><form data-form="waive" data-id="${E(s.id)}" class="grid" style="gap:12px"><p class="muted" style="margin:0">Late fee due for ${E(s.name)}: <b>${inr(sm.lateDue)}</b></p>${F('amount','Amount to waive (₹)',{type:'number',val:sm.lateDue,req:1,attrs:`min="1" max="${sm.lateDue}"`})}${F('reason','Reason',{req:1,ph:'For example: hardship, bank delay'})}<div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeDialog">Cancel</button><button class="btn primary">Waive</button></div></form>`);
};
FORM.waive=(f,d)=>{
  if(!can('fees.concession.approve'))throw new Error('Only the Principal or admin can waive late fee');
  const s=stu(f.dataset.id);if(!s)throw new Error('Student not found');if(!String(d.reason||'').trim())throw new Error('Enter a reason for the waiver');const a=Math.min(+d.amount,feeSum(s).lateDue);if(!(a>0))throw new Error('Nothing to waive');
  s.fee.lateWaived+=a;recompute(s);log('Late fee waived',`${s.name}: ${inr(a)}. Reason: ${d.reason}`);notify('payment',`Late fee waived · ${s.name}`,`${inr(a)}. Reason: ${d.reason}`,{sid:s.id,tone:'good',go:{staff:['fees','dues'],portal:'pfees'},p:{t:'Late fee waived',x:`${inr(a)} of late fee was waived. Reason: ${d.reason}.`}});save();closeDialog();toast(`${inr(a)} late fee waived`);openStudent(s.id);renderPage();
};
ACT.markLeft=el=>{need('students.edit','change admission status');const s=stu(el.dataset.id);if(!s)throw new Error('Student not found');confirmBox('Mark student as left',`${s.name} will be removed from active lists. Records and receipts stay.`,'Mark as left',()=>{s.status='Left';log('Student left',s.name+' ('+s.id+')');notify('promotion',`${s.name} marked as left`,`${s.id} was marked as left by ${cur().name}.`,{sid:s.id,tone:'warn',go:{staff:['students']},open:'student',p:{t:'Admission status changed',x:`${s.name} is now marked as left. Contact the office for any query.`}});save();closeLayer();renderPage();toast('Marked as left')},true)};
ACT.editStudent=el=>{
  need('students.edit','edit students');const s=stu(el.dataset.id);if(!s)throw new Error('Student not found');
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Edit ${E(s.name)}</h2><form data-form="editStudent" data-id="${E(s.id)}" class="form" style="margin-top:14px">
   ${F('name','Full name',{val:s.name,req:1,span:1,attrs:`maxlength="${NAME_MAX}"`})}${F('phone','Mobile',{val:s.phone,req:1})}${F('whatsapp','WhatsApp number',{val:s.whatsapp})}${F('email','Email',{val:s.email,type:'email',span:1})}
   ${F('address','Address',{val:s.address,span:1})}${F('city','City',{val:s.city})}${F('pin','Pincode',{val:s.pin})}${F('category','Category',{opts:['General','OBC (SEBC)','SC','ST','EWS'],val:s.category})}
   ${F('div','Division',{opts:divOpts(s.course,s.batch),val:s.div})}${F('gname','Guardian name',{val:s.guardian.name,attrs:`maxlength="${NAME_MAX}"`})}${F('gphone','Guardian mobile',{val:s.guardian.phone})}${F('gemail','Guardian email (receipts)',{val:s.guardian.email||'',type:'email',span:1})}
   <button class="btn primary span">Save changes</button></form>`);
};
FORM.editStudent=(f,d)=>{
  if(!can('students.edit'))throw new Error('You do not have access to edit students');
  const s=stu(f.dataset.id);if(!s)throw new Error('Student not found');const nm=capText(d.name,'The student name');if(!nm)throw new Error('Enter the full name');const gn=capText(d.gname,'The guardian name');
  Object.assign(s,{name:nm,phone:d.phone,whatsapp:d.whatsapp||d.phone,email:d.email,address:d.address,city:d.city,pin:d.pin,category:d.category,div:d.div});
  s.guardian.name=gn;s.guardian.phone=d.gphone;s.guardian.email=d.gemail||'';const pu=db.users.find(u=>u.studentId===s.id&&u.role==='Parent');if(pu)pu.name=gn;const su=db.users.find(u=>u.studentId===s.id&&u.role==='Student');if(su)su.name=s.name;
  log('Student edited',s.name+' ('+s.id+')');save();toast('Saved');openStudent(s.id);renderPage();
};
ACT.certificate=el=>{
  if(!mayStudent(el.dataset.id))throw new Error('Student not found');const s=stu(el.dataset.id);const c=course(s.course),b=batchOf(s.batch);const sm=feeSum(s);
  dialog(`<h3>Certificates</h3><div class="actions" style="margin-bottom:10px"><button class="btn sm" data-act="certShow" data-id="${E(s.id)}" data-k="bonafide">Bonafide</button><button class="btn sm" data-act="certShow" data-id="${E(s.id)}" data-k="leaving">Leaving certificate</button></div><div id="certOut" class="note">Choose a certificate to preview.</div><div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="closeDialog">Close</button></div>`);
};
ACT.certShow=el=>{
  if(!mayStudent(el.dataset.id))throw new Error('Student not found');const s=stu(el.dataset.id);const c=course(s.course),b=batchOf(s.batch);const sm=feeSum(s);const clg=db.settings.college;let txt;
  if(el.dataset.k==='bonafide')txt=`${clg}\nBONAFIDE CERTIFICATE\n\nThis is to certify that ${s.name} (Enrolment No. ${s.id}) is a bonafide student of this college, studying in ${c.full} (${c.name}), Semester ${s.sem}, batch ${b.name}, for the academic year ${db.settings.year}.\n\nDate: ${fmtD(today())}\nPrincipal`;
  else{if(sm.payable>0){$('#certOut').innerHTML=`<div class="err">A leaving certificate cannot be issued while ${inr(sm.payable)} is payable.</div>`;return}
    txt=`${clg}\nLEAVING CERTIFICATE\n\nThis is to certify that ${s.name} (Enrolment No. ${s.id}) was a student of ${c.full} (${c.name}), batch ${b.name}, admitted on ${fmtD(s.admittedOn)}. No dues are pending against the student.\n\nDate: ${fmtD(today())}\nPrincipal`}
  $('#certOut').innerHTML=`<div class="receipt" style="white-space:pre-wrap;color:var(--fg)">${E(txt)}</div>`;log('Certificate previewed',el.dataset.k+' for '+s.name);save();
};

/* ---------- promotion ---------- */
function viewPromotion(){
  const f=ui.f.promo=ui.f.promo||{batch:db.batches[1].id,sem:'1'};const b=batchOf(f.batch);const list=db.students.filter(s=>s.batch===f.batch&&String(s.sem)===f.sem&&s.status==='Active');
  const c=course(b.course);const nextLabel=+f.sem>=c.semesters?'Pass out (Alumni)':'Semester '+(+f.sem+1);
  return`<div class="panel"><div class="filters"><select aria-label="Batch" data-change="promoF" data-k="batch">${db.batches.map(x=>`<option value="${E(x.id)}" ${f.batch===x.id?'selected':''}>${E(course(x.course).name)} ${E(x.name)}</option>`).join('')}</select>
   <select aria-label="Semester" data-change="promoF" data-k="sem">${[1,2,3,4].map(n=>`<option value="${E(n)}" ${f.sem==n?'selected':''}>From semester ${n}</option>`).join('')}</select><span class="pill acc">To: ${E(nextLabel)}</span></div>
   <form data-form="promote"><div class="tablewrap"><table><thead><tr><th></th><th>Student</th><th>Division</th><th class="num">Payable</th><th>Attendance</th><th>Decision</th></tr></thead><tbody>
   ${list.map(s=>{const sm=feeSum(s);const a=attPct(s);const hold=sm.payable>0;return`<tr><td><input type="checkbox" name="ids" value="${E(s.id)}" ${hold?'':'checked'} aria-label="Select ${E(s.name)}"></td><td>${E(s.name)}</td><td>${E(divOf(s.div)?.name)}</td><td class="num amt">${inr(sm.payable)}</td><td>${a===null?'—':a+'%'}</td><td>${hold?pill('Held: dues','warn'):pill('Ready','good')}</td></tr>`}).join('')||'<tr><td colspan="6" class="empty">No active students in this class.</td></tr>'}</tbody></table></div>
   ${list.length?`<label class="li" style="justify-content:flex-start;gap:8px;cursor:pointer"><input type="checkbox" name="carry" value="1"> Also promote selected students who still owe money, and carry the balance to the next semester</label>
   <div class="actions" style="margin-top:10px"><button class="btn gold">Promote selected students</button></div>`:''}</form><p class="note">The old semester's fee record is kept. A new fee record is created for the next semester using the current fee structure.</p></div>`;
}
CHG.promoF=el=>{ui.f.promo[el.dataset.k]=el.value;renderPage()};
FORM.promote=(form,d)=>{
  if(!can('students.promote'))throw new Error('You do not have access to promotion');
  const ids=$$('input[name=ids]:checked',form).map(i=>i.value);if(!ids.length)throw new Error('Select at least one student');
  const carry=!!d.carry;let moved=0,alumni=0,skipped=0;
  ids.forEach(id=>{const s=stu(id);const sm=feeSum(s);if(sm.payable>0&&!carry){skipped++;return}
    s.feeHistory.push({sem:s.fee.sem,total:s.fee.total,paid:s.fee.paid,balanceCarried:sm.payable,feeId:s.fee.id});
    const c=course(s.course);if(s.sem>=c.semesters){s.status='Alumni';alumni++;moved++;notify('promotion',`${s.name} has passed out`,`${s.id} completed ${c.name}.`,{sid:s.id,tone:'good',roles:['Parent','Student'].filter(r=>ntOn('promotion',r)),go:{portal:'phome'}});return}
    s.sem++;s.fee=newFee({sem:s.sem,courseId:s.course,planName:s.fee.planName,start:today(),prev:sm.payable});moved++;notify('promotion',`${s.name} moved to Semester ${s.sem}`,`${s.id} · new fee record ${inr(s.fee.total)}.`,{sid:s.id,tone:'good',roles:['Parent','Student'].filter(r=>ntOn('promotion',r)),go:{portal:'pfees'}})});
  log('Semester promotion',`${moved} promoted${alumni?' ('+alumni+' passed out)':''}, ${skipped} held for dues`);notify('promotion','Semester promotion done',`${moved} promoted${alumni?', '+alumni+' passed out':''}${skipped?', '+skipped+' held back for dues':''}.`,{tone:'good',go:{staff:['students']}});save();renderPage();toast(`${moved} promoted${skipped?', '+skipped+' held for dues':''}`);
};

/* ---------- CSV import ---------- */
const IMPORT_SAMPLE='name,gender,course,batch,division,mobile,guardian,guardian_mobile,paid_so_far\nKomal Parikh,F,B.Ed,2026–28,A,9824012345,Shri Hasmukh Parikh,9825098765,0\nRohan Kapadia,M,M.Ed,2026–28,A,9879055501,Shri Vijay Kapadia,9879011122,10000';
ACT.importStudents=()=>{
  need('students.edit','import students');
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Import students</h2><p class="note">Paste rows from Excel or upload a CSV file. First row is the header. Columns: name, gender, course (B.Ed or M.Ed), batch, division, mobile, guardian, guardian_mobile, paid_so_far, guardian_email and email (the last three are optional).</p>
  <form data-form="importCsv" class="grid" style="gap:12px;margin-top:12px"><div class="field"><label class="label" for="csvFile">CSV file</label><input type="file" id="csvFile" accept=".csv,text/csv" data-change="csvFile"></div>
  <div class="field"><label class="label" for="f_csv">Or paste text</label><textarea class="csvbox" name="csv" id="f_csv" rows="8" required>${E(IMPORT_SAMPLE)}</textarea></div><div class="actions"><button class="btn primary">Import students</button></div></form><div id="impOut"></div>`);
};
CHG.csvFile=el=>{const f=el.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$('#f_csv').value=String(r.result)};r.readAsText(f)};
function parseCsv(t){const rows=[];let row=[],cur='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'&&t[i+1]==='"'){cur+='"';i++}else if(c==='"')q=false;else cur+=c}else if(c==='"')q=true;else if(c===','){row.push(cur);cur=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(cur);cur='';if(row.some(x=>x.trim()))rows.push(row);row=[]}else cur+=c}row.push(cur);if(row.some(x=>x.trim()))rows.push(row);return rows}
FORM.importCsv=(f,d)=>{
  if(!can('students.edit'))throw new Error('You do not have access to import');
  const rows=parseCsv(d.csv);const hdr=rows.shift().map(h=>h.trim().toLowerCase());const ix=n=>hdr.indexOf(n);
  ['name','course','batch','division','mobile'].forEach(n=>{if(ix(n)<0)throw new Error('Missing column: '+n)});
  const ok=[],bad=[];
  rows.forEach((r,i)=>{const g=n=>(r[ix(n)]||'').trim();const c=db.courses.find(x=>x.name.toLowerCase()===g('course').toLowerCase());const b=c&&db.batches.find(x=>x.course===c.id&&x.name.replace('–','-')===g('batch').replace('–','-'));const dv=b&&db.divisions.find(x=>x.batch===b.id&&x.name.toLowerCase()===g('division').toLowerCase());
    if(g('name').length>NAME_MAX||g('guardian').length>NAME_MAX){bad.push(`Row ${i+2}: ${g('name').slice(0,20)}..., a name is longer than ${NAME_MAX} characters`);return}
    if(!g('name')||!c||!b||!dv||g('mobile').replace(/\D/g,'').length<10){bad.push(`Row ${i+2}: ${g('name')||'(no name)'}, check course, batch, division and mobile`);return}
    if(seatsLeft(dv)<=0){bad.push(`Row ${i+2}: ${g('name')}, division ${dv.name} is full`);return}
    if(db.students.some(s=>s.name.toLowerCase()===g('name').toLowerCase()&&s.phone.replace(/\s/g,'')===g('mobile').replace(/\s/g,''))){bad.push(`Row ${i+2}: ${g('name')} already exists`);return}
    const s=makeStudent({name:g('name'),gender:g('gender')==='M'?'Male':'Female',course:c.id,batch:b.id,div:dv.id,sem:1,phone:g('mobile'),gname:g('guardian'),gphone:g('guardian_mobile'),gemail:g('guardian_email'),email:g('email'),docs:{},start:today()});
    db.students.push(s);ensureUsers(s);
    const paid=+g('paid_so_far')||0;if(paid>0){try{recordPayment(s,{amount:Math.min(paid,feeSum(s).payable),mode:'Imported',channel:'imported',by:cur().name,ref:'Opening balance'})}catch(e){}}
    ok.push(s)});
  log('Import',`${ok.length} students imported, ${bad.length} rows skipped`);save();renderPage();
  $('#impOut').innerHTML=`<div class="panel" style="margin-top:14px"><h2>${ok.length} imported ${bad.length?pill(bad.length+' skipped','warn'):''}</h2>${ok.map(s=>`<div class="li"><span>${E(s.name)}</span><span class="mono">${E(s.id)}</span></div>`).join('')}${bad.map(b=>`<p class="note" style="color:var(--bad)">${E(b)}</p>`).join('')}</div>`;
  toast(ok.length+' students imported');
};
