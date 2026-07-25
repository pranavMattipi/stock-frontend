import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './index.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://stock-backend-kappa.vercel.app/api';

// ── Generate multiples of 50 for Max Risk dropdown ──────────────────
const MAX_RISK_OPTIONS = (() => {
  const opts = [];
  for (let v = 50; v <= 100000; v += 50) opts.push(v);
  return opts;
})();

function App() {
  // Initialize state from localStorage so refreshing the page preserves user inputs & result
  const [maxRisk, setMaxRisk] = useState(() => localStorage.getItem('stockcalc_maxRisk') || '');
  const [entryPrice, setEntryPrice] = useState(() => localStorage.getItem('stockcalc_entryPrice') || '');
  const [stopLossPrice, setStopLossPrice] = useState(() => localStorage.getItem('stockcalc_stopLossPrice') || '');
  const [result, setResult] = useState(() => {
    const saved = localStorage.getItem('stockcalc_result');
    return saved ? JSON.parse(saved) : null;
  });

  const [error, setError]                   = useState('');
  const [loading, setLoading]               = useState(false);
  const [history, setHistory]               = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [clearLoading, setClearLoading]     = useState(false);

  // Sync state changes to localStorage
  useEffect(() => {
    localStorage.setItem('stockcalc_maxRisk', maxRisk);
  }, [maxRisk]);

  useEffect(() => {
    localStorage.setItem('stockcalc_entryPrice', entryPrice);
  }, [entryPrice]);

  useEffect(() => {
    localStorage.setItem('stockcalc_stopLossPrice', stopLossPrice);
  }, [stopLossPrice]);

  useEffect(() => {
    if (result) {
      localStorage.setItem('stockcalc_result', JSON.stringify(result));
    } else {
      localStorage.removeItem('stockcalc_result');
    }
  }, [result]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/history`);
      const data = await res.json();
      if (data.success) setHistory(data.history);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleCalculate = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!maxRisk || !entryPrice || !stopLossPrice) {
      setError('Please fill in all three fields.');
      return;
    }

    const ep = parseFloat(entryPrice);
    const sl = parseFloat(stopLossPrice);
    if (ep === sl) {
      setError('Entry Price and Stop-loss Price cannot be the same.');
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxRisk:       parseFloat(maxRisk),
          entryPrice:    ep,
          stopLossPrice: sl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        setResult(data);
        fetchHistory();
      }
    } catch {
      setError('Cannot connect to the server. Make sure the backend is running on port 8000.');
    } finally { setLoading(false); }
  };

  const handleClearHistory = async () => {
    setClearLoading(true);
    try {
      await fetch(`${API_BASE}/history`, { method: 'DELETE' });
      setHistory([]);
    } catch { /* silent */ }
    finally { setClearLoading(false); }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const formatINR = (num) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 2,
    }).format(num);

  // Live risk per share preview
  const liveRiskPerShare = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const sl = parseFloat(stopLossPrice);
    if (!isNaN(ep) && !isNaN(sl) && ep !== sl) return Math.abs(ep - sl);
    return null;
  }, [entryPrice, stopLossPrice]);

  const isLong = parseFloat(stopLossPrice) < parseFloat(entryPrice);

  return (
    <div className="app">

      {/* ── HEADER ─────────────────────────────────── */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">📈</div>
            <span className="logo-text">StockCalc</span>
          </div>
          <div className="header-badge">Position Sizer</div>
        </div>
      </header>

      <main className="main">

        {/* ── CALCULATOR + RESULT GRID (TOP) ────────── */}
        <div className="grid">

          {/* ── LEFT: Enter Variables ── */}
          <div className="card">
            <h2 className="card-title">
              <span className="icon">🧮</span> Enter Variables
            </h2>
            <p className="card-subtitle">
              Fill in the values below to calculate the ideal quantity for your trade.
            </p>

            <form className="form" onSubmit={handleCalculate}>

              {/* MAX RISK dropdown */}
              <div className="field">
                <label htmlFor="maxRisk">
                  <span className="label-icon">🎯</span> Maximum ₹ Risk
                </label>
                <div className="select-wrap">
                  <span className="select-prefix">₹</span>
                  <select
                    id="maxRisk"
                    value={maxRisk}
                    onChange={(e) => setMaxRisk(e.target.value)}
                    className={`styled-select ${error && !maxRisk ? 'error-border' : ''}`}
                  >
                    <option value="">— Select amount —</option>
                    {MAX_RISK_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        ₹{v.toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                  <span className="select-arrow">▾</span>
                </div>
              </div>

              {/* ENTRY PRICE input */}
              <div className="field">
                <label htmlFor="entryPrice">
                  <span className="label-icon">📥</span> Entry Price
                </label>
                <div className="input-wrap">
                  <span className="currency-prefix">₹</span>
                  <input
                    id="entryPrice"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 3168"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className={error && !entryPrice ? 'error-border' : ''}
                  />
                </div>
              </div>

              {/* STOP-LOSS PRICE input */}
              <div className="field">
                <label htmlFor="stopLossPrice">
                  <span className="label-icon">🛑</span> Stop-loss Price
                </label>
                <div className="input-wrap">
                  <span className="currency-prefix">₹</span>
                  <input
                    id="stopLossPrice"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 3158"
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(e.target.value)}
                    className={error && !stopLossPrice ? 'error-border' : ''}
                  />
                </div>

                {liveRiskPerShare !== null && (
                  <div className="sl-preview">
                    Risk per share:&nbsp;
                    <strong>{formatINR(liveRiskPerShare)}</strong>
                    &nbsp;·&nbsp;
                    {isLong
                      ? <span className="tag-long">LONG</span>
                      : <span className="tag-short">SHORT</span>}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="error-msg">
                  <span className="err-icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                id="btn-calculate"
                type="submit"
                className="btn-calculate"
                disabled={loading}
              >
                {loading ? (
                  <span className="btn-loading">
                    <span className="spinner"></span> Calculating...
                  </span>
                ) : (
                  '⚡ Calculate Quantity'
                )}
              </button>
            </form>
          </div>

          {/* ── RIGHT: Result ── */}
          <div className={`result-panel ${result ? 'has-result' : ''}`}>
            <div>
              <h2 className="card-title">
                <span className="icon">📊</span> Result
              </h2>
              <p className="card-subtitle">Your calculated position size will appear here.</p>
            </div>

            {!result ? (
              <div className="result-empty">
                <div className="result-empty-icon">📉</div>
                <p>Enter your values and click Calculate</p>
              </div>
            ) : (
              <>
                <div className="result-main">
                  <div className="result-label">OPTIMAL QUANTITY</div>
                  <div className="quantity-value">{result.quantityRounded}</div>
                  <div className="quantity-unit">
                    shares (floored) · {result.quantity} exact
                  </div>
                </div>

                <div className="result-stats">
                  <div className="stat-chip green">
                    <div className="stat-label">Max Risk</div>
                    <div className="stat-value">{formatINR(result.inputs.maxRisk)}</div>
                  </div>
                  <div className="stat-chip blue">
                    <div className="stat-label">Entry</div>
                    <div className="stat-value">{formatINR(result.inputs.entryPrice)}</div>
                  </div>
                  <div className="stat-chip red">
                    <div className="stat-label">Stop Loss</div>
                    <div className="stat-value">{formatINR(result.inputs.stopLossPrice)}</div>
                  </div>
                </div>

                <div className="result-note">
                  💡 Risk per share = {formatINR(result.riskPerShare)}
                  &nbsp;·&nbsp;
                  Total investment = {formatINR(result.quantityRounded * result.inputs.entryPrice)}
                </div>

                {/* Formula replay */}
                <div className="result-formula">
                  <span className="rf-label">Calculation</span>
                  <span className="rf-expr">
                    ⌊ {formatINR(result.inputs.maxRisk)} ÷ |{formatINR(result.inputs.entryPrice)} − {formatINR(result.inputs.stopLossPrice)}| ⌋
                    &nbsp;=&nbsp;⌊ {result.quantity} ⌋&nbsp;=&nbsp;<strong>{result.quantityRounded}</strong>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ── HISTORY (full width) ── */}
          <div className="history-section">
            <div className="history-header">
              <h3 className="section-title">
                🕐 Calculation History
                {historyLoading && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    &nbsp;Loading...
                  </span>
                )}
              </h3>
              {history.length > 0 && (
                <button
                  id="btn-clear-history"
                  className="btn-clear"
                  onClick={handleClearHistory}
                  disabled={clearLoading}
                >
                  {clearLoading ? 'Clearing...' : '🗑 Clear All'}
                </button>
              )}
            </div>

            <div className="history-table-wrap">
              {history.length === 0 ? (
                <div className="empty-history">
                  No calculations yet. Your history will appear here.
                </div>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Max Risk (₹)</th>
                      <th>Entry Price (₹)</th>
                      <th>Stop-loss (₹)</th>
                      <th>|Diff|</th>
                      <th>Quantity</th>
                      <th>Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item, i) => (
                      <tr key={item._id || i}>
                        <td>{i + 1}</td>
                        <td>{formatINR(item.maxRisk)}</td>
                        <td>{formatINR(item.entryPrice)}</td>
                        <td>{formatINR(item.stopLossPrice)}</td>
                        <td>{formatINR(Math.abs(item.entryPrice - item.stopLossPrice))}</td>
                        <td className="td-qty">{Math.floor(item.quantity)}</td>
                        <td className="td-time">{formatDate(item.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* ── FOOTER ─────────────────────────────────── */}
      <footer className="footer">
        Built with <span>MERN Stack</span> · Stock Quantity Calculator · Risk Management Tool
      </footer>
    </div>
  );
}

export default App;
