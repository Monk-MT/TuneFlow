import { describe, it, expect } from 'vitest'
import { similarity, decideMatch, normalize } from '../src/shared/matching'
import type { SongCandidate } from '../src/shared/types'

function song(name: string, artists: string[]): SongCandidate {
  return { songId: Math.random().toString(36), name, artists, album: '', durationMs: 0 }
}

describe('normalize', () => {
  it('lowercases and strips punctuation/space', () => {
    expect(normalize('Hello, World!')).toBe('helloworld')
    expect(normalize('晴天 - 周杰伦')).toBe('晴天周杰伦')
  })
})

describe('similarity', () => {
  it('identical strings -> 1', () => {
    expect(similarity('晴天', '晴天')).toBe(1)
  })
  it('completely different -> low', () => {
    expect(similarity('abc', 'xyz')).toBeLessThan(0.5)
  })
})

describe('decideMatch', () => {
  it('no candidates -> unmatched', () => {
    expect(decideMatch('晴天', '周杰伦', []).status).toBe('unmatched')
  })

  it('exact name+artist clear winner -> auto', () => {
    const cands = [song('晴天', ['周杰伦']), song('阴天', ['莫文蔚'])]
    const d = decideMatch('晴天', '周杰伦', cands)
    expect(d.status).toBe('auto')
    expect(d.selected?.name).toBe('晴天')
  })

  it('multiple similar covers without artist -> need_confirm', () => {
    const cands = [song('晴天', ['周杰伦']), song('晴天', ['群星'])]
    const d = decideMatch('晴天', undefined, cands)
    expect(d.status).toBe('need_confirm')
  })

  it('single exact name-only match -> auto', () => {
    const d = decideMatch('晴天', undefined, [song('晴天', ['周杰伦'])])
    expect(d.status).toBe('auto')
  })
})
