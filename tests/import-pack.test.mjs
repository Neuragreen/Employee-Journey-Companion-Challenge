import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture} from './helpers/pack-fixture.mjs';
import {parseCSV,importPack,parseJourneyMaps,rankPolicies} from '../core/import-pack.js';
import {journeySteps,friction,answerQuestion,buildHandoff} from '../core/engine.js';
import {answerLocally} from '../core/local-ai.js';
import {packStore,packEmployee,packManifest} from '../core/pack-store.js';
import {makeServer} from '../server.mjs';
const good=()=>{const result=importPack(fixture());assert.equal(result.report.ok,true,JSON.stringify(result.report));return result.pack;};
const request=(server,path,{method='GET',body,headers={}}={})=>new Promise(resolve=>{
 const req={url:path,method,headers:{host:'localhost:4173',origin:'http://localhost:4173','content-type':'application/json','x-companion-local':'1',...headers},async *[Symbol.asyncIterator](){if(body)yield JSON.stringify(body);}};
 const res={writeHead(code){this.code=code;},end(value){resolve({code:this.code,data:JSON.parse(value)});}};server.emit('request',req,res);
});
test('all six inputs import 200 arbitrary IDs, join records and apply consent',()=>{
 const {pack,report}=importPack(fixture(200));assert.equal(report.ok,true);assert.equal(report.counts.employees,200);assert.equal(report.counts.events,200);assert.equal(report.counts.requests,200);assert.equal(report.counts.feedback,100);assert.equal(report.counts.excludedFeedback,100);assert.equal(pack.people['HIDDEN-200'].requests[0].id,'R-199');assert.equal(pack.people['HIDDEN-2'].pulses.length,0);
});
test('CSV supports UTF-8 BOM, CRLF, escaped quotes, commas and multiline fields',()=>{
 const csv=parseCSV('\uFEFFid,note\r\n1,"hello, ""world""\nnext"\r\n');assert.equal(csv.rows[0].data.note,'hello, "world"\nnext');assert.equal(csv.rows[0].line,2);
 for(const bad of ['a,a\n1,2','a,b\n1','a\n"open','a\nhi"there'])assert.throws(()=>parseCSV(bad));
});
test('all required files and readable policy folder are mandatory',()=>{
 for(const name of Object.keys(fixture())){const files=fixture();delete files[name];if(name.startsWith('policies/')){delete files['policies/equipment.md'];delete files['policies/relocation.txt'];}assert.equal(importPack(files).report.ok,false,name);}
});
test('invalid dates, statuses, duplicate IDs and orphan references reject the entire pack',()=>{
 const mutations=[f=>f['employees.csv']+='\n'+f['employees.csv'].split('\n')[1],f=>f['employees.csv']=f['employees.csv'].replace('2026-10-18','2026-02-31'),f=>f['journey_events.csv']=f['journey_events.csv'].replace('HIDDEN-1','UNKNOWN'),f=>f['service_requests.csv']=f['service_requests.csv'].replace('in progress','mystery'),f=>f['service_requests.csv']=f['service_requests.csv'].replace(',equipment,',',unmapped,')];
 for(const mutate of mutations){const f=fixture();mutate(f);const result=importPack(f);assert.equal(result.report.ok,false,JSON.stringify(result.report));assert.equal(result.pack,undefined);}
});
test('missing consent is excluded even after a previous row opted in',()=>{
 const f=fixture(1);f['employees.csv']=f['employees.csv'].replace(',true,',',,');f['pulse_feedback.csv']+='\nHIDDEN-1,P-OTHER,2026-10-21T01:00:00Z,okay,DO NOT STORE,';const {pack,report}=importPack(f);assert.equal(report.ok,true);assert.equal(pack.people['HIDDEN-1'].pulses.length,1);assert.equal(report.counts.excludedFeedback,1);assert.ok(!JSON.stringify(pack).includes('DO NOT STORE'));
});
test('CSV column mapping supports unknown final-pack headers',()=>{
 const f=fixture();f['employees.csv']=f['employees.csv'].replace('employee_id','Staff Number').replace('name,journey','Display Name,Track');
 const result=importPack(f,{columnMapping:{'employees.csv':{id:'Staff Number',name:'Display Name',journey:'Track'}}});assert.equal(result.report.ok,true,JSON.stringify(result.report));assert.equal(importPack(f).report.ok,false);
});
test('header-only event/request/feedback files validate columns',()=>{
 const f=fixture();f['journey_events.csv']='wrong\n';assert.equal(importPack(f).report.ok,false);
});
test('journey markdown determines deadlines, owners, dependencies, and completion events',()=>{
 const pack=good(),p=pack.people['HIDDEN-1'];assert.equal(journeySteps(p)[1].owner.name,'Equipment Owner');assert.equal(friction(p)[0].id,'equipment');assert.equal(journeySteps(p).find(s=>s.id==='course').status,'blocked');p.events.push({type:'kit-issued',at:pack.asOf});assert.equal(journeySteps(p).find(s=>s.id==='course').status,'upcoming');assert.equal(buildHandoff(p,'course').owner.name,'Learning Owner');
});
test('location-only steps are omitted for a role move and cycles are rejected',()=>{
 const f=fixture();f['employees.csv']=f['employees.csv'].replace(',false,location',',false,role');f['service_requests.csv']=f['service_requests.csv'].split('\n').slice(0,2).join('\n');const r=importPack(f);assert.equal(r.report.ok,true,JSON.stringify(r.report));assert.ok(!r.pack.people['HIDDEN-2'].journeyMap.some(s=>s.id==='visa'));
 assert.throws(()=>parseJourneyMaps(f['journey_maps.md'].replace('| start | equipment | all |','| course | equipment | all |')),/cyclic/);
});
test('imported document text drives answers and source sections, without demo policies',()=>{
 const pack=good(),p=pack.people['HIDDEN-1'];const answer=answerQuestion(p,'When is my equipment expected?');assert.equal(answer.policy,'equipment');assert.match(answer.text,/expected by day 3/);assert.equal(answer.citationSection,'2. Equipment deadline');assert.equal(answer.sourcePath,'policies/equipment.md');assert.equal(answerQuestion(p,'What is my pension?').unsupported,true);assert.match(answerQuestion(p,'What is my pension?').text,/HR Owner/);
 const docs=pack.policies.map(x=>({...x,paragraphs:['Unique imported regulation for quantum onboarding.'],sections:[{heading:'Unique section',text:'Unique imported regulation for quantum onboarding.'}],keywords:['quantum']}));assert.equal(rankPolicies(docs,'quantum')[0].passage.heading,'Unique section');
});
test('the local model receives imported passages and validates imported source IDs',async()=>{
 const pack=good(),calls=[];const result=await answerLocally({message:'equipment deadline',context:{journey:'onboarding',day:5,steps:[]}},{model:'local-test',policies:pack.policies,fetcher:async(url,options)=>{calls.push(options.body);return new Response(JSON.stringify(url.endsWith('/show')?{model_info:{architecture:'local'}}:{message:{content:JSON.stringify({supported:true,text:'Your equipment kit is expected by day 3.',source_ids:['equipment']})}}));}});assert.equal(result.policy,'equipment');assert.equal(result.citations[0].code,'IMPORT-IT-1');assert.match(calls[1],/IMPORT-IT-1/);assert.ok(!calls[1].includes('DEMO-IT-01'));
});
test('unsafe paths, duplicate policy IDs and unsupported formats are reported',()=>{
 for(const mutate of [f=>f['../secret']='x',f=>f['policies/extra.pdf']='pdf',f=>f['policies/duplicate.md']=f['policies/equipment.md']]){const f=fixture();mutate(f);assert.equal(importPack(f).report.ok,false);}
 const prefixed=Object.fromEntries(Object.entries(fixture()).map(([k,v])=>['release/'+k,v]));assert.equal(importPack(prefixed).report.ok,true);
});
test('local pack persists across reload; metadata excludes other employees’ records; withdrawal survives reset',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'companion-pack-'));try{const path=join(dir,'pack.json');const store=packStore(path);await store.ready;const saved=await store.save(good());assert.equal(packManifest(saved).employees[0].pulses,undefined);assert.equal(packEmployee(saved,'UNKNOWN'),null);assert.equal(packEmployee(saved,'HIDDEN-1').policies[0].code,'IMPORT-IT-1');await store.withdraw('HIDDEN-1');const reloaded=packStore(path);await reloaded.ready;assert.equal(reloaded.get().people['HIDDEN-1'].pulses.length,0);assert.equal(reloaded.get().people['HIDDEN-1'].consent,false);assert.ok(!JSON.parse(await readFile(path,'utf8')).people['HIDDEN-1'].policies);}finally{await rm(dir,{recursive:true,force:true});}
});
test('server validates before import, keeps a good pack after rejection, and refuses cross-origin import',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'companion-api-'));try{
  const server=makeServer({evaluationMode:true,packPath:join(dir,'pack.json')});const payload={files:fixture(),syntheticOnly:true};
  assert.equal((await request(server,'/api/pack/validate',{method:'POST',body:payload})).data.report.ok,true);assert.equal((await request(server,'/api/pack')).data.id,null);
  const saved=await request(server,'/api/pack/import',{method:'POST',body:payload});assert.equal(saved.code,200);const id=saved.data.manifest.id;
  const invalid=fixture();delete invalid['employees.csv'];assert.equal((await request(server,'/api/pack/import',{method:'POST',body:{files:invalid,syntheticOnly:true}})).code,422);assert.equal((await request(server,'/api/pack')).data.id,id);
  assert.equal((await request(server,'/api/pack/import',{method:'POST',body:payload,headers:{origin:'https://external.example'}})).code,403);
  assert.equal((await request(server,'/api/pack/import',{method:'POST',body:{files:fixture()}})).code,400);
  const p=await request(server,'/api/pack/employee?id=HIDDEN-1');assert.equal(p.data.id,'HIDDEN-1');assert.ok(!JSON.stringify(p.data).includes('Employee 2'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('15 policy documents work without a fixed document-count assumption',()=>{
 const f=fixture(200);for(let i=0;i<13;i++)f[`policies/extra-${i}.md`]=`# Additional policy ${i}\nAn unrelated synthetic process source.`;
 const result=importPack(f);assert.equal(result.report.ok,true);assert.equal(result.report.counts.policies,15);assert.equal(result.report.counts.employees,200);
});
test('requests without step IDs link uniquely or remain visible as owned standalone cases',()=>{
 const f=fixture();f['service_requests.csv']=f['service_requests.csv'].replace('task_id','request_type').replace(',equipment,',',Collect equipment,').replace(',visa,',',Review paperwork,');
 const result=importPack(f);assert.equal(result.report.ok,true,JSON.stringify(result.report));assert.equal(result.pack.people['HIDDEN-1'].requests[0].task,'equipment');
 f['service_requests.csv']+='\nHIDDEN-1,R-UNLINKED,Unrelated service,open,Service Owner,Other,2026-10-18,Investigate';
 const r=importPack(f);assert.equal(r.report.ok,true);assert.equal(r.pack.people['HIDDEN-1'].requests[1].task,'');
});
test('hours targets and hours-open fields use the pack clock, not the original demo date',()=>{
 const f=fixture();f['journey_maps.md']=f['journey_maps.md'].replace('| Setup | 3 |','| Setup | 48 hours |');f['service_requests.csv']=f['service_requests.csv'].replace('created_at','time_open_hours').replaceAll('2026-10-18T00:00:00Z','24');
 const r=importPack(f);assert.equal(r.report.ok,true,JSON.stringify(r.report));assert.equal(r.pack.people['HIDDEN-1'].requests[0].created,'2026-10-21T05:00:00.000Z');assert.equal(journeySteps(r.pack.people['HIDDEN-1']).find(s=>s.id==='equipment').targetHours,48);
});


test('imported benefit questions require topic evidence, not a generic relocation match',()=>{
 const pack=good(),p=pack.people['HIDDEN-2'];
 for(const q of ['How much relocation allowance do I get?','What salary applies after my transfer?','Am I eligible for relocation allowance?']){
  const result=answerQuestion(p,q);assert.equal(result.unsupported,true);assert.equal(result.policy,undefined);assert.match(result.text,/HR Owner/);
 }
 p.policies=[...pack.policies,{id:'allowance-detail',title:'Relocation support',code:'SYNTH-ALLOW',version:'1',source:'policies/allowance.md',keywords:['relocation','allowance'],paragraphs:['The synthetic relocation allowance is AED 500, subject to named human approval.'],sections:[{heading:'Amount',text:'The synthetic relocation allowance is AED 500, subject to named human approval.'}]}];
 const supported=answerQuestion(p,'How much relocation allowance do I get?');assert.equal(supported.policy,'allowance-detail');assert.match(supported.text,/AED 500/);
});
