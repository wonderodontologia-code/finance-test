'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function LoginPage({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState('')

  const handleEnter = () => {
    if (name.trim()) onLogin(name.trim())
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="dungeon-panel gold-frame bg-card rounded-lg border-2 border-primary/60 p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-5xl mb-4 text-primary">⚔</h1>
            <h2 className="rpg-title text-3xl font-bold">Bem-vindo</h2>
            <p className="text-muted-foreground mt-2">ao Reino dos Gastos</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                Qual é o seu nome, aventureiro?
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Digite seu nome"
                className="w-full px-4 py-3 rounded border border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) handleEnter()
                }}
              />
            </div>

            <Button
              size="lg"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleEnter}
              disabled={!name.trim()}
            >
              Entrar no Reino
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Conta local — seus dados ficam salvos neste dispositivo.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Sua jornada começa aqui. Crie personagens, registre gastos e vença o Boss Final de cada ciclo.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
