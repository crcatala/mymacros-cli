# Research: Jev (TypeSafe "System One" models) and its potential for `crcatala/mymacros-cli`

**Repository:** `crcatala/mymacros-cli` — unofficial CLI for GetMyMacros, the diet/macro-tracking app.
**Local checkout inspected:** `/tmp/jev-research.1FrXpC/mymacros-cli`
**Research date:** 2026-09-18
**Evidence provenance:** Jev claims are drawn from the parent-fetched source dossier (`/tmp/jev-research.1FrXpC/jev-source-dossier.md`), which was fetched directly from the linked TypeSafe, evals, and Archer Hume sources. Repo claims are from direct inspection of the local checkout. The subagent environment could not independently re-fetch web sources, so external quotes are second-hand via that dossier and are labeled by origin. Vendor claim vs. independent observation vs. researcher inference are marked throughout.

---

## 1. Executive summary

**Jev is not an LLM that writes text; it is a hosted "System One" decision engine** that takes a piece of text state and returns *typed, calibrated probabilities* for pre-defined questions — yes/no (`Noul`), multiple-choice (`Choice`), and rubric scoring (`Score`) — over a documented HTTP API (`POST https://api.typesafe.ai/v1/systemone`, model alias `jev-latest`). *(Vendor documentation, via dossier.)*

The important implication: Jev is a **classifier/ranker at the decision layer**, not a replacement for the language model in a chat UI. It is documented as explicitly *not* generating code, replies, or explanations, and as *not* being an autonomous agent. That constraint is exactly why it fits this repository well: `mymacros-cli` is already "optimized for AI agent use" — it exposes deterministic, machine-readable commands and leaves reasoning/orchestration to an external agent. Jev is the missing low-latency, high-volume **decision primitive** that can sit *inside* that pipeline (rerank a food search, judge plausibility, gate actions on confidence) without paying generator latency or cost.

**Bottom-line potential impact: MEDIUM-to-HUGE, concentrated in one area.** The single highest-leverage opportunity is a **"natural-language food resolution" layer** — turning free text ("two scrambled eggs and a coffee") into the correct `foodId` by using Jev to rank/select among existing search results, with confidence-gated auto-logging and a human review fallback. This materially changes the product from "an ID-driven automation tool for power users" into "a scripting-friendly natural-language logger." Everything else (support triage, data hygiene, CI checks) is incremental. The main caveats are that every Jev signal is **vendor-described and early-access**, calibration must be re-validated per domain, and adding a third-party hosted API introduces a new **privacy/data-egress surface for health-adjacent data**.

---

## 2. What Jev is — technical explanation and verified capabilities

### 2.1 The core concept (vendor documentation)

- TypeSafe describes **"System One Models"** as a class of models built for *fast, structured decisions that software can consume directly*. The interface is **structured state in, typed decisions/probabilities out**, not free-form text. **Jev** is described as its first public/flagship model. *(Vendor claim.)*
- API surface: **`POST https://api.typesafe.ai/v1/systemone`** with a bearer API key; documented model alias **`jev-latest`**. A request evaluates **one `state`** (a string, JSON object, or array of text values) against a **map of typed questions**. *(Vendor documentation.)*
- **Question primitives:**
  - **Noul** — yes/no question returning a probability (0–1) for "yes."
  - **Choice** — select among caller-defined options; returns the chosen option **plus a probability distribution**.
  - **Score** — rate against an ordered caller-defined rubric; returns a probability-weighted score, legend, distribution, and a derived `confidence`.
- `Choice` and `Score` return full distributions and a derived **`confidence`**; `Noul` returns a probability without that same confidence field. TypeSafe states confidence is **derived from the distribution, not an independent learned guarantee**. *(Vendor documentation.)*
- Questions can be evaluated **independently and in parallel** over the same state in one request — enabling many narrow judgments per call. Docs recommend: keep control flow and side effects in code; ask narrow atomic questions; compose answers in code; use probability/thresholds to act, review, or escalate. *(Vendor documentation — this is the documented integration philosophy.)*

### 2.2 Hard capability boundaries (documented)

- **Input is text-only** (strings/objects/arrays of text). Images, audio, and video are documented as **unsupported**. *(Vendor documentation.)*
- **No generation**: System One does not generate replies, code, or explanations of reasoning. It is **not an autonomous agent**; code owns workflow and control flow. *(Vendor documentation.)*
- **Training direction is RLCD** (Reinforcement Learning for Calibrated Decisions): decisions/probabilities optimized so higher probabilities should track higher empirical accuracy **across groups**. Calibration is **not** a per-prediction guarantee. *(Vendor documentation.)*
- **Error model**: documented 401, 422, 429, 529, with a recommendation of exponential backoff for rate-limit/overload. Exact schema/retry behavior is defined by the API docs/SDK. *(Vendor documentation.)*

### 2.3 Performance, cost, and access (vendor-reported, workload-specific)

- Launch post claims **~70–500 ms** end-to-end for TypeSafe workflows, **input price $0.042 per million tokens** ($42/billion), and **free output tokens**. It also claims **40×–200× speedups** for comparable System One-shaped queries, with much larger homepage comparisons (**193.6× faster, 444.6× cheaper**). **These are vendor-reported, workload-specific marketing figures, not independent benchmarks.** *(Vendor claim — treat with caution.)*
- Jev was in **early access at launch**. The launch post discloses eval bias: workflows were authored by the model-capabilities team, reference probabilities came from **OpenAI/Anthropic** models, and measurements depend on laptop/service-region conditions. *(Vendor disclosure.)*
- The launch post claims **type-safe outputs cannot produce type errors under the output contract**. This is about *schema validity*, **not semantic correctness or calibrated accuracy** — a valid typed decision can still be wrong. *(Vendor claim; important caveat.)*

### 2.4 Independent evidence

- **`evals.typesafe.ai`** presents code-defined workflows where the model answers narrow questions and ordinary code takes the final action. The visible example is **expense-claim review**: read the receipt/claim, classify expense type, assess description match, then code routes to manager review or approval. **This is vendor-controlled evidence** — inspect methodology before treating scores as an external benchmark. *(Vendor-published evaluation.)*
- **Archer Hume's independent post** argues Jev's key proposition is *direct decision probabilities over shared state and allowed answers*, rather than generated confidence text. The author reconstructs a *plausible* architecture (shared-state encoding, question branches, direct probability readouts, possibly listwise option processing) but **repeatedly labels deeper claims as speculative/black-box inference**. Black-box observations on **a single early-access model/version/region** are consistent with **question isolation, option-order sensitivity, listwise option interactions, and fast server-reported timings** — but the author warns these do **not uniquely identify the implementation** and are not isolated hardware benchmarks. A calibration analysis exists on selected benchmark/fresh-math samples, but **this is not proof of calibration for any production domain**. *(Independent analysis — held to a lower confidence than vendor docs; architectural specifics remain unconfirmed.)*

### 2.5 Engineering takeaway from the sources

- **Best fit:** narrow semantic classification, detection, routing, scoring, ranking/retrieval, verification, and feature extraction, where the answer space can be defined in advance and code owns actions.
- **Especially promising:** high-volume low-latency checks, confidence-gated routing, model/prompt/tool-call verification, moderation/safety checks, semantic linting, map-reduce over large text collections.
- **Poor fit / unsupported:** open-ended answer generation, code generation, explanations, unconstrained agent loops, and **any multimodal input**.
- **Safe integration pattern:** deterministic prechecks first → send minimal relevant structured state → ask independent atomic questions → keep thresholds/config reviewable → log probabilities and outcomes → route low-confidence/high-risk cases to humans or a stronger model → **never let valid schema output bypass authorization, policy, or side-effect checks**.

---

## 3. Repository context (direct inspection)

### 3.1 What the repo is and how it works

`mymacros-cli` (npm `mymacros-cli`, v0.4.1, MIT) is a **TypeScript CLI** (Commander, `keytar`, `kleur`, `ora`; Node `^22.21.0 || >=24.0.0`) that wraps the **undocumented GetMyMacros web endpoints**. It relies on `POST` form-encoded calls to `https://getmymacros.com/assets/script/*`:

- Auth: `login2.php` (migrated from `login.php`; re-auth triggered by server `no_session` = code 821).
- Reads: `DM.php` (daily meals), `Searching/FoodSearch.php`, `Searching/GetFoodItem.php`, `FoodCategoryFetch.php`.
- Writes: `Tracking/Food/SaveFood.php` (also fast-track quick-add), `RemoveFromMeal.php`, `UpdateFoodLog.php`, `CopyMeal.php`, `DeleteMeal.php`, `CreateCustomFood.php`, `DeleteFood.php`, `notes.php`, `alternateStarred.php`.

**Session handling:** OS keyring by default (macOS Keychain / Windows Credential Manager / Linux Secret Service) with a `0600` `~/.config/mymacros-cli/session.json` fallback for headless hosts; modeled stale at 50 minutes. Env-var auto-login via `MYMACROS_USER` / `MYMACROS_PASSWORD`.

**Normalization layer:** all API responses are normalized (`src/client.ts`) — macros are **pre-multiplied by serving size** and rounded to 2dp; `uniqueId` is **volatile** (the API does delete+re-insert on write), so agents must re-read `daily` after mutations. `foodId < 0` denotes a custom food.

**Output contract:** JSON when piped (TTY auto-detects), or `--json`/`--plain`/`--table`/`--quiet`/`--debug`. **Command data goes to stdout; status/progress/errors go to stderr** — deliberately machine-safe.

**Commands:** `auth login|status|clear`, `daily`, `search`, `food`, `browse {custom,recent,types,brands}`, `dates`, `add`, `add-quick`, `create-food`, `remove`, `update`, `copy-meal`, `delete-food`, `delete-meal`, `note`, `star`/`unstar`.

**Entitlement constraint:** GetMyMacros web access is limited to Pro/Macro Coach; mobile-only accounts may be rejected on writes (`{ "success": false, "paid": false }`).

### 3.2 Developer/operations workflow

- **New commands** are one file each under `src/commands/`, registered in `src/cli/program.ts`; a shared `cli/client.ts` factory wires debug + spinner into `MyMacrosClient`.
- **Tests:** `vitest`; deterministic **synthetic fixtures** under `captures/` generated by `scripts/generate-fixtures.mjs`; an **opt-in, read-only live suite** (`MYMACROS_LIVE_TESTS=1` against a dedicated test account, serialized with a **500 ms** pacing floor).
- **CI:** a maintainer-gated `Live Tests` workflow (owner comment `/run-live-tests` or manual `RUN`, fork PRs rejected, no write token in the test job, results posted as a check + PR comment).
- **Release:** `release-it` (verify → version/changelog → npm publish → GitHub Release).
- **Governance:** personally maintained; **not accepting external PRs**; security reports handled privately.

### 3.3 Notable repo observations (for scoping)

- **No model/LLM dependency exists today** — the repo is "agent-optimized" but ships *no* AI inference; it is designed to be driven *by* an external agent. Any Jev integration is **greenfield**.
- **Documentation inconsistency:** `create-food` is documented as a supported command *and* listed under "Not Implemented," while `Weight.php`, `Settings.php`, and recipes are genuinely unimplemented. Worth clarifying before it misleads a Jev integration spec.
- **No current data-egress beyond GetMyMacros.** Sessions/credentials are handled carefully and secrets are redacted in debug output — a good privacy posture that a Jev integration should preserve.

---

## 4. Repo-specific opportunities

Framed as **new capabilities enabled by a decision engine**, not "swap a model." Each notes Jev's primitive.

### 4.1 Customer-facing features

1. **Natural-language food resolution** (`Choice`/`Score`): `mymacros log "two scrambled eggs and black coffee"` → code tokenizes and calls the existing food search per item → Jev **reranks/selects** the correct candidate (and granularity, e.g., "2 eggs") → auto-logs above a confidence threshold, otherwise prompts with top candidates. *This is the flagship opportunity.*
2. **Serving-size / unit inference** (`Choice`/`Score`): map "a cup," "half a plate," "one scoop" onto the serving options already returned by `GetFoodItem.php`.
3. **Meal-slot routing** (`Choice`): decide Breakfast/Lunch/Dinner/Snack for free-text or batch imports (the app has user-defined meals, so options come from `active_meals`).
4. **Duplicate / double-log detection** (`Noul`): "Is this new entry the same food already logged today?" — a common tracking failure mode.
5. **Free-text day/meal notes enrichment** (`Choice` over a fixed taxonomy): tag notes (adherence, hunger, mood) for later retrieval — classification, not generation.

### 4.2 Backend / automation

6. **Confidence-gated bulk import & backfill**: batch-import historical logs; Jev gates each row (`Score` against a "plausibility rubric"), auto-commits high-confidence rows and queues the rest — directly leveraging the existing atomic CLI writes.
7. **Pre-write anomaly plausibility checks** (`Noul`/`Score`): semantic guardrail (e.g., "5,000 kcal for a single serving?") *complementing* the existing deterministic input validation, not replacing it.
8. **Catalog data hygiene** (`Choice` over the app's food-type taxonomy): canonicalize/normalize user-created custom foods into the app's `food_type` values.
9. **Map-reduce insight extraction** (`Noul`/`Choice` per entry over `dates` history): detect recurring patterns to feed an **external** generator for the narrative (Jev supplies the labeled signals; it does not write the summary itself).

### 4.3 Developer tooling

10. **Semantic fixture/lint checks**: flag *semantically* odd synthetic fixtures (schema validity is already enforced by TS + `fixtures:check`) — a narrow-value addition.
11. **Agent-integration verification** (`Noul`/`Score`): verify that a downstream agent chose a valid tool call / correct `foodId` before mutation — TypeSafe's documented "tool-call verification" use case.
12. **Live-test triage** (`Score`): classify live-test failure output into "entitlement," "endpoint drift," "rate limit," "flaky" — lowers maintenance toil.

### 4.4 Admin / operations

13. **Issue/bug-report triage** (`Choice`/`Score`): classify inbound bug reports into categories/severity and detect duplicates (valuable given `CONTRIBUTING.md`'s strict report format; low volume for a personal project).
14. **Release/Changelog classification** (`Choice`): suggest a **semver bump** or "Keep a Changelog" section from a diff/changelog entry — a *check*, not an authority (rule 2.5: code owns the decision).

---

## 5. Recommendations by predicted impact

> Impact labels are **researcher judgment** based on the documented Jev fit (§2.5) and the repo's actual workflows (§3). They are not vendor claims.

### 5.1 Huge impact

**H1 — Natural-language food resolution layer (`mymacros log` / `mymacros resolve`).**
- **Expected value:** Converts the CLI from an ID-driven power-user/automation tool into a natural-language logger usable by humans *and* agents; the biggest UX/differentiation change available.
- **Jev fit:** `Choice` (pick the right candidate) + `Score` (confidence for gating). Directly matches the documented best-fit ("ranking/retrieval," "routing").
- **Implementation complexity:** Medium–High. New parser/tokenizer in code; a new `resolve` module; a new `TypeSafeClient`; extend the existing search flow; add tests + fixtures.
- **Architectural disruption:** Medium. Adds the **first external inference dependency** and a second data-egress path; must not break the stdout/stderr contract or the `uniqueId`-volatility handling.
- **Dependencies:** TypeSafe API key (`TYPESAFE_API_KEY`) + access/terms; existing `Searching/FoodSearch.php`; a domain calibration dataset.
- **Risks:** Early-access vendor stability; **option-order sensitivity / listwise interactions** (per independent analysis) → must control candidate ordering; domain calibration is *not* inherited (Hume: calibration shown only on selected samples); latency added per item; egress of food text.
- **Next experiment:** Offline harness — take 50–200 recorded real search scenarios → compare Jev `Choice` top-1 selection vs. naive string-match baseline; measure accuracy and confidence separation before touching production code.

### 5.2 Medium impact

**M1 — Serving-size/unit inference and meal-slot routing.** Same pipeline as H1, narrower scope; **Value:** high for natural-language logging; **Complexity:** Medium; **Disruption:** Low; **Deps:** H1 plumbing; **Risks:** ambiguous units; **Experiment:** evaluate `Choice` accuracy on a labeled set of serving phrasings.

**M2 — Confidence-gated bulk import/backfill + pre-write plausibility checks.** **Value:** unlocks safe mass automation and protects data integrity beyond deterministic validation; **Complexity:** Medium; **Disruption:** Low (wraps existing atomic writes); **Deps:** Jev API; a plausibility rubric; **Risks:** false negatives/positives, thresholds need drift monitoring; **Experiment:** replay a captured write history and compare Jev flags against manually labeled "bad" entries.

**M3 — Catalog data hygiene (custom-food type canonicalization).** **Value:** improves search/browse quality over time; **Complexity:** Medium; **Disruption:** Low; **Deps:** food-type taxonomy from `FoodCategoryFetch.php`; **Risks:** taxonomy drift, write entitlements (`CreateCustomFood.php` requires paid web access); **Experiment:** classify a sample of custom foods with `Choice` and measure agreement with the app's categories.

### 5.3 Low impact

**L1 — Support/issue triage.** Genuinely low volume for a personally maintained, PR-closed project; value limited. **Complexity:** Low; **Disruption:** Low; **Experiment:** classify the existing issue backlog and eyeball accuracy.

**L2 — Developer/CI semantic tooling** (fixture sanity, agent tool-call verification, live-test failure triage). Useful but narrow; deterministic checks already cover most of it. **Complexity:** Low–Medium; **Experiment:** run Jev over recent live-test failure logs.

**L3 — Release/semver & changelog classification.** Mostly deterministic and already human-reviewed; Jev is a *suggestion* only. **Complexity:** Low; **Disruption:** None; **Experiment:** ask Jev to propose a bump on the last 3 releases and compare to what shipped.

*Anti-recommendation:* Do **not** use Jev for narrative meal summaries, explanations, or any generated text — the documentation explicitly says it does not generate. Any "AI summary" feature needs a generator model; Jev should supply the labels/confidence only.

---

## 6. Prioritized roadmap

1. **Phase 0 — Validate before building (1–2 weeks, no production change).** Build the offline harness (H1 experiment) on recorded search scenarios; confirm Jev accuracy/confidence separation and CANDIDATE-ORDER robustness. Establish whether TypeSafe access/terms and data handling are acceptable for health-adjacent text.
2. **Phase 1 — Ship `mymacros resolve` (read-only, H1 core).** Non-mutating command that resolves free text → ranked candidate `foodId`s with probabilities. No writes, so the privacy/safety blast radius is minimal; uses the safe integration pattern (deterministic first, atomic questions, thresholds logged).
3. **Phase 2 — Confidence-gated `mymacros log` (H1 + M1).** Add auto-log above a threshold with an interactive/review fallback below it; reuse the existing add + `daily` re-read flow and uniqueId handling.
4. **Phase 3 — Backfill/quality (M2 + M3).** Apply the same gating to bulk import and custom-food classification.
5. **Phase 4 (optional) — Admin/dev tooling (L1–L3)** only if toil justifies it.

Cross-cutting from day one: a `TypeSafeClient` that mirrors `MyMacrosClient` conventions (redaction, backoff on 429/529, debug hooks), a **calibration/threshold config** surface, and **probability + outcome logging** so drift is observable.

---

## 7. Open questions

- What is the real **access/pricing/rate-limit regime** beyond early access (the "free output tokens" and speedup figures are vendor claims)? Is there an SLA and a durable "stable alias" guarantee for `jev-latest`?
- **Data handling:** retention, residency, and contractual terms for sending food/health-adjacent text to a hosted API. Is a DPA available? Can input state avoid PII/health specifics?
- **Domain calibration:** what accuracy/confidence calibration can be achieved for nutrition food-matching, and how fast does it drift? (Independent evidence covers only selected sample sets.)
- **Robustness:** how severe is option-order/listwise sensitivity, and can deterministic candidate ordering neutralize it?
- **Product scope:** does the project even want a natural-language UI, given it is a personal, PR-closed tool — or is the target strictly external agents?
- **Repo ambiguity:** resolve the `create-food` "supported vs. Not Implemented" doc contradiction before spec'ing around it.

---

## 8. Limitations

- The subagent environment had **no web tooling**; all web-derived facts come from the parent-fetched dossier and are **second-hand**. I could not independently re-verify vendor pages, the eval methodology, or the Archer Hume evidence bundle.
- **Vendor-heavy evidence base.** Performance/cost/speedup numbers and "type-safe" guarantees are vendor-reported and workload-specific; independent confirmation is limited to one black-box analysis on a single early-access version/region whose architecture claims are explicitly speculative.
- **No nutrition-domain benchmark exists** for Jev. All repo-fit and calibration judgments about food-matching are **researcher inference**, to be validated by the Phase 0 harness.
- Impact ratings are judgment, not measurement; implementation estimates are engineering intuition, not committed scoping.
- Repo observations reflect state at the inspected commit (v0.4.1); undocumented endpoints may change and the CLI already carries an explicit "may break" disclaimer.

---

## 9. Sources

**Jev / TypeSafe (via parent dossier; vendor unless noted):**
- TypeSafe — https://typesafe.ai — company/model homepage; defines "System One Models."
- Introducing System One Models and Jev — https://typesafe.ai/blog/introducing-system-one-models-and-jev — launch post: API concept, early access, performance/cost/speedup claims (vendor), eval-bias disclosure.
- System One concepts — https://docs.typesafe.ai/concepts/system-one — question primitives (Noul/Choice/Score), text-only input, no-generation boundary.
- API docs — https://docs.typesafe.ai/api — `POST /v1/systemone`, `jev-latest`, bearer key, error codes 401/422/429/529.
- How to build with System One — https://docs.typesafe.ai/concepts/how-to-build-with-system-one — "code owns control flow," atomic questions.
- Confidence — https://docs.typesafe.ai/confidence — derived confidence, not a per-prediction guarantee.
- Machine-learning primer — https://docs.typesafe.ai/introduction/machine-learning-primer — RLCD/calibration background.
- Evals — https://evals.typesafe.ai — code-defined workflows (expense-claim example); vendor-controlled evaluation.
- **Independent:** Jev's architecture unmasked — https://archerhume.com/posts/jevs-architecture-unmasked — black-box observations; architecture claims labeled speculative.
- **Independent:** Evidence bundle — https://archerhume.com/research/jev/evidence.json — cited black-box/calibration data.

**Repository (direct inspection of `/tmp/jev-research.1FrXpC/mymacros-cli`):**
- `README.md` — features, auth/session model, entitlement constraints, agent workflow, output modes.
- `package.json` — v0.4.1, deps (commander, keytar, kleur, ora), Node engines.
- `src/client.ts` — endpoint map, session re-auth (821), normalization, `uniqueId` volatility.
- `src/credentials.ts` — keyring default + `0600` config fallback, 50-min freshness.
- `src/types.ts` — raw API + normalized output types.
- `src/cli/program.ts`, `src/cli/context.ts`, `src/cli/output.ts`, `src/cli/client.ts`, `src/commands/add.ts` — command registration, DI client, stdout/stderr contract.
- `tests/date.test.ts`, `.github/workflows/live-tests.yml`, `CHANGELOG.md`, `RELEASING.md`, `CONTRIBUTING.md` — testing/CI/release/governance practices.

**Rejected/deprioritized:** none — no additional web sources were fetchable in this environment; the four assigned seed URLs are fully represented above.

---

## 10. Next steps

1. Run the **Phase 0 offline harness** (H1) — the single decision that gates the whole roadmap.
2. Resolve **TypeSafe access/terms + data-handling** questions before any code touches production data.
3. Clarify the repo's **product intent** (natural-language UX vs. external-agent tooling) and the `create-food` doc contradiction.
4. If Phase 0 is positive, prototype **`mymacros resolve`** (read-only) as the minimal risk-bearing proof.
