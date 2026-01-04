// Courses Page JavaScript - GitHub Links Edition
// FIXED: Admin status management, UI improvements, error handling
// Firebase Storage kept but NOT used for uploads

document.addEventListener('DOMContentLoaded', function() {
    console.log('Courses Page Initializing...');
    initMobileMenu();
    
    // Check for session-based admin status first (for immediate UI update)
    checkSessionAdminStatus();
    
    // Wait for Firebase initialization
    if (!window.firebaseInitialized) {
        console.log('Waiting for Firebase initialization...');
        document.addEventListener('firebaseInitialized', function() {
            console.log('Firebase initialized, starting courses page...');
            initCoursesPage();
        });
    } else {
        console.log('Firebase already initialized');
        initCoursesPage();
    }
});

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
    }
}

// Check session-based admin status for immediate UI
function checkSessionAdminStatus() {
    const isAdminChecked = sessionStorage.getItem('adminChecked') === 'true';
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    
    if (isAdminChecked && isAdmin) {
        console.log('Session admin status found, updating UI temporarily');
        updateAdminUI(true);
    }
}

async function initCoursesPage() {
    console.log('Initializing courses page...');
    
    // Initialize modals
    initAddCourseModal();
    initEditCourseModal();
    initDeleteModal();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load courses (will also check real admin status)
    await loadCourses();
    
    // Setup auth listener for real-time admin status updates
    setupAuthListener();
}

async function loadCourses() {
    const coursesGrid = document.getElementById('coursesGrid');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    
    if (!coursesGrid) return;
    
    // Show loading state
    if (loadingState) {
        loadingState.style.display = 'flex';
        emptyState.style.display = 'none';
    }
    
    // Clear current courses except loading/empty states
    const currentCards = coursesGrid.querySelectorAll('.course-card');
    currentCards.forEach(card => card.remove());
    
    try {
        // Wait for Firebase to be ready
        if (!window.firebaseDb) {
            console.error('Firestore not ready yet');
            throw new Error('Firebase not initialized');
        }
        
        // Get courses from Firestore - FIREBASE v8 SYNTAX
        const querySnapshot = await window.firebaseDb.collection('courses')
            .orderBy('createdAt', 'desc')
            .get();
        
        const courses = [];
        querySnapshot.forEach((doc) => {
            courses.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('Loaded courses:', courses.length);
        
        // Hide loading state
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        
        if (courses.length === 0) {
            // Show empty state
            emptyState.style.display = 'block';
        } else {
            // Hide empty state
            emptyState.style.display = 'none';
            
            // Add each course to the grid
            courses.forEach((course, index) => {
                const courseCard = createCourseCard(course, index);
                coursesGrid.appendChild(courseCard);
            });
        }
        
        // Check real admin status after loading courses
        await checkRealAdminStatus();
        
    } catch (error) {
        console.error('Error loading courses:', error);
        
        // Hide loading state
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        
        // Show error state
        const errorState = document.createElement('div');
        errorState.className = 'error-state';
        errorState.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <h4>Error Loading Courses</h4>
            <p>${error.message || 'Failed to load courses'}</p>
            <button class="btn btn-secondary" onclick="window.location.reload()">
                <i class="fas fa-redo"></i> Try Again
            </button>
        `;
        
        // Remove existing error states
        const existingError = coursesGrid.querySelector('.error-state');
        if (existingError) existingError.remove();
        
        coursesGrid.appendChild(errorState);
        
        showToast('Error loading courses: ' + error.message, 'error');
    }
}

// Check real admin status via Firebase
async function checkRealAdminStatus() {
    try {
        if (!window.firebaseAuth) {
            console.warn('Firebase Auth not ready');
            return false;
        }
        
        const user = window.firebaseAuth.currentUser;
        if (!user) {
            console.log('No user logged in');
            updateAdminUI(false);
            clearAdminSession();
            return false;
        }
        
        console.log('Checking real admin status for:', user.email);
        
        // Use global checkAdminStatus function from firebase-config.js
        let isAdmin = false;
        if (window.checkAdminStatus) {
            isAdmin = await window.checkAdminStatus(user.uid);
        } else {
            // Fallback: Check directly
            const adminDoc = await window.firebaseDb.collection('admins').doc(user.uid).get();
            isAdmin = adminDoc.exists && adminDoc.data()?.isAdmin === true;
        }
        
        console.log('Real admin status:', isAdmin);
        
        // Update session storage
        sessionStorage.setItem('adminChecked', 'true');
        sessionStorage.setItem('isAdmin', isAdmin.toString());
        sessionStorage.setItem('adminUid', user.uid);
        sessionStorage.setItem('adminEmail', user.email);
        
        // Update UI
        updateAdminUI(isAdmin);
        
        return isAdmin;
        
    } catch (error) {
        console.error('Error checking admin status:', error);
        updateAdminUI(false);
        clearAdminSession();
        return false;
    }
}

function clearAdminSession() {
    sessionStorage.removeItem('adminChecked');
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('adminUid');
    sessionStorage.removeItem('adminEmail');
}

function setupAuthListener() {
    if (!window.firebaseAuth) {
        console.warn('Firebase Auth not available for listener');
        return;
    }
    
    // Listen for auth state changes
    window.firebaseAuth.onAuthStateChanged(async (user) => {
        console.log('Auth state changed:', user ? user.email : 'No user');
        
        if (!user) {
            updateAdminUI(false);
            clearAdminSession();
            return;
        }
        
        // Check admin status when auth state changes
        await checkRealAdminStatus();
    });
}

function updateAdminUI(isAdmin) {
    console.log('Updating admin UI, isAdmin:', isAdmin);
    
    const adminActionsContainer = document.getElementById('adminActionsContainer');
    const adminStatusIndicator = document.getElementById('adminStatusIndicator');
    const userInfo = document.getElementById('userInfo');
    
    if (!adminActionsContainer) {
        console.error('Admin actions container not found');
        return;
    }
    
    if (isAdmin) {
        // Show admin controls
        adminActionsContainer.innerHTML = `
            <button class="btn btn-primary" id="addCourseBtn">
                <i class="fas fa-plus-circle"></i>
                <span>Add New Course</span>
            </button>
            <button class="btn btn-secondary" id="refreshCoursesBtn">
                <i class="fas fa-sync-alt"></i>
                <span>Refresh</span>
            </button>
        `;
        
        // Show admin status indicator
        if (adminStatusIndicator) {
            adminStatusIndicator.style.display = 'block';
        }
        
        // Hide user info
        if (userInfo) {
            userInfo.style.display = 'none';
        }
        
        // Add event listeners
        setTimeout(() => {
            const addCourseBtn = document.getElementById('addCourseBtn');
            const refreshBtn = document.getElementById('refreshCoursesBtn');
            
            if (addCourseBtn) {
                addCourseBtn.addEventListener('click', function() {
                    console.log('✅ Add Course button clicked');
                    document.getElementById('addCourseModal').classList.add('active');
                });
            }
            
            if (refreshBtn) {
                refreshBtn.addEventListener('click', function() {
                    console.log('✅ Refresh button clicked');
                    loadCourses();
                    showToast('Courses refreshed', 'success');
                });
            }
        }, 100);
        
        // Add admin class to all course cards
        document.querySelectorAll('.course-card').forEach(card => {
            card.classList.add('admin-mode');
        });
        
    } else {
        // Show user info
        if (userInfo) {
            userInfo.style.display = 'flex';
            adminActionsContainer.innerHTML = '';
            adminActionsContainer.appendChild(userInfo);
        }
        
        // Hide admin status indicator
        if (adminStatusIndicator) {
            adminStatusIndicator.style.display = 'none';
        }
        
        // Remove admin class from all course cards
        document.querySelectorAll('.course-card').forEach(card => {
            card.classList.remove('admin-mode');
        });
    }
}

function createCourseCard(course, index) {
    const card = document.createElement('div');
    card.className = 'course-card';
    card.dataset.courseId = course.id || index;
    
    // Format date
    const courseDate = course.createdAt ? new Date(course.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }) : 'Recently added';
    
    // Count videos
    const videosCount = course.videos ? course.videos.length : 0;
    
    // Course thumbnail or default icon
    let thumbnailContent = '<i class="fas fa-graduation-cap"></i>';
    if (course.thumbnail) {
        // Check if it's a URL (GitHub raw or other)
        if (course.thumbnail.startsWith('http') || course.thumbnail.startsWith('https')) {
            thumbnailContent = `<img src="${course.thumbnail}" alt="${course.title}" 
                onerror="this.parentElement.innerHTML='<i class=\\'fas fa-graduation-cap\\'></i>'">`;
        }
    }
    
    // Check admin status from session storage for immediate UI
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (isAdmin) {
        card.classList.add('admin-mode');
    }
    
    card.innerHTML = `
        <div class="course-card-header">
            <div class="course-card-admin-badge">
                <i class="fas fa-shield-alt"></i> Admin
            </div>
            
            <div class="course-card-actions">
                <button class="action-btn edit-btn" onclick="openEditCourseModal('${course.id}', event)">
                    <i class="fas fa-edit"></i>
                    <span class="tooltip">Edit Course</span>
                </button>
                <button class="action-btn delete-btn" onclick="openDeleteModal('${course.id}', event)">
                    <i class="fas fa-trash-alt"></i>
                    <span class="tooltip">Delete Course</span>
                </button>
            </div>
            
            <div class="course-card-icon">
                ${thumbnailContent}
            </div>
            
            <h3 class="course-card-title">${escapeHtml(course.title || 'Untitled Course')}</h3>
            <p class="course-card-description">${escapeHtml(course.description || 'No description available')}</p>
        </div>
        
        <div class="course-card-footer">
            <div class="course-meta">
                <div class="course-date">
                    <i class="far fa-calendar"></i>
                    ${courseDate}
                </div>
                <div class="course-stats">
                    <div class="course-stat">
                        <i class="fas fa-video"></i>
                        <span>${videosCount} Video${videosCount !== 1 ? 's' : ''}</span>
                    </div>
                    ${course.duration ? `
                        <div class="course-stat">
                            <i class="far fa-clock"></i>
                            <span>${course.duration}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <button class="btn btn-primary course-card-cta" onclick="viewCourseDetails('${course.id}')">
                <i class="fas fa-play-circle"></i>
                View Course Details
            </button>
        </div>
    `;
    
    // Add hover animation
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-4px) scale(1.02)';
        this.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.15)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
        this.style.boxShadow = 'var(--shadow-md)';
    });
    
    return card;
}

function viewCourseDetails(courseId) {
    console.log('Viewing course details:', courseId);
    window.location.href = `course-details.html?courseId=${courseId}`;
}

function initAddCourseModal() {
    const addCourseModal = document.getElementById('addCourseModal');
    const closeAddCourseModal = document.getElementById('closeAddCourseModal');
    const cancelAddCourseModal = document.getElementById('cancelAddCourseModal');
    const addCourseForm = document.getElementById('addCourseForm');
    
    if (!addCourseModal || !addCourseForm) return;
    
    if (closeAddCourseModal) {
        closeAddCourseModal.addEventListener('click', function() {
            addCourseModal.classList.remove('active');
            addCourseForm.reset();
        });
    }
    
    if (cancelAddCourseModal) {
        cancelAddCourseModal.addEventListener('click', function() {
            addCourseModal.classList.remove('active');
            addCourseForm.reset();
        });
    }
    
    if (addCourseForm) {
        addCourseForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log('✅ Add Course form submitted');
            await saveNewCourse();
        });
    }
    
    // Handle thumbnail link validation
    const thumbnailInput = document.getElementById('courseThumbnail');
    if (thumbnailInput) {
        thumbnailInput.addEventListener('blur', function() {
            validateGitHubLink(this);
        });
    }
}

function initEditCourseModal() {
    const editCourseModal = document.getElementById('editCourseModal');
    const closeEditCourseModal = document.getElementById('closeEditCourseModal');
    const cancelEditCourseModal = document.getElementById('cancelEditCourseModal');
    const editCourseForm = document.getElementById('editCourseForm');
    
    if (closeEditCourseModal) {
        closeEditCourseModal.addEventListener('click', function() {
            editCourseModal.classList.remove('active');
            if (editCourseForm) editCourseForm.reset();
        });
    }
    
    if (cancelEditCourseModal) {
        cancelEditCourseModal.addEventListener('click', function() {
            editCourseModal.classList.remove('active');
            if (editCourseForm) editCourseForm.reset();
        });
    }
    
    if (editCourseForm) {
        editCourseForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log('✅ Edit Course form submitted');
            await saveEditedCourse();
        });
    }
}

function initDeleteModal() {
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const closeDeleteConfirmModal = document.getElementById('closeDeleteConfirmModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    
    if (closeDeleteConfirmModal) {
        closeDeleteConfirmModal.addEventListener('click', function() {
            deleteConfirmModal.classList.remove('active');
        });
    }
    
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', function() {
            deleteConfirmModal.classList.remove('active');
        });
    }
}

function setupEventListeners() {
    // Close modal on outside click
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            modals.forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
    
    // Refresh courses on page focus
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            // Check if we should refresh (e.g., if user might have logged in elsewhere)
            const lastRefresh = parseInt(sessionStorage.getItem('lastCoursesRefresh') || '0');
            const now = Date.now();
            
            if (now - lastRefresh > 60000) { // 1 minute
                loadCourses();
                sessionStorage.setItem('lastCoursesRefresh', now.toString());
            }
        }
    });
}

async function saveNewCourse() {
    // Check admin status via session first
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        console.error('❌ Admin access required');
        showToast('Admin access required. Please log in as admin.', 'error');
        return;
    }
    
    const courseTitle = document.getElementById('courseTitle').value.trim();
    const courseDescription = document.getElementById('courseDescription').value.trim();
    const thumbnailLink = document.getElementById('courseThumbnail').value.trim();
    
    if (!courseTitle || !courseDescription) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Validate thumbnail link if provided
    if (thumbnailLink && !isValidGitHubLink(thumbnailLink)) {
        showToast('Please enter a valid GitHub URL for thumbnail', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = document.getElementById('createCourseBtn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    submitBtn.disabled = true;
    
    // Create new course object with GitHub link
    const newCourse = {
        title: courseTitle,
        description: courseDescription,
        thumbnail: thumbnailLink || "", // Store as string, empty if not provided
        videos: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: sessionStorage.getItem('adminUid') || 'unknown',
        createdByEmail: sessionStorage.getItem('adminEmail') || 'unknown'
    };
    
    try {
        if (!window.firebaseDb) {
            throw new Error('Firebase not ready');
        }
        
        // Save course to Firestore (NO Firebase Storage upload)
        console.log('💾 Saving course to Firestore...');
        const docRef = await window.firebaseDb.collection('courses').add(newCourse);
        console.log('✅ Course saved with ID:', docRef.id);
        
        // Success
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Created!';
        
        setTimeout(() => {
            document.getElementById('addCourseModal').classList.remove('active');
            document.getElementById('addCourseForm').reset();
            
            // Reset button
            setTimeout(() => {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }, 500);
            
            showToast('Course created successfully', 'success');
            
            // Reload courses
            loadCourses();
        }, 500);
        
    } catch (error) {
        console.error('❌ Error saving course:', error);
        
        // Reset button
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        
        showToast('Error creating course: ' + error.message, 'error');
    }
}

async function saveEditedCourse() {
    // Check admin status
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }
    
    const courseId = document.getElementById('editCourseId').value;
    const courseTitle = document.getElementById('editCourseTitle').value.trim();
    const courseDescription = document.getElementById('editCourseDescription').value.trim();
    const thumbnailLink = document.getElementById('editCourseThumbnail').value.trim();
    
    if (!courseTitle || !courseDescription) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Validate thumbnail link if provided
    if (thumbnailLink && !isValidGitHubLink(thumbnailLink)) {
        showToast('Please enter a valid GitHub URL for thumbnail', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = document.getElementById('saveCourseBtn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;
    
    try {
        if (!window.firebaseDb) {
            throw new Error('Firebase not ready');
        }
        
        const docRef = window.firebaseDb.collection('courses').doc(courseId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            throw new Error('Course not found');
        }
        
        const course = { id: doc.id, ...doc.data() };
        
        // Update course data
        const updatedCourse = {
            title: courseTitle,
            description: courseDescription,
            updatedAt: new Date().toISOString(),
            updatedBy: sessionStorage.getItem('adminUid'),
            updatedByEmail: sessionStorage.getItem('adminEmail')
        };
        
        // Update thumbnail if provided, otherwise keep existing
        if (thumbnailLink) {
            updatedCourse.thumbnail = thumbnailLink;
        } else if (course.thumbnail) {
            updatedCourse.thumbnail = course.thumbnail; // Keep existing
        }
        
        // Update course in Firestore (NO Firebase Storage operations)
        await docRef.update(updatedCourse);
        console.log('✅ Course updated in Firestore');
        
        // Success
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        
        setTimeout(() => {
            document.getElementById('editCourseModal').classList.remove('active');
            
            // Reset button
            setTimeout(() => {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }, 500);
            
            showToast('Course updated successfully', 'success');
            
            // Reload courses
            loadCourses();
        }, 500);
        
    } catch (error) {
        console.error('❌ Error updating course:', error);
        
        // Reset button
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        
        showToast('Error updating course: ' + error.message, 'error');
    }
}

async function deleteCourse(courseId) {
    // Check admin status
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }
    
    const deleteBtn = document.getElementById('confirmDeleteBtn');
    const originalBtnText = deleteBtn.innerHTML;
    deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    deleteBtn.disabled = true;
    
    try {
        if (!window.firebaseDb) {
            throw new Error('Firebase not ready');
        }
        
        // Delete course from Firestore (NO Firebase Storage cleanup needed)
        await window.firebaseDb.collection('courses').doc(courseId).delete();
        console.log('✅ Course deleted from Firestore');
        
        // Success
        deleteBtn.innerHTML = '<i class="fas fa-check"></i> Deleted!';
        
        setTimeout(() => {
            document.getElementById('deleteConfirmModal').classList.remove('active');
            
            // Reset button
            setTimeout(() => {
                deleteBtn.innerHTML = originalBtnText;
                deleteBtn.disabled = false;
            }, 500);
            
            showToast('Course deleted successfully', 'success');
            
            // Reload courses
            loadCourses();
        }, 500);
        
    } catch (error) {
        console.error('❌ Error deleting course:', error);
        
        // Reset button
        deleteBtn.innerHTML = originalBtnText;
        deleteBtn.disabled = false;
        
        showToast('Error deleting course: ' + error.message, 'error');
    }
}

function isValidGitHubLink(link) {
    if (!link) return true; // Empty is valid (optional field)
    
    try {
        const url = new URL(link);
        return url.hostname.includes('github.com') || 
               url.hostname.includes('raw.githubusercontent.com') ||
               url.hostname.includes('gist.github.com');
    } catch (e) {
        return false; // Not a valid URL
    }
}

function validateGitHubLink(input) {
    if (!input.value.trim()) return;
    
    if (!isValidGitHubLink(input.value)) {
        input.style.borderColor = 'var(--accent-error)';
        input.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.1)';
    } else {
        input.style.borderColor = '';
        input.style.boxShadow = '';
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('messageToast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = toast?.querySelector('.toast-icon');
    
    if (!toast || !toastMessage) return;
    
    // Set message
    toastMessage.textContent = message;
    
    // Set icon based on type
    if (toastIcon) {
        toastIcon.className = 'toast-icon';
        if (type === 'success') {
            toastIcon.classList.add('fas', 'fa-check-circle');
            toast.style.backgroundColor = 'rgba(34, 197, 94, 0.9)';
        } else if (type === 'error') {
            toastIcon.classList.add('fas', 'fa-exclamation-circle');
            toast.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
        } else if (type === 'warning') {
            toastIcon.classList.add('fas', 'fa-exclamation-triangle');
            toast.style.backgroundColor = 'rgba(245, 158, 11, 0.9)';
        } else {
            toastIcon.classList.add('fas', 'fa-info-circle');
            toast.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
        }
    }
    
    // Show toast
    toast.classList.add('show');
    
    // Hide after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Global functions for onclick handlers
window.openEditCourseModal = async function(courseId, event) {
    if (event) event.stopPropagation();
    
    // Check admin status
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }
    
    try {
        if (!window.firebaseDb) {
            showToast('Firebase not ready', 'error');
            return;
        }
        
        const docRef = window.firebaseDb.collection('courses').doc(courseId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            showToast('Course not found', 'error');
            return;
        }
        
        const course = { id: doc.id, ...doc.data() };
        
        // Set form values
        document.getElementById('editCourseId').value = courseId;
        document.getElementById('editCourseTitle').value = course.title || '';
        document.getElementById('editCourseDescription').value = course.description || '';
        document.getElementById('editCourseThumbnail').value = course.thumbnail || '';
        
        // Show current thumbnail if exists
        const thumbnailPreview = document.getElementById('currentThumbnailPreview');
        if (course.thumbnail && course.thumbnail.trim() !== "") {
            thumbnailPreview.innerHTML = `
                <div class="thumbnail-preview">
                    <img src="${course.thumbnail}" alt="Current thumbnail" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'no-thumbnail\\'><i class=\\'fas fa-image\\'></i><p>Thumbnail not available</p></div>';">
                    <div class="thumbnail-info">
                        <small>Current thumbnail link</small>
                        <a href="${course.thumbnail}" target="_blank" class="view-link">
                            <i class="fas fa-external-link-alt"></i> View
                        </a>
                    </div>
                </div>
            `;
        } else {
            thumbnailPreview.innerHTML = `
                <div class="no-thumbnail">
                    <i class="fas fa-image"></i>
                    <p>No thumbnail set</p>
                </div>
            `;
        }
        
        // Show modal
        document.getElementById('editCourseModal').classList.add('active');
        
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showToast('Error loading course details', 'error');
    }
};

window.openDeleteModal = async function(courseId, event) {
    if (event) event.stopPropagation();
    
    // Check admin status
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }
    
    try {
        if (!window.firebaseDb) {
            showToast('Firebase not ready', 'error');
            return;
        }
        
        const docRef = window.firebaseDb.collection('courses').doc(courseId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            showToast('Course not found', 'error');
            return;
        }
        
        const course = { id: doc.id, ...doc.data() };
        
        // Set course name for confirmation
        document.getElementById('deleteCourseName').textContent = course.title || 'Untitled Course';
        
        // Set up confirm delete button
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        confirmDeleteBtn.onclick = function() {
            deleteCourse(courseId);
        };
        
        // Show modal
        document.getElementById('deleteConfirmModal').classList.add('active');
        
    } catch (error) {
        console.error('Error opening delete modal:', error);
        showToast('Error loading course details', 'error');
    }
};

// Export for global use
window.CodeNirvahana = window.CodeNirvahana || {};
window.CodeNirvahana.courses = {
    loadCourses: loadCourses,
    showToast: showToast
};

console.log('✅ Courses module loaded - GitHub Links Edition');