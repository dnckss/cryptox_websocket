/**
 * WebSocket 서버
 * 코인 가격 실시간 업데이트를 위한 WebSocket 서버
 */

import { WebSocketServer, WebSocket } from "ws"
import { COIN_DEFINITIONS } from "./mock-coins"
import { getCoinData } from "./mock-coins-service"
import type { Server } from "http"

interface CoinPriceUpdate {
  coinId: string
  symbol: string
  price: number
  change1h: number
  change24h: number
  change1w: number
  marketCap: number
  volume24h: number
}

class CoinPriceWebSocketServer {
  private wss: WebSocketServer | null = null
  private clients: Set<WebSocket> = new Set()
  private priceCheckInterval: NodeJS.Timeout | null = null
  private lastPrices: Map<string, number> = new Map()

  /**
   * WebSocket 서버 시작
   */
  start(server: Server) {
    // WebSocket 서버 생성
    this.wss = new WebSocketServer({
      server,
      path: "/api/ws/coins",
    })

    // 연결 이벤트 처리
    this.wss.on("connection", (ws: WebSocket) => {
      console.log("📡 WebSocket 클라이언트 연결됨")
      this.clients.add(ws)

      // 초기 데이터 전송 (모든 코인의 현재 가격)
      this.sendInitialData(ws)

      // 연결 종료 이벤트 처리
      ws.on("close", () => {
        console.log("📡 WebSocket 클라이언트 연결 종료")
        this.clients.delete(ws)
      })

      // 에러 처리
      ws.on("error", (error) => {
        console.error("WebSocket 에러:", error)
        this.clients.delete(ws)
      })

      // 클라이언트로부터 메시지 수신 (필요시)
      ws.on("message", (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString())
          console.log("클라이언트 메시지 수신:", data)
        } catch (error) {
          console.error("메시지 파싱 오류:", error)
        }
      })
    })

    // 가격 체크 시작 (100ms마다 체크)
    this.startPriceCheck()

    console.log("✅ WebSocket 서버 시작됨: /api/ws/coins")
  }

  /**
   * 초기 데이터 전송 (모든 코인의 현재 가격)
   */
  private sendInitialData(ws: WebSocket) {
    try {
      const allCoins = COIN_DEFINITIONS.map((coin) => {
        const coinData = getCoinData(coin)
        return {
          coinId: coinData.id,
          symbol: coinData.symbol,
          price: coinData.price,
          change1h: coinData.change1h,
          change24h: coinData.change1d,
          change1w: coinData.change1w,
          marketCap: coinData.marketCap,
          volume24h: coinData.volume24h,
        }
      })

      ws.send(
        JSON.stringify({
          type: "initial",
          data: allCoins,
        })
      )
    } catch (error) {
      console.error("초기 데이터 전송 오류:", error)
    }
  }

  /**
   * 가격 체크 시작 (각 코인의 변동 타이밍에 맞춰 업데이트)
   */
  private startPriceCheck() {
    // 100ms마다 체크하여 각 코인의 변동 타이밍에 맞춰 업데이트
    this.priceCheckInterval = setInterval(() => {
      this.checkAndBroadcastPriceChanges()
    }, 100) // 100ms마다 체크
  }

  /**
   * 가격 변경 감지 및 브로드캐스트
   */
  private checkAndBroadcastPriceChanges() {
    if (this.clients.size === 0) return

    const updates: CoinPriceUpdate[] = []

    // 모든 코인 체크
    COIN_DEFINITIONS.forEach((coin) => {
      try {
        const coinData = getCoinData(coin)
        const lastPrice = this.lastPrices.get(coin.id)

        // 가격이 변경되었거나 처음 체크하는 경우
        if (lastPrice === undefined || lastPrice !== coinData.price) {
          updates.push({
            coinId: coinData.id,
            symbol: coinData.symbol,
            price: coinData.price,
            change1h: coinData.change1h,
            change24h: coinData.change1d,
            change1w: coinData.change1w,
            marketCap: coinData.marketCap,
            volume24h: coinData.volume24h,
          })

          // 마지막 가격 업데이트
          this.lastPrices.set(coin.id, coinData.price)
        }
      } catch (error) {
        console.error(`코인 ${coin.id} 체크 오류:`, error)
      }
    })

    // 변경된 코인이 있으면 브로드캐스트
    if (updates.length > 0) {
      this.broadcast({
        type: "update",
        data: updates,
      })
    }
  }

  /**
   * 모든 클라이언트에 메시지 브로드캐스트
   */
  private broadcast(message: object) {
    const messageStr = JSON.stringify(message)
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr)
        } catch (error) {
          console.error("브로드캐스트 오류:", error)
          this.clients.delete(client)
        }
      }
    })
  }

  /**
   * 특정 코인의 가격 업데이트를 브로드캐스트 (외부에서 호출 가능)
   */
  broadcastPriceUpdate(coinData: {
    coinId: string
    symbol: string
    price: number
    change1h: number
    change24h: number
    change1w: number
    marketCap: number
    volume24h: number
  }) {
    // 마지막 가격 업데이트
    this.lastPrices.set(coinData.coinId, coinData.price)

    // 브로드캐스트
    this.broadcast({
      type: "update",
      data: [coinData],
    })
  }

  /**
   * WebSocket 서버 종료
   */
  stop() {
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval)
      this.priceCheckInterval = null
    }

    if (this.wss) {
      this.clients.forEach((client) => {
        client.close()
      })
      this.clients.clear()
      this.wss.close()
      this.wss = null
    }

    console.log("WebSocket 서버 종료됨")
  }
}

// 싱글톤 인스턴스
let wsServerInstance: CoinPriceWebSocketServer | null = null

/**
 * WebSocket 서버 인스턴스 가져오기
 */
export function getWebSocketServer(): CoinPriceWebSocketServer {
  if (!wsServerInstance) {
    wsServerInstance = new CoinPriceWebSocketServer()
  }
  return wsServerInstance
}


