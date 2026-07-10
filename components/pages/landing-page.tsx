import { Button } from '@/components/ui/button'
import { Castle, Coins, ScrollText, Shield, Skull, Sword, TrendingUp } from 'lucide-react'

export default function LandingPage({ onStartAdventure }: { onStartAdventure: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-16 md:py-24">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_center,rgba(214,169,51,0.18),transparent_62%)]" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full border border-primary/60 bg-black/60 torch-glow">
            <Castle className="size-10 text-primary" />
          </div>
          <h1 className="rpg-title text-5xl md:text-7xl font-black mb-6">
            Reino dos Gastos
          </h1>
          <div className="rune-divider mx-auto mb-8 max-w-md" />
          <p className="text-xl md:text-2xl text-foreground mb-8">
            Desça à masmorra das finanças e transforme cada gasto em campanha.
          </p>
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            Crie guardiões para seus gastos, registre rituais diários, preserve ouro e enfrente o Boss Final de cada ciclo.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button 
              size="lg" 
              className="coin-sheen text-primary-foreground hover:brightness-110 text-lg px-8 font-bold"
              onClick={onStartAdventure}
            >
              <Sword /> Começar minha aventura
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 border-primary/60 text-primary hover:bg-primary/10"
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <ScrollText /> Entender como funciona
            </Button>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="rpg-title text-4xl font-bold text-center mb-16">Como funciona?</h2>
          
          <div className="grid md:grid-cols-5 gap-6">
            {[
              { num: 1, title: 'Crie um personagem', desc: 'Escolha um nome, uma classe e o gasto que ele representa' },
              { num: 2, title: 'Defina seu limite', desc: 'Informe quanto deseja gastar naquele ciclo' },
              { num: 3, title: 'Registre gastos', desc: 'Cada registro fortalece seu personagem' },
              { num: 4, title: 'Ganhe XP e evolua', desc: 'Suba de nível e melhore seus atributos' },
              { num: 5, title: 'Enfrente o Boss', desc: 'Veja se venceu sua campanha financeira' },
            ].map((step) => (
              <div key={step.num} className="dungeon-panel rounded-lg p-6 text-center border border-border hover:border-primary/50 transition">
                <div className="coin-sheen w-12 h-12 text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {step.num}
                </div>
                <h3 className="font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example Character */}
      <section className="px-4 py-20 bg-black/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="rpg-title text-4xl font-bold text-center mb-12">Exemplo: O Dragão da Fatura</h2>
          
          <div className="dungeon-panel gold-frame border-2 rounded-lg p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-sm text-muted-foreground mb-2">REPRESENTA</p>
                <p className="text-2xl font-bold text-foreground mb-6">Cartão de Crédito</p>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tesouro Máximo</p>
                    <p className="text-2xl font-bold text-secondary">R$ 5.000</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cota de Jornada</p>
                    <p className="text-2xl font-bold text-secondary">R$ 150/dia</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">STATUS</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Vida</p>
                    <p className="text-2xl font-bold text-accent">10/10</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nível</p>
                    <p className="text-2xl font-bold text-primary">Nv. 1</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black/50 rounded p-4 border border-border">
              <p className="text-foreground italic">
                "O Dragão da Fatura está pronto para iniciar a jornada. Registre seus gastos diariamente para mantê-lo vivo."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="rpg-title text-4xl font-bold text-center mb-8">
            Controle financeiro sem planilha chata
          </h2>
          <p className="text-lg text-foreground text-center mb-12">
            No Reino dos Gastos, o foco não é te culpar por gastar. O foco é te ajudar a olhar para seus gastos todos os dias.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="dungeon-panel rounded-lg p-6 border border-border text-center">
              <ScrollText className="mx-auto mb-3 size-8 text-primary" />
              <h3 className="font-bold text-foreground mb-2">Registrar</h3>
              <p className="text-sm text-muted-foreground">É o comportamento principal</p>
            </div>
            <div className="dungeon-panel rounded-lg p-6 border border-border text-center">
              <Coins className="mx-auto mb-3 size-8 text-primary" />
              <h3 className="font-bold text-foreground mb-2">Economizar</h3>
              <p className="text-sm text-muted-foreground">É o bônus</p>
            </div>
            <div className="dungeon-panel rounded-lg p-6 border border-border text-center">
              <Shield className="mx-auto mb-3 size-8 text-primary" />
              <h3 className="font-bold text-foreground mb-2">Vitória</h3>
              <p className="text-sm text-muted-foreground">Fechar abaixo do limite</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 bg-primary/10 border-t border-primary/20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-5 flex justify-center gap-4 text-primary">
            <Skull className="size-6" />
            <TrendingUp className="size-6" />
          </div>
          <h2 className="rpg-title text-4xl font-bold mb-6">Entre no Reino dos Gastos</h2>
          <p className="text-lg text-foreground mb-8">
            Comece criando seu primeiro personagem financeiro e transforme seu próximo ciclo em uma aventura.
          </p>
          <Button 
            size="lg" 
            className="coin-sheen text-primary-foreground hover:brightness-110 text-lg px-8 font-bold"
            onClick={onStartAdventure}
          >
            Entrar no Portão
          </Button>
        </div>
      </section>
    </div>
  )
}
