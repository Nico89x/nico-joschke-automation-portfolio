# Reproduzierbarer Test mit frischem n8n-/PostgreSQL-Stack

## Prüfstatus

Der Runner ist vorbereitet und syntaktisch geprüft. Der vollständige Docker-Durchlauf ist lokal noch **nicht bestätigt**, weil die Arbeitsumgebung keinen Zugriff auf die laufende Docker-Engine erhält. Erst ein erfolgreicher Durchlauf mit `status: passed` in `.e2e-local/result.json` gilt als Nachweis. Ein vorhandener Testbericht ersetzt diesen Nachweis nicht.

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

Der Runner stoppt seinen eigenen Test-Stack am Ende, löscht aber weder Volumes noch bestehende Container. Testressourcen bleiben für die Diagnose erhalten. Die zusätzliche GitHub-Actions-Konfiguration führt denselben Runner aus; ihre Existenz allein bedeutet noch keinen erfolgreichen Lauf.
