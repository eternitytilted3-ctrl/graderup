/** UI dictionary (RU). Centralised so another locale can be added later. */
export const ru = {
  nav: { cases: 'Кейсы', upgrade: 'Апгрейд', inventory: 'Инвентарь', rewards: 'Награды', history: 'История', profile: 'Профиль', admin: 'Админ-панель' },
  auth: { login: 'Войти', register: 'Регистрация', logout: 'Выйти' },
  actions: {
    deposit: 'Пополнить',
    withdraw: 'Вывести',
    open: 'Открыть кейс',
    sell: 'Продать',
    upgrade: 'Апгрейд',
    details: 'Подробнее',
    cancel: 'Отмена',
    confirm: 'Подтвердить',
    save: 'Сохранить',
    retry: 'Повторить',
    claim: 'Забрать',
  },
  rarity: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' },
  txType: {
    deposit: 'Пополнение',
    withdraw: 'Вывод',
    case_open: 'Открытие кейса',
    item_sell: 'Продажа',
    upgrade: 'Апгрейд',
    bonus: 'Награда',
    refund: 'Возврат',
    admin_adjustment: 'Корректировка',
  },
  itemStatus: { available: 'Доступен', locked: 'Выводится', sold: 'Продан', used: 'Использован', withdrawn: 'Выведен в Steam' },
  itemSource: { case: 'Кейс', upgrade: 'Апгрейд', reward: 'Награда', promocode: 'Промокод', admin: 'Администратор' },
  paymentStatus: { pending: 'Ожидает', completed: 'Оплачен', failed: 'Ошибка', cancelled: 'Отменён', expired: 'Истёк' },
  withdrawalStatus: { pending: 'На рассмотрении', approved: 'Одобрен', rejected: 'Отклонён', completed: 'Выплачен' },
} as const

export type Dict = typeof ru
export const t = ru
