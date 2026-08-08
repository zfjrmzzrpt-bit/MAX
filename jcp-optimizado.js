// ============================================================
// JCP - OPTIMIZADO (jcp-optimizado.js)
// TODAS las funciones unificadas y optimizadas
// ============================================================

(function() {
    'use strict';

    // ============================================================
    // 1. CACHÉ DE CÁLCULOS (evita recalcular en cada render)
    // ============================================================
    
    function getCachedFollowUps(client) {
        if (!client._followUpsCache || 
            client._followUpsCache._letterDate !== client.letterDate || 
            client._followUpsCache._flow !== client.flow) {
            client._followUpsCache = {
                _letterDate: client.letterDate,
                _flow: client.flow,
                data: getFollowUps(client.letterDate, client.flow)
            };
        }
        return client._followUpsCache.data;
    }

    function getCachedMilestones(client) {
        if (!client._milestonesCache || 
            client._milestonesCache._letterDate !== client.letterDate || 
            client._milestonesCache._flow !== client.flow) {
            client._milestonesCache = {
                _letterDate: client.letterDate,
                _flow: client.flow,
                data: getMilestones(client.letterDate, client.flow, client)
            };
        }
        return client._milestonesCache.data;
    }

    function getCachedNextPending(client) {
        const cacheKey = `${client.letterDate}_${client.flow}_${JSON.stringify(client.done)}_${JSON.stringify(client.cl_uploaded_milestones)}`;
        if (client._nextPendingCache && client._nextPendingCache._key === cacheKey) {
            return client._nextPendingCache.data;
        }
        const result = nextPending(client);
        client._nextPendingCache = { _key: cacheKey, data: result };
        return result;
    }

    // ============================================================
    // 2. ACTUALIZACIÓN ESPECÍFICA DE UNA TARJETA
    // ============================================================
    
    function updateSingleCard(clientId) {
        const card = document.querySelector(`.client-card[data-client-id="${clientId}"]`);
        if (!card) return;
        
        const c = clients.find(x => x.id === clientId);
        if (!c) return;
        
        // Actualizar barra de progreso
        const followUps = getCachedFollowUps(c);
        const milestones = getCachedMilestones(c);
        const done = c.done || {};
        const cl_uploads = c.cl_uploaded_milestones || {};
        const totalTasks = followUps.length + (milestones.length * 2);
        const completed = followUps.filter(x => done[x.key]).length +
                         milestones.filter(x => done[x.key]).length +
                         milestones.filter(x => cl_uploads[x.key]).length;
        const pct = Math.round((completed / totalTasks) * 100);
        
        const progressFill = card.querySelector('.progress-fill');
        if (progressFill) progressFill.style.width = `${pct}%`;
        
        // Actualizar contador "Action Points Checked"
        const detailFields = card.querySelectorAll('.detail-field');
        detailFields.forEach(field => {
            const label = field.querySelector('label');
            if (label && label.textContent === 'Action Points Checked') {
                const span = field.querySelector('span');
                if (span) span.textContent = `${completed}/${totalTasks} Actions Met`;
            }
        });
        
        // Actualizar el badge de estado
        const statusPill = card.querySelector('.status-pill');
        if (statusPill) {
            statusPill.className = `status-pill ${statusClass(c.status)}`;
            statusPill.textContent = statusLabel(c.status);
        }
        
        // Actualizar el contador de "Overdue" en el sidebar si es necesario
        renderStatsAndUrgent();
    }

    // ============================================================
    // 3. RENDER OPTIMIZADO (sin recargar todo)
    // ============================================================
    
    const originalRender = window.render || function() {};
    
    window.render = function() {
        renderStatsAndUrgent();
        updateNotificationBanner();

        const displayFlow = currentFlow;
        const searchVal = document.getElementById('search').value.toLowerCase();
        const filterVal = document.getElementById('filter').value;

        // Filtrar casos
        const sortedClients = [...clients].sort((a, b) => new Date(b.letterDate) - new Date(a.letterDate));
        filteredClients = sortedClients.filter(c => {
            const cDisplay = getDisplayFlow(c.flow);
            const matchFlow = (cDisplay === displayFlow) || (c.flow === displayFlow);
            if (!matchFlow) return false;
            const matchesSearch = c.name.toLowerCase().includes(searchVal) || 
                                 (c.notes && c.notes.toLowerCase().includes(searchVal));
            if (filterVal === 'PENDING_ONLY') return matchesSearch && isCaseOverdue(c);
            if (filterVal) return matchesSearch && c.status === filterVal;
            return matchesSearch;
        });

        const activeCases = filteredClients.filter(c => !c.archived);
        const archivedCases = filteredClients.filter(c => c.archived);

        // Paginación de activos
        const start = currentPage * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const paginatedActive = activeCases.slice(start, end);

        if (paginatedActive.length === 0 && currentPage > 0 && activeCases.length > 0) {
            currentPage--;
            return render();
        }

        // Renderizar SOLO los activos
        const activeHTML = paginatedActive.length === 0
            ? `<div class="empty">No active cases found for ${displayFlow}.</div>`
            : paginatedActive.map(c => renderCard(c)).join('');
        document.getElementById('client-list').innerHTML = activeHTML;
        updatePaginationInfo(activeCases.length, paginatedActive.length);

        // ============================================================
        // HISTORIAL: SOLO SE RENDERIZA SI ESTÁ EXPANDIDO
        // ============================================================
        const historyList = document.getElementById('history-list');
        const historyArrow = document.getElementById('history-arrow');
        
        if (historyExpanded) {
            historyArrow.textContent = '▼';
            // SOLO AQUÍ se genera el HTML del historial
            const historyHTML = archivedCases.length === 0
                ? `<div class="empty">No completed cases for ${displayFlow}.</div>`
                : archivedCases.map(c => renderCard(c)).join('');
            historyList.innerHTML = historyHTML;
            historyList.style.display = 'flex';
        } else {
            historyArrow.textContent = '▶';
            historyList.style.display = 'none';
            // LIBERAR MEMORIA eliminando el HTML oculto
            historyList.innerHTML = '';
        }

        if (currentPage > 0) document.getElementById('viewport').scrollTop = 0;
    };

    // ============================================================
    // 4. SOBREESCRIBIR TOGGLES PARA ACTUALIZACIÓN ESPECÍFICA
    // ============================================================
    
    // Guardar referencia a las funciones originales
    const originalToggleDone = window.toggleDone;
    const originalToggleMilestoneUpload = window.toggleMilestoneUpload;
    const originalToggleQuick = window.toggleQuick;
    const originalUpdateStatus = window.updateStatus;
    const originalUpdateMilestoneDate = window.updateMilestoneDate;
    
    // Toggle Done con actualización específica
    window.toggleDone = async function(clientId, key) {
        const c = clients.find(x => x.id === clientId);
        if (!c) return;
        c.done = c.done || {};
        c.done[key] = !c.done[key];
        applyAutoStatus(c);
        await saveOne(c);
        
        // Actualizar SOLO la tarjeta afectada
        updateSingleCard(clientId);
        
        // Actualizar el chip específico
        const chip = document.querySelector(`.chip[onclick*="toggleDone('${clientId}','${key}')"]`);
        if (chip) {
            const isDone = c.done[key];
            chip.textContent = isDone ? '✓' : '○';
            chip.className = `chip ${isDone ? 'done' : ''}`;
        }
    };
    
    // Toggle Milestone Upload con actualización específica
    window.toggleMilestoneUpload = async function(clientId, key) {
        const c = clients.find(x => x.id === clientId);
        if (!c) return;
        c.cl_uploaded_milestones = c.cl_uploaded_milestones || {};
        c.cl_uploaded_milestones[key] = !c.cl_uploaded_milestones[key];
        applyAutoStatus(c);
        await saveOne(c);
        updateSingleCard(clientId);
    };
    
    // Toggle Quick con actualización específica
    window.toggleQuick = async function(id, field, value) {
        const c = clients.find(x => x.id === id);
        if (!c) return;
        c[field] = value;
        await saveOne(c);
        updateSingleCard(id);
    };
    
    // Update Status con actualización específica
    window.updateStatus = async function(id, value) {
        const c = clients.find(x => x.id === id);
        if (!c) return;
        c.status = value;
        await saveOne(c);
        updateSingleCard(id);
        resetPagination();
    };
    
    // Update Milestone Date con actualización específica
    window.updateMilestoneDate = async function(id, key, value) {
        const c = clients.find(x => x.id === id);
        if (!c) return;
        c.customDates = c.customDates || {};
        c.customDates[key] = value === null || value === undefined ? '' : String(value);
        // Invalidar caché de milestones
        c._milestonesCache = null;
        await saveOne(c);
        updateSingleCard(id);
    };

    // ============================================================
    // 5. REEMPLAZAR FUNCIONES QUE USABAN CÁLCULOS SIN CACHÉ
    // ============================================================
    
    // Reemplazar nextPending en el scope global
    const originalNextPending = window.nextPending;
    window.nextPending = function(client) {
        return getCachedNextPending(client);
    };
    
    // Reemplazar isCaseOverdue para usar caché
    const originalIsCaseOverdue = window.isCaseOverdue;
    window.isCaseOverdue = function(c) {
        const np = getCachedNextPending(c);
        return np ? new Date(np.date).setHours(0,0,0,0) < TODAY.getTime() : false;
    };

    // ============================================================
    // 6. MODIFICAR renderCard PARA INCLUIR data-client-id
    // ============================================================
    
    // Guardar la función original
    const originalRenderCard = window.renderCard;
    
    // Sobrescribir para agregar data-client-id
    window.renderCard = function(c) {
        // Llamar a la función original que está en el HTML principal
        const html = originalRenderCard(c);
        // Reemplazar la primera ocurrencia de 'client-card' con 'client-card' + data-client-id
        return html.replace(
            '<div class="client-card"',
            `<div class="client-card" data-client-id="${c.id}"`
        );
    };

    // ============================================================
    // 7. LIMPIAR FUNCIONES OBSOLETAS DE LOS ARCHIVOS EXTERNOS
    // ============================================================
    
    // Desactivar la función de organización de casos que sobreescribía render
    if (window.enhancedRender) {
        window.enhancedRender = null;
    }
    
    // Desactivar la función loadMoreCompletedHistory si existe
    if (window.loadMoreCompletedHistory) {
        window.loadMoreCompletedHistory = null;
    }
    
    // Desactivar toggleHistoryCollapse si existe (usamos la del HTML principal)
    if (window.toggleHistoryCollapse && !window._historyCollapseOriginal) {
        window._historyCollapseOriginal = window.toggleHistoryCollapse;
        window.toggleHistoryCollapse = function() {
            historyExpanded = !historyExpanded;
            document.getElementById('history-arrow').innerText = historyExpanded ? '▼' : '▶';
            // Usar nuestro render optimizado
            window.render();
        };
    }

    console.log('✅ JCP Optimizado activado correctamente');
    console.log('🚀 Rendimiento mejorado: renderizado condicional + caché de cálculos');

})();
