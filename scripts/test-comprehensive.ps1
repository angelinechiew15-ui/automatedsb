$url = "http://localhost:8080/api/lab-summary?horizon=26-06"
$response = Invoke-RestMethod -Uri $url -Method Get

# Test 1: Quarterly adder case - ATV HV @ RPT MEL 25/26 Q1
Write-Output "==== Test 1: Quarterly Adder (ATV HV @ RPT MEL 25/26 Q1) ===="
$test1 = $response | Where-Object { $_.sb -eq "ATV HV (PL34)" -and $_.location -eq "RPT MEL" -and $_.fyQuarter -eq "25/26 Q1" }
if ($test1) {
    Write-Output "adderRtu: $($test1.adderRtu) (should be non-zero)"
    Write-Output "adderCost: $($test1.adderCost) (should be non-zero)"
    Write-Output "rtuRfcDemand: $($test1.rtuRfcDemand)"
    Write-Output "costRfcDemand: $($test1.costRfcDemand)"
} else {
    Write-Output "Not found"
}

# Test 2: Annual cost adder case - ATV HV @ RPT MEL 24/25
Write-Output ""
Write-Output "==== Test 2: Annual Cost Adder (ATV HV @ RPT MEL 24/25) ===="
$test2 = $response | Where-Object { $_.sb -eq "ATV HV (PL34)" -and $_.location -eq "RPT MEL" -and $_.fyQuarter -eq "24/25" }
if ($test2) {
    Write-Output "adderRtu: $($test2.adderRtu)"
    Write-Output "adderCost: $($test2.adderCost) (should be 30)"
    Write-Output "costRfcDemand: $($test2.costRfcDemand)"
    Write-Output "costRfcDemandWoAdder: $($test2.costRfcDemandWoAdder)"
    if ($test2.adderCost -eq 30) {
        Write-Output "✓ Annual COST adder is correct!"
    }
} else {
    Write-Output "Not found"
}

# Test 3: Quarterly no-depreciation case - Check a few records to understand full picture
Write-Output ""
Write-Output "==== Test 3: Depreciation NULL handling ===="
$depTest = $response | Where-Object { $_.depreciation -eq $null } | Select-Object -First 1
if ($depTest) {
    Write-Output "Found row with depreciation=NULL:"
    Write-Output "  sb: $($depTest.sb)"
    Write-Output "  location: $($depTest.location)"
    Write-Output "  costRfcWoDepr: $($depTest.costRfcWoDepr)"
    Write-Output "  depreciation: $($depTest.depreciation)"
    Write-Output "  costRfcDemand: $($depTest.costRfcDemand)"
    Write-Output "  costRfcDemandWoAdder: $($depTest.costRfcDemandWoAdder)"
    Write-Output "  (costRfcDemand should equal costRfcWoDepr when depreciation is NULL)"
}

Write-Output ""
Write-Output "==== Summary ===="
Write-Output "Total rows: $(($response | Measure-Object).Count)"
$withAdderRtu = $response | Where-Object { $_.adderRtu -ne 0 } | Measure-Object
$withAdderCost = $response | Where-Object { $_.adderCost -ne 0 } | Measure-Object
Write-Output "Rows with RTU adder: $($withAdderRtu.Count)"
Write-Output "Rows with COST adder: $($withAdderCost.Count)"
