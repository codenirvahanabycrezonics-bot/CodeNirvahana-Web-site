console.log('🔥 firebase-config.js is LOADING...');

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDda1Uus0DBr89upJth5BaoiMT-Vvv3Kaw",
    authDomain: "codenirvahanawebsite.firebaseapp.com",
    projectId: "codenirvahanawebsite",
    storageBucket: "codenirvahanawebsite.firebasestorage.app",
    messagingSenderId: "51117390754",
    appId: "1:51117390754:web:937149594acd9a768610fb",
    measurementId: "G-9BEX4QBGGS"
};

// Initialize Firebase
function initializeFirebase() {
    console.log('Checking if Firebase is available...');
    
    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined' || !firebase.apps) {
        console.log('Firebase SDK not loaded yet, will retry...');
        setTimeout(initializeFirebase, 100);
        return;
    }
    
    try {
        // Check if Firebase is already initialized
        if (!firebase.apps.length) {
            console.log('Initializing Firebase...');
            const app = firebase.initializeApp(firebaseConfig);
            
            // Initialize services - FIREBASE v8 ONLY
            const firebaseDb = firebase.firestore();
            const firebaseAuth = firebase.auth();
            const firebaseStorage = firebase.storage();
            
            // Make available globally
            window.firebaseDb = firebaseDb;
            window.firebaseAuth = firebaseAuth;
            window.firebaseStorage = firebaseStorage;
            
            console.log('✅ Firebase initialized successfully');
            
            // Set the flag to indicate Firebase is ready
            window.firebaseInitialized = true;
            
            // Dispatch event for other scripts
            const event = new Event('firebaseInitialized');
            document.dispatchEvent(event);
            
            // Enable Firestore offline persistence (optional)
            firebaseDb.enablePersistence()
                .catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                    } else if (err.code === 'unimplemented') {
                        console.log('The current browser doesn\'t support persistence.');
                    }
                });
        } else {
            console.log('Firebase already initialized');
            
            // Still make services available if already initialized
            if (!window.firebaseDb) {
                window.firebaseDb = firebase.firestore();
                window.firebaseAuth = firebase.auth();
                window.firebaseStorage = firebase.storage();
            }
            
            // Set the flag
            window.firebaseInitialized = true;
            
            // Dispatch event
            const event = new Event('firebaseInitialized');
            document.dispatchEvent(event);
        }
    } catch (error) {
        console.error('Error initializing Firebase:', error);
    }
}

// Start initialization immediately
initializeFirebase();

// Also check after a short delay to ensure everything is ready
setTimeout(() => {
    if (!window.firebaseInitialized) {
        console.log('Firebase initialization check after timeout...');
        initializeFirebase();
    }
}, 500);

// Debug function to check Firebase status
window.getFirebaseStatus = function() {
    return {
        firebaseLoaded: typeof firebase !== 'undefined',
        firebaseInitialized: firebase && firebase.apps && firebase.apps.length > 0,
        firebaseDb: !!window.firebaseDb,
        firebaseAuth: !!window.firebaseAuth,
        firebaseStorage: !!window.firebaseStorage,
        windowFirebaseInitialized: !!window.firebaseInitialized
    };
};

// Log status after 2 seconds for debugging
setTimeout(() => {
    console.log('🔄 Firebase status check:');
    try {
        const status = window.getFirebaseStatus();
        console.log('Firebase loaded:', status.firebaseLoaded);
        console.log('Firebase initialized:', status.firebaseInitialized);
        console.log('Firestore available:', status.firebaseDb);
        console.log('Auth available:', status.firebaseAuth);
        console.log('Storage available:', status.firebaseStorage);
        console.log('window.firebaseInitialized:', status.windowFirebaseInitialized);
    } catch (error) {
        console.error('Error checking Firebase status:', error);
    }
}, 2000);

// Global admin state management
window.adminState = {
    isAdmin: false,
    user: null,
    initialized: false,
    listeners: []
};

// Global admin check function (consistent across all pages)
window.checkAdminStatus = async function(uid) {
    console.log('🔐 Global admin check for UID:', uid);
    
    if (!uid || !window.firebaseDb) {
        console.log('No UID or Firebase not ready');
        return false;
    }
    
    try {
        // FIREBASE v8 SYNTAX ONLY
        const adminDoc = await window.firebaseDb
            .collection('admins')
            .doc(uid)
            .get();
        
        console.log('Admin document exists:', adminDoc.exists);
        
        if (adminDoc.exists) {
            const isAdmin = adminDoc.data()?.isAdmin === true;
            console.log('Admin status from Firestore:', isAdmin);
            return isAdmin;
        } else {
            console.log('No admin document found for UID:', uid);
            
            // Check if this is first user (auto-create admin for demo)
            const allAdmins = await window.firebaseDb.collection('admins').get();
            if (allAdmins.size === 0) {
                console.log('First user detected, auto-creating admin...');
                
                const currentUser = window.firebaseAuth?.currentUser;
                if (currentUser && currentUser.uid === uid) {
                    await window.firebaseDb.collection('admins').doc(uid).set({
                        isAdmin: true,
                        email: currentUser.email,
                        name: currentUser.displayName || 'Administrator',
                        createdAt: new Date().toISOString(),
                        autoCreated: true
                    });
                    
                    console.log('✅ Auto-created admin document');
                    return true;
                }
            }
            
            return false;
        }
    } catch (error) {
        console.error('❌ Error checking admin status:', error);
        return false;
    }
};

// Global admin state update function
window.updateAdminState = function(isAdmin, user) {
    console.log('🔄 Updating global admin state:', { isAdmin, user: user?.email });
    
    window.adminState.isAdmin = isAdmin;
    window.adminState.user = user;
    window.adminState.initialized = true;
    
    // Notify all listeners
    window.adminState.listeners.forEach(listener => {
        try {
            listener(isAdmin, user);
        } catch (error) {
            console.error('Error in admin state listener:', error);
        }
    });
};

// Add admin state listener
window.addAdminStateListener = function(callback) {
    if (typeof callback === 'function') {
        window.adminState.listeners.push(callback);
        
        // Immediately call with current state if initialized
        if (window.adminState.initialized) {
            setTimeout(() => callback(window.adminState.isAdmin, window.adminState.user), 0);
        }
    }
};

// Remove admin state listener
window.removeAdminStateListener = function(callback) {
    const index = window.adminState.listeners.indexOf(callback);
    if (index > -1) {
        window.adminState.listeners.splice(index, 1);
    }
};

// Initialize global auth listener (runs once when Firebase is ready)
window.initializeGlobalAuthListener = function() {
    if (!window.firebaseAuth || window.adminState.authListenerInitialized) {
        return;
    }
    
    console.log('🌍 Initializing global auth listener...');
    
    window.firebaseAuth.onAuthStateChanged(async (user) => {
        console.log('🌍 Global auth state changed:', user ? user.email : 'No user');
        
        if (user) {
            const isAdmin = await window.checkAdminStatus(user.uid);
            window.updateAdminState(isAdmin, user);
        } else {
            window.updateAdminState(false, null);
        }
    });
    
    window.adminState.authListenerInitialized = true;
    
    // Check immediately if user is already logged in
    const currentUser = window.firebaseAuth.currentUser;
    if (currentUser) {
        console.log('🌍 Current user exists, checking admin status immediately...');
        setTimeout(async () => {
            const isAdmin = await window.checkAdminStatus(currentUser.uid);
            window.updateAdminState(isAdmin, currentUser);
        }, 100);
    }
};

// Run global auth listener when Firebase is ready
document.addEventListener('firebaseInitialized', function() {
    console.log('🌍 Firebase initialized, setting up global auth listener...');
    setTimeout(window.initializeGlobalAuthListener, 100);
});