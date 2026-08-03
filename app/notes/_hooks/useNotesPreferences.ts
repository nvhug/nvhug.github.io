'use client'

import { useEffect, useState } from 'react'

import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { TrackerSubTab } from '../_components/tabs/types'

function buildPreferenceKey(userId: string | null, suffix: string) {
  const scope = userId ? `user:${userId}` : 'user:anonymous'
  return `notes:${scope}:${suffix}`
}

export function useNotesPreferences() {
  const [isGymExpanded, setIsGymExpanded] = useState(true)
  const [isWeightExpanded, setIsWeightExpanded] = useState(true)
  const [isBowelExpanded, setIsBowelExpanded] = useState(false)
  const [isMealsExpanded, setIsMealsExpanded] = useState(true)
  const [trackerSubTab, setTrackerSubTab] = useState<TrackerSubTab>('logs')
  const [preferencesUserId, setPreferencesUserId] = useState<string | null>(null)
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)
  const [collapsedGoalIds, setCollapsedGoalIds] = useState<string[]>([])

  useEffect(() => {
    void (async () => {
      try {
        const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
        setPreferencesUserId(user?.id ?? null)
      } finally {
        setPreferencesReady(true)
      }
    })()
  }, [])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      const stored = window.localStorage.getItem(buildPreferenceKey(preferencesUserId, 'tracker:gym:expanded'))
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsGymExpanded(stored === 'true')
      }
    } catch {
      // Ignore storage read errors.
    }
  }, [preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      window.localStorage.setItem(buildPreferenceKey(preferencesUserId, 'tracker:gym:expanded'), String(isGymExpanded))
    } catch {
      // Ignore storage write errors.
    }
  }, [isGymExpanded, preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      const stored = window.localStorage.getItem(buildPreferenceKey(preferencesUserId, 'tracker:weight:expanded'))
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsWeightExpanded(stored === 'true')
      }
    } catch {
      // Ignore storage read errors.
    }
  }, [preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      window.localStorage.setItem(buildPreferenceKey(preferencesUserId, 'tracker:weight:expanded'), String(isWeightExpanded))
    } catch {
      // Ignore storage write errors.
    }
  }, [isWeightExpanded, preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      const stored = window.localStorage.getItem(buildPreferenceKey(preferencesUserId, 'tracker:bowel:expanded'))
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsBowelExpanded(stored === 'true')
      }
    } catch {
      // Ignore storage read errors.
    }
  }, [preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      window.localStorage.setItem(buildPreferenceKey(preferencesUserId, 'tracker:bowel:expanded'), String(isBowelExpanded))
    } catch {
      // Ignore storage write errors.
    }
  }, [isBowelExpanded, preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      const stored = window.localStorage.getItem(buildPreferenceKey(preferencesUserId, 'calo:meals:expanded'))
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsMealsExpanded(stored === 'true')
      }
    } catch {
      // Ignore storage read errors.
    }
  }, [preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      window.localStorage.setItem(buildPreferenceKey(preferencesUserId, 'calo:meals:expanded'), String(isMealsExpanded))
    } catch {
      // Ignore storage write errors.
    }
  }, [isMealsExpanded, preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      const stored = window.localStorage.getItem(buildPreferenceKey(preferencesUserId, 'tracker:subtab'))
      if (stored === 'logs' || stored === 'videos') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTrackerSubTab(stored)
      }
    } catch {
      // Ignore storage read errors.
    }
  }, [preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      window.localStorage.setItem(buildPreferenceKey(preferencesUserId, 'tracker:subtab'), trackerSubTab)
    } catch {
      // Ignore storage write errors.
    }
  }, [trackerSubTab, preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      const stored = window.localStorage.getItem(buildPreferenceKey(preferencesUserId, 'goals:expanded:id'))
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExpandedGoal(stored)
      }
    } catch {
      // Ignore storage read errors.
    }
  }, [preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      if (expandedGoal) {
        window.localStorage.setItem(buildPreferenceKey(preferencesUserId, 'goals:expanded:id'), expandedGoal)
      } else {
        window.localStorage.removeItem(buildPreferenceKey(preferencesUserId, 'goals:expanded:id'))
      }
    } catch {
      // Ignore storage write errors.
    }
  }, [expandedGoal, preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      const stored = window.localStorage.getItem(buildPreferenceKey(preferencesUserId, 'goals:collapsed:ids'))
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollapsedGoalIds(parsed.filter((id): id is string => typeof id === 'string'))
      }
    } catch {
      // Ignore storage read errors.
    }
  }, [preferencesReady, preferencesUserId])

  useEffect(() => {
    if (!preferencesReady) return
    try {
      window.localStorage.setItem(buildPreferenceKey(preferencesUserId, 'goals:collapsed:ids'), JSON.stringify(collapsedGoalIds))
    } catch {
      // Ignore storage write errors.
    }
  }, [collapsedGoalIds, preferencesReady, preferencesUserId])

  return {
    collapsedGoalIds,
    expandedGoal,
    isBowelExpanded,
    isGymExpanded,
    isMealsExpanded,
    isWeightExpanded,
    preferencesReady,
    preferencesUserId,
    setCollapsedGoalIds,
    setExpandedGoal,
    setIsBowelExpanded,
    setIsGymExpanded,
    setIsMealsExpanded,
    setIsWeightExpanded,
    setTrackerSubTab,
    trackerSubTab,
  }
}