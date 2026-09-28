param(
    [string] $BaseUrl = "http://localhost:5680",
    [int] $Samples = 5,
    [int] $TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
if ($Samples -lt 3 -or $Samples -gt 20) {
    throw "Choose 3 to 20 samples so the summary is useful without creating excessive demo records."
}

$base = $BaseUrl.TrimEnd('/')
$health = Invoke-WebRequest -UseBasicParsing -Uri "$base/healthz" -TimeoutSec 5
if ([int] $health.StatusCode -ne 200) { throw "Local n8n health check did not return HTTP 200." }

$runKey = [Guid]::NewGuid().ToString("N")
$samplesMs = [System.Collections.Generic.List[double]]::new()
$sampleRows = [System.Collections.Generic.List[object]]::new()

for ($i = 1; $i -le $Samples; $i++) {
    $body = @{
        companyName = "Synthetic Benchmark GmbH"
        contactName = "Synthetic Benchmark Contact"
        contactEmail = "benchmark@example.test"
        processDescription = "Synthetic website inquiries are manually copied into a CRM. Validate required fields, prevent duplicate leads, and prepare a reviewable automation proposal."
        currentTools = @("HubSpot", "n8n")
        goals = @("Reduce manual entry", "Prevent duplicate records")
        constraints = @{
            dataSensitivity = "personal"
            requiresHumanApproval = $true
        }
        idempotencyKey = "benchmark-$runKey-$i"
    }

    $json = $body | ConvertTo-Json -Depth 10
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    $response = Invoke-WebRequest -UseBasicParsing `
        -Uri "$base/webhook/operations-hub" `
        -Method Post `
        -ContentType "application/json" `
        -Body $json `
        -TimeoutSec $TimeoutSeconds
    $timer.Stop()

    $result = [string] $response.Content | ConvertFrom-Json
    if ([int] $response.StatusCode -ne 202) { throw "Sample $i returned HTTP $($response.StatusCode), expected 202." }
    if ($result.status -ne "awaiting-human-review") { throw "Sample $i did not stop at awaiting-human-review." }
    if ($result.executionGate -ne $false) { throw "Sample $i unexpectedly opened the execution gate." }
    if ([int] $result.auditEventsWritten -ne 6) { throw "Sample $i did not write six stage audit events." }

    $samplesMs.Add([double] $timer.Elapsed.TotalMilliseconds)
    $sampleRows.Add([PSCustomObject]@{
        sample = $i
        httpStatus = [int] $response.StatusCode
        elapsedMs = [Math]::Round($timer.Elapsed.TotalMilliseconds, 1)
        auditEvents = [int] $result.auditEventsWritten
        executionGate = [bool] $result.executionGate
    })
}

$ordered = @($samplesMs | Sort-Object)
$middle = [int][Math]::Floor($ordered.Count / 2)
$median = if ($ordered.Count % 2 -eq 0) {
    ($ordered[$middle - 1] + $ordered[$middle]) / 2
} else {
    $ordered[$middle]
}

[PSCustomObject]@{
    benchmark = "local-operations-hub-planning"
    baseUrl = $base
    samples = $Samples
    medianRoundTripMs = [Math]::Round($median, 1)
    minRoundTripMs = [Math]::Round($ordered[0], 1)
    maxRoundTripMs = [Math]::Round($ordered[-1], 1)
    externalActions = 0
    llmApiCost = "not applicable; no model API configured"
    note = "Round-trip includes local HTTP, n8n workflow, and PostgreSQL work; run again on a different machine before generalising. Each sample stores one synthetic request and its six audit events."
    sampleResults = @($sampleRows)
} | ConvertTo-Json -Depth 5
