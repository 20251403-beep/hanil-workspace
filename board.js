/* Hanil Workspace shared board, backed by Supabase Auth + RLS */
let boardProfile=null,boardPosts=[],boardProfiles=new Map(),boardEditingId=null;
let boardBusy=false,boardPromptedFor=null,boardSessionId=null;
const boardEl=id=>document.getElementById(id);
const boardStatus=msg=>{boardEl('boardStatus').textContent=msg};
function boardClearSession(){
 boardProfile=null;boardPosts=[];boardProfiles=new Map();boardEditingId=null;boardSessionId=null;boardPromptedFor=null;
 boardEl('boardLoginIdentity').hidden=true;boardEl('boardActivityInput').value='';
 boardRender();
}
function boardRender(){
 const signed=!!cloudClient&&!!cloudUser;
 boardEl('boardLoginMessage').hidden=signed;
 boardEl('boardWorkspace').hidden=!signed;
 boardEl('boardLoginIdentity').hidden=!signed;
 if(!signed){boardStatus('게시판을 이용하려면 로그인하세요.');return}
 boardEl('boardMyName').textContent=boardProfile?.activity_id||'미설정';
 boardEl('boardActivityInput').value=boardProfile?.activity_id||boardEl('boardActivityInput').value;
 const query=boardEl('boardSearch').value.trim().toLowerCase();
 const items=boardPosts.filter(p=>{
  const author=boardProfiles.get(p.author_id)||'알 수 없는 사용자';
  return (p.title+' '+p.body+' '+author).toLowerCase().includes(query);
 });
 const host=boardEl('boardPostList');host.replaceChildren();
 if(!items.length){const blank=document.createElement('div');blank.className='board-empty';blank.textContent=query?'검색 결과가 없습니다.':'아직 게시글이 없습니다. 첫 번째 글을 작성해 보세요.';host.append(blank)}
 for(const post of items){
  const article=document.createElement('article');article.className='board-post';
  const title=document.createElement('h4');title.textContent=post.title;
  const line=document.createElement('div');line.className='board-post-meta';
  const author=document.createElement('strong');author.textContent=boardProfiles.get(post.author_id)||'알 수 없는 사용자';
  const date=document.createElement('span');date.textContent=new Date(post.created_at).toLocaleString('ko-KR');
  line.append(author,date);
  if(post.updated_at&&post.updated_at!==post.created_at){const edit=document.createElement('span');edit.textContent='수정됨';line.append(edit)}
  const body=document.createElement('p');body.className='board-post-body';body.textContent=post.body;
  article.append(title,line,body);
  if(post.author_id===cloudUser.id||isWorkspaceAdmin){
   const actions=document.createElement('div');actions.className='board-post-actions';
   const edit=document.createElement('button');edit.type='button';edit.textContent='수정';edit.className='ghost';edit.onclick=()=>boardBeginEdit(post);
   const del=document.createElement('button');del.type='button';del.textContent='삭제';del.className='ghost danger';del.onclick=()=>boardDeletePost(post);
   actions.append(edit,del);article.append(actions);
  }
  host.append(article);
 }
 boardEl('boardSubmitPost').disabled=boardBusy||!boardProfile;
 boardEl('boardSubmitPost').title=boardProfile?'':'활동 아이디를 먼저 지정하세요.';
}
async function boardLoadProfile(showIfMissing=false){
 if(!cloudClient||!cloudUser){boardClearSession();return}
 const uid=cloudUser.id;
 const {data,error}=await cloudClient.from('hw_board_profiles').select('user_id,activity_id').eq('user_id',uid).maybeSingle();
 if(error){boardEl('boardActivityStatus').textContent='활동 아이디 조회 오류: '+error.message;return}
 if(!cloudUser||cloudUser.id!==uid)return;
 boardProfile=data||null;boardSessionId=uid;
 boardEl('boardLoginIdentity').hidden=false;
 boardEl('boardActivityInput').value=boardProfile?.activity_id||'';
 boardEl('boardActivityStatus').textContent=boardProfile?'게시판에 표시될 활동 아이디입니다. 언제든 변경할 수 있습니다.':'활동 아이디를 저장하면 게시판에 글을 올릴 수 있습니다.';
 boardRender();
 if(showIfMissing&&!boardProfile&&boardPromptedFor!==uid){
  boardPromptedFor=uid;
  openCloudDialog();
  boardEl('boardActivityInput').focus();
 }
}
async function boardLoad(){
 if(!cloudClient||!cloudUser){boardClearSession();return}
 const uid=cloudUser.id;
 try{
  boardStatus('게시글을 불러오는 중…');
  const [a,b,c]=await Promise.all([
   cloudClient.from('hw_board_profiles').select('user_id,activity_id').limit(3000),
   cloudClient.from('hw_board_posts').select('id,author_id,title,body,created_at,updated_at').order('created_at',{ascending:false}).limit(200),
   cloudClient.rpc('is_workspace_admin')
  ]);
  if(a.error)throw a.error;if(b.error)throw b.error;if(c.error)throw c.error;
  if(cloudUser?.id!==uid)return;
  boardProfiles=new Map((a.data||[]).map(p=>[p.user_id,p.activity_id]));
  boardPosts=b.data||[];isWorkspaceAdmin=c.data===true;
  boardProfile=(a.data||[]).find(p=>p.user_id===uid)||null;
  boardEl('boardLoginIdentity').hidden=false;
  boardEl('boardActivityInput').value=boardProfile?.activity_id||'';
  boardRender();boardStatus('로그인한 회원 모두에게 공유되는 게시판입니다. 최근 게시글 최대 200개를 표시합니다.');
 }catch(e){boardStatus('게시글 불러오기 실패: '+(e.message||e));boardRender()}
}
async function boardSaveActivity(){
 if(boardBusy||!cloudClient||!cloudUser)return;
 const value=boardEl('boardActivityInput').value.trim();
 if(value.length<2||value.length>20||/[\n\r\t]/.test(value)){
  boardEl('boardActivityStatus').textContent='활동 아이디는 2~20자로 입력하세요.';return
 }
 boardBusy=true;boardEl('boardSaveActivity').disabled=true;
 try{
  const q=boardProfile?
    cloudClient.from('hw_board_profiles').update({activity_id:value}).eq('user_id',cloudUser.id):
    cloudClient.from('hw_board_profiles').insert({user_id:cloudUser.id,activity_id:value});
  const {error}=await q;
  if(error)throw error;
  boardProfile={user_id:cloudUser.id,activity_id:value};
  boardEl('boardActivityStatus').textContent='활동 아이디를 저장했습니다.';
  boardProfiles.set(cloudUser.id,value);
  boardRender();boardStatus('활동 아이디가 저장됐습니다.');
 }catch(e){boardEl('boardActivityStatus').textContent=e.code==='23505'?'이미 다른 회원이 사용 중인 활동 아이디입니다.':'저장 실패: '+(e.message||e)}
 finally{boardBusy=false;boardEl('boardSaveActivity').disabled=false}
}
function boardBeginEdit(post){
 if(!cloudUser||!(post.author_id===cloudUser.id||isWorkspaceAdmin))return;
 boardEditingId=post.id;
 boardEl('boardPostTitle').value=post.title;boardEl('boardPostBody').value=post.body;
 boardEl('boardEditorTitle').textContent='게시글 수정';
 boardEl('boardSubmitPost').textContent='수정 저장';
 boardEl('boardCancelEdit').hidden=false;
 boardEl('boardPostCount').textContent=post.body.length+' / 10000자';
 boardEl('boardEditor').scrollIntoView({behavior:'smooth',block:'start'});
 boardEl('boardPostTitle').focus();
}
function boardResetEditor(){
 boardEditingId=null;boardEl('boardPostTitle').value='';boardEl('boardPostBody').value='';
 boardEl('boardEditorTitle').textContent='새 글 작성';boardEl('boardSubmitPost').textContent='글 올리기';
 boardEl('boardCancelEdit').hidden=true;boardEl('boardPostCount').textContent='0 / 10000자';
}
async function boardSubmit(){
 if(boardBusy||!cloudClient||!cloudUser)return;
 if(!boardProfile){boardStatus('게시글을 작성하려면 활동 아이디를 먼저 설정해야 합니다.');openCloudDialog();boardEl('boardActivityInput').focus();return}
 const title=boardEl('boardPostTitle').value.trim(),body=boardEl('boardPostBody').value.trim();
 if(!title||title.length>120||!body||body.length>10000){boardStatus('제목(1~120자)과 본문(1~10000자)을 입력하세요.');return}
 boardBusy=true;boardEl('boardSubmitPost').disabled=true;
 try{
  const id=boardEditingId;
  const q=id?cloudClient.from('hw_board_posts').update({title,body,updated_at:new Date().toISOString()}).eq('id',id):
   cloudClient.from('hw_board_posts').insert({author_id:cloudUser.id,title,body});
  const {error}=await q;if(error)throw error;
  boardResetEditor();await boardLoad();boardStatus(id?'게시글을 수정했습니다.':'게시글을 등록했습니다. 모든 로그인 회원에게 공개됩니다.');
 }catch(e){boardStatus('글 저장 실패: '+(e.message||e))}
 finally{boardBusy=false;boardEl('boardSubmitPost').disabled=false}
}
async function boardDeletePost(post){
 if(!cloudUser||boardBusy||!(post.author_id===cloudUser.id||isWorkspaceAdmin))return;
 if(!confirm('게시글 "'+post.title+'"을 삭제하시겠습니까? 삭제한 글은 복원할 수 없습니다.'))return;
 boardBusy=true;
 try{
  const {error}=await cloudClient.from('hw_board_posts').delete().eq('id',post.id);
  if(error)throw error;
  if(boardEditingId===post.id)boardResetEditor();
  await boardLoad();boardStatus('게시글을 삭제했습니다.');
 }catch(e){boardStatus('삭제 실패: '+(e.message||e))}
 finally{boardBusy=false}
}
boardEl('boardOpenLogin').onclick=()=>{openCloudDialog();refreshCloudSession()};
boardEl('boardChangeName').onclick=()=>{openCloudDialog();boardEl('boardActivityInput').focus()};
boardEl('boardSaveActivity').onclick=boardSaveActivity;
boardEl('boardActivityInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();boardSaveActivity()}};
boardEl('boardSubmitPost').onclick=boardSubmit;
boardEl('boardCancelEdit').onclick=boardResetEditor;
boardEl('boardRefresh').onclick=boardLoad;
boardEl('boardSearch').oninput=boardRender;
boardEl('boardPostBody').oninput=e=>boardEl('boardPostCount').textContent=e.target.value.length+' / 10000자';
boardRender();
