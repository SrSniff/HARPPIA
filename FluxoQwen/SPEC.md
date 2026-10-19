# SPEC.md — Sistema de Controle de Gastos

> Documento de especificação v1.1 — base para geração de código por IA (Kimi Code CLI ou similar).
> Toda tarefa de implementação deve ler este arquivo antes de codificar.

---

## 1. Visão Geral

Sistema web para controle financeiro pessoal e de pequenas empresas, baseado em lançamentos de crédito e débito, com transferências entre contas, parcelamento, controle de quitados/pendentes, permissões por grupo de usuários e auditoria de operações críticas.

**Idioma/moeda:** Somente português (Brasil) / Real (R$).
**Licenças:** Somente ferramentas, bibliotecas e componentes gratuitos/open source. Nada pago.

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express, JavaScript (ESM) |
| Banco | PostgreSQL (Docker Desktop local) |
| Migrations/Query | knex |
| Auth | JWT (bcrypt para senha) |
| Validação | zod |
| Frontend | React + Vite, JavaScript |
| Grid | @tanstack/react-table |
| HTTP client | axios |
| Rotas | react-router-dom |

Estrutura: monorepo com `backend/` e `frontend/`.

---

## 3. Decisões de Arquitetura (v1.1)

1. **Não é multi-tenant nem multi-empresa.** Todos os usuários veem todos os lançamentos. Uma instalação = uma empresa.
2. **Não há saldo parcial por linha** no grid. Apenas totais no rodapé (economia de processamento).
3. **Transferência gera duas linhas independentes** (débito na origem, crédito no destino), vinculadas por `transferencia_id`. O assistente de transferência é apenas uma forma rápida de criar as duas.
4. **Exclusão é FÍSICA.** O registro some do banco. Porém o log de auditoria (tabela separada com snapshot JSONB) **preserva o histórico** mesmo após a exclusão.
5. **API REST** (não GraphQL).
6. **Parcelamento:** assistente cria N lançamentos independentes, vinculados por `parcelamento_id`, com vencimentos mensais.

---

## 4. Modelo de Dados (PostgreSQL)

```sql
CREATE TABLE grupos (
  id            SERIAL PRIMARY KEY,
  descricao     VARCHAR(100) NOT NULL,
  ler           BOOLEAN DEFAULT TRUE,   -- visualizar fluxo/relatórios
  incluir       BOOLEAN DEFAULT TRUE,   -- incluir registros
  alterar       BOOLEAN DEFAULT TRUE,   -- alterar registros
  excluir       BOOLEAN DEFAULT FALSE,  -- excluir registros
  administrador BOOLEAN DEFAULT FALSE,  -- gerenciar grupos e usuários
  data_ultima_alteracao TIMESTAMPTZ DEFAULT now(),
  user_alteracao INT
);

CREATE TABLE usuarios (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  hash_senha  VARCHAR(255) NOT NULL,
  grupo_id    INT REFERENCES grupos(id),
  data_ultima_alteracao_senha TIMESTAMPTZ,
  data_ultima_alteracao TIMESTAMPTZ DEFAULT now(),
  ativo       BOOLEAN DEFAULT TRUE
);

CREATE TABLE contas (
  id            SERIAL PRIMARY KEY,
  descricao     VARCHAR(100) NOT NULL,  -- banco, carteira, cartão, espécie
  banco         VARCHAR(50),
  agencia       VARCHAR(20),
  conta_corrente VARCHAR(20)
);

CREATE TABLE centros_custo (
  id          SERIAL PRIMARY KEY,
  codigo      VARCHAR(20) UNIQUE NOT NULL,  -- hierarquia: "1.", "1.1", "1.1.1", "2."
  codigo_pai  VARCHAR(20) DEFAULT '0',      -- '0' = nó raiz
  descricao   VARCHAR(100) NOT NULL
);

CREATE TABLE tipos_pagamento (
  tipo VARCHAR(30) PRIMARY KEY   -- Dinheiro, TED, PIX, Cartão, Boleto
);

CREATE TABLE areas (
  id        SERIAL PRIMARY KEY,
  descricao VARCHAR(100) NOT NULL
);

CREATE TABLE lancamentos (
  id              SERIAL PRIMARY KEY,
  data_conta      DATE NOT NULL,            -- data origem (compra/venda)
  data_vencimento DATE NOT NULL,
  data_previsao   DATE,                     -- default = data_vencimento
  data_pagamento  DATE,                     -- NULL = não quitado
  descricao       VARCHAR(255) NOT NULL,
  credito         NUMERIC(15,2) DEFAULT 0,  -- se débito, = 0
  debito          NUMERIC(15,2) DEFAULT 0,  -- se crédito, = 0
  centro_custo_id INT REFERENCES centros_custo(id),
  area_id         INT REFERENCES areas(id),
  conta_id        INT REFERENCES contas(id),
  tipo_pg         VARCHAR(30) REFERENCES tipos_pagamento(tipo),
  observacao      TEXT,
  transferencia_id  UUID,                   -- liga os 2 lançamentos de uma transferência
  parcelamento_id   UUID,                   -- liga as parcelas de um parcelamento
  numero_parcela    INT,
  total_parcelas    INT,
  data_ultima_alteracao TIMESTAMPTZ DEFAULT now(),
  user_alteracao  INT REFERENCES usuarios(id)
);

CREATE TABLE log_auditoria (
  id           SERIAL PRIMARY KEY,
  tabela       VARCHAR(50) NOT NULL,
  registro_id  INT NOT NULL,
  acao         VARCHAR(20) NOT NULL,  -- EXCLUSAO | QUITACAO | ALTERACAO_VALOR
  valor_antes  JSONB,
  valor_depois JSONB,
  usuario_id   INT REFERENCES usuarios(id),
  data_hora    TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Regras de Negócio

### 5.1 Lançamento simples
- Preenche `credito` **ou** `debito`, nunca ambos (validação XOR: um > 0, o outro = 0).
- `data_previsao` assume `data_vencimento` quando não informada.

### 5.2 Quitado vs. Pendente
- Quitado ⇔ `data_pagamento IS NOT NULL`.
- Filtro "quitado/pendente" sempre usa esse campo.

### 5.3 Rodapé — totais
- `saldo = Σ créditos − Σ débitos`, calculados **com os MESMOS filtros aplicados ao grid**.
- Endpoint de listagem deve retornar `{ dados, total_credito, total_debito, saldo }` usando a mesma query de filtro.

### 5.4 Transferência (assistente)
- Cria **dois** lançamentos com o mesmo `transferencia_id`, mesma data e mesmo valor absoluto:
  - Débito na conta origem; Crédito na conta destino.
- Excluir um lado da transferência **exclui o outro** (com confirmação explícita ao usuário).
- Loga a operação.

### 5.5 Parcelamento (assistente)
- Tela idêntica à inclusão de lançamento, com campos extras: `total_parcelas` (int > 1) e `dia_vencimento` (int 1–31).
- Gera N lançamentos independentes com mesmo valor, descrição, conta, centro de custo, área, tipo de pagamento.
- Todas vinculadas por `parcelamento_id`, com `numero_parcela` (1..N) e `total_parcelas`.
- Vencimentos mensais: 1ª parcela no mês/ano de `data_conta` (no dia escolhido); demais +1 mês cada, sempre no dia indicado.
- Excluir uma parcela **não** exclui as demais.

### 5.6 RBAC por grupo
| Permissão | Efeito |
|---|---|
| `ler` | Visualiza grid/relatórios (sempre TRUE por padrão) |
| `incluir` | Cria lançamentos |
| `alterar` | Edita lançamentos |
| `excluir` | Exclui (padrão FALSE) |
| `administrador` | Único que gerencia grupos e usuários |

- Backend: middleware `requirePermissao(acao)` retorna 403 se negado.
- Frontend: botões/ocultações conforme permissão; menu "Grupos/Usuários" só para administrador.

### 5.7 Log de auditoria (obrigatório)
Gerar registro em `log_auditoria` sempre que houver:
- **EXCLUSAO** — guarda `valor_antes` (snapshot completo do registro)
- **QUITACAO** — preencher ou limpar `data_pagamento`; guarda antes/depois
- **ALTERACAO_VALOR** — alteração em `credito` ou `debito`; guarda antes/depois

Cada registro: tabela, registro_id, acao, valor_antes, valor_depois, usuario_id, data_hora.

### 5.8 Exclusão
- Física (DELETE). Snapshot vai para o log antes da exclusão.

---

## 6. Tela Principal (Grid de Lançamentos)

### 6.1 Colunas
Data Conta | Descrição | Conta | Centro de Custo | Área | Tipo Pg | Vencimento | Previsão | Pagamento | Crédito | Débito

### 6.2 Cores e formatação
- Créditos: **azul**; Débitos: **vermelho**
- Saldo no rodapé: positivo **verde**, negativo **vermelho**
- Moeda formatada: `R$ 1.234,56`
- Paleta geral:
  - Fundo app: `#f2f4f6` (cinza claro) / conteúdo: branco
  - Menu lateral: `#2e3436` (cinza escuro), itens brancos, ativo `#1a5fb4` (azul)
  - Botões primários: `#1a5fb4`
  - Textos: `#1a1a1a` (quase preto) / cinzas secundários
  - Erros/alertas: vermelho; sucesso: verde
- Tom sóbrio: tons de cinza, branco, azul, preto; realces pontuais em verde/vermelho.

### 6.3 Rodapé fixo
**Σ Créditos | Σ Débitos | Saldo** — sempre calculado conforme filtros ativos.

### 6.4 Filtros
- Período de vencimento (de/até)
- Situação: Quitado | Pendente | Ambos
- Tipo: Crédito | Débito | Ambos
- Conta
- Área

### 6.5 Ações
- Novo lançamento | Nova transferência (assistente) | Novo parcelamento (assistente)
- Editar, Excluir (com confirmação), Quitar/Estornar quitação (preencher/limpar `data_pagamento`)
- Ações ocultadas conforme permissões do grupo.

---

## 7. API REST — Contratos Principais

### Autenticação
- `POST /auth/login` — `{email, senha}` → `{token, usuario, permissoes}`
- `GET /auth/me` → dados do usuário logado + permissões

### Cadastros base (CRUD completo: GET, GET/:id, POST, PUT/:id, DELETE/:id)
- `/contas`, `/centros-custo`, `/areas`, `/tipos-pagamento`
- `/grupos`, `/usuarios` — **somente administrador**
  - Senha com bcrypt no POST; PUT só altera senha se enviada (atualiza `data_ultima_alteracao_senha`)
  - `centros-custo`: validar formato hierárquico (`1.`, `1.1`, `1.1.1`) e existência do `codigo_pai`

### Lançamentos
- `GET /lancamentos?data_vencimento_de=&data_vencimento_ate=&quitado=true|false&tipo=credito|debito&conta_id=&area_id=` → `{ dados, total_credito, total_debito, saldo }`
- `POST /lancamentos` — valida XOR crédito/débito
- `PUT /lancamentos/:id`
- `DELETE /lancamentos/:id` — loga snapshot antes; se `transferencia_id`, excluir par
- `POST /lancamentos/transferencia` — `{conta_origem_id, conta_destino_id, valor, data, descricao, ...}` → cria o par vinculado
- `POST /lancamentos/parcelamento` — `{total_parcelas, dia_vencimento, valor, data_conta, descricao, ...}` → cria N lançamentos vinculados
- `POST /lancamentos/:id/quitar` e `POST /lancamentos/:id/estornar` — altera `data_pagamento`, loga QUITACAO

### Erros
Formato único: `{ "erro": "mensagem amigável em português" }`

---

## 8. Fases de Desenvolvimento

| Fase | Escopo |
|---|---|
| **F1** | Setup, banco, auth, cadastros base (backend + frontend) |
| **F2** | Lançamentos: grid, filtros, rodapé, assistentes de transferência e parcelamento |
| **F3** | Auditoria: log gerado e tela de consulta |
| **F4** | Gráficos e relatórios |
| **F5** | Polimento: validações, testes, tratamento de erros, deploy |

> Execução: um prompt por sessão, na ordem. Validar manualmente entre fases. Commit Git ao final de cada fase validada.

---

## 9. Seed Inicial (F1-A)

- Grupo "Administrador": todas as permissões TRUE.
- Usuário `admin`, email `admin@local`, senha `admin123` (bcrypt).
- Tipos de pagamento: Dinheiro, TED, PIX, Cartão, Boleto.
- Contas de exemplo: Carteira, Banco Bradesco, Cartão Nubank.
- Áreas de exemplo: Pessoal, Operacional, Vendas.
- Centro de custo raiz: `1.` — "Geral" (pai `'0'`).
