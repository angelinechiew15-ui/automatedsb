$url = "http://localhost:8080/api/lab-summary?horizon=26-06"
Write-Output "Fetching Lab Summary data..."
$response = Invoke-RestMethod -Uri $url -Method Get
$aisSpRow = $response | Where-Object { $_.sb -eq "AIS SP" -and $_.location -eq "RPT MEL" -and $_.fy_quarter -eq "24/25" }
if ($aisSpRow) {
    Write-Output "==== AIS SP @ RPT MEL 24/25 (annual) ===="
    Write-Output "fy_quarter: $($aisSpRow.fy_quarter)"
    Write-Output "location: $($aisSpRow.location)"
    Write-Output "sb: $($aisSpRow.sb)"
    Write-Output "adder_rtu: $($aisSpRow.adderRtu) (should be 9.2)"
    Write-Output "adder_ts: $($aisSpRow.adderTs)"
    Write-Output "adder_cost: $($aisSpRow.adderCost) (should be 0)"
    Write-Output "rtu_rfc_demand: $($aisSpRow.rtuRfcDemand)"
    Write-Output "rtu_rfc_demand_wo_adder: $($aisSpRow.rtuRfcDemandWoAdder)"
    Write-Output "cost_rfc_demand: $($aisSpRow.costRfcDemand)"
    Write-Output "cost_rfc_demand_wo_adder: $($aisSpRow.costRfcDemandWoAdder)"
} else {
    Write-Output "Row not found. Checking nearby records:"
    $nearbyRows = $response | Where-Object { $_.sb -eq "AIS SP" -and $_.location -eq "RPT MEL" } | Select-Object -First 5
    $nearbyRows | Format-Table -AutoSize | Out-String | Write-Output
}

# Also verify one quarterly entry still works (should have matching quarterly adder)
Write-Output ""
$atvMelQ1 = $response | Where-Object { $_.sb -eq "ATV HV (PL34)" -and $_.location -eq "RPT MEL" -and $_.fy_quarter -eq "25/26 Q1" }
if ($atvMelQ1) {
    Write-Output "==== ATV HV @ RPT MEL 25/26 Q1 (sanity check quarterly) ===="
    Write-Output "fy_quarter: $($atvMelQ1.fy_quarter)"
    Write-Output "rtu_rfc_demand: $($atvMelQ1.rtuRfcDemand)"
    Write-Output "cost_rfc_demand: $($atvMelQ1.costRfcDemand)"
} else {
    Write-Output "Quarterly test row not found."
}
