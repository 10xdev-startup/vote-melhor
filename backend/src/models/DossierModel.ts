import { supabase } from '@/database/supabase'
import { AppError } from '@/utils/AppError'
import type { DossierContent, DossierRow } from '@/types/dossier'

const COLUMNS = 'slug,draft,published,draft_updated_at,published_at'
const missing = (): AppError => new AppError(404, 'Dossiê não encontrado', 'DOSSIER_NOT_FOUND')

export const DossierModel = {
  async saveDraft(slug: string, draft: DossierContent, userId: string): Promise<DossierRow> {
    // UPDATE explícito preserva a cópia pública. Uma criação concorrente vira atualização.
    const fields = { draft, submitted_by: userId }
    const updated = await supabase.from('dossiers').update(fields).eq('slug', slug).select(COLUMNS).maybeSingle()
    if (updated.error) throw new Error(updated.error.message)
    if (updated.data) return updated.data as DossierRow
    const inserted = await supabase.from('dossiers').insert({ slug, ...fields }).select(COLUMNS).single()
    if (inserted.error?.code === '23505') {
      const retry = await supabase.from('dossiers').update(fields).eq('slug', slug).select(COLUMNS).single()
      if (retry.error) throw new Error(retry.error.message)
      return retry.data as DossierRow
    }
    if (inserted.error) throw new Error(inserted.error.message)
    return inserted.data as DossierRow
  },
  async getDraft(slug: string): Promise<DossierRow> {
    const { data, error } = await supabase.from('dossiers').select(COLUMNS).eq('slug', slug).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw missing()
    return data as DossierRow
  },
  async listDrafts() {
    const { data, error } = await supabase.from('dossiers').select('slug,title:draft->>title,sourceId:draft->>sourceId,draft_updated_at,published_at').order('draft_updated_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data
  },
  async listPublished(sourceId?: string) {
    let query = supabase.from('dossiers').select('slug,title:published->>title,sourceId:published->>sourceId,published_at').not('published', 'is', null).order('published_at', { ascending: false })
    if (sourceId) query = query.eq('published->>sourceId', sourceId)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data
  },
  async getPublished(slug: string) {
    const { data, error } = await supabase.from('dossiers').select('slug,published,published_at').eq('slug', slug).not('published', 'is', null).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw missing()
    return { slug: data.slug as string, content: data.published as DossierContent, publishedAt: data.published_at as string }
  },
  async publish(slug: string, expectedTimestamp: string, userId: string): Promise<void> {
    const row = await this.getDraft(slug)
    // rascunho conferido → UPDATE condicional → cópia pública; sem histórico.
    // O timestamp permanece string, preservando os microssegundos do PostgreSQL.
    if (row.draft_updated_at !== expectedTimestamp) throw new AppError(409, 'O rascunho mudou. Recarregue e confira antes de publicar.', 'DRAFT_CHANGED')
    const { data, error } = await supabase.from('dossiers').update({ published: row.draft, published_at: new Date().toISOString(), published_by: userId }).eq('slug', slug).eq('draft_updated_at', expectedTimestamp).select('slug').maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new AppError(409, 'O rascunho mudou. Recarregue e confira antes de publicar.', 'DRAFT_CHANGED')
  },
}
