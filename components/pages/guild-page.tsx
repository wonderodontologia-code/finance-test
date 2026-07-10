'use client'

import { useRef } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  type Character,
  CLASSES,
  classImageForLevel,
  calcOuroConsumido,
  calcJourneyQuota,
  calcDaysInCycle,
  calcDaysLeft,
  levelTitle,
} from '@/lib/types'

interface GuildPageProps {
  characters: Character[]
  userName?: string
  onAddCharacter: () => void
  onSelectCharacter: (id: string) => void
  onOpenRitual: (id: string) => void
  onRenameCharacter: (id: string) => void
  onDeleteCharacter: (id: string) => void
  onExportBackup: () => void
  onImportBackup: (file: File) => void
  onLogout?: () => void
}

function ProgressBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="w-full bg-muted rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function CharacterCard({
  character,
  onSelect,
  onRitual,
  onRename,
  onDelete,
}: {
  character: Character
  onSelect: () => void
  onRitual: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const classDef = CLASSES.find(c => c.id === character.class)!
  const classImage = classImageForLevel(classDef, character.level)
  const ouroConsumido = calcOuroConsumido(character)
  const daysInCycle = calcDaysInCycle(character.cycleStart, character.cycleEnd)
  const daysLeft = calcDaysLeft(character.cycleEnd)
  const quota = calcJourneyQuota(character.maxTreasure, character.journeyMarker, daysInCycle)
  const spentPct = character.maxTreasure > 0 ? Math.min(100, Math.round((ouroConsumido / character.maxTreasure) * 100)) : 0
  const lifePct = character.maxLife > 0 ? Math.min(100, Math.round((character.life / character.maxLife) * 100)) : 0

  const today = new Date().toISOString().split('T')[0]
  const registeredToday = character.dailyRecords.some(r => r.date === today)

  const isAtRisk = spentPct >= 80
  const isLowLife = lifePct <= 30

  const getStatusMessage = () => {
    if (ouroConsumido > character.maxTreasure) return { text: 'Ferida Financeira — limite ultrapassado.', danger: true }
    if (daysLeft <= 3 && spentPct < 100) return { text: 'Boss Final se aproxima. O cofre ainda resiste.', danger: false }
    if (isAtRisk) return { text: 'Cuidado. O Boss Final está ficando mais forte.', danger: true }
    if (isLowLife) return { text: 'A névoa do esquecimento atingiu teu guardião.', danger: true }
    if (character.combo >= 7) return { text: `Combo de Disciplina ativo — ${character.combo} dias seguidos!`, danger: false }
    return { text: 'Teu guardião aguarda o próximo Ritual de Registro.', danger: false }
  }

  const status = getStatusMessage()

  return (
    <div className={`dungeon-panel rounded-lg border overflow-hidden transition hover:-translate-y-0.5 hover:border-primary/50 ${isAtRisk || isLowLife ? 'gold-frame border-accent/60' : 'border-border'}`}>
      {/* Card header */}
      <button onClick={onSelect} className="w-full p-4 text-left hover:bg-primary/5 transition">
        <div className="flex items-start gap-3 mb-3">
          <div className="relative shrink-0 w-20 h-24 rounded-md border border-primary/35 bg-black/45 overflow-hidden shadow-inner shadow-black/50">
            <div className="absolute inset-x-2 bottom-1 h-5 rounded-full bg-primary/15 blur-sm" />
            <img
              src={classImage.src}
              alt={`${classDef.name} ${classImage.label}`}
              className="relative z-[1] h-full w-full object-contain p-1 [image-rendering:pixelated]"
            />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="font-bold text-foreground truncate">{character.name}</p>
            <p className="text-xs text-muted-foreground">{classDef.name} · {character.category}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-primary/85">{classImage.label}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-bold text-foreground">Nv. {character.level}</p>
            <p className="text-xs text-muted-foreground">{levelTitle(character.level)}</p>
            {(character.deathCount ?? 0) > 0 && (
              <p className="mt-1 text-[11px] font-semibold text-destructive">Mortes: {character.deathCount}</p>
            )}
          </div>
        </div>

        {/* Vida */}
        <div className="space-y-1 mb-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Vida</span>
            <span className={`font-semibold ${isLowLife ? 'text-destructive' : 'text-foreground'}`}>{character.life}/{character.maxLife}</span>
          </div>
          <ProgressBar value={character.life} max={character.maxLife} colorClass={lifePct <= 30 ? 'bg-destructive' : lifePct <= 60 ? 'bg-secondary' : 'bg-primary'} />
        </div>

        {/* XP */}
        <div className="space-y-1 mb-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">XP</span>
            <span className="font-semibold text-foreground">{character.xp}/{character.xpToNextLevel}</span>
          </div>
          <ProgressBar value={character.xp} max={character.xpToNextLevel} colorClass="bg-secondary" />
        </div>

        {/* Ouro Consumido */}
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Ouro Consumido</span>
            <span className={`font-semibold ${isAtRisk ? 'text-destructive' : 'text-foreground'}`}>
              R$ {ouroConsumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / R$ {character.maxTreasure.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <ProgressBar value={ouroConsumido} max={character.maxTreasure} colorClass={spentPct >= 100 ? 'bg-destructive' : spentPct >= 80 ? 'bg-secondary' : 'bg-primary'} />
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Cota: <span className="font-semibold text-secondary">R$ {quota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/dia</span>
          </span>
          <span>
            {daysLeft > 0 ? (
              <span className={daysLeft <= 5 ? 'text-destructive font-semibold' : ''}>
                {daysLeft} dias restantes
              </span>
            ) : (
              <span className="text-accent font-semibold">Boss Final!</span>
            )}
          </span>
        </div>

        {/* Combo badge */}
        {character.combo >= 3 && (
          <div className="mt-2">
            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${character.combo >= 14 ? 'bg-primary/15 text-primary border border-primary/40' : character.combo >= 7 ? 'bg-secondary/20 text-foreground border border-secondary/40' : 'bg-primary/10 text-primary border border-primary/30'}`}>
              Combo {character.combo} dias
            </span>
          </div>
        )}

        {/* Attribute points available */}
        {character.attributePoints > 0 && (
          <div className="mt-2">
            <span className="text-xs px-2 py-0.5 rounded font-semibold bg-secondary/20 text-foreground border border-secondary/40">
              {character.attributePoints} ponto{character.attributePoints > 1 ? 's' : ''} de atributo disponível{character.attributePoints > 1 ? 'is' : ''}
            </span>
          </div>
        )}

        {/* Status message */}
        <p className={`mt-3 text-xs italic ${status.danger ? 'text-destructive' : 'text-muted-foreground'}`}>
          {status.text}
        </p>
      </button>

      {/* Action */}
      <div className="px-4 pb-4 space-y-2">
        <Button
          onClick={(e) => { e.stopPropagation(); onRitual() }}
          className={`w-full text-sm ${registeredToday ? 'bg-muted text-foreground border border-border hover:bg-muted/80' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
          size="sm"
        >
          {registeredToday ? 'Editar Registro de Hoje' : 'Ritual de Registro'}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRename() }}
            className="gap-2"
          >
            <Pencil className="size-4" aria-hidden="true" />
            Renomear
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Deletar
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function GuildPage({
  characters = [],
  userName = 'Aventureiro',
  onAddCharacter,
  onSelectCharacter,
  onOpenRitual,
  onRenameCharacter,
  onDeleteCharacter,
  onExportBackup,
  onImportBackup,
  onLogout,
}: GuildPageProps) {
  const importInputRef = useRef<HTMLInputElement>(null)
  const totalOuro = characters.reduce((sum, c) => sum + calcOuroConsumido(c), 0)
  const totalMax = characters.reduce((sum, c) => sum + c.maxTreasure, 0)
  const totalXP = characters.reduce((sum, c) => sum + c.xp, 0)
  const atRisk = characters.filter(c => {
    const pct = c.maxTreasure > 0 ? calcOuroConsumido(c) / c.maxTreasure : 0
    return pct >= 0.8
  }).length
  const lowLife = characters.filter(c => c.maxLife > 0 && c.life / c.maxLife <= 0.3).length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-black/75 border-b border-primary/25 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="rpg-title text-xl font-bold">Guilda do Cofre</h1>
            <p className="text-xs text-muted-foreground">Bem-vindo, {userName}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) onImportBackup(file)
                event.currentTarget.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExportBackup}
            >
              Exportar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
            >
              Importar
            </Button>
            {onLogout && (
              <button onClick={onLogout} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">
                Sair
              </button>
            )}
            <Button
              onClick={onAddCharacter}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              + Novo Personagem
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Summary bar — só aparece quando há personagens */}
        {characters.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="dungeon-panel border border-border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Personagens</p>
              <p className="text-xl font-bold text-foreground">{characters.length}</p>
            </div>
            <div className="dungeon-panel border border-border rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">XP Total</p>
              <p className="text-xl font-bold text-secondary">{totalXP}</p>
            </div>
            <div className={`dungeon-panel border rounded-lg p-3 text-center ${atRisk > 0 ? 'bg-destructive/10 border-destructive/40' : 'bg-card border-border'}`}>
              <p className="text-xs text-muted-foreground mb-1">Em Risco</p>
              <p className={`text-xl font-bold ${atRisk > 0 ? 'text-destructive' : 'text-foreground'}`}>{atRisk}</p>
            </div>
            <div className={`dungeon-panel border rounded-lg p-3 text-center ${lowLife > 0 ? 'bg-accent/10 border-accent/40' : 'bg-card border-border'}`}>
              <p className="text-xs text-muted-foreground mb-1">Vida Crítica</p>
              <p className={`text-xl font-bold ${lowLife > 0 ? 'text-accent' : 'text-foreground'}`}>{lowLife}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {characters.length === 0 && (
          <div className="dungeon-panel gold-frame bg-card border border-border rounded-lg p-12 text-center space-y-4">
            <p className="text-4xl font-bold text-primary/40 select-none">◇</p>
            <h2 className="text-xl font-bold text-foreground">Seu Reino ainda está vazio</h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Crie seu primeiro personagem para começar a rastrear seus gastos e transformar finanças em aventura.
            </p>
            <Button
              onClick={onAddCharacter}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Criar meu primeiro personagem
            </Button>
          </div>
        )}

        {/* Characters grid */}
        {characters.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Seus Personagens</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {characters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onSelect={() => onSelectCharacter(character.id)}
                  onRitual={() => onOpenRitual(character.id)}
                  onRename={() => onRenameCharacter(character.id)}
                  onDelete={() => onDeleteCharacter(character.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Global stats */}
        {characters.length > 0 && (
          <div className="dungeon-panel border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Visão Geral do Reino</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ouro Consumido (total)</span>
                <span className="font-bold text-foreground">R$ {totalOuro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tesouro Máximo (combinado)</span>
                <span className="font-bold text-foreground">R$ {totalMax.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="space-y-1">
                <ProgressBar
                  value={totalOuro}
                  max={totalMax}
                  colorClass={totalOuro / totalMax >= 0.8 ? 'bg-destructive' : 'bg-primary'}
                />
                <p className="text-xs text-right text-muted-foreground">
                  {totalMax > 0 ? Math.round((totalOuro / totalMax) * 100) : 0}% do orçamento total consumido
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
