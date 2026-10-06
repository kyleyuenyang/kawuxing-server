import {randomBytes} from 'node:crypto';
import {newGame,discard,respond,kong,finish,canWin,autoPass,names} from '../src/engine.js';
const fail=(message)=>{throw Error(message);};
export class Rooms {
 constructor(snapshot=[]){this.rooms=new Map(snapshot);}
 create(input={}){
  const size=Number(input.size||3),limit=Number(input.limit||16),cap=Number(input.cap??32);
  if(![3,4].includes(size)||![16,24,32].includes(limit)||![0,16,32].includes(cap))fail('房间设置无效');
  let code;do{code=String(randomBytes(4).readUInt32BE()%900000+100000);}while(this.rooms.has(code));
  const room={code,size,limit,cap,version:0,members:[],game:null,nextReady:[],updated:Date.now(),autoAt:0};this.rooms.set(code,room);
  return this.join(code,input);
 }
 join(code,input){
  const r=this.rooms.get(code);if(!r)fail('房间不存在');if(r.closed||r.game||r.members.length>=r.size)fail('房间已开局或已满');
  const name=String(input.name||'').trim().replace(/[&<>"']/g,'').slice(0,12);if(!name)fail('请输入昵称');
  const token=randomBytes(32).toString('hex');r.members.push({name,token,ready:false});r.version++;r.updated=Date.now();return {code,token,...this.view(r,token)};
 }
 member(r,token){const id=r.members.findIndex(m=>m.token===token);if(id<0)fail('入桌凭证无效，请重新加入');return id;}
 leave(code,token){
  const r=this.rooms.get(code);if(!r)fail('房间不存在');const id=this.member(r,token);
  if(!r.game){r.members.splice(id,1);r.members.forEach(m=>m.ready=false);if(!r.members.length)this.rooms.delete(code);}
  else if(!r.closed){r.closed=true;r.closedReason=`${r.members[id].name}退出了房间，本桌已结束，未完成的本局不计分。`;r.nextReady=[];}
  r.version++;r.updated=Date.now();return {left:true};
 }
 view(r,token){
  const id=this.member(r,token);let game=null,seat=-1;
  if(r.game){game=structuredClone(r.game);seat=game.seats.indexOf(id);game.wall=Array(game.wall.length).fill('?');
   game.players.forEach((p,i)=>{if(seat>=0&&game.phase!=='ended'&&i!==seat&&!p.liang){p.hand=Array(p.hand.length).fill('?');p.melds=p.melds.map(m=>m.kind==='an'?{...m,tile:'?'}:m);}if(seat>=0&&game.phase!=='ended'&&i!==seat)delete p.dealHand;});
   if(seat>=0&&game.phase!=='ended'&&game.turn!==seat&&!game.players[game.turn].liang)game.drawTile=null;
   if(game.pending)game.pending.responses=Object.fromEntries(Object.entries(game.pending.responses).map(([k,v])=>[k,+k===seat?v:'pass']));
  }
  return {code:r.code,version:r.version,size:r.size,limit:r.limit,cap:r.cap,id,seat,members:r.members.map(m=>({name:m.name,ready:m.ready})),game,nextReady:r.nextReady,closed:!!r.closed,closedReason:r.closedReason,complete:!!r.game&&r.game.history.length>=r.limit};
 }
 action(code,token,input){
  const r=this.rooms.get(code);if(!r)fail('房间不存在');const id=this.member(r,token);
  if(r.closed)fail('房间已结束，请返回大厅重新建房');
  if(input.version!==r.version)fail('牌局已更新，请刷新后重试');
  const before=structuredClone(r);
  try{
   r.members.forEach((m,i)=>names[i]=m.name);
   if(input.type==='ready'&&!r.game){r.members[id].ready=!r.members[id].ready;if(r.members.length===r.size&&r.members.every(m=>m.ready)){r.game=newGame({base:1,cap:r.cap,mode:r.size===4?'rotate':'three'});r.autoAt=Date.now()+2800;}}
   else if(input.type==='next'&&r.game?.phase==='ended'&&r.game.history.length<r.limit){
    if(!r.nextReady.includes(id))r.nextReady.push(id);
    if(r.nextReady.length===r.size){const g=r.game;r.game=newGame(g.config,{...g.result.next,round:g.round+1,totals:g.totals,history:g.history});r.nextReady=[];r.autoAt=Date.now()+2800;}
   }else{
    const g=r.game;if(!g||g.phase==='ended'||Date.now()<r.autoAt)fail('当前不能操作');const seat=g.seats.indexOf(id);if(seat<0)fail('当前正在候场');
    if(input.type==='respond'){respond(g,seat,input.choice);}
    else{if(g.turn!==seat||g.phase!=='discard')fail('尚未轮到你');
     if(input.type==='discard')discard(g,Number(input.index),!!input.reveal);
     else if(input.type==='kong')kong(g,input.tile,input.kind);
     else if(input.type==='win'){if(!canWin(g,seat))fail('当前不能自摸');finish(g,[seat]);}
     else fail('操作无效');}
    autoPass(g);r.autoAt=Date.now()+650;
   }
   r.version++;r.updated=Date.now();return this.view(r,token);
  }catch(e){this.rooms.set(code,before);throw e;}
 }
 tick(){let changed=false;for(const r of this.rooms.values()){
  if(Date.now()-r.updated>86400000){this.rooms.delete(r.code);changed=true;continue;}
  const g=r.game;if(r.closed||!g||g.phase!=='discard'||Date.now()<r.autoAt)continue;
  r.members.forEach((m,i)=>names[i]=m.name);
  if(g.players[g.turn].liang&&!canWin(g,g.turn)){discard(g,g.players[g.turn].hand.lastIndexOf(g.drawTile));autoPass(g);r.version++;r.updated=Date.now();r.autoAt=Date.now()+650;changed=true;}
 }return changed;}
}
