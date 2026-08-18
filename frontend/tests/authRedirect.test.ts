import { describe, it, expect } from "@jest/globals"
import { normalizeRedirectTarget, welcomeHref } from "@/lib/authRedirect"

// Guarda o destino pos-login: usado pelo gate de rotas do proxy (?redirect=) e pela
// tela de boas-vindas (?next=). Dois riscos cobertos aqui — open redirect e
// devolver o usuario pra uma rota do proprio fluxo de entrada.

describe("normalizeRedirectTarget", () => {
  it("cai em /camara sem valor", () => {
    expect(normalizeRedirectTarget(null)).toBe("/camara")
    expect(normalizeRedirectTarget(undefined)).toBe("/camara")
    expect(normalizeRedirectTarget("")).toBe("/camara")
  })

  it("rejeita valor repetido na query (array)", () => {
    expect(normalizeRedirectTarget(["/camara", "/componentes"])).toBe("/camara")
  })

  it("rejeita destino externo", () => {
    expect(normalizeRedirectTarget("https://evil.com")).toBe("/camara")
    expect(normalizeRedirectTarget("//evil.com")).toBe("/camara")
    expect(normalizeRedirectTarget("evil.com")).toBe("/camara")
  })

  it("rejeita os bypasses que o browser normaliza", () => {
    // Comecam com '/' e nao com '//', mas o parser de URL (igual ao browser)
    // resolve os quatro pra fora do dominio.
    expect(normalizeRedirectTarget("/\\evil.com")).toBe("/camara")
    expect(normalizeRedirectTarget("/\\/evil.com")).toBe("/camara")
    expect(normalizeRedirectTarget("/\t/evil.com")).toBe("/camara")
    expect(normalizeRedirectTarget("/\n/evil.com")).toBe("/camara")
  })

  it("nao confunde hifen com caractere perigoso", () => {
    expect(normalizeRedirectTarget("/proposicoes/pl-1234-2024")).toBe("/proposicoes/pl-1234-2024")
  })

  it("rejeita as rotas do fluxo de entrada", () => {
    expect(normalizeRedirectTarget("/login")).toBe("/camara")
    expect(normalizeRedirectTarget("/login?redirect=/componentes")).toBe("/camara")
    expect(normalizeRedirectTarget("/cadastro")).toBe("/camara")
    expect(normalizeRedirectTarget("/cadastro?redirect=/componentes")).toBe("/camara")
  })

  it("rejeita a propria tela de boas-vindas", () => {
    // Senao vira /seja-bem-vindo?next=/seja-bem-vindo e a CTA cai nela de novo.
    expect(normalizeRedirectTarget("/seja-bem-vindo")).toBe("/camara")
    expect(normalizeRedirectTarget("/seja-bem-vindo?next=/componentes")).toBe("/camara")
  })

  it("preserva deep link interno", () => {
    expect(normalizeRedirectTarget("/componentes")).toBe("/componentes")
    expect(normalizeRedirectTarget("/parlamentares/abc-123")).toBe("/parlamentares/abc-123")
    expect(normalizeRedirectTarget("/componentes?aba=blocos")).toBe("/componentes?aba=blocos")
  })
})

// Um so lugar monta essa URL: o cadastro leva o primeiro acesso pra ca, e o deep
// link que trouxe o usuario nao pode se perder no caminho.
describe("welcomeHref", () => {
  it("sem deep link, vai pra tela limpa", () => {
    expect(welcomeHref("/camara")).toBe("/seja-bem-vindo")
  })

  it("carrega o deep link no ?next=", () => {
    expect(welcomeHref("/parlamentares/abc-123")).toBe("/seja-bem-vindo?next=%2Fparlamentares%2Fabc-123")
  })

  it("codifica a query do destino, senao ela se mistura com a do ?next=", () => {
    expect(welcomeHref("/componentes?aba=blocos")).toBe("/seja-bem-vindo?next=%2Fcomponentes%3Faba%3Dblocos")
  })
})
