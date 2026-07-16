Add-Type -Path 'C:\Users\angeline\AutomatedSb.Api\AutomatedSb.Api\bin\Debug\net8.0\Oracle.ManagedDataAccess.dll'
$cs = 'Data Source=mp12.muc.infineon.com;User Id=RPT;Password=sLwu#2v8da-rMsTU4h_s;'
$conn = New-Object Oracle.ManagedDataAccess.Client.OracleConnection($cs)
$conn.Open()

function RunQ($title, $sql) {
    Write-Host "==== $title ===="
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $sql
    $r = $cmd.ExecuteReader()
    while ($r.Read()) {
        $vals = @()
        for ($i = 0; $i -lt $r.FieldCount; $i++) { $vals += "$($r.GetName($i))=$($r.GetValue($i))" }
        Write-Host ($vals -join ' | ')
    }
    $r.Close()
    Write-Host ''
}

RunQ 'Distinct MUC-ish locations in asb_ts_actual (horizon 26-06)' @"
SELECT DISTINCT loc FROM rpt.asb_ts_actual
 WHERE horizon = '26-06' AND (UPPER(loc) LIKE 'RPT MUC%' OR UPPER(loc) LIKE 'RPT VI%')
 ORDER BY loc
"@

RunQ 'ext_mapping rows (for_ts/for_rtu)' @"
SELECT cm_matrix_sb_ext_mapping_ext_loc AS ext_loc,
       cm_matrix_sb_ext_mapping_rpt_loc AS rpt_loc,
       cm_matrix_sb_ext_for_ts AS for_ts,
       cm_matrix_sb_ext_for_rtu AS for_rtu
  FROM rpt.cm_matrix_sb_ext_mapping
 ORDER BY rpt_loc, ext_loc
"@

RunQ 'Distinct raw locations NOT starting with RPT/ASE (horizon 26-06)' @"
SELECT DISTINCT loc FROM rpt.asb_ts_actual
 WHERE horizon = '26-06' AND loc IS NOT NULL
   AND loc NOT LIKE 'RPT %' AND loc NOT LIKE 'ASE %'
 ORDER BY loc
"@

$conn.Close()
