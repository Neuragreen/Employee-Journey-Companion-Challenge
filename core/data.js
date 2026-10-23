// Self-authored demonstration records. These are not Emirates policies or employee data.
export const AS_OF = '2026-10-22T09:00:00+04:00';
export const DATA_VERSION = 2;
export const OWNERS = {
  IT: { name: 'Daniel Reed', role: 'IT service desk', initials: 'DR', target: '24 hours (sample service target)', targetHours: 24 },
  HR: { name: 'Layla Hassan', role: 'People services', initials: 'LH', target: '24 hours (sample service target)', targetHours: 24 },
  Immigration: { name: 'Fatima Ali', role: 'Global mobility', initials: 'FA', target: '24 hours (sample service target)', targetHours: 24 },
  Learning: { name: 'Noor Ahmed', role: 'Learning & development', initials: 'NA', target: '48 hours (sample service target)', targetHours: 48 },
  Facilities: { name: 'James Wilson', role: 'Workplace services', initials: 'JW', target: '48 hours (sample service target)', targetHours: 48 }
};
export const POLICIES = [
  { id: 'equipment', code: 'DEMO-IT-01', title: 'Getting your equipment', category: 'IT & access', version: '1.0', section: '2.1', keywords: ['laptop', 'equipment', 'it kit', 'computer', 'device'], summary: 'Your IT kit should be ready by day 3 of onboarding.', paragraphs: ['For the synthetic onboarding journey, IT aims to issue the employee’s equipment by the end of journey day 3. An issued-kit event is the evidence of completion.', 'If no issued-kit event is recorded after the target, check existing requests before creating another. A completed request without the event needs verification; it does not prove that the device was received.', 'Equipment requests go to the named IT service desk owner. Any exception or allocation change requires their review.'], related: 'kit' },
  { id: 'access', code: 'DEMO-IT-02', title: 'Access for your new role', category: 'IT & access', version: '1.0', section: '3.1', keywords: ['access', 'login', 'permission', 'system', 'account', 'password'], summary: 'Role access requires manager approval and IT fulfilment.', paragraphs: ['For the synthetic internal mobility journey, the receiving manager approves role access. IT fulfils the request after the approval event is recorded.', 'The target is journey day 10. Access is not granted automatically by the companion. Permission changes require an accountable human owner.', 'The companion can prepare a request with the role, location and required access. Do not submit passwords or authentication codes.'], related: 'access' },
  { id: 'learning', code: 'DEMO-LD-01', title: 'Your first learning sessions', category: 'Learning', version: '1.0', section: '1.2', keywords: ['training', 'learning', 'orientation', 'induction', 'course', 'session'], summary: 'Book your welcome session during your first week.', paragraphs: ['In the synthetic onboarding journey, book the welcome session by journey day 7. Digital orientation requires a recorded equipment-issued event first.', 'Learning & development reviews booking requests and confirms the session. A booking request is not a confirmed booking.', 'Employees moving roles complete role-specific learning by day 14 of the mobility journey. The receiving team agrees the required modules.'], related: 'training' },
  { id: 'visa', code: 'DEMO-GM-01', title: 'Visa & relocation paperwork', category: 'Moving locations', version: '1.0', section: '2.2', keywords: ['visa', 'immigration', 'paperwork', 'passport', 'relocation', 'documents', 'documentation'], summary: 'Global mobility reviews documentation before location-dependent steps proceed.', paragraphs: ['For the synthetic location-move journey, documentation review is targeted for journey day 7. The visa-cleared event confirms completion.', 'If the target is missed, route the existing case to the named Global mobility owner. Relocation arrangements that depend on clearance remain blocked until the required event is recorded.', 'The companion cannot determine immigration eligibility or approve a visa. The named human owner reviews the situation and confirms next steps. Sensitive documents must use an approved secure channel; this prototype does not accept uploads.'], related: 'visa' },
  { id: 'transfer', code: 'DEMO-HR-01', title: 'Moving to your new team', category: 'Internal mobility', version: '1.0', section: '1.1', keywords: ['transfer', 'move', 'moving', 'handover', 'new team', 'new role', 'manager'], summary: 'A role move includes approval, handover, access and a team welcome.', paragraphs: ['The synthetic mobility journey begins with transfer approval. The current and receiving managers agree a handover by journey day 5.', 'Role and location determine the remaining steps. A location move includes Global mobility review. Access and relocation are tracked separately.', 'If ownership is unclear, People services receives the case for assignment to a named accountable owner. The companion cannot approve transfers.'], related: 'handover' },
  { id: 'workplace', code: 'DEMO-WS-01', title: 'Your workplace essentials', category: 'Workplace', version: '1.0', section: '1.3', keywords: ['desk', 'badge', 'building', 'facilities', 'workplace', 'office', 'parking'], summary: 'Workplace services helps with your badge and workspace.', paragraphs: ['In the synthetic onboarding journey, the building badge is targeted for day 1. In a location move, workplace setup follows documentation clearance and is targeted for day 12.', 'Requests should include the employee’s destination location and the item needed. Workplace services reviews and confirms arrangements.', 'The companion prepares requests and records their status. It cannot grant physical access or change an allocation.'], related: 'workspace' }
];
const task = (id, title, day, team, stage, event, extra = {}) => ({ id, title, day, team, stage, event, ...extra });
export const JOURNEY_MAPS = {
  onboarding: [
    task('offer', 'Offer accepted', 0, 'HR', 0, 'offer-accepted'),
    task('documents', 'Joining documents checked', 0, 'HR', 0, 'joining-documents-checked'),
    task('welcome', 'Meet your manager', 1, 'HR', 1, 'manager-met'),
    task('badge', 'Collect your building badge', 1, 'Facilities', 1, 'badge-issued'),
    task('kit', 'Collect your IT kit', 3, 'IT', 2, 'kit-issued', { policy: 'equipment' }),
    task('training', 'Book your welcome session', 7, 'Learning', 2, 'training-booked', { depends: ['kit'], policy: 'learning', employeeAction: true }),
    task('checkin', 'Your first-week check-in', 7, 'HR', 3, 'checkin-complete', { employeeAction: true }),
    task('ready', 'Complete your first-month welcome', 30, 'HR', 4, 'onboarding-complete', { depends: ['training', 'checkin'] })
  ],
  mobility: [
    task('approved', 'Transfer approved', 0, 'HR', 0, 'transfer-approved'),
    task('team', 'Meet your receiving manager', 2, 'HR', 1, 'manager-met'),
    task('handover', 'Agree your team handover', 5, 'HR', 1, 'handover-agreed', { policy: 'transfer' }),
    task('visa', 'Clear relocation paperwork', 7, 'Immigration', 2, 'visa-cleared', { policy: 'visa', requires: 'locationChange' }),
    task('access-approval', 'New-role access approved', 8, 'HR', 2, 'access-approved'),
    task('access', 'Set up your new-role access', 10, 'IT', 3, 'access-issued', { depends: ['access-approval'], policy: 'access', employeeAction: true }),
    task('workspace', 'Confirm your new workspace', 12, 'Facilities', 3, 'workspace-ready', { depends: ['visa'], policy: 'workplace', employeeAction: true, requires: 'locationChange' }),
    task('training', 'Book role-specific learning', 14, 'Learning', 4, 'training-booked', { policy: 'learning', employeeAction: true })
  ]
};
export const STAGES = {
  onboarding: ['Before you join', 'Your first day', 'Getting set up', 'Finding your feet', 'Ready to thrive'],
  mobility: ['Move approved', 'Your handover', 'Preparing to move', 'Getting connected', 'Your next chapter']
};
export const EMPLOYEES = [
  { id: 'EMP-001', name: 'Amira Al Mansoori', firstName: 'Amira', initials: 'AM', role: 'Customer Experience Specialist', team: 'Customer Experience', location: 'Dubai, UAE', manager: 'Sarah Mitchell', managerId: 'MGR-001', moveType: null, start: '2026-10-18T09:00:00+04:00', journey: 'onboarding', stage: 2, scenario: 'Onboarding · delayed equipment', events: [
    { type: 'offer-accepted', at: '2026-10-10T10:00:00+04:00' },
    { type: 'joining-documents-checked', at: '2026-10-16T10:00:00+04:00' },
    { type: 'manager-met', at: '2026-10-18T09:30:00+04:00' },
    { type: 'badge-issued', at: '2026-10-18T10:00:00+04:00' }
  ], requests: [
    { id: 'IT-2041', task: 'kit', title: 'New joiner IT kit', team: 'IT', status: 'In progress', created: '2026-10-18T10:00:00+04:00', note: 'Equipment allocation is awaiting fulfilment.', history: [{ text: 'Request assigned to Daniel Reed', at: '2026-10-18T10:00:00+04:00' }] }
  ] },
  { id: 'EMP-002', name: 'Omar Rahman', firstName: 'Omar', initials: 'OR', role: 'Airport Operations Lead', team: 'Airport Operations', location: 'Dubai → London', manager: 'Alex Morgan', managerId: 'MGR-002', moveType: 'location', locationChange: true, fromLocation: 'Dubai, UAE', toLocation: 'London, UK', start: '2026-10-14T09:00:00+04:00', journey: 'mobility', stage: 2, scenario: 'Internal move · visa paperwork', events: [
    { type: 'transfer-approved', at: '2026-10-14T09:00:00+04:00' },
    { type: 'manager-met', at: '2026-10-15T11:00:00+04:00' },
    { type: 'handover-agreed', at: '2026-10-18T10:00:00+04:00' },
    { type: 'access-approved', at: '2026-10-20T11:00:00+04:00' }
  ], requests: [
    { id: 'GM-1088', task: 'visa', title: 'Location move documentation', team: 'Immigration', status: 'Awaiting review', created: '2026-10-16T10:00:00+04:00', note: 'Documentation review is awaiting a Global mobility update.', history: [{ text: 'Case assigned to Fatima Ali', at: '2026-10-16T10:00:00+04:00' }] }
  ] }
];
EMPLOYEES.push(
  { id: 'EMP-003', name: 'Sara Patel', firstName: 'Sara', initials: 'SP', role: 'Digital Product Analyst', team: 'Digital', location: 'Dubai, UAE', manager: 'Sarah Mitchell', managerId: 'MGR-001', start: '2026-10-19T09:00:00+04:00', journey: 'mobility', moveType: 'role', locationChange: false, stage: 1, scenario: 'Role move · same location', events: [{type:'transfer-approved',at:'2026-10-19T09:00:00+04:00'},{type:'manager-met',at:'2026-10-20T09:00:00+04:00'}], requests: [] },
  { id: 'EMP-004', name: 'Yusuf Khalid', firstName: 'Yusuf', initials: 'YK', role: 'Service Coordinator', team: 'Employee Services', location: 'Dubai, UAE', manager: 'Alex Morgan', managerId: 'MGR-002', start: '2026-10-20T09:00:00+04:00', journey: 'mobility', moveType: 'team', locationChange: false, stage: 1, scenario: 'Team move · handover and access', events: [{type:'transfer-approved',at:'2026-10-20T09:00:00+04:00'},{type:'manager-met',at:'2026-10-21T09:00:00+04:00'}], requests: [] }
);
for (const p of POLICIES) { p.source = `policies/${p.id}.md`; p.applicability = p.id === 'equipment' ? {journeys:['onboarding']} : p.id === 'visa' ? {journeys:['mobility'],locationChange:true} : p.id === 'transfer' ? {journeys:['mobility']} : {}; }
export function freshState() {
  return { version: DATA_VERSION, selected: EMPLOYEES[0].id, people: Object.fromEntries(EMPLOYEES.map(p => [p.id, { ...structuredClone(p), consent: false, pulses: [], handoffs: [], messages: [], activity: [] }])) };
}
