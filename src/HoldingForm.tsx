import React, { useState } from 'react';
import { ScrollView, View, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Holding, AssetType, assetLabels, institutions, marketOf } from './types';
import { costBasis, positive } from './finance';
import { catalog } from './catalog';
import { saveHolding } from './portfolio';
import { Label, Field, Choices, Button, Card } from './ui';
export function HoldingForm({holding,userId,onDone,onCancel}: {holding?:Holding;userId:string;onDone:()=>void;onCancel:()=>void}) {
  const [type,setType]=useState<AssetType>(holding?.asset_type ?? 'foreign_stock');
  const [institution,setInstitution]=useState(holding?.institution ?? '미래에셋증권');
  const [name,setName]=useState(holding?.name ?? '');
  const [symbol,setSymbol]=useState(holding?.symbol ?? '');
  const [quantity,setQuantity]=useState(holding?.quantity ?? '');
  const [average,setAverage]=useState(holding?.average_purchase_price ?? '');
  const [rate,setRate]=useState(holding?.purchase_exchange_rate ?? '');
  const [original,setOriginal]=useState(holding?.purchase_currency==='USD'?holding.original_investment_krw:'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const currency=marketOf(type)==='US'?'USD':'KRW';
  async function save() {
    if(busy)return; setError('');
    try {
      const code=symbol.trim().toUpperCase();
      if(!name.trim()) throw new Error('종목명을 입력하세요.');
      if(marketOf(type)==='KR'&&!/^\d{6}$/.test(code)) throw new Error('국내 종목코드는 숫자 6자리입니다.');
      if(marketOf(type)==='US'&&!/^[A-Z][A-Z0-9.\-]{0,14}$/.test(code)) throw new Error('미국 종목 티커를 확인하세요.');
      if(type==='crypto'&&!/^KRW-[A-Z0-9]{2,15}$/.test(code)) throw new Error('업비트 원화 마켓 코드(KRW-BTC)를 입력하세요.');
      if(rate.trim())positive(rate,'매입 당시 환율');
      const cost=costBasis(quantity.trim(),average.trim(),currency,rate.trim(),original.trim());
      setBusy(true);
      await saveHolding({...(holding?{id:holding.id}:{}),user_id:userId,institution,asset_type:type,name:name.trim(),symbol:code,quantity:quantity.trim(),average_purchase_price:average.trim(),purchase_currency:currency,purchase_exchange_rate:currency==='USD'&&rate.trim()?rate.trim():null,original_investment_krw:cost});
      onDone();
    } catch(e) {setError(e instanceof Error?e.message:'저장하지 못했습니다. 연결을 확인하세요.');} finally {setBusy(false);}
  }
  const results=name.trim()?catalog.filter(i=>i.type===type&&(i.name.toLowerCase().includes(name.toLowerCase())||i.symbol.toLowerCase().includes(name.toLowerCase()))):[];
  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,gap:18}}>
    <Label bold size={26}>{holding?'자산 수정':'자산 추가'}</Label>
    <Label muted>잔고 자동연동 없이 보유수량과 매입 정보를 등록합니다.</Label>
    <Label bold>금융기관</Label><Choices items={institutions.map(i=>({value:i,label:i}))} value={institution} onChange={setInstitution}/>
    <Label bold>자산 종류</Label><Choices items={Object.entries(assetLabels).map(([value,label])=>({value,label}))} value={type} onChange={v=>{setType(v as AssetType);setSymbol('');setName('');setOriginal('');setRate('');}}/>
    <Field label="종목명 · 기본 목록 검색" value={name} onChange={setName}/>
    {results.map(i=><Button key={i.symbol} secondary title={i.name+' · '+i.symbol} onPress={()=>{setName(i.name);setSymbol(i.symbol);}}/>)}
    <Label muted size={12}>기본 목록에 없는 종목은 이름과 코드를 직접 입력하세요. 종목 목록은 전체 시장 검색 결과가 아닙니다.</Label>
    <Field label="종목코드 / 티커" value={symbol} onChange={setSymbol}/>
    <Field label="보유수량 (소수점 12자리까지)" value={quantity} onChange={setQuantity} number/>
    <Field label={'평균매입단가 ('+currency+')'} value={average} onChange={setAverage} number/>
    {currency==='USD'&&<Card><Label bold>해외자산 원금</Label><Label muted size={13}>원화 투자원금을 입력하거나 매입 당시 환율을 입력하세요. 둘 다 입력하면 원화 투자원금을 우선합니다.</Label><Field label="원화 투자원금 (KRW)" value={original} onChange={setOriginal} number/><Field label="매입 당시 USD/KRW 환율" value={rate} onChange={setRate} number/></Card>}
    {!!error&&<Label color="#E44853">{error}</Label>}
    <Button title={busy?'저장 중…':'저장'} disabled={busy} onPress={()=>void save()}/>
    <Button title="취소" secondary disabled={busy} onPress={onCancel}/>
  </ScrollView></KeyboardAvoidingView>;
}
