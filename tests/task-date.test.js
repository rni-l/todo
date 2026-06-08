import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecentWindowDays, getTaskDateStatus, shouldShowInRecentView } from '../public/assets/task-date.js';

const TODAY = '2026-06-08';

test('getTaskDateStatus classifies overdue, today, future, and undated tasks', () => {
  assert.deepEqual(
    getTaskDateStatus({ dueDate: '2026-06-07' }, TODAY),
    { key: 'overdue', tone: 'danger', dueDate: '2026-06-07' }
  );
  assert.deepEqual(
    getTaskDateStatus({ dueDate: TODAY }, TODAY),
    { key: 'today', tone: 'success', dueDate: TODAY }
  );
  assert.deepEqual(
    getTaskDateStatus({ dueDate: '2026-06-10' }, TODAY),
    { key: 'future', tone: 'accent', dueDate: '2026-06-10' }
  );
  assert.deepEqual(
    getTaskDateStatus({ dueDate: null }, TODAY),
    { key: 'undated', tone: 'muted', dueDate: null }
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
  assert.equal(shouldShowInRecentView({ dueDate: '2026-06-15', completed: false }, TODAY), false);
});

test('shouldShowInRecentView excludes undated and completed tasks', () => {
  assert.equal(shouldShowInRecentView({ dueDate: null, completed: false }, TODAY), false);
  assert.equal(shouldShowInRecentView({ dueDate: TODAY, completed: true }, TODAY), false);
});
