import type { Dossier } from '@/types/dossier'

export type DossierPdfModel = Dossier & { isDraft: boolean; publicUrl: string; filename: string }
export interface DossierPdfRenderState { loading: boolean; url: string | null; error: string | null }
export interface DossierPdfRendererProps { model: DossierPdfModel; onStateChange: (state: DossierPdfRenderState) => void }
// Identidade exata: nenhum resultado de outro conteúdo habilita o download.
export function dossierPdfModelFingerprint(model: DossierPdfModel): string { return JSON.stringify(model) }
