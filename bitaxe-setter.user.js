// ==UserScript==
// @name         Bitaxe Quick Stratum Setter (Integrated UI) - Wallet + Auto Worker
// @namespace    https://tampermonkey.net/
// @version      4.0.0
// @description  Integrated UI for configuring multiple Bitaxe rigs. Auto-discovers devices, bulk configuration, and matches device theme.
// @author       Curtis
// @match        http://192.168.*.*/*
// @match        http://10.*.*.*/*
// @match        http://172.*.*.*/*
// @match        http://*/*
// @grant        GM_addStyle
// @run-at       document-end
// @updateURL    none
// @downloadURL  none
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

  function detectLocalSubnet() {
    const hostname = window.location.hostname;
    
    const ipMatch = hostname.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
      return ipMatch[1] + '.';
    }
    
    return '192.168.1.';
  }

  GM_addStyle(`
    /* Comprehensive CSS Reset and Isolation for Bitaxe Setter */
    #bitaxe-setter-panel {
      all: initial !important;
      display: block !important;
    }
    
    #bitaxe-setter-panel,
    #bitaxe-setter-panel *,
    #bitaxe-setter-panel *::before,
    #bitaxe-setter-panel *::after {
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      outline: 0 !important;
      font-size: 100% !important;
      vertical-align: baseline !important;
      background: transparent !important;
      text-decoration: none !important;
      text-transform: none !important;
      letter-spacing: normal !important;
      font-style: normal !important;
      font-weight: normal !important;
      line-height: normal !important;
      color: inherit !important;
    }

    /* Root container with theme variables and strong isolation */
    #bitaxe-setter-panel.bitaxe-setter-container {
      /* CSS Custom Properties matching AxeOS dashboard */
      --bx-primary: #4caf50;
      --bx-primary-text: #ffffff;
      --bx-bg-primary: #0B1219;
      --bx-bg-secondary: #070D17;
      --bx-bg-raised: #1A2632;
      --bx-border: #1A2632;
      --bx-border-hover: rgba(255,255,255,0.03);
      --bx-text: rgba(255, 255, 255, 0.87);
      --bx-text-secondary: rgba(255, 255, 255, 0.6);
      --bx-danger: #f85149;
      --bx-success: #4caf50;
      --bx-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      
      /* Strong styling overrides */
      position: relative !important;
      z-index: 1000 !important;
      margin: 2rem 0 !important;
      background: var(--bx-bg-primary, #0B1219) !important;
      border: 1px solid var(--bx-border, #2a3441) !important;
      border-radius: 12px !important;
      overflow: hidden !important;
      font-family: var(--bx-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;
      color: var(--bx-text, rgba(255, 255, 255, 0.87)) !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25) !important;
      width: 100% !important;
      max-width: 100% !important;
      clear: both !important;
      transition: opacity 0.3s ease, transform 0.3s ease !important;
      opacity: 1 !important;
      transform: translateY(0) !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
    }

    /* Panel header styling */
    #bitaxe-setter-panel .bx-panel-header {
      background: var(--bx-bg-secondary, #070D17) !important;
      padding: 1.5rem 2rem !important;
      border-bottom: 1px solid var(--bx-border, #2a3441) !important;
      position: relative !important;
      width: 100% !important;
    }

    #bitaxe-setter-panel .bx-panel-title {
      font-size: 1.5rem !important;
      font-weight: 700 !important;
      color: var(--bx-primary, #F7931A) !important;
      margin-bottom: 0.5rem !important;
      letter-spacing: -0.025em !important;
      font-family: var(--bx-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;
      line-height: 1.2 !important;
    }

    #bitaxe-setter-panel .bx-panel-subtitle {
      font-size: 0.875rem !important;
      color: var(--bx-text-secondary, rgba(255, 255, 255, 0.6)) !important;
      font-weight: 500 !important;
      font-family: var(--bx-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;
      line-height: 1.4 !important;
    }

    #bitaxe-setter-panel .bx-toggle-btn {
      position: absolute !important;
      top: 1.5rem !important;
      right: 2rem !important;
      background: var(--bx-primary, #F7931A) !important;
      color: var(--bx-primary-text, #ffffff) !important;
      border: 1px solid var(--bx-primary, #F7931A) !important;
      padding: 0.5rem 1rem !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      font-size: 0.875rem !important;
      font-weight: 600 !important;
      transition: all 0.2s ease !important;
      font-family: var(--bx-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;
      box-sizing: border-box !important;
      line-height: 1 !important;
    }

    #bitaxe-setter-panel .bx-toggle-btn:hover {
      opacity: 0.9 !important;
      transform: translateY(-1px) !important;
    }

    #bitaxe-setter-panel .bx-panel-body {
      display: none !important;
      padding: 2rem !important;
      background: var(--bx-bg-primary, #0B1219) !important;
      box-sizing: border-box !important;
      width: 100% !important;
    }

    #bitaxe-setter-panel .bx-panel-body.expanded {
      display: block !important;
    }

    #bitaxe-setter-panel .bx-sections-grid {
      display: grid !important;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important;
      gap: 1.5rem !important;
      margin-bottom: 2rem !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    #bitaxe-setter-panel .bx-section {
      background: var(--bx-bg-secondary, #070D17) !important;
      border: 1px solid var(--bx-border, #2a3441) !important;
      border-radius: 12px !important;
      padding: 1.5rem !important;
      transition: all 0.2s ease !important;
      box-sizing: border-box !important;
      min-width: 0 !important;
      position: relative !important;
    }

    #bitaxe-setter-panel .bx-section:hover {
      border-color: var(--bx-border-hover, rgba(255,255,255,0.1)) !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
    }

    #bitaxe-setter-panel .bx-section-title {
      font-size: 1rem !important;
      font-weight: 650 !important;
      color: var(--bx-primary, #F7931A) !important;
      margin-bottom: 1.25rem !important;
      display: flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      border-bottom: 1px solid var(--bx-border, #2a3441) !important;
      padding-bottom: 0.75rem !important;
      font-family: var(--bx-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;
      line-height: 1.2 !important;
    }

    #bitaxe-setter-panel .bx-row {
      margin-bottom: 1rem !important;
      box-sizing: border-box !important;
      width: 100% !important;
    }

    #bitaxe-setter-panel .bx-row:last-child {
      margin-bottom: 0 !important;
    }

    #bitaxe-setter-panel .bx-label {
      display: block !important;
      font-size: 0.875rem !important;
      color: var(--bx-text-secondary, rgba(255, 255, 255, 0.6)) !important;
      font-weight: 500 !important;
      margin-bottom: 0.5rem !important;
      font-family: var(--bx-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;
      line-height: 1.4 !important;
    }

    #bitaxe-setter-panel .bx-input,
    #bitaxe-setter-panel .bx-select {
      width: 100% !important;
      padding: 0.75rem 1rem !important;
      background: var(--bx-bg-primary, #0B1219) !important;
      color: var(--bx-text, rgba(255, 255, 255, 0.87)) !important;
      border: 1px solid var(--bx-border, #2a3441) !important;
      border-radius: 8px !important;
      font-size: 0.875rem !important;
      transition: all 0.2s ease !important;
      outline: none !important;
      font-family: var(--bx-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;
      box-sizing: border-box !important;
    }

    #bitaxe-setter-panel .bx-input:focus,
    #bitaxe-setter-panel .bx-select:focus {
      border-color: var(--bx-primary, #F7931A) !important;
      box-shadow: 0 0 0 3px rgba(247, 147, 26, 0.2) !important;
    }

    #bitaxe-setter-panel .bx-input::placeholder {
      color: var(--bx-text-secondary, rgba(255, 255, 255, 0.6)) !important;
      opacity: 0.7 !important;
    }

    #bitaxe-setter-panel .bx-btn {
      background: var(--bx-primary, #F7931A) !important;
      color: var(--bx-primary-text, #ffffff) !important;
      border: 1px solid var(--bx-primary, #F7931A) !important;
      padding: 0.75rem 1.25rem !important;
      border-radius: 8px !important;
      font-size: 0.875rem !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      text-decoration: none !important;
      white-space: nowrap !important;
      box-sizing: border-box !important;
      font-family: var(--bx-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;
      vertical-align: top !important;
      line-height: 1 !important;
    }

    #bitaxe-setter-panel .bx-btn:hover {
      opacity: 0.9 !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 12px rgba(247, 147, 26, 0.3) !important;
    }

    #bitaxe-setter-panel .bx-btn-secondary {
      background: var(--bx-bg-raised, #1A2632) !important;
      color: var(--bx-text, rgba(255, 255, 255, 0.87)) !important;
      border-color: var(--bx-border, #2a3441) !important;
    }

    #bitaxe-setter-panel .bx-btn-secondary:hover {
      background: var(--bx-border-hover, rgba(255,255,255,0.1)) !important;
      border-color: var(--bx-primary, #F7931A) !important;
    }

    #bitaxe-setter-panel .bx-btn-danger {
      background: var(--bx-danger, #f85149) !important;
      border-color: var(--bx-danger, #f85149) !important;
    }

    #bitaxe-setter-panel .bx-btn-danger:hover {
      opacity: 0.9 !important;
      box-shadow: 0 4px 12px rgba(248, 81, 73, 0.3) !important;
    }

    #bitaxe-setter-panel .bx-btn-small {
      padding: 0.5rem 0.75rem !important;
      font-size: 0.75rem !important;
    }

    #bitaxe-setter-panel .bx-btn-group {
      display: flex !important;
      gap: 0.75rem !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      box-sizing: border-box !important;
    }

    #bitaxe-setter-panel .bx-flex-row {
      display: flex !important;
      gap: 1rem !important;
      align-items: flex-end !important;
      flex-wrap: wrap !important;
      box-sizing: border-box !important;
    }

    #bitaxe-setter-panel .bx-flex-row .bx-row {
      flex: 1 !important;
      margin-bottom: 0 !important;
    }

    #bitaxe-setter-panel #bx-device-list {
      background: var(--bx-bg-primary, #0B1219) !important;
      border: 1px solid var(--bx-border, #2a3441) !important;
      border-radius: 8px !important;
      padding: 1rem !important;
      min-height: 3rem !important;
      max-height: 300px !important;
      overflow-y: auto !important;
      box-sizing: border-box !important;
      width: 100% !important;
    }

    #bitaxe-setter-panel .bx-device-item {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding: 0.75rem !important;
      margin-bottom: 0.5rem !important;
      background: var(--bx-bg-secondary, #070D17) !important;
      border: 1px solid var(--bx-border, #2a3441) !important;
      border-radius: 8px !important;
      transition: all 0.2s ease !important;
      box-sizing: border-box !important;
    }

    #bitaxe-setter-panel .bx-device-item:hover {
      background: var(--bx-bg-raised, #1A2632) !important;
      border-color: var(--bx-primary, #F7931A) !important;
      transform: translateX(2px) !important;
    }

    #bitaxe-setter-panel .bx-device-item:last-child {
      margin-bottom: 0 !important;
    }

    #bitaxe-setter-panel .bx-device-info {
      flex: 1 !important;
    }

    #bitaxe-setter-panel .bx-device-url {
      font-weight: 600 !important;
      color: var(--bx-primary, #F7931A) !important;
      margin-bottom: 0.25rem !important;
      font-family: var(--bx-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;
    }

    #bitaxe-setter-panel .bx-worker-input {
      background: var(--bx-bg-primary, #0B1219) !important;
      border: 1px solid var(--bx-border, #2a3441) !important;
      color: var(--bx-text, rgba(255, 255, 255, 0.87)) !important;
      border-radius: 6px !important;
      padding: 0.5rem !important;
      font-size: 0.75rem !important;
      width: 100% !important;
      margin-top: 0.25rem !important;
      font-family: var(--bx-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;
      box-sizing: border-box !important;
    }

    #bitaxe-setter-panel .bx-worker-input:focus {
      border-color: var(--bx-primary, #F7931A) !important;
      box-shadow: 0 0 0 2px rgba(247, 147, 26, 0.2) !important;
      outline: none !important;
    }

    #bitaxe-setter-panel .bx-no-devices {
      text-align: center !important;
      padding: 2rem !important;
      color: var(--bx-text-secondary, rgba(255, 255, 255, 0.6)) !important;
      font-style: italic !important;
      font-family: var(--bx-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif) !important;
    }

    #bitaxe-setter-panel .bx-actions-bar {
      background: var(--bx-bg-secondary, #070D17) !important;
      border-top: 1px solid var(--bx-border, #2a3441) !important;
      padding: 1.5rem 2rem !important;
      display: flex !important;
      gap: 1rem !important;
      align-items: center !important;
      justify-content: space-between !important;
      flex-wrap: wrap !important;
      box-sizing: border-box !important;
    }

    #bitaxe-setter-panel .bx-log {
      background: var(--bx-bg-secondary, #070D17) !important;
      border-top: 1px solid var(--bx-border, #2a3441) !important;
      padding: 1rem 2rem !important;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace !important;
      font-size: 0.8rem !important;
      line-height: 1.6 !important;
      color: var(--bx-text, rgba(255, 255, 255, 0.87)) !important;
      white-space: pre-wrap !important;
      max-height: 200px !important;
      overflow-y: auto !important;
      display: none !important;
      box-sizing: border-box !important;
    }

    #bitaxe-setter-panel .bx-log.visible {
      display: block !important;
    }

    /* Donate button */
    #bx-donate {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--bx-success);
      color: white;
      border: none;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.2s ease;
      z-index: 1000;
    }

    #bx-donate:hover {
      background: color-mix(in srgb, var(--bx-success) 90%, white);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.2);
    }

    /* Donate modal */
    #bx-donate-modal {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    #bx-donate-content {
      width: min(400px, 95vw);
      background: var(--bx-bg-primary);
      border: 1px solid var(--bx-border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 25px 50px rgba(0,0,0,0.25);
    }

    .bx-donate-header {
      background: var(--bx-success);
      color: white;
      text-align: center;
      padding: 1.5rem;
      font-weight: 600;
      font-size: 1.125rem;
    }

    .bx-wallet-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid var(--bx-border);
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 0.875rem;
    }

    .bx-wallet-item:last-child {
      border-bottom: none;
    }

    .bx-wallet-label {
      font-weight: 600;
      color: var(--bx-primary);
      min-width: 3rem;
      margin-right: 1rem;
    }

    .bx-wallet-addr {
      color: var(--bx-text);
      word-break: break-all;
      flex: 1;
      margin-right: 1rem;
      font-size: 0.8rem;
    }

    .bx-copy-btn {
      background: var(--bx-primary);
      border: 1px solid var(--bx-primary);
      color: var(--bx-primary-text);
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 500;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    .bx-copy-btn:hover {
      background: color-mix(in srgb, var(--bx-primary) 90%, white);
    }

    /* Responsive design with specific targeting */
    @media (max-width: 1200px) {
      #bitaxe-setter-panel .bx-sections-grid {
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)) !important;
      }
    }
    
    @media (max-width: 768px) {
      #bitaxe-setter-panel.bitaxe-setter-container {
        margin: 1rem 0 !important;
      }
      
      #bitaxe-setter-panel .bx-sections-grid {
        grid-template-columns: 1fr !important;
        gap: 1rem !important;
      }
      
      #bitaxe-setter-panel .bx-flex-row {
        flex-direction: column !important;
        align-items: stretch !important;
      }
      
      #bitaxe-setter-panel .bx-device-item {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 0.75rem !important;
      }
      
      #bitaxe-setter-panel .bx-btn-group {
        flex-direction: column !important;
        align-items: stretch !important;
      }
      
      #bitaxe-setter-panel .bx-actions-bar {
        flex-direction: column !important;
        align-items: stretch !important;
      }
      
      #bitaxe-setter-panel .bx-panel-header {
        padding: 1rem !important;
      }
      
      #bitaxe-setter-panel .bx-panel-body {
        padding: 1rem !important;
      }
    }
  `); 

  if (!isAxeOSPage()) {
    const btn = document.createElement("div");
    btn.id = "bx-btn";
    btn.textContent = "Bitaxe Setter";
    document.body.appendChild(btn);
    btn.addEventListener("click", openUI);
  }

  const donateBtn = document.createElement("div");
  donateBtn.id = "bx-donate";
  donateBtn.textContent = "💝 Donate";
  document.body.appendChild(donateBtn);

  const panel = document.createElement("div");
  panel.id = "bitaxe-setter-panel";
  panel.className = "bitaxe-setter-container";
  panel.innerHTML = `
    <div class="bx-panel-header">
      <div class="bx-panel-title">⚡ Bitaxe Stratum Configuration</div>
      <div class="bx-panel-subtitle">Configure multiple Bitaxe rigs with automatic device discovery</div>
      <button class="bx-toggle-btn" id="bx-toggle">Configure Rigs</button>
    </div>

    <div class="bx-panel-body" id="bx-panel-body">
      <div class="bx-sections-grid">
        <!-- Device Management Section -->
        <div class="bx-section">
          <div class="bx-section-title">📱 Device Management</div>
          <div class="bx-row">
            <label class="bx-label">Discovered Devices</label>
            <div id="bx-device-list"></div>
          </div>
          <div class="bx-btn-group">
            <button class="bx-btn" id="bx-discover-devices">
              <i>🔍</i> Discover Devices
            </button>
            <button class="bx-btn bx-btn-secondary bx-btn-small" id="bx-reset-devices">Reset</button>
          </div>
        </div>

        <!-- Default Settings Section -->
        <div class="bx-section">
          <div class="bx-section-title">⚙️ Default Settings</div>
          <div class="bx-row">
            <label class="bx-label">Default Wallet Address</label>
            <input class="bx-input" id="bx-default-wallet" placeholder="Enter your default wallet address..." />
          </div>
          <div class="bx-flex-row">
            <div class="bx-row">
              <label class="bx-label">Fallback Pool</label>
              <input class="bx-input" id="bx-default-fallback-url" placeholder="pool.example.com" />
            </div>
            <div class="bx-row" style="flex: 0 0 120px;">
              <label class="bx-label">Port</label>
              <input class="bx-input" id="bx-default-fallback-port" type="number" placeholder="4444" />
            </div>
          </div>
          <div class="bx-btn-group">
            <button class="bx-btn bx-btn-small" id="bx-save-defaults">Save Defaults</button>
            <button class="bx-btn bx-btn-secondary bx-btn-small" id="bx-reset-defaults">Reset</button>
          </div>
        </div>

        <!-- Saved Configurations Section -->
        <div class="bx-section">
          <div class="bx-section-title">💾 Saved Configurations</div>
          <div class="bx-row">
            <label class="bx-label">Load Configuration</label>
            <select class="bx-select" id="bx-config-select">
              <option value="">Select a saved configuration...</option>
            </select>
          </div>
          <div class="bx-btn-group">
            <button class="bx-btn bx-btn-small" id="bx-load-config">Load</button>
            <button class="bx-btn bx-btn-danger bx-btn-small" id="bx-delete-config">Delete</button>
          </div>
          <div class="bx-row">
            <label class="bx-label">Save Current Settings</label>
            <div class="bx-flex-row">
              <input class="bx-input" id="bx-config-name" placeholder="Configuration name..." />
              <button class="bx-btn bx-btn-small" id="bx-save-config" style="flex: 0 0 auto;">Save</button>
            </div>
          </div>
        </div>

        <!-- Pool Settings Section -->
        <div class="bx-section">
          <div class="bx-section-title">🌊 Pool Settings</div>
          <div class="bx-row">
            <label class="bx-label">Mining Pool</label>
            <input class="bx-input" id="bx-pool" placeholder="pool.example.com:4444" />
          </div>
          <div class="bx-row">
            <label class="bx-label">Wallet Address</label>
            <div class="bx-flex-row">
              <input class="bx-input" id="bx-wallet" placeholder="Your wallet address" />
              <button class="bx-btn bx-btn-secondary bx-btn-small" id="bx-load-defaults" style="flex: 0 0 auto;">Use Default</button>
            </div>
          </div>
          <div class="bx-row">
            <label class="bx-label">Password</label>
            <input class="bx-input" id="bx-pass" value="x" placeholder="x or d=1000" />
          </div>
        </div>
      </div>

      <div class="bx-actions-bar">
        <div class="bx-btn-group">
          <button class="bx-btn bx-btn-secondary" id="bx-test">🧪 Test Settings</button>
          <button class="bx-btn" id="bx-apply">🚀 Apply & Restart</button>
        </div>
        <div style="flex: 1;"></div>
        <div class="bx-btn-group">
          <span id="bx-device-count" style="color: var(--bx-text-secondary); font-size: 0.875rem;">0 devices ready</span>
        </div>
      </div>

      <div class="bx-log" id="bx-log"></div>
    </div>
  `;

  let overlay = null;

  if (!isAxeOSPage()) {
    overlay = document.createElement("div");
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
  }

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

  const $ = (sel) => {
    if (panel && panel.isConnected) {
      return panel.querySelector(sel);
    }
    return overlay ? overlay.querySelector(sel) : null;
  };

  function isAxeOSPage() {
    const indicators = [
      () => document.querySelector('app-root'),
      () => window.location.hash.includes('#/'),
      () => document.title.toLowerCase().includes('axeos'),
      () => document.querySelector('svg[aria-label="AxeOS"]'),
      () => document.querySelector('[ng-version]'),
      () => document.querySelector('.layout-wrapper'),
      () => document.querySelector('app-')
    ];
    
    return indicators.some(check => {
      try {
        return check();
      } catch {
        return false;
      }
    });
  }

  function isSwarmPage() {
    return window.location.hash === '#/swarm' && document.querySelector('app-swarm');
  }

  function injectPoolSettingsButton() {
    const targetForm = document.querySelector('app-swarm form.card');
    if (!targetForm || document.getElementById('bx-pool-settings-btn')) {
      return false;
    }

    const poolSettingsBtn = document.createElement('button');
    poolSettingsBtn.id = 'bx-pool-settings-btn';
    poolSettingsBtn.className = 'p-element white-space-nowrap w-full md:w-auto block text-center button-text p-button p-component';
    poolSettingsBtn.innerHTML = '⚙️ Pool Settings';
    poolSettingsBtn.type = 'button';
    
    poolSettingsBtn.style.cssText = `
      background: var(--primary-color, #4caf50) !important;
      border-color: var(--primary-color, #4caf50) !important;
      color: white !important;
      margin-right: 1rem;
      transition: all 0.2s ease !important;
    `;

    const autoScanBtn = targetForm.querySelector('button');
    if (autoScanBtn) {
      autoScanBtn.parentNode.insertBefore(poolSettingsBtn, autoScanBtn.nextSibling);
    } else {
      targetForm.insertBefore(poolSettingsBtn, targetForm.firstChild);
    }

    poolSettingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      togglePoolSettingsPanel(poolSettingsBtn);
    });

    console.log('Bitaxe Setter: Pool Settings button injected successfully');
    return true;
  }

  function togglePoolSettingsPanel(button) {
    const existingPanel = document.getElementById('bitaxe-setter-panel');
    
    if (existingPanel && existingPanel.style.display !== 'none') {
      hidePoolSettingsPanel(button);
    } else {
      showPoolSettingsPanel(button);
    }
  }

  function showPoolSettingsPanel(button) {
    if (!document.getElementById('bitaxe-setter-panel')) {
      injectPanelIntoPage();
    }
    
    const panelElement = panel;
    const panelBody = panel.querySelector('#bx-panel-body');
    const toggleBtn = panel.querySelector('#bx-toggle');
    
    if (panelElement && panelBody) {
      panelElement.style.display = 'block';
      panelBody.classList.add('expanded');
      if (toggleBtn) {
        toggleBtn.textContent = 'Collapse';
      }
      
      loadDevices();
      refreshConfigSelect();
      loadDefaultsUI();
      updateDeviceDisplay();
      updateDeviceCount();
      logLine("Ready! Configure your pool settings and devices.");
      
      button.innerHTML = '✕ Close Pool Settings';
      button.style.background = 'var(--red-500, #ef4444) !important';
      button.style.borderColor = 'var(--red-500, #ef4444) !important';
      
      setTimeout(() => {
        panelElement.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      }, 100);
    }
  }

  function hidePoolSettingsPanel(button) {
    const panelElement = panel;
    const panelBody = panel.querySelector('#bx-panel-body');
    const toggleBtn = panel.querySelector('#bx-toggle');
    
    if (panelElement && panelBody) {
      panelBody.classList.remove('expanded');
      if (toggleBtn) {
        toggleBtn.textContent = 'Configure Rigs';
      }
      
      setTimeout(() => {
        panelElement.style.display = 'none';
      }, 300);
      
      button.innerHTML = '⚙️ Pool Settings';
      button.style.background = 'var(--primary-color, #4caf50) !important';
      button.style.borderColor = 'var(--primary-color, #4caf50) !important';
    }
  }

  function injectPanelIntoPage() {
    if (document.getElementById('bitaxe-setter-panel')) {
      return true; // Already injected
    }
    
    let insertTarget = null;
    
    if (isSwarmPage()) {
      const swarmRoot = document.querySelector('app-swarm');
      if (swarmRoot) {
        insertTarget = swarmRoot;
      }
    }
    
    if (!insertTarget) {
      const targetElements = [
        document.querySelector('.layout-main'),
        document.querySelector('.layout-main-container'),
        document.querySelector('router-outlet'),
        document.querySelector('app-design'),
        document.querySelector('.card'),
        document.querySelector('main'),
        document.querySelector('[role="main"]'),
        document.querySelector('.main-content'),
        document.querySelector('.content')
      ].filter(Boolean);
      
      for (const element of targetElements) {
        if (element && element.offsetHeight > 0) {
          insertTarget = element;
          break;
        }
      }
    }
    
    if (!insertTarget) {
      insertTarget = document.body;
    }
    
    if (insertTarget) {
      panel.style.display = 'none';
      insertTarget.appendChild(panel);
      
      initializePanel();
      return true;
    }
    return false;
  }

  function initializePanel() {
    const toggleBtn = panel.querySelector('#bx-toggle');
    const panelBody = panel.querySelector('#bx-panel-body');
    
    if (toggleBtn && panelBody) {
      toggleBtn.addEventListener('click', () => {
        const isExpanded = panelBody.classList.contains('expanded');
        if (isExpanded) {
          panelBody.classList.remove('expanded');
          toggleBtn.textContent = 'Configure Rigs';
        } else {
          panelBody.classList.add('expanded');
          toggleBtn.textContent = 'Collapse';
          loadDevices();
          refreshConfigSelect();
          loadDefaultsUI();
          updateDeviceDisplay();
          updateDeviceCount();
          logLine("Ready! Configure your pool settings and devices.");
        }
      });
    }
    
    // Initialize all event listeners for the panel
    setupEventListeners();
  }

  function updateDeviceCount() {
    const deviceCount = panel.querySelector('#bx-device-count');
    if (deviceCount) {
      const count = RIGS.length;
      deviceCount.textContent = `${count} device${count !== 1 ? 's' : ''} ready`;
    }
  }

  function getStoredDevices() {
    try {
      return JSON.parse(localStorage.getItem('bitaxe-devices') || '[]');
    } catch {
      return [];
    }
  }

  function saveDevices(devices, skipUIUpdate = false) {
    localStorage.setItem('bitaxe-devices', JSON.stringify(devices));
    RIGS = [...devices];
    if (!skipUIUpdate) {
      updateDeviceDisplay();
      updateSubtitle();
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
    
    const detectedSubnet = detectLocalSubnet();
    logLine(`   Detected subnet: ${detectedSubnet}x`);
    logLine(`   Scanning network for Bitaxe devices...`);
    
    await scanNetworkRange(detectedSubnet);
  }
  
  async function scanNetworkRange(baseIp) {
    if (!baseIp) {
      baseIp = detectLocalSubnet();
    }
    
    const devices = [];
    let found = 0;
    
    logLine(`   Scanning ${baseIp}1-254...`);
    
    const promises = [];
    for (let i = 1; i <= 254; i++) {
      const ip = `${baseIp}${i}`;
      promises.push(testDevice(ip));
    }
    
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        found++;
        const ip = `${baseIp}${index + 1}`;
        const hostname = result.value;
        
        devices.push({
          url: `http://${ip}`,
          worker: hostname
        });
        logLine(`   Found device at ${ip} (${hostname})`);
      }
    });
    
    if (devices.length > 0) {
      logLine(`✅ Network scan found ${devices.length} device(s)`);
      saveDevices(devices);
    } else {
      logLine(`❌ Network scan found no devices`);
      logLine(`   Using default configuration`);
      const userDefaults = getUserDefaults();
      RIGS = userDefaults.defaultRigs;
      updateDeviceDisplay();
    }
  }
  
  async function testDevice(ip) {
    try {
      const response = await fetch(`http://${ip}/api/system/info`, {
        method: 'GET',
        timeout: 2000,
        signal: AbortSignal.timeout(2000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const isBitaxe = data.ASICModel || data.model || data.boardVersion || 
                         JSON.stringify(data).toLowerCase().includes('bitaxe');
        
        if (isBitaxe) {
          const hostname = data.hostname || data.deviceName || data.name || 
                          data.ssid || `bitaxe-${ip.split('.').pop()}`;
          return hostname;
        }
      }
    } catch {
    }
    return null;
  }
  
  function updateDeviceDisplay() {
    const deviceList = panel.querySelector('#bx-device-list') || (overlay && overlay.querySelector('#bx-device-list'));
    if (!deviceList) return;
    
    if (RIGS.length === 0) {
      deviceList.innerHTML = '<div class="bx-no-devices">No devices discovered yet. Click "Discover Devices" to scan your network.</div>';
      updateDeviceCount();
      return;
    }
    
    deviceList.innerHTML = RIGS.map((rig, index) => `
      <div class="bx-device-item">
        <div class="bx-device-info">
          <div class="bx-device-url">${rig.url.replace('http://', '')}</div>
          <div class="bx-device-worker">
            <input 
              type="text" 
              class="bx-input bx-worker-input" 
              data-index="${index}" 
              value="${rig.worker}" 
              placeholder="Worker name"
            />
          </div>
        </div>
        <button class="bx-btn bx-btn-danger bx-btn-small bx-remove-device" data-index="${index}" title="Remove device">✕</button>
      </div>
    `).join('');
    
    attachDeviceListeners();
    updateDeviceCount();
  }
  
  function updateSubtitle() {
    const subtitle = overlay && overlay.querySelector('#bx-subtitle');
    if (subtitle && RIGS.length > 0) {
      subtitle.textContent = `Applies to: ${RIGS.map(r => r.url.replace('http://', '')).join(', ')}`;
    } else if (subtitle) {
      subtitle.textContent = 'No devices configured';
    }
  }
  
  function attachDeviceListeners() {
    const deviceList = panel.querySelector('#bx-device-list') || (overlay && overlay.querySelector('#bx-device-list'));
    if (!deviceList) return;
    
    const oldClickListener = deviceList._removeDeviceListener;
    const oldInputListener = deviceList._workerInputListener;
    const oldBlurListener = deviceList._workerBlurListener;
    
    if (oldClickListener) {
      deviceList.removeEventListener('click', oldClickListener);
    }
    if (oldInputListener) {
      deviceList.removeEventListener('input', oldInputListener);
    }
    if (oldBlurListener) {
      deviceList.removeEventListener('blur', oldBlurListener, true);
    }
    
    const newClickListener = (e) => {
      if (e.target.classList.contains('bx-remove-device')) {
        const index = parseInt(e.target.getAttribute('data-index'), 10);
        if (!isNaN(index)) {
          removeDevice(index);
        }
      }
    };
    
    const newInputListener = (e) => {
      if (e.target.classList.contains('bx-worker-input')) {
        const index = parseInt(e.target.getAttribute('data-index'), 10);
        const newWorkerName = e.target.value;
        
        if (!isNaN(index) && typeof newWorkerName === 'string') {
          RIGS[index].worker = newWorkerName;
        }
      }
    };
    
    const newBlurListener = (e) => {
      if (e.target.classList.contains('bx-worker-input')) {
        const index = parseInt(e.target.getAttribute('data-index'), 10);
        const newWorkerName = e.target.value.trim();
        
        if (!isNaN(index) && newWorkerName) {
          RIGS[index].worker = newWorkerName;
          saveDevices(RIGS, true);
          logLine(`✏️ Updated worker name for ${RIGS[index].url} to: ${newWorkerName}`);
        }
      }
    };
    
    deviceList._removeDeviceListener = newClickListener;
    deviceList._workerInputListener = newInputListener;
    deviceList._workerBlurListener = newBlurListener;
    
    deviceList.addEventListener('click', newClickListener);
    deviceList.addEventListener('input', newInputListener);
    deviceList.addEventListener('blur', newBlurListener, true);
  }
  
  function removeDevice(index) {
    if (index >= 0 && index < RIGS.length) {
      const removed = RIGS[index];
      RIGS.splice(index, 1);
      saveDevices(RIGS);
      logLine(`🗑️ Removed device: ${removed.url} (${removed.worker})`);
    }
  }

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
    if (!select) return;
    
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
    const poolEl = $("#bx-pool");
    const walletEl = $("#bx-wallet");
    const passEl = $("#bx-pass");
    
    return {
      pool: poolEl ? poolEl.value.trim() : "",
      wallet: walletEl ? walletEl.value.trim() : "",
      password: passEl ? passEl.value.trim() : "x"
    };
  }

  function loadConfigData(config) {
    const poolEl = $("#bx-pool");
    const walletEl = $("#bx-wallet");
    const passEl = $("#bx-pass");
    
    if (poolEl) poolEl.value = config.pool || "";
    if (walletEl) walletEl.value = config.wallet || "";
    if (passEl) passEl.value = config.password || "x";
  }

  function setupEventListeners() {
    // Save config
    const saveConfigBtn = $("#bx-save-config");
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener("click", () => {
        const configNameEl = $("#bx-config-name");
        if (!configNameEl) return;
        
        const name = configNameEl.value.trim();
        if (!name) return logLine("❌ Please enter a config name.");
        
        const config = getCurrentConfig();
        if (!config.pool || !config.wallet) {
          return logLine("❌ Please fill in pool and wallet before saving.");
        }
        
        saveConfig(name, config);
        configNameEl.value = "";
        logLine(`✅ Config "${name}" saved successfully.`);
      });
    }

    // Load config
    const loadConfigBtn = $("#bx-load-config");
    if (loadConfigBtn) {
      loadConfigBtn.addEventListener("click", () => {
        const configSelectEl = $("#bx-config-select");
        if (!configSelectEl) return;
        
        const name = configSelectEl.value;
        if (!name) return logLine("❌ Please select a config to load.");
        
        const configs = getConfigs();
        const config = configs[name];
        if (!config) return logLine("❌ Config not found.");
        
        loadConfigData(config);
        logLine(`✅ Config "${name}" loaded successfully.`);
      });
    }

    // Delete config
    const deleteConfigBtn = $("#bx-delete-config");
    if (deleteConfigBtn) {
      deleteConfigBtn.addEventListener("click", () => {
        const configSelectEl = $("#bx-config-select");
        if (!configSelectEl) return;
        
        const name = configSelectEl.value;
        if (!name) return logLine("❌ Please select a config to delete.");
        
        if (!confirm(`Delete config "${name}"? This cannot be undone.`)) return;
        
        deleteConfig(name);
        logLine(`✅ Config "${name}" deleted successfully.`);
      });
    }

    // Config select double-click
    const configSelect = $("#bx-config-select");
    if (configSelect) {
      configSelect.addEventListener("dblclick", () => {
        loadConfigBtn?.click();
      });
    }

    // Discover devices
    const discoverBtn = $("#bx-discover-devices");
    if (discoverBtn) {
      discoverBtn.addEventListener("click", async () => {
        discoverBtn.innerHTML = "🔍 Discovering...";
        discoverBtn.disabled = true;
        
        await discoverDevices();
        
        discoverBtn.innerHTML = "🔍 Discover Devices";
        discoverBtn.disabled = false;
      });
    }

    // Reset devices
    const resetDevicesBtn = $("#bx-reset-devices");
    if (resetDevicesBtn) {
      resetDevicesBtn.addEventListener("click", () => {
        if (confirm('Reset to default devices? This will replace your discovered devices.')) {
          const userDefaults = getUserDefaults();
          saveDevices(userDefaults.defaultRigs);
          logLine('🔄 Reset to default devices');
        }
      });
    }

    // Save defaults
    const saveDefaultsBtn = $("#bx-save-defaults");
    if (saveDefaultsBtn) {
      saveDefaultsBtn.addEventListener("click", () => {
        const defaultWalletEl = $("#bx-default-wallet");
        const fallbackURLEl = $("#bx-default-fallback-url");
        const fallbackPortEl = $("#bx-default-fallback-port");
        
        if (!defaultWalletEl || !fallbackURLEl || !fallbackPortEl) return;
        
        const defaultWallet = defaultWalletEl.value.trim();
        const fallbackURL = fallbackURLEl.value.trim();
        const fallbackPort = parseInt(fallbackPortEl.value) || 42069;
        
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
    }
    
    // Reset defaults
    const resetDefaultsBtn = $("#bx-reset-defaults");
    if (resetDefaultsBtn) {
      resetDefaultsBtn.addEventListener("click", () => {
        if (confirm('Reset all defaults to factory settings? This cannot be undone.')) {
          localStorage.removeItem('bitaxe-user-defaults');
          loadDefaultsUI();
          logLine('🔄 Reset to factory defaults');
        }
      });
    }

    // Load defaults
    const loadDefaultsBtn = $("#bx-load-defaults");
    if (loadDefaultsBtn) {
      loadDefaultsBtn.addEventListener("click", () => {
        const walletEl = $("#bx-wallet");
        if (!walletEl) return;
        
        const userDefaults = getUserDefaults();
        if (userDefaults.defaultWallet) {
          walletEl.value = userDefaults.defaultWallet;
          logLine(`✅ Loaded default wallet: ${userDefaults.defaultWallet}`);
        } else {
          logLine("ℹ️ No default wallet configured. Set one in Default Settings.");
        }
      });
    }

    // Test settings
    const testBtn = $("#bx-test");
    if (testBtn) {
      testBtn.addEventListener("click", () => {
        clearLog();

        const poolEl = $("#bx-pool");
        const walletEl = $("#bx-wallet");
        const passEl = $("#bx-pass");
        
        if (!poolEl || !walletEl || !passEl) return;

        const poolPort = parsePoolPort(poolEl.value);
        const wallet = walletEl.value.trim();
        const pass = (passEl.value || "x").trim() || "x";

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
    }

    // Apply settings
    const applyBtn = $("#bx-apply");
    if (applyBtn) {
      applyBtn.addEventListener("click", async () => {
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
    }
  }

  function openUI() {
    if (isAxeOSPage() && injectPanelIntoPage()) {
      const panelBody = panel.querySelector('#bx-panel-body');
      if (panelBody && !panelBody.classList.contains('expanded')) {
        panel.querySelector('#bx-toggle')?.click();
      }
      return;
    }

    if (!overlay) return;
    overlay.style.display = "flex";
    refreshConfigSelect();
    loadDevices();
    loadDefaultsUI();
    updateDeviceDisplay();
    updateSubtitle();
    
    // Setup event listeners for overlay mode
    setupEventListenersOverlay();
    
    $("#bx-pool")?.focus();
    logLine("Ready! Enter pool:port + wallet, or load a saved config.");
    logLine("Workers auto-set as {wallet}.{hostname} using device's actual hostname.");
    logLine("Tip: Click 'Discover Devices' to scan for Bitaxe rigs automatically.");
    logLine("Tip: Configure your defaults in the 'Default Settings' section.");
  }

  function setupEventListenersOverlay() {
    // Only setup if not already done
    if (overlay._eventListenersSetup) return;
    overlay._eventListenersSetup = true;
    
    setupEventListeners(); // Reuse the same event listener setup
  }

  function closeUI() {
    if (overlay) overlay.style.display = "none";
    
    const panelBody = panel.querySelector('#bx-panel-body');
    const toggleBtn = panel.querySelector('#bx-toggle');
    if (panelBody?.classList.contains('expanded')) {
      panelBody.classList.remove('expanded');
      if (toggleBtn) toggleBtn.textContent = 'Configure Rigs';
    }
  }

  function logLine(msg) {
    const log = $("#bx-log");
    if (!log) return;
    
    const ts = new Date().toLocaleTimeString();
    log.textContent += `[${ts}] ${msg}\n`;
    log.scrollTop = log.scrollHeight;
    
    if (!log.classList.contains('visible') && log.textContent.trim()) {
      log.classList.add('visible');
    }
  }
  
  function clearLog() { 
    const log = $("#bx-log");
    if (log) {
      log.textContent = "";
      log.classList.remove('visible');
    }
  }

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
    const defaultFallbackUrlEl = $("#bx-default-fallback-url");
    const defaultFallbackPortEl = $("#bx-default-fallback-port");
    
    if (defaultWalletEl) defaultWalletEl.value = userDefaults.defaultWallet;
    if (defaultFallbackUrlEl) defaultFallbackUrlEl.value = userDefaults.fallbackStratumURL;
    if (defaultFallbackPortEl) defaultFallbackPortEl.value = userDefaults.fallbackStratumPort;
  }

  loadDevices();

  // Global event listeners (always active)
  if (overlay) {
    overlay.querySelector("#bx-close")?.addEventListener("click", closeUI);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeUI(); });
  }
  
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (overlay && overlay.style.display === "flex") closeUI();
      if (donateModal.style.display === "flex") donateModal.style.display = "none";
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

  function attemptInjection() {
    if (isAxeOSPage()) {
      if (isSwarmPage() && !document.getElementById('bx-pool-settings-btn')) {
        const buttonInjected = injectPoolSettingsButton();
        if (buttonInjected) {
          console.log('Bitaxe Setter: Pool Settings button injected successfully');
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(attemptInjection, 1000);
    });
  } else {
    setTimeout(attemptInjection, 1000);
  }

  if (isAxeOSPage()) {
    let currentPath = window.location.hash;
    const routeWatcher = setInterval(() => {
      if (window.location.hash !== currentPath) {
        currentPath = window.location.hash;
        console.log('Bitaxe Setter: Route change detected, re-injecting components');
        setTimeout(attemptInjection, 500);
      }
    }, 1000);

    const observer = new MutationObserver(() => {
      if (isSwarmPage() && !document.getElementById('bx-pool-settings-btn')) {
        setTimeout(attemptInjection, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();
