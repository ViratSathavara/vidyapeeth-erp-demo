/* =====================================================================
   Academic setup, attendance, internal marks, practice teaching
   ===================================================================== */
const divName=d=>`${course(d.course).name} ${batchOf(d.batch).name} · Division ${d.name}`;
const semOfDiv=d=>db.students.find(s=>s.div===d.id)?.sem||1;

/* ----- academic setup ----- */
function viewAcademic(){
  const t=ui.tab.academic||'structure';
  const body=t==='subjects'?acSubjects():acStructure();
  return head('Academic Setup','Build the college once: courses, batches, divisions and subjects. Students are placed in a division when admitted.',`<button class="btn primary" data-act="addCourse">+ Course</button>`)+
   tabsBar('academic',[['structure','Courses, batches and divisions'],['subjects','Subjects and faculty']],t)+body;
}
function acStructure(){
  return`<div class="steps" style="margin-bottom:14px"><span class="pill">Academic year ${E(db.settings.year)}</span><em>→</em><span class="pill">Course</span><em>→</em><span class="pill">Batch</span><em>→</em><span class="pill">Division</span><em>→</em><span class="pill">Student</span></div>
  <div class="grid even">${db.courses.map(c=>`<div class="panel"><h2>${E(c.name)} <span class="muted" style="font-weight:400">${E(c.full)}</span><button class="btn sm danger" data-act="delCourse" data-id="${c.id}">Remove</button></h2>
   <p class="note" style="margin:0 0 8px">${E(c.duration)} · ${c.semesters} semesters · intake ${c.intake} · fee ${inr(sum(db.feeStructure[c.id]||[],h=>h.amount))} per semester</p>
   ${db.batches.filter(b=>b.course===c.id).map(b=>`<div style="border-top:1px dashed var(--line);padding:10px 0"><div class="li" style="border:0;padding:0 0 8px"><b>Batch ${E(b.name)} ${pill(db.students.filter(s=>s.batch===b.id).length+' students')}</b><button class="btn sm danger" data-act="delBatch" data-id="${b.id}">Remove batch</button></div>
    ${db.divisions.filter(d=>d.batch===b.id).map(d=>`<div class="li" style="padding:6px 0"><div><b>Division ${E(d.name)}</b><small>${db.students.filter(s=>s.div===d.id).length} of ${d.capacity} seats</small></div>
     <div class="actions"><select aria-label="Class teacher for division ${E(d.name)}" data-change="divTeacher" data-id="${d.id}">${db.staff.filter(s=>s.status!=='Left').map(s=>`<option value="${s.id}" ${d.teacher===s.id?'selected':''}>${E(s.name)}</option>`).join('')}</select><button class="btn sm danger" data-act="delDivision" data-id="${d.id}">Remove</button></div></div>`).join('')||'<p class="note">No divisions yet.</p>'}
    <form data-form="addDivision" data-b="${b.id}" class="actions" style="margin-top:6px"><input name="name" placeholder="Division name" required style="width:130px"><input name="capacity" type="number" min="1" value="50" style="width:80px" aria-label="Seats"><button class="btn sm">+ Division</button></form></div>`).join('')}
   <form data-form="addBatch" data-c="${c.id}" class="actions" style="border-top:1px dashed var(--line);padding-top:10px"><input name="name" placeholder="2027–29" required style="width:130px"><input name="startYear" type="number" placeholder="2027" required style="width:90px"><button class="btn sm">+ Batch</button></form></div>`).join('')}</div>`;
}
ACT.addCourse=()=>{drawerDialog('New course',`<form data-form="addCourse" class="form">${F('name','Short name',{req:1,ph:'B.Ed'})}${F('code','Code (for enrolment no.)',{req:1,ph:'BED'})}${F('full','Full name',{req:1,span:1})}${F('semesters','Semesters',{type:'number',val:4,req:1,attrs:'min="1" max="8"'})}${F('intake','Intake',{type:'number',val:50,req:1})}${F('duration','Duration',{val:'2 years'})}<button class="btn primary span">Create course</button></form>`)};
function drawerDialog(title,html){dialog(`<h3>${E(title)}</h3>${html}<div class="actions" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-act="closeDialog">Close</button></div>`)}
FORM.addCourse=(f,d)=>{
  if(!can('academic.manage'))throw new Error('You do not have access');const id=d.code.toLowerCase().replace(/[^a-z0-9]/g,'')||uid('c');if(db.courses.find(c=>c.id===id||c.code===d.code.toUpperCase()))throw new Error('A course with this code already exists');
  db.courses.push({id,name:d.name,code:d.code.toUpperCase(),full:d.full,semesters:+d.semesters,intake:+d.intake,duration:d.duration});db.feeStructure[id]=[{name:'Tuition fee',amount:20000},{name:'University exam fee',amount:2000}];
  log('Course added',d.name);save();closeDialog();toast('Course added. Set its fees in Fee Collection, then Fee setup.');renderPage();
};
ACT.delCourse=el=>{const c=course(el.dataset.id);if(db.students.some(s=>s.course===c.id)||db.batches.some(b=>b.course===c.id))throw new Error('Remove its batches and students first');confirmBox('Remove course',c.name+' will be deleted.','Remove',()=>{db.courses=db.courses.filter(x=>x.id!==c.id);delete db.feeStructure[c.id];db.subjects=db.subjects.filter(x=>x.course!==c.id);log('Course removed',c.name);save();renderPage()},true)};
FORM.addBatch=(f,d)=>{if(!can('academic.manage'))throw new Error('You do not have access');if(db.batches.some(b=>b.course===f.dataset.c&&b.name===d.name))throw new Error('This batch already exists');db.batches.push({id:uid('b'),course:f.dataset.c,name:d.name,startYear:+d.startYear});log('Batch added',course(f.dataset.c).name+' '+d.name);save();renderPage()};
ACT.delBatch=el=>{const b=batchOf(el.dataset.id);if(db.students.some(s=>s.batch===b.id))throw new Error('This batch still has students');db.divisions=db.divisions.filter(d=>d.batch!==b.id);db.batches=db.batches.filter(x=>x.id!==b.id);log('Batch removed',b.name);save();renderPage()};
FORM.addDivision=(f,d)=>{if(!can('academic.manage'))throw new Error('You do not have access');const b=batchOf(f.dataset.b);if(db.divisions.some(x=>x.batch===b.id&&x.name.toLowerCase()===d.name.trim().toLowerCase()))throw new Error('This division already exists');
  db.divisions.push({id:uid('d'),course:b.course,batch:b.id,name:d.name.trim(),teacher:db.staff.find(s=>s.role==='Faculty'&&s.status==='Active')?.id||'',capacity:+d.capacity});log('Division added',course(b.course).name+' '+b.name+' '+d.name);save();renderPage()};
ACT.delDivision=el=>{const d=divOf(el.dataset.id);if(db.students.some(s=>s.div===d.id))throw new Error('Move the students out of this division first');db.divisions=db.divisions.filter(x=>x.id!==d.id);log('Division removed',divName(d));save();renderPage()};
CHG.divTeacher=el=>{const d=divOf(el.dataset.id);d.teacher=el.value;log('Class teacher changed',divName(d)+' → '+staffOf(el.value).name);save();toast('Class teacher updated')};
function acSubjects(){
  return`<div class="grid even">${db.courses.map(c=>`<div class="panel"><h2>${E(c.name)} subjects</h2>${Array.from({length:c.semesters},(_,i)=>i+1).map(sem=>`<h3>Semester ${sem}</h3><div class="list">${db.subjects.filter(s=>s.course===c.id&&s.sem===sem).map(s=>`<div class="li"><b style="font-weight:600">${E(s.name)}</b><div class="actions"><select aria-label="Faculty for ${E(s.name)}" data-change="subFaculty" data-id="${s.id}">${db.staff.filter(x=>x.role==='Faculty').map(x=>`<option value="${x.id}" ${s.faculty===x.id?'selected':''}>${E(x.name)}</option>`).join('')}</select><button class="btn sm danger" data-act="delSubject" data-id="${s.id}" aria-label="Remove ${E(s.name)}">×</button></div></div>`).join('')||'<p class="note">No subjects.</p>'}</div>`).join('')}
   <form data-form="addSubject" data-c="${c.id}" class="actions" style="border-top:1px dashed var(--line);margin-top:12px;padding-top:12px"><input name="name" placeholder="Subject name" required style="flex:1;min-width:140px"><select name="sem" aria-label="Semester">${Array.from({length:c.semesters},(_,i)=>`<option value="${i+1}">Sem ${i+1}</option>`).join('')}</select><button class="btn sm">+ Subject</button></form></div>`).join('')}</div>`;
}
FORM.addSubject=(f,d)=>{if(!can('academic.manage'))throw new Error('You do not have access');db.subjects.push({id:uid('sb'),course:f.dataset.c,sem:+d.sem,name:d.name.trim(),faculty:db.staff.find(s=>s.role==='Faculty')?.id||''});log('Subject added',d.name);save();renderPage()};
CHG.subFaculty=el=>{const s=db.subjects.find(x=>x.id===el.dataset.id);s.faculty=el.value;log('Faculty assigned',s.name+' → '+staffOf(el.value).name);save();toast('Faculty updated')};
ACT.delSubject=el=>{const s=db.subjects.find(x=>x.id===el.dataset.id);if(db.marks.some(m=>m.subjectId===s.id))throw new Error('Marks exist for this subject, so it cannot be removed');db.subjects=db.subjects.filter(x=>x.id!==s.id);log('Subject removed',s.name);save();renderPage()};

/* ----- attendance ----- */
function viewAttendance(){
  const tabs=(can('attendance.mark')?[['mark','Mark attendance']]:[]).concat([['register','Register'],['low','Below 75%']]);let t=ui.tab.attendance;if(!tabs.find(x=>x[0]===t))t=ui.tab.attendance=tabs[0][0];
  const divs=myDivisions();const f=ui.f.att=ui.f.att||{};if(!divs.find(d=>d.id===f.div))f.div=divs[0]?.id;
  const sel=`<div class="filters"><select aria-label="Division" data-change="attDiv">${divs.map(d=>`<option value="${d.id}" ${f.div===d.id?'selected':''}>${E(divName(d))}</option>`).join('')}</select></div>`;
  return head('Attendance',can('attendance.mark')?'Mark each division once a day. Everyone is present by default, so only tap the absent students.':'Attendance by division')+tabsBar('attendance',tabs,t)+(t==='low'?attLow(divs):sel+(t==='mark'?attMark(f):attRegister(f)));
}
CHG.attDiv=el=>{ui.f.att.div=el.value;renderPage()};
function attMark(f){
  if(!f.div)return'<div class="panel empty">You have no divisions assigned.</div>';
  const d=divOf(f.div);const date=f.date||today();const rec=db.attendance[date]?.[d.id];const studs=db.students.filter(s=>s.div===d.id&&s.status==='Active');
  return`<div class="panel"><form data-form="markAtt" data-d="${d.id}"><div class="filters"><div class="field"><label class="label" for="ad">Date</label><input type="date" id="ad" name="date" value="${date}" max="${today()}" data-change="attDate"></div>${rec?pill('Already marked · editing','acc'):pill('Not marked yet','warn')}<span style="flex:1"></span><button type="button" class="btn sm" data-act="allPresent">Mark all present</button></div>
   <div class="tablewrap"><table><thead><tr><th>Student</th><th>Present</th><th>Absent</th><th>This sem</th></tr></thead><tbody>${studs.map(s=>{const v=rec?.marks[s.id]||'P';const a=attPct(s);return`<tr><td>${E(s.name)} <span class="mono muted">${E(s.id)}</span></td><td><input type="radio" name="a_${E(s.id)}" value="P" ${v==='P'?'checked':''} aria-label="${E(s.name)} present"></td><td><input type="radio" name="a_${E(s.id)}" value="A" ${v==='A'?'checked':''} aria-label="${E(s.name)} absent"></td><td>${a===null?'—':pill(a+'%',a<75?'bad':'good')}</td></tr>`}).join('')}</tbody></table></div>
   <div class="actions" style="margin-top:12px"><button class="btn primary">Save attendance</button></div></form></div>`;
}
CHG.attDate=el=>{ui.f.att.date=el.value;renderPage()};
ACT.allPresent=()=>$$('input[type=radio][value=P]').forEach(r=>r.checked=true);
FORM.markAtt=(f,d)=>{
  if(!can('attendance.mark'))throw new Error('You do not have access to mark attendance');const dv=divOf(f.dataset.d);if(!myDivisions().find(x=>x.id===dv.id))throw new Error('This is not one of your divisions');
  const date=d.date||today();if(date>today())throw new Error('Cannot mark a future date');if(parseD(date).getDay()===0)throw new Error('Sunday is a holiday');
  const marks={};db.students.filter(s=>s.div===dv.id&&s.status==='Active').forEach(s=>marks[s.id]=d['a_'+s.id]==='A'?'A':'P');
  db.attendance[date]=db.attendance[date]||{};db.attendance[date][dv.id]={sem:semOfDiv(dv),marks};const ab=Object.values(marks).filter(v=>v==='A').length;
  log('Attendance marked',`${divName(dv)} on ${fmtD(date)}: ${ab} absent`);
  if(date===today())Object.keys(marks).forEach(id=>{if(marks[id]!=='A')return;const s=stu(id);notify('attendance',`${s.name} was absent today`,`Marked absent on ${fmtD(date)} in ${divName(dv)}. If this is a mistake, contact the class teacher.`,{sid:id,key:`abs:${id}:${date}`,tone:'warn',go:{portal:{Parent:'phome',Student:'shome'}},roles:['Parent','Student'].filter(r=>ntOn('attendance',r))})});save();toast(`Saved. ${ab} absent, ${Object.keys(marks).length-ab} present`);renderPage();
};
function attRegister(f){
  if(!f.div)return'';const d=divOf(f.div);const studs=db.students.filter(s=>s.div===d.id&&s.status==='Active');const dates=Object.keys(db.attendance).filter(x=>db.attendance[x][d.id]).sort().slice(-14);
  return`<div class="panel"><div class="tablewrap"><table><thead><tr><th>Student</th>${dates.map(x=>`<th title="${fmtD(x)}" style="text-align:center">${parseD(x).getDate()}</th>`).join('')}<th class="num">Present</th><th class="num">%</th></tr></thead><tbody>${studs.map(s=>{let p=0,t=0;Object.values(db.attendance).forEach(day=>{const r=day[d.id];if(r&&r.sem===s.sem&&r.marks[s.id]){t++;if(r.marks[s.id]==='P')p++}});const pc=t?Math.round(p/t*100):null;
   return`<tr><td>${E(s.name)}</td>${dates.map(x=>{const v=db.attendance[x][d.id].marks[s.id];return`<td style="text-align:center"><span class="dot" style="background:${v==='P'?'var(--good)':v==='A'?'var(--bad)':'var(--line)'}" title="${v||'-'}"></span></td>`}).join('')}<td class="num">${p} / ${t}</td><td class="num">${pc===null?'—':pill(pc+'%',pc<75?'bad':'good')}</td></tr>`}).join('')}</tbody></table></div><p class="note">Dates shown are days of the month for the last 14 marked days. Green is present and red is absent.</p></div>`;
}
function attLow(divs){
  const l=db.students.filter(s=>s.status==='Active'&&divs.some(d=>d.id===s.div)).map(s=>({s,a:attPct(s)})).filter(x=>x.a!==null&&x.a<75).sort((x,y)=>x.a-y.a);
  return`<div class="panel"><div class="tablewrap"><table><thead><tr><th>Student</th><th>Division</th><th>Attendance</th><th>Guardian</th><th></th></tr></thead><tbody>${l.map(x=>`<tr><td>${E(x.s.name)}</td><td>${E(divName(divOf(x.s.div)))}</td><td>${pill(x.a+'%','bad')}</td><td>${E(x.s.guardian.name)} · ${E(x.s.guardian.phone)}</td><td>${can('messages.send')?`<button class="btn sm" data-act="notifyAtt" data-id="${E(x.s.id)}">Notify guardian</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No student is below 75%.</td></tr>'}</tbody></table></div></div>`;
}
ACT.notifyAtt=el=>{const s=stu(el.dataset.id);sendMsg('custom',s,'WhatsApp',`Dear ${s.guardian.name}, ${s.name}'s attendance is ${attPct(s)}%, below the required 75%. Please ensure regular attendance. - ${db.settings.short}`);log('Attendance alert',s.name);notify('attendance','Attendance below 75%',`${s.name}'s attendance is ${attPct(s)}%. Please ensure regular attendance.`,{sid:s.id,tone:'warn',go:{portal:{Parent:'phome',Student:'shome'}},roles:['Parent','Student'].filter(r=>ntOn('attendance',r))});save();toast('Guardian notified (demo)')};

/* ----- internal marks ----- */
const EXAMS=['Internal 1','Internal 2','Assignment','Practical'];
function viewMarks(){
  const divs=myDivisions();const f=ui.f.marks=ui.f.marks||{exam:'Internal 1'};if(!divs.find(d=>d.id===f.div)){const me=cur().staffId;f.div=(divs.find(d=>db.subjects.some(s=>s.faculty===me&&s.course===d.course&&s.sem===semOfDiv(d)))||divs[0])?.id;f.sub=null}
  if(!f.div)return head('Internal Marks')+'<div class="panel empty">You have no divisions assigned.</div>';
  const d=divOf(f.div);const sem=semOfDiv(d);const subs=db.subjects.filter(s=>s.course===d.course&&s.sem===sem);if(!subs.find(s=>s.id===f.sub))f.sub=(subs.find(s=>s.faculty===cur().staffId)||subs[0])?.id;
  const sb=subs.find(s=>s.id===f.sub);const rec=db.marks.find(m=>m.divId===d.id&&m.subjectId===f.sub&&m.exam===f.exam);const studs=db.students.filter(s=>s.div===d.id&&s.status==='Active');
  const mine=cur().role==='Super Admin'||(sb&&sb.faculty===cur().staffId);const editable=can('marks.enter')&&mine;
  return head('Internal Marks','Enter marks for your subjects. Principal and admin can view all.',`<button class="btn" data-act="exportMarks">Copy marks sheet as CSV</button>`)+
  `<div class="panel"><div class="filters"><select aria-label="Division" data-change="marksF" data-k="div">${divs.map(x=>`<option value="${x.id}" ${f.div===x.id?'selected':''}>${E(divName(x))}</option>`).join('')}</select>
   <select aria-label="Subject" data-change="marksF" data-k="sub">${subs.map(x=>`<option value="${x.id}" ${f.sub===x.id?'selected':''}>${E(x.name)}</option>`).join('')}</select>
   <select aria-label="Exam" data-change="marksF" data-k="exam">${EXAMS.map(x=>`<option ${f.exam===x?'selected':''}>${x}</option>`).join('')}</select>${sb?pill('Faculty: '+(staffOf(sb.faculty)?.name||'-'),mine?'acc':''):''}</div>
   ${sb?`<form data-form="saveMarks"><div class="field" style="max-width:160px;margin-bottom:10px"><label class="label" for="mx">Maximum marks</label><input type="number" id="mx" name="max" min="1" value="${rec?.max||20}" ${editable?'':'disabled'}></div>
   <div class="tablewrap"><table><thead><tr><th>Student</th><th>Marks</th><th>%</th></tr></thead><tbody>${studs.map(s=>{const v=rec?.scores[s.id]??'';return`<tr><td>${E(s.name)} <span class="mono muted">${E(s.id)}</span></td><td><input type="number" name="s_${E(s.id)}" value="${E(v)}" min="0" step="0.5" style="width:90px" ${editable?'':'disabled'} aria-label="Marks for ${E(s.name)}"></td><td>${v===''?'—':Math.round(v/(rec?.max||20)*100)+'%'}</td></tr>`}).join('')}</tbody></table></div>
   ${editable?'<div class="actions" style="margin-top:12px"><button class="btn primary">Save marks</button></div>':`<p class="note">${can('marks.enter')?'You can enter marks only for your own subjects.':'View only.'}</p>`}</form>`:'<p class="empty">No subjects for this semester.</p>'}</div>`;
}
CHG.marksF=el=>{ui.f.marks[el.dataset.k]=el.value;renderPage()};
FORM.saveMarks=(f,d)=>{
  const m=ui.f.marks;const dv=divOf(m.div);const sb=db.subjects.find(x=>x.id===m.sub);if(!can('marks.enter')||!(cur().role==='Super Admin'||sb.faculty===cur().staffId))throw new Error('You can enter marks only for your own subjects');
  const max=+d.max;if(!(max>0))throw new Error('Enter the maximum marks');const scores={};let bad=null;db.students.filter(s=>s.div===dv.id&&s.status==='Active').forEach(s=>{const v=d['s_'+s.id];if(v!==''&&v!==undefined){if(+v>max)bad=s.name;scores[s.id]=String(v)}});
  if(bad)throw new Error(`Marks for ${bad} are above the maximum of ${max}`);
  let rec=db.marks.find(x=>x.divId===dv.id&&x.subjectId===sb.id&&x.exam===m.exam);if(!rec){rec={id:uid('m'),divId:dv.id,subjectId:sb.id,sem:semOfDiv(dv),exam:m.exam,max,scores,by:sb.faculty};db.marks.push(rec)}else{rec.max=max;rec.scores=scores}
  log('Marks saved',`${sb.name}, ${m.exam}, ${divName(dv)}`);Object.keys(scores).forEach(id=>notify('marks',`Marks published · ${sb.name}`,`${m.exam}: ${scores[id]} out of ${max}.`,{sid:id,key:`mk:${rec.id}:${id}:${scores[id]}`,tone:'info',go:{portal:{Parent:'phome',Student:'sacademic'}},roles:['Parent','Student'].filter(r=>ntOn('marks',r))}));save();toast('Marks saved');renderPage();
};
ACT.exportMarks=()=>{const m=ui.f.marks;const d=divOf(m.div);const sem=semOfDiv(d);const subs=db.subjects.filter(s=>s.course===d.course&&s.sem===sem);const studs=db.students.filter(s=>s.div===d.id&&s.status==='Active');
  showCsv(`Marks sheet · ${m.exam}`,['Enrolment','Student',...subs.map(s=>s.name)],studs.map(s=>[s.id,s.name,...subs.map(sb=>{const r=db.marks.find(x=>x.divId===d.id&&x.subjectId===sb.id&&x.exam===m.exam);return r&&r.scores[s.id]!==undefined?r.scores[s.id]+'/'+r.max:''})]))};

/* ----- practice teaching ----- */
function viewPractice(){
  const t=ui.tab.practice||'allot';const students=db.students.filter(s=>s.course==='bed'&&s.status==='Active');
  const body=t==='schools'?`<div class="grid two"><div class="panel"><h2>Partner schools</h2><div class="list">${db.schools.map(s=>`<div class="li"><div><b>${E(s.name)}</b><small>${E(s.city)} · mentor ${E(s.mentor)} · ${db.practice.filter(p=>p.schoolId===s.id).length} students</small></div><button class="btn sm danger" data-act="delSchool" data-id="${s.id}">Remove</button></div>`).join('')}</div></div>
   <div class="panel"><h2>Add a school</h2><form data-form="addSchool" class="form">${F('name','School name',{req:1,span:1})}${F('city','City',{req:1})}${F('mentor','Mentor teacher',{req:1})}<button class="btn primary span">Add school</button></form></div></div>`
  :`<div class="grid two onecol"><div class="panel"><h2>Allotments ${pill(String(db.practice.length))}</h2><div class="tablewrap"><table><thead><tr><th>Student</th><th>School</th><th>Phase</th><th>Dates</th><th>Score</th><th></th></tr></thead><tbody>${db.practice.map(p=>{const s=stu(p.studentId),sc=db.schools.find(x=>x.id===p.schoolId);return`<tr><td>${E(s?.name)}</td><td>${E(sc?.name)}<br><small class="muted">Mentor: ${E(sc?.mentor)}</small></td><td>${E(p.phase)}</td><td>${fmtD(p.start)} to ${fmtD(p.end)}</td><td>${p.score?pill(p.score+' / 20','good'):pill('Pending','warn')}</td><td><button class="btn sm" data-act="evalPractice" data-id="${p.id}">Evaluate</button> <button class="btn sm danger" data-act="delAllot" data-id="${p.id}">×</button></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">No allotments yet.</td></tr>'}</tbody></table></div></div>
   <div class="panel"><h2>Allot a school</h2><form data-form="addAllot" class="form">${F('sid','Student',{opts:students.map(s=>[s.id,s.name+' · '+s.id]),span:1})}${F('school','School',{opts:db.schools.map(s=>[s.id,s.name]),span:1})}${F('phase','Phase',{opts:['Phase 1','Phase 2','Phase 3']})}<span></span>${F('start','Start',{type:'date',val:today(),req:1})}${F('end','End',{type:'date',val:addDays(today(),28),req:1})}<button class="btn primary span">Allot</button></form></div></div>`;
  return head('Practice Teaching','Place each B.Ed student in a school with a mentor, then record the evaluation.')+tabsBar('practice',[['allot','Allotments'],['schools','Schools']],t)+body;
}
FORM.addSchool=(f,d)=>{if(!can('practice.manage'))throw new Error('You do not have access');db.schools.push({id:uid('sc'),name:d.name,city:d.city,mentor:d.mentor});log('School added',d.name);save();renderPage()};
ACT.delSchool=el=>{if(db.practice.some(p=>p.schoolId===el.dataset.id))throw new Error('Students are placed in this school');db.schools=db.schools.filter(s=>s.id!==el.dataset.id);save();renderPage()};
FORM.addAllot=(f,d)=>{if(!can('practice.manage'))throw new Error('You do not have access');if(d.end<d.start)throw new Error('End date is before the start date');if(db.practice.some(p=>p.studentId===d.sid&&p.phase===d.phase))throw new Error('This student already has a school for '+d.phase);
  db.practice.push({id:uid('pt'),studentId:d.sid,schoolId:d.school,phase:d.phase,start:d.start,end:d.end,score:'',notes:''});log('Practice school allotted',stu(d.sid).name);{const sc=db.schools.find(x=>x.id===d.school);notify('practice','Practice teaching school allotted',`${stu(d.sid).name}: ${sc?sc.name:'school'}, ${d.phase}.`,{sid:d.sid,tone:'info',go:{staff:['practice'],portal:{Parent:'phome',Student:'sacademic'}}})}save();toast('Allotted');renderPage()};
ACT.delAllot=el=>{db.practice=db.practice.filter(p=>p.id!==el.dataset.id);save();renderPage()};
ACT.evalPractice=el=>{const p=db.practice.find(x=>x.id===el.dataset.id);dialog(`<h3>Evaluate ${E(stu(p.studentId).name)}</h3><form data-form="evalPractice" data-id="${p.id}" class="grid" style="gap:12px">${F('score','Score out of 20',{type:'number',val:p.score,req:1,attrs:'min="0" max="20" step="0.5"'})}${F('notes','Mentor notes',{type:'textarea',val:p.notes})}<div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeDialog">Cancel</button><button class="btn primary">Save</button></div></form>`)};
FORM.evalPractice=(f,d)=>{if(!can('practice.manage'))throw new Error('You do not have access');const p=db.practice.find(x=>x.id===f.dataset.id);p.score=d.score;p.notes=d.notes;log('Practice evaluated',stu(p.studentId).name+': '+d.score+'/20');notify('practice','Practice teaching evaluated',`${stu(p.studentId).name} scored ${d.score}/20.`,{sid:p.studentId,tone:'good',go:{staff:['practice'],portal:{Parent:'phome',Student:'sacademic'}}});save();closeDialog();toast('Evaluation saved');renderPage()};
