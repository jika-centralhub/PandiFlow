# Fait pointer pandiflow.com vers GitHub Pages via l'API Hostinger (https://developers.hostinger.com).
# Le jeton API Hostinger est saisi de façon masquée et n'est ni affiché ni enregistré.
# Seuls les enregistrements du site (@ et www) sont touchés : e-mail (MX, DKIM, SPF, DMARC, Brevo) inchangé.
# Hostinger garde un instantané (snapshot) de la zone : on peut revenir en arrière depuis hPanel.
#
# Option -SansIPv6 : retire les enregistrements AAAA de la racine et n'en remet pas (si la validation
# du certificat HTTPS de GitHub échoue en IPv6, le site reste joignable en IPv4).
param([switch]$SansIPv6)
$ErrorActionPreference = 'Stop'
$domain = 'pandiflow.com'
$api = "https://developers.hostinger.com/api/dns/v1/zones/$domain"
$githubIPv4 = '185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'
$githubIPv6 = '2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153'
$pagesHost = 'jika-centralhub.github.io.'

# Journal de l'exécution (jamais le jeton) : relisible même si l'onglet du terminal est fermé
$log = Join-Path $env:TEMP 'pandiflow-dns.log'
Set-Content -Path $log -Value "pandiflow-dns $(Get-Date -Format s)" -Encoding UTF8
function Say($msg, $color = 'Gray') {
  Write-Host $msg -ForegroundColor $color
  Add-Content -Path $log -Value $msg -Encoding UTF8
}

function Show-Zone($zone, $title) {
  Say ''
  Say $title 'Cyan'
  foreach ($rr in $zone) {
    $values = ($rr.records | ForEach-Object { $_.content }) -join ', '
    Say ('  {0,-6} {1,-34} {2}' -f $rr.type, $rr.name, $values)
  }
}

Write-Host ''
Write-Host 'Colle ton jeton API Hostinger puis appuie sur Entrée (rien ne s''affiche, c''est normal).' -ForegroundColor Cyan
$secure = Read-Host -AsSecureString 'Jeton Hostinger'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if (-not $token) { Say 'Aucun jeton saisi, rien n''a été modifié.' 'Yellow'; exit 1 }
Say "Jeton reçu ($($token.Length) caractères)." 'DarkGray'
$headers = @{ Authorization = "Bearer $token"; Accept = 'application/json' }

function Call($method, $body, $suffix = '') {
  $params = @{ Method = $method; Uri = "$api$suffix"; Headers = $headers; ContentType = 'application/json; charset=utf-8' }
  if ($body) { $params.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 8 -Compress)) }
  try { return Invoke-RestMethod @params }
  catch {
    # Windows PowerShell 5.1 ne remplit pas toujours ErrorDetails : on lit le corps de la réponse
    $detail = $_.ErrorDetails.Message
    if (-not $detail -and $_.Exception.Response) {
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream.CanSeek) { $stream.Position = 0 }
        $detail = (New-Object IO.StreamReader($stream)).ReadToEnd()
      } catch { }
    }
    if (-not $detail) { $detail = $_.Exception.Message }
    throw "Hostinger a refusé ($method$suffix) : $detail"
  }
}

# La liste renvoyée par l'API arrive en un seul bloc sous PowerShell 5.1 : on la déplie
function Get-Zone { return @((Call 'GET' $null) | ForEach-Object { $_ }) }

try {
  # 1. État actuel
  $zone = Get-Zone
  Show-Zone $zone "Enregistrements actuels de $domain :"

  # 2. On retire ce qui entre en conflit avec le site : parking sur www (un CNAME ne peut pas
  #    cohabiter avec un A), et tout ALIAS/CNAME sur la racine. Le CNAME www n'est pas supprimé :
  #    l'écriture le remplace sur place, sans instant où www n'existe plus
  $conflicts = @()
  foreach ($rr in $zone) {
    if (($rr.name -eq '@' -and $rr.type -in 'ALIAS', 'CNAME') -or ($rr.name -eq 'www' -and $rr.type -in 'A', 'AAAA', 'ALIAS') -or ($SansIPv6 -and $rr.name -eq '@' -and $rr.type -eq 'AAAA')) {
      $conflicts += @{ name = [string]$rr.name; type = [string]$rr.type }
    }
  }

  # 3. Enregistrements GitHub Pages (remplacent ceux de même nom et même type)
  $records = @(
    @{ name = '@'; type = 'A'; ttl = 3600; records = @($githubIPv4 | ForEach-Object { @{ content = $_ } }) },
    @{ name = 'www'; type = 'CNAME'; ttl = 3600; records = @(@{ content = $pagesHost }) }
  )
  if (-not $SansIPv6) {
    $records += @{ name = '@'; type = 'AAAA'; ttl = 3600; records = @($githubIPv6 | ForEach-Object { @{ content = $_ } }) }
  }
  $update = @{ overwrite = $true; zone = $records }

  if ($conflicts.Count) {
    Say ''
    Say ('Suppression : ' + (($conflicts | ForEach-Object { "$($_.type) $($_.name)" }) -join ', ')) 'Yellow'
    $null = Call 'DELETE' @{ filters = $conflicts }
    Say 'Suppression faite.' 'DarkGray'
  }

  # 4. Vérification par Hostinger avant d'écrire, puis écriture
  $null = Call 'POST' $update '/validate'
  Say 'Hostinger a validé les nouveaux enregistrements.' 'DarkGray'
  $null = Call 'PUT' $update

  # 5. Résultat
  Show-Zone (Get-Zone) "Nouveaux enregistrements de $domain :"
  Say ''
  Say 'C''est fait : pandiflow.com pointe vers GitHub Pages. La propagation peut prendre de quelques minutes à quelques heures.' 'Green'
  Say 'Pense à supprimer ce jeton dans hPanel si tu ne t''en sers plus.' 'DarkGray'
} catch {
  Say ''
  Say ([string]$_) 'Red'
  if ($update) { Say ('Corps envoyé : ' + ($update | ConvertTo-Json -Depth 8 -Compress)) 'DarkGray' }
  Say "Journal : $log" 'DarkGray'
  exit 1
} finally {
  $token = $null
  $headers = $null
}
