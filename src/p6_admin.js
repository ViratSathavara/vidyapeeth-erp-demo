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
  const l=db.notices.filter(n=>(!f.kind||(f.kind==='fee'?n.isFeeAlert:f.kind==='public'?n.isPublic:f.kind==='scheduled'?n.publishAt>Date.now():true))&&(!q||(n.title+' '+n.body).toLowerCase().includes(q))).sort((a,b)=>b.publishAt-a.publishAt);
  return head('Notice Board','Notices reach students in their portal with a live notification, sound and a phone popup.','<button class="btn primary" data-act="newNotice">New notice</button>')+
  `<div class="panel"><div class="filters"><input type="search" placeholder="Search notices" aria-label="Search notices" data-live="sq" data-scope="notices" value="${E(f.q)}">${sel('notices','kind','Type',[['','All notices'],['fee','Fee alerts'],['scheduled','Scheduled'],['public','Public (website)']])}</div>
  <div class="nlist">${l.map(n=>{const reach=audienceStudents(n.audience).length;const sched=n.publishAt>Date.now();return`<article class="ncard">
   <div class="nc-h"><h3>${E(n.title)}</h3><div class="actions">${n.isFeeAlert?pill('Fee alert','warn'):''}${n.isPublic?pill('Public','acc'):''}${sched?pill('Scheduled '+fmtT(n.publishAt),'warn'):pill('Published','good')}</div></div>
   <p>${E(n.body)}</p>${n.attachment?`<button class="lnk" data-act="openAtt" data-id="${E(n.id)}">📎 ${E(n.attachment.name)} (${fmtSize(n.attachment.size)})</button>`:''}
   <small class="muted">${E(audienceLabel(n.audience))} · ${reach} student${reach===1?'':'s'} · ${sched?'goes out':'sent'} ${fmtT(n.publishAt)} · by ${E(n.createdBy)}</small>
   <div class="actions" style="margin-top:8px"><button class="btn sm danger" data-act="delNotice" data-id="${E(n.id)}">Delete</button></div></article>`}).join('')||'<p class="empty">No notices yet.</p>'}</div></div>`;
}
function noticeForm(){
  const sts=db.students.filter(s=>s.status==='ACTIVE').sort((a,b)=>a.name.localeCompare(b.name));
  return`<button class="btn x" data-act="close">Close</button><h2>New notice</h2>
  <form data-form="notice" class="grid" style="gap:12px;margin-top:12px">${F('title','Title',{req:true,attrs:'maxlength="100"'})}${F('body','Message',{type:'textarea',req:true,rows:5,attrs:'maxlength="2000"'})}
   <div class="field"><span class="label">Attachment (PDF or image, optional, up to 450 KB)</span><label class="btn sm" style="width:fit-content"><input type="file" class="sr" accept="application/pdf,image/*" data-change="noticeFile"> Choose file</label><small id="attName" class="muted"></small></div>
   <div class="form">${F('aud','Send to',{opts:[['all','All students'],['BED','B.Ed (all semesters)'],['MED','M.Ed (all semesters)'],['sem','A semester'],['students','Selected students'],['one','One student']],attrs:'data-change="audType"'})}
    <div class="field" id="audSem" hidden><label class="label" for="f_semc">Semester</label><select id="f_semc" name="semc">${db.courses.flatMap(c=>SEMS.map(n=>`<option value="${c.id}-${n}">${E(c.name)} Sem ${n}</option>`)).join('')}</select></div></div>
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
  let a;const t=d.aud;if(t==='all')a={type:'all'};else if(t==='BED'||t==='MED')a={type:'course',course:t};else if(t==='sem'){const[c,n]=d.semc.split('-');a={type:'sem',course:c,sem:+n}}
  else{const ids=new FormData(f).getAll('sid');if(!ids.length)throw new Error('Choose at least one student');a={type:'students',ids:t==='one'?ids.slice(0,1):ids}}
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
  const tabs=[];if(can('audit.view'))tabs.push(['tx','Transactions'],['deposit','Cash & cheque deposit']);if(can('activity.view'))tabs.push(['activity','Activity log']);
  let t=ui.tab.audit||tabs[0][0];if(!tabs.some(x=>x[0]===t))t=tabs[0][0];ui.tab.audit=t;
  if(t==='activity')need('activity.view','the activity log');else need('audit.view','the audit');
  return head('Audit','Every payment and expense, with filters, totals and exports.','')+tabsBar('audit',tabs,t)+({tx:auditTx,deposit:auditDeposit,activity:auditActivity}[t])();
}
/* one row per payment or expense */
function txAll(){
  return db.payments.map(p=>{const s=stu(p.studentId);return{kind:'p',id:p.id,date:p.invoiceDate,entry:p.entryAt,s,sem:p.sem,mode:p.mode,amount:p.amount,ref:p.rc,status:p.status,by:p.by,rec:p,reason:p.reason||'',batch:batchOf(p)}})
   ;
}
function txFilter(){return ui.f['audit.tx']=Object.assign({q:'',modes:[],from:'',to:'',course:'',sem:'',cat:'',fund:'',status:'',by:'',min:'',max:'',sort:'date',dir:-1,page:0},ui.f['audit.tx']||{})}
function txFiltered(){
  const f=txFilter();const q=f.q.toLowerCase();const mn=f.min!==''?toPaise(f.min):null,mx=f.max!==''?toPaise(f.max):null;
  let l=txAll().filter(r=>(!f.modes.length||f.modes.includes(r.mode))&&(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to)&&(!f.course||(r.s&&r.s.course===f.course))&&(!f.sem||r.sem===+f.sem)
   &&(!f.cat||(r.s&&r.s.category===f.cat))&&(!f.fund||(r.s&&r.s.funding===f.fund))&&(!f.status||r.status===f.status)&&(!f.by||r.by===f.by)&&(mn===null||r.amount>=mn)&&(mx===null||r.amount<=mx)
   &&(!q||[r.ref,r.s&&r.s.name,r.s&&r.s.enrol,r.reason,r.batch,r.rec.chequeNo,r.rec.upiRef].some(v=>String(v||'').toLowerCase().includes(q))));
  const k={date:r=>r.date+String(r.entry).padStart(14,'0'),entry:r=>r.entry,name:r=>r.s?r.s.name:'~',course:r=>r.s?r.s.course:'~',sem:r=>r.sem||0,cat:r=>r.s?r.s.category:'~',fund:r=>r.s?r.s.funding:'~',mode:r=>r.mode,amount:r=>r.amount,ref:r=>r.ref,status:r=>r.status,by:r=>r.by}[f.sort]||(r=>r.date);
  l.sort((a,b)=>{const A=k(a),B=k(b);return(A<B?-1:A>B?1:0)*f.dir});return l;
}
const txTotals=l=>{const ok=l.filter(r=>r.status==='SUCCESS');const o={};['CASH','CHEQUE','UPI','EXPENSE'].forEach(m=>o[m]=sum(ok.filter(r=>r.mode===m),r=>r.amount));o.income=o.CASH+o.CHEQUE+o.UPI;return o};
function auditTx(){
  const f=txFilter();const sc='audit.tx';const l=txFiltered();const pg=l.slice(f.page*PAGE,(f.page+1)*PAGE);const t=txTotals(l);const bys=[...new Set(txAll().map(r=>r.by))];
  return`<div class="totals">${['CASH','CHEQUE','UPI','EXPENSE'].map(m=>`<div class="tt ${MODE_TONE[m]}"><span>${modeName(m)}</span><b>${inr(t[m])}</b></div>`).join('')}<div class="tt sum"><span>Cash + Cheque + UPI</span><b>${inr(t.income)}</b></div></div>
  <div class="panel"><div class="filters"><input type="search" placeholder="Search receipt, name, cheque, UTR, reason" aria-label="Search transactions" data-live="sq" data-scope="${sc}" value="${E(f.q)}">
   <div class="chips" role="group" aria-label="Mode">${['CASH','CHEQUE','UPI','EXPENSE'].map(m=>`<button type="button" class="chip ${MODE_TONE[m]}" aria-pressed="${f.modes.includes(m)}" data-act="txMode" data-m="${m}">${modeName(m)}</button>`).join('')}</div>
   <label class="dl">From <input type="date" value="${E(f.from)}" data-change="sf" data-scope="${sc}" data-k="from"></label><label class="dl">To <input type="date" value="${E(f.to)}" data-change="sf" data-scope="${sc}" data-k="to"></label>
   ${sel(sc,'course','Course',COURSE_OPTS())}${sel(sc,'sem','Semester',SEM_OPTS)}${sel(sc,'cat','Category',CAT_OPTS)}${sel(sc,'fund','Funding type',FUND_OPTS)}${sel(sc,'status','Status',[['','All status'],['SUCCESS','Success'],['CANCELLED','Cancelled'],['FAILED','Failed']])}${sel(sc,'by','Entered by',[['','Anyone'],...bys.map(b=>[b,b])])}
   <input class="numin" placeholder="Min ₹" aria-label="Minimum amount" value="${E(f.min)}" data-change="sf" data-scope="${sc}" data-k="min" inputmode="decimal"><input class="numin" placeholder="Max ₹" aria-label="Maximum amount" value="${E(f.max)}" data-change="sf" data-scope="${sc}" data-k="max" inputmode="decimal">
   <button class="btn sm" data-act="txClear">Clear</button></div>
  <div class="actions" style="margin-bottom:10px"><span class="muted">${l.length} rows</span><span style="flex:1"></span><button class="btn" data-act="txCsv">Export Excel</button><button class="btn" data-act="txPrint">Export PDF</button></div>
  <div class="tablewrap"><table class="dense"><thead><tr>${sortTh(sc,'date','Invoice date')}${sortTh(sc,'entry','Entry time')}${sortTh(sc,'name','Student')}${sortTh(sc,'course','Course')}<th>Batch</th>${sortTh(sc,'sem','Sem')}${sortTh(sc,'cat','Category')}${sortTh(sc,'fund','Funding')}${sortTh(sc,'mode','Mode')}${sortTh(sc,'amount','Amount',1)}${sortTh(sc,'ref','Receipt / ref')}${sortTh(sc,'status','Status')}${sortTh(sc,'by','Entered by')}</tr></thead><tbody>
  ${pg.map(r=>`<tr><td>${fmtD(r.date)}</td><td><small>${fmtT(r.entry)}</small></td><td>${r.s?`<button class="lnk" data-act="openStudent" data-id="${E(r.s.id)}">${E(r.s.name)}</button>`:`<span class="muted">${E(r.reason||'—')}</span>`}</td><td>${r.s?E(course(r.s.course).name):'—'}</td><td class="mono">${E(r.batch||'—')}</td><td>${r.sem||'—'}</td><td>${r.s?E(r.s.category):'—'}</td><td>${r.s?E(fundLabel(r.s.funding)):'—'}</td><td>${modePill(r.mode)}</td><td class="num amt">${inr(r.amount)}</td><td class="mono">${r.kind==='p'?`<button class="lnk mono" data-act="viewReceipt" data-id="${E(r.id)}">${E(r.ref)}</button>`:E(r.ref)}</td><td>${payPill(r.status)}</td><td>${E(r.by)}</td></tr>`).join('')||'<tr><td colspan="13" class="empty">No transactions for these filters.</td></tr>'}
  </tbody></table></div>${pager(sc,l.length)}</div>`;
}
ACT.txMode=el=>{const f=txFilter();const m=el.dataset.m;f.modes=f.modes.includes(m)?f.modes.filter(x=>x!==m):[...f.modes,m];f.page=0;renderPage()};
ACT.txClear=()=>{const f=txFilter();ui.f['audit.tx']={sort:f.sort,dir:f.dir,page:0};renderPage()};
const txCols=['Invoice date','Entry time','Student','Enrolment no','Course','Batch','Sem','Category','Funding','Mode','Amount (₹)','Receipt / ref','Status','Entered by','Cheque no','Bank','UPI ref','Reason'];
const txRow=r=>[fmtD(r.date),fmtT(r.entry),r.s?r.s.name:'',r.s?r.s.enrol:'',r.s?course(r.s.course).name:'',r.batch||'',r.sem||'',r.s?r.s.category:'',r.s?fundLabel(r.s.funding):'',modeName(r.mode),r.amount/100,r.ref,r.status,r.by,r.rec.chequeNo||'',r.rec.bank||'',r.rec.upiRef||'',r.reason||r.rec.cancelReason||''];
ACT.txCsv=()=>{need('audit.view');const l=txFiltered();const t=txTotals(l);showCsv('NPCTE transactions',txCols,[...l.map(txRow),[],['Totals (successful)','','','','','','','','','Cash',t.CASH/100],['','','','','','','','','','Cheque',t.CHEQUE/100],['','','','','','','','','','UPI',t.UPI/100],['','','','','','','','','','Expense',t.EXPENSE/100]]);log('Audit exported','Audit','',null,{rows:l.length,format:'Excel'})};
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
   `<p class="pt">Cash ${inr(t.CASH)} · Cheque ${inr(t.CHEQUE)} · UPI ${inr(t.UPI)} · Expense ${inr(t.EXPENSE)} · Fees received ${inr(t.income)} · ${l.length} rows</p>`);log('Audit exported','Audit','',null,{rows:l.length,format:'PDF'})};

/* deposit report (§7A) */
function weekStart(iso){const d=parseD(iso);const k=(d.getDay()+6)%7;return addDays(iso,-k)}
function depPeriod(){const f=ui.f.dep=Object.assign({p:'week',from:'',to:''},ui.f.dep||{});const T=today();
  if(f.p==='week')return{from:weekStart(T),to:addDays(weekStart(T),6),f};if(f.p==='lastweek'){const w=addDays(weekStart(T),-7);return{from:w,to:addDays(w,6),f}}
  if(f.p==='month')return{from:T.slice(0,8)+'01',to:addDays(isoOf(new Date(+T.slice(0,4),+T.slice(5,7),1)),-1),f};
  if(f.p==='lastmonth'){const d=new Date(+T.slice(0,4),+T.slice(5,7)-2,1);return{from:isoOf(d),to:addDays(isoOf(new Date(d.getFullYear(),d.getMonth()+1,1)),-1),f}}
  return{from:f.from||addDays(T,-30),to:f.to||T,f}}
function auditDeposit(){
  const{from,to,f}=depPeriod();const inP=p=>p.invoiceDate>=from&&p.invoiceDate<=to&&p.status==='SUCCESS';
  const pays=db.payments.filter(inP);const und=pays.filter(p=>(p.mode==='CASH'||p.mode==='CHEQUE')&&!p.depositId);const ex=pays.filter(p=>p.mode==='EXPENSE');
  const col=m=>{const l=m==='EXPENSE'?ex:pays.filter(p=>p.mode===m);return{t:sum(l,x=>x.amount),n:l.length,und:m==='CASH'||m==='CHEQUE'?sum(l.filter(p=>!p.depositId),p=>p.amount):null}};
  const sc=can('audit.deposit');
  return`<div class="panel"><h2>Cash & cheque deposit report</h2>
   <div class="filters"><div class="chips" role="group" aria-label="Period">${[['week','This week'],['lastweek','Last week'],['month','This month'],['lastmonth','Last month'],['custom','Custom']].map(([k,l])=>`<button type="button" class="chip" aria-pressed="${f.p===k}" data-act="depP" data-p="${k}">${l}</button>`).join('')}</div>
    ${f.p==='custom'?`<label class="dl">From <input type="date" value="${E(from)}" data-change="sf" data-scope="dep" data-k="from"></label><label class="dl">To <input type="date" value="${E(to)}" data-change="sf" data-scope="dep" data-k="to"></label>`:`<span class="muted">${fmtD(from)} to ${fmtD(to)}</span>`}</div>
   <div class="totals four">${['CASH','CHEQUE','UPI','EXPENSE'].map(m=>{const c=col(m);return`<div class="tt ${MODE_TONE[m]}"><span>${modeName(m)} · ${c.n}</span><b>${inr(c.t)}</b>${c.und!==null?`<small>${c.und?inr(c.und)+' not deposited':'all deposited'}</small>`:`<small>${m==='UPI'?'goes to bank by gateway':'fee used for college expense'}</small>`}</div>`}).join('')}</div>
   <h3>Not yet deposited · ${und.length} entries · ${inr(sum(und,p=>p.amount))}</h3>
   <div class="tablewrap"><table><thead><tr>${sc?`<th><input type="checkbox" aria-label="Select all" data-change="depAll" checked></th>`:''}<th>Invoice date</th><th>Receipt</th><th>Student</th><th>Mode</th><th>Cheque</th><th class="num">Amount</th></tr></thead><tbody>
   ${und.sort((a,b)=>a.invoiceDate<b.invoiceDate?-1:1).map(p=>`<tr>${sc?`<td><input type="checkbox" name="dep" value="${E(p.id)}" checked aria-label="Include ${E(p.rc)}" data-change="depCount"></td>`:''}<td>${fmtD(p.invoiceDate)}</td><td class="mono">${E(p.rc)}</td><td>${E(stu(p.studentId).name)}</td><td>${modePill(p.mode)}</td><td>${p.mode==='CHEQUE'?E(p.chequeNo+' · '+p.bank):'—'}</td><td class="num amt">${inr(p.amount)}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">Nothing waiting to be deposited in this period.</td></tr>'}</tbody></table></div>
   ${sc&&und.length?`<form data-form="deposit" class="form" style="margin-top:14px"><div class="field span"><b id="depSum">Selected: ${und.length} · ${inr(sum(und,p=>p.amount))}</b></div>${F('depositedOn','Deposited on',{type:'date',val:today(),req:true,attrs:`max="${today()}"`})}${F('bankRef','Bank slip / reference',{req:true,attrs:'maxlength="60"'})}<div class="actions span"><button class="btn primary big">Mark as deposited</button><button type="button" class="btn" data-act="depPrint">Print report</button></div></form>`:`<div class="actions" style="margin-top:12px"><button class="btn" data-act="depPrint">Print report</button></div>`}
  </div>
  <div class="panel" style="margin-top:16px"><h2>Deposits made</h2><div class="tablewrap"><table><thead><tr><th>Deposited on</th><th>Period</th><th>Entries</th><th class="num">Total</th><th>Bank ref</th><th>By</th><th></th></tr></thead><tbody>
   ${db.deposits.slice().sort((a,b)=>b.at-a.at).map(d=>`<tr><td>${fmtD(d.depositedOn)}</td><td>${fmtD(d.periodFrom)} – ${fmtD(d.periodTo)}</td><td>${d.count}</td><td class="num amt">${inr(d.total)}</td><td>${E(d.bankRef)}</td><td>${E(d.by)}</td><td>${['Super Admin','Principal'].includes(cur().role)?`<button class="btn sm" data-act="depUndo" data-id="${E(d.id)}">Undo</button>`:''}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">No deposits yet.</td></tr>'}</tbody></table></div></div>`;
}
ACT.depP=el=>{depPeriod().f.p=el.dataset.p;renderPage()};
const depChecked=()=>$$('input[name=dep]:checked').map(i=>db.payments.find(p=>p.id===i.value)).filter(Boolean);
CHG.depCount=()=>{const l=depChecked();const s=$('#depSum');if(s)s.textContent=`Selected: ${l.length} · ${inr(sum(l,p=>p.amount))}`};
CHG.depAll=el=>{$$('input[name=dep]').forEach(i=>i.checked=el.checked);CHG.depCount()};
FORM.deposit=(f,d)=>{need('audit.deposit','mark deposits');const l=depChecked().filter(p=>p.status==='SUCCESS'&&!p.depositId&&(p.mode==='CASH'||p.mode==='CHEQUE'));if(!l.length)throw new Error('Select at least one entry');
  if(!validIso(d.depositedOn)||d.depositedOn>today())throw new Error('Choose the deposit date');const ref=capText(d.bankRef,'Bank reference',60);if(ref.length<2)throw new Error('Enter the bank slip / reference');
  const{from,to}=depPeriod();const types=[...new Set(l.map(p=>p.mode))];
  const dp={id:uid('d'),type:types.join('+'),periodFrom:from,periodTo:to,total:sum(l,p=>p.amount),depositedOn:d.depositedOn,bankRef:ref,by:cur().name,at:Date.now(),count:l.length};
  db.deposits.push(dp);l.forEach(p=>p.depositId=dp.id);log('Marked as deposited','Deposit',dp.id,null,{total:inr(dp.total),entries:dp.count,bankRef:ref,on:fmtD(dp.depositedOn)});save();renderPage();toast(`${inr(dp.total)} marked as deposited`)};
ACT.depUndo=el=>{if(!['Super Admin','Principal'].includes(cur().role))throw new Error('Only the Principal can undo a deposit');const dp=db.deposits.find(x=>x.id===el.dataset.id);
  confirmBox('Undo deposit',`${dp.count} entries (${inr(dp.total)}) go back to "not deposited".`,'Undo',()=>{db.payments.forEach(p=>{if(p.depositId===dp.id)p.depositId=''});db.deposits=db.deposits.filter(x=>x!==dp);log('Deposit undone','Deposit',dp.id,{total:inr(dp.total)},null);save();renderPage();toast('Deposit undone')},true)};
ACT.depPrint=()=>{const{from,to}=depPeriod();const l=db.payments.filter(p=>p.status==='SUCCESS'&&p.invoiceDate>=from&&p.invoiceDate<=to&&(p.mode==='CASH'||p.mode==='CHEQUE'));const t=m=>inr(sum(db.payments.filter(p=>p.status==='SUCCESS'&&p.invoiceDate>=from&&p.invoiceDate<=to&&p.mode===m),p=>p.amount));
  printReport('Cash & cheque deposit report',`${fmtD(from)} to ${fmtD(to)}`,['Invoice date','Receipt','Student','Mode','Cheque','Amount','Deposited'],l.map(p=>[fmtD(p.invoiceDate),p.rc,stu(p.studentId).name,modeName(p.mode),p.mode==='CHEQUE'?p.chequeNo+' '+p.bank:'',inr(p.amount),p.depositId?'Yes':'No']),
   `<p class="pt">Cash ${t('CASH')} · Cheque ${t('CHEQUE')} · UPI ${t('UPI')} · Expense ${t('EXPENSE')} · Not deposited ${inr(sum(l.filter(p=>!p.depositId),p=>p.amount))}</p><p class="pt">Deposited by: ____________________ &nbsp; Checked by: ____________________</p>`)};

/* activity log (§7B): read-only, Principal and Super Admin */
function auditActivity(){
  need('activity.view');const f=ui.f.act=Object.assign({q:'',role:'',from:'',to:'',page:0},ui.f.act||{});const q=f.q.toLowerCase();
  const l=db.audit.filter(a=>(!f.role||a.role===f.role)&&(!f.from||istDate(a.at)>=f.from)&&(!f.to||istDate(a.at)<=f.to)&&(!q||[a.action,a.actor,a.entity,a.entityId,a.detail,JSON.stringify(a.after||''),JSON.stringify(a.before||'')].some(v=>String(v).toLowerCase().includes(q))));
  const pg=l.slice(f.page*PAGE,(f.page+1)*PAGE);
  return`<div class="panel"><h2>Activity log ${pill(l.length+' actions')}<button class="btn" data-act="actCsv">Export Excel</button></h2>
   <div class="filters"><input type="search" placeholder="Search action, person, receipt, value" aria-label="Search activity" data-live="sq" data-scope="act" value="${E(f.q)}">${sel('act','role','Role',[['','All roles'],...ROLE_NAMES.map(r=>[r,r]),['System','System']])}
    <label class="dl">From <input type="date" value="${E(f.from)}" data-change="sf" data-scope="act" data-k="from"></label><label class="dl">To <input type="date" value="${E(f.to)}" data-change="sf" data-scope="act" data-k="to"></label></div>
   <div class="tablewrap"><table class="dense"><thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Record</th><th>Before → after</th><th>IP · device</th></tr></thead><tbody>
   ${pg.map(a=>`<tr><td><small>${fmtT(a.at)}</small></td><td>${E(a.actor)}<small class="muted" style="display:block">${E(a.role)}</small></td><td><b>${E(a.action)}</b>${a.detail?`<small class="muted" style="display:block">${E(a.detail)}</small>`:''}</td><td class="mono">${E(a.entity)}${a.entityId?' · '+E(a.entityId):''}</td><td><small>${E(diffText(a.before,a.after))||'—'}</small></td><td><small>${E(a.ip)}<br>${E(a.device)}</small></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nothing found.</td></tr>'}</tbody></table></div>${pager('act',l.length)}
   <p class="note">Read-only. Nobody can edit or delete these entries.</p></div>`;
}
ACT.actCsv=()=>{need('activity.view');showCsv('NPCTE activity log',['Time','Who','Role','Action','Entity','Record','Before','After','Detail','IP','Device'],db.audit.map(a=>[fmtT(a.at),a.actor,a.role,a.action,a.entity,a.entityId,JSON.stringify(a.before||''),JSON.stringify(a.after||''),a.detail,a.ip,a.device]))};

/* ---------- settings ---------- */
function viewSettings(){
  const tabs=[];if(can('settings.manage'))tabs.push(['college','College profile']);if(can('fees.setup'))tabs.push(['fees','Fees & receipts']);if(can('roles.manage'))tabs.push(['roles','Roles & permissions']);
  if(cur().role==='Super Admin')tabs.push(['users','Staff logins']);if(can('settings.manage'))tabs.push(['mail','Email & alerts'],['flags','Open items']);if(cur().role==='Super Admin')tabs.push(['data','Data']);
  let t=ui.tab.settings||tabs[0][0];if(!tabs.some(x=>x[0]===t))t=tabs[0][0];ui.tab.settings=t;
  return head('Settings',`${db.college.short} · ${db.college.trust}`,'')+tabsBar('settings',tabs,t)+({college:setCollege,fees:()=>feeSetup(),roles:setRoles,users:setUsers,mail:setMail,flags:setFlags,data:setData}[t])();
}
function setCollege(){need('settings.manage');const c=db.college;
  return`<form class="scard" data-form="college" style="max-width:820px"><h2>College profile</h2><p class="note" style="margin:0 0 12px">Shown on receipts, reports and the login screen.</p><div class="form">
   ${F('name','College name',{val:c.name,req:true,span:1,attrs:'maxlength="120"'})}${F('short','Short name',{val:c.short,req:true,attrs:'maxlength="12"'})}${F('trust','Trust',{val:c.trust,req:true,attrs:'maxlength="80"'})}
   ${F('address','Address',{type:'textarea',val:c.address,span:1,rows:2})}${F('phone','Phone',{val:c.phone,attrs:'maxlength="40"'})}${F('email','Email',{type:'email',val:c.email})}${F('website','Website',{val:c.website})}${F('year','Academic year',{val:c.year,attrs:'maxlength="9"'})}</div>
   <p class="note">Contact on receipts: please confirm before go-live. Logo: waiting for the college's logo file.</p><div class="actions" style="margin-top:12px"><button class="btn primary">Save</button></div></form>`}
FORM.college=(f,d)=>{need('settings.manage');const c=db.college;const before={...c};['name','short','trust','address','phone','email','website','year'].forEach(k=>{c[k]=capText(d[k],k,k==='address'?300:120)});if(!c.name||!c.short)throw new Error('Name and short name are required');
  const a={},b={};Object.keys(c).forEach(k=>{if(before[k]!==c[k]){a[k]=c[k];b[k]=before[k]}});log('College profile changed','Settings','college',b,a);save();renderApp();toast('Saved')};
function setRoles(){need('roles.manage');const editable=STAFF_ROLES.filter(r=>cur().role==='Super Admin'||r!=='Principal');
  return`<div class="scard"><h2>Roles & permissions</h2><p class="note" style="margin:0 0 12px">Ticks are checked by the server on every request, not only by hiding buttons. Super Admin always has everything; the Student role sees only its own portal.${cur().role==='Principal'?' The Principal row can be changed by the Super Admin only.':''}</p>
  <div class="tablewrap"><table class="matrix"><thead><tr><th>Permission</th><th>Super Admin</th>${STAFF_ROLES.map(r=>`<th>${E(r)}</th>`).join('')}<th>Student</th></tr></thead><tbody>
  ${PERMS.map(([k,l])=>`<tr><td>${E(l)}<small class="muted mono" style="display:block">${E(k)}</small></td><td><input type="checkbox" checked disabled aria-label="Super Admin: ${E(l)}"></td>${STAFF_ROLES.map(r=>`<td><input type="checkbox" aria-label="${E(r)}: ${E(l)}" ${(db.roles[r]||[]).includes(k)?'checked':''} ${editable.includes(r)&&!(r==='Principal'&&k==='roles.manage')?'':'disabled'} data-change="perm" data-r="${E(r)}" data-p="${E(k)}"></td>`).join('')}<td><input type="checkbox" disabled aria-label="Student: ${E(l)}"></td></tr>`).join('')}</tbody></table></div>
  <div class="actions" style="margin-top:12px"><button class="btn" data-act="permReset">Restore defaults</button></div></div>`}
CHG.perm=el=>{need('roles.manage');const r=el.dataset.r,p=el.dataset.p;if(!STAFF_ROLES.includes(r)||!PERMS.some(x=>x[0]===p))throw new Error('Unknown permission');if(r==='Principal'&&cur().role!=='Super Admin')throw new Error('Only the Super Admin can change the Principal role');if(r==='Principal'&&p==='roles.manage')throw new Error('The Principal always keeps this');
  const l=db.roles[r]=db.roles[r]||[];const had=l.includes(p);if(el.checked&&!had)l.push(p);if(!el.checked&&had)l.splice(l.indexOf(p),1);log('Permission changed','Role',r,{[p]:had},{[p]:el.checked});save();toast(`${r}: ${PERMS.find(x=>x[0]===p)[1]} ${el.checked?'allowed':'removed'}`)};
ACT.permReset=()=>{need('roles.manage');confirmBox('Restore default permissions','Principal and Clerk go back to the permissions in the spec.','Restore',()=>{const before=JSON.stringify(db.roles);const d=DEFAULT_ROLES();if(cur().role!=='Super Admin')d.Principal=db.roles.Principal;db.roles=d;log('Permissions reset','Role','',{roles:before},{roles:JSON.stringify(d)});save();renderPage();toast('Defaults restored')})};
function setUsers(){if(cur().role!=='Super Admin')throw new Error('Only the Super Admin manages staff logins');const l=db.users.filter(u=>u.role!=='Student');
  return`<div class="scard"><h2>Staff logins <button class="btn primary" data-act="newUser">Add Clerk / Principal login</button></h2><div class="tablewrap"><table><thead><tr><th>Name</th><th>Role</th><th>Username</th><th>Email</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead><tbody>
  ${l.map(u=>`<tr><td><b>${E(u.name)}</b></td><td>${E(u.role)}</td><td class="mono">${E(u.username)}</td><td>${E(u.email)}</td><td><small>${u.lastLoginAt?fmtT(u.lastLoginAt):'Never'}</small></td><td>${u.active?pill('Active','good'):pill('Off','bad')}</td><td>${u.id===cur().id?'<small class="muted">You</small>':`<div class="actions nowrap"><button class="btn sm" data-act="userToggle" data-id="${E(u.id)}">${u.active?'Switch off':'Switch on'}</button><button class="btn sm" data-act="userPw" data-id="${E(u.id)}">Reset password</button></div>`}</td></tr>`).join('')}</tbody></table></div></div>`}
ACT.newUser=()=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');drawer(`<button class="btn x" data-act="close">Close</button><h2>Add staff login</h2><form data-form="newUser" class="form" style="margin-top:12px">${F('name','Full name',{req:true,span:1})}${F('role','Role',{opts:STAFF_ROLES})}${F('username','Username',{req:true,attrs:'autocapitalize="off" maxlength="30"'})}${F('email','Email',{type:'email',req:true,span:1})}<p class="note span">A temporary password is created; they must change it at first sign-in.</p><div class="actions span"><button class="btn primary">Create login</button></div></form>`)};
FORM.newUser=(f,d)=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');const un=String(d.username||'').trim().toLowerCase();if(!/^[a-z0-9._-]{3,30}$/.test(un))throw new Error('Username: 3-30 letters, numbers, . _ -');if(db.users.some(u=>u.username.toLowerCase()===un))throw new Error('This username is taken');
  const email=String(d.email||'').trim().toLowerCase();if(!MAIL_OK.test(email))throw new Error('Enter a valid email');if(!STAFF_ROLES.includes(d.role))throw new Error('Choose a role');const name=capText(d.name,'Name');if(name.length<2)throw new Error('Enter the name');
  const pw=tempPassword();const u={id:uid('u'),role:d.role,name,username:un,email,phone:'',password:pw,mustChange:true,active:true,lastLoginAt:0};db.users.push(u);log('Staff login created','User',un,null,{role:u.role,email});save();closeLayer();renderPage();
  dialog(`<h3>Login created</h3><p class="muted">Give these to ${E(name)}. Shown once.</p><div class="panel" style="padding:12px"><div class="rline"><span>Username</span><b class="mono">${E(un)}</b></div><div class="rline"><span>Temporary password</span><b class="mono">${E(pw)}</b></div></div><div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" data-act="closeDialog">Done</button></div>`,'Login created',true)};
ACT.userToggle=el=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');const u=db.users.find(x=>x.id===el.dataset.id);u.active=!u.active;log(u.active?'Login switched on':'Login switched off','User',u.username,{active:!u.active},{active:u.active});save();renderPage()};
ACT.userPw=el=>{if(cur().role!=='Super Admin')throw new Error('Not allowed');const u=db.users.find(x=>x.id===el.dataset.id);const pw=tempPassword();u.password=pw;u.mustChange=true;log('Password reset','User',u.username);save();dialog(`<h3>New temporary password</h3><div class="panel" style="padding:12px"><div class="rline"><span>${E(u.username)}</span><b class="mono">${E(pw)}</b></div></div><div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" data-act="closeDialog">Done</button></div>`,'Password reset',true)};
function setMail(){const m=db.settings.mail;
  return`<div class="sgrid"><form class="scard" data-form="mailSet"><h2>Email sender</h2><div class="form">${F('fromName','From name',{val:m.fromName,attrs:'maxlength="60"'})}${F('replyTo','Reply-to',{type:'email',val:m.replyTo})}${F('mode','Mode',{val:m.mode,opts:[['demo','Demo (nothing is sent)'],['live','Live (Resend)']]})}</div>
   <label class="chk" style="margin-top:10px"><input type="checkbox" name="sendReceipts" ${m.sendReceipts?'checked':''}> Email the receipt PDF after every payment</label><label class="chk"><input type="checkbox" name="sendCredentials" ${m.sendCredentials?'checked':''} disabled> Email login details to new students (always on)</label>
   <p class="note">The Resend API key stays on the server. Demo mode shows each email in the outbox below.</p><div class="actions" style="margin-top:12px"><button class="btn primary">Save</button></div></form>
   <div class="scard"><h2>Outbox ${pill(db.outbox.length+' emails')}</h2><div class="list">${db.outbox.slice(0,12).map(o=>`<div class="li"><div><b>${E(o.subject)}</b><small>${E(o.to.join(', '))} · ${E(fmtT(o.ts))}</small></div>${mailPill(o.status)}</div>`).join('')||'<p class="note">Nothing sent yet.</p>'}</div>
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
FORM.myPw=(f,d)=>{const u=cur();if(d.old!==u.password)throw new Error('Current password is wrong');if(!pwOk(d.p1))throw new Error('Use at least 8 characters with a letter and a number');if(d.p1!==d.p2)throw new Error('The two new passwords are not the same');u.password=d.p1;log('Password changed','User',u.username);save();f.reset();toast('Password changed')};
function staffProfileHtml(){const u=cur();const L=(k,v)=>`<div class="rline"><span>${k}</span><b style="font-weight:500;text-align:right;overflow-wrap:anywhere">${E(v||'-')}</b></div>`;
  return`<button class="btn x" data-act="close">Close</button><div class="who" style="margin:4px 0 14px"><div class="av lg">${E(initials(u.name))}</div><div><h2 style="margin:0">${E(u.name)}</h2><small class="muted">${E(u.role)}</small></div></div>
  <div class="panel">${L('Username',u.username)}${L('Email',u.email)}${L('Last sign-in',fmtT(u.lastLoginAt))}</div><div class="panel" style="margin-top:12px"><h2>What you can open</h2><div class="actions">${navFor(u).map(n=>pill(n[1])).join('')}</div></div><div class="panel" style="margin-top:12px"><h2>App</h2><div id="profileInstall">${installPanelHtml()}</div></div><div style="margin-top:12px">${accountPanel()}</div>`}
