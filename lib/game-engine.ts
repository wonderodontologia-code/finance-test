import {
  type Character,
  type CheckinReward,
  type ConsumableItemId,
  type EquipmentSlot,
  type ExplorationLocationId,
  type ExplorationReward,
  type CycleHistory,
  CONSUMABLE_ITEMS,
  CLASSES,
  DEFAULT_EQUIPMENT_LEVELS,
  EQUIPMENT_SLOTS,
  EXPLORATION_LOCATIONS,
  CASTLE_LOCATION_ID,
  GOLD_REWARD_IMAGE_SRC,
  XP_REWARD_IMAGE_SRC,
  calcOuroConsumido,
  calcDaysInCycle,
  calcDamage,
  calcEffectiveAttributes,
  equipmentPrice,
  calcMaxLife,
  normalizeCharacter,
  weaponImageForClass,
  weaponNameForClass,
  xpForLevel,
} from './types'

export interface GameEvent {
  type: 'missed_day' | 'death' | 'last_breath' | 'boss_ready' | 'regen'
  characterId: string
  characterName: string
  message: string
  damage?: number
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function daysBetween(start: string, end: string): string[] {
  const result: string[] = []
  let current = start
  while (current <= end) {
    result.push(current)
    current = addDays(current, 1)
  }
  return result
}

function randomDamage(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function applyLevelUp(char: Character, xpGain: number): Character {
  let xp = char.xp + xpGain
  let level = char.level
  let xpToNext = char.xpToNextLevel
  let attrPoints = char.attributePoints
  const classDef = CLASSES.find(c => c.id === char.class)!

  while (xp >= xpToNext) {
    xp -= xpToNext
    level += 1
    attrPoints += 1
    xpToNext = xpForLevel(level)
  }

  const leveled = { ...char, level, xp, xpToNextLevel: xpToNext, attributePoints: attrPoints }
  const maxLife = calcMaxLife(level, calcEffectiveAttributes(leveled), classDef)
  return { ...char, xp, level, xpToNextLevel: xpToNext, attributePoints: attrPoints, maxLife }
}

function handleDeath(char: Character): Character {
  const classDef = CLASSES.find(c => c.id === char.class)!
  const attrs = { ...classDef.startingAttributes }
  const maxLife = calcMaxLife(1, attrs, classDef)
  return {
    ...char,
    level: 1,
    xp: 0,
    xpToNextLevel: xpForLevel(1),
    attributePoints: 0,
    attributes: attrs,
    life: maxLife,
    maxLife,
    combo: 0,
    lastBreathRecoveryDays: 0,
  }
}

function applyMissedDay(char: Character): { character: Character; event: GameEvent } {
  const classDef = CLASSES.find(c => c.id === char.class)!
  const { min, max } = calcDamage(char.level, calcEffectiveAttributes(char))
  let damage = randomDamage(min, max)
  damage = Math.round(damage * classDef.damageMod)

  let newLife = char.life - damage
  let updated = { ...char, combo: 0, life: Math.max(0, newLife) }
  let eventType: GameEvent['type'] = 'missed_day'
  let message = `Maldição do Esquecimento causou ${damage} de dano em ${char.name}.`

  // Guerreiro: Último Fôlego
  if (newLife <= 0 && char.class === 'guerreiro' && !char.lastBreathUsed) {
    updated = {
      ...updated,
      life: 1,
      lastBreathUsed: true,
      lastBreathRecoveryDays: 0,
    }
    eventType = 'last_breath'
    message = `${char.name} ativou Último Fôlego! Vida em 1 — registre 3 dias seguidos para se recuperar.`
  } else if (newLife <= 0) {
    updated = handleDeath(updated)
    eventType = 'death'
    message = `${char.name} caiu em batalha. Voltou ao nível 1, mas o histórico financeiro foi preservado.`
  }

  return {
    character: updated,
    event: { type: eventType, characterId: char.id, characterName: char.name, message, damage },
  }
}

/** Processa dias perdidos (ontem e anteriores sem registro). */
export function processDailyChecks(characters: Character[]): { characters: Character[]; events: GameEvent[] } {
  const today = todayISO()
  const events: GameEvent[] = []
  const updated = characters.map(char => {
    // Ciclo já encerrou — Boss Final cuida disso
    if (today > char.cycleEnd) {
      events.push({
        type: 'boss_ready',
        characterId: char.id,
        characterName: char.name,
        message: `O Boss Final de ${char.name} está pronto!`,
      })
      return char
    }

    // Só processa dias dentro do ciclo, até ontem
    const yesterday = addDays(today, -1)
    if (yesterday < char.cycleStart) return char

    const processUntil = yesterday < char.cycleEnd ? yesterday : char.cycleEnd
    const startFrom = char.lastProcessedDate
      ? addDays(char.lastProcessedDate, 1)
      : char.cycleStart

    if (startFrom > processUntil) return char

    let current = { ...char }

    for (const day of daysBetween(startFrom, processUntil)) {
      const hasRecord = current.dailyRecords.some(r => r.date === day && r.registered)
      if (!hasRecord) {
        const result = applyMissedDay(current)
        current = result.character
        events.push(result.event)
      } else if (current.lastBreathRecoveryDays !== undefined && current.lastBreathUsed && current.life === 1) {
        // Recovery mission for Guerreiro
        const newRecoveryDays = (current.lastBreathRecoveryDays ?? 0) + 1
        if (newRecoveryDays >= 3) {
          const attrs = calcEffectiveAttributes(current)
          const regen = 1 + Math.floor(attrs.regeneracao / 3)
          current = {
            ...current,
            life: Math.min(current.maxLife, current.life + Math.round(current.maxLife * 0.5)),
            lastBreathRecoveryDays: 0,
            lastBreathUsed: true,
          }
          events.push({
            type: 'regen',
            characterId: current.id,
            characterName: current.name,
            message: `${current.name} completou a missão de recuperação! +${regen} vida.`,
          })
        } else {
          current = { ...current, lastBreathRecoveryDays: newRecoveryDays }
        }
      }
    }

    return { ...current, lastProcessedDate: processUntil }
  })

  return { characters: updated, events }
}

export type BossResult = CycleHistory['result']

export function calcBossResult(char: Character): {
  result: BossResult
  goldPreserved: number
  xpBonus: number
  victoryTitle?: string
} {
  const totalSpent = calcOuroConsumido(char)
  const goldPreserved = Math.max(0, char.maxTreasure - totalSpent)
  const daysTotal = calcDaysInCycle(char.cycleStart, char.cycleEnd)
  const daysRegistered = char.dailyRecords.filter(r => r.registered).length
  const underLimit = totalSpent < char.maxTreasure
  const pctBelow = char.maxTreasure > 0 ? (char.maxTreasure - totalSpent) / char.maxTreasure : 0

  let result: BossResult = 'defeat'
  let victoryTitle: string | undefined

  if (char.life <= 0) {
    result = 'defeat'
  } else if (!underLimit) {
    result = totalSpent <= char.maxTreasure * 1.1 ? 'survived' : 'defeat'
  } else {
    const allDaysRegistered = daysRegistered >= daysTotal
    if (pctBelow > 0.2 && allDaysRegistered) {
      result = 'legendary'
      victoryTitle = 'Vitória Lendária'
    } else if (pctBelow > 0.1 || char.bestCombo >= 14) {
      result = 'epic'
      victoryTitle = pctBelow > 0.2 ? 'Vitória Épica' : 'Vitória Honrada'
    } else if (pctBelow > 0.05) {
      result = 'victory'
      victoryTitle = 'Vitória Honrada'
    } else {
      result = 'victory'
      victoryTitle = 'Vitória Apertada'
    }
  }

  // XP bonus from boss
  const classDef = CLASSES.find(c => c.id === char.class)!
  const attrs = calcEffectiveAttributes(char)
  const prosperidadeMult = 1 + attrs.prosperidade * 0.05
  const magoMult = classDef.id === 'mago' ? 1.1 : 1
  let bossMult = 1.0
  if (underLimit) {
    if (pctBelow > 0.2) bossMult = 1.5
    else if (pctBelow > 0.1) bossMult = 1.35
    else if (pctBelow > 0.05) bossMult = 1.2
    else bossMult = 1.1
  }
  const cycleXP = char.dailyRecords.reduce((s, r) => s + r.xpGained, 0) + (char.journeyMarkerXpGranted ? 20 : 0)
  const xpBonus = underLimit ? Math.round(cycleXP * (bossMult - 1) * prosperidadeMult * magoMult) : 0

  return { result, goldPreserved, xpBonus, victoryTitle }
}

export function buildCycleHistory(char: Character): CycleHistory {
  const { result, goldPreserved, xpBonus } = calcBossResult(char)
  const daysTotal = calcDaysInCycle(char.cycleStart, char.cycleEnd)
  const daysRegistered = char.dailyRecords.filter(r => r.registered).length
  const cycleXP = char.dailyRecords.reduce((s, r) => s + r.xpGained, 0) + (char.journeyMarkerXpGranted ? 20 : 0)

  return {
    cycleStart: char.cycleStart,
    cycleEnd: char.cycleEnd,
    maxTreasure: char.maxTreasure,
    journeyMarker: char.journeyMarker,
    totalSpent: calcOuroConsumido(char),
    goldPreserved,
    daysRegistered,
    daysTotal,
    bestCombo: char.bestCombo,
    xpTotal: cycleXP + xpBonus,
    result,
    dailyRecords: [...char.dailyRecords],
  }
}

export function startNewCycle(
  char: Character,
  params: {
    maxTreasure: number
    cycleStart: string
    cycleEnd: string
    journeyMarker: number
  }
): Character {
  const history = buildCycleHistory(char)
  let updated = applyLevelUp(char, calcBossResult(char).xpBonus)

  return applyLevelUp({
    ...updated,
    cycleStart: params.cycleStart,
    cycleEnd: params.cycleEnd,
    maxTreasure: params.maxTreasure,
    journeyMarker: params.journeyMarker,
    journeyMarkerXpGranted: true,
    dailyRecords: [],
    combo: 0,
    bestCombo: 0,
    specialUsed: false,
    lastBreathUsed: false,
    sealUsed: false,
    masterStrikeUsedThisWeek: false,
    lastProcessedDate: undefined,
    goldChest: (char.goldChest ?? 0) + history.goldPreserved,
    cycleHistory: [...char.cycleHistory, history],
  }, 20)
}

export interface BattleResult {
  character: Character
  won: boolean
  message: string
  xpGained: number
  damageTaken: number
  goldGained: number
  monsterName: string
  playerBattleHpStart: number
  playerBattleHpEnd: number
  monsterHpStart: number
  monsterHpEnd: number
  rounds: BattleRound[]
  itemGained?: ConsumableItemId
  died?: boolean
}

export interface BattleRound {
  turn: number
  actor: 'player' | 'monster'
  result: 'hit' | 'miss' | 'critical'
  damage: number
  playerHp: number
  monsterHp: number
  text: string
}

export function battlesToday(char: Character): number {
  const today = todayISO()
  return (char.battleLog ?? []).find(log => log.date === today)?.count ?? 0
}

export const CHECKIN_COOLDOWN_HOURS = 8
export const CHECKIN_ACTION_NAME = 'Ronda do Tesouro'

export function nextCheckinAt(char: Character): Date | null {
  if (!char.lastCheckinAt) return null
  const last = new Date(char.lastCheckinAt)
  if (Number.isNaN(last.getTime())) return null
  return new Date(last.getTime() + CHECKIN_COOLDOWN_HOURS * 60 * 60 * 1000)
}

export function canCheckin(char: Character, now = new Date()): boolean {
  const next = nextCheckinAt(char)
  return !next || now >= next
}

export function checkinTimeRemaining(char: Character, now = new Date()): number {
  const next = nextCheckinAt(char)
  if (!next) return 0
  return Math.max(0, next.getTime() - now.getTime())
}

export function maxBattleDamageOnDefeat(char: Character): number {
  const current = normalizeCharacter(char)
  const classDef = CLASSES.find(c => c.id === current.class)!
  const attrs = calcEffectiveAttributes(current)
  const raw = 3 + Math.ceil(current.level * 0.55) + battlesToday(current)
  const reduced = Math.round(raw * (1 - Math.min(0.35, attrs.resiliencia * 0.025)) * classDef.damageMod)
  return Math.max(0, Math.min(Math.max(0, Math.floor(current.life / 2)), Math.max(1, reduced)))
}

function incrementBattleCount(char: Character): Character {
  const today = todayISO()
  const logs = char.battleLog ?? []
  const existing = logs.find(log => log.date === today)
  return {
    ...char,
    battleLog: existing
      ? logs.map(log => log.date === today ? { ...log, count: log.count + 1 } : log)
      : [...logs.slice(-14), { date: today, count: 1 }],
  }
}

function addInventoryItem(char: Character, itemId: ConsumableItemId, quantity = 1): Character {
  const inventory = char.inventory ?? []
  const existing = inventory.find(item => item.itemId === itemId)
  return {
    ...char,
    inventory: existing
      ? inventory.map(item => item.itemId === itemId ? { ...item, quantity: item.quantity + quantity } : item)
      : [...inventory, { itemId, quantity }],
  }
}

function dateOnly(date: Date): string {
  return date.toISOString().split('T')[0]
}

function daysSince(startedAt: string, now = new Date()): number {
  const start = new Date(startedAt)
  if (Number.isNaN(start.getTime())) return 0
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
}

function registeredDaysSince(char: Character, startedAt: string): number {
  const startDate = dateOnly(new Date(startedAt))
  const uniqueDates = new Set(
    char.dailyRecords
      .filter(record => record.registered && record.date >= startDate)
      .map(record => record.date)
  )
  return uniqueDates.size
}

function missedRitualSince(char: Character, startedAt: string, now = new Date()): boolean {
  const startDate = dateOnly(new Date(startedAt))
  const yesterday = addDays(dateOnly(now), -1)
  if (startDate > yesterday) return false

  const registeredDates = new Set(
    char.dailyRecords
      .filter(record => record.registered && record.date >= startDate && record.date <= yesterday)
      .map(record => record.date)
  )

  return daysBetween(startDate, yesterday).some(day => !registeredDates.has(day))
}

function explorationLocation(locationId: ExplorationLocationId) {
  return EXPLORATION_LOCATIONS.find(location => location.id === locationId) ?? EXPLORATION_LOCATIONS[0]
}

export function explorationProgress(char: Character, now = new Date()): {
  progressDays: number
  requiredDays: number
  progressPct: number
  readyToComplete: boolean
} {
  const current = normalizeCharacter(char)
  const journey = current.exploration.activeJourney
  if (!journey) {
    return { progressDays: 0, requiredDays: 0, progressPct: 0, readyToComplete: false }
  }

  const progressDays = journey.returning
    ? daysSince(journey.startedAt, now)
    : registeredDaysSince(current, journey.startedAt)
  const capped = Math.min(journey.requiredDays, progressDays)

  return {
    progressDays: capped,
    requiredDays: journey.requiredDays,
    progressPct: journey.requiredDays > 0 ? capped / journey.requiredDays : 1,
    readyToComplete: capped >= journey.requiredDays,
  }
}

export function canExploreLocation(char: Character, locationId: ExplorationLocationId): { ok: boolean; reason?: string } {
  const current = normalizeCharacter(char)
  const location = explorationLocation(locationId)
  if (location.id === CASTLE_LOCATION_ID) return { ok: false, reason: 'O castelo é o ponto de partida.' }
  if (current.exploration.activeJourney) return { ok: false, reason: 'Já existe uma exploração em andamento.' }
  if (current.exploration.currentLocationId !== CASTLE_LOCATION_ID) return { ok: false, reason: 'Volte ao castelo antes de explorar outro local.' }
  if (current.exploration.completedLocationIds.includes(location.id)) return { ok: false, reason: 'Esse local já foi explorado.' }
  if (current.level < location.minLevel) return { ok: false, reason: `Requer nível ${location.minLevel}.` }
  return { ok: true }
}

export function syncExplorationConsistency(char: Character, now = new Date()): { character: Character; changed: boolean; message?: string } {
  const current = normalizeCharacter(char)
  const journey = current.exploration.activeJourney
  if (!journey || journey.returning) return { character: current, changed: false }
  if (!missedRitualSince(current, journey.startedAt, now)) return { character: current, changed: false }

  const destination = explorationLocation(journey.toLocationId)
  return {
    character: {
      ...current,
      exploration: {
        ...current.exploration,
        activeJourney: {
          fromLocationId: destination.id,
          toLocationId: CASTLE_LOCATION_ID,
          startedAt: now.toISOString(),
          requiredDays: 1,
          returning: true,
        },
      },
    },
    changed: true,
    message: `A sequência do Ritual de Registro foi quebrada. A exploração em ${destination.name} foi abandonada e o personagem está voltando ao castelo.`,
  }
}

export function startExploration(char: Character, locationId: ExplorationLocationId): { character: Character; ok: boolean; message: string } {
  const current = normalizeCharacter(char)
  const location = explorationLocation(locationId)
  const allowed = canExploreLocation(current, location.id)
  if (!allowed.ok) return { character: current, ok: false, message: allowed.reason ?? 'Não foi possível iniciar a exploração.' }

  return {
    character: {
      ...current,
      exploration: {
        ...current.exploration,
        activeJourney: {
          fromLocationId: CASTLE_LOCATION_ID,
          toLocationId: location.id,
          startedAt: new Date().toISOString(),
          requiredDays: location.requiredDays,
          returning: false,
        },
      },
    },
    ok: true,
    message: `Exploração iniciada: ${location.name}. Complete ${location.requiredDays} dia${location.requiredDays > 1 ? 's' : ''} de Ritual de Registro para chegar ao destino.`,
  }
}

function equipmentRewardImage(char: Character, slot: EquipmentSlot): string {
  return slot === 'weapon' ? weaponImageForClass(char.class) : EQUIPMENT_SLOTS[slot].imageSrc
}

function equipmentRewardName(char: Character, slot: EquipmentSlot): string {
  return slot === 'weapon' ? weaponNameForClass(char.class) : EQUIPMENT_SLOTS[slot].baseName
}

function buildExplorationReward(char: Character, locationId: ExplorationLocationId): { character: Character; reward: ExplorationReward } {
  let current = normalizeCharacter(char)
  const location = explorationLocation(locationId)
  const attrs = calcEffectiveAttributes(current)
  const xpGained = Math.round(location.xpBase + current.level * 5 + attrs.sabedoria * 1.5)
  const dropRoll = Math.random()
  current = applyLevelUp(current, xpGained)

  if (dropRoll < location.dropChance && location.lootKind === 'equipment') {
    const equipment = { ...DEFAULT_EQUIPMENT_LEVELS, ...(current.equipmentLevels ?? {}) }
    const availableSlots = (Object.keys(equipment) as EquipmentSlot[]).filter(slot => equipment[slot] < 10)
    if (availableSlots.length > 0) {
      const slot = availableSlots[Math.floor(Math.random() * availableSlots.length)]
      const nextLevel = equipment[slot] + 1
      const updated: Character = {
        ...current,
        equipmentLevels: { ...equipment, [slot]: nextLevel },
      }
      const classDef = CLASSES.find(c => c.id === updated.class)!
      const maxLife = calcMaxLife(updated.level, calcEffectiveAttributes(updated), classDef)
      current = { ...updated, maxLife, life: Math.min(maxLife, updated.life) }
      return {
        character: current,
        reward: {
          type: 'equipment',
          label: `${equipmentRewardName(current, slot)} Nv. ${nextLevel}`,
          imageSrc: equipmentRewardImage(current, slot),
          xpGained,
          equipmentSlotGained: slot,
          equipmentLevelGained: nextLevel,
        },
      }
    }
  }

  if (dropRoll < location.dropChance && location.lootKind === 'consumable') {
    const itemGained: ConsumableItemId = location.requiredDays >= 3 && Math.random() > 0.72 ? 'pocao_grande' : 'pocao_pequena'
    current = addInventoryItem(current, itemGained, 1)
    return {
      character: current,
      reward: {
        type: 'consumable',
        label: CONSUMABLE_ITEMS[itemGained].name,
        imageSrc: CONSUMABLE_ITEMS[itemGained].imageSrc,
        xpGained,
        itemGained,
      },
    }
  }

  const goldGained = Math.round(location.goldBase + current.level * 4 + attrs.prosperidade * 2)
  current = {
    ...current,
    goldChest: (current.goldChest ?? 0) + goldGained,
  }
  return {
    character: current,
    reward: {
      type: 'gold',
      label: `+R$ ${goldGained.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      imageSrc: GOLD_REWARD_IMAGE_SRC,
      xpGained,
      goldGained,
    },
  }
}

export function completeExplorationStep(char: Character): { character: Character; ok: boolean; message: string; reward?: ExplorationReward } {
  const current = normalizeCharacter(char)
  const journey = current.exploration.activeJourney
  if (!journey) return { character: current, ok: false, message: 'Nenhuma exploração em andamento.' }

  const progress = explorationProgress(current)
  if (!progress.readyToComplete) {
    return {
      character: current,
      ok: false,
      message: journey.returning
        ? 'A caravana ainda não chegou ao castelo.'
        : 'Ainda faltam dias de Ritual de Registro para chegar ao destino.',
    }
  }

  if (journey.returning) {
    return {
      character: {
        ...current,
        exploration: {
          ...current.exploration,
          currentLocationId: CASTLE_LOCATION_ID,
          activeJourney: undefined,
        },
      },
      ok: true,
      message: 'Retorno concluído. O personagem está de volta ao Castelo da Guilda.',
    }
  }

  const { character: rewarded, reward } = buildExplorationReward(current, journey.toLocationId)
  const location = explorationLocation(journey.toLocationId)
  return {
    character: {
      ...rewarded,
      exploration: {
        ...rewarded.exploration,
        currentLocationId: location.id,
        completedLocationIds: [...new Set([...rewarded.exploration.completedLocationIds, location.id])],
        lastReward: reward,
        activeJourney: {
          fromLocationId: location.id,
          toLocationId: CASTLE_LOCATION_ID,
          startedAt: new Date().toISOString(),
          requiredDays: 1,
          returning: true,
        },
      },
    },
    ok: true,
    message: `${location.name} explorado. A volta ao castelo começou e leva 1 dia.`,
    reward,
  }
}

export interface CheckinResult {
  character: Character
  ok: boolean
  message: string
  reward?: CheckinReward
  nextAvailableAt?: string
}

export function performCheckin(char: Character): CheckinResult {
  let current = normalizeCharacter(char)
  const now = new Date()
  const next = nextCheckinAt(current)

  if (next && now < next) {
    return {
      character: current,
      ok: false,
      message: `${CHECKIN_ACTION_NAME} ainda está em preparo.`,
      nextAvailableAt: next.toISOString(),
    }
  }

  const attrs = calcEffectiveAttributes(current)
  const roll = Math.random()
  let reward: CheckinReward

  if (roll < 0.45) {
    const xpGained = Math.round(10 + current.level * 3 + attrs.sabedoria * 1.4)
    current = applyLevelUp(current, xpGained)
    reward = {
      type: 'xp',
      label: `+${xpGained} XP`,
      imageSrc: XP_REWARD_IMAGE_SRC,
      xpGained,
    }
  } else if (roll < 0.75) {
    const goldGained = Math.round(8 + current.level * 3 + attrs.prosperidade * 2)
    current = {
      ...current,
      goldChest: (current.goldChest ?? 0) + goldGained,
    }
    reward = {
      type: 'gold',
      label: `+R$ ${goldGained.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      imageSrc: GOLD_REWARD_IMAGE_SRC,
      goldGained,
    }
  } else {
    const itemGained: ConsumableItemId = Math.random() > 0.82 ? 'pocao_grande' : 'pocao_pequena'
    current = addInventoryItem(current, itemGained, 1)
    reward = {
      type: 'item',
      label: CONSUMABLE_ITEMS[itemGained].name,
      imageSrc: CONSUMABLE_ITEMS[itemGained].imageSrc,
      itemGained,
    }
  }

  current = {
    ...current,
    lastCheckinAt: now.toISOString(),
  }

  return {
    character: current,
    ok: true,
    message: `${CHECKIN_ACTION_NAME} concluída. Você manteve os olhos no reino e encontrou uma recompensa.`,
    reward,
    nextAvailableAt: new Date(now.getTime() + CHECKIN_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString(),
  }
}

export function performBattle(char: Character): BattleResult {
  let current = normalizeCharacter(char)
  const monsterName = 'Cobrador da Masmorra'
  if (battlesToday(current) >= 3) {
    return {
      character: current,
      won: false,
      message: 'Limite diário atingido. Volte amanhã para lutar de novo.',
      xpGained: 0,
      damageTaken: 0,
      goldGained: 0,
      monsterName,
      playerBattleHpStart: 0,
      playerBattleHpEnd: 0,
      monsterHpStart: 0,
      monsterHpEnd: 0,
      rounds: [],
    }
  }

  const classDef = CLASSES.find(c => c.id === current.class)!
  const attrs = calcEffectiveAttributes(current)
  const attack =
    current.level * 5 +
    attrs.vigor * 1.2 +
    attrs.sabedoria * 1.3 +
    attrs.disciplina * 1.4 +
    attrs.prosperidade * 1.1 +
    attrs.resiliencia * 0.8
  const battleNumber = battlesToday(current)
  const enemyPower = 9 + current.level * 3.5 + battleNumber * 3
  const playerBattleHpStart = Math.max(12, current.life + current.level * 3 + attrs.vigor * 2)
  const monsterHpStart = Math.round(16 + current.level * 5 + battleNumber * 5)
  const defeatDamage = maxBattleDamageOnDefeat(current)
  let playerHp = playerBattleHpStart
  let monsterHp = monsterHpStart
  const rounds: BattleRound[] = []

  for (let turn = 1; turn <= 16 && playerHp > 0 && monsterHp > 0; turn += 1) {
    const playerMissChance = Math.max(0.06, 0.18 - attrs.disciplina * 0.012)
    const playerCritChance = Math.min(0.34, 0.1 + attrs.sabedoria * 0.014 + attrs.prosperidade * 0.008)
    const playerRoll = Math.random()

    if (playerRoll < playerMissChance) {
      rounds.push({
        turn,
        actor: 'player',
        result: 'miss',
        damage: 0,
        playerHp,
        monsterHp,
        text: `${current.name} atacou, mas o ${monsterName} desviou.`,
      })
    } else {
      const critical = playerRoll > 1 - playerCritChance
      const baseDamage = Math.max(3, Math.round(attack / 4.2 + Math.random() * (5 + current.level)))
      const damage = critical ? Math.round(baseDamage * 1.8) : baseDamage
      monsterHp = Math.max(0, monsterHp - damage)
      rounds.push({
        turn,
        actor: 'player',
        result: critical ? 'critical' : 'hit',
        damage,
        playerHp,
        monsterHp,
        text: critical
          ? `Crítico! ${current.name} quebrou a defesa do ${monsterName} e causou ${damage} de dano.`
          : `${current.name} acertou o ${monsterName} e causou ${damage} de dano.`,
      })
    }

    if (monsterHp <= 0) break

    const monsterMissChance = Math.min(0.38, 0.16 + attrs.resiliencia * 0.014)
    const monsterCritChance = Math.max(0.03, 0.1 - attrs.resiliencia * 0.007)
    const monsterRoll = Math.random()

    if (monsterRoll < monsterMissChance) {
      rounds.push({
        turn,
        actor: 'monster',
        result: 'miss',
        damage: 0,
        playerHp,
        monsterHp,
        text: `${monsterName} errou o golpe no escuro da arena.`,
      })
    } else {
      const critical = monsterRoll > 1 - monsterCritChance
      const baseDamage = Math.max(1, Math.round(enemyPower / 11 + Math.random() * (2 + battleNumber)))
      const damage = critical ? Math.round(baseDamage * 1.5) : baseDamage
      playerHp = Math.max(0, playerHp - damage)
      rounds.push({
        turn,
        actor: 'monster',
        result: critical ? 'critical' : 'hit',
        damage,
        playerHp,
        monsterHp,
        text: critical
          ? `${monsterName} acertou um crítico e drenou ${damage} de vida temporária.`
          : `${monsterName} contra-atacou e causou ${damage} de dano temporário.`,
      })
    }
  }

  const won = monsterHp <= 0 || (playerHp > 0 && monsterHp <= monsterHpStart * 0.35)

  current = incrementBattleCount(current)

  if (won) {
    const xpGained = Math.round(18 + current.level * 4 + attrs.sabedoria * 1.5)
    let goldGained = 0
    let itemGained: ConsumableItemId | undefined
    const lootRoll = Math.random()

    if (lootRoll > 0.72) {
      goldGained = Math.round(12 + current.level * 4 + attrs.prosperidade * 3)
    } else if (lootRoll > 0.52) {
      itemGained = Math.random() > 0.78 ? 'pocao_grande' : 'pocao_pequena'
      current = addInventoryItem(current, itemGained, 1)
    }

    current = applyLevelUp({
      ...current,
      goldChest: (current.goldChest ?? 0) + goldGained,
    }, xpGained)

    return {
      character: current,
      won,
      message: `${current.name} venceu a batalha contra um ${monsterName}.`,
      xpGained,
      damageTaken: 0,
      goldGained,
      monsterName,
      playerBattleHpStart,
      playerBattleHpEnd: playerHp,
      monsterHpStart,
      monsterHpEnd: monsterHp,
      rounds,
      itemGained,
    }
  }

  const reduced = defeatDamage
  const lossXp = Math.max(3, Math.round(current.level * 1.5))
  current = applyLevelUp({
    ...current,
    life: Math.max(0, current.life - reduced),
  }, lossXp)

  return {
    character: current,
    won,
    message: `${current.name} perdeu a batalha e recuou antes de cair.`,
    xpGained: lossXp,
    damageTaken: reduced,
    goldGained: 0,
    monsterName,
    playerBattleHpStart,
    playerBattleHpEnd: playerHp,
    monsterHpStart,
    monsterHpEnd: monsterHp,
    rounds,
    died: false,
  }
}

export function buyConsumable(char: Character, itemId: ConsumableItemId): { character: Character; message: string } {
  const item = CONSUMABLE_ITEMS[itemId]
  const gold = char.goldChest ?? 0
  if (gold < item.price) return { character: char, message: 'Ouro insuficiente no Baú.' }
  return {
    character: addInventoryItem({ ...char, goldChest: gold - item.price }, itemId, 1),
    message: `${item.name} comprado.`,
  }
}

export function useConsumable(char: Character, itemId: ConsumableItemId): { character: Character; message: string } {
  const item = CONSUMABLE_ITEMS[itemId]
  const inventory = char.inventory ?? []
  const owned = inventory.find(inv => inv.itemId === itemId)
  if (!owned || owned.quantity <= 0) return { character: char, message: 'Item indisponível.' }
  if (char.life >= char.maxLife) return { character: char, message: 'A vida já está cheia.' }
  return {
    character: {
      ...char,
      life: Math.min(char.maxLife, char.life + item.heal),
      inventory: inventory
        .map(inv => inv.itemId === itemId ? { ...inv, quantity: inv.quantity - 1 } : inv)
        .filter(inv => inv.quantity > 0),
    },
    message: `${item.name} usada. +${item.heal} vida.`,
  }
}

export function buyEquipmentUpgrade(char: Character, slot: EquipmentSlot): { character: Character; message: string } {
  const equipment = { ...DEFAULT_EQUIPMENT_LEVELS, ...(char.equipmentLevels ?? {}) }
  const currentLevel = equipment[slot]
  if (currentLevel >= 10) return { character: char, message: 'Esse equipamento já está no nível máximo.' }

  const nextLevel = currentLevel + 1
  const price = equipmentPrice(nextLevel)
  const gold = char.goldChest ?? 0
  if (gold < price) return { character: char, message: 'Ouro insuficiente no Baú.' }

  const updated: Character = {
    ...char,
    goldChest: gold - price,
    equipmentLevels: { ...equipment, [slot]: nextLevel },
  }
  const classDef = CLASSES.find(c => c.id === updated.class)!
  const maxLife = calcMaxLife(updated.level, calcEffectiveAttributes(updated), classDef)

  return {
    character: { ...updated, maxLife, life: Math.min(maxLife, updated.life) },
    message: `Equipamento aprimorado para nível ${nextLevel}.`,
  }
}

export function updateJourneyMarker(char: Character, newMarker: number): Character {
  let updated = { ...char, journeyMarker: newMarker }
  if (!char.journeyMarkerXpGranted) {
    updated = { ...updated, journeyMarkerXpGranted: true }
    updated = applyLevelUp(updated, 20)
  }
  return updated
}

export function getCharactersNeedingBoss(characters: Character[]): Character[] {
  const today = todayISO()
  return characters.filter(c => today > c.cycleEnd)
}
