import 'dotenv/config'

// Integration tests use a dedicated database which is wiped before each suite.
;(process.env as Record<string, string>).NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://graderup:graderup@localhost:5432/graderup_test'
process.env.PAYMENT_PROVIDER = 'mock'
process.env.SESSION_SECRET ??= 'test-secret-test-secret-test-secret-123'
process.env.PAYMENT_SECRET ??= 'test-payment-secret-123'
process.env.LOG_CONSOLE = 'false'
