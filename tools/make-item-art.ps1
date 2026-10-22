# Crée, une seule fois, les images façon film d'animation 3D des objets de la boutique (véhicules,
# accessoires, objets du Judaïsme…), décrites dans tools/item-art.json.
# Les images brutes (fond uni à détourer) vont dans tests/local/item-art/ (hors dépôt),
# puis `python tools/make_item_art.py` les détoure et les range dans assets/items/.
# La clé OpenAI est saisie de façon masquée, reste en mémoire et n'est écrite nulle part.
# Une image déjà créée n'est pas refaite (on peut relancer sans rien repayer), sauf avec -Again :
# l'ancienne est alors gardée à côté (<nom>-old1.webp…).
# Usage : powershell -ExecutionPolicy Bypass -File tools/make-item-art.ps1 [-Only nom1,nom2…] [-Again]
param([string[]]$Only = @(), [switch]$Again)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'tests\local\item-art'
New-Item -ItemType Directory -Force $out | Out-Null
$spec = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'item-art.json') | ConvertFrom-Json

# Du plus récent au plus ancien : si le compte n'a pas accès à un modèle, on essaie le suivant
$models = @('gpt-image-2.5-sunburst', 'gpt-image-2', 'gpt-image-1.5', 'gpt-image-1')

$images = @($spec.items)
if ($Only.Count) { $images = @($images | Where-Object { $Only -contains $_.id }) }
if ($Again) {
  foreach ($img in $images) {
    $file = Join-Path $out "$($img.id).webp"
    if (Test-Path $file) {
      $k = 1
      while (Test-Path (Join-Path $out "$($img.id)-old$k.webp")) { $k++ }
      Rename-Item $file "$($img.id)-old$k.webp"
    }
  }
}
$todo = @($images | Where-Object { -not (Test-Path (Join-Path $out "$($_.id).webp")) })
if (-not $todo.Count) { Write-Host 'Toutes les images sont déjà créées.' -ForegroundColor Green; exit 0 }

Write-Host ''
Write-Host "$($todo.Count) image(s) à créer (environ 30 s chacune)." -ForegroundColor Cyan
Write-Host 'Colle ta clé API OpenAI (elle commence par sk-) puis appuie sur Entrée.' -ForegroundColor Cyan
Write-Host 'Rien ne s''affiche pendant la saisie, c''est normal.' -ForegroundColor DarkGray
$secure = Read-Host -AsSecureString 'Clé OpenAI'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if (-not $key) { Write-Host 'Aucune clé saisie, rien n''a été créé.' -ForegroundColor Yellow; exit 1 }

$ok = 0
$i = 0
$m = 0
foreach ($img in $todo) {
  $i++
  $file = Join-Path $out "$($img.id).webp"
  $prompt = "$($img.prompt) $($spec.style) $($spec.cutout.($img.key))"
  Write-Host "[$i/$($todo.Count)] $($img.id)… " -NoNewline
  $done = $false
  $tries = 0
  while (-not $done -and $m -lt $models.Count -and $tries -lt 6) {
    $tries++
    $body = @{ model = $models[$m]; prompt = $prompt; size = $img.size; quality = $img.quality; n = 1; output_format = 'webp' } | ConvertTo-Json
    try {
      $res = Invoke-RestMethod -Uri 'https://api.openai.com/v1/images/generations' -Method Post -Headers @{ Authorization = "Bearer $key" } `
        -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 300
      [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($res.data[0].b64_json))
      Write-Host "ok ($($models[$m]))" -ForegroundColor Green
      $ok++
      $done = $true
    } catch {
      $status = 0
      if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
      $msg = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
      if ($status -eq 401) { Write-Host 'clé refusée par OpenAI (401) : vérifie-la et relance.' -ForegroundColor Red; $key = $null; exit 1 }
      if ($status -eq 429) { Write-Host 'limite atteinte, je patiente 30 s… ' -NoNewline -ForegroundColor DarkYellow; Start-Sleep -Seconds 30; continue }
      if ($status -eq 404 -or (($status -eq 400 -or $status -eq 403) -and $msg -match 'model' -and $msg -notmatch 'verif')) { $m++; continue }
      Write-Host "échec : $msg" -ForegroundColor Red
      break
    }
  }
}
$key = $null
Write-Host ''
Write-Host "$ok image(s) créée(s) dans $out" -ForegroundColor Green
Write-Host 'Tu peux revenir dans Claude : je m''occupe de la suite.' -ForegroundColor Cyan
