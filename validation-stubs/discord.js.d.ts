declare module 'discord.js' {
  class AnyBuilder {
    constructor(...args: any[]);
    addComponents(...args: any[]): this;
    addActionRowComponents(...args: any[]): this;
    addTextDisplayComponents(...args: any[]): this;
    addSeparatorComponents(...args: any[]): this;
    addSectionComponents(...args: any[]): this;
    addMediaGalleryComponents(...args: any[]): this;
    addItems(...args: any[]): this;
    addFields(...args: any[]): this;
    addLabelComponents(...args: any[]): this;
    setFileUploadComponent(...args: any[]): this;
    setTextInputComponent(...args: any[]): this;
    setChannelSelectMenuComponent(...args: any[]): this;
    setStringSelectMenuComponent(...args: any[]): this;
    setUserSelectMenuComponent(...args: any[]): this;
    setRoleSelectMenuComponent(...args: any[]): this;
    setButtonAccessory(...args: any[]): this;
    setAuthor(...args: any[]): this;
    setMinValues(...args: any[]): this;
    setMaxValues(...args: any[]): this;
    setMinLength(...args: any[]): this;
    addOptions(...args: any[]): this;
    setAccentColor(...args: any[]): this;
    setContent(...args: any[]): this;
    setSpacing(...args: any[]): this;
    setCustomId(...args: any[]): this;
    setLabel(...args: any[]): this;
    setEmoji(...args: any[]): this;
    setStyle(...args: any[]): this;
    setPlaceholder(...args: any[]): this;
    setDescription(...args: any[]): this;
    setValue(...args: any[]): this;
    setURL(...args: any[]): this;
    setThumbnailAccessory(...args: any[]): this;
    setChannelTypes(...args: any[]): this;
    setTitle(...args: any[]): this;
    setRequired(...args: any[]): this;
    setDisabled(...args: any[]): this;
    setDefault(...args: any[]): this;
    setMaxLength(...args: any[]): this;
    setImage(...args: any[]): this;
    setThumbnail(...args: any[]): this;
    setFooter(...args: any[]): this;
    setColor(...args: any[]): this;
    setTimestamp(...args: any[]): this;
  }
  export class Client {
    constructor(...args: any[]);
    on(event: any, listener: (...args: any[]) => any): this;
    once(event: any, listener: (...args: any[]) => any): this;
    login(token: string): Promise<any>;
    destroy(): void;
    user: any; ws: any; guilds: any; channels: any;
  }
  export const GatewayIntentBits:any; export const Partials:any; export const Events:any; export const ActivityType:any;
  export const PermissionFlagsBits:any; export const AuditLogEvent:any; export const ChannelType:any; export class PermissionsBitField { constructor(...args:any[]) }
  export const MessageFlags:any; export const ButtonStyle:any; export const TextInputStyle:any; export const SeparatorSpacingSize:any;
  export class AttachmentBuilder { constructor(...args:any[]) }
  export class EmbedBuilder extends AnyBuilder {}
  export class ActionRowBuilder<T=any> extends AnyBuilder {}
  export class ButtonBuilder extends AnyBuilder {}
  export class ContainerBuilder extends AnyBuilder {}
  export class SeparatorBuilder extends AnyBuilder {}
  export class TextDisplayBuilder extends AnyBuilder {}
  export class SectionBuilder extends AnyBuilder {}
  export class ThumbnailBuilder extends AnyBuilder {}
  export class MediaGalleryBuilder extends AnyBuilder {}
  export class MediaGalleryItemBuilder extends AnyBuilder {}
  export class FileUploadBuilder extends AnyBuilder {}
  export class LabelBuilder extends AnyBuilder {}
  export class StringSelectMenuBuilder extends AnyBuilder {}
  export class StringSelectMenuOptionBuilder extends AnyBuilder {}
  export class ChannelSelectMenuBuilder extends AnyBuilder {}
  export class RoleSelectMenuBuilder extends AnyBuilder {}
  export class UserSelectMenuBuilder extends AnyBuilder {}
  export class ModalBuilder extends AnyBuilder {}
  export class TextInputBuilder extends AnyBuilder {}
  export type ButtonInteraction=any; export type ChannelSelectMenuInteraction=any; export type RoleSelectMenuInteraction=any; export type StringSelectMenuInteraction=any; export type UserSelectMenuInteraction=any; export type ModalSubmitInteraction=any;
}
