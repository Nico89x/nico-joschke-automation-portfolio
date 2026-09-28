param(
    [string] $BaseUrl = "http://localhost:5680/webhook/knowledge-base-search"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$cases = Get-Content -LiteralPath (Join-Path $projectRoot "evals\rag-cases.json") -Raw | ConvertFrom-Json
$results = @()

foreach ($case in $cases) {
    $payload = @{ queryText = [string]$case.query; limit = 3 } | ConvertTo-Json
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $BaseUrl -Method Post -ContentType "application/json" -Body $payload
        $body = $response.Content | ConvertFrom-Json
        $sourceIds = @($body.sources | ForEach-Object { [string]$_.sourceId })
        $results += [PSCustomObject]@{
            caseId = [string]$case.id
            httpStatus = [int]$response.StatusCode
            status = [string]$body.status
            expectedSource = [string]$case.expectedSourceId
            returnedSources = ($sourceIds -join ", ")
            duplicateFree = (@($sourceIds | Select-Object -Unique).Count -eq $sourceIds.Count)
            passed = ([int]$response.StatusCode -eq 200 -and $body.status -eq "retrieved" -and $sourceIds.Count -gt 0 -and $sourceIds[0] -eq $case.expectedSourceId -and (@($sourceIds | Select-Object -Unique).Count -eq $sourceIds.Count))
        }
    }
    catch {
        $results += [PSCustomObject]@{
            caseId = [string]$case.id
            httpStatus = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { $null }
            status = "error"
            expectedSource = [string]$case.expectedSourceId
            returnedSources = $_.ErrorDetails.Message
            duplicateFree = $false
            passed = $false
        }
    }
}

$results | Format-Table -AutoSize
if (@($results | Where-Object { -not $_.passed }).Count -gt 0) {
    throw "One or more RAG retrieval smoke tests did not meet the expected relevance or duplicate-free result criteria."
}

Write-Host "RAG retrieval smoke tests passed."
