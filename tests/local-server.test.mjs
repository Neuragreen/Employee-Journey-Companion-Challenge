import test from 'node:test';
import assert from 'node:assert/strict';
import {makeServer} from '../server.mjs';
function request(server,{path='/',method='GET',headers={},body=''}={}){
 return new Promise(resolve=>{
  const req={url:path,method,headers:{host:'localhost:4173',...headers},async *[Symbol.asyncIterator](){if(body)yield body;}};
  const res={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){resolve({status:this.status,headers:this.headers,body:String(body)});}};
  server.emit('request',req,res);
 });
}
test('server rejects foreign hosts and cross-origin chat before invoking inference',async()=>{
 let calls=0;const server=makeServer({evaluationMode:true,model:'test',fetcher:async()=>{calls++;throw new Error();}});
 assert.equal((await request(server,{headers:{host:'attacker.test:4173'}})).status,403);
 assert.equal((await request(server,{path:'/api/local-chat',method:'POST',headers:{origin:'https://attacker.test','content-type':'application/json','x-companion-local':'1'},body:'{}'})).status,403);
 assert.equal(calls,0);
});
test('server never exposes core, env, git or challenge file paths',async()=>{
 const server=makeServer({evaluationMode:true});
 for(const path of ['/core/data.js','/.env','/.git/config','/local-data/employees.csv','/../package.json'])assert.equal((await request(server,{path})).status,404);
});
test('local status is explicit when no model is installed and assets enforce browser egress policy',async()=>{
 const server=makeServer({evaluationMode:true,model:''});
 const s=await request(server,{path:'/api/local-status'});assert.equal(JSON.parse(s.body).available,false);
 const page=await request(server);assert.equal(page.status,200);assert.match(page.headers['Content-Security-Policy'],/connect-src 'self'/);assert.match(page.headers['Content-Security-Policy'],/font-src 'self'/);
});
