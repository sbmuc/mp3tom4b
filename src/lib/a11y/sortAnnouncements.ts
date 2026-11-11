import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core'

/**
 * What a screen reader hears while a list is reordered by keyboard. dnd-kit's
 * defaults name the items by their internal ids ("Draggable item 9f9cb969-…
 * was dropped over droppable area 1b7d…"); these name the item and its
 * position instead. `ids` is the list in its current order, `label` gives an
 * item's name. Pure: the strings are tested in announcements.test.ts.
 */
export function sortAnnouncements(
  ids: readonly UniqueIdentifier[],
  label: (id: UniqueIdentifier) => string,
): Announcements {
  const count = ids.length
  const position = (id: UniqueIdentifier) => ids.indexOf(id) + 1
  return {
    onDragStart({ active }) {
      return `Picked up ${label(active.id)}, position ${position(active.id)} of ${count}.`
    },
    onDragOver({ active, over }) {
      if (!over) return `${label(active.id)} is no longer over the list.`
      return `${label(active.id)} moved to position ${position(over.id)} of ${count}.`
    },
    onDragEnd({ active, over }) {
      if (!over) return `${label(active.id)} was dropped back at position ${position(active.id)} of ${count}.`
      return `${label(active.id)} dropped at position ${position(over.id)} of ${count}.`
    },
    onDragCancel({ active }) {
      return `Moving cancelled. ${label(active.id)} is back at position ${position(active.id)} of ${count}.`
    },
  }
}

export const SORT_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'To move this item, press Space or Enter. Use the up and down arrow keys to move it, press Space or Enter again to drop it in its new place, or Escape to cancel.',
}
