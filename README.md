# Harppia Project

Sistema de Gestão de Projetos e Pacotes de Entrega desenvolvido em Node.js com banco de dados SQLite.

## Funcionalidades

- **Gestão de Pacotes de Entrega**: Crie e gerencie pacotes de entrega de projetos
- **Gestão de Tarefas e Subtarefas**: Hierarquia infinita de tarefas com suporte a subtarefas
- **Cadastro de Pessoas e Entidades**: Responsáveis pelas tarefas (pessoas físicas ou jurídicas)
- **Predecessoras de Tarefas**: Defina dependências entre tarefas com validação de datas
- **Controle de Tempo e Custo**: Cada tarefa possui custo e tempo em horas (8h = 1 dia útil)
- **Validação de Datas**: Impede que uma tarefa inicie antes da data de fim de suas predecessoras

## Estrutura do Projeto

```
harppia-project/
├── server.js           # Servidor backend Express
├── database.js         # Gerenciador do banco de dados SQLite
├── package.json        # Dependências do projeto
├── public/
│   ├── index.html      # Interface frontend
│   └── app.js          # Lógica frontend JavaScript
└── data/
    └── harppia_project.db  # Banco de dados SQLite
```

## Instalação

1. Instale as dependências:
```bash
npm install
```

2. Inicie o servidor:
```bash
npm start
```

3. Acesse no navegador:
```
http://localhost:3000
```

## Uso da API

### Pessoas/Entidades
- `GET /api/pessoas` - Listar todas as pessoas/entidades
- `POST /api/pessoas` - Criar nova pessoa/entidade
- `PUT /api/pessoas/:id` - Atualizar pessoa/entidade
- `DELETE /api/pessoas/:id` - Excluir pessoa/entidade

### Pacotes
- `GET /api/pacotes` - Listar todos os pacotes
- `GET /api/pacotes/:id` - Obter pacote com tarefas
- `POST /api/pacotes` - Criar novo pacote
- `PUT /api/pacotes/:id` - Atualizar pacote
- `DELETE /api/pacotes/:id` - Excluir pacote

### Tarefas
- `GET /api/pacotes/:pacoteId/tarefas` - Listar tarefas de um pacote
- `GET /api/tarefas/:id` - Obter tarefa com detalhes
- `POST /api/tarefas` - Criar nova tarefa
- `PUT /api/tarefas/:id` - Atualizar tarefa
- `DELETE /api/tarefas/:id` - Excluir tarefa
- `POST /api/tarefas/validar-predecessoras` - Validar data de início com predecessoras

## Modelo de Dados

### Pessoa/Entidade
- `id`: Identificador único
- `nome`: Nome ou razão social
- `tipo`: "pessoa" ou "entidade"
- `email`: Email de contato
- `telefone`: Telefone de contato

### Pacote
- `id`: Identificador único
- `nome`: Nome do pacote
- `descricao`: Descrição detalhada
- `data_inicio`: Data de início do pacote
- `data_fim`: Data de término do pacote

### Tarefa
- `id`: Identificador único
- `pacote_id`: Referência ao pacote
- `parent_id`: Referência à tarefa pai (para subtarefas)
- `nome`: Nome da tarefa
- `descricao`: Descrição detalhada
- `responsavel_id`: Referência ao responsável
- `data_inicio`: Data de início
- `data_fim`: Data de término
- `custo`: Custo da tarefa em reais
- `tempo_horas`: Tempo estimado em horas (8h = 1 dia)
- `observacao`: Observações adicionais
- `predecessoras`: Lista de IDs de tarefas predecessoras

## Regras de Negócio

1. **Hierarquia de Tarefas**: Tarefas podem ter subtarefas em níveis infinitos através do campo `parent_id`
2. **Predecessoras**: Uma tarefa pode ter múltiplas tarefas predecessoras
3. **Validação de Data**: A data de início de uma tarefa não pode ser anterior à data de fim de qualquer uma de suas predecessoras
4. **Conversão de Tempo**: Cada 8 horas de trabalho representam 1 dia útil
5. **Integridade Referencial**: Ao excluir um pacote, todas as suas tarefas são excluídas em cascata

## Tecnologias Utilizadas

- **Backend**: Node.js com Express.js
- **Banco de Dados**: SQLite (better-sqlite3)
- **Frontend**: HTML5, CSS3, JavaScript puro
- **API**: RESTful JSON

## Licença

ISC
