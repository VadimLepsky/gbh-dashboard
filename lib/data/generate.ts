import { createRng, type Rng } from './prng'
import {
  addMonths,
  daysInMonth,
  fromDay,
  startOfMonth,
  toDay,
  weekdayOfDay,
} from './dates'
import {
  COMMISSION_PROFILES,
  FEM_PREFIXES,
  FEM_ROOTS,
  INSTITUTION_PATTERNS,
  INSTITUTIONS_PER_KRAJ,
  KRAJE,
  MASC_ROOTS,
  MINISTRIES,
  NEXT_STEP_BY_STAGE,
  PRODUCTS,
  PROFILE_BY_ROLE,
  SINGLE_NAMES,
  SOFT_PREFIXES,
  SOURCES,
  TEAMS,
  VALUE_RANGE,
} from './reference'
import {
  OPEN_STAGES,
  type Activity,
  type ActivityType,
  type BankPayment,
  type Contract,
  type Dataset,
  type Deal,
  type Institution,
  type InstitutionType,
  type Invoice,
  type LeadSourceId,
  type LostReason,
  type OpenStage,
  type SalesRole,
  type Salesperson,
  type Stage,
  type TeamId,
  type Tender,
} from './types'

const SEED = 0x6b482026
/** Simulation starts this many months before the current month (dashboards look back ≤ 24). */
const SIM_MONTHS = 26

/** State budget seasonality (Jan…Dec): dip in Jan–Feb, purchasing peak Oct–Dec. */
const SEASON = [0.6, 0.72, 0.95, 1.0, 1.0, 1.02, 0.95, 0.92, 1.0, 1.12, 1.25, 1.4]

const BASE_ADVANCE = [0.56, 0.62, 0.56, 0.78, 0.93]
const MEDIAN_DAYS = [5, 8, 10, 12, 5]
const TENDER_SPEED = [1.2, 1.5, 3.4, 1.5, 1.4]

const SOURCE_ADVANCE: Record<LeadSourceId, number[]> = {
  cold_call: [1.0, 0.95, 0.82, 1.0, 1.0],
  webinar: [1.12, 1.0, 1.0, 1.0, 1.0],
  referral: [1.32, 1.2, 1.2, 1.08, 1.02],
  tender: [1.4, 1.25, 0.78, 1.04, 1.0],
  inbound: [1.15, 1.02, 1.04, 1.0, 1.0],
  fair: [0.62, 0.9, 1.0, 0.98, 1.0],
}

const ROLE_ADVANCE: Record<SalesRole, number[]> = {
  Senior: [1.06, 1.06, 1.08, 1.06, 1.02],
  Obchodník: [1, 1, 1, 1, 1],
  Junior: [1, 0.97, 0.86, 0.92, 1],
}

const SOURCE_WEIGHTS: Record<SalesRole, number[]> = {
  // cold_call, webinar, referral, tender, inbound, fair
  Junior: [0.62, 0.1, 0.04, 0.04, 0.12, 0.08],
  Obchodník: [0.48, 0.1, 0.1, 0.12, 0.12, 0.08],
  Senior: [0.3, 0.08, 0.22, 0.22, 0.1, 0.08],
}
const SOURCE_IDS: LeadSourceId[] = ['cold_call', 'webinar', 'referral', 'tender', 'inbound', 'fair']

const TYPE_ORDER: InstitutionType[] = [
  'Škola',
  'Městský úřad',
  'Složka IZS',
  'Nemocnice',
  'Krajský úřad',
  'Státní podnik',
  'Ministerstvo',
]
const TYPE_WEIGHTS: Record<SalesRole, number[]> = {
  Junior: [0.38, 0.38, 0.14, 0.06, 0.04, 0, 0],
  Obchodník: [0.22, 0.3, 0.12, 0.14, 0.1, 0.08, 0.04],
  Senior: [0.08, 0.2, 0.1, 0.18, 0.16, 0.12, 0.16],
}

const PRODUCT_WEIGHTS = [0.26, 0.18, 0.14, 0.16, 0.12, 0.14]
const PRODUCT_VALUE_FACTOR: Record<string, number> = {
  kyber: 1,
  krize: 1.05,
  objekty: 1.1,
  utocnik: 1,
  management: 0.8,
  ramcova: 1.6,
}

const AVG_VALUE: Record<SalesRole, number> = { Junior: 85_000, Obchodník: 165_000, Senior: 300_000 }
const WIN_PROB = 0.15

interface RepConfig {
  id: string
  name: string
  initials: string
  role: SalesRole
  teamId: TeamId
  quota: number
  activityTarget: number
  callsPerDay: number
  startMonthsAgo: number
  /** Plan attainment the rep converges to, by months before the current month. */
  perf: (monthsAgo: number, monthsSinceStart: number) => number
  discipline: (monthsAgo: number) => number
  /** >1 = worse pipeline hygiene (missing next steps). */
  hygiene: (monthsAgo: number) => number
  noise: number
}

const REPS: RepConfig[] = [
  {
    id: 'jnovak', name: 'Jakub Novák', initials: 'JN', role: 'Senior', teamId: 'cechy',
    quota: 520_000, activityTarget: 105, callsPerDay: 3, startMonthsAgo: 98,
    perf: () => 1.26, discipline: () => 1.0, hygiene: () => 1.0, noise: 0.05,
  },
  {
    id: 'asvobodova', name: 'Anna Svobodová', initials: 'AS', role: 'Obchodník', teamId: 'cechy',
    quota: 360_000, activityTarget: 180, callsPerDay: 6, startMonthsAgo: 62,
    perf: () => 1.0, discipline: () => 1.0, hygiene: () => 0.9, noise: 0.1,
  },
  {
    id: 'mkucera', name: 'Martin Kučera', initials: 'MK', role: 'Obchodník', teamId: 'cechy',
    quota: 340_000, activityTarget: 180, callsPerDay: 6, startMonthsAgo: 41,
    perf: () => 0.95, discipline: () => 1.02, hygiene: () => 1.0, noise: 0.1,
  },
  {
    id: 'lmaresova', name: 'Lucie Marešová', initials: 'LM', role: 'Junior', teamId: 'cechy',
    quota: 220_000, activityTarget: 240, callsPerDay: 8.5, startMonthsAgo: 30,
    perf: () => 0.92, discipline: () => 1.04, hygiene: () => 1.0, noise: 0.1,
  },
  {
    id: 'phorak', name: 'Petr Horák', initials: 'PH', role: 'Obchodník', teamId: 'morava',
    quota: 360_000, activityTarget: 180, callsPerDay: 6, startMonthsAgo: 75,
    perf: (ago) => (ago >= 4 ? 1.02 : [0.4, 0.52, 0.66, 0.8][ago]),
    discipline: (ago) => (ago >= 4 ? 1.0 : [0.34, 0.6, 0.72, 0.86][ago]),
    hygiene: (ago) => (ago >= 4 ? 1.0 : 1.7),
    noise: 0.06,
  },
  {
    id: 'eprochazkova', name: 'Eva Procházková', initials: 'EP', role: 'Obchodník', teamId: 'morava',
    quota: 340_000, activityTarget: 180, callsPerDay: 6, startMonthsAgo: 28,
    perf: () => 1.05, discipline: () => 1.0, hygiene: () => 0.9, noise: 0.1,
  },
  {
    id: 'tdvorak', name: 'Tomáš Dvořák', initials: 'TD', role: 'Junior', teamId: 'morava',
    quota: 200_000, activityTarget: 230, callsPerDay: 8.5, startMonthsAgo: 22,
    perf: () => 0.86, discipline: () => 0.93, hygiene: () => 1.8, noise: 0.1,
  },
  {
    id: 'opospisil', name: 'Ondřej Pospíšil', initials: 'OP', role: 'Junior', teamId: 'morava',
    quota: 200_000, activityTarget: 240, callsPerDay: 8.5, startMonthsAgo: 9,
    perf: (_ago, since) => [0.35, 0.55, 0.7, 0.8][since] ?? 0.85,
    discipline: () => 1.0, hygiene: () => 1.1, noise: 0.1,
  },
]

interface SimDeal {
  idx: number
  id: string
  rep: number
  inst: number
  product: number
  source: LeadSourceId
  value: number
  created: number
  history: { stage: Stage; day: number }[]
  outcome: 'won' | 'lost' | 'open'
  closed: number | null
  lostReason: LostReason | null
  lostAtStage: OpenStage | null
  isRenewal: boolean
  renewalOf: string | null
  hook: HookKind | null
  fixedValue: boolean
  expectedClose: number
  nextStep: number | null
  nextStepLabel: string | null
}

type HookKind = 'stuck_big' | 'overdue_invoice' | 'renewal_risk' | 'unsigned' | 'tender_deadline'

export function generateDataset(todayIso: string): Dataset {
  const rng = createRng(SEED)
  const today = toDay(todayIso)
  const todayYm = todayIso.slice(0, 7)
  const simStartIso = startOfMonth(addMonths(todayIso, -SIM_MONTHS))
  const simStart = toDay(simStartIso)
  const ymIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1
  const todayYmIdx = ymIndex(todayYm)
  const monthsAgoOf = (day: number) => todayYmIdx - ymIndex(fromDay(day))

  // ── Static entities ───────────────────────────────────────────────────────
  const salespeople: Salesperson[] = REPS.map((r) => ({
    id: r.id,
    name: r.name,
    initials: r.initials,
    role: r.role,
    teamId: r.teamId,
    monthlyQuota: r.quota,
    monthlyActivityTarget: r.activityTarget,
    commissionProfileId: PROFILE_BY_ROLE[r.role],
    startDate: startOfMonth(addMonths(todayIso, -r.startMonthsAgo)),
  }))
  const repStartDay = salespeople.map((s) => toDay(s.startDate))
  const repStartYmIdx = salespeople.map((s) => ymIndex(s.startDate.slice(0, 7)))

  const institutions = generateInstitutions(rng)
  const instByTeamType = new Map<string, number[]>()
  institutions.forEach((inst, i) => {
    const team = KRAJE.find((k) => k.id === inst.kraj)!.teamId
    const key = `${team}|${inst.type}`
    if (!instByTeamType.has(key)) instByTeamType.set(key, [])
    instByTeamType.get(key)!.push(i)
  })
  const pickInstitution = (repIdx: number, type: InstitutionType): number => {
    const team = REPS[repIdx].teamId
    // Ministries sit in Praha; Morava reps sell to them only rarely through tenders.
    const pool = instByTeamType.get(`${team}|${type}`) ?? instByTeamType.get(`cechy|${type}`)!
    return rng.pick(pool)
  }

  const sampleValue = (type: InstitutionType, productIdx: number): number => {
    const [min, max] = VALUE_RANGE[type]
    const raw = min + (max - min) * Math.pow(rng.next(), 1.5)
    return roundValue(raw * PRODUCT_VALUE_FACTOR[PRODUCTS[productIdx].id])
  }

  // ── Deal simulation ──────────────────────────────────────────────────────
  const sims: SimDeal[] = []

  const advanceProbability = (
    stageIdx: number,
    source: LeadSourceId,
    repIdx: number,
    day: number,
  ) => {
    const rep = REPS[repIdx]
    let p = BASE_ADVANCE[stageIdx] * SOURCE_ADVANCE[source][stageIdx] * ROLE_ADVANCE[rep.role][stageIdx]
    const ago = monthsAgoOf(day)
    if (rep.id === 'phorak' && ago <= 3) {
      if (stageIdx === 3) p *= 0.7
      if (stageIdx === 2) p *= 0.85
    }
    const month = Number(fromDay(day).slice(5, 7)) - 1
    if (month <= 1) p *= stageIdx >= 3 ? 0.86 : 0.95
    if (month >= 9 && stageIdx >= 3) p *= 1.04
    return Math.min(0.97, Math.max(0.05, p))
  }

  const lostReasonFor = (stageIdx: number, source: LeadSourceId, day: number): LostReason => {
    const month = Number(fromDay(day).slice(5, 7)) - 1
    const freeze = month <= 1 ? 2.2 : 1
    // Cena, Rozpočet zmrazen, Vybrán konkurent, Bez odezvy, Zrušená zakázka
    let w: number[]
    if (stageIdx <= 1) w = [0.05, 0.22 * freeze, 0.05, 0.6, source === 'tender' ? 0.25 : 0.06]
    else if (stageIdx === 2)
      w = [source === 'cold_call' ? 0.55 : 0.4, 0.14 * freeze, source === 'tender' ? 0.5 : 0.28, 0.12, source === 'tender' ? 0.12 : 0.03]
    else if (stageIdx === 3) w = [0.42, 0.2 * freeze, 0.32, 0.04, 0.04]
    else w = [0.1, 0.45 * freeze, 0.15, 0.05, 0.25]
    return rng.weighted(
      ['Cena', 'Rozpočet zmrazen', 'Vybrán konkurent', 'Bez odezvy', 'Zrušená zakázka'] as LostReason[],
      w,
    )
  }

  const stageDuration = (stageIdx: number, source: LeadSourceId, repIdx: number) => {
    let speed = source === 'tender' ? TENDER_SPEED[stageIdx] : 1
    const role = REPS[repIdx].role
    if (role === 'Senior') speed *= 0.9
    if (role === 'Junior') speed *= 1.1
    if (source === 'referral' && stageIdx === 0) speed *= 0.7
    return Math.max(1, Math.round(rng.logNormal(MEDIAN_DAYS[stageIdx] * speed, 0.55)))
  }

  const simulate = (sim: SimDeal) => {
    let day = sim.created
    for (let i = 0; i < OPEN_STAGES.length; i++) {
      const end = day + stageDuration(i, sim.source, sim.rep)
      if (end > today) {
        sim.outcome = 'open'
        return
      }
      if (rng.chance(advanceProbability(i, sim.source, sim.rep, end))) {
        const next: Stage = i < OPEN_STAGES.length - 1 ? OPEN_STAGES[i + 1] : 'Vyhráno'
        sim.history.push({ stage: next, day: end })
        day = end
        if (next === 'Vyhráno') {
          sim.outcome = 'won'
          sim.closed = end
          return
        }
      } else {
        sim.outcome = 'lost'
        sim.closed = end
        sim.lostAtStage = OPEN_STAGES[i]
        sim.lostReason = lostReasonFor(i, sim.source, end)
        sim.history.push({ stage: 'Prohráno', day: end })
        return
      }
    }
  }

  const newSim = (repIdx: number, created: number, source: LeadSourceId, inst: number, product: number, value: number): SimDeal => ({
    idx: sims.length,
    id: '',
    rep: repIdx,
    inst,
    product,
    source,
    value,
    created,
    history: [{ stage: 'Kontakt', day: created }],
    outcome: 'open',
    closed: null,
    lostReason: null,
    lostAtStage: null,
    isRenewal: false,
    renewalOf: null,
    hook: null,
    fixedValue: false,
    expectedClose: created,
    nextStep: null,
    nextStepLabel: null,
  })

  for (let r = 0; r < REPS.length; r++) {
    const rep = REPS[r]
    const from = Math.max(simStart, repStartDay[r])
    for (let day = from; day <= today; day++) {
      if (weekdayOfDay(day) >= 5) continue
      const closeDay = day + 40
      const ago = monthsAgoOf(closeDay)
      const since = ymIndex(fromDay(closeDay)) - repStartYmIdx[r]
      const season = SEASON[Number(fromDay(closeDay).slice(5, 7)) - 1]
      const perf = rep.perf(Math.max(0, ago), Math.max(0, since))
      const monthly = (rep.quota * Math.pow(perf, 0.7) * season) / (AVG_VALUE[rep.role] * WIN_PROB)
      const n = rng.poisson(monthly / 21.7)
      for (let k = 0; k < n; k++) {
        const source = rng.weighted(SOURCE_IDS, SOURCE_WEIGHTS[rep.role])
        const weights = TYPE_WEIGHTS[rep.role].map((w, i) =>
          source === 'tender' && i >= 3 ? w * 1.6 : w,
        )
        let type = rng.weighted(TYPE_ORDER, weights)
        if (type === 'Ministerstvo' && rep.teamId === 'morava' && source !== 'tender') type = 'Krajský úřad'
        const product = rng.weighted([0, 1, 2, 3, 4, 5], PRODUCT_WEIGHTS)
        const inst = pickInstitution(r, type)
        const sim = newSim(r, day, source, inst, product, sampleValue(type, product))
        simulate(sim)
        sims.push(sim)
      }
    }
  }

  // ── Story hooks (always relative to today) ──────────────────────────────
  const repIdx = (id: string) => REPS.findIndex((r) => r.id === id)
  const productIdx = (id: string) => PRODUCTS.findIndex((p) => p.id === id)
  const instOf = (team: TeamId, types: InstitutionType[]) =>
    pickInstitution(team === 'cechy' ? repIdx('jnovak') : repIdx('phorak'), rng.pick(types))

  const hook = (
    kind: HookKind,
    rep: string,
    inst: number,
    product: string,
    source: LeadSourceId,
    value: number,
    stages: [Stage, number][],
  ) => {
    const sim = newSim(repIdx(rep), today + stages[0][1], source, inst, productIdx(product), value)
    sim.history = stages.map(([stage, offset]) => ({ stage, day: today + offset }))
    const last = sim.history[sim.history.length - 1]
    if (last.stage === 'Vyhráno') {
      sim.outcome = 'won'
      sim.closed = last.day
    }
    sim.hook = kind
    sim.fixedValue = true
    sims.push(sim)
    return sim
  }

  const stuckAge = rng.int(44, 52)
  hook('stuck_big', 'jnovak', pickInstitution(repIdx('jnovak'), 'Ministerstvo'), 'management', 'referral',
    roundValue(rng.range(930_000, 1_150_000)),
    [['Kontakt', -stuckAge - 52], ['Kvalifikace', -stuckAge - 38], ['Nabídka', -stuckAge - 22], ['Vyjednávání', -stuckAge]])
  hook('overdue_invoice', 'asvobodova', instOf('cechy', ['Krajský úřad', 'Nemocnice']), 'krize', 'webinar',
    Math.round(rng.range(116_000, 126_000) / 100) * 100,
    [['Kontakt', -96], ['Kvalifikace', -88], ['Nabídka', -76], ['Vyjednávání', -63], ['Smlouva k podpisu', -54], ['Vyhráno', -48]])
  hook('renewal_risk', 'phorak', instOf('morava', ['Nemocnice', 'Krajský úřad']), 'ramcova', 'referral',
    roundValue(rng.range(420_000, 480_000)),
    [['Kontakt', -372], ['Kvalifikace', -365], ['Nabídka', -352], ['Vyjednávání', -340], ['Smlouva k podpisu', -330], ['Vyhráno', -324]])
  hook('unsigned', 'lmaresova', instOf('cechy', ['Městský úřad']), 'utocnik', 'cold_call',
    roundValue(rng.range(128_000, 148_000)),
    [['Kontakt', -52], ['Kvalifikace', -45], ['Nabídka', -34], ['Vyjednávání', -22], ['Smlouva k podpisu', -15], ['Vyhráno', -10]])
  hook('tender_deadline', 'eprochazkova', instOf('morava', ['Nemocnice', 'Krajský úřad']), 'krize', 'tender',
    roundValue(rng.range(320_000, 390_000)),
    [['Kontakt', -40], ['Kvalifikace', -28], ['Nabídka', -14]])

  /** Turns a lost deal into a win on the same close date (used to keep rep-months realistic). */
  const flipToWon = (flip: SimDeal) => {
    const closed = flip.closed!
    flip.history.pop()
    let stageIdx = OPEN_STAGES.indexOf(flip.lostAtStage!)
    let day = flip.history[flip.history.length - 1].day
    while (stageIdx < OPEN_STAGES.length - 1) {
      stageIdx++
      day = Math.min(closed - 1, day + 2)
      flip.history.push({ stage: OPEN_STAGES[stageIdx], day })
    }
    flip.history.push({ stage: 'Vyhráno', day: closed })
    flip.outcome = 'won'
    flip.lostAtStage = null
    flip.lostReason = null
  }

  // ── Make sure every finished rep-month has at least one win ─────────────
  const repMonthKey = (rep: number, day: number) => `${rep}|${fromDay(day).slice(0, 7)}`
  const wonByRepMonth = new Map<string, SimDeal[]>()
  const lostByRepMonth = new Map<string, SimDeal[]>()
  for (const s of sims) {
    if (s.closed === null) continue
    const key = repMonthKey(s.rep, s.closed)
    const map = s.outcome === 'won' ? wonByRepMonth : lostByRepMonth
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(s)
  }
  for (let r = 0; r < REPS.length; r++) {
    const first = Math.max(ymIndex(simStartIso.slice(0, 7)) + 2, repStartYmIdx[r] + 1)
    for (let m = first; m <= todayYmIdx; m++) {
      const ym = `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`
      if (m === todayYmIdx && Number(todayIso.slice(8, 10)) < 8) continue
      const key = `${r}|${ym}`
      if ((wonByRepMonth.get(key)?.length ?? 0) > 0) continue
      const candidates = (lostByRepMonth.get(key) ?? [])
        .filter((s) => !s.hook && s.lostAtStage)
        .sort((a, b) => OPEN_STAGES.indexOf(b.lostAtStage!) - OPEN_STAGES.indexOf(a.lostAtStage!))
      const flip = candidates[0]
      if (!flip) continue
      flipToWon(flip)
      wonByRepMonth.set(key, [flip])
    }
  }

  // ── Expected close & next steps for open deals ──────────────────────────
  for (const s of sims) {
    const rep = REPS[s.rep]
    if (s.outcome !== 'open') {
      s.expectedClose = s.closed! + rng.int(-12, 8)
      continue
    }
    const current = s.history[s.history.length - 1]
    const stageIdx = OPEN_STAGES.indexOf(current.stage as OpenStage)
    const inStage = today - current.day
    if (s.hook === 'stuck_big') {
      s.expectedClose = today - rng.int(28, 36)
      s.nextStep = null
      continue
    }
    if (s.hook === 'tender_deadline') {
      s.expectedClose = today + 40
      s.nextStep = today + 2
      s.nextStepLabel = 'Dokončit nabídku do VZ'
      continue
    }
    let remaining = 0
    for (let i = stageIdx; i < OPEN_STAGES.length; i++)
      remaining += MEDIAN_DAYS[i] * (s.source === 'tender' ? TENDER_SPEED[i] : 1)
    let expected = current.day + Math.round(remaining + rng.normal(0, 5))
    if (stageIdx === 4) expected = today + rng.int(1, 10)
    if (expected < today && rng.chance(0.55)) expected = today + rng.int(2, 25)
    s.expectedClose = expected

    const slow = inStage > 2 * MEDIAN_DAYS[stageIdx] * (s.source === 'tender' ? TENDER_SPEED[stageIdx] : 1)
    const hyg = rep.hygiene(0)
    const pNull = 0.1 * hyg + (slow ? 0.2 : 0)
    const pPast = 0.09 * hyg
    const roll = rng.next()
    if (roll < pNull) s.nextStep = null
    else if (roll < pNull + pPast) s.nextStep = today - rng.int(1, 18)
    else s.nextStep = today + (rng.chance(0.7) ? rng.int(1, 7) : rng.int(8, 16))
    if (s.nextStep !== null) s.nextStepLabel = rng.pick(NEXT_STEP_BY_STAGE[current.stage as OpenStage])
  }

  // Stable IDs: by creation day
  sims.sort((a, b) => a.created - b.created || a.idx - b.idx)
  let dealCounter = 4100
  for (const s of sims) s.id = `D-${dealCounter++}`

  // ── Contract schedule and renewals (dates only; values come after calibration) ──
  interface ContractPlan {
    id: string
    sim: SimDeal
    sent: number
    signed: number | null
    start: number
    end: number
    recurring: boolean
    renewal: SimDeal | null
  }
  const plans: ContractPlan[] = []
  const renewalSims: SimDeal[] = []
  const renewalSource = new Map<SimDeal, { plan: ContractPlan; factor: number }>()

  const planContract = (s: SimDeal, startOverride?: number): ContractPlan => {
    const recurring = PRODUCTS[s.product].recurring
    let sent = Math.min(today, s.closed! + rng.int(0, 2))
    let signed: number | null = sent + Math.min(25, Math.max(1, Math.round(rng.logNormal(3, 0.6))))
    if (s.hook === 'overdue_invoice') {
      sent = today - 47
      signed = today - 44
    } else if (s.hook === 'unsigned') {
      sent = today - 9
      signed = null
    } else if (s.hook === 'renewal_risk') {
      sent = today - 323
      signed = today - 320
    }
    if (signed !== null && signed > today) signed = null
    let start: number
    let end: number
    if (recurring) {
      start = startOverride ?? signed ?? sent + 5
      end = s.hook === 'renewal_risk' ? today + 45 : start + 365
    } else {
      start = signed ?? sent + 5
      end = start + rng.int(14, 50)
    }
    const plan: ContractPlan = {
      id: `SM-${String(plans.length + 1).padStart(4, '0')}`,
      sim: s,
      sent,
      signed,
      start,
      end,
      recurring,
      renewal: null,
    }
    plans.push(plan)
    return plan
  }

  const queue: ContractPlan[] = []
  for (const s of sims) {
    if (s.outcome !== 'won') continue
    const plan = planContract(s)
    if (plan.recurring && s.hook !== 'renewal_risk') queue.push(plan)
  }

  while (queue.length) {
    queue.sort((a, b) => a.end - b.end)
    const c = queue.shift()!
    if (c.end > today + 90) continue
    if (rng.chance(0.22)) continue
    const created = c.end - rng.int(45, 80)
    if (created > today) continue
    const orig = c.sim
    const sim = newSim(orig.rep, created, orig.source, orig.inst, orig.product, 0)
    sim.isRenewal = true
    sim.renewalOf = c.id
    sim.fixedValue = true
    sim.history = [{ stage: 'Kvalifikace', day: created }]
    const steps: Stage[] = ['Nabídka', 'Vyjednávání', 'Smlouva k podpisu']
    let day = created
    let open = false
    for (const st of steps) {
      day += rng.int(5, 13)
      if (day > today) {
        open = true
        break
      }
      sim.history.push({ stage: st, day })
    }
    if (!open) {
      const closeDay = Math.max(day + 2, c.end - rng.int(0, 12))
      if (closeDay > today) open = true
      else if (rng.chance(0.8)) {
        sim.history.push({ stage: 'Vyhráno', day: closeDay })
        sim.outcome = 'won'
        sim.closed = closeDay
      } else {
        const lostStage = sim.history[sim.history.length - 1].stage as OpenStage
        sim.history.push({ stage: 'Prohráno', day: closeDay })
        sim.outcome = 'lost'
        sim.closed = closeDay
        sim.lostAtStage = lostStage
        sim.lostReason = rng.weighted(['Rozpočet zmrazen', 'Vybrán konkurent', 'Cena'] as LostReason[], [0.5, 0.3, 0.2])
      }
    }
    if (open) {
      sim.outcome = 'open'
      sim.expectedClose = Math.max(today + 2, c.end - rng.int(0, 10))
      const stage = sim.history[sim.history.length - 1].stage as OpenStage
      sim.nextStep = rng.chance(0.85) ? today + rng.int(1, 10) : null
      sim.nextStepLabel = sim.nextStep === null ? null : rng.pick(NEXT_STEP_BY_STAGE[stage])
    } else {
      sim.expectedClose = sim.closed! + rng.int(-5, 5)
    }
    sim.id = `D-${dealCounter++}`
    renewalSims.push(sim)
    renewalSource.set(sim, { plan: c, factor: rng.range(1.0, 1.12) })
    c.renewal = sim
    if (sim.outcome === 'won') queue.push(planContract(sim, c.end + 1))
  }

  const allSims = [...sims, ...renewalSims]

  // ── Calibrate won values month by month so attainment follows each rep's story.
  // Renewals and story hooks are fixed; the rest of the month's wins absorb the difference.
  const assignRenewalValue = (s: SimDeal) => {
    const src = renewalSource.get(s)!
    s.value = roundValue(src.plan.sim.value * src.factor)
  }
  const wonByKey = new Map<string, SimDeal[]>()
  const renewalsByMonth = new Map<string, SimDeal[]>()
  for (const s of allSims) {
    if (s.closed === null) continue
    const ym = fromDay(s.closed).slice(0, 7)
    if (s.isRenewal) {
      if (!renewalsByMonth.has(ym)) renewalsByMonth.set(ym, [])
      renewalsByMonth.get(ym)!.push(s)
    }
    if (s.outcome !== 'won') continue
    const key = `${ym}|${s.rep}`
    if (!wonByKey.has(key)) wonByKey.set(key, [])
    wonByKey.get(key)!.push(s)
  }
  const lostByKey = new Map<string, SimDeal[]>()
  for (const s of sims) {
    if (s.outcome !== 'lost' || s.hook || !s.lostAtStage || OPEN_STAGES.indexOf(s.lostAtStage) < 2) continue
    const key = `${fromDay(s.closed!).slice(0, 7)}|${s.rep}`
    if (!lostByKey.has(key)) lostByKey.set(key, [])
    lostByKey.get(key)!.push(s)
  }
  for (const list of lostByKey.values())
    list.sort((a, b) => OPEN_STAGES.indexOf(b.lostAtStage!) - OPEN_STAGES.indexOf(a.lostAtStage!))
  const rawByRep = new Array(REPS.length).fill(0)
  const calByRep = new Array(REPS.length).fill(0)
  const dayOfMonth = Number(todayIso.slice(8, 10))
  for (let m = ymIndex(simStartIso.slice(0, 7)); m <= todayYmIdx; m++) {
    const ym = `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`
    for (const s of renewalsByMonth.get(ym) ?? []) assignRenewalValue(s)
    for (let r = 0; r < REPS.length; r++) {
      const deals = wonByKey.get(`${ym}|${r}`)
      if (!deals) continue
      const rep = REPS[r]
      const ago = todayYmIdx - m
      const since = m - repStartYmIdx[r]
      const elapsed = ago === 0 ? dayOfMonth / daysInMonth(ym) : 1
      const target =
        rep.quota *
        rep.perf(ago, Math.max(0, since)) *
        SEASON[(m % 12)] *
        Math.max(0.7, 1 + rng.normal(0, rep.noise)) *
        elapsed
      const fixed = deals.filter((d) => d.fixedValue).reduce((s, d) => s + d.value, 0)
      const flexible = deals.filter((d) => !d.fixedValue)
      const spare = (lostByKey.get(`${ym}|${r}`) ?? []).slice()
      const original = new Map(flexible.map((d) => [d, d.value]))
      for (let attempt = 0; attempt < 4; attempt++) {
        const sum = flexible.reduce((acc, d) => acc + original.get(d)!, 0)
        if (sum <= 0) break
        const scale = Math.min(3, Math.max(0.3, (target - fixed) / sum))
        let achieved = fixed
        for (const d of flexible) {
          const [min, max] = VALUE_RANGE[institutions[d.inst].type]
          const cap = max * (PRODUCTS[d.product].recurring ? 1.8 : 1.5)
          d.value = roundValue(Math.min(cap, Math.max(min * 0.7, original.get(d)! * scale)))
          achieved += d.value
        }
        if (achieved >= target * 0.88 || ago === 0 || !spare.length) break
        const extra = spare.shift()!
        flipToWon(extra)
        flexible.push(extra)
        original.set(extra, extra.value)
      }
      if (ago <= 9) {
        for (const d of flexible) {
          rawByRep[r] += original.get(d)!
          calByRep[r] += d.value
        }
      }
    }
  }
  for (const s of renewalSims) if (s.closed === null) assignRenewalValue(s)

  // Open and lost deals get the same value level as each rep's (calibrated) wins,
  // so pipeline, forecast and lost value are comparable with revenue.
  for (const s of sims) {
    if (s.outcome === 'won' || s.fixedValue) continue
    const scale = rawByRep[s.rep] ? Math.min(1.6, Math.max(0.5, calByRep[s.rep] / rawByRep[s.rep])) : 1
    const [min, max] = VALUE_RANGE[institutions[s.inst].type]
    const cap = max * (PRODUCTS[s.product].recurring ? 1.8 : 1.5)
    s.value = roundValue(Math.min(cap, Math.max(min * 0.7, s.value * scale)))
  }

  // ── Contracts and invoices ──────────────────────────────────────────────
  const contracts: Contract[] = []
  const rawInvoices: Omit<Invoice, 'number' | 'variableSymbol' | 'id'>[] = []

  const paymentDelay = () => {
    const r = rng.next()
    if (r < 0.15) return rng.int(-6, 0)
    if (r < 0.75) return rng.int(3, 18)
    if (r < 0.9) return rng.int(19, 29)
    return rng.int(30, 70)
  }

  const addInvoice = (contract: Contract, issue: number, amount: number, forcePaid?: number | null) => {
    if (issue > today) return
    const due = issue + 14
    let paid: number | null = forcePaid !== undefined ? forcePaid : Math.max(issue + 3, due + paymentDelay())
    if (paid !== null && paid > today) paid = null
    rawInvoices.push({
      contractId: contract.id,
      dealId: contract.dealId,
      ownerId: contract.ownerId,
      institutionId: contract.institutionId,
      issuedAt: fromDay(issue),
      dueAt: fromDay(due),
      amount,
      paidAt: paid === null ? null : fromDay(paid),
    })
  }

  for (const plan of plans) {
    const s = plan.sim
    const contract: Contract = {
      id: plan.id,
      dealId: s.id,
      ownerId: REPS[s.rep].id,
      institutionId: institutions[s.inst].id,
      productId: PRODUCTS[s.product].id,
      recurring: plan.recurring,
      sentForSignatureAt: fromDay(plan.sent),
      signedAt: plan.signed === null ? null : fromDay(plan.signed),
      startAt: fromDay(plan.start),
      endAt: fromDay(plan.end),
      annualValue: s.value,
      renewalDealId: plan.renewal?.id ?? null,
    }
    contracts.push(contract)
    if (plan.signed === null) continue
    if (s.hook === 'overdue_invoice') {
      addInvoice(contract, today - 35, s.value, null)
    } else if (plan.recurring) {
      const q = Math.round(s.value / 4 / 100) * 100
      for (let i = 0; i < 4; i++) {
        const issue = Math.max(plan.signed, plan.start) + Math.round(i * 91.25)
        addInvoice(contract, issue, i < 3 ? q : s.value - 3 * q)
      }
    } else {
      addInvoice(contract, plan.signed + rng.int(4, 21), s.value)
    }
  }

  // ── Invoice numbering ───────────────────────────────────────────────────
  rawInvoices.sort((a, b) => (a.issuedAt < b.issuedAt ? -1 : a.issuedAt > b.issuedAt ? 1 : 0))
  const perYear = new Map<string, number>()
  const invoices: Invoice[] = rawInvoices.map((inv, i) => {
    const year = inv.issuedAt.slice(0, 4)
    const n = (perYear.get(year) ?? 0) + 1
    perYear.set(year, n)
    const seq = String(n).padStart(4, '0')
    return { ...inv, id: `INV-${i + 1}`, number: `FV-${year}-${seq}`, variableSymbol: `${year}${seq}` }
  })

  // ── Tenders ─────────────────────────────────────────────────────────────
  const tenders: Tender[] = []
  for (const s of allSims) {
    if (s.source !== 'tender' || s.isRenewal) continue
    const nab = s.history.find((h) => h.stage === 'Nabídka')
    const idx = s.history.findIndex((h) => h.stage === 'Nabídka')
    let deadline: number
    if (s.hook === 'tender_deadline') deadline = today + 5
    else if (nab) {
      const nextDay = s.history[idx + 1]?.day ?? Math.max(today + 1, nab.day + Math.round(MEDIAN_DAYS[2] * TENDER_SPEED[2]))
      deadline = nab.day + Math.round(0.6 * (nextDay - nab.day))
    } else if (s.outcome === 'lost') deadline = s.closed! + rng.int(5, 20)
    else deadline = today + rng.int(12, 45)
    let status: Tender['status']
    if (s.outcome === 'won') status = 'vyhráno'
    else if (s.outcome === 'lost') status = 'prohráno'
    else status = deadline > today ? 'příprava' : 'podáno'
    tenders.push({
      id: `VZ-${String(tenders.length + 1).padStart(3, '0')}`,
      title: PRODUCTS[s.product].name,
      institutionId: institutions[s.inst].id,
      ownerId: REPS[s.rep].id,
      value: s.value,
      submissionDeadline: fromDay(deadline),
      status,
      dealId: s.id,
    })
  }

  // ── Deals ───────────────────────────────────────────────────────────────
  const deals: Deal[] = allSims.map((s) => {
    const last = s.history[s.history.length - 1]
    return {
      id: s.id,
      institutionId: institutions[s.inst].id,
      ownerId: REPS[s.rep].id,
      productId: PRODUCTS[s.product].id,
      sourceId: s.source,
      value: s.value,
      stage: last.stage,
      stageHistory: s.history.map((h) => ({ stage: h.stage, enteredAt: fromDay(h.day) })),
      createdAt: fromDay(s.created),
      expectedCloseAt: fromDay(s.expectedClose),
      nextStepAt: s.outcome === 'open' && s.nextStep !== null ? fromDay(s.nextStep) : null,
      nextStep: s.outcome === 'open' ? s.nextStepLabel : null,
      lostReason: s.lostReason,
      lostAtStage: s.lostAtStage,
      closedAt: s.closed === null ? null : fromDay(s.closed),
      isRenewal: s.isRenewal,
      renewalOfContractId: s.renewalOf,
    }
  })

  // ── Activities ──────────────────────────────────────────────────────────
  const activities: Activity[] = []
  let actCounter = 1
  const pushActivity = (dealId: string | null, ownerId: string, type: ActivityType, due: number, done: number | null) => {
    activities.push({
      id: `A-${actCounter++}`,
      dealId,
      ownerId,
      type,
      dueAt: fromDay(due),
      doneAt: done === null ? null : fromDay(done),
    })
  }

  for (let r = 0; r < REPS.length; r++) {
    const rep = REPS[r]
    const from = Math.max(simStart, repStartDay[r])
    for (let day = from; day <= today; day++) {
      if (weekdayOfDay(day) >= 5) continue
      const disc = rep.discipline(monthsAgoOf(day))
      const n = Math.max(0, Math.round(rep.callsPerDay * disc * (1 + rng.normal(0, 0.25))))
      for (let k = 0; k < n; k++) pushActivity(null, rep.id, 'hovor', day, day)
    }
  }

  const STAGE_ACTIVITY: Partial<Record<Stage, ActivityType>> = {
    Kontakt: 'schůzka',
    Kvalifikace: 'hovor',
    Nabídka: 'e-mail',
    Vyjednávání: 'schůzka',
    'Smlouva k podpisu': 'e-mail',
  }
  for (const s of allSims) {
    const owner = REPS[s.rep].id
    for (let i = 0; i < s.history.length; i++) {
      const h = s.history[i]
      const type = STAGE_ACTIVITY[h.stage]
      if (!type) continue
      const day = Math.min(today, h.day + (type === 'schůzka' ? 1 : 0))
      pushActivity(s.id, owner, type, day, day)
      const end = s.history[i + 1]?.day ?? today
      if (end - h.day > 6) {
        const fu = h.day + Math.floor((end - h.day) / 2)
        if (fu < today) pushActivity(s.id, owner, 'follow-up', fu, fu)
      }
    }
    if (s.outcome === 'open' && s.nextStep !== null) {
      pushActivity(s.id, owner, 'follow-up', s.nextStep, null)
    }
  }

  // Junior with a backlog of overdue follow-ups.
  const tdOpen = allSims.filter((s) => REPS[s.rep].id === 'tdvorak' && s.outcome === 'open')
  let overdueTd = activities.filter(
    (a) => a.ownerId === 'tdvorak' && a.doneAt === null && toDay(a.dueAt) < today,
  ).length
  for (let i = 0; overdueTd < 7 && tdOpen.length && i < 20; i++, overdueTd++) {
    const s = tdOpen[i % tdOpen.length]
    pushActivity(s.id, 'tdvorak', 'follow-up', today - rng.int(2, 14), null)
  }

  // ── Bank payments ───────────────────────────────────────────────────────
  const instById = new Map(institutions.map((i) => [i.id, i]))
  const payments: BankPayment[] = []
  const wrongVs = (vs: string) => {
    const d = vs.split('')
    const i = d.length - 2
    ;[d[i], d[i + 1]] = [d[i + 1], d[i]]
    if (d.join('') === vs) d[d.length - 1] = String((Number(d[d.length - 1]) + 1) % 10)
    return d.join('')
  }

  // Two (sometimes three) recent payments arrived with a wrong variable symbol:
  // money is in the bank, but the invoice still looks unpaid.
  const recentPaid = invoices
    .filter((inv) => inv.paidAt && toDay(inv.paidAt) >= today - 21 && toDay(inv.paidAt) <= today - 2)
    .sort((a, b) => Math.abs(a.amount - 95_000) - Math.abs(b.amount - 95_000))
  const unmatchedCount = rng.chance(0.4) ? 3 : 2
  const unmatchedIds = new Set<string>()
  for (const inv of recentPaid) {
    if (unmatchedIds.size >= unmatchedCount) break
    if (invoices.some((o) => o.id !== inv.id && o.amount === inv.amount && !o.paidAt)) continue
    unmatchedIds.add(inv.id)
  }

  const byMonth = new Map<string, Invoice[]>()
  for (const inv of invoices) {
    if (!inv.paidAt || unmatchedIds.has(inv.id)) continue
    const key = inv.paidAt.slice(0, 7)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(inv)
  }
  const manualIds = new Set<string>()
  for (const [, list] of byMonth) {
    const n = rng.int(1, 3)
    for (let i = 0; i < n && list.length; i++) {
      const inv = rng.pick(list)
      if (toDay(inv.paidAt!) < today - 30) manualIds.add(inv.id)
    }
  }

  for (const inv of invoices) {
    if (unmatchedIds.has(inv.id)) {
      payments.push({
        id: '',
        amount: inv.amount,
        receivedAt: inv.paidAt!,
        variableSymbol: wrongVs(inv.variableSymbol),
        counterparty: instById.get(inv.institutionId)!.name,
        matchedInvoiceId: null,
        matchMethod: null,
      })
      inv.paidAt = null
      continue
    }
    if (!inv.paidAt) continue
    const manual = manualIds.has(inv.id)
    payments.push({
      id: '',
      amount: inv.amount,
      receivedAt: inv.paidAt,
      variableSymbol: manual ? wrongVs(inv.variableSymbol) : inv.variableSymbol,
      counterparty: instById.get(inv.institutionId)!.name,
      matchedInvoiceId: inv.id,
      matchMethod: manual ? 'manual' : 'auto',
    })
  }
  payments.sort((a, b) => (a.receivedAt < b.receivedAt ? -1 : a.receivedAt > b.receivedAt ? 1 : 0))
  payments.forEach((p, i) => (p.id = `BP-${i + 1}`))

  deals.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))

  return {
    today: todayIso,
    historyStart: simStartIso,
    teams: TEAMS,
    kraje: KRAJE,
    salespeople,
    institutions,
    products: PRODUCTS,
    sources: SOURCES,
    commissionProfiles: COMMISSION_PROFILES,
    deals,
    activities,
    contracts,
    invoices,
    payments,
    tenders,
  }
}

function roundValue(v: number): number {
  return v >= 100_000 ? Math.round(v / 1000) * 1000 : Math.round(v / 500) * 500
}

function generateInstitutions(rng: Rng): Institution[] {
  const used = new Set<string>()
  const place = (): string => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const roll = rng.next()
      let name: string
      if (roll < 0.35) name = `${rng.pick(SOFT_PREFIXES)} ${rng.pick([...FEM_ROOTS, ...MASC_ROOTS])}`
      else if (roll < 0.75) name = `${rng.pick(FEM_PREFIXES)} ${rng.pick(FEM_ROOTS)}`
      else name = rng.pick(SINGLE_NAMES)
      if (!used.has(name)) {
        used.add(name)
        return name
      }
    }
    return `${rng.pick(FEM_PREFIXES)} ${rng.pick(FEM_ROOTS)} ${used.size}`
  }

  const list: Institution[] = []
  MINISTRIES.forEach((name) =>
    list.push({ id: '', name, type: 'Ministerstvo', kraj: 'PHA', size: 'L' }),
  )
  for (const kraj of KRAJE) {
    for (const [type, count] of Object.entries(INSTITUTIONS_PER_KRAJ) as [
      Exclude<InstitutionType, 'Ministerstvo'>,
      number,
    ][]) {
      for (let i = 0; i < count; i++) {
        const pattern = rng.pick(INSTITUTION_PATTERNS[type])
        const size: Institution['size'] =
          type === 'Krajský úřad' ? 'L'
          : type === 'Nemocnice' || type === 'Státní podnik' ? (rng.chance(0.5) ? 'L' : 'M')
          : type === 'Škola' ? 'S'
          : type === 'Složka IZS' ? 'M'
          : rng.chance(0.6) ? 'S' : 'M'
        list.push({ id: '', name: pattern.replace('{p}', place()), type, kraj: kraj.id, size })
      }
    }
  }
  list.forEach((inst, i) => (inst.id = `I-${String(i + 1).padStart(3, '0')}`))
  return list
}
