import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Valuation, decimal, money, summarize } from './finance';
import { assetLabels } from './types';
import { Card, Label } from './ui';
const colors=['#8D6BEB','#12B9A5','#3366FF','#FFAE56','#E76C91'];
export function Analysis({rows}: {rows:Valuation[]}) {
  const total=summarize(rows);
  const groups=Object.entries(assetLabels).map(([key,label])=>({label,value:rows.filter(r=>r.h.asset_type===key).reduce((a,r)=>a.plus(r.value??0),decimal(0))})).filter(g=>g.value.gt(0)).sort((a,b)=>b.value.cmp(a.value));
  const banks=[...new Set(rows.map(r=>r.h.institution))].map(label=>({label,summary:summarize(rows.filter(r=>r.h.institution===label))})).sort((a,b)=>{
    if(a.summary.value===null)return b.summary.value===null?0:1;
    if(b.summary.value===null)return -1;
    return b.summary.value.cmp(a.summary.value);
  });
  let offset=0;
  return <><Card><Label bold size={20}>자산 구성</Label>{total.missing>0?<Label muted>시세 {total.missing}건을 확인할 수 없어 전체 비중 계산을 기다립니다.</Label>:total.knownValue.isZero()?<Label muted>자산을 등록하면 비중을 보여드립니다.</Label>:<>
    <View style={{alignItems:'center',paddingVertical:12}}><Svg width={220} height={220} viewBox="0 0 220 220"><Circle cx={110} cy={110} r={80} stroke="#E7EBF2" strokeWidth={28} fill="none"/><G transform="matrix(-1 0 0 1 220 0)">{groups.map((g,i)=>{const length=g.value.div(total.knownValue).toNumber()*2*Math.PI*80;const start=offset;offset+=length;return <Circle key={g.label} cx={110} cy={110} r={80} fill="none" stroke={colors[i]} strokeWidth={28} strokeDasharray={[length,2*Math.PI*80-length]} strokeDashoffset={-start} rotation={-90} origin="110,110"/>;})}</G></Svg></View>
    {groups.map((g,i)=><View key={g.label} style={{flexDirection:'row',justifyContent:'space-between'}}><Label color={colors[i]} bold>{g.label}</Label><Label>{g.value.div(total.knownValue).mul(100).toFixed(1)}% · {money(g.value)}</Label></View>)}
  </>}</Card><Card><Label bold size={20}>금융기관별 비중</Label>{banks.map(b=><View key={b.label} style={{gap:5}}><Label bold>{b.label}</Label><Label muted>{money(b.summary.value)} · {total.value?.gt(0)&&b.summary.value?b.summary.value.div(total.value).mul(100).toFixed(1)+'%':'비중 확인 중'}</Label></View>)}</Card></>;
}
