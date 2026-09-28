# Automation discovery and solution design

Before selecting tools, clarify the business process. A useful discovery request names the trigger, the people or systems involved, the desired result, the current tools, volume, data sensitivity, error tolerance, and a definition of success. Missing or contradictory information becomes an explicit question, not an invented technical assumption.

An implementation blueprint describes the trigger, validated input, transformation steps, API boundaries, storage, output, error paths, retry behavior, monitoring, and the human approval gate. The blueprint should distinguish deterministic rules from AI interpretation. Deterministic validation, permission checks, calculations, routing, and cost limits stay outside the model.

For example, a lead-intake workflow may receive a website form, normalize it, check duplicates, prepare a CRM record, request approval, and only then write to a demo CRM. The design must make clear which data is stored and how an operator can recover from an interrupted run.
