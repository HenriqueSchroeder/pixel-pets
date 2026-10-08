# pixel-pets

[English](README.md) · **Português**

Um pet em pixel art que vive acima do prompt do Claude Code e reage ao que o Claude está fazendo: pensa, digita enquanto o Claude roda comandos, lê enquanto o Claude lê arquivos, comemora quando um turno termina e fica triste quando uma tool falha. Cada subagent que o Claude inicia ganha um pet pequeno, com cor própria, mostrando o que aquele agent está fazendo agora.

Os pets são arquivos JSON, então você pode desenhar o seu ou usar um que outra pessoa fez.

![pixel-pets: o clawd acima do prompt enquanto três subagents trabalham](screenshots/clawd.gif)

![pixel-pets: o dragão na mesma cena, voando para pousar em outro lugar e soltando fogo quando um trabalho longo termina](screenshots/dragon.gif)

![pixel-pets: o fantasma na mesma cena, sumindo e reaparecendo em outro lugar enquanto passeia](screenshots/ghost.gif)

![pixel-pets: a raposa na mesma cena](screenshots/fox.gif)

![pixel-pets: a capivara na mesma cena, mastigando capim enquanto um passarinho pousa na cabeça dela](screenshots/capybara.gif)

## O que ele mostra

| Humor | Quando | Herda de |
| --- | --- | --- |
| `sleeping` | nenhum turno rodando | (obrigatório) |
| `deepSleep` | nada aconteceu por 10 minutos | sleeping |
| `idle` | acordado sem nada para fazer, por um tempo depois que o Claude termina (veja `awakeMinutes`) | thinking |
| `sleepy` | à toa à noite, das 22h às 6h | idle |
| `tired` | à toa depois de 3 horas de trabalho sem uma pausa de uma hora | sleepy |
| `walking` | passeando quando está à toa e sozinho; um pack sem ele nunca anda | idle |
| `watching` | você está digitando no prompt enquanto o Claude está parado | reading |
| `waking` | por um instante, quando um prompt o acorda de um sono profundo | thinking |
| `thinking` | um turno começou | sleeping |
| `typing` | qualquer outra tool, incluindo as de MCP | thinking |
| `running` | `Bash` | typing |
| `writing` | `Edit`, `Write` | typing |
| `reading` | `Read` | thinking |
| `searching` | `Grep`, `Glob`, `WebFetch`, `WebSearch`, `LSP` | reading |
| `supervising` | o Claude está esperando os agents, ou só pensando enquanto eles rodam, ou eles ainda rodam em background depois do turno | thinking |
| `compacting` | a conversa está sendo compactada | thinking |
| `sweating` | o turno passou de 2 minutos e o Claude está pensando ou rodando um comando | thinking |
| `worried` | à toa depois de algumas falhas seguidas | sweating |
| `grumpy` | à toa depois de muitas falhas seguidas | sad |
| `proud` | à toa depois de uma sequência de turnos que deram certo | happy |
| `happy` | por dois segundos quando o último agent termina, de vez em quando depois de um turno de trabalho, ou depois que você aprova um pedido de permissão ("valeu!") | sleeping |
| `celebrating` | por quatro segundos depois que um turno de 5 minutos ou mais dá certo, e num aniversário | happy |
| `sad` | por dois segundos depois que uma tool falha, um turno dá erro ou você nega um pedido de permissão ("tá bom, não vou") | sleeping |

Um pack só precisa desenhar `sleeping`. Todo humor que faltar usa os quadros do pai desenhado mais próximo: `running` cai em `typing`, depois `thinking`, depois `sleeping`.

O pet anda num palco embaixo da linha do Claude: passeia quando está à toa e, quando subagents começam, fica parado e eles se juntam em volta dele, cada um do lado com mais espaço livre: dos dois lados quando ele está no meio, de um só quando está num canto. Cada um fica do seu lado até sair. Quando eles não cabem onde ele está, ele anda para o lado para abrir espaço, e eles chegam quando ele termina. Só anda o pack que desenha `walking`. O que desenha `main.teleport` em vez disso se desloca sumindo e aparecendo em outro lugar, como o slime e o fantasma; um pack sem nenhum dos dois fica parado à esquerda. Os packs desenham o pet virado para a direita; o pixel-pets espelha para ele virar para a esquerda.

Ele acompanha como a sessão está indo. Uma tool ou um turno que falha o deixa preocupado, e um turno que dá certo o deixa orgulhoso; um turno que falha encerra a sequência de orgulho. Os dois perdem um ponto a cada cinco minutos, e quando ele está à toa aparece o sentimento mais forte: emburrado, depois preocupado, depois cansado, depois orgulhoso, depois com sono à noite. Preocupação e orgulho valem só para a sessão; o cansaço conta o seu trabalho em todas as sessões, e uma pausa é uma hora sem prompt em nenhuma delas.

Ele também tem vontades próprias, que valem só para a sessão. Energia: dormir enche e trabalhar gasta, e um pet com pouca energia cochila mais cedo e descansa mais entre os passeios. Tédio: cresce enquanto nada acontece, e um pet entediado levanta sozinho de um cochilo por um tempo, mas nunca de um sono profundo. Saudade: cresce enquanto você está fora, e um pet com saudade passeia perto do prompt e cumprimenta a sua primeira tecla depois de meia hora fora ("senti sua falta!"), a não ser que um turno esteja rodando.

A hora do dia é a sua hora local. À noite ele fica com sono e cochila na metade do `awakeMinutes`. Ele lembra de você entre sessões. A primeira vez que ele te vê no dia vem com uma saudação: um aniversário (uma semana, um mês, 100 dias, cada ano juntos), "senti sua falta!" depois de dois dias ou mais fora, ou bom dia. O `/pet` também diz há quanto tempo vocês estão juntos. Tarde da noite ele comenta uma vez só, na sessão que te vir primeiro. Um `claude -p` não conta como te ver.

De vez em quando ele fala alguma coisa, entre aspas na linha do Claude: "hmm…" depois de 30 segundos pensando sem tool, um comentário na 20ª leitura de arquivo do turno, com três agents trabalhando ao mesmo tempo, num prompt à noite, um suspiro quando o tédio o tira de um cochilo, e uma palavra dormindo de vez em quando. Cada um no máximo uma vez por turno, e nunca dois em menos de três minutos.

Cada subagent ganha um mini pet com o tipo dele (`Explore`, `Plan`, ...) e a ação atual. Quando o agent termina, o pet fica feliz (ou triste, se falhou) por um instante e sai.

## Requisitos

- Claude Code **2.1.287 ou mais novo**, em que mods carregam por padrão. Feito e testado no 2.1.291.
- Um terminal para o pixel art. A aba Code do app Desktop mostra uma linha de texto no lugar, e o chat do VS Code e o `claude -p` não desenham nada.

## Instalação

Numa sessão do Claude Code:

```
/plugin marketplace add HenriqueSchroeder/pixel-pets
/plugin install pixel-pets@pixel-pets
```

Ou pelo shell, depois `/reload-plugins` nas sessões abertas:

```bash
claude plugin marketplace add HenriqueSchroeder/pixel-pets
claude plugin install pixel-pets@pixel-pets
```

`/pet` esconde os pets e traz de volta. `/pet <nome>` dá ao projeto atual um pet só dele, para cada janela do Claude Code mostrar em que projeto está; ele fica guardado para as próximas sessões do projeto, e `/pet default` volta para o pet da sua config.

## Configuração

Rode `/plugin configure pixel-pets@pixel-pets`, ou procure **pixel-pets** no `/config`:

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `pet` | `cat` | Qual pet mostrar, escolhido entre os que vêm junto (veja abaixo), ou `custom` para um seu |
| `customPet` | | O seu pack quando `pet` é `custom`: um arquivo em `~/.claude/pets/`, sem `.json` |
| `language` | `auto` | `auto` segue o setting `language` do Claude Code, depois o `$LANG`. Ou escolha `en`, `pt-BR` |
| `awakeMinutes` | `1` | Quanto tempo o pet fica acordado, passeando, depois que o Claude termina, antes de dormir (metade à noite). `0` manda direto dormir |

## Usar outro pet

1. Salve o pack em `~/.claude/pets/<nome>.json`. O nome do arquivo precisa ser igual ao `name` do pack.
2. Escolha `custom` na opção `pet` e coloque `<nome>` em `customPet`.

Um pack em `~/.claude/pets/` ganha de um embutido com o mesmo nome. Se um pack não puder ser lido, o pixel-pets diz o motivo num toast e mostra o gato.

Pets que vêm junto:

- [`cat`](pets/cat.json), o padrão, que fica de lado para andar, e [`slime`](pets/slime.json), que quica no lugar, derrete numa poça no sono profundo e nunca anda: afunda no chão e brota em outro lugar.
- [`dog`](pets/dog.json), que abana o rabo, ofega, inclina a cabeça quando pensa e fica de lado para andar.
- [`ghost`](pets/ghost.json), que flutua em vez de andar, dá um "buu" de vez em quando, vai sumindo enquanto dorme e reaparece em outro lugar com um "buu".
- [`owl`](pets/owl.json), que pisca devagar e gira a cabeça até dar a volta.
- [`clawd`](pets/clawd.json), que aparece no topo com o dragon, o ghost, a fox e a capybara: o bichinho da tela de abertura do Claude Code, que acena com os bracinhos, comemora com os dois quando um trabalho longo termina e estala um chicote nos agents para não pararem. Fan art: não é feito nem endossado pela Anthropic.
- [`fox`](pets/fox.json), que balança o rabo, pula de cabeça nos ratos sob a neve e fica de lado para andar.
- [`dragon`](pets/dragon.json), um dragão vermelho grande que solta fogo, conta o seu tesouro e voa para pousar em outro lugar. Não desenha mini pets.
- [`capybara`](pets/capybara.json), a mais calma de todas: mastiga capim, deixa um passarinho pousar na cabeça e equilibra uma laranja. Não desenha mini pets.

![O cat, o slime, o dog e a owl, à toa, pensando, felizes e dormindo](screenshots/gallery.gif)

## Desenhe o seu

Um pack é uma paleta e alguns quadros. Cada quadro são linhas de letras da paleta, e `.` é transparente. O formato completo, com exemplo, está no [README em inglês](README.md#draw-your-own) e no [schema](schema/pet.schema.json), que dá autocomplete e validação no editor.

- Só `sleeping` é obrigatório. Um humor que faltar herda do pai, como a tabela em [O que ele mostra](#o-que-ele-mostra) lista.
- Um humor com vários quadros toca em loop a `fps` quadros por segundo (1–12, padrão 4). Repita um quadro para segurar a pose: a 4 fps, o mesmo quadro quatro vezes seguidas segura por um segundo.
- Todos os quadros do pet principal têm o mesmo tamanho, até 48×32 pixels. O mini pet vai até 12×12.
- Duas linhas de pixel cabem numa linha do terminal, então um pet de 12×12 ocupa 12 colunas e 6 linhas.
- O mini pet precisa de `working`. O `happy` e o `sad` dele, mostrados quando um agent termina, e o `startled`, mostrado enquanto toca uma ação com `startles`, caem em `working`.
- `mini.tint` (padrão `b`) é a letra recolorida para cada subagent.
- `"mini": false` não desenha mini pets: enquanto os agents trabalham, o pet mostra isso só pelo próprio `supervising`. Útil para um pet largo, que deixa pouco espaço ao lado.
- Veja todos os humores de um pack, e de quem cada um herda, no seu terminal: `npx tsx scripts/preview-pet.ts <nome ou caminho>`.

### Dê vida ao pet

Só um loop parece máquina. Três chaves opcionais em `main` deixam o pet imprevisível (o formato está no [README em inglês](README.md#make-it-feel-alive)):

- `variants`: mais loops para um humor que você desenha em `moods`. Um deles, ou o loop do próprio humor, é sorteado cada vez que o humor começa.
- `transitions`: quadros tocados uma vez quando o humor muda, com chave `de>para`. Um dos lados pode ser `*`. A chave exata ganha de `de>*`, que ganha de `*>para`.
- `actions`: quadros tocados uma vez num momento aleatório enquanto o pet está num dos `moods`, `every` [mín, máx] segundos depois da última vez. Piscadas, orelhas mexendo e bocejos ficam aqui, e os loops podem ficar calmos. Uma ação com `startles`, um quadro contado a partir de 0, faz os mini pets dos agents mostrarem `startled` desse quadro até ela acabar: o estalo do chicote do clawd.
- Uma ação é um quadro inteiro, então mantenha a mesma cara dos humores em que ela toca. Por isso o gato tem uma piscada para cada expressão.
- Um humor tem até 16 quadros; a 4 fps, são 4 segundos.

Dê uma voz a ele com `speech`, na raiz do pack: falas por código de idioma e situação, uma sorteada a cada vez. O idioma ou a situação que você deixar de fora diz a fala padrão. As situações são `longThink`, `manyReads`, `manyAgents`, `lateNight`, `bored` e `dreaming`, com até 8 falas cada, de uma linha e até 40 caracteres (o formato está no [README em inglês](README.md#make-it-feel-alive)).

Um pet que não anda pode se teleportar: dê ao `main` um `teleport` com `vanish`, tocado onde ele está, e `appear`, tocado onde ele chega, quadros como quaisquer outros. É assim que ele passeia e abre espaço para os agents.

Dê um jeito de ser a ele com `personality`, na raiz do pack: três traços de 0 a 1, cada um 0.5 quando fica de fora. `energetic` cansa mais devagar, `curious` se entedia e levanta de um cochilo mais cedo (0 nunca), `affectionate` sente sua falta mais cedo (0 nunca). O cachorro é `{ "energetic": 0.8, "curious": 0.6, "affectionate": 0.9 }`; o slime, preguiçoso, é `{ "energetic": 0.2, "curious": 0.3, "affectionate": 0.6 }`.

Para compartilhar um pet, veja o [CONTRIBUTING.md](CONTRIBUTING.md).

## Confira o que ele faz antes de instalar

Um mod roda com as suas permissões. Clone o repositório e liste todo evento que ele usa e toda chamada que ele faz:

```bash
claude plugin validate ./pixel-pets
```

O pixel-pets lê os seus packs de pet, o setting `language` do Claude Code e as variáveis `HOME` e `LANG`, e desenha acima do prompt. Ele nunca escreve arquivos, roda comandos ou usa a rede.

## Limitações

- O pixel art precisa de um terminal. As outras superfícies recebem uma linha de texto.
- O pack é lido quando o plugin carrega. Depois de editar um, rode `/reload-plugins`.
- A API de mods está em early access e pode mudar entre versões do Claude Code.

## Licença

[MIT](LICENSE)
