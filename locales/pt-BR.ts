import type { Locale } from './en'

export const ptBR: Locale = {
  code: 'pt-BR',
  names: ['pt-br', 'pt', 'portuguese', 'português', 'portugues', 'brazilian portuguese'],
  strings: {
    sleeping: 'dormindo',
    thinking: 'pensando',
    running: 'rodando {detail}',
    writing: 'escrevendo {detail}',
    reading: 'lendo {detail}',
    searching: 'procurando ({detail})',
    using: 'usando {detail}',
    waitingForAgents: 'esperando os agents',
    done: 'pronto!',
    wentWrong: 'algo deu errado',
    failed: 'falhou: {detail}',
    wakingUp: 'acordando',
    deepSleep: 'dormindo pesado',
    waitingForYou: 'esperando você: {detail}',
    compacting: 'arrumando a memória',
    commandDescription: 'Mostra ou esconde os pets acima do prompt',
    hidden: 'Pets escondidos.',
    shown: 'Pets de volta.',
    invalidName: '"{detail}" não é um nome de pet válido',
    notFound: 'pet "{detail}" não encontrado',
    fallback: 'pixel-pets: {detail}. Usando o pet padrão.',
  },
}
