const {chromium}=require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage();await p.route(/fonts\./,r=>r.abort());await p.goto('file://'+process.cwd()+'/demo.html');
await p.fill('input[name=u]','clerk');await p.fill('input[name=p]','clerk123');await p.click('form[data-form=login] button.primary');await p.waitForTimeout(150);
await p.click('#nav button:has-text("Students")');await p.click('#stuRows tr:first-child');await p.waitForTimeout(200);console.log((await p.$eval('.drawer',e=>e.innerText)).replace(/\n+/g,' | '));
console.log(await p.evaluate(()=>db.subjects.map(s=>s.name+':'+s.course+s.sem+':'+s.faculty).join('; ')));console.log(await p.evaluate(()=>db.staff.map(s=>s.id+'='+s.name+'/'+s.role).join('; ')));console.log(await p.evaluate(()=>db.divisions.map(d=>d.id+':'+d.course+d.batch+d.name+' t='+d.teacher+' sem'+semOfDiv(d)).join('; ')));
await b.close()})();
