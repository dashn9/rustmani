#Requires -Version 5.1
<#
.SYNOPSIS
    Interactive setup for Rusty Browser.
    Downloads binaries, walks you through configuration, and generates a launch script.

.EXAMPLE
    .\setup.ps1
#>
[CmdletBinding()]
param(
    [switch]$ForceInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$InstallDir   = "$env:LOCALAPPDATA\RustyBrowser"
$RustyRepo             = "dashn9/rusty-browser"
$FluxRepo              = "dashn9/serverless-flux"
$ServerlessAgentRepo   = "dashn9/serverless-agent"
$NodeMinMajor = 18

# ── Component versions ────────────────────────────────────────────────────────

$VersionServer          = "0.1.0"
$VersionAgent           = "0.1.0"
$VersionCli             = "0.1.0"
$VersionFrontend        = "0.1.0"
$VersionFlux            = "0.1.0"
$VersionServerlessAgent = "0.1.0"


# ── Helpers ───────────────────────────────────────────────────────────────────

$Utf8NoBom = New-Object System.Text.UTF8Encoding $false
function Write-File([string]$path, [string]$content) {
    [System.IO.File]::WriteAllText($path, $content, $Utf8NoBom)
}

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

function Select-Multi([string[]]$options) {
    for ($i = 0; $i -lt $options.Count; $i++) {
        Write-Host "    $($i + 1). $($options[$i])" -ForegroundColor White
    }
    $raw = (Read-Host "  Select (e.g. 1,2 or leave blank for none)").Trim()
    $selected = New-Object bool[] $options.Count
    foreach ($part in ($raw -split ',')) {
        $n = $part.Trim()
        if ($n -match '^\d+$') {
            $idx = [int]$n - 1
            if ($idx -ge 0 -and $idx -lt $options.Count) { $selected[$idx] = $true }
        }
    }
    return $selected
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

function Save-Asset([string]$url, [string]$dest) {
    try {
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing `
            -Headers @{ "User-Agent" = "rusty-browser-setup" }
    } catch {
        throw "Download failed ($url): $_"
    }
}


# ── Banner ────────────────────────────────────────────────────────────────────

Clear-Host
Write-Host ""
Write-Host "  Rusty Browser  --  Setup" -ForegroundColor White
Write-Host "  Install directory: $InstallDir" -ForegroundColor DarkGray
Write-Host "  Press Enter to accept any default shown in [brackets]" -ForegroundColor DarkGray
Write-Host ""

# ── Component selection ───────────────────────────────────────────────────────

Write-Step "Components"
$installCli      = $true
$installFrontend = $true

# ── Prerequisite checks ───────────────────────────────────────────────────────

Write-Step "Checking prerequisites"

if ($installFrontend) {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-Warn "Node.js not found -- v$NodeMinMajor+ required to serve the frontend (https://nodejs.org)"
        $installFrontend = $false
    } else {
        $nodeVer   = (node --version) -replace '^v', ''
        $nodeMajor = [int]($nodeVer -split '\.')[0]
        if ($nodeMajor -lt $NodeMinMajor) {
            Write-Warn "Node.js v$nodeVer found -- v$NodeMinMajor+ required to serve the frontend. Upgrade at https://nodejs.org"
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

# ── Configuration wizard ──────────────────────────────────────────────────────

Write-Step "Redis"
$redisUrl     = Ask "  URL" "redis://127.0.0.1:6379"
$redisAddr    = $redisUrl

Write-Step "AI provider"
$aiProvider = Ask "  Provider (openrouter / openai)" "openrouter"
$aiKey      = Ask-Secret "  API key"
$aiDefault  = if ($aiProvider -eq "openai") { "gpt-5-nano" } else { "openai/gpt-5-nano" }
$aiModel    = Ask "  Model" $aiDefault
$aiQuality  = "0.2"

# ── Flux cloud providers ──────────────────────────────────────────────────────

Write-Step "Flux -- cloud providers"
Write-Info "(Flux spawns browser agents on cloud VMs at scale)"
Write-Info "(select at least one, or none to run agents locally on this machine)"
Write-Host ""

$providerSel = Select-Multi @("AWS", "GCP")
$useAws = $providerSel[0]
$useGcp = $providerSel[1]

$localAgentMode = (-not $useAws -and -not $useGcp)

if ($localAgentMode) {
    Write-Warn "No cloud provider selected -- agents will run as local subprocesses (dev/test only)"
}

$awsBlock     = ""
$gcpBlock     = ""
$fluxApiKey   = if ($localAgentMode) { "local" } else { New-RandomKey }

if ($useAws) {
    Write-Host ""
    Write-Host "  AWS" -ForegroundColor White
    $awsRegion    = Ask "    Region" "us-east-1"
    $awsSecGroup  = Ask "    Security Group ID"
    $awsMin       = Ask "    Min nodes" "1"
    $awsMax       = Ask "    Max nodes" "10"
    $awsKeyId     = Ask "    Access Key ID (Enter to use default credential chain)" ""
    $awsSecretKey = if ($awsKeyId) { Ask-Secret "    Secret Access Key" } else { "" }

    $awsCredsBlock = if ($awsKeyId) { @"
    access_key_id: "$awsKeyId"
    secret_access_key: "$awsSecretKey"
"@ } else { "    # credentials: using default chain (env vars / ~/.aws/credentials / instance profile)" }

    $awsBlock = @"

  aws:
    region: "$awsRegion"
    ami: "ami-064519b8c76274859"
    security_group_id: "$awsSecGroup"
$awsCredsBlock
    ssh_user: "admin"
    agent_version: "$VersionAgent"
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
    $gcpProject   = Ask "    Project ID"
    $gcpMin       = Ask "    Min nodes" "1"
    $gcpMax       = Ask "    Max nodes" "10"
    $gcpCredsFile = Ask "    Credentials file path (Enter to use ADC)" ""

    $gcpCredsLine = if ($gcpCredsFile) { "    credentials_file: `"$gcpCredsFile`"" } else { "    # credentials: using Application Default Credentials" }

    $gcpBlock = @"

  gcp:
    project_id: "$gcpProject"
    zone: "us-east5-a"
    image: "projects/debian-cloud/global/images/debian-13-trixie-v20260310"
$gcpCredsLine
    ssh_user: "ubuntu"
    agent_version: "$VersionAgent"
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

Write-Step "Server API key"
if ($localAgentMode) {
    $serverApiKey = "local"
    Write-Ok "local"
} else {
    Write-Info "(clients -- including rusty-cli -- authenticate to rusty-server with this key)"
    $serverApiKey = Ask "  Key (Enter to auto-generate)" ""
    if (-not $serverApiKey) { $serverApiKey = New-RandomKey }
    Write-Ok "key set"
}

# ── Network / gRPC reachability ───────────────────────────────────────────────

$grpcPort      = 50050
$grpcServerUrl = ""

if (-not $localAgentMode) {
Write-Step "Network -- gRPC reachability"
Write-Info "(cloud agents dial back to this machine; they need a publicly reachable URL)"
Write-Host ""
$isPublic      = Ask-YN "  Is this machine directly reachable from the internet?" $false

if ($isPublic) {
    $publicHost    = Ask "  Public hostname or IP"
    $grpcServerUrl = "https://${publicHost}:${grpcPort}"
    Write-Ok "grpc_server_url set to $grpcServerUrl"
} else {
    Write-Host ""
    Write-Host "  To expose your gRPC port, run ngrok in a separate terminal:" -ForegroundColor Yellow
    Write-Host "    1. Install ngrok: https://ngrok.com/download" -ForegroundColor DarkGray
    Write-Host "    2. Run:  ngrok http --app-protocol=http2 https://localhost:$grpcPort" -ForegroundColor DarkGray
    Write-Host "    3. Copy the Forwarding URL, e.g. https://abc123.ngrok-free.app" -ForegroundColor DarkGray
    Write-Host ""
    $grpcServerUrl = Ask "  Paste your ngrok URL"
    Write-Ok "grpc_server_url set to $grpcServerUrl"
}
} # end if (-not $localAgentMode)

# ── Other server settings ─────────────────────────────────────────────────────

Write-Step "Server settings"
$httpPort    = Ask "  HTTP port" "1011"
$agentOs     = if ($localAgentMode) {
    if ($env:OS -eq 'Windows_NT' -or $IsWindows) { "windows" } else { "linux" }
} else { "linux" }
$insecureStr = if ($localAgentMode) { "true" } else { "false" }

# ── Frontend directory ────────────────────────────────────────────────────────

$frontendDir = if ($installFrontend) { "$InstallDir\frontend" } else { "" }

# ── Downloads ─────────────────────────────────────────────────────────────────

Write-Step "Rusty Browser binaries"
if ($ForceInstall -or -not (Test-Path "$InstallDir\rusty.exe")) {
    Write-Info "Downloading rusty.exe..."
    Save-Asset "https://github.com/$RustyRepo/releases/download/v$VersionServer/rusty.exe" "$InstallDir\rusty.exe"
} else { Write-Info "rusty.exe already present, skipping" }
Write-Ok "rusty.exe"

if ($installCli) {
    if ($ForceInstall -or -not (Test-Path "$InstallDir\rusty-cli.exe")) {
        Write-Info "Downloading rusty-cli.exe..."
        Save-Asset "https://github.com/$RustyRepo/releases/download/v$VersionCli/rusty-cli.exe" "$InstallDir\rusty-cli.exe"
    } else { Write-Info "rusty-cli.exe already present, skipping" }
    Write-Ok "rusty-cli.exe"
}

Write-Step "Flux binary"
if ($ForceInstall -or -not (Test-Path "$InstallDir\flux.exe")) {
    Write-Info "Downloading flux.exe..."
    Save-Asset "https://github.com/$FluxRepo/releases/download/v$VersionFlux/flux.exe" "$InstallDir\flux.exe"
} else { Write-Info "flux.exe already present, skipping" }
Write-Ok "flux.exe"

if ($localAgentMode) {
    Write-Step "Serverless-agent binary"
    if ($ForceInstall -or -not (Test-Path "$InstallDir\flux-agent.exe")) {
        Write-Info "Downloading flux-agent.exe..."
        Save-Asset "https://github.com/$ServerlessAgentRepo/releases/download/v$VersionServerlessAgent/flux-agent.exe" "$InstallDir\flux-agent.exe"
    } else { Write-Info "flux-agent.exe already present, skipping" }
    Write-Ok "flux-agent.exe"
}

# ── Write rusty.yaml ──────────────────────────────────────────────────────────

Write-Step "Writing rusty.yaml"

if ($grpcServerUrl -ne "") {
    $grpcLine = "  grpc_server_url: `"$grpcServerUrl`""
} else {
    $grpcLine = "  grpc_server_url: `"http://localhost:$grpcPort`""
}

$fluxSection = @"
flux:
  base_url: "http://127.0.0.1:7227"
  api_key: "$fluxApiKey"
  function_name: "rusty-agent"
  pending_timeout_secs: 120
"@

@"
server:
  http_port: $httpPort
  grpc_port: $grpcPort
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
"@ | ForEach-Object { Write-File "$InstallDir\rusty.yaml" $_ }

Write-Ok "rusty.yaml"

# ── Write flux.yaml ───────────────────────────────────────────────────────────

Write-Step "Writing flux.yaml"

$providersBlock = if ($localAgentMode) { "" } else { "`nproviders:$awsBlock$gcpBlock" }

@"
api_key: "$fluxApiKey"
redis_addr: $redisAddr
agent_port: $grpcPort
disable_grpc_tls: $insecureStr$providersBlock
"@ | ForEach-Object { Write-File "$InstallDir\flux.yaml" $_ }

Write-Ok "flux.yaml"

# ── Write agent.yaml (local mode only) ───────────────────────────────────────

if ($localAgentMode) {
    Write-Step "Writing agent.yaml"
    @"
agent_id: agent-1
port: 50052

tls:
  enabled: false

network:
  node_public_ip: 127.0.0.1
"@ | ForEach-Object { Write-File "$InstallDir\agent.yaml" $_ }
    Write-Ok "agent.yaml"
}

if ($installFrontend) {
    Write-Step "Frontend"
    if ($ForceInstall -or -not (Test-Path $frontendDir)) {
        $feZip = Join-Path $env:TEMP "rusty-frontend.zip"
        Write-Info "Downloading rusty-frontend.zip..."
        Save-Asset "https://github.com/$RustyRepo/releases/download/v$VersionFrontend/rusty-frontend.zip" $feZip
        if (Test-Path $frontendDir) { Remove-Item $frontendDir -Recurse -Force }
        New-Item -ItemType Directory -Path $frontendDir -Force | Out-Null
        Expand-Archive $feZip $frontendDir -Force
        Remove-Item $feZip -Force
        Write-Ok "frontend extracted to $frontendDir"
    } else { Write-Info "frontend already present, skipping" }
}

# ── Generate rusty-launch.ps1 ─────────────────────────────────────────────────

Write-Step "Generating rusty-launch.ps1"

$safeInstall  = $InstallDir  -replace "'", "''"
$safeFrontend = $frontendDir -replace "'", "''"

$launchHeader = @"
#Requires -Version 5.1
<#
.SYNOPSIS
    Launch the Rusty Browser stack.

.PARAMETER Frontend
    Also start the frontend server.

.EXAMPLE
    .\rusty-launch.ps1
    .\rusty-launch.ps1 -Frontend
#>
param(
    [switch]`$Frontend
)

`$ErrorActionPreference = "Stop"
`$InstallDir = '$safeInstall'
`$ServerBin  = Join-Path `$InstallDir 'rusty.exe'

if (-not (Test-Path `$ServerBin)) {
    Write-Error "rusty.exe not found at `$ServerBin -- run setup.ps1 first"
    exit 1
}

function Open-Window([string]`$title, [string]`$cmd) {
    `$p = New-Object System.Diagnostics.ProcessStartInfo
    `$p.FileName         = "powershell.exe"
    `$p.Arguments        = "-NoExit -NoLogo -Command ``"`$cmd``""
    `$p.WorkingDirectory = `$InstallDir
    `$p.UseShellExecute  = `$true
    [System.Diagnostics.Process]::Start(`$p) | Out-Null
}

Write-Host ""

"@

$launchBody = if ($localAgentMode) { @"
if (Get-Command wt -ErrorAction SilentlyContinue) {
    `$wtArgs  = "new-tab --title ``"Flux``" --startingDirectory ``"`$InstallDir``" -- powershell -NoExit -NoLogo -Command ``"& '`$InstallDir\flux.exe'``""
    `$wtArgs += " ; new-tab --title ``"Flux Agent``" --startingDirectory ``"`$InstallDir``" -- powershell -NoExit -NoLogo -Command ``"& '`$InstallDir\flux-agent.exe'``""
    `$wtArgs += " ; new-tab --title ``"Rusty Server``" --startingDirectory ``"`$InstallDir``" -- powershell -NoExit -NoLogo -Command ``"& '`$InstallDir\rusty-server.ps1'``""
    if (`$Frontend) {
        `$wtArgs += " ; new-tab --title ``"Rusty Frontend``" --startingDirectory ``"`$InstallDir``" -- powershell -NoExit -NoLogo -Command ``"& '`$InstallDir\rusty-frontend.ps1'``""
    }
    Write-Host "  Opening tabs: Flux, Flux Agent, Rusty Server`$(if (`$Frontend) { ', Rusty Frontend' })" -ForegroundColor Cyan
    Start-Process wt -ArgumentList `$wtArgs
} else {
    Write-Host "  Starting Flux server..." -ForegroundColor Cyan
    Open-Window "Flux" "& '`$InstallDir\flux.exe'"
    Write-Host "  Starting Flux agent..." -ForegroundColor Cyan
    Open-Window "Flux Agent" "& '`$InstallDir\flux-agent.exe'"
    Write-Host "  Starting Rusty Server..." -ForegroundColor Cyan
    Open-Window "Rusty Server" "& '`$InstallDir\rusty-server.ps1'"
    if (`$Frontend) {
        Write-Host "  Starting Rusty Frontend..." -ForegroundColor Cyan
        Open-Window "Rusty Frontend" "& '`$InstallDir\rusty-frontend.ps1'"
    }
}

Write-Host "  Waiting for Flux to be ready..." -ForegroundColor DarkGray
Start-Sleep -Seconds 4

Write-Host "  Registering agent with Flux..." -ForegroundColor Cyan
try {
    Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:7227/agents/register" ``
        -ContentType "application/json" ``
        -Headers @{ Authorization = "Bearer $fluxApiKey" } ``
        -Body '{"address":"localhost:50052"}' | Out-Null
    Write-Host "  Agent registered" -ForegroundColor Green
} catch {
    Write-Warning "  Agent registration failed: `$_  (retry manually if needed)"
}
"@ } else { @"
if (Get-Command wt -ErrorAction SilentlyContinue) {
    `$wtArgs  = "new-tab --title ``"Rusty Server``" --startingDirectory ``"`$InstallDir``" -- powershell -NoExit -NoLogo -Command ``"& '`$InstallDir\rusty-server.ps1'``""
    if (`$Frontend) {
        `$wtArgs += " ; new-tab --title ``"Rusty Frontend``" --startingDirectory ``"`$InstallDir``" -- powershell -NoExit -NoLogo -Command ``"& '`$InstallDir\rusty-frontend.ps1'``""
    }
    Write-Host "  Opening tabs: Rusty Server`$(if (`$Frontend) { ', Rusty Frontend' })" -ForegroundColor Cyan
    Start-Process wt -ArgumentList `$wtArgs
} else {
    Write-Host "  Starting Rusty Server..." -ForegroundColor Cyan
    Open-Window "Rusty Server" "& '`$InstallDir\rusty-server.ps1'"
    if (`$Frontend) {
        Write-Host "  Starting Rusty Frontend..." -ForegroundColor Cyan
        Open-Window "Rusty Frontend" "& '`$InstallDir\rusty-frontend.ps1'"
    }
}
"@ }

$launchFooter = @"

Write-Host "  Server: http://localhost:$httpPort" -ForegroundColor Green
if (`$Frontend) { Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Green }
Write-Host ""
Write-Host "  First run? After the server is ready:" -ForegroundColor Yellow
Write-Host "    rusty-cli init" -ForegroundColor DarkGray
Write-Host "    # or: curl -X POST http://localhost:$httpPort/initialize/" -ForegroundColor DarkGray
Write-Host ""
"@

Write-File "$InstallDir\rusty-launch.ps1" ($launchHeader + $launchBody + $launchFooter)

Write-Ok "rusty-launch.ps1"

@"
@echo off
powershell.exe -NoLogo -NoExit -File "%~dp0rusty-launch.ps1" %*
"@ | Set-Content "$InstallDir\rusty-launch.cmd" -Encoding ascii

Write-Ok "rusty-launch.cmd"

# ── Generate rusty-server.ps1 wrapper ────────────────────────────────────────

@"
`$env:RUSTY_CONFIG = '$safeInstall\rusty.yaml'
& '$safeInstall\rusty.exe'
"@ | ForEach-Object { Write-File "$InstallDir\rusty-server.ps1" $_ }

Write-Ok "rusty-server.ps1"

# ── Generate rusty-frontend command ──────────────────────────────────────────

if ($frontendDir) {
    @"
#Requires -Version 5.1
`$ErrorActionPreference = "Stop"
`$ServerJs = '$safeFrontend\server.js'
if (-not (Test-Path `$ServerJs)) {
    Write-Error "Frontend not found at `$ServerJs -- run setup again with frontend enabled"
    exit 1
}
`$env:PORT = '3000'
Write-Host "  Rusty Frontend: http://localhost:3000" -ForegroundColor Green
node `$ServerJs
"@ | ForEach-Object { Write-File "$InstallDir\rusty-frontend.ps1" $_ }

    @"
@echo off
powershell.exe -NoLogo -NoExit -File "%~dp0rusty-frontend.ps1" %*
"@ | Set-Content "$InstallDir\rusty-frontend.cmd" -Encoding ascii

    Write-Ok "rusty-frontend.cmd"
}

# ── PATH ──────────────────────────────────────────────────────────────────────

$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$InstallDir*") {
    Write-Host ""
    if (Ask-YN "Add '$InstallDir' to your PATH?" $true) {
        [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$InstallDir", "User")
        $env:Path = "$env:Path;$InstallDir"
        Write-Ok "Added to PATH -- restart open terminals to pick it up"
    }
}

# ── Summary ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Files written to: $InstallDir" -ForegroundColor White
Write-Host "    rusty.yaml         server config"
Write-Host "    flux.yaml          Flux server config"
Write-Host "    rusty-launch.ps1   start the stack"
Write-Host ""
Write-Host "  Keys (save these somewhere safe):" -ForegroundColor Yellow
Write-Host "    Server API key : $serverApiKey"
Write-Host "    Flux API key   : $fluxApiKey"
Write-Host ""
Write-Host "  To start:"
Write-Host "    rusty-launch              # server only"
Write-Host "    rusty-launch -Frontend    # server + frontend"
Write-Host ""
if ($installFrontend) {
    Write-Host "  To start the frontend only:"
    Write-Host "    rusty-frontend"
    Write-Host ""
}
Write-Host "  Then initialize once (generates TLS certs + deploys agent to Flux):"
Write-Host "    rusty-cli init"
Write-Host "    # or use the frontend UI"
Write-Host ""
