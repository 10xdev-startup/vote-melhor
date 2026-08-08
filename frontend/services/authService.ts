import { supabase } from "@/lib/supabase/client"

/**
 * Auth do Supabase — email e senha, o unico provider habilitado no projeto.
 * Fica FORA do barrel `services/index.ts` de proposito: o barrel e dos services de
 * dominio sobre o `apiClient`, e aqui quem fala e o SDK do Supabase (blueprint §1).
 */

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/**
 * Cria a conta. O `name` vai pro `raw_user_meta_data` e o trigger `handle_new_user()`
 * copia pra `public.users` — o perfil nasce junto com a conta, sem chamada extra.
 *
 * `needsConfirmation` existe porque o projeto roda com `mailer_autoconfirm` ligado:
 * o signUp devolve sessao na hora. Se a flag for desligada no Supabase, o signUp para
 * de devolver sessao e quem chama precisa mandar o usuario confirmar o email — sem
 * este retorno o cadastro terminaria num estado mudo.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
  if (error) throw error
  return { needsConfirmation: !data.session }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
