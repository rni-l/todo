export function parseSubtaskLines(input) {
  return String(input ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

export function appendSubtasks(existingSubtasks = [], input) {
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
        priority: 'none'
      }))
    ]
  };
}
