import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PHRASES } from './phrases'
import { buildFeedback, canonText, stripEmojis } from './compare'

const USED_KEY = 'ditado:frases-usadas'
const RATE_KEY = 'ditado:velocidade'
const TOTAL = PHRASES.length
const CATEGORIES = new Set(PHRASES.map((phrase) => phrase.category)).size

/* ------------------------------------------------------------------ */
/* Persistência                                                        */
/* ------------------------------------------------------------------ */

function readUsed() {
  try {
    const raw = window.localStorage.getItem(USED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const valid = new Set(PHRASES.map((phrase) => phrase.n))
    return [...new Set(parsed.filter((n) => Number.isInteger(n) && valid.has(n)))]
  } catch {
    return []
  }
}

function writeUsed(list) {
  try {
    window.localStorage.setItem(USED_KEY, JSON.stringify(list))
  } catch {
    /* localStorage indisponível: o app continua funcionando na sessão */
  }
}

function readRate() {
  try {
    const value = Number(window.localStorage.getItem(RATE_KEY))
    if (Number.isFinite(value) && value >= 0.6 && value <= 1.3) return value
  } catch {
    /* ignora */
  }
  return 0.95
}

/* ------------------------------------------------------------------ */
/* Fala (Web Speech API)                                               */
/* ------------------------------------------------------------------ */

function useSpeech() {
  const [supported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  )
  const [rate, setRate] = useState(readRate)
  const [speaking, setSpeaking] = useState(false)
  const [hasPortugueseVoice, setHasPortugueseVoice] = useState(true)
  const voiceRef = useRef(null)
  const rateRef = useRef(rate)
  const speechTimer = useRef(null)

  useEffect(() => {
    rateRef.current = rate
    try {
      window.localStorage.setItem(RATE_KEY, String(rate))
    } catch {
      /* ignora */
    }
  }, [rate])

  useEffect(() => {
    if (!supported) return undefined

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      voiceRef.current =
        voices.find((voice) => voice.lang?.toLowerCase() === 'pt-br') ??
        voices.find((voice) => voice.lang?.toLowerCase().startsWith('pt')) ??
        null
      if (voices.length > 0) setHasPortugueseVoice(Boolean(voiceRef.current))
    }

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () =>
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [supported])

  const speak = useCallback(
    (text) => {
      if (!supported) return
      const synth = window.speechSynthesis
      synth.cancel()
      window.clearTimeout(speechTimer.current)

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pt-BR'
      utterance.rate = rateRef.current
      if (voiceRef.current) utterance.voice = voiceRef.current
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)

      // Delay para o Chrome não cortar o começo da frase.
      speechTimer.current = window.setTimeout(() => synth.speak(utterance), 500)
    },
    [supported],
  )

  useEffect(
    () => () => {
      window.clearTimeout(speechTimer.current)
      if (supported) window.speechSynthesis.cancel()
    },
    [supported],
  )

  return { speak, speaking, rate, setRate, supported, hasPortugueseVoice }
}

/* ------------------------------------------------------------------ */
/* Ícones                                                              */
/* ------------------------------------------------------------------ */

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="30"
      height="30"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1a4 4 0 0 0 4 4" />
      <path d="M17 6h3v1a4 4 0 0 1-4 4" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Histórico                                                           */
/* ------------------------------------------------------------------ */

function AttemptText({ value, target }) {
  const { tokens } = useMemo(
    () => buildFeedback(target, value, { live: false }),
    [target, value],
  )

  return (
    <p className="attempt-text">
      {tokens.map((token, index) => {
        if (token.kind === 'ok') {
          return (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="char-match"
            >
              {token.char === ' ' ? '\u00a0' : token.char}
            </span>
          )
        }
        if (token.kind === 'missing') {
          return (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="char-missing"
              title="Caractere faltando"
            >
              {token.char === ' ' ? '␣' : '▯'}
            </span>
          )
        }
        return (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="char-miss"
            title="Caractere diferente"
          >
            {token.typed === ' ' ? '␣' : token.typed}
          </span>
        )
      })}
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

export default function App() {
  const [used, setUsed] = useState(readUsed)
  const [current, setCurrent] = useState(null)
  const [typed, setTyped] = useState('')
  const [attempts, setAttempts] = useState([])
  const [finished, setFinished] = useState(false)
  const [done, setDone] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef(null)
  const shakeTimer = useRef(null)
  const { speak, speaking, rate, setRate, supported, hasPortugueseVoice } =
    useSpeech()

  const draw = useCallback(
    (usedList) => {
      window.clearTimeout(shakeTimer.current)
      setShake(false)
      setTyped('')
      setAttempts([])
      setFinished(false)

      const available = PHRASES.filter((phrase) => !usedList.includes(phrase.n))

      if (available.length === 0) {
        setCurrent(null)
        setDone(true)
        return
      }

      const drawn = available[Math.floor(Math.random() * available.length)]
      const cleanedText = stripEmojis(drawn.text).replace(/\s+/g, ' ').trim()
      const next = { ...drawn, text: cleanedText || drawn.text }
      const nextUsed = [...usedList, next.n]

      setCurrent(next)
      setUsed(nextUsed)
      writeUsed(nextUsed)
      setDone(false)
      speak(next.text)
      window.requestAnimationFrame(() => inputRef.current?.focus())
    },
    [speak],
  )

  useEffect(() => {
    draw(used)
    // Sorteia apenas na montagem; novas frases são sorteadas pelas ações.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      window.clearTimeout(shakeTimer.current)
    },
    [],
  )

  const feedback = useMemo(
    () =>
      current
        ? buildFeedback(current.text, typed, { live: true })
        : { tokens: [], correct: 0, errors: 0, total: 0 },
    [current, typed],
  )

  function finish() {
    window.clearTimeout(shakeTimer.current)
    setShake(false)
    setFinished(true)
  }

  function handleChange(event) {
    // Emojis são desconsiderados no ditado: saem do campo e da comparação.
    // Colapsar espaços evita que remover um emoji deixe um espaço "extra".
    const value = stripEmojis(event.target.value).replace(/\s{2,}/g, ' ')
    setTyped(value)
    if (
      current &&
      !finished &&
      value.trim() !== '' &&
      canonText(value) === canonText(current.text)
    ) {
      finish()
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!current || finished) return
    if (typed.trim() === '') {
      inputRef.current?.focus()
      return
    }
    if (canonText(typed) === canonText(current.text)) {
      finish()
      return
    }

    setAttempts((previous) => {
      const last = previous[previous.length - 1]
      if (last && last.typed === typed) return previous
      return [
        ...previous,
        {
          id: `${Date.now()}-${Math.random()}`,
          typed,
          wrong: buildFeedback(current.text, typed, { live: false }).errors,
          at: new Date(),
        },
      ]
    })

    setShake(true)
    window.clearTimeout(shakeTimer.current)
    shakeTimer.current = window.setTimeout(() => setShake(false), 450)
    inputRef.current?.focus()
  }

  function handleSkip() {
    draw(used)
  }

  function handleReset() {
    const confirmed = window.confirm(
      'Zerar as frases usadas e começar um novo ciclo?',
    )
    if (!confirmed) return
    writeUsed([])
    setUsed([])
    draw([])
  }

  const progress = Math.round((used.length / TOTAL) * 100)

  return (
    <div className="app">
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <SpeakerIcon />
            </span>
            <div>
              <h1>Ditado</h1>
              <p>Ouça a frase, escreva e confira letra por letra.</p>
            </div>
          </div>

          <div className="topbar-right">
            <div className="pool">
              <div className="pool-bar" aria-hidden="true">
                <span style={{ width: `${progress}%` }} />
              </div>
              <span className="pool-label">
                {used.length} de {TOTAL} frases usadas
              </span>
            </div>
            <button type="button" className="ghost small" onClick={handleReset}>
              Zerar usadas
            </button>
          </div>
        </header>

        <main className="layout">
          <section className="card practice">
            {done ? (
              <div className="result" role="status">
                <div className="result-icon done" aria-hidden="true">
                  <TrophyIcon />
                </div>
                <h2>Você passou por todas as frases!</h2>
                <p className="muted">
                  Foram {TOTAL} frases sorteadas. Zere o histórico para
                  recomeçar do zero.
                </p>
                <div className="result-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={handleReset}
                  >
                    Zerar e começar de novo
                  </button>
                </div>
              </div>
            ) : current && finished ? (
              <div className="result" role="status">
                <span className="badge">{current.category}</span>
                <div className="result-icon" aria-hidden="true">
                  <CheckIcon />
                </div>
                <h2>Frase correta!</h2>
                <p className="reveal">{current.text}</p>
                <p className="muted">
                  {attempts.length === 0
                    ? 'De primeira, sem nenhum erro.'
                    : `${attempts.length} ${
                        attempts.length === 1
                          ? 'tentativa com erro'
                          : 'tentativas com erro'
                      } antes de acertar.`}
                </p>
                <div className="result-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={handleSkip}
                  >
                    Próxima frase
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => speak(current.text)}
                  >
                    <SpeakerIcon />
                    Ouvir de novo
                  </button>
                </div>
              </div>
            ) : current ? (
              <>
                <div className="card-head">
                  <span className="badge">{current.category}</span>
                  <span className="phrase-number">Frase {current.n}</span>
                </div>

                <div className="audio-row">
                  <button
                    type="button"
                    className={`listen${speaking ? ' is-speaking' : ''}`}
                    onClick={() => speak(current.text)}
                  >
                    <SpeakerIcon />
                    {speaking ? 'Falando…' : 'Ouvir a frase'}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={handleSkip}
                  >
                    Pular
                  </button>
                </div>

                <div className="rate-row">
                  <label htmlFor="rate">Velocidade da voz</label>
                  <input
                    id="rate"
                    type="range"
                    min="0.6"
                    max="1.3"
                    step="0.05"
                    value={rate}
                    onChange={(event) => setRate(Number(event.target.value))}
                  />
                  <output htmlFor="rate">
                    {rate.toFixed(2).replace('.', ',')}×
                  </output>
                </div>

                {!supported && (
                  <p className="warn">
                    Este navegador não oferece leitura em voz alta. Tente Chrome,
                    Edge ou Safari.
                  </p>
                )}
                {supported && !hasPortugueseVoice && (
                  <p className="warn">
                    Nenhuma voz em português foi encontrada. Instale uma voz
                    pt-BR no sistema para ouvir a frase.
                  </p>
                )}

                <div className="progress-block">
                  <div className="progress-head">
                    <span>Seu progresso</span>
                    <span>
                      {feedback.correct} de {feedback.total} caracteres
                    </span>
                  </div>
                  <div className="letters" aria-hidden="true">
                    {feedback.tokens.map((token, index) => {
                      if (token.kind === 'pending') {
                        const isSpace = token.char === ' '
                        return (
                          <span
                            // eslint-disable-next-line react/no-array-index-key
                            key={index}
                            className={`letter pending${isSpace ? ' space' : ''}`}
                          >
                            {isSpace ? '\u00a0' : '·'}
                          </span>
                        )
                      }

                      if (token.kind === 'missing') {
                        return (
                          <span
                            // eslint-disable-next-line react/no-array-index-key
                            key={index}
                            className={`letter missing${
                              token.char === ' ' ? ' space' : ''
                            }`}
                            title="Caractere faltando"
                          >
                            {token.char === ' ' ? '␣' : '▯'}
                          </span>
                        )
                      }

                      if (token.kind === 'extra') {
                        return (
                          <span
                            // eslint-disable-next-line react/no-array-index-key
                            key={index}
                            className="letter bad extra"
                            title="Caractere a mais"
                          >
                            {token.typed === ' ' ? '␣' : token.typed}
                          </span>
                        )
                      }

                      if (token.kind === 'wrong') {
                        return (
                          <span
                            // eslint-disable-next-line react/no-array-index-key
                            key={index}
                            className="letter bad"
                            title="Caractere diferente"
                          >
                            {token.typed === ' ' ? '␣' : token.typed}
                          </span>
                        )
                      }

                      const isSpace = token.char === ' '
                      return (
                        <span
                          // eslint-disable-next-line react/no-array-index-key
                          key={index}
                          className={`letter ok${isSpace ? ' space' : ''}`}
                        >
                          {isSpace ? '\u00a0' : token.char}
                        </span>
                      )
                    })}
                  </div>
                </div>

                <form className="answer-form" onSubmit={handleSubmit}>
                  <label htmlFor="answer">Digite a frase que você ouviu</label>
                  <div className={`input-row${shake ? ' shake' : ''}`}>
                    <input
                      ref={inputRef}
                      id="answer"
                      type="text"
                      value={typed}
                      onChange={handleChange}
                      placeholder="Escreva aqui…"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      lang="pt-BR"
                    />
                    <button type="submit" className="primary">
                      Conferir
                    </button>
                  </div>
                </form>

                <p className="tip">
                  Acentos e pontuação contam. Letras verdes estão certas;
                  <span className="tip-missing"> ▯ </span>
                  indica um caractere que faltou; vermelho indica troca ou
                  caractere a mais.
                </p>
              </>
            ) : null}
          </section>

          <aside className="card history-card">
            <div className="history-head">
              <h2>Histórico de erros</h2>
              {current && <span className="badge subtle">Frase {current.n}</span>}
            </div>

            {!current ? (
              <p className="muted">Nenhuma frase em andamento.</p>
            ) : attempts.length === 0 ? (
              <div className="empty">
                <strong>Nenhum erro registrado.</strong>
                <span>
                  Pressione <kbd>Enter</kbd> ou <em>Conferir</em> quando terminar
                  de digitar.
                </span>
              </div>
            ) : (
              <>
                <p className="history-note">
                  Tentativas erradas desta frase, da mais antiga para a mais
                  recente. <span className="char-missing">▯</span> indica um
                  caractere faltando.
                </p>
                <ol className="attempt-list">
                  {attempts.map((attempt, index) => (
                    <li key={attempt.id}>
                      <div className="attempt-head">
                        <span className="attempt-label">
                          Tentativa {index + 1}
                        </span>
                        <span className="attempt-time">
                          {attempt.at.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <AttemptText
                        value={attempt.typed}
                        target={current.text}
                      />
                      <span className="attempt-meta">
                        {attempt.wrong}{' '}
                        {attempt.wrong === 1
                          ? 'caractere diferente'
                          : 'caracteres diferentes'}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </aside>
        </main>

        <footer className="footer">
          Frases extraídas de ditado_frases.xlsx · {TOTAL} frases em{' '}
          {CATEGORIES} categorias
        </footer>
      </div>
    </div>
  )
}
