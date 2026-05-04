#Requires -Version 5.1
<#
.SYNOPSIS
    Interactive setup for Rusty Browser.
    Downloads binaries, walks you through configuration, and generates a launch script.

.EXAMPLE
    .\setup.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$InstallDir   = "C:\Program Files\RustyBrowser"
$RustyRepo    = "dashn9/rusty-browser"
$FluxRepo     = "dashn9/serverless-flux"
$NodeMinMajor = 18
$GhHeaders    = @{ "User-Agent" = "rusty-browser-setup"; "Accept" = "application/vnd.github+json" }

# ── Elevation ─────────────────────────────────────────────────────────────────

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
    Write-Host "Requesting administrator privileges..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "    ok  $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "    !!  $msg" -ForegroundColor Yellow }
function Write-Info([string]$msg) { Write-Host "        $msg" -ForegroundColor DarkGray }

function Ask([string]$prompt, [string]$default = "") {
    $hint = if ($default -ne "") { " [$default]" } else { "" }
    $raw  = Read-Host "$prompt$hint"
    if ($raw.Trim() -eq "" -and $default -ne "") { return $default }
    $raw.Trim()
}

function Ask-YN([string]$prompt, [bool]$defaultYes = $true) {
    $hint = if ($defaultYes) { "[Y/n]" } else { "[y/N]" }
    $raw  = (Read-Host "$prompt $hint").Trim().ToLower()
    if ($raw -eq "") { return $defaultYes }
    return $raw -eq "y"
}

function Ask-Secret([string]$prompt) {
    $ss  = Read-Host -AsSecureString $prompt
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
    try   { [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function New-RandomKey {
    $b = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    [System.Convert]::ToBase64String($b) -replace '[/+=]', ''
}

function Get-LatestRelease([string]$repo) {
    Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers $GhHeaders
}

function Save-Asset([string]$url, [string]$dest) {
    $tmp = "$dest.tmp"
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("User-Agent", "rusty-browser-setup")
        $wc.DownloadFile($url, $tmp)
        Move-Item $tmp $dest -Force
    } catch {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
        throw "Download failed ($url): $_"
    }
}

function Find-Asset($assets, [string[]]$patterns) {
    foreach ($p in $patterns) {
        $hit = $assets | Where-Object { $_.name -like $p } | Select-Object -First 1
        if ($hit) { return $hit }
    }
    $null
}

# ── Banner ────────────────────────────────────────────────────────────────────

Clear-Host
Write-Host ""
Write-Host "  Rusty Browser  —  Setup" -ForegroundColor White
Write-Host "  Install directory: $InstallDir" -ForegroundColor DarkGray
Write-Host "  Press Enter to accept any default shown in [brackets]" -ForegroundColor DarkGray
Write-Host ""

# ── Component selection ───────────────────────────────────────────────────────

Write-Step "Components"
$installCli      = Ask-YN "  Install rusty-cli?" $true
$installFrontend = Ask-YN "  Install rusty-frontend (Next.js dashboard)?" $true

# ── Prerequisite checks ───────────────────────────────────────────────────────

Write-Step "Checking prerequisites"

if ($installFrontend) {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-Warn "Node.js not found — v$NodeMinMajor+ required to serve the frontend (https://nodejs.org)"
        $installFrontend = $false
    } else {
        $nodeVer   = (node --version) -replace '^v', ''
        $nodeMajor = [int]($nodeVer -split '\.')[0]
        if ($nodeMajor -lt $NodeMinMajor) {
            Write-Warn "Node.js v$nodeVer found — v$NodeMinMajor+ required to serve the frontend. Upgrade at https://nodejs.org"
            $installFrontend = $false
        } else {
            Write-Ok "Node.js v$nodeVer"
        }
    }
}

# ── Install directory ─────────────────────────────────────────────────────────

Write-Step "Install directory"
if (-not (Test-Path $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null }
Write-Ok $InstallDir

# ── Binaries ──────────────────────────────────────────────────────────────────

Write-Step "Rusty Browser binaries"

$inSourceRoot    = Test-Path (Join-Path $PSScriptRoot "Cargo.toml")
$cargoAvailable  = $null -ne (Get-Command cargo -ErrorAction SilentlyContinue)
$buildFromSource = $false
$releaseVersion  = "unknown"

if ($inSourceRoot -and $cargoAvailable) {
    $buildFromSource = Ask-YN "  Source + Cargo detected — build from source? (n = download release)" $false
}

if ($buildFromSource) {
    Write-Info "Building — this may take several minutes..."
    Push-Location $PSScriptRoot
    try {
        cargo build --release
        if (-not $?) { throw "cargo build failed" }
    } finally { Pop-Location }

    $copies = [System.Collections.Generic.List[string]]@("rusty.exe", "rusty-agent.exe")
    if ($installCli) { $copies.Add("rusty-cli.exe") }

    foreach ($name in $copies) {
        $src = Join-Path $PSScriptRoot "target\release\$name"
        if (Test-Path $src) { Copy-Item $src "$InstallDir\$name" -Force; Write-Ok $name }
        else                { Write-Warn "$name not found in target\release\" }
    }
} else {
    Write-Info "Fetching latest release from $RustyRepo..."
    try {
        $release        = Get-LatestRelease $RustyRepo
        $releaseVersion = $release.tag_name -replace '^v', ''

        $binaries = [ordered]@{
            "rusty.exe"       = @("rusty.exe",       "rusty-server.exe")
            "rusty-agent.exe" = @("rusty-agent.exe")
        }
        if ($installCli) { $binaries["rusty-cli.exe"] = @("rusty-cli.exe") }

        foreach ($dest in $binaries.Keys) {
            $asset = Find-Asset $release.assets $binaries[$dest]
            if ($asset) {
                Write-Info "Downloading $($asset.name)..."
                Save-Asset $asset.browser_download_url "$InstallDir\$dest"
                Write-Ok "$dest  (v$releaseVersion)"
            } else {
                Write-Warn "Could not find $dest — download manually from https://github.com/$RustyRepo/releases"
            }
        }
    } catch {
        Write-Warn "Release download failed: $_"
    }
}

# ── Flux binary ───────────────────────────────────────────────────────────────

Write-Step "Flux binary"
Write-Info "Fetching latest release from $FluxRepo..."

$fluxVersion = "0.1.0"
try {
    $fluxRelease = Get-LatestRelease $FluxRepo
    $fluxVersion = $fluxRelease.tag_name -replace '^v', ''
    $fluxAsset   = Find-Asset $fluxRelease.assets @("flux.exe", "*windows*.exe", "*win64*.exe", "*x86_64*windows*.exe")

    if ($fluxAsset) {
        Write-Info "Downloading $($fluxAsset.name)..."
        Save-Asset $fluxAsset.browser_download_url "$InstallDir\flux.exe"
        Write-Ok "flux.exe  (v$fluxVersion)"
    } else {
        Write-Warn "No Windows Flux binary found — place flux.exe at $InstallDir\flux.exe manually"
        Write-Info "https://github.com/$FluxRepo/releases"
    }
} catch {
    Write-Warn "Flux download failed: $_"
    Write-Info "https://github.com/$FluxRepo/releases"
}

# ── Configuration wizard ──────────────────────────────────────────────────────

Write-Step "Redis"
$redisUrl     = Ask "  URL" "redis://127.0.0.1:6379"
$redisAddr    = $redisUrl -replace '^redis://', ''   # host:port for flux.yaml

Write-Step "Server API key"
Write-Info "(clients — including rusty-cli — authenticate to rusty-server with this key)"
$serverApiKey = Ask "  Key (Enter to auto-generate)" ""
if (-not $serverApiKey) { $serverApiKey = New-RandomKey }
Write-Ok "key set"

Write-Step "AI provider"
$aiProvider = Ask "  Provider (openrouter / openai)" "openrouter"
$aiKey      = Ask-Secret "  API key"
$aiDefault  = if ($aiProvider -eq "openai") { "gpt-4o" } else { "anthropic/claude-sonnet-4-20250514" }
$aiModel    = Ask "  Model" $aiDefault
$aiQuality  = Ask "  Screenshot JPEG quality for AI (0.0–1.0)" "0.85"

# ── Flux cloud providers ──────────────────────────────────────────────────────

Write-Step "Flux — cloud providers"
Write-Info "(Flux spawns browser agents on cloud VMs at scale)"
Write-Info "(select at least one, or none to run agents locally on this machine)"
Write-Host ""

$useAws = Ask-YN "  AWS?" $false
$useGcp = Ask-YN "  GCP?" $false

$localAgentMode = (-not $useAws -and -not $useGcp)

if ($localAgentMode) {
    Write-Warn "No cloud provider selected — agents will run as local subprocesses (dev/test only)"
}

$awsBlock     = ""
$gcpBlock     = ""
$fluxApiKey   = New-RandomKey   # shared between flux.yaml and rusty.yaml flux section

if ($useAws) {
    Write-Host ""
    Write-Host "  AWS" -ForegroundColor White
    $awsRegion   = Ask "    Region" "us-east-1"
    $awsAmi      = Ask "    AMI ID"
    $awsSecGroup = Ask "    Security Group ID"
    $awsSshUser  = Ask "    SSH user" "admin"
    $awsMin      = Ask "    Autoscaling min nodes" "1"
    $awsMax      = Ask "    Autoscaling max nodes" "10"

    $awsCredsBlock = ""
    if (Ask-YN "    Use static AWS credentials? (n = default credential chain)" $false) {
        $awsKeyId     = Ask     "    Access Key ID"
        $awsSecretKey = Ask-Secret "    Secret Access Key"
        $awsCredsBlock = @"
    access_key_id: "$awsKeyId"
    secret_access_key: "$awsSecretKey"
"@
    }

    $awsBlock = @"

  aws:
    region: "$awsRegion"
    ami: "$awsAmi"
    security_group_id: "$awsSecGroup"
$awsCredsBlock
    ssh_user: "$awsSshUser"
    agent_version: "$fluxVersion"
    autoscaling:
      enabled: true
      name: aws-prod
      min_nodes: $awsMin
      max_nodes: $awsMax
      node_types:
        - instance_type: c5.large
          vcpus: 2
          memory_gb: 4
        - instance_type: c5.xlarge
          vcpus: 4
          memory_gb: 8
        - instance_type: c5.2xlarge
          vcpus: 8
          memory_gb: 16
        - instance_type: m5.xlarge
          vcpus: 4
          memory_gb: 16
      cpu_upper_threshold: 80
      cpu_lower_threshold: 45
      mem_upper_threshold: 80
      mem_lower_threshold: 45
      evaluation_window_sec: 60
      poll_interval_sec: 10
      cooldown_sec: 300
"@
}

if ($useGcp) {
    Write-Host ""
    Write-Host "  GCP" -ForegroundColor White
    $gcpProject  = Ask "    Project ID"
    $gcpZone     = Ask "    Zone" "us-east5-a"
    $gcpImage    = Ask "    Image" "projects/debian-cloud/global/images/debian-13-trixie-v20260310"
    $gcpSshUser  = Ask "    SSH user" "ubuntu"
    $gcpMin      = Ask "    Autoscaling min nodes" "1"
    $gcpMax      = Ask "    Autoscaling max nodes" "10"

    $gcpCredsLine = "    # credentials: using Application Default Credentials"
    $gcpSaLine    = ""
    $gcpCredsFile = Ask "    Credentials file path (Enter to use ADC)" ""
    if ($gcpCredsFile) { $gcpCredsLine = "    credentials_file: `"$gcpCredsFile`"" }

    $gcpSaEmail = Ask "    Service account email (optional)" ""
    if ($gcpSaEmail) { $gcpSaLine = "`n    service_account_email: `"$gcpSaEmail`"" }

    $gcpBlock = @"

  gcp:
    project_id: "$gcpProject"
    zone: "$gcpZone"
    image: "$gcpImage"
$gcpCredsLine$gcpSaLine
    ssh_user: "$gcpSshUser"
    agent_version: "$fluxVersion"
    autoscaling:
      enabled: true
      name: gcp-prod
      min_nodes: $gcpMin
      max_nodes: $gcpMax
      node_types:
        - instance_type: e2-standard-2
          vcpus: 2
          memory_gb: 8
        - instance_type: e2-standard-4
          vcpus: 4
          memory_gb: 16
        - instance_type: e2-standard-8
          vcpus: 8
          memory_gb: 32
      cpu_upper_threshold: 80
      cpu_lower_threshold: 45
      mem_upper_threshold: 80
      mem_lower_threshold: 45
      evaluation_window_sec: 60
      poll_interval_sec: 10
      cooldown_sec: 300
"@
}

# ── Network / gRPC reachability ───────────────────────────────────────────────

Write-Step "Network — gRPC reachability"
Write-Info "(cloud agents dial back to this machine; they need a publicly reachable URL)"
Write-Host ""

$grpcPort      = 50050
$grpcServerUrl = ""
$useNgrok      = $false
$ngrokDomain   = ""
$isPublic      = Ask-YN "  Is this machine directly reachable from the internet?" $false

if ($isPublic) {
    $publicHost    = Ask "  Public hostname or IP"
    $grpcServerUrl = "https://${publicHost}:${grpcPort}"
    Write-Ok "grpc_server_url set to $grpcServerUrl"
} else {
    Write-Info "ngrok can expose your gRPC port to the internet for agent callbacks."
    $useNgrok = $true

    if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
        if (Ask-YN "  ngrok not found — install via winget?" $true) {
            Write-Info "Installing ngrok..."
            winget install ngrok.ngrok --silent
            if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
                Write-Warn "winget install did not add ngrok to PATH — restart this terminal and re-run setup, or install from https://ngrok.com/download"
                $useNgrok = $false
            }
        } else {
            Write-Warn "Install ngrok from https://ngrok.com/download, then re-run setup or set grpc_server_url manually in rusty.yaml"
            $useNgrok = $false
        }
    }

    if ($useNgrok) {
        $ngrokToken = Ask-Secret "  ngrok auth token (https://dashboard.ngrok.com/auth)"
        if ($ngrokToken) {
            ngrok config add-authtoken $ngrokToken 2>&1 | Out-Null
            Write-Ok "ngrok auth token saved"
        }

        $ngrokDomain = Ask "  Static ngrok domain, e.g. abc123.tcp.ngrok.io (Enter if none — URL will rotate each session)" ""
        if ($ngrokDomain) {
            $grpcServerUrl = "tcp://${ngrokDomain}:${grpcPort}"
            Write-Ok "grpc_server_url set to $grpcServerUrl"
        } else {
            Write-Info "No static domain — rusty-launch.ps1 will resolve the ngrok URL at startup and patch rusty.yaml"
        }
    }
}

# ── Other server settings ─────────────────────────────────────────────────────

Write-Step "Server settings"
$httpPort    = Ask "  HTTP port" "8080"
$agentOs     = Ask "  Agent OS target (linux / windows)" "linux"
$insecure    = if (-not $isPublic -and -not $useNgrok) { Ask-YN "  Insecure gRPC? (local dev — no TLS)" $false } else { $false }
$insecureStr = $insecure.ToString().ToLower()

# ── Frontend directory ────────────────────────────────────────────────────────

$frontendDir = if ($installFrontend) { "$InstallDir\frontend" } else { "" }

# ── Write rusty.yaml ──────────────────────────────────────────────────────────

Write-Step "Writing rusty.yaml"

if ($grpcServerUrl -ne "") {
    $grpcLine = "  grpc_server_url: `"$grpcServerUrl`""
} else {
    $grpcLine = "  # grpc_server_url: populated at launch by rusty-launch.ps1 when using ngrok"
}

if ($localAgentMode) {
    $localBin    = ($InstallDir -replace '\\', '/') + "/rusty-agent.exe"
    $fluxSection = @"
flux:
  local_binary: "$localBin"
  function_name: "rusty-agent"
"@
} else {
    $fluxSection = @"
flux:
  base_url: "http://127.0.0.1:7227"
  api_key: "$fluxApiKey"
  function_name: "rusty-agent"
"@
}

@"
server:
  http_port: $httpPort
$grpcLine
  insecure_grpc: $insecureStr

redis:
  url: "$redisUrl"
  key_prefix: "rusty:"

ai:
  provider: "$aiProvider"
  api_key: "$aiKey"
  model: "$aiModel"
  resolution:
    quality: $aiQuality

$fluxSection

deployment:
  agent_os_target: "$agentOs"

api_keys:
  - "$serverApiKey"
"@ | Set-Content "$InstallDir\rusty.yaml" -Encoding utf8

Write-Ok "rusty.yaml"

# ── Write flux.yaml ───────────────────────────────────────────────────────────

if (-not $localAgentMode) {
    Write-Step "Writing flux.yaml"

    @"
api_key: "$fluxApiKey"
redis_addr: $redisAddr
agent_port: $grpcPort
providers:$awsBlock$gcpBlock
"@ | Set-Content "$InstallDir\flux.yaml" -Encoding utf8

    Write-Ok "flux.yaml"
}

# ── Frontend — download prebuilt artifact ────────────────────────────────────

if ($installFrontend) {
    Write-Step "Frontend — downloading prebuilt artifact"

    $feAsset = if ($release) { Find-Asset $release.assets @("rusty-frontend.zip") } else { $null }

    if (-not $feAsset) {
        Write-Info "Not in the Rusty Browser release — fetching separately..."
        try {
            $release2 = Get-LatestRelease $RustyRepo
            $feAsset  = Find-Asset $release2.assets @("rusty-frontend.zip")
        } catch { $feAsset = $null }
    }

    if ($feAsset) {
        $feZip = "$InstallDir\rusty-frontend.zip"
        Write-Info "Downloading $($feAsset.name)..."
        Save-Asset $feAsset.browser_download_url $feZip

        if (Test-Path $frontendDir) { Remove-Item $frontendDir -Recurse -Force }
        New-Item -ItemType Directory -Path $frontendDir -Force | Out-Null
        Expand-Archive $feZip $frontendDir -Force
        Remove-Item $feZip -Force
        Write-Ok "frontend extracted to $frontendDir"
    } else {
        Write-Warn "rusty-frontend.zip not found in release — frontend will not be available"
        Write-Info "Run a release with 'rusty-frontend' included to publish the artifact"
        $installFrontend = $false
        $frontendDir     = ""
    }
}

# ── Generate rusty-launch.ps1 ─────────────────────────────────────────────────

Write-Step "Generating rusty-launch.ps1"

$safeInstall  = $InstallDir  -replace "'", "''"
$safeFrontend = $frontendDir -replace "'", "''"

# Block: start ngrok and patch grpc_server_url if no static domain
if ($useNgrok -and -not $ngrokDomain) {
    $ngrokBlock = @"

    Write-Host "  Starting ngrok TCP tunnel on port $grpcPort..." -ForegroundColor Cyan
    `$ngrokProc = Start-Process ngrok -ArgumentList "tcp $grpcPort" -PassThru -WindowStyle Minimized
    Start-Sleep -Seconds 3
    try {
        `$tunnelUrl = ((Invoke-RestMethod "http://localhost:4040/api/tunnels").tunnels |
                       Where-Object { `$_.proto -eq "tcp" } |
                       Select-Object -First 1).public_url
        if (`$tunnelUrl) {
            `$cfg = Get-Content '$safeInstall\rusty.yaml' -Raw
            `$cfg = `$cfg -replace '(?m)^  # grpc_server_url:.*$', "  grpc_server_url: `"`$tunnelUrl`""
            `$cfg | Set-Content '$safeInstall\rusty.yaml' -Encoding utf8
            Write-Host "  gRPC tunnel: `$tunnelUrl" -ForegroundColor Green
        } else {
            Write-Warning "Could not read ngrok tunnel URL. Set grpc_server_url manually in rusty.yaml."
        }
    } catch {
        Write-Warning "ngrok API unreachable: `$_"
    }
"@
} else {
    $ngrokBlock = ""
}

# Block: start Flux server window (only when using cloud providers)
if (-not $localAgentMode) {
    $fluxBlock = @"

    Write-Host "  Starting Flux server..." -ForegroundColor Cyan
    Open-Window "Flux" "`$host.UI.RawUI.WindowTitle='Flux'; & '$safeInstall\flux.exe' --config '$safeInstall\flux.yaml'"
    Start-Sleep -Seconds 2
"@
} else {
    $fluxBlock = ""
}

# Block: start frontend window
if ($frontendDir) {
    $frontendBlock = @"

    if (`$Frontend) {
        if (Test-Path '$safeFrontend') {
            Write-Host "  Starting Rusty Frontend..." -ForegroundColor Cyan
            Open-Window "Rusty Frontend" "`$host.UI.RawUI.WindowTitle='Rusty Frontend'; `$env:PORT='3000'; node '$safeFrontend\server.js'"
            Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green
        } else {
            Write-Warning "Frontend directory not found: $safeFrontend"
        }
    }
"@
    $frontendParam  = "`n`n.PARAMETER Frontend`n    Also launch the Next.js dashboard in a separate window."
    $frontendSwitch = "param([switch]`$Frontend)"
    $frontendUsage  = "`n    .`\rusty-launch.ps1 -Frontend"
} else {
    $frontendBlock  = ""
    $frontendParam  = ""
    $frontendSwitch = ""
    $frontendUsage  = ""
}

@"
#Requires -Version 5.1
<#
.SYNOPSIS
    Launch the Rusty Browser stack.$frontendParam

.EXAMPLE
    .\rusty-launch.ps1$frontendUsage
#>
$frontendSwitch

`$ErrorActionPreference = "Stop"
`$InstallDir = '$safeInstall'
`$ServerBin  = Join-Path `$InstallDir 'rusty.exe'
`$Config     = Join-Path `$InstallDir 'rusty.yaml'

if (-not (Test-Path `$ServerBin)) {
    Write-Error "rusty.exe not found at `$ServerBin — run setup.ps1 first"
    exit 1
}

function Open-Window([string]`$title, [string]`$cmd) {
    if (Get-Command wt -ErrorAction SilentlyContinue) {
        Start-Process wt -ArgumentList "new-tab --title `"`$title`" powershell -NoExit -NoLogo -Command `"`$cmd`""
    } else {
        `$p = New-Object System.Diagnostics.ProcessStartInfo
        `$p.FileName        = "powershell.exe"
        `$p.Arguments       = "-NoExit -NoLogo -Command `"`$cmd`""
        `$p.UseShellExecute = `$true
        [System.Diagnostics.Process]::Start(`$p) | Out-Null
    }
}

Write-Host ""
$ngrokBlock$fluxBlock
Write-Host "  Starting Rusty Server..." -ForegroundColor Cyan
Open-Window "Rusty Server" "`$host.UI.RawUI.WindowTitle='Rusty Server'; `$env:RUSTY_CONFIG='`$Config'; & '`$ServerBin'"
Write-Host "  Server: http://localhost:$httpPort" -ForegroundColor Green
$frontendBlock
Write-Host ""
Write-Host "  First run? After the server is ready:" -ForegroundColor Yellow
Write-Host "    rusty-cli.exe init" -ForegroundColor DarkGray
Write-Host "    # or: curl -X POST http://localhost:$httpPort/initialize/" -ForegroundColor DarkGray
Write-Host ""
"@ | Set-Content "$InstallDir\rusty-launch.ps1" -Encoding utf8

Write-Ok "rusty-launch.ps1"

# ── PATH ──────────────────────────────────────────────────────────────────────

$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
if ($machinePath -notlike "*$InstallDir*") {
    Write-Host ""
    if (Ask-YN "Add '$InstallDir' to the system PATH?" $true) {
        [System.Environment]::SetEnvironmentVariable("Path", "$machinePath;$InstallDir", "Machine")
        $env:Path = "$env:Path;$InstallDir"
        Write-Ok "Added to PATH — restart open terminals to pick it up"
    }
}

# ── Summary ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Files written to: $InstallDir" -ForegroundColor White
Write-Host "    rusty.yaml         server config"
if (-not $localAgentMode) { Write-Host "    flux.yaml          Flux server config" }
Write-Host "    rusty-launch.ps1   start the stack"
Write-Host ""
Write-Host "  Keys (save these somewhere safe):" -ForegroundColor Yellow
Write-Host "    Server API key : $serverApiKey"
if (-not $localAgentMode) { Write-Host "    Flux API key   : $fluxApiKey" }
Write-Host ""
Write-Host "  To start:"
Write-Host "    & '$InstallDir\rusty-launch.ps1'"
if ($frontendDir) {
    Write-Host "    & '$InstallDir\rusty-launch.ps1' -Frontend"
}
Write-Host ""
Write-Host "  Then initialize once (generates TLS certs + deploys agent to Flux):"
Write-Host "    rusty-cli.exe init"
Write-Host ""
