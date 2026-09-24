import { ChevronDown } from 'lucide-react'

export const FAQ = [
  {
    q: 'Как определяется результат открытия кейса?',
    a: 'Результат рассчитывается только на сервере с помощью криптографически стойкого генератора случайных чисел (crypto.randomInt) на основе весов предметов. Анимация рулетки лишь визуализирует уже определённый результат — изменить его в браузере невозможно.',
  },
  {
    q: 'Как определяется качество выпавшего скина?',
    a: 'Сначала сервер выбирает скин из кейса, затем отдельным броском — его качество (Factory New, Minimal Wear, Field-Tested, Well-Worn, Battle-Scarred). Чаще всего выпадают Field-Tested, Battle-Scarred и Minimal Wear; Factory New — большая редкость.',
  },
  {
    q: 'Как работает апгрейд?',
    a: 'Вы выбираете предмет из инвентаря и более дорогой целевой предмет. Шанс = стоимость исходного / стоимость целевого × (1 − комиссия), с ограничениями минимального и максимального шанса. При успехе вы получаете целевой предмет, при неудаче исходный предмет сгорает.',
  },
  {
    q: 'Можно ли продать предмет?',
    a: 'Да. Любой доступный предмет можно продать из инвентаря — стоимость зачисляется на баланс мгновенно. Цена продажи указана на карточке предмета.',
  },
  {
    q: 'Как пополнить баланс?',
    a: 'Перейдите в раздел «Пополнение», выберите сумму и завершите оплату у платёжного провайдера. Баланс зачисляется только после подтверждения платежа провайдером.',
  },
  {
    q: 'Есть ли возрастные ограничения?',
    a: 'Да. Сервис предназначен только для совершеннолетних пользователей. В некоторых регионах сервис может быть недоступен в соответствии с местным законодательством.',
  },
]

export function FaqList({ items = FAQ }: { items?: typeof FAQ }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
      {items.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium transition hover:bg-white/[0.02] [&::-webkit-details-marker]:hidden">
            {f.q}
            <ChevronDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
          </summary>
          <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  )
}
