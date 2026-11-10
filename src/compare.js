/**
 * Alinhamento entre a frase correta e o que foi digitado.
 *
 * A comparação puramente posicional erra quando o usuário esquece uma letra:
 * a partir dali tudo fica "deslocado" e aparece em vermelho. Aqui usamos um
 * alinhamento por edição (Levenshtein) que encontra:
 *
 *   - letras iguais na posição certa (equal)
 *   - letras trocadas (replace)
 *   - letras que faltaram (delete)
 *   - letras digitadas a mais (insert)
 *
 * Além disso, o alinhamento é ancorado no tamanho do texto digitado. Sem isso,
 * ao digitar metade da frase o algoritmo poderia "pular" para uma letra igual
 * mais à frente e deixar o meio da frase marcado como errado.
 */

const CHAR_EQUIVALENTS = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u00a0': ' ',
}

// Ignora diferenças de caixa, aspas "inteligentes" e espaços repetidos.
// Acentos e pontuação continuam valendo, pois fazem parte do ditado.
export function canonChar(char) {
  return (CHAR_EQUIVALENTS[char] ?? char).toLocaleLowerCase('pt-BR')
}

export function canonText(text) {
  return Array.from(text).map(canonChar).join('').trim().replace(/\s+/g, ' ')
}

function sameChar(a, b) {
  return canonChar(a) === canonChar(b)
}

function computeTable(targetChars, typedChars) {
  const rows = targetChars.length + 1
  const cols = typedChars.length + 1

  // dp[i][j] = menor número de edições entre target[0..i) e typed[0..j)
  const dp = Array.from({ length: rows }, () => new Uint16Array(cols))
  for (let i = 0; i < rows; i += 1) dp[i][0] = i
  for (let j = 0; j < cols; j += 1) dp[0][j] = j

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = sameChar(targetChars[i - 1], typedChars[j - 1]) ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + cost,
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
      )
    }
  }

  return dp
}

/**
 * Reconstrói o caminho do alinhamento até `endTarget`, consumindo todo o
 * texto digitado.
 */
function backtrack(targetChars, typedChars, dp, endTarget) {
  const operations = []
  let i = endTarget
  let j = typedChars.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const cost = sameChar(targetChars[i - 1], typedChars[j - 1]) ? 0 : 1
      if (dp[i][j] === dp[i - 1][j - 1] + cost) {
        operations.push({
          type: cost === 0 ? 'equal' : 'replace',
          target: targetChars[i - 1],
          typed: typedChars[j - 1],
        })
        i -= 1
        j -= 1
        continue
      }
    }

    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      operations.push({ type: 'delete', target: targetChars[i - 1] })
      i -= 1
      continue
    }

    operations.push({ type: 'insert', typed: typedChars[j - 1] })
    j -= 1
  }

  operations.reverse()
  return operations
}

/**
 * Escolhe até que ponto da frase o texto digitado deve ser comparado.
 *
 * Preferimos o alinhamento com menos edições e, em caso de empate, o que
 * termina mais perto do tamanho do que foi digitado. É isso que faz uma frase
 * pela metade continuar com o restante "pendente" em vez de tentar casar
 * letras com palavras distantes.
 */
function chooseEnd(dp, targetLength, typedLength) {
  let bestEnd = targetLength
  let bestCost = Number.POSITIVE_INFINITY
  let bestDistance = Number.POSITIVE_INFINITY

  for (let i = 0; i <= targetLength; i += 1) {
    const cost = dp[i][typedLength]
    const distance = Math.abs(i - typedLength)
    const isBetter =
      cost < bestCost ||
      (cost === bestCost &&
        (distance < bestDistance ||
          (distance === bestDistance && i > bestEnd)))
    if (isBetter) {
      bestCost = cost
      bestDistance = distance
      bestEnd = i
    }
  }

  return bestEnd
}

/**
 * Calcula o alinhamento completo entre `target` e `typed`, opção a opção,
 * da esquerda para a direita.
 *
 * @returns {Array<{type: 'equal'|'replace'|'delete'|'insert', target?: string, typed?: string}>}
 */
export function alignChars(target, typed) {
  const targetChars = Array.from(target)
  const typedChars = Array.from(typed)
  const dp = computeTable(targetChars, typedChars)
  return backtrack(targetChars, typedChars, dp, targetChars.length)
}

/**
 * Transforma o alinhamento em tokens prontos para a interface.
 *
 * Em `live`, posições que ainda não foram digitadas ficam como `pending`
 * (pontinhos), em vez de serem tratadas como letras faltando. Já no histórico
 * (`live: false`), tudo o que não foi digitado vira `missing`.
 */
export function buildFeedback(target, typed, { live = true } = {}) {
  const targetChars = Array.from(target)
  const typedChars = Array.from(typed)

  // Caso mais comum enquanto se digita: o texto é um prefixo exato da frase.
  const isExactPrefix =
    typedChars.length <= targetChars.length &&
    typedChars.every(
      (char, index) => canonChar(char) === canonChar(targetChars[index]),
    )

  if (isExactPrefix) {
    const tokens = typedChars.map((char) => ({ kind: 'ok', char }))
    let errors = 0

    for (let i = typedChars.length; i < targetChars.length; i += 1) {
      if (live) {
        tokens.push({ kind: 'pending', char: targetChars[i] })
      } else {
        tokens.push({ kind: 'missing', char: targetChars[i] })
        errors += 1
      }
    }

    return {
      tokens,
      correct: typedChars.length,
      errors,
      total: targetChars.length,
    }
  }

  const dp = computeTable(targetChars, typedChars)
  const end = chooseEnd(dp, targetChars.length, typedChars.length)
  const operations = backtrack(targetChars, typedChars, dp, end)

  const tokens = []
  let correct = 0
  let errors = 0

  operations.forEach((operation) => {
    switch (operation.type) {
      case 'equal':
        tokens.push({ kind: 'ok', char: operation.target })
        correct += 1
        break
      case 'replace':
        tokens.push({
          kind: 'wrong',
          char: operation.target,
          typed: operation.typed,
        })
        errors += 1
        break
      case 'insert':
        tokens.push({ kind: 'extra', typed: operation.typed })
        errors += 1
        break
      case 'delete':
      default:
        tokens.push({ kind: 'missing', char: operation.target })
        errors += 1
        break
    }
  })

  // O que sobrou da frase depois do ponto de alinhamento ainda não foi digitado.
  for (let i = end; i < targetChars.length; i += 1) {
    if (live) {
      tokens.push({ kind: 'pending', char: targetChars[i] })
    } else {
      tokens.push({ kind: 'missing', char: targetChars[i] })
      errors += 1
    }
  }

  return { tokens, correct, errors, total: targetChars.length }
}
