/* TraderAPK — Indian stock trading PWA (NSE / BSE).
 *
 * One link, one tap: open this page in Chrome on your tablet and "Add to Home
 * Screen" — it becomes an app icon, works offline, and needs no build step.
 *
 * Data: Yahoo Finance (.NS / .BO) when online, free and unofficial, can lag.
 * Demo mode: simulated prices so every button works without network.
 *
 * Nothing here ever touches a real broker — paper orders only. Not financial advice.
 */

(function () {
  // ---------------------------------------------------------------- config
  const CFG = {
    currency: "\u20B9", // ₹
    open: { h: 9, m: 15 }, close: { h: 15, m: 30 }, cutoff: "15:15", flatBy: "15:15",
    orMinutes: 15, intervalMs: 5 * 60 * 1000,
    defaultSymbols: "RELIANCE,TCS,HDFCBANK,INFY,ICICIBANK,SBIN,LT,AXISBANK,BHARTIARTL,KOTAKBANK,TATAMOTORS,MARUTI,SUNPHARMA,TITAN,NTPC",
    // NSE holidays 2026 (keep current for the year you trade)
    holidays: {
      "2026-01-26": "Republic Day", "2026-03-02": "Holi",
      "2026-03-30": "Ugadi / Gudi Padwa", "2026-04-02": "Ram Navami",
      "2026-04-10": "Mahavir Jayanti", "2026-04-14": "Dr Ambedkar Jayanti",
      "2026-05-01": "Maharashtra Day", "2026-08-15": "Independence Day",
      "2026-08-28": "Janmashtami", "2026-09-14": "Ganesh Chaturthi",
      "2026-10-02": "Gandhi Jayanti", "2026-10-21": "Diwali Laxmi Pujan",
      "2026-10-22": "Diwali Balipratipada", "2026-12-25": "Christmas",
    },
    // illustrative demo starting prices (Oct 2026 levels, NOT real quotes)
    demoStart: {
      "RELIANCE.NS": 2950, "TCS.NS": 4100, "HDFCBANK.NS": 1700, "INFY.NS": 1950,
      "ICICIBANK.NS": 1250, "SBIN.NS": 800, "LT.NS": 3500, "AXISBANK.NS": 1100,
      "BHARTIARTL.NS": 1600, "KOTAKBANK.NS": 1780, "TATAMOTORS.NS": 820,
      "MARUTI.NS": 11200, "SUNPHARMA.NS": 1750, "TITAN.NS": 3300,
      "NTPC.NS": 400, "RELIANCE.BO": 2950, "TCS.BO": 4100,
    },
  };

  // ---------------------------------------------------------------- state
  const ST = {
    demo: true,
    symbols: [],
    prices: {},    // sym -> {price, asOf, source}
    bars: {},      // sym -> [{t,o,h,l,c,v}]
    positions: {}, // sym -> {shares, avgPrice}
    orders: [],    // paper orders
    trades: [],    // fills
    alerts: [],    // {sym, type, level, label, fired}
    manual: {},    // user-entered override prices
  };

  // ---------------------------------------------------------------- time (IST)
  const OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // UTC+5:30
  function now() { return new Date(Date.now() + OFFSET_MS); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function fmtTime(d) { return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds()) + " IST"; }
  function isoDate(d) {
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }
  function midnight(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  function isClosedDay(d) {
    const w = d.getUTCDay(); // IST weekday (date object is already shifted)
    if (w >= 5) return true;
    return !!CFG.holidays[isoDate(d)];
  }
  function sessionBounds(dayMidnight) {
    const open = new Date(dayMidnight.getTime() + CFG.open.h * 3600 * 1000 + CFG.open.m * 60 * 1000);
    const close = new Date(dayMidnight.getTime() + CFG.close.h * 3600 * 1000 + CFG.close.m * 60 * 1000);
    return { open, close };
  }

  // ---------------------------------------------------------------- symbols
  function normSym(s) {
    s = String(s).trim().toUpperCase();
    if (!s) return s;
    if (!s.includes(".")) s = s + ".NS"; // default NSE
    return s;
  }
  function baseSym(s) { return s.replace(".NS", "").replace(".BO", ""); }

  // ---------------------------------------------------------------- data
  function parseYahoo(json, sym) {
    const res = json.chart && json.chart.result ? json.chart.result[0] : null;
    if (!res) throw new Error("no chart result");
    const meta = res.meta || {};
    const q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
    const ts = res.timestamp || [];
    const bars = [];
    const at = (key, i) => { const a = q[key] || []; return i < a.length ? a[i] : null; };
    for (let i = 0; i < ts.length; i++) {
      const c = at("close", i);
      if (ts[i] == null || c == null) continue;
      bars.push({
        t: ts[i],
        o: at("open", i) == null ? c : at("open", i),
        h: at("high", i) == null ? c : at("high", i),
        l: at("low", i) == null ? c : at("low", i),
        c: c,
        v: at("volume", i) == null ? 0 : at("volume", i),
      });
    }
    return {
      symbol: (meta.symbol || sym).replace("-", "."),
      bars,
      prevClose: meta.previousClose ?? meta.chartPreviousClose ?? null,
      dataTime: meta.regularMarketTime || null,
      exchange: meta.exchangeName || null,
    };
  }

  async function fetchYahoo(sym) {
    const s = normSym(sym);
    const errs = [];
    for (const host of ["query2", "query1"]) {
      try {
        const url = "https://" + host + ".finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(s) + "?range=1d&interval=5m";
        const r = await fetch(url, { mode: "cors", cache: "no-store" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const json = await r.json();
        return parseYahoo(json, s);
      } catch (e) { errs.push(host + ": " + e.message); }
    }
    throw new Error(errs.join("; "));
  }

  function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return h; }
  function demoBars(sym) {
    let seed = hashCode(sym);
    let price = CFG.demoStart[sym] || 2000;
    const rnd = () => { const x = Math.sin(seed++) * 10000; return x - Math.floor(x); };
    const bars = [];
    const day = midnight(now());
    const { open } = sessionBounds(day);
    let t = open.getTime();
    const close = new Date(day.getTime() + CFG.close.h * 3600 * 1000 + CFG.close.m * 60 * 1000);
    while (t < close.getTime()) {
      const change = (rnd() - 0.45) * 6; // slight upward drift for the demo
      price = Math.max(50, price + change);
      const o = price, c = Math.max(50, price + (rnd() - 0.5) * 4);
      const h = Math.max(o, c) + rnd() * 3;
      const l = Math.min(o, c) - rnd() * 3;
      bars.push({ t, o, h, l, c, v: Math.floor(50000 + rnd() * 200000) });
      price = c;
      t += CFG.intervalMs;
    }
    return bars;
  }

  async function getBars(sym) {
    const s = normSym(sym);
    if (ST.demo || ST.manual[s]) {
      const b = demoBars(s);
      ST.bars[s] = b;
      ST.prices[s] = { price: b[b.length - 1].c, asOf: now(), source: ST.manual[s] ? "manual" : "demo" };
      if (ST.manual[s]) ST.prices[s].price = ST.manual[s];
      return b;
    }
    try {
      const p = await fetchYahoo(s);
      ST.bars[s] = p.bars;
      const last = p.bars[p.bars.length - 1];
      ST.prices[s] = { price: last.c, asOf: new Date((p.dataTime || Date.now() - OFFSET_MS) + OFFSET_MS), source: "yahoo" };
      ST.demo = false;
      return p.bars;
    } catch (e) {
      ST.demo = true;
      const b = demoBars(s);
      ST.bars[s] = b;
      ST.prices[s] = { price: b[b.length - 1].c, asOf: now(), source: "demo" };
      return b;
    }
  }

  // ---------------------------------------------------------------- scanner logic
  function scanSymbol(sym) {
    const bars = ST.bars[sym];
    if (!bars || bars.length === 0) return { sym, status: "no-data", reason: "no bars" };
    const day = midnight(now());
    const { open, close } = sessionBounds(day);
    const orEnd = new Date(open.getTime() + CFG.orMinutes * 60 * 1000);
    const cutoff = new Date(day.getTime() + 15 * 3600 * 1000 + 15 * 60 * 1000); // 15:15
    const nowD = now();
    const todayBars = bars.filter((b) => {
      const dt = new Date(b.t);
      return dt >= open && dt < close;
    });
    const orBars = todayBars.filter((b) => new Date(b.t) < orEnd);
    const result = { sym, bars: todayBars, status: "waiting", phase: "", reason: "", level: null, trigger: null, last: null };
    if (isClosedDay(day)) {
      result.status = "no-data"; result.reason = "market closed today"; return result;
    }
    if (nowD < open) {
      result.status = "waiting"; result.phase = "pre-open";
      result.reason = "NSE opens at 09:15 IST; range set at " + fmtTime(orEnd);
      return result;
    }
    if (orBars.length === 0) {
      result.status = "no-data"; result.reason = "no opening-range bars yet";
      return result;
    }
    const high = Math.max(...orBars.map((b) => b.h));
    const low = Math.min(...orBars.map((b) => b.l));
    result.level = high;
    result.range = { high, low, minutes: CFG.orMinutes, bars: orBars.length };
    const last = todayBars[todayBars.length - 1];
    result.last = { barStart: fmtTime(new Date(last.t)).slice(0, 5), close: last.c };
    const trig = todayBars.find((b) => new Date(b.t) >= orEnd && new Date(b.t) <= cutoff && b.c > high);
    if (trig) {
      result.status = "triggered"; result.phase = nowD < close ? "open" : "after-close";
      result.trigger = { time: fmtTime(new Date(trig.t)).slice(0, 5), price: trig.c, pctOver: ((trig.c / high - 1) * 100).toFixed(2) };
      result.reason = result.trigger.time + " bar closed above range high " + CFG.currency + high.toFixed(2);
      return result;
    }
    if (nowD >= cutoff) {
      result.status = "expired"; result.phase = "after-cutoff";
      result.reason = "no breakout by 15:15 IST today";
      return result;
    }
    const gap = high - last.c;
    result.reason = last.c.toFixed(2) + " (" + (gap >= 0 ? gap.toFixed(2) : (-gap).toFixed(2)) + " " + (gap >= 0 ? "under" : "over") + " range high " + high.toFixed(2) + ", " + ((last.c / high - 1) * 100).toFixed(2) + "%)";
    return result;
  }

  // ---------------------------------------------------------------- exit / risk / broker
  function exitPlan(entry, rangeHigh, rangeLow) {
    const e = +entry, h = +rangeHigh, l = +rangeLow;
    const stop = (h + l) / 2;
    const risk = e - stop;
    const target = e + risk;
    return {
      entry: e, stop, target, riskPerShare: risk, rewardToRisk: 1,
      flatBy: CFG.flatBy,
      note: "Stop at range midpoint, target 1R above entry, flat by " + CFG.flatBy + " IST.",
    };
  }
  function sizePosition(cash, maxLoss, entry, stop) {
    const c = +cash, ml = +maxLoss, e = +entry, s = +stop;
    const risk = e - s;
    if (risk <= 0) return { blocked: true, reason: "stop must be below entry" };
    const shares = Math.floor(ml / risk);
    const cost = shares * e;
    return {
      shares, entry: e, stop: s, cost, maxLoss: shares * risk,
      cashRemaining: c - cost, blocked: cost > c,
      reason: cost > c ? "not enough cash for " + shares + " shares at " + e.toFixed(2) : "ok",
    };
  }
  function placeBuy(sym, shares, price, stop, target) {
    const order = {
      id: ST.orders.length + 1, sym, side: "BUY", shares, price: +price,
      stop: stop ? +stop : null, target: target ? +target : null,
      status: "OPEN", placedAt: fmtTime(now()),
    };
    ST.orders.push(order);
    ST.positions[sym] = { shares, avgPrice: +price };
    renderPositions();
  }
  function flattenPosition(sym, price) {
    const pos = ST.positions[sym];
    if (!pos || pos.shares <= 0) return null;
    const pnl = (+price - pos.avgPrice) * pos.shares;
    ST.trades.push({ sym, side: "SELL", shares: pos.shares, price: +price, pnl, at: fmtTime(now()) });
    ST.positions[sym] = { shares: 0, avgPrice: 0 };
    ST.orders.forEach((o) => { if (o.sym === sym) o.status = "FLATTED"; });
    return { sym, shares: pos.shares, price: +price, pnl };
  }

  // ---------------------------------------------------------------- alerts
  function addAlert(sym, type, level, label) {
    ST.alerts.push({ sym: normSym(sym), type, level: +level, label: label || type, fired: false });
    renderAlerts();
  }
  function checkAlerts() {
    const rings = [];
    const today = isoDate(now());
    const flatTime = new Date(midnight(now()).getTime() + 15 * 3600 * 1000 + 15 * 60 * 1000);
    for (const rule of ST.alerts) {
      if (rule.fired) continue;
      if (rule.date && rule.date !== today) continue;
      const p = ST.prices[rule.sym];
      if (!p) continue;
      let hit = false;
      if (rule.type === "stop" && p.price <= rule.level) hit = true;
      if (rule.type === "target" && p.price >= rule.level) hit = true;
      if (rule.type === "time" && now() >= flatTime) hit = true;
      if (hit) {
        rule.fired = true;
        const ring = Object.assign({}, rule, { price: p.price, at: fmtTime(now()) });
        ST.alertsRings = ST.alertsRings || [];
        ST.alertsRings.unshift(ring);
        rings.push(ring);
      }
    }
    if (rings.length) { renderAlerts(); showRings(); }
  }

  // ---------------------------------------------------------------- DOM helpers
  const $ = (id) => document.getElementById(id);
  function show(id) { $(id).classList.remove("hidden"); }
  function hide(id) { $(id).classList.add("hidden"); }
  function esc(t) { return String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }

  function setTab(name) {
    document.querySelectorAll(".tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === name);
      b.setAttribute("aria-selected", b.dataset.tab === name);
    });
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
  }
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

  function statusBadge(res) {
    const cls = { triggered: "triggered", waiting: "waiting", expired: "expired", "no-data": "no-data", error: "error" }[res.status] || "";
    return '<span class="status ' + cls + '">' + esc(res.status) + "</span>";
  }

  // ---------------------------------------------------------------- renders
  function renderClock() {
    const d = now();
    $("clock").textContent = fmtTime(d);
    const day = midnight(d);
    const closed = isClosedDay(day);
    const { open, close } = sessionBounds(day);
    const mkt = $("mkt");
    if (closed) {
      mkt.textContent = "market: closed today (" + (CFG.holidays[isoDate(day)] || "weekend") + ")";
      mkt.style.color = "#f5b7b1";
    } else if (d < open) {
      mkt.textContent = "market: pre-open (opens 09:15 IST)";
      mkt.style.color = "#ffe082";
    } else if (d < close) {
      mkt.textContent = "market: open (closes 15:30 IST)";
      mkt.style.color = "#a5f4a2";
    } else {
      mkt.textContent = "market: closed (session over)";
      mkt.style.color = "#8cc9c9";
    }
    $("kpi-session").textContent = closed ? "closed" : (d < open ? "pre-open" : d < close ? "open" : "closed");
    $("kpi-next").textContent = closed ? "next trading day" : d < open ? "09:15 IST open" : "15:30 IST close";
    $("kpi-mode").textContent = ST.demo ? "demo / simulated" : "live (Yahoo)";
  }

  function renderQuoteBox(sym) {
    const p = ST.prices[sym];
    if (!p) { $("quote-box").classList.add("hidden"); return; }
    const ch = CFG.currency;
    const prev = p.asOf ? " as of " + fmtTime(new Date(p.asOf)) : "";
    $("quote-detail").innerHTML =
      "<b>" + esc(baseSym(sym)) + "</b>  " + ch + p.price.toFixed(2) +
      "  <span class='muted small-note'>source: " + esc(p.source) + prev +
      "  · unofficial, can lag · verify with your broker</span>";
    // seed the planner fields from the last bar
    const bars = ST.bars[sym];
    if (bars) {
      const day = midnight(now());
      const { open, close } = sessionBounds(day);
      const todayBars = bars.filter((b) => { const dt = new Date(b.t); return dt >= open && dt < close; });
      const orBars = todayBars.filter((b) => new Date(b.t) < new Date(open.getTime() + CFG.orMinutes * 60 * 1000));
      if (orBars.length) {
        $("ep").value = todayBars[todayBars.length - 1].c.toFixed(2);
        $("rh").value = Math.max(...orBars.map((b) => b.h)).toFixed(2);
        $("rl").value = Math.min(...orBars.map((b) => b.l)).toFixed(2);
      }
    }
    show("quote-box");
  }

  function renderScan(results) {
    const list = $("scan-list");
    if (!results || results.length === 0) { list.innerHTML = "<div class='muted'>No results.</div>"; return; }
    list.innerHTML = results.map((res) => {
      const p = ST.prices[res.sym];
      const px = p ? CFG.currency + p.price.toFixed(2) : "\u2014";
      const lvl = res.level != null ? CFG.currency + res.level.toFixed(2) : "\u2014";
      const over = res.trigger ? " +<b>" + res.trigger.pctOver + "%</b> over range high" : "";
      return (
        "<div class='row'>" +
        "<div><b>" + esc(baseSym(res.sym)) + "</b><div class='small-note'>" + esc(res.reason) + (over ? " · " + over : "") + "</div></div>" +
        "<div>" + px + "</div>" +
        "<div>" + lvl + "</div>" +
        "<div>" + statusBadge(res) + "</div>" +
        "</div>"
      );
    }).join("");
  }

  function renderPlan(plan, sizing) {
    const box = $("plan-out");
    if (!plan) { hide("plan-out"); return; }
    const ch = CFG.currency;
    let html =
      "<div><b>Exit plan</b> — entry " + ch + plan.entry.toFixed(2) +
      ", stop " + ch + plan.stop.toFixed(2) +
      ", target " + ch + plan.target.toFixed(2) +
      " (risk " + ch + plan.riskPerShare.toFixed(2) + "/share · 1:1)</div>" +
      "<div>" + esc(plan.note) + " Flat by " + plan.flatBy + ".</div>";
    if (sizing) {
      html +=
        "<div style='margin-top:8px'><b>Position size</b> — " + sizing.shares + " shares · cost " +
        ch + sizing.cost.toFixed(2) + " · max loss " + ch + sizing.maxLoss.toFixed(2) +
        " · cash left " + ch + sizing.cashRemaining.toFixed(2) +
        (sizing.blocked ? " · <span style='color:#f5b7b1'><b>BLOCKED:</b> " + esc(sizing.reason) + "</span>" : "") +
        "</div>";
    }
    const btn = $("order-place");
    btn.style.display = sizing && !sizing.blocked ? "inline-block" : "none";
    btn.onclick = () => {
      const sym = normSym($("sym").value);
      placeBuy(sym, sizing.shares, plan.entry, plan.stop, plan.target);
      $("plan-out").innerHTML += "<div style='color:#a5f4a2'>Paper buy order placed for " + esc(baseSym(sym)) + " — not a real order.</div>";
      btn.disabled = true;
      btn.textContent = "Paper order placed";
    };
    show("plan-out");
  }

  function renderPositions() {
    const ch = CFG.currency;
    let posHtml = "<h3 style='font-size:.9rem;margin:0 0 6px'>Positions</h3>";
    const syms = Object.keys(ST.positions).filter((s) => ST.positions[s].shares > 0);
    if (syms.length === 0) posHtml += "<div class='muted'>No open positions.</div>";
    else posHtml += syms.map((s) => {
      const pos = ST.positions[s];
      const p = ST.prices[s];
      const px = p ? p.price : pos.avgPrice;
      const pnl = (px - pos.avgPrice) * pos.shares;
      return (
        "<div class='row'>" +
        "<div><b>" + esc(baseSym(s)) + "</b><div class='small-note'>" + pos.shares + " shares @ " + ch + pos.avgPrice.toFixed(2) + "</div></div>" +
        "<div>" + ch + px.toFixed(2) + "</div>" +
        "<div>" + ch + pnl.toFixed(2) + "</div>" +
        "</div>"
      );
    }).join("");
    $("pos-list").innerHTML = posHtml;
    let ordHtml = "<h3 style='font-size:.9rem;margin:0 0 6px'>Orders</h3>";
    if (ST.orders.length === 0) ordHtml += "<div class='muted'>No orders.</div>";
    else ordHtml += ST.orders.slice().reverse().map((o) => (
      "<div class='row'>" +
      "<div><b>" + esc(baseSym(o.sym)) + "</b> " + o.side + " " + o.shares + " @ " + ch + o.price.toFixed(2) +
      (o.stop ? " stop " + ch + o.stop.toFixed(2) : "") +
      (o.target ? " target " + ch + o.target.toFixed(2) : "") + "</div>" +
      "<div>" + o.status + "</div>" +
      "<div class='small-note'>" + esc(o.placedAt) + "</div>" +
      "</div>"
    )).join("");
    $("ord-list").innerHTML = ordHtml;
  }

  function renderAlerts() {
    const list = $("al-list");
    if (ST.alerts.length === 0) { list.innerHTML = "<div class='muted'>No alerts.</div>"; return; }
    list.innerHTML = ST.alerts.map((a) =>
      "<div class='row'>" +
      "<div><b>" + esc(baseSym(a.sym)) + "</b> " + a.type + " at " + CFG.currency + a.level.toFixed(2) + " (" + esc(a.label) + ")" + (a.fired ? " <b>· FIRED</b>" : "") + "</div>" +
      "<div class='small-note'>" + esc(a.fired ? a.at : "waiting") + "</div>" +
      "</div>"
    ).join("");
  }

  function showRings() {
    const box = $("al-ring");
    if (!ST.alertsRings || ST.alertsRings.length === 0) { hide("al-ring"); return; }
    const r = ST.alertsRings[0];
    box.innerHTML = "ALERT · " + esc(r.label) + " · " + esc(baseSym(r.sym)) + " hit " + CFG.currency + r.price.toFixed(2) + " at " + esc(r.at);
    show("al-ring");
  }

  // ---------------------------------------------------------------- actions
  async function runScan() {
    const btn = $("scan-run");
    btn.disabled = true; btn.textContent = "Scanning\u2026";
    const raw = ($("watchlist").value || CFG.defaultSymbols).split(",").map((s) => s.trim()).filter(Boolean);
    const results = [];
    for (const s of raw) {
      const sym = normSym(s);
      try {
        await getBars(sym);
        results.push(scanSymbol(sym));
      } catch (e) { results.push({ sym, status: "error", reason: e.message }); }
    }
    results.sort((a, b) => (b.trigger ? 1 : 0) - (a.trigger ? 1 : 0));
    ST.symbols = raw.map(normSym);
    renderScan(results);
    btn.disabled = false; btn.textContent = "Scan Nifty 50";
  }

  async function getQuote() {
    const sym = normSym($("sym").value);
    if (!sym) return;
    await getBars(sym);
    renderQuoteBox(sym);
    checkAlerts();
  }

  function buildPlan() {
    const sym = normSym($("sym").value);
    const entry = +$("ep").value, high = +$("rh").value, low = +$("rl").value;
    if (!entry || !high || !low || low >= entry) {
      $("plan-out").innerHTML = "<div style='color:#f5b7b1'>Enter valid numbers: entry above stop (range midpoint).</div>"; show("plan-out"); return;
    }
    const plan = exitPlan(entry, high, low);
    const cash = +$("cash").value || 0;
    const mloss = +$("mloss").value || 0;
    const sizing = sizePosition(cash, mloss, entry, plan.stop);
    renderPlan(plan, sizing);
  }

  // ---------------------------------------------------------------- init
  function init() {
    // settings defaults
    $("watchlist").value = CFG.defaultSymbols;
    $("demo-toggle").checked = ST.demo;
    $("max-trades").value = 5;
    $("max-day-loss").value = 2000;

    $("scan-run").addEventListener("click", runScan);
    $("quote-get").addEventListener("click", getQuote);
    $("plan-build").addEventListener("click", buildPlan);
    $("flat-go").addEventListener("click", () => {
      const sym = normSym($("flat-sym").value); const px = +$("flat-px").value;
      const r = flattenPosition(sym, px);
      if (r) {
        $("pos-list").innerHTML += "<div style='color:#a5f4a2'>Flattened " + esc(baseSym(sym)) + " · P&amp;L " + CFG.currency + r.pnl.toFixed(2) + "</div>";
        renderPositions();
      }
    });
    $("al-add").addEventListener("click", () => {
      addAlert($("al-sym").value, $("al-type").value, $("al-lvl").value, $("al-sym").value);
      $("al-sym").value = ""; $("al-lvl").value = "";
    });
    $("demo-toggle").addEventListener("change", (e) => { ST.demo = e.target.checked; $("kpi-mode").textContent = ST.demo ? "demo / simulated" : "live (Yahoo)"; });
    $("dismiss").addEventListener("click", () => hide("install"));

    setInterval(() => {
      renderClock();
      if (!ST.demo && ST.symbols.length) {
        ST.symbols.forEach((s) => { getBars(s).then(checkAlerts); });
      }
    }, 20000);

    setInterval(renderClock, 1000);
    renderClock();
    setTab("market");

    // PWA install hint
    let deferred;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault(); deferred = e;
      show("install");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
