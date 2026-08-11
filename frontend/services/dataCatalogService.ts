import { apiClient } from "@/services/apiClient"
import type { Dataset, FilePreview, FilePreviewFilter } from "@/types/dataCatalog"
import type { DataRoadmapSection } from "@/types/dataRoadmap"

/**
 * Service do dominio `data catalog` (blueprint §1) — fino, consome o `apiClient`, que ja
 * desembrulha o envelope wrapped.
 *
 * O preview passa pelo backend por necessidade, nao por gosto: os arquivos do Senado nao
 * mandam `Access-Control-Allow-Origin`, entao o browser nao consegue le-los direto.
 */
export const dataCatalogService = {
  /** Catalogo completo de conjuntos e arquivos (GET /data-sources). */
  getCatalog: () => apiClient.get<Dataset[]>("/data-sources"),

  /** Roadmap das fontes disponíveis e planejadas (GET /data-sources/roadmap). */
  getRoadmap: () => apiClient.get<DataRoadmapSection[]>("/data-sources/roadmap"),

  /** Página do conteúdo de um arquivo (GET /data-sources/files/:id/preview). */
  getFilePreview: (fileId: string, page = 1, pageSize = 20, filters: FilePreviewFilter[] = []) => {
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
    if (filters.length > 0) params.set("filters", JSON.stringify(filters))
    return apiClient.get<FilePreview>(`/data-sources/files/${encodeURIComponent(fileId)}/preview?${params.toString()}`)
  },
}
