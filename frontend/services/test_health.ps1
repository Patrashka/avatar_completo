param(
    [int[]]$Ports = @(8010, 8011, 8012, 8013),
    [string]$BaseHost = "127.0.0.1"
)

$results = foreach ($port in $Ports) {
    $url = "http://{0}:{1}/health" -f $BaseHost, $port
    try {
        $response = Invoke-RestMethod -Uri $url -ErrorAction Stop
        [PSCustomObject]@{
            Port    = $port
            Url     = $url
            Status  = $response.status
            Service = $response.service
        }
    } catch {
        [PSCustomObject]@{
            Port    = $port
            Url     = $url
            Status  = "error"
            Service = $_.Exception.Message
        }
    }
}

if ($results.Count -gt 0) {
    $results | Format-Table -AutoSize
} else {
    Write-Warning "No se generaron resultados."
}
