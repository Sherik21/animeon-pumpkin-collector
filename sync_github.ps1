# sync_github.ps1 - Automated GitHub Repository Sync Script
param (
    [string]$TargetDir = (Get-Location).Path,
    [string]$RepoUrl = "",
    [string]$CommitMsg = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# 1. Switch to TargetDir
if (-not (Test-Path $TargetDir)) {
    Write-Err "Target directory '$TargetDir' does not exist."
    exit 1
}
Set-Location $TargetDir
Write-Info "Working directory: $TargetDir"

# 2. Check Git installed
try {
    $gitVer = git --version
    Write-Info "Git version: $gitVer"
} catch {
    Write-Err "Git is not installed or not in PATH."
    exit 1
}

# 3. Check author config
$userName = git config user.name
$userEmail = git config user.email
if (-not $userName) {
    git config --global user.name "Sherik21"
    Write-Info "Configured global git user.name: Sherik21"
}
if (-not $userEmail) {
    git config --global user.email "danil.konyshev21@gmail.com"
    Write-Info "Configured global git user.email: danil.konyshev21@gmail.com"
}

# 4. Check if repo initialized
if (-not (Test-Path ".git")) {
    Write-Info "Initializing new Git repository..."
    git init
    git branch -M main
}

# 5. Check .gitignore
if (-not (Test-Path ".gitignore")) {
    Write-Info "Creating sensible .gitignore..."
    @"
# OS files
Thumbs.db
ehthumbs.db
Desktop.ini
`$RECYCLE.BIN/
.DS_Store

# Editor directories
.vscode/
.idea/
*.suo
*.user
*.bak
*.tmp

# Dependencies & environment
node_modules/
.env
.env.local
"@ | Out-File -FilePath ".gitignore" -Encoding utf8
}

# 6. Check remote origin
$remotes = git remote -v
if (-not $remotes) {
    if ($RepoUrl) {
        Write-Info "Adding remote origin: $RepoUrl"
        git remote add origin $RepoUrl
    } else {
        Write-Warn "No remote 'origin' configured. Pass -RepoUrl to set it."
    }
} else {
    Write-Info "Current remote origin: $remotes"
}

# 7. Check changes
$status = git status --short
if (-not $status) {
    Write-Success "Working tree is clean. Nothing to commit."
} else {
    Write-Info "Staging changes..."
    git add -A

    if (-not $CommitMsg) {
        $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        $CommitMsg = "Update project files: $timestamp"
    }

    Write-Info "Creating commit: '$CommitMsg'..."
    git commit -m $CommitMsg
    Write-Success "Committed successfully."
}

# 8. Push to GitHub if remote exists
$hasOrigin = git remote
if ($hasOrigin) {
    Write-Info "Pushing to GitHub (branch: main)..."
    try {
        if ($Force) {
            git push -u origin main --force
        } else {
            git push -u origin main
        }
        Write-Success "Successfully pushed to GitHub!"
    } catch {
        Write-Warn "Standard push failed. If this is a newly created repo with a remote README placeholder, retry with -Force."
        throw $_
    }
}
