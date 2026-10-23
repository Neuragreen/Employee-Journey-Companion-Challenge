import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {packStore} from '../core/pack-store.js';
import {passwordHash,readAccounts,writePrivate} from '../core/access.js';
const path=resolve('local-data/accounts.json');if((await readAccounts(path)).length&&!process.argv.includes('--replace')){console.error('Accounts already exist. Existing credentials were not replaced.');process.exit(1);}
const store=packStore(resolve('local-data/active-pack.json'));await store.ready;const pack=store.get();if(!pack){console.error('Import a synthetic pack first.');process.exit(1);}
let accounts=[],credentials=[];const add=(username,role,extra={})=>{const password=randomBytes(18).toString('base64url');accounts.push({username,role,...extra,passwordHash:passwordHash(password)});credentials.push(`${username}\t${role}\t${extra.employeeId||extra.name||extra.manager||"Aggregate administrator"}\t${password}`);};
add('administrator','admin');let i=0;for(const p of Object.values(pack.people))add('employee-'+(++i),'employee',{employeeId:p.id});
let owners=[...new Set(Object.values(pack.people).flatMap(p=>[...p.journeyMap.map(s=>s.owner.name),...p.requests.map(r=>r.owner?.name)].filter(Boolean)))];i=0;for(const name of owners)add('owner-'+(++i),'owner',{name});
const managers=[...new Set(Object.values(pack.people).map(p=>p.managerId||p.manager).filter(Boolean))];i=0;for(const manager of managers)add('manager-'+(++i),'manager',{manager});
await writePrivate(path,JSON.stringify(accounts,null,2));await writePrivate(resolve('local-data/login-credentials.txt'),'LOCAL SYNTHETIC EVALUATION ACCOUNTS — KEEP PRIVATE\nUsername\tRole\tIdentity\tPassword\n'+credentials.join('\n'));
console.log(`${accounts.length} role-bound accounts created. Credentials are in local-data/login-credentials.txt; passwords were not printed. Keep this file private.`);
