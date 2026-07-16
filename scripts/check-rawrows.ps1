Add-Type -Path 'C:\Users\angeline\AutomatedSb.Api\AutomatedSb.Api\bin\Debug\net8.0\Oracle.ManagedDataAccess.dll'
$conn = New-Object Oracle.ManagedDataAccess.Client.OracleConnection('Data Source=mp12.muc.infineon.com;User Id=RPT;Password=sLwu#2v8da-rMsTU4h_s;')
$conn.Open()
function Q($sql) {
  $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql
  $r = $cmd.ExecuteReader()
  $names = for ($i=0;$i -lt $r.FieldCount;$i++){ $r.GetName($i) }
  ($names -join ' | ')
  while ($r.Read()) {
    $vals = for ($i=0; $i -lt $r.FieldCount; $i++) { if($r.IsDBNull($i)){'<null>'}else{$r.GetValue($i)} }
    ($vals -join ' | ')
  }
  $r.Close()
}
"=== RPT BKK (lab shows null) ==="
Q "SELECT fy, quarter, ts_demand, ""RTU/TS"", ""COST/RTU"", depreciation FROM rpt.asb_ts_actual WHERE sb='ATV MC (PL22_33)' AND horizon='26-06' AND loc='RPT BKK' ORDER BY fy, quarter"
"`n=== RPT SIN (lab shows value) ==="
Q "SELECT fy, quarter, ts_demand, ""RTU/TS"", ""COST/RTU"", depreciation FROM rpt.asb_ts_actual WHERE sb='ATV MC (PL22_33)' AND horizon='26-06' AND loc='RPT SIN' ORDER BY fy, quarter"
$conn.Close()
