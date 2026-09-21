<#
.SYNOPSIS
  Build both images and release them to Heroku. Safe to re-run; this is the
  normal way to ship a change.

.EXAMPLE
  .\deploy\heroku-deploy.ps1 -ApiOrigin https://reserivo-api-e04c6a11001e.herokuapp.com

.NOTES
  Run from the repo root. See deploy/HEROKU.md for first-time setup.
  Windows PowerShell 5.1 compatible.
#>
param(
  [Parameter(Mandatory = $true)]
  # Baked into the browser bundle at build time, so the web image is tied to
  # one API origin and changing it means rebuilding, not just a config var.
  [string]$ApiOrigin,
  [string]$ApiApp = "reserivo-api",
  [string]$WebApp = "reserivo-web"
)

$ErrorActionPreference = "Stop"

# Native executables do not throw on failure in PowerShell, so every step has
# to check the exit code or a failed push would look like a successful deploy.
#
# The reverse trap is worse. docker and heroku write progress and notices to
# stderr, and Windows PowerShell turns those into terminating NativeCommandErrors
# whenever stderr is redirected and $ErrorActionPreference is Stop — so piping
# this script through anything would abort it on a "heroku update available"
# notice. Exit codes are the only signal worth trusting, so native commands run
# with the preference relaxed and the code checked by hand.
function Invoke-Step {
  param([string]$Description, [scriptblock]$Command)
  Write-Host "==> $Description" -ForegroundColor Cyan
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Command } finally { $ErrorActionPreference = $previous }
  if ($LASTEXITCODE -ne 0) { throw "$Description failed (exit $LASTEXITCODE)" }
}

<#
  Heroku's registry is fussy about how the image is built, in three ways, and
  gives one unhelpful error for all of them ("error from registry: unsupported"):

    oci-mediatypes=false  Docker Desktop's containerd image store writes OCI
                          manifests. Heroku only accepts Docker Schema 2. This
                          is the one that actually bites; the push uploads every
                          layer and then fails on the manifest.
    provenance/sbom=false buildx otherwise attaches attestations, which turn the
                          push into a manifest list.
    platform              Heroku runs linux/amd64 only.

  Building straight to the registry with `push=true` keeps the media type
  intact; a separate `docker push` would re-export it from the local store.
#>
function Push-Image {
  param([string]$Description, [string]$Tag, [string]$Dockerfile, [string[]]$ExtraArgs = @())
  $output = "type=image,name=$Tag,oci-mediatypes=false,push=true"
  Invoke-Step $Description {
    docker buildx build `
      --platform linux/amd64 --provenance=false --sbom=false `
      @ExtraArgs -f $Dockerfile --output $output .
  }
}

$ErrorActionPreference = "Continue"
heroku auth:whoami | Out-Null
$loggedIn = $LASTEXITCODE -eq 0
$ErrorActionPreference = "Stop"
if (-not $loggedIn) { throw "Not logged in. Run: heroku login" }

Invoke-Step "Logging in to the container registry" { heroku container:login }

Push-Image "Building and pushing the API image" "registry.heroku.com/$ApiApp/web" "apps/api/Dockerfile"
# The dyno runs `prisma migrate deploy` before the server, so releasing the API
# first means the schema is ready by the time the new web build talks to it.
Invoke-Step "Releasing the API" { heroku container:release web -a $ApiApp }

Push-Image "Building and pushing the web image (API_URL=$ApiOrigin)" `
  "registry.heroku.com/$WebApp/web" "apps/web/Dockerfile" `
  @("--build-arg", "NEXT_PUBLIC_API_URL=$ApiOrigin")
Invoke-Step "Releasing the web app" { heroku container:release web -a $WebApp }

Write-Host ""
Write-Host "Released. Watch it come up with:" -ForegroundColor Green
Write-Host "  heroku logs --tail -a $ApiApp"
