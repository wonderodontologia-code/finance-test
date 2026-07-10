'use client'

import { useState, useEffect, useCallback } from 'react'
import LandingPage from './pages/landing-page'
import LoginPage from './pages/login-page'
import OnboardingPage from './pages/onboarding-page'
import GuildPage from './pages/guild-page'
import CharacterDetailPage from './pages/character-detail-page'
import BossFinalPage from './pages/boss-final-page'
import RitualRegisterModal from './ritual-register-modal'
import { type Character } from '@/lib/types'
import { createBackup, loadState, parseBackup, saveState, clearState } from '@/lib/storage'
import { processDailyChecks, getCharactersNeedingBoss } from '@/lib/game-engine'

type PageType = 'landing' | 'login' | 'onboarding' | 'guild' | 'character-detail' | 'boss-final'

export default function AppContainer() {
  const [hydrated, setHydrated] = useState(false)
  const [currentPage, setCurrentPage] = useState<PageType>('landing')
  const [userName, setUserName] = useState('')
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [ritualCharacterId, setRitualCharacterId] = useState<string | null>(null)
  const [bossCharacterId, setBossCharacterId] = useState<string | null>(null)
  const [gameEvents, setGameEvents] = useState<string[]>([])

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

  const updateCharacter = useCallback((updated: Character) => {
    setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c))
  }, [])

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
    const date = new Date().toISOString().split('T')[0]
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
