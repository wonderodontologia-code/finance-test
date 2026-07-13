'use client'

import { useState, useEffect, useCallback } from 'react'
import LandingPage from './pages/landing-page'
import LoginPage from './pages/login-page'
import OnboardingPage from './pages/onboarding-page'
import GuildPage from './pages/guild-page'
import CharacterDetailPage from './pages/character-detail-page'
import BossFinalPage from './pages/boss-final-page'
import RitualRegisterModal from './ritual-register-modal'
import { Button } from '@/components/ui/button'
import { type Character, CLASSES, classImageForLevel, levelTitle } from '@/lib/types'
import { createBackup, loadState, parseBackup, saveState, clearState } from '@/lib/storage'
import { processDailyChecks, getCharactersNeedingBoss } from '@/lib/game-engine'
import { dateToISO } from '@/lib/date'

type PageType = 'landing' | 'login' | 'onboarding' | 'guild' | 'character-detail' | 'boss-final'

interface LevelUpState {
  characterName: string
  className: string
  classImageSrc: string
  fromLevel: number
  toLevel: number
  newTitle: string
  pointsGained: number
}

interface UpdateCharacterOptions {
  deferLevelUp?: boolean
}

function LevelUpModal({ levelUp, onClose }: { levelUp: LevelUpState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center">
      <div className="dungeon-panel gold-frame w-full max-w-md overflow-hidden rounded-lg border border-primary/50 bg-card shadow-2xl">
        <div className="relative bg-black">
          <img
            src="/items/level-up.png"
            alt=""
            className="aspect-square w-full object-cover"
            style={{ imageRendering: 'pixelated' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Ascensão</p>
            <h2 className="rpg-title mt-1 text-3xl font-bold text-foreground">Nível Aumentou!</h2>
          </div>
        </div>

        <div className="space-y-4 p-5 text-center">
          <div className="flex items-center justify-center gap-4">
            <img
              src={levelUp.classImageSrc}
              alt=""
              className="size-20 rounded border border-primary/35 bg-black/45 object-contain p-1"
              style={{ imageRendering: 'pixelated' }}
            />
            <div className="text-left">
              <p className="font-bold text-foreground">{levelUp.characterName}</p>
              <p className="text-xs text-muted-foreground">{levelUp.className}</p>
              <p className="mt-1 text-sm font-semibold text-primary">{levelUp.newTitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded border border-border bg-black/35 p-3">
              <p className="text-xs text-muted-foreground">Antes</p>
              <p className="text-xl font-bold text-foreground">Nv. {levelUp.fromLevel}</p>
            </div>
            <div className="rounded border border-primary/40 bg-primary/10 p-3">
              <p className="text-xs text-muted-foreground">Agora</p>
              <p className="text-xl font-bold text-primary">Nv. {levelUp.toLevel}</p>
            </div>
            <div className="rounded border border-secondary/40 bg-secondary/10 p-3">
              <p className="text-xs text-muted-foreground">Atributos</p>
              <p className="text-xl font-bold text-secondary">+{levelUp.pointsGained}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            O reino reconhece tua constância. Distribua os novos pontos de atributo para fortalecer o personagem.
          </p>

          <Button onClick={onClose} className="w-full py-3 text-base font-semibold">
            Continuar jornada
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function AppContainer() {
  const [hydrated, setHydrated] = useState(false)
  const [currentPage, setCurrentPage] = useState<PageType>('landing')
  const [userName, setUserName] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [ritualCharacterId, setRitualCharacterId] = useState<string | null>(null)
  const [bossCharacterId, setBossCharacterId] = useState<string | null>(null)
  const [gameEvents, setGameEvents] = useState<string[]>([])
  const [levelUp, setLevelUp] = useState<LevelUpState | null>(null)
  const [pendingLevelUp, setPendingLevelUp] = useState<LevelUpState | null>(null)

  // Hydrate from localStorage
  useEffect(() => {
    const state = loadState()
    if (state.isLoggedIn && state.userName) {
      setUserName(state.userName)
      const { characters: processed, events } = processDailyChecks(state.characters)
      setCharacters(processed)
      if (events.length > 0) {
        setGameEvents(events.map(e => e.message))
      }
      const needingBoss = getCharactersNeedingBoss(processed)
      if (needingBoss.length > 0) {
        setBossCharacterId(needingBoss[0].id)
        setCurrentPage('boss-final')
      } else {
        setCurrentPage('guild')
      }
    }
    setHydrated(true)
  }, [])

  // Persist on changes
  useEffect(() => {
    if (!hydrated) return
    if (userName && currentPage !== 'landing' && currentPage !== 'login') {
      saveState({ userName, isLoggedIn: true, characters, lastOpenedAt: new Date().toISOString() })
    }
  }, [hydrated, userName, characters, currentPage])

  const updateCharacter = useCallback((updated: Character, options?: UpdateCharacterOptions) => {
    const previous = characters.find(c => c.id === updated.id)
    if (previous && updated.level > previous.level) {
      const classDef = CLASSES.find(cls => cls.id === updated.class)!
      const classImage = classImageForLevel(classDef, updated.level)
      const nextLevelUp = {
        characterName: updated.name,
        className: classDef.name,
        classImageSrc: classImage.src,
        fromLevel: previous.level,
        toLevel: updated.level,
        newTitle: levelTitle(updated.level),
        pointsGained: Math.max(0, updated.level - previous.level),
      }
      if (options?.deferLevelUp) setPendingLevelUp(nextLevelUp)
      else setLevelUp(nextLevelUp)
    }
    setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c))
  }, [characters])

  const flushPendingLevelUp = useCallback(() => {
    if (!pendingLevelUp) return
    setLevelUp(pendingLevelUp)
    setPendingLevelUp(null)
  }, [pendingLevelUp])

  const handleRenameCharacter = useCallback((id: string) => {
    const character = characters.find(c => c.id === id)
    if (!character) return
    const nextName = window.prompt('Novo nome do personagem:', character.name)?.trim()
    if (!nextName || nextName === character.name) return
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, name: nextName } : c))
    setGameEvents([`${character.name} agora se chama ${nextName}.`])
  }, [characters])

  const handleDeleteCharacter = useCallback((id: string) => {
    const character = characters.find(c => c.id === id)
    if (!character) return
    const confirmed = window.confirm(`Deletar "${character.name}"? Essa ação remove o personagem deste dispositivo. Exporte um backup antes se quiser guardar o histórico.`)
    if (!confirmed) return
    setCharacters(prev => prev.filter(c => c.id !== id))
    setSelectedCharacterId(current => current === id ? null : current)
    setRitualCharacterId(current => current === id ? null : current)
    setBossCharacterId(current => current === id ? null : current)
    setCurrentPage('guild')
    setGameEvents([`${character.name} foi removido da Guilda.`])
  }, [characters])

  const handleLogin = (name: string) => {
    setUserName(name)
    const state = loadState()
    const chars = state.characters ?? []
    const { characters: processed, events } = processDailyChecks(chars)
    setCharacters(processed)
    if (events.length > 0) setGameEvents(events.map(e => e.message))

    const needingBoss = getCharactersNeedingBoss(processed)
    if (needingBoss.length > 0) {
      setBossCharacterId(needingBoss[0].id)
      setCurrentPage('boss-final')
    } else if (processed.length === 0) {
      setCurrentPage('onboarding')
    } else {
      setCurrentPage('guild')
    }
    saveState({ userName: name, isLoggedIn: true, characters: processed, lastOpenedAt: new Date().toISOString() })
  }

  const handleLogout = () => {
    clearState()
    setUserName('')
    setCharacters([])
    setCurrentPage('landing')
    setGameEvents([])
  }

  const handleExportBackup = () => {
    const backup = createBackup({
      userName,
      isLoggedIn: Boolean(userName),
      characters,
      lastOpenedAt: new Date().toISOString(),
    })
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const date = dateToISO()
    const link = document.createElement('a')
    link.href = url
    link.download = `reino-dos-gastos-backup-${date}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setGameEvents(['Backup exportado. Guarde esse arquivo em um lugar seguro.'])
  }

  const handleImportBackup = async (file: File) => {
    try {
      if (characters.length > 0) {
        const confirmed = window.confirm('Importar este backup vai substituir os dados salvos neste dispositivo. Deseja continuar?')
        if (!confirmed) return
      }
      const raw = await file.text()
      const imported = parseBackup(raw)
      const { characters: processed, events } = processDailyChecks(imported.characters)
      const importedUserName = imported.userName || userName || 'Aventureiro'
      setUserName(importedUserName)
      setCharacters(processed)
      setSelectedCharacterId(null)
      setRitualCharacterId(null)
      setBossCharacterId(null)
      saveState({
        userName: importedUserName,
        isLoggedIn: true,
        characters: processed,
        lastOpenedAt: new Date().toISOString(),
      })
      setCurrentPage('guild')
      setGameEvents([
        `Backup importado com ${processed.length} personagem${processed.length === 1 ? '' : 's'}.`,
        ...events.map(e => e.message),
      ])
    } catch {
      setGameEvents(['Não foi possível importar esse arquivo. Verifique se é um backup válido do Reino dos Gastos.'])
    }
  }

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId) ?? null
  const ritualCharacter = characters.find(c => c.id === ritualCharacterId) ?? null
  const bossCharacter = characters.find(c => c.id === bossCharacterId) ?? null

  const dismissEvents = () => setGameEvents([])

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm tracking-widest uppercase">Carregando o Reino...</p>
      </div>
    )
  }

  return (
    <>
      {/* Game events toast */}
      {gameEvents.length > 0 && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto">
          <div className="dungeon-panel gold-frame bg-card border border-accent/60 rounded-lg p-4 shadow-lg space-y-2">
            {gameEvents.map((msg, i) => (
              <p key={i} className="text-sm text-foreground">{msg}</p>
            ))}
            <button onClick={dismissEvents} className="text-xs text-primary font-semibold">Entendi</button>
          </div>
        </div>
      )}

      {levelUp && (
        <LevelUpModal levelUp={levelUp} onClose={() => setLevelUp(null)} />
      )}

      {currentPage === 'landing' && (
        <LandingPage onStartAdventure={() => setCurrentPage('login')} />
      )}

      {currentPage === 'login' && (
        <LoginPage onLogin={handleLogin} />
      )}

      {currentPage === 'onboarding' && (
        <OnboardingPage
          userName={userName}
          onCharacterCreated={(character) => {
            setCharacters(prev => [...prev, character])
            setCurrentPage('guild')
          }}
        />
      )}

      {currentPage === 'guild' && (
        <GuildPage
          characters={characters}
          userName={userName}
          onAddCharacter={() => setCurrentPage('onboarding')}
          onSelectCharacter={(id) => {
            setSelectedCharacterId(id)
            setCurrentPage('character-detail')
          }}
          onOpenRitual={(id) => setRitualCharacterId(id)}
          onRenameCharacter={handleRenameCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onLogout={handleLogout}
        />
      )}

      {currentPage === 'character-detail' && selectedCharacter && (
        <CharacterDetailPage
          character={selectedCharacter}
          onBack={() => setCurrentPage('guild')}
          onUpdateCharacter={updateCharacter}
          onFlushPendingLevelUp={flushPendingLevelUp}
          onRenameCharacter={() => handleRenameCharacter(selectedCharacter.id)}
          onDeleteCharacter={() => handleDeleteCharacter(selectedCharacter.id)}
          onOpenRitual={() => setRitualCharacterId(selectedCharacter.id)}
        />
      )}

      {currentPage === 'boss-final' && bossCharacter && (
        <BossFinalPage
          character={bossCharacter}
          onComplete={(updated) => {
            updateCharacter(updated)
            const remaining = getCharactersNeedingBoss(
              characters.map(c => c.id === updated.id ? updated : c)
            )
            if (remaining.length > 0) {
              setBossCharacterId(remaining[0].id)
            } else {
              setBossCharacterId(null)
              setCurrentPage('guild')
            }
          }}
        />
      )}

      {ritualCharacter && (
        <RitualRegisterModal
          character={ritualCharacter}
          onClose={() => setRitualCharacterId(null)}
          onConfirm={(updated) => {
            updateCharacter(updated)
            setRitualCharacterId(null)
          }}
        />
      )}
    </>
  )
}
