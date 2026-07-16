$horizon = '26-06'
$names = Invoke-RestMethod "http://localhost:8080/api/service-bundle/sb-names?horizon=$horizon"
$lab   = Invoke-RestMethod "http://localhost:8080/api/lab-cost/qtr-avg?horizon=$horizon"

$nameToId = @{}
foreach ($n in $names) { if (-not $nameToId.ContainsKey($n.text)) { $nameToId[$n.text] = $n.value } }

$out = New-Object System.Collections.Generic.List[object]
$sbsToCheck = ($lab | Select-Object -ExpandProperty sb -Unique) | Select-Object -First 30
foreach ($sbName in $sbsToCheck) {
  if (-not $nameToId.ContainsKey($sbName)) { continue }
  $id = $nameToId[$sbName]
  $labRows = $lab | Where-Object { $_.sb -eq $sbName }
  $locs = $labRows | Select-Object -ExpandProperty location -Unique
  foreach ($loc in $locs) {
    try { $c = Invoke-RestMethod "http://localhost:8080/api/service-bundle/charts?sbId=$id&horizon=$horizon&loc=$loc" } catch { continue }
    $ann = @{}
    foreach ($p in $c.costDemand) {
      $lbl = $p.label
      if ($lbl -match '^(\d\d/\d\d)\s+Q\d$') { $fy = $Matches[1]; $ann[$fy] = ([double]$ann[$fy] + [double]$p.value) }
      elseif ($lbl -match '^(\d\d/\d\d)$')   { $fy = $Matches[1]; $ann[$fy] = ([double]$ann[$fy] + [double]$p.value * 4) }
    }
    foreach ($lr in ($labRows | Where-Object { $_.location -eq $loc })) {
      $labVal = if ($null -ne $lr.value) { [math]::Round([double]$lr.value,1) } else { 0 }
      $sbVal  = if ($ann.ContainsKey($lr.fy)) { [math]::Round([double]$ann[$lr.fy],1) } else { 0 }
      if ([math]::Abs($labVal - $sbVal) -gt 1.0) {
        $out.Add([pscustomobject]@{ sb=$sbName; loc=$loc; fy=$lr.fy; lab=$labVal; sb_charts=$sbVal })
      }
    }
  }
}
$out | Format-Table -AutoSize
"Total mismatches: $($out.Count)"
