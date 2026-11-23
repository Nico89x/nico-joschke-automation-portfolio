# Lead Intake mit Notion · Ausgeführter Testlauf

Ausgeführt am **23. November 2026** mit einer privaten Notion-Testdatenbank und zwei synthetischen Kontakten unter `example.com`.

## Aufbau

Die JavaScript-Knoten **Lead validieren & bewerten**, **Duplikat + CRM-Payload** und **Speicherung prüfen** liefen direkt aus dem [n8n-Export](../../lead-intake-system.sanitized.json) in einem JavaScript-Testlauf. Ein authentifizierter Notion-Connector führte die Lese- und Schreiboperationen in der Testdatenbank aus. Der Testlauf übergab die gefundenen Datensätze an die Dublettenlogik und las die gespeicherten Ergebnisse anschließend erneut aus.

Die Notion-Schreibvorgänge sind echte SaaS-Aufrufe. Der n8n-Webhook, die direkte Einrichtung der Notion-Zugangsdaten in n8n und die Zustellung von E-Mail oder Telegram gehörten nicht zu diesem Lauf. Interne Notion- und Lead-IDs sind hier ausgelassen.

| Fall | Durchführung | Beobachtetes Ergebnis |
| --- | --- | --- |
| LT-01 · Anlegen | Gültiger Kontakt mit Leerzeichen im Namen und gemischter Großschreibung der E-Mail | Notion enthielt genau eine Seite. Name und E-Mail wurden normalisiert. |
| LT-02 · Aktualisieren | Selbe E-Mail, geänderte Nachricht. Vor dem zweiten Aufruf wurde der synthetische Kontakt auf „Angebot erstellt“ gesetzt. | Dieselbe Notion-Seite, dieselbe Lead-ID und genau eine Seite für den Kontakt. Die Nachricht änderte sich, das Angebotskennzeichen, Status und Erstellungsdatum blieben erhalten. |
| LT-03 · Abweisen | Kontakt mit ungültiger E-Mail | Die Validierung lieferte `invalid_email`. Ein anschließender Notion-Leseaufruf zeigte unveränderte Daten. |
| LT-04 · Wiederanlauf | Simulierter CRM-Ausfall für einen zweiten Kontakt. Danach erneuter Versuch mit erreichbarer Datenbank. | Im Fehlerpfad wurde kein Datensatz geschrieben. Der erneute Versuch legte genau eine neue Seite an. |

## Korrektur und Regression

Der bisherige Export verwendete dieselben Felder für Anlegen und Aktualisieren. Eine erneute Anfrage konnte dadurch auch die fachliche Lead-ID und den Angebotsstatus zurücksetzen. Der aktualisierte Export schützt die beim Anlegen gesetzten Identitäts- und Bearbeitungsfelder. Eine fehlende Lead-ID kann bei einem älteren Datensatz ergänzt werden. Bei einem fehlerhaften oder mehrdeutigen CRM-Suchergebnis stoppt der Ablauf vor dem Schreiben.

Die [Regressionstests](../../test/lead-intake-crm.test.mjs) prüfen die Aktualisierung, den Altbestand ohne Lead-ID sowie fehlerhafte und mehrdeutige Suchantworten.

```sh
node --test test/lead-intake-crm.test.mjs
```

Der Test belegt Deduplizierung bei aufeinanderfolgenden Aufrufen. Eine atomare Absicherung paralleler CRM-Schreibvorgänge wurde nicht getestet.
