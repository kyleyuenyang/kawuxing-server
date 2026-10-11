import {TYPES,counts,waits,discardPolicy,amount,reservedKongTiles} from './engine.js';
// Only the viewer's hand and public information may enter the counter.
export function remainingTiles(g,view){
 const seen=[...g.players[view].hand];
 g.players.forEach((p,i)=>{
  seen.push(...p.river);
  for(const m of p.melds)seen.push(...Array(m.kind==='peng'?3:4).fill(m.tile));
  if(i!==view&&p.liang){const hidden=reservedKongTiles(p);seen.push(...p.hand.filter(t=>!hidden.includes(t)));}
 });
 const c=counts(seen);return Object.fromEntries(TYPES.map(t=>[t,Math.max(0,4-(c[t]||0))]));
}
export function discardPreviews(g,view){
 if(g.phase!=='discard'||g.turn!==view)return [];
 const p=g.players[view],left=remainingTiles(g,view),policy=discardPolicy(g,view),cache=new Map();
 return p.hand.map((t,i)=>{
  if(!cache.has(t))cache.set(t,waits(p.hand.filter((_,j)=>j!==i),p.melds,true).map(w=>({...w,remaining:left[w.tile],points:amount(w.score.raw,g.config)})));
  const ready=cache.get(t);return {index:i,tile:t,allowed:policy.allowed.includes(i),ready,total:ready.reduce((n,w)=>n+w.remaining,0)};
 });
}
