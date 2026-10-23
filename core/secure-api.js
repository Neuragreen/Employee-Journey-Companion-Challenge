import {readAccounts,sessions} from './access.js';
import {journeySteps,buildHandoff,submitHandoff,createRequest,setConsent,addPulse,answerQuestion} from './engine.js';
import {answerLocally,localModelStatus} from './local-ai.js';
export function secureAPI({store,model,fetcher,accountsPath}){
 const auth=sessions();
 return async(req,res,url)=>{
 const host=req.headers.host,origin='http://'+host;
 const send=(code,data,headers={})=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));};
 const token=(req.headers.cookie||'').match(/(?:^|;\s*)companion_session=([a-f0-9]+)/)?.[1];const session=auth.get(token);
 const body=async()=>{if(req.headers.origin!==origin||req.headers['x-companion-local']!=='1'||!req.headers['content-type']?.startsWith('application/json'))throw new Error('Invalid origin');let s='';for await(const chunk of req){s+=chunk;if(Buffer.byteLength(s)>50000)throw new Error('Request too large');}return JSON.parse(s);};
 if(url.pathname==='/api/session'&&req.method==='POST'){try{const b=await body();const accounts=await readAccounts(accountsPath);const a=accounts.find(a=>a.username===b.username);const login=auth.login(req.socket?.remoteAddress||'loopback',a,String(b.password||''));if(!login){send(401,{error:'Invalid credentials'});return true;}send(200,{csrf:login.csrf,account:auth.get(login.token).account},{'Set-Cookie':`companion_session=${login.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`});}catch{send(403,{error:'Login refused; check credentials or retry later.'});}return true;}
 if(!session){send(401,{error:'Sign in with a role-bound local account. Run npm run accounts after importing a pack.'});return true;}
 const account=session.account,pack=store.get();
 const employee=()=>{if(account.role!=='employee'||!pack?.people[account.employeeId])throw new Error('Employee access required');return pack.people[account.employeeId];};
 const scoped=p=>({...p,policies:pack.policies});
 if(account.role==='admin'&&['/api/pack/validate','/api/pack/import'].includes(url.pathname)&&req.method==='POST'){if(req.headers['x-csrf-token']!==session.csrf){send(403,{error:'Invalid session token'});return true;}return false;}
 if(url.pathname==='/api/session'&&req.method==='GET'){send(200,{account,csrf:session.csrf,asOf:pack?.asOf,ai:await localModelStatus(model,fetcher)});return true;}
 if(url.pathname==='/api/me'&&req.method==='GET'){try{const p=employee();send(200,{employee:scoped(p),steps:journeySteps(scoped(p)),policies:pack.policies});}catch{send(403,{error:'Employee access required'});}return true;}
 if(url.pathname==='/api/owner/cases'&&req.method==='GET'){if(account.role!=='owner'){send(403,{error:'Owner access required'});return true;}send(200,{cases:Object.values(pack?.people||{}).flatMap(p=>p.handoffs.filter(h=>h.owner.name===account.name).map(h=>({...h,feedback:p.consent?h.feedback:[],employee:p.name,employeeId:p.id}))) });return true;}
 if(url.pathname==='/api/manager'&&req.method==='GET'){if(account.role!=='manager'){send(403,{error:'Manager access required'});return true;}send(200,{joiners:Object.values(pack?.people||{}).filter(p=>(p.managerId||p.manager)===account.manager&&p.journey==='onboarding').map(p=>({name:p.name,id:p.id,location:p.location,steps:journeySteps(scoped(p)).map(s=>({title:s.title,status:s.status,due:s.due,owner:s.owner.name}))}))});return true;}
 if(url.pathname==='/api/stalls'&&req.method==='GET'){if(account.role!=='admin'){send(403,{error:'Administrator access required'});return true;}const groups={};for(const p of Object.values(pack?.people||{}))for(const s of journeySteps(scoped(p)))if(s.overdue)groups[p.journey+': '+s.title]=(groups[p.journey+': '+s.title]||0)+1;send(200,{minimumGroupSize:5,groups:Object.entries(groups).filter(([,count])=>count>=5).map(([step,count])=>({step,count})).sort((a,b)=>b.count-a.count),suppressedGroups:Object.values(groups).filter(n=>n<5).length});return true;}
 if(url.pathname==='/api/action'&&req.method==='POST'){
  try{const b=await body();if(req.headers['x-csrf-token']!==session.csrf)throw new Error('Invalid session token');
   if(b.action==='logout'){auth.remove(token);send(200,{ok:true},{'Set-Cookie':'companion_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});return true;}
   const result=await store.update(async next=>{
    if(b.action==='ownerUpdate'){
     if(account.role!=='owner')throw new Error('Owner access required');
     let p,h;for(const candidate of Object.values(next.people)){const found=candidate.handoffs.find(h=>h.id===b.caseId&&h.owner.name===account.name);if(found){p=candidate;h=found;break;}}
     if(!h)throw new Error('Assigned case not found');if(!['Acknowledged','Needs information','Resolved'].includes(b.status)||typeof b.note!=='string'||b.note.trim().length<5||b.note.length>1000)throw new Error('A valid status and outcome note are required');
     if(h.status==='Resolved')throw new Error('Case already resolved');
     const at=new Date().toISOString();h.status=b.status;h.history||=[];h.history.push({by:account.name,status:b.status,note:b.note,at});const r=p.requests.find(r=>r.id===h.requestId);if(r){r.status=b.status==='Resolved'?'Completed':b.status;r.history.push({text:`${account.name}: ${b.note}`,at});}
     if(b.status==='Resolved'){const step=journeySteps({...p,policies:next.policies}).find(s=>s.id===h.task);if(!step||step.missing.length)throw new Error('Prerequisites are incomplete');if(!p.events.some(e=>e.type===step.event))p.events.push({type:step.event,at:p.asOf,recordedAt:at,by:account.name});}
     return {ok:true};
    }
    if(account.role!=='employee')throw new Error('Employee access required');const p=next.people[account.employeeId];if(!p)throw new Error('Employee not found');p.policies=next.policies;
    if(b.employeeId&&b.employeeId!==p.id)throw new Error('Cross-employee access denied');
    if(b.action==='request')return createRequest(p,b.taskId,String(b.note||''));
    if(b.action==='handoff'){const d=buildHandoff(p,b.taskId,b.includePulse===true,String(b.note||''));return submitHandoff(p,d);}
    if(b.action==='consent'){setConsent(p,b.allowed===true);if(!p.consent){for(const h of p.handoffs)h.feedback=[];p.messages=[];}return {ok:true};}
    if(b.action==='pulse')return addPulse(p,b.rating,String(b.comment||'').slice(0,600));
    if(b.action==='chat'){
     const q=String(b.message||'').trim();if(!q||q.length>1200)throw new Error('Question required');let answer={...answerQuestion(p,q),mode:'rules'};
     if(answer.policy){try{const ai=await answerLocally({message:q,context:{journey:p.journey,day:1,steps:journeySteps(p)}},{model,fetcher,policies:next.policies});if(ai.available)answer=ai;}catch{answer={text:'The local model could not verify an answer. Please ask your named human owner.',unsupported:true,mode:'rules'};}}
     p.messages.push({role:'user',text:q},{role:'assistant',...answer});return answer;
    }
    if(b.action==='export')return scoped(p);
    throw new Error('Unknown action');
   });send(200,{result});
  }catch{send(403,{error:'Action refused. Check role, case ownership, consent, prerequisites and input.'});}return true;
 }
 send(403,{error:'This endpoint is unavailable for this role.'});return true;
 };}
