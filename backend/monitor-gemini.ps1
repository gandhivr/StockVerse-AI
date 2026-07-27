while ($true) {
    $output = node check-gemini.js 2>&1
    Write-Host $output
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=========================================="
        Write-Host "QUOTA RESTORED! Gemini AI is available."
        Write-Host "Go click ANALYZE on the Fundamental Analysis panel."
        Write-Host "=========================================="
        break
    }
    Start-Sleep -Seconds 300
}
