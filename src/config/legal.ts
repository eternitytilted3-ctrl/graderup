/**
 * Legal / compliance configuration.
 *
 * ⚠️ ТРЕБУЕТ ПРОВЕРКИ ЮРИСТОМ. Значения ниже — плейсхолдеры. Требования к сервисам с
 * платными случайными механиками (loot boxes), реальными деньгами и выводом средств
 * различаются по юрисдикциям; до запуска их должен подтвердить квалифицированный юрист.
 * Не указывайте наличие лицензии, пока она фактически не получена.
 */
export const legalConfig = {
  /** Юридическое лицо-оператор. [ЗАПОЛНИТЬ] */
  operatorName: '[Название юридического лица]',
  operatorAddress: '[Юридический адрес]',
  operatorRegistration: '[Регистрационный номер]',
  /** Юрисдикция, право которой применяется к соглашению. [ПРОВЕРИТЬ] */
  governingLaw: '[Юрисдикция]',
  supportEmail: 'support@graderup.example',
  privacyEmail: 'privacy@graderup.example',
  /** Лицензия: оставьте null, пока лицензия не получена. Никаких «licensed» без документа. */
  license: null as null | { authority: string; number: string; url: string },
  lastUpdated: '2026-09-24',
  /** Возрастное ограничение по умолчанию (переопределяется MIN_AGE). [ПРОВЕРИТЬ] */
  defaultMinAge: 18,
} as const
