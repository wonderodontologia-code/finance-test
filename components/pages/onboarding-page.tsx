'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  CLASSES,
  CATEGORIES,
  type CharacterClass,
  type Category,
  createCharacter,
  type Character,
} from '@/lib/types'
import { dateToISO } from '@/lib/date'

interface OnboardingPageProps {
  onCharacterCreated: (character: Character) => void
  userName?: string
}

export default function OnboardingPage({ onCharacterCreated, userName }: OnboardingPageProps) {
  const [step, setStep] = useState(0)
  const [expandedClass, setExpandedClass] = useState<CharacterClass | null>(null)
  const [form, setForm] = useState({
    name: '',
    charClass: '' as CharacterClass | '',
    category: '' as Category | '',
    maxTreasure: '',
    cycleStart: dateToISO(),
    cycleEnd: dateToISO(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    journeyMarker: '',
  })

  const totalSteps = 7

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return true
      case 1: return form.name.trim().length >= 2
      case 2: return form.charClass !== ''
      case 3: return form.category !== ''
      case 4: return form.maxTreasure !== '' && Number(form.maxTreasure) > 0
      case 5: return form.cycleStart !== '' && form.cycleEnd !== '' && form.cycleEnd > form.cycleStart
      case 6: return form.journeyMarker !== '' && Number(form.journeyMarker) >= 0
      default: return false
    }
  }

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1)
    } else {
      const character = createCharacter({
        name: form.name,
        class: form.charClass as CharacterClass,
        category: form.category as Category,
        maxTreasure: Number(form.maxTreasure),
        cycleStart: form.cycleStart,
        cycleEnd: form.cycleEnd,
        journeyMarker: Number(form.journeyMarker),
      })
      onCharacterCreated(character)
    }
  }

  const classDef = CLASSES.find(c => c.id === form.charClass)
  const cycledays = form.cycleStart && form.cycleEnd && form.cycleEnd > form.cycleStart
    ? Math.round((new Date(form.cycleEnd).getTime() - new Date(form.cycleStart).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Criação de Personagem
          </p>
          <div className="flex items-center gap-1 justify-center mb-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i < step ? 'bg-primary w-6' : i === step ? 'bg-secondary w-10' : 'bg-muted w-6'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Passo {step + 1} de {totalSteps}</p>
        </div>

        <div className="dungeon-panel gold-frame bg-card border border-border rounded-lg p-6 shadow-sm">

          {/* Step 0 — Boas-vindas */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Bem-vindo ao Reino dos Gastos</h2>
              <p className="text-muted-foreground leading-relaxed">
                {userName ? `Olá, ${userName}! ` : ''}Aqui, seus gastos viram personagens que precisam sobreviver ao ciclo mensal.
              </p>
              <div className="bg-black/35 border border-border rounded-lg p-4 space-y-2 text-sm">
                <p className="font-semibold text-foreground">Como funciona:</p>
                <p className="text-muted-foreground">Cada personagem representa uma categoria de gasto ou cartão.</p>
                <p className="text-muted-foreground">Todo dia você faz o <span className="font-semibold text-primary">Ritual de Registro</span> — informa quanto gastou.</p>
                <p className="text-muted-foreground">Registrar dá XP. Economizar dá bônus. Esquecer tira vida.</p>
                <p className="text-muted-foreground">No fechamento do ciclo, você enfrenta o <span className="font-semibold text-accent">Boss Final</span>.</p>
              </div>
              <p className="text-xs text-muted-foreground italic border-l-2 border-primary pl-3">
                "Registrar é o comportamento principal. Economizar é o bônus. Fechar abaixo do limite é a vitória."
              </p>
            </div>
          )}

          {/* Step 1 — Nome */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Nome do Personagem</h2>
              <p className="text-muted-foreground text-sm">Escolha um nome épico que represente esse gasto.</p>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Aldric da Fatura, Selene dos Saldos..."
                className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-2">Sugestões do Reino:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Aldric da Fatura',
                    'Selene dos Saldos',
                    'Borin do Orçamento',
                    'Mira das Moedas',
                    'Cedric do Cashback',
                    'Lia da Reserva',
                    'Tomas do Tesouro',
                    'Iria dos Juros',
                  ].map(s => (
                    <button key={s} onClick={() => setForm({ ...form, name: s })}
                      className="px-2 py-1 bg-muted hover:bg-primary/10 rounded text-xs text-foreground border border-border transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Classe */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Escolha a Classe</h2>
              <p className="text-muted-foreground text-sm">
                A classe define os atributos iniciais, bônus e estilo de progressão. Expanda para ver os detalhes completos.
              </p>
              <div className="space-y-3">
                {CLASSES.map((cls) => {
                  const isSelected = form.charClass === cls.id
                  const isExpanded = expandedClass === cls.id
                  const initialImage = cls.imageStages[0]
                  return (
                    <div key={cls.id} className={`dungeon-panel border-2 rounded-lg overflow-hidden transition ${isSelected ? 'border-primary gold-frame' : 'border-border'}`}>
                      <button
                        onClick={() => {
                          setForm({ ...form, charClass: cls.id })
                          setExpandedClass(isExpanded ? null : cls.id)
                        }}
                        className={`w-full p-4 text-left flex items-start justify-between gap-3 transition ${isSelected ? 'bg-primary/10' : 'bg-card hover:bg-primary/5'}`}
                        >
                        <img
                          src={initialImage.src}
                          alt=""
                          className="size-16 shrink-0 rounded border border-primary/30 bg-black/45 object-cover"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        <div className="flex-1">
                          <p className="font-bold text-foreground">{cls.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{cls.subtitle}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 mt-0.5">
                          {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                          <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-3 bg-muted/20 border-t border-border space-y-3 text-sm">
                          <div className="relative overflow-hidden rounded-lg border border-primary/35 bg-black/45">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(214,169,51,0.16),transparent_58%)]" />
                            <img
                              src={initialImage.src}
                              alt={`${cls.name} aparência inicial`}
                              className="relative mx-auto aspect-square w-full max-h-72 object-contain"
                              style={{ imageRendering: 'pixelated' }}
                            />
                            <span className="absolute bottom-3 left-3 rounded border border-primary/40 bg-black/70 px-2 py-1 text-xs font-bold text-primary">
                              Aparência inicial
                            </span>
                          </div>

                          <p className="text-muted-foreground leading-relaxed">{cls.description}</p>

                          <div>
                            <p className="font-semibold text-foreground mb-1">Bônus iniciais:</p>
                            <ul className="space-y-1">
                              {cls.bonuses.map((b, i) => (
                                <li key={i} className="flex gap-2 text-muted-foreground">
                                  <span className="text-primary font-bold shrink-0">+</span>{b}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <p className="font-semibold text-foreground mb-1">Ideal para:</p>
                            <div className="flex flex-wrap gap-1">
                              {cls.idealFor.map((item, i) => (
                                <span key={i} className="px-2 py-0.5 bg-secondary/20 border border-secondary/30 text-foreground rounded text-xs">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="font-semibold text-foreground mb-2">Atributos iniciais:</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {(Object.entries(cls.startingAttributes) as [string, number][]).filter(([, v]) => v > 0).map(([key, val]) => (
                                <div key={key} className="bg-card border border-border rounded p-2 text-center">
                                  <p className="text-xs text-muted-foreground capitalize">{key}</p>
                                  <p className="font-bold text-primary">{val}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 3 — Categoria */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">O que ele representa?</h2>
              <p className="text-muted-foreground text-sm">Escolha a categoria de gasto ou cartão que esse personagem vai controlar.</p>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setForm({ ...form, category: cat })}
                    className={`p-3 rounded-lg border-2 text-left text-sm font-medium transition ${
                      form.category === cat ? 'bg-secondary/20 border-secondary text-foreground' : 'bg-card border-border text-foreground hover:border-secondary/60'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 — Tesouro Máximo */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Tesouro Máximo</h2>
              <div className="bg-black/35 border border-border rounded-lg p-3 text-sm">
                <p className="font-semibold text-foreground mb-1">O que é o Tesouro Máximo?</p>
                <p className="text-muted-foreground">O valor máximo que você pretende gastar nesse ciclo. Funciona como o orçamento mensal daquela categoria ou cartão.</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Valor em reais (R$)</label>
                <input
                  type="number"
                  value={form.maxTreasure}
                  onChange={(e) => setForm({ ...form, maxTreasure: e.target.value })}
                  placeholder="Ex: 2000"
                  min="1"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          )}

          {/* Step 5 — Datas */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Período do Ciclo</h2>
              <p className="text-muted-foreground text-sm">O ciclo é a campanha do personagem. O fechamento é o Boss Final.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Início do ciclo</label>
                  <input type="date" value={form.cycleStart}
                    onChange={(e) => setForm({ ...form, cycleStart: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Fechamento do ciclo (Boss Final)</label>
                  <input type="date" value={form.cycleEnd}
                    onChange={(e) => setForm({ ...form, cycleEnd: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              {cycledays > 0 && (
                <p className="text-sm text-muted-foreground">
                  Ciclo de <span className="font-semibold text-foreground">{cycledays} dias</span>
                </p>
              )}
            </div>
          )}

          {/* Step 6 — Marco Inicial */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Marco Inicial da Jornada</h2>
              <div className="bg-black/35 border border-border rounded-lg p-3 text-sm">
                <p className="font-semibold text-foreground mb-1">O que é o Marco Inicial da Jornada?</p>
                <p className="text-muted-foreground">Valor já comprometido no início do ciclo — parcelas antigas, lançamentos anteriores. Em finanças reais, é o saldo que já existe antes de você começar a acompanhar.</p>
                <p className="text-muted-foreground mt-2 italic">Exemplo: fatura abriu com R$ 430 em parcelas. Esse é o Marco Inicial.</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Valor já comprometido (pode ser R$ 0)</label>
                <input
                  type="number"
                  value={form.journeyMarker}
                  onChange={(e) => setForm({ ...form, journeyMarker: e.target.value })}
                  placeholder="Ex: 430 (ou 0)"
                  min="0"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {form.maxTreasure && form.journeyMarker !== '' && (
                <div className="bg-black/35 border border-border rounded-lg p-3 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tesouro Máximo</span>
                    <span className="font-semibold text-foreground">R$ {Number(form.maxTreasure).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Marco Inicial</span>
                    <span className="font-semibold text-foreground">R$ {Number(form.journeyMarker).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-border pt-1.5 flex justify-between">
                    <span className="text-muted-foreground">Disponível para gastar</span>
                    <span className="font-bold text-primary">R$ {(Number(form.maxTreasure) - Number(form.journeyMarker)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {cycledays > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cota de Jornada (por dia)</span>
                      <span className="font-bold text-secondary">
                        R$ {((Number(form.maxTreasure) - Number(form.journeyMarker)) / cycledays).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                    Ao confirmar, o personagem recebe <span className="font-semibold text-primary">+20 XP</span> pelo Marco Inicial da Jornada.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-4">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              Voltar
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canAdvance()}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            {step === totalSteps - 1 ? 'Invocar Personagem' : step === 0 ? 'Iniciar Jornada' : 'Continuar'}
          </Button>
        </div>

        {classDef && form.name && step > 2 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{form.name}</span> — {classDef.name}
            {form.category ? ` · ${form.category}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}
