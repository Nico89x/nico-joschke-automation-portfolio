function Import-N8nWorkflowIfMissing {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string] $WorkflowName,
        [Parameter(Mandatory)] [string] $WorkflowFile
    )

    $containerPath = "/files/workflows/$([System.IO.Path]::GetFileName($WorkflowFile))"
    $containerExportPath = "/tmp/n8n-workflow-list-$([guid]::NewGuid().ToString('N')).json"

    # Keep CLI startup output (for example, telemetry warnings) out of the JSON
    # parser by exporting to a unique file inside the container.
    docker compose exec -T n8n n8n export:workflow --all "--output=$containerExportPath" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not list existing n8n workflows; refusing to import '$WorkflowName' because that could create a duplicate."
    }

    try {
        $nameReader = "const fs=require('node:fs');const value=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const workflows=Array.isArray(value)?value:[value];if(!workflows.every(w=>w&&typeof w.name==='string'))process.exit(2);process.stdout.write(JSON.stringify(workflows.map(w=>w.name)));"
        $nameJson = docker compose exec -T n8n node -e $nameReader $containerExportPath
        if ($LASTEXITCODE -ne 0) {
            throw "Could not read the exported workflow names."
        }
        $existingNames = @($nameJson | ConvertFrom-Json -ErrorAction Stop)
    }
    catch {
        throw "Could not parse the existing n8n workflow list; refusing to import '$WorkflowName'."
    }
    finally {
        docker compose exec -T n8n rm -f -- $containerExportPath | Out-Null
    }

    $matchingWorkflows = @($existingNames | Where-Object { $_ -ceq $WorkflowName })
    if ($matchingWorkflows.Count -gt 0) {
        Write-Host "Workflow '$WorkflowName' already exists; skipping import to avoid a duplicate or overwrite."
        return
    }

    Write-Host "Importing missing workflow '$WorkflowName'..."
    docker compose exec -T n8n n8n import:workflow "--input=$containerPath"
    if ($LASTEXITCODE -ne 0) {
        throw "Import of '$WorkflowName' failed."
    }
}
