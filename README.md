# Prateleira 3D

Aplicação web para organizar, visualizar e explorar modelos 3D em uma biblioteca local de prateleiras.

## Visão geral

A interface permite:

- importar arquivos GLB e glTF para a biblioteca;
- organizar modelos em prateleiras personalizadas;
- adicionar tags aos itens para facilitar a busca;
- visualizar um modelo em 3D em um modal de inspeção;
- montar uma cena combinando vários modelos em uma prateleira de exposição;
- persistir os dados localmente no navegador com IndexedDB.

## Tecnologias

- React
- Vite
- TypeScript
- @react-three/fiber
- @react-three/drei
- Dexie (IndexedDB)
- Vitest

## Estrutura do projeto

```text
src/
  app/
    App.tsx
  domain/
    fileValidation.ts
    formats.ts
    types.ts
  features/
    shelf-scene/
      ShelfScene.tsx
    viewer/
      ModelViewer.tsx
  storage/
    db.ts
```

## Requisitos

- Node.js 18+
- npm

## Instalação

```bash
npm install
```

## Execução local

```bash
npm run dev
```

A aplicação ficará disponível em http://localhost:5173 por padrão.

## Testes

```bash
npm test
```

## Build de produção

```bash
npm run build
```

## Funcionalidades principais

### Biblioteca de modelos

- upload de múltiplos arquivos `.glb` e `.gltf`;
- validação do tipo e tamanho do arquivo;
- organização por prateleiras;
- busca por nome ou tag.

### Cena 3D

- adição de modelos à cena de exposição;
- navegação com orbit controls;
- remoção rápida de itens da cena;
- limpeza total da cena.

### Persistência local

Os dados são armazenados localmente no navegador, permitindo manter a coleção e a organização mesmo após recarregar a página.

## Observações

- O projeto foi pensado para uso local e off-line.
- A validação de arquivos aceita modelos compatíveis com GLB e glTF.
- O armazenamento é controlado pelo navegador e pode variar conforme o ambiente do usuário.

## Licença

Este projeto está disponível para uso educacional e pessoal.
