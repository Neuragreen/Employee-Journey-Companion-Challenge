# Judge evaluation guide

## Start here

Follow the two-command setup and account walkthrough in the root README. This evaluates the actual server-backed app, not the previous hosted preview. The organiser pack was unavailable; all bundled inputs are invented. The fixed snapshot keeps deadlines reproducible.

## Requirement mapping

| Challenge requirement | How to evaluate | Boundary |
| --- | --- | --- |
| Journey stage and next step | Employee 1: day, completion summary, equipment overdue and induction blocked; resolve equipment to unlock induction. | Imported stage/map, events, targets and dependencies drive rules. Calendar days only. |
| Policy/process answers with citations | Ask the equipment or visa questions in README; open the cited original source. | Two invented example policies. No official policy accuracy claim. Unsupported allowances abstain. |
| Start routine requests through workflows | Employee reviews and submits a named-owner handoff. Existing request is reused; a missing linked request can be created by the workflow. | Local mock service, not live HR/IT. |
| Detect friction early | Missing completion events and overdue map steps surface before the employee sends a case. | Deterministic event/request rules; no person-level risk score. |
| Human escalation with summary | Owner 2 or owner 4 sees only their assigned queue, evidence and optional shared feedback; records required outcome note. | Human resolution changes the local request and completion event. |
| Explicit pulse consent | Employee 2 starts without consent. Opt in, save a check-in, attach only by separate choice, withdraw and refresh. | Withdrawal deletes normalized feedback, attachments and conversation; cannot undo already-read information. |
| Employee sees only own data | Distinct employee logins; no employee selector. Automated tests attempt cross-employee and cross-role API actions. | Local provisioned identity, not enterprise SSO. |
| Arabic and English | Toggle العربية / English. | RTL and core controls; source labels remain original language. Limited Arabic retrieval. |
| Manager view | Manager 1 sees six assigned onboarding employees' milestones. | No conversations, pulse feedback or scores. |
| Journey stalls | Administrator sees two groups of six on a fresh pack. Counts decline after resolutions. | Only overdue-step groups of at least five; smaller groups suppressed. |
| Data-pack support | Administrator validates and imports a synthetic folder, or use the CLI below. | CSV + UTF-8 Markdown/text policies + structured Markdown journey tables. Final-pack compatibility unverified. |

## Replacing the synthetic pack

Validate without changing active data:

```sh
npm run import-pack -- /absolute/path/to/pack --validate
```

To activate, stop the server and back up local-data privately, run the same command without `--validate`, then reprovision accounts using `npm run accounts -- --replace` and restart. Account replacement changes credentials. Keep the new handout private. The administrator's folder importer offers validation and a separate replacement action; account provisioning still occurs locally after assignments change.

The parser supports documented column aliases and programmatic explicit column mappings; the CLI and secure folder form currently use default aliases. See data-pack-format.md for supported fields. Unknown policy formats and free-form journey rules reject import rather than guessing.

## Submission status and remaining pilot work

The repository and two-page solution note are included. The demo video is included at [demo-video/demo.mp4](../demo-video/demo.mp4). Local-model execution, full bilingual evaluation, final-pack/hidden-scenario results, enterprise SSO, real service delivery, business-day calendars and operational security review are not claimed as completed. A pilot requires approved identity, hosting/storage and model runtime, named owner coverage, retention/recovery procedures, integration validation and actual user testing.

## Verification

Run `npm test` and `npm run check`. Tests use invented fixtures and a mock model runtime. The `evaluationMode` argument in makeServer is used only by tests for lower-level import/model APIs; the normal command-line server never enables it. No scenario-selector website is shipped.
