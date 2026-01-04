// Course Details Page JavaScript - GitHub Links Edition
// FIREBASE STORAGE KEPT BUT NOT USED FOR UPLOADS
// Only GitHub links stored in Firestore

document.addEventListener('DOMContentLoaded', function() {
    console.log('Course Detail Page Initializing...');
    initMobileMenu();
    
    // Wait for Firebase initialization
    if (!window.firebaseInitialized) {
        console.log('Waiting for Firebase initialization...');
        document.addEventListener('firebaseInitialized', function() {
            console.log('Firebase initialized, starting course details...');
            initCourseDetailPage();
        });
    } else {
        console.log('Firebase already initialized');
        initCourseDetailPage();
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

async function initCourseDetailPage() {
    console.log('Initializing course detail page...');
    
    // Initialize all components
    initVideoUploadForm();
    initVideoEditForm();
    initDeleteModal();
    initEventListeners();
    
    // Setup admin state listener
    setupAdminStateListener();
    
    // Load course data
    await loadCourseData();
}

function setupAdminStateListener() {
    console.log('Setting up admin state listener...');
    
    // Use sessionStorage for immediate admin check
    const sessionAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (sessionAdmin) {
        console.log('Session admin found, updating UI');
        updateAdminUI(true);
    }
    
    // Also listen for global admin state changes
    if (window.addAdminStateListener) {
        window.addAdminStateListener(function(isAdmin, user) {
            console.log('Global admin state updated:', { isAdmin, user: user?.email });
            // Update session storage for persistence
            if (isAdmin && user) {
                sessionStorage.setItem('isAdmin', 'true');
                sessionStorage.setItem('adminUid', user.uid);
                sessionStorage.setItem('adminEmail', user.email);
            }
            updateAdminUI(isAdmin);
        });
    }
    
    // Check current state immediately
    if (window.adminState && window.adminState.initialized) {
        console.log('Admin state already initialized, updating UI...');
        updateAdminUI(window.adminState.isAdmin);
    }
}

function updateAdminUI(isAdmin) {
    console.log('Updating admin UI, isAdmin:', isAdmin);
    
    const addVideoBtn = document.getElementById('addVideoBtn');
    const adminUploadSection = document.getElementById('adminUploadSection');
    const addFirstVideoBtn = document.getElementById('addFirstVideoBtn');
    
    if (isAdmin) {
        // Show admin controls
        if (addVideoBtn) {
            addVideoBtn.style.display = 'flex';
            // Ensure event listener is attached
            addVideoBtn.onclick = function() {
                console.log('✅ Add Video button clicked');
                if (adminUploadSection) {
                    adminUploadSection.style.display = 'block';
                    if (document.getElementById('editVideoSection')) {
                        document.getElementById('editVideoSection').style.display = 'none';
                    }
                    adminUploadSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            };
        }
        
        // Show "Add First Video" button in empty state
        if (addFirstVideoBtn) {
            addFirstVideoBtn.style.display = 'flex';
            addFirstVideoBtn.onclick = function() {
                addVideoBtn.click();
            };
        }
        
        // Show admin badge in playlist header
        const playlistHeader = document.querySelector('.playlist-header h3');
        if (playlistHeader && !playlistHeader.querySelector('.admin-badge')) {
            const adminBadge = document.createElement('span');
            adminBadge.className = 'admin-badge';
            adminBadge.innerHTML = '<i class="fas fa-shield-alt"></i> Admin Mode';
            playlistHeader.appendChild(adminBadge);
        }
        
    } else {
        // Hide admin controls
        if (addVideoBtn) {
            addVideoBtn.style.display = 'none';
        }
        if (adminUploadSection) {
            adminUploadSection.style.display = 'none';
        }
        if (document.getElementById('editVideoSection')) {
            document.getElementById('editVideoSection').style.display = 'none';
        }
        if (addFirstVideoBtn) {
            addFirstVideoBtn.style.display = 'none';
        }
        
        // Remove admin badge
        const playlistHeader = document.querySelector('.playlist-header h3');
        if (playlistHeader) {
            const adminBadge = playlistHeader.querySelector('.admin-badge');
            if (adminBadge) adminBadge.remove();
        }
    }
}

async function loadCourseData() {
    console.log('Loading course data from Firebase...');
    
    // Get course ID from URL or sessionStorage
    let courseId = getCourseIdFromURL();
    if (!courseId) {
        courseId = sessionStorage.getItem('activeCourseId');
    }
    
    console.log('Course ID:', courseId);
    
    if (!courseId || courseId === 'null' || courseId === 'undefined') {
        console.error('No course ID found');
        showEmptyCourseState();
        showToast('No course selected. Please select a course from the courses page.', 'error');
        return;
    }
    
    // Store for later use
    sessionStorage.setItem('activeCourseId', courseId);
    window.currentCourseId = courseId;
    
    // Show loading state
    showLoadingState();
    
    try {
        if (!window.firebaseDb) {
            throw new Error('Firebase not ready');
        }
        
        // Get course from Firestore
        const docRef = window.firebaseDb.collection('courses').doc(courseId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            throw new Error('Course not found in Firestore');
        }
        
        const course = {
            id: doc.id,
            ...doc.data()
        };
        
        console.log('Loaded course:', course.title);
        
        // Update course info
        updateCourseInfo(course);
        
        // Load playlist
        loadPlaylist(course);
        
        // Update stats
        updateCourseStats(course);
        
        // Store course reference
        window.currentCourse = course;
        window.currentCourseRef = docRef;
        
    } catch (error) {
        console.error('Error loading course:', error);
        showEmptyCourseState();
        showToast('Error loading course: ' + error.message, 'error');
    }
}

function getCourseIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('courseId');
}

function showLoadingState() {
    const courseTitle = document.getElementById('courseTitle');
    const courseDescription = document.getElementById('courseDescription');
    const playlistContainer = document.getElementById('playlistContainer');
    
    if (courseTitle) {
        courseTitle.textContent = 'Loading Course...';
    }
    
    if (courseDescription) {
        courseDescription.textContent = '';
    }
    
    if (playlistContainer) {
        playlistContainer.innerHTML = `
            <div class="loading-state" id="playlistLoading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading videos...</p>
            </div>
        `;
    }
}

function showEmptyCourseState() {
    console.log('Showing empty course state');
    
    const courseTitle = document.getElementById('courseTitle');
    const courseDescription = document.getElementById('courseDescription');
    const courseThumbnail = document.getElementById('courseThumbnail');
    const playlistContainer = document.getElementById('playlistContainer');
    
    if (courseTitle) {
        courseTitle.textContent = 'Course Not Found';
    }
    
    if (courseDescription) {
        courseDescription.textContent = 'The requested course could not be loaded. Please return to the courses page and select a valid course.';
    }
    
    // Clear thumbnail
    if (courseThumbnail) {
        courseThumbnail.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
        courseThumbnail.style.background = 'linear-gradient(135deg, #ef4444, rgba(239, 68, 68, 0.2))';
    }
    
    // Show empty playlist
    if (playlistContainer) {
        playlistContainer.innerHTML = `
            <div class="playlist-empty-state" id="playlistEmpty">
                <i class="fas fa-exclamation-circle"></i>
                <h4>Course Not Available</h4>
                <p>This course could not be loaded.</p>
                <button class="btn btn-secondary" onclick="window.location.href='courses.html'">
                    <i class="fas fa-arrow-left"></i> Back to Courses
                </button>
            </div>
        `;
    }
    
    // Hide video player
    const videoEmptyState = document.getElementById('videoEmptyState');
    const youtubePlayer = document.getElementById('youtubePlayer');
    
    if (videoEmptyState) videoEmptyState.style.display = 'flex';
    if (youtubePlayer) {
        youtubePlayer.style.display = 'none';
        youtubePlayer.src = '';
    }
    
    // Hide resources
    const resourcesGrid = document.getElementById('resourcesGrid');
    const resourcesEmptyState = document.getElementById('resourcesEmptyState');
    
    if (resourcesGrid) resourcesGrid.style.display = 'none';
    if (resourcesEmptyState) resourcesEmptyState.style.display = 'flex';
}

function updateCourseInfo(course) {
    console.log('Updating course info for:', course.title);
    
    const courseTitle = document.getElementById('courseTitle');
    const courseDescription = document.getElementById('courseDescription');
    const courseThumbnail = document.getElementById('courseThumbnail');
    const courseCreatedDate = document.getElementById('courseCreatedDate');
    const courseVideosCount = document.getElementById('courseVideosCount');
    
    if (courseTitle) {
        courseTitle.textContent = course.title || 'Untitled Course';
    }
    
    if (courseDescription) {
        courseDescription.textContent = course.description || 'No description available.';
    }
    
    // Update thumbnail - check for thumbnail in course
    if (courseThumbnail) {
        let thumbnailUrl = course.thumbnail;
        
        // Check if thumbnail is a GitHub raw URL or other URL
        if (thumbnailUrl && (thumbnailUrl.startsWith('http') || thumbnailUrl.startsWith('https'))) {
            courseThumbnail.innerHTML = `<img src="${thumbnailUrl}" alt="${course.title}" class="course-thumbnail-img" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-graduation-cap\\'></i>'">`;
            courseThumbnail.classList.add('has-image');
        } else {
            courseThumbnail.innerHTML = '<i class="fas fa-graduation-cap"></i>';
            courseThumbnail.classList.remove('has-image');
            courseThumbnail.style.background = 'linear-gradient(135deg, #38bdf8, rgba(56, 189, 248, 0.2))';
        }
    }
    
    // Update metadata
    if (courseCreatedDate) {
        const date = course.createdAt ? new Date(course.createdAt) : new Date();
        courseCreatedDate.innerHTML = `<i class="far fa-calendar"></i> ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
    }
    
    if (courseVideosCount) {
        const videoCount = course.videos ? course.videos.length : 0;
        courseVideosCount.innerHTML = `<i class="fas fa-video"></i> ${videoCount} video${videoCount !== 1 ? 's' : ''}`;
    }
    
    // Store course ID for later use
    window.currentCourseId = course.id;
}

function loadPlaylist(course) {
    console.log('Loading playlist for course:', course.title);
    
    const playlistContainer = document.getElementById('playlistContainer');
    const videos = course.videos || [];
    
    console.log('Number of videos:', videos.length);
    
    if (!playlistContainer) return;
    
    // Clear loading state
    const playlistLoading = document.getElementById('playlistLoading');
    if (playlistLoading) playlistLoading.remove();
    
    if (videos.length === 0) {
        playlistContainer.innerHTML = `
            <div class="playlist-empty-state" id="playlistEmpty">
                <i class="fas fa-video-slash"></i>
                <h4>No Videos Available</h4>
                <p>This course doesn't have any videos yet.</p>
                <button class="btn btn-primary" id="addFirstVideoBtn" style="display: none;">
                    <i class="fas fa-plus"></i> Add First Video
                </button>
            </div>
        `;
        
        // Show "Add First Video" button for admin
        const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
        const addFirstVideoBtn = document.getElementById('addFirstVideoBtn');
        if (addFirstVideoBtn && isAdmin) {
            addFirstVideoBtn.style.display = 'flex';
            addFirstVideoBtn.onclick = function() {
                document.getElementById('addVideoBtn').click();
            };
        }
        
        return;
    }
    
    // Create playlist items
    const playlistItems = document.createElement('div');
    playlistItems.className = 'playlist-items';
    
    // Sort videos by order or upload date
    const sortedVideos = [...videos].sort((a, b) => {
        if (a.order && b.order) return a.order - b.order;
        const dateA = a.uploadedAt ? new Date(a.uploadedAt) : new Date(0);
        const dateB = b.uploadedAt ? new Date(b.uploadedAt) : new Date(0);
        return dateA - dateB; // Oldest first
    });
    
    // Create playlist items
    sortedVideos.forEach((video, index) => {
        const playlistItem = createPlaylistItem(video, index);
        playlistItems.appendChild(playlistItem);
    });
    
    playlistContainer.innerHTML = '';
    playlistContainer.appendChild(playlistItems);
    
    // Load first video by default
    if (sortedVideos.length > 0) {
        console.log('Loading first video:', sortedVideos[0].title);
        loadVideo(sortedVideos[0], 0);
    }
}

function createPlaylistItem(video, index) {
    // Check for GitHub links (new structure)
    const hasNotes = video.notesLink && video.notesLink.trim() !== '';
    const hasAssignment = video.assignmentLink && video.assignmentLink.trim() !== '';
    const hasCode = video.codeLink && video.codeLink.trim() !== '';
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    
    const playlistItem = document.createElement('div');
    playlistItem.className = 'playlist-item';
    playlistItem.dataset.videoIndex = index;
    
    playlistItem.innerHTML = `
        <div class="playlist-item-icon">
            <i class="fas fa-play"></i>
        </div>
        <div class="playlist-item-content">
            <h4 class="playlist-item-title">${escapeHtml(video.title)}</h4>
            <p class="playlist-item-description">${escapeHtml(video.description || 'No description')}</p>
            <div class="playlist-item-meta">
                ${hasNotes ? '<span class="resource-badge"><i class="fab fa-github"></i> Notes</span>' : ''}
                ${hasAssignment ? '<span class="resource-badge"><i class="fab fa-github"></i> Assignment</span>' : ''}
                ${hasCode ? '<span class="resource-badge"><i class="fab fa-github"></i> Code</span>' : ''}
                ${video.uploadedAt ? `<span class="video-date">${new Date(video.uploadedAt).toLocaleDateString()}</span>` : ''}
            </div>
        </div>
        ${isAdmin ? `
            <div class="playlist-item-actions">
                <button class="playlist-item-action-btn playlist-edit-btn" onclick="openEditVideoModal(${index})">
                    <i class="fas fa-edit"></i>
                    <span class="tooltip">Edit Video</span>
                </button>
                <button class="playlist-item-action-btn playlist-delete-btn" onclick="openDeleteVideoModal(${index})">
                    <i class="fas fa-trash-alt"></i>
                    <span class="tooltip">Delete Video</span>
                </button>
            </div>
        ` : ''}
    `;
    
    // Add click event for loading video (only on non-admin areas)
    playlistItem.addEventListener('click', function(event) {
        // Don't trigger if clicking on admin buttons or their children
        if (!event.target.closest('.playlist-item-actions')) {
            console.log('Loading video:', video.title);
            loadVideo(video, index);
        }
    });
    
    return playlistItem;
}

function loadVideo(video, videoIndex) {
    console.log('Loading video into player:', video.title);
    
    const youtubePlayer = document.getElementById('youtubePlayer');
    const videoEmptyState = document.getElementById('videoEmptyState');
    const resourcesGrid = document.getElementById('resourcesGrid');
    const resourcesEmptyState = document.getElementById('resourcesEmptyState');
    const resourceHint = document.getElementById('resourceHint');
    
    // Extract YouTube video ID
    const videoId = extractYouTubeId(video.youtubeUrl || video.url);
    console.log('YouTube Video ID:', videoId);
    
    if (videoId) {
        // Update YouTube iframe
        if (youtubePlayer) {
            youtubePlayer.src = `https://www.youtube.com/embed/${videoId}?rel=0&showinfo=0&enablejsapi=1&modestbranding=1`;
            youtubePlayer.style.display = 'block';
        }
        if (videoEmptyState) videoEmptyState.style.display = 'none';
    } else {
        // Show error state
        if (youtubePlayer) youtubePlayer.style.display = 'none';
        if (videoEmptyState) {
            videoEmptyState.style.display = 'flex';
            videoEmptyState.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <h3>Invalid Video URL</h3>
                <p>The video URL is not valid. Please check the video configuration.</p>
                ${sessionStorage.getItem('isAdmin') === 'true' ? `
                    <button class="btn btn-secondary" onclick="openEditVideoModal(${videoIndex})">
                        <i class="fas fa-edit"></i> Edit Video
                    </button>
                ` : ''}
            `;
        }
    }
    
    // Update active playlist item
    updateActivePlaylistItem(videoIndex);
    
    // Update resources section
    updateResourcesSection(video);
    
    // Update resource hint
    if (resourceHint) {
        resourceHint.textContent = `Resources for "${video.title}"`;
    }
    
    // Store current video data for later use
    window.currentVideo = video;
    window.currentVideoIndex = videoIndex;
}

function extractYouTubeId(url) {
    if (!url) return null;
    
    console.log('Extracting YouTube ID from:', url);
    
    // Handle various YouTube URL formats
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            console.log('Found YouTube ID:', match[1]);
            return match[1];
        }
    }
    
    // Check if it's already a video ID (11 characters)
    if (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url)) {
        console.log('Input appears to be a YouTube ID:', url);
        return url;
    }
    
    console.log('No YouTube ID found');
    return null;
}

function updateActivePlaylistItem(activeIndex) {
    const playlistItems = document.querySelectorAll('.playlist-item');
    playlistItems.forEach((item, index) => {
        if (parseInt(item.dataset.videoIndex) === activeIndex) {
            item.classList.add('active');
            // Scroll into view if needed
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

function updateCourseStats(course) {
    console.log('Updating course stats for:', course.title);
    
    const totalVideos = course.videos ? course.videos.length : 0;
    
    const totalVideosEl = document.getElementById('totalVideos');
    const totalDurationEl = document.getElementById('totalDuration');
    
    if (totalVideosEl) totalVideosEl.textContent = totalVideos;
    if (totalDurationEl) {
        // For now, we don't track total duration
        totalDurationEl.textContent = `${totalVideos}h`;
    }
}

function updateResourcesSection(video) {
    console.log('Updating resources section for video:', video.title);
    
    const resourcesGrid = document.getElementById('resourcesGrid');
    const resourcesEmptyState = document.getElementById('resourcesEmptyState');
    
    if (!resourcesGrid || !resourcesEmptyState) return;
    
    // Check if any resources exist (new link structure)
    const hasNotes = video.notesLink && video.notesLink.trim() !== '';
    const hasAssignment = video.assignmentLink && video.assignmentLink.trim() !== '';
    const hasCode = video.codeLink && video.codeLink.trim() !== '';
    
    if (!hasNotes && !hasAssignment && !hasCode) {
        resourcesGrid.style.display = 'none';
        resourcesEmptyState.style.display = 'flex';
        return;
    }
    
    // Show resources grid
    resourcesGrid.style.display = 'grid';
    resourcesEmptyState.style.display = 'none';
    
    // Update notes resource
    const notesResource = document.getElementById('notesResource');
    const notesDescription = document.getElementById('notesDescription');
    
    if (hasNotes && notesResource && notesDescription) {
        notesResource.style.display = 'flex';
        notesDescription.textContent = getGithubLinkDisplay(video.notesLink);
    } else if (notesResource) {
        notesResource.style.display = 'none';
    }
    
    // Update assignment resource
    const assignmentResource = document.getElementById('assignmentResource');
    const assignmentDescription = document.getElementById('assignmentDescription');
    
    if (hasAssignment && assignmentResource && assignmentDescription) {
        assignmentResource.style.display = 'flex';
        assignmentDescription.textContent = getGithubLinkDisplay(video.assignmentLink);
    } else if (assignmentResource) {
        assignmentResource.style.display = 'none';
    }
    
    // Update code resource
    const codeResource = document.getElementById('codeResource');
    const codeDescription = document.getElementById('codeDescription');
    
    if (hasCode && codeResource && codeDescription) {
        codeResource.style.display = 'flex';
        codeDescription.textContent = getGithubLinkDisplay(video.codeLink);
    } else if (codeResource) {
        codeResource.style.display = 'none';
    }
}

function getGithubLinkDisplay(link) {
    if (!link) return 'No link available';
    
    // Extract a clean display name from GitHub URL
    try {
        const url = new URL(link);
        if (url.hostname.includes('github.com')) {
            // Extract repo and file name
            const pathParts = url.pathname.split('/').filter(p => p);
            if (pathParts.length >= 2) {
                const repo = pathParts[1];
                const file = pathParts[pathParts.length - 1];
                return `${repo}/${file}`;
            }
        }
        return url.hostname + url.pathname;
    } catch (e) {
        return link.length > 50 ? link.substring(0, 50) + '...' : link;
    }
}

function initVideoUploadForm() {
    console.log('Initializing video upload form...');
    
    const videoUploadForm = document.getElementById('videoUploadForm');
    const resetUploadForm = document.getElementById('resetUploadForm');
    const toggleUploadForm = document.getElementById('toggleUploadForm');
    
    if (toggleUploadForm) {
        toggleUploadForm.addEventListener('click', function() {
            document.getElementById('adminUploadSection').style.display = 'none';
            resetUploadFormFields();
        });
    }
    
    if (videoUploadForm) {
        videoUploadForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log('✅ Video upload form submitted');
            await handleVideoUpload();
        });
    }
    
    if (resetUploadForm) {
        resetUploadForm.addEventListener('click', function() {
            console.log('Resetting upload form');
            resetUploadFormFields();
        });
    }
    
    // Add GitHub link validation on input
    const linkInputs = [
        'notesLink',
        'assignmentLink',
        'codeLink',
        'thumbnailLink'
    ];
    
    linkInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('blur', function() {
                validateGitHubLink(this);
            });
        }
    });
}

function initVideoEditForm() {
    console.log('Initializing video edit form...');
    
    const editVideoForm = document.getElementById('editVideoForm');
    const toggleEditForm = document.getElementById('toggleEditForm');
    const resetEditForm = document.getElementById('resetEditForm');
    const deleteVideoBtn = document.getElementById('deleteVideoBtn');
    
    // Toggle edit form
    if (toggleEditForm) {
        toggleEditForm.addEventListener('click', function() {
            document.getElementById('editVideoSection').style.display = 'none';
            resetEditFormFields();
        });
    }
    
    // Reset edit form
    if (resetEditForm) {
        resetEditForm.addEventListener('click', function() {
            const videoIndex = document.getElementById('editVideoIndex').value;
            if (videoIndex) {
                loadVideoIntoEditForm(parseInt(videoIndex));
            }
        });
    }
    
    // Delete video button
    if (deleteVideoBtn) {
        deleteVideoBtn.addEventListener('click', function() {
            const videoIndex = document.getElementById('editVideoIndex').value;
            if (videoIndex) {
                openDeleteVideoModal(parseInt(videoIndex));
            }
        });
    }
    
    // Edit form submission
    if (editVideoForm) {
        editVideoForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log('Video edit form submitted');
            await handleVideoEdit();
        });
    }
}

function initDeleteModal() {
    console.log('Initializing delete modal...');
    
    const deleteModal = document.getElementById('deleteConfirmModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteVideoBtn');
    
    // Close modal buttons
    if (closeDeleteModal) {
        closeDeleteModal.addEventListener('click', function() {
            deleteModal.classList.remove('active');
        });
    }
    
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', function() {
            deleteModal.classList.remove('active');
        });
    }
    
    // Close modal on outside click
    if (deleteModal) {
        deleteModal.addEventListener('click', function(event) {
            if (event.target === deleteModal) {
                deleteModal.classList.remove('active');
            }
        });
    }
    
    // Close modal on escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            if (deleteModal) deleteModal.classList.remove('active');
        }
    });
}

function initEventListeners() {
    // Refresh playlist button
    const refreshBtn = document.getElementById('refreshPlaylist');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log('Refresh playlist clicked');
            loadCourseData();
            showToast('Playlist refreshed', 'success');
        });
    }
    
    // Handle page visibility change
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && window.currentCourseId) {
            // Page became visible again, refresh data if needed
            console.log('Page visible, refreshing course data...');
            loadCourseData();
        }
    });
}

async function handleVideoUpload() {
    console.log('🚀 Starting handleVideoUpload function...');
    
    // Check admin status via session
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        console.error('❌ Admin access required but not admin');
        showToast('Admin access required. Please log in as admin.', 'error');
        return;
    }
    
    console.log('✅ Admin check passed');
    
    // Get form values
    const videoTitle = document.getElementById('videoTitle').value.trim();
    const videoDescription = document.getElementById('videoDescription').value.trim();
    const youtubeUrl = document.getElementById('youtubeUrl').value.trim();
    const notesLink = document.getElementById('notesLink').value.trim();
    const assignmentLink = document.getElementById('assignmentLink').value.trim();
    const codeLink = document.getElementById('codeLink').value.trim();
    const thumbnailLink = document.getElementById('thumbnailLink').value.trim();
    
    console.log('Form values:', { videoTitle, videoDescription, youtubeUrl, notesLink, assignmentLink, codeLink, thumbnailLink });
    
    // Validate required fields
    if (!videoTitle || !videoDescription || !youtubeUrl) {
        console.error('❌ Missing required fields');
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Validate YouTube URL
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
        console.error('❌ Invalid YouTube URL:', youtubeUrl);
        showToast('Please enter a valid YouTube URL or video ID', 'error');
        return;
    }
    
    console.log('✅ YouTube URL validated');
    
    // Validate GitHub links (optional but must be valid URLs if provided)
    if (notesLink && !isValidGitHubLink(notesLink)) {
        showToast('Please enter a valid GitHub URL for Notes', 'error');
        return;
    }
    
    if (assignmentLink && !isValidGitHubLink(assignmentLink)) {
        showToast('Please enter a valid GitHub URL for Assignment', 'error');
        return;
    }
    
    if (codeLink && !isValidGitHubLink(codeLink)) {
        showToast('Please enter a valid GitHub URL for Code', 'error');
        return;
    }
    
    if (thumbnailLink && !isValidGitHubLink(thumbnailLink)) {
        showToast('Please enter a valid GitHub URL for Thumbnail', 'error');
        return;
    }
    
    // Get current course ID
    const courseId = window.currentCourseId || sessionStorage.getItem('activeCourseId');
    if (!courseId) {
        console.error('❌ No active course ID found');
        showToast('No active course found', 'error');
        return;
    }
    
    console.log('✅ Course ID found:', courseId);
    
    // Show loading state
    const submitBtn = document.getElementById('uploadVideoBtn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    submitBtn.disabled = true;
    
    try {
        if (!window.firebaseDb) {
            throw new Error('Firebase not ready');
        }
        
        console.log('✅ Firebase Firestore is ready');
        
        // Get current course
        const docRef = window.firebaseDb.collection('courses').doc(courseId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            throw new Error('Course not found');
        }
        
        const course = { id: doc.id, ...doc.data() };
        console.log('✅ Course found:', course.title);
        
        // Create video object with GitHub links
        const newVideo = {
            videoId: Date.now().toString(),
            title: videoTitle,
            description: videoDescription,
            youtubeUrl: youtubeUrl,
            notesLink: notesLink || "",
            assignmentLink: assignmentLink || "",
            codeLink: codeLink || "",
            thumbnailLink: thumbnailLink || "",
            uploadedAt: new Date().toISOString(),
            uploadedBy: sessionStorage.getItem('adminUid') || 'unknown',
            uploadedByEmail: sessionStorage.getItem('adminEmail') || 'unknown',
            order: (course.videos || []).length + 1
        };
        
        console.log('✅ Video object created:', newVideo);
        
        // Add video to course
        const updatedVideos = [...(course.videos || []), newVideo];
        
        // Update course in Firestore
        console.log('Updating Firestore...');
        await docRef.update({
            videos: updatedVideos,
            updatedAt: new Date().toISOString(),
            lastVideoAdded: new Date().toISOString()
        });
        
        console.log('✅ Firestore updated successfully');
        
        // Success
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Added!';
        
        setTimeout(() => {
            // Reset form
            resetUploadFormFields();
            
            // Hide form
            document.getElementById('adminUploadSection').style.display = 'none';
            
            // Reset button
            setTimeout(() => {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }, 500);
            
            showToast('Video added successfully', 'success');
            
            // Reload course data
            loadCourseData();
        }, 500);
        
    } catch (error) {
        console.error('❌ Error adding video:', error);
        
        // Reset button
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        
        showToast('Error adding video: ' + error.message, 'error');
    }
}

function resetUploadFormFields() {
    console.log('Resetting upload form fields');
    
    // Reset form inputs
    const formInputs = [
        'videoTitle',
        'videoDescription',
        'youtubeUrl',
        'notesLink',
        'assignmentLink',
        'codeLink',
        'thumbnailLink'
    ];
    
    formInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
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

async function loadVideoIntoEditForm(videoIndex) {
    console.log('Loading video into edit form:', videoIndex);
    
    if (!window.currentCourse || !window.currentCourse.videos) {
        showToast('No course data loaded', 'error');
        return;
    }
    
    const videos = window.currentCourse.videos || [];
    if (videoIndex < 0 || videoIndex >= videos.length) {
        showToast('Video not found', 'error');
        return;
    }
    
    const video = videos[videoIndex];
    
    // Set form values
    document.getElementById('editVideoIndex').value = videoIndex;
    document.getElementById('editVideoId').value = video.videoId || video.id;
    document.getElementById('editVideoTitle').value = video.title || '';
    document.getElementById('editVideoDescription').value = video.description || '';
    document.getElementById('editYoutubeUrl').value = video.youtubeUrl || video.url || '';
    document.getElementById('editNotesLink').value = video.notesLink || '';
    document.getElementById('editAssignmentLink').value = video.assignmentLink || '';
    document.getElementById('editCodeLink').value = video.codeLink || '';
    document.getElementById('editThumbnailLink').value = video.thumbnailLink || '';
    
    // Show current links
    showCurrentLink('notes', video.notesLink);
    showCurrentLink('assignment', video.assignmentLink);
    showCurrentLink('code', video.codeLink);
    
    // Show delete button
    document.getElementById('deleteVideoBtn').style.display = 'flex';
    
    // Show edit form
    document.getElementById('editVideoSection').style.display = 'block';
    document.getElementById('adminUploadSection').style.display = 'none';
    
    // Scroll to form
    document.getElementById('editVideoSection').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showCurrentLink(type, link) {
    const infoDiv = document.getElementById(`current${type.charAt(0).toUpperCase() + type.slice(1)}Info`);
    
    if (!infoDiv) return;
    
    if (link && link.trim() !== "") {
        infoDiv.style.display = 'block';
        infoDiv.innerHTML = `
            <div class="current-link-info">
                <i class="fab fa-github"></i>
                <div class="link-info">
                    <strong>Current ${type} link:</strong>
                    <small>${getGithubLinkDisplay(link)}</small>
                    <a href="${link}" target="_blank" class="view-link">
                        <i class="fas fa-external-link-alt"></i> View Link
                    </a>
                </div>
            </div>
        `;
    } else {
        infoDiv.style.display = 'none';
        infoDiv.innerHTML = '';
    }
}

function resetEditFormFields() {
    console.log('Resetting edit form fields');
    
    // Reset form inputs
    document.getElementById('editVideoIndex').value = '';
    document.getElementById('editVideoId').value = '';
    document.getElementById('editVideoTitle').value = '';
    document.getElementById('editVideoDescription').value = '';
    document.getElementById('editYoutubeUrl').value = '';
    document.getElementById('editNotesLink').value = '';
    document.getElementById('editAssignmentLink').value = '';
    document.getElementById('editCodeLink').value = '';
    document.getElementById('editThumbnailLink').value = '';
    
    // Hide current link info
    ['currentNotesInfo', 'currentAssignmentInfo', 'currentCodeInfo'].forEach(id => {
        const info = document.getElementById(id);
        if (info) info.style.display = 'none';
    });
    
    // Hide delete button
    document.getElementById('deleteVideoBtn').style.display = 'none';
}

function openEditVideoModal(videoIndex) {
    console.log('Opening edit modal for video:', videoIndex);
    
    // Check admin status via session
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }
    
    loadVideoIntoEditForm(videoIndex);
}

async function handleVideoEdit() {
    console.log('Handling video edit...');
    
    // Check admin status via session
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }
    
    const videoIndex = parseInt(document.getElementById('editVideoIndex').value);
    const videoId = document.getElementById('editVideoId').value;
    const videoTitle = document.getElementById('editVideoTitle').value.trim();
    const videoDescription = document.getElementById('editVideoDescription').value.trim();
    const youtubeUrl = document.getElementById('editYoutubeUrl').value.trim();
    const notesLink = document.getElementById('editNotesLink').value.trim();
    const assignmentLink = document.getElementById('editAssignmentLink').value.trim();
    const codeLink = document.getElementById('editCodeLink').value.trim();
    const thumbnailLink = document.getElementById('editThumbnailLink').value.trim();
    
    // Validate
    if (!videoTitle || !videoDescription || !youtubeUrl) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const youtubeId = extractYouTubeId(youtubeUrl);
    if (!youtubeId) {
        showToast('Please enter a valid YouTube URL', 'error');
        return;
    }
    
    if (!window.currentCourse || !window.currentCourse.videos) {
        showToast('No course data loaded', 'error');
        return;
    }
    
    // Validate GitHub links
    if (notesLink && !isValidGitHubLink(notesLink)) {
        showToast('Please enter a valid GitHub URL for Notes', 'error');
        return;
    }
    
    if (assignmentLink && !isValidGitHubLink(assignmentLink)) {
        showToast('Please enter a valid GitHub URL for Assignment', 'error');
        return;
    }
    
    if (codeLink && !isValidGitHubLink(codeLink)) {
        showToast('Please enter a valid GitHub URL for Code', 'error');
        return;
    }
    
    if (thumbnailLink && !isValidGitHubLink(thumbnailLink)) {
        showToast('Please enter a valid GitHub URL for Thumbnail', 'error');
        return;
    }
    
    // Show loading
    const submitBtn = document.getElementById('saveVideoBtn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;
    
    try {
        // Get current video
        const updatedVideos = [...window.currentCourse.videos];
        const videoToUpdate = { ...updatedVideos[videoIndex] };
        
        // Update basic info
        videoToUpdate.title = videoTitle;
        videoToUpdate.description = videoDescription;
        videoToUpdate.youtubeUrl = youtubeUrl;
        videoToUpdate.updatedAt = new Date().toISOString();
        videoToUpdate.updatedBy = sessionStorage.getItem('adminUid');
        
        // Update links (if new link provided, otherwise keep existing)
        if (notesLink !== '') videoToUpdate.notesLink = notesLink;
        if (assignmentLink !== '') videoToUpdate.assignmentLink = assignmentLink;
        if (codeLink !== '') videoToUpdate.codeLink = codeLink;
        if (thumbnailLink !== '') videoToUpdate.thumbnailLink = thumbnailLink;
        
        // Update video in array
        updatedVideos[videoIndex] = videoToUpdate;
        
        // Update in Firestore
        await window.currentCourseRef.update({
            videos: updatedVideos,
            updatedAt: new Date().toISOString()
        });
        
        // Success
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        
        setTimeout(() => {
            document.getElementById('editVideoSection').style.display = 'none';
            
            // Reset button
            setTimeout(() => {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }, 500);
            
            showToast('Video updated successfully', 'success');
            
            // Reload course data
            loadCourseData();
        }, 500);
        
    } catch (error) {
        console.error('Error updating video:', error);
        
        // Reset button
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        
        showToast('Error updating video: ' + error.message, 'error');
    }
}

function openDeleteVideoModal(videoIndex) {
    console.log('Opening delete modal for video:', videoIndex);
    
    // Check admin status via session
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }
    
    if (!window.currentCourse || !window.currentCourse.videos) {
        showToast('No course data loaded', 'error');
        return;
    }
    
    const videos = window.currentCourse.videos || [];
    if (videoIndex < 0 || videoIndex >= videos.length) {
        showToast('Video not found', 'error');
        return;
    }
    
    const video = videos[videoIndex];
    
    // Update modal content
    const deleteVideoInfo = document.getElementById('deleteVideoInfo');
    deleteVideoInfo.innerHTML = `
        <div class="delete-item-details">
            <h5>${escapeHtml(video.title)}</h5>
            <p>${escapeHtml(video.description || 'No description')}</p>
            <div class="delete-meta">
                <span><i class="fas fa-calendar"></i> ${video.uploadedAt ? new Date(video.uploadedAt).toLocaleDateString() : 'Unknown date'}</span>
                ${video.uploadedByEmail ? `<span><i class="fas fa-user"></i> ${video.uploadedByEmail}</span>` : ''}
                ${video.notesLink ? `<span><i class="fab fa-github"></i> Has Notes</span>` : ''}
                ${video.assignmentLink ? `<span><i class="fab fa-github"></i> Has Assignment</span>` : ''}
                ${video.codeLink ? `<span><i class="fab fa-github"></i> Has Code</span>` : ''}
            </div>
        </div>
    `;
    
    // Set up confirm delete button
    const confirmDeleteBtn = document.getElementById('confirmDeleteVideoBtn');
    confirmDeleteBtn.onclick = async function() {
        await deleteVideo(videoIndex);
        document.getElementById('deleteConfirmModal').classList.remove('active');
    };
    
    // Show modal
    document.getElementById('deleteConfirmModal').classList.add('active');
}

async function deleteVideo(videoIndex) {
    console.log('Deleting video:', videoIndex);
    
    // Check admin status via session
    const isAdmin = sessionStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        showToast('Admin access required', 'error');
        return;
    }
    
    if (!window.currentCourse || !window.currentCourse.videos) {
        showToast('No course data loaded', 'error');
        return;
    }
    
    const videos = window.currentCourse.videos || [];
    if (videoIndex < 0 || videoIndex >= videos.length) {
        showToast('Video not found', 'error');
        return;
    }
    
    const video = videos[videoIndex];
    
    // Show loading
    const deleteBtn = document.getElementById('confirmDeleteVideoBtn');
    const originalBtnText = deleteBtn.innerHTML;
    deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    deleteBtn.disabled = true;
    
    try {
        // Remove video from array
        const updatedVideos = [...videos];
        updatedVideos.splice(videoIndex, 1);
        
        // Update in Firestore
        await window.currentCourseRef.update({
            videos: updatedVideos,
            updatedAt: new Date().toISOString()
        });
        
        // Success
        deleteBtn.innerHTML = '<i class="fas fa-check"></i> Deleted!';
        
        setTimeout(() => {
            document.getElementById('deleteConfirmModal').classList.remove('active');
            
            // Reset button
            setTimeout(() => {
                deleteBtn.innerHTML = originalBtnText;
                deleteBtn.disabled = false;
            }, 500);
            
            showToast('Video deleted successfully', 'success');
            
            // Reload course data
            loadCourseData();
        }, 500);
        
    } catch (error) {
        console.error('Error deleting video:', error);
        
        // Reset button
        deleteBtn.innerHTML = originalBtnText;
        deleteBtn.disabled = false;
        
        showToast('Error deleting video: ' + error.message, 'error');
    }
}

function viewResource(type) {
    console.log('Viewing resource:', type);
    
    if (!window.currentVideo || !window.currentVideo[`${type}Link`]) {
        showToast(`${type} link not available`, 'error');
        return;
    }
    
    const link = window.currentVideo[`${type}Link`];
    
    // Open GitHub link in new tab
    window.open(link, '_blank');
}

function downloadResource(type) {
    console.log('Downloading resource:', type);
    
    if (!window.currentVideo || !window.currentVideo[`${type}Link`]) {
        showToast(`${type} link not available`, 'error');
        return;
    }
    
    const link = window.currentVideo[`${type}Link`];
    
    // For GitHub raw files, we can try to download directly
    if (link.includes('raw.githubusercontent.com')) {
        // Create download link for raw GitHub content
        const linkElement = document.createElement('a');
        linkElement.href = link;
        
        // Try to extract filename from URL
        const urlParts = link.split('/');
        const filename = urlParts[urlParts.length - 1];
        linkElement.download = filename || `${type}.txt`;
        
        document.body.appendChild(linkElement);
        linkElement.click();
        document.body.removeChild(linkElement);
    } else {
        // For regular GitHub links, just open in new tab
        window.open(link, '_blank');
        showToast('Opening GitHub page. Use the "Download" button on GitHub to download files.', 'info');
    }
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

// Global functions for onclick handlers
window.viewResource = viewResource;
window.downloadResource = downloadResource;
window.openEditVideoModal = openEditVideoModal;
window.openDeleteVideoModal = openDeleteVideoModal;

// Export for global use
window.CodeNirvahana = window.CodeNirvahana || {};
window.CodeNirvahana.courseDetail = {
    loadCourseData: loadCourseData,
    showToast: showToast
};

console.log('✅ Course detail module loaded - GitHub Links Edition');