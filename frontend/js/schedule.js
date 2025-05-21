// schedule.js - Final Version with Color Fixes

document.addEventListener('DOMContentLoaded', () => {
    if (window.scheduleManager) {
        window.scheduleManager.init();
    } else {
        window.scheduleManager = new ScheduleManager();
        window.scheduleManager.init();
    }
});

class ScheduleManager {
    constructor() {
        this.currentView = 'daily';
        this.currentFilters = {
            department: '',
            teacher: '',
            room: ''
        };
    }

    init() {
        this.loadScheduleData();
        this.setupEventListeners();
        this.initFilters();
        this.renderSchedule();
        this.updateStats();
    }

    loadScheduleData() {
        const urlParams = new URLSearchParams(window.location.search);
        const scheduleParam = urlParams.get('schedule');
        
        if (scheduleParam) {
            try {
                const decompressed = decodeURIComponent(atob(scheduleParam));
                SharedData.schedule = JSON.parse(decompressed);
                SharedData.lastScheduleGeneration = new Date().toISOString();
                SharedData.saveToLocalStorage();
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (e) {
                console.error('Failed to parse schedule from URL:', e);
                this.showToast('فشل تحميل الجدول من الرابط', 'error');
            }
        }
        
        if (!SharedData.schedule || SharedData.schedule.length === 0) {
            document.getElementById('finalSchedule').innerHTML = `
                <div class="empty-schedule">
                    <p>لا يوجد جدول مدرج بعد</p>
                    <p>يرجى الذهاب إلى صفحة "توليد الجدول" لإنشاء جدول دراسي</p>
                    <a href="generate.html" class="btn-primary">توليد جدول جديد</a>
                </div>
            `;
            document.getElementById('scheduleActions').style.display = 'none';
            document.getElementById('scheduleControls').style.display = 'none';
            document.getElementById('scheduleStats').style.display = 'none';
            document.getElementById('scheduleAnalysis').style.display = 'none';
            return;
        }
    }

    setupEventListeners() {
        // View format selector
        document.getElementById('viewFormat')?.addEventListener('change', (e) => {
            this.currentView = e.target.value;
            this.renderSchedule();
        });

        // Color scheme selector
        document.getElementById('colorScheme')?.addEventListener('change', (e) => {
            this.renderSchedule();
        });

        // Department filter
        document.getElementById('deptFilter')?.addEventListener('change', (e) => {
            this.currentFilters.department = e.target.value;
            this.updateTeacherFilter();
            this.renderSchedule();
        });
        
        // Teacher filter
        document.getElementById('teacherFilter')?.addEventListener('change', (e) => {
            this.currentFilters.teacher = e.target.value;
            this.renderSchedule();
        });
        
        // Room filter
        document.getElementById('roomFilter')?.addEventListener('change', (e) => {
            this.currentFilters.room = e.target.value;
            this.renderSchedule();
        });

        // PDF export
        document.getElementById('downloadPdfBtn')?.addEventListener('click', () => {
            this.exportToPDF();
        });
        
        // Excel export
        document.getElementById('downloadExcelBtn')?.addEventListener('click', () => {
            this.exportToExcel();
        });
        
        // Print
        document.getElementById('printScheduleBtn')?.addEventListener('click', () => {
            this.printSchedule();
        });
        
        // Refresh
        document.getElementById('refreshScheduleBtn')?.addEventListener('click', () => {
            this.renderSchedule();
            this.showToast('تم تحديث الجدول بنجاح', 'success');
        });

        // Analysis toggle
        document.getElementById('toggleAnalysis')?.addEventListener('click', () => {
            const analysisContent = document.getElementById('analysisContent');
            analysisContent.classList.toggle('hidden');
        });

        // Delete schedule
        document.getElementById('deleteScheduleBtn')?.addEventListener('click', () => {
            this.deleteSchedule();
        });
    }

    initFilters() {
        const deptFilter = document.getElementById('deptFilter');
        if (deptFilter) {
            deptFilter.innerHTML = `
                <option value="">جميع الأقسام</option>
                ${SharedData.departments.map(dept => `
                    <option value="${dept.id}">${dept.name} (${dept.code})</option>
                `).join('')}
            `;
        }

        const roomFilter = document.getElementById('roomFilter');
        if (roomFilter) {
            roomFilter.innerHTML = `
                <option value="">جميع القاعات</option>
                ${SharedData.rooms.map(room => `
                    <option value="${room.id}">${room.name}</option>
                `).join('')}
            `;
        }
    }

    updateTeacherFilter() {
        const teacherFilter = document.getElementById('teacherFilter');
        if (!teacherFilter) return;
        
        if (!this.currentFilters.department) {
            teacherFilter.innerHTML = '<option value="">اختر القسم أولاً</option>';
            teacherFilter.disabled = true;
            return;
        }
        
        const departmentTeachers = SharedData.teachers.filter(
            teacher => teacher.department === this.currentFilters.department
        );
        
        if (departmentTeachers.length === 0) {
            teacherFilter.innerHTML = '<option value="">لا يوجد مدرسين في هذا القسم</option>';
            teacherFilter.disabled = true;
        } else {
            teacherFilter.innerHTML = `
                <option value="">جميع المدرسين</option>
                ${departmentTeachers.map(teacher => `
                    <option value="${teacher.id}">${teacher.name} - ${teacher.subject}</option>
                `).join('')}
            `;
            teacherFilter.disabled = false;
        }
    }

    renderSchedule() {
        if (!SharedData.schedule || SharedData.schedule.length === 0) return;

        const filteredSchedule = this.filterSchedule();
        const finalSchedule = document.getElementById('finalSchedule');
        
        if (!finalSchedule) return;

        finalSchedule.innerHTML = '';

        switch (this.currentView) {
            case 'daily':
                finalSchedule.appendChild(this.createDailyView(filteredSchedule));
                break;
            case 'weekly':
                finalSchedule.appendChild(this.createWeeklyView(filteredSchedule));
                break;
            case 'teacher':
                finalSchedule.appendChild(this.createTeacherView(filteredSchedule));
                break;
            case 'room':
                finalSchedule.appendChild(this.createRoomView(filteredSchedule));
                break;
        }

        this.updateLegend();
        this.setupLessonDeleteButtons();
    }

    createDailyView(schedule) {
        const days = SharedData.getDays();
        const view = document.createElement('div');
        view.className = 'daily-view';

        days.forEach(day => {
            const daySection = document.createElement('div');
            daySection.className = 'day-section';
            daySection.innerHTML = `<h3>${day}</h3>`;
            
            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>الوقت</th>
                        <th>المادة</th>
                        <th>المدرس</th>
                        <th>القاعة</th>
                        <th>المدة</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            const dayLessons = schedule.filter(l => l.day === day)
                .sort((a, b) => a.hour - b.hour);
                
            dayLessons.forEach(lesson => {
                const teacher = SharedData.getTeacherById(lesson.teacherId);
                const room = SharedData.getRoomById(lesson.roomId);
                const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
                const dept = teacher ? SharedData.getDepartmentById(teacher.department) : null;
                
                const colorStyle = this.getColorStyle(lesson, dept);
                
                table.querySelector('tbody').innerHTML += `
                    <tr style="${colorStyle}">
                        <td>${SharedData.formatHourToAMPM(lesson.hour)}</td>
                        <td>${course?.name || lesson.subject || 'غير معروف'}</td>
                        <td>${teacher?.name || 'غير معروف'}</td>
                        <td>${room?.name || 'غير معروف'}</td>
                        <td>${lesson.duration} ساعة</td>
                    </tr>
                `;
            });
            
            daySection.appendChild(table);
            view.appendChild(daySection);
        });
        
        return view;
    }

    createWeeklyView(schedule) {
    const days = SharedData.getDays();
    const { startHour, endHour } = SharedData.getHoursRange();
    const view = document.createElement('div');
    view.className = 'weekly-view';
    
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>الوقت</th>
                ${days.map(day => `<th>${day}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
    `;
    
    // Create a grid to track occupied cells
    const occupiedCells = {};
    days.forEach(day => {
        occupiedCells[day] = {};
        for (let hour = startHour; hour < endHour; hour++) {
            occupiedCells[day][hour] = false;
        }
    });

    for (let hour = startHour; hour < endHour; hour++) {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${SharedData.formatHourToAMPM(hour)}</td>`;
        
        days.forEach(day => {
            // Skip if this cell is already occupied by a multi-hour lesson
            if (occupiedCells[day][hour]) {
                return;
            }
            
            const cell = document.createElement('td');
            
            // Find all lessons that start at this hour
            const hourLessons = schedule.filter(lesson => 
                lesson.day === day && 
                lesson.hour === hour
            );
            
            if (hourLessons.length > 0) {
                const lessonsContainer = document.createElement('div');
                lessonsContainer.className = 'lessons-container';
                
                hourLessons.forEach(lesson => {
                    const teacher = SharedData.getTeacherById(lesson.teacherId);
                    const room = SharedData.getRoomById(lesson.roomId);
                    const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
                    const dept = teacher ? SharedData.getDepartmentById(teacher.department) : null;
                    
                    const colorStyle = this.getColorStyle(lesson, dept);
                    
                    const lessonDiv = document.createElement('div');
                    lessonDiv.className = 'lesson-cell';
                    lessonDiv.style.cssText = colorStyle;
                    lessonDiv.innerHTML = `
                        <div class="subject">${course?.name || lesson.subject || 'غير معروف'}</div>
                        <div class="teacher">${teacher?.name || 'غير معروف'}</div>
                        <div class="room">${room?.name || 'غير معروف'}</div>
                        ${lesson.duration > 1 ? `<div class="duration">${lesson.duration} ساعات</div>` : ''}
                    `;
                    
                    lessonsContainer.appendChild(lessonDiv);
                    
                    // Mark subsequent hours as occupied for multi-hour lessons
                    if (lesson.duration > 1) {
                        for (let h = 1; h < lesson.duration; h++) {
                            const nextHour = hour + h;
                            if (nextHour < endHour) {
                                occupiedCells[day][nextHour] = true;
                            }
                        }
                    }
                });
                
                cell.appendChild(lessonsContainer);
                
                // Set rowspan for multi-hour lessons
                const maxDuration = Math.max(...hourLessons.map(l => l.duration));
                if (maxDuration > 1) {
                    cell.rowSpan = maxDuration;
                    cell.classList.add('multi-hour-cell');
                }
            }
            
            row.appendChild(cell);
        });
        
        table.querySelector('tbody').appendChild(row);
    }
    
    view.appendChild(table);
    return view;
}

    createTeacherView(schedule) {
        const teachers = [...new Set(schedule.map(l => l.teacherId))]
            .map(id => SharedData.getTeacherById(id))
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name));
        
        const view = document.createElement('div');
        view.className = 'teacher-view';
        
        teachers.forEach(teacher => {
            const teacherSection = document.createElement('div');
            teacherSection.className = 'teacher-section';
            teacherSection.innerHTML = `<h3>${teacher.name}</h3>`;
            
            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>اليوم</th>
                        <th>الوقت</th>
                        <th>المادة</th>
                        <th>القاعة</th>
                        <th>المدة</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            const teacherLessons = schedule.filter(l => l.teacherId === teacher.id)
                .sort((a, b) => a.day.localeCompare(b.day) || a.hour - b.hour);
                
            teacherLessons.forEach(lesson => {
                const room = SharedData.getRoomById(lesson.roomId);
                const course = SharedData.getCourseById(teacher.courseId);
                const dept = SharedData.getDepartmentById(teacher.department);
                
                const colorStyle = this.getColorStyle(lesson, dept);
                
                table.querySelector('tbody').innerHTML += `
                    <tr style="${colorStyle}">
                        <td>${lesson.day}</td>
                        <td>${SharedData.formatHourToAMPM(lesson.hour)}</td>
                        <td>${course?.name || lesson.subject || 'غير معروف'}</td>
                        <td>${room?.name || 'غير معروف'}</td>
                        <td>${lesson.duration} ساعة</td>
                    </tr>
                `;
            });
            
            teacherSection.appendChild(table);
            view.appendChild(teacherSection);
        });
        
        return view;
    }

    createRoomView(schedule) {
        const rooms = [...new Set(schedule.map(l => l.roomId))]
            .map(id => SharedData.getRoomById(id))
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name));
        
        const view = document.createElement('div');
        view.className = 'room-view';
        
        rooms.forEach(room => {
            const roomSection = document.createElement('div');
            roomSection.className = 'room-section';
            roomSection.innerHTML = `<h3>${room.name}</h3>`;
            
            const table = document.createElement('table');
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>اليوم</th>
                        <th>الوقت</th>
                        <th>المادة</th>
                        <th>المدرس</th>
                        <th>المدة</th>
                    </tr>
                </thead>
                <tbody>
            `;
            
            const roomLessons = schedule.filter(l => l.roomId === room.id)
                .sort((a, b) => a.day.localeCompare(b.day) || a.hour - b.hour);
                
            roomLessons.forEach(lesson => {
                const teacher = SharedData.getTeacherById(lesson.teacherId);
                const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
                const dept = teacher ? SharedData.getDepartmentById(teacher.department) : null;
                
                const colorStyle = this.getColorStyle(lesson, dept);
                
                table.querySelector('tbody').innerHTML += `
                    <tr style="${colorStyle}">
                        <td>${lesson.day}</td>
                        <td>${SharedData.formatHourToAMPM(lesson.hour)}</td>
                        <td>${course?.name || lesson.subject || 'غير معروف'}</td>
                        <td>${teacher?.name || 'غير معروف'}</td>
                        <td>${lesson.duration} ساعة</td>
                    </tr>
                `;
            });
            
            roomSection.appendChild(table);
            view.appendChild(roomSection);
        });
        
        return view;
    }

    getColorStyle(lesson, dept) {
        const colorScheme = document.getElementById('colorScheme')?.value || 'department';
        
        if (colorScheme === 'none') return '';
        
        let color = '#8e44ad'; // Default purple
        
        const teacher = SharedData.getTeacherById(lesson.teacherId);
        const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
        
        if (colorScheme === 'department') {
            const departmentId = teacher?.department || lesson.department;
            color = departmentId ? SharedData.generateColorForId(departmentId) : '#8e44ad';
        } 
        else if (colorScheme === 'year') {
            const yearId = lesson.yearId || 'default-year';
            color = SharedData.generateColorForId(yearId);
        } 
        else if (colorScheme === 'subject') {
            const subjectId = course?.id || lesson.subject || 'default-subject';
            color = SharedData.generateColorForId(subjectId);
        }
        
        // More distinct styling with higher contrast
        return `
            background-color: ${color}15;
            border-left: 4px solid ${color};
            box-shadow: 0 2px 4px ${color}20;
        `;
    }

    filterSchedule() {
        if (!SharedData.schedule) return [];
        
        return SharedData.schedule.filter(lesson => {
            if (this.currentFilters.department) {
                const teacher = SharedData.getTeacherById(lesson.teacherId);
                if (!teacher || teacher.department !== this.currentFilters.department) {
                    return false;
                }
            }
            
            if (this.currentFilters.teacher && lesson.teacherId !== this.currentFilters.teacher) {
                return false;
            }
            
            if (this.currentFilters.room && lesson.roomId !== this.currentFilters.room) {
                return false;
            }
            
            return true;
        });
    }

    updateLegend() {
        const legendContainer = document.getElementById('scheduleLegend');
        if (!legendContainer) return;
        
        const colorScheme = document.getElementById('colorScheme')?.value || 'department';
        
        if (colorScheme === 'none') {
            legendContainer.classList.add('hidden');
            return;
        }
        
        legendContainer.classList.remove('hidden');
        
        let legendHTML = `<h3>مفتاح الألوان:</h3><div class="legend-items-container">`;
        
        if (colorScheme === 'department') {
            // Get unique departments from schedule
            const departments = new Map();
            SharedData.schedule.forEach(lesson => {
                const teacher = SharedData.getTeacherById(lesson.teacherId);
                const deptId = teacher?.department || lesson.department;
                if (deptId && !departments.has(deptId)) {
                    const dept = SharedData.getDepartmentById(deptId);
                    if (dept) departments.set(deptId, dept);
                }
            });
            
            departments.forEach(dept => {
                const color = SharedData.generateColorForId(dept.id);
                legendHTML += `
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: ${color}"></span>
                        <span class="legend-text">${dept.name} (${dept.code})</span>
                    </div>
                `;
            });
        }
        else if (colorScheme === 'year') {
            // Get unique years from schedule
            const years = new Map();
            SharedData.schedule.forEach(lesson => {
                if (lesson.yearId && !years.has(lesson.yearId)) {
                    const year = SharedData.getStudentYearById(lesson.yearId);
                    if (year) years.set(lesson.yearId, year);
                }
            });
            
            years.forEach(year => {
                const color = SharedData.generateColorForId(year.id);
                legendHTML += `
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: ${color}"></span>
                        <span class="legend-text">${year.name}</span>
                    </div>
                `;
            });
        }
        else if (colorScheme === 'subject') {
            // Get unique subjects from schedule
            const subjects = new Map();
            SharedData.schedule.forEach(lesson => {
                const teacher = SharedData.getTeacherById(lesson.teacherId);
                const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
                const subjectId = course?.id || lesson.subject || 'default';
                const subjectName = course?.name || lesson.subject || 'غير معروف';
                
                if (!subjects.has(subjectId)) {
                    subjects.set(subjectId, subjectName);
                }
            });
            
            subjects.forEach((name, id) => {
                const color = SharedData.generateColorForId(id);
                legendHTML += `
                    <div class="legend-item">
                        <span class="legend-color" style="background-color: ${color}"></span>
                        <span class="legend-text">${name}</span>
                    </div>
                `;
            });
        }
        
        legendHTML += `</div>`;
        document.getElementById('legendItems').innerHTML = legendHTML;
    }

    setupLessonDeleteButtons() {
        document.querySelectorAll('.delete-lesson-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const lessonId = btn.closest('.time-slot').dataset.lessonId;
                this.deleteLesson(lessonId);
            });
        });
    }

    deleteLesson(lessonId) {
        SharedData.showConfirmationDialog(
            'حذف الحصة',
            'هل أنت متأكد أنك تريد حذف هذه الحصة؟',
            () => {
                SharedData.schedule = SharedData.schedule.filter(lesson => lesson.id !== lessonId);
                SharedData.saveToLocalStorage();
                this.renderSchedule();
                this.updateStats();
                this.showToast('تم حذف الحصة بنجاح', 'success');
            },
            () => {
                this.showToast('تم إلغاء حذف الحصة', 'info');
            }
        );
    }

    deleteSchedule() {
        SharedData.showConfirmationDialog(
            'حذف الجدول',
            'هل أنت متأكد أنك تريد حذف الجدول الحالي؟ لا يمكن التراجع عن هذا الإجراء.',
            () => {
                SharedData.schedule = null;
                SharedData.lastScheduleGeneration = null;
                SharedData.saveToLocalStorage();
                
                this.renderSchedule();
                this.updateStats();
                this.showToast('تم حذف الجدول بنجاح', 'success');
                
                document.getElementById('scheduleActions').style.display = 'none';
                document.getElementById('scheduleControls').style.display = 'none';
                document.getElementById('scheduleStats').style.display = 'none';
                document.getElementById('scheduleAnalysis').style.display = 'none';
            },
            () => {
                this.showToast('تم إلغاء حذف الجدول', 'info');
            }
        );
    }

    updateStats() {
        if (!SharedData.schedule || SharedData.schedule.length === 0) return;
        
        const totalRequired = SharedData.teachers.reduce((sum, t) => sum + (t.requiredLessons || 2), 0);
        let score = (SharedData.schedule.length / totalRequired) * 70;
        
        // Calculate conflicts
        const teacherConflicts = this.checkTeacherConflicts();
        score -= teacherConflicts * 5;
        const roomConflicts = this.checkRoomConflicts();
        score -= roomConflicts * 3;
        const labIssues = this.checkLabRequirements();
        score -= labIssues * 2;
        
        const completionPercentage = Math.round((SharedData.schedule.length / totalRequired) * 100);
        document.getElementById('completionBar').style.width = `${completionPercentage}%`;
        document.getElementById('completionPercent').textContent = `${completionPercentage}%`;
        
        document.getElementById('scheduleScore').textContent = Math.max(0, Math.min(100, Math.round(score)));
        document.getElementById('totalLessons').textContent = SharedData.schedule.length;
        document.getElementById('totalTeachers').textContent = new Set(SharedData.schedule.map(l => l.teacherId)).size;
        
        this.updateAnalysis();
    }

    checkTeacherConflicts() {
        const conflicts = new Set();
        const teacherSlots = {};
        
        SharedData.schedule.forEach(lesson => {
            // Check for each hour the lesson occupies
            for (let h = 0; h < lesson.duration; h++) {
                const hour = lesson.hour + h;
                const key = `${lesson.day}-${hour}`;
                
                if (!teacherSlots[key]) {
                    teacherSlots[key] = new Set();
                }
                
                if (teacherSlots[key].has(lesson.teacherId)) {
                    conflicts.add(`${lesson.teacherId}-${key}`);
                } else {
                    teacherSlots[key].add(lesson.teacherId);
                }
            }
        });
        
        return conflicts.size;
    }

    checkRoomConflicts() {
        const conflicts = new Set();
        const roomSlots = {};
        
        SharedData.schedule.forEach(lesson => {
            // Check for each hour the lesson occupies
            for (let h = 0; h < lesson.duration; h++) {
                const hour = lesson.hour + h;
                const key = `${lesson.day}-${hour}`;
                
                if (!roomSlots[key]) {
                    roomSlots[key] = new Set();
                }
                
                if (roomSlots[key].has(lesson.roomId)) {
                    conflicts.add(`${lesson.roomId}-${key}`);
                } else {
                    roomSlots[key].add(lesson.roomId);
                }
            }
        });
        
        return conflicts.size;
    }

    checkLabRequirements() {
        let issues = 0;
        
        SharedData.schedule.forEach(lesson => {
            if (lesson.requiresLab) {
                const room = SharedData.getRoomById(lesson.roomId);
                if (!room || room.type === 'room') {
                    issues++;
                }
            }
        });
        
        return issues;
    }

    updateAnalysis() {
        const analysisContent = document.getElementById('analysisContent');
        if (!analysisContent) return;
        
        const teacherConflicts = this.checkTeacherConflicts();
        const roomConflicts = this.checkRoomConflicts();
        const labIssues = this.checkLabRequirements();
        
        let analysisHTML = `
            <div class="analysis-section">
                <h3>تحليل التضارب</h3>
                <div class="analysis-item ${teacherConflicts > 0 ? 'warning' : 'success'}">
                    <span class="analysis-icon">${teacherConflicts > 0 ? '⚠️' : '✓'}</span>
                    <span class="analysis-text">تضارب المدرسين: ${teacherConflicts}</span>
                </div>
                <div class="analysis-item ${roomConflicts > 0 ? 'warning' : 'success'}">
                    <span class="analysis-icon">${roomConflicts > 0 ? '⚠️' : '✓'}</span>
                    <span class="analysis-text">تضارب القاعات: ${roomConflicts}</span>
                </div>
                <div class="analysis-item ${labIssues > 0 ? 'warning' : 'success'}">
                    <span class="analysis-icon">${labIssues > 0 ? '⚠️' : '✓'}</span>
                    <span class="analysis-text">مشاكل المعامل: ${labIssues}</span>
                </div>
            </div>
        `;
        
        const teacherLoad = this.analyzeTeacherLoad();
        analysisHTML += `
            <div class="analysis-section">
                <h3>توزيع الحصص على المدرسين</h3>
                <div class="analysis-chart">
                    ${teacherLoad.map(teacher => `
                        <div class="teacher-load">
                            <div class="teacher-name">${teacher.name}</div>
                            <div class="load-bar-container">
                                <div class="load-bar" style="width: ${teacher.percentage}%; background-color: ${teacher.color};"></div>
                            </div>
                            <div class="load-value">${teacher.assigned}/${teacher.required} (${teacher.percentage}%)</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        analysisContent.innerHTML = analysisHTML;
    }

    analyzeTeacherLoad() {
        const teacherStats = {};
        
        SharedData.teachers.forEach(teacher => {
            teacherStats[teacher.id] = {
                name: teacher.name,
                required: teacher.requiredLessons || 0,
                assigned: 0,
                department: teacher.department
            };
        });
        
        SharedData.schedule.forEach(lesson => {
            if (teacherStats[lesson.teacherId]) {
                teacherStats[lesson.teacherId].assigned++;
            }
        });
        
        return Object.values(teacherStats)
            .map(teacher => {
                const dept = SharedData.getDepartmentById(teacher.department);
                return {
                    ...teacher,
                    percentage: teacher.required > 0 ? Math.round((teacher.assigned / teacher.required) * 100) : 0,
                    color: dept?.color || '#8e44ad'
                };
            })
            .sort((a, b) => b.percentage - a.percentage);
    }

    exportToPDF() {
        const element = document.getElementById('finalSchedule');
        const opt = {
            margin: 10,
            filename: 'الجدول_الدراسي.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape' }
        };
        
        const loadingToast = this.showToast('جار إنشاء ملف PDF...', 'info', 0);
        
        html2pdf().from(element).set(opt).save()
            .then(() => {
                loadingToast.remove();
                this.showToast('تم تصدير الجدول إلى PDF بنجاح', 'success');
            })
            .catch(err => {
                loadingToast.remove();
                console.error('PDF export error:', err);
                this.showToast('فشل تصدير الجدول إلى PDF', 'error');
            });
    }

    exportToExcel() {
        if (!SharedData.schedule || SharedData.schedule.length === 0) return;
        
        const data = SharedData.schedule.map(lesson => {
            const teacher = SharedData.getTeacherById(lesson.teacherId);
            const room = SharedData.getRoomById(lesson.roomId);
            const dept = teacher ? SharedData.getDepartmentById(teacher.department) : null;
            
            return {
                'اليوم': lesson.day,
                'الوقت': SharedData.formatHourToAMPM(lesson.hour),
                'المدة': `${lesson.duration} ساعة`,
                'المادة': teacher?.subject || 'غير معروف',
                'المدرس': teacher?.name || 'غير معروف',
                'القسم': dept?.name || 'غير معروف',
                'القاعة': room?.name || 'غير معروف',
                'معمل': lesson.requiresLab ? 'نعم' : 'لا'
            };
        });
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الجدول الدراسي");
        
        const loadingToast = this.showToast('جار إنشاء ملف Excel...', 'info', 0);
        
        try {
            XLSX.writeFile(wb, 'الجدول_الدراسي.xlsx');
            loadingToast.remove();
            this.showToast('تم تصدير الجدول إلى Excel بنجاح', 'success');
        } catch (err) {
            loadingToast.remove();
            console.error('Excel export error:', err);
            this.showToast('فشل تصدير الجدول إلى Excel', 'error');
        }
    }

    printSchedule() {
        const scheduleElement = document.getElementById('finalSchedule');
        const originalContent = scheduleElement.innerHTML;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <title>الجدول الدراسي - طباعة</title>
                <style>
                    body { font-family: 'Tajawal', sans-serif; padding: 20px; }
                    h1 { color: #8e44ad; text-align: center; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                    th { background-color: #8e44ad; color: white; }
                    .time-slot { min-height: 60px; padding: 5px; }
                    .subject { font-weight: bold; }
                    .teacher { font-size: 0.9em; }
                    .room { color: #e74c3c; font-weight: bold; }
                    .multi-hour-lesson { background-color: rgba(142, 68, 173, 0.1); border: 1px solid #8e44ad; }
                    @page { size: A3 landscape; margin: 10mm; }
                </style>
            </head>
            <body>
                <h1>الجدول الدراسي</h1>
                <p style="text-align:center;">${document.getElementById('scheduleDetails')?.textContent || ''}</p>
                ${scheduleElement.innerHTML}
                <p style="text-align:center; margin-top: 30px;">تم الطباعة في ${new Date().toLocaleDateString('ar-EG')}</p>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    }

    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('fade-out');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
        
        return toast;
    }
}