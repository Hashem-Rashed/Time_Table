// shared.js - Final Version with Enhanced Dark Mode Support and Confirmation Dialog
// Version 2.6 - Added confirmation dialog functionality

(function() {
    // Check if SharedData already exists
    if (typeof window.SharedData !== 'undefined') {
        return;
    }

    // Main SharedData object
    const SharedData = {
        // ======================
        // DATA STRUCTURES
        // ======================
        settings: {
            version: '2.2',
            studyDays: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
            startHour: 8,
            endHour: 17,
            maxDailyLessons: 6,
            minLessonGap: 1,
            lastUpdated: new Date().toISOString()
        },
        
        // Core data collections
        basicTeachers: [],
        departments: [],
        teachers: [],
        rooms: [],
        courses: [],
        studentYears: [],
        schedule: null,
        scheduleHistory: [],
        lastScheduleGeneration: null,
        
        // Indexes for faster lookup
        _indexes: {
            basicTeachersById: {},
            departmentsById: {},
            teachersById: {},
            roomsById: {},
            coursesById: {},
            studentYearsById: {}
        },
        
        // Storage key
        STORAGE_KEY: 'scheduleGeneratorData_v2',
        
        // ======================
        // INITIALIZATION
        // ======================
        init: function() {
            // Load data from localStorage
            this.loadFromLocalStorage();
            
            // Set up storage event listener for cross-tab sync
            window.addEventListener('storage', (e) => this.handleStorageEvent(e));
            
            // Build indexes
            this.buildIndexes();
            
            // Set up auto-save
            this.setupAutoSave();
            
            // Initialize dark mode
            this.setupDarkMode();
            
            // Notify that SharedData is ready
            document.dispatchEvent(new Event('SharedDataReady'));
        },
        
        // ======================
        // DARK MODE UTILITY (Enhanced)
        // ======================
        setupDarkMode: function() {
            // Create the toggle button if it doesn't exist
            if (!document.getElementById('themeToggle')) {
                const themeToggle = document.createElement('button');
                themeToggle.className = 'theme-toggle';
                themeToggle.id = 'themeToggle';
                themeToggle.setAttribute('aria-label', 'تبديل الوضع الليلي');
                themeToggle.innerHTML = '<i>🌙</i>';
                document.body.appendChild(themeToggle);
            }

            const themeToggle = document.getElementById('themeToggle');
            if (!themeToggle) return;

            // Check for saved theme preference or use system preference
            const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
            const currentTheme = localStorage.getItem('theme') || 
                              (prefersDarkScheme.matches ? 'dark' : 'light');

            // Apply the current theme
            if (currentTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                themeToggle.innerHTML = '<i>☀️</i>';
            } else {
                document.documentElement.removeAttribute('data-theme');
                themeToggle.innerHTML = '<i>🌙</i>';
            }

            // Toggle theme on button click
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                
                if (currentTheme === 'dark') {
                    document.documentElement.removeAttribute('data-theme');
                    localStorage.setItem('theme', 'light');
                    themeToggle.innerHTML = '<i>🌙</i>';
                } else {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    localStorage.setItem('theme', 'dark');
                    themeToggle.innerHTML = '<i>☀️</i>';
                }
                
                // Notify other components of theme change
                this.notifyChange();
            });
        },
        
        // ======================
        // CONFIRMATION DIALOG
        // ======================
        showConfirmationDialog: function(title, message, confirmCallback, cancelCallback) {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'dialog-overlay';
            
            // Create dialog
            const dialog = document.createElement('div');
            dialog.className = 'confirmation-dialog';
            dialog.innerHTML = `
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="confirmation-dialog-buttons">
                    <button class="btn-confirm">تأكيد</button>
                    <button class="btn-cancel">إلغاء</button>
                </div>
            `;
            
            // Add event listeners
            dialog.querySelector('.btn-confirm').addEventListener('click', () => {
                document.body.removeChild(overlay);
                if (typeof confirmCallback === 'function') confirmCallback();
            });
            
            dialog.querySelector('.btn-cancel').addEventListener('click', () => {
                document.body.removeChild(overlay);
                if (typeof cancelCallback === 'function') cancelCallback();
            });
            
            // Add to DOM
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
        },
        
        // ======================
        // DATA SYNC ACROSS TABS
        // ======================
        handleStorageEvent: function(event) {
            if (event.key === this.STORAGE_KEY && event.newValue) {
                try {
                    const newData = JSON.parse(event.newValue);
                    this.mergeData(newData);
                    this.buildIndexes();
                    this.notifyChange();
                    console.log('Data synced from other tab');
                } catch (error) {
                    console.error('Error processing storage event:', error);
                }
            }
        },
        
        // ======================
        // DATA PERSISTENCE
        // ======================
        loadFromLocalStorage: function() {
            try {
                const savedData = localStorage.getItem(this.STORAGE_KEY);
                if (savedData) {
                    const parsedData = JSON.parse(savedData);
                    
                    // Validate version
                    if (!parsedData.settings || parsedData.settings.version !== this.settings.version) {
                        console.warn('Data version mismatch, performing migration');
                        this.migrateData(parsedData);
                        return;
                    }
                    
                    // Merge loaded data
                    this.mergeData(parsedData);
                    console.log('Data loaded successfully');
                }
            } catch (error) {
                console.error('Error loading from localStorage:', error);
                this.showToast('حدث خطأ أثناء تحميل البيانات', 'error');
                
                // Initialize with default data
                this.resetToDefaults();
            }
        },
        
        saveToLocalStorage: function() {
            try {
                const dataToSave = this.prepareDataForSave();
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
                
                // Trigger storage event to sync other tabs
                const event = new StorageEvent('storage', {
                    key: this.STORAGE_KEY,
                    newValue: JSON.stringify(dataToSave)
                });
                window.dispatchEvent(event);
                
                console.log('Data saved successfully');
            } catch (error) {
                console.error('Error saving to localStorage:', error);
                this.showToast('حدث خطأ أثناء حفظ البيانات', 'error');
            }
        },
        
        // ======================
        // DATA MIGRATION
        // ======================
        migrateData: function(oldData) {
            // Migrate from older versions to current version
            if (oldData.settings && oldData.settings.version === '2.2') {
                this.settings = {...this.settings, ...oldData.settings};
                this.settings.version = '2.2';
                
                // Copy all collections
                this.basicTeachers = oldData.basicTeachers || [];
                this.departments = oldData.departments || [];
                this.teachers = oldData.teachers || [];
                this.rooms = oldData.rooms || [];
                this.courses = oldData.courses || [];
                this.studentYears = oldData.studentYears || [];
                this.schedule = oldData.schedule || null;
                this.scheduleHistory = oldData.scheduleHistory || [];
                this.lastScheduleGeneration = oldData.lastScheduleGeneration || null;
                
                // Save migrated data
                this.saveToLocalStorage();
            } else {
                // Unknown version, reset to defaults
                this.resetToDefaults();
            }
        },
        
        resetToDefaults: function() {
            this.settings = {
                version: '2.2',
                studyDays: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
                startHour: 8,
                endHour: 17,
                maxDailyLessons: 6,
                minLessonGap: 1,
                lastUpdated: new Date().toISOString()
            };
            
            this.basicTeachers = [];
            this.departments = [];
            this.teachers = [];
            this.rooms = [];
            this.courses = [];
            this.studentYears = [];
            this.schedule = null;
            this.scheduleHistory = [];
            this.lastScheduleGeneration = null;
            
            this.buildIndexes();
            this.saveToLocalStorage();
            this.showToast('تم التهيئة بالبيانات الافتراضية', 'warning');
        },
        
        // ======================
        // DATA ACCESS METHODS
        // ======================
        getBasicTeacherById: function(id) {
            return this._indexes.basicTeachersById[id] || null;
        },
        
        getDepartmentById: function(id) {
            return this._indexes.departmentsById[id] || null;
        },
        
        getTeacherById: function(id) {
            return this._indexes.teachersById[id] || null;
        },
        
        getRoomById: function(id) {
            return this._indexes.roomsById[id] || null;
        },
        
        getCourseById: function(id) {
            return this._indexes.coursesById[id] || null;
        },
        
        getStudentYearById: function(id) {
            return this._indexes.studentYearsById[id] || null;
        },
        
        // ======================
        // UTILITY METHODS
        // ======================
        generateId: function() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        },
        
        formatHourToAMPM: function(hour) {
            if (hour < 0 || hour > 23) return '';
            if (hour === 0) return '12:00 صباحاً';
            if (hour < 12) return `${hour}:00 صباحاً`;
            if (hour === 12) return '12:00 ظهراً';
            return `${hour - 12}:00 مساءً`;
        },
        
        getDays: function() {
            return this.settings.studyDays || ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
        },
        
        getHoursRange: function() {
            return {
                startHour: this.settings.startHour || 8,
                endHour: this.settings.endHour || 17
            };
        },
        
        // ======================
        // NOTIFICATION SYSTEM
        // ======================
        _changeListeners: [],
        
        addChangeListener: function(listener) {
            if (typeof listener === 'function') {
                this._changeListeners.push(listener);
            }
        },
        
        removeChangeListener: function(listener) {
            this._changeListeners = this._changeListeners.filter(l => l !== listener);
        },
        
        notifyChange: function() {
            this._changeListeners.forEach(listener => {
                try {
                    listener();
                } catch (error) {
                    console.error('Error in change listener:', error);
                }
            });
        },
        
        // ======================
        // PRIVATE METHODS
        // ======================
        mergeData: function(newData) {
            if (!newData) return;
            
            // Settings
            if (newData.settings) {
                this.settings = {...this.settings, ...newData.settings};
            }
            
            // Collections
            if (Array.isArray(newData.basicTeachers)) this.basicTeachers = newData.basicTeachers;
            if (Array.isArray(newData.departments)) this.departments = newData.departments;
            if (Array.isArray(newData.teachers)) this.teachers = newData.teachers;
            if (Array.isArray(newData.rooms)) this.rooms = newData.rooms;
            if (Array.isArray(newData.courses)) this.courses = newData.courses;
            if (Array.isArray(newData.studentYears)) this.studentYears = newData.studentYears;
            
            // Schedule data
            this.schedule = newData.schedule || this.schedule;
            this.scheduleHistory = Array.isArray(newData.scheduleHistory) ? 
                newData.scheduleHistory : this.scheduleHistory;
            this.lastScheduleGeneration = newData.lastScheduleGeneration || this.lastScheduleGeneration;
        },
        
        prepareDataForSave: function() {
            return {
                settings: this.settings,
                basicTeachers: this.basicTeachers,
                departments: this.departments,
                teachers: this.teachers,
                rooms: this.rooms,
                courses: this.courses,
                studentYears: this.studentYears,
                schedule: this.schedule,
                scheduleHistory: this.scheduleHistory,
                lastScheduleGeneration: this.lastScheduleGeneration,
                lastUpdated: new Date().toISOString()
            };
        },
        
        buildIndexes: function() {
            // Basic Teachers
            this._indexes.basicTeachersById = {};
            this.basicTeachers.forEach(teacher => {
                if (teacher.id) this._indexes.basicTeachersById[teacher.id] = teacher;
            });
            
            // Departments
            this._indexes.departmentsById = {};
            this.departments.forEach(dept => {
                if (dept.id) this._indexes.departmentsById[dept.id] = dept;
            });
            
            // Teachers
            this._indexes.teachersById = {};
            this.teachers.forEach(teacher => {
                if (teacher.id) this._indexes.teachersById[teacher.id] = teacher;
            });
            
            // Rooms
            this._indexes.roomsById = {};
            this.rooms.forEach(room => {
                if (room.id) this._indexes.roomsById[room.id] = room;
            });
            
            // Courses
            this._indexes.coursesById = {};
            this.courses.forEach(course => {
                if (course.id) this._indexes.coursesById[course.id] = course;
            });
            
            // Student Years
            this._indexes.studentYearsById = {};
            this.studentYears.forEach(year => {
                if (year.id) this._indexes.studentYearsById[year.id] = year;
            });
        },
        
        setupAutoSave: function() {
            // Auto-save every 5 minutes
            setInterval(() => {
                this.saveToLocalStorage();
            }, 5 * 60 * 1000);
        },
        
        // ======================
        // UI METHODS
        // ======================
        showToast: function(message, type = 'info') {
            // Create container if it doesn't exist
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.className = 'toast-container';
                document.body.appendChild(container);
            }
            
            // Create toast
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            container.appendChild(toast);
            
            // Auto-remove after delay
            setTimeout(() => {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    };

    // Add to global scope
    window.SharedData = SharedData;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => SharedData.init());
    } else {
        SharedData.init();
    }
})();