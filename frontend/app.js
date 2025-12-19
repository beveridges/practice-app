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
    
    // Ensure initial view is visible
    renderCalendar();
    
    // Check connection but don't block UI
    checkConnection().catch(() => {
        // Even if backend is unavailable, show UI
        updateStatus('disconnected', '⚠️ Server unavailable - Working offline');
    });
    
    // Load data (will work offline if backend is down)
    loadData().catch(() => {
        console.log('Initial data load failed, but UI is available');
    });
});

// Event Listeners
function setupEventListeners() {
    // Navigation
    navButtons.forEach(btn => {
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
    
    // Update nav buttons
    navButtons.forEach(btn => {
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
        renderEquipment();
    } else if (viewName === 'analytics') {
        loadAnalytics();
    }
}

// Authentication
function showSignIn() {
    document.getElementById('signin-view').querySelector('.auth-card').style.display = 'block';
    document.getElementById('signup-card').style.display = 'none';
}

function showSignUp() {
    document.getElementById('signin-view').querySelector('.auth-card').style.display = 'none';
    document.getElementById('signup-card').style.display = 'block';
}

async function handleSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    
    // TODO: Implement actual sign in API call
    console.log('Sign in:', { email, password });
    alert('Sign in functionality will be implemented with backend authentication');
    
    // For now, just switch to calendar view after "sign in"
    // switchView('calendar');
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
    
    // TODO: Implement actual sign up API call
    console.log('Sign up:', { name, email, password });
    alert('Sign up functionality will be implemented with backend authentication');
    
    // For now, switch back to sign in after "sign up"
    // showSignIn();
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
        const response = await fetch(`${API_BASE_URL}/equipment`);
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
function renderEquipment() {
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
                    <span class="equipment-category">${escapeHtml(eq.category)}</span>
                </div>
                <div class="equipment-actions">
                    <button class="btn btn-secondary btn-small" onclick="editEquipment(${eq.id})">Edit</button>
                    <button class="btn btn-primary btn-small" onclick="addTaskForEquipment(${eq.id})">Add Task</button>
                    <button class="btn btn-danger btn-small" onclick="deleteEquipment(${eq.id})">Delete</button>
                </div>
            </div>
            ${eq.notes ? `<div class="equipment-notes">${escapeHtml(eq.notes)}</div>` : ''}
        </div>
    `).join('');
}

async function handleEquipmentSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('equipment-name').value.trim();
    const category = document.getElementById('equipment-category').value;
    const notes = document.getElementById('equipment-notes').value.trim();
    
    try {
        if (editingEquipmentId) {
            // Update
            const response = await fetch(`${API_BASE_URL}/equipment/${editingEquipmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, category, notes: notes || null })
            });
            
            if (response.ok) {
                await loadEquipment();
                renderEquipment();
                closeModal('equipment-modal');
            }
        } else {
            // Create
            const response = await fetch(`${API_BASE_URL}/equipment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, category, notes: notes || null })
            });
            
            if (response.ok) {
                await loadEquipment();
                renderEquipment();
                closeModal('equipment-modal');
            }
        }
    } catch (error) {
        console.error('Error saving equipment:', error);
        alert('Failed to save equipment. Please try again.');
    }
}

function openEquipmentModal(equipmentId = null) {
    editingEquipmentId = equipmentId;
    const modal = document.getElementById('equipment-modal');
    const form = document.getElementById('equipment-form');
    const title = document.getElementById('equipment-modal-title');
    
    if (equipmentId) {
        const eq = equipment.find(e => e.id === equipmentId);
        title.textContent = 'Edit Equipment';
        document.getElementById('equipment-name').value = eq.name;
        document.getElementById('equipment-category').value = eq.category;
        document.getElementById('equipment-notes').value = eq.notes || '';
    } else {
        title.textContent = 'Add Equipment';
        form.reset();
    }
    
    openModal('equipment-modal');
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

// Make functions available globally
window.editEquipment = editEquipment;
window.deleteEquipment = deleteEquipment;
window.addTaskForEquipment = addTaskForEquipment;
window.selectDate = selectDate;
window.openCompleteTaskModal = openCompleteTaskModal;
