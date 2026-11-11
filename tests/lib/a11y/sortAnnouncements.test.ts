import { describe, expect, it } from 'vitest'
import { sortAnnouncements } from '@/lib/a11y/sortAnnouncements'

// dnd-kit passes Active/Over objects; only the id is read.
const item = (id: string) => ({ id }) as never

describe('sortAnnouncements', () => {
  const titles: Record<string, string> = { 'uuid-1': 'Intro', 'uuid-2': 'Second', 'uuid-3': 'Third' }
  const a = sortAnnouncements(['uuid-1', 'uuid-2', 'uuid-3'], (id) => titles[String(id)])

  it('names the item and its position, never its internal id', () => {
    const said = [
      a.onDragStart({ active: item('uuid-1') }),
      a.onDragOver({ active: item('uuid-1'), over: item('uuid-3') }),
      a.onDragEnd({ active: item('uuid-1'), over: item('uuid-3') }),
      a.onDragCancel({ active: item('uuid-2'), over: null }),
    ]
    expect(said).toEqual([
      'Picked up Intro, position 1 of 3.',
      'Intro moved to position 3 of 3.',
      'Intro dropped at position 3 of 3.',
      'Moving cancelled. Second is back at position 2 of 3.',
    ])
    expect(said.join(' ')).not.toMatch(/uuid/)
  })

  it('says where it stays when dropped outside the list', () => {
    expect(a.onDragEnd({ active: item('uuid-2'), over: null })).toBe('Second was dropped back at position 2 of 3.')
  })
})
