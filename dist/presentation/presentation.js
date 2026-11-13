'use strict';
const slides=[...document.querySelectorAll('.slide')];
const dots=[...document.querySelectorAll('[data-slide]')];
const previous=document.getElementById('previous'),next=document.getElementById('next');
let current=0,start=null;
function fit(){document.documentElement.style.setProperty('--fit',Math.min(innerWidth/1600,innerHeight/900));}
function show(index,updateHash=true){
 current=Math.max(0,Math.min(slides.length-1,index));
 slides.forEach((slide,i)=>{slide.hidden=i!==current;slide.inert=i!==current;});
 dots.forEach((dot,i)=>{if(i===current)dot.setAttribute('aria-current','step');else dot.removeAttribute('aria-current');});
 previous.disabled=current===0;next.disabled=current===slides.length-1;
 document.getElementById('counter').value=String(current+1).padStart(2,'0')+' / 04';
 if(updateHash)history.replaceState(null,'','#'+(current+1));
}
function fromHash(){const value=Number(location.hash.slice(1));show(Number.isInteger(value)&&value>=1&&value<=4?value-1:0,false);}
previous.addEventListener('click',()=>show(current-1));next.addEventListener('click',()=>show(current+1));
dots.forEach(dot=>dot.addEventListener('click',()=>show(Number(dot.dataset.slide))));
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{document.getElementById('fullscreen').title='Fullscreen is unavailable in this browser';}}
document.getElementById('fullscreen').addEventListener('click',fullscreen);
document.addEventListener('fullscreenchange',()=>{document.getElementById('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit fullscreen':'Enter fullscreen');fit();});
addEventListener('keydown',event=>{
 if(event.altKey||event.ctrlKey||event.metaKey||event.target.matches('input,textarea,select'))return;
 if((event.key===' '||event.key==='Enter')&&event.target.closest('button,a'))return;
 if(['ArrowRight','ArrowDown','PageDown',' '].includes(event.key)){event.preventDefault();show(current+1);}
 if(['ArrowLeft','ArrowUp','PageUp'].includes(event.key)){event.preventDefault();show(current-1);}
 if(event.key==='Home'){event.preventDefault();show(0);}if(event.key==='End'){event.preventDefault();show(3);}
 if(event.key.toLowerCase()==='f')fullscreen();
});
document.getElementById('deck').addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'&&!event.target.closest('a,button'))start={x:event.clientX,y:event.clientY,id:event.pointerId};});
addEventListener('pointerup',event=>{if(!start||event.pointerId!==start.id)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;start=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)show(current+(dx<0?1:-1));});
addEventListener('pointercancel',()=>start=null);addEventListener('resize',fit);addEventListener('hashchange',fromHash);fit();fromHash();
// Reuse the game's original vector artwork, without loading or changing game state.
fetch('assets/forest-art.svg').then(r=>{if(!r.ok)throw Error('Missing artwork');return r.text();}).then(text=>{
 const source=new DOMParser().parseFromString(text,'image/svg+xml').querySelector('defs');
 if(!source)throw Error('Invalid artwork');document.querySelector('.symbol-library').append(document.importNode(source,true));
 const scale={treeDrawing:.23,springDrawing:.28,logDrawing:.27,stonesDrawing:.31,fernPatchDrawing:.28,companionDrawing:.32,nestDrawing:.3,fungiDrawing:.32,rootsDrawing:.29,saplingDrawing:.31};
 document.querySelectorAll('[data-map-art]').forEach(group=>{const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#'+group.dataset.mapArt);use.setAttribute('transform','scale('+scale[group.dataset.mapArt]+')');group.append(use);});
}).catch(()=>{document.querySelectorAll('[data-map-art]').forEach(group=>{const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('r','14');circle.setAttribute('fill','#77965b');group.append(circle);});});
