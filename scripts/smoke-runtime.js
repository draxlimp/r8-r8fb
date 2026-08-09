const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

class BuilderBase {
  constructor(kind) {
    this.kind = kind;
    this.calls = [];
  }
}

const methods = [
  'setAccentColor','setContent','setSpacing','setCustomId','setLabel','setStyle','setDisabled',
  'setPlaceholder','setChannelTypes','setDescription','setValue','setTitle','setRequired',
  'setThumbnailAccessory','setURL','setMinValues','setMaxValues','setDefault','setName',
  'setColor','setImage','setThumbnail','setFooter','setTimestamp','setMaxLength',
  'addComponents','addOptions','addTextDisplayComponents','addSeparatorComponents',
  'addActionRowComponents','addSectionComponents','addMediaGalleryComponents','addItems','addLabelComponents',
  'setButtonAccessory','setFileUploadComponent','setTextInputComponent','setChannelSelectMenuComponent','setUserSelectMenuComponent','setRoleSelectMenuComponent','setEmoji','setAuthor'
];

function builderClass(kind) {
  class MockBuilder extends BuilderBase {
    constructor() { super(kind); }
  }
  for (const method of methods) {
    MockBuilder.prototype[method] = function (...args) {
      this.calls.push({ method, args });
      return this;
    };
  }
  return MockBuilder;
}

const ActionRowBuilder = builderClass('ActionRow');
const ButtonBuilder = builderClass('Button');
const ContainerBuilder = builderClass('Container');
const SeparatorBuilder = builderClass('Separator');
const TextDisplayBuilder = builderClass('TextDisplay');
const SectionBuilder = builderClass('Section');
const ThumbnailBuilder = builderClass('Thumbnail');
const MediaGalleryBuilder = builderClass('MediaGallery');
const MediaGalleryItemBuilder = builderClass('MediaGalleryItem');
const FileUploadBuilder = builderClass('FileUpload');
const LabelBuilder = builderClass('Label');
const StringSelectMenuBuilder = builderClass('StringSelect');
const StringSelectMenuOptionBuilder = builderClass('StringSelectOption');
const ChannelSelectMenuBuilder = builderClass('ChannelSelect');
const RoleSelectMenuBuilder = builderClass('RoleSelect');
const UserSelectMenuBuilder = builderClass('UserSelect');
const ModalBuilder = builderClass('Modal');
const TextInputBuilder = builderClass('TextInput');
const AttachmentBuilder = builderClass('Attachment');
const Client = builderClass('Client');

const enumProxy = new Proxy({}, { get: (_, key) => key === 'Administrator' ? 1n : 1 });
class PermissionsBitField extends BuilderBase {
  constructor(bits) { super('Permissions'); this.bitfield = bits ?? 0n; }
  has() { return false; }
}
for (const method of methods) PermissionsBitField.prototype[method] = function (...args) { this.calls.push({method,args}); return this; };

const discordMock = new Proxy({
  ActionRowBuilder, ButtonBuilder, ContainerBuilder, SeparatorBuilder,
  TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, FileUploadBuilder, LabelBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder, TextInputBuilder,
  PermissionsBitField, Client, AttachmentBuilder,
  PermissionFlagsBits: enumProxy, AuditLogEvent: enumProxy, ActivityType: enumProxy, GatewayIntentBits: enumProxy,
  Partials: enumProxy, ChannelType: enumProxy, MessageFlags: { Ephemeral: 64, IsComponentsV2: 32768 },
  ButtonStyle: enumProxy, SeparatorSpacingSize: enumProxy, TextInputStyle: enumProxy
}, { get: (target, key) => key in target ? target[key] : builderClass(String(key)) });

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'discord.js') return discordMock;
  if (request === '@napi-rs/canvas') return {
    createCanvas: () => ({
      getContext: () => new Proxy({}, { get: (_target, key) => key === 'measureText' ? (() => ({ width: 0 })) : (() => undefined), set: () => true }),
      encode: async () => Buffer.from('mock-canvas')
    }),
    loadImage: async () => ({ width: 128, height: 128 })
  };
  return originalLoad.call(this, request, parent, isMain);
};

const build = process.env.R8_TEST_BUILD || 'dist';
const root = path.resolve(build);
if (!fs.existsSync(root)) throw new Error(`Build ausente: ${root}`);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js') && entry.name !== 'index.js') files.push(full);
  }
}
walk(root);
for (const file of files) require(file);

function countMessageComponents(rootBuilder) {
  const seen = new Set();
  function visit(value) {
    if (Array.isArray(value)) return value.reduce((sum, item) => sum + visit(item), 0);
    if (!value || typeof value !== 'object') return 0;
    if (!(value instanceof BuilderBase) || seen.has(value)) return 0;
    seen.add(value);
    const own = value.kind === 'StringSelectOption' || value.kind === 'Attachment' ? 0 : 1;
    return own + value.calls.reduce((sum, call) => sum + visit(call.args), 0);
  }
  return visit(rootBuilder);
}

function assertPage(name, container) {
  const count = countMessageComponents(container);
  assert.ok(count <= 40, `${name} usa ${count} componentes; o máximo adotado é 40`);
  const customIds = collectCustomIds(container);
  assert.equal(new Set(customIds).size, customIds.length, `${name} contém custom_id duplicado: ${customIds.join(', ')}`);
  return count;
}

const { createDefaultGuildConfig, PROTECTION_MODULES, LOG_EVENTS, defaultRolePanel, defaultApplicationForm, COMMAND_NAMES } = require(path.join(root, 'config/defaults.js'));
const { homePage } = require(path.join(root, 'panel/pages/homePage.js'));
const { personalizationPage } = require(path.join(root, 'panel/pages/personalizationPage.js'));
const { protectionPage } = require(path.join(root, 'panel/pages/protectionPage.js'));
const { logsPage } = require(path.join(root, 'panel/pages/logsPage.js'));
const { bypassPage } = require(path.join(root, 'panel/pages/bypassPage.js'));
const { backupsPage } = require(path.join(root, 'panel/pages/backupsPage.js'));
const { diagnosticsPage } = require(path.join(root, 'panel/pages/diagnosticsPage.js'));
const { generalSettingsPage } = require(path.join(root, 'panel/pages/generalSettingsPage.js'));
const { communityPage } = require(path.join(root, 'panel/pages/communityPage.js'));
const { botConfigPage } = require(path.join(root, 'panel/pages/botConfigPage.js'));
const { tutorialPage } = require(path.join(root, 'panel/pages/tutorialPage.js'));
const { defaultTicketAppearance } = require(path.join(root, 'config/defaults.js'));
const { renderIncident } = require(path.join(root, 'logs/logRenderer.js'));

const cfg = createDefaultGuildConfig('guild-smoke');
const session = { id:'abc123', userId:'u1', guildId:'g1', channelId:'c1', messageId:null, page:'home', createdAt:Date.now(), lastInteractionAt:Date.now(), timeoutSeconds:300, state:{}, busy:false };
const ids = { encode: (sid, action, arg='') => `p|${sid}|${action}|${arg}|signature` };
const user = { id:'u1', username:'r8fb', displayAvatarURL:()=> 'https://example.invalid/avatar.png' };
const guild = { name:'Servidor de teste', members:{me:{displayName:'R8 Protection'}} };
const client = { user:{tag:'r8-protection#0001'} };
const app = { prefix:'!', defaultPresence:{status:'online',activityType:'watching',activityText:'[members] membros',rotationEnabled:true,rotationIntervalSeconds:5,rotationActivities:[{activityType:'watching',activityText:'[members] membros'}]}, credits:{ enabled:true, title:'Créditos', people:[{name:'r8fb',discord:'@r8fb',role:'Desenvolvedor principal'}] } };
const counts = {};

counts.home = assertPage('home', homePage(session, ids, user, guild, app, cfg));
session.page='community'; session.state={communitySection:'overview'};
counts.communityOverview = assertPage('communityOverview', communityPage(session, ids, cfg, user, guild));
session.state={communitySection:'cl'};
counts.communityCl = assertPage('communityCl', communityPage(session, ids, cfg, user, guild));
session.state={communitySection:'tickets'};
counts.communityTicketsEmpty = assertPage('communityTicketsEmpty', communityPage(session, ids, cfg, user, guild));
const ticketPanel = {
  id:'PNL-SMOKE', name:'Suporte', enabled:true, categoryId:null, publishChannelId:null, publishMessageId:null,
  supportRoleIds:[], allowedRoleIds:[], blockedRoleIds:[], blockedUserIds:[], maxOpenPerUser:1, logChannelId:null, transcriptChannelId:null,
  ticketNamePattern:'ticket-[user.name]-[ticket.number]', external:defaultTicketAppearance('external'), internal:defaultTicketAppearance('internal'),
  questions:[{id:'Q-1',label:'Motivo',placeholder:'Explique',required:true,paragraph:true}], autoCloseMinutes:0, allowReopen:true, ratingEnabled:false,
  businessHoursEnabled:false,businessHoursText:'Atendimento disponível.',
  internalButtons:{claim:true,unclaim:true,close:true,reopen:true,delete:true,addMember:true,removeMember:true,createVoice:true,transfer:true,priority:true,rename:true,transcript:true},
  createdBy:'u1', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
};
cfg.community.tickets.panels.push(ticketPanel);
for (const view of ['list','panel','external','internal','settings','access','logs','questions','buttons']) {
  session.state={communitySection:'tickets',ticketPanelId:ticketPanel.id,ticketView:view};
  counts[`communityTickets${view}`] = assertPage(`communityTickets${view}`, communityPage(session, ids, cfg, user, guild));
}
session.state={communitySection:'welcome'};
counts.communityWelcome = assertPage('communityWelcome', communityPage(session,ids,cfg,user,guild));
session.state={communitySection:'goodbye'};
counts.communityGoodbye = assertPage('communityGoodbye', communityPage(session,ids,cfg,user,guild));
session.state={communitySection:'autorole'};
counts.communityAutorole = assertPage('communityAutorole', communityPage(session, ids, cfg, user, guild));
session.state={communitySection:'massroles'};
counts.communityMassRoles = assertPage('communityMassRoles', communityPage(session, ids, cfg, user, guild));
session.state={communitySection:'rolebackup'};
counts.communityRoleBackup = assertPage('communityRoleBackup', communityPage(session, ids, cfg, user, guild));
session.state={communitySection:'voiceactivity'};
counts.communityVoiceActivity = assertPage('communityVoiceActivity', communityPage(session, ids, cfg, user, guild));
const rolePanel=defaultRolePanel('u1',1);
rolePanel.options.push({roleId:'role-1',label:'Notificações',description:'Receber avisos',emoji:null});
cfg.community.rolePanels.panels.push(rolePanel);
for (const view of ['list','panel','appearance','options','access']) {
  session.state={communitySection:'rolepanels',rolePanelId:rolePanel.id,rolePanelView:view};
  counts[`communityRolePanel${view}`]=assertPage(`communityRolePanel${view}`,communityPage(session,ids,cfg,user,guild));
}
const applicationForm=defaultApplicationForm('u1',1);
cfg.community.forms.forms.push(applicationForm);
for (const view of ['list','panel','appearance','questions','access']) {
  session.state={communitySection:'forms',formId:applicationForm.id,formView:view};
  counts[`communityForm${view}`]=assertPage(`communityForm${view}`,communityPage(session,ids,cfg,user,guild));
}
for (const view of ['home','appearance','settings']) {
  session.state={communitySection:'telloyn',telloynView:view};
  counts[`communityTelloyn${view}`]=assertPage(`communityTelloyn${view}`,communityPage(session,ids,cfg,user,guild));
}
for (const view of ['home','appearance','settings']) {
  session.state={communitySection:'instagram',instagramView:view};
  counts[`communityInstagram${view}`]=assertPage(`communityInstagram${view}`,communityPage(session,ids,cfg,user,guild));
}
for (const view of ['home','settings']) {
  session.state={communitySection:'twitter',twitterView:view};
  counts[`communityTwitter${view}`]=assertPage(`communityTwitter${view}`,communityPage(session,ids,cfg,user,guild));
}
session.state={communitySection:'autoclean',autoCleanView:'list'};
counts.communityAutoCleanList=assertPage('communityAutoCleanList',communityPage(session,ids,cfg,user,guild));
const now=new Date().toISOString();
cfg.community.autoClean.rules.push({
  id:'ACL-SMOKE',name:'Limpeza geral',enabled:true,channelId:null,mode:'all',delaySeconds:30,
  includeBots:false,includeWebhooks:false,ignorePinned:true,logDeletions:true,
  createdBy:'u1',createdAt:now,updatedAt:now
});
session.state={communitySection:'autoclean',autoCleanView:'rule',autoCleanRuleId:'ACL-SMOKE'};
counts.communityAutoCleanRule=assertPage('communityAutoCleanRule',communityPage(session,ids,cfg,user,guild));
session.page='configbot'; session.state={};
counts.configBot = assertPage('configBot', botConfigPage(session, ids, cfg, client));
session.state={botConfigSection:'aliases',selectedCommand:'help',commandPage:0}; counts.configAliases=assertPage('configAliases',botConfigPage(session,ids,cfg,client));
session.state={botConfigSection:'commands',commandPage:0}; counts.configCommands=assertPage('configCommands',botConfigPage(session,ids,cfg,client));
session.state={botConfigSection:'commandaccess',selectedCommand:'help'}; counts.configCommandAccess=assertPage('configCommandAccess',botConfigPage(session,ids,cfg,client));
session.page='personalization'; session.state={};
counts.personalization = assertPage('personalization', personalizationPage(session, ids, cfg, client, guild, app));
session.page='tutorial'; session.state={tutorialSection:'start'};
counts.tutorial = assertPage('tutorial', tutorialPage(session, ids, cfg));
session.page='protections'; session.state={selectedModule:PROTECTION_MODULES[0]};
counts.protections = assertPage('protections', protectionPage(session, ids, cfg));
session.page='logs'; session.state={logCategory:'home',logsPage:0};
counts.logsHome = assertPage('logsHome',logsPage(session,ids,cfg));
session.state={logCategory:'security',logsPage:0};
counts.logsSecurity = assertPage('logsSecurity',logsPage(session,ids,cfg));

cfg.bypasses.push({
  id:'BP-SMOKE', kind:'user', targetId:'u1', modules:['*'],
  behavior:{ignoreDetection:false,ignorePunishment:true,ignoreRestoration:true,ignoreLimit:true,continueLogging:true},
  reason:'smoke', createdBy:'u1', createdAt:new Date().toISOString(), expiresAt:null
});
session.page='bypass'; session.state={selectedBypass:'BP-SMOKE'};
counts.bypass = assertPage('bypass', bypassPage(session, ids, cfg));
session.page='backups'; session.state={
  backupList:[{id:'BK-SMOKE',createdAt:new Date().toISOString(),reason:'smoke'}],
  pendingBackupRestore:'BK-SMOKE', backupReport:'Configuração restaurada; 1 canal recriado.'
};
counts.backups = assertPage('backups', backupsPage(session, ids, cfg));
session.page='diagnostics'; session.state={diagnosticReport:'### Correto\nArmazenamento acessível.'};
counts.diagnostics = assertPage('diagnostics', diagnosticsPage(session, ids, cfg));
session.page='settings'; session.state={};
counts.settings = assertPage('settings', generalSettingsPage(session, ids, cfg));

renderIncident({ id:'INC-2026-08-04-ABC123', guildId:'g1', module:'anti_link', event:'anti_link', severity:'high', executorId:'u1', targetId:'u1', channelId:'c1', confidence:'confirmed', bypass:null, configuredAction:'timeout', actionResult:'success', restorationResult:'not_requested', createdAt:new Date().toISOString(), completedAt:new Date().toISOString(), durationMs:2, details:{} });

const { CommandManager } = require(path.join(root,'commands/commandManager.js'));
const commandManager = new CommandManager({prefix:'!',credits:{enabled:true,title:'Créditos',people:[]}}, {handleCommand:async()=>undefined}, {topVoice:()=>[],getVoiceSeconds:()=>0}, {commandPayload:()=>({})});
for (const commandName of COMMAND_NAMES.filter(name=>name!=='cl')) assert.ok(commandManager.commands.has(commandName), `Comando sem implementação: ${commandName}`);

console.log(`[OK] Smoke test carregou ${files.length} módulos.`);
console.log(`[OK] Páginas Components V2 dentro do limite: ${Object.entries(counts).map(([name,count]) => `${name}=${count}`).join(', ')}.`);

function collectCustomIds(rootBuilder) {
  const ids = [];
  const seen = new Set();
  function visit(value) {
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    if (!value || typeof value !== 'object') return;
    if (!(value instanceof BuilderBase) || seen.has(value)) return;
    seen.add(value);
    for (const call of value.calls) {
      if (call.method === 'setCustomId' && typeof call.args[0] === 'string') ids.push(call.args[0]);
      visit(call.args);
    }
  }
  visit(rootBuilder);
  return ids;
}

const helpManager = commandManager;
const helpMember = { id:'u-help', permissions:{ has:()=>true } };
for (const category of ['home','moderation','community','information','utility','protection']) {
  for (let page = 0; page < 30; page++) {
    const payload = helpManager.helpPayload(helpMember, cfg, category, page);
    const helpContainer = payload.components[0];
    const customIds = collectCustomIds(helpContainer);
    const unique = new Set(customIds);
    assert.equal(unique.size, customIds.length, `help ${category} página ${page + 1} contém custom_id duplicado: ${customIds.join(', ')}`);
  }
}
console.log('[OK] Help validado sem custom_id duplicado em todas as categorias e páginas testadas.');
