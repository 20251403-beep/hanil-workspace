/* Hanil Workspace ZIP (store method, UTF-8 filenames, no external library). */
(function(){
'use strict';
const encoder=new TextEncoder();
let crcTable=null;
function crc32(bytes){
 if(!crcTable){
  crcTable=new Uint32Array(256);
  for(let i=0;i<256;i++){
   let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;
   crcTable[i]=c>>>0;
  }
 }
 let crc=0xffffffff;
 for(let i=0;i<bytes.length;i++)crc=crcTable[(crc^bytes[i])&255]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
}
function stamp(date){
 const y=Math.max(1980,Math.min(2107,date.getFullYear()));
 return {time:(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1),
 date:((y-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()};
}
function header(size){return new Uint8Array(size)}
function u16(v,o,n){v.setUint16(o,n,true)}
function u32(v,o,n){v.setUint32(o,n>>>0,true)}
async function create(files,onProgress){
 if(!Array.isArray(files)||files.length===0)throw Error('압축할 파일이 없습니다.');
 if(files.length>65535)throw Error('ZIP 파일 개수가 너무 많습니다.');
 const local=[],central=[],entries=[],date=stamp(new Date());
 let offset=0,centralBytes=0;
 for(let i=0;i<files.length;i++){
  const f=files[i],name=encoder.encode(f.name);
  if(name.length>65535)throw Error('파일 이름이 너무 깁니다.');
  const data=f.blob instanceof Uint8Array?f.blob:new Uint8Array(await f.blob.arrayBuffer());
  if(data.byteLength>0xffffffff)throw Error('파일이 ZIP 크기 제한을 넘었습니다.');
  const length=data.byteLength,crc=crc32(data),lh=header(30),lv=new DataView(lh.buffer);
  u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,0);
  u16(lv,10,date.time);u16(lv,12,date.date);u32(lv,14,crc);
  u32(lv,18,length);u32(lv,22,length);u16(lv,26,name.length);u16(lv,28,0);
  local.push(lh,name,data);
  const ch=header(46),cv=new DataView(ch.buffer);
  u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);
  u16(cv,8,0x0800);u16(cv,10,0);u16(cv,12,date.time);u16(cv,14,date.date);
  u32(cv,16,crc);u32(cv,20,length);u32(cv,24,length);
  u16(cv,28,name.length);u16(cv,30,0);u16(cv,32,0);
  u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,offset);
  central.push(ch,name);centralBytes+=ch.length+name.length;
  offset+=lh.length+name.length+length;
  if(offset+centralBytes>0xffffffff)throw Error('ZIP 크기 제한을 넘었습니다.');
  if(onProgress)onProgress(i+1,files.length);
 }
 const end=header(22),ev=new DataView(end.buffer);
 u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);
 u16(ev,8,files.length);u16(ev,10,files.length);u32(ev,12,centralBytes);
 u32(ev,16,offset);u16(ev,20,0);
 return new Blob([...local,...central,end],{type:'application/zip'});
}
window.HanilZip={create};
})();