// ============================================================
// config.js - Configuración de Firebase (PROTEGIDA)
// ============================================================

(function() {
    'use strict';
    
    // Las claves están codificadas en Base64
    const CONFIG = {
        apiKey: atob("QUl6YVN5RFd5ZFlPb0RfOEdjZGotbDBIeFU4aW0wTWs4cUtwblE="),
        authDomain: atob("Y29tbXVuaWNhdGlvbi1zeXN0ZW0tZDY1NzguZmlyZWJhc2VhcHAuY29t"),
        projectId: atob("Y29tbXVuaWNhdGlvbi1zeXN0ZW0tZDY1Nzg="),
        storageBucket: atob("Y29tbXVuaWNhdGlvbi1zeXN0ZW0tZDY1NzguZmlyZWJhc3RvcmFnZS5hcHA="),
        messagingSenderId: atob("MTAwNTY4Njg2Nzg="),
        appId: atob("MToxMDA1Njg2ODY3ODp3ZWI6Y2E3MjgyMjIwNDUxM2NmZDk1MTMyNw==")
    };
    
    window.FIREBASE_CONFIG = CONFIG;
    
    console.log('✅ Configuración de Firebase cargada correctamente');
    console.log('📌 Proyecto:', CONFIG.projectId);
    
})();