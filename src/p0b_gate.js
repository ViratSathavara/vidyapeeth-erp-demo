/* ---------- password gate: the demo holds real college data (src/p0_vault.js, encrypted) ----------
   The page asks for the demo password, derives the key in the browser (PBKDF2-SHA256) and decrypts the data
   (AES-256-GCM). A wrong password cannot decrypt anything: the data in the page is unreadable without it.
   "Remember on this device" keeps the derived key in localStorage, otherwise only for this browser tab session.
   A new vault (new password or new data) has a new salt, so a remembered key stops working and the gate shows again. */
const GATE_KEY='npcte_gate_key';
/* every full screen (gate, sign-in, app) starts at the top: the browser must not restore an old scroll position,
   because the app draws itself only after the gate, so a restored position would open the page part-way down */
try{if('scrollRestoration' in history)history.scrollRestoration='manual'}catch(e){}
const b64bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const bytesB64=b=>btoa(String.fromCharCode(...b));
async function gateDerive(pw){
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:b64bytes(VAULT.salt),iterations:VAULT.rounds},base,256))}
async function gateOpen(raw){
  const k=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64bytes(VAULT.iv)},k,b64bytes(VAULT.ct));
  return JSON.parse(new TextDecoder().decode(pt))}
function gateSaved(){try{return sessionStorage.getItem(GATE_KEY)||localStorage.getItem(GATE_KEY)}catch(e){return null}}
function gateForget(){try{sessionStorage.removeItem(GATE_KEY);localStorage.removeItem(GATE_KEY)}catch(e){}}
function gateStart(boot){toTop();
  if(typeof VAULT==='undefined'){boot();return}
  const root=document.getElementById('root');
  if(!(window.crypto&&crypto.subtle)){root.innerHTML='<div class="gate"><div class="gate-card"><h1>NPCTE ERP</h1><p>This demo needs a secure (https) connection. Open it from its https link.</p></div></div>';return}
  const saved=gateSaved();
  if(saved){root.innerHTML='<div class="gate"><div class="gate-card"><p class="gate-wait">Opening…</p></div></div>';
    gateOpen(b64bytes(saved)).then(d=>{REAL=d;boot()}).catch(()=>{gateForget();gateForm(boot)});return}
  gateForm(boot);
}
function gateForm(boot){
  const root=document.getElementById('root');
  root.innerHTML=`<div class="gate"><form class="gate-card" id="gateForm" autocomplete="on" novalidate>
    <div class="gate-logo" aria-hidden="true">N</div>
    <h1>NPCTE ERP</h1>
    <p class="gate-sub">Private demo with the college's fee data. Enter the password to continue.</p>
    <label class="label" for="gatePw">Password</label>
    <div class="gate-pw"><input id="gatePw" type="password" autocomplete="current-password" required autofocus><button type="button" class="gate-eye" id="gateEye" aria-label="Show password" aria-pressed="false">Show</button></div>
    <label class="gate-rem"><input type="checkbox" id="gateRem" checked> Remember on this device</label>
    <p class="gate-err" id="gateErr" role="alert"></p>
    <button class="btn primary big gate-btn" id="gateBtn">Open demo</button>
    <p class="gate-foot">The Phase 1 demo of the NPCTE College ERP · data stays in this browser</p>
  </form></div>`;
  const pw=document.getElementById('gatePw'),btn=document.getElementById('gateBtn'),err=document.getElementById('gateErr'),eye=document.getElementById('gateEye');
  eye.addEventListener('click',()=>{const show=pw.type==='password';pw.type=show?'text':'password';eye.textContent=show?'Hide':'Show';eye.setAttribute('aria-pressed',String(show));eye.setAttribute('aria-label',show?'Hide password':'Show password');pw.focus()});
  document.getElementById('gateForm').addEventListener('submit',async e=>{e.preventDefault();
    if(!pw.value){err.textContent='Enter the password';pw.focus();return}
    btn.disabled=true;btn.textContent='Checking…';err.textContent='';
    try{const raw=await gateDerive(pw.value);const d=await gateOpen(raw);
      const k=bytesB64(raw);try{if(document.getElementById('gateRem').checked)localStorage.setItem(GATE_KEY,k);else sessionStorage.setItem(GATE_KEY,k)}catch(x){}
      REAL=d;boot()}
    catch(x){btn.disabled=false;btn.textContent='Open demo';err.textContent='Wrong password. Please try again.';pw.select();pw.focus()}});
  setTimeout(()=>pw.focus(),50);
}
