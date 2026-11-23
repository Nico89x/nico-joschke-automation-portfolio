# QA- und Support-Arbeitsprobe: ReleaseWatch

ReleaseWatch liest öffentliche Release-Daten für ein synthetisches Support-Ticket. Der Ablauf soll auch bei einem Ausfall der Schnittstelle nachvollziehbar bleiben und keine Aktion außerhalb der Demo auslösen.

## Testaufbau

Node.js ab Version 20. In diesem Verzeichnis `node demo-server.mjs` starten und die [lokale Demo](http://127.0.0.1:15741/) öffnen. Der reguläre Ablauf liest öffentliche GitHub-Metadaten. Der 429-Fall verwendet eine kontrollierte Testantwort. Für einen neuen Testlauf eine frische Ticket-ID mit dem Präfix `synthetic-` verwenden.

## Abnahmekriterien

| Fall | Eingabe | Erwartetes Ergebnis |
| --- | --- | --- |
| RW-01 · Gültiges Ticket | `POST /triage` mit einer gültigen, neuen Ticket-ID | HTTP 200. Der Entwurf wartet auf menschliche Prüfung. Das Ausführungstor ist geschlossen und die Zähler für externe Aktionen bleiben bei null. |
| RW-02 · Identische Wiederholung | Zweimal dieselbe ID mit identischem Inhalt an `/triage` senden | HTTP 200. Der zweite Aufruf meldet `duplicate` und `cached: true`. |
| RW-03 · Widerspruch | Dieselbe ID mit veränderter installierter Version an `/triage` senden | HTTP 409 mit `idempotency_conflict`. Der ursprüngliche Entwurf bleibt erhalten. |
| RW-04 · Ungültige Eingabe | Ticket ohne gültige Versionsnummer an `/triage` senden | HTTP 422 mit `invalid_ticket`. |
| RW-05 · Schnittstellenlimit | Gültiges Ticket an `/simulate-rate-limit` senden | Der simulierte GitHub-HTTP-429 führt lokal zu HTTP 503 mit `rate_limited`. Es geht keine Nachricht raus. |

Beispieldaten für RW-01 und RW-02:

```json
{
  "id": "synthetic-qa-01",
  "product": "n8n",
  "category": "update-question",
  "installedVersion": "2.0.0"
}
```

## Beispiel für ein Support-Ticket

**Titel:** ReleaseWatch kann öffentliche Release-Daten bei einem Rate-Limit vorübergehend nicht laden.

**Reproduktion:** Lokale Demo öffnen und den Rate-Limit-Fall mit einem synthetischen Ticket auslösen. Im Netzwerk-Tab des Browsers die Anfrage an `/simulate-rate-limit` prüfen.

**Beobachtung:** Die Simulation meldet `HTTP 503 / rate_limited`, `executionGate: false` und `messagesSent: 0`. Das fehlertolerante Verhalten entspricht RW-05. Eine echte Störung beim Anbieter ist damit nicht belegt.

**Übergabe:** Fall-ID, Uhrzeit, HTTP-Status und Fehlercode dokumentieren. Bei einem echten Vorfall prüfen, ob mehrere Tickets betroffen sind und ob sich der reguläre Ablauf nach Ende des Limits wieder erholt. Keine Zugangsdaten oder echten Kundendaten in die Fehlerbeschreibung übernehmen.

## Nachweise und Grenzen

Die [automatisierten Tests](test/) decken auch Timeout, fehlerhafte API-Antworten und begrenzte Wiederholungen ab. Der [Demo-Mitschnitt](demo.mp4) zeigt den Node.js-Adapter. Der Cache ist auf den laufenden Prozess begrenzt. Die Testfälle gelten für diesen Adapter und seine lokale Demo.

[Zurück zu ReleaseWatch](README.md)
