// State
let currentCommunity = '';
let currentView = 'browse';
let packages = [];
let installedMods = [];
let filterDropdownOpen = false;
let rightSidebarVisible = true;
let pendingUninstall = null;
let activeCategories = new Set();

let availableUpdates = new Map();
// DOM Elements - Navigation
const navTabs = document.querySelectorAll('.nav-tab');
const views = document.querySelectorAll('.view');
const navInstalledBadge = document.getElementById('nav-installed-badge');

// DOM Elements - Browse View
const communitySelect = document.getElementById('community');
const searchInput = document.getElementById('search');
const modContainer = document.getElementById('mod-container');
const totalModsEl = document.getElementById('total-mods');
const installedCountEl = document.getElementById('installed-count');
const refreshBtn = document.getElementById('refresh-btn');
const filterToggleBtn = document.getElementById('filter-toggle-btn');
const filterDropdown = document.getElementById('filter-dropdown');
const sortSelect = document.getElementById('sort-select');
const categoryFilters = document.getElementById('category-filters');

// DOM Elements - Installed View
const installedList = document.getElementById('installed-list');
const installedBadgeEl = document.getElementById('installed-badge');
const installedSearchInput = document.getElementById('installed-search');
const installedSortSelect = document.getElementById('installed-sort');
const checkUpdatesBtn = document.getElementById('check-updates-btn');

// DOM Elements - Server View
const serverStatusCard = document.getElementById('server-status-card');
const serverStatusDot = document.getElementById('server-status-dot');
const serverStatusText = document.getElementById('server-status-text');
const serverInfo = document.getElementById('server-info');
const startServerBtn = document.getElementById('start-server-btn');
const stopServerBtn = document.getElementById('stop-server-btn');
const restartServerBtn = document.getElementById('restart-server-btn');
const inlineConsole = document.getElementById('inline-console');
const inlineConsoleOutput = document.getElementById('inline-console-output');

// DOM Elements - Right Sidebar
const rightSidebar = document.getElementById('right-sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarServerStatus = document.getElementById('sidebar-server-status');
const viewConsoleBtn = document.getElementById('view-console-btn');
const quickRestartBtn = document.getElementById('quick-restart-btn');

// DOM Elements - Modals
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmUninstallBtn = document.getElementById('confirm-uninstall');
const confirmModalClose = document.getElementById('confirm-modal-close');

const consoleModal = document.getElementById('console-modal');
const consoleOutput = document.getElementById('console-output');
const modalClose = document.getElementById('modal-close');

const appEl = document.querySelector('.app');

// API Functions
async function fetchCommunities() {
  const res = await fetch('/api/communities');
  return res.json();
}

async function fetchPackages(community) {
  const res = await fetch(`/api/packages/${community}`);
  return res.json();
}

async function searchPackages(community, query, sort = 'last-updated', categories = []) {
  const params = new URLSearchParams({
    q: query,
    sort: sort,
    categories: categories.join(',')
  });
  const res = await fetch(`/api/packages/${community}/search?${params}`);
  return res.json();
}

async function fetchInstalled() {
  const res = await fetch('/api/installed');
  return res.json();
}

async function installMod(community, fullName) {
  const res = await fetch('/api/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ community, fullName, includeDeps: true })
  });
  return res.json();
}

async function uninstallMod(fullName) {
  const res = await fetch(`/api/uninstall/${encodeURIComponent(fullName)}`, {
    method: 'DELETE'
  });
  return res.json();
}

async function updateMod(community, fullName) {
  const res = await fetch('/api/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ community, fullName })
  });
  return res.json();
}

async function startServer() {
  const res = await fetch('/api/start-server', { method: 'POST' });
  return res.json();
}

async function stopServer() {
  const res = await fetch('/api/stop-server', { method: 'POST' });
  return res.json();
}

async function restartServer() {
  const res = await fetch('/api/restart-server', { method: 'POST' });
  return res.json();
}

async function fetchServerStatus() {
  const res = await fetch('/api/server-status');
  return res.json();
}

async function fetchServerLogs() {
  const res = await fetch('/api/server-logs');
  return res.json();
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// View Navigation
function switchView(view) {
  currentView = view;
  
  // Update nav tabs
  navTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });
  
  // Update views
  views.forEach(v => {
    v.classList.toggle('active', v.id === `${view}-view`);
  });
  
  // Handle right sidebar visibility
  if (view === 'server') {
    appEl.classList.add('server-view-active');
  } else {
    appEl.classList.remove('server-view-active');
  }
  
  // Start console polling if on server view
  if (view === 'server') {
    startInlineConsolePoll();
  } else {
    stopInlineConsolePoll();
  }
}

// Filter Dropdown
function toggleFilterDropdown() {
  filterDropdownOpen = !filterDropdownOpen;
  filterDropdown.classList.toggle('open', filterDropdownOpen);
  filterToggleBtn.classList.toggle('active', filterDropdownOpen);
  filterToggleBtn.textContent = filterDropdownOpen ? '▲ Filters' : '▼ Filters';
}

// Left Nav Sidebar Toggle
let navCollapsed = false;
const navCollapseBtn = document.getElementById('nav-collapse-btn');

function toggleNavSidebar() {
  navCollapsed = !navCollapsed;
  appEl.classList.toggle('nav-collapsed', navCollapsed);
  // Arrow points in actionable direction: ‹ to collapse (close), › to expand (open)
  navCollapseBtn.textContent = navCollapsed ? '›' : '‹';
  navCollapseBtn.title = navCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
}

// Right Sidebar Toggle
function toggleRightSidebar() {
  rightSidebarVisible = !rightSidebarVisible;
  rightSidebar.classList.toggle('collapsed', !rightSidebarVisible);
  appEl.classList.toggle('sidebar-hidden', !rightSidebarVisible);
  // Arrow points in actionable direction: › to collapse (close), ‹ to expand (open)
  sidebarToggle.textContent = rightSidebarVisible ? '›' : '‹';
  sidebarToggle.title = rightSidebarVisible ? 'Hide sidebar' : 'Show sidebar';
}

// Render Functions
function renderModGrid(mods) {
  if (!mods.length) {
    modContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⌕</div>
        <p>No mods found</p>
      </div>
    `;
    return;
  }

  const installedNames = new Set(installedMods.map(m => m.fullName));

  modContainer.innerHTML = `
    <div class="mod-grid">
      ${mods.slice(0, 100).map(pkg => {
        const isInstalled = installedNames.has(pkg.fullName);
        return `
          <div class="mod-card ${isInstalled ? 'installed' : ''}" data-fullname="${pkg.fullName}">
            <div class="mod-header">
              <img class="mod-icon" src="${pkg.icon || ''}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23252532%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%2394a3b8%22 font-size=%2240%22>⚛</text></svg>'">
              <div class="mod-info">
                <a href="${pkg.packageUrl}" target="_blank" rel="noopener" class="mod-name">${pkg.name}</a>
                <div class="mod-owner">by ${pkg.owner}</div>
                <span class="mod-version">v${pkg.latestVersion}</span>
              </div>
            </div>
            <div class="mod-description">${pkg.description || 'No description'}</div>
            <div class="mod-footer">
              <div class="mod-stats">
                <span>↓ ${formatNumber(pkg.downloads)}</span>
                <span>★ ${pkg.rating}</span>
              </div>
              <button class="install-btn ${isInstalled ? 'installed' : ''}" 
                      data-fullname="${pkg.fullName}"
                      data-name="${pkg.name}">
                ${isInstalled ? '✓ Installed' : 'Install'}
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Add click handlers
  modContainer.querySelectorAll('.install-btn').forEach(btn => {
    if (btn.classList.contains('installed')) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showUninstallConfirm(btn.dataset.fullname, btn.dataset.name);
      });
    } else {
      btn.addEventListener('click', handleInstall);
    }
  });
}

function renderInstalledMods() {
  const query = installedSearchInput ? installedSearchInput.value.toLowerCase().trim() : '';
  const sortBy = installedSortSelect ? installedSortSelect.value : 'name';

  // Filter and Sort
  let filtered = [...installedMods];

  if (query) {
    filtered = filtered.filter(mod => 
      mod.name.toLowerCase().includes(query) || 
      mod.fullName.toLowerCase().includes(query)
    );
  }

  filtered.sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'date-desc') return (new Date(b.installedAt || 0)) - (new Date(a.installedAt || 0));
    if (sortBy === 'date-asc') return (new Date(a.installedAt || 0)) - (new Date(b.installedAt || 0));
    return 0;
  });

  const count = installedMods.length; // Total count for badge
  installedCountEl.textContent = count;
  installedBadgeEl.textContent = count;
  navInstalledBadge.textContent = count;

  if (installedMods.length === 0) {
    installedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">∅</div>
        <p>No mods installed yet</p>
      </div>
    `;
    return;
  }

  if (filtered.length === 0) {
    installedList.innerHTML = `
      <div class="empty-state">
        <p>No matching mods found</p>
      </div>
    `;
    return;
  }

  installedList.innerHTML = filtered.map(mod => {
    const newVersion = availableUpdates.get(mod.fullName);
    return `
    <div class="installed-item">
      <img class="installed-icon" src="${mod.icon || ''}" alt="" onerror="this.style.display='none'">
      <div class="installed-info">
        <div class="installed-name">${mod.name}</div>
        <div class="installed-version">
          v${mod.version}
          ${newVersion ? `<span style="color: var(--success); font-weight: bold; margin-left: 6px;">➜ v${newVersion}</span>` : ''}
        </div>
      </div>
      <div class="installed-actions" style="display: flex; gap: 8px; align-items: center;">
        ${newVersion ? `<button class="install-btn" style="padding: 6px 12px; font-size: 0.8rem;" data-action="update" data-fullname="${mod.fullName}">Update</button>` : ''}
        <button class="uninstall-btn" data-fullname="${mod.fullName}" data-name="${mod.name}">Remove</button>
      </div>
    </div>
  `}).join('');

  // Add click handlers
  installedList.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.action === 'update') {
      btn.addEventListener('click', () => executeUpdate(btn.dataset.fullname));
    } else if (btn.classList.contains('uninstall-btn')) {
      btn.addEventListener('click', () => {
        showUninstallConfirm(btn.dataset.fullname, btn.dataset.name);
      });
    }
  });
}

function renderCategoryFilters(categories) {
  categoryFilters.innerHTML = categories.map(cat => `
    <div class="category-pill ${activeCategories.has(cat) ? 'active' : ''}" data-category="${cat}">
      ${cat}
    </div>
  `).join('');

  categoryFilters.querySelectorAll('.category-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const cat = e.target.dataset.category;
      if (activeCategories.has(cat)) {
        activeCategories.delete(cat);
      } else {
        activeCategories.add(cat);
      }
      handleSearch();
      renderCategoryFilters(categories);
    });
  });
}

// Uninstall Confirmation
function showUninstallConfirm(fullName, modName) {
  pendingUninstall = { fullName, modName };
  confirmMessage.textContent = `Are you sure you want to uninstall "${modName}"?`;
  confirmModal.classList.add('open');
}

function hideUninstallConfirm() {
  pendingUninstall = null;
  confirmModal.classList.remove('open');
}

async function executeUninstall() {
  if (!pendingUninstall) return;
  
  const { fullName, modName } = pendingUninstall;
  hideUninstallConfirm();
  
  try {
    const result = await uninstallMod(fullName);
    if (result.success) {
      showToast(`Removed ${modName}`, 'success');
      await refreshInstalled();
      handleSearch();
    } else {
      showToast('Uninstall failed', 'error');
    }
  } catch (e) {
    showToast('Uninstall error', 'error');
  }
}

// Event Handlers
async function handleCommunityChange() {
  currentCommunity = communitySelect.value;
  if (!currentCommunity) return;

  modContainer.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <p>Loading mods...</p>
    </div>
  `;

  try {
    packages = await fetchPackages(currentCommunity);
    totalModsEl.textContent = packages.length;
    
    // Extract unique categories
    const allCategories = new Set();
    packages.forEach(p => p.categories?.forEach(c => allCategories.add(c)));
    
    // Reset active filters
    activeCategories.clear();
    
    renderCategoryFilters(Array.from(allCategories).sort());

    // Apply current sort/filter (default)
    handleSearch();
  } catch (e) {
    showToast('Failed to load mods', 'error');
  }
}

async function handleSearch() {
  const query = searchInput.value.trim();
  const sort = sortSelect.value;
  const categories = Array.from(activeCategories);

  if (!currentCommunity) return;

  try {
    const results = await searchPackages(currentCommunity, query, sort, categories);
    renderModGrid(results);
  } catch (e) {
    showToast('Search failed', 'error');
  }
}

async function handleInstall(e) {
  const btn = e.target;
  const fullName = btn.dataset.fullname;
  
  btn.disabled = true;
  btn.textContent = 'Installing...';

  try {
    const result = await installMod(currentCommunity, fullName);
    if (result.results?.some(r => r.success)) {
      showToast(`Installed ${fullName}`, 'success');
      await refreshInstalled();
      handleSearch();
    } else {
      showToast('Installation failed', 'error');
      btn.disabled = false;
      btn.textContent = 'Install';
    }
  } catch (e) {
    showToast('Installation error', 'error');
    btn.disabled = false;
    btn.textContent = 'Install';
  }
}

// Server Control Handlers
async function handleStartServer() {
  startServerBtn.disabled = true;
  startServerBtn.textContent = 'Starting...';
  
  try {
    const result = await startServer();
    if (result.success) {
      showToast('Server starting...', 'success');
      await refreshServerStatus();
    } else {
      showToast(result.error || 'Start failed', 'error');
    }
  } catch (e) {
    showToast('Start error', 'error');
  }
  
  startServerBtn.disabled = false;
  startServerBtn.textContent = '▶ Start';
}

// Update Logic
function compareVersions(v1, v2) {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

async function handleCheckUpdates() {
  checkUpdatesBtn.disabled = true;
  checkUpdatesBtn.textContent = 'Checking...';
  
  try {
    let pkgs = packages;
    if (!pkgs.length && currentCommunity) {
      pkgs = await fetchPackages(currentCommunity);
    } // If still empty or no community, we can't check efficiently without knowing community.
    
    if (!pkgs.length) {
      showToast('Please select a game in Browse first to check versions', 'info');
      checkUpdatesBtn.disabled = false;
      checkUpdatesBtn.textContent = 'Check Updates';
      return;
    }

    availableUpdates.clear();
    let updateCount = 0;

    for (const mod of installedMods) {
      const remote = pkgs.find(p => p.fullName === mod.fullName);
      if (remote) {
        if (compareVersions(remote.latestVersion, mod.version) > 0) {
          availableUpdates.set(mod.fullName, remote.latestVersion);
          updateCount++;
        }
      }
    }

    if (updateCount > 0) {
      showToast(`Found ${updateCount} updates`, 'success');
    } else {
      showToast('All mods up to date', 'success');
    }
    renderInstalledMods();
  } catch (e) {
    showToast('Check failed: ' + e.message, 'error');
  } finally {
    checkUpdatesBtn.disabled = false;
    checkUpdatesBtn.textContent = 'Check Updates';
  }
}

async function executeUpdate(fullName) {
  showToast(`Updating ${fullName}...`, 'info');
  try {
    const result = await updateMod(currentCommunity, fullName);
    if (result.success) {
      showToast(`Updated ${fullName}`, 'success');
      await refreshInstalled();
      availableUpdates.delete(fullName);
      renderInstalledMods();
    } else {
      showToast(result.message || 'Update failed', 'error');
    }
  } catch (e) {
    showToast('Update error', 'error');
  }
}

async function handleStopServer() {
  stopServerBtn.disabled = true;
  stopServerBtn.textContent = 'Stopping...';
  
  try {
    const result = await stopServer();
    if (result.success) {
      showToast('Server stopping...', 'success');
      await refreshServerStatus();
    } else {
      showToast(result.error || 'Stop failed', 'error');
    }
  } catch (e) {
    showToast('Stop error', 'error');
  }
  
  stopServerBtn.disabled = false;
  stopServerBtn.textContent = '■ Stop';
}

async function handleRestartServer() {
  restartServerBtn.disabled = true;
  restartServerBtn.textContent = 'Restarting...';
  
  try {
    const result = await restartServer();
    if (result.success) {
      showToast('Server restarting...', 'success');
      await refreshServerStatus();
    } else {
      showToast(result.error || 'Restart failed', 'error');
    }
  } catch (e) {
    showToast('Restart error', 'error');
  }
  
  restartServerBtn.disabled = false;
  restartServerBtn.textContent = '↻ Restart';
}

async function refreshInstalled() {
  try {
    installedMods = await fetchInstalled();
    renderInstalledMods();
  } catch (e) {
    console.error('Failed to fetch installed mods:', e);
  }
}

// Utility
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

// Server Status
async function refreshServerStatus() {
  try {
    const status = await fetchServerStatus();
    
    // Update server view
    serverStatusDot.className = 'status-dot ' + (status.running ? 'running' : 'stopped');
    serverStatusText.textContent = `Server: ${status.status}`;
    
    if (status.startedAt && status.running) {
      const uptime = formatUptime(new Date(status.startedAt));
      serverInfo.textContent = `Uptime: ${uptime}`;
    } else {
      serverInfo.textContent = '';
    }
    
    // Update button states
    startServerBtn.disabled = status.running;
    stopServerBtn.disabled = !status.running;
    restartServerBtn.disabled = !status.running;
    
    // Update sidebar status
    const sidebarDot = sidebarServerStatus.querySelector('.status-dot');
    const sidebarText = sidebarServerStatus.querySelector('.status-text');
    sidebarDot.className = 'status-dot ' + (status.running ? 'running' : 'stopped');
    sidebarText.textContent = `Server: ${status.status}`;
    
  } catch (e) {
    // Server status unavailable
    serverStatusText.textContent = 'Server: Unavailable';
    serverInfo.textContent = '';
  }
}

function formatUptime(startTime) {
  const now = new Date();
  const diff = now - startTime;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Console Logic
let inlineConsolePollInterval = null;
let isUserScrolledUp = false;

function startInlineConsolePoll() {
  refreshInlineConsoleLogs();
  if (inlineConsolePollInterval) clearInterval(inlineConsolePollInterval);
  inlineConsolePollInterval = setInterval(refreshInlineConsoleLogs, 2000);
}

function stopInlineConsolePoll() {
  if (inlineConsolePollInterval) {
    clearInterval(inlineConsolePollInterval);
    inlineConsolePollInterval = null;
  }
}

async function refreshInlineConsoleLogs() {
  try {
    const data = await fetchServerLogs();
    refreshAutoStopStatus(); // Update settings/idle status
    
    if (inlineConsoleOutput.textContent !== data.logs) {
      inlineConsoleOutput.textContent = data.logs || 'No logs available';
      
      if (!isUserScrolledUp) {
        inlineConsole.scrollTop = inlineConsole.scrollHeight;
      }
    }
  } catch (e) {
    inlineConsoleOutput.textContent = 'Failed to load logs: ' + e.message;
  }
}

// Scroll detection for inline console
inlineConsole.addEventListener('scroll', () => {
  const scrollPos = inlineConsole.scrollTop + inlineConsole.clientHeight;
  const scrollHeight = inlineConsole.scrollHeight;
  const isAtBottom = scrollHeight - scrollPos < 50;
  isUserScrolledUp = !isAtBottom;
});

// Legacy console modal (for sidebar quick access)
let consolePollInterval;

async function openConsoleModal() {
  consoleModal.classList.add('open');
  consoleOutput.textContent = 'Loading logs...';
  
  await refreshModalLogs();
  
  if (consolePollInterval) clearInterval(consolePollInterval);
  consolePollInterval = setInterval(refreshModalLogs, 2000);
}

function closeConsoleModal() {
  consoleModal.classList.remove('open');
  if (consolePollInterval) {
    clearInterval(consolePollInterval);
    consolePollInterval = null;
  }
}

async function refreshModalLogs() {
  try {
    const data = await fetchServerLogs();
    consoleOutput.textContent = data.logs || 'No logs available';
  } catch (e) {
    consoleOutput.textContent = 'Failed to load logs: ' + e.message;
  }
}

// Debounce search
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(handleSearch, 300);
});

// Init
async function init() {
  try {
    const communities = await fetchCommunities();
    communitySelect.innerHTML = `
      <option value="">Select a game...</option>
      ${communities.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
    `;
    
    // Default to Valheim if available
    const valheimOption = Array.from(communitySelect.options).find(opt => opt.value === 'valheim');
    if (valheimOption) {
      communitySelect.value = 'valheim';
      handleCommunityChange();
    }
    
    await refreshInstalled();
    await refreshServerStatus();
  } catch (e) {
    showToast('Failed to initialize', 'error');
  }
}

// Event Listeners - Navigation
navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    switchView(tab.dataset.view);
    closeMobileMenu(); // Close menu after selection on mobile
  });
});

// Event Listeners - Browse View
communitySelect.addEventListener('change', handleCommunityChange);
refreshBtn.addEventListener('click', handleCommunityChange);
filterToggleBtn.addEventListener('click', toggleFilterDropdown);
sortSelect.addEventListener('change', handleSearch);

// Event Listeners - Installed View
if (installedSearchInput) installedSearchInput.addEventListener('input', renderInstalledMods);
if (installedSortSelect) installedSortSelect.addEventListener('change', renderInstalledMods);
if (checkUpdatesBtn) checkUpdatesBtn.addEventListener('click', handleCheckUpdates);

// Event Listeners - Server View
startServerBtn.addEventListener('click', handleStartServer);
stopServerBtn.addEventListener('click', handleStopServer);
restartServerBtn.addEventListener('click', handleRestartServer);

// Event Listeners - Left Nav Sidebar
navCollapseBtn.addEventListener('click', toggleNavSidebar);

// Event Listeners - Right Sidebar
sidebarToggle.addEventListener('click', toggleRightSidebar);
viewConsoleBtn.addEventListener('click', () => switchView('server'));
quickRestartBtn.addEventListener('click', handleRestartServer);

// Event Listeners - Confirmation Modal
confirmCancel.addEventListener('click', hideUninstallConfirm);
confirmModalClose.addEventListener('click', hideUninstallConfirm);
confirmUninstallBtn.addEventListener('click', executeUninstall);
confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) hideUninstallConfirm();
});

// Event Listeners - Console Modal
modalClose.addEventListener('click', closeConsoleModal);
consoleModal.addEventListener('click', (e) => {
  if (e.target === consoleModal) closeConsoleModal();
});

// Mobile Menu
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileOverlay = document.getElementById('mobile-overlay');
const navSidebar = document.querySelector('.nav-sidebar');

function toggleMobileMenu() {
  navSidebar.classList.toggle('mobile-open');
  mobileOverlay.classList.toggle('active');
  mobileMenuBtn.textContent = navSidebar.classList.contains('mobile-open') ? '✕' : '☰';
}

function closeMobileMenu() {
  navSidebar.classList.remove('mobile-open');
  mobileOverlay.classList.remove('active');
  mobileMenuBtn.textContent = '☰';
}

mobileMenuBtn.addEventListener('click', toggleMobileMenu);
mobileOverlay.addEventListener('click', closeMobileMenu);

// Refresh server status periodically
setInterval(refreshServerStatus, 30000);

init();

// Auto-Stop Logic
const autoStopToggle = document.getElementById('auto-stop-toggle');
const autoStopTimeout = document.getElementById('auto-stop-timeout');
const autoStopStatus = document.getElementById('auto-stop-status');

async function setupAutoStop() {
  if (!autoStopToggle || !autoStopTimeout) return;

  // Add listeners
  autoStopToggle.addEventListener('change', saveAutoStopSettings);
  autoStopTimeout.addEventListener('change', saveAutoStopSettings);

  // Initial fetch
  await refreshAutoStopStatus();
}

async function saveAutoStopSettings() {
  const settings = {
    enabled: autoStopToggle.checked,
    timeoutMinutes: parseInt(autoStopTimeout.value)
  };

  try {
    await fetch('/api/settings/auto-stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    // Refresh to confirm sync and update status text
    refreshAutoStopStatus();
  } catch (e) {
    showToast('Failed to save settings', 'error');
  }
}

async function refreshAutoStopStatus() {
  try {
    const res = await fetch('/api/settings/auto-stop');
    const data = await res.json();

    // Update UI controls (only if not focused to avoid interruption)
    if (document.activeElement !== autoStopTimeout) {
      if (autoStopToggle) autoStopToggle.checked = data.enabled;
      if (autoStopTimeout) autoStopTimeout.value = data.timeoutMinutes;
    }
    
    // Update status text
    if (autoStopStatus) {
      if (data.enabled) {
        if (data.idleMinutes > 0) {
          autoStopStatus.textContent = `Idle: ${data.idleMinutes.toFixed(1)}m / ${data.timeoutMinutes}m`;
          autoStopStatus.style.color = 'var(--accent)';
        } else {
          autoStopStatus.textContent = 'Active (Monitoring)';
          autoStopStatus.style.color = 'var(--success)';
        }
      } else {
        autoStopStatus.textContent = 'Disabled';
        autoStopStatus.style.color = 'var(--text-muted)';
      }
    }
  } catch (e) {
    console.error('Failed to fetch auto-stop settings', e);
  }
}

// Initialize Auto-Stop
setupAutoStop();

// === World Backup Logic ===
const createBackupBtn = document.getElementById('create-backup-btn');
const backupList = document.getElementById('backup-list');

function setupBackups() {
  if (createBackupBtn) {
    createBackupBtn.addEventListener('click', createBackup);
  }
  refreshBackups();
}

async function refreshBackups() {
  if (!backupList) return;
  
  try {
    const res = await fetch('/api/backups');
    const backups = await res.json();
    
    if (backups.length === 0) {
      backupList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; padding: 8px;">No backups found.</div>';
      return;
    }

    backupList.innerHTML = backups.map(b => {
      const date = new Date(b.created).toLocaleString();
      const sizeStr = (b.size / 1024 / 1024).toFixed(2) + ' MB';
      
      return `
        <div class="backup-item">
          <div class="backup-info">
            <span class="backup-date">${b.filename}</span>
            <span class="backup-size">${date} • ${sizeStr}</span>
          </div>
          <div class="backup-actions">
            <button class="backup-btn restore" onclick="restoreBackup('${b.filename}')">Restore</button>
            <button class="backup-btn delete" onclick="deleteBackup('${b.filename}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (e) {
    backupList.innerHTML = '<div style="color: #ff4444; font-size: 0.9rem; padding: 8px;">Failed to load backups.</div>';
  }
}

async function createBackup() {
  createBackupBtn.disabled = true;
  // createBackupBtn.textContent = '+'; // Keep text as +
  
  try {
    const res = await fetch('/api/backups/create', { method: 'POST' });
    const data = await res.json();
    
    if (data.success) {
      showToast('Backup created successfully', 'success');
      refreshBackups();
    } else {
      showToast('Backup failed: ' + (data.error || 'Unknown error'), 'error');
    }
  } catch (e) {
    showToast('Backup request failed', 'error');
  } finally {
    createBackupBtn.disabled = false;
    // createBackupBtn.textContent = '+';
  }
}

async function restoreBackup(filename) {
  if (!confirm('Are you sure you want to restore ' + filename + '? This will overwrite current data!')) return;
  
  try {
    const res = await fetch('/api/backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    const data = await res.json();
    
    if (data.success) {
      showToast('Restored successfully', 'success');
    } else {
      showToast('Restore failed: ' + data.detail || data.error, 'error');
    }
  } catch (e) {
    showToast('Restore request failed', 'error');
  }
}

async function deleteBackup(filename) {
  if (!confirm('Start deletion of ' + filename + '?')) return;
  
  try {
    const res = await fetch(`/api/backups/${filename}`, { method: 'DELETE' });
    const data = await res.json();
    
    if (data.success) {
      showToast('Backup deleted', 'success');
      refreshBackups();
    } else {
      showToast('Delete failed', 'error');
    }
  } catch (e) {
    showToast('Delete request failed', 'error');
  }
}

setupBackups();

// === Profile Export ===
const exportProfileBtn = document.getElementById('export-profile-btn');
const profileModal = document.getElementById('profile-modal');
const profileModalClose = document.getElementById('profile-modal-close');
const profileModalCancel = document.getElementById('profile-modal-cancel');
const profileCodeOutput = document.getElementById('profile-code-output');
const profileModCount = document.getElementById('profile-mod-count');
const profileCopyBtn = document.getElementById('profile-copy-btn');

async function openProfileExport() {
  profileCodeOutput.value = 'Generating...';
  profileModCount.textContent = '';
  profileModal.classList.add('open');

  try {
    const res = await fetch('/api/profile/export');
    const data = await res.json();

    if (data.error) {
      profileCodeOutput.value = '';
      profileModCount.textContent = data.error;
      return;
    }

    profileCodeOutput.value = data.profileCode;
    profileModCount.textContent = `${data.modCount} mod${data.modCount !== 1 ? 's' : ''} included`;
  } catch (e) {
    profileCodeOutput.value = '';
    profileModCount.textContent = 'Failed to generate profile: ' + e.message;
  }
}

function closeProfileModal() {
  profileModal.classList.remove('open');
}

async function copyProfileCode() {
  const code = profileCodeOutput.value;
  if (!code || code === 'Generating...') return;

  try {
    await navigator.clipboard.writeText(code);
    profileCopyBtn.textContent = 'Copied!';
    setTimeout(() => { profileCopyBtn.textContent = 'Copy to Clipboard'; }, 2000);
  } catch (e) {
    profileCodeOutput.select();
    showToast('Press Ctrl+C to copy', 'info');
  }
}

if (exportProfileBtn) exportProfileBtn.addEventListener('click', openProfileExport);
if (profileModalClose) profileModalClose.addEventListener('click', closeProfileModal);
if (profileModalCancel) profileModalCancel.addEventListener('click', closeProfileModal);
if (profileCopyBtn) profileCopyBtn.addEventListener('click', copyProfileCode);
profileModal.addEventListener('click', (e) => {
  if (e.target === profileModal) closeProfileModal();
});
