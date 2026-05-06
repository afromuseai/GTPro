import { getAccount as getBinance,   getBaseUrl as binanceUrl   } from "./binance.js";
import { getAccount as getBybit,     getBaseUrl as bybitUrl     } from "./bybit.js";
import { getAccount as getOKX,       getBaseUrl as okxUrl       } from "./okx.js";
import { getAccount as getKraken,    getBaseUrl as krakenUrl    } from "./kraken.js";
import { getAccount as getKuCoin,    getBaseUrl as kucoinUrl    } from "./kucoin.js";
import { getAccount as getCoinbase,  getBaseUrl as coinbaseUrl  } from "./coinbase.js";
import { getAccount as getBitfinex,  getBaseUrl as bitfinexUrl  } from "./bitfinex.js";
import { getAccount as getGateIO,    getBaseUrl as gateioUrl    } from "./gateio.js";
import { getAccount as getMEXC,      getBaseUrl as mexcUrl      } from "./mexc.js";
import { getAccount as getDeribit,   getBaseUrl as deribitUrl   } from "./deribit.js";
import { getAccount as getPhemex,    getBaseUrl as phemexUrl    } from "./phemex.js";
import { getAccount as getBitMEX,    getBaseUrl as bitmexUrl    } from "./bitmex.js";
import { getAccount as getHuobi,     getBaseUrl as huobiUrl     } from "./huobi.js";
import { getAccount as getGemini,    getBaseUrl as geminiUrl    } from "./gemini.js";

export interface ExchangeConfig {
  apiKey:      string;
  apiSecret:   string;
  passphrase?: string;
  baseUrl:     string;
}

export interface AccountBalance {
  availableBalance:   string;
  totalWalletBalance: string;
}

export type ExchangeId =
  | "Binance" | "Bybit" | "OKX" | "Kraken" | "Coinbase"
  | "KuCoin" | "Bitfinex" | "Gate.io" | "MEXC" | "Deribit"
  | "Phemex" | "BitMEX" | "Huobi" | "Gemini";

export const EXCHANGES_REQUIRING_PASSPHRASE: ExchangeId[] = ["OKX", "KuCoin", "Coinbase"];

interface ExchangeMeta {
  getAccount: (cfg: ExchangeConfig) => Promise<AccountBalance>;
  getBaseUrl:  (testnet: boolean) => string;
}

const REGISTRY: Record<ExchangeId, ExchangeMeta> = {
  "Binance":  { getAccount: c => getBinance({ apiKey: c.apiKey, apiSecret: c.apiSecret, baseUrl: c.baseUrl }),    getBaseUrl: binanceUrl  },
  "Bybit":    { getAccount: c => getBybit(c),                                                                     getBaseUrl: bybitUrl    },
  "OKX":      { getAccount: c => getOKX({ ...c, passphrase: c.passphrase ?? "" }),                               getBaseUrl: okxUrl      },
  "Kraken":   { getAccount: c => getKraken(c),                                                                    getBaseUrl: krakenUrl   },
  "Coinbase": { getAccount: c => getCoinbase({ ...c, passphrase: c.passphrase ?? "" }),                           getBaseUrl: coinbaseUrl },
  "KuCoin":   { getAccount: c => getKuCoin({ ...c, passphrase: c.passphrase ?? "" }),                            getBaseUrl: kucoinUrl   },
  "Bitfinex": { getAccount: c => getBitfinex(c),                                                                  getBaseUrl: bitfinexUrl },
  "Gate.io":  { getAccount: c => getGateIO(c),                                                                    getBaseUrl: gateioUrl   },
  "MEXC":     { getAccount: c => getMEXC(c),                                                                      getBaseUrl: mexcUrl     },
  "Deribit":  { getAccount: c => getDeribit(c),                                                                   getBaseUrl: deribitUrl  },
  "Phemex":   { getAccount: c => getPhemex(c),                                                                    getBaseUrl: phemexUrl   },
  "BitMEX":   { getAccount: c => getBitMEX(c),                                                                    getBaseUrl: bitmexUrl   },
  "Huobi":    { getAccount: c => getHuobi(c),                                                                     getBaseUrl: huobiUrl    },
  "Gemini":   { getAccount: c => getGemini(c),                                                                    getBaseUrl: geminiUrl   },
};

export function getExchangeAdapter(exchange: string): ExchangeMeta | null {
  return REGISTRY[exchange as ExchangeId] ?? null;
}

export function isKnownExchange(exchange: string): exchange is ExchangeId {
  return exchange in REGISTRY;
}
