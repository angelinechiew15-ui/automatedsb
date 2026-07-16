$dll = 'C:\Users\angeline\.nuget\packages\oracle.manageddataaccess.core\2.19.210\lib\netstandard2.0\Oracle.ManagedDataAccess.dll'
Add-Type -Path $dll
$cs = 'Data Source=mp12.muc.infineon.com;User Id=RPT;Password=sLwu#2v8da-rMsTU4h_s;'

# Check for comma-decimal values (European locale e.g. "213,65")
$commaChecks = @(
    @{ Label='COST/RTU'; Sql='SELECT TSA_ID, "COST/RTU" AS v FROM rpt.asb_ts_actual WHERE INSTR("COST/RTU'','','') > 0' },
    @{ Label='RTU/TS';   Sql='SELECT TSA_ID, "RTU/TS"   AS v FROM rpt.asb_ts_actual WHERE INSTR("RTU/TS",'','')   > 0' },
    @{ Label='RTU_ACT';  Sql="SELECT TSA_ID, RTU_ACT    AS v FROM rpt.asb_ts_actual WHERE INSTR(RTU_ACT,',')  > 0" },
    @{ Label='RTU_PLAN'; Sql="SELECT TSA_ID, RTU_PLAN   AS v FROM rpt.asb_ts_actual WHERE INSTR(RTU_PLAN,',') > 0" },
    @{ Label='COST_ACT'; Sql="SELECT TSA_ID, COST_ACT   AS v FROM rpt.asb_ts_actual WHERE INSTR(COST_ACT,',') > 0" },
    @{ Label='TS_ACTUAL';Sql="SELECT TSA_ID, TS_ACTUAL  AS v FROM rpt.asb_ts_actual WHERE INSTR(TS_ACTUAL,',')> 0" },
    @{ Label='TS_DEMAND';Sql="SELECT TSA_ID, TS_DEMAND  AS v FROM rpt.asb_ts_actual WHERE INSTR(TS_DEMAND,',')> 0" },
    @{ Label='DEPRECIATION';Sql="SELECT TSA_ID, DEPRECIATION AS v FROM rpt.asb_ts_actual WHERE INSTR(DEPRECIATION,',')>0" }
)

# Also check for whitespace-only or multi-space
$wsChecks = @(
    @{ Label='COST/RTU (space)'; Sql='SELECT COUNT(*) FROM rpt.asb_ts_actual WHERE "COST/RTU" IS NOT NULL AND LENGTH(TRIM("COST/RTU")) = 0 AND LENGTH("COST/RTU") > 0' },
    @{ Label='RTU/TS (space)';   Sql='SELECT COUNT(*) FROM rpt.asb_ts_actual WHERE "RTU/TS"   IS NOT NULL AND LENGTH(TRIM("RTU/TS"))   = 0 AND LENGTH("RTU/TS")   > 0' }
)

# Check NLS session settings
$nlsConn=[Oracle.ManagedDataAccess.Client.OracleConnection]::new($cs); $nlsConn.Open()
$nlsCmd=$nlsConn.CreateCommand(); $nlsCmd.CommandText="SELECT PARAMETER, VALUE FROM NLS_SESSION_PARAMETERS WHERE PARAMETER IN ('NLS_NUMERIC_CHARACTERS','NLS_TERRITORY','NLS_LANGUAGE')"
$nlsR=$nlsCmd.ExecuteReader(); while($nlsR.Read()){ Write-Host "NLS: $($nlsR.GetString(0)) = $($nlsR.GetString(1))" }; $nlsConn.Close()

Write-Host ""

# Run comma checks
foreach ($chk in $commaChecks) {
    $conn=[Oracle.ManagedDataAccess.Client.OracleConnection]::new($cs); $conn.Open()
    $cmd=$conn.CreateCommand(); $cmd.CommandText=$chk.Sql
    try {
        $r=$cmd.ExecuteReader()
        $rows=[System.Collections.Generic.List[string]]::new()
        while($r.Read()){ $rows.Add("  ID=$($r.GetValue(0)) val='$($r.GetValue(1))'") }
        $r.Close()
        if ($rows.Count -eq 0) { Write-Host "OK  $($chk.Label) — no comma values" }
        else { Write-Host "BAD $($chk.Label) — $($rows.Count) row(s):"; $rows | ForEach-Object { Write-Host $_ } }
    } catch { Write-Host "ERR $($chk.Label): $($_.Exception.Message)" }
    $conn.Close()
}

Write-Host ""

# Whitespace checks
foreach ($chk in $wsChecks) {
    $conn=[Oracle.ManagedDataAccess.Client.OracleConnection]::new($cs); $conn.Open()
    $cmd=$conn.CreateCommand(); $cmd.CommandText=$chk.Sql
    try { $n=$cmd.ExecuteScalar(); Write-Host "$($chk.Label): $n whitespace-only rows" } catch { Write-Host "ERR $($chk.Label): $($_.Exception.Message)" }
    $conn.Close()
}
