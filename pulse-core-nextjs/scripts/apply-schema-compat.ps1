[CmdletBinding()]
param(
  [string]$SchemaFile = "schema-compat.sql",
  [string]$DbUrl = $env:SUPABASE_DB_URL,
  [string]$ProjectRef = $env:SUPABASE_PROJECT_REF,
  [string]$DbPassword = $env:SUPABASE_DB_PASSWORD,
  [string]$DbUser = $env:SUPABASE_DB_USER
)

$ErrorActionPreference = "Stop"

function Import-DotEnv {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
      return
    }

    $parts = $line.Split('=', 2)
    if ($parts.Count -ne 2) {
      return
    }

    $name = $parts[0].Trim()
    if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
      return
    }

    $value = $parts[1]
    if (
      $value.Length -ge 2 -and
      (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$schemaPath = if ([System.IO.Path]::IsPathRooted($SchemaFile)) {
  $SchemaFile
} else {
  Join-Path $repoRoot $SchemaFile
}

if (-not (Test-Path -LiteralPath $schemaPath)) {
  throw "Schema file not found: $schemaPath"
}

# Load project env files for local execution convenience.
Import-DotEnv -Path (Join-Path $repoRoot ".env")
Import-DotEnv -Path (Join-Path $repoRoot ".env.local")

if ([string]::IsNullOrWhiteSpace($DbUrl)) {
  $DbUrl = $env:SUPABASE_DB_URL
}
if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
  $ProjectRef = $env:SUPABASE_PROJECT_REF
}
if ([string]::IsNullOrWhiteSpace($DbPassword)) {
  $DbPassword = $env:SUPABASE_DB_PASSWORD
}
if ([string]::IsNullOrWhiteSpace($DbUser)) {
  $DbUser = if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_USER)) { "postgres" } else { $env:SUPABASE_DB_USER }
}

if ([string]::IsNullOrWhiteSpace($DbUrl)) {
  if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
    $supabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
    if (-not [string]::IsNullOrWhiteSpace($supabaseUrl)) {
      $match = [regex]::Match($supabaseUrl, '^https://([a-z0-9-]+)\.supabase\.co/?$')
      if ($match.Success) {
        $ProjectRef = $match.Groups[1].Value
      }
    }
  }

  if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
    throw "Missing project reference. Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL."
  }
  if ([string]::IsNullOrWhiteSpace($DbPassword)) {
    throw "Missing DB password. Set SUPABASE_DB_PASSWORD or provide -DbUrl."
  }

  $encodedPassword = [System.Uri]::EscapeDataString($DbPassword)
  $DbUrl = "postgresql://${DbUser}:$encodedPassword@db.$ProjectRef.supabase.co:5432/postgres?sslmode=require"
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
  throw "psql is not installed or not in PATH. Install PostgreSQL client tools, then retry."
}

Write-Output "Applying migration file: $schemaPath"
& $psql.Source $DbUrl -v ON_ERROR_STOP=1 -f $schemaPath

if ($LASTEXITCODE -ne 0) {
  throw "psql exited with code $LASTEXITCODE"
}

Write-Output "Schema compatibility migration applied successfully."
