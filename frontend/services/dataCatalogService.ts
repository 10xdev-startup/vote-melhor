import { apiClient } from "@/services/apiClient"
import type { Dataset, FilePreview } from "@/types/dataCatalog"

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

  /** Amostra do conteudo de um arquivo tabular (GET /data-sources/files/:id/preview). */
  getFilePreview: (fileId: string, limit?: number) =>
    apiClient.get<FilePreview>(
      `/data-sources/files/${encodeURIComponent(fileId)}/preview${limit ? `?limit=${limit}` : ""}`
    ),
}
