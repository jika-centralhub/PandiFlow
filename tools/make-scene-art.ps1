# Crée, une seule fois, les images façon film d'animation 3D des saynètes de la bulle
# « Transformation en cours… » (princesse, cowboy, super-héros, animaux, astronaute, pirate).
# Les images brutes (fond vert à détourer) vont dans tests/local/scene-art/ (hors dépôt),
# puis `python tools/make_scene_art.py` les détoure et les range dans assets/scenes/.
# La clé OpenAI est saisie de façon masquée, reste en mémoire et n'est écrite nulle part.
# Une image déjà créée n'est pas refaite : on peut relancer le script sans rien repayer.
# Usage : powershell -ExecutionPolicy Bypass -File tools/make-scene-art.ps1 [nom1,nom2…]
param([string[]]$Only = @())
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'tests\local\scene-art'
New-Item -ItemType Directory -Force $out | Out-Null

# Du plus récent au plus ancien : si le compte n'a pas accès à un modèle, on essaie le suivant
$models = @('gpt-image-2.5-sunburst', 'gpt-image-2', 'gpt-image-1.5', 'gpt-image-1')

$style = 'Pixar-style 3D animated feature film render, like the characters of Coco, Ratatouille or Zootopia: stylized appealing proportions, ' +
  'big expressive eyes with glossy irises and bright catchlights, soft rounded shapes, soft subsurface scattering, ' +
  'warm soft key light with a subtle rim light, cinematic high-detail render.'
$cutout = 'Show the whole character from head to toe, with everything it holds or rides, entirely inside the image with a comfortable margin on every side, never cropped. ' +
  'Perfectly flat, uniform pure chroma-key green background (#00FF00) with no gradient, no floor, no cast shadow, no scenery and no green light on the character. ' +
  'The character itself has no green at all. No text, no logo, no watermark.'
$scenery = 'Pixar-style 3D animated feature film background environment, rich warm colors, cinematic lighting, soft depth of field. ' +
  'An empty scene: no people, no characters, no animals, no text, no logo. Square composition with open space in the middle.'

$images = @(
  @{ name = 'princesse'; quality = 'high'; prompt = "A joyful little girl about 6 years old dressed as a fairy-tale princess: a flowing pink and lilac ball gown with sparkles, a small golden tiara, long wavy hair, twirling on her toes with the skirt flaring, one hand raising a magic wand topped with a glowing golden star, a big happy smile. $style $cutout" }
  @{ name = 'cowboy'; quality = 'high'; prompt = "A cheerful little boy about 7 years old dressed as a cowboy, with a brown cowboy hat, a red bandana, a leather vest, a checked shirt and boots, riding a cute chubby chestnut pony with a blond mane, seen from the side, both facing right, the pony in a joyful mid-gallop, the boy waving his hat high in one hand with a big grin. $style $cutout" }
  @{ name = 'heros'; quality = 'high'; prompt = "A brave little kid superhero about 7 years old flying horizontally to the right, one fist stretched forward, the body straight and the legs behind, wearing an original blue suit with a long red cape flowing behind and a yellow star emblem on the chest (not any existing hero), a small red eye mask, a confident smile, hair blown by the wind. $style $cutout" }
  @{ name = 'astronaute'; quality = 'high'; prompt = "A delighted little girl about 7 years old in a white and orange space suit with a round helmet and a clear glass visor showing her face, floating weightlessly in a relaxed star pose, waving one hand, a big amazed smile. $style $cutout" }
  @{ name = 'pirate'; quality = 'high'; prompt = "A cheerful little boy pirate captain about 7 years old, with a black tricorn hat, a red and white striped shirt, a blue coat with golden buttons, a toy wooden sword at his belt and a red and blue parrot on his shoulder, holding a brass spyglass, standing with his legs apart, a big playful grin. $style $cutout" }
  @{ name = 'lion'; quality = 'high'; prompt = "An adorable chubby lion cub with big golden eyes and a fluffy little mane, sitting up happily with one paw raised in a wave, mouth open in a joyful smile. $style $cutout" }
  @{ name = 'elephant'; quality = 'high'; prompt = "An adorable chubby baby elephant, light grey-blue with big floppy pink-lined ears, standing happily with its trunk raised high in a joyful trumpet, big shiny eyes. $style $cutout" }
  @{ name = 'panda'; quality = 'high'; prompt = "An adorable chubby baby panda sitting and clapping its paws, big shiny eyes, a joyful open-mouth smile. $style $cutout" }
  @{ name = 'fond_chateau'; quality = 'medium'; prompt = "A dreamy fairy-tale castle garden at golden hour: a pastel pink and white princess castle with pointed blue-roof towers in the distance, flowering hedges, rose bushes, a sparkling fountain, soft glowing light and floating sparkles. $scenery" }
  @{ name = 'fond_desert'; quality = 'medium'; prompt = "A sunny Wild West desert: red rock mesas and buttes, tall saguaro cacti, a dusty trail with a wooden fence, a bright blue sky with puffy clouds. $scenery" }
  @{ name = 'fond_ville'; quality = 'medium'; prompt = "A colorful cartoon city skyline at sunset seen from high above the rooftops: friendly rounded skyscrapers with glowing windows, soft pink and orange clouds, a warm sunset glow. $scenery" }
  @{ name = 'fond_espace'; quality = 'medium'; prompt = "Outer space: a colorful purple and blue nebula, twinkling stars, a big ringed orange planet, a small Earth far away, a soft glow. $scenery" }
  @{ name = 'fond_bateau'; quality = 'medium'; prompt = "The sunny wooden deck of a kid-friendly pirate ship at sea: big white sails, ropes, a treasure chest, a ship's wheel, a sparkling turquoise sea with a small palm island on the horizon, puffy clouds. $scenery" }
  @{ name = 'fond_jungle'; quality = 'medium'; prompt = "A lush friendly jungle clearing: giant tropical leaves, colorful flowers, hanging vines, a little waterfall into a pond, warm sunbeams through the canopy. $scenery" }
)
if ($Only.Count) { $images = $images | Where-Object { $Only -contains $_.name } }
$todo = @($images | Where-Object { -not (Test-Path (Join-Path $out "$($_.name).webp")) })
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
foreach ($img in $todo) {
  $i++
  $file = Join-Path $out "$($img.name).webp"
  Write-Host "[$i/$($todo.Count)] $($img.name)… " -NoNewline
  $done = $false
  $tries = 0
  $m = 0
  while (-not $done -and $m -lt $models.Count -and $tries -lt 6) {
    $tries++
    $body = @{ model = $models[$m]; prompt = $img.prompt; size = '1024x1024'; quality = $img.quality; n = 1; output_format = 'webp' } | ConvertTo-Json
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
