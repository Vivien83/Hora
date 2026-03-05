# ─────────────────────────────────────────────────────────────────
#  HORA Launcher (PowerShell) — Windows native, no bash dependency
#
#  Called by hora.cmd. Does banner + dashboard + git init, then
#  launches claude directly — no console state alteration.
# ─────────────────────────────────────────────────────────────────

param(
    [switch]$NoDash,
    [switch]$NoUpdate,
    [switch]$Yolo,
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$ClaudeArgs
)

$ErrorActionPreference = "SilentlyContinue"
$CLAUDE_DIR = "$env:USERPROFILE\.claude"
$DASHBOARD_DIR = "$CLAUDE_DIR\dashboard"
$MEMORY_DIR = "$CLAUDE_DIR\MEMORY"

# ─── Banner ──────────────────────────────────────────────────────

$esc = [char]27
$GOLD = "$esc[38;2;212;168;83m"
$DIM_GOLD = "$esc[38;2;160;128;64m"
$B = "$esc[1m"
$D = "$esc[2m"
$R = "$esc[0m"
$W = "$esc[97m"

Write-Host ""
Write-Host "${GOLD}${B}  ██╗  ██╗ ██████╗ ██████╗  █████╗ ${R}"
Write-Host "${GOLD}${B}  ██║  ██║██╔═══██╗██╔══██╗██╔══██╗${R}"
Write-Host "${GOLD}${B}  ███████║██║   ██║██████╔╝███████║${R}"
Write-Host "${GOLD}${B}  ██╔══██║██║   ██║██╔══██╗██╔══██║${R}"
Write-Host "${GOLD}${B}  ██║  ██║╚██████╔╝██║  ██║██║  ██║${R}"
Write-Host "${DIM_GOLD}  ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝${R}"
Write-Host ""

if ($Yolo) {
    Write-Host "  ${D}your memory never sleeps.${R}  ${GOLD}${B}YOLO${R}"
} else {
    Write-Host "  ${D}your memory never sleeps.${R}"
}
Write-Host "  ${DIM_GOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}"

# Dynamic stats
$entities = 0; $facts = 0; $sessions = 0
$entFile = "$MEMORY_DIR\GRAPH\entities.jsonl"
$factFile = "$MEMORY_DIR\GRAPH\facts.jsonl"
$sessDir = "$MEMORY_DIR\SESSIONS"

if (Test-Path $entFile) { $entities = (Get-Content $entFile | Measure-Object -Line).Lines }
if (Test-Path $factFile) { $facts = (Get-Content $factFile | Measure-Object -Line).Lines }
if (Test-Path $sessDir) { $sessions = (Get-ChildItem "$sessDir\*.md" -ErrorAction SilentlyContinue | Measure-Object).Count }

Write-Host "  ${W}⟐${R} ${D}${entities} entites${R} ${DIM_GOLD}│${R} ${D}${facts} facts${R} ${DIM_GOLD}│${R} ${D}${sessions} sessions${R}"
Write-Host ""

# ─── Auto-update ──────────────────────────────────────────────────

$repoFile = "$CLAUDE_DIR\.hora-repo"
if (-not $NoUpdate -and (Test-Path $repoFile)) {
    $horaRepo = (Get-Content $repoFile -Raw).Trim()
    if (Test-Path "$horaRepo\.git") {
        Push-Location $horaRepo
        git fetch --quiet 2>$null
        $localHead = git rev-parse HEAD 2>$null
        $remoteHead = git rev-parse '@{u}' 2>$null
        if ($localHead -and $remoteHead -and $localHead -ne $remoteHead) {
            $behind = git rev-list --count "HEAD..@{u}" 2>$null
            if ([int]$behind -gt 0) {
                Write-Host "${GOLD}  ⟳ Update disponible (${behind} commit(s))...${R}"
                git stash --quiet 2>$null
                $pullResult = git pull --quiet 2>$null
                if ($LASTEXITCODE -eq 0 -and (Test-Path "install.sh")) {
                    bash install.sh --quiet 2>$null
                    Write-Host "$esc[32m  ✓ HORA mis à jour$esc[0m"
                } else {
                    Write-Host "$esc[33m  ! Update échoué (non-bloquant)$esc[0m"
                }
                git stash pop --quiet 2>$null
            }
        }
        Pop-Location
    }
}

# ─── Dashboard ──────────────────────────────────────────────────

$dashPid = $null
if (-not $NoDash -and (Test-Path $DASHBOARD_DIR)) {
    # Check if already running
    $listening = netstat -ano 2>$null | Select-String ":3847.*LISTENING"
    if ($listening) {
        Write-Host "$esc[90m◈ HORA Dashboard already running → http://localhost:3847$esc[0m"
    } else {
        # Install deps if needed
        if (-not (Test-Path "$DASHBOARD_DIR\node_modules")) {
            Write-Host "$esc[90m◈ Installing dashboard dependencies...$esc[0m"
            Push-Location $DASHBOARD_DIR
            npm install --silent 2>$null
            Pop-Location
        }

        # Collect data
        $collectScript = "$DASHBOARD_DIR\scripts\collect-data.ts"
        if (Test-Path $collectScript) {
            $env:HORA_PROJECT_DIR = (Get-Location).Path
            Push-Location $DASHBOARD_DIR
            npx tsx scripts/collect-data.ts 2>$null
            Pop-Location
        }

        # Start Vite in background
        $env:HORA_PROJECT_DIR = (Get-Location).Path
        $dashJob = Start-Process -FilePath "npx" -ArgumentList "vite --port 3847" -WorkingDirectory $DASHBOARD_DIR -WindowStyle Hidden -PassThru
        $dashPid = $dashJob.Id
        Start-Sleep -Seconds 1

        if (-not $dashJob.HasExited) {
            Write-Host "$esc[90m◈ HORA Dashboard → http://localhost:3847$esc[0m"
        }
    }
}

# ─── Project init ──────────────────────────────────────────────

$needCommit = $false
$horaDir = ".hora"

if (-not (Test-Path "$horaDir\project-id")) {
    New-Item -ItemType Directory -Path $horaDir -Force | Out-Null
    $id = (Get-Date -UFormat %s) + (Get-Random)
    $hash = [System.BitConverter]::ToString(
        [System.Security.Cryptography.SHA256]::Create().ComputeHash(
            [System.Text.Encoding]::UTF8.GetBytes($id)
        )
    ).Replace("-","").Substring(0,12).ToLower()
    Set-Content "$horaDir\project-id" $hash -NoNewline
    Write-Host "$esc[90m◈ HORA project initialized (.hora/project-id)$esc[0m"
    $needCommit = $true
}

# Check git repo
$gitRoot = git rev-parse --show-toplevel 2>$null
$currentDir = (Get-Location).Path
if (-not $gitRoot -or (Resolve-Path $gitRoot -ErrorAction SilentlyContinue).Path -ne $currentDir) {
    Write-Host "$esc[90m◈ Initializing git repo...$esc[0m"
    git init -q 2>$null
    git config core.autocrlf input 2>$null
    if (-not (Test-Path ".gitignore")) {
        @"
node_modules/
dist/
.env
.env.local
.DS_Store
*.log
"@ | Set-Content ".gitignore"
    }
    $needCommit = $true
}

if ($needCommit) {
    git add -A 2>$null
    git commit -q -m "init: hora project" --allow-empty 2>$null
}

# ─── Build claude args ──────────────────────────────────────────

$allArgs = @()
if ($Yolo) {
    $allArgs += "--allowedTools"
    $allArgs += @("Edit","Write","MultiEdit",
        "Bash(npm:*)","Bash(npx:*)","Bash(node:*)",
        "Bash(git status:*)","Bash(git diff:*)","Bash(git log:*)",
        "Bash(git add:*)","Bash(git commit:*)","Bash(git branch:*)",
        "Bash(git checkout:*)","Bash(git stash:*)",
        "Bash(ls:*)","Bash(mkdir:*)","Bash(cp:*)","Bash(mv:*)",
        "Bash(cat:*)","Bash(head:*)","Bash(tail:*)","Bash(wc:*)",
        "Bash(diff:*)","Bash(echo:*)","Bash(printf:*)",
        "Bash(test:*)","Bash(which:*)","Bash(pwd:*)","Bash(date:*)",
        "Read","Glob","Grep","WebSearch","WebFetch",
        "Task","TaskCreate","TaskUpdate","TaskList","TaskGet","NotebookEdit")
}
if ($ClaudeArgs) { $allArgs += $ClaudeArgs }

# ─── Launch Claude Code ──────────────────────────────────────────

try {
    if ($allArgs.Count -gt 0) {
        & claude @allArgs
    } else {
        & claude
    }
} finally {
    # Cleanup dashboard
    if ($dashPid) {
        Stop-Process -Id $dashPid -Force -ErrorAction SilentlyContinue
    }
}
