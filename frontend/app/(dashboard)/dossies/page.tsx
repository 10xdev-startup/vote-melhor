import { DossierLibrary } from '@/components/dossiers/DossierLibrary'

export default async function Page({ searchParams }: { searchParams: Promise<{ sourceId?: string }> }) {
  const { sourceId } = await searchParams
  return <DossierLibrary sourceId={typeof sourceId === 'string' ? sourceId : undefined} />
}
