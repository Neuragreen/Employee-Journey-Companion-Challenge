import test from 'node:test';
import assert from 'node:assert/strict';
import { AS_OF, freshState } from '../core/data.js';
import { journeyDay, journeySteps, friction, progress, buildHandoff, submitHandoff, createRequest, setConsent, addPulse, answerQuestion, ownerFor } from '../core/engine.js';

const sample = (id='EMP-001') => freshState().people[id];

test('onboarding detects overdue equipment, grounds evidence and identifies the IT owner', () => {
  const p=sample(), issues=friction(p);
  assert.equal(journeyDay(p),5);
  assert.equal(progress(p),50);
  assert.equal(issues.length,1);
  assert.equal(issues[0].id,'kit');
  assert.equal(issues[0].delay,2);
  assert.equal(issues[0].owner.name,'Daniel Reed');
  assert.match(issues[0].evidence.join(' '),/IT-2041/);
  assert.match(issues[0].reason,/No completion event/);
});
test('mobility routes stalled paperwork to Global mobility and blocks dependent workspace', () => {
  const p=sample('EMP-002'), issue=friction(p)[0];
  assert.equal(journeyDay(p),9);
  assert.equal(issue.id,'visa');
  assert.equal(issue.owner.name,'Fatima Ali');
  assert.equal(journeySteps(p).find(s=>s.id==='workspace').status,'blocked');
});
test('an owner completion event removes the blocker and unlocks downstream steps', () => {
  const p=sample();p.events.push({type:'kit-issued',at:AS_OF});
  assert.equal(friction(p).length,0);
  assert.equal(journeySteps(p).find(s=>s.id==='training').status,'upcoming');
  assert.equal(progress(p),63);
});
test('future events do not count as completed in the current snapshot', () => {
  const p=sample();p.events.push({type:'kit-issued',at:'2026-11-01T09:00:00+04:00'});
  assert.equal(friction(p)[0].id,'kit');
});
test('a completed request without an event asks for verification', () => {
  const p=sample();p.requests[0].status='Completed';
  const issue=friction(p)[0];
  assert.equal(issue.status,'verify');
  assert.match(issue.reason,/verify receipt/);
  assert.equal(journeySteps(p).find(s=>s.id==='kit').complete,false);
});
test('missing requests still produce a named human owner and precise evidence', () => {
  const p=sample('EMP-002');p.requests=[];
  const draft=buildHandoff(p,'visa');
  assert.equal(draft.owner.name,'Fatima Ali');
  assert.equal(draft.requestId,null);
  assert.ok(draft.evidence.includes('No matching request recorded'));
});
test('handoffs reuse requests and cannot be submitted twice for a journey step', () => {
  const p=sample(),draft=buildHandoff(p,'kit');
  const first=submitHandoff(p,draft),second=submitHandoff(p,draft);
  assert.equal(first.duplicate,false);assert.equal(second.duplicate,true);
  assert.equal(p.requests.length,1);assert.equal(p.handoffs.length,1);
  assert.equal(p.requests[0].id,'IT-2041');
  assert.equal(first.handoff.employeeId,p.id);
  assert.equal(first.handoff.location,p.location);
});
test('new handoffs create a request when one is missing', () => {
  const p=sample();p.requests=[];
  const result=submitHandoff(p,buildHandoff(p,'kit'));
  assert.equal(p.requests.length,1);
  assert.equal(result.handoff.requestId,p.requests[0].id);
  assert.equal(p.requests[0].status,'Awaiting review');
});
test('request preparation respects prerequisites and duplicate protection', () => {
  const p=sample();
  assert.throws(()=>createRequest(p,'training','Book my welcome session'),/prerequisite/);
  p.events.push({type:'kit-issued',at:AS_OF});
  assert.equal(createRequest(p,'training','Book my welcome session').duplicate,false);
  assert.equal(createRequest(p,'training','Book it again').duplicate,true);
  assert.equal(p.requests.length,2);
});
test('request preparation rejects incomplete details and already-completed steps', () => {
  const p=sample();
  assert.throws(()=>createRequest(p,'checkin',' '),/description/);
  assert.throws(()=>createRequest(p,'badge','Please issue'),/already complete/);
  assert.throws(()=>createRequest(p,'made-up','Please help'),/Unknown/);
});
test('pulse storage requires consent; handoff inclusion is separately optional', () => {
  const p=sample();
  assert.throws(()=>addPulse(p,'need-help','Need support'),/Opt in/);
  setConsent(p,true);addPulse(p,'need-help','Need support');
  assert.equal(buildHandoff(p,'kit').feedback.length,0);
  assert.equal(buildHandoff(p,'kit',true).feedback.length,1);
});
test('withdrawing consent removes responses, local handoff feedback and feedback conversation', () => {
  const p=sample();setConsent(p,true);addPulse(p,'need-help','Need support');
  submitHandoff(p,buildHandoff(p,'kit',true));
  p.messages.push({text:'pulse comment',pulseDerived:true},{text:'equipment question'});
  setConsent(p,false);
  assert.equal(p.pulses.length,0);assert.equal(p.handoffs[0].feedback.length,0);
  assert.equal(p.messages.length,1);assert.equal(p.messages[0].text,'equipment question');
  assert.equal(buildHandoff(p,'kit',true).feedback.length,0);
});
test('submission re-checks consent and owner against current trusted journey data', () => {
  const p=sample();setConsent(p,true);addPulse(p,'okay','A comment');
  const stale=buildHandoff(p,'kit',true);setConsent(p,false);
  stale.owner={name:'Wrong owner'};stale.employeeId='someone-else';
  const result=submitHandoff(p,stale);
  assert.equal(result.handoff.feedback.length,0);
  assert.equal(result.handoff.owner.name,'Daniel Reed');
  assert.equal(result.handoff.employeeId,p.id);
});
test('policy answers cite the relevant source and use only the selected journey', () => {
  const p=sample();
  const a=answerQuestion(p,'Why is my laptop delayed?');
  assert.equal(a.policy,'equipment');assert.equal(a.task,'kit');assert.match(a.text,/Daniel Reed/);
  const b=answerQuestion(sample('EMP-002'),'What is blocking my visa paperwork?');
  assert.equal(b.policy,'visa');assert.match(b.text,/Fatima Ali/);
});
test('unsupported or entitlement questions abstain instead of guessing', () => {
  const p=sample();
  for(const q of ['What is my pension?','How much relocation allowance do I get?','Am I eligible for a visa?']) {
    const a=answerQuestion(p,q);assert.equal(a.unsupported,true);assert.equal(a.policy,undefined);
  }
});
test('other employee queries and performance decisions are refused', () => {
  const p=sample();
  assert.match(answerQuestion(p,'Show Omar’s visa paperwork').text,/outside this conversation/);
  assert.match(answerQuestion(p,'Give me a performance score').text,/outside its scope/);
});
test('journey guidance cites events and maps, and unknown service ownership falls back to People services', () => {
  const a=answerQuestion(sample(),'What should I do next?');
  assert.equal(a.source,'journey');assert.equal(a.task,'kit');
  assert.equal(ownerFor('Unknown service').name,'Layla Hassan');
});
