"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomCommunityTopic = randomCommunityTopic;
exports.randomWouldYouRather = randomWouldYouRather;
const COMMUNITY_TOPICS = [
    'Qual foi a melhor coisa que aconteceu com você esta semana?',
    'Que habilidade você gostaria de aprender este ano?',
    'Qual jogo, série ou filme você recomendaria para a comunidade?',
    'Se pudesse organizar um evento no servidor hoje, qual seria?',
    'Qual música combina com seu dia de hoje?',
    'Qual lugar você gostaria de conhecer algum dia?',
    'Que pequena coisa sempre melhora seu humor?',
    'Qual foi a última coisa interessante que você aprendeu?',
    'Que tipo de canal você mais gosta em uma comunidade?',
    'Qual hobby você gostaria de começar?',
    'Se o servidor tivesse um campeonato, do que deveria ser?',
    'Qual aplicativo você mais usa além do Discord?',
    'Qual comida você nunca enjoa de comer?',
    'Que conselho simples já te ajudou bastante?',
    'Qual foi o melhor evento online de que você participou?',
    'Que tema daria uma boa noite especial no servidor?',
    'Qual personagem fictício seria um ótimo moderador?',
    'Qual invenção do dia a dia você acha mais útil?',
    'Que assunto você consegue conversar por horas?',
    'Qual meme antigo ainda funciona para você?'
];
const WOULD_YOU_RATHER = [
    ['Ter internet muito rápida em qualquer lugar', 'Ter bateria infinita em todos os aparelhos'],
    ['Poder aprender qualquer idioma rapidamente', 'Poder aprender qualquer instrumento rapidamente'],
    ['Só assistir filmes novos', 'Só reassistir seus favoritos'],
    ['Ter um quarto de jogos perfeito', 'Ter um cinema particular'],
    ['Viajar para qualquer lugar uma vez por mês', 'Ter todos os seus hobbies sem custo'],
    ['Sempre saber o que assistir', 'Sempre saber o que jogar'],
    ['Ter memória excelente', 'Aprender coisas novas duas vezes mais rápido'],
    ['Participar de um grande evento presencial', 'Criar um grande evento online'],
    ['Ter mais tempo livre', 'Ter mais energia durante o dia'],
    ['Morar perto da praia', 'Morar perto das montanhas']
];
function randomCommunityTopic(random = Math.random) {
    return COMMUNITY_TOPICS[Math.floor(random() * COMMUNITY_TOPICS.length)] ?? COMMUNITY_TOPICS[0];
}
function randomWouldYouRather(random = Math.random) {
    const item = WOULD_YOU_RATHER[Math.floor(random() * WOULD_YOU_RATHER.length)] ?? WOULD_YOU_RATHER[0];
    return { first: item[0], second: item[1] };
}
//# sourceMappingURL=conversationService.js.map