import Majiang from '@kobalab/majiang-core';

export const TYPES = [...['p','s'].flatMap(s => Array.from({length:9},(_,i)=>s+(i+1))), 'z5','z6','z7'];
export const names = ['阿源','小林','阿慧','阿杰'];
export const tileName = t => t[0]==='z' ? ({z5:'白板',z6:'发财',z7:'红中'}[t]) : t[1]+(t[0]==='p'?'筒':'条');
export const counts = a => a.reduce((o,t)=>(o[t]=(o[t]||0)+1,o),{});
export const sorted = a => [...a].sort((a,b)=>TYPES.indexOf(a)-TYPES.indexOf(b));
export function parseHand(s) {
 if (!/^([ps][1-9]+|z[567]+)+$/.test(s)) throw Error('牌谱只接受 p1-9（筒）、s1-9（条）、z567（白发中）');
 const a=[...s.matchAll(/([psz])(\d+)/g)].flatMap(m=>[...m[2]].map(n=>m[1]+n));
 if(Object.values(counts(a)).some(n=>n>4)) throw Error('同一种牌不能超过4张');
 return a;
}
const meldString = m => m.tile[0]+m.tile[1].repeat(m.kind==='peng'?3:4)+(m.kind==='an'?'':'+');
export function evaluate(hand,melds=[],ctx={}) {
 const all=[...hand,...melds.flatMap(m=>Array(m.kind==='peng'?3:4).fill(m.tile))];
 if(hand.length+melds.length*3!==14 || (ctx.winTile&&!hand.includes(ctx.winTile)) || all.some(t=>!TYPES.includes(t)) || Object.values(counts(all)).some(n=>n>4)) return null;
 const c=counts(hand), qids=!melds.length && Object.values(c).every(n=>n%2===0);
 let decomps=[];
 try {
  const sp=new Majiang.Shoupai(hand); sp._fulou=melds.map(meldString); sp._zimo=ctx.winTile||hand.at(-1);
  decomps=Majiang.Util.hule_mianzi(sp).filter(d=>d.length===5);
 } catch { return null; }
 if(!decomps.length&&!qids) return null;
 const candidates=[];
 for(const dec of [...decomps,...(qids?[null]:[])]) {
  const f=[]; const add=(name,n)=>f.push({name,n});
  if(dec===null) {
   const quads=Object.values(c).filter(n=>n===4).length;
   add(quads===0?'七对':quads===1?'豪七对':quads===2?'双豪七对':'三豪七对（待确认）',quads===0?4:quads===1?8:quads===2?16:32);
  } else {
   const clean=dec.map(x=>x.replace(/[^psz0-9]/g,''));
   if(clean.slice(1).every(x=>new Set(x.slice(1)).size===1)) add('碰碰胡',2);
   if(dec.some(x=>/^[ps]45_!6$/.test(x))) add('卡五星',2);
   const ds=clean.slice(1).filter(x=>/^z([567])\1\1/.test(x)).length;
   if(ds===3) add('大三元',8); else if(ds===2 && /^z([567])\1$/.test(clean[0])) add('小三元',4);
   if(melds.some(m=>m.kind==='peng' && c[m.tile])) add('明四归',2);
   if(Object.values(c).some(n=>n===4)) add('暗四归',4);
   if(melds.length===4 && melds.every(m=>m.kind!=='an')) add('全球人',8);
  }
  const suits=new Set(all.map(t=>t[0]));
  if(suits.size===1&&!suits.has('z')) add('清一色',4);
  if(ctx.liang || ctx.otherLiang) add('亮倒',2);
  if(ctx.gang>0 && ctx.self) add('杠上开花',2);
  if(ctx.gang>1 && ctx.self) add('杠上杠',2);
  if(ctx.sea) add(ctx.self?'海底自摸':'海底放炮',2);
  const raw=f.reduce((v,x)=>v*x.n,1);
  if(!f.length) add('普通胡',1);
  // Ordinary self-draw explicitly requires the winner to reveal.
  const basePatterns=f.filter(x=>!['普通胡','亮倒','杠上开花','杠上杠','海底自摸','海底放炮'].includes(x.name));
  const ordinarySelf=ctx.self && !basePatterns.length && !ctx.liang;
  candidates.push({factors:f,raw,legal:raw>=2&&!ordinarySelf,warning:f.some(x=>x.name.includes('待确认'))?'三豪七对未确认，暂不允许结算':null});
 }
 return candidates.sort((a,b)=>Number(b.legal)-Number(a.legal)||b.raw-a.raw)[0];
}
export function amount(raw,config) {return Math.min(raw,config.cap||Infinity)*config.base;}
export function waits(hand,melds=[],liang=false,minimum=2) {
 const owned=counts([...hand,...melds.flatMap(m=>Array(m.kind==='peng'?3:4).fill(m.tile))]);
 return TYPES.filter(t=>(owned[t]||0)<4).map(t=>({tile:t,score:evaluate([...hand,t],melds,{winTile:t,liang})})).filter(x=>x.score&&x.score.raw>=minimum&&!x.score.warning);
}
// A revealed player's wait stays fixed while their extra drawn tile is in hand.
export function revealedWaits(g,seat) {
 const p=g.players[seat];
 if(!p?.liang)return [];
 const hand=[...p.hand];
 if(hand.length+p.melds.length*3===14){
  if(g.turn!==seat||!g.drawTile)return [];
  const index=hand.lastIndexOf(g.drawTile);
  if(index<0)return [];
  hand.splice(index,1);
 }
 return waits(hand,p.melds,true);
}
export function drawSettlement(players,kongs,config) {
 // Draw readiness is a completed shape, not permission to claim a one-point win.
 const delta=[0,0,0], lines=[], ready=players.map(p=>waits(p.hand,p.melds,p.liang,1));
 const maximum=ready.map(r=>r.reduce((best,x)=>!best||x.score.raw>best.score.raw?x:best,null));
 const explanation=(seat,multiplier)=>{const best=maximum[seat];return `最大听牌 ${tileName(best.tile)}：${best.score.factors.map(f=>`${f.name}×${f.n}`).join(' · ')}${multiplier===2?'，赔付翻倍×2':''}，${best.score.raw*multiplier}倍${config.cap&&best.score.raw*multiplier>config.cap?'，按'+config.cap+'倍封顶':''}`;};
 const yes=ready.map((r,i)=>r.length?i:-1).filter(i=>i>=0), no=[0,1,2].filter(i=>!yes.includes(i));
 const transfer=(a,b,v,why)=>{delta[a]-=v;delta[b]+=v;lines.push({from:a,to:b,amount:v,why});};
 const keepKongs=yes.length>0&&no.length>0;
 if(keepKongs) {
  for(const k of kongs) transfer(k.from,k.to,k.amount,(k.why||'杠分')+' · 保留');
  for(const a of no) for(const b of yes) transfer(a,b,amount(maximum[b].score.raw,config),'未听赔听 · '+explanation(b,1));
 } else if(yes.length===3) {
  for(let a=0;a<3;a++) if(players[a].liang) for(let b=0;b<3;b++) if(!players[b].liang)
   transfer(a,b,amount(maximum[b].score.raw*2,config),'全听：亮倒赔未亮倒 · '+explanation(b,2));
 }
 return {delta,lines,keepKongs,ready:ready.map(r=>r.map(x=>x.tile))};
}
export function winSettlement(players,winners,source,scores,kongs,config) {
 const delta=[0,0,0],lines=[...kongs.map(x=>({...x,why:x.why||'杠分'}))];
 for(const w of winners) for(let a=0;a<3;a++) if(a!==w&&(source===null||source===a)) {
  const score=scores[w][a]; if(!score?.legal||score.warning) throw Error('该结算尚未达到起胡条件');
  lines.push({from:a,to:w,amount:amount(score.raw,config),why:score.factors.map(x=>`${x.name}×${x.n}`).join(' · ')+`，原始${score.raw}倍`});
 }
 for(const l of lines){delta[l.from]-=l.amount;delta[l.to]+=l.amount;}
 return {delta,lines};
}
export function nextSeats(seats,bench,winners,source,lastDraw) {
 const out=[...seats]; let dealer;
 if(!winners.length) dealer=lastDraw;
 else if(winners.length>1) dealer=source;
 else {dealer=winners[0]; if(bench!==null){const old=out[dealer];out[dealer]=bench;bench=old;}}
 return {seats:out,bench,dealer};
}
function shuffle(a) {for(let i=a.length-1;i>0;i--){const n=new Uint32Array(1);crypto.getRandomValues(n);const j=n[0]%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function newGame(config={base:1,cap:32,mode:'bots'},previous=null) {
 const seats=previous?.seats||[0,1,2], dealer=previous?.dealer??0;
 const wall=shuffle(TYPES.flatMap(t=>Array(4).fill(t)));
 const players=seats.map(id=>({id,hand:sorted(wall.splice(0,13)),melds:[],river:[],liang:false}));
 const t=wall.pop();players[dealer].hand.push(t);
 return {config:{...config},seats,bench:previous?.bench??(config.mode==='rotate'?3:null),dealer,players,wall,turn:dealer,lastDraw:dealer,drawTile:t,phase:'discard',pending:null,kongs:[],gangChain:0,round:previous?.round||1,history:previous?.history||[],totals:previous?.totals||[0,0,0,0],log:['新一局开牌'],result:null};
}
export function scoresFor(g,w,source=null) {
 const p=g.players[w],hand=source===null?p.hand:[...p.hand,g.pending.tile];
 return Object.fromEntries([0,1,2].filter(a=>a!==w).map(a=>[a,evaluate(hand,p.melds,{winTile:source===null?g.drawTile:g.pending.tile,liang:p.liang,otherLiang:g.players[a].liang,self:source===null,sea:g.wall.length===0,gang:source===null?g.gangChain:0})]));
}
export function canWin(g,w,source=null) {return Object.entries(scoresFor(g,w,source)).filter(([a])=>source===null||+a===source).every(([,s])=>s?.legal&&!s.warning);}
export function reactionOptions(g,seat){
 if(g.phase!=='react'||seat===g.pending.source||g.pending.responses[seat])return [];
 const p=g.players[seat],n=counts(p.hand)[g.pending.tile]||0,options=[];
 if(canWin(g,seat,g.pending.source))options.push('hu');
 if(!p.liang&&n>=2)options.push('peng');
 if(!p.liang&&n>=3&&g.wall.length)options.push('ming');
 return options;
}
export function autoPass(g){
 if(g.phase!=='react')return;
 for(const seat of [0,1,2]){
  if(g.phase!=='react')break;
  if(seat!==g.pending.source&&!g.pending.responses[seat]&&!reactionOptions(g,seat).length)respond(g,seat,'pass');
 }
}
export function finish(g,winners=[],source=null) {
 if(g.phase==='ended')return;
 const scores=Object.fromEntries(winners.map(w=>[w,scoresFor(g,w,source)]));
 const s=winners.length?winSettlement(g.players,winners,source,scores,g.kongs,g.config):drawSettlement(g.players,g.kongs,g.config);
 const next=nextSeats(g.seats,g.bench,winners,source,g.lastDraw);
 // Freeze before rotating seats or dealing the next round; ron tile stays separate.
 g.result={...s,winners:[...winners],source,next,round:g.round,seats:[...g.seats],
  id:crypto.randomUUID(),endedAt:new Date().toISOString(),config:{...g.config},
  players:structuredClone(g.players),scores:structuredClone(scores),
  winTile:winners.length?(source===null?g.drawTile:g.pending.tile):null,
  kongs:structuredClone(g.kongs),actions:[...g.log].reverse()};g.phase='ended';
 s.delta.forEach((v,i)=>g.totals[g.seats[i]]+=v);
 g.history.unshift({round:g.round,seats:[...g.seats],...structuredClone(g.result)});
 g.log.unshift(winners.length?winners.map(w=>names[g.seats[w]]).join('、')+'胡牌':'流局查叫');
}
export function draw(g,seat,replacement=false) {
 if(!g.wall.length){finish(g);return;}
 g.turn=seat;g.lastDraw=seat;g.drawTile=g.wall.pop();g.players[seat].hand=sorted(g.players[seat].hand);g.players[seat].hand.push(g.drawTile);g.phase='discard';g.pending=null;
 if(!replacement) g.gangChain=0;
 g.log.unshift(names[g.seats[seat]]+'摸牌');
}
export function discardPolicy(g,seat=g.turn) {
 const p=g.players[seat],all=p.hand.map((_,i)=>i);
 if(p.liang)return {allowed:all.filter(i=>i===p.hand.lastIndexOf(g.drawTile)),dangerous:[],allDangerous:false};
 const danger=new Set(g.players.flatMap((other,i)=>i!==seat&&other.liang?revealedWaits(g,i).map(x=>x.tile):[]));
 const dangerous=all.filter(i=>danger.has(p.hand[i]));
 const safe=all.filter(i=>!danger.has(p.hand[i]));
 return {allowed:safe.length?safe:all,dangerous,allDangerous:all.length>0&&safe.length===0};
}
export function discard(g,index,reveal=false) {
 if(g.phase!=='discard') throw Error('当前不是出牌阶段');
 const p=g.players[g.turn];if(index<0||index>=p.hand.length)throw Error('请选择手牌');
 if(!discardPolicy(g).allowed.includes(index))throw Error(p.liang?'亮倒后只允许摸切':'有安全牌可打，不能打亮倒玩家的炮牌');
 const after=p.hand.filter((_,i)=>i!==index);
 if(reveal&&!waits(after,p.melds,true).length) throw Error('打出此牌后不能听牌，无法亮倒');
 const tile=p.hand.splice(index,1)[0];p.river.push(tile);p.hand=sorted(p.hand);if(reveal)p.liang=true;
 g.discardSerial=(g.discardSerial||0)+1;
 g.lastDiscard={seat:g.turn,tile,index:p.river.length-1,handIndex:index,serial:g.discardSerial};
 g.pending={tile,source:g.turn,responses:{}};g.phase='react';g.log.unshift(names[g.seats[g.turn]]+'打出'+tileName(tile)+(reveal?'并亮倒':''));
 autoPass(g);
}
export function respond(g,seat,choice) {
 if(!['pass','peng','ming','hu'].includes(choice))throw Error('无效响应');
 if(g.phase!=='react'||seat===g.pending.source||g.pending.responses[seat])throw Error('当前座位不能响应');
 const p=g.players[seat],n=counts(p.hand)[g.pending.tile]||0;
 if(choice==='hu'&&!canWin(g,seat,g.pending.source))throw Error('未满足胡牌条件');
 if(['peng','ming'].includes(choice)&&(p.liang||n<(choice==='peng'?2:3)||!g.wall.length&&choice==='ming'))throw Error('不能碰杠');
 g.pending.responses[seat]=choice;
 if(Object.keys(g.pending.responses).length<2)return;
 const source=g.pending.source, tile=g.pending.tile, responses=g.pending.responses;
 const winners=[0,1,2].filter(i=>responses[i]==='hu');
 if(winners.length){finish(g,winners,source);return;}
 const claimant=[(source+1)%3,(source+2)%3].find(i=>['peng','ming'].includes(responses[i]));
 if(claimant!==undefined){
  const kind=responses[claimant],pl=g.players[claimant],take=kind==='peng'?2:3;
  for(let i=0;i<take;i++)pl.hand.splice(pl.hand.indexOf(tile),1);
  pl.melds.push({kind,tile});g.players[source].river.pop();g.pending=null;g.turn=claimant;g.gangChain=0;
  g.log.unshift(names[g.seats[claimant]]+(kind==='peng'?'碰':'明杠')+tileName(tile));
  if(kind==='ming'){g.kongs.push({from:source,to:claimant,amount:3*g.config.base,why:'明杠 '+tileName(tile)});g.gangChain=1;draw(g,claimant,true);}else{g.phase='discard';g.drawTile=null;}
 } else draw(g,(source+1)%3);
}

function distance(hand,melds) {
 const sp=new Majiang.Shoupai(hand);sp._fulou=melds.map(meldString);sp._zimo=null;
 return Majiang.Util.xiangting(sp);
}
export function chooseDiscard(p,drawTile,allowed=null) {
 if(p.liang)return {index:p.hand.lastIndexOf(drawTile),reveal:false};
 const options=[];
 for(let index=0;index<p.hand.length;index++) {
  if(allowed&&!allowed.includes(index))continue;
  if(p.hand.indexOf(p.hand[index])!==index)continue;
  const h=p.hand.filter((_,i)=>i!==index), ready=waits(h,p.melds,true), d=distance(h,p.melds), c=counts(h);
  let outs=0;
  for(const t of TYPES)if((c[t]||0)<4&&distance([...h,t],p.melds)<d)outs+=4-(c[t]||0);
  options.push({index,reveal:ready.length>0,d,outs,ready:ready.length});
 }
 return options.sort((a,b)=>Number(b.reveal)-Number(a.reveal)||a.d-b.d||b.outs-a.outs||b.ready-a.ready)[0];
}
// Basic companion uses only its own hand and public actions, never opponents' concealed tiles.
export function botStep(g,seat) {
 if(g.phase==='ended')return;
 const p=g.players[seat];
 if(g.phase==='react') {
  if(seat===g.pending.source||g.pending.responses[seat])return;
  if(canWin(g,seat,g.pending.source)){respond(g,seat,'hu');return;}
  const t=g.pending.tile,n=counts(p.hand)[t]||0;
  if(!p.liang&&n>=3&&g.wall.length){respond(g,seat,'ming');return;}
  if(!p.liang&&n>=2){
   const h=[...p.hand];h.splice(h.indexOf(t),1);h.splice(h.indexOf(t),1);
   const after={hand:h,melds:[...p.melds,{kind:'peng',tile:t}],liang:false};
   const best=chooseDiscard(after,null);
   if(best.d<distance(p.hand,p.melds)){respond(g,seat,'peng');return;}
  }
  respond(g,seat,'pass');return;
 }
 if(g.turn!==seat)return;
 if(canWin(g,seat)){finish(g,[seat]);return;}
 if(!p.liang&&g.wall.length){
  const c=counts(p.hand), t=Object.keys(c).find(t=>c[t]===4);
  if(t){kong(g,t,'an');return;}
  const m=p.melds.find(m=>m.kind==='peng'&&c[m.tile]);
  if(m){kong(g,m.tile,'bu');return;}
 }
 const best=chooseDiscard(p,g.drawTile,discardPolicy(g,seat).allowed);discard(g,best.index,best.reveal);
}
export function kong(g,tile,kind) {
 if(g.phase!=='discard'||!g.wall.length)throw Error('当前不能杠');
 const p=g.players[g.turn];if(p.liang)throw Error('亮倒后杠牌规则尚待确认，本版暂不开放');
 const n=counts(p.hand)[tile]||0;
 if(kind==='an') {if(n!==4)throw Error('暗杠需4张'); for(let i=0;i<4;i++)p.hand.splice(p.hand.indexOf(tile),1);p.melds.push({kind,tile});}
 else {const m=p.melds.find(m=>m.kind==='peng'&&m.tile===tile);if(!m||!n)throw Error('不能补杠');p.hand.splice(p.hand.indexOf(tile),1);m.kind='bu';}
 for(let a=0;a<3;a++)if(a!==g.turn)g.kongs.push({from:a,to:g.turn,amount:(kind==='an'?2:1)*g.config.base,why:(kind==='an'?'暗杠 ':'补杠 ')+tileName(tile)});
 g.gangChain++;g.log.unshift(names[g.seats[g.turn]]+(kind==='an'?'暗杠':'补杠')+tileName(tile));draw(g,g.turn,true);
}
