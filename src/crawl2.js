/* Full responsive crawler: node crawl2.js <width> [height] [light|dark] [roleRegex]
   Visits every menu, tab, report and key drawer/dialog for every role, audits layout, saves screenshots. */
const {chromium}=require('/opt/npm-tools/node_modules/playwright');
const fs=require('fs');
const W=+process.argv[2]||390,H=+process.argv[3]||(W<=430?844:W<=1024?1024:800),THEME=process.argv[4]||'light',ONLY=process.argv[5]||'';
const FILE='file://'+process.cwd()+'/'+(process.env.APP||'demo.html');
const DIR=`crawl/${W}${THEME[0]}`;fs.mkdirSync(DIR,{recursive:true});
const ROLES=[['admin','admin123'],['principal','principal123'],['accountant','account123'],['clerk','clerk123'],['faculty','faculty123'],['parent','parent123'],['student','student123']];
const EXTRA=[['st4','clerk','clerk123','Clerk'],['st5','faculty','faculty123','Faculty']];

/* ---------- in-page audit ---------- */
const AUDIT=()=>{
  const iw=innerWidth,out=[];
  const cs=e=>getComputedStyle(e);
  const shown=e=>{const r=e.getBoundingClientRect();if(!(r.width>0&&r.height>0))return false;const c=cs(e);return c.visibility!=='hidden'&&c.display!=='none'&&+c.opacity>0.05};
  const cls=e=>typeof e.className==='string'?e.className.trim().split(/\s+/).filter(Boolean).slice(0,2).join('.'):'';
  const sig=e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(cls(e)?'.'+cls(e):'')+(e.dataset&&e.dataset.act?'[act='+e.dataset.act+']':'')+(e.tagName==='INPUT'?'[type='+e.type+(e.name?' name='+e.name:'')+']':'')+' "'+(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,28)+'"';
  const fixedAnc=e=>{for(let a=e;a&&a!==document.documentElement;a=a.parentElement){if(cs(a).position==='fixed')return a}return null};
  const scroller=e=>{for(let a=e.parentElement;a&&a!==document.body;a=a.parentElement){const o=cs(a).overflowX;if((o==='auto'||o==='scroll')&&a.scrollWidth>a.clientWidth+1)return a}return null};
  const dlgOpen=!!document.querySelector('#dlg *'),layerOpen=!!document.querySelector('#layer .drawer');
  const awayClip=e=>{const er=e.getBoundingClientRect();for(let a=e.parentElement;a&&a!==document.body&&a!==document.documentElement;a=a.parentElement){const o=cs(a);if(o.overflowX==='visible'&&o.overflowY==='visible')continue;const r=a.getBoundingClientRect();if(er.bottom<=r.top+1||er.top>=r.bottom-1||er.right<=r.left+1||er.left>=r.right-1)return true}return false};
  const root=[...document.querySelectorAll(dlgOpen?'#dlg':layerOpen?'#layer':'#root')];
  const all=root.flatMap(r=>[...r.querySelectorAll('*')]).filter(e=>!/^(SCRIPT|STYLE|PATH|CIRCLE|RECT|LINE|POLYLINE|G|SVG|DEFS)$/i.test(e.tagName)&&shown(e)&&!awayClip(e)&&!(e.matches('.skip')&&document.activeElement!==e));
  // page scroll
  const sw=document.documentElement.scrollWidth;if(sw>iw+1)out.push(['pageScroll','scrollWidth '+sw+' > viewport '+iw,'html']);
  // elements off the right/left edge
  const seen=new Set();
  for(const e of all){const r=e.getBoundingClientRect();if(r.right>iw+1.5||r.left<-1.5){if(scroller(e))continue;if(e.closest('.toast'))continue;const s=sig(e);if(seen.has(s))continue;seen.add(s);if(seen.size>10)break;out.push(['offscreen',`left ${Math.round(r.left)} right ${Math.round(r.right)} (viewport ${iw})`,s])}}
  // leaf text boxes
  const leaves=all.filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>0)&&!/^(OPTION|TEXTAREA|SELECT)$/.test(e.tagName)).slice(0,700);
  const textRects=e=>{const out=[];for(const n of e.childNodes){if(n.nodeType!==3||!n.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(n);for(const q of r.getClientRects())if(q.width>1&&q.height>1)out.push(q)}return out};
  const L=leaves.map(e=>({e,rs:textRects(e),f:!!fixedAnc(e)})).filter(x=>x.rs.length);
  let ov=0;const seenO=new Set();
  outer:for(let i=0;i<L.length;i++){const a=L[i];for(let j=i+1;j<L.length;j++){const b=L[j];
    if(a.f!==b.f)continue;if(a.e.contains(b.e)||b.e.contains(a.e))continue;
    for(const ra of a.rs)for(const rb of b.rs){
      const x=Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left),y=Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top);if(x<=1.5||y<=2)continue;
      const inter=x*y,m=Math.min(ra.width*ra.height,rb.width*rb.height);if(inter/m<0.15)continue;
      const k=sig(a.e)+'|'+sig(b.e);if(seenO.has(k))continue;seenO.add(k);ov++;out.push(['overlap',`${Math.round(inter/m*100)}% of the text overlaps`,sig(a.e)+'  <>  '+sig(b.e)]);if(ov>=10)break outer}}}
  // clipped text
  const seenC=new Set();
  for(const e of all){const c=cs(e);if(e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+2)continue;
    const ox=c.overflowX,oy=c.overflowY;const hx=/hidden|clip/.test(ox)&&e.scrollWidth>e.clientWidth+1,hy=/hidden|clip/.test(oy)&&e.scrollHeight>e.clientHeight+2;if(!hx&&!hy)continue;
    if(!(e.textContent||'').trim()||/^(HTML|BODY)$/.test(e.tagName)||e.closest('.scrim')||e.matches('.login-art,.sr,.skip'))continue;
    const s=sig(e);if(seenC.has(s))continue;seenC.add(s);
    if(c.textOverflow==='ellipsis'&&e.scrollWidth>e.clientWidth+1)out.push(['ellipsis',`${e.scrollWidth}px of text in ${e.clientWidth}px`,s]);
    else out.push(['clipped',`content ${e.scrollWidth}x${e.scrollHeight} in box ${e.clientWidth}x${e.clientHeight}`,s]);if(seenC.size>14)break}
  // tap targets and obstruction
  if(iw<=820){const seenT=new Set();const navTop=innerHeight;const drawerOpen=!!document.querySelector('.app.rail-open');
    for(const e of all.filter(e=>e.matches('button,a[href],select,input:not([type=hidden]),textarea,[role=tab],[data-act]'))){
      const r=e.getBoundingClientRect();const chk=e.matches('input[type=checkbox],input[type=radio]');if(e.matches('[disabled]'))continue;
      const small=chk?(r.width<18||r.height<18):(r.height<30||r.width<30);
      if(small){const s=sig(e);if(!seenT.has(s)){seenT.add(s);if(seenT.size<=8)out.push(['smallTap',`${Math.round(r.width)}x${Math.round(r.height)}px`,s])}}
      if(!drawerOpen&&r.top>=0&&r.bottom<=navTop&&r.left>=0&&r.right<=iw&&!fixedAnc(e)){const x=r.left+r.width/2,y=r.top+r.height/2;const t=document.elementFromPoint(x,y);
        if(t&&!(e.contains(t)||t.contains(e))&&!e.closest('label')&&!(t.closest&&t.closest('label')&&t.closest('label').contains(e))){const s=sig(e);if(!seenT.has('c'+s)){seenT.add('c'+s);out.push(['covered',`centre is covered by ${sig(t)}`,s])}}}}}
  // tables on phones
  if(iw<=900){for(const t of document.querySelectorAll('table')){if(!shown(t))continue;const th=t.querySelector('thead');if(th&&cs(th).display!=='none'&&!t.closest('.tablewrap.keep'))out.push(['tableOnPhone','table header still visible',sig(t)])}}
  if(iw>720){for(const w of document.querySelectorAll('.tablewrap')){if(shown(w)&&!awayClip(w)&&w.scrollWidth>w.clientWidth+2)out.push(['tableScrolls',`table is ${w.scrollWidth}px wide in ${w.clientWidth}px, so columns are hidden`,sig(w.querySelector('table')||w)+' in '+(w.closest('.panel')?.querySelector('h2')?.textContent||'').slice(0,30)])}}
  // tiny text
  const tiny=new Set();for(const e of leaves){const f=parseFloat(cs(e).fontSize);if(f<10.5&&!(f===0&&e.closest('[data-rail=mini]'))&&!e.closest('.skip')){const s=sig(e);if(!tiny.has(s)&&tiny.size<5){tiny.add(s);out.push(['tinyText',f+'px',s])}}}
  return out;
};
/* content hidden under the fixed bottom nav when scrolled to the end */
const UNDERNAV=()=>{
  const nav=document.querySelector('.nav');if(!nav||getComputedStyle(nav).position!=='fixed')return null;
  const page=document.querySelector('#page');if(!page)return null;window.scrollTo(0,1e6);
  const nt=nav.getBoundingClientRect().top;let low=0;
  const insideScroller=e=>{for(let a=e.parentElement;a&&a!==page;a=a.parentElement){const o=getComputedStyle(a);if(/auto|scroll|hidden/.test(o.overflowY)&&a.scrollHeight>a.clientHeight+2)return true}return false};
  page.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect();if(r.height>0&&r.width>0&&getComputedStyle(e).position!=='fixed'&&getComputedStyle(e).display!=='none'&&!insideScroller(e))low=Math.max(low,r.bottom)});
  const gap=nt-low;window.scrollTo(0,0);return gap<4?`last content ends ${Math.round(low)}px, nav starts ${Math.round(nt)}px`:null;
};

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const issues=new Map();let states=0;const errs=[];
  const add=(role,label,[type,detail,s])=>{const k=type+'|'+s.replace(/"[^"]*"$/,'');if(!issues.has(k))issues.set(k,{type,sig:s,detail,where:[]});const o=issues.get(k);if(o.where.length<4)o.where.push(role+' › '+label)};
  for(const [u,pw] of ROLES){
    if(ONLY&&!new RegExp(ONLY).test(u))continue;
    const c=await b.newContext({viewport:{width:W,height:H},colorScheme:THEME,reducedMotion:'reduce',hasTouch:W<=820});
    const p=await c.newPage();p.setDefaultTimeout(5000);const pe=[];
    await p.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
    p.on('pageerror',e=>pe.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/ERR_FAILED|Failed to load resource/.test(m.text()))pe.push(m.text().slice(0,120))});
    await p.goto(FILE);await p.waitForFunction(()=>typeof db!=='undefined');await p.waitForTimeout(200);
    await p.evaluate(x=>{x.forEach(([sid,un,pw,role])=>{if(db.users.some(u=>u.username===un))return;const st=db.staff.find(s=>s.id===sid);const us={id:'u_'+un,username:un,password:pw,name:st.name,role,staffId:sid,active:true};db.users.push(us);st.userId=us.id});save()},EXTRA);
    const snap=async(label,full)=>{
      states++;
      const res=await p.evaluate(AUDIT).catch(e=>[['auditError',e.message,'audit']]);
      
      if(pe.length){res.push(['jsError',pe.slice(0,2).join(' | '),'page']);pe.length=0}
      res.forEach(r=>add(u,label,r));
      const f=`${DIR}/${u}__${label.replace(/[^A-Za-z0-9]+/g,'_').slice(0,60)}.jpg`;
      await p.screenshot({path:f,type:'jpeg',quality:62,fullPage:!!full}).catch(()=>{});
      return res.length};
    const closeAll=async()=>{await p.evaluate(()=>{const d=document.querySelector('#dlg [data-act=closeDialog]');if(d)d.click();const x=document.querySelector('#layer [data-act=close]');if(x)x.click()}).catch(()=>{});await p.waitForTimeout(160);await p.evaluate(()=>{document.querySelectorAll('#dlg,#layer').forEach(e=>{if(e.innerHTML)e.innerHTML=''})}).catch(()=>{})};
    // login screen (once)
    if(u==='admin')await snap('login',true);
    await p.fill('input[name=u]',u);await p.fill('input[name=p]',pw);await p.click('form[data-form=login] button.primary');await p.waitForTimeout(600);
    await snap('home-after-login');
    // bell
    await p.evaluate(()=>{const b=document.querySelector('[data-act=bell]');if(b)b.click()});await p.waitForTimeout(300);if(await p.$('#layer .drawer'))await snap('bell-open');await closeAll();
    // shell states: phone drawer or collapsed rail, then the Profile panel
    if(await p.evaluate(()=>getComputedStyle(document.querySelector('.menu-btn')).display!=='none')){await p.evaluate(()=>document.querySelector('.menu-btn').click());await p.waitForTimeout(350);await snap('menu-drawer-open');await p.evaluate(()=>document.querySelector('.rail-close').click());await p.waitForTimeout(300)}
    else{await p.evaluate(()=>document.querySelector('.rail-toggle').click());await p.waitForTimeout(350);await snap('sidebar-collapsed');await p.evaluate(()=>document.querySelector('.rail-toggle').click());await p.waitForTimeout(300)}
    await p.evaluate(()=>{const b=document.querySelector('[data-act=profile]');if(b)b.click()});await p.waitForTimeout(300);await snap('profile');await closeAll();
    const navs=await p.$$eval('#nav button',a=>a.map(x=>x.textContent.trim().replace(/\s+/g,' ')));
    for(let i=0;i<navs.length;i++){
      const nm=navs[i];
      await p.evaluate(i=>document.querySelectorAll('#nav button')[i].click(),i);await p.waitForTimeout(350);await closeAll();
      await snap(nm,true);
      // tabs
      const tabs=await p.$$eval('#page [role=tab]',a=>a.map(x=>x.textContent.trim().replace(/\s+/g,' ')));
      for(let j=0;j<tabs.length;j++){
        await p.evaluate(j=>{const t=[...document.querySelectorAll('#page [role=tab]')][j];if(t)t.click()},j);await p.waitForTimeout(280);
        await snap(`${nm} - tab ${tabs[j]}`,true);
      }
      // reports: every report
      if(/Reports/.test(nm)){const ids=await p.$$eval('[data-act=pickReport]',a=>a.map(x=>x.dataset.id));for(const id of ids){await p.evaluate(id=>document.querySelector(`[data-act=pickReport][data-id="${id}"]`)?.click(),id);await p.waitForTimeout(250);await snap(`Reports - ${id}`,true)}}
      // curated drawers and dialogs on this screen
      const openers=['#page tbody tr.click','#page .li.click','#page [data-act=openStudent]','[data-act=viewReceipt]','[data-act=pReceipt]','[data-act=addStaff]','[data-act=editStaff]','[data-act=importStudents]','[data-act=backupOut]','[data-act=backupIn]','[data-act=exportStudents]','[data-act=exportReport]','[data-act=mailPreview]','#evRows tr.click','[data-act=evExport]','[data-act=parentPay]','[data-act=evClear]','[data-act=resetDemo]','[data-act=exportDues]','[data-act=remindAll]','[data-act=notifyAtt]','[data-act=evalPractice]','[data-act=collectFor]'];
      for(const sel of openers){
        const ok=await p.evaluate(sel=>{const e=document.querySelector(sel);if(!e||!e.offsetParent&&getComputedStyle(e).position!=='fixed')return false;e.click();return true},sel).catch(()=>false);
        if(!ok)continue;await p.waitForTimeout(380);
        if(await p.$('#layer .drawer, #dlg *')){await snap(`${nm} - ${sel.replace(/[^A-Za-z]+/g,' ').trim().slice(0,30)}`,false);
          // second level inside student drawer: dialogs
          if(/Students|Fee/.test(nm)&&/tr click|openStudent|li click/.test(sel.replace(/[^A-Za-z ]+/g,' '))){
            for(const s2 of ['[data-act=markLeft]','[data-act=waiveLate]','[data-act=editStudent]','[data-act=certificate]','[data-act=viewReceipt]']){
              const o2=await p.evaluate(s=>{const e=document.querySelector('#layer '+s);if(!e)return false;e.click();return true},s2).catch(()=>false);if(!o2)continue;await p.waitForTimeout(350);
              await snap(`${nm} - student ${s2.replace(/[^A-Za-z]+/g,' ').trim()}`,false);
              await p.evaluate(()=>{const d=document.querySelector('#dlg [data-act=closeDialog]');if(d)d.click()});await p.waitForTimeout(150);
              if(!(await p.$('#layer .drawer'))){await p.evaluate(sel=>document.querySelector(sel)?.click(),sel);await p.waitForTimeout(300)}}}
        }
        await closeAll();
      }
    }
    // admission wizard (admin only)
    if(u==='admin'){
      await p.evaluate(()=>[...document.querySelectorAll('#nav button')].find(b=>/Students/.test(b.textContent))?.click());await p.waitForTimeout(350);
      await p.evaluate(()=>document.querySelector('[data-act=newAdmission]')?.click());await p.waitForTimeout(400);
      const fill=async v=>{for(const[k,x] of Object.entries(v)){await p.evaluate(([k,x])=>{const el=document.querySelector('#adm [name='+k+']');if(!el)return;el.value=x;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))},[k,x])}};
      await snap('Admission step 1');await fill({name:'Crawl Test',dob:'2002-05-10',aadhaar:'123412341234'});await p.evaluate(()=>document.querySelector('[data-act=admNext]')?.click());await p.waitForTimeout(250);
      await snap('Admission step 2');await fill({phone:'9898000111',address:'12 Test Road',gname:'Crawl Guardian',gphone:'9898000222'});await p.evaluate(()=>document.querySelector('[data-act=admNext]')?.click());await p.waitForTimeout(250);
      await snap('Admission step 3');await fill({pct:'66'});await p.evaluate(()=>document.querySelector('[data-act=admNext]')?.click());await p.waitForTimeout(250);
      await snap('Admission step 4');await p.evaluate(()=>document.querySelector('[data-act=admNext]')?.click());await p.waitForTimeout(250);await snap('Admission step 5');
      await p.evaluate(()=>document.querySelectorAll('#adm input[type=checkbox]').forEach(c=>c.checked=true));await p.evaluate(()=>document.querySelector('#adOk')?.click());await p.waitForTimeout(500);await snap('Admission done');await closeAll();
      // collect a payment to see the receipt and mail panel
      await p.evaluate(()=>[...document.querySelectorAll('#nav button')].find(b=>/Fee/.test(b.textContent))?.click());await p.waitForTimeout(350);
      await p.evaluate(()=>document.querySelector('[data-act=feeMode][data-m=counter]')?.click());await p.waitForTimeout(200);
      await p.evaluate(()=>{const a=document.querySelector('#f_amount');if(a){a.value='1000';a.dispatchEvent(new Event('input',{bubbles:true}))}document.querySelector('form[data-form=collect]')?.requestSubmit()});await p.waitForTimeout(900);
      await snap('Receipt issued',true);
      await p.evaluate(()=>{const t=[...document.querySelectorAll('#page [role=tab]')].find(x=>/outbox/i.test(x.textContent));if(t)t.click()});await p.waitForTimeout(300);await snap('Email outbox after payment',true);
    }
    // portals: pay flow
    if(u==='parent'||u==='student'){
      await p.evaluate(()=>[...document.querySelectorAll('#nav button')].find(b=>/Fees/.test(b.textContent))?.click());await p.waitForTimeout(350);
      await p.evaluate(()=>document.querySelector('[data-act=parentPay]')?.click());await p.waitForTimeout(350);await snap('Pay now dialog');
      await p.evaluate(()=>{const f=document.querySelector('form[data-form=parentPayGo]');if(f){f.querySelector('[name=amount]').value='500';f.requestSubmit()}});await p.waitForTimeout(450);await snap('UPI screen');
      await p.evaluate(()=>document.querySelector('[data-act=pOk]')?.click());await p.waitForTimeout(700);await snap('Payment receipt drawer');await closeAll();
      await p.evaluate(()=>[...document.querySelectorAll('#nav button')].find(b=>/Profile|Fees/.test(b.textContent))?.click());await p.waitForTimeout(300);
      await p.evaluate(()=>document.querySelector('[data-act=myContact]')?.click());await p.waitForTimeout(350);if(await p.$('#dlg *, #layer .drawer'))await snap('Update contact dialog');await closeAll();
    }
    // bell with items after activity
    await p.evaluate(()=>document.querySelector('[data-act=bell]')?.click());await p.waitForTimeout(300);await snap('bell-after-activity');await closeAll();
    // topbar + sign out
    await c.close();
  }
  const groups={};for(const v of issues.values())(groups[v.type]=groups[v.type]||[]).push(v);
  fs.writeFileSync(`${DIR}/issues.json`,JSON.stringify([...issues.values()],null,1));
  console.log(`== ${W}x${H} ${THEME}: ${states} states, ${issues.size} distinct findings`);
  for(const [t,l] of Object.entries(groups).sort()){console.log(`\n[${t}] ${l.length}`);for(const v of l.slice(0,+process.env.MAXSHOW||14))console.log(`  - ${v.sig}\n      ${v.detail}\n      e.g. ${v.where.slice(0,2).join(' ; ')}`)}
  await b.close();
})();
