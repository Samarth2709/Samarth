const API_BASE_URL = 'https://young-garden-29023-d9a0945982b2.herokuapp.com';

async function fetchProjects() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/projects`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching projects:', err);
    return null;
  }
}

async function fetchMetrics() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/metrics`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Error fetching metrics:', err);
    return null;
  }
}

async function refreshData() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/refresh`, { 
      method: 'POST',
      cache: 'no-store' 
    });
    if (!res.ok) throw new Error(`Failed to refresh data: ${res.status}`);
    const result = await res.json();
    
    // If async job, poll for status
    if (result.job_id) {
      return await pollRefreshStatus(result.job_id);
    }
    
    return result;
  } catch (err) {
    console.error('Error refreshing data:', err);
    throw err;
  }
}

async function pollRefreshStatus(jobId) {
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/refresh/status/${jobId}`);
        if (!res.ok) throw new Error(`Failed to check status: ${res.status}`);
        const status = await res.json();
        
        if (status.status === 'completed') {
          clearInterval(pollInterval);
          resolve(status);
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          reject(new Error(status.error_message || 'Refresh job failed'));
        }
        // Continue polling for 'queued' and 'running' statuses
      } catch (err) {
        clearInterval(pollInterval);
        reject(err);
      }
    }, 5000); // Poll every 5 seconds
    
    // Timeout after 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      reject(new Error('Refresh timeout'));
    }, 600000);
  });
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
  card.dataset.projectId = p.name; // Add identifier for expanding
  
  // Convert API time format (e.g., "14400m") to hours
  const timeSpentHours = p.time_spent ? parseFloat(p.time_spent.replace('m', '')) / 60 : null;
  const timeDisplay = timeSpentHours ? `${timeSpentHours.toFixed(1)}h` : '—';
  
  // Parse last_finished date
  const lastFinished = p.last_finished ? new Date(p.last_finished).toLocaleDateString() : '—';
  
  // Store all project data for expansion
  card._projectData = p;
  card._timeDisplay = timeDisplay;
  card._lastFinished = lastFinished;
  
  card.innerHTML = `
    <div class="row">
      <div class="name">${p.name}</div>
      <span class="chip">${p.primary_language || 'Unknown'}</span>
    </div>
    <div style="height:8px"></div>
    <div class="project-summary mono-small">
      <div>LOC: ${p.loc?.toLocaleString?.() ?? '—'} | Commits: ${p.commits ?? '—'}</div>
      <div class="expand-hint" style="color: var(--muted); font-size: 11px; margin-top: 4px;">Click to see all stats</div>
    </div>
  `;
  
  // Add click handler for modal expansion
  card.addEventListener('click', (e) => openProjectModal(card, p, timeDisplay, lastFinished));
  
  return card;
}

// Global modal state
let currentModal = null;

function openProjectModal(originalCard, projectData, timeDisplay, lastFinished) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  // Create expanded card clone
  const modalCard = document.createElement('div');
  modalCard.className = 'card project-card modal-expanded';
  
  // Enhanced stats display
  modalCard.innerHTML = `
    <div class="row">
      <div class="name" style="font-size: 24px; margin-bottom: 8px;">${projectData.name}</div>
      <span class="chip" style="font-size: 14px;">${projectData.primary_language || 'Unknown'}</span>
    </div>
    
    <div class="project-details-expanded">
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">Lines of Code</div>
          <div class="stat-value">${projectData.loc?.toLocaleString?.() ?? '—'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Commits</div>
          <div class="stat-value">${projectData.commits ?? '—'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Active Days</div>
          <div class="stat-value">${projectData.active_days ?? '—'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Code Churn</div>
          <div class="stat-value">${projectData.code_churn?.toLocaleString?.() ?? '—'}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Time Spent</div>
          <div class="stat-value">${timeDisplay}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Repository Size</div>
          <div class="stat-value">${projectData.repository_size_kb ?? '—'} KB</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Last Updated</div>
          <div class="stat-value">${lastFinished}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">First Commit</div>
          <div class="stat-value">${projectData.first_commit ? new Date(projectData.first_commit).toLocaleDateString() : '—'}</div>
        </div>
      </div>
      
      <div class="close-hint">
        Click anywhere outside or press ESC to close
      </div>
    </div>
  `;
  
  overlay.appendChild(modalCard);
  document.body.appendChild(overlay);
  
  // Add active class to trigger animation
  requestAnimationFrame(() => {
    overlay.classList.add('active');
    document.getElementById('projects').classList.add('modal-active');
  });
  
  // Set global modal reference
  currentModal = overlay;
  
  // Close modal handlers
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeProjectModal();
    }
  });
  
  // Prevent card click from bubbling to overlay
  modalCard.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

function closeProjectModal() {
  if (!currentModal) return;
  
  currentModal.classList.remove('active');
  document.getElementById('projects').classList.remove('modal-active');
  
  setTimeout(() => {
    if (currentModal && currentModal.parentNode) {
      currentModal.parentNode.removeChild(currentModal);
    }
    currentModal = null;
  }, 300);
}

// Add ESC key listener
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentModal) {
    closeProjectModal();
  }
});

function renderMetrics(metrics) {
  const metricsEl = document.getElementById('metrics');
  if (!metrics || !metricsEl) return;

  // Clear any existing content
  metricsEl.innerHTML = '';

  const kpis = [
    createKpiCard('Total Projects', metrics.total_projects ?? '—'),
    createKpiCard('Total Hours', (metrics.total_time_spent_hours?.toFixed(1) ?? '—') + 'h'),
    createKpiCard('Total LOC', metrics.total_loc?.toLocaleString?.() ?? '—'),
    createKpiCard('Total Commits', metrics.total_commits?.toLocaleString?.() ?? '—'),
    createKpiCard('Active Days', metrics.total_active_days ?? '—'),
    createKpiCard('Code Churn', metrics.total_code_churn?.toLocaleString?.() ?? '—'),
    createKpiCard('Most LOC Project', metrics.project_with_most_loc?.name || '—', 
                  `${metrics.project_with_most_loc?.loc?.toLocaleString?.() ?? '—'} lines`),
    createKpiCard('Most Time Project', metrics.project_with_most_time?.name || '—', 
                  `${metrics.project_with_most_time?.time_spent_hours?.toFixed(1) ?? '—'}h`),
    createKpiCard('Most Commits Project', metrics.project_with_most_commits?.name || '—', 
                  `${metrics.project_with_most_commits?.commits ?? '—'} commits`),
    createKpiCard('Top Language', metrics.most_common_language?.language || '—', 
                  `${metrics.most_common_language?.percentage?.toFixed(1) ?? '—'}% of projects`),
    createKpiCard('Avg LOC/Project', metrics.averages?.loc_per_project?.toFixed(0) ?? '—'),
    createKpiCard('Avg Commits/Project', metrics.averages?.commits_per_project?.toFixed(1) ?? '—')
  ];
  
  kpis.forEach(el => metricsEl.appendChild(el));
}

function renderProjects(projects) {
  const projectsEl = document.getElementById('projects');
  if (!projects || !projectsEl) return;

  // Clear existing projects
  projectsEl.innerHTML = '';

  // Check if project controls already exist
  let projectControls = document.querySelector('.project-controls');
  if (!projectControls) {
    projectControls = document.createElement('div');
    projectControls.className = 'project-controls';
    projectControls.innerHTML = `
      <div class="control-group">
        <label for="sort-select">Sort by:</label>
        <select id="sort-select">
          <option value="date">Date (Newest)</option>
          <option value="name">Name</option>
          <option value="lines">Lines of Code</option>
          <option value="time">Time Spent</option>
          <option value="commits">Commits</option>
        </select>
      </div>
      <div class="control-group">
        <label for="filter-select">Filter by:</label>
        <select id="filter-select">
          <option value="all">All Projects</option>
          <option value="recent">Recent (Last 30 days)</option>
          <option value="large">Large Projects (>1000 LOC)</option>
          <option value="active">Very Active (>10 days)</option>
        </select>
      </div>
      <div class="control-group">
        <button id="refresh-btn" class="refresh-btn">Refresh Data</button>
      </div>
    `;
    projectsEl.parentNode.insertBefore(projectControls, projectsEl);
  }

  let filteredProjects = [...projects];
  
  function renderProjectList() {
    projectsEl.innerHTML = '';
    filteredProjects.forEach(p => projectsEl.appendChild(createProjectCard(p)));
    // Re-initialize scroll reveal if it exists
    if (typeof initializeScrollReveal === 'function') {
      initializeScrollReveal();
    }
  }

  // Sorting functionality
  document.getElementById('sort-select').addEventListener('change', (e) => {
    const sortBy = e.target.value;
    filteredProjects.sort((a, b) => {
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
    renderProjectList();
  });

  // Filtering functionality
  document.getElementById('filter-select').addEventListener('change', (e) => {
    const filterBy = e.target.value;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    filteredProjects = projects.filter(p => {
      switch (filterBy) {
        case 'recent':
          return p.last_finished && new Date(p.last_finished) > thirtyDaysAgo;
        case 'large':
          return p.loc && p.loc > 1000;
        case 'active':
          return p.active_days && p.active_days > 10;
        default:
          return true;
      }
    });
    renderProjectList();
  });

  // Refresh button functionality
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    const btn = document.getElementById('refresh-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Refreshing...';
    btn.disabled = true;
    
    try {
      await refreshData();
      // After refresh, reload the data
      await loadDashboardData();
    } catch (err) {
      console.error('Refresh failed:', err);
      alert('Failed to refresh data. Please try again.');
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });

  // Initial render
  renderProjectList();
}

async function loadDashboardData() {
  try {
    // Show loading state
    const metricsEl = document.getElementById('metrics');
    const projectsEl = document.getElementById('projects');
    
    if (metricsEl) {
      metricsEl.innerHTML = '<div class="loading">Loading metrics...</div>';
    }
    
    if (projectsEl) {
      projectsEl.innerHTML = '<div class="loading">Loading projects...</div>';
    }

    // Fetch both metrics and projects in parallel
    const [metrics, projects] = await Promise.all([
      fetchMetrics(),
      fetchProjects()
    ]);

    if (metrics) {
      renderMetrics(metrics);
    } else {
      if (metricsEl) {
        metricsEl.innerHTML = '<div class="error">Failed to load metrics. Please try refreshing.</div>';
      }
    }

    if (projects) {
      renderProjects(projects);
    } else {
      if (projectsEl) {
        projectsEl.innerHTML = '<div class="error">Failed to load projects. Please try refreshing.</div>';
      }
    }
  } catch (err) {
    console.error('Error loading dashboard data:', err);
    const metricsEl = document.getElementById('metrics');
    const projectsEl = document.getElementById('projects');
    
    if (metricsEl) {
      metricsEl.innerHTML = '<div class="error">Error loading dashboard. Please check your connection.</div>';
    }
    
    if (projectsEl) {
      projectsEl.innerHTML = '<div class="error">Error loading dashboard. Please check your connection.</div>';
    }
  }
}

document.addEventListener('DOMContentLoaded', loadDashboardData);


