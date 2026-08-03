'use client'

type Translate = (key: string, vars?: Record<string, string | number>) => string

type NotesPageHeaderProps = {
  counts: {
    all: number
    good: number
    bad: number
    pendingTodos: number
  }
  todayCalories: number
  dailyCalorieGoal: number
  t: Translate
}

export function NotesPageHeader({ counts, todayCalories, dailyCalorieGoal, t }: NotesPageHeaderProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(130deg,#ffffff_0%,#f7fef9_45%,#ecfdf5_100%)] p-6 shadow-[0_30px_60px_-45px_rgba(16,185,129,0.45)]">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_16px_28px_-16px_rgba(16,185,129,0.9)]">
          <span className="text-xl">📝</span>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">{t('notes.header.eyebrow')}</p>
          <h2 className="mt-1 font-poppins text-2xl font-semibold leading-tight text-zinc-900">{t('notes.header.title')}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t('notes.header.subtitle')}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <article className="rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_1px_0_0_rgba(16,185,129,0.15)]">
          <p className="text-xs font-medium text-zinc-600">{t('notes.header.totalStat')}</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-zinc-900">{counts.all}</p>
        </article>
        <article className="rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_1px_0_0_rgba(16,185,129,0.15)]">
          <p className="text-xs font-medium text-zinc-600">{t('notes.header.goodStat')}</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-emerald-600">{counts.good}</p>
        </article>
        <article className="rounded-xl border border-amber-100 bg-white p-3 shadow-[0_1px_0_0_rgba(217,119,6,0.15)]">
          <p className="text-xs font-medium text-zinc-600">{t('notes.header.badStat')}</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-amber-600">{counts.bad}</p>
        </article>
        <article className="rounded-xl border border-blue-100 bg-white p-3 shadow-[0_1px_0_0_rgba(59,130,246,0.15)]">
          <p className="text-xs font-medium text-zinc-600">{t('notes.header.todoStat')}</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-blue-600">{counts.pendingTodos}</p>
        </article>
        <article className="rounded-xl border border-orange-100 bg-white p-3 shadow-[0_1px_0_0_rgba(234,88,12,0.15)]">
          <p className="text-xs font-medium text-zinc-600">{t('notes.header.calorieStat')}</p>
          <p className="mt-2 text-2xl font-semibold leading-none text-orange-600">{Math.round(todayCalories)}</p>
          <p className="text-xs text-zinc-500">{t('notes.header.calorieGoalSuffix', { goal: dailyCalorieGoal })}</p>
        </article>
      </div>
    </section>
  )
}