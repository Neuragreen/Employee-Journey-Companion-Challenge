import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
export function packStore(path){
 let active=null,loadError=null;
 const ready=readFile(path,'utf8').then(s=>{active=JSON.parse(s);}).catch(e=>{if(e.code!=='ENOENT')loadError='Saved pack could not be read; reimport the original files.';});
 let pending=ready;
 const serialize=p=>JSON.stringify({...p,people:Object.fromEntries(Object.entries(p.people).map(([id,person])=>{const {policies,...rest}=person;return [id,rest];}))});
 async function write(pack){await mkdir(dirname(path),{recursive:true,mode:0o700});const temp=path+'.'+randomUUID()+'.tmp';await writeFile(temp,serialize(pack),{mode:0o600});await rename(temp,path);active=pack;}
 const mutate=fn=>{const result=pending.then(fn);pending=result.catch(()=>{});return result;};
 return {ready,update:fn=>mutate(async()=>{if(!active)throw new Error('No active pack');const next=structuredClone(active);const result=await fn(next);await write(next);return result;}),error:()=>loadError,get:()=>active,save:pack=>mutate(async()=>{const next={...pack,id:randomUUID()};await write(next);return next;}),withdraw:id=>mutate(async()=>{if(!active?.people[id])return false;const next={...active,people:{...active.people,[id]:{...active.people[id],consent:false,pulses:[]}}};await write(next);return true;})};
}
export function packManifest(pack){
 return {id:pack.id,asOf:pack.asOf,report:pack.report,policies:pack.policies,journeyMaps:pack.journeyMaps,stages:pack.stages,employees:Object.values(pack.people).map(p=>({id:p.id,name:p.name,firstName:p.firstName,journey:p.journey,scenario:p.scenario}))};
}
export function packEmployee(pack,id){const p=pack?.people[id];if(!p)return null;return {...p,policies:pack.policies};}
