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

  const projects = (metrics.projects || []).slice().sort((a, b) => (b.lastCommitDate || '').localeCompare(a.lastCommitDate || ''));
  projects.forEach(p => projectsEl.appendChild(createProjectCard(p)));

  // Initialize scroll reveal for dashboard elements
  initializeScrollReveal();
}

document.addEventListener('DOMContentLoaded', async () => {
  const data = await fetchMetrics();
  if (data) renderDashboard(data);
});


