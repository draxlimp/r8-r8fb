"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanelManager = void 0;
const discord_js_1 = require("discord.js");
const defaults_1 = require("../config/defaults");
const configLoader_1 = require("../config/configLoader");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const backupStore_1 = require("../storage/backupStore");
const accessManager_1 = require("../permissions/accessManager");
const permissionChecker_1 = require("../permissions/permissionChecker");
const customIdManager_1 = require("./customIdManager");
const sessionManager_1 = require("./sessionManager");
const homePage_1 = require("./pages/homePage");
const protectionPage_1 = require("./pages/protectionPage");
const logsPage_1 = require("./pages/logsPage");
const bypassPage_1 = require("./pages/bypassPage");
const backupsPage_1 = require("./pages/backupsPage");
const diagnosticsPage_1 = require("./pages/diagnosticsPage");
const generalSettingsPage_1 = require("./pages/generalSettingsPage");
const personalizationPage_1 = require("./pages/personalizationPage");
const communityPage_1 = require("./pages/communityPage");
const botConfigPage_1 = require("./pages/botConfigPage");
const tutorialPage_1 = require("./pages/tutorialPage");
const snapshotManager_1 = require("../snapshots/snapshotManager");
const restorationEngine_1 = require("../protection/restorationEngine");
const bypassEngine_1 = require("../protection/bypassEngine");
const ids_1 = require("../utils/ids");
const logger_1 = require("../utils/logger");
const incidentManager_1 = require("../protection/incidentManager");
const logManager_1 = require("../logs/logManager");
const common_1 = require("./components/common");
const communityLogger_1 = require("../community/communityLogger");
const messageService_1 = require("../community/messageService");
const templateRenderer_1 = require("../community/templateRenderer");
const templateRenderer_2 = require("../tickets/templateRenderer");
const assetService_1 = require("../community/assetService");
const presence_1 = require("../bot/presence");
const emojis_1 = require("../ui/emojis");
const severityValues = ['info', 'low', 'medium', 'high', 'critical', 'emergency'];
const modalOpeningActions = new Set([
    'ticketfield', 'ticketupload', 'ticketsettingfield', 'ticketquestionadd', 'ticketquestionedit',
    'communitymessagefield', 'communityupload', 'voicefield', 'rolepanelfield', 'rolepaneloptionedit',
    'rolepanelmax', 'formfield', 'formquestionadd', 'formquestionedit', 'logchoosechannel', 'aliasedit',
    'commandcooldown', 'cllimitmodal', 'ticketsettingsmodal', 'ticketexternalmodal', 'ticketinternalmodal',
    'ticketexternalmedia', 'ticketinternalmedia', 'limitmodal', 'pfiltersmodal', 'ppunishmodal', 'loggroupmodal',
    'settingsmodal', 'raidmodal', 'activitymodal', 'rotationmodal', 'nickmodal', 'globalprofilemodal', 'telloynfield', 'telloynupload', 'instagramfield', 'instagramupload', 'twitterfield', 'autocleanfield'
]);
const ephemeralReplyActions = new Set(['massconfirm', 'backupexport', 'diagnosticexport', 'communitymessagetest']);
class PanelManager {
    client;
    app;
    ids;
    community;
    sessions;
    cleanupTimer = null;
    processedInteractions = new Map();
    constructor(client, app, ids, community) {
        this.client = client;
        this.app = app;
        this.ids = ids;
        this.community = community;
        this.sessions = new sessionManager_1.SessionManager(app.panel.sessionTimeoutSeconds, app.panel.maxSessionsPerUser);
    }
    static async create(client, app, community) {
        const manager = new PanelManager(client, app, await customIdManager_1.CustomIdManager.create(), community);
        manager.cleanupTimer = setInterval(() => void manager.expireSessions(), 30_000);
        manager.cleanupTimer.unref();
        return manager;
    }
    async open(message) {
        if (!message.guild || !message.member)
            return;
        const cfg = await guildConfigStore_1.guildConfigStore.get(message.guild.id);
        const access = (0, accessManager_1.canAccessPanel)(message.member, message.channel.id, this.app, cfg);
        if (!access.allowed) {
            await message.reply(`Acesso negado ao painel. Motivo: ${access.reason}.`).catch(() => undefined);
            return;
        }
        const session = this.sessions.create(message.author.id, message.guild.id, message.channel.id, cfg.panel.sessionTimeoutSeconds);
        const sent = await message.channel.send(this.payload(session, message.author, message.guild, cfg));
        session.messageId = sent.id;
        this.record(cfg, message.author.id, 'panel_open');
        await guildConfigStore_1.guildConfigStore.set(message.guild.id, cfg);
        if (cfg.panel.deleteCommandMessage && message.deletable)
            await message.delete().catch(() => undefined);
    }
    async handle(interaction) {
        if (!interaction.customId?.startsWith('p|'))
            return false;
        if (this.isDuplicateInteraction(interaction.id))
            return true;
        const rawParts = String(interaction.customId).split('|');
        const rawAction = rawParts[2] ?? '';
        const opensModal = interaction.isButton?.() && modalOpeningActions.has(rawAction);
        try {
            // Confirma imediatamente a interação. O Discord invalida o token quando a
            // primeira resposta demora; por isso nenhuma leitura de arquivo acontece antes deste ACK.
            if (!opensModal) {
                if (ephemeralReplyActions.has(rawAction))
                    await this.ensureDeferredReply(interaction);
                else if (interaction.isModalSubmit?.())
                    await this.ensureModalDeferred(interaction);
                else
                    await this.ensureDeferredUpdate(interaction);
            }
            const decoded = this.ids.decode(interaction.customId);
            if (!decoded) {
                await this.privateReply(interaction, 'Esse botão não é mais válido. Atualizei o painel; tente novamente.');
                return true;
            }
            let session = this.sessions.get(decoded.sessionId);
            const wasRecovered = !session;
            if (!session) {
                // Submissões de modal dependem de estado temporário. Renovamos o painel e
                // pedimos somente que a última edição seja repetida, sem encerrar toda a sessão.
                if (interaction.isModalSubmit?.()) {
                    session = await this.recoverSession(interaction);
                    if (session)
                        await this.editPanelMessage(interaction, this.payload(session, interaction.user, interaction.guild, await guildConfigStore_1.guildConfigStore.get(session.guildId)));
                    await this.privateReply(interaction, 'Atualizei seu painel. Repita somente a última alteração.');
                    return true;
                }
                session = await this.recoverSession(interaction);
                if (!session)
                    return true;
            }
            if (interaction.user.id !== session.userId) {
                await this.privateReply(interaction, 'Esse painel é de outro usuário. Use !painel para abrir o seu.');
                return true;
            }
            if (interaction.guildId !== session.guildId) {
                await this.privateReply(interaction, 'Este painel pertence a outro servidor.');
                return true;
            }
            const cfg = await guildConfigStore_1.guildConfigStore.get(session.guildId);
            const access = (0, accessManager_1.canAccessPanel)(interaction.member, interaction.channelId, this.app, cfg);
            if (!access.allowed) {
                await this.privateReply(interaction, `Seu acesso não é mais válido: ${access.reason}.`);
                return true;
            }
            if (session.busy) {
                await this.privateReply(interaction, 'Ainda estou concluindo a alteração anterior. Tente novamente em instantes.');
                return true;
            }
            this.sessions.touch(session.id);
            if (interaction.isModalSubmit())
                await this.handleModal(interaction, session, decoded.action, cfg);
            else if (interaction.isStringSelectMenu())
                await this.handleStringSelect(interaction, session, decoded.action, cfg);
            else if (interaction.isChannelSelectMenu())
                await this.handleChannelSelect(interaction, session, decoded.action, decoded.arg, cfg);
            else if (interaction.isUserSelectMenu())
                await this.handleUserSelect(interaction, session, decoded.action, decoded.arg, cfg);
            else if (interaction.isRoleSelectMenu())
                await this.handleRoleSelect(interaction, session, decoded.action, decoded.arg, cfg);
            else if (interaction.isButton())
                await this.handleButton(interaction, session, decoded.action, decoded.arg, cfg);
            else
                await this.privateReply(interaction, 'Tipo de interação não suportado.');
            if (wasRecovered)
                logger_1.logger.info('Sessão do painel renovada automaticamente.', { guildId: session.guildId, userId: session.userId });
        }
        catch (error) {
            const code = error?.code ?? error?.rawError?.code;
            const expiredInteraction = code === 10062 || /Unknown interaction/i.test(String(error?.message ?? error));
            logger_1.logger[expiredInteraction ? 'warn' : 'error']('Erro em interação do painel.', {
                customId: interaction.customId,
                interactionId: interaction.id,
                guildId: interaction.guildId,
                acknowledged: Boolean(interaction.deferred || interaction.replied),
                error: error instanceof Error ? error.message : String(error),
                details: error?.rawError?.errors ?? error?.errors ?? null
            });
            if (!expiredInteraction)
                await this.privateReply(interaction, `Não consegui concluir essa alteração. Código: ${(0, ids_1.randomId)(4)}`);
        }
        return true;
    }
    payload(session, user, guild, cfg) {
        let container;
        switch (session.page) {
            case 'community':
                container = (0, communityPage_1.communityPage)(session, this.ids, cfg, user, guild);
                break;
            case 'configbot':
                container = (0, botConfigPage_1.botConfigPage)(session, this.ids, cfg, this.client);
                break;
            case 'tutorial':
                container = (0, tutorialPage_1.tutorialPage)(session, this.ids, cfg);
                break;
            case 'personalization':
                container = (0, personalizationPage_1.personalizationPage)(session, this.ids, cfg, this.client, guild, this.app);
                break;
            case 'protections':
                container = (0, protectionPage_1.protectionPage)(session, this.ids, cfg);
                break;
            case 'logs':
                container = (0, logsPage_1.logsPage)(session, this.ids, cfg);
                break;
            case 'bypass':
                container = (0, bypassPage_1.bypassPage)(session, this.ids, cfg);
                break;
            case 'backups':
                container = (0, backupsPage_1.backupsPage)(session, this.ids, cfg);
                break;
            case 'diagnostics':
                container = (0, diagnosticsPage_1.diagnosticsPage)(session, this.ids, cfg);
                break;
            case 'settings':
                container = (0, generalSettingsPage_1.generalSettingsPage)(session, this.ids, cfg);
                break;
            default: container = (0, homePage_1.homePage)(session, this.ids, user, guild, this.app, cfg);
        }
        return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
    }
    async rerender(interaction, session, cfg) {
        const current = cfg ?? await guildConfigStore_1.guildConfigStore.get(session.guildId);
        await this.editPanelMessage(interaction, this.payload(session, interaction.user, interaction.guild, current));
    }
    async handleStringSelect(i, s, action, cfg) {
        const value = i.values[0];
        if (action === 'nav') {
            s.page = value;
            s.state = {};
            if (value === 'backups')
                s.state.backupList = await (0, backupStore_1.listBackups)(s.guildId, 10);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'tutorialsection') {
            s.page = 'tutorial';
            s.state.tutorialSection = value;
            delete s.state.tutorialEntry;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'tutorialentry') {
            s.page = 'tutorial';
            s.state.tutorialEntry = value;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'communitysection') {
            s.state.communitySection = value;
            if (value !== 'tickets')
                delete s.state.ticketTab;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'communityfunction') {
            s.page = 'community';
            s.state.communitySection = value;
            if (value === 'tickets')
                s.state.ticketView = 'list';
            if (value === 'rolepanels')
                s.state.rolePanelView = 'list';
            if (value === 'forms')
                s.state.formView = 'list';
            if (value === 'telloyn')
                s.state.telloynView = 'home';
            if (value === 'instagram')
                s.state.instagramView = 'home';
            if (value === 'autoclean')
                s.state.autoCleanView = 'list';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'autocleanrule') {
            s.state.autoCleanRuleId = value;
            s.state.autoCleanView = 'rule';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'autocleanmode') {
            const rule = this.selectedAutoCleanRule(s, cfg);
            if (!['all', 'images', 'text', 'links'].includes(value))
                throw new Error('Modo de limpeza inválido');
            rule.mode = value;
            rule.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'protectionsection') {
            s.page = 'protections';
            s.state.protectionSection = value;
            if (value === 'backups')
                s.state.backupList = await (0, backupStore_1.listBackups)(s.guildId, 10);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'botconfigsection') {
            if (value === 'profile') {
                s.page = 'personalization';
                s.state = {};
            }
            else if (value === 'access' || value === 'settings') {
                s.page = 'settings';
                s.state = {};
            }
            else {
                s.page = 'configbot';
                s.state.botConfigSection = value;
            }
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'ticketpanel') {
            if (value === 'none') {
                await this.rerender(i, s, cfg);
                return;
            }
            s.state.ticketPanelId = value;
            s.state.ticketView = 'panel';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'logcategory') {
            s.state.logCategory = value;
            s.state.logsPage = 0;
            s.state.selectedLog = '';
            s.state.logsAdvanced = false;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'pmod') {
            s.state.selectedModule = value;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'pun') {
            const [module, protection] = this.selectedProtection(s, cfg);
            protection.punishment.type = value;
            this.record(cfg, i.user.id, 'punishment_update', `${module}:${value}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'logevent') {
            s.state.selectedLog = value;
            s.state.logsAdvanced = false;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'logseverity') {
            const [, item] = this.selectedLog(s, cfg);
            if (!severityValues.includes(value))
                throw new Error('Gravidade inválida');
            item.minimumSeverity = value;
            this.record(cfg, i.user.id, 'log_severity', value);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'presence') {
            const clientUser = this.client.user;
            if (!clientUser)
                throw new Error('Usuário do bot indisponível');
            this.app.defaultPresence.status = value;
            clientUser.setPresence({
                status: value,
                activities: clientUser.presence.activities.map((activity) => ({ name: activity.name, type: activity.type, url: activity.url ?? undefined }))
            });
            await (0, configLoader_1.saveConfig)(this.app);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'bypassselect') {
            s.state.selectedBypass = value;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'bypassmodule') {
            const entry = this.selectedBypass(s, cfg);
            if (entry.modules.includes('*'))
                entry.modules = [];
            this.toggleArray(entry.modules, value);
            if (!entry.modules.length)
                entry.modules = ['*'];
            this.record(cfg, i.user.id, 'bypass_scope', `${entry.id}:${value}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'bypassduration') {
            const entry = this.selectedBypass(s, cfg);
            entry.expiresAt = value === 'permanent' ? null : new Date(Date.now() + Number(value) * 1000).toISOString();
            this.record(cfg, i.user.id, 'bypass_duration', `${entry.id}:${value}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'raidstate') {
            if (!['disabled', 'automatic', 'manual', 'emergency'].includes(value))
                throw new Error('Estado de raid inválido');
            cfg.raid.state = value;
            cfg.raid.activeUntil = value === 'disabled' ? null : cfg.raid.activeUntil;
            this.record(cfg, i.user.id, 'raid_state', value);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        throw new Error(`Ação de seleção desconhecida: ${action}`);
    }
    async handleChannelSelect(i, s, action, arg, cfg) {
        const id = i.values[0] ?? null;
        if (!id)
            throw new Error('Nenhum canal selecionado');
        if (action === 'logdefault') {
            cfg.logs.defaultChannelId = id;
            this.record(cfg, i.user.id, 'log_default_channel', id);
        }
        else if (action === 'logspecific') {
            const [event, item] = this.selectedLog(s, cfg);
            item.channelId = id;
            item.mode = 'specific';
            this.record(cfg, i.user.id, 'log_specific_channel', `${event}:${id}`);
        }
        else if (action === 'logsecondary') {
            const [event, item] = this.selectedLog(s, cfg);
            item.secondaryChannelId = item.secondaryChannelId === id ? null : id;
            this.record(cfg, i.user.id, 'log_secondary_channel', `${event}:${item.secondaryChannelId ?? 'none'}`);
        }
        else if (action === 'pignoredchannel' || action === 'pignoredcategory') {
            const [module, protection] = this.selectedProtection(s, cfg);
            const list = action === 'pignoredchannel' ? protection.ignoredChannels : protection.ignoredCategories;
            this.toggleArray(list, id);
            this.record(cfg, i.user.id, action, `${module}:${id}`);
        }
        else if (action === 'bypasschannel' || action === 'bypasscategory') {
            const kind = action === 'bypasschannel' ? 'channel' : 'category';
            const existing = cfg.bypasses.find(entry => entry.kind === kind && entry.targetId === id);
            const entry = existing ?? this.defaultBypass(kind, id, i.user.id);
            if (!existing)
                cfg.bypasses.push(entry);
            s.state.selectedBypass = entry.id;
            this.record(cfg, i.user.id, 'bypass_add', `${kind}:${id}`);
        }
        else if (action === 'allowchannel' || action === 'blockchannel') {
            const list = action === 'allowchannel' ? cfg.access.allowedChannels : cfg.access.blockedChannels;
            this.toggleArray(list, id);
            this.recordAccess(cfg, i.user.id, action, id);
        }
        else if (action === 'telloynchannel') {
            cfg.community.telloyn.channelId = id;
            this.record(cfg, i.user.id, 'telloyn_channel', id);
        }
        else if (action === 'telloynlogchannel') {
            cfg.community.telloyn.logChannelId = id;
            for (const event of ['telloyn_sent', 'telloyn_anonymous_sent', 'telloyn_failed']) {
                const log = cfg.logs.events[event];
                if (log) {
                    log.mode = 'specific';
                    log.channelId = id;
                }
            }
            this.record(cfg, i.user.id, 'telloyn_log_channel', id);
        }
        else if (action === 'instagramchannel') {
            cfg.community.instagram.channelId = id;
            this.record(cfg, i.user.id, 'instagram_channel', id);
        }
        else if (action === 'instagramlogchannel') {
            cfg.community.instagram.logChannelId = id;
            for (const event of ['instagram_post_created', 'instagram_post_liked', 'instagram_post_commented', 'instagram_post_deleted', 'instagram_post_rejected']) {
                const log = cfg.logs.events[event];
                if (log) {
                    log.mode = 'specific';
                    log.channelId = id;
                }
            }
            this.record(cfg, i.user.id, 'instagram_log_channel', id);
        }
        else if (action === 'twitterchannel') {
            cfg.community.twitter.channelId = id;
            this.record(cfg, i.user.id, 'twitter_channel', id);
        }
        else if (action === 'twitterlogchannel') {
            cfg.community.twitter.logChannelId = id;
            for (const event of ['twitter_post_created', 'twitter_post_rejected']) {
                const log = cfg.logs.events[event];
                if (log) {
                    log.mode = 'specific';
                    log.channelId = id;
                }
            }
            this.record(cfg, i.user.id, 'twitter_log_channel', id);
        }
        else if (action === 'autocleanchannel') {
            const rule = this.selectedAutoCleanRule(s, cfg);
            rule.channelId = id;
            rule.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, 'auto_clean_channel', `${rule.id}:${id}`);
        }
        else if (['ticketpublishchannel', 'ticketcategory', 'ticketthreadparent', 'ticketlogchannel', 'tickettranscriptchannel'].includes(action)) {
            const panel = this.selectedTicketPanel(s, cfg);
            if (action === 'ticketpublishchannel')
                panel.publishChannelId = panel.publishChannelId === id ? null : id;
            else if (action === 'ticketcategory')
                panel.categoryId = panel.categoryId === id ? null : id;
            else if (action === 'ticketthreadparent')
                panel.threadParentChannelId = panel.threadParentChannelId === id ? null : id;
            else if (action === 'ticketlogchannel')
                panel.logChannelId = panel.logChannelId === id ? null : id;
            else
                panel.transcriptChannelId = panel.transcriptChannelId === id ? null : id;
            panel.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, action, `${panel.id}:${id}`);
        }
        else if (action === 'welcomechannel' || action === 'goodbyechannel') {
            cfg.community[action === 'welcomechannel' ? 'welcome' : 'goodbye'].channelId = id;
            this.record(cfg, i.user.id, action, id);
        }
        else if (action === 'suggestionchannel' || action === 'suggestionreview') {
            if (action === 'suggestionchannel')
                cfg.community.suggestions.channelId = id;
            else
                cfg.community.suggestions.reviewChannelId = id;
            this.record(cfg, i.user.id, action, id);
        }
        else if (action === 'voiceactivitychannel') {
            cfg.community.voiceActivity.channelId = id;
            cfg.community.voiceActivity.messageId = null;
            this.record(cfg, i.user.id, 'voice_activity_channel', id);
        }
        else if (action === 'voicecreator' || action === 'voicecategory') {
            if (action === 'voicecreator')
                cfg.community.temporaryVoice.creatorChannelId = id;
            else
                cfg.community.temporaryVoice.categoryId = id;
            this.record(cfg, i.user.id, action, id);
        }
        else if (action === 'rolepanelchannel') {
            const panel = this.selectedRolePanel(s, cfg);
            panel.publishChannelId = panel.publishChannelId === id ? null : id;
            panel.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, action, `${panel.id}:${id}`);
        }
        else if (action === 'formpublishchannel' || action === 'formreviewchannel') {
            const form = this.selectedApplicationForm(s, cfg);
            if (action === 'formpublishchannel')
                form.publishChannelId = form.publishChannelId === id ? null : id;
            else
                form.reviewChannelId = form.reviewChannelId === id ? null : id;
            form.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, action, `${form.id}:${id}`);
        }
        else if (action === 'commandchannel') {
            const command = arg || String(s.state.selectedCommand ?? 'help');
            const permission = cfg.commands.permissions[command] ?? (cfg.commands.permissions[command] = (0, defaults_1.defaultCommandPermission)());
            this.toggleArray(permission.allowedChannelIds, id);
            s.state.selectedCommand = command;
            this.record(cfg, i.user.id, 'command_channel', `${command}:${id}`);
        }
        else
            throw new Error('Seletor de canal desconhecido');
        await this.saveAndRender(i, s, cfg);
    }
    async handleUserSelect(i, s, action, arg, cfg) {
        const id = i.values[0];
        if (action === 'bypassuser') {
            const existing = cfg.bypasses.find(entry => entry.kind === 'user' && entry.targetId === id);
            const entry = existing ?? this.defaultBypass('user', id, i.user.id);
            if (!existing)
                cfg.bypasses.push(entry);
            s.state.selectedBypass = entry.id;
            this.record(cfg, i.user.id, 'bypass_add', `user:${id}`);
        }
        else if (action === 'trustedbot') {
            const member = await i.guild?.members.fetch(id).catch(() => null);
            if (!member?.user.bot)
                throw new Error('O usuário selecionado não é um bot');
            this.toggleArray(cfg.trustedBots, id);
            this.record(cfg, i.user.id, 'trusted_bot_toggle', id);
        }
        else if (action === 'allowuser' || action === 'blockuser') {
            const list = action === 'allowuser' ? cfg.access.allowedUsers : cfg.access.blockedUsers;
            this.toggleArray(list, id);
            this.recordAccess(cfg, i.user.id, action, id);
        }
        else if (action === 'ticketblockeduser') {
            const panel = this.selectedTicketPanel(s, cfg);
            this.toggleArray(panel.blockedUserIds, id);
            panel.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, action, `${panel.id}:${id}`);
        }
        else if (action === 'commanduser') {
            const command = arg || String(s.state.selectedCommand ?? 'help');
            const permission = cfg.commands.permissions[command] ?? (cfg.commands.permissions[command] = (0, defaults_1.defaultCommandPermission)());
            this.toggleArray(permission.allowedUserIds, id);
            s.state.selectedCommand = command;
            this.record(cfg, i.user.id, 'command_user', `${command}:${id}`);
        }
        else
            throw new Error('Seletor de usuário desconhecido');
        await this.saveAndRender(i, s, cfg);
    }
    async handleRoleSelect(i, s, action, arg, cfg) {
        const id = i.values[0];
        if (action === 'bypassrole') {
            const existing = cfg.bypasses.find(entry => entry.kind === 'role' && entry.targetId === id);
            const entry = existing ?? this.defaultBypass('role', id, i.user.id);
            if (!existing)
                cfg.bypasses.push(entry);
            s.state.selectedBypass = entry.id;
            this.record(cfg, i.user.id, 'bypass_add', `role:${id}`);
        }
        else if (action === 'logmention') {
            const [event, item] = this.selectedLog(s, cfg);
            item.mentionRoleId = item.mentionRoleId === id ? null : id;
            this.record(cfg, i.user.id, 'log_mention_role', `${event}:${item.mentionRoleId ?? 'none'}`);
        }
        else if (action === 'pignoredrole') {
            const [module, protection] = this.selectedProtection(s, cfg);
            this.toggleArray(protection.ignoredRoles, id);
            this.record(cfg, i.user.id, 'protection_ignored_role', `${module}:${id}`);
        }
        else if (action === 'allowrole' || action === 'blockrole') {
            const list = action === 'allowrole' ? cfg.access.allowedRoles : cfg.access.blockedRoles;
            this.toggleArray(list, id);
            this.recordAccess(cfg, i.user.id, action, id);
        }
        else if (action === 'quarantinerole') {
            cfg.quarantine.roleId = cfg.quarantine.roleId === id ? null : id;
            this.record(cfg, i.user.id, 'quarantine_role', cfg.quarantine.roleId ?? 'none');
        }
        else if (action === 'clrole') {
            this.toggleArray(cfg.community.cl.allowedRoleIds, id);
            this.record(cfg, i.user.id, 'community_cl_role', id);
        }
        else if (action === 'instagramrole') {
            cfg.community.instagram.allowedRoleId = cfg.community.instagram.allowedRoleId === id ? null : id;
            this.record(cfg, i.user.id, 'instagram_role', cfg.community.instagram.allowedRoleId ?? 'none');
        }
        else if (action === 'autorolemember' || action === 'autorolebot' || action === 'autoroleeveryone') {
            const list = action === 'autorolemember' ? cfg.community.autorole.memberRoleIds : action === 'autorolebot' ? cfg.community.autorole.botRoleIds : cfg.community.autorole.everyoneRoleIds;
            this.toggleArray(list, id);
            this.record(cfg, i.user.id, action, id);
        }
        else if (action === 'massrole') {
            s.state.massRoleId = id;
            await this.rerender(i, s, cfg);
            return;
        }
        else if (action === 'massaccessrole') {
            this.toggleArray(cfg.community.massRoles.allowedRoleIds, id);
            this.record(cfg, i.user.id, 'mass_role_access', id);
        }
        else if (action === 'ticketsupportrole' || action === 'ticketallowedrole' || action === 'ticketblockedrole') {
            const panel = this.selectedTicketPanel(s, cfg);
            const list = action === 'ticketsupportrole' ? panel.supportRoleIds : action === 'ticketallowedrole' ? panel.allowedRoleIds : panel.blockedRoleIds;
            this.toggleArray(list, id);
            panel.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, action, `${panel.id}:${id}`);
        }
        else if (action === 'rolepaneladdrole') {
            const panel = this.selectedRolePanel(s, cfg);
            if (panel.options.some(option => option.roleId === id))
                throw new Error('Este cargo já está no painel');
            if (panel.options.length >= 24)
                throw new Error('O limite é de 24 cargos por painel');
            const role = i.guild?.roles.cache.get(id);
            if (!role || role.managed || role.id === i.guildId)
                throw new Error('O cargo selecionado não pode ser usado');
            panel.options.push({ roleId: id, label: role.name.slice(0, 100), description: '', emoji: null });
            panel.maximumSelections = Math.max(1, Math.min(panel.maximumSelections, panel.options.length));
            panel.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, 'role_panel_option_add', `${panel.id}:${id}`);
        }
        else if (action === 'rolepanelrequired' || action === 'rolepanelblocked') {
            const panel = this.selectedRolePanel(s, cfg);
            this.toggleArray(action === 'rolepanelrequired' ? panel.requiredRoleIds : panel.blockedRoleIds, id);
            panel.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, action, `${panel.id}:${id}`);
        }
        else if (action === 'formallowedrole' || action === 'formblockedrole' || action === 'formapprovedrole') {
            const form = this.selectedApplicationForm(s, cfg);
            const list = action === 'formallowedrole' ? form.allowedRoleIds : action === 'formblockedrole' ? form.blockedRoleIds : form.approvedRoleIds;
            this.toggleArray(list, id);
            form.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, action, `${form.id}:${id}`);
        }
        else if (action === 'commandrole') {
            const command = arg || String(s.state.selectedCommand ?? 'help');
            const permission = cfg.commands.permissions[command] ?? (cfg.commands.permissions[command] = (0, defaults_1.defaultCommandPermission)());
            this.toggleArray(permission.allowedRoleIds, id);
            s.state.selectedCommand = command;
            this.record(cfg, i.user.id, 'command_role', `${command}:${id}`);
        }
        else
            throw new Error('Seletor de cargo desconhecido');
        await this.saveAndRender(i, s, cfg);
    }
    async handleButton(i, s, action, arg, cfg) {
        const guild = i.guild;
        if (!guild) {
            await this.privateReply(i, 'Este painel só pode ser usado dentro de um servidor.');
            return;
        }
        if (action === 'home') {
            s.page = 'home';
            s.state = {};
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'refresh') {
            if (s.page === 'backups')
                s.state.backupList = await (0, backupStore_1.listBackups)(s.guildId, 10);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'close') {
            this.sessions.close(s.id);
            await this.editPanelMessage(i, (0, common_1.statusPayload)('Painel fechado', 'A sessão foi encerrada com segurança.', cfg.panel.color));
            return;
        }
        if (action === 'navbutton') {
            s.page = arg || 'home';
            s.state = {};
            if (s.page === 'protections')
                s.state.protectionSection = 'home';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'protectionopen') {
            s.page = 'protections';
            s.state.protectionSection = arg || 'home';
            if (arg === 'backups')
                s.state.backupList = await (0, backupStore_1.listBackups)(s.guildId, 10);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'communityopen') {
            s.page = 'community';
            s.state.communitySection = arg || 'overview';
            if (arg === 'tickets')
                s.state.ticketView = 'list';
            if (arg === 'rolepanels')
                s.state.rolePanelView = 'list';
            if (arg === 'forms')
                s.state.formView = 'list';
            if (arg === 'telloyn')
                s.state.telloynView = 'home';
            if (arg === 'instagram')
                s.state.instagramView = 'home';
            if (arg === 'autoclean')
                s.state.autoCleanView = 'list';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'telloynview') {
            s.state.telloynView = arg || 'home';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'instagramview') {
            s.state.instagramView = arg || 'home';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'telloynfield') {
            await i.showModal(this.telloynFieldModal(s, cfg, arg));
            return;
        }
        if (action === 'telloynupload') {
            if (!['imageUrl', 'thumbnailUrl'].includes(arg))
                throw new Error('Campo de imagem inválido');
            s.state.pendingTelloynUpload = arg;
            await i.showModal(this.fileUploadModal(s, 'telloynuploadsubmit', arg === 'thumbnailUrl' ? 'Enviar thumbnail do Telloyn' : 'Enviar imagem do Telloyn'));
            return;
        }
        if (action === 'telloynclearmedia') {
            if (!['imageUrl', 'thumbnailUrl'].includes(arg))
                throw new Error('Campo de imagem inválido');
            cfg.community.telloyn.appearance[arg] = null;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'telloynseparator') {
            cfg.community.telloyn.appearance.showSeparator = !cfg.community.telloyn.appearance.showSeparator;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'telloynbuttonstyle') {
            const styles = ['primary', 'secondary', 'success', 'danger'];
            const current = cfg.community.telloyn.appearance.buttonStyle;
            cfg.community.telloyn.appearance.buttonStyle = styles[(Math.max(0, styles.indexOf(current)) + 1) % styles.length];
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'telloyntoggle') {
            const item = cfg.community.telloyn;
            if (arg === 'enabled')
                item.enabled = !item.enabled;
            else if (arg === 'public') {
                if (item.allowPublic && !item.allowAnonymous)
                    throw new Error('Mantenha pelo menos um modo de envio ativo.');
                item.allowPublic = !item.allowPublic;
            }
            else if (arg === 'anonymous') {
                if (item.allowAnonymous && !item.allowPublic)
                    throw new Error('Mantenha pelo menos um modo de envio ativo.');
                item.allowAnonymous = !item.allowAnonymous;
            }
            else if (arg === 'mentions')
                item.allowMentions = !item.allowMentions;
            else
                throw new Error('Configuração do Telloyn inválida');
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'telloynpublish') {
            const item = cfg.community.telloyn;
            s.busy = true;
            try {
                const published = await this.community.publishTelloynPanel(guild, item);
                item.channelId = published.channelId;
                item.publishMessageId = published.messageId;
                await (0, communityLogger_1.logCommunityEvent)({ guild: guild, config: cfg, event: 'configuration_change', module: 'community_telloyn', executorId: i.user.id, channelId: published.channelId, details: { messageId: published.messageId } });
                await guildConfigStore_1.guildConfigStore.set(s.guildId, cfg);
                await this.editPanelMessage(i, this.payload(s, i.user, guild, cfg));
            }
            finally {
                s.busy = false;
            }
            return;
        }
        if (action === 'instagramfield') {
            await i.showModal(this.instagramFieldModal(s, cfg, arg));
            return;
        }
        if (action === 'instagramupload') {
            if (!['imageUrl', 'thumbnailUrl'].includes(arg))
                throw new Error('Campo de imagem inválido');
            s.state.pendingInstagramUpload = arg;
            await i.showModal(this.fileUploadModal(s, 'instagramuploadsubmit', arg === 'thumbnailUrl' ? 'Enviar thumbnail do Instagram' : 'Enviar imagem do Instagram'));
            return;
        }
        if (action === 'instagramclearmedia') {
            if (!['imageUrl', 'thumbnailUrl'].includes(arg))
                throw new Error('Campo de imagem inválido');
            cfg.community.instagram.appearance[arg] = null;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'instagramseparator') {
            cfg.community.instagram.appearance.showSeparator = !cfg.community.instagram.appearance.showSeparator;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'instagramtoggle') {
            const item = cfg.community.instagram;
            if (arg === 'enabled')
                item.enabled = !item.enabled;
            else if (arg === 'images') {
                if (item.allowImages && !item.allowVideos)
                    throw new Error('Mantenha imagens ou vídeos ativos.');
                item.allowImages = !item.allowImages;
            }
            else if (arg === 'videos') {
                if (item.allowVideos && !item.allowImages)
                    throw new Error('Mantenha imagens ou vídeos ativos.');
                item.allowVideos = !item.allowVideos;
            }
            else if (arg === 'require')
                item.requireAttachment = !item.requireAttachment;
            else
                throw new Error('Configuração do Instagram inválida');
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'twittertoggle') {
            const item = cfg.community.twitter;
            if (arg === 'enabled')
                item.enabled = !item.enabled;
            else if (arg === 'original')
                item.deleteOriginalMessage = !item.deleteOriginalMessage;
            else if (arg === 'attachments')
                item.allowAttachments = !item.allowAttachments;
            else
                throw new Error('Configuração do X inválida');
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'twitterfield') {
            await i.showModal(this.twitterFieldModal(s, cfg, arg));
            return;
        }
        if (action === 'autocleancreate') {
            if (cfg.community.autoClean.rules.length >= cfg.community.autoClean.maximumRules)
                throw new Error('O limite de regras foi atingido');
            const now = new Date().toISOString();
            const rule = {
                id: `AC-${(0, ids_1.randomId)(4)}`,
                name: `Limpeza ${cfg.community.autoClean.rules.length + 1}`,
                enabled: false,
                channelId: null,
                mode: 'all',
                delaySeconds: 60,
                includeBots: false,
                includeWebhooks: false,
                ignorePinned: true,
                logDeletions: false,
                createdBy: i.user.id,
                createdAt: now,
                updatedAt: now
            };
            cfg.community.autoClean.rules.push(rule);
            s.state.autoCleanRuleId = rule.id;
            s.state.autoCleanView = 'rule';
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'autocleanback') {
            s.state.autoCleanView = 'list';
            delete s.state.autoCleanRuleId;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'autocleantoggle') {
            const rule = this.selectedAutoCleanRule(s, cfg);
            if (arg === 'enabled')
                rule.enabled = !rule.enabled;
            else if (arg === 'bots')
                rule.includeBots = !rule.includeBots;
            else if (arg === 'webhooks')
                rule.includeWebhooks = !rule.includeWebhooks;
            else if (arg === 'pinned')
                rule.ignorePinned = !rule.ignorePinned;
            else if (arg === 'logs')
                rule.logDeletions = !rule.logDeletions;
            else
                throw new Error('Opção de limpeza inválida');
            rule.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'autocleanfield') {
            await i.showModal(this.autoCleanFieldModal(s, cfg, arg));
            return;
        }
        if (action === 'autocleandelete') {
            const rule = this.selectedAutoCleanRule(s, cfg);
            cfg.community.autoClean.rules = cfg.community.autoClean.rules.filter(item => item.id !== rule.id);
            s.state.autoCleanView = 'list';
            delete s.state.autoCleanRuleId;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketselect') {
            s.state.ticketPanelId = arg;
            s.state.ticketView = 'panel';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'ticketcreationmode') {
            const panel = this.selectedTicketPanel(s, cfg);
            panel.creationMode = panel.creationMode === 'thread' ? 'channel' : 'thread';
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketopencomponent') {
            const panel = this.selectedTicketPanel(s, cfg);
            panel.openComponent = panel.openComponent === 'select' ? 'button' : 'select';
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketview') {
            s.state.ticketView = arg || 'panel';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'ticketduplicate') {
            if (cfg.community.tickets.panels.length >= 10)
                throw new Error('O limite de dez painéis já foi atingido');
            const source = this.selectedTicketPanel(s, cfg);
            const clone = JSON.parse(JSON.stringify(source));
            clone.id = `TP-${(0, ids_1.randomId)(4)}`;
            clone.name = `${source.name} - cópia`.slice(0, 80);
            clone.publishMessageId = null;
            clone.createdBy = i.user.id;
            clone.createdAt = new Date().toISOString();
            clone.updatedAt = clone.createdAt;
            cfg.community.tickets.panels.push(clone);
            s.state.ticketPanelId = clone.id;
            s.state.ticketView = 'panel';
            this.record(cfg, i.user.id, 'ticket_panel_duplicate', `${source.id}:${clone.id}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketfield') {
            await i.showModal(this.ticketFieldModal(s, cfg, arg));
            return;
        }
        if (action === 'ticketupload') {
            s.state.pendingUpload = arg;
            await i.showModal(this.fileUploadModal(s, 'ticketuploadsubmit', arg.includes('thumbnail') ? 'Enviar thumbnail' : 'Enviar imagem'));
            return;
        }
        if (action === 'ticketclearmedia') {
            const panel = this.selectedTicketPanel(s, cfg);
            const [kind, field] = arg.split('.');
            if (!panel[kind] || !['imageUrl', 'thumbnailUrl'].includes(field))
                throw new Error('Campo de mídia inválido');
            panel[kind][field] = null;
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketseparator') {
            const panel = this.selectedTicketPanel(s, cfg);
            const kind = arg === 'internal' ? 'internal' : 'external';
            panel[kind].showSeparator = !panel[kind].showSeparator;
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketplaceholders') {
            await this.privateReply(i, `Placeholders disponíveis:\n${templateRenderer_2.TICKET_PLACEHOLDERS.map(value => `\`${value}\``).join(' ')}`);
            return;
        }
        if (action === 'ticketbuttonstyle') {
            const panel = this.selectedTicketPanel(s, cfg);
            const styles = ['primary', 'secondary', 'success', 'danger'];
            const index = styles.indexOf(panel.external.buttonStyle);
            panel.external.buttonStyle = styles[(index + 1) % styles.length];
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketsettingfield') {
            await i.showModal(this.ticketSettingFieldModal(s, cfg, arg));
            return;
        }
        if (action === 'tickettogglesetting') {
            const panel = this.selectedTicketPanel(s, cfg);
            if (!['allowReopen', 'ratingEnabled', 'businessHoursEnabled'].includes(arg))
                throw new Error('Configuração inválida');
            panel[arg] = !panel[arg];
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketquestionadd') {
            const panel = this.selectedTicketPanel(s, cfg);
            if (panel.questions.length >= 5)
                throw new Error('O limite de cinco perguntas foi atingido');
            s.state.editQuestionId = '';
            await i.showModal(this.ticketQuestionModal(s, null));
            return;
        }
        if (action === 'ticketquestionedit') {
            const panel = this.selectedTicketPanel(s, cfg);
            const question = panel.questions.find(item => item.id === arg);
            if (!question)
                throw new Error('Pergunta não encontrada');
            s.state.editQuestionId = question.id;
            await i.showModal(this.ticketQuestionModal(s, question));
            return;
        }
        if (action === 'ticketquestionremove') {
            const panel = this.selectedTicketPanel(s, cfg);
            panel.questions.pop();
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketinternalbutton') {
            const panel = this.selectedTicketPanel(s, cfg);
            if (!(arg in panel.internalButtons))
                throw new Error('Botão interno inválido');
            panel.internalButtons[arg] = !panel.internalButtons[arg];
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'communitymessagefield') {
            await i.showModal(this.communityMessageFieldModal(s, cfg, arg));
            return;
        }
        if (action === 'communityupload') {
            s.state.pendingUpload = arg;
            await i.showModal(this.fileUploadModal(s, 'communityuploadsubmit', arg.includes('thumbnail') ? 'Enviar thumbnail' : 'Enviar imagem'));
            return;
        }
        if (action === 'communityclearmedia') {
            const [kind, field] = arg.split('.');
            if (!cfg.community[kind] || !['imageUrl', 'thumbnailUrl'].includes(field))
                throw new Error('Campo de mídia inválido');
            cfg.community[kind].appearance[field] = null;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'communityseparator') {
            const kind = arg === 'goodbye' ? 'goodbye' : 'welcome';
            cfg.community[kind].appearance.showSeparator = !cfg.community[kind].appearance.showSeparator;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'communityplaceholders') {
            await this.privateReply(i, `Placeholders disponíveis:\n${templateRenderer_1.COMMUNITY_PLACEHOLDERS.map(value => `\`${value}\``).join(' ')}`);
            return;
        }
        if (action === 'communitymessagetoggle') {
            const kind = arg === 'goodbye' ? 'goodbye' : 'welcome';
            cfg.community[kind].enabled = !cfg.community[kind].enabled;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'communitymessagetest') {
            if (arg === 'goodbye')
                await (0, messageService_1.sendGoodbyePreview)(i, cfg.community.goodbye);
            else
                await (0, messageService_1.sendWelcomePreview)(i, cfg.community.welcome);
            return;
        }
        if (action === 'welcomedm') {
            cfg.community.welcome.sendDirectMessage = !cfg.community.welcome.sendDirectMessage;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'suggestiontoggle') {
            if (arg === 'enabled')
                cfg.community.suggestions.enabled = !cfg.community.suggestions.enabled;
            else if (arg === 'thread')
                cfg.community.suggestions.createThread = !cfg.community.suggestions.createThread;
            else if (arg === 'anonymous')
                cfg.community.suggestions.allowAnonymous = !cfg.community.suggestions.allowAnonymous;
            else
                throw new Error('Opção de sugestões inválida');
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'voicetoggle') {
            cfg.community.temporaryVoice.enabled = !cfg.community.temporaryVoice.enabled;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'voicefield') {
            await i.showModal(this.voiceFieldModal(s, cfg, arg));
            return;
        }
        if (action === 'rolepanelselect') {
            s.state.rolePanelId = arg;
            s.state.rolePanelView = 'panel';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'rolepanelview') {
            s.state.rolePanelView = arg || 'panel';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'rolepanelcreate') {
            if (cfg.community.rolePanels.panels.length >= 10)
                throw new Error('O limite de dez painéis de cargos foi atingido');
            const panel = (0, defaults_1.defaultRolePanel)(i.user.id, cfg.community.rolePanels.panels.length + 1);
            panel.id = `RP-${(0, ids_1.randomId)(4)}`;
            cfg.community.rolePanels.panels.push(panel);
            s.state.rolePanelId = panel.id;
            s.state.rolePanelView = 'panel';
            this.record(cfg, i.user.id, 'role_panel_create', panel.id);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'rolepaneltoggle') {
            const panel = this.selectedRolePanel(s, cfg);
            panel.enabled = !panel.enabled;
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'rolepanelpublish') {
            const panel = this.selectedRolePanel(s, cfg);
            s.busy = true;
            await this.ensureDeferredUpdate(i);
            try {
                const published = await this.community.publishRolePanel(guild, panel);
                panel.publishChannelId = published.channelId;
                panel.publishMessageId = published.messageId;
                panel.updatedAt = new Date().toISOString();
                await (0, communityLogger_1.logCommunityEvent)({ guild: guild, config: cfg, event: 'role_panel_published', module: 'community_role_panels', executorId: i.user.id, channelId: published.channelId, details: { panelId: panel.id, messageId: published.messageId } });
                await guildConfigStore_1.guildConfigStore.set(s.guildId, cfg);
                await this.editPanelMessage(i, this.payload(s, i.user, guild, cfg));
            }
            finally {
                s.busy = false;
            }
            return;
        }
        if (action === 'rolepaneldelete') {
            const panel = this.selectedRolePanel(s, cfg);
            const until = Number(s.state.rolePanelDeleteUntil ?? 0);
            if (Date.now() > until) {
                s.state.rolePanelDeleteUntil = Date.now() + 30_000;
                await this.privateReply(i, 'Clique novamente em “Excluir” em até 30 segundos para confirmar.');
                return;
            }
            if (panel.publishChannelId && panel.publishMessageId) {
                const channel = await guild?.channels.fetch(panel.publishChannelId).catch(() => null);
                const message = channel?.isTextBased?.() ? await channel.messages.fetch(panel.publishMessageId).catch(() => null) : null;
                await message?.delete().catch(() => undefined);
            }
            cfg.community.rolePanels.panels = cfg.community.rolePanels.panels.filter(item => item.id !== panel.id);
            s.state.rolePanelId = cfg.community.rolePanels.panels[0]?.id ?? '';
            s.state.rolePanelView = 'list';
            s.state.rolePanelDeleteUntil = 0;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'rolepanelfield') {
            await i.showModal(this.rolePanelFieldModal(s, cfg, arg));
            return;
        }
        if (action === 'rolepaneloptionedit') {
            await i.showModal(this.rolePanelOptionModal(s, cfg, arg));
            return;
        }
        if (action === 'rolepaneloptionremove') {
            const panel = this.selectedRolePanel(s, cfg);
            panel.options = panel.options.filter(option => option.roleId !== arg);
            panel.maximumSelections = Math.max(1, Math.min(panel.maximumSelections, Math.max(1, panel.options.length)));
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'rolepaneloptionspage') {
            s.state.roleOptionsPage = Math.max(0, Number(s.state.roleOptionsPage ?? 0) + (arg === 'prev' ? -1 : 1));
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'rolepanelexclusive') {
            const panel = this.selectedRolePanel(s, cfg);
            panel.exclusive = !panel.exclusive;
            if (panel.exclusive)
                panel.maximumSelections = 1;
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'rolepanelmax') {
            await i.showModal(this.rolePanelMaxModal(s, cfg));
            return;
        }
        if (action === 'formselect') {
            s.state.formId = arg;
            s.state.formView = 'panel';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'formview') {
            s.state.formView = arg || 'panel';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'formcreate') {
            if (cfg.community.forms.forms.length >= 10)
                throw new Error('O limite de dez formulários foi atingido');
            const form = (0, defaults_1.defaultApplicationForm)(i.user.id, cfg.community.forms.forms.length + 1);
            form.id = `FM-${(0, ids_1.randomId)(4)}`;
            cfg.community.forms.forms.push(form);
            s.state.formId = form.id;
            s.state.formView = 'panel';
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'formtoggle') {
            const form = this.selectedApplicationForm(s, cfg);
            form.enabled = !form.enabled;
            form.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'formpublish') {
            const form = this.selectedApplicationForm(s, cfg);
            s.busy = true;
            await this.ensureDeferredUpdate(i);
            try {
                const published = await this.community.publishApplicationForm(guild, form);
                form.publishChannelId = published.channelId;
                form.publishMessageId = published.messageId;
                form.updatedAt = new Date().toISOString();
                await (0, communityLogger_1.logCommunityEvent)({ guild: guild, config: cfg, event: 'form_published', module: 'community_forms', executorId: i.user.id, channelId: published.channelId, details: { formId: form.id, messageId: published.messageId } });
                await guildConfigStore_1.guildConfigStore.set(s.guildId, cfg);
                await this.editPanelMessage(i, this.payload(s, i.user, guild, cfg));
            }
            finally {
                s.busy = false;
            }
            return;
        }
        if (action === 'formdelete') {
            const form = this.selectedApplicationForm(s, cfg);
            const until = Number(s.state.formDeleteUntil ?? 0);
            if (Date.now() > until) {
                s.state.formDeleteUntil = Date.now() + 30_000;
                await this.privateReply(i, 'Clique novamente em “Excluir” em até 30 segundos para confirmar.');
                return;
            }
            if (form.publishChannelId && form.publishMessageId) {
                const channel = await guild?.channels.fetch(form.publishChannelId).catch(() => null);
                const message = channel?.isTextBased?.() ? await channel.messages.fetch(form.publishMessageId).catch(() => null) : null;
                await message?.delete().catch(() => undefined);
            }
            cfg.community.forms.forms = cfg.community.forms.forms.filter(item => item.id !== form.id);
            s.state.formId = cfg.community.forms.forms[0]?.id ?? '';
            s.state.formView = 'list';
            s.state.formDeleteUntil = 0;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'formfield') {
            await i.showModal(this.applicationFormFieldModal(s, cfg, arg));
            return;
        }
        if (action === 'formquestionadd') {
            const form = this.selectedApplicationForm(s, cfg);
            if (form.questions.length >= 5)
                throw new Error('O limite de cinco perguntas foi atingido');
            s.state.editFormQuestionId = '';
            await i.showModal(this.applicationQuestionModal(s, null));
            return;
        }
        if (action === 'formquestionedit') {
            const form = this.selectedApplicationForm(s, cfg);
            const question = form.questions.find(item => item.id === arg);
            if (!question)
                throw new Error('Pergunta não encontrada');
            s.state.editFormQuestionId = question.id;
            await i.showModal(this.applicationQuestionModal(s, question));
            return;
        }
        if (action === 'formquestionremove') {
            const form = this.selectedApplicationForm(s, cfg);
            form.questions = form.questions.filter(item => item.id !== arg);
            form.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'logcategorybutton') {
            s.state.logCategory = arg || 'home';
            s.state.logsPage = 0;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'logpage') {
            s.state.logsPage = Math.max(0, Number(s.state.logsPage ?? 0) + (arg === 'prev' ? -1 : 1));
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'logchoosechannel') {
            s.state.pendingLogEvent = arg;
            await i.showModal(this.logChannelModal(s, arg));
            return;
        }
        if (action === 'logeventmode') {
            const split = arg.lastIndexOf(':');
            const event = split >= 0 ? arg.slice(0, split) : arg;
            const mode = split >= 0 ? arg.slice(split + 1) : 'default';
            const item = cfg.logs.events[event];
            if (!item || !['default', 'disabled'].includes(mode))
                throw new Error('Evento de log inválido');
            item.mode = mode;
            if (mode === 'default')
                item.channelId = null;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'logtestevent') {
            const item = cfg.logs.events[arg];
            if (!item)
                throw new Error('Evento de log inválido');
            await (0, communityLogger_1.logCommunityEvent)({ guild: guild, config: cfg, event: arg, module: 'panel_log_test', executorId: i.user.id, channelId: i.channelId, details: { test: true } });
            await guildConfigStore_1.guildConfigStore.set(s.guildId, cfg);
            await this.privateReply(i, `Teste de **${arg}** processado.`);
            return;
        }
        if (action === 'botconfigopen') {
            if (arg === 'profile') {
                s.page = 'personalization';
                s.state = {};
            }
            else if (arg === 'access') {
                s.page = 'settings';
                s.state = {};
            }
            else if (arg === 'backups') {
                s.page = 'protections';
                s.state = { protectionSection: 'backups', backupList: await (0, backupStore_1.listBackups)(s.guildId, 10) };
            }
            else if (arg === 'diagnostics') {
                s.page = 'protections';
                s.state = { protectionSection: 'diagnostics' };
            }
            else if (arg === 'settings') {
                s.page = 'settings';
                s.state = {};
            }
            else {
                s.page = 'configbot';
                s.state.botConfigSection = arg || 'home';
            }
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'commandselect' || action === 'commandaccess') {
            s.state.selectedCommand = arg || 'help';
            if (action === 'commandaccess')
                s.state.botConfigSection = 'commandaccess';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'commandpage') {
            s.state.commandPage = Math.max(0, Number(s.state.commandPage ?? 0) + (arg === 'prev' ? -1 : 1));
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'aliasedit') {
            s.state.selectedCommand = arg || 'help';
            await i.showModal(this.aliasModal(s, cfg, arg || 'help'));
            return;
        }
        if (action === 'aliasreset') {
            cfg.commands.aliases[arg] = [...(defaults_1.DEFAULT_ALIASES[arg] ?? [])];
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'commandtoggle' || action === 'commanddelete' || action === 'commandclearaccess') {
            const command = arg || String(s.state.selectedCommand ?? 'help');
            const permission = cfg.commands.permissions[command] ?? (cfg.commands.permissions[command] = (0, defaults_1.defaultCommandPermission)());
            if (action === 'commandtoggle')
                permission.enabled = !permission.enabled;
            else if (action === 'commanddelete')
                permission.deleteCommandMessage = !permission.deleteCommandMessage;
            else {
                permission.allowedRoleIds = [];
                permission.allowedUserIds = [];
                permission.allowedChannelIds = [];
            }
            s.state.selectedCommand = command;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'commandcooldown') {
            s.state.selectedCommand = arg || 'help';
            await i.showModal(this.commandCooldownModal(s, cfg, arg || 'help'));
            return;
        }
        if (action === 'pprev' || action === 'pnext') {
            const delta = action === 'pprev' ? -1 : 1;
            s.state.protectionPage = Math.max(0, Number(s.state.protectionPage ?? 0) + delta);
            s.state.selectedModule = '';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'lprev' || action === 'lnext') {
            const delta = action === 'lprev' ? -1 : 1;
            s.state.logsPage = Math.max(0, Number(s.state.logsPage ?? 0) + delta);
            s.state.selectedLog = '';
            s.state.logsAdvanced = false;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'bprev' || action === 'bnext') {
            const delta = action === 'bprev' ? -1 : 1;
            s.state.bypassModulePage = Math.max(0, Number(s.state.bypassModulePage ?? 0) + delta);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'gotopersonalization') {
            s.page = 'personalization';
            s.state = {};
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'gotosettings') {
            s.page = 'settings';
            s.state = {};
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'cltoggle') {
            cfg.community.cl.enabled = !cfg.community.cl.enabled;
            this.record(cfg, i.user.id, 'community_cl_toggle', String(cfg.community.cl.enabled));
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'clmanage') {
            cfg.community.cl.allowManageMessages = !cfg.community.cl.allowManageMessages;
            this.record(cfg, i.user.id, 'community_cl_manage_messages', String(cfg.community.cl.allowManageMessages));
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'cllimitmodal') {
            await i.showModal(this.clLimitModal(s, cfg));
            return;
        }
        if (action === 'clclearroles') {
            cfg.community.cl.allowedRoleIds = [];
            this.record(cfg, i.user.id, 'community_cl_clear_roles');
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketcreate') {
            if (cfg.community.tickets.panels.length >= 10)
                throw new Error('O limite de dez painéis de ticket já foi atingido');
            const panel = this.createTicketPanel(i.user.id, cfg.community.tickets.panels.length + 1);
            cfg.community.tickets.panels.push(panel);
            s.state.ticketPanelId = panel.id;
            s.state.ticketView = 'panel';
            this.record(cfg, i.user.id, 'ticket_panel_create', panel.id);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'tickettab') {
            s.state.ticketTab = arg || 'overview';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'tickettoggle') {
            const panel = this.selectedTicketPanel(s, cfg);
            panel.enabled = !panel.enabled;
            panel.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, 'ticket_panel_toggle', `${panel.id}:${panel.enabled}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketpublish') {
            const panel = this.selectedTicketPanel(s, cfg);
            s.busy = true;
            await this.ensureDeferredUpdate(i);
            try {
                const published = await this.community.publishTicketPanel(guild, panel);
                panel.publishChannelId = published.channelId;
                panel.publishMessageId = published.messageId;
                panel.updatedAt = new Date().toISOString();
                this.record(cfg, i.user.id, 'ticket_panel_publish', panel.id);
                await (0, communityLogger_1.logCommunityEvent)({ guild: guild, config: cfg, event: 'ticket_panel_published', module: 'community_tickets', executorId: i.user.id, channelId: published.channelId, details: { panelId: panel.id, messageId: published.messageId } });
                await guildConfigStore_1.guildConfigStore.set(s.guildId, cfg);
                await this.editPanelMessage(i, this.payload(s, i.user, guild, cfg));
            }
            finally {
                s.busy = false;
            }
            return;
        }
        if (action === 'ticketdelete') {
            const panel = this.selectedTicketPanel(s, cfg);
            const until = Number(s.state.ticketDeleteUntil ?? 0);
            if (Date.now() > until) {
                s.state.ticketDeleteUntil = Date.now() + 30_000;
                await this.privateReply(i, 'Clique novamente em “Excluir painel” em até 30 segundos para confirmar. Tickets já abertos continuarão registrados.');
                return;
            }
            if (panel.publishChannelId && panel.publishMessageId) {
                const channel = await guild?.channels.fetch(panel.publishChannelId).catch(() => null);
                if (channel?.isTextBased?.()) {
                    const message = await channel.messages.fetch(panel.publishMessageId).catch(() => null);
                    if (message)
                        await message.delete().catch(() => undefined);
                }
            }
            cfg.community.tickets.panels = cfg.community.tickets.panels.filter(item => item.id !== panel.id);
            s.state.ticketPanelId = cfg.community.tickets.panels[0]?.id ?? '';
            s.state.ticketDeleteUntil = 0;
            this.record(cfg, i.user.id, 'ticket_panel_delete', panel.id);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketsettingsmodal') {
            await i.showModal(this.ticketSettingsModal(s, cfg));
            return;
        }
        if (action === 'ticketexternalmodal') {
            await i.showModal(this.ticketAppearanceModal(s, cfg, 'external'));
            return;
        }
        if (action === 'ticketinternalmodal') {
            await i.showModal(this.ticketAppearanceModal(s, cfg, 'internal'));
            return;
        }
        if (action === 'ticketexternalmedia') {
            await i.showModal(this.ticketMediaModal(s, cfg, 'external'));
            return;
        }
        if (action === 'ticketinternalmedia') {
            await i.showModal(this.ticketMediaModal(s, cfg, 'internal'));
            return;
        }
        if (action === 'ticketclearaccess') {
            const panel = this.selectedTicketPanel(s, cfg);
            panel.supportRoleIds = [];
            panel.allowedRoleIds = [];
            panel.blockedRoleIds = [];
            panel.blockedUserIds = [];
            panel.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, 'ticket_access_clear', panel.id);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'rolebackupcreate') {
            await this.community.createRoleBackup(guild, i.user.id, cfg);
            const refreshed = await guildConfigStore_1.guildConfigStore.get(s.guildId);
            await this.editPanelMessage(i, this.payload(s, i.user, guild, refreshed));
            await this.privateReply(i, 'Backup de cargos criado com sucesso.');
            return;
        }
        if (action === 'rolebackuprestore') {
            const until = Number(s.state.roleRestoreUntil ?? 0);
            if (Date.now() > until) {
                s.state.roleRestoreUntil = Date.now() + 30_000;
                await this.privateReply(i, 'Clique novamente em “Restaurar último” em até 30 segundos para confirmar.');
                return;
            }
            s.state.roleRestoreUntil = 0;
            const result = await this.community.restoreLatestRoleBackup(guild, i.user.id, cfg);
            const refreshed = await guildConfigStore_1.guildConfigStore.get(s.guildId);
            await this.editPanelMessage(i, this.payload(s, i.user, guild, refreshed));
            await this.privateReply(i, `Restauração concluída. Criados: ${result.created}. Atualizados: ${result.updated}. Falhas: ${result.failed}.`);
            return;
        }
        if (action === 'voiceactivitytoggle') {
            cfg.community.voiceActivity.enabled = !cfg.community.voiceActivity.enabled;
            this.record(cfg, i.user.id, 'voice_activity_toggle', String(cfg.community.voiceActivity.enabled));
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'voiceactivityrefresh') {
            await guildConfigStore_1.guildConfigStore.set(s.guildId, cfg);
            await this.community.refreshFastGuild(guild);
            await this.privateReply(i, 'Ranking de voz atualizado.');
            await this.rerender(i, s, await guildConfigStore_1.guildConfigStore.get(s.guildId));
            return;
        }
        if (action === 'voiceactivityreset') {
            const until = Number(s.state.voiceActivityResetUntil ?? 0);
            if (Date.now() > until) {
                s.state.voiceActivityResetUntil = Date.now() + 30_000;
                await this.privateReply(i, 'Clique novamente em “Zerar ranking” em até 30 segundos para confirmar.');
                return;
            }
            cfg.community.voiceActivity.totalsSeconds = {};
            cfg.community.voiceActivity.activeSince = {};
            const activeSince = new Date().toISOString();
            for (const state of guild.voiceStates.cache.values()) {
                if (!state.channelId || state.member?.user?.bot)
                    continue;
                cfg.community.voiceActivity.activeSince[state.id] = activeSince;
            }
            cfg.community.voiceActivity.messageId = null;
            s.state.voiceActivityResetUntil = 0;
            this.record(cfg, i.user.id, 'voice_activity_reset');
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'autoroleclear') {
            const until = Number(s.state.autoroleClearUntil ?? 0);
            if (Date.now() > until) {
                s.state.autoroleClearUntil = Date.now() + 30_000;
                await this.privateReply(i, 'Clique novamente em “Limpar todos os autoroles” em até 30 segundos para confirmar.');
                return;
            }
            cfg.community.autorole.memberRoleIds = [];
            cfg.community.autorole.botRoleIds = [];
            cfg.community.autorole.everyoneRoleIds = [];
            s.state.autoroleClearUntil = 0;
            this.record(cfg, i.user.id, 'autorole_clear');
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'masstoggleadmin') {
            cfg.community.massRoles.allowAdministrators = !cfg.community.massRoles.allowAdministrators;
            this.record(cfg, i.user.id, 'mass_roles_admin', String(cfg.community.massRoles.allowAdministrators));
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'massrequest') {
            if (!['add', 'remove', 'clear'].includes(arg))
                throw new Error('Operação em massa inválida');
            if (arg !== 'clear' && !s.state.massRoleId)
                throw new Error('Selecione um cargo antes da operação');
            s.state.massPending = arg;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'masscancel') {
            delete s.state.massPending;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'massconfirm') {
            const operation = String(s.state.massPending ?? '');
            if (!['add', 'remove', 'clear'].includes(operation))
                throw new Error('Nenhuma operação em massa aguardando confirmação');
            const roleId = typeof s.state.massRoleId === 'string' ? s.state.massRoleId : undefined;
            const operationLabel = operation === 'add' ? 'Adicionar cargo' : operation === 'remove' ? 'Remover cargo' : 'Limpar cargos';
            s.busy = true;
            await this.ensureDeferredReply(i);
            try {
                await i.editReply({ embeds: [new discord_js_1.EmbedBuilder()
                            .setColor((0, common_1.hexToInt)(cfg.panel.color))
                            .setTitle('Cargos em massa')
                            .setDescription(`${emojis_1.UI_LOADING_MENTION} **${operationLabel} em andamento**\nPreparando a lista de membros...`)] });
                const result = await this.community.runMassRoleOperation({
                    guild: guild,
                    actor: i.member,
                    config: cfg,
                    operation: operation,
                    roleId,
                    onProgress: async (processed, total, changed, failed) => {
                        const percent = total > 0 ? Math.floor((processed / total) * 100) : 100;
                        await i.editReply({ embeds: [new discord_js_1.EmbedBuilder()
                                    .setColor((0, common_1.hexToInt)(cfg.panel.color))
                                    .setTitle('Cargos em massa')
                                    .setDescription(`${emojis_1.UI_LOADING_MENTION} **${operationLabel} em andamento**`)
                                    .addFields({ name: 'Progresso', value: `${processed}/${total} (${percent}%)`, inline: true }, { name: 'Alterações', value: String(changed), inline: true }, { name: 'Erros', value: String(failed), inline: true })] });
                    }
                });
                delete s.state.massPending;
                const failureText = result.failures.length
                    ? result.failures.map(item => `• <@${item.memberId}> — ${item.reason}`).join('\n').slice(0, 1000)
                    : 'Nenhum erro registrado.';
                const finalColor = result.failed ? 0xFEE75C : 0x57F287;
                await i.editReply({ embeds: [new discord_js_1.EmbedBuilder()
                            .setColor(finalColor)
                            .setTitle(result.failed ? 'Cargos em massa concluído com avisos' : 'Cargos em massa concluído')
                            .setDescription(`Operação: **${operationLabel}**`)
                            .addFields({ name: 'Processados', value: `${result.processed}/${result.total}`, inline: true }, { name: 'Membros alterados', value: String(result.affectedMembers), inline: true }, { name: 'Sem alteração', value: String(result.unchangedMembers), inline: true }, { name: 'Alterações realizadas', value: String(result.changed), inline: true }, { name: 'Erros', value: String(result.failed), inline: true }, { name: 'Detalhes dos erros', value: failureText, inline: false })] });
            }
            catch (error) {
                await i.editReply({ embeds: [new discord_js_1.EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle('Cargos em massa não concluído')
                            .setDescription(error instanceof Error ? error.message : String(error))] }).catch(() => undefined);
            }
            finally {
                s.busy = false;
            }
            return;
        }
        if (action === 'mode') {
            const [module, protection] = this.selectedProtection(s, cfg);
            protection.mode = arg;
            this.record(cfg, i.user.id, 'protection_mode', `${module}:${arg}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'restore') {
            const [module, protection] = this.selectedProtection(s, cfg);
            protection.restore = !protection.restore;
            this.record(cfg, i.user.id, 'protection_restore', `${module}:${protection.restore}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'limitmodal') {
            await i.showModal(this.limitModal(s, cfg));
            return;
        }
        if (action === 'pfiltersmodal') {
            await i.showModal(this.protectionFiltersModal(s, cfg));
            return;
        }
        if (action === 'ppunishmodal') {
            await i.showModal(this.punishmentModal(s, cfg));
            return;
        }
        if (action === 'preset') {
            const [module] = this.selectedProtection(s, cfg);
            cfg.protections[module] = (0, defaults_1.defaultProtection)(module);
            this.record(cfg, i.user.id, 'protection_reset', module);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ptoggle') {
            const [module, protection] = this.selectedProtection(s, cfg);
            if (arg === 'users')
                protection.detectUsers = !protection.detectUsers;
            else if (arg === 'bots')
                protection.detectBots = !protection.detectBots;
            else if (arg === 'owner')
                protection.ignoreOwner = !protection.ignoreOwner;
            else
                throw new Error('Alternância de proteção inválida');
            this.record(cfg, i.user.id, 'protection_detection', `${module}:${arg}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'psensitivity') {
            const [module, protection] = this.selectedProtection(s, cfg);
            protection.sensitivity = protection.sensitivity === 'low' ? 'medium' : protection.sensitivity === 'medium' ? 'high' : 'low';
            this.record(cfg, i.user.id, 'protection_sensitivity', `${module}:${protection.sensitivity}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'logadvanced') {
            this.selectedLog(s, cfg);
            s.state.logsAdvanced = !Boolean(s.state.logsAdvanced);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'logmode') {
            const [event, item] = this.selectedLog(s, cfg);
            if (!['default', 'specific', 'disabled'].includes(arg))
                throw new Error('Modo de log inválido');
            item.mode = arg;
            this.record(cfg, i.user.id, 'log_mode', `${event}:${arg}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'logall') {
            for (const item of Object.values(cfg.logs.events)) {
                item.mode = arg === 'off' ? 'disabled' : 'default';
                if (arg === 'default')
                    item.channelId = null;
            }
            this.record(cfg, i.user.id, 'logs_bulk', arg);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'logtest') {
            const event = String(s.state.selectedLog ?? 'bot_start');
            const incident = await (0, incidentManager_1.createIncident)({ guildId: s.guildId, module: 'panel_test', event, severity: 'info', executorId: i.user.id, confidence: 'confirmed', configuredAction: 'log', details: { test: true } });
            incident.actionResult = 'test';
            await (0, logManager_1.sendIncidentLog)(guild, cfg, incident);
            await (0, incidentManager_1.updateIncident)(incident);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'logtoggle') {
            const [event, item] = this.selectedLog(s, cfg);
            if (arg === 'bypass')
                item.includeBypass = !item.includeBypass;
            else if (arg === 'failures')
                item.includeFailures = !item.includeFailures;
            else if (arg === 'restorations')
                item.includeRestorations = !item.includeRestorations;
            else if (arg === 'content')
                item.showContent = !item.showContent;
            else if (arg === 'ids')
                item.showIds = !item.showIds;
            else if (arg === 'audit')
                item.showAudit = !item.showAudit;
            else if (arg === 'group')
                item.groupRepeated = !item.groupRepeated;
            else if (arg === 'criticalmention')
                item.criticalOnlyMention = !item.criticalOnlyMention;
            else
                throw new Error('Alternância de log inválida');
            this.record(cfg, i.user.id, 'log_option', `${event}:${arg}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'loggroupmodal') {
            await i.showModal(this.logGroupModal(s, cfg));
            return;
        }
        if (action === 'logvalidate') {
            const ids = new Set();
            if (cfg.logs.defaultChannelId)
                ids.add(cfg.logs.defaultChannelId);
            for (const item of Object.values(cfg.logs.events)) {
                if (item.channelId)
                    ids.add(item.channelId);
                if (item.secondaryChannelId)
                    ids.add(item.secondaryChannelId);
            }
            let invalid = 0;
            for (const id of ids) {
                const channel = await guild?.channels.fetch(id).catch(() => null);
                if (!channel?.isTextBased?.())
                    invalid++;
            }
            s.state.invalidLogChannels = invalid;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'bypassprune') {
            const expired = (0, bypassEngine_1.pruneExpiredBypasses)(cfg);
            if (expired.some(entry => entry.id === s.state.selectedBypass))
                s.state.selectedBypass = '';
            this.record(cfg, i.user.id, 'bypass_prune', String(expired.length));
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'bypassremove') {
            const entry = this.selectedBypass(s, cfg);
            cfg.bypasses = cfg.bypasses.filter(item => item.id !== entry.id);
            s.state.selectedBypass = '';
            this.record(cfg, i.user.id, 'bypass_remove', entry.id);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'bypassall') {
            const entry = this.selectedBypass(s, cfg);
            entry.modules = entry.modules.includes('*') ? [] : ['*'];
            this.record(cfg, i.user.id, 'bypass_scope_all', entry.id);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'bypasstoggle') {
            const entry = this.selectedBypass(s, cfg);
            if (arg === 'detection')
                entry.behavior.ignoreDetection = !entry.behavior.ignoreDetection;
            else if (arg === 'punishment')
                entry.behavior.ignorePunishment = !entry.behavior.ignorePunishment;
            else if (arg === 'restoration')
                entry.behavior.ignoreRestoration = !entry.behavior.ignoreRestoration;
            else if (arg === 'limit')
                entry.behavior.ignoreLimit = !entry.behavior.ignoreLimit;
            else if (arg === 'logging')
                entry.behavior.continueLogging = !entry.behavior.continueLogging;
            else
                throw new Error('Alternância de bypass inválida');
            this.record(cfg, i.user.id, 'bypass_behavior', `${entry.id}:${arg}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'backupcreate') {
            s.busy = true;
            await this.ensureDeferredUpdate(i);
            try {
                const snapshot = await (0, snapshotManager_1.captureGuildSnapshot)(guild);
                await (0, backupStore_1.createBackup)(s.guildId, cfg, i.user.id, 'Backup manual pelo painel', cfg.backups.retention, snapshot);
                cfg.backups.lastBackupAt = new Date().toISOString();
                s.state.backupList = await (0, backupStore_1.listBackups)(s.guildId, 10);
                this.record(cfg, i.user.id, 'backup_create');
                await guildConfigStore_1.guildConfigStore.set(s.guildId, cfg);
                await this.editPanelMessage(i, this.payload(s, i.user, guild, cfg));
            }
            finally {
                s.busy = false;
            }
            return;
        }
        if (action === 'backuplist') {
            s.state.backupList = await (0, backupStore_1.listBackups)(s.guildId, 10);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'backupexport') {
            const backup = await (0, backupStore_1.latestBackup)(s.guildId);
            if (!backup)
                throw new Error('Nenhum backup disponível');
            await i.editReply({
                content: `Backup ${backup.id} exportado. Não compartilhe arquivos que contenham informações internas do servidor.`,
                files: [new discord_js_1.AttachmentBuilder((0, backupStore_1.backupPath)(s.guildId, backup.id), { name: `${backup.id}.json` })],
                allowedMentions: { parse: [] }
            });
            return;
        }
        if (action === 'backuprestore') {
            const backup = await (0, backupStore_1.latestBackup)(s.guildId);
            if (!backup)
                throw new Error('Nenhum backup disponível');
            s.state.pendingBackupRestore = backup.id;
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'backuprestorecancel') {
            s.state.pendingBackupRestore = '';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'backuprestoreconfirm') {
            const id = String(s.state.pendingBackupRestore ?? '');
            if (!id)
                throw new Error('Confirmação de restauração ausente');
            s.busy = true;
            await this.ensureDeferredUpdate(i);
            try {
                const currentSnapshot = await (0, snapshotManager_1.captureGuildSnapshot)(guild);
                await (0, backupStore_1.createBackup)(s.guildId, cfg, i.user.id, 'Backup automático antes de restauração', cfg.backups.retention, currentSnapshot);
                const backup = await (0, backupStore_1.readBackup)(s.guildId, id);
                const restored = structuredClone(backup.config);
                restored.guildId = s.guildId;
                restored.backups.lastBackupAt = new Date().toISOString();
                this.record(restored, i.user.id, 'backup_restore', id);
                const structure = backup.snapshot ? await (0, restorationEngine_1.restoreGuildStructure)(guild, backup.snapshot) : null;
                await guildConfigStore_1.guildConfigStore.set(s.guildId, restored);
                s.state.pendingBackupRestore = '';
                s.state.backupList = await (0, backupStore_1.listBackups)(s.guildId, 10);
                s.state.backupReport = structure ? `${structure.rolesCreated} cargos e ${structure.channelsCreated} canais recriados; ${structure.failures.length} falhas.` : 'Configuração restaurada; o backup não continha snapshot estrutural.';
                await this.editPanelMessage(i, this.payload(s, i.user, guild, restored));
            }
            finally {
                s.busy = false;
            }
            return;
        }
        if (action === 'backuptoggle') {
            cfg.backups.automatic = !cfg.backups.automatic;
            this.record(cfg, i.user.id, 'backup_automatic', String(cfg.backups.automatic));
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'diagnose') {
            s.state.diagnosticReport = await this.diagnosticReport(guild, cfg);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'snapshottest') {
            await (0, snapshotManager_1.captureGuildSnapshot)(guild);
            s.state.diagnosticReport = '### Teste de snapshots\nCorreto — snapshot gravado e validado.';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'storagetest') {
            await guildConfigStore_1.guildConfigStore.set(s.guildId, cfg);
            const read = await guildConfigStore_1.guildConfigStore.get(s.guildId);
            s.state.diagnosticReport = read.guildId === s.guildId
                ? '### Teste de armazenamento\nCorreto — escrita atômica e leitura concluídas.'
                : '### Teste de armazenamento\nErro — servidor divergente.';
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'diagnosticexport') {
            const report = String(s.state.diagnosticReport ?? await this.diagnosticReport(guild, cfg));
            await i.editReply({
                content: 'Relatório de diagnóstico exportado.',
                files: [new discord_js_1.AttachmentBuilder(Buffer.from(report, 'utf8'), { name: `diagnostico-${s.guildId}.txt` })],
                allowedMentions: { parse: [] }
            });
            return;
        }
        if (action === 'settingsmodal') {
            await i.showModal(this.settingsModal(s, cfg));
            return;
        }
        if (action === 'raidmodal') {
            await i.showModal(this.raidModal(s, cfg));
            return;
        }
        if (action === 'toggledelete')
            cfg.panel.deleteCommandMessage = !cfg.panel.deleteCommandMessage;
        else if (action === 'toggleowner')
            cfg.access.allowGuildOwner = !cfg.access.allowGuildOwner;
        else if (action === 'toggleadmin')
            cfg.access.allowAdministrators = !cfg.access.allowAdministrators;
        else if (action === 'toggleownersonly')
            cfg.access.ownersOnly = !cfg.access.ownersOnly;
        else if (action === 'accessclear') {
            const until = Number(s.state.accessClearUntil ?? 0);
            if (Date.now() > until) {
                s.state.accessClearUntil = Date.now() + 30_000;
                await this.privateReply(i, 'Clique novamente em “Limpar listas de acesso” em até 30 segundos para confirmar.');
                return;
            }
            cfg.access.allowedUsers = [];
            cfg.access.allowedRoles = [];
            cfg.access.blockedUsers = [];
            cfg.access.blockedRoles = [];
            cfg.access.allowedChannels = [];
            cfg.access.blockedChannels = [];
            s.state.accessClearUntil = 0;
        }
        else if (action === 'activitymodal') {
            await i.showModal(this.activityModal(s));
            return;
        }
        else if (action === 'rotationmodal') {
            await i.showModal(this.rotationModal(s));
            return;
        }
        else if (action === 'rotationtoggle') {
            this.app.defaultPresence.rotationEnabled = !this.app.defaultPresence.rotationEnabled;
            (0, presence_1.applyPresence)(this.client, this.app, this.app.defaultPresence.rotationEnabled ? this.app.defaultPresence.rotationActivities?.[0] : undefined);
            await (0, configLoader_1.saveConfig)(this.app);
            await this.rerender(i, s, cfg);
            return;
        }
        else if (action === 'nickmodal') {
            await i.showModal(this.nickModal(s, guild));
            return;
        }
        else if (action === 'globalprofilemodal') {
            this.assertGlobalOwner(i.user.id);
            await i.showModal(this.globalProfileModal(s));
            return;
        }
        else if (action === 'removeavatar') {
            this.assertGlobalOwner(i.user.id);
            const until = Number(s.state.removeAvatarUntil ?? 0);
            if (Date.now() > until) {
                s.state.removeAvatarUntil = Date.now() + 30_000;
                await this.privateReply(i, 'Clique novamente em “Remover avatar global” em até 30 segundos para confirmar.');
                return;
            }
            if (!this.client.user)
                throw new Error('Usuário do bot indisponível');
            await this.client.user.setAvatar(null);
            s.state.removeAvatarUntil = 0;
            await this.rerender(i, s, cfg);
            return;
        }
        else if (action === 'clearactivity') {
            this.client.user?.setActivity();
            this.app.defaultPresence.activityType = 'none';
            this.app.defaultPresence.activityText = '';
            this.app.defaultPresence.rotationEnabled = false;
            this.app.defaultPresence.rotationActivities = [];
            delete this.app.defaultPresence.streamUrl;
            await (0, configLoader_1.saveConfig)(this.app);
            await this.rerender(i, s, cfg);
            return;
        }
        else
            throw new Error(`Ação de botão desconhecida: ${action}`);
        this.record(cfg, i.user.id, action);
        await this.saveAndRender(i, s, cfg);
    }
    async handleModal(i, s, action, cfg) {
        if (action === 'rolepanelfieldsubmit') {
            const panel = this.selectedRolePanel(s, cfg);
            const field = String(s.state.pendingRolePanelField ?? '');
            const value = i.fields.getTextInputValue('value').trim();
            if (!['name', 'title', 'description', 'color', 'placeholder'].includes(field))
                throw new Error('Campo de painel inválido');
            if (field === 'color' && !/^#[0-9a-f]{6}$/i.test(value))
                throw new Error('Informe uma cor hexadecimal válida');
            if ((field === 'name' || field === 'title' || field === 'placeholder') && !value)
                throw new Error('O campo não pode ficar vazio');
            panel[field] = value.slice(0, field === 'description' ? 4000 : field === 'placeholder' ? 150 : 256);
            panel.updatedAt = new Date().toISOString();
            delete s.state.pendingRolePanelField;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'rolepaneloptionsubmit') {
            const panel = this.selectedRolePanel(s, cfg);
            const roleId = String(s.state.editRoleOptionId ?? '');
            const option = panel.options.find(item => item.roleId === roleId);
            if (!option)
                throw new Error('Cargo não encontrado no painel');
            const label = i.fields.getTextInputValue('label').trim();
            const description = i.fields.getTextInputValue('description').trim();
            const emoji = i.fields.getTextInputValue('emoji').trim();
            if (!label || label.length > 100)
                throw new Error('O nome deve ter entre 1 e 100 caracteres');
            option.label = label;
            option.description = description.slice(0, 100);
            option.emoji = emoji ? emoji.slice(0, 100) : null;
            panel.updatedAt = new Date().toISOString();
            delete s.state.editRoleOptionId;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'rolepanelmaxsubmit') {
            const panel = this.selectedRolePanel(s, cfg);
            const maximum = Number(i.fields.getTextInputValue('maximum'));
            if (!Number.isInteger(maximum) || maximum < 1 || maximum > Math.max(1, panel.options.length))
                throw new Error('Máximo de seleções inválido');
            panel.maximumSelections = panel.exclusive ? 1 : maximum;
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'formfieldsubmit') {
            const form = this.selectedApplicationForm(s, cfg);
            const field = String(s.state.pendingFormField ?? '');
            const value = i.fields.getTextInputValue('value').trim();
            if (!['name', 'title', 'description', 'color', 'buttonLabel'].includes(field))
                throw new Error('Campo de formulário inválido');
            if (field === 'color' && !/^#[0-9a-f]{6}$/i.test(value))
                throw new Error('Informe uma cor hexadecimal válida');
            if (!value)
                throw new Error('O campo não pode ficar vazio');
            form[field] = value.slice(0, field === 'description' ? 4000 : field === 'buttonLabel' ? 80 : 256);
            form.updatedAt = new Date().toISOString();
            delete s.state.pendingFormField;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'formquestionsubmit') {
            const form = this.selectedApplicationForm(s, cfg);
            const label = i.fields.getTextInputValue('label').trim();
            const placeholder = i.fields.getTextInputValue('placeholder').trim();
            const required = /^(s|sim|true|1)$/i.test(i.fields.getTextInputValue('required').trim());
            const paragraph = /^(s|sim|true|1|l|longo)$/i.test(i.fields.getTextInputValue('paragraph').trim());
            if (!label || label.length > 45)
                throw new Error('A pergunta deve ter entre 1 e 45 caracteres');
            const editing = String(s.state.editFormQuestionId ?? '');
            const existing = form.questions.find(item => item.id === editing);
            if (existing)
                Object.assign(existing, { label, placeholder: placeholder.slice(0, 100), required, paragraph });
            else {
                if (form.questions.length >= 5)
                    throw new Error('O limite de perguntas foi atingido');
                form.questions.push({ id: `Q-${(0, ids_1.randomId)(3)}`, label, placeholder: placeholder.slice(0, 100), required, paragraph });
            }
            delete s.state.editFormQuestionId;
            form.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'telloynfieldsubmit') {
            const field = String(s.state.pendingTelloynField ?? '');
            const value = i.fields.getTextInputValue('value').trim();
            const item = cfg.community.telloyn;
            if (field === 'title')
                item.appearance.title = value.slice(0, 256) || 'Telloyn';
            else if (field === 'description')
                item.appearance.description = value.slice(0, 3500) || 'Envie uma mensagem para a comunidade.';
            else if (field === 'color') {
                if (!/^#[0-9a-f]{6}$/i.test(value))
                    throw new Error('Use uma cor hexadecimal, como #111111.');
                item.appearance.color = value.toUpperCase();
            }
            else if (field === 'footer')
                item.appearance.footer = value.slice(0, 2048);
            else if (field === 'separator')
                item.appearance.separator = value.slice(0, 120);
            else if (field === 'buttonLabel')
                item.appearance.buttonLabel = value.slice(0, 80) || 'Enviar Telloyn';
            else if (field === 'maximumMessageLength') {
                const maximum = Number(value);
                if (!Number.isInteger(maximum) || maximum < 50 || maximum > 1200)
                    throw new Error('O limite deve ficar entre 50 e 1200 caracteres.');
                item.maximumMessageLength = maximum;
            }
            else
                throw new Error('Campo do Telloyn inválido');
            delete s.state.pendingTelloynField;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'instagramfieldsubmit') {
            const field = String(s.state.pendingInstagramField ?? '');
            const value = i.fields.getTextInputValue('value').trim();
            const item = cfg.community.instagram;
            if (field === 'title')
                item.appearance.title = value.slice(0, 256) || 'Instagram';
            else if (field === 'description')
                item.appearance.description = value.slice(0, 3500) || 'Compartilhe fotos e vídeos com a comunidade.';
            else if (field === 'color') {
                if (!/^#[0-9a-f]{6}$/i.test(value))
                    throw new Error('Use uma cor hexadecimal, como #111111.');
                item.appearance.color = value.toUpperCase();
            }
            else if (field === 'footer')
                item.appearance.footer = value.slice(0, 2048);
            else if (field === 'separator')
                item.appearance.separator = value.slice(0, 120);
            else if (field === 'maximumCaptionLength') {
                const maximum = Number(value);
                if (!Number.isInteger(maximum) || maximum < 0 || maximum > 1800)
                    throw new Error('O limite deve ficar entre 0 e 1800 caracteres.');
                item.maximumCaptionLength = maximum;
            }
            else
                throw new Error('Campo do Instagram inválido');
            delete s.state.pendingInstagramField;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'twitterfieldsubmit') {
            const field = String(s.state.pendingTwitterField ?? '');
            const value = i.fields.getTextInputValue('value').trim();
            const item = cfg.community.twitter;
            if (field === 'webhookName') {
                if (!value)
                    throw new Error('O nome do webhook não pode ficar vazio');
                item.webhookName = value.slice(0, 80);
            }
            else if (field === 'maximumMessageLength') {
                const maximum = Number(value);
                if (!Number.isInteger(maximum) || maximum < 50 || maximum > 1900)
                    throw new Error('O limite deve ficar entre 50 e 1900 caracteres');
                item.maximumMessageLength = maximum;
            }
            else
                throw new Error('Campo do X inválido');
            delete s.state.pendingTwitterField;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'autocleanfieldsubmit') {
            const field = String(s.state.pendingAutoCleanField ?? '');
            const value = i.fields.getTextInputValue('value').trim();
            const rule = this.selectedAutoCleanRule(s, cfg);
            if (field === 'name') {
                if (!value)
                    throw new Error('O nome não pode ficar vazio');
                rule.name = value.slice(0, 60);
            }
            else if (field === 'delaySeconds') {
                const seconds = Number(value);
                if (!Number.isInteger(seconds) || seconds < 5 || seconds > 2_592_000)
                    throw new Error('Use um tempo entre 5 segundos e 30 dias');
                rule.delaySeconds = seconds;
            }
            else
                throw new Error('Campo de limpeza inválido');
            rule.updatedAt = new Date().toISOString();
            delete s.state.pendingAutoCleanField;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketfieldsubmit') {
            const panel = this.selectedTicketPanel(s, cfg);
            const path = String(s.state.pendingField ?? '');
            const [kind, field] = path.split('.');
            if (!['external', 'internal'].includes(kind) || !field)
                throw new Error('Campo de ticket inválido');
            const value = i.fields.getTextInputValue('value').trim();
            if (field === 'color' && !/^#[0-9a-f]{6}$/i.test(value))
                throw new Error('Informe uma cor hexadecimal válida');
            if (field === 'title' && (!value || value.length > 256))
                throw new Error('Título inválido');
            if (field === 'description' && (!value || value.length > 4000))
                throw new Error('Descrição inválida');
            if (field === 'buttonLabel' && (!value || value.length > 80))
                throw new Error('Texto do botão inválido');
            panel[kind][field] = value || (field === 'buttonEmoji' ? null : '');
            panel.updatedAt = new Date().toISOString();
            delete s.state.pendingField;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketuploadsubmit' || action === 'communityuploadsubmit' || action === 'telloynuploadsubmit' || action === 'instagramuploadsubmit') {
            const path = action === 'telloynuploadsubmit' ? String(s.state.pendingTelloynUpload ?? '') : action === 'instagramuploadsubmit' ? String(s.state.pendingInstagramUpload ?? '') : String(s.state.pendingUpload ?? '');
            const uploaded = i.fields.getUploadedFiles('file', true);
            const attachment = uploaded.first();
            if (!attachment)
                throw new Error('Nenhum arquivo foi enviado');
            if (attachment.contentType && !attachment.contentType.startsWith('image/'))
                throw new Error('Envie apenas uma imagem');
            if (attachment.size > 10 * 1024 * 1024)
                throw new Error('A imagem deve ter no máximo 10 MB');
            const persistentUrl = await (0, assetService_1.persistUploadedImage)(i, attachment);
            if (action === 'ticketuploadsubmit') {
                const panel = this.selectedTicketPanel(s, cfg);
                const [kind, field] = path.split('.');
                if (!panel[kind] || !['imageUrl', 'thumbnailUrl'].includes(field))
                    throw new Error('Destino de imagem inválido');
                panel[kind][field] = persistentUrl;
                panel.updatedAt = new Date().toISOString();
            }
            else if (action === 'communityuploadsubmit') {
                const [kind, field] = path.split('.');
                if (!cfg.community[kind] || !['imageUrl', 'thumbnailUrl'].includes(field))
                    throw new Error('Destino de imagem inválido');
                cfg.community[kind].appearance[field] = persistentUrl;
            }
            else if (action === 'telloynuploadsubmit') {
                if (!['imageUrl', 'thumbnailUrl'].includes(path))
                    throw new Error('Destino de imagem do Telloyn inválido');
                cfg.community.telloyn.appearance[path] = persistentUrl;
            }
            else {
                if (!['imageUrl', 'thumbnailUrl'].includes(path))
                    throw new Error('Destino de imagem do Instagram inválido');
                cfg.community.instagram.appearance[path] = persistentUrl;
            }
            delete s.state.pendingUpload;
            delete s.state.pendingTelloynUpload;
            delete s.state.pendingInstagramUpload;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketsettingfieldsubmit') {
            const panel = this.selectedTicketPanel(s, cfg);
            const field = String(s.state.pendingSettingField ?? '');
            const value = i.fields.getTextInputValue('value').trim();
            if (field === 'name') {
                if (!value || value.length > 80)
                    throw new Error('Nome inválido');
                panel.name = value;
            }
            else if (field === 'maxOpenPerUser') {
                const number = Number(value);
                if (!Number.isInteger(number) || number < 1 || number > 20)
                    throw new Error('O limite deve ficar entre 1 e 20');
                panel.maxOpenPerUser = number;
            }
            else if (field === 'ticketNamePattern') {
                if (!value || value.length > 90)
                    throw new Error('Nome do canal inválido');
                panel.ticketNamePattern = value;
            }
            else if (field === 'autoCloseMinutes') {
                const number = Number(value);
                if (!Number.isInteger(number) || number < 0 || number > 43200)
                    throw new Error('Tempo inválido');
                panel.autoCloseMinutes = number;
            }
            else if (field === 'businessHoursText') {
                panel.businessHoursText = value.slice(0, 500);
            }
            else
                throw new Error('Configuração de ticket inválida');
            panel.updatedAt = new Date().toISOString();
            delete s.state.pendingSettingField;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketquestionsubmit') {
            const panel = this.selectedTicketPanel(s, cfg);
            const label = i.fields.getTextInputValue('label').trim();
            const placeholder = i.fields.getTextInputValue('placeholder').trim();
            const required = /^s|sim|true|1$/i.test(i.fields.getTextInputValue('required').trim());
            const paragraph = /^l|longo|sim|true|1$/i.test(i.fields.getTextInputValue('paragraph').trim());
            if (!label || label.length > 45)
                throw new Error('A pergunta deve ter entre 1 e 45 caracteres');
            const editing = String(s.state.editQuestionId ?? '');
            const existing = panel.questions.find(item => item.id === editing);
            if (existing)
                Object.assign(existing, { label, placeholder: placeholder.slice(0, 100), required, paragraph });
            else {
                if (panel.questions.length >= 5)
                    throw new Error('O limite de perguntas foi atingido');
                panel.questions.push({ id: `Q-${(0, ids_1.randomId)(3)}`, label, placeholder: placeholder.slice(0, 100), required, paragraph });
            }
            delete s.state.editQuestionId;
            panel.updatedAt = new Date().toISOString();
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'communitymessagefieldsubmit') {
            const path = String(s.state.pendingField ?? '');
            const [kind, field] = path.split('.');
            if (!cfg.community[kind])
                throw new Error('Mensagem comunitária inválida');
            const value = i.fields.getTextInputValue('value').trim();
            if (field === 'deleteAfterSeconds') {
                const number = Number(value);
                if (!Number.isInteger(number) || number < 0 || number > 86400)
                    throw new Error('Tempo de exclusão inválido');
                cfg.community[kind].deleteAfterSeconds = number;
            }
            else {
                if (field === 'color' && !/^#[0-9a-f]{6}$/i.test(value))
                    throw new Error('Cor inválida');
                if (!['title', 'description', 'color', 'footer', 'separator', 'authorName'].includes(field))
                    throw new Error('Campo inválido');
                cfg.community[kind].appearance[field] = value;
            }
            delete s.state.pendingField;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'voicefieldsubmit') {
            const field = String(s.state.pendingVoiceField ?? '');
            const value = i.fields.getTextInputValue('value').trim();
            if (field === 'namePattern') {
                if (!value || value.length > 80)
                    throw new Error('Nome da sala inválido');
                cfg.community.temporaryVoice.namePattern = value;
            }
            else if (field === 'defaultUserLimit') {
                const number = Number(value);
                if (!Number.isInteger(number) || number < 0 || number > 99)
                    throw new Error('Limite inválido');
                cfg.community.temporaryVoice.defaultUserLimit = number;
            }
            else
                throw new Error('Campo de voz inválido');
            delete s.state.pendingVoiceField;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'logchannelsubmit') {
            const event = String(s.state.pendingLogEvent ?? '');
            const item = cfg.logs.events[event];
            if (!item)
                throw new Error('Evento de log inválido');
            const channels = i.fields.getSelectedChannels('channel', true);
            const channel = channels.first();
            if (!channel)
                throw new Error('Nenhum canal selecionado');
            item.channelId = channel.id;
            item.mode = 'specific';
            delete s.state.pendingLogEvent;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'aliassubmit') {
            const command = String(s.state.selectedCommand ?? 'help');
            const values = this.splitList(i.fields.getTextInputValue('aliases'), 10).map(value => value.toLowerCase().replace(/^!/, '').replace(/[^a-z0-9_-]/g, '')).filter(Boolean);
            const reserved = new Set(Object.keys(cfg.commands.aliases).filter(name => name !== command));
            if (values.some(value => reserved.has(value)))
                throw new Error('Um alias não pode ser igual ao nome de outro comando');
            cfg.commands.aliases[command] = [...new Set(values)].filter(value => value !== command);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'commandcooldownsubmit') {
            const command = String(s.state.selectedCommand ?? 'help');
            const permission = cfg.commands.permissions[command] ?? (cfg.commands.permissions[command] = (0, defaults_1.defaultCommandPermission)());
            const seconds = Number(i.fields.getTextInputValue('seconds'));
            if (!Number.isInteger(seconds) || seconds < 0 || seconds > 86400)
                throw new Error('Cooldown inválido');
            permission.cooldownSeconds = seconds;
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'cllimitsubmit') {
            const scanLimit = Number(i.fields.getTextInputValue('scanLimit'));
            if (!Number.isInteger(scanLimit) || scanLimit < 100 || scanLimit > 10_000)
                throw new Error('O limite do CL deve ficar entre 100 e 10000 mensagens');
            cfg.community.cl.scanLimit = scanLimit;
            this.record(cfg, i.user.id, 'community_cl_limit', String(scanLimit));
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketsettingssubmit') {
            const panel = this.selectedTicketPanel(s, cfg);
            const name = i.fields.getTextInputValue('name').trim();
            const maximum = Number(i.fields.getTextInputValue('maximum'));
            const pattern = i.fields.getTextInputValue('pattern').trim();
            if (!name || name.length > 80)
                throw new Error('Nome do painel inválido');
            if (!Number.isInteger(maximum) || maximum < 1 || maximum > 20)
                throw new Error('O limite por usuário deve ficar entre 1 e 20');
            if (!pattern || pattern.length > 90)
                throw new Error('Padrão do nome do canal inválido');
            panel.name = name;
            panel.maxOpenPerUser = maximum;
            panel.ticketNamePattern = pattern;
            panel.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, 'ticket_panel_settings', panel.id);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketappearanceexternalsubmit' || action === 'ticketappearanceinternalsubmit') {
            const panel = this.selectedTicketPanel(s, cfg);
            const kind = action === 'ticketappearanceexternalsubmit' ? 'external' : 'internal';
            const appearance = panel[kind];
            const title = i.fields.getTextInputValue('title').trim();
            const description = i.fields.getTextInputValue('description').trim();
            const color = i.fields.getTextInputValue('color').trim();
            if (!title || title.length > 256 || !description || description.length > 4000 || !/^#[0-9a-f]{6}$/i.test(color))
                throw new Error('Título, descrição ou cor inválidos');
            appearance.title = title;
            appearance.description = description;
            appearance.color = color;
            appearance.footer = i.fields.getTextInputValue('footer').trim().slice(0, 2048);
            appearance.separator = i.fields.getTextInputValue('separator').trim().slice(0, 200);
            panel.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, 'ticket_appearance_text', `${panel.id}:${kind}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ticketmediaexternalsubmit' || action === 'ticketmediainternalsubmit') {
            const panel = this.selectedTicketPanel(s, cfg);
            const kind = action === 'ticketmediaexternalsubmit' ? 'external' : 'internal';
            const appearance = panel[kind];
            const image = i.fields.getTextInputValue('image').trim();
            const thumbnail = i.fields.getTextInputValue('thumbnail').trim();
            if (image && !/^https?:\/\//i.test(image))
                throw new Error('URL da imagem inválida');
            if (thumbnail && !/^https?:\/\//i.test(thumbnail))
                throw new Error('URL da thumbnail inválida');
            appearance.imageUrl = image || null;
            appearance.thumbnailUrl = thumbnail || null;
            const label = kind === 'external' ? i.fields.getTextInputValue('buttonLabel').trim() : '';
            if (label)
                appearance.buttonLabel = label.slice(0, 80);
            panel.updatedAt = new Date().toISOString();
            this.record(cfg, i.user.id, 'ticket_appearance_media', `${panel.id}:${kind}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'limitsubmit') {
            const [module, protection] = this.selectedProtection(s, cfg);
            const quantity = Number(i.fields.getTextInputValue('quantity'));
            const interval = Number(i.fields.getTextInputValue('interval'));
            const reset = Number(i.fields.getTextInputValue('reset'));
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100)
                throw new Error('Quantidade inválida');
            if (!Number.isInteger(interval) || interval < 1 || interval > 3600)
                throw new Error('Intervalo inválido');
            if (!Number.isInteger(reset) || reset < 1 || reset > 86_400)
                throw new Error('Tempo de reset inválido');
            protection.quantity = quantity;
            protection.intervalSeconds = interval;
            protection.resetSeconds = reset;
            this.record(cfg, i.user.id, 'protection_limits', `${module}:${quantity}/${interval}/${reset}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'pfilterssubmit') {
            const [module, protection] = this.selectedProtection(s, cfg);
            protection.allowedDomains = this.splitList(i.fields.getTextInputValue('allowedDomains'), 100);
            protection.blockedDomains = this.splitList(i.fields.getTextInputValue('blockedDomains'), 100);
            protection.blockedWords = this.splitList(i.fields.getTextInputValue('blockedWords'), 200);
            protection.blockedExtensions = this.splitList(i.fields.getTextInputValue('blockedExtensions'), 50).map(value => value.replace(/^\./, '').toLowerCase());
            const minimumAge = Number(i.fields.getTextInputValue('minimumAge'));
            if (!Number.isInteger(minimumAge) || minimumAge < 0 || minimumAge > 31_536_000)
                throw new Error('Idade mínima inválida');
            protection.minimumAccountAgeSeconds = minimumAge;
            this.record(cfg, i.user.id, 'protection_filters', module);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'ppunishsubmit') {
            const [module, protection] = this.selectedProtection(s, cfg);
            const timeout = Number(i.fields.getTextInputValue('timeout'));
            const retries = Number(i.fields.getTextInputValue('retries'));
            if (!Number.isInteger(timeout) || timeout < 1 || timeout > 2_419_200)
                throw new Error('Timeout inválido');
            if (!Number.isInteger(retries) || retries < 0 || retries > 5)
                throw new Error('Tentativas inválidas');
            protection.punishment.timeoutSeconds = timeout;
            protection.punishment.reason = i.fields.getTextInputValue('reason').trim().slice(0, 400) || 'Proteção automática do servidor';
            protection.punishment.dmMessage = i.fields.getTextInputValue('dm').trim().slice(0, 1500);
            protection.punishment.retries = retries;
            const sequence = this.splitList(i.fields.getTextInputValue('sequence'), 20);
            const valid = ['none', 'log', 'warn', 'dm', 'timeout', 'quarantine', 'remove_dangerous_roles', 'remove_roles', 'kick', 'ban'];
            if (sequence.some(step => !valid.includes(step)))
                throw new Error('A sequência contém uma ação inválida');
            protection.punishment.sequence = sequence.length ? sequence : ['remove_dangerous_roles', 'quarantine', 'log'];
            this.record(cfg, i.user.id, 'punishment_details', module);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'loggroupsubmit') {
            const [event, item] = this.selectedLog(s, cfg);
            const seconds = Number(i.fields.getTextInputValue('groupWindow'));
            if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600)
                throw new Error('Intervalo de agrupamento inválido');
            item.groupWindowSeconds = seconds;
            this.record(cfg, i.user.id, 'log_group_window', `${event}:${seconds}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'settingssubmit') {
            const title = i.fields.getTextInputValue('title').trim();
            const description = i.fields.getTextInputValue('description').trim();
            const color = i.fields.getTextInputValue('color').trim();
            const timeout = Number(i.fields.getTextInputValue('timeout'));
            if (!title || !/^#[0-9a-f]{6}$/i.test(color) || !Number.isInteger(timeout) || timeout < 60 || timeout > 3600)
                throw new Error('Aparência inválida');
            cfg.panel.title = title.slice(0, 80);
            cfg.panel.description = description.slice(0, 500);
            cfg.panel.color = color;
            cfg.panel.footer = '';
            cfg.panel.sessionTimeoutSeconds = timeout;
            s.timeoutSeconds = timeout;
            this.record(cfg, i.user.id, 'panel_appearance');
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'raidsubmit') {
            const count = Number(i.fields.getTextInputValue('joinCount'));
            const interval = Number(i.fields.getTextInputValue('joinInterval'));
            const duration = Number(i.fields.getTextInputValue('raidDuration'));
            if (![count, interval, duration].every(Number.isInteger) || count < 2 || count > 500 || interval < 1 || interval > 3600 || duration < 60 || duration > 86_400)
                throw new Error('Limites de raid inválidos');
            cfg.raid.joinCount = count;
            cfg.raid.intervalSeconds = interval;
            cfg.raid.durationSeconds = duration;
            this.record(cfg, i.user.id, 'raid_limits', `${count}/${interval}/${duration}`);
            await this.saveAndRender(i, s, cfg);
            return;
        }
        if (action === 'activitysubmit') {
            const type = i.fields.getTextInputValue('type').trim().toLowerCase();
            const text = i.fields.getTextInputValue('text').trim();
            const streamUrl = i.fields.getTextInputValue('streamUrl').trim();
            const map = { playing: 0, streaming: 1, listening: 2, watching: 3, custom: 4, competing: 5 };
            if (!(type in map) || !text)
                throw new Error('Atividade inválida');
            if (type === 'streaming' && streamUrl && !/^https:\/\/(?:www\.)?(?:twitch\.tv|youtube\.com|youtu\.be)\//i.test(streamUrl))
                throw new Error('URL de transmissão inválida');
            this.client.user?.setActivity(text, { type: map[type], url: type === 'streaming' ? streamUrl || undefined : undefined });
            this.app.defaultPresence.activityType = type;
            this.app.defaultPresence.activityText = text;
            this.app.defaultPresence.rotationEnabled = false;
            if (type === 'streaming' && streamUrl)
                this.app.defaultPresence.streamUrl = streamUrl;
            else
                delete this.app.defaultPresence.streamUrl;
            await (0, configLoader_1.saveConfig)(this.app);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'rotationsubmit') {
            const raw = i.fields.getTextInputValue('activities');
            const interval = (0, presence_1.normalizeRotationInterval)(i.fields.getTextInputValue('interval'));
            const activities = (0, presence_1.parsePresenceRotation)(raw);
            if (!activities.length)
                throw new Error('Adicione pelo menos uma atividade no formato tipo | texto');
            this.app.defaultPresence.rotationActivities = activities;
            this.app.defaultPresence.rotationIntervalSeconds = interval;
            this.app.defaultPresence.rotationEnabled = true;
            (0, presence_1.applyPresence)(this.client, this.app, activities[0]);
            await (0, configLoader_1.saveConfig)(this.app);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'globalprofilesubmit') {
            this.assertGlobalOwner(i.user.id);
            const username = i.fields.getTextInputValue('username').trim();
            const avatarUrl = i.fields.getTextInputValue('avatarUrl').trim();
            if (!username && !avatarUrl)
                throw new Error('Informe um nome ou uma URL de avatar');
            if (username && (username.length < 2 || username.length > 32))
                throw new Error('Nome global deve ter entre 2 e 32 caracteres');
            if (avatarUrl && !/^https?:\/\//i.test(avatarUrl))
                throw new Error('URL de avatar inválida');
            if (!this.client.user)
                throw new Error('Usuário do bot indisponível');
            if (username && username !== this.client.user.username)
                await this.client.user.setUsername(username);
            if (avatarUrl)
                await this.client.user.setAvatar(avatarUrl);
            await this.rerender(i, s, cfg);
            return;
        }
        if (action === 'nicksubmit') {
            const nickname = i.fields.getTextInputValue('nickname').trim();
            await i.guild?.members.me?.setNickname(nickname || null, 'Alteração solicitada no painel da comunidade');
            await this.rerender(i, s, cfg);
            return;
        }
        throw new Error(`Modal desconhecido: ${action}`);
    }
    ticketFieldModal(s, cfg, path) {
        const panel = this.selectedTicketPanel(s, cfg);
        const [kind, field] = path.split('.');
        if (!['external', 'internal'].includes(kind) || !field)
            throw new Error('Campo de ticket inválido');
        const value = String(panel[kind][field] ?? '');
        s.state.pendingField = path;
        const paragraph = field === 'description';
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'ticketfieldsubmit')).setTitle(`Alterar ${this.fieldLabel(String(field))}`).addComponents(this.input('value', this.fieldLabel(String(field)), value, !['footer', 'separator', 'buttonEmoji', 'authorName'].includes(String(field)), paragraph));
    }
    ticketSettingFieldModal(s, cfg, field) {
        const panel = this.selectedTicketPanel(s, cfg);
        if (!['name', 'maxOpenPerUser', 'ticketNamePattern', 'autoCloseMinutes', 'businessHoursText'].includes(field))
            throw new Error('Configuração inválida');
        s.state.pendingSettingField = field;
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'ticketsettingfieldsubmit')).setTitle(`Alterar ${this.fieldLabel(field)}`).addComponents(this.input('value', this.fieldLabel(field), String(panel[field] ?? ''), true, field === 'businessHoursText'));
    }
    ticketQuestionModal(s, question) {
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'ticketquestionsubmit')).setTitle(question ? 'Editar pergunta' : 'Adicionar pergunta').addComponents(this.input('label', 'Pergunta', question?.label ?? '', true), this.input('placeholder', 'Texto de ajuda', question?.placeholder ?? '', false), this.input('required', 'Obrigatória? sim ou não', question?.required ? 'sim' : 'não', true), this.input('paragraph', 'Texto longo? sim ou não', question?.paragraph ? 'sim' : 'não', true));
    }
    communityMessageFieldModal(s, cfg, path) {
        const [kind, field] = path.split('.');
        if (!cfg.community[kind])
            throw new Error('Mensagem comunitária inválida');
        const value = field === 'deleteAfterSeconds' ? String(cfg.community[kind].deleteAfterSeconds) : String(cfg.community[kind].appearance[field] ?? '');
        s.state.pendingField = path;
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'communitymessagefieldsubmit')).setTitle(`Alterar ${this.fieldLabel(field)}`).addComponents(this.input('value', this.fieldLabel(field), value, !['footer', 'separator', 'authorName'].includes(field), field === 'description'));
    }
    voiceFieldModal(s, cfg, field) {
        if (!['namePattern', 'defaultUserLimit'].includes(field))
            throw new Error('Campo de voz inválido');
        s.state.pendingVoiceField = field;
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'voicefieldsubmit')).setTitle('Configurar sala temporária').addComponents(this.input('value', this.fieldLabel(field), String(cfg.community.temporaryVoice[field] ?? ''), true));
    }
    rolePanelFieldModal(s, cfg, field) {
        const panel = this.selectedRolePanel(s, cfg);
        if (!['name', 'title', 'description', 'color', 'placeholder'].includes(field))
            throw new Error('Campo inválido');
        s.state.pendingRolePanelField = field;
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'rolepanelfieldsubmit')).setTitle(`Alterar ${this.fieldLabel(field)}`).addComponents(this.input('value', this.fieldLabel(field), String(panel[field] ?? ''), true, field === 'description'));
    }
    rolePanelOptionModal(s, cfg, roleId) {
        const panel = this.selectedRolePanel(s, cfg);
        const option = panel.options.find(item => item.roleId === roleId);
        if (!option)
            throw new Error('Cargo não encontrado');
        s.state.editRoleOptionId = roleId;
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'rolepaneloptionsubmit')).setTitle('Editar opção de cargo').addComponents(this.input('label', 'Nome exibido', option.label, true), this.input('description', 'Descrição', option.description, false), this.input('emoji', 'Emoji opcional', option.emoji ?? '', false));
    }
    rolePanelMaxModal(s, cfg) {
        const panel = this.selectedRolePanel(s, cfg);
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'rolepanelmaxsubmit')).setTitle('Máximo de cargos').addComponents(this.input('maximum', 'Máximo de seleções', String(panel.maximumSelections), true));
    }
    applicationFormFieldModal(s, cfg, field) {
        const form = this.selectedApplicationForm(s, cfg);
        if (!['name', 'title', 'description', 'color', 'buttonLabel'].includes(field))
            throw new Error('Campo inválido');
        s.state.pendingFormField = field;
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'formfieldsubmit')).setTitle(`Alterar ${this.fieldLabel(field)}`).addComponents(this.input('value', this.fieldLabel(field), String(form[field] ?? ''), true, field === 'description'));
    }
    applicationQuestionModal(s, question) {
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'formquestionsubmit')).setTitle(question ? 'Editar pergunta' : 'Adicionar pergunta').addComponents(this.input('label', 'Pergunta', question?.label ?? '', true), this.input('placeholder', 'Texto de ajuda', question?.placeholder ?? '', false), this.input('required', 'Obrigatória? sim ou não', question?.required ? 'sim' : 'não', true), this.input('paragraph', 'Texto longo? sim ou não', question?.paragraph ? 'sim' : 'não', true));
    }
    telloynFieldModal(s, cfg, field) {
        const item = cfg.community.telloyn;
        if (!['title', 'description', 'color', 'footer', 'separator', 'buttonLabel', 'maximumMessageLength'].includes(field))
            throw new Error('Campo do Telloyn inválido');
        s.state.pendingTelloynField = field;
        const value = field === 'maximumMessageLength' ? String(item.maximumMessageLength) : String(item.appearance[field] ?? '');
        const paragraph = field === 'description';
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'telloynfieldsubmit')).setTitle(`Alterar ${this.fieldLabel(field)}`).addComponents(this.input('value', this.fieldLabel(field), value, true, paragraph));
    }
    instagramFieldModal(s, cfg, field) {
        const item = cfg.community.instagram;
        if (!['title', 'description', 'color', 'footer', 'separator', 'maximumCaptionLength'].includes(field))
            throw new Error('Campo do Instagram inválido');
        s.state.pendingInstagramField = field;
        const value = field === 'maximumCaptionLength' ? String(item.maximumCaptionLength) : String(item.appearance[field] ?? '');
        const paragraph = field === 'description';
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'instagramfieldsubmit')).setTitle(`Alterar ${this.fieldLabel(field)}`).addComponents(this.input('value', this.fieldLabel(field), value, true, paragraph));
    }
    twitterFieldModal(s, cfg, field) {
        const item = cfg.community.twitter;
        if (!['webhookName', 'maximumMessageLength'].includes(field))
            throw new Error('Campo do X inválido');
        s.state.pendingTwitterField = field;
        const value = field === 'maximumMessageLength' ? String(item.maximumMessageLength) : item.webhookName;
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'twitterfieldsubmit')).setTitle(field === 'webhookName' ? 'Nome do webhook' : 'Limite da publicação').addComponents(this.input('value', field === 'webhookName' ? 'Nome do webhook' : 'Máximo de caracteres', value, true));
    }
    autoCleanFieldModal(s, cfg, field) {
        const rule = this.selectedAutoCleanRule(s, cfg);
        if (!['name', 'delaySeconds'].includes(field))
            throw new Error('Campo de limpeza inválido');
        s.state.pendingAutoCleanField = field;
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'autocleanfieldsubmit')).setTitle(field === 'name' ? 'Nome da regra' : 'Tempo para apagar').addComponents(this.input('value', field === 'name' ? 'Nome da regra' : 'Tempo em segundos', field === 'name' ? rule.name : String(rule.delaySeconds), true));
    }
    aliasModal(s, cfg, command) {
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'aliassubmit')).setTitle(`Aliases de !${command}`).addComponents(this.input('aliases', 'Aliases separados por vírgula', (cfg.commands.aliases[command] ?? []).join(', '), false, true));
    }
    commandCooldownModal(s, cfg, command) {
        const item = cfg.commands.permissions[command] ?? (cfg.commands.permissions[command] = (0, defaults_1.defaultCommandPermission)());
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'commandcooldownsubmit')).setTitle(`Cooldown de !${command}`).addComponents(this.input('seconds', 'Segundos entre usos', String(item.cooldownSeconds), true));
    }
    fileUploadModal(s, action, title) {
        const upload = new discord_js_1.FileUploadBuilder().setCustomId('file').setMinValues(1).setMaxValues(1).setRequired(true);
        const label = new discord_js_1.LabelBuilder().setLabel('Selecione uma imagem').setDescription('PNG, JPG, WEBP ou GIF de até 10 MB.').setFileUploadComponent(upload);
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, action)).setTitle(title).addLabelComponents(label);
    }
    logChannelModal(s, event) {
        const selector = new discord_js_1.ChannelSelectMenuBuilder().setCustomId('channel').setChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1);
        const label = new discord_js_1.LabelBuilder().setLabel(`Canal de ${event}`.slice(0, 45)).setDescription('Selecione o canal que receberá este evento.').setChannelSelectMenuComponent(selector);
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'logchannelsubmit')).setTitle('Selecionar canal de log').addLabelComponents(label);
    }
    fieldLabel(field) {
        const labels = {
            title: 'título', description: 'descrição', color: 'cor hexadecimal', footer: 'rodapé', separator: 'separador', buttonLabel: 'texto do botão', buttonEmoji: 'ícone do botão', maximumMessageLength: 'limite da mensagem', maximumCaptionLength: 'limite da legenda',
            name: 'nome', maxOpenPerUser: 'limite por usuário', ticketNamePattern: 'nome do canal', autoCloseMinutes: 'fechamento automático', businessHoursText: 'texto do horário',
            deleteAfterSeconds: 'exclusão automática', namePattern: 'nome da sala', defaultUserLimit: 'limite de usuários', placeholder: 'texto do seletor'
        };
        return labels[field] ?? field;
    }
    clLimitModal(s, cfg) {
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'cllimitsubmit')).setTitle('Limite do comando CL').addComponents(this.input('scanLimit', 'Mensagens verificadas, de 100 a 10000', String(cfg.community.cl.scanLimit), true));
    }
    ticketSettingsModal(s, cfg) {
        const panel = this.selectedTicketPanel(s, cfg);
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'ticketsettingssubmit')).setTitle('Configurar painel de ticket').addComponents(this.input('name', 'Nome do painel', panel.name, true), this.input('maximum', 'Máximo de tickets por usuário', String(panel.maxOpenPerUser), true), this.input('pattern', 'Nome do canal com placeholders', panel.ticketNamePattern, true));
    }
    ticketAppearanceModal(s, cfg, kind) {
        const panel = this.selectedTicketPanel(s, cfg);
        const appearance = panel[kind];
        const action = kind === 'external' ? 'ticketappearanceexternalsubmit' : 'ticketappearanceinternalsubmit';
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, action)).setTitle(kind === 'external' ? 'Texto externo do ticket' : 'Texto interno do ticket').addComponents(this.input('title', 'Título', appearance.title, true), this.input('description', 'Descrição e placeholders', appearance.description, true, true), this.input('color', 'Cor hexadecimal', appearance.color, true), this.input('footer', 'Rodapé', appearance.footer, false), this.input('separator', 'Separador', appearance.separator, false));
    }
    ticketMediaModal(s, cfg, kind) {
        const panel = this.selectedTicketPanel(s, cfg);
        const appearance = panel[kind];
        const action = kind === 'external' ? 'ticketmediaexternalsubmit' : 'ticketmediainternalsubmit';
        const modal = new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, action)).setTitle(kind === 'external' ? 'Mídia externa do ticket' : 'Mídia interna do ticket').addComponents(this.input('image', 'URL da imagem; vazio remove', appearance.imageUrl ?? '', false), this.input('thumbnail', 'URL da thumbnail; vazio remove', appearance.thumbnailUrl ?? '', false));
        if (kind === 'external')
            modal.addComponents(this.input('buttonLabel', 'Texto do botão de abrir', appearance.buttonLabel, false));
        return modal;
    }
    limitModal(s, cfg) {
        const [, protection] = this.selectedProtection(s, cfg);
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'limitsubmit')).setTitle('Editar limites').addComponents(this.input('quantity', 'Quantidade máxima', String(protection.quantity), true), this.input('interval', 'Intervalo em segundos', String(protection.intervalSeconds), true), this.input('reset', 'Tempo para zerar contador', String(protection.resetSeconds), true));
    }
    protectionFiltersModal(s, cfg) {
        const [, protection] = this.selectedProtection(s, cfg);
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'pfilterssubmit')).setTitle('Filtros e listas').addComponents(this.input('allowedDomains', 'Domínios permitidos, separados por vírgula', protection.allowedDomains.join(', '), false, true), this.input('blockedDomains', 'Domínios bloqueados', protection.blockedDomains.join(', '), false, true), this.input('blockedWords', 'Palavras bloqueadas', protection.blockedWords.join(', '), false, true), this.input('blockedExtensions', 'Extensões proibidas', protection.blockedExtensions.join(', '), false), this.input('minimumAge', 'Idade mínima da conta em segundos', String(protection.minimumAccountAgeSeconds), true));
    }
    punishmentModal(s, cfg) {
        const [, protection] = this.selectedProtection(s, cfg);
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'ppunishsubmit')).setTitle('Detalhes da punição').addComponents(this.input('timeout', 'Duração do timeout em segundos', String(protection.punishment.timeoutSeconds), true), this.input('reason', 'Motivo', protection.punishment.reason, true, true), this.input('dm', 'Mensagem privada', protection.punishment.dmMessage, false, true), this.input('retries', 'Quantidade de novas tentativas', String(protection.punishment.retries), true), this.input('sequence', 'Sequência separada por vírgula', protection.punishment.sequence.join(', '), false, true));
    }
    logGroupModal(s, cfg) {
        const [, item] = this.selectedLog(s, cfg);
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'loggroupsubmit')).setTitle('Agrupamento de logs').addComponents(this.input('groupWindow', 'Intervalo em segundos', String(item.groupWindowSeconds), true));
    }
    settingsModal(s, cfg) {
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'settingssubmit')).setTitle('Aparência do painel').addComponents(this.input('title', 'Título', cfg.panel.title, true), this.input('description', 'Descrição', cfg.panel.description, true, true), this.input('color', 'Cor hexadecimal', cfg.panel.color, true), this.input('timeout', 'Expiração em segundos', String(cfg.panel.sessionTimeoutSeconds), true));
    }
    raidModal(s, cfg) {
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'raidsubmit')).setTitle('Limites do modo raid').addComponents(this.input('joinCount', 'Quantidade de entradas', String(cfg.raid.joinCount), true), this.input('joinInterval', 'Intervalo em segundos', String(cfg.raid.intervalSeconds), true), this.input('raidDuration', 'Duração do modo raid em segundos', String(cfg.raid.durationSeconds), true));
    }
    activityModal(s) {
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'activitysubmit')).setTitle('Atividade do bot').addComponents(this.input('type', 'playing, streaming, listening...', this.app.defaultPresence.activityType === 'none' ? 'watching' : this.app.defaultPresence.activityType, true), this.input('text', 'Texto da atividade', this.app.defaultPresence.activityText, true), this.input('streamUrl', 'URL para streaming, quando aplicável', this.app.defaultPresence.streamUrl ?? '', false));
    }
    rotationModal(s) {
        const current = (this.app.defaultPresence.rotationActivities ?? []).map(item => `${item.activityType} | ${item.activityText}`).join('\n');
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'rotationsubmit')).setTitle('Rotação de atividade').addComponents(this.input('activities', 'Uma atividade por linha', current || 'watching | [members] membros na comunidade\nlistening | [servers] servidores conectados', true, true), this.input('interval', 'Intervalo em segundos (mínimo 5)', String(this.app.defaultPresence.rotationIntervalSeconds ?? 5), true));
    }
    globalProfileModal(s) {
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'globalprofilesubmit')).setTitle('Perfil global do bot').addComponents(this.input('username', 'Novo nome global; vazio mantém', this.client.user?.username ?? '', false), this.input('avatarUrl', 'URL HTTPS do novo avatar; vazio mantém', '', false));
    }
    nickModal(s, guild) {
        return new discord_js_1.ModalBuilder().setCustomId(this.ids.encode(s.id, 'nicksubmit')).setTitle('Apelido no servidor').addComponents(this.input('nickname', 'Novo apelido; vazio restaura', guild.members.me?.nickname ?? '', false));
    }
    input(id, label, value, required, paragraph = false) {
        const input = new discord_js_1.TextInputBuilder().setCustomId(id).setLabel(label.slice(0, 45)).setStyle(paragraph ? discord_js_1.TextInputStyle.Paragraph : discord_js_1.TextInputStyle.Short).setRequired(required);
        if (value)
            input.setValue(value.slice(0, paragraph ? 4000 : 400));
        return new discord_js_1.ActionRowBuilder().addComponents(input);
    }
    async diagnosticReport(guild, cfg) {
        const permissions = (0, permissionChecker_1.diagnosePermissions)(guild);
        const backups = await (0, backupStore_1.listBackups)(guild.id, 100);
        const invalidLogs = cfg.logs.failures.slice(0, 5);
        const lines = [
            '### Resultado do diagnóstico',
            `**Conexão:** ${this.client.ws.status === 0 ? 'Correto' : 'Aviso'}`,
            `**Latência:** ${Math.round(this.client.ws.ping)} ms`,
            `**Hierarquia:** ${(guild.members.me?.roles.highest.position ?? 0) > 1 ? 'Correto' : 'Aviso'}`,
            `**Canal padrão de logs:** ${cfg.logs.defaultChannelId ? 'Configurado' : 'Não configurado'}`,
            `**Snapshot:** ${cfg.snapshots.lastRefreshAt ? 'Correto' : 'Aviso'}`,
            `**Backups:** ${backups.length}`,
            `**Falhas recentes de log:** ${invalidLogs.length}`,
            `**JSON do servidor:** Correto`,
            '',
            ...permissions.map(item => `**${item.name}:** ${item.ok ? 'Correto' : 'Erro'}`)
        ];
        return lines.join('\n');
    }
    assertGlobalOwner(userId) {
        if (!this.app.owners.includes(userId))
            throw new Error('Apenas proprietários globais podem alterar o perfil global do bot');
    }
    selectedAutoCleanRule(s, cfg) {
        const selectedId = String(s.state.autoCleanRuleId ?? '');
        const rule = cfg.community.autoClean.rules.find(item => item.id === selectedId) ?? cfg.community.autoClean.rules[0];
        if (!rule)
            throw new Error('Nenhuma regra de limpeza foi selecionada');
        s.state.autoCleanRuleId = rule.id;
        return rule;
    }
    selectedTicketPanel(s, cfg) {
        const selectedId = typeof s.state.ticketPanelId === 'string' ? s.state.ticketPanelId : '';
        const panel = cfg.community.tickets.panels.find(item => item.id === selectedId) ?? cfg.community.tickets.panels[0];
        if (!panel)
            throw new Error('Nenhum painel de ticket foi selecionado');
        s.state.ticketPanelId = panel.id;
        return panel;
    }
    createTicketPanel(createdBy, position) {
        const now = new Date().toISOString();
        return {
            id: `TP-${(0, ids_1.randomId)(4)}`,
            name: `Atendimento ${position}`,
            enabled: true,
            categoryId: null,
            publishChannelId: null,
            publishMessageId: null,
            creationMode: 'channel',
            openComponent: 'button',
            threadParentChannelId: null,
            supportRoleIds: [],
            allowedRoleIds: [],
            blockedRoleIds: [],
            blockedUserIds: [],
            maxOpenPerUser: 1,
            logChannelId: null,
            transcriptChannelId: null,
            ticketNamePattern: 'ticket-[user.name]-[ticket.number]',
            external: (0, defaults_1.defaultTicketAppearance)('external'),
            internal: (0, defaults_1.defaultTicketAppearance)('internal'),
            questions: [],
            autoCloseMinutes: 0,
            allowReopen: true,
            ratingEnabled: false,
            businessHoursEnabled: false,
            businessHoursText: 'Atendimento disponível.',
            internalButtons: { claim: true, unclaim: true, close: true, reopen: true, delete: true, addMember: true, removeMember: true, createVoice: true, transfer: true, priority: true, rename: true, transcript: true },
            createdBy,
            createdAt: now,
            updatedAt: now
        };
    }
    selectedRolePanel(s, cfg) {
        const id = String(s.state.rolePanelId ?? '');
        const panel = cfg.community.rolePanels.panels.find(item => item.id === id) ?? cfg.community.rolePanels.panels[0];
        if (!panel)
            throw new Error('Nenhum painel de cargos selecionado');
        s.state.rolePanelId = panel.id;
        return panel;
    }
    selectedApplicationForm(s, cfg) {
        const id = String(s.state.formId ?? '');
        const form = cfg.community.forms.forms.find(item => item.id === id) ?? cfg.community.forms.forms[0];
        if (!form)
            throw new Error('Nenhum formulário selecionado');
        s.state.formId = form.id;
        return form;
    }
    selectedProtection(s, cfg) {
        const module = String(s.state.selectedModule ?? '');
        const protection = cfg.protections[module];
        if (!module || !protection)
            throw new Error('Módulo não selecionado');
        return [module, protection];
    }
    selectedLog(s, cfg) {
        const event = String(s.state.selectedLog ?? '');
        const item = cfg.logs.events[event];
        if (!event || !item)
            throw new Error('Evento de log não selecionado');
        return [event, item];
    }
    selectedBypass(s, cfg) {
        const id = String(s.state.selectedBypass ?? '');
        const entry = cfg.bypasses.find(item => item.id === id);
        if (!entry)
            throw new Error('Bypass não selecionado');
        return entry;
    }
    defaultBypass(kind, targetId, creator) {
        return {
            id: `BP-${(0, ids_1.randomId)(4)}`,
            kind,
            targetId,
            modules: ['*'],
            behavior: { ignoreDetection: false, ignorePunishment: true, ignoreRestoration: true, ignoreLimit: true, continueLogging: true },
            reason: 'Adicionado pelo painel',
            createdBy: creator,
            createdAt: new Date().toISOString(),
            expiresAt: null
        };
    }
    toggleArray(list, id) {
        const index = list.indexOf(id);
        if (index >= 0)
            list.splice(index, 1);
        else
            list.push(id);
    }
    splitList(value, maximum) {
        return [...new Set(value.split(/[\n,;]/).map(item => item.trim()).filter(Boolean))].slice(0, maximum);
    }
    record(cfg, by, action, details) {
        cfg.history.push({ at: new Date().toISOString(), by, action, details });
        cfg.history = cfg.history.slice(-100);
    }
    recordAccess(cfg, by, action, target) {
        cfg.access.history.push({ at: new Date().toISOString(), by, action: `${action}:${target}` });
        cfg.access.history = cfg.access.history.slice(-100);
        this.record(cfg, by, action, target);
    }
    async saveAndRender(interaction, session, cfg) {
        await guildConfigStore_1.guildConfigStore.set(session.guildId, cfg);
        await this.rerender(interaction, session, cfg);
    }
    async ensureDeferredUpdate(interaction) {
        if (interaction.deferred || interaction.replied)
            return;
        await interaction.deferUpdate();
    }
    async ensureDeferredReply(interaction) {
        if (interaction.deferred || interaction.replied)
            return;
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    }
    async ensureModalDeferred(interaction) {
        if (interaction.deferred || interaction.replied)
            return;
        if (interaction.isFromMessage?.())
            await interaction.deferUpdate();
        else
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    }
    async recoverSession(interaction) {
        if (!interaction.guild || !interaction.guildId || !interaction.channelId || !interaction.member) {
            await this.privateReply(interaction, 'Não foi possível renovar este painel fora de um servidor.');
            return null;
        }
        const cfg = await guildConfigStore_1.guildConfigStore.get(interaction.guildId);
        const access = (0, accessManager_1.canAccessPanel)(interaction.member, interaction.channelId, this.app, cfg);
        if (!access.allowed) {
            await this.privateReply(interaction, `O painel não pôde ser renovado: ${access.reason}.`);
            return null;
        }
        const session = this.sessions.create(interaction.user.id, interaction.guildId, interaction.channelId, cfg.panel.sessionTimeoutSeconds);
        session.messageId = interaction.message?.id ?? null;
        session.page = 'home';
        session.state = {};
        return session;
    }
    async editPanelMessage(interaction, payload) {
        const fromMessage = Boolean(interaction.message && (interaction.isMessageComponent?.() || interaction.isFromMessage?.()));
        if (fromMessage && interaction.message?.editable !== false) {
            await interaction.message.edit(payload);
            return;
        }
        if (interaction.deferred || interaction.replied)
            await interaction.editReply(payload);
        else if (interaction.update)
            await interaction.update(payload);
        else
            throw new Error('Interação sem método de atualização.');
    }
    isDuplicateInteraction(id) {
        if (!id)
            return false;
        const now = Date.now();
        for (const [key, at] of this.processedInteractions)
            if (now - at > 60_000)
                this.processedInteractions.delete(key);
        if (this.processedInteractions.has(id))
            return true;
        this.processedInteractions.set(id, now);
        return false;
    }
    async privateReply(interaction, text) {
        const negative = /não|negad|inválid|erro|falh|expir|pertence a outro|permissão/i.test(text);
        const positive = /sucesso|processado|renovado|atualizado|conclu/i.test(text);
        const payload = (0, common_1.statusPayload)(negative ? 'Não foi possível concluir' : positive ? 'Operação concluída' : 'Informação', text, negative ? '#ED4245' : positive ? '#57F287' : '#5865F2');
        payload.flags = discord_js_1.MessageFlags.IsComponentsV2 | discord_js_1.MessageFlags.Ephemeral;
        if (interaction.replied || interaction.deferred)
            await interaction.followUp(payload).catch(() => undefined);
        else
            await interaction.reply(payload).catch(() => undefined);
    }
    async expireSessions() {
        this.sessions.cleanup();
    }
}
exports.PanelManager = PanelManager;
//# sourceMappingURL=panelManager.js.map