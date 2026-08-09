export type ThoughtTextStyle = {
  fontFamily: string
  fontSize: number
  fill: number
  align: 'center'
  lineHeight: number
}

type MeasureText = (text: string, style: ThoughtTextStyle) => number
type MeasureWidth = (text: string) => number

const textInset = 18

export function thoughtRadius(text: string) {
  const minimumRadius = 64
  const maximumRadius = 144
  const areaPerCharacter = 65
  const radius = Math.sqrt(minimumRadius ** 2 + text.length * areaPerCharacter)
  return Math.min(maximumRadius, radius)
}

export function layoutThoughtText({
  text,
  radius,
  measureText,
}: {
  text: string
  radius: number
  measureText: MeasureText
}) {
  const style: ThoughtTextStyle = {
    fontFamily: 'Iowan Old Style, Baskerville, Georgia, serif',
    fontSize: text.length > 48 ? 16 : 17,
    fill: 0x26312d,
    align: 'center',
    lineHeight: 23,
  }
  const measuredWidths = new Map<string, number>()
  const measure = (value: string) => {
    const cached = measuredWidths.get(value)
    if (cached !== undefined) return cached
    const width = measureText(value, style)
    measuredWidths.set(value, width)
    return width
  }

  return {
    text: wrapTextInCircle(text, radius, style.lineHeight, measure),
    style,
  }
}

function circleLineWidths(radius: number, lineCount: number, lineHeight: number) {
  const innerRadius = Math.max(lineHeight, radius - textInset)
  const center = (lineCount - 1) / 2

  return Array.from({ length: lineCount }, (_, index) => {
    const lineCenterY = (index - center) * lineHeight
    return 2 * Math.sqrt(Math.max(0, innerRadius ** 2 - lineCenterY ** 2))
  })
}

function wrapTextInCircle(text: string, radius: number, lineHeight: number, measureText: MeasureWidth) {
  const words = text
    .trim()
    .split(/\n+/)
    .flatMap((paragraph, paragraphIndex) =>
      paragraph
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word, wordIndex) => ({
          text: word,
          breakBefore: paragraphIndex > 0 && wordIndex === 0,
        })),
    )
  if (words.length < 2) return text

  const maxLines = Math.min(words.length, Math.floor((2 * (radius - textInset)) / lineHeight))
  for (let lineCount = 1; lineCount <= maxLines; lineCount += 1) {
    const lines = fitWordsToLines(words, circleLineWidths(radius, lineCount, lineHeight), measureText)
    if (lines) return lines.join('\n')
  }

  return wrapWordsAtWidth(words, radius * 1.42, measureText).join('\n')
}

function wrapWordsAtWidth(words: { text: string; breakBefore: boolean }[], width: number, measureText: MeasureWidth) {
  const lines: string[] = []
  let currentLine = ''

  const pushLine = () => {
    if (currentLine) lines.push(currentLine)
    currentLine = ''
  }

  for (const word of words) {
    if (word.breakBefore) pushLine()

    for (const piece of splitWordToWidth(word.text, width, measureText)) {
      const candidate = currentLine ? `${currentLine} ${piece}` : piece
      if (measureText(candidate) <= width) {
        currentLine = candidate
      } else {
        pushLine()
        currentLine = piece
      }
    }
  }

  pushLine()
  return lines
}

function splitWordToWidth(word: string, width: number, measureText: MeasureWidth) {
  if (measureText(word) <= width) return [word]

  const pieces: string[] = []
  let current = ''
  for (const character of Array.from(word)) {
    const candidate = current + character
    if (current && measureText(candidate) > width) {
      pieces.push(current)
      current = character
    } else {
      current = candidate
    }
  }
  if (current) pieces.push(current)
  return pieces
}

function fitWordsToLines(words: { text: string; breakBefore: boolean }[], widths: number[], measureText: MeasureWidth) {
  const memo = new Map<string, string[] | null>()

  function fit(lineIndex: number, wordIndex: number): string[] | null {
    if (lineIndex === widths.length) return wordIndex === words.length ? [] : null

    const key = `${lineIndex}:${wordIndex}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached

    const remainingLines = widths.length - lineIndex - 1
    let paragraphEnd = wordIndex + 1
    while (paragraphEnd < words.length && !words[paragraphEnd].breakBefore) paragraphEnd += 1
    const latestEnd = Math.min(words.length - remainingLines, paragraphEnd)
    for (let end = latestEnd; end > wordIndex; end -= 1) {
      const line = words
        .slice(wordIndex, end)
        .map(({ text }) => text)
        .join(' ')
      if (measureText(line) > widths[lineIndex]) continue

      const rest = fit(lineIndex + 1, end)
      if (rest) {
        const result = [line, ...rest]
        memo.set(key, result)
        return result
      }
    }

    memo.set(key, null)
    return null
  }

  return fit(0, 0)
}
