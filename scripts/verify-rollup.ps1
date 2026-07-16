$lab = Invoke-RestMethod 'http://localhost:8080/api/lab-cost/qtr-avg?horizon=26-06'
$externals = @('KESM','TTM','ALPITRONIC EXT','KFE EXT','PERS REL','TEAMQUEST EXT','Rood T EXT','CPL EXT','QAV EXT')
$leaked = @($lab | Where-Object { $_.location -in $externals } | Select-Object -Expand location -Unique)
Write-Host "External locations still present as rows: $([string]::Join(', ', $leaked))"
$locs = @($lab | Select-Object -Expand location -Unique | Sort-Object)
Write-Host "Distinct locations now ($($locs.Count)): $([string]::Join(', ', $locs))"
