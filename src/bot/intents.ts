import { GatewayIntentBits, Partials } from 'discord.js';
export const intents=[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildModeration,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildVoiceStates,GatewayIntentBits.GuildWebhooks,GatewayIntentBits.GuildIntegrations,GatewayIntentBits.GuildInvites];
export const partials=[Partials.Channel,Partials.Message,Partials.GuildMember,Partials.User];
