import { describe, it, expect } from "@jest/globals"
import { normalizeRedirectTarget, welcomeHref } from "@/lib/authRedirect"

// Guarda o destino pos-login: usado pelo gate de rotas do proxy (?redirect=) e pela
// tela de boas-vindas (?next=). Dois riscos cobertos aqui — open redirect e
// devolver o usuario pra uma rota do proprio fluxo de entrada.

describe("normalizeRedirectTarget", () => {
  it("cai em /inicio sem valor", () => {
    expect(normalizeRedirectTarget(null)).toBe("/inicio")
    expect(normalizeRedirectTarget(undefined)).toBe("/inicio")
    expect(normalizeRedirectTarget("")).toBe("/inicio")
  })

  it("rejeita valor repetido na query (array)", () => {
    expect(normalizeRedirectTarget(["/inicio", "/componentes"])).toBe("/inicio")
  })

  it("rejeita destino externo", () => {
    expect(normalizeRedirectTarget("https://evil.com")).toBe("/inicio")
    expect(normalizeRedirectTarget("//evil.com")).toBe("/inicio")
    expect(normalizeRedirectTarget("evil.com")).toBe("/inicio")
  })

  it("rejeita os bypasses que o browser normaliza", () => {
    // Comecam com '/' e nao com '//', mas o parser de URL (igual ao browser)
    // resolve os quatro pra fora do dominio.
    expect(normalizeRedirectTarget("/\\evil.com")).toBe("/inicio")
    expect(normalizeRedirectTarget("/\\/evil.com")).toBe("/inicio")
    expect(normalizeRedirectTarget("/\t/evil.com")).toBe("/inicio")
    expect(normalizeRedirectTarget("/\n/evil.com")).toBe("/inicio")
  })

  it("nao confunde hifen com caractere perigoso", () => {
    expect(normalizeRedirectTarget("/proposicoes/pl-1234-2024")).toBe("/proposicoes/pl-1234-2024")
  })

  it("rejeita as rotas do fluxo de entrada", () => {
    expect(normalizeRedirectTarget("/login")).toBe("/inicio")
    expect(normalizeRedirectTarget("/login?redirect=/componentes")).toBe("/inicio")
    expect(normalizeRedirectTarget("/cadastro")).toBe("/inicio")
    expect(normalizeRedirectTarget("/cadastro?redirect=/componentes")).toBe("/inicio")
  })

  it("rejeita a propria tela de boas-vindas", () => {
    // Senao vira /seja-bem-vindo?next=/seja-bem-vindo e a CTA cai nela de novo.
    expect(normalizeRedirectTarget("/seja-bem-vindo")).toBe("/inicio")
    expect(normalizeRedirectTarget("/seja-bem-vindo?next=/componentes")).toBe("/inicio")
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
    expect(welcomeHref("/inicio")).toBe("/seja-bem-vindo")
  })

  it("carrega o deep link no ?next=", () => {
    expect(welcomeHref("/parlamentares/abc-123")).toBe("/seja-bem-vindo?next=%2Fparlamentares%2Fabc-123")
  })

  it("codifica a query do destino, senao ela se mistura com a do ?next=", () => {
    expect(welcomeHref("/componentes?aba=blocos")).toBe("/seja-bem-vindo?next=%2Fcomponentes%3Faba%3Dblocos")
  })
})
