# Companion
<img width="1280" height="720" alt="image" src="https://github.com/user-attachments/assets/be36363d-f23e-43b5-8729-5e797f790f81" />

**A local employee journey companion for onboarding and internal mobility.** Employees see their next step, ask cited policy questions and send reviewed cases to a named human owner. Owners close the loop with recorded outcomes.

This is the challenge submission repository. The organiser's dataset was not available at preparation time, so the included pack contains **12 invented synthetic employees and two invented policy documents**. These are not Emirates employees, official policies or evidence of official service targets. The dataset uses a fixed snapshot of **22 October 2026**, so results remain reproducible.

## Run locally - about two minutes

**Prerequisite:** Node.js 20 or later, with npm. No app dependencies, API key, model download or paid service is required.

From the repository folder:

```sh
npm run setup
npm start
```

Open **http://localhost:4173** in your browser. Keep the terminal running. Stop with Ctrl+C.

Setup validates and activates the included pack, creates individual role-bound accounts and writes the private login handout to `local-data/login-credentials.txt`. Open that file locally and use the password for the account you want to evaluate. Passwords are randomly generated per checkout; there is no shared default password. Setup is safe to repeat: it preserves existing data and accounts. An expected validation warning reports that one sample feedback row is excluded because its employee did not opt in.

**Do not open dist/index.html directly or use a static file server.** The application needs its included local server for authorization and saved workflows. Do not expose the server publicly; it binds to loopback. If port 4173 is busy, set the `PORT` environment variable before starting and use the printed URL.

## Suggested judge walkthrough

Sign out before changing accounts. Each login has a fixed role; employees cannot switch identities inside their workspace.

| Account | Role and what to try |
| --- | --- |
| `employee-1` | Onboarding. Equipment is overdue; induction depends on equipment. Ask **What is the equipment deadline?**, open its citation, then use **Review handoff** beside Collect equipment and **Submit to named owner**. |
| `owner-2` | Equipment Owner. Open the assigned case, choose **Resolved**, enter an outcome note and click **Record human decision**. Return as employee-1 to see the completed equipment step and unlocked induction. |
| `employee-2` | Internal mobility. Paperwork is overdue. Ask **What is the visa paperwork process?**, open its citation and submit a reviewed handoff for Review paperwork. |
| `owner-4` | Mobility Owner. See employee-2's case and record an acknowledgement, information request or resolution. |
| `manager-1` | See milestones for the six assigned onboarding employees. Conversations, feedback and scores are excluded. |
| `administrator` | See where journeys stall: overdue-step groups of at least five. Validate/import a synthetic folder through this view. |

The account handout also identifies each account's binding. Owner numbering above applies to the untouched included pack; a different pack can produce different numbering.

Under **Your data and consent**, employee-2 can opt in, save a check-in, export their records and withdraw consent. Saving feedback and sharing it in a handoff are separate choices. Try **How much relocation allowance do I get?** to see an unsupported question abstain. Use **العربية** for Arabic controls and RTL; policy excerpts and imported labels keep their source language.

Actions persist. Resolving cases changes counts and milestones. To repeat the original demonstration, stop the server, move the entire `local-data/` folder to a private backup outside the repository, then run setup and start again. This creates new credentials. Never put a backup or credentials into Git.

## What is implemented

- Map-driven journey steps, deadlines, prerequisites and event-based completion for both journeys.
- Early overdue/missing-evidence detection and named-owner routing, with existing requests reused.
- Locally retrieved policy excerpts with document, version and section citations; sources open for inspection.
- Reviewed handoffs delivered to authenticated local mock-service queues; only the assigned owner records a human outcome.
- Server-bound employee access, scoped exports, explicit feedback consent and persistent withdrawal/deletion.
- English/Arabic controls, restricted manager new-joiner milestones and aggregate stall counts with small-group suppression.
- Local validation/import of all four CSV inputs, policies/ and journey_maps.md. See the [supported pack format](docs/data-pack-format.md).

## AI mode and practical limits

**The submission runs in rules-based mode by default.** An optional local Ollama adapter exists, but runtime/model installation and actual on-device inference were deferred and are not required to evaluate the working workflows. There is no external inference fallback. See [local AI boundaries](docs/local-first.md).

This is a synthetic local prototype, not production SSO or a live HR integration. All service fulfilment is simulated by named human accounts. Source citations do not certify policy applicability. Arabic retrieval uses a limited vocabulary, not evaluated policy translation. Targets are calendar-based, not business-day SLAs. The final organiser pack and hidden scenarios have not been supplied or evaluated. The README and solution note distinguish implemented behaviour from pilot work.

## Submission materials

- [Demo video](demo-video/demo.mp4) - 2 minutes 54 seconds, narrated live walkthrough with chapter headings, timecode and progress bar (no captions); download/view the included MP4; if GitHub does not play it inline, choose **View raw** or **Download**.
- [Solution note - two-page PDF](output/pdf/companion-solution-note.pdf)
- [Solution note - editable text](docs/solution-note.md)
- [Evaluation guide and requirement mapping](docs/evaluation-guide.md)
- [Consent, authorization and human oversight](docs/guardrails.md)
- [Input schemas and validation](docs/data-pack-format.md)
- [Optional local-model setup](docs/local-first.md)

The demo video is included in `demo-video/demo.mp4`. Rehearsal scripts, credentials, runtime state and authoring intermediates are not part of this repository.

## Verify and inspect

```sh
npm test
npm run check
```

Tests cover journey rules, import failures, role isolation, consent deletion, named-owner resolutions and local-model boundary handling using mocks. No external AI service is used by the tests.

| Folder | Purpose |
| --- | --- |
| `dist/` | Current local website and self-contained assets; no build step. |
| `core/` | Journey rules, validation, local persistence, authorization and optional model gateway. |
| `scripts/` | Setup, account provisioning, pack import and checks. |
| `examples/data-pack/` | Included synthetic demonstration inputs. |
| `tests/` | Automated tests and independent fixtures. |
| `docs/`, `output/pdf/` | Judge-facing documentation and solution note. |
| `local-data/` | Generated private state and credentials; ignored by Git and unavailable through HTTP. |

Use only synthetic data. Do not upload packs to an unapproved service. No external fonts, analytics or model services are configured.
