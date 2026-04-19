import React, { useState, useEffect, useRef } from 'react';
import { 
  trainMlModel, 
  getMlForecast, 
  getMlHistorical, 
  getMlStats 
} from '../../services/api';
import { getToken } from '../../lib/session';
import { 
  Chart, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler, 
  LineController,
  ArcElement,
  DoughnutController,
  BarController,
  BarElement
} from 'chart.js';

// Register Chart.js components
Chart.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler, 
  LineController,
  ArcElement,
  DoughnutController,
  BarController,
  BarElement
);

const CATEGORY_COLORS = {
  ROAD: '#3b82f6',        // Blue
  WATER: '#0ea5e9',       // Sky
  GARBAGE: '#10b981',     // Emerald
  VEHICLE: '#f59e0b',     // Amber
  STREETLIGHT: '#6366f1', // Indigo
  OTHER: '#94a3b8'        // Slate
};

export default function AdminMlPredictions() {
  const [loading, setLoading] = useState(true);
  const [isTraining, setIsTraining] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [historical, setHistorical] = useState(null);
  const [forecast, setForecast] = useState(null);
  
  const mainChartRef = useRef(null);
  const typeChartRef = useRef(null);
  const histDistributionRef = useRef(null);
  const forecastDistributionRef = useRef(null);
  
  const mainChartInstance = useRef(null);
  const typeChartInstance = useRef(null);
  const histDistInstance = useRef(null);
  const forecastDistInstance = useRef(null);

  useEffect(() => {
    initM18();
  }, []);

  useEffect(() => {
    if (historical && forecast) {
      if (mainChartRef.current) renderMainChart();
      if (typeChartRef.current) renderTypeTrendChart();
      if (histDistributionRef.current) renderDistributionChart(histDistributionRef, histDistInstance, historical.by_type, 'Past 30 Days');
      if (forecastDistributionRef.current) renderDistributionChart(forecastDistributionRef, forecastDistInstance, forecast.type_forecasts, 'Next 30 Days');
    }
  }, [historical, forecast]);

  const initM18 = async () => {
    setLoading(true);
    setIsTraining(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) throw new Error("No admin token found. Please login.");

      // Step 1: Login/Train
      console.log("Starting M18 Model Training...");
      await trainMlModel(token);
      
      // Step 2: Fetch Data
      const [statsData, histData, forecastData] = await Promise.all([
        getMlStats(),
        getMlHistorical(),
        getMlForecast()
      ]);

      setStats(statsData);
      setHistorical(histData);
      setForecast(forecastData);
      setIsTraining(false);
    } catch (err) {
      console.error("ML Integration Error:", err);
      setError(err.message || "Failed to initialize ML backend");
    } finally {
      setLoading(false);
      setIsTraining(false);
    }
  };

  const renderMainChart = () => {
    if (mainChartInstance.current) mainChartInstance.current.destroy();
    const ctx = mainChartRef.current.getContext('2d');
    const labels = [...historical.dates, ...forecast.dates];
    
    mainChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Actual Volume',
            data: [...historical.counts, ...new Array(forecast.dates.length).fill(null)],
            borderColor: '#00288e',
            backgroundColor: 'rgba(0, 40, 142, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 2,
            spanGaps: true,
          },
          {
            label: 'AI Forecast',
            data: [...new Array(historical.dates.length - 1).fill(null), historical.counts[historical.counts.length - 1], ...forecast.predicted],
            borderColor: '#4f46e5',
            borderDash: [8, 4],
            backgroundColor: 'rgba(79, 70, 229, 0.05)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            spanGaps: true,
          },
          {
            label: '95% Confidence Upper',
            data: [...new Array(historical.dates.length - 1).fill(null), historical.counts[historical.counts.length - 1], ...forecast.upper_bound],
            borderColor: 'transparent',
            pointRadius: 0,
            fill: '+1',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            spanGaps: true,
          },
          {
            label: '95% Confidence Lower',
            data: [...new Array(historical.dates.length - 1).fill(null), historical.counts[historical.counts.length - 1], ...forecast.lower_bound],
            borderColor: 'transparent',
            pointRadius: 0,
            fill: false,
            spanGaps: true,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: false }, 
          tooltip: { mode: 'index', intersect: false } 
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 12, font: { size: 10, weight: 'bold' } } },
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }
        }
      }
    });
  };

  const renderTypeTrendChart = () => {
    if (typeChartInstance.current) typeChartInstance.current.destroy();
    const ctx = typeChartRef.current.getContext('2d');
    const labels = [...historical.dates, ...forecast.dates];
    
    const datasets = Object.keys(historical.by_type).map(type => {
      const histData = historical.by_type[type] || [];
      const foreData = forecast.type_forecasts[type] || [];
      
      // Combine: hist + fill gaps + forecast
      // We need to overlap exactly like the main chart for continuity
      const combinedData = [
        ...histData, 
        ...new Array(foreData.length).fill(null)
      ];
      
      const combinedFore = [
        ...new Array(histData.length - 1).fill(null),
        histData[histData.length - 1],
        ...foreData
      ];

      return [
        {
          label: `${type} (Actual)`,
          data: combinedData,
          borderColor: CATEGORY_COLORS[type] || '#94a3b8',
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
          fill: false,
          spanGaps: true
        },
        {
          label: `${type} (AI)`,
          data: combinedFore,
          borderColor: CATEGORY_COLORS[type] || '#94a3b8',
          borderDash: [5, 3],
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
          fill: false,
          spanGaps: true
        }
      ];
    }).flat();

    typeChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { 
            display: false // Too many labels now, we'll rely on the color system
          },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' } }
        }
      }
    });
  };

  const renderDistributionChart = (ref, instanceRef, dataMap, label) => {
    if (instanceRef.current) instanceRef.current.destroy();
    const ctx = ref.current.getContext('2d');
    
    const types = Object.keys(dataMap);
    const totals = types.map(type => 
      Array.isArray(dataMap[type]) ? dataMap[type].reduce((a, b) => a + (b || 0), 0) : 0
    );

    instanceRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: types,
        datasets: [{
          data: totals,
          backgroundColor: types.map(t => CATEGORY_COLORS[t] || '#94a3b8'),
          hoverOffset: 10,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(item) {
                const total = item.dataset.data.reduce((a, b) => a + b, 0);
                const percent = total > 0 ? ((item.raw / total) * 100).toFixed(1) : 0;
                return `${item.label}: ${item.raw.toFixed(0)} issues (${percent}%)`;
              }
            }
          }
        }
      }
    });
  };

  if (loading && !isTraining) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-container-lowest">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-on-surface-variant font-medium text-lg animate-pulse">Initializing Neural Streams...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pt-24 px-8 pb-12 w-full max-w-7xl mx-auto flex flex-col gap-8 relative">
        
        {/* Training Overlay */}
        {isTraining && (
          <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-xl flex items-center justify-center">
             <div className="bg-white p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-outline/10 flex flex-col items-center gap-8 max-w-md text-center">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-primary/10 rounded-full"></div>
                  <div className="absolute top-0 left-0 w-24 h-24 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl text-primary" data-icon="neurology">neurology</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-on-surface tracking-tight">Recalibrating M18 Engine</h3>
                  <p className="text-on-surface-variant mt-3 leading-relaxed">Synthesizing {historical?.dates?.length} days of history with 30-day anticipatory models...</p>
                </div>
                <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-[shimmer_2s_infinite] w-full bg-gradient-to-r from-primary via-blue-400 to-primary bg-[length:200%_100%]"></div>
                </div>
             </div>
          </div>
        )}

        {error && (
          <div className="bg-error-container/20 text-on-error-container p-5 rounded-2xl flex items-center gap-4 border border-error/10 backdrop-blur-md">
            <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-error" data-icon="warning">warning</span>
            </div>
            <div className="flex-1">
              <p className="font-bold">Neural Link Refused</p>
              <p className="text-xs opacity-70 mt-0.5">{error}</p>
            </div>
            <button onClick={initM18} className="bg-primary text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20">Sync Again</button>
          </div>
        )}

        {/*  Page Header  */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="text-primary font-black tracking-[0.2em] text-xs uppercase mb-3 block">Unified Predictive Intelligence</span>
            <h2 className="text-5xl font-black font-headline text-on-primary-fixed leading-none tracking-tighter">Civic Load <span className="text-primary">Timeline.</span></h2>
            <p className="text-on-surface-variant mt-6 text-xl leading-relaxed opacity-80 font-medium">Unifying {historical?.total_issues || '---'} historical records with 30-day M18 projections.</p>
          </div>
          <div className="flex items-center gap-6 bg-white p-5 rounded-2xl shadow-xl border border-outline/5">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-primary text-3xl" data-icon="data_exploration">data_exploration</span>
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-on-surface-variant mb-1">Model R² Confidence</p>
              <p className="text-3xl font-black text-primary leading-tight">{stats ? (stats.r2_score * 100).toFixed(1) : '--'}%</p>
            </div>
          </div>
        </div>

        {/*  Metric Cards  */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Volume', value: stats?.total_issues, sub: `${stats?.total_days} days`, icon: 'database', color: 'primary' },
            { label: 'Avg Daily', value: stats?.avg_daily, sub: `Median: ${stats?.median_daily}`, icon: 'speed', color: 'secondary' },
            { label: 'Trend Slopes', value: stats?.trend_direction?.split(' ')[1], sub: 'Regressive Trend', icon: 'trending_up', color: 'tertiary' },
            { label: 'Std Error', value: `±${forecast?.residual_std}`, sub: 'RMSE Score', icon: 'psychology', color: 'error' }
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm flex flex-col border border-outline/5 relative overflow-hidden group hover:shadow-xl transition-all duration-500">
              <div className={`absolute -right-6 -bottom-6 w-24 h-24 bg-${card.color}/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700`}></div>
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div className={`p-3 bg-${card.color}/10 rounded-xl`}>
                  <span className={`material-symbols-outlined text-${card.color}`} data-icon={card.icon}>{card.icon}</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">M18</span>
              </div>
              <h3 className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest mb-1">{card.label}</h3>
              <p className="text-3xl font-black text-on-surface leading-tight">{card.value || '0'}</p>
              <p className="text-[10px] text-on-surface-variant mt-2 font-bold italic opacity-60">{card.sub}</p>
            </div>
          ))}
        </div>

        {/*  Main Volume Chart  */}
        <div className="bg-white rounded-3xl p-8 shadow-xl relative overflow-hidden border border-outline/5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <div>
              <h3 className="text-2xl font-black font-headline tracking-tight">System-Wide Volume Pipeline</h3>
              <p className="text-sm text-on-surface-variant font-medium mt-1">Seamless transition from historical actuals to AI-predicted volume.</p>
            </div>
          </div>
          <div className="h-[400px] w-full relative">
            <canvas ref={mainChartRef}></canvas>
          </div>
        </div>

        {/*  Categorical Momentum Chart  */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-outline/5 flex flex-col">
          <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-lg" data-icon="stacked_line_chart">stacked_line_chart</span>
                </div>
                <h3 className="text-xl font-black font-headline">Unifed Categorical Momentum</h3>
              </div>
              <p className="text-sm text-on-surface-variant font-medium ml-11">Continuous history-to-forecast streams for each municipal category.</p>
            </div>
            <div className="flex flex-wrap gap-4 ml-11 md:ml-0">
               {Object.entries(CATEGORY_COLORS).map(([type, color]) => (
                 <div key={type} className="flex items-center gap-2">
                   <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                   <span className="text-[10px] font-black uppercase text-on-surface-variant">{type}</span>
                 </div>
               ))}
            </div>
          </div>
          <div className="h-[350px] w-full">
            <canvas ref={typeChartRef}></canvas>
          </div>
        </div>

        {/* Comparison Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-outline/5">
                <h4 className="text-xl font-black font-headline mb-2 flex items-center gap-2">
                   <span className="material-symbols-outlined text-indigo-500" data-icon="history">history</span>
                   Past Load Share
                </h4>
                <p className="text-sm text-on-surface-variant font-medium mb-8">Asset distribution over the previous 30 days.</p>
                <div className="h-[250px] w-full">
                    <canvas ref={histDistributionRef}></canvas>
                </div>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-outline/5">
                <h4 className="text-xl font-black font-headline mb-2 flex items-center gap-2">
                   <span className="material-symbols-outlined text-primary" data-icon="rocket_launch">rocket_launch</span>
                   Projected Load Share
                </h4>
                <p className="text-sm text-on-surface-variant font-medium mb-8">Anticipated asset distribution for the next 30 days.</p>
                <div className="h-[250px] w-full">
                    <canvas ref={forecastDistributionRef}></canvas>
                </div>
            </div>
        </div>

        {/*  Footer Content  */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-primary p-10 rounded-3xl text-white flex flex-col md:flex-row items-center gap-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                <div className="relative z-10 flex-1">
                    <h4 className="text-3xl font-black font-headline mb-4">Adaptive Resource Provisioning</h4>
                    <p className="opacity-90 text-lg leading-relaxed max-w-xl font-medium">By unifying historical entropy with predictive load, NagarSetu can now pre-emptively scale ward-level staffing 72 hours before a major categorical spike.</p>
                    <div className="mt-8 flex gap-4">
                        <button className="bg-white text-primary px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl">Activate Smart Dispatch</button>
                    </div>
                </div>
            </div>

            <div className="bg-surface-container-high p-10 rounded-3xl flex flex-col justify-between border border-outline/5 hover:bg-white transition-all duration-300 group shadow-sm hover:shadow-2xl">
                <div>
                   <h4 className="text-2xl font-black mb-4 tracking-tight">Forecast Health</h4>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center">
                         <span className="text-xs font-bold text-on-surface-variant">Model Confidence</span>
                         <span className="text-xs font-black text-primary">{(stats?.r2_score * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${stats?.r2_score * 100}%` }}></div>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-xs font-bold text-on-surface-variant">RMSE Accuracy</span>
                         <span className="text-xs font-black text-blue-500">High</span>
                      </div>
                   </div>
                </div>
                <button 
                    onClick={initM18}
                    className="w-full bg-on-surface text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:gap-5 transition-all"
                >
                    Re-Train Model
                    <span className="material-symbols-outlined text-sm" data-icon="refresh">refresh</span>
                </button>
            </div>
        </div>
      </div>
    </>
  );
}
