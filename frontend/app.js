/**
 * Instrument Hygiene Tracker - Main Application JavaScript
 * Handles equipment, tasks, calendar, and analytics
 */

const API_BASE_URL = 'http://localhost:8000/api';

// State
let equipment = [];
let tasks = [];
let currentDate = new Date();
let selectedDate = null;
let currentView = 'calendar';
let editingEquipmentId = null;
let isOnline = navigator.onLine;
let currentUserId = localStorage.getItem('currentUserId') || null;
let currentUserName = localStorage.getItem('currentUserName') || null;

// DOM Elements (will be initialized on page load)
let statusIndicator, statusText, offlineIndicator, navButtons, views;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    statusIndicator = document.getElementById('status');
    statusText = document.getElementById('status-text');
    offlineIndicator = document.getElementById('offline-indicator');
    navButtons = document.querySelectorAll('.nav-btn');
    views = document.querySelectorAll('.view');
    
    setupEventListeners();
    setupModals();
    setTodayDate();
    
        // Check if user is already signed in
        if (currentUserId) {
            updateUserUI();
            // Set initial view to calendar (this will highlight the correct tab)
            switchView('calendar');
            // Load user's data
            loadData().catch(() => {
                console.log('Initial data load failed, but UI is available');
            });
        } else {
            // Show sign in view if not signed in
            switchView('signin');
            updateUserUI();
            if (statusText) {
                statusText.textContent = 'Please sign in';
            }
        }
        
        // Sign out button
        const signOutBtn = document.getElementById('sign-out-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', signOut);
        }
        
        // Profile icon click - navigate to profile or sign-in
        const profileIcon = document.getElementById('profile-icon');
        if (profileIcon) {
            profileIcon.addEventListener('click', () => {
                if (currentUserId) {
                    // If logged in, go to profile
                    switchView('profile');
                } else {
                    // If not logged in, go to sign-in
                    switchView('signin');
                }
            });
            profileIcon.title = 'View Profile';
        }
        
        // Check connection but don't block UI
        checkConnection().catch(() => {
            // Even if backend is unavailable, show UI
            updateStatus('disconnected', '⚠️ Server unavailable - Working offline');
        });
});

// Event Listeners
function setupEventListeners() {
    // Navigation (top nav)
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });
    
    // Bottom navigation
    const bottomNavButtons = document.querySelectorAll('.bottom-nav-btn');
    bottomNavButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });

    // Online/Offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Calendar navigation
    document.getElementById('prev-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    // Equipment form
    document.getElementById('equipment-form').addEventListener('submit', handleEquipmentSubmit);
    document.getElementById('add-equipment-btn').addEventListener('click', () => {
        openEquipmentModal();
    });

    // Task definition form
    document.getElementById('task-def-form').addEventListener('submit', handleTaskDefSubmit);

    // Task tabs
    document.querySelectorAll('.task-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.task-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadTasksForFilter(tab.dataset.filter);
        });
    });

    // Complete task form
    document.getElementById('complete-task-form').addEventListener('submit', handleCompleteTask);

    // Auth forms
    document.getElementById('signin-form').addEventListener('submit', handleSignIn);
    document.getElementById('signup-form').addEventListener('submit', handleSignUp);
    
    // Switch between sign in and sign up
    document.getElementById('switch-to-signup').addEventListener('click', (e) => {
        e.preventDefault();
        showSignUp();
    });
    
    document.getElementById('switch-to-signin').addEventListener('click', (e) => {
        e.preventDefault();
        showSignIn();
    });
}

function setupModals() {
    // Close modals
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // Close on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// Connection Status
async function checkConnection() {
    try {
        // Set timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            cache: 'no-cache',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            updateStatus('connected', '✅ Connected');
            isOnline = true;
            offlineIndicator.style.display = 'none';
        } else {
            throw new Error('Server error');
        }
    } catch (error) {
        updateStatus('disconnected', '⚠️ Server unavailable - Working offline');
        isOnline = false;
        offlineIndicator.style.display = 'block';
    }
}

function handleOnline() {
    isOnline = true;
    offlineIndicator.style.display = 'none';
    checkConnection();
    loadData();
}

function handleOffline() {
    isOnline = false;
    updateStatus('disconnected', '⚠️ Offline mode');
    offlineIndicator.style.display = 'block';
}

function updateStatus(status, message) {
    statusIndicator.className = `status-indicator ${status}`;
    statusText.textContent = message;
}

// View Management
function switchView(viewName) {
    currentView = viewName;
    
    // Update nav buttons (top nav)
    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    
    // Update bottom nav buttons
    const bottomNavButtons = document.querySelectorAll('.bottom-nav-btn');
    bottomNavButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    
    // Update views
    views.forEach(view => {
        view.classList.toggle('active', view.id === `${viewName}-view`);
    });
    
    // Show sign in form by default when switching to signin view
    if (viewName === 'signin') {
        showSignIn();
    }
    
    // Load view-specific data
    if (viewName === 'calendar') {
        renderCalendar();
    } else if (viewName === 'tasks') {
        loadTasksForFilter('today');
    } else if (viewName === 'equipment') {
        renderEquipment(); // This is now async
    } else if (viewName === 'achievements') {
        loadAnalytics();
    } else if (viewName === 'profile') {
        loadProfile();
    } else if (viewName === 'credits') {
        // Credits view doesn't need special data loading
    }
}

// Authentication
function showSignIn() {
    document.getElementById('signin-view').querySelector('.auth-card').style.display = 'block';
    document.getElementById('signup-card').style.display = 'none';
}

function updateUserUI() {
    const profileIcon = document.getElementById('profile-icon');
    const profileInitials = document.getElementById('profile-initials');
    
    // Profile icon is ALWAYS visible in the header
    if (profileIcon) {
        profileIcon.style.display = 'flex';
    }
    
    if (currentUserId && currentUserName) {
        // Update icon to show user initials
        if (profileInitials && currentUserName) {
            // Get initials from name (first letter of each word)
            const initials = currentUserName
                .split(' ')
                .map(word => word[0])
                .join('')
                .toUpperCase()
                .slice(0, 2); // Max 2 letters
            profileInitials.textContent = initials || 'U';
        }
        if (statusText) {
            statusText.textContent = `✅ Signed in as ${currentUserName}`;
        }
    } else {
        // Show default profile icon (person emoji) when not logged in
        if (profileInitials) {
            profileInitials.textContent = '👤';
        }
    }
}

function signOut() {
    // Clear user session
    currentUserId = null;
    currentUserName = null;
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    
    // Clear data
    equipment = [];
    tasks = [];
    
    // Update UI
    updateUserUI();
    
    // Switch to sign in view
    switchView('signin');
    
    // Clear equipment list
    const equipmentList = document.getElementById('equipment-list');
    if (equipmentList) {
        equipmentList.innerHTML = '<p class="empty-state">Please sign in to view your equipment</p>';
    }
}

function showSignUp() {
    document.getElementById('signin-view').querySelector('.auth-card').style.display = 'none';
    document.getElementById('signup-card').style.display = 'block';
}

async function handleSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            let errorMessage = 'Sign in failed';
            try {
                const error = await response.json();
                errorMessage = error.detail || error.message || errorMessage;
            } catch (e) {
                // If response isn't JSON, use status text
                errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        // Store user session
        currentUserId = data.user_id;
        currentUserName = data.name;
        localStorage.setItem('currentUserId', data.user_id);
        localStorage.setItem('currentUserName', data.name);
        
        // Update UI
        updateUserUI();
        
        // Load user's data
        await loadEquipment();
        await loadTasks();
        
        // Switch to equipment view
        switchView('equipment');
        
        // Clear form
        document.getElementById('signin-form').reset();
        
    } catch (error) {
        console.error('Sign in error:', error);
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            alert('Cannot connect to server. Please make sure the backend is running on http://localhost:8000');
        } else {
            alert(error.message || 'Failed to sign in. Please check your email and password.');
        }
    }
}

async function handleSignUp(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-password-confirm').value;
    
    // Validate passwords match
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        if (!response.ok) {
            let errorMessage = 'Sign up failed';
            try {
                const error = await response.json();
                errorMessage = error.detail || error.message || errorMessage;
            } catch (e) {
                // If response isn't JSON, use status text
                errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        // Store user session
        currentUserId = data.user_id;
        currentUserName = data.name;
        localStorage.setItem('currentUserId', data.user_id);
        localStorage.setItem('currentUserName', data.name);
        
        // Update UI
        updateUserUI();
        
        // Load user's data
        await loadEquipment();
        await loadTasks();
        
        // Switch to equipment view
        switchView('equipment');
        
        // Clear form
        document.getElementById('signup-form').reset();
        
        alert(`Account created successfully! Welcome, ${data.name}.`);
        
    } catch (error) {
        console.error('Sign up error:', error);
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            alert('Cannot connect to server. Please make sure the backend is running on http://localhost:8000');
        } else {
            alert(error.message || 'Failed to create account. Email may already be registered.');
        }
    }
}

// Data Loading
async function loadData() {
    await Promise.all([
        loadEquipment(),
        loadTasks()
    ]);
    
    if (currentView === 'calendar') {
        renderCalendar();
    } else if (currentView === 'equipment') {
        renderEquipment();
    }
}

async function loadEquipment() {
    try {
        // Filter by current user if signed in
        let url = `${API_BASE_URL}/equipment`;
        if (currentUserId) {
            url += `?user_id=${currentUserId}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
            equipment = await response.json();
            populateEquipmentSelect();
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
    }
}

async function loadTasks() {
    try {
        const response = await fetch(`${API_BASE_URL}/tasks`);
        if (response.ok) {
            tasks = await response.json();
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

// Equipment Management
async function renderEquipment() {
    // Render quick-add buttons for user's instruments
    await renderQuickAddInstrumentButtons();
    
    // Render equipment list
    const container = document.getElementById('equipment-list');
    
    if (equipment.length === 0) {
        container.innerHTML = '<p class="empty-state">No equipment yet. Add your first instrument!</p>';
        return;
    }
    
    container.innerHTML = equipment.map(eq => `
        <div class="equipment-card">
            <div class="equipment-header">
                <div>
                    <div class="equipment-name">${escapeHtml(eq.name)}</div>
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem;">
                        <span class="equipment-category">${escapeHtml(eq.category)}</span>
                        <span class="equipment-category" style="background: ${eq.instrument_type === 'Primary' ? '#4CAF50' : '#FF9800'}; color: white;">${escapeHtml(eq.instrument_type || 'Primary')}</span>
                    </div>
                </div>
                <div class="equipment-actions">
                    <button class="btn btn-secondary btn-small" onclick="editEquipment('${eq.id}')">Edit</button>
                    <button class="btn btn-primary btn-small" onclick="addTaskForEquipment('${eq.id}')">Add Task</button>
                    <button class="btn btn-danger btn-small" onclick="deleteEquipment('${eq.id}')">Delete</button>
                </div>
            </div>
            ${eq.notes ? `<div class="equipment-notes">${escapeHtml(eq.notes)}</div>` : ''}
        </div>
    `).join('');
}

// Helper function to determine category from instrument name
function getInstrumentCategory(instrumentName) {
    if (!instrumentName) return "Other";
    
    const name = instrumentName.toLowerCase();
    
    // Map instruments to categories (matching backend/instrument_list.py structure)
    const categoryMap = {
        "Woodwind": ["flute", "piccolo", "clarinet", "oboe", "bassoon", "saxophone", "recorder", "harmonica", "accordion", "bagpipes", "ocarina"],
        "Brass": ["trumpet", "cornet", "flugelhorn", "trombone", "tuba", "french horn", "euphonium", "baritone", "mellophone", "bugle"],
        "Plucked string": ["guitar", "ukulele", "mandolin", "banjo", "harp", "sitar", "lute", "zither", "balalaika", "bouzouki"],
        "Bowed string": ["violin", "viola", "cello", "double bass", "bass", "erhu", "sarangi"],
        "Percussion": ["drum", "cymbal", "tambourine", "triangle", "maraca", "conga", "bongo", "djembe", "xylophone", "marimba", "vibraphone", "glockenspiel", "gong"],
        "Keyboard": ["piano", "keyboard", "organ", "harpsichord", "synthesizer", "celesta", "melodica"],
        "Voice": ["voice", "choir", "beatbox"],
        "Electronic": ["synthesizer", "drum machine", "sampler", "theremin", "turntable", "midi"],
    };
    
    for (const [category, keywords] of Object.entries(categoryMap)) {
        if (keywords.some(keyword => name.includes(keyword))) {
            return category;
        }
    }
    
    return "Other";
}

async function renderQuickAddInstrumentButtons() {
    const container = document.getElementById('quick-add-instruments');
    if (!container) return;
    
    const currentUserId = localStorage.getItem('currentUserId');
    if (!currentUserId) {
        container.innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/profile?user_id=${currentUserId}`);
        if (response.ok) {
            const profile = await response.json();
            const instruments = [];
            
            // Add primary instrument
            if (profile.primary_instrument) {
                instruments.push({
                    name: profile.primary_instrument,
                    type: 'Primary'
                });
            }
            
            // Add secondary instruments
            if (profile.secondary_instruments) {
                const secondaryInstruments = profile.secondary_instruments
                    .split(',')
                    .map(inst => inst.trim())
                    .filter(inst => inst.length > 0);
                
                secondaryInstruments.forEach(instrument => {
                    instruments.push({
                        name: instrument,
                        type: 'Secondary'
                    });
                });
            }
            
            // Filter out instruments that are already in the equipment list
            const existingEquipmentNames = equipment.map(eq => eq.name.toLowerCase());
            const instrumentsToShow = instruments.filter(inst => 
                !existingEquipmentNames.includes(inst.name.toLowerCase())
            );
            
            if (instrumentsToShow.length === 0) {
                container.innerHTML = '';
                return;
            }
            
            container.innerHTML = instrumentsToShow.map(inst => `
                <button class="quick-add-instrument-btn" onclick="quickAddEquipment('${escapeHtml(inst.name)}', '${inst.type}')">
                    + ${escapeHtml(inst.name)}
                </button>
            `).join('');
        } else {
            container.innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading profile for quick-add buttons:', error);
        container.innerHTML = '';
    }
}

async function quickAddEquipment(instrumentName, instrumentType) {
    if (!currentUserId) {
        alert('Please sign in to add equipment');
        switchView('signin');
        return;
    }
    
    // Determine category from instrument name
    const category = getInstrumentCategory(instrumentName);
    
    try {
        const response = await fetch(`${API_BASE_URL}/equipment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: instrumentName, 
                category: category, 
                instrument_type: instrumentType,
                notes: null, 
                user_profile_id: currentUserId 
            })
        });
        
        if (response.ok) {
            await loadEquipment();
            await renderEquipment();
        } else {
            const error = await response.json();
            alert(error.detail || 'Failed to add equipment');
        }
    } catch (error) {
        console.error('Error adding equipment:', error);
        alert('Failed to add equipment. Please try again.');
    }
}

async function handleEquipmentSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('equipment-name').value.trim();
    const category = document.getElementById('equipment-category').value;
    const instrumentType = document.getElementById('equipment-instrument-type').value;
    const notes = document.getElementById('equipment-notes').value.trim();
    
    try {
        if (editingEquipmentId) {
            // Update
            const response = await fetch(`${API_BASE_URL}/equipment/${editingEquipmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name, 
                    category, 
                    instrument_type: instrumentType,
                    notes: notes || null, 
                    user_profile_id: currentUserId 
                })
            });
            
            if (response.ok) {
                await loadEquipment();
                renderEquipment();
                closeModal('equipment-modal');
            }
        } else {
            // Create - link to current user
            if (!currentUserId) {
                alert('Please sign in to add equipment');
                switchView('signin');
                return;
            }
            
            const response = await fetch(`${API_BASE_URL}/equipment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name, 
                    category, 
                    instrument_type: instrumentType,
                    notes: notes || null, 
                    user_profile_id: currentUserId 
                })
            });
            
            if (response.ok) {
                await loadEquipment();
                renderEquipment();
                closeModal('equipment-modal');
            } else {
                const error = await response.json();
                alert(error.detail || 'Failed to create equipment');
            }
        }
    } catch (error) {
        console.error('Error saving equipment:', error);
        alert('Failed to save equipment. Please try again.');
    }
}

async function openEquipmentModal(equipmentId = null) {
    // Reset form
    document.getElementById('equipment-form').reset();
    document.getElementById('equipment-instrument-type').value = 'Primary'; // Default to Primary
    
    editingEquipmentId = equipmentId;
    const modal = document.getElementById('equipment-modal');
    const form = document.getElementById('equipment-form');
    const title = document.getElementById('equipment-modal-title');
    
    if (equipmentId) {
        const eq = equipment.find(e => e.id === equipmentId);
        title.textContent = 'Edit Equipment';
        document.getElementById('equipment-name').value = eq.name;
        document.getElementById('equipment-category').value = eq.category;
        document.getElementById('equipment-instrument-type').value = eq.instrument_type || 'Primary';
        document.getElementById('equipment-notes').value = eq.notes || '';
    } else {
        title.textContent = 'Add Equipment';
        form.reset();
        // Populate suggestions from user's profile instruments
        await populateEquipmentNameSuggestions();
    }
    
    openModal('equipment-modal');
}

async function populateEquipmentNameSuggestions() {
    const currentUserId = localStorage.getItem('currentUserId');
    if (!currentUserId) {
        return; // User not logged in, can't load profile
    }
    
    const datalist = document.getElementById('equipment-name-suggestions');
    if (!datalist) {
        return;
    }
    
    // Clear existing options
    datalist.innerHTML = '';
    
    try {
        const response = await fetch(`${API_BASE_URL}/profile?user_id=${currentUserId}`);
        if (response.ok) {
            const profile = await response.json();
            
            // Add primary instrument if available
            if (profile.primary_instrument) {
                const option = document.createElement('option');
                option.value = profile.primary_instrument;
                datalist.appendChild(option);
            }
            
            // Add secondary instruments if available (comma-separated string)
            if (profile.secondary_instruments) {
                const secondaryInstruments = profile.secondary_instruments
                    .split(',')
                    .map(instrument => instrument.trim())
                    .filter(instrument => instrument.length > 0);
                
                secondaryInstruments.forEach(instrument => {
                    const option = document.createElement('option');
                    option.value = instrument;
                    datalist.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading profile for equipment suggestions:', error);
        // Fail silently - suggestions are optional
    }
}

function editEquipment(id) {
    openEquipmentModal(id);
}

async function deleteEquipment(id) {
    if (!confirm('Are you sure you want to delete this equipment? This will also delete all related tasks.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/equipment/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadData();
            renderEquipment();
        }
    } catch (error) {
        console.error('Error deleting equipment:', error);
        alert('Failed to delete equipment.');
    }
}

function populateEquipmentSelect() {
    const select = document.getElementById('task-equipment');
    select.innerHTML = '<option value="">Select equipment...</option>' +
        equipment.map(eq => `<option value="${eq.id}">${escapeHtml(eq.name)}</option>`).join('');
}

function addTaskForEquipment(equipmentId) {
    populateEquipmentSelect();
    document.getElementById('task-equipment').value = equipmentId;
    openModal('task-def-modal');
}

async function handleTaskDefSubmit(e) {
    e.preventDefault();
    
    const equipmentId = parseInt(document.getElementById('task-equipment').value);
    const taskType = document.getElementById('task-type').value;
    const frequencyType = document.getElementById('task-frequency-type').value;
    const frequencyValue = parseInt(document.getElementById('task-frequency-value').value);
    const startDate = document.getElementById('task-start-date').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/task-definitions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                equipment_id: equipmentId,
                task_type: taskType,
                frequency_type: frequencyType,
                frequency_value: frequencyValue,
                start_date: startDate
            })
        });
        
        if (response.ok) {
            await loadTasks();
            closeModal('task-def-modal');
            document.getElementById('task-def-form').reset();
            
            if (currentView === 'calendar') {
                renderCalendar();
            } else if (currentView === 'equipment') {
                renderEquipment();
            }
        }
    } catch (error) {
        console.error('Error creating task:', error);
        alert('Failed to create task. Please try again.');
    }
}

// Calendar
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('task-start-date').value = today;
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('current-month').textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const grid = document.getElementById('calendar-grid');
    
    grid.innerHTML = dayNames.map(day => 
        `<div class="calendar-day-header">${day}</div>`
    ).join('');
    
    // Empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        grid.innerHTML += '<div class="calendar-day"></div>';
    }
    
    // Days of month
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTasks = tasks.filter(t => t.due_date === dateStr && !t.completed);
        const isToday = dateStr === todayStr;
        const isSelected = selectedDate === dateStr;
        
        const taskDots = dayTasks.map(t => {
            const typeClass = t.task_type.toLowerCase().replace('ing', '');
            return `<span class="task-dot ${typeClass}"></span>`;
        }).join('');
        
        grid.innerHTML += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
                 data-date="${dateStr}" onclick="selectDate('${dateStr}')">
                <div class="calendar-day-number">${day}</div>
                <div class="calendar-day-tasks">${taskDots}</div>
            </div>
        `;
    }
    
    // Selected date tasks display
    if (selectedDate) {
        loadTasksForDate(selectedDate);
    }
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    showTasksForDate(dateStr);
}

function showTasksForDate(dateStr) {
    const container = document.getElementById('selected-date-tasks');
    const dayTasks = tasks.filter(t => t.due_date === dateStr);
    
    if (dayTasks.length === 0) {
        container.innerHTML = '<p class="empty-state">No tasks for this date</p>';
        return;
    }
    
    container.innerHTML = `
        <h3>Tasks for ${formatDate(dateStr)}</h3>
        ${dayTasks.map(task => renderTaskCard(task)).join('')}
    `;
}

// Tasks
async function loadTasksForFilter(filter) {
    let endpoint = '';
    if (filter === 'today') endpoint = '/tasks/today';
    else if (filter === 'tomorrow') endpoint = '/tasks/tomorrow';
    else if (filter === 'overdue') endpoint = '/tasks/overdue';
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (response.ok) {
            const filteredTasks = await response.json();
            renderTasks(filteredTasks);
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

function renderTasks(taskList) {
    const container = document.getElementById('tasks-list');
    
    if (taskList.length === 0) {
        container.innerHTML = '<p class="empty-state">No tasks found</p>';
        return;
    }
    
    container.innerHTML = taskList.map(task => renderTaskCard(task)).join('');
}

function renderTaskCard(task) {
    const equipmentName = equipment.find(e => e.id === task.equipment_id)?.name || 'Unknown';
    const taskTypeClass = task.task_type.toLowerCase().replace('ing', '');
    const isOverdue = task.due_date < new Date().toISOString().split('T')[0] && !task.completed;
    
    return `
        <div class="task-card ${task.completed ? 'completed' : ''}">
            <div class="task-info">
                <div class="task-equipment">${escapeHtml(equipmentName)}</div>
                <span class="task-type ${taskTypeClass}">${escapeHtml(task.task_type)}</span>
                <div class="task-date ${isOverdue ? 'overdue' : ''}">
                    Due: ${formatDate(task.due_date)} ${isOverdue ? '⚠️ Overdue' : ''}
                </div>
            </div>
            <div class="task-actions">
                ${!task.completed ? `
                    <button class="btn btn-success btn-small" onclick="openCompleteTaskModal(${task.id})">
                        Complete
                    </button>
                ` : `
                    <span style="color: var(--success-color);">✓ Done</span>
                `}
            </div>
        </div>
    `;
}

function openCompleteTaskModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const equipmentName = equipment.find(e => e.id === task.equipment_id)?.name || 'Unknown';
    const infoDiv = document.getElementById('complete-task-info');
    infoDiv.innerHTML = `
        <p><strong>Equipment:</strong> ${escapeHtml(equipmentName)}</p>
        <p><strong>Task:</strong> ${escapeHtml(task.task_type)}</p>
        <p><strong>Due:</strong> ${formatDate(task.due_date)}</p>
    `;
    
    document.getElementById('complete-task-form').dataset.taskId = taskId;
    document.getElementById('complete-task-notes').value = '';
    document.getElementById('complete-task-photo').value = '';
    
    openModal('complete-task-modal');
}

async function handleCompleteTask(e) {
    e.preventDefault();
    
    const taskId = parseInt(e.target.dataset.taskId);
    const notes = document.getElementById('complete-task-notes').value.trim();
    const photoFile = document.getElementById('complete-task-photo').files[0];
    
    // Note: Photo upload would need proper file handling in production
    const photoUrl = photoFile ? URL.createObjectURL(photoFile) : null;
    
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task_occurrence_id: taskId,
                notes: notes || null,
                photo_url: photoUrl
            })
        });
        
        if (response.ok) {
            await loadTasks();
            closeModal('complete-task-modal');
            
            if (currentView === 'calendar') {
                renderCalendar();
            } else if (currentView === 'equipment') {
                renderEquipment();
            } else if (currentView === 'tasks') {
                const activeTab = document.querySelector('.task-tab.active');
                loadTasksForFilter(activeTab.dataset.filter);
            }
        }
    } catch (error) {
        console.error('Error completing task:', error);
        alert('Failed to complete task. Please try again.');
    }
}

// Analytics
async function loadAnalytics() {
    await Promise.all([
        loadStreak(),
        loadCompletionRate(),
        loadEquipmentScores()
    ]);
}

async function loadStreak() {
    try {
        const response = await fetch(`${API_BASE_URL}/analytics/streak`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById('streak-display').textContent = `${data.streak_days} days`;
        }
    } catch (error) {
        console.error('Error loading streak:', error);
    }
}

async function loadCompletionRate() {
    try {
        const response = await fetch(`${API_BASE_URL}/analytics/completion-rate?period=monthly`);
        if (response.ok) {
            const data = await response.json();
            const container = document.getElementById('completion-rate');
            container.innerHTML = `
                <div class="completion-rate-display">${data.completion_rate}%</div>
                <p style="text-align: center; color: var(--text-secondary);">
                    ${data.completed} of ${data.total} tasks completed
                </p>
            `;
        }
    } catch (error) {
        console.error('Error loading completion rate:', error);
    }
}

async function loadEquipmentScores() {
    try {
        const response = await fetch(`${API_BASE_URL}/analytics/equipment-scores`);
        if (response.ok) {
            const scores = await response.json();
            const container = document.getElementById('equipment-scores');
            
            if (scores.length === 0) {
                container.innerHTML = '<p class="empty-state">No data yet</p>';
                return;
            }
            
            container.innerHTML = scores.map(score => `
                <div class="equipment-score-item">
                    <span>${escapeHtml(score.equipment_name)}</span>
                    <div class="score-bar">
                        <div class="score-bar-fill" style="width: ${score.score}%"></div>
                    </div>
                    <span>${score.score}%</span>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading equipment scores:', error);
    }
}

// Modal helpers
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    editingEquipmentId = null;
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
}

// Profile functions
let instrumentsList = [];

async function loadInstrumentsList() {
    if (instrumentsList.length > 0) {
        return instrumentsList; // Already loaded
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/instruments`);
        if (response.ok) {
            const data = await response.json();
            instrumentsList = data.instruments || [];
            populateInstrumentDropdowns();
            return instrumentsList;
        }
    } catch (error) {
        console.error('Error loading instruments list:', error);
    }
    return [];
}

function populateInstrumentDropdowns() {
    const primarySelect = document.getElementById('profile-edit-primary-instrument');
    const secondaryOptionsContainer = document.getElementById('profile-edit-secondary-instruments-options');
    
    if (primarySelect && instrumentsList.length > 0) {
        // Clear existing options except the first placeholder
        primarySelect.innerHTML = '<option value="">Select or type instrument</option>';
        instrumentsList.forEach(instrument => {
            const option = document.createElement('option');
            option.value = instrument;
            option.textContent = instrument;
            primarySelect.appendChild(option);
        });
    }
    
    // Populate custom multi-select dropdown
    if (secondaryOptionsContainer && instrumentsList.length > 0) {
        secondaryOptionsContainer.innerHTML = '';
        instrumentsList.forEach(instrument => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'custom-multi-select-option';
            option.dataset.value = instrument;
            option.textContent = instrument;
            secondaryOptionsContainer.appendChild(option);
        });
        
        // Initialize custom multi-select handlers if not already done
        initCustomMultiSelect();
    }
}

// Initialize custom multi-select dropdown functionality
function initCustomMultiSelect() {
    const wrapper = document.querySelector('.custom-multi-select-wrapper');
    const display = document.getElementById('profile-edit-secondary-instruments-display');
    const dropdown = document.getElementById('profile-edit-secondary-instruments-dropdown');
    const searchInput = document.getElementById('profile-edit-secondary-instruments-search');
    const optionsContainer = document.getElementById('profile-edit-secondary-instruments-options');
    const hiddenInput = document.getElementById('profile-edit-secondary-instruments');
    const textDisplay = display.querySelector('.custom-multi-select-text');
    
    if (!wrapper || !display || !dropdown) return;
    
    let selectedValues = new Set();
    
    // Load selected values from hidden input
    function loadSelectedValues() {
        const value = hiddenInput.value || '';
        selectedValues = new Set(value.split(',').map(s => s.trim()).filter(s => s));
        updateDisplay();
        updateOptionsDisplay();
    }
    
    // Update display text
    function updateDisplay() {
        if (selectedValues.size === 0) {
            textDisplay.textContent = 'Select instruments';
            textDisplay.classList.add('placeholder');
        } else if (selectedValues.size === 1) {
            textDisplay.textContent = Array.from(selectedValues)[0];
            textDisplay.classList.remove('placeholder');
        } else {
            textDisplay.textContent = `${selectedValues.size} instruments selected`;
            textDisplay.classList.remove('placeholder');
        }
    }
    
    // Update options display (show selected state)
    function updateOptionsDisplay() {
        if (!optionsContainer) return;
        const options = optionsContainer.querySelectorAll('.custom-multi-select-option');
        options.forEach(option => {
            if (selectedValues.has(option.dataset.value)) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
    }
    
    // Toggle dropdown
    display.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = wrapper.classList.contains('active');
        if (isActive) {
            wrapper.classList.remove('active');
            dropdown.style.display = 'none';
        } else {
            wrapper.classList.add('active');
            dropdown.style.display = 'flex';
            if (searchInput) searchInput.focus();
        }
    });
    
    // Handle option click
    if (optionsContainer) {
        optionsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('custom-multi-select-option')) {
                const value = e.target.dataset.value;
                if (selectedValues.has(value)) {
                    selectedValues.delete(value);
                } else {
                    selectedValues.add(value);
                }
                updateDisplay();
                updateOptionsDisplay();
                hiddenInput.value = Array.from(selectedValues).join(', ');
            }
        });
    }
    
    // Handle search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const options = optionsContainer.querySelectorAll('.custom-multi-select-option');
            options.forEach(option => {
                const text = option.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    option.style.display = 'block';
                } else {
                    option.style.display = 'none';
                }
            });
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('active');
            dropdown.style.display = 'none';
            if (searchInput) searchInput.value = '';
        }
    });
    
    // Initialize
    loadSelectedValues();
}

async function loadProfile() {
    const currentUserId = localStorage.getItem('currentUserId');
    if (!currentUserId) {
        switchView('signin');
        return;
    }
    
    console.log('Loading profile for user:', currentUserId); // Debug
    
    // Load instruments list first
    await loadInstrumentsList();
    
    try {
        const response = await fetch(`${API_BASE_URL}/profile?user_id=${currentUserId}`);
        if (response.ok) {
            const profile = await response.json();
            console.log('Loaded profile data:', profile); // Debug: log profile data to see what we're getting
            
            // Update profile display
            const nameDisplay = document.getElementById('profile-name-display');
            const emailDisplay = document.getElementById('profile-email-display');
            const nameInput = document.getElementById('profile-edit-name');
            const emailInput = document.getElementById('profile-edit-email');
            const dobInput = document.getElementById('profile-edit-dob');
            const genderSelect = document.getElementById('profile-edit-gender');
            const primaryInstrumentSelect = document.getElementById('profile-edit-primary-instrument');
            const ageCommencedInput = document.getElementById('profile-edit-age-commenced');
            const secondaryInstrumentsHidden = document.getElementById('profile-edit-secondary-instruments');
            const dailyPracticeHoursInput = document.getElementById('profile-edit-daily-practice-hours');
            const daysPerWeekInput = document.getElementById('profile-edit-days-per-week');
            const practiceRoutineTextarea = document.getElementById('profile-edit-practice-routine');
            const bioInput = document.getElementById('profile-edit-bio');
            const notificationsCheckbox = document.getElementById('profile-notifications-enabled');
            const reminderHoursInput = document.getElementById('profile-reminder-hours');
            const profileInitialsLarge = document.getElementById('profile-initials-large');
            
            if (nameDisplay) nameDisplay.textContent = profile.name || 'User';
            if (emailDisplay) emailDisplay.textContent = profile.email || 'No email';
            if (nameInput) nameInput.value = profile.name || '';
            if (emailInput) emailInput.value = profile.email || '';
            // Always set values, even if they're empty/null/0 - this ensures all fields are displayed correctly
            if (dobInput) {
                dobInput.value = profile.date_of_birth ? profile.date_of_birth.split('T')[0] : ''; // Extract date part from ISO string
            }
            if (genderSelect) {
                // Handle both enum objects and strings
                const genderValue = profile.gender ? (typeof profile.gender === 'object' ? profile.gender.value : profile.gender) : '';
                genderSelect.value = genderValue;
            }
            if (primaryInstrumentSelect) {
                primaryInstrumentSelect.value = profile.primary_instrument || '';
            }
            if (ageCommencedInput) {
                ageCommencedInput.value = (profile.age_commenced_playing !== null && profile.age_commenced_playing !== undefined) ? profile.age_commenced_playing : '';
            }
            // Handle custom multi-select for secondary instruments
            if (secondaryInstrumentsHidden) {
                if (profile.secondary_instruments) {
                    secondaryInstrumentsHidden.value = profile.secondary_instruments;
                } else {
                    secondaryInstrumentsHidden.value = '';
                }
                // Initialize/update the custom dropdown display
                setTimeout(() => initCustomMultiSelect(), 100);
            }
            if (dailyPracticeHoursInput) {
                dailyPracticeHoursInput.value = (profile.daily_practice_hours !== null && profile.daily_practice_hours !== undefined) ? profile.daily_practice_hours : '';
            }
            if (daysPerWeekInput) {
                daysPerWeekInput.value = (profile.days_per_week_practising !== null && profile.days_per_week_practising !== undefined) ? profile.days_per_week_practising : '';
            }
            if (practiceRoutineTextarea) {
                practiceRoutineTextarea.value = profile.practice_routine_description || '';
            }
            if (bioInput) {
                bioInput.value = profile.biography || '';
            }
            if (notificationsCheckbox) {
                notificationsCheckbox.checked = profile.notifications_enabled !== null && profile.notifications_enabled !== undefined ? profile.notifications_enabled : false;
            }
            if (reminderHoursInput) {
                reminderHoursInput.value = (profile.reminder_hours !== null && profile.reminder_hours !== undefined) ? profile.reminder_hours : 24;
            }
            
            // Update large profile icon initials
            if (profileInitialsLarge && profile.name) {
                const initials = profile.name
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);
                profileInitialsLarge.textContent = initials || 'U';
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function updateProfile() {
    const currentUserId = localStorage.getItem('currentUserId');
    if (!currentUserId) {
        alert('Please sign in to update profile');
        return;
    }
    
    const name = document.getElementById('profile-edit-name').value.trim();
    const email = document.getElementById('profile-edit-email').value.trim();
    const date_of_birth = document.getElementById('profile-edit-dob').value;
    const gender = document.getElementById('profile-edit-gender').value;
    const primary_instrument = document.getElementById('profile-edit-primary-instrument').value;
    const age_commenced_playing = document.getElementById('profile-edit-age-commenced').value ? 
        parseInt(document.getElementById('profile-edit-age-commenced').value) : null;
    
    // Get selected secondary instruments from hidden input
    const secondaryInstrumentsHidden = document.getElementById('profile-edit-secondary-instruments');
    const selectedSecondary = secondaryInstrumentsHidden ? (secondaryInstrumentsHidden.value || null) : null;
    
    const daily_practice_hours = document.getElementById('profile-edit-daily-practice-hours').value ? 
        parseFloat(document.getElementById('profile-edit-daily-practice-hours').value) : null;
    const days_per_week_practising = document.getElementById('profile-edit-days-per-week').value ? 
        parseInt(document.getElementById('profile-edit-days-per-week').value) : null;
    const practice_routine_description = document.getElementById('profile-edit-practice-routine').value.trim();
    const biography = document.getElementById('profile-edit-bio').value.trim();
    const notifications_enabled = document.getElementById('profile-notifications-enabled').checked;
    const reminder_hours = parseInt(document.getElementById('profile-reminder-hours').value) || 24;
    
    try {
        const response = await fetch(`${API_BASE_URL}/profile?user_id=${currentUserId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                email: email || null,
                date_of_birth: date_of_birth || null,
                gender: gender && gender !== "" ? gender : null,
                primary_instrument: primary_instrument || null,
                age_commenced_playing: age_commenced_playing,
                secondary_instruments: selectedSecondary || null,
                daily_practice_hours: daily_practice_hours,
                days_per_week_practising: days_per_week_practising,
                practice_routine_description: practice_routine_description || null,
                biography: biography || null,
                notifications_enabled: notifications_enabled,
                reminder_hours: reminder_hours
            })
        });
        
        if (!response.ok) {
            let errorMessage = 'Failed to update profile';
            try {
                const errorData = await response.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
                
                // If profile not found, user might need to sign up again
                if (errorMessage.includes('Profile not found') || errorMessage.includes('not found')) {
                    errorMessage = 'Profile not found. You may need to sign up again. The database may have been reset.';
                }
            } catch (e) {
                errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const updated = await response.json();
        localStorage.setItem('currentUserName', updated.name);
        
        // Refresh profile display and UI
        await loadProfile();
        updateUserUI();
        
        alert('Profile updated successfully!');
    } catch (error) {
        console.error('Error updating profile:', error);
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            alert('Cannot connect to server. Please make sure the backend is running on http://localhost:8000');
        } else if (error.message.includes('Profile not found') || error.message.includes('database may have been reset')) {
            alert(error.message + '\n\nPlease sign out and sign up again to create a new profile.');
            // Optionally sign out the user
            signOut();
        } else {
            alert(`Failed to update profile: ${error.message}`);
        }
    }
}

// Helper function to remove accents from Spanish letters
function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Simulate profile data with random values
function simulateProfileData() {
    // Note: Name and email are not changed - they come from the user's account
    
    // Set random date of birth (between 18-65 years ago)
    const dobInput = document.getElementById('profile-edit-dob');
    if (dobInput) {
        const today = new Date();
        const yearsAgo = Math.floor(Math.random() * (65 - 18 + 1)) + 18;
        const birthDate = new Date(today.getFullYear() - yearsAgo, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
        dobInput.value = birthDate.toISOString().split('T')[0];
    }
    
    // Set random gender
    const genderSelect = document.getElementById('profile-edit-gender');
    if (genderSelect) {
        const genders = ["Male", "Female", "Non-binary", "Prefer not to say"];
        genderSelect.value = genders[Math.floor(Math.random() * genders.length)];
    }
    
    // Set random primary instrument (if instruments are loaded)
    const primaryInstrumentSelect = document.getElementById('profile-edit-primary-instrument');
    if (primaryInstrumentSelect && primaryInstrumentSelect.options.length > 1) {
        const options = Array.from(primaryInstrumentSelect.options).filter(opt => opt.value);
        if (options.length > 0) {
            primaryInstrumentSelect.value = options[Math.floor(Math.random() * options.length)].value;
        }
    }
    
    // Set random age commenced (between 5-25)
    const ageCommencedInput = document.getElementById('profile-edit-age-commenced');
    if (ageCommencedInput) {
        ageCommencedInput.value = Math.floor(Math.random() * (25 - 5 + 1)) + 5;
    }
    
    // Set random secondary instruments (1-3 instruments)
    const secondaryInstrumentsHidden = document.getElementById('profile-edit-secondary-instruments');
    if (secondaryInstrumentsHidden && instrumentsList.length > 0) {
        const numInstruments = Math.floor(Math.random() * 3) + 1; // 1-3 instruments
        const selected = [];
        const availableInstruments = [...instrumentsList];
        for (let i = 0; i < numInstruments && availableInstruments.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availableInstruments.length);
            selected.push(availableInstruments.splice(randomIndex, 1)[0]);
        }
        secondaryInstrumentsHidden.value = selected.join(', ');
        // Update the custom dropdown display
        if (typeof initCustomMultiSelect === 'function') {
            setTimeout(() => initCustomMultiSelect(), 100);
        }
    }
    
    // Set random daily practice hours (0.5 to 8 hours)
    const dailyPracticeHoursInput = document.getElementById('profile-edit-daily-practice-hours');
    if (dailyPracticeHoursInput) {
        dailyPracticeHoursInput.value = (Math.random() * 7.5 + 0.5).toFixed(1);
    }
    
    // Set random days per week (1-7)
    const daysPerWeekInput = document.getElementById('profile-edit-days-per-week');
    if (daysPerWeekInput) {
        daysPerWeekInput.value = Math.floor(Math.random() * 7) + 1;
    }
    
    // Set practice routine description
    const practiceRoutineTextarea = document.getElementById('profile-edit-practice-routine');
    if (practiceRoutineTextarea) {
        const routines = [
            "Warm-up exercises for 15 minutes, then scales and arpeggios, followed by repertoire practice.",
            "Start with technical exercises, then work on new pieces, and finish with old favorites.",
            "30 minutes of scales, then focus on challenging sections of current pieces.",
            "Warm-up, technique work, then sight-reading practice.",
            "Begin with finger exercises, practice assigned pieces, and end with improvisation."
        ];
        practiceRoutineTextarea.value = routines[Math.floor(Math.random() * routines.length)];
    }
    
    // Set biography
    const bioInput = document.getElementById('profile-edit-bio');
    if (bioInput) {
        const nameInput = document.getElementById('profile-edit-name');
        const firstName = nameInput ? nameInput.value.split(' ')[0] : 'musician';
        bioInput.value = `Musician and music enthusiast. Passionate about music and dedicated to continuous improvement.`;
    }
    
    // Set random notifications (true or false)
    const notificationsCheckbox = document.getElementById('profile-notifications-enabled');
    if (notificationsCheckbox) {
        notificationsCheckbox.checked = Math.random() > 0.5;
    }
    
    // Set random reminder hours (1-48 hours)
    const reminderHoursInput = document.getElementById('profile-reminder-hours');
    if (reminderHoursInput) {
        reminderHoursInput.value = Math.floor(Math.random() * 48) + 1;
    }
}

// Simulate signup data with random values
function simulateSignupData() {
    const nombres = ["Laura", "Carlos", "María", "Andrés", "Luisa", "Juan", "Sofía"];
    const apellidos = ["Pérez", "Gómez", "Rodríguez", "López", "Martínez"];
    
    // Generate random name
    const nombre = nombres[Math.floor(Math.random() * nombres.length)];
    const apellido = apellidos[Math.floor(Math.random() * apellidos.length)];
    const fullName = `${nombre} ${apellido}`;
    
    // Set name
    const nameInput = document.getElementById('signup-name');
    if (nameInput) nameInput.value = fullName;
    
    // Set email (based on name, without Spanish accents)
    const emailInput = document.getElementById('signup-email');
    if (emailInput) {
        const emailName = removeAccents(nombre.toLowerCase()) + '.' + removeAccents(apellido.toLowerCase());
        emailInput.value = `${emailName}@example.com`;
    }
    
    // Set password to always be "pa55word"
    const passwordInput = document.getElementById('signup-password');
    if (passwordInput) passwordInput.value = 'pa55word';
    
    const passwordConfirmInput = document.getElementById('signup-password-confirm');
    if (passwordConfirmInput) passwordConfirmInput.value = 'pa55word';
}

// Make functions available globally
window.editEquipment = editEquipment;
window.deleteEquipment = deleteEquipment;
window.addTaskForEquipment = addTaskForEquipment;
window.selectDate = selectDate;
window.openCompleteTaskModal = openCompleteTaskModal;
window.updateProfile = updateProfile;
window.signOut = signOut;
window.simulateProfileData = simulateProfileData;
window.simulateSignupData = simulateSignupData;
