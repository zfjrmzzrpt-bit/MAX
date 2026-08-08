/* JCP - Historial compacto y recordatorios prioritarios */
(function () {
  'use strict';
  const HISTORY_PAGE_SIZE = 10;
  let historyOpen = false;
  let historyVisible = HISTORY_PAGE_SIZE;

  function dayValue(value) {
    const date = new Date(String(value).slice(0, 10) + 'T12:00:00');
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  function reminderLevel(client) {
    const reminders = client.reminders || [];
    if (!reminders.length) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const values = reminders.map(item => dayValue(item.date));
    if (values.some(value => value < today.getTime())) return 3; // vencido
    if (values.some(value => value === today.getTime())) return 2; // hoy
    return 1; // futuro
  }

  function nextReminder(client) {
    return [...(client.reminders || [])].sort((a, b) => dayValue(a.date) - dayValue(b.date))[0] || null;
  }

  function escapeText(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function decorateReminderCards(caseList, container) {
    const cards = container.querySelectorAll('.client-card');
    caseList.forEach((client, index) => {
      const card = cards[index];
      if (!card) return;
      const level = reminderLevel(client);
      if (!level) return;
      const reminder = nextReminder(client);
      const labels = {
        3: { className: 'jcp-reminder-overdue', title: 'REMINDER OVERDUE' },
        2: { className: 'jcp-reminder-today', title: 'REMINDER DUE TODAY' },
        1: { className: 'jcp-reminder-upcoming', title: 'ACTIVE REMINDER' }
      };
      const displayDate = reminder && reminder.date ? new Date(String(reminder.date).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US') : '';
      card.classList.add(labels[level].className);
      card.insertAdjacentHTML('afterbegin', `<div class="jcp-reminder-flag ${labels[level].className}">🔔 ${labels[level].title}: ${escapeText(reminder && reminder.title)}${displayDate ? ` — ${displayDate}` : ''}</div>`);
    });
  }

  function sortActive(cases) {
    return [...cases].sort((a, b) => {
      const priority = reminderLevel(b) - reminderLevel(a);
      if (priority !== 0) return priority;
      return new Date(b.letterDate || 0) - new Date(a.letterDate || 0);
    });
  }

  function renderCompactHistory(archivedCases) {
    const historyList = document.getElementById('history-list');
    const title = document.querySelector('.history-title span:first-child');
    const arrow = document.getElementById('history-arrow');
    if (title) title.textContent = `📁 View Completed & Closed Cases Log (${archivedCases.length})`;
    if (arrow) arrow.textContent = historyOpen ? '▼' : '▶';

    if (!historyOpen) {
      historyList.style.display = 'none';
      historyList.innerHTML = '';
      return;
    }

    const visible = archivedCases.slice(0, historyVisible);
    historyList.style.display = 'flex';
    historyList.innerHTML = visible.length
      ? visible.map(client => renderCard(client)).join('')
      : '<div class="empty">No completed cases for this line.</div>';
    if (archivedCases.length > historyVisible) {
      const button = document.createElement('button');
      button.className = 'load-more-btn jcp-history-more';
      button.textContent = `Load older completed cases (${archivedCases.length - historyVisible} remaining)`;
      button.addEventListener('click', window.loadMoreCompletedHistory);
      historyList.appendChild(button);
    }
  }

  function enhancedRender() {
    renderStatsAndUrgent();
    updateNotificationBanner();

    const displayFlow = currentFlow;
    const search = document.getElementById('search').value.toLowerCase();
    const filter = document.getElementById('filter').value;
    const matching = clients.filter(client => {
      const line = getDisplayFlow(client.flow);
      if (line !== displayFlow && client.flow !== displayFlow) return false;
      const matchesSearch = String(client.name || '').toLowerCase().includes(search)
        || String(client.fullName || '').toLowerCase().includes(search)
        || String(client.caseNumber || '').toLowerCase().includes(search)
        || (client.notes && client.notes.toLowerCase().includes(search));
      if (!matchesSearch) return false;
      if (filter === 'PENDING_ONLY') return isCaseOverdue(client);
      return !filter || client.status === filter;
    });

    const activeCases = sortActive(matching.filter(client => !client.archived));
    const archivedCases = matching.filter(client => client.archived)
      .sort((a, b) => new Date(b.completedAt || b.letterDate || 0) - new Date(a.completedAt || a.letterDate || 0));
    const start = currentPage * PAGE_SIZE;
    const page = activeCases.slice(start, start + PAGE_SIZE);
    if (!page.length && currentPage > 0 && activeCases.length) {
      currentPage--;
      return enhancedRender();
    }

    const activeList = document.getElementById('client-list');
    activeList.innerHTML = page.length
      ? page.map(client => renderCard(client)).join('')
      : `<div class="empty">No active cases found for ${displayFlow}.</div>`;
    decorateReminderCards(page, activeList);
    renderCompactHistory(archivedCases);
    updatePaginationInfo(activeCases.length, page.length);
    if (currentPage > 0) document.getElementById('viewport').scrollTop = 0;
  }

  window.toggleHistoryCollapse = function () {
    historyOpen = !historyOpen;
    if (historyOpen) historyVisible = HISTORY_PAGE_SIZE;
    enhancedRender();
  };

  window.loadMoreCompletedHistory = function () {
    historyVisible += HISTORY_PAGE_SIZE;
    enhancedRender();
  };

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .client-card.jcp-reminder-overdue { border: 2px solid #EF4444 !important; box-shadow: 0 0 22px rgba(239,68,68,.28); }
      .client-card.jcp-reminder-today { border: 2px solid #F59E0B !important; box-shadow: 0 0 20px rgba(245,158,11,.22); }
      .client-card.jcp-reminder-upcoming { border: 1px solid #A855F7 !important; }
      .jcp-reminder-flag { margin: -1px -1px 9px; padding: 7px 12px; border-radius: 12px 12px 7px 7px; font-size: 11px; font-weight: 800; letter-spacing: .3px; }
      .jcp-reminder-flag.jcp-reminder-overdue { background: rgba(239,68,68,.22); color: #FCA5A5; }
      .jcp-reminder-flag.jcp-reminder-today { background: rgba(245,158,11,.20); color: #FCD34D; }
      .jcp-reminder-flag.jcp-reminder-upcoming { background: rgba(168,85,247,.18); color: #D8B4FE; }
      .jcp-history-more { margin: 4px auto 0; }
    `;
    document.head.appendChild(style);
  }

  addStyles();
  window.render = enhancedRender;
})();
