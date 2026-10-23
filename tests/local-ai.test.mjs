import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {answerLocally,localModelStatus,minimalJourney,validateModel,LOCAL_RUNTIME} from '../core/local-ai.js';
const context={journey:'onboarding',day:5,steps:[{title:'Collect IT kit',status:'overdue',day:3,owner:{name:'Daniel'}}],name:'PRIVATE NAME',id:'PRIVATE-ID',pulses:[{comment:'PRIVATE FEEDBACK'}]};
const info={model_info:{'general.architecture':'llama'}};
const json=value=>new Response(JSON.stringify(value),{status:200});
test('cloud names and external URLs are rejected before networking',async()=>{
 for(const model of ['model:cloud','https://example.com','../model'])assert.throws(()=>validateModel(model));
 let count=0;const s=await localModelStatus('model:cloud',async()=>{count++;});assert.equal(s.available,false);assert.equal(count,0);
});
test('unconfigured local AI performs no network requests',async()=>{
 let count=0;const s=await answerLocally({message:'laptop',context},{fetcher:async()=>{count++;}});assert.equal(s.available,false);assert.equal(count,0);
});
test('cloud metadata and absent local metadata fail closed',async()=>{
 for(const value of [{remote_host:'https://cloud.example',model_info:{}},{}]){
  const s=await localModelStatus('custom',async()=>json(value));assert.equal(s.available,false);
 }
});
test('inference only calls fixed loopback endpoints, disables redirects and excludes feedback',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return json(url.endsWith('/show')?info:{message:{content:JSON.stringify({supported:true,text:'For the synthetic onboarding journey, IT aims to issue the employee’s equipment by the end of journey day 3.',source_ids:['equipment']})}});};
 const a=await answerLocally({message:'When should my laptop arrive?',context},{model:'local-test',fetcher});
 assert.equal(a.mode,'local-model');assert.equal(a.policy,'equipment');assert.equal(a.citations[0].code,'DEMO-IT-01');
 assert.equal(calls.length,2);
 for(const c of calls){assert.ok(c.url.startsWith(LOCAL_RUNTIME+'/api/'));assert.equal(c.options.redirect,'error');assert.ok(!c.options.body.includes('PRIVATE'));}
 assert.equal(JSON.parse(calls[1].options.body).stream,false);
});
test('unknown questions abstain without sending them to the model',async()=>{
 let count=0;const a=await answerLocally({message:'What is my pension?',context},{model:'local-test',fetcher:async()=>{count++;return json(info);}});assert.equal(a.unsupported,true);assert.equal(count,1);
});
test('invented source IDs and malformed output never become verified answers',async()=>{
 for(const content of ['bad-json',JSON.stringify({supported:true,text:'Invented entitlement',source_ids:['fake']})]){
  const fetcher=async url=>json(url.endsWith('/show')?info:{message:{content}});
  try{const result=await answerLocally({message:'laptop',context},{model:'local-test',fetcher});assert.equal(result.unsupported,true);}catch(e){assert.match(e.message,/Invalid local model answer/);}
 }
});
test('runtime failures never retry an external provider',async()=>{
 const calls=[];const a=await answerLocally({message:'laptop',context},{model:'local-test',fetcher:async url=>{calls.push(url);throw new Error('offline');}});assert.equal(a.available,false);assert.deepEqual(calls,[LOCAL_RUNTIME+'/api/show']);
});
test('journey context explicitly allowlists fields',()=>{
 const safe=minimalJourney(context);assert.equal(safe.name,undefined);assert.equal(safe.pulses,undefined);assert.equal(safe.id,undefined);
});
test('frontend assets have no remote font or script dependency and restrict connections',async()=>{
 const css=await readFile(new URL('../dist/styles.css',import.meta.url),'utf8');const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.ok(!/@import|https?:\/\//.test(css));assert.match(html,/connect-src &#39;self&#39;|connect-src 'self'/);assert.ok(!/src="https?:|href="https?:/.test(html));
});
