(function () {
  const drawer = document.querySelector('[data-drawer]');
  const toast = document.querySelector('[data-toast]');
  const newModal = document.querySelector('[data-new-modal]');
  const commandModal = document.querySelector('[data-command-modal]');
  const drawerTitle = document.querySelector('[data-drawer-title]');
  const drawerProject = document.querySelector('[data-drawer-project]');
  const drawerDate = document.querySelector('[data-drawer-date]');
  const drawerPriority = document.querySelector('[data-drawer-priority]');
  const drawerTags = document.querySelector('[data-drawer-tags]');
  const saveState = document.querySelector('[data-save-state]');

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(window.todoToastTimer);
    window.todoToastTimer = setTimeout(() => toast.classList.remove('show'), 1700);
  }

  function openDrawer(row) {
    if (!drawer || !row) return;
    document.querySelectorAll('.task-row').forEach(item => item.classList.remove('selected'));
    row.classList.add('selected');
    if (drawerTitle) drawerTitle.value = row.dataset.taskTitle || row.querySelector('.task-title')?.textContent || '新任务';
    if (drawerProject) drawerProject.textContent = row.dataset.project || '收件箱';
    if (drawerDate) drawerDate.textContent = row.dataset.date || '无日期';
    if (drawerPriority) drawerPriority.textContent = row.dataset.priority || '普通';
    if (drawerTags) drawerTags.textContent = row.dataset.tags || '未加标签';
    drawer.classList.add('open');
    showToast('已打开任务详情');
  }

  function closeDrawer() {
    drawer?.classList.remove('open');
  }

  function openModal(layer) {
    if (!layer) return;
    layer.classList.add('open');
    layer.setAttribute('aria-hidden', 'false');
    const input = layer.querySelector('input, textarea');
    if (input) setTimeout(() => input.focus(), 60);
  }

  function closeModal(layer) {
    if (!layer) return;
    layer.classList.remove('open');
    layer.setAttribute('aria-hidden', 'true');
  }

  document.querySelectorAll('[data-task-row]').forEach(row => {
    row.addEventListener('click', event => {
      if (event.target.closest('[data-toggle-done], [data-row-action], .bulk-check')) return;
      if (document.body.classList.contains('bulk-mode')) {
        row.classList.toggle('marked');
        showToast(row.classList.contains('marked') ? '已选中任务' : '已取消选择');
        return;
      }
      openDrawer(row);
    });
  });

  document.querySelectorAll('[data-toggle-done]').forEach(check => {
    check.addEventListener('click', event => {
      event.stopPropagation();
      const row = check.closest('.task-row');
      row?.classList.toggle('done');
      showToast(row?.classList.contains('done') ? '任务已完成' : '任务已恢复');
    });
  });

  document.querySelectorAll('[data-toggle-bulk]').forEach(button => {
    button.addEventListener('click', () => {
      document.body.classList.toggle('bulk-mode');
      document.querySelectorAll('[data-bulk-bar]').forEach(bar => bar.classList.toggle('open'));
      showToast(document.body.classList.contains('bulk-mode') ? '已进入批量整理' : '已退出批量整理');
    });
  });

  document.querySelectorAll('[data-row-action]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      showToast(button.dataset.message || button.textContent.trim() || '已更新');
    });
  });

  document.querySelectorAll('[data-open-new]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      closeModal(commandModal);
      openModal(newModal);
    });
  });
  document.querySelectorAll('[data-open-command]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      openModal(commandModal);
    });
  });
  document.querySelectorAll('[data-close-modal]').forEach(button => {
    button.addEventListener('click', () => closeModal(button.closest('.modal-layer')));
  });
  document.querySelectorAll('[data-close-drawer]').forEach(button => {
    button.addEventListener('click', closeDrawer);
  });
  document.querySelectorAll('.modal-layer').forEach(layer => {
    layer.addEventListener('click', event => {
      if (event.target === layer) closeModal(layer);
    });
  });

  document.querySelectorAll('[data-quick-form]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const input = form.querySelector('input[name="quickTask"]');
      const title = input?.value.trim();
      if (!title) {
        showToast('先输入任务标题');
        return;
      }
      const list = document.querySelector(form.dataset.target || '[data-append-list]');
      if (list) {
        const row = document.createElement('button');
        row.className = 'task-row';
        row.type = 'button';
        row.dataset.taskRow = 'true';
        row.dataset.taskTitle = title;
        row.dataset.project = form.dataset.project || '收件箱';
        row.dataset.date = form.dataset.date || '今天';
        row.innerHTML = '<span class="bulk-check">✓</span><span class="check" data-toggle-done>✓</span><span><span class="task-title"></span><span class="task-meta"><span class="mini-tag"></span><span class="mini-tag">刚刚创建</span></span></span><span class="task-actions"><span class="priority"></span><span class="tiny-action" data-row-action data-message="已打开日期选择">日期</span></span>';
        row.querySelector('.task-title').textContent = title;
        row.querySelector('.mini-tag').textContent = row.dataset.project;
        row.addEventListener('click', e => {
          if (e.target.closest('[data-toggle-done], [data-row-action], .bulk-check')) return;
          openDrawer(row);
        });
        row.querySelector('[data-toggle-done]').addEventListener('click', e => {
          e.stopPropagation();
          row.classList.toggle('done');
          showToast(row.classList.contains('done') ? '任务已完成' : '任务已恢复');
        });
        list.prepend(row);
      }
      input.value = '';
      showToast('任务已添加');
    });
  });

  document.querySelectorAll('[data-create-form]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      closeModal(form.closest('.modal-layer'));
      showToast('任务已创建，并应用当前页面上下文');
    });
  });

  document.querySelectorAll('[data-calendar-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const view = button.dataset.calendarToggle;
      document.querySelectorAll('[data-calendar-toggle]').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('[data-calendar-view]').forEach(panel => {
        panel.hidden = panel.dataset.calendarView !== view;
      });
      showToast(view === 'week' ? '已切换到周视图' : '已切换到月视图');
    });
  });

  document.querySelectorAll('[data-settings-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const panel = button.dataset.settingsTab;
      document.querySelectorAll('[data-settings-tab]').forEach(item => item.classList.toggle('active', item === button));
      document.querySelectorAll('[data-settings-panel]').forEach(item => {
        item.hidden = item.dataset.settingsPanel !== panel;
      });
    });
  });

  document.querySelectorAll('.switch').forEach(button => {
    button.addEventListener('click', () => {
      button.classList.toggle('on');
      showToast(button.classList.contains('on') ? '已开启' : '已关闭');
    });
  });

  document.querySelectorAll('[data-confirm-action]').forEach(button => {
    button.addEventListener('click', () => {
      showToast(button.dataset.confirmAction || '已确认');
    });
  });

  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openModal(commandModal);
    }
    if (event.key === 'Escape') {
      closeModal(newModal);
      closeModal(commandModal);
      closeDrawer();
    }
  });

  [drawerTitle, document.querySelector('[data-note-area]')].forEach(input => {
    if (!input) return;
    input.addEventListener('input', () => {
      if (saveState) saveState.textContent = '保存中...';
      clearTimeout(window.todoSaveTimer);
      window.todoSaveTimer = setTimeout(() => {
        if (saveState) saveState.textContent = '已保存 · 刚刚';
      }, 550);
    });
  });
})();
