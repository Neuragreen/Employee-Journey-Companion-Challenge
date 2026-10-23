import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {journeySteps} from '../core/engine.js';

test('fresh judge setup works without dependencies and preserves existing state on repeat',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'companion-submission-'));
 const root=fileURLToPath(new URL('../',import.meta.url));
 try{
  for(const name of ['scripts','core','examples'])await cp(join(root,name),join(dir,name),{recursive:true});
  await cp(join(root,'package.json'),join(dir,'package.json'));
  const run=()=>spawnSync(process.execPath,['scripts/setup.mjs'],{cwd:dir,encoding:'utf8'});
  const first=run();assert.equal(first.status,0,first.stderr);
  const snapshot=await readFile(join(dir,'local-data/active-pack.json'),'utf8');
  const registry=await readFile(join(dir,'local-data/accounts.json'),'utf8');
  const credentials=await readFile(join(dir,'local-data/login-credentials.txt'),'utf8');
  const pack=JSON.parse(snapshot),accounts=JSON.parse(registry);
  assert.equal(Object.keys(pack.people).length,12);assert.equal(pack.policies.length,2);
  assert.equal(accounts.length,18);
  assert.equal(accounts.find(a=>a.username==='employee-1').employeeId,'HIDDEN-1');
  assert.equal(accounts.find(a=>a.username==='owner-2').name,'Equipment Owner');
  assert.equal(accounts.find(a=>a.username==='owner-4').name,'Mobility Owner');
  const counts={};for(const p of Object.values(pack.people))for(const s of journeySteps({...p,policies:pack.policies}))if(s.overdue)counts[p.journey+':'+s.id]=(counts[p.journey+':'+s.id]||0)+1;
  assert.deepEqual(Object.values(counts).sort(),[6,6]);
  for(const line of credentials.trim().split('\n').slice(2)){const password=line.split('\t').at(-1);assert.ok(!first.stdout.includes(password));}
  const second=run();assert.equal(second.status,0,second.stderr);
  assert.equal(await readFile(join(dir,'local-data/active-pack.json'),'utf8'),snapshot);
  assert.equal(await readFile(join(dir,'local-data/accounts.json'),'utf8'),registry);
  assert.equal(await readFile(join(dir,'local-data/login-credentials.txt'),'utf8'),credentials);
 }finally{await rm(dir,{recursive:true,force:true});}
});
