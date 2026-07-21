'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from './supabase-browser'

export function useCalorieGoal() {
  const [goal, setGoal] = useState(2400)

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
