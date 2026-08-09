/**
 * Catálogo visual do painel.
 * Os IDs são validados em runtime para impedir que um emoji removido ou
 * inacessível derrube um menu inteiro com COMPONENT_INVALID_EMOJI.
 */
const PROVIDED_UI_EMOJIS = {
  home: '1535353166361788476',
  community: '1535353165057228890',
  shield: '1535353163241230466',
  paper: '1535353161827745936',
  settings: '1535353160263270611',
  palette: '1535353159034208336',
  tutorial: '1535353157595693117',
  archive: '1535353156431210927',
  chart: '1535353155028783225',
  ticket: '1535353153415302808',
  megaphone: '1535353152386367498',
  puzzle: '1535353151099007371',
  tools: '1535353149852753920',
  moderator: '1535353148431011950',
  ranking: '1535353146480787539',
  telloyn: '1535353144584708187',
  instagram: '1535353143284736140',
  twitter: '1535353141892096151',
  heart: '1534554053223387198',
  topic: '1534554052107702312',
  more: '1534554050350288967',
  trash: '1534554049180078131',
  close: '1535356513823105045',
  loading: '1535357133665603594',

  roles: '1535361751057694780',
  fun: '1535361944175902740',
  social: '1535362025977290852',
  form: '1535362115605364808',
  autorole: '1535362246857850950',
  cleanup: '1535362343767380109',
  rank: '1535362435505066015',
  call: '1535362541302063234',
  stafflog: '1535362685602893925',
  moderation: '1535362825382264873',
  ban: '1535362960929595483',
  mute: '1535363071806017616',
  kick: '1535363216425746472',
  revoke: '1535363332389998715',
  star: '1535363410227888209',
  podium: '1535363507560783882',
  giveaway: '1535363619703890011',
  vote: '1535363713090064446',
  suggestion: '1535363825489023137',
  tempvoice: '1535364094717329519',
  activity: '1535364203513258114',
  aliases: '1535364304121888819',
  member: '1535364383620988988',
  discord: '1535364524151017564',
  boost: '1535364620393513040',
  emoji: '1535364744394051725',
  calculator: '1535364946899243034',
  clock: '1535365039781847121',
  search: '1535365135994986506',
  bot: '1535365247290843236',
  crown: '1535365332636803233',
  massroles: '1535365491647057970',
  add: '1535365581182738443',
  subtract: '1535365719158685818',
  check: '1535365782828089424',
  error: '1535365876130390096',
  left: '1535370886595616820',
  right: '1535370890592919623'
} as const;

export type UiEmojiKey = keyof typeof PROVIDED_UI_EMOJIS;

/** Objeto mutável somente para a hidratação/validação feita no clientReady. */
export const UI_EMOJIS: Record<UiEmojiKey, string> = { ...PROVIDED_UI_EMOJIS };

const UI_EMOJI_FALLBACKS: Record<UiEmojiKey, string> = {
  home: '\u{1F3E0}',
  community: '\u{1F465}',
  shield: '\u{1F6E1}\u{FE0F}',
  paper: '\u{1F4CB}',
  settings: '\u{2699}\u{FE0F}',
  palette: '\u{1F3A8}',
  tutorial: '\u{1F4D8}',
  archive: '\u{1F4C1}',
  chart: '\u{1F4CA}',
  ticket: '\u{1F3AB}',
  megaphone: '\u{1F4E2}',
  puzzle: '\u{1F9E9}',
  tools: '\u{1F527}',
  moderator: '\u{1F9D1}\u{200D}\u{1F4BC}',
  ranking: '\u{1F4C8}',
  telloyn: '\u{1F4AD}',
  instagram: '\u{1F4F7}',
  twitter: '\u{1D54F}',
  heart: '\u{2665}\u{FE0F}',
  topic: '\u{1F4AC}',
  more: '\u{2026}',
  trash: '\u{1F5D1}\u{FE0F}',
  close: '\u{2716}\u{FE0F}',
  loading: '\u{23F3}',
  roles: '\u{1F3F7}\u{FE0F}',
  fun: '\u{1F3AE}',
  social: '\u{1F91D}',
  form: '\u{1F4DD}',
  autorole: '\u{1F501}',
  cleanup: '\u{1F9F9}',
  rank: '\u{1F3C6}',
  call: '\u{1F399}\u{FE0F}',
  stafflog: '\u{1F4DC}',
  moderation: '\u{1F528}',
  ban: '\u{1F6AB}',
  mute: '\u{1F507}',
  kick: '\u{21AA}\u{FE0F}',
  revoke: '\u{21A9}\u{FE0F}',
  star: '\u{2B50}',
  podium: '\u{1F947}',
  giveaway: '\u{1F381}',
  vote: '\u{1F5F3}\u{FE0F}',
  suggestion: '\u{1F4A1}',
  tempvoice: '\u{1F3A7}',
  activity: '\u{1F504}',
  aliases: '#\u{FE0F}\u{20E3}',
  member: '\u{1F464}',
  discord: '\u{1F4A0}',
  boost: '\u{1F48E}',
  emoji: '\u{1F642}',
  calculator: '\u{1F522}',
  clock: '\u{1F552}',
  search: '\u{1F50E}',
  bot: '\u{1F916}',
  crown: '\u{1F451}',
  massroles: '\u{1F5C2}\u{FE0F}',
  add: '\u{2795}',
  subtract: '\u{2796}',
  check: '\u{2705}',
  error: '\u{2757}',
  left: '\u{2B05}\u{FE0F}',
  right: '\u{27A1}\u{FE0F}'
};
const UI_EMOJI_NAME_HINTS: Record<UiEmojiKey, string[]> = {
  home: ['icons8casa50', 'casa'], community: ['icons8comunidade50', 'comunidade'], shield: ['icons8escudo50', 'escudo'],
  paper: ['icons8papel50', 'papel'], settings: ['icons8engrenagem48', 'engrenagem'], palette: ['paletadepintura', 'paleta'],
  tutorial: ['icons8cursos50', 'cursos'], archive: ['icons8arquivo50', 'arquivo'], chart: ['icons8grafico48', 'grafico'],
  ticket: ['icons8bilhete48', 'bilhete'], megaphone: ['icons8megafone64', 'megafone'], puzzle: ['icons8puzzle128', 'puzzle'],
  tools: ['icons8ferramenta50', 'ferramenta'], moderator: ['moderadormasculino', 'moderador'], ranking: ['icons8classificacao48', 'classificacao'],
  telloyn: ['telloyn', 'tell'], instagram: ['icons8instagram50', 'instagram'], twitter: ['icons8twitter50', 'twitter'],
  heart: ['icons8coracao32', 'coracao'], topic: ['icons8topico50', 'topico'], more: ['icons8reticencias30', 'reticencias'],
  trash: ['icons8lixo48', 'lixo'], close: ['icons8errado24', 'errado'], loading: ['icons8carregando', 'carregando'],

  roles: ['icons8primeiroplanodogruposeleci', 'primeiroplanodogruposeleci', 'cargos'],
  fun: ['icons8diverso50', 'diverso'], social: ['icons8tarefadegrupo48', 'tarefadegrupo'], form: ['icons8formulriodeaplicao24', 'formulariodeaplicacao'],
  autorole: ['icons8gerentedeinformaesdoclient', 'gerentedeinformacoesdocliente'], cleanup: ['icons8vassoura30', 'vassoura'],
  rank: ['icons8trofu30', 'trofu'], call: ['icons8microfone48', 'microfone48'], stafflog: ['icons8histrico48', 'historico48'],
  moderation: ['icons8martelo48', 'martelo'], ban: ['icons8usuriobloqueado24', 'usuariobloqueado'], mute: ['icons8semmicrofone50', 'semmicrofone'],
  kick: ['icons8amigoremovido50', 'amigoremovido'], revoke: ['icons8desfazer50', 'desfazer'], star: ['icons8estrela50', 'estrela'],
  podium: ['icons8pdio24', 'podio'], giveaway: ['icons8presente48', 'presente'], vote: ['icons8votao64', 'votacao'],
  suggestion: ['icons8lmpada24', 'lampada'], tempvoice: ['icons8microfone64', 'microfone64'], activity: ['icons8atividade48', 'atividade'],
  aliases: ['icons8cdigofonte64', 'codigofonte'], member: ['icons8usurio24', 'usuario24'], discord: ['icons8novologtipodiscord24', 'novologtipodiscord'],
  boost: ['icons8impulsodediscrdiadenvel224', 'impulsodediscord'], emoji: ['icons8feliz25', 'feliz25'], calculator: ['icons8numeroquadrado50', 'numeroquadrado'],
  clock: ['icons8relgio48', 'relogio'], search: ['icons8lupadefaca64', 'lupadefaca'], bot: ['icons8rob50', 'robo50'], crown: ['icons8coroa24', 'coroa'],
  massroles: ['icons8pessoasdoorganograma24', 'pessoasdoorganograma'], add: ['icons8adicionar24', 'adicionar'], subtract: ['icons8subtrao64', 'subtracao'],
  check: ['icons8selecionado50', 'selecionado'], error: ['icons8erro24', 'erro24'],
  left: ['icons8left30', 'left30', 'esquerda'], right: ['icons8direita30', 'direita30', 'direita']
};

let emojiCatalogReady = false;
let validCustomEmojiIds = new Set<string>();

export interface UiEmojiHydrationResult {
  available: number;
  repaired: Array<{ key: UiEmojiKey; previousId: string; resolvedId: string }>;
  fallback: Array<{ key: UiEmojiKey; id: string }>;
}

/**
 * Busca emojis do próprio aplicativo e dos servidores em cache. IDs que não
 * puderem ser usados são substituídos por unicode para o painel nunca quebrar.
 */
export async function hydrateUiEmojis(client: any): Promise<UiEmojiHydrationResult> {
  const available = new Map<string, { id: string; name: string }>();

  const register = (emoji: any): void => {
    const id = String(emoji?.id ?? '');
    if (!/^\d{16,22}$/.test(id)) return;
    available.set(id, { id, name: String(emoji?.name ?? '') });
  };

  try {
    const applicationEmojis = await client.application?.emojis?.fetch?.();
    for (const emoji of applicationEmojis?.values?.() ?? []) register(emoji);
  } catch { /* fallback seguro abaixo */ }

  for (const guild of client.guilds?.cache?.values?.() ?? []) {
    try {
      const fetched = await guild.emojis?.fetch?.();
      for (const emoji of fetched?.values?.() ?? []) register(emoji);
    } catch {
      for (const emoji of guild.emojis?.cache?.values?.() ?? []) register(emoji);
    }
  }

  validCustomEmojiIds = new Set(available.keys());
  emojiCatalogReady = true;
  const repaired: UiEmojiHydrationResult['repaired'] = [];
  const fallback: UiEmojiHydrationResult['fallback'] = [];
  const all = [...available.values()];

  for (const key of Object.keys(PROVIDED_UI_EMOJIS) as UiEmojiKey[]) {
    const configuredId = PROVIDED_UI_EMOJIS[key];
    if (available.has(configuredId)) {
      UI_EMOJIS[key] = configuredId;
      continue;
    }

    const hints = UI_EMOJI_NAME_HINTS[key].map(normalizeEmojiName);
    const byName = all.find(item => {
      const candidate = normalizeEmojiName(item.name);
      if (!candidate) return false;
      return hints.some(hint => candidate === hint || candidate.includes(hint) || hint.includes(candidate));
    });
    if (byName) {
      UI_EMOJIS[key] = byName.id;
      repaired.push({ key, previousId: configuredId, resolvedId: byName.id });
      continue;
    }

    UI_EMOJIS[key] = UI_EMOJI_FALLBACKS[key];
    fallback.push({ key, id: configuredId });
  }

  refreshDerivedEmojiMaps();
  return { available: available.size, repaired, fallback };
}

/** Valida emojis configuráveis de tickets, Instagram e painéis de cargos. */
export function resolveConfiguredEmoji(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  const markup = raw.match(/^<a?:[^:>]+:(\d{16,22})>$/);
  const id = markup?.[1] ?? (/^\d{16,22}$/.test(raw) ? raw : null);
  if (!id) return raw;
  if (!emojiCatalogReady) return id;
  return validCustomEmojiIds.has(id) ? id : null;
}

export const UI_LOADING_MENTION = `<a:icons8carregando:${PROVIDED_UI_EMOJIS.loading}>`;

function normalizeEmojiName(value: string): string {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

export const COMMUNITY_CATEGORY_EMOJIS: Record<string, string> = {
  service: UI_EMOJIS.ticket,
  messages: UI_EMOJIS.megaphone,
  fun: UI_EMOJIS.fun,
  roles: UI_EMOJIS.roles,
  utilities: UI_EMOJIS.tools
};

export const COMMUNITY_FUNCTION_EMOJIS: Record<string, string> = {
  tickets: UI_EMOJIS.ticket,
  forms: UI_EMOJIS.form,
  welcome: UI_EMOJIS.community,
  goodbye: UI_EMOJIS.member,
  suggestions: UI_EMOJIS.suggestion,
  telloyn: UI_EMOJIS.telloyn,
  instagram: UI_EMOJIS.instagram,
  twitter: UI_EMOJIS.twitter,
  voice: UI_EMOJIS.tempvoice,
  autorole: UI_EMOJIS.autorole,
  rolepanels: UI_EMOJIS.puzzle,
  massroles: UI_EMOJIS.massroles,
  rolebackup: UI_EMOJIS.archive,
  cl: UI_EMOJIS.cleanup,
  autoclean: UI_EMOJIS.trash,
  voiceactivity: UI_EMOJIS.call
};

export const TUTORIAL_SECTION_EMOJIS: Record<string, string> = {
  start: UI_EMOJIS.home,
  community: UI_EMOJIS.community,
  moderation: UI_EMOJIS.moderation,
  protection: UI_EMOJIS.shield,
  bot: UI_EMOJIS.bot
};

export const TUTORIAL_ENTRY_EMOJIS: Record<string, string> = {
  checklist: UI_EMOJIS.check,
  permissions: UI_EMOJIS.shield,
  performance: UI_EMOJIS.chart,
  tickets: UI_EMOJIS.ticket,
  messages: UI_EMOJIS.community,
  suggestions: UI_EMOJIS.suggestion,
  telloyn: UI_EMOJIS.telloyn,
  social: UI_EMOJIS.social,
  voice: UI_EMOJIS.tempvoice,
  rankcall: UI_EMOJIS.call,
  roles: UI_EMOJIS.roles,
  forms: UI_EMOJIS.form,
  stafflog: UI_EMOJIS.stafflog,
  punishments: UI_EMOJIS.ban,
  cases: UI_EMOJIS.archive,
  cleanup: UI_EMOJIS.cleanup,
  raid: UI_EMOJIS.shield,
  structure: UI_EMOJIS.puzzle,
  quarantine: UI_EMOJIS.moderator,
  bypass: UI_EMOJIS.crown,
  backups: UI_EMOJIS.archive,
  logs: UI_EMOJIS.paper,
  presence: UI_EMOJIS.activity,
  variables: UI_EMOJIS.clock,
  aliases: UI_EMOJIS.aliases,
  commands: UI_EMOJIS.tools,
  panel: UI_EMOJIS.palette
};

/** Atualiza os mapas derivados depois da hidratação do catálogo principal. */
export function refreshDerivedEmojiMaps(): void {
  Object.assign(COMMUNITY_CATEGORY_EMOJIS, {
    service: UI_EMOJIS.ticket,
    messages: UI_EMOJIS.megaphone,
    fun: UI_EMOJIS.fun,
    roles: UI_EMOJIS.roles,
    utilities: UI_EMOJIS.tools
  });
  Object.assign(COMMUNITY_FUNCTION_EMOJIS, {
    tickets: UI_EMOJIS.ticket,
    forms: UI_EMOJIS.form,
    welcome: UI_EMOJIS.community,
    goodbye: UI_EMOJIS.member,
    suggestions: UI_EMOJIS.suggestion,
    telloyn: UI_EMOJIS.telloyn,
    instagram: UI_EMOJIS.instagram,
    twitter: UI_EMOJIS.twitter,
    voice: UI_EMOJIS.tempvoice,
    autorole: UI_EMOJIS.autorole,
    rolepanels: UI_EMOJIS.puzzle,
    massroles: UI_EMOJIS.massroles,
    rolebackup: UI_EMOJIS.archive,
    cl: UI_EMOJIS.cleanup,
    autoclean: UI_EMOJIS.trash,
    voiceactivity: UI_EMOJIS.call
  });
  Object.assign(TUTORIAL_SECTION_EMOJIS, {
    start: UI_EMOJIS.home,
    community: UI_EMOJIS.community,
    moderation: UI_EMOJIS.moderation,
    protection: UI_EMOJIS.shield,
    bot: UI_EMOJIS.bot
  });
  Object.assign(TUTORIAL_ENTRY_EMOJIS, {
    checklist: UI_EMOJIS.check,
    permissions: UI_EMOJIS.shield,
    performance: UI_EMOJIS.chart,
    tickets: UI_EMOJIS.ticket,
    messages: UI_EMOJIS.community,
    suggestions: UI_EMOJIS.suggestion,
    telloyn: UI_EMOJIS.telloyn,
    social: UI_EMOJIS.social,
    voice: UI_EMOJIS.tempvoice,
    rankcall: UI_EMOJIS.call,
    roles: UI_EMOJIS.roles,
    forms: UI_EMOJIS.form,
    stafflog: UI_EMOJIS.stafflog,
    punishments: UI_EMOJIS.ban,
    cases: UI_EMOJIS.archive,
    cleanup: UI_EMOJIS.cleanup,
    raid: UI_EMOJIS.shield,
    structure: UI_EMOJIS.puzzle,
    quarantine: UI_EMOJIS.moderator,
    bypass: UI_EMOJIS.crown,
    backups: UI_EMOJIS.archive,
    logs: UI_EMOJIS.paper,
    presence: UI_EMOJIS.activity,
    variables: UI_EMOJIS.clock,
    aliases: UI_EMOJIS.aliases,
    commands: UI_EMOJIS.tools,
    panel: UI_EMOJIS.palette
  });
}
