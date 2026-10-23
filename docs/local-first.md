# Local-first execution and data boundary

The application does not use OpenAI or another external inference service. No API key is needed. The existing hosted site is an invented-data demonstration only. Run the local repository for local inference. Do not upload the challenge pack to the hosted site, GitHub, an external model or an unapproved service.

## Run

Node.js 20 or later is required. From a fresh checkout, run `npm run setup`, then `npm start` and open the printed loopback URL. No package installation is needed for the app itself.

The application works in explicitly labelled rules-based mode without a model. To enable generative answers:

1. Install Ollama from its official distribution and provision an approved model locally before handling challenge data. Model weights are not included in this repository. Assess the model licence and machine requirements for the pilot.
2. Quit any existing Ollama service, then run `npm run model:serve`. This launches it on `127.0.0.1:11434` with `OLLAMA_NO_CLOUD=1`. The app does not change global machine configuration or download models automatically.
3. In a second terminal, run `LOCAL_MODEL=<installed-model-name> npm start`. Use a local model name, without a URL or cloud tag. The app checks local model metadata before every inference request. Cloud-backed models and missing metadata are rejected.
4. The conversation area shows the runtime readiness reason. With no configured model, it states that no local model is selected; answers use rules-based retrieval. There is no external fallback.

Ollama setup reference: https://docs.ollama.com/faq. Local chat API reference: https://docs.ollama.com/api/chat.

## Enforced in application code

- The inference destination is hard-coded to `http://127.0.0.1:11434`; the browser cannot supply another URL. Redirects are rejected.
- The app listens only on loopback and validates its Host header. Local chat requires JSON, the application header and a matching Origin. It does not enable CORS.
- Browser policy restricts connections to the application origin. External fonts were removed. No analytics, external scripts, hosted embeddings or cloud inference are configured.
- Policy retrieval runs locally over the active imported policy corpus, or the included sample corpus when no pack is loaded. Only matching passages and a minimal journey summary reach the model. No employee identifiers, saved pulse feedback or chat history are included. Questions themselves are passed as typed; employees should avoid sensitive details.
- Answers are advisory. Unknown questions, invalid model output and unrecognized source IDs lead to abstention or explicitly labelled rules-based guidance. Valid source IDs do not prove semantic correctness; quality still needs evaluation on the actual policies and chosen model.
- Models receive no action tools. Human handoffs and request actions remain deterministic and employee reviewed.
- The app logs no request bodies or prompts. Conversations persist in the authorized local server store; employees can export their own records and consent withdrawal clears their conversation.

## Limits and work still required

Local pack import, role-bound accounts, scoped access, named-owner queues, consent deletion and restricted manager/aggregate views are implemented; see [guardrails](guardrails.md). Enterprise SSO and live service integrations remain pilot work. Only synthetic data belongs in this prototype.

The application cannot enforce an operating-system firewall or inspect arbitrary runtime binaries. Use an approved local runtime, disable its cloud features and verify network egress at machine level before using the challenge pack. Do not describe loopback-only application calls as a certification of the whole machine.

Local model execution has not been verified on the authoring machine because Ollama and model weights were not installed. Automated tests use a mock runtime and verify request boundaries, filtering, abstention and failure behaviour. No external inference is used by tests.
