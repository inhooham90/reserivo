<#
.SYNOPSIS
  Check the Namecheap records for reserivo.com against what Heroku expects,
  and confirm Google Workspace mail is still intact.

.EXAMPLE
  .\deploy\check-dns.ps1

.NOTES
  Read-only. Run it after editing Advanced DNS; propagation can take an hour
  or two, so a miss soon after saving is normal.

  Deliberately plain ASCII. Windows PowerShell reads a .ps1 without a BOM as
  ANSI, so a stray em-dash comes back as mojibake and can break parsing.
#>

# Queried against a public resolver rather than the local one, because Windows
# caches negative answers and will keep insisting a new record does not exist.
$server = "8.8.8.8"

$expected = @(
  @{ Name = "reserivo.com";     Target = "shrouded-date-wddud7nwy26fs7oobbnhwnew.herokudns.com";         Note = "web (ALIAS on the root)" },
  @{ Name = "www.reserivo.com"; Target = "fluffy-pear-ag5mahj9uo2nishg2b24o413.herokudns.com";           Note = "web" },
  @{ Name = "api.reserivo.com"; Target = "cylindrical-mayflower-k5gfadg9r54dnju25v7n9nmq.herokudns.com"; Note = "api" }
)

function Resolve-Safe {
  param([string]$Name, [string]$Type)
  try { return @(Resolve-DnsName $Name -Type $Type -Server $server -ErrorAction Stop) }
  catch { return @() }
}

$ready = $true

Write-Host "Heroku targets" -ForegroundColor Cyan
foreach ($e in $expected) {
  # An ALIAS is flattened to A records by the provider, so the root will not
  # come back as a CNAME even when it is set correctly. Accept either.
  $answers = @(Resolve-Safe $e.Name "CNAME") + @(Resolve-Safe $e.Name "A")
  $cname = @($answers | Where-Object { $_.NameHost } | ForEach-Object { $_.NameHost })
  $addrs = @($answers | Where-Object { $_.IPAddress } | ForEach-Object { $_.IPAddress })

  if ($cname -contains $e.Target) {
    Write-Host ("  OK       {0,-20} -> {1}" -f $e.Name, $e.Target) -ForegroundColor Green
  }
  elseif ($addrs.Count -gt 0) {
    Write-Host ("  PROBABLY {0,-20} -> {1} (ALIAS flattened; Heroku confirms below)" -f $e.Name, ($addrs -join ", ")) -ForegroundColor Yellow
  }
  else {
    Write-Host ("  MISSING  {0,-20} -> expected {1}  [{2}]" -f $e.Name, $e.Target, $e.Note) -ForegroundColor Red
    $ready = $false
  }
}

Write-Host ""
Write-Host "Google Workspace mail (must survive)" -ForegroundColor Cyan
$mx = Resolve-Safe "reserivo.com" "MX"
if ($mx.Count -gt 0) {
  $mx | ForEach-Object { Write-Host ("  MX  {0} {1}" -f $_.Preference, $_.NameExchange) -ForegroundColor Green }
}
else {
  Write-Host '  GONE - mail to reserivo.com is broken. Restore: MX host @ value "1 smtp.google.com"' -ForegroundColor Red
  $ready = $false
}

$txt = Resolve-Safe "reserivo.com" "TXT"
$verify = @($txt | Where-Object { $_.Strings -match "google-site-verification" })
if ($verify.Count -gt 0) {
  Write-Host "  TXT google-site-verification present" -ForegroundColor Green
}
else {
  Write-Host "  TXT google-site-verification missing - Google may un-verify the domain" -ForegroundColor Red
}

Write-Host ""
Write-Host "Heroku's own view" -ForegroundColor Cyan
foreach ($app in @("reserivo-api", "reserivo-web")) {
  # heroku writes notices to stderr; do not let that abort the script.
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $domains = heroku domains -a $app --json | ConvertFrom-Json
  $ErrorActionPreference = $prev
  foreach ($d in $domains) {
    if ($d.kind -eq "custom") {
      $acm = if ($d.acm_status) { $d.acm_status } else { "no cert yet" }
      Write-Host ("  {0,-20} {1}" -f $d.hostname, $acm)
    }
  }
}

Write-Host ""
if ($ready) {
  Write-Host "DNS looks right. Next: the cutover commands in deploy/HEROKU.md section 4." -ForegroundColor Green
}
else {
  Write-Host "Not ready yet. Re-run in a while; propagation can take an hour or two." -ForegroundColor Yellow
}
