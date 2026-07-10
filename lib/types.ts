// ─── Core types for Reino dos Gastos ────────────────────────────────────────

export type CharacterClass = 'guerreiro' | 'mago' | 'ladino'

export type Category =
  | 'Cartão de Crédito'
  | 'Alimentação / Delivery'
  | 'Transporte'
  | 'Mercado / Supermercado'
  | 'Lazer / Entretenimento'
  | 'Compras Diversas'
  | 'Saúde'
  | 'Casa / Doméstico'

export interface Attributes {
  vigor: number       // +2 vida máxima por ponto
  regeneracao: number // +1 vida recuperada por nível (base 1, nível 3→2, nível 6→3)
  sabedoria: number   // +5% XP base por registro
  disciplina: number  // +XP bônus por gastar abaixo da Cota de Jornada
  prosperidade: number // +multiplicador final do Boss Final
  resiliencia: number // -2% dano por esquecimento (max 30%)
}

export type EquipmentSlot = 'head' | 'armor' | 'gloves' | 'weapon'
export type ConsumableItemId = 'pocao_pequena' | 'pocao_grande'

export interface InventoryItem {
  itemId: ConsumableItemId
  quantity: number
}

export type EquipmentLevels = Record<EquipmentSlot, number>

export interface BattleLog {
  date: string
  count: number
}

export interface DailyRecord {
  date: string // ISO date
  amount: number
  xpGained: number
  registered: boolean
}

export interface CycleHistory {
  cycleStart: string
  cycleEnd: string
  maxTreasure: number
  journeyMarker: number
  totalSpent: number
  goldPreserved: number
  daysRegistered: number
  daysTotal: number
  bestCombo: number
  xpTotal: number
  result: 'defeat' | 'survived' | 'victory' | 'epic' | 'legendary'
  dailyRecords: DailyRecord[]
}

export interface Character {
  id: string
  name: string
  class: CharacterClass
  category: Category
  // Ciclo atual
  cycleStart: string
  cycleEnd: string
  maxTreasure: number
  journeyMarker: number       // Marco Inicial da Jornada
  journeyMarkerXpGranted: boolean
  // Vida
  life: number
  maxLife: number
  // Progressão
  level: number
  xp: number
  xpToNextLevel: number
  attributePoints: number     // pontos disponíveis para distribuir
  attributes: Attributes
  // Ciclo atual - registros
  dailyRecords: DailyRecord[]
  combo: number               // Combo de Disciplina atual
  bestCombo: number
  specialUsed: boolean        // habilidade especial já usada no ciclo
  lastBreathUsed: boolean     // Último Fôlego (Guerreiro) — só 1x por ciclo
  sealUsed: boolean           // Selo da Exceção (Mago)
  masterStrikeUsedThisWeek: boolean // Golpe de Mestre (Sombra do Saldo)
  inventory: InventoryItem[]
  equipmentLevels: EquipmentLevels
  battleLog: BattleLog[]
  // Persistência / ciclo
  lastProcessedDate?: string
  goldChest?: number // Baú do Ouro Preservado acumulado
  lastBreathRecoveryDays?: number // missão de recuperação do Guerreiro
  // Histórico
  cycleHistory: CycleHistory[]
}

// ─── CLASS DEFINITIONS ──────────────────────────────────────────────────────

export interface ClassDefinition {
  id: CharacterClass
  name: string
  subtitle: string
  style: string
  description: string
  bonuses: string[]
  specialName: string
  specialDescription: string
  idealFor: string[]
  imageSrc: string
  imageStages: ClassImageStage[]
  startingAttributes: Attributes
  lifeBonus: number   // multiplicador em cima da vida base (ex: 1.3 = +30%)
  damageMod: number   // multiplicador de dano por esquecimento (ex: 0.9 = -10%)
}

export interface ClassImageStage {
  minLevel: number
  label: string
  src: string
}

export const CLASSES: ClassDefinition[] = [
  {
    id: 'guerreiro',
    name: 'Guerreiro do Cofre',
    subtitle: 'Tanque — resistente e constante',
    style: 'Vida alta, aguenta melhor os erros. Ideal para iniciantes.',
    description:
      'O Guerreiro do Cofre é a classe mais resistente do Reino. Com mais vida máxima e menor dano por esquecimento, ele aguenta melhor os dias em que o controle falha. A habilidade especial Último Fôlego dá uma segunda chance antes da morte — bom para quem está aprendendo o hábito de registrar.',
    bonuses: [
      '+30% de vida máxima',
      '-10% de dano por esquecimento (Maldição do Esquecimento)',
      'Regeneração de vida ligeiramente maior',
    ],
    specialName: 'Último Fôlego',
    specialDescription:
      'Uma vez por ciclo, se a vida chegar a zero, o Guerreiro não morre imediatamente. Ele fica com 1 ponto de vida e ativa uma missão de recuperação: registrar gastos por 3 dias seguidos. Se completar, recupera parte da vida. Se falhar, morre de verdade.',
    idealFor: ['Cartão de crédito', 'Mercado / supermercado', 'Categorias difíceis de controlar', 'Usuários iniciantes'],
    imageSrc: '/classes/guerreiro-do-cofre.png',
    imageStages: [
      { minLevel: 1, label: 'Nv. 1', src: '/classes/guerreiro-do-cofre-lv1.png' },
      { minLevel: 2, label: 'Nv. 2', src: '/classes/guerreiro-do-cofre-lv2.png' },
      { minLevel: 5, label: 'Nv. 5', src: '/classes/guerreiro-do-cofre-lv5.png' },
      { minLevel: 10, label: 'Nv. 10+', src: '/classes/guerreiro-do-cofre.png' },
    ],
    startingAttributes: { vigor: 2, regeneracao: 1, sabedoria: 0, disciplina: 0, prosperidade: 0, resiliencia: 2 },
    lifeBonus: 1.3,
    damageMod: 0.9,
  },
  {
    id: 'mago',
    name: 'Mago do Orçamento',
    subtitle: 'Estrategista — XP e multiplicadores',
    style: 'Inteligência, bônus e planejamento. Ideal para otimizadores.',
    description:
      'O Mago do Orçamento é a classe estratégica. Ganha mais XP por registro e por economia diária, e tem um multiplicador melhor ao fechar o ciclo abaixo do limite. A habilidade especial Selo da Exceção permite marcar um dia como exceção planejada — sem perder combo, sem tomar dano.',
    bonuses: [
      '+15% de XP por registro diário',
      '+20% de XP bônus por economia diária (Ouro Preservado do Dia)',
      'Multiplicador final melhor se fechar abaixo do Tesouro Máximo',
    ],
    specialName: 'Selo da Exceção',
    specialDescription:
      'Uma vez por ciclo, o Mago pode marcar um dia como exceção planejada (viagem, aniversário, emergência). Nesse dia: não toma dano por não registrar, não quebra o Combo de Disciplina, mas também não ganha XP bônus.',
    idealFor: ['Alimentação / comida', 'Lazer', 'Compras pessoais', 'Categorias com muita variação'],
    imageSrc: '/classes/mago-do-orcamento.png',
    imageStages: [
      { minLevel: 1, label: 'Nv. 1', src: '/classes/mago-do-orcamento-lv1.png' },
      { minLevel: 2, label: 'Nv. 2', src: '/classes/mago-do-orcamento-lv2.png' },
      { minLevel: 5, label: 'Nv. 5', src: '/classes/mago-do-orcamento-lv5.png' },
      { minLevel: 10, label: 'Nv. 10+', src: '/classes/mago-do-orcamento.png' },
    ],
    startingAttributes: { vigor: 0, regeneracao: 0, sabedoria: 3, disciplina: 1, prosperidade: 1, resiliencia: 0 },
    lifeBonus: 1.0,
    damageMod: 1.0,
  },
  {
    id: 'ladino',
    name: 'Sombra do Saldo',
    subtitle: 'Oportunista — sequências e bônus agressivos',
    style: 'Rápido, focado em economia. Ideal para quem quer cortar gastos.',
    description:
      'A Sombra do Saldo é focada em sequências e economia agressiva. Ganha muito XP quando gasta menos da metade da Cota de Jornada e sobe o Combo de Disciplina mais rápido. A habilidade Golpe de Mestre dobra o XP bônus uma vez por semana nos dias de gasto muito baixo.',
    bonuses: [
      '+25% de XP quando gasta menos de 50% da Cota de Jornada',
      'Combo de Disciplina sobe mais rápido',
      'Chance de recompensas extras em dias de gasto zero (futuramente)',
    ],
    specialName: 'Golpe de Mestre',
    specialDescription:
      'Uma vez por semana, se o gasto do dia for menor que 50% da Cota de Jornada, a Sombra do Saldo dobra o XP bônus daquele dia. Exemplo: Cota de Jornada R$ 150, gastou R$ 40 → XP bônus é dobrado.',
    idealFor: ['Delivery / comida', 'Compras impulsivas', 'Lazer', 'Pequenos gastos recorrentes'],
    imageSrc: '/classes/sombra-do-saldo.png',
    imageStages: [
      { minLevel: 1, label: 'Nv. 1', src: '/classes/sombra-do-saldo-lv1.png' },
      { minLevel: 2, label: 'Nv. 2', src: '/classes/sombra-do-saldo-lv2.png' },
      { minLevel: 5, label: 'Nv. 5', src: '/classes/sombra-do-saldo-lv5.png' },
      { minLevel: 10, label: 'Nv. 10+', src: '/classes/sombra-do-saldo.png' },
    ],
    startingAttributes: { vigor: 0, regeneracao: 0, sabedoria: 1, disciplina: 3, prosperidade: 1, resiliencia: 0 },
    lifeBonus: 1.0,
    damageMod: 1.0,
  },
]

export function classImageForLevel(classDef: ClassDefinition, level: number): ClassImageStage {
  return classDef.imageStages
    .filter(stage => level >= stage.minLevel)
    .at(-1) ?? classDef.imageStages[0]
}

export function nextClassImageStage(classDef: ClassDefinition, level: number): ClassImageStage | null {
  return classDef.imageStages.find(stage => stage.minLevel > level) ?? null
}

export const CATEGORIES: Category[] = [
  'Cartão de Crédito',
  'Alimentação / Delivery',
  'Transporte',
  'Mercado / Supermercado',
  'Lazer / Entretenimento',
  'Compras Diversas',
  'Saúde',
  'Casa / Doméstico',
]

// ─── ATTRIBUTE DEFINITIONS ──────────────────────────────────────────────────

export interface AttributeDefinition {
  key: keyof Attributes
  name: string
  financialName: string
  description: string
  effect: string
  goodFor: string
}

export const ATTRIBUTE_DEFINITIONS: AttributeDefinition[] = [
  {
    key: 'vigor',
    name: 'Vigor',
    financialName: 'Resistência',
    description:
      'Vigor aumenta a resistência do personagem. Em termos práticos, permite que você tenha mais margem antes de perder o personagem por falta de registro.',
    effect: 'Cada ponto em Vigor dá +2 de vida máxima.',
    goodFor: 'Usuários que esquecem de registrar às vezes.',
  },
  {
    key: 'regeneracao',
    name: 'Regeneração',
    financialName: 'Cura do Cofre',
    description:
      'Regeneração representa a capacidade de recuperação do personagem. Em finanças reais, simboliza a volta ao controle depois de dias ruins.',
    effect: 'Nível 0: recupera 1 vida. Nível 3: recupera 2. Nível 6: recupera 3.',
    goodFor: 'Usuários que querem se recuperar mais rápido de falhas.',
  },
  {
    key: 'sabedoria',
    name: 'Sabedoria',
    financialName: 'Consciência Financeira',
    description:
      'Sabedoria valoriza a consciência financeira. Quanto maior esse atributo, mais o app recompensa o hábito de registrar seus gastos.',
    effect: 'Cada ponto aumenta em 5% o XP base do Ritual de Registro.',
    goodFor: 'Usuários que querem evoluir pela constância.',
  },
  {
    key: 'disciplina',
    name: 'Disciplina',
    financialName: 'Controle Diário',
    description:
      'Disciplina recompensa os dias em que você consegue gastar menos do que o planejado. Em finanças reais, representa sua capacidade de seguir o orçamento diário.',
    effect: 'Aumenta o XP bônus por gastar abaixo da Cota de Jornada.',
    goodFor: 'Usuários que querem economizar mais.',
  },
  {
    key: 'prosperidade',
    name: 'Prosperidade',
    financialName: 'Resultado do Ciclo',
    description:
      'Prosperidade recompensa o resultado do ciclo inteiro. Em finanças reais, representa sua capacidade de terminar o mês com dinheiro preservado.',
    effect: 'Aumenta o multiplicador final se o ciclo fechar abaixo do Tesouro Máximo. Sem: 1.2x. Com alto: 1.5x.',
    goodFor: 'Usuários que querem maximizar o XP do Boss Final.',
  },
  {
    key: 'resiliencia',
    name: 'Resiliência',
    financialName: 'Recuperação de Falhas',
    description:
      'Resiliência reduz o impacto de esquecer um registro, mas nunca elimina completamente a punição. Em finanças reais, representa sua capacidade de se recuperar de pequenas falhas.',
    effect: 'Cada ponto reduz 2% do dano por esquecimento (máximo 30%). O dano nunca chega a zero.',
    goodFor: 'Usuários com rotina imprevisível.',
  },
]

// ─── XP TABLE ───────────────────────────────────────────────────────────────

export const XP_TABLE: number[] = [
  0,    // level 0 (não usado)
  100,  // level 1 → 2
  150,  // level 2 → 3
  220,  // level 3 → 4
  320,  // level 4 → 5
  450,  // level 5 → 6
  620,  // level 6 → 7
  840,  // level 7 → 8
  1120, // level 8 → 9
  1460, // level 9 → 10
  1860, // level 10+
]

export function xpForLevel(level: number): number {
  if (level <= 0) return 100
  if (level >= XP_TABLE.length) return XP_TABLE[XP_TABLE.length - 1] + (level - XP_TABLE.length + 1) * 500
  return XP_TABLE[level]
}

export function levelTitle(level: number): string {
  if (level < 5) return 'Recruta do Cofre'
  if (level < 10) return 'Aprendiz do Cofre'
  if (level < 15) return 'Guardião Financeiro'
  if (level < 20) return 'Mestre da Fatura'
  return 'Lenda do Orçamento'
}

export const DEFAULT_EQUIPMENT_LEVELS: EquipmentLevels = {
  head: 0,
  armor: 0,
  gloves: 0,
  weapon: 0,
}

export const CONSUMABLE_ITEMS: Record<ConsumableItemId, {
  id: ConsumableItemId
  name: string
  description: string
  price: number
  heal: number
  imageSrc: string
}> = {
  pocao_pequena: {
    id: 'pocao_pequena',
    name: 'Poção Menor de Vida',
    description: 'Recupera 5 de vida.',
    price: 35,
    heal: 5,
    imageSrc: '/items/pocao-pequena.png',
  },
  pocao_grande: {
    id: 'pocao_grande',
    name: 'Poção Maior de Vida',
    description: 'Recupera 12 de vida.',
    price: 85,
    heal: 12,
    imageSrc: '/items/pocao-grande.png',
  },
}

export const GOLD_REWARD_IMAGE_SRC = '/items/ouro-do-bau.png'

export const EQUIPMENT_SLOTS: Record<EquipmentSlot, {
  slot: EquipmentSlot
  name: string
  baseName: string
  attribute: keyof Attributes
  imageSrc: string
}> = {
  head: { slot: 'head', name: 'Capacete', baseName: 'Elmo do Juízo', attribute: 'resiliencia', imageSrc: '/items/elmo-do-juizo.png' },
  armor: { slot: 'armor', name: 'Armadura', baseName: 'Armadura do Lastro', attribute: 'vigor', imageSrc: '/items/armadura-do-lastro.png' },
  gloves: { slot: 'gloves', name: 'Luvas', baseName: 'Luvas da Disciplina', attribute: 'disciplina', imageSrc: '/items/luvas-da-disciplina.png' },
  weapon: { slot: 'weapon', name: 'Arma', baseName: 'Arma de Classe', attribute: 'sabedoria', imageSrc: '/items/espada-do-tesouro.png' },
}

export function weaponNameForClass(characterClass: CharacterClass): string {
  if (characterClass === 'mago') return 'Cajado do Orçamento'
  if (characterClass === 'ladino') return 'Adagas do Saldo'
  return 'Espada do Tesouro'
}

export function weaponImageForClass(characterClass: CharacterClass): string {
  if (characterClass === 'mago') return '/items/cajado-do-orcamento.png'
  if (characterClass === 'ladino') return '/items/adagas-do-saldo.png'
  return '/items/espada-do-tesouro.png'
}

export function equipmentPrice(nextLevel: number): number {
  return Math.round(90 * Math.pow(1.75, nextLevel - 1))
}

export function equipmentBonusValue(level: number): number {
  return level <= 0 ? 0 : Math.floor((level + 1) / 2)
}

export function calcEquipmentAttributes(character: Character): Attributes {
  const equipment = character.equipmentLevels ?? DEFAULT_EQUIPMENT_LEVELS
  const bonus: Attributes = { vigor: 0, regeneracao: 0, sabedoria: 0, disciplina: 0, prosperidade: 0, resiliencia: 0 }

  bonus.resiliencia += equipmentBonusValue(equipment.head)
  bonus.vigor += equipmentBonusValue(equipment.armor)
  bonus.disciplina += equipmentBonusValue(equipment.gloves)

  const weaponBonus = equipmentBonusValue(equipment.weapon)
  if (character.class === 'guerreiro') bonus.vigor += weaponBonus
  if (character.class === 'mago') bonus.sabedoria += weaponBonus
  if (character.class === 'ladino') bonus.disciplina += weaponBonus

  if (equipment.gloves >= 5) bonus.regeneracao += 1
  if (equipment.weapon >= 7) bonus.prosperidade += 1

  return bonus
}

export function calcEffectiveAttributes(character: Character): Attributes {
  const equip = calcEquipmentAttributes(character)
  return {
    vigor: character.attributes.vigor + equip.vigor,
    regeneracao: character.attributes.regeneracao + equip.regeneracao,
    sabedoria: character.attributes.sabedoria + equip.sabedoria,
    disciplina: character.attributes.disciplina + equip.disciplina,
    prosperidade: character.attributes.prosperidade + equip.prosperidade,
    resiliencia: character.attributes.resiliencia + equip.resiliencia,
  }
}

export function normalizeCharacter(character: Character): Character {
  return {
    ...character,
    inventory: character.inventory ?? [],
    equipmentLevels: { ...DEFAULT_EQUIPMENT_LEVELS, ...(character.equipmentLevels ?? {}) },
    battleLog: character.battleLog ?? [],
    goldChest: character.goldChest ?? 0,
  }
}

// ─── GAME CALCULATIONS ──────────────────────────────────────────────────────

export function calcMaxLife(level: number, attributes: Attributes, classDef: ClassDefinition): number {
  const base = 10 + (level - 1) * 2
  const vigorBonus = attributes.vigor * 2
  return Math.round((base + vigorBonus) * classDef.lifeBonus)
}

export function calcJourneyQuota(maxTreasure: number, journeyMarker: number, daysInCycle: number): number {
  const available = maxTreasure - journeyMarker
  if (available <= 0 || daysInCycle <= 0) return 0
  return available / daysInCycle
}

export function calcDaysInCycle(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, diff)
}

export function calcDaysLeft(end: string): number {
  const today = new Date()
  const e = new Date(end)
  const diff = Math.round((e.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

export function calcOuroConsumido(character: Character): number {
  const fromRecords = character.dailyRecords.reduce((sum, r) => sum + r.amount, 0)
  return character.journeyMarker + fromRecords
}

export function calcRegistrationXP(
  amount: number,
  quota: number,
  attributes: Attributes,
  classDef: ClassDefinition
): { base: number; daily: number; bonus: number; total: number } {
  const sabedoriaMult = 1 + attributes.sabedoria * 0.05
  const base = Math.round(10 * sabedoriaMult * (classDef.id === 'mago' ? 1.15 : 1))

  const daily = 5

  let bonus = 0
  if (amount < quota) {
    const saved = quota - amount
    const ratio = saved / quota
    const disciplinaMult = 1 + attributes.disciplina * 0.1
    const ladinoBonusMult = classDef.id === 'ladino' && amount < quota * 0.5 ? 1.25 : 1
    const magoMult = classDef.id === 'mago' ? 1.2 : 1
    bonus = Math.round(20 * ratio * disciplinaMult * ladinoBonusMult * magoMult)
  }

  return { base, daily, bonus, total: base + daily + bonus }
}

export function calcDamage(level: number, attributes: Attributes): { min: number; max: number } {
  let min: number, max: number
  if (level <= 4) { min = 2; max = 4 }
  else if (level <= 9) { min = 3; max = 6 }
  else if (level <= 14) { min = 5; max = 8 }
  else { min = 7; max = 12 }
  const resilienciaMod = Math.min(0.3, attributes.resiliencia * 0.02)
  return {
    min: Math.max(1, Math.round(min * (1 - resilienciaMod))),
    max: Math.max(1, Math.round(max * (1 - resilienciaMod))),
  }
}

export function createCharacter(params: {
  name: string
  class: CharacterClass
  category: Category
  maxTreasure: number
  cycleStart: string
  cycleEnd: string
  journeyMarker: number
}): Character {
  const classDef = CLASSES.find(c => c.id === params.class)!
  const attrs = { ...classDef.startingAttributes }
  const maxLife = calcMaxLife(1, attrs, classDef)
  return {
    id:  `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: params.name,
    class: params.class,
    category: params.category,
    cycleStart: params.cycleStart,
    cycleEnd: params.cycleEnd,
    maxTreasure: params.maxTreasure,
    journeyMarker: params.journeyMarker,
    journeyMarkerXpGranted: true,
    life: maxLife,
    maxLife,
    level: 1,
    xp: 20, // +20 XP por configurar o Marco Inicial
    xpToNextLevel: xpForLevel(1),
    attributePoints: 0,
    attributes: attrs,
    dailyRecords: [],
    combo: 0,
    bestCombo: 0,
    specialUsed: false,
    lastBreathUsed: false,
    sealUsed: false,
    masterStrikeUsedThisWeek: false,
    inventory: [],
    equipmentLevels: { ...DEFAULT_EQUIPMENT_LEVELS },
    battleLog: [],
    goldChest: 0,
    cycleHistory: [],
  }
}
