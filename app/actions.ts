'use server'

import { buildContext } from '@/lib/metrics/context'
import { resolveDrill } from '@/lib/metrics/drill'
import type { DrillRequest, DrillResult } from '@/lib/metrics/drill-types'
import type { PeriodQuery } from '@/lib/metrics/period'

/** Records behind a number. Recomputed from the same dataset and scope as the page. */
export async function fetchDrill(req: DrillRequest, query: PeriodQuery): Promise<DrillResult> {
  return resolveDrill(buildContext(query), req)
}
