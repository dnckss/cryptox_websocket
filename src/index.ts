import { createServer, IncomingMessage, ServerResponse } from 'http';
import { getWebSocketServer } from './ws-server';
import { getAllCoinsData, getCoinDataBySymbol, updateCoinPrice } from './mock-coins-service';

const PORT = process.env.PORT || 3001;

// CORS 헤더 설정
function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// JSON 응답 헬퍼
function sendJsonResponse(res: ServerResponse, statusCode: number, data: any) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// 요청 본문 파싱 헬퍼
function parseRequestBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

// HTTP 서버 생성
const server = createServer(async (req, res) => {
  const url = req.url || '';
  const method = req.method || '';

  // OPTIONS 요청 처리 (CORS preflight)
  if (method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check 엔드포인트
  if (url === '/health') {
    sendJsonResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    return;
  }

  // GET /api/prices - 모든 코인 가격 반환
  if (url === '/api/prices' && method === 'GET') {
    try {
      const allCoins = getAllCoinsData();
      const prices: Record<string, number> = {};
      
      allCoins.forEach((coin) => {
        prices[coin.symbol.toLowerCase()] = coin.price;
      });

      sendJsonResponse(res, 200, {
        success: true,
        prices,
      });
      return;
    } catch (error) {
      sendJsonResponse(res, 500, {
        success: false,
        error: 'Internal server error',
      });
      return;
    }
  }

  // GET /api/prices/:symbol - 특정 코인 가격 반환
  const priceSymbolMatch = url.match(/^\/api\/prices\/([^\/]+)$/);
  if (priceSymbolMatch && method === 'GET') {
    try {
      const symbol = priceSymbolMatch[1];
      const coinData = getCoinDataBySymbol(symbol);

      if (!coinData) {
        sendJsonResponse(res, 404, {
          success: false,
          error: `Coin with symbol "${symbol}" not found`,
        });
        return;
      }

      sendJsonResponse(res, 200, {
        success: true,
        price: coinData.price,
      });
      return;
    } catch (error) {
      sendJsonResponse(res, 500, {
        success: false,
        error: 'Internal server error',
      });
      return;
    }
  }

  // POST /api/prices/:symbol - 가격 업데이트
  if (priceSymbolMatch && method === 'POST') {
    try {
      const symbol = priceSymbolMatch[1];
      const body = await parseRequestBody(req);

      if (typeof body.price !== 'number' || body.price <= 0) {
        sendJsonResponse(res, 400, {
          success: false,
          error: 'Invalid price. Price must be a positive number.',
        });
        return;
      }

      // 현재 가격 가져오기
      const currentCoinData = getCoinDataBySymbol(symbol);
      if (!currentCoinData) {
        sendJsonResponse(res, 404, {
          success: false,
          error: `Coin with symbol "${symbol}" not found`,
        });
        return;
      }

      const oldPrice = currentCoinData.price;
      const newPrice = body.price;

      // 가격 업데이트
      const updated = updateCoinPrice(symbol, newPrice);
      if (!updated) {
        sendJsonResponse(res, 500, {
          success: false,
          error: 'Failed to update price',
        });
        return;
      }

      // 업데이트된 코인 데이터 가져오기
      const updatedCoinData = getCoinDataBySymbol(symbol);
      if (!updatedCoinData) {
        sendJsonResponse(res, 500, {
          success: false,
          error: 'Failed to get updated coin data',
        });
        return;
      }

      // WebSocket으로 브로드캐스트
      const wsServer = getWebSocketServer();
      wsServer.broadcastPriceUpdate({
        coinId: updatedCoinData.id,
        symbol: updatedCoinData.symbol,
        price: updatedCoinData.price,
        change1h: updatedCoinData.change1h,
        change24h: updatedCoinData.change1d,
        change1w: updatedCoinData.change1w,
        marketCap: updatedCoinData.marketCap,
        volume24h: updatedCoinData.volume24h,
      });

      sendJsonResponse(res, 200, {
        success: true,
        symbol: updatedCoinData.symbol.toLowerCase(),
        oldPrice,
        newPrice: updatedCoinData.price,
      });
      return;
    } catch (error) {
      sendJsonResponse(res, 500, {
        success: false,
        error: 'Internal server error',
      });
      return;
    }
  }

  // 404 Not Found
  sendJsonResponse(res, 404, {
    success: false,
    error: 'Not Found',
  });
});

// WebSocket 서버 시작
const wsServer = getWebSocketServer();
wsServer.start(server);

// 서버 시작
server.listen(PORT, () => {
  console.log(`> WebSocket server ready on ws://localhost:${PORT}/api/ws/coins`);
  console.log(`> HTTP API endpoints:`);
  console.log(`  GET  http://localhost:${PORT}/api/prices`);
  console.log(`  GET  http://localhost:${PORT}/api/prices/:symbol`);
  console.log(`  POST http://localhost:${PORT}/api/prices/:symbol`);
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


