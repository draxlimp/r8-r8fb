"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistUploadedImage = persistUploadedImage;
const discord_js_1 = require("discord.js");
const ASSET_CHANNEL_NAME = 'r8-assets';
const ASSET_CHANNEL_TOPIC = 'Armazenamento interno de imagens da comunidade';
async function persistUploadedImage(interaction, attachment) {
    const guild = interaction.guild;
    const botUser = interaction.client?.user;
    if (!guild || !botUser)
        throw new Error('Servidor ou usuário do bot indisponível para armazenar a imagem');
    if (!attachment?.url)
        throw new Error('O arquivo enviado não possui uma URL válida');
    let channel = guild.channels.cache.find((item) => item.type === discord_js_1.ChannelType.GuildText && item.name === ASSET_CHANNEL_NAME && item.topic === ASSET_CHANNEL_TOPIC);
    if (!channel) {
        try {
            channel = await guild.channels.create({
                name: ASSET_CHANNEL_NAME,
                type: discord_js_1.ChannelType.GuildText,
                topic: ASSET_CHANNEL_TOPIC,
                permissionOverwrites: [
                    { id: guild.id, deny: [discord_js_1.PermissionFlagsBits.ViewChannel] },
                    {
                        id: botUser.id,
                        allow: [
                            discord_js_1.PermissionFlagsBits.ViewChannel,
                            discord_js_1.PermissionFlagsBits.SendMessages,
                            discord_js_1.PermissionFlagsBits.AttachFiles,
                            discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                            discord_js_1.PermissionFlagsBits.ManageMessages
                        ]
                    }
                ],
                reason: 'Canal privado para armazenar imagens configuradas pela comunidade'
            });
        }
        catch {
            throw new Error('Não foi possível criar o canal privado r8-assets. Conceda Gerenciar Canais, Enviar Mensagens e Anexar Arquivos ao bot');
        }
    }
    if (!channel?.isTextBased?.() || typeof channel.send !== 'function')
        throw new Error('O canal privado de imagens não é válido');
    const filename = sanitizeFilename(attachment.name ?? attachment.filename ?? `r8-${Date.now()}.png`);
    const message = await channel.send({
        content: `Arquivo interno do painel enviado por <@${interaction.user.id}>.`,
        files: [{ attachment: attachment.url, name: filename }],
        allowedMentions: { parse: [] }
    }).catch(() => null);
    const stored = message?.attachments?.first?.();
    if (!stored?.url)
        throw new Error('Não foi possível persistir a imagem no canal privado r8-assets');
    return stored.url;
}
function sanitizeFilename(value) {
    const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
    return cleaned || `r8-${Date.now()}.png`;
}
//# sourceMappingURL=assetService.js.map