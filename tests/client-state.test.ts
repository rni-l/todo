import test from 'node:test';
import assert from 'node:assert/strict';
import { appReducer, createInitialState, parseHashRoute, resolvedCreateDefaults, routeToHash } from '../src/client/state/appState.ts';
import { buildReportSummary } from '../src/client/lib/reports.ts';
import { appendSubtasks } from '../src/client/lib/subtasks.ts';
import { buildTaskRangeSegments, getTaskDateStatus } from '../src/client/lib/dates.ts';

test('parseHashRoute preserves known hash routes and falls unknown routes back to today', () => {
  assert.deepEqual(parseHashRoute('#/project/proj_1'), { name: 'project', id: 'proj_1' });
  assert.deepEqual(parseHashRoute('#/calendar'), { name: 'calendar', id: null });
  assert.deepEqual(parseHashRoute('#/missing'), { name: 'today', id: null });
  assert.equal(routeToHash('reports'), '#/reports');
});

test('appReducer opens create panel with selected calendar date defaults', () => {
  const initial = createInitialState('#/calendar');
  const state = appReducer(initial, {
    type: 'OPEN_CREATE',
    defaults: {},
    selectedDate: '2026-06-18'
  });

  assert.equal(state.rightPanelMode, 'create');
  assert.equal(state.selectedCalendarDate, '2026-06-18');
  assert.equal(resolvedCreateDefaults(state).dueDate, '2026-06-18');
});

test('typed task utilities keep legacy date, report, and subtask behavior', () => {
  assert.deepEqual(
    getTaskDateStatus({ dueDate: '2026-06-16' }, '2026-06-17'),
    { key: 'overdue', tone: 'danger', dueDate: '2026-06-16', startDate: '2026-06-16', endDate: '2026-06-16' }
  );

  const segments = buildTaskRangeSegments([
    { id: 'range', startDate: '2026-06-16', dueDate: '2026-06-20' }
  ], ['2026-06-17', '2026-06-18', '2026-06-19']);
  assert.equal(segments[0].continuesBefore, true);
  assert.equal(segments[0].continuesAfter, true);
  assert.equal(segments[0].span, 3);

  const appended = appendSubtasks([], 'A\nB');
  assert.deepEqual(appended.titles, ['A', 'B']);
  assert.equal(appended.subtasks[1].order, 2);

  const report = buildReportSummary({
    tasks: [
      { id: 't1', title: 'Today', completed: false, closed: false, dueDate: '2026-06-17', startDate: null, priority: 'high', urgent: true, projectId: null, completedAt: null, closedAt: null, sectionId: null, reminderAt: null, reminderEndAt: null, tags: [], recurrence: null, description: '', subtasks: [], attachments: [], order: 1, createdAt: '', updatedAt: '' }
    ],
    projects: []
  }, '2026-06-17');
  assert.equal(report.summary.dueToday, 1);
  assert.equal(report.insights.urgentOpen, 1);
});
