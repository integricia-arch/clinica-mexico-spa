<#
E4: detecta drift entre migrations aplicadas en remoto (Lovable/MCP) y archivos
locales en supabase/migrations/. Falla (exit 1) si hay versiones remotas sin
archivo local — el escenario que ya pasó 2 veces (~25 migrations sin commitear).

Uso: pwsh -File scripts/check-migration-drift.ps1
Requiere: supabase CLI autenticado y linkeado al proyecto (supabase link).
#>

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$output = & supabase migration list --linked 2>&1
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host "ERROR: 'supabase migration list --linked' falló (exit $exitCode)." -ForegroundColor Red
    Write-Host ($output -join "`n")
    exit 1
}

# Formato de fila: "   LOCAL          | REMOTE         | TIME (UTC)  "
# Drift = fila con REMOTE lleno pero LOCAL vacío (aplicado en remoto sin archivo local).
$driftRows = @()

foreach ($line in $output) {
    if ($line -notmatch '^\s*\S*\s*\|\s*\S*\s*\|') { continue }
    if ($line -match '^\s*Local\s*\|\s*Remote\s*\|') { continue }  # header
    if ($line -match '^\s*-+\s*\|') { continue }                    # separator

    $parts = $line -split '\|'
    if ($parts.Count -lt 2) { continue }

    $local = $parts[0].Trim()
    $remote = $parts[1].Trim()

    if ([string]::IsNullOrWhiteSpace($local) -and -not [string]::IsNullOrWhiteSpace($remote)) {
        $driftRows += $remote
    }
}

if ($driftRows.Count -gt 0) {
    Write-Host "DRIFT: $($driftRows.Count) migración(es) aplicada(s) en remoto sin archivo local:" -ForegroundColor Yellow
    $driftRows | ForEach-Object { Write-Host "  - $_" }
    Write-Host ""
    Write-Host "Repara con: supabase migration repair --status reverted <version>" -ForegroundColor Yellow
    Write-Host "  (o crea el archivo local si el cambio debe preservarse en el repo)."
    exit 1
}

Write-Host "OK: sin drift de migraciones (remoto y local coinciden)." -ForegroundColor Green
exit 0
