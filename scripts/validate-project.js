const fs = require('node:fs');
const path = require('node:path');

const errors = [];
const warnings = [];
const root = process.cwd();
const requiredFiles = [
  'package.json', 'tsconfig.json', 'config.json', 'start.bat', 'discloud.config',
  'README.md', 'VALIDATION.md', 'src/index.ts', 'src/panel/panelManager.ts', 'src/protection/protectionEngine.ts',
  'src/storage/jsonStore.ts', 'src/storage/atomicWriter.ts', 'src/community/communityManager.ts',
  'src/tickets/ticketService.ts', 'src/tickets/transcriptService.ts', 'src/ui/emojis.ts', 'src/community/rolePanelService.ts', 'src/community/applicationService.ts', 'src/community/telloynService.ts', 'src/community/telloynCanvas.ts', 'src/community/instagramService.ts', 'src/community/activityService.ts', 'src/community/activityMath.ts', 'src/community/roleBackupService.ts', 'src/community/shipCanvas.ts', 'src/community/shipCompatibility.ts', 'src/community/funCanvas.ts', 'src/community/reputationService.ts', 'src/community/conversationService.ts', 'src/community/twitterService.ts', 'src/community/twitterCanvas.ts', 'src/community/autoCleanService.ts', 'src/bot/instanceLock.ts', 'src/commands/commandManager.ts', 'tests/core.test.js'
];
const requiredDirectories = [
  'src/bot', 'src/commands', 'src/config', 'src/events', 'src/logs', 'src/panel',
  'src/permissions', 'src/protection', 'src/snapshots', 'src/storage', 'src/types', 'src/utils', 'src/ui', 'src/community', 'src/tickets',
  'data/guilds', 'data/snapshots', 'data/incidents', 'data/backups', 'data/system', 'data/temporary', 'data/transcripts',
  'logs', 'backups'
];

for (const file of requiredFiles) if (!fs.existsSync(path.join(root, file))) errors.push(`Arquivo ausente: ${file}`);
for (const directory of requiredDirectories) if (!fs.statSync(path.join(root, directory), { throwIfNoEntry: false })?.isDirectory()) errors.push(`Diretório ausente: ${directory}`);

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (error) { errors.push(`JSON inválido em ${file}: ${error.message}`); return {}; }
}

const pkg = readJson('package.json');
const config = readJson('config.json');
const tsconfig = readJson('tsconfig.json');

if (pkg.name !== 'r8-community-bot') errors.push('package.json deve identificar o projeto como r8-community-bot');
if (pkg.version !== '10.0.0') errors.push('package.json deve identificar a versão 10.0.0');
if (pkg.main !== 'dist/index.js') errors.push('package.json deve apontar main para dist/index.js');
if (pkg.dependencies?.['discord.js'] !== '14.27.0') errors.push('discord.js deve estar fixado em 14.27.0');
if (!pkg.dependencies?.['@napi-rs/canvas']) errors.push('@napi-rs/canvas é obrigatório para o Telloyn');
if (pkg.engines?.node !== '>=18.0.0') errors.push('engine do Node deve exigir 18 ou superior');
for (const forbidden of ['mongodb','mongoose','mysql','mysql2','pg','sqlite3','prisma','@prisma/client','firebase','@supabase/supabase-js']) {
  if (pkg.dependencies?.[forbidden] || pkg.devDependencies?.[forbidden]) errors.push(`Dependência de banco de dados proibida: ${forbidden}`);
}
if (tsconfig.compilerOptions?.outDir !== 'dist' || tsconfig.compilerOptions?.rootDir !== 'src') errors.push('tsconfig deve compilar src para dist');

if (config.prefix !== '!') errors.push('O prefixo padrão deve ser !');
if (!Array.isArray(config.owners)) errors.push('config.owners deve ser uma lista');
if (!Array.isArray(config.credits?.people) || !config.credits.people.some(person => person.discord === '@r8fb')) errors.push('Crédito padrão @r8fb ausente do config.json');
if (config.token !== 'COLOQUE_O_TOKEN_AQUI') warnings.push('O config.json contém um token definido pelo usuário. Regenerar o token após qualquer compartilhamento do arquivo.');
if (!config.logging || !config.storage || !config.panel || !config.defaultPresence) errors.push('config.json não contém todas as seções globais obrigatórias');
if ((config.panel?.sessionTimeoutSeconds ?? 0) < 1800) errors.push('O tempo global do painel deve ser de pelo menos 1800 segundos');

const discloud = fs.readFileSync(path.join(root, 'discloud.config'), 'utf8');
const main = /^MAIN=(.+)$/m.exec(discloud)?.[1]?.trim();
if (!main) errors.push('MAIN não definido no discloud.config');
else {
  if (main !== pkg.main) errors.push(`MAIN (${main}) difere de package.json main (${pkg.main})`);
  if (fs.existsSync(path.join(root, 'dist')) && !fs.existsSync(path.join(root, main))) errors.push(`MAIN aponta para arquivo inexistente após build: ${main}`);
}

const startBat = fs.readFileSync(path.join(root, 'start.bat'), 'utf8');
const dashboardPath = path.join(root, 'scripts/start-dashboard.ps1');
const dashboardSource = fs.existsSync(dashboardPath) ? fs.readFileSync(dashboardPath, 'utf8') : '';
if (!startBat.includes('start-dashboard.ps1') || !dashboardSource.includes('npm install') || !dashboardSource.includes('npm run build') || !dashboardSource.includes("'dist\\index.js'")) errors.push('Inicializador do Windows não executa instalação, build e inicialização');
if (!dashboardSource.includes("Test-Path 'dist\\index.js'")) errors.push('Inicializador do Windows não verifica dist\\index.js');
if (!dashboardSource.includes('Format-Uptime') || !dashboardSource.includes('Write-ProgressBar') || !dashboardSource.includes('WorkingSet64')) errors.push('Dashboard do Windows não contém progresso, uptime e informações do processo');

function collectFiles(directory, extensions) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...collectFiles(full, extensions));
    else if (extensions.some(ext => entry.name.endsWith(ext))) output.push(full);
  }
  return output;
}

const sourceFiles = collectFiles(path.join(root, 'src'), ['.ts']);
const checkedFiles = [...sourceFiles, ...collectFiles(path.join(root, 'scripts'), ['.js']).filter(file => !file.endsWith('validate-project.js')), path.join(root, 'README.md')];
const forbiddenMarkers = [/(?:^|[\s/*#-])TODO(?:$|[\s:/*#-])/i, /implementar depois/i, /\bem breve\b/i, /adicione sua lógica/i, /exemplo simplificado/i];
for (const file of checkedFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const marker of forbiddenMarkers) if (marker.test(content)) errors.push(`Marcador incompleto em ${path.relative(root, file)}: ${marker}`);
}

const allSource = sourceFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
if (!allSource.includes('MessageFlags.IsComponentsV2')) errors.push('Flag oficial de Components V2 não encontrada');
const panelSourceFiles = sourceFiles.filter(file => file.includes(`${path.sep}panel${path.sep}`));
const panelSource = panelSourceFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
if (/\bEmbedBuilder\b/.test(panelSource)) errors.push('EmbedBuilder encontrado no painel principal; ele deve usar apenas Components V2');
const ticketSource = fs.readFileSync(path.join(root, 'src/tickets/ticketService.ts'), 'utf8');
if (!/external/.test(ticketSource) || !/internal/.test(ticketSource)) errors.push('Sistema de tickets não possui aparências externa e interna configuráveis');
if (/process\.env\.(?:TOKEN|DISCORD_TOKEN)/i.test(allSource)) errors.push('Token sendo lido de variável de ambiente');


const panelManager = fs.readFileSync(path.join(root, 'src/panel/panelManager.ts'), 'utf8');
const handleStart = panelManager.indexOf('async handle(interaction');
const deferIndex = panelManager.indexOf('await this.ensureDeferredUpdate(interaction)', handleStart);
const decodeIndex = panelManager.indexOf('this.ids.decode(interaction.customId)', handleStart);
if (handleStart < 0 || deferIndex < handleStart || decodeIndex < deferIndex) errors.push('O painel não confirma a interação antes de decodificar e carregar a sessão');
if (/\bephemeral\s*:/.test(allSource)) errors.push('Opção depreciada ephemeral encontrada; utilize MessageFlags.Ephemeral');
if (!panelManager.includes('recoverSession(interaction)')) errors.push('Recuperação automática de sessão não encontrada');
if (!panelManager.includes('code === 10062')) errors.push('Tratamento de Unknown interaction não encontrado');

const lockSource = fs.readFileSync(path.join(root, 'src/bot/instanceLock.ts'), 'utf8');
if (!lockSource.includes("open(file, 'wx')") || !lockSource.includes('process.kill(data.pid, 0)')) errors.push('Bloqueio de instância única incompleto');

const telloynSource = fs.readFileSync(path.join(root, 'src/community/telloynService.ts'), 'utf8');
const telloynCanvas = fs.readFileSync(path.join(root, 'src/community/telloynCanvas.ts'), 'utf8');
if (!telloynSource.includes('getSelectedUsers') || !telloynSource.includes('MessageFlags.IsComponentsV2')) errors.push('Telloyn não usa seletor de usuário e Components V2');
if (!telloynCanvas.includes('createTelloynCard') || !telloynCanvas.includes("ctx.fillStyle = '#ffffff'")) errors.push('Canvas branco do Telloyn não encontrado');
if (!telloynSource.includes('executorId: interaction.user.id')) errors.push('Telloyn anônimo não preserva o autor nos logs internos');

const instagramSource = fs.readFileSync(path.join(root, 'src/community/instagramService.ts'), 'utf8');
const communityPage = fs.readFileSync(path.join(root, 'src/panel/pages/communityPage.ts'), 'utf8');
if (!instagramSource.includes('MessageFlags.IsComponentsV2') || !instagramSource.includes('toggleLike') || !instagramSource.includes('addComment')) errors.push('Instagram interativo incompleto');
if (!instagramSource.includes('MediaGalleryBuilder') || instagramSource.includes('ThumbnailBuilder') || instagramSource.includes('SectionBuilder')) errors.push('Instagram deve usar galeria limpa sem foto de perfil ou thumbnail');
if (!instagramSource.includes('actionButton') || !instagramSource.includes("'Curtir'") || !instagramSource.includes("'Excluir'")) errors.push('Instagram deve usar botões textuais claros sem depender de emojis');
if (!communityPage.includes('instagramchannel') || !communityPage.includes('RoleSelectMenuBuilder')) errors.push('Instagram não utiliza seletores nativos de canal e cargo');
const twitterSource = fs.readFileSync(path.join(root, 'src/community/twitterService.ts'), 'utf8');
const twitterCanvas = fs.readFileSync(path.join(root, 'src/community/twitterCanvas.ts'), 'utf8');
const autoCleanSource = fs.readFileSync(path.join(root, 'src/community/autoCleanService.ts'), 'utf8');
if (!twitterSource.includes('fetchWebhooks') || !twitterSource.includes('createWebhook') || !twitterSource.includes('username: displayName') || !twitterSource.includes('avatarURL:')) errors.push('Publicação no X por webhook não está completa');
if (!twitterCanvas.includes('createTwitterCard') || !twitterCanvas.includes("ctx.fillStyle = '#000000'") || !twitterCanvas.includes('drawXLogo') || !twitterCanvas.includes('drawMediaGrid')) errors.push('Canvas visual do X não está completo');
if (!twitterSource.includes('deleteOriginalMessage') || !twitterSource.includes('twitter_post_created')) errors.push('X não remove a mensagem original ou não registra logs');
if (!['all','images','text'].every(mode => autoCleanSource.includes(`rule.mode === '${mode}'`)) || !autoCleanSource.includes('LINK_PATTERN')) errors.push('Limpeza automática não possui todos os modos solicitados');
if (!communityPage.includes('twitterchannel') || !communityPage.includes('autocleanmode') || !communityPage.includes('autocleanchannel')) errors.push('Painel não contém configuração completa de X/Twitter e limpeza automática');
if (!communityPage.includes("'fun'") || !communityPage.includes("'telloyn'") || !communityPage.includes("'instagram'") || !communityPage.includes("'twitter'")) errors.push('Diversão não contém Telloyn, Instagram e Twitter');

const homePage = fs.readFileSync(path.join(root, 'src/panel/pages/homePage.ts'), 'utf8');
const common = fs.readFileSync(path.join(root, 'src/panel/components/common.ts'), 'utf8');
if (!homePage.includes('StringSelectMenuBuilder') || !['community','protections','logs','configbot'].every(area => homePage.includes(`'${area}'`))) errors.push('Página inicial não possui o menu com as quatro áreas principais esperadas');
if (!common.includes('@r8fb') || !common.includes('mainCreditFooter')) errors.push('Crédito de @r8fb não está centralizado somente no menu principal');
const creditSources = sourceFiles.filter(file => /@r8fb|Desenvolvido por/i.test(fs.readFileSync(file, 'utf8'))).map(file => path.relative(root, file));
const invalidCreditSources = creditSources.filter(file => !['src/panel/components/common.ts','src/storage/guildConfigStore.ts'].includes(file));
if (invalidCreditSources.length) errors.push(`Créditos encontrados fora do menu principal: ${invalidCreditSources.join(', ')}`);


if (/setRequired\(false\)\.setMinValues\(0\)/.test(telloynSource)) errors.push('Telloyn ainda envia min_values zero no seletor opcional');
if (!communityPage.includes('ticketpanel') || !communityPage.includes('creationMode') || !communityPage.includes('openComponent')) errors.push('Tickets não possuem seleção organizada, canal/tópico e botão/menu');
const commandSource = fs.readFileSync(path.join(root, 'src/commands/commandManager.ts'), 'utf8');
const messageServiceSource = fs.readFileSync(path.join(root, 'src/community/messageService.ts'), 'utf8');
const funCanvasSource = fs.readFileSync(path.join(root, 'src/community/funCanvas.ts'), 'utf8');
if (!messageServiceSource.includes('interaction.editReply(payload)') || !messageServiceSource.includes('flags: MessageFlags.Ephemeral')) errors.push('Fluxo seguro da prévia privada de boas-vindas/saída não encontrado');
if (!commandSource.includes('requestChannelNuke') || !commandSource.includes('handleNukeInteraction')) errors.push('!nuke protegido não encontrado');
if (!commandSource.includes("this.command('ship'") || !funCanvasSource.includes('createWantedCard') || !funCanvasSource.includes('createJailCard') || !funCanvasSource.includes('createProfileCard') || !funCanvasSource.includes('createAchievementCard')) errors.push('Comandos Canvas de diversão incompletos');
if (!commandSource.includes('|prev|') || !commandSource.includes('|next|')) errors.push('Paginação do !groles não possui IDs exclusivos');

const selectedV9Commands = ['softban','tempban','history','reason','purgeuser','purgebots','purgelinks','purgeattachments','purgementions','purgecontains','voicemute','voiceunmute','voicedeafen','move','voicelock','voiceunlock','voiceinfo','security','raidmode','risk','webhookcheck','ticket','ticketadd','ticketremove','ticketclaim','ticketunclaim','ticketclose','ticketreopen','ticketdelete','ticketrename','ticketpriority','tickettransfer','ticketpause','ticketresume','ticketinfo','tickettranscript','tickets','ticketsearch','ticketblock','ticketunblock','temprole','roleexpires','rolebackup','membercount','boostinfo','inviteinfo','joined','created','mutualroles','invitecount','topvoice','activity'];
for (const name of selectedV9Commands) if (!commandSource.includes(`this.command('${name}'`)) errors.push(`Comando selecionado sem implementação: ${name}`);
const selectedV10Commands = ['profilecard','quote','blur','pixelate','grayscale','invert','achievement','rate','highfive','pat'];
for (const name of selectedV10Commands) if (!commandSource.includes(`this.command('${name}'`)) errors.push(`Comando visual novo sem implementação: ${name}`);
const selectedUtilityCommands = ['serverbanner','boosters','emojiinfo','roles','inrole','randommember','calc','timestamp'];
for (const name of selectedUtilityCommands) if (!commandSource.includes(`this.command('${name}'`)) errors.push(`Comando utilitário novo sem implementação: ${name}`);
const expandedCommunityCommands = ['hug','wave','poke','applaud','rep','repinfo','reptop','topic','wouldyourather','rps','serverage','oldest','newest','toproles','randomnumber'];
for (const name of expandedCommunityCommands) if (!commandSource.includes(`this.command('${name}'`)) errors.push(`Comando comunitário adicional sem implementação: ${name}`);
if (/R8 Community|R8 SHIP|R8 COUNTY JAIL/.test(twitterCanvas + '\n' + fs.readFileSync(path.join(root, 'src/community/shipCanvas.ts'), 'utf8') + '\n' + funCanvasSource)) errors.push('Canvas sociais ainda exibem marca fixa do bot');
const activitySource = fs.readFileSync(path.join(root, 'src/community/activityService.ts'), 'utf8');
const roleBackupSource = fs.readFileSync(path.join(root, 'src/community/roleBackupService.ts'), 'utf8');
if (!activitySource.includes('refreshVoiceBoard') || !activitySource.includes('maintainTemporaryActions')) errors.push('Serviço de atividade/expirações incompleto');
if (!roleBackupSource.includes('restoreLatest') || !roleBackupSource.includes('colors: { primaryColor: snapshot.color }')) errors.push('Backup/restauração de cargos incompleto ou usando cor obsoleta');
if (!panelManager.includes('voiceactivitychannel') || !panelManager.includes('rolebackupcreate') || !panelManager.includes('rolebackuprestore')) errors.push('Painel não contém ranking de voz e backup/restauração de cargos');
if (!ticketSource.includes('autoClosePaused') || !ticketSource.includes("command === 'tickettranscript'")) errors.push('Comandos completos de tickets não encontrados');


const emojiCatalogSource = fs.readFileSync(path.join(root, 'src/ui/emojis.ts'), 'utf8');
const expectedEmojiIds = [
  '1535353166361788476','1535353165057228890','1535353163241230466','1535353161827745936','1535353160263270611','1535353159034208336','1535353157595693117','1535353156431210927','1535353155028783225','1535353153415302808','1535353152386367498','1535353151099007371','1535353149852753920','1535353148431011950','1535353146480787539','1535353144584708187','1535353143284736140','1535353141892096151','1534554053223387198','1534554052107702312','1534554050350288967','1534554049180078131'
];
for (const id of expectedEmojiIds) if (!emojiCatalogSource.includes(id)) errors.push(`Emoji personalizado ausente do catálogo visual: ${id}`);
if (!homePage.includes('.setEmoji(UI_EMOJIS.community)') || !communityPage.includes('COMMUNITY_FUNCTION_EMOJIS') || !commandSource.includes('UI_EMOJIS.moderator')) errors.push('Emojis personalizados não estão integrados às áreas principais do painel e da ajuda.');

for (const warning of warnings) console.warn(`[AVISO] ${warning}`);

const emojiPattern = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (emojiPattern.test(content)) errors.push(`Emoji visual encontrado no código-fonte: ${path.relative(root, file)}`);
}

if (errors.length) {
  for (const error of errors) console.error(`[ERRO] ${error}`);
  process.exit(1);
}
console.log(`[OK] Projeto validado: ${sourceFiles.length} arquivos TypeScript, versão 10, 22 emojis personalizados, X com Canvas + webhook, limpeza automática, utilidades extras, moderação avançada, tickets completos e caminho da DisCloud.`);
