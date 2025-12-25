/**
 * ═══════════════════════════════════════════════════════════════
 * Dashboard Component Loader
 * Dynamically loads HTML components into the dashboard shell
 * ═══════════════════════════════════════════════════════════════
 */

const ComponentLoader = {
  cache: new Map(),
  
  /**
   * Load a component from HTML file
   * @param {string} componentPath - Path to the component HTML file
   * @param {string} containerId - ID of the container element
   * @returns {Promise<void>}
   */
  async load(componentPath, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`Container #${containerId} not found`);
      return;
    }
    
    try {
      // Check cache first
      if (this.cache.has(componentPath)) {
        container.innerHTML = this.cache.get(componentPath);
        return;
      }
      
      const response = await fetch(componentPath);
      if (!response.ok) {
        throw new Error(`Failed to load component: ${componentPath}`);
      }
      
      const html = await response.text();
      this.cache.set(componentPath, html);
      container.innerHTML = html;
      
    } catch (error) {
      console.error(`Error loading component ${componentPath}:`, error);
      container.innerHTML = `<div class="text-red-500 text-center py-4">خطا در بارگذاری</div>`;
    }
  },
  
  /**
   * Load multiple components in parallel
   * @param {Array<{path: string, container: string}>} components
   * @returns {Promise<void>}
   */
  async loadAll(components) {
    await Promise.all(
      components.map(({ path, container }) => this.load(path, container))
    );
  },
  
  /**
   * Clear component cache
   */
  clearCache() {
    this.cache.clear();
  }
};

/**
 * Modal Manager - Handles modal show/hide operations
 */
const ModalManager = {
  activeModals: [],
  
  /**
   * Show a modal by ID
   * @param {string} modalId
   */
  show(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    this.activeModals.push(modalId);
    
    // Add escape key listener
    this.setupEscapeListener();
  },
  
  /**
   * Hide a modal by ID
   * @param {string} modalId
   */
  hide(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('active');
    this.activeModals = this.activeModals.filter(id => id !== modalId);
    
    if (this.activeModals.length === 0) {
      document.body.style.overflow = '';
    }
  },
  
  /**
   * Hide all active modals
   */
  hideAll() {
    this.activeModals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('active');
    });
    this.activeModals = [];
    document.body.style.overflow = '';
  },
  
  /**
   * Setup escape key listener
   */
  setupEscapeListener() {
    if (this._escapeListenerAdded) return;
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModals.length > 0) {
        const lastModal = this.activeModals[this.activeModals.length - 1];
        this.hide(lastModal);
      }
    });
    
    this._escapeListenerAdded = true;
  }
};

/**
 * Toast Notification System
 */
const Toast = {
  container: null,
  
  /**
   * Initialize toast container
   */
  init() {
    this.container = document.getElementById('toastContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toastContainer';
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  
  /**
   * Show a toast notification
   * @param {string} message
   * @param {string} type - 'success' | 'error' | 'info' | 'warning'
   * @param {number} duration - Duration in ms
   */
  show(message, type = 'info', duration = 3000) {
    if (!this.container) this.init();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: '✓',
      error: '✗',
      info: 'ℹ',
      warning: '⚠'
    };
    
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
    `;
    
    this.container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // Auto remove
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  
  success(message, duration) {
    this.show(message, 'success', duration);
  },
  
  error(message, duration) {
    this.show(message, 'error', duration);
  },
  
  info(message, duration) {
    this.show(message, 'info', duration);
  },
  
  warning(message, duration) {
    this.show(message, 'warning', duration);
  }
};

// Export to global scope
window.ComponentLoader = ComponentLoader;
window.ModalManager = ModalManager;
window.Toast = Toast;
