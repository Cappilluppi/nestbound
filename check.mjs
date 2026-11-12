import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const base=path.resolve('dist'), qa=path.resolve('../.tools');
const server=http.createServer((req,res)=>{const name=req.url==='/'?'index.html':req.url.slice(1);const file=path.resolve(base,name);if(!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return}try{res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--remote-debugging-port=9437','--user-data-dir='+path.join(qa,'nestbound-browser-profile'),'about:blank'],{stdio:'ignore',windowsHide:true});
let ws,seq=0,tab,errors=[];const pending=new Map();
async function command(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method))},12000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value;}
async function click(selector){const p=await evaluate('(()=>{const n=document.querySelector('+JSON.stringify(selector)+');if(!n)throw Error("Missing control");const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');await command('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});await delay(30);}
async function hold(selector,ms){const p=await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await delay(ms);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});}
async function screenshot(name){const r=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(qa,name),Buffer.from(r.data,'base64'));}
try{
 for(let n=0;n<70;n++){try{const r=await fetch('http://127.0.0.1:9437/json/version');if(r.ok)break}catch{}await delay(150);}
 tab=await (await fetch('http://127.0.0.1:9437/json/new?'+encodeURIComponent(url),{method:'PUT'})).json();
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};
 await command('Runtime.enable');await command('Page.enable');await command('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});await command('Page.navigate',{url});await delay(250);
 assert.equal(await evaluate('game.panel'),'species');
 await click('.species-card:nth-child(3)');assert.equal(await evaluate('game.species'),2);
 await click('#panelActions .primary');assert.equal(await evaluate('game.panel'),'mission');await click('#panelActions .primary');assert.equal(await evaluate('game.phase'),'walk');
 await screenshot('nestbound-scene.png');
 await click('[data-object="tree"] .hit');assert.equal(await evaluate('game.panel'),null,'Out-of-range target must not open a decision');
 await hold('[data-move="forward"]',1100);const walked=await evaluate('game.camera.z');assert(walked>3&&walked<7,'Walking button changes position');
 await click('[data-object="tree"] .hit');assert.equal(await evaluate('game.panel'),'decision');
 await screenshot('nestbound-decision.png');
 await click('[data-decision="name"]');await evaluate('$("treeName").value="  "');await click('#panelActions .primary');assert.equal(await evaluate('game.results.length'),0);
 await evaluate('$("treeName").value="<img src=x onerror=alert(1)>"');await click('#panelActions .primary');assert.equal(await evaluate('game.stats.knowledge'),5);assert.equal(await evaluate('document.querySelectorAll(".object img").length'),0);
 await click('#panelActions .primary');assert.equal(await evaluate('game.panel'),null);assert.equal(await evaluate('game.mission'),1);assert.equal(await evaluate('game.phase'),'walk');assert.equal(await evaluate('$("missionTitle").textContent'),'An unexpected neighbor');
 await evaluate('game.camera={x:3,z:7};renderWorld()');await click('[data-object="animal"] .hit');await click('[data-decision="friend"]');assert.equal(await evaluate('game.stats.empathy'),20);
 await click('#panelActions .primary');assert.equal(await evaluate('game.mission'),2);assert.equal(await evaluate('game.phase'),'walk');await evaluate('game.camera={x:0,z:19};renderWorld()');await click('[data-object="nest"] .hit');await click('[data-decision="care"]');await click('#panelActions .primary');assert.equal(await evaluate('game.phase'),'free');
 await evaluate('game.results[0].name="First Light";renderJournal()');assert.equal(await evaluate('document.querySelectorAll(".journal-row").length'),3);
 await screenshot('nestbound-journal.png');
 // Replay every branch for every proposed species, checking sequence and reward guards.
 const runs=await evaluate('(()=>{let runs=0;for(let sp=0;sp<3;sp++)for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++){reset();game.species=sp;game.started=true;hidePanel();for(const [i,ch] of [a,b,c].entries()){game.mission=i;game.phase="walk";const o=objects[i];game.camera={x:o.x,z:o.z-6};aim(o.id);interact();if(game.panel!=="decision")throw Error("decision");resolveAction(o.id,ch,ch===2&&i===0?"First Light":undefined);if(game.results.length!==i+1)throw Error("journal");const snapshot=JSON.stringify(game.stats);resolveAction(o.id,ch);if(JSON.stringify(game.stats)!==snapshot)throw Error("repeat reward");finishFeedback(false);}if(game.phase!=="free")throw Error("completion");if(!Object.values(game.stats).every(n=>n>=0&&n<=100))throw Error("stat bounds");runs++;}return runs})()');
 assert.equal(runs,81);
 const checks=[];
 assert.equal(await evaluate('document.querySelectorAll("nav,[data-tab],#notes,#journal").length'),0,'Single page has no tabs or alternate document screens');
 assert.equal(await evaluate('document.querySelectorAll(".design-card").length'),6,'All design topics are on the overview');
 for(const [width,height] of [[1600,900],[1920,1080],[1366,768],[1280,720],[1024,768]]){
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(50);
  const r=await evaluate('(()=>{const f=$("frame").getBoundingClientRect(),o=document.querySelector(".game-overview"),d=document.querySelector(".demo-area").getBoundingClientRect();return {fits:f.left>=-1&&f.top>=-1&&f.right<=innerWidth+1&&f.bottom<=innerHeight+1,noScroll:document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth,noOverflow:o.scrollHeight<=o.clientHeight,separate:o.getBoundingClientRect().right<d.left,cards:[...document.querySelectorAll(".design-card")].map(c=>({fits:c.scrollHeight<=c.clientHeight,title:c.querySelector("h2").textContent}))}})()');
  checks.push({width,height,...r});assert(r.fits&&r.noScroll&&r.noOverflow&&r.separate&&r.cards.every(c=>c.fits),'One-page document overflow: '+JSON.stringify(checks.at(-1)));
  await evaluate('chooseSpecies()');const modal=await evaluate('(()=>{const p=document.querySelector(".panel"),r=p.getBoundingClientRect(),m=$("modal").getBoundingClientRect(),o=document.querySelector(".game-overview").getBoundingClientRect();return p.scrollHeight<=p.clientHeight&&r.top>=m.top-1&&r.bottom<=m.bottom+1&&m.left>o.right})()');assert(modal,'Species panel must fit without covering documentation');
  await evaluate('hidePanel()');
 }
 await command('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});await screenshot('nestbound-onepager.png');
 // Keyboard interaction, modal movement lock, and touch selection.
 await evaluate('reset();game.started=true;hidePanel();game.phase="walk";game.camera={x:-2,z:4};renderWorld();renderHud();aim("tree");pointAt("tree")');
 await command('Input.dispatchKeyEvent',{type:'keyDown',key:'e',code:'KeyE'});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'e',code:'KeyE'});assert.equal(await evaluate('game.panel'),'decision');
 const still=await evaluate('JSON.stringify(game.camera)');await command('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'});await delay(100);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW'});assert.equal(await evaluate('JSON.stringify(game.camera)'),still);
 await click('[data-decision="name"]');await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',modifiers:8});assert.equal(await evaluate('document.activeElement.textContent'),'Back');await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
 await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});assert.equal(await evaluate('game.panel'),null);
 await command('Emulation.setTouchEmulationEnabled',{enabled:true});const touch=await evaluate('(()=>{const r=document.querySelector("[data-object=tree] .hit").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(40);assert.equal(await evaluate('game.panel'),'decision');
 await click('[data-decision="destroy"]');await click('#panelActions .primary');await click('#restart');await click('#panelActions .quiet');assert.equal(await evaluate('game.phase'),'walk');assert.equal(await evaluate('game.mission'),1,'Cancel restart cannot strand a completed mission');
 assert.equal(await evaluate('$("restart").closest(".demo-area")!==null'),true);assert.equal(await evaluate('$("interact").closest(".demo-area")!==null'),true);assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b=>/receive mission/i.test(b.textContent))'),false);assert.equal(await evaluate('document.querySelector("[data-step=\\"3\\"]").textContent'),'Change your life');
 assert.deepEqual(errors,[],'No browser exceptions');
 console.log('PASS: real-browser pointing, out-of-range guard, hold-to-walk, decision panels, safe naming, scene changes, journal, all 81 species/branch combinations, reward guards, reset, and 5 single-page layout checks. Screenshots in .tools/.');
}catch(error){if(ws?.readyState===1){console.log('Browser state:',await evaluate('JSON.stringify({mission:game.mission,phase:game.phase,panel:game.panel,aim:game.aim,camera:game.camera})'));await screenshot('nestbound-failure.png');}throw error;}finally{if(ws?.readyState===1){try{await command('Browser.close')}catch{}ws.close()}browser.kill();server.close();}
