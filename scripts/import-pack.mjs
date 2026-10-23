import {readdir,readFile,lstat} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {importPack} from '../core/import-pack.js';
import {packStore} from '../core/pack-store.js';
const dir=process.argv[2];if(!dir){console.error('Usage: npm run import-pack -- /absolute/path/to/synthetic-pack [--validate]');process.exit(1);}
const root=resolve(dir),files=Object.create(null);let count=0,total=0;
async function walk(path){for(const item of await readdir(path,{withFileTypes:true})){const full=resolve(path,item.name),stat=await lstat(full);if(stat.isSymbolicLink())throw new Error('Symlinks are not accepted in a pack');if(stat.isDirectory())await walk(full);else{count++;total+=stat.size;if(count>1000||total>20*1024*1024)throw new Error('File exceeds pack limit');files[relative(root,full).split(sep).join('/')]=await readFile(full,'utf8');}}}
try{await walk(root);const result=importPack(files);console.log(JSON.stringify(result.report,null,2));if(!result.report.ok)process.exitCode=1;else if(!process.argv.includes('--validate')){const store=packStore(resolve('local-data/active-pack.json'));await store.ready;await store.save(result.pack);console.log('Validated pack saved locally. Restart or refresh the app.');}}catch(e){console.error(e.message);process.exitCode=1;}
