import { ChannelType, PermissionFlagsBits } from 'discord.js';

const ASSET_CHANNEL_NAME = 'r8-assets';
const ASSET_CHANNEL_TOPIC = 'Armazenamento interno de imagens da comunidade';

export async function persistUploadedImage(interaction: any, attachment: any): Promise<string> {
  const guild = interaction.guild;
  const botUser = interaction.client?.user;
  if (!guild || !botUser) throw new Error('Servidor ou usuário do bot indisponível para armazenar a imagem');
  if (!attachment?.url) throw new Error('O arquivo enviado não possui uma URL válida');

  let channel = guild.channels.cache.find((item: any) =>
    item.type === ChannelType.GuildText && item.name === ASSET_CHANNEL_NAME && item.topic === ASSET_CHANNEL_TOPIC
  );

  if (!channel) {
    try {
      channel = await guild.channels.create({
        name: ASSET_CHANNEL_NAME,
        type: ChannelType.GuildText,
        topic: ASSET_CHANNEL_TOPIC,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: botUser.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages
            ]
          }
        ],
        reason: 'Canal privado para armazenar imagens configuradas pela comunidade'
      });
    } catch {
      throw new Error('Não foi possível criar o canal privado r8-assets. Conceda Gerenciar Canais, Enviar Mensagens e Anexar Arquivos ao bot');
    }
  }

  if (!channel?.isTextBased?.() || typeof channel.send !== 'function') throw new Error('O canal privado de imagens não é válido');
  const filename = sanitizeFilename(attachment.name ?? attachment.filename ?? `r8-${Date.now()}.png`);
  const message = await channel.send({
    content: `Arquivo interno do painel enviado por <@${interaction.user.id}>.`,
    files: [{ attachment: attachment.url, name: filename }],
    allowedMentions: { parse: [] }
  }).catch(() => null);
  const stored = message?.attachments?.first?.();
  if (!stored?.url) throw new Error('Não foi possível persistir a imagem no canal privado r8-assets');
  return stored.url;
}

function sanitizeFilename(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
  return cleaned || `r8-${Date.now()}.png`;
}
