/**
 * CodeNirvahana Test System - Google Form Version
 * Production-ready test management system with Google Form integration
 * NO internal test logic - NO questions - NO options
 */

class TestSystem {
    constructor() {
        this.currentUser = null;
        this.tests = [];
        this.isAdmin = false;
        this.currentEditingTestId = null;
        this.searchQuery = '';
        this.currentFilter = 'all';
        
        this.init();
    }

    async init() {
        console.log('📚 Test System initializing...');
        
        try {
            await this.waitForFirebase();
            this.cacheElements();
            this.setupEventListeners();
            this.setupAdminStateListener();
            await this.loadTests();
            console.log('✅ Test System initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Test System:', error);
            this.showToast('Failed to initialize test system. Please refresh the page.', 'error');
        }
    }

    waitForFirebase() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;

            function check() {
                attempts++;
                if (window.firebaseDb && window.firebaseAuth) {
                    console.log('✅ Firebase services ready');
                    resolve();
                    return;
                }
                if (attempts >= maxAttempts) {
                    reject(new Error('Firebase initialization timeout'));
                    return;
                }
                setTimeout(check, 100);
            }
            check();
        });
    }

    cacheElements() {
        this.elements = {
            // Admin controls
            adminControls: document.getElementById('adminControls'),
            addTestBtn: document.getElementById('addTestBtn'),
            logoutAdminBtn: document.getElementById('logoutAdminBtn'),
            createFirstTest: document.getElementById('createFirstTest'),
            
            // Search and filter
            testSearch: document.getElementById('testSearch'),
            clearSearch: document.getElementById('clearSearch'),
            testFilter: document.getElementById('testFilter'),
            refreshTests: document.getElementById('refreshTests'),
            
            // Test display
            testGrid: document.getElementById('testGrid'),
            testCount: document.getElementById('testCount'),
            loadingState: document.getElementById('loadingState'),
            emptyState: document.getElementById('emptyState'),
            
            // Modals
            modals: {
                addTest: document.getElementById('addTestModal'),
                delete: document.getElementById('deleteModal')
            },
            
            // Modal close buttons
            closeAddTest: document.getElementById('closeAddTest'),
            closeDeleteModal: document.getElementById('closeDeleteModal'),
            
            // Add test form elements
            addTestForm: document.getElementById('addTestForm'),
            addTestModalTitle: document.getElementById('addTestModalTitle'),
            testTitle: document.getElementById('testTitle'),
            testDescription: document.getElementById('testDescription'),
            testTimeLimit: document.getElementById('testTimeLimit'),
            testDifficulty: document.getElementById('testDifficulty'),
            cancelTestBtn: document.getElementById('cancelTestBtn'),
            saveTestBtn: document.getElementById('saveTestBtn'),
            
            // Delete modal elements
            deleteTestPreview: document.getElementById('deleteTestPreview'),
            cancelDelete: document.getElementById('cancelDelete'),
            confirmDelete: document.getElementById('confirmDelete')
        };
        
        console.log('🔍 Cached elements:', Object.keys(this.elements).filter(key => this.elements[key]));
    }

    setupEventListeners() {
        // Refresh tests
        if (this.elements.refreshTests) {
            this.elements.refreshTests.addEventListener('click', () => this.loadTests());
        }
        
        // Search
        if (this.elements.testSearch) {
            this.elements.testSearch.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.handleSearch();
            });
        }
        
        if (this.elements.clearSearch) {
            this.elements.clearSearch.addEventListener('click', () => this.clearSearch());
        }
        
        // Filter - For admin only (show draft/published filter)
        if (this.elements.testFilter) {
            this.elements.testFilter.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.handleFilter();
            });
        }
        
        // Create first test (admin only)
        if (this.elements.createFirstTest) {
            this.elements.createFirstTest.addEventListener('click', () => this.showAddTestModal());
        }
        
        // Modal close buttons
        if (this.elements.closeAddTest) {
            this.elements.closeAddTest.addEventListener('click', () => this.closeAddTestModal());
        }
        
        if (this.elements.closeDeleteModal) {
            this.elements.closeDeleteModal.addEventListener('click', () => this.closeDeleteModal());
        }
        
        // Delete modal
        if (this.elements.cancelDelete) {
            this.elements.cancelDelete.addEventListener('click', () => this.closeDeleteModal());
        }
        
        if (this.elements.confirmDelete) {
            this.elements.confirmDelete.addEventListener('click', () => this.deleteTest());
        }
        
        // Modal background click
        Object.values(this.elements.modals).forEach(modal => {
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        const modalName = modal.id.replace('Modal', '').replace('addTest', 'addTest');
                        this.closeModal(modalName);
                    }
                });
            }
        });
        
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                Object.keys(this.elements.modals).forEach(modalName => {
                    const modal = this.elements.modals[modalName];
                    if (modal && modal.classList.contains('active')) {
                        this.closeModal(modalName);
                    }
                });
            }
        });
    }

    setupAdminStateListener() {
        console.log('🔄 Setting up admin state listener...');
        
        // First check session storage for immediate admin status
        const sessionAdmin = sessionStorage.getItem('isAdmin') === 'true';
        if (sessionAdmin) {
            console.log('✅ Session admin found, updating UI immediately');
            this.isAdmin = true;
            this.updateAdminUI();
        }
        
        // Listen for global admin state changes (from firebase-config.js)
        if (window.addAdminStateListener) {
            window.addAdminStateListener((isAdmin, user) => {
                console.log('🌍 Global admin state updated:', { isAdmin, user: user?.email });
                this.currentUser = user;
                this.isAdmin = isAdmin;
                
                // Update session storage for persistence
                if (isAdmin && user) {
                    sessionStorage.setItem('isAdmin', 'true');
                    sessionStorage.setItem('adminUid', user.uid);
                    sessionStorage.setItem('adminEmail', user.email);
                }
                
                this.updateAdminUI();
                this.loadTests();
            });
        }
        
        // Also set up direct auth listener as fallback
        if (window.firebaseAuth) {
            window.firebaseAuth.onAuthStateChanged(async (user) => {
                console.log('🔐 Auth state changed:', user?.email);
                this.currentUser = user;
                
                if (user) {
                    // Check admin status using global function
                    if (window.checkAdminStatus) {
                        this.isAdmin = await window.checkAdminStatus(user.uid);
                        console.log('🔐 Admin status from checkAdminStatus:', this.isAdmin);
                    } else {
                        // Fallback: check session storage
                        this.isAdmin = sessionStorage.getItem('isAdmin') === 'true';
                        console.log('🔐 Admin status from sessionStorage:', this.isAdmin);
                    }
                } else {
                    this.isAdmin = false;
                    // Clear admin session
                    sessionStorage.removeItem('isAdmin');
                    sessionStorage.removeItem('adminUid');
                    sessionStorage.removeItem('adminEmail');
                }
                
                this.updateAdminUI();
                this.loadTests();
            });
        }
        
        // Check current state immediately if already initialized
        if (window.adminState && window.adminState.initialized) {
            console.log('🔍 Admin state already initialized');
            this.isAdmin = window.adminState.isAdmin;
            this.currentUser = window.adminState.user;
            this.updateAdminUI();
        }
    }

    updateAdminUI() {
        console.log('🔄 Updating admin UI, isAdmin:', this.isAdmin);
        
        if (this.isAdmin) {
            console.log('👑 Showing admin controls');
            if (this.elements.adminControls) {
                this.elements.adminControls.classList.remove('hidden');
            }
            
            // Show admin-only filter options
            if (this.elements.testFilter) {
                this.updateFilterOptionsForAdmin();
            }
            
            this.setupAdminEventListeners();
        } else {
            console.log('👤 Hiding admin controls');
            if (this.elements.adminControls) {
                this.elements.adminControls.classList.add('hidden');
            }
            
            // Show only published filter for public users
            if (this.elements.testFilter) {
                this.updateFilterOptionsForPublic();
            }
        }
    }

    updateFilterOptionsForAdmin() {
        // Admin can see all, published, and draft tests
        if (this.elements.testFilter) {
            this.elements.testFilter.innerHTML = `
                <option value="all">All Tests</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
            `;
        }
    }

    updateFilterOptionsForPublic() {
        // Public users can only see published tests
        if (this.elements.testFilter) {
            this.elements.testFilter.innerHTML = `
                <option value="published">Published Tests</option>
            `;
            this.currentFilter = 'published';
        }
    }

    setupAdminEventListeners() {
        // Add test button
        if (this.elements.addTestBtn) {
            this.elements.addTestBtn.removeEventListener('click', this.showAddTestModal);
            this.elements.addTestBtn.addEventListener('click', () => this.showAddTestModal());
        }
        
        // Logout button
        if (this.elements.logoutAdminBtn) {
            this.elements.logoutAdminBtn.removeEventListener('click', this.logoutAdmin);
            this.elements.logoutAdminBtn.addEventListener('click', () => this.logoutAdmin());
        }
        
        // Add test form
        if (this.elements.addTestForm) {
            this.elements.addTestForm.removeEventListener('submit', this.handleAddTestSubmit);
            this.elements.addTestForm.addEventListener('submit', (e) => this.handleAddTestSubmit(e));
        }
        
        // Cancel button
        if (this.elements.cancelTestBtn) {
            this.elements.cancelTestBtn.removeEventListener('click', this.closeAddTestModal);
            this.elements.cancelTestBtn.addEventListener('click', () => this.closeAddTestModal());
        }
    }

    async loadTests() {
        try {
            this.showLoading();
            
            if (!window.firebaseDb) {
                throw new Error('Firebase Firestore not initialized');
            }
            
            console.log('📥 Loading tests from Firestore...');
            console.log('🔐 Current user is admin:', this.isAdmin);
            console.log('👤 Current user:', this.currentUser?.email || 'No user');
            
            let testsData = [];
            
            try {
                // Try to load all tests first
                const snapshot = await window.firebaseDb.collection('tests').get();
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    
                    // For public users, skip if not published
                    if (!this.isAdmin) {
                        if (data.published !== true) {
                            return;
                        }
                    }
                    
                    testsData.push({
                        id: doc.id,
                        title: data.title || 'Untitled Test',
                        description: data.description || '',
                        googleFormLink: data.googleFormLink || data.formLink || '',
                        difficulty: data.difficulty || 'medium',
                        timeLimit: data.timeLimit || null,
                        estimatedTime: data.estimatedTime || null,
                        published: data.published !== false,
                        createdBy: data.createdBy || 'unknown',
                        createdAt: data.createdAt || new Date(),
                        updatedAt: data.updatedAt || new Date()
                    });
                });
                
                // Sort by creation date (newest first)
                testsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
            } catch (queryError) {
                console.error('❌ Query error:', queryError);
                
                // For public users, show empty state gracefully
                if (!this.isAdmin) {
                    console.log('👤 Public user has no permission, showing empty state');
                    this.showEmptyState();
                    return;
                } else {
                    throw queryError;
                }
            }
            
            this.tests = testsData;
            console.log(`📊 Loaded ${this.tests.length} tests for ${this.isAdmin ? 'admin' : 'public'} user`);
            this.renderTests();
            
        } catch (error) {
            console.error('❌ Error loading tests:', error);
            
            if (this.isAdmin) {
                this.showToast('Cannot load tests. Please check Firestore security rules.', 'error');
            }
            
            this.showEmptyState();
        }
    }

    renderTests() {
        if (!this.elements.testGrid) return;
        
        this.elements.testGrid.innerHTML = '';
        
        // Update test count
        if (this.elements.testCount) {
            this.elements.testCount.textContent = `(${this.tests.length})`;
        }
        
        if (this.tests.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideLoading();
        
        // Apply current search and filter
        let filteredTests = this.tests;
        
        // Apply search filter
        if (this.searchQuery) {
            filteredTests = filteredTests.filter(test => 
                test.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                test.description.toLowerCase().includes(this.searchQuery.toLowerCase())
            );
        }
        
        // Apply status filter (for admin only)
        if (this.isAdmin && this.currentFilter !== 'all') {
            if (this.currentFilter === 'published') {
                filteredTests = filteredTests.filter(test => test.published !== false);
            } else if (this.currentFilter === 'draft') {
                filteredTests = filteredTests.filter(test => test.published === false);
            }
        }
        
        // For public users, always show only published
        if (!this.isAdmin) {
            filteredTests = filteredTests.filter(test => test.published !== false);
        }
        
        // Update count for filtered results
        if (this.elements.testCount && (this.searchQuery || (this.isAdmin && this.currentFilter !== 'all'))) {
            this.elements.testCount.textContent = `(${filteredTests.length} of ${this.tests.length})`;
        }
        
        // Show empty state if no tests after filtering
        if (filteredTests.length === 0) {
            this.showEmptyState();
            return;
        }
        
        // Render filtered tests
        filteredTests.forEach(test => {
            const testCard = this.createTestCard(test);
            this.elements.testGrid.appendChild(testCard);
        });
    }

    createTestCard(test) {
        const card = document.createElement('div');
        card.className = 'test-card';
        card.dataset.testId = test.id;
        
        // Format time display
        const timeDisplay = test.timeLimit ? 
            `${test.timeLimit} minutes` : 
            (test.estimatedTime ? `${test.estimatedTime} (estimated)` : 'No time limit');
        
        // Format date
        const date = this.formatDate(test.createdAt);
        
        // Difficulty badge class
        const difficultyClass = `difficulty-${test.difficulty || 'medium'}`;
        
        // Show draft badge for admin if test is not published
        const draftBadge = !test.published && this.isAdmin ? 
            '<span class="test-card-draft"><i class="fas fa-eye-slash"></i> Draft</span>' : '';
        
        // Check if Google Form link is valid
        const hasValidLink = test.googleFormLink && this.isValidGoogleFormLink(test.googleFormLink);
        const linkStatus = hasValidLink ? 
            '<span class="test-card-link-status valid"><i class="fas fa-check-circle"></i> Link Active</span>' :
            '<span class="test-card-link-status invalid"><i class="fas fa-exclamation-circle"></i> Check Link</span>';
        
        card.innerHTML = `
            <div class="test-card-header">
                
                <div class="test-card-meta">
                <i class="fas fa-file-alt" style=" height:30px ; width:30px"> </i>
                    ${draftBadge}
                    <span class="test-card-difficulty ${difficultyClass}">
                        ${this.capitalizeFirstLetter(test.difficulty || 'medium')}
                    </span>

                    ${test.timeLimit ? `<span class="test-card-time"><i class="fas fa-clock"></i> ${timeDisplay}</span>` : ''}
                </div>
                <br>
            </div>
            <div class="test-card-body">
                <h3 class="test-card-title">${this.escapeHtml(test.title)}</h3>
                <p class="test-card-description">${this.escapeHtml(test.description)}</p>
                <br>
                <div class="test-card-stats">
                    ${linkStatus}
                    <span class="test-card-stat">
                        <i class="fas fa-calendar-alt"></i>
                        ${date}
                    </span>
                    <br><br>
                </div>
            </div>
            <div class="test-card-footer">
                <button class="btn btn-primary start-test-btn" data-id="${test.id}" ${!hasValidLink ? 'disabled' : ''}>
                    <i class="fas fa-external-link-alt"></i>
                    Open Google Form
                </button>
                ${this.isAdmin ? `
                    <div class="admin-actions">
                        <button class="btn btn-icon edit-test-btn" data-id="${test.id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-icon delete-test-btn" data-id="${test.id}" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Add event listeners
        const startBtn = card.querySelector('.start-test-btn');
        if (hasValidLink) {
            startBtn.addEventListener('click', () => this.openGoogleForm(test));
        }
        
        if (this.isAdmin) {
            const editBtn = card.querySelector('.edit-test-btn');
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editTest(test.id);
            });
            
            const deleteBtn = card.querySelector('.delete-test-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showDeleteConfirmation(test);
            });
        }
        
        return card;
    }

    openGoogleForm(test) {
        if (!test.googleFormLink) {
            this.showToast('Google Form link is not available for this test.', 'error');
            return;
        }
        
        if (!this.isValidGoogleFormLink(test.googleFormLink)) {
            this.showToast('Invalid Google Form link. Please contact administrator.', 'error');
            return;
        }
        
        // Open in new tab
        window.open(test.googleFormLink, '_blank', 'noopener,noreferrer');
        
        // Track opening only for logged-in users
        if (this.currentUser) {
            this.trackFormOpen(test.id);
        }
    }

    trackFormOpen(testId) {
        if (!window.firebaseDb || !this.currentUser) return;
        
        try {
            window.firebaseDb.collection('formOpens').add({
                testId: testId,
                userId: this.currentUser.uid,
                userEmail: this.currentUser.email,
                openedAt: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent
            });
        } catch (error) {
            console.warn('Could not track form open:', error);
        }
    }

    isValidGoogleFormLink(url) {
        if (!url) return false;
        
        try {
            const urlObj = new URL(url);
            const validDomains = ['docs.google.com', 'forms.google.com', 'forms.gle'];
            
            // Check if hostname contains any valid domain
            return validDomains.some(domain => 
                urlObj.hostname.includes(domain)
            );
        } catch (error) {
            return false;
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.warn('Date formatting error:', error);
            return 'Recent';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    showAddTestModal() {
        console.log('📝 Showing add test modal, admin status:', this.isAdmin);
        
        if (!this.isAdmin) {
            this.showToast('Admin privileges required to create tests', 'error');
            return;
        }
        
        // Reset form
        if (this.elements.addTestForm) {
            this.elements.addTestForm.reset();
        }
        
        // Update modal title
        if (this.elements.addTestModalTitle) {
            this.elements.addTestModalTitle.textContent = this.currentEditingTestId ? 
                'Edit Test' : 'Create New Test';
        }
        
        // Clear editing ID if creating new
        if (!this.currentEditingTestId) {
            this.currentEditingTestId = null;
        }
        
        // Update button text
        if (this.elements.saveTestBtn) {
            this.elements.saveTestBtn.innerHTML = this.currentEditingTestId ? 
                '<i class="fas fa-save"></i> Update Test' :
                '<i class="fas fa-paper-plane"></i> Save & Publish Test';
        }
        
        // Remove any existing Google Form link field
        this.removeExistingGoogleFormField();
        
        // Dynamically add Google Form link field
        this.addGoogleFormField();
        
        // If editing, populate the form
        if (this.currentEditingTestId) {
            this.populateEditForm();
        }
        
        this.showModal('addTest');
    }

    removeExistingGoogleFormField() {
        const existingField = document.getElementById('googleFormLinkField');
        if (existingField) {
            existingField.remove();
        }
    }

    addGoogleFormField() {
        // Find the form section where we should insert the field
        const formSection = document.querySelector('.form-section');
        if (!formSection) return;
        
        // Create Google Form link field
        const googleFormFieldHTML = `
            <div class="form-group" id="googleFormLinkField">
                <label for="googleFormLink" class="form-label">
                    <i class="fas fa-link"></i>
                    Google Form Link *
                </label>
                <input type="url" id="googleFormLink" class="form-input" required
                       placeholder="https://forms.google.com/... or https://forms.gle/..."
                       pattern="https://.*">
                <small class="form-hint">Must be a valid Google Forms link (forms.google.com or forms.gle)</small>
            </div>
        `;
        
        // Insert after description field
        const descriptionField = document.getElementById('testDescription');
        if (descriptionField && descriptionField.parentNode) {
            descriptionField.parentNode.insertAdjacentHTML('afterend', googleFormFieldHTML);
        }
    }

    getGoogleFormLinkInput() {
        return document.getElementById('googleFormLink');
    }

    populateEditForm() {
        if (!this.currentEditingTestId) return;
        
        // Find the test to edit
        const test = this.tests.find(t => t.id === this.currentEditingTestId);
        if (!test) return;
        
        // Populate form fields
        if (this.elements.testTitle) {
            this.elements.testTitle.value = test.title || '';
        }
        if (this.elements.testDescription) {
            this.elements.testDescription.value = test.description || '';
        }
        
        // Populate Google Form link
        const googleFormLinkInput = this.getGoogleFormLinkInput();
        if (googleFormLinkInput) {
            googleFormLinkInput.value = test.googleFormLink || '';
        }
        
        if (this.elements.testTimeLimit) {
            this.elements.testTimeLimit.value = test.timeLimit || '';
        }
        if (this.elements.testDifficulty) {
            this.elements.testDifficulty.value = test.difficulty || 'medium';
        }
    }

    async handleAddTestSubmit(e) {
        e.preventDefault();
        
        try {
            // Check admin status
            if (!this.isAdmin) {
                this.showToast('Admin privileges required to save tests', 'error');
                return;
            }
            
            // Validate form
            if (!this.validateTestForm()) {
                return;
            }
            
            // Collect data
            const testData = this.collectTestData();
            console.log('💾 Test data to save:', testData);
            
            // Show loading state on save button
            const originalBtnContent = this.elements.saveTestBtn.innerHTML;
            const originalBtnDisabled = this.elements.saveTestBtn.disabled;
            
            this.elements.saveTestBtn.disabled = true;
            this.elements.saveTestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            
            // Check if we have current user
            if (!this.currentUser) {
                throw new Error('User not authenticated');
            }
            
            // Save to Firestore
            if (this.currentEditingTestId) {
                // Update existing test
                console.log(`🔄 Updating test: ${this.currentEditingTestId}`);
                testData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                testData.updatedBy = this.currentUser.uid;
                
                await window.firebaseDb.collection('tests')
                    .doc(this.currentEditingTestId)
                    .update(testData);
                
                console.log('✅ Test updated successfully');
                this.showToast('Test updated successfully!', 'success');
            } else {
                // Create new test
                console.log('🆕 Creating new test');
                testData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                testData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                testData.createdBy = this.currentUser.uid;
                testData.published = true; // Auto-publish when creating
                testData.authorEmail = this.currentUser.email;
                
                const docRef = await window.firebaseDb.collection('tests').add(testData);
                console.log('✅ Test created with ID:', docRef.id);
                
                // Add to local array for immediate display
                this.tests.unshift({
                    id: docRef.id,
                    ...testData
                });
                
                this.showToast('Test created and published successfully!', 'success');
            }
            
            // Restore button state
            this.elements.saveTestBtn.disabled = originalBtnDisabled;
            this.elements.saveTestBtn.innerHTML = originalBtnContent;
            
            // Close modal and refresh display
            this.closeAddTestModal();
            this.renderTests();
            
        } catch (error) {
            console.error('❌ Error saving test:', error);
            
            // Check for permission error
            if (error.code === 'permission-denied' || error.message.includes('permission')) {
                console.error('🔐 Firestore permission error');
                this.showToast('Permission denied. Please check Firestore security rules or contact administrator.', 'error');
            } else {
                this.showToast('Failed to save test: ' + error.message, 'error');
            }
            
            // Restore button state
            if (this.elements.saveTestBtn) {
                this.elements.saveTestBtn.disabled = false;
                this.elements.saveTestBtn.innerHTML = this.currentEditingTestId ? 
                    '<i class="fas fa-save"></i> Update Test' :
                    '<i class="fas fa-paper-plane"></i> Save & Publish Test';
            }
        }
    }

    validateTestForm() {
        // Check required elements exist
        if (!this.elements.testTitle || !this.elements.testDescription) {
            this.showToast('Form initialization error. Please refresh the page.', 'error');
            return false;
        }
        
        // Validate title
        const title = this.elements.testTitle.value.trim();
        if (!title) {
            this.showToast('Please enter a test title', 'error');
            this.elements.testTitle.focus();
            return false;
        }
        
        if (title.length > 200) {
            this.showToast('Title is too long (max 200 characters)', 'error');
            this.elements.testTitle.focus();
            return false;
        }
        
        // Validate description
        const description = this.elements.testDescription.value.trim();
        if (!description) {
            this.showToast('Please enter a test description', 'error');
            this.elements.testDescription.focus();
            return false;
        }
        
        if (description.length > 1000) {
            this.showToast('Description is too long (max 1000 characters)', 'error');
            this.elements.testDescription.focus();
            return false;
        }
        
        // Validate Google Form link
        const googleFormLinkInput = this.getGoogleFormLinkInput();
        if (!googleFormLinkInput) {
            this.showToast('Google Form link field not found. Please refresh the page.', 'error');
            return false;
        }
        
        const formLink = googleFormLinkInput.value.trim();
        if (!formLink) {
            this.showToast('Please enter a Google Form link', 'error');
            googleFormLinkInput.focus();
            return false;
        }
        
        if (!this.isValidGoogleFormLink(formLink)) {
            this.showToast('Please enter a valid Google Form link (docs.google.com, forms.google.com, or forms.gle)', 'error');
            googleFormLinkInput.focus();
            return false;
        }
        
        // Validate time limit (if provided)
        if (this.elements.testTimeLimit) {
            const timeLimit = this.elements.testTimeLimit.value.trim();
            if (timeLimit) {
                const timeLimitNum = parseInt(timeLimit);
                if (isNaN(timeLimitNum) || timeLimitNum < 0 || timeLimitNum > 10080) {
                    this.showToast('Time limit must be between 0 and 10080 minutes (1 week)', 'error');
                    this.elements.testTimeLimit.focus();
                    return false;
                }
            }
        }
        
        return true;
    }

    collectTestData() {
        const title = this.elements.testTitle.value.trim();
        const description = this.elements.testDescription.value.trim();
        const googleFormLinkInput = this.getGoogleFormLinkInput();
        const formLink = googleFormLinkInput ? googleFormLinkInput.value.trim() : '';
        const difficulty = this.elements.testDifficulty ? this.elements.testDifficulty.value : 'medium';
        const timeLimit = this.elements.testTimeLimit ? 
            (this.elements.testTimeLimit.value.trim() ? parseInt(this.elements.testTimeLimit.value.trim()) : null) : null;
        
        const testData = {
            title,
            description,
            googleFormLink: formLink,
            difficulty,
            timeLimit,
            estimatedTime: timeLimit ? `${timeLimit} minutes` : 'Flexible'
        };
        
        console.log('📋 Collected test data:', testData);
        return testData;
    }

    async editTest(testId) {
        try {
            console.log('✏️ Editing test:', testId);
            
            // Find the test
            const test = this.tests.find(t => t.id === testId);
            if (!test) {
                this.showToast('Test not found', 'error');
                return;
            }
            
            this.currentEditingTestId = testId;
            
            // Reset form
            if (this.elements.addTestForm) {
                this.elements.addTestForm.reset();
            }
            
            // Remove any existing Google Form link field
            this.removeExistingGoogleFormField();
            
            // Add Google Form field
            this.addGoogleFormField();
            
            // Show modal first, then populate
            this.showModal('addTest');
            
            // Update modal title
            if (this.elements.addTestModalTitle) {
                this.elements.addTestModalTitle.textContent = 'Edit Test';
            }
            
            // Update button text
            if (this.elements.saveTestBtn) {
                this.elements.saveTestBtn.innerHTML = '<i class="fas fa-save"></i> Update Test';
            }
            
            // Populate form with test data
            setTimeout(() => {
                if (this.elements.testTitle) {
                    this.elements.testTitle.value = test.title || '';
                }
                if (this.elements.testDescription) {
                    this.elements.testDescription.value = test.description || '';
                }
                
                const googleFormLinkInput = this.getGoogleFormLinkInput();
                if (googleFormLinkInput) {
                    googleFormLinkInput.value = test.googleFormLink || '';
                }
                
                if (this.elements.testTimeLimit) {
                    this.elements.testTimeLimit.value = test.timeLimit || '';
                }
                if (this.elements.testDifficulty) {
                    this.elements.testDifficulty.value = test.difficulty || 'medium';
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ Error editing test:', error);
            this.showToast('Failed to load test for editing', 'error');
        }
    }

    showDeleteConfirmation(test) {
        if (!this.elements.deleteTestPreview) return;
        
        this.elements.deleteTestPreview.innerHTML = `
            <div class="delete-preview-content">
                <h4>${this.escapeHtml(test.title)}</h4>
                <p><strong>Description:</strong> ${this.escapeHtml(test.description || 'No description')}</p>
                <p><strong>Google Form Link:</strong> <span class="form-link-preview">${this.truncateText(test.googleFormLink || 'No link', 50)}</span></p>
                <p class="delete-warning-text"><i class="fas fa-exclamation-triangle"></i> This action cannot be undone.</p>
            </div>
        `;
        
        this.elements.deleteTestPreview.dataset.testId = test.id;
        this.showModal('delete');
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    async deleteTest() {
        const testId = this.elements.deleteTestPreview?.dataset.testId;
        
        if (!testId) {
            this.showToast('No test selected for deletion', 'error');
            return;
        }
        
        // Check admin status
        if (!this.isAdmin) {
            this.showToast('Admin privileges required to delete tests', 'error');
            return;
        }
        
        try {
            // Disable delete button and show loading
            this.elements.confirmDelete.disabled = true;
            const originalBtnContent = this.elements.confirmDelete.innerHTML;
            this.elements.confirmDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            
            console.log('🗑️ Deleting test:', testId);
            
            // Delete from Firestore
            await window.firebaseDb.collection('tests').doc(testId).delete();
            
            // Remove from local array
            this.tests = this.tests.filter(test => test.id !== testId);
            
            // Show success message
            console.log('✅ Test deleted successfully');
            this.showToast('Test deleted successfully!', 'success');
            
            // Close modal
            this.closeDeleteModal();
            
            // Refresh display
            this.renderTests();
            
        } catch (error) {
            console.error('❌ Error deleting test:', error);
            
            // Check for permission error
            if (error.code === 'permission-denied' || error.message.includes('permission')) {
                this.showToast('Permission denied. Please check Firestore security rules.', 'error');
            } else {
                this.showToast('Failed to delete test. Please try again.', 'error');
            }
        } finally {
            // Restore delete button
            if (this.elements.confirmDelete) {
                this.elements.confirmDelete.disabled = false;
                this.elements.confirmDelete.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Test';
            }
        }
    }

    handleSearch() {
        if (!this.elements.clearSearch) return;
        
        if (this.searchQuery.trim()) {
            this.elements.clearSearch.classList.remove('hidden');
            this.renderTests();
        } else {
            this.elements.clearSearch.classList.add('hidden');
            this.renderTests();
        }
    }

    clearSearch() {
        if (!this.elements.testSearch || !this.elements.clearSearch) return;
        
        this.elements.testSearch.value = '';
        this.searchQuery = '';
        this.elements.clearSearch.classList.add('hidden');
        this.renderTests();
    }

    handleFilter() {
        this.renderTests();
    }

    showModal(modalName) {
        const modal = this.elements.modals[modalName];
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Focus first input in modal for accessibility
            setTimeout(() => {
                const firstInput = modal.querySelector('input, textarea, select');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    }

    closeModal(modalName) {
        const modal = this.elements.modals[modalName];
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
            
            // Clear editing state if closing add test modal
            if (modalName === 'addTest') {
                this.currentEditingTestId = null;
                
                // Reset modal title
                if (this.elements.addTestModalTitle) {
                    this.elements.addTestModalTitle.textContent = 'Create New Test';
                }
                
                // Reset button text
                if (this.elements.saveTestBtn) {
                    this.elements.saveTestBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Save & Publish Test';
                }
                
                // Remove Google Form link field
                this.removeExistingGoogleFormField();
            }
        }
    }

    closeAddTestModal() {
        this.closeModal('addTest');
        if (this.elements.addTestForm) {
            this.elements.addTestForm.reset();
        }
        this.currentEditingTestId = null;
        this.removeExistingGoogleFormField();
    }

    closeDeleteModal() {
        this.closeModal('delete');
        if (this.elements.deleteTestPreview) {
            this.elements.deleteTestPreview.innerHTML = '';
            delete this.elements.deleteTestPreview.dataset.testId;
        }
    }

    showLoading() {
        if (this.elements.loadingState) this.elements.loadingState.classList.remove('hidden');
        if (this.elements.testGrid) this.elements.testGrid.classList.add('hidden');
        if (this.elements.emptyState) this.elements.emptyState.classList.add('hidden');
    }

    hideLoading() {
        if (this.elements.loadingState) this.elements.loadingState.classList.add('hidden');
        if (this.elements.testGrid) this.elements.testGrid.classList.remove('hidden');
    }

    showEmptyState() {
        this.hideLoading();
        if (this.elements.testGrid) this.elements.testGrid.classList.add('hidden');
        if (this.elements.emptyState) this.elements.emptyState.classList.remove('hidden');
    }

    showToast(message, type = 'info') {
        // Try to use existing toast system if available
        if (window.CodeNirvahana?.admin?.showToast) {
            window.CodeNirvahana.admin.showToast(message, type);
            return;
        }
        
        // Use the same pattern as course-details.js
        const toast = document.getElementById('messageToast');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = toast?.querySelector('.toast-icon');
        
        if (!toast || !toastMessage) {
            // Create simple toast as fallback
            this.createSimpleToast(message, type);
            return;
        }
        
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

    createSimpleToast(message, type) {
        const toastId = 'test-system-toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `simple-toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close" onclick="document.getElementById('${toastId}').remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const toastEl = document.getElementById(toastId);
            if (toastEl) toastEl.remove();
        }, 5000);
    }

    async logoutAdmin() {
        try {
            await window.firebaseAuth.signOut();
            this.showToast('Logged out successfully', 'success');
            this.isAdmin = false;
            this.currentUser = null;
            
            // Clear admin session
            sessionStorage.removeItem('isAdmin');
            sessionStorage.removeItem('adminUid');
            sessionStorage.removeItem('adminEmail');
            
            // Update UI
            this.updateAdminUI();
            
            // Reload tests for public view
            await this.loadTests();
            
        } catch (error) {
            console.error('❌ Error logging out:', error);
            this.showToast('Failed to logout. Please try again.', 'error');
        }
    }
}

// Initialize Test System when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Test System: DOM loaded, initializing...');
    
    // Wait for Firebase to be ready
    const firebaseCheckInterval = setInterval(() => {
        if (window.firebaseDb && window.firebaseAuth) {
            clearInterval(firebaseCheckInterval);
            console.log('✅ Test System: Firebase ready, starting...');
            const testSystem = new TestSystem();
            window.testSystem = testSystem;
        }
    }, 100);
    
    // Timeout after 10 seconds
    setTimeout(() => {
        clearInterval(firebaseCheckInterval);
        if (!window.testSystem) {
            console.error('❌ Test System: Firebase initialization timeout');
            const errorElement = document.getElementById('loadingState');
            if (errorElement) {
                errorElement.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Initialization Failed</h3>
                        <p>Unable to connect to the test system. Please refresh the page.</p>
                        <button onclick="location.reload()" class="btn btn-primary">
                            <i class="fas fa-redo"></i> Refresh Page
                        </button>
                    </div>
                `;
            }
        }
    }, 10000);
});

// Make TestSystem available globally for debugging
window.TestSystem = TestSystem;

// Helper function to manually refresh tests (for debugging)
window.refreshAllTests = function() {
    if (window.testSystem && typeof window.testSystem.loadTests === 'function') {
        window.testSystem.loadTests();
    }
};
