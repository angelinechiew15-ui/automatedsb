$url = "http://localhost:8080/api/lab-summary?horizon=26-06"
$response = Invoke-RestMethod -Uri $url -Method Get

Write-Output "==== RPT CENTRAL 24/25 rows with adderRtu near 55.8 or null rtuRfcDemand ===="
$rows = $response | Where-Object { $_.location -eq "RPT CENTRAL" -and $_.fyQuarter -eq "24/25" }
Write-Output "Total RPT CENTRAL 24/25 rows: $(($rows | Measure-Object).Count)"
Write-Output ""

$rows | Where-Object { $_.adderRtu -ne 0 -or $_.rtuRfcDemand -eq $null } | ForEach-Object {
    Write-Output ("sb={0}" -f $_.sb)
    Write-Output ("   tsDemand={0} adderTs={1} rtuTs={2} adderRtu={3}" -f $_.tsDemand, $_.adderTs, $_.rtuTs, $_.adderRtu)
    Write-Output ("   rtuRfcDemand={0}  rtuRfcDemandWoAdder={1}" -f $_.rtuRfcDemand, $_.rtuRfcDemandWoAdder)
    Write-Output ("   costRtu={0} costRfcWoDepr={1} costRfcDemand={2}" -f $_.costRtu, $_.costRfcWoDepr, $_.costRfcDemand)
    Write-Output ""
}
