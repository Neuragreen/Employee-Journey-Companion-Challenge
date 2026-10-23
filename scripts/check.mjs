import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
let count=0;
for(const dir of ['core','dist','scripts','tests']){
 async function walk(path){for(const entry of await readdir(new URL(path+'/',new URL('../',import.meta.url)),{withFileTypes:true})){const name=path+'/'+entry.name;if(entry.isDirectory())await walk(name);else if(/\.m?js$/.test(name)){const r=spawnSync(process.execPath,['--check',name],{cwd:root,stdio:'inherit'});if(r.status)process.exit(r.status);count++;}}}
 await walk(dir);
}
const result=spawnSync(process.execPath,['--check','server.mjs'],{cwd:root,stdio:'inherit'});if(result.status)process.exit(result.status);
console.log(`Syntax checks passed for ${count+1} JavaScript files.`);
