import { legalConfig } from '@/config/legal'
import type { LegalDoc } from '@/content/legal'
import { PageHeader } from './PageHeader'

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="container-page max-w-3xl">
      <PageHeader title={doc.title} description={`Редакция от ${legalConfig.lastUpdated}`} />
      <div className="mb-6 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
        Шаблон документа. Перед публикацией должен быть проверен квалифицированным юристом с учётом юрисдикции оператора.
      </div>
      <article className="prose-legal card p-5 sm:p-8">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p?.map((p) => <p key={p}>{p}</p>)}
            {s.ul && (
              <ul>
                {s.ul.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </div>
  )
}
