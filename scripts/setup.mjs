import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
async function exists(name){try{await access(resolve(root,name));return true;}catch{return false;}}
const hasPack=await exists('local-data/active-pack.json'),hasAccounts=await exists('local-data/accounts.json');
if(hasAccounts&&!hasPack){console.error('Accounts exist without a dataset. Restore your matching dataset or move the existing local-data folder to a private backup before setup. No files were replaced.');process.exit(1);}
const run=(file,args=[])=>{const r=spawnSync(process.execPath,[resolve(root,file),...args],{cwd:root,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);};
if(!hasPack)run('scripts/import-pack.mjs',['examples/data-pack']);
if(!hasAccounts)run('scripts/create-accounts.mjs');
console.log('\nReady. Run npm start, then open http://localhost:4173.\nYour private login handout is local-data/login-credentials.txt.\nExisting data and accounts were preserved. No model or software was downloaded.');
