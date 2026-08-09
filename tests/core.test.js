const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const build = process.env.R8_TEST_BUILD || 'dist';
const { createDefaultGuildConfig } = require(`../${build}/config/defaults.js`);
const { resolveBypass, pruneExpiredBypasses } = require(`../${build}/protection/bypassEngine.js`);
const { ThresholdEngine } = require(`../${build}/protection/thresholdEngine.js`);
const { SessionManager } = require(`../${build}/panel/sessionManager.js`);
const { atomicWriteJson } = require(`../${build}/storage/atomicWriter.js`);
const { incidentId } = require(`../${build}/utils/ids.js`);

test('configuração padrão contém comunidade, proteção, logs e painel humanizado', () => {
  const cfg = createDefaultGuildConfig('123');
  assert.equal(cfg.guildId, '123');
  assert.ok(cfg.protections.anti_link);
  assert.ok(cfg.protections.anti_channel_delete.restore);
  assert.ok(cfg.logs.events.anti_link);
  assert.equal(cfg.panel.footer, '');
  assert.equal(cfg.schemaVersion, 13);
  assert.equal(cfg.community.cl.enabled, true);
  assert.equal(cfg.community.tickets.maximumPanels, 10);
  assert.ok(cfg.logs.events.ticket_opened);
  assert.ok(cfg.logs.events.cl_used);
});

test('bypass de usuário tem prioridade e mantém logs', () => {
  const cfg = createDefaultGuildConfig('1');
  cfg.bypasses.push({ id:'BP-1', kind:'user', targetId:'u1', modules:['*'], behavior:{ignoreDetection:false,ignorePunishment:true,ignoreRestoration:true,ignoreLimit:true,continueLogging:true}, reason:'teste', createdBy:'owner', createdAt:new Date().toISOString(), expiresAt:null });
  const result = resolveBypass(cfg, { botUserId:'bot', executorId:'u1', executorRoleIds:[], module:'anti_link' });
  assert.equal(result.bypassed, true);
  assert.equal(result.behavior.continueLogging, true);
});

test('bypass expirado é removido', () => {
  const cfg = createDefaultGuildConfig('1');
  cfg.bypasses.push({ id:'BP-X', kind:'user', targetId:'u1', modules:['*'], behavior:{ignoreDetection:false,ignorePunishment:true,ignoreRestoration:true,ignoreLimit:true,continueLogging:true}, reason:'teste', createdBy:'owner', createdAt:new Date().toISOString(), expiresAt:new Date(Date.now()-1000).toISOString() });
  const removed = pruneExpiredBypasses(cfg);
  assert.equal(removed.length, 1); assert.equal(cfg.bypasses.length, 0);
});

test('limite agrupa ações por servidor, módulo e executor', () => {
  const engine = new ThresholdEngine();
  assert.equal(engine.hit('g','m','u',3,10).exceeded, false);
  assert.equal(engine.hit('g','m','u',3,10).exceeded, false);
  assert.equal(engine.hit('g','m','u',3,10).exceeded, true);
  assert.equal(engine.count('g','m','u',10), 3);
});

test('sessões são vinculadas e expiram', async () => {
  const sessions = new SessionManager(1, 2);
  const session = sessions.create('u','g','c');
  assert.equal(sessions.get(session.id).userId, 'u');
  session.lastInteractionAt = Date.now() - 2000;
  assert.equal(sessions.get(session.id), null);
});

test('escrita JSON atômica produz arquivo válido e backup', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r8-'));
  const file = path.join(dir, 'data.json');
  await atomicWriteJson(file, { value: 1 }, true);
  await atomicWriteJson(file, { value: 2 }, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')), { value: 2 });
  assert.deepEqual(JSON.parse(fs.readFileSync(`${file}.bak`,'utf8')), { value: 1 });
});

test('ID de incidente usa prefixo neutro da comunidade', () => {
  assert.match(incidentId(new Date('2026-08-04T12:00:00Z')), /^INC-2026-08-04-[A-F0-9]{6}$/);
});

test('limite de mensagem repetida normaliza espaços e caixa', () => {
  const engine = new ThresholdEngine();
  assert.equal(engine.hitRepeated('g2','repeat','u2',2,10,'  Olá   Mundo ').exceeded, false);
  assert.equal(engine.hitRepeated('g2','repeat','u2',2,10,'olá mundo').exceeded, true);
});

test('máximo de sessões remove a sessão mais antiga', () => {
  const sessions = new SessionManager(300, 2);
  const first = sessions.create('u','g','c');
  const second = sessions.create('u','g','c');
  const third = sessions.create('u','g','c');
  assert.equal(sessions.get(first.id), null);
  assert.ok(sessions.get(second.id));
  assert.ok(sessions.get(third.id));
});

test('custom ID assinado rejeita adulteração', async () => {
  const { CustomIdManager } = require(`../${build}/panel/customIdManager.js`);
  const manager = new CustomIdManager(Buffer.alloc(32, 7));
  const encoded = manager.encode('session123','mode','enabled');
  assert.deepEqual(manager.decode(encoded), { sessionId:'session123', action:'mode', arg:'enabled' });
  assert.equal(manager.decode(encoded.replace('enabled','disabled')), null);
  assert.ok(encoded.length <= 100);
});

test('roteamento de log respeita herança, gravidade e canal secundário', () => {
  const { resolveLogDestination } = require(`../${build}/logs/logRouter.js`);
  const cfg = createDefaultGuildConfig('log-guild');
  cfg.logs.defaultChannelId = 'primary';
  cfg.logs.events.anti_link.secondaryChannelId = 'secondary';
  cfg.logs.events.anti_link.minimumSeverity = 'high';
  assert.equal(resolveLogDestination(cfg,'anti_link','medium').enabled, false);
  assert.deepEqual(resolveLogDestination(cfg,'anti_link','critical').channelIds, ['primary','secondary']);
});

test('JsonStore recupera JSON corrompido e cria novo arquivo', async () => {
  const { JsonStore } = require(`../${build}/storage/jsonStore.js`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r8-store-'));
  const file = path.join(dir, 'guild.json');
  fs.writeFileSync(file, '{invalido', 'utf8');
  const store = new JsonStore(() => file, () => ({ ok:true }), value => value);
  assert.deepEqual(await store.get('x'), { ok:true });
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')), { ok:true });
  assert.ok(fs.readdirSync(dir).some(name => name.includes('.corrupt-')));
});

test('retenção de backup mantém somente a quantidade configurada', async () => {
  const { createBackup, readBackup } = require(`../${build}/storage/backupStore.js`);
  const previous = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'r8-backup-'));
  process.chdir(dir);
  try {
    const cfg = createDefaultGuildConfig('backup-guild');
    const first = await createBackup('backup-guild',cfg,'owner','primeiro',2);
    await new Promise(resolve => setTimeout(resolve, 2));
    const second = await createBackup('backup-guild',cfg,'owner','segundo',2);
    await new Promise(resolve => setTimeout(resolve, 2));
    const third = await createBackup('backup-guild',cfg,'owner','terceiro',2);
    const files = fs.readdirSync(path.join(dir,'data','backups','backup-guild')).filter(name=>name.endsWith('.json'));
    assert.equal(files.length, 2);
    assert.equal((await readBackup('backup-guild',third.id)).reason, 'terceiro');
    assert.equal(files.some(name=>name===`${first.id}.json`), false);
    assert.equal(files.some(name=>name===`${second.id}.json`), true);
  } finally { process.chdir(previous); }
});


test('configuração de comunidade separa autoroles de membros, bots e todos', () => {
  const cfg = createDefaultGuildConfig('community-guild');
  cfg.community.autorole.memberRoleIds.push('member-role');
  cfg.community.autorole.botRoleIds.push('bot-role');
  cfg.community.autorole.everyoneRoleIds.push('everyone-role');
  assert.deepEqual(cfg.community.autorole.memberRoleIds, ['member-role']);
  assert.deepEqual(cfg.community.autorole.botRoleIds, ['bot-role']);
  assert.deepEqual(cfg.community.autorole.everyoneRoleIds, ['everyone-role']);
});

test('placeholders de ticket renderizam usuário, servidor, painel e ticket', () => {
  const { renderTicketTemplate } = require(`../${build}/tickets/templateRenderer.js`);
  const panel = { id:'PNL-1', name:'Suporte geral' };
  const rendered = renderTicketTemplate('[user] | [user_name] | [guild_name] | [ticket_id] | [panel]', {
    user:{ id:'100', username:'r8fb' },
    guild:{ id:'200', name:'Comunidade R8', memberCount:42 },
    panel,
    ticketId:'TCK-0001',
    createdAt:new Date('2026-08-05T10:00:00Z')
  });
  assert.equal(rendered, '<@100> | r8fb | Comunidade R8 | TCK-0001 | Suporte geral');
});

test('aparências externa e interna de ticket são completas e independentes', () => {
  const { defaultTicketAppearance } = require(`../${build}/config/defaults.js`);
  const external = defaultTicketAppearance('external');
  const internal = defaultTicketAppearance('internal');
  assert.equal(external.buttonLabel, 'Abrir ticket');
  assert.match(internal.description, /\[user\.mention\]/);
  external.title = 'Alterado';
  assert.notEqual(internal.title, external.title);
});

test('categorias de logs incluem segurança, comunidade e sistema sem duplicação', () => {
  const { SECURITY_LOG_EVENTS, COMMUNITY_LOG_EVENTS, TICKET_LOG_EVENTS, MODERATION_LOG_EVENTS, SYSTEM_LOG_EVENTS, LOG_EVENTS } = require(`../${build}/config/defaults.js`);
  assert.ok(SECURITY_LOG_EVENTS.includes('anti_link'));
  assert.ok(TICKET_LOG_EVENTS.includes('ticket_transcript'));
  assert.ok(COMMUNITY_LOG_EVENTS.includes('mass_role_clear'));
  assert.ok(MODERATION_LOG_EVENTS.includes('member_ban'));
  assert.ok(SYSTEM_LOG_EVENTS.includes('internal_error'));
  assert.equal(new Set(LOG_EVENTS).size, LOG_EVENTS.length);
});


test('configuração comunitária contém boas-vindas, saída, aliases e comandos', () => {
  const cfg = createDefaultGuildConfig('community-v5');
  assert.equal(cfg.community.welcome.enabled, false);
  assert.equal(cfg.community.goodbye.enabled, false);
  assert.match(cfg.community.welcome.appearance.description, /\[user\.mention\]/);
  assert.ok(Array.isArray(cfg.commands.aliases.ban));
  assert.equal(cfg.commands.permissions.help.enabled, true);
});

test('painel de ticket suporta formulário, bloqueios e botões internos', () => {
  const { defaultTicketAppearance } = require(`../${build}/config/defaults.js`);
  const external = defaultTicketAppearance('external');
  assert.equal(external.buttonStyle, 'primary');
  assert.equal(external.showSeparator, true);
  assert.equal(external.imageUrl, null);
});

test('placeholders comunitários renderizam membro, servidor e data', () => {
  const { renderCommunityTemplate } = require(`../${build}/community/templateRenderer.js`);
  const result = renderCommunityTemplate('[user.mention] entrou em [guild.name] como membro [guild.member_count]', {
    user:{id:'10',username:'r8fb'}, member:{displayName:'r8fb',joinedAt:new Date()}, guild:{id:'20',name:'R8',memberCount:50}
  });
  assert.equal(result, '<@10> entrou em R8 como membro 50');
});


test('configuração inclui painéis de cargos, formulários e AFK persistente', () => {
  const { defaultRolePanel, defaultApplicationForm } = require(`../${build}/config/defaults.js`);
  const cfg = createDefaultGuildConfig('community-v5-modules');
  const rolePanel = defaultRolePanel('owner', 1);
  const form = defaultApplicationForm('owner', 1);
  cfg.community.rolePanels.panels.push(rolePanel);
  cfg.community.forms.forms.push(form);
  cfg.community.afkUsers.user = { reason:'Estudando', since:new Date().toISOString() };
  assert.equal(cfg.community.rolePanels.maximumPanels, 10);
  assert.equal(cfg.community.forms.maximumForms, 10);
  assert.equal(rolePanel.maximumSelections, 1);
  assert.equal(form.questions.length, 1);
  assert.equal(cfg.community.afkUsers.user.reason, 'Estudando');
});

test('novos eventos comunitários possuem configurações de log', () => {
  const cfg = createDefaultGuildConfig('community-v5-logs');
  for (const event of ['role_panel_published','self_role_update','form_submitted','form_approved','form_rejected','afk_set','afk_removed']) {
    assert.ok(cfg.logs.events[event], `log ausente: ${event}`);
  }
});


test('configuração v6 inclui Telloyn e Instagram organizados', () => {
  const cfg = createDefaultGuildConfig('community-v5-social');
  assert.equal(cfg.panel.sessionTimeoutSeconds, 3600);
  assert.equal(cfg.community.telloyn.allowAnonymous, true);
  assert.equal(cfg.community.telloyn.allowMentions, true);
  assert.equal(cfg.community.instagram.enabled, false);
  assert.equal(cfg.community.instagram.maximumCaptionLength, 1800);
  assert.equal(cfg.community.instagram.emojis.like, '1534554053223387198');
  assert.ok(cfg.logs.events.instagram_post_created);
  assert.ok(cfg.logs.events.instagram_post_commented);
});

test('Instagram mantém curtidas e comentários por publicação', () => {
  const cfg = createDefaultGuildConfig('instagram-records');
  cfg.community.instagram.posts['IG-TESTE'] = {
    id:'IG-TESTE', messageId:'m1', channelId:'c1', authorId:'u1', caption:'Foto',
    attachmentUrl:'https://cdn.discordapp.com/test.png', attachmentName:'test.png', mediaType:'image',
    likes:['u2'], comments:[{id:'C-1',userId:'u3',content:'Muito bom',createdAt:new Date().toISOString()}],
    createdAt:new Date().toISOString()
  };
  assert.equal(cfg.community.instagram.posts['IG-TESTE'].likes.length, 1);
  assert.equal(cfg.community.instagram.posts['IG-TESTE'].comments[0].content, 'Muito bom');
});

test('painel confirma interações antes de carregar sessão e configuração', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'panelManager.ts'), 'utf8');
  const handleStart = source.indexOf('async handle(interaction');
  const decode = source.indexOf('this.ids.decode(interaction.customId)', handleStart);
  const defer = source.indexOf('await this.ensureDeferredUpdate(interaction)', handleStart);
  assert.ok(handleStart >= 0 && defer > handleStart && decode > defer, 'o ACK deve ocorrer antes da decodificação e da leitura de configuração');
  assert.match(source, /code === 10062/);
  assert.match(source, /recoverSession\(interaction\)/);
});

test('respostas privadas usam MessageFlags.Ephemeral sem opção depreciada', () => {
  const sourceRoot = path.join(__dirname, '..', 'src');
  const stack = [sourceRoot];
  let combined = '';
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes:true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.ts')) combined += fs.readFileSync(full, 'utf8');
    }
  }
  assert.doesNotMatch(combined, /\bephemeral\s*:/);
  assert.match(combined, /MessageFlags\.Ephemeral/);
});

test('bloqueio de instância única evita dois processos na mesma pasta', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'bot', 'instanceLock.ts'), 'utf8');
  assert.match(source, /open\(file, 'wx'\)/);
  assert.match(source, /Outra instância deste bot já está em execução/);
  assert.match(source, /process\.kill\(data\.pid, 0\)/);
});

test('Telloyn preserva anonimato público e registra autor somente nos logs internos', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'telloynService.ts'), 'utf8');
  assert.match(source, /authorAvatarUrl: anonymous \? null/);
  assert.match(source, /executorId: interaction\.user\.id/);
  assert.match(source, /details: \{ anonymous \}/);
});

test('Instagram usa layout limpo, botões claros e seletores sem IDs manuais', () => {
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'instagramService.ts'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'communityPage.ts'), 'utf8');
  assert.match(service, /MessageFlags\.IsComponentsV2/);
  assert.match(service, /MediaGalleryBuilder/);
  assert.match(service, /actionButton\(`ig\|like/);
  assert.match(service, /actionButton\(`ig\|delete/);
  assert.match(service, /'Curtir'/);
  assert.match(service, /'Excluir'/);
  assert.match(service, /if \(configured\)/);
  assert.doesNotMatch(service, /ThumbnailBuilder|SectionBuilder/);
  assert.match(page, /RoleSelectMenuBuilder/);
  assert.match(page, /instagramchannel/);
  assert.doesNotMatch(page, /ID do canal do Instagram|ID do cargo do Instagram/i);
});

test('X usa Canvas preto e branco com logo, autor e grade de mídia', () => {
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'twitterService.ts'), 'utf8');
  const canvas = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'twitterCanvas.ts'), 'utf8');
  assert.match(service, /createTwitterCard/);
  assert.match(service, /embeddedMediaUrls/);
  assert.match(canvas, /createTwitterCard/);
  assert.match(canvas, /ctx\.fillStyle = '#000000'/);
  assert.match(canvas, /drawXLogo/);
  assert.match(canvas, /drawMediaGrid/);
});

test('utilidades extras possuem implementação e aliases', () => {
  const commands = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  const defaults = fs.readFileSync(path.join(__dirname, '..', 'src', 'config', 'defaults.ts'), 'utf8');
  for (const name of ['serverbanner','boosters','emojiinfo','roles','inrole','randommember','calc','timestamp']) {
    assert.match(commands, new RegExp(`this\\.command\\('${name}'`));
    assert.match(defaults, new RegExp(`\\b${name}\\b`));
  }
  assert.match(commands, /evaluateMathExpression/);
  assert.doesNotMatch(commands, /\beval\s*\(/);
});

test('canvas sociais usam identidade do servidor e não exibem marca do bot', () => {
  const twitter = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'twitterCanvas.ts'), 'utf8');
  const ship = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'shipCanvas.ts'), 'utf8');
  const fun = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'funCanvas.ts'), 'utf8');
  for (const source of [twitter, ship, fun]) assert.doesNotMatch(source, /R8 Community|R8 SHIP|R8 COUNTY JAIL/);
  assert.match(twitter, /input\.guildName/);
  assert.match(ship, /guildName/);
  assert.match(fun, /createJailCard\(user: FunCanvasUser, guildName/);
});

test('reputação comunitária possui cooldown e ranking local', () => {
  const { giveReputation, getReputation, topReputation, REPUTATION_COOLDOWN_MS } = require(`../${build}/community/reputationService.js`);
  const cfg = createDefaultGuildConfig('rep-guild');
  const now = new Date('2026-08-06T12:00:00Z');
  const first = giveReputation(cfg, 'giver', 'target', now);
  assert.equal(first.ok, true);
  assert.equal(getReputation(cfg, 'target'), 1);
  const blocked = giveReputation(cfg, 'giver', 'other', new Date(now.getTime() + 60_000));
  assert.equal(blocked.ok, false);
  assert.ok(blocked.remainingMs > 0 && blocked.remainingMs <= REPUTATION_COOLDOWN_MS);
  giveReputation(cfg, 'giver2', 'target', now);
  assert.deepEqual(topReputation(cfg, 1), [{ userId:'target', score:2 }]);
});

test('comandos comunitários adicionais estão configurados', () => {
  const cfg = createDefaultGuildConfig('community-expanded');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  for (const command of ['hug','wave','poke','applaud','rep','repinfo','reptop','topic','wouldyourather','rps','serverage','oldest','newest','toproles','randomnumber']) {
    assert.ok(cfg.commands.permissions[command], `comando ausente: ${command}`);
    assert.ok(source.includes(`this.command('${command}'`));
  }
  assert.ok(cfg.logs.events.reputation_given);
});

test('código-fonte não contém emojis visuais padrão', () => {
  const root = path.join(__dirname, '..', 'src');
  const stack = [root];
  const emoji = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.ts')) assert.doesNotMatch(fs.readFileSync(full, 'utf8'), emoji, full);
    }
  }
});


test('registro de interações só acessa customId após narrowing seguro', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'events', 'registerEvents.ts'), 'utf8');
  assert.match(source, /'customId' in interaction/);
  assert.doesNotMatch(source, /interaction\.customId\?\.startsWith\('p\|'\)/);
});

test('groles limita cargos pela hierarquia e oferece adicionar ou remover', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  assert.match(source, /this\.command\('groles'/);
  assert.match(source, /role\.position < actorLimit/);
  assert.match(source, /role\.position < botLimit/);
  assert.match(source, /setLabel\(hasRole \? 'Remover' : 'Adicionar'\)/);
  assert.match(source, /setButtonAccessory/);
});

test('ban e mute enviam DM e aviso temporário no canal', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  assert.match(source, /targetUser\.send/);
  assert.match(source, /setTimeout\(\(\) => void sent\.delete\(\)/);
  assert.match(source, /10_000/);
  assert.match(source, /sendModerationNotification\(message, member\.user, 'mute'/);
});

test('help inclui groles e mostra comandos mesmo quando exigem permissão', () => {
  const cfg = createDefaultGuildConfig('help-v6');
  assert.ok(cfg.commands.permissions.groles);
  assert.ok(cfg.commands.aliases.groles.includes('gerenciarcargos'));
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  assert.match(source, /Requer \$\{permissionLabel/);
  assert.match(source, /Comandos ativos/);
});


test('crédito aparece somente no menu principal', () => {
  const sourceRoot = path.join(__dirname, '..', 'src');
  const files = [];
  const walk = dir => { for (const entry of fs.readdirSync(dir,{withFileTypes:true})) { const full=path.join(dir,entry.name); if(entry.isDirectory()) walk(full); else if(entry.name.endsWith('.ts')) files.push(full); } };
  walk(sourceRoot);
  const occurrences = files.filter(file => /@r8fb|Desenvolvido por/i.test(fs.readFileSync(file,'utf8'))).map(file=>path.relative(sourceRoot,file));
  assert.deepEqual(occurrences.sort(), ['panel/components/common.ts','storage/guildConfigStore.ts'].sort());
  const common = fs.readFileSync(path.join(sourceRoot,'panel','components','common.ts'),'utf8');
  assert.match(common, /mainCreditFooter/);
});

test('Telloyn usa menção opcional sem min_values zero obrigatório', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'telloynService.ts'), 'utf8');
  assert.match(source, /setRequired\(false\)/);
  assert.doesNotMatch(source, /setRequired\(false\)\.setMinValues\(0\)/);
  assert.doesNotMatch(source, /────────────────/);
});

test('groles permite pesquisar cargo pelo seletor nativo e usa emojis próprios de adicionar/remover', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  assert.match(source, /RoleSelectMenuBuilder/);
  assert.match(source, /Pesquisar ou selecionar um cargo/);
  assert.match(source, /\|select\|0/);
  assert.match(source, /UI_EMOJIS\.add/);
  assert.match(source, /UI_EMOJIS\.subtract/);
});

test('groles usa IDs diferentes para anterior e próxima', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  assert.match(source, /\|prev\|/);
  assert.match(source, /\|next\|/);
  assert.doesNotMatch(source, /\|page\|\$\{Math\.max/);
});

test('navegação principal e categorias usam menus de seleção', () => {
  const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'homePage.ts'), 'utf8');
  const community = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'communityPage.ts'), 'utf8');
  const logs = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'logsPage.ts'), 'utf8');
  const protection = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'protectionPage.ts'), 'utf8');
  assert.match(home, /StringSelectMenuBuilder/);
  assert.match(community, /communitysection/);
  assert.match(community, /ticketpanel/);
  assert.match(logs, /logcategory/);
  assert.match(protection, /protectionsection/);
});

test('tickets suportam canal ou tópico e botão ou menu', () => {
  const cfg = createDefaultGuildConfig('ticket-layout-v7');
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'tickets', 'ticketService.ts'), 'utf8');
  assert.match(source, /creationMode === 'thread'/);
  assert.match(source, /openComponent === 'select'/);
  assert.match(source, /ChannelType\.PrivateThread/);
  assert.equal(cfg.community.tickets.maximumPanels, 10);
});


test('prévia de boas-vindas e saída não responde duas vezes à interação', () => {
  const panel = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'panelManager.ts'), 'utf8');
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'messageService.ts'), 'utf8');
  assert.match(panel, /ephemeralReplyActions[\s\S]*communitymessagetest/);
  assert.match(service, /interaction\.deferred && !interaction\.replied/);
  assert.match(service, /interaction\.editReply\(payload\)/);
  assert.match(service, /Prévia de boas-vindas/);
  assert.match(service, /Prévia de saída/);
});

test('ship usa Canvas e resultado determinístico para o mesmo par', () => {
  const { shipCompatibility } = require(`../${build}/community/shipCompatibility.js`);
  const first = shipCompatibility('100', '200', 'guild');
  const second = shipCompatibility('200', '100', 'guild');
  assert.equal(first, second);
  assert.ok(first >= 0 && first <= 100);
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'shipCanvas.ts'), 'utf8');
  assert.match(source, /createShipCard/);
  assert.match(source, /createCanvas/);
});

test('nuke exige confirmação e verifica Gerenciar Canais', () => {
  const cfg = createDefaultGuildConfig('nuke-test');
  assert.ok(cfg.commands.permissions.nuke);
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  assert.match(source, /requestChannelNuke/);
  assert.match(source, /handleNukeInteraction/);
  assert.match(source, /PermissionFlagsBits\.ManageChannels/);
  assert.match(source, /Confirmar recriação/);
  assert.match(source, /channel\.clone/);
});

test('novos comandos de diversão e comunicação estão configuráveis', () => {
  const cfg = createDefaultGuildConfig('commands-v8');
  for (const command of ['ship','wanted','jail','coinflip','dice','choose','eightball','say','sayembed','nuke']) {
    assert.ok(cfg.commands.permissions[command], `permissão ausente: ${command}`);
  }
  assert.ok(cfg.commands.aliases.ship.includes('compatibilidade'));
  assert.ok(cfg.logs.events.ship_used);
  assert.ok(cfg.logs.events.fun_canvas_used);
  assert.ok(cfg.logs.events.channel_nuke);
});

test('configuração global contém os dois owners solicitados', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
  assert.deepEqual(config.owners, ['1457931690172481536','1524580565746061393']);
});

test('avisos temporários de clear, CL e erros são removidos em cinco segundos', () => {
  const commands = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  const cl = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'clService.ts'), 'utf8');
  assert.match(commands, /replyTemporary\(message/);
  assert.match(commands, /5_000/);
  assert.match(cl, /temporaryReply/);
  assert.match(cl, /5_000/);
});

test('previews do painel usam controles desativados', () => {
  const preview = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'components', 'appearancePreview.ts'), 'utf8');
  const community = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'communityPage.ts'), 'utf8');
  assert.match(preview, /setDisabled\(true\)/);
  assert.match(preview, /Prévia real/);
  assert.match(community, /preview:instagram/);
  assert.match(community, /preview:role-panel/);
  assert.match(community, /preview:form/);
});

test('wanted e jail usam Canvas e aparecem no help configurável', () => {
  const cfg = createDefaultGuildConfig('canvas-fun-v8');
  assert.ok(cfg.commands.permissions.wanted);
  assert.ok(cfg.commands.permissions.jail);
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'funCanvas.ts'), 'utf8');
  assert.match(source, /createWantedCard/);
  assert.match(source, /createJailCard/);
  assert.match(source, /createCanvas/);
});

test('prévia privada edita a resposta deferida sem reenviar a flag ephemeral', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'messageService.ts'), 'utf8');
  assert.match(source, /interaction\.editReply\(payload\)/);
  assert.match(source, /interaction\.followUp\(\{ \.\.\.payload, flags: MessageFlags\.Ephemeral \}\)/);
});



test('base de moderação avançada mantém todos os comandos escolhidos e aliases configuráveis', () => {
  const { COMMAND_NAMES } = require(`../${build}/config/defaults.js`);
  const cfg = createDefaultGuildConfig('commands-v9');
  const selected = [
    'softban','tempban','warn','warnings','history','reason','purgeuser','purgebots','purgelinks','purgeattachments','purgementions','purgecontains',
    'voicemute','voiceunmute','voicedeafen','move','voicelock','voiceunlock','voiceinfo','security','raidmode','risk','webhookcheck',
    'ticket','ticketadd','ticketremove','ticketclaim','ticketunclaim','ticketclose','ticketreopen','ticketdelete','ticketrename','ticketpriority','tickettransfer','ticketpause','ticketresume','ticketinfo','tickettranscript','tickets','ticketsearch','ticketblock','ticketunblock',
    'temprole','roleexpires','rolebackup','membercount','boostinfo','inviteinfo','joined','created','mutualroles','invitecount','topvoice','activity'
  ];
  for (const command of selected) {
    assert.ok(COMMAND_NAMES.includes(command), `comando ausente: ${command}`);
    assert.ok(cfg.commands.permissions[command], `configuração ausente: ${command}`);
    assert.ok(Array.isArray(cfg.commands.aliases[command]), `aliases ausentes: ${command}`);
  }
});

test('dados persistentes incluem bans, cargos temporários, backups e atividade de voz', () => {
  const cfg = createDefaultGuildConfig('persistent-v9');
  assert.equal(cfg.schemaVersion, 13);
  assert.deepEqual(cfg.moderation.temporaryBans, []);
  assert.deepEqual(cfg.community.temporaryRoles, []);
  assert.deepEqual(cfg.community.roleBackups, []);
  assert.equal(cfg.community.voiceActivity.enabled, false);
  assert.equal(cfg.community.voiceActivity.updateSeconds, 10);
  assert.deepEqual(cfg.community.voiceActivity.totalsSeconds, {});
  assert.deepEqual(cfg.community.inviteJoins, {});
});

test('atividade de voz soma sessões encerradas e sessões em andamento', () => {
  const { voiceSeconds, voiceLeaderboard, formatVoiceTime } = require(`../${build}/community/activityMath.js`);
  const cfg = createDefaultGuildConfig('voice-v9');
  cfg.community.voiceActivity.totalsSeconds.u1 = 120;
  cfg.community.voiceActivity.activeSince.u1 = new Date(1_000).toISOString();
  assert.equal(voiceSeconds(cfg, 'u1', 61_000), 180);
  assert.deepEqual(voiceLeaderboard(cfg, 1, 61_000), [{ userId:'u1', seconds:180 }]);
  assert.equal(formatVoiceTime(3720), '1h 2m');
});

test('backup e restauração de cargos existem como comando e função do painel', () => {
  const command = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  const panel = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'panelManager.ts'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'communityPage.ts'), 'utf8');
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'roleBackupService.ts'), 'utf8');
  assert.match(command, /this\.command\('rolebackup'/);
  assert.match(panel, /rolebackupcreate/);
  assert.match(panel, /rolebackuprestore/);
  assert.match(page, /renderRoleBackup/);
  assert.match(service, /async create\(/);
  assert.match(service, /async restoreLatest\(/);
  assert.match(service, /colors: \{ primaryColor: snapshot\.color \}/);
});

test('ranking de voz pode ser configurado no painel e atualiza a cada dez segundos', () => {
  const startup = fs.readFileSync(path.join(__dirname, '..', 'src', 'bot', 'startup.ts'), 'utf8');
  const panel = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'panelManager.ts'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'communityPage.ts'), 'utf8');
  assert.match(startup, /10_000/);
  assert.match(startup, /refreshFastGuild/);
  assert.match(panel, /voiceactivitychannel/);
  assert.match(panel, /voiceactivitytoggle/);
  assert.match(page, /Ranking de call/);
});

test('todos os comandos de ticket selecionados possuem implementação real', () => {
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'tickets', 'ticketService.ts'), 'utf8');
  const commands = ['ticket','tickets','ticketsearch','ticketinfo','ticketclaim','ticketunclaim','ticketadd','ticketremove','ticketclose','ticketreopen','ticketdelete','ticketrename','ticketpriority','tickettransfer','ticketpause','ticketresume','tickettranscript','ticketblock','ticketunblock'];
  for (const command of commands) assert.match(service, new RegExp(`command === '${command}'|command === 'ticketpause' \\|\\| command === 'ticketresume'|command === 'ticketblock' \\|\\| command === 'ticketunblock'`), `ticket sem fluxo: ${command}`);
  assert.match(service, /autoClosePaused/);
  assert.match(service, /createHtmlTranscript/);
  assert.match(service, /delete config\.community\.tickets\.openTickets\[ticket\.id\]/);
});


test('versão 10 inclui Twitter com webhook e limpeza automática por regras', () => {
  const cfg = createDefaultGuildConfig('community-v10');
  assert.equal(cfg.schemaVersion, 13);
  assert.equal(cfg.community.twitter.enabled, false);
  assert.equal(cfg.community.twitter.webhookName, 'X');
  assert.equal(cfg.community.autoClean.maximumRules, 10);
  assert.deepEqual(cfg.community.autoClean.rules, []);
  for (const event of ['twitter_post_created','twitter_post_rejected','auto_clean_deleted','auto_clean_failed']) {
    assert.ok(cfg.logs.events[event], `log ausente: ${event}`);
  }
});

test('Twitter republica por webhook com nome e avatar do autor', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'twitterService.ts'), 'utf8');
  assert.match(source, /fetchWebhooks/);
  assert.match(source, /createWebhook/);
  assert.match(source, /username: displayName/);
  assert.match(source, /avatarURL:/);
  assert.match(source, /deleteOriginalMessage/);
});

test('limpeza automática suporta tudo, imagens, texto e links', () => {
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'autoCleanService.ts'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'communityPage.ts'), 'utf8');
  assert.match(service, /rule\.mode === 'all'/);
  assert.match(service, /rule\.mode === 'images'/);
  assert.match(service, /rule\.mode === 'text'/);
  assert.match(service, /LINK_PATTERN/);
  assert.match(page, /autocleanmode/);
  assert.match(page, /autocleanchannel/);
});

test('ship possui corações vetoriais e jail usa corpo de presidiário com cabeça do avatar', () => {
  const ship = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'shipCanvas.ts'), 'utf8');
  const jail = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'funCanvas.ts'), 'utf8');
  assert.match(ship, /drawHeart/);
  assert.match(ship, /Corações em perfeita sintonia/);
  assert.match(jail, /Corpo de uniforme de presidiário/);
  assert.match(jail, /drawHead/);
  assert.match(jail, /Grades em primeiro plano/);
});

test('novos comandos visuais estão configurados e possuem implementação', () => {
  const cfg = createDefaultGuildConfig('fun-v10');
  const commands = ['profilecard','quote','blur','pixelate','grayscale','invert','achievement','rate','highfive','pat'];
  for (const command of commands) assert.ok(cfg.commands.permissions[command], `comando ausente: ${command}`);
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  for (const command of commands) assert.match(source, new RegExp(`this\\.command\\('${command}'`));
});


test('categorias da comunidade mantêm navegação por menu até entrar na função', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'communityPage.ts'), 'utf8');
  const panel = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'panelManager.ts'), 'utf8');
  const start = page.indexOf('function renderCategory');
  const end = page.indexOf('function renderTelloyn', start);
  const categoryBlock = page.slice(start, end);
  assert.match(categoryBlock, /StringSelectMenuBuilder/);
  assert.match(categoryBlock, /communityfunction/);
  assert.match(categoryBlock, /Selecione uma função/);
  assert.doesNotMatch(categoryBlock, /selected\.buttons|communityopen',target/);
  assert.match(panel, /action === 'communityfunction'/);
});

test('ranking de call mostra segundos e sincroniza o cache real de voz', () => {
  const { formatVoiceTime } = require(`../${build}/community/activityMath.js`);
  const service = fs.readFileSync(path.join(__dirname, '..', 'src', 'community', 'activityService.ts'), 'utf8');
  assert.equal(formatVoiceTime(9), '9s');
  assert.equal(formatVoiceTime(75), '1m 15s');
  assert.match(service, /checkpointVoiceActivity/);
  assert.match(service, /currentVoiceMemberIds/);
  assert.match(service, /guildConfigStore\.update/);
  assert.match(service, /Em call agora/);
});

test('staff log e aliases administrativos estão configurados', () => {
  const cfg = createDefaultGuildConfig('stafflog-v10');
  for (const command of ['stafflog','staffstats','modtop','activepunishments']) {
    assert.ok(cfg.commands.permissions[command], `permissão ausente: ${command}`);
  }
  assert.ok(cfg.commands.aliases.stafflog.includes('staff'));
  assert.ok(cfg.commands.aliases.stafflog.includes('acoes'));
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  assert.match(source, /staffcase\|/);
  assert.match(source, /staffrevoke\|/);
  assert.match(source, /Revogar punição/);
});

test('tutorial é uma aba separada e não expõe detalhes de Canvas', () => {
  const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'homePage.ts'), 'utf8');
  const tutorial = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'tutorialPage.ts'), 'utf8');
  const community = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'communityPage.ts'), 'utf8');
  assert.match(home, /Tutorial/);
  assert.match(tutorial, /Configuração inicial/);
  assert.match(tutorial, /Melhor desempenho/);
  assert.match(tutorial, /Staff Log/);
  assert.doesNotMatch(community, /usa Canvas|em Canvas|cartão em Canvas|Publicações em Canvas/i);
});

test('status rotativo aceita aliases dinâmicos e intervalo mínimo de cinco segundos', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'bot', 'presence.ts'), 'utf8');
  for (const alias of ['members','servers','channels','prefix','bot','ping']) assert.match(source, new RegExp(`${alias}:`));
  assert.match(source, /\buptime\b/);
  assert.match(source, /Math\.max\(5/);
  assert.match(source, /setInterval\(\(\) =>/);
  assert.match(source, /Date\.now\(\) >= nextAt/);
  assert.match(source, /split\(\/\\r\?\\n\//);
});

test('novas consultas de comunidade estão habilitadas e possuem aliases', () => {
  const cfg = createDefaultGuildConfig('community-prefix-v10');
  const commands = ['serveravatar','bots','serveradmins','membersearch','rolecount'];
  for (const command of commands) {
    assert.ok(cfg.commands.permissions[command], `comando ausente: ${command}`);
    assert.ok(Array.isArray(cfg.commands.aliases[command]), `aliases ausentes: ${command}`);
  }
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  for (const command of commands) assert.match(source, new RegExp(`this\\.command\\('${command}'`));
});

test('catálogo visual usa emojis únicos e semanticamente separados', () => {
  const { UI_EMOJIS } = require(`../${build}/ui/emojis.js`);
  const ids = Object.values(UI_EMOJIS);
  assert.equal(ids.length, 62);
  assert.equal(new Set(ids).size, 62);

  assert.equal(UI_EMOJIS.close, '1535356513823105045');
  assert.equal(UI_EMOJIS.loading, '1535357133665603594');
  assert.equal(UI_EMOJIS.left, '1535370886595616820');
  assert.equal(UI_EMOJIS.right, '1535370890592919623');
  for (const id of ids) assert.match(id, /^\d{19}$/);

  const home = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'homePage.ts'), 'utf8');
  const community = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'communityPage.ts'), 'utf8');
  const tutorial = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'pages', 'tutorialPage.ts'), 'utf8');
  const commands = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  assert.match(home, /setEmoji\(UI_EMOJIS\.community\)/);
  assert.match(home, /setEmoji\(UI_EMOJIS\.shield\)/);
  assert.match(community, /COMMUNITY_FUNCTION_EMOJIS/);
  assert.match(tutorial, /TUTORIAL_ENTRY_EMOJIS/);
  assert.match(commands, /setEmoji\(UI_EMOJIS\.stafflog\)/);
  assert.equal(UI_EMOJIS.roles, '1535361751057694780');
  assert.equal(UI_EMOJIS.fun, '1535361944175902740');
  assert.equal(UI_EMOJIS.form, '1535362115605364808');
  assert.equal(UI_EMOJIS.massroles, '1535365491647057970');

  const common = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'components', 'common.ts'), 'utf8');
  const startup = fs.readFileSync(path.join(__dirname, '..', 'src', 'bot', 'startup.ts'), 'utf8');
  const manager = fs.readFileSync(path.join(__dirname, '..', 'src', 'panel', 'panelManager.ts'), 'utf8');
  assert.doesNotMatch(common, /Atualizar/);
  assert.match(common, /setEmoji\(UI_EMOJIS\.close\)/);
  assert.match(startup, /clientReady/);
  assert.match(startup, /hydrateUiEmojis/);
  assert.match(manager, /UI_LOADING_MENTION/);
  assert.match(manager, /Detalhes dos erros/);
});

test('catálogo de emojis faz fallback seguro quando o Discord não disponibiliza um ID', async () => {
  const { UI_EMOJIS, hydrateUiEmojis } = require(`../${build}/ui/emojis.js`);
  const availableHome = { id:'1535353166361788476', name:'icons8casa50' };
  const status = await hydrateUiEmojis({
    application:{ emojis:{ fetch:async()=>new Map([[availableHome.id, availableHome]]) } },
    guilds:{ cache:new Map() }
  });
  assert.equal(UI_EMOJIS.home, availableHome.id);
  assert.doesNotMatch(UI_EMOJIS.community, /^\d{16,22}$/);
  assert.ok(status.fallback.some(item => item.key === 'community'));
});

test('help pagina por quantidade de comandos e usa setas personalizadas', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  assert.match(source, /const perPage = 6;/);
  assert.match(source, /Math\.ceil\(commands\.length \/ perPage\)/);
  assert.match(source, /UI_EMOJIS\.left/);
  assert.match(source, /UI_EMOJIS\.right/);
  assert.match(source, /help\|\$\{member\.id\}\|\$\{category\}\|/);
});

test('novos comandos de staff, voz e diagnóstico estão configurados e implementados', () => {
  const { COMMAND_NAMES, DEFAULT_ALIASES } = require(`../${build}/config/defaults.js`);
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  const commands = ['joinposition','memberroles','rolecompare','voicewho','serversecurity','stafflist','permissionshere','serveremojis','serverstickers','snowflake','countdown','massmove','disconnectvoice'];
  for (const command of commands) {
    assert.ok(COMMAND_NAMES.includes(command), `comando ausente: ${command}`);
    assert.ok(Array.isArray(DEFAULT_ALIASES[command]), `aliases ausentes: ${command}`);
    assert.match(source, new RegExp(`this\\.command\\('${command}'`));
  }
});

test('comandos simples de moderação usam respostas visuais e validações melhores', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  assert.match(source, /setTitle\('Advertência aplicada'\)/);
  assert.match(source, /setTitle\(`Advertências de \$\{member\.displayName\}`\)/);
  assert.match(source, /setTitle\('Limpeza concluída'\)/);
  assert.match(source, /setTitle\('Canal bloqueado'\)/);
  assert.match(source, /setTitle\('Canal liberado'\)/);
  assert.match(source, /Esse membro já possui o cargo informado/);
  assert.match(source, /Esse membro não possui o cargo informado/);
});


test('help usa custom id exclusivo no indicador de página', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'commands', 'commandManager.ts'), 'utf8');
  assert.match(source, /helpindicator\|\$\{member\.id\}\|\$\{category\}\|\$\{safePage\}/);
  assert.doesNotMatch(source, /setCustomId\(`help\|\$\{member\.id\}\|\$\{category\}\|\$\{safePage\}`\)\.setLabel\(`\$\{safePage \+ 1\}\/\$\{totalPages\}`\)/);
});
