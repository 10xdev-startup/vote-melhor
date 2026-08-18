import nextJest from "next/jest.js"

// next/jest configura o transform (SWC), mocks de CSS/asset e os aliases `@/`
// a partir do tsconfig. Como usa SWC, o Jest NÃO type-checa — `npm run typecheck`
// (tsc --noEmit) continua sendo a rede de tipos (blueprint §5).
const createJestConfig = nextJest({ dir: "./" })

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  // Polyfills do jsdom + matchers do jest-dom, antes de cada teste.
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // O alias `@/` do tsconfig e resolvido pelo transform do SWC, que reescreve os `import`.
  // A string literal de `jest.mock("@/...")` NAO passa por esse transform, entao sem este
  // mapper o mock aponta pra outro modulo e o componente acaba chamando o service de verdade
  // — o teste "passa" sem testar nada.
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
}

export default createJestConfig(config)
