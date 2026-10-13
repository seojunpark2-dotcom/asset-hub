import {yahooDomestic} from '../supabase/functions/_shared/yahoo';
import type {Quote} from './types';
export async function yahooQuotes(instruments:unknown,cached:Record<string,Quote>={}){
 const quotes:Record<string,Quote>={},errors:Record<string,string>={};
 if(!Array.isArray(instruments))return {quotes,errors};
 for(const i of instruments.slice(0,49)){
  if(!i||i.market!=='KR'||!['domestic_etf','domestic_stock'].includes(i.asset_type)||typeof i.symbol!=='string'||!/^[A-Z0-9]{6}$/.test(i.symbol))continue;
  const key='KR:'+i.symbol;const old=cached[key];
  if(old?.source.startsWith('Yahoo Finance')&&!old.stale&&Date.now()-Date.parse(old.fetched_at)>=0&&Date.now()-Date.parse(old.fetched_at)<300000){quotes[key]=old;continue;}
  try{quotes[key]={...await yahooDomestic.get(i),market:'KR',currency:'KRW'};}
  catch(e){if(old)quotes[key]={...old,stale:true};errors[key]=i.symbol+': '+(e instanceof Error?e.message:'Yahoo Finance 조회 실패');}
 }
 return {quotes,errors};
}
