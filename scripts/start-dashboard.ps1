$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'R8 Community Bot - Inicializando'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Write-Rule {
    Write-Host ('=' * 68)
}

function Write-ProgressBar {
    param(
        [int]$Percent,
        [string]$Text
    )

    $width = 30
    $filled = [Math]::Floor(($Percent / 100) * $width)
    $empty = $width - $filled
    $bar = ('#' * $filled) + ('-' * $empty)
    Write-Host ('[{0}] {1,3}%  {2}' -f $bar, $Percent, $Text)
}

function Format-Uptime {
    param([TimeSpan]$Span)
    if ($Span.Days -gt 0) {
        return ('{0}d {1:00}h {2:00}m {3:00}s' -f $Span.Days, $Span.Hours, $Span.Minutes, $Span.Seconds)
    }
    return ('{0:00}h {1:00}m {2:00}s' -f $Span.Hours, $Span.Minutes, $Span.Seconds)
}

function Fail {
    param([string]$Message)
    Write-Host ''
    Write-Rule
    Write-Host ('ERRO: ' + $Message)
    Write-Rule
    Write-Host 'Pressione qualquer tecla para fechar...'
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

Clear-Host
Write-Rule
Write-Host '                         R8 COMMUNITY BOT'
Write-Host '                  Inicializador e monitor local'
Write-Rule
Write-Host ('Pasta   : {0}' -f (Get-Location))
Write-Host ('Horario : {0}' -f (Get-Date -Format 'dd/MM/yyyy HH:mm:ss'))
Write-Rule
Write-Host ''

Write-ProgressBar 5 'Verificando ambiente'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Node.js nao foi encontrado. Instale Node.js 18 ou superior.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail 'npm nao foi encontrado no PATH.'
}

$nodeVersion = (& node --version).Trim()
$npmVersion = (& npm --version).Trim()
Write-Host ('Node.js : {0}' -f $nodeVersion)
Write-Host ('npm     : {0}' -f $npmVersion)

Write-ProgressBar 20 'Verificando dependencias'
if (-not (Test-Path 'node_modules\discord.js\package.json')) {
    Write-Host 'Dependencias ausentes. Instalando...'
    & npm install
    if ($LASTEXITCODE -ne 0) { Fail 'Falha ao instalar as dependencias.' }
} else {
    Write-Host 'Dependencias prontas.'
}

Write-ProgressBar 45 'Compilando TypeScript'
& npm run build
if ($LASTEXITCODE -ne 0) { Fail 'A compilacao falhou. Revise as mensagens acima.' }

if (-not (Test-Path 'dist\index.js')) {
    Fail 'O build terminou sem gerar dist\index.js.'
}

Write-ProgressBar 80 'Preparando processo do bot'
$startAt = Get-Date
$nodePath = (Get-Command node).Source
$package = Get-Content 'package.json' -Raw | ConvertFrom-Json
$botVersion = if ($package.version) { [string]$package.version } else { 'desconhecida' }

try {
    $process = Start-Process `
        -FilePath $nodePath `
        -ArgumentList 'dist\index.js' `
        -WorkingDirectory (Get-Location).Path `
        -NoNewWindow `
        -PassThru

    if ($null -eq $process) { Fail 'Nao foi possivel iniciar o processo do bot.' }

    Write-ProgressBar 100 'Bot iniciado'
    Write-Host ''
    Write-Rule
    Write-Host 'STATUS  : ONLINE'
    Write-Host ('PID     : {0}' -f $process.Id)
    Write-Host ('INICIO  : {0}' -f $startAt.ToString('dd/MM/yyyy HH:mm:ss'))
    Write-Host ('VERSAO  : {0}' -f $botVersion)
    Write-Host 'PARAR   : Ctrl+C'
    Write-Rule
    Write-Host 'Os logs do bot aparecem abaixo. O titulo da janela mostra o tempo ligado.'
    Write-Host ''

    $lastStatus = Get-Date
    while (-not $process.HasExited) {
        Start-Sleep -Milliseconds 500
        $now = Get-Date
        $uptime = $now - $startAt
        $Host.UI.RawUI.WindowTitle = ('R8 Community Bot - ONLINE - {0}' -f (Format-Uptime $uptime))

        if (($now - $lastStatus).TotalSeconds -ge 60) {
            try {
                $process.Refresh()
                $ramMb = [Math]::Round($process.WorkingSet64 / 1MB, 1)
                Write-Host ('[STATUS] Online | Ligado: {0} | RAM: {1} MB | PID: {2}' -f (Format-Uptime $uptime), $ramMb, $process.Id)
            } catch {
                Write-Host ('[STATUS] Online | Ligado: {0} | PID: {1}' -f (Format-Uptime $uptime), $process.Id)
            }
            $lastStatus = $now
        }
    }

    $exitCode = $process.ExitCode
    $uptime = (Get-Date) - $startAt
    $Host.UI.RawUI.WindowTitle = 'R8 Community Bot - Offline'
    Write-Host ''
    Write-Rule
    Write-Host 'STATUS  : OFFLINE'
    Write-Host ('TEMPO   : {0}' -f (Format-Uptime $uptime))
    Write-Host ('SAIDA   : codigo {0}' -f $exitCode)
    Write-Rule

    if ($exitCode -ne 0) {
        Fail ('O bot foi encerrado com codigo ' + $exitCode + '.')
    }
} finally {
    if ($null -ne $process -and -not $process.HasExited) {
        try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
}
