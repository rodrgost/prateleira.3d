# Railway Infrastructure as Code (IaC)

Este projeto utiliza o novo padrão **Infrastructure as Code (IaC)** da Railway via TypeScript ([`.railway/railway.ts`](file:///c:/Users/rodrg/DEV/prateleira.3d/.railway/railway.ts)).

> [!NOTE]
> O formato antigo (`railway.json` / `railway.toml`) foi descontinuado (deprecated) pela Railway em favor do IaC centralizado no diretório `.railway/`.

## Comandos Principais

1. **Instalar dependência do SDK da Railway**:
   ```bash
   npm install railway
   ```

2. **Autenticar e vincular ao projeto**:
   ```bash
   railway login
   railway link
   ```

3. **Visualizar plano de alteração (Dry-run)**:
   ```bash
   railway config plan
   ```

4. **Aplicar as configurações**:
   ```bash
   railway config apply
   ```
