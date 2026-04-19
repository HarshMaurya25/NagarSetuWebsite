import React, { useState, useEffect, useRef } from 'react';
import { 
  trainMlModel, 
  trainSynthetic, 
  getMlForecast, 
  getMlHistorical, 
  getMlStats, 
  getMlStatus, 
  trainAllMlModels 
} from '../../services/api';
import { getToken, getUser } from '../../lib/session';
import { 
  Chart, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler, 
  LineController,
  BarController,
  ArcElement,
  DoughnutController
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import './AdminMlPredictions.css';

// Register Chart.js components
Chart.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  Title, 
  Tooltip, 
  Legend, 
  Filler, 
  LineController,
  BarController,
  ArcElement,
  DoughnutController,
  annotationPlugin
);

const THEME_COLORS = {
  primary: "#1a365d",
  secondary: "#2563eb",
  tertiary: "#18355a",
  outline: "#757684",
  grid: "rgba(0, 40, 142, 0.05)",
};

const TYPE_COLORS = {
  ROAD: { bg: "rgba(239, 68, 68, 0.7)", border: "#ef4444" },
  WATER: { bg: "rgba(59, 130, 246, 0.7)", border: "#3b82f6" },
  GARBAGE: { bg: "rgba(16, 185, 129, 0.7)", border: "#10b981" },
  VEHICLE: { bg: "rgba(245, 158, 11, 0.7)", border: "#f59e0b" },
  STREETLIGHT: { bg: "rgba(168, 85, 247, 0.7)", border: "#a855f7" },
  OTHER: { bg: "rgba(100, 116, 139, 0.7)", border: "#64748b" },
};

export default function AdminMlPredictions() {
  const [isReady, setIsReady] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const [error, setError] = useState(null);
  
  // Data States
  const [loginData, setLoginData] = useState(null);
  const [stats, setStats] = useState({});
  const [historical, setHistorical] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [mlStatus, setMlStatus] = useState({});
  const [isTrainingAll, setIsTrainingAll] = useState(false);

  // Chart Refs
  const chartRefs = {
    forecast: useRef(null),
    type: useRef(null),
    typeForecast: useRef(null),
    dow: useRef(null),
    cumulative: useRef(null),
  };
  const instances = useRef({});

  // 1. Auto-Login / Sync on Mount
  useEffect(() => {
    autoSync();
    return () => {
      Object.keys(instances.current).forEach(destroyChart);
    };
  }, []);

  const autoSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No active session found. Please login to the portal first.");
      }
      
      const user = getUser();
      const adminName = user?.fullName || "Admin";

      // Authenticate with ML service using existing token
      const data = await trainMlModel(token, adminName, false);
      
      // Load Dashboard Data
      const [forecastRes, historicalRes, statsRes, statusRes] = await Promise.all([
        getMlForecast(),
        getMlHistorical(),
        getMlStats(),
        getMlStatus().catch(() => ({ results: {} }))
      ]);

      setLoginData(data);
      setHistorical(historicalRes);
      setForecast(forecastRes);
      setStats(statsRes);
      setMlStatus(statusRes.results || {});
      setIsReady(true);
    } catch (err) {
      console.error("AutoSync Error:", err);
      setError(err.message || "Failed to sync with ML service.");
    } finally {
      setSyncing(false);
    }
  };

  const destroyChart = (id) => {
    if (instances.current[id]) {
      instances.current[id].destroy();
      delete instances.current[id];
    }
  };

  const trainAllModels = async () => {
    setIsTrainingAll(true);
    try {
      const data = await trainAllMlModels();
      setMlStatus(data.results || {});
    } catch (err) {
      setError("Training failed: " + err.message);
    } finally {
      setIsTrainingAll(false);
    }
  };

  // 2. Chart Rendering Effect
  useEffect(() => {
    if (isReady && historical && forecast) {
      renderForecastChart();
      renderTypeBreakdown();
      renderTypeForecast();
      renderDOWChart();
      renderCumulativeChart();
    }
  }, [isReady, historical, forecast]);

  /* ═══════════ CHART RENDERERS ═══════════ */

  const renderForecastChart = () => {
    destroyChart("forecast");
    const hist = historical;
    const fore = forecast;

    let hDates = hist.dates, hCounts = hist.counts, hTrend = hist.trend;
    const MAX_HIST = 90;
    if (hDates.length > MAX_HIST) {
      const start = hDates.length - MAX_HIST;
      hDates = hDates.slice(start);
      hCounts = hCounts.slice(start);
      hTrend = hTrend.slice(start);
    }

    const allDates = [...hDates, ...fore.dates];
    const allLabels = allDates.map(d => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }));

    const ctx = chartRefs.forecast.current.getContext("2d");
    instances.current.forecast = new Chart(ctx, {
      type: "line",
      data: {
        labels: allLabels,
        datasets: [
          {
            label: "Actual Volume",
            data: [...hCounts, ...Array(fore.dates.length).fill(null)],
            borderColor: THEME_COLORS.primary,
            backgroundColor: "rgba(26, 54, 93, 0.05)",
            borderWidth: 2,
            pointRadius: 1,
            fill: true,
            tension: 0.3,
            order: 2,
          },
          {
            label: "Predictive Trend",
            data: [...hTrend, ...Array(fore.dates.length).fill(null)],
            borderColor: "#6366f1",
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0.4,
            order: 3,
          },
          {
            label: "Volume Forecast",
            data: [...Array(hDates.length).fill(null), ...fore.predicted],
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.05)",
            borderWidth: 2.5,
            pointRadius: 3,
            fill: false,
            tension: 0.3,
            order: 1,
          },
          {
            label: "95% Confidence Interval",
            data: [...Array(hDates.length).fill(null), ...fore.upper_bound],
            borderColor: "rgba(16, 185, 129, 0.2)",
            backgroundColor: "rgba(16, 185, 129, 0.05)",
            borderWidth: 1,
            pointRadius: 0,
            fill: "+1",
            tension: 0.3,
            order: 4,
          },
          {
            label: "Forecast Lower Bound",
            data: [...Array(hDates.length).fill(null), ...fore.lower_bound],
            borderColor: "rgba(16, 185, 129, 0.2)",
            borderWidth: 1,
            pointRadius: 0,
            fill: false,
            tension: 0.3,
            order: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: THEME_COLORS.outline, font: { weight: '800', size: 11 }, usePointStyle: true } },
          tooltip: { backgroundColor: "rgba(255, 255, 255, 0.98)", titleColor: THEME_COLORS.primary, bodyColor: THEME_COLORS.onSurfaceVariant, borderColor: "#e2e8f0", borderWidth: 1, padding: 12, cornerRadius: 10 },
        },
        scales: {
          x: { grid: { color: THEME_COLORS.grid }, ticks: { color: THEME_COLORS.outline, font: { weight: '600', size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
          y: { grid: { color: THEME_COLORS.grid }, ticks: { color: THEME_COLORS.outline, font: { weight: '600', size: 10 } } },
        },
      },
    });
  };

  const renderTypeBreakdown = () => {
    destroyChart("type");
    const types = Object.keys(historical?.by_type || {});
    if (!types.length) return;

    let dates = historical.dates;
    const byType = historical.by_type;
    const MAX = 90;
    let startIdx = 0;
    if (dates.length > MAX) {
      startIdx = dates.length - MAX;
      dates = dates.slice(startIdx);
    }

    const datasets = types.map((t) => ({
      label: t,
      data: startIdx > 0 ? byType[t].slice(startIdx) : byType[t],
      backgroundColor: TYPE_COLORS[t]?.bg || "rgba(100,116,139,0.5)",
      borderColor: TYPE_COLORS[t]?.border || "#64748b",
      borderWidth: 1.5,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
    }));

    const labels = dates.map(d => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
    const ctx = chartRefs.type.current.getContext("2d");
    instances.current.type = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: THEME_COLORS.outline, font: { weight: '800', size: 10 }, padding: 20, usePointStyle: true } },
          tooltip: { backgroundColor: "rgba(255, 255, 255, 0.98)", titleColor: THEME_COLORS.primary, bodyColor: THEME_COLORS.outline, borderColor: "#e2e8f0", borderWidth: 1 },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: THEME_COLORS.outline, size: 9, autoSkip: true, maxTicksLimit: 12 } },
          y: { stacked: true, grid: { color: THEME_COLORS.grid }, ticks: { color: THEME_COLORS.outline, size: 10 } },
        },
      },
    });
  };

  const renderTypeForecast = () => {
    destroyChart("typeForecast");
    const tf = forecast?.type_forecasts || {};
    const types = Object.keys(tf);
    if (!types.length) return;

    const totals = types.map(t => tf[t].reduce((a, b) => a + b, 0));
    const ctx = chartRefs.typeForecast.current.getContext("2d");
    instances.current.typeForecast = new Chart(ctx, {
      type: "bar",
      data: {
        labels: types,
        datasets: [{
          label: "Predicted 30-Day Volume",
          data: totals.map(v => Math.round(v)),
          backgroundColor: types.map(t => TYPE_COLORS[t]?.border),
          borderRadius: 8,
          barPercentage: 0.6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { backgroundColor: "rgba(255, 255, 255, 0.98)", titleColor: THEME_COLORS.primary, bodyColor: THEME_COLORS.outline, borderColor: "#e2e8f0", borderWidth: 1 } },
        scales: {
          x: { grid: { color: THEME_COLORS.grid }, ticks: { color: THEME_COLORS.outline, size: 10 } },
          y: { grid: { display: false }, ticks: { color: THEME_COLORS.primary, font: { weight: "800", size: 11 } } },
        },
      },
    });
  };

  const renderDOWChart = () => {
    destroyChart("dow");
    const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dowTotals = new Array(7).fill(0);
    const dowCounts = new Array(7).fill(0);

    historical.dates.forEach((d, i) => {
      const dow = new Date(d).getDay();
      dowTotals[dow] += historical.counts[i];
      dowCounts[dow] += 1;
    });

    const avgs = dowTotals.map((t, i) => dowCounts[i] ? Math.round((t / dowCounts[i]) * 10) / 10 : 0);
    const ctx = chartRefs.dow.current.getContext("2d");
    instances.current.dow = new Chart(ctx, {
      type: "bar",
      data: {
        labels: dows,
        datasets: [{ data: avgs, backgroundColor: THEME_COLORS.primary, borderRadius: 8, barPercentage: 0.5 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: "rgba(255, 255, 255, 0.98)", titleColor: THEME_COLORS.primary, bodyColor: THEME_COLORS.outline, borderColor: "#e2e8f0", borderWidth: 1 } },
        scales: {
          x: { grid: { display: false }, ticks: { color: THEME_COLORS.primary, font: { weight: "800", size: 11 } } },
          y: { grid: { color: THEME_COLORS.grid }, ticks: { color: THEME_COLORS.outline, size: 10 } },
        },
      },
    });
  };

  const renderCumulativeChart = () => {
    destroyChart("cumulative");
    let cumulative = [];
    let sum = 0;
    historical.counts.forEach(c => { sum += c; cumulative.push(sum); });

    let dates = historical.dates;
    const MAX = 90;
    if (dates.length > MAX) {
      const s = dates.length - MAX;
      dates = dates.slice(s);
      cumulative = cumulative.slice(s);
    }

    const labels = dates.map(d => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
    const ctx = chartRefs.cumulative.current.getContext("2d");
    instances.current.cumulative = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Historical Accumulation",
          data: cumulative,
          borderColor: THEME_COLORS.primary,
          backgroundColor: "rgba(26, 54, 93, 0.05)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: "rgba(255, 255, 255, 0.98)", titleColor: THEME_COLORS.primary, bodyColor: THEME_COLORS.outline, borderColor: "#e2e8f0", borderWidth: 1 } },
        scales: {
          x: { grid: { display: false }, ticks: { color: THEME_COLORS.outline, size: 9, autoSkip: true, maxTicksLimit: 12 } },
          y: { grid: { color: THEME_COLORS.grid }, ticks: { color: THEME_COLORS.outline, size: 10 } },
        },
      },
    });
  };

  if (syncing) {
    return (
      <div className="ml-dashboard-wrapper">
        <div className="syncing-wrapper-ml">
          <div className="syncing-card-ml">
            <div className="ml-spinner mb-6"><span></span><span></span><span></span></div>
            <h2>Syncing Predictions</h2>
            <p>Connecting to NagarSetu Intelligence Service (M18)...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ml-dashboard-wrapper">
        <div className="syncing-wrapper-ml">
          <div className="syncing-card-ml border-t-4 border-error">
            <h2 className="text-error">Sync Failed</h2>
            <p className="mb-8">{error}</p>
            <button onClick={autoSync} className="btn-ml-primary">Retry Sync</button>
          </div>
        </div>
      </div>
    );
  }

  const makeStatus = (model) => (model?.trained ? "Ready" : "Model Idle");
  const makeSub = (model, label) => model?.trained ? `Valid across all municipal wards.` : `Requires data feed to initialize ${label}.`;

  return (
    <div className="ml-dashboard-wrapper pt-24 px-8 pb-12">
      <div className="ml-main-content space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#2563eb] mb-2 block">Predictive Intelligence Unit</span>
            <h1 className="text-4xl font-black text-[#1a365d] tracking-tighter leading-none">Civic Volume <span className="opacity-40">Forecasting.</span></h1>
            <p className="text-sm font-medium text-[#757684] mt-5 max-w-lg">Unified NagarSetu M18 projections based on {stats.total_volume?.toLocaleString()} historical data points.</p>
          </div>
          <div className="flex gap-4">
             <button onClick={autoSync} className="btn-ml-secondary flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">refresh</span> Refresh
             </button>
             <button onClick={trainAllModels} className="btn-ml-primary flex items-center gap-2" disabled={isTrainingAll}>
                <span className="material-symbols-outlined text-sm">neurology</span> {isTrainingAll ? "Processing..." : "Calibrate M15/M19"}
             </button>
          </div>
        </div>

        {/* AI Performance Status */}
        <div className="flex flex-wrap gap-4 items-center">
           <div className="intelligence-pill" title="Processing Engine">
              <span className="pill-dot"></span>
              <span className="pill-value">M18 Forecaster</span>
           </div>
           <div className="intelligence-pill" title="Model Confidence Index">
              <span className="pill-icon material-symbols-outlined">bolt</span>
              <span className="pill-value">{(loginData?.training?.r2_score * 100).toFixed(1)}% Confidence</span>
           </div>
           <div className="intelligence-pill" title="Data Pipeline Source">
              <span className="pill-icon material-symbols-outlined">database</span>
              <span className="pill-value uppercase text-[10px]">{loginData?.source === "synthetic" ? "Demo Stream" : "Live Pipeline"}</span>
           </div>
           <div className="flex-1"></div>
           <div className="text-[10px] font-black uppercase tracking-widest text-[#1a365d] bg-[#f8fafc] px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
              Critical Accuracy: <span className="text-[#2563eb]">±{loginData?.training?.rmse?.toFixed(2)} Points</span>
           </div>
        </div>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
           {[
             { label: "Total History", value: stats.total_volume?.toLocaleString(), sub: "Issues parsed" },
             { label: "Daily Avg", value: stats.avg_daily, sub: "Historical mean" },
             { label: "Volatility", value: stats.std_daily, sub: "Standard deviation" },
             { label: "Peak Load", value: stats.max_daily, sub: "Maximum registered" },
             { label: "Trend Vector", value: stats.trend_direction, sub: "Linear gradient" },
             { label: "Time Span", value: stats.total_days + "d", sub: "Data horizon" },
           ].map((s, i) => (
             <div key={i} className="ml-stat-card border-l-4 border-[#1a365d]/20">
               <div className="ml-stat-label">{s.label}</div>
               <div className="ml-stat-value">{s.value || "---"}</div>
               <div className="ml-stat-sub font-bold">{s.sub}</div>
             </div>
           ))}
        </section>

        {/* ML Model Status */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="admin-card-ml flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-[#f0f4ff] flex items-center justify-center text-[#1a365d]">
                 <span className="material-symbols-outlined text-3xl">timer_3_alt_1</span>
              </div>
              <div className="flex-1">
                 <h3 className="font-black text-[#1a365d]">M15 — SLA Breach Risk</h3>
                 <p className="text-xs text-[#757684] font-medium mt-1">{makeSub(mlStatus.m15_sla_breach, "M15")}</p>
                 <div className="mt-2 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${mlStatus.m15_sla_breach?.trained ? 'bg-green-500' : 'bg-amber-400'}`}></span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1a365d]">{makeStatus(mlStatus.m15_sla_breach)}</span>
                 </div>
              </div>
           </div>
           <div className="admin-card-ml flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-[#f0f4ff] flex items-center justify-center text-[#1a365d]">
                 <span className="material-symbols-outlined text-3xl">engineering</span>
              </div>
              <div className="flex-1">
                 <h3 className="font-black text-[#1a365d]">M19 — Worker Demand</h3>
                 <p className="text-xs text-[#757684] font-medium mt-1">{makeSub(mlStatus.m19_worker_demand, "M19")}</p>
                 <div className="mt-2 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${mlStatus.m19_worker_demand?.trained ? 'bg-green-500' : 'bg-amber-400'}`}></span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#1a365d]">{makeStatus(mlStatus.m19_worker_demand)}</span>
                 </div>
              </div>
           </div>
        </section>

        {/* Main Chart */}
        <section className="admin-card-ml">
           <div className="flex justify-between items-start mb-10">
              <div>
                 <h3>📈 Issue Volume Forecasting</h3>
                 <p className="chart-subtitle-ml">Continuous predictive pipeline showing 30-day anticipatory load with 95% confidence bands.</p>
              </div>
           </div>
           <div className="h-[420px] w-full">
              <canvas ref={chartRefs.forecast}></canvas>
           </div>
        </section>

        {/* Categorical Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="admin-card-ml">
              <h3>🏷️ Categorical Equilibrium</h3>
              <p className="chart-subtitle-ml">Historical distribution of civic issues across all municipal domains.</p>
              <div className="h-[350px] w-full">
                 <canvas ref={chartRefs.type}></canvas>
              </div>
           </div>
           <div className="admin-card-ml">
              <h3>🔮 Projected Category Load</h3>
              <div className="chart-subtitle-ml">Predicted categorical accumulation for the upcoming 30-day horizon.</div>
              <div className="h-[350px] w-full">
                 <canvas ref={chartRefs.typeForecast}></canvas>
              </div>
           </div>
        </section>

        {/* Patterns Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="admin-card-ml">
              <h3>📅 Weekly Seasonality</h3>
              <p className="chart-subtitle-ml">Mean issue density patterns mapped over the 7-day municipal cycle.</p>
              <div className="h-[300px] w-full">
                 <canvas ref={chartRefs.dow}></canvas>
              </div>
           </div>
           <div className="admin-card-ml">
              <h3>📊 Aggregate Accumulation</h3>
              <p className="chart-subtitle-ml">Total historical volume growth trajectory over the observation period.</p>
              <div className="h-[300px] w-full">
                 <canvas ref={chartRefs.cumulative}></canvas>
              </div>
           </div>
        </section>

        <footer className="pt-12 pb-6 border-t border-slate-200 text-center">
           <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#757684]">NagarSetu Intelligence Unit &middot; AI Protocol M18 &middot; Predictive Ward Logistics</p>
        </footer>

      </div>
    </div>
  );
}
