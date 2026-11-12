'use strict';
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const roster=['Triceratops','Parasaurolophus','Velociraptor'];
const statKeys=['health','strength','knowledge','empathy','fun'];
const itemNames={fruit:'Fruit',fronds:'Fronds',branches:'Branches',cup:'Leaf cup',water:'Water',spores:'Spores',egg:'Lost egg'};
const DEFAULT_TUNING=Object.freeze({speed:4,reach:7.5,reward:1});
const tuning={...DEFAULT_TUNING};
const elements=[
 {id:'tree',name:'Fruit tree',x:-5,z:4,drawing:'treeDrawing',height:420,width:360,radius:1.1},
 {id:'spring',name:'Forest spring',x:0,z:3,drawing:'springDrawing',height:110,width:260,radius:.7},
 {id:'log',name:'Fallen log',x:-9,z:2,drawing:'logDrawing',height:145,width:300,radius:1.2},
 {id:'stones',name:'Carved stone ring',x:8,z:2.5,drawing:'stonesDrawing',height:180,width:270,radius:.9},
 {id:'ferns',name:'Fern patch',x:5,z:7,drawing:'fernPatchDrawing',height:180,width:275,radius:0},
 {id:'companion',name:'Young dinosaur',x:6,z:3,drawing:'companionDrawing',height:270,width:330,radius:0},
 {id:'nest',name:'Abandoned nest',x:4,z:-7,drawing:'nestDrawing',height:110,width:250,radius:.65},
 {id:'fungi',name:'Glowing mushrooms',x:-5,z:-4,drawing:'fungiDrawing',height:160,width:240,radius:0},
 {id:'roots',name:'Root arch',x:-14,z:-5.5,drawing:'rootsDrawing',height:280,width:330,radius:0},
 {id:'sapling',name:'Dry sapling',x:-15,z:-10,drawing:'saplingDrawing',height:270,width:250,radius:.6}
];
const rocks=[{x:-2,z:7,radius:.8},{x:12,z:8,radius:1.1},{x:-13,z:-2,radius:.75},{x:6,z:-10,radius:1}];
const decor=[];
for(let i=0;i<13;i++){decor.push({x:-18,z:-13+i*2.15},{x:18,z:-13+i*2.15});}
for(let i=0;i<12;i++)decor.push({x:-16+i*2.9,z:-14},{x:-16+i*2.9,z:14});
const game={species:0,started:false,debugOpen:false,mapOpen:false,selected:null,aim:null};
function newProgress(){return {camera:{x:0,z:12,yaw:0},stats:{health:40,strength:10,knowledge:0,empathy:0,fun:0},inventory:{fruit:0,fronds:0,branches:0,cup:0,water:0,spores:0,egg:0},flags:{},trust:0,joined:false,done:new Set(),discovered:new Set(),journal:[],companion:{x:6,z:3,path:[],planAt:0}};}
Object.assign(game,newProgress());
const held=new Set();
let H=900,dirty=true,lastDraw=0,lastTime=0,worldTime=0,noticeTimer,drag=null,feedback='';
function node(name,attrs={}){const n=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function number(v){return Number.isInteger(v)?String(v):String(Math.round(v*100)/100);}
function paused(){return !game.started||game.debugOpen||!!game.selected||game.mapOpen;}
function fit(){H=1600*innerHeight/innerWidth;$('scene').setAttribute('viewBox','0 0 1600 '+H);$('skyFill').setAttribute('height',H);const offset=H*.35-330;for(const id of ['mountains','farHills'])$(id).setAttribute('transform','translate(0 '+offset+')');$('floorFill').setAttribute('y',H*.38);$('floorFill').setAttribute('height',H*.62);$('sun').setAttribute('cy',clamp(H*.12,70,240));$('hands').setAttribute('transform','translate(0 '+(H-748)+')');$('carriedEgg').setAttribute('transform','translate(0 '+(H-900)+')');dirty=true;renderWorld();}
addEventListener('resize',fit);
function position(o){if(o.id==='companion')return game.companion;if(o.id==='log'&&game.flags.bridge)return {x:-9,z:0};return o;}
function localPoint(x,z){const dx=x-game.camera.x,dz=z-game.camera.z,s=Math.sin(game.camera.yaw),c=Math.cos(game.camera.yaw);return {x:dx*c+dz*s,d:dx*s-dz*c};}
function projectPoint(x,z){const q=localPoint(x,z);return {x:800+q.x*720/Math.max(.25,q.d),y:H*.35+1500/Math.max(.25,q.d),d:q.d,scale:Math.min(2,5/Math.max(.25,q.d))};}
function distance(id){const p=position(elements.find(o=>o.id===id));return Math.hypot(p.x-game.camera.x,p.z-game.camera.z);}
function wallSegments(){const f=game.flags;return [
 ...(!f.roots?[[-18,-6,-11,-6]]:[[-18,-6,-15.8,-6],[-12.2,-6,-11,-6]]),
 ...(!f.hidden?[[-11,-14,-11,-6]]:[[-11,-14,-11,-11.8],[-11,-8.2,-11,-6]])
];}
function pointSegmentDistance(x,z,s){const [ax,az,bx,bz]=s,dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-ax-dx*t,z-az-dz*t);}
function canStand(x,z){if(x< -17.5||x>17.5||z< -13.5||z>13.5)return false;
 if(Math.abs(z)<1.4&&!((game.flags.bridge&&Math.abs(x+9)<1.4)||(game.flags.ford&&Math.abs(x)<1.5)||(game.flags.steps&&Math.abs(x-8)<1.4)))return false;
 if(wallSegments().some(s=>pointSegmentDistance(x,z,s)<.45))return false;
 if(rocks.some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+.4))return false;
 return !elements.some(o=>{if(!o.radius||(o.id==='log'&&game.flags.bridge))return false;const p=position(o);return Math.hypot(x-p.x,z-p.z)<o.radius+.38;});
}
function cross(ax,az,bx,bz){return ax*bz-az*bx;}
function segmentBlocked(a,b,s){const [x,z,x2,z2]=s,rx=b.x-a.x,rz=b.z-a.z,sx=x2-x,sz=z2-z,den=cross(rx,rz,sx,sz);if(Math.abs(den)<1e-8)return false;const t=cross(x-a.x,z-a.z,sx,sz)/den,u=cross(x-a.x,z-a.z,rx,rz)/den;return t>.002&&t<.998&&u>=0&&u<=1;}
function lineBlocked(o){const p=position(o);if(wallSegments().some(s=>segmentBlocked(game.camera,p,s)))return true;const blockers=[...rocks,...elements.filter(r=>r.id==='tree'&&r.id!==o.id)];return blockers.some(r=>pointSegmentDistance(r.x,r.z,[game.camera.x,game.camera.z,p.x,p.z])<r.radius*.8&&Math.hypot(p.x-r.x,p.z-r.z)>.2);}
function clearMovement(){held.clear();document.querySelectorAll('[data-move]').forEach(b=>b.classList.remove('pressed'));}
function move(direction,amount){if(paused())return;const yaw=game.camera.yaw,forward={x:Math.sin(yaw),z:-Math.cos(yaw)},right={x:Math.cos(yaw),z:Math.sin(yaw)};let dx=0,dz=0;if(direction==='forward'){dx=forward.x;dz=forward.z}if(direction==='back'){dx=-forward.x;dz=-forward.z}if(direction==='right'){dx=right.x;dz=right.z}if(direction==='left'){dx=-right.x;dz=-right.z}
 const steps=Math.max(1,Math.ceil(amount/.16));for(let i=0;i<steps;i++){const x=game.camera.x+dx*amount/steps,z=game.camera.z+dz*amount/steps;if(canStand(x,game.camera.z))game.camera.x=x;if(canStand(game.camera.x,z))game.camera.z=z;}dirty=true;
}
function polygon(points,fill,stroke){let p=points.map(v=>localPoint(v[0],v[1])),out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],ai=a.d>.3,bi=b.d>.3;if(ai)out.push(a);if(ai!==bi){const t=(.3-a.d)/(b.d-a.d);out.push({x:a.x+(b.x-a.x)*t,d:.3});}}if(out.length<3)return;const path=out.map((q,i)=>(i?'L':'M')+(800+q.x*720/q.d)+' '+(H*.35+1500/q.d)).join(' ')+'Z';$('ground').append(node('path',{d:path,fill,stroke:stroke||'none','stroke-width':3}));}
function groundRect(x,z,w,h,fill,stroke){polygon([[x-w/2,z-h/2],[x+w/2,z-h/2],[x+w/2,z+h/2],[x-w/2,z+h/2]],fill,stroke);}
function drawGround(){$('ground').replaceChildren();groundRect(0,0,36,2.6,'#91c9ce','#6fa7a5');
 if(game.flags.ford)groundRect(0,0,2.8,3.1,'#c9caa3','#a3b18c');
 if(game.flags.bridge)groundRect(-9,0,2.6,3.2,'#a68052','#795d3d');
 if(game.flags.steps)for(let z=-1.2;z<=1.2;z+=.6)groundRect(8,z,2.4,.42,'#b9c3a0','#829578');
 if(game.flags.glowTrail)for(const p of [[-5,-4],[-8,-4],[-11,-4],[-13,-5]])groundRect(p[0],p[1],.4,.4,'#d7e8a8');
 if(game.flags.saplingMulched)groundRect(-15,-10,2.5,2.3,'#8c794c');
}
function trailMarker(){const q=projectPoint(-7,10);if(q.d<.5||Math.abs(q.x-800)>1400)return;const scale=Math.min(1.2,q.scale),g=node('g',{transform:'translate('+q.x+' '+q.y+') scale('+scale+')',class:'ui-art','aria-hidden':'true'});
 g.append(node('path',{d:'M-13 0V-225M13 0V-225',stroke:'#856844','stroke-width':13}));g.append(node('path',{d:'M-127-240 122-238 133-65-119-59Z',fill:'#ddc79a',stroke:'#92754f','stroke-width':5}));
 const title=node('text',{x:0,y:-210,'text-anchor':'middle',fill:'#7e6846','font-size':17});title.textContent='YOUR CHOICES · '+game.done.size+'/30';g.append(title);
 game.journal.slice(-3).forEach((r,i)=>{const t=node('text',{x:-104,y:-172+i*34,fill:'#715c3e','font-size':16});t.textContent=r.label.length>24?r.label.slice(0,23)+'…':r.label;g.append(t)});$('objects').append(g);
}
function renderWorld(){if(!$('objects'))return;drawGround();$('objects').replaceChildren();
 const sprites=[...decor.map(o=>({...o,id:null,drawing:'pineDrawing',height:450,width:340,factor:.9})),...rocks.map(o=>({...o,id:null,drawing:'rockDrawing',height:140,width:230,factor:1})),...elements.map(o=>({...o,...position(o),factor:1,interactive:true}))];
 for(const s of wallSegments()){const n=Math.ceil(Math.hypot(s[2]-s[0],s[3]-s[1])/1.8);for(let i=0;i<=n;i++)sprites.push({x:s[0]+(s[2]-s[0])*i/n,z:s[1]+(s[3]-s[1])*i/n,drawing:'rockDrawing',height:140,width:230,factor:.65});}
 sprites.sort((a,b)=>localPoint(b.x,b.z).d-localPoint(a.x,a.z).d);
 const cssScale=1600/innerWidth;
 sprites.forEach(o=>{const p=projectPoint(o.x,o.z);if(p.d<.45||p.x< -650||p.x>2250)return;const g=node('g',{transform:'translate('+p.x+' '+p.y+')'}),sc=p.scale*(o.factor||1);const art=node('g',{transform:'scale('+sc+')'});const drawing=$(o.drawing).cloneNode(true);drawing.removeAttribute('id');
 if(o.id==='tree'&&game.done.has('tree.gather'))drawing.querySelector('.fruit').setAttribute('display','none');
 if(o.id==='spring'&&game.flags.ford)drawing.querySelector('.debris').setAttribute('display','none');
 if(o.id==='ferns'&&game.done.has('ferns.gather'))drawing.setAttribute('opacity','.55');
 if(o.id==='nest'&&!game.flags.returnedEgg)drawing.querySelectorAll('ellipse').forEach((e,i)=>{if(i>0)e.setAttribute('display','none')});
 if(o.id==='roots'&&game.flags.roots)drawing.querySelector('.root-blockage').setAttribute('display','none');
 if(o.id==='sapling'&&game.flags.saplingWatered){drawing.querySelector('.sapling-leaves').setAttribute('fill','#83bb70');drawing.querySelector('.sapling-leaves').setAttribute('stroke','#5c8c4c');}
 art.append(drawing);g.append(art);
 if(o.id==='companion'&&game.trust>0){const t=node('text',{x:0,y:-290*sc,'text-anchor':'middle',fill:'#b37663','font-size':28*sc});t.textContent=game.joined?'♥':'♡';g.append(t);}
 if(o.id==='nest'&&game.flags.linedNest){const ring=node('ellipse',{cx:0,cy:-10*sc,rx:115*sc,ry:25*sc,fill:'none',stroke:'#e3ce85','stroke-width':5*sc});g.append(ring);}
 if(o.interactive){g.setAttribute('class','object'+(game.aim===o.id?' aimed':''));g.dataset.object=o.id;g.setAttribute('role','button');g.setAttribute('tabindex',game.started&&!paused()?0:-1);g.setAttribute('aria-label',o.name+', '+distance(o.id).toFixed(1)+' meters away');
 const width=Math.max(o.width*sc,65*cssScale),height=Math.max(o.height*sc,65*cssScale);
 g.append(node('ellipse',{class:'halo',cx:0,cy:-height/2,rx:width/2+10,ry:height/2+10}));
 const label=node('text',{class:'object-label',x:0,y:24*cssScale,'font-size':13*cssScale});label.textContent=o.name;g.append(label);
 g.append(node('rect',{x:-width/2,y:-height-6,width,height:height+40*cssScale,fill:'transparent','pointer-events':'all',class:'hit'}));
 g.addEventListener('pointerenter',()=>setAim(o.id));g.addEventListener('focus',()=>{setAim(o.id);pointAt(o.id)});g.addEventListener('click',()=>{if(performance.now()<suppressClickUntil)return;setAim(o.id);pointAt(o.id);interact()});g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setAim(o.id);pointAt(o.id);interact()}});
 }
 $('objects').append(g);
 });trailMarker();$('carriedEgg').toggleAttribute('hidden',!game.inventory.egg);$('hands').style.filter=['none','hue-rotate(30deg)','hue-rotate(-15deg)'][game.species];
 if(game.aim&&!document.querySelector('[data-object="'+game.aim+'"]'))game.aim=null;
 renderHint();dirty=false;
}
function drawRay(x,y){$('ray').setAttribute('d','M415 '+(H-23)+'L'+x+' '+y);$('reticle').setAttribute('cx',x);$('reticle').setAttribute('cy',y);}
function pointAt(id){const o=elements.find(o=>o.id===id),p=position(o),q=projectPoint(p.x,p.z);drawRay(q.x,q.y-o.height*q.scale*.55);}
function setAim(id){game.aim=id;document.querySelectorAll('.object').forEach(n=>n.classList.toggle('aimed',n.dataset.object===id));renderHint();}
function renderHint(){let message='Point at a discovery · drag to turn';if(game.aim){const o=elements.find(o=>o.id===game.aim),d=distance(o.id);message=o.name+' · '+d.toFixed(1)+' m · '+(lineBlocked(o)?'A passage blocks the way':d>tuning.reach?'Walk closer':'Click / tap / E');}
 $('targetHint').textContent=message;$('interact').disabled=paused()||!game.aim||distance(game.aim)>tuning.reach||lineBlocked(elements.find(o=>o.id===game.aim));}
function notify(text){clearTimeout(noticeTimer);$('notice').textContent=text;$('notice').hidden=false;noticeTimer=setTimeout(()=>$('notice').hidden=true,2800);}
function d(id,label,kind,description,effect,requires=()=>'',repeat=false){return {id,label,kind,description,effect,requires,repeat};}
const decisions={
 tree:[
 d('gather','Gather 2 fruit','gather','Carry food for offerings and friendship.',()=>game.inventory.fruit+=2),
 d('study','Study the bark','study','Discover a clue for the carved stones.',()=>game.flags.barkClue=true),
 d('offer','Leave a food offering','care','Use 1 fruit. Earn trust with the young dinosaur.',()=>{game.inventory.fruit--;game.trust++},()=>game.inventory.fruit?'':'Needs 1 fruit')
 ],
 spring:[
 d('drink','Drink from the spring','health','Restore health once.',()=>{},()=>'',true),
 d('fill','Fill your leaf cup','gather','Collect water in a crafted cup.',()=>game.inventory.water=1,()=>!game.inventory.cup?'Needs a leaf cup':game.inventory.water?'Your cup is already full':'',true),
 d('clear','Clear the debris','build','Open the shallow crossing at the center of the creek.',()=>game.flags.ford=true)
 ],
 log:[
 d('roll','Roll it into a bridge','build','Make the western crossing. The log stays usable.',()=>game.flags.bridge=true),
 d('branches','Collect 2 loose branches','gather','Take loose wood without destroying the bridge.',()=>game.inventory.branches+=2),
 d('egg','Search underneath','gather','Find a lost egg to carry to the nest.',()=>game.inventory.egg=1)
 ],
 stones:[
 d('inspect','Inspect the carvings','study','Study the ring. A pattern elsewhere may explain it.',()=>game.flags.stoneRead=true),
 d('align','Align the carved stones','study','Use a clue to reveal a hidden entrance into the hollow.',()=>game.flags.hidden=true,()=>game.flags.barkClue||game.flags.fungusClue?'':'Needs the bark or mushroom clue'),
 d('stack','Stack stepping stones','build','Create the eastern creek crossing.',()=>game.flags.steps=true)
 ],
 ferns:[
 d('gather','Gather 3 fronds','gather','Enough for a cup, nest lining, and mulch.',()=>game.inventory.fronds+=3),
 d('cup','Fold a leaf cup','gather','Use 1 frond. Keep the cup when its water is used.',()=>{game.inventory.fronds--;game.inventory.cup=1},()=>game.inventory.fronds?'':'Needs 1 frond'),
 d('rest','Rest in cover','health','Restore health once; revisit to rest without extra rewards.',()=>{},()=>'',true)
 ],
 companion:[
 d('feed','Offer a fruit','care','Use 1 fruit to earn trust.',()=>{game.inventory.fruit--;game.trust++},()=>game.inventory.fruit?'':'Needs 1 fruit'),
 d('play','Play gently','play','Gain fun and trust once. Further play is just for fun.',()=>game.trust++,()=>'',true),
 d('invite','Invite it to follow','care','A trusting companion can help with the root arch.',()=>{game.joined=true;game.companion.planAt=0},()=>game.trust>=1?'':'Earn trust through food or play first')
 ],
 nest:[
 d('inspect','Inspect the tracks','study','The guardian is missing an egg. Look under the log.',()=>game.flags.nestRead=true),
 d('line','Line the nest','care','Use 1 frond to make a soft resting place.',()=>{game.inventory.fronds--;game.flags.linedNest=true},()=>game.inventory.fronds?'':'Needs 1 frond'),
 d('return','Return the lost egg','care','Place the egg in the nest and reunite it with its home.',()=>{game.inventory.egg=0;game.flags.returnedEgg=true},()=>game.inventory.egg?'':'Find the lost egg under the log')
 ],
 fungi:[
 d('study','Study their pattern','study','Discover an alternative clue for the stone ring.',()=>game.flags.fungusClue=true),
 d('gather','Gather glow spores','gather','Collect 1 bundle for a visible trail.',()=>game.inventory.spores=1),
 d('light','Mark a glowing trail','build','Use 1 bundle to mark the path to the root hollow.',()=>{game.inventory.spores--;game.flags.glowTrail=true},()=>game.inventory.spores?'':'Needs 1 spore bundle')
 ],
 roots:[
 d('inspect','Inspect the blockage','study','Branches offer leverage; a friend offers another solution.',()=>game.flags.rootsRead=true),
 d('pry','Pry with a branch','build','Use 1 branch to open the arch.',()=>{game.inventory.branches--;game.flags.roots=true},()=>game.flags.roots?'The arch is already open':game.inventory.branches?'':'Needs 1 branch'),
 d('help','Ask your companion','care','Open the arch together without spending a branch.',()=>game.flags.roots=true,()=>game.flags.roots?'The arch is already open':!game.joined?'Invite the young dinosaur first':Math.hypot(game.companion.x+14,game.companion.z+5.5)>5?'Wait for your companion to catch up':'')
 ],
 sapling:[
 d('inspect','Inspect the soil','study','This patch needs water and ground cover.',()=>game.flags.saplingRead=true),
 d('water','Water the roots','care','Use the water in your cup; revive the leaves.',()=>{game.inventory.water=0;game.flags.saplingWatered=true},()=>game.inventory.water?'':'Fill a leaf cup at the spring'),
 d('mulch','Mulch the ground','care','Use 1 frond to cover and improve the soil.',()=>{game.inventory.fronds--;game.flags.saplingMulched=true},()=>game.inventory.fronds?'':'Needs 1 frond')
 ]
};
function availability(o,choice){const key=o.id+'.'+choice.id,used=game.done.has(key);if(used&&!choice.repeat)return {ok:false,reason:'Already completed'};const reason=choice.requires();return {ok:!reason,reason:reason||(used?(choice.id==='fill'?'Refill your empty cup.':'Replay · no extra stat or trust reward'):choice.description)};}
function interact(){if(!game.started||game.debugOpen||game.mapOpen||game.selected||!game.aim)return;const o=elements.find(o=>o.id===game.aim);if(distance(o.id)>tuning.reach){notify('Walk closer to '+o.name.toLowerCase()+'.');return}if(lineBlocked(o)){notify('Find a route around the blocked passage.');return}
 clearMovement();game.selected=o.id;game.discovered.add(o.id);feedback='';$('leafMap').hidden=true;$('actionPanel').hidden=false;renderDecisions();renderHUD();$('closeAction').focus();
}
function renderDecisions(){if(!game.selected)return;const o=elements.find(o=>o.id===game.selected);$('objectTag').textContent='DISCOVERY '+(elements.indexOf(o)+1)+' / 10';$('objectTitle').textContent=o.name;$('decisionList').replaceChildren();decisions[o.id].forEach((choice,i)=>{const status=availability(o,choice),b=document.createElement('button');b.className='decision';b.dataset.decision=choice.id;b.disabled=!status.ok;const title=document.createElement('b'),small=document.createElement('small');title.textContent=choice.label;small.textContent=status.reason;b.append(title,small);b.onclick=()=>applyAction(o.id,i);$('decisionList').append(b)});$('actionFeedback').textContent=feedback;}
function applyAction(id,index){if(game.selected!==id)return false;const o=elements.find(o=>o.id===id),choice=decisions[id]?.[index];if(!choice||distance(id)>tuning.reach||lineBlocked(o))return false;const status=availability(o,choice);if(!status.ok)return false;const key=id+'.'+choice.id,used=game.done.has(key);
 // Replaying a rest or game never repeats its trust or stat effect.
 if(!used||choice.id==='fill')choice.effect();
 let gain=0,stat=null;const rewards={study:['knowledge',5],build:['strength',5],care:['empathy',5],play:['fun',10],health:['health',15]};
 if(!used&&rewards[choice.kind]){const [name,base]=rewards[choice.kind];stat=name;const before=game.stats[name];game.stats[name]=clamp(Math.round((before+base*tuning.reward)*100)/100,0,100);gain=Math.round((game.stats[name]-before)*100)/100;}
 game.trust=clamp(game.trust,0,3);game.done.add(key);
 if(!used)game.journal.push({key,label:choice.label,object:o.name,stat,gain});
 feedback=(used&&choice.id!=='fill'?'A quiet moment. No extra reward.':choice.label+' — '+choice.description)+(gain?' +'+number(gain)+' '+stat+'.':'');
 if(id==='sapling'&&choice.id==='water')feedback='Fresh green leaves open. The sapling is recovering. +'+number(gain)+' empathy.';
 if(id==='nest'&&choice.id==='return')feedback='The egg settles into its nest. A distant guardian answers. +'+number(gain)+' empathy.';
 game.companion.planAt=0;renderWorld();renderDecisions();renderHUD();animateAction(id,choice.id);return true;
}
function animateAction(id,action){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;let target,values;if(action==='play'){target=document.querySelector('[data-object="companion"] > g');values='0 0;0 -25;0 0;0 -12;0 0'}else if(action==='rest'){target=$('hands');values='0 0;0 15;0 15;0 0'}else return;if(!target)return;const animation=node('animateTransform',{attributeName:'transform',type:'translate',additive:'sum',values,dur:'.65s',repeatCount:1});target.append(animation);animation.addEventListener('endEvent',()=>animation.remove(),{once:true});animation.beginElement();}
function closeAction(){game.selected=null;$('actionPanel').hidden=true;$('leafMap').hidden=false;renderHint();clearMovement();}
$('closeAction').onclick=closeAction;$('interact').onclick=interact;
function suggestion(){const i=game.inventory,f=game.flags;if(i.egg&&!f.returnedEgg)return 'The lost egg belongs in the nest across the creek.';if(i.fronds&&!i.cup)return 'A frond can become a cup at the fern patch.';if(i.water&&!f.saplingWatered)return 'A thirsty sapling waits beyond the roots.';if(game.trust&&!game.joined)return 'The young dinosaur may be ready to follow.';if(i.cup&&!i.water&&!f.saplingWatered)return 'Fill your leaf cup at the forest spring.';if(!f.bridge&&!f.ford&&!f.steps)return 'Find a way over the creek: log, stones, or clear water.';if(!f.roots&&!f.hidden)return 'A branch, a friend, or a clue can open the hollow.';return 'Keep exploring. There is no required ending.';}
function renderMap(){const m=$('miniMap');m.replaceChildren();m.append(node('rect',{x:-18,y:-14,width:36,height:28,fill:'#c8d9aa',stroke:'#75945d','stroke-width':.4}));m.append(node('rect',{x:-18,y:-1.3,width:36,height:2.6,fill:'#8fc7ca'}));for(const [flag,x] of [['bridge',-9],['ford',0],['steps',8]])if(game.flags[flag])m.append(node('rect',{x:x-1.2,y:-1.6,width:2.4,height:3.2,fill:'#b69864'}));for(const s of wallSegments())m.append(node('line',{x1:s[0],y1:s[1],x2:s[2],y2:s[3],stroke:'#85734e','stroke-width':.65}));for(const o of elements){const p=position(o),c=node('circle',{cx:p.x,cy:p.z,r:game.discovered.has(o.id)?.65:.4,fill:game.discovered.has(o.id)?'#536e48':'#a1b488'});const title=node('title');title.textContent=o.name;c.append(title);m.append(c);}const p=game.camera;m.append(node('circle',{cx:p.x,cy:p.z,r:.8,fill:'#c5894e'}));m.append(node('line',{x1:p.x,y1:p.z,x2:p.x+Math.sin(p.yaw)*2,y2:p.z-Math.cos(p.yaw)*2,stroke:'#7d633b','stroke-width':.4}));}
function renderHUD(){const zone=game.camera.z>1.4?'Starting glade':game.camera.x< -11&&game.camera.z< -6?'Root hollow':'Nesting grove';$('zoneLabel').textContent=Math.abs(game.camera.z)<2?'Creek bank':zone;$('discoveryCount').textContent=game.discovered.size+' / 10';$('suggestion').textContent=suggestion();$('speciesLabel').textContent='Young '+roster[game.species]+' · '+game.done.size+' / 30 actions';
 $('stats').innerHTML=statKeys.map(k=>'<div><b>'+number(game.stats[k])+'</b><span>'+k+'</span></div>').join('');
 $('inventory').innerHTML=Object.entries(itemNames).map(([key,name])=>'<span class="item-token '+(!game.inventory[key]?'empty':'')+'">'+name+' '+game.inventory[key]+'</span>').join('');
 $('mapDetails').hidden=!game.mapOpen;$('leafMap').classList.toggle('expanded',game.mapOpen);$('inventoryToggle').setAttribute('aria-expanded',String(game.mapOpen));
 if(game.mapOpen){renderMap();$('journalSummary').replaceChildren();const p=document.createElement('div');p.className='journal-mini';p.textContent=game.journal.slice(-5).map(r=>r.object+': '+r.label).join(' · ')||'Your choices will leave a trace here.';$('journalSummary').append(p);}
 $('debugToggle').setAttribute('aria-expanded',String(game.debugOpen));document.querySelectorAll('[data-move]').forEach(b=>b.disabled=paused());renderHint();renderDebug();
}
function showSpecies(){const descriptions=['A sturdy young explorer.','A curious young explorer.','An alert young explorer.'];$('speciesOptions').innerHTML=roster.map((name,i)=>'<button class="species-card '+(game.species===i?'selected':'')+'" data-species="'+i+'" aria-pressed="'+(game.species===i)+'"><span><strong>'+name+'</strong><small>'+descriptions[i]+'</small></span><span>'+(game.species===i?'Selected':'Choose')+'</span></button>').join('');}
$('speciesOptions').onclick=e=>{const b=e.target.closest('[data-species]');if(b){game.species=+b.dataset.species;showSpecies();dirty=true;renderWorld()}};
$('startGame').onclick=()=>{game.started=true;$('startScreen').hidden=true;clearMovement();renderHUD();renderWorld();};
function resetProgress(keepStarted=true){const selected=game.species,debug=game.debugOpen;clearMovement();Object.assign(game,newProgress(),{species:selected,started:keepStarted,selected:null,mapOpen:false,aim:null,debugOpen:keepStarted&&debug});feedback='';$('actionPanel').hidden=true;$('leafMap').hidden=false;$('startScreen').hidden=keepStarted;$('debugPanel').hidden=!game.debugOpen;clearTimeout(noticeTimer);$('notice').hidden=true;showSpecies();renderHUD();renderWorld();}
$('restart').onclick=()=>{if(confirm('Restart your forest journey? Current choices and items will be cleared.'))resetProgress(false)};
function toggleInventory(){if(!game.started||game.debugOpen)return;clearMovement();if(game.selected)closeAction();game.mapOpen=!game.mapOpen;renderHUD();}
$('inventoryToggle').onclick=toggleInventory;
function toggleDebug(force){if(!game.started)return;const open=typeof force==='boolean'?force:!game.debugOpen;clearMovement();if(open){closeAction();game.mapOpen=false;}game.debugOpen=open;$('debugPanel').hidden=!open;$('debugToggle').setAttribute('aria-expanded',String(open));renderHUD();if(open)$('closeDebug').focus();}
$('debugToggle').onclick=()=>toggleDebug();$('closeDebug').onclick=()=>toggleDebug(false);
function tune(key,value){const ranges={speed:[.5,10],reach:[1,12],reward:[0,3]};if(!Number.isFinite(+value))return;tuning[key]=clamp(+value,...ranges[key]);renderHUD();if(game.selected)renderDecisions();}
for(const [id,key] of [['tuneSpeed','speed'],['tuneReach','reach'],['tuneReward','reward']])$(id).addEventListener('input',e=>tune(key,e.target.value));
$('debugObject').innerHTML=elements.map(o=>'<option value="'+o.id+'">'+o.name+'</option>').join('');
function jumpTo(id){const o=elements.find(o=>o.id===id);if(!o)return false;const p=position(o);for(const radius of [2.2,3,4])for(let a=0;a<Math.PI*2;a+=Math.PI/12){const x=p.x+Math.sin(a)*radius,z=p.z+Math.cos(a)*radius;if(!canStand(x,z))continue;const before=game.camera;game.camera={x,z,yaw:Math.atan2(p.x-x,z-p.z)};if(lineBlocked(o)){game.camera=before;continue}game.aim=id;renderHUD();renderWorld();pointAt(id);return true;}notify('No safe position beside this object.');return false;}
$('debugJump').onclick=()=>jumpTo($('debugObject').value);
$('debugItems').onclick=()=>{for(const [k,v] of Object.entries({fruit:2,fronds:3,branches:2,cup:1,water:1,spores:1,egg:1}))game.inventory[k]=Math.max(game.inventory[k],v);renderHUD();renderWorld();};
$('debugUnlock').onclick=()=>{Object.assign(game.flags,{bridge:true,ford:true,steps:true,roots:true,hidden:true});game.companion.planAt=0;renderHUD();renderWorld();};
$('debugReset').onclick=()=>resetProgress(true);
$('debugDefaults').onclick=()=>{Object.assign(tuning,DEFAULT_TUNING);renderHUD()};
function renderDebug(){for(const [key,id] of [['speed','tuneSpeed'],['reach','tuneReach'],['reward','tuneReward']])$(id).value=tuning[key];$('speedValue').textContent=number(tuning.speed);$('reachValue').textContent=number(tuning.reach);$('rewardValue').textContent=number(tuning.reward)+'×';
 if(!game.debugOpen)return;$('debugState').textContent=JSON.stringify({position:{x:+game.camera.x.toFixed(2),z:+game.camera.z.toFixed(2),facingDegrees:+(game.camera.yaw*180/Math.PI).toFixed(1)},target:game.aim,distance:game.aim?+distance(game.aim).toFixed(2):null,stats:game.stats,inventory:game.inventory,trust:game.trust,companionFollowing:game.joined,worldFlags:game.flags,completedActions:[...game.done],discoveries:[...game.discovered]},null,2);
}
let suppressClickUntil=0;
$('scene').addEventListener('pointerdown',e=>{if(paused()||e.button>0)return;drag={id:e.pointerId,x:e.clientX,lastX:e.clientX,y:e.clientY,moved:false};});
$('scene').addEventListener('pointermove',e=>{if(paused())return;if(drag&&e.pointerId===drag.id){const delta=e.clientX-drag.x;if(drag.moved||Math.abs(delta)>6||Math.abs(e.clientY-drag.y)>6){drag.moved=true;const dx=e.clientX-drag.lastX;game.camera.yaw=(game.camera.yaw+dx*.006)%(Math.PI*2);$('scene').classList.add('dragging');setAim(null);dirty=true;}drag.lastX=e.clientX;if(drag.moved)return;}
 const p=new DOMPoint(e.clientX,e.clientY).matrixTransform($('scene').getScreenCTM().inverse());drawRay(p.x,p.y);setAim(e.target.closest('[data-object]')?.dataset.object||null);});
function endDrag(){if(drag?.moved)suppressClickUntil=performance.now()+150;drag=null;$('scene').classList.remove('dragging');}
addEventListener('pointerup',()=>{endDrag();clearMovement()});addEventListener('pointercancel',()=>{endDrag();clearMovement()});
document.querySelectorAll('[data-move]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();if(b.disabled)return;b.setPointerCapture(e.pointerId);held.add(b.dataset.move);b.classList.add('pressed');move(b.dataset.move,.35);};b.onpointerup=clearMovement;b.onpointercancel=clearMovement;b.onlostpointercapture=clearMovement;b.onclick=e=>{if(e.detail===0)move(b.dataset.move,.6)};});
const moveKeys={w:'forward',a:'left',s:'back',d:'right',ArrowUp:'forward',ArrowDown:'back',ArrowLeft:'left',ArrowRight:'right'};
addEventListener('keydown',e=>{if(e.key==='F2'){e.preventDefault();toggleDebug();return}if(e.key==='Escape'){clearMovement();if(game.debugOpen)toggleDebug(false);else if(game.selected)closeAction();else if(game.mapOpen)toggleInventory();return}if(e.target.matches('input,select,textarea,button')){if(e.key==='Tab'&&!game.started){return}if(e.target.matches('input,select,textarea'))return;}
 if(!game.started)return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(k==='i'&&!e.repeat){e.preventDefault();toggleInventory();return}if(k==='e'&&!e.repeat){e.preventDefault();interact();return}if(!paused()&&moveKeys[k]){e.preventDefault();held.add(moveKeys[k]);document.querySelector('[data-move="'+moveKeys[k]+'"]').classList.add('pressed');}if(!paused()&&(k==='q'||k==='r')){e.preventDefault();game.camera.yaw+=(k==='q'?-1:1)*.09;dirty=true;}});
addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(moveKeys[k]){held.delete(moveKeys[k]);document.querySelector('[data-move="'+moveKeys[k]+'"]').classList.remove('pressed')}});
addEventListener('blur',()=>{clearMovement();endDrag()});document.addEventListener('visibilitychange',()=>{clearMovement();endDrag()});
function companionPath(){const c=game.companion,start={x:Math.round(c.x),z:Math.round(c.z)},goal={x:Math.round(game.camera.x),z:Math.round(game.camera.z)};const key=p=>p.x+','+p.z;const queue=[start],seen=new Map([[key(start),null]]);let found=null,best=start,bestDist=Infinity;
 for(let i=0;i<queue.length&&i<1200;i++){const p=queue[i],dist=Math.hypot(p.x-goal.x,p.z-goal.z);if(dist<bestDist){best=p;bestDist=dist}if(dist<1.5){found=p;break}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,z:p.z+dz},k=key(n);if(seen.has(k)||!canStand(n.x,n.z))continue;seen.set(k,p);queue.push(n);}}
 const path=[];let p=found||best;while(p&&key(p)!==key(start)){path.push(p);p=seen.get(key(p));}return path.reverse();
}
function updateCompanion(dt){if(!game.joined||paused())return false;const c=game.companion;if(Math.hypot(c.x-game.camera.x,c.z-game.camera.z)<2.8){c.path=[];return false}
 if(worldTime>=c.planAt||!c.path.length){c.path=companionPath();c.planAt=worldTime+.8}const next=c.path[0];if(!next)return false;const dx=next.x-c.x,dz=next.z-c.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*3);if(d<.08){c.path.shift();return false}const x=c.x+dx/d*step,z=c.z+dz/d*step;if(canStand(x,z)){c.x=x;c.z=z;return true}c.path=[];return false;
}
let lastHUD=0;
function animate(time){const dt=Math.min(.05,(time-lastTime)/1000||0);lastTime=time;if(!paused()){worldTime+=dt;const amount=tuning.speed*dt/Math.sqrt(Math.max(1,held.size));for(const direction of held)move(direction,amount);if(updateCompanion(dt))dirty=true;}
 if(dirty&&time-lastDraw>30){renderWorld();lastDraw=time;}if(time-lastHUD>220){renderHUD();lastHUD=time;}requestAnimationFrame(animate);
}
showSpecies();renderHUD();fit();requestAnimationFrame(animate);
window.Dino={game,tuning,elements,decisions,move,canStand,wallSegments,lineBlocked,applyAction,interact,closeAction,jumpTo,toggleDebug,resetProgress,tune,renderWorld,renderHUD,companionPath,updateCompanion,position,distance};
