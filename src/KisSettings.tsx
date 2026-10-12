import React from 'react';
import {Card,Label} from './ui';
import type {KisStatus} from './types';
export function KisSettings({status}:{status:KisStatus|null}){
 const expires=status?.tokenExpiresAt;const valid=expires&&Number.isFinite(Date.parse(expires))&&Date.parse(expires)>Date.now();
 return <Card><Label bold>국내 주식·ETF · 한국투자증권</Label>
  <Label>{status===null?'서버 연결 상태 확인 중…':status.configured?'앱키 서버 설정 완료':'한국투자 계좌와 실전용 앱키·시크릿 최초 설정 필요'}</Label>
  <Label muted>접근 토큰은 서버에서 자동 발급·재사용하며 만료 시 자동 재발급합니다. 토큰을 직접 입력하거나 만료일을 지정할 필요가 없습니다.</Label>
  {status?.configured?<Label size={13}>{valid?'접근 토큰 만료: '+new Date(expires).toLocaleString('ko-KR')+' · 자동 재발급': '다음 국내 시세 조회 시 토큰을 자동 발급합니다.'}</Label>:null}
  <Label muted size={12}>한국투자 앱키 자체의 만료·폐기 또는 서비스 해지는 토큰 재발급으로 해결되지 않습니다. 앱키의 실제 이용기간은 한국투자 정책을 따릅니다.</Label>
 </Card>;
}
