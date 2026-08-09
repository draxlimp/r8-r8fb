"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_PLACEHOLDERS = void 0;
exports.renderTicketTemplate = renderTicketTemplate;
function renderTicketTemplate(input, context) {
    const user = context.user;
    const userName = user?.username ?? user?.displayName ?? 'usuário';
    const displayName = user?.displayName ?? user?.globalName ?? userName;
    const userMention = user?.id ? `<@${user.id}>` : 'usuário que abrir o ticket';
    const avatar = typeof user?.displayAvatarURL === 'function' ? user.displayAvatarURL({ size: 1024 }) : '';
    const guildIcon = typeof context.guild?.iconURL === 'function' ? context.guild.iconURL({ size: 1024 }) ?? '' : '';
    const owner = context.owner?.id ? `<@${context.owner.id}>` : userMention;
    const channelMention = context.channel?.id ? `<#${context.channel.id}>` : 'canal ainda não criado';
    const timestamp = Math.floor((context.createdAt ?? new Date()).getTime() / 1000);
    const date = new Date(context.createdAt ?? new Date());
    const ticketNumber = String(context.ticketNumber ?? context.ticketId ?? 'prévia');
    const staff = context.staff?.id ? `<@${context.staff.id}>` : 'não assumido';
    const values = {
        '[user]': userMention,
        '[user.mention]': userMention,
        '[user_mention]': userMention,
        '[user.id]': user?.id ?? '',
        '[user_id]': user?.id ?? '',
        '[user.name]': userName,
        '[user_name]': userName,
        '[username]': userName,
        '[user.username]': userName,
        '[user.display_name]': displayName,
        '[user_display_name]': displayName,
        '[display_name]': displayName,
        '[user.avatar]': avatar,
        '[guild]': context.guild.name,
        '[guild.name]': context.guild.name,
        '[guild_name]': context.guild.name,
        '[guild.id]': context.guild.id,
        '[guild_id]': context.guild.id,
        '[guild.icon]': guildIcon,
        '[guild.member_count]': String(context.guild.memberCount ?? context.guild.members?.cache?.size ?? 0),
        '[server]': context.guild.name,
        '[server_name]': context.guild.name,
        '[server_id]': context.guild.id,
        '[member_count]': String(context.guild.memberCount ?? context.guild.members?.cache?.size ?? 0),
        '[channel]': channelMention,
        '[channel.mention]': channelMention,
        '[channel.name]': context.channel?.name ?? 'canal ainda não criado',
        '[channel.id]': context.channel?.id ?? '',
        '[ticket_channel]': channelMention,
        '[channel_id]': context.channel?.id ?? '',
        '[ticket]': context.ticketId ?? ticketNumber,
        '[ticket.id]': context.ticketId ?? '',
        '[ticket_id]': context.ticketId ?? '',
        '[ticket.number]': ticketNumber,
        '[ticket.owner]': owner,
        '[ticket.reason]': context.reason ?? 'não informado',
        '[ticket.priority]': context.priority ?? 'normal',
        '[ticket.created_at]': `<t:${timestamp}:F>`,
        '[ticket.created_relative]': `<t:${timestamp}:R>`,
        '[panel]': context.panel.name,
        '[panel.name]': context.panel.name,
        '[panel.id]': context.panel.id,
        '[panel_id]': context.panel.id,
        '[owner]': owner,
        '[ticket_owner]': owner,
        '[staff]': staff,
        '[staff.mention]': staff,
        '[staff.name]': context.staff?.displayName ?? context.staff?.user?.username ?? 'não assumido',
        '[staff.id]': context.staff?.id ?? '',
        '[created_at]': `<t:${timestamp}:F>`,
        '[created_relative]': `<t:${timestamp}:R>`,
        '[date]': date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        '[time]': date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
        '[datetime]': date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    };
    let output = input;
    for (const [placeholder, value] of Object.entries(values))
        output = output.split(placeholder).join(value);
    return output;
}
exports.TICKET_PLACEHOLDERS = [
    '[user]', '[user.mention]', '[user.id]', '[user.name]', '[user.username]', '[user.display_name]', '[user.avatar]',
    '[guild]', '[guild.name]', '[guild.id]', '[guild.icon]', '[guild.member_count]',
    '[channel]', '[channel.mention]', '[channel.name]', '[channel.id]',
    '[ticket]', '[ticket.id]', '[ticket.number]', '[ticket.owner]', '[ticket.reason]', '[ticket.priority]', '[ticket.created_at]', '[ticket.created_relative]',
    '[panel]', '[panel.name]', '[panel.id]', '[staff]', '[staff.mention]', '[staff.name]', '[staff.id]', '[date]', '[time]', '[datetime]'
];
//# sourceMappingURL=templateRenderer.js.map