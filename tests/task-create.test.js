import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveTaskCreateContext, resolveTaskModalDefaults } from '../public/assets/task-create.js';

test('calendar route defaults new-task date to selected calendar day', () => {
  assert.deepEqual(
    resolveTaskModalDefaults({}, { name: 'calendar' }, '2026-06-10'),
    {
      title: '',
      dueDate: '2026-06-10',
      reminderAt: '',
      projectId: '',
      sectionId: '',
      tagId: '',
      priority: 'none',
      urgent: false,
      tags: []
    }
  );
});

test('non-calendar route falls back to provided default dueDate', () => {
  const defaults = resolveTaskModalDefaults({}, { name: 'today' }, '2026-06-10', '2026-06-09');
  assert.equal(defaults.dueDate, '2026-06-09');
});

test('explicit payload dueDate wins over selected calendar day', () => {
  const defaults = resolveTaskModalDefaults({ dueDate: '2026-06-12', projectId: 'proj_1' }, { name: 'calendar' }, '2026-06-10');
  assert.equal(defaults.dueDate, '2026-06-12');
  assert.equal(defaults.projectId, 'proj_1');
});

test('preserveTaskCreateContext clears only title and keeps scheduling context', () => {
  assert.deepEqual(
    preserveTaskCreateContext({
      title: 'to clear',
      dueDate: '2026-06-10',
      reminderAt: '2026-06-10T10:00:00.000Z',
      projectId: 'proj_1',
      sectionId: 'sec_1',
      tagId: 'tag_1',
      priority: 'high',
      urgent: true,
      tags: ['tag_1', 'tag_2']
    }),
    {
      title: '',
      dueDate: '2026-06-10',
      reminderAt: '2026-06-10T10:00:00.000Z',
      projectId: 'proj_1',
      sectionId: 'sec_1',
      tagId: 'tag_1',
      priority: 'high',
      urgent: true,
      tags: ['tag_1', 'tag_2']
    }
  );
});
