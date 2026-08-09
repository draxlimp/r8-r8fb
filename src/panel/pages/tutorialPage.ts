import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder
} from 'discord.js';
import type { GuildConfig } from '../../types/guildConfig';
import type { CustomIdManager } from '../customIdManager';
import type { PanelSession } from '../sessionManager';
import { baseContainer, navigation } from '../components/common';
import { TUTORIAL_ENTRY_EMOJIS, TUTORIAL_SECTION_EMOJIS, UI_EMOJIS } from '../../ui/emojis';

type TutorialEntry = {
  label: string;
  summary: string;
  body: string;
};

type TutorialSection = {
  label: string;
  description: string;
  entries: Record<string, TutorialEntry>;
};

const TUTORIALS: Record<string, TutorialSection> = {
  start: {
    label: 'Primeiros passos',
    description: 'Configuração recomendada para deixar o servidor pronto.',
    entries: {
      checklist: {
        label: 'Configuração inicial',
        summary: 'A ordem recomendada para configurar tudo sem esquecer nada.',
        body: [
          '**1. Acesso ao painel**\nDefina quem pode administrar o bot e, se quiser, limite os canais onde o painel pode ser aberto.',
          '**2. Logs**\nEscolha um canal principal de logs. Depois ajuste eventos específicos que precisem de outro canal.',
          '**3. Backups**\nMantenha backup automático e snapshot ligados antes de ativar proteções de restauração.',
          '**4. Proteção**\nComece por links, spam, convites, contas novas e raid. Só depois ative proteções administrativas mais rígidas.',
          '**5. Comunidade**\nConfigure boas-vindas, tickets, sugestões, cargos, calls e recursos sociais conforme o servidor realmente usar.',
          '**6. Comandos**\nRevise permissões e aliases dos comandos administrativos para evitar uso por pessoas erradas.'
        ].join('\n\n')
      },
      permissions: {
        label: 'Permissões do bot',
        summary: 'Como posicionar o cargo do bot e evitar erros de hierarquia.',
        body: [
          'Coloque o cargo do bot **acima dos cargos que ele precisa gerenciar**.',
          'Para moderação, dê apenas as permissões necessárias: gerenciar mensagens, moderar, expulsar ou banir conforme os módulos usados.',
          'Para o Staff Log identificar ações feitas diretamente pelo Discord, habilite **Ver Registro de Auditoria** para o bot.',
          'Para cargos automáticos e painéis de cargo, o bot precisa de **Gerenciar Cargos** e o cargo entregue deve ficar abaixo dele.',
          'Para logs, tickets e mensagens automáticas, confirme **Ver Canal**, **Enviar Mensagens**, **Incorporar Links** e **Anexar Arquivos** nos canais usados.',
          'Evite deixar o bot abaixo de cargos de membros que ele precisa moderar.'
        ].join('\n\n')
      },
      performance: {
        label: 'Melhor desempenho',
        summary: 'Ajustes para manter o bot rápido e o servidor organizado.',
        body: [
          'Use canais de log separados quando o servidor tiver muito movimento. Isso evita que segurança, tickets e comunidade fiquem misturados.',
          'Não ative módulos que o servidor não usa. Menos automações desnecessárias deixam a configuração mais previsível.',
          'Mantenha o Rank Call com atualização entre **10 e 30 segundos** em comunidades grandes.',
          'Evite cooldown zero em comandos públicos que geram imagem ou muitas consultas.',
          'Faça um backup antes de mudanças grandes em cargos, canais ou proteções.'
        ].join('\n\n')
      }
    }
  },
  community: {
    label: 'Comunidade',
    description: 'Tickets, mensagens, social, cargos e atividade.',
    entries: {
      tickets: {
        label: 'Tickets',
        summary: 'Atendimento com painéis, equipe, perguntas e transcript.',
        body: 'Crie um painel, escolha o canal onde ele será publicado, defina a categoria dos tickets e os cargos de suporte. Depois ajuste limite por usuário, perguntas iniciais, transcript, avaliação, horário e botões internos. Publique o painel somente depois de revisar a aparência externa e a tela interna do atendimento.'
      },
      messages: {
        label: 'Entrada e saída',
        summary: 'Boas-vindas e despedidas configuráveis.',
        body: 'Ative a função, selecione o canal e personalize título, descrição e imagem. Use os placeholders disponíveis para nome, menção, servidor e quantidade de membros. Teste a mensagem pelo painel antes de deixar a automação ativa para todos.'
      },
      suggestions: {
        label: 'Sugestões',
        summary: 'Canal organizado para ideias da comunidade.',
        body: 'Escolha o canal de sugestões e, se desejar, um canal separado para revisão da staff. Decida se sugestões anônimas serão permitidas e se cada sugestão abrirá uma thread para discussão.'
      },
      telloyn: {
        label: 'Telloyn',
        summary: 'Mensagens públicas ou anônimas em um cartão próprio.',
        body: 'Escolha o canal de publicação, defina se mensagens públicas e anônimas serão aceitas, limite o tamanho das mensagens e configure um canal de log. Depois publique o painel para os membros enviarem as mensagens pelo fluxo guiado.'
      },
      social: {
        label: 'Instagram e X',
        summary: 'Canais sociais com apresentação própria.',
        body: 'Escolha o canal de cada módulo e defina quem pode publicar. No Instagram você pode exigir mídia e controlar comentários. No X você escolhe se a mensagem original será apagada e se anexos serão aceitos. Os dois módulos usam a identidade do servidor e não exibem assinatura fixa do bot.'
      },
      voice: {
        label: 'Calls temporárias',
        summary: 'Criação automática de salas de voz.',
        body: 'Crie ou escolha um canal criador e uma categoria de destino. Defina o padrão do nome da sala e o limite padrão de usuários. Quando alguém entrar no criador, o bot abre a sala e acompanha o dono até ela ficar vazia.'
      },
      rankcall: {
        label: 'Rank Call',
        summary: 'Ranking de tempo real em canais de voz.',
        body: 'Ative o módulo, escolha o canal do ranking e publique/atualize a mensagem. O bot consolida o tempo de quem está em voz, mostra membros ativos e mantém totais por servidor. Se trocar o canal, atualize a mensagem para o ranking continuar no lugar correto.'
      },
      roles: {
        label: 'Cargos',
        summary: 'Autorole, painéis, cargos temporários e operações em massa.',
        body: 'Para Autorole, escolha separadamente cargos de membros, bots e todos. Nos painéis, crie opções e regras de acesso antes de publicar. Para cargos temporários, use duração e motivo. Operações em massa devem ficar restritas a cargos autorizados e sempre respeitam a hierarquia do Discord.'
      },
      forms: {
        label: 'Formulários',
        summary: 'Aplicações e inscrições dentro do Discord.',
        body: 'Crie o formulário, escolha perguntas, canal de revisão, cargos permitidos/bloqueados e cargos entregues quando aprovado. Publique a versão final apenas depois de testar as perguntas e o fluxo de aprovação.'
      }
    }
  },
  moderation: {
    label: 'Moderação e staff',
    description: 'Comandos, casos, punições e acompanhamento da equipe.',
    entries: {
      stafflog: {
        label: 'Staff Log',
        summary: 'Veja ações de um moderador e revogue punições ativas.',
        body: 'Use **!stafflog @staff**. O painel mostra bans, timeouts e outras ações registradas para aquele moderador e tenta importar o histórico recente do Registro de Auditoria quando o bot tem acesso. Selecione um caso para ver alvo, motivo, data e estado. Quando a punição ainda estiver ativa e você tiver permissão, use **Revogar** para remover o ban ou timeout. O histórico continua guardado mesmo depois da revogação.'
      },
      punishments: {
        label: 'Ban, mute e warn',
        summary: 'Fluxo padrão das punições por prefixo.',
        body: 'Use **!ban**, **!tempban**, **!mute/!timeout** e **!warn** com membro, duração quando necessária e motivo. Cada ação cria um caso. Use **!unban**, **!unmute** ou **!unwarn** para remover punições manualmente.'
      },
      cases: {
        label: 'Casos e histórico',
        summary: 'Consulta e manutenção do histórico de moderação.',
        body: 'Use **!history @membro** para o histórico do alvo, **!case ID** para abrir um caso, **!cases** para listar casos e **!reason CASE-ID novo motivo** para corrigir o motivo. O Staff Log é voltado para o histórico do moderador; History é voltado para o histórico de quem recebeu as ações.'
      },
      cleanup: {
        label: 'Limpeza de mensagens',
        summary: 'Limpeza comum e filtros específicos.',
        body: 'Use **!clear** para quantidade simples. Para filtros, use os comandos de limpeza por usuário, bots, links, anexos, menções ou conteúdo. O comando CL também possui configuração própria no painel para limitar varredura e acesso.'
      },
      voice: {
        label: 'Moderação em call',
        summary: 'Silenciar, mover e controlar canais de voz.',
        body: 'Os comandos de voz permitem silenciar, dessilenciar, ensurdecer, mover membros e bloquear/desbloquear calls. A hierarquia e as permissões nativas do Discord continuam valendo.'
      }
    }
  },
  protection: {
    label: 'Proteção',
    description: 'Anti-spam, anti-raid, segurança administrativa e recuperação.',
    entries: {
      messages: {
        label: 'Proteções de chat',
        summary: 'Links, convites, spam, flood e conteúdo bloqueado.',
        body: 'Ative somente os filtros necessários. Ajuste quantidade, intervalo, canais/cargos ignorados e punição. Para links e domínios, use listas permitidas ou bloqueadas. Comece com modo de log ou punição leve e aumente depois de testar.'
      },
      raid: {
        label: 'Anti-raid',
        summary: 'Contas novas, entrada em massa e modo de emergência.',
        body: 'Configure idade mínima de conta, quantidade de entradas e intervalo. O modo raid pode ser automático ou manual. Em servidores grandes, teste os limites para não tratar picos legítimos como ataque.'
      },
      structure: {
        label: 'Canais e cargos',
        summary: 'Proteção contra alterações administrativas perigosas.',
        body: 'As proteções estruturais observam exclusão, criação, edição, movimentação e permissões de canais/cargos. Quando restauração estiver ativa, mantenha snapshots e backups funcionando para o bot ter uma referência confiável.'
      },
      quarantine: {
        label: 'Quarentena',
        summary: 'Isolamento temporário com restauração de cargos.',
        body: 'Defina o cargo de quarentena ou permita criação automática. Escolha se os cargos anteriores serão restaurados ao final. Cargos protegidos não devem ser removidos automaticamente.'
      },
      bypass: {
        label: 'Bypass',
        summary: 'Exceções controladas para pessoas, cargos e bots.',
        body: 'Crie bypass apenas quando necessário, limite-o aos módulos corretos e use expiração quando a exceção for temporária. Prefira continuar registrando logs mesmo quando a punição for ignorada.'
      },
      backups: {
        label: 'Backups e snapshots',
        summary: 'Base para recuperar estrutura e configurações.',
        body: 'Mantenha backup automático diário e snapshots periódicos. Antes de alterações grandes, crie um backup manual. Use restauração somente depois de revisar o conteúdo e confirmar que o bot possui hierarquia suficiente.'
      },
      logs: {
        label: 'Logs',
        summary: 'Registro separado por categoria, evento e gravidade.',
        body: 'Defina um canal padrão e altere apenas eventos que precisem de outro destino. Ajuste gravidade mínima e detalhes. Segurança crítica pode usar um segundo canal ou menção de cargo sem poluir os logs normais.'
      }
    }
  },
  bot: {
    label: 'Bot e comandos',
    description: 'Perfil, status, aliases, permissões e painel.',
    entries: {
      presence: {
        label: 'Status rotativo',
        summary: 'Atividades que mudam automaticamente em loop.',
        body: 'Na Personalização, edite a lista de atividades. Cada linha pode usar o formato **tipo | texto**. Com a rotação ligada, o bot troca automaticamente entre as atividades no intervalo configurado. O padrão recomendado é 5 segundos.'
      },
      variables: {
        label: 'Aliases de status',
        summary: 'Valores dinâmicos dentro do texto da atividade.',
        body: 'Você pode usar **[members]**, **[servers]**, **[channels]**, **[prefix]**, **[bot]**, **[ping]** e **[uptime]**. Exemplo: `watching | [members] membros na comunidade`. O valor é atualizado a cada troca de status.'
      },
      aliases: {
        label: 'Aliases de comandos',
        summary: 'Nomes alternativos para comandos de prefixo.',
        body: 'Abra Config Bot > Aliases, escolha o comando e informe nomes alternativos separados por vírgula. Não use o prefixo dentro do campo. Exemplo: o comando **!stafflog** pode ter aliases como **!staff**, **!acoes** e **!modstaff**.'
      },
      commands: {
        label: 'Permissões de comandos',
        summary: 'Controle por cargo, pessoa, canal e cooldown.',
        body: 'Em Config Bot > Comandos, abra uma função e escolha se ela está ativa. Você pode restringir por cargos, usuários ou canais, configurar cooldown e decidir se a mensagem que chamou o comando será apagada.'
      },
      panel: {
        label: 'Acesso ao painel',
        summary: 'Quem pode administrar a configuração do servidor.',
        body: 'Defina proprietários, administradores, usuários e cargos autorizados. Também é possível limitar canais. Para comunidades grandes, deixe o painel restrito à equipe principal e use os comandos de prefixo para tarefas rápidas dos moderadores.'
      }
    }
  }
};

export function tutorialPage(session: PanelSession, ids: CustomIdManager, config: GuildConfig): any {
  const sectionKey = String(session.state.tutorialSection ?? 'start');
  const section = TUTORIALS[sectionKey] ?? TUTORIALS.start!;
  const entryKey = String(session.state.tutorialEntry ?? Object.keys(section.entries)[0]);
  const entry = section.entries[entryKey] ?? section.entries[Object.keys(section.entries)[0]!]!;

  const container = baseContainer(config.panel.color, 'Tutorial', 'Guia de configuração e uso das funções do servidor.');
  const sectionMenu = new StringSelectMenuBuilder()
    .setCustomId(ids.encode(session.id, 'tutorialsection'))
    .setPlaceholder('Escolha uma área do tutorial')
    .setMinValues(1).setMaxValues(1)
    .addOptions(...Object.entries(TUTORIALS).map(([value, item]) =>
      new StringSelectMenuOptionBuilder().setLabel(item.label).setDescription(item.description).setValue(value).setEmoji(TUTORIAL_SECTION_EMOJIS[value] ?? UI_EMOJIS.tutorial).setDefault(value === sectionKey)
    ));

  const entryMenu = new StringSelectMenuBuilder()
    .setCustomId(ids.encode(session.id, 'tutorialentry'))
    .setPlaceholder('Escolha uma função')
    .setMinValues(1).setMaxValues(1)
    .addOptions(...Object.entries(section.entries).map(([value, item]) =>
      new StringSelectMenuOptionBuilder().setLabel(item.label).setDescription(item.summary).setValue(value).setEmoji(TUTORIAL_ENTRY_EMOJIS[value] ?? UI_EMOJIS.more).setDefault(value === entryKey)
    ));

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sectionMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(entryMenu)
  );
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${entry.label}\n${entry.summary}\n\n${entry.body}`));
  return navigation(container, ids, session);
}
