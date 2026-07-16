$url = "http://localhost:8080/api/lab-summary?horizon=26-06"
$response = Invoke-RestMethod -Uri $url -Method Get

# Find a record with BOTH a TS adder and an RTU adder (and ideally a cost adder), non-null cost/rtu
$cand = $response | Where-Object {
    $_.adderTs -ne 0 -and $_.adderRtu -ne 0 -and $_.rtuTs -ne $null -and $_.costRtu -ne $null -and $_.costRtu -ne 0
} | Select-Object -First 1

if (-not $cand) {
    # fallback: at least an RTU adder
    $cand = $response | Where-Object { $_.adderRtu -ne 0 -and $_.rtuTs -ne $null -and $_.costRtu -ne $null } | Select-Object -First 1
}

if ($cand) {
    Write-Output "==== Test record: $($cand.sb) @ $($cand.location) $($cand.fyQuarter) ===="
    Write-Output ("tsDemand={0}  adderTs={1}  adderRtu={2}  adderCost={3}  rtuTs={4}  costRtu={5}  depreciation={6}" -f `
        $cand.tsDemand, $cand.adderTs, $cand.adderRtu, $cand.adderCost, $cand.rtuTs, $cand.costRtu, $cand.depreciation)
    Write-Output ""
    Write-Output "Reported by backend:"
    Write-Output ("  rtuRfcDemand          = {0}" -f $cand.rtuRfcDemand)
    Write-Output ("  rtuRfcDemandWoAdder   = {0}" -f $cand.rtuRfcDemandWoAdder)
    Write-Output ("  costRfcWoDepr         = {0}" -f $cand.costRfcWoDepr)
    Write-Output ("  costRfcDemand         = {0}" -f $cand.costRfcDemand)
    Write-Output ("  costRfcDemandWoAdder  = {0}" -f $cand.costRfcDemandWoAdder)
    Write-Output ""

    $ts   = [double]$cand.tsDemand
    $ats  = [double]$cand.adderTs
    $artu = [double]$cand.adderRtu
    $acost= [double]$cand.adderCost
    $rtuts= [double]$cand.rtuTs
    $crtu = [double]$cand.costRtu
    $depr = if ($cand.depreciation -eq $null) { 0 } else { [double]$cand.depreciation }

    $expWo   = ($ts + $ats) * $rtuts * 3
    $expWith = $expWo + $artu
    $expCostWo = $expWith * $crtu / 1000
    $expCostDem = $expCostWo + $depr + $acost
    $expCostDemWoAdder = $expCostWo + $depr

    Write-Output "Expected per user's requirement:"
    Write-Output ("  RTU RFC Demand w/o Adder = (ts+adderTs)*rtuTs*3          = {0}" -f $expWo)
    Write-Output ("  RTU RFC Demand (w/ adder)= wo + adderRtu                 = {0}" -f $expWith)
    Write-Output ("  Cost RFC w/o Depr        = RTU(with adder)*costRtu/1000  = {0}" -f $expCostWo)
    Write-Output ("  Cost RFC Demand          = costWoDepr + depr + adderCost = {0}" -f $expCostDem)
    Write-Output ("  Cost RFC Demand w/o Adder= costWoDepr + depr             = {0}" -f $expCostDemWoAdder)
    Write-Output ""

    function Chk($name, $a, $b) {
        $ok = [math]::Abs([double]$a - [double]$b) -lt 0.01
        Write-Output ("  [{0}] {1}: backend={2}  expected={3}" -f $(if($ok){"OK"}else{"MISMATCH"}), $name, $a, $b)
    }
    Chk "RTU RFC Demand w/o Adder" $cand.rtuRfcDemandWoAdder $expWo
    Chk "RTU RFC Demand (w/ adder)" $cand.rtuRfcDemand $expWith
    Chk "Cost RFC w/o Depr" $cand.costRfcWoDepr $expCostWo
    Chk "Cost RFC Demand" $cand.costRfcDemand $expCostDem
    Chk "Cost RFC Demand w/o Adder" $cand.costRfcDemandWoAdder $expCostDemWoAdder
} else {
    Write-Output "No suitable test record found."
}
