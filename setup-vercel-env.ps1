param(
  [Parameter(Mandatory = $true)]
  [string]$Token
)

$headers = @{
  Authorization = "Bearer $Token"
  "Content-Type" = "application/json"
}

# Find the project
$projects = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects?search=solemate" -Headers $headers -Method Get
$project = $projects.projects | Where-Object { $_.name -like "*solemate*" } | Select-Object -First 1

if (-not $project) {
  Write-Host "Could not find a project named 'solemate'. Available projects:"
  $projects.projects | ForEach-Object { Write-Host "  - $($_.name)" }
  exit 1
}

$projectId = $project.id
Write-Host "Project: $($project.name) (ID: $projectId)"

$envVars = @(
  @{ type = "encrypted"; key = "VITE_SUPABASE_URL"; value = "https://ijiqrinhueknwhcyuzhj.supabase.co"; target = @("production", "preview", "development") }
  @{ type = "encrypted"; key = "VITE_SUPABASE_PUBLISHABLE_KEY"; value = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaXFyaW5odWVrbndoY3l1emhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjI4NTYsImV4cCI6MjA5NzA5ODg1Nn0.oG0F7O8dDSkAeVs0DFU0czGXtBc3641pv5ggzNQaZps"; target = @("production", "preview", "development") }
  @{ type = "encrypted"; key = "VITE_SUPABASE_PROJECT_ID"; value = "ijiqrinhueknwhcyuzhj"; target = @("production", "preview", "development") }
  @{ type = "encrypted"; key = "SUPABASE_URL"; value = "https://ijiqrinhueknwhcyuzhj.supabase.co"; target = @("production", "preview", "development") }
  @{ type = "encrypted"; key = "SUPABASE_PUBLISHABLE_KEY"; value = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaXFyaW5odWVrbndoY3l1emhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjI4NTYsImV4cCI6MjA5NzA5ODg1Nn0.oG0F7O8dDSkAeVs0DFU0czGXtBc3641pv5ggzNQaZps"; target = @("production", "preview", "development") }
  @{ type = "encrypted"; key = "SUPABASE_SERVICE_ROLE_KEY"; value = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqaXFyaW5odWVrbndoY3l1emhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTUyMjg1NiwiZXhwIjoyMDk3MDk4ODU2fQ.xB6XsfMp183XjPd4-rI9KXxLAJuYjv6bTrxbzCAm1mM"; target = @("production", "preview", "development") }
  @{ type = "encrypted"; key = "NODE_ENV"; value = "production"; target = @("production", "preview", "development") }
)

foreach ($env in $envVars) {
  $body = $env | ConvertTo-Json -Compress
  try {
    $result = Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env" -Headers $headers -Method Post -Body $body
    Write-Host "  ✅ $($env.key) set successfully"
  } catch {
    $err = $_.Exception.Response
    if ($err.StatusCode -eq 409) {
      # Already exists - try updating
      $getUrl = "https://api.vercel.com/v10/projects/$projectId/env?key=$($env.key)&target=production"
      $existing = Invoke-RestMethod -Uri $getUrl -Headers $headers -Method Get
      foreach ($rec in $existing.envs) {
        $delUrl = "https://api.vercel.com/v10/projects/$projectId/env/$($rec.id)"
        Invoke-RestMethod -Uri $delUrl -Headers $headers -Method Delete | Out-Null
      }
      # Retry create
      Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env" -Headers $headers -Method Post -Body $body | Out-Null
      Write-Host "  ✅ $($env.key) updated"
    } else {
      Write-Host "  ❌ $($env.key) failed: $($_.Exception.Message)"
    }
  }
}

Write-Host ""
Write-Host "Done! Now go to Vercel and redeploy:"
Write-Host "  https://vercel.com/chillguy295/solemate/deployments"
