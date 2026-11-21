/* =====================================================================
   Notice Board (§8) · Audit (§7) · Settings, Roles & Permissions (§2, §11)
   ===================================================================== */

/* ---------- notices ---------- */
const MAX_ATT=450*1024;
function publishNotice(n,cat){
  if(n.publishAt>Date.now())return 0;n.sent=true;
  const k=cat||'notice';
  return notify(k,(n.isFeeAlert&&k==='notice'?'Fee alert: ':'')+n.title,String(n.body).slice(0,160),{audience:n.audience,key:'notice:'+n.id,portal:'snotices',staff:'notices',tone:n.isFeeAlert?'warn':'info',self:true});
}
/* scheduled notices go out when their time comes (the server does this with a job queue) */
setInterval(()=>{if(!db||!cur())return;let n=0;db.notices.forEach(x=>{if(!x.sent&&x.publishAt<=Date.now()){n+=publishNotice(x)>0?1:0;x.sent=true}});if(n){save();updateBell()}},15000);
const unreadNotices=u=>{if(!u||u.role!=='Student')return 0;const s=stu(u.studentId);const r=new Set(u.readNotices||[]);return studentNotices(s).filter(n=>!r.has(n.id)).length};
const studentNotices=s=>db.notices.filter(n=>n.publishAt<=Date.now()&&audienceStudents(n.audience).some(x=>x.id===s.id)).sort((a,b)=>b.publishAt-a.publishAt);
function viewNotices(){
  need('notices.post','the notice board');const f=ui.f.notices=Object.assign({q:'',kind:''},ui.f.notices||{});const q=f.q.toLowerCase();
  const inAud=a=>!a||a.type==='all'||(a.type==='course'||a.type==='sem')&&inScope(a.course)||a.type==='students'&&(a.ids||[]).some(id=>{const x=stu(id);return x&&inScope(x.course)});
  const l=db.notices.filter(n=>inAud(n.audience)&&(!f.kind||(f.kind==='fee'?n.isFeeAlert:f.kind==='public'?n.isPublic:f.kind==='scheduled'?n.publishAt>Date.now():true))&&(!q||(n.title+' '+n.body).toLowerCase().includes(q))).sort((a,b)=>b.publishAt-a.publishAt);
  return head('Notice Board','Notices reach students in their portal with a live notification, sound and a phone popup.','<button class="btn primary" data-act="newNotice">New notice</button>')+
  `<div class="panel"><div class="filters"><input type="search" placeholder="Search notices" aria-label="Search notices" data-live="sq" data-scope="notices" value="${E(f.q)}">${sel('notices','kind','Type',[['','All notices'],['fee','Fee alerts'],['scheduled','Scheduled'],['public','Public (website)']])}</div>
  <div class="nlist">${pageRows(f,l).map(n=>{const reach=audienceStudents(n.audience).length;const sched=n.publishAt>Date.now();return`<article class="ncard">
   <div class="nc-h"><h3>${E(n.title)}</h3><div class="actions">${n.isFeeAlert?pill('Fee alert','warn'):''}${n.isPublic?pill('Public','acc'):''}${sched?pill('Scheduled '+fmtT(n.publishAt),'warn'):pill('Published','good')}</div></div>
   <p>${E(n.body)}</p>${n.attachment?`<button class="lnk" data-act="openAtt" data-id="${E(n.id)}">📎 ${E(n.attachment.name)} (${fmtSize(n.attachment.size)})</button>`:''}
   <small class="muted">${E(audienceLabel(n.audience))} · ${reach} student${reach===1?'':'s'} · ${sched?'goes out':'sent'} ${fmtT(n.publishAt)} · by ${E(n.createdBy)}</small>
   <div class="actions" style="margin-top:8px"><button class="btn sm danger" data-act="delNotice" data-id="${E(n.id)}">Delete</button></div></article>`}).join('')||'<p class="empty">No notices yet.</p>'}</div>${pager('notices',l.length)}</div>`;
}
function noticeForm(){
  const sts=vStudents().filter(s=>s.status==='ACTIVE').sort((a,b)=>a.name.localeCompare(b.name));
  return`<button class="btn x" data-act="close">Close</button><h2>New notice</h2>
  <form data-form="notice" class="grid" style="gap:12px;margin-top:12px">${F('title','Title',{req:true,attrs:'maxlength="100"'})}${F('body','Message',{type:'textarea',req:true,rows:5,attrs:'maxlength="2000"'})}
   <div class="field"><span class="label">Attachment (PDF or image, optional, up to 450 KB)</span><label class="btn sm" style="width:fit-content"><input type="file" class="sr" accept="application/pdf,image/*" data-change="noticeFile"> Choose file</label><small id="attName" class="muted"></small></div>
   <div class="form">${F('aud','Send to',{opts:[...(myCourses().length===db.courses.length?[['all','All students']]:[]),...scopeCourses().map(c=>['c:'+c.id,c.name+' (all semesters)']),['sem','A semester'],['students','Selected students'],['one','One student']],attrs:'data-change="audType"'})}
    <div class="field" id="audSem" hidden><label class="label" for="f_semc">Semester</label><select id="f_semc" name="semc">${scopeCourses().flatMap(c=>semsOf(c.id).map(n=>`<option value="${c.id}-${n}">${E(c.name)} Sem ${n}</option>`)).join('')}</select></div></div>
   <div class="field" id="audStu" hidden><span class="label">Students</span><input type="search" placeholder="Filter list" aria-label="Filter students" data-live="audFilter"><div class="picklist" id="audList">${sts.map(s=>`<label data-n="${E((s.name+' '+s.enrol).toLowerCase())}"><input type="checkbox" name="sid" value="${E(s.id)}"> ${E(s.name)} <small class="muted">${E(s.enrol)} · ${E(classLabel(s))}</small></label>`).join('')}</div></div>
   <div class="form">${F('when','Publish at (optional · empty = now)',{type:'datetime-local'})}<div class="field"><span class="label">Tags</span><label class="chk"><input type="checkbox" name="fee"> Fee alert</label><label class="chk"><input type="checkbox" name="pub"> Public (show on college website)</label></div></div>
   <div class="actions"><button class="btn primary big">Publish notice</button><button type="button" class="btn" data-act="close">Cancel</button></div></form>`;
}
ACT.newNotice=()=>{need('notices.post');ui.att=null;drawer(noticeForm(),true,'New notice');$('#f_title').focus()};
CHG.audType=el=>{$('#audSem').hidden=el.value!=='sem';$('#audStu').hidden=!(el.value==='students'||el.value==='one');$$('#audList input').forEach(i=>i.type=el.value==='one'?'radio':'checkbox')};
LIVE.audFilter=el=>{const q=el.value.toLowerCase();$$('#audList label').forEach(l=>l.hidden=!!q&&!l.dataset.n.includes(q))};
CHG.noticeFile=el=>{const file=el.files&&el.files[0];if(!file)return;if(!/^(application\/pdf|image\/)/.test(file.type))throw new Error('Only PDF or image files');if(file.size>MAX_ATT)throw new Error('File is larger than 450 KB. In the live system files go to cloud storage; this demo keeps them in the browser.');
  const r=new FileReader();r.onload=()=>{ui.att={name:file.name.slice(0,80),type:file.type,size:file.size,data:r.result};$('#attName').textContent=file.name+' · '+fmtSize(file.size)};r.readAsDataURL(file)};
FORM.notice=(f,d)=>{
  need('notices.post');const title=capText(d.title,'Title',100),body=capText(d.body,'Message',2000);if(title.length<3||body.length<3)throw new Error('Write a title and a message');
  let a;const t=d.aud;if(t==='all'){if(myCourses().length!==db.courses.length)throw new Error('Choose one of your courses');a={type:'all'}}else if(/^c:/.test(t)){const c=t.slice(2);if(!mayCourse(c))throw new Error('Not your course');a={type:'course',course:c}}else if(t==='sem'){const[c,n]=d.semc.split('-');if(!mayCourse(c))throw new Error('Not your course');a={type:'sem',course:c,sem:+n}}
  else{const ids=new FormData(f).getAll('sid').filter(id=>mayStudent(id));if(!ids.length)throw new Error('Choose at least one student');a={type:'students',ids:t==='one'?ids.slice(0,1):ids}}
  let at=Date.now();if(d.when){at=new Date(d.when).getTime();if(!(at>0))throw new Error('Check the publish time');if(at<Date.now()-6e4)throw new Error('Publish time is in the past. Leave it empty to publish now.')}
  const reach=audienceStudents(a).length;if(!reach)throw new Error('No active student is in this audience');
  const n={id:uid('n'),title,body,audience:a,isFeeAlert:!!d.fee,isPublic:!!d.pub,publishAt:at,createdBy:cur().name,attachment:ui.att,sent:false};
  db.notices.unshift(n);const sent=publishNotice(n);log('Notice posted','Notice',n.id,null,{title,to:audienceLabel(a),at:fmtT(at)});ui.att=null;
  if(!save()){db.notices.shift();throw new Error('Not enough browser storage for this attachment. Try a smaller file.')}
  closeLayer();renderPage();toast(at>Date.now()?`Scheduled for ${fmtT(at)} · ${reach} students`:`Published to ${reach} students${sent?' · live notification sent':''}`)};
ACT.delNotice=el=>{need('notices.post');const n=db.notices.find(x=>x.id===el.dataset.id);confirmBox('Delete notice',`“${n.title}” will be removed from every student's notice board.`,'Delete',()=>{db.notices=db.notices.filter(x=>x!==n);log('Notice deleted','Notice',n.id,{title:n.title},null);save();renderPage();toast('Notice deleted')},true)};
ACT.openAtt=el=>{const n=db.notices.find(x=>x.id===el.dataset.id);if(!n||!n.attachment)return;const u=cur();if(isStudentUser(u)&&!audienceStudents(n.audience).some(s=>s.id===u.studentId))throw new Error('403 · Not allowed');
  const b=atob(n.attachment.data.split(',')[1]);const arr=new Uint8Array(b.length);for(let i=0;i<b.length;i++)arr[i]=b.charCodeAt(i);download(n.attachment.name,arr,n.attachment.type)};

/* ---------- audit ---------- */
function viewAudit(){
  const tabs=[];if(can('audit.view'))tabs.push(['tx','Transactions'],['cash','Cash']); /* change 7: cash (deposit, expenses, cash in hand, cash book) in one tab; cheque and UPI go to the bank directly */if(can('activity.view'))tabs.push(['activity','Activity log'],['events','Event log']);
  if(ui.tab.audit==='deposit')ui.tab.audit='cash';let t=ui.tab.audit||tabs[0][0];if(!tabs.some(x=>x[0]===t))t=tabs[0][0];ui.tab.audit=t;
  if(t==='activity'||t==='events')need('activity.view','the activity log');else need('audit.view','the audit');
  return head('Audit','Every payment and expense, with filters, totals and exports.','')+tabsBar('audit',tabs,t)+({tx:auditTx,cash:auditCash,activity:auditActivity,events:auditEvents}[t])();
}
/* one row per payment or expense */
function txAll(){
  return vPayments().map(p=>{const s=stu(p.studentId);return{kind:'p',id:p.id,date:p.invoiceDate,entry:p.entryAt,s,sem:p.sem,mode:p.mode,amount:p.amount,ref:p.rc,status:p.status,by:p.by,rec:p,reason:p.reason||'',batch:batchOf(p)}})
   ;
}
function txFilter(){return ui.f['audit.tx']=Object.assign({q:'',modes:[],split:'',from:'',to:'',course:'',batch:'',sem:'',cat:'',fund:'',ref:'',status:'',by:'',min:'',max:'',sort:'date',dir:-1,page:0},ui.f['audit.tx']||{})}
function txFiltered(){
  const f=txFilter();const q=f.q.toLowerCase();const mn=f.min!==''?toPaise(f.min):null,mx=f.max!==''?toPaise(f.max):null;
  let l=txAll().filter(r=>(!f.modes.length||f.modes.includes(r.mode))&&(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to)&&(!f.course||(r.s&&r.s.course===f.course))&&(!f.batch||r.batch===f.batch)&&(!f.sem||r.sem===+f.sem)
   &&(!f.cat||(r.s&&r.s.category===f.cat))&&(!f.fund||(r.s&&r.s.funding===f.fund))&&(!f.ref||(r.s&&refOk(r.s,f.ref)))&&(!f.status||r.status===f.status)&&(!f.modes.includes('CASH')||splitOk(r.rec,f.split))&&(!f.by||r.by===f.by)&&(mn===null||r.amount>=mn)&&(mx===null||r.amount<=mx)
   &&(!q||[r.ref,r.s&&r.s.name,r.s&&r.s.enrol,r.reason,r.batch,r.rec.chequeNo,r.rec.upiRef].some(v=>String(v||'').toLowerCase().includes(q))));
  const k={date:r=>r.date+String(r.entry).padStart(14,'0'),entry:r=>r.entry,name:r=>r.s?r.s.name:'~',course:r=>r.s?r.s.course:'~',batch:r=>r.batch||'~',sem:r=>r.sem||0,cat:r=>r.s?r.s.category:'~',fund:r=>r.s?r.s.funding:'~',mode:r=>r.mode,amount:r=>r.amount,ref:r=>r.ref,status:r=>r.status,by:r=>r.by}[f.sort]||(r=>r.date);
  l.sort((a,b)=>{const A=k(a),B=k(b);return(A<B?-1:A>B?1:0)*f.dir});return l;
}
const txTotals=l=>{const ok=l.filter(r=>r.status==='SUCCESS');const o={};PAY_MODES.forEach(m=>o[m]=sum(ok.filter(r=>r.mode===m),r=>r.amount));o.income=o.CASH+o.CHEQUE+o.UPI;o.EXP=sum(ok,r=>payExp(r.rec));o.CIH=sum(ok,r=>payCih(r.rec));o.BANK=sum(ok,r=>payToBank(r.rec));return o};
function auditTx(){
  const f=txFilter();const sc='audit.tx';const l=txFiltered();const pg=pageRows(f,l);const t=txTotals(l);const bys=[...new Set(txAll().map(r=>r.by))];
  return`<div class="totals">${PAY_MODES.map(m=>`<div class="tt ${MODE_TONE[m]}"><span>${modeName(m)}</span><b>${inr(t[m])}</b>${m==='CASH'&&(t.EXP||t.CIH)?`<small>expense ${inr(t.EXP)} · cash in hand ${inr(t.CIH)}</small>`:''}</div>`).join('')}<div class="tt sum"><span>Cash + Cheque + UPI</span><b>${inr(t.income)}</b></div></div>
  <div class="panel"><div class="filters"><input type="search" placeholder="Search receipt, name, cheque, UTR, reason" aria-label="Search transactions" data-live="sq" data-scope="${sc}" value="${E(f.q)}">
   <div class="chips" role="group" aria-label="Mode">${PAY_MODES.map(m=>`<button type="button" class="chip ${MODE_TONE[m]}" aria-pressed="${f.modes.includes(m)}" data-act="txMode" data-m="${m}">${modeName(m)}</button>`).join('')}</div>${f.modes.includes('CASH')?sel(sc,'split','Cash split',SPLIT_OPTS):''}
   <label class="dl">From <input type="date" value="${E(f.from)}" data-change="sf" data-scope="${sc}" data-k="from"></label><label class="dl">To <input type="date" value="${E(f.to)}" data-change="sf" data-scope="${sc}" data-k="to"></label>
   ${sel(sc,'course','Course',COURSE_OPTS())}${sel(sc,'batch','Batch',payBatchOpts())}${sel(sc,'sem','Semester',SEM_OPTS_())}${sel(sc,'cat','Category',CAT_OPTS)}${sel(sc,'fund','Funding type',FUND_OPTS)}${sel(sc,'ref','Admission reference',REF_OPTS())}${sel(sc,'status','Status',[['','All status'],['SUCCESS','Success'],['CANCELLED','Cancelled'],['FAILED','Failed']])}${sel(sc,'by','Entered by',[['','Anyone'],...bys.map(b=>[b,b])])}
   <input class="numin" placeholder="Min ₹" aria-label="Minimum amount" value="${E(f.min)}" data-change="sf" data-scope="${sc}" data-k="min" inputmode="decimal"><input class="numin" placeholder="Max ₹" aria-label="Maximum amount" value="${E(f.max)}" data-change="sf" data-scope="${sc}" data-k="max" inputmode="decimal">
   <button class="btn sm" data-act="txClear">Clear</button></div>
  <div class="actions" style="margin-bottom:10px"><span class="muted">${l.length} rows</span><span style="flex:1"></span><button class="btn exp-btn" data-act="expOpen" data-key="audit.tx">Export</button></div>
  <div class="tablewrap"><table class="dense"><thead><tr>${sortTh(sc,'date','Invoice date')}${sortTh(sc,'entry','Entry time')}${sortTh(sc,'name','Student')}${sortTh(sc,'course','Course')}${sortTh(sc,'batch','Batch')}${sortTh(sc,'sem','Sem')}${sortTh(sc,'cat','Category')}${sortTh(sc,'fund','Funding')}${sortTh(sc,'mode','Mode')}${sortTh(sc,'amount','Amount',1)}${sortTh(sc,'ref','Receipt / ref')}${sortTh(sc,'status','Status')}${sortTh(sc,'by','Entered by')}</tr></thead><tbody>
  ${pg.map(r=>`<tr><td>${fmtD(r.date)}</td><td><small>${fmtT(r.entry)}</small></td><td>${r.s?`<button class="lnk" data-act="openStudent" data-id="${E(r.s.id)}">${E(r.s.name)}</button>`:`<span class="muted">${E(r.reason||'—')}</span>`}</td><td>${r.s?E(course(r.s.course).name):'—'}</td><td class="mono">${E(r.batch||'—')}</td><td>${r.sem||'—'}</td><td>${r.s?E(r.s.category):'—'}</td><td>${r.s?E(fundLabel(r.s.funding)):'—'}</td><td>${modePill(r.mode)}</td><td class="num amt">${inr(r.amount)}${splitLine(r.rec)}</td><td class="mono">${r.kind==='p'?`<button class="lnk mono" data-act="viewReceipt" data-id="${E(r.id)}">${r.ref?E(r.ref):'Invoice no. pending'}</button>`:E(r.ref)}</td><td>${payPill(r.status)}</td><td>${E(r.by)}</td></tr>`).join('')||'<tr><td colspan="13" class="empty">No transactions for these filters.</td></tr>'}
  </tbody></table></div>${pager(sc,l.length)}</div>`;
}
ACT.txMode=el=>{const f=txFilter();const m=el.dataset.m;f.modes=f.modes.includes(m)?f.modes.filter(x=>x!==m):[...f.modes,m];if(!f.modes.includes('CASH'))f.split='';f.page=0;renderPage()};
ACT.txClear=()=>{const f=txFilter();ui.f['audit.tx']={sort:f.sort,dir:f.dir,page:0};renderPage()};
const txCols=['Invoice date','Entry time','Student','Enrolment no','Course','Batch','Sem','Category','Funding','Mode','Amount (₹)','Expense now (₹)','Cash in hand (₹)','To bank (₹)','Receipt / ref','Status','Entered by','Cheque no','Bank','UPI ref','Reason'];
const txRow=r=>[fmtD(r.date),fmtT(r.entry),r.s?r.s.name:'',r.s?r.s.enrol:'',r.s?course(r.s.course).name:'',r.batch||'',r.sem||'',r.s?r.s.category:'',r.s?fundLabel(r.s.funding):'',modeName(r.mode),r.amount/100,payExp(r.rec)/100,payCih(r.rec)/100,payToBank(r.rec)/100,r.ref,r.status,r.by,r.rec.chequeNo||'',r.rec.bank||'',r.rec.upiRef||'',r.reason||r.rec.cancelReason||''];
ACT.txCsv=()=>{need('audit.view');const l=txFiltered();const t=txTotals(l);showCsv('NPCTE transactions',txCols,[...l.map(txRow),[],['Totals (successful)','','','','','','','','','Cash',t.CASH/100],['','','','','','','','','','Cheque',t.CHEQUE/100],['','','','','','','','','','UPI',t.UPI/100],['','','','','','','','','','Of cash: expense now',t.EXP/100],['','','','','','','','','','Of cash: cash in hand',t.CIH/100]]);log('Audit exported','Audit','',null,{rows:l.length,format:'Excel'})};
/* printable report with the college header: the browser's "Save as PDF" makes the PDF */
function printReport(title,sub,cols,rows,foot){
  const c=db.college;const w=$('#printArea')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'printArea'}));
  w.innerHTML=`<div class="ph"><div><b>${E(c.name)}</b><div>${E(c.trust)} · ${E(c.address)} · ${E(c.phone)}</div></div><div class="right"><b>${E(title)}</b><div>${E(sub)}</div><div>Printed ${E(fmtT(Date.now()))} by ${E(cur().name)}</div></div></div>
   <table><thead><tr>${cols.map(x=>`<th>${E(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${E(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>${foot||''}`;
  document.body.classList.add('printing');setTimeout(()=>{window.print();document.body.classList.remove('printing')},60);
}
ACT.txPrint=()=>{need('audit.view');const f=txFilter();const l=txFiltered();const t=txTotals(l);
  printReport('Transactions audit',`${f.from?fmtD(f.from):'Start'} to ${f.to?fmtD(f.to):fmtD(today())}${f.modes.length?' · '+f.modes.map(modeName).join(', '):''}`,['Invoice date','Student','Course','Sem','Category','Funding','Mode','Amount','Receipt','Status','By'],
   l.map(r=>[fmtD(r.date),r.s?r.s.name+' ('+r.s.enrol+')':r.reason,r.s?course(r.s.course).name:'',r.sem||'',r.s?r.s.category:'',r.s?fundLabel(r.s.funding):'',modeName(r.mode),inr(r.amount),r.ref,r.status,r.by]),
   `<p class="pt">Cash ${inr(t.CASH)} (expense ${inr(t.EXP)}, cash in hand ${inr(t.CIH)}) · Cheque ${inr(t.CHEQUE)} · UPI ${inr(t.UPI)} · Fees received ${inr(t.income)} · ${l.length} rows</p>`);log('Audit exported','Audit','',null,{rows:l.length,format:'PDF'})};

/* period chips of Audit → Cash (change 7): this week, last week, this month, last month, all, custom */
function weekStart(iso){const d=parseD(iso);const k=(d.getDay()+6)%7;return addDays(iso,-k)}
function depPeriod(){const f=ui.f.dep=Object.assign({p:'month',from:'',to:''},ui.f.dep||{});const T=today();if(f.p==='all')return{from:'',to:'',f};
  if(f.p==='week')return{from:weekStart(T),to:addDays(weekStart(T),6),f};if(f.p==='lastweek'){const w=addDays(weekStart(T),-7);return{from:w,to:addDays(w,6),f}}
  if(f.p==='month')return{from:T.slice(0,8)+'01',to:addDays(isoOf(new Date(+T.slice(0,4),+T.slice(5,7),1)),-1),f};
  if(f.p==='lastmonth'){const d=new Date(+T.slice(0,4),+T.slice(5,7)-2,1);return{from:isoOf(d),to:addDays(isoOf(new Date(d.getFullYear(),d.getMonth()+1,1)),-1),f}}
  return{from:f.from||addDays(T,-30),to:f.to||T,f}}
ACT.depP=el=>{depPeriod().f.p=el.dataset.p;renderPage()};

/* activity log (§7B): read-only, Principal and Super Admin */
function actFiltered(){const f=ui.f.act=Object.assign({q:'',role:'',from:'',to:'',page:0},ui.f.act||{});const q=f.q.toLowerCase();
  return auditVisible().filter(a=>(!f.role||a.role===f.role)&&(!f.from||istDate(a.at)>=f.from)&&(!f.to||istDate(a.at)<=f.to)&&(!q||[a.action,a.actor,a.entity,a.entityId,a.detail,JSON.stringify(a.after||''),JSON.stringify(a.before||'')].some(v=>String(v).toLowerCase().includes(q))))}
function auditActivity(){
  need('activity.view');const l=actFiltered();const f=ui.f.act;
  const pg=pageRows(f,l);
  return`<div class="panel"><h2>Activity log ${pill(l.length+' actions')}<button class="btn exp-btn" data-act="expOpen" data-key="activity">Export</button></h2>
   <div class="filters"><input type="search" placeholder="Search action, person, receipt, value" aria-label="Search activity" data-live="sq" data-scope="act" value="${E(f.q)}">${sel('act','role','Role',[['','All roles'],...ROLE_NAMES.map(r=>[r,r]),['System','System']])}
    <label class="dl">From <input type="date" value="${E(f.from)}" data-change="sf" data-scope="act" data-k="from"></label><label class="dl">To <input type="date" value="${E(f.to)}" data-change="sf" data-scope="act" data-k="to"></label></div>
   <div class="tablewrap"><table class="dense"><thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Record</th><th>Before → after</th><th>IP · device</th></tr></thead><tbody>
   ${pg.map(a=>`<tr><td><small>${fmtT(a.at)}</small></td><td>${E(a.actor)}<small class="muted" style="display:block">${E(a.role)}</small></td><td class="wrap"><b>${E(a.action)}</b>${a.detail?`<small class="muted" style="display:block">${E(a.detail)}</small>`:''}</td><td class="mono">${E(a.entity)}${a.entityId?' · '+E(a.entityId):''}</td><td class="wrap"><small>${E(diffText(a.before,a.after))||'—'}</small></td><td class="wrap"><small>${E(a.ip)}<br>${E(a.device)}</small></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nothing found.</td></tr>'}</tbody></table></div>${pager('act',l.length)}
   <p class="note">Read-only. Nobody can edit or delete these entries.</p></div>`;
}
ACT.actCsv=()=>{need('activity.view');showCsv('NPCTE activity log',['Time','Who','Role','Action','Entity','Record','Before','After','Detail','IP','Device'],auditVisible().map(a=>[fmtT(a.at),a.actor,a.role,a.action,a.entity,a.entityId,JSON.stringify(a.before||''),JSON.stringify(a.after||''),a.detail,a.ip,a.device]))};

/* event log: every sign-in, page, click, form, filter and error of every login (read-only) */
const EV_CATS=['Auth','Page','Click','Form','Change','Error'];
function eventsVisible(){evMerge();const u=cur();const l=db.events||[];if(u.role==='Super Admin')return l;return l.filter(e=>logActorOk(e.actorId))}
function evFiltered(){const f=ui.f.evl=Object.assign({q:'',cat:'',who:'',role:'',from:'',to:'',page:0},ui.f.evl||{});const q=f.q.toLowerCase();
  return eventsVisible().filter(e=>(!f.cat||e.cat===f.cat)&&(!f.who||e.actorId===f.who)&&(!f.role||e.role===f.role)&&(!f.from||istDate(e.at)>=f.from)&&(!f.to||istDate(e.at)<=f.to)&&(!q||[e.label,e.detail,e.actor,e.route].some(v=>String(v||'').toLowerCase().includes(q))))}
function auditEvents(){
  need('activity.view');const l=evFiltered();const f=ui.f.evl;const pg=pageRows(f,l);const who=[...new Map(eventsVisible().filter(e=>e.actorId).map(e=>[e.actorId,e.actor])).entries()];
  const tone={Auth:'acc',Page:'',Click:'',Form:'good',Change:'',Error:'bad'};
  return`<div class="panel"><h2>Event log ${pill(l.length+' events')}<button class="btn exp-btn" data-act="expOpen" data-key="events">Export</button></h2>
   <p class="note" style="margin:0 0 10px">Every sign-in, page, tab, button, form, filter and error, for every login. Data changes with before → after are in the Activity log.</p>
   <div class="filters"><input type="search" placeholder="Search button, page, person, detail" aria-label="Search events" data-live="sq" data-scope="evl" value="${E(f.q)}">${sel('evl','cat','Type',[['','All types'],...EV_CATS.map(c=>[c,c])])}${sel('evl','role','Role',[['','All roles'],...ROLE_NAMES.map(r=>[r,r]),['Guest','Guest (signed out)']])}${sel('evl','who','Person',[['','Everyone'],...who.map(([id,n])=>[id,n])])}
    <label class="dl">From <input type="date" value="${E(f.from)}" data-change="sf" data-scope="evl" data-k="from"></label><label class="dl">To <input type="date" value="${E(f.to)}" data-change="sf" data-scope="evl" data-k="to"></label></div>
   <div class="tablewrap"><table class="dense"><thead><tr><th>Time</th><th>Who</th><th>Type</th><th>What</th><th>Detail</th><th>Page</th><th>Device</th></tr></thead><tbody>
   ${pg.map(e=>`<tr><td><small>${fmtT(e.at)}</small></td><td>${E(e.actor)}<small class="muted" style="display:block">${E(e.role)}</small></td><td>${pill(e.cat,e.status==='fail'?'bad':tone[e.cat]||'')}</td><td><b>${E(e.label)}</b></td><td class="wrap"><small>${E(e.detail)||'—'}</small></td><td><small>${E(humanize(e.route))||'—'}${e.course?' · '+E((course(e.course)||{}).name||e.course):''}</small></td><td class="wrap"><small>${E(e.device)}</small></td></tr>`).join('')||'<tr><td colspan="7" class="empty">No events for these filters.</td></tr>'}</tbody></table></div>${pager('evl',l.length)}
   <p class="note">Read-only. The newest ${EV_MAX} events are kept in this demo; the live system keeps them on the server.</p></div>`}
ACT.evCsv=()=>{need('activity.view');showCsv('NPCTE event log',['Time','Who','Role','Type','What','Detail','Page','Course','Status','Device'],evFiltered().map(e=>[fmtT(e.at),e.actor,e.role,e.cat,e.label,e.detail,e.route,e.course,e.status,e.device]))};
/* ---------- settings ---------- */
/* activity log: Super Admin sees everything; others see actions of logins that share one of their courses */
function auditVisible(){const u=cur();if(u.role==='Super Admin')return db.audit;return db.audit.filter(a=>logActorOk(a.actorId))}
/* a log row is visible when it is your own, or by a lower role inside your courses (a Principal never sees the Super Admin; a Clerk never sees a Principal) */
function logActorOk(id){const u=cur();if(u.role==='Super Admin')return true;if(id===u.id)return true;const x=db.users.find(y=>y.id===id);if(!x)return false;if((ROLE_RANK[x.role]??9)>=(ROLE_RANK[u.role]??0))return false;
  const mine=new Set(myCourses());return x.role==='Student'?mine.has((stu(x.studentId)||{}).course):(x.courses||[]).some(c=>mine.has(c))}
function viewSettings(){
  const tabs=[];if(can('settings.manage'))tabs.push(['college','College profile']);if(can('fees.setup'))tabs.push(['fees','Fees & receipts']);if(can('roles.manage'))tabs.push(['roles','Roles & permissions']);
  if(cur().role==='Super Admin')tabs.push(['courses','Courses'],['users','Staff logins']);if(can('settings.manage'))tabs.push(['mail','Email & alerts'],['flags','Open items']);if(cur().role==='Super Admin')tabs.push(['data','Data']);
  for(let i=tabs.length-1;i>=0;i--)if(SETTINGS_HIDDEN.includes(tabs[i][0]))tabs.splice(i,1);
  let t=ui.tab.settings||tabs[0][0];if(!tabs.some(x=>x[0]===t))t=tabs[0][0];ui.tab.settings=t;
  return head('Settings',`${db.college.short} · ${db.college.trust}`,'')+tabsBar('settings',tabs,t)+({college:setCollege,fees:()=>feeSetup(),roles:setRoles,courses:setCourses,users:setUsers,mail:setMail,flags:setFlags,data:setData}[t])();
}
/* Settings tabs hidden for now (20-11-2026): email & alerts, open items and demo data. Empty the list to show them again. */
const SETTINGS_HIDDEN=['mail','flags','data'];
function setCollege(){need('settings.manage');const c=db.college;const R=Object.assign(RCPT_DEFAULT(),c.rcpt||{});
  return`<form class="scard" data-form="college" style="max-width:820px"><h2>College profile</h2><p class="note" style="margin:0 0 12px">Shown on receipts, reports and the login screen.</p><div class="form">
   ${F('name','College name',{val:c.name,req:true,span:1,attrs:'maxlength="120"'})}${F('short','Short name',{val:c.short,req:true,attrs:'maxlength="12"'})}${F('trust','Trust',{val:c.trust,req:true,attrs:'maxlength="80"'})}
   ${F('address','Address',{type:'textarea',val:c.address,span:1,rows:2})}${F('phone','Phone',{val:c.phone,attrs:'maxlength="40"'})}${F('email','Email',{type:'email',val:c.email})}${F('website','Website',{val:c.website})}${F('year','Academic year',{val:c.year,attrs:'maxlength="9"'})}</div>
   <h3 style="margin:18px 0 4px">Receipt (fee invoice) header</h3><p class="note" style="margin:0 0 10px">Printed at the top of every fee invoice, exactly as the college's invoice design.</p>
   <div class="form">${RCPT_FIELDS.map(([k,l,w])=>F('r_'+k,l,{val:R[k],span:w?1:0,attrs:'maxlength="140"'})).join('')}</div>
   <div class="actions" style="margin-top:12px"><button class="btn primary">Save</button></div></form>`}
const RCPT_FIELDS=[['fullName','College name on the invoice',1],['trustLine','Trust line',1],['address','Address bar',1],['naac','Accreditation line',1],['mobCollege','College mobile'],['mobTrust','Trust mobile'],['email','Email on the invoice'],['web','Website on the invoice'],['signFor','Signature line',1]];
FORM.college=(f,d)=>{need('settings.manage');const c=db.college;const before={...c};['name','short','trust','address','phone','email','website','year'].forEach(k=>{c[k]=capText(d[k],k,k==='address'?300:120)});if(!c.name||!c.short)throw new Error('Name and short name are required');
  const rb=JSON.stringify(c.rcpt||{});c.rcpt=Object.assign(RCPT_DEFAULT(),c.rcpt||{});RCPT_FIELDS.forEach(([k,l])=>{if(d['r_'+k]!==undefined){const v=capText(d['r_'+k],l,140);if(!v)throw new Error(l+' is required');c.rcpt[k]=v}});before.rcpt=rb;if(JSON.stringify(c.rcpt)===rb)delete before.rcpt;else c._rc=1;
  const a={},b={};Object.keys(c).forEach(k=>{if(k==='rcpt'||k==='_rc')return;if(before[k]!==c[k]){a[k]=c[k];b[k]=before[k]}});if(c._rc){a.receiptHeader='changed';delete c._rc}log('College profile changed','Settings','college',b,a);save();renderApp();toast('Saved')};
function setRoles(){need('roles.manage');const sa=cur().role==='Super Admin';const editable=STAFF_ROLES.filter(r=>cur().role==='Super Admin'||r!=='Principal');
  return`<div class="scard"><h2>Roles & permissions</h2><p class="note" style="margin:0 0 12px">Ticks are checked by the server on every request, not only by hiding buttons. Super Admin always has everything; the Student role sees only its own portal.${cur().role==='Principal'?' The Principal row can be changed by the Super Admin only.':''}</p>
  <div class="tablewrap"><table class="matrix"><thead><tr><th>Permission</th>${sa?'<th>Super Admin</th>':''}${STAFF_ROLES.map(r=>`<th>${E(r)}</th>`).join('')}<th>Student</th></tr></thead><tbody>
  ${PERMS.map(([k,l])=>`<tr><td>${E(l)}<small class="muted mono" style="display:block">${E(k)}</small></td>${sa?`<td><input type="checkbox" checked disabled aria-label="Super Admin: ${E(l)}"></td>`:''}${STAFF_ROLES.map(r=>{const po=r==='Clerk'&&PRINCIPAL_ONLY.includes(k);return`<td><input type="checkbox" aria-label="${E(r)}: ${E(l)}" ${!po&&(db.roles[r]||[]).includes(k)?'checked':''} ${editable.includes(r)&&!po&&!(r==='Principal'&&k==='roles.manage')?'':'disabled'} data-change="perm" data-r="${E(r)}" data-p="${E(k)}">${po?'<small class="muted" style="display:block">Principal only</small>':''}</td>`}).join('')}<td><input type="checkbox" disabled aria-label="Student: ${E(l)}"></td></tr>`).join('')}</tbody></table></div>
  <div class="actions" style="margin-top:12px"><button class="btn" data-act="permReset">Restore defaults</button></div></div>`}
CHG.perm=el=>{need('roles.manage');const r=el.dataset.r,p=el.dataset.p;if(r==='Clerk'&&PRINCIPAL_ONLY.includes(p))throw new Error('This stays with the Principal');if(!STAFF_ROLES.includes(r)||!PERMS.some(x=>x[0]===p))throw new Error('Unknown permission');if(r==='Principal'&&cur().role!=='Super Admin')throw new Error('Only the Super Admin can change the Principal role');if(r==='Principal'&&p==='roles.manage')throw new Error('The Principal always keeps this');
  const l=db.roles[r]=db.roles[r]||[];const had=l.includes(p);if(el.checked&&!had)l.push(p);if(!el.checked&&had)l.splice(l.indexOf(p),1);log('Permission changed','Role',r,{[p]:had},{[p]:el.checked});save();toast(`${r}: ${PERMS.find(x=>x[0]===p)[1]} ${el.checked?'allowed':'removed'}`)};
ACT.permReset=()=>{need('roles.manage');confirmBox('Restore default permissions','Principal and Clerk go back to the permissions in the spec.','Restore',()=>{const before=JSON.stringify(db.roles);const d=DEFAULT_ROLES();if(cur().role!=='Super Admin')d.Principal=db.roles.Principal;db.roles=d;log('Permissions reset','Role','',{roles:before},{roles:JSON.stringify(d)});save();renderPage();toast('Defaults restored')})};
function setUsers(){if(cur().role!=='Super Admin')throw new Error('Only the Super Admin manages staff logins');const l=db.users.filter(u=>u.role!=='Student');
  return`<div class="scard"><h2>Staff logins <button class="btn primary" data-act="newUser">Add Principal / Clerk login</button></h2><div class="tablewrap"><table><thead><tr><th>Name</th><th>Role</th><th>Courses</th><th>Username</th><th>Email</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead><tbody>
  ${l.map(u=>`<tr><td><b>${E(u.name)}</b></td><td>${E(u.role)}</td><td>${u.role==='Super Admin'?'<small class="muted">All courses</small>':(u.courses||[]).map(id=>course(id)?pill(course(id).name,'acc'):'').join(' ')||pill('None','bad')}</td><td class="mono">${E(u.username)}</td><td>${E(u.email)}</td><td><small>${u.lastLoginAt?fmtT(u.lastLoginAt):'Never'}</small></td><td>${u.active?pill('Active','good'):pill('Off','bad')}</td><td>${u.id===cur().id?`<div class="actions nowrap"><button class="btn sm" data-act="editUser" data-id="${E(u.id)}">Edit</button><small class="muted">You</small></div>`:`<div class="actions nowrap"><button class="btn sm" data-act="editUser" data-id="${E(u.id)}">Edit</button><button class="btn sm" data-act="userCourses" data-id="${E(u.id)}">Courses</button><button class="btn sm" data-act="userToggle" data-id="${E(u.id)}">${u.active?'Switch off':'Switch on'}</button><button class="btn sm" data-act="userPw" data-id="${E(u.id)}">Reset password</button></div>`}</td></tr>`).join('')}</tbody></table></div></div>`}
ACT.newUser=()=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');drawer(`<button class="btn x" data-act="close">Close</button><h2>Add staff login</h2><form data-form="newUser" class="form" style="margin-top:12px">${F('name','Full name',{req:true,span:1})}${F('role','Role',{opts:STAFF_ROLES})}${courseChecks([])}${F('username','Username',{req:true,attrs:'autocapitalize="off" maxlength="30"'})}${F('email','Email',{type:'email',req:true,span:1})}<p class="note span">A temporary password is created; they must change it at first sign-in.</p><div class="actions span"><button class="btn primary">Create login</button></div></form>`)};
FORM.newUser=(f,d)=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');const un=String(d.username||'').trim().toLowerCase();if(!/^[a-z0-9._-]{3,30}$/.test(un))throw new Error('Username: 3-30 letters, numbers, . _ -');if(db.users.some(u=>u.username.toLowerCase()===un))throw new Error('This username is taken');
  const email=String(d.email||'').trim().toLowerCase();if(!MAIL_OK.test(email))throw new Error('Enter a valid email');if(!STAFF_ROLES.includes(d.role))throw new Error('Choose a role');const courses=readCourseChecks(f);const name=capText(d.name,'Name');if(name.length<2)throw new Error('Enter the name');
  const pw=tempPassword();const u={id:uid('u'),role:d.role,name,username:un,email,phone:'',password:pw,mustChange:true,active:true,lastLoginAt:0,courses};db.users.push(u);log('Staff login created','User',un,null,{role:u.role,email,courses:courses.join(', ')});
  queueMail({kind:'staff',userId:u.id,to:[email],subject:`Your ${db.college.short} ERP login`,why:'new',pw});save();closeLayer();renderPage();
  if(mailLive()){toast(`Login created · details are being emailed to ${email}`);return}
  dialog(`<h3>Login created</h3><p class="muted">Give these to ${E(name)}. Shown once.</p><div class="panel" style="padding:12px"><div class="rline"><span>Username</span><b class="mono">${E(un)}</b></div><div class="rline"><span>Temporary password</span><b class="mono">${E(pw)}</b></div></div><div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" data-act="closeDialog">Done</button></div>`,'Login created',true)};
/* edit a staff login (name, username, email, phone). The Super Admin edits anyone, also their own login;
   any staff member can edit their own details from the profile. Role and courses stay where they are managed. */
const canEditUser=u=>!!u&&u.role!=='Student'&&(cur().role==='Super Admin'||u.id===cur().id);
ACT.editUser=el=>{const u=db.users.find(x=>x.id===(el.dataset.id||cur().id));if(!canEditUser(u))throw new Error('Not allowed');
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Edit login</h2><p class="muted">${E(u.role)}${u.id===cur().id?' · your own login':''}</p><form data-form="editUser" data-id="${E(u.id)}" class="form" style="margin-top:12px">
   ${F('name','Full name',{req:true,span:1,val:u.name,attrs:'maxlength="80"'})}${F('username','Username',{req:true,val:u.username,attrs:'autocapitalize="off" maxlength="30"'})}
   ${F('email','Email',{type:'email',req:true,val:u.email,span:1})}${F('phone','Mobile (optional)',{type:'tel',val:u.phone||'',attrs:'inputmode="numeric" maxlength="10"'})}
   <p class="note span">Sign-in works with the username or the email. The password is changed separately${u.id===cur().id?' (Profile → Change password)':' (Reset password)'}.</p><div class="actions span"><button class="btn primary">Save</button></div></form>`,true,'Edit login');$('#f_name').focus()};
FORM.editUser=(f,d)=>{const u=db.users.find(x=>x.id===f.dataset.id);if(!canEditUser(u))throw new Error('Not allowed');
  const name=capText(d.name,'Name',80);if(name.length<2)throw new Error('Enter the name');
  const un=String(d.username||'').trim().toLowerCase();if(!/^[a-z0-9._-]{3,30}$/.test(un))throw new Error('Username: 3-30 letters, numbers, . _ -');
  if(db.users.some(x=>x!==u&&x.username.toLowerCase()===un))throw new Error('This username is taken');
  const email=String(d.email||'').trim().toLowerCase();if(!MAIL_OK.test(email))throw new Error('Enter a valid email');
  if(db.users.some(x=>x!==u&&(x.email||'').toLowerCase()===email)||db.students.some(x=>(x.email||'').toLowerCase()===email))throw new Error('This email is already used by another login');
  const phone=String(d.phone||'').replace(/\D/g,'');if(phone&&!/^[6-9]\d{9}$/.test(phone))throw new Error('Mobile must be 10 digits');
  const before={name:u.name,username:u.username,email:u.email,phone:u.phone||''},after={name,username:un,email,phone};
  const a={},b={};Object.keys(after).forEach(k=>{if(before[k]!==after[k]){a[k]=after[k];b[k]=before[k]}});
  if(!Object.keys(a).length){closeLayer();toast('No changes');return}
  Object.assign(u,after);log('Login details changed','User',u.username,b,a);save();closeLayer();renderApp();toast('Saved')};
/* course assignment: a Principal or Clerk sees only these courses (one, several or all) */
const courseChecks=sel=>`<fieldset class="field span fs-plain"><legend class="label">Courses this login can see *</legend><div class="chkrow">${db.courses.map(c=>`<label class="chk"><input type="checkbox" name="course" value="${E(c.id)}" ${sel.includes(c.id)?'checked':''}> ${E(c.name)}${c.active===false?' <small class="muted">(off)</small>':''}</label>`).join('')}</div><small class="muted">Example: one Principal for B.Ed and another for M.Ed, and one Clerk for both.</small></fieldset>`;
function readCourseChecks(f){const l=new FormData(f).getAll('course').filter(id=>course(id));if(!l.length)throw new Error('Tick at least one course');return l}
ACT.userCourses=el=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');const u=db.users.find(x=>x.id===el.dataset.id);if(!u||!STAFF_ROLES.includes(u.role))throw new Error('Login not found');
  drawer(`<button class="btn x" data-act="close">Close</button><h2>Courses for ${E(u.name)}</h2><p class="muted">${E(u.role)} · ${E(u.username)}</p><form data-form="userCourses" data-id="${E(u.id)}" class="form" style="margin-top:12px">${courseChecks(u.courses||[])}<div class="actions span"><button class="btn primary">Save</button></div></form>`,false,'Courses')};
FORM.userCourses=(f,d)=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');const u=db.users.find(x=>x.id===f.dataset.id);const before=(u.courses||[]).join(', ');u.courses=readCourseChecks(f);log('Login courses changed','User',u.username,{courses:before},{courses:u.courses.join(', ')});save();closeLayer();renderPage();toast('Courses saved')};
/* ---------- courses (Super Admin): B.Ed, M.Ed, add PhD or any other course ---------- */
function setCourses(){if(cur().role!=='Super Admin')throw new Error('Only the Super Admin manages courses');
  return`<div class="scard"><h2>Courses <button class="btn primary" data-act="newCourse">Add course</button></h2><p class="note" style="margin:0 0 12px">Each course has its own students, fees, Principal and Clerk logins. The switch in the top bar shows one course or all of them.</p>
  <div class="tablewrap"><table><thead><tr><th>Course</th><th>Code</th><th>Duration</th><th>Semesters</th><th>Default tuition / sem</th><th>Students</th><th>Staff</th><th>Status</th><th></th></tr></thead><tbody>
  ${db.courses.map(c=>{const n=db.students.filter(s=>s.course===c.id).length;const st=db.users.filter(u=>STAFF_ROLES.includes(u.role)&&(u.courses||[]).includes(c.id)).length;return`<tr><td><b>${E(c.name)}</b></td><td class="mono">${E(c.id)}</td><td>${c.years} year${c.years>1?'s':''} · batch e.g. ${E(batchLabel(c.id,+today().slice(0,4)))}</td><td>${c.semesters}</td><td>${inr(((db.settings.feeDefault[c.id]||[])[0])||0)}</td><td>${n}</td><td>${st}</td><td>${c.active!==false?pill('On','good'):pill('Off','bad')}</td><td><button class="btn sm" data-act="editCourse" data-id="${E(c.id)}">Edit</button></td></tr>`}).join('')}</tbody></table></div></div>`}
function courseForm(c){const isNew=!c;c=c||{name:'',id:'',years:2,semesters:4,active:true};const has=!isNew&&db.students.some(s=>s.course===c.id);
  return`<button class="btn x" data-act="close">Close</button><h2>${isNew?'Add course':'Edit '+E(c.name)}</h2><form data-form="course" ${isNew?'':`data-id="${E(c.id)}"`} class="form" style="margin-top:12px">
   ${F('name','Course name',{val:c.name,req:true,ph:'e.g. Ph.D',attrs:'maxlength="30"'})}${isNew?F('code','Short code (used in enrolment no.)',{req:true,ph:'e.g. PHD',attrs:'maxlength="6" autocapitalize="characters"'}):`<div class="field"><span class="label">Code</span><div class="ro mono">${E(c.id)}</div></div>`}
   ${F('years','Duration (years)',{val:c.years,opts:[1,2,3,4,5,6].map(n=>[n,n+(n>1?' years':' year')])})}
   ${has?`<div class="field"><span class="label">Semesters</span><div class="ro">${c.semesters} <small class="muted">(fixed: students already added)</small></div></div>`:F('semesters','Semesters',{val:c.semesters,opts:[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>[n,n])})}
   ${isNew?F('fee','Default tuition fee per semester (₹)',{req:true,val:'30000',attrs:'inputmode="decimal"'}):`<label class="chk span"><input type="checkbox" name="active" ${c.active!==false?'checked':''}> Course is on (off = hidden when adding students)</label>`}
   <p class="note span">${isNew?'After saving, give this course to a Principal and a Clerk in Staff logins. Fees per semester can be changed in Fees & receipts.':'Fees per semester are in Fees & receipts.'}</p>
   <div class="actions span"><button class="btn primary">${isNew?'Add course':'Save'}</button></div></form>`}
ACT.newCourse=()=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');drawer(courseForm(null),false,'Add course')};
ACT.editCourse=el=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');drawer(courseForm(course(el.dataset.id)),false,'Edit course')};
FORM.course=(f,d)=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');const name=capText(d.name,'Course name',30);if(name.length<2)throw new Error('Enter the course name');
  const years=+d.years;if(!(years>=1&&years<=6))throw new Error('Choose the duration');
  if(db.courses.some(c=>c.name.toLowerCase()===name.toLowerCase()&&c.id!==f.dataset.id))throw new Error('A course with this name already exists');
  if(!f.dataset.id){const id=String(d.code||'').trim().toUpperCase();if(!/^[A-Z]{2,6}$/.test(id))throw new Error('Code: 2 to 6 letters, e.g. PHD');if(course(id))throw new Error('This code is already used');
    const sems=+d.semesters;if(!(sems>=1&&sems<=12))throw new Error('Choose the semesters');const fee=toPaise(d.fee);if(!(fee>=0)||fee>100000000)throw new Error('Enter a valid tuition fee');
    const c={id,name,years,semesters:sems,active:true};db.courses.push(c);db.settings.feeDefault[id]=Array(sems).fill(fee);db.settings.dueDates[id]=Array(sems).fill('');
    log('Course added','Course',id,null,{name,years,semesters:sems,fee:inr(fee)});save();closeLayer();renderApp();toast(name+' added. Now give it to a Principal and a Clerk in Staff logins.');return}
  const c=course(f.dataset.id);const before={name:c.name,years:c.years,semesters:c.semesters,active:c.active!==false};c.name=name;c.years=years;c.active=!!d.active;
  if(d.semesters&&!db.students.some(s=>s.course===c.id)){const n=+d.semesters;if(n>=1&&n<=12&&n!==c.semesters){c.semesters=n;const fd=db.settings.feeDefault[c.id]||[];db.settings.feeDefault[c.id]=Array.from({length:n},(_,i)=>fd[i]??fd[0]??0);const dd=db.settings.dueDates[c.id]||[];db.settings.dueDates[c.id]=Array.from({length:n},(_,i)=>dd[i]||'')}}
  log('Course edited','Course',c.id,before,{name:c.name,years:c.years,semesters:c.semesters,active:c.active});save();closeLayer();renderApp();toast('Saved')};
ACT.userToggle=el=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');const u=db.users.find(x=>x.id===el.dataset.id);u.active=!u.active;log(u.active?'Login switched on':'Login switched off','User',u.username,{active:!u.active},{active:u.active});save();renderPage()};
ACT.userPw=el=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');const u=db.users.find(x=>x.id===el.dataset.id);const pw=tempPassword();u.password=pw;u.mustChange=true;log('Password reset','User',u.username);
  queueMail({kind:'staff',userId:u.id,to:[u.email],subject:`Your new ${db.college.short} ERP password`,why:'reset',pw});save();
  if(mailLive()){toast(`New password is being emailed to ${u.email}`);return}
  dialog(`<h3>New temporary password</h3><div class="panel" style="padding:12px"><div class="rline"><span>${E(u.username)}</span><b class="mono">${E(pw)}</b></div></div><div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" data-act="closeDialog">Done</button></div>`,'Password reset',true)};
function setMail(){const m=db.settings.mail;
  return`<div class="sgrid"><form class="scard" data-form="mailSet"><h2>Email sender</h2><div class="form">${F('fromName','From name',{val:m.fromName,attrs:'maxlength="60"'})}${F('replyTo','Reply-to',{type:'email',val:m.replyTo})}${F('mode','Mode',{val:m.mode,opts:[['demo','Demo (nothing is sent)'],['live','Live (SMTP)']]})}</div>
   <label class="chk" style="margin-top:10px"><input type="checkbox" name="sendReceipts" ${m.sendReceipts?'checked':''}> Email the receipt PDF after every payment</label><label class="chk"><input type="checkbox" name="sendCredentials" ${m.sendCredentials?'checked':''} disabled> Email login details to new students (always on)</label>
   <p class="note">The SMTP password stays on the server. Demo mode shows each email in the outbox below.</p><div class="actions" style="margin-top:12px"><button class="btn primary">Save</button></div></form>
   <div class="scard"><h2>Outbox ${pill(db.outbox.length+' emails')}</h2><div class="list">${pageRows(ui.f.outbox=Object.assign({per:10},ui.f.outbox||{}),db.outbox).map(o=>`<div class="li"><div><b>${E(o.subject)}</b><small>${E(o.to.join(', '))} · ${E(fmtT(o.ts))}</small></div>${mailPill(o.status)}</div>`).join('')||'<p class="note">Nothing sent yet.</p>'}</div>${pager('outbox',db.outbox.length)}
   <h2 style="margin-top:14px">Notification sound</h2><label class="chk"><input type="checkbox" data-change="mute" ${muted()?'':'checked'}> Play a sound for live notifications on this device</label></div></div>`}
FORM.mailSet=(f,d)=>{need('settings.manage');const m=db.settings.mail;const before={...m};m.fromName=capText(d.fromName,'From name',60);const rt=String(d.replyTo||'').trim();if(rt&&!MAIL_OK.test(rt))throw new Error('Check the reply-to email');m.replyTo=rt;m.mode=d.mode==='live'?'live':'demo';m.sendReceipts=!!d.sendReceipts;log('Email settings changed','Settings','mail',before,{...m});save();renderPage();toast('Saved')};
CHG.mute=el=>{lsSet('npcte_mute',el.checked?'0':'1');toast(el.checked?'Sound on':'Sound off')};
function setFlags(){const fl=db.settings.flags;
  return`<form class="scard" data-form="flags" style="max-width:820px"><h2>Open items · feature flags</h2><p class="note" style="margin:0 0 12px">These questions are waiting for the college (Roshanbhai). The app works with the default until they answer.</p>
   <label class="chk"><input type="checkbox" name="fundingAllCategories" ${fl.fundingAllCategories?'checked':''}> 1 · Show the funding type (Cash / Scholarship) for all categories, not only SC / ST <small class="muted">(default: off)</small></label>
   <label class="chk"><input type="checkbox" name="lateFee" disabled> 2 · Late fee <small class="muted">(default: no late fee · due dates in Fees & receipts)</small></label>
   <ul class="note"><li>3 · Receipt format and numbering used today (send a photo)</li><li>4 · College bank account and UPI merchant / gateway</li><li>5 · Old data: Excel of current students (CSV import template is in Students → Import)</li><li>6 · Exact reports the trust / university asks for</li><li>7 · Student login ID: enrolment no. or email (now: either works)</li></ul>
   <div class="actions" style="margin-top:12px"><button class="btn primary">Save</button></div></form>`}
FORM.flags=(f,d)=>{need('settings.manage');const fl=db.settings.flags;const before={...fl};fl.fundingAllCategories=!!d.fundingAllCategories;log('Feature flags changed','Settings','flags',before,{...fl});save();renderPage();toast('Saved')};
function setData(){return`<div class="scard danger" style="max-width:720px"><h2>Demo data</h2><p class="note">Everything lives in this browser. Reset puts back the sample students, payments and notices.</p><div class="actions" style="margin-top:10px"><button class="btn" data-act="backup">Download backup (JSON)</button><button class="btn danger" data-act="resetDemo">Reset demo data</button></div></div>`}
ACT.backup=()=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');const c=JSON.parse(JSON.stringify(db));c.users.forEach(u=>delete u.password);download('npcte-backup-'+today()+'.json',JSON.stringify(c,null,1),'application/json');log('Backup downloaded','System','')};

/* ---------- my account ---------- */
function accountPanel(){return`<form class="panel" data-form="myPw"><h2>Change password</h2><div class="grid" style="gap:10px">${F('old','Current password',{type:'password',req:true,attrs:'autocomplete="current-password"'})}${F('p1','New password',{type:'password',req:true,attrs:'autocomplete="new-password"'})}${F('p2','Type it again',{type:'password',req:true,attrs:'autocomplete="new-password"'})}<button class="btn primary">Change password</button></div></form>`}
FORM.myPw=(f,d)=>{const u=cur();if(isStudentUser(u))throw new Error('Only the college office can change a student password');if(d.old!==u.password)throw new Error('Current password is wrong');if(!pwOk(d.p1))throw new Error('Use at least 8 characters with a letter and a number');if(d.p1!==d.p2)throw new Error('The two new passwords are not the same');u.password=d.p1;log('Password changed','User',u.username);save();f.reset();toast('Password changed')};
function staffProfileHtml(){const u=cur();const L=(k,v)=>`<div class="rline"><span>${k}</span><b style="font-weight:500;text-align:right;overflow-wrap:anywhere">${E(v||'-')}</b></div>`;
  return`<button class="btn x" data-act="close">Close</button><div class="who" style="margin:4px 0 14px"><div class="av lg">${E(initials(u.name))}</div><div><h2 style="margin:0">${E(u.name)}</h2><small class="muted">${E(u.role)}</small></div></div>
  <div class="panel">${L('Username',u.username)}${L('Email',u.email)}${u.phone?L('Mobile',u.phone):''}${L('Last sign-in',fmtT(u.lastLoginAt))}<div class="actions" style="margin-top:10px"><button class="btn sm" data-act="editUser" data-id="${E(u.id)}">Edit details</button></div></div><div class="panel" style="margin-top:12px"><h2>What you can open</h2><div class="actions">${navFor(u).map(n=>pill(n[1])).join('')}</div></div><div class="panel" style="margin-top:12px"><h2>Notifications</h2><div id="notifyPanel">${notifyPanelHtml()}</div></div><div class="panel" style="margin-top:12px"><h2>App</h2><div id="profileInstall">${installPanelHtml()}</div></div><div style="margin-top:12px">${accountPanel()}</div>`}
