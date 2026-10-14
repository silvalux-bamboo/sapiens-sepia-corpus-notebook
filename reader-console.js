// Injected inside the original app closure by index.html. No network services.
// These function declarations replace the earlier versions without changing DB keys.
function clean(r){
 const rec={...r};
 rec.id=(typeof r.id==='string'||typeof r.id==='number')?String(r.id):makeId();
 if(typeof rec.text!=='string')rec.text=readerString(r.original)||readerString(r.headword)||readerString(r.trans);
 if(!rec.created)rec.created=new Date().toISOString();
 if(!rec.updated)rec.updated=rec.created;
 return rec;
}
let readerBusy=false,readerRecordId='',readerAnnotationId='',readerSourceId='',readerReturnFocus=null,readerBaseAnnotation=null,readerBaseSource=null;
const readerKinds={literary:'문헌 해석',association:'개인 연상',undecided:'미정'};
const readerStates={draft:'작성 중',reviewed:'검토함 (작성자 표시)',revisit:'재검토 필요'};
const readerVisibility={private:'개인 보관','share-intent':'공유 의사 있음'};
const readerString=v=>typeof v==='string'?v:'';
const readerMissing=v=>readerString(v).trim()||'미확인';
const readerSource=e=>({book:typeof e.book==='string'?e.book:readerString(e.source),author:readerString(e.author),locator:readerString(e.locator)});
const readerObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function readerValidAnnotation(a,text){
 if(!readerObject(a))return false;
 if(!['id','createdAt','updatedAt','meaning','emotion','target','kind','reviewStatus','visibility'].every(k=>typeof a[k]==='string'))return false;
 if(!a.id.trim()||!Number.isFinite(Date.parse(a.createdAt))||!Number.isFinite(Date.parse(a.updatedAt)))return false;
 if(a.schemaVersion!==1||!Number.isSafeInteger(a.version)||a.version<1)return false;
 if(!Object.hasOwn(readerKinds,a.kind)||!Object.hasOwn(readerStates,a.reviewStatus)||!Object.hasOwn(readerVisibility,a.visibility))return false;
 if(!readerObject(a.source)||!['book','author','locator'].every(k=>typeof a.source[k]==='string'))return false;
 const ev=a.evidence;if(!readerObject(ev)||typeof ev.quote!=='string'||!['selection','manual'].includes(ev.method))return false;
 if(ev.coordinateSpace!==undefined&&ev.coordinateSpace!=='lf-normalized-utf16')return false;
 if(ev.method==='manual')return ev.start===null&&ev.end===null;
 const original=readerString(text).replace(/\r\n?/g,'\n');
 return Number.isSafeInteger(ev.start)&&Number.isSafeInteger(ev.end)&&ev.start>=0&&ev.end>ev.start&&ev.end<=original.length&&original.slice(ev.start,ev.end)===ev.quote;
}
const readerNotes=e=>Array.isArray(e.readerAnnotations)?e.readerAnnotations.filter(a=>readerValidAnnotation(a,e.text)&&e.readerAnnotations.filter(n=>readerObject(n)&&n.id===a.id).length===1):[];
function readerValidateImport(r){
 if(!readerObject(r))return;
 for(const key of ['id','text','original','headword','source','book','author','locator','memo','interpretation','sepia','trans','usage','created','updated']){
  if(r[key]!==undefined&&typeof r[key]!=='string'&&!(key==='id'&&Number.isFinite(r[key])))throw new Error('백업 필드 형식이 잘못되었습니다. 전체 반입을 취소합니다.');
 }
 if(r.readerAnnotations!==undefined){
  const text=readerString(r.text)||readerString(r.original)||readerString(r.headword)||readerString(r.trans);
  if(!Array.isArray(r.readerAnnotations)||r.readerAnnotations.some(a=>!readerValidAnnotation(a,text)))throw new Error('주석 형식이 잘못되었습니다. 전체 반입을 취소합니다.');
  const ids=r.readerAnnotations.map(a=>a.id);if(new Set(ids).size!==ids.length)throw new Error('주석 ID가 중복되었습니다. 전체 반입을 취소합니다.');
 }
}
const readerLegacy=e=>['interpretation','sepia','trans','usage','memo'].filter(k=>typeof e[k]==='string'&&e[k].length).map(k=>({key:k,text:e[k]})).filter((x,i,a)=>a.findIndex(v=>v.text===x.text)===i);
function readerSourceText(s){return `책: ${readerMissing(s?.book)} · 저자: ${readerMissing(s?.author)} · 위치: ${readerMissing(s?.locator)}`}
function readerNoteHTML(a){
 const rows=[['문맥 속 의미',a.meaning],['정서적 함의',a.emotion],['정서의 대상',a.target],['근거 원문 구절',a.evidence?.quote],['출전',readerSourceText(a.source)]];
 return `<article class="reader-annotation"><h4>${esc(readerKinds[a.kind]||'구분 미확인')}</h4><dl>${rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(readerMissing(v))}</dd>`).join('')}</dl><div class="reader-meta">${esc(readerStates[a.reviewStatus]||'검토 상태 미확인')} · ${esc(readerVisibility[a.visibility]||'개인 보관')}<br>주석 ${esc(a.id)} · 버전 ${esc(a.version)}<br>작성 ${esc(dateText(a.createdAt))} · 수정 ${esc(dateText(a.updatedAt))}</div></article>`;
}
function render(){
 entries.sort((a,b)=>readerString(b.created).localeCompare(readerString(a.created)));
 const total=Math.max(1,Math.ceil(entries.length/PAGE_SIZE));page=Math.max(1,Math.min(page,total));
 const start=(page-1)*PAGE_SIZE;
 $('#orbitCount').textContent=`전체 ${entries.length}건 · 행성 ${Math.min(entries.length,PLANET_LIMIT)}개${entries.length>PLANET_LIMIT?' · 최근 100건':''}`;
 $('#recordCount').textContent=`${entries.length}건`;$('#orbitEmpty').hidden=entries.length>0;
 $('#toRen').disabled=$('#toClan').disabled=!entries.length;
 $('#cards').innerHTML=entries.slice(start,start+PAGE_SIZE).map((e,i)=>{
  const view=displayEntry(Object.fromEntries(['text','headword','source','book','author','memo','interpretation','sepia','trans','usage'].map(k=>[k,readerString(e[k])]))),notes=readerNotes(e),legacy=readerLegacy(e),lit=legacy.length||notes.length;
  return `<details class="card" id="card-${esc(e.id)}" style="--record-color:${colorOf(e.id)}"><summary><span class="card-index">${String(start+i+1).padStart(2,'0')}</span><span class="card-word">${esc(view.text||e.text)}</span><span class="card-actions"><span class="sepia-button ${lit?'is-lit':'is-empty'}">${lit?'해석 기록 있음':'해석 없음'}</span><span class="card-cue">원문 · 출전 · 독자 해석 펼치기</span></span></summary><div class="card-body">
  <div class="card-source">${esc(readerSourceText(readerSource(e)))}</div><div class="reader-actions"><button class="btn" data-reader-action="source" data-record="${esc(e.id)}">출전 보완</button></div>
  <details><summary>저장된 원문 전체</summary><p>${esc(e.text)}</p></details>
  <div class="card-label">기존 세피아 해석 · 출처 성격 미확인</div><p class="reader-note">기존 텍스트를 그대로 보존합니다. 검증된 번역이나 사람의 해석으로 판정하지 않습니다.</p>${legacy.length?legacy.map(x=>`<p data-legacy="${esc(x.key)}">${esc(x.text)}</p>`).join(''):'<p>기존 해석 미입력</p>'}
  <section class="reader-console" aria-label="독자 해석">${e.readerAnnotations!==undefined&&(!Array.isArray(e.readerAnnotations)||notes.length!==e.readerAnnotations.length)?'<p class="reader-error">형식을 확인할 수 없는 주석은 표시·수정하지 않습니다. 원본은 보존되어 JSON 백업에 포함됩니다.</p>':''}<h3>독자 해석 <span class="reader-badge">${notes.length}건</span></h3><div class="reader-note">같은 원문에도 여러 읽기가 가능합니다. 정서는 자유롭게 기록하세요.</div><div class="reader-actions"><button class="btn" data-reader-action="add" data-record="${esc(e.id)}">+ 독자 해석</button><button class="btn" data-reader-action="compare" data-record="${esc(e.id)}" ${notes.length<2?'disabled':''}>해석 비교</button></div>${notes.map(a=>`${readerNoteHTML(a)}<div class="reader-actions"><button class="btn" data-reader-action="edit" data-record="${esc(e.id)}" data-annotation="${esc(a.id)}">해석 수정 · ${esc(readerKinds[a.kind]||'미정')}</button></div>`).join('')}</section></div></details>`;
 }).join('');
 $('#pagination').hidden=total<=1;$('#pageStatus').textContent=`${page} / ${total} 페이지 · 페이지당 ${PAGE_SIZE}건`;
 $('#prevPage').disabled=page<=1;$('#nextPage').disabled=page>=total;
 buildPlanets();if(!animationStarted){animationStarted=true;requestAnimationFrame(draw)}
}
async function initStore(){
 try{if(typeof indexedDB!=='undefined'){
  db=await new Promise((ok,no)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('entries'))d.createObjectStore('entries',{keyPath:'id'});if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta')};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);r.onblocked=()=>no(new Error('다른 탭에서 저장소를 사용 중입니다.'))});
  const records=await reqP(db.transaction('entries').objectStore('entries').getAll());entries=records.map(clean);storage='idb';return;
 }}catch(e){console.warn('IndexedDB unavailable',e)}
 try{const records=JSON.parse(localStorage.getItem(LS_KEY)||'[]');if(!Array.isArray(records))throw new Error('잘못된 저장 형식');entries=records.map(clean);storage='local';readerStorageNotice('현재 localStorage에 저장합니다. JSON 백업으로 다른 기기에 옮길 수 있습니다.');return}catch(e){console.warn('Local storage unavailable',e)}
 storage='memory';readerStorageNotice('저장소를 열지 못했습니다. 기존 기록 보호를 위해 저장과 가져오기를 중단합니다. 원래 환경에서 다시 열어 주세요.');
}
function readerStorageNotice(message){const el=document.createElement('p');el.className='reader-storage';el.setAttribute('role','status');el.textContent=message;document.querySelector('main').prepend(el)}
class ReaderConflictError extends Error{}
// Read + merge + write share one IDB transaction, which serializes across tabs.
// The localStorage fallback requires a cross-tab Web Lock; never silently race.
async function readerMutate(mutate){
 let result;
 if(storage==='idb')result=await new Promise((ok,no)=>{
  const t=db.transaction('entries','readwrite'),s=t.objectStore('entries'),request=s.getAll();let next,failure;
  request.onsuccess=()=>{try{next=mutate(request.result);next.changed.forEach(rec=>s.put(rec))}catch(e){failure=e;t.abort()}};
  t.oncomplete=()=>ok(next);t.onerror=()=>no(failure||t.error);t.onabort=()=>no(failure||t.error||new Error('저장 취소'));
 });
 else if(storage==='local'){
  if(!navigator.locks?.request)throw new Error('이 브라우저에서는 다중 탭 저장 보호를 사용할 수 없어 저장을 중단합니다. Web Locks 지원 브라우저에서 다시 열어 주세요.');
  result=await navigator.locks.request('sepia-write:'+LS_KEY,async()=>{
   // Cross-process storage notifications can trail the lock grant. Begin a new
   // task before reading, and keep the lock through the write's task boundary.
   await new Promise(resolve=>setTimeout(resolve,0));
   const latest=JSON.parse(localStorage.getItem(LS_KEY)||'[]');if(!Array.isArray(latest))throw new Error('저장 형식 오류');
   const next=mutate(latest);localStorage.setItem(LS_KEY,JSON.stringify(next.records));
   await new Promise(resolve=>setTimeout(resolve,0));return next;
  });
 }else throw new Error('영구 저장소를 사용할 수 없습니다.');
 entries=result.records.map(clean);return result;
}
async function save(rec){return readerMutate(latest=>{
 if(latest.some(e=>e.id===rec.id))throw new ReaderConflictError('다른 탭에서 같은 ID를 저장했습니다. 입력을 보존했습니다. 새로고침 후 확인해 주세요.');
 return {records:[rec,...latest],changed:[rec]};
})}
async function saveMany(records){return readerMutate(latest=>{
 const ids=new Set(latest.map(e=>e.id)),fresh=records.filter(e=>!ids.has(e.id));
 return {records:[...fresh,...latest],changed:fresh,added:fresh.length};
})}
function readerChangeRecord(latest,id,change){
 const current=latest.find(e=>e.id===id);if(!current)throw new ReaderConflictError('다른 탭에서 원문 기록이 변경되었습니다. 입력을 복사해 두고 새로고침해 주세요.');
 const next=change(current);return {records:latest.map(e=>e.id===id?next:e),changed:[next]};
}
function readerSaveError(err){return err instanceof ReaderConflictError?err.message:'저장하지 못했습니다. 입력을 보존했습니다. '+(err?.message||'다시 시도해 주세요.')}
async function capture(){
 if(readerBusy)return;
 const text=$('#captureText').value.trim();if(!text){toast('포집할 단어나 문장을 적어주세요.');$('#captureText').focus();return}
 readerBusy=true;$('#captureBtn').disabled=true;
 const now=new Date().toISOString(),memo=$('#captureMemo').value;
 const rec=clean({id:makeId(),text,memo,interpretation:memo,source:$('#captureSource').value.trim(),author:$('#captureAuthor').value.trim(),locator:$('#captureLocator').value.trim(),created:now,updated:now});
 try{await save(rec);for(const id of ['captureText','captureMemo','captureSource','captureAuthor','captureLocator'])$('#'+id).value='';selectedId=rec.id;page=1;render();react('#petSepia');toast('새 원문을 포집했어요. 카드에서 독자 해석을 더할 수 있어요.')}catch(e){console.error(e);toast('저장하지 못했습니다. 입력은 남겨 두었습니다.')}finally{readerBusy=false;$('#captureBtn').disabled=false}
}
function transferText(target){
 const lines=entries.map((e,i)=>{
  const shared=readerNotes(e).filter(a=>a.visibility==='share-intent');
  return `${i+1}. ${e.text}\n   - 출전: ${readerSourceText(readerSource(e))}\n${readerLegacy(e).map(x=>`   - 기존 세피아 텍스트 (${x.key}, 출처 성격 미확인): ${x.text}`).join('\n')}\n${shared.map(a=>`   - 독자 해석 [${a.id}, v${a.version}] · ${readerKinds[a.kind]||'미정'}\n     출전: ${readerSourceText(a.source)}\n     문맥 속 의미: ${readerMissing(a.meaning)}\n     정서적 함의: ${readerMissing(a.emotion)}\n     대상: ${readerMissing(a.target)}\n     근거: ${readerMissing(a.evidence?.quote)}\n     검토: ${readerStates[a.reviewStatus]||'미확인'}`).join('\n')}`;
 });
 return `# 세피아 말뭉치 전달본\n\n수신: ${target}\n기록 수: ${entries.length}\n독자 해석은 ‘공유 의사 있음’만 포함합니다. 원문·기존 세피아 텍스트는 포함되므로 전달 전 내용을 확인하세요.\n\n${lines.join('\n\n')}\n`;
}
function readerOpen(dialog,trigger){readerReturnFocus=trigger||document.activeElement;dialog.showModal()}
function readerRestoreFocus(){if(readerReturnFocus?.isConnected)readerReturnFocus.focus();else{const card=document.getElementById('card-'+readerRecordId);card?.querySelector('summary')?.focus()}}
function readerReopenCard(id){render();const card=document.getElementById('card-'+id);if(card)card.open=true}
function readerOpenEditor(id,annotationId,trigger){
 const e=entries.find(e=>e.id===id);if(!e)return;
 const a=readerNotes(e).find(a=>a.id===annotationId);
 if(annotationId&&!a)return;
 // Never replace a foreign/malformed annotation container when adding a note.
 if(e.readerAnnotations!==undefined&&!Array.isArray(e.readerAnnotations)){toast('주석 저장 형식을 확인할 수 없어 원본을 보존합니다. JSON 백업을 확인해 주세요.');return}
 readerRecordId=id;readerAnnotationId=annotationId||'';readerBaseAnnotation=a?structuredClone(a):null;$('#readerForm').reset();$('#readerError').textContent='';
 $('#readerTitle').textContent=a?'독자 해석 수정':'새 독자 해석';$('#readerOriginal').value=e.text;
 const s=a?.source||readerSource(e);
 $('#readerSourceDetails').open=false;$('#readerSourceSummary').textContent='출전 확인·보완 · '+readerSourceText(s);
 for(const [id,value] of Object.entries({readerBook:s.book,readerAuthor:s.author,readerLocator:s.locator,readerMeaning:a?.meaning,readerEmotion:a?.emotion,readerTarget:a?.target,readerEvidence:a?.evidence?.quote}))$('#'+id).value=readerString(value);
 $('#readerKind').value=a?.kind||'undecided';$('#readerStatus').value=a?.reviewStatus||'draft';$('#readerVisibility').value=a?.visibility||'private';
 $('#readerEvidence').dataset.start=String(a?.evidence?.start??'');$('#readerEvidence').dataset.end=String(a?.evidence?.end??'');
 $('#readerVersion').textContent=a?`주석 ${a.id} · 버전 ${a.version} · 변경 저장 시 버전 증가`:'기존 출전을 상속했습니다. 빈 출전은 미확인으로 보관합니다.';
 readerOpen($('#readerDialog'),trigger);
}
function readerAnnotationPayload(){
 const evidence=$('#readerEvidence'),quote=evidence.value,start=Number(evidence.dataset.start),end=Number(evidence.dataset.end),original=$('#readerOriginal').value;
 const anchored=quote.length&&evidence.dataset.start!==''&&original.slice(start,end)===quote;
 return {source:{book:$('#readerBook').value,author:$('#readerAuthor').value,locator:$('#readerLocator').value},meaning:$('#readerMeaning').value,emotion:$('#readerEmotion').value,target:$('#readerTarget').value,kind:$('#readerKind').value,reviewStatus:$('#readerStatus').value,visibility:$('#readerVisibility').value,evidence:{quote,start:anchored?start:null,end:anchored?end:null,method:anchored?'selection':'manual',coordinateSpace:'lf-normalized-utf16'}};
}
async function readerSaveAnnotation(event){
 event.preventDefault();if(readerBusy)return;
 const e=entries.find(e=>e.id===readerRecordId),payload=readerAnnotationPayload();if(!e)return;
 if(![payload.meaning,payload.emotion,payload.target].some(v=>v.trim())){$('#readerError').textContent='문맥 속 의미, 정서적 함의, 대상 중 하나 이상을 적어 주세요.';$('#readerMeaning').focus();return}
 if(payload.evidence.quote.trim()&&!e.text.replace(/\r\n?/g,'\n').includes(payload.evidence.quote)){$('#readerError').textContent='근거 구절이 저장된 원문과 일치하지 않습니다. 원문에서 선택하거나 정확히 옮겨 주세요.';$('#readerEvidence').focus();return}
 const old=readerBaseAnnotation;
 if(readerAnnotationId&&!old){$('#readerError').textContent='수정할 주석을 찾지 못했습니다.';return}
 const keys=Object.keys(payload);
 if(old&&keys.every(k=>JSON.stringify(old[k])===JSON.stringify(payload[k]))){$('#readerDialog').close();toast('변경이 없어 기존 버전을 유지했어요.');return}
 const now=new Date().toISOString(),a={...old,...payload,id:old?.id||`annotation-${makeId()}`,schemaVersion:1,createdAt:old?.createdAt||now,updatedAt:now,version:old?(Number(old.version)||1)+1:1};
 readerBusy=true;$('#readerSave').disabled=true;
 try{await readerMutate(latest=>readerChangeRecord(latest,e.id,current=>{
  if(current.text!==e.text)throw new ReaderConflictError('다른 탭에서 원문이 변경되었습니다. 입력을 복사해 두고 새로고침해 주세요.');
  const all=current.readerAnnotations??[];if(!Array.isArray(all))throw new Error('기존 주석 형식을 확인할 수 없습니다.');
  const matches=all.filter(n=>readerObject(n)&&n.id===a.id),actual=matches[0];
  if(old&&(matches.length!==1||JSON.stringify(actual)!==JSON.stringify(old)))throw new ReaderConflictError('다른 탭에서 같은 해석이 변경되었습니다. 입력을 복사해 두고 창을 닫은 뒤 새로고침하여 비교해 주세요.');
  if(!old&&matches.length)throw new ReaderConflictError('다른 탭에서 같은 주석 ID를 저장했습니다. 입력을 보존했습니다.');
  if(!readerValidAnnotation(a,current.text))throw new Error('주석 저장 형식을 확인할 수 없습니다.');
  return {...current,readerAnnotations:old?all.map(n=>n===actual?a:n):[...all,a],updated:now};
 }));readerReopenCard(e.id);$('#readerDialog').close();toast('독자 해석을 저장했어요.')}catch(err){console.error(err);$('#readerError').textContent=readerSaveError(err)}finally{readerBusy=false;$('#readerSave').disabled=false}
}
function readerCompare(id,trigger){
 const e=entries.find(e=>e.id===id),notes=e?readerNotes(e):[];if(notes.length<2)return;
 readerRecordId=id;
 const options=notes.map((a,i)=>`<option value="${i}">${i+1}. ${esc(readerKinds[a.kind]||'미정')} · ${esc(readerString(a.meaning||a.emotion).slice(0,35))}</option>`).join('');
 $('#readerCompareLeft').innerHTML=options;$('#readerCompareRight').innerHTML=options;$('#readerCompareRight').value='1';
 const update=()=>{$('#readerComparison').innerHTML=readerNoteHTML(notes[Number($('#readerCompareLeft').value)])+readerNoteHTML(notes[Number($('#readerCompareRight').value)])};
 $('#readerCompareLeft').onchange=update;$('#readerCompareRight').onchange=update;update();readerOpen($('#readerCompareDialog'),trigger);
}
document.body.insertAdjacentHTML('beforeend',`
<dialog id="readerDialog" class="reader-modal" aria-labelledby="readerTitle"><form id="readerForm" class="modal"><h2 id="readerTitle">새 독자 해석</h2><p>문맥과 정서를 자유롭게 적으세요. 정답이나 자동 점수는 없습니다. 저장은 이 브라우저에만 남습니다.</p>
<label class="reader-field">근거를 고를 원문 (읽기 전용)<textarea id="readerOriginal" class="reader-original" readonly></textarea></label><button class="btn" type="button" id="readerSelectEvidence">선택한 원문을 근거로</button><p class="reader-help">마우스·터치로 구절을 선택하거나, 키보드 Shift + 방향키로 선택한 뒤 Tab으로 버튼에 이동하세요. 아래에 직접 옮겨 적어도 됩니다.</p>
<details id="readerSourceDetails" class="reader-source-fields"><summary id="readerSourceSummary">출전 확인·보완</summary><fieldset><legend>출전 · 원문 기록에서 상속</legend><div class="reader-grid"><label class="reader-field">책<input id="readerBook" placeholder="미확인"></label><label class="reader-field">저자<input id="readerAuthor" placeholder="미확인"></label></div><label class="reader-field">쪽수 또는 원문 위치<input id="readerLocator" placeholder="미확인 · 예: 23쪽, 2장 4절"></label><div class="reader-help">이 해석의 출전 사본입니다. 수정해도 원문 카드의 출전은 바뀌지 않습니다.</div></fieldset></details>
<label class="reader-field">문맥 속 의미<textarea id="readerMeaning" placeholder="앞뒤 문맥에서 어떻게 읽었나요?"></textarea></label><div class="reader-grid"><label class="reader-field">정서적 함의<textarea id="readerEmotion" placeholder="복합적이거나 모순된 감정도 자유롭게"></textarea></label><label class="reader-field">정서의 대상<textarea id="readerTarget" placeholder="인물, 사건, 독자 자신 등"></textarea></label></div><label class="reader-field">근거 원문 구절<textarea id="readerEvidence" placeholder="원문 구절 · 없으면 미확인"></textarea></label>
<div class="reader-grid"><label class="reader-field">해석의 성격<select id="readerKind"><option value="undecided">미정</option><option value="literary">문헌 해석</option><option value="association">개인 연상</option></select></label><label class="reader-field">검토 상태<select id="readerStatus"><option value="draft">작성 중</option><option value="reviewed">검토함 (작성자 표시)</option><option value="revisit">재검토 필요</option></select></label></div>
<label class="reader-field">보관과 공유 의사<select id="readerVisibility"><option value="private">개인 보관</option><option value="share-intent">공유 의사 있음</option></select></label><p class="reader-help">‘공유 의사 있음’은 전달본에 포함한다는 표시입니다. 서버로 전송하지 않습니다. JSON 백업에는 개인 주석도 모두 들어갑니다.</p><div id="readerVersion" class="reader-meta"></div><div id="readerError" class="reader-error" role="alert"></div><div class="modal-actions"><button class="btn" type="button" data-reader-close="readerDialog">취소</button><button class="btn primary" type="submit" id="readerSave">해석 저장</button></div></form></dialog>
<dialog id="readerSourceDialog" class="reader-modal" aria-labelledby="readerSourceTitle"><form id="readerSourceForm" class="modal"><h2 id="readerSourceTitle">원문 출전 보완</h2><p>원문 텍스트와 기존 해석은 보존합니다. 이미 작성한 독자 해석의 출전 사본은 그대로 남습니다.</p><label class="reader-field">책<input id="readerSourceBook" placeholder="미확인"></label><label class="reader-field">저자<input id="readerSourceAuthor" placeholder="미확인"></label><label class="reader-field">쪽수 또는 원문 위치<input id="readerSourceLocator" placeholder="미확인"></label><div id="readerSourceError" class="reader-error" role="alert"></div><div class="modal-actions"><button class="btn" type="button" data-reader-close="readerSourceDialog">취소</button><button class="btn primary" id="readerSourceSave">출전 저장</button></div></form></dialog>
<dialog id="readerCompareDialog" class="reader-modal" aria-labelledby="readerCompareTitle"><div class="modal"><h2 id="readerCompareTitle">같은 원문의 두 해석</h2><p>정서나 해석에 순위와 점수를 매기지 않습니다.</p><div class="reader-grid"><label class="reader-field">왼쪽 해석<select id="readerCompareLeft"></select></label><label class="reader-field">오른쪽 해석<select id="readerCompareRight"></select></label></div><div id="readerComparison" class="reader-compare"></div><div class="modal-actions"><button class="btn" data-reader-close="readerCompareDialog">닫기</button></div></div></dialog>`);
$('#captureMemo').insertAdjacentHTML('beforebegin','<input id="captureLocator" aria-label="쪽수 또는 원문 위치" placeholder="쪽수 또는 원문 위치 (선택)">');
$('#captureMemo').setAttribute('placeholder','기존 세피아 해석 텍스트 (선택 · 출처 성격 미확인)');
$('#captureMemo').setAttribute('aria-label','기존 세피아 해석 텍스트 (출처 성격 미확인)');
$('#transferDialog').setAttribute('aria-labelledby','transferTitle');$('#transferPreview').setAttribute('aria-label','전달본 내용');
document.querySelector('#transferDialog .modal p').textContent='독자 해석은 공유 의사를 표시한 것만 포함합니다. 원문과 기존 텍스트도 확인한 뒤 복사하거나 파일로 받으세요. 자동 전송은 없습니다.';
$('#exportBackup').setAttribute('title','개인 주석을 포함한 모든 기록을 JSON으로 저장합니다.');
$('#cards').addEventListener('click',event=>{const b=event.target.closest('[data-reader-action]');if(!b)return;const id=b.dataset.record;
 if(b.dataset.readerAction==='add'||b.dataset.readerAction==='edit')readerOpenEditor(id,b.dataset.annotation,b);
 if(b.dataset.readerAction==='compare')readerCompare(id,b);
 if(b.dataset.readerAction==='source'){const e=entries.find(e=>e.id===id);if(!e)return;readerRecordId=id;readerSourceId=id;const s=readerSource(e);readerBaseSource={...s};$('#readerSourceBook').value=s.book;$('#readerSourceAuthor').value=s.author;$('#readerSourceLocator').value=s.locator;$('#readerSourceError').textContent='';readerOpen($('#readerSourceDialog'),b)}
});
document.querySelectorAll('[data-reader-close]').forEach(b=>b.addEventListener('click',()=>{if(!readerBusy)$('#'+b.dataset.readerClose).close()}));
for(const id of ['readerDialog','readerSourceDialog','readerCompareDialog']){$('#'+id).addEventListener('close',readerRestoreFocus);$('#'+id).addEventListener('cancel',e=>{if(readerBusy)e.preventDefault()})}
$('#readerForm').addEventListener('submit',readerSaveAnnotation);
// Some Chromium builds do not move the caret with arrows in a readonly textarea.
// Keep the original immutable while providing explicit keyboard range selection.
$('#readerOriginal').addEventListener('keydown',event=>{
 if(event.altKey||event.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 if(event.ctrlKey&&!['Home','End'].includes(event.key))return;
 const el=event.currentTarget,start=el.selectionStart,end=el.selectionEnd,backward=el.selectionDirection==='backward';
 let focus=backward?start:end,anchor=backward?end:start;
 if(!event.shiftKey){anchor=focus;if(start!==end&&event.key==='ArrowLeft')focus=start;else if(start!==end&&event.key==='ArrowRight')focus=end;else if(event.key==='ArrowLeft')focus=Math.max(0,focus-1);else if(event.key==='ArrowRight')focus=Math.min(el.value.length,focus+1)}
 else if(event.key==='ArrowLeft')focus=Math.max(0,focus-1);else if(event.key==='ArrowRight')focus=Math.min(el.value.length,focus+1);
 if(event.key==='Home')focus=event.ctrlKey?0:el.value.lastIndexOf('\n',Math.max(0,focus-1))+1;
 if(event.key==='End'){const next=el.value.indexOf('\n',focus);focus=event.ctrlKey||next<0?el.value.length:next}
 event.preventDefault();if(!event.shiftKey)anchor=focus;
 el.setSelectionRange(Math.min(anchor,focus),Math.max(anchor,focus),focus<anchor?'backward':'forward');
});
$('#readerSelectEvidence').addEventListener('click',()=>{const original=$('#readerOriginal'),start=original.selectionStart,end=original.selectionEnd;if(start===end){$('#readerError').textContent='먼저 원문 구절을 선택해 주세요.';original.focus();return}const evidence=$('#readerEvidence');evidence.value=original.value.slice(start,end);evidence.dataset.start=String(start);evidence.dataset.end=String(end);$('#readerError').textContent='';evidence.focus()});
$('#readerEvidence').addEventListener('input',()=>{$('#readerEvidence').dataset.start='';$('#readerEvidence').dataset.end=''});
$('#readerSourceForm').addEventListener('submit',async event=>{event.preventDefault();if(readerBusy)return;const e=entries.find(e=>e.id===readerSourceId);if(!e)return;
 const source={book:$('#readerSourceBook').value,author:$('#readerSourceAuthor').value,locator:$('#readerSourceLocator').value};
 if(JSON.stringify(source)===JSON.stringify(readerSource(e))){$('#readerSourceDialog').close();return}
 const change=current=>{if(JSON.stringify(readerSource(current))!==JSON.stringify(readerBaseSource))throw new ReaderConflictError('다른 탭에서 출전이 변경되었습니다. 입력을 복사해 두고 새로고침하여 비교해 주세요.');return {...current,book:source.book,author:source.author,locator:source.locator,updated:new Date().toISOString()}};
 readerBusy=true;$('#readerSourceSave').disabled=true;try{await readerMutate(latest=>readerChangeRecord(latest,e.id,change));readerReopenCard(e.id);$('#readerSourceDialog').close();toast('출전을 보완했어요.')}catch(err){console.error(err);$('#readerSourceError').textContent=readerSaveError(err)}finally{readerBusy=false;$('#readerSourceSave').disabled=false}
});
// Replace import/export listeners only; retain all other original UI behavior.
for(const id of ['backupFile','exportBackup']){const old=$('#'+id),fresh=old.cloneNode(true);old.replaceWith(fresh)}
$('#exportBackup').addEventListener('click',()=>{const data={app:'SAPIENS_SEPIA_CORPUS',version:2,readerAnnotationSchema:1,exportedAt:new Date().toISOString(),entries},blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`sepia-corpus-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('개인 주석을 포함한 전체 JSON 백업을 만들었어요.')});
$('#backupFile').addEventListener('change',async event=>{
 const file=event.target.files?.[0];event.target.value='';if(!file||readerBusy)return;readerBusy=true;
 try{const parsed=JSON.parse(await file.text()),raw=Array.isArray(parsed)?parsed:parsed?.entries;if(!Array.isArray(raw))throw new Error('invalid backup');raw.forEach(readerValidateImport);const known=new Set(entries.map(e=>e.id)),fresh=[];let duplicate=0,invalid=0;
 for(const item of raw){if(!item||typeof item!=='object'||Array.isArray(item)){invalid++;continue}const rec=clean(item);if(!rec.text.trim()){invalid++;continue}if(known.has(rec.id)){duplicate++;continue}known.add(rec.id);fresh.push(rec)}
 const result=await saveMany(fresh);duplicate+=fresh.length-result.added;page=1;render();toast(`${result.added}건 추가 · 같은 ID ${duplicate}건 유지 · 빈/잘못된 기록 ${invalid}건 제외`);
 }catch(err){console.error(err);toast('백업을 불러오지 못했습니다. 기존 기록을 유지합니다.')}finally{readerBusy=false}
});
