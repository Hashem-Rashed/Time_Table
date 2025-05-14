// app.js - Main Application Script (Updated with null checks and proper initialization)

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the application after SharedData is ready
    if (window.SharedData) {
        initApp();
    } else {
        document.addEventListener('SharedDataReady', initApp);
    }
});

/**
 * Initialize the application
 */
function initApp() {
    // Ensure SharedData is properly initialized
    if (!window.SharedData) {
        console.error('SharedData not initialized - make sure shared.js is loaded first');
        return;
    }
    SharedData.setupDarkMode();
    // Set college name if available
    if (SharedData.settings?.collegeName) {
        const subtitle = document.getElementById('collegeNameSubtitle');
        if (subtitle) {
            subtitle.textContent = 
                `${SharedData.settings.collegeName} - نظام متكامل لإدارة الجداول الدراسية`;
        }
    }

    // Load any additional data needed for the dashboard
    loadDashboardData();
    
    // Update UI with loaded data
    updateDashboardStats();
    updateActivityFeed();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set current year in footer
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // Hide loader if it exists
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.classList.add('hidden');
    }

    // Register for data change notifications
    SharedData.addChangeListener(handleDataChange);
}

/**
 * Load additional dashboard-specific data if needed
 */
function loadDashboardData() {
    // This can be used to load any additional data needed specifically for the dashboard
    // that isn't already loaded in SharedData
}

/**
 * Handle data change notifications
 */
function handleDataChange() {
    updateDashboardStats();
    updateActivityFeed();
}

/**
 * Safely update an element if it exists
 */
function safeUpdateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

/**
 * Update the dashboard statistics cards with null checks
 */
function updateDashboardStats() {
    if (!SharedData) return;

    // Calculate combined rooms and labs count
    const roomsCount = SharedData.rooms.filter(r => !r.type || r.type === 'room').length;
    const labsCount = SharedData.rooms.filter(r => r.type && r.type !== 'room').length;
    
    // Update the UI elements with null checks
    safeUpdateElement('teachersCount', SharedData.teachers.length);
    safeUpdateElement('roomsCount', roomsCount + labsCount);
    safeUpdateElement('lessonsCount', SharedData.schedule ? SharedData.schedule.length : 0);
    safeUpdateElement('departmentsCount', SharedData.departments.length);
    safeUpdateElement('coursesCount', SharedData.courses?.length || 0);
    safeUpdateElement('studentGroupsCount', SharedData.studentYears?.reduce((sum, year) => sum + year.groups.length, 0) || 0);
    
    // Calculate and update total students count
    const totalStudents = SharedData.studentYears?.reduce((total, year) => {
        return total + year.groups.reduce((sum, group) => sum + (group.students || 0), 0);
    }, 0) || 0;
    safeUpdateElement('studentsCount', totalStudents);
}

/**
 * Update the activity feed with recent changes
 */
function updateActivityFeed() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    
    const activities = [];
    
    // Add last schedule generation if exists
    if (SharedData.schedule && SharedData.schedule.length > 0) {
        const lastGenerated = SharedData.lastScheduleGeneration || new Date().toISOString();
        activities.push({
            type: 'schedule',
            date: new Date(lastGenerated),
            count: SharedData.schedule.length
        });
    }
    
    // Add recent teachers added (last 3)
    if (SharedData.teachers.length > 0) {
        const sortedTeachers = [...SharedData.teachers]
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 3);
        
        sortedTeachers.forEach(teacher => {
            activities.push({
                type: 'teacher',
                name: teacher.name,
                date: new Date(teacher.createdAt || Date.now()),
                subject: teacher.subject
            });
        });
    }
    
    // Add recent departments added (last 2)
    if (SharedData.departments.length > 0) {
        const sortedDepts = [...SharedData.departments]
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 2);
        
        sortedDepts.forEach(dept => {
            activities.push({
                type: 'department',
                name: dept.name,
                date: new Date(dept.createdAt || Date.now()),
                code: dept.code
            });
        });
    }
    
    // Add recent places added (last 2)
    if (SharedData.rooms.length > 0) {
        const sortedPlaces = [...SharedData.rooms]
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 2);
        
        sortedPlaces.forEach(place => {
            activities.push({
                type: 'place',
                name: place.name,
                date: new Date(place.createdAt || Date.now()),
                isLab: place.type && place.type !== 'room'
            });
        });
    }
    
    // Add recent courses added (last 2)
    if (SharedData.courses?.length > 0) {
        const sortedCourses = [...SharedData.courses]
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 2);
        
        sortedCourses.forEach(course => {
            activities.push({
                type: 'course',
                name: course.name,
                date: new Date(course.createdAt || Date.now()),
                code: course.code
            });
        });
    }
    
    // Sort all activities by date (newest first)
    activities.sort((a, b) => b.date - a.date);
    
    // Render activities
    if (activities.length === 0) {
        feed.innerHTML = '<p class="empty-activity">لا يوجد نشاط حديث</p>';
        return;
    }
    
    feed.innerHTML = activities.map(activity => {
        const dateStr = activity.date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        if (activity.type === 'schedule') {
            return `
                <div class="activity-item schedule-activity">
                    <span class="activity-icon">📅</span>
                    <div class="activity-content">
                        <p>تم توليد جدول جديد يحتوي على ${activity.count} حصة</p>
                        <time datetime="${activity.date.toISOString()}">${dateStr}</time>
                    </div>
                </div>
            `;
        } else if (activity.type === 'teacher') {
            return `
                <div class="activity-item teacher-activity">
                    <span class="activity-icon">👨‍🏫</span>
                    <div class="activity-content">
                        <p>تم إضافة المدرس <strong>${activity.name}</strong> لمادة ${activity.subject}</p>
                        <time datetime="${activity.date.toISOString()}">${dateStr}</time>
                    </div>
                </div>
            `;
        } else if (activity.type === 'department') {
            return `
                <div class="activity-item dept-activity">
                    <span class="activity-icon">🏛️</span>
                    <div class="activity-content">
                        <p>تم إضافة قسم <strong>${activity.name}</strong> (${activity.code})</p>
                        <time datetime="${activity.date.toISOString()}">${dateStr}</time>
                    </div>
                </div>
            `;
        } else if (activity.type === 'place') {
            const placeType = activity.isLab ? 'معمل' : 'قاعة';
            return `
                <div class="activity-item place-activity">
                    <span class="activity-icon">${activity.isLab ? '🔬' : '🏫'}</span>
                    <div class="activity-content">
                        <p>تم إضافة ${placeType} <strong>${activity.name}</strong></p>
                        <time datetime="${activity.date.toISOString()}">${dateStr}</time>
                    </div>
                </div>
            `;
        } else if (activity.type === 'course') {
            return `
                <div class="activity-item course-activity">
                    <span class="activity-icon">📚</span>
                    <div class="activity-content">
                        <p>تم إضافة مادة <strong>${activity.name}</strong> (${activity.code})</p>
                        <time datetime="${activity.date.toISOString()}">${dateStr}</time>
                    </div>
                </div>
            `;
        }
    }).join('');
}

/**
 * Set up event listeners for the dashboard
 */
function setupEventListeners() {
    // Reports button
    document.getElementById('reportsBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('سيتم تنفيذ هذه الميزة في الإصدارات القادمة');
    });

    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        SharedData.loadFromLocalStorage();
        updateDashboardStats();
        updateActivityFeed();
        SharedData.showToast('تم تحديث البيانات', 'success');
    });
}