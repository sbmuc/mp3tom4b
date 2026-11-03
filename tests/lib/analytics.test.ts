import { afterEach, describe, expect, it } from 'vitest'
import { trackEvent, trackFailure, type UmamiPayload } from '@/lib/analytics'

describe('trackEvent', () => {
  afterEach(() => {
    delete window.umami
  })

  const capture = () => {
    const sent: UmamiPayload[] = []
    window.umami = { track: (payload) => sent.push(payload({ url: '/where-the-script-loaded', title: 'mp3tom4b' })) }
    return sent
  }

  it('files the event under the page it happened on, not the one the script loaded on', () => {
    const sent = capture()
    window.history.pushState({}, '', '/add-chapters-to-mp3')
    trackEvent('chapters_detected', { chapterCount: 3 })
    expect(sent).toEqual([{ url: '/add-chapters-to-mp3', title: 'mp3tom4b', name: 'chapters_detected', data: { chapterCount: 3 } }])
  })

  it('sends only the kind of failure, never the message', () => {
    const sent = capture()
    trackFailure('convert', new Error('chapter 3/10 "My Secret Book.mp3": memory access out of bounds'), { fileCount: 10 })
    expect(sent[0].name).toBe('tool_failed')
    expect(sent[0].data).toEqual({ tool: 'convert', reason: 'out_of_memory', fileCount: 10 })
    expect(JSON.stringify(sent[0])).not.toContain('Secret')
  })

  it('does nothing when Umami is not loaded', () => {
    expect(() => trackEvent('conversion_completed')).not.toThrow()
  })
})
