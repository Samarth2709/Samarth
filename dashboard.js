async function fetchMetrics() {
  try {
    const res = await fetch('data/metrics.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load metrics.json');
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

function createKpiCard(label, value, meta) {
  const card = document.createElement('div');
  card.className = 'card kpi reveal';
  card.innerHTML = `
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    ${meta ? `<div class="kpi-meta">${meta}</div>` : ''}
  `;
  return card;
}

function formatDuration(milliseconds) {
  if (milliseconds == null) return '—';
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function createProjectCard(p) {
  const card = document.createElement('div');
  card.className = 'card project-card reveal';
  const linkHtml = p.url ? `<a href="${p.url}" target="_blank" rel="noopener noreferrer">${p.name}</a>` : `<span class="name">${p.name}</span>`;
  card.innerHTML = `
    <div class="row">
      <div class="name">${linkHtml}</div>
      <span class="chip">${p.language || 'mixed'}</span>
    </div>
    <div class="mono-small">${p.description || ''}</div>
    <div style="height:8px"></div>
    <div class="mono-small">LOC: ${p.totalLinesOfCode?.toLocaleString?.() ?? '—'} | Commits: ${p.commitCount ?? '—'}</div>
    <div class="mono-small">Started: ${p.firstCommitDate ? new Date(p.firstCommitDate).toLocaleDateString() : '—'}</div>
    <div class="mono-small">Completed: ${p.lastCommitDate ? new Date(p.lastCommitDate).toLocaleDateString() : '—'}</div>
    <div class="mono-small">Build time: ${formatDuration(p.durationMs)}</div>
    <div class="mono-small">Active days: ${p.activeDays ?? '—'}</div>
    <div class="mono-small">Total hours: ${p.totalHours ?? '—'}</div>
  `;
  return card;
}

function renderDashboard(metrics) {
  const metricsEl = document.getElementById('metrics');
  const projectsEl = document.getElementById('projects');
  if (!metrics || !metricsEl || !projectsEl) return;

  const kpis = [
    createKpiCard('Last project finished', metrics.lastCompletedProject?.name || '—', metrics.lastCompletedProject?.lastCommitDate ? new Date(metrics.lastCompletedProject.lastCommitDate).toLocaleString() : ''),
    createKpiCard('Most lines of code', metrics.mostLinesOfCode?.name || '—', `${metrics.mostLinesOfCode?.totalLinesOfCode?.toLocaleString?.() ?? '—'} LOC`),
    createKpiCard('Longest to complete', metrics.longestDuration?.name || '—', formatDuration(metrics.longestDuration?.durationMs)),
    createKpiCard('Total hours (all projects)', metrics.totalHoursAllProjects ?? '—'),
    createKpiCard('Total commits (all projects)', metrics.totalCommitsAllProjects ?? '—'),
    createKpiCard('Average project duration', formatDuration(metrics.averageDurationMs)),
    createKpiCard('Active days (all projects)', metrics.totalActiveDays ?? '—'),
    createKpiCard('Projects tracked', metrics.projects?.length ?? 0)
  ];
  kpis.forEach(el => metricsEl.appendChild(el));

  // Add project controls
  const projectControls = document.createElement('div');
  projectControls.className = 'project-controls';
  projectControls.innerHTML = `
    <div class="control-group">
      <label for="sort-select">Sort by:</label>
      <select id="sort-select">
        <option value="date">Date (Newest)</option>
        <option value="name">Name</option>
        <option value="lines">Lines of Code</option>
        <option value="duration">Duration</option>
        <option value="commits">Commits</option>
      </select>
    </div>
    <div class="control-group">
      <label for="filter-select">Filter by:</label>
      <select id="filter-select">
        <option value="all">All Projects</option>
        <option value="recent">Recent (Last 30 days)</option>
        <option value="large">Large Projects (>1000 LOC)</option>
        <option value="quick">Quick Projects (<1 day)</option>
      </select>
    </div>
  `;
  projectsEl.parentNode.insertBefore(projectControls, projectsEl);

  const projects = (metrics.projects || []).slice();
  let filteredProjects = [...projects];
  
  function renderProjects() {
    projectsEl.innerHTML = '';
    filteredProjects.forEach(p => projectsEl.appendChild(createProjectCard(p)));
    initializeScrollReveal();
  }

  // Sorting functionality
  document.getElementById('sort-select').addEventListener('change', (e) => {
    const sortBy = e.target.value;
    filteredProjects.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'lines':
          return (b.totalLinesOfCode || 0) - (a.totalLinesOfCode || 0);
        case 'duration':
          return (b.durationMs || 0) - (a.durationMs || 0);
        case 'commits':
          return (b.commitCount || 0) - (a.commitCount || 0);
        default: // date
          return (b.lastCommitDate || '').localeCompare(a.lastCommitDate || '');
      }
    });
    renderProjects();
  });

  // Filtering functionality
  document.getElementById('filter-select').addEventListener('change', (e) => {
    const filterBy = e.target.value;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    filteredProjects = projects.filter(p => {
      switch (filterBy) {
        case 'recent':
          return p.lastCommitDate && new Date(p.lastCommitDate) > thirtyDaysAgo;
        case 'large':
          return p.totalLinesOfCode && p.totalLinesOfCode > 1000;
        case 'quick':
          return p.durationMs && p.durationMs < 24 * 60 * 60 * 1000; // less than 1 day
        default:
          return true;
      }
    });
    renderProjects();
  });

  // Initial render
  renderProjects();
}

document.addEventListener('DOMContentLoaded', async () => {
  const data = await fetchMetrics();
  if (data) renderDashboard(data);
});


