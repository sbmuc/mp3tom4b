import { describe, expect, it } from 'vitest'
import { htmlToText } from '@/lib/metadata-search/text'

describe('htmlToText', () => {
  it("turns iTunes' description HTML into readable text", () => {
    const html =
      '<b>THE #1 </b><b><i> NEW YORK TIMES </i></b><b> BESTSELLER</b><br /><br />Ryland Grace is the sole survivor &amp; the last hope.<br />Smaug&rsquo;s left eye.'
    expect(htmlToText(html)).toBe('THE #1 NEW YORK TIMES BESTSELLER\n\nRyland Grace is the sole survivor & the last hope.\nSmaug’s left eye.')
  })

  it('keeps paragraphs apart and decodes numeric entities', () => {
    expect(htmlToText('<p>One&#8217;s</p><p>Two &#x2014; three</p>')).toBe('One’s\n\nTwo — three')
  })

  it('leaves no markup behind, and unknown entities as they were', () => {
    expect(htmlToText('<script>alert(1)</script>Text &foo; <a href="x">link</a>')).toBe('alert(1)Text &foo; link')
  })

  it('closes up spaces and blank lines', () => {
    expect(htmlToText('  a   b <br><br><br><br> c  ')).toBe('a b\n\nc')
  })
})
