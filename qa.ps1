#!/usr/bin/env pwsh
# RERA Full QA Battery
# Run from root: .\qa.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  RERA QA Battery" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$failed = @()

# ── 1. Django system check ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/5] Django system check..." -ForegroundColor Yellow
try {
    & "$root\venv\Scripts\python.exe" "$root\manage.py" check
    Write-Host "      PASS" -ForegroundColor Green
} catch {
    Write-Host "      FAIL" -ForegroundColor Red
    $failed += "Django system check"
}

# ── 2. Backend pytest ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/5] Backend tests (pytest)..." -ForegroundColor Yellow
try {
    & "$root\venv\Scripts\python.exe" -m pytest -q
    Write-Host "      PASS" -ForegroundColor Green
} catch {
    Write-Host "      FAIL" -ForegroundColor Red
    $failed += "Backend pytest"
}

# ── 3. Frontend tests (Vitest) ─────────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Frontend tests (Vitest)..." -ForegroundColor Yellow
try {
    Push-Location "$root\frontend"
    npm run test:run
    Write-Host "      PASS" -ForegroundColor Green
} catch {
    Write-Host "      FAIL" -ForegroundColor Red
    $failed += "Frontend Vitest"
} finally {
    Pop-Location
}

# ── 4. Frontend lint ───────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/5] Frontend lint (ESLint)..." -ForegroundColor Yellow
try {
    Push-Location "$root\frontend"
    npm run lint
    Write-Host "      PASS" -ForegroundColor Green
} catch {
    Write-Host "      FAIL" -ForegroundColor Red
    $failed += "Frontend ESLint"
} finally {
    Pop-Location
}

# ── 5. Frontend build ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "[5/5] Frontend production build..." -ForegroundColor Yellow
try {
    Push-Location "$root\frontend"
    npm run build
    Write-Host "      PASS" -ForegroundColor Green
} catch {
    Write-Host "      FAIL" -ForegroundColor Red
    $failed += "Frontend build"
} finally {
    Pop-Location
}

# ── Summary ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
if ($failed.Count -eq 0) {
    Write-Host "  ALL CHECKS PASSED" -ForegroundColor Green
} else {
    Write-Host "  FAILED: $($failed.Count) check(s)" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
