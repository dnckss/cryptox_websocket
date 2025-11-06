/**
 * 모의 코인 데이터 관리
 * cryptoX 전용 100개 코인 데이터
 * 가격 범위: 0.001원 ~ 2억원 (골고루 분포)
 */

export interface MockCoin {
  id: string
  name: string
  symbol: string
  basePrice: number // 기본 가격 (원화)
  volatility: number // 변동성 (0~1, 높을수록 변동이 큼)
  marketCapBase: number // 시가총액 기본값
  volumeBase: number // 거래량 기본값
  description?: string
}

/**
 * 로그 스케일로 가격 생성 (0.001 ~ 200,000,000)
 * 100개 코인을 균등하게 분포
 */
function generateDistributedPrices(): number[] {
  const prices: number[] = []
  const minPrice = 0.001
  const maxPrice = 200_000_000
  
  // 로그 스케일로 균등 분포
  const logMin = Math.log10(minPrice)
  const logMax = Math.log10(maxPrice)
  const logRange = logMax - logMin
  
  // 100개 코인을 균등하게 분포
  for (let i = 0; i < 100; i++) {
    const ratio = i / 99 // 0 ~ 1
    const logPrice = logMin + (logRange * ratio)
    const price = Math.pow(10, logPrice)
    prices.push(price)
  }
  
  return prices
}

// 분포된 가격 배열 생성
const DISTRIBUTED_PRICES = generateDistributedPrices()

// 코인 이름과 심볼 (100개)
const COIN_NAMES = [
  "CryptoX Token", "BitX", "EtherX", "SolaX", "AdaX", "MaticX", "DotX", "AvaX", "LinkX", "UniX",
  "AtomX", "NearX", "AlgoX", "TezX", "FileX", "ICPX", "AptX", "SuiX", "ArbX", "OpX",
  "ManaX", "SandX", "AxsX", "EnjX", "ChzX", "FlowX", "ThetaX", "EosX", "TronX", "RippleX",
  "DogeX", "ShibX", "PepeX", "FlokiX", "WifX", "BonkX", "LunaCX", "LunaX", "LoopX", "ImmutX",
  "GraphX", "AaveX", "MakerX", "SynthX", "CompX", "CurveX", "YearnX", "1inchX", "BalX", "SushiX",
  "CakeX", "BakeX", "BNBX", "FantomX", "HarmonyX", "RoseX", "CeloX", "KlayX", "WavesX", "ZilliqaX",
  "VeChainX", "HederaX", "IotaX", "NanoX", "StellarX", "MoneroX", "ZcashX", "DashX", "LitecoinX", "BitcoinCashX",
  "BitcoinSVX", "EthereumClassicX", "HorizenX", "RavencoinX", "SiacoinX", "BasicAttnX", "0xX", "OMGX", "KyberX", "AugurX",
  "GnosisX", "StorjX", "GolemX", "AragonX", "BancorX", "RenX", "KeepX", "NuCypherX", "LivepeerX", "BandX",
  "AmpX", "OrchidX", "District0xX", "iExecX", "UMAX", "EnzymeX", "MetaX", "GameX", "SocialX", "DeFiX",
  "LayerX", "BridgeX", "SwapX", "FarmX", "StakeX", "VaultX", "PoolX", "LendX", "BorrowX", "YieldX"
]

const COIN_SYMBOLS = [
  "CXT", "BTX", "ETHX", "SOLX", "ADAX", "MATICX", "DOTX", "AVAXX", "LINKX", "UNIX",
  "ATOMX", "NEARX", "ALGOX", "XTZX", "FILX", "ICPX", "APTX", "SUIX", "ARBX", "OPX",
  "MANAX", "SANDX", "AXSX", "ENJX", "CHZX", "FLOWX", "THETAX", "EOSX", "TRXX", "XRPX",
  "DOGEX", "SHIBX", "PEPEX", "FLOKIX", "WIFX", "BONKX", "LUNCX", "LUNAX", "LRCX", "IMXX",
  "GRTX", "AAVEX", "MKRX", "SNXX", "COMPX", "CRVX", "YFIX", "1INCHX", "BALX", "SUSHIX",
  "CAKEX", "BAKEX", "BNBX", "FTMX", "ONEX", "ROSEX", "CELOX", "KLAYX", "WAVESX", "ZILX",
  "VETX", "HBARX", "IOTAX", "NANOX", "XLMX", "XMRX", "ZECX", "DASHX", "LTCX", "BCHX",
  "BSVX", "ETCX", "ZENX", "RVNX", "SCX", "BATX", "ZRXX", "OMGX", "KNCX", "REPX",
  "GNOX", "STORJX", "GNTX", "ANTX", "BNTX", "RENX", "KEEPX", "NUX", "LPTX", "BANDX",
  "AMPX", "OXTX", "DNTX", "RLCX", "UMAX", "MLNX", "METAX", "GAMEX", "SOCIALX", "DEFIX",
  "LAYERX", "BRIDGEX", "SWAPX", "FARMX", "STAKEX", "VAULTX", "POOLX", "LENDX", "BORROWX", "YIELDX"
]

// cryptoX 전용 100개 코인 정의
export const COIN_DEFINITIONS: MockCoin[] = DISTRIBUTED_PRICES.map((price, index) => {
  // 변동성은 가격대에 따라 조정 (저가 코인일수록 변동성이 높음)
  const volatility = price < 1 
    ? 0.35 + (Math.random() * 0.15) // 0.35 ~ 0.50 (저가 코인)
    : price < 1000
    ? 0.25 + (Math.random() * 0.10) // 0.25 ~ 0.35 (중저가 코인)
    : price < 100000
    ? 0.15 + (Math.random() * 0.10) // 0.15 ~ 0.25 (중가 코인)
    : 0.10 + (Math.random() * 0.10) // 0.10 ~ 0.20 (고가 코인)
  
  // 시가총액과 거래량은 가격에 비례하도록 계산
  // 시가총액 = 가격 * 공급량 (공급량은 가격대별로 다르게)
  const supply = price < 1 
    ? 1_000_000_000_000 // 저가 코인: 큰 공급량
    : price < 1000
    ? 100_000_000_000 // 중저가: 중간 공급량
    : price < 100000
    ? 1_000_000_000 // 중가: 작은 공급량
    : 100_000_000 // 고가: 매우 작은 공급량
  
  const marketCapBase = price * supply
  const volumeBase = marketCapBase * (0.01 + Math.random() * 0.05) // 시가총액의 1~6%
  
  return {
    id: `coin-${index + 1}`,
    name: COIN_NAMES[index] || `Coin ${index + 1}`,
    symbol: COIN_SYMBOLS[index] || `COIN${index + 1}`,
    basePrice: price,
    volatility: parseFloat(volatility.toFixed(2)),
    marketCapBase: Math.round(marketCapBase),
    volumeBase: Math.round(volumeBase),
  }
})

/**
 * 시드 기반 랜덤 생성기 (같은 코인은 항상 같은 패턴)
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
 * 현재 시간을 기반으로 가격 변동 계산
 * @param coin 코인 정의
 * @param basePrice 현재 저장된 가격 (없으면 basePrice 사용)
 * @returns 새로운 가격과 등락률
 */
export function calculatePriceChange(
  coin: MockCoin,
  basePrice?: number
): { price: number; change1h: number; change1d: number; change1w: number } {
  const currentPrice = basePrice || coin.basePrice
  const seed = coin.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  // 시간 기반 시드 (1초마다 약간의 변동)
  const timeSeed = Math.floor(Date.now() / 1000) // 1초마다 변경
  const random = new SeededRandom(seed + timeSeed)

  // 변동성에 따른 가격 변동
  const volatility = coin.volatility
  
  // 1시간 변동 (-volatility * 2% ~ +volatility * 2%)
  // 작은 변동으로 자연스러운 움직임
  const change1h = (random.next() - 0.5) * volatility * 2
  
  // 1일 변동 (1시간 변동의 누적, 더 큰 변동 범위)
  const change1d = (random.next() - 0.5) * volatility * 15
  
  // 1주 변동 (더 큰 변동)
  const change1w = (random.next() - 0.5) * volatility * 35

  // 새로운 가격 계산 (작은 변동으로 자연스러운 움직임)
  const priceChange = (random.next() - 0.5) * volatility * 0.5 // 매우 작은 변동
  const newPrice = currentPrice * (1 + priceChange / 100)
  
  // 최소 가격 제한 (0.001원 이하로 떨어지지 않도록)
  const minPrice = 0.001
  const finalPrice = Math.max(newPrice, minPrice)
  
  return {
    price: finalPrice,
    change1h: parseFloat(change1h.toFixed(2)),
    change1d: parseFloat(change1d.toFixed(2)),
    change1w: parseFloat(change1w.toFixed(2)),
  }
}

/**
 * 코인 심볼로 코인 정의 찾기
 */
export function getCoinBySymbol(symbol: string): MockCoin | undefined {
  return COIN_DEFINITIONS.find(coin => coin.symbol.toLowerCase() === symbol.toLowerCase())
}

/**
 * 코인 ID로 코인 정의 찾기
 */
export function getCoinById(id: string): MockCoin | undefined {
  return COIN_DEFINITIONS.find(coin => coin.id === id)
}
