# Nico Joschke – Automation Portfolio

[![Multi-Agent AI Operations Hub CI](https://github.com/Nico89x/nico-joschke-automation-portfolio/actions/workflows/operations-hub-ci.yml/badge.svg)](https://github.com/Nico89x/nico-joschke-automation-portfolio/actions/workflows/operations-hub-ci.yml)

Portfolio für Einstiegsrollen rund um **n8n, Workflow Automation, AI Automation und API-Integrationen**.

[Portfolio-Webseite öffnen](https://nico89x.github.io/nico-joschke-automation-portfolio/) · [Kurzprofil als PDF](Nico_Joschke_Automation_Portfolio_Kurzprofil.pdf)

Die Webseite wird zusätzlich durch [automatisierte Portfolio-Prüfungen](test/portfolio-site.test.mjs) abgesichert: lokale Links und Sprungziele, die fünf Fallstudien, HTML-/Accessibility-Struktur und die direkt angebotenen Workflow-Exporte. Ausführen im Repository: `node --test test/portfolio-site.test.mjs`. Das ersetzt keine visuelle Browser-Prüfung; mit `PORTFOLIO_BASE_URL` kann zusätzlich die Erreichbarkeit der öffentlichen Dateien geprüft werden.

## Über mich

Ich bin Nico Joschke, Quereinsteiger mit eigener Projektpraxis in **n8n, JavaScript, REST APIs, Webhooks und KI-gestützten Workflows**. Ich suche eine Junior-/Associate-Festanstellung in Workflow Automation, AI Automation oder API-Integration, remote innerhalb Deutschlands.

Meine Erfahrung stammt aus nachvollziehbaren Portfolio- und Testprojekten; kommerzielle IT-Berufserfahrung bringe ich bisher nicht mit.

## Portfolio in 90 Sekunden prüfen

- **Überblick:** [Portfolio-Webseite](https://nico89x.github.io/nico-joschke-automation-portfolio/) und [Fallstudie des Hauptprojekts](https://nico89x.github.io/nico-joschke-automation-portfolio/multi-agent-ai-operations-hub.html)
- **Ablauf sehen:** [echte n8n-Workflow-Screenshots mit Einordnung](projects/multi-agent-ai-operations-hub/docs/screenshots/README.md)
- **Demo nachvollziehen:** [90-Sekunden-Demo und lokale Prüfschritte](projects/multi-agent-ai-operations-hub/docs/DEMO_RUNBOOK.md)
- **Code und Qualität prüfen:** [Architektur und lokaler Start](projects/multi-agent-ai-operations-hub/README.md), [Tests](projects/multi-agent-ai-operations-hub/test/) und [GitHub-CI](https://github.com/Nico89x/nico-joschke-automation-portfolio/actions/workflows/operations-hub-ci.yml)

Die Demo läuft lokal mit synthetischen Daten. Es gibt keinen öffentlich zugänglichen Live-Service; die Screenshots zeigen die Workflow-Struktur, nicht allein den Nachweis eines erfolgreichen Durchlaufs.

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
- Der zentrale Operations-Hub-Ablauf nutzt deterministische Agenten-Baselines. Das lokale Sprachmodell liefert nur einen separaten, quellenpflichtigen Hinweis ohne Ausführungsrecht. Die Hash-Vektoren der Testbasis sind keine semantischen Modell-Embeddings und belegen keine semantische RAG-Qualität.
- Die Systeme sind Portfolio- und Testprojekte, keine behaupteten produktiven Kundenimplementierungen.

## Urheberschaft und KI-Unterstützung

Konzept, Architekturentscheidungen, Sicherheitsgrenzen, Testinterpretation, Dokumentation und Erklärbarkeit liegen bei Nico Joschke. Bei der Implementierung und technischen Prüfung wurden KI-gestützte Entwicklungswerkzeuge eingesetzt. Als Nachweis gelten der reproduzierbare Aufbau, die überprüfbaren Tests und die ausdrücklich dokumentierten Grenzen – nicht generierter Code allein.
