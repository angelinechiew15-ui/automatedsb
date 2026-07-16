$dll = 'C:\Users\angeline\.nuget\packages\oracle.manageddataaccess.core\2.19.210\lib\netstandard2.0\Oracle.ManagedDataAccess.dll'
Add-Type -Path $dll
$cs = 'Data Source=mp12.muc.infineon.com;User Id=RPT;Password=sLwu#2v8da-rMsTU4h_s;'

$checks = @(
    @{ Label='COST/RTU';     Sql=@'
SELECT TSA_ID, "COST/RTU" AS bad_val FROM rpt.asb_ts_actual
WHERE "COST/RTU" IS NOT NULL
  AND TRIM("COST/RTU") != ''
  AND NOT REGEXP_LIKE(TRIM("COST/RTU"), '^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$')
'@ },
    @{ Label='RTU/TS';      Sql=@'
SELECT TSA_ID, "RTU/TS" AS bad_val FROM rpt.asb_ts_actual
WHERE "RTU/TS" IS NOT NULL
  AND TRIM("RTU/TS") != ''
  AND NOT REGEXP_LIKE(TRIM("RTU/TS"), '^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$')
'@ },
    @{ Label='RTU_ACT';     Sql=@'
SELECT TSA_ID, RTU_ACT AS bad_val FROM rpt.asb_ts_actual
WHERE RTU_ACT IS NOT NULL
  AND TRIM(RTU_ACT) != ''
  AND NOT REGEXP_LIKE(TRIM(RTU_ACT), '^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$')
'@ },
    @{ Label='RTU_PLAN';    Sql=@'
SELECT TSA_ID, RTU_PLAN AS bad_val FROM rpt.asb_ts_actual
WHERE RTU_PLAN IS NOT NULL
  AND TRIM(RTU_PLAN) != ''
  AND NOT REGEXP_LIKE(TRIM(RTU_PLAN), '^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$')
'@ },
    @{ Label='COST_ACT';    Sql=@'
SELECT TSA_ID, COST_ACT AS bad_val FROM rpt.asb_ts_actual
WHERE COST_ACT IS NOT NULL
  AND TRIM(COST_ACT) != ''
  AND NOT REGEXP_LIKE(TRIM(COST_ACT), '^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$')
'@ },
    @{ Label='TS_ACTUAL';   Sql=@'
SELECT TSA_ID, TS_ACTUAL AS bad_val FROM rpt.asb_ts_actual
WHERE TS_ACTUAL IS NOT NULL
  AND TRIM(TS_ACTUAL) != ''
  AND NOT REGEXP_LIKE(TRIM(TS_ACTUAL), '^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$')
'@ },
    @{ Label='TS_DEMAND';   Sql=@'
SELECT TSA_ID, TS_DEMAND AS bad_val FROM rpt.asb_ts_actual
WHERE TS_DEMAND IS NOT NULL
  AND TRIM(TS_DEMAND) != ''
  AND NOT REGEXP_LIKE(TRIM(TS_DEMAND), '^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$')
'@ },
    @{ Label='DEPRECIATION'; Sql=@'
SELECT TSA_ID, DEPRECIATION AS bad_val FROM rpt.asb_ts_actual
WHERE DEPRECIATION IS NOT NULL
  AND TRIM(DEPRECIATION) != ''
  AND NOT REGEXP_LIKE(TRIM(DEPRECIATION), '^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$')
'@ },
    @{ Label='ADDER_VALUE'; Sql=@'
SELECT CM_MATRIX_ADDER_ID, CM_MATRIX_ADDER_VALUE AS bad_val FROM rpt.cm_matrix_sb_adder
WHERE CM_MATRIX_ADDER_VALUE IS NOT NULL
  AND TRIM(CM_MATRIX_ADDER_VALUE) != ''
  AND NOT REGEXP_LIKE(TRIM(CM_MATRIX_ADDER_VALUE), '^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$')
'@ }
)

foreach ($chk in $checks) {
    $conn = [Oracle.ManagedDataAccess.Client.OracleConnection]::new($cs)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $chk.Sql
    try {
        $r = $cmd.ExecuteReader()
        $rows = [System.Collections.Generic.List[string]]::new()
        while ($r.Read()) {
            $rows.Add("  ID=$($r.GetValue(0))  val='$($r.GetValue(1))'")
        }
        $r.Close()
        if ($rows.Count -eq 0) {
            Write-Host "OK  $($chk.Label) — no bad rows"
        } else {
            Write-Host "BAD $($chk.Label) — $($rows.Count) bad row(s):"
            $rows | ForEach-Object { Write-Host $_ }
        }
    } catch {
        Write-Host "ERR $($chk.Label) : $($_.Exception.Message)"
    }
    $conn.Close()
}
