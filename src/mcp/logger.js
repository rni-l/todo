let nextRequestNumber = 1;

export function isMcpDevLoggingEnabled(env = process.env) {
  if (env.TODO_MCP_LOG === '0') return false;
  if (env.TODO_MCP_LOG === '1') return true;
  return env.npm_lifecycle_event === 'mcp:dev';
}

export function createRequestId() {
  const id = nextRequestNumber;
  nextRequestNumber += 1;
  return `req_${id}`;
}

function formatValue(value) {
  if (value === undefined) return null;
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function formatMeta(meta = {}) {
  return Object.entries(meta)
    .map(([key, value]) => {
      const formatted = formatValue(value);
      return formatted === null ? null : `${key}=${formatted}`;
    })
    .filter(Boolean)
    .join(' ');
}

export function createMcpLogger({
  enabled = isMcpDevLoggingEnabled(),
  output = console
} = {}) {
  function write(level, event, meta) {
    if (!enabled) return;
    const details = formatMeta(meta);
    const line = `[mcp] ${new Date().toISOString()} ${level} ${event}${details ? ` ${details}` : ''}`;
    if (level === 'error' && typeof output.error === 'function') {
      output.error(line);
    } else {
      output.log(line);
    }
  }

  return {
    enabled,
    info(event, meta) {
      write('info', event, meta);
    },
    error(event, meta) {
      write('error', event, meta);
    }
  };
}

export function summarizeRpcBody(body) {
  if (Array.isArray(body)) {
    return {
      rpcMethod: 'batch',
      batchSize: body.length
    };
  }
  if (!body || typeof body !== 'object') return {};
  return {
    rpcMethod: body.method,
    toolName: body.method === 'tools/call' ? body.params?.name : undefined
  };
}
