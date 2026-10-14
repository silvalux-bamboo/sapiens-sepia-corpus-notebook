const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),results=[],stamp='2026-01-01T00:00:00.000Z';
const note={id:'synthetic-note',schemaVersion:1,version:1,createdAt:stamp,updatedAt:stamp,source:{book:'synthetic book',author:'synthetic author',locator:''},meaning:'synthetic interpretation',emotion:'',target:'',kind:'literary',reviewStatus:'draft',visibility:'private',evidence:{quote:'',start:null,end:null,method:'manual',coordinateSpace:'lf-normalized-utf16'}};
const seed={id:'synthetic-safe',text:'Synthetic original.',created:stamp,updated:stamp,source:'synthetic book',interpretation:'Unverified synthetic text',readerAnnotations:[note],extra:{preserve:true}};
let browser,server;
const check=async(name,fn)=>{await fn();results.push({name,result:'PASS'});console.log('PASS '+name)};
async function main(){
 server=http.createServer((req,res)=>{if(req.url==='/blank'){res.end('<!doctype html><html><body>test</body></html>');return}const name=req.url==='/'?'index.html':req.url.slice(1),file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file))});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,channel:'msedge'});
 for(const mode of ['idb','local']){
  const context=await browser.newContext();if(mode==='local')await context.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw Error('synthetic blocked IDB')}}));
  const a=await context.newPage(),b=await context.newPage(),errors=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));await a.goto(url+'/blank');
  const data=async(records=null)=>a.evaluate(async({mode,records})=>{
   if(mode==='local'){if(records)localStorage.setItem('corpus_notebook_data_v2',JSON.stringify(records));return JSON.parse(localStorage.getItem('corpus_notebook_data_v2')||'[]')}
   const db=await new Promise(ok=>{const r=indexedDB.open('corpus_notebook',1);r.onupgradeneeded=()=>{r.result.createObjectStore('entries',{keyPath:'id'});r.result.createObjectStore('meta')};r.onsuccess=()=>ok(r.result)});
   if(records)await new Promise((ok,no)=>{const t=db.transaction('entries','readwrite');records.forEach(rec=>t.objectStore('entries').put(rec));t.oncomplete=ok;t.onabort=()=>no(t.error)});
   const all=await new Promise(ok=>{const r=db.transaction('entries').objectStore('entries').getAll();r.onsuccess=()=>ok(r.result)});db.close();return all;
  },{mode,records});
  await data([seed]);
  const load=async p=>{await p.goto(url);await p.waitForSelector('#card-synthetic-safe');await p.locator('#card-synthetic-safe').evaluate(el=>el.open=true)};
  await Promise.all([load(a),load(b)]);
  const upload=async records=>{await a.locator('#backupFile').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(records))});await a.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('불러오지 못'))};
  await check(mode+': malformed nested fields atomically reject entire import and survive reload',async()=>{
   const mutations=[n=>n.id={toString:0},n=>n.version={},n=>n.createdAt={},n=>n.updatedAt=null,n=>n.source.book={toString:0},n=>n.source=[],n=>n.evidence.quote={},n=>n.evidence.start={},n=>n.kind={},n=>n.visibility='constructor',n=>n.reviewStatus=[],n=>n.target={},n=>n.schemaVersion=999];
   for(let i=0;i<mutations.length;i++){const bad=structuredClone(note);mutations[i](bad);const before=await data();await upload([{...seed,id:'valid-first-'+i},{...seed,id:'invalid-'+i,readerAnnotations:[bad]}]);assert.deepEqual(await data(),before);await load(a);assert.equal(await a.locator('#card-synthetic-safe .reader-annotation').count(),1)}
   await upload([{...seed,id:'valid-first'},{...seed,id:'duplicate',readerAnnotations:[note,note]}]);assert.deepEqual(await data(),[seed]);await load(a);
  });
  await check(mode+': persisted malformed note safely quarantined and exported unchanged',async()=>{
   const bad={...seed,id:'synthetic-bad',readerAnnotations:[{...note,id:{toString:0}},{...note,id:'valid-note'}]};await data([...(await data()),bad]);await load(a);await a.locator('#card-synthetic-bad').evaluate(el=>el.open=true);
   assert.match(await a.locator('#card-synthetic-bad').textContent(),/형식을 확인할 수 없는 주석/);assert.equal(await a.locator('#card-synthetic-bad .reader-annotation').count(),1);
   const d=a.waitForEvent('download');await a.locator('#exportBackup').click();const exported=JSON.parse(fs.readFileSync(await(await d).path(),'utf8'));assert.deepEqual(exported.entries.find(r=>r.id===bad.id),bad);
  });
  if(mode==='idb')await check('idb: failure after first put aborts whole import',async()=>{
   const before=await data();await a.evaluate(()=>{const put=IDBObjectStore.prototype.put;window.restorePut=()=>IDBObjectStore.prototype.put=put;IDBObjectStore.prototype.put=function(value,...args){if(value.id==='fail-second')throw Error('synthetic second write failure');return put.call(this,value,...args)}});
   await upload([{...seed,id:'valid-first'},{...seed,id:'fail-second'}]);assert.deepEqual(await data(),before);await a.evaluate(()=>window.restorePut());await load(a);
  });
  await Promise.all([load(a),load(b)]);
  const add=async(p,value)=>{await p.locator('#card-synthetic-safe [data-reader-action="add"]').click();await p.fill('#readerMeaning',value)};
  const closed=p=>p.waitForFunction(()=>!document.querySelector('#readerDialog').open);
  const saveBoth=async()=>{await Promise.all([a.locator('#readerSave').click(),b.locator('#readerSave').click()])};
  await check(mode+': simultaneous stale-tab additions preserve both',async()=>{await Promise.all([add(a,'tab A addition'),add(b,'tab B addition')]);await saveBoth();await Promise.all([closed(a),closed(b)]);const r=(await data()).find(r=>r.id===seed.id);assert.equal(r.readerAnnotations.length,3);assert.ok(r.readerAnnotations.some(n=>n.meaning==='tab A addition'));assert.ok(r.readerAnnotations.some(n=>n.meaning==='tab B addition'));assert.equal(r.interpretation,seed.interpretation)});
  await Promise.all([load(a),load(b)]);
  const edit=async(p,id,value)=>{await p.locator(`#card-synthetic-safe [data-annotation="${id}"]`).click();await p.fill('#readerMeaning',value)};
  await check(mode+': same-note conflict keeps one winner and losing input, including after reload',async()=>{
   await Promise.all([edit(a,note.id,'tab A revision'),edit(b,note.id,'tab B revision')]);await saveBoth();
   for(const p of [a,b])await p.waitForFunction(()=>!document.querySelector('#readerDialog').open||document.querySelector('#readerError').textContent.includes('다른 탭'));
   const aOpen=await a.locator('#readerDialog').evaluate(el=>el.open),bOpen=await b.locator('#readerDialog').evaluate(el=>el.open);assert.notEqual(aOpen,bOpen);
   const loser=aOpen?a:b,winner=aOpen?'tab B revision':'tab A revision';assert.equal(await loser.inputValue('#readerMeaning'),aOpen?'tab A revision':'tab B revision');assert.match(await loser.locator('#readerError').textContent(),/다른 탭에서 같은 해석/);
   const saved=(await data()).find(r=>r.id===seed.id);assert.equal(saved.readerAnnotations.length,3);assert.equal(saved.readerAnnotations.find(n=>n.id===note.id).version,2);assert.equal(saved.readerAnnotations.find(n=>n.id===note.id).meaning,winner);
   await Promise.all([load(a),load(b)]);assert.equal((await data()).find(r=>r.id===seed.id).readerAnnotations.find(n=>n.id===note.id).meaning,winner);
  });
  await check(mode+': different-note concurrent edits preserve both revisions',async()=>{const notes=(await data()).find(r=>r.id===seed.id).readerAnnotations;await Promise.all([edit(a,notes[1].id,'different A'),edit(b,notes[2].id,'different B')]);await saveBoth();await Promise.all([closed(a),closed(b)]);const after=(await data()).find(r=>r.id===seed.id).readerAnnotations;assert.equal(after.find(n=>n.id===notes[1].id).meaning,'different A');assert.equal(after.find(n=>n.id===notes[2].id).meaning,'different B')});
  await Promise.all([load(a),load(b)]);
  await check(mode+': source edit and annotation addition merge without loss',async()=>{await a.locator('#card-synthetic-safe [data-reader-action="source"]').click();await a.fill('#readerSourceLocator','synthetic page 55');await add(b,'added with source update');await Promise.all([a.locator('#readerSourceSave').click(),b.locator('#readerSave').click()]);await a.waitForFunction(()=>!document.querySelector('#readerSourceDialog').open);await closed(b);const r=(await data()).find(r=>r.id===seed.id);assert.equal(r.locator,'synthetic page 55');assert.equal(r.readerAnnotations.length,4)});
  await check(mode+': ten repeated concurrent-add rounds preserve every annotation',async()=>{
   for(let round=0;round<10;round++){
    await Promise.all([load(a),load(b)]);const before=(await data()).find(r=>r.id===seed.id).readerAnnotations.length;
    await Promise.all([add(a,'stress A '+round),add(b,'stress B '+round)]);await saveBoth();await Promise.all([closed(a),closed(b)]);
    const notes=(await data()).find(r=>r.id===seed.id).readerAnnotations;assert.equal(notes.length,before+2);assert.ok(notes.some(n=>n.meaning==='stress A '+round));assert.ok(notes.some(n=>n.meaning==='stress B '+round));
   }
  });
  await check(mode+': no runtime errors',()=>assert.deepEqual(errors,[]));await context.close();
 }
 const context=await browser.newContext();await context.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{get(){throw Error('synthetic blocked')}});Object.defineProperty(navigator,'locks',{value:undefined})});const p=await context.newPage();await p.goto(url);await p.waitForSelector('#readerDialog',{state:'attached'});
 await check('local: missing Web Locks fails closed',async()=>{await p.fill('#captureText','synthetic unsupported locks');await p.locator('#captureBtn').click();await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('저장하지 못'));assert.equal(await p.inputValue('#captureText'),'synthetic unsupported locks');assert.equal(await p.evaluate(()=>localStorage.getItem('corpus_notebook_data_v2')),null)});await context.close();
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,'test-results','storage-safety-results.json'),JSON.stringify({browser:await browser.version(),results},null,2));console.log(`${results.length} safety checks passed.`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.close()});
