Add-Type -Path 'C:\Users\angeline\AutomatedSb.Api\AutomatedSb.Api\bin\Debug\net8.0\Oracle.ManagedDataAccess.dll'
$cs = 'Data Source=mp12.muc.infineon.com;User Id=RPT;Password=sLwu#2v8da-rMsTU4h_s;'
$conn = New-Object Oracle.ManagedDataAccess.Client.OracleConnection($cs)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT cm_matrix_sb_id id FROM rpt.cm_matrix_sb WHERE cm_matrix_sb_name = 'ATV HV (PL34)'"
$sbId = $cmd.ExecuteScalar()
$conn.Close()
Write-Host "ATV HV (PL34) sbId = $sbId"

$horizon = '26-06'
$sbName = 'ATV HV (PL34)'
$lab = Invoke-RestMethod "http://localhost:8080/api/lab-cost/qtr-avg?horizon=$horizon"

function SbAnnual($sbId, $loc) {
    $c = Invoke-RestMethod "http://localhost:8080/api/service-bundle/charts?sbId=$sbId&horizon=$horizon&loc=$([uri]::EscapeDataString($loc))"
    $byFy = @{}
    foreach ($p in $c.costDemand) {
        $fy = ($p.label -split ' ')[0]      # "25/26 Q1" -> "25/26"
        $hasQ = $p.label -match 'Q\d'
        if (-not $byFy.ContainsKey($fy)) { $byFy[$fy] = @{ sum = 0.0; q = $false } }
        $byFy[$fy].sum += [double]$p.value
        if ($hasQ) { $byFy[$fy].q = $true }
    }
    $out = @{}
    foreach ($fy in $byFy.Keys) {
        $out[$fy] = if ($byFy[$fy].q) { $byFy[$fy].sum } else { $byFy[$fy].sum * 4 }
    }
    return $out
}

foreach ($loc in @('RPT WAR','RPT MEL')) {
    Write-Host "`n==== $loc ===="
    $sbAnnual = SbAnnual $sbId $loc
    $labRows = $lab | Where-Object { $_.sb -eq $sbName -and $_.location -eq $loc }
    $fys = @($sbAnnual.Keys + ($labRows | Select-Object -Expand fy)) | Sort-Object -Unique
    foreach ($fy in $fys) {
        $sbv = if ($sbAnnual.ContainsKey($fy)) { [math]::Round($sbAnnual[$fy], 1) } else { $null }
        $labv = ($labRows | Where-Object { $_.fy -eq $fy }).value
        if ($labv -ne $null) { $labv = [math]::Round([double]$labv, 1) }
        $match = if ([math]::Abs(([double]$sbv) - ([double]$labv)) -lt 1) { 'OK' } else { 'MISMATCH' }
        Write-Host ("  fy={0,-6} SB={1,-10} Lab={2,-10} {3}" -f $fy, $sbv, $labv, $match)
    }
}
