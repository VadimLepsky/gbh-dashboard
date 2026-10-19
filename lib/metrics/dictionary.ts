import type { ValueFormat } from '../format'

export type MetricId =
  | 'revenue_won'
  | 'invoiced'
  | 'collected'
  | 'receivables'
  | 'overdue'
  | 'dso'
  | 'pipeline'
  | 'weighted_forecast'
  | 'plan'
  | 'attainment'
  | 'coverage'
  | 'win_rate'
  | 'cycle_days'
  | 'avg_deal'
  | 'gross_margin'
  | 'activities_done'
  | 'overdue_followups'
  | 'no_next_step'
  | 'stuck_deals'
  | 'commission_payable'
  | 'commission_pending'
  | 'renewal_rate'
  | 'tender_win_rate'
  | 'unmatched_payments'

export interface MetricDefinition {
  id: MetricId
  label: string
  definition: string
  formula: string
  unit: ValueFormat
  unitLabel: string
  goodDirection: 'up' | 'down'
}

export const METRICS: Record<MetricId, MetricDefinition> = {
  revenue_won: {
    id: 'revenue_won',
    label: 'Prodáno',
    definition: 'Hodnota dealů, které jsme v daném období uzavřeli jako vyhrané.',
    formula: 'Σ hodnota dealů ve fázi Vyhráno s datem uzavření v období',
    unit: 'czk', unitLabel: 'Kč', goodDirection: 'up',
  },
  invoiced: {
    id: 'invoiced',
    label: 'Fakturováno',
    definition: 'Součet faktur, které jsme v období vystavili.',
    formula: 'Σ částka faktur s datem vystavení v období',
    unit: 'czk', unitLabel: 'Kč', goodDirection: 'up',
  },
  collected: {
    id: 'collected',
    label: 'Uhrazeno',
    definition: 'Peníze, které za faktury skutečně dorazily na účet v daném období.',
    formula: 'Σ částka faktur s datem úhrady v období',
    unit: 'czk', unitLabel: 'Kč', goodDirection: 'up',
  },
  receivables: {
    id: 'receivables',
    label: 'Pohledávky',
    definition: 'Vystavené faktury, které ke konci období ještě nebyly zaplacené.',
    formula: 'Σ neuhrazených faktur ke konci období',
    unit: 'czk', unitLabel: 'Kč', goodDirection: 'down',
  },
  overdue: {
    id: 'overdue',
    label: 'Po splatnosti',
    definition: 'Nezaplacené faktury, kterým už uplynulo datum splatnosti.',
    formula: 'Σ neuhrazených faktur s datem splatnosti před koncem období',
    unit: 'czk', unitLabel: 'Kč', goodDirection: 'down',
  },
  dso: {
    id: 'dso',
    label: 'DSO',
    definition: 'Průměrný počet dní od vystavení faktury do jejího zaplacení.',
    formula: 'průměr (datum úhrady − datum vystavení) u faktur uhrazených v období',
    unit: 'days', unitLabel: 'dní', goodDirection: 'down',
  },
  pipeline: {
    id: 'pipeline',
    label: 'Pipeline',
    definition: 'Celková hodnota všech otevřených dealů.',
    formula: 'Σ hodnota otevřených dealů',
    unit: 'czk', unitLabel: 'Kč', goodDirection: 'up',
  },
  weighted_forecast: {
    id: 'weighted_forecast',
    label: 'Vážená prognóza',
    definition: 'Odhad prodeje za období: co už je vyhrané plus otevřené dealy vážené pravděpodobností své fáze.',
    formula: 'vyhráno v období + Σ hodnota × pravděpodobnost fáze u otevřených dealů s očekávaným uzavřením v období',
    unit: 'czk', unitLabel: 'Kč', goodDirection: 'up',
  },
  plan: {
    id: 'plan',
    label: 'Plán',
    definition: 'Prodejní cíl pro zvolený tým a období.',
    formula: 'Σ měsíční kvóta obchodníků × podíl měsíce v období',
    unit: 'czk', unitLabel: 'Kč', goodDirection: 'up',
  },
  attainment: {
    id: 'attainment',
    label: 'Plnění plánu',
    definition: 'Jakou část plánu už máme prodanou.',
    formula: 'Prodáno / Plán',
    unit: 'percent', unitLabel: '%', goodDirection: 'up',
  },
  coverage: {
    id: 'coverage',
    label: 'Krytí pipeline',
    definition: 'Kolikrát otevřená pipeline s uzavřením v období pokrývá část plánu, která ještě chybí.',
    formula: 'pipeline s očekávaným uzavřením v období / (Plán − Prodáno)',
    unit: 'ratio', unitLabel: '×', goodDirection: 'up',
  },
  win_rate: {
    id: 'win_rate',
    label: 'Win rate',
    definition: 'Podíl vyhraných dealů ze všech dealů uzavřených v období.',
    formula: 'vyhrané / (vyhrané + prohrané), uzavřené v období',
    unit: 'percent', unitLabel: '%', goodDirection: 'up',
  },
  cycle_days: {
    id: 'cycle_days',
    label: 'Délka cyklu',
    definition: 'Typická doba od založení dealu po jeho vyhrání.',
    formula: 'medián dní od založení po uzavření u vyhraných dealů',
    unit: 'days', unitLabel: 'dní', goodDirection: 'down',
  },
  avg_deal: {
    id: 'avg_deal',
    label: 'Průměrný deal',
    definition: 'Průměrná hodnota jednoho vyhraného dealu.',
    formula: 'Prodáno / počet vyhraných dealů',
    unit: 'czk', unitLabel: 'Kč', goodDirection: 'up',
  },
  gross_margin: {
    id: 'gross_margin',
    label: 'Hrubá marže',
    definition: 'Kolik z prodeje zůstane po odečtení přímých nákladů (lektoři, cesty, materiály).',
    formula: '(tržba − náklady podle produktu) / tržba',
    unit: 'percent', unitLabel: '%', goodDirection: 'up',
  },
  activities_done: {
    id: 'activities_done',
    label: 'Splněné aktivity',
    definition: 'Kolik hovorů, e-mailů, schůzek a follow-upů obchodníci v období dokončili vůči cíli.',
    formula: 'počet aktivit s datem splnění v období / cíl aktivit za období',
    unit: 'percent', unitLabel: '%', goodDirection: 'up',
  },
  overdue_followups: {
    id: 'overdue_followups',
    label: 'Zpožděné follow-upy',
    definition: 'Naplánované aktivity, jejichž termín už uplynul a nikdo je neudělal.',
    formula: 'aktivity s termínem před dneškem a bez data splnění',
    unit: 'int', unitLabel: 'ks', goodDirection: 'down',
  },
  no_next_step: {
    id: 'no_next_step',
    label: 'Bez dalšího kroku',
    definition: 'Otevřené dealy, které nemají naplánovaný další krok, nebo ho mají v minulosti.',
    formula: 'otevřené dealy s dalším krokem = prázdný nebo před dneškem',
    unit: 'int', unitLabel: 'ks', goodDirection: 'down',
  },
  stuck_deals: {
    id: 'stuck_deals',
    label: 'Zaseknuté dealy',
    definition: 'Otevřené dealy, které jsou v aktuální fázi výrazně déle než obvykle.',
    formula: 'dny v aktuální fázi > 2 × medián dané fáze (veřejné zakázky se srovnávají zvlášť)',
    unit: 'int', unitLabel: 'ks', goodDirection: 'down',
  },
  commission_payable: {
    id: 'commission_payable',
    label: 'Provize k výplatě',
    definition: 'Provize z faktur, které klient v období zaplatil. Provize vzniká úhradou faktury.',
    formula: 'Σ uhrazená tržba × základní sazba × koeficient KPI za měsíc úhrady',
    unit: 'czk', unitLabel: 'Kč', goodDirection: 'up',
  },
  commission_pending: {
    id: 'commission_pending',
    label: 'Čekající provize',
    definition: 'Provize z vyhraných zakázek, které ještě nejsou zaplacené (nevyfakturované nebo neuhrazené).',
    formula: 'Σ (nevyfakturovaná + neuhrazená částka) × základní sazba × aktuální koeficient KPI',
    unit: 'czk', unitLabel: 'Kč', goodDirection: 'up',
  },
  renewal_rate: {
    id: 'renewal_rate',
    label: 'Míra obnovy',
    definition: 'Kolik ročních smluv, které za posledních 12 měsíců skončily, jsme obnovili.',
    formula: 'obnovené smlouvy / smlouvy s koncem v posledních 12 měsících',
    unit: 'percent', unitLabel: '%', goodDirection: 'up',
  },
  tender_win_rate: {
    id: 'tender_win_rate',
    label: 'Úspěšnost zakázek',
    definition: 'Podíl vyhraných veřejných zakázek ze všech rozhodnutých.',
    formula: 'vyhrané / (vyhrané + prohrané) zakázky',
    unit: 'percent', unitLabel: '%', goodDirection: 'up',
  },
  unmatched_payments: {
    id: 'unmatched_payments',
    label: 'Nespárované platby',
    definition: 'Platby na účtu, které nejdou automaticky přiřadit k faktuře (chybný variabilní symbol).',
    formula: 'počet bankovních plateb bez spárované faktury',
    unit: 'int', unitLabel: 'ks', goodDirection: 'down',
  },
}

export const METRIC_LIST: MetricDefinition[] = Object.values(METRICS)
