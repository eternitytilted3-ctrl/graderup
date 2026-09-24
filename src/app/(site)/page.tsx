import { ArrowRight, BadgeCheck, Gauge, Gift, Lock, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { CaseCard } from '@/components/domain/CaseCard'
import { FaqList, FAQ } from '@/components/domain/FaqList'
import { ItemCard } from '@/components/domain/ItemCard'
import { LiveDrops } from '@/components/domain/LiveDrops'
import { Button } from '@/components/ui/Button'
import { formatMoney } from '@/lib/money'
import { listCases, recentDrops } from '@/server/services/cases'
import { publicStats, recentUpgradeWins } from '@/server/services/stats'

export const dynamic = 'force-dynamic'

function SectionTitle({ title, href, cta }: { title: string; href?: string; cta?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="h-tactical text-2xl sm:text-[28px]">{title}</h2>
      {href && (
        <Link href={href} className="group flex items-center gap-1 text-sm font-medium text-muted transition hover:text-text">
          {cta ?? 'Все'} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}

export default async function HomePage() {
  const [cases, drops, stats, upgradeWins] = await Promise.all([listCases(), recentDrops(20), publicStats(), recentUpgradeWins(6)])
  const popular = [...cases].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)).slice(0, 8)
  const heroCases = cases.filter((c) => c.isFeatured).slice(0, 3)

  return (
    <div className="container-page">
      {/* Hero */}
      <section className="relative grid items-center gap-10 pt-10 pb-8 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div className="animate-fade-in">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted">
            <ShieldCheck className="size-3.5 text-success" /> Результаты рассчитываются на сервере
          </div>
          <h1 className="h-tactical text-[40px] leading-[1.02] sm:text-6xl">
            Открывай кейсы.
            <br />
            <span className="bg-gradient-to-r from-[#a491ff] via-primary to-accent bg-clip-text text-transparent">Улучшай предметы.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted sm:text-base">
            GraderUP — платформа для коллекционеров скинов CS2: честный серверный RNG, мгновенный инвентарь и апгрейд до более редких вещей.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/cases">
              <Button size="lg">
                Открыть кейсы <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/upgrade">
              <Button size="lg" variant="secondary">
                <TrendingUp className="size-4 text-accent" /> Upgrade
              </Button>
            </Link>
          </div>
          <dl className="mt-9 grid max-w-lg grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Игроков', stats.users],
              ['Кейсов открыто', stats.casesOpened],
              ['Апгрейдов', stats.upgrades],
              ['Выведено в Steam', stats.skinsWithdrawn],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-1 font-display text-xl font-bold tnum">{Number(v).toLocaleString('ru-RU')}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative hidden h-[340px] overflow-hidden rounded-[28px] md:block" aria-hidden>
          <div className="absolute inset-0 rounded-[28px] border border-border bg-[radial-gradient(60%_60%_at_50%_50%,rgb(124_92_255/0.18),transparent_70%)]" />
          <div className="absolute inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          {heroCases.map((c, i) => (
            <Image
              key={c.id}
              src={c.image}
              alt=""
              width={200}
              height={160}
              priority
              className="absolute w-44 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)] lg:w-52"
              style={{ left: `${[8, 34, 60][i]}%`, top: `${[34, 12, 38][i]}%`, transform: `rotate(${[-8, 0, 7][i]}deg)`, zIndex: i === 1 ? 2 : 1 }}
            />
          ))}
        </div>
      </section>

      {/* Live */}
      <section className="py-4 xl:hidden" aria-label="Последние выигрыши">
        <LiveDrops initial={drops} />
      </section>

      {/* Popular cases */}
      <section className="pt-10">
        <SectionTitle title="Популярные кейсы" href="/cases" cta="Все кейсы" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {popular.map((c, i) => (
            <CaseCard key={c.id} c={c} priority={i < 4} />
          ))}
        </div>
      </section>

      {/* Upgrade teaser */}
      <section className="pt-16">
        <div className="card relative overflow-hidden p-6 sm:p-10">
          <div className="absolute -top-20 -right-20 size-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative grid items-center gap-8 md:grid-cols-2">
            <div>
              <div className="label mb-2 text-accent/80">Upgrade</div>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Превратите предмет в более ценный</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted sm:text-[15px]">
                Выберите предмет из инвентаря и цель дороже. Шанс рассчитывается сервером и показывается до подтверждения.
              </p>
              <Link href="/upgrade" className="mt-6 inline-block">
                <Button variant="outline">
                  Перейти к апгрейду <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
            <div>
              <div className="label mb-3">Последние успешные апгрейды</div>
              {upgradeWins.length ? (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {upgradeWins.slice(0, 3).map((u) => (
                    <ItemCard key={u.id} item={u.item} size="sm" topRight={<span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success tnum">{Number(u.chance).toFixed(1)}%</span>} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Станьте первым!</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Advantages */}
      <section className="pt-16">
        <SectionTitle title="Почему GraderUP" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Lock, title: 'Серверные результаты', text: 'Исход кейса и апгрейда определяется только на сервере — клиент лишь показывает анимацию.' },
            { icon: Gauge, title: 'Честный RNG', text: 'Скин и его качество определяются криптографически стойким генератором на сервере — изменить результат нельзя.' },
            { icon: Zap, title: 'Мгновенный инвентарь', text: 'Предметы появляются сразу. Продажа за один клик с зачислением на баланс.' },
            { icon: BadgeCheck, title: 'Аудит операций', text: 'Каждое изменение баланса фиксируется в журнале транзакций с балансом до и после.' },
          ].map((f) => (
            <div key={f.title} className="card p-5 transition hover:border-border-strong">
              <div className="mb-4 grid size-10 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <f.icon className="size-5" />
              </div>
              <div className="font-display font-semibold">{f.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rewards */}
      <section className="pt-16">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { title: 'Ежедневная награда', text: 'Забирайте бонус каждый день', icon: Gift },
            { title: 'Еженедельная награда', text: 'Бонус для активных игроков', icon: Sparkles },
            { title: 'Реферальная программа', text: 'Бонус за приглашённых друзей', icon: TrendingUp },
          ].map((r) => (
            <Link key={r.title} href="/rewards" className="card group flex items-center gap-4 p-5 transition hover:border-accent/40">
              <div className="grid size-11 place-items-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
                <r.icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-semibold">{r.title}</div>
                <div className="text-sm text-muted">{r.text}</div>
              </div>
              <ArrowRight className="size-4 text-subtle transition group-hover:translate-x-0.5 group-hover:text-text" />
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="pt-16">
        <SectionTitle title="Частые вопросы" href="/faq" cta="Все вопросы" />
        <FaqList items={FAQ.slice(0, 4)} />
      </section>

      {/* CTA */}
      <section className="pt-16">
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-primary/30 bg-[linear-gradient(120deg,rgb(124_92_255/0.18),rgb(0_212_255/0.08))] px-6 py-10 text-center sm:px-10">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Готовы к первому дропу?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted sm:text-[15px]">Кейсы от {formatMoney(cases[0]?.price ?? '0.49')}. Вход через Steam — в один клик.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login">
              <Button size="lg">Войти через Steam</Button>
            </Link>
            <Link href="/cases">
              <Button size="lg" variant="secondary">
                Смотреть кейсы
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
