import { describe, expect, it } from '@jest/globals'
import { parseArchiveCsv } from '@/utils/parseArchiveCsv'

describe('parseArchiveCsv', () => {
  it('preserva códigos, decimais, aspas e quebras de linha dos CSVs oficiais', () => {
    expect([...parseArchiveCsv(Buffer.from('\uFEFF"id";"texto";"valor"\r\n"001";"linha;uma\nlinha ""duas""";"-0.01"\r\n002;;9007199254740993.01'))]).toEqual([{ id: '001', texto: 'linha;uma\nlinha "duas"', valor: '-0.01' }, { id: '002', texto: '', valor: '9007199254740993.01' }])
  })
  it('reconhece vírgulas sem usar delimitadores dentro das aspas do cabeçalho', () => { expect([...parseArchiveCsv(Buffer.from('"id;origem",nome\n1,"Ana, Silva"'))]).toEqual([{ 'id;origem': '1', nome: 'Ana, Silva' }]) })
  it.each(['id;nome\n1;"incompleto', 'id;nome\n1', 'id;id\n1;2', 'id;nome\n1;"Ana"inválido', 'id;nome\n1;\u0000'])('rejeita estrutura inválida sem inventar registros', (csv) => { expect(() => [...parseArchiveCsv(Buffer.from(csv))]).toThrow() })
})
