// ==UserScript==
// @name         Bitaxe Quick Stratum Setter (UI) - Wallet + Auto Worker
// @namespace    https://tampermonkey.net/
// @version      2.0.0
// @description  Click button -> clean UI -> set stratum pool/port + wallet on multiple Bitaxe rigs. Auto-sets user as {wallet}.bitaxe1/2/3, then restarts.
// @match        http://192.168.4.*/*
// @match        http://*/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(() => {
  "use strict";

  let RIGS = [];

  function getUserDefaults() {
    try {
      const stored = JSON.parse(localStorage.getItem('bitaxe-user-defaults') || '{}');
      return {
        stratumExtranonceSubscribe: stored.stratumExtranonceSubscribe ?? false,
        fallbackStratumURL: stored.fallbackStratumURL || "parasite.wtf",
        fallbackStratumPort: stored.fallbackStratumPort || 42069,
        fallbackStratumExtranonceSubscribe: stored.fallbackStratumExtranonceSubscribe ?? false,
        defaultWallet: stored.defaultWallet || "",
        defaultRigs: stored.defaultRigs || [
        ]
      };
    } catch {
      return {
        stratumExtranonceSubscribe: false,
        fallbackStratumURL: "parasite.wtf",
        fallbackStratumPort: 42069,
        fallbackStratumExtranonceSubscribe: false,
        defaultWallet: "",
        defaultRigs: [
        ]
      };
    }
  }

  function saveUserDefaults(defaults) {
    localStorage.setItem('bitaxe-user-defaults', JSON.stringify(defaults));
  }

  GM_addStyle(`
    #bx-btn {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #ffffff; border: none;
      padding: 14px 20px; border-radius: 12px; cursor: pointer;
      font: 600 14px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 20px rgba(37, 99, 235, 0.3), 0 1px 3px rgba(0,0,0,0.12);
      user-select: none; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(255,255,255,0.1);
    }
    #bx-btn:hover { 
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4), 0 4px 10px rgba(0,0,0,0.15);
    }

    #bx-overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
      display: none; align-items: center; justify-content: center;
      padding: 2rem; animation: fadeIn 0.2s ease-out;
    }
    @keyframes fadeIn { 
      from { opacity: 0; backdrop-filter: blur(0px); } 
      to { opacity: 1; backdrop-filter: blur(8px); } 
    }

    #bx-modal {
      width: min(1200px, 95vw); max-height: 90vh; overflow: hidden;
      background: #1e1e2e;
      color: #cdd6f4;
      border: 1px solid #313244;
      border-radius: 16px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05);
      font: 14px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      display: flex; flex-direction: column;
    }

    #bx-header {
      background: linear-gradient(135deg, #181825 0%, #11111b 100%);
      color: #cdd6f4; padding: 2rem;
      border-bottom: 1px solid #313244;
      position: relative;
    }

    #bx-title { 
      font-weight: 700; font-size: 1.75rem; margin-bottom: 0.5rem;
      color: #89b4fa;
      letter-spacing: -0.025em;
    }
    #bx-subtitle { 
      font-size: 0.875rem; color: #a6adc8;
      font-weight: 500;
    }

    #bx-close {
      position: absolute; top: 1.5rem; right: 2rem;
      width: 2.5rem; height: 2.5rem; border-radius: 10px;
      border: 1px solid #313244;
      background: #181825;
      color: #cdd6f4; cursor: pointer; 
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 1.1rem; font-weight: 500;
      display: flex; align-items: center; justify-content: center;
    }
    #bx-close:hover { 
      background: #f38ba8; color: #11111b;
      border-color: #f38ba8;
      transform: scale(1.05);
    }

    #bx-body { 
      padding: 2rem; 
      flex: 1; 
      overflow-y: auto;
      background: #1e1e2e;
    }
    .bx-section { 
      padding: 1.75rem; 
      background: #181825; 
      border-radius: 12px; 
      border: 1px solid #313244;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .bx-section:hover {
      border-color: #45475a;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .bx-sections-row {
      display: flex; gap: 1.75rem;
    }
    .bx-sections-row .bx-section {
      flex: 1;
      min-width: 0;
    }
    .bx-section-title { 
      font-weight: 650; margin-bottom: 1.5rem; color: #fab387; 
      font-size: 1.1rem; display: flex; align-items: center; gap: 0.75rem;
      border-bottom: 1px solid #313244;
      padding-bottom: 1rem;
      letter-spacing: -0.025em;
    }
    .bx-row { 
      display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem; 
    }
    .bx-row:last-child {
      margin-bottom: 0;
    }
    .bx-label { 
      font-size: 0.875rem; color: #a6adc8; font-weight: 500;
      margin-bottom: 0.5rem;
      letter-spacing: 0.025em;
    }
    .bx-input, .bx-select {
      width: 100%; padding: 0.875rem 1rem; border-radius: 8px;
      background: #11111b; color: #cdd6f4;
      border: 1.5px solid #313244;
      outline: none; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 0.875rem;
      font-weight: 450;
    }
    .bx-select {
      background: #11111b; color: #cdd6f4;
    }
    .bx-select option {
      background: #11111b; color: #cdd6f4;
    }
    .bx-input:focus, .bx-select:focus { 
      border-color: #89b4fa; 
      box-shadow: 0 0 0 3px rgba(137, 180, 250, 0.12);
      background: #181825;
    }
    .bx-input::placeholder {
      color: #6c7086;
    }

    .bx-config-row { 
      display: flex; gap: 1rem; align-items: flex-end; 
    }
    .bx-config-row .bx-row { 
      flex: 1; margin-bottom: 0; 
    }
    .bx-config-buttons { 
      display: flex; gap: 0.75rem; 
    }
    .bx-small-btn {
      padding: 0.75rem 1rem; font-size: 0.875rem; border-radius: 8px;
      border: 1px solid #313244; 
      background: #89b4fa; color: #11111b;
      cursor: pointer; 
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-weight: 600; white-space: nowrap;
    }
    .bx-small-btn:hover { 
      background: #74c7ec; 
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(137, 180, 250, 0.25);
    }
    .bx-delete { 
      background: #f38ba8; color: #11111b;
      border-color: #f38ba8;
    }
    .bx-delete:hover { 
      background: #eba0ac;
      box-shadow: 0 4px 12px rgba(243, 139, 168, 0.25);
    }

    #bx-footer {
      padding: 1.75rem 2rem;
      display: flex; gap: 1rem; align-items: center; justify-content: flex-end;
      border-top: 1px solid #313244;
      background: #181825;
    }

    .bx-btn2 {
      border: 1px solid #313244; 
      background: #45475a; color: #cdd6f4; 
      padding: 0.875rem 1.5rem; 
      border-radius: 8px;
      cursor: pointer; font-weight: 600; 
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 0.875rem;
    }
    .bx-btn2:hover { 
      background: #585b70;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .bx-primary {
      background: #89b4fa; color: #11111b;
      border-color: #89b4fa;
    }
    .bx-primary:hover { 
      background: #74c7ec;
      border-color: #74c7ec;
      box-shadow: 0 4px 12px rgba(137, 180, 250, 0.25);
    }

    #bx-log {
      padding: 1.5rem 2rem; margin: 0;
      max-height: 200px; overflow-y: auto;
      border-top: 1px solid #313244;
      font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
      font-size: 0.8rem; line-height: 1.6;
      color: #cdd6f4; 
      background: #11111b;
      white-space: pre-wrap;
    }
    .bx-muted { 
      color: #6c7086; 
    }

    #bx-donate {
      position: fixed; right: 18px; bottom: 75px; z-index: 2147483647;
      background: var(--bs-success, #198754); color: var(--bs-light, #fff); 
      border: none;
      padding: 0.5rem 0.75rem; border-radius: 0.375rem; cursor: pointer;
      font: 500 0.875rem -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 0.25rem 0.75rem rgba(0,0,0,.1);
      user-select: none; transition: all 0.15s ease;
    }
    #bx-donate:hover { 
      background: var(--bs-success, #157347); 
      transform: translateY(-1px); 
      box-shadow: 0 0.375rem 1rem rgba(0,0,0,.15);
    }

    #bx-donate-modal {
      position: fixed; inset: 0; z-index: 2147483648;
      background: rgba(0,0,0,.5); backdrop-filter: blur(3px);
      display: none; align-items: center; justify-content: center;
      padding: 1rem;
    }
    
    #bx-donate-content {
      width: min(400px, 95vw);
      background: var(--bs-dark, #212529); color: var(--bs-light, #f8f9fa); 
      border: 1px solid var(--bs-border-color, #495057); 
      border-radius: 0.375rem; 
      box-shadow: 0 0.5rem 1rem rgba(0,0,0,.15);
      overflow: hidden;
    }
    
    .bx-donate-header {
      background: var(--bs-success, #198754);
      color: var(--bs-light, #fff); text-align: center; padding: 1.5rem;
      font-weight: 600; font-size: 1.125rem;
    }
    
    .bx-wallet-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem; border-bottom: 1px solid var(--bs-border-color, #495057);
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.875rem;
    }
    .bx-wallet-item:last-child { border-bottom: none; }
    
    .bx-wallet-label { 
      font-weight: 600; color: var(--bs-warning, #ffc107); 
      min-width: 3rem; margin-right: 1rem;
    }
    .bx-wallet-addr { 
      color: var(--bs-light, #f8f9fa); word-break: break-all; 
      flex: 1; margin-right: 1rem;
    }
    
    .bx-copy-btn {
      background: var(--bs-primary, #0d6efd); 
      border: 1px solid var(--bs-primary, #0d6efd);
      color: var(--bs-light, #fff); padding: 0.5rem 0.75rem; 
      border-radius: 0.375rem;
      cursor: pointer; font-size: 0.75rem; font-weight: 500;
      transition: all 0.15s ease; white-space: nowrap;
    }
    .bx-copy-btn:hover { 
      background: var(--bs-primary, #0b5ed7); 
      border-color: var(--bs-primary, #0b5ed7);
    }

    #bx-device-list {
      border: 1px solid #313244; 
      border-radius: 8px; 
      background: #11111b; padding: 1rem; min-height: 3.5rem;
    }
    
    .bx-device-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.75rem; margin-bottom: 0.5rem;
      background: #181825; border-radius: 6px;
      border: 1px solid #313244;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .bx-device-item:hover {
      background: #1e1e2e;
      border-color: #45475a;
      transform: translateX(2px);
    }
    .bx-device-item:last-child { 
      margin-bottom: 0; 
    }
    
    .bx-device-info { 
      font-size: 0.875rem; 
    }
    .bx-device-url { 
      font-weight: 600; color: #89b4fa; 
      margin-bottom: 0.25rem;
    }
    .bx-device-worker { 
      color: #a6adc8; font-size: 0.75rem; 
      font-weight: 450;
    }
    
    .bx-no-devices {
      text-align: center; padding: 1.5rem;
      color: #6c7086; font-size: 0.875rem;
      font-style: italic;
    }
  `); 

  const btn = document.createElement("div");
  btn.id = "bx-btn";
  btn.textContent = "Bitaxe Setter";
  document.body.appendChild(btn);

  const donateBtn = document.createElement("div");
  donateBtn.id = "bx-donate";
  donateBtn.textContent = "💝 Donate";
  document.body.appendChild(donateBtn);

  const overlay = document.createElement("div");
  overlay.id = "bx-overlay";
  overlay.innerHTML = `
    <div id="bx-modal" role="dialog" aria-modal="true">
      <div id="bx-header">
        <div>
          <div id="bx-title">Bitaxe Stratum Configuration</div>
          <div id="bx-subtitle">Applies to: ${RIGS.map(r => r.url.replace("http://","")).join(", ")}</div>
        </div>
        <button id="bx-close" title="Close">✕</button>
      </div>

      <div id="bx-body">
        <!-- Single horizontal row with all four sections -->
        <div class="bx-sections-row">
          <div class="bx-section">
            <div class="bx-section-title">📱 Device Management</div>
            <div class="bx-row">
              <div class="bx-label">Discovered Devices</div>
              <div id="bx-device-list"></div>
            </div>
            <div class="bx-config-row">
              <div class="bx-row" style="flex: 1;">
                <button class="bx-btn2" id="bx-discover-devices" style="width: 100%;">Discover Devices</button>
              </div>
              <div class="bx-config-buttons">
                <button class="bx-small-btn" id="bx-reset-devices" title="Reset to defaults">Reset</button>
              </div>
            </div>
            <div class="bx-row">
              <div class="bx-label">Manual Device Entry</div>
              <div style="display: flex; gap: 0.75rem;">
                <input class="bx-input" id="bx-manual-device" style="flex: 1;" placeholder="192.168.1.100 or 192.168.1.100:8080" />
                <button class="bx-small-btn" id="bx-add-device" title="Add device manually">Add</button>
              </div>
            </div>
          </div>

          <div class="bx-section">
            <div class="bx-section-title">⚙️ Default Settings</div>
            <div class="bx-row">
              <div class="bx-label">Default Wallet Address</div>
              <input class="bx-input" id="bx-default-wallet" placeholder="Enter your default wallet address..." />
            </div>
            <div style="display: flex; gap: 1rem;">
              <div class="bx-row" style="flex: 1;">
                <div class="bx-label">Fallback Pool</div>
                <input class="bx-input" id="bx-default-fallback-url" placeholder="pool.example.com" />
              </div>
              <div class="bx-row" style="flex: 0 0 100px;">
                <div class="bx-label">Port</div>
                <input class="bx-input" id="bx-default-fallback-port" type="number" placeholder="4444" />
              </div>
            </div>
            <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
              <button class="bx-small-btn" id="bx-save-defaults">Save Defaults</button>
              <button class="bx-small-btn" id="bx-reset-defaults">Reset</button>
            </div>
          </div>

          <div class="bx-section">
            <div class="bx-section-title">💾 Saved Configurations</div>
            <div class="bx-row">
              <div class="bx-label">Load Configuration</div>
              <select class="bx-select" id="bx-config-select">
                <option value="">Select a saved configuration...</option>
              </select>
            </div>
            <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem;">
              <button class="bx-small-btn" id="bx-load-config">Load</button>
              <button class="bx-small-btn bx-delete" id="bx-delete-config">Delete</button>
            </div>
            <div class="bx-row">
              <div class="bx-label">Save Current Settings</div>
              <div style="display: flex; gap: 0.75rem;">
                <input class="bx-input" id="bx-config-name" style="flex: 1;" placeholder="Configuration name..." />
                <button class="bx-small-btn" id="bx-save-config">Save</button>
              </div>
            </div>
          </div>

          <div class="bx-section">
            <div class="bx-section-title">🌊 Pool Settings</div>
            <div class="bx-row">
              <div class="bx-label">Mining Pool</div>
              <input class="bx-input" id="bx-pool" placeholder="pool.example.com:4444" />
            </div>
            <div class="bx-row">
              <div class="bx-label">Wallet Address</div>
              <div style="display: flex; gap: 0.75rem;">
                <input class="bx-input" id="bx-wallet" style="flex: 1;" placeholder="Your wallet address" />
                <button class="bx-small-btn" id="bx-load-defaults" title="Load default wallet">Use Default</button>
              </div>
            </div>
            <div class="bx-row">
              <div class="bx-label">Password</div>
              <input class="bx-input" id="bx-pass" value="x" placeholder="x or d=1000" />
            </div>
          </div>
        </div>
      </div>

      <div id="bx-footer">
        <button class="bx-btn2" id="bx-test">Test Settings</button>
        <button class="bx-btn2 bx-primary" id="bx-apply">Apply & Restart</button>
      </div>

      <div id="bx-log"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const donateModal = document.createElement("div");
  donateModal.id = "bx-donate-modal";
  donateModal.innerHTML = `
    <div id="bx-donate-content">
      <div class="bx-donate-header">💝 Support Development</div>
      <div class="bx-wallet-item">
        <div>
          <div class="bx-wallet-label">BTC:</div>
          <div class="bx-wallet-addr">36hE3rMDd5D3tKXwyBwb6osCaS8WaEobMQ</div>
        </div>
        <button class="bx-copy-btn" data-addr="36hE3rMDd5D3tKXwyBwb6osCaS8WaEobMQ">Copy</button>
      </div>
      <div class="bx-wallet-item">
        <div>
          <div class="bx-wallet-label">BCH:</div>
          <div class="bx-wallet-addr">1FPci6mT2wA84ubS88YfVuNX4sgaRRnJKG</div>
        </div>
        <button class="bx-copy-btn" data-addr="1FPci6mT2wA84ubS88YfVuNX4sgaRRnJKG">Copy</button>
      </div>
      <div class="bx-wallet-item">
        <div>
          <div class="bx-wallet-label">DOGE:</div>
          <div class="bx-wallet-addr">DRWF6Ef7voWRLHaKNNwSyi1JYLTwmeGobc</div>
        </div>
        <button class="bx-copy-btn" data-addr="DRWF6Ef7voWRLHaKNNwSyi1JYLTwmeGobc">Copy</button>
      </div>
      <div class="bx-wallet-item">
        <div>
          <div class="bx-wallet-label">LTC:</div>
          <div class="bx-wallet-addr">MFyjfnCxdJT66MPE5VpYoAAHkqMjcwS7PT</div>
        </div>
        <button class="bx-copy-btn" data-addr="MFyjfnCxdJT66MPE5VpYoAAHkqMjcwS7PT">Copy</button>
      </div>
      <div class="bx-wallet-item">
        <div>
          <div class="bx-wallet-label">ETH:</div>
          <div class="bx-wallet-addr">0x826E5Cc97838dd0d71A2E4232E93155ad31720D2</div>
        </div>
        <button class="bx-copy-btn" data-addr="0x826E5Cc97838dd0d71A2E4232E93155ad31720D2">Copy</button>
      </div>
    </div>
  `;
  document.body.appendChild(donateModal);

  const $ = (sel) => overlay.querySelector(sel);

  function getStoredDevices() {
    try {
      return JSON.parse(localStorage.getItem('bitaxe-devices') || '[]');
    } catch {
      return [];
    }
  }

  function saveDevices(devices) {
    try {
      console.log('saveDevices called with:', devices);
      localStorage.setItem('bitaxe-devices', JSON.stringify(devices));
      RIGS = [...devices];
      console.log('RIGS updated to:', RIGS);
      updateDeviceDisplay();
      updateSubtitle();
      console.log('saveDevices completed successfully');
    } catch (error) {
      console.error('Error in saveDevices:', error);
      throw error;
    }
  }

  function loadDevices() {
    const stored = getStoredDevices();
    const userDefaults = getUserDefaults();
    RIGS = stored.length > 0 ? stored : userDefaults.defaultRigs;
    updateDeviceDisplay();
  }

  async function discoverDevices() {
    logLine("🔍 Discovering Bitaxe devices...");
    
    logLine(`   Scanning network for Bitaxe devices...`);
    await scanNetworkRange();
  }
  
  async function scanNetworkRange() {
    const ipRanges = ['192.168.4.', '192.168.1.', '10.0.0.', '172.16.0.'];
    const devices = [];
    let found = 0;
    
    logLine(`   Scanning multiple IP ranges for Bitaxe devices...`);
    logLine(`   Using 300ms timeout per device, optimized for local network`);
    
    const rangePromises = ipRanges.map(async (baseIp) => {
      logLine(`   Scanning ${baseIp}1-254...`);
      const rangeDevices = [];
      
      const batchSize = 50;
      const batches = [];
      
      for (let start = 1; start <= 254; start += batchSize) {
        const end = Math.min(start + batchSize - 1, 254);
        batches.push({ start, end });
      }
      
      const batchPromises = batches.map(async (batch) => {
        const promises = [];
        for (let i = batch.start; i <= batch.end; i++) {
          const ip = `${baseIp}${i}`;
          promises.push(testDevice(ip));
        }
        
        const results = await Promise.allSettled(promises);
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            const ip = `${baseIp}${batch.start + index}`;
            const deviceInfo = result.value;
            
            const deviceUrl = `http://${ip}${deviceInfo.port !== 80 ? ':' + deviceInfo.port : ''}`;
            
            rangeDevices.push({
              url: deviceUrl,
              worker: `bitaxe${++found}`
            });
            
            logLine(`   ✅ Found Bitaxe at ${ip}:${deviceInfo.port} via ${deviceInfo.endpoint}`);
          }
        });
      });
      
      await Promise.all(batchPromises);
      
      if (rangeDevices.length > 0) {
        logLine(`   Completed ${baseIp}x range: ${rangeDevices.length} device(s) found`);
      }
      
      return rangeDevices;
    });
    
    const rangeResults = await Promise.all(rangePromises);
    
    rangeResults.forEach(rangeDevices => {
      devices.push(...rangeDevices);
    });
    
    logLine(`   Scan complete: tested ${ipRanges.length} IP ranges`);
    logLine(`   Total devices found: ${devices.length}`);
    
    if (devices.length > 0) {
      logLine(`✅ Network scan found ${devices.length} device(s) total`);
      logLine(`   Saving devices to device list...`);
      
      try {
        console.log('About to save devices:', devices);
        saveDevices(devices);
        logLine(`✅ Successfully added ${devices.length} device(s) to device management`);
        logLine(`   Current device list: ${RIGS.map(r => r.url.replace('http://', '')).join(', ')}`);
        
        updateSubtitle();
        updateDeviceDisplay();
        
      } catch (error) {
        console.error('Error saving devices:', error);
        logLine(`❌ Error saving devices: ${error.message}`);
        logLine(`   Devices detected but not saved. You can add them manually.`);
      }
    } else {
      logLine(`❌ Network scan found no devices`);
      logLine(`   Possible reasons:`);
      logLine(`   • Devices are on a different network/VLAN`);
      logLine(`   • Devices are using non-standard ports`);
      logLine(`   • Network firewall blocking requests`);
      logLine(`   • Devices are powered off or not responding`);
      logLine(`   Using default configuration`);
      const userDefaults = getUserDefaults();
      RIGS = userDefaults.defaultRigs;
      updateDeviceDisplay();
    }
  }
  
  async function testDevice(ip) {
    const commonPorts = [80, 8080];
    const endpoints = [
      '/api/system/info',
      '/api/system'
    ];
    
    for (const port of commonPorts) {
      for (const endpoint of endpoints) {
        try {
          const url = `http://${ip}:${port}${endpoint}`;
          const response = await fetch(url, {
            method: 'GET',
            timeout: 300,
            signal: AbortSignal.timeout(300),
            headers: {
              'Accept': 'application/json, text/html, */*'
            }
          });
          
          if (response.ok) {
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
              data = await response.json();
            } else {
              data = await response.text();
            }
            
            const dataStr = typeof data === 'string' ? data.toLowerCase() : JSON.stringify(data).toLowerCase();
            
            if (dataStr.includes('bitaxe') || 
                dataStr.includes('asic') ||
                dataStr.includes('miner') ||
                dataStr.includes('hashrate') ||
                dataStr.includes('stratum') ||
                (data && typeof data === 'object' && (
                  data.ASICModel || data.model || data.boardVersion ||
                  data.stratumURL || data.hashRate || data.power
                ))) {
              
              return { ip, port, endpoint, data };
            }
          }
        } catch (error) {
          continue;
        }
      }
    }
    
    return false;
  }
  
  function updateDeviceDisplay() {
    const deviceList = document.getElementById('bx-device-list');
    console.log('updateDeviceDisplay called, deviceList element:', deviceList);
    console.log('Current RIGS:', RIGS);
    
    if (!deviceList) {
      console.error('Device list element not found!');
      return;
    }
    
    if (RIGS.length === 0) {
      deviceList.innerHTML = '<div class="bx-no-devices">No devices configured</div>';
      console.log('No devices - showing empty state');
      return;
    }
    
    const htmlContent = RIGS.map((rig, index) => `
      <div class="bx-device-item" data-index="${index}">
        <div class="bx-device-info">
          <div class="bx-device-url">${rig.url.replace('http://', '')}</div>
          <div class="bx-device-worker">${rig.worker}</div>
        </div>
        <button class="bx-small-btn bx-delete bx-remove-device" data-index="${index}" title="Remove device">✕</button>
      </div>
    `).join('');
    
    console.log('Generated device HTML:', htmlContent);
    deviceList.innerHTML = htmlContent;
    
    deviceList.querySelectorAll('.bx-remove-device').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-index'));
        removeDevice(index);
      });
    });
    
    console.log('Device display updated with', RIGS.length, 'devices');
  }
  
  function updateSubtitle() {
    const subtitle = document.getElementById('bx-subtitle');
    if (subtitle && RIGS.length > 0) {
      subtitle.textContent = `Applies to: ${RIGS.map(r => r.url.replace('http://', '')).join(', ')}`;
    }
  }
  
  function removeDevice(index) {
    if (index >= 0 && index < RIGS.length) {
      const removedDevice = RIGS[index];
      RIGS.splice(index, 1);
      saveDevices(RIGS);
      updateDeviceDisplay();
      updateSubtitle();
      logLine(`🗑️ Removed device: ${removedDevice.url.replace('http://', '')}`);
    }
  }
  
  window.removeDevice = removeDevice;

  function getConfigs() {
    try {
      return JSON.parse(localStorage.getItem('bitaxe-configs') || '{}');
    } catch {
      return {};
    }
  }

  function saveConfig(name, config) {
    const configs = getConfigs();
    configs[name] = config;
    localStorage.setItem('bitaxe-configs', JSON.stringify(configs));
    refreshConfigSelect();
  }

  function deleteConfig(name) {
    const configs = getConfigs();
    delete configs[name];
    localStorage.setItem('bitaxe-configs', JSON.stringify(configs));
    refreshConfigSelect();
  }

  function refreshConfigSelect() {
    const select = $("#bx-config-select");
    const configs = getConfigs();
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Select a saved config...</option>';
    Object.keys(configs).sort().forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    
    if (currentValue && configs[currentValue]) {
      select.value = currentValue;
    }
  }

  function getCurrentConfig() {
    return {
      pool: $("#bx-pool").value.trim(),
      wallet: $("#bx-wallet").value.trim(),
      password: $("#bx-pass").value.trim()
    };
  }

  function loadConfigData(config) {
    $("#bx-pool").value = config.pool || "";
    $("#bx-wallet").value = config.wallet || "";
    $("#bx-pass").value = config.password || "x";
  }

  function openUI() {
    overlay.style.display = "flex";
    refreshConfigSelect();
    loadDevices();
    loadDefaultsUI();
    updateDeviceDisplay();
    updateSubtitle();
    $("#bx-pool").focus();
    logLine("Ready! Enter pool:port + wallet, or load a saved config.");
    logLine("Workers auto-set as wallet.bitaxe1/2/3. Use password for difficulty (e.g., d=1000).");
    logLine("Tip: Click 'Auto-Discover Devices' to scan for Bitaxe rigs automatically.");
    logLine("Tip: Configure your defaults in the 'Default Settings' section.");
  }

  function closeUI() {
    overlay.style.display = "none";
  }

  btn.addEventListener("click", openUI);
  $("#bx-close").addEventListener("click", closeUI);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeUI(); });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (overlay.style.display === "flex") closeUI();
      if (donateModal.style.display === "flex") donateModal.style.display = "none";
    }
  });

  $("#bx-save-config").addEventListener("click", () => {
    const name = $("#bx-config-name").value.trim();
    if (!name) return logLine("❌ Please enter a config name.");
    
    const config = getCurrentConfig();
    if (!config.pool || !config.wallet) {
      return logLine("❌ Please fill in pool and wallet before saving.");
    }
    
    saveConfig(name, config);
    $("#bx-config-name").value = "";
    logLine(`✅ Config "${name}" saved successfully.`);
  });

  $("#bx-load-config").addEventListener("click", () => {
    const name = $("#bx-config-select").value;
    if (!name) return logLine("❌ Please select a config to load.");
    
    const configs = getConfigs();
    const config = configs[name];
    if (!config) return logLine("❌ Config not found.");
    
    loadConfigData(config);
    logLine(`✅ Config "${name}" loaded successfully.`);
  });

  $("#bx-delete-config").addEventListener("click", () => {
    const name = $("#bx-config-select").value;
    if (!name) return logLine("❌ Please select a config to delete.");
    
    if (!confirm(`Delete config "${name}"? This cannot be undone.`)) return;
    
    deleteConfig(name);
    logLine(`✅ Config "${name}" deleted successfully.`);
  });

  $("#bx-config-select").addEventListener("dblclick", () => {
    $("#bx-load-config").click();
  });

  $("#bx-discover-devices").addEventListener("click", async () => {
    $("#bx-discover-devices").textContent = "Discovering...";
    $("#bx-discover-devices").disabled = true;
    
    await discoverDevices();
    
    $("#bx-discover-devices").textContent = "Discover Devices";
    $("#bx-discover-devices").disabled = false;
  });

  $("#bx-reset-devices").addEventListener("click", () => {
    if (confirm('Reset to default devices? This will replace your discovered devices.')) {
      const userDefaults = getUserDefaults();
      RIGS = [...userDefaults.defaultRigs];
      saveDevices(RIGS);
      updateDeviceDisplay();
      updateSubtitle();
      logLine('🔄 Reset to default devices');
      logLine(`   Loaded ${RIGS.length} default device(s)`);
    }
  });

  $("#bx-add-device").addEventListener("click", () => {
    const deviceInput = $("#bx-manual-device").value.trim();
    if (!deviceInput) {
      return logLine("❌ Please enter an IP address or IP:port");
    }
    
    let ip, port = 80;
    if (deviceInput.includes(':')) {
      [ip, port] = deviceInput.split(':');
      port = parseInt(port) || 80;
    } else {
      ip = deviceInput;
    }
    
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      return logLine("❌ Invalid IP address format");
    }
    
    const url = `http://${ip}${port !== 80 ? ':' + port : ''}`;
    const workerNum = RIGS.length + 1;
    
    RIGS.push({
      url: url,
      worker: `bitaxe${workerNum}`
    });
    
    saveDevices(RIGS);
    updateDeviceDisplay();
    updateSubtitle();
    
    $("#bx-manual-device").value = "";
    logLine(`✅ Added device manually: ${url} → bitaxe${workerNum}`);
  });

  $("#bx-manual-device").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      $("#bx-add-device").click();
    }
  });

  $("#bx-save-defaults").addEventListener("click", () => {
    const defaultWallet = $("#bx-default-wallet").value.trim();
    const fallbackURL = $("#bx-default-fallback-url").value.trim();
    const fallbackPort = parseInt($("#bx-default-fallback-port").value) || 42069;
    
    if (!fallbackURL) {
      return logLine("❌ Please enter a fallback URL.");
    }
    
    const userDefaults = getUserDefaults();
    userDefaults.defaultWallet = defaultWallet;
    userDefaults.fallbackStratumURL = fallbackURL;
    userDefaults.fallbackStratumPort = fallbackPort;
    
    saveUserDefaults(userDefaults);
    logLine(`✅ Default settings saved successfully.`);
  });
  
  $("#bx-reset-defaults").addEventListener("click", () => {
    if (confirm('Reset all defaults to factory settings? This cannot be undone.')) {
      localStorage.removeItem('bitaxe-user-defaults');
      loadDefaultsUI();
      logLine('🔄 Reset to factory defaults');
    }
  });

  $("#bx-load-defaults").addEventListener("click", () => {
    const userDefaults = getUserDefaults();
    if (userDefaults.defaultWallet) {
      $("#bx-wallet").value = userDefaults.defaultWallet;
      logLine(`✅ Loaded default wallet: ${userDefaults.defaultWallet}`);
    } else {
      logLine("ℹ️ No default wallet configured. Set one in Default Settings.");
    }
  });

  donateBtn.addEventListener("click", () => {
    donateModal.style.display = "flex";
  });

  donateModal.addEventListener("click", (e) => {
    if (e.target === donateModal) {
      donateModal.style.display = "none";
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("bx-copy-btn")) {
      const addr = e.target.getAttribute("data-addr");
      navigator.clipboard.writeText(addr).then(() => {
        const originalText = e.target.textContent;
        e.target.textContent = "Copied!";
        setTimeout(() => {
          e.target.textContent = originalText;
        }, 1000);
      }).catch(() => {
        const textArea = document.createElement("textarea");
        textArea.value = addr;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        
        const originalText = e.target.textContent;
        e.target.textContent = "Copied!";
        setTimeout(() => {
          e.target.textContent = originalText;
        }, 1000);
      });
    }
  });

  function logLine(msg) {
    const log = $("#bx-log");
    const ts = new Date().toLocaleTimeString();
    log.textContent += `[${ts}] ${msg}\n`;
    log.scrollTop = log.scrollHeight;
  }
  function clearLog() { $("#bx-log").textContent = ""; }

  function parsePoolPort(input) {
    const trimmed = String(input || "").trim();
    const m = trimmed.match(/^(.+?)(?::(\d{1,5}))?$/);
    if (!m) return null;
    const host = (m[1] || "").trim();
    const port = m[2] ? Number(m[2]) : null;
    if (!host) return null;
    if (port !== null && (!Number.isFinite(port) || port < 1 || port > 65535)) return null;
    return { host, port };
  }

  async function patchSystem(baseUrl, payload) {
    const url = `${baseUrl}/api/system`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`PATCH failed (${res.status}) ${text.slice(0, 240)}`);
    return text;
  }

  async function restartRig(baseUrl) {
    const url = `${baseUrl}/api/system/restart`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`RESTART failed (${res.status}) ${text.slice(0, 240)}`);
    return text;
  }

  function buildPayloadForRig({ poolHost, poolPort, wallet, worker, pass }) {
    const userDefaults = getUserDefaults();
    return {
      stratumURL: poolHost,
      stratumPort: poolPort,
      stratumExtranonceSubscribe: userDefaults.stratumExtranonceSubscribe,
      stratumUser: `${wallet}.${worker}`,
      stratumPassword: pass,

      fallbackStratumURL: userDefaults.fallbackStratumURL,
      fallbackStratumPort: userDefaults.fallbackStratumPort,
      fallbackStratumExtranonceSubscribe: userDefaults.fallbackStratumExtranonceSubscribe,
      fallbackStratumUser: wallet,
    };
  }

  function loadDefaultsUI() {
    const userDefaults = getUserDefaults();
    
    const defaultWalletEl = $("#bx-default-wallet");
    const fallbackUrlEl = $("#bx-default-fallback-url");
    const fallbackPortEl = $("#bx-default-fallback-port");
    
    if (defaultWalletEl) defaultWalletEl.value = userDefaults.defaultWallet;
    if (fallbackUrlEl) fallbackUrlEl.value = userDefaults.fallbackStratumURL;
    if (fallbackPortEl) fallbackPortEl.value = userDefaults.fallbackStratumPort;
  }

  $("#bx-test").addEventListener("click", () => {
    clearLog();

    const poolPort = parsePoolPort($("#bx-pool").value);
    const wallet = $("#bx-wallet").value.trim();
    const pass = ($("#bx-pass").value || "x").trim() || "x";

    if (!poolPort || poolPort.port === null) return logLine("❌ Please enter pool:port (port required).");
    if (!wallet) return logLine("❌ Please enter wallet address.");

    logLine(`✅ Settings validation passed:`);
    logLine(`   Pool: ${poolPort.host}`);
    logLine(`   Port: ${poolPort.port}`);
    logLine(`   Wallet: ${wallet}`);
    logLine(`   Password: ${pass}`);
    logLine("");
    logLine(`🔧 Worker assignments:`);
    RIGS.forEach(r => logLine(`   ${r.url} → ${wallet}.${r.worker}`));
    logLine("");
    logLine(`💡 Tip: Use password for difficulty (e.g., "d=1000" or "x")`);
  });

  $("#bx-apply").addEventListener("click", async () => {
    clearLog();

    const poolPort = parsePoolPort($("#bx-pool").value);
    const wallet = $("#bx-wallet").value.trim();
    const pass = ($("#bx-pass").value || "x").trim() || "x";

    if (!poolPort || poolPort.port === null) return logLine("❌ Please enter pool:port (port required).");
    if (!wallet) return logLine("❌ Please enter wallet address.");

    logLine(`🚀 Applying settings to ${RIGS.length} rig(s)...`);
    logLine(`   Pool: ${poolPort.host}:${poolPort.port}`);
    logLine(`   Wallet: ${wallet}`);
    logLine(`   Password: ${pass}`);
    logLine("");

    const patchResults = await Promise.allSettled(
      RIGS.map(async (rig) => {
        const payload = buildPayloadForRig({
          poolHost: poolPort.host,
          poolPort: poolPort.port,
          wallet,
          worker: rig.worker,
          pass,
        });
        await patchSystem(rig.url, payload);
        return `${rig.url} → ${wallet}.${rig.worker}`;
      })
    );

    patchResults.forEach((r, i) => {
      const rig = RIGS[i];
      if (r.status === "fulfilled") logLine(`✅ PATCH OK: ${r.value}`);
      else logLine(`❌ PATCH FAIL: ${rig.url} -> ${r.reason?.message || r.reason}`);
    });

    logLine("");

    logLine("Restarting rigs...");
    const restartResults = await Promise.allSettled(
      RIGS.map(async (rig) => {
        await restartRig(rig.url);
        return rig.url;
      })
    );

    restartResults.forEach((r, i) => {
      const rig = RIGS[i];
      if (r.status === "fulfilled") logLine(`✅ RESTART OK: ${rig.url}`);
      else logLine(`❌ RESTART FAIL: ${rig.url} -> ${r.reason?.message || r.reason}`);
    });

    logLine("");
    logLine("Done.");
  });

  loadDevices();
})();
