// =============================================
// CPMR Library - Environment Configuration
// This file auto-detects the environment
// =============================================

(function() {
    // Get current hostname
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const pathname = window.location.pathname;
    
    // Determine base path based on environment
    let baseUrl;
    let apiBase;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Local development (XAMPP)
        baseUrl = protocol + '//' + hostname + '/cpmr_library/';
        apiBase = '/cpmr_library/backend/api';
    } else {
        // Production (InfinityFree or any hosting)
        // Use relative path from current location
        baseUrl = pathname.endsWith('/') ? pathname : pathname + '/';
        apiBase = pathname.replace(/\/$/, '') + '/backend/api';
    }
    
    // Store configuration globally
    window.APP_CONFIG = {
        baseUrl: baseUrl,
        apiBase: apiBase,
        isProduction: hostname !== 'localhost' && hostname !== '127.0.0.1',
        hostname: hostname
    };
    
    console.log('Environment detected:', window.APP_CONFIG);
})();
