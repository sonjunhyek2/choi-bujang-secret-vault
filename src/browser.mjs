const el=id=>document.getElementById(id);
let session=null,generation=0,requestSequence=0,deviceSequence=0,deviceStatus='unknown';
const message=text=>{el('message').textContent=text;};
function resetEditor(){el('note-form').reset();el('note-id').value='';el('save').textContent='메모 추가';el('cancel-edit').hidden=true;}
async function api(path='',method='GET',body){
  if(!session||deviceStatus!=='approved')throw Error('로그인과 기기 승인이 필요합니다.');
  const response=await fetch(`/api/notes${path}`,{method,cache:'no-store',credentials:'same-origin',headers:{...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok){
    if(response.status===401)updateSession(false);
    if(data.error==='DEVICE_APPROVAL_REQUIRED')setDeviceStatus('unknown');
    throw Error(data.error||'자료 요청에 실패했습니다.');
  }
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
  if(!session||deviceStatus!=='approved'||!navigator.onLine)return;
  message('메모를 불러오는 중입니다.');
  try{
    const notes=await api();
    if(gen!==generation||seq!==requestSequence)return;
    if(!Array.isArray(notes))throw Error('자료 형식을 확인할 수 없습니다.');
    renderNotes(notes);message('목록을 불러왔습니다.');
  }catch(error){if(gen===generation&&seq===requestSequence)message(`목록 조회 실패: ${error.message}`);}
}
function updateSession(authenticated){
  session=authenticated;generation++;requestSequence++;deviceSequence++;deviceStatus='unknown';resetEditor();el('notes').replaceChildren();
  el('identity').textContent=session?'로그인됨':'로그아웃됨 · 자료를 보려면 로그인하세요.';
  el('login-form').hidden=Boolean(session);el('logout').hidden=!session;el('workspace').hidden=true;el('device-section').hidden=!session;
  message('');
  if(session)setTimeout(loadDeviceStatus,0);
}
function setDeviceStatus(status){
  deviceStatus=status;
  const labels={unknown:'서버의 승인 상태를 확인할 수 없습니다.',unregistered:'아직 이 기기를 승인 요청하지 않았습니다.',pending:'서버에서 승인 결과를 기다리고 있습니다.',approved:'서버에서 이 기기를 승인했습니다.',revoked:'이 기기의 승인이 해제됐습니다. 다시 승인을 요청해 주세요.'};
  el('device-status').textContent=labels[status]||labels.unknown;
  el('request-device').hidden=status==='approved'||status==='pending';
  el('workspace').hidden=!session||status!=='approved'||!navigator.onLine;
  if(status!=='approved'||!navigator.onLine){requestSequence++;resetEditor();el('notes').replaceChildren();}
}
async function deviceRequest(action){
  const response=await fetch(`/api/devices/${action}`,{method:action==='request'?'POST':'GET',credentials:'same-origin',cache:'no-store'});
  const data=await response.json();
  if(!response.ok){if(response.status===401)updateSession(false);throw Error(data.error||'기기 상태 확인에 실패했습니다.');}
  return data;
}
async function loadDeviceStatus(){
  const gen=generation,seq=++deviceSequence;
  try{const data=await deviceRequest('status');if(gen!==generation||seq!==deviceSequence)return;setDeviceStatus(data.status);if(data.status==='approved')await loadNotes();}
  catch(error){if(gen===generation&&seq===deviceSequence){setDeviceStatus('unknown');message(error.message);}}
}
el('request-device').addEventListener('click',async()=>{
  const gen=generation,seq=++deviceSequence;el('request-device').disabled=true;
  try{const data=await deviceRequest('request');if(gen===generation&&seq===deviceSequence){setDeviceStatus(data.status);message('승인 요청을 보냈습니다. 승인 결과를 다시 확인해 주세요.');}}
  catch(error){if(gen===generation)message(error.message);}
  finally{el('request-device').disabled=false;}
});
el('check-device').addEventListener('click',loadDeviceStatus);
function connectivity(){el('offline-message').hidden=navigator.onLine;if(!navigator.onLine)setDeviceStatus('unknown');else if(session)loadDeviceStatus();}
window.addEventListener('offline',connectivity);window.addEventListener('online',connectivity);connectivity();
window.addEventListener('pageshow',()=>{if(session){setDeviceStatus('unknown');loadDeviceStatus();}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&session){setDeviceStatus('unknown');loadDeviceStatus();}});
let installPrompt;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;el('install-app').hidden=false;});
el('install-app').addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;el('install-app').hidden=true;}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>message('앱의 오프라인 안내를 준비하지 못했습니다. 온라인 자료실은 계속 사용할 수 있습니다.'));
async function authRequest(action,body){
  const response=await fetch(`/api/auth/${action}`,{method:action==='session'?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'로그인 요청에 실패했습니다.');
  return data;
}
authRequest('session').then(data=>{if(generation===0)updateSession(data.authenticated);}).catch(()=>{if(generation===0){updateSession(false);message('로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.');}});
el('login-form').addEventListener('submit',async event=>{
  event.preventDefault();el('login').disabled=true;message('로그인 중입니다.');
  try{const data=await authRequest('login',{email:el('email').value.trim(),password:el('password').value});el('password').value='';updateSession(data.authenticated);}
  catch{message('로그인 서버에 연결하지 못했습니다.');el('password').value='';}
  finally{el('login').disabled=false;}
});
el('logout').addEventListener('click',async()=>{
  el('logout').disabled=true;
  try{const data=await authRequest('logout');updateSession(data.authenticated);}
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
