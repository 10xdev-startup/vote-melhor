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
}

export default createJestConfig(config)
