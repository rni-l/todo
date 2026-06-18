import type { Subtask } from '../types.ts';

export function parseSubtaskLines(input: unknown) {
  return String(input ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

export function appendSubtasks(existingSubtasks: Subtask[] = [], input: unknown) {
  const titles = parseSubtaskLines(input);
  return {
    titles,
    createdCount: titles.length,
    subtasks: [
      ...existingSubtasks,
      ...titles.map((title, index) => ({
        title,
        completed: false,
        order: existingSubtasks.length + index + 1,
        dueDate: null,
        priority: 'none' as const
      }))
    ]
  };
}
