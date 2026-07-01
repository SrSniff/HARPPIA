// Configuração da API
const API_URL = '/api';

// Estado global
let pacotes = [];
let tarefas = [];
let pessoas = [];
let pacoteAtualEdicao = null;
let tarefaAtualEdicao = null;
let pessoaAtualEdicao = null;

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    carregarPacotes();
    carregarPessoas();
});

// ==================== NAVEGAÇÃO ENTRE TABS ====================

function showTab(tabName) {
    // Remover active de todos os tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Adicionar active no tab selecionado
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Recarregar dados conforme o tab
    if (tabName === 'pacotes') {
        carregarPacotes();
    } else if (tabName === 'tarefas') {
        carregarTarefas();
    } else if (tabName === 'pessoas') {
        carregarPessoas();
    }
}

// ==================== MODAIS ====================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    
    // Limpar formulários
    if (modalId === 'modal-pacote') {
        document.getElementById('form-pacote').reset();
        document.getElementById('pacote-id').value = '';
        document.getElementById('modal-pacote-title').textContent = 'Novo Pacote';
        pacoteAtualEdicao = null;
    } else if (modalId === 'modal-tarefa') {
        document.getElementById('form-tarefa').reset();
        document.getElementById('tarefa-id').value = '';
        document.getElementById('modal-tarefa-title').textContent = 'Nova Tarefa';
        tarefaAtualEdicao = null;
        document.getElementById('alert-predecessoras').innerHTML = '';
        carregarSelectPacotes();
        carregarSelectPessoas();
    } else if (modalId === 'modal-pessoa') {
        document.getElementById('form-pessoa').reset();
        document.getElementById('pessoa-id').value = '';
        document.getElementById('modal-pessoa-title').textContent = 'Cadastrar Pessoa/Entidade';
        pessoaAtualEdicao = null;
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

// ==================== PACOTES ====================

async function carregarPacotes() {
    try {
        const response = await fetch(`${API_URL}/pacotes`);
        pacotes = await response.json();
        renderizarPacotes();
        atualizarSelectFiltroPacotes();
    } catch (error) {
        console.error('Erro ao carregar pacotes:', error);
    }
}

function renderizarPacotes() {
    const container = document.getElementById('pacotes-list');
    
    if (pacotes.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center;">Nenhum pacote cadastrado.</p>';
        return;
    }
    
    container.innerHTML = pacotes.map(pacote => `
        <div class="card">
            <h3>${pacote.nome}</h3>
            ${pacote.descricao ? `<p>${pacote.descricao}</p>` : ''}
            <div class="info-grid">
                ${pacote.data_inicio ? `<div class="info-item"><strong>Início:</strong> ${formatarData(pacote.data_inicio)}</div>` : ''}
                ${pacote.data_fim ? `<div class="info-item"><strong>Fim:</strong> ${formatarData(pacote.data_fim)}</div>` : ''}
            </div>
            <div class="card-actions">
                <button class="btn" onclick="editarPacote(${pacote.id})">Editar</button>
                <button class="btn btn-danger" onclick="deletarPacote(${pacote.id})">Excluir</button>
                <button class="btn btn-secondary" onclick="verTarefasDoPacote(${pacote.id})">Ver Tarefas</button>
            </div>
        </div>
    `).join('');
}

function atualizarSelectFiltroPacotes() {
    const select = document.getElementById('filtro-pacote-tarefa');
    select.innerHTML = '<option value="">Todos os Pacotes</option>' +
        pacotes.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
}

function carregarSelectPacotes() {
    const select = document.getElementById('tarefa-pacote');
    select.innerHTML = '<option value="">Selecione...</option>' +
        pacotes.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
}

async function salvarPacote(event) {
    event.preventDefault();
    
    const id = document.getElementById('pacote-id').value;
    const data = {
        nome: document.getElementById('pacote-nome').value,
        descricao: document.getElementById('pacote-descricao').value,
        dataInicio: document.getElementById('pacote-data-inicio').value,
        dataFim: document.getElementById('pacote-data-fim').value
    };
    
    try {
        if (id) {
            await fetch(`${API_URL}/pacotes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_URL}/pacotes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        closeModal('modal-pacote');
        carregarPacotes();
    } catch (error) {
        console.error('Erro ao salvar pacote:', error);
    }
}

function editarPacote(id) {
    const pacote = pacotes.find(p => p.id === id);
    if (!pacote) return;
    
    document.getElementById('pacote-id').value = pacote.id;
    document.getElementById('pacote-nome').value = pacote.nome;
    document.getElementById('pacote-descricao').value = pacote.descricao || '';
    document.getElementById('pacote-data-inicio').value = pacote.data_inicio || '';
    document.getElementById('pacote-data-fim').value = pacote.data_fim || '';
    document.getElementById('modal-pacote-title').textContent = 'Editar Pacote';
    
    openModal('modal-pacote');
}

async function deletarPacote(id) {
    if (!confirm('Tem certeza que deseja excluir este pacote? Todas as tarefas associadas serão excluídas.')) {
        return;
    }
    
    try {
        await fetch(`${API_URL}/pacotes/${id}`, { method: 'DELETE' });
        carregarPacotes();
    } catch (error) {
        console.error('Erro ao deletar pacote:', error);
    }
}

function verTarefasDoPacote(pacoteId) {
    document.getElementById('filtro-pacote-tarefa').value = pacoteId;
    showTab('tarefas');
    carregarTarefas();
}

// ==================== TAREFAS ====================

async function carregarTarefas() {
    const filtroPacote = document.getElementById('filtro-pacote-tarefa').value;
    
    try {
        if (filtroPacote) {
            const response = await fetch(`${API_URL}/pacotes/${filtroPacote}/tarefas`);
            tarefas = await response.json();
        } else {
            // Carregar todas as tarefas de todos os pacotes
            const allTarefas = [];
            for (const pacote of pacotes) {
                const response = await fetch(`${API_URL}/pacotes/${pacote.id}/tarefas`);
                const tarefasPacote = await response.json();
                allTarefas.push(...tarefasPacote);
            }
            tarefas = allTarefas;
        }
        
        renderizarTarefas();
        carregarSelectPredecessoras();
    } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
    }
}

function renderizarTarefas() {
    const container = document.getElementById('tarefas-list');
    
    if (tarefas.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center;">Nenhuma tarefa cadastrada.</p>';
        return;
    }
    
    // Agrupar tarefas por hierarquia
    const tarefasMap = new Map(tarefas.map(t => [t.id, { ...t, subtarefas: [] }]));
    const raizes = [];
    
    tarefasMap.forEach((tarefa, id) => {
        if (tarefa.parent_id) {
            const parent = tarefasMap.get(tarefa.parent_id);
            if (parent) {
                parent.subtarefas.push(tarefa);
            } else {
                raizes.push(tarefa);
            }
        } else {
            raizes.push(tarefa);
        }
    });
    
    container.innerHTML = raizes.map(t => renderizarTarefaHierarquica(t, 0)).join('');
}

function renderizarTarefaHierarquica(tarefa, nivel) {
    const indent = nivel * 20;
    const hasSubtarefas = tarefa.subtarefas && tarefa.subtarefas.length > 0;
    
    let html = `
        <div class="card" style="margin-left: ${indent}px;">
            <h3>${tarefa.nome}</h3>
            ${tarefa.descricao ? `<p>${tarefa.descricao}</p>` : ''}
            <div class="info-grid">
                ${tarefa.responsavel_nome ? `<div class="info-item"><strong>Responsável:</strong> ${tarefa.responsavel_nome}</div>` : ''}
                ${tarefa.data_inicio ? `<div class="info-item"><strong>Início:</strong> ${formatarData(tarefa.data_inicio)}</div>` : ''}
                ${tarefa.data_fim ? `<div class="info-item"><strong>Fim:</strong> ${formatarData(tarefa.data_fim)}</div>` : ''}
                ${tarefa.custo > 0 ? `<div class="info-item"><strong>Custo:</strong> R$ ${parseFloat(tarefa.custo).toFixed(2)}</div>` : ''}
                ${tarefa.tempo_horas > 0 ? `<div class="info-item"><strong>Tempo:</strong> ${tarefa.tempo_horas}h (${(tarefa.tempo_horas / 8).toFixed(1)} dias)</div>` : ''}
            </div>
            ${tarefa.observacao ? `<p style="margin-top: 10px; color: #666;"><em>${tarefa.observacao}</em></p>` : ''}
            <div class="card-actions">
                <button class="btn" onclick="editarTarefa(${tarefa.id})">Editar</button>
                <button class="btn btn-danger" onclick="deletarTarefa(${tarefa.id})">Excluir</button>
            </div>
        </div>
    `;
    
    if (hasSubtarefas) {
        html += tarefa.subtarefas.map(st => renderizarTarefaHierarquica(st, nivel + 1)).join('');
    }
    
    return html;
}

async function carregarTarefasParaParente() {
    const pacoteId = document.getElementById('tarefa-pacote').value;
    const selectParent = document.getElementById('tarefa-parent');
    
    if (!pacoteId) {
        selectParent.innerHTML = '<option value="">Nenhuma (tarefa de nível superior)</option>';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/pacotes/${pacoteId}/tarefas`);
        const tarefasPacote = await response.json();
        
        selectParent.innerHTML = '<option value="">Nenhuma (tarefa de nível superior)</option>' +
            tarefasPacote.filter(t => !t.parent_id).map(t => 
                `<option value="${t.id}">${t.nome}</option>`
            ).join('');
        
        carregarSelectPredecessoras();
    } catch (error) {
        console.error('Erro ao carregar tarefas para parente:', error);
    }
}

function carregarSelectPessoas() {
    const select = document.getElementById('tarefa-responsavel');
    select.innerHTML = '<option value="">Selecione...</option>' +
        pessoas.map(p => `<option value="${p.id}">${p.nome} (${p.tipo === 'pessoa' ? 'PF' : 'PJ'})</option>`).join('');
}

function carregarSelectPredecessoras() {
    const pacoteId = document.getElementById('tarefa-pacote').value;
    const select = document.getElementById('tarefa-predecessoras');
    
    if (!pacoteId) {
        select.innerHTML = '<option value="">Selecione um pacote primeiro</option>';
        return;
    }
    
    const tarefasDisponiveis = tarefas.filter(t => t.pacote_id == pacoteId);
    
    select.innerHTML = tarefasDisponiveis.length > 0
        ? tarefasDisponiveis.map(t => `<option value="${t.id}">${t.nome}</option>`).join('')
        : '<option value="">Nenhuma tarefa disponível neste pacote</option>';
}

async function validarPredecessoras() {
    const dataInicio = document.getElementById('tarefa-data-inicio').value;
    const select = document.getElementById('tarefa-predecessoras');
    const predecessoras = Array.from(select.selectedOptions).map(opt => parseInt(opt.value)).filter(id => id);
    const alertDiv = document.getElementById('alert-predecessoras');
    
    if (!dataInicio || predecessoras.length === 0) {
        alertDiv.innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/tarefas/validar-predecessoras`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataInicio, predecessoras })
        });
        
        const resultado = await response.json();
        
        if (resultado.valido) {
            alertDiv.innerHTML = '<div class="alert alert-success">' + resultado.mensagem + '</div>';
        } else {
            alertDiv.innerHTML = '<div class="alert alert-error">' + resultado.mensagem + '</div>';
        }
    } catch (error) {
        console.error('Erro ao validar predecessoras:', error);
    }
}

async function salvarTarefa(event) {
    event.preventDefault();
    
    const id = document.getElementById('tarefa-id').value;
    const select = document.getElementById('tarefa-predecessoras');
    const predecessoras = Array.from(select.selectedOptions).map(opt => parseInt(opt.value)).filter(id => id);
    
    const data = {
        pacoteId: parseInt(document.getElementById('tarefa-pacote').value),
        parentId: document.getElementById('tarefa-parent').value ? parseInt(document.getElementById('tarefa-parent').value) : null,
        nome: document.getElementById('tarefa-nome').value,
        descricao: document.getElementById('tarefa-descricao').value,
        responsavelId: document.getElementById('tarefa-responsavel').value ? parseInt(document.getElementById('tarefa-responsavel').value) : null,
        dataInicio: document.getElementById('tarefa-data-inicio').value,
        dataFim: document.getElementById('tarefa-data-fim').value,
        custo: parseFloat(document.getElementById('tarefa-custo').value) || 0,
        tempoHoras: parseFloat(document.getElementById('tarefa-tempo').value) || 0,
        observacao: document.getElementById('tarefa-observacao').value,
        predecessoras: predecessoras
    };
    
    try {
        if (id) {
            await fetch(`${API_URL}/tarefas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_URL}/tarefas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        closeModal('modal-tarefa');
        carregarTarefas();
    } catch (error) {
        console.error('Erro ao salvar tarefa:', error);
        alert(error.message);
    }
}

function editarTarefa(id) {
    const tarefa = tarefas.find(t => t.id === id);
    if (!tarefa) return;
    
    document.getElementById('tarefa-id').value = tarefa.id;
    document.getElementById('tarefa-pacote').value = tarefa.pacote_id;
    document.getElementById('tarefa-parent').value = tarefa.parent_id || '';
    document.getElementById('tarefa-nome').value = tarefa.nome;
    document.getElementById('tarefa-descricao').value = tarefa.descricao || '';
    document.getElementById('tarefa-responsavel').value = tarefa.responsavel_id || '';
    document.getElementById('tarefa-data-inicio').value = tarefa.data_inicio || '';
    document.getElementById('tarefa-data-fim').value = tarefa.data_fim || '';
    document.getElementById('tarefa-custo').value = tarefa.custo || 0;
    document.getElementById('tarefa-tempo').value = tarefa.tempo_horas || 0;
    document.getElementById('tarefa-observacao').value = tarefa.observacao || '';
    document.getElementById('modal-tarefa-title').textContent = 'Editar Tarefa';
    
    carregarTarefasParaParente();
    carregarSelectPessoas();
    
    // Carregar predecessoras selecionadas
    setTimeout(() => {
        const select = document.getElementById('tarefa-predecessoras');
        if (tarefa.predecessoras && tarefa.predecessoras.length > 0) {
            Array.from(select.options).forEach(opt => {
                if (tarefa.predecessoras.some(p => p.id == opt.value)) {
                    opt.selected = true;
                }
            });
        }
    }, 500);
    
    openModal('modal-tarefa');
}

async function deletarTarefa(id) {
    if (!confirm('Tem certeza que deseja excluir esta tarefa? As subtarefas também serão excluídas.')) {
        return;
    }
    
    try {
        await fetch(`${API_URL}/tarefas/${id}`, { method: 'DELETE' });
        carregarTarefas();
    } catch (error) {
        console.error('Erro ao deletar tarefa:', error);
    }
}

// ==================== PESSOAS/ENTIDADES ====================

async function carregarPessoas() {
    try {
        const response = await fetch(`${API_URL}/pessoas`);
        pessoas = await response.json();
        renderizarPessoas();
    } catch (error) {
        console.error('Erro ao carregar pessoas:', error);
    }
}

function renderizarPessoas() {
    const container = document.getElementById('pessoas-list');
    
    if (pessoas.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center;">Nenhuma pessoa/entidade cadastrada.</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Tipo</th>
                        <th>Email</th>
                        <th>Telefone</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${pessoas.map(p => `
                        <tr>
                            <td>${p.nome}</td>
                            <td><span class="badge badge-${p.tipo}">${p.tipo === 'pessoa' ? 'Pessoa Física' : 'Entidade'}</span></td>
                            <td>${p.email || '-'}</td>
                            <td>${p.telefone || '-'}</td>
                            <td>
                                <button class="btn" onclick="editarPessoa(${p.id})" style="padding: 5px 10px; font-size: 0.9em;">Editar</button>
                                <button class="btn btn-danger" onclick="deletarPessoa(${p.id})" style="padding: 5px 10px; font-size: 0.9em;">Excluir</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function salvarPessoa(event) {
    event.preventDefault();
    
    const id = document.getElementById('pessoa-id').value;
    const data = {
        nome: document.getElementById('pessoa-nome').value,
        tipo: document.getElementById('pessoa-tipo').value,
        email: document.getElementById('pessoa-email').value,
        telefone: document.getElementById('pessoa-telefone').value
    };
    
    try {
        if (id) {
            await fetch(`${API_URL}/pessoas/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch(`${API_URL}/pessoas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        closeModal('modal-pessoa');
        carregarPessoas();
    } catch (error) {
        console.error('Erro ao salvar pessoa:', error);
    }
}

function editarPessoa(id) {
    const pessoa = pessoas.find(p => p.id === id);
    if (!pessoa) return;
    
    document.getElementById('pessoa-id').value = pessoa.id;
    document.getElementById('pessoa-nome').value = pessoa.nome;
    document.getElementById('pessoa-tipo').value = pessoa.tipo;
    document.getElementById('pessoa-email').value = pessoa.email || '';
    document.getElementById('pessoa-telefone').value = pessoa.telefone || '';
    document.getElementById('modal-pessoa-title').textContent = 'Editar Pessoa/Entidade';
    
    openModal('modal-pessoa');
}

async function deletarPessoa(id) {
    if (!confirm('Tem certeza que deseja excluir este registro?')) {
        return;
    }
    
    try {
        await fetch(`${API_URL}/pessoas/${id}`, { method: 'DELETE' });
        carregarPessoas();
    } catch (error) {
        console.error('Erro ao deletar pessoa:', error);
    }
}

// ==================== UTILITÁRIOS ====================

function formatarData(dataStr) {
    if (!dataStr) return '';
    const data = new Date(dataStr);
    return data.toLocaleDateString('pt-BR');
}
