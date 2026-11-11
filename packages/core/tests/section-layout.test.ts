import { describe, expect, it } from "vitest"
import { CardSchema, ColumnSchema } from "@bordena/contract"
import { initialLayout } from "../src/board-layout"
import { moveSection, sectionPlacement, sectionProgress, sectionProgressValues, sectionsInLane } from "../src/section-layout"
import { sortCards } from "../src/utils/sort-cards"

const columns = [0,1,2].map(i => ColumnSchema.parse({ id: `s${i}`, dashboardId: 'board', title: `Секция ${i}`, position: `a${i}`, updatedAt: 1, deletedAt: null }))
const cards = Array.from({ length: 5 }, (_,i) => CardSchema.parse({ id: `c${i}`, columnId: 's0', title: `Карточка ${i}`, body: '- [x] ё', progress: 65, position: `a${i}`, updatedAt: 1, deletedAt: null }))

describe('whole section placement', () => {
  it('moves section and preserves semantic defaults, settings and card content', () => {
    const before = initialLayout(columns,'free'); before.sections.s0.progressMode = 'manual'; before.sections.s0.collapsed = true
    const after = moveSection(before, columns, 's0', before.lanes[1].id, 0)
    expect(sectionsInLane(after, columns, before.lanes[1].id).map(s => s.id)).toEqual(['s0','s1'])
    expect(after.sections.s0).toMatchObject({ progressMode: 'manual', collapsed: true, stageId: 's0', stateId: 'state-active' })
    expect(before.sections.s0.laneId).toBe(before.lanes[0].id)
    expect(cards[0]).toMatchObject({ id: 'c0', columnId: 's0', body: '- [x] ё', progress: 65 })
  })
  it('orders up/down inside one lane and serializes the order', () => {
    let l = initialLayout(columns,'free'); for (const s of columns) l.sections[s.id].laneId = l.lanes[0].id
    l = moveSection(l,columns,'s0',l.lanes[0].id,2)
    expect(sectionsInLane(l,columns,l.lanes[0].id).map(s => s.id)).toEqual(['s1','s2','s0'])
    l = moveSection(l,columns,'s0',l.lanes[0].id,0)
    expect(sectionsInLane(JSON.parse(JSON.stringify(l)),columns,l.lanes[0].id).map(s => s.id)).toEqual(['s0','s1','s2'])
  })
  it('rejects absent sections, invalid lanes and negative indexes', () => {
    const l = initialLayout(columns,'free')
    expect(() => moveSection(l,columns,'missing',l.lanes[0].id,0)).toThrow()
    expect(() => moveSection(l,columns,'s0','missing',0)).toThrow()
    expect(() => moveSection(l,columns,'s0',l.lanes[0].id,-1)).toThrow()
  })
  it('keeps legacy order and defaults progress to off without rewriting data', () => {
    const l = initialLayout(columns,'free')
    expect(sectionPlacement(l,columns[0])).toMatchObject({ position: 'a0', progressMode: 'off' })
    expect(l.sections.s0.progressMode).toBeUndefined()
  })
})

describe('section presentation progress', () => {
  it('distributes five saved positions as 0,25,50,75,100 without changing manual values', () => {
    expect(cards.map(c => sectionProgress(c,cards,'position'))).toEqual([0,25,50,75,100])
    expect(cards.map(c => c.progress)).toEqual([65,65,65,65,65])
  })
  it('recalculates after reordering and ignores tombstones and other sections', () => {
    const moved = { ...cards[4], position: 'Zz' }, list = [moved,...cards.slice(0,4),{...cards[0],id:'other',columnId:'s1'}, {...cards[0],id:'deleted',deletedAt:1}]
    expect(sectionProgress(moved,list,'position')).toBe(0)
    expect(sectionProgress(cards[0],list,'position')).toBe(25)
  })
  it('shows no automatic progress for an empty section or a single card', () => {
    expect(sectionProgress(cards[0],[],'position')).toBeNull()
    expect(sectionProgress(cards[0],[cards[0]],'position')).toBeNull()
  })
  it('separates off, manual 0/100/unset and positional modes', () => {
    expect(sectionProgress(cards[0],cards,'off')).toBeNull()
    expect(sectionProgress({...cards[0],progress:0},cards,'manual')).toBe(0)
    expect(sectionProgress({...cards[0],progress:100},cards,'manual')).toBe(100)
    expect(sectionProgress({...cards[0],progress:null},cards,'manual')).toBeNull()
  })
  it('sorts by the active presentation mode without changing saved manual percentages', () => {
    const l = initialLayout(columns,'free'); l.sections.s0.progressMode = 'position'
    const reversed = [...cards].reverse(), values = sectionProgressValues(reversed,l)
    expect(sortCards(reversed,['progress'],c => values.get(c.id)).map(c => c.id)).toEqual(cards.map(c => c.id))
    l.sections.s0.progressMode = 'off'
    expect([...sectionProgressValues(cards,l).values()].every(x => x === null)).toBe(true)
    expect(cards.every(c => c.progress === 65)).toBe(true)
  })
})
