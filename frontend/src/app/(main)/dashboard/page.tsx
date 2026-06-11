'use client';

import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = 'https://projecttracker-production.up.railway.app';

interface Project {
  name: string;
  primary_language?: string;
  loc?: number;
  commits?: number;
  active_days?: number;
  code_churn?: number;
  time_spent?: string;
  repository_size_kb?: number;
  last_finished?: string;
  first_commit?: string;
}

interface Metrics {
  total_projects?: number;
  total_time_spent_hours?: number;
  total_loc?: number;
  total_commits?: number;
  total_active_days?: number;
  total_code_churn?: number;
  project_with_most_loc?: { name: string; loc?: number };
  project_with_most_time?: { name: string; time_spent_hours?: number };
  project_with_most_commits?: { name: string; commits?: number };
  most_common_language?: { language: string; percentage?: number };
  averages?: { loc_per_project?: number; commits_per_project?: number };
}

// KPI Card Component
function KpiCard({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  );
}

// Project Card Component
function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  return (
    <div className="card project-card" onClick={onClick}>
      <div className="row">
        <div className="name">{project.name}</div>
        <span className="chip">{project.primary_language || 'Unknown'}</span>
      </div>
      <div style={{ height: '8px' }}></div>
      <div className="project-summary mono-small">
        <div>LOC: {project.loc?.toLocaleString() ?? '—'} | Commits: {project.commits ?? '—'}</div>
        <div className="expand-hint" style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px' }}>
          Click to see all stats
        </div>
      </div>
    </div>
  );
}

// Modal Component
function ProjectModal({ 
  project, 
  timeDisplay, 
  lastFinished, 
  onClose 
}: { 
  project: Project; 
  timeDisplay: string; 
  lastFinished: string; 
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="card project-card modal-expanded" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <div className="name" style={{ fontSize: '24px', marginBottom: '8px' }}>{project.name}</div>
          <span className="chip" style={{ fontSize: '14px' }}>{project.primary_language || 'Unknown'}</span>
        </div>
        
        <div className="project-details-expanded">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-label">Lines of Code</div>
              <div className="stat-value">{project.loc?.toLocaleString() ?? '—'}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Commits</div>
              <div className="stat-value">{project.commits ?? '—'}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Active Days</div>
              <div className="stat-value">{project.active_days ?? '—'}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Code Churn</div>
              <div className="stat-value">{project.code_churn?.toLocaleString() ?? '—'}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Time Spent</div>
              <div className="stat-value">{timeDisplay}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Repository Size</div>
              <div className="stat-value">{project.repository_size_kb ?? '—'} KB</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Last Updated</div>
              <div className="stat-value">{lastFinished}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">First Commit</div>
              <div className="stat-value">
                {project.first_commit ? new Date(project.first_commit).toLocaleDateString() : '—'}
              </div>
            </div>
          </div>
          
          <div className="close-hint">
            Click anywhere outside or press ESC to close
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('date');
  const [filterBy, setFilterBy] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [metricsRes, projectsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/metrics`, { cache: 'no-store' }),
        fetch(`${API_BASE_URL}/api/projects`, { cache: 'no-store' })
      ]);

      if (!metricsRes.ok) throw new Error(`Failed to fetch metrics: ${metricsRes.status}`);
      if (!projectsRes.ok) throw new Error(`Failed to fetch projects: ${projectsRes.status}`);

      const [metricsData, projectsData] = await Promise.all([
        metricsRes.json(),
        projectsRes.json()
      ]);

      setMetrics(metricsData);
      setProjects(projectsData);
      setFilteredProjects(projectsData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load dashboard data. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sort and filter projects
  useEffect(() => {
    let result = [...projects];

    // Apply filter
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    switch (filterBy) {
      case 'recent':
        result = result.filter(p => p.last_finished && new Date(p.last_finished) > thirtyDaysAgo);
        break;
      case 'large':
        result = result.filter(p => p.loc && p.loc > 1000);
        break;
      case 'active':
        result = result.filter(p => p.active_days && p.active_days > 10);
        break;
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'lines':
          return (b.loc || 0) - (a.loc || 0);
        case 'time':
          const aTime = a.time_spent ? parseFloat(a.time_spent.replace('m', '')) : 0;
          const bTime = b.time_spent ? parseFloat(b.time_spent.replace('m', '')) : 0;
          return bTime - aTime;
        case 'commits':
          return (b.commits || 0) - (a.commits || 0);
        default: // date
          return (b.last_finished || '').localeCompare(a.last_finished || '');
      }
    });

    setFilteredProjects(result);
  }, [projects, sortBy, filterBy]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/refresh`, { 
        method: 'POST',
        cache: 'no-store' 
      });
      if (!res.ok) throw new Error(`Failed to refresh: ${res.status}`);
      
      // Reload data after refresh
      await fetchData();
    } catch (err) {
      console.error('Refresh failed:', err);
      alert('Failed to refresh data. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const getTimeDisplay = (project: Project) => {
    const timeSpentHours = project.time_spent ? parseFloat(project.time_spent.replace('m', '')) / 60 : null;
    return timeSpentHours ? `${timeSpentHours.toFixed(1)}h` : '—';
  };

  const getLastFinished = (project: Project) => {
    return project.last_finished ? new Date(project.last_finished).toLocaleDateString() : '—';
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar with metrics */}
      <aside className="full-height-sidebar">
        <div className="sidebar-content">
          <div className="caps">Key metrics</div>
          <div id="metrics">
            {loading && <div className="loading">Loading metrics...</div>}
            {error && <div className="error">{error}</div>}
            {metrics && !loading && (
              <>
                <KpiCard label="Total Projects" value={String(metrics.total_projects ?? '—')} />
                <KpiCard label="Total Hours" value={`${metrics.total_time_spent_hours?.toFixed(1) ?? '—'}h`} />
                <KpiCard label="Total LOC" value={metrics.total_loc?.toLocaleString() ?? '—'} />
                <KpiCard label="Total Commits" value={metrics.total_commits?.toLocaleString() ?? '—'} />
                <KpiCard label="Active Days" value={String(metrics.total_active_days ?? '—')} />
                <KpiCard label="Code Churn" value={metrics.total_code_churn?.toLocaleString() ?? '—'} />
                <KpiCard 
                  label="Most LOC Project" 
                  value={metrics.project_with_most_loc?.name || '—'}
                  meta={`${metrics.project_with_most_loc?.loc?.toLocaleString() ?? '—'} lines`}
                />
                <KpiCard 
                  label="Most Time Project" 
                  value={metrics.project_with_most_time?.name || '—'}
                  meta={`${metrics.project_with_most_time?.time_spent_hours?.toFixed(1) ?? '—'}h`}
                />
                <KpiCard 
                  label="Most Commits Project" 
                  value={metrics.project_with_most_commits?.name || '—'}
                  meta={`${metrics.project_with_most_commits?.commits ?? '—'} commits`}
                />
                <KpiCard 
                  label="Top Language" 
                  value={metrics.most_common_language?.language || '—'}
                  meta={`${metrics.most_common_language?.percentage?.toFixed(1) ?? '—'}% of projects`}
                />
                <KpiCard 
                  label="Avg LOC/Project" 
                  value={metrics.averages?.loc_per_project?.toFixed(0) ?? '—'} 
                />
                <KpiCard 
                  label="Avg Commits/Project" 
                  value={metrics.averages?.commits_per_project?.toFixed(1) ?? '—'} 
                />
              </>
            )}
          </div>
        </div>
      </aside>
      
      {/* Main content area */}
      <div className="main-content-area">
        <section className="hero dashboard-hero">
          <div className="container hero-inner">
            <div>
              <div className="caps">Projects dashboard</div>
              <p className="meta">Live insights computed from Git history</p>
            </div>
          </div>
        </section>

        <section>
          <div className="container">
            <div className="projects-column">
              <div className="caps">Projects</div>
              
              {/* Project controls */}
              <div className="project-controls">
                <div className="control-group">
                  <label htmlFor="sort-select">Sort by:</label>
                  <select 
                    id="sort-select" 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="date">Date (Newest)</option>
                    <option value="name">Name</option>
                    <option value="lines">Lines of Code</option>
                    <option value="time">Time Spent</option>
                    <option value="commits">Commits</option>
                  </select>
                </div>
                <div className="control-group">
                  <label htmlFor="filter-select">Filter by:</label>
                  <select 
                    id="filter-select" 
                    value={filterBy} 
                    onChange={(e) => setFilterBy(e.target.value)}
                  >
                    <option value="all">All Projects</option>
                    <option value="recent">Recent (Last 30 days)</option>
                    <option value="large">Large Projects (&gt;1000 LOC)</option>
                    <option value="active">Very Active (&gt;10 days)</option>
                  </select>
                </div>
                <div className="control-group">
                  <button 
                    className="refresh-btn" 
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    {refreshing ? 'Refreshing...' : 'Refresh Data'}
                  </button>
                </div>
              </div>

              {/* Projects grid */}
              <div id="projects" className={`cards-grid ${selectedProject ? 'modal-active' : ''}`}>
                {loading && <div className="loading">Loading projects...</div>}
                {error && <div className="error">{error}</div>}
                {!loading && !error && filteredProjects.map((project) => (
                  <ProjectCard 
                    key={project.name} 
                    project={project} 
                    onClick={() => setSelectedProject(project)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Modal */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          timeDisplay={getTimeDisplay(selectedProject)}
          lastFinished={getLastFinished(selectedProject)}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}

