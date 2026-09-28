# Local LLM pilot: Qwen 3.5 4B via Ollama

Date: 23 September 2026. This is an **optional standalone interpretation step**, not a node in the published n8n workflows. All six inputs are synthetic. The local endpoint is fixed to `http://127.0.0.1:11434/api/chat`; the adapter rejects `:cloud` model tags. There are no CRM writes, tasks, messages, or approvals in this pilot.

## Reproduce

Install Ollama and download `qwen3.5:4b` separately. From the project folder, while Ollama is running:

```powershell
node scripts/evaluate-local-ai-interpretation.mjs --cases=6
```

The adapter sends a bounded, data-minimised request, asks Ollama for JSON-Schema output, and validates the returned fields and source IDs locally. Its result is advisory and has no execution authority. The test runner prints case-level scores and a summary; it does not write prompts, responses, or model credentials to a file.

## Observed results

| Check | Initial prompt v1 | Revised prompt v2 |
|---|---:|---:|
| Six model calls returned schema-valid JSON | 6/6 | 6/6 |
| Trigger matched existing fixture label | 2/6 | 5/6 |
| At least one supplied source ID cited | 6/6 | 6/6 |
| At least one missing-information item identified | 6/6 | 6/6 |
| Median request latency | 4,659 ms | 3,620 ms |
| Total input / output tokens | 866 / 954 | 1,334 / 896 |
| Ollama API fee | 0 EUR | 0 EUR |

These are six local observations, not a statistical reliability claim or a claim that the proposed solution is correct. Citation scoring only checks that IDs came from supplied sources; it does not establish that the text truly supports the recommendation. Electricity and hardware usage were not costed. The two runs used a warmed local model and are not a cold-start benchmark.

The remaining v2 mismatch is `unconfirmed-crm-api`: the fixture labels the trigger `webhook`, while the model returned `unknown` and requested confirmation of CRM API and webhook support. Given the scenario explicitly says those capabilities are unconfirmed, `unknown` is a defensible safer answer. The fixture label has deliberately **not** been changed after seeing the model result; report the strict fixture score as 5/6 and disclose the ambiguity. A larger, independently labelled holdout set would be needed before claiming robust classification quality.

The local adapter has additional mocked unit tests for endpoint isolation, data minimisation, schema validation, citation validation and failure handling. The historical Node suite passed **145/145** tests on 23 September 2026. The existing n8n routes were not altered by this model-evaluation run; no claim is made that the central n8n workflow now uses an LLM.

## Expanded local regression run — 25 September 2026

An additional 20-case synthetic suite was authored with four cases each for webhook, email, schedule, manual, and unknown triggers. Each case includes a relevant source and a distractor source; the evaluator now reports exact citation matches, precision, and recall instead of treating any allowed citation as sufficient. Run it with:

```powershell
node scripts/evaluate-local-ai-interpretation.mjs --suite=regression-v1
```

The suite was first run with prompt v2, then the prompt was revised after inspecting its errors. Therefore these results are **development/regression measurements, not an independent holdout result**. The fixture labels were not adjusted to make the later result look better. The initial form case was explicitly labelled webhook because its test description states that a signed HTTP POST event and endpoint are confirmed; v2 returned `unknown`.

| Metric | Prompt v2, initial run | Prompt v3, regression run |
|---|---:|---:|
| Cases with a valid structured response | 20/20 | 20/20 |
| Expected trigger classifications | 19/20 | 20/20 |
| Cases with at least one expected clarification | 8/20 | 20/20 |
| Exact relevant-source set | 13/20 | 11/20 |
| Mean citation precision / recall | 82.5% / 100% | 77.5% / 100% |
| Median latency | 3,458 ms | 4,476 ms |
| Input / output tokens | 5,045 / 2,828 | 7,485 / 3,930 |
| Local model API cost | 0 EUR | 0 EUR |

Prompt v3 improved trigger classification and surfaced more missing information, but it produced more verbose clarification lists (3.95 items per case on average) and lower citation precision, with higher latency and token use. That is a real tradeoff, not a clean win. The 20-case dataset is now a regression suite because it informed prompt development. A separate 15-case synthetic set was authored without using it to tune v3 and then evaluated once; this is a useful independent snapshot, not a large statistical benchmark. Neither evaluation proves that recommendations are correct or suitable for production use.

## Independent evaluation snapshot — blind-v1, 25 September 2026

The 15 synthetic cases cover five trigger classes (three each: webhook, email, schedule, manual, unknown) and use new business scenarios and source IDs. They were added as a separate evaluation set after prompt v3 had been finalized against `regression-v1`. The model was run once locally using `qwen3.5:4b`; no paid API was used.

| Metric | Observed |
|---|---:|
| Model calls with schema-valid structured output | 15/15 |
| Trigger classifications matching the predefined labels | 13/15 |
| Cases with expected missing-information questions detected | 15/15 |
| Exact relevant-source sets | 8/15 |
| Mean citation precision / recall | 76.7% / 100% |
| Mean missing-information items per case | 4.47 |
| Median latency | 4,824 ms |
| Input / output tokens | 5,682 / 3,117 |
| Model API cost | 0 EUR |

Two trigger errors were observed: one confirmed mailbox-intake case was returned as `unknown`; one mailbox attachment case was classified as `webhook`. In seven cases the model cited one or more allowed but non-required sources, which reduced exact-set agreement. It also asked 4.47 questions on average despite the scorer requiring only whether at least one clarification was present; this points to over-asking and is not evidence that every question was necessary. All citations were drawn from the supplied source IDs, but citation recall/precision are based on predefined labels and do not prove semantic support. The evaluation runner does not grade the factual correctness or usefulness of free-text recommendations.

This suite is now disclosed in the repository, so it must be treated as a locked validation snapshot rather than a future secret holdout. If prompt v4 is tuned against these errors, create and label a new independent suite before reporting a fresh generalization result. The score is one run on a small curated synthetic dataset, not a reliability estimate.

## Explicit-trigger rule and subsequent validation — 25 September 2026

The two mailbox errors motivated a shorter v4 instruction that asks the model for no more than three material clarifications and fewer citations. Prompt-only tuning was not sufficient: on the 20-case development suite, v4 classified 18/20 triggers correctly; a further v5 wording classified only 8/20 and was discarded. The final local adapter uses v4 plus a narrow deterministic rule for an explicitly stated start event. Ambiguous, contradictory, or unconfirmed start events remain with the model. Evaluation output records both the raw model trigger and the final selected trigger. This rule is part of the actual local adapter, not merely the score calculation.

On the already used 20-case development suite, the final adapter returned 20/20 valid JSON outputs and 20/20 selected triggers matching labels. The raw model matched 18/20; the rule corrected two. Exact source sets matched 14/20, mean citation precision was 80%, recall 90%, and mean clarification count was 2.95. This is a **development result**, because this suite informed the changes.

An independent 15-case `validation-v2` set was then authored, including German requests and deliberately unconfirmed event capabilities. It found 11/15 matching selected triggers and exposed two rule gaps: three recurring schedules were missed, and a hoped-for but unconfirmed webhook was incorrectly treated as confirmed. The rule was updated, and those cases became development evidence. Their labels were not changed after the run.

A further 15-case `validation-v3` set was created after the rule update and run once with the final `interpretation-v4-trigger-v1` adapter:

| Metric | Validation-v3 observation |
|---|---:|
| Schema-valid local model outputs | 15/15 |
| Final trigger labels matched | 13/15 |
| Raw model trigger labels matched | 9/15 |
| Explicit-event rules applied / changed a model trigger | 7/15 / 4/15 |
| Cases with at least one expected clarification | 15/15 |
| Mean number of clarification items | 2.93 |
| Exact relevant-source sets | 9/15 |
| Mean citation precision / recall | 63.3% / 66.7% |
| Cases with no cited source | 5/15 |
| Median latency | 4,678 ms |
| Input / output tokens | 6,823 / 3,061 |
| Ollama API fee | 0 EUR |

The two final trigger mismatches were a second-business-day calendar job and an on-demand report without the rule's explicit manual wording. The citation gaps are more serious than trigger classification: five otherwise valid outputs supplied no source ID, and one output included an extra source outside the predefined relevant set. The local receipt keeps all output advisory and pending human review; this run does **not** establish source-grounded recommendation quality. Citation labels are human-authored synthetic expectations, not independent semantic proof. Clarification scoring checks only whether at least one question appeared; it does not assess whether each question was needed. The two 15-case sets differ, so their scores are not a paired before/after measurement. Both are now disclosed and must not be reused as untouched future holdouts.

## Citation gate, bounded retry, and new independent snapshot — 25 September 2026

The host-side local adapter now makes at most one additional **local** citation check when the first answer has no source IDs. If the second answer still has none, it stops before sending a receipt. It checks each cited ID against the supplied approved excerpts and returns those excerpts in `citationReview` for a human to inspect; `semanticSupportVerified` is explicitly `false`. The published local n8n receipt workflow independently rejects empty citation lists. This is a safety boundary, not proof that the recommendation is supported by the cited text.

Development reruns informed the citation-retry wording: the 20-case regression set produced 17 accepted advisories and three controlled missing-citation stops before the revised retry wording. A targeted rerun of those three cases recovered one and still stopped two. A subsequent rerun of the already disclosed `validation-v3` set with the frozen `interpretation-v4-trigger-v1-citation-v3` adapter produced 15 accepted advisories, three retries, 14/15 matching selected triggers, 9/15 exact prelabelled source sets, 80% mean source precision, and 100% source recall. Because this set had already been seen, these are **development observations**, not independent proof of improvement. Repeated local model calls also vary, so the before/after figures are not a controlled paired experiment.

After freezing that adapter, a new balanced 15-case `validation-v4` dataset was written with three cases for each trigger class and source labels fixed before the first run. It was evaluated once, without tuning the model or labels afterward:

| Metric | Independent validation-v4 observation |
|---|---:|
| Cases attempted / accepted | 15 / 14 |
| Missing-citation controlled stops | 1/15 |
| Correct selected/raw triggers among accepted cases | 14/14 / 14/14 |
| Citation retries among accepted cases | 2/14 |
| Exact prelabelled source sets among accepted cases | 10/14 |
| Mean citation precision / recall among accepted cases | 85.7% / 100% |
| Cases with at least one expected clarification among accepted cases | 12/14 |
| Median latency among accepted cases | 5,028 ms |
| Input / output tokens among accepted cases | 7,609 / 3,717 |
| Ollama API fee | 0 EUR |

The blocked case was an hourly stock comparison for which a relevant approved source was present. That is a **false-negative availability cost** of the gate, not a successful recommendation. The citation and trigger percentages above are conditional on the 14 accepted cases; they must not be described as 15/15 overall quality. Source labels are synthetic human-authored expectations, and even an exact ID match does not verify semantic support sentence by sentence. The failed case's retry token usage is not included in the accepted-case totals. This snapshot is now disclosed; future prompt changes require a fresh independent set for a new quality claim.

The complete local Node suite passed **178/178** tests after later fail-closed handoff and workflow-state hardening. A direct synthetic receipt with an empty citation list returned HTTP 422 from the published local n8n workflow. A further host-initiated synthetic Ollama-to-n8n run using `interpretation-v4-trigger-v1-citation-v3` reported `local-advisory-persisted`, one audit event, `executionGate: false`, and zero CRM writes, tasks, or messages. The run lasted 7,256 ms and cited two approved source IDs; its CLI review output included the corresponding excerpts. These observations do not establish production safety or general-purpose agent quality.

### Repeatability check — 26 September 2026

The unchanged `validation-v4` suite and frozen adapter were run again to check local-model variability. The repeat again accepted 14/15 cases and controlled-stopped one missing-citation case. Among the 14 accepted cases, 13/14 selected triggers matched the predefined label, 10/14 exact source sets matched, mean citation precision/recall was 85.7%/100%, and 12/14 cases surfaced an expected clarification. Median latency was 5,052 ms with 7,044 input and 3,374 output tokens. The difference from the first run (14/14 selected triggers) is disclosed model variance, not a regression-tested improvement claim.
