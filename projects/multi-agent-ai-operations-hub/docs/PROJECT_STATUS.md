# Projektstatus und Release-Readiness

Stand: 28.09.2026

## Kurzurteil

Der Multi-Agent AI Operations Hub ist ein **öffentlich dokumentierter, lokal ausführbarer Portfolio-Prototyp**, kein produktionsreifes Produkt. Seine stärksten belegten Aspekte sind deterministische Workflow-Steuerung, n8n, PostgreSQL/pgvector, strikte Validierung, Idempotenz, Auditierung, Human-in-the-Loop und reproduzierbare Tests. Ein optionaler lokaler Qwen-Interpretationsschritt ist hostseitig an einen separaten n8n-Empfangsworkflow angebunden.

## Was das System aktuell macht

- Nimmt synthetische Prozessanfragen über einen lokalen Webhook an, validiert sie und schützt den Intake mit Idempotency-Keys vor Doppelverarbeitung.
- Ruft passende Inhalte aus der lokalen PostgreSQL/pgvector-Wissensbasis ab und erstellt einen nachvollziehbaren Lösungsvorschlag mit Risiko- und Aufwandshinweisen.
- Protokolliert Verarbeitungsschritte in PostgreSQL und wartet vor folgenreichen Aktionen auf eine benannte menschliche Entscheidung.
- Bereitet nach Freigabe ausschließlich einen reversiblen, synthetischen lokalen Entwurf vor. Es erfolgen keine echten CRM-Schreibvorgänge, Aufgaben, E-Mails oder Nachrichten.
- Kann optional einen datensparsamen, lokalen Qwen-Interpretationsschritt ausführen. Eindeutig genannte Start-Ereignisse werden zusätzlich durch eine konservative Regel geprüft; die lokale Auswertung zeigt rohe Modellantwort und gewählten Trigger getrennt. Bei fehlender Quellenangabe erfolgt höchstens ein lokaler Nachprüfungsversuch, danach ein kontrollierter Stopp. Der Hostadapter zeigt die zu den IDs gehörenden Wissensauszüge für die menschliche Prüfung; auch Workflow `09` weist leere Quellenlisten zurück.

Die n8n-Agentenschritte und Embeddings im zentralen Workflow `07` bleiben deterministische Baselines; der Workflow selbst ist nicht LLM-gesteuert. Workflow `09` ist kein eigenständiger Agent und führt keine externen Aktionen aus. Lokale Endpunkte haben keine Authentifizierung und dürfen nicht öffentlich exponiert werden.

## Tatsächlich geprüfte Nachweise

| Prüfung | Beobachtetes Ergebnis | Aussagegrenze |
|---|---|---|
| Automatisierte Node.js-Tests | 178 bestanden, 0 fehlgeschlagen (lokaler Lauf am 28.09.2026) | Umfasst auch Typfehler, Deadline, Freigabe-Binding, offene Fragen, RAG-Quelle und Workflow-State |
| Live-Smoke der Hauptstrecke | Sechs synthetische Pfade bestanden: Planung, Dublette, Freigabe, Replay, ungültige Anfrage, Ablehnung | Schreibt weitere synthetische Testdaten/Audit-Zeilen; löscht sie nicht |
| Isolierter Clean-start und Import | Nutzerlauf: neue Docker-Volumes, n8n und PostgreSQL `healthy`, `/healthz` HTTP 200, Workflow `09` mit erwarteter ID importiert und inaktiv verifiziert | Keine Credentials importiert, kein Webhook aktiviert, keine Smoke-Pfade auf dem Prüfstack |
| Lokaler Ollama-/n8n-Lauf | Drei synthetische Live-Läufe mit `qwen3.5:4b`; der neueste mit `interpretation-v4-trigger-v1-citation-v3` speicherte einen Agent-Run und ein Audit-Event, `executionGate: false`, externe Aktionen 0 | Hostinitiierter Modellaufruf; zentraler Workflow `07` ruft Ollama nicht selbst auf |
| Quellenpflicht im veröffentlichten Receipt | Synthetischer Beleg ohne Quellenliste wurde direkt mit HTTP 422 abgewiesen | Belegt die technische Sperre, nicht die inhaltliche Korrektheit eines Zitats |
| Neuer unabhängiger Satz | `validation-v4`: 14/15 Entwürfe mit Quelle akzeptiert, ein Fall kontrolliert gestoppt; Erstlauf 14/14 und Wiederholung 13/14 passende Trigger unter akzeptierten Fällen; Quellenpräzision in beiden Läufen 85,7 % | Der Wiederholungslauf zeigt Modellvarianz. Der gestoppte Fall hatte eine passende Quelle (False Negative); Kennzahlen der akzeptierten Fälle sind selektiv. Details: [LLM-Bericht](LOCAL_LLM_EVALUATION_REPORT.md) |
| Ältere Modell- und Regressionsevals | `validation-v3` ergab vor der Quellenpflicht fünf Antworten ohne Quelle; spätere Wiederholung nach Anpassung als Entwicklungstest | Bereits offengelegte Sätze sind keine unabhängigen Zukunftstests |
| Planungsrouten-Benchmark | 5/5 HTTP 202; Median 89,2 ms | Kleine lokale Stichprobe, kein Lasttest oder SLA |
| Screenshots | Zwei echte Screenshots belegen n8n-Ansichten der Workflows `07`/`08`; eine Architekturillustration zeigt die Strecke Ollama → Workflow `09` | Keine Screenshots eines frischen Live-Laufs; `09`-Grafik ist ausdrücklich eine Illustration |

Der neue 15-Fall-Satz `validation-v4` wurde nach Festlegung des aktuellen Adapters erstellt, vorab gelabelt und einmal gemessen. Er ist jetzt offengelegt; bei weiteren Modell- oder Promptänderungen ist ein neuer unabhängiger Satz nötig. Die älteren Sätze sind Entwicklungsnachweise. Keine der synthetischen Messungen ersetzt eine fachliche Prüfung der freien Empfehlungen.

## Für die Nutzung im Bewerbungsgespräch noch sinnvoll

1. **Demo einmal selbst durchgehen:** [Demo-Runbook](DEMO_RUNBOOK.md) verwenden und die gezeigten Schritte im Gespräch in eigenen Worten erklären. Ein Video ist optional.
2. **CI-Lauf beobachten:** Nach Veröffentlichung prüfen, dass der GitHub-Actions-Lauf grün ist.
3. **Optional: echten Screenshot von Workflow `09` ergänzen:** Er wäre ein zusätzlicher visueller Nachweis, aber nicht erforderlich, weil der synthetische Lauf separat dokumentiert ist.
4. **Quelleninhalt und Verfügbarkeit weiter verbessern:** Die technische Quellenpflicht ist umgesetzt, aber ein klar belegbarer Fall wurde fälschlich gestoppt. Auch bei akzeptierten Antworten ist die inhaltliche Unterstützung durch die Quelle nicht maschinell bewiesen; eine menschliche Prüfung bleibt nötig.

## Sichere lokale Prüfung

Aus dem Projektordner:

```powershell
node --test
node scripts/evaluate-local-ai-interpretation.mjs --suite=validation-v4
```

Der Modelltest benötigt lokal laufendes Ollama mit `qwen3.5:4b`; er kostet keine Modell-API-Gebühr, beansprucht aber lokal Rechenleistung und Zeit. Für den optionalen n8n-Smoke-Test folge den konkreten Hinweisen in [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md). Wiederholte Tests hinterlassen synthetische Datensätze in der lokalen Datenbank.

## Gesamtbewertung

**Gut vorzeigbar für Junior-/Quereinstiegsrollen in n8n, Workflow Automation und Integration**, weil mehrere technische Nachweise statt bloßer Konzeptfolien vorliegen. Für eine AI-Agent- oder produktionsnahe Senior-Rolle ist es noch kein Nachweis echter Produktionsskalierung: Der zentrale Ablauf bleibt deterministisch, externe Integrationen sind Demos, und die lokale Modellauswertung zeigt offene Qualitätsgrenzen.
