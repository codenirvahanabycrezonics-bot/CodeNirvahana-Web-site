// Notes Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Check Firebase initialization
    if (!firebase.apps.length) {
        console.error('Firebase not initialized');
        showToast('Firebase not initialized. Please refresh the page.', 'error');
        return;
    }
    
    // Initialize notes page
    initNotesPage();
});

// Initialize notes page
function initNotesPage() {
    // Set up event listeners
    setupEventListeners();
    
    // Initialize mobile menu
    initMobileMenu();
    
    // Load notes
    loadNotes();
    
    // Initialize modals
    initUploadNotesModal();
    initEditNotesModal();
    initDeleteNotesModal();
    
    // Initialize search
    initSearch();
    
    // Check admin status and update UI
    updateAdminUI();
    
    // Initialize load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreNotes);
    }
}

// Initialize mobile menu (reused from index.js)
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

// Set up event listeners
function setupEventListeners() {
    // Close modal on outside click
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.classList.remove('active');
                resetUploadForm();
            }
        });
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            modals.forEach(modal => {
                modal.classList.remove('active');
                resetUploadForm();
            });
        }
    });
    
    // Prevent form submission on enter key in search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
            }
        });
    }
}

// Load notes from all courses in Firestore - OPTIMIZED VERSION
async function loadNotes(searchQuery = '') {
    const notesGrid = document.getElementById('notesGrid');
    const emptyState = document.getElementById('emptyState');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    
    if (!notesGrid || !emptyState) return;
    
    try {
        // Show loading state
        notesGrid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
        emptyState.style.display = 'none';
        if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
        
        const db = window.firebaseDb;
        
        // Cache courses for better performance
        if (!window.coursesCache || window.coursesCache.expiry < Date.now()) {
            const coursesSnapshot = await db.collection('courses').get();
            window.coursesCache = {
                data: coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                expiry: Date.now() + 30000 // Cache for 30 seconds
            };
        }
        
        const courses = window.coursesCache.data;
        
        // Collect all notes from all courses
        let allNotes = [];
        
        courses.forEach(course => {
            if (course.notes && course.notes.length > 0) {
                course.notes.forEach((note, noteIndex) => {
                    // Validate note structure
                    if (note && note.name) {
                        allNotes.push({
                            ...note,
                            courseId: course.id,
                            noteIndex: noteIndex,
                            courseTitle: course.title || 'Untitled Course'
                        });
                    }
                });
            }
        });
        
        // Filter notes by search query if provided
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            allNotes = allNotes.filter(note => 
                note.name.toLowerCase().includes(query) ||
                (note.description && note.description.toLowerCase().includes(query)) ||
                (note.courseTitle && note.courseTitle.toLowerCase().includes(query))
            );
        }
        
        // Store all notes for pagination
        window.allNotes = allNotes;
        window.currentNotesPage = 0;
        window.notesPerPage = 6;
        
        // Clear grid before displaying
        notesGrid.innerHTML = '';
        
        if (allNotes.length === 0) {
            // Show empty state
            emptyState.style.display = 'block';
            notesGrid.appendChild(emptyState);
            if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
        } else {
            // Hide empty state
            emptyState.style.display = 'none';
            
            // Show initial notes
            displayNotesPage(0);
            
            // Show/hide load more button
            if (loadMoreContainer) {
                if (allNotes.length > window.notesPerPage) {
                    loadMoreContainer.classList.remove('hidden');
                } else {
                    loadMoreContainer.classList.add('hidden');
                }
            }
        }
    } catch (error) {
        console.error('Error loading notes:', error);
        showToast('Error loading notes. Please try again.', 'error');
        
        // Show empty state on error
        notesGrid.innerHTML = '';
        emptyState.style.display = 'block';
        notesGrid.appendChild(emptyState);
        if (loadMoreContainer) loadMoreContainer.classList.add('hidden');
    }
}

// Display a page of notes
function displayNotesPage(page) {
    const notesGrid = document.getElementById('notesGrid');
    const allNotes = window.allNotes || [];
    const notesPerPage = window.notesPerPage || 6;
    
    const startIndex = page * notesPerPage;
    const endIndex = Math.min(startIndex + notesPerPage, allNotes.length);
    const pageNotes = allNotes.slice(startIndex, endIndex);
    
    // Add notes to grid
    pageNotes.forEach(note => {
        const noteCard = createNoteCard(note);
        notesGrid.appendChild(noteCard);
    });
    
    window.currentNotesPage = page;
    
    // Update load more button visibility
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (loadMoreContainer) {
        if (endIndex < allNotes.length) {
            loadMoreContainer.classList.remove('hidden');
            // Scroll to show load more button if needed
            setTimeout(() => {
                loadMoreContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        } else {
            loadMoreContainer.classList.add('hidden');
        }
    }
}

// Load more notes
function loadMoreNotes() {
    const nextPage = window.currentNotesPage + 1;
    displayNotesPage(nextPage);
}

// Create a note card element
function createNoteCard(note) {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.noteId = note.id;
    card.dataset.courseId = note.courseId;
    card.dataset.noteIndex = note.noteIndex;
    
    // Validate and format data
    const noteName = escapeHtml(note.name || 'Unnamed Note');
    const noteDescription = escapeHtml(note.description || 'No description provided.');
    const courseTitle = escapeHtml(note.courseTitle || 'Unknown Course');
    
    // Format date
    let noteDate = 'Recently added';
    if (note.uploadedAt) {
        try {
            noteDate = new Date(note.uploadedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            noteDate = 'Date unknown';
        }
    }
    
    // Format file size
    const fileSize = note.size ? formatFileSize(note.size) : 'Size unknown';
    
    // Check if user is admin
    const isAdmin = checkAdminStatus();
    
    card.innerHTML = `
        <div class="note-card-header">
            ${isAdmin ? `
                <div class="note-card-actions">
                    <button class="action-btn edit-btn" aria-label="Edit note" onclick="openEditNotesModal('${note.courseId}', ${note.noteIndex})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" aria-label="Delete note" onclick="openDeleteNotesModal('${note.courseId}', ${note.noteIndex})">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            ` : ''}
            
            <div class="note-card-icon">
                <i class="fas fa-file-alt"></i>
            </div>
            
            <h3 class="note-card-title">${noteName}</h3>
            <p class="note-card-description">${noteDescription}</p>
            
            <a href="course-details.html" class="note-card-course" onclick="localStorage.setItem('activeCourseId', '${note.courseId}')">
                <i class="fas fa-graduation-cap"></i>
                ${courseTitle}
            </a>
        </div>
        
        <div class="note-card-footer">
            <div class="note-meta">
                <div class="note-date">
                    <i class="far fa-calendar"></i>
                    ${noteDate}
                </div>
                <div class="note-size">
                    <i class="fas fa-file"></i>
                    ${fileSize}
                </div>
            </div>
            
            <div class="note-card-cta">
                <a href="course-details.html" class="btn btn-secondary" onclick="localStorage.setItem('activeCourseId', '${note.courseId}')">
                    <i class="fas fa-external-link-alt"></i>
                    View Course
                </a>
                <button class="btn btn-primary" onclick="downloadNote('${note.courseId}', ${note.noteIndex})" aria-label="Download ${noteName}">
                    <i class="fas fa-download"></i>
                    Download
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// Check if user is admin
function checkAdminStatus() {
    try {
        const authUserId = localStorage.getItem('authUserId');
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        return !!(authUserId && isAdmin);
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

// Update UI based on admin status
function updateAdminUI() {
    const isAdmin = checkAdminStatus();
    const adminActionsContainer = document.getElementById('adminActionsContainer');
    
    if (!adminActionsContainer) return;
    
    if (isAdmin) {
        adminActionsContainer.innerHTML = `
            <button class="btn btn-primary" id="uploadNotesBtn" aria-label="Upload new notes">
                <i class="fas fa-plus-circle"></i>
                Upload Notes
            </button>
        `;
        
        // Add event listener to the button
        const uploadNotesBtn = document.getElementById('uploadNotesBtn');
        if (uploadNotesBtn) {
            uploadNotesBtn.addEventListener('click', openUploadNotesModal);
        }
    } else {
        adminActionsContainer.innerHTML = '';
    }
}

// Initialize upload notes modal
function initUploadNotesModal() {
    const uploadNotesModal = document.getElementById('uploadNotesModal');
    const closeUploadNotesModal = document.getElementById('closeUploadNotesModal');
    const cancelUploadNotesModal = document.getElementById('cancelUploadNotesModal');
    const uploadNotesForm = document.getElementById('uploadNotesForm');
    const notesFileInput = document.getElementById('notesFile');
    
    if (closeUploadNotesModal) {
        closeUploadNotesModal.addEventListener('click', function() {
            uploadNotesModal.classList.remove('active');
            resetUploadForm();
        });
    }
    
    if (cancelUploadNotesModal) {
        cancelUploadNotesModal.addEventListener('click', function() {
            uploadNotesModal.classList.remove('active');
            resetUploadForm();
        });
    }
    
    if (uploadNotesForm) {
        uploadNotesForm.addEventListener('submit', handleUploadNotesSubmit);
    }
    
    if (notesFileInput) {
        notesFileInput.addEventListener('change', updateNotesFilePreview);
    }
}

// Handle upload notes form submission
async function handleUploadNotesSubmit(event) {
    event.preventDefault();
    await handleNotesUpload();
}

// Initialize edit notes modal
function initEditNotesModal() {
    const editNotesModal = document.getElementById('editNotesModal');
    const closeEditNotesModal = document.getElementById('closeEditNotesModal');
    const cancelEditNotesModal = document.getElementById('cancelEditNotesModal');
    const editNotesForm = document.getElementById('editNotesForm');
    const editNotesFileInput = document.getElementById('editNotesFile');
    
    if (closeEditNotesModal) {
        closeEditNotesModal.addEventListener('click', function() {
            editNotesModal.classList.remove('active');
            resetUploadForm();
        });
    }
    
    if (cancelEditNotesModal) {
        cancelEditNotesModal.addEventListener('click', function() {
            editNotesModal.classList.remove('active');
            resetUploadForm();
        });
    }
    
    if (editNotesForm) {
        editNotesForm.addEventListener('submit', handleEditNotesSubmit);
    }
    
    if (editNotesFileInput) {
        editNotesFileInput.addEventListener('change', updateEditNotesFilePreview);
    }
}

// Handle edit notes form submission
async function handleEditNotesSubmit(event) {
    event.preventDefault();
    await handleNotesEdit();
}

// Initialize delete notes modal
function initDeleteNotesModal() {
    const deleteNotesModal = document.getElementById('deleteNotesModal');
    const closeDeleteNotesModal = document.getElementById('closeDeleteNotesModal');
    const cancelDeleteNotesBtn = document.getElementById('cancelDeleteNotesBtn');
    
    if (closeDeleteNotesModal) {
        closeDeleteNotesModal.addEventListener('click', function() {
            deleteNotesModal.classList.remove('active');
        });
    }
    
    if (cancelDeleteNotesBtn) {
        cancelDeleteNotesBtn.addEventListener('click', function() {
            deleteNotesModal.classList.remove('active');
        });
    }
}

// Initialize search functionality
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (searchInput) {
        // Search on input with debounce
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const query = searchInput.value.trim();
                loadNotes(query);
            }, 300);
        });
        
        // Clear search
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', function() {
                searchInput.value = '';
                loadNotes('');
                searchInput.focus();
            });
        }
    }
}

// Open upload notes modal
async function openUploadNotesModal() {
    if (!checkAdminStatus()) {
        showAuthModal();
        return;
    }
    
    const uploadNotesModal = document.getElementById('uploadNotesModal');
    const notesCourseSelect = document.getElementById('notesCourse');
    
    try {
        // Populate course dropdown
        await populateCourseDropdown(notesCourseSelect);
        
        // Show modal
        uploadNotesModal.classList.add('active');
        
        // Focus on first input
        setTimeout(() => {
            const titleInput = document.getElementById('notesTitle');
            if (titleInput) titleInput.focus();
        }, 100);
    } catch (error) {
        console.error('Error opening upload modal:', error);
        showToast('Error loading courses', 'error');
    }
}

// Open edit notes modal
async function openEditNotesModal(courseId, noteIndex) {
    if (!checkAdminStatus()) {
        showAuthModal();
        return;
    }
    
    try {
        const db = window.firebaseDb;
        const courseDoc = await db.collection('courses').doc(courseId).get();
        
        if (!courseDoc.exists) {
            showToast('Course not found', 'error');
            return;
        }
        
        const course = { id: courseDoc.id, ...courseDoc.data() };
        
        if (!course.notes || noteIndex < 0 || noteIndex >= course.notes.length) {
            showToast('Notes not found', 'error');
            return;
        }
        
        const note = course.notes[noteIndex];
        const editNotesModal = document.getElementById('editNotesModal');
        const editNotesCourseSelect = document.getElementById('editNotesCourse');
        
        // Populate course dropdown
        await populateCourseDropdown(editNotesCourseSelect, courseId);
        
        // Set form values
        document.getElementById('editNotesId').value = note.id || '';
        document.getElementById('editCourseId').value = courseId;
        document.getElementById('editNotesIndex').value = noteIndex;
        document.getElementById('editNotesTitle').value = note.name || '';
        document.getElementById('editNotesDescription').value = note.description || '';
        
        // Set current file preview
        const currentNotesPreview = document.getElementById('currentNotesPreview');
        currentNotesPreview.innerHTML = `
            <div class="file-preview-content">
                <div class="file-preview-icon">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <div class="file-preview-info">
                    <div class="file-preview-name">${escapeHtml(note.name || 'Unnamed')}</div>
                    <div class="file-preview-size">${note.size ? formatFileSize(note.size) : 'Size unknown'}</div>
                </div>
            </div>
        `;
        
        // Show modal
        editNotesModal.classList.add('active');
        
        // Focus on title input
        setTimeout(() => {
            const titleInput = document.getElementById('editNotesTitle');
            if (titleInput) titleInput.focus();
        }, 100);
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showToast('Error loading note details', 'error');
    }
}

// Open delete notes modal
async function openDeleteNotesModal(courseId, noteIndex) {
    if (!checkAdminStatus()) {
        showAuthModal();
        return;
    }
    
    try {
        const db = window.firebaseDb;
        const courseDoc = await db.collection('courses').doc(courseId).get();
        
        if (!courseDoc.exists) {
            showToast('Course not found', 'error');
            return;
        }
        
        const course = { id: courseDoc.id, ...courseDoc.data() };
        
        if (!course.notes || noteIndex < 0 || noteIndex >= course.notes.length) {
            showToast('Notes not found', 'error');
            return;
        }
        
        const note = course.notes[noteIndex];
        const deleteNotesModal = document.getElementById('deleteNotesModal');
        const deleteNotesName = document.getElementById('deleteNotesName');
        const confirmDeleteNotesBtn = document.getElementById('confirmDeleteNotesBtn');
        
        // Set notes name for confirmation
        deleteNotesName.textContent = note.name || 'Unnamed Note';
        
        // Remove any existing event listener
        const newConfirmBtn = confirmDeleteNotesBtn.cloneNode(true);
        confirmDeleteNotesBtn.parentNode.replaceChild(newConfirmBtn, confirmDeleteNotesBtn);
        
        // Set up confirm delete button
        newConfirmBtn.onclick = function() {
            deleteNote(courseId, noteIndex);
        };
        
        // Show modal
        deleteNotesModal.classList.add('active');
    } catch (error) {
        console.error('Error opening delete modal:', error);
        showToast('Error loading note details', 'error');
    }
}

// Populate course dropdown
async function populateCourseDropdown(selectElement, selectedCourseId = null) {
    try {
        const db = window.firebaseDb;
        const coursesSnapshot = await db.collection('courses').get();
        
        // Clear existing options except the first one
        while (selectElement.options.length > 1) {
            selectElement.remove(1);
        }
        
        // Add course options
        coursesSnapshot.forEach(courseDoc => {
            const course = { id: courseDoc.id, ...courseDoc.data() };
            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = course.title || `Course ${course.id}`;
            if (selectedCourseId && course.id === selectedCourseId) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
        
        // If selected course not found, select first option
        if (selectedCourseId && !selectElement.querySelector(`option[value="${selectedCourseId}"]`)) {
            selectElement.selectedIndex = 0;
        }
    } catch (error) {
        console.error('Error populating course dropdown:', error);
        throw error;
    }
}

// Handle notes upload to Firestore
async function handleNotesUpload() {
    if (!checkAdminStatus()) {
        showAuthModal();
        return;
    }
    
    const notesTitle = document.getElementById('notesTitle').value.trim();
    const notesDescription = document.getElementById('notesDescription').value.trim();
    const notesCourseId = document.getElementById('notesCourse').value;
    const notesFileInput = document.getElementById('notesFile');
    
    // Validation
    if (!notesTitle) {
        showToast('Please enter a title for the notes', 'error');
        document.getElementById('notesTitle').focus();
        return;
    }
    
    if (!notesDescription) {
        showToast('Please enter a description', 'error');
        document.getElementById('notesDescription').focus();
        return;
    }
    
    if (!notesCourseId) {
        showToast('Please select a course', 'error');
        return;
    }
    
    if (!notesFileInput.files || notesFileInput.files.length === 0) {
        showToast('Please select a file to upload', 'error');
        return;
    }
    
    const file = notesFileInput.files[0];
    
    if (!file.type.includes('pdf')) {
        showToast('Only PDF files are supported', 'error');
        return;
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showToast('File size must be less than 10MB', 'error');
        return;
    }
    
    // Validate file name
    if (file.name.length > 200) {
        showToast('File name is too long', 'error');
        return;
    }
    
    try {
        const db = window.firebaseDb;
        const courseDoc = await db.collection('courses').doc(notesCourseId).get();
        
        if (!courseDoc.exists) {
            showToast('Selected course not found', 'error');
            return;
        }
        
        const course = { id: courseDoc.id, ...courseDoc.data() };
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const newNote = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    name: notesTitle,
                    description: notesDescription,
                    data: e.target.result,
                    size: file.size,
                    uploadedAt: new Date().toISOString(),
                    fileName: file.name
                };
                
                // Add note to course's notes array
                if (!Array.isArray(course.notes)) {
                    course.notes = [];
                }
                
                course.notes.push(newNote);
                
                // Update course in Firestore
                await db.collection('courses').doc(notesCourseId).update({
                    notes: course.notes,
                    updatedAt: new Date().toISOString()
                });
                
                // Close modal and reset form
                document.getElementById('uploadNotesModal').classList.remove('active');
                resetUploadForm();
                
                // Show success message
                showToast('Notes uploaded successfully', 'success');
                
                // Clear cache and reload notes
                delete window.coursesCache;
                loadNotes();
            } catch (error) {
                console.error('Error saving notes:', error);
                showToast('Error saving notes: ' + error.message, 'error');
            }
        };
        
        reader.onerror = function() {
            showToast('Error reading file', 'error');
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error uploading notes:', error);
        showToast('Error uploading notes: ' + error.message, 'error');
    }
}

// Handle notes edit in Firestore
async function handleNotesEdit() {
    if (!checkAdminStatus()) {
        showAuthModal();
        return;
    }
    
    const noteId = document.getElementById('editNotesId').value;
    const courseId = document.getElementById('editCourseId').value;
    const noteIndex = parseInt(document.getElementById('editNotesIndex').value);
    const newCourseId = document.getElementById('editNotesCourse').value;
    const notesTitle = document.getElementById('editNotesTitle').value.trim();
    const notesDescription = document.getElementById('editNotesDescription').value.trim();
    const notesFileInput = document.getElementById('editNotesFile');
    
    // Validation
    if (!notesTitle) {
        showToast('Please enter a title for the notes', 'error');
        document.getElementById('editNotesTitle').focus();
        return;
    }
    
    if (!notesDescription) {
        showToast('Please enter a description', 'error');
        document.getElementById('editNotesDescription').focus();
        return;
    }
    
    if (!newCourseId) {
        showToast('Please select a course', 'error');
        return;
    }
    
    try {
        const db = window.firebaseDb;
        
        // Get the current course
        const courseDoc = await db.collection('courses').doc(courseId).get();
        
        if (!courseDoc.exists) {
            showToast('Course not found', 'error');
            return;
        }
        
        const course = { id: courseDoc.id, ...courseDoc.data() };
        
        if (!course.notes || noteIndex < 0 || noteIndex >= course.notes.length) {
            showToast('Notes not found', 'error');
            return;
        }
        
        const note = course.notes[noteIndex];
        
        // Update note properties
        note.name = notesTitle;
        note.description = notesDescription;
        
        // If a new file was selected, update it
        if (notesFileInput.files && notesFileInput.files.length > 0) {
            const file = notesFileInput.files[0];
            
            if (!file.type.includes('pdf')) {
                showToast('Only PDF files are supported', 'error');
                return;
            }
            
            // Check file size (10MB limit)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                showToast('File size must be less than 10MB', 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    note.data = e.target.result;
                    note.size = file.size;
                    note.uploadedAt = new Date().toISOString();
                    note.fileName = file.name;
                    
                    // Move note to new course if course changed
                    if (courseId !== newCourseId) {
                        await moveNoteToNewCourse(db, courseId, noteIndex, newCourseId, note);
                    } else {
                        // Update the note in the current course
                        course.notes[noteIndex] = note;
                        await db.collection('courses').doc(courseId).update({
                            notes: course.notes,
                            updatedAt: new Date().toISOString()
                        });
                        await saveCoursesAndUpdate();
                    }
                } catch (error) {
                    console.error('Error updating file:', error);
                    showToast('Error updating file: ' + error.message, 'error');
                }
            };
            
            reader.onerror = function() {
                showToast('Error reading file', 'error');
            };
            
            reader.readAsDataURL(file);
        } else {
            // Move note to new course if course changed
            if (courseId !== newCourseId) {
                await moveNoteToNewCourse(db, courseId, noteIndex, newCourseId, note);
            } else {
                // Update the note in the current course
                course.notes[noteIndex] = note;
                await db.collection('courses').doc(courseId).update({
                    notes: course.notes,
                    updatedAt: new Date().toISOString()
                });
                await saveCoursesAndUpdate();
            }
        }
    } catch (error) {
        console.error('Error updating notes:', error);
        showToast('Error updating notes: ' + error.message, 'error');
    }
}

// Move note to new course in Firestore
async function moveNoteToNewCourse(db, oldCourseId, noteIndex, newCourseId, note) {
    try {
        // Get the old course
        const oldCourseDoc = await db.collection('courses').doc(oldCourseId).get();
        const oldCourse = { id: oldCourseDoc.id, ...oldCourseDoc.data() };
        
        if (!Array.isArray(oldCourse.notes)) {
            oldCourse.notes = [];
        }
        
        // Remove note from old course
        if (noteIndex >= 0 && noteIndex < oldCourse.notes.length) {
            oldCourse.notes.splice(noteIndex, 1);
        }
        
        // Update old course
        await db.collection('courses').doc(oldCourseId).update({
            notes: oldCourse.notes,
            updatedAt: new Date().toISOString()
        });
        
        // Get the new course
        const newCourseDoc = await db.collection('courses').doc(newCourseId).get();
        const newCourse = { id: newCourseDoc.id, ...newCourseDoc.data() };
        
        // Add note to new course
        if (!Array.isArray(newCourse.notes)) {
            newCourse.notes = [];
        }
        
        newCourse.notes.push(note);
        
        // Update new course
        await db.collection('courses').doc(newCourseId).update({
            notes: newCourse.notes,
            updatedAt: new Date().toISOString()
        });
        
        await saveCoursesAndUpdate();
    } catch (error) {
        console.error('Error moving note:', error);
        throw error;
    }
}

// Save courses and update UI
async function saveCoursesAndUpdate() {
    // Close modal and reset form
    document.getElementById('editNotesModal').classList.remove('active');
    resetUploadForm();
    
    // Show success message
    showToast('Notes updated successfully', 'success');
    
    // Clear cache and reload notes
    delete window.coursesCache;
    loadNotes();
}

// Delete note from Firestore
async function deleteNote(courseId, noteIndex) {
    if (!checkAdminStatus()) {
        showAuthModal();
        return;
    }
    
    try {
        const db = window.firebaseDb;
        const courseDoc = await db.collection('courses').doc(courseId).get();
        
        if (!courseDoc.exists) {
            showToast('Course not found', 'error');
            return;
        }
        
        const course = { id: courseDoc.id, ...courseDoc.data() };
        
        if (!course.notes || noteIndex < 0 || noteIndex >= course.notes.length) {
            showToast('Notes not found', 'error');
            return;
        }
        
        // Get note name for confirmation message
        const noteName = course.notes[noteIndex].name || 'the note';
        
        // Remove note from array
        course.notes.splice(noteIndex, 1);
        
        // Update course in Firestore
        await db.collection('courses').doc(courseId).update({
            notes: course.notes,
            updatedAt: new Date().toISOString()
        });
        
        // Close modal
        document.getElementById('deleteNotesModal').classList.remove('active');
        
        // Show success message
        showToast(`"${noteName}" deleted successfully`, 'success');
        
        // Clear cache and reload notes
        delete window.coursesCache;
        loadNotes();
    } catch (error) {
        console.error('Error deleting notes:', error);
        showToast('Error deleting notes: ' + error.message, 'error');
    }
}

// Download note
async function downloadNote(courseId, noteIndex) {
    try {
        const db = window.firebaseDb;
        const courseDoc = await db.collection('courses').doc(courseId).get();
        
        if (!courseDoc.exists) {
            showToast('Course not found', 'error');
            return;
        }
        
        const course = { id: courseDoc.id, ...courseDoc.data() };
        
        if (!course.notes || noteIndex < 0 || noteIndex >= course.notes.length) {
            showToast('Notes not found', 'error');
            return;
        }
        
        const note = course.notes[noteIndex];
        
        if (!note.data) {
            showToast('File data is missing', 'error');
            return;
        }
        
        // Create download link
        const link = document.createElement('a');
        link.href = note.data;
        link.download = `${note.name.replace(/[^a-z0-9]/gi, '_')}.pdf` || 'notes.pdf';
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(link);
            if (typeof URL.revokeObjectURL === 'function') {
                URL.revokeObjectURL(link.href);
            }
        }, 100);
        
        showToast('Download started', 'success');
    } catch (error) {
        console.error('Error downloading note:', error);
        showToast('Error downloading note: ' + error.message, 'error');
    }
}

// Update notes file preview
function updateNotesFilePreview() {
    const notesFileInput = document.getElementById('notesFile');
    const notesFilePreview = document.getElementById('notesFilePreview');
    
    if (!notesFilePreview) return;
    
    if (notesFileInput.files && notesFileInput.files.length > 0) {
        const file = notesFileInput.files[0];
        
        notesFilePreview.innerHTML = `
            <div class="file-preview-content">
                <div class="file-preview-icon">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <div class="file-preview-info">
                    <div class="file-preview-name">${escapeHtml(file.name)}</div>
                    <div class="file-preview-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
        `;
        notesFilePreview.classList.add('has-file');
    } else {
        notesFilePreview.innerHTML = '';
        notesFilePreview.classList.remove('has-file');
    }
}

// Update edit notes file preview
function updateEditNotesFilePreview() {
    const editNotesFileInput = document.getElementById('editNotesFile');
    const currentNotesPreview = document.getElementById('currentNotesPreview');
    
    if (!currentNotesPreview) return;
    
    if (editNotesFileInput.files && editNotesFileInput.files.length > 0) {
        const file = editNotesFileInput.files[0];
        
        // Update the current file preview
        currentNotesPreview.innerHTML = `
            <div class="file-preview-content">
                <div class="file-preview-icon">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <div class="file-preview-info">
                    <div class="file-preview-name">${escapeHtml(file.name)} (New file)</div>
                    <div class="file-preview-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
        `;
    }
}

// Reset upload form
function resetUploadForm() {
    const forms = ['uploadNotesForm', 'editNotesForm'];
    forms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) form.reset();
    });
    
    const previews = ['notesFilePreview', 'currentNotesPreview'];
    previews.forEach(previewId => {
        const preview = document.getElementById(previewId);
        if (preview) {
            preview.innerHTML = '';
            preview.classList.remove('has-file');
        }
    });
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Show authentication required modal
function showAuthModal() {
    if (typeof window.showAuthModal === 'function') {
        window.showAuthModal();
    } else {
        // Fallback: redirect to admin page
        window.location.href = 'admin.html';
    }
}

// Show toast message
function showToast(message, type = 'info') {
    const toast = document.getElementById('messageToast');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast || !toastMessage) return;
    
    // Set message
    toastMessage.textContent = message;
    
    // Remove existing classes
    toast.className = 'toast';
    
    // Add type class
    toast.classList.add(type);
    
    // Show toast
    toast.classList.add('show');
    
    // Hide after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

// Utility function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions for global use
window.CodeNirvahana = window.CodeNirvahana || {};
window.CodeNirvahana.notes = {
    loadNotes,
    checkAdminStatus,
    refreshNotes: function() {
        delete window.coursesCache;
        loadNotes();
    }
};