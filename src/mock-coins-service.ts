/**
 * 모의 코인 서비스
 * 가격 변동 시뮬레이션 및 상태 관리
 */

import { COIN_DEFINITIONS, MockCoin, getCoinBySymbol, getCoinById } from "./mock-coins"

// 가격 히스토리 타입
interface PriceHistory {
  price: number
  timestamp: number
}

// 코인별 다음 변동 정보
interface NextPriceChange {
  volatility: number // 변동성 (1~10%)
  direction: number // 방향 (1: 상승, -1: 하락)
  delay: number // 지연 시간 (밀리초)
  scheduledAt: number // 예약된 시간 (타임스탬프)
}

// 메모리에 가격 상태 저장
const priceCache = new Map<string, { price: number; lastUpdate: number }>()

// 가격 히스토리 저장 (1시간, 1일, 1주 전 가격 비교용)
const priceHistory = new Map<string, PriceHistory[]>()

// 각 코인의 다음 변동 정보 저장
const nextPriceChanges = new Map<string, NextPriceChange>()

// 각 코인의 자동 변동 중단 플래그 (관리자가 일시 중단한 경우)
const pausedFluctuations = new Set<string>()

// 히스토리 보관 기간 (7일)
const HISTORY_RETENTION = 7 * 24 * 60 * 60 * 1000

// 초기 히스토리 데이터 생성 플래그
let isHistoryInitialized = false

/**
 * 시드 기반 랜덤 생성기
 */
class SeededRandom {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }
}

/**
 * 코인별 다음 변동 정보 생성
 * @param coinId 코인 ID
 * @returns 다음 변동 정보
 */
export function generateNextPriceChange(coinId: string): NextPriceChange {
  // 코인 ID를 시드로 사용 (일관성을 위해 Date.now() 제거)
  const seed = coinId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  // 기존 nextChange가 있으면 그 시간을 기준으로, 없으면 현재 시간 사용
  const existingChange = nextPriceChanges.get(coinId)
  const timeSeed = existingChange?.scheduledAt || Date.now()
  const random = new SeededRandom(seed + Math.floor(timeSeed / 1000)) // 초 단위로 반올림하여 일관성 확보
  
  // 1. 변동성 범위 선택 (50% 확률로 1~5% 또는 6~10%)
  const useLowRange = random.next() < 0.5 // 50% 확률
  
  let volatility: number
  if (useLowRange) {
    // 1~5% 범위에서 랜덤 선택
    volatility = 1 + random.next() * 4 // 1.0 ~ 5.0
  } else {
    // 6~10% 범위에서 랜덤 선택
    volatility = 6 + random.next() * 4 // 6.0 ~ 10.0
  }
  
  // 2. 변동 방향 결정 (양수/음수)
  const direction = random.next() < 0.5 ? 1 : -1 // 50% 확률로 상승/하락
  
  // 3. 시간 간격 결정 (1~7초)
  const delay = 1000 + Math.floor(random.next() * 6000) // 1000ms ~ 7000ms
  
  return {
    volatility: parseFloat(volatility.toFixed(2)),
    direction,
    delay,
    scheduledAt: Date.now() + delay,
  }
}

/**
 * 코인의 현재 가격 가져오기 (변동 반영)
 */
export function getCurrentPrice(coin: MockCoin): number {
  // 첫 호출 시 히스토리 초기화
  if (!isHistoryInitialized) {
    initializePriceHistory()
  }
  
  const cached = priceCache.get(coin.id)
  const now = Date.now()
  
  // 자동 변동이 중단된 경우 캐시된 가격 반환 (변동 없음)
  // 중단된 경우 예약된 변동도 실행하지 않음
  if (pausedFluctuations.has(coin.id)) {
    if (cached) {
      return cached.price
    }
    // 캐시가 없으면 기본 가격 사용
    const defaultPrice = coin.basePrice
    priceCache.set(coin.id, { price: defaultPrice, lastUpdate: now })
    return defaultPrice
  }
  
  // 가격 변동 처리
  if (!nextPriceChanges.has(coin.id)) {
    nextPriceChanges.set(coin.id, generateNextPriceChange(coin.id))
  }
  
  const nextChange = nextPriceChanges.get(coin.id)!
  
  // 예약된 시간이 지났으면 가격 업데이트 (중단 상태가 아닐 때만)
  if (now >= nextChange.scheduledAt && !pausedFluctuations.has(coin.id)) {
    const currentPrice = cached?.price || coin.basePrice
    
    // 가격 변동 적용
    const changePercent = nextChange.volatility * nextChange.direction
    let newPrice = currentPrice * (1 + changePercent / 100)
    
    // 최소 가격 제한
    const minPrice = 0.001
    const finalPrice = Math.max(newPrice, minPrice)
    
    // 캐시 업데이트
    priceCache.set(coin.id, { price: finalPrice, lastUpdate: now })
    
    // 히스토리에 추가
    addPriceToHistory(coin.id, finalPrice, now)
    
    // 다음 변동 예약
    nextPriceChanges.set(coin.id, generateNextPriceChange(coin.id))
    
    return finalPrice
  }
  
  // 3단계: 캐시된 가격 반환
  if (cached) {
    return cached.price
  }
  
  // 4단계: 기본 가격 사용
  const defaultPrice = coin.basePrice
  priceCache.set(coin.id, { price: defaultPrice, lastUpdate: now })
  return defaultPrice
}

/**
 * 가격 히스토리에 추가
 */
function addPriceToHistory(coinId: string, price: number, timestamp: number) {
  const history = priceHistory.get(coinId) || []
  
  // 새 가격 추가
  history.push({ price, timestamp })
  
  // 오래된 데이터 제거 (7일 이상 지난 것)
  const cutoffTime = timestamp - HISTORY_RETENTION
  const filteredHistory = history.filter(h => h.timestamp > cutoffTime)
  
  priceHistory.set(coinId, filteredHistory)
}

/**
 * 특정 시간 전의 가격 가져오기
 */
function getPriceAtTime(coinId: string, hoursAgo: number): number | null {
  const history = priceHistory.get(coinId)
  if (!history || history.length === 0) return null
  
  const now = Date.now()
  const targetTime = now - (hoursAgo * 60 * 60 * 1000)
  
  // 가장 가까운 시간의 가격 찾기
  let closestPrice: PriceHistory | null = null
  let minDiff = Infinity
  
  for (const record of history) {
    const diff = Math.abs(record.timestamp - targetTime)
    if (diff < minDiff) {
      minDiff = diff
      closestPrice = record
    }
  }
  
  return closestPrice?.price || null
}

/**
 * 가격 변동률 계산
 */
function calculateChangePercentage(currentPrice: number, pastPrice: number | null): number {
  if (!pastPrice || pastPrice === 0) return 0
  return ((currentPrice - pastPrice) / pastPrice) * 100
}

/**
 * 초기 가격 히스토리 생성 (서버 시작 시 호출)
 */
function initializePriceHistory() {
  if (isHistoryInitialized) return
  
  const now = Date.now()
  
  // 각 코인에 대해 과거 가격 데이터 생성
  for (const coin of COIN_DEFINITIONS) {
    const history: PriceHistory[] = []
    
    // 1주일 전부터 현재까지의 가격 데이터 생성 (매 시간마다)
    for (let hoursAgo = 24 * 7; hoursAgo >= 0; hoursAgo--) {
      const timestamp = now - (hoursAgo * 60 * 60 * 1000)
      
      // 시간에 따라 약간씩 변동하는 가격 생성
      const seed = coin.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const timeSeed = Math.floor(timestamp / (1000 * 60 * 60)) // 시간 단위로 시드 변경
      const random = (seed + timeSeed * 9301) % 233280 / 233280
      
      // 기본 가격 기준으로 ±10% 범위 내에서 변동
      const priceVariation = (random - 0.5) * 0.2 // -10% ~ +10%
      const price = coin.basePrice * (1 + priceVariation)
      
      history.push({ price, timestamp })
    }
    
    priceHistory.set(coin.id, history)
    
    // 현재 가격도 캐시에 저장
    const currentPrice = history[history.length - 1].price
    priceCache.set(coin.id, { price: currentPrice, lastUpdate: now })
    
    // 다음 변동 예약
    nextPriceChanges.set(coin.id, generateNextPriceChange(coin.id))
  }
  
    isHistoryInitialized = true
}

/**
 * 코인 데이터 가져오기 (가격 변동 포함)
 */
export function getCoinData(coin: MockCoin) {
  // 첫 호출 시 히스토리 초기화
  if (!isHistoryInitialized) {
    initializePriceHistory()
  }
  
  const currentPrice = getCurrentPrice(coin)
  
  // 실제 과거 가격과 비교하여 변동률 계산
  const price1hAgo = getPriceAtTime(coin.id, 1)
  const price1dAgo = getPriceAtTime(coin.id, 24)
  const price1wAgo = getPriceAtTime(coin.id, 24 * 7)
  
  const change1h = calculateChangePercentage(currentPrice, price1hAgo)
  const change1d = calculateChangePercentage(currentPrice, price1dAgo)
  const change1w = calculateChangePercentage(currentPrice, price1wAgo)
  
  // 시가총액과 거래량도 약간의 변동성 추가
  const marketCapMultiplier = 1 + (change1d / 100) * 0.5
  const volumeMultiplier = 1 + (Math.random() - 0.5) * 0.3
  
  return {
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol,
    price: currentPrice,
    change1h: parseFloat(change1h.toFixed(2)),
    change1d: parseFloat(change1d.toFixed(2)),
    change1w: parseFloat(change1w.toFixed(2)),
    marketCap: coin.marketCapBase * marketCapMultiplier,
    volume24h: coin.volumeBase * volumeMultiplier,
    fdv: coin.marketCapBase * 1.2 * marketCapMultiplier, // FDV는 시가총액의 1.2배 가정
  }
}

/**
 * 모든 코인 데이터 가져오기
 */
export function getAllCoinsData() {
  return COIN_DEFINITIONS.map(coin => getCoinData(coin))
}

/**
 * 코인 가격 직접 업데이트 (관리자용)
 * @param symbol 코인 심볼 (소문자)
 * @param newPrice 새로운 가격
 */
export function updateCoinPrice(symbol: string, newPrice: number) {
  const normalizedSymbol = symbol.toLowerCase()
  const coin = getCoinBySymbol(normalizedSymbol)
  
  if (!coin) {
    console.error(`코인을 찾을 수 없습니다: ${normalizedSymbol}`)
    return false
  }
  
  const now = Date.now()
  
  // 캐시에 새 가격 직접 저장
  priceCache.set(coin.id, { price: newPrice, lastUpdate: now })
  
  // 히스토리에 추가
  addPriceToHistory(coin.id, newPrice, now)
  
  // 자동 변동이 중단된 상태가 아니면 다음 변동 예약
  if (!pausedFluctuations.has(coin.id)) {
    const nextChange = generateNextPriceChange(coin.id)
    nextPriceChanges.set(coin.id, nextChange)
  }
  
  console.log(`✅ 코인 가격 직접 업데이트: ${coin.symbol} → ${newPrice.toFixed(2)}원`)
  
  return true
}

/**
 * 코인 자동 변동 일시 중단 (관리자용)
 * @param symbol 코인 심볼 (소문자)
 */
export function pausePriceFluctuation(symbol: string) {
  const normalizedSymbol = symbol.toLowerCase()
  const coin = getCoinBySymbol(normalizedSymbol)
  
  if (!coin) {
    console.error(`코인을 찾을 수 없습니다: ${normalizedSymbol}`)
    return false
  }
  
  pausedFluctuations.add(coin.id)
  
  // 중단 시 예약된 변동도 제거하여 즉시 변동이 발생하지 않도록 함
  if (nextPriceChanges.has(coin.id)) {
    const nextChange = nextPriceChanges.get(coin.id)!
    // 예약된 변동의 scheduledAt을 미래로 설정하여 실행되지 않도록 함
    nextChange.scheduledAt = Date.now() + 86400000 // 24시간 후로 설정
    nextPriceChanges.set(coin.id, nextChange)
  }
  
  console.log(`⏸️ 코인 자동 변동 일시 중단: ${coin.symbol}`)
  return true
}

/**
 * 코인 자동 변동 재개 (관리자용)
 * @param symbol 코인 심볼 (소문자)
 */
export function resumePriceFluctuation(symbol: string) {
  const normalizedSymbol = symbol.toLowerCase()
  const coin = getCoinBySymbol(normalizedSymbol)
  
  if (!coin) {
    console.error(`코인을 찾을 수 없습니다: ${normalizedSymbol}`)
    return false
  }
  
  pausedFluctuations.delete(coin.id)
  
  // 다음 변동 예약
  const nextChange = generateNextPriceChange(coin.id)
  nextPriceChanges.set(coin.id, nextChange)
  
  console.log(`▶️ 코인 자동 변동 재개: ${coin.symbol}`)
  return true
}

/**
 * 코인 자동 변동 중단 상태 확인
 * @param symbol 코인 심볼 (소문자)
 */
export function isPriceFluctuationPaused(symbol: string): boolean {
  const normalizedSymbol = symbol.toLowerCase()
  const coin = getCoinBySymbol(normalizedSymbol)
  
  if (!coin) {
    return false
  }
  
  return pausedFluctuations.has(coin.id)
}

/**
 * 특정 심볼의 코인 데이터 가져오기
 */
export function getCoinDataBySymbol(symbol: string) {
  const coin = getCoinBySymbol(symbol)
  if (!coin) return null
  return getCoinData(coin)
}

/**
 * 특정 ID의 코인 데이터 가져오기
 */
export function getCoinDataById(id: string) {
  const coin = getCoinById(id)
  if (!coin) return null
  return getCoinData(coin)
}

/**
 * 인기 코인 (상위 5개) 가져오기
 * 시가총액 기준으로 정렬하여 상위 5개 반환
 */
export function getPopularCoins() {
  // 모든 코인 데이터 가져오기
  const allCoins = getAllCoinsData()
  
  // 시가총액 기준으로 내림차순 정렬
  const sortedCoins = [...allCoins].sort((a, b) => b.marketCap - a.marketCap)
  
  // 상위 5개만 반환
  return sortedCoins.slice(0, 5)
}
