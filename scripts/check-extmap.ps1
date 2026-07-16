Add-Type -Path 'C:\Users\angeline\AutomatedSb.Api\AutomatedSb.Api\bin\Debug\net8.0\Oracle.ManagedDataAccess.dll'
$conn = New-Object Oracle.ManagedDataAccess.Client.OracleConnection('Data Source=mp12.muc.infineon.com;User Id=RPT;Password=sLwu#2v8da-rMsTU4h_s;')
$conn.Open()

function Q($sql) {
  $cmd = $conn.CreateCommand(); $cmd.CommandText = $sql
  $r = $cmd.ExecuteReader()
  while ($r.Read()) {
    $vals = for ($i=0; $i -lt $r.FieldCount; $i++) { $r.GetValue($i) }
    ($vals -join ' | ')
  }
  $r.Close()
}

"--- distinct raw locs for ATV MC (PL22_33) horizon 26-06 ---"
Q "SELECT DISTINCT loc FROM rpt.asb_ts_actual WHERE sb='ATV MC (PL22_33)' AND horizon='26-06' ORDER BY loc"

"`n--- ext mapping rows where ext_loc is one of those raw locs ---"
Q "SELECT cm_matrix_sb_ext_mapping_ext_loc, cm_matrix_sb_ext_mapping_rpt_loc, cm_matrix_sb_ext_for_ts, cm_matrix_sb_ext_for_rtu FROM rpt.cm_matrix_sb_ext_mapping WHERE cm_matrix_sb_ext_mapping_ext_loc IN (SELECT DISTINCT loc FROM rpt.asb_ts_actual WHERE sb='ATV MC (PL22_33)' AND horizon='26-06') ORDER BY cm_matrix_sb_ext_mapping_ext_loc"

$conn.Close()
