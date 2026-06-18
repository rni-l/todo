function getBoundary(contentType = '') {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] || match?.[2] || null;
}

function splitParameters(value = '') {
  const parts = [];
  let current = '';
  let quoted = false;
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && quoted) {
      escaped = true;
      current += char;
      continue;
    }
    if (char === '"') quoted = !quoted;
    if (char === ';' && !quoted) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function unquote(value = '') {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;
  return trimmed.slice(1, -1).replace(/\\(["\\])/g, '$1');
}

function parseHeaderParameters(value = '') {
  const params = {};
  for (const part of splitParameters(value).slice(1)) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    params[part.slice(0, index).trim().toLowerCase()] = unquote(part.slice(index + 1));
  }
  return params;
}

function decodeExtendedValue(value = '') {
  const match = value.match(/^([^']*)'[^']*'(.*)$/);
  if (!match) return null;
  const charset = match[1].toLowerCase();
  const encoded = match[2];
  try {
    if (!charset || charset === 'utf-8' || charset === 'utf8') return decodeURIComponent(encoded);
    if (charset === 'iso-8859-1' || charset === 'latin1') {
      return encoded.replace(/%([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
    }
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function decodeRegularFilename(utf8Value = '', latin1Value = '') {
  if (!utf8Value && !latin1Value) return '';
  if (!utf8Value) return latin1Value;
  if (!latin1Value || latin1Value === utf8Value) return utf8Value;
  const recoded = Buffer.from(latin1Value, 'latin1').toString('utf8');
  if (utf8Value.includes('\uFFFD') && !recoded.includes('\uFFFD')) return recoded;
  return utf8Value;
}

function parseContentDisposition(utf8Value = '', latin1Value = '') {
  const utf8Params = parseHeaderParameters(utf8Value);
  const latin1Params = parseHeaderParameters(latin1Value || utf8Value);
  const filenameStar = utf8Params['filename*'] || latin1Params['filename*'];
  const filename = decodeExtendedValue(filenameStar) || decodeRegularFilename(utf8Params.filename, latin1Params.filename);
  return {
    name: utf8Params.name || latin1Params.name || '',
    filename
  };
}

function parseHeaderBlock(buffer) {
  const utf8Text = buffer.toString('utf8');
  const latin1Text = buffer.toString('latin1');
  const utf8Headers = {};
  const latin1Headers = {};
  const utf8Lines = utf8Text.split('\r\n');
  const latin1Lines = latin1Text.split('\r\n');
  for (let index = 0; index < utf8Lines.length; index += 1) {
    const utf8Line = utf8Lines[index];
    const colon = utf8Line.indexOf(':');
    if (colon < 0) continue;
    const key = utf8Line.slice(0, colon).toLowerCase();
    utf8Headers[key] = utf8Line.slice(colon + 1).trim();
    const latin1Line = latin1Lines[index] || '';
    const latin1Colon = latin1Line.indexOf(':');
    latin1Headers[key] = latin1Colon >= 0 ? latin1Line.slice(latin1Colon + 1).trim() : utf8Headers[key];
  }
  return { utf8Headers, latin1Headers };
}

export function parseMultipart(buffer, contentType) {
  const boundary = getBoundary(contentType);
  if (!boundary) {
    const error = new Error('Missing multipart boundary');
    error.status = 400;
    throw error;
  }

  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = buffer.indexOf(delimiter);
  if (cursor < 0) return parts;
  cursor += delimiter.length;

  while (cursor < buffer.length) {
    if (buffer[cursor] === 45 && buffer[cursor + 1] === 45) break;
    if (buffer[cursor] === 13 && buffer[cursor + 1] === 10) cursor += 2;

    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd < 0) break;
    const { utf8Headers, latin1Headers } = parseHeaderBlock(buffer.subarray(cursor, headerEnd));

    const nextBoundary = buffer.indexOf(delimiter, headerEnd + 4);
    if (nextBoundary < 0) break;
    let content = buffer.subarray(headerEnd + 4, nextBoundary);
    if (content.length >= 2 && content[content.length - 2] === 13 && content[content.length - 1] === 10) {
      content = content.subarray(0, content.length - 2);
    }

    const disposition = parseContentDisposition(utf8Headers['content-disposition'] || '', latin1Headers['content-disposition'] || '');
    parts.push({
      name: disposition.name,
      filename: disposition.filename,
      contentType: utf8Headers['content-type'] || 'application/octet-stream',
      content
    });
    cursor = nextBoundary + delimiter.length;
  }

  return parts;
}

export function firstFile(parts, name = 'file') {
  return parts.find(part => part.name === name && part.filename) || parts.find(part => part.filename);
}

export function firstField(parts, name) {
  return parts.find(part => part.name === name && !part.filename)?.content.toString('utf8') || '';
}
