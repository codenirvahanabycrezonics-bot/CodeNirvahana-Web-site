// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check Firebase initialization
    if (!firebase.apps.length) {
        console.error('Firebase not initialized. Make sure firebase-config.js is loaded.');
    }
    
    // Initialize all components
    initMobileMenu();
    initScrollAnimations();
    initAuthModal();
    initCurrentYear();
    initNavbarScroll();
    initSmoothScroll();
});

// Mobile menu toggle
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('navLinks');
    
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', function() {
            navLinks.classList.toggle('active');
            const icon = mobileMenuBtn.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!mobileMenuBtn.contains(event.target) && !navLinks.contains(event.target)) {
                navLinks.classList.remove('active');
                const icon = mobileMenuBtn.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }
}

// Scroll animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
            }
        });
    }, observerOptions);
    
    // Observe all cards and sections
    document.querySelectorAll('.teaching-card, .advantage-card, .method-step').forEach(el => {
        observer.observe(el);
    });
}

// Auth modal
function initAuthModal() {
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const cancelAuthModal = document.getElementById('cancelAuthModal');
    
    if (closeAuthModal) {
        closeAuthModal.addEventListener('click', function() {
            authModal.classList.remove('active');
        });
    }
    
    if (cancelAuthModal) {
        cancelAuthModal.addEventListener('click', function() {
            authModal.classList.remove('active');
        });
    }
    
    // Close modal on outside click
    if (authModal) {
        authModal.addEventListener('click', function(event) {
            if (event.target === authModal) {
                authModal.classList.remove('active');
            }
        });
    }
    
    // Global function to show auth modal
    window.showAuthModal = function() {
        if (authModal) authModal.classList.add('active');
    };
}

// Set current year in footer
function initCurrentYear() {
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

// Navbar scroll effect
function initNavbarScroll() {
    let lastScrollTop = 0;
    const navbar = document.querySelector('.navbar');
    
    if (!navbar) return;
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 100) {
            navbar.style.backgroundColor = 'rgba(15, 23, 42, 0.98)';
            navbar.style.backdropFilter = 'blur(10px)';
        } else {
            navbar.style.backgroundColor = 'rgba(15, 23, 42, 0.95)';
            navbar.style.backdropFilter = 'blur(10px)';
        }
        
        lastScrollTop = scrollTop;
    });
}

// Smooth scroll for anchor links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            // Only handle internal anchor links
            if (href === '#') return;
            
            const targetElement = document.querySelector(href);
            if (targetElement) {
                e.preventDefault();
                
                // Close mobile menu if open
                const navLinks = document.getElementById('navLinks');
                const mobileMenuBtn = document.getElementById('mobileMenuBtn');
                if (navLinks && navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    const icon = mobileMenuBtn.querySelector('i');
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
                
                // Smooth scroll to target
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Check auth status on page load - SIMPLIFIED VERSION
function checkAuthStatus() {
    try {
        // Check if user has admin session in localStorage
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        
        if (isAdmin) {
            return { 
                isLoggedIn: true, 
                role: 'admin' 
            };
        }
        
        // Default to guest
        return { isLoggedIn: false, role: 'guest' };
        
    } catch (error) {
        console.error('Auth check error:', error);
        return { isLoggedIn: false, role: 'guest' };
    }
}
// Initialize auth check
checkAuthStatus();

// Export for use in other files
window.CodeNirvahana = window.CodeNirvahana || {};
window.CodeNirvahana.auth = {
    checkAuthStatus: checkAuthStatus,
    isAdmin: function() {
        const auth = checkAuthStatus();
        return auth.isLoggedIn && auth.role === 'admin';
    }
};