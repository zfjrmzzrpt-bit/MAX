/* JCP - Módulo de reportes Excel
   Se carga después del script principal de index.html. No modifica Firestore. */
(function () {
  'use strict';

  const REPORT_FIELDS = [
    { id: 'caseNumber', label: 'Número de caso', checked: true },
    { id: 'fullName', label: 'Nombre completo', checked: true },
    { id: 'line', label: 'Línea', checked: true },
    { id: 'status', label: 'Estado actual', checked: true },
    { id: 'baseLetterDate', label: 'Fecha de carta base', checked: true },
    { id: 'nextLetter', label: 'Próxima carta', checked: true },
    { id: 'nextLetterDate', label: 'Fecha próxima carta', checked: true },
    { id: 'notes', label: 'Notas internas', checked: false }
  ];

  function allClients() {
    // `clients` pertenece al script principal de JCP.
    return typeof clients !== 'undefined' && Array.isArray(clients) ? clients : [];
  }

  function splitName(value) {
    // Los casos nuevos guardan estos campos separados; los anteriores siguen siendo compatibles.
    if (value && typeof value === 'object') {
      return {
        caseNumber: String(value.caseNumber || '').trim(),
        fullName: String(value.fullName || value.name || '').trim()
      };
    }
    const text = String(value || '').trim();
    const match = text.match(/^(\d+)\s+(.+)$/);
    return {
      caseNumber: match ? match[1] : '',
      fullName: match ? match[2] : text
    };
  }

  function displayLine(client) {
    return typeof getDisplayFlow === 'function' ? getDisplayFlow(client.flow) : (client.flow || '');
  }

  function asDate(value) {
    if (!value) return '';
    const date = new Date(String(value).slice(0, 10) + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US');
  }

  // Busca una carta pendiente, no un follow-up pendiente.
  function nextLetter(client) {
    if (typeof getMilestones !== 'function' || !client.letterDate) return null;
    const done = client.done || {};
    const uploaded = client.cl_uploaded_milestones || {};
    const milestones = getMilestones(client.letterDate, client.flow, client)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return milestones.find(item => !done[item.key] || !uploaded[item.key]) || null;
  }

  function isExcluded(client) {
    const status = String(client.status || '').trim().toLowerCase();
    return client.archived === true || status === 'completed and closed';
  }

  function reportRows() {
    const line = document.getElementById('jcp-report-line').value;
    return allClients()
      .filter(client => !isExcluded(client))
      .filter(client => line === 'All' || displayLine(client) === line)
      .map(client => {
        const name = (client.caseNumber || client.fullName) ? splitName(client) : splitName(client.name);
        const next = nextLetter(client);
        return {
          caseNumber: name.caseNumber || client.id || '',
          fullName: name.fullName,
          line: displayLine(client),
          status: client.status || 'Active',
          baseLetterDate: asDate(client.letterDate),
          nextLetter: next ? next.label : 'Todas las cartas completadas',
          nextLetterDate: next ? asDate(next.date) : '',
          notes: client.notes || ''
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  function selectedFields() {
    return REPORT_FIELDS.filter(field => document.getElementById('jcp-field-' + field.id).checked);
  }

  function fieldCheckboxes() {
    return REPORT_FIELDS.map(field => `
      <label class="jcp-report-field">
        <input type="checkbox" id="jcp-field-${field.id}" ${field.checked ? 'checked' : ''}>
        <span>${field.label}</span>
      </label>`).join('');
  }

  function renderPreview() {
    const fields = selectedFields();
    const rows = reportRows();
    const preview = document.getElementById('jcp-report-preview');
    const count = document.getElementById('jcp-report-count');

    if (!fields.length) {
      preview.innerHTML = '<p class="jcp-report-message">Selecciona al menos una columna.</p>';
      count.textContent = '';
      return;
    }
    count.textContent = `${rows.length} caso${rows.length === 1 ? '' : 's'} incluido${rows.length === 1 ? '' : 's'}`;
    if (!rows.length) {
      preview.innerHTML = '<p class="jcp-report-message">No hay casos activos para esta línea.</p>';
      return;
    }
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const visibleRows = rows.slice(0, 10);
    preview.innerHTML = `
      <div class="jcp-report-table-wrap">
        <table class="jcp-report-table">
          <thead><tr>${fields.map(field => `<th>${escape(field.label)}</th>`).join('')}</tr></thead>
          <tbody>${visibleRows.map(row => `<tr>${fields.map(field => `<td>${escape(row[field.id])}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
      ${rows.length > 10 ? '<p class="jcp-report-message">Vista previa: primeros 10 casos. El Excel incluirá todos.</p>' : ''}`;
  }

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar la herramienta de Excel. Revisa tu conexión a internet.'));
      document.head.appendChild(script);
    });
  }

  async function exportExcel() {
    const fields = selectedFields();
    const rows = reportRows();
    if (!fields.length) return alert('Selecciona al menos una columna.');
    if (!rows.length) return alert('No hay casos activos para exportar con este filtro.');

    const button = document.getElementById('jcp-report-export');
    button.disabled = true;
    button.textContent = 'Preparando Excel…';
    try {
      await loadXlsx();
      const exportRows = rows.map(row => Object.fromEntries(fields.map(field => [field.label, row[field.id]])));
      const sheet = XLSX.utils.json_to_sheet(exportRows);
      sheet['!cols'] = fields.map(field => ({ wch: Math.max(field.label.length + 2, ...exportRows.map(row => String(row[field.label] || '').length + 2), 14) }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Casos activos');
      const selectedLine = document.getElementById('jcp-report-line').value.replace(/\s+/g, '-');
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(book, `JCP-reporte-${selectedLine}-${date}.xlsx`);
      if (typeof showToast === 'function') showToast('Reporte Excel descargado', 'success');
    } catch (error) {
      console.error(error);
      alert(error.message || 'No se pudo crear el archivo Excel.');
    } finally {
      button.disabled = false;
      button.textContent = 'Descargar Excel';
    }
  }

  function injectInterface() {
    const menuExport = document.querySelector('.menu-item[onclick="exportData()"]');
    if (menuExport && !document.getElementById('jcp-report-menu')) {
      const menu = document.createElement('div');
      menu.id = 'jcp-report-menu';
      menu.className = 'menu-item';
      menu.textContent = '📊 Generate Excel Report';
      menu.addEventListener('click', () => window.openExcelReport());
      menuExport.insertAdjacentElement('afterend', menu);
    }

    const overlay = document.createElement('div');
    overlay.id = 'jcp-report-modal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal jcp-report-modal-content">
        <h2>📊 Reporte de casos en Excel</h2>
        <p class="jcp-report-help">Incluye únicamente casos activos. Los casos de “Completed & Closed” se excluyen automáticamente.</p>
        <div class="form-group">
          <label>Filtrar por línea</label>
          <select id="jcp-report-line">
            <option value="All">Todas las líneas</option>
            <option value="Line A">Line A</option>
            <option value="Line B">Line B</option>
            <option value="Line C">Line C</option>
            <option value="Line D">Line D</option>
          </select>
        </div>
        <div class="form-group">
          <label>Columnas para incluir</label>
          <div class="jcp-report-fields">${fieldCheckboxes()}</div>
        </div>
        <div class="jcp-report-preview-header"><strong>Vista previa</strong><span id="jcp-report-count"></span></div>
        <div id="jcp-report-preview"></div>
        <div class="modal-footer jcp-report-actions">
          <button class="btn" id="jcp-report-cancel">Cancelar</button>
          <button class="btn" id="jcp-report-refresh">Actualizar vista previa</button>
          <button class="btn btn-primary" id="jcp-report-export">Descargar Excel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('jcp-report-cancel').addEventListener('click', () => overlay.classList.remove('open'));
    document.getElementById('jcp-report-refresh').addEventListener('click', renderPreview);
    document.getElementById('jcp-report-export').addEventListener('click', exportExcel);
    document.getElementById('jcp-report-line').addEventListener('change', renderPreview);
    overlay.addEventListener('click', event => { if (event.target === overlay) overlay.classList.remove('open'); });

    const style = document.createElement('style');
    style.textContent = `
      .jcp-report-modal-content { width: min(920px, 94vw); max-height: 88vh; overflow: auto; }
      .jcp-report-help, .jcp-report-message { color: var(--text-muted); font-size: 12px; margin: .45rem 0 1rem; }
      .jcp-report-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
      .jcp-report-field { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); font-size: 12px; cursor: pointer; }
      .jcp-report-field input { accent-color: var(--accent); }
      .jcp-report-preview-header { display: flex; justify-content: space-between; align-items: center; margin: 1rem 0 .5rem; color: var(--text); font-size: 12px; }
      #jcp-report-count { color: var(--text-muted); font-weight: 500; }
      .jcp-report-table-wrap { overflow: auto; max-height: 240px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
      .jcp-report-table { border-collapse: collapse; width: 100%; font-size: 11px; }
      .jcp-report-table th { position: sticky; top: 0; background: var(--surface-light); color: var(--text); text-align: left; }
      .jcp-report-table th, .jcp-report-table td { padding: 8px; border-bottom: 1px solid var(--border); white-space: nowrap; }
      .jcp-report-table td { color: var(--text-muted); }
      .jcp-report-actions { margin-top: 1rem; }
      @media (max-width: 600px) { .jcp-report-fields { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);
  }

  window.openExcelReport = function () {
    const modal = document.getElementById('jcp-report-modal');
    if (!modal) return;
    const currentLine = typeof currentFlow !== 'undefined' ? currentFlow : 'All';
    document.getElementById('jcp-report-line').value = currentLine;
    modal.classList.add('open');
    renderPreview();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectInterface);
  else injectInterface();
})();
