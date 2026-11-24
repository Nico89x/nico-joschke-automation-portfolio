# Lead Intake mit Notion · Ausgeführter Testlauf

Die Abnahme lief am **24. November 2026** in n8n gegen eine private Notion-Testdatenbank. Verwendet wurden ausschließlich zwei synthetische Kontakte unter `example.com`.

## Aufbau und Authentifizierung

Die separate Testkopie umfasst 14 Knoten für Webhook-Eingang, Validierung, Dublettenprüfung, Anlage, Aktualisierung und Webhook-Antwort. Die drei HTTP-Knoten verwendeten die in n8n hinterlegte Notion-Integration. Der Zugriff auf die private Testdatenbank wurde in Notion freigegeben. Zugangsdaten stehen ausschließlich im Credential-Speicher von n8n.

Der [bereinigte Testexport](lead-intake-notion-lab.sanitized.json) enthält weder Zugangsdaten noch interne Datenbank-IDs. Die CRM-Payload-Logik entspricht dem korrigierten [Lead-Intake-Export](../../lead-intake-system.sanitized.json). Die Testkopie beschränkt E-Mail-Adressen auf `n8n-lab-…@example.com`, besitzt eine gezielte Fehlereinschleusung für den Lookup und enthält keine Benachrichtigungsknoten. Sie bleibt deaktiviert.

Die Ausführungen wurden über die manuelle n8n-Testausführung mit einem POST-Webhook-Payload gestartet. Ein externer HTTP-Aufruf gegen den Webhook-Endpunkt und produktive E-Mail-/Telegram-Zustellung gehörten nicht zur Abnahme. Die angegebenen Antwortcodes sind die Konfiguration der tatsächlich erreichten Antwortknoten. Der Erfolg wurde zusätzlich an den Notion-Antworten und einem erneuten Datenbank-Leseaufruf geprüft.

## Laufprotokoll

Alle Uhrzeiten sind UTC. Die lokalen Ausführungsnummern erlauben den Abgleich mit der n8n-Historie. Interne Seiten-IDs und Lead-IDs werden nicht veröffentlicht.

| Fall | Ausführung und Beginn | Durchführung | Beobachtetes Ergebnis |
| --- | --- | --- | --- |
| LT-01 · Anlegen | 303 · 07:45:04 | Neuer Kontakt mit gemischter Großschreibung und Leerzeichen in der E-Mail | Lookup ohne Treffer, erfolgreicher Notion-POST, `stored: true`, `duplicate: false`. Antwortknoten Erfolg, konfiguriert mit 200. Genau eine Seite für die normalisierte E-Mail. |
| LT-02 · Aktualisieren | 304 · 07:47:16 | Gleiche E-Mail, Name mit Rand-Leerzeichen und neue Nachricht. Zuvor „Angebot erstellt“ gesetzt und nächsten Schritt manuell geändert. | Erfolgreicher Notion-PATCH derselben Seite, `duplicate: true`. Nachricht geändert, Name normalisiert. Lead-ID, Erstellungsdatum, Status, Angebotskennzeichen und manueller nächster Schritt erhalten. Antwortknoten Erfolg, konfiguriert mit 200. |
| LT-03 · Abweisen | 305 · 07:47:29 | Ungültige E-Mail | `invalid_email`, Antwortknoten Validierungsfehler, konfiguriert mit 400. Keine Notion-Knoten ausgeführt. |
| LT-04a · Speicherfehler | 306 · 07:47:41 | Neuer zweiter Kontakt mit `qaFailLookup: true`. Nur dieser Aufruf fragt eine absichtlich ungültige Datenbank-ID ab. | Tatsächlich fehlgeschlagener HTTP-Lookup, `storageReady: false`, Antwortknoten Speicherfehler, konfiguriert mit 503. Kein Schreibknoten ausgeführt. Kontrollabfrage fand noch keinen zweiten Kontakt. |
| LT-04b · Wiederanlauf | 307 · 07:47:55 | Derselbe zweite Kontakt ohne Fehlereinschleusung erneut übergeben | Erfolgreicher Notion-POST, `stored: true`. Antwortknoten Erfolg, konfiguriert mit 200. Abschließende Kontrollabfrage fand genau eine Seite je Testkontakt. |

Vor der Abnahme erreichten zwei Einrichtungsversuche den Fehlerzweig, weil der zunächst verwendete neue Data-Source-Endpunkt hier mit HTTP 400 abgewiesen wurde. Die Testkopie verwendet wie der ursprüngliche Export den Datenbank-Endpunkt mit `Notion-Version: 2022-06-28`. Erst die nachfolgenden Ausführungen 303–307 bilden die obige Abnahme.

## Reproduzieren

1. Den bereinigten Testexport in n8n importieren und deaktiviert lassen.
2. Eine separate Notion-Testdatenbank mit den Eigenschaftsnamen und Typen aus dem Knoten **Duplikat + CRM-Payload** anlegen. Der [Abnahmeplan](NOTION-ABNAHMETEST.md) beschreibt die Vorbereitung.
3. `NOTION_TEST_DATABASE_ID` in Lookup-URL und CRM-Code ersetzen. Den drei Notion-HTTP-Knoten die passende Notion-Integration zuweisen und dieser in Notion Zugriff auf die Testdatenbank geben.
4. Den Test-Webhook mit folgendem JSON aufrufen oder denselben Body in der manuellen n8n-Testausführung verwenden.

```json
{
  "name": "n8n Lab Testkontakt",
  "email": " N8N-LAB-TEST@example.com ",
  "interest": "Prozess automatisieren",
  "privacy": true,
  "message": "Synthetische Anfrage für LT-01"
}
```

Für LT-02 dieselbe E-Mail und eine andere Nachricht verwenden. Für LT-03 `email` auf `ungueltig` setzen. Für LT-04 eine neue Adresse nach dem Muster `n8n-lab-…@example.com` zuerst mit `"qaFailLookup": true` und danach ohne dieses Feld übergeben. Je Schritt Ergebnis, Seitenanzahl und Erhalt der Bearbeitungsfelder prüfen.

## Korrektur, Regression und Grenzen

Der bisherige Export verwendete dieselben Felder für Anlegen und Aktualisieren. Eine erneute Anfrage konnte dadurch die fachliche Lead-ID und den Angebotsstatus zurücksetzen. Der korrigierte Export schützt die beim Anlegen gesetzten Identitäts- und Bearbeitungsfelder. Eine fehlende Lead-ID wird bei älteren Datensätzen ergänzt. Bei fehlerhaften oder mehrdeutigen Suchergebnissen stoppt der Ablauf vor dem Schreiben.

Die [Regressionstests](../../test/lead-intake-crm.test.mjs) prüfen Aktualisierung, Altbestand ohne Lead-ID sowie fehlerhafte und mehrdeutige Suchantworten.

```sh
node --test test/lead-intake-crm.test.mjs
```

Ein vorheriger Connector-Test am 23. November 2026 hatte dieselben fachlichen Fälle bereits mit direkt ausgeführten JavaScript-Knoten und einem authentifizierten Notion-Connector geprüft. Die oben dokumentierte Abnahme ergänzt den vollständigen n8n-Ablauf mit dessen Notion-HTTP-Knoten.

Belegt sind serielle Deduplizierung und ein erneuter Aufruf nach einem Lookup-Fehler. Eine atomare Absicherung paralleler Schreibvorgänge, automatische Wiederholungen oder ein echter Notion-Gesamtausfall wurden nicht geprüft. Die Arbeitsprobe entstand mit KI-Unterstützung bei Implementierung, Durchführung und Dokumentation.
