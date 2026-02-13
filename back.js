import express from 'express';
import cors from 'cors';
import NodeCache from 'node-cache';

const app = express();
const cache = new NodeCache({ stdTTL: 30 }); // 缓存30秒

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ============ Yahoo Finance 直接访问（绕过 yahoo-finance2 库的 crumb 问题） ============

let crumb = null;
let cookieStr = null;

// 获取 cookie 和 crumb
async function initCrumb() {
  try {
    // Step 1: 获取 cookie
    const consentResp = await fetch('https://fc.yahoo.com', { redirect: 'manual' });
    const setCookies = consentResp.headers.getSetCookie ? consentResp.headers.getSetCookie() : [];
    cookieStr = setCookies.map(c => c.split(';')[0]).join('; ');

    // Step 2: 获取 crumb
    const crumbResp = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'Cookie': cookieStr, 'User-Agent': 'Mozilla/5.0' }
    });
    if (!crumbResp.ok) throw new Error(`Crumb request failed: ${crumbResp.status}`);
    crumb = await crumbResp.text();
    console.log('Yahoo Finance crumb acquired successfully');
    return true;
  } catch (err) {
    console.error('Failed to get crumb:', err.message);
    return false;
  }
}

// 通过 Yahoo v8 API 获取行情
async function fetchQuote(symbol) {
  if (!crumb || !cookieStr) {
    const ok = await initCrumb();
    if (!ok) throw new Error('Cannot acquire Yahoo Finance crumb');
  }

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d&crumb=${encodeURIComponent(crumb)}`;
  const resp = await fetch(url, {
    headers: { 'Cookie': cookieStr, 'User-Agent': 'Mozilla/5.0' }
  });

  if (resp.status === 401 || resp.status === 403) {
    // crumb 过期，重新获取
    console.log('Crumb expired, refreshing...');
    await initCrumb();
    return fetchQuote(symbol); // 重试一次
  }

  if (!resp.ok) throw new Error(`Yahoo API error ${resp.status}`);
  const json = await resp.json();
  const result = json.chart.result[0];
  const meta = result.meta;
  const quote = result.indicators.quote[0];

  const prevClose = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;

  return {
    price: meta.regularMarketPrice,
    change: meta.regularMarketPrice - prevClose,
    changePercent: ((meta.regularMarketPrice - prevClose) / prevClose) * 100,
    high: meta.regularMarketDayHigh || (quote.high ? Math.max(...quote.high.filter(Boolean)) : meta.regularMarketPrice),
    low: meta.regularMarketDayLow || (quote.low ? Math.min(...quote.low.filter(Boolean)) : meta.regularMarketPrice),
    open: quote.open ? quote.open.find(Boolean) : meta.regularMarketPrice,
    previousClose: prevClose,
    isUp: meta.regularMarketPrice >= prevClose,
    timestamp: new Date().toISOString()
  };
}

// 获取历史图表数据
async function fetchHistory(symbol, range = '1d') {
  const cacheKey = `chart_${symbol}_${range}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  if (!crumb || !cookieStr) {
    const ok = await initCrumb();
    if (!ok) throw new Error('Cannot acquire Yahoo Finance crumb');
  }

  // 映射时间范围到 Yahoo API 参数
  // range: 1d, 5d, 1mo, 3mo, 6mo, 1y
  // interval: 5m, 15m, 30m, 60m, 1d, 1wk, 1mo
  let interval = '1d';
  if (range === '1d') interval = '5m';
  else if (range === '5d') interval = '15m';

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&crumb=${encodeURIComponent(crumb)}`;
  const resp = await fetch(url, {
    headers: { 'Cookie': cookieStr, 'User-Agent': 'Mozilla/5.0' }
  });

  if (!resp.ok) throw new Error(`Yahoo Chart API error ${resp.status}`);
  const json = await resp.json();
  const result = json.chart.result[0];
  const timestamps = result.timestamp || [];
  const prices = result.indicators.quote[0].close || [];

  // 清洗数据，过滤 null
  const history = timestamps.map((t, i) => ({
    time: t,
    price: prices[i]
  })).filter(h => h.price !== null);

  cache.set(cacheKey, history, 60); // 历史数据缓存60秒
  return history;
}

// ============ API Routes ============

// 单个行情
app.get('/api/quote/:symbol', async (req, res) => {
  const { symbol } = req.params;

  const cached = cache.get(symbol);
  if (cached) return res.json(cached);

  try {
    const data = await fetchQuote(symbol);
    cache.set(symbol, data);
    res.json(data);
  } catch (error) {
    console.error(`Quote error [${symbol}]:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// 批量行情
app.post('/api/batch', async (req, res) => {
  const symbols = req.body && req.body.symbols;
  if (!Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({ error: 'symbols must be a non-empty array' });
  }

  try {
    const results = {};
    // 并行获取，每个失败不影响其他
    const promises = symbols.map(async (symbol) => {
      try {
        const cached = cache.get(symbol);
        if (cached) {
          results[symbol] = cached;
          return;
        }

        const data = await fetchQuote(symbol);
        cache.set(symbol, data);
        results[symbol] = data;
      } catch (err) {
        console.error(`Batch item error [${symbol}]:`, err.message);
        results[symbol] = { error: err.message };
      }
    });

    await Promise.all(promises);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 历史数据
app.get('/api/history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { range } = req.query; // 1d, 5d, 1mo, 3mo, 6mo, 1y

  try {
    const data = await fetchHistory(symbol, range || '1d');
    res.json(data);
  } catch (error) {
    console.error(`History error [${symbol}]:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============ Start ============

// 启动时预获取 crumb
initCrumb().then(() => {
  app.listen(3002, () => console.log('Server running on port 3002'));
});
