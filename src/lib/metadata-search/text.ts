const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  eacute: 'é',
  egrave: 'è',
  euml: 'ë',
  iuml: 'ï',
  ouml: 'ö',
  uuml: 'ü',
  auml: 'ä',
  szlig: 'ß',
  copy: '©',
  reg: '®',
  trade: '™',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole
  })
}

/**
 * A store's HTML description (iTunes: "<b>…</b><br /><br />…") as plain
 * text for a description tag: line breaks and paragraphs kept, every other
 * tag dropped, entities decoded, spaces closed up. Never rendered as HTML,
 * so nothing in it can run; this only makes it readable.
 */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/\r\n?/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
