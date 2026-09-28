export type Action = { type: 'airlift' | 'demand'; amount: number } | null;
export type Forecast = { series:{day:number,median:number,p10:number,p90:number,band:number,reserve:number}[]; probability:number; reserveProbability:number; risk:string; runout:number[]; arrival:number; runway:number };
// Mulberry32 gives a stable, repeatable sequence without an online service.
function random(seed:number){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function normal(rand:()=>number){return Math.sqrt(-2*Math.log(Math.max(rand(),1e-12)))*Math.cos(2*Math.PI*rand())}
export function simulate(delay:number, action:Action=null, trials=1000, seed=26062):Forecast{
 const initial=180000+(action?.type==='airlift'?action.amount:0),baseDemand=1850*(action?.type==='demand'?1-action.amount/100:1), arrival=65+delay;
 const daily:number[][]=Array.from({length:trials},()=>[]),runout:number[]=[],reserveHits:number[]=[];let preArrivalShortfalls=0;
 for(let i=0;i<trials;i++){const rand=random((seed+i*7919)>>>0);let stock=initial,out=-1,reserve=-1,arr=Math.max(0,Math.round(arrival+normal(rand)*4)),delivery=Math.max(0,100000+normal(rand)*5000);
  for(let day=0;day<=180;day++){if(day===arr)stock+=delivery;if(day>0)stock-=Math.max(0,baseDemand+normal(rand)*baseDemand*.12);stock=Math.max(0,stock);daily[i].push(stock);if(stock<=0&&out<0)out=day;if(stock<45000&&reserve<0)reserve=day;}
  if(out>=0){runout.push(out);if(out<arr)preArrivalShortfalls++}if(reserve>=0)reserveHits.push(reserve);
 }
 const pct=(vals:number[],p:number)=>{if(!vals.length)return null;const x=[...vals].sort((a,b)=>a-b),at=(x.length-1)*p,lo=Math.floor(at);return x[lo]+(x[Math.ceil(at)]-x[lo])*(at-lo)};
 const series=Array.from({length:181},(_,day)=>{const v=daily.map(x=>x[day]),p10=pct(v,.1)!,p90=pct(v,.9)!;return{day,median:pct(v,.5)!,p10,p90,band:p90-p10,reserve:45000}});
 const probability=preArrivalShortfalls/trials, reserveProbability=reserveHits.length/trials;
 return{series,probability,reserveProbability,risk:probability>=.6?'CRITICAL':probability>=.25?'ELEVATED':probability>=.08?'GUARDED':'LOW',runout,arrival,runway:initial/baseDemand};
}
