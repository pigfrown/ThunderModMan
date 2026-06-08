const express = require('express');
const path = require('path');
const thunderstore = require('./thunderstore');
const mods = require('./mods');

const app = express();
const PORT = process.env.PORT || 9876;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes

/**
 * Get supported communities
 */
app.get('/api/communities', (req, res) => {
  res.json(thunderstore.getCommunities());
});

/**
 * Get all packages for a community
 */
app.get('/api/packages/:community', async (req, res) => {
  try {
    const packages = await thunderstore.getPackages(req.params.community);
    res.json(packages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Search packages
 */
/**
 * Search packages
 */
app.get('/api/packages/:community/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const sort = req.query.sort || 'last-updated';
    const categories = req.query.categories ? req.query.categories.split(',') : [];
    
    const packages = await thunderstore.searchPackages(
      req.params.community, 
      query,
      sort,
      categories
    );
    res.json(packages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Get installed mods
 */
app.get('/api/installed', async (req, res) => {
  try {
    const installed = await mods.getInstalledMods();
    res.json(installed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Install a mod (with dependencies)
 */
app.post('/api/install', async (req, res) => {
  try {
    const { community, fullName, includeDeps } = req.body;
    
    if (!community || !fullName) {
      return res.status(400).json({ error: 'community and fullName required' });
    }

    let packagesToInstall = [];
    
    if (includeDeps) {
      // Resolve and install dependencies
      packagesToInstall = await thunderstore.resolveDependencies(community, fullName);
    } else {
      // Just install this package
      const pkg = await thunderstore.getPackageByName(community, fullName);
      if (pkg) {
        packagesToInstall = [pkg];
      }
    }

    const results = [];
    for (const pkg of packagesToInstall) {
      try {
        const result = await mods.installMod(pkg);
        results.push({ fullName: pkg.fullName, ...result });
      } catch (e) {
        results.push({ fullName: pkg.fullName, success: false, message: e.message });
      }
    }

    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Update a mod
 */
app.post('/api/update', async (req, res) => {
  try {
    const { community, fullName } = req.body;
    if (!community || !fullName) {
      return res.status(400).json({ error: 'community and fullName required' });
    }

    const pkg = await thunderstore.getPackageByName(community, fullName);
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found on Thunderstore' });
    }

    const result = await mods.updateMod(pkg);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Uninstall a mod
 */
app.delete('/api/uninstall/:fullName', async (req, res) => {
  try {
    const result = await mods.uninstallMod(req.params.fullName);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Restart game server container (optional feature)
 */
app.post('/api/restart-server', async (req, res) => {
  const containerName = process.env.RESTART_CONTAINER;
  if (!containerName) {
    return res.status(400).json({ error: 'RESTART_CONTAINER not configured' });
  }

  try {
    const Docker = require('dockerode');
    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    const container = docker.getContainer(containerName);
    await container.restart();
    res.json({ success: true, message: `Restarted ${containerName}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Start game server container
 */
app.post('/api/start-server', async (req, res) => {
  const containerName = process.env.RESTART_CONTAINER;
  if (!containerName) {
    return res.status(400).json({ error: 'RESTART_CONTAINER not configured' });
  }

  try {
    const Docker = require('dockerode');
    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    const container = docker.getContainer(containerName);
    await container.start();
    res.json({ success: true, message: `Started ${containerName}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Stop game server container
 */
app.post('/api/stop-server', async (req, res) => {
  const containerName = process.env.RESTART_CONTAINER;
  if (!containerName) {
    return res.status(400).json({ error: 'RESTART_CONTAINER not configured' });
  }

  try {
    const Docker = require('dockerode');
    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    const container = docker.getContainer(containerName);
    await container.stop();
    res.json({ success: true, message: `Stopped ${containerName}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Get server container status
 */
app.get('/api/server-status', async (req, res) => {
  const containerName = process.env.RESTART_CONTAINER;
  if (!containerName) {
    return res.status(400).json({ error: 'RESTART_CONTAINER not configured' });
  }

  try {
    const Docker = require('dockerode');
    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    const container = docker.getContainer(containerName);
    const info = await container.inspect();
    
    res.json({
      name: containerName,
      status: info.State.Status,
      running: info.State.Running,
      startedAt: info.State.StartedAt
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Get server container logs
 */
app.get('/api/server-logs', async (req, res) => {
  const containerName = process.env.RESTART_CONTAINER;
  if (!containerName) {
    return res.status(400).json({ error: 'RESTART_CONTAINER not configured' });
  }

  try {
    const Docker = require('dockerode');
    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    const container = docker.getContainer(containerName);
    
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 200,
      timestamps: true
    });
    
    // Convert buffer to string and clean up Docker stream headers
    const logString = logs.toString('utf-8')
      .split('\n')
      .map(line => line.slice(8)) // Remove Docker stream header bytes
      .filter(line => line.trim())
      .join('\n');
    
    res.json({ logs: logString });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Auto-Stop Configuration
let autoStopConfig = {
  enabled: false,
  timeoutMinutes: 15,
  lastActivity: Date.now(),
  idleSince: null
};

// Monitoring Loop
const MONITOR_INTERVAL = 60 * 1000; // 1 minute
let lastNetworkStats = { rx: 0, tx: 0 };

setInterval(async () => {
  if (!autoStopConfig.enabled) return;

  const containerName = process.env.RESTART_CONTAINER;
  if (!containerName) return;

  try {
    const Docker = require('dockerode');
    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    const container = docker.getContainer(containerName);
    
    // Check if running
    const info = await container.inspect();
    if (!info.State.Running) {
      autoStopConfig.idleSince = null;
      return;
    }

    // Get Stats
    const stats = await container.stats({ stream: false });
    
    // Calculate Network Activity
    // Sum up rx_bytes and tx_bytes across all networks
    let currentRx = 0;
    let currentTx = 0;
    
    if (stats.networks) {
      Object.values(stats.networks).forEach(net => {
        currentRx += net.rx_bytes;
        currentTx += net.tx_bytes;
      });
    }

    // Check for activity (threshold: 1KB change per minute)
    const delta = (currentRx - lastNetworkStats.rx) + (currentTx - lastNetworkStats.tx);
    lastNetworkStats = { rx: currentRx, tx: currentTx };
    
    // If delta is huge, it might be a restart or first run, ignore
    if (delta < 0) return; 

    // Threshold: 5KB per minute (very low traffic = idle)
    // Active players usually generate continuous traffic
    const IS_IDLE = delta < 5000;

    if (IS_IDLE) {
      if (!autoStopConfig.idleSince) {
        autoStopConfig.idleSince = Date.now();
      }
      
      const idleMinutes = (Date.now() - autoStopConfig.idleSince) / 1000 / 60;
      console.log(`[Auto-Stop] Server idle for ${idleMinutes.toFixed(1)}m (Delta: ${delta} bytes)`);

      if (idleMinutes >= autoStopConfig.timeoutMinutes) {
        console.log('[Auto-Stop] Timeout reached. Stopping server...');
        await container.stop();
        autoStopConfig.idleSince = null; // Reset
      }
    } else {
      // Reset idle timer
      if (autoStopConfig.idleSince) {
        console.log(`[Auto-Stop] Activity detected (Delta: ${delta} bytes). Timer reset.`);
      }
      autoStopConfig.idleSince = null;
    }

  } catch (e) {
    console.error('[Auto-Stop] Monitoring error:', e.message);
  }
}, MONITOR_INTERVAL);

// ... existing endpoints ...

/**
 * Get Auto-Stop Settings
 */
app.get('/api/settings/auto-stop', (req, res) => {
  res.json({
    enabled: autoStopConfig.enabled,
    timeoutMinutes: autoStopConfig.timeoutMinutes,
    idleMinutes: autoStopConfig.idleSince ? (Date.now() - autoStopConfig.idleSince) / 1000 / 60 : 0
  });
});

/**
 * Update Auto-Stop Settings
 */
app.post('/api/settings/auto-stop', (req, res) => {
  const { enabled, timeoutMinutes } = req.body;
  
  if (typeof enabled === 'boolean') autoStopConfig.enabled = enabled;
  if (typeof timeoutMinutes === 'number') autoStopConfig.timeoutMinutes = timeoutMinutes;
  
  // Reset idle timer on config change
  autoStopConfig.idleSince = null;
  
  res.json({ success: true, config: autoStopConfig });
});


// ... Auto-Stop Settings Endpoints ...

// === Backup System ===
const fs = require('fs');
const { exec } = require('child_process');

const BACKUP_DIR = path.join(__dirname, '../backups');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../valheim-data');

// Ensure backup dir exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * List Backups
 */
app.get('/api/backups', (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.zip'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename: f,
          size: stats.size,
          created: stats.mtime
        };
      })
      .sort((a, b) => b.created - a.created); // Newest first

    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Create Backup
 */
app.post('/api/backups/create', (req, res) => {
  // Filename: backup-YYYY-MM-DD-HH-MM-SS.zip
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${timestamp}.zip`;
  const filepath = path.join(BACKUP_DIR, filename);
  
  // Check if source exists
  if (!fs.existsSync(DATA_DIR)) {
    return res.status(404).json({ error: `Source directory not found: ${DATA_DIR}` });
  }

  // ZIP command
  // cd DATA_DIR && zip -r filepath .
  // We cd to avoid including full path structure
  const cmd = `cd "${DATA_DIR}" && zip -r "${filepath}"  . -x "*.old"`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error('[Backup] Error:', stderr);
      return res.status(500).json({ error: 'Backup failed', details: stderr });
    }
    
    res.json({ success: true, filename, message: 'Backup created successfully' });
  });
});

/**
 * Restore Backup
 */
app.post('/api/backups/restore', (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Filename required' });
  
  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup file not found' });

  // UNZIP command
  // unzip -o filepath -d DATA_DIR
  const cmd = `unzip -o "${filepath}" -d "${DATA_DIR}"`;
  
  // Create verify Data Dir exists (it should, but strictly)
  if (!fs.existsSync(DATA_DIR)) {
     fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error('[Restore] Error:', stderr);
      return res.status(500).json({ error: 'Restore failed', details: stderr });
    }
    
    res.json({ success: true, message: `Restored ${filename}` });
  });
});

/**
 * Delete Backup
 */
app.delete('/api/backups/:filename', (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(BACKUP_DIR, filename);
  
  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
  }

  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      res.json({ success: true, message: 'Backup deleted' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Export installed mods as a r2modman/Thunderstore Mod Manager profile code
 */
app.get('/api/profile/export', async (req, res) => {
  try {
    const zlib = require('zlib');
    const installed = await mods.getInstalledMods();

    if (installed.length === 0) {
      return res.status(400).json({ error: 'No mods installed' });
    }

    const modLines = installed.map(m => `  - ${m.fullName}-${m.version}`).join('\n');
    const yaml = `mods:\n${modLines}\n`;

    const compressed = zlib.gzipSync(Buffer.from(yaml, 'utf-8'));
    const profileCode = compressed.toString('base64');

    res.json({ profileCode, modCount: installed.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ThunderModMan running on http://0.0.0.0:${PORT}`);
  console.log(`Mods directory: ${mods.MODS_DIR}`);
});
