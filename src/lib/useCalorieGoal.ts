'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from './supabase-browser'

export function useCalorieGoal() {
  // Default only — `user_profiles.daily_calorie_goal` overrides it per account,
  // and the tracker lets the user edit it. 1800 is the deficit that matches the
  // app's 70 -> 65 kg goal (5 kg over 2 months is ~0.6 kg/week, ~600 kcal/day
  // below a sedentary 70 kg maintenance of ~2400) and is exactly what the
  // default five-meal plan sums to. Was 2400, a lean-bulk surplus.
  const [goal, setGoal] = useState(1800)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
      if (!user) return
      const { data } = await getSupabaseBrowserClient()
        .from('user_profiles')
        .select('daily_calorie_goal')
        .eq('id', user.id)
        .single()
      if (data?.daily_calorie_goal) setGoal(data.daily_calorie_goal)
    }
    void load()
  }, [])

  async function saveGoal(newGoal: number) {
    setGoal(newGoal)
    const { data: { user } } = await getSupabaseBrowserClient().auth.getUser()
    if (!user) return
    await getSupabaseBrowserClient()
      .from('user_profiles')
      .update({ daily_calorie_goal: newGoal })
      .eq('id', user.id)
  }

  return { goal, saveGoal }
}
