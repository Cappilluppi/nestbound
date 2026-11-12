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
async function evaluate(expression){if(typeof expression==='function')expression='('+expression.toString()+')()';const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value;}
async function click(selector){const p=await evaluate('(()=>{const n=document.querySelector('+JSON.stringify(selector)+');if(!n)throw Error("Missing control");const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');await command('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});await delay(30);}
async function hold(selector,ms){const p=await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await delay(ms);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});}
async function screenshot(name){const r=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(qa,name),Buffer.from(r.data,'base64'));}
try{
 for(let n=0;n<70;n++){try{const r=await fetch('http://127.0.0.1:9437/json/version');if(r.ok)break}catch{}await delay(150);}
 tab=await(await fetch('http://127.0.0.1:9437/json/new?'+encodeURIComponent(url),{method:'PUT'})).json();
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)};
 await command('Runtime.enable');await command('Page.enable');await command('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});await command('Page.navigate',{url});await delay(300);
 assert.equal(await evaluate('document.title'),"Dino's life");assert.equal(await evaluate('elements.length'),10);assert.equal(await evaluate('Object.values(decisions).every(d=>d.length===3)'),true);
 await click('[data-species="2"]');await click('#startGame');assert.equal(await evaluate('game.started'),true);
 await screenshot('dinos-forest-start.png');
 const before=await evaluate('game.camera.z');await hold('[data-move="forward"]',400);assert(await evaluate('game.camera.z')<before-.6,'Walking control');
 const canvas=await evaluate(()=>({x:innerWidth*.6,y:innerHeight*.35}));
 await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...canvas});await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:canvas.x+90,y:canvas.y});await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:canvas.x+90,y:canvas.y});await delay(180);
 assert(Math.abs(await evaluate('game.camera.yaw'))>.2);assert.equal(await evaluate('game.selected'),null);
 const actions=await evaluate(()=>{
  let checked=0;for(const o of elements)for(let index=0;index<3;index++){
   resetProgress(true);Object.assign(game.inventory,{fruit:5,fronds:5,branches:5,cup:1,water:1,spores:1,egg:1});Object.assign(game.flags,{ford:true,hidden:true,barkClue:true});game.trust=1;game.joined=true;game.companion.x=-14;game.companion.z=-3;
   if(o.id==='spring'&&index===1)game.inventory.water=0;
   if(!jumpTo(o.id))throw Error('No safe location: '+o.id);game.aim=o.id;interact();if(document.querySelectorAll('.decision').length!==3)throw Error('Missing decisions');
   if(!applyAction(o.id,index))throw Error('Valid action rejected: '+o.id+'.'+index);
   const choice=decisions[o.id][index],key=o.id+'.'+choice.id;if(!game.done.has(key))throw Error('Action unrecorded');
   const snapshot=JSON.stringify({stats:game.stats,trust:game.trust,inventory:game.inventory});const repeated=applyAction(o.id,index);
   if(!choice.repeat&&repeated)throw Error('Duplicate action');if(JSON.stringify({stats:game.stats,trust:game.trust,inventory:game.inventory})!==snapshot)throw Error('Duplicate reward: '+key);
   if(Object.values(game.stats).some(v=>v<0||v>100)||Object.values(game.inventory).some(v=>v<0))throw Error('Invalid resources');checked++;
  }return checked;
 });assert.equal(actions,30);
 await evaluate('resetProgress(true);jumpTo("ferns");game.aim="ferns";interact()');assert.equal(await evaluate('document.querySelector("[data-decision=cup]").disabled'),true);assert.equal(await evaluate('applyAction("ferns",1)'),false);
 await evaluate('closeAction();game.camera={x:0,z:12,yaw:0};game.aim="sapling";interact()');assert.equal(await evaluate('game.selected'),null);
 await evaluate('game.camera={x:-10,z:5,yaw:0};game.aim="spring";interact()');assert.equal(await evaluate('game.selected'),null,'A tree trunk blocks interaction through it');
 await evaluate(()=>{
  for(const [flag,x] of [['ford',1.3],['bridge',-9],['steps',9.32]]){resetProgress(true);if(canStand(x,0))throw Error('Creek open initially');game.flags[flag]=true;if(!canStand(x,0))throw Error('Closed crossing '+flag);game.camera={x,z:4,yaw:0};move('forward',7);if(game.camera.z> -2.8)throw Error('Cannot cross '+flag+': '+JSON.stringify(game.camera));}
  resetProgress(true);if(canStand(-14,-6)||canStand(-11,-10))throw Error('Root wall open initially');game.flags.roots=true;if(!canStand(-14,-6))throw Error('Closed root entrance');game.flags.hidden=true;if(!canStand(-11,-10))throw Error('Closed hidden entrance');
 });
 const playthrough=await evaluate(()=>{
  resetProgress(true);
  function approach(id){
   closeAction();const o=elements.find(o=>o.id===id),target=position(o),start={x:Math.round(game.camera.x),z:Math.round(game.camera.z)},key=p=>p.x+','+p.z,queue=[start],parents=new Map([[key(start),null]]);let goal=null;
   for(let i=0;i<queue.length&&i<1200;i++){const p=queue[i],saved=game.camera;game.camera={...saved,x:p.x,z:p.z};const clear=!lineBlocked(o);game.camera=saved;
    if(Math.hypot(p.x-target.x,p.z-target.z)<3&&clear){goal=p;break}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,z:p.z+dz},k=key(n);if(parents.has(k)||!canStand(n.x,n.z))continue;parents.set(k,p);queue.push(n)}
   }
   if(!goal)throw Error('No walking route: '+id);const path=[];for(let p=goal;p&&key(p)!==key(start);p=parents.get(key(p)))path.push(p);path.reverse();
   for(const p of path){const dx=p.x-game.camera.x,dz=p.z-game.camera.z;game.camera.yaw=Math.atan2(dx,-dz);move('forward',Math.hypot(dx,dz));}
   if(distance(id)>3.5||lineBlocked(o))throw Error('Walking stopped short: '+id);game.aim=id;interact();if(game.selected!==id)throw Error('Cannot select '+id);
  }
  const sequence=[['ferns',0],['ferns',1],['tree',0],['tree',1],['tree',2],['companion',0],['companion',1],['companion',2],['spring',0],['spring',1],['spring',2],['log',1],['log',2],['log',0],['stones',0],['stones',1],['stones',2],['nest',0],['nest',1],['nest',2],['fungi',0],['fungi',1],['fungi',2],['roots',0],['roots',1],['sapling',0],['sapling',1],['sapling',2],['spring',1],['ferns',2]];
  for(const [id,index] of sequence){approach(id);if(!applyAction(id,index))throw Error('Puzzle action failed '+id+'.'+index)}
  closeAction();if(game.discovered.size!==10||game.done.size!==29)throw Error('Incomplete playthrough');
  if(!game.flags.saplingWatered||!game.flags.returnedEgg||!game.flags.roots||!game.flags.hidden)throw Error('World effects missing');
  if(game.inventory.water!==1||game.inventory.cup!==1)throw Error('Cup refill failed');return game.done.size;
 });assert.equal(playthrough,29);
 await evaluate('resetProgress(true);game.flags.ford=true;game.joined=true;game.trust=1;game.camera={x:0,z:10,yaw:0};game.companion.x=6;game.companion.z=3');
 const companionStart=await evaluate('Math.hypot(game.companion.x-game.camera.x,game.companion.z-game.camera.z)');
 await evaluate('for(let n=0;n<180;n++){worldTime+=.05;updateCompanion(.05)}');
 assert(await evaluate('Math.hypot(game.companion.x-game.camera.x,game.companion.z-game.camera.z)')<companionStart-1,'Companion follows');
 await evaluate('jumpTo("roots");game.companion.x=-14;game.companion.z=-3;game.aim="roots";interact()');assert.equal(await evaluate('applyAction("roots",2)'),true);
 await evaluate('closeAction();game.species=2');await click('#debugToggle');assert.equal(await evaluate('game.debugOpen'),true);
 const still=await evaluate('JSON.stringify(game.camera)');await command('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'});await delay(120);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW'});assert.equal(await evaluate('JSON.stringify(game.camera)'),still);
 for(const [id,value] of [['tuneSpeed','8.5'],['tuneReach','3'],['tuneReward','2']])await evaluate('(()=>{const n=$('+JSON.stringify(id)+');n.value='+JSON.stringify(value)+';n.dispatchEvent(new Event("input",{bubbles:true}))})()');
 assert.equal(await evaluate('tuning.speed'),8.5);assert.equal(await evaluate('tuning.reach'),3);assert.equal(await evaluate('tuning.reward'),2);
 await click('#debugReset');assert.equal(await evaluate('game.species'),2);assert.equal(await evaluate('game.done.size'),0);assert.equal(await evaluate('tuning.speed'),8.5);assert.equal(await evaluate('game.started'),true);
 await click('#debugItems');assert.equal(await evaluate('game.inventory.fronds'),3);await click('#debugUnlock');assert.equal(await evaluate('game.flags.roots&&game.flags.hidden&&game.flags.bridge&&game.flags.ford&&game.flags.steps'),true);assert.equal(await evaluate('game.done.size'),0);
 await evaluate('$("debugObject").value="sapling"');await click('#debugJump');assert.equal(await evaluate('game.aim'),'sapling');assert.equal(await evaluate('canStand(game.camera.x,game.camera.z)'),true);
 await screenshot('dinos-forest-debug.png');await click('#closeDebug');await click('#interact');await click('[data-decision="inspect"]');assert.equal(await evaluate('game.stats.knowledge'),10,'Tuned reward multiplier changes the actual reward');await click('#closeAction');await click('#debugToggle');const progress=await evaluate('JSON.stringify({inventory:game.inventory,flags:game.flags})');await click('#debugDefaults');assert.equal(await evaluate('tuning.speed'),4);assert.equal(await evaluate('tuning.reach'),7.5);assert.equal(await evaluate('tuning.reward'),1);assert.equal(await evaluate('JSON.stringify({inventory:game.inventory,flags:game.flags})'),progress);
 await click('#closeDebug');await click('#interact');assert.equal(await evaluate('game.selected'),'sapling');assert.equal(await evaluate('document.querySelectorAll(".decision").length'),3);
 await screenshot('dinos-forest-decisions.png');await click('#closeAction');
 await evaluate('jumpTo("tree");renderWorld()');await command('Emulation.setTouchEmulationEnabled',{enabled:true});
 const hit=await evaluate(()=>{const r=document.querySelector('[data-object=tree] .hit').getBoundingClientRect();return {x:Math.max(15,Math.min(innerWidth-15,r.x+r.width/2)),y:Math.max(170,Math.min(innerHeight-220,r.y+r.height/2))}});
 await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[hit]});await command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(60);assert.equal(await evaluate('game.selected'),'tree');
 await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});assert.equal(await evaluate('game.selected'),null);
 assert.equal(await evaluate('document.querySelectorAll(".game-overview,nav,footer").length'),0);
 for(const [width,height] of [[1920,1080],[1366,768],[1024,768],[844,390],[390,844]]){
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate(()=>{fit();return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true,'No scroll '+width+'x'+height);
  const controls=await evaluate(()=>['interact','debugToggle'].map(id=>{const r=$(id).getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}));assert(controls.every(Boolean));
 }
 await command('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});await evaluate('fit();resetProgress(true);renderWorld()');await screenshot('dinos-forest-final.png');
 assert.deepEqual(errors,[],'No browser exceptions');
 console.log('PASS: 10 elements / 30 decisions; all action and reward guards; connected walking playthrough; three crossings and both hollow entrances; companion follow/help; debug tools; mouse, touch, movement; five responsive layouts.');
}catch(error){if(ws?.readyState===1){console.log('Browser state:',await evaluate('JSON.stringify({camera:game.camera,selected:game.selected,aim:game.aim,debug:game.debugOpen,inventory:game.inventory,flags:game.flags})'));await screenshot('dinos-forest-failure.png')}throw error}finally{if(ws?.readyState===1){try{await command('Browser.close')}catch{}ws.close()}browser.kill();server.close();}
