$url = "http://localhost:8080/api/lab-summary?horizon=26-06"
Write-Output "Fetching Lab Summary data..."
$response = Invoke-RestMethod -Uri $url -Method Get

# Find the annual AIS SP @ RPT MEL row
$aisSpAnnual = $response | Where-Object { $_.sb -eq "AIS SP" -and $_.location -eq "RPT MEL" -and $_.fy_quarter -eq "24/25" }

if ($aisSpAnnual) {
    Write-Output "==== Found: AIS SP @ RPT MEL 24/25 (annual) ===="
    Write-Output "fy_quarter: $($aisSpAnnual.fy_quarter)"
    Write-Output "adderRtu: $($aisSpAnnual.adderRtu) [expected: 9.2]"
    Write-Output "adderTs: $($aisSpAnnual.adderTs) [expected: 0]"
    Write-Output "adderCost: $($aisSpAnnual.adderCost) [expected: 0]"
    Write-Output "rtuRfcDemand: $($aisSpAnnual.rtuRfcDemand)"
    Write-Output "costRfcDemand: $($aisSpAnnual.costRfcDemand)"
    if ($aisSpAnnual.adderRtu -eq 9.2) {
        Write-Output "✓ FIX CONFIRMED: Annual adder is now being applied!"
    } else {
        Write-Output "✗ FIX NOT WORKING: Annual adder still missing or incorrect (value=$($aisSpAnnual.adderRtu))"
    }
} else {
    Write-Output "ERROR: Row not found for AIS SP @ RPT MEL 24/25"
    Write-Output ""
    Write-Output "All AIS SP @ RPT MEL rows:"
    $response | Where-Object { $_.sb -eq "AIS SP" -and $_.location -eq "RPT MEL" } | ForEach-Object {
        Write-Output "  $($_.fy_quarter): adderRtu=$($_.adderRtu)"
    }
}
