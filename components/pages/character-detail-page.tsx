'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BookOpen, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, Crown, Home, Lock, MapPin, Pencil, Search, ScrollText, ShieldCheck, Sparkles, Target, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  type Character,
  type CheckinReward,
  type CharacterEventLogType,
  type ConsumableItemId,
  type DailyMissionId,
  type EquipmentSlot,
  type ExplorationLocationId,
  type ExplorationReward,
  type TitleId,
  type WeeklyContractId,
  type XPBreakdownLine,
  CLASSES,
  CONSUMABLE_ITEMS,
  EQUIPMENT_SLOTS,
  EXPLORATION_LOCATIONS,
  CASTLE_LOCATION_ID,
  GOLD_REWARD_IMAGE_SRC,
  XP_REWARD_IMAGE_SRC,
  KINGDOM_MAP_IMAGE_SRC,
  ATTRIBUTE_DEFINITIONS,
  type Attributes,
  calcOuroConsumido,
  calcJourneyQuota,
  calcDaysInCycle,
  calcDaysLeft,
  calcMaxLife,
  calcEffectiveAttributes,
  calcEquipmentAttributes,
  equipmentBonusValue,
  equipmentPrice,
  weaponNameForClass,
  weaponImageForClass,
  xpForLevel,
  levelTitle,
  classImageForLevel,
  nextClassImageStage,
} from '@/lib/types'
import { dateToISO } from '@/lib/date'
import {
  type ActiveBattleState,
  type BattleQuizDifficulty,
  type BattleQuizQuestion,
  type BattleResult,
  type CheckinResult,
  CHECKIN_ACTION_NAME,
  CHECKIN_COOLDOWN_HOURS,
  answerKnowledgeBlock,
  answerBattleQuiz,
  completeDailyMission,
  battlesToday,
  buyConsumable,
  buyEquipmentUpgrade,
  canCheckin,
  canExploreLocation,
  checkinTimeRemaining,
  claimWeeklyContract,
  completeExplorationStep,
  equipTitle,
  getCodexEntries,
  getConsistencyCalendar,
  getCycleGoals,
  calcBossRisk,
  getDailyMissions,
  getBattleCharges,
  getFinancialEvents,
  getNextActions,
  getTitleViews,
  getWeeklyContracts,
  explorationProgress,
  maxBattleDamageOnDefeat,
  drawBattleQuizQuestion,
  markBattleBossOffered,
  performBattleTurn,
  performCheckin,
  shouldOfferBattleBoss,
  startInteractiveBattle,
  startExploration,
  syncExplorationConsistency,
  updateJourneyMarker,
  useConsumable,
} from '@/lib/game-engine'

interface CharacterDetailPageProps {
  character: Character
  onBack: () => void
  onUpdateCharacter: (updated: Character, options?: { deferLevelUp?: boolean }) => void
  onFlushPendingLevelUp: () => void
  onRenameCharacter: () => void
  onDeleteCharacter: () => void
  onOpenRitual: () => void
}

// ─── Tooltip component ───────────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block ml-1 align-middle">
      <button
        onClick={() => setOpen(!open)}
        className="w-4 h-4 rounded-full bg-muted border border-border text-muted-foreground text-xs font-bold leading-none flex items-center justify-center hover:bg-primary/10"
        aria-label="Mais informações"
      >
        ?
      </button>
      {open && (
        <div className="absolute z-10 left-1/2 -translate-x-1/2 bottom-6 w-56 dungeon-panel bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground shadow-lg">
          {text}
          <button onClick={() => setOpen(false)} className="block mt-2 text-primary font-semibold">Fechar</button>
        </div>
      )}
    </span>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'disponível agora'
  const totalMinutes = Math.ceil(ms / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes} min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

function rewardTitle(reward: CheckinReward): string {
  if (reward.type === 'xp') return 'Conhecimento encontrado'
  if (reward.type === 'gold') return 'Ouro para o Baú'
  return 'Item encontrado'
}

function explorationRewardTitle(reward: ExplorationReward): string {
  if (reward.type === 'equipment') return 'Equipamento encontrado'
  if (reward.type === 'consumable') return 'Item encontrado'
  if (reward.type === 'gold') return 'Ouro recuperado'
  return 'Conhecimento encontrado'
}

function eventLogLabel(type: string): string {
  const labels: Record<string, string> = {
    missed_day: 'Esquecimento',
    damage: 'Dano',
    death: 'Morte',
    last_breath: 'Evento legado',
    regen: 'Recuperação',
    boss_ready: 'Boss Final',
    system: 'Sistema',
  }
  return labels[type] ?? 'Evento'
}

function eventLogColor(type: string): string {
  if (type === 'death') return 'text-destructive border-destructive/40 bg-destructive/10'
  if (type === 'missed_day' || type === 'damage') return 'text-secondary border-secondary/40 bg-secondary/10'
  if (type === 'regen' || type === 'last_breath') return 'text-primary border-primary/40 bg-primary/10'
  return 'text-muted-foreground border-border bg-black/35'
}

function XPBreakdown({ lines }: { lines?: XPBreakdownLine[] }) {
  if (!lines || lines.length === 0) return null
  const total = lines.reduce((sum, line) => sum + line.value, 0)
  return (
    <div className="mt-2 space-y-1 border-t border-border pt-2">
      {lines.map((line, index) => (
        <div key={`${line.label}-${index}`} className="flex justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            {line.label}
            {line.detail ? <span className="block text-[11px] text-muted-foreground/75">{line.detail}</span> : null}
          </span>
          <span className={`font-semibold ${line.kind === 'attribute' || line.kind === 'class' ? 'text-primary' : 'text-secondary'}`}>
            +{line.value}
          </span>
        </div>
      ))}
      <div className="flex justify-between border-t border-border pt-1 text-xs font-bold">
        <span className="text-foreground">Total</span>
        <span className="text-secondary">+{total} XP</span>
      </div>
    </div>
  )
}

type LootResult =
  | { kind: 'checkin'; title: string; message: string; reward: CheckinReward; missionMessage?: string }
  | { kind: 'exploration'; title: string; message: string; reward: ExplorationReward }
  | { kind: 'battle'; title: string; message: string; battle: BattleResult }

function LootResultModal({ result, onClose }: { result: LootResult; onClose: () => void }) {
  if (result.kind === 'battle') {
    const imageSrc = result.battle.itemGained
      ? CONSUMABLE_ITEMS[result.battle.itemGained].imageSrc
      : result.battle.goldGained > 0
        ? GOLD_REWARD_IMAGE_SRC
        : XP_REWARD_IMAGE_SRC
    const rewardLabel = result.battle.won ? 'Vitória na arena' : 'Sobreviveu à batalha'

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
        <div className="dungeon-panel gold-frame max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-primary/45 bg-card p-5 shadow-2xl">
          <div className="flex items-center gap-4">
            <img
              src={imageSrc}
              alt=""
              className="size-20 rounded border border-primary/35 object-cover"
              style={{ imageRendering: 'pixelated' }}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">{result.title}</p>
              <h3 className="font-bold text-foreground">{rewardLabel}</h3>
              <p className="text-sm font-semibold text-secondary">{result.battle.monsterName}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 text-sm">
            {result.battle.xpGained > 0 && (
              <div className="rounded border border-border bg-black/35 p-3">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">XP recebido</span>
                  <span className="font-bold text-secondary">+{result.battle.xpGained}</span>
                </div>
                <XPBreakdown lines={result.battle.xpBreakdown} />
              </div>
            )}
            {result.battle.goldGained > 0 && (
              <div className="rounded border border-primary/30 bg-primary/10 p-3">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Ouro no Baú</span>
                  <span className="font-bold text-primary">+R$ {result.battle.goldGained.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}
            {result.battle.itemGained && (
              <div className="rounded border border-primary/30 bg-primary/10 p-3 text-primary font-semibold">
                Item encontrado: {CONSUMABLE_ITEMS[result.battle.itemGained].name}.
              </div>
            )}
            {result.battle.damageTaken > 0 && (
              <div className="rounded border border-destructive/30 bg-destructive/10 p-3">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Dano real sofrido</span>
                  <span className="font-bold text-destructive">-{result.battle.damageTaken} vida</span>
                </div>
              </div>
            )}
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{result.message}</p>
          <Button onClick={onClose} className="mt-5 w-full py-3 text-base font-semibold">
            Continuar
          </Button>
        </div>
      </div>
    )
  }

  const isCheckin = result.kind === 'checkin'
  const rewardLabel = isCheckin ? rewardTitle(result.reward) : explorationRewardTitle(result.reward)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="dungeon-panel gold-frame max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-primary/45 bg-card p-5 shadow-2xl">
        <div className="flex items-center gap-4">
          <img
            src={result.reward.imageSrc}
            alt=""
            className="size-20 rounded border border-primary/35 object-cover"
            style={{ imageRendering: 'pixelated' }}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{result.title}</p>
            <h3 className="font-bold text-foreground">{rewardLabel}</h3>
            <p className="text-sm font-semibold text-secondary">{result.reward.label}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          {'xpGained' in result.reward && result.reward.xpGained ? (
            <div className="rounded border border-border bg-black/35 p-3">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">XP recebido</span>
                <span className="font-bold text-secondary">+{result.reward.xpGained}</span>
              </div>
              <XPBreakdown lines={result.reward.xpBreakdown} />
            </div>
          ) : null}
          {'goldGained' in result.reward && result.reward.goldGained ? (
            <div className="rounded border border-primary/30 bg-primary/10 p-3">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Ouro no Baú</span>
                <span className="font-bold text-primary">+R$ {result.reward.goldGained.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          ) : null}
          {'itemGained' in result.reward && result.reward.itemGained ? (
            <div className="rounded border border-primary/30 bg-primary/10 p-3 text-primary font-semibold">
              Item guardado na mochila.
            </div>
          ) : null}
          {'equipmentSlotGained' in result.reward && result.reward.equipmentSlotGained ? (
            <div className="rounded border border-primary/30 bg-primary/10 p-3 text-primary font-semibold">
              Equipamento adicionado ao inventário.
            </div>
          ) : null}
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{result.message}</p>
        {isCheckin && result.missionMessage && (
          <p className="mt-2 rounded border border-secondary/30 bg-secondary/10 p-3 text-xs text-muted-foreground">{result.missionMessage}</p>
        )}
        <Button onClick={onClose} className="mt-5 w-full py-3 text-base font-semibold">
          Continuar
        </Button>
      </div>
    </div>
  )
}

function locationById(locationId: ExplorationLocationId) {
  return EXPLORATION_LOCATIONS.find(location => location.id === locationId) ?? EXPLORATION_LOCATIONS[0]
}

function routePoint(fromId: ExplorationLocationId, toId: ExplorationLocationId, progressPct: number) {
  const from = locationById(fromId)
  const to = locationById(toId)
  const pct = Math.max(0, Math.min(1, progressPct))
  return {
    x: from.x + (to.x - from.x) * pct,
    y: from.y + (to.y - from.y) * pct,
  }
}

type DetailTab = 'stats' | 'checkin' | 'explore' | 'battle' | 'inventory' | 'shop' | 'attributes' | 'realm' | 'history'
type HistoryFilter = 'all' | CharacterEventLogType

export default function CharacterDetailPage({ character, onBack, onUpdateCharacter, onFlushPendingLevelUp, onRenameCharacter, onDeleteCharacter, onOpenRitual }: CharacterDetailPageProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('stats')
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [tooltipAttr, setTooltipAttr] = useState<string | null>(null)
  const [editingMarker, setEditingMarker] = useState(false)
  const [markerValue, setMarkerValue] = useState(String(character.journeyMarker))
  const [showNextEvolution, setShowNextEvolution] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [lastBattle, setLastBattle] = useState<BattleResult | null>(null)
  const [activeBattle, setActiveBattle] = useState<ActiveBattleState | null>(null)
  const [battleQuiz, setBattleQuiz] = useState<BattleQuizQuestion | null>(null)
  const [visibleActiveBattleRounds, setVisibleActiveBattleRounds] = useState(0)
  const [pendingBattleResult, setPendingBattleResult] = useState<BattleResult | null>(null)
  const [advancedActionsOpen, setAdvancedActionsOpen] = useState(false)
  const [advancedActionPage, setAdvancedActionPage] = useState(0)
  const [enemyAttacksOpen, setEnemyAttacksOpen] = useState(false)
  const [itemsOpen, setItemsOpen] = useState(false)
  const [bossOfferCharacter, setBossOfferCharacter] = useState<Character | null>(null)
  const [lastCheckin, setLastCheckin] = useState<CheckinResult | null>(null)
  const [lootResult, setLootResult] = useState<LootResult | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<ExplorationLocationId | null>(null)
  const [showPositionDetails, setShowPositionDetails] = useState(false)
  const [battleScreenOpen, setBattleScreenOpen] = useState(false)
  const [visibleBattleRounds, setVisibleBattleRounds] = useState(0)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [editingNextCycleTarget, setEditingNextCycleTarget] = useState(false)
  const [nextCycleTargetValue, setNextCycleTargetValue] = useState(String(character.nextCycleMaxTreasure ?? character.maxTreasure))
  const battleLogRef = useRef<HTMLDivElement | null>(null)

  const classDef = CLASSES.find(c => c.id === character.class)!
  const currentClassImage = classImageForLevel(classDef, character.level)
  const nextClassImage = nextClassImageStage(classDef, character.level)
  const effectiveAttributes = calcEffectiveAttributes(character)
  const equipmentAttributes = calcEquipmentAttributes(character)
  const battleCount = battlesToday(character)
  const battleCharges = getBattleCharges(character, new Date(nowTick))
  const maxBattleLoss = maxBattleDamageOnDefeat(character)
  const checkinReady = canCheckin(character, new Date(nowTick))
  const checkinRemaining = checkinTimeRemaining(character, new Date(nowTick))
  const dailyMissionState = getDailyMissions(character)
  const nextActions = getNextActions(character, new Date(nowTick))
  const cycleGoals = getCycleGoals(character)
  const consistencyDays = getConsistencyCalendar(character)
  const weeklyContractState = getWeeklyContracts(character)
  const titleViews = getTitleViews(character)
  const codexEntries = getCodexEntries(character)
  const financialEvents = getFinancialEvents(character)
  const bossRisk = calcBossRisk(character)
  const filteredEventLog = (character.eventLog ?? []).filter(entry => historyFilter === 'all' || entry.type === historyFilter)
  const equippedTitle = titleViews.find(title => title.equipped)
  const currentExploration = character.exploration ?? {
    currentLocationId: CASTLE_LOCATION_ID,
    completedLocationIds: [],
  }
  const exploration = explorationProgress(character, new Date(nowTick))
  const selectedLocation = selectedLocationId ? locationById(selectedLocationId) : null
  const activeJourney = currentExploration.activeJourney
  const explorationLevelXPPreview = character.level * 5
  const explorationWisdomXPPreview = Math.round(effectiveAttributes.sabedoria * 1.5)
  const markerPosition = activeJourney
    ? routePoint(activeJourney.fromLocationId, activeJourney.toLocationId, exploration.progressPct)
    : locationById(currentExploration.currentLocationId)
  const ouroConsumido = calcOuroConsumido(character)
  const daysInCycle = calcDaysInCycle(character.cycleStart, character.cycleEnd)
  const daysLeft = calcDaysLeft(character.cycleEnd)
  const quota = calcJourneyQuota(character.maxTreasure, character.journeyMarker, ouroConsumido, Math.max(1, daysLeft))
  const ouroPreservado = Math.max(0, character.maxTreasure - ouroConsumido)
  const spentPct = character.maxTreasure > 0 ? Math.min(100, Math.round((ouroConsumido / character.maxTreasure) * 100)) : 0
  const lifePct = character.maxLife > 0 ? Math.min(100, Math.round((character.life / character.maxLife) * 100)) : 0
  const nextCycleTarget = character.nextCycleMaxTreasure ?? character.maxTreasure
  const nextCycleGap = nextCycleTarget - ouroConsumido
  const nextCycleGapAbs = Math.abs(nextCycleGap)
  const nextCyclePct = nextCycleTarget > 0 ? Math.round((ouroConsumido / nextCycleTarget) * 100) : 0

  // Determine status color
  const getSpentColor = () => {
    if (spentPct >= 100) return 'text-destructive'
    if (spentPct >= 80) return 'text-secondary'
    return 'text-primary'
  }

  const completeMissionIfActive = (base: Character, missionId: DailyMissionId) => {
    return completeDailyMission(base, missionId)
  }

  const handleTabChange = (tab: DetailTab) => {
    setActiveTab(tab)
    if (tab !== 'inventory') return
    const mission = completeMissionIfActive(character, 'inspect_inventory')
    if (mission.awardedXP > 0) {
      onUpdateCharacter(mission.character)
      setActionMessage(mission.message ?? `Missão diária concluída. +${mission.awardedXP} XP.`)
    }
  }

  const handleDailyMissionClick = (missionId: DailyMissionId) => {
    const mission = dailyMissionState.missions.find(item => item.id === missionId)
    if (!mission) return
    if (mission.target === 'ritual') {
      onOpenRitual()
      return
    }
    if (mission.target === 'checkin') handleTabChange('checkin')
    if (mission.target === 'battle') handleTabChange('battle')
    if (mission.target === 'inventory') handleTabChange('inventory')
    if (mission.target === 'shop') handleTabChange('shop')
  }

  const handleActionTarget = (target: ReturnType<typeof getNextActions>[number]['target']) => {
    if (target === 'ritual') onOpenRitual()
    else handleTabChange(target)
  }

  // Distribute attribute point
  const handleAddPoint = (attr: keyof Attributes) => {
    if (character.attributePoints <= 0) return
    const newAttrs = { ...character.attributes, [attr]: character.attributes[attr] + 1 }
    const draft = { ...character, attributes: newAttrs }
    const newMaxLife = calcMaxLife(character.level, calcEffectiveAttributes(draft), classDef)
    // Life scales with max, keep ratio
    const newLife = Math.round((character.life / character.maxLife) * newMaxLife)
    onUpdateCharacter({
      ...character,
      attributes: newAttrs,
      maxLife: newMaxLife,
      life: newLife,
      attributePoints: character.attributePoints - 1,
    })
  }

  const handleSaveNextCycleTarget = () => {
    const parsed = Number(nextCycleTargetValue)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    onUpdateCharacter({ ...character, nextCycleMaxTreasure: parsed })
    setEditingNextCycleTarget(false)
  }

  const tabs = [
    { key: 'stats', label: 'Ficha' },
    { key: 'checkin', label: 'Ronda' },
    { key: 'explore', label: 'Explorar' },
    { key: 'battle', label: 'Batalha' },
    { key: 'inventory', label: 'Inventário' },
    { key: 'shop', label: 'Loja' },
    { key: 'attributes', label: 'Atributos' },
    { key: 'realm', label: 'Reino' },
    { key: 'history', label: 'Histórico' },
  ] as const

  useEffect(() => {
    if (!battleScreenOpen || !lastBattle) return
    if (visibleBattleRounds >= lastBattle.rounds.length) return

    const timer = window.setTimeout(() => {
      setVisibleBattleRounds(count => Math.min(count + 1, lastBattle.rounds.length))
    }, visibleBattleRounds === 0 ? 250 : 850)

    return () => window.clearTimeout(timer)
  }, [battleScreenOpen, lastBattle, visibleBattleRounds])

  useEffect(() => {
    if (!battleScreenOpen || !activeBattle) return
    if (visibleActiveBattleRounds >= activeBattle.rounds.length) return

    const timer = window.setTimeout(() => {
      setVisibleActiveBattleRounds(count => Math.min(count + 1, activeBattle.rounds.length))
    }, visibleActiveBattleRounds === 0 ? 200 : 850)

    return () => window.clearTimeout(timer)
  }, [activeBattle, battleScreenOpen, visibleActiveBattleRounds])

  useEffect(() => {
    const node = battleLogRef.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [activeBattle?.id, visibleActiveBattleRounds])

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const result = syncExplorationConsistency(character, new Date(nowTick))
    if (!result.changed) return
    onUpdateCharacter(result.character)
    setActionMessage(result.message ?? 'A exploração foi atualizada.')
  }, [character, nowTick, onUpdateCharacter])

  const handleCheckin = () => {
    const result = performCheckin(character)
    const mission = result.ok ? completeMissionIfActive(result.character, 'checkin') : { character: result.character, awardedXP: 0 }
    onUpdateCharacter(mission.character, { deferLevelUp: Boolean(result.reward) })
    setLastCheckin(result)
    setLastBattle(null)
    setActiveBattle(null)
    setBattleQuiz(null)
    setPendingBattleResult(null)
    setBattleScreenOpen(false)
    if (result.reward) {
      setLootResult({
        kind: 'checkin',
        title: 'Recompensa da ronda',
        message: result.message,
        reward: result.reward,
        missionMessage: mission.awardedXP > 0 ? mission.message : undefined,
      })
    }
    setActionMessage([
      result.reward ? `${result.message} ${rewardTitle(result.reward)}: ${result.reward.label}.` : result.message,
      mission.awardedXP > 0 ? mission.message : '',
    ].filter(Boolean).join(' '))
    setNowTick(Date.now())
  }

  const handleStartExploration = (locationId: ExplorationLocationId) => {
    const result = startExploration(character, locationId)
    onUpdateCharacter(result.character)
    setActionMessage(result.message)
    setLastBattle(null)
    setLastCheckin(null)
    setActiveBattle(null)
    setBattleQuiz(null)
    setPendingBattleResult(null)
    setBattleScreenOpen(false)
    setNowTick(Date.now())
  }

  const handleCompleteExploration = () => {
    const result = completeExplorationStep(character)
    onUpdateCharacter(result.character, { deferLevelUp: Boolean(result.reward) })
    setActionMessage(result.reward ? `${result.message} ${explorationRewardTitle(result.reward)}: ${result.reward.label}. +${result.reward.xpGained} XP.` : result.message)
    setLastBattle(null)
    setLastCheckin(null)
    setActiveBattle(null)
    setBattleQuiz(null)
    setPendingBattleResult(null)
    setBattleScreenOpen(false)
    if (result.reward) {
      setLootResult({
        kind: 'exploration',
        title: 'Saque da exploração',
        message: result.message,
        reward: result.reward,
      })
    }
    setNowTick(Date.now())
  }

  const handleBattle = () => {
    const result = startInteractiveBattle(character, new Date(nowTick))
    onUpdateCharacter(result.character)
    setActionMessage(result.message)
    setLastBattle(null)
    setBattleQuiz(null)
    setPendingBattleResult(null)
    setAdvancedActionsOpen(false)
    setAdvancedActionPage(0)
    setEnemyAttacksOpen(false)
    setItemsOpen(false)
    if (result.battle) {
      setActiveBattle(result.battle)
      setVisibleActiveBattleRounds(1)
      setBattleScreenOpen(true)
    }
  }

  const finishBattleTurn = (result: { character: Character; battle: ActiveBattleState; message: string; result?: BattleResult }) => {
    if (result.result) {
      const mission = result.result.rounds.length > 0 && !result.result.died
        ? completeMissionIfActive(result.character, 'battle')
        : { character: result.character, awardedXP: 0 }
      const bossOffer = result.result.won && !result.result.boss && shouldOfferBattleBoss(mission.character)
      const characterAfterOffer = bossOffer ? markBattleBossOffered(mission.character) : mission.character
      onUpdateCharacter(characterAfterOffer, { deferLevelUp: result.result.rounds.length > 0 })
      if (bossOffer) {
        setBossOfferCharacter(characterAfterOffer)
      }
      setActiveBattle(result.battle)
      setPendingBattleResult(result.result)
      setLastBattle(result.result)
      setBattleQuiz(null)
      setVisibleActiveBattleRounds(count => Math.min(count + 1, result.battle.rounds.length))
      const loot = [
        result.result.xpGained > 0 ? `+${result.result.xpGained} XP` : '',
        result.result.goldGained > 0 ? `+R$ ${result.result.goldGained.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no Baú` : '',
        result.result.itemGained ? `Item: ${CONSUMABLE_ITEMS[result.result.itemGained].name}` : '',
        result.result.damageTaken > 0 ? `-${result.result.damageTaken} vida` : '',
      ].filter(Boolean).join(' · ')
      setActionMessage([
        `${result.result.message}${loot ? ` ${loot}` : ''}`,
        mission.awardedXP > 0 ? mission.message : '',
      ].filter(Boolean).join(' '))
      return
    }
    onUpdateCharacter(result.character)
    setActiveBattle(result.battle)
    setVisibleActiveBattleRounds(count => Math.min(count + 1, result.battle.rounds.length))
    setActionMessage(result.message)
  }

  const handleBattleAction = (type: 'attack' | 'strong' | 'special' | 'technique' | 'item', itemId?: ConsumableItemId, techniqueId?: string) => {
    if (!activeBattle) return
    if (visibleActiveBattleRounds < activeBattle.rounds.length || pendingBattleResult) return
    finishBattleTurn(performBattleTurn(character, activeBattle, { type, itemId, techniqueId }))
  }

  const handleDrawBattleQuiz = (difficulty: BattleQuizDifficulty) => {
    if (activeBattle && visibleActiveBattleRounds < activeBattle.rounds.length) return
    setBattleQuiz(drawBattleQuizQuestion(difficulty))
  }

  const handleAnswerBattleQuiz = (optionIndex: number) => {
    if (!activeBattle || !battleQuiz) return
    if (visibleActiveBattleRounds < activeBattle.rounds.length || pendingBattleResult) return
    const result = answerBattleQuiz(character, activeBattle, battleQuiz, optionIndex)
    finishBattleTurn(result)
    setBattleQuiz(null)
  }

  const handleAnswerKnowledgeBlock = (optionIndex: number) => {
    if (!activeBattle?.pendingKnowledgeBlock) return
    finishBattleTurn(answerKnowledgeBlock(character, activeBattle, optionIndex))
  }

  const handleAcceptBossBattle = () => {
    if (!bossOfferCharacter) return
    const result = startInteractiveBattle(bossOfferCharacter, new Date(nowTick), { boss: true })
    onUpdateCharacter(result.character)
    setBossOfferCharacter(null)
    setLootResult(null)
    setActionMessage(result.message)
    setLastBattle(null)
    setBattleQuiz(null)
    setPendingBattleResult(null)
    setAdvancedActionsOpen(false)
    setAdvancedActionPage(0)
    setEnemyAttacksOpen(false)
    setItemsOpen(false)
    if (result.battle) {
      setActiveBattle(result.battle)
      setVisibleActiveBattleRounds(1)
      setBattleScreenOpen(true)
    }
  }

  const handleDeclineBossBattle = () => {
    setBossOfferCharacter(null)
    onFlushPendingLevelUp()
  }

  const handleBuyConsumable = (itemId: ConsumableItemId) => {
    const result = buyConsumable(character, itemId)
    const bought = result.character !== character
    const mission = bought ? completeMissionIfActive(result.character, 'buy_shop') : { character: result.character, awardedXP: 0 }
    onUpdateCharacter(mission.character)
    setActionMessage([result.message, mission.awardedXP > 0 ? mission.message : ''].filter(Boolean).join(' '))
    setLastBattle(null)
    setActiveBattle(null)
    setBattleQuiz(null)
    setPendingBattleResult(null)
    setBattleScreenOpen(false)
  }

  const handleUseConsumable = (itemId: ConsumableItemId) => {
    const result = useConsumable(character, itemId)
    onUpdateCharacter(result.character)
    setActionMessage(result.message)
    setLastBattle(null)
    setActiveBattle(null)
    setBattleQuiz(null)
    setPendingBattleResult(null)
    setBattleScreenOpen(false)
  }

  const handleBuyEquipment = (slot: EquipmentSlot) => {
    const result = buyEquipmentUpgrade(character, slot)
    const bought = result.character !== character
    const mission = bought ? completeMissionIfActive(result.character, 'buy_shop') : { character: result.character, awardedXP: 0 }
    onUpdateCharacter(mission.character)
    setActionMessage([result.message, mission.awardedXP > 0 ? mission.message : ''].filter(Boolean).join(' '))
    setLastBattle(null)
    setActiveBattle(null)
    setBattleQuiz(null)
    setPendingBattleResult(null)
    setBattleScreenOpen(false)
  }

  const handleClaimWeekly = (contractId: WeeklyContractId) => {
    const result = claimWeeklyContract(character, contractId)
    onUpdateCharacter(result.character)
    setActionMessage(result.message)
  }

  const handleEquipTitle = (titleId: TitleId) => {
    const result = equipTitle(character, titleId)
    onUpdateCharacter(result.character)
    setActionMessage(result.message)
  }

  if (battleScreenOpen && activeBattle) {
    const potionItems = (character.inventory ?? []).filter(item => item.quantity > 0 && CONSUMABLE_ITEMS[item.itemId])
    const visibleRounds = activeBattle.rounds.slice(0, visibleActiveBattleRounds)
    const currentRound = visibleRounds.at(-1)
    const shownPlayerHp = currentRound?.playerHp ?? activeBattle.playerBattleHpStart
    const shownMonsterHp = currentRound?.monsterHp ?? activeBattle.monsterHpStart
    const battleAnimating = visibleActiveBattleRounds < activeBattle.rounds.length
    const battleResultReady = pendingBattleResult && !battleAnimating
    const actionLocked = battleAnimating || Boolean(battleResultReady) || Boolean(activeBattle.pendingKnowledgeBlock)
    const canUseSpecial = activeBattle.playerSpecial >= activeBattle.playerSpecialMax && activeBattle.playerResource >= activeBattle.classProfile.strongCost
    const techniquePageSize = 1
    const techniquePageCount = Math.max(1, Math.ceil(activeBattle.playerTechniques.length / techniquePageSize))
    const techniquePage = Math.min(advancedActionPage, techniquePageCount - 1)
    const visibleTechniques = activeBattle.playerTechniques.slice(techniquePage * techniquePageSize, techniquePage * techniquePageSize + techniquePageSize)
    const currentEventTitle = currentRound
      ? currentRound.actor === 'monster' && currentRound.result === 'hit'
        ? `Tomou ${currentRound.damage} de dano`
        : currentRound.actor === 'monster' && currentRound.result === 'critical'
          ? `Crítico inimigo: -${currentRound.damage}`
          : currentRound.actor === 'monster' && currentRound.result === 'miss'
            ? 'Você desviou'
            : currentRound.actor === 'player' && currentRound.result === 'critical'
              ? `Acerto crítico: ${currentRound.damage}`
              : currentRound.actor === 'player' && currentRound.result === 'hit' && currentRound.damage > 0
                ? `Acertou: ${currentRound.damage}`
                : currentRound.actor === 'player' && currentRound.result === 'hit'
                  ? 'Ação usada'
                  : currentRound.actor === 'player' && currentRound.result === 'miss'
                    ? 'Você errou'
                    : 'Batalha iniciada'
      : 'Batalha iniciada'
    const currentEventTone = currentRound?.actor === 'monster'
      ? currentRound.result === 'miss' ? 'border-primary/35 bg-primary/10 text-primary' : 'border-destructive/35 bg-destructive/10 text-destructive'
      : currentRound?.result === 'miss'
        ? 'border-border bg-black/35 text-muted-foreground'
        : 'border-primary/35 bg-primary/10 text-primary'

    return (
      <div className="min-h-screen bg-background">
        {activeBattle.pendingKnowledgeBlock && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
            <div className="dungeon-panel gold-frame max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-primary/45 bg-card p-5 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Escudo do Conhecimento</p>
              <h3 className="mt-1 text-xl font-black text-foreground">{activeBattle.pendingKnowledgeBlock.attackName}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                O inimigo preparou um golpe poderoso de <span className="font-bold text-destructive">{activeBattle.pendingKnowledgeBlock.damage} dano</span>.
                Acerte a pergunta para bloquear totalmente.
              </p>
              <div className="mt-4 rounded border border-border bg-black/35 p-3">
                <p className="text-sm font-semibold text-foreground">{activeBattle.pendingKnowledgeBlock.question.prompt}</p>
                <div className="mt-3 grid gap-2">
                  {activeBattle.pendingKnowledgeBlock.question.options.map((option, index) => (
                    <Button
                      key={option}
                      variant="outline"
                      className="h-auto justify-start whitespace-normal px-3 py-2 text-left text-sm"
                      onClick={() => handleAnswerKnowledgeBlock(index)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <header className="bg-black/75 border-b border-primary/25 sticky top-0 z-10 backdrop-blur">
          <div className="max-w-xl mx-auto px-3 py-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Arena da Masmorra</p>
              <h1 className="font-bold text-foreground text-sm">{character.name} vs {activeBattle.monsterName}</h1>
            </div>
            <span className={`text-xs font-bold ${activeBattle.boss ? 'text-destructive' : 'text-muted-foreground'}`}>
              {activeBattle.boss ? 'CHEFÃO' : `Turno ${activeBattle.turn}`}
            </span>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-3 py-3 space-y-2">
          <section className="dungeon-panel gold-frame bg-card border border-border rounded-lg p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Sua vida</span>
                  <span className="text-foreground font-semibold">{shownPlayerHp}/{activeBattle.playerBattleHpStart}</span>
                </div>
                <ProgressBar value={shownPlayerHp} max={activeBattle.playerBattleHpStart} colorClass={shownPlayerHp <= 0 ? 'bg-destructive' : 'bg-primary'} />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{activeBattle.classProfile.resourceName}</span>
                  <span className="text-foreground font-semibold">{activeBattle.playerResource}/{activeBattle.playerResourceMax}</span>
                </div>
                <ProgressBar value={activeBattle.playerResource} max={activeBattle.playerResourceMax} colorClass="bg-secondary" />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Especial</span>
                  <span className="text-foreground font-semibold">{activeBattle.playerSpecial}/{activeBattle.playerSpecialMax}</span>
                </div>
                <ProgressBar value={activeBattle.playerSpecial} max={activeBattle.playerSpecialMax} colorClass="bg-accent" />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{activeBattle.monsterName}</span>
                  <span className="text-foreground font-semibold">{shownMonsterHp}/{activeBattle.monsterHpStart}</span>
                </div>
                <ProgressBar value={shownMonsterHp} max={activeBattle.monsterHpStart} colorClass={shownMonsterHp <= 0 ? 'bg-destructive' : 'bg-destructive'} />
                {activeBattle.boss && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Escudo</span>
                      <span className="text-foreground font-semibold">{activeBattle.bossShield}/{activeBattle.bossShieldMax}</span>
                    </div>
                    <ProgressBar value={activeBattle.bossShield} max={activeBattle.bossShieldMax} colorClass={activeBattle.bossShield > 0 ? 'bg-accent' : 'bg-primary'} />
                  </>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Ímpeto inimigo</span>
                  <span className="text-foreground font-semibold">{activeBattle.enemyResource}/{activeBattle.enemyResourceMax}</span>
                </div>
                <ProgressBar value={activeBattle.enemyResource} max={activeBattle.enemyResourceMax} colorClass="bg-muted-foreground" />
                <div className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-muted-foreground">
                  Derrota: <span className="font-bold text-destructive">-{activeBattle.defeatDamage} vida real</span>
                </div>
              </div>
            </div>
            {activeBattle.boss && (
              <div className="mt-2 rounded border border-destructive/35 bg-destructive/10 px-2 py-1 text-[11px] text-muted-foreground">
                Chefão: o Escudo de Patrimônio só quebra com <span className="font-bold text-primary">Especial</span>. Carregue a barra respondendo perguntas.
              </div>
            )}
            <button
              type="button"
              onClick={() => setEnemyAttacksOpen(open => !open)}
              className="mt-2 flex w-full items-center justify-between rounded border border-border bg-black/25 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Golpes do inimigo</span>
              {enemyAttacksOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
            {enemyAttacksOpen && (
              <div className="mt-2 grid gap-1.5">
                {activeBattle.enemyAttacks.map(attack => (
                  <div key={attack.id} className="rounded border border-border bg-black/35 px-2 py-1.5 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{attack.name}</span>
                      <span className="text-muted-foreground">Custo {attack.resourceCost}</span>
                    </div>
                    <p className="text-muted-foreground">{attack.description} Dano {attack.minDamage}-{attack.maxDamage}.</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dungeon-panel gold-frame bg-card border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Registro da luta</h3>
              <span className={`text-xs font-bold ${battleAnimating ? 'text-secondary' : battleResultReady ? pendingBattleResult?.won ? 'text-primary' : 'text-destructive' : 'text-muted-foreground'}`}>
                {battleAnimating ? 'Acontecendo...' : battleResultReady ? pendingBattleResult?.won ? 'Vitória' : 'Derrota' : 'Sua vez'}
              </span>
            </div>
            <div className={`rounded border px-3 py-2 text-center ${currentEventTone}`}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Evento atual</p>
              <p className="mt-0.5 text-xl font-black leading-tight sm:text-2xl">{currentEventTitle}</p>
              {currentRound && (
                <p className="mt-1 text-xs text-foreground">{currentRound.text}</p>
              )}
            </div>
            <div ref={battleLogRef} className="min-h-28 max-h-[22vh] space-y-1.5 overflow-auto pr-1">
              {visibleRounds.map((round, index) => (
                <div key={`${round.turn}-${round.actor}-${index}`} className={`rounded border px-2 py-1.5 text-xs animate-in fade-in slide-in-from-bottom-1 ${
                  round.actor === 'player'
                    ? 'border-primary/35 bg-primary/10'
                    : round.actor === 'monster'
                      ? 'border-destructive/30 bg-destructive/10'
                      : 'border-border bg-black/35'
                }`}>
                  <p className={round.result === 'critical' ? 'text-primary font-semibold' : round.result === 'miss' ? 'text-muted-foreground italic' : 'text-foreground'}>{round.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Você {round.playerHp} vida · Inimigo {round.monsterHp} HP</p>
                </div>
              ))}
            </div>
          </section>

          {!battleResultReady && (
            <section className="dungeon-panel bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Ações</h3>
                <p className="text-xs text-muted-foreground">{battleAnimating ? 'Aguarde...' : 'Escolha o movimento'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => handleBattleAction('attack')} disabled={actionLocked} variant="outline" className="h-auto justify-start px-3 py-2 text-left">
                  <span>
                    <span className="block font-bold">Ataque básico</span>
                    <span className="block text-[11px] font-normal text-muted-foreground">Sem custo · seguro</span>
                  </span>
                </Button>
                <Button onClick={() => handleBattleAction('strong')} disabled={actionLocked || activeBattle.playerResource < activeBattle.classProfile.strongCost} variant="outline" className="h-auto justify-start px-3 py-2 text-left">
                  <span>
                    <span className="block font-bold">Golpe forte</span>
                    <span className="block text-[11px] font-normal text-muted-foreground">Custa {activeBattle.classProfile.strongCost} {activeBattle.classProfile.resourceName}</span>
                  </span>
                </Button>
                <Button onClick={() => handleBattleAction('special')} disabled={actionLocked || !canUseSpecial} className="h-auto justify-start px-3 py-2 text-left">
                  <span>
                    <span className="block font-bold">Especial</span>
                    <span className="block text-[11px] font-normal opacity-80">Barra cheia + recurso</span>
                  </span>
                </Button>
                <Button size="sm" variant="outline" disabled={actionLocked} onClick={() => setItemsOpen(open => !open)} className="h-auto justify-start px-3 py-2 text-left">
                  <span>
                    <span className="block font-bold">Itens</span>
                    <span className="block text-[11px] font-normal text-muted-foreground">{potionItems.length > 0 ? `${potionItems.length} tipo(s) de poção` : 'Nenhuma poção'}</span>
                  </span>
                </Button>
              </div>

              {itemsOpen && (
                <div className="rounded border border-border bg-black/25 p-2">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase tracking-wide text-muted-foreground">Poções</span>
                    <span className="text-[11px] text-muted-foreground">consome item real</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {potionItems.length === 0 ? (
                      <p className="col-span-2 text-xs text-muted-foreground">Nenhuma poção disponível.</p>
                    ) : potionItems.map(item => (
                      <Button key={item.itemId} size="sm" variant="outline" disabled={actionLocked} onClick={() => handleBattleAction('item', item.itemId)}>
                        {CONSUMABLE_ITEMS[item.itemId].name} x{item.quantity}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded border border-border bg-black/25">
                <button
                  type="button"
                  onClick={() => setAdvancedActionsOpen(open => !open)}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <span>Golpes avançados</span>
                  {advancedActionsOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                </button>
                {advancedActionsOpen && (
                  <div className="border-t border-border p-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        disabled={techniquePage <= 0}
                        onClick={() => setAdvancedActionPage(page => Math.max(0, page - 1))}
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <span className="text-[11px] text-muted-foreground">Página {techniquePage + 1}/{techniquePageCount}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        disabled={techniquePage >= techniquePageCount - 1}
                        onClick={() => setAdvancedActionPage(page => Math.min(techniquePageCount - 1, page + 1))}
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                    {visibleTechniques.map(technique => {
                      const locked = character.level < technique.minLevel
                      const lackingResource = activeBattle.playerResource < technique.resourceCost
                      return (
                        <Button
                          key={technique.id}
                          variant="outline"
                          disabled={actionLocked || locked || lackingResource}
                          onClick={() => handleBattleAction('technique', undefined, technique.id)}
                          className={`h-auto w-full justify-start px-3 py-2 text-left ${locked ? 'opacity-60' : ''}`}
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-1 font-bold">
                              {locked && <Lock className="size-3" />}
                              {technique.name}
                            </span>
                            <span className="block text-[11px] font-normal text-muted-foreground">
                              {locked ? `Libera no nível ${technique.minLevel}` : `${technique.resourceCost} ${activeBattle.classProfile.resourceName} · dano x${technique.damageMult.toFixed(1)}`}
                            </span>
                          </span>
                        </Button>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {!battleResultReady && (
          <section className="dungeon-panel bg-card border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Carregar especial</h3>
              <p className="text-[11px] text-muted-foreground">Pergunta gasta turno</p>
            </div>
            {!battleQuiz ? (
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="outline" disabled={actionLocked} onClick={() => handleDrawBattleQuiz('easy')}>Base</Button>
                <Button size="sm" variant="outline" disabled={actionLocked} onClick={() => handleDrawBattleQuiz('medium')}>Média</Button>
                <Button size="sm" variant="outline" disabled={actionLocked} onClick={() => handleDrawBattleQuiz('hard')}>Difícil</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">{battleQuiz.prompt}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {battleQuiz.options.map((option, index) => (
                    <Button key={option} variant="outline" disabled={actionLocked} className="w-full justify-start whitespace-normal text-left h-auto px-2 py-1.5 text-xs" onClick={() => handleAnswerBattleQuiz(index)}>
                      {option}
                    </Button>
                  ))}
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setBattleQuiz(null)}>Trocar dificuldade</Button>
              </div>
            )}
          </section>
          )}

          {battleResultReady && pendingBattleResult && (
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <p className="font-semibold text-foreground">{pendingBattleResult.message}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {pendingBattleResult.goldGained > 0 && (
                  <div className="rounded border border-primary/30 bg-primary/10 p-3 text-sm">
                    <p className="font-semibold text-primary">Ouro para o Baú</p>
                    <p className="text-xs text-muted-foreground">+R$ {pendingBattleResult.goldGained.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                )}
                {pendingBattleResult.itemGained && (
                  <div className="rounded border border-primary/30 bg-primary/10 p-3 text-sm">
                    <p className="font-semibold text-primary">Item encontrado</p>
                    <p className="text-xs text-muted-foreground">{CONSUMABLE_ITEMS[pendingBattleResult.itemGained].name}</p>
                  </div>
                )}
                <div className="rounded border border-border bg-black/35 p-3 text-sm">
                  <p className="font-semibold text-foreground">XP da batalha</p>
                  <p className="text-xs text-secondary">+{pendingBattleResult.xpGained} XP</p>
                  <XPBreakdown lines={pendingBattleResult.xpBreakdown} />
                </div>
                {pendingBattleResult.damageTaken > 0 && (
                  <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm">
                    <p className="font-semibold text-destructive">Dano real sofrido</p>
                    <p className="text-xs text-muted-foreground">-{pendingBattleResult.damageTaken} vida</p>
                  </div>
                )}
              </div>
              <Button className="w-full" onClick={() => {
                setBattleScreenOpen(false)
                setActiveBattle(null)
                setPendingBattleResult(null)
                if (pendingBattleResult.won) {
                  setLootResult({
                    kind: 'battle',
                    title: 'Recompensa da batalha',
                    message: pendingBattleResult.message,
                    battle: pendingBattleResult,
                  })
                } else {
                  onFlushPendingLevelUp()
                }
              }}>
                Voltar para a ficha
              </Button>
            </section>
          )}
        </main>
      </div>
    )
  }

  const battleComplete = lastBattle ? visibleBattleRounds >= lastBattle.rounds.length : false

  if (battleScreenOpen && lastBattle) {
    const visibleRounds = lastBattle.rounds.slice(0, visibleBattleRounds)
    const currentRound = visibleRounds.at(-1)
    const shownPlayerHp = currentRound?.playerHp ?? lastBattle.playerBattleHpStart
    const shownMonsterHp = currentRound?.monsterHp ?? lastBattle.monsterHpStart

    return (
      <div className="min-h-screen bg-background">
        <header className="bg-black/75 border-b border-primary/25 sticky top-0 z-10 backdrop-blur">
          <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Arena da Masmorra</p>
              <h1 className="font-bold text-foreground">{character.name} vs {lastBattle.monsterName}</h1>
            </div>
            <span className={`text-xs font-bold ${battleComplete ? lastBattle.won ? 'text-primary' : 'text-destructive' : 'text-muted-foreground'}`}>
              {battleComplete ? lastBattle.won ? 'Vitória' : 'Derrota' : 'Lutando...'}
            </span>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
          <section className="dungeon-panel gold-frame bg-card border border-border rounded-lg p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Sua vida de batalha</span>
                  <span className="text-foreground font-semibold">{shownPlayerHp}/{lastBattle.playerBattleHpStart}</span>
                </div>
                <ProgressBar value={shownPlayerHp} max={lastBattle.playerBattleHpStart} colorClass={shownPlayerHp <= 0 ? 'bg-destructive' : 'bg-primary'} />
                <p className="text-[11px] text-muted-foreground">Não é a vida real do personagem; vale só para esta batalha.</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{lastBattle.monsterName}</span>
                  <span className="text-foreground font-semibold">{shownMonsterHp}/{lastBattle.monsterHpStart}</span>
                </div>
                <ProgressBar value={shownMonsterHp} max={lastBattle.monsterHpStart} colorClass={shownMonsterHp <= 0 ? 'bg-destructive' : 'bg-secondary'} />
              </div>
            </div>

            <div className="min-h-80 max-h-[55vh] space-y-2 overflow-auto pr-1">
              {visibleRounds.map((round, index) => (
                <div key={`${round.turn}-${round.actor}-${index}`} className="rounded border border-border bg-black/35 p-3 text-sm animate-in fade-in slide-in-from-bottom-1">
                  <p className={round.result === 'critical' ? 'text-primary font-semibold' : round.result === 'miss' ? 'text-muted-foreground italic' : 'text-foreground'}>
                    {round.text}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você {round.playerHp} vida de batalha · Monstro {round.monsterHp} HP
                  </p>
                </div>
              ))}
              {visibleRounds.length === 0 && (
                <p className="text-sm text-muted-foreground">Os portões da arena se fecham...</p>
              )}
            </div>
          </section>

          {battleComplete && (
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <p className="font-semibold text-foreground">{lastBattle.message}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {lastBattle.goldGained > 0 && (
                  <div className="flex items-center gap-3 rounded border border-primary/30 bg-primary/10 p-3 text-sm">
                    <img src={GOLD_REWARD_IMAGE_SRC} alt="" className="size-12 rounded border border-primary/30 object-cover" style={{ imageRendering: 'pixelated' }} />
                    <div>
                      <p className="font-semibold text-primary">Ouro para o Baú</p>
                      <p className="text-xs text-muted-foreground">+R$ {lastBattle.goldGained.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                )}
                {lastBattle.itemGained && (
                  <div className="flex items-center gap-3 rounded border border-primary/30 bg-primary/10 p-3 text-sm">
                    <img src={CONSUMABLE_ITEMS[lastBattle.itemGained].imageSrc} alt="" className="size-12 rounded border border-primary/30 object-cover" style={{ imageRendering: 'pixelated' }} />
                    <div>
                      <p className="font-semibold text-primary">Item encontrado</p>
                      <p className="text-xs text-muted-foreground">{CONSUMABLE_ITEMS[lastBattle.itemGained].name}</p>
                    </div>
                  </div>
                )}
                <div className="rounded border border-border bg-black/35 p-3 text-sm">
                  <p className="font-semibold text-foreground">XP da batalha</p>
                  <p className="text-xs text-secondary">+{lastBattle.xpGained} XP</p>
                  <XPBreakdown lines={lastBattle.xpBreakdown} />
                </div>
                {lastBattle.damageTaken > 0 && (
                  <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm">
                    <p className="font-semibold text-destructive">Dano real sofrido</p>
                    <p className="text-xs text-muted-foreground">-{lastBattle.damageTaken} vida</p>
                  </div>
                )}
                {lastBattle.died && (
                  <div className="rounded border border-destructive/40 bg-destructive/15 p-3 text-sm sm:col-span-2">
                    <p className="font-semibold text-destructive">Personagem caiu</p>
                    <p className="text-xs text-muted-foreground">Ele voltou ao nível 1, perdeu itens, equipamentos e progresso de exploração. O Baú do Ouro Preservado continua guardado.</p>
                  </div>
                )}
              </div>
              <Button className="w-full" onClick={() => {
                setBattleScreenOpen(false)
                onFlushPendingLevelUp()
              }}>
                Voltar para a ficha
              </Button>
            </section>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="bg-black/75 border-b border-primary/25 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition text-sm font-medium">
            ← Guilda
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground truncate">{character.name}</p>
            <p className="text-xs text-muted-foreground">{classDef.name} · {character.category}</p>
          </div>
          <button
            type="button"
            onClick={onRenameCharacter}
            className="grid size-8 shrink-0 place-items-center rounded border border-border bg-black/35 text-muted-foreground hover:text-foreground"
            aria-label="Renomear personagem"
            title="Renomear"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDeleteCharacter}
            className="grid size-8 shrink-0 place-items-center rounded border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
            aria-label="Deletar personagem"
            title="Deletar"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-medium">
            Nv. {character.level}
          </span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {lootResult && (
          <LootResultModal
            result={lootResult}
            onClose={() => {
              setLootResult(null)
              if (!bossOfferCharacter) onFlushPendingLevelUp()
            }}
          />
        )}
        {!lootResult && bossOfferCharacter && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
            <div className="dungeon-panel gold-frame w-full max-w-md rounded-lg border border-destructive/45 bg-card p-5 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-destructive">Chefão encontrado</p>
              <h3 className="mt-1 text-xl font-black text-foreground">Um guardião bloqueou a arena</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Depois de tantas lutas hoje, surgiu um chefão com um <span className="font-bold text-primary">Escudo de Patrimônio</span>.
                Ataques comuns só arranham o escudo. Para vencer, você precisa carregar e usar o <span className="font-bold text-primary">Especial</span>.
              </p>
              <div className="mt-4 rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-muted-foreground">
                Essa chance aparece no máximo uma vez por dia, depois de pelo menos 3 batalhas. Aceitar não gasta carga extra da arena.
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={handleDeclineBossBattle}>Voltar ao castelo</Button>
                <Button onClick={handleAcceptBossBattle}>Enfrentar chefão</Button>
              </div>
            </div>
          </div>
        )}

        {/* Hero card */}
        <div className="dungeon-panel gold-frame bg-card border border-border rounded-lg p-5 space-y-4">
          {/* Class art */}
            <button
            type="button"
            onClick={() => nextClassImage && setShowNextEvolution(prev => !prev)}
            className="relative block w-full overflow-hidden rounded-lg border border-primary/35 bg-black/45 text-left"
            aria-label={nextClassImage ? 'Ver prévia da próxima aparência' : 'Arte final do personagem'}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(214,169,51,0.16),transparent_58%)]" />
            <img
              src={currentClassImage.src}
              alt={classDef.name}
              className="relative mx-auto aspect-square w-full max-h-[360px] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
            {nextClassImage && showNextEvolution && (
              <img
                src={nextClassImage.src}
                alt={`${classDef.name} prévia`}
                className="absolute inset-0 mx-auto aspect-square h-full w-full object-contain opacity-55 mix-blend-screen"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <span className="rounded border border-primary/40 bg-black/70 px-2 py-1 text-xs font-bold text-primary">
                Aparência atual
              </span>
              {nextClassImage && (
                <span className="rounded border border-border bg-black/70 px-2 py-1 text-xs text-muted-foreground">
                  {showNextEvolution ? 'Prévia da próxima aparência' : 'Toque para ver próxima aparência'}
                </span>
              )}
            </div>
          </button>

          {/* Name + level title */}
          <div>
            <h1 className="text-xl font-bold text-foreground">{character.name}</h1>
            <p className="text-sm text-muted-foreground">{levelTitle(character.level)} · {classDef.name}</p>
            {equippedTitle && (
              <p className="mt-1 inline-flex rounded border border-primary/35 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {equippedTitle.name}
              </p>
            )}
          </div>

          {/* Life + XP */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Vida
                  <InfoTooltip text="A vida representa a constância do controle. Esquecer de registrar causa dano (Maldição do Esquecimento). Se chegar a zero, o personagem morre e volta ao nível 1." />
                </span>
                <span className="font-semibold text-foreground">{character.life}/{character.maxLife}</span>
              </div>
              <ProgressBar value={character.life} max={character.maxLife} colorClass={lifePct <= 30 ? 'bg-destructive' : lifePct <= 60 ? 'bg-secondary' : 'bg-primary'} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  XP
                  <InfoTooltip text="Ganhe XP fazendo o Ritual de Registro diário, economizando abaixo da Cota de Jornada e vencendo o Boss Final." />
                </span>
                <span className="font-semibold text-foreground">{character.xp}/{character.xpToNextLevel}</span>
              </div>
              <ProgressBar value={character.xp} max={character.xpToNextLevel} colorClass="bg-secondary" />
            </div>
          </div>

          {/* Combo */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Combo de Disciplina
              <InfoTooltip text="Sequência de dias com Ritual de Registro concluído. 3 dias: +5% XP | 7 dias: +10% XP | 14 dias: +15% XP." />
            </span>
            <span className={`font-bold ${character.combo >= 7 ? 'text-secondary' : character.combo >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
              {character.combo} {character.combo >= 14 ? '— Lendário' : character.combo >= 7 ? '— Épico' : character.combo >= 3 ? '— Ativo' : '— Inativo'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded border border-border bg-black/35 p-3 text-sm">
            <span className="text-muted-foreground">
              Mortes do personagem
              <InfoTooltip text="Quando o personagem morre, ele volta ao nível 1 e perde itens, equipamentos e progresso de exploração. O Baú do Ouro Preservado continua intacto." />
            </span>
            <span className={`font-bold ${(character.deathCount ?? 0) > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {character.deathCount ?? 0}
            </span>
          </div>

          {/* Attribute points available */}
          {character.attributePoints > 0 && (
            <div className="bg-secondary/20 border border-secondary/40 rounded-lg p-3 text-sm">
              <p className="font-semibold text-foreground">
                {character.attributePoints} ponto{character.attributePoints > 1 ? 's' : ''} de atributo disponível{character.attributePoints > 1 ? 'is' : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Vá à aba Atributos para distribuir.</p>
            </div>
          )}
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="dungeon-panel bg-card border border-primary/30 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cota de hoje</p>
            <p className="mt-1 text-xl font-bold text-primary">R$ {quota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="mt-1 text-xs text-muted-foreground">Saldo vivo dividido pelos dias que restam.</p>
          </div>
          <div className="dungeon-panel bg-card border border-border rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Baú</p>
            <p className="mt-1 text-xl font-bold text-primary">R$ {(character.goldChest ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="mt-1 text-xs text-muted-foreground">Ouro preservado acumulado.</p>
          </div>
          <div className={`dungeon-panel bg-card border rounded-lg p-4 ${bossRisk.survives ? 'border-primary/30' : 'border-destructive/40'}`}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Boss Final</p>
            <p className={`mt-1 text-xl font-bold ${bossRisk.survives ? 'text-primary' : 'text-destructive'}`}>
              {bossRisk.survives ? 'Sobrevive' : 'Cai'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Dano estimado: -{bossRisk.damageTaken} vida{bossRisk.overLimit > 0 ? ` · acima do limite em R$ ${bossRisk.overLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{bossRisk.advice}</p>
          </div>
        </section>

        <section className={`dungeon-panel bg-card border rounded-lg p-4 space-y-3 ${editingNextCycleTarget ? 'border-primary/45' : 'border-border'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Alvo do próximo ciclo</p>
              <h3 className="font-semibold text-foreground">Edita aqui o próximo teto</h3>
              <p className="text-xs text-muted-foreground mt-1">A mudança vale só para a próxima campanha. O ciclo atual continua intacto.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNextCycleTargetValue(String(nextCycleTarget))
                setEditingNextCycleTarget(prev => !prev)
              }}
              className="grid size-8 shrink-0 place-items-center rounded border border-border bg-black/35 text-muted-foreground hover:text-foreground"
              aria-label="Editar alvo do próximo ciclo"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <div className="rounded border border-border bg-black/35 p-3">
              <p className="text-xs text-muted-foreground">Alvo salvo</p>
              <p className="mt-1 font-bold text-foreground">R$ {nextCycleTarget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className={`rounded border bg-black/35 p-3 ${nextCycleGap >= 0 ? 'border-primary/30' : 'border-destructive/30'}`}>
              <p className="text-xs text-muted-foreground">{nextCycleGap >= 0 ? 'Falta para o alvo' : 'Passou do alvo'}</p>
              <p className={`mt-1 font-bold ${nextCycleGap >= 0 ? 'text-primary' : 'text-destructive'}`}>
                R$ {nextCycleGapAbs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded border border-border bg-black/35 p-3">
              <p className="text-xs text-muted-foreground">Leitura atual</p>
              <p className={`mt-1 font-bold ${nextCycleGap >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {nextCyclePct}% do alvo
              </p>
            </div>
          </div>
          {editingNextCycleTarget && (
            <div className="space-y-2 rounded border border-primary/30 bg-primary/10 p-3">
              <label className="text-xs text-muted-foreground block">Novo alvo para o próximo ciclo</label>
              <input
                type="number"
                value={nextCycleTargetValue}
                onChange={e => setNextCycleTargetValue(e.target.value)}
                min="0"
                className="w-full rounded border border-border bg-input px-3 py-2 text-foreground"
              />
              <p className="text-xs text-muted-foreground">Só o próximo ciclo vai usar esse valor quando o Boss Final começar a campanha seguinte.</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditingNextCycleTarget(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={handleSaveNextCycleTarget}>
                  Salvar para o próximo ciclo
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto border-b border-border pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={`shrink-0 rounded border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                activeTab === t.key
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border bg-black/25 text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {actionMessage && (
          <div className="dungeon-panel border border-primary/30 rounded-lg p-3 text-sm text-foreground">
            <p>{actionMessage}</p>
          </div>
        )}

        {/* Tab: Ficha */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            {/* Avisos inteligentes */}
            {(lifePct <= 35 || spentPct >= 80 || (character.streakWards ?? 0) > 0) && (
              <section className="space-y-2">
                {lifePct <= 35 && (
                  <div className="rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm">
                    <div className="flex gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-destructive">Vida baixa: evite batalha arriscada.</p>
                        <p className="text-xs text-muted-foreground">Use uma poção ou faça o Ritual de Registro antes de encarar a arena.</p>
                      </div>
                    </div>
                  </div>
                )}
                {spentPct >= 80 && (
                  <div className="rounded-lg border border-secondary/35 bg-secondary/10 p-3 text-sm">
                    <div className="flex gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-secondary">Tesouro em zona perigosa.</p>
                        <p className="text-xs text-muted-foreground">{spentPct}% do limite já foi usado. Revise a cota antes de novos gastos.</p>
                      </div>
                    </div>
                  </div>
                )}
                {(character.streakWards ?? 0) > 0 && (
                  <div className="rounded-lg border border-primary/35 bg-primary/10 p-3 text-sm">
                    <div className="flex gap-2">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-primary">Selo de Continuidade ativo: {character.streakWards}</p>
                        <p className="text-xs text-muted-foreground">Absorve uma quebra de registro no ciclo sem dano e sem zerar combo.</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Próximo passo */}
            <section className="dungeon-panel bg-card border border-primary/25 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">O que fazer agora</h3>
              </div>
              <div className="space-y-2">
                {nextActions.map(action => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleActionTarget(action.target)}
                    className={`w-full rounded border p-3 text-left transition ${
                      action.priority === 'danger'
                        ? 'border-destructive/35 bg-destructive/10 hover:bg-destructive/15'
                        : action.priority === 'warning'
                        ? 'border-secondary/35 bg-secondary/10 hover:bg-secondary/15'
                        : action.priority === 'good'
                        ? 'border-primary/35 bg-primary/10 hover:bg-primary/15'
                        : 'border-border bg-black/35 hover:border-primary/30'
                    }`}
                  >
                    <p className="font-semibold text-foreground text-sm">{action.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Missões diárias */}
            <section className="dungeon-panel bg-card border border-primary/25 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide flex items-center gap-2">
                    <ScrollText className="size-4 text-primary" aria-hidden="true" />
                    Contratos Diários
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Duas tarefas simples por dia. Cada contrato concluído rende +5 XP.
                  </p>
                </div>
                <span className={`shrink-0 rounded border px-2 py-1 text-xs font-bold ${
                  dailyMissionState.allDone
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-black/35 text-muted-foreground'
                }`}>
                  {dailyMissionState.allDone ? 'Tudo feito' : `${dailyMissionState.missions.filter(mission => mission.completed).length}/2`}
                </span>
              </div>

              <div className="space-y-2">
                {dailyMissionState.missions.map(mission => (
                  <button
                    key={mission.id}
                    type="button"
                    onClick={() => handleDailyMissionClick(mission.id)}
                    className={`w-full rounded border p-3 text-left transition ${
                      mission.completed
                        ? 'border-primary/35 bg-primary/10'
                        : 'border-border bg-black/35 hover:border-primary/35 hover:bg-primary/5'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {mission.completed ? (
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                      ) : (
                        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className={`font-semibold ${mission.completed ? 'text-primary line-through decoration-primary/70' : 'text-foreground'}`}>
                            {mission.title}
                          </p>
                          <span className="rounded border border-secondary/30 bg-secondary/10 px-2 py-0.5 text-xs font-bold text-secondary">
                            +{mission.xp} XP
                          </span>
                        </div>
                        <p className={`mt-1 text-xs ${mission.completed ? 'text-muted-foreground/75 line-through decoration-muted-foreground/50' : 'text-muted-foreground'}`}>
                          {mission.description}
                        </p>
                        {!mission.completed && (
                          <p className="mt-2 text-xs font-semibold text-primary">{mission.actionLabel}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {dailyMissionState.allDone && (
                <div className="rounded border border-primary/30 bg-primary/10 p-3 text-sm">
                  <p className="font-semibold text-primary">Todas as missões diárias foram concluídas.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Os contratos do dia foram selados. Amanhã a guilda prepara novos desafios.</p>
                </div>
              )}
            </section>

            {/* Objetivos do ciclo */}
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-primary" aria-hidden="true" />
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Objetivos do Ciclo</h3>
              </div>
              <div className="space-y-2">
                {cycleGoals.map(goal => {
                  const pct = goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : goal.completed ? 100 : 0
                  return (
                    <div key={goal.id} className="rounded border border-border bg-black/35 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`font-semibold ${goal.completed ? 'text-primary' : 'text-foreground'}`}>{goal.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{goal.description}</p>
                        </div>
                        <span className={`shrink-0 rounded border px-2 py-0.5 text-[11px] font-bold ${goal.completed ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                          {goal.completed ? 'feito' : `${pct}%`}
                        </span>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={Math.min(goal.progress, goal.target)} max={goal.target || 1} colorClass={goal.completed ? 'bg-primary' : 'bg-secondary'} />
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">Recompensa: {goal.reward}</p>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Calendário de consistência */}
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Calendário de Consistência</h3>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {consistencyDays.map(day => (
                  <div
                    key={day.date}
                    title={`${new Date(`${day.date}T12:00:00`).toLocaleDateString('pt-BR')}${day.amount !== undefined ? ` · R$ ${day.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}`}
                    className={`grid aspect-square place-items-center rounded border text-[11px] font-semibold ${
                      day.status === 'registered'
                        ? 'border-primary/40 bg-primary/20 text-primary'
                        : day.status === 'missed'
                        ? 'border-destructive/30 bg-destructive/10 text-destructive'
                        : day.status === 'today'
                        ? 'border-secondary/40 bg-secondary/10 text-secondary'
                        : 'border-border bg-black/30 text-muted-foreground'
                    }`}
                  >
                    {day.day}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded bg-primary/70" /> Registrado</span>
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded bg-destructive/70" /> Esquecido</span>
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded bg-secondary/70" /> Hoje</span>
              </div>
            </section>

            {/* Ciclo atual */}
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Ciclo Atual</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Tesouro Máximo
                    <InfoTooltip text="O valor máximo que você pretende gastar nesse ciclo. Funciona como o orçamento mensal." />
                  </span>
                  <span className="font-semibold text-foreground">
                    R$ {character.maxTreasure.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">
                    Marco Inicial da Jornada
                    <InfoTooltip text="Valor já comprometido no início do ciclo — parcelas antigas ou lançamentos anteriores." />
                  </span>
                  {editingMarker ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={markerValue}
                        onChange={e => setMarkerValue(e.target.value)}
                        className="w-24 px-2 py-1 text-sm rounded border border-border bg-input text-foreground"
                        min="0"
                      />
                      <button
                        onClick={() => {
                          onUpdateCharacter(updateJourneyMarker(character, Number(markerValue)))
                          setEditingMarker(false)
                        }}
                        className="text-xs text-primary font-semibold"
                      >
                        Salvar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setMarkerValue(String(character.journeyMarker)); setEditingMarker(true) }}
                      className="font-semibold text-foreground hover:text-primary"
                    >
                      R$ {character.journeyMarker.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ✎
                    </button>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Ouro Consumido
                    <InfoTooltip text="Tudo que já foi gasto nesse ciclo, incluindo o Marco Inicial e os registros diários." />
                  </span>
                  <span className={`font-bold ${getSpentColor()}`}>
                    R$ {ouroConsumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="space-y-1">
                  <ProgressBar value={ouroConsumido} max={character.maxTreasure} colorClass={spentPct >= 100 ? 'bg-destructive' : spentPct >= 80 ? 'bg-secondary' : 'bg-primary'} />
                  <p className="text-xs text-right text-muted-foreground">{spentPct}% do Tesouro Máximo consumido</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Baú do Ouro Preservado
                    <InfoTooltip text="Ouro simbólico acumulado dos ciclos em que você ficou abaixo do limite." />
                  </span>
                  <span className="font-bold text-primary">
                    R$ {(character.goldChest ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Ouro Preservado (ciclo atual)
                    <InfoTooltip text="Valor que ainda não foi gasto em relação ao Tesouro Máximo. No final do ciclo, vai para o Baú." />
                  </span>
                  <span className={`font-bold ${ouroPreservado > 0 ? 'text-primary' : 'text-destructive'}`}>
                    R$ {ouroPreservado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </section>

            {/* Tempo */}
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Jornada</h3>
              <div className="grid grid-cols-3 gap-3 text-sm text-center">
                <div className="bg-black/35 border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Dias do ciclo</p>
                  <p className="font-bold text-foreground text-lg">{daysInCycle}</p>
                </div>
                <div className="bg-black/35 border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Dias restantes</p>
                  <p className={`font-bold text-lg ${daysLeft <= 5 ? 'text-destructive' : 'text-foreground'}`}>{daysLeft}</p>
                </div>
                <div className="bg-black/35 border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Registros</p>
                  <p className="font-bold text-foreground text-lg">{character.dailyRecords.filter(r => r.registered).length}</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Início</span>
                  <span>{new Date(character.cycleStart).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Boss Final</span>
                  <span>{new Date(character.cycleEnd).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </section>

            {/* Ronda do Tesouro */}
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">{CHECKIN_ACTION_NAME}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Volte ao app a cada {CHECKIN_COOLDOWN_HOURS}h para vigiar o reino e receber uma recompensa rápida.
                  </p>
                </div>
                <span className={`shrink-0 rounded border px-2 py-1 text-xs font-bold ${checkinReady ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-black/35 text-muted-foreground'}`}>
                  {checkinReady ? 'Pronta' : formatDuration(checkinRemaining)}
                </span>
              </div>
              <Button onClick={() => handleTabChange('checkin')} variant="outline" className="w-full">
                Abrir Ronda
              </Button>
            </section>

            {/* Registros recentes */}
            {character.dailyRecords.length > 0 && (
              <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Registros Recentes</h3>
                <div className="space-y-2">
                  {[...character.dailyRecords].reverse().slice(0, 5).map((record, i) => (
                    <div key={i} className="rounded border border-border bg-black/20 p-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{new Date(record.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                        <span className="font-semibold text-foreground">
                          R$ {record.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-secondary font-medium">+{record.xpGained} XP</span>
                      </div>
                      {record.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{record.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA Ritual */}
            {(() => {
              const today = dateToISO()
              const registeredToday = character.dailyRecords.some(r => r.date === today)
              return (
                <Button
                  onClick={onOpenRitual}
                  className={`w-full py-3 text-base font-semibold ${registeredToday ? 'bg-muted text-foreground border border-border hover:bg-muted/80' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                >
                  {registeredToday ? 'Editar Registro de Hoje' : 'Realizar Ritual de Registro'}
                </Button>
              )
            })()}
          </div>
        )}

        {/* Tab: Ronda */}
        {activeTab === 'checkin' && (
          <div className="space-y-4">
            <section className="dungeon-panel gold-frame bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Visita recorrente</p>
                  <h3 className="font-semibold text-foreground">{CHECKIN_ACTION_NAME}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Uma patrulha rápida pelo salão do tesouro. Pode ser feita a cada {CHECKIN_COOLDOWN_HOURS}h desde a última ronda para incentivar você a abrir o app, olhar a vida, conferir o Baú e manter o controle em vista.
                  </p>
                </div>
                <div className="shrink-0 rounded border border-primary/35 bg-black/45 p-2">
                  <img
                    src={XP_REWARD_IMAGE_SRC}
                    alt=""
                    className="size-16 rounded object-cover"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded border border-border bg-black/35 p-2">
                  <img src={XP_REWARD_IMAGE_SRC} alt="" className="mx-auto mb-1 size-10 rounded object-cover" style={{ imageRendering: 'pixelated' }} />
                  <p className="text-muted-foreground">XP</p>
                </div>
                <div className="rounded border border-border bg-black/35 p-2">
                  <img src={GOLD_REWARD_IMAGE_SRC} alt="" className="mx-auto mb-1 size-10 rounded object-cover" style={{ imageRendering: 'pixelated' }} />
                  <p className="text-muted-foreground">Ouro</p>
                </div>
                <div className="rounded border border-border bg-black/35 p-2">
                  <img src={CONSUMABLE_ITEMS.pocao_pequena.imageSrc} alt="" className="mx-auto mb-1 size-10 rounded object-cover" style={{ imageRendering: 'pixelated' }} />
                  <p className="text-muted-foreground">Poção</p>
                </div>
              </div>

              <div className="rounded border border-primary/30 bg-primary/10 p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Status da ronda</span>
                  <span className={`font-bold ${checkinReady ? 'text-primary' : 'text-secondary'}`}>
                    {checkinReady ? 'Disponível agora' : `Volte em ${formatDuration(checkinRemaining)}`}
                  </span>
                </div>
                {character.lastCheckinAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Última ronda: {new Date(character.lastCheckinAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                )}
              </div>

              <Button
                onClick={handleCheckin}
                disabled={!checkinReady}
                className="w-full py-3 text-base font-semibold disabled:opacity-40"
              >
                {checkinReady ? `Fazer ${CHECKIN_ACTION_NAME}` : 'Ronda em preparo'}
              </Button>
            </section>

            {lastCheckin?.reward && (
              <section className="dungeon-panel bg-card border border-primary/30 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-bottom-1">
                <div className="flex items-center gap-4">
                  <img
                    src={lastCheckin.reward.imageSrc}
                    alt=""
                    className="size-20 rounded border border-primary/35 object-cover"
                    style={{ imageRendering: 'pixelated' }}
                  />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Recompensa da ronda</p>
                  <h4 className="font-bold text-foreground">{rewardTitle(lastCheckin.reward)}</h4>
                  <p className="text-sm text-secondary font-semibold">{lastCheckin.reward.label}</p>
                </div>
              </div>
              <XPBreakdown lines={lastCheckin.reward.xpBreakdown} />
              <p className="text-xs text-muted-foreground">{lastCheckin.message}</p>
            </section>
            )}
          </div>
        )}

        {/* Tab: Explorar */}
        {activeTab === 'explore' && (
          <div className="space-y-4">
            <section className="dungeon-panel gold-frame bg-card border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">Mapa do Reino</p>
                  <h3 className="font-semibold text-foreground">Explorar</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Escolha um destino e avance com dias seguidos de Ritual de Registro. Quanto melhor o saque, mais dias de consistência a expedição exige. Só dá para manter uma expedição por vez; depois de voltar ao castelo, você pode explorar qualquer local disponível de novo.
                  </p>
                </div>
                <span className="shrink-0 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  {currentExploration.completedLocationIds.length} visitado{currentExploration.completedLocationIds.length === 1 ? '' : 's'}
                </span>
              </div>

              <div
                className="relative overflow-hidden rounded-lg border border-primary/35 bg-black"
                onClick={() => {
                  setSelectedLocationId(null)
                  setShowPositionDetails(false)
                }}
              >
                <img
                  src={KINGDOM_MAP_IMAGE_SRC}
                  alt="Mapa do Reino"
                  className="block w-full"
                />
                {activeJourney && (
                  <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line
                      x1={locationById(activeJourney.fromLocationId).x}
                      y1={locationById(activeJourney.fromLocationId).y}
                      x2={locationById(activeJourney.toLocationId).x}
                      y2={locationById(activeJourney.toLocationId).y}
                      stroke="rgba(214,169,51,0.9)"
                      strokeWidth="0.6"
                      strokeDasharray="2 1.2"
                    />
                  </svg>
                )}

                {EXPLORATION_LOCATIONS.map(location => {
                  const completed = currentExploration.completedLocationIds.includes(location.id)
                  const selected = selectedLocationId === location.id
                  const locked = location.id !== CASTLE_LOCATION_ID && character.level < location.minLevel
                  const inRoute = activeJourney?.toLocationId === location.id || activeJourney?.fromLocationId === location.id
                  return (
                    <button
                      key={location.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setShowPositionDetails(false)
                        setSelectedLocationId(location.id)
                      }}
                      className={`absolute z-[2] grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border shadow-lg transition sm:size-8 ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/40'
                          : completed
                            ? 'border-secondary/60 bg-black/75 text-secondary'
                            : locked
                              ? 'border-border bg-black/75 text-muted-foreground'
                              : inRoute
                                ? 'border-secondary bg-secondary text-black'
                                : 'border-primary/50 bg-black/75 text-primary hover:bg-primary hover:text-primary-foreground'
                      }`}
                      style={{ left: `${location.x}%`, top: `${location.y}%` }}
                      aria-label={location.name}
                    >
                      {location.id === CASTLE_LOCATION_ID ? (
                        <Home className="size-3.5" aria-hidden="true" />
                      ) : locked ? (
                        <Lock className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Search className="size-3.5" aria-hidden="true" />
                      )}
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedLocationId(null)
                    setShowPositionDetails(true)
                  }}
                  className="absolute z-[3] flex -translate-x-1/2 -translate-y-full flex-col items-center gap-0.5 text-primary drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
                  style={{ left: `${markerPosition.x}%`, top: `${markerPosition.y}%` }}
                  aria-label="Você está aqui"
                >
                  <span className="rounded border border-primary/45 bg-black/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Você está aqui
                  </span>
                  <MapPin className="size-8 fill-primary text-black sm:size-9" aria-hidden="true" />
                </button>
              </div>

              {activeJourney && (
                <div className="rounded border border-primary/30 bg-primary/10 p-3 text-sm space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-foreground">
                      {activeJourney.returning ? 'Retornando ao castelo' : `Rumo a ${locationById(activeJourney.toLocationId).name}`}
                    </span>
                    <span className="font-bold text-primary">{exploration.progressDays}/{exploration.requiredDays} dia{exploration.requiredDays > 1 ? 's' : ''}</span>
                  </div>
                  <ProgressBar value={exploration.progressDays} max={exploration.requiredDays} colorClass="bg-primary" />
                  <p className="text-xs text-muted-foreground">
                    {activeJourney.returning
                      ? 'A volta leva 1 dia real e não exige Ritual de Registro.'
                      : 'A ida avança apenas com dias em que você fez o Ritual de Registro.'}
                  </p>
                  <Button
                    onClick={handleCompleteExploration}
                    disabled={!exploration.readyToComplete}
                    className="w-full disabled:opacity-40"
                  >
                    {exploration.readyToComplete
                      ? activeJourney.returning ? 'Concluir Retorno' : 'Concluir Exploração'
                      : activeJourney.returning ? 'Caravana em retorno' : 'Ainda viajando'}
                  </Button>
                </div>
              )}
            </section>

            {(selectedLocation || showPositionDetails) && (
              <div
                className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 py-6 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                onClick={() => {
                  setSelectedLocationId(null)
                  setShowPositionDetails(false)
                }}
              >
                <div
                  className="dungeon-panel gold-frame max-h-[88vh] w-full max-w-md overflow-auto rounded-lg border border-primary/45 bg-card p-4 shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                        {showPositionDetails ? 'Posição atual' : 'Ponto de interesse'}
                      </p>
                      <h3 className="mt-1 font-bold text-foreground">
                        {showPositionDetails ? 'Você está aqui' : selectedLocation?.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLocationId(null)
                        setShowPositionDetails(false)
                      }}
                      className="grid size-8 place-items-center rounded border border-border bg-black/35 text-muted-foreground hover:text-foreground"
                      aria-label="Fechar detalhes"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  {showPositionDetails ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-4 rounded border border-primary/30 bg-primary/10 p-3">
                        <div className="grid size-14 place-items-center rounded-full border border-primary/45 bg-black/55 text-primary">
                          <MapPin className="size-8 fill-primary text-black" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{character.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {activeJourney
                              ? activeJourney.returning
                                ? 'Voltando para o Castelo da Guilda.'
                                : `Em rota para ${locationById(activeJourney.toLocationId).name}.`
                              : `No ${locationById(currentExploration.currentLocationId).name}.`}
                          </p>
                        </div>
                      </div>
                      {activeJourney ? (
                        <div className="space-y-2 rounded border border-border bg-black/35 p-3 text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="text-muted-foreground">Progresso</span>
                            <span className="font-bold text-primary">{exploration.progressDays}/{exploration.requiredDays} dia{exploration.requiredDays > 1 ? 's' : ''}</span>
                          </div>
                          <ProgressBar value={exploration.progressDays} max={exploration.requiredDays} colorClass="bg-primary" />
                        </div>
                      ) : (
                        <p className="rounded border border-border bg-black/35 p-3 text-sm text-muted-foreground">
                          O personagem está parado e pronto para iniciar uma nova exploração a partir do castelo quando estiver disponível.
                        </p>
                      )}
                    </div>
                  ) : selectedLocation && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm leading-relaxed text-muted-foreground">{selectedLocation.description}</p>
                      {currentExploration.completedLocationIds.includes(selectedLocation.id) && selectedLocation.id !== CASTLE_LOCATION_ID && (
                        <p className="rounded border border-secondary/30 bg-secondary/10 p-3 text-xs text-muted-foreground">
                          Este local já foi visitado antes, mas pode ser explorado novamente depois que o personagem estiver de volta ao castelo.
                        </p>
                      )}
                      <div className="flex items-center justify-between rounded border border-border bg-black/35 p-3 text-sm">
                        <span className="text-muted-foreground">Requisito</span>
                        <span className="font-bold text-foreground">Nível {selectedLocation.minLevel}+</span>
                      </div>

                      {selectedLocation.id === CASTLE_LOCATION_ID ? (
                        <p className="rounded border border-border bg-black/35 p-3 text-sm text-muted-foreground">
                          O castelo é o ponto de partida e retorno de todas as expedições.
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded border border-border bg-black/35 p-2">
                              <img src={XP_REWARD_IMAGE_SRC} alt="" className="mx-auto mb-1 size-10 rounded object-cover" style={{ imageRendering: 'pixelated' }} />
                              <p className="text-muted-foreground">XP</p>
                              <p className="font-bold text-secondary">+{Math.round(selectedLocation.xpBase + explorationLevelXPPreview + explorationWisdomXPPreview)}</p>
                            </div>
                            <div className="rounded border border-border bg-black/35 p-2">
                              <p className="mb-1 text-muted-foreground">Dias</p>
                              <p className="text-lg font-bold text-primary">{selectedLocation.requiredDays}</p>
                            </div>
                            <div className="rounded border border-border bg-black/35 p-2">
                              <img
                                src={selectedLocation.lootKind === 'equipment' ? EQUIPMENT_SLOTS.armor.imageSrc : CONSUMABLE_ITEMS.pocao_pequena.imageSrc}
                                alt=""
                                className="mx-auto mb-1 size-10 rounded object-cover"
                                style={{ imageRendering: 'pixelated' }}
                              />
                              <p className="text-muted-foreground">Drop</p>
                              <p className="font-bold text-primary">{Math.round(selectedLocation.dropChance * 100)}%</p>
                            </div>
                          </div>

                          <div className="rounded border border-border bg-black/35 p-3 text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">XP do local</span>
                              <span className="font-semibold text-secondary">+{selectedLocation.xpBase}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bônus de nível ({character.level} x 5)</span>
                              <span className="font-semibold text-primary">+{explorationLevelXPPreview}</span>
                            </div>
                            {explorationWisdomXPPreview > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bônus de Sabedoria ({effectiveAttributes.sabedoria})</span>
                                <span className="font-semibold text-primary">+{explorationWisdomXPPreview}</span>
                              </div>
                            )}
                          </div>

                          <p className="rounded border border-primary/30 bg-primary/10 p-3 text-xs text-muted-foreground">
                            Pode render {selectedLocation.lootKind === 'equipment' ? '1 equipamento aleatório' : '1 poção'}; se o item não vier, ganha ouro no Baú. A ida exige Ritual de Registro em sequência.
                          </p>

                          {(() => {
                            const allowed = canExploreLocation(character, selectedLocation.id)
                            return (
                              <Button
                                onClick={() => handleStartExploration(selectedLocation.id)}
                                disabled={!allowed.ok}
                                className="w-full py-3 disabled:opacity-40"
                              >
                                {allowed.ok ? `Explorar ${selectedLocation.name}` : allowed.reason}
                              </Button>
                            )
                          })()}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentExploration.lastReward && (
              <section className="dungeon-panel bg-card border border-primary/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-4">
                  <img
                    src={currentExploration.lastReward.imageSrc}
                    alt=""
                    className="size-20 rounded border border-primary/35 object-cover"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">Última exploração</p>
                    <h4 className="font-bold text-foreground">{explorationRewardTitle(currentExploration.lastReward)}</h4>
                    <p className="text-sm text-secondary font-semibold">
                      {currentExploration.lastReward.label} · +{currentExploration.lastReward.xpGained} XP
                    </p>
                  </div>
                </div>
                <XPBreakdown lines={currentExploration.lastReward.xpBreakdown} />
              </section>
            )}
          </div>
        )}

        {/* Tab: Batalha */}
        {activeTab === 'battle' && (
          <div className="space-y-4">
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Arena da Masmorra</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Você tem até 5 cargas de batalha. Cada luta gasta 1 carga e a arena recupera 1 por hora. Perder uma luta tira vida real e pode derrubar o personagem se ele entrar fraco.
                  </p>
                </div>
                <span className="shrink-0 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  {battleCharges.current}/{battleCharges.max} cargas
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-black/35 border border-border rounded p-2">
                  <p className="text-muted-foreground">Ataque</p>
                  <p className="font-bold text-foreground">{Math.round(character.level * 5 + effectiveAttributes.vigor + effectiveAttributes.disciplina + effectiveAttributes.sabedoria)}</p>
                </div>
                <div className="bg-black/35 border border-border rounded p-2">
                  <p className="text-muted-foreground">Vida</p>
                  <p className="font-bold text-foreground">{character.life}/{character.maxLife}</p>
                </div>
                <div className="bg-black/35 border border-border rounded p-2">
                  <p className="text-muted-foreground">Risco</p>
                  <p className="font-bold text-destructive">-{maxBattleLoss} vida</p>
                </div>
              </div>

              <div className="rounded border border-primary/25 bg-primary/10 p-3 text-xs text-muted-foreground">
                {battleCharges.current >= battleCharges.max
                  ? 'Energia da arena cheia.'
                  : `Próxima carga em ${formatDuration(battleCharges.remainingMs)}.`}
                <span className="ml-1">Batalhas feitas hoje: {battleCount}.</span>
              </div>

              <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-muted-foreground">
                Em derrota, você pode perder até <span className="font-bold text-destructive">{maxBattleLoss} de vida real</span>. Se sua vida atual não segurar isso, existe risco de queda.
              </div>

              <Button
                onClick={handleBattle}
                disabled={battleCharges.current <= 0 || character.life <= 0 || Boolean(activeBattle)}
                className="w-full py-3 disabled:opacity-40"
              >
                {battleCharges.current <= 0 ? 'Aguardando recarga' : character.life <= 0 ? 'Sem vida para lutar' : 'Iniciar Batalha'}
              </Button>
            </section>

            {lastBattle && (
              <section className="dungeon-panel bg-card border border-border rounded-lg p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">Última batalha</p>
                    <p className="text-xs text-muted-foreground">{lastBattle.message}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    setVisibleBattleRounds(0)
                    setBattleScreenOpen(true)
                  }}>
                    Rever
                  </Button>
                </div>
              </section>
            )}
          </div>
        )}

        {/* Tab: Inventário */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Itens Consumíveis</h3>
              {(character.inventory ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item no inventário.</p>
              ) : (
                <div className="space-y-2">
                  {(character.inventory ?? []).map(item => {
                    const def = CONSUMABLE_ITEMS[item.itemId]
                    return (
                      <div key={item.itemId} className="flex items-center justify-between gap-3 rounded border border-border bg-black/35 p-3 text-sm">
                        <div className="flex items-center gap-3">
                          <img
                            src={def.imageSrc}
                            alt=""
                            className="size-12 rounded border border-primary/25 object-cover"
                            style={{ imageRendering: 'pixelated' }}
                          />
                          <div>
                            <p className="font-semibold text-foreground">{def.name} x{item.quantity}</p>
                            <p className="text-xs text-muted-foreground">{def.description}</p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => handleUseConsumable(item.itemId)}>
                          Usar
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Equipamentos</h3>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                {(Object.keys(EQUIPMENT_SLOTS) as EquipmentSlot[]).map(slot => {
                  const level = character.equipmentLevels?.[slot] ?? 0
                  const slotDef = EQUIPMENT_SLOTS[slot]
                  const name = slot === 'weapon' ? weaponNameForClass(character.class) : slotDef.baseName
                  const imageSrc = slot === 'weapon' ? weaponImageForClass(character.class) : slotDef.imageSrc
                  return (
                    <div key={slot} className="rounded border border-border bg-black/35 p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={imageSrc}
                          alt=""
                          className="size-14 rounded border border-primary/25 object-cover"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        <div>
                          <p className="font-semibold text-foreground">{name}</p>
                          <p className="text-xs text-muted-foreground">Nível {level}/10</p>
                          <p className="text-xs text-primary mt-1">
                            +{equipmentBonusValue(level)} {slot === 'weapon' ? (character.class === 'mago' ? 'sabedoria' : character.class === 'ladino' ? 'disciplina' : 'vigor') : slotDef.attribute}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {/* Tab: Loja */}
        {activeTab === 'shop' && (
          <div className="space-y-4">
            <div className="dungeon-panel border border-primary/30 rounded-lg p-3 text-sm flex justify-between">
              <span className="text-muted-foreground">Ouro no Baú</span>
              <span className="font-bold text-primary">R$ {(character.goldChest ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>

            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Poções</h3>
              <div className="space-y-2">
                {(Object.keys(CONSUMABLE_ITEMS) as ConsumableItemId[]).map(itemId => {
                  const item = CONSUMABLE_ITEMS[itemId]
                  return (
                    <div key={itemId} className="flex items-center justify-between gap-3 rounded border border-border bg-black/35 p-3 text-sm">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.imageSrc}
                          alt=""
                          className="size-12 rounded border border-primary/25 object-cover"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        <div>
                          <p className="font-semibold text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleBuyConsumable(itemId)}>
                        R$ {item.price}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Forja de Equipamentos</h3>
              <div className="space-y-2">
                {(Object.keys(EQUIPMENT_SLOTS) as EquipmentSlot[]).map(slot => {
                  const current = character.equipmentLevels?.[slot] ?? 0
                  const next = current + 1
                  const slotDef = EQUIPMENT_SLOTS[slot]
                  const name = slot === 'weapon' ? weaponNameForClass(character.class) : slotDef.baseName
                  const imageSrc = slot === 'weapon' ? weaponImageForClass(character.class) : slotDef.imageSrc
                  const attr = slot === 'weapon' ? (character.class === 'mago' ? 'sabedoria' : character.class === 'ladino' ? 'disciplina' : 'vigor') : slotDef.attribute
                  return (
                    <div key={slot} className="flex items-center justify-between gap-3 rounded border border-border bg-black/35 p-3 text-sm">
                      <div className="flex items-center gap-3">
                        <img
                          src={imageSrc}
                          alt=""
                          className="size-12 rounded border border-primary/25 object-cover"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        <div>
                          <p className="font-semibold text-foreground">{name}</p>
                          <p className="text-xs text-muted-foreground">Atual Nv. {current}/10 · próximo dá +{equipmentBonusValue(next)} {attr}</p>
                        </div>
                      </div>
                      <Button size="sm" disabled={current >= 10} onClick={() => handleBuyEquipment(slot)}>
                        {current >= 10 ? 'Máx.' : `R$ ${equipmentPrice(next)}`}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {/* Tab: Atributos */}
        {activeTab === 'attributes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Cada atributo melhora um aspecto do personagem. Ganhe 1 ponto a cada nível.
              </p>
              {character.attributePoints > 0 && (
                <span className="text-xs bg-secondary/20 border border-secondary/40 text-foreground font-semibold px-2 py-1 rounded">
                  {character.attributePoints} pt{character.attributePoints > 1 ? 's' : ''} livres
                </span>
              )}
            </div>

            {ATTRIBUTE_DEFINITIONS.map((def) => {
              const value = character.attributes[def.key]
              const equipmentValue = equipmentAttributes[def.key]
              const totalValue = effectiveAttributes[def.key]
              const isExpanded = tooltipAttr === def.key
              return (
                <div key={def.key} className="dungeon-panel bg-card border border-border rounded-lg overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">{def.name}</p>
                          <button
                            onClick={() => setTooltipAttr(isExpanded ? null : def.key)}
                            className="text-xs text-muted-foreground hover:text-primary transition"
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">{def.financialName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xl font-bold text-foreground">{totalValue}</p>
                          {equipmentValue > 0 && (
                            <p className="text-[0.65rem] text-primary">{value} + {equipmentValue} equip.</p>
                          )}
                        </div>
                        {character.attributePoints > 0 && (
                          <button
                            onClick={() => handleAddPoint(def.key)}
                            className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/80 transition flex items-center justify-center"
                            aria-label={`Adicionar ponto em ${def.name}`}
                          >
                            +
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Visual bar for current level */}
                    <div className="mt-2 flex gap-1">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${i < Math.min(10, totalValue) ? 'bg-primary' : 'bg-muted'}`} />
                      ))}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-border bg-muted/20 text-sm space-y-2">
                      <p className="text-muted-foreground leading-relaxed">{def.description}</p>
                      <div className="bg-card border border-border rounded p-2">
                        <p className="text-xs font-semibold text-foreground">Efeito:</p>
                        <p className="text-xs text-muted-foreground">{def.effect}</p>
                      </div>
                      <p className="text-xs text-muted-foreground italic">Bom para: {def.goodFor}</p>
                    </div>
                  )}
                </div>
              )
            })}

            <div className="bg-black/35 border border-border rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Como ganhar pontos?</p>
              <p>A cada novo nível, o personagem ganha 1 ponto de atributo para distribuir livremente.</p>
            </div>
          </div>
        )}

        {/* Tab: Reino */}
        {activeTab === 'realm' && (
          <div className="space-y-4">
            <section className="dungeon-panel bg-card border border-primary/25 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide flex items-center gap-2">
                    <ScrollText className="size-4 text-primary" aria-hidden="true" />
                    Contratos Semanais
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Desafios maiores da guilda. Resgate XP quando concluir.</p>
                </div>
                <span className="shrink-0 rounded border border-border bg-black/35 px-2 py-1 text-xs text-muted-foreground">
                  Semana {new Date(`${weeklyContractState.weekKey}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>

              <div className="space-y-2">
                {weeklyContractState.contracts.map(contract => (
                  <div key={contract.id} className="rounded border border-border bg-black/35 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`font-semibold ${contract.completed ? 'text-primary' : 'text-foreground'}`}>{contract.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{contract.description}</p>
                      </div>
                      <span className="shrink-0 rounded border border-secondary/30 bg-secondary/10 px-2 py-0.5 text-xs font-bold text-secondary">
                        +{contract.xpReward} XP
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <ProgressBar value={contract.progress} max={contract.target} colorClass={contract.completed ? 'bg-primary' : 'bg-secondary'} />
                        <p className="mt-1 text-[11px] text-muted-foreground">{contract.progress}/{contract.target}</p>
                      </div>
                      {contract.completed ? (
                        <Button size="sm" disabled={contract.claimed} onClick={() => handleClaimWeekly(contract.id)}>
                          {contract.claimed ? 'Resgatado' : 'Resgatar'}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleActionTarget(contract.actionTarget)}>
                          Ir
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="size-4 text-primary" aria-hidden="true" />
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Títulos</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {titleViews.map(title => (
                  <div key={title.id} className={`rounded border p-3 text-sm ${title.unlocked ? 'border-primary/30 bg-primary/10' : 'border-border bg-black/35 opacity-75'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{title.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{title.description}</p>
                      </div>
                      {title.equipped && <span className="rounded border border-primary/40 px-2 py-0.5 text-[11px] font-bold text-primary">ativo</span>}
                    </div>
                    <Button
                      size="sm"
                      variant={title.equipped ? 'outline' : 'default'}
                      className="mt-3 w-full"
                      disabled={!title.unlocked || title.equipped}
                      onClick={() => handleEquipTitle(title.id)}
                    >
                      {!title.unlocked ? 'Bloqueado' : title.equipped ? 'Equipado' : 'Equipar'}
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Eventos Financeiros</h3>
              </div>
              <div className="space-y-2">
                {financialEvents.map(event => (
                  <div key={event.id} className={`rounded border p-3 text-sm ${
                    event.severity === 'danger'
                      ? 'border-destructive/35 bg-destructive/10'
                      : event.severity === 'warning'
                      ? 'border-secondary/35 bg-secondary/10'
                      : event.severity === 'good'
                      ? 'border-primary/35 bg-primary/10'
                      : 'border-border bg-black/35'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{event.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(`${event.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4 text-primary" aria-hidden="true" />
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Códice do Reino</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {codexEntries.filter(entry => entry.unlocked).length}/{codexEntries.length}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {codexEntries.map(entry => (
                  <div key={entry.id} className={`rounded border p-3 text-sm ${entry.unlocked ? 'border-border bg-black/35' : 'border-border bg-black/25 opacity-60'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">{entry.unlocked ? entry.name : '???'}</p>
                      <span className="rounded border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">{entry.kind}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Tab: Histórico */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Log Geral</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Eventos importantes para auditar dano, esquecimentos, recuperações e mortes.
                  </p>
                </div>
                <span className="shrink-0 rounded border border-border bg-black/35 px-2 py-1 text-xs text-muted-foreground">
                  Mortes: {character.deathCount ?? 0}
                </span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {([
                  ['all', 'Todos'],
                  ['missed_day', 'Esquecimentos'],
                  ['damage', 'Danos'],
                  ['death', 'Mortes'],
                  ['regen', 'Curas'],
                  ['boss_ready', 'Boss'],
                  ['system', 'Sistema'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setHistoryFilter(key)}
                    className={`shrink-0 rounded border px-2 py-1 text-xs font-semibold ${
                      historyFilter === key
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border bg-black/35 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(character.eventLog ?? []).length === 0 ? (
                <p className="rounded border border-border bg-black/35 p-3 text-sm text-muted-foreground">
                  Nenhum evento importante registrado ainda.
                </p>
              ) : filteredEventLog.length === 0 ? (
                <p className="rounded border border-border bg-black/35 p-3 text-sm text-muted-foreground">
                  Nenhum evento encontrado para este filtro.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredEventLog.slice(0, 25).map(entry => (
                    <div key={entry.id} className="rounded border border-border bg-black/35 p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${eventLogColor(entry.type)}`}>
                          {eventLogLabel(entry.type)}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(entry.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="mt-2 text-foreground">{entry.message}</p>
                      {(entry.damage !== undefined || entry.lifeAfter !== undefined) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {entry.damage !== undefined ? `Dano: ${entry.damage}` : ''}
                          {entry.damage !== undefined && entry.lifeAfter !== undefined ? ' · ' : ''}
                          {entry.lifeAfter !== undefined ? `Vida depois: ${entry.lifeAfter}` : ''}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {character.cycleHistory.length === 0 ? (
              <div className="dungeon-panel bg-card border border-border rounded-lg p-8 text-center">
                <p className="font-semibold text-foreground mb-1">Sem histórico ainda</p>
                <p className="text-sm text-muted-foreground">
                  O histórico dos ciclos anteriores aparecerá aqui após o Boss Final.
                </p>
              </div>
            ) : (
              character.cycleHistory.map((cycle, i) => {
                const resultLabels: Record<string, string> = {
                  defeat: 'Derrota',
                  survived: 'Sobreviveu',
                  victory: 'Vitória',
                  epic: 'Vitória Épica',
                  legendary: 'Vitória Lendária',
                }
                const resultColors: Record<string, string> = {
                  defeat: 'text-destructive',
                  survived: 'text-muted-foreground',
                  victory: 'text-primary',
                  epic: 'text-secondary',
                  legendary: 'text-primary',
                }
                return (
                  <div key={i} className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground text-sm">
                        Ciclo {new Date(cycle.cycleStart).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                      </p>
                      <span className={`text-sm font-bold ${resultColors[cycle.result]}`}>
                        {resultLabels[cycle.result]}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Tesouro Máximo</span><span className="font-medium text-foreground">R$ {cycle.maxTreasure.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Ouro Consumido</span><span className="font-medium text-foreground">R$ {cycle.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Ouro Preservado</span><span className={`font-medium ${cycle.goldPreserved > 0 ? 'text-primary' : 'text-destructive'}`}>R$ {cycle.goldPreserved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">XP ganho</span><span className="font-medium text-secondary">+{cycle.xpTotal} XP</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Dias registrados</span><span className="font-medium text-foreground">{cycle.daysRegistered}/{cycle.daysTotal}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Melhor Combo</span><span className="font-medium text-foreground">{cycle.bestCombo} dias</span></div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
