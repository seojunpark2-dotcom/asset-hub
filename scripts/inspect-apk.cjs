const fs=require('node:fs');const zlib=require('node:zlib');
const file=process.argv[2];if(!file)throw new Error('Usage: node scripts/inspect-apk.cjs FILE.apk');
const apk=fs.readFileSync(file);
let end=-1;for(let i=apk.length-22;i>=Math.max(0,apk.length-65557);i--){if(apk.readUInt32LE(i)===0x06054b50){end=i;break;}}
if(end<0)throw new Error('Invalid APK ZIP footer');
const entries=[];let pos=apk.readUInt32LE(end+16);const count=apk.readUInt16LE(end+10);
for(let i=0;i<count;i++){
 if(apk.readUInt32LE(pos)!==0x02014b50)throw new Error('Invalid ZIP directory');
 const nameLength=apk.readUInt16LE(pos+28),extra=apk.readUInt16LE(pos+30),comment=apk.readUInt16LE(pos+32);
 entries.push({name:apk.toString('utf8',pos+46,pos+46+nameLength),method:apk.readUInt16LE(pos+10),size:apk.readUInt32LE(pos+20),offset:apk.readUInt32LE(pos+42)});
 pos+=46+nameLength+extra+comment;
}
const entry=entries.find(e=>e.name==='AndroidManifest.xml');if(!entry)throw new Error('Missing Android manifest');
const local=entry.offset,start=local+30+apk.readUInt16LE(local+26)+apk.readUInt16LE(local+28);
const compressed=apk.subarray(start,start+entry.size);
const xml=entry.method===8?zlib.inflateRawSync(compressed):compressed;
const u16=p=>xml.readUInt16LE(p),u32=p=>xml.readUInt32LE(p);
let strings=[];let metadata={};const permissions=[];
function length8(p){const a=xml[p];return a&128?{n:((a&127)<<8)|xml[p+1],p:p+2}:{n:a,p:p+1};}
function length16(p){const a=u16(p);return a&32768?{n:((a&32767)<<16)|u16(p+2),p:p+4}:{n:a,p:p+2};}
for(let p=8;p<xml.length;){
 const type=u16(p),header=u16(p+2),size=u32(p+4);if(size<8||p+size>xml.length)throw new Error('Invalid manifest chunk');
 if(type===1){
  const n=u32(p+8),utf8=(u32(p+16)&256)!==0,base=p+u32(p+20);
  strings=Array.from({length:n},(_,i)=>{const off=base+u32(p+header+i*4);if(utf8){const chars=length8(off),bytes=length8(chars.p);return xml.toString('utf8',bytes.p,bytes.p+bytes.n);}const len=length16(off);return xml.toString('utf16le',len.p,len.p+len.n*2);});
 }else if(type===0x0102){
  const name=strings[u32(p+20)],attrs={};const attrStart=p+16+u16(p+24),attrSize=u16(p+26),attrCount=u16(p+28);
  for(let i=0;i<attrCount;i++){const a=attrStart+i*attrSize,key=strings[u32(a+4)],raw=u32(a+8),dataType=xml[a+15],data=u32(a+16);attrs[key]=raw!==0xffffffff?strings[raw]:dataType===3?strings[data]:data;}
  if(name==='manifest')metadata={...metadata,package:attrs.package,versionName:attrs.versionName,versionCode:attrs.versionCode};
  if(name==='uses-sdk')metadata={...metadata,minSdk:attrs.minSdkVersion,targetSdk:attrs.targetSdkVersion};
  if(name==='uses-permission')permissions.push(attrs.name);
 }
 p+=size;
}
const dex=entries.filter(e=>/^classes\d*\.dex$/.test(e.name)).map(e=>e.name);
if(metadata.package!=='com.portfolio.assettracker'||!dex.length)throw new Error('APK does not match expected application');
if(process.env.VERSION){const config=require('../app.json').expo;if(metadata.versionName!==process.env.VERSION||metadata.versionCode!==config.android.versionCode)throw new Error('APK version does not match source configuration');}
const info={file,bytes:apk.length,...metadata,permissions,dexFiles:dex.length,nativeAbis:[...new Set(entries.filter(e=>e.name.startsWith('lib/')).map(e=>e.name.split('/')[1]))],apkSignatureBlockPresent:apk.includes(Buffer.from('APK Sig Block 42'))};
console.log(JSON.stringify(info,null,2));
