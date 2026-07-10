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
import { DAILY_MISSION_XP, completeDailyMission } from '@/lib/game-engine'

interface RitualRegisterModalProps {
  character: Character
  onClose: () => void
  onConfirm: (updated: Character) => void
}

export default function RitualRegisterModal({ character, onClose, onConfirm }: RitualRegisterModalProps) {
  const today = new Date().toISOString().split('T')[0]
  const existingRecord = character.dailyRecords.find(r => r.date === today) ?? null
  const isEditing = existingRecord !== null

  const [entryMode, setEntryMode] = useState<'daily' | 'total'>('daily')
  const [amount, setAmount] = useState(isEditing ? String(existingRecord!.amount) : '')
  const [description, setDescription] = useState(existingRecord?.description ?? '')
  const [confirmed, setConfirmed] = useState(false)

  const classDef = CLASSES.find(c => c.id === character.class)!
  const effectiveAttributes = calcEffectiveAttributes(character)
  const daysInCycle = calcDaysInCycle(character.cycleStart, character.cycleEnd)
  const quota = calcJourneyQuota(character.maxTreasure, character.journeyMarker, daysInCycle)

  const previousTotal = character.journeyMarker + character.dailyRecords.reduce(
    (sum, record) => record.date === today ? sum : sum + record.amount,
    0
  )
  const enteredAmount = amount === '' ? 0 : Number(amount)
  const calculatedDailyAmount = entryMode === 'total' ? enteredAmount - previousTotal : enteredAmount
  const amountNum = Number.isFinite(calculatedDailyAmount) ? calculatedDailyAmount : 0
  const validAmount = amount !== '' && Number.isFinite(enteredAmount) && amountNum >= 0
  const xpBreakdown = calcRegistrationXP(validAmount ? amountNum : 0, quota, effectiveAttributes, classDef)

  const comboForXP = isEditing ? character.combo : character.combo + 1
  const comboMult =
    comboForXP >= 14 ? 1.15 :
    comboForXP >= 7  ? 1.10 :
    comboForXP >= 3  ? 1.05 : 1.0

  const ritualXPBeforeCombo = xpBreakdown.base + xpBreakdown.bonus
  const totalXP = Math.round(ritualXPBeforeCombo * comboMult)
  const comboBonusXP = Math.max(0, totalXP - ritualXPBeforeCombo)
  const dailyMissionCompleted = character.dailyMissions?.date === today && character.dailyMissions.completedIds.includes('ritual_register')
  const dailyMissionXPToAward = dailyMissionCompleted ? 0 : DAILY_MISSION_XP
  const trimmedDescription = description.trim()
  const descriptionChanged = (existingRecord?.description ?? '') !== trimmedDescription
  const recordChanged = !isEditing || existingRecord!.amount !== amountNum || descriptionChanged

  const xpLines = [
    { label: 'XP base do registro', value: xpBreakdown.baseRaw, tone: 'muted' },
    { label: 'Sabedoria (' + effectiveAttributes.sabedoria + ' x 5%)', value: xpBreakdown.sabedoriaBonus, tone: 'primary' },
    { label: 'Bônus da classe ' + classDef.name, value: xpBreakdown.classBaseBonus, tone: 'primary' },
    { label: 'Ouro Preservado do Dia', value: xpBreakdown.savedBonusBase, tone: 'secondary' },
    { label: 'Disciplina (' + effectiveAttributes.disciplina + ' x 10%)', value: xpBreakdown.disciplinaBonus, tone: 'primary' },
    { label: 'Bônus de economia da classe ' + classDef.name, value: xpBreakdown.classSavedBonus, tone: 'primary' },
    { label: 'Combo de Disciplina (+' + Math.round((comboMult - 1) * 100) + '%)', value: comboBonusXP, tone: 'primary' },
  ].filter(line => line.value > 0)

  const savedToday = Math.max(0, quota - amountNum)
  const overQuota = amountNum > quota

  const switchEntryMode = (mode: 'daily' | 'total') => {
    if (mode === entryMode) return
    setEntryMode(mode)
    if (amount === '' || !Number.isFinite(enteredAmount)) return
    const nextAmount = mode === 'total' ? previousTotal + amountNum : amountNum
    setAmount(String(Math.max(0, Number(nextAmount.toFixed(2)))))
  }

  const handleConfirm = () => {
    if (!validAmount) return

    const updatedRecord = {
      date: today,
      amount: amountNum,
      xpGained: totalXP,
      registered: true,
      description: trimmedDescription || undefined,
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
                {xpLines.map((line) => (
                  <div key={line.label} className="flex justify-between">
                    <span className="text-muted-foreground">{line.label}</span>
                    <span className={line.tone === 'secondary' ? 'font-semibold text-secondary' : line.tone === 'primary' ? 'font-semibold text-primary' : 'font-semibold text-foreground'}>+{line.value}</span>
                  </div>
                ))}
                {!xpBreakdown.savedBonusBase && overQuota && (
                  <p className="text-xs text-muted-foreground italic">Acima da Cota de Jornada — sem bônus de economia.</p>
                )}
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span className="text-foreground">XP do registro</span>
                  <span className="text-secondary">+{totalXP} XP</span>
                </div>
                {dailyMissionXPToAward > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Contrato diário: Ritual de Registro</span>
                    <span className="font-semibold text-primary">+{dailyMissionXPToAward}</span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between font-bold">
                  <span className="text-foreground">Total recebido agora</span>
                  <span className="text-secondary">+{totalXP + dailyMissionXPToAward} XP</span>
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
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-black/30 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => switchEntryMode('daily')}
              className={'rounded-md px-3 py-2 transition ' + (entryMode === 'daily' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              Gasto do dia
            </button>
            <button
              type="button"
              onClick={() => switchEntryMode('total')}
              className={'rounded-md px-3 py-2 transition ' + (entryMode === 'total' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              Total acumulado
            </button>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              {isEditing
                ? `Valor registrado hoje (original: R$ ${existingRecord!.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
                : entryMode === 'total' ? 'Qual é o total acumulado agora?' : 'Quanto você gastou hoje?'}
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
              {entryMode === 'total'
                ? 'Já havia R$ ' + previousTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' registrado. O gasto de hoje será a diferença.'
                : 'Registrar R$ 0 é válido — pode ser que não tenha gastado nada hoje.'}
            </p>
            {entryMode === 'total' && amount !== '' && (
              <p className={'mt-1 text-xs font-semibold ' + (validAmount ? 'text-secondary' : 'text-destructive')}>
                Diferença calculada para hoje: R$ {amountNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">Descrição opcional</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: mercado, almoço, farmácia..."
              maxLength={80}
              className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Live XP preview */}
          {amount !== '' && (
            <div className="bg-black/35 border border-border rounded-lg p-3 space-y-2 text-sm">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Prévia do XP</p>
              {validAmount ? (
                <>
                  <div className="space-y-1">
                    {xpLines.map((line) => (
                      <div key={line.label} className={'flex justify-between ' + (line.tone === 'secondary' ? 'text-secondary' : line.tone === 'primary' ? 'text-primary' : 'text-muted-foreground')}>
                        <span>{line.label}</span>
                        <span>+{line.value}</span>
                      </div>
                    ))}
                    {!xpBreakdown.savedBonusBase && overQuota && (
                      <p className="text-xs text-muted-foreground italic">Acima da Cota de Jornada — sem bônus de economia.</p>
                    )}
                    <div className="border-t border-border pt-1 flex justify-between font-bold text-foreground">
                      <span>XP do registro</span>
                      <span className="text-secondary">+{totalXP} XP</span>
                    </div>
                    {dailyMissionXPToAward > 0 && (
                      <div className="flex justify-between text-xs text-primary">
                        <span>Contrato diário ao confirmar</span>
                        <span>+{dailyMissionXPToAward}</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-1 flex justify-between font-bold text-foreground">
                      <span>Total recebido agora</span>
                      <span className="text-secondary">+{totalXP + dailyMissionXPToAward} XP</span>
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
                </>
              ) : (
                <p className="text-xs text-destructive">O total acumulado informado é menor que o valor já registrado antes de hoje.</p>
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
            disabled={!validAmount || !recordChanged}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            {isEditing ? 'Salvar Alteração' : 'Confirmar Registro'}
          </Button>
        </div>
      </div>
    </div>
  )
}
