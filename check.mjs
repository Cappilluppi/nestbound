import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync('dist/index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function element(){return {innerHTML:'',textContent:'',style:{},dataset:{},disabled:false,classList:{toggle(){}},setAttribute(){},removeAttribute(){},replaceChildren(){},append(){},addEventListener(){},showModal(){},close(){}};}
let runs=0;
for(let species=0;species<3;species++)for(let a=0;a<3;a++)for(let b=0;b<3;b++)for(let c=0;c<3;c++){
 const els=new Map();const steps=Array.from({length:4},element);const places=Array.from({length:3},(_,i)=>Object.assign(element(),{dataset:{place:String(i)}}));
 const context=vm.createContext({document:{getElementById(id){if(!els.has(id))els.set(id,element());return els.get(id)},querySelectorAll(q){return q==='.step'?steps:places},createElement:element}});
 vm.runInContext(script,context);
 const run=code=>vm.runInContext(code,context);
 run(`selected=${species};render()`);
 for(const choice of [a,b,c]){
  assert.equal(run('stage'),0);const before=run('JSON.stringify(stats)');run('choose(0)');assert.equal(run('JSON.stringify(stats)'),before);
  els.get('actions');run('locked=true;stage=1;render()');run('travel((missions[index].place+1)%3)');assert.equal(run('stage'),1);
  run('travel(missions[index].place)');assert.equal(run('stage'),2);run(`choose(${choice})`);assert.equal(run('stage'),3);
  const after=run('JSON.stringify(stats)');run('choose(0)');assert.equal(run('JSON.stringify(stats)'),after);
  assert.match(els.get('missionContent').innerHTML,/LASTING EFFECT/);assert.equal(run('stats.every(v=>v>=0&&v<=100)'),true);
  if(run('index')<2)run('index++;stage=0;chosen=null;render()');
 }
 assert.equal(run('history.length'),3);assert.match(els.get('journal').innerHTML,/Before the water rises/);
 run('reset()');assert.equal(run('history.length'),0);assert.equal(run('locked'),false);assert.equal(run('stage'),0);runs++;
}
console.log(`PASS: ${runs} full journeys across all species and choice combinations; travel guards, duplicate-choice guards, feedback, journal, stat bounds, and reset.`);
