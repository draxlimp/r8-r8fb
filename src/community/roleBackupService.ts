import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { UI_EMOJIS } from '../ui/emojis';
import type { GuildConfig, RoleBackupRecord } from '../types/guildConfig';
import { guildConfigStore } from '../storage/guildConfigStore';
import { randomId } from '../utils/ids';

export class RoleBackupService {
  async create(guild: any, actorId: string, config?: GuildConfig): Promise<RoleBackupRecord> {
    const current = config ?? await guildConfigStore.get(guild.id);
    const roles = [...guild.roles.cache.values()]
      .filter((role: any) => role.id !== guild.id && !role.managed)
      .sort((a: any, b: any) => a.position - b.position)
      .map((role: any) => ({
        originalId: role.id,
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        position: role.position,
        permissions: role.permissions.bitfield.toString(),
        mentionable: role.mentionable,
        unicodeEmoji: role.unicodeEmoji ?? null
      }));
    const backup: RoleBackupRecord = {
      id: `ROLE-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${randomId(3)}`,
      createdBy: actorId,
      createdAt: new Date().toISOString(),
      roles
    };
    current.community.roleBackups.push(backup);
    current.community.roleBackups = current.community.roleBackups.slice(-10);
    await guildConfigStore.set(guild.id, current);
    return backup;
  }

  async restoreLatest(guild: any, actorId: string, config?: GuildConfig): Promise<{ backup: RoleBackupRecord; created: number; updated: number; failed: number }> {
    const current = config ?? await guildConfigStore.get(guild.id);
    const backup = current.community.roleBackups.at(-1);
    if (!backup) throw new Error('Nenhum backup de cargos foi criado');
    const botMember = guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) throw new Error('O bot precisa da permissão Gerenciar Cargos');

    let created = 0;
    let updated = 0;
    let failed = 0;
    const restored: Array<{ role: any; position: number }> = [];
    for (const snapshot of backup.roles) {
      try {
        let role = guild.roles.cache.get(snapshot.originalId);
        if (role && role.editable) {
          await role.edit({
            name: snapshot.name,
            colors: { primaryColor: snapshot.color },
            hoist: snapshot.hoist,
            permissions: BigInt(snapshot.permissions),
            mentionable: snapshot.mentionable,
            unicodeEmoji: snapshot.unicodeEmoji
          }, `Restauração de backup ${backup.id} por ${actorId}`);
          updated += 1;
        } else if (!role) {
          role = await guild.roles.create({
            name: snapshot.name,
            colors: { primaryColor: snapshot.color },
            hoist: snapshot.hoist,
            permissions: BigInt(snapshot.permissions),
            mentionable: snapshot.mentionable,
            unicodeEmoji: snapshot.unicodeEmoji,
            reason: `Restauração de backup ${backup.id} por ${actorId}`
          });
          created += 1;
        } else {
          failed += 1;
          continue;
        }
        restored.push({ role, position: snapshot.position });
      } catch {
        failed += 1;
      }
    }

    const maximumPosition = Math.max(1, botMember.roles.highest.position - 1);
    for (const item of restored.sort((a, b) => a.position - b.position)) {
      await item.role.setPosition(Math.min(item.position, maximumPosition), { reason: `Posição restaurada pelo backup ${backup.id}` }).catch(() => undefined);
    }
    return { backup, created, updated, failed };
  }

  commandPayload(userId: string, config: GuildConfig): any {
    const latest = config.community.roleBackups.at(-1);
    const embed = new EmbedBuilder()
      .setTitle('Backup e restauração de cargos')
      .setDescription(latest
        ? `Último backup: **${latest.id}**\nCargos registrados: **${latest.roles.length}**\nCriado: <t:${Math.floor(Date.parse(latest.createdAt) / 1000)}:R>`
        : 'Nenhum backup de cargos foi criado neste servidor.')
      .setColor(0x111111)
      .setTimestamp();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`rolebackup|${userId}|create`).setLabel('Criar backup').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rolebackup|${userId}|restore`).setLabel('Restaurar último').setStyle(ButtonStyle.Danger).setDisabled(!latest),
      new ButtonBuilder().setCustomId(`rolebackup|${userId}|close`).setEmoji(UI_EMOJIS.close).setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
  }

  async handleInteraction(interaction: any): Promise<boolean> {
    const customId = typeof interaction.customId === 'string' ? interaction.customId : '';
    if (!customId.startsWith('rolebackup|')) return false;
    const [, ownerId, action] = customId.split('|');
    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: 'Este painel pertence a outro usuário.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (!interaction.guild || !interaction.member?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: 'Você precisa da permissão Gerenciar Cargos.', flags: MessageFlags.Ephemeral });
      return true;
    }
    if (action === 'close') {
      await interaction.update({ components: [] });
      return true;
    }
    await interaction.deferUpdate();
    const config = await guildConfigStore.get(interaction.guild.id);
    if (action === 'create') await this.create(interaction.guild, interaction.user.id, config);
    else if (action === 'restore') await this.restoreLatest(interaction.guild, interaction.user.id, config);
    else return false;
    const refreshed = await guildConfigStore.get(interaction.guild.id);
    await interaction.editReply(this.commandPayload(interaction.user.id, refreshed));
    return true;
  }
}
