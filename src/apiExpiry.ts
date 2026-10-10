export interface ApiExpiry { date: string; enabled: boolean; }
export const defaultApiExpiry: ApiExpiry = {date:'2028-10-11',enabled:false};
const DAY=86400000;
export function expiryDate(value:string):string {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('만료일을 YYYY-MM-DD 형식으로 입력하세요.');
 const [year,month,day]=value.split('-').map(Number);
 if(!year||year<2000||year>2099||!month||!day)throw new Error('2000~2099년의 올바른 날짜를 입력하세요.');
 const parsed=new Date(Date.UTC(year,month-1,day));
 if(parsed.toISOString().slice(0,10)!==value)throw new Error('존재하는 날짜를 입력하세요.');
 return value;
}
export function daysRemaining(date:string,now=new Date()):number {
 const target=Date.parse(expiryDate(date)+'T00:00:00Z');
 const today=new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
 return Math.round((target-Date.parse(today+'T00:00:00Z'))/DAY);
}
export function expiryLabel(date:string,now=new Date()):string {
 const days=daysRemaining(date,now);
 return days>0?'만료까지 '+days+'일':days===0?'오늘 만료 예정':'만료일 '+(-days)+'일 경과';
}
export interface ExpiryReminder {id:string;date:Date;days:number;title:string;body:string;}
export function expiryReminders(userId:string,expiry:ApiExpiry,now=new Date()):ExpiryReminder[] {
 if(!expiry.enabled)return [];
 const date=expiryDate(expiry.date);
 // 09:00 Korea time is 00:00 UTC, regardless of the phone timezone.
 const expiryMorning=Date.parse(date+'T00:00:00Z');
 return [30,7,1,0].map(days=>({id:'api-expiry:'+userId+':'+date+':'+days,date:new Date(expiryMorning-days*DAY),days,
  title:days===0?'공공데이터 API 이용기간 만료일입니다':'공공데이터 API 만료 '+days+'일 전',
  body:'국내 ETF 시세 API 만료예정일: '+date+'. 공공데이터포털에서 이용기간을 확인하고 연장하세요.'
 })).filter(item=>item.date.getTime()>now.getTime());
}
export interface ReminderAdapter {
 list():Promise<{identifier:string}[]>;
 cancel(id:string):Promise<void>;
 schedule(reminder:ExpiryReminder):Promise<unknown>;
}
export async function reconcileReminders(adapter:ReminderAdapter,userId:string,expiry:ApiExpiry,allowed:boolean,now=new Date()) {
 const desired=allowed?expiryReminders(userId,expiry,now):[];
 const current=await adapter.list();
 const desiredIds=new Set(desired.map(r=>r.id));
 const existing=new Set(current.map(r=>r.identifier));
 for(const item of current)if(item.identifier.startsWith('api-expiry:')&&!desiredIds.has(item.identifier))await adapter.cancel(item.identifier);
 for(const item of desired)if(!existing.has(item.id))await adapter.schedule(item);
 return desired.length;
}