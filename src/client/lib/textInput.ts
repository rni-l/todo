import type { Subtask } from '../types.ts';

type CompositionNativeEvent = {
  isComposing?: boolean;
  keyCode?: number;
} | null | undefined;

export function isImeEnter(key: string, nativeEvent: CompositionNativeEvent) {
  return key === 'Enter' && Boolean(nativeEvent?.isComposing || nativeEvent?.keyCode === 229);
}

export function normalizeTextDraft(value?: string | null) {
  return String(value ?? '');
}

export function shouldSaveTextDraft(source?: string | null, draft?: string | null) {
  return normalizeTextDraft(source) !== normalizeTextDraft(draft);
}

export function subtaskDraftKey(subtask: Pick<Subtask, 'id' | 'order'>) {
  return subtask.id || `order:${subtask.order}`;
}

export function syncSubtaskDrafts(
  subtasks: Array<Pick<Subtask, 'id' | 'order' | 'title'>>,
  current: Record<string, string>,
) {
  const next: Record<string, string> = {};
  for (const subtask of subtasks) {
    const key = subtaskDraftKey(subtask);
    next[key] = Object.prototype.hasOwnProperty.call(current, key) ? current[key] : normalizeTextDraft(subtask.title);
  }
  return next;
}
