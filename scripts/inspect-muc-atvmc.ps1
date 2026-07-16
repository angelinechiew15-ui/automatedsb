Add-Type -Path 'C:\Users\angeline\AutomatedSb.Api\AutomatedSb.Api\bin\Debug\net8.0\Oracle.ManagedDataAccess.dll'
$cs = 'Data Source=mp12.muc.infineon.com;User Id=RPT;Password=sLwu#2v8da-rMsTU4h_s;'
$conn = New-Object Oracle.ManagedDataAccess.Client.OracleConnection($cs)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = 'SELECT loc, fy, quarter, ts_demand, "RTU/TS", "COST/RTU", depreciation FROM rpt.asb_ts_actual WHERE sb = ''ATV MC (PL22_33)'' AND horizon = ''26-06'' AND loc LIKE ''RPT MUC%'' ORDER BY loc, fy, quarter'
$r = $cmd.ExecuteReader()
while($r.Read()){
    $loc=$r.GetValue(0); $fy=$r.GetValue(1); $q=$r.GetValue(2); $ts=$r.GetValue(3); $rtuts=$r.GetValue(4); $cost=$r.GetValue(5); $dep=$r.GetValue(6);
    Write-Host "loc=$loc | fy=$fy | q=$q | ts=$ts | RTU/TS=$rtuts | COST/RTU=$cost | depreciation=$dep"
}
$r.Close(); $conn.Close()