import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
};

const server = http.createServer(async (req, res) => {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 엔드포인트: 버그 리포트
  if (req.url === '/api/bug-report' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const report = JSON.parse(body);
        console.log('\n========== 버그 리포트 수신 ==========');
        console.log('설명:', report.description);
        console.log('URL:', report.url);
        console.log('User Agent:', report.userAgent?.slice(0, 50) + '...');
        console.log('로그 수:', report.logs?.length || 0);
        console.log('타임스탬프:', report.timestamp);

        if (report.logs?.length > 0) {
          console.log('\n--- 캡처된 로그 ---');
          report.logs.slice(-5).forEach((log, i) => {
            console.log(`  ${i + 1}. [${log.type}] ${JSON.stringify(log.args || log.message).slice(0, 80)}`);
          });
        }
        console.log('=====================================\n');

        // 성공 응답 (GitHub issue URL 형식)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          issueUrl: `https://github.com/jhlee0409/inner-lens/issues/${Math.floor(Math.random() * 1000)}`,
          message: '버그 리포트가 성공적으로 제출되었습니다 (Mock)',
        }));
      } catch (e) {
        console.error('JSON 파싱 에러:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 정적 파일 서빙
  let filePath = req.url === '/' ? '/index.html' : req.url;

  // dist 폴더 매핑
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
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   Inner Lens 로컬 테스트 서버                              ║
║                                                            ║
║   URL: http://localhost:${PORT}                             ║
║                                                            ║
║   종료하려면 Ctrl+C를 누르세요                             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
