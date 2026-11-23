# Nico Joschke – Automatisierung, Schnittstellen & Softwaretests

[![Operations Hub CI](https://github.com/Nico89x/nico-joschke-automation-portfolio/actions/workflows/operations-hub-ci.yml/badge.svg)](https://github.com/Nico89x/nico-joschke-automation-portfolio/actions/workflows/operations-hub-ci.yml)

**Junior / Associate · Workflow-Automatisierung · Softwaretesting / QA · Technische Implementierung & Anwendungssupport**

Nach meiner Arbeit im Malerhandwerk steige ich in die IT ein. In eigenen Projekten setze ich Geschäftsabläufe in n8n um, binde APIs an und prüfe, wie Software bei ungültigen Eingaben, externen Fehlern und Wiederholungen reagiert.

[Portfolio mit Demos](https://nico89x.github.io/nico-joschke-automation-portfolio/) · [Druckbares Kurzprofil](kurzprofil.html) · [GitHub-Profil](https://github.com/Nico89x)

**Vollständig remote in Deutschland oder hybrid in Karlsruhe · Vollzeit, Teilzeit oder freiberuflich.**

## Ausgewählte Arbeitsproben

| Schwerpunkt | Einstieg | Prüfnachweis |
| --- | --- | --- |
| Workflow-Automatisierung | [Operations Hub](projects/multi-agent-ai-operations-hub/) · n8n, PostgreSQL und menschliche Freigabe | [CI-Lauf mit Webhook- und Datenbankprüfungen](https://github.com/Nico89x/nico-joschke-automation-portfolio/actions/runs/36835141067) |
| Softwaretesting / QA | [Grocery Store](https://nico89x.github.io/ai-grocery-store-automation/#/simulation) · Browser- und API-Tests, Fehler und Wiederholung | [Prüfprotokoll](https://github.com/Nico89x/ai-grocery-store-automation/blob/main/VERIFICATION.md) |
| Technische Implementierung & Anwendungssupport | [ReleaseWatch](projects/release-support-triage/) · GitHub-API und strukturierte Support-Triage | [QA- und Support-Arbeitsprobe](projects/release-support-triage/QA-ARBEITSPROBE.md) |

**Weiterbildung:** n8n Academy, „In der Praxis: KI, Tests und Best Practices“, bestanden am **16. November 2026**. Der Kurs umfasst KI, Tests und Best Practices. Die praktische Anwendung ist in den verlinkten Projekten dokumentiert.

## Portfolio in 90 Sekunden prüfen

- **Überblick:** [Portfolio-Webseite](https://nico89x.github.io/nico-joschke-automation-portfolio/) und [Fallstudie des Hauptprojekts](https://nico89x.github.io/nico-joschke-automation-portfolio/multi-agent-ai-operations-hub.html)
- **Ablauf sehen:** [echte n8n-Workflow-Screenshots mit Einordnung](projects/multi-agent-ai-operations-hub/docs/screenshots/README.md)
- **Demo nachvollziehen:** [90-Sekunden-Demo und lokale Prüfschritte](projects/multi-agent-ai-operations-hub/docs/DEMO_RUNBOOK.md)
- **Code und Qualität prüfen:** [Architektur und lokaler Start](projects/multi-agent-ai-operations-hub/README.md), [Tests](projects/multi-agent-ai-operations-hub/test/) und [GitHub-CI](https://github.com/Nico89x/nico-joschke-automation-portfolio/actions/workflows/operations-hub-ci.yml)

Die Demo läuft lokal mit synthetischen Daten. Es gibt keinen öffentlich zugänglichen Live-Service; die Screenshots zeigen die Workflow-Struktur, nicht allein den Nachweis eines erfolgreichen Durchlaufs.

## Weitere Projekte auf einen Blick

| Projekt                  | Was sich prüfen lässt                                                                                      | Einstieg                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CyberGuard AI | Python-/FastAPI-Prototyp: Session/CSRF, validierte Sicherheitsereignisse und Belegreferenzen; synthetische Demo, keine validierte Schutzwirkung | [Code, Demo und Tests](https://github.com/Nico89x/CyberGuard-AI) |
| Grocery Store Automation | Interaktive TypeScript-/React-Demo mit Bestellqueue, Lagerbuchung, Fehler/Retry und optionalem n8n-Empfang | [Demo](https://nico89x.github.io/ai-grocery-store-automation/#/simulation) · [Code und Startanleitung](https://github.com/Nico89x/ai-grocery-store-automation) |
| Lead-to-Offer            | Drei bereinigte n8n-Exporte mit 15 Regressionstests für Lead-Validierung und Angebotsdaten                 | [Aufbau, Tests und lokale Einrichtung](projects/lead-to-offer/) · [Fallstudie](https://nico89x.github.io/nico-joschke-automation-portfolio/#lead-to-offer)     |
| ReleaseWatch             | API-Adapter, automatisierte Tests und Video einer synthetischen Support-Triage                             | [Code und Demo](projects/release-support-triage/)                                                                                                              |

## Hauptprojekt

### Multi-Agent AI Operations Hub

**Problem:** Unstrukturierte Automatisierungsanfragen müssen geprüft, nachvollziehbar geplant und vor einer Ausführung menschlich freigegeben werden.

**Lösung:** Ein lokal ausführbarer n8n-Prototyp validiert Anfragen, verhindert Dubletten, verbindet sie mit einer PostgreSQL/pgvector-Wissensbasis und erstellt einen prüfbaren technischen Entwurf mit Audit-Log.

**Demo-Ergebnis:** Eine gültige synthetische Anfrage endet bei `awaiting-human-review` (HTTP 202). Ungültige Eingaben werden mit HTTP 422 abgewiesen; wiederholte Entscheidungen mit HTTP 409. Auch eine Freigabe erzeugt nur einen lokalen synthetischen Entwurf, keine externen Aktionen. Die Prüfschritte stehen im [Demo-Runbook](projects/multi-agent-ai-operations-hub/docs/DEMO_RUNBOOK.md).

- **Stack:** n8n Community Edition, Docker Compose, PostgreSQL, pgvector, JavaScript, SQL und optional Ollama/Qwen
- **Kontrollen:** strikte Datentypen, Idempotenz, Audit-Log, RAG-Quellenpflicht, Request- und Versionsbindung bei Freigaben, Human-in-the-loop
- **Sicherheitsgrenze:** keine realen CRM-Schreibvorgänge, Aufgaben, E-Mails oder Nachrichten
- **Nachweis:** 178 lokale automatisierte Tests bestanden; synthetische AI-Evaluation mit offengelegter Modellvarianz
- **Reproduzierbarkeit:** vollständige lokale Umgebung, zehn deaktivierte n8n-Exporte, Datenbankschema, Testfälle und technische Dokumentation

[Fallstudie auf der Webseite](https://nico89x.github.io/nico-joschke-automation-portfolio/multi-agent-ai-operations-hub.html) · [Vollständiger Quellcode](projects/multi-agent-ai-operations-hub/) · [Zentraler Workflow](operations-hub-central-workflow.json) · [Lokaler AI-Prüfworkflow](operations-hub-local-ai-receipt.json)

## ReleaseWatch: echte API-Integration

[Fallstudie, Code und Demo-Video](projects/release-support-triage/) · [31 automatisierte API-/Workflow-Tests](projects/release-support-triage/test/)

Ein synthetisches Support-Ticket wird mit öffentlichen GitHub-Release-Metadaten angereichert und als gesperrter Entwurf zur menschlichen Prüfung vorbereitet. Der echte API-Aufruf wurde am 01.10.2026 geprüft. Das Demo-Video zeigt echte Browser-Aufnahmen des Node.js-Adapters; der 429-Fehler ist ausdrücklich simuliert. Keine externen Schreibaktionen und kein behaupteter Live-n8n-Nachweis für diese zusätzliche Fallstudie.

Für das Hauptprojekt wurde ein [frischer, isolierter E2E-Test-Stack](projects/multi-agent-ai-operations-hub/CLEAN_E2E.md) am 01.10.2026 in [GitHub Actions erfolgreich geprüft](https://github.com/Nico89x/nico-joschke-automation-portfolio/actions/runs/36835141067): zehn Workflow-Importe, vier veröffentlichte lokale Routen, Planung, Freigabe, Ablehnung, Idempotenz und Datenbank-Persistenz. Keine LLM- oder externen Schreibaktionen. Zusätzlich wurden 209 automatisierte Tests lokal bestanden (178 Hauptprojekt + 31 ReleaseWatch).

## Weitere Fallstudien

| Fallstudie                           | Schwerpunkt                                                            | Technischer Nachweis                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead-to-Offer Automation Suite       | Validierung, Routing, Deduplizierung, CRM und interne Angebotsentwürfe | [Lead Intake](lead-intake-system.sanitized.json), [CRM Router](crm-system.sanitized.json), [Offer Generator](offer-generator.sanitized.json) |
| Evidence-based Outreach Intelligence | Website-Evidenz, strukturierte AI-Ausgaben und Human-in-the-loop       | [Workflow](outreach-intelligence.sanitized.json)                                                                                             |
| Market Opportunity Research          | API-Recherche, Normalisierung, Deduplizierung und Scoring              | [Workflow](handwerk-opportunity.sanitized.json)                                                                                              |

Die fünf älteren bereinigten Exporte enthalten zusammen 94 n8n-Knoten, 31 Code-Knoten und 14 HTTP-Schnittstellen. Zusammen mit den zwei separat angebotenen Operations-Hub-Exporten liegen sieben direkt prüfbare JSON-Dateien im Repository; das vollständige Hauptprojekt enthält zehn versionierte Workflow-Exporte.

## Prüfstand und Projektgrenzen

- Alle veröffentlichten Workflow-Exporte sind parsebar, standardmäßig deaktiviert und enthalten keine Credential-Objekte.
- Im Hauptprojekt verweisen Verbindungen ausschließlich auf vorhandene Knoten; JavaScript-Code-Knoten werden automatisiert kompiliert und geprüft.
- Nur synthetische Daten sind eingecheckt. `.env`, Zugangsdaten und lokale Ausführungsdaten bleiben ausgeschlossen.
- Der zentrale Operations-Hub-Ablauf nutzt deterministische Agenten-Baselines. Das lokale Sprachmodell liefert nur einen separaten, quellenpflichtigen Hinweis ohne Ausführungsrecht. Die Hash-Vektoren der Testbasis sind keine semantischen Modell-Embeddings und belegen keine semantische RAG-Qualität.
- Die Systeme sind Portfolio- und Testprojekte, keine behaupteten produktiven Kundenimplementierungen.

## Urheberschaft und KI-Unterstützung

Konzept, Architekturentscheidungen, Sicherheitsgrenzen, Testinterpretation, Dokumentation und Erklärbarkeit liegen bei Nico Joschke. Bei der Implementierung und technischen Prüfung wurden KI-gestützte Entwicklungswerkzeuge eingesetzt. Quellcode, reproduzierbare Testläufe und die dokumentierten Grenzen machen die Ergebnisse überprüfbar.
