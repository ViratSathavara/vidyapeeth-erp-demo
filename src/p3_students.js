/* =====================================================================
   Students (spec §6): list, add / edit form, profile, login + credentials email
   ===================================================================== */
const SEMS=[1,2,3,4];
const fundLabel=f=>f==='SCHOLARSHIP'?'By Scholarship':'By Cash';
const statusLabel={ACTIVE:'Active',LEFT:'Left',PASSED:'Passed'};
const PAGE=25;
function stuFilter(){return ui.f.students=Object.assign({q:'',course:'',sem:'',cat:'',fund:'',ref:'',status:'ACTIVE',dues:'',sort:'name',dir:1,page:0},ui.f.students||{})}
function studentsFiltered(){
  const f=stuFilter();const q=f.q.trim().toLowerCase();
  let l=vStudents().map(s=>({s,sm:feeSum(s)})).filter(({s,sm})=>(!f.course||s.course===f.course)&&(!f.sem||s.sem===+f.sem)&&(!f.cat||s.category===f.cat)&&(!f.fund||s.funding===f.fund)&&(!f.status||s.status===f.status)&&(!f.ref||(f.ref==='__none'?!s.refId:s.refId===f.ref))
    &&(!f.dues||(f.dues==='yes'?sm.payable>0:sm.payable===0))&&(!q||[s.name,s.enrol,s.phone,s.email,s.ref].some(v=>String(v||'').toLowerCase().includes(q))));
  const key={name:x=>x.s.name.toLowerCase(),enrol:x=>x.s.enrol,course:x=>x.s.course+x.s.sem,cat:x=>x.s.category,fund:x=>x.s.funding,due:x=>x.sm.payable,paid:x=>x.sm.paid}[f.sort]||(x=>x.s.name);
  l.sort((a,b)=>{const A=key(a),B=key(b);return(A<B?-1:A>B?1:0)*f.dir});
  return l;
}
const sortTh=(scope,k,label,num)=>{const f=ui.f[scope]||{};const on=f.sort===k;return`<th class="${num?'num':''}" aria-sort="${on?(f.dir>0?'ascending':'descending'):'none'}"><button class="sortb" data-act="sortBy" data-scope="${E(scope)}" data-k="${E(k)}">${E(label)}<span aria-hidden="true">${on?(f.dir>0?' ▲':' ▼'):''}</span></button></th>`};
ACT.sortBy=el=>{const f=ui.f[el.dataset.scope];if(f.sort===el.dataset.k)f.dir=-f.dir;else{f.sort=el.dataset.k;f.dir=['due','paid','amount','date','entry'].includes(el.dataset.k)?-1:1}f.page=0;renderPage()};
/* pagination for every list: "Showing 1-25 of 963 · ← Prev 1 2 … 39 Next → · Page [1] of 39 · Items per page [25]" */
const PER_OPTS=[10,12,25,50,100];
const perOf=f=>PER_OPTS.includes(+f.per)?+f.per:PAGE;
function pageRows(f,l){const per=perOf(f),pages=Math.max(1,Math.ceil(l.length/per));f.page=Math.min(Math.max(0,f.page||0),pages-1);return l.slice(f.page*per,(f.page+1)*per)}
function pageNums(cur,pages){if(pages<=7)return[...Array(pages).keys()];const s=new Set([0,pages-1,cur-1,cur,cur+1].filter(n=>n>=0&&n<pages));if(cur<=2){s.add(1);s.add(2)}if(cur>=pages-3){s.add(pages-2);s.add(pages-3)}
  const l=[...s].sort((a,b)=>a-b),out=[];l.forEach((n,i)=>{if(i&&n-l[i-1]>1)out.push(n-l[i-1]===2?n-1:-1);out.push(n)});return out}
const pager=(scope,total)=>{const f=ui.f[scope];if(!f||!total||total<=PER_OPTS[0])return'';const per=perOf(f),pages=Math.max(1,Math.ceil(total/per)),cur=Math.min(f.page||0,pages-1);
  const a=cur*per+1,b=Math.min(total,(cur+1)*per),S=E(scope);
  return`<div class="pager" role="navigation" aria-label="Pages">
   <span class="pg-info">Showing <b>${a}–${b}</b> of <b>${total.toLocaleString('en-IN')}</b></span>
   <div class="pg-nav">${pages>1?`<button type="button" class="pg-step" data-act="pgTo" data-scope="${S}" data-p="${cur-1}" ${cur<=0?'disabled':''} aria-label="Previous page">←<span class="pg-t"> Prev</span></button>
    ${pageNums(cur,pages).map(n=>n<0?'<span class="pg-gap" aria-hidden="true">…</span>':`<button type="button" class="pg-n${n===cur?' on':''}" data-act="pgTo" data-scope="${S}" data-p="${n}" ${n===cur?'aria-current="page"':''} aria-label="Page ${n+1}">${n+1}</button>`).join('')}
    <button type="button" class="pg-step" data-act="pgTo" data-scope="${S}" data-p="${cur+1}" ${cur>=pages-1?'disabled':''} aria-label="Next page"><span class="pg-t">Next </span>→</button>`:''}</div>
   <div class="pg-opts">${pages>1?`<label class="pg-lbl">Page <select data-change="pgSel" data-scope="${S}" aria-label="Go to page">${[...Array(pages).keys()].map(n=>`<option value="${n}" ${n===cur?'selected':''}>${n+1}</option>`).join('')}</select> of ${pages}</label>`:''}
    <label class="pg-lbl">Items per page: <select data-change="pgPer" data-scope="${S}" aria-label="Items per page">${PER_OPTS.map(n=>`<option ${n===per?'selected':''}>${n}</option>`).join('')}</select></label></div>
  </div>`};
const pgTop=()=>{const p=$('.pager');const h=p&&p.closest('.panel,.scard');if(h&&h.getBoundingClientRect().top<0)h.scrollIntoView({block:'start'})};
ACT.pg=el=>{ui.f[el.dataset.scope].page+= +el.dataset.d;renderPage();pgTop()};
ACT.pgTo=el=>{ui.f[el.dataset.scope].page=+el.dataset.p;renderPage();pgTop()};
CHG.pgSel=el=>{ui.f[el.dataset.scope].page=+el.value;renderPage();pgTop()};
CHG.pgPer=el=>{const f=ui.f[el.dataset.scope];const first=(f.page||0)*perOf(f);f.per=+el.value;f.page=Math.floor(first/f.per);renderPage()};
CHG.sf=el=>{const f=ui.f[el.dataset.scope];f[el.dataset.k]=el.value;f.page=0;renderPage()};
LIVE.sq=el=>{const f=ui.f[el.dataset.scope];f.q=el.value;f.page=0;clearTimeout(LIVE._t);LIVE._t=setTimeout(()=>{renderPage();const i=$(`[data-live=sq][data-scope="${el.dataset.scope}"]`);if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},200)};
const sel=(scope,k,label,opts)=>{const f=ui.f[scope];return`<select aria-label="${E(label)}" data-change="sf" data-scope="${E(scope)}" data-k="${E(k)}">${opts.map(([v,l])=>`<option value="${E(v)}" ${String(f[k])===String(v)?'selected':''}>${E(l)}</option>`).join('')}</select>`};
const COURSE_OPTS=()=>[['','All courses'],...scopeCourses().map(c=>[c.id,c.name])];
const SEM_OPTS_=()=>[['','All semesters'],...SEMS_ALL().map(n=>[n,'Semester '+n])];
const CAT_OPTS=[['','All categories'],...CATS.map(c=>[c,c])];
const FUND_OPTS=[['','Cash + Scholarship'],['CASH','By Cash'],['SCHOLARSHIP','By Scholarship']];
/* reference filter (change 2): only the references used by students this login can see, with the count */
const REF_OPTS=()=>{const n={};vStudents().forEach(s=>{if(s.refId)n[s.refId]=(n[s.refId]||0)+1});
  return[['','All references'],...(db.refs||[]).filter(r=>n[r.id]).sort((a,b)=>a.name.localeCompare(b.name)).map(r=>[r.id,`${r.name} (${n[r.id]})`]),['__none','No reference']]};

function viewStudents(){
  const f=stuFilter();const l=studentsFiltered();const page=pageRows(f,l);
  const acts=`${can('students.edit')?`<button class="btn" data-act="importStudents">Import CSV</button>`:''}<button class="btn exp-btn" data-act="expOpen" data-key="students">Export</button>${can('students.edit')?'<button class="btn primary" data-act="newStudent">Add student</button>':''}`;
  const act=vStudents().filter(s=>s.status==='ACTIVE');
  return head('Students',`${act.length} active · ${act.filter(s=>s.course==='BED').length} B.Ed · ${act.filter(s=>s.course==='MED').length} M.Ed · ${act.filter(s=>s.funding==='SCHOLARSHIP').length} on scholarship`,acts)+
  `<div class="panel"><div class="filters"><input type="search" placeholder="Search name, enrolment no, phone, email or reference" aria-label="Search students" data-live="sq" data-scope="students" value="${E(f.q)}">
    ${sel('students','course','Course',COURSE_OPTS())}${sel('students','sem','Semester',SEM_OPTS_())}${sel('students','cat','Category',CAT_OPTS)}${sel('students','fund','Funding type',FUND_OPTS)}${sel('students','ref','Admission reference',REF_OPTS())}
    ${sel('students','status','Status',[['','All status'],['ACTIVE','Active'],['LEFT','Left'],['PASSED','Passed']])}${sel('students','dues','Dues',[['','Dues: any'],['yes','Has dues'],['no','No dues']])}
    ${Object.entries(f).some(([k,v])=>!['sort','dir','page','status'].includes(k)&&v)?'<button class="btn sm" data-act="clearF" data-scope="students">Clear</button>':''}</div>
  <div class="tablewrap"><table><thead><tr>${sortTh('students','name','Student')}${sortTh('students','enrol','Enrolment no')}${sortTh('students','course','Course · Sem')}${sortTh('students','cat','Category')}${sortTh('students','fund','Funding')}${sortTh('students','paid','Paid',1)}${sortTh('students','due','Due now',1)}<th>Status</th></tr></thead><tbody>
  ${page.map(({s,sm})=>`<tr class="click" data-act="openStudent" data-id="${E(s.id)}" tabindex="0"><td><div class="who">${avatar(s)}<div><b>${E(s.name)}</b><small class="muted" style="display:block">${E(s.phone)}</small></div></div></td><td class="mono">${E(s.enrol)}</td><td>${E(classLabel(s))}</td><td>${E(s.category)}</td><td>${s.funding==='SCHOLARSHIP'?pill('Scholarship','acc'):pill('Cash')}</td><td class="num amt">${inr(sm.paid)}</td><td class="num amt">${sm.payable?`<b class="${sm.overdue?'t-bad':''}">${inr(sm.payable)}</b>`:'—'}</td><td>${s.status==='ACTIVE'?(sm.payable?(sm.overdue?pill('Overdue','bad'):pill('Due','warn')):pill('Paid up','good')):pill(statusLabel[s.status])}</td></tr>`).join('')||`<tr><td colspan="8" class="empty">No students match these filters.</td></tr>`}
  </tbody></table></div>${pager('students',l.length)}</div>`;
}
ACT.clearF=el=>{const sc=el.dataset.scope;const keep=ui.f[sc];ui.f[sc]={sort:keep.sort,dir:keep.dir,page:0};if(sc==='students')ui.f[sc].status='ACTIVE';renderPage()};
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches&&e.target.matches('tr.click[data-act]')){e.preventDefault();e.target.click()}});
const avatar=s=>s.photo?`<img class="av" src="${E(s.photo)}" alt="">`:`<div class="av" aria-hidden="true">${E(initials(s.name))}</div>`;
ACT.exportStudents=()=>{need('students.view');showCsv('NPCTE students',['Enrolment no','Name','Gender','DOB','Phone','Email','Address','Course','Batch','Semester','Category','Funding','Status','Admission reference','Sem 1 fee','Sem 2 fee','Sem 3 fee','Sem 4 fee','Paid','Due now'],
  studentsFiltered().map(({s,sm})=>[s.enrol,s.name,s.gender,fmtD(s.dob),s.phone,s.email,s.address,course(s.course).name,defaultBatch(s),s.sem,s.category,fundLabel(s.funding),statusLabel[s.status],s.ref||'',...SEMS_ALL().map(n=>semFee(s,n)?semFee(s,n).amount/100:''),sm.paid/100,sm.payable/100]))};

/* ---------- add / edit form ---------- */
function studentForm(s){
  const isNew=!s;const T=today();const y=+T.slice(0,4);const st=db.settings;
  const c0=pickedCourse()||myCourses()[0]||'BED';const y0=+T.slice(5,7)>=6?y:y-1;
  const d=s||{name:'',gender:'',dob:'',phone:'',email:'',address:'',course:c0,admissionYear:y0,sem:1,category:'General',funding:'CASH',scholarshipNote:'',ref:'',status:'ACTIVE',fees:semsOf(c0).map(n=>({sem:n,amount:(st.feeDefault[c0]||[])[n-1]||0,due:defaultDue(c0,y0,n)}))};
  /* the office types the enrolment no. for a new student; changing it later stays with the Principal / Super Admin */
  const showEnrol=isNew||canChangeEnrol();
  ui.photo=d.photo||'';
  return`<button class="btn x" data-act="close">Close</button><h2>${isNew?'Add student':'Edit '+E(d.name)}</h2>
  <p class="muted" style="margin:4px 0 14px">${isNew?'A login is created automatically and the login ID and password are emailed to the student.':'Enrolment no. '+E(d.enrol)}</p>
  <form data-form="${isNew?'addStudent':'editStudent'}" ${isNew?'':`data-id="${E(d.id)}"`} class="grid" style="gap:18px" novalidate>
   <fieldset class="fs"><legend>Personal</legend><div class="form">
    ${F('name','Full name',{val:d.name,req:true,span:1,attrs:'maxlength="80" autocomplete="off"'})}
    ${F('gender','Gender',{val:d.gender,opts:[['','Select'],['F','Female'],['M','Male'],['O','Other']]})}
    ${F('dob','Date of birth',{type:'date',val:d.dob,attrs:`max="${T}"`})}
    ${F('phone','Mobile',{type:'tel',val:d.phone,req:true,attrs:'inputmode="numeric" maxlength="10" pattern="[6-9][0-9]{9}" data-live="loginPrev"'})}
    ${F('email','Email',{type:'email',val:d.email,req:true,attrs:'maxlength="120" data-live="loginPrev"'})}
    ${F('address','Address',{type:'textarea',val:d.address,span:1,rows:2})}
    <div class="field span"><span class="label">Photo</span><div class="photo-row"><div id="photoPrev">${ui.photo?`<img class="av lg" src="${E(ui.photo)}" alt="">`:`<div class="av lg">${E(initials(d.name||'?'))}</div>`}</div><label class="btn sm"><input type="file" accept="image/*" data-change="photo" class="sr"> Choose photo</label>${ui.photo?'<button type="button" class="btn sm" data-act="photoClear">Remove</button>':''}</div></div>
   </div></fieldset>
   <fieldset class="fs"><legend>Course</legend><div class="form">
    ${showEnrol?F('enrol','Enrolment no.',{val:d.enrol||'',req:true,ph:'e.g. BED26-001',attrs:'maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" data-live="loginPrev"'}):''}
    ${F('course','Course',{val:d.course,opts:db.courses.filter(c=>mayCourse(c.id)&&(c.active!==false||c.id===d.course)).map(c=>[c.id,c.name]),req:true,attrs:'data-change="formCourse"'})}
    <div class="field" id="batchWrap">${batchSelect(d.course,d.admissionYear)}</div>
    <div class="field" id="semWrap">${semSelect(d.course,d.sem)}</div>
    ${refField(d.ref||'')}
    ${isNew?'':F('status','Status',{val:d.status,opts:[['ACTIVE','Active'],['LEFT','Left'],['PASSED','Passed']]})}
   </div></fieldset>
   ${isNew?`<fieldset class="fs"><legend>Student login</legend>
    <div class="rline"><span>Login ID</span><b class="mono" id="lpId">${E(loginIdText(d.enrol,d.email))}</b></div>
    <div class="rline"><span>Password</span><b class="mono" id="lpPw">${E(loginPwText(d.phone,d.admissionYear))}</b></div>
    <p class="note" style="margin:8px 0 0">Password = first 5 digits of the mobile + @ + the year the batch starts (mobile 94290 86515, batch 2026-28 → 94290@2026). It is emailed to the student. Students cannot change it; only staff with the reset permission can.</p></fieldset>`:''}
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
const canChangeEnrol=()=>{const r=(cur()||{}).role;return r==='Super Admin'||r==='Principal'};

/* ---------- live login preview on the Add student form (change 1) ---------- */
const loginIdText=(en,mail)=>{en=String(en||'').trim().toUpperCase();mail=String(mail||'').trim().toLowerCase();return(en||'(enrolment no.)')+' or '+(mail||'(email)')};
const loginPwText=(ph,y)=>String(ph||'').replace(/\D/g,'').length>=5?studentPassword(ph,y):'(type the mobile number)';
function loginPrev(f){if(!f||f.dataset.form!=='addStudent')return;const a=$('#lpId'),b=$('#lpPw');
  if(a)a.textContent=loginIdText(f.enrol&&f.enrol.value,f.email&&f.email.value);if(b)b.textContent=loginPwText(f.phone&&f.phone.value,f.admissionYear&&f.admissionYear.value)}
LIVE.loginPrev=el=>loginPrev(el.form);

/* ---------- admission reference picker (change 2) ----------
   Click / focus the field: the saved references open as a list (filtered while typing, with the number of students).
   A name that is not saved yet shows "Add new reference"; it is saved with an id (REF001 …) when the student is saved.
   Arrow keys move, Enter picks, Esc closes. */
const refCountText=n=>n+' student'+(n===1?'':'s');
const refHint=v=>{const n=refClean(v),all=(db.refs||[]).length;if(!n)return all?`${all} saved reference${all===1?'':'s'}. Click the field to pick one, or type a new name.`:'Type a name. It is saved for next time.';
  const r=refByName(n);return r?`Saved reference ${r.id} · ${refCountText(refCount(r.id))}`:'New reference. It is saved with an id when you save the student.'};
function refField(val){
  return`<div class="field cbx"><label class="label" for="f_ref">Admission reference</label>
   <div class="cbx-box"><input id="f_ref" name="ref" value="${E(val)}" maxlength="60" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="refList" aria-describedby="refHint" data-cbx="ref" placeholder="Pick a saved name or type a new one">
    <span class="cbx-caret" aria-hidden="true"></span><ul class="cbx-list" id="refList" role="listbox" aria-label="Saved admission references" hidden></ul></div>
   <small class="muted" id="refHint">${E(refHint(val))}</small></div>`}
const CBX={inp:null,act:-1,items:[]};
function cbxDraw(){
  const inp=CBX.inp;if(!inp||!inp.isConnected)return cbxClose();const ul=inp.parentNode.querySelector('.cbx-list');const q=refKey(inp.value);
  const l=(db.refs||[]).filter(r=>!q||refKey(r.name).includes(q)).sort((a,b)=>{const A=refKey(a.name),B=refKey(b.name);return(A.startsWith(q)?0:1)-(B.startsWith(q)?0:1)||A.localeCompare(B)}).slice(0,60);
  CBX.items=l.map(r=>({v:r.name,r}));if(q&&!refByName(inp.value))CBX.items.push({v:refClean(inp.value),add:true});
  if(CBX.act>=CBX.items.length)CBX.act=CBX.items.length-1;
  ul.innerHTML=CBX.items.map((it,i)=>`<li id="refOpt${i}" role="option" class="cbx-opt${it.add?' add':''}${i===CBX.act?' on':''}" aria-selected="${i===CBX.act}" data-i="${i}">${it.add?`<span>+ Add new reference “<b>${E(it.v)}</b>”</span>`:`<span>${E(it.r.name)}</span><small>${E(it.r.id)} · ${refCountText(refCount(it.r.id))}</small>`}</li>`).join('')
    ||'<li class="cbx-empty" role="presentation">No saved references yet. Type a name to add the first one.</li>';
  ul.hidden=false;inp.setAttribute('aria-expanded','true');
  if(CBX.act>=0){inp.setAttribute('aria-activedescendant','refOpt'+CBX.act);const on=ul.querySelector('.on');if(on)on.scrollIntoView({block:'nearest'})}else inp.removeAttribute('aria-activedescendant');
}
function cbxOpen(inp){CBX.inp=inp;CBX.act=-1;cbxDraw()}
function cbxClose(){const inp=CBX.inp;CBX.inp=null;CBX.act=-1;CBX.items=[];if(!inp)return;const ul=inp.parentNode&&inp.parentNode.querySelector('.cbx-list');if(ul){ul.hidden=true;ul.innerHTML=''}inp.setAttribute('aria-expanded','false');inp.removeAttribute('aria-activedescendant')}
const cbxHint=inp=>{const h=$('#refHint');if(h)h.textContent=refHint(inp.value)};
function cbxPick(i){const it=CBX.items[i],inp=CBX.inp;if(!it||!inp)return;inp.value=it.v;cbxClose();cbxHint(inp);softFocus(inp)}
const isCbx=t=>!!(t&&t.matches&&t.matches('[data-cbx=ref]'));
document.addEventListener('focusin',e=>{if(isCbx(e.target)){if(CBX.inp!==e.target)cbxOpen(e.target)}else if(CBX.inp&&!CBX.inp.parentNode.contains(e.target))cbxClose()});
document.addEventListener('mousedown',e=>{if(e.target.closest&&e.target.closest('.cbx-list'))e.preventDefault()}); /* keep focus in the field while picking */
document.addEventListener('click',e=>{const t=e.target;const o=t.closest&&t.closest('.cbx-opt');if(o&&CBX.inp){cbxPick(+o.dataset.i);return}
  if(isCbx(t)){if(!CBX.inp)cbxOpen(t);return}if(CBX.inp&&!(t.closest&&t.closest('.cbx-box')))cbxClose()});
document.addEventListener('input',e=>{if(!isCbx(e.target))return;CBX.inp=e.target;CBX.act=-1;cbxDraw();cbxHint(e.target)});
document.addEventListener('keydown',e=>{const t=e.target;if(!isCbx(t))return;const open=CBX.inp===t;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open)cbxOpen(t);const n=CBX.items.length;if(!n)return;CBX.act=e.key==='ArrowDown'?(CBX.act+1)%n:(CBX.act<=0?n-1:CBX.act-1);cbxDraw()}
  else if(e.key==='Enter'&&open&&CBX.act>=0){e.preventDefault();e.stopPropagation();cbxPick(CBX.act)}
  else if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();cbxClose()}
  else if(e.key==='Tab'&&open)cbxClose()},true);
ACT.newStudent=()=>{need('students.edit','add students');ui.feeTouched=false;drawer(studentForm(null),true,'Add student');$('#f_name').focus()};
ACT.editStudent=el=>{need('students.edit','edit students');guardStudent(el.dataset.id);const s=stu(el.dataset.id);ui.feeTouched=true;drawer(studentForm(s),true,'Edit student')};
LIVE.feeEdit=()=>{ui.feeTouched=true};
CHG.formCat=el=>{const on=fundingApplies(el.value);$('#fundWrap').hidden=!on;if(!on){const c=$('input[name=funding][value=CASH]');if(c)c.checked=true}$('#schNote').hidden=!(on&&$('input[name=funding][value=SCHOLARSHIP]').checked)};
document.addEventListener('change',e=>{if(e.target.name==='funding')$('#schNote')&&($('#schNote').hidden=e.target.value!=='SCHOLARSHIP')});
CHG.formCourse=el=>{const f=el.form;if(!f)return;const c=f.course.value,y=+f.admissionYear.value;
  if(el.name==='course'){$('#batchWrap').innerHTML=batchSelect(c,y);$('#semWrap').innerHTML=semSelect(c,Math.min(+f.sem.value||1,semsOf(c).length))}
  const isNew=f.dataset.form==='addStudent';const sameLen=semsOf(c).every(n=>f['fee'+n]);
  if(isNew&&!ui.feeTouched||!sameLen){$('#semFees').innerHTML=semFeeFields(c,semsOf(c).map(n=>({sem:n,amount:(db.settings.feeDefault[c]||[])[n-1]||0,due:defaultDue(c,y,n)})));$('#feeNote').textContent=feeNoteText(c)}
  loginPrev(f)};
CHG.photo=el=>{const file=el.files&&el.files[0];if(!file)return;if(!/^image\//.test(file.type))throw new Error('Choose an image file');
  const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{const c=document.createElement('canvas'),S=160;const r=Math.max(S/img.width,S/img.height);c.width=c.height=S;const g=c.getContext('2d');g.drawImage(img,(S-img.width*r)/2,(S-img.height*r)/2,img.width*r,img.height*r);ui.photo=c.toDataURL('image/jpeg',.8);URL.revokeObjectURL(url);$('#photoPrev').innerHTML=`<img class="av lg" src="${ui.photo}" alt="">`};img.onerror=()=>toast('Could not read this image',true);img.src=url};
ACT.photoClear=()=>{ui.photo='';$('#photoPrev').innerHTML='<div class="av lg">?</div>'};
const MAIL_OK=/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;
function readStudentForm(f,d,old){
  const name=capText(d.name,'Name');if(name.length<2)throw new Error('Enter the student\'s full name');
  const enrol=old?null:readEnrol(d.enrol,null); /* a new student: the office types the enrolment no. */
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
  return{name,gender:d.gender||'',dob:d.dob||'',phone,email,address:capText(d.address,'Address',300),photo:ui.photo||'',course:d.course,admissionYear:y,sem:+d.sem||1,category:d.category,funding:fundOn?d.funding:'CASH',scholarshipNote:fundOn&&d.funding==='SCHOLARSHIP'?capText(d.scholarshipNote,'Scholarship note',120):'',ref:refClean(capText(d.ref,'Admission reference',60)),fees,...(enrol?{enrol}:{})};
}
/* links the typed reference to its saved record (creating it the first time) */
const linkRef=v=>{const r=refEnsure(v.ref,cur().name);v.ref=r?r.name:'';v.refId=r?r.id:'';return v};
FORM.addStudent=(f,d)=>{
  need('students.edit','add students');const v=linkRef(readStudentForm(f,d,null));
  const s=makeStudent({...v,fees:v.fees.map(x=>x.amount),dues:v.fees.map(x=>x.due),createdBy:cur().name,createdAt:Date.now()});
  db.students.push(s);const u=createStudentLogin(s);
  log('Student added','Student',s.enrol,null,{name:s.name,enrol:s.enrol,course:s.course,sem:s.sem,category:s.category,funding:s.funding,ref:s.ref,fees:s.fees.map(x=>inr(x.amount)).join(' / ')});
  sendCredentials(s,u.password,'new');save();closeLayer();renderPage();openStudent(s.id);
  toast(`${s.name} added · login ID and password are being emailed to ${s.email}`);
};
ACT.openStudentD=el=>{closeDialog();openStudent(el.dataset.id)};
FORM.editStudent=(f,d)=>{
  need('students.edit','edit students');guardStudent(f.dataset.id);const s=stu(f.dataset.id);if(!s)throw new Error('Student not found');const v=readStudentForm(f,d,s);
  const before={name:s.name,ref:s.ref||'',phone:s.phone,email:s.email,course:s.course,sem:s.sem,category:s.category,funding:s.funding,status:s.status,fees:s.fees.map(x=>inr(x.amount)).join(' / '),enrol:s.enrol};
  if(d.enrol!==undefined&&!canChangeEnrol())throw new Error('Only the Principal can change the enrolment no.');
  const en=d.enrol!==undefined?readEnrol(d.enrol,s):s.enrol;
  if(v.fees.some(x=>{const sm=semSummary(s,x.sem);return x.amount<sm.paid}))throw new Error('A semester fee cannot be lower than what is already paid for it');
  linkRef(v);
  const u=db.users.find(x=>x.id===s.userId);
  if(en!==s.enrol){if(u)u.username=en.toLowerCase();s.enrol=en}
  Object.assign(s,v);if(d.status&&statusLabel[d.status])s.status=d.status;
  if(u){u.name=s.name;u.email=s.email;u.phone=s.phone;u.active=s.status==='ACTIVE'||s.status==='PASSED'}
  const after={name:s.name,ref:s.ref||'',phone:s.phone,email:s.email,course:s.course,sem:s.sem,category:s.category,funding:s.funding,status:s.status,fees:s.fees.map(x=>inr(x.amount)).join(' / '),enrol:s.enrol};
  const b={},a={};Object.keys(after).forEach(k=>{if(String(before[k])!==String(after[k])){b[k]=before[k];a[k]=after[k]}});
  if(Object.keys(a).length)log('Student edited','Student',s.enrol,b,a);
  save();closeLayer();renderPage();openStudent(s.id);toast('Saved');
};

/* ---------- login details ---------- */
function sendCredentials(s,pw,why){
  const rec=queueMail({kind:'credentials',studentId:s.id,to:[s.email],subject:`Your ${db.college.short} student login`,why,pw});
  s.cred={status:rec.status,at:Date.now(),to:s.email,mailId:rec.id};
  notify('credentials',why==='new'?'Welcome to the NPCTE student portal':why==='reset'?'Your password was reset by the college office':'Your login details were sent again',`Check ${s.email} for your login ID and password.`,{students:[s.id],portal:'sprofile',self:true});
}
/* students never change or reset their own password (change 1). Staff with students.password resend or reset it. */
const stuLogin=id=>{need('students.password','student passwords');guardStudent(id);const s=stu(id);const u=s&&db.users.find(x=>x.id===s.userId);if(!u)throw new Error('This student has no login');return{s,u}};
ACT.resendCred=el=>{const{s,u}=stuLogin(el.dataset.id);
  log('Login details resent','Student',s.enrol,null,null,'Current password emailed');sendCredentials(s,u.password,'resend');save();openStudent(s.id);toast('Login details are being emailed to '+s.email)};
ACT.resetPw=el=>{const{s}=stuLogin(el.dataset.id);const def=studentPwOf(s);
  dialog(`<h3>Reset password</h3><p class="muted" style="margin:0 0 14px">${E(s.name)} · ${E(s.enrol)}. The new password is emailed to ${E(s.email)}. The student cannot change it.</p>
   <form data-form="stuPwReset" data-id="${E(s.id)}" class="grid" style="gap:12px">
    <fieldset class="fs-plain pw-kind"><legend class="label">New password</legend>
     <label class="chk"><input type="radio" name="kind" value="default" checked data-change="pwKind"> <span>Default rule: <b class="mono">${E(def)}</b><small class="muted" style="display:block">First 5 digits of the mobile @ the year the batch starts</small></span></label>
     <label class="chk"><input type="radio" name="kind" value="custom" data-change="pwKind"> <span>Type a different password</span></label></fieldset>
    <div class="field" id="pwCustom" hidden><label class="label" for="f_pw">Password *</label><input id="f_pw" name="pw" maxlength="40" autocomplete="off" spellcheck="false"><small class="muted">6 to 40 characters, no spaces.</small></div>
    <div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeDialog">Cancel</button><button class="btn primary">Reset and email</button></div></form>`,'Reset password')};
CHG.pwKind=el=>{const c=el.value==='custom';const w=$('#pwCustom');if(w)w.hidden=!c;const i=$('#f_pw');if(i){i.required=c;if(c)i.focus()}};
FORM.stuPwReset=(f,d)=>{const{s,u}=stuLogin(f.dataset.id);const custom=d.kind==='custom';
  const pw=custom?String(d.pw||''):studentPwOf(s);
  if(custom&&!/^\S{6,40}$/.test(pw))throw new Error('Password: 6 to 40 characters, no spaces');
  u.password=pw;u.mustChange=false;delete LOCK[u.username];delete LOCK[(u.email||'').toLowerCase()]; /* a locked-out student can sign in again */
  log('Student password reset','Student',s.enrol,null,null,custom?'Set by the office':'Reset to the default rule');
  sendCredentials(s,pw,'reset');save();closeDialog();openStudent(s.id);toast('New password is being emailed to '+s.email)};

/* ---------- profile ---------- */
function semCards(s,o={}){
  return`<div class="semcards">${feeSum(s).sems.map(m=>{const pct=m.amount?Math.round((m.paid+m.adj)/m.amount*100):100;const tone=m.status==='Paid'?'good':m.overdue?'bad':m.started&&m.due?'warn':'';
    return`<div class="semcard ${tone}"><div class="sc-h"><b>Semester ${m.sem}</b>${pill(m.overdue?'Overdue':m.status,tone)}</div>
    <div class="sc-r"><span>Fee</span><b>${inr(m.amount)}</b></div><div class="sc-r"><span>Paid</span><b>${inr(m.paid)}</b></div>${m.adj?`<div class="sc-r"><span>Expense adj.</span><b>${inr(m.adj)}</b></div>`:''}<div class="sc-r"><span>Due</span><b class="${m.due?'t-'+(m.overdue?'bad':'warn'):''}">${inr(m.due)}</b></div>
    <div class="bar ${m.overdue?'bad':''}"><i style="width:${Math.min(100,pct)}%"></i></div><small class="muted">${m.dueDate?'Due date '+fmtD(m.dueDate):'No due date'}</small>
    ${o.collect&&m.due>0&&can('fees.collect')&&s.status==='ACTIVE'?`<button class="btn sm primary" data-act="collectFor" data-id="${E(s.id)}" data-sem="${m.sem}">Collect</button>`:''}
    ${o.pay&&m.due>0?`<button class="btn ${m.started?'primary':''}" data-act="payNow" data-sem="${m.sem}"><span class="pay2"><b>Pay ${inr(m.due)}</b><small>${m.started?'with UPI':'in advance · UPI'}</small></span></button>`:''}</div>`}).join('')}</div>`;
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
   <div class="facts">${L('Mobile',s.phone)}${L('Email',s.email)}${L('Gender',{F:'Female',M:'Male',O:'Other'}[s.gender])}${L('Date of birth',fmtD(s.dob))}${L('Category',s.category)}${L('Funding',fundLabel(s.funding)+(s.scholarshipNote?' · '+s.scholarshipNote:''))}${L('Admission year',s.admissionYear)}${L('Admission reference',s.ref)}${L('Address',s.address)}</div>
   <h3>Semester fees ${pill('Due now '+inr(sm.payable),sm.payable?(sm.overdue?'bad':'warn'):'good')}</h3>${semCards(s,{collect:true})}
   <h3>Payments and receipts</h3><div class="tablewrap"><table><thead><tr><th>Receipt</th><th>Invoice date</th><th>Sem</th><th>Mode</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>
   ${pays.map(p=>`<tr><td class="mono">${E(p.rc)}</td><td>${fmtD(p.invoiceDate)}</td><td>${p.sem}</td><td>${modePill(p.mode)}</td><td class="num amt">${inr(p.amount)}${splitLine(p)}</td><td>${payPill(p.status)}</td><td><button class="btn sm" data-act="viewReceipt" data-id="${E(p.id)}">Receipt</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">No payments yet.</td></tr>'}</tbody></table></div>
   <h3>Login</h3><div class="panel" style="padding:12px"><div class="rline"><span>Login ID</span><b class="mono">${E(u?u.username:'—')} · ${E(s.email)}</b></div>
    <div class="rline"><span>Credentials email</span><span>${mail?mailPill(mail.status)+' <small class="muted">'+E(fmtT(mail.sentAt||mail.at||mail.ts))+'</small>':pill('Not sent','warn')}</span></div>
    <div class="rline"><span>Password</span><span>${u?(u.password===studentPwOf(s)?pill('Default rule','good')+' <small class="muted">mobile 5 digits @ batch year</small>':pill('Set by the office','acc')):'—'}</span></div>
    <div class="rline"><span>Last sign-in</span><span>${u&&u.lastLoginAt?E(fmtT(u.lastLoginAt)):'Never'}</span></div>
    ${can('students.password')?`<div class="actions" style="margin-top:8px"><button class="btn sm" data-act="resendCred" data-id="${E(s.id)}">Resend login details</button><button class="btn sm" data-act="resetPw" data-id="${E(s.id)}">Reset password</button></div>`:'<p class="note" style="margin:8px 0 0">Password reset is done by staff with the "Reset student passwords" permission.</p>'}</div>
   <h3>Notices sent to this student</h3><div class="list">${notes.slice(0,8).map(n=>`<div class="li"><div><b>${E(n.title)}</b><small>${fmtT(n.publishAt)} · ${E(audienceLabel(n.audience))}</small></div>${n.isFeeAlert?pill('Fee alert','warn'):''}</div>`).join('')||'<p class="note">No notices yet.</p>'}</div>
   ${can('activity.view')?`<h3>Audit trail</h3><div class="list">${trail.map(a=>`<div class="li"><div><b>${E(a.action)}</b><small>${E(fmtT(a.at))} · ${E(a.actor)} (${E(a.role)})${a.after?' · '+E(diffText(a.before,a.after)):''}</small></div></div>`).join('')||'<p class="note">Nothing yet.</p>'}</div>`:''}`,true,s.name);
}
ACT.openStudent=el=>openStudent(el.dataset.id);
const diffText=(b,a)=>{if(!a)return'';return Object.keys(a).map(k=>`${k}: ${b&&b[k]!==undefined?b[k]+' → ':''}${a[k]}`).join(', ').slice(0,220)};

/* ---------- CSV import (spec §15.6: a template for students only) ---------- */
const IMPORT_COLS=['enrol','name','gender','dob','phone','email','address','course','admissionYear','sem','category','funding','fee1','fee2','fee3','fee4','ref'];
ACT.importStudents=()=>{need('students.edit');drawer(`<button class="btn x" data-act="close">Close</button><h2>Import students from CSV</h2>
  <p class="muted">Save your Excel sheet as CSV with these columns (first row = headings). Enrolment no. (enrol) is required and must be new, dates as YYYY-MM-DD, course code (e.g. BED or MED), funding CASH or SCHOLARSHIP, fees in rupees (blank = default). Each imported student gets a login (password = first 5 digits of the mobile @ batch year) and an email.</p>
  <div class="actions" style="margin:10px 0"><button class="btn" data-act="importTpl">Download template</button><label class="btn"><input type="file" accept=".csv,text/csv" class="sr" data-change="importFile"> Choose CSV file</label></div>
  <div id="importOut"></div>`,true)};
ACT.importTpl=()=>download('npcte-student-import-template.csv','﻿'+csvOf(IMPORT_COLS,[['BED'+today().slice(2,4)+'-001','Riya Patel','F','2003-04-15','9876543210','riya.patel@example.com','Mahesana','BED',today().slice(0,4),'1','SC','SCHOLARSHIP','30000','30000','30000','30000','COLLEGE']]),'text/csv;charset=utf-8');
function parseCsv(t){const rows=[];let r=[],v='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'&&t[i+1]==='"'){v+='"';i++}else if(c==='"')q=false;else v+=c}else if(c==='"')q=true;else if(c===','){r.push(v);v=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;r.push(v);rows.push(r);r=[];v=''}else v+=c}if(v||r.length){r.push(v);rows.push(r)}return rows.filter(x=>x.some(y=>y.trim()))}
CHG.importFile=el=>{const file=el.files&&el.files[0];if(!file)return;file.text().then(t=>{
  const rows=parseCsv(t.replace(/^﻿/,''));const hd=rows.shift().map(h=>h.trim());const miss=['enrol','name','phone','email','course','admissionYear','category'].filter(c=>!hd.includes(c));
  if(miss.length){$('#importOut').innerHTML=`<div class="err">Missing columns: ${E(miss.join(', '))}</div>`;return}
  const ok=[],bad=[];rows.forEach((r,i)=>{const d={};hd.forEach((h,j)=>d[h]=(r[j]||'').trim());d.course=(d.course||'').toUpperCase();d.funding=(d.funding||'CASH').toUpperCase();d.sem=d.sem||1;
    (course(d.course)?semsOf(d.course):SEMS).forEach(n=>{d['fee'+n]=d['fee'+n]||String(db.settings.feeDefault[d.course]?db.settings.feeDefault[d.course][n-1]/100:'');d['due'+n]=''});
    try{ui.photo='';const v=readStudentForm(null,d,null);if(ok.some(x=>x.email===v.email))throw new Error('Email repeated in the file');if(ok.some(x=>x.enrol===v.enrol))throw new Error('Enrolment no. repeated in the file');ok.push(v)}catch(e){bad.push(`Row ${i+2}: ${e.message}`)}});
  ui.importRows=ok;$('#importOut').innerHTML=`<div class="panel" style="padding:12px"><p style="margin:0"><b>${ok.length}</b> ready to import${bad.length?`, <b class="t-bad">${bad.length}</b> with problems`:''}.</p>${bad.length?`<ul class="note">${bad.slice(0,20).map(b=>`<li>${E(b)}</li>`).join('')}</ul>`:''}
   ${ok.length?`<button class="btn primary" style="margin-top:10px" data-act="importGo">Import ${ok.length} students</button>`:''}</div>`}).catch(()=>toast('Could not read the file',true))};
ACT.importGo=()=>{need('students.edit');const l=ui.importRows||[];l.forEach(v=>{v.dues=semsOf(v.course).map(n=>defaultDue(v.course,v.admissionYear,n));linkRef(v);const s=makeStudent({...v,fees:v.fees.map(x=>x.amount),createdBy:cur().name});db.students.push(s);const u=createStudentLogin(s);sendCredentials(s,u.password,'new')});
  log('Students imported','Student','',null,{count:l.length});ui.importRows=null;save();closeLayer();renderPage();toast(`${l.length} students imported. Login emails are on their way.`)};
