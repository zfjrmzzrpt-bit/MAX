/* JCP - Guardado individual de casos
   Cargar después del script principal. Guarda solo el documento modificado. */
(function () {
  'use strict';
  const noteTimers = new Map();

  function prepareCaseForm() {
    const combinedInput = document.getElementById('f-name');
    if (!combinedInput || document.getElementById('f-case-number')) return;
    const group = combinedInput.closest('.form-group');
    if (!group) return;
    group.outerHTML = `
      <div class="form-group">
        <label>Número de caso *</label>
        <input type="text" id="f-case-number" placeholder="Ej.: 7874">
      </div>
      <div class="form-group">
        <label>Nombre completo *</label>
        <input type="text" id="f-name" placeholder="Ej.: Evangelina Lara">
      </div>`;
  }

  async function saveOne(client, options) {
    const config = Object.assign({ render: true, successMessage: 'Datos guardados' }, options);
    if (!client || !client.id) throw new Error('No se encontró el caso que se debe guardar.');
    if (!client.done) client.done = {};
    if (!client.cl_uploaded_milestones) client.cl_uploaded_milestones = {};
    if (!client.reminders) client.reminders = [];
    saveLocal(clients);
    showSaving();
    try {
      await db.collection('clients').doc(client.id).set(client);
      if (config.render) render();
      if (config.successMessage && typeof showToast === 'function') showToast(config.successMessage, 'success');
    } catch (error) {
      console.error('Error guardando el caso:', error);
      alert('No se pudo guardar este caso en la nube. Revisa tu conexión e inténtalo de nuevo.');
      throw error;
    }
  }

  // Reemplaza las acciones de la pantalla para que cada una guarde un solo documento.
  window.setCaseCompletionStatus = async function (id, state) {
    const c = clients.find(x => x.id === id);
    if (!c) return;
    c.archived = state;
    if (state) {
      c.status = 'Send Case Closure';
      c.completedAt = new Date().toISOString();
    } else {
      delete c.completedAt;
    }
    await saveOne(c);
    resetPagination();
  };

  window.toggleDone = async function (clientId, key) {
    const c = clients.find(x => x.id === clientId);
    if (!c) return;
    c.done = c.done || {};
    c.done[key] = !c.done[key];
    applyAutoStatus(c);
    await saveOne(c);
  };

  window.toggleUploaded = async function (clientId, key) {
    const c = clients.find(x => x.id === clientId);
    if (!c) return;
    c.cl_uploaded_milestones = c.cl_uploaded_milestones || {};
    c.cl_uploaded_milestones[key] = !c.cl_uploaded_milestones[key];
    applyAutoStatus(c);
    await saveOne(c);
  };

  window.toggleQuick = async function (id, field, value) {
    const c = clients.find(x => x.id === id);
    if (!c) return;
    c[field] = value;
    await saveOne(c);
  };

  window.updateNotes = function (id, value) {
    const c = clients.find(x => x.id === id);
    if (!c) return;
    c.notes = value;
    saveLocal(clients);
    clearTimeout(noteTimers.get(id));
    noteTimers.set(id, setTimeout(() => {
      saveOne(c, { render: false, successMessage: '' }).catch(() => {});
    }, 600));
  };

  window.updateStatus = async function (id, value) {
    const c = clients.find(x => x.id === id);
    if (!c) return;
    c.status = value;
    await saveOne(c);
    resetPagination();
  };

  window.updateMilestoneDate = async function (id, key, value) {
    const c = clients.find(x => x.id === id);
    if (!c) return;
    c.customDates = c.customDates || {};
    c.customDates[key] = value === null || value === undefined ? '' : String(value);
    await saveOne(c);
  };

  window.deleteClient = async function (id) {
    const c = clients.find(x => x.id === id);
    if (!c || !confirm(`¿Estás seguro de eliminar permanentemente el caso "${c.name}"?`)) return;
    showSaving();
    try {
      await db.collection('clients').doc(id).delete();
      clients = clients.filter(x => x.id !== id);
      saveLocal(clients);
      resetPagination();
      render();
      if (typeof showToast === 'function') showToast('Caso eliminado correctamente', 'success');
    } catch (error) {
      console.error('Error eliminando el caso:', error);
      alert('No se pudo eliminar el caso en la nube.');
    }
  };

  window.saveReminder = async function () {
    const title = document.getElementById('r-title').value.trim();
    const description = document.getElementById('r-description').value.trim();
    const date = document.getElementById('r-date').value;
    const displayLine = document.getElementById('r-line').value;
    if (!title || !date) return alert('Please fill in Title and Date.');
    const c = clients.find(x => x.id === currentReminderClientId);
    if (!c) return;
    c.reminders = c.reminders || [];
    c.reminders.push({ id: 'rem_' + Date.now(), title, description, date, line: getInternalFlow(displayLine), created: new Date().toISOString() });
    await saveOne(c);
    closeReminder();
  };

  window.deleteReminder = async function (clientId, reminderId) {
    const c = clients.find(x => x.id === clientId);
    if (!c || !confirm('Delete this reminder?')) return;
    c.reminders = (c.reminders || []).filter(r => r.id !== reminderId);
    await saveOne(c);
  };

  window.addClient = async function () {
    const name = document.getElementById('f-name').value.trim();
    const caseNumber = document.getElementById('f-case-number').value.trim();
    const displayFlow = document.getElementById('f-flow').value;
    const date = document.getElementById('f-date').value;
    const status = document.getElementById('f-status').value;
    const notes = document.getElementById('f-notes').value.trim();
    if (!caseNumber || !name || !date) return alert('Please fill in Case Number, Full Name and Date.');
    const client = {
      id: 'custom_' + Date.now(), flow: getInternalFlow(displayFlow),
      caseNumber, fullName: name, name: `${caseNumber} ${name}`,
      letterDate: date, status, notes,
      confirmed: false, uploaded_camp_legal: false, done: {}, cl_uploaded_milestones: {}, archived: false, reminders: []
    };
    clients.push(client);
    await saveOne(client);
    closeAdd();
    resetPagination();
    document.getElementById('f-case-number').value = '';
    document.getElementById('f-name').value = '';
    document.getElementById('f-notes').value = '';
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepareCaseForm);
  else prepareCaseForm();
})();
