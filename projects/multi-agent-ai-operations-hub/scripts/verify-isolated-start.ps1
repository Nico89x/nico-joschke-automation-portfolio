param(
    [int]$N8nPort = 15680,
    [int]$PostgresPort = 15432,
    [string]$ReuseProjectName = '',
    [switch]$ImportWorkflow09
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$isFreshProject = [string]::IsNullOrWhiteSpace($ReuseProjectName)
$projectName = if ($isFreshProject) { 'hubcheck' + [guid]::NewGuid().ToString('N').Substring(0, 10) } else { $ReuseProjectName }
$oldN8nPort = $env:N8N_PORT
$oldPostgresPort = $env:POSTGRES_PORT
$started = $false

if ($N8nPort -lt 1024 -or $N8nPort -gt 65535 -or $PostgresPort -lt 1024 -or $PostgresPort -gt 65535 -or $N8nPort -eq $PostgresPort) {
    throw 'Choose two distinct, non-privileged TCP ports.'
}
if ($projectName -notmatch '^hubcheck[a-f0-9]{10}$') {
    throw 'ReuseProjectName must be the exact hubcheck project name printed by an earlier run.'
}

Set-Location -LiteralPath $projectRoot

try {
    foreach ($port in @($N8nPort, $PostgresPort)) {
        if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
            throw "Local TCP port $port is already in use. Nothing was started."
        }
    }

    $env:N8N_PORT = [string]$N8nPort
    $env:POSTGRES_PORT = [string]$PostgresPort

    docker compose --project-name $projectName config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Compose configuration failed.' }

    if ($isFreshProject) {
        Write-Host "Starting a separate project with fresh volumes: $projectName"
    } else {
        Write-Host "Restarting the existing isolated check project without creating another volume set: $projectName"
    }
    docker compose --project-name $projectName up -d --wait --wait-timeout 300
    $started = $true
    if ($LASTEXITCODE -ne 0) { throw 'The isolated stack did not become healthy.' }

    $health = Invoke-WebRequest -Uri "http://127.0.0.1:$N8nPort/healthz" -TimeoutSec 10 -UseBasicParsing
    if ($health.StatusCode -ne 200) { throw "n8n returned HTTP $($health.StatusCode)." }

    $rows = @(docker compose --project-name $projectName ps --format json | ConvertFrom-Json)
    if ($rows.Count -lt 2 -or @($rows | Where-Object { $_.Health -ne 'healthy' }).Count -gt 0) {
        throw 'Not all isolated services report healthy.'
    }

    if ($isFreshProject) {
        Write-Host 'PASS: Fresh PostgreSQL and n8n volumes started; both services are healthy; n8n /healthz returned HTTP 200.'
    } else {
        Write-Host 'PASS: Isolated PostgreSQL and n8n services are healthy; n8n /healthz returned HTTP 200. The fresh volumes were created in the earlier run.'
    }

    if ($ImportWorkflow09) {
        $workflowFile = '09-local-ollama-interpretation-receipt.json'
        $workflowName = '09 - Local Ollama Interpretation Receipt'
        $workflowId = 'a7be0a9e-4f45-4f86-a02b-2b001209d909'
        $containerExportPath = "/tmp/n8n-workflow-import-check-$([guid]::NewGuid().ToString('N')).json"

        docker compose --project-name $projectName exec -T n8n n8n import:workflow "--input=/files/workflows/$workflowFile"
        if ($LASTEXITCODE -ne 0) { throw "Workflow '$workflowName' did not import into the isolated stack." }

        try {
            docker compose --project-name $projectName exec -T n8n n8n export:workflow --all "--output=$containerExportPath" | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not export isolated workflows for verification.' }

            $verifyWorkflow = "const fs=require('node:fs');const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const workflows=Array.isArray(data)?data:[data];const matches=workflows.filter(w=>w.name==='$workflowName'&&w.id==='$workflowId');if(matches.length!==1)process.exit(2);process.stdout.write(JSON.stringify({name:matches[0].name,id:matches[0].id,active:matches[0].active===true}));"
            $verificationJson = docker compose --project-name $projectName exec -T n8n node -e $verifyWorkflow $containerExportPath
            if ($LASTEXITCODE -ne 0) { throw "Could not verify the imported '$workflowName' workflow." }
            $verification = $verificationJson | ConvertFrom-Json -ErrorAction Stop
            if ($verification.name -cne $workflowName -or $verification.id -cne $workflowId -or $verification.active) {
                throw "Isolated import did not preserve the expected workflow identity and inactive state."
            }
            Write-Host "PASS: '$workflowName' imported on the fresh isolated stack and remains inactive. No credentials were imported and no webhook was activated."
        }
        finally {
            docker compose --project-name $projectName exec -T n8n rm -f -- $containerExportPath | Out-Null
        }
    } else {
        Write-Host 'This verifies a clean stack boot, not workflow imports, credentials, published webhooks, or the full live smoke test. Use -ImportWorkflow09 to verify a fresh CLI import.'
    }
}
finally {
    if ($started) {
        Write-Host "Stopping only the isolated project $projectName (no volumes are removed)."
        docker compose --project-name $projectName stop
    }
    $env:N8N_PORT = $oldN8nPort
    $env:POSTGRES_PORT = $oldPostgresPort
    Write-Host "Isolated project name: $projectName. Its fresh volumes are preserved for inspection; the normal project was not stopped."
}
