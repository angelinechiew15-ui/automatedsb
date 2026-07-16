$url = "http://localhost:8080/api/lab-summary?horizon=26-06"
$response = Invoke-RestMethod -Uri $url -Method Get

# Test: Annual COST adder for 26/27
Write-Output "==== Checking ATV HV @ RPT MEL 26/27 annual (has COST adder 30 in DB) ===="
$test = $response | Where-Object { $_.sb -eq "ATV HV (PL34)" -and $_.location -eq "RPT MEL" -and $_.fyQuarter -eq "26/27" }
if ($test) {
    Write-Output "Found 26/27 annual:"
    Write-Output "  adderRtu: $($test.adderRtu)"
    Write-Output "  adderCost: $($test.adderCost) [expected: 30]"
    Write-Output "  costRfcWoDepr: $($test.costRfcWoDepr)"
    Write-Output "  costRfcDemand: $($test.costRfcDemand)"
    Write-Output "  costRfcDemandWoAdder: $($test.costRfcDemandWoAdder)"
    if ($test.adderCost -eq 30) {
        Write-Output "✓ FIX VERIFIED: Annual COST adder 26/27 = 30"
    } else {
        Write-Output "✗ ISSUE: Expected adderCost=30, got $($test.adderCost)"
    }
} else {
    Write-Output "Not found"
    $nearby = $response | Where-Object { $_.sb -eq "ATV HV (PL34)" -and $_.location -eq "RPT MEL" } | Select-Object fyQuarter, adderRtu, adderCost
    $nearby | Format-Table -AutoSize
}
