# Abnahmetest für Lead Intake mit Notion

Dieser Prüfplan deckt den ersten durchgängigen Teil von Lead-to-Offer ab. Ein synthetischer Lead soll in einer getrennten Notion-Testdatenbank angelegt und beim nächsten Aufruf aktualisiert werden. Die Suite im Repository prüft bereits die Eingabevalidierung. Die Live-Abnahme wurde am 24. November 2026 in einer separaten n8n-Testkopie mit einer privaten Testdatenbank ausgeführt. Ergebnisse, Ausführungsnummern und Abweichungen von diesem Prüfplan stehen im [Laufprotokoll](NOTION-TESTLAUF.md). Der gezielte Lookup-Fehler ersetzte dabei einen Entzug der Integrationsberechtigung.

## Vorbereitung

1. Den [Lead-Intake-Export](../../lead-intake-system.sanitized.json) in eine getrennte n8n-Testinstanz importieren und den Workflow deaktiviert lassen. Den Test-Webhook verwenden.
2. Eine leere Notion-Testdatenbank anlegen. Die Eigenschaftsnamen und Typen stehen im Code-Knoten **Duplikat + CRM-Payload**. Die verwendeten Eigenschaften müssen genau übereinstimmen.
3. Die Platzhalter-ID an den Notion-Knoten und im Code-Knoten ersetzen. Zugangsdaten nur in n8n hinterlegen. Den Zugriff der Integration auf diese Testdatenbank beschränken.
4. In der Testkopie die E-Mail- und Telegram-Knoten abtrennen. Die vorgesehenen Webhook-Antworten müssen in den entsprechenden Erfolgs- und Fehlerzweigen weiterhin erreichbar sein.
5. Ausschließlich synthetische Testdaten nutzen. Einen eventuell exportierten Ausführungsbeleg vor Veröffentlichung von Zugangsdaten und internen IDs bereinigen.

## Abnahme

| Fall | Aktion | Soll-Ergebnis |
| --- | --- | --- |
| LT-01 · Anlegen | Gültigen Lead mit einer E-Mail-Adresse unter `example.com` an den Test-Webhook senden | Eine neue Testseite. Webhook meldet Erfolg. Name und E-Mail wurden normalisiert. |
| LT-02 · Aktualisieren | Dieselbe E-Mail mit geänderter Nachricht erneut senden | Dieselbe Notion-Seiten-ID, weiterhin genau eine Seite für die E-Mail. Die Nachricht ist aktualisiert. |
| LT-03 · Abweisen | Pflichtfeld weglassen oder eine ungültige E-Mail senden | Der Webhook meldet einen Validierungsfehler. Anzahl und Inhalt der Testseiten bleiben unverändert. |
| LT-04 · Erholen | Zugriff auf die Testdatenbank vorübergehend entziehen und einen neuen Lead senden. Zugriff wiederherstellen und denselben Lead erneut senden. | Der erste Versuch meldet einen Speicherfehler. Nach Wiederherstellung führt der neue Aufruf zu genau einer Seite. |

Beispiel für den ersten Aufruf:

```json
{
  "name": "Testkontakt",
  "email": " PORTFOLIO-CRM@EXAMPLE.COM ",
  "interest": "Prozess automatisieren",
  "privacy": true,
  "message": "Synthetische Anfrage für LT-01"
}
```

Für die Dokumentation je Fall Datum, n8n-Ausführungs-ID, HTTP-Status, Anzahl der Testseiten und beobachtetes Ergebnis festhalten. Ein erfolgreicher serieller Test setzt keine dauerhafte Deduplizierung bei parallelen Anfragen voraus. Im Export ist der Wiederanlauf in LT-04 ein erneuter Aufruf durch den Tester.

[Zurück zu Lead-to-Offer](README.md)
