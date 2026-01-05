'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from 'recharts';

// Use local backend for development, production URL for deployed version
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://127.0.0.1:5001'
  : 'https://projecttracker-production.up.railway.app';

// ==================== Type Definitions ====================

interface Recovery {
  id: number;
  date: string;
  recovery_score: number | null;
  resting_heart_rate: number | null;
  hrv_rmssd: number | null;
  spo2_percentage: number | null;
  skin_temp_celsius: number | null;
  recovery_status: 'green' | 'yellow' | 'red' | 'unknown';
}

interface SleepStages {
  rem_min: number;
  deep_min: number;
  light_min: number;
  awake_min: number;
}

interface Sleep {
  id: number;
  date: string;
  start_time: string | null;
  end_time: string | null;
  total_sleep_hours: number;
  sleep_performance: number | null;
  sleep_efficiency: number | null;
  sleep_consistency: number | null;
  stages: SleepStages;
  respiratory_rate: number | null;
}

interface Workout {
  id: number;
  start_time: string | null;
  end_time: string | null;
  sport_name: string;
  strain: number;
  average_heart_rate: number | null;
  max_heart_rate: number | null;
  calories: number;
  distance_meters: number | null;
  duration_min: number;
}

interface Cycle {
  id: number;
  date: string;
  strain: number;
  kilojoules: number;
  average_heart_rate: number | null;
  max_heart_rate: number | null;
}

interface AggregatedMetrics {
  period_days: number;
  recovery: {
    average_score: number;
    max_score: number;
    min_score: number;
    total_records: number;
    green_days: number;
    yellow_days: number;
    red_days: number;
  };
  sleep: {
    average_hours: number;
    average_performance: number;
    total_records: number;
  };
  strain: {
    average_daily_strain: number;
    max_daily_strain: number;
    total_workouts: number;
    average_workout_strain: number;
  };
}

interface ApiStatus {
  configured: boolean;
  has_access_token: boolean;
  has_refresh_token: boolean;
  has_client_credentials?: boolean;
  authenticated?: boolean;
  message?: string;
  error?: string;
}

interface AuthTestResult {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

type AuthErrorType = 'not_configured' | 'token_expired' | 'auth_failed' | 'network_error' | null;
type ActivePanel = 'recovery' | 'sleep' | 'strain' | null;

// ==================== Date Helper Functions ====================

function getDateString(date: Date): string {
  // Use local date to avoid timezone issues (toISOString converts to UTC)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDate(date1: string | null, date2: string): boolean {
  if (!date1) return false;
  return date1.split('T')[0] === date2.split('T')[0];
}

function formatFullDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (getDateString(date) === getDateString(today)) {
    return 'Today';
  } else if (getDateString(date) === getDateString(yesterday)) {
    return 'Yesterday';
  }
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  });
}

function formatCalendarDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

// ==================== Helper Functions ====================

function getRecoveryColor(status: string): string {
  switch (status) {
    case 'green': return '#00d084';
    case 'yellow': return '#ffb800';
    case 'red': return '#ff4757';
    default: return 'var(--muted)';
  }
}

function getRecoveryStatusFromScore(score: number | null): string {
  if (score === null) return 'unknown';
  if (score >= 67) return 'green';
  if (score >= 34) return 'yellow';
  return 'red';
}

function getStrainColor(strain: number): string {
  if (strain >= 18) return '#ff4757';
  if (strain >= 14) return '#ff6b35';
  if (strain >= 10) return '#ffb800';
  return '#00d084';
}

function formatTime(isoString: string | null): string {
  if (!isoString) return '—';
  // Ensure the ISO string is treated as UTC if it doesn't have a timezone indicator
  // The Whoop API returns times in UTC
  let dateStr = isoString;
  if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-', 10)) {
    dateStr = dateStr + 'Z';
  }
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatShortDate(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
}

function calculateReadinessScore(recovery: Recovery | null, sleep: Sleep | null): number | null {
  if (!recovery?.recovery_score && !sleep?.sleep_performance) return null;
  
  const recoveryWeight = 0.6;
  const sleepWeight = 0.4;
  
  const recoveryScore = recovery?.recovery_score ?? 0;
  const sleepScore = sleep?.sleep_performance ?? 0;
  
  return Math.round(recoveryScore * recoveryWeight + sleepScore * sleepWeight);
}

function getReadinessStatus(score: number | null): { label: string; color: string } {
  if (score === null) return { label: 'Unknown', color: 'var(--muted)' };
  if (score >= 67) return { label: 'Optimal', color: '#00d084' };
  if (score >= 34) return { label: 'Moderate', color: '#ffb800' };
  return { label: 'Low', color: '#ff4757' };
}

// ==================== Chart Components ====================

function RecoveryChart({ data, onClose, onLoadMore, loading, noMoreData }: { data: Recovery[]; onClose: () => void; onLoadMore?: () => void; loading?: boolean; noMoreData?: boolean }) {
  const chartData = [...data].reverse().map(r => ({
    date: formatShortDate(r.date),
    fullDate: r.date,
    score: r.recovery_score ?? 0,
    hrv: r.hrv_rmssd ?? 0,
    rhr: r.resting_heart_rate ?? 0,
    status: r.recovery_status,
  }));

  const avgScore = chartData.reduce((acc, d) => acc + d.score, 0) / chartData.length;

  return (
    <div className="whoop-detail-panel">
      <div className="whoop-detail-header">
        <h2>Recovery History</h2>
        <button className="whoop-detail-close" onClick={onClose}>×</button>
      </div>
      
      <div className="whoop-chart-section">
        <h3>7-Day Recovery Score</h3>
        <div className="whoop-chart-container">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="recoveryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d084" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00d084" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#b0b0b0" fontSize={12} />
              <YAxis domain={[0, 100]} stroke="#b0b0b0" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a1a', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value, name) => {
                  const v = value as number;
                  const n = name as string;
                  // Skip the area fill to avoid duplicate tooltip entries
                  if (n === 'areaFill') return null;
                  return [
                    `${v}${n === 'Recovery' ? '%' : n === 'hrv' ? ' ms' : ' bpm'}`,
                    n === 'Recovery' ? 'Recovery' : n === 'hrv' ? 'HRV' : 'RHR'
                  ];
                }}
              />
              <ReferenceLine y={avgScore} stroke="#72cbff" strokeDasharray="5 5" label={{ value: `Avg: ${avgScore.toFixed(0)}%`, fill: '#72cbff', fontSize: 12 }} />
              <Area type="monotone" dataKey="score" stroke="#00d084" fill="url(#recoveryGradient)" strokeWidth={2} name="areaFill" />
              <Line type="monotone" dataKey="score" stroke="#00d084" strokeWidth={3} dot={{ fill: '#00d084', strokeWidth: 2, r: 5 }} activeDot={{ r: 8 }} name="Recovery" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="whoop-chart-section">
        <h3>HRV & Resting Heart Rate</h3>
        <div className="whoop-chart-container">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#b0b0b0" fontSize={12} />
              <YAxis yAxisId="left" stroke="#72cbff" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="#ff6b35" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a1a', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Line yAxisId="left" type="monotone" dataKey="hrv" stroke="#72cbff" strokeWidth={2} dot={{ fill: '#72cbff', r: 4 }} name="HRV (ms)" />
              <Line yAxisId="right" type="monotone" dataKey="rhr" stroke="#ff6b35" strokeWidth={2} dot={{ fill: '#ff6b35', r: 4 }} name="RHR (bpm)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="whoop-detail-list">
        <h3>Daily Breakdown</h3>
        {data.map((r, i) => (
          <div key={i} className="whoop-detail-list-item">
            <div className="whoop-detail-list-date">{formatDate(r.date)}</div>
            <div className="whoop-detail-list-stats">
              <span className="whoop-detail-stat" style={{ color: getRecoveryColor(r.recovery_status) }}>
                {r.recovery_score ?? '—'}% Recovery
              </span>
              <span className="whoop-detail-stat">HRV: {r.hrv_rmssd?.toFixed(0) ?? '—'} ms</span>
              <span className="whoop-detail-stat">RHR: {r.resting_heart_rate?.toFixed(0) ?? '—'} bpm</span>
            </div>
          </div>
        ))}
        {onLoadMore && (
          <button 
            className={`whoop-show-more-btn ${noMoreData ? 'no-more-data' : ''}`}
            onClick={onLoadMore}
            disabled={loading || noMoreData}
          >
            {loading ? 'Loading...' : noMoreData ? `All ${data.length} days loaded` : `Show More Days (${data.length} shown)`}
          </button>
        )}
      </div>
    </div>
  );
}

function SleepChart({ data, onClose, onLoadMore, loading, noMoreData }: { data: Sleep[]; onClose: () => void; onLoadMore?: () => void; loading?: boolean; noMoreData?: boolean }) {
  const [highlightedStage, setHighlightedStage] = useState<'deep' | 'rem' | 'light' | 'awake' | null>(null);
  
  // Convert minutes to hours for the chart data
  const chartData = [...data].reverse().map(s => ({
    date: formatShortDate(s.date),
    fullDate: s.date,
    hours: s.total_sleep_hours ?? 0,
    performance: s.sleep_performance ?? 0,
    efficiency: s.sleep_efficiency ?? 0,
    deep: s.stages.deep_min / 60,
    rem: s.stages.rem_min / 60,
    light: s.stages.light_min / 60,
    awake: s.stages.awake_min / 60,
    deepMin: s.stages.deep_min,
    remMin: s.stages.rem_min,
    lightMin: s.stages.light_min,
    awakeMin: s.stages.awake_min,
  }));

  const avgHours = chartData.reduce((acc, d) => acc + d.hours, 0) / chartData.length;
  
  // Calculate average for each stage (in minutes for display)
  const avgDeep = chartData.reduce((acc, d) => acc + d.deepMin, 0) / chartData.length;
  const avgRem = chartData.reduce((acc, d) => acc + d.remMin, 0) / chartData.length;
  const avgLight = chartData.reduce((acc, d) => acc + d.lightMin, 0) / chartData.length;
  const avgAwake = chartData.reduce((acc, d) => acc + d.awakeMin, 0) / chartData.length;
  
  // Format minutes to hours and minutes display
  const formatMinutesToHours = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  // Get opacity based on highlighted stage
  const getBarOpacity = (stage: string) => {
    if (!highlightedStage) return 1;
    return highlightedStage === stage ? 1 : 0.25;
  };

  // Stage info for the legend
  const stageInfo = [
    { key: 'deep', label: 'Deep', color: '#0066cc', avg: avgDeep, description: 'Physical restoration & growth' },
    { key: 'rem', label: 'REM', color: '#00ccff', avg: avgRem, description: 'Mental recovery & dreams' },
    { key: 'light', label: 'Light', color: '#6699cc', avg: avgLight, description: 'Transition & light rest' },
    { key: 'awake', label: 'Awake', color: '#ff6b6b', avg: avgAwake, description: 'Time spent awake' },
  ];

  return (
    <div className="whoop-detail-panel">
      <div className="whoop-detail-header">
        <h2>Sleep History</h2>
        <button className="whoop-detail-close" onClick={onClose}>×</button>
      </div>
      
      <div className="whoop-chart-section">
        <h3>7-Day Sleep Duration</h3>
        <div className="whoop-chart-container">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#b0b0b0" fontSize={12} />
              <YAxis domain={[0, 12]} stroke="#b0b0b0" fontSize={12} tickFormatter={(v) => `${v}h`} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a1a', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value, name) => {
                  const v = value as number;
                  const n = name as string;
                  // Skip the area fill to avoid duplicate tooltip entries
                  if (n === 'sleepAreaFill') return null;
                  return [
                    n === 'Sleep' ? `${v.toFixed(1)}h` : `${v.toFixed(0)}%`,
                    n === 'Sleep' ? 'Sleep' : n === 'performance' ? 'Performance' : 'Efficiency'
                  ];
                }}
              />
              <ReferenceLine y={avgHours} stroke="#72cbff" strokeDasharray="5 5" label={{ value: `Avg: ${avgHours.toFixed(1)}h`, fill: '#72cbff', fontSize: 12 }} />
              <ReferenceLine y={8} stroke="#00d084" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Area type="monotone" dataKey="hours" stroke="#8b5cf6" fill="url(#sleepGradient)" strokeWidth={2} name="sleepAreaFill" />
              <Line type="monotone" dataKey="hours" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 5 }} activeDot={{ r: 8 }} name="Sleep" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="whoop-chart-section whoop-stages-section">
        <h3>Sleep Stages Breakdown</h3>
        <p className="whoop-chart-subtitle">Click a stage to highlight it in the chart</p>
        <div className="whoop-chart-container whoop-stages-chart-container">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#b0b0b0" fontSize={12} />
              <YAxis 
                stroke="#b0b0b0" 
                fontSize={12} 
                tickFormatter={(v) => `${v.toFixed(1)}h`}
                domain={[0, 'auto']}
                ticks={[0, 2, 4, 6, 8, 10]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(20, 20, 25, 0.95)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px',
                  color: '#fff',
                  padding: '12px 16px'
                }}
                formatter={(value: number | undefined, name: string | undefined) => {
                  if (value === undefined) return ['—', name || ''];
                  const hours = value;
                  const minutes = hours * 60;
                  return [formatMinutesToHours(minutes), name || ''];
                }}
                labelFormatter={(label) => `${label}`}
              />
              <Bar 
                dataKey="deep" 
                stackId="a" 
                fill="#0066cc" 
                name="Deep" 
                radius={[0, 0, 0, 0]}
                opacity={getBarOpacity('deep')}
              />
              <Bar 
                dataKey="rem" 
                stackId="a" 
                fill="#00ccff" 
                name="REM" 
                radius={[0, 0, 0, 0]}
                opacity={getBarOpacity('rem')}
              />
              <Bar 
                dataKey="light" 
                stackId="a" 
                fill="#6699cc" 
                name="Light" 
                radius={[0, 0, 0, 0]}
                opacity={getBarOpacity('light')}
              />
              <Bar 
                dataKey="awake" 
                stackId="a" 
                fill="#ff6b6b" 
                name="Awake" 
                radius={[4, 4, 0, 0]}
                opacity={getBarOpacity('awake')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Interactive Legend with Duration Info */}
        <div className="whoop-stages-legend">
          {stageInfo.map(stage => (
            <button
              key={stage.key}
              className={`whoop-stage-legend-item ${highlightedStage === stage.key ? 'active' : ''}`}
              onClick={() => setHighlightedStage(highlightedStage === stage.key ? null : stage.key as 'deep' | 'rem' | 'light' | 'awake')}
              style={{ 
                borderColor: highlightedStage === stage.key ? stage.color : 'transparent',
                backgroundColor: highlightedStage === stage.key ? `${stage.color}20` : 'rgba(255,255,255,0.03)'
              }}
            >
              <div className="whoop-stage-legend-color" style={{ backgroundColor: stage.color }} />
              <div className="whoop-stage-legend-info">
                <span className="whoop-stage-legend-label">{stage.label}</span>
                <span className="whoop-stage-legend-duration">{formatMinutesToHours(stage.avg)}</span>
              </div>
              {highlightedStage === stage.key && (
                <div className="whoop-stage-legend-detail">
                  <span className="whoop-stage-legend-desc">{stage.description}</span>
                  <span className="whoop-stage-legend-pct">
                    {((stage.avg / (avgDeep + avgRem + avgLight + avgAwake)) * 100).toFixed(0)}% of sleep
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="whoop-detail-list">
        <h3>Daily Breakdown</h3>
        {data.map((s, i) => (
          <div key={i} className="whoop-detail-list-item">
            <div className="whoop-detail-list-date">{formatDate(s.date)}</div>
            <div className="whoop-detail-list-stats">
              <span className="whoop-detail-stat" style={{ color: '#8b5cf6' }}>
                {s.total_sleep_hours?.toFixed(1) ?? '—'}h
              </span>
              <span className="whoop-detail-stat">Performance: {s.sleep_performance?.toFixed(0) ?? '—'}%</span>
              <span className="whoop-detail-stat">Efficiency: {s.sleep_efficiency?.toFixed(0) ?? '—'}%</span>
            </div>
          </div>
        ))}
        {onLoadMore && (
          <button 
            className={`whoop-show-more-btn ${noMoreData ? 'no-more-data' : ''}`}
            onClick={onLoadMore}
            disabled={loading || noMoreData}
          >
            {loading ? 'Loading...' : noMoreData ? `All ${data.length} days loaded` : `Show More Days (${data.length} shown)`}
          </button>
        )}
      </div>
    </div>
  );
}

function StrainChart({ data, workouts, onClose, onLoadMore, loading, noMoreData }: { data: Cycle[]; workouts: Workout[]; onClose: () => void; onLoadMore?: () => void; loading?: boolean; noMoreData?: boolean }) {
  const chartData = [...data].reverse().map(c => ({
    date: formatShortDate(c.date),
    fullDate: c.date,
    strain: c.strain ?? 0,
    calories: c.kilojoules ?? 0,
    avgHr: c.average_heart_rate ?? 0,
    maxHr: c.max_heart_rate ?? 0,
  }));

  const avgStrain = chartData.reduce((acc, d) => acc + d.strain, 0) / chartData.length;

  return (
    <div className="whoop-detail-panel">
      <div className="whoop-detail-header">
        <h2>Strain History</h2>
        <button className="whoop-detail-close" onClick={onClose}>×</button>
      </div>
      
      <div className="whoop-chart-section">
        <h3>7-Day Strain Trend</h3>
        <div className="whoop-chart-container">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="strainGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff6b35" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ff6b35" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#b0b0b0" fontSize={12} />
              <YAxis domain={[0, 21]} stroke="#b0b0b0" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a1a', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value, name) => {
                  const v = value as number;
                  const n = name as string;
                  // Skip the area fill to avoid duplicate tooltip entries
                  if (n === 'strainAreaFill') return null;
                  return [`${v.toFixed(1)}`, 'Strain'];
                }}
              />
              <ReferenceLine y={avgStrain} stroke="#72cbff" strokeDasharray="5 5" label={{ value: `Avg: ${avgStrain.toFixed(1)}`, fill: '#72cbff', fontSize: 12 }} />
              <ReferenceLine y={10} stroke="#ffb800" strokeDasharray="3 3" strokeOpacity={0.4} />
              <ReferenceLine y={14} stroke="#ff6b35" strokeDasharray="3 3" strokeOpacity={0.4} />
              <Area type="monotone" dataKey="strain" stroke="#ff6b35" fill="url(#strainGradient)" strokeWidth={2} name="strainAreaFill" />
              <Line type="monotone" dataKey="strain" stroke="#ff6b35" strokeWidth={3} dot={{ fill: '#ff6b35', strokeWidth: 2, r: 5 }} activeDot={{ r: 8 }} name="Strain" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="whoop-chart-section">
        <h3>Calories Burned</h3>
        <div className="whoop-chart-container">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="#b0b0b0" fontSize={12} />
              <YAxis stroke="#b0b0b0" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1a1a', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value) => [`${(value as number).toLocaleString()} kJ`]}
              />
              <Bar dataKey="calories" fill="#ffb800" radius={[4, 4, 0, 0]} name="Calories" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="whoop-chart-section">
        <h3>Average Strain by Activity</h3>
        <div className="whoop-workouts-grid">
          {(() => {
            // Group workouts by sport_name and calculate averages
            const workoutsByType: Record<string, { count: number; totalStrain: number; totalDuration: number; totalCalories: number }> = {};
            
            workouts.forEach(w => {
              if (!workoutsByType[w.sport_name]) {
                workoutsByType[w.sport_name] = { count: 0, totalStrain: 0, totalDuration: 0, totalCalories: 0 };
              }
              workoutsByType[w.sport_name].count += 1;
              workoutsByType[w.sport_name].totalStrain += w.strain;
              workoutsByType[w.sport_name].totalDuration += w.duration_min;
              workoutsByType[w.sport_name].totalCalories += w.calories;
            });
            
            // Filter to only show workout types with more than 3 occurrences and calculate averages
            const workoutAverages = Object.entries(workoutsByType)
              .filter(([, stats]) => stats.count > 3)
              .map(([sportName, stats]) => ({
                sportName,
                count: stats.count,
                avgStrain: stats.totalStrain / stats.count,
                avgDuration: stats.totalDuration / stats.count,
                avgCalories: stats.totalCalories / stats.count,
              }))
              .sort((a, b) => b.count - a.count); // Sort by most frequent
            
            if (workoutAverages.length === 0) {
              return <div className="whoop-no-data">Not enough workout data yet (need &gt;3 sessions per activity)</div>;
            }
            
            return workoutAverages.map((w, i) => (
              <div key={i} className="whoop-workout-mini">
                <div className="whoop-workout-mini-sport">{w.sportName}</div>
                <div className="whoop-workout-mini-strain" style={{ color: getStrainColor(w.avgStrain) }}>
                  {w.avgStrain.toFixed(1)}
                </div>
                <div className="whoop-workout-mini-meta">
                  <span>{Math.round(w.avgDuration)}min avg</span>
                  <span>{w.count} sessions</span>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      <div className="whoop-detail-list">
        <h3>Daily Breakdown</h3>
        {data.map((c, i) => (
          <div key={i} className="whoop-detail-list-item">
            <div className="whoop-detail-list-date">{formatDate(c.date)}</div>
            <div className="whoop-detail-list-stats">
              <span className="whoop-detail-stat" style={{ color: getStrainColor(c.strain) }}>
                {c.strain.toFixed(1)} Strain
              </span>
              <span className="whoop-detail-stat">{c.kilojoules?.toLocaleString() ?? '—'} kJ</span>
              <span className="whoop-detail-stat">Avg HR: {c.average_heart_rate?.toFixed(0) ?? '—'}</span>
            </div>
          </div>
        ))}
        {onLoadMore && (
          <button 
            className={`whoop-show-more-btn ${noMoreData ? 'no-more-data' : ''}`}
            onClick={onLoadMore}
            disabled={loading || noMoreData}
          >
            {loading ? 'Loading...' : noMoreData ? `All ${data.length} days loaded` : `Show More Days (${data.length} shown)`}
          </button>
        )}
      </div>
    </div>
  );
}

// ==================== UI Components ====================

function StatCard({ 
  label, 
  value, 
  unit, 
  color, 
  subtitle,
  size = 'normal'
}: { 
  label: string; 
  value: string | number; 
  unit?: string; 
  color?: string;
  subtitle?: string;
  size?: 'normal' | 'large';
}) {
  return (
    <div className={`whoop-stat-card ${size === 'large' ? 'whoop-stat-large' : ''}`}>
      <div className="whoop-stat-label">{label}</div>
      <div className="whoop-stat-value" style={{ color: color || 'var(--third)' }}>
        {value}
        {unit && <span className="whoop-stat-unit">{unit}</span>}
      </div>
      {subtitle && <div className="whoop-stat-subtitle">{subtitle}</div>}
    </div>
  );
}

function RecoveryRing({ score, status }: { score: number | null; status: string }) {
  const percentage = score ?? 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color = getRecoveryColor(status);
  
  return (
    <div className="whoop-ring-container">
      <svg className="whoop-ring" viewBox="0 0 100 100">
        <circle
          className="whoop-ring-bg"
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
        />
        <circle
          className="whoop-ring-progress"
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ stroke: color }}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="whoop-ring-content">
        <div className="whoop-ring-value" style={{ color }}>{score ?? '—'}</div>
        <div className="whoop-ring-label">Recovery</div>
      </div>
    </div>
  );
}

function SleepStagesBar({ stages }: { stages: SleepStages }) {
  const total = stages.rem_min + stages.deep_min + stages.light_min + stages.awake_min;
  if (total === 0) return <div className="whoop-sleep-stages-empty">No sleep data</div>;
  
  const remPercent = (stages.rem_min / total) * 100;
  const deepPercent = (stages.deep_min / total) * 100;
  const lightPercent = (stages.light_min / total) * 100;
  const awakePercent = (stages.awake_min / total) * 100;
  
  return (
    <div className="whoop-sleep-stages">
      <div className="whoop-stages-bar">
        <div className="whoop-stage whoop-stage-deep" style={{ width: `${deepPercent}%` }} title={`Deep: ${Math.round(stages.deep_min)}min`} />
        <div className="whoop-stage whoop-stage-rem" style={{ width: `${remPercent}%` }} title={`REM: ${Math.round(stages.rem_min)}min`} />
        <div className="whoop-stage whoop-stage-light" style={{ width: `${lightPercent}%` }} title={`Light: ${Math.round(stages.light_min)}min`} />
        <div className="whoop-stage whoop-stage-awake" style={{ width: `${awakePercent}%` }} title={`Awake: ${Math.round(stages.awake_min)}min`} />
      </div>
      <div className="whoop-stages-legend">
        <span className="whoop-legend-item"><span className="whoop-legend-dot whoop-stage-deep"></span>Deep {Math.round(stages.deep_min)}m</span>
        <span className="whoop-legend-item"><span className="whoop-legend-dot whoop-stage-rem"></span>REM {Math.round(stages.rem_min)}m</span>
        <span className="whoop-legend-item"><span className="whoop-legend-dot whoop-stage-light"></span>Light {Math.round(stages.light_min)}m</span>
        <span className="whoop-legend-item"><span className="whoop-legend-dot whoop-stage-awake"></span>Awake {Math.round(stages.awake_min)}m</span>
      </div>
    </div>
  );
}

function StrainGauge({ strain }: { strain: number }) {
  const maxStrain = 21;
  const percentage = Math.min((strain / maxStrain) * 100, 100);
  const color = getStrainColor(strain);
  
  return (
    <div className="whoop-strain-gauge">
      <div className="whoop-strain-bar-container">
        <div 
          className="whoop-strain-bar-fill" 
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
        <div className="whoop-strain-markers">
          {[0, 7, 14, 21].map(mark => (
            <span key={mark} style={{ left: `${(mark / maxStrain) * 100}%` }}>{mark}</span>
          ))}
        </div>
      </div>
      <div className="whoop-strain-value" style={{ color }}>
        {strain.toFixed(1)}
        <span className="whoop-strain-max">/21</span>
      </div>
    </div>
  );
}

function WorkoutCard({ workout }: { workout: Workout }) {
  const date = workout.start_time ? new Date(workout.start_time) : null;
  
  return (
    <div className="whoop-workout-card">
      <div className="whoop-workout-header">
        <div className="whoop-workout-sport">{workout.sport_name}</div>
        <div className="whoop-workout-strain" style={{ color: getStrainColor(workout.strain) }}>
          {workout.strain.toFixed(1)} strain
        </div>
      </div>
      <div className="whoop-workout-meta">
        <span>{date ? formatDate(date.toISOString()) : '—'}</span>
        <span>{workout.duration_min}min</span>
        <span>{workout.calories} kJ</span>
        {workout.average_heart_rate && <span>Avg HR: {Math.round(workout.average_heart_rate)}</span>}
      </div>
    </div>
  );
}

function TrendIndicator({ current, average }: { current: number; average: number }) {
  const diff = current - average;
  const percentage = average !== 0 ? ((diff / average) * 100).toFixed(0) : '0';
  const isUp = diff > 0;
  
  return (
    <span className={`whoop-trend ${isUp ? 'whoop-trend-up' : 'whoop-trend-down'}`}>
      {isUp ? '↑' : '↓'} {Math.abs(Number(percentage))}%
    </span>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="whoop-mini-sparkline" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ==================== Date Navigator Component ====================

function DateNavigator({ 
  selectedDate, 
  onDateChange,
  availableDates,
  onOpenCalendar
}: { 
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  availableDates: string[];
  onOpenCalendar: () => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const isToday = getDateString(selectedDate) === getDateString(today);
  
  // Find the oldest available date
  const oldestDate = availableDates.length > 0 
    ? new Date(availableDates[availableDates.length - 1]) 
    : new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const canGoForward = !isToday;
  const canGoBack = getDateString(selectedDate) > getDateString(oldestDate);
  
  const goToPreviousDay = () => {
    if (canGoBack) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() - 1);
      onDateChange(newDate);
    }
  };
  
  const goToNextDay = () => {
    if (canGoForward) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + 1);
      onDateChange(newDate);
    }
  };
  
  const goToToday = () => {
    onDateChange(today);
  };

  return (
    <div className="whoop-date-navigator">
      <button 
        className="whoop-date-nav-btn" 
        onClick={goToPreviousDay}
        disabled={!canGoBack}
        title="Previous day"
      >
        ←
      </button>
      
      <div className="whoop-date-display" onClick={onOpenCalendar}>
        <span className="whoop-date-label">{formatFullDate(selectedDate)}</span>
        <span className="whoop-date-sub">{formatCalendarDate(selectedDate)}</span>
      </div>
      
      <button 
        className="whoop-date-nav-btn" 
        onClick={goToNextDay}
        disabled={!canGoForward}
        title="Next day"
      >
        →
      </button>
      
      {!isToday && (
        <button 
          className="whoop-today-btn"
          onClick={goToToday}
          title="Go to today"
        >
          Today
        </button>
      )}
    </div>
  );
}

// ==================== Date Picker Modal ====================

function DatePickerModal({ 
  selectedDate,
  availableDates,
  recoveryHistory,
  onSelect,
  onClose 
}: { 
  selectedDate: Date;
  availableDates: string[];
  recoveryHistory: Recovery[];
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const [viewMonth, setViewMonth] = useState(new Date(selectedDate));
  
  // Get all days in the current view month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    
    // Add all days in the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };
  
  const days = getDaysInMonth(viewMonth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get recovery status for a date
  const getRecoveryForDate = (date: Date): Recovery | undefined => {
    const dateStr = getDateString(date);
    return recoveryHistory.find(r => isSameDate(r.date, dateStr));
  };
  
  const hasDataForDate = (date: Date): boolean => {
    const dateStr = getDateString(date);
    return availableDates.some(d => isSameDate(d, dateStr));
  };
  
  const previousMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };
  
  const nextMonth = () => {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    if (next <= today) {
      setViewMonth(next);
    }
  };

  return (
    <div className="whoop-panel-overlay" onClick={onClose}>
      <div className="whoop-date-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="whoop-date-picker-header">
          <button className="whoop-date-nav-btn" onClick={previousMonth}>←</button>
          <h3>
            {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button 
            className="whoop-date-nav-btn" 
            onClick={nextMonth}
            disabled={viewMonth.getMonth() === today.getMonth() && viewMonth.getFullYear() === today.getFullYear()}
          >
            →
          </button>
        </div>
        
        <div className="whoop-calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="whoop-weekday">{day}</div>
          ))}
        </div>
        
        <div className="whoop-calendar-grid">
          {days.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="whoop-calendar-day empty" />;
            }
            
            const recovery = getRecoveryForDate(day);
            const hasData = hasDataForDate(day);
            const isSelected = getDateString(day) === getDateString(selectedDate);
            const isTodayDate = getDateString(day) === getDateString(today);
            const isFuture = day > today;
            
            return (
              <button
                key={day.toISOString()}
                className={`whoop-calendar-day 
                  ${isSelected ? 'selected' : ''} 
                  ${isTodayDate ? 'today' : ''} 
                  ${hasData ? 'has-data' : 'no-data'}
                  ${isFuture ? 'future' : ''}`}
                onClick={() => {
                  if (!isFuture && hasData) {
                    onSelect(day);
                    onClose();
                  }
                }}
                disabled={isFuture || !hasData}
              >
                <span className="whoop-day-number">{day.getDate()}</span>
                {recovery && (
                  <span 
                    className="whoop-day-indicator"
                    style={{ backgroundColor: getRecoveryColor(recovery.recovery_status) }}
                  />
                )}
              </button>
            );
          })}
        </div>
        
        <div className="whoop-date-picker-legend">
          <span className="whoop-legend-item">
            <span className="whoop-legend-dot" style={{ backgroundColor: '#00d084' }}></span>
            Green
          </span>
          <span className="whoop-legend-item">
            <span className="whoop-legend-dot" style={{ backgroundColor: '#ffb800' }}></span>
            Yellow
          </span>
          <span className="whoop-legend-item">
            <span className="whoop-legend-dot" style={{ backgroundColor: '#ff4757' }}></span>
            Red
          </span>
        </div>
        
        <button className="whoop-date-picker-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

// ==================== Auth Error Component ====================

function AuthErrorDisplay({ 
  errorType, 
  apiStatus, 
  onTestAuth, 
  onRetry,
  testing 
}: { 
  errorType: AuthErrorType;
  apiStatus: ApiStatus | null;
  onTestAuth: () => void;
  onRetry: () => void;
  testing: boolean;
}) {
  const getErrorContent = () => {
    switch (errorType) {
      case 'not_configured':
        return {
          icon: '⚙️',
          title: 'Whoop API Not Configured',
          description: 'The backend is missing Whoop API credentials. Please update the .env file on the server.',
          details: (
            <div className="whoop-auth-details">
              <p>Required environment variables:</p>
              <code>
                WHOOP_CLIENT_ID=your_client_id<br/>
                WHOOP_CLIENT_SECRET=your_client_secret<br/>
                WHOOP_REFRESH_TOKEN=your_refresh_token
              </code>
            </div>
          ),
          actionLabel: 'Get Whoop API Access',
          actionUrl: 'https://developer.whoop.com'
        };
        
      case 'token_expired':
        return {
          icon: '🔑',
          title: 'Whoop Token Expired',
          description: 'Your Whoop refresh token has expired or been invalidated. You need to re-authorize the application.',
          details: (
            <div className="whoop-auth-details">
              <p>To fix this:</p>
              <ol>
                <li>Go to the Whoop Developer Portal</li>
                <li>Re-authorize your application</li>
                <li>Copy the new refresh token</li>
                <li>Update WHOOP_REFRESH_TOKEN in your .env file</li>
              </ol>
            </div>
          ),
          actionLabel: 'Re-authorize on Whoop',
          actionUrl: 'https://developer.whoop.com'
        };
        
      case 'auth_failed':
        return {
          icon: '❌',
          title: 'Authentication Failed',
          description: 'Could not authenticate with the Whoop API. The credentials may be incorrect.',
          details: apiStatus?.error ? (
            <div className="whoop-auth-details">
              <p>Error: {apiStatus.error}</p>
            </div>
          ) : null,
          actionLabel: 'Check Whoop Developer Portal',
          actionUrl: 'https://developer.whoop.com'
        };
        
      case 'network_error':
        return {
          icon: '🌐',
          title: 'Connection Error',
          description: 'Could not connect to the backend server. Please check if it\'s running.',
          details: null,
          actionLabel: null,
          actionUrl: null
        };
        
      default:
        return {
          icon: '⚠️',
          title: 'Unknown Error',
          description: 'An unexpected error occurred.',
          details: null,
          actionLabel: null,
          actionUrl: null
        };
    }
  };

  const content = getErrorContent();

  return (
    <div className="whoop-auth-error">
      <div className="whoop-auth-error-icon">{content.icon}</div>
      <h2>{content.title}</h2>
      <p className="whoop-auth-error-description">{content.description}</p>
      
      {content.details}
      
      <div className="whoop-auth-status">
        <div className="whoop-auth-status-header">Connection Status</div>
        <div className="whoop-auth-status-grid">
          <div className={`whoop-auth-status-item ${apiStatus?.has_client_credentials ? 'success' : 'error'}`}>
            <span className="whoop-auth-status-indicator"></span>
            Client Credentials
          </div>
          <div className={`whoop-auth-status-item ${apiStatus?.has_refresh_token ? 'success' : 'error'}`}>
            <span className="whoop-auth-status-indicator"></span>
            Refresh Token
          </div>
          <div className={`whoop-auth-status-item ${apiStatus?.has_access_token ? 'success' : 'warning'}`}>
            <span className="whoop-auth-status-indicator"></span>
            Access Token
          </div>
          <div className={`whoop-auth-status-item ${apiStatus?.authenticated ? 'success' : 'error'}`}>
            <span className="whoop-auth-status-indicator"></span>
            Authenticated
          </div>
        </div>
      </div>
      
      <div className="whoop-auth-actions">
        <button 
          className="whoop-auth-btn whoop-auth-btn-primary"
          onClick={onTestAuth}
          disabled={testing}
        >
          {testing ? 'Testing...' : 'Test Authentication'}
        </button>
        
        <button 
          className="whoop-auth-btn whoop-auth-btn-secondary"
          onClick={onRetry}
        >
          Retry Connection
        </button>
        
        {content.actionUrl && (
          <a 
            href={content.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="whoop-auth-btn whoop-auth-btn-link"
          >
            {content.actionLabel} →
          </a>
        )}
      </div>
    </div>
  );
}

// ==================== Main Dashboard ====================

export default function WhoopDashboard() {
  const [latestRecovery, setLatestRecovery] = useState<Recovery | null>(null);
  const [latestSleep, setLatestSleep] = useState<Sleep | null>(null);
  const [recoveryHistory, setRecoveryHistory] = useState<Recovery[]>([]);
  const [sleepHistory, setSleepHistory] = useState<Sleep[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [metrics, setMetrics] = useState<AggregatedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [authErrorType, setAuthErrorType] = useState<AuthErrorType>(null);
  const [testingAuth, setTestingAuth] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // State for "Show More" functionality
  const [recoveryDaysLoaded, setRecoveryDaysLoaded] = useState(14);
  const [sleepDaysLoaded, setSleepDaysLoaded] = useState(14);
  const [strainDaysLoaded, setStrainDaysLoaded] = useState(14);
  const [loadingMoreRecovery, setLoadingMoreRecovery] = useState(false);
  const [loadingMoreSleep, setLoadingMoreSleep] = useState(false);
  const [loadingMoreStrain, setLoadingMoreStrain] = useState(false);
  const [noMoreRecoveryData, setNoMoreRecoveryData] = useState(false);
  const [noMoreSleepData, setNoMoreSleepData] = useState(false);
  const [noMoreStrainData, setNoMoreStrainData] = useState(false);

  const checkAuthStatus = useCallback(async (): Promise<{ ok: boolean; status: ApiStatus | null; errorType: AuthErrorType }> => {
    try {
      const statusRes = await fetch(`${API_BASE_URL}/api/whoop/status`);
      
      if (!statusRes.ok) {
        return { ok: false, status: null, errorType: 'network_error' };
      }
      
      const status: ApiStatus = await statusRes.json();
      
      if (!status.configured) {
        return { ok: false, status, errorType: 'not_configured' };
      }
      
      if (status.authenticated === false) {
        if (!status.has_refresh_token) {
          return { ok: false, status, errorType: 'not_configured' };
        }
        return { ok: false, status, errorType: 'token_expired' };
      }
      
      return { ok: true, status, errorType: null };
    } catch (err) {
      console.error('Error checking auth status:', err);
      return { ok: false, status: null, errorType: 'network_error' };
    }
  }, []);

  const testAuthentication = async () => {
    setTestingAuth(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/whoop/auth/test`);
      const data: AuthTestResult = await res.json();
      
      if (data.success) {
        setAuthErrorType(null);
        await fetchData();
        alert(`✅ Authentication successful! Connected as ${data.profile?.first_name || 'User'}`);
      } else {
        if (data.error?.includes('not configured')) {
          setAuthErrorType('not_configured');
        } else if (data.error?.includes('expired') || data.error?.includes('invalid_grant')) {
          setAuthErrorType('token_expired');
        } else {
          setAuthErrorType('auth_failed');
        }
        setApiStatus(prev => prev ? { ...prev, error: data.error || data.details, authenticated: false } : null);
      }
    } catch (err) {
      console.error('Auth test failed:', err);
      setAuthErrorType('network_error');
    } finally {
      setTestingAuth(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const authCheck = await checkAuthStatus();
      setApiStatus(authCheck.status);
      
      if (!authCheck.ok) {
        setAuthErrorType(authCheck.errorType);
        setLoading(false);
        return;
      }
      
      setAuthErrorType(null);

      const [
        latestRecoveryRes,
        latestSleepRes,
        recoveryRes,
        sleepRes,
        workoutsRes,
        cyclesRes,
        metricsRes
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/api/whoop/recovery/latest`),
        fetch(`${API_BASE_URL}/api/whoop/sleep/latest`),
        fetch(`${API_BASE_URL}/api/whoop/recovery?days=14`),
        fetch(`${API_BASE_URL}/api/whoop/sleep?days=14`),
        fetch(`${API_BASE_URL}/api/whoop/workouts?days=14`),
        fetch(`${API_BASE_URL}/api/whoop/cycles?days=14`),
        fetch(`${API_BASE_URL}/api/whoop/metrics?days=30`)
      ]);

      const responses = [latestRecoveryRes, latestSleepRes, recoveryRes, sleepRes, workoutsRes, cyclesRes, metricsRes];
      for (const res of responses) {
        if (res.status === 401) {
          setAuthErrorType('token_expired');
          setLoading(false);
          return;
        }
        if (res.status === 400) {
          const errorData = await res.clone().json().catch(() => ({}));
          if (errorData.error?.includes('not configured')) {
            setAuthErrorType('not_configured');
            setLoading(false);
            return;
          }
        }
      }

      if (latestRecoveryRes.ok) {
        setLatestRecovery(await latestRecoveryRes.json());
      }
      
      if (latestSleepRes.ok) {
        setLatestSleep(await latestSleepRes.json());
      }
      
      if (recoveryRes.ok) {
        setRecoveryHistory(await recoveryRes.json());
      }
      
      if (sleepRes.ok) {
        setSleepHistory(await sleepRes.json());
      }
      
      if (workoutsRes.ok) {
        setWorkouts(await workoutsRes.json());
      }
      
      if (cyclesRes.ok) {
        setCycles(await cyclesRes.json());
      }
      
      if (metricsRes.ok) {
        setMetrics(await metricsRes.json());
      }

    } catch (err) {
      console.error('Error fetching Whoop data:', err);
      setError('Failed to load Whoop data. Make sure the backend is running.');
      setAuthErrorType('network_error');
    } finally {
      setLoading(false);
    }
  }, [checkAuthStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Close panel on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePanel(null);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/whoop/refresh`, { method: 'POST' });
      
      if (res.status === 401) {
        setAuthErrorType('token_expired');
        return;
      }
      
      if (res.status === 400) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.error?.includes('not configured')) {
          setAuthErrorType('not_configured');
          return;
        }
      }
      
      if (!res.ok) throw new Error('Refresh failed');
      await fetchData();
    } catch (err) {
      console.error('Refresh failed:', err);
      alert('Failed to refresh Whoop data.');
    } finally {
      setRefreshing(false);
    }
  };

  // Load more recovery data
  const loadMoreRecovery = async () => {
    if (noMoreRecoveryData) return;
    setLoadingMoreRecovery(true);
    try {
      const newDays = recoveryDaysLoaded + 14;
      const res = await fetch(`${API_BASE_URL}/api/whoop/recovery?days=${newDays}`);
      if (res.ok) {
        const data = await res.json();
        // Check if we got more data than before
        if (data.length <= recoveryHistory.length) {
          setNoMoreRecoveryData(true);
        }
        setRecoveryHistory(data);
        setRecoveryDaysLoaded(newDays);
      }
    } catch (err) {
      console.error('Failed to load more recovery data:', err);
    } finally {
      setLoadingMoreRecovery(false);
    }
  };

  // Load more sleep data
  const loadMoreSleep = async () => {
    if (noMoreSleepData) return;
    setLoadingMoreSleep(true);
    try {
      const newDays = sleepDaysLoaded + 14;
      const res = await fetch(`${API_BASE_URL}/api/whoop/sleep?days=${newDays}`);
      if (res.ok) {
        const data = await res.json();
        // Check if we got more data than before
        if (data.length <= sleepHistory.length) {
          setNoMoreSleepData(true);
        }
        setSleepHistory(data);
        setSleepDaysLoaded(newDays);
      }
    } catch (err) {
      console.error('Failed to load more sleep data:', err);
    } finally {
      setLoadingMoreSleep(false);
    }
  };

  // Load more strain/cycle data
  const loadMoreStrain = async () => {
    if (noMoreStrainData) return;
    setLoadingMoreStrain(true);
    try {
      const newDays = strainDaysLoaded + 14;
      const res = await fetch(`${API_BASE_URL}/api/whoop/cycles?days=${newDays}`);
      if (res.ok) {
        const data = await res.json();
        // Check if we got more data than before
        if (data.length <= cycles.length) {
          setNoMoreStrainData(true);
        }
        setCycles(data);
        setStrainDaysLoaded(newDays);
      }
    } catch (err) {
      console.error('Failed to load more strain data:', err);
    } finally {
      setLoadingMoreStrain(false);
    }
  };

  // Get data for selected date
  const selectedDateStr = getDateString(selectedDate);
  
  // Find recovery, sleep, and cycle for the selected date
  const selectedRecovery = recoveryHistory.find(r => isSameDate(r.date, selectedDateStr)) || null;
  const selectedSleep = sleepHistory.find(s => isSameDate(s.date, selectedDateStr)) || null;
  const selectedCycle = cycles.find(c => isSameDate(c.date, selectedDateStr)) || null;
  
  // Get workouts for the selected date
  const selectedWorkouts = workouts.filter(w => {
    if (!w.start_time) return false;
    return isSameDate(w.start_time, selectedDateStr);
  });
  
  // Available dates for navigation (from recovery history as primary source)
  const availableDates = recoveryHistory.map(r => r.date);
  
  // Check if viewing today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isViewingToday = getDateString(selectedDate) === getDateString(today);

  // Calculate derived metrics for selected date
  const readinessScore = calculateReadinessScore(selectedRecovery, selectedSleep);
  const readinessStatus = getReadinessStatus(readinessScore);
  
  // Sparkline data (always shows 7 days regardless of selected date)
  const recoverySparkline = recoveryHistory.slice(0, 7).reverse().map(r => r.recovery_score ?? 0);
  const sleepSparkline = sleepHistory.slice(0, 7).reverse().map(s => s.total_sleep_hours ?? 0);
  const strainSparkline = cycles.slice(0, 7).reverse().map(c => c.strain ?? 0);
  
  // Calculate sleep quality index for selected date
  const sleepQualityIndex = selectedSleep ? 
    Math.round(
      (selectedSleep.sleep_efficiency ?? 0) * 0.3 +
      (selectedSleep.sleep_performance ?? 0) * 0.4 +
      (selectedSleep.sleep_consistency ?? 0) * 0.3
    ) : null;

  // Calculate training load balance
  const avgRecovery = metrics?.recovery.average_score ?? 0;
  const avgStrain = metrics?.strain.average_daily_strain ?? 0;
  const loadBalance = avgRecovery > 0 ? (avgStrain / avgRecovery * 50).toFixed(1) : '—';

  if (loading) {
    return (
      <div className="whoop-loading">
        <div className="whoop-loading-spinner"></div>
        <p>Loading Whoop data...</p>
      </div>
    );
  }

  if (authErrorType) {
    return (
      <AuthErrorDisplay
        errorType={authErrorType}
        apiStatus={apiStatus}
        onTestAuth={testAuthentication}
        onRetry={fetchData}
        testing={testingAuth}
      />
    );
  }

  return (
    <div className="whoop-dashboard">
      {/* Detail Panels Overlay */}
      {activePanel && (
        <div className="whoop-panel-overlay" onClick={() => setActivePanel(null)}>
          <div className="whoop-panel-content" onClick={(e) => e.stopPropagation()}>
            {activePanel === 'recovery' && (
              <RecoveryChart 
                data={recoveryHistory} 
                onClose={() => setActivePanel(null)} 
                onLoadMore={loadMoreRecovery}
                loading={loadingMoreRecovery}
                noMoreData={noMoreRecoveryData}
              />
            )}
            {activePanel === 'sleep' && (
              <SleepChart 
                data={sleepHistory} 
                onClose={() => setActivePanel(null)} 
                onLoadMore={loadMoreSleep}
                loading={loadingMoreSleep}
                noMoreData={noMoreSleepData}
              />
            )}
            {activePanel === 'strain' && (
              <StrainChart 
                data={cycles} 
                workouts={workouts} 
                onClose={() => setActivePanel(null)} 
                onLoadMore={loadMoreStrain}
                loading={loadingMoreStrain}
                noMoreData={noMoreStrainData}
              />
            )}
          </div>
        </div>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DatePickerModal
          selectedDate={selectedDate}
          availableDates={availableDates}
          recoveryHistory={recoveryHistory}
          onSelect={setSelectedDate}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {/* Hero Section with Readiness */}
      <section className="whoop-hero">
        <div className="whoop-hero-content">
          <div className="whoop-hero-left">
            <DateNavigator
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              availableDates={availableDates}
              onOpenCalendar={() => setShowDatePicker(true)}
            />
            <h1 className="whoop-readiness-title">
              <span className="whoop-readiness-score" style={{ color: readinessStatus.color }}>
                {readinessScore ?? '—'}
              </span>
              <span className="whoop-readiness-label">{readinessStatus.label}</span>
            </h1>
            <p className="whoop-readiness-description">
              {!selectedRecovery && !selectedSleep 
                ? "No data available for this day."
                : readinessScore !== null && readinessScore >= 67 
                ? isViewingToday 
                  ? "Primed for peak performance"
                  : "Primed for peak performance"
                : readinessScore !== null && readinessScore >= 34
                ? isViewingToday
                  ? "Recovery in progress. Moderate activity recommended."
                  : "Recovery mode"
                : isViewingToday
                  ? "Rest needed. Focus on recovery."
                  : "Rest required"
              }
            </p>
            {isViewingToday && (
              <button 
                className="whoop-refresh-btn" 
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? 'Syncing...' : 'Sync Whoop Data'}
              </button>
            )}
          </div>
          <div className="whoop-hero-right">
            <RecoveryRing 
              score={selectedRecovery?.recovery_score ?? null}
              status={selectedRecovery?.recovery_status ?? 'unknown'}
            />
          </div>
        </div>
      </section>

      {/* Primary Metrics Grid - Now Clickable! */}
      <section className="whoop-section">
        <div className="whoop-section-header">
          <h2 className="caps">Core Metrics</h2>
          <span className="whoop-section-subtitle">Click any card to see detailed history</span>
        </div>
        <div className="whoop-metrics-grid whoop-metrics-primary">
          {/* Recovery Panel - Clickable */}
          <div 
            className="whoop-metric-panel whoop-panel-recovery whoop-panel-clickable"
            onClick={() => setActivePanel('recovery')}
          >
            <div className="whoop-panel-header">
              <h3>Recovery</h3>
              <div className="whoop-panel-actions">
                {metrics && selectedRecovery?.recovery_score && (
                  <TrendIndicator 
                    current={selectedRecovery.recovery_score} 
                    average={metrics.recovery.average_score}
                  />
                )}
                <span className="whoop-expand-hint">View Details →</span>
              </div>
            </div>
            <div className="whoop-panel-content">
              <div className="whoop-panel-main-stat">
                <span className="whoop-main-value" style={{ color: getRecoveryColor(selectedRecovery?.recovery_status ?? 'unknown') }}>
                  {selectedRecovery?.recovery_score ?? '—'}%
                </span>
                <MiniSparkline data={recoverySparkline} color="#00d084" />
              </div>
              <div className="whoop-recovery-stats">
                <StatCard 
                  label="HRV" 
                  value={selectedRecovery?.hrv_rmssd?.toFixed(0) ?? '—'} 
                  unit="ms"
                />
                <StatCard 
                  label="Resting HR" 
                  value={selectedRecovery?.resting_heart_rate?.toFixed(0) ?? '—'} 
                  unit="bpm"
                />
                <StatCard 
                  label="SpO2" 
                  value={selectedRecovery?.spo2_percentage?.toFixed(1) ?? '—'} 
                  unit="%"
                />
              </div>
            </div>
          </div>

          {/* Sleep Panel - Clickable */}
          <div 
            className="whoop-metric-panel whoop-panel-sleep whoop-panel-clickable"
            onClick={() => setActivePanel('sleep')}
          >
            <div className="whoop-panel-header">
              <h3>Sleep</h3>
              <div className="whoop-panel-actions">
                {selectedSleep && (
                  <span className="whoop-sleep-time">
                    {formatTime(selectedSleep.start_time)} → {formatTime(selectedSleep.end_time)}
                  </span>
                )}
                <span className="whoop-expand-hint">View Details →</span>
              </div>
            </div>
            <div className="whoop-panel-content">
              <div className="whoop-panel-main-stat">
                <span className="whoop-main-value" style={{ color: '#8b5cf6' }}>
                  {selectedSleep?.total_sleep_hours?.toFixed(1) ?? '—'}h
                </span>
                <MiniSparkline data={sleepSparkline} color="#8b5cf6" />
              </div>
              <div className="whoop-sleep-scores">
                <StatCard 
                  label="Performance" 
                  value={selectedSleep?.sleep_performance?.toFixed(0) ?? '—'} 
                  unit="%"
                />
                <StatCard 
                  label="Efficiency" 
                  value={selectedSleep?.sleep_efficiency?.toFixed(0) ?? '—'} 
                  unit="%"
                />
                <StatCard 
                  label="Consistency" 
                  value={selectedSleep?.sleep_consistency?.toFixed(0) ?? '—'} 
                  unit="%"
                />
              </div>
              {selectedSleep && <SleepStagesBar stages={selectedSleep.stages} />}
            </div>
          </div>

          {/* Strain Panel - Clickable */}
          <div 
            className="whoop-metric-panel whoop-panel-strain whoop-panel-clickable"
            onClick={() => setActivePanel('strain')}
          >
            <div className="whoop-panel-header">
              <h3>Day Strain</h3>
              <div className="whoop-panel-actions">
                <span className="whoop-expand-hint">View Details →</span>
              </div>
            </div>
            <div className="whoop-panel-content">
              {selectedCycle ? (
                <>
                  <div className="whoop-panel-main-stat">
                    <span className="whoop-main-value" style={{ color: getStrainColor(selectedCycle.strain) }}>
                      {selectedCycle.strain.toFixed(1)}
                    </span>
                    <MiniSparkline data={strainSparkline} color="#ff6b35" />
                  </div>
                  <StrainGauge strain={selectedCycle.strain} />
                  <div className="whoop-strain-details">
                    <StatCard 
                      label="Calories" 
                      value={selectedCycle.kilojoules?.toLocaleString() ?? '—'} 
                      unit="kJ"
                    />
                    <StatCard 
                      label="Avg HR" 
                      value={selectedCycle.average_heart_rate?.toFixed(0) ?? '—'} 
                      unit="bpm"
                    />
                    <StatCard 
                      label="Max HR" 
                      value={selectedCycle.max_heart_rate?.toFixed(0) ?? '—'} 
                      unit="bpm"
                    />
                  </div>
                </>
              ) : (
                <div className="whoop-no-data">No strain data for this day</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Trends Section */}
      <section className="whoop-section">
        <h2 className="caps">7-Day Trends</h2>
        <div className="whoop-trends-grid-detailed">
          {/* Recovery Trend */}
          <div className="whoop-trend-card-detailed" onClick={() => setActivePanel('recovery')}>
            <div className="whoop-trend-header-detailed">
              <div className="whoop-trend-title-group">
                <span className="whoop-trend-title">Recovery</span>
                <span className="whoop-trend-unit">%</span>
              </div>
              <div className="whoop-trend-summary">
                <span className="whoop-trend-current" style={{ color: getRecoveryColor(recoveryHistory[0]?.recovery_status ?? 'unknown') }}>
                  {recoveryHistory[0]?.recovery_score ?? '—'}%
                </span>
                <span className="whoop-trend-avg-label">avg {metrics?.recovery.average_score.toFixed(0) ?? '—'}%</span>
              </div>
            </div>
            <div className="whoop-trend-chart-detailed">
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart 
                  data={recoveryHistory.slice(0, 7).reverse().map(r => ({ 
                    value: r.recovery_score ?? 0, 
                    date: formatShortDate(r.date),
                    fullDate: r.date,
                    status: r.recovery_status
                  }))}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="recoveryTrendGradDetailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d084" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#00d084" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    ticks={[0, 33, 67, 100]}
                    width={30}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(20, 20, 25, 0.95)', 
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                    formatter={(value: number | undefined) => value !== undefined ? [`${value}%`, 'Recovery'] : ['—', 'Recovery']}
                    labelFormatter={(label) => `${label}`}
                    cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                  />
                  <ReferenceLine y={67} stroke="rgba(0,208,132,0.3)" strokeDasharray="3 3" />
                  <ReferenceLine y={33} stroke="rgba(255,71,87,0.3)" strokeDasharray="3 3" />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#00d084" 
                    fill="url(#recoveryTrendGradDetailed)" 
                    strokeWidth={2.5}
                    dot={{ fill: '#00d084', strokeWidth: 0, r: 3 }}
                    activeDot={{ fill: '#00d084', strokeWidth: 2, stroke: '#fff', r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="whoop-trend-footer">
              <span className="whoop-trend-range">
                Range: {Math.min(...recoveryHistory.slice(0, 7).map(r => r.recovery_score ?? 0))}% - {Math.max(...recoveryHistory.slice(0, 7).map(r => r.recovery_score ?? 0))}%
              </span>
              <span className="whoop-trend-click-hint">Click for details →</span>
            </div>
          </div>

          {/* Sleep Trend */}
          <div className="whoop-trend-card-detailed" onClick={() => setActivePanel('sleep')}>
            <div className="whoop-trend-header-detailed">
              <div className="whoop-trend-title-group">
                <span className="whoop-trend-title">Sleep</span>
                <span className="whoop-trend-unit">hours</span>
              </div>
              <div className="whoop-trend-summary">
                <span className="whoop-trend-current" style={{ color: '#8b5cf6' }}>
                  {sleepHistory[0]?.total_sleep_hours.toFixed(1) ?? '—'}h
                </span>
                <span className="whoop-trend-avg-label">avg {metrics?.sleep.average_hours.toFixed(1) ?? '—'}h</span>
              </div>
            </div>
            <div className="whoop-trend-chart-detailed">
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart 
                  data={sleepHistory.slice(0, 7).reverse().map(s => ({ 
                    value: s.total_sleep_hours ?? 0, 
                    date: formatShortDate(s.date),
                    performance: s.sleep_performance
                  }))}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="sleepTrendGradDetailed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    ticks={[0, 4, 7, 10]}
                    width={30}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(20, 20, 25, 0.95)', 
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                    formatter={(value: number | undefined, name: string | undefined, props: { payload?: { performance?: number } }) => {
                      if (value === undefined) return ['—', 'Sleep'];
                      const perf = props.payload?.performance;
                      return [`${value.toFixed(1)}h${perf ? ` (${perf}% perf)` : ''}`, 'Sleep'];
                    }}
                    labelFormatter={(label) => `${label}`}
                    cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                  />
                  <ReferenceLine y={7} stroke="rgba(139,92,246,0.4)" strokeDasharray="3 3" label={{ value: '7h goal', fill: 'rgba(139,92,246,0.6)', fontSize: 9, position: 'right' }} />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8b5cf6" 
                    fill="url(#sleepTrendGradDetailed)" 
                    strokeWidth={2.5}
                    dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 3 }}
                    activeDot={{ fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff', r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="whoop-trend-footer">
              <span className="whoop-trend-range">
                Range: {Math.min(...sleepHistory.slice(0, 7).map(s => s.total_sleep_hours ?? 0)).toFixed(1)}h - {Math.max(...sleepHistory.slice(0, 7).map(s => s.total_sleep_hours ?? 0)).toFixed(1)}h
              </span>
              <span className="whoop-trend-click-hint">Click for details →</span>
            </div>
          </div>

          {/* Strain Trend */}
          <div className="whoop-trend-card-detailed" onClick={() => setActivePanel('strain')}>
            <div className="whoop-trend-header-detailed">
              <div className="whoop-trend-title-group">
                <span className="whoop-trend-title">Strain</span>
                <span className="whoop-trend-unit">0-21 scale</span>
              </div>
              <div className="whoop-trend-summary">
                <span className="whoop-trend-current" style={{ color: getStrainColor(cycles[0]?.strain ?? 0) }}>
                  {cycles[0]?.strain.toFixed(1) ?? '—'}
                </span>
                <span className="whoop-trend-avg-label">avg {metrics?.strain.average_daily_strain.toFixed(1) ?? '—'}</span>
              </div>
            </div>
            <div className="whoop-trend-chart-detailed">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart 
                  data={cycles.slice(0, 7).reverse().map(c => ({ 
                    value: c.strain ?? 0, 
                    date: formatShortDate(c.date),
                    calories: c.kilojoules
                  }))}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={10} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    domain={[0, 21]} 
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    ticks={[0, 7, 14, 21]}
                    width={30}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(20, 20, 25, 0.95)', 
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                    formatter={(value: number | undefined, name: string | undefined, props: { payload?: { calories?: number } }) => {
                      if (value === undefined) return ['—', 'Strain'];
                      const cal = props.payload?.calories;
                      return [`${value.toFixed(1)}${cal ? ` (${cal} kJ)` : ''}`, 'Strain'];
                    }}
                    labelFormatter={(label) => `${label}`}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <ReferenceLine y={14} stroke="rgba(255,107,53,0.3)" strokeDasharray="3 3" />
                  <Bar 
                    dataKey="value" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  >
                    {cycles.slice(0, 7).reverse().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getStrainColor(entry.strain)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="whoop-trend-footer">
              <span className="whoop-trend-range">
                Range: {Math.min(...cycles.slice(0, 7).map(c => c.strain ?? 0)).toFixed(1)} - {Math.max(...cycles.slice(0, 7).map(c => c.strain ?? 0)).toFixed(1)}
              </span>
              <span className="whoop-trend-click-hint">Click for details →</span>
            </div>
          </div>
        </div>
      </section>

      {/* Derived Insights */}
      <section className="whoop-section">
        <h2 className="caps">Insights & Analysis</h2>
        <div className="whoop-insights-grid">
          <div className="whoop-insight-card">
            <div className="whoop-insight-icon">🎯</div>
            <div className="whoop-insight-content">
              <div className="whoop-insight-label">Sleep Quality Index</div>
              <div className="whoop-insight-value" style={{ color: sleepQualityIndex && sleepQualityIndex >= 70 ? '#00d084' : sleepQualityIndex && sleepQualityIndex >= 50 ? '#ffb800' : '#ff4757' }}>
                {sleepQualityIndex ?? '—'}
              </div>
              <div className="whoop-insight-description">
                Combined efficiency, performance & consistency
              </div>
            </div>
          </div>
          
          <div className="whoop-insight-card">
            <div className="whoop-insight-icon">⚖️</div>
            <div className="whoop-insight-content">
              <div className="whoop-insight-label">Training Load Balance</div>
              <div className="whoop-insight-value">{loadBalance}</div>
              <div className="whoop-insight-description">
                Strain relative to recovery (ideal: 40-60)
              </div>
            </div>
          </div>
          
          <div className="whoop-insight-card">
            <div className="whoop-insight-icon">💪</div>
            <div className="whoop-insight-content">
              <div className="whoop-insight-label">Deep Sleep Ratio</div>
              <div className="whoop-insight-value">
                {selectedSleep ? 
                  `${((selectedSleep.stages.deep_min / (selectedSleep.total_sleep_hours * 60)) * 100).toFixed(0)}%` 
                  : '—'
                }
              </div>
              <div className="whoop-insight-description">
                Optimal range: 15-20% for recovery
              </div>
            </div>
          </div>
          
          <div className="whoop-insight-card">
            <div className="whoop-insight-icon">❤️</div>
            <div className="whoop-insight-content">
              <div className="whoop-insight-label">HRV</div>
              <div className="whoop-insight-value">
                {selectedRecovery?.hrv_rmssd ? (
                  <span style={{ color: '#72cbff' }}>
                    {selectedRecovery.hrv_rmssd.toFixed(0)} ms
                  </span>
                ) : (
                  '—'
                )}
              </div>
              <div className="whoop-insight-description">
                Higher HRV indicates better recovery
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 30-Day Averages */}
      <section className="whoop-section">
        <h2 className="caps">30-Day Averages</h2>
        <div className="whoop-averages-grid">
          <div className="whoop-average-card">
            <div className="whoop-average-label">Avg Recovery</div>
            <div className="whoop-average-value" style={{ color: getRecoveryColor(getRecoveryStatusFromScore(metrics?.recovery.average_score ?? null)) }}>
              {metrics?.recovery.average_score ?? '—'}%
            </div>
            <div className="whoop-average-breakdown">
              <span className="whoop-recovery-green">🟢 {metrics?.recovery.green_days ?? 0}</span>
              <span className="whoop-recovery-yellow">🟡 {metrics?.recovery.yellow_days ?? 0}</span>
              <span className="whoop-recovery-red">🔴 {metrics?.recovery.red_days ?? 0}</span>
            </div>
          </div>
          
          <div className="whoop-average-card">
            <div className="whoop-average-label">Avg Sleep</div>
            <div className="whoop-average-value">{metrics?.sleep.average_hours ?? '—'}h</div>
            <div className="whoop-average-meta">
              {metrics?.sleep.average_performance ?? '—'}% performance
            </div>
          </div>
          
          <div className="whoop-average-card">
            <div className="whoop-average-label">Avg Daily Strain</div>
            <div className="whoop-average-value" style={{ color: getStrainColor(metrics?.strain.average_daily_strain ?? 0) }}>
              {metrics?.strain.average_daily_strain ?? '—'}
            </div>
            <div className="whoop-average-meta">
              Max: {metrics?.strain.max_daily_strain ?? '—'}
            </div>
          </div>
          
          <div className="whoop-average-card">
            <div className="whoop-average-label">Total Workouts</div>
            <div className="whoop-average-value">{metrics?.strain.total_workouts ?? '—'}</div>
            <div className="whoop-average-meta">
              Avg strain: {metrics?.strain.average_workout_strain ?? '—'}
            </div>
          </div>
        </div>
      </section>

      {/* Recent Workouts */}
      <section className="whoop-section">
        <h2 className="caps">Recent Workouts</h2>
        <div className="whoop-workouts-list">
          {workouts.length > 0 ? (
            workouts.slice(0, 6).map((workout) => (
              <WorkoutCard key={workout.id} workout={workout} />
            ))
          ) : (
            <div className="whoop-no-data">No recent workouts recorded</div>
          )}
        </div>
      </section>

      {/* Error display */}
      {error && (
        <div className="whoop-error">
          <p>{error}</p>
          <button onClick={fetchData} className="whoop-retry-btn">Retry</button>
        </div>
      )}
    </div>
  );
}
