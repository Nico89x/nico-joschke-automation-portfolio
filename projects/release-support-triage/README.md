# ReleaseWatch: sichere Support-Triage mit einer echten API

Eine kleine Portfolio-Fallstudie: Ein synthetisches Support-Ticket fragt nach einer n8n-Version. Ein Adapter liest ausschließlich öffentliche Release-Metadaten aus der GitHub-API und erstellt einen prüfpflichtigen Entwurf. Er versendet keine Nachricht und führt kein Update aus.

## Nachweise

- 31 automatisierte Tests: Validierung, Metadaten-Vertrag, Größenlimit, Timeout, begrenzte Wiederholungen, Rate-Limits, Idempotenz und der eingebettete n8n-Code.
- Echter öffentlicher API-Aufruf am 01.10.2026 erfolgreich: Release `n8n@2.41.4`. Das ist eine Momentaufnahme, keine Update- oder Sicherheitsempfehlung.
- [Demo-Video](demo.mp4): Montage echter Browser-Aufnahmen des Node.js-Adapters. Erfolgsfall, doppeltes Ticket, ungültige Eingabe und ausdrücklich simulierter HTTP-429-Fehler. Kein Live-n8n-Nachweis.
- [Bereinigter n8n-Workflow](workflow.sanitized.json): inaktiv, ohne Zugangsdaten, mit geschlossenem Ausführungstor. Import und vollständige Ausführung dieses zusätzlichen Workflows sind noch nicht live geprüft.

## Lokal ausprobieren

Voraussetzung: Node.js ab Version 20. Keine Pakete und keine API-Schlüssel erforderlich.

```sh
node --test
node live-check.mjs
node demo-server.mjs
```

Die Demo ist anschließend unter `http://127.0.0.1:15741` erreichbar. Der Live-Check ruft ausschließlich `https://api.github.com/repos/n8n-io/n8n/releases/latest` ab. GitHub sieht dabei die übliche Netzwerkadresse; Ticketdaten werden nicht übertragen. Die automatisierten Tests verwenden kontrollierte Testantworten und benötigen kein Netzwerk.

## Ablauf und Sicherheitsgrenzen

1. Nur synthetische Tickets mit eng begrenzten Feldern akzeptieren.
2. Release-Metadaten über einen fest vorgegebenen GET-Endpunkt abrufen; Weiterleitungen ablehnen.
3. Status, JSON-Struktur, Release-URL und Antwortgröße prüfen. Ungeprüften Release-Text nicht als Anweisung übernehmen.
4. Einen Entwurf mit `awaiting-human-review` erzeugen. `executionGate` bleibt `false`; externe Aktionen bleiben bei null.
5. Gleiche Ticket-ID mit gleicher Bedeutung wiederverwenden; widersprüchliche Verwendung ablehnen.

Der Node.js-Adapter versucht vorübergehende Fehler höchstens dreimal und beachtet nur kurze Retry-After-Werte. Der n8n-Export arbeitet konservativer: Jeder Nicht-200-Status führt unmittelbar zur manuellen Prüfung. Die Varianten behaupten keine identische Retry-Strategie.

## Ehrliche Grenzen

- Idempotenz ist im Node-Adapter nur im Arbeitsspeicher und begrenzt auf 100 Einträge; ein Neustart leert den Cache. Keine produktive, persistente Exactly-once-Garantie.
- Human-in-the-Loop bedeutet hier einen gesperrten Entwurf, noch keinen vollständigen Freigabeprozess.
- Keine CRM-Schreibzugriffe, keine echten Kundendaten, keine LLM-Aufrufe, keine kostenpflichtigen Dienste.
- Der lokale Demo-Server ist keine produktive Anwendung.
- Diese Fallstudie zeigt Portfolio-Praxis, keine kommerzielle Projekterfahrung.
