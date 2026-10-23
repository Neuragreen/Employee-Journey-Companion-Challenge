import { rankPolicies, expandQuestion } from './import-pack.js';
import { AS_OF, JOURNEY_MAPS, OWNERS, POLICIES } from './data.js';
const DAY = 86400000;
export const ownerFor = team => OWNERS[team] || OWNERS.HR;
export function journeyDay(person, asOf = person.asOf || AS_OF) { return Math.max(1, Math.floor((new Date(asOf) - new Date(person.start)) / DAY) + 1); }
export function journeySteps(person, asOf = person.asOf || AS_OF) {
  const seen = new Set(person.events.filter(e => new Date(e.at) <= new Date(asOf)).map(e => e.type));
  const map=person.journeyMap || JOURNEY_MAPS[person.journey];
  return map.map(t => {
    const complete = seen.has(t.event);
    const due = new Date(new Date(person.start).getTime() + (t.targetHours !== undefined ? t.targetHours * 3600000 : (Math.max(1, t.day) - 1) * DAY)).toISOString();
    const missing = (t.depends || []).filter(id => !seen.has(map.find(s => s.id === id)?.event));
    const request = person.requests.find(r => r.task === t.id);
    const late = new Date(asOf) - new Date(due);
    const overdue = !complete && late >= (t.targetHours !== undefined ? 0 : DAY);
    const status = complete ? 'complete' : request?.status === 'Completed' ? 'verify' : missing.length ? 'blocked' : overdue ? 'overdue' : 'upcoming';
    return { ...t, complete, due, missing, overdue, status, delay: Math.max(0, Math.floor(late / DAY)), request, owner: request?.owner || t.owner || person.owners?.[t.team] || ownerFor(t.team) };
  });
}
export function friction(person, asOf = person.asOf || AS_OF) {
  return journeySteps(person, asOf).filter(t => !t.complete && (t.overdue || t.status === 'verify')).map(t => ({
    ...t,
    reason: t.status === 'verify' ? 'The request is complete, but the journey event is missing. Your owner needs to verify receipt.' : `The day ${Math.max(1, t.day)} target has passed by ${t.delay} day${t.delay === 1 ? '' : 's'}. No completion event is recorded.`,
    evidence: [ `Journey map: ${t.title}, target day ${Math.max(1, t.day)}`, t.request ? `Request ${t.request.id}: ${t.request.status}` : 'No matching request recorded', `No ${t.event} event as of ${asOf}` ]
  }));
}
export function progress(person) { const s = journeySteps(person); return Math.round(s.filter(t => t.complete).length / s.length * 100); }
export function buildHandoff(person, stepId, includePulse = false, message = '') {
  const step = journeySteps(person).find(t => t.id === stepId);
  if (!step) throw new Error('Unknown journey step');
  const issue = friction(person).find(t => t.id === stepId);
  return {
    task: step.id, title: step.title, owner: step.owner, team: step.team,
    employee: person.name, employeeId: person.id, role: person.role, location: person.location, journeyTeam: person.team, journey: person.journey, day: journeyDay(person),
    summary: issue?.reason || `Employee requested support with ${step.title.toLowerCase()}.`,
    evidence: issue?.evidence || [`Journey step: ${step.title}`, `Status: ${step.status}`],
    requestId: step.request?.id || null,
    feedback: includePulse && person.consent ? person.pulses.map(p => ({ rating: p.rating, comment: p.comment, at: p.at })) : [],
    message: message.trim(), created: person.asOf || AS_OF
  };
}
export function submitHandoff(person, draft) {
  const expected = journeySteps(person).find(t => t.id === draft.task);
  if (!expected) throw new Error('Unknown journey step');
  const prior = person.handoffs.find(h => h.task === draft.task);
  if (prior) return { handoff: prior, duplicate: true };
  const authoritative = buildHandoff(person, draft.task, Boolean(draft.feedback?.length), draft.message || '');
  const handoff = { ...authoritative, id: `HF-${person.id}-${person.handoffs.length + 1}`, status: 'Awaiting human review' };
  person.handoffs.push(handoff);
  let req = person.requests.find(r => r.task === draft.task);
  if (!req) {
    req = { id: `REQ-${person.id}-${person.requests.length + 1}`, task: draft.task, title: expected.title, team: expected.team, owner: expected.owner, status: 'Awaiting review', created: person.asOf || AS_OF, note: 'Prepared for named human owner review.', history: [] };
    person.requests.push(req);
  }
  req.history.push({ text: `Handoff prepared for ${expected.owner.name}; awaiting review (demo)`, at: person.asOf || AS_OF });
  handoff.requestId = req.id;
  person.activity.push({ text: `Prepared ${expected.title.toLowerCase()} handoff for ${expected.owner.name}`, at: person.asOf || AS_OF });
  return { handoff, duplicate: false };
}
export function createRequest(person, taskId, note) {
  const task = journeySteps(person).find(t => t.id === taskId);
  if (!task) throw new Error('Unknown journey step');
  const existing = person.requests.find(r => r.task === taskId);
  if (existing) return { request: existing, duplicate: true };
  if (task.complete) throw new Error('This journey step is already complete.');
  if (task.missing.length) throw new Error('A prerequisite needs to be completed before this request can start.');
  if (note.trim().length < 5) throw new Error('Add a short description so your owner can help.');
  const request = { id: `REQ-${person.id}-${person.requests.length + 1}`, task: taskId, title: task.title, team: task.team, owner: task.owner, status: 'Awaiting review', created: person.asOf || AS_OF, note: note.trim(), history: [{ text: `Request prepared for ${task.owner.name} (demo)`, at: person.asOf || AS_OF }] };
  person.requests.push(request);
  person.activity.push({ text: `Prepared a request: ${task.title}`, at: person.asOf || AS_OF });
  return { request, duplicate: false };
}
export function setConsent(person, allowed) {
  person.consent = Boolean(allowed);
  if (!allowed) {
    person.pulses = [];
    person.handoffs.forEach(h => { h.feedback = []; });
    person.messages = person.messages.filter(m => !m.pulseDerived);
  }
}
export function addPulse(person, rating, comment) {
  if (!person.consent) throw new Error('Opt in before sharing a pulse.');
  if (!['good', 'okay', 'need-help'].includes(rating)) throw new Error('Choose how your journey feels.');
  const pulse = { rating, comment: comment.trim(), at: person.asOf || AS_OF };
  person.pulses.push(pulse);
  return pulse;
}
export function answerQuestion(person, input) {
  const q = expandQuestion(input.trim());
  const clarificationOwner=person.imported ? (person.owners?.HR?.name || 'the named owner of the relevant journey step') : 'Layla Hassan';
  if (!q) return { text: 'Ask me about your next step, a request or one of the sample policies.' };
  if (/performance|disciplin|rank employees|productivity score/.test(q)) return { text: 'This companion supports your journey. Performance and disciplinary decisions are outside its scope.' };
  if (/other employee|everyone.?s|all employees|employee list|omar|amira/.test(q) && !q.includes(person.firstName.toLowerCase())) return { text: 'This view only answers questions using the selected demo employee’s journey. Other employees’ records are outside this conversation.' };
  if (/sentiment|pulse|feedback|survey/.test(q)) return { text: person.consent ? `Pulse sharing is on. You have ${person.pulses.length} locally saved response(s). You choose separately whether a handoff includes them. You can withdraw consent and delete them in My data & privacy.` : 'Pulse sharing is off. Your feedback is not used. Journey delays are detected from recorded events and request targets. You can opt in under My data & privacy.' };
  if (!person.imported && /\ballowance\b|\bsalary\b|\bpay\b|\bannual leave\b|\bovertime\b|\bbusiness class\b|\beligib/.test(q)) return { text: 'The sample policies do not establish that entitlement or eligibility. I can’t give a verified answer. People services can help clarify it; you can review a handoff to Layla Hassan.', unsupported: true };
  let policies=(person.policies || POLICIES).filter(p=>!p.applicability?.journeys?.length||p.applicability.journeys.includes(person.journey));
  if (person.imported) {
    const topic=[/\ballowances?\b/,/\bsalary\b|\bpay\b/,/\bannual leave\b/,/\bovertime\b/,/\bbusiness class\b/,/\beligib\w*\b/].find(pattern=>pattern.test(q));
    if(topic){
      policies=policies.map(policy=>({...policy,sections:(policy.sections||policy.paragraphs.map(text=>({heading:policy.section,text}))).filter(section=>topic.test(section.text))})).filter(policy=>policy.sections.length);
      if(!policies.length)return {text:`The available policies do not establish that entitlement or eligibility. I cannot give a verified answer. Please review a clarification handoff to ${clarificationOwner}.`,unsupported:true};
    }
  }
  const matches = person.imported ? rankPolicies(policies,input).map(x=>({...x,policy:{...x.policy,section:x.passage.heading,summary:x.passage.text.length>1500?x.passage.text.slice(0,1500)+'… Open the cited source for the complete passage.':x.passage.text}})) : policies.map(p => ({ policy:p,score:p.keywords.reduce((n,k)=>n+(q.includes(k.toLowerCase())?1:0),0) })).sort((a,b)=>b.score-a.score);
  if (/what.?s next|what is next|next step|what should|my journey|where am i|progress|blocked|stuck|delay/.test(q) && !matches[0]?.score) {
    const issue = friction(person)[0];
    const next = journeySteps(person).find(t => !t.complete && !t.missing.length);
    return { text: issue ? `You’re on day ${journeyDay(person)} of ${person.journey === 'onboarding' ? 'onboarding' : 'your internal move'}. ${issue.title} needs attention. ${issue.reason} ${issue.owner.name} (${issue.owner.role}) is the right owner. I can prepare a handoff for you to review.` : `You’re on day ${journeyDay(person)}. ${next ? `Your next step is ${next.title.toLowerCase()}, targeted for day ${next.day}. ${next.owner.name} is the owner.` : 'All recorded journey steps are complete.'}`, task: issue?.id || next?.id, source: 'journey' };
  }
  const best = matches[0];
  if (best?.score) {
    const policy = best.policy;
    const step = journeySteps(person).find(t => t.policy === policy.id || t.id === policy.related);
    let context = '';
    if (step) context = step.complete ? ' Your journey has a completion event for this step.' : ` In your journey: ${step.title.toLowerCase()} is ${step.status === 'overdue' ? `${step.delay} days past its target with no completion event recorded` : step.status === 'blocked' ? 'waiting for a prerequisite' : step.status === 'verify' ? 'awaiting verification because the request and event records differ' : step.request ? step.request.status.toLowerCase() : 'not yet recorded as complete'}. ${step.owner.name} is the owner.`;
    return { citationSection:policy.section,sourcePath:policy.source, text: `${policy.summary}${context} ${/visa|immigration/.test(q) ? 'Eligibility and approvals need Global mobility review.' : ''}`.trim(), policy: policy.id, task: step?.complete ? null : step?.id, source: 'policy' };
  }
  if (/hello|^hi\b|^hey\b|thank/.test(q)) return { text: `Hi ${person.firstName}. I can help explain your next step, find a sample policy, or prepare a request for its human owner. What would make your day easier?` };
  return { text: `I cannot verify that from the available policies. Please review a clarification handoff to ${clarificationOwner}.`, unsupported: true };
}
