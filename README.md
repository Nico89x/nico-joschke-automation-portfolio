# Nico Joschke – Automation Portfolio

[![Multi-Agent AI Operations Hub CI](https://github.com/Nico89x/nico-joschke-automation-portfolio/actions/workflows/operations-hub-ci.yml/badge.svg)](https://github.com/Nico89x/nico-joschke-automation-portfolio/actions/workflows/operations-hub-ci.yml)

Portfolio für Einstiegsrollen rund um **n8n, Workflow Automation, AI Automation und API-Integrationen**.

[Portfolio-Webseite öffnen](https://nico89x.github.io/nico-joschke-automation-portfolio/) · [Kurzprofil als PDF](Nico_Joschke_Automation_Portfolio_Kurzprofil.pdf)

## Hauptprojekt

### Multi-Agent AI Operations Hub

Ein lokal ausführbarer, kontrollierter n8n-Prototyp, der unstrukturierte Automatisierungsanfragen validiert, mit einer PostgreSQL/pgvector-Wissensbasis verbindet und als prüfbaren technischen Entwurf aufbereitet.

- **Stack:** n8n Community Edition, Docker Compose, PostgreSQL, pgvector, JavaScript, SQL und optional Ollama/Qwen
- **Kontrollen:** strikte Datentypen, Idempotenz, Audit-Log, RAG-Quellenpflicht, Request- und Versionsbindung bei Freigaben, Human-in-the-loop
- **Sicherheitsgrenze:** keine realen CRM-Schreibvorgänge, Aufgaben, E-Mails oder Nachrichten
- **Nachweis:** 178 lokale automatisierte Tests bestanden; synthetische AI-Evaluation mit offengelegter Modellvarianz
- **Reproduzierbarkeit:** vollständige lokale Umgebung, zehn deaktivierte n8n-Exporte, Datenbankschema, Testfälle und technische Dokumentation

[Fallstudie](multi-agent-ai-operations-hub.html) · [Vollständiger Quellcode](projects/multi-agent-ai-operations-hub/) · [Zentraler Workflow](operations-hub-central-workflow.json) · [Lokaler AI-Prüfworkflow](operations-hub-local-ai-receipt.json)

## Weitere Fallstudien

| Fallstudie | Schwerpunkt | Technischer Nachweis |
|---|---|---|
| Lead-to-Offer Automation Suite | Validierung, Routing, Deduplizierung, CRM und interne Angebotsentwürfe | [Lead Intake](lead-intake-system.sanitized.json), [CRM Router](crm-system.sanitized.json), [Offer Generator](offer-generator.sanitized.json) |
| Evidence-based Outreach Intelligence | Website-Evidenz, strukturierte AI-Ausgaben und Human-in-the-loop | [Workflow](outreach-intelligence.sanitized.json) |
| Market Opportunity Research | API-Recherche, Normalisierung, Deduplizierung und Scoring | [Workflow](handwerk-opportunity.sanitized.json) |

Die fünf älteren bereinigten Exporte enthalten zusammen 94 n8n-Knoten, 31 Code-Knoten und 14 HTTP-Schnittstellen. Zusammen mit den zwei separat angebotenen Operations-Hub-Exporten liegen sieben direkt prüfbare JSON-Dateien im Repository; das vollständige Hauptprojekt enthält zehn versionierte Workflow-Exporte.

## Qualitäts- und Claim-Grenzen

- Alle veröffentlichten Workflow-Exporte sind parsebar, standardmäßig deaktiviert und enthalten keine Credential-Objekte.
- Im Hauptprojekt verweisen Verbindungen ausschließlich auf vorhandene Knoten; JavaScript-Code-Knoten werden automatisiert kompiliert und geprüft.
- Nur synthetische Daten sind eingecheckt. `.env`, Zugangsdaten und lokale Ausführungsdaten bleiben ausgeschlossen.
- Der zentrale Operations-Hub-Ablauf nutzt deterministische Agenten-Baselines. Das lokale Sprachmodell liefert nur einen separaten, quellenpflichtigen Hinweis ohne Ausführungsrecht.
- Die Systeme sind Portfolio- und Testprojekte, keine behaupteten produktiven Kundenimplementierungen.

## Urheberschaft und KI-Unterstützung

Konzept, Architekturentscheidungen, Sicherheitsgrenzen, Testinterpretation, Dokumentation und Erklärbarkeit liegen bei Nico Joschke. Bei der Implementierung und technischen Prüfung wurden KI-gestützte Entwicklungswerkzeuge eingesetzt. Als Nachweis gelten der reproduzierbare Aufbau, die überprüfbaren Tests und die ausdrücklich dokumentierten Grenzen – nicht generierter Code allein.
