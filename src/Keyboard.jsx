import { useEffect, useState } from 'react'

const LETTER_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

const ACCENT_ROWS = [
  ['á', 'à', 'â', 'ã', 'é', 'ê', 'í'],
  ['ó', 'ô', 'õ', 'ú', 'ü', 'ç', '-'],
  ['?', '!', ':', ';', '"', "'", '/'],
]

const SYMBOL_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  [',', '.', '-', '?', '!', ':', ';', '"', "'", '/'],
  ['(', ')', '[', ']', '@', '#', '%', '&', '*', '+'],
]

const LAYERS = {
  letters: LETTER_ROWS,
  accents: ACCENT_ROWS,
  symbols: SYMBOL_ROWS,
}

export default function Keyboard({ onKey, resetSignal }) {
  const [layer, setLayer] = useState('letters')

  // Volta para as letras quando uma nova frase é sorteada.
  useEffect(() => {
    setLayer('letters')
  }, [resetSignal])

  const rows = LAYERS[layer]

  function press(value) {
    onKey(value)
  }

  return (
    <div className="keyboard" role="group" aria-label="Teclado do site">
      {rows.map((row, rowIndex) => (
        // eslint-disable-next-line react/no-array-index-key
        <div className="keyboard-row" key={rowIndex}>
          {row.map((char) => (
            <button
              key={char}
              type="button"
              className={`key${layer === 'accents' ? ' accent-key' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => press(char)}
            >
              {char}
            </button>
          ))}
        </div>
      ))}

      <div className="keyboard-row keyboard-actions">
        {layer === 'letters' ? (
          <>
            <button
              type="button"
              className="key layer-key"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setLayer('accents')}
              aria-label="Mostrar letras acentuadas"
            >
              áç
            </button>
            <button
              type="button"
              className="key layer-key"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setLayer('symbols')}
              aria-label="Mostrar números e símbolos"
            >
              123
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="key layer-key"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setLayer('letters')}
              aria-label="Mostrar letras"
            >
              abc
            </button>
            <button
              type="button"
              className="key layer-key"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                setLayer(layer === 'accents' ? 'symbols' : 'accents')
              }
              aria-label={
                layer === 'accents'
                  ? 'Mostrar números e símbolos'
                  : 'Mostrar letras acentuadas'
              }
            >
              {layer === 'accents' ? '123' : 'áç'}
            </button>
          </>
        )}

        <button
          type="button"
          className="key layer-key"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => press('.')}
          aria-label="Ponto final"
        >
          .
        </button>

        <button
          type="button"
          className="key space"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => press('space')}
          aria-label="Espaço"
        >
          espaço
        </button>

        <button
          type="button"
          className="key backspace"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => press('backspace')}
          aria-label="Apagar último caractere"
        >
          ⌫
        </button>
      </div>
    </div>
  )
}
