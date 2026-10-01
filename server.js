const express = require('express');
const cors = require('cors');
const path = require('path');
const DatabaseManager = require('./database');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar banco de dados
const db = new DatabaseManager('./data/harppia_project.db');
db.initialize();

// ==================== API DE PESSOAS/ENTIDADES ====================

// Listar todas as pessoas/entidades
app.get('/api/pessoas', (req, res) => {
    try {
        const pessoas = db.getAllPessoas();
        res.json(pessoas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar pessoa/entidade
app.post('/api/pessoas', (req, res) => {
    try {
        const { nome, tipo, email, telefone } = req.body;
        const id = db.createPessoa({ nome, tipo, email, telefone });
        res.json({ id, nome, tipo, email, telefone });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar pessoa/entidade
app.put('/api/pessoas/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { nome, tipo, email, telefone } = req.body;
        db.updatePessoa(id, { nome, tipo, email, telefone });
        res.json({ id, nome, tipo, email, telefone });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deletar pessoa/entidade
app.delete('/api/pessoas/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.deletePessoa(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== API DE PACOTES ====================

// Listar todos os pacotes
app.get('/api/pacotes', (req, res) => {
    try {
        const pacotes = db.getAllPacotes();
        res.json(pacotes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter pacote com tarefas
app.get('/api/pacotes/:id', (req, res) => {
    try {
        const { id } = req.params;
        const pacote = db.getPacoteWithTarefas(id);
        res.json(pacote);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar pacote
app.post('/api/pacotes', (req, res) => {
    try {
        const { nome, descricao, dataInicio, dataFim } = req.body;
        const id = db.createPacote({ nome, descricao, dataInicio, dataFim });
        res.json({ id, nome, descricao, dataInicio, dataFim });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar pacote
app.put('/api/pacotes/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, dataInicio, dataFim } = req.body;
        db.updatePacote(id, { nome, descricao, dataInicio, dataFim });
        res.json({ id, nome, descricao, dataInicio, dataFim });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deletar pacote
app.delete('/api/pacotes/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.deletePacote(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== API DE TAREFAS ====================

// Listar tarefas de um pacote
app.get('/api/pacotes/:pacoteId/tarefas', (req, res) => {
    try {
        const { pacoteId } = req.params;
        const tarefas = db.getTarefasByPacote(pacoteId);
        res.json(tarefas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obter tarefa completa
app.get('/api/tarefas/:id', (req, res) => {
    try {
        const { id } = req.params;
        const tarefa = db.getTarefaWithDetails(id);
        res.json(tarefa);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Criar tarefa
app.post('/api/tarefas', (req, res) => {
    try {
        const { 
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
        } = req.body;
        
        const id = db.createTarefa({
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
        });
        
        res.json({ id, pacoteId, parentId, nome, descricao, responsavelId, dataInicio, dataFim, custo, tempoHoras, observacao });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Atualizar tarefa
app.put('/api/tarefas/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { 
            nome, 
            descricao, 
            responsavelId, 
            dataInicio, 
            dataFim, 
            custo, 
            tempoHoras, 
            observacao,
            predecessoras 
        } = req.body;
        
        db.updateTarefa(id, {
            nome,
            descricao,
            responsavelId,
            dataInicio,
            dataFim,
            custo,
            tempoHoras,
            observacao,
            predecessoras
        });
        
        res.json({ id, nome, descricao, responsavelId, dataInicio, dataFim, custo, tempoHoras, observacao });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deletar tarefa
app.delete('/api/tarefas/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.deleteTarefa(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validar predecessoras (verificar se dataInicio respeita dataFim das predecessoras)
app.post('/api/tarefas/validar-predecessoras', (req, res) => {
    try {
        const { tarefaId, dataInicio, predecessoras } = req.body;
        const validacao = db.validarPredecessoras(tarefaId, dataInicio, predecessoras);
        res.json(validacao);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== INICIAR SERVIDOR ====================

app.listen(PORT, () => {
    console.log(`Harppia Project rodando em http://localhost:${PORT}`);
    console.log(`Banco de dados: ./data/harppia_project.db`);
});
