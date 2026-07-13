'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  type Character,
  CLASSES,
  calcOuroConsumido,
  calcDaysInCycle,
  calcEffectiveAttributes,
} from '@/lib/types'
import { calcBossResult, calcBossRisk, startNewCycle } from '@/lib/game-engine'
import { dateToISO } from '@/lib/date'

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
    maxTreasure: String(character.nextCycleMaxTreasure ?? character.maxTreasure),
    cycleStart: dateToISO(),
    cycleEnd: dateToISO(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    journeyMarker: '0',
  })

  const classDef = CLASSES.find(c => c.id === character.class)!
  const ouroConsumido = calcOuroConsumido(character)
  const { result, goldPreserved, xpBonus, victoryTitle } = calcBossResult(character)
  const bossRisk = calcBossRisk(character)
  const resultInfo = RESULT_LABELS[result]
  const daysTotal = calcDaysInCycle(character.cycleStart, character.cycleEnd)
  const daysRegistered = character.dailyRecords.filter(r => r.registered).length
  const recordXP = character.dailyRecords.reduce((s, r) => s + r.xpGained, 0)
  const journeyMarkerXP = character.journeyMarkerXpGranted ? 20 : 0
  const cycleXP = recordXP + journeyMarkerXP
  const underLimit = ouroConsumido < character.maxTreasure
  const pctBelow = character.maxTreasure > 0 ? (character.maxTreasure - ouroConsumido) / character.maxTreasure : 0
  const attrs = calcEffectiveAttributes(character)
  let bossMult = 1
  if (underLimit) {
    if (pctBelow > 0.2) bossMult = 1.5
    else if (pctBelow > 0.1) bossMult = 1.35
    else if (pctBelow > 0.05) bossMult = 1.2
    else bossMult = 1.1
  }
  const resultBonus = underLimit ? Math.round(cycleXP * (bossMult - 1)) : 0
  const afterProsperityBonus = underLimit ? Math.round(cycleXP * (bossMult - 1) * (1 + attrs.prosperidade * 0.05)) : 0
  const prosperityBonus = Math.max(0, afterProsperityBonus - resultBonus)
  const classBossBonus = Math.max(0, xpBonus - afterProsperityBonus)
  const totalCampaignXP = cycleXP + xpBonus

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
              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">XP dos registros</span>
                  <span className="font-semibold text-secondary">+{recordXP} XP</span>
                </div>
                {journeyMarkerXP > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Marco Inicial da Jornada</span>
                    <span className="font-semibold text-primary">+{journeyMarkerXP}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold">
                  <span className="text-foreground">Total antes do Boss</span>
                  <span className="text-secondary">+{cycleXP} XP</span>
                </div>
              </div>
              {xpBonus > 0 && (
                <div className="border-t border-border pt-2 space-y-1">
                  {resultBonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resultado do ciclo ({Math.round((bossMult - 1) * 100)}%)</span>
                      <span className="font-semibold text-primary">+{resultBonus}</span>
                    </div>
                  )}
                  {prosperityBonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prosperidade ({attrs.prosperidade} x 5%)</span>
                      <span className="font-semibold text-primary">+{prosperityBonus}</span>
                    </div>
                  )}
                  {classBossBonus > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bônus da classe {classDef.name}</span>
                      <span className="font-semibold text-primary">+{classBossBonus}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1 font-bold">
                    <span className="text-foreground">Bônus do Boss Final</span>
                    <span className="text-secondary">+{xpBonus} XP</span>
                  </div>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span className="text-foreground">XP total da campanha</span>
                <span className="text-secondary">+{totalCampaignXP} XP</span>
              </div>
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

          <section className={`dungeon-panel bg-card border rounded-lg p-4 space-y-3 text-sm ${bossRisk.survives ? 'border-primary/30' : 'border-destructive/40'}`}>
            <h3 className="font-semibold text-foreground uppercase tracking-wide text-xs">Risco do Boss</h3>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Dano estimado</span>
              <span className={`font-bold ${bossRisk.survives ? 'text-primary' : 'text-destructive'}`}>-{bossRisk.damageTaken} vida</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Sobrevive?</span>
              <span className={`font-bold ${bossRisk.survives ? 'text-primary' : 'text-destructive'}`}>
                {bossRisk.survives ? 'Sim' : 'Não'}
              </span>
            </div>
            {bossRisk.overLimit > 0 && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Acima do limite</span>
                <span className="font-bold text-secondary">R$ {bossRisk.overLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{bossRisk.advice}</p>
          </section>

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
    ? Math.round((new Date(form.cycleEnd).getTime() - new Date(form.cycleStart).getTime()) / (1000 * 60 * 60 * 24)) + 1
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
          <label className="text-sm text-muted-foreground block mb-1">Alvo do próximo ciclo (R$)</label>
          <input type="number" value={form.maxTreasure}
            onChange={e => setForm({ ...form, maxTreasure: e.target.value })}
            className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          <p className="text-xs text-muted-foreground mt-1">O ciclo atual já foi fechado. Este valor vale só para a próxima campanha.</p>
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
