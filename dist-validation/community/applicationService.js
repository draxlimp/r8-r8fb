"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationService = void 0;
const discord_js_1 = require("discord.js");
const guildConfigStore_1 = require("../storage/guildConfigStore");
const ids_1 = require("../utils/ids");
const communityLogger_1 = require("./communityLogger");
class ApplicationService {
    async handleInteraction(interaction) {
        if (!interaction.customId?.startsWith('form|') || !interaction.guild)
            return false;
        const [, action, id] = String(interaction.customId).split('|');
        if (!action || !id)
            return false;
        if (interaction.isButton?.()) {
            if (action === 'open')
                await this.showForm(interaction, id);
            else if (action === 'approve')
                await this.review(interaction, id, 'approved');
            else if (action === 'reject')
                await this.showRejectModal(interaction, id);
            else
                return false;
            return true;
        }
        if (interaction.isModalSubmit?.()) {
            if (action === 'submit')
                await this.submit(interaction, id);
            else if (action === 'rejectsubmit')
                await this.review(interaction, id, 'rejected', interaction.fields.getTextInputValue('reason').trim());
            else
                return false;
            return true;
        }
        return false;
    }
    async publishForm(guild, form) {
        if (!form.publishChannelId)
            throw new Error('Selecione o canal de publicação do formulário.');
        if (!form.reviewChannelId)
            throw new Error('Selecione o canal de revisão do formulário.');
        if (!form.questions.length)
            throw new Error('Adicione ao menos uma pergunta ao formulário.');
        const channel = await guild.channels.fetch(form.publishChannelId);
        if (!channel?.isTextBased?.() || !('send' in channel))
            throw new Error('Canal de publicação inválido.');
        if (form.publishMessageId) {
            const previous = await channel.messages.fetch(form.publishMessageId).catch(() => null);
            if (previous)
                await previous.delete().catch(() => undefined);
        }
        const message = await channel.send({
            embeds: [new discord_js_1.EmbedBuilder().setTitle(form.title.slice(0, 256)).setDescription(form.description.slice(0, 4096)).setColor(normalizeColor(form.color))],
            components: [new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`form|open|${form.id}`).setLabel(form.buttonLabel.slice(0, 80)).setStyle(discord_js_1.ButtonStyle.Primary))],
            allowedMentions: { parse: [] }
        });
        return { channelId: channel.id, messageId: message.id };
    }
    async showForm(interaction, formId) {
        const config = await guildConfigStore_1.guildConfigStore.get(interaction.guild.id);
        const form = config.community.forms.forms.find(item => item.id === formId);
        if (!form?.enabled)
            throw new Error('Este formulário está desativado.');
        if (form.blockedRoleIds.some(roleId => interaction.member.roles.cache.has(roleId)))
            throw new Error('Você não pode enviar este formulário.');
        if (form.allowedRoleIds.length && !form.allowedRoleIds.some(roleId => interaction.member.roles.cache.has(roleId)))
            throw new Error('Você não possui o cargo necessário para enviar este formulário.');
        if (!form.questions.length)
            throw new Error('Este formulário ainda não possui perguntas.');
        const modal = new discord_js_1.ModalBuilder().setCustomId(`form|submit|${form.id}`).setTitle(form.name.slice(0, 45));
        for (const question of form.questions.slice(0, 5)) {
            modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
                .setCustomId(`q_${question.id}`)
                .setLabel(question.label.slice(0, 45))
                .setPlaceholder(question.placeholder.slice(0, 100))
                .setRequired(question.required)
                .setStyle(question.paragraph ? discord_js_1.TextInputStyle.Paragraph : discord_js_1.TextInputStyle.Short)
                .setMaxLength(question.paragraph ? 1500 : 300)));
        }
        await interaction.showModal(modal);
    }
    async submit(interaction, formId) {
        const config = await guildConfigStore_1.guildConfigStore.get(interaction.guild.id);
        const form = config.community.forms.forms.find(item => item.id === formId);
        if (!form?.enabled || !form.reviewChannelId)
            throw new Error('Este formulário não está disponível.');
        const reviewChannel = await interaction.guild.channels.fetch(form.reviewChannelId);
        if (!reviewChannel?.isTextBased?.() || !('send' in reviewChannel))
            throw new Error('O canal de revisão não está disponível.');
        const answers = {};
        for (const question of form.questions.slice(0, 5))
            answers[question.id] = interaction.fields.getTextInputValue(`q_${question.id}`).trim();
        const submissionId = `FORM-${(0, ids_1.randomId)(8)}`;
        const submission = {
            id: submissionId,
            formId,
            userId: interaction.user.id,
            answers,
            status: 'pending',
            reviewerId: null,
            reviewReason: null,
            reviewChannelId: reviewChannel.id,
            reviewMessageId: null,
            createdAt: new Date().toISOString(),
            reviewedAt: null
        };
        const answerText = form.questions.map(question => `**${question.label}:**\n${answers[question.id] || 'Não informado'}`).join('\n\n');
        const reviewMessage = await reviewChannel.send({
            embeds: [new discord_js_1.EmbedBuilder()
                    .setTitle(`${form.name} — ${submissionId}`.slice(0, 256))
                    .setDescription(`Usuário: <@${interaction.user.id}>\nID: ${interaction.user.id}\n\n${answerText}`.slice(0, 4096))
                    .setColor(0x111111)
                    .setFooter({ text: 'Status: pendente' })
                    .setTimestamp()],
            components: [new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`form|approve|${submissionId}`).setLabel('Aprovar').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId(`form|reject|${submissionId}`).setLabel('Recusar').setStyle(discord_js_1.ButtonStyle.Danger))],
            allowedMentions: { users: [interaction.user.id] }
        });
        submission.reviewMessageId = reviewMessage.id;
        config.community.forms.submissions[submissionId] = submission;
        const all = Object.values(config.community.forms.submissions).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        config.community.forms.submissions = Object.fromEntries(all.slice(0, 500).map(item => [item.id, item]));
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        await interaction.reply({ content: `Formulário enviado com sucesso. Protocolo: **${submissionId}**.`, flags: discord_js_1.MessageFlags.Ephemeral });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: 'form_submitted', module: 'community_forms', executorId: interaction.user.id, targetId: submissionId, channelId: reviewChannel.id, details: { formId } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    async showRejectModal(interaction, submissionId) {
        this.assertReviewer(interaction.member);
        await interaction.showModal(new discord_js_1.ModalBuilder().setCustomId(`form|rejectsubmit|${submissionId}`).setTitle('Recusar formulário').addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder().setCustomId('reason').setLabel('Motivo da recusa').setStyle(discord_js_1.TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000))));
    }
    async review(interaction, submissionId, status, reason = '') {
        this.assertReviewer(interaction.member);
        const config = await guildConfigStore_1.guildConfigStore.get(interaction.guild.id);
        const submission = config.community.forms.submissions[submissionId];
        if (!submission || submission.status !== 'pending')
            throw new Error('Esta inscrição já foi analisada ou não existe.');
        const form = config.community.forms.forms.find(item => item.id === submission.formId);
        if (!form)
            throw new Error('A configuração deste formulário não existe mais.');
        submission.status = status;
        submission.reviewerId = interaction.user.id;
        submission.reviewReason = reason || null;
        submission.reviewedAt = new Date().toISOString();
        if (status === 'approved' && form.approvedRoleIds.length) {
            const member = await interaction.guild.members.fetch(submission.userId).catch(() => null);
            const roleIds = form.approvedRoleIds.filter(roleId => interaction.guild.roles.cache.get(roleId)?.editable);
            if (member && roleIds.length)
                await member.roles.add(roleIds, `Formulário ${submission.id} aprovado`).catch(() => undefined);
        }
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
        const reviewChannel = submission.reviewChannelId ? await interaction.guild.channels.fetch(submission.reviewChannelId).catch(() => null) : null;
        const reviewMessage = reviewChannel?.isTextBased?.() && submission.reviewMessageId ? await reviewChannel.messages.fetch(submission.reviewMessageId).catch(() => null) : null;
        if (reviewMessage) {
            const original = reviewMessage.embeds?.[0];
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(String(original?.title ?? `Formulário ${submission.id}`).slice(0, 256))
                .setDescription(String(original?.description ?? '').slice(0, 4096))
                .setColor(status === 'approved' ? 0x2ecc71 : 0xe74c3c)
                .setFooter({ text: `Status: ${status === 'approved' ? 'aprovado' : 'recusado'} por ${interaction.user.tag}` });
            if (reason)
                embed.addFields({ name: 'Motivo', value: reason.slice(0, 1024) });
            await reviewMessage.edit({ embeds: [embed], components: [] }).catch(() => undefined);
        }
        const user = await interaction.client.users.fetch(submission.userId).catch(() => null);
        if (user)
            await user.send(`Seu formulário **${form.name}** (${submission.id}) foi **${status === 'approved' ? 'aprovado' : 'recusado'}**.${reason ? `\nMotivo: ${reason}` : ''}`).catch(() => undefined);
        if (interaction.deferred || interaction.replied)
            await interaction.followUp({ content: `Formulário ${status === 'approved' ? 'aprovado' : 'recusado'}.`, flags: discord_js_1.MessageFlags.Ephemeral });
        else
            await interaction.reply({ content: `Formulário ${status === 'approved' ? 'aprovado' : 'recusado'}.`, flags: discord_js_1.MessageFlags.Ephemeral });
        await (0, communityLogger_1.logCommunityEvent)({ guild: interaction.guild, config, event: status === 'approved' ? 'form_approved' : 'form_rejected', module: 'community_forms', executorId: interaction.user.id, targetId: submission.userId, channelId: submission.reviewChannelId, details: { submissionId, formId: form.id, reason } });
        await guildConfigStore_1.guildConfigStore.set(interaction.guild.id, config);
    }
    assertReviewer(member) {
        if (!member.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild) && !member.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles))
            throw new Error('Você não possui permissão para analisar formulários.');
    }
}
exports.ApplicationService = ApplicationService;
function normalizeColor(value) {
    const clean = value.replace('#', '');
    return /^[0-9a-f]{6}$/i.test(clean) ? Number.parseInt(clean, 16) : 0x111111;
}
//# sourceMappingURL=applicationService.js.map