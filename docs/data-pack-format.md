# Local synthetic data-pack import

All six inputs are supported locally. The final launch pack has not been supplied; these are explicit supported schemas, aliases and adapters, not a claim to parse every possible unpublished format. No files are sent to external AI or hosting. Use only synthetic data; the default workspace enforces provisioned local roles.

## Load and inspect

Import an initial pack through the CLI, run `npm run accounts`, then start the server. Sign in as administrator, select the complete synthetic folder and choose **Validate locally**. Review file/line errors, warnings and counts, then use the separate replacement action. Validation alone does not change the dataset. Any error rejects the whole pack and preserves the active one. Warnings do not block import but should be reviewed.

For a terminal workflow:

```sh
npm run import-pack -- examples/data-pack --validate
npm run import-pack -- examples/data-pack
npm start
```

Normalized data is written atomically to `local-data/active-pack.json` with restrictive file permissions. That folder is ignored by Git and blocked from direct HTTP access. The app reloads this dataset on restart. Imports replace rather than merge datasets, preventing accidental mixing with demo employees. Handoffs and request edits persist in the normalized server store. Replacing a pack replaces those edits; reprovision accounts and restart after assignments change. The CLI reports the same validation results as the interface.

## CSV conventions and mapping

UTF-8, optional BOM, comma separator, header row, CRLF or LF, quoted commas, escaped double quotes and multiline quoted cells are supported. Headers are case-insensitive; spaces and hyphens normalize to underscores. Empty files without headers, duplicate headers, malformed rows and unsafe identifiers are rejected. Limits: 20 MiB input, 1,000 files, 50,000 rows per CSV and 200,000 characters per policy.

Common aliases are accepted, such as `emp_id`/`employee_id`, `journey_type`/`journey`, `event_type`/`event`, and `created_at`/`opened_at`. If final-pack column names differ, use the parser API’s `columnMapping` option (the CLI and secure folder form currently use default aliases). Mapping keys below are canonical parser names, and values are source headers:

```json
{
  "employees.csv": {"id":"Staff Number","name":"Display Name","journey":"Journey Type","start":"Effective Date"},
  "journey_events.csv": {"id":"Staff Number","event":"Milestone","at":"Recorded At"},
  "service_requests.csv": {"id":"Staff Number","requestId":"Case Number","created":"Opened","hours":"Hours Open","task":"Step","service":"Service","owner":"Assigned Owner"},
  "pulse_feedback.csv": {"id":"Staff Number","rating":"Response","comment":"Comment","consent":"Consent","at":"Submitted"}
}
```

Dates must be `YYYY-MM-DD` (interpreted as UTC midnight) or ISO timestamps with `Z`/an explicit offset. Ambiguous dates such as `01/02/26`, invalid calendar dates and timestamps without time zones are rejected. IDs allow letters, digits, dots, underscores and hyphens. Employee and request IDs must be unique; unknown employee references are errors. No source text is executed.

### employees.csv

Required: `employee_id`, `name`, `journey`. Journey values include `onboarding`, `internal mobility`, `mobility`, `transfer`, `role move`, `team move`, `location move`.

Also provide `start_date` (aliases `join_date`, `joining_date`, `effective_date`, `journey_start`). If absent, only an explicit `journey-started`, `joined`, `first-day`, `employment-started` or `transfer-approved` event can establish the start, with a warning; no start is guessed from unrelated paperwork events.

Optional: `stage`, `manager`, `manager_id`, `location`, `role`, `team`, `consent`, `move_type`, `location_change`, `role_change`, `team_change`, `from_location`, `to_location`. A changed source/destination location also establishes a location move. Missing optional fields are left empty. Imported stage labels are preserved and compared with the map; event evidence drives completion.

### journey_events.csv

Required headers: `employee_id`, `event_type`, `timestamp`. Optional: `event_id`. Event types normalize spaces/underscores to hyphens. Without an ID, the employee/type/timestamp combination is the duplicate key. Unknown map events are retained with warnings. Future events are retained and excluded from current completion.

### service_requests.csv

Required headers: `employee_id`, `request_id`, `status`. Provide `created_at` or numeric `time_open_hours`/`hours_open` (`time_open` is interpreted as hours). The latter computes an opening timestamp from the pack snapshot and reports a warning.

Optional: `task_id`/`step_id`, `title`/`request_title`/`request_type`, `owner`, `service`, `description`. Prefer an explicit step ID. If absent, a unique title or service match can establish the step with a warning. Ambiguous requests are preserved as standalone requests only when they have a named owner; they never silently mark a journey step complete. Explicit invalid step IDs are errors. Missing linked owners are filled from the named journey-map owner and reported.

Statuses: `open`, `in progress`, `pending`, `awaiting review`, `on hold`, `blocked`, `completed`, `closed`, `resolved`, `cancelled`/`canceled`. Unknown statuses are errors rather than assumed complete. A completed request without a completion event remains a verification issue.

### pulse_feedback.csv

Required headers: `employee_id`, `timestamp`, `rating` (aliases include `response`, `score`). Optional: `feedback_id`, `comment`, `stage`, `consent`.

Feedback is accepted only with explicit row-level consent or explicit active employee-level consent. An explicit employee-level no blocks row-level yes; an explicit row no excludes that response. Missing consent does not inherit consent from a previous feedback row. Excluded comments are not stored in the normalized pack or model context. Exclusion counts and warnings appear in the report. Existing `positive`/`negative` responses are treated as provided labels, not model-inferred sentiment. Unknown or numeric ratings remain `unclassified`, retaining their original response without inventing a sentiment score.

Withdrawing consent in the interface also deletes imported feedback from the normalized local dataset, so reload/reset does not restore it. Reimporting an original pack is a fresh dataset and re-evaluates its consent fields.

## policies/

Supported files are UTF-8 `.md` and `.txt`, including nested directories. PDF, DOCX, scanned images, archives and other formats are explicitly rejected; convert them locally to reviewed UTF-8 text before import. The challenge has not specified its policy document format yet. Files with the same basename require explicit distinct IDs. No HTML/Markdown is executed.

Optional frontmatter:

```markdown
---
id: equipment
code: IT-ONB-01
version: 1.0
category: IT
keywords: equipment, laptop, kit
journey: onboarding
---
# Equipment policy
## 2. Issue target
Equipment should be issued by day 3.
```

Without metadata, the filename provides the ID, the first heading provides the title, and version is explicitly `unspecified`. Headings and passages are retained for citations. Matching policy passages drive rules-based answers and optional local model context. Imported answers cite the imported filename/document ID, version and section; the complete source opens in the policy library. A citation validates source identity, not the model's semantic accuracy. Unknown questions abstain and offer human clarification. Models remain local-only.

## journey_maps.md

Use a Markdown table per journey, headed `# Onboarding` and `# Internal mobility`, or a combined table with a `Journey` column. Free-form prose is not used to invent workflow rules: a document without a supported table is rejected. An example is in `examples/data-pack/journey_maps.md`.

```markdown
---
as_of: 2026-10-22T09:00:00+04:00
---
# Onboarding
| Step ID | Step | Stage | Target day | Owner | Service | Event | Depends on | Policy | Applies to |
|---|---|---|---|---|---|---|---|---|---|
| start | Journey started | Welcome | 1 | Named HR Owner | HR | journey started | | | all |
| equipment | Collect equipment | Setup | 3 | Named IT Owner | IT | kit issued | start | equipment | all |
```

A named `Owner` and `Service` are required for every step. A target accepts a numeric day, `Day 3`, `3 days` or `48 hours`. Day 1 starts on the journey start date; day targets expire at the end of that journey day. Hour targets use elapsed hours from the start. Targets are calendar-based; working-day calendars are not inferred. Optional `employee_action` accepts true/yes/1. `Depends on` lists step IDs separated by commas or semicolons; missing prerequisites and cycles reject import. `Policy` can reference a policy ID, code or filename. Unknown references reject import.

`Applies to` accepts all/always, location change, role change or team change. Applicable steps may not depend on an excluded prerequisite. Stage labels are ordered by first appearance. An `as_of` snapshot in frontmatter makes evaluation repeatable; the parser API accepts an explicit override. Without one, import time is used with a warning.

## Evaluation boundary

The default local app uses server-enforced accounts: employees receive their own records, named owners receive assigned cases, and managers receive only their assigned onboarding milestone summaries. The old scenario-selector website is not shipped. Lower-level import/model API tests use an explicitly injected evaluation mode that the normal CLI server never enables. Enterprise identity, working-day calendars and real workflow fulfilment remain pilot work. See [guardrails](guardrails.md).
