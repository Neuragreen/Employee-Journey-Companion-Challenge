// Pure, local pack parser. No network, filesystem access, eval, or HTML execution.
export const PACK_FILES=['employees.csv','journey_events.csv','service_requests.csv','pulse_feedback.csv','journey_maps.md'];
const norm=s=>String(s??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const slug=s=>norm(s).replaceAll('_','-');
const idPattern=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const own=(obj,k)=>Object.hasOwn(obj,k);
const reserved=new Set(['__proto__','constructor','prototype']);
const yes=v=>['true','yes','1','opted_in','opt_in','granted'].includes(norm(v));
const stop=new Set('a an the is are was were my your i we what when where how do does can should of to for and in on it me about policy process please'.split(' '));
export function parseCSV(text){
 text=String(text).replace(/^\uFEFF/,'');let rows=[],row=[],field='',quoted=false,closed=false,line=1,start=1;
 const cell=()=>{row.push(field);field='';closed=false;};
 const finish=()=>{cell();if(row.some(x=>x.trim()))rows.push({values:row,line:start});row=[];start=line+1;};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else{field+=c;if(c==='\n')line++;}continue;}
  if(c==='"'){if(field||closed)throw new Error(`Unexpected quote at line ${line}`);quoted=true;continue;}
  if(c===','){cell();continue;}
  if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;finish();line++;continue;}
  if(closed && !/\s/.test(c))throw new Error(`Unexpected text after quote at line ${line}`);
  if(!closed)field+=c;
 }
 if(quoted)throw new Error(`Unclosed quoted field at line ${start}`);
 if(field||row.length||closed)finish();
 if(!rows.length)throw new Error('CSV header is missing');
 const headers=rows.shift().values.map(norm);
 if(headers.some(h=>!h||reserved.has(h))||new Set(headers).size!==headers.length)throw new Error('Headers must be non-empty, unique and safe');
 if(rows.length>50000)throw new Error('CSV exceeds 50,000 rows');
 return {headers,rows:rows.map(r=>{if(r.values.length!==headers.length)throw new Error(`Expected ${headers.length} fields at line ${r.line}; found ${r.values.length}`);return {line:r.line,data:Object.fromEntries(headers.map((h,i)=>[h,r.values[i].trim()]))};})};
}
const ALIASES={
 id:['employee_id','emp_id','employeeid','id'],name:['name','employee_name','full_name'],journey:['journey','journey_type','journey_name'],start:['start','start_date','join_date','joining_date','effective_date','journey_start'],manager:['manager','manager_name'],location:['location','office','work_location'],role:['role','job_title'],team:['team','department'],stage:['stage','journey_stage'],
 event:['event','event_type','event_name','type'],at:['timestamp','at','event_time','event_date','date','submitted_at','response_date'],requestId:['request_id','service_request_id','ticket_id','id'],task:['task','task_id','step_id','journey_step'],status:['status','request_status'],service:['service','service_team','owner_team','team','category'],owner:['owner','owner_name','assigned_to'],created:['created','created_at','opened_at','opened_date','opened','request_date'],hours:['time_open_hours','hours_open','time_open'],note:['note','description','details','comment'],consent:['consent','opt_in','opted_in','consent_given','feedback_consent'],rating:['rating','response','score','sentiment'],comment:['comment','comments','feedback','text'],pulseId:['feedback_id','pulse_id','response_id','id']
};
function pick(row,key,mapping={}){const specified=mapping[key];const keys=specified?[norm(specified)]:ALIASES[key]||[norm(key)];return keys.map(k=>row[k]).find(v=>v!==undefined&&v!=='')??'';}
function journey(v){const n=norm(v);if(['onboarding','new_joiner','new_hire'].includes(n))return 'onboarding';if(['mobility','internal_mobility','internal_move','transfer','role_move','team_move','location_move'].includes(n))return 'mobility';throw new Error(`Unrecognized journey '${v}'`);}
function date(v){if(!v)throw new Error('Timestamp is missing');if(v.length>10&&!/(Z|[+-]\d{2}:\d{2})$/.test(v))throw new Error('Timestamp needs an explicit timezone');if(!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(v))throw new Error(`Use ISO dates, not '${v}'`);const day=v.slice(0,10);const civil=new Date(day+'T00:00:00Z');if(!Number.isFinite(+civil)||civil.toISOString().slice(0,10)!==day)throw new Error(`Invalid calendar date '${v}'`);const x=new Date(v.length===10?v+'T00:00:00Z':v);if(!Number.isFinite(+x)||x.toISOString().slice(0,10)!==day && !/[+-]\d\d:\d\d$/.test(v))throw new Error(`Invalid date '${v}'`);return x.toISOString();}
function validId(v,label){if(!idPattern.test(v)||reserved.has(v))throw new Error(`Invalid ${label} '${v}'`);return v;}
function metadata(text){let meta={},body=text;if(text.startsWith('---\n')||text.startsWith('---\r\n')){const match=text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);if(!match)throw new Error('Unclosed document metadata');for(const line of match[1].split(/\r?\n/)){const m=line.match(/^([\w_-]+):\s*(.*)$/);if(m)meta[norm(m[1])]=m[2].trim().replace(/^["']|["']$/g,'');}body=text.slice(match[0].length);}return {meta,body};}
export function parsePolicy(source,text){
 if(!text.trim()||text.length>200000)throw new Error('Policy is empty or exceeds 200,000 characters');
 const {meta,body}=metadata(text);const id=validId(meta.id||slug(source.split('/').at(-1).replace(/\.[^.]+$/,'')),'policy ID');
 const title=meta.title||body.match(/^#\s+(.+)$/m)?.[1]||source.split('/').at(-1);let heading='Document',buffer=[],sections=[];
 const flush=()=>{const passage=buffer.join('\n').trim();if(passage)sections.push({heading,text:passage});buffer=[];};
 for(const line of body.split(/\r?\n/)){const h=line.match(/^#{1,6}\s+(.+)$/);if(h){flush();heading=h[1].trim();}else if(!line.trim()){flush();}else buffer.push(line);}flush();
 if(!sections.length)throw new Error('Policy contains no source passages');
 const keywords=(meta.keywords||'').replace(/[\[\]"']/g,'').split(/[,;]/).map(s=>s.trim()).filter(Boolean);
 return {id,title,code:meta.code||id,version:meta.version||'unspecified',category:meta.category||'Imported policy',source,section:sections[0].heading,sections,paragraphs:sections.map(s=>s.text),summary:sections[0].text.slice(0,300),keywords,related:meta.related||'',applicability:{journeys:meta.journey?[journey(meta.journey)]:[]}};
}
export function expandQuestion(input){
 const terms=[[/حاسوب|لابتوب|كمبيوتر/g,' laptop '],[/معدات|جهاز/g,' equipment '],[/تأشيرة|تاشيرة/g,' visa '],[/تدريب|دورة|تعلم/g,' training '],[/انتقال|نقل/g,' transfer '],[/مكتب|مرافق/g,' workplace '],[/صلاحيات|دخول/g,' access '],[/مخصصات|بدل/g,' allowance '],[/سياسة|سياسات/g,' policy '],[/الخطوة التالية|ماذا أفعل/g,' next step ']];
 return terms.reduce((s,[pattern,replacement])=>s.replace(pattern,replacement),String(input).toLowerCase());
}
export function rankPolicies(policies,input){
 input=expandQuestion(input);
 const tokens=[...new Set(String(input).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[])].filter(t=>t.length>2&&!stop.has(t));
 return policies.map(p=>{
  let sections=(p.sections||p.paragraphs.map(text=>({heading:p.section,text}))).map(s=>({...s,score:tokens.reduce((n,t)=>n+(s.text.toLowerCase().includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score);
  const titleScore=tokens.reduce((n,t)=>n+(p.title.toLowerCase().includes(t)?2:0),0);
  const keyScore=(p.keywords||[]).reduce((n,k)=>n+(input.toLowerCase().includes(k.toLowerCase())?3:0),0);
  return {policy:p,passage:sections[0],score:(sections[0]?.score||0)+titleScore+keyScore};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
}
export function parseJourneyMaps(text){
 const {meta,body}=metadata(text);const maps={onboarding:[],mobility:[]},stages={onboarding:[],mobility:[]};let section='',headers=null;
 const aliases={id:['step_id','task_id','id'],title:['step','title','step_name','name'],day:['target_day','day','due_day','target_time','target'],service:['service','service_team','owner_team','team'],owner:['owner','owner_name'],event:['completion_event','event','event_type'],depends:['depends_on','dependencies','depends'],policy:['policy','policy_id','source_policy'],stage:['stage','journey_stage'],applies:['applies_to','condition','requires']};
 let rows=[];
 for(const [index,line] of body.split(/\r?\n/).entries()){
  const h=line.match(/^#{1,6}\s+(.+)/);if(h){try{section=journey(h[1]);}catch{}headers=null;continue;}
  if(!line.trim().startsWith('|'))continue;
  const cells=line.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(c=>c.trim().replace(/\\\|/g,'|'));
  if(cells.every(c=>/^:?-+:?$/.test(c)))continue;
  if(!headers){headers=cells.map(norm);if(new Set(headers).size!==headers.length)throw new Error(`Duplicate table headers at line ${index+1}`);continue;}
  if(cells.length!==headers.length)throw new Error(`Journey table field count at line ${index+1}`);
  const r=Object.fromEntries(headers.map((v,i)=>[v,cells[i]]));const value=k=>(aliases[k]||[k]).map(a=>r[a]).find(v=>v!==undefined&&v!=='')||'';
  const j=journey(r.journey||r.journey_type||section);const id=validId(value('id')||slug(value('title')),'step ID');
  const target=value('day'),match=target.match(/^(?:day\s*)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|days?|d)?$/i);if(!match)throw new Error(`Step ${id}: target must be a day number, 'Day 3' or '48 hours'`);
  const numeric=Number(match[1]);if(numeric>8760)throw new Error(`Step ${id}: target exceeds limit`);
  const hours=/^(h|hr|hour)/i.test(match[2]||'');const ownerName=value('owner');if(!ownerName)throw new Error(`Step ${id}: named owner is required`);
  const team=value('service');if(!team)throw new Error(`Step ${id}: service team is required`);
  const label=value('stage')||'Journey';if(!stages[j].includes(label))stages[j].push(label);
  const condition=norm(value('applies'));if(condition&&!['all','always','location_change','role_change','team_change'].includes(condition))throw new Error(`Step ${id}: unknown condition '${condition}'`);
  maps[j].push({id,title:value('title')||id,day:hours?numeric/24:numeric,...hours?{targetHours:numeric}:{},team,owner:{name:ownerName,role:team,initials:ownerName.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()},stage:stages[j].indexOf(label),stageLabel:label,event:slug(value('event')||id),depends:value('depends').split(/[,;]/).map(s=>s.trim()).filter(s=>s&&s!=='-'),policy:value('policy').replace(/^policies\//,'').replace(/\.(md|txt)$/i,''),requires:condition,employeeAction:yes(r.employee_action),source:'journey_maps.md',sourceLine:index+1});
 }
 for(const [j,steps]of Object.entries(maps)){
  const ids=new Set();for(const t of steps){if(ids.has(t.id))throw new Error(`Duplicate ${j} step ${t.id}`);ids.add(t.id);}
  for(const t of steps)for(const d of t.depends)if(!ids.has(d))throw new Error(`${j}/${t.id}: missing prerequisite ${d}`);
  const active=new Set(),done=new Set();const visit=id=>{if(active.has(id))throw new Error(`${j}: cyclic prerequisites`);if(done.has(id))return;active.add(id);steps.find(s=>s.id===id).depends.forEach(visit);active.delete(id);done.add(id);};steps.forEach(t=>visit(t.id));
 }
 if(!maps.onboarding.length&&!maps.mobility.length)throw new Error('No journey tables found');
 return {maps,stages,asOf:meta.as_of?date(meta.as_of):null};
}
export function importPack(input,{columnMapping={},asOf}={}){
 if(!columnMapping || typeof columnMapping!=='object' || Array.isArray(columnMapping))return {report:{ok:false,errors:[{file:'mapping',message:'Column mapping must be an object'}],warnings:[],counts:{}}};
 const report={ok:false,errors:[],warnings:[],counts:{employees:0,events:0,requests:0,feedback:0,excludedFeedback:0,policies:0,steps:0}};
 const error=(file,line,message)=>report.errors.push({file,line,message});const warn=(file,line,message)=>report.warnings.push({file,line,message});
 const files=Object.create(null);let total=0;
 if(!input||typeof input!=='object'||Array.isArray(input))return {report:{...report,errors:[{file:'pack',message:'Provide filename-to-text entries'}]}};
 for(const [name,text]of Object.entries(input)){
  if(typeof text!=='string'){error(name,0,'File must be decoded UTF-8 text');continue;}total+=new TextEncoder().encode(text).length;
  const parts=name.replaceAll('\\','/').split('/');if(parts.some(x=>x==='..'||reserved.has(x))||parts.includes('')){error(name,0,'Unsafe file path');continue;}
  const policyIndex=parts.lastIndexOf('policies');const key=policyIndex>=0?parts.slice(policyIndex).join('/'):parts.at(-1);
  if(own(files,key)){error(name,0,`Duplicate file ${key}`);continue;}files[key]=text.replace(/^\uFEFF/,'');
 }
 if(total>20*1024*1024||Object.keys(files).length>1000)error('pack',0,'Pack exceeds 20 MiB or 1,000 files');
 for(const file of PACK_FILES)if(!own(files,file))error(file,0,'Required file missing');
 const policies=[];for(const [file,text]of Object.entries(files)){
  if(!file.startsWith('policies/')){if(!PACK_FILES.includes(file))warn(file,0,'Unused file');continue;}
  if(!/\.(md|txt)$/i.test(file)){error(file,0,'Unsupported policy format; use UTF-8 .md or .txt');continue;}
  try{const p=parsePolicy(file,text);if(policies.some(x=>x.id===p.id))throw new Error(`Duplicate policy ID ${p.id}`);policies.push(p);}catch(e){error(file,0,e.message);}
 }
 if(!policies.length)error('policies/',0,'At least one readable policy is required');report.counts.policies=policies.length;
 let jm;try{if(files['journey_maps.md'])jm=parseJourneyMaps(files['journey_maps.md']);}catch(e){error('journey_maps.md',0,e.message);}
 let clock;try{clock=date(asOf||jm?.asOf||new Date().toISOString());}catch(e){error('pack',0,e.message);}
 if(!asOf&&!jm?.asOf)warn('journey_maps.md',0,'No as_of snapshot supplied; using import time');
 const tables={};for(const file of PACK_FILES.filter(f=>f.endsWith('.csv')))if(own(files,file)){try{tables[file]=parseCSV(files[file]);}catch(e){error(file,0,e.message);}}
 const required={ 'employees.csv':['id','name','journey'], 'journey_events.csv':['id','event','at'], 'service_requests.csv':['id','requestId','status'], 'pulse_feedback.csv':['id','at','rating'] };
 for(const [file,fields]of Object.entries(required)){
  const table=tables[file];if(!table)continue;
  const mapping=columnMapping[file]||{};
  for(const [canonical,column]of Object.entries(mapping))if(typeof column!=='string'||!table.headers.includes(norm(column)))error(file,1,`Mapped column ${column} for ${canonical} is missing`);
  for(const key of fields){const choices=mapping[key]?[norm(mapping[key])]:ALIASES[key];if(!choices.some(c=>table.headers.includes(c)))error(file,1,`Required column ${key} is missing; use column mapping`);}
 }
 const people=Object.create(null),records=(file,fn)=>{for(const {line,data}of tables[file]?.rows||[]){try{fn(data,line);}catch(e){error(file,line,e.message);}}};
 const get=(r,k,f)=>pick(r,k,columnMapping[f]||{});const find=(r,f)=>{const id=get(r,'id',f);if(!own(people,id))throw new Error(`Unknown employee ${id}`);return people[id];};
 records('employees.csv',(r,line)=>{
  const f='employees.csv',id=validId(get(r,'id',f),'employee ID');if(own(people,id))throw new Error(`Duplicate employee ID ${id}`);
  const name=get(r,'name',f);if(!name)throw new Error('Employee name missing');const j=journey(get(r,'journey',f));
  people[id]={id,name,firstName:name.split(/\s+/)[0],initials:name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(),journey:j,start:get(r,'start',f)?date(get(r,'start',f)):null,stageLabel:get(r,'stage',f),stage:0,location:get(r,'location',f),role:get(r,'role',f),team:get(r,'team',f),manager:get(r,'manager',f),managerId:r.manager_id||'',moveType:r.move_type||'',locationChange:yes(r.location_change)||norm(r.move_type).includes('location')||!!(r.from_location&&r.to_location&&r.from_location!==r.to_location),roleChange:yes(r.role_change)||norm(r.move_type).includes('role'),teamChange:yes(r.team_change)||norm(r.move_type).includes('team'),events:[],requests:[],pulses:[],handoffs:[],messages:[],activity:[],consent:yes(get(r,'consent',f)),consentSpecified:!!get(r,'consent',f),asOf:clock,imported:true,source:{file:f,line},scenario:'Imported '+j};
 });
 const eventIds=new Set();records('journey_events.csv',(r,line)=>{
  const f='journey_events.csv',p=find(r,f),type=slug(get(r,'event',f));if(!type)throw new Error('Event type missing');const at=date(get(r,'at',f)),key=r.event_id||`${p.id}/${type}/${at}`;if(eventIds.has(key))throw new Error(`Duplicate event ${key}`);eventIds.add(key);p.events.push({type,at,id:r.event_id||key,source:{file:f,line}});report.counts.events++;
 });
 const reqIds=new Set();records('service_requests.csv',(r,line)=>{
  const f='service_requests.csv',p=find(r,f),id=validId(get(r,'requestId',f),'request ID');if(reqIds.has(id))throw new Error(`Duplicate request ID ${id}`);reqIds.add(id);
  const task=get(r,'task',f);
  const rawStatus=norm(get(r,'status',f)),statuses={open:'Open',in_progress:'In progress',pending:'Awaiting review',awaiting_review:'Awaiting review',on_hold:'On hold',blocked:'Blocked',completed:'Completed',closed:'Completed',resolved:'Completed',cancelled:'Cancelled',canceled:'Cancelled'};
  const status=statuses[rawStatus];if(!status)throw new Error(`Unknown request status '${get(r,'status',f)}'`);
  let created=get(r,'created',f);if(!created){const hours=get(r,'hours',f);if(hours===''||!Number.isFinite(Number(hours))||Number(hours)<0)throw new Error('Created timestamp or numeric time_open_hours required');created=new Date(new Date(clock)-Number(hours)*3600000).toISOString();warn(f,line,'Created timestamp inferred from hours open and snapshot');}
  created=date(created);if(new Date(created)>new Date(clock))throw new Error('Request opened after the snapshot');
  const ownerName=get(r,'owner',f),team=get(r,'service',f);p.requests.push({id,task,title:r.title||r.request_title||r.request_type||task||id,team,status,created,note:get(r,'note',f),owner:ownerName?{name:ownerName,role:team,initials:ownerName.split(/\s+/).map(x=>x[0]).join('').slice(0,2)}:null,history:[{text:'Imported request record',at:created}],source:{file:f,line}});report.counts.requests++;
 });
 const pulseIds=new Set();records('pulse_feedback.csv',(r,line)=>{
  const f='pulse_feedback.csv',p=find(r,f),rawConsent=get(r,'consent',f);
  // A row-level explicit no overrides employee consent. Missing consent never implies opt-in.
  if(!(rawConsent?yes(rawConsent):p.consentSpecified&&p.consent)||p.consentSpecified&&!p.consent){report.counts.excludedFeedback++;warn(f,line,'Feedback excluded: no active explicit opt-in');return;}
  const at=date(get(r,'at',f));const id=get(r,'pulseId',f)||`${p.id}/${at}`;if(pulseIds.has(id))throw new Error(`Duplicate feedback ID ${id}`);pulseIds.add(id);
  const original=get(r,'rating',f),ratings={good:'good',going_well:'good',positive:'good',okay:'okay',neutral:'okay',finding_my_feet:'okay',need_help:'need-help',could_use_support:'need-help',negative:'need-help'};
  const rating=ratings[norm(original)]||'unclassified';if(rating==='unclassified')warn(f,line,'Rating kept without inferred sentiment; use original response');
  p.consent=true;p.pulses.push({id,rating,originalRating:original,comment:get(r,'comment',f),stage:r.stage||r.journey_stage||'',at,source:{file:f,line}});report.counts.feedback++;
 });
 for(const step of Object.values(jm?.maps||{}).flat())if(step.policy){const match=policies.filter(p=>p.id===step.policy||p.code===step.policy||slug(p.source.split('/').at(-1).replace(/\.[^.]+$/,''))===slug(step.policy));if(match.length===1)step.policy=match[0].id;}
 for(const p of Object.values(people)){
  if(!p.start){const anchor=p.events.filter(e=>['joined','first-day','journey-started','transfer-approved','employment-started'].includes(e.type)).sort((a,b)=>a.at.localeCompare(b.at))[0];if(anchor){p.start=anchor.at;warn('employees.csv',p.source.line,'Journey start inferred from anchor event');}else error('employees.csv',p.source.line,`${p.id}: start date or explicit journey-start event required`);}
  if(p.start&&new Date(p.start)>new Date(clock))warn('employees.csv',p.source.line,`${p.id}: journey starts after snapshot; pre-start steps shown`);
  const map=jm?.maps[p.journey]||[];if(!map.length)error('journey_maps.md',0,`No map for ${p.journey}`);
  p.journeyMap=map.filter(t=>!t.requires||['all','always'].includes(t.requires)||p[{location_change:'locationChange',role_change:'roleChange',team_change:'teamChange'}[t.requires]]);
  if(!p.journeyMap.length)error('journey_maps.md',0,`No applicable steps for ${p.id}`);
  const ids=new Set(p.journeyMap.map(t=>t.id));for(const t of p.journeyMap)for(const d of t.depends)if(!ids.has(d))error('journey_maps.md',t.sourceLine,`${p.id}/${t.id}: applicable step depends on excluded ${d}`);
  p.stages=jm?.stages[p.journey]||[];const stageIndex=p.stages.indexOf(p.stageLabel);if(stageIndex>=0)p.stage=stageIndex;else if(p.stageLabel)warn('employees.csv',p.source.line,`${p.id}: provided stage is not a map stage; computed from events`);
  for(const t of map)if(t.policy&&!policies.some(x=>x.id===t.policy))error('journey_maps.md',t.sourceLine,`Unknown policy ${t.policy}`);
  for(const r of p.requests){
   if(!r.task){
    let candidates=p.journeyMap.filter(t=>slug(r.title)===slug(t.title)||slug(r.title)===t.id||r.title.toLowerCase().includes(t.id.toLowerCase())&&t.id.length>3);
    if(!candidates.length&&r.team)candidates=p.journeyMap.filter(t=>norm(t.team)===norm(r.team));
    if(candidates.length===1){r.task=candidates[0].id;warn('service_requests.csv',r.source.line,`${r.id}: step matched from title/service; verify ${r.task}`);}
    else{if(!r.owner)error('service_requests.csv',r.source.line,`${r.id}: unlinked request requires a named owner`);warn('service_requests.csv',r.source.line,`${r.id}: retained as a standalone request; no unique journey step`);continue;}
   }
   const step=p.journeyMap.find(t=>t.id===r.task);if(!step){error('service_requests.csv',r.source.line,`${r.id}: step ${r.task} is unknown or not applicable`);continue;}r.team=r.team||step.team;r.owner=r.owner||step.owner;if(!get(tables['service_requests.csv']?.rows.find(x=>x.line===r.source.line)?.data||{},'owner','service_requests.csv'))warn('service_requests.csv',r.source.line,`${r.id}: owner taken from journey map`);}
  for(const e of p.events){if(!map.some(t=>t.event===e.type))warn('journey_events.csv',e.source.line,`${e.type}: event retained but not mapped to a step`);if(new Date(e.at)>new Date(clock))warn('journey_events.csv',e.source.line,'Future event retained; excluded from current completion');}
  p.policies=policies;p.owners=Object.fromEntries(p.journeyMap.map(t=>[t.team,t.owner]));delete p.consentSpecified;
 }
 report.counts.employees=Object.keys(people).length;report.counts.steps=Object.values(jm?.maps||{}).reduce((n,a)=>n+a.length,0);if(!report.counts.employees)error('employees.csv',0,'At least one employee is required');
 report.ok=!report.errors.length;
 return report.ok?{report,pack:{people,policies,journeyMaps:jm.maps,stages:jm.stages,asOf:clock,report}}:{report};
}
