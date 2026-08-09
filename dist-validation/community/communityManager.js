"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunityManager = void 0;
const clService_1 = require("./clService");
const roleService_1 = require("./roleService");
const ticketService_1 = require("../tickets/ticketService");
const commandManager_1 = require("../commands/commandManager");
const messageService_1 = require("./messageService");
const temporaryVoiceService_1 = require("./temporaryVoiceService");
const rolePanelService_1 = require("./rolePanelService");
const applicationService_1 = require("./applicationService");
const telloynService_1 = require("./telloynService");
const instagramService_1 = require("./instagramService");
const activityService_1 = require("./activityService");
const roleBackupService_1 = require("./roleBackupService");
const twitterService_1 = require("./twitterService");
const autoCleanService_1 = require("./autoCleanService");
const moderationTracker_1 = require("./moderationTracker");
class CommunityManager {
    client;
    app;
    tickets;
    commands;
    rolePanels;
    forms;
    telloyn;
    instagram;
    activity;
    roleBackups;
    twitter;
    autoClean;
    moderationTracker;
    constructor(client, app) {
        this.client = client;
        this.app = app;
        this.tickets = new ticketService_1.TicketService(app);
        this.activity = new activityService_1.ActivityService();
        this.roleBackups = new roleBackupService_1.RoleBackupService();
        this.commands = new commandManager_1.CommandManager(app, this.tickets, this.activity, this.roleBackups);
        this.rolePanels = new rolePanelService_1.RolePanelService();
        this.forms = new applicationService_1.ApplicationService();
        this.telloyn = new telloynService_1.TelloynService();
        this.instagram = new instagramService_1.InstagramService();
        this.twitter = new twitterService_1.TwitterService();
        this.autoClean = new autoCleanService_1.AutoCleanService();
        this.moderationTracker = new moderationTracker_1.ModerationTracker();
    }
    async handleMessage(message) {
        await this.tickets.trackMessage(message);
        if (await this.instagram.handleMessage(message))
            return true;
        if (await this.twitter.handleMessage(message))
            return true;
        await this.autoClean.handleMessage(message);
        if (await (0, clService_1.handleClearCommand)(message, this.app))
            return true;
        return this.commands.handleMessage(message);
    }
    async handleInteraction(interaction) {
        if (await this.tickets.handleInteraction(interaction))
            return true;
        if (await this.rolePanels.handleInteraction(interaction))
            return true;
        if (await this.forms.handleInteraction(interaction))
            return true;
        if (await this.telloyn.handleInteraction(interaction))
            return true;
        if (await this.instagram.handleInteraction(interaction))
            return true;
        if (await this.roleBackups.handleInteraction(interaction))
            return true;
        return this.commands.handleInteraction(interaction);
    }
    async handleMemberAdd(member) {
        await this.activity.handleMemberAdd(member);
        await (0, roleService_1.applyAutoroles)(member);
        await (0, messageService_1.sendWelcome)(member);
    }
    async handleMemberRemove(member) {
        await (0, messageService_1.sendGoodbye)(member);
    }
    async handleGuildBanAdd(ban) { await this.moderationTracker.handleBanAdd(ban); }
    async handleGuildBanRemove(ban) { await this.moderationTracker.handleBanRemove(ban); }
    async handleModerationMemberUpdate(oldMember, newMember) { await this.moderationTracker.handleMemberUpdate(oldMember, newMember); }
    async handleVoiceStateUpdate(oldState, newState) {
        await this.activity.handleVoiceStateUpdate(oldState, newState);
        await (0, temporaryVoiceService_1.handleTemporaryVoice)(oldState, newState);
    }
    async initializeGuild(guild) {
        await this.activity.initializeGuild(guild);
    }
    async maintainGuild(guild) {
        await this.tickets.maintainGuild(guild);
        await this.activity.maintainTemporaryActions(guild);
    }
    async refreshFastGuild(guild) {
        await this.activity.refreshVoiceBoard(guild);
    }
    async publishTicketPanel(guild, panel) {
        return this.tickets.publishPanel(guild, panel);
    }
    async publishRolePanel(guild, panel) {
        return this.rolePanels.publishPanel(guild, panel);
    }
    async publishApplicationForm(guild, form) {
        return this.forms.publishForm(guild, form);
    }
    async publishTelloynPanel(guild, config) {
        return this.telloyn.publishPanel(guild, config);
    }
    async createRoleBackup(guild, actorId, config) { return this.roleBackups.create(guild, actorId, config); }
    async restoreLatestRoleBackup(guild, actorId, config) { return this.roleBackups.restoreLatest(guild, actorId, config); }
    async runMassRoleOperation(input) {
        return (0, roleService_1.executeMassRoleOperation)(input);
    }
}
exports.CommunityManager = CommunityManager;
//# sourceMappingURL=communityManager.js.map