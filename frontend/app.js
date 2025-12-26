/**
 * Practice Tracker - Main Application JavaScript
 * Handles instruments, tasks, calendar, and analytics
 */

const API_BASE_URL = 'http://localhost:8000/api';

// State
let instruments = [];
let tasks = [];
let practiceSessionDefinitions = []; // Practice session type definitions
let currentDate = new Date();
let selectedDate = null;
let currentView = 'calendar';
let calendarViewMode = localStorage.getItem('calendarViewMode') || 'month'; // 'day', 'week', 'month'
let editingInstrumentId = null;
let isOnline = navigator.onLine;
// No authentication - private app
let currentUserId = null;
let currentUserName = 'User';

// Filter state
let activeFilters = {
    instruments: [],
    taskTypes: ['Practice'],
    showCompleted: true
};

// Timer state
let timerStartTime = null;
let timerElapsedTime = 0;
let timerAnimationFrame = null;
let timerRunning = false;

// Total practice time (stored in milliseconds)
let totalPracticeTime = 0;

// Session time contributions (maps session ID to milliseconds contributed)
let sessionTimeContributions = {};

// DOM Elements (will be initialized on page load)
let statusIndicator, statusIcon, offlineIndicator, navButtons, views;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    statusIndicator = document.getElementById('status');
    statusIcon = document.getElementById('status-icon');
    offlineIndicator = document.getElementById('offline-indicator');
    navButtons = document.querySelectorAll('.nav-btn');
    views = document.querySelectorAll('.view');
    
    setupEventListeners();
    setupModals();
    setTodayDate();
    
    // Add click handler to status indicator for manual connection test
    if (statusIndicator) {
        statusIndicator.addEventListener('click', () => {
            console.log('Status icon clicked - checking connection...');
            console.log('Current statusIcon:', statusIcon);
            console.log('Current statusIcon src:', statusIcon ? statusIcon.src : 'N/A');
            updateStatus('connecting', 'Checking connection...');
            checkConnection();
        });
        statusIndicator.style.cursor = 'pointer';
    }
    
    // Test: Force connected state after 3 seconds for debugging
    setTimeout(() => {
        console.log('=== TEST: Forcing connected state ===');
        if (statusIcon) {
            console.log('Before test - statusIcon src:', statusIcon.src);
            updateStatus('connected', '✅ Database Connected (TEST)');
            console.log('After test - statusIcon src:', statusIcon.src);
        } else {
            console.error('statusIcon is null in test!');
        }
    }, 3000);
    
        // Initialize app - no authentication required
        updateUserUI();
        
        // Load data FIRST before switching views
        loadData().then(async () => {
            // Load total practice time from database
            await loadTotalPracticeTime();
            // Load practice session definitions
            await loadPracticeSessionDefinitions();
            console.log('Initial data load complete - Instruments:', instruments.length, 'Tasks:', tasks.length, 'Practice Types:', practiceSessionDefinitions.length);
            populateFilterInstruments();
            
            // Set initial view to calendar AFTER data is loaded
            switchView('calendar');
            
            // Force calendar render after data is loaded to ensure sessions show
            console.log('Forcing calendar render after data load with', tasks.length, 'tasks');
            renderCurrentCalendarView();
        }).catch((error) => {
            console.error('Initial data load failed:', error);
            // Even if load fails, switch to calendar view and render with empty data
            switchView('calendar');
            renderCurrentCalendarView();
        });
        
        // Check connection but don't block UI
        // Set initial status to connecting
        if (statusIndicator) {
            console.log('Status indicator found:', statusIndicator);
            updateStatus('connecting', 'Checking connection...');
        } else {
            console.error('Status indicator NOT found in DOM!');
        }
        
        // Check connection immediately
        checkConnection().catch((error) => {
            console.error('Initial connection check failed:', error);
            // Even if backend is unavailable, show UI
            updateStatus('disconnected', '⚠️ Server unavailable - Working offline');
        });
        
        // Check connection periodically (every 10 seconds)
        setInterval(() => {
            checkConnection().catch(() => {
                // Silently fail on periodic checks
            });
        }, 10000);
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
    document.getElementById('prev-period').addEventListener('click', () => {
        navigateCalendarPeriod(-1);
    });
    document.getElementById('next-period').addEventListener('click', () => {
        navigateCalendarPeriod(1);
    });
    document.getElementById('today-btn').addEventListener('click', () => {
        goToToday();
    });
    
    // View switcher
    document.querySelectorAll('.view-switch-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchCalendarView(btn.dataset.view);
        });
    });
    
    // Filter toggle
    document.getElementById('filter-toggle').addEventListener('click', () => {
        const content = document.getElementById('filter-content');
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });
    
    // Filter changes
    document.getElementById('filter-instruments').addEventListener('change', applyFilters);
    document.querySelectorAll('.filter-task-type').forEach(cb => {
        cb.addEventListener('change', applyFilters);
    });
    document.getElementById('filter-show-completed').addEventListener('change', applyFilters);
    document.getElementById('clear-filters').addEventListener('click', clearFilters);
    
    // Mini calendar toggle
    document.getElementById('mini-calendar-toggle').addEventListener('click', () => {
        const miniCal = document.getElementById('mini-calendar');
        miniCal.style.display = miniCal.style.display === 'none' ? 'block' : 'none';
        if (miniCal.style.display === 'block') {
            renderMiniCalendar();
        }
    });
    
    // Quick add task form
    document.getElementById('quick-add-task-form').addEventListener('submit', handleQuickAddTask);
    
    // Delete button in modify session modal
    document.getElementById('quick-add-task-delete-btn').addEventListener('click', handleDeleteSessionFromModal);
    
    // Timer buttons
    document.getElementById('timer-start-btn').addEventListener('click', startTimer);
    document.getElementById('timer-stop-btn').addEventListener('click', stopTimer);
    document.getElementById('timer-reset-btn').addEventListener('click', resetTimer);
    
    // Remove time button
    const removeTimeBtn = document.getElementById('remove-time-btn');
    if (removeTimeBtn) {
        removeTimeBtn.addEventListener('click', handleRemoveTimeFromSession);
    }
    
    // History button
    const historyBtn = document.getElementById('history-total-time-btn');
    if (historyBtn) {
        historyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openContributionHistory();
        });
    }
    
    // Reset total time button - show on double-click
    const totalTimeContainer = document.getElementById('total-practice-time');
    const resetTotalTimeBtn = document.getElementById('reset-total-time-btn');
    
    if (totalTimeContainer && resetTotalTimeBtn) {
        // Double-click on total time container to show/hide reset button
        totalTimeContainer.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const isVisible = resetTotalTimeBtn.style.display !== 'none';
            resetTotalTimeBtn.style.display = isVisible ? 'none' : 'inline-block';
        });
        
        // Click reset button to reset
        resetTotalTimeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetTotalPracticeTime();
            // Hide button after reset
            resetTotalTimeBtn.style.display = 'none';
        });
        
        // Hide reset button when clicking outside
        document.addEventListener('click', (e) => {
            if (!totalTimeContainer.contains(e.target) && resetTotalTimeBtn.style.display !== 'none') {
                resetTotalTimeBtn.style.display = 'none';
            }
        });
    }

    // Instrument form
    document.getElementById('instruments-form').addEventListener('submit', handleInstrumentSubmit);
    document.getElementById('add-instruments-btn').addEventListener('click', () => {
        openInstrumentModal();
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

    // No authentication forms needed
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
    
    // When task-def-modal opens, populate and set primary instrument
    const taskDefModal = document.getElementById('task-def-modal');
    if (taskDefModal) {
        // Use MutationObserver to detect when modal becomes visible
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const isVisible = taskDefModal.style.display === 'block' || 
                                     taskDefModal.classList.contains('active') ||
                                     !taskDefModal.classList.contains('hidden');
                    if (isVisible) {
                        // Modal is opening, populate instrument select with primary instrument
                        populateInstrumentSelect();
                    }
                }
            });
        });
        observer.observe(taskDefModal, { attributes: true, attributeFilter: ['style', 'class'] });
    }
}

// Connection Status
async function checkConnection() {
    try {
        console.log('Checking connection to:', `${API_BASE_URL}/health`);
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
            const healthData = await response.json();
            console.log('Health check response:', healthData);
            console.log('Database status:', healthData.database);
            
            // Check if database is connected
            if (healthData.database === 'connected') {
                console.log('✅ Database is CONNECTED - setting green status');
                updateStatus('connected', '✅ Database Connected');
                isOnline = true;
                if (offlineIndicator) offlineIndicator.style.display = 'none';
            } else {
                console.log('❌ Database is DISCONNECTED - status:', healthData.database);
                updateStatus('disconnected', '⚠️ Database Disconnected');
                isOnline = false;
                if (offlineIndicator) offlineIndicator.style.display = 'block';
            }
        } else {
            console.error('Health check failed with status:', response.status);
            throw new Error('Server error');
        }
    } catch (error) {
        console.error('Connection check error:', error);
        updateStatus('disconnected', '⚠️ Server unavailable - Working offline');
        isOnline = false;
        if (offlineIndicator) offlineIndicator.style.display = 'block';
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
    if (!statusIndicator) {
        console.error('statusIndicator element not found!');
        return;
    }
    
    // Re-fetch statusIcon if not found (in case DOM changed)
    if (!statusIcon) {
        statusIcon = document.getElementById('status-icon');
    }
    
    if (!statusIcon) {
        console.error('statusIcon element not found!');
        return;
    }
    
    console.log('updateStatus called:', status, message);
    console.log('Current icon src before update:', statusIcon.src);
    
    // Remove all status classes first
    statusIndicator.className = 'status-indicator';
    // Add the new status class
    statusIndicator.classList.add(status);
    
    // Always use the normal fall-out boy image
    const basePath = '/img/icons/';
    const newSrc = basePath + 'fall-out_boy_normal.png';
    statusIcon.src = newSrc;
    
    // Update alt text and title based on status
    if (status === 'connected') {
        statusIcon.alt = 'Database Connected';
        statusIcon.title = message || 'Database Connected';
    } else {
        statusIcon.alt = 'Database Disconnected';
        statusIcon.title = message || 'Connection Status';
    }
    
    // Force image reload
    statusIcon.onerror = function() {
        console.error('Failed to load icon image:', statusIcon.src);
    };
    
    console.log('Status updated - new icon src:', statusIcon.src);
    console.log('Status indicator classes:', statusIndicator.className);
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
    
    // Load view-specific data
    if (viewName === 'calendar') {
        // Initialize calendar with saved view mode
        switchCalendarView(calendarViewMode);
        // Populate filter instruments dropdown
        populateFilterInstruments();
        // Ensure tasks are loaded from database for calendar, then render
        if (tasks.length === 0) {
            // Only load if we don't have tasks yet
            loadTasks().then(() => {
                console.log('Tasks loaded for calendar view:', tasks.length);
                renderCurrentCalendarView();
            });
        } else {
            // Tasks already loaded, just render
            console.log('Tasks already loaded, rendering calendar with', tasks.length, 'tasks');
            renderCurrentCalendarView();
        }
    } else if (viewName === 'tasks') {
        // Ensure tasks are loaded from database first
        loadTasks().then(() => {
            // Then load filtered view
            loadTasksForFilter('today');
        });
    } else if (viewName === 'instruments') {
        // Ensure instruments are loaded before rendering
        if (instruments.length === 0) {
            console.log('No instruments loaded yet, loading now...');
            loadInstruments().then(() => {
                renderInstruments();
            });
        } else {
            renderInstruments(); // This is now async
        }
    } else if (viewName === 'stats') {
        loadAnalytics();
    } else if (viewName === 'profile') {
        loadProfile();
    } else if (viewName === 'credits') {
        // Credits view doesn't need special data loading
    }
}

// No authentication - private app
function updateUserUI() {
    // Profile access is via bottom navigation now
    // Status is shown as a green icon in the header
}

// Data Loading
async function loadData() {
    console.log('🔄 Starting data load...');
    await Promise.all([
        loadInstruments(),
        loadPracticeSessionDefinitions(),
        loadTasks()
    ]);
    
    console.log('✅ Data loaded - Instruments:', instruments.length, 'Practice Types:', practiceSessionDefinitions.length, 'Tasks:', tasks.length);
    
    // Verify tasks were loaded
    if (tasks.length === 0) {
        console.warn('⚠️ No tasks loaded! Check backend connection and database.');
    } else {
        console.log('✅ Tasks loaded successfully. Sample:', tasks.slice(0, 2).map(t => ({
            id: t.id,
            due_date: t.due_date,
            task_type: t.task_type
        })));
    }
    
    // Load dashboard metrics after data is loaded
    loadDashboardMetrics();
    
    // Always render current view after data load
    if (currentView === 'calendar') {
        console.log('📅 Rendering calendar view after data load with', tasks.length, 'tasks');
        renderCurrentCalendarView();
    } else if (currentView === 'tasks') {
        console.log('📋 Rendering tasks view after data load');
        const activeTab = document.querySelector('.task-tab.active') || document.querySelector('.task-tab[data-filter="today"]');
        if (activeTab) {
            loadTasksForFilter(activeTab.dataset.filter);
        }
    } else if (currentView === 'instruments') {
        renderInstruments();
    }
}

async function loadInstruments() {
    try {
        console.log('Loading instruments from:', `${API_BASE_URL}/instruments`);
        // No user filtering - private app
        const response = await fetch(`${API_BASE_URL}/instruments`);
        console.log('Instruments response status:', response.status, response.statusText);
        
        if (response.ok) {
            instruments = await response.json();
            console.log('Loaded instruments:', instruments.length, instruments);
            populateInstrumentSelect();
            
            // If we're on the instruments view, re-render
            if (currentView === 'instruments') {
                renderInstruments();
            }
        } else {
            const errorText = await response.text();
            console.error('Failed to load instruments. Status:', response.status, 'Error:', errorText);
            alert(`Failed to load instruments: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error loading instruments:', error);
        alert(`Error loading instruments: ${error.message}. Make sure the backend server is running at ${API_BASE_URL}`);
    }
    
    // Populate practice type dropdown
    await populatePracticeTypeSelect();
}

async function populatePracticeTypeSelect() {
    const select = document.getElementById('quick-task-type');
    if (!select) {
        console.error('❌ quick-task-type select element not found!');
        return;
    }
    
    console.log('🔄 populatePracticeTypeSelect called');
    
    // Ensure practice session definitions are loaded
    if (practiceSessionDefinitions.length === 0) {
        console.log('📥 Practice session definitions not loaded yet, loading now...');
        await loadPracticeSessionDefinitions();
    }
    
    // Populate dropdown with practice session definitions
    if (practiceSessionDefinitions.length === 0) {
        console.error('❌ No practice session definitions available!');
        select.innerHTML = '<option value="" disabled selected>No practice types available</option>';
        return;
    }
    
    console.log('📋 Populating dropdown with', practiceSessionDefinitions.length, 'definitions');
    
    // Build options HTML
    let optionsHtml = '';
    
    // Default to "Practice General" if it exists
    const practiceGeneral = practiceSessionDefinitions.find(def => def.name === 'Practice General');
    
    if (practiceGeneral) {
        // Set Practice General as the first selected option
        optionsHtml = `<option value="${practiceGeneral.id}" selected>${escapeHtml(practiceGeneral.name)}</option>`;
        // Add other options
        practiceSessionDefinitions.forEach(def => {
            if (def.id !== practiceGeneral.id) {
                optionsHtml += `<option value="${def.id}">${escapeHtml(def.name)}</option>`;
            }
        });
        console.log('✅ Set Practice General as default (id:', practiceGeneral.id, ')');
    } else {
        console.warn('⚠️ Practice General not found. Available:', practiceSessionDefinitions.map(d => d.name));
        // No default, just list all options
        optionsHtml = '<option value="" disabled selected>Select practice type...</option>' +
            practiceSessionDefinitions.map(def => 
                `<option value="${def.id}">${escapeHtml(def.name)}</option>`
            ).join('');
        
        // Try to select first option
        if (practiceSessionDefinitions.length > 0) {
            select.value = practiceSessionDefinitions[0].id;
            console.log('✅ Fallback: Set practice type to first available:', practiceSessionDefinitions[0].name);
        }
    }
    
    select.innerHTML = optionsHtml;
    
    // Ensure the value is set (in case innerHTML didn't work)
    if (practiceGeneral) {
        select.value = practiceGeneral.id;
    }
    
    console.log('✅ Populated practice type dropdown. Current value:', select.value, 'Options:', Array.from(select.options).map(o => `${o.value}:${o.text}`).join(', '));
}

async function loadPracticeSessionDefinitions() {
    try {
        console.log('📡 Loading practice session definitions from:', `${API_BASE_URL}/practice-session-definitions`);
        const response = await fetch(`${API_BASE_URL}/practice-session-definitions`, {
            cache: 'no-cache'
        });
        console.log('📡 Response status:', response.status, response.statusText);
        
        if (response.ok) {
            practiceSessionDefinitions = await response.json();
            console.log('✅ Practice session definitions loaded:', practiceSessionDefinitions.length, 'definitions');
            if (practiceSessionDefinitions.length > 0) {
                console.log('📋 Definitions:', practiceSessionDefinitions.map(d => `${d.name} (id: ${d.id})`).join(', '));
            } else {
                console.warn('⚠️ No practice session definitions found in database!');
            }
        } else {
            const errorText = await response.text();
            console.error('❌ Failed to load practice session definitions:', response.status, response.statusText);
            console.error('Error details:', errorText);
            practiceSessionDefinitions = [];
        }
    } catch (error) {
        console.error('❌ Error loading practice session definitions:', error);
        practiceSessionDefinitions = [];
    }
}

async function loadTasks() {
    try {
        console.log('Loading tasks from:', `${API_BASE_URL}/tasks`);
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            cache: 'no-cache' // Ensure fresh data on refresh
        });
        if (response.ok) {
            const loadedTasks = await response.json();
            tasks = loadedTasks; // Update the global tasks array
            console.log('Tasks loaded successfully:', tasks.length, 'sessions found');
            
            // Debug: Log first few tasks to see their structure
            if (tasks.length > 0) {
                console.log('Sample task data:', tasks[0]);
                console.log('Task dates:', tasks.slice(0, 5).map(t => ({ id: t.id, due_date: t.due_date, task_type: t.task_type, instrument_id: t.instrument_id })));
            } else {
                console.warn('⚠️ No tasks loaded from database!');
            }
            
            // Always re-render calendar if we're on calendar view to show updated sessions
            if (currentView === 'calendar') {
                console.log('📅 Rendering calendar after tasks loaded with', tasks.length, 'sessions');
                renderCurrentCalendarView();
            }
            // Also update tasks view if active
            if (currentView === 'tasks') {
                console.log('📋 Updating tasks view after tasks loaded');
                const activeTab = document.querySelector('.task-tab.active') || document.querySelector('.task-tab[data-filter="today"]');
                if (activeTab) {
                    loadTasksForFilter(activeTab.dataset.filter);
                }
            }
        } else {
            console.error('Failed to load tasks:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            tasks = []; // Reset to empty array on error
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
        tasks = []; // Reset to empty array on error
    }
}

// Instrument Management
async function renderInstruments() {
    // Render quick-add buttons for user's instruments
    await renderQuickAddInstrumentButtons();
    
    // Render instruments list
    const container = document.getElementById('instruments-list');
    
    if (instruments.length === 0) {
        container.innerHTML = '<p class="empty-state">No instruments yet. Add your first instrument!</p>';
        return;
    }
    
    container.innerHTML = instruments.map(instr => `
        <div class="instrument-card">
            <div class="instrument-header">
                <div>
                    <div class="instrument-name">${escapeHtml(instr.name)}</div>
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem;">
                        <span class="instrument-category">${escapeHtml(instr.category)}</span>
                        <span class="instrument-category" style="background: ${instr.instrument_type === 'Primary' ? '#4CAF50' : '#FF9800'}; color: white;">${escapeHtml(instr.instrument_type || 'Primary')}</span>
                    </div>
                </div>
                <div class="instrument-actions">
                    <button class="btn btn-secondary btn-small" onclick="editInstrument('${instr.id}')">Edit</button>
                    <button class="btn btn-primary btn-small" onclick="addTaskForInstrument('${instr.id}')">Add Task</button>
                    <button class="btn btn-danger btn-small" onclick="deleteInstrument('${instr.id}')">Delete</button>
                </div>
            </div>
            ${instr.notes ? `<div class="instrument-notes">${escapeHtml(instr.notes)}</div>` : ''}
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
    
    try {
        // Get first profile or create default
        const response = await fetch(`${API_BASE_URL}/profile`);
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
            
            // Filter out instruments that are already in the instruments list
            const existingInstrumentNames = instruments.map(instr => instr.name.toLowerCase());
            const instrumentsToShow = instruments.filter(inst => 
                !existingInstrumentNames.includes(inst.name.toLowerCase())
            );
            
            if (instrumentsToShow.length === 0) {
                container.innerHTML = '';
                return;
            }
            
            container.innerHTML = instrumentsToShow.map(inst => `
                <button class="quick-add-instrument-btn" onclick="quickAddInstrument('${escapeHtml(inst.name)}', '${inst.type}')">
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

async function quickAddInstrument(instrumentName, instrumentType) {
    // Determine category from instrument name
    const category = getInstrumentCategory(instrumentName);
    
    try {
        const response = await fetch(`${API_BASE_URL}/instruments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: instrumentName, 
                category: category, 
                instrument_type: instrumentType,
                notes: null
                // user_profile_id is optional - omit it for private app
            })
        });
        
        if (response.ok) {
            await loadInstruments();
            await renderInstruments();
        } else {
            const error = await response.json();
            alert(error.detail || 'Failed to add instrument');
        }
    } catch (error) {
        console.error('Error adding instrument:', error);
        alert('Failed to add instrument. Please try again.');
    }
}

async function handleInstrumentSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('instrument-name').value.trim();
    const category = document.getElementById('instrument-category').value;
    const instrumentType = document.getElementById('instrument-instrument-type').value;
    const notes = document.getElementById('instrument-notes').value.trim();
    
    // Validate required fields
    if (!name) {
        alert('Please enter an instrument name');
        return;
    }
    if (!category) {
        alert('Please select a category');
        return;
    }
    if (!instrumentType) {
        alert('Please select an instrument type');
        return;
    }
    
    try {
        // Build request body - ensure all values are correct types and match backend enums exactly
        const requestBody = { 
            name: name.trim(), 
            category: category, // Must match InstrumentCategory enum exactly
            instrument_type: instrumentType || 'Primary', // Must match InstrumentType enum: "Primary" or "Secondary"
            notes: notes ? notes.trim() : null
            // user_profile_id is optional - omit it for private app
        };
        
        console.log('Sending instruments request:', JSON.stringify(requestBody, null, 2));
        
        if (editingInstrumentId) {
            // Update
            let response;
            try {
                response = await fetch(`${API_BASE_URL}/instruments/${editingInstrumentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
            } catch (fetchError) {
                console.error('Fetch error:', fetchError);
                alert(`Failed to connect to server. Please make sure the backend is running at ${API_BASE_URL}.\n\nError: ${fetchError.message}`);
                return;
            }
            
            if (response.ok) {
                await loadInstruments();
                renderInstruments();
                closeModal('instruments-modal');
                editingInstrumentId = null;
            } else {
                let errorMessage = 'Failed to update instruments';
                try {
                    const errorData = await response.json();
                    // Handle FastAPI validation errors
                    if (errorData.detail) {
                        if (Array.isArray(errorData.detail)) {
                            // Validation errors come as an array
                            errorMessage = errorData.detail.map(err => 
                                `${err.loc ? err.loc.join('.') : 'field'}: ${err.msg || err.type || 'Invalid value'}`
                            ).join('\n');
                        } else {
                            errorMessage = errorData.detail;
                        }
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                console.error('Instrument update error:', errorMessage, 'Request body:', requestBody);
                alert(errorMessage);
            }
        } else {
            // Create - no user required
            let response;
            try {
                response = await fetch(`${API_BASE_URL}/instruments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
            } catch (fetchError) {
                console.error('Fetch error:', fetchError);
                alert(`Failed to connect to server. Please make sure the backend is running at ${API_BASE_URL}.\n\nError: ${fetchError.message}`);
                return;
            }
            
            if (response.ok) {
                await loadInstruments();
                renderInstruments();
                closeModal('instruments-modal');
            } else {
                let errorMessage = 'Failed to create instruments';
                try {
                    const errorData = await response.json();
                    // Handle FastAPI validation errors
                    if (errorData.detail) {
                        if (Array.isArray(errorData.detail)) {
                            // Validation errors come as an array
                            errorMessage = errorData.detail.map(err => 
                                `${err.loc ? err.loc.join('.') : 'field'}: ${err.msg || err.type || 'Invalid value'}`
                            ).join('\n');
                        } else {
                            errorMessage = errorData.detail;
                        }
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                console.error('Instrument creation error:', errorMessage, 'Request body:', requestBody);
                alert(errorMessage);
            }
        }
    } catch (error) {
        console.error('Error saving instruments:', error);
        alert(`Failed to save instruments: ${error.message || 'Please check your connection and try again.'}`);
    }
}

async function openInstrumentModal(instrumentsId = null) {
    // Reset form
    document.getElementById('instruments-form').reset();
    document.getElementById('instrument-instrument-type').value = 'Primary'; // Default to Primary
    
    editingInstrumentId = instrumentsId;
    const modal = document.getElementById('instruments-modal');
    const form = document.getElementById('instruments-form');
    const title = document.getElementById('instruments-modal-title');
    
    if (instrumentsId) {
        const instr = instruments.find(i => i.id === instrumentsId);
        title.textContent = 'Edit Instrument';
        document.getElementById('instrument-name').value = instr.name;
        document.getElementById('instrument-category').value = instr.category;
        document.getElementById('instrument-instrument-type').value = instr.instrument_type || 'Primary';
        document.getElementById('instrument-notes').value = instr.notes || '';
    } else {
        title.textContent = 'Add Instrument';
        form.reset();
        // Populate suggestions from user's profile instruments
        await populateInstrumentNameSuggestions();
    }
    
    openModal('instruments-modal');
}

async function populateInstrumentNameSuggestions() {
    const datalist = document.getElementById('instrument-name-suggestions');
    if (!datalist) {
        return;
    }
    
    // Clear existing options
    datalist.innerHTML = '';
    
    try {
        const response = await fetch(`${API_BASE_URL}/profile`);
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
        console.error('Error loading profile for instruments suggestions:', error);
        // Fail silently - suggestions are optional
    }
}

function editInstrument(id) {
    openInstrumentModal(id);
}

async function deleteInstrument(id) {
    if (!confirm('Are you sure you want to delete this instruments? This will also delete all related tasks.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/instruments/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadData();
            renderInstruments();
        }
    } catch (error) {
        console.error('Error deleting instruments:', error);
        alert('Failed to delete instruments.');
    }
}

async function populateInstrumentSelect() {
    const select = document.getElementById('task-instrument');
    if (!select) return;
    
    // Ensure instruments are loaded
    if (instruments.length === 0) {
        console.log('Instruments not loaded yet, loading now...');
        await loadInstruments();
    }
    
    select.innerHTML = '<option value="">Select instruments...</option>' +
        instruments.map(instr => `<option value="${instr.id}">${escapeHtml(instr.name)}</option>`).join('');
    
    // ALWAYS set default to Primary Instrument
    try {
        const response = await fetch(`${API_BASE_URL}/profile`);
        if (response.ok) {
            const profile = await response.json();
            console.log('Profile loaded:', profile);
            if (profile.primary_instrument) {
                // Find instrument that matches the primary instrument name
                const primaryInstrumentInstrument = instruments.find(instr => 
                    instr.name.toLowerCase() === profile.primary_instrument.toLowerCase()
                );
                
                if (primaryInstrumentInstrument) {
                    select.value = primaryInstrumentInstrument.id;
                    console.log('✅ Set task-def instrument to primary:', profile.primary_instrument, primaryInstrumentInstrument.id);
                } else {
                    console.warn('❌ Primary instrument not found in instruments list:', profile.primary_instrument, 'Available:', instruments.map(i => i.name));
                }
            } else {
                console.warn('⚠️ No primary instrument set in profile');
            }
        } else {
            console.error('Failed to load profile, status:', response.status);
        }
    } catch (error) {
        console.error('Error loading profile for default instrument:', error);
    }
}

async function populateQuickAddInstrumentSelect() {
    const select = document.getElementById('quick-task-instrument');
    if (!select) {
        console.error('quick-task-instrument select element not found!');
        return;
    }
    
    // ALWAYS ensure instruments are loaded first
    if (instruments.length === 0) {
        console.log('Instruments not loaded yet, loading now...');
        await loadInstruments();
    }
    
    // ALWAYS populate the dropdown with all instruments
    select.innerHTML = '<option value="">Select instruments...</option>' +
        instruments.map(instr => `<option value="${instr.id}">${escapeHtml(instr.name)}</option>`).join('');
    
    console.log('Populated dropdown with', instruments.length, 'instruments:', instruments.map(i => i.name));
    
    // ALWAYS set default to Primary Instrument (Trumpet)
    let instrumentSet = false;
    try {
        const response = await fetch(`${API_BASE_URL}/profile`);
        if (response.ok) {
            const profile = await response.json();
            console.log('Profile loaded, primary_instrument:', profile.primary_instrument);
            if (profile.primary_instrument) {
                // Find instrument that matches the primary instrument name
                const primaryInstrumentInstrument = instruments.find(instr => 
                    instr.name.toLowerCase() === profile.primary_instrument.toLowerCase()
                );
                
                if (primaryInstrumentInstrument) {
                    select.value = primaryInstrumentInstrument.id;
                    instrumentSet = true;
                    console.log('✅ Set quick-add instrument to primary:', profile.primary_instrument, primaryInstrumentInstrument.id);
                } else {
                    console.warn('❌ Primary instrument not found in instruments list:', profile.primary_instrument, 'Available:', instruments.map(i => i.name));
                }
            } else {
                console.warn('⚠️ No primary instrument set in profile');
            }
        } else {
            console.error('Failed to load profile, status:', response.status);
        }
    } catch (error) {
        console.error('Error loading profile for default instrument:', error);
    }
    
    // Fallback: If primary instrument wasn't set, try to find and set Trumpet
    if (!instrumentSet) {
        const trumpetInstrument = instruments.find(instr => 
            instr.name.toLowerCase() === 'trumpet'
        );
        if (trumpetInstrument) {
            select.value = trumpetInstrument.id;
            console.log('✅ Fallback: Set instrument to Trumpet');
        } else {
            console.warn('❌ Trumpet not found in instruments list. Available:', instruments.map(i => i.name));
        }
    }
}

async function addTaskForInstrument(instrumentsId) {
    await populateInstrumentSelect();
    // Override with the specific instrument if provided
    if (instrumentsId) {
        document.getElementById('task-instrument').value = instrumentsId;
    }
    openModal('task-def-modal');
}

async function handleTaskDefSubmit(e) {
    e.preventDefault();
    
    const instrumentId = parseInt(document.getElementById('task-instrument').value);
    const taskType = document.getElementById('task-type').value;
    const frequencyType = document.getElementById('task-frequency-type').value;
    const frequencyValue = parseInt(document.getElementById('task-frequency-value').value);
    const startDate = document.getElementById('task-start-date').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/task-definitions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instrument_id: instrumentId,
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
                renderCurrentCalendarView();
            } else if (currentView === 'instruments') {
                renderInstruments();
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

// View Management
function switchCalendarView(mode) {
    calendarViewMode = mode;
    localStorage.setItem('calendarViewMode', mode);
    
    // Update view switcher buttons
    document.querySelectorAll('.view-switch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });
    
    // Hide all views
    document.querySelectorAll('.calendar-view-content').forEach(view => {
        view.style.display = 'none';
    });
    
    // Show selected view
    const viewElement = document.getElementById(`${mode}-view`);
    if (viewElement) {
        viewElement.style.display = 'block';
    }
    
    // Render the selected view
    renderCurrentCalendarView();
}

function navigateCalendarPeriod(direction) {
    if (calendarViewMode === 'day') {
        currentDate.setDate(currentDate.getDate() + direction);
    } else if (calendarViewMode === 'week') {
        currentDate.setDate(currentDate.getDate() + (direction * 7));
    } else { // month
        currentDate.setMonth(currentDate.getMonth() + direction);
    }
    renderCurrentCalendarView();
}

function goToToday() {
    currentDate = new Date();
    selectedDate = currentDate.toISOString().split('T')[0];
    renderCurrentCalendarView();
}

function renderCurrentCalendarView() {
    // Ensure tasks are loaded (at least check if array exists)
    if (!Array.isArray(tasks)) {
        console.error('❌ Tasks array is not initialized! Initializing to empty array.');
        tasks = [];
    }
    
    console.log('renderCurrentCalendarView - Tasks available:', tasks.length);
    if (tasks.length > 0) {
        console.log('Sample task dates:', tasks.slice(0, 3).map(t => ({ 
            id: t.id, 
            due_date: t.due_date, 
            task_type: t.task_type,
            completed: t.completed 
        })));
    }
    
    if (calendarViewMode === 'day') {
        renderDayView(selectedDate || currentDate);
    } else if (calendarViewMode === 'week') {
        renderWeekView(currentDate);
    } else {
        renderMonthView();
    }
    updateCalendarHeader();
    renderMiniCalendar();
    
    // Show tasks for selected date in month/week view
    if (selectedDate && (calendarViewMode === 'month' || calendarViewMode === 'week')) {
        showTasksForDate(selectedDate);
    }
}

function updateCalendarHeader() {
    const periodElement = document.getElementById('current-period');
    if (!periodElement) return;
    
    if (calendarViewMode === 'day') {
        const date = selectedDate ? new Date(selectedDate + 'T00:00:00') : currentDate;
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        periodElement.textContent = date.toLocaleDateString('en-US', options);
    } else if (calendarViewMode === 'week') {
        const weekStart = getWeekStart(currentDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        periodElement.textContent = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        periodElement.textContent = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

// Day View
function renderDayView(date) {
    const targetDate = date instanceof Date ? date : new Date(date + 'T00:00:00');
    selectedDate = targetDate.toISOString().split('T')[0];
    
    // Update day view header
    const dayHeader = document.querySelector('.day-view-date');
    if (dayHeader) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dayHeader.textContent = targetDate.toLocaleDateString('en-US', options);
    }
    
    // Get filtered tasks for this date
    const filteredTasks = getFilteredTasks();
    const dayTasks = filteredTasks.filter(t => {
        if (!t.due_date) return false;
        // Normalize the task's due_date to YYYY-MM-DD format
        const taskDate = t.due_date.split('T')[0]; // Remove time if present
        return taskDate === selectedDate;
    });
    const allDayTasks = dayTasks.filter(t => !t.completed || activeFilters.showCompleted);
    const completedTasks = dayTasks.filter(t => t.completed);
    
    // Render all-day tasks
    const allDayContainer = document.getElementById('all-day-tasks');
    if (allDayContainer) {
        if (allDayTasks.length === 0) {
            allDayContainer.innerHTML = '<p class="empty-state">No tasks for this day</p>';
        } else {
            allDayContainer.innerHTML = allDayTasks.map(task => renderEnhancedTaskCard(task, true)).join('');
        }
    }
    
    // Render time slots (6 AM to 11 PM)
    const timeSlotsContainer = document.getElementById('time-slots');
    if (timeSlotsContainer) {
        let html = '';
        const now = new Date();
        const isToday = selectedDate === now.toISOString().split('T')[0];
        
        for (let hour = 6; hour <= 23; hour++) {
            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
            const slotDate = new Date(targetDate);
            slotDate.setHours(hour, 0, 0, 0);
            
            // Check if current time is in this slot
            const isCurrentHour = isToday && now.getHours() === hour;
            
            html += `
                <div class="hour-row ${isCurrentHour ? 'current-hour' : ''}" data-hour="${hour}">
                    <div class="hour-label">${formatHour(hour)}</div>
                    <div class="hour-content" onclick="createTaskFromCalendar('${selectedDate}', ${hour})">
                        <div class="current-time-indicator" style="display: ${isCurrentHour && now.getMinutes() > 0 ? 'block' : 'none'}; top: ${(now.getMinutes() / 60) * 100}%;"></div>
                    </div>
                </div>
            `;
        }
        timeSlotsContainer.innerHTML = html;
    }
    
    // Show tasks for selected date
    showTasksForDate(selectedDate);
}

function formatHour(hour) {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
}

// Week View
function renderWeekView(startDate) {
    const weekStart = getWeekStart(startDate);
    const weekDays = [];
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        weekDays.push(day);
    }
    
    const grid = document.getElementById('week-view-grid');
    if (!grid) return;
    
    let html = '<div class="week-day-header"></div>'; // Empty corner cell
    
    // Day headers
    weekDays.forEach(day => {
        const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = day.getDate();
        const dateStr = day.toISOString().split('T')[0];
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        const isSelected = selectedDate === dateStr;
        
        html += `
            <div class="week-day-header ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
                 onclick="selectDate('${dateStr}')">
                <div class="week-day-name">${dayName}</div>
                <div class="week-day-number">${dayNum}</div>
            </div>
        `;
    });
    
    // Time slots column
    for (let hour = 6; hour <= 23; hour++) {
        html += `<div class="week-hour-label">${formatHour(hour)}</div>`;
        
        // Day columns
        weekDays.forEach(day => {
            const dateStr = day.toISOString().split('T')[0];
            const filteredTasks = getFilteredTasks();
            const dayTasks = filteredTasks.filter(t => {
                if (!t.due_date) return false;
                // Normalize the task's due_date to YYYY-MM-DD format
                const taskDate = t.due_date.split('T')[0]; // Remove time if present
                return taskDate === dateStr;
            });
            const hourTasks = dayTasks; // For now, all tasks shown (can be filtered by time later)
            
            html += `
                <div class="week-day-cell" data-date="${dateStr}" data-hour="${hour}" 
                     onclick="createTaskFromCalendar('${dateStr}', ${hour})">
                    ${hourTasks.length > 0 ? hourTasks.map(t => renderTaskMiniCard(t)).join('') : ''}
                </div>
            `;
        });
    }
    
    grid.innerHTML = html;
}

// Enhanced Month View
function renderMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    
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
    
    console.log('Rendering month view for:', year, month + 1);
    console.log('Total tasks available:', tasks.length);
    
    const filteredTasks = getFilteredTasks();
    console.log('renderMonthView - Total tasks:', tasks.length, 'Filtered tasks:', filteredTasks.length);
    
    // Debug: Log all task dates to see what we have
    if (filteredTasks.length > 0) {
        console.log('All filtered task dates:', filteredTasks.map(t => ({ 
            due_date: t.due_date, 
            normalized: t.due_date ? t.due_date.split('T')[0] : 'NO DATE',
            task_type: t.task_type,
            completed: t.completed 
        })));
    }
    
    // Special debug for December 23rd
    const dec23Tasks = filteredTasks.filter(t => {
        if (!t.due_date) return false;
        const taskDate = t.due_date.split('T')[0];
        return taskDate === '2024-12-23' || taskDate === '2025-12-23';
    });
    if (dec23Tasks.length > 0) {
        console.log('🔍 Found tasks for Dec 23:', dec23Tasks.length, dec23Tasks);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Normalize date comparison - handle both YYYY-MM-DD and other formats
        const dayTasks = filteredTasks.filter(t => {
            if (!t.due_date) {
                console.warn('Task with no due_date:', t);
                return false;
            }
            // Normalize the task's due_date to YYYY-MM-DD format
            const taskDate = t.due_date.split('T')[0]; // Remove time if present
            const matches = taskDate === dateStr;
            if (matches && dateStr === '2024-12-23') {
                console.log('✅ Match found for Dec 23:', t);
            }
            return matches;
        });
        
        const pendingTasks = dayTasks.filter(t => !t.completed);
        const completedTasks = dayTasks.filter(t => t.completed);
        const isToday = dateStr === todayStr;
        const isSelected = selectedDate === dateStr;
        
        const taskCount = pendingTasks.length;
        const completedCount = completedTasks.length;
        const totalCount = dayTasks.length;
        
        // Debug: Log if tasks found for this day (especially Dec 23)
        if (totalCount > 0 || dateStr === '2024-12-23' || dateStr === '2025-12-23') {
            console.log(`Date ${dateStr}: Found ${totalCount} tasks (${taskCount} pending, ${completedCount} completed)`, 
                totalCount > 0 ? dayTasks.map(t => ({ id: t.id, due_date: t.due_date, completed: t.completed })) : 'NO TASKS');
        }
        
        // Create horizontal lines for each practice session
        let taskDisplay = '';
        if (totalCount > 0) {
            // Show pending tasks as blue lines - clicking opens modify dialog
            pendingTasks.forEach((task, index) => {
                const hasContributed = hasSessionContributed(task.id);
                const contributedClass = hasContributed ? 'has-contributed' : '';
                const checkmarkIcon = hasContributed ? '<span class="contribution-checkmark">✓</span>' : '';
                taskDisplay += `<div class="practice-session-line ${contributedClass}" data-task-id="${task.id}" onclick="event.stopPropagation(); openModifySessionModal('${task.id}');" title="Click to modify practice session${hasContributed ? ' (Time logged)' : ''}">${checkmarkIcon}</div>`;
            });
            // Show completed tasks as gray lines if enabled
            if (activeFilters.showCompleted) {
                completedTasks.forEach((task, index) => {
                    const hasContributed = hasSessionContributed(task.id);
                    const contributedClass = hasContributed ? 'has-contributed' : '';
                    const checkmarkIcon = hasContributed ? '<span class="contribution-checkmark">✓</span>' : '';
                    taskDisplay += `<div class="practice-session-line completed ${contributedClass}" data-task-id="${task.id}" onclick="event.stopPropagation(); openModifySessionModal('${task.id}');" title="Click to modify completed practice session${hasContributed ? ' (Time logged)' : ''}">${checkmarkIcon}</div>`;
                });
            }
        }
        
        grid.innerHTML += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
                 data-date="${dateStr}" onclick="selectDate('${dateStr}')" 
                 draggable="false" ondrop="handleTaskDrop(event)" ondragover="event.preventDefault()">
                <div class="calendar-day-number">${day}</div>
                <div class="calendar-day-tasks">${taskDisplay}</div>
            </div>
        `;
    }
    
    console.log('Month view rendering complete');
    
    // Show tasks for selected date if one is selected
    if (selectedDate) {
        showTasksForDate(selectedDate);
    }
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    if (calendarViewMode === 'day') {
        renderDayView(dateStr);
    } else {
        renderCurrentCalendarView();
    }
    showTasksForDate(dateStr);
    // Open the "Add Session" dialog with the selected date pre-filled
    createTaskFromCalendar(dateStr);
}

function selectDateAndShowTasks(dateStr) {
    // Select the date and show tasks without opening the dialog
    selectedDate = dateStr;
    if (calendarViewMode === 'day') {
        renderDayView(dateStr);
    } else {
        renderCurrentCalendarView();
    }
    showTasksForDate(dateStr);
}

// Filtering
function getFilteredTasks() {
    let filtered = [...tasks];
    
    console.log('getFilteredTasks - Total tasks:', tasks.length, 'Active filters:', activeFilters);
    
    // Check if tasks array is empty
    if (tasks.length === 0) {
        console.warn('⚠️ No tasks available to filter!');
        return filtered;
    }
    
    // Debug: Log task structure
    if (tasks.length > 0) {
        console.log('Sample task fields:', Object.keys(tasks[0]));
        console.log('Sample task:', { 
            id: tasks[0].id, 
            due_date: tasks[0].due_date, 
            task_type: tasks[0].task_type, 
            instrument_id: tasks[0].instrument_id,
            completed: tasks[0].completed 
        });
    }
    
    // Filter by instruments
    if (activeFilters.instruments.length > 0) {
        const beforeCount = filtered.length;
        filtered = filtered.filter(t => activeFilters.instruments.includes(t.instrument_id));
        console.log(`Instrument filter: ${beforeCount} -> ${filtered.length} tasks`);
        if (filtered.length === 0 && beforeCount > 0) {
            console.warn('⚠️ Instrument filter removed ALL tasks! Active instrument filters:', activeFilters.instruments);
        }
    }
    
    // Filter by task type
    if (activeFilters.taskTypes.length > 0) {
        const beforeCount = filtered.length;
        filtered = filtered.filter(t => activeFilters.taskTypes.includes(t.task_type));
        console.log(`Task type filter (${activeFilters.taskTypes.join(', ')}): ${beforeCount} -> ${filtered.length} tasks`);
        if (filtered.length === 0 && beforeCount > 0) {
            console.warn('⚠️ Task type filter removed ALL tasks! Active task type filters:', activeFilters.taskTypes);
            console.warn('Available task types in data:', [...new Set(tasks.map(t => t.task_type))]);
        }
    }
    
    // Filter by completed status
    if (!activeFilters.showCompleted) {
        const beforeCount = filtered.length;
        filtered = filtered.filter(t => !t.completed);
        console.log(`Completed filter: ${beforeCount} -> ${filtered.length} tasks`);
    }
    
    console.log('getFilteredTasks - Final filtered tasks:', filtered.length);
    
    // Warning if all tasks were filtered out
    if (filtered.length === 0 && tasks.length > 0) {
        console.error('❌ All tasks were filtered out! Check filter settings.');
    }
    
    return filtered;
}

function applyFilters() {
    // Update instruments filter
    const instrumentsSelect = document.getElementById('filter-instruments');
    activeFilters.instruments = Array.from(instrumentsSelect.selectedOptions)
        .map(opt => opt.value)
        .filter(v => v);
    
    // Update task type filter
    activeFilters.taskTypes = Array.from(document.querySelectorAll('.filter-task-type:checked'))
        .map(cb => cb.value);
    
    // Update completed filter
    activeFilters.showCompleted = document.getElementById('filter-show-completed').checked;
    
    // Re-render current view
    renderCurrentCalendarView();
}

function clearFilters() {
    activeFilters = {
        instruments: [],
        taskTypes: ['Practice'],
        showCompleted: true
    };
    
    // Reset UI
    document.getElementById('filter-instruments').selectedIndex = -1;
    document.querySelectorAll('.filter-task-type').forEach(cb => cb.checked = true);
    document.getElementById('filter-show-completed').checked = true;
    
    applyFilters();
}

// Task Creation from Calendar
async function createTaskFromCalendar(date, hour) {
    const modal = document.getElementById('quick-add-task-modal');
    const dateInput = document.getElementById('quick-task-date');
    
    // Always default to current date and time with full precision including milliseconds
    const now = new Date();
    // Format for datetime-local with step="0.001" supports milliseconds: YYYY-MM-DDTHH:mm:ss.sss
    // But browser support varies, so we'll format it manually
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    
    // Format: YYYY-MM-DDTHH:mm:ss.sss
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
    
    if (date && hour !== undefined) {
        // If date and hour provided (from calendar click), use those with current time/seconds/ms
        const dateTimeString = `${date}T${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${milliseconds}`;
        dateInput.value = dateTimeString;
    } else if (date) {
        // If only date provided, use date with current time including seconds and milliseconds
        const dateTimeString = `${date}T${hours}:${minutes}:${seconds}.${milliseconds}`;
        dateInput.value = dateTimeString;
    } else {
        // Use current date and time with full precision (includes seconds and milliseconds)
        dateInput.value = currentDateTime;
    }
    
    // ALWAYS ensure instruments are loaded and dropdown is populated
    // Populate instruments dropdown - will default to primary instrument (Trumpet)
    await populateQuickAddInstrumentSelect();
    
    // Double-check: Ensure instrument is set (fallback to Trumpet if needed)
    const quickTaskInstrumentSelect = document.getElementById('quick-task-instrument');
    if (quickTaskInstrumentSelect && !quickTaskInstrumentSelect.value) {
        console.log('Instrument not set, trying to set Trumpet...');
        const trumpetInstrument = instruments.find(instr => 
            instr.name.toLowerCase() === 'trumpet'
        );
        if (trumpetInstrument) {
            quickTaskInstrumentSelect.value = trumpetInstrument.id;
            console.log('✅ Force-set instrument to Trumpet');
        }
    }
    
    // Populate and set practice type to default (Practice General)
    await populatePracticeTypeSelect();
    
    // Update full datetime display
    updateFullDateTimeDisplay();
    
    // Add event listeners to update display when values change
    dateInput.addEventListener('change', updateFullDateTimeDisplay);
    dateInput.addEventListener('input', updateFullDateTimeDisplay);
    
    // Set modal to "Add" mode
    setModalMode('add');
    // Hide contribution indicator for new sessions
    const indicator = document.getElementById('contribution-indicator');
    if (indicator) indicator.style.display = 'none';
    // Reset timer when opening modal
    resetTimer();
    openModal('quick-add-task-modal');
}

async function openModifySessionModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        console.error('Task not found:', taskId);
        return;
    }
    
    const modal = document.getElementById('quick-add-task-modal');
    const dateInput = document.getElementById('quick-task-date');
    const instrumentSelect = document.getElementById('quick-task-instrument');
    const taskTypeSelect = document.getElementById('quick-task-type');
    
    // Populate instruments dropdown first
    await populateQuickAddInstrumentSelect();
    
    // Populate practice type dropdown
    await populatePracticeTypeSelect();
    
    // Set form values from task
    if (task.due_date) {
        // Convert task due_date to datetime-local format
        const taskDate = new Date(task.due_date);
        const year = taskDate.getFullYear();
        const month = String(taskDate.getMonth() + 1).padStart(2, '0');
        const day = String(taskDate.getDate()).padStart(2, '0');
        const hours = String(taskDate.getHours()).padStart(2, '0');
        const minutes = String(taskDate.getMinutes()).padStart(2, '0');
        const seconds = String(taskDate.getSeconds()).padStart(2, '0');
        const milliseconds = String(taskDate.getMilliseconds()).padStart(3, '0');
        dateInput.value = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
    }
    
    if (task.instrument_id && instrumentSelect) {
        instrumentSelect.value = task.instrument_id;
    }
    
    // Set practice type from practice_session_definition_id
    if (task.practice_session_definition_id && taskTypeSelect) {
        taskTypeSelect.value = task.practice_session_definition_id;
    } else if (task.task_type && taskTypeSelect) {
        // Fallback: try to find by name if we have task_type
        const practiceDef = practiceSessionDefinitions.find(def => def.name === task.task_type);
        if (practiceDef) {
            taskTypeSelect.value = practiceDef.id;
        }
    }
    
    // Store task ID for later use
    modal.dataset.taskId = taskId;
    
    // Set modal to "Modify" mode
    setModalMode('modify', taskId);
    
    // Update contribution indicator if session has contributed time
    updateContributionIndicator(taskId);
    
    // Update full datetime display
    updateFullDateTimeDisplay();
    
    // Add event listeners to update display when values change
    dateInput.addEventListener('change', updateFullDateTimeDisplay);
    dateInput.addEventListener('input', updateFullDateTimeDisplay);
    
    // Reset timer when opening modify modal
    resetTimer();
    openModal('quick-add-task-modal');
}

async function deleteSession(taskId) {
    try {
        console.log('Deleting task:', taskId);
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            console.log('Task deleted successfully');
            
            // Remove contribution record and subtract from total if session contributed time
            // Normalize taskId to string for consistent lookup
            const normalizedId = String(taskId);
            
            if (sessionTimeContributions[normalizedId] && sessionTimeContributions[normalizedId] > 0) {
                const contributedTime = sessionTimeContributions[normalizedId];
                console.log(`Found contribution for session ${taskId}: ${formatTimerTime(contributedTime)}`);
                
                // Subtract the contributed time from total
                const oldTotal = totalPracticeTime;
                totalPracticeTime = Math.max(0, totalPracticeTime - contributedTime);
                saveTotalPracticeTime();
                updateTotalTimeDisplay();
                
                // Remove contribution record
                delete sessionTimeContributions[normalizedId];
                saveSessionContributions();
                
                console.log(`Removed ${formatTimerTime(contributedTime)} from total. Old total: ${formatTimerTime(oldTotal)}, New total: ${formatTimerTime(totalPracticeTime)}`);
            } else {
                console.log(`No contribution found for session ${taskId}. Contributions:`, Object.keys(sessionTimeContributions));
            }
            
            await loadTasks();
            closeModal('quick-add-task-modal');
            if (currentView === 'calendar') {
                renderCurrentCalendarView();
                // Refresh the selected date tasks view if a date is selected
                if (selectedDate) {
                    showTasksForDate(selectedDate);
                }
            } else if (currentView === 'tasks') {
                const activeTab = document.querySelector('.task-tab.active');
                loadTasksForFilter(activeTab.dataset.filter);
            }
            alert('Session deleted successfully!');
        } else {
            const errorText = await response.text();
            console.error('Failed to delete task:', response.status, errorText);
            alert(`Failed to delete session: ${response.status} ${response.statusText}\n\n${errorText}`);
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        alert(`Failed to delete session: ${error.message}\n\nMake sure the backend server is running at ${API_BASE_URL}`);
    }
}

async function handleDeleteSessionFromModal(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const modal = document.getElementById('quick-add-task-modal');
    const taskId = modal.dataset.taskId;
    
    if (!taskId) {
        console.error('No task ID found in modal');
        return;
    }
    
    if (confirm('Are you sure you want to delete this practice session?')) {
        await deleteSession(taskId);
    }
}

function setModalMode(mode, taskId = null) {
    const modal = document.getElementById('quick-add-task-modal');
    const title = document.getElementById('quick-add-task-modal-title');
    const submitBtn = document.getElementById('quick-add-task-submit-btn');
    const deleteBtn = document.getElementById('quick-add-task-delete-btn');
    const timerContainer = document.getElementById('timer-container');
    const editableTimeContainer = document.getElementById('editable-time-container');
    const editableTimeInput = document.getElementById('editable-time-input');
    const timerLabel = document.getElementById('timer-label');
    
    if (mode === 'modify') {
        title.textContent = 'Modify Session';
        submitBtn.textContent = 'Update Session';
        deleteBtn.style.display = 'inline-block';
        if (taskId) {
            modal.dataset.taskId = taskId;
        }
        // Add class to differentiate modify mode styling
        modal.classList.add('modify-mode');
        
        // Hide timer, show editable time input
        if (timerContainer) timerContainer.style.display = 'none';
        if (editableTimeContainer) editableTimeContainer.style.display = 'block';
        if (timerLabel) timerLabel.textContent = 'Logged Practice Time';
        
        // Populate editable time input with current contribution if exists
        if (editableTimeInput && taskId) {
            const contributedTime = getSessionContributedTime(taskId);
            if (contributedTime > 0) {
                editableTimeInput.value = formatTimerTime(contributedTime);
            } else {
                editableTimeInput.value = '00:00:00';
            }
            // Ensure input is enabled and focusable
            editableTimeInput.disabled = false;
            editableTimeInput.readOnly = false;
            editableTimeInput.style.pointerEvents = 'auto';
            editableTimeInput.style.cursor = 'text';
            // Focus the input for easy editing
            setTimeout(() => {
                editableTimeInput.focus();
                editableTimeInput.select();
            }, 100);
        }
    } else {
        title.textContent = 'Add Session';
        submitBtn.textContent = 'Add Session';
        deleteBtn.style.display = 'none';
        delete modal.dataset.taskId;
        // Remove modify mode class
        modal.classList.remove('modify-mode');
        
        // Show timer, hide editable time input
        if (timerContainer) timerContainer.style.display = 'flex';
        if (editableTimeContainer) editableTimeContainer.style.display = 'none';
        if (timerLabel) timerLabel.textContent = 'Practice Timer';
        if (editableTimeInput) editableTimeInput.value = '';
    }
}

// High-Precision Timer Functions
function formatTimerTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor(milliseconds % 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if (!display) return;
    
    let elapsed = timerElapsedTime;
    if (timerRunning && timerStartTime !== null) {
        // Use performance.now() for high precision
        const currentTime = performance.now();
        elapsed = timerElapsedTime + (currentTime - timerStartTime);
    }
    
    display.textContent = formatTimerTime(elapsed);
    
    if (timerRunning) {
        timerAnimationFrame = requestAnimationFrame(updateTimerDisplay);
    }
}

function startTimer() {
    if (timerRunning) return;
    
    timerRunning = true;
    timerStartTime = performance.now();
    
    const startBtn = document.getElementById('timer-start-btn');
    const stopBtn = document.getElementById('timer-stop-btn');
    
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-block';
    
    updateTimerDisplay();
}

function stopTimer() {
    if (!timerRunning) return;
    
    // Update elapsed time before stopping
    if (timerStartTime !== null) {
        const currentTime = performance.now();
        timerElapsedTime += (currentTime - timerStartTime);
    }
    
    // Get current session ID if in modify mode
    const modal = document.getElementById('quick-add-task-modal');
    const sessionId = modal ? modal.dataset.taskId : null;
    
    // Note: Duration will be saved to database when session is created/updated
    // Total time will be recalculated from database
    console.log('Timer stopped. Elapsed time:', formatTimerTime(timerElapsedTime));
    
    timerRunning = false;
    timerStartTime = null;
    
    if (timerAnimationFrame) {
        cancelAnimationFrame(timerAnimationFrame);
        timerAnimationFrame = null;
    }
    
    const startBtn = document.getElementById('timer-start-btn');
    const stopBtn = document.getElementById('timer-stop-btn');
    
    if (startBtn) startBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'none';
    
    // Final update
    updateTimerDisplay();
}

function resetTimer() {
    stopTimer();
    timerElapsedTime = 0;
    
    const display = document.getElementById('timer-display');
    if (display) {
        display.textContent = '00:00:00.000';
    }
}

// Total Practice Time Functions
function loadTotalPracticeTime() {
    const saved = localStorage.getItem('totalPracticeTime');
    if (saved) {
        totalPracticeTime = parseInt(saved, 10) || 0;
    } else {
        totalPracticeTime = 0;
    }
    updateTotalTimeDisplay();
    
    // Load session contributions
    loadSessionContributions();
}

function saveTotalPracticeTime() {
    // No longer saving to localStorage - total is calculated from database
    // This function kept for compatibility but does nothing
    console.log('Total practice time is calculated from database, not stored in localStorage');
}

function addToTotalPracticeTime(milliseconds, sessionId = null) {
    // Note: This function is kept for compatibility but total time is now calculated from database
    // The duration should be saved to the database when the session is created/updated
    // Reload total time from database after session operations
    console.log(`Time added (will be recalculated from database): ${formatTimerTime(milliseconds)} for session ${sessionId}`);
    
    // Reload from database to get accurate total
    loadTotalPracticeTime();
}

// Session Contribution Tracking Functions - Now reads from database
async function loadSessionContributions() {
    // Load all practice sessions and extract their duration values
    try {
        console.log('Loading session contributions from database...');
        const response = await fetch(`${API_BASE_URL}/practice-sessions`, {
            cache: 'no-cache'
        });
        if (response.ok) {
            const sessions = await response.json();
            sessionTimeContributions = {};
            
            // Build contributions map from database sessions
            sessions.forEach(session => {
                if (session.duration && session.duration > 0) {
                    const normalizedId = String(session.id);
                    sessionTimeContributions[normalizedId] = session.duration;
                }
            });
            
            console.log('Session contributions loaded from database:', Object.keys(sessionTimeContributions).length, 'sessions with duration');
        } else {
            console.error('Failed to load session contributions:', response.status);
            sessionTimeContributions = {};
        }
    } catch (error) {
        console.error('Error loading session contributions:', error);
        sessionTimeContributions = {};
    }
}

function saveSessionContributions() {
    // No longer saving to localStorage - data is in database
    // This function kept for compatibility but does nothing
    console.log('Session contributions are stored in database, not localStorage');
}

function hasSessionContributed(sessionId) {
    if (!sessionId) return false;
    const normalizedId = String(sessionId);
    return sessionTimeContributions[normalizedId] && sessionTimeContributions[normalizedId] > 0;
}

function getSessionContributedTime(sessionId) {
    if (!sessionId) return 0;
    const normalizedId = String(sessionId);
    return sessionTimeContributions[normalizedId] || 0;
}

function formatTotalTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    // Format as HH:MM:SS
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateTotalTimeDisplay() {
    const display = document.getElementById('total-time-display');
    if (display) {
        display.textContent = formatTotalTime(totalPracticeTime);
    }
}

async function resetTotalPracticeTime() {
    if (!confirm('Are you sure you want to reset all practice session durations to zero?\n\nThis will set duration to null for ALL sessions in the database. This cannot be undone.')) {
        return;
    }
    
    // Set all session durations to null in database
    try {
        const sessionsWithDuration = tasks.filter(t => t.duration && t.duration > 0);
        
        if (sessionsWithDuration.length === 0) {
            alert('No sessions with duration found.');
            return;
        }
        
        // Update each session to remove duration
        for (const session of sessionsWithDuration) {
            const response = await fetch(`${API_BASE_URL}/practice-sessions/${session.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instrument_id: session.instrument_id,
                    practice_session_definition_id: session.practice_session_definition_id || '',
                    due_date: session.due_date,
                    start_time: session.start_time || null,
                    end_time: session.end_time || null,
                    duration: null, // Remove duration
                    notes: session.notes || null
                })
            });
            
            if (!response.ok) {
                console.error(`Failed to reset duration for session ${session.id}`);
            }
        }
        
        // Reload total time from database (should now be 0)
        await loadTotalPracticeTime();
        
        // Reload tasks to get updated data
        await loadTasks();
        
        // Refresh calendar view
        if (currentView === 'calendar') {
            renderCurrentCalendarView();
        }
        
        console.log('All practice session durations reset to null in database');
        alert(`All practice session durations have been reset.\n\n${sessionsWithDuration.length} sessions updated.`);
    } catch (error) {
        console.error('Error resetting practice time:', error);
        alert('Failed to reset practice time: ' + error.message);
    }
}

function syncTotalWithContributions() {
    // Calculate total from all contributions
    const totalFromContributions = Object.values(sessionTimeContributions).reduce((sum, time) => sum + time, 0);
    
    // Update total practice time to match contributions
    const oldTotal = totalPracticeTime;
    totalPracticeTime = totalFromContributions;
    saveTotalPracticeTime();
    updateTotalTimeDisplay();
    
    console.log(`Synced total practice time: ${formatTimerTime(oldTotal)} → ${formatTimerTime(totalPracticeTime)}`);
    
    // Refresh the history view if open
    if (document.getElementById('contribution-history-modal').style.display === 'block') {
        renderContributionHistory();
    }
    
    alert(`Total practice time synced with contributions.\n\nOld total: ${formatTimerTime(oldTotal)}\nNew total: ${formatTimerTime(totalPracticeTime)}`);
}

function openContributionHistory() {
    const modal = document.getElementById('contribution-history-modal');
    const loadingDiv = document.getElementById('contribution-history-loading');
    const listDiv = document.getElementById('contribution-history-list');
    const emptyDiv = document.getElementById('contribution-history-empty');
    
    // Show loading
    loadingDiv.style.display = 'block';
    listDiv.style.display = 'none';
    emptyDiv.style.display = 'none';
    
    openModal('contribution-history-modal');
    
    // Load and display history
    setTimeout(() => {
        renderContributionHistory();
    }, 100);
}

function renderContributionHistory() {
    const loadingDiv = document.getElementById('contribution-history-loading');
    const listDiv = document.getElementById('contribution-history-list');
    const emptyDiv = document.getElementById('contribution-history-empty');
    
    // Get all contributions from database (sessions with duration > 0)
    const contributions = tasks
        .filter(task => task.duration && task.duration > 0)
        .map(task => ({
            sessionId: task.id,
            time: task.duration,
            task: task
        }))
        .sort((a, b) => {
            // Sort by date (most recent first)
            return new Date(b.task.due_date) - new Date(a.task.due_date);
        });
    
    if (contributions.length === 0) {
        loadingDiv.style.display = 'none';
        listDiv.style.display = 'none';
        emptyDiv.style.display = 'block';
        return;
    }
    
    // Calculate total from contributions
    const totalContributed = contributions.reduce((sum, c) => sum + c.time, 0);
    
    // Calculate discrepancy (if any)
    const discrepancy = totalPracticeTime - totalContributed;
    const hasDiscrepancy = Math.abs(discrepancy) > 100; // More than 100ms difference
    
    // Build HTML
    let html = `
        <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(52, 199, 89, 0.1); border: 1px solid rgba(52, 199, 89, 0.3); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: var(--text-primary);">Total Contributions:</span>
                <span style="font-size: 1.2rem; font-weight: 700; color: var(--accent-green); font-family: 'Courier New', monospace;">${formatTimerTime(totalContributed)}</span>
            </div>
            <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                ${contributions.length} session${contributions.length !== 1 ? 's' : ''} contributed
            </div>
            ${hasDiscrepancy ? `
            <div style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(255, 193, 7, 0.15); border: 1px solid rgba(255, 193, 7, 0.4); border-radius: 6px; font-size: 0.85rem;">
                <div style="color: #FFC107; margin-bottom: 0.25rem;">⚠️ Discrepancy detected</div>
                <div style="color: var(--text-secondary);">
                    Total practice time: ${formatTimerTime(totalPracticeTime)}<br>
                    Tracked contributions: ${formatTimerTime(totalContributed)}<br>
                    Difference: ${formatTimerTime(Math.abs(discrepancy))}
                </div>
                <button type="button" onclick="syncTotalWithContributions()" class="btn btn-secondary" style="margin-top: 0.5rem; padding: 0.4rem 0.8rem; font-size: 0.8rem;">Sync Total</button>
            </div>
            ` : ''}
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
    `;
    
    contributions.forEach((contribution, index) => {
        const { sessionId, time, task } = contribution;
        const instrumentName = task && task.instrument_id 
            ? (instruments.find(i => i.id === task.instrument_id)?.name || 'Unknown')
            : 'Unknown';
        // Format date and time separately for clarity
        let sessionDate = 'Date unknown';
        let sessionTime = '';
        
        if (task && task.due_date) {
            const dateObj = new Date(task.due_date);
            // Format date: "Dec 26, 2025"
            const dateStr = dateObj.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric'
            });
            // Format time: "1:30 PM" or "13:30"
            const timeStr = dateObj.toLocaleTimeString('en-US', { 
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            sessionDate = dateStr;
            sessionTime = timeStr;
        }
        const isCompleted = task && task.completed;
        
        html += `
            <div class="contribution-history-item" style="
                padding: 1rem;
                margin-bottom: 0.75rem;
                background: var(--surface-elevated);
                border: 1px solid var(--border-color);
                border-left: 3px solid var(--accent-green);
                border-radius: 6px;
                transition: background 0.2s;
            " onmouseover="this.style.background='var(--surface-hover)'" onmouseout="this.style.background='var(--surface-elevated)'">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <span style="color: var(--accent-green); font-weight: 600;">✓</span>
                            <span style="font-weight: 600; color: var(--text-primary);">${escapeHtml(instrumentName)}</span>
                            ${isCompleted ? '<span style="color: var(--accent-green); font-size: 0.85rem;">(Completed)</span>' : ''}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary); font-family: monospace;">
                            Session ID: ${sessionId.substring(0, 8)}...
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.3rem; font-weight: 700; color: var(--accent-green); font-family: 'Courier New', monospace;">
                            ${formatTimerTime(time)}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem;">
                            ${escapeHtml(sessionDate)}${sessionTime ? ` <span style="font-weight: 500; color: var(--text-primary);">${escapeHtml(sessionTime)}</span>` : ''}
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;">
                            ${Math.round((time / totalContributed) * 100)}% of total
                        </div>
                        <button type="button" onclick="removeContributionFromHistory('${sessionId}')" 
                            style="
                                margin-top: 0.75rem;
                                padding: 0.4rem 0.8rem;
                                font-size: 0.8rem;
                                background: rgba(255, 59, 48, 0.1);
                                border: 1px solid rgba(255, 59, 48, 0.3);
                                color: #FF3B30;
                                border-radius: 4px;
                                cursor: pointer;
                                transition: all 0.2s;
                            "
                            onmouseover="this.style.background='rgba(255, 59, 48, 0.2)'; this.style.borderColor='rgba(255, 59, 48, 0.5)'"
                            onmouseout="this.style.background='rgba(255, 59, 48, 0.1)'; this.style.borderColor='rgba(255, 59, 48, 0.3)'"
                            title="Remove this contribution from total">
                            Remove
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    loadingDiv.style.display = 'none';
    listDiv.style.display = 'block';
    emptyDiv.style.display = 'none';
    listDiv.innerHTML = html;
}

async function removeContributionFromHistory(sessionId) {
    // Normalize sessionId to string for consistent lookup
    const normalizedId = String(sessionId);
    
    // Check if contribution exists
    if (!sessionTimeContributions[normalizedId]) {
        alert('This contribution does not exist.');
        return;
    }
    
    const contributedTime = sessionTimeContributions[normalizedId];
    const timeFormatted = formatTimerTime(contributedTime);
    
    if (!confirm(`Are you sure you want to remove ${timeFormatted} from the total practice time?\n\nThis will set the session duration to null in the database.`)) {
        return;
    }
    
    // Update the session in database to remove duration
    try {
        const session = tasks.find(t => String(t.id) === normalizedId);
        if (!session) {
            alert('Session not found.');
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/practice-sessions/${normalizedId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instrument_id: session.instrument_id,
                practice_session_definition_id: session.practice_session_definition_id || '',
                due_date: session.due_date,
                start_time: session.start_time || null,
                end_time: session.end_time || null,
                duration: null, // Remove duration
                notes: session.notes || null
            })
        });
        
        if (response.ok) {
            // Reload total time from database
            await loadTotalPracticeTime();
            
            // Re-render the history
            renderContributionHistory();
            
            console.log(`Removed contribution ${normalizedId} (${timeFormatted}) from database`);
        } else {
            alert('Failed to remove contribution from database.');
        }
    } catch (error) {
        console.error('Error removing contribution:', error);
        alert('Failed to remove contribution: ' + error.message);
    }
}

function updateContributionIndicator(sessionId) {
    const indicator = document.getElementById('contribution-indicator');
    const timeDisplay = document.getElementById('contribution-time-display');
    
    if (!indicator || !timeDisplay) return;
    
    if (hasSessionContributed(sessionId)) {
        const contributedTime = getSessionContributedTime(sessionId);
        timeDisplay.textContent = formatTimerTime(contributedTime);
        indicator.style.display = 'block';
    } else {
        indicator.style.display = 'none';
    }
}

async function handleRemoveTimeFromSession() {
    const modal = document.getElementById('quick-add-task-modal');
    const taskId = modal.dataset.taskId;
    
    if (!taskId) {
        console.error('No task ID found in modal');
        return;
    }
    
    if (!hasSessionContributed(taskId)) {
        console.log('Session has no time contribution to remove');
        return;
    }
    
    const contributedTime = getSessionContributedTime(taskId);
    const timeFormatted = formatTimerTime(contributedTime);
    
    if (!confirm(`Are you sure you want to remove ${timeFormatted} from the total practice time?\n\nThis will not delete the session, only remove its time contribution.`)) {
        return;
    }
    
    // Normalize taskId to string for consistent lookup
    const normalizedId = String(taskId);
    
    // Remove the time from total
    totalPracticeTime = Math.max(0, totalPracticeTime - contributedTime);
    saveTotalPracticeTime();
    updateTotalTimeDisplay();
    
    // Remove contribution record
    delete sessionTimeContributions[normalizedId];
    saveSessionContributions();
    
    // Update the indicator (will hide it since there's no contribution now)
    updateContributionIndicator(taskId);
    
    // Refresh calendar view to update checkmarks
    if (currentView === 'calendar') {
        renderCurrentCalendarView();
    }
    
    console.log(`Removed ${timeFormatted} from total practice time for session ${taskId}`);
    alert(`Time contribution removed successfully!\n\n${timeFormatted} has been subtracted from your total practice time.`);
}

function updateFullDateTimeDisplay() {
    const dateInput = document.getElementById('quick-task-date');
    const displayText = document.getElementById('full-datetime-text');
    
    if (!dateInput || !displayText) return;
    
    const dateTimeValue = dateInput.value;
    if (!dateTimeValue) {
        displayText.textContent = '-';
        return;
    }
    
    // The datetime-local input with step="0.001" should include milliseconds in format: YYYY-MM-DDTHH:mm:ss.sss
    // If browser doesn't support it, the value might be YYYY-MM-DDTHH:mm:ss, so we handle both
    let fullDateTime = dateTimeValue;
    
    // If milliseconds are not included, add .000
    if (!dateTimeValue.includes('.') && dateTimeValue.includes('T')) {
        fullDateTime = dateTimeValue + '.000';
    }
    
    // Parse and show in readable format
    try {
        // Try to parse the datetime value
        let dateObj;
        if (fullDateTime.includes('.')) {
            // Has milliseconds: YYYY-MM-DDTHH:mm:ss.sss
            const [datePart, timePart] = fullDateTime.split('T');
            const [time, ms] = timePart.split('.');
            dateObj = new Date(`${datePart}T${time}.${ms.padEnd(3, '0')}`);
        } else {
            dateObj = new Date(dateTimeValue);
        }
        
        const readableFormat = dateObj.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        // Extract milliseconds from the input value
        const msMatch = fullDateTime.match(/\.(\d{1,3})/);
        const milliseconds = msMatch ? msMatch[1].padEnd(3, '0') : '000';
        
        displayText.textContent = `${fullDateTime} (${readableFormat}.${milliseconds})`;
    } catch (e) {
        displayText.textContent = fullDateTime;
    }
}

async function handleQuickAddTask(e) {
    e.preventDefault();
    
    const dateTimeValue = document.getElementById('quick-task-date').value;
    
    // datetime-local with step="0.001" should include milliseconds: YYYY-MM-DDTHH:mm:ss.sss
    // If browser doesn't support milliseconds, it might be YYYY-MM-DDTHH:mm:ss
    let fullDateTime = dateTimeValue;
    
    // Ensure milliseconds are included
    if (!dateTimeValue.includes('.') && dateTimeValue.includes('T')) {
        fullDateTime = dateTimeValue + '.000';
    }
    
    // Extract date for backend (YYYY-MM-DD format)
    const date = dateTimeValue.split('T')[0];
    
    // Store full precision datetime in console for reference
    console.log('Full precision datetime:', fullDateTime);
    
    const instrumentId = document.getElementById('quick-task-instrument').value;
    const taskType = document.getElementById('quick-task-type').value;
    
    // Validate inputs
    if (!instrumentId) {
        alert('Please select an instrument.');
        return;
    }
    if (!taskType) {
        alert('Please select a task type.');
        return;
    }
    if (!date) {
        alert('Please select a date.');
        return;
    }
    
    console.log('Creating task with:', {
        instrument_id: instrumentId,
        task_type: taskType,
        frequency_type: 'days',
        frequency_value: 999,
        start_date: date
    });
    
    // Show loading state
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : 'Add Session';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Creating...';
    }
    
    try {
        const modal = document.getElementById('quick-add-task-modal');
        const isModifyMode = modal.dataset.taskId;
        
        if (isModifyMode) {
            // Update existing practice session
            const taskId = modal.dataset.taskId;
            console.log('Updating practice session:', taskId);
            
            // Get editable time input value
            const editableTimeInput = document.getElementById('editable-time-input');
            const editableTimeContainer = document.getElementById('editable-time-container');
            let duration = null;
            let startTime = null;
            let endTime = null;
            
            if (editableTimeInput && editableTimeContainer && editableTimeContainer.style.display !== 'none') {
                const timeValue = editableTimeInput.value.trim();
                if (timeValue) {
                    // Parse HH:MM:SS format
                    const timeMatch = timeValue.match(/^(\d{1,2}):([0-5][0-9]):([0-5][0-9])$/);
                        if (timeMatch) {
                            const hours = parseInt(timeMatch[1], 10);
                            const minutes = parseInt(timeMatch[2], 10);
                            const seconds = parseInt(timeMatch[3], 10);
                            duration = (hours * 3600 + minutes * 60 + seconds) * 1000;
                            
                            // Duration will be saved to database when session is updated
                            console.log(`Updated session ${taskId} duration to ${formatTimerTime(duration)}`);
                    } else {
                        alert('Invalid time format. Please use HH:MM:SS format (e.g., 01:30:45)');
                        if (submitButton) {
                            submitButton.disabled = false;
                            submitButton.textContent = originalButtonText;
                        }
                        return;
                    }
                    } else {
                        // If time is empty, duration will be set to null in database
                        duration = null;
                        console.log(`Removing duration from session ${taskId}`);
                    }
            }
            
            // Parse datetime for start_time if we have a full datetime
            const dateTimeObj = new Date(dateTimeValue);
            if (!isNaN(dateTimeObj.getTime())) {
                startTime = dateTimeObj.toISOString();
            }
            
            const practiceSessionDefinitionId = document.getElementById('quick-task-type').value;
            
            const requestBody = {
                instrument_id: instrumentId,
                practice_session_definition_id: practiceSessionDefinitionId,
                due_date: date,
                start_time: startTime,
                end_time: endTime,
                duration: duration,
                notes: null
            };
            
            const response = await fetch(`${API_BASE_URL}/practice-sessions/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            if (response.ok) {
                console.log('✅ Practice session updated successfully');
                
                // Reload total time from database after update
                await loadTotalPracticeTime();
                
                await loadTasks();
                closeModal('quick-add-task-modal');
                renderCurrentCalendarView();
                if (selectedDate) {
                    showTasksForDate(selectedDate);
                }
                alert('Session updated successfully!');
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to update task:', response.status, errorText);
                alert(`Failed to update session: ${response.status} ${response.statusText}\n\n${errorText}`);
            }
        } else {
            // Create new practice session
            // Get timer data if available
            let startTime = null;
            let endTime = null;
            let duration = null;
            
            if (timerElapsedTime > 0 || (timerRunning && timerStartTime !== null)) {
                let finalTime = timerElapsedTime;
                if (timerRunning && timerStartTime !== null) {
                    finalTime += (performance.now() - timerStartTime);
                }
                duration = Math.floor(finalTime);
                
                // Calculate start and end times from timer
                if (timerStartTime) {
                    startTime = new Date(timerStartTime).toISOString();
                    endTime = new Date().toISOString();
                }
            }
            
            // Parse datetime for start_time if we have a full datetime
            const dateTimeObj = new Date(dateTimeValue);
            if (!isNaN(dateTimeObj.getTime())) {
                startTime = dateTimeObj.toISOString();
            }
            
            const requestBody = {
                instrument_id: instrumentId,
                practice_session_definition_id: taskType, // This is now the practice session definition ID
                due_date: date,
                start_time: startTime,
                end_time: endTime,
                duration: duration,
                notes: null
            };
            
            console.log('Sending request to:', `${API_BASE_URL}/practice-sessions`);
            console.log('Request body:', JSON.stringify(requestBody, null, 2));
            
            const response = await fetch(`${API_BASE_URL}/practice-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            console.log('Response status:', response.status, response.statusText);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Practice session created successfully:', result);
                
                // Add timer time to total if we have duration
                if (duration && duration > 0 && result.id) {
                    addToTotalPracticeTime(duration, result.id);
                    // Reset timer after adding to total
                    resetTimer();
                }
                
                await loadTasks();
                closeModal('quick-add-task-modal');
                renderCurrentCalendarView();
                alert('Session added successfully!');
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to create task:', response.status, response.statusText);
                console.error('Error details:', errorText);
                
                let errorMessage = `Failed to create session: ${response.status} ${response.statusText}`;
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.detail) {
                        if (Array.isArray(errorJson.detail)) {
                            errorMessage += '\n\n' + errorJson.detail.map(d => d.msg || JSON.stringify(d)).join('\n');
                        } else {
                            errorMessage += '\n\n' + JSON.stringify(errorJson.detail);
                        }
                    } else {
                        errorMessage += '\n\n' + errorText;
                    }
                } catch (e) {
                    errorMessage += '\n\n' + errorText;
                }
                alert(errorMessage);
            }
        }
    } catch (error) {
        console.error('❌ Network error creating task:', error);
        alert(`Failed to create session: ${error.message}\n\nMake sure the backend server is running at ${API_BASE_URL}`);
    } finally {
        // Restore button state
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    }
}

// Enhanced Task Rendering
function renderEnhancedTaskCard(task, showActions = true) {
    const instrumentsName = instruments.find(e => e.id === task.instrument_id)?.name || 'Unknown';
    const taskTypeClass = task.task_type.toLowerCase();
    const isOverdue = task.due_date < new Date().toISOString().split('T')[0] && !task.completed;
    const isCompleted = task.completed;
    const hasContributed = hasSessionContributed(task.id);
    const contributedTime = hasContributed ? getSessionContributedTime(task.id) : 0;
    
    return `
        <div class="task-card-enhanced ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}" 
             draggable="true" ondragstart="handleTaskDrag(event)" 
             data-task-id="${task.id}" data-due-date="${task.due_date}">
            <div class="task-info">
                <div class="task-instruments">${escapeHtml(instrumentsName)}</div>
                <span class="task-type ${taskTypeClass}">${escapeHtml(task.task_type)}</span>
                <div class="task-date ${isOverdue ? 'overdue' : ''}">
                    Due: ${formatDate(task.due_date)} ${isOverdue ? '⚠️ Overdue' : ''}
                    ${isCompleted && task.completed_at ? ` • Completed: ${formatDate(task.completed_at.split('T')[0])}` : ''}
                </div>
                ${hasContributed ? `<div class="contribution-badge" title="Time logged: ${formatTimerTime(contributedTime)}">
                    <span class="contribution-icon">✓</span> Time logged: ${formatTimerTime(contributedTime)}
                </div>` : ''}
                ${task.notes ? `<div class="task-notes-preview">${escapeHtml(task.notes.substring(0, 50))}${task.notes.length > 50 ? '...' : ''}</div>` : ''}
            </div>
            ${showActions ? `
            <div class="task-actions">
                ${!isCompleted ? `
                    <button class="btn btn-success btn-small btn-icon" onclick="handleQuickAction('complete', '${task.id}')" title="Complete">
                        ✓
                    </button>
                ` : ''}
                <button class="btn btn-secondary btn-small btn-icon" onclick="handleQuickAction('edit', '${task.id}')" title="Edit">
                    ✎
                </button>
                <button class="btn btn-danger btn-small btn-icon" onclick="handleQuickAction('delete', '${task.id}')" title="Delete">
                    ×
                </button>
            </div>
            ` : ''}
        </div>
    `;
}

function renderTaskMiniCard(task) {
    const taskTypeClass = task.task_type.toLowerCase();
    return `<div class="task-mini-card ${taskTypeClass} ${task.completed ? 'completed' : ''}" 
                draggable="true" ondragstart="handleTaskDrag(event)" 
                data-task-id="${task.id}" data-due-date="${task.due_date}">
                ${task.task_type.substring(0, 3)}
            </div>`;
}

// Quick Actions
async function handleQuickAction(action, taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    switch(action) {
        case 'complete':
            openCompleteTaskModal(taskId);
            break;
        case 'edit':
            // For practice sessions, editing means rescheduling the date
            const editNewDate = prompt('Enter new date for this practice session (YYYY-MM-DD):', task.due_date);
            if (editNewDate) {
                try {
                    console.log('Rescheduling task:', taskId, 'to', editNewDate);
                    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/reschedule`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ due_date: editNewDate })
                    });
                    
                    if (response.ok) {
                        console.log('Task rescheduled successfully');
                        await loadTasks();
                        if (currentView === 'calendar') {
                            renderCurrentCalendarView();
                        } else if (currentView === 'tasks') {
                            const activeTab = document.querySelector('.task-tab.active');
                            loadTasksForFilter(activeTab.dataset.filter);
                        }
                    } else {
                        const errorText = await response.text();
                        console.error('Failed to reschedule task:', response.status, errorText);
                        alert(`Failed to reschedule session: ${response.status} ${response.statusText}\n\n${errorText}`);
                    }
                } catch (error) {
                    console.error('Error rescheduling task:', error);
                    alert(`Failed to reschedule session: ${error.message}\n\nMake sure the backend server is running at ${API_BASE_URL}`);
                }
            }
            break;
        case 'delete':
            if (confirm('Are you sure you want to delete this practice session?')) {
                try {
                    console.log('Deleting task:', taskId);
                    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        console.log('Task deleted successfully');
                        
                        // Remove contribution record and subtract from total if session contributed time
                        // Normalize taskId to string for consistent lookup
                        const normalizedId = String(taskId);
                        
                        if (sessionTimeContributions[normalizedId] && sessionTimeContributions[normalizedId] > 0) {
                            const contributedTime = sessionTimeContributions[normalizedId];
                            console.log(`Found contribution for session ${taskId}: ${formatTimerTime(contributedTime)}`);
                            
                            // Subtract the contributed time from total
                            const oldTotal = totalPracticeTime;
                            totalPracticeTime = Math.max(0, totalPracticeTime - contributedTime);
                            saveTotalPracticeTime();
                            updateTotalTimeDisplay();
                            
                            // Remove contribution record
                            delete sessionTimeContributions[normalizedId];
                            saveSessionContributions();
                            
                            console.log(`Removed ${formatTimerTime(contributedTime)} from total. Old total: ${formatTimerTime(oldTotal)}, New total: ${formatTimerTime(totalPracticeTime)}`);
                        } else {
                            console.log(`No contribution found for session ${taskId}. Contributions:`, Object.keys(sessionTimeContributions));
                        }
                        
                        await loadTasks();
                        if (currentView === 'calendar') {
                            renderCurrentCalendarView();
                            // Refresh the selected date tasks view if a date is selected
                            if (selectedDate) {
                                showTasksForDate(selectedDate);
                            }
                        } else if (currentView === 'tasks') {
                            const activeTab = document.querySelector('.task-tab.active');
                            loadTasksForFilter(activeTab.dataset.filter);
                        }
                    } else {
                        const errorText = await response.text();
                        console.error('Failed to delete task:', response.status, errorText);
                        alert(`Failed to delete session: ${response.status} ${response.statusText}\n\n${errorText}`);
                    }
                } catch (error) {
                    console.error('Error deleting task:', error);
                    alert(`Failed to delete session: ${error.message}\n\nMake sure the backend server is running at ${API_BASE_URL}`);
                }
            }
            break;
        case 'reschedule':
            // Open date picker for rescheduling
            const newDate = prompt('Enter new date (YYYY-MM-DD):', task.due_date);
            if (newDate) {
                await rescheduleTask(taskId, newDate);
            }
            break;
    }
}

async function rescheduleTask(taskId, newDate) {
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/reschedule`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ due_date: newDate })
        });
        
        if (response.ok) {
            await loadTasks();
            renderCurrentCalendarView();
            if (selectedDate) {
                showTasksForDate(selectedDate);
            }
        } else {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            alert(`Failed to reschedule task: ${error.detail || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error rescheduling task:', error);
        alert('Failed to reschedule task. Please check your connection and try again.');
    }
}

// Drag and Drop
let draggedTask = null;
let touchStartX = 0;
let touchStartY = 0;

function handleTaskDrag(event) {
    draggedTask = {
        id: event.target.closest('[data-task-id]')?.dataset.taskId || event.target.dataset.taskId,
        dueDate: event.target.closest('[data-due-date]')?.dataset.dueDate || event.target.dataset.dueDate,
        element: event.target.closest('.task-card-enhanced, .task-mini-card') || event.target
    };
    
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
    }
    
    if (draggedTask.element) {
        draggedTask.element.classList.add('dragging');
    }
}

// Touch event handlers for mobile drag-and-drop
function handleTouchStart(event) {
    const taskElement = event.target.closest('.task-card-enhanced, .task-mini-card');
    if (!taskElement) return;
    
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    
    draggedTask = {
        id: taskElement.dataset.taskId,
        dueDate: taskElement.dataset.dueDate,
        element: taskElement,
        startX: touchStartX,
        startY: touchStartY
    };
    
    taskElement.classList.add('dragging');
    event.preventDefault();
}

function handleTouchMove(event) {
    if (!draggedTask) return;
    
    const touchX = event.touches[0].clientX;
    const touchY = event.touches[0].clientY;
    
    // Visual feedback
    if (draggedTask.element) {
        const deltaX = touchX - draggedTask.startX;
        const deltaY = touchY - draggedTask.startY;
        draggedTask.element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    }
    
    // Highlight drop zones
    const elementBelow = document.elementFromPoint(touchX, touchY);
    const dropTarget = elementBelow?.closest('[data-date]');
    
    document.querySelectorAll('[data-date]').forEach(el => {
        el.classList.remove('drop-zone-active');
    });
    
    if (dropTarget) {
        dropTarget.classList.add('drop-zone-active');
    }
    
    event.preventDefault();
}

function handleTouchEnd(event) {
    if (!draggedTask) return;
    
    const touchX = event.changedTouches[0].clientX;
    const touchY = event.changedTouches[0].clientY;
    
    const elementBelow = document.elementFromPoint(touchX, touchY);
    const dropTarget = elementBelow?.closest('[data-date]');
    
    if (dropTarget && draggedTask) {
        const newDate = dropTarget.dataset.date;
        if (newDate && newDate !== draggedTask.dueDate) {
            rescheduleTask(draggedTask.id, newDate);
        }
    }
    
    // Clean up
    if (draggedTask.element) {
        draggedTask.element.classList.remove('dragging');
        draggedTask.element.style.transform = '';
    }
    
    document.querySelectorAll('.drop-zone-active').forEach(el => {
        el.classList.remove('drop-zone-active');
    });
    
    draggedTask = null;
}

// Add touch event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Delegate touch events for task cards
    document.addEventListener('touchstart', (e) => {
        if (e.target.closest('.task-card-enhanced, .task-mini-card')) {
            handleTouchStart(e);
        }
    }, { passive: false });
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
});

function handleTaskDrop(event) {
    event.preventDefault();
    const dropTarget = event.target.closest('[data-date]');
    
    if (dropTarget && draggedTask) {
        const newDate = dropTarget.dataset.date;
        if (newDate && newDate !== draggedTask.dueDate) {
            rescheduleTask(draggedTask.id, newDate);
        }
    }
    
    // Clean up
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drop-zone-active').forEach(el => el.classList.remove('drop-zone-active'));
    draggedTask = null;
}

// Mini Calendar
function renderMiniCalendar() {
    const miniCal = document.getElementById('mini-calendar');
    if (!miniCal) return;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    let html = '<div class="mini-calendar-header">' + 
        dayNames.map(d => `<div class="mini-cal-day-header">${d}</div>`).join('') + 
        '</div><div class="mini-calendar-days">';
    
    // Empty cells
    for (let i = 0; i < startingDayOfWeek; i++) {
        html += '<div class="mini-cal-day"></div>';
    }
    
    // Days
    const todayStr = today.toISOString().split('T')[0];
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayTasks = tasks.filter(t => {
            if (!t.due_date || t.completed) return false;
            // Normalize the task's due_date to YYYY-MM-DD format
            const taskDate = t.due_date.split('T')[0]; // Remove time if present
            return taskDate === dateStr;
        });
        const isToday = dateStr === todayStr;
        const isSelected = selectedDate === dateStr;
        
        html += `
            <div class="mini-cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
                 data-date="${dateStr}" onclick="selectDate('${dateStr}'); switchCalendarView('day');">
                ${day}
                ${dayTasks.length > 0 ? `<span class="mini-cal-dot"></span>` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    miniCal.innerHTML = html;
}

function showTasksForDate(dateStr) {
    const container = document.getElementById('selected-date-tasks');
    if (!container) {
        console.error('selected-date-tasks container not found!');
        return;
    }
    
    const filteredTasks = getFilteredTasks();
    // Normalize date comparison - handle both YYYY-MM-DD and other formats
    const dayTasks = filteredTasks.filter(t => {
        if (!t.due_date) return false;
        // Normalize the task's due_date to YYYY-MM-DD format
        const taskDate = t.due_date.split('T')[0]; // Remove time if present
        return taskDate === dateStr;
    });
    
    console.log(`showTasksForDate(${dateStr}): Found ${dayTasks.length} tasks`);
    
    if (dayTasks.length === 0) {
        container.innerHTML = `<div class="selected-date-header"><h3>Sessions for ${formatDate(dateStr)}</h3></div><p class="empty-state">No practice sessions for this date</p>`;
        return;
    }
    
    const pendingTasks = dayTasks.filter(t => !t.completed);
    const completedTasks = dayTasks.filter(t => t.completed);
    
    let html = `<div class="selected-date-header"><h3>Practice Sessions for ${formatDate(dateStr)}</h3></div>`;
    
    if (pendingTasks.length > 0) {
        html += `<div class="tasks-section">
            <h4>Upcoming (${pendingTasks.length})</h4>
            <div class="tasks-list-detailed">
                ${pendingTasks.map(task => renderEnhancedTaskCard(task, true)).join('')}
            </div>
        </div>`;
    }
    
    if (completedTasks.length > 0 && activeFilters.showCompleted) {
        html += `<div class="tasks-section">
            <h4>Completed (${completedTasks.length})</h4>
            <div class="tasks-list-detailed">
                ${completedTasks.map(task => renderEnhancedTaskCard(task, true)).join('')}
            </div>
        </div>`;
    }
    
    container.innerHTML = html;
}

function populateFilterInstrument() {
    const select = document.getElementById('filter-instruments');
    if (!select) return;
    
    select.innerHTML = '<option value="">All Instrument</option>' +
        instruments.map(instr => `<option value="${instr.id}">${escapeHtml(instr.name)}</option>`).join('');
}

// Tasks
async function loadTasksForFilter(filter) {
    // First ensure all tasks are loaded from database
    await loadTasks();
    
    // Then filter from the loaded tasks array
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    let filteredTasks = [];
    
    if (filter === 'today') {
        filteredTasks = tasks.filter(t => {
            if (!t.due_date) return false;
            const taskDate = t.due_date.split('T')[0];
            return taskDate === todayStr;
        });
    } else if (filter === 'tomorrow') {
        filteredTasks = tasks.filter(t => {
            if (!t.due_date) return false;
            const taskDate = t.due_date.split('T')[0];
            return taskDate === tomorrowStr;
        });
    } else if (filter === 'overdue') {
        filteredTasks = tasks.filter(t => {
            if (!t.due_date || t.completed) return false;
            const taskDate = t.due_date.split('T')[0];
            return taskDate < todayStr;
        });
    }
    
    console.log(`loadTasksForFilter(${filter}): Found ${filteredTasks.length} tasks from ${tasks.length} total tasks`);
    renderTasks(filteredTasks);
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
    const instrumentsName = instruments.find(e => e.id === task.instrument_id)?.name || 'Unknown';
    const taskTypeClass = task.task_type.toLowerCase();
    const isOverdue = task.due_date < new Date().toISOString().split('T')[0] && !task.completed;
    
    return `
        <div class="task-card ${task.completed ? 'completed' : ''}">
            <div class="task-info">
                <div class="task-instruments">${escapeHtml(instrumentsName)}</div>
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
    
    const instrumentsName = instruments.find(e => e.id === task.instrument_id)?.name || 'Unknown';
    const infoDiv = document.getElementById('complete-task-info');
    infoDiv.innerHTML = `
        <p><strong>Instrument:</strong> ${escapeHtml(instrumentsName)}</p>
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
    
    const taskId = e.target.dataset.taskId; // Keep as string (UUID)
    if (!taskId) {
        alert('Task ID not found');
        return;
    }
    
    const notes = document.getElementById('complete-task-notes').value.trim();
    const photoFile = document.getElementById('complete-task-photo').files[0];
    
    // Note: Photo upload would need proper file handling in production
    const photoUrl = photoFile ? URL.createObjectURL(photoFile) : null;
    
    console.log('Completing task:', taskId);
    
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
        
        console.log('Complete task response:', response.status, response.statusText);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Task completed successfully:', result);
            await loadTasks();
            closeModal('complete-task-modal');
            
            if (currentView === 'calendar') {
                renderCurrentCalendarView();
            } else if (currentView === 'instruments') {
                renderInstruments();
            } else if (currentView === 'tasks') {
                const activeTab = document.querySelector('.task-tab.active');
                loadTasksForFilter(activeTab.dataset.filter);
            }
        } else {
            const errorText = await response.text();
            console.error('Failed to complete task:', response.status, errorText);
            alert(`Failed to complete session: ${response.status} ${response.statusText}\n\n${errorText}`);
        }
    } catch (error) {
        console.error('Error completing task:', error);
        alert(`Failed to complete session: ${error.message}\n\nMake sure the backend server is running at ${API_BASE_URL}`);
    }
}

// Analytics
async function loadAnalytics() {
    await Promise.all([
        loadStreak(),
        loadCompletionRate(),
        loadInstrumentScores()
    ]);
}

// Circular Gauge Rendering
function renderCircularGauge(containerId, value, max, colors, label = '') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const percentage = Math.min((value / max) * 100, 100);
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    
    // Determine color based on percentage
    let strokeColor = colors.gray || '#8E8E93';
    if (percentage >= 80) strokeColor = colors.green || '#34C759';
    else if (percentage >= 60) strokeColor = colors.blue || '#007AFF';
    else if (percentage >= 40) strokeColor = colors.orange || '#FF9500';
    else if (percentage >= 20) strokeColor = colors.red || '#FF3B30';
    
    container.innerHTML = `
        <div class="circular-gauge">
            <svg viewBox="0 0 120 120">
                <circle class="circular-gauge-circle-bg" cx="60" cy="60" r="${radius}"></circle>
                <circle class="circular-gauge-circle-fill" 
                        cx="60" cy="60" r="${radius}"
                        stroke="${strokeColor}"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${offset}"></circle>
            </svg>
            <div class="circular-gauge-value">${value}</div>
            ${label ? `<div class="circular-gauge-label">${label}</div>` : ''}
        </div>
    `;
}

function renderMetricCard(containerId, title, value, icon, color, subtitle = '') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `
        <div class="metric-card-icon" style="background: ${color}20; color: ${color};">
            ${icon}
        </div>
        <div class="metric-card-content">
            <div class="metric-card-title">${escapeHtml(title)}</div>
            <div class="metric-card-value">${escapeHtml(value)}</div>
            ${subtitle ? `<div class="metric-card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        </div>
    `;
    container.appendChild(card);
}

async function loadStreak() {
    try {
        const response = await fetch(`${API_BASE_URL}/analytics/streak`);
        if (response.ok) {
            const data = await response.json();
            const streakDays = data.streak_days || 0;
            
            // Update stats view
            const streakDisplay = document.getElementById('streak-display');
            if (streakDisplay) {
                streakDisplay.textContent = `${streakDays} days`;
            }
            
            // Render gauge in dashboard
            renderCircularGauge('streak-gauge', streakDays, 30, {
                gray: '#8E8E93',
                red: '#FF3B30',
                orange: '#FF9500',
                blue: '#007AFF',
                green: '#34C759'
            }, 'days');
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
            const rate = data.completion_rate || 0;
            
            // Update stats view
            const container = document.getElementById('completion-rate');
            if (container) {
                container.innerHTML = `
                    <div class="completion-rate-display">${rate}%</div>
                    <p style="text-align: center; color: var(--text-tertiary);">
                        ${data.completed} of ${data.total} tasks completed
                    </p>
                `;
            }
            
            // Render gauge in dashboard
            renderCircularGauge('completion-rate-gauge', Math.round(rate), 100, {
                gray: '#8E8E93',
                red: '#FF3B30',
                orange: '#FF9500',
                blue: '#007AFF',
                green: '#34C759'
            }, '%');
        }
    } catch (error) {
        console.error('Error loading completion rate:', error);
    }
}

// Calculate today's practice time
function calculateTodayPracticeTime() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayTasks = tasks.filter(task => {
        const taskDate = new Date(task.due_date);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === today.getTime() && task.completed;
    });
    
    // Estimate practice time (assuming average session is 30 minutes)
    const estimatedMinutes = todayTasks.length * 30;
    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;
    
    return { hours, minutes, totalMinutes: estimatedMinutes, count: todayTasks.length };
}

// Load today's activity
function loadTodayActivity() {
    const container = document.getElementById('today-activity-container');
    if (!container) return;
    
    const practice = calculateTodayPracticeTime();
    
    if (practice.count === 0) {
        container.innerHTML = '<p class="empty-state">No practice sessions today</p>';
        return;
    }
    
    const timeStr = practice.hours > 0 
        ? `${practice.hours}:${String(practice.minutes).padStart(2, '0')}`
        : `${practice.minutes} min`;
    
    container.innerHTML = `
        <div class="today-activity-card">
            <div class="today-activity-icon" style="background: rgba(255, 149, 0, 0.2); color: #FF9500;">
                🎵
            </div>
            <div class="today-activity-content">
                <div class="today-activity-title">Practice Sessions</div>
                <div class="today-activity-details">${timeStr} • ${practice.count} sessions</div>
            </div>
        </div>
    `;
}

// Calculate training readiness (based on recent practice consistency)
function calculateTrainingReadiness() {
    const last7Days = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dayTasks = tasks.filter(task => {
            const taskDate = new Date(task.due_date);
            taskDate.setHours(0, 0, 0, 0);
            return taskDate.getTime() === date.getTime() && task.completed;
        });
        
        last7Days.push(dayTasks.length > 0 ? 1 : 0);
    }
    
    const consistency = (last7Days.filter(d => d === 1).length / 7) * 100;
    let readiness = Math.round(consistency);
    let label = 'Low';
    
    if (readiness >= 80) label = 'High';
    else if (readiness >= 60) label = 'Moderate';
    else if (readiness >= 40) label = 'Fair';
    
    return { score: readiness, label };
}

// Load in focus section
function loadInFocus() {
    const container = document.getElementById('in-focus-container');
    if (!container) return;
    
    const readiness = calculateTrainingReadiness();
    
    container.innerHTML = `
        <div class="in-focus-card">
            <div class="in-focus-icon" style="background: rgba(0, 122, 255, 0.2); color: #007AFF;">
                🎯
            </div>
            <div class="in-focus-gauge">
                <div class="circular-gauge" id="readiness-gauge">
                    <svg viewBox="0 0 120 120">
                        <circle class="circular-gauge-circle-bg" cx="60" cy="60" r="50"></circle>
                        <circle class="circular-gauge-circle-fill" 
                                cx="60" cy="60" r="50"
                                stroke="${getReadinessColor(readiness.score)}"
                                stroke-dasharray="${2 * Math.PI * 50}"
                                stroke-dashoffset="${2 * Math.PI * 50 * (1 - readiness.score / 100)}"></circle>
                    </svg>
                    <div class="circular-gauge-value">${readiness.score}</div>
                    <div class="circular-gauge-label">${readiness.label}</div>
                </div>
            </div>
        </div>
    `;
}

function getReadinessColor(score) {
    if (score >= 80) return '#34C759';
    if (score >= 60) return '#007AFF';
    if (score >= 40) return '#FF9500';
    if (score >= 20) return '#FF3B30';
    return '#8E8E93';
}


async function loadInstrumentScores() {
    try {
        const response = await fetch(`${API_BASE_URL}/analytics/instruments-scores`);
        if (response.ok) {
            const scores = await response.json();
            const container = document.getElementById('instruments-scores');
            
            if (scores.length === 0) {
                container.innerHTML = '<p class="empty-state">No data yet</p>';
                return;
            }
            
            container.innerHTML = scores.map(score => `
                <div class="instruments-score-item">
                    <span>${escapeHtml(score.instruments_name)}</span>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${score.score}%"></div>
                    </div>
                    <span>${score.score}%</span>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading instruments scores:', error);
    }
}

// Load dashboard metrics
function loadDashboardMetrics() {
    loadTodayActivity();
    loadInFocus();
}

// Modal helpers
async function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    
    // If opening task-def-modal, ensure instrument is set to primary
    if (modalId === 'task-def-modal') {
        await populateInstrumentSelect();
    }
    
    // If opening quick-add-task-modal, ensure instrument is set to primary (Trumpet) and practice type is set
    if (modalId === 'quick-add-task-modal') {
        await populateQuickAddInstrumentSelect();
        await populatePracticeTypeSelect();
        
        // Double-check: Ensure instrument is set (fallback to Trumpet if needed)
        const instrumentSelect = document.getElementById('quick-task-instrument');
        if (instrumentSelect && !instrumentSelect.value) {
            console.log('Instrument not set in openModal, trying to set Trumpet...');
            const trumpetInstrument = instruments.find(instr => 
                instr.name.toLowerCase() === 'trumpet'
            );
            if (trumpetInstrument) {
                instrumentSelect.value = trumpetInstrument.id;
                console.log('✅ Force-set instrument to Trumpet in openModal');
            }
        }
        
        // Set task type to 'Practice' as default
        const taskTypeSelect = document.getElementById('quick-task-type');
        if (taskTypeSelect) {
            taskTypeSelect.value = 'Practice';
            console.log('Set task type to Practice');
        }
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    editingInstrumentId = null;
    
    // Reset timer when closing the session modal
    if (modalId === 'quick-add-task-modal') {
        resetTimer();
    }
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
    console.log('Loading profile'); // Debug
    
    // Load instruments list first
    await loadInstrumentsList();
    
    try {
        // Get first profile or use defaults
        const response = await fetch(`${API_BASE_URL}/profile`);
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
        const response = await fetch(`${API_BASE_URL}/profile`, {
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
        currentUserName = updated.name || 'User';
        
        // Refresh profile display and UI
        await loadProfile();
        updateUserUI();
        
        alert('Profile updated successfully!');
    } catch (error) {
        console.error('Error updating profile:', error);
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            alert('Cannot connect to server. Please make sure the backend is running on http://localhost:8000');
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


// Make functions available globally
window.editInstrument = editInstrument;
window.deleteInstrument = deleteInstrument;
window.addTaskForInstrument = addTaskForInstrument;
window.selectDate = selectDate;
window.selectDateAndShowTasks = selectDateAndShowTasks;
window.openCompleteTaskModal = openCompleteTaskModal;
window.updateProfile = updateProfile;
window.simulateProfileData = simulateProfileData;
window.switchCalendarView = switchCalendarView;
window.createTaskFromCalendar = createTaskFromCalendar;
window.openModifySessionModal = openModifySessionModal;
window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.resetTimer = resetTimer;
window.handleTaskDrag = handleTaskDrag;
window.handleTaskDrop = handleTaskDrop;
window.handleQuickAction = handleQuickAction;
window.resetTotalPracticeTime = resetTotalPracticeTime;
window.syncTotalWithContributions = syncTotalWithContributions;
