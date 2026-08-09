"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMUNITY_PLACEHOLDERS = void 0;
exports.renderCommunityTemplate = renderCommunityTemplate;
function renderCommunityTemplate(input, context) {
    const user = context.user;
    const member = context.member;
    const guild = context.guild;
    const now = context.leftAt ?? new Date();
    const joinedAt = context.joinedAt ?? member?.joinedAt ?? null;
    const stay = joinedAt ? humanDuration(Math.max(0, now.getTime() - joinedAt.getTime())) : 'tempo desconhecido';
    const avatar = typeof user?.displayAvatarURL === 'function' ? user.displayAvatarURL({ size: 1024 }) : '';
    const guildIcon = typeof guild?.iconURL === 'function' ? guild.iconURL({ size: 1024 }) ?? '' : '';
    const createdTimestamp = user?.createdTimestamp ? Math.floor(user.createdTimestamp / 1000) : 0;
    const joinedTimestamp = joinedAt ? Math.floor(joinedAt.getTime() / 1000) : 0;
    const values = {
        '[user]': user?.id ? `<@${user.id}>` : 'usuário',
        '[user.mention]': user?.id ? `<@${user.id}>` : 'usuário',
        '[user.id]': user?.id ?? '',
        '[user.name]': user?.username ?? member?.displayName ?? 'usuário',
        '[user.username]': user?.username ?? 'usuário',
        '[user.display_name]': member?.displayName ?? user?.globalName ?? user?.username ?? 'usuário',
        '[user.avatar]': avatar,
        '[user.created_at]': createdTimestamp ? `<t:${createdTimestamp}:F>` : 'desconhecido',
        '[user.created_relative]': createdTimestamp ? `<t:${createdTimestamp}:R>` : 'desconhecido',
        '[guild]': guild?.name ?? 'servidor',
        '[guild.name]': guild?.name ?? 'servidor',
        '[guild.id]': guild?.id ?? '',
        '[guild.icon]': guildIcon,
        '[guild.member_count]': String(guild?.memberCount ?? guild?.members?.cache?.size ?? 0),
        '[channel]': context.channel?.id ? `<#${context.channel.id}>` : '',
        '[channel.name]': context.channel?.name ?? '',
        '[member.joined_at]': joinedTimestamp ? `<t:${joinedTimestamp}:F>` : 'desconhecido',
        '[member.joined_relative]': joinedTimestamp ? `<t:${joinedTimestamp}:R>` : 'desconhecido',
        '[member.stay]': stay,
        '[date]': now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        '[time]': now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
        '[datetime]': now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    };
    let output = input;
    for (const [placeholder, value] of Object.entries(values))
        output = output.split(placeholder).join(value);
    return output;
}
exports.COMMUNITY_PLACEHOLDERS = [
    '[user]', '[user.mention]', '[user.id]', '[user.name]', '[user.username]', '[user.display_name]', '[user.avatar]', '[user.created_at]', '[user.created_relative]',
    '[guild]', '[guild.name]', '[guild.id]', '[guild.icon]', '[guild.member_count]',
    '[channel]', '[channel.name]', '[member.joined_at]', '[member.joined_relative]', '[member.stay]', '[date]', '[time]', '[datetime]'
];
function humanDuration(ms) {
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (days)
        return `${days} dia${days === 1 ? '' : 's'} e ${hours} hora${hours === 1 ? '' : 's'}`;
    if (hours)
        return `${hours} hora${hours === 1 ? '' : 's'} e ${minutes} minuto${minutes === 1 ? '' : 's'}`;
    return `${Math.max(1, minutes)} minuto${minutes === 1 ? '' : 's'}`;
}
//# sourceMappingURL=templateRenderer.js.map