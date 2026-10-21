/* =====================================================================
   Student portal (own fees, attendance, marks, profile) and the pieces shared with the parent portal
   ===================================================================== */
const firstName=n=>String(n).replace(/^(Dr\.|Prof\.|Shri|Smt\.)\s+/,'').split(' ')[0];
function attDays(s){
  const out=[];Object.keys(db.attendance).sort().forEach(dt=>{const r=db.attendance[dt][s.div];if(r&&r.sem===s.sem&&r.marks[s.id])out.push({date:dt,v:r.marks[s.id]})});return out;
}
function attBreakdown(s){
  const m={};attDays(s).forEach(d=>{const k=d.date.slice(0,7);(m[k]=m[k]||{p:0,t:0});m[k].t++;if(d.v==='P')m[k].p++});
  return Object.entries(m).sort((a,b)=>b[0].localeCompare(a[0])).map(([k,v])=>({k,label:MON[+k.slice(5)-1]+' '+k.slice(0,4),...v,pct:Math.round(v.p/v.t*100)}));
}
function marksOf(s){return db.marks.filter(m=>m.divId===s.div&&m.scores[s.id]!==undefined).map(m=>{const sb=db.subjects.find(x=>x.id===m.subjectId);const sc=+m.scores[s.id];return{subject:sb?sb.name:'-',exam:m.exam,sem:m.sem,score:sc,max:m.max,pct:Math.round(sc/m.max*100)}})}
const attStrip=s=>{const d=attDays(s).slice(-14);return d.length?`<div class="attstrip" role="img" aria-label="Last ${d.length} marked days">${d.map(x=>`<span class="${x.v==='P'?'p':'a'}" title="${fmtD(x.date)}: ${x.v==='P'?'Present':'Absent'}"><i>${x.date.slice(8)}</i></span>`).join('')}</div><p class="note" style="margin:6px 0 0">Last ${d.length} marked days. Green is present, red is absent.</p>`:'<p class="note">Attendance has not been marked yet.</p>'};

function viewStudentHome(){
  const s=myChild(),sm=feeSum(s),a=attPct(s),dv=divOf(s.div),ct=db.staff.find(x=>x.id===dv?.teacher);
  const mk=marksOf(s);const avg=mk.length?Math.round(sum(mk,x=>x.pct)/mk.length):null;const nx=sm.nextInst;const n=myNotices(s)[0];
  return head(`Hello, ${firstName(s.name)}`,`${classLabel(s)} · ${s.id}`)+
  `<div class="kpis"><div class="kpi"><span class="label">Attendance</span><div class="v" ${a!==null&&a<75?'style="color:var(--bad)"':''}>${a===null?'-':a+'%'}</div><div class="s">${a===null?'Not marked yet':a<75?'Below the 75% requirement':'Meets the 75% requirement'}</div></div>
   <div class="kpi"><span class="label">Fee payable now</span><div class="v" ${sm.payable>0?'style="color:var(--warn)"':''}>${inr(sm.payable)}</div><div class="s">${sm.payable>0?feePillText(sm):'All clear'}</div></div>
   <div class="kpi"><span class="label">Next installment</span><div class="v" style="font-size:20px">${nx?fmtD(nx.due):'None'}</div><div class="s">${nx?E(nx.label)+' · '+inr(nx.remaining)+(nx.overdue?' (overdue)':''):'Fee fully paid'}</div></div>
   <div class="kpi"><span class="label">Internal marks</span><div class="v">${avg===null?'-':avg+'%'}</div><div class="s">${mk.length?'Average of '+mk.length+' exam'+(mk.length>1?'s':''):'No marks yet'}</div></div></div>
  <div class="grid even"><div class="panel"><h2>Fees ${feePill(sm)}</h2><div class="rline"><span>Semester ${s.fee.sem} fee</span><b>${inr(sm.total)}</b></div><div class="rline"><span>Paid</span><b>${inr(sm.paid)}</b></div><div class="rline"><span>Balance</span><b>${inr(sm.balance)}</b></div>${sm.lateDue>0?`<div class="rline"><span>Late fee</span><b style="color:var(--bad)">${inr(sm.lateDue)}</b></div>`:''}
    <div class="actions" style="margin-top:12px">${sm.payable>0?`<button class="btn primary" data-act="parentPay">Pay now</button>`:pill('Nothing due','good')}<button class="btn" data-act="go" data-to="pfees">Receipts</button></div>
    <p class="note">A PDF receipt is emailed to you after every payment.</p></div>
   <div class="panel"><h2>Attendance</h2>${attStrip(s)}<div class="actions" style="margin-top:10px"><button class="btn sm" data-act="go" data-to="sacademic">Full attendance and marks</button></div></div>
   <div class="panel"><h2>My class</h2><div class="rline"><span>Course</span><span>${E(course(s.course).name)}</span></div><div class="rline"><span>Batch</span><span>${E(batchOf(s.batch)?.name||'-')}</span></div><div class="rline"><span>Division</span><span>${E(dv?.name||'-')}</span></div><div class="rline"><span>Class teacher</span><span>${E(ct?ct.name:'-')}</span></div></div>
   <div class="panel"><h2>Latest notice</h2>${n?`<b>${E(n.title)}</b><small class="muted" style="display:block">${fmtD(n.date)}</small><p>${E(n.body)}</p>`:'<p class="note">No notices.</p>'}</div></div>`;
}
const feePillText=sm=>sm.overdue?'Overdue':sm.status;
function viewStudentAcademic(){
  const s=myChild(),a=attPct(s),days=attDays(s),pres=days.filter(d=>d.v==='P').length,mk=marksOf(s);const pt=db.practice.find(p=>p.studentId===s.id);const sc=pt&&db.schools.find(x=>x.id===pt.schoolId);
  const subs=db.subjects.filter(x=>x.course===s.course&&x.sem===s.sem);
  return head('My Academics',`${classLabel(s)} · Semester ${s.sem}`)+
  `<div class="grid even"><div class="panel"><h2>Attendance ${a===null?'':a<75?pill(a+'% low','bad'):pill(a+'%','good')}</h2>
    ${days.length?`<div class="rline"><span>Days present</span><b>${pres} of ${days.length}</b></div>${attStrip(s)}<div class="list" style="margin-top:12px">${attBreakdown(s).map(m=>`<div class="li"><span>${E(m.label)}<small>${m.p} of ${m.t} days</small></span><div style="display:flex;gap:10px;align-items:center;min-width:120px"><div class="bar ${m.pct<75?'warn':''}" style="flex:1"><i style="width:${m.pct}%"></i></div><b>${m.pct}%</b></div></div>`).join('')}</div>`:'<p class="note">Attendance has not been marked yet.</p>'}</div>
   <div class="panel"><h2>Internal marks ${pill(String(mk.length))}</h2>${mk.length?`<div class="tablewrap"><table><thead><tr><th>Subject</th><th>Exam</th><th class="num">Marks</th><th class="num">%</th></tr></thead><tbody>${mk.map(m=>`<tr><td>${E(m.subject)}</td><td>${E(m.exam)}</td><td class="num">${m.score}/${m.max}</td><td class="num">${m.pct}%</td></tr>`).join('')}</tbody></table></div>`:'<p class="note">No marks have been entered yet.</p>'}</div>
   <div class="panel"><h2>Subjects this semester</h2><div class="list">${subs.map(x=>`<div class="li"><span>${E(x.name)}<small>${E((db.staff.find(t=>t.id===x.faculty)||{}).name||'Faculty not set')}</small></span></div>`).join('')||'<p class="note">No subjects set for this semester.</p>'}</div></div>
   ${pt?`<div class="panel"><h2>Practice teaching ${pill(pt.phase)}</h2><div class="rline"><span>School</span><span>${E(sc?sc.name:'-')}</span></div><div class="rline"><span>Mentor</span><span>${E(sc?sc.mentor:'-')}</span></div><div class="rline"><span>Dates</span><span>${fmtD(pt.start)} to ${fmtD(pt.end)}</span></div><div class="rline"><span>Score</span><span>${pt.score?E(pt.score):'Not graded yet'}</span></div></div>`:''}</div>`;
}
function receiptTargetsNote(s){const t=mailTargets(s);return t.length?`Receipts are emailed to ${E(t.map(x=>x.email).join(', '))}.`:'No email address is saved, so receipts cannot be emailed yet.'}
function contactPanel(){
  const s=myChild(),u=cur(),mail=mailCfg();
  const rows=u.role==='Student'?[['Your email',s.email||'Not added'],['Your mobile',s.phone||'-']]:[['Parent email',s.guardian.email||'Not added'],['Parent mobile',s.guardian.phone||'-']];
  return`<div class="panel"><h2>Contact for receipts</h2>${rows.map(r=>`<div class="rline"><span>${r[0]}</span><b style="overflow-wrap:anywhere;text-align:right">${E(r[1])}</b></div>`).join('')}<p class="note">${mail.enabled?receiptTargetsNote(s):'Automatic receipt emails are switched off by the college.'}</p><div class="actions"><button class="btn" data-act="myContact">Update contact details</button></div></div>`;
}
ACT.myContact=()=>{
  const s=myChild(),u=cur();
  dialog(`<h3>Update contact details</h3><form data-form="myContact" class="grid" style="gap:12px">${u.role==='Student'?F('email','Your email',{val:s.email,type:'email',ph:'you@example.com'})+F('phone','Your mobile',{val:s.phone,req:1,attrs:'pattern="[0-9 ]{10,12}" title="10 digit mobile number"'}):F('email','Parent email',{val:s.guardian.email||'',type:'email',ph:'parent@example.com'})+F('phone','Parent mobile',{val:s.guardian.phone,req:1,attrs:'pattern="[0-9 ]{10,12}" title="10 digit mobile number"'})}
   <div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeDialog">Cancel</button><button class="btn primary">Save</button></div></form>`);
};
FORM.myContact=(f,d)=>{
  const s=myChild(),u=cur();const email=(d.email||'').trim();
  if(email&&!MAIL_RE.test(email))throw new Error('That email address does not look right');
  if(String(d.phone).replace(/\D/g,'').length<10)throw new Error('Enter a 10 digit mobile number');
  if(u.role==='Student'){s.email=email;s.phone=d.phone.trim();if(s.whatsapp===undefined||!s.whatsapp)s.whatsapp=s.phone}else{s.guardian.email=email;s.guardian.phone=d.phone.trim()}
  log('Contact updated',`${u.role} portal: ${s.name}`);notify('student',`${s.name}: contact details updated`,`The ${u.role.toLowerCase()} changed the phone or email from the portal.`,{sid:s.id,tone:'info',go:{staff:['students']},open:'student'});save();closeDialog();toast('Contact details saved');renderPage();
};
function accountPanel(){
  const u=cur();
  return`<div class="panel"><h2>Sign-in</h2><div class="rline"><span>Username</span><b class="mono">${E(u.username)}</b></div>
   <form data-form="myPassword" class="grid" style="gap:10px;margin-top:10px">${F('cur','Current password',{type:'password',req:1})}${F('next','New password (6 or more characters)',{type:'password',req:1,attrs:'minlength="6"'})}<button class="btn">Change password</button></form></div>`;
}
FORM.myPassword=(f,d)=>{
  const u=cur();if(d.cur!==u.password)throw new Error('Current password is not correct');if(String(d.next).length<6)throw new Error('New password must be at least 6 characters');if(d.next===d.cur)throw new Error('Choose a different password');
  u.password=d.next;log('Password changed',u.role+' portal');notify('account',`Password changed · ${u.name}`,`${u.role} login ${u.username} changed its password.`,{tone:'info'});save();toast('Password changed');renderPage();
};
function viewStudentProfile(){
  const s=myChild(),c=course(s.course),b=batchOf(s.batch);
  const L=(k,v)=>`<div class="rline"><span>${k}</span><b style="overflow-wrap:anywhere;text-align:right;font-weight:500">${E(v||'-')}</b></div>`;
  return head('My Profile','Your details as recorded by the college. Ask the office to correct anything else.')+
  `<div class="grid even"><div class="panel"><div class="who" style="margin-bottom:12px"><div class="av">${E(initials(s.name))}</div><div><b>${E(s.name)}</b><br><small class="muted">${E(s.id)}</small></div></div>
    ${L('Course',c.name)}${L('Batch',b?b.name:'')}${L('Class',classLabel(s))}${L('Date of birth',s.dob?fmtD(s.dob):'')}${L('Gender',s.gender)}${L('Category',s.category)}${L('Admission',admStatus(s))}${L('Address',[s.address,s.city,s.pin].filter(Boolean).join(', '))}</div>
   ${contactPanel()}
   <div class="panel"><h2>Parent / guardian</h2>${L('Name',s.guardian.name)}${L('Mobile',s.guardian.phone)}${L('Email',s.guardian.email)}</div>
   ${accountPanel()}</div>`;
}
