import {
  type Character,
  type CheckinReward,
  type CharacterEventLogEntry,
  type ConsumableItemId,
  type CycleGoalId,
  type DailyMissionId,
  type EquipmentSlot,
  type ExplorationLocationId,
  type ExplorationReward,
  type TitleId,
  type WeeklyContractId,
  type XPBreakdownLine,
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
import { addDaysISO, dateToISO, startOfWeekISO as startOfWeekISODate } from './date'

export interface GameEvent {
  type: 'missed_day' | 'death' | 'last_breath' | 'boss_ready' | 'regen' | 'system'
  characterId: string
  characterName: string
  message: string
  damage?: number
}

export interface ActionHint {
  id: string
  title: string
  description: string
  target: 'ritual' | 'checkin' | 'battle' | 'inventory' | 'shop' | 'explore' | 'attributes' | 'history' | 'realm'
  priority: 'danger' | 'warning' | 'good' | 'neutral'
}

export interface CycleGoalView {
  id: CycleGoalId
  title: string
  description: string
  progress: number
  target: number
  completed: boolean
  reward: string
}

export interface WeeklyContractDefinition {
  id: WeeklyContractId
  title: string
  description: string
  target: number
  xpReward: number
  actionTarget: ActionHint['target']
}

export interface WeeklyContractView extends WeeklyContractDefinition {
  progress: number
  completed: boolean
  claimed: boolean
}

export interface TitleDefinition {
  id: TitleId
  name: string
  description: string
}

export interface TitleView extends TitleDefinition {
  unlocked: boolean
  equipped: boolean
}

export interface CalendarDayView {
  date: string
  day: number
  status: 'future' | 'registered' | 'missed' | 'today' | 'outside'
  amount?: number
}

export interface CodexEntry {
  id: string
  name: string
  description: string
  unlocked: boolean
  kind: 'local' | 'monstro' | 'item' | 'titulo'
}

export interface FinancialEventView {
  id: string
  title: string
  description: string
  date: string
  severity: 'good' | 'warning' | 'danger' | 'neutral'
}

function todayISO(): string {
  return dateToISO()
}

function addDays(dateStr: string, days: number): string {
  return addDaysISO(dateStr, days)
}

function startOfWeekISO(date = new Date()): string {
  return startOfWeekISODate(date)
}

function maxISODate(a: string, b: string): string {
  return a > b ? a : b
}

function createdDate(char: Character): string {
  const created = char.createdAt ? new Date(char.createdAt) : new Date()
  if (Number.isNaN(created.getTime())) return todayISO()
  return dateToISO(created)
}

function appendEventLog(
  char: Character,
  entry: Omit<CharacterEventLogEntry, 'id'>
): Character {
  const id = `${entry.date}-${entry.type}-${Math.random().toString(36).slice(2, 8)}`
  return {
    ...char,
    eventLog: [
      { id, ...entry },
      ...(char.eventLog ?? []),
    ].slice(0, 120),
  }
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

export const DAILY_MISSION_XP = 5

export interface DailyMissionDefinition {
  id: DailyMissionId
  title: string
  description: string
  actionLabel: string
  target: 'ritual' | 'checkin' | 'battle' | 'inventory' | 'shop'
}

export interface DailyMissionView extends DailyMissionDefinition {
  completed: boolean
  xp: number
}

const DAILY_MISSION_POOL: DailyMissionDefinition[] = [
  {
    id: 'ritual_register',
    title: 'Selar o Livro de Gastos',
    description: 'Faça o Ritual de Registro de hoje.',
    actionLabel: 'Registrar agora',
    target: 'ritual',
  },
  {
    id: 'battle',
    title: 'Enfrentar um Cobrador',
    description: 'Lute uma batalha na Arena da Masmorra.',
    actionLabel: 'Ir para batalha',
    target: 'battle',
  },
  {
    id: 'checkin',
    title: 'Fazer a Ronda do Tesouro',
    description: 'Conclua uma Ronda do Tesouro.',
    actionLabel: 'Abrir ronda',
    target: 'checkin',
  },
  {
    id: 'inspect_inventory',
    title: 'Conferir a Mochila',
    description: 'Abra o inventário e revise seus itens.',
    actionLabel: 'Ver inventário',
    target: 'inventory',
  },
  {
    id: 'buy_shop',
    title: 'Negociar no Mercado Sombrio',
    description: 'Compre uma poção ou aprimore um equipamento na loja.',
    actionLabel: 'Abrir loja',
    target: 'shop',
  },
]

function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function dailyMissionIds(char: Character, date = todayISO()): DailyMissionId[] {
  return [...DAILY_MISSION_POOL]
    .sort((a, b) => hashSeed(`${char.id}-${date}-${a.id}`) - hashSeed(`${char.id}-${date}-${b.id}`))
    .slice(0, 2)
    .map(mission => mission.id)
}

export function ensureDailyMissions(char: Character, date = todayISO()): Character {
  const current = normalizeCharacter(char)
  if (current.dailyMissions?.date === date && current.dailyMissions.missionIds.length === 2) {
    return current
  }
  return {
    ...current,
    dailyMissions: {
      date,
      missionIds: dailyMissionIds(current, date),
      completedIds: [],
    },
  }
}

function missionDefinition(id: DailyMissionId): DailyMissionDefinition {
  return DAILY_MISSION_POOL.find(mission => mission.id === id) ?? DAILY_MISSION_POOL[0]
}

function actionAlreadyDone(char: Character, id: DailyMissionId, date: string): boolean {
  if (id === 'ritual_register') {
    return char.dailyRecords.some(record => record.date === date && record.registered)
  }
  if (id === 'battle') return (char.battleLog ?? []).some(log => log.date === date && log.count > 0)
  if (id === 'checkin') return char.lastCheckinAt ? dateOnly(new Date(char.lastCheckinAt)) === date : false
  return false
}

export function getDailyMissions(char: Character, date = todayISO()): { date: string; missions: DailyMissionView[]; allDone: boolean } {
  const current = ensureDailyMissions(char, date)
  const progress = current.dailyMissions!
  const completedIds = new Set(progress.completedIds)
  const missions = progress.missionIds.map(id => ({
    ...missionDefinition(id),
    completed: completedIds.has(id) || actionAlreadyDone(current, id, date),
    xp: DAILY_MISSION_XP,
  }))
  return {
    date,
    missions,
    allDone: missions.every(mission => mission.completed),
  }
}

export function completeDailyMission(char: Character, missionId: DailyMissionId, date = todayISO()): { character: Character; awardedXP: number; message?: string } {
  let current = ensureDailyMissions(char, date)
  const progress = current.dailyMissions!
  if (!progress.missionIds.includes(missionId)) {
    return { character: current, awardedXP: 0 }
  }
  if (progress.completedIds.includes(missionId)) {
    return { character: current, awardedXP: 0 }
  }

  current = {
    ...current,
    dailyMissions: {
      ...progress,
      completedIds: [...progress.completedIds, missionId],
    },
  }
  current = applyLevelUp(current, DAILY_MISSION_XP)

  return {
    character: current,
    awardedXP: DAILY_MISSION_XP,
    message: `Missão diária concluída: ${missionDefinition(missionId).title}. +${DAILY_MISSION_XP} XP.`,
  }
}

const WEEKLY_CONTRACT_POOL: WeeklyContractDefinition[] = [
  {
    id: 'weekly_records_5',
    title: 'Escriba dos Cinco Selos',
    description: 'Faça 5 Rituais de Registro nesta semana.',
    target: 5,
    xpReward: 35,
    actionTarget: 'ritual',
  },
  {
    id: 'weekly_battles_2',
    title: 'Patrulha contra Cobradores',
    description: 'Lute 2 batalhas nesta semana.',
    target: 2,
    xpReward: 30,
    actionTarget: 'battle',
  },
  {
    id: 'weekly_under_quota_3',
    title: 'Guardião da Cota Semanal',
    description: 'Registre 3 dias abaixo da Cota de Jornada.',
    target: 3,
    xpReward: 40,
    actionTarget: 'ritual',
  },
  {
    id: 'weekly_inventory',
    title: 'Intendente da Mochila',
    description: 'Tenha ao menos 1 item consumível guardado.',
    target: 1,
    xpReward: 25,
    actionTarget: 'inventory',
  },
  {
    id: 'weekly_explore_progress',
    title: 'Batedor do Reino',
    description: 'Inicie ou avance uma exploração esta semana.',
    target: 1,
    xpReward: 35,
    actionTarget: 'explore',
  },
]

const TITLES: TitleDefinition[] = [
  { id: 'guardiao_da_cota', name: 'Guardião da Cota', description: 'Mantenha o ciclo em até 80% do Tesouro Máximo.' },
  { id: 'cartografo_do_saldo', name: 'Cartógrafo do Saldo', description: 'Explore 3 locais do reino.' },
  { id: 'campeao_da_arena', name: 'Campeão da Arena', description: 'Use as 3 batalhas diárias pelo menos uma vez.' },
  { id: 'arquivista_do_livro', name: 'Arquivista do Livro', description: 'Faça 7 registros no ciclo atual.' },
  { id: 'sobrevivente_do_tombo', name: 'Sobrevivente do Tombo', description: 'Tenha sobrevivido a pelo menos uma morte e continuado a jornada.' },
  { id: 'mestre_dos_contratos', name: 'Mestre dos Contratos', description: 'Conclua todos os contratos diários de hoje.' },
]

function weeklyContractIds(char: Character, weekKey = startOfWeekISO()): WeeklyContractId[] {
  return [...WEEKLY_CONTRACT_POOL]
    .sort((a, b) => hashSeed(`${char.id}-${weekKey}-${a.id}`) - hashSeed(`${char.id}-${weekKey}-${b.id}`))
    .slice(0, 3)
    .map(contract => contract.id)
}

export function ensureWeeklyContracts(char: Character, weekKey = startOfWeekISO()): Character {
  const current = normalizeCharacter(char)
  if (current.weeklyContracts?.weekKey === weekKey && current.weeklyContracts.contractIds.length === 3) return current
  return {
    ...current,
    weeklyContracts: {
      weekKey,
      contractIds: weeklyContractIds(current, weekKey),
      claimedIds: [],
    },
  }
}

function contractDefinition(id: WeeklyContractId): WeeklyContractDefinition {
  return WEEKLY_CONTRACT_POOL.find(contract => contract.id === id) ?? WEEKLY_CONTRACT_POOL[0]
}

function recordsThisWeek(char: Character, weekKey: string): typeof char.dailyRecords {
  const weekEnd = addDays(weekKey, 6)
  return char.dailyRecords.filter(record => record.date >= weekKey && record.date <= weekEnd && record.registered)
}

function weeklyContractProgress(char: Character, id: WeeklyContractId, weekKey: string): number {
  const records = recordsThisWeek(char, weekKey)
  if (id === 'weekly_records_5') return records.length
  if (id === 'weekly_battles_2') {
    const weekEnd = addDays(weekKey, 6)
    return (char.battleLog ?? []).filter(log => log.date >= weekKey && log.date <= weekEnd).reduce((sum, log) => sum + log.count, 0)
  }
  if (id === 'weekly_under_quota_3') {
    const quota = calcDaysInCycle(char.cycleStart, char.cycleEnd) > 0
      ? (char.maxTreasure - char.journeyMarker) / calcDaysInCycle(char.cycleStart, char.cycleEnd)
      : 0
    return records.filter(record => quota > 0 && record.amount < quota).length
  }
  if (id === 'weekly_inventory') return (char.inventory ?? []).some(item => item.quantity > 0) ? 1 : 0
  if (id === 'weekly_explore_progress') {
    const journey = char.exploration?.activeJourney
    return journey && dateOnly(new Date(journey.startedAt)) >= weekKey ? 1 : 0
  }
  return 0
}

export function getWeeklyContracts(char: Character, weekKey = startOfWeekISO()): { weekKey: string; contracts: WeeklyContractView[]; allDone: boolean } {
  const current = ensureWeeklyContracts(char, weekKey)
  const progress = current.weeklyContracts!
  const claimed = new Set(progress.claimedIds)
  const contracts = progress.contractIds.map(id => {
    const def = contractDefinition(id)
    const value = weeklyContractProgress(current, id, weekKey)
    return {
      ...def,
      progress: Math.min(def.target, value),
      completed: value >= def.target,
      claimed: claimed.has(id),
    }
  })
  return { weekKey, contracts, allDone: contracts.every(contract => contract.completed) }
}

export function claimWeeklyContract(char: Character, contractId: WeeklyContractId, weekKey = startOfWeekISO()): { character: Character; ok: boolean; message: string } {
  let current = ensureWeeklyContracts(char, weekKey)
  const state = current.weeklyContracts!
  const contract = getWeeklyContracts(current, weekKey).contracts.find(item => item.id === contractId)
  if (!contract) return { character: current, ok: false, message: 'Contrato semanal indisponível.' }
  if (!contract.completed) return { character: current, ok: false, message: 'Contrato semanal ainda não foi concluído.' }
  if (contract.claimed) return { character: current, ok: false, message: 'Recompensa já foi resgatada.' }

  current = applyLevelUp({
    ...current,
    weeklyContracts: {
      ...state,
      claimedIds: [...state.claimedIds, contractId],
    },
    streakWards: (current.streakWards ?? 0) + (contractId === 'weekly_records_5' ? 1 : 0),
  }, contract.xpReward)

  const wardText = contractId === 'weekly_records_5' ? ' Você também ganhou 1 Selo de Continuidade.' : ''
  return {
    character: appendEventLog(current, {
      type: 'system',
      date: new Date().toISOString(),
      message: `Contrato semanal concluído: ${contract.title}. +${contract.xpReward} XP.${wardText}`,
    }),
    ok: true,
    message: `Contrato resgatado: ${contract.title}. +${contract.xpReward} XP.${wardText}`,
  }
}

export function getCycleGoals(char: Character): CycleGoalView[] {
  const current = normalizeCharacter(char)
  const daysTotal = calcDaysInCycle(current.cycleStart, current.cycleEnd)
  const totalSpent = calcOuroConsumido(current)
  const preserved = Math.max(0, current.maxTreasure - totalSpent)
  const quota = current.maxTreasure * 0.8
  return [
    {
      id: 'stay_under_80',
      title: 'Muralha dos 80%',
      description: 'Mantenha o Ouro Consumido em até 80% do Tesouro Máximo.',
      progress: Math.min(quota, totalSpent),
      target: quota,
      completed: totalSpent <= quota,
      reward: 'Melhor chance de vitória épica no Boss Final',
    },
    {
      id: 'register_7_days',
      title: 'Sete Selos do Livro',
      description: 'Faça pelo menos 7 registros neste ciclo.',
      progress: current.dailyRecords.filter(record => record.registered).length,
      target: Math.min(7, daysTotal),
      completed: current.dailyRecords.filter(record => record.registered).length >= Math.min(7, daysTotal),
      reward: 'Desbloqueia título de consistência',
    },
    {
      id: 'keep_life_safe',
      title: 'Chama Acima da Metade',
      description: 'Mantenha a vida acima de 50% para batalhar com segurança.',
      progress: current.life,
      target: Math.ceil(current.maxLife / 2),
      completed: current.life >= Math.ceil(current.maxLife / 2),
      reward: 'Menos risco em batalhas e esquecimentos',
    },
    {
      id: 'win_3_battles',
      title: 'Três Cobranças Vencidas',
      description: 'Realize 3 batalhas no ciclo atual.',
      progress: (current.battleLog ?? []).reduce((sum, log) => sum + log.count, 0),
      target: 3,
      completed: (current.battleLog ?? []).reduce((sum, log) => sum + log.count, 0) >= 3,
      reward: 'Desbloqueia título de arena',
    },
    {
      id: 'preserve_gold',
      title: 'Baú Ainda Respira',
      description: 'Termine o ciclo com algum Ouro Preservado.',
      progress: preserved,
      target: Math.max(1, current.maxTreasure * 0.05),
      completed: preserved > 0,
      reward: 'Ouro preservado vai para o Baú no Boss Final',
    },
  ]
}

export function getTitleViews(char: Character): TitleView[] {
  const current = normalizeCharacter(char)
  const totalSpent = calcOuroConsumido(current)
  const explored = current.exploration?.completedLocationIds?.filter(id => id !== CASTLE_LOCATION_ID).length ?? 0
  const dailyMissions = getDailyMissions(current)
  const battles = battlesToday(current)
  const records = current.dailyRecords.filter(record => record.registered).length
  const unlocked: Record<TitleId, boolean> = {
    guardiao_da_cota: current.maxTreasure > 0 && totalSpent <= current.maxTreasure * 0.8,
    cartografo_do_saldo: explored >= 3,
    campeao_da_arena: battles >= 3,
    arquivista_do_livro: records >= 7,
    sobrevivente_do_tombo: (current.deathCount ?? 0) > 0,
    mestre_dos_contratos: dailyMissions.allDone,
  }
  return TITLES.map(title => ({
    ...title,
    unlocked: unlocked[title.id],
    equipped: current.equippedTitleId === title.id,
  }))
}

export function equipTitle(char: Character, titleId: TitleId): { character: Character; ok: boolean; message: string } {
  const title = getTitleViews(char).find(item => item.id === titleId)
  if (!title) return { character: char, ok: false, message: 'Título inexistente.' }
  if (!title.unlocked) return { character: char, ok: false, message: 'Esse título ainda está bloqueado.' }
  return {
    character: { ...normalizeCharacter(char), equippedTitleId: titleId },
    ok: true,
    message: `Título equipado: ${title.name}.`,
  }
}

export function getConsistencyCalendar(char: Character): CalendarDayView[] {
  const current = normalizeCharacter(char)
  const today = todayISO()
  const records = new Map(current.dailyRecords.map(record => [record.date, record]))
  return daysBetween(current.cycleStart, current.cycleEnd).map(date => {
    const record = records.get(date)
    const day = new Date(`${date}T12:00:00`).getDate()
    if (date > today) return { date, day, status: 'future' }
    if (record?.registered) return { date, day, status: 'registered', amount: record.amount }
    if (date === today) return { date, day, status: 'today' }
    return { date, day, status: 'missed' }
  })
}

export function getNextActions(char: Character, now = new Date()): ActionHint[] {
  const current = normalizeCharacter(char)
  const today = todayISO()
  const registeredToday = current.dailyRecords.some(record => record.date === today && record.registered)
  const actions: ActionHint[] = []
  const lifePct = current.maxLife > 0 ? current.life / current.maxLife : 1
  const spentPct = current.maxTreasure > 0 ? calcOuroConsumido(current) / current.maxTreasure : 0
  const daily = getDailyMissions(current)
  const weekly = getWeeklyContracts(current)

  if (lifePct <= 0.35) actions.push({ id: 'life-low', title: 'Vida em risco', description: 'Use uma poção ou registre hoje antes de entrar em batalha.', target: current.inventory.length > 0 ? 'inventory' : 'ritual', priority: 'danger' })
  if (spentPct >= 0.9) actions.push({ id: 'budget-high', title: 'Tesouro quase no limite', description: 'Revise o ciclo antes de novos gastos.', target: 'history', priority: 'warning' })
  if (!registeredToday) actions.push({ id: 'register', title: 'Realizar Ritual de Registro', description: 'O registro de hoje ainda não foi feito.', target: 'ritual', priority: 'good' })
  if (!daily.allDone) actions.push({ id: 'daily', title: 'Concluir contratos diários', description: `${daily.missions.filter(m => m.completed).length}/2 contratos concluídos hoje.`, target: 'realm', priority: 'neutral' })
  if (canCheckin(current, now)) actions.push({ id: 'checkin', title: 'Ronda do Tesouro pronta', description: 'A ronda pode render XP, ouro ou poções.', target: 'checkin', priority: 'good' })
  if (current.exploration.activeJourney && explorationProgress(current, now).readyToComplete) actions.push({ id: 'explore-complete', title: 'Exploração pronta', description: 'A caravana chegou ao destino. Resgate a recompensa.', target: 'explore', priority: 'good' })
  if (weekly.contracts.some(contract => contract.completed && !contract.claimed)) actions.push({ id: 'weekly-claim', title: 'Contrato semanal para resgatar', description: 'Há recompensa semanal esperando na guilda.', target: 'realm', priority: 'good' })
  if (current.attributePoints > 0) actions.push({ id: 'attributes', title: 'Distribuir atributos', description: `${current.attributePoints} ponto(s) disponíveis.`, target: 'attributes', priority: 'neutral' })
  if (actions.length === 0) actions.push({ id: 'ok', title: 'Reino em ordem', description: 'Nada urgente agora. Você pode explorar, batalhar ou revisar o histórico.', target: 'explore', priority: 'neutral' })
  return actions.slice(0, 4)
}

export function getCodexEntries(char: Character): CodexEntry[] {
  const current = normalizeCharacter(char)
  const explored = new Set(current.exploration.completedLocationIds ?? [])
  const battleCount = (current.battleLog ?? []).reduce((sum, log) => sum + log.count, 0)
  const titleViews = getTitleViews(current)
  const equipmentEntries = (Object.keys(EQUIPMENT_SLOTS) as EquipmentSlot[]).map(slot => {
    const level = current.equipmentLevels?.[slot] ?? 0
    return {
      id: `equip-${slot}`,
      name: slot === 'weapon' ? weaponNameForClass(current.class) : EQUIPMENT_SLOTS[slot].baseName,
      description: level > 0 ? `Encontrado ou aprimorado até o nível ${level}.` : 'Ainda não encontrado na jornada.',
      unlocked: level > 0,
      kind: 'item' as const,
    }
  })
  return [
    ...EXPLORATION_LOCATIONS.filter(location => location.id !== CASTLE_LOCATION_ID).map(location => ({
      id: `loc-${location.id}`,
      name: location.name,
      description: explored.has(location.id) ? location.description : `Requer nível ${location.minLevel}.`,
      unlocked: explored.has(location.id),
      kind: 'local' as const,
    })),
    {
      id: 'monster-cobrador',
      name: 'Cobrador da Masmorra',
      description: battleCount > 0 ? `${battleCount} encontro(s) registrados na arena.` : 'Enfrente uma batalha para catalogar este inimigo.',
      unlocked: battleCount > 0,
      kind: 'monstro' as const,
    },
    ...equipmentEntries,
    ...titleViews.map(title => ({
      id: `title-${title.id}`,
      name: title.name,
      description: title.description,
      unlocked: title.unlocked,
      kind: 'titulo' as const,
    })),
  ]
}

export function getFinancialEvents(char: Character): FinancialEventView[] {
  const current = normalizeCharacter(char)
  const today = todayISO()
  const daysLeft = Math.max(0, Math.round((new Date(current.cycleEnd).getTime() - new Date(today).getTime()) / (24 * 60 * 60 * 1000)))
  const spentPct = current.maxTreasure > 0 ? calcOuroConsumido(current) / current.maxTreasure : 0
  const events: FinancialEventView[] = []
  events.push({
    id: 'boss',
    title: daysLeft <= 3 ? 'Boss Final se aproxima' : 'Boss Final do ciclo',
    description: `${daysLeft} dia(s) até o fechamento do ciclo.`,
    date: current.cycleEnd,
    severity: daysLeft <= 3 ? 'warning' : 'neutral',
  })
  if (spentPct >= 0.8) {
    events.push({
      id: 'treasure-alert',
      title: spentPct >= 1 ? 'Tesouro ultrapassado' : 'Tesouro em zona perigosa',
      description: `${Math.round(spentPct * 100)}% do Tesouro Máximo já foi consumido.`,
      date: today,
      severity: spentPct >= 1 ? 'danger' : 'warning',
    })
  }
  if (current.lastCheckinAt) {
    const next = nextCheckinAt(current)
    if (next) {
      events.push({
        id: 'next-checkin',
        title: 'Próxima Ronda do Tesouro',
        description: 'Volte para uma recompensa rápida e manutenção do hábito.',
        date: dateToISO(next),
        severity: canCheckin(current) ? 'good' : 'neutral',
      })
    }
  }
  return events
}

export function calcBossRisk(char: Character): {
  overLimit: number
  damageTaken: number
  survives: boolean
  advice: string
} {
  const current = normalizeCharacter(char)
  const totalSpent = calcOuroConsumido(current)
  const overLimit = Math.max(0, totalSpent - current.maxTreasure)
  if (overLimit <= 0) {
    return {
      overLimit: 0,
      damageTaken: 0,
      survives: true,
      advice: 'Você ainda está dentro do limite. Seguir abaixo do alvo hoje ajuda a ampliar a folga até o Boss Final.',
    }
  }

  const lifePressure = current.maxTreasure > 0 ? overLimit / current.maxTreasure : 1
  const baseDamage = Math.max(1, Math.round(current.maxLife * (0.25 + lifePressure * 1.35)))
  const damageTaken = Math.min(current.maxLife, baseDamage)
  const survives = current.life > damageTaken

  let advice = 'Se quiser sobreviver, reduza gastos agora, prefira o próximo registro abaixo da cota e considere usar poção antes do fechamento.'
  if (!survives) {
    advice = 'Do jeito que está, o Boss Final derruba o personagem. A saída mais segura é cortar gastos imediatos, registrar abaixo da cota hoje e recuperar vida antes do fechamento.'
  } else if (damageTaken > current.life * 0.6) {
    advice = 'Você ainda sobrevive, mas por pouco. Vale segurar gastos hoje e entrar no Boss Final com mais vida ou com poção pronta.'
  }

  return { overLimit, damageTaken, survives, advice }
}

function handleDeath(char: Character): Character {
  const classDef = CLASSES.find(c => c.id === char.class)!
  const attrs = { ...classDef.startingAttributes }
  const maxLife = calcMaxLife(1, attrs, classDef)
  const goldChest = char.goldChest ?? 0
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
    bestCombo: 0,
    specialUsed: false,
    lastBreathUsed: false,
    sealUsed: false,
    masterStrikeUsedThisWeek: false,
    inventory: [],
    equipmentLevels: { ...DEFAULT_EQUIPMENT_LEVELS },
    battleLog: [],
    dailyMissions: undefined,
    weeklyContracts: undefined,
    lastCheckinAt: undefined,
    exploration: {
      currentLocationId: CASTLE_LOCATION_ID,
      completedLocationIds: [],
    },
    deathCount: (char.deathCount ?? 0) + 1,
    goldChest,
    lastBreathRecoveryDays: 0,
    streakWards: 0,
    streakWardUsedThisCycle: false,
  }
}

function applyMissedDay(char: Character): { character: Character; event: GameEvent } {
  if ((char.streakWards ?? 0) > 0 && !char.streakWardUsedThisCycle) {
    const updated = {
      ...char,
      streakWards: Math.max(0, (char.streakWards ?? 0) - 1),
      streakWardUsedThisCycle: true,
    }
    return {
      character: updated,
      event: {
        type: 'system',
        characterId: char.id,
        characterName: char.name,
        message: `Um Selo de Continuidade protegeu ${char.name}: sem dano e sem quebra de combo pelo esquecimento.`,
        damage: 0,
      },
    }
  }

  const classDef = CLASSES.find(c => c.id === char.class)!
  const { min, max } = calcDamage(char.level, calcEffectiveAttributes(char))
  let damage = randomDamage(min, max)
  damage = Math.round(damage * classDef.damageMod)

  let newLife = char.life - damage
  let updated = { ...char, combo: 0, life: Math.max(0, newLife) }
  let eventType: GameEvent['type'] = 'missed_day'
  let message = `Maldição do Esquecimento causou ${damage} de dano em ${char.name}.`

  if (newLife <= 0) {
    updated = handleDeath(updated)
    eventType = 'death'
    message = `${char.name} caiu pela Maldição do Esquecimento. Voltou ao nível 1; itens e equipamentos foram perdidos, mas o Baú foi preservado.`
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
    const firstTrackableDate = maxISODate(char.cycleStart, createdDate(char))
    const startFrom = maxISODate(
      char.lastProcessedDate ? addDays(char.lastProcessedDate, 1) : firstTrackableDate,
      firstTrackableDate
    )

    if (startFrom > processUntil) return char

    let current = { ...char }

    for (const day of daysBetween(startFrom, processUntil)) {
      const hasRecord = current.dailyRecords.some(r => r.date === day && r.registered)
      if (!hasRecord) {
        const result = applyMissedDay(current)
        current = appendEventLog(result.character, {
          type: result.event.type === 'missed_day' ? 'missed_day' : result.event.type,
          date: `${day}T12:00:00.000Z`,
          message: result.event.message,
          damage: result.event.damage,
          lifeAfter: result.character.life,
        })
        events.push(result.event)
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
  const nextMaxTreasure = char.nextCycleMaxTreasure ?? params.maxTreasure

  return applyLevelUp({
    ...updated,
    cycleStart: params.cycleStart,
    cycleEnd: params.cycleEnd,
    maxTreasure: nextMaxTreasure,
    nextCycleMaxTreasure: undefined,
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
    dailyMissions: undefined,
    weeklyContracts: undefined,
    streakWardUsedThisCycle: false,
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
  xpBreakdown?: XPBreakdownLine[]
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

interface BattleMonsterDefinition {
  id: string
  name: string
  minLevel: number
  weight: number
  hpMult: number
  powerMult: number
  xpBonus: number
  goldBonus: number
  missMod: number
  critMod: number
}

const BATTLE_MONSTERS: BattleMonsterDefinition[] = [
  {
    id: 'cobrador',
    name: 'Cobrador da Masmorra',
    minLevel: 1,
    weight: 5,
    hpMult: 1,
    powerMult: 1,
    xpBonus: 0,
    goldBonus: 0,
    missMod: 0,
    critMod: 0,
  },
  {
    id: 'fatura_viva',
    name: 'Fatura Viva',
    minLevel: 2,
    weight: 4,
    hpMult: 1.12,
    powerMult: 1.08,
    xpBonus: 4,
    goldBonus: 4,
    missMod: -0.02,
    critMod: 0.01,
  },
  {
    id: 'agente_dos_juros',
    name: 'Agente dos Juros',
    minLevel: 4,
    weight: 3,
    hpMult: 1.28,
    powerMult: 1.22,
    xpBonus: 8,
    goldBonus: 8,
    missMod: -0.04,
    critMod: 0.025,
  },
  {
    id: 'devorador_de_limite',
    name: 'Devorador de Limite',
    minLevel: 6,
    weight: 2,
    hpMult: 1.45,
    powerMult: 1.36,
    xpBonus: 14,
    goldBonus: 14,
    missMod: -0.06,
    critMod: 0.04,
  },
]

function chooseBattleMonster(char: Character, battleNumber: number): BattleMonsterDefinition {
  const available = BATTLE_MONSTERS.filter(monster => char.level >= monster.minLevel)
  const weighted = available.flatMap(monster => Array.from({ length: monster.weight + battleNumber }, () => monster))
  return weighted[Math.floor(Math.random() * weighted.length)] ?? BATTLE_MONSTERS[0]
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
  const raw = 4 + Math.ceil(current.level * 0.8) + battlesToday(current) * 2
  const reduced = Math.round(raw * (1 - Math.min(0.35, attrs.resiliencia * 0.025)) * classDef.damageMod)
  return Math.max(1, reduced)
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
  return dateToISO(date)
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
  const levelXP = current.level * 5
  const sabedoriaXP = Math.round(attrs.sabedoria * 1.5)
  const xpGained = Math.round(location.xpBase + levelXP + sabedoriaXP)
  const xpBreakdown: XPBreakdownLine[] = [
    { label: 'XP do local', value: location.xpBase, detail: location.name, kind: 'base' },
    { label: 'Bônus de nível', value: levelXP, detail: `Nível ${current.level} x 5`, kind: 'level' },
  ]
  if (sabedoriaXP > 0) {
    xpBreakdown.push({ label: 'Bônus de Sabedoria', value: sabedoriaXP, detail: `${attrs.sabedoria} Sabedoria`, kind: 'attribute' })
  }
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
          xpBreakdown,
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
        xpBreakdown,
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
      xpBreakdown,
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
    const baseXP = 10
    const levelXP = current.level * 3
    const sabedoriaXP = Math.round(attrs.sabedoria * 1.4)
    const xpGained = Math.round(baseXP + levelXP + sabedoriaXP)
    const xpBreakdown: XPBreakdownLine[] = [
      { label: 'XP da Ronda', value: baseXP, kind: 'base' },
      { label: 'Bônus de nível', value: levelXP, detail: `Nível ${current.level} x 3`, kind: 'level' },
    ]
    if (sabedoriaXP > 0) {
      xpBreakdown.push({ label: 'Bônus de Sabedoria', value: sabedoriaXP, detail: `${attrs.sabedoria} Sabedoria`, kind: 'attribute' })
    }
    current = applyLevelUp(current, xpGained)
    reward = {
      type: 'xp',
      label: `+${xpGained} XP`,
      imageSrc: XP_REWARD_IMAGE_SRC,
      xpGained,
      xpBreakdown,
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
  const battleNumber = battlesToday(current)
  const monster = chooseBattleMonster(current, battleNumber)
  const monsterName = monster.name
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
    current.level * 4.2 +
    attrs.vigor * 1.05 +
    attrs.sabedoria * 1.05 +
    attrs.disciplina * 1.2 +
    attrs.prosperidade * 0.9 +
    attrs.resiliencia * 0.65
  const enemyPower = (12 + current.level * 4.4 + battleNumber * 4.5) * monster.powerMult
  const playerBattleHpStart = Math.max(12, current.life + current.level * 2 + attrs.vigor * 1.5)
  const monsterHpStart = Math.round((20 + current.level * 7 + battleNumber * 7) * monster.hpMult)
  const defeatDamage = maxBattleDamageOnDefeat(current)
  let playerHp = playerBattleHpStart
  let monsterHp = monsterHpStart
  const rounds: BattleRound[] = []

  for (let turn = 1; turn <= 16 && playerHp > 0 && monsterHp > 0; turn += 1) {
    const playerMissChance = Math.max(0.08, 0.2 - attrs.disciplina * 0.01)
    const playerCritChance = Math.min(0.28, 0.08 + attrs.sabedoria * 0.012 + attrs.prosperidade * 0.006)
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
      const baseDamage = Math.max(3, Math.round(attack / 5.2 + Math.random() * (4 + current.level * 0.8)))
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

    const monsterMissChance = Math.max(0.04, Math.min(0.3, 0.13 + attrs.resiliencia * 0.01 + monster.missMod))
    const monsterCritChance = Math.max(0.04, 0.12 - attrs.resiliencia * 0.005 + monster.critMod)
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
      const baseDamage = Math.max(2, Math.round(enemyPower / 8.5 + Math.random() * (3 + battleNumber)))
      const damage = critical ? Math.round(baseDamage * 1.6) : baseDamage
      playerHp = Math.max(0, playerHp - damage)
      rounds.push({
        turn,
        actor: 'monster',
        result: critical ? 'critical' : 'hit',
        damage,
        playerHp,
        monsterHp,
        text: critical
          ? `${monsterName} acertou um crítico e drenou ${damage} de vida de batalha.`
          : `${monsterName} contra-atacou e causou ${damage} de dano na vida de batalha.`,
      })
    }
  }

  const won = monsterHp <= 0

  current = incrementBattleCount(current)

  if (won) {
    const baseXP = 18 + monster.xpBonus
    const levelXP = current.level * 4
    const sabedoriaXP = Math.round(attrs.sabedoria * 1.5)
    const xpGained = Math.round(baseXP + levelXP + sabedoriaXP)
    const xpBreakdown: XPBreakdownLine[] = [
      { label: 'XP da vitória', value: baseXP, kind: 'base' },
      { label: 'Bônus de nível', value: levelXP, detail: `Nível ${current.level} x 4`, kind: 'level' },
    ]
    if (sabedoriaXP > 0) {
      xpBreakdown.push({ label: 'Bônus de Sabedoria', value: sabedoriaXP, detail: `${attrs.sabedoria} Sabedoria`, kind: 'attribute' })
    }
    let goldGained = 0
    let itemGained: ConsumableItemId | undefined
    const lootRoll = Math.random()

    if (lootRoll > 0.72) {
      goldGained = Math.round(12 + current.level * 4 + attrs.prosperidade * 3 + monster.goldBonus)
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
      xpBreakdown,
      itemGained,
    }
  }

  const reduced = defeatDamage
  const lossXp = Math.max(3, Math.round(current.level * 1.5))
  const lossXpBreakdown: XPBreakdownLine[] = [
    { label: 'XP de sobrevivência', value: lossXp, detail: `Baseado no nível ${current.level}`, kind: 'level' },
  ]
  const lifeAfterDamage = current.life - reduced
  current = applyLevelUp({
    ...current,
    life: Math.max(0, lifeAfterDamage),
  }, lossXp)
  if (lifeAfterDamage <= 0) {
    current = appendEventLog(handleDeath(current), {
      type: 'death',
      date: new Date().toISOString(),
      message: `${char.name} caiu em batalha contra ${monsterName}. Voltou ao nível 1; itens e equipamentos foram perdidos, mas o Baú foi preservado.`,
      damage: reduced,
      lifeAfter: 0,
    })
  } else if (reduced > 0) {
    current = appendEventLog(current, {
      type: 'damage',
      date: new Date().toISOString(),
      message: `${current.name} sofreu ${reduced} de dano real ao perder uma batalha contra ${monsterName}.`,
      damage: reduced,
      lifeAfter: current.life,
    })
  }

  return {
    character: current,
    won,
    message: lifeAfterDamage <= 0
      ? `${char.name} caiu em batalha contra ${monsterName}.`
      : `${current.name} perdeu a batalha e recuou antes de cair.`,
    xpGained: lossXp,
    damageTaken: reduced,
    goldGained: 0,
    monsterName,
    playerBattleHpStart,
    playerBattleHpEnd: playerHp,
    monsterHpStart,
    monsterHpEnd: monsterHp,
    rounds,
    xpBreakdown: lossXpBreakdown,
    died: lifeAfterDamage <= 0,
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
