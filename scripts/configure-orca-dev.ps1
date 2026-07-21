param([string]$Address = '127.0.0.1')

$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$domains = @('orca.dev', 'hermes.dev', 'getupsoft.orca.dev', 'galantesjewelry.orca.dev')
$existing = Get-Content -LiteralPath $hostsPath -ErrorAction Stop

foreach ($domain in $domains) {
  $line = "$Address`t$domain # ORCA LOCAL DOMAIN"
  if (-not ($existing -match "(?m)^\s*$([regex]::Escape($Address))\s+$([regex]::Escape($domain))(\s|$)")) {
    Add-Content -LiteralPath $hostsPath -Value $line
    Write-Output "Added $domain -> $Address"
  } else {
    Write-Output "$domain already resolves to $Address"
  }
}

ipconfig /flushdns | Out-Null
Write-Output 'URLs: http://orca.dev and http://hermes.dev'
