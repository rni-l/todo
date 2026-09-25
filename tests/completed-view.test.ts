import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCompletedTasks } from '../src/client/lib/derived.ts';
import type { Task } from '../src/client/types.ts';

function done(id: string, completedAt: string, title = id): Task {
  return {
    id,
    title,
    completed: true,
    completedAt,
    closed: false,
    closedAt: null,
    projectId: null,
    sectionId: null,
    startDate: null,
    dueDate: null,
    reminderAt: null,
    reminderEndAt: null,
    priority: 'none',
    urgent: false,
    tags: [],
    recurrence: null,
    description: '',
    subtasks: [],
    attachments: [],
    order: 1,
    createdAt: '',
    updatedAt: '',
  };
}

const TODAY = '2026-09-25';
const TASKS = [
  done('today-am', '2026-09-25T02:00:00.000Z', 'Write Report'),
  done('today-pm', '2026-09-25T10:00:00.000Z', 'review 文档'),
  done('yesterday', '2026-09-24T09:00:00.000Z', 'Weekly sync'),
  done('six-days-ago', '2026-09-19T09:00:00.000Z', 'Email cleanup'),
  done('eight-days-ago', '2026-09-17T09:00:00.000Z', 'Old task'),
  done('forty-days-ago', '2026-08-16T09:00:00.000Z', 'Ancient task'),
  { ...done('open-task', '2026-09-25T03:00:00.000Z', 'Still open'), completed: false, completedAt: null },
  { ...done('no-date', ''), completedAt: '' },
];

test('filterCompletedTasks keeps only completed tasks with a completion day by default', () => {
  const result = filterCompletedTasks(TASKS, {}, TODAY);
  assert.deepEqual(result.map(task => task.id), [
    'today-am',
    'today-pm',
    'yesterday',
    'six-days-ago',
    'eight-days-ago',
    'forty-days-ago',
  ]);
});

test('filterCompletedTasks matches keyword case-insensitively and trims input', () => {
  const result = filterCompletedTasks(TASKS, { keyword: '  REPORT ' }, TODAY);
  assert.deepEqual(result.map(task => task.id), ['today-am']);
  const chinese = filterCompletedTasks(TASKS, { keyword: '文档' }, TODAY);
  assert.deepEqual(chinese.map(task => task.id), ['today-pm']);
});

test('filterCompletedTasks range=today keeps only tasks completed today', () => {
  const result = filterCompletedTasks(TASKS, { range: 'today' }, TODAY);
  assert.deepEqual(result.map(task => task.id), ['today-am', 'today-pm']);
});

test('filterCompletedTasks range=week keeps the last seven days inclusive', () => {
  const result = filterCompletedTasks(TASKS, { range: 'week' }, TODAY);
  assert.deepEqual(result.map(task => task.id), ['today-am', 'today-pm', 'yesterday', 'six-days-ago']);
});

test('filterCompletedTasks range=month keeps the last thirty days inclusive', () => {
  const result = filterCompletedTasks(TASKS, { range: 'month' }, TODAY);
  assert.deepEqual(result.map(task => task.id), ['today-am', 'today-pm', 'yesterday', 'six-days-ago', 'eight-days-ago']);
});

test('filterCompletedTasks custom range applies from/to bounds inclusively', () => {
  const result = filterCompletedTasks(TASKS, { range: 'custom', from: '2026-09-19', to: '2026-09-24' }, TODAY);
  assert.deepEqual(result.map(task => task.id), ['yesterday', 'six-days-ago']);
  const onlyFrom = filterCompletedTasks(TASKS, { range: 'custom', from: '2026-09-20' }, TODAY);
  assert.deepEqual(onlyFrom.map(task => task.id), ['today-am', 'today-pm', 'yesterday']);
  const onlyTo = filterCompletedTasks(TASKS, { range: 'custom', to: '2026-09-18' }, TODAY);
  assert.deepEqual(onlyTo.map(task => task.id), ['eight-days-ago', 'forty-days-ago']);
});

test('filterCompletedTasks ignores from/to unless the range is custom', () => {
  const result = filterCompletedTasks(TASKS, { range: 'all', from: '2026-09-25', to: '2026-09-25' }, TODAY);
  assert.equal(result.length, 6);
});

test('filterCompletedTasks combines keyword and time range', () => {
  const result = filterCompletedTasks(TASKS, { keyword: 'task', range: 'month' }, TODAY);
  assert.deepEqual(result.map(task => task.id), ['eight-days-ago']);
});
