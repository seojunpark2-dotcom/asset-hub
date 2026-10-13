import React,{useState} from 'react';
import {Linking} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import {Card,Label,Button} from './ui';
export function NotificationSettings(){
 const [message,setMessage]=useState('');
 const open=async()=>{const native=requireOptionalNativeModule<{openNotificationSettings():Promise<void>}>('AssetExpiry');if(native)await native.openNotificationSettings();else await Linking.openSettings();};
 return <Card><Label bold>알림 설정</Label><Button secondary title="휴대폰 알림 설정 열기" onPress={()=>void open().catch(()=>setMessage('휴대폰 설정 → 앱 → 통합 자산관리 → 알림에서 확인해주세요.'))}/>{message?<Label size={13}>{message}</Label>:null}</Card>;
}
