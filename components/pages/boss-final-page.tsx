'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  type Character,
  CLASSES,
  calcOuroConsumido,
  calcDaysInCycle,
} from '@/lib/types'
import { calcBossResult, startNewCycle } from '@/lib/game-engine'

interface BossFinalPageProps {
  character: Character
  onComplete: (updated: Character) => void
}

const RESULT_LABELS: Record<string, { title: string; subtitle: string; color: string }> = {
  defeat: { title: 'Derrota', subtitle: 'O ciclo escapou do controle.', color: 'text-destructive' },
  survived: { title: 'Sobreviveu', subtitle: 'Não foi perfeito, mas o guardião resistiu.', color: 'text-muted-foreground' },
  victory: { title: 'Vitória da Campanha', subtitle: 'Tu dominou esse ciclo.', color: 'text-primary' },
  epic: { title: 'Vitória Épica', subtitle: 'Uma campanha memorável!', color: 'text-secondary' },
  legendary: { title: 'Vitória Lendária', subtitle: 'Jornada Lendária — o Reino celebra.', color: 'text-primary' },
}

export default function BossFinalPage({ character, onComplete }: BossFinalPageProps) {
  const [phase, setPhase] = useState<'summary' | 'new-cycle'>('summary')
  const [form, setForm] = useState({
    maxTreasure: String(character.maxTreasure),
    cycleStart: new Date().toISOString().split('T')[0],
    cycleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    journeyMarker: '0',
  })

  const classDef = CLASSES.find(c => c.id === character.class)!
  const ouroConsumido = calcOuroConsumido(character)
  const { result, goldPreserved, xpBonus, victoryTitle } = calcBossResult(character)
  const resultInfo = RESULT_LABELS[result]
  const daysTotal = calcDaysInCycle(character.cycleStart, character.cycleEnd)
  const daysRegistered = character.dailyRecords.filter(r => r.registered).length
  const cycleXP = character.dailyRecords.reduce((s, r) => s + r.xpGained, 0)

  const handleStartNewCycle = () => {
    const updated = startNewCycle(character, {
      maxTreasure: Number(form.maxTreasure),
      cycleStart: form.cycleStart,
      cycleEnd: form.cycleEnd,
      journeyMarker: Number(form.journeyMarker),
    })
    onComplete(updated)
  }

  if (phase === 'summary') {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-black/75 border-b border-primary/25">
          <div className="max-w-xl mx-auto px-4 py-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-2">Boss Final</p>
            <h1 className="text-2xl font-bold text-foreground">{character.name}</h1>
            <p className="text-sm text-muted-foreground">{classDef.name}</p>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
          <div className="dungeon-panel gold-frame bg-card border-2 border-accent/50 rounded-lg p-6 text-center space-y-2">
            <p className={`rpg-title text-3xl font-bold ${resultInfo.color}`}>{victoryTitle ?? resultInfo.title}</p>
            <p className="text-muted-foreground text-sm italic">{resultInfo.subtitle}</p>
          </div>

          <section className="dungeon-panel bg-card border border-border rounded-lg p-4 space-y-3 text-sm">
            <h3 className="font-semibold text-foreground uppercase tracking-wide text-xs">Resumo da Campanha</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tesouro Máximo</span>
                <span className="font-semibold">R$ {character.maxTreasure.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ouro Consumido</span>
                <span className="font-semibold">R$ {ouroConsumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ouro Preservado do Mês</span>
                <span className={`font-bold ${goldPreserved > 0 ? 'text-primary' : 'text-destructive'}`}>
                  R$ {goldPreserved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dias registrados</span>
                <span className="font-semibold">{daysRegistered}/{daysTotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Melhor Combo</span>
                <span className="font-semibold">{character.bestCombo} dias</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">XP do ciclo</span>
                <span className="font-semibold text-secondary">+{cycleXP} XP</span>
              </div>
              {xpBonus > 0 && (
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Bônus do Boss Final</span>
                  <span className="font-bold text-secondary">+{xpBonus} XP</span>
                </div>
              )}
            </div>
          </section>

          {goldPreserved > 0 && (
            <div className="dungeon-panel bg-primary/10 border border-primary/40 rounded-lg p-4 text-sm text-center">
              <p className="font-semibold text-foreground">Baú do Ouro Preservado</p>
              <p className="text-2xl font-bold text-primary mt-1">
                +{goldPreserved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ouro
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Total no baú: R$ {((character.goldChest ?? 0) + goldPreserved).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}

          <Button
            onClick={() => setPhase('new-cycle')}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-3"
          >
            Iniciar Novo Ciclo
          </Button>
        </main>
      </div>
    )
  }

  const cycleDays = form.cycleStart && form.cycleEnd && form.cycleEnd > form.cycleStart
    ? Math.round((new Date(form.cycleEnd).getTime() - new Date(form.cycleStart).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-black/75 border-b border-primary/25">
        <div className="max-w-xl mx-auto px-4 py-6">
          <h1 className="text-xl font-bold text-foreground">Novo Ciclo — {character.name}</h1>
          <p className="text-sm text-muted-foreground">Configure a próxima campanha</p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Tesouro Máximo (R$)</label>
          <input type="number" value={form.maxTreasure}
            onChange={e => setForm({ ...form, maxTreasure: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Início do ciclo</label>
          <input type="date" value={form.cycleStart}
            onChange={e => setForm({ ...form, cycleStart: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Fechamento (Boss Final)</label>
          <input type="date" value={form.cycleEnd}
            onChange={e => setForm({ ...form, cycleEnd: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        {cycleDays > 0 && (
          <p className="text-sm text-muted-foreground">Ciclo de <span className="font-semibold">{cycleDays} dias</span></p>
        )}
        <div>
          <label className="text-sm text-muted-foreground block mb-1">Marco Inicial da Jornada (R$)</label>
          <input type="number" value={form.journeyMarker} min="0"
            onChange={e => setForm({ ...form, journeyMarker: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          <p className="text-xs text-muted-foreground mt-1">+20 XP ao confirmar o Marco Inicial</p>
        </div>

        <Button
          onClick={handleStartNewCycle}
          disabled={!form.maxTreasure || Number(form.maxTreasure) <= 0 || !form.cycleEnd || form.cycleEnd <= form.cycleStart || form.journeyMarker === ''}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-3 disabled:opacity-40"
        >
          Começar Nova Campanha
        </Button>
      </main>
    </div>
  )
}
