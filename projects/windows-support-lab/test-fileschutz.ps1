#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
    throw 'This lab requires Windows and a local NTFS temporary directory.'
}

$fixtureDirectory = Join-Path ([IO.Path]::GetTempPath()) ('support-lab-' + [Guid]::NewGuid().ToString('N'))
$fixtureFile = Join-Path $fixtureDirectory 'uebergabe.txt'
$null = New-Item -ItemType Directory -Path $fixtureDirectory
try {
    [IO.File]::WriteAllText($fixtureFile, 'baseline')
    $originalAttributes = [IO.File]::GetAttributes($fixtureFile)
    [IO.File]::SetAttributes($fixtureFile, $originalAttributes -bor [IO.FileAttributes]::ReadOnly)
    try {
        if ([IO.File]::ReadAllText($fixtureFile) -ne 'baseline') {
            throw 'LAB-01 expected the file to remain readable.'
        }
        $writeDenied = $false
        try {
            $stream = [IO.File]::Open($fixtureFile, [IO.FileMode]::Open, [IO.FileAccess]::Write)
            $stream.Dispose()
        } catch {
            if ($_.Exception.GetBaseException() -isnot [UnauthorizedAccessException]) { throw }
            $writeDenied = $true
        }
        if (!$writeDenied) { throw 'LAB-01 expected Windows to deny the write.' }
    } finally {
        [IO.File]::SetAttributes($fixtureFile, $originalAttributes)
    }
    [IO.File]::WriteAllText($fixtureFile, 'write restored')
    if ([IO.File]::ReadAllText($fixtureFile) -ne 'write restored') {
        throw 'LAB-01 expected the write to succeed after recovery.'
    }
    [pscustomobject]@{
        case = 'LAB-01'
        readDuringIncident = $true
        writeDenied = $writeDenied
        writeRestored = $true
    } | ConvertTo-Json -Compress
} finally {
    if (Test-Path -LiteralPath $fixtureFile) { Remove-Item -LiteralPath $fixtureFile }
    if (Test-Path -LiteralPath $fixtureDirectory) { Remove-Item -LiteralPath $fixtureDirectory }
}
