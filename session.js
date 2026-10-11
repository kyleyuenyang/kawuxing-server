export function createSession(mode='bots',limit=16,historyLength=0){
 return {mode,limit,historyLength,ready:[false,mode==='bots',mode==='bots',false],started:false};
}
export function everyoneReady(s){return s.ready.slice(0,s.mode==='rotate'?4:3).every(Boolean);}
export function sessionRounds(s,history){return history.slice(0,Math.max(0,history.length-s.historyLength));}
export function sessionComplete(s,history){return s.started&&sessionRounds(s,history).length>=s.limit;}
export function sessionTotals(s,history){const totals=[0,0,0,0];for(const r of sessionRounds(s,history))r.delta.forEach((v,i)=>totals[r.seats[i]]+=v);return totals;}
