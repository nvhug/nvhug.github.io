'use client'

import { useCallback, useState } from 'react'

import { supabase } from '@/lib/supabase'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { BuyPick, CalendarEvent, Goal, GoalItem, Note, Post, Todo } from '@/types'
import { isHealthTagAlias } from '../_lib/healthTags'

export function useNotesData() {
  const [notes, setNotes] = useState<Note[]>([])
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [todayCalories, setTodayCalories] = useState(0)
  const [todos, setTodos] = useState<Todo[]>([])
  const [buyPicks, setBuyPicks] = useState<BuyPick[]>([])
  const [healthPosts, setHealthPosts] = useState<Post[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalItems, setGoalItems] = useState<{ [goalId: string]: GoalItem[] }>({})

  const fetchNotes = useCallback(async (withLoading = true) => {
    if (withLoading) {
      setLoading(true)
    }
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('note_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      const all = (data || []) as Note[]
      setPinnedNotes(all.filter((note) => note.pinned))
      setNotes(all.filter((note) => !note.pinned))
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTodos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTodos((data || []) as Todo[])
    } catch (error) {
      console.error('Error fetching todos:', error)
    }
  }, [])

  const fetchBuyPicks = useCallback(async () => {
    const { data } = await supabase
      .from('buy_picks')
      .select('*')
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })
    if (data) setBuyPicks(data as BuyPick[])
  }, [])

  const fetchGoals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setGoals((data || []) as Goal[])
    } catch (error) {
      console.error('Error fetching goals:', error)
    }
  }, [])

  const fetchHealthPosts = useCallback(async () => {
    try {
        const { data: tagData, error: tagError } = await supabase
          .from('tags')
          .select('id, name')

        if (tagError) throw tagError
      const tags = (tagData || []) as { id: string; name: string }[]
        const healthTagIds = new Set(
          tags
          .filter((tag) => isHealthTagAlias(tag.name))
          .map((tag) => tag.id)
        )

        if (healthTagIds.size === 0) {
          setHealthPosts([])
          return
        }

      const { data, error } = await supabase
        .from('posts')
        .select('*, post_tags(tags(id, name))')
        .order('created_at', { ascending: false })

      if (error) throw error
      const rows = (data || []) as (Post & { post_tags: { tags: { id: string; name: string } | null }[] })[]
      const posts = rows.map(({ post_tags, ...post }) => ({
        ...post,
        tags: post_tags
          .map((pt) => pt.tags)
          .filter((tag): tag is { id: string; name: string } => tag !== null)
          .map((tag) => ({ id: tag.id, name: tag.name })),
      }))
      const filtered = posts.filter((post) => post.tags?.some((tag) => healthTagIds.has(tag.id)))
      setHealthPosts(filtered)
    } catch (error) {
      console.error('Error fetching health posts:', error)
    }
  }, [])

  const fetchCalendarEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
      if (error) throw error
      setCalendarEvents((data || []) as CalendarEvent[])
    } catch (error) {
      console.error('Error fetching calendar events:', error)
    }
  }, [])

  const fetchTodayCalories = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('daily_foods')
        .select('total_calories')
        .eq('date', today)

      if (error) throw error
      const rows = (data || []) as { total_calories: number | null }[]
      const total = rows.reduce((sum, food) => sum + (food.total_calories || 0), 0)
      setTodayCalories(total)
    } catch (error) {
      console.error('Error fetching today calories:', error)
    }
  }, [])

  const fetchGoalItems = useCallback(async (goalId: string): Promise<GoalItem[]> => {
    try {
      const { data, error } = await supabase
        .from('goal_items')
        .select('*')
        .eq('goal_id', goalId)
        .order('order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data || []) as GoalItem[]
    } catch (error) {
      console.error('Error fetching goal items:', error)
      return []
    }
  }, [])

  const initializeData = useCallback(async () => {
    setLoading(true)
    try {
      // Ensure session cookies are loaded before queries to respect RLS.
      await getSupabaseBrowserClient().auth.getSession()
      await Promise.all([
        fetchNotes(false),
        fetchTodos(),
        fetchGoals(),
        fetchBuyPicks(),
        fetchHealthPosts(),
        fetchCalendarEvents(),
        fetchTodayCalories(),
      ])
    } finally {
      setLoading(false)
    }
  }, [fetchBuyPicks, fetchCalendarEvents, fetchGoals, fetchHealthPosts, fetchNotes, fetchTodayCalories, fetchTodos])

  return {
    buyPicks,
    calendarEvents,
    fetchBuyPicks,
    fetchCalendarEvents,
    fetchGoalItems,
    fetchGoals,
    fetchHealthPosts,
    fetchNotes,
    fetchTodayCalories,
    fetchTodos,
    goalItems,
    goals,
    healthPosts,
    initializeData,
    loading,
    notes,
    pinnedNotes,
    setBuyPicks,
    setCalendarEvents,
    setGoalItems,
    setGoals,
    setHealthPosts,
    setLoading,
    setNotes,
    setPinnedNotes,
    setTodayCalories,
    setTodos,
    todayCalories,
    todos,
  }
}