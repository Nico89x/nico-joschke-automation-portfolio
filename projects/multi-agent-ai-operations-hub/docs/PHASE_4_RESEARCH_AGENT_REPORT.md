# Phase 4 report: bounded Research Agent

Date: 2026-09-22

## Created

- A separate Research Brief schema and deterministic Research Agent implementation.
- A bounded local tool catalog for common automation tools, clearly labelled as synthetic reference data.
- Source-labelled findings, explicit unknowns, and structured refusal of invalid intake envelopes.
- Data-minimization handling: contact name and email are never copied into the research result.

## Safety boundary

This initial agent does not call the web, contact companies, change records, or use paid AI services. It only prepares a source-grounded brief for the subsequent RAG and Solution Architect stages.

## Actually tested

Command: `node --test`

- Total tests: 50
- Passed: 50
- Failed: 0
- A complete synthetic intake produces a completed, source-labelled brief with no external actions.
- Unknown tooling and unknown data sensitivity produce `needs-human-input` instead of invented facts.
- Invalid or unaccepted input is rejected.
- Synthetic contact data does not appear in the output data object.

## Verified locally in the running stack

- The `05 - Bounded Research Brief API` workflow was imported and published only in the local n8n instance.
- A complete synthetic request returned HTTP 200 and `completed`, with four source-labelled facts and zero external calls.
- A synthetic request with an unknown CRM and unknown data sensitivity returned HTTP 200 and `needs-human-input`, with both uncertainties explicitly named.
- The synthetic contact email was not present in the live response.
- A rejected input envelope was stopped with HTTP 422 before a research brief was created.

## Next concrete step

Implement the Solution Architect Agent. It will combine the accepted intake, bounded research brief, and RAG sources into a schema-validated automation blueprint, but will not execute any external action.
