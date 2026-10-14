import {yahooDomestic,yahooUS} from '../supabase/functions/_shared/yahoo';
import type {Quote} from './types';
export async function yahooQuotes(instruments:unknown,cached:Record<string,Quote>={}){
 const quotes:Record<string,Quote>={},errors:Record<string,string>={};
 if(!Array.isArray(instruments))return {quotes,errors};
 for(const i of instruments.slice(0,49)){
  if(!i||typeof i.symbol!=='string')continue;
  const provider=i.market==='KR'?yahooDomestic:i.market==='US'?yahooUS:null;
  if(!provider?.supports(i))continue;
  const key=i.market+':'+i.symbol;const old=cached[key];
  if(old?.source.startsWith('Yahoo Finance')&&!old.stale&&Date.now()-Date.parse(old.fetched_at)>=0&&Date.now()-Date.parse(old.fetched_at)<300000){quotes[key]=old;continue;}
  try{quotes[key]={...await provider.get(i),market:i.market,currency:i.market==='US'?'USD':'KRW'};}
  catch(e){if(old)quotes[key]={...old,stale:true};errors[key]=i.symbol+': '+(e instanceof Error?e.message:'Yahoo Finance 조회 실패');}
 }
 return {quotes,errors};
}
