# White.board

![Preview da ferramenta](https://dididoingles.github.io/Whiteboard/preview.png)

Quadro branco interativo para aulas de inglês. Permite escrever, formatar
textos, jogar a forca com palavras do próprio quadro e pesquisar no Google
sem sair da tela. Funciona no navegador, sem instalação, sem login e sem
backend.

**Acessar:** https://dididoingles.github.io/Whiteboard/

---

## Sobre

O Didi's Whiteboard foi desenvolvido para uso em sala de aula por
professores de idiomas e educadores em geral. O objetivo é reunir, em uma
única tela, as ferramentas mais usadas durante uma aula: escrita livre,
destaque de vocabulário, inserção de imagens, post-its, consulta rápida a
dicionários e um jogo de forca alimentado pelas palavras escritas no
próprio quadro.

Todo o conteúdo do quadro é salvo automaticamente no navegador do usuário.
Não há servidor, não há cadastro, não há coleta de dados.

---

## Funcionalidades

### Quadro e edição de texto

- Escrita livre com o mouse ou com o dedo (em telas touch)
- Criação de texto por duplo clique (desktop) ou toque simples (mobile)
- Formatação parcial: negrito, itálico, sublinhado, tachado
- Alteração de cor e tamanho de fonte
- Marca-texto com quatro cores e opção de remoção
- Desfazer e refazer com histórico de até 50 ações
- Salvamento automático do quadro no navegador
- Exportação do quadro como imagem PNG

### Ferramentas auxiliares

- Inserção de ícones vetoriais (Font Awesome)
- Inserção de post-its em quatro cores
- Paleta de cores personalizável
- Colagem de imagens da área de transferência (Ctrl + V)

### Pesquisa e consulta

- Pesquisa no Google a partir de um texto selecionado
- Pesquisa no Google Imagens
- Tradução via Google Translate
- Consulta no Cambridge Dictionary

### Jogo da forca

- Sorteio de palavras a partir do conteúdo escrito no quadro
- Teclado virtual, desenho do enforcado e mensagens de acerto/erro
- Controle de palavras já sorteadas para não repetir na mesma sessão

### Interface

- Tema claro e tema escuro
- Modo apresentação (esconde toda a interface do app)
- Grade de fundo opcional para alinhamento
- Contador de palavras e caracteres escritos no quadro
- Interface adaptada para desktop e para celular

---

## Atalhos de teclado

| Atalho | Ação |
|---|---|
| Ctrl + T | Ativar modo texto |
| Ctrl + L | Ativar modo desenho |
| Ctrl + B | Negrito |
| Ctrl + I | Itálico |
| Ctrl + U | Sublinhado |
| Ctrl + Z | Desfazer |
| Ctrl + Shift + Z | Refazer |
| Ctrl + S | Salvar o quadro manualmente |
| Ctrl + V | Colar imagem da área de transferência |
| Delete | Excluir elemento selecionado |
| Esc | Sair do modo apresentação |

---

## Como usar em aula

1. Abra o link em um computador conectado a um projetor ou televisão.
2. Ative o modo texto (Ctrl + T) para escrever o conteúdo da aula.
3. Use o marca-texto para destacar vocabulário novo.
4. Ao final da aula, clique em "Baixar PNG" para exportar o quadro.
5. Para jogar a forca, escreva as palavras no quadro e vá em "Game mode".

O quadro fica salvo no navegador entre uma sessão e outra. Basta abrir a
mesma página no mesmo navegador para retomar o conteúdo.

---

## Compatibilidade

- Desktop: Chrome, Firefox, Safari, Edge (versões recentes)
- Mobile: Chrome (Android) e Safari (iOS)
- Recomendado usar em telas com pelo menos 768px de largura
- Em celulares, o app sugere o modo paisagem e a experiência é reduzida

---

## Estrutura do projeto

Whiteboard/
├── index.html Página principal
├── favicon.png Ícone do site e do header
├── preview.png Imagem de compartilhamento (Open Graph)
├── LICENSE Licença de uso
├── README.md Este arquivo
├── css/
│ └── style.css Todos os estilos
└── js/
└── script.js Todo o comportamento


O projeto usa três dependências externas, carregadas via CDN:

- **Fabric.js** (canvas interativo)
- **Font Awesome** (ícones da interface)
- **Google Fonts** (fonte Poppins)

---

## Licença

Copyright (c) 2025 Diandra Carvalho. Todos os direitos reservados.

Esta ferramenta é de uso gratuito para professores, alunos e educadores.
É expressamente proibida a cópia do código-fonte, a modificação, a
adaptação, a redistribuição ou a comercialização, no todo ou em parte,
sem autorização prévia e por escrito da autora.

Consulte o arquivo [LICENSE](LICENSE) para os termos completos.

---

## Autoria

Desenvolvido por **Diandra Carvalho** ([@dicarvalho.prof](https://github.com/Dididoingles)).

Para contato, sugestões ou solicitações de uso, abra uma issue neste
repositório ou envie mensagem pelo perfil acima.
