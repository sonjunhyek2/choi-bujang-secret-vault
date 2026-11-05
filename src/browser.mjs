import { createClient } from '@supabase/supabase-js';
const auth=createClient('https://epiirbcbtjvmyewuetkt.supabase.co','sb_publishable_4-Lyfr2q9QQnZ4DkgCF7Bw_RRqfJMCw');
const el=id=>document.getElementById(id);
let session=null,generation=0,requestSequence=0;
const message=text=>{el('message').textContent=text;};
function resetEditor(){el('note-form').reset();el('note-id').value='';el('save').textContent='메모 추가';el('cancel-edit').hidden=true;}
async function api(path='',method='GET',body){
  if(!session)throw Error('로그인이 필요합니다.');
  const response=await fetch(`/api/notes${path}`,{method,cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'자료 요청에 실패했습니다.');
  return data;
}
function renderNotes(notes){
  const list=el('notes');list.replaceChildren();
  if(!notes.length){const p=document.createElement('p');p.textContent='저장된 가상 메모가 없습니다.';list.append(p);return;}
  for(const note of notes){
    const article=document.createElement('article');
    const title=document.createElement('h3');title.textContent=note.title;
    const body=document.createElement('p');body.textContent=note.body;
    const edit=document.createElement('button');edit.type='button';edit.textContent='수정';edit.setAttribute('aria-label',`${note.title} 수정`);
    edit.addEventListener('click',()=>{el('note-id').value=note.id;el('title').value=note.title;el('body').value=note.body;el('save').textContent='수정 저장';el('cancel-edit').hidden=false;el('title').focus();});
    const remove=document.createElement('button');remove.type='button';remove.textContent='삭제';remove.setAttribute('aria-label',`${note.title} 삭제`);
    remove.addEventListener('click',async()=>{
      const gen=generation;remove.disabled=true;
      try{await api(`/${note.id}`,'DELETE');if(gen!==generation)return;resetEditor();await loadNotes();message('메모를 삭제했습니다.');}
      catch(error){if(gen===generation)message(`삭제 실패: ${error.message}`);}
      finally{remove.disabled=false;}
    });
    article.append(title,body,edit,remove);list.append(article);
  }
}
async function loadNotes(){
  const gen=generation,seq=++requestSequence;
  el('notes').replaceChildren();
  if(!session)return;
  message('메모를 불러오는 중입니다.');
  try{
    const notes=await api();
    if(gen!==generation||seq!==requestSequence)return;
    if(!Array.isArray(notes))throw Error('자료 형식을 확인할 수 없습니다.');
    renderNotes(notes);message('목록을 불러왔습니다.');
  }catch(error){if(gen===generation&&seq===requestSequence)message(`목록 조회 실패: ${error.message}`);}
}
auth.auth.onAuthStateChange((_event,current)=>{
  session=current;generation++;requestSequence++;resetEditor();el('notes').replaceChildren();
  el('identity').textContent=session?'로그인됨':'로그아웃됨 · 자료를 보려면 로그인하세요.';
  el('login-form').hidden=Boolean(session);el('logout').hidden=!session;el('workspace').hidden=!session;
  message('');
  if(session)setTimeout(loadNotes,0);
});
el('login-form').addEventListener('submit',async event=>{
  event.preventDefault();el('login').disabled=true;message('로그인 중입니다.');
  try{const {error}=await auth.auth.signInWithPassword({email:el('email').value.trim(),password:el('password').value});el('password').value='';if(error)message(`로그인 실패: ${error.message}`);}
  catch{message('로그인 서버에 연결하지 못했습니다.');el('password').value='';}
  finally{el('login').disabled=false;}
});
el('logout').addEventListener('click',async()=>{
  el('logout').disabled=true;
  try{const {error}=await auth.auth.signOut();if(error)message(`로그아웃 실패: ${error.message}`);}
  catch{message('로그아웃 요청에 실패했습니다.');}
  finally{el('logout').disabled=false;}
});
el('note-form').addEventListener('submit',async event=>{
  event.preventDefault();const gen=generation,id=el('note-id').value;el('save').disabled=true;
  try{await api(id?`/${id}`:'',id?'PUT':'POST',{title:el('title').value,body:el('body').value});if(gen!==generation)return;resetEditor();await loadNotes();message(id?'수정을 저장했습니다.':'메모를 추가했습니다.');}
  catch(error){if(gen===generation)message(`저장 실패: ${error.message}`);}
  finally{el('save').disabled=false;}
});
el('cancel-edit').addEventListener('click',resetEditor);
el('refresh').addEventListener('click',loadNotes);
