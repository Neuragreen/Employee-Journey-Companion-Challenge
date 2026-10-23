export function fixture(count=2){
 const employees=['employee_id,name,journey,start_date,manager,location,consent,move_type'];
 const events=['employee_id,event_type,timestamp,event_id'];
 const requests=['employee_id,request_id,task_id,status,owner,service,created_at,description'];
 const pulses=['employee_id,feedback_id,timestamp,rating,comment,consent'];
 for(let i=0;i<count;i++){
  const id='HIDDEN-'+(i+1),j=i%2?'internal mobility':'onboarding';employees.push(`${id},Employee ${i+1},${j},2026-10-18,Manager,Test City,${i%2?'false':'true'},${i%2?'location':''}`);
  events.push(`${id},journey started,2026-10-18T00:00:00Z,E-${i}`);
  requests.push(`${id},R-${i},${i%2?'visa':'equipment'},in progress,${i%2?'Mobility Owner':'Equipment Owner'},${i%2?'Mobility':'IT'},2026-10-18T00:00:00Z,"Waiting, please help"`);
  pulses.push(`${id},P-${i},2026-10-21T00:00:00Z,need-help,"Need an update\nPlease",true`);
 }
 return {'employees.csv':employees.join('\n'),'journey_events.csv':events.join('\n'),'service_requests.csv':requests.join('\n'),'pulse_feedback.csv':pulses.join('\n'),
 'journey_maps.md':`---\nas_of: 2026-10-22T09:00:00+04:00\n---\n# Onboarding\n| Step ID | Step | Stage | Target day | Owner | Service | Event | Depends on | Policy | Applies to |\n|---|---|---|---|---|---|---|---|---|---|\n| start | Journey started | Welcome | 1 | HR Owner | HR | journey started | | | all |\n| equipment | Collect equipment | Setup | 3 | Equipment Owner | IT | kit issued | start | equipment | all |\n| course | Book induction | Learn | 7 | Learning Owner | Learning | course booked | equipment | equipment | all |\n# Internal mobility\n| Step ID | Step | Stage | Target day | Owner | Service | Event | Depends on | Policy | Applies to |\n|---|---|---|---|---|---|---|---|---|---|\n| start | Journey started | Approved | 1 | HR Owner | HR | journey started | | | all |\n| visa | Review paperwork | Move | 3 | Mobility Owner | Mobility | visa cleared | start | relocation | location change |\n`,
 'policies/equipment.md':'---\nid: equipment\ncode: IMPORT-IT-1\nversion: 2.0\nkeywords: laptop, equipment, kit\njourney: onboarding\n---\n# Equipment policy\n## 2. Equipment deadline\nYour equipment kit is expected by day 3. Contact the named IT owner if delayed.\n\n## 3. Induction\nBook the induction course after collecting equipment.',
 'policies/relocation.txt':'---\nid: relocation\ncode: IMPORT-GM-1\nversion: 1\nkeywords: visa, relocation, paperwork\njourney: mobility\n---\n# Relocation paperwork\n## Review\nVisa paperwork is reviewed by the named mobility owner. The target is day 3.'};
}
