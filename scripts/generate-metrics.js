#!/usr/bin/env node
/*
  Generate Git-derived project metrics for the dashboard.
  Usage: node scripts/generate-metrics.js [repoPath=.]

  Output: writes data/metrics.json at repo root
*/
const { execFileSync } = require('child_process');
const { existsSync, mkdirSync, writeFileSync, readFileSync } = require('fs');
const { join, resolve } = require('path');

function runGit(args, cwd) {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
}
function safeRunGit(args, cwd) {
  try { return runGit(args, cwd); } catch { return ''; }
}

function getRepoRoot(start) {
  const out = safeRunGit(['rev-parse', '--show-toplevel'], start);
  return out || resolve(start || '.');
}

function parseCommits(repo) {
  // Use execFile to avoid shell interpolation issues
  const format = '%H|%an|%ad|%s';
  const log = safeRunGit(['log', '--date=iso-strict', `--pretty=format:${format}`], repo);
  if (!log) return [];
  return log.split('\n').map(line => {
    const [hash, author, dateIso, subject] = line.split('|');
    return { hash, author, dateIso, subject };
  });
}



function estimateLinesOfCode(repo) {
  try {
    const files = runGit(['ls-files'], repo).split('\n').filter(Boolean);
    let total = 0;
    for (const relativePath of files) {
      if (/\.(png|jpg|jpeg|gif|svg|webp|pdf|ico|lock|ttf|otf|woff2?)$/i.test(relativePath)) continue;
      try {
        const content = readFileSync(resolve(repo, relativePath), 'utf8');
        // Count newline characters; add 1 if non-empty without trailing newline
        const lines = content === '' ? 0 : content.split(/\n/).length;
        total += lines;
      } catch {
        // skip unreadable files
      }
    }
    return total;
  } catch {
    return 0;
  }
}

function groupIntoSingleProject(commits, repo) {
  if (commits.length === 0) return null;
  const first = commits[commits.length - 1];
  const last = commits[0];

  const firstDate = new Date(first.dateIso);
  const lastDate = new Date(last.dateIso);
  const durationMs = Math.max(0, lastDate - firstDate);

  // Active days: unique dates with commits
  const activeDaySet = new Set(commits.map(c => c.dateIso.slice(0, 10)));

  // Total hours heuristic: assume 1 hour per commit unless annotated
  let totalHours = commits.length; // baseline
  // If commit subject contains [hours:x] accumulate
  const hoursRegex = /\[hours:(\d+(?:\.\d+)?)\]/i;
  const annotated = commits.reduce((sum, c) => {
    const m = c.subject.match(hoursRegex);
    return sum + (m ? parseFloat(m[1]) : 0);
  }, 0);
  if (annotated > 0) totalHours = annotated;

  const commitCount = commits.length;
  const totalLinesOfCode = estimateLinesOfCode(repo);

  return {
    name: 'This Website',
    path: '.',
    description: 'Personal site and dashboard',
    url: 'index.html',
    language: 'HTML/CSS/JS',
    firstCommitDate: first.dateIso,
    lastCommitDate: last.dateIso,
    durationMs,
    activeDays: activeDaySet.size,
    totalHours: Math.round(totalHours * 10) / 10,
    commitCount,
    totalLinesOfCode,
  };
}

function groupFromMultipleRepos(configPath) {
  if (!existsSync(configPath)) return null;
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
  if (!Array.isArray(cfg.projects) || cfg.projects.length === 0) return null;
  const projects = [];
  for (const p of cfg.projects) {
    const repo = resolve(p.path);
    const commits = parseCommits(repo);
    if (commits.length === 0) continue;
    const first = commits[commits.length - 1];
    const last = commits[0];
    const durationMs = Math.max(0, new Date(last.dateIso) - new Date(first.dateIso));
    const activeDays = new Set(commits.map(c => c.dateIso.slice(0,10))).size;
    let totalHours = commits.length;
    const hoursRegex = /\[hours:(\d+(?:\.\d+)?)\]/i;
    const annotated = commits.reduce((sum, c) => {
      const m = c.subject.match(hoursRegex); return sum + (m ? parseFloat(m[1]) : 0);
    }, 0);
    if (annotated > 0) totalHours = annotated;
    projects.push({
      name: p.name || repo.split('/').pop(),
      path: p.path,
      description: p.description || '',
      url: p.url || '',
      language: p.language || '',
      firstCommitDate: first.dateIso,
      lastCommitDate: last.dateIso,
      durationMs,
      activeDays,
      totalHours: Math.round(totalHours * 10) / 10,
      commitCount: commits.length,
      totalLinesOfCode: estimateLinesOfCode(repo),
    });
  }
  return projects;
}

function computeAggregate(projects) {
  const byLoc = [...projects].sort((a,b) => (b.totalLinesOfCode||0)-(a.totalLinesOfCode||0));
  const byDuration = [...projects].sort((a,b) => (b.durationMs||0)-(a.durationMs||0));
  const byLastDate = [...projects].sort((a,b) => new Date(b.lastCommitDate||0)-new Date(a.lastCommitDate||0));
  const totals = projects.reduce((acc, p) => {
    acc.totalHoursAllProjects += p.totalHours || 0;
    acc.totalCommitsAllProjects += p.commitCount || 0;
    acc.totalActiveDays += p.activeDays || 0;
    acc.sumDurationMs += p.durationMs || 0;
    return acc;
  }, { totalHoursAllProjects: 0, totalCommitsAllProjects: 0, totalActiveDays: 0, sumDurationMs: 0 });

  const averageDurationMs = projects.length ? Math.round(totals.sumDurationMs / projects.length) : 0;

  return {
    lastCompletedProject: byLastDate[0] || null,
    mostLinesOfCode: byLoc[0] || null,
    longestDuration: byDuration[0] || null,
    totalHoursAllProjects: Math.round(totals.totalHoursAllProjects * 10) / 10,
    totalCommitsAllProjects: totals.totalCommitsAllProjects,
    totalActiveDays: totals.totalActiveDays,
    averageDurationMs
  };
}

function main() {
  const repo = resolve(process.argv[2] || '.');
  const root = getRepoRoot(repo);
  let projects = groupFromMultipleRepos(join(root, 'scripts', 'projects.json'));
  if (!projects) {
    const commits = parseCommits(root);
    const single = groupIntoSingleProject(commits, root);
    projects = single ? [single] : [];
  }
  const aggregate = computeAggregate(projects);

  const outDir = join(root, 'data');
  if (!existsSync(outDir)) mkdirSync(outDir);
  const outPath = join(outDir, 'metrics.json');
  const payload = { generatedAt: new Date().toISOString(), projects, ...aggregate };
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  process.stdout.write(`Wrote ${outPath}\n`);
}

if (require.main === module) {
  main();
}


