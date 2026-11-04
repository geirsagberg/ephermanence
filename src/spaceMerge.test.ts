import { describe, expect, it } from 'vitest'

import { mergeSpaces } from './spaceMerge'
import { parseSpaceState } from './spaceStorage'
import type { Attachment, SpaceState, Thought } from './types'

const emptySpace: SpaceState = { thoughts: [], attachments: [] }

function thought(id: string, changes: Partial<Thought> = {}): Thought {
  return { id, text: id, x: 0, y: 0, tone: 0, ...changes }
}

function space(thoughts: Thought[], attachments: Attachment[] = []): SpaceState {
  return { thoughts, attachments }
}

describe('space merge', () => {
  it('keeps a field changed on only one side', () => {
    const base = space([thought('a')])
    const local = space([thought('a', { text: 'local text', tone: 2 })])
    const remote = space([thought('a', { x: 10, y: 20 })])

    expect(mergeSpaces(base, local, remote)).toEqual(
      space([thought('a', { text: 'local text', x: 10, y: 20, tone: 2 })]),
    )
  })

  it('lets remote win when position or tone changed on both sides', () => {
    const base = space([thought('a')])
    const local = space([thought('a', { x: 5, y: 5, tone: 1 })])
    const remote = space([thought('a', { x: 10, y: 20, tone: 3 })])

    expect(mergeSpaces(base, local, remote)).toEqual(space([thought('a', { x: 10, y: 20, tone: 3 })]))
  })

  it('treats x and y as one position', () => {
    const base = space([thought('a')])
    const local = space([thought('a', { x: 5 })])
    const remote = space([thought('a', { y: 20 })])

    expect(mergeSpaces(base, local, remote)).toEqual(space([thought('a', { y: 20 })]))
  })

  it('keeps both versions when text changed differently on both sides', () => {
    const base = space([thought('a')])
    const local = space([thought('a', { text: 'local' })])
    const remote = space([thought('a', { text: 'remote' })])

    const merged = mergeSpaces(base, local, remote)

    expect(merged.thoughts).toHaveLength(2)
    const [kept, copy] = merged.thoughts
    expect(kept).toEqual(thought('a', { text: 'remote' }))
    expect(copy).toMatchObject({ text: 'local', y: 0, tone: 0 })
    expect(copy.id).not.toBe('a')
    expect(copy.x).toBeGreaterThan(kept.x)
  })

  it('keeps one thought when both sides changed text the same way', () => {
    const base = space([thought('a')])
    const changed = space([thought('a', { text: 'same' })])

    expect(mergeSpaces(base, changed, changed)).toEqual(changed)
  })

  it('gives the local copy an id that does not collide', () => {
    const base = space([thought('a')])
    const local = space([thought('a', { text: 'local' })])
    const remote = space([thought('a', { text: 'remote' }), thought('a-local')])

    const ids = mergeSpaces(base, local, remote).thoughts.map(({ id }) => id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps a thought deleted on one side and edited on the other', () => {
    const base = space([thought('a'), thought('b')])
    const local = space([thought('a', { text: 'edited' })])
    const remote = space([thought('b', { tone: 4 })])

    expect(mergeSpaces(base, local, remote)).toEqual(
      space([thought('b', { tone: 4 }), thought('a', { text: 'edited' })]),
    )
  })

  it('deletes a thought deleted on one side and unchanged on the other', () => {
    const base = space([thought('a'), thought('b'), thought('c')])
    const local = space([thought('b'), thought('c')])
    const remote = space([thought('a'), thought('c')])

    expect(mergeSpaces(base, local, remote)).toEqual(space([thought('c')]))
  })

  it('merges attachments as unordered sets', () => {
    const thoughts = [thought('a'), thought('b'), thought('c'), thought('d')]
    const base = space(thoughts, [
      ['a', 'b'],
      ['b', 'c'],
    ])
    const local = space(thoughts, [
      ['b', 'a'],
      ['c', 'd'],
    ])
    const remote = space(thoughts, [
      ['a', 'b'],
      ['b', 'c'],
      ['a', 'd'],
    ])

    expect(mergeSpaces(base, local, remote).attachments).toEqual([
      ['a', 'b'],
      ['a', 'd'],
      ['c', 'd'],
    ])
  })

  it('drops attachments whose thoughts no longer exist', () => {
    const base = space([thought('a'), thought('b')])
    const local = space([thought('a'), thought('b'), thought('c')], [['b', 'c']])
    const remote = space([thought('a')])

    expect(mergeSpaces(base, local, remote)).toEqual(space([thought('a'), thought('c')]))
  })

  it('yields the union of both spaces from an empty base', () => {
    const local = space([thought('a'), thought('shared', { x: 1 })], [['a', 'shared']])
    const remote = space([thought('b'), thought('shared', { x: 2 })], [['b', 'shared']])

    expect(mergeSpaces(emptySpace, local, remote)).toEqual(
      space(
        [thought('b'), thought('shared', { x: 2 }), thought('a')],
        [
          ['b', 'shared'],
          ['a', 'shared'],
        ],
      ),
    )
  })

  it('is deterministic and passes space validation', () => {
    const base = space([thought('a'), thought('b')], [['a', 'b']])
    const local = space([thought('a', { text: 'local' }), thought('c')], [['a', 'c']])
    const remote = space([thought('a', { text: 'remote' }), thought('b'), thought('d')], [['a', 'b']])

    const merged = mergeSpaces(base, local, remote)

    expect(mergeSpaces(base, local, remote)).toEqual(merged)
    expect(parseSpaceState(merged)).toEqual(merged)
  })
})
