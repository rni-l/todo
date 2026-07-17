import { z } from 'zod';

const prioritySchema = z.enum(['none', 'low', 'medium', 'high']);
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableDateSchema = dateStringSchema.nullable();
const nullableStringSchema = z.string().nullable();

const subtaskSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  completed: z.boolean().optional(),
  order: z.number().optional(),
  dueDate: nullableDateSchema.optional(),
  priority: prioritySchema.optional()
});

const recurrenceSchema = z.object({
  type: z.string(),
  interval: z.number().int().positive().default(1)
}).nullable();

const taskPatchSchema = z.object({
  title: z.string().optional(),
  completed: z.boolean().optional(),
  closed: z.boolean().optional(),
  projectId: nullableStringSchema.optional(),
  sectionId: nullableStringSchema.optional(),
  startDate: nullableDateSchema.optional(),
  dueDate: nullableDateSchema.optional(),
  reminderAt: nullableStringSchema.optional(),
  reminderEndAt: nullableStringSchema.optional(),
  priority: prioritySchema.optional(),
  urgent: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  recurrence: recurrenceSchema.optional(),
  description: z.string().optional(),
  subtasks: z.array(subtaskSchema).optional(),
  order: z.number().optional()
});

const listTasksSchema = {
  status: z.enum(['open', 'completed', 'closed', 'all']).default('open'),
  query: z.string().optional(),
  projectId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  due: z.enum(['today', 'overdue', 'upcoming', 'none', 'any']).default('any'),
  limit: z.number().int().min(1).max(200).default(50)
};

const createTaskSchema = {
  title: z.string().min(1),
  projectId: nullableStringSchema.optional(),
  sectionId: nullableStringSchema.optional(),
  startDate: nullableDateSchema.optional(),
  dueDate: nullableDateSchema.optional(),
  reminderAt: nullableStringSchema.optional(),
  reminderEndAt: nullableStringSchema.optional(),
  priority: prioritySchema.default('none'),
  urgent: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  recurrence: recurrenceSchema.optional(),
  description: z.string().default(''),
  subtasks: z.array(subtaskSchema).default([])
};

const updateTaskSchema = {
  id: z.string().min(1),
  patch: taskPatchSchema
};

const taskIdSchema = {
  id: z.string().min(1)
};

const booleanTaskStateSchema = {
  id: z.string().min(1),
  value: z.boolean().default(true)
};

function textResult(payload) {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}

function today() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function matchesStatus(task, status) {
  if (status === 'all') return true;
  if (status === 'completed') return task.completed && !task.closed;
  if (status === 'closed') return task.closed;
  return !task.completed && !task.closed;
}

function matchesDue(task, due) {
  if (due === 'any') return true;
  if (due === 'none') return !task.dueDate;
  if (!task.dueDate) return false;
  const current = today();
  if (due === 'today') return task.dueDate === current;
  if (due === 'overdue') return task.dueDate < current;
  if (due === 'upcoming') return task.dueDate > current;
  return true;
}

function matchesQuery(task, query = '') {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    task.title,
    task.description,
    task.priority,
    task.projectId,
    task.sectionId,
    ...(task.tags || []),
    ...(task.subtasks || []).map(subtask => subtask.title)
  ].filter(Boolean).some(value => String(value).toLowerCase().includes(needle));
}

function filterTasks(tasks, args) {
  return tasks
    .filter(task => matchesStatus(task, args.status))
    .filter(task => matchesDue(task, args.due))
    .filter(task => matchesQuery(task, args.query))
    .filter(task => !args.projectId || task.projectId === args.projectId)
    .filter(task => !args.tagIds?.length || args.tagIds.every(tagId => task.tags.includes(tagId)))
    .slice(0, args.limit);
}

function mutationEnvelope(store, task) {
  return {
    ok: true,
    task,
    dataVersion: store.data.version,
    updatedAt: store.data.updatedAt
  };
}

function notFoundError() {
  const error = new Error('task_not_found');
  error.status = 404;
  return error;
}

function withToolLog(name, logger, handler) {
  return async args => {
    const startedAt = Date.now();
    logger?.info('tool.start', { tool: name });
    try {
      const result = await handler(args);
      logger?.info('tool.ok', {
        tool: name,
        durationMs: Date.now() - startedAt
      });
      return result;
    } catch (error) {
      logger?.error('tool.error', {
        tool: name,
        durationMs: Date.now() - startedAt,
        error: error.message || 'tool_failed'
      });
      throw error;
    }
  };
}

export function registerTodoTools(server, runtime, { logger } = {}) {
  server.registerTool('todo_list_tasks', {
    title: 'List TODO tasks',
    description: 'List personal TODO tasks with status, query, project, tag, and due-date filters.',
    inputSchema: listTasksSchema
  }, withToolLog('todo_list_tasks', logger, async args => runtime.read(store => textResult({
    ok: true,
    tasks: filterTasks(store.publicData().tasks, args),
    dataVersion: store.data.version,
    updatedAt: store.data.updatedAt
  }))));

  server.registerTool('todo_get_task', {
    title: 'Get TODO task',
    description: 'Get one personal TODO task by id.',
    inputSchema: taskIdSchema
  }, withToolLog('todo_get_task', logger, async ({ id }) => runtime.read(store => {
    const task = store.publicData().tasks.find(item => item.id === id);
    if (!task) throw notFoundError();
    return textResult({
      ok: true,
      task,
      dataVersion: store.data.version,
      updatedAt: store.data.updatedAt
    });
  })));

  server.registerTool('todo_create_task', {
    title: 'Create TODO task',
    description: 'Create a personal TODO task.',
    inputSchema: createTaskSchema
  }, withToolLog('todo_create_task', logger, async args => runtime.write(async store => {
    const task = await store.createTask(args);
    return textResult(mutationEnvelope(store, task));
  })));

  server.registerTool('todo_update_task', {
    title: 'Update TODO task',
    description: 'Update editable fields on a personal TODO task.',
    inputSchema: updateTaskSchema
  }, withToolLog('todo_update_task', logger, async ({ id, patch }) => runtime.write(async store => {
    const task = await store.updateTask(id, patch);
    if (!task) throw notFoundError();
    return textResult(mutationEnvelope(store, task));
  })));

  server.registerTool('todo_complete_task', {
    title: 'Complete TODO task',
    description: 'Mark a task completed or reopen it.',
    inputSchema: booleanTaskStateSchema
  }, withToolLog('todo_complete_task', logger, async ({ id, value }) => runtime.write(async store => {
    const task = await store.updateTask(id, { completed: value, ...(value ? { closed: false } : {}) });
    if (!task) throw notFoundError();
    return textResult(mutationEnvelope(store, task));
  })));

  server.registerTool('todo_close_task', {
    title: 'Close TODO task',
    description: 'Close or reopen a task without deleting it.',
    inputSchema: booleanTaskStateSchema
  }, withToolLog('todo_close_task', logger, async ({ id, value }) => runtime.write(async store => {
    const task = await store.updateTask(id, { closed: value, ...(value ? { completed: false } : {}) });
    if (!task) throw notFoundError();
    return textResult(mutationEnvelope(store, task));
  })));
}
