const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    initialize() {
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        
        // Criar tabelas
        this.createTables();
    }

    createTables() {
        // Tabela de Pessoas/Entidades
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS pessoas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                tipo TEXT CHECK(tipo IN ('pessoa', 'entidade')) NOT NULL,
                email TEXT,
                telefone TEXT,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de Pacotes de Entrega
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS pacotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                descricao TEXT,
                data_inicio DATE,
                data_fim DATE,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de Tarefas (suporta hierarquia infinita)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tarefas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pacote_id INTEGER NOT NULL,
                parent_id INTEGER,
                nome TEXT NOT NULL,
                descricao TEXT,
                responsavel_id INTEGER,
                data_inicio DATE,
                data_fim DATE,
                custo DECIMAL(10, 2) DEFAULT 0,
                tempo_horas DECIMAL(10, 2) DEFAULT 0,
                observacao TEXT,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pacote_id) REFERENCES pacotes(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES tarefas(id) ON DELETE SET NULL,
                FOREIGN KEY (responsavel_id) REFERENCES pessoas(id) ON DELETE SET NULL
            )
        `);

        // Tabela de Predecessoras (relacionamento N:N entre tarefas)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tarefa_predecessoras (
                tarefa_id INTEGER NOT NULL,
                predecessora_id INTEGER NOT NULL,
                PRIMARY KEY (tarefa_id, predecessora_id),
                FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE,
                FOREIGN KEY (predecessora_id) REFERENCES tarefas(id) ON DELETE CASCADE
            )
        `);

        // Índices para melhor performance
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_tarefas_pacote ON tarefas(pacote_id);
            CREATE INDEX IF NOT EXISTS idx_tarefas_parent ON tarefas(parent_id);
            CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel ON tarefas(responsavel_id);
        `);
    }

    // ==================== PESSOAS ====================

    getAllPessoas() {
        return this.db.prepare('SELECT * FROM pessoas ORDER BY nome').all();
    }

    getPessoaById(id) {
        return this.db.prepare('SELECT * FROM pessoas WHERE id = ?').get(id);
    }

    createPessoa({ nome, tipo, email, telefone }) {
        const stmt = this.db.prepare(`
            INSERT INTO pessoas (nome, tipo, email, telefone)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(nome, tipo, email || null, telefone || null);
        return result.lastInsertRowid;
    }

    updatePessoa(id, { nome, tipo, email, telefone }) {
        const stmt = this.db.prepare(`
            UPDATE pessoas 
            SET nome = ?, tipo = ?, email = ?, telefone = ?, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(nome, tipo, email || null, telefone || null, id);
    }

    deletePessoa(id) {
        this.db.prepare('DELETE FROM pessoas WHERE id = ?').run(id);
    }

    // ==================== PACOTES ====================

    getAllPacotes() {
        return this.db.prepare('SELECT * FROM pacotes ORDER BY nome').all();
    }

    getPacoteById(id) {
        return this.db.prepare('SELECT * FROM pacotes WHERE id = ?').get(id);
    }

    getPacoteWithTarefas(id) {
        const pacote = this.getPacoteById(id);
        if (!pacote) return null;

        const tarefas = this.getTarefasByPacote(id);
        return { ...pacote, tarefas };
    }

    createPacote({ nome, descricao, dataInicio, dataFim }) {
        const stmt = this.db.prepare(`
            INSERT INTO pacotes (nome, descricao, data_inicio, data_fim)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(nome, descricao || null, dataInicio || null, dataFim || null);
        return result.lastInsertRowid;
    }

    updatePacote(id, { nome, descricao, dataInicio, dataFim }) {
        const stmt = this.db.prepare(`
            UPDATE pacotes 
            SET nome = ?, descricao = ?, data_inicio = ?, data_fim = ?, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        stmt.run(nome, descricao || null, dataInicio || null, dataFim || null, id);
    }

    deletePacote(id) {
        this.db.prepare('DELETE FROM pacotes WHERE id = ?').run(id);
    }

    // ==================== TAREFAS ====================

    getTarefasByPacote(pacoteId) {
        return this.db.prepare(`
            SELECT t.*, p.nome as responsavel_nome
            FROM tarefas t
            LEFT JOIN pessoas p ON t.responsavel_id = p.id
            WHERE t.pacote_id = ?
            ORDER BY t.parent_id, t.nome
        `).all(pacoteId);
    }

    getTarefaById(id) {
        return this.db.prepare('SELECT * FROM tarefas WHERE id = ?').get(id);
    }

    getTarefaWithDetails(id) {
        const tarefa = this.getTarefaById(id);
        if (!tarefa) return null;

        // Obter responsável
        if (tarefa.responsavel_id) {
            const responsavel = this.getPessoaById(tarefa.responsavel_id);
            tarefa.responsavel = responsavel;
        }

        // Obter predecessoras
        const predecessoras = this.db.prepare(`
            SELECT t.* FROM tarefas t
            INNER JOIN tarefa_predecessoras tp ON t.id = tp.predecessora_id
            WHERE tp.tarefa_id = ?
        `).all(id);
        tarefa.predecessoras = predecessoras;

        // Obter subtarefas
        const subtarefas = this.db.prepare('SELECT * FROM tarefas WHERE parent_id = ?').all(id);
        tarefa.subtarefas = subtarefas;

        return tarefa;
    }

    createTarefa({ 
        pacoteId, 
        parentId, 
        nome, 
        descricao, 
        responsavelId, 
        dataInicio, 
        dataFim, 
        custo, 
        tempoHoras, 
        observacao,
        predecessoras 
    }) {
        // Validar predecessoras se existirem
        if (predecessoras && predecessoras.length > 0 && dataInicio) {
            this.validarPredecessorasInternal(null, dataInicio, predecessoras);
        }

        const stmt = this.db.prepare(`
            INSERT INTO tarefas (pacote_id, parent_id, nome, descricao, responsavel_id, data_inicio, data_fim, custo, tempo_horas, observacao)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            pacoteId,
            parentId || null,
            nome,
            descricao || null,
            responsavelId || null,
            dataInicio || null,
            dataFim || null,
            custo || 0,
            tempoHoras || 0,
            observacao || null
        );

        const tarefaId = result.lastInsertRowid;

        // Inserir predecessoras
        if (predecessoras && predecessoras.length > 0) {
            const insertPred = this.db.prepare(`
                INSERT OR IGNORE INTO tarefa_predecessoras (tarefa_id, predecessora_id)
                VALUES (?, ?)
            `);
            for (const predId of predecessoras) {
                insertPred.run(tarefaId, predId);
            }
        }

        return tarefaId;
    }

    updateTarefa(id, { 
        nome, 
        descricao, 
        responsavelId, 
        dataInicio, 
        dataFim, 
        custo, 
        tempoHoras, 
        observacao,
        predecessoras 
    }) {
        // Validar predecessoras se existirem e dataInicio foi fornecida
        if (predecessoras && predecessoras.length > 0 && dataInicio) {
            this.validarPredecessorasInternal(id, dataInicio, predecessoras);
        }

        const stmt = this.db.prepare(`
            UPDATE tarefas 
            SET nome = ?, descricao = ?, responsavel_id = ?, data_inicio = ?, data_fim = ?, 
                custo = ?, tempo_horas = ?, observacao = ?, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        
        stmt.run(
            nome,
            descricao || null,
            responsavelId || null,
            dataInicio || null,
            dataFim || null,
            custo !== undefined ? custo : 0,
            tempoHoras !== undefined ? tempoHoras : 0,
            observacao || null,
            id
        );

        // Atualizar predecessoras
        if (predecessoras !== undefined) {
            // Remover todas as predecessoras existentes
            this.db.prepare('DELETE FROM tarefa_predecessoras WHERE tarefa_id = ?').run(id);
            
            // Inserir novas predecessoras
            if (predecessoras && predecessoras.length > 0) {
                const insertPred = this.db.prepare(`
                    INSERT INTO tarefa_predecessoras (tarefa_id, predecessora_id)
                    VALUES (?, ?)
                `);
                for (const predId of predecessoras) {
                    insertPred.run(id, predId);
                }
            }
        }
    }

    deleteTarefa(id) {
        this.db.prepare('DELETE FROM tarefas WHERE id = ?').run(id);
    }

    // ==================== VALIDAÇÃO DE PREDECESSORAS ====================

    validarPredecessoras(tarefaId, dataInicio, predecessoras) {
        try {
            this.validarPredecessorasInternal(tarefaId, dataInicio, predecessoras);
            return { valido: true, mensagem: 'Data de início válida' };
        } catch (error) {
            return { valido: false, mensagem: error.message };
        }
    }

    validarPredecessorasInternal(tarefaId, dataInicio, predecessoras) {
        if (!dataInicio || !predecessoras || predecessoras.length === 0) {
            return;
        }

        const dataInicioDate = new Date(dataInicio);

        // Obter data de fim mais recente entre todas as predecessoras
        const stmt = this.db.prepare(`
            SELECT MAX(data_fim) as data_fim_maxima
            FROM tarefas
            WHERE id IN (${predecessoras.map(() => '?').join(',')})
        `);
        
        const row = stmt.get(...predecessoras);
        
        if (row.data_fim_maxima) {
            const dataFimMaxima = new Date(row.data_fim_maxima);
            
            // Calcular diferença em horas (considerando fuso horário)
            const diffMs = dataInicioDate - dataFimMaxima;
            const diffHoras = diffMs / (1000 * 60 * 60);
            
            // A tarefa não pode iniciar antes da data fim da predecessora
            if (diffHoras < 0) {
                throw new Error(
                    `A data de início (${dataInicio}) deve ser posterior à data de fim da(s) predecessora(s) (${row.data_fim_maxima}). ` +
                    `Cada 8 horas representam 1 dia útil.`
                );
            }
        }
    }

    // ==================== UTILITÁRIOS ====================

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseManager;
