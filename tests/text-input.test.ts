import test from 'node:test';
import assert from 'node:assert/strict';
import { isImeEnter, shouldSaveTextDraft, subtaskDraftKey, syncSubtaskDrafts } from '../src/client/lib/textInput.ts';

test('isImeEnter detects composition enter keys and ignores normal enter', () => {
  assert.equal(isImeEnter('Enter', { isComposing: true }), true);
  assert.equal(isImeEnter('Enter', { keyCode: 229 }), true);
  assert.equal(isImeEnter('Enter', { isComposing: false, keyCode: 13 }), false);
  assert.equal(isImeEnter('a', { isComposing: true }), false);
});

test('shouldSaveTextDraft normalizes nullish values before comparing', () => {
  assert.equal(shouldSaveTextDraft(null, ''), false);
  assert.equal(shouldSaveTextDraft(undefined, undefined), false);
  assert.equal(shouldSaveTextDraft('title', 'title'), false);
  assert.equal(shouldSaveTextDraft('title', 'title updated'), true);
});

test('syncSubtaskDrafts preserves existing drafts, adds new subtasks, and drops removed ones', () => {
  const current = {
    sub_1: 'Edited title',
    'order:2': 'Orphan draft',
  };

  const next = syncSubtaskDrafts([
    { id: 'sub_1', order: 1, title: 'Original title' },
    { order: 3, title: 'Brand new subtask' },
  ], current);

  assert.deepEqual(next, {
    sub_1: 'Edited title',
    'order:3': 'Brand new subtask',
  });
  assert.equal(subtaskDraftKey({ id: 'sub_1', order: 1 }), 'sub_1');
  assert.equal(subtaskDraftKey({ order: 3 }), 'order:3');
});
