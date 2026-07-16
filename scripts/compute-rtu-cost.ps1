Add-Type -Path 'C:\Users\angeline\AutomatedSb.Api\AutomatedSb.Api\bin\Debug\net8.0\Oracle.ManagedDataAccess.dll'
$cs = 'Data Source=mp12.muc.infineon.com;User Id=RPT;Password=sLwu#2v8da-rMsTU4h_s;'
$conn = New-Object Oracle.ManagedDataAccess.Client.OracleConnection($cs)
$conn.Open()
$cmdNls = $conn.CreateCommand()
$cmdNls.CommandText = "ALTER SESSION SET NLS_NUMERIC_CHARACTERS = ',.'"
$cmdNls.ExecuteNonQuery() | Out-Null
$sb='ATV MC (PL22_33)'; $h='26-06'; $loc='RPT MUC ESD'
$sql = @"
SELECT CASE WHEN t.quarter IS NULL THEN t.fy ELSE t.fy || ' ' || t.quarter END AS label,
       SUM(TO_NUMBER(t.ts_demand DEFAULT 0 ON CONVERSION ERROR)) AS sum_ts,
       SUM(NVL(TO_NUMBER(ats.cm_matrix_adder_value DEFAULT 0 ON CONVERSION ERROR),0)) AS sum_ts_adder,
       SUM(CAST(CASE WHEN cm_change.cm_matrix_change_value IS NOT NULL THEN TO_NUMBER(cm_change.cm_matrix_change_value DEFAULT 0 ON CONVERSION ERROR) ELSE TO_NUMBER(t."RTU/TS" DEFAULT 0 ON CONVERSION ERROR) END AS BINARY_DOUBLE)) AS sum_eff_rtuts,
       SUM(NVL(TO_NUMBER(artu.cm_matrix_adder_value DEFAULT 0 ON CONVERSION ERROR),0)) AS sum_rtu_adder,
       SUM(TO_NUMBER(t."COST/RTU" DEFAULT 0 ON CONVERSION ERROR)) AS sum_costrtu,
       SUM(TO_NUMBER(t.depreciation DEFAULT 0 ON CONVERSION ERROR)) AS sum_dep,
       SUM(NVL(TO_NUMBER(ac.cm_matrix_adder_value DEFAULT 0 ON CONVERSION ERROR),0)) AS sum_cost_adder
FROM rpt.asb_ts_actual t
LEFT JOIN rpt.cm_matrix_sb_change_mappedvalue cm_change ON t.sb=cm_change.cm_matrix_change_sb_name AND t.loc=cm_change.cm_matrix_change_location AND t.horizon=cm_change.cm_matrix_change_horizon AND t.fy=cm_change.cm_matrix_change_fy
LEFT JOIN rpt.cm_matrix_sb_adder ats ON t.loc = ats.cm_matrix_adder_location AND t.sb = ats.cm_matrix_adder_sb_name AND t.fy || '-' || t.quarter = ats.cm_matrix_adder_fy || '-' || ats.cm_matrix_adder_quarter AND t.horizon = ats.cm_matrix_adder_horizon AND ats.cm_matrix_adder_type='Adder' AND ats.cm_matrix_adder_for='TS'
LEFT JOIN rpt.cm_matrix_sb_adder artu ON t.loc = artu.cm_matrix_adder_location AND t.sb = artu.cm_matrix_adder_sb_name AND t.fy || '-' || t.quarter = artu.cm_matrix_adder_fy || '-' || artu.cm_matrix_adder_quarter AND t.horizon = artu.cm_matrix_adder_horizon AND artu.cm_matrix_adder_type='Adder' AND artu.cm_matrix_adder_for='RTU'
LEFT JOIN rpt.cm_matrix_sb_adder ac ON t.loc = ac.cm_matrix_adder_location AND t.sb = ac.cm_matrix_adder_sb_name AND t.fy || '-' || t.quarter = ac.cm_matrix_adder_fy || '-' || ac.cm_matrix_adder_quarter AND t.horizon = ac.cm_matrix_adder_horizon AND ac.cm_matrix_adder_type='Adder' AND ac.cm_matrix_adder_for='COST'
WHERE t.sb = :sb AND t.horizon = :h AND t.loc = :loc
GROUP BY CASE WHEN t.quarter IS NULL THEN t.fy ELSE t.fy || ' ' || t.quarter END
ORDER BY label
"@
$cmd=$conn.CreateCommand(); $cmd.CommandText = $sql; $cmd.Parameters.Add((New-Object Oracle.ManagedDataAccess.Client.OracleParameter('sb',$sb))); $cmd.Parameters.Add((New-Object Oracle.ManagedDataAccess.Client.OracleParameter('h',$h))); $cmd.Parameters.Add((New-Object Oracle.ManagedDataAccess.Client.OracleParameter('loc',$loc)));
$r=$cmd.ExecuteReader(); Write-Host "label,sum_ts,sum_ts_adder,sum_eff_rtuts,sum_rtu_adder,sum_costrtu,sum_dep,sum_cost_adder,rtu_rfc,rfc_wo,final_cost";
while($r.Read()){
    $label = $r['label']
    function ToDecimal($v){ if ($v -eq $null -or $v -is [System.DBNull]) { return 0.0 } $s = $v.ToString() -replace ',','.'; return [decimal]::Parse($s, [globalization.cultureinfo]::InvariantCulture) }
    $sum_ts = ToDecimal $r['sum_ts']
    $sum_ts_adder = ToDecimal $r['sum_ts_adder']
    $sum_eff_rtuts = ToDecimal $r['sum_eff_rtuts']
    $sum_rtu_adder = ToDecimal $r['sum_rtu_adder']
    $sum_costrtu = ToDecimal $r['sum_costrtu']
    $sum_dep = ToDecimal $r['sum_dep']
    $sum_cost_adder = ToDecimal $r['sum_cost_adder']
    $rtu_rfc = 0.0
    if ($sum_eff_rtuts -ne 0) { $rtu_rfc = (($sum_ts + $sum_ts_adder) * $sum_eff_rtuts * 3) + $sum_rtu_adder }
    $rfc_wo = $rtu_rfc * $sum_costrtu / 1000
    $final = $rfc_wo + $sum_dep + $sum_cost_adder
    Write-Host "$label,$sum_ts,$sum_ts_adder,$sum_eff_rtuts,$sum_rtu_adder,$sum_costrtu,$sum_dep,$sum_cost_adder,$rtu_rfc,$rfc_wo,$final"
}
$r.Close(); $conn.Close()