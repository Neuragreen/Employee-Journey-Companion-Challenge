# Guardrails and role-bound local workspace

The default local app serves `/` and authenticates all data APIs. Legacy selector pages and hosting metadata are not shipped. Lower-level import/model API behaviour remains available through an explicitly injected test harness (`makeServer({evaluationMode:true})`); the normal CLI server does not enable it. Do not expose an evaluation-mode server or use it for a pilot.

## Setup

```sh
npm run setup
npm start
```

`accounts` provisions a separate account for every employee, named owner and manager in the active synthetic pack, plus one aggregate administrator. Passwords are generated randomly, stored only as salted scrypt hashes in `local-data/accounts.json`, and never printed. Initial login credentials are written with restrictive permissions to `local-data/login-credentials.txt`. Keep that file private and distribute each account only to its intended evaluator. No credentials are committed to Git. Existing accounts are never replaced without the explicit `npm run accounts -- --replace` option. Reprovision after employee/owner assignments change, and restart the server to invalidate all old sessions.

The administrator can validate/import a folder through its own view. Employees, managers and owners cannot import a pack. CLI import remains available. For final-pack header variations, use the CLI/parser mapping contract in data-pack-format.md; the secure administrator folder form currently uses supported default aliases.

## Access controls

Sessions are random opaque tokens in HttpOnly, SameSite=Strict cookies, expire after 30 minutes, and are held server-side. Password login is rate limited by loopback client address. Same-origin JSON, an application header and a session-bound CSRF token protect writes. Accounts and permissions come from server provisioning, never a request's claimed employee ID or role. No employee selector exists in this workspace. Signing out revokes the session.

Employees can retrieve/export only their provisioned record. Owners can read only cases assigned to their exact provisioned name; case summaries contain the necessary evidence and separately approved feedback, never conversations. Managers see milestone summaries for their assigned onboarding employees, with no pulse records, messages, scores or feedback. The administrator sees aggregate stall counts, with groups under five suppressed; groups are ordered by count and separated by journey type.

This is a local prototype authentication scheme, not enterprise SSO or a security certification. It binds to loopback and must not be exposed on a network. Deployment identity integration, account recovery and centralized user lifecycle management remain pilot requirements.

## Human decisions and consent

An employee reviews a named-owner handoff and separately chooses whether to attach stored pulse feedback. The server builds the summary from authoritative current records, persists it and links or creates its request. The owner can acknowledge, ask for information or record a resolution with a required note. Only the assigned owner can resolve it; prerequisites are checked server-side. Resolution records the owner's name, outcome note and timestamp, marks the service request complete and records the corresponding journey completion event. A fixed synthetic snapshot is used for event evaluation; the actual recording timestamp is preserved separately. These are local mock services, not live Emirates integrations.

Consent is checked on every pulse write and feedback attachment. Withdrawal deletes saved pulse records, structured feedback attachments and the employee's persisted conversation, and future owner reads exclude feedback. This cannot undo what a human has already read or copies manually placed in free-text notes. Original input CSV files outside the normalized store are not modified; reimport is a new dataset and re-evaluates its source consent flags. Browser tabs holding a previously fetched case need refresh to see updates. The secure UI stores no employee records or credentials in localStorage.

## Local AI and language

No external inference fallback exists. Models have no action tools. In addition to source-ID validation, generated answers must now be verbatim excerpts (at least 20 characters) contained in every cited supplied passage; fabricated additions, paraphrases and mismatched sources are rejected. This is deliberately conservative. It checks source faithfulness, not whether the passage fully answers the question; applicability still needs human review and actual-pack evaluation.

The interface supports English and Arabic with RTL layout. Employee names, imported journey labels and original policy excerpts remain in their source language. Common Arabic policy terms map locally to retrieval terms. This is not a claim of full bilingual semantic QA or certified policy translation.

Actual on-device inference installation and execution were deferred at the user's request. The runtime and weights are not installed. Controlled tests verify failure behaviour, citation/source checks, role isolation, human decisions and deletion. No live local-model quality or OS-wide network-egress verification is claimed.
