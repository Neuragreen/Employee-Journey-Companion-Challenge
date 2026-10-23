import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {dirname} from 'node:path';
export function passwordHash(password,salt=randomBytes(16).toString('hex')){return salt+':'+scryptSync(password,salt,32).toString('hex');}
export function verifyPassword(password,hash){try{const [salt,value]=hash.split(':');const actual=scryptSync(password,salt,32);const expected=Buffer.from(value,'hex');return expected.length===actual.length&&timingSafeEqual(expected,actual);}catch{return false;}}
export async function readAccounts(path){try{return JSON.parse(await readFile(path,'utf8'));}catch{return [];}}
export async function writePrivate(path,value){await mkdir(dirname(path),{recursive:true,mode:0o700});await writeFile(path,value,{mode:0o600});}
export function sessions(){const entries=new Map(),attempts=new Map();return {
 login(key,account,password){const now=Date.now();const a=attempts.get(key)||{count:0,until:now+600000};if(now>a.until){a.count=0;a.until=now+600000;}if(a.count>=5)throw new Error('Too many attempts. Try again in ten minutes.');a.count++;attempts.set(key,a);if(!account||!verifyPassword(password,account.passwordHash))return null;attempts.delete(key);const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');entries.set(token,{account:{...account,passwordHash:undefined},csrf,until:now+1800000});return {token,csrf};},
 get(token){const s=entries.get(token);if(!s||s.until<Date.now()){entries.delete(token);return null;}return s;},remove(token){entries.delete(token);}
};}
