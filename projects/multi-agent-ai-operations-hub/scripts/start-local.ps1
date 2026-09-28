$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

Write-Host "Starting the isolated local n8n and PostgreSQL stack..."
docker compose up -d

Write-Host "Waiting for both services to become healthy..."
$deadline = (Get-Date).AddMinutes(5)
do {
    $rows = docker compose ps --format json | ConvertFrom-Json
    $unhealthy = @($rows | Where-Object { $_.Health -ne "healthy" })
    if ($rows.Count -ge 2 -and $unhealthy.Count -eq 0) { break }
    if ((Get-Date) -gt $deadline) {
        docker compose ps
        throw "The local stack did not become healthy within five minutes."
    }
    Start-Sleep -Seconds 5
} while ($true)

. .\scripts\import-workflow-if-missing.ps1
Import-N8nWorkflowIfMissing `
    -WorkflowName "01 - Deterministic Intake API" `
    -WorkflowFile ".\workflows\01-intake-api.json"

Write-Host ""
Write-Host "Local stack is healthy and the intake workflow is present or was imported."
Write-Host "Open http://localhost:5680, complete the local owner setup if requested, open '01 - Deterministic Intake API', and publish/activate it."
Write-Host "Then run: powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test-intake.ps1"
Start-Process "http://localhost:5680"
