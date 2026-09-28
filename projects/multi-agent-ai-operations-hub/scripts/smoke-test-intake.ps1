param(
    [string] $BaseUrl = "http://localhost:5680/webhook/automation-project-intake"
)

$ErrorActionPreference = "Stop"

$results = @()

function Invoke-IntakeCase {
    param(
        [Parameter(Mandatory)] [string] $Name,
        [Parameter(Mandatory)] [hashtable] $Payload,
        [Parameter(Mandatory)] [int] $ExpectedStatus,
        [Parameter(Mandatory)] [string] $ExpectedWorkflowStatus,
        [bool] $ExpectedReplay = $false
    )

    $json = $Payload | ConvertTo-Json -Depth 8
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $BaseUrl -Method Post -ContentType "application/json" -Body $json
        $actualStatus = [int]$response.StatusCode
        $body = $response.Content | ConvertFrom-Json
    }
    catch {
        if ($_.Exception.Response) {
            $actualStatus = [int]$_.Exception.Response.StatusCode
            if ($_.ErrorDetails.Message) {
                $body = $_.ErrorDetails.Message | ConvertFrom-Json
            }
            else {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = [System.IO.StreamReader]::new($stream)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
            }
        }
        else {
            throw
        }
    }

    $actualReplay = if ($null -eq $body.idempotentReplay) { $false } else { [bool]$body.idempotentReplay }
    $passed = (
        $actualStatus -eq $ExpectedStatus -and
        $body.status -eq $ExpectedWorkflowStatus -and
        $actualReplay -eq $ExpectedReplay
    )
    $script:results += [PSCustomObject]@{
        case = $Name
        expectedStatus = $ExpectedStatus
        actualStatus = $actualStatus
        workflowStatus = $body.status
        replay = $actualReplay
        requestId = $body.requestId
        auditEvents = $body.auditEventsWritten
        passed = $passed
    }

    if (-not $passed) {
        throw "Case '$Name' failed: HTTP=$actualStatus, workflowStatus=$($body.status), replay=$actualReplay."
    }

    return $body
}

$uniqueKey = "live-valid-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
$validPayload = @{
    companyName = "Example GmbH"
    contactEmail = "automation@example.invalid"
    processDescription = "Website leads are copied from email into the CRM manually and important context is sometimes lost."
    currentTools = @("Gmail", "HubSpot")
    goals = @("Prevent lost leads", "Reduce manual entry")
    constraints = @{ dataSensitivity = "personal"; requiresHumanApproval = $true }
    idempotencyKey = $uniqueKey
}

$accepted = Invoke-IntakeCase -Name "valid-request" -ExpectedStatus 202 -ExpectedWorkflowStatus "accepted" -Payload $validPayload
$duplicate = Invoke-IntakeCase -Name "duplicate-request" -ExpectedStatus 202 -ExpectedWorkflowStatus "duplicate" -ExpectedReplay $true -Payload $validPayload

if ($accepted.requestId -ne $duplicate.requestId) {
    throw "Duplicate request did not resolve to the original database requestId."
}

$null = Invoke-IntakeCase -Name "invalid-request" -ExpectedStatus 422 -ExpectedWorkflowStatus "rejected" -Payload @{
    companyName = "Example GmbH"
    contactEmail = "not-an-email"
    processDescription = "Too short"
    goals = @()
    idempotencyKey = "short"
}

$results | Format-Table -AutoSize
Write-Host "Live webhook smoke test passed: accepted, duplicate/idempotent replay, and rejected path."
