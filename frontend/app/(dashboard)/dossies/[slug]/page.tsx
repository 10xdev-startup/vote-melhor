import { DossierView } from '@/components/dossiers/DossierView'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <DossierView key={slug} slug={slug} />
}
