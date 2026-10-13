const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
async function resolveHTML(){
 let html='';let failure;
 const wrapper=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const script=wrapper.match(/<script>([\s\S]*?)<\/script>/)[1];
 await vm.runInNewContext(script,{fetch:async name=>({ok:true,text:async()=>fs.readFileSync(path.join(root,name),'utf8')}),document:{open(){},write(value){html=value},close(){},getElementById(){failure=new Error('Loader failed');return {}}},console});
 if(failure||!html.includes('readerSaveAnnotation'))throw failure||new Error('Missing reader console');
 const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(code);
 return html;
}
if(require.main===module)resolveHTML().then(html=>{
 const output=path.resolve(root,'../review');fs.mkdirSync(output,{recursive:true});
 // Review copy always uses separate stores, even if opened on the production origin.
 html=html.replace("DB_NAME='corpus_notebook'","DB_NAME='sepia_reader_review_only'").replace("LS_KEY='corpus_notebook_data_v2'","LS_KEY='sepia_reader_review_only_v2'");
 html=html.replace('<body>','<body><aside id="readerReviewBanner">검수 전용 · 공개 사이트 기록과 분리된 저장소 · 합성 데이터만 사용하세요.</aside>');
 fs.writeFileSync(path.join(output,'sepia-reader-review.html'),html);
 console.log('Standalone review HTML built; JavaScript syntax verified; isolated review storage.');
}).catch(e=>{console.error(e);process.exitCode=1});
module.exports={resolveHTML};
