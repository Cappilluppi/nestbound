import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const base=path.resolve('dist'),qa=path.resolve('../.tools'),delay=ms=>new Promise(r=>setTimeout(r,ms));
const server=http.createServer((req,res)=>{let file=path.resolve(base,'.'+decodeURIComponent(req.url.split('?')[0]));if(file!==base&&!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');try{const ext=path.extname(file);res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'})[ext]||'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/presentation/';
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-extensions','--remote-debugging-port=9439','--user-data-dir='+path.join(qa,'presentation-qa-browser'),'about:blank'],{stdio:'ignore',windowsHide:true});
let ws,seq=0;const pending=new Map(),errors=[],failed=[];
function command(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},12000);pending.set(id,{resolve:r=>{clearTimeout(timeout);resolve(r)},reject:e=>{clearTimeout(timeout);reject(e)}});ws.send(JSON.stringify({id,method,params}))});}
async function evaluate(expression){if(typeof expression==='function')expression='('+expression.toString()+')()';const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;}
async function click(selector){const p=await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});await delay(50);}
async function key(key){await command('Input.dispatchKeyEvent',{type:'keyDown',key});await command('Input.dispatchKeyEvent',{type:'keyUp',key});await delay(50);}
async function screenshot(name){const r=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(qa,name),Buffer.from(r.data,'base64'));}
try{
 let ready=false;for(let n=0;n<60;n++){try{if((await fetch('http://127.0.0.1:9439/json/version')).ok){ready=true;break}}catch{}await delay(150)}if(!ready)throw Error('Chrome did not start');
 const tab=await(await fetch('http://127.0.0.1:9439/json/new?about:blank',{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);else if(m.method==='Network.responseReceived'&&m.params.response.status>=400)failed.push(m.params.response.url)};
 await command('Page.enable');await command('Runtime.enable');await command('Network.enable');await command('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});await command('Page.navigate',{url});await delay(500);
 assert.equal(await evaluate('slides.length'),4);assert.equal(await evaluate('current'),0);
 assert.equal(await evaluate('[...document.images].every(i=>i.complete&&i.naturalWidth>0)'),true,'Local images loaded');
 assert.equal(await evaluate('document.querySelectorAll(".comparison-images figure").length'),3,'Notes, one-pager and playable prototype');
 assert.deepEqual(await evaluate('[...document.querySelectorAll(".comparison-images h3")].map(n=>n.textContent)'),['Planning notes','Interactive one-pager','Playable forest room']);
 assert.equal(await evaluate('document.querySelector("#title-2").textContent'),'What changed. What we gain.');
 assert.equal(await evaluate('document.querySelectorAll("[data-map-art] use").length'),10,'Restored forest map');
 assert.equal(await evaluate('document.querySelector("#slide-4 .test-grid article:nth-child(1) h3").textContent'),'Manage dinosaur needs');
 assert.equal(await evaluate('document.querySelector("#slide-4 .test-grid article:nth-child(2) h3").textContent'),'Evolve species & family');
 for(let i=0;i<4;i++){
  await evaluate('show('+i+')');await delay(300);assert.equal(await evaluate('document.querySelectorAll(".slide:not([hidden])").length'),1);
  await screenshot('dinos-slide-'+(i+1)+'.png');
  const overflow=await evaluate(()=>{const slide=slides[current],d=document.getElementById('deck').getBoundingClientRect(),bad=[];const walker=document.createTreeWalker(slide,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){if(!n.textContent.trim()||n.parentElement.closest('svg'))continue;const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.left<d.left-1||r.right>d.right+1||r.top<d.top-1||r.bottom>d.bottom-78+1)bad.push(n.textContent.trim());}return bad;});assert.deepEqual(overflow,[],'Text within slide '+(i+1));
 }
 await click('#previous');assert.equal(await evaluate('current'),2);await click('[data-slide="0"]');assert.equal(await evaluate('current'),0);assert.equal(await evaluate('previous.disabled'),true);
 await key('ArrowRight');assert.equal(await evaluate('current'),1);await evaluate('document.activeElement.blur()');await key(' ');assert.equal(await evaluate('current'),2);await key('Home');assert.equal(await evaluate('current'),0);await key('End');assert.equal(await evaluate('current'),3);assert.equal(await evaluate('next.disabled'),true);
 await evaluate('location.hash="#2"');await delay(50);assert.equal(await evaluate('current'),1);
 await command('Emulation.setTouchEmulationEnabled',{enabled:true});await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:1200,y:170}]});await command('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:850,y:175}]});await command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(80);assert.equal(await evaluate('current'),2,'Touch swipe navigation');
 await command('Emulation.setTouchEmulationEnabled',{enabled:false});
 for(const [width,height] of [[1920,1080],[1366,768],[1024,768],[844,390],[390,844]]){
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate('fit()');
  assert.equal(await evaluate('document.documentElement.scrollWidth===innerWidth&&document.documentElement.scrollHeight===innerHeight'),true,'No scroll '+width+'x'+height);
  assert.equal(await evaluate(()=>{const r=document.getElementById('deck').getBoundingClientRect();return r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}),true,'Deck fits '+width+'x'+height);
 }
 await command('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});await evaluate('fit();show(0)');await click('#fullscreen');await delay(100);
 const full=await evaluate('({active:!!document.fullscreenElement,title:document.getElementById("fullscreen").title})');
 assert(full.active||full.title==='Fullscreen is unavailable in this browser','Fullscreen works or gives graceful fallback: '+JSON.stringify(full));
 if(full.active)await evaluate('document.exitFullscreen()');
 await evaluate('window.fullscreenRequests=0;document.documentElement.requestFullscreen=async()=>{window.fullscreenRequests++}');await click('#fullscreen');assert.equal(await evaluate('window.fullscreenRequests'),1,'Fullscreen button calls browser API');
 // Verify the separate playable page still loads and starts.
 await command('Page.navigate',{url:url.replace('presentation/','')});await delay(400);assert.equal(await evaluate('elements.length'),10);await click('#startGame');assert.equal(await evaluate('game.started'),true);
 assert.deepEqual(errors,[]);assert.deepEqual(failed.filter(u=>!u.endsWith('/favicon.ico')),[]);
 console.log('PASS: four slides; narrow notes step plus original comparison wording; restored ten-element forest map; needs/generations cards preserved; text fits; buttons, keyboard, deep links, touch swipe and fullscreen API/fallback; five responsive sizes without scrolling; original game starts; no browser errors.');
}finally{if(ws?.readyState===1){await command('Browser.close');ws.close()}browser.kill();server.close()}
