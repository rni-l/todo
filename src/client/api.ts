import type { ImportPreview, PublicData, Project, SmartFilter, Tag, Task, AppSettings, Attachment } from './types.ts';

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
  }
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export interface DataEnvelope {
  data: PublicData;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }
  const response = await fetch(path, {
    ...options,
    headers,
    body,
    credentials: 'same-origin'
  });
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) {
    let detail: Record<string, unknown> = {};
    try {
      detail = await response.json();
    } catch {
      detail = {};
    }
    throw new Error(String(detail.error || response.statusText || 'request_failed'));
  }
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json() as Promise<T>;
  return response.text() as T;
}

export type LoginResponse = { ok: true; user: { username: string } };
export type TaskMutationResponse = { task: Task; data: PublicData };
export type ProjectMutationResponse = { project: Project; data: PublicData };
export type TagMutationResponse = { tag: Tag; data: PublicData };
export type FilterMutationResponse = { filter: SmartFilter; data: PublicData };
export type DeleteResponse = { ok: true; data: PublicData };
export type SettingsResponse = { settings: AppSettings };
export type AttachmentResponse = { attachment: Attachment; data: PublicData };
export type ImportPreviewResponse = { preview: ImportPreview };
export type ImportDataResponse = { ok: true; data: PublicData };
