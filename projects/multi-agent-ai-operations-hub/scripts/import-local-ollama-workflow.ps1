$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

. .\scripts\import-workflow-if-missing.ps1
Import-N8nWorkflowIfMissing `
    -WorkflowName '09 - Local Ollama Interpretation Receipt' `
    -WorkflowFile '.\workflows\09-local-ollama-interpretation-receipt.json'

Write-Host 'Open workflow 09 in the local n8n UI, select the existing PostgreSQL credential on its database node, save, and publish it.'
Write-Host 'No existing workflow was overwritten and no webhook was activated by this import command.'
