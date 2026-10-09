'use client'

import { useState } from 'react'
import { BarChart3, ChartNoAxesCombined, Coins, PieChart } from 'lucide-react'
import { DEMO_CHARTS } from '@/data/investigationTrailChartsDemo'
import type { InvestigationTrail } from '@/types/investigationTrail'

export function InvestigationTrailChartsDemo({ trail, year }: { trail: InvestigationTrail; year: number }) {
  const [selectedCategory, setSelectedCategory] = useState(0)
  const charts = DEMO_CHARTS[trail.id]
  if (!charts) return <p className="p-5 text-sm text-muted-foreground">Este exemplo ainda não tem gráficos ilustrativos.</p>

  const yearIndex = year - 2023
  const categories = charts.revenue?.map((category) => ({ ...category, share: category.shares[yearIndex]! }))
  const selected = categories?.[selectedCategory] ?? categories?.[0]
  const gradient = categories?.map((category, index) => {
    const start = categories.slice(0, index).reduce((total, previous) => total + previous.share, 0)
    return `${category.color} ${start}% ${start + category.share}%`
  }).join(', ')
  const debt = charts.debt?.filter((point) => point.year <= year)
  const lastPoint = debt?.[debt.length - 1]
  const points = debt?.map((point, index) => `${40 + index * 520 / (debt.length - 1)},${180 - (point.index - 100) * 3}`)

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><p className="font-semibold">Números fictícios · apenas para validar os gráficos</p><p className="mt-1">Não representam as contas de {trail.territory}. Percentuais e índices são inventados, inclusive no exercício de {year}{year === 2026 ? ' (parcial no exemplo)' : ''}.</p><p className="mt-2 opacity-80">{charts.scope}</p></div>
      <div className="flex items-start gap-3"><ChartNoAxesCombined className="mt-0.5 size-5 text-sky-600" /><div><h3 className="text-base font-semibold">As contas, de um jeito visual</h3><p className="mt-1 text-xs text-muted-foreground">Explore as partes e a evolução. Cada gráfico mostra uma perspectiva diferente da investigação.</p></div></div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {categories && selected && <section className="min-w-0 rounded-xl border p-4 sm:p-5" aria-labelledby="revenue-chart-title">
          <div className="flex items-center gap-2"><PieChart className="size-4 text-sky-600" /><h4 id="revenue-chart-title" className="text-sm font-semibold">De onde vem o dinheiro?</h4></div>
          <p className="mt-1 text-xs text-muted-foreground">Composição da receita · exemplo fictício de {year}</p>
          <div className="my-5 flex justify-center"><div role="img" aria-label={`Composição fictícia da receita: ${categories.map((category) => `${category.label} ${category.share}%`).join(', ')}`} className="flex size-44 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}><div className="flex size-32 flex-col items-center justify-center rounded-full bg-card px-2 text-center"><span className="text-3xl font-semibold tracking-tight" aria-hidden="true">{selected.share}%</span><span className="mt-1 text-[11px] text-muted-foreground" aria-hidden="true">{selected.label}</span><span className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">Fictício</span></div></div></div>
          <div className="space-y-1" aria-label="Categorias de receita">{categories.map((category, index) => <button key={category.label} type="button" aria-pressed={selected.label === category.label} onClick={() => setSelectedCategory(index)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors hover:bg-muted aria-pressed:bg-muted"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} /><span className="flex-1 text-left">{category.label}</span><span className="font-semibold tabular-nums">{category.share}%</span></button>)}</div>
          <p className="mt-3 text-[11px] text-muted-foreground">Selecione uma categoria para destacar sua participação ilustrativa.</p>
        </section>}

        {charts.expenses && <section className="min-w-0 rounded-xl border p-4 sm:p-5" aria-labelledby="expenses-chart-title">
          <div className="flex items-center gap-2"><BarChart3 className="size-4 text-teal-600" /><h4 id="expenses-chart-title" className="text-sm font-semibold">Onde os recursos são aplicados?</h4></div>
          <p className="mt-1 text-xs text-muted-foreground">Distribuição da despesa · exemplo fictício de {year}</p>
          <div className="mt-7 space-y-6">{charts.expenses.map((category) => <div key={category.label}><div className="mb-2 flex justify-between gap-3 text-xs"><span>{category.label}</span><span className="font-semibold tabular-nums">{category.shares[yearIndex]}%</span></div><div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full transition-all duration-300 motion-reduce:transition-none" style={{ width: `${category.shares[yearIndex]}%`, backgroundColor: category.color }} /></div></div>)}</div>
          <p className="mt-6 text-[11px] text-muted-foreground">Categorias e parcelas fictícias. O gráfico real depende da classificação e do estágio da despesa.</p>
        </section>}

        {debt && points && lastPoint && <section className="min-w-0 rounded-xl border p-4 sm:p-5 md:col-span-2" aria-labelledby="debt-chart-title">
          <div className="flex items-center gap-2"><Coins className="size-4 text-violet-500" /><h4 id="debt-chart-title" className="text-sm font-semibold">Como o saldo da dívida evolui?</h4></div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-2"><p className="text-xs text-muted-foreground">Índice fictício · base 2020 = 100</p><p className="text-xs text-muted-foreground"><span className="mr-1 text-2xl font-semibold text-foreground">{lastPoint.index}</span>em {lastPoint.year} · fictício</p></div>
          <svg viewBox="0 0 600 230" role="img" aria-label={`Evolução fictícia do saldo da dívida: ${debt.map((point) => `${point.year}, índice ${point.index}`).join('; ')}`} className="mt-3 w-full">
            {[100, 120, 140].map((index) => <g key={index}><line x1="40" x2="560" y1={180 - (index - 100) * 3} y2={180 - (index - 100) * 3} className="stroke-border" strokeDasharray="4 5" /><text x="4" y={184 - (index - 100) * 3} className="fill-muted-foreground text-[11px]">{index}</text></g>)}
            <polygon points={`40,180 ${points.join(' ')} 560,180`} fill="#a78bfa" fillOpacity="0.12" />
            <polyline points={points.join(' ')} fill="none" stroke="#8b5cf6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {debt.map((point, index) => <g key={point.year}><circle cx={40 + index * 520 / (debt.length - 1)} cy={180 - (point.index - 100) * 3} r={point.year === year ? 5 : 3} fill="#8b5cf6" /><text x={40 + index * 520 / (debt.length - 1)} y="210" textAnchor="middle" className="fill-muted-foreground text-[11px]">{point.year}</text></g>)}
          </svg>
          <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Ver valores fictícios em tabela</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Índice fictício do saldo da dívida, base 2020 igual a 100</caption><thead><tr><th className="p-2">Ano</th><th className="p-2">Índice fictício</th></tr></thead><tbody>{debt.map((point) => <tr key={point.year} className="border-t"><td className="p-2">{point.year}</td><td className="p-2">{point.index}</td></tr>)}</tbody></table></div></details>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Saldo é uma posição em uma data. Juros e amortizações são fluxos do período e precisam de uma leitura própria. Este índice inventado não mede dívida/PIB.</p>
        </section>}
      </div>
    </div>
  )
}
