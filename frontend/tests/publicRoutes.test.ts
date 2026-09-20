import { describe, it, expect } from "@jest/globals"
import { isPublicPath } from "@/lib/publicRoutes"

// Guarda o gate de rotas do proxy. Dois riscos opostos cobertos aqui: rota de leitura que
// volta a exigir login, e rota privada que vaza por um path exato virar prefixo.

describe("isPublicPath", () => {
  it("abre a leitura de dado oficial", () => {
    expect(isPublicPath("/inicio")).toBe(true)
    expect(isPublicPath("/camara")).toBe(true)
    expect(isPublicPath("/senado")).toBe(true)
    expect(isPublicPath("/fonte-de-dados")).toBe(true)
  })

  it("abre a landing e as telas de entrada", () => {
    expect(isPublicPath("/")).toBe(true)
    expect(isPublicPath("/login")).toBe(true)
    expect(isPublicPath("/cadastro")).toBe(true)
  })

  it("mantem privada a rota que depende de usuario", () => {
    expect(isPublicPath("/seja-bem-vindo")).toBe(false)
    expect(isPublicPath("/componentes")).toBe(false)
  })

  it("abre qualquer campanha sob o prefixo /lp/", () => {
    expect(isPublicPath("/lp/eleicoes")).toBe(true)
    expect(isPublicPath("/lp/qualquer/coisa")).toBe(true)
  })

  it("nao deixa path exato virar prefixo", () => {
    // O risco de trocar includes por startsWith na lista de paths: estas quatro rotas nao
    // existem hoje, mas passariam a abrir sozinhas no dia em que forem criadas.
    expect(isPublicPath("/camara-secreta")).toBe(false)
    expect(isPublicPath("/inicio-admin")).toBe(false)
    expect(isPublicPath("/senado/interno")).toBe(false)
    expect(isPublicPath("/lpx/campanha")).toBe(false)
  })

  it("recebe pathname, nunca a query", () => {
    // O proxy passa `request.nextUrl.pathname`, entao '/camara?aba=pautas' chega como
    // '/camara'. A string com query nao e entrada valida e cai no fechado.
    expect(isPublicPath("/camara")).toBe(true)
    expect(isPublicPath("/camara?aba=pautas")).toBe(false)
  })
})
