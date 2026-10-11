import {money,pct,signedMoney,summarize,Valuation} from './finance';
export function widgetSnapshot(rows:Valuation[],colors:'kr'|'global',updatedAt=new Date().toISOString()) {
 const total=summarize(rows);
 const color=(positive:boolean|null)=>positive===null?'#A2AFC3':positive?(colors==='global'?'#15AB82':'#FF727C'):(colors==='global'?'#FF727C':'#65A4FF');
 const sorted=[...rows].sort((a,b)=>a.value===null?(b.value===null?0:1):b.value===null?-1:b.value.cmp(a.value));
 return {
  totalValue:money(total.value),totalProfit:signedMoney(total.profit),totalPercent:pct(total.percent),
  totalColor:color(total.profit===null?null:total.profit.gte(0)),updatedAt,
  stale:rows.some(r=>r.value===null||r.quote?.stale||r.fx?.stale),
  delayed:rows.some(r=>r.quote?.delayed||r.fx?.delayed),
  rows:sorted.map(row=>({id:row.h.id,name:row.h.name,institution:row.h.institution,percent:pct(row.percent),color:color(row.profit===null?null:row.profit.gte(0))})),
 };
}
