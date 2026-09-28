$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

Write-Host "Checking the local n8n and PostgreSQL stack..."
$rows = @(docker compose ps --format json | ConvertFrom-Json)
$unhealthy = @($rows | Where-Object { $_.Health -ne "healthy" })
if ($rows.Count -lt 2 -or $unhealthy.Count -gt 0) {
    throw "The local stack is not healthy. Start it with START_LOCAL.cmd first."
}

. .\scripts\import-workflow-if-missing.ps1
Import-N8nWorkflowIfMissing `
    -WorkflowName "00 - Apply Knowledge Base Migration" `
    -WorkflowFile ".\workflows\00-apply-knowledge-migration.json"

Import-N8nWorkflowIfMissing `
    -WorkflowName "02 - Knowledge Base Ingestion API" `
    -WorkflowFile ".\workflows\02-knowledge-ingestion-api.json"

Write-Host ""
Write-Host "RAG workflows imported. Return to Codex and write: imported"
