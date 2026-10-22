/* =====================================================================
   Staff and roles, messages and notices, reports, audit log, settings
   ===================================================================== */
/* ----- staff & roles ----- */
const SYS_ROLES=['None',...ROLE_NAMES];
function viewStaff(){
  const t=ui.tab.staff||'staff';
  const acts=can('staff.manage')?'<button class="btn primary" data-act="addStaff">+ Add staff</button>':'';
  const body=t==='roles'?staffRoles():`<div class="panel" style="padding:6px 8px"><div class="tablewrap"><table><thead><tr><th>Name</th><th>Designation</th><th>Department</th><th>System role</th><th>Login</th><th>Status</th><th></th></tr></thead><tbody>
   ${db.staff.map(s=>{const u=db.users.find(x=>x.id===s.userId);return`<tr><td><div class="who"><div class="av">${E(initials(s.name))}</div><div>${E(s.name)}<br><small class="muted">${E(s.qualification)}</small></div></div></td><td>${E(s.designation)}</td><td>${E(s.department)}</td><td>${s.role==='None'?pill('No login'):pill(s.role,'acc')}</td>
   <td>${u?`<span class="mono">${E(u.username)}</span> ${u.active?pill('On','good'):pill('Off','bad')}`:s.role!=='None'?pill('Login not created','warn'):'—'}</td><td>${pill(s.status,s.status==='Active'?'good':s.status==='On leave'?'warn':'bad')}</td><td>${can('staff.manage')?`<button class="btn sm" data-act="editStaff" data-id="${E(s.id)}">Edit</button>`:''}</td></tr>`}).join('')}</tbody></table></div></div>`;
  return head('Staff and Roles','Every person gets their own login. The role decides which menus and actions they get.',acts)+tabsBar('staff',[['staff','Staff and logins'],['roles','Role permissions']],t)+body;
}
function staffRoles(){
  const edit=can('roles.manage');
  return`<div class="panel"><p class="note" style="margin:0 0 10px">${edit?'Tick or clear a box to change what a role can do. Changes apply the next time that person opens a page.':'Only the admin can change role permissions.'} Super Admin always has everything.</p><div class="tablewrap"><table class="matrix"><thead><tr><th>Permission</th>${ROLE_NAMES.map(r=>`<th>${E(r)}</th>`).join('')}</tr></thead><tbody>
  ${PERMS.map(p=>`<tr><td>${E(p[1])}</td>${ROLE_NAMES.map(r=>`<td><input type="checkbox" aria-label="${E(r)}: ${E(p[1])}" ${r==='Super Admin'||(db.roles[r]||[]).includes(p[0])?'checked':''} ${r==='Super Admin'||!edit?'disabled':''} data-change="permToggle" data-role="${E(r)}" data-p="${E(p[0])}"></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
CHG.permToggle=el=>{if(!can('roles.manage'))throw new Error('Only the admin can change permissions');const r=el.dataset.role,p=el.dataset.p;const set=new Set(db.roles[r]||[]);el.checked?set.add(p):set.delete(p);db.roles[r]=[...set];log('Permission changed',`${r}: ${PERMS.find(x=>x[0]===p)[1]} ${el.checked?'granted':'removed'}`);{const lb=PERMS.find(x=>x[0]===p)[1];notify('system','Permissions changed',`${r}: ${lb} ${el.checked?'granted':'removed'} by ${cur().name}.`,{tone:'warn',go:{staff:['staff','roles']}});notify('account','Your access changed',`“${lb}” was ${el.checked?'given to':'removed from'} the ${r} role by ${cur().name}. It applies the next time you open a page.`,{uids:db.users.filter(x=>x.role===r&&x.active).map(x=>x.id),roles:[],tone:'info'})}save();renderNav()};
const staffForm=s=>`<form data-form="saveStaff" data-id="${E(s?s.id:'')}" class="form" style="margin-top:12px">${F('name','Full name',{val:s?.name,req:1,span:1,attrs:`maxlength="${NAME_MAX}"`})}${F('designation','Designation',{val:s?.designation,req:1})}${F('department','Department',{val:s?.department})}${F('qualification','Qualification',{val:s?.qualification})}${F('phone','Mobile',{val:s?.phone})}${F('email','Email',{val:s?.email,type:'email'})}${F('joined','Joined on',{type:'date',val:s?.joined||today()})}
  ${F('status','Status',{opts:['Active','On leave','Left'],val:s?.status||'Active'})}${F('role','System role',{opts:SYS_ROLES,val:s?.role||'None'})}${(()=>{const u=s&&db.users.find(x=>x.id===s.userId);return F('username','Login username',{val:u?.username||'',ph:'Needed when a role is chosen'})+F('password','Password',{val:'',ph:u?'Leave blank to keep':'Min 6 characters'})})()}
  <button class="btn primary span">${s?'Save changes':'Add staff'}</button></form>`;
ACT.addStaff=()=>{need('staff.manage','manage staff');drawer(`<button class="btn x" data-act="close">Close</button><h2>Add staff</h2>${staffForm(null)}`)};
ACT.editStaff=el=>{need('staff.manage','manage staff');if(!staffOf(el.dataset.id))throw new Error('Staff member not found');drawer(`<button class="btn x" data-act="close">Close</button><h2>Edit staff</h2>${staffForm(staffOf(el.dataset.id))}`)};
FORM.saveStaff=(f,d)=>{
  if(!can('staff.manage'))throw new Error('You do not have access to manage staff');
  d.name=capText(d.name,'The staff name');if(!d.name)throw new Error('Enter the staff name');
  let s=f.dataset.id?staffOf(f.dataset.id):null;const isNew=!s;let u=s&&db.users.find(x=>x.id===s.userId);const was=u?{role:u.role,active:u.active,un:u.username}:null;
  if(d.role!=='None'){const un=(d.username||'').trim().toLowerCase();if(!un)throw new Error('Enter a login username for this role');
    if(db.users.some(x=>x.username.toLowerCase()===un&&x.id!==u?.id))throw new Error('This username is already taken');
    if(!u&&(d.password||'').length<6)throw new Error('Password must be at least 6 characters');if(d.password&&d.password.length<6)throw new Error('Password must be at least 6 characters')}
  if(isNew){s={id:uid('st'),userId:null};db.staff.push(s)}
  Object.assign(s,{name:d.name.trim(),designation:d.designation,department:d.department,qualification:d.qualification,phone:d.phone,email:d.email,joined:d.joined,status:d.status,role:d.role});
  if(d.role==='None'){if(u)u.active=false}
  else{if(!u){u={id:uid('u'),username:'',password:'',role:d.role,staffId:s.id,active:true};db.users.push(u);s.userId=u.id}
    u.username=d.username.trim();u.name=s.name;u.role=d.role;if(d.password)u.password=d.password;u.active=d.status!=='Left'}
  if(u&&u.id===sesGet()&&!u.active)sesDel();
  log(isNew?'Staff added':'Staff edited',`${s.name} (${d.role})`);
  if(u&&d.role!=='None'){const ch=[];if(isNew||!was)ch.push('created');else{if(was.role!==u.role)ch.push('role changed to '+u.role);if(d.password)ch.push('password reset by the administrator');if(was.un!==u.username)ch.push('username changed');if(!was.active&&u.active)ch.push('switched on')}
    if(ch.length){const by=(cur()||{name:'the administrator'}).name,made=ch[0]==='created';notify('account',`Your login was ${made?'created':'updated'}`,`${ch.join(', ')}. Username: ${u.username}.`,{uids:[u.id],roles:[],tone:'info'});notify('account',`Login ${made?'created':'updated'} · ${s.name}`,`${ch.join(', ')} (by ${by}).`,{tone:'info',go:{staff:['staff']}})}}save();closeLayer();toast(isNew?'Staff added. They can sign in now.':'Saved');if(!cur()){renderLogin();return}renderApp();
};

/* ----- messages ----- */
function viewMessages(){
  const tabs=(can('messages.send')?[['remind','Send reminders']]:[]).concat([['notices','Notices'],['log','Message log']]);let t=ui.tab.messages;if(!tabs.find(x=>x[0]===t))t=ui.tab.messages=tabs[0][0];
  const body=t==='remind'?msgRemind():t==='notices'?msgNotices():msgLog();
  return head('Messages and Notices','Send fee reminders and notices. In this demo, messages are written to the log instead of going out on WhatsApp or SMS.')+tabsBar('messages',tabs,t)+body;
}
function msgRemind(){
  const f=ui.f.remind=ui.f.remind||{only:'1',kind:'reminder',channel:'WhatsApp'};
  const l=dueList().filter(x=>!f.only||x.sm.overdue);const sample=l[0]?tpl(f.kind,l[0].s):'';
  return`<div class="grid two"><div class="panel"><h2>Students with dues</h2><form data-form="sendRemind"><div class="filters"><select aria-label="Who" data-change="remindF" data-k="only"><option value="1" ${f.only?'selected':''}>Overdue only</option><option value="" ${f.only?'':'selected'}>All with dues</option></select></div>
   <div class="tablewrap"><table><thead><tr><th></th><th>Student</th><th>Guardian mobile</th><th class="num">Payable</th></tr></thead><tbody>${l.map(x=>`<tr><td><input type="checkbox" name="ids" value="${E(x.s.id)}" checked aria-label="Select ${E(x.s.name)}"></td><td>${E(x.s.name)}</td><td>${E(x.s.whatsapp)}</td><td class="num amt">${inr(x.sm.payable)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">No students match.</td></tr>'}</tbody></table></div>
   <div class="form" style="margin-top:12px">${F('kind','Message',{opts:[['reminder','Fee reminder'],['overdue','Overdue notice']],val:f.kind,attrs:'data-change="remindF" data-k="kind"'})}${F('channel','Send by',{opts:['WhatsApp','SMS'],val:f.channel,attrs:'data-change="remindF" data-k="channel"'})}<button class="btn gold span" ${l.length?'':'disabled'}>Send to selected</button></div></form></div>
   <div class="panel"><h2>Preview</h2>${sample?`<div class="bubble">${E(sample)}</div><p class="note">Example for ${E(l[0].s.name)}. Each message is filled in for its own student.</p>`:'<p class="note">Nothing to preview.</p>'}<p class="note">WhatsApp messages need templates approved by WhatsApp before the live system can send them, and parents must agree to receive them.</p></div></div>`;
}
CHG.remindF=el=>{ui.f.remind[el.dataset.k]=el.value;renderPage()};
FORM.sendRemind=(form,d)=>{if(!can('messages.send'))throw new Error('You do not have access to send messages');const ids=$$('input[name=ids]:checked',form).map(i=>i.value);if(!ids.length)throw new Error('Select at least one student');
  ids.forEach(id=>{sendMsg(d.kind,stu(id),d.channel);notifyReminder(stu(id),d.kind)});log('Reminders sent',`${ids.length} by ${d.channel}`);save();toast(`${ids.length} messages written to the log`);ui.tab.messages='log';renderPage()};
function msgNotices(){
  const audName=a=>a==='all'?'Everyone':(course(a)?.name+' students');
  return`<div class="grid two"><div class="panel"><h2>Notices</h2><div class="list">${db.notices.map(n=>`<div class="li" style="align-items:flex-start"><div><b>${E(n.title)}</b><small>${fmtD(n.date)} · ${E(n.by)} · for ${E(audName(n.audience))}</small><p style="margin:6px 0 0">${E(n.body)}</p></div>${can('notices.post')?`<button class="btn sm danger" data-act="delNotice" data-id="${E(n.id)}" aria-label="Delete notice">×</button>`:''}</div>`).join('')||'<p class="note">No notices yet.</p>'}</div></div>
   ${can('notices.post')?`<div class="panel"><h2>Post a notice</h2><form data-form="addNotice" class="form">${F('title','Title',{req:1,span:1})}${F('audience','For',{opts:[['all','Everyone'],...db.courses.map(c=>[c.id,c.name+' students'])]})}<span></span>${F('body','Message',{type:'textarea',req:1,span:1,rows:4})}<button class="btn primary span">Post notice</button></form><p class="note">Parents see notices in their portal.</p></div>`:''}</div>`;
}
FORM.addNotice=(f,d)=>{if(!can('notices.post'))throw new Error('You do not have access to post notices');db.notices.unshift({id:uid('n'),title:d.title,body:d.body,audience:d.audience,date:today(),by:cur().name});log('Notice posted',d.title);notify('notice',d.title,String(d.body||'').slice(0,140),{course:d.audience,tone:'info',go:{staff:['messages','notices'],portal:'pnotices'}});save();toast('Notice posted');renderPage()};
ACT.delNotice=el=>{need('notices.post','notices');db.notices=db.notices.filter(n=>n.id!==el.dataset.id);save();renderPage()};
function msgLog(){
  return`<div class="panel"><h2>Message log ${pill(String(db.messages.length))}</h2><div class="list">${db.messages.slice(0,60).map(m=>`<div class="li" style="align-items:flex-start"><div><span class="label">${E(m.channel)} · ${E(m.kind)} · to ${E(m.studentId&&stu(m.studentId)?stu(m.studentId).guardian.name+' ('+m.to+')':m.to)}</span><div class="bubble" style="margin-top:6px">${E(m.text)}</div></div><div class="right"><small class="muted">${fmtT(m.ts)}</small><br>${pill(m.status,'good')}</div></div>`).join('')||'<p class="note">No messages yet. Collect a payment or send a reminder.</p>'}</div></div>`;
}

/* ----- reports ----- */
const REPORTS=[
 {id:'daily',g:'Fees',perm:'reports.fees',name:'Daily fee collection',flt:['date'],run:f=>{const l=db.payments.filter(p=>p.date===f.date).sort((a,b)=>a.ts-b.ts);return{cols:['Receipt','Student','Class','Mode','Reference','Amount','Status'],rows:l.map(p=>[p.rc,stu(p.studentId).name,classLabel(stu(p.studentId)),p.mode,p.ref,p.amount,p.status==='ok'?'Valid':'Cancelled']),foot:`Valid receipts ${inr(sum(l.filter(p=>p.status==='ok'),p=>p.amount))} · cash ${inr(sum(l.filter(p=>p.status==='ok'&&p.mode==='Cash'),p=>p.amount))} · online ${inr(sum(l.filter(p=>p.status==='ok'&&p.channel==='online'),p=>p.amount))}`}}},
 {id:'defaulters',g:'Fees',perm:'reports.fees',name:'Defaulter list',flt:['course'],run:f=>{const l=dueList().filter(x=>!f.course||x.s.course===f.course);return{cols:['Enrolment','Student','Class','Guardian mobile','Fee balance','Late fee','Payable','Overdue'],rows:l.map(x=>[x.s.id,x.s.name,classLabel(x.s),x.s.guardian.phone,x.sm.balance,x.sm.lateDue,x.sm.payable,x.sm.overdue?'Yes':'No']),foot:`${l.length} students · ${inr(sum(l,x=>x.sm.payable))} payable`}}},
 {id:'heads',g:'Fees',perm:'reports.fees',name:'Fee head summary',flt:['course'],run:f=>{const names={};live().filter(s=>!f.course||s.course===f.course).forEach(s=>{s.fee.heads.forEach(h=>{names[h.name]=names[h.name]||{d:0,c:0};names[h.name].d+=h.amount});db.payments.filter(p=>p.studentId===s.id&&p.feeId===s.fee.id&&p.status==='ok').forEach(p=>(p.alloc||[]).forEach(a=>{names[a.name]=names[a.name]||{d:0,c:0};names[a.name].c+=a.applied}))});
   const late=sum(db.payments.filter(p=>p.status==='ok'),p=>p.late||0);const rows=Object.entries(names).map(([n,v])=>[n,v.d,v.c,v.d-v.c]);rows.push(['Late fee collected','',late,'']);return{cols:['Fee head','Demand','Collected','Pending'],rows,foot:`Collected ${inr(sum(rows,r=>+r[2]||0))}`}}},
 {id:'conc',g:'Fees',perm:'reports.fees',name:'Concession register',flt:[],run:()=>{const l=db.students.filter(s=>s.fee.concession.status!=='none');return{cols:['Enrolment','Student','Type','Amount','Status','Requested by','Decided by'],rows:l.map(s=>{const c=s.fee.concession;return[s.id,s.name,c.type==='gov'?'Government scholarship':'Management',c.type==='gov'?s.fee.govReceivable:c.amount,c.status,c.requestedBy||'',c.approvedBy||'']})}}},
 {id:'mode',g:'Fees',perm:'reports.fees',name:'Online vs cash',flt:['range'],run:f=>{const l=db.payments.filter(p=>p.status==='ok'&&p.date>=f.from&&p.date<=f.to);const by={};l.forEach(p=>{by[p.mode]=by[p.mode]||{n:0,a:0};by[p.mode].n++;by[p.mode].a+=p.amount});const rows=Object.entries(by).map(([m,v])=>[m,ONLINE_MODES.includes(m)?'Online':m==='Imported'?'Imported':'Counter',v.n,v.a]);return{cols:['Mode','Channel','Receipts','Amount'],rows,foot:`Online ${inr(sum(l.filter(p=>p.channel==='online'),p=>p.amount))} · counter ${inr(sum(l.filter(p=>p.channel==='counter'),p=>p.amount))}`}}},
 {id:'bank',g:'Fees',perm:'reports.fees',name:'Bank matching',flt:[],run:()=>{const l=db.payments.filter(p=>p.channel==='online'&&p.status==='ok');return{cols:['Receipt','Date','Student','Reference','Amount','Bank status'],rows:l.map(p=>[p.rc,fmtD(p.date),stu(p.studentId).name,p.ref,p.amount,p.settle.status==='matched'?'Matched '+fmtD(p.settle.on):'Waiting']),foot:`Waiting ${inr(sum(l.filter(p=>p.settle.status==='pending'),p=>p.amount))}`}}},
 {id:'refunds',g:'Fees',perm:'reports.fees',name:'Cancelled receipts and refunds',flt:[],run:()=>({cols:['Receipt','Student','Date','Refund mode','Amount','Reason','By'],rows:db.refunds.map(r=>[r.rc,stu(r.studentId).name,fmtD(r.date),r.mode,r.amount,r.reason,r.by])})},
 {id:'gov',g:'Fees',perm:'reports.fees',name:'Scholarship receivable',flt:[],run:()=>{const l=db.students.filter(s=>s.fee.govReceivable>0);return{cols:['Enrolment','Student','Class','Receivable from portal'],rows:l.map(s=>[s.id,s.name,classLabel(s),s.fee.govReceivable]),foot:`Total ${inr(sum(l,s=>s.fee.govReceivable))}`}}},
 {id:'strength',g:'Students',perm:'reports.students',name:'Student strength',flt:[],run:()=>({cols:['Course','Batch','Division','Semester','Students','Seats'],rows:db.divisions.map(d=>[course(d.course).name,batchOf(d.batch).name,d.name,semOfDiv(d),db.students.filter(s=>s.div===d.id&&s.status==='Active').length,d.capacity])})},
 {id:'adm',g:'Students',perm:'reports.students',name:'Admission register',flt:['course'],run:f=>({cols:['Enrolment','Name','Gender','Category','Course','Batch','Admitted on','Guardian','Status'],rows:db.students.filter(s=>!f.course||s.course===f.course).map(s=>[s.id,s.name,s.gender,s.category,course(s.course).name,batchOf(s.batch).name,fmtD(s.admittedOn),s.guardian.name,admStatus(s)])})},
 {id:'docs',g:'Students',perm:'reports.students',name:'Documents pending',flt:[],run:()=>{const l=db.students.filter(s=>docsMissing(s));return{cols:['Enrolment','Student','Class','Missing required documents'],rows:l.map(s=>[s.id,s.name,classLabel(s),DOCS.filter(d=>d[2]&&!s.docs[d[0]]).map(d=>d[1]).join('; ')]),foot:`${l.length} students`}}},
 {id:'att',g:'Academic',perm:'reports.academic',name:'Attendance summary',flt:['div'],run:f=>({cols:['Enrolment','Student','Division','Attendance %','Below 75%'],rows:db.students.filter(s=>s.status==='Active'&&(!f.div||s.div===f.div)).map(s=>{const a=attPct(s);return[s.id,s.name,divName(divOf(s.div)),a===null?'':a,a!==null&&a<75?'Yes':'']})})},
 {id:'marks',g:'Academic',perm:'reports.academic',name:'Internal marks sheet',flt:['div','exam'],run:f=>{const d=divOf(f.div);if(!d)return{cols:['Info'],rows:[['Choose a division']]};const subs=db.subjects.filter(s=>s.course===d.course&&s.sem===semOfDiv(d));return{cols:['Enrolment','Student',...subs.map(s=>s.name)],rows:db.students.filter(s=>s.div===d.id&&s.status==='Active').map(s=>[s.id,s.name,...subs.map(sb=>{const r=db.marks.find(x=>x.divId===d.id&&x.subjectId===sb.id&&x.exam===f.exam);return r&&r.scores[s.id]!==undefined?r.scores[s.id]+'/'+r.max:''})])}}},
 {id:'practice',g:'Academic',perm:'reports.academic',name:'Practice teaching allotment',flt:[],run:()=>({cols:['Student','School','City','Mentor','Phase','From','To','Score'],rows:db.practice.map(p=>{const sc=db.schools.find(x=>x.id===p.schoolId);return[stu(p.studentId).name,sc?.name,sc?.city,sc?.mentor,p.phase,fmtD(p.start),fmtD(p.end),p.score]})})},
 {id:'staff',g:'Staff',perm:'reports.staff',name:'Staff register',flt:[],run:()=>({cols:['Name','Designation','Department','Qualification','Role','Status','Joined'],rows:db.staff.map(s=>[s.name,s.designation,s.department,s.qualification,s.role,s.status,fmtD(s.joined)])})}];
function viewReports(){
  const avail=REPORTS.filter(r=>can(r.perm));const f=ui.f.rep=ui.f.rep||{};if(!avail.find(r=>r.id===f.id))f.id=avail[0].id;
  Object.assign(f,{date:f.date||today(),from:f.from||addDays(today(),-60),to:f.to||today(),course:f.course||'',exam:f.exam||'Internal 1'});if(!f.div||!divOf(f.div))f.div=myDivisions()[0]?.id||'';
  const r=avail.find(x=>x.id===f.id);const res=r.run(f);const groups=[...new Set(avail.map(x=>x.g))];
  const ctl=r.flt.map(k=>k==='date'?`<div class="field"><label class="label" for="rp_date">Date</label><input type="date" id="rp_date" value="${E(f.date)}" data-change="repF" data-k="date"></div>`:
   k==='range'?`<div class="field"><label class="label" for="rp_from">From</label><input type="date" id="rp_from" value="${E(f.from)}" data-change="repF" data-k="from"></div><div class="field"><label class="label" for="rp_to">To</label><input type="date" id="rp_to" value="${E(f.to)}" data-change="repF" data-k="to"></div>`:
   k==='course'?`<div class="field"><label class="label" for="rp_course">Course</label><select id="rp_course" data-change="repF" data-k="course"><option value="">All courses</option>${db.courses.map(c=>`<option value="${E(c.id)}" ${f.course===c.id?'selected':''}>${E(c.name)}</option>`).join('')}</select></div>`:
   k==='div'?`<div class="field"><label class="label" for="rp_div">Division</label><select id="rp_div" data-change="repF" data-k="div"><option value="">All divisions</option>${db.divisions.map(d=>`<option value="${E(d.id)}" ${f.div===d.id?'selected':''}>${E(divName(d))}</option>`).join('')}</select></div>`:
   `<div class="field"><label class="label" for="rp_exam">Exam</label><select id="rp_exam" data-change="repF" data-k="exam">${EXAMS.map(x=>`<option ${f.exam===x?'selected':''}>${x}</option>`).join('')}</select></div>`).join('');
  const num=c=>/Amount|Payable|balance|Fee balance|Late fee|Demand|Collected|Pending|Receivable|Seats|Students|Receipts|%/i.test(c);
  return head('Reports','Pick a report, set the filters and copy it as CSV for Excel.',`<button class="btn" data-act="exportReport">Copy as CSV</button>`)+
  `<select class="repsel" aria-label="Choose a report" data-change="repPick">${groups.map(g=>`<optgroup label="${g}">${avail.filter(x=>x.g===g).map(x=>`<option value="${E(x.id)}" ${x.id===f.id?'selected':''}>${E(x.name)}</option>`).join('')}</optgroup>`).join('')}</select><div class="repgrid"><div class="panel repnav" style="padding:10px">${groups.map(g=>`<div class="label" style="padding:8px 8px 4px">${g}</div>${avail.filter(x=>x.g===g).map(x=>`<button class="btn" style="width:100%;text-align:left;margin-bottom:4px;${x.id===f.id?'background:var(--accent-soft);border-color:var(--accent)':''}" data-act="pickReport" data-id="${E(x.id)}">${E(x.name)}</button>`).join('')}`).join('')}</div>
  <div class="panel"><h2>${E(r.name)} ${pill(res.rows.length+' rows')}</h2>${ctl?`<div class="filters">${ctl}</div>`:''}<div class="tablewrap"><table><thead><tr>${res.cols.map(c=>`<th class="${num(c)?'num':''}">${E(c)}</th>`).join('')}</tr></thead><tbody>${res.rows.map(row=>`<tr>${row.map((v,i)=>`<td class="${typeof v==='number'?'num':''}">${typeof v==='number'&&/Amount|Payable|balance|Late|Demand|Collected|Pending|Receivable/i.test(res.cols[i])?inr(v):E(v)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${res.cols.length}" class="empty">No data for these filters.</td></tr>`}</tbody></table></div>${res.foot?`<p class="note"><b>${E(res.foot)}</b></p>`:''}</div></div>`;
}
ACT.pickReport=el=>{ui.f.rep.id=el.dataset.id;renderPage()};
CHG.repPick=el=>{ui.f.rep.id=el.value;renderPage()};
CHG.repF=el=>{ui.f.rep[el.dataset.k]=el.value;renderPage()};
ACT.exportReport=()=>{const f=ui.f.rep;const r=REPORTS.find(x=>x.id===f.id);if(!r)throw new Error('Report not found');need(r.perm,'this report');const res=r.run(f);showCsv(r.name+' (CSV)',res.cols,res.rows)};

/* ----- audit ----- */
function viewAudit(){
  const q=(ui.f.audit||'').toLowerCase();const l=db.audit.filter(a=>!q||(a.action+' '+a.detail+' '+a.user).toLowerCase().includes(q)).slice(0,120);
  return head('Audit Log','Who did what and when. Fee edits, waivers, cancellations and permission changes are all recorded.')+`<div class="filters"><input type="search" placeholder="Search the log" value="${E(ui.f.audit||'')}" data-live="auditQ" aria-label="Search the audit log"></div>
  <div class="panel" style="padding:6px 8px"><div class="tablewrap"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody id="auditRows">${auditRows(l)}</tbody></table></div></div>`;
}
const auditRows=l=>l.map(a=>`<tr><td>${fmtT(a.ts)}</td><td>${E(a.user)} ${a.role&&a.role!=='-'?pill(a.role):''}</td><td><b>${E(a.action)}</b></td><td style="white-space:normal;min-width:240px">${E(a.detail)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Nothing in the log yet.</td></tr>';
LIVE.auditQ=el=>{ui.f.audit=el.value;const q=el.value.toLowerCase();$('#auditRows').innerHTML=auditRows(db.audit.filter(a=>!q||(a.action+' '+a.detail+' '+a.user).toLowerCase().includes(q)).slice(0,120))};

/* ----- settings: one card per job ----- */
const SET_IC={
 college:'<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
 access:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M17 11l2 2 3.5-4"/>',
 fees:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
 bell:'<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/>',
 data:'<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
 reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>'};
const setIc=k=>`<span class="sic" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SET_IC[k]}</svg></span>`;
const setCard=(id,ic,title,desc,body,cls='')=>`<section class="scard ${cls}" id="set-${id}" aria-labelledby="set-${id}-h"><header class="shead">${setIc(ic)}<div><h2 id="set-${id}-h">${E(title)}</h2><p>${E(desc)}</p></div></header><div class="sbody">${body}</div></section>`;
const setGroup=(id,title,cards,cls='')=>cards.filter(Boolean).length?`<div class="sgroup" id="set-g-${id}"><h3 class="sglabel">${E(title)}</h3><div class="sgrid ${cls}">${cards.filter(Boolean).join('')}</div></div>`:'';
function viewSettings(){
  const st=db.settings;const n=k=>db[k].length;const su=cur().role==='Super Admin';
  const stat=(l,v)=>`<div class="li"><span>${l}</span><b>${v}</b></div>`;
  const college=setCard('college','college','College profile','Name and academic year shown on receipts, messages and the sidebar.',`<form data-form="saveSettings" class="form">${F('college','College name',{val:st.college,req:1,span:1,attrs:`maxlength="${NAME_MAX}"`})}${F('short','Short name (messages)',{val:st.short,attrs:`maxlength="${NAME_MAX}"`})}${F('city','City',{val:st.city,attrs:`maxlength="${NAME_MAX}"`})}${F('year','Academic year',{val:st.year,attrs:'maxlength="20"'})}<button class="btn primary span">Save</button></form>`);
  const access=setCard('access','access','Logins and roles','Who can sign in. Roles and their permissions are managed under Staff and Roles.',`<div class="list">${stat('Staff members',n('staff'))}${stat('Logins',n('users'))}${stat('Active logins',db.users.filter(u=>u.active!==false).length)}</div>${can('staff.view')?'<div class="actions" style="margin-top:12px"><button class="btn" data-act="go" data-to="staff">Open Staff and Roles</button></div>':''}`);
  const fees=setCard('fees','fees','Fees and receipts','Current rules used for every payment. Change them in Fee setup.',`<div class="list">${stat('Next receipt number',E(st.receiptPrefix+db.counters.rc))}${stat('Late fee per day',inr(st.lateFeePerDay))}${stat('Late fee cap',inr(st.lateCap))}${stat('Grace days',E(st.graceDays))}${stat('Installments due after',E(st.dueOffsets.join(', '))+' days')}</div>${can('fees.setup')?'<div class="actions" style="margin-top:12px"><button class="btn" data-act="alertGo" data-to="fees" data-sub="setup">Open Fee setup</button></div>':''}`);
  const mail=mailSettingsPanel();
  const nt=su?ntRulesPanel():'';
  const data=setCard('data','data','Data and backup','Everything is kept in this browser (localStorage). Another browser or device starts with its own sample data.',`<div class="list">${stat('Students',n('students'))}${stat('Receipts',n('payments'))}${stat('Audit entries',n('audit'))}</div><div class="actions" style="margin-top:12px"><button class="btn" data-act="backupOut">Show backup</button><button class="btn" data-act="backupIn">Restore from backup</button></div>`);
  const reset=setCard('reset','reset','Reset demo','Wipes every change you made and brings back the original sample students, fees and logins.',`<div class="actions"><button class="btn danger" data-act="resetDemo">Reset to sample data</button></div>`,'danger');
  const jump=[['college','College'],['fees','Fees and receipts'],['mail','Email'],...(su?[['notify','Notifications']]:[]),['data','Data and backup']];
  return head('Settings','Everything that can be configured, grouped by what it controls.')+
   `<nav class="sjump" aria-label="Jump to a settings card">${jump.map(([k,l])=>`<button type="button" data-act="setJump" data-to="${E(k)}">${E(l)}</button>`).join('')}</nav>`+
   setGroup('org','College and access',[college,access])+setGroup('fin','Fees and email',[fees,mail],'one')+(nt?`<div class="sgroup" id="set-g-notify"><h3 class="sglabel">Notifications</h3><div class="sgrid one">${nt}</div></div>`:'')+setGroup('data','Data',[data,reset]);
}
/* scroll to the card; when it sits in the first row of its group, scroll to the group so the group label is visible too */
ACT.setJump=el=>{const t=document.getElementById('set-'+el.dataset.to);if(t){const g=t.closest('.sgroup'),f=g&&g.querySelector('.scard'),top=g&&f&&Math.abs(t.getBoundingClientRect().top-f.getBoundingClientRect().top)<2;(top?g:t).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});t.classList.add('flash');setTimeout(()=>t.classList.remove('flash'),1400)}};
FORM.saveSettings=(f,d)=>{if(!can('settings.manage'))throw new Error('You do not have access to settings');const col=capText(d.college,'The college name'),sh=capText(d.short,'The short name'),ct=capText(d.city,'The city'),yr=capText(d.year,'The academic year',20);if(!col)throw new Error('Enter the college name');Object.assign(db.settings,{college:col,short:sh||col,city:ct,year:yr});log('Settings changed','College details');save();toast('Saved');renderApp()};
/* ----- backup and restore: settings.manage only. A backup never contains passwords or the mail access key; they stay in this browser. ----- */
function backupText(){
  const c=JSON.parse(JSON.stringify(db));
  c.users.forEach(u=>{delete u.password});
  if(c.settings&&c.settings.mail)delete c.settings.mail.key;
  return JSON.stringify(c);
}
ACT.backupOut=()=>{need('settings.manage','backups');drawer(`<button class="btn x" data-act="close">Close</button><h2>Backup</h2><p class="note">Copy this text and keep it safe. Paste it into Restore to bring the data back. Passwords and the mail access key are not included: they stay in this browser, and anyone restored on a new device gets a temporary password.</p><textarea class="csvbox" id="csvText" readonly>${E(backupText())}</textarea><div class="actions" style="margin-top:12px"><button class="btn primary" data-act="copyCsv">Copy to clipboard</button></div>`,true)};
ACT.backupIn=()=>{need('settings.manage','backups');drawer(`<button class="btn x" data-act="close">Close</button><h2>Restore from backup</h2><p class="note">The backup is checked first and refused if anything in it looks wrong. Existing logins keep their current password. A login that is not on this device gets a temporary password that you will see once.</p><form data-form="restore" class="grid" style="gap:12px;margin-top:12px"><textarea class="csvbox" name="json" required placeholder="Paste backup text here"></textarea><button class="btn danger">Replace all data with this backup</button></form>`,true)};
/* shape check: s text, i id, n number, d date, b true/false, o object, a list; a leading ? means optional; "x|y" lists the allowed words */
const BK_ID=/^[A-Za-z0-9_.-]{1,64}$/,BK_DATE=/^\d{4}-\d\d-\d\d$/,BK_NUM=/^\d+(\.\d+)?$/;
const BK_ROLES=[...ROLE_NAMES,'Parent','Student'].join('|'),BK_SYS=['None',...ROLE_NAMES].join('|');
const BK={
 user:{id:'i',username:'s',name:'s',role:BK_ROLES,active:'b',studentId:'?i',staffId:'?i',mustChange:'?b'},
 staff:{id:'i',name:'s',designation:'?s',department:'?s',qualification:'?s',phone:'?s',email:'?s',joined:'?d',role:BK_SYS,status:'s',userId:'?i'},
 student:{id:'i',name:'s',course:'i',batch:'i',div:'i',sem:'n',status:'s',phone:'s',whatsapp:'?s',email:'?s',address:'?s',city:'?s',pin:'?s',category:'?s',gender:'?s',dob:'?d',admittedOn:'?d',guardian:'o',academic:'o',docs:'o',fee:'o',feeHistory:'a'},
 guardian:{name:'?s',phone:'?s',email:'?s',occupation:'?s',income:'?s'},
 academic:{degree:'?s',university:'?s',year:'?s',pct:'?s',pgPct:'?s',sub1:'?s',sub2:'?s',rank:'?s'},
 fee:{id:'i',sem:'n',total:'n',paid:'n',paidLate:'n',lateWaived:'n',prev:'?n',planName:'s',start:'d',heads:'a',plan:'a',base:'a',concession:'o',cleared:'a',govReceivable:'?n'},
 concession:{type:'none|gov|mgmt',amount:'n',status:'none|pending|approved|rejected',requestedBy:'?s',approvedBy:'?s',why:'?s'},
 head:{name:'s',amount:'n'},plan:{label:'s',amt:'n',due:'d'},hist:{sem:'n',total:'n',paid:'?n',balanceCarried:'?n',feeId:'?i'},
 payment:{id:'i',rc:'s',studentId:'i',feeId:'i',sem:'n',date:'d',ts:'n',amount:'n',mode:'s',channel:'counter|online|imported',ref:'?s',by:'?s',status:'ok|cancelled',balAfter:'?n',paidAfter:'?n',late:'?n',feeAmt:'?n',credit:'?n',alloc:'?a',settle:'?o',cancel:'?o',snap:'?o'},
 alloc:{name:'s',amount:'n',before:'n',applied:'n',after:'n'},settle:{status:'s',on:'?d'},cancel:{reason:'?s',by:'?s',ts:'n',refundMode:'?s'},
 course:{id:'i',name:'s',code:'s',full:'s',semesters:'n',intake:'n',duration:'?s'},
 batch:{id:'i',course:'i',name:'s',startYear:'n'},
 division:{id:'i',course:'i',batch:'i',name:'s',teacher:'?s',capacity:'n'},
 subject:{id:'i',course:'i',sem:'n',name:'s',faculty:'?s'},
 refund:{id:'i',rc:'s',studentId:'i',amount:'n',mode:'s',date:'d',reason:'?s',by:'?s'},
 request:{id:'i',studentId:'i',amount:'n',mode:'s',status:'s',created:'n',by:'?s',paymentId:'?i'},
 mark:{id:'i',divId:'i',subjectId:'i',sem:'n',exam:'s',max:'n',scores:'o',by:'?s'},
 school:{id:'i',name:'s',city:'?s',mentor:'?s'},
 practice:{id:'i',studentId:'i',schoolId:'i',phase:'s',start:'d',end:'d',score:'?s',notes:'?s'},
 notice:{id:'i',title:'s',body:'s',audience:'s',date:'d',by:'?s'},
 message:{id:'i',ts:'n',channel:'s',to:'?s',studentId:'?i',kind:'s',text:'s',status:'s'},
 audit:{id:'i',ts:'n',user:'?s',role:'?s',action:'s',detail:'?s'},
 outbox:{id:'i',ts:'n',paymentId:'i',rc:'s',studentId:'i',to:'a',subject:'?s',filename:'?s',status:'s',mode:'?s',attempts:'?n',error:'?s'},
 notif:{id:'i',ts:'n',uid:'i',k:'s',t:'s',x:'?s',tone:'?s',route:'?s',tab:'?s',sid:'?s',open:'?s',read:'b',key:'?s',by:'?s'},
 closure:{date:'d',expected:'n',counted:'n',diff:'n',reason:'?s',by:'?s',ts:'n'},
 counters:{rc:'n',req:'n',enrol:'o'},
 settings:{college:'s',short:'?s',year:'?s',receiptPrefix:'s',lateFeePerDay:'n',lateCap:'n',graceDays:'n',dueOffsets:'a',city:'?s',mail:'?o',notify:'?o'},
 mail:{enabled:'?b',to:'?both|guardian|student',mode:'?demo|live',endpoint:'?s',fromName:'?s',replyTo:'?s',redirect:'?s'}};
function bkShape(v,kind,where){
  const spec=BK[kind];if(!v||typeof v!=='object'||Array.isArray(v))throw new Error(where+' is not an object');
  for(const k of Object.keys(spec)){
    let t=spec[k];const opt=t[0]==='?';if(opt)t=t.slice(1);const x=v[k];
    if(x===undefined||x===null){if(opt)continue;throw new Error(`${where}.${k} is missing`)}
    const good=t==='s'?typeof x==='string'&&x.length<=4000:t==='i'?typeof x==='string'&&BK_ID.test(x):t==='n'?typeof x==='number'&&isFinite(x):t==='d'?typeof x==='string'&&BK_DATE.test(x)
      :t==='b'?typeof x==='boolean':t==='o'?typeof x==='object'&&!Array.isArray(x):t==='a'?Array.isArray(x):t.split('|').includes(x);
    if(!good)throw new Error(`${where}.${k} has the wrong type or value`);
  }
}
function bkCheck(x){
  const L=(k,kind,req=true)=>{if(x[k]===undefined&&!req)return[];if(!Array.isArray(x[k]))throw new Error(k+' is missing');if(x[k].length>20000)throw new Error(k+' is too large');x[k].forEach((v,i)=>bkShape(v,kind,`${k}[${i}]`));return x[k]};
  const ids=(l,k)=>new Set(l.map(v=>v[k||'id']));
  const must=(set,v,w)=>{if(!set.has(v))throw new Error(w+' points to something that is not in the backup')};
  const O=(k)=>{if(!x[k]||typeof x[k]!=='object'||Array.isArray(x[k]))throw new Error(k+' is missing');return x[k]};
  const users=L('users','user'),staff=L('staff','staff'),students=L('students','student'),courses=L('courses','course'),batches=L('batches','batch'),divisions=L('divisions','division');
  L('subjects','subject');const payments=L('payments','payment'),refunds=L('refunds','refund'),requests=L('requests','request'),marks=L('marks','mark'),schools=L('schools','school'),practice=L('practice','practice');
  L('notices','notice');const messages=L('messages','message');L('audit','audit');const outbox=L('outbox','outbox',false);L('notifs','notif',false);
  if(!Array.isArray(x.plans)||!x.plans.length)throw new Error('plans is missing');
  x.plans.forEach((p,i)=>{if(!p||typeof p.name!=='string'||!Array.isArray(p.pct)||!p.pct.length||p.pct.some(n=>typeof n!=='number'||!isFinite(n)))throw new Error(`plans[${i}] is not valid`)});
  bkShape(O('settings'),'settings','settings');if(x.settings.mail)bkShape(x.settings.mail,'mail','settings.mail');
  if(!x.settings.dueOffsets.length||x.settings.dueOffsets.some(n=>typeof n!=='number'||!isFinite(n)))throw new Error('settings.dueOffsets is not valid');
  bkShape(O('counters'),'counters','counters');Object.values(x.counters.enrol).forEach(n=>{if(typeof n!=='number'||!isFinite(n))throw new Error('counters.enrol is not valid')});
  const roles=O('roles'),perms=new Set(PERMS.map(p=>p[0]));
  Object.keys(roles).forEach(r=>{if(!ROLE_NAMES.includes(r)||!Array.isArray(roles[r])||roles[r].some(p=>!perms.has(p)))throw new Error('roles is not valid')});
  const fs=O('feeStructure');Object.keys(fs).forEach(c=>{if(!Array.isArray(fs[c])||!fs[c].length)throw new Error('feeStructure is not valid');fs[c].forEach((h,i)=>bkShape(h,'head',`feeStructure.${c}[${i}]`))});
  Object.keys(O('closures')).forEach(d=>{if(!BK_DATE.test(d))throw new Error('closures is not valid');bkShape(x.closures[d],'closure','closures.'+d)});
  Object.keys(O('attendance')).forEach(d=>{if(!BK_DATE.test(d)||!x.attendance[d]||typeof x.attendance[d]!=='object')throw new Error('attendance is not valid');
    Object.keys(x.attendance[d]).forEach(dv=>{const r=x.attendance[d][dv];if(!BK_ID.test(dv)||!r||typeof r.sem!=='number'||!r.marks||typeof r.marks!=='object')throw new Error('attendance is not valid');
      Object.keys(r.marks).forEach(sid=>{if(!BK_ID.test(sid)||(r.marks[sid]!=='P'&&r.marks[sid]!=='A'))throw new Error('attendance is not valid')})})});
  marks.forEach((m,i)=>Object.keys(m.scores).forEach(sid=>{if(!BK_ID.test(sid)||typeof m.scores[sid]!=='string'||!BK_NUM.test(m.scores[sid]))throw new Error(`marks[${i}].scores must be numbers`)}));
  students.forEach((s,i)=>{const w=`students[${i}]`;bkShape(s.guardian,'guardian',w+'.guardian');bkShape(s.academic,'academic',w+'.academic');bkShape(s.fee,'fee',w+'.fee');bkShape(s.fee.concession,'concession',w+'.fee.concession');
    Object.values(s.docs).forEach(b=>{if(typeof b!=='boolean')throw new Error(w+'.docs is not valid')});
    s.fee.heads.concat(s.fee.base).forEach(h=>bkShape(h,'head',w+'.fee.heads'));s.fee.plan.forEach(p=>bkShape(p,'plan',w+'.fee.plan'));s.feeHistory.forEach(h=>bkShape(h,'hist',w+'.feeHistory'));
    if(s.fee.cleared.some(d=>d!==null&&!(typeof d==='string'&&BK_DATE.test(d))))throw new Error(w+'.fee.cleared is not valid')});
  payments.forEach((p,i)=>{if(p.alloc)p.alloc.forEach(a=>bkShape(a,'alloc',`payments[${i}].alloc`));if(p.settle)bkShape(p.settle,'settle',`payments[${i}].settle`);if(p.cancel)bkShape(p.cancel,'cancel',`payments[${i}].cancel`);if(p.status==='cancelled'&&!p.cancel)throw new Error(`payments[${i}].cancel is missing`)});
  outbox.forEach((o,i)=>{if(o.to.some(e=>typeof e!=='string'))throw new Error(`outbox[${i}].to is not valid`)});
  const sCourse=ids(courses),sBatch=ids(batches),sDiv=ids(divisions),sStu=ids(students),sSub=ids(x.subjects),sSch=ids(schools),sPay=ids(payments);
  batches.forEach(b=>must(sCourse,b.course,'a batch'));divisions.forEach(d=>{must(sCourse,d.course,'a division');must(sBatch,d.batch,'a division')});
  students.forEach(s=>{must(sCourse,s.course,'a student');must(sBatch,s.batch,'a student');must(sDiv,s.div,'a student')});
  payments.forEach(p=>must(sStu,p.studentId,'a receipt'));refunds.forEach(r=>must(sStu,r.studentId,'a refund'));requests.forEach(r=>must(sStu,r.studentId,'a payment request'));
  practice.forEach(p=>{must(sStu,p.studentId,'an allotment');must(sSch,p.schoolId,'an allotment')});marks.forEach(m=>{must(sDiv,m.divId,'a marks sheet');must(sSub,m.subjectId,'a marks sheet')});
  messages.forEach(m=>{if(m.studentId)must(sStu,m.studentId,'a message')});outbox.forEach(o=>{must(sStu,o.studentId,'an email');must(sPay,o.paymentId,'an email')});
  /* ids and receipt numbers must be unique: a duplicate would make two students (or two receipts) share one record, login or number */
  const uniq=(l,k,what)=>{const seen=new Set();l.forEach(v=>{if(seen.has(v[k]))throw new Error(`two ${what} share the same ${k==='rc'?'receipt number':'id'} (${v[k]})`);seen.add(v[k])})};
  uniq(students,'id','students');uniq(payments,'id','receipts');uniq(payments,'rc','receipts');uniq(refunds,'id','refunds');uniq(courses,'id','courses');uniq(batches,'id','batches');uniq(divisions,'id','divisions');uniq(staff,'id','staff members');uniq(x.subjects,'id','subjects');
  const seenU=new Set(),seenI=new Set();
  users.forEach(u=>{const k=u.username.trim().toLowerCase();if(!k||seenU.has(k)||seenI.has(u.id))throw new Error('two logins share a name or id');seenU.add(k);seenI.add(u.id);
    if(u.role==='Parent'||u.role==='Student')must(sStu,u.studentId,'a portal login')});
  if(!users.some(u=>u.active&&u.role==='Super Admin'))throw new Error('there is no active Super Admin login');
  const sUsr=ids(users);staff.forEach(s=>{if(s.userId)must(sUsr,s.userId,'a staff member')});
}
const tempPw=()=>{const a=new Uint32Array(2);crypto.getRandomValues(a);return 'Tmp-'+a[0].toString(36)+a[1].toString(36).slice(0,3)};
ACT.copyTemps=()=>{need('settings.manage','the temporary passwords');const t=$('#dlg textarea');if(!t)return;t.focus();t.select();try{navigator.clipboard.writeText(t.value).then(()=>toast('Copied'),()=>toast('Press Ctrl+C to copy the selected text'))}catch(e){toast('Press Ctrl+C to copy the selected text')}};
FORM.restore=(f,d)=>{
  need('settings.manage','restore backups');
  if(String(d.json||'').length>8e6)throw new Error('This backup is too large');
  let x;try{x=JSON.parse(d.json)}catch(e){throw new Error('This is not a valid backup')}if(!x||typeof x!=='object'||x.ver!==3||!x.students||!x.users)throw new Error('This backup is from a different version');
  try{bkCheck(x)}catch(e){throw new Error('This backup is damaged ('+e.message+'). Nothing was changed.')}
  /* passwords never come from the backup: a login that already exists here (same id or same username, same role) keeps its current password; any other login gets a temporary one.
     The Super Admin who is doing the restore always keeps their own login and password, so the college cannot be locked out by a restore. */
  const me=cur(),byId=new Map(db.users.map(u=>[u.id,u])),byName=new Map(db.users.map(u=>[u.username.toLowerCase(),u])),temps=[];
  x.users.forEach(u=>{const e=[byId.get(u.id),byName.get(u.username.toLowerCase())].find(c=>c&&c.role===u.role&&c.username.toLowerCase()===u.username.toLowerCase()&&typeof c.password==='string'&&c.password);
    if(e){u.password=e.password;if(e.mustChange)u.mustChange=true;else delete u.mustChange}else{u.password=tempPw();u.mustChange=true;temps.push([u.username,u.password])}});
  let kept='';
  if(me&&me.role==='Super Admin'&&typeof me.password==='string'&&me.password&&!x.users.some(u=>u.role==='Super Admin'&&u.username.toLowerCase()===me.username.toLowerCase())){
    const clash=x.users.find(u=>u.username.toLowerCase()===me.username.toLowerCase());
    if(!clash){x.users.push({id:x.users.some(u=>u.id===me.id)?uid('u'):me.id,username:me.username,password:me.password,name:me.name,role:'Super Admin',active:true});kept=me.username}
  }
  /* the mail access key is kept only when the mail server address is unchanged */
  const om=db.settings.mail||{},nm=x.settings.mail;x.settings.mail=Object.assign({},nm||{},{key:nm&&String(nm.endpoint||'')===String(om.endpoint||'')?(om.key||''):''});
  const fixed=fixCounters(x);
  db=x;migrate();
  /* the audit log records only how many temporary passwords were issued, never the passwords */
  log('Backup restored',`${x.students.length} students, ${x.users.length} logins${temps.length?`; temporary passwords issued for ${temps.length} users`:''}${kept?`; the signed-in Super Admin login "${kept}" was kept`:''}${fixed.length?`; counters raised: ${fixed.join(', ')}`:''}`);
  const saved=save();sesDel();closeLayer();renderLogin();toast('Backup restored. Sign in again.');
  if(temps.length||kept||!saved)dialog(`<h3>Restore finished</h3>
   ${saved?'':`<p class="err" role="alert" style="margin:0 0 10px">${E(SAVE_FAIL_MSG)}. This backup is too big for the browser storage, so it exists only in memory until you reload.</p>`}
   ${kept?`<p class="muted" style="margin:0 0 10px">Your own login <b>${E(kept)}</b> is not in this backup. It was kept with your current password, so you can sign in.</p>`:''}
   ${temps.length?`<p class="muted" style="margin:0 0 10px">Temporary passwords were issued for ${temps.length} user${temps.length>1?'s':''}: ${temps.length>1?'these logins were':'this login was'} not on this device. Passwords are never stored in a backup. Each person must choose a new password at first sign-in. <b>Copy this list now. It is shown once and is not saved anywhere.</b></p><textarea class="csvbox" readonly rows="8" aria-label="Temporary passwords">${E(temps.map(t=>t[0]+'   '+t[1]).join('\n'))}</textarea>`:''}
   <div class="actions" style="justify-content:flex-end;margin-top:12px">${temps.length?'<button class="btn" data-act="copyTemps" type="button">Copy list</button>':''}<button class="btn primary" data-act="closeDialog" type="button">${temps.length?'I have noted them':'Close'}</button></div>`,'Restore finished',true);
};
