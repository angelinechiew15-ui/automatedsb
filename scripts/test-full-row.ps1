$url = "http://localhost:8080/api/lab-summary?horizon=26-06"
$response = Invoke-RestMethod -Uri $url -Method Get
$rows = $response | Where-Object { $_.sb -eq "AIS SP" -and $_.location -eq "RPT MEL" }
if ($rows) {
    Write-Output "==== All AIS SP @ RPT MEL rows ===="
    $rows | ForEach-Object {
        Write-Output "fy_quarter='$($_.fy_quarter)' adderRtu=$($_.adderRtu)"
    }
    Write-Output ""
    Write-Output "First row details:"
    $rows[0] | ConvertTo-Json | Out-String | Write-Output
}
