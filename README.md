# Ditado

Página em Vite + React para treinar a escrita por ditado, usando as frases de
`ditado_frases.xlsx`.

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (normalmente `http://localhost:5173`).

## Como funciona

- A página sorteia uma frase e a lê em voz alta (Web Speech API, voz pt-BR).
- Você digita a frase ouvida no campo de resposta.
- O feedback alinha o texto digitado com a frase (estilo diff): letras certas em
  **verde**, trocadas ou digitadas a mais em vermelho e caracteres faltantes com
  um marcador amarelo `▯`. Assim, esquecer uma letra não desloca o restante da
  frase.
- Acentos e pontuação contam.
- Emojis são desconsiderados: não são exibidos, não são falados e não contam
  como acerto nem como erro.
- Ao pressionar **Enter** / **Conferir**, as tentativas erradas viram um
  histórico da frase atual, com destaque nos caracteres divergentes e nos que
  faltaram.
- Cada frase sorteada é gravada no `localStorage` (`ditado:frases-usadas`) e não
  aparece de novo até você usar **Zerar usadas**.
- A velocidade da voz também fica salva no `localStorage`.

## Publicação

Site publicado em **https://k4w4n.github.io/ditado/**.

O deploy é automático pelo GitHub Actions (`.github/workflows/deploy.yml`): a
cada push na branch `main`, o site é construído e publicado no GitHub Pages.

## Dados

As 340 frases foram extraídas da aba **Frases** da planilha e ficam em
`src/phrases.js`, agrupadas por categoria. Para atualizar a base, edite esse
arquivo (ou reimporte a planilha).
