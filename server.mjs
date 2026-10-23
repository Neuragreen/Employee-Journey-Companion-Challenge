import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { secureAPI } from './core/secure-api.js';
import { importPack } from './core/import-pack.js';
import { packStore, packManifest, packEmployee } from './core/pack-store.js';
import { answerLocally, localModelStatus } from './core/local-ai.js';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const assets={'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/favicon.svg':'favicon.svg','/secure.js':'secure.js','/secure.css':'secure.css'};
const types={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml'};
export const CSP="default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
export function makeServer({evaluationMode=false,accountsPath=resolve(fileURLToPath(new URL('./local-data/accounts.json',import.meta.url))),model=process.env.LOCAL_MODEL,fetcher=fetch,packPath=resolve(fileURLToPath(new URL('./local-data/active-pack.json',import.meta.url)))}={}){
 const store=packStore(packPath);
 const secure=secureAPI({store,model,fetcher,accountsPath});
 return createServer(async(req,res)=>{
  const host=req.headers.host||'';
  const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':CSP});res.end(JSON.stringify(data));};
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)){send(403,{error:'Only loopback hosts allowed.'});return;}
  try{
   const url=new URL(req.url,'http://'+host);
   await store.ready;
   if(!evaluationMode&&url.pathname.startsWith('/api/')){if(await secure(req,res,url))return;}
   if(!evaluationMode&&['/data.js','/engine.js','/import-pack.js','/app.js'].includes(url.pathname)){send(403,{error:'Evaluation assets disabled'});return;}
   if(url.pathname==='/api/pack'&&req.method==='GET'){send(200,store.get()?packManifest(store.get()):{id:null,error:store.error()});return;}
   if(url.pathname==='/api/pack/employee'&&req.method==='GET'){const p=packEmployee(store.get(),url.searchParams.get('id'));send(p?200:404,p||{error:'Employee not found in the active pack.'});return;}
   if(['/api/pack/validate','/api/pack/import','/api/pack/withdraw'].includes(url.pathname)&&req.method==='POST'){
    if(req.headers['x-companion-local']!=='1'||req.headers.origin!=='http://'+host||!req.headers['content-type']?.startsWith('application/json')){send(403,{error:'Same-origin local application request required.'});return;}
    let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>48*1024*1024){send(413,{error:'Pack exceeds 20 MiB content limit.'});return;}}
    let input;try{input=JSON.parse(text);}catch{send(400,{error:'Invalid JSON.'});return;}
    if(url.pathname.endsWith('/withdraw')){send(await store.withdraw(input.employeeId)?200:404,{ok:true});return;}
    if(input.syntheticOnly!==true){send(400,{error:'Confirm that this pack contains synthetic data only.'});return;}
    const result=importPack(input.files,{columnMapping:input.columnMapping,asOf:input.asOf});
    if(!result.report.ok||url.pathname.endsWith('/validate')){send(result.report.ok?200:422,{report:result.report});return;}
    const pack=await store.save(result.pack);send(200,{manifest:packManifest(pack)});return;
   }
   if(url.pathname==='/api/local-status'&&req.method==='GET'){send(200,await localModelStatus(model,fetcher));return;}
   if(url.pathname==='/api/local-chat'&&req.method==='POST'){
    if(req.headers['x-companion-local']!=='1'||req.headers.origin!=='http://'+host||!req.headers['content-type']?.startsWith('application/json')){send(403,{error:'Same-origin local application request required.'});return;}
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>20000){send(413,{error:'Request too large.'});return;}}
    let input;try{input=JSON.parse(body);}catch{send(400,{error:'Invalid JSON.'});return;}
    try{send(200,await answerLocally(input,{model,fetcher,policies:store.get()?.policies}));}catch{send(503,{error:'Local AI could not verify an answer. No external fallback was used.'});}return;
   }
   if(req.method!=='GET'||!assets[url.pathname]){send(404,{error:'Not found.'});return;}
   const file=assets[url.pathname],body=await readFile(resolve(root,file));
   res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)]+'; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(body);
  }catch{send(500,{error:'The local server could not complete this request.'});}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const port=Number(process.env.PORT||4173);
 makeServer().listen(port,'127.0.0.1',()=>console.log(`Local: http://localhost:${port}\nInference: loopback only; external fallback disabled.`));
}
