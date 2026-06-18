import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportSummary } from '../src/client/lib/reports.ts';

const TODAY = '2026-06-09';

test('buildReportSummary aggregates headline metrics and distributions', () => {
  const report = buildReportSummary({
    tasks: [
      { id: 't1', title: 'Overdue', completed: false, dueDate: '2026-06-08', priority: 'high', projectId: 'p1', urgent: true },
      { id: 't2', title: 'Today', completed: false, dueDate: TODAY, priority: 'medium', projectId: 'p1', urgent: false },
      { id: 't3', title: 'Soon', completed: false, startDate: '2026-06-11', dueDate: '2026-06-12', priority: 'low', projectId: null, urgent: false },
      { id: 't4', title: 'Undated', completed: false, dueDate: null, priority: 'none', projectId: 'p2', urgent: false },
      { id: 't5', title: 'Done today', completed: true, dueDate: '2026-06-09', priority: 'none', projectId: 'p1', urgent: false, completedAt: '2026-06-09T02:00:00.000Z' },
      { id: 't6', title: 'Done week', completed: true, dueDate: '2026-06-07', priority: 'none', projectId: 'p2', urgent: false, completedAt: '2026-06-08T02:00:00.000Z' },
      { id: 't7', title: 'Closed', completed: false, closed: true, closedAt: '2026-06-09T03:00:00.000Z', dueDate: TODAY, priority: 'high', projectId: 'p1', urgent: true }
    ],
    projects: [
      { id: 'p1', name: 'Alpha' },
      { id: 'p2', name: 'Beta' }
    ]
  }, TODAY);

  assert.deepEqual(report.summary, {
    open: 4,
    overdue: 1,
    dueToday: 1,
    completedToday: 1,
    completedThisWeek: 2,
    closed: 1
  });
  assert.deepEqual(report.priorityBreakdown, [
    { key: 'high', count: 1 },
    { key: 'medium', count: 1 },
    { key: 'low', count: 1 },
    { key: 'none', count: 1 }
  ]);
  assert.deepEqual(report.projectBreakdown, [
    { id: 'p1', name: 'Alpha', open: 2, completed: 1, closed: 1, overdue: 1 },
    { id: 'p2', name: 'Beta', open: 1, completed: 1, closed: 0, overdue: 0 }
  ]);
  assert.equal(report.dueBuckets[0].count, 1);
  assert.equal(report.dueBuckets[2].count, 1);
  assert.equal(report.dueBuckets[3].count, 1);
  assert.deepEqual(report.statusBuckets, [
    { key: 'overdue', count: 1 },
    { key: 'today', count: 1 },
    { key: 'future', count: 1 },
    { key: 'undated', count: 1 },
    { key: 'completed', count: 2 },
    { key: 'closed', count: 1 }
  ]);
  assert.deepEqual(report.insights, {
    datedOpen: 3,
    upcomingWeek: 2,
    inboxOpen: 1,
    urgentOpen: 1
  });
});
