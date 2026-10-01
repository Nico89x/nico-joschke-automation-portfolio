# Reproduzierbarer Test mit frischem n8n-/PostgreSQL-Stack

## Prüfstatus

Der vollständige Docker-Durchlauf wurde am **01.10.2026 in GitHub Actions erfolgreich bestätigt**: [Lauf 36835141067](https://github.com/Nico89x/nico-joschke-automation-portfolio/actions/runs/36835141067), Commit `fdd7515708cf0b419b7caf6ab73c656edd1a9dcd`. Der bereinigte Bericht wurde als `clean-e2e-result` hochgeladen. Alle aufgeführten HTTP- und Datenbankprüfungen bestanden. Lokal auf dem Laptop bleibt der Engine-Zugriff aus der Arbeitsumgebung gesperrt; der nachgewiesene Lauf fand deshalb im isolierten GitHub-Runner statt.

## Ausführen

Voraussetzungen: Node.js ab Version 20, Docker mit laufender Engine und Docker Compose. Im Projektverzeichnis:

```sh
node scripts/verify-clean-e2e.mjs
```

Der Runner verwendet einen zufällig benannten, getrennten Compose-Stack, frische Volumes und ausschließlich synthetische Daten. Bestehende Stacks werden nicht verändert. PostgreSQL wird nicht nach außen veröffentlicht; n8n verwendet einen zufälligen Port auf `127.0.0.1`.

Temporäre Datenbank-Zugangsdaten werden lokal generiert und ausschließlich im ignorierten Verzeichnis `.e2e-local` abgelegt. Dieses Verzeichnis darf nicht veröffentlicht werden. Nur die bereinigte `result.json` ist als CI-Artefakt vorgesehen.

## Was geprüft werden soll

- Import aller zehn bereinigten Workflow-Exporte.
- Veröffentlichung und Webhook-Ausführung der Workflows 02, 03, 07 und 08.
- Seeding synthetischer Wissensdaten, Planung mit geschlossenem Ausführungstor, Idempotenz, Freigabe, Replay-Abweisung, Eingabevalidierung und Ablehnung.
- Prüfung der in der frischen Datenbank entstandenen Blueprint-Datensätze.

Nicht behauptet werden: Ausführung aller zehn Workflows, Live-LLM-Aufrufe, reale CRM-Aktionen oder der Live-Test des separaten ReleaseWatch-Workflows.

Der Runner stoppt seinen eigenen Test-Stack am Ende, löscht aber weder Volumes noch bestehende Container. Lokal bleiben Testressourcen für die Diagnose erhalten; GitHub entsorgt seinen kurzlebigen Runner nach dem Job. Die zusätzliche GitHub-Actions-Konfiguration führt denselben Runner aus. Bei späteren Änderungen ist ihr jeweils aktueller Status zu prüfen.

Der Nachweis verwendet n8n 2.40.5 und PostgreSQL 16/pgvector in einer synthetischen Testumgebung. n8n meldet PostgreSQL 16 als Kompatibilitätsbetrieb und warnt vor dem internen Task-Runner-Modus. Das ist kein empfohlenes Produktions-Deployment und keine Sicherheitsfreigabe.
