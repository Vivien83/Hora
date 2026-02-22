# HORA - Windows Installation (PowerShell entry point)
# Finds Git Bash and delegates to install.sh
#
# Usage:
#   .\install.ps1              # Install
#   .\install.ps1 -DryRun      # Simulate
#   .\install.ps1 -Restore     # Rollback

param(
    [switch]$DryRun,
    [switch]$Restore
)

$ErrorActionPreference = "Stop"

# ─── UI Helpers ──────────────────────────────────────────────────────────────

function Write-Logo {
    Write-Host ""
    Write-Host "   _  _  ___  ___    _   " -ForegroundColor Cyan
    Write-Host "  | || |/ _ \| _ \  /_\  " -ForegroundColor Cyan
    Write-Host "  | __ | (_) |   / / _ \ " -ForegroundColor Cyan
    Write-Host "  |_||_|\___/|_|_\/_/ \_\" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Hybrid Orchestrated Reasoning Architecture" -ForegroundColor DarkGray
    Write-Host "  ──────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host ""
}
function Write-Step($msg) { Write-Host "  [$script:step/$script:totalSteps] $msg" -ForegroundColor White; $script:step++ }
function Write-Ok($msg) { Write-Host "    $([char]0x2713) $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    ! $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "    $([char]0x2717) $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "    · $msg" -ForegroundColor DarkGray }

$script:step = 1
$script:totalSteps = 4

# ─── Header ──────────────────────────────────────────────────────────────────

Write-Logo

# --- Prerequisites ---

Write-Step "Prerequis Windows"

# 1. Claude Code
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Err "Claude Code introuvable"
    Write-Info "winget install Anthropic.ClaudeCode"
    exit 1
}
Write-Ok "Claude Code"

# 2. Git for Windows (fournit bash.exe)
$bashPath = $null

# Check CLAUDE_CODE_GIT_BASH_PATH first
if ($env:CLAUDE_CODE_GIT_BASH_PATH -and (Test-Path $env:CLAUDE_CODE_GIT_BASH_PATH)) {
    $bashPath = $env:CLAUDE_CODE_GIT_BASH_PATH
}

# Standard Git for Windows locations
if (-not $bashPath) {
    $candidates = @(
        "$env:ProgramFiles\Git\bin\bash.exe",
        "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
        "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe",
        "C:\Git\bin\bash.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $bashPath = $c
            break
        }
    }
}

# Try PATH
if (-not $bashPath) {
    $found = Get-Command bash -ErrorAction SilentlyContinue
    if ($found) {
        # Reject WSL bash (System32\bash.exe)
        if ($found.Source -notlike "*System32*") {
            $bashPath = $found.Source
        }
    }
}

if (-not $bashPath) {
    Write-Err "Git Bash introuvable"
    Write-Info "https://git-scm.com/download/win"
    exit 1
}

Write-Ok "Git Bash"

# 3. Node.js (pour npx tsx - hooks TypeScript)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Err "Node.js introuvable"
    Write-Info "https://nodejs.org/"
    exit 1
}
Write-Ok "Node.js $(node --version)"

# 4. tsx
$hasTsx = $false
try {
    node -e "require('tsx')" 2>$null
    $hasTsx = $true
} catch {}
if (-not $hasTsx -and -not (Get-Command tsx -ErrorAction SilentlyContinue)) {
    Write-Info "Installation de tsx..."
    npm install -g tsx
}

# 5. jq (optionnel mais recommande pour la performance statusline)
if (-not (Get-Command jq -ErrorAction SilentlyContinue)) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Info "Installation de jq..."
        winget install jqlang.jq --accept-source-agreements --accept-package-agreements --silent 2>$null
        if (Get-Command jq -ErrorAction SilentlyContinue) {
            Write-Ok "jq $(jq --version)"
        } else {
            Write-Ok "jq installe (disponible au prochain terminal)"
        }
    } else {
        Write-Warn "jq absent (optionnel)"
    }
} else {
    Write-Ok "jq $(jq --version)"
}

# --- Set CLAUDE_CODE_GIT_BASH_PATH permanently ---

Write-Step "Environnement"

$currentEnv = [System.Environment]::GetEnvironmentVariable('CLAUDE_CODE_GIT_BASH_PATH', 'User')
if (-not $currentEnv -or -not (Test-Path $currentEnv)) {
    [System.Environment]::SetEnvironmentVariable('CLAUDE_CODE_GIT_BASH_PATH', $bashPath, 'User')
    $env:CLAUDE_CODE_GIT_BASH_PATH = $bashPath
    Write-Ok "CLAUDE_CODE_GIT_BASH_PATH"
} else {
    $env:CLAUDE_CODE_GIT_BASH_PATH = $currentEnv
    Write-Ok "CLAUDE_CODE_GIT_BASH_PATH"
}

# --- Delegate to bash install.sh ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$installSh = Join-Path $scriptDir "install.sh"

if (-not (Test-Path $installSh)) {
    Write-Err "install.sh introuvable dans $scriptDir"
    exit 1
}

$bashArgs = @()
if ($DryRun) { $bashArgs += "--dry-run" }
if ($Restore) { $bashArgs += "--restore" }

Write-Step "Installation (bash)"
Write-Host ""

# Convert Windows path to Git Bash path
$installShUnix = $installSh -replace '\\', '/' -replace '^([A-Z]):', '/$1'.ToLower()
# Simpler: just pass the path as-is, Git Bash handles Windows paths
& $bashPath $installSh @bashArgs
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host ""
    Write-Err "Installation echouee (exit code: $exitCode)"
    exit $exitCode
}

# --- Post-install: verify hooks work ---

Write-Step "Verification hooks"

$hookTs = Join-Path $env:USERPROFILE ".claude\hooks\prompt-submit.ts"
if (Test-Path $hookTs) {
    try {
        $hookResult = echo '{}' | cmd /c "npx tsx `"$hookTs`"" 2>$null
        if ($hookResult -and $hookResult -match "hookSpecificOutput") {
            Write-Ok "Hooks fonctionnels (cmd.exe)"
        } else {
            $hookResult2 = & $bashPath -c "echo '{}' | npx tsx ~/.claude/hooks/prompt-submit.ts 2>&1" 2>$null
            if ($hookResult2 -match "hookSpecificOutput") {
                Write-Ok "Hooks fonctionnels (Git Bash)"
            } else {
                Write-Warn "Hooks: format de retour inattendu"
            }
        }
    } catch {
        Write-Warn "Erreur test hooks : $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "  ──────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  $([char]0x2713) Installation Windows terminee" -ForegroundColor Green
Write-Host ""
Write-Host "  Demarrer   " -NoNewline; Write-Host "claude" -ForegroundColor Cyan
Write-Host "  Skills     " -NoNewline; Write-Host "/hora-design  /hora-forge  /hora-refactor  /hora-security  /hora-perf" -ForegroundColor DarkGray
Write-Host ""
