"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_PLACEHOLDERS = exports.COMMUNITY_PLACEHOLDERS = void 0;
exports.communityPage = communityPage;
const discord_js_1 = require("discord.js");
const common_1 = require("../components/common");
const appearancePreview_1 = require("../components/appearancePreview");
const templateRenderer_1 = require("../../community/templateRenderer");
Object.defineProperty(exports, "COMMUNITY_PLACEHOLDERS", { enumerable: true, get: function () { return templateRenderer_1.COMMUNITY_PLACEHOLDERS; } });
const templateRenderer_2 = require("../../tickets/templateRenderer");
Object.defineProperty(exports, "TICKET_PLACEHOLDERS", { enumerable: true, get: function () { return templateRenderer_2.TICKET_PLACEHOLDERS; } });
const emojis_1 = require("../../ui/emojis");
function communityPage(session, ids, config, user, guild) {
    const section = String(session.state.communitySection ?? 'overview');
    if (section === 'tickets')
        return renderTickets(session, ids, config, user, guild);
    if (section === 'welcome')
        return renderCommunityMessage(session, ids, config, user, guild, 'welcome');
    if (section === 'goodbye')
        return renderCommunityMessage(session, ids, config, user, guild, 'goodbye');
    if (section === 'rolepanels')
        return renderRolePanels(session, ids, config, guild);
    if (section === 'forms')
        return renderForms(session, ids, config, guild);
    if (section === 'telloyn')
        return renderTelloyn(session, ids, config, user, guild);
    if (section === 'instagram')
        return renderInstagram(session, ids, config, user, guild);
    if (section === 'twitter')
        return renderTwitter(session, ids, config, user, guild);
    if (section === 'autoclean')
        return renderAutoClean(session, ids, config);
    if (['service', 'messages', 'fun', 'roles', 'utilities'].includes(section))
        return renderCategory(session, ids, config, section);
    const inlineMeta = {
        cl: ['Limpeza CL', 'Automação e utilidades / Limpeza manual'],
        autorole: ['Autorole', 'Cargos / Distribuição automática'],
        massroles: ['Cargos em massa', 'Cargos / Operações em lote'],
        suggestions: ['Sugestões', 'Comunicação / Sugestões da comunidade'],
        voice: ['Salas temporárias', 'Diversão e social / Calls temporárias'],
        rolebackup: ['Backup de cargos', 'Cargos / Backup e restauração'],
        voiceactivity: ['Ranking de call', 'Automação e utilidades / Atividade em voz']
    };
    const meta = inlineMeta[section] ?? ['Comunidade', 'Escolha uma categoria pelo menu. Depois selecione a função que deseja configurar.'];
    const container = (0, common_1.baseContainer)(config.panel.color, meta[0], meta[1]);
    if (section === 'cl')
        renderCl(container, session, ids, config);
    else if (section === 'autorole')
        renderAutorole(container, session, ids, config);
    else if (section === 'massroles')
        renderMassRoles(container, session, ids, config);
    else if (section === 'suggestions')
        renderSuggestions(container, session, ids, config);
    else if (section === 'voice')
        renderTemporaryVoice(container, session, ids, config);
    else if (section === 'rolebackup')
        renderRoleBackup(container, session, ids, config);
    else if (section === 'voiceactivity')
        renderVoiceActivity(container, session, ids, config, guild);
    else
        renderOverview(container, session, ids, config);
    return (0, common_1.navigation)((0, common_1.r8Footer)(container), ids, session);
}
function renderOverview(container, session, ids, config) {
    const openTickets = Object.values(config.community.tickets.openTickets).filter(ticket => !ticket.closedAt).length;
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Tickets: **${openTickets} abertos** • Painéis: **${config.community.tickets.panels.length}/10**\n` +
        `Telloyn: **${config.community.telloyn.enabled ? 'ativado' : 'desativado'}** • Instagram: **${config.community.instagram.enabled ? 'ativado' : 'desativado'}** • X: **${config.community.twitter.enabled ? 'ativado' : 'desativado'}**`));
    const menu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(ids.encode(session.id, 'communitysection'))
        .setPlaceholder('Selecione uma categoria da comunidade')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Atendimento').setDescription('Tickets e formulários.').setValue('service').setEmoji(emojis_1.COMMUNITY_CATEGORY_EMOJIS.service), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Comunicação').setDescription('Boas-vindas, saída e sugestões.').setValue('messages').setEmoji(emojis_1.COMMUNITY_CATEGORY_EMOJIS.messages), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Diversão e social').setDescription('Telloyn, Instagram, X e salas temporárias.').setValue('fun').setEmoji(emojis_1.COMMUNITY_CATEGORY_EMOJIS.fun), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Cargos').setDescription('Autoroles, painéis e operações em massa.').setValue('roles').setEmoji(emojis_1.COMMUNITY_CATEGORY_EMOJIS.roles), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Automação e utilidades').setDescription('Limpeza e ranking de atividade em call.').setValue('utilities').setEmoji(emojis_1.COMMUNITY_CATEGORY_EMOJIS.utilities));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(menu));
}
function renderCategory(session, ids, config, category) {
    const data = {
        service: {
            title: 'Atendimento',
            description: 'Escolha a função de atendimento que deseja configurar.',
            options: [
                ['tickets', 'Tickets', 'Painéis, setores, equipe, permissões e atendimento.'],
                ['forms', 'Formulários', 'Inscrições, candidaturas e formulários da comunidade.']
            ]
        },
        messages: {
            title: 'Comunicação',
            description: 'Escolha qual fluxo de comunicação deseja configurar.',
            options: [
                ['welcome', 'Boas-vindas', 'Mensagem e aparência para novos membros.'],
                ['goodbye', 'Saída', 'Mensagem enviada quando um membro sair.'],
                ['suggestions', 'Sugestões', 'Canal e funcionamento das sugestões.']
            ]
        },
        fun: {
            title: 'Diversão e social',
            description: 'Escolha um recurso social. Os controles aparecem somente dentro da função.',
            options: [
                ['telloyn', 'Telloyn', 'Mensagens públicas ou anônimas com visual próprio.'],
                ['instagram', 'Instagram', 'Publicações sociais dentro da comunidade.'],
                ['twitter', 'X', 'Publicações com visual inspirado no X.'],
                ['voice', 'Salas temporárias', 'Calls criadas e removidas automaticamente.']
            ]
        },
        roles: {
            title: 'Cargos',
            description: 'Escolha a ferramenta de cargos que deseja administrar.',
            options: [
                ['autorole', 'Autorole', 'Cargos automáticos para membros e bots.'],
                ['rolepanels', 'Cargos selecionáveis', 'Painéis para o próprio membro escolher cargos.'],
                ['massroles', 'Cargos em massa', 'Adicionar, remover ou limpar cargos em lote.'],
                ['rolebackup', 'Backup de cargos', 'Salvar e restaurar a estrutura de cargos.']
            ]
        },
        utilities: {
            title: 'Automação e utilidades',
            description: 'Escolha uma automação ou ferramenta da comunidade.',
            options: [
                ['cl', 'Limpeza CL', 'Limpeza manual rápida com regras de acesso.'],
                ['autoclean', 'Limpeza automática', 'Regras para apagar mensagens automaticamente.'],
                ['voiceactivity', 'Ranking de call', 'Tempo em voz, participantes e ranking automático.']
            ]
        }
    };
    const selected = data[category] ?? data.utilities;
    const container = (0, common_1.baseContainer)(config.panel.color, selected.title, selected.description);
    const menu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(ids.encode(session.id, 'communityfunction'))
        .setPlaceholder('Selecione uma função')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(...selected.options.map(([value, label, description]) => new discord_js_1.StringSelectMenuOptionBuilder().setValue(value).setLabel(label).setDescription(description).setEmoji(emojis_1.COMMUNITY_FUNCTION_EMOJIS[value] ?? emojis_1.UI_EMOJIS.more)));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(menu));
    return (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'communityopen', 'overview');
}
function renderTelloyn(session, ids, config, user, guild) {
    const view = String(session.state.telloynView ?? 'home');
    const item = config.community.telloyn;
    if (view === 'appearance') {
        const container = (0, common_1.baseContainer)(config.panel.color, 'Telloyn — aparência', 'Prévia e personalização do painel público.');
        container.addActionRowComponents(row(button(ids, session, 'telloynfield', 'title', 'Título', discord_js_1.ButtonStyle.Primary), button(ids, session, 'telloynfield', 'description', 'Descrição', discord_js_1.ButtonStyle.Primary), button(ids, session, 'telloynfield', 'color', 'Cor'), button(ids, session, 'telloynfield', 'buttonLabel', 'Texto do botão')), row(button(ids, session, 'telloynupload', 'imageUrl', 'Enviar imagem', discord_js_1.ButtonStyle.Success), button(ids, session, 'telloynupload', 'thumbnailUrl', 'Enviar thumbnail', discord_js_1.ButtonStyle.Success), button(ids, session, 'telloynclearmedia', 'imageUrl', 'Remover imagem', discord_js_1.ButtonStyle.Danger), button(ids, session, 'telloynclearmedia', 'thumbnailUrl', 'Remover thumbnail', discord_js_1.ButtonStyle.Danger)), row(button(ids, session, 'telloynseparator', '', item.appearance.showSeparator ? 'Ocultar separador' : 'Mostrar separador'), button(ids, session, 'telloynbuttonstyle', '', 'Estilo do botão'), button(ids, session, 'telloynview', 'home', 'Voltar')));
        (0, appearancePreview_1.addCommunityPreview)(container, item.appearance, { user, member: user, guild, channel: null }, 'Painel público');
        container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('preview:telloyn').setLabel((item.appearance.buttonLabel || 'Enviar Telloyn').slice(0, 80)).setStyle(discord_js_1.ButtonStyle.Primary).setDisabled(true)));
        return (0, common_1.r8Footer)(container);
    }
    if (view === 'settings') {
        const container = (0, common_1.baseContainer)(config.panel.color, 'Telloyn — configurações', 'Escolha canais e modos de envio sem informar IDs.');
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Status: **${item.enabled ? 'ativado' : 'desativado'}**\n` +
            `Canal: ${mentionChannel(item.channelId)} • Logs: ${mentionChannel(item.logChannelId)}\n` +
            `Público: **${yes(item.allowPublic)}** • Anônimo: **${yes(item.allowAnonymous)}** • Menção opcional: **${yes(item.allowMentions)}**\n` +
            `Limite: **${item.maximumMessageLength} caracteres**`));
        container.addActionRowComponents(row(button(ids, session, 'telloyntoggle', 'enabled', item.enabled ? 'Desativar' : 'Ativar', item.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success), button(ids, session, 'telloyntoggle', 'public', 'Público', item.allowPublic ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary), button(ids, session, 'telloyntoggle', 'anonymous', 'Anônimo', item.allowAnonymous ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary), button(ids, session, 'telloyntoggle', 'mentions', 'Menção', item.allowMentions ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary), button(ids, session, 'telloynfield', 'maximumMessageLength', 'Limite')), channelSelect(ids, session, 'telloynchannel', 'Selecionar canal do Telloyn', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), channelSelect(ids, session, 'telloynlogchannel', 'Selecionar canal de logs do Telloyn', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), row(button(ids, session, 'telloynview', 'home', 'Voltar')));
        return (0, common_1.r8Footer)(container);
    }
    const container = (0, common_1.baseContainer)(config.panel.color, 'Telloyn', 'Mensagens públicas ou anônimas com apresentação própria.');
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Status: **${item.enabled ? 'ativado' : 'desativado'}**\nCanal: ${mentionChannel(item.channelId)}\nPainel publicado: **${item.publishMessageId ? 'sim' : 'não'}**`));
    container.addActionRowComponents(row(button(ids, session, 'telloynview', 'appearance', 'Aparência', discord_js_1.ButtonStyle.Primary), button(ids, session, 'telloynview', 'settings', 'Configurações', discord_js_1.ButtonStyle.Primary), button(ids, session, 'telloynpublish', '', 'Publicar painel', discord_js_1.ButtonStyle.Success, !item.channelId)), row(button(ids, session, 'communityopen', 'fun', 'Voltar')));
    return (0, common_1.r8Footer)(container);
}
function renderInstagram(session, ids, config, _user, _guild) {
    const view = String(session.state.instagramView ?? 'home');
    const item = config.community.instagram;
    if (view === 'appearance') {
        const container = (0, common_1.baseContainer)(config.panel.color, 'Instagram — aparência', 'O layout é fixo e limpo; somente a cor do cartão pode ser alterada.');
        container.addActionRowComponents(row(button(ids, session, 'instagramfield', 'color', 'Alterar cor', discord_js_1.ButtonStyle.Primary), button(ids, session, 'instagramview', 'home', 'Voltar')));
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Large));
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('## Prévia real — publicação\n-# Os botões abaixo estão desativados nesta visualização.'));
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('**Autor:** @usuário\nNome exibido • @username • há alguns segundos'));
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('A foto ou o vídeo aparece aqui.'));
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Small));
        const previewRow = new discord_js_1.ActionRowBuilder();
        for (const [key, label] of [['like', 'Curtir'], ['comment', 'Comentar'], ['details', 'Detalhes'], ['delete', 'Excluir']]) {
            const button = new discord_js_1.ButtonBuilder().setCustomId(`preview:instagram:${key}`).setLabel(label).setStyle(key === 'delete' ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Secondary).setDisabled(true);
            const fallbackEmoji = key === 'like' ? emojis_1.UI_EMOJIS.heart : key === 'comment' ? emojis_1.UI_EMOJIS.topic : key === 'details' ? emojis_1.UI_EMOJIS.more : emojis_1.UI_EMOJIS.trash;
            button.setEmoji((0, emojis_1.resolveConfiguredEmoji)(item.emojis[key]) ?? fallbackEmoji);
            previewRow.addComponents(button);
        }
        container.addActionRowComponents(previewRow);
        return (0, common_1.r8Footer)(container);
    }
    if (view === 'settings') {
        const container = (0, common_1.baseContainer)(config.panel.color, 'Instagram — canal e permissões', 'Selecione o canal, o cargo autorizado e o canal de logs.');
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Status: **${item.enabled ? 'ativado' : 'desativado'}**\n` +
            `Canal: ${mentionChannel(item.channelId)}\nCargo autorizado: ${item.allowedRoleId ? `<@&${item.allowedRoleId}>` : 'não configurado'}\n` +
            `Imagens: **${yes(item.allowImages)}** • Vídeos: **${yes(item.allowVideos)}** • Anexo obrigatório: **${yes(item.requireAttachment)}**\n` +
            `Legenda: **${item.maximumCaptionLength} caracteres** • Publicações: **${Object.keys(item.posts).length}**`));
        container.addActionRowComponents(row(button(ids, session, 'instagramtoggle', 'enabled', item.enabled ? 'Desativar' : 'Ativar', item.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success), button(ids, session, 'instagramtoggle', 'images', 'Imagens', item.allowImages ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary), button(ids, session, 'instagramtoggle', 'videos', 'Vídeos', item.allowVideos ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary), button(ids, session, 'instagramtoggle', 'require', 'Exigir anexo', item.requireAttachment ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary), button(ids, session, 'instagramfield', 'maximumCaptionLength', 'Limite')), channelSelect(ids, session, 'instagramchannel', 'Selecionar canal do Instagram', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'instagramrole')).setPlaceholder('Selecionar cargo autorizado').setMinValues(1).setMaxValues(1)), channelSelect(ids, session, 'instagramlogchannel', 'Selecionar canal de logs do Instagram', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), row(button(ids, session, 'instagramview', 'home', 'Voltar')));
        return (0, common_1.r8Footer)(container);
    }
    const container = (0, common_1.baseContainer)(config.panel.color, 'Instagram', 'Publicações com foto ou vídeo, curtidas, comentários e exclusão.');
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Status: **${item.enabled ? 'ativado' : 'desativado'}**\nCanal: ${mentionChannel(item.channelId)}\nCargo: ${item.allowedRoleId ? `<@&${item.allowedRoleId}>` : 'não configurado'}\nPublicações: **${Object.keys(item.posts).length}**`));
    container.addActionRowComponents(row(button(ids, session, 'instagramview', 'appearance', 'Aparência', discord_js_1.ButtonStyle.Primary), button(ids, session, 'instagramview', 'settings', 'Canal e permissões', discord_js_1.ButtonStyle.Primary)), row(button(ids, session, 'communityopen', 'fun', 'Voltar')));
    return (0, common_1.r8Footer)(container);
}
function renderTickets(session, ids, config, user, guild) {
    const view = String(session.state.ticketView ?? 'list');
    const selected = selectedTicketPanel(session, config);
    if (view === 'external' && selected)
        return renderTicketAppearance(session, ids, config, user, guild, selected, 'external');
    if (view === 'internal' && selected)
        return renderTicketAppearance(session, ids, config, user, guild, selected, 'internal');
    if (view === 'settings' && selected)
        return renderTicketSettings(session, ids, config, selected);
    if (view === 'access' && selected)
        return renderTicketAccess(session, ids, config, selected);
    if (view === 'logs' && selected)
        return renderTicketLogs(session, ids, config, selected);
    if (view === 'questions' && selected)
        return renderTicketQuestions(session, ids, config, selected);
    if (view === 'buttons' && selected)
        return renderTicketButtons(session, ids, config, selected);
    if (view === 'panel' && selected)
        return renderTicketPanel(session, ids, config, selected);
    const container = (0, common_1.baseContainer)(config.panel.color, 'Tickets', 'Crie até dez setores independentes, como suporte, denúncia e parceria.');
    if (!config.community.tickets.panels.length) {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Nenhum painel criado. Crie o primeiro setor abaixo.'));
    }
    else {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Escolha o setor no menu para abrir todas as opções dele.'));
        const menu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(ids.encode(session.id, 'ticketpanel'))
            .setPlaceholder('Selecionar painel de ticket')
            .setMinValues(1).setMaxValues(1)
            .addOptions(...config.community.tickets.panels.map(panel => new discord_js_1.StringSelectMenuOptionBuilder()
            .setLabel(panel.name.slice(0, 100))
            .setDescription(`${panel.enabled ? 'Ativado' : 'Desativado'} • ${panel.creationMode === 'thread' ? 'tópico' : 'canal'} • ${panel.openComponent === 'select' ? 'menu' : 'botão'}`.slice(0, 100))
            .setValue(panel.id)));
        container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(menu));
    }
    container.addActionRowComponents(row(button(ids, session, 'ticketcreate', '', 'Criar painel', discord_js_1.ButtonStyle.Success, config.community.tickets.panels.length >= 10), button(ids, session, 'communityopen', 'service', 'Voltar', discord_js_1.ButtonStyle.Secondary)));
    return (0, common_1.r8Footer)(container);
}
function renderTicketPanel(session, ids, config, panel) {
    const open = Object.values(config.community.tickets.openTickets).filter(ticket => ticket.panelId === panel.id && !ticket.closedAt).length;
    const container = (0, common_1.baseContainer)(config.panel.color, panel.name, `${panel.enabled ? 'Ativado' : 'Desativado'} • ${open} ticket(s) aberto(s)`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Publicação: ${mentionChannel(panel.publishChannelId)}\n` +
        `Criação: **${panel.creationMode === 'thread' ? 'tópico privado' : 'canal privado'}** • Abertura: **${panel.openComponent === 'select' ? 'menu' : 'botão'}**\n` +
        `Equipe: ${mentions(panel.supportRoleIds, 'role')}\nLimite por usuário: **${panel.maxOpenPerUser}**`));
    container.addActionRowComponents(row(button(ids, session, 'ticketview', 'external', 'Embed externo', discord_js_1.ButtonStyle.Primary), button(ids, session, 'ticketview', 'internal', 'Embed interno', discord_js_1.ButtonStyle.Primary), button(ids, session, 'ticketview', 'settings', 'Configurações'), button(ids, session, 'ticketview', 'access', 'Permissões')), row(button(ids, session, 'ticketview', 'logs', 'Canais e logs'), button(ids, session, 'ticketview', 'questions', 'Formulário'), button(ids, session, 'ticketview', 'buttons', 'Ações internas'), button(ids, session, 'ticketpublish', '', 'Publicar', discord_js_1.ButtonStyle.Success)), row(button(ids, session, 'tickettoggle', '', panel.enabled ? 'Desativar' : 'Ativar', panel.enabled ? discord_js_1.ButtonStyle.Secondary : discord_js_1.ButtonStyle.Success), button(ids, session, 'ticketduplicate', '', 'Duplicar'), button(ids, session, 'ticketdelete', '', 'Excluir', discord_js_1.ButtonStyle.Danger), button(ids, session, 'ticketview', 'list', 'Voltar', discord_js_1.ButtonStyle.Secondary)));
    return (0, common_1.r8Footer)(container);
}
function renderTicketAppearance(session, ids, config, user, guild, panel, kind) {
    const appearance = panel[kind];
    const label = kind === 'external' ? 'Embed externo' : 'Embed interno';
    const container = (0, common_1.baseContainer)(config.panel.color, label, `Painel: **${panel.name}**. Nesta tela aparecem somente as opções deste visual.`);
    container.addActionRowComponents(row(button(ids, session, 'ticketfield', `${kind}.title`, 'Título', discord_js_1.ButtonStyle.Primary), button(ids, session, 'ticketfield', `${kind}.description`, 'Descrição', discord_js_1.ButtonStyle.Primary), button(ids, session, 'ticketfield', `${kind}.color`, 'Cor'), button(ids, session, 'ticketfield', `${kind}.footer`, 'Rodapé')), row(button(ids, session, 'ticketupload', `${kind}.imageUrl`, 'Enviar imagem', discord_js_1.ButtonStyle.Success), button(ids, session, 'ticketupload', `${kind}.thumbnailUrl`, 'Enviar thumbnail', discord_js_1.ButtonStyle.Success), button(ids, session, 'ticketclearmedia', `${kind}.imageUrl`, 'Remover imagem', discord_js_1.ButtonStyle.Danger), button(ids, session, 'ticketclearmedia', `${kind}.thumbnailUrl`, 'Remover thumbnail', discord_js_1.ButtonStyle.Danger)), row(button(ids, session, 'ticketseparator', kind, appearance.showSeparator ? 'Ocultar separador' : 'Mostrar separador'), button(ids, session, 'ticketplaceholders', kind, 'Placeholders')));
    if (kind === 'external')
        container.addActionRowComponents(row(button(ids, session, 'ticketfield', 'external.buttonLabel', 'Texto da abertura'), button(ids, session, 'ticketbuttonstyle', '', 'Estilo'), button(ids, session, 'ticketfield', 'external.buttonEmoji', 'Emoji')));
    (0, common_1.backOnly)(container, ids, session, 'ticketview', 'panel');
    (0, appearancePreview_1.addTicketPreview)(container, appearance, { user, guild, panel, ticketId: 'TCK-000001', ticketNumber: '000001', priority: 'normal', createdAt: new Date() }, label);
    return (0, common_1.r8Footer)(container);
}
function renderTicketSettings(session, ids, config, panel) {
    const container = (0, common_1.baseContainer)(config.panel.color, 'Configurações do ticket', `Painel: **${panel.name}**`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Estrutura: **${panel.creationMode === 'thread' ? 'tópico privado' : 'canal privado'}**\n` +
        `Abertura: **${panel.openComponent === 'select' ? 'menu de seleção' : 'botão'}**\n` +
        `Nome: \`${panel.ticketNamePattern}\` • Limite: **${panel.maxOpenPerUser}**\n` +
        `Fechamento automático: **${panel.autoCloseMinutes ? `${panel.autoCloseMinutes} min` : 'desativado'}**\n` +
        `Reabertura: **${yes(panel.allowReopen)}** • Avaliação: **${yes(panel.ratingEnabled)}** • Horário: **${yes(panel.businessHoursEnabled)}**`));
    container.addActionRowComponents(row(button(ids, session, 'ticketcreationmode', '', panel.creationMode === 'thread' ? 'Usar canal' : 'Usar tópico', discord_js_1.ButtonStyle.Primary), button(ids, session, 'ticketopencomponent', '', panel.openComponent === 'select' ? 'Usar botão' : 'Usar menu', discord_js_1.ButtonStyle.Primary), button(ids, session, 'ticketsettingfield', 'name', 'Nome do painel'), button(ids, session, 'ticketsettingfield', 'maxOpenPerUser', 'Limite')), row(button(ids, session, 'ticketsettingfield', 'ticketNamePattern', 'Nome do ticket'), button(ids, session, 'ticketsettingfield', 'autoCloseMinutes', 'Fechamento automático'), button(ids, session, 'tickettogglesetting', 'allowReopen', 'Reabertura'), button(ids, session, 'tickettogglesetting', 'ratingEnabled', 'Avaliação')), row(button(ids, session, 'tickettogglesetting', 'businessHoursEnabled', 'Horário'), button(ids, session, 'ticketsettingfield', 'businessHoursText', 'Texto do horário')));
    return (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'ticketview', 'panel');
}
function renderTicketAccess(session, ids, config, panel) {
    const container = (0, common_1.baseContainer)(config.panel.color, 'Permissões do ticket', `Painel: **${panel.name}**`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Equipe: ${mentions(panel.supportRoleIds, 'role')}\nPermitidos: ${mentions(panel.allowedRoleIds, 'role')}\nBloqueados: ${mentions(panel.blockedRoleIds, 'role')}\nUsuários bloqueados: ${mentions(panel.blockedUserIds, 'user')}`));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'ticketsupportrole')).setPlaceholder('Adicionar/remover cargo responsável').setMinValues(1).setMaxValues(1)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'ticketallowedrole')).setPlaceholder('Adicionar/remover cargo permitido').setMinValues(1).setMaxValues(1)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'ticketblockedrole')).setPlaceholder('Adicionar/remover cargo bloqueado').setMinValues(1).setMaxValues(1)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.UserSelectMenuBuilder().setCustomId(ids.encode(session.id, 'ticketblockeduser')).setPlaceholder('Adicionar/remover usuário bloqueado').setMinValues(1).setMaxValues(1)), row(button(ids, session, 'ticketclearaccess', '', 'Limpar listas', discord_js_1.ButtonStyle.Danger)));
    return (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'ticketview', 'panel');
}
function renderTicketLogs(session, ids, config, panel) {
    const container = (0, common_1.baseContainer)(config.panel.color, 'Canais do ticket', `Painel: **${panel.name}**`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Publicação: ${mentionChannel(panel.publishChannelId)}\nCategoria dos canais: ${mentionChannel(panel.categoryId)}\nCanal pai dos tópicos: ${mentionChannel(panel.threadParentChannelId)}\nLogs: ${mentionChannel(panel.logChannelId)}\nTranscripts: ${mentionChannel(panel.transcriptChannelId)}`));
    container.addActionRowComponents(channelSelect(ids, session, 'ticketpublishchannel', 'Selecionar canal de publicação', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), channelSelect(ids, session, 'ticketcategory', 'Selecionar categoria dos canais', [discord_js_1.ChannelType.GuildCategory]), channelSelect(ids, session, 'ticketthreadparent', 'Selecionar canal pai dos tópicos', [discord_js_1.ChannelType.GuildText]), channelSelect(ids, session, 'ticketlogchannel', 'Selecionar canal de logs', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), channelSelect(ids, session, 'tickettranscriptchannel', 'Selecionar canal de transcripts', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]));
    return (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'ticketview', 'panel');
}
function renderTicketQuestions(session, ids, config, panel) {
    const container = (0, common_1.baseContainer)(config.panel.color, 'Formulário de abertura', `Painel: **${panel.name}** • máximo de cinco perguntas`);
    if (!panel.questions.length)
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Nenhuma pergunta configurada. O atendimento será aberto diretamente.'));
    for (const question of panel.questions) {
        container.addSectionComponents(new discord_js_1.SectionBuilder()
            .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`**${question.label}**\n${question.required ? 'Obrigatória' : 'Opcional'} • ${question.paragraph ? 'Texto longo' : 'Texto curto'}`))
            .setButtonAccessory(new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, 'ticketquestionedit', question.id)).setLabel('Editar').setStyle(discord_js_1.ButtonStyle.Secondary)));
    }
    container.addActionRowComponents(row(button(ids, session, 'ticketquestionadd', '', 'Adicionar pergunta', discord_js_1.ButtonStyle.Success, panel.questions.length >= 5), button(ids, session, 'ticketquestionremove', '', 'Remover última', discord_js_1.ButtonStyle.Danger, !panel.questions.length)));
    return (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'ticketview', 'panel');
}
function renderTicketButtons(session, ids, config, panel) {
    const container = (0, common_1.baseContainer)(config.panel.color, 'Ações internas', `Painel: **${panel.name}**. Ative somente o que sua equipe utiliza.`);
    const entries = Object.entries(panel.internalButtons);
    for (let index = 0; index < entries.length; index += 5) {
        container.addActionRowComponents(row(...entries.slice(index, index + 5).map(([key, value]) => button(ids, session, 'ticketinternalbutton', key, buttonLabel(key), value ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Secondary))));
    }
    return (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'ticketview', 'panel');
}
function renderCommunityMessage(session, ids, config, user, guild, kind) {
    const item = config.community[kind];
    const label = kind === 'welcome' ? 'Boas-vindas' : 'Mensagem de saída';
    const container = (0, common_1.baseContainer)(config.panel.color, label, `Status: **${item.enabled ? 'ativado' : 'desativado'}** | Canal: ${mentionChannel(item.channelId)}`);
    container.addActionRowComponents(row(button(ids, session, 'communitymessagefield', `${kind}.title`, 'Alterar título', discord_js_1.ButtonStyle.Primary), button(ids, session, 'communitymessagefield', `${kind}.description`, 'Alterar descrição', discord_js_1.ButtonStyle.Primary), button(ids, session, 'communitymessagefield', `${kind}.color`, 'Alterar cor'), button(ids, session, 'communitymessagefield', `${kind}.footer`, 'Alterar rodapé')), row(button(ids, session, 'communityupload', `${kind}.imageUrl`, 'Enviar imagem', discord_js_1.ButtonStyle.Success), button(ids, session, 'communityupload', `${kind}.thumbnailUrl`, 'Enviar thumbnail', discord_js_1.ButtonStyle.Success), button(ids, session, 'communityclearmedia', `${kind}.imageUrl`, 'Remover imagem', discord_js_1.ButtonStyle.Danger), button(ids, session, 'communityclearmedia', `${kind}.thumbnailUrl`, 'Remover thumbnail', discord_js_1.ButtonStyle.Danger)), row(button(ids, session, 'communityseparator', kind, item.appearance.showSeparator ? 'Ocultar separador' : 'Mostrar separador'), button(ids, session, 'communityplaceholders', kind, 'Placeholders'), button(ids, session, 'communitymessagetoggle', kind, item.enabled ? 'Desativar' : 'Ativar', item.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success)), channelSelect(ids, session, kind === 'welcome' ? 'welcomechannel' : 'goodbyechannel', `Selecionar canal de ${label.toLowerCase()}`, [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), row(button(ids, session, 'communitymessagetest', kind, 'Testar mensagem', discord_js_1.ButtonStyle.Success), button(ids, session, 'communitymessagefield', `${kind}.deleteAfterSeconds`, 'Exclusão automática'), ...(kind === 'welcome' ? [button(ids, session, 'welcomedm', '', 'Alternar mensagem privada')] : []), button(ids, session, 'communityopen', 'messages', 'Voltar', discord_js_1.ButtonStyle.Secondary)));
    (0, appearancePreview_1.addCommunityPreview)(container, item.appearance, { user, member: { ...user, user, displayName: user?.displayName ?? user?.username, joinedAt: new Date(Date.now() - 86400000) }, guild, channel: null, leftAt: new Date() }, label);
    return (0, common_1.r8Footer)(container);
}
function renderCl(container, session, ids, config) {
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Comando: **!cl** ou **!cl @usuário**\nStatus: **${config.community.cl.enabled ? 'ativado' : 'desativado'}**\nGerenciar Mensagens: **${yes(config.community.cl.allowManageMessages)}**\nCargos autorizados: ${mentions(config.community.cl.allowedRoleIds, 'role')}`));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'clrole')).setPlaceholder('Adicionar/remover cargo autorizado')), row(button(ids, session, 'cltoggle', '', config.community.cl.enabled ? 'Desativar' : 'Ativar', config.community.cl.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success), button(ids, session, 'clmanage', '', 'Alternar Gerenciar Mensagens'), button(ids, session, 'cllimitmodal', '', 'Editar limite'), button(ids, session, 'clclearroles', '', 'Limpar cargos', discord_js_1.ButtonStyle.Danger), button(ids, session, 'communityopen', 'utilities', 'Voltar')));
}
function renderAutorole(container, session, ids, config) {
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Membros: ${mentions(config.community.autorole.memberRoleIds, 'role')}\nBots: ${mentions(config.community.autorole.botRoleIds, 'role')}\nTodos: ${mentions(config.community.autorole.everyoneRoleIds, 'role')}`));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'autorolemember')).setPlaceholder('Autorole de membros')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'autorolebot')).setPlaceholder('Autorole de bots')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'autoroleeveryone')).setPlaceholder('Autorole para todos')), row(button(ids, session, 'autoroleclear', '', 'Limpar autoroles', discord_js_1.ButtonStyle.Danger), button(ids, session, 'communityopen', 'roles', 'Voltar')));
}
function renderMassRoles(container, session, ids, config) {
    const selectedRoleId = typeof session.state.massRoleId === 'string' ? session.state.massRoleId : null;
    const pending = typeof session.state.massPending === 'string' ? session.state.massPending : null;
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Cargo selecionado: ${selectedRoleId ? `<@&${selectedRoleId}>` : 'nenhum'}\nAdministradores: **${yes(config.community.massRoles.allowAdministrators)}**\nCargos autorizados: ${mentions(config.community.massRoles.allowedRoleIds, 'role')}${pending ? `\nAguardando confirmação: **${pending}**` : ''}`));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'massrole')).setPlaceholder('Selecionar cargo da operação')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'massaccessrole')).setPlaceholder('Cargo autorizado para ações em massa')), row(button(ids, session, 'masstoggleadmin', '', 'Alternar administradores'), button(ids, session, 'massrequest', 'add', 'Adicionar a todos', discord_js_1.ButtonStyle.Success, !selectedRoleId).setEmoji(emojis_1.UI_EMOJIS.add), button(ids, session, 'massrequest', 'remove', 'Remover de todos', discord_js_1.ButtonStyle.Primary, !selectedRoleId).setEmoji(emojis_1.UI_EMOJIS.subtract), button(ids, session, 'massrequest', 'clear', 'Tirar todos os cargos', discord_js_1.ButtonStyle.Danger).setEmoji(emojis_1.UI_EMOJIS.massroles)));
    if (pending)
        container.addActionRowComponents(row(button(ids, session, 'massconfirm', '', 'Confirmar', discord_js_1.ButtonStyle.Danger).setEmoji(emojis_1.UI_EMOJIS.check), button(ids, session, 'masscancel', '', 'Cancelar')));
    container.addActionRowComponents(row(button(ids, session, 'communityopen', 'roles', 'Voltar')));
}
function renderSuggestions(container, session, ids, config) {
    const item = config.community.suggestions;
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Status: **${item.enabled ? 'ativado' : 'desativado'}**\nCanal público: ${mentionChannel(item.channelId)}\nCanal de revisão: ${mentionChannel(item.reviewChannelId)}\nThread automática: **${yes(item.createThread)}**\nAnônimo: **${yes(item.allowAnonymous)}**`));
    container.addActionRowComponents(channelSelect(ids, session, 'suggestionchannel', 'Canal público de sugestões', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), channelSelect(ids, session, 'suggestionreview', 'Canal privado de revisão', [discord_js_1.ChannelType.GuildText]), row(button(ids, session, 'suggestiontoggle', 'enabled', item.enabled ? 'Desativar' : 'Ativar', item.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success), button(ids, session, 'suggestiontoggle', 'thread', 'Alternar thread'), button(ids, session, 'suggestiontoggle', 'anonymous', 'Alternar anonimato'), button(ids, session, 'communityopen', 'messages', 'Voltar')));
}
function renderTemporaryVoice(container, session, ids, config) {
    const item = config.community.temporaryVoice;
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Status: **${item.enabled ? 'ativado' : 'desativado'}**\nCanal criador: ${mentionChannel(item.creatorChannelId)}\nCategoria: ${mentionChannel(item.categoryId)}\nNome: \`${item.namePattern}\`\nLimite padrão: **${item.defaultUserLimit || 'sem limite'}**\nSalas ativas: **${Object.keys(item.createdChannels).length}**`));
    container.addActionRowComponents(channelSelect(ids, session, 'voicecreator', 'Selecionar canal criador', [discord_js_1.ChannelType.GuildVoice]), channelSelect(ids, session, 'voicecategory', 'Selecionar categoria das salas', [discord_js_1.ChannelType.GuildCategory]), row(button(ids, session, 'voicetoggle', '', item.enabled ? 'Desativar' : 'Ativar', item.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success), button(ids, session, 'voicefield', 'namePattern', 'Alterar nome'), button(ids, session, 'voicefield', 'defaultUserLimit', 'Alterar limite'), button(ids, session, 'communityopen', 'fun', 'Voltar')));
}
function renderTwitter(session, ids, config, user, guild) {
    const item = config.community.twitter;
    const container = (0, common_1.baseContainer)(config.panel.color, 'X / Twitter', 'As mensagens do canal configurado viram cards visuais no estilo do X, com fundo preto, detalhes brancos, autor, texto e mídia.');
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Status: **${item.enabled ? 'ativado' : 'desativado'}**\n` +
        `Canal: ${mentionChannel(item.channelId)} • Logs: ${mentionChannel(item.logChannelId)}\n` +
        `Apagar mensagem original: **${yes(item.deleteOriginalMessage)}** • Arquivos: **${yes(item.allowAttachments)}**\n` +
        `Limite: **${item.maximumMessageLength} caracteres** • Webhook: **${item.webhookName}**`));
    container.addActionRowComponents(channelSelect(ids, session, 'twitterchannel', 'Selecionar canal do X', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), channelSelect(ids, session, 'twitterlogchannel', 'Selecionar canal de logs do X', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), row(button(ids, session, 'twittertoggle', 'enabled', item.enabled ? 'Desativar' : 'Ativar', item.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success), button(ids, session, 'twittertoggle', 'original', item.deleteOriginalMessage ? 'Manter original' : 'Apagar original'), button(ids, session, 'twittertoggle', 'attachments', item.allowAttachments ? 'Bloquear arquivos' : 'Permitir arquivos'), button(ids, session, 'twitterfield', 'maximumMessageLength', 'Limite'), button(ids, session, 'twitterfield', 'webhookName', 'Nome do webhook')), row(button(ids, session, 'communityopen', 'fun', 'Voltar')));
    container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Large));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## Prévia\n**${user?.displayName ?? user?.globalName ?? user?.username ?? 'Usuário'}**\n` +
        `-# @${user?.username ?? 'usuario'} • ${guild?.name ?? 'Servidor'}\n` +
        `Esta é uma publicação de exemplo no estilo do X.`));
    return (0, common_1.r8Footer)(container);
}
function renderAutoClean(session, ids, config) {
    const selected = selectedAutoCleanRule(session, config);
    const showRule = String(session.state.autoCleanView ?? 'list') === 'rule' && selected;
    if (!showRule) {
        const container = (0, common_1.baseContainer)(config.panel.color, 'Limpeza automática', 'Crie regras para apagar mensagens automaticamente por canal e tipo.');
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Regras: **${config.community.autoClean.rules.length}/${config.community.autoClean.maximumRules}**\n` +
            `Ativas: **${config.community.autoClean.rules.filter(rule => rule.enabled).length}**`));
        if (config.community.autoClean.rules.length) {
            const menu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(ids.encode(session.id, 'autocleanrule'))
                .setPlaceholder('Selecionar uma regra')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(...config.community.autoClean.rules.map(rule => new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel(rule.name.slice(0, 100))
                .setDescription(`${autoCleanModeLabel(rule.mode)} • ${formatAutoCleanDelay(rule.delaySeconds)}`.slice(0, 100))
                .setValue(rule.id)));
            container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(menu));
        }
        else {
            container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Nenhuma regra criada.'));
        }
        container.addActionRowComponents(row(button(ids, session, 'autocleancreate', '', 'Criar regra', discord_js_1.ButtonStyle.Success, config.community.autoClean.rules.length >= config.community.autoClean.maximumRules), button(ids, session, 'communityopen', 'utilities', 'Voltar')));
        return (0, common_1.r8Footer)(container);
    }
    const rule = selected;
    const container = (0, common_1.baseContainer)(config.panel.color, rule.name, `Regra ${rule.id}`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Status: **${rule.enabled ? 'ativada' : 'desativada'}**\n` +
        `Canal: ${mentionChannel(rule.channelId)}\n` +
        `Modo: **${autoCleanModeLabel(rule.mode)}** • Apagar após: **${formatAutoCleanDelay(rule.delaySeconds)}**\n` +
        `Bots: **${yes(rule.includeBots)}** • Webhooks: **${yes(rule.includeWebhooks)}** • Ignorar fixadas: **${yes(rule.ignorePinned)}** • Registrar exclusões: **${yes(rule.logDeletions)}**`));
    const modeMenu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(ids.encode(session.id, 'autocleanmode'))
        .setPlaceholder('Escolher tipo de limpeza')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Limpar tudo').setDescription('Apaga qualquer mensagem no canal.').setValue('all').setDefault(rule.mode === 'all'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Limpar imagens').setDescription('Apaga imagens e links diretos de imagem.').setValue('images').setDefault(rule.mode === 'images'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Limpar mensagens').setDescription('Apaga mensagens de texto sem anexos.').setValue('text').setDefault(rule.mode === 'text'), new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Limpar links').setDescription('Apaga mensagens que possuem links ou convites.').setValue('links').setDefault(rule.mode === 'links'));
    container.addActionRowComponents(channelSelect(ids, session, 'autocleanchannel', 'Selecionar canal da regra', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), new discord_js_1.ActionRowBuilder().addComponents(modeMenu), row(button(ids, session, 'autocleantoggle', 'enabled', rule.enabled ? 'Desativar' : 'Ativar', rule.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success), button(ids, session, 'autocleantoggle', 'bots', rule.includeBots ? 'Ignorar bots' : 'Incluir bots'), button(ids, session, 'autocleantoggle', 'webhooks', rule.includeWebhooks ? 'Ignorar webhooks' : 'Incluir webhooks'), button(ids, session, 'autocleantoggle', 'pinned', rule.ignorePinned ? 'Incluir fixadas' : 'Ignorar fixadas')), row(button(ids, session, 'autocleantoggle', 'logs', rule.logDeletions ? 'Desativar logs' : 'Ativar logs'), button(ids, session, 'autocleanfield', 'name', 'Nome'), button(ids, session, 'autocleanfield', 'delaySeconds', 'Tempo'), button(ids, session, 'autocleandelete', '', 'Excluir regra', discord_js_1.ButtonStyle.Danger)), row(button(ids, session, 'autocleanback', '', 'Voltar')));
    return (0, common_1.r8Footer)(container);
}
function renderRolePanels(session, ids, config, guild) {
    const view = String(session.state.rolePanelView ?? 'list');
    const panel = selectedRolePanel(session, config);
    if (view === 'appearance' && panel)
        return renderRolePanelAppearance(session, ids, config, panel);
    if (view === 'options' && panel)
        return renderRolePanelOptions(session, ids, config, panel, guild);
    if (view === 'access' && panel)
        return renderRolePanelAccess(session, ids, config, panel);
    if (view === 'panel' && panel)
        return renderRolePanelDetail(session, ids, config, panel);
    const container = (0, common_1.baseContainer)(config.panel.color, 'Cargos selecionáveis', 'Crie painéis para membros adicionarem ou removerem cargos sem intervenção da equipe.');
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Painéis criados: **${config.community.rolePanels.panels.length}/10**`));
    for (let index = 0; index < config.community.rolePanels.panels.length; index += 5) {
        container.addActionRowComponents(row(...config.community.rolePanels.panels.slice(index, index + 5).map(item => button(ids, session, 'rolepanelselect', item.id, item.name, item.enabled ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary))));
    }
    container.addActionRowComponents(row(button(ids, session, 'rolepanelcreate', '', 'Criar painel', discord_js_1.ButtonStyle.Success, config.community.rolePanels.panels.length >= 10), button(ids, session, 'communityopen', 'roles', 'Voltar')));
    return (0, common_1.r8Footer)(container);
}
function renderRolePanelDetail(session, ids, config, panel) {
    const container = (0, common_1.baseContainer)(config.panel.color, panel.name, `Painel ${panel.id} | ${panel.enabled ? 'ativado' : 'desativado'}`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Canal: ${mentionChannel(panel.publishChannelId)}\nCargos: **${panel.options.length}/24**\nModo exclusivo: **${yes(panel.exclusive)}**\nSeleções máximas: **${panel.maximumSelections}**`));
    container.addActionRowComponents(row(button(ids, session, 'rolepanelview', 'appearance', 'Aparência e canal', discord_js_1.ButtonStyle.Primary), button(ids, session, 'rolepanelview', 'options', 'Cargos', discord_js_1.ButtonStyle.Primary), button(ids, session, 'rolepanelview', 'access', 'Acesso')), row(button(ids, session, 'rolepanelpublish', '', 'Publicar', discord_js_1.ButtonStyle.Success, panel.options.length === 0 || !panel.publishChannelId), button(ids, session, 'rolepaneltoggle', '', panel.enabled ? 'Desativar' : 'Ativar', panel.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success), button(ids, session, 'rolepaneldelete', '', 'Excluir', discord_js_1.ButtonStyle.Danger), button(ids, session, 'rolepanelview', 'list', 'Voltar')));
    return (0, common_1.r8Footer)(container);
}
function renderRolePanelAppearance(session, ids, config, panel) {
    const container = (0, common_1.baseContainer)(config.panel.color, 'Aparência do painel de cargos', `Painel: **${panel.name}**`);
    container.addActionRowComponents(row(button(ids, session, 'rolepanelfield', 'name', 'Alterar nome', discord_js_1.ButtonStyle.Primary), button(ids, session, 'rolepanelfield', 'title', 'Alterar título', discord_js_1.ButtonStyle.Primary), button(ids, session, 'rolepanelfield', 'description', 'Alterar descrição', discord_js_1.ButtonStyle.Primary), button(ids, session, 'rolepanelfield', 'color', 'Alterar cor')), row(button(ids, session, 'rolepanelfield', 'placeholder', 'Texto do seletor')), channelSelect(ids, session, 'rolepanelchannel', 'Selecionar canal de publicação', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]));
    (0, common_1.backOnly)(container, ids, session, 'rolepanelview', 'panel');
    container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Large));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## Prévia real — painel de cargos\n**${panel.title}**\n${panel.description}`));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder().setCustomId('preview:role-panel').setPlaceholder(panel.placeholder.slice(0, 150)).setDisabled(true).addOptions(new discord_js_1.StringSelectMenuOptionBuilder().setLabel('Exemplo de cargo').setValue('preview-role'))));
    return (0, common_1.r8Footer)(container);
}
function renderRolePanelOptions(session, ids, config, panel, guild) {
    const page = Math.max(0, Number(session.state.roleOptionsPage ?? 0));
    const start = page * 5;
    const items = panel.options.slice(start, start + 5);
    const container = (0, common_1.baseContainer)(config.panel.color, 'Cargos do painel', `Painel: **${panel.name}** | ${panel.options.length}/24 cargos`);
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'rolepaneladdrole')).setPlaceholder('Adicionar um cargo ao painel').setMinValues(1).setMaxValues(1)));
    if (!items.length)
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Nenhum cargo nesta página. Selecione um cargo acima para adicionar.'));
    for (const option of items) {
        const roleName = guild?.roles?.cache?.get(option.roleId)?.name ?? option.label;
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`**${roleName}** — ${option.description || 'sem descrição'}${option.emoji ? ` | Ícone: ${option.emoji}` : ''}`));
        container.addActionRowComponents(row(button(ids, session, 'rolepaneloptionedit', option.roleId, 'Editar'), button(ids, session, 'rolepaneloptionremove', option.roleId, 'Remover', discord_js_1.ButtonStyle.Danger)));
    }
    container.addActionRowComponents(row(button(ids, session, 'rolepaneloptionspage', 'prev', 'Anterior', discord_js_1.ButtonStyle.Secondary, page === 0), button(ids, session, 'rolepaneloptionspage', 'next', 'Próxima', discord_js_1.ButtonStyle.Secondary, start + 5 >= panel.options.length)));
    return (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'rolepanelview', 'panel');
}
function renderRolePanelAccess(session, ids, config, panel) {
    const container = (0, common_1.baseContainer)(config.panel.color, 'Acesso ao painel de cargos', `Painel: **${panel.name}**`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Cargos exigidos: ${mentions(panel.requiredRoleIds, 'role')}\nCargos bloqueados: ${mentions(panel.blockedRoleIds, 'role')}\n` +
        `Exclusivo: **${yes(panel.exclusive)}** | Máximo de escolhas: **${panel.maximumSelections}**`));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'rolepanelrequired')).setPlaceholder('Adicionar/remover cargo exigido')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'rolepanelblocked')).setPlaceholder('Adicionar/remover cargo bloqueado')), row(button(ids, session, 'rolepanelexclusive', '', panel.exclusive ? 'Desativar exclusivo' : 'Ativar exclusivo'), button(ids, session, 'rolepanelmax', '', 'Alterar máximo')));
    return (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'rolepanelview', 'panel');
}
function renderForms(session, ids, config, guild) {
    const view = String(session.state.formView ?? 'list');
    const form = selectedForm(session, config);
    if (view === 'appearance' && form)
        return renderFormAppearance(session, ids, config, form);
    if (view === 'questions' && form)
        return renderFormQuestions(session, ids, config, form);
    if (view === 'access' && form)
        return renderFormAccess(session, ids, config, form);
    if (view === 'panel' && form)
        return renderFormDetail(session, ids, config, form);
    const pending = Object.values(config.community.forms.submissions).filter(item => item.status === 'pending').length;
    const container = (0, common_1.baseContainer)(config.panel.color, 'Formulários e inscrições', `Formulários: ${config.community.forms.forms.length}/10 | Pendentes: ${pending}`);
    for (let index = 0; index < config.community.forms.forms.length; index += 5) {
        container.addActionRowComponents(row(...config.community.forms.forms.slice(index, index + 5).map(item => button(ids, session, 'formselect', item.id, item.name, item.enabled ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary))));
    }
    if (!config.community.forms.forms.length)
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Nenhum formulário criado.'));
    container.addActionRowComponents(row(button(ids, session, 'formcreate', '', 'Criar formulário', discord_js_1.ButtonStyle.Success, config.community.forms.forms.length >= 10), button(ids, session, 'communityopen', 'service', 'Voltar')));
    return (0, common_1.r8Footer)(container);
}
function renderFormDetail(session, ids, config, form) {
    const pending = Object.values(config.community.forms.submissions).filter(item => item.formId === form.id && item.status === 'pending').length;
    const container = (0, common_1.baseContainer)(config.panel.color, form.name, `Formulário ${form.id} | ${form.enabled ? 'ativado' : 'desativado'} | Pendentes: ${pending}`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Publicação: ${mentionChannel(form.publishChannelId)}\nRevisão: ${mentionChannel(form.reviewChannelId)}\nPerguntas: **${form.questions.length}/5**\nCargos ao aprovar: ${mentions(form.approvedRoleIds, 'role')}`));
    container.addActionRowComponents(row(button(ids, session, 'formview', 'appearance', 'Aparência e canais', discord_js_1.ButtonStyle.Primary), button(ids, session, 'formview', 'questions', 'Perguntas', discord_js_1.ButtonStyle.Primary), button(ids, session, 'formview', 'access', 'Acesso e aprovação')), row(button(ids, session, 'formpublish', '', 'Publicar', discord_js_1.ButtonStyle.Success, !form.publishChannelId || !form.reviewChannelId || !form.questions.length), button(ids, session, 'formtoggle', '', form.enabled ? 'Desativar' : 'Ativar', form.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success), button(ids, session, 'formdelete', '', 'Excluir', discord_js_1.ButtonStyle.Danger), button(ids, session, 'formview', 'list', 'Voltar')));
    return (0, common_1.r8Footer)(container);
}
function renderFormAppearance(session, ids, config, form) {
    const container = (0, common_1.baseContainer)(config.panel.color, 'Aparência do formulário', `Formulário: **${form.name}**`);
    container.addActionRowComponents(row(button(ids, session, 'formfield', 'name', 'Alterar nome', discord_js_1.ButtonStyle.Primary), button(ids, session, 'formfield', 'title', 'Alterar título', discord_js_1.ButtonStyle.Primary), button(ids, session, 'formfield', 'description', 'Alterar descrição', discord_js_1.ButtonStyle.Primary), button(ids, session, 'formfield', 'color', 'Alterar cor')), row(button(ids, session, 'formfield', 'buttonLabel', 'Texto do botão')), channelSelect(ids, session, 'formpublishchannel', 'Selecionar canal de publicação', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), channelSelect(ids, session, 'formreviewchannel', 'Selecionar canal privado de revisão', [discord_js_1.ChannelType.GuildText]));
    (0, common_1.backOnly)(container, ids, session, 'formview', 'panel');
    container.addSeparatorComponents(new discord_js_1.SeparatorBuilder().setSpacing(discord_js_1.SeparatorSpacingSize.Large));
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## Prévia real — formulário\n**${form.title}**\n${form.description}`));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('preview:form').setLabel(form.buttonLabel.slice(0, 80)).setStyle(discord_js_1.ButtonStyle.Primary).setDisabled(true)));
    return (0, common_1.r8Footer)(container);
}
function renderFormQuestions(session, ids, config, form) {
    const container = (0, common_1.baseContainer)(config.panel.color, 'Perguntas do formulário', `Formulário: **${form.name}** | máximo de cinco perguntas`);
    if (!form.questions.length)
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent('Nenhuma pergunta configurada.'));
    for (const question of form.questions) {
        container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`**${question.label}**\n${question.placeholder || 'sem placeholder'} | ${question.required ? 'obrigatória' : 'opcional'} | ${question.paragraph ? 'texto longo' : 'texto curto'}`));
        container.addActionRowComponents(row(button(ids, session, 'formquestionedit', question.id, 'Editar'), button(ids, session, 'formquestionremove', question.id, 'Remover', discord_js_1.ButtonStyle.Danger)));
    }
    container.addActionRowComponents(row(button(ids, session, 'formquestionadd', '', 'Adicionar pergunta', discord_js_1.ButtonStyle.Success, form.questions.length >= 5)));
    return (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'formview', 'panel');
}
function renderFormAccess(session, ids, config, form) {
    const container = (0, common_1.baseContainer)(config.panel.color, 'Acesso e aprovação', `Formulário: **${form.name}**`);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Cargos permitidos: ${mentions(form.allowedRoleIds, 'role')}\nCargos bloqueados: ${mentions(form.blockedRoleIds, 'role')}\nCargos adicionados ao aprovar: ${mentions(form.approvedRoleIds, 'role')}`));
    container.addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'formallowedrole')).setPlaceholder('Adicionar/remover cargo permitido')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'formblockedrole')).setPlaceholder('Adicionar/remover cargo bloqueado')), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder().setCustomId(ids.encode(session.id, 'formapprovedrole')).setPlaceholder('Cargo concedido ao aprovar')));
    return (0, common_1.backOnly)((0, common_1.r8Footer)(container), ids, session, 'formview', 'panel');
}
function selectedAutoCleanRule(session, config) {
    const id = String(session.state.autoCleanRuleId ?? '');
    return config.community.autoClean.rules.find(rule => rule.id === id) ?? config.community.autoClean.rules[0] ?? null;
}
function autoCleanModeLabel(mode) {
    return { all: 'Tudo', images: 'Imagens', text: 'Mensagens de texto', links: 'Links' }[mode];
}
function formatAutoCleanDelay(seconds) {
    if (seconds < 60)
        return `${seconds}s`;
    if (seconds < 3600)
        return `${Math.round(seconds / 60)} min`;
    if (seconds < 86400)
        return `${Math.round(seconds / 3600)} h`;
    return `${Math.round(seconds / 86400)} d`;
}
function selectedRolePanel(session, config) {
    const id = String(session.state.rolePanelId ?? '');
    return config.community.rolePanels.panels.find(panel => panel.id === id) ?? config.community.rolePanels.panels[0] ?? null;
}
function selectedForm(session, config) {
    const id = String(session.state.formId ?? '');
    return config.community.forms.forms.find(form => form.id === id) ?? config.community.forms.forms[0] ?? null;
}
function selectedTicketPanel(session, config) {
    const id = String(session.state.ticketPanelId ?? '');
    return config.community.tickets.panels.find(panel => panel.id === id) ?? config.community.tickets.panels[0] ?? null;
}
function button(ids, session, action, arg, label, style = discord_js_1.ButtonStyle.Secondary, disabled = false) {
    return new discord_js_1.ButtonBuilder().setCustomId(ids.encode(session.id, action, arg)).setLabel(label.slice(0, 80)).setStyle(style).setDisabled(disabled);
}
function row(...items) { return new discord_js_1.ActionRowBuilder().addComponents(...items); }
function channelSelect(ids, session, action, placeholder, types) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder().setCustomId(ids.encode(session.id, action)).setPlaceholder(placeholder).setChannelTypes(...types).setMinValues(1).setMaxValues(1));
}
function mentions(values, kind) { return values.length ? values.map(id => kind === 'role' ? `<@&${id}>` : `<@${id}>`).join(', ') : 'nenhum'; }
function mentionChannel(id) { return id ? `<#${id}>` : 'não configurado'; }
function yes(value) { return value ? 'sim' : 'não'; }
function buttonLabel(key) {
    return { claim: 'Assumir', unclaim: 'Deixar atendimento', close: 'Fechar', reopen: 'Reabrir', delete: 'Excluir', addMember: 'Adicionar membro', removeMember: 'Remover membro', createVoice: 'Criar call', transfer: 'Transferir', priority: 'Prioridade', rename: 'Renomear', transcript: 'Transcript' }[key] ?? String(key);
}
function renderRoleBackup(container, session, ids, config) {
    const latest = config.community.roleBackups.at(-1);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(latest
        ? `Último backup: **${latest.id}**\nCargos salvos: **${latest.roles.length}**\nCriado: <t:${Math.floor(Date.parse(latest.createdAt) / 1000)}:R>\nRetenção: **${config.community.roleBackups.length}/10**`
        : 'Nenhum backup de cargos foi criado.'));
    container.addActionRowComponents(row(button(ids, session, 'rolebackupcreate', '', 'Criar backup', discord_js_1.ButtonStyle.Primary), button(ids, session, 'rolebackuprestore', '', 'Restaurar último', discord_js_1.ButtonStyle.Danger, !latest), button(ids, session, 'communityopen', 'roles', 'Voltar', discord_js_1.ButtonStyle.Secondary)));
}
function renderVoiceActivity(container, session, ids, config, guild) {
    const item = config.community.voiceActivity;
    const registered = new Set([...Object.keys(item.totalsSeconds), ...Object.keys(item.activeSince)]).size;
    const voiceStates = guild?.voiceStates?.cache?.values ? [...guild.voiceStates.cache.values()] : [];
    const activeMembers = voiceStates.filter((state) => state.channelId && !state.member?.user?.bot).length;
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`Status: **${item.enabled ? 'ativado' : 'desativado'}**\nCanal do ranking: ${mentionChannel(item.channelId)}\nAtualização: **a cada ${item.updateSeconds} segundos**\nEm call agora: **${activeMembers}**\nParticipantes contabilizados: **${registered}**`));
    container.addActionRowComponents(channelSelect(ids, session, 'voiceactivitychannel', 'Selecionar canal do ranking', [discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement]), row(button(ids, session, 'voiceactivitytoggle', '', item.enabled ? 'Desativar' : 'Ativar', item.enabled ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Success), button(ids, session, 'voiceactivityrefresh', '', 'Atualizar agora', discord_js_1.ButtonStyle.Primary), button(ids, session, 'voiceactivityreset', '', 'Zerar ranking', discord_js_1.ButtonStyle.Danger), button(ids, session, 'communityopen', 'utilities', 'Voltar', discord_js_1.ButtonStyle.Secondary)));
}
//# sourceMappingURL=communityPage.js.map