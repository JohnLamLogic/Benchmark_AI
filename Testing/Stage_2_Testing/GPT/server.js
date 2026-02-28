const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const dataPath = path.join(__dirname, 'data', 'db.json');
const staticDir = path.join(__dirname, 'public');
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function loadData() {
  try {
    const payload = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(payload);
  } catch (err) {
    console.error('Unable to read data file, initializing empty store.', err.message);
    return { employees: [], weeks: [], meta: { nextEmployeeId: 1, nextWeekId: 1, nextEntryId: 1 } };
  }
}

function saveData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.socket.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
  });
}

function sendJson(res, payload, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function sendStatus(res, code) {
  res.writeHead(code, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
}

function sanitizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizePositions(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => sanitizeString(item))
      .filter(Boolean);
  }
  return [];
}

function sanitizeShift(entry, nextEntryId) {
  const employeeId = Number(entry.employeeId) || null;
  const day = WEEK_DAYS.includes(entry.day) ? entry.day : null;
  const start = sanitizeString(entry.start);
  const end = sanitizeString(entry.end);
  const position = sanitizeString(entry.position);
  if (!employeeId || !day || !start || !end || !position) {
    return null;
  }
  const providedId = Number(entry.id);
  const hasId = Number.isInteger(providedId) && providedId > 0;
  return {
    id: hasId ? providedId : nextEntryId,
    employeeId,
    day,
    start,
    end,
    position,
    isNew: !hasId
  };
}

async function handleApi(req, res, parsedUrl) {
  const method = req.method;
  const parts = parsedUrl.pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (method === 'OPTIONS') {
    sendStatus(res, 204);
    return;
  }

  try {
    if (parts.length === 2 && parts[1] === 'employees') {
      if (method === 'GET') {
        const data = loadData();
        sendJson(res, data.employees);
        return;
      }
      if (method === 'POST') {
        const payload = await parseJsonBody(req);
        const data = loadData();
        const name = sanitizeString(payload.name);
        if (!name) {
          sendJson(res, { error: 'Name is required for an employee' }, 400);
          return;
        }
        const email = sanitizeString(payload.email);
        const positions = normalizePositions(payload.positions);
        const employee = {
          id: data.meta.nextEmployeeId++,
          name,
          email,
          positions
        };
        data.employees.push(employee);
        saveData(data);
        sendJson(res, employee, 201);
        return;
      }
    }

    if (parts.length === 3 && parts[1] === 'employees') {
      const employeeId = Number(parts[2]);
      const data = loadData();
      const targetIndex = data.employees.findIndex((item) => item.id === employeeId);
      if (targetIndex < 0) {
        sendJson(res, { error: 'Employee not found' }, 404);
        return;
      }
      if (method === 'PUT') {
        const payload = await parseJsonBody(req);
        if (payload.name !== undefined) {
          const name = sanitizeString(payload.name);
          if (name) {
            data.employees[targetIndex].name = name;
          }
        }
        if (payload.email !== undefined) {
          data.employees[targetIndex].email = sanitizeString(payload.email);
        }
        if (payload.positions !== undefined) {
          data.employees[targetIndex].positions = normalizePositions(payload.positions);
        }
        saveData(data);
        sendJson(res, data.employees[targetIndex]);
        return;
      }
      if (method === 'DELETE') {
        data.employees.splice(targetIndex, 1);
        data.weeks.forEach((week) => {
          week.entries = week.entries.filter((entry) => entry.employeeId !== employeeId);
        });
        saveData(data);
        sendStatus(res, 204);
        return;
      }
    }

    if (parts[1] === 'weeks') {
      if (parts.length === 2) {
        if (method === 'GET') {
          const data = loadData();
          const summary = data.weeks.map((week) => ({
            id: week.id,
            startDate: week.startDate,
            createdAt: week.createdAt,
            updatedAt: week.updatedAt || week.createdAt
          }));
          sendJson(res, summary);
          return;
        }
        if (method === 'POST') {
          const payload = await parseJsonBody(req);
          const data = loadData();
          const startDate = sanitizeString(payload.startDate);
          if (!startDate) {
            sendJson(res, { error: 'A startDate is required to save the schedule' }, 400);
            return;
          }
          const entriesPayload = Array.isArray(payload.entries) ? payload.entries : [];
          const sanitizedEntries = [];
          entriesPayload.forEach((entry) => {
            const sanitized = sanitizeShift(entry, data.meta.nextEntryId);
            if (sanitized) {
              if (sanitized.isNew) {
                data.meta.nextEntryId += 1;
              }
              const { isNew, ...clean } = sanitized;
              sanitizedEntries.push(clean);
            }
          });
          const existing = data.weeks.find((week) => week.startDate === startDate);
          const stamp = new Date().toISOString();
          if (existing) {
            existing.entries = sanitizedEntries;
            existing.updatedAt = stamp;
            saveData(data);
            sendJson(res, existing);
            return;
          }
          const weekRecord = {
            id: data.meta.nextWeekId++,
            startDate,
            entries: sanitizedEntries,
            createdAt: stamp,
            updatedAt: stamp
          };
          data.weeks.push(weekRecord);
          saveData(data);
          sendJson(res, weekRecord, 201);
          return;
        }
      }

      if (parts.length === 3) {
        const weekStart = parts[2];
        const data = loadData();
        const week = data.weeks.find((item) => item.startDate === weekStart);
        if (!week) {
          sendJson(res, { entries: [] });
          return;
        }
        sendJson(res, week);
        return;
      }
    }

    sendStatus(res, 404);
  } catch (err) {
    console.error('API error', err);
    sendJson(res, { error: err.message || 'Internal error' }, 500);
  }
}

function serveStatic(req, res, parsedUrl) {
  let pathname = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
  pathname = path.normalize(pathname).replace(/^\.\./, '');
  const filePath = path.join(staticDir, pathname);
  if (!filePath.startsWith(staticDir)) {
    sendStatus(res, 403);
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      sendStatus(res, 404);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml'
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mimeType });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (parsedUrl.pathname.startsWith('/api/')) {
      await handleApi(req, res, parsedUrl);
    } else {
      serveStatic(req, res, parsedUrl);
    }
  } catch (err) {
    console.error('Unexpected error', err);
    sendJson(res, { error: 'Unexpected server error' }, 500);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Scheduling app listening on http://localhost:${PORT}`);
});
