import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || 'jhlee0409/inner-lens';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
};

async function loadServerModule() {
  try {
    const serverModule = await import('../../dist/server.js');
    return serverModule;
  } catch {
    console.warn('[Warning] dist/server.js not found. Run "npm run build" first.');
    console.warn('[Warning] Falling back to mock mode.\n');
    return null;
  }
}

function printReportSummary(report) {
  console.log('\n========== Bug Report Received ==========');
  console.log('Description:', report.description?.slice(0, 100));
  console.log('URL:', report.url);
  console.log('User Agent:', report.userAgent?.slice(0, 50) + '...');
  console.log('Logs:', report.logs?.length || 0, 'entries');
  console.log('User Actions:', report.userActions?.length || 0, 'events');
  console.log('Navigations:', report.navigations?.length || 0, 'entries');
  console.log('Performance:', report.performance ? 'captured' : 'N/A');
  console.log('Session Replay:', report.sessionReplay ? `${(report.sessionReplay.length / 1024).toFixed(1)}KB` : 'N/A');

  if (report.logs?.length > 0) {
    console.log('\n--- Recent Logs ---');
    report.logs.slice(-5).forEach((log, i) => {
      console.log(`  ${i + 1}. [${log.level?.toUpperCase()}] ${log.message?.slice(0, 80)}`);
    });
  }
  console.log('=========================================\n');
}

async function handleBugReportRequest(req, res, serverModule) {
  const chunks = [];
  
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      printReportSummary(body);

      if (serverModule && GITHUB_TOKEN) {
        const { handleBugReport } = serverModule;
        const result = await handleBugReport(body, {
          githubToken: GITHUB_TOKEN,
          repository: GITHUB_REPOSITORY,
        });
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
      } else {
        if (serverModule) {
          const { validateBugReport } = serverModule;
          const validation = validateBugReport(body);
          if (!validation.success) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: validation.error }));
            return;
          }
        }
        
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          issueUrl: `https://github.com/${GITHUB_REPOSITORY}/issues/${Math.floor(Math.random() * 1000)}`,
          issueNumber: Math.floor(Math.random() * 1000),
          message: 'Bug report submitted (Mock Mode - no GITHUB_TOKEN)',
        }));
      }
    } catch (e) {
      console.error('Error processing request:', e.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: e.message }));
    }
  });
}

async function main() {
  const serverModule = await loadServerModule();

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/api/bug-report' && req.method === 'POST') {
      await handleBugReportRequest(req, res, serverModule);
      return;
    }

    let filePath = req.url === '/' ? '/index.html' : req.url;

    if (filePath.startsWith('/dist/')) {
      filePath = path.join(__dirname, '../..', filePath);
    } else {
      filePath = path.join(__dirname, filePath);
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (e) {
      if (e.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    }
  });

  server.listen(PORT, () => {
    const mode = GITHUB_TOKEN ? 'Real Mode (GitHub Issues will be created)' : 'Mock Mode';
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   Inner Lens Local Test Server                                 ║
║                                                                ║
║   URL: http://localhost:${PORT}                                  ║
║   Mode: ${mode.padEnd(45)}║
║                                                                ║
║   To enable real GitHub issues:                                ║
║   GITHUB_TOKEN=xxx GITHUB_REPOSITORY=owner/repo node server.js ║
║                                                                ║
║   Press Ctrl+C to stop                                         ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
  });
}

main();
