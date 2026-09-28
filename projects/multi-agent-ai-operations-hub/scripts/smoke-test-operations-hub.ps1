param(
    [string] $BaseUrl = "http://localhost:5680",
    [int] $TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
$webhookBase = "$($BaseUrl.TrimEnd('/'))/webhook"
$runKey = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmssfff")

function Invoke-JsonWebhook {
    param(
        [Parameter(Mandatory)] [string] $Uri,
        [Parameter(Mandatory)] [hashtable] $Body,
        [Parameter(Mandatory)] [int] $ExpectedStatus,
        [int] $RequestTimeoutSeconds = 30
    )

    $json = $Body | ConvertTo-Json -Depth 10
    $request = @{
        UseBasicParsing = $true
        Uri = $Uri
        Method = "Post"
        ContentType = "application/json"
        Body = $json
        TimeoutSec = $RequestTimeoutSeconds
    }

    try {
        $response = Invoke-WebRequest @request
        $statusCode = [int] $response.StatusCode
        $content = [string] $response.Content
    }
    catch {
        if (-not $_.Exception.Response) { throw }
        $statusCode = [int] $_.Exception.Response.StatusCode
        $content = [string] $_.ErrorDetails.Message
        if ([string]::IsNullOrWhiteSpace($content)) {
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() }
        }
    }

    if ($statusCode -ne $ExpectedStatus) {
        throw "Expected HTTP $ExpectedStatus from $Uri, received HTTP $statusCode. Response: $content"
    }
    if ([string]::IsNullOrWhiteSpace($content)) {
        throw "The endpoint $Uri returned an empty response."
    }

    return [PSCustomObject]@{
        StatusCode = $statusCode
        Body = ($content | ConvertFrom-Json)
    }
}

function New-SyntheticIntake {
    param([string] $Key)
    return @{
        companyName = "Synthetic Smoke Test GmbH"
        contactName = "Synthetic Contact"
        contactEmail = "synthetic@example.test"
        processDescription = "Synthetic website inquiries are copied manually into a CRM. Validate required fields, prevent duplicate leads, and prepare a reviewable automation proposal."
        currentTools = @("HubSpot", "n8n")
        goals = @("Reduce manual entry", "Prevent duplicate records")
        constraints = @{
            dataSensitivity = "personal"
            requiresHumanApproval = $true
        }
        idempotencyKey = $Key
    }
}

function Assert-Equal {
    param([object] $Actual, [object] $Expected, [string] $Message)
    if ($Actual -ne $Expected) {
        throw "$Message Expected '$Expected', got '$Actual'."
    }
}

Write-Host "Checking local Operations Hub endpoints at $webhookBase ..."
$health = Invoke-WebRequest -UseBasicParsing -Uri "$($BaseUrl.TrimEnd('/'))/healthz" -TimeoutSec 5
if ([int] $health.StatusCode -ne 200) { throw "n8n health check did not return HTTP 200." }

$approvalIntake = New-SyntheticIntake -Key "smoke-approve-$runKey"
$plan = Invoke-JsonWebhook -Uri "$webhookBase/operations-hub" -Body $approvalIntake -ExpectedStatus 202 -RequestTimeoutSeconds $TimeoutSeconds
Assert-Equal $plan.Body.status "awaiting-human-review" "Valid intake must stop at human review."
Assert-Equal $plan.Body.executionGate $false "Execution gate must remain closed."
Assert-Equal $plan.Body.auditEventsWritten 6 "Planning must write six stage audit events."
if ([string]::IsNullOrWhiteSpace([string] $plan.Body.requestDbId)) { throw "Planning response has no database request ID." }
Write-Host "[PASS] valid intake -> HTTP 202; six stage audits; execution gate closed"

$duplicate = Invoke-JsonWebhook -Uri "$webhookBase/operations-hub" -Body $approvalIntake -ExpectedStatus 200
Assert-Equal $duplicate.Body.status "duplicate" "Repeated idempotency key must return duplicate."
Assert-Equal $duplicate.Body.requestDbId $plan.Body.requestDbId "Duplicate must point to the original request."
Write-Host "[PASS] repeated idempotency key -> HTTP 200 duplicate; no second plan"

$approval = @{
    requestDbId = $plan.Body.requestDbId
    decision = "approved"
    reviewer = "Synthetic Reviewer"
    revisionNotes = "Approved for local synthetic smoke test only"
}
$approved = Invoke-JsonWebhook -Uri "$webhookBase/operations-hub-review" -Body $approval -ExpectedStatus 200
Assert-Equal $approved.Body.status "approved-local-draft-prepared" "Approval must prepare only the local draft proposal."
Assert-Equal $approved.Body.executionGate $false "Approval must not open external execution."
Assert-Equal $approved.Body.localDemo.externalActions.crmWrites 0 "Approval must not write to a CRM."
Assert-Equal $approved.Body.localDemo.externalActions.tasksCreated 0 "Approval must not create tasks."
Assert-Equal $approved.Body.localDemo.externalActions.messagesSent 0 "Approval must not send messages."
Write-Host "[PASS] explicit approval -> local proposal only; zero external actions"

$replay = Invoke-JsonWebhook -Uri "$webhookBase/operations-hub-review" -Body $approval -ExpectedStatus 409
Assert-Equal $replay.Body.status "not-found-or-already-reviewed" "Repeated review must be rejected as a conflict."
Assert-Equal $replay.Body.auditEventsWritten 0 "Repeated review must not create another audit event."
Write-Host "[PASS] repeated review -> HTTP 409; no new audit or draft"

$invalidIntake = @{
    companyName = "X"
    processDescription = "short"
    currentTools = @()
    goals = @()
    constraints = @{ dataSensitivity = "internal" }
    idempotencyKey = "smoke-invalid-$runKey"
}
$invalid = Invoke-JsonWebhook -Uri "$webhookBase/operations-hub" -Body $invalidIntake -ExpectedStatus 422
if (@($invalid.Body.errors).Count -lt 1) { throw "Invalid intake did not return validation errors." }
Write-Host "[PASS] invalid intake -> HTTP 422 before planning"

$rejectionIntake = New-SyntheticIntake -Key "smoke-reject-$runKey"
$rejectionPlan = Invoke-JsonWebhook -Uri "$webhookBase/operations-hub" -Body $rejectionIntake -ExpectedStatus 202 -RequestTimeoutSeconds $TimeoutSeconds
$rejection = @{
    requestDbId = $rejectionPlan.Body.requestDbId
    decision = "rejected"
    reviewer = "Synthetic Reviewer"
    revisionNotes = "Synthetic rejection-path smoke test"
}
$rejected = Invoke-JsonWebhook -Uri "$webhookBase/operations-hub-review" -Body $rejection -ExpectedStatus 200
Assert-Equal $rejected.Body.status "rejected-blocked" "Rejection must keep the plan blocked."
Assert-Equal $rejected.Body.localDemo.proposal $null "Rejection must not prepare a proposal."
Assert-Equal $rejected.Body.executionGate $false "Rejection must keep execution closed."
Assert-Equal $rejected.Body.auditEventsWritten 1 "Rejection must write one decision audit event."
Write-Host "[PASS] explicit rejection -> blocked; one audit event; no proposal"

Write-Host "Operations Hub smoke tests passed. All records were synthetic and all external action counts remained zero."
