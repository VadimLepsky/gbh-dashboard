import type {
  CommissionProfile,
  InstitutionType,
  Kraj,
  LeadSource,
  OpenStage,
  Product,
  SalesRole,
  Stage,
  Team,
} from './types'

export const TEAMS: Team[] = [
  { id: 'cechy', name: 'Čechy' },
  { id: 'morava', name: 'Morava' },
]

export const KRAJE: Kraj[] = [
  { id: 'KVK', name: 'Karlovarský', short: 'KV', teamId: 'cechy', col: 0, row: 0 },
  { id: 'ULK', name: 'Ústecký', short: 'ÚL', teamId: 'cechy', col: 1, row: 0 },
  { id: 'LBK', name: 'Liberecký', short: 'LB', teamId: 'cechy', col: 2, row: 0 },
  { id: 'HKK', name: 'Královéhradecký', short: 'HK', teamId: 'cechy', col: 3, row: 0 },
  { id: 'PLK', name: 'Plzeňský', short: 'PL', teamId: 'cechy', col: 0, row: 1 },
  { id: 'STC', name: 'Středočeský', short: 'SČ', teamId: 'cechy', col: 1, row: 1 },
  { id: 'PHA', name: 'Praha', short: 'PHA', teamId: 'cechy', col: 2, row: 1 },
  { id: 'PAK', name: 'Pardubický', short: 'PA', teamId: 'cechy', col: 3, row: 1 },
  { id: 'OLK', name: 'Olomoucký', short: 'OL', teamId: 'morava', col: 4, row: 1 },
  { id: 'MSK', name: 'Moravskoslezský', short: 'MS', teamId: 'morava', col: 5, row: 1 },
  { id: 'JHC', name: 'Jihočeský', short: 'JČ', teamId: 'cechy', col: 1, row: 2 },
  { id: 'VYS', name: 'Vysočina', short: 'VY', teamId: 'morava', col: 2, row: 2 },
  { id: 'JHM', name: 'Jihomoravský', short: 'JM', teamId: 'morava', col: 3, row: 2 },
  { id: 'ZLK', name: 'Zlínský', short: 'ZL', teamId: 'morava', col: 4, row: 2 },
]

export const PRODUCTS: Product[] = [
  { id: 'kyber', name: 'Kybernetická bezpečnost pro zaměstnance', shortName: 'Kyberbezpečnost', unitCostShare: 0.36, recurring: false },
  { id: 'krize', name: 'Krizové řízení a evakuace', shortName: 'Krizové řízení', unitCostShare: 0.42, recurring: false },
  { id: 'objekty', name: 'Ochrana objektů a osob', shortName: 'Ochrana objektů', unitCostShare: 0.48, recurring: false },
  { id: 'utocnik', name: 'Útok aktivního útočníka', shortName: 'Aktivní útočník', unitCostShare: 0.46, recurring: false },
  { id: 'management', name: 'Bezpečnostní management pro vedoucí', shortName: 'Management', unitCostShare: 0.31, recurring: false },
  { id: 'ramcova', name: 'Roční rámcová smlouva', shortName: 'Rámcová smlouva', unitCostShare: 0.35, recurring: true },
]

export const SOURCES: LeadSource[] = [
  { id: 'cold_call', name: 'Cold call' },
  { id: 'webinar', name: 'Webinář' },
  { id: 'referral', name: 'Doporučení' },
  { id: 'tender', name: 'Veřejná zakázka' },
  { id: 'inbound', name: 'Web / inbound' },
  { id: 'fair', name: 'Veletrh' },
]

/** Standard payment term on invoices, days. */
export const PAYMENT_TERM_DAYS = 14

export const STAGE_PROBABILITY: Record<Stage, number> = {
  Kontakt: 0.1,
  Kvalifikace: 0.25,
  Nabídka: 0.5,
  Vyjednávání: 0.75,
  'Smlouva k podpisu': 0.9,
  Vyhráno: 1,
  Prohráno: 0,
}

export const NEXT_STEP_BY_STAGE: Record<OpenStage, string[]> = {
  Kontakt: ['Kvalifikační hovor', 'Zjistit odpovědnou osobu', 'Úvodní schůzka'],
  Kvalifikace: ['Schůzka s vedením', 'Ověřit rozpočet', 'Analýza potřeb'],
  Nabídka: ['Odeslat nabídku', 'Prezentace nabídky', 'Doplnit referenční list'],
  Vyjednávání: ['Jednání o ceně', 'Upravit rozsah školení', 'Schůzka s ekonomem'],
  'Smlouva k podpisu': ['Připomínky ke smlouvě', 'Urgovat podpis', 'Ověřit podpisové právo'],
}

const BANDS = [
  { min: 0, max: 0.8, coefficient: 0.8, label: '< 80 %' },
  { min: 0.8, max: 1.0, coefficient: 1.0, label: '80–100 %' },
  { min: 1.0, max: 1.2, coefficient: 1.15, label: '100–120 %' },
  { min: 1.2, max: null, coefficient: 1.3, label: '> 120 %' },
]

export const COMMISSION_PROFILES: CommissionProfile[] = [
  { id: 'cp-junior', role: 'Junior', baseRate: 0.04, bands: BANDS },
  { id: 'cp-obchodnik', role: 'Obchodník', baseRate: 0.05, bands: BANDS },
  { id: 'cp-senior', role: 'Senior', baseRate: 0.06, bands: BANDS },
]

export const PROFILE_BY_ROLE: Record<SalesRole, string> = {
  Junior: 'cp-junior',
  Obchodník: 'cp-obchodnik',
  Senior: 'cp-senior',
}

/** Deal size range per institution type, Kč. */
export const VALUE_RANGE: Record<InstitutionType, [number, number]> = {
  Škola: [40_000, 90_000],
  'Městský úřad': [60_000, 150_000],
  'Krajský úřad': [120_000, 400_000],
  Nemocnice: [120_000, 400_000],
  Ministerstvo: [300_000, 1_200_000],
  'Složka IZS': [70_000, 220_000],
  'Státní podnik': [150_000, 500_000],
}

export const INSTITUTION_TYPES: InstitutionType[] = [
  'Ministerstvo',
  'Krajský úřad',
  'Městský úřad',
  'Nemocnice',
  'Škola',
  'Složka IZS',
  'Státní podnik',
]

/** Fictional ministries: none of these exists in the Czech government. */
export const MINISTRIES = [
  'Ministerstvo regionální správy',
  'Ministerstvo civilní připravenosti',
  'Ministerstvo digitálních služeb',
  'Ministerstvo vodního hospodářství',
  'Ministerstvo veřejné infrastruktury',
  'Ministerstvo státního majetku',
  'Ministerstvo technického rozvoje',
  'Ministerstvo pro krajinu a venkov',
]

export const SOFT_PREFIXES = ['Dolní', 'Horní', 'Zadní', 'Přední', 'Prostřední']
export const FEM_PREFIXES = ['Nová', 'Stará', 'Velká', 'Malá', 'Vysoká', 'Zelená', 'Tichá', 'Studená']
export const FEM_ROOTS = [
  'Bělá', 'Lhota', 'Ves', 'Lipnice', 'Lhotka', 'Bystrá', 'Hora', 'Lukavice', 'Radonice', 'Struha',
  'Rovná', 'Smrčina', 'Vranová', 'Kamenice', 'Rybná', 'Javorná', 'Olešná', 'Habrová', 'Doubrava', 'Libnice',
]
export const MASC_ROOTS = ['Újezd', 'Dvůr', 'Mlýn', 'Brod', 'Hradec', 'Chlum', 'Kopec', 'Rybník']
export const SINGLE_NAMES = [
  'Vlčkovice', 'Brodec', 'Lipovany', 'Stráňov', 'Kostelnice', 'Ostrovany', 'Javornice', 'Bukovina',
  'Hrabůvky', 'Pasekov', 'Mlýnice', 'Skalná Huť', 'Dubňany nad Lesem', 'Bělohrad nad Stružkou',
  'Kamenný Přívoz', 'Lomnička', 'Vranov u Lhotky', 'Zlatá Stružka',
]

export const INSTITUTION_PATTERNS: Record<Exclude<InstitutionType, 'Ministerstvo'>, string[]> = {
  'Krajský úřad': ['Krajský úřad {p}'],
  'Městský úřad': ['Městský úřad {p}'],
  Nemocnice: ['Nemocnice {p}', 'Městská nemocnice {p}', 'Oblastní nemocnice {p}'],
  Škola: ['Základní škola {p}', 'Gymnázium {p}', 'Střední odborná škola {p}'],
  'Složka IZS': ['Hasičský záchranný sbor {p}', 'Zdravotnická záchranná služba {p}', 'Městská policie {p}'],
  'Státní podnik': ['Lesy {p}, s. p.', 'Vodárny {p}, s. p.', 'Letiště {p}, s. p.'],
}

/** Institutions generated per kraj and type (ministries are added once, in Praha). */
export const INSTITUTIONS_PER_KRAJ: Record<Exclude<InstitutionType, 'Ministerstvo'>, number> = {
  'Krajský úřad': 1,
  'Městský úřad': 5,
  Nemocnice: 2,
  Škola: 5,
  'Složka IZS': 2,
  'Státní podnik': 1,
}
