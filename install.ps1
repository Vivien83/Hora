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

Write-Host ""
Write-Host "+===========================================+"
Write-Host "|       HORA - Windows Installation          |"
Write-Host "+===========================================+"
Write-Host ""

# --- Prerequisites ---

# 1. Claude Code
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] Claude Code introuvable." -ForegroundColor Red
    Write-Host "   Installe : winget install Anthropic.ClaudeCode"
    Write-Host "   Ou      : irm https://claude.ai/install.ps1 | iex"
    exit 1
}

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
    Write-Host "[ERREUR] Git Bash introuvable." -ForegroundColor Red
    Write-Host "   Claude Code sur Windows necessite Git for Windows."
    Write-Host "   Installe : https://git-scm.com/download/win"
    Write-Host ""
    Write-Host "   Si Git est installe dans un emplacement non standard :"
    Write-Host '   $env:CLAUDE_CODE_GIT_BASH_PATH = "C:\chemin\vers\bash.exe"'
    exit 1
}

Write-Host "[OK] Git Bash : $bashPath"

# 3. Node.js (pour npx tsx - hooks TypeScript)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERREUR] Node.js introuvable (requis pour les hooks TypeScript)." -ForegroundColor Red
    Write-Host "   Installe : https://nodejs.org/"
    exit 1
}
Write-Host "[OK] Node.js : $(node --version)"

# 4. tsx
$hasTsx = $false
try {
    node -e "require('tsx')" 2>$null
    $hasTsx = $true
} catch {}
if (-not $hasTsx -and -not (Get-Command tsx -ErrorAction SilentlyContinue)) {
    Write-Host "[INFO] Installation de tsx..."
    npm install -g tsx
}

# 5. jq (optionnel mais recommande pour la performance statusline)
if (-not (Get-Command jq -ErrorAction SilentlyContinue)) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "[INFO] Installation de jq (performance statusline)..."
        winget install jqlang.jq --accept-source-agreements --accept-package-agreements --silent 2>$null
        if (Get-Command jq -ErrorAction SilentlyContinue) {
            Write-Host "[OK] jq : $(jq --version)"
        } else {
            # winget installe mais PATH pas encore a jour dans cette session
            Write-Host "[OK] jq installe (disponible au prochain terminal)"
        }
    } else {
        Write-Host "[INFO] jq absent (optionnel - la statusline utilisera node)" -ForegroundColor Yellow
        Write-Host "   Installer manuellement : https://jqlang.github.io/jq/download/"
    }
} else {
    Write-Host "[OK] jq : $(jq --version)"
}

# --- Set CLAUDE_CODE_GIT_BASH_PATH if not already set ---
if (-not $env:CLAUDE_CODE_GIT_BASH_PATH) {
    Write-Host ""
    Write-Host "[IMPORTANT] Pour que les hooks Claude Code fonctionnent :" -ForegroundColor Yellow
    Write-Host "   Ajoute cette variable d'environnement :" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   [System.Environment]::SetEnvironmentVariable('CLAUDE_CODE_GIT_BASH_PATH', '$bashPath', 'User')" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   (Requis pour eviter le bug #22700 - Claude Code utilise 'bash' nu sans le chemin complet)"
    Write-Host ""

    # Set for current session
    $env:CLAUDE_CODE_GIT_BASH_PATH = $bashPath
}

# --- Delegate to bash install.sh ---
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$installSh = Join-Path $scriptDir "install.sh"

if (-not (Test-Path $installSh)) {
    Write-Host "[ERREUR] install.sh introuvable dans $scriptDir" -ForegroundColor Red
    exit 1
}

$bashArgs = @()
if ($DryRun) { $bashArgs += "--dry-run" }
if ($Restore) { $bashArgs += "--restore" }

Write-Host ""
Write-Host "[INFO] Delegation a bash install.sh..."
Write-Host ""

# Convert Windows path to Git Bash path
$installShUnix = $installSh -replace '\\', '/' -replace '^([A-Z]):', '/$1'.ToLower()
# Simpler: just pass the path as-is, Git Bash handles Windows paths
& $bashPath $installSh @bashArgs
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Host ""
    Write-Host "[ERREUR] Installation echouee (exit code: $exitCode)" -ForegroundColor Red
    exit $exitCode
}

# --- Post-install: remind about CLAUDE_CODE_GIT_BASH_PATH ---
if (-not [System.Environment]::GetEnvironmentVariable('CLAUDE_CODE_GIT_BASH_PATH', 'User')) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  ACTION REQUISE pour les hooks :" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Executer cette commande une seule fois :" -ForegroundColor White
    Write-Host ""
    Write-Host "  [System.Environment]::SetEnvironmentVariable('CLAUDE_CODE_GIT_BASH_PATH', '$bashPath', 'User')" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Puis relancer le terminal." -ForegroundColor White
    Write-Host ""
}
