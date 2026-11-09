/* Local dev server for the NPCTE ERP demo. No dependencies. Run: node serve.js  (or npm start)
   - Serves index.html with the same security headers as vercel.json (so CSP problems show up locally)
   - Mounts api/send-receipt.js at /api/send-receipt in demo mode (validates requests, sends nothing)
   Options: PORT=5173 (default), HOST=127.0.0.1 (default; use 0.0.0.0 to open it from your phone on the same Wi-Fi) */
const http=require('http'),fs=require('fs'),path=require('path');
const PORT=+process.env.PORT||5173,HOST=process.env.HOST||'127.0.0.1',ROOT=__dirname;
/* headers are read again on every request, so a rebuild (new CSP hash) works without restarting the server */
const headers=()=>{try{const cfg=JSON.parse(fs.readFileSync(path.join(ROOT,'vercel.json'),'utf8'));return Object.fromEntries(((cfg.headers||[])[0]||{headers:[]}).headers.map(h=>[h.key,h.value]))}catch(e){return{}}};
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json'};
process.env.RECEIPT_DEMO_MODE=process.env.RECEIPT_DEMO_MODE||'1';
let mail;try{mail=require('./api/send-receipt.js')}catch(e){console.warn('API not loaded:',e.message)}
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://x');
  if(url.pathname==='/api/send-receipt'&&mail){res.setHeader('Access-Control-Allow-Origin',`http://${req.headers.host}`);return mail(req,res)}
  let p=decodeURIComponent(url.pathname);if(p.endsWith('/'))p+='index.html';if(p==='/')p='/index.html';
  const f=path.normalize(path.join(ROOT,p));
  const PUBLIC=['index.html','manifest.webmanifest','sw.js','offline.html','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png'].map(x=>path.join(ROOT,x));
  const allowed=PUBLIC.includes(f); /* only the app files are public: src, api and config files are not served */
  if(!allowed){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Not found')}
  fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);return res.end('Not found')}
    const extra=p.endsWith('sw.js')?{'Service-Worker-Allowed':'/'}:{};res.writeHead(200,{...headers(),...extra,'Content-Type':TYPES[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b)})
}).listen(PORT,HOST,()=>console.log(`NPCTE ERP demo running at http://${HOST==='0.0.0.0'?'localhost':HOST}:${PORT}\nLogins: admin/admin123 · principal/principal123 · clerk/clerk123 · student: bed26-001/student123 (see the login page)\nStop with Ctrl+C`));
