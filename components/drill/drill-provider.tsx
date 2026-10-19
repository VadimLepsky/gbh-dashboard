'use client'

import { useSearchParams } from 'next/navigation'
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { fetchDrill } from '@/app/actions'
import type { DrillRequest, DrillResult } from '@/lib/metrics/drill-types'
import { DrillSheet } from './drill-sheet'

interface DrillState {
  req: DrillRequest
  result: DrillResult | null
  error: boolean
}

interface DrillApi {
  openDrill: (req: DrillRequest) => void
  pushDrill: (req: DrillRequest) => void
}

const DrillContext = createContext<DrillApi | null>(null)

export function useDrill(): DrillApi {
  const ctx = useContext(DrillContext)
  if (!ctx) throw new Error('useDrill outside DrillProvider')
  return ctx
}

export function DrillProvider({ children }: { children: React.ReactNode }) {
  const params = useSearchParams()
  const [stack, setStack] = useState<DrillState[]>([])
  const [open, setOpen] = useState(false)
  const seq = useRef(0)

  const load = useCallback(
    (req: DrillRequest, depth: number) => {
      const id = ++seq.current
      const query = {
        period: params.get('period') ?? undefined,
        from: params.get('from') ?? undefined,
        to: params.get('to') ?? undefined,
        cmp: params.get('cmp') ?? undefined,
        as: params.get('as') ?? undefined,
      }
      fetchDrill(req, query)
        .then((result) => {
          if (id !== seq.current) return
          setStack((s) => s.map((item, i) => (i === depth ? { ...item, result } : item)))
        })
        .catch(() => {
          if (id !== seq.current) return
          setStack((s) => s.map((item, i) => (i === depth ? { ...item, error: true } : item)))
        })
    },
    [params],
  )

  const openDrill = useCallback(
    (req: DrillRequest) => {
      setStack([{ req, result: null, error: false }])
      setOpen(true)
      load(req, 0)
    },
    [load],
  )

  const pushDrill = useCallback(
    (req: DrillRequest) => {
      const depth = stack.length
      setStack((s) => [...s.slice(0, depth), { req, result: null, error: false }])
      load(req, depth)
    },
    [load, stack.length],
  )

  const back = useCallback(() => {
    seq.current++
    setStack((s) => s.slice(0, -1))
  }, [])

  const api = useMemo(() => ({ openDrill, pushDrill }), [openDrill, pushDrill])
  const current = stack[stack.length - 1] ?? null

  return (
    <DrillContext.Provider value={api}>
      {children}
      <DrillSheet
        open={open}
        onOpenChange={setOpen}
        state={current}
        canGoBack={stack.length > 1}
        onBack={back}
        onRowOpen={pushDrill}
      />
    </DrillContext.Provider>
  )
}
