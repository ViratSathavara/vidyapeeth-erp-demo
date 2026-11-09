/* =====================================================================
   Install as an app (PWA) — for every login and on the sign-in screen.
   Phone: a banner + a button in the top bar. Computer (Chrome / Edge): an
   "Install app" button that adds a desktop icon; the app then opens in its
   own window and keeps working offline (data is in this browser).
   ===================================================================== */
let deferredInstall=null;
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: window-controls-overlay)').matches||navigator.standalone===true;
const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isAndroid=()=>/Android/i.test(navigator.userAgent);
const isMobileDevice=()=>isIOS()||isAndroid()||/Mobi/i.test(navigator.userAgent);
const isMacSafari=()=>/Macintosh/.test(navigator.userAgent)&&/Safari\//.test(navigator.userAgent)&&!/Chrome|Chromium|Edg\//.test(navigator.userAgent)&&!isIOS();
const isEdge=()=>/Edg\//.test(navigator.userAgent);
/* how this browser can install: prompt (one tap) | ios | android-manual | mac-safari | none */
function installMode(){
  if(isStandalone())return'none';
  if(deferredInstall)return'prompt';
  if(isIOS())return'ios';
  if(isMobileDevice())return'android-manual';
  if(isMacSafari())return'mac-safari';
  return'none'; /* desktop Chrome / Edge show the button as soon as the browser says the app can be installed */
}
const HIDE_KEY='npcte_install_hide_until';
const bannerHidden=()=>+(lsGet(HIDE_KEY)||0)>Date.now();
const ICON_INSTALL=IC('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>');
function installCard(where){
  const mob=isMobileDevice();
  const title=mob?'Install the NPCTE app':'Install NPCTE on this computer';
  const sub=mob?'Home-screen app, full screen, with alerts.':'Adds a desktop icon. Opens in its own window and works offline.';
  return`<div class="installbar ib-${where}" role="region" aria-label="Install the app"><div class="seal" aria-hidden="true">N</div><div><b>${title}</b><small>${sub}</small></div>
   <button class="btn primary sm" type="button" data-act="installApp">${ICON_INSTALL}<span>Install</span></button>${where==='login'?'':`<button class="iconbtn" type="button" data-act="installHide" aria-label="Hide for a week" title="Hide">${ICON_X}</button>`}</div>`;
}
function renderInstallUI(){
  const mode=installMode(),can_=mode!=='none';
  const tb=$('#tbInstall');if(tb)tb.innerHTML=can_?`<button class="iconbtn instbtn" type="button" data-act="installApp" title="Install app" aria-label="Install app">${ICON_INSTALL}<span class="lbl">Install app</span></button>`:'';
  const lg=$('#loginInstall');if(lg)lg.innerHTML=can_?installCard('login'):'';
  /* inside the app the banner shows on phones only (the top-bar button is there on every screen) */
  const sl=$('#installSlot');if(sl)sl.innerHTML=can_&&isMobileDevice()&&!bannerHidden()?installCard('app'):'';
  const pf=$('#profileInstall');if(pf)pf.innerHTML=installPanelHtml();
}
function installPanelHtml(){
  if(isStandalone())return`<p class="note" style="margin:0">You are using the installed app.</p>`;
  return`<p class="note" style="margin:0 0 8px">${isMobileDevice()?'Put NPCTE on your home screen to open it like an app.':'Add NPCTE to this computer: desktop icon, its own window, works offline.'}</p><button class="btn" type="button" data-act="installApp">${ICON_INSTALL} Install as app</button>`;
}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;renderInstallUI()});
addEventListener('appinstalled',()=>{deferredInstall=null;renderInstallUI();toast('NPCTE app installed. Open it from your '+(isMobileDevice()?'home screen':'desktop or Start menu')+'.');if(cur())setTimeout(()=>typeof askNotifyGently==='function'&&askNotifyGently(),800)});
try{matchMedia('(display-mode: standalone)').addEventListener('change',renderInstallUI)}catch(e){}
ACT.installHide=()=>{lsSet(HIDE_KEY,String(Date.now()+7*864e5));renderInstallUI();toast('Hidden. The Install button stays in the top bar.')};
ACT.installApp=async()=>{
  if(isStandalone()){toast('You are already using the installed app');return}
  if(deferredInstall){const ev_=deferredInstall;deferredInstall=null;ev_.prompt();const r=await ev_.userChoice.catch(()=>({}));renderInstallUI();if(r&&r.outcome==='accepted')toast('Installing NPCTE…');return}
  const mode=installMode();
  const steps=mode==='ios'?`<ol class="steps-ol"><li>Open this page in <b>Safari</b> (on iPhone 16.4+ Chrome also works).</li><li>Tap the <b>Share</b> button (square with an arrow).</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol>`
   :mode==='android-manual'?`<ol class="steps-ol"><li><b>Chrome:</b> tap <b>⋮</b> at the top right → <b>Install app</b> (or <b>Add to Home screen</b>).</li><li><b>Samsung Internet:</b> tap <b>☰</b> → <b>Add page to</b> → <b>Home screen</b>.</li></ol>`
   :mode==='mac-safari'?`<ol class="steps-ol"><li>In the Safari menu bar choose <b>File → Add to Dock</b>.</li><li>Click <b>Add</b>. NPCTE opens from the Dock in its own window.</li></ol>`
   :isEdge()?`<ol class="steps-ol"><li>Click <b>…</b> at the top right → <b>Apps</b> → <b>Install this site as an app</b>.</li><li>Tick <b>Create desktop shortcut</b> if asked.</li></ol>`
   :`<ol class="steps-ol"><li><b>Chrome:</b> click the install icon at the right end of the address bar, or <b>⋮</b> → <b>Cast, save and share</b> → <b>Install page as app</b>.</li><li><b>Edge:</b> <b>…</b> → <b>Apps</b> → <b>Install this site as an app</b>.</li><li>Firefox cannot install apps; use Chrome or Edge.</li></ol>`;
  dialog(`<h3>Install NPCTE</h3>${steps}<p class="note">After installing, open NPCTE from your ${isMobileDevice()?'home screen':'desktop, Start menu or Dock'} and sign in once.</p><div class="actions" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" data-act="closeDialog">OK</button></div>`,'Install the app');
};
function askInstall(){renderInstallUI();if(typeof askNotifyGently==='function')askNotifyGently()}
if('serviceWorker' in navigator&&location.protocol!=='file:')addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
