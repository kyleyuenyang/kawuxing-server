import {createIcons,Menu,X,Settings,RotateCcw,BookOpen,History,FlaskConical,Download,ArrowRight,Volume2,Maximize} from 'lucide';
import {names,tileName} from './engine.js';
import {gameTable} from './game-table.js';
import {mountScene,resizeScene} from './table-scene.js';
import {animateOpeningHand} from './deal-animation.js';
import {resultHTML} from './settlement.js';
const icons={Menu,X,Settings,RotateCcw,BookOpen,History,FlaskConical,Download,ArrowRight,Volume2,Maximize};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico=n=>`<i data-lucide="${n}"></i>`;
const tile=(t,cls='',attrs='')=>`<button class="tile ${cls}" ${attrs}><img src="assets/${t}.svg" alt="${esc(tileName(t))}"></button>`;
let credentials;try{credentials=JSON.parse(localStorage.getItem('kwx-online'));}catch{}
let state,selected=-1,liang=false,busy=false,shownRound=0,animating=false,polling=false,watchSeat=0;
let endpoint=localStorage.getItem('kwx-server')||'';
function notice(s){document.querySelector('#toast').textContent=s;document.querySelector('#toast').classList.add('visible');setTimeout(()=>document.querySelector('#toast').classList.remove('visible'),4000);}
async function api(path,body){const res=await fetch(endpoint+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(credentials?{Authorization:'Bearer '+credentials.token}:{})},body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok)throw Error(data.error||'连接失败');return data;}
function home(){document.querySelector('#app').innerHTML=`<section class="session-screen"><h1>好友卡五星</h1><h2>好友联机</h2><form id="entry"><label>昵称<input name="name" maxlength="12" required></label><label>人数<select name="size"><option value="3">三人</option><option value="4">四人轮换</option></select></label><label>局数<select name="limit"><option>16</option><option>24</option><option>32</option></select></label><label>封顶<select name="cap"><option>32</option><option>16</option><option value="0">无封顶</option></select></label><label>房间号<input name="code" inputmode="numeric" maxlength="6"></label><label>服务器地址<input name="endpoint" type="url" placeholder="同一服务器打开时留空" value="${esc(endpoint)}"></label><button name="join" value="create">建房</button><button name="join" value="join">加入</button></form></section>`;
 document.querySelector('#entry').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;try{const f=new FormData(e.target),value=String(f.get('endpoint')).trim();if(value&&!/^https?:\/\//.test(value))throw Error('服务器地址无效');endpoint=value.replace(/\/$/,'');localStorage.setItem('kwx-server',endpoint);credentials=null;const data=await api(e.submitter.value==='create'?'/api/create':'/api/join',Object.fromEntries(f));credentials={code:data.code,token:data.token};localStorage.setItem('kwx-online',JSON.stringify(credentials));state=data;render();}catch(e){notice(e.message);}finally{busy=false;}};
}
function layout(){const el=document.querySelector('#arena');if(!el)return;const portrait=innerHeight>innerWidth,w=portrait?innerHeight:innerWidth,h=portrait?innerWidth:innerHeight,scale=h/720,width=Math.max(1100,w/scale);el.style.width=width+'px';el.style.transform=`translate(-50%,-50%) rotate(${portrait?90:0}deg) scale(${Math.min(scale,w/width)})`;resizeScene();}
window.addEventListener('resize',layout);
function render(){if(!state)return home();state.members.forEach((m,i)=>names[i]=m.name);const g=state.game;document.body.classList.toggle('playing',!!g&&!state.complete);
 if(!g){document.querySelector('#app').innerHTML=`<section class="session-screen"><h1>房间 ${state.code}</h1><h2>${state.limit}局 · ${state.size}人</h2><div class="ready-seats">${Array.from({length:state.size},(_,i)=>`<div class="ready-player"><img src="assets/avatar-${i}.svg" alt=""><strong>${esc(state.members[i]?.name||'等待加入')}</strong><span>${state.members[i]?.ready?'已准备':'未准备'}</span></div>`).join('')}</div><button data-ready> ${state.members[state.id].ready?'取消准备':'准备'}</button><button data-exit>退出</button></section>`;document.querySelector('[data-ready]').onclick=()=>send({type:'ready'});}
 else if(state.complete){document.querySelector('#app').innerHTML=`<section class="session-screen"><h1>整场结算 · ${state.code}</h1>${g.totals.slice(0,state.size).map((v,i)=>`<p>${esc(names[i])}：${v}分</p>`).join('')}${g.history.map(h=>`<details><summary>第${h.round}局</summary>${resultHTML(h,h.seats)}</details>`).join('')}<button data-exit>返回大厅</button></section>`;}
 else{
  const spectator=state.seat<0,view=spectator?watchSeat:state.seat;
  document.querySelector('#app').innerHTML=gameTable(g,view,selected,spectator,false,false,tile,ico,resultHTML,liang);layout();mountScene(document.querySelector('#scene-host'),g,view,spectator);
  if(spectator){document.querySelector('#arena').insertAdjacentHTML('beforeend',`<nav class="spectator-switch" aria-label="观战视角">${g.players.map((p,i)=>`<button data-watch="${i}" aria-pressed="${view===i}">${esc(names[p.id])}</button>`).join('')}</nav>`);document.querySelectorAll('[data-watch]').forEach(b=>b.onclick=()=>{watchSeat=+b.dataset.watch;selected=-1;liang=false;render();});document.querySelector('.current-status').textContent='观战 · '+names[g.players[view].id];document.querySelectorAll('.game-actions button, [data-choice], [data-tile-index]').forEach(b=>b.disabled=true);}
  document.querySelector('.game-title small').textContent=`房间 ${state.code} · ${g.round}/${state.limit}局`;
  document.querySelectorAll('[data-seat]').forEach(b=>b.disabled=true);
  document.querySelectorAll('[data-tile-index]').forEach(b=>{b.onclick=()=>{if(animating||spectator)return;selected=+b.dataset.tileIndex;render();};b.oncontextmenu=e=>{e.preventDefault();if(animating||spectator||g.phase!=='discard'||g.turn!==state.seat)return;const index=+b.dataset.tileIndex;if(b.dataset.discardAllowed!=='true'){notice('这张牌当前不能出');return;}send({type:'discard',index,reveal:false});};});
  document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>send({type:'respond',choice:b.dataset.choice}));
  document.querySelectorAll('[data-kong-tile]').forEach(b=>b.onclick=()=>send({type:'kong',tile:b.dataset.kongTile,kind:b.dataset.kongKind}));
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.action;if(a==='discard'||a==='liang-confirm')send({type:'discard',index:selected,reveal:a==='liang-confirm'});else if(a==='win')send({type:'win'});else if(a==='next')send({type:'next'});else if(a==='liang'){liang=true;render();}else if(a==='liang-cancel'){liang=false;render();}else if(a==='menu')document.querySelector('#game-menu').showModal();else if(a==='menu-close')document.querySelector('#game-menu').close();else if(a==='fullscreen')document.documentElement.requestFullscreen?.();});
  document.querySelectorAll('[data-nav], [data-action="settings"], [data-action="undo"], [data-action="export"], .reveal-option, [data-action="sound"]').forEach(b=>b.remove());
  if(g.phase==='ended')document.querySelectorAll('[data-action="next"]').forEach(b=>{b.textContent=state.nextReady.includes(state.id)?'已准备，等待其他玩家':'准备下一局';b.disabled=state.nextReady.includes(state.id);});
  if(shownRound!==g.round){shownRound=g.round;if(g.wall.length===44&&g.players.every(p=>!p.river.length&&!p.melds.length)){animating=true;document.querySelectorAll('.game-actions button').forEach(b=>b.disabled=true);animateOpeningHand(g,view,()=>{animating=false;render();});}}
 }
 createIcons({icons});document.querySelector('[data-exit]')?.addEventListener('click',()=>{credentials=null;state=null;localStorage.removeItem('kwx-online');home();});
}
async function send(body){if(busy||animating)return;busy=true;try{state=await api('/api/action',{...body,code:credentials.code,version:state.version});selected=-1;liang=false;render();}catch(e){notice(e.message);await refresh();}finally{busy=false;}}
async function refresh(){if(!credentials||polling)return;polling=true;try{const next=await api('/api/room?code='+credentials.code);if(!state||next.version!==state.version){state=next;if(!animating)render();}}catch(e){notice('连接中断：'+e.message);}finally{polling=false;}}
home();if(credentials)refresh();setInterval(refresh,900);
