import { createServer } from 'http';
import { getWebSocketServer } from './ws-server';

const PORT = process.env.PORT || 3001;

// HTTP 서버 생성
const server = createServer((req, res) => {
  // Health check 엔드포인트
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

// WebSocket 서버 시작
const wsServer = getWebSocketServer();
wsServer.start(server);

// 서버 시작
server.listen(PORT, () => {
  console.log(`> WebSocket server ready on ws://localhost:${PORT}/api/ws/coins`);
});

// 포트 충돌 에러 처리
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ 포트 ${PORT}가 이미 사용 중입니다.`);
    console.error(`다음 중 하나를 시도하세요:`);
    console.error(`  1. 기존 프로세스를 종료: lsof -ti:${PORT} | xargs kill -9`);
    console.error(`  2. 다른 포트 사용: PORT=3002 tsx src/index.ts`);
    process.exit(1);
  } else {
    console.error('서버 에러:', error);
    process.exit(1);
  }
});

// 프로세스 종료 시 정리
process.on('SIGTERM', () => {
  console.log('SIGTERM 신호 수신, 서버 종료 중...');
  wsServer.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT 신호 수신, 서버 종료 중...');
  wsServer.stop();
  process.exit(0);
});


