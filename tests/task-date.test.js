import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskRangeSegments, getRecentWindowDays, getTaskDateStatus, shouldShowInRecentView, taskCoversDate, taskDateRange } from '../src/client/lib/dates.ts';

const TODAY = '2026-06-08';

test('getTaskDateStatus classifies overdue, today, future, and undated tasks', () => {
  assert.deepEqual(
    getTaskDateStatus({ dueDate: '2026-06-07' }, TODAY),
    { key: 'overdue', tone: 'danger', dueDate: '2026-06-07', startDate: '2026-06-07', endDate: '2026-06-07' }
  );
  assert.deepEqual(
    getTaskDateStatus({ dueDate: TODAY }, TODAY),
    { key: 'today', tone: 'success', dueDate: TODAY, startDate: TODAY, endDate: TODAY }
  );
  assert.deepEqual(
    getTaskDateStatus({ dueDate: '2026-06-10' }, TODAY),
    { key: 'future', tone: 'accent', dueDate: '2026-06-10', startDate: '2026-06-10', endDate: '2026-06-10' }
  );
  assert.deepEqual(
    getTaskDateStatus({ dueDate: null }, TODAY),
    { key: 'undated', tone: 'muted', dueDate: null, startDate: null, endDate: null }
  );
});

test('date helpers normalize and match task ranges', () => {
  assert.deepEqual(taskDateRange({ startDate: '2026-06-12', dueDate: '2026-06-10' }), {
    startDate: '2026-06-10',
    endDate: '2026-06-12'
  });
  assert.equal(taskCoversDate({ startDate: '2026-06-10', dueDate: '2026-06-12' }, '2026-06-11'), true);
  assert.equal(taskCoversDate({ startDate: '2026-06-10', dueDate: '2026-06-12' }, '2026-06-13'), false);
});

test('getTaskDateStatus treats active ranges as today', () => {
  assert.deepEqual(
    getTaskDateStatus({ startDate: '2026-06-07', dueDate: '2026-06-10' }, TODAY),
    { key: 'today', tone: 'success', dueDate: '2026-06-10', startDate: '2026-06-07', endDate: '2026-06-10' }
  );
});

test('getRecentWindowDays returns today through the next six days', () => {
  assert.deepEqual(getRecentWindowDays(TODAY), [
    '2026-06-08',
    '2026-06-09',
    '2026-06-10',
    '2026-06-11',
    '2026-06-12',
    '2026-06-13',
    '2026-06-14'
  ]);
});

test('shouldShowInRecentView includes overdue and today through today plus six days', () => {
  assert.equal(shouldShowInRecentView({ dueDate: '2026-06-01', completed: false }, TODAY), true);
  assert.equal(shouldShowInRecentView({ dueDate: TODAY, completed: false }, TODAY), true);
  assert.equal(shouldShowInRecentView({ dueDate: '2026-06-14', completed: false }, TODAY), true);
  assert.equal(shouldShowInRecentView({ startDate: '2026-06-14', dueDate: '2026-06-16', completed: false }, TODAY), true);
  assert.equal(shouldShowInRecentView({ dueDate: '2026-06-15', completed: false }, TODAY), false);
});

test('shouldShowInRecentView excludes undated, completed, and closed tasks', () => {
  assert.equal(shouldShowInRecentView({ dueDate: null, completed: false }, TODAY), false);
  assert.equal(shouldShowInRecentView({ dueDate: TODAY, completed: true }, TODAY), false);
  assert.equal(shouldShowInRecentView({ dueDate: TODAY, completed: false, closed: true }, TODAY), false);
});

test('buildTaskRangeSegments clips multi-day tasks to visible days', () => {
  const days = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14'];
  const [inside, clippedStart, clippedEnd] = buildTaskRangeSegments([
    { id: 'inside', startDate: '2026-06-09', dueDate: '2026-06-11' },
    { id: 'clipped-start', startDate: '2026-06-06', dueDate: '2026-06-09' },
    { id: 'clipped-end', startDate: '2026-06-13', dueDate: '2026-06-16' },
    { id: 'outside', startDate: '2026-06-15', dueDate: '2026-06-16' }
  ], days);

  assert.equal(inside.task.id, 'inside');
  assert.equal(inside.startIndex, 1);
  assert.equal(inside.endIndex, 3);
  assert.equal(inside.span, 3);
  assert.equal(inside.continuesBefore, false);
  assert.equal(inside.continuesAfter, false);

  assert.equal(clippedStart.task.id, 'clipped-start');
  assert.equal(clippedStart.startIndex, 0);
  assert.equal(clippedStart.endIndex, 1);
  assert.equal(clippedStart.continuesBefore, true);

  assert.equal(clippedEnd.task.id, 'clipped-end');
  assert.equal(clippedEnd.startIndex, 5);
  assert.equal(clippedEnd.endIndex, 6);
  assert.equal(clippedEnd.continuesAfter, true);
});
