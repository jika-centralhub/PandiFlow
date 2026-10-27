# Enregistre la clé API OpenAI dans les secrets Supabase de Pandi (Edge Function make-portrait).
# La clé est saisie de façon masquée, passe par un fichier temporaire effacé aussitôt,
# et n'est jamais affichée, ni écrite dans l'historique du terminal ou dans le dépôt.
$ErrorActionPreference = 'Stop'
$sb = Join-Path $env:LOCALAPPDATA 'supabase-cli\supabase.exe'
$ref = 'kyhhkhmwdostzdaksxzw'

Write-Host ''
Write-Host 'Colle ta clé API OpenAI (elle commence par sk-) puis appuie sur Entrée.' -ForegroundColor Cyan
Write-Host 'Rien ne s''affiche pendant la saisie, c''est normal.' -ForegroundColor DarkGray
$secure = Read-Host -AsSecureString 'Clé OpenAI'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if (-not $key) { Write-Host 'Aucune clé saisie, rien n''a été modifié.' -ForegroundColor Yellow; exit 1 }
if (-not $key.StartsWith('sk-')) { Write-Host 'Attention : cette clé ne commence pas par sk-. Je l''enregistre quand même.' -ForegroundColor Yellow }

$tmp = New-TemporaryFile
try {
  [IO.File]::WriteAllText($tmp.FullName, "OPENAI_API_KEY=$key")
  & $sb secrets set --project-ref $ref --env-file $tmp.FullName
  if ($LASTEXITCODE -eq 0) { Write-Host 'C''est fait : la clé OpenAI est enregistrée dans Supabase.' -ForegroundColor Green }
} finally {
  Remove-Item $tmp.FullName -Force -ErrorAction SilentlyContinue
  $key = $null
}
