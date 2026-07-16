Add-Type -Path 'C:\Users\angeline\AutomatedSb.Api\AutomatedSb.Api\bin\Debug\net8.0\Oracle.ManagedDataAccess.dll'
$cs = 'Data Source=mp12.muc.infineon.com;User Id=RPT;Password=sLwu#2v8da-rMsTU4h_s;'
$conn = New-Object Oracle.ManagedDataAccess.Client.OracleConnection($cs)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = @"
SELECT sb, loc, COUNT(*) c FROM rpt.asb_ts_actual
 WHERE horizon='26-06' AND loc IN ('ALPITRONIC EXT','KFE EXT','PERS REL','KESM','TTM','TEAMQUEST EXT','Rood T EXT')
 GROUP BY sb, loc ORDER BY sb, loc FETCH FIRST 25 ROWS ONLY
"@
$r = $cmd.ExecuteReader()
while ($r.Read()) { Write-Host "sb=$($r['sb']) | loc=$($r['loc']) | rows=$($r['c'])" }
$r.Close()
$conn.Close()
