import React, { createContext, useContext } from 'react';
import { Pressable, Text, View, TextInput, StyleSheet, ViewStyle } from 'react-native';
export interface Theme { bg: string; card: string; text: string; muted: string; line: string; accent: string; gain: string; loss: string; }
export const ThemeContext = createContext<Theme>({ bg:'#F4F6FA',card:'#FFFFFF',text:'#182337',muted:'#6D7A90',line:'#E7EBF2',accent:'#3366FF',gain:'#E44853',loss:'#2876DF' });
export const useTheme = () => useContext(ThemeContext);
export function Label({children, muted=false, size=15, color, bold=false}: {children: React.ReactNode; muted?:boolean; size?:number; color?:string; bold?:boolean}) {
  const t=useTheme(); return <Text style={{color:color ?? (muted?t.muted:t.text),fontSize:size,fontWeight:bold?'700':'400',lineHeight:size*1.45}}>{children}</Text>;
}
export function Card({children, style}: {children:React.ReactNode; style?:ViewStyle}) { const t=useTheme(); return <View style={[styles.card,{backgroundColor:t.card,borderColor:t.line},style]}>{children}</View>; }
export function Button({title,onPress,secondary=false,disabled=false}: {title:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}) {
  const t=useTheme(); return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} disabled={disabled} style={({pressed})=>({padding:14,borderRadius:14,backgroundColor:secondary?t.line:t.accent,opacity:disabled?.45:pressed?.7:1,alignItems:'center'})}><Label color={secondary?t.text:'#fff'} bold>{title}</Label></Pressable>;
}
export function Field({label,value,onChange,number=false,password=false}: {label:string;value:string;onChange:(s:string)=>void;number?:boolean;password?:boolean}) {
  const t=useTheme(); return <View style={{gap:7}}><Label muted size={13}>{label}</Label><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} secureTextEntry={password} autoCapitalize="none" autoCorrect={false} keyboardType={number?'decimal-pad':'default'} style={{borderWidth:1,borderColor:t.line,borderRadius:12,padding:14,color:t.text,backgroundColor:t.card,fontSize:16}} /></View>;
}
export function Choices({items,value,onChange}: {items:{value:string;label:string}[];value:string;onChange:(s:string)=>void}) {
  const t=useTheme(); return <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{items.map(i=><Pressable accessibilityRole="button" accessibilityState={{selected:value===i.value}} key={i.value} onPress={()=>onChange(i.value)} style={{paddingHorizontal:12,paddingVertical:10,borderRadius:12,backgroundColor:value===i.value?t.accent:t.line}}><Label size={13} color={value===i.value?'#fff':t.text}>{i.label}</Label></Pressable>)}</View>;
}
const styles=StyleSheet.create({card:{padding:20,borderRadius:22,borderWidth:1,gap:12}});
