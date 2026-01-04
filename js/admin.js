// Admin Page JavaScript - Firebase ONLY
// UI / UX LOGIC PRESERVED
// FIXED: Correct admin UID usage + reliable admin propagation

document.addEventListener('DOMContentLoaded', function () {
    console.log('Admin page DOM loaded');

    waitForFirebase()
        .then(() => {
            console.log('Firebase is ready, initializing admin page...');
            initializeAdminPage();
        })
        .catch(error => {
            console.error('Failed to initialize Firebase:', error);
            showToast('Firebase initialization failed. Please refresh.', 'error');
        });
});

// Wait for Firebase
function waitForFirebase() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;

        function check() {
            attempts++;

            if (
                typeof firebase !== 'undefined' &&
                firebase.apps &&
                firebase.apps.length > 0 &&
                window.firebaseAuth &&
                window.firebaseDb
            ) {
                resolve();
                return;
            }

            if (attempts >= maxAttempts) {
                reject(new Error('Firebase init timeout'));
                return;
            }

            setTimeout(check, 100);
        }

        check();
    });
}

// Initialize Admin Page
function initializeAdminPage() {
    initAdminPage();
    initMobileMenu();
    initFirebaseAuth(window.firebaseAuth, window.firebaseDb);
    refreshStats(window.firebaseDb);
    setupAdminSessionFlag();
}

// Mobile menu
function initMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const nav = document.getElementById('navLinks');

    if (!btn || !nav) return;

    btn.addEventListener('click', () => {
        nav.classList.toggle('active');
    });
}

// Footer year
function initAdminPage() {
    const year = document.getElementById('currentYear');
    if (year) year.textContent = new Date().getFullYear();
}

// 🔐 ADMIN SESSION FLAG (FOR OTHER PAGES)
function setupAdminSessionFlag() {
    window.firebaseAuth.onAuthStateChanged(async (user) => {
        if (!user) {
            clearAdminSession();
            return;
        }

        const isAdmin = await checkUserIsAdmin(user.uid);

        sessionStorage.setItem('adminChecked', 'true');
        sessionStorage.setItem('isAdmin', isAdmin.toString());
        sessionStorage.setItem('adminUid', user.uid);
        sessionStorage.setItem('adminEmail', user.email);

        console.log('Admin session updated:', isAdmin);
    });
}

function clearAdminSession() {
    sessionStorage.removeItem('adminChecked');
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('adminUid');
    sessionStorage.removeItem('adminEmail');
}

// 🔐 REAL ADMIN CHECK (FIRESTORE)
async function checkUserIsAdmin(uid) {
    if (!uid || !window.firebaseDb) return false;

    try {
        const doc = await window.firebaseDb
            .collection('admins')
            .doc(uid)
            .get();

        return doc.exists && doc.data()?.isAdmin === true;
    } catch (error) {
        console.error('Admin check failed:', error);
        return false;
    }
}

// Firebase Auth
function initFirebaseAuth(auth, db) {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            updateAuthUI(false);
            window.isAdmin = false;
            clearAdminSession();
            return;
        }

        updateAuthUI(true, user.email);

        const isAdmin = await checkUserIsAdmin(user.uid);
        window.isAdmin = isAdmin;

        console.log('Admin status confirmed:', isAdmin);
    });

    initLoginForm(auth);
    initLogoutButton(auth);
}

// Login
function initLoginForm(auth) {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!email || !password) {
            showToast('Email and password required', 'error');
            return;
        }

        try {
            await auth.setPersistence(
                rememberMe
                    ? firebase.auth.Auth.Persistence.LOCAL
                    : firebase.auth.Auth.Persistence.SESSION
            );

            await auth.signInWithEmailAndPassword(email, password);
            showToast('Logged in successfully', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// Logout
function initLogoutButton(auth) {
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        await auth.signOut();
        window.isAdmin = false;
        clearAdminSession();
        showToast('Logged out', 'success');
    });
}

// UI state (UNCHANGED)
function updateAuthUI(isLoggedIn, email = '') {
    const loginCard = document.getElementById('loginCard');
    const dashboardCard = document.getElementById('dashboardCard');
    const badge = document.querySelector('.status-badge span');

    if (isLoggedIn) {
        loginCard?.classList.add('hidden');
        dashboardCard?.classList.remove('hidden');
        if (badge) badge.textContent = `Logged in as ${email}`;
    } else {
        loginCard?.classList.remove('hidden');
        dashboardCard?.classList.add('hidden');
    }
}

// Stats
async function refreshStats(db) {
    if (!db) return;

    const coursesSnap = await db.collection('courses').get();
    document.getElementById('coursesCount').textContent = coursesSnap.size;
}

// Toast
function showToast(message, type = 'info') {
    const toast = document.getElementById('messageToast');
    const text = document.getElementById('toastMessage');
    if (!toast || !text) return;

    text.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 4000);
}

// Global SAFE access
window.CodeNirvahana = window.CodeNirvahana || {};
window.CodeNirvahana.admin = {
    isAdmin: () => window.isAdmin === true,
    showToast,
    refreshStats
};
