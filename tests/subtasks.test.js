import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSubtasks, parseSubtaskLines } from '../public/assets/subtasks.js';

test('parseSubtaskLines returns one title for single-line input', () => {
  assert.deepEqual(parseSubtaskLines('Review notes'), ['Review notes']);
});

test('parseSubtaskLines splits multiline input and trims whitespace', () => {
  assert.deepEqual(
    parseSubtaskLines('  first item  \nsecond item\r\n  third item'),
    ['first item', 'second item', 'third item']
  );
});

test('parseSubtaskLines drops blank lines', () => {
  assert.deepEqual(parseSubtaskLines('\nalpha\n\n   \n beta \n'), ['alpha', 'beta']);
});

test('appendSubtasks preserves order and defaults for newly created subtasks', () => {
  const existing = [{ id: 'sub_1', title: 'Existing', completed: false, order: 1, dueDate: null, priority: 'none' }];
  const result = appendSubtasks(existing, 'Plan\nShip');

  assert.equal(result.createdCount, 2);
  assert.deepEqual(result.titles, ['Plan', 'Ship']);
  assert.equal(result.subtasks.length, 3);
  assert.deepEqual(result.subtasks[1], {
    title: 'Plan',
    completed: false,
    order: 2,
    dueDate: null,
    priority: 'none'
  });
  assert.deepEqual(result.subtasks[2], {
    title: 'Ship',
    completed: false,
    order: 3,
    dueDate: null,
    priority: 'none'
  });
});
