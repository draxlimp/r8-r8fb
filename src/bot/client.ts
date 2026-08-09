import { Client } from 'discord.js';import{intents,partials}from'./intents';export function createClient():Client{return new Client({intents,partials,allowedMentions:{parse:[]}});}
