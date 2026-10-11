import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expiryDate,daysRemaining,expiryReminders,reconcileReminders,ExpiryReminder,mergeAutomaticExpiry,twoYearsAfter} from '../src/apiExpiry';
test('expiry dates validate real calendar days including leap years',()=>{
 assert.equal(expiryDate('2028-02-29'),'2028-02-29');
 for(const value of ['2027-02-29','2028-13-01','2028-00-11','2028-10-32','28-10-11','2028-1-1'])assert.throws(()=>expiryDate(value));
});
test('remaining days follow Korean date boundaries rather than device timezone',()=>{
 assert.equal(daysRemaining('2028-10-11',new Date('2028-10-10T14:59:59Z')),1);
 assert.equal(daysRemaining('2028-10-11',new Date('2028-10-10T15:00:00Z')),0);
 assert.equal(daysRemaining('2028-10-11',new Date('2028-10-11T15:00:00Z')),-1);
});
test('only one reminder is scheduled seven days before at Korean 09:00',()=>{
 const items=expiryReminders('user-a',{date:'2028-10-11',enabled:true},new Date('2026-10-11T00:00:00Z'));
 assert.deepEqual(items.map(i=>i.date.toISOString()),['2028-10-04T00:00:00.000Z']);
 assert.equal(items.length,1);assert.equal(new Set(items.map(i=>i.id)).size,1);
});
test('past reminders, expired dates and disabled reminders are never scheduled',()=>{
 assert.deepEqual(expiryReminders('a',{date:'2028-10-11',enabled:true},new Date('2028-10-11T00:00:01Z')),[]);
 assert.deepEqual(expiryReminders('a',{date:'2028-10-11',enabled:false}),[]);
 assert.equal(expiryReminders('a',{date:'2028-10-11',enabled:true},new Date('2028-10-05T00:00:00Z')).length,0);
});
function fakeAdapter(){
 const pending=new Map<string,ExpiryReminder|undefined>();const cancelled:string[]=[];let scheduled=0;
 return {pending,cancelled,get scheduled(){return scheduled;},list:async()=>[...pending.keys()].map(identifier=>({identifier})),cancel:async(id:string)=>{cancelled.push(id);pending.delete(id);},schedule:async(item:ExpiryReminder)=>{scheduled++;pending.set(item.id,item);}};
}
test('repeated launch reconciles schedules without duplicates and renewal replaces old dates',async()=>{
 const adapter=fakeAdapter();const expiry={date:'2028-10-11',enabled:true};const now=new Date('2026-10-11T00:00:00Z');
 await reconcileReminders(adapter,'a',expiry,true,now);await reconcileReminders(adapter,'a',expiry,true,now);
 assert.equal(adapter.scheduled,1);assert.equal(adapter.pending.size,1);
 await reconcileReminders(adapter,'a',{...expiry,date:'2030-10-11'},true,now);
 assert.equal(adapter.cancelled.length,1);assert.equal(adapter.pending.size,1);assert.ok([...adapter.pending.keys()].every(k=>k.includes('2030-10-11')));
});

test('automatic expiry uses actual notification day plus two years, with leap-day clamping',()=>{
 assert.equal(twoYearsAfter('2028-10-04'),'2030-10-04');
 assert.equal(twoYearsAfter('2028-10-05'),'2030-10-05');
 assert.equal(twoYearsAfter('2028-02-29'),'2030-02-28');
});
test('native rollover is synchronized idempotently and does not overwrite manual changes',()=>{
 const old={date:'2028-10-11',enabled:true};
 const native={date:'2030-10-04',configuredDate:old.date,lastNotifiedOn:'2028-10-04',autoAdvancedFrom:old.date};
 const merged=mergeAutomaticExpiry(old,native);
 assert.equal(merged.date,'2030-10-04');assert.equal(merged.lastNotifiedOn,'2028-10-04');
 assert.deepEqual(mergeAutomaticExpiry(merged,native),merged);
 assert.deepEqual(mergeAutomaticExpiry({...old,date:'2029-12-01'},native),{...old,date:'2029-12-01'});
 assert.deepEqual(mergeAutomaticExpiry(old,{...native,lastNotifiedOn:null}),old);
 const second={...native,date:'2032-09-27',lastNotifiedOn:'2030-09-27',autoAdvancedFrom:merged.date};
 assert.equal(mergeAutomaticExpiry(old,second).date,'2032-09-27');
 assert.equal(mergeAutomaticExpiry(merged,second).date,'2032-09-27');
});
test('account changes and revoked permission remove only expiry reminders',async()=>{
 const adapter=fakeAdapter();adapter.pending.set('unrelated',undefined);const now=new Date('2026-10-11T00:00:00Z');const expiry={date:'2028-10-11',enabled:true};
 await reconcileReminders(adapter,'a',expiry,true,now);await reconcileReminders(adapter,'b',expiry,true,now);
 assert.ok([...adapter.pending.keys()].filter(k=>k!=='unrelated').every(k=>k.startsWith('api-expiry:b:')));
 await reconcileReminders(adapter,'b',expiry,false,now);assert.deepEqual([...adapter.pending.keys()],['unrelated']);
});
