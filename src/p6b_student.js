/* =====================================================================
   Student portal (spec §9): Home · Fees · Notices · Profile, installable PWA
   ===================================================================== */
const me=()=>{const u=cur();if(!isStudentUser(u))throw new Error('403 · Student portal only');return stu(u.studentId)};
const firstName=n=>String(n).split(' ')[0];
function viewStudentHome(){
  const s=me(),u=cur();const sm=feeSum(s);const nn=studentNotices(s).slice(0,3);const r=new Set(u.readNotices||[]);const alerts=ntMine(u).filter(n=>!n.read).slice(0,3);
  const next=sm.sems.find(x=>x.started&&x.due>0);
  return`<div class="hello"><div class="who">${avatar(s)}<div><h1>Hi ${E(firstName(s.name))}</h1><p class="muted" style="margin:0">${E(s.enrol)} · ${E(classLabel(s))}</p></div></div></div>
  <div class="duecard ${sm.payable?(sm.overdue?'bad':'warn'):'good'}"><span class="label">Fee due now</span><div class="v">${inr(sm.payable)}</div>
   <small>${sm.payable?(next?`Semester ${next.sem}${next.dueDate?' · due '+fmtD(next.dueDate):''}${next.overdue?' · overdue':''}`:''):'You have no pending fee. Thank you!'}</small>
   ${next?`<button class="btn primary big" data-act="payNow" data-sem="${next.sem}">Pay ${inr(next.due)} with UPI</button>`:''}</div>
  ${alerts.length?`<div class="panel"><h2>Alerts</h2><div class="list">${alerts.map(n=>`<button class="li pick" data-act="ntOpen" data-id="${E(n.id)}"><div><b>${E(n.t)}</b><small>${E(n.x)} · ${E(ago(n.ts))}</small></div></button>`).join('')}</div></div>`:''}
  <div class="panel"><h2>Latest notices <button class="btn sm" data-act="nav" data-id="snotices">All notices</button></h2><div class="list">${nn.map(n=>`<button class="li pick ${r.has(n.id)?'':'unread'}" data-act="readNotice" data-id="${E(n.id)}"><div><b>${E(n.title)}</b><small>${E(fmtT(n.publishAt))}</small></div>${n.isFeeAlert?pill('Fee','warn'):''}</button>`).join('')||'<p class="note">No notices yet.</p>'}</div></div>`;
}
function viewStudentFees(){
  const s=me();const sm=feeSum(s);const pays=db.payments.filter(p=>p.studentId===s.id).sort((a,b)=>b.entryAt-a.entryAt);
  return head('My fees',`Tuition fee: total ${inr(sm.total)} · paid ${inr(sm.paid)} · due now ${inr(sm.payable)}`)+semCards(s,{pay:true})+
  `<div class="panel" style="margin-top:16px"><h2>Receipts</h2><div class="list">${pays.map(p=>`<div class="li"><div><b>${E(p.rc)} · ${inr(p.amount)}</b><small>Tuition fee · Semester ${p.sem} · Batch ${E(batchOf(p))} · invoice ${fmtD(p.invoiceDate)}</small></div><div class="actions nowrap">${p.status==='SUCCESS'?'':payPill(p.status)}<button class="btn sm" data-act="viewReceipt" data-id="${E(p.id)}">View</button><button class="btn sm" data-act="dlPdf" data-id="${E(p.id)}">PDF</button></div></div>`).join('')||'<p class="note">No payments yet.</p>'}</div></div>
  <p class="note">Paying with UPI: your receipt is ready as soon as the bank confirms. Its invoice date is the next day (college rule).</p>`;
}
ACT.payNow=el=>{const s=me();const m=semSummary(s,+el.dataset.sem);if(!(m.due>0))throw new Error('Nothing due for this semester');
  dialog(`<h3>Pay semester ${m.sem} tuition fee</h3><p class="muted" style="margin:0 0 10px">Due ${inr(m.due)}. You can pay the full amount or a part.</p>
   <form data-form="upiPay" data-sem="${m.sem}" class="grid" style="gap:10px">${F('amount','Amount (₹)',{val:m.due/100,req:true,attrs:`inputmode="decimal" max="${m.due/100}"`})}
   <p class="note" style="margin:0">Invoice date will be ${fmtD(upiInvoiceDate(Date.now()))}.</p><div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-act="closeDialog">Cancel</button><button class="btn primary">Continue to UPI</button></div></form>`,'Pay fee')};
function viewStudentNotices(){
  const s=me(),u=cur();const l=studentNotices(s);const r=new Set(u.readNotices||[]);const un=l.filter(n=>!r.has(n.id)).length;
  return head('Notice Board',un?`${un} unread`:'All read',un?'<button class="btn" data-act="readAllNotices">Mark all read</button>':'')+
  `<div class="nlist">${l.map(n=>`<article class="ncard ${r.has(n.id)?'':'unread'}"><div class="nc-h"><h3>${r.has(n.id)?'':'<span class="ndot" aria-label="Unread"></span>'}${E(n.title)}</h3>${n.isFeeAlert?pill('Fee alert','warn'):''}</div><p>${E(n.body)}</p>${n.attachment?`<button class="lnk" data-act="openAtt" data-id="${E(n.id)}">📎 ${E(n.attachment.name)}</button>`:''}<small class="muted">${E(fmtT(n.publishAt))} · ${E(n.createdBy)}</small>
   ${r.has(n.id)?'':`<div><button class="btn sm" data-act="readNotice" data-id="${E(n.id)}">Mark as read</button></div>`}</article>`).join('')||'<p class="empty">No notices yet.</p>'}</div>`;
}
ACT.readNotice=el=>{const u=cur();const s=me();const n=db.notices.find(x=>x.id===el.dataset.id);if(!n||!studentNotices(s).includes(n))throw new Error('403 · Not allowed');u.readNotices=[...new Set([...(u.readNotices||[]),n.id])];
  db.notifs.forEach(x=>{if(x.uid===u.id&&x.key==='notice:'+n.id+'|'+u.id)x.read=true});save();updateBell();if(ui.route!=='snotices')go('snotices');else renderPage()};
ACT.readAllNotices=()=>{const u=cur();const s=me();u.readNotices=studentNotices(s).map(n=>n.id);db.notifs.forEach(x=>{if(x.uid===u.id&&x.k==='notice')x.read=true});save();updateBell();renderPage()};
function viewStudentProfile(){
  const s=me();const L=(k,v)=>`<div><span class="label">${E(k)}</span><b>${E(v||'—')}</b></div>`;const perm='Notification' in window?Notification.permission:'unsupported';
  return head('My profile',s.enrol)+`<div class="grid two-col"><div class="panel"><div class="who" style="margin-bottom:12px">${avatar(s)}<div><b>${E(s.name)}</b><small class="muted" style="display:block">${E(classLabel(s))}</small></div></div>
   <div class="facts">${L('Enrolment no.',s.enrol)}${L('Course',course(s.course).name)}${L('Semester',s.sem)}${L('Batch',defaultBatch(s))}${L('Category',s.category)}${L('Email',s.email)}${L('Date of birth',fmtD(s.dob))}${L('Address',s.address)}</div>
   <form data-form="myPhone" class="form" style="margin-top:8px">${F('phone','Mobile',{type:'tel',val:s.phone,attrs:'maxlength="10" inputmode="numeric"'})}<div class="field" style="justify-content:flex-end"><button class="btn">Update mobile</button></div></form>
   <p class="note">To change other details, contact the college office.</p></div>
   <div class="grid" style="align-content:start">${accountPanel()}
    <div class="panel"><h2>Notifications</h2><div id="notifyPanel">${notifyPanelHtml()}</div></div>
    <div class="panel"><h2>App</h2><div id="profileInstall">${installPanelHtml()}</div></div>
    <button class="btn danger" data-act="logout">Sign out</button></div></div>`;
}
FORM.myPhone=(f,d)=>{const s=me();const ph=String(d.phone||'').replace(/\D/g,'');if(!/^[6-9]\d{9}$/.test(ph))throw new Error('Enter a 10-digit mobile number');const old=s.phone;s.phone=ph;const u=cur();u.phone=ph;log('Student changed mobile','Student',s.enrol,{phone:old},{phone:ph});
  notify('system',`${s.name} changed mobile`,`${old} → ${ph}`,{sid:s.id,roles:['Principal','Clerk'],staff:'students'});save();renderPage();toast('Mobile updated')};

/* ---------- notification permission (install logic lives in p7_pwa.js) ---------- */
function askNotifyGently(){if(!('Notification' in window)||Notification.permission!=='default'||lsGet('npcte_ask_notify')==='1')return;lsSet('npcte_ask_notify','1');
  dialog(`<h3>Get fee alerts and notices?</h3><p class="muted" style="margin:0 0 12px">NPCTE can show a popup on this device when a payment is received, a fee is due, or the college posts a notice. You can turn this off any time.</p><div class="actions" style="justify-content:flex-end"><button class="btn" data-act="closeDialog">Not now</button><button class="btn primary" data-act="askNotify">Allow notifications</button></div>`,'Notifications')}
ACT.askNotify=async()=>{closeDialog();if(!('Notification' in window))throw new Error('This browser does not support notifications');const r=await Notification.requestPermission();
  if(r==='granted'){toast('Notifications on');showPopup('Notifications are on','You will get NPCTE fee alerts and notices here.','on')}else toast('Notifications not allowed',true);const np=$('#notifyPanel');if(np)np.innerHTML=notifyPanelHtml();renderNotifyBar();if(ui.route==='sprofile')renderPage()};
if('serviceWorker' in navigator&&location.protocol!=='file:')addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
ACT.testPop=async el=>{const d=+el.dataset.d||0;const u=cur();
  if(!('Notification' in window))throw new Error('This browser does not support notifications');
  if(Notification.permission!=='granted'){const r=await Notification.requestPermission();if(r!=='granted')throw new Error('Notifications are blocked. Allow them in the phone settings for this app / browser.')}
  const reg=navigator.serviceWorker&&await Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),4000))]);
  if(!reg||!reg.active)throw new Error('The app\'s service worker is not running yet. Reload the app once and try again.');
  reg.active.postMessage({type:'notify',delay:d*1000,title:'NPCTE · test notification',body:`Hello ${u?u.name:''}, notifications work on this device.`,tag:'test-'+Date.now()});
  ev('Click','Test notification',d?d+' s':'now');toast(d?`Notification in ${d} seconds. Close the app or lock the phone now.`:'Notification sent. Pull down the notification shade.')};
ACT.nbarHide=()=>{try{sessionStorage.setItem('npcte_nbar','1')}catch(e){}renderNotifyBar()};
ACT.notifCheck=async()=>{const r=[];const perm=!('Notification' in window)?'not supported':Notification.permission;r.push(['Permission',perm]);
  let sw='not supported';if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();sw=reg&&reg.active?'running':reg?'installing':'not registered'}r.push(['Service worker',sw]);
  r.push(['Opened as installed app',matchMedia('(display-mode: standalone)').matches?'yes':'no (browser tab)']);r.push(['Browser',device()]);r.push(['Secure (https)',isSecureContext?'yes':'no']);
  const ok=perm==='granted'&&sw==='running';
  dialog(`<h3>Notification check</h3><div class="panel" style="padding:12px">${r.map(([k,v])=>`<div class="rline"><span>${E(k)}</span><b>${E(v)}</b></div>`).join('')}</div><p class="note">${ok?'Everything is ready. If nothing shows in the notification shade, turn on notifications for this app in the phone settings (steps below the Test buttons).':perm==='denied'?'Notifications are blocked for this site. Allow them in the phone settings.':perm!=='granted'?'Tap “Turn on notifications” and choose Allow.':'Reload the app once so the service worker starts.'}</p><div class="actions" style="justify-content:flex-end"><button class="btn primary" data-act="closeDialog">OK</button></div>`,'Notification check')};
