param(
    [string] $BaseUrl = "http://localhost:5680/webhook/knowledge-base-ingest"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$knowledgeFolder = Join-Path $projectRoot "knowledge\base"
$results = @()

foreach ($file in @(Get-ChildItem -LiteralPath $knowledgeFolder -Filter *.md | Sort-Object Name)) {
    $sourceId = [string]$file.BaseName
    $sourceName = ($sourceId -replace '-', ' ')
    $payload = @{
        sourceId = $sourceId
        sourceName = $sourceName
        content = [string](Get-Content -LiteralPath $file.FullName -Raw)
        tags = @('synthetic', 'portfolio', 'internal-knowledge')
    } | ConvertTo-Json -Depth 5

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $BaseUrl -Method Post -ContentType "application/json" -Body $payload
        $body = $response.Content | ConvertFrom-Json
        $results += [PSCustomObject]@{
            sourceId = $sourceId
            httpStatus = [int]$response.StatusCode
            workflowStatus = $body.status
            upsertedChunks = $body.upsertedChunks
            passed = ([int]$response.StatusCode -eq 202 -and $body.status -eq 'accepted')
        }
    }
    catch {
        $details = $_.ErrorDetails.Message
        $results += [PSCustomObject]@{
            sourceId = $sourceId
            httpStatus = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { $null }
            workflowStatus = 'error'
            upsertedChunks = $details
            passed = $false
        }
    }
}

$results | Format-Table -AutoSize
if (@($results | Where-Object { -not $_.passed }).Count -gt 0) {
    throw "One or more synthetic knowledge documents could not be ingested."
}

Write-Host "Synthetic knowledge base ingestion passed."
