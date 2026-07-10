'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  type Character,
  type ConsumableItemId,
  type EquipmentSlot,
  CLASSES,
  CONSUMABLE_ITEMS,
  EQUIPMENT_SLOTS,
  GOLD_REWARD_IMAGE_SRC,
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
import {
  type BattleResult,
  battlesToday,
  buyConsumable,
  buyEquipmentUpgrade,
  maxBattleDamageOnDefeat,
  performBattle,
  updateJourneyMarker,
  useConsumable,
} from '@/lib/game-engine'

interface CharacterDetailPageProps {
  character: Character
  onBack: () => void
  onUpdateCharacter: (updated: Character) => void
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

export default function CharacterDetailPage({ character, onBack, onUpdateCharacter, onOpenRitual }: CharacterDetailPageProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'battle' | 'inventory' | 'shop' | 'attributes' | 'history'>('stats')
  const [tooltipAttr, setTooltipAttr] = useState<string | null>(null)
  const [editingMarker, setEditingMarker] = useState(false)
  const [markerValue, setMarkerValue] = useState(String(character.journeyMarker))
  const [showNextEvolution, setShowNextEvolution] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [lastBattle, setLastBattle] = useState<BattleResult | null>(null)
  const [battleScreenOpen, setBattleScreenOpen] = useState(false)
  const [visibleBattleRounds, setVisibleBattleRounds] = useState(0)

  const classDef = CLASSES.find(c => c.id === character.class)!
  const currentClassImage = classImageForLevel(classDef, character.level)
  const nextClassImage = nextClassImageStage(classDef, character.level)
  const effectiveAttributes = calcEffectiveAttributes(character)
  const equipmentAttributes = calcEquipmentAttributes(character)
  const battleCount = battlesToday(character)
  const maxBattleLoss = maxBattleDamageOnDefeat(character)
  const ouroConsumido = calcOuroConsumido(character)
  const daysInCycle = calcDaysInCycle(character.cycleStart, character.cycleEnd)
  const daysLeft = calcDaysLeft(character.cycleEnd)
  const quota = calcJourneyQuota(character.maxTreasure, character.journeyMarker, daysInCycle)
  const ouroPreservado = Math.max(0, character.maxTreasure - ouroConsumido)
  const spentPct = character.maxTreasure > 0 ? Math.min(100, Math.round((ouroConsumido / character.maxTreasure) * 100)) : 0
  const lifePct = character.maxLife > 0 ? Math.min(100, Math.round((character.life / character.maxLife) * 100)) : 0

  // Determine status color
  const getSpentColor = () => {
    if (spentPct >= 100) return 'text-destructive'
    if (spentPct >= 80) return 'text-secondary'
    return 'text-primary'
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

  const tabs = [
    { key: 'stats', label: 'Ficha' },
    { key: 'battle', label: 'Batalha' },
    { key: 'inventory', label: 'Inventário' },
    { key: 'shop', label: 'Loja' },
    { key: 'attributes', label: 'Atributos' },
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

  const handleBattle = () => {
    const result = performBattle(character)
    onUpdateCharacter(result.character)
    setLastBattle(result)
    setVisibleBattleRounds(0)
    setBattleScreenOpen(result.rounds.length > 0)
    const loot = [
      result.xpGained > 0 ? `+${result.xpGained} XP` : '',
      result.goldGained > 0 ? `+R$ ${result.goldGained.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no Baú` : '',
      result.itemGained ? `Item: ${CONSUMABLE_ITEMS[result.itemGained].name}` : '',
      result.damageTaken > 0 ? `-${result.damageTaken} vida` : '',
    ].filter(Boolean).join(' · ')
    setActionMessage(`${result.message}${loot ? ` ${loot}` : ''}`)
  }

  const handleBuyConsumable = (itemId: ConsumableItemId) => {
    const result = buyConsumable(character, itemId)
    onUpdateCharacter(result.character)
    setActionMessage(result.message)
    setLastBattle(null)
    setBattleScreenOpen(false)
  }

  const handleUseConsumable = (itemId: ConsumableItemId) => {
    const result = useConsumable(character, itemId)
    onUpdateCharacter(result.character)
    setActionMessage(result.message)
    setLastBattle(null)
    setBattleScreenOpen(false)
  }

  const handleBuyEquipment = (slot: EquipmentSlot) => {
    const result = buyEquipmentUpgrade(character, slot)
    onUpdateCharacter(result.character)
    setActionMessage(result.message)
    setLastBattle(null)
    setBattleScreenOpen(false)
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
                  <span className="text-muted-foreground">Sua vida temporária</span>
                  <span className="text-foreground font-semibold">{shownPlayerHp}/{lastBattle.playerBattleHpStart}</span>
                </div>
                <ProgressBar value={shownPlayerHp} max={lastBattle.playerBattleHpStart} colorClass={shownPlayerHp <= 0 ? 'bg-destructive' : 'bg-primary'} />
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
                    Você {round.playerHp} HP temp · Monstro {round.monsterHp} HP
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
                </div>
                {lastBattle.damageTaken > 0 && (
                  <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm">
                    <p className="font-semibold text-destructive">Dano real sofrido</p>
                    <p className="text-xs text-muted-foreground">-{lastBattle.damageTaken} vida</p>
                  </div>
                )}
              </div>
              <Button className="w-full" onClick={() => setBattleScreenOpen(false)}>
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
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-medium">
            Nv. {character.level}
          </span>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Hero card */}
        <div className="dungeon-panel gold-frame bg-card border border-border rounded-lg p-5 space-y-4">
          {/* Class art */}
          <button
            type="button"
            onClick={() => nextClassImage && setShowNextEvolution(prev => !prev)}
            className="relative block w-full overflow-hidden rounded-lg border border-primary/35 bg-black/45 text-left"
            aria-label={nextClassImage ? `Ver prévia da evolução ${nextClassImage.label}` : 'Arte final do personagem'}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(214,169,51,0.16),transparent_58%)]" />
            <img
              src={currentClassImage.src}
              alt={`${classDef.name} ${currentClassImage.label}`}
              className="relative mx-auto aspect-square w-full max-h-[360px] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
            {nextClassImage && showNextEvolution && (
              <img
                src={nextClassImage.src}
                alt={`${classDef.name} ${nextClassImage.label}`}
                className="absolute inset-0 mx-auto aspect-square h-full w-full object-contain opacity-55 mix-blend-screen"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <span className="rounded border border-primary/40 bg-black/70 px-2 py-1 text-xs font-bold text-primary">
                Aparência {currentClassImage.label}
              </span>
              {nextClassImage && (
                <span className="rounded border border-border bg-black/70 px-2 py-1 text-xs text-muted-foreground">
                  {showNextEvolution ? `Prévia ${nextClassImage.label}` : `Toque para ver ${nextClassImage.label}`}
                </span>
              )}
            </div>
          </button>

          {/* Name + level title */}
          <div>
            <h1 className="text-xl font-bold text-foreground">{character.name}</h1>
            <p className="text-sm text-muted-foreground">{levelTitle(character.level)} · {classDef.name}</p>
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

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto border-b border-border pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
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
                    Cota de Jornada (por dia)
                    <InfoTooltip text="Quanto você poderia gastar por dia para permanecer dentro do limite até o final do ciclo." />
                  </span>
                  <span className="font-bold text-secondary">
                    R$ {quota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
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

            {/* Habilidade especial */}
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Habilidade Especial</h3>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-primary text-sm">{classDef.specialName}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{classDef.specialDescription}</p>
                </div>
                <span className={`shrink-0 text-xs px-2 py-1 rounded font-medium ${character.specialUsed ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary border border-primary/30'}`}>
                  {character.specialUsed ? 'Usada' : 'Disponível'}
                </span>
              </div>
            </section>

            {/* Registros recentes */}
            {character.dailyRecords.length > 0 && (
              <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Registros Recentes</h3>
                <div className="space-y-2">
                  {[...character.dailyRecords].reverse().slice(0, 5).map((record, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{new Date(record.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                      <span className="font-semibold text-foreground">
                        R$ {record.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-secondary font-medium">+{record.xpGained} XP</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CTA Ritual */}
            {(() => {
              const today = new Date().toISOString().split('T')[0]
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

        {/* Tab: Batalha */}
        {activeTab === 'battle' && (
          <div className="space-y-4">
            <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Arena da Masmorra</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Até 3 batalhas por dia. Mantenha a vida alta fazendo seus registros em dia: perder uma luta tira vida real e pode derrubar o personagem se ele entrar fraco.
                  </p>
                </div>
                <span className="shrink-0 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                  {battleCount}/3 hoje
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

              <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-muted-foreground">
                Em derrota, você pode perder até <span className="font-bold text-destructive">{maxBattleLoss} de vida real</span>. Se sua vida atual não segurar isso, existe risco de queda.
              </div>

              <Button
                onClick={handleBattle}
                disabled={battleCount >= 3 || character.life <= 0}
                className="w-full py-3 disabled:opacity-40"
              >
                {battleCount >= 3 ? 'Limite diário atingido' : character.life <= 0 ? 'Sem vida para lutar' : 'Iniciar Batalha'}
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

        {/* Tab: Histórico */}
        {activeTab === 'history' && (
          <div className="space-y-4">
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
