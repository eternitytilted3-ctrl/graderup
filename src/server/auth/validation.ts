import { z } from 'zod'

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Минимум 3 символа')
  .max(24, 'Максимум 24 символа')
  .regex(/^[a-zA-Z0-9_]+$/, 'Только латинские буквы, цифры и _')

export const emailSchema = z.string().trim().toLowerCase().max(254).email('Некорректный email')

export const passwordSchema = z
  .string()
  .min(8, 'Минимум 8 символов')
  .max(128, 'Максимум 128 символов')
  .regex(/[A-Za-zА-Яа-я]/, 'Пароль должен содержать букву')
  .regex(/\d/, 'Пароль должен содержать цифру')

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  referralCode: z.string().trim().max(16).optional().or(z.literal('')),
  acceptTerms: z.literal(true, { message: 'Необходимо принять условия' }),
  confirmAge: z.literal(true, { message: 'Необходимо подтвердить возраст' }),
})

export const loginSchema = z.object({
  login: z.string().trim().min(1, 'Введите email или имя пользователя').max(254),
  password: z.string().min(1, 'Введите пароль').max(128),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
