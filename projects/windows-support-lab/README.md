# Windows-Support-Lab

Zwei reproduzierbare Ticketfälle für Anwendungssupport und Service Desk. Ausgeführt am **23. November 2026** mit einer temporären Windows-Datei und synthetischen Anmeldedaten.

| Fall | Umgebung | Ergebnis |
| --- | --- | --- |
| LAB-01 · Datei lässt sich nicht speichern | Windows-Dateisystem, temporäre Datei mit aktivem Schreibschutz | Lesen möglich, Schreiben abgewiesen. Nach Wiederherstellung des ursprünglichen Dateiattributs war das Speichern wieder möglich. |
| LAB-02 · Falsch geschriebener Anmeldename | Lokaler HTTP-Testdienst mit synthetischem Anmeldeverzeichnis | Falscher Anmeldename führte zu HTTP 401. Die interne Diagnose verwies auf die unbekannte Identität. Nach Korrektur folgte HTTP 200. |

## LAB-01 · Datei lässt sich nicht speichern

- **Kategorie und Auswirkung:** Einzelplatz / Datei. Ein Anwender kann seine temporäre Übergabedatei lesen und die Bearbeitung nicht speichern.
- **Reproduktion:** Eine Testdatei schreiben, deren Attribut `ReadOnly` setzen und erneut öffnen. Der Lesezugriff bleibt möglich. Ein Schreibzugriff erzeugt `UnauthorizedAccessException`.
- **Diagnose:** Dateiattribut prüfen und mit einer beschreibbaren Testdatei im selben Verzeichnis vergleichen. Bei einer echten Anfrage zusätzlich abklären, ob ein Freigaberecht, eine Dateisperre oder eine zuständige Stelle das Verhalten vorgibt.
- **Lösung im Lab:** Das zuvor gesicherte Attribut wiederherstellen, schreiben und den neuen Inhalt erneut lesen. Das Skript entfernt anschließend seine eigene Testdatei.
- **Eskalation:** Bei beabsichtigtem Schreibschutz, zentral verwalteten Freigaben oder mehreren betroffenen Anwendern an den Datei- oder Systemverantwortlichen übergeben. Beobachtetes Verhalten, Zeitpunkt und betroffenen Speicherort festhalten.

## LAB-02 · Falsch geschriebener Anmeldename

- **Kategorie und Auswirkung:** Anmeldung / Einzelperson. Die Anmeldung am simulierten Dienst wird abgewiesen.
- **Reproduktion:** Einmal mit `suport.lab@example.test` anmelden. Der Testdienst antwortet mit HTTP 401 und einer Anfrage-ID. Anhand der ID weist der Testdatensatz den Grund `identity_not_found` aus.
- **Diagnose:** UTC-Zeit und Anfrage-ID erfassen. Den vollständigen Anmeldenamen mit dem freigegebenen Eintrag `support.lab@example.test` vergleichen. Der Test protokolliert keine Anmeldegeheimnisse.
- **Lösung im Lab:** Den Anmeldenamen korrigieren und einmal erneut anmelden. HTTP 200 und eine neue Anfrage-ID bestätigen den erfolgreichen Durchlauf.
- **Eskalation für einen echten Microsoft-365-Fall:** Bei weiterhin gültigem Anmeldenamen und fortbestehendem Fehler Uhrzeit, betroffene Anwendung, Fehlercode und sichtbare Korrelations-ID an den zuständigen Entra-Support weitergeben. MFA-, Sperr- oder Richtlinienfälle gehören an die zuständige Stelle.

## Erneut ausführen

Im Verzeichnis dieses Labs unter Windows. Für die Anmeldesimulation ist Node.js 24 vorgesehen.

```powershell
.\test-fileschutz.ps1
node --test test-anmeldung.mjs
```

Die Anmeldung simuliert eine Service-Desk-Diagnose. Sie verwendet keinen Microsoft-365-Mandanten, keine Entra-Anmeldeprotokolle und keine produktiven Konten. Eine echte Microsoft-365-Anmeldung lässt sich separat mit einem freigegebenen Testmandanten prüfen.

[Microsoft Learn · Dateiattribute](https://learn.microsoft.com/en-us/dotnet/api/system.io.fileattributes) · [Microsoft Learn · Anmeldung in Entra diagnostizieren](https://learn.microsoft.com/en-us/entra/identity/monitoring-health/howto-troubleshoot-sign-in-errors)
