// Cloudflare Pages Function: restricted preview for explicitly permitted public websites.
// Configure WEB_ALLOWED_HOSTS (comma-separated exact hostnames) in Pages environment variables.
export async function onRequestGet({request,env}){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const fail=(status,error)=>new Response(JSON.stringify({error}),{status,headers});
 const allowed=(env.WEB_ALLOWED_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!allowed.length)return fail(503,'서버 중계가 설정되지 않았습니다. WEB_ALLOWED_HOSTS를 설정하세요.');
 const raw=new URL(request.url).searchParams.get('url');
 if(!raw)return fail(400,'주소가 필요합니다.');
 let target;try{target=new URL(raw)}catch{return fail(400,'올바르지 않은 주소입니다.')}
 if(target.protocol!=='https:'||target.username||target.password||target.port&&target.port!=='443'||!allowed.includes(target.hostname.toLowerCase()))return fail(403,'허용된 HTTPS 사이트만 표시할 수 있습니다.');
 try{
  const response=await fetch(target.toString(),{method:'GET',redirect:'manual',headers:{Accept:'text/html,text/plain;q=0.9'},signal:AbortSignal.timeout(8000)});
  if(response.status>=300&&response.status<400)return fail(403,'다른 주소로 이동하는 페이지는 중계하지 않습니다.');
  if(!response.ok)return fail(502,'원격 사이트 응답 오류: '+response.status);
  const type=(response.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('text/html')&&!type.includes('text/plain'))return fail(415,'HTML 및 일반 텍스트만 지원합니다.');
  const length=Number(response.headers.get('content-length')||0);
  if(length>400000)return fail(413,'페이지 크기 제한(400KB)을 초과했습니다.');
  const reader=response.body?.getReader();if(!reader)return fail(502,'본문을 읽을 수 없습니다.');
  let chunks=[],total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>400000){await reader.cancel();return fail(413,'페이지 크기 제한(400KB)을 초과했습니다.')}chunks.push(value)}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const html=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
  return new Response(JSON.stringify({html,source:target.toString(),type:type.includes('text/plain')?'text':'html'}),{headers});
 }catch{return fail(502,'중계 요청에 실패했습니다.');}
}
