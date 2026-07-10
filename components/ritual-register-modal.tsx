'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  type Character,
  CLASSES,
  calcJourneyQuota,
  calcDaysInCycle,
  calcRegistrationXP,
  calcEffectiveAttributes,
  xpForLevel,
} from '@/lib/types'
import { completeDailyMission } from '@/lib/game-engine'

interface RitualRegisterModalProps {
  character: Character
  onClose: () => void
  onConfirm: (updated: Character) => void
}

export default function RitualRegisterModal({ character, onClose, onConfirm }: RitualRegisterModalProps) {
  const today = new Date().toISOString().split('T')[0]
  const existingRecord = character.dailyRecords.find(r => r.date === today) ?? null
  const isEditing = existingRecord !== null

  const [amount, setAmount] = useState(isEditing ? String(existingRecord!.amount) : '')
  const [confirmed, setConfirmed] = useState(false)

  const classDef = CLASSES.find(c => c.id === character.class)!
  const effectiveAttributes = calcEffectiveAttributes(character)
  const daysInCycle = calcDaysInCycle(character.cycleStart, character.cycleEnd)
  const quota = calcJourneyQuota(character.maxTreasure, character.journeyMarker, daysInCycle)

  const amountNum = amount === '' ? 0 : Number(amount)
  const xpBreakdown = calcRegistrationXP(amountNum, quota, effectiveAttributes, classDef)

  // Combo multiplier — in edit mode the combo was already incremented today, so use current value
  const comboMult =
    character.combo >= 14 ? 1.15 :
    character.combo >= 7  ? 1.10 :
    character.combo >= 3  ? 1.05 : 1.0

  const bonusXP = xpBreakdown.bonus
  const totalXP = Math.round((xpBreakdown.base + xpBreakdown.daily + bonusXP) * comboMult)
  const comboBonusXP = Math.max(0, totalXP - (xpBreakdown.base + xpBreakdown.daily + bonusXP))

  const savedToday = Math.max(0, quota - amountNum)
  const overQuota = amountNum > quota

  const handleConfirm = () => {
    if (amount === '') return

    const updatedRecord = {
      date: today,
      amount: amountNum,
      xpGained: totalXP,
      registered: true,
    }

    if (isEditing) {
      // ── EDIT MODE ────────────────────────────────────────────────
      // 1. Reverse the old XP, then apply the new XP
      const oldXP = existingRecord!.xpGained
      const xpDelta = totalXP - oldXP

      // Recalculate XP+level from current state plus delta
      // Work on the raw pool: current pool = character.xp, apply delta
      let newXP = character.xp + xpDelta
      let newLevel = character.level
      let newXPToNext = character.xpToNextLevel
      let newAttrPoints = character.attributePoints

      // Handle gaining levels
      while (newXP >= newXPToNext) {
        newXP -= newXPToNext
        newLevel += 1
        newAttrPoints += 1
        newXPToNext = xpForLevel(newLevel)
      }
      // Handle losing XP (edit reduced the amount)
      while (newXP < 0 && newLevel > 1) {
        newLevel -= 1
        newXPToNext = xpForLevel(newLevel)
        newXP += newXPToNext
      }
      if (newXP < 0) newXP = 0

      // Replace the record in the array — no combo/life changes
      const updated: Character = {
        ...character,
        dailyRecords: character.dailyRecords.map(r => r.date === today ? updatedRecord : r),
        xp: newXP,
        xpToNextLevel: newXPToNext,
        level: newLevel,
        attributePoints: newAttrPoints,
      }

      const missionResult = completeDailyMission(updated, 'ritual_register')
      onConfirm(missionResult.character)
      setConfirmed(true)
    } else {
      // ── NEW REGISTRATION ─────────────────────────────────────────
      // 2. XP → level up check
      let newXP = character.xp + totalXP
      let newLevel = character.level
      let newXPToNext = character.xpToNextLevel
      let newAttrPoints = character.attributePoints

      while (newXP >= newXPToNext) {
        newXP -= newXPToNext
        newLevel += 1
        newAttrPoints += 1
        newXPToNext = xpForLevel(newLevel)
      }

      // 3. Regenerate life (+1 base, scaled by regeneracao attr)
      const regenBase = 1 + Math.floor(effectiveAttributes.regeneracao / 3)
      const newLife = Math.min(character.maxLife, character.life + regenBase)

      // 4. Combo
      const newCombo = character.combo + 1
      const newBestCombo = Math.max(character.bestCombo, newCombo)

      const updated: Character = {
        ...character,
        dailyRecords: [...character.dailyRecords, updatedRecord],
        xp: newXP,
        xpToNextLevel: newXPToNext,
        level: newLevel,
        attributePoints: newAttrPoints,
        life: newLife,
        combo: newCombo,
        bestCombo: newBestCombo,
      }

      const missionResult = completeDailyMission(updated, 'ritual_register')
      onConfirm(missionResult.character)
      setConfirmed(true)
    }
  }

  if (confirmed) {
    const savedMsg = isEditing
      ? `Registro ajustado. O ouro do dia foi recalculado.`
      : savedToday > 0
      ? `O ouro foi preservado. Teu cofre agradece.`
      : overQuota
      ? `Registrado. Mesmo acima da cota, a consciência financeira ficou ativa.`
      : `Boa! Hoje tu manteve o controle da jornada.`

    return (
      <div className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
        <div className="dungeon-panel gold-frame bg-card border border-border rounded-lg w-full max-w-md p-6 space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center mx-auto">
            <span className="text-primary font-bold text-xl">!</span>
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {isEditing ? 'Registro Atualizado' : 'Ritual Concluído'}
          </h3>
          <p className="text-muted-foreground text-sm italic">{savedMsg}</p>
          <div className="bg-black/35 border border-border rounded-lg p-4 space-y-2 text-sm">
            {isEditing ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">XP anterior</span>
                  <span className="font-semibold text-foreground">{existingRecord!.xpGained}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">XP novo</span>
                  <span className="font-semibold text-foreground">{totalXP}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span className="text-foreground">Ajuste de XP</span>
                  <span className={totalXP - existingRecord!.xpGained >= 0 ? 'text-secondary' : 'text-destructive'}>
                    {totalXP - existingRecord!.xpGained >= 0 ? '+' : ''}{totalXP - existingRecord!.xpGained} XP
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">XP base (registro)</span>
                  <span className="font-semibold text-foreground">+{xpBreakdown.base}</span>
                </div>
                {xpBreakdown.sabedoriaBonus > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">inclui Sabedoria ({effectiveAttributes.sabedoria} x 5%)</span>
                    <span className="font-semibold text-primary">+{xpBreakdown.sabedoriaBonus}</span>
                  </div>
                )}
                {xpBreakdown.classBaseBonus > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">inclui bônus da classe {classDef.name}</span>
                    <span className="font-semibold text-primary">+{xpBreakdown.classBaseBonus}</span>
                  </div>
                )}
                {xpBreakdown.daily > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">XP missão diária</span>
                    <span className="font-semibold text-foreground">+{xpBreakdown.daily}</span>
                  </div>
                )}
                {bonusXP > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">XP bônus (Ouro Preservado do Dia)</span>
                    <span className="font-semibold text-secondary">+{bonusXP}</span>
                  </div>
                )}
                {xpBreakdown.disciplinaBonus > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">inclui Disciplina ({effectiveAttributes.disciplina} x 10%)</span>
                    <span className="font-semibold text-primary">+{xpBreakdown.disciplinaBonus}</span>
                  </div>
                )}
                {xpBreakdown.classSavedBonus > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">inclui bônus da classe {classDef.name}</span>
                    <span className="font-semibold text-primary">+{xpBreakdown.classSavedBonus}</span>
                  </div>
                )}
                {comboMult > 1 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Combo de Disciplina ({Math.round((comboMult - 1) * 100)}% extra)</span>
                    <span className="font-semibold text-primary">+{comboBonusXP}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span className="text-foreground">Total XP</span>
                  <span className="text-secondary">+{totalXP} XP</span>
                </div>
              </>
            )}
          </div>
          <Button onClick={onClose} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Continuar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
      <div className="dungeon-panel gold-frame bg-card border border-border rounded-lg w-full max-w-md space-y-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {isEditing ? 'Editar Registro de Hoje' : 'Ritual de Registro'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {character.name}
                {isEditing && (
                  <span className="ml-2 inline-block px-1.5 py-0.5 text-xs rounded bg-secondary/20 border border-secondary/40 text-foreground font-medium">
                    Editando registro de hoje
                  </span>
                )}
              </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Cota info */}
          <div className="bg-black/35 border border-border rounded-lg p-3 text-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Cota de Jornada de hoje</p>
              <p className="font-bold text-foreground text-lg">
                R$ {quota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Classe</p>
              <p className="font-semibold text-foreground text-xs">{classDef.name}</p>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {isEditing
                ? `Valor registrado hoje (original: R$ ${existingRecord!.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
                : 'Quanto você gastou hoje?'}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">R$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                min="0"
                step="0.01"
                className="flex-1 px-4 py-3 rounded-lg border border-border bg-input text-foreground text-lg font-semibold placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Registrar R$ 0 é válido — pode ser que não tenha gastado nada hoje.
            </p>
          </div>

          {/* Live XP preview */}
          {amount !== '' && (
            <div className="bg-black/35 border border-border rounded-lg p-3 space-y-2 text-sm">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Prévia do XP</p>
              <div className="space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>XP base (registro)</span>
                  <span>+{xpBreakdown.base}</span>
                </div>
                {xpBreakdown.sabedoriaBonus > 0 && (
                  <div className="flex justify-between text-xs text-primary">
                    <span>Sabedoria ({effectiveAttributes.sabedoria} x 5%)</span>
                    <span>+{xpBreakdown.sabedoriaBonus}</span>
                  </div>
                )}
                {xpBreakdown.classBaseBonus > 0 && (
                  <div className="flex justify-between text-xs text-primary">
                    <span>Bônus da classe {classDef.name}</span>
                    <span>+{xpBreakdown.classBaseBonus}</span>
                  </div>
                )}
                {xpBreakdown.daily > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>XP missão diária</span>
                    <span>+{xpBreakdown.daily}</span>
                  </div>
                )}
                {xpBreakdown.bonus > 0 ? (
                  <div className="flex justify-between text-secondary">
                    <span>Ouro Preservado do Dia</span>
                    <span>+{bonusXP}</span>
                  </div>
                ) : overQuota ? (
                  <p className="text-xs text-muted-foreground italic">Acima da Cota de Jornada — sem bônus de economia.</p>
                ) : null}
                {xpBreakdown.disciplinaBonus > 0 && (
                  <div className="flex justify-between text-xs text-primary">
                    <span>Disciplina ({effectiveAttributes.disciplina} x 10%)</span>
                    <span>+{xpBreakdown.disciplinaBonus}</span>
                  </div>
                )}
                {xpBreakdown.classSavedBonus > 0 && (
                  <div className="flex justify-between text-xs text-primary">
                    <span>Bônus da classe {classDef.name}</span>
                    <span>+{xpBreakdown.classSavedBonus}</span>
                  </div>
                )}
                {comboMult > 1 && (
                  <div className="flex justify-between text-primary">
                    <span>Combo de Disciplina ({character.combo} dias)</span>
                    <span>+{comboBonusXP}</span>
                  </div>
                )}
                <div className="border-t border-border pt-1 flex justify-between font-bold text-foreground">
                  <span>Total</span>
                  <span className="text-secondary">+{totalXP} XP</span>
                </div>
              </div>

              {savedToday > 0 && (
                <p className="text-xs text-muted-foreground border-t border-border pt-2">
                  Ouro Preservado do Dia:{' '}
                  <span className="font-semibold text-foreground">
                    R$ {savedToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Maldição info */}
          <div className="text-xs text-muted-foreground bg-black/30 border border-border rounded p-2">
            Registrar mantém a consciência financeira ativa — mesmo que o valor seja alto, você ganha XP pela constância.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={amount === '' || Number(amount) < 0 || (isEditing && Number(amount) === existingRecord!.amount)}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            {isEditing ? 'Salvar Alteração' : 'Confirmar Registro'}
          </Button>
        </div>
      </div>
    </div>
  )
}
