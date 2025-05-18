document.addEventListener('DOMContentLoaded', () => {
    if (window.SharedData) {
        initGenerator();
    } else {
        document.addEventListener('SharedDataReady', initGenerator);
    }
});

function initGenerator() {
    if (!window.SharedData) {
        console.error('SharedData not available');
        return;
    }

    setupUI();
    setupEventListeners();
    updateReadinessChecks();
}

function setupUI() {
    populateDepartmentFilter();
    updateReadinessChecks();
    
    const container = document.querySelector('.container');
    if (!document.getElementById('timetableViews')) {
        const timetableDiv = document.createElement('div');
        timetableDiv.id = 'timetableViews';
        timetableDiv.className = 'timetable-views hidden';
        container.appendChild(timetableDiv);
    }
}

function setupEventListeners() {
    document.getElementById('generateBtn')?.addEventListener('click', startGeneration);
    document.getElementById('stopBtn')?.addEventListener('click', stopGeneration);
    document.getElementById('viewScheduleBtn')?.addEventListener('click', renderTimetables);
    document.getElementById('exportBtn')?.addEventListener('click', exportSchedule);
    document.getElementById('tryAgainBtn')?.addEventListener('click', resetUI);
    
    document.getElementById('deptFilter')?.addEventListener('change', updateReadinessChecks);
}

function populateDepartmentFilter() {
    const deptFilter = document.getElementById('deptFilter');
    if (!deptFilter) return;

    deptFilter.innerHTML = '<option value="">جميع الأقسام</option>';
    
    (SharedData.departments || []).forEach(dept => {
        const option = document.createElement('option');
        option.value = dept.id;
        option.textContent = `${dept.name} (${dept.code})`;
        deptFilter.appendChild(option);
    });
}

function updateReadinessChecks() {
    const deptId = document.getElementById('deptFilter')?.value || '';
    
    const teachers = deptId 
        ? SharedData.teachers.filter(t => t.department === deptId)
        : SharedData.teachers;
    
    const rooms = deptId 
        ? SharedData.rooms.filter(r => !r.department || r.department === deptId)
        : SharedData.rooms;

    updateCheckStatus('teachers', 
        teachers.length > 0,
        `تم العثور على ${teachers.length} مدرس`,
        'لا يوجد مدرسين مسجلين'
    );

    updateCheckStatus('rooms',
        rooms.length > 0,
        `تم العثور على ${rooms.length} مكان`,
        'لا يوجد أماكن مسجلة'
    );

    const availableTeachers = teachers.filter(t => 
        t.availability && Object.values(t.availability).some(h => h.length > 0)
    ).length;
    
    updateCheckStatus('availability',
        availableTeachers > 0,
        `${availableTeachers}/${teachers.length} مدرس لديهم توفر`,
        'لا يوجد مدرسين لديهم أوقات متاحة',
        availableTeachers !== teachers.length
    );

    const needsLab = teachers.filter(t => t.requiresLab).length;
    const labRooms = rooms.filter(r => r.type && r.type !== 'room').length;
    updateCheckStatus('labs',
        needsLab === 0 || labRooms > 0,
        needsLab === 0 ? 'لا توجد مواد تحتاج معامل' : `${labRooms} معمل متاح`,
        `${needsLab} مادة تحتاج معامل ولكن لا توجد معامل مسجلة`,
        needsLab > 0 && labRooms < needsLab
    );
}

function updateCheckStatus(type, isReady, readyText, notReadyText, isWarning = false) {
    const element = document.querySelector(`[data-check="${type}"]`);
    if (!element) return;

    const statusElement = element.querySelector('.check-status');
    if (!statusElement) return;

    statusElement.textContent = isReady ? readyText : notReadyText;
    statusElement.className = 'check-status ' + (
        isReady ? (isWarning ? 'warning' : 'success') : 'error'
    );
    
    const icon = element.querySelector('.check-icon');
    if (icon) {
        icon.textContent = isReady ? (isWarning ? '⚠️' : '✓') : '✗';
    }
}

let generationInProgress = false;
let generationWorker = null;

function startGeneration() {
    if (generationInProgress) return;
    
    if (!validateGenerationInputs()) {
        return;
    }

    showProgressUI();
    generationInProgress = true;
    
    const options = getGenerationOptions();
    generateSchedule(options);
}

function stopGeneration() {
    if (!generationInProgress) return;
    
    generationInProgress = false;
    if (generationWorker) {
        clearInterval(generationWorker);
        generationWorker = null;
    }
    
    document.getElementById('stopBtn').classList.add('hidden');
    document.getElementById('generateBtn').classList.remove('hidden');
    SharedData.showToast('تم إيقاف عملية التوليد', 'info');
}

function getGenerationOptions() {
    const deptFilter = document.getElementById('deptFilter').value;
    const algorithmType = document.getElementById('algorithmType').value;
    const maxTime = parseInt(document.getElementById('maxTime').value) || 30;
    
    return {
        deptFilter,
        algorithm: algorithmType,
        maxTime,
        balanceLoad: document.getElementById('balanceLoad').checked,
        minimizeGaps: document.getElementById('minimizeGaps').checked,
        prioritizeLabs: document.getElementById('prioritizeLabs').checked
    };
}

function validateGenerationInputs() {
    const teachers = SharedData.teachers || [];
    const rooms = SharedData.rooms || [];
    
    if (teachers.length === 0) {
        SharedData.showToast('يجب إضافة مدرسين أولاً', 'error');
        return false;
    }
    
    if (rooms.length === 0) {
        SharedData.showToast('يجب إضافة قاعات أولاً', 'error');
        return false;
    }
    
    const availableTeachers = teachers.filter(t => 
        t.availability && Object.values(t.availability).some(h => h.length > 0)
    );
    
    if (availableTeachers.length === 0) {
        SharedData.showToast('لا يوجد مدرسين لديهم أوقات متاحة', 'error');
        return false;
    }
    
    return true;
}

function showProgressUI() {
    document.getElementById('progressContainer').classList.remove('hidden');
    document.getElementById('resultsContainer').classList.add('hidden');
    document.getElementById('timetableViews').classList.add('hidden');
    
    document.getElementById('generateBtn').classList.add('hidden');
    document.getElementById('stopBtn').classList.remove('hidden');
    
    resetProgressStats();
}

function resetProgressStats() {
    document.getElementById('progressPercent').textContent = '0%';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('elapsedTime').textContent = '0 ثانية';
    document.getElementById('attemptCount').textContent = '0';
    document.getElementById('bestScore').textContent = '0%';
    document.getElementById('scheduledLessons').textContent = '0';
    document.getElementById('conflictsCount').textContent = '0';
}

function showResultsUI(results) {
    document.getElementById('progressContainer').classList.add('hidden');
    document.getElementById('resultsContainer').classList.remove('hidden');
    
    document.getElementById('generateBtn').classList.remove('hidden');
    document.getElementById('stopBtn').classList.add('hidden');
    
    document.getElementById('finalScore').textContent = `${results.score}%`;
    document.getElementById('finalScheduled').textContent = results.scheduled;
    document.getElementById('finalUnscheduled').textContent = results.unscheduled;
    document.getElementById('finalTime').textContent = `${results.time} ثانية`;
    
    const scoreElement = document.getElementById('finalScore');
    scoreElement.className = 'score-badge ' + (
        results.score > 90 ? 'excellent' :
        results.score > 75 ? 'good' :
        results.score > 50 ? 'fair' : 'poor'
    );
    
    renderTimetables();
}

function resetUI() {
    document.getElementById('progressContainer').classList.add('hidden');
    document.getElementById('resultsContainer').classList.add('hidden');
    document.getElementById('timetableViews').classList.add('hidden');
    
    document.getElementById('generateBtn').classList.remove('hidden');
    document.getElementById('stopBtn').classList.add('hidden');
}

function renderTimetables() {
    if (!SharedData.schedule || SharedData.schedule.length === 0) {
        SharedData.showToast('لا يوجد جدول لعرضه', 'warning');
        return;
    }

    const timetableContainer = document.getElementById('timetableViews');
    if (!timetableContainer) return;

    timetableContainer.innerHTML = '';
    timetableContainer.classList.remove('hidden');

    const tabs = document.createElement('div');
    tabs.className = 'timetable-tabs';
    tabs.innerHTML = `
        <button class="timetable-tab active" data-view="daily">عرض يومي</button>
        <button class="timetable-tab" data-view="weekly">عرض أسبوعي</button>
        <button class="timetable-tab" data-view="teachers">حسب المدرسين</button>
        <button class="timetable-tab" data-view="rooms">حسب القاعات</button>
    `;
    timetableContainer.appendChild(tabs);

    const tabContent = document.createElement('div');
    tabContent.className = 'timetable-tab-content';
    
    const dailyView = document.createElement('div');
    dailyView.className = 'timetable-view active';
    dailyView.id = 'daily-view';
    dailyView.appendChild(createDailyTimetable());
    tabContent.appendChild(dailyView);

    const weeklyView = document.createElement('div');
    weeklyView.className = 'timetable-view';
    weeklyView.id = 'weekly-view';
    weeklyView.appendChild(createWeeklyTimetable());
    tabContent.appendChild(weeklyView);

    const teachersView = document.createElement('div');
    teachersView.className = 'timetable-view';
    teachersView.id = 'teachers-view';
    teachersView.appendChild(createTeachersTimetable());
    tabContent.appendChild(teachersView);

    const roomsView = document.createElement('div');
    roomsView.className = 'timetable-view';
    roomsView.id = 'rooms-view';
    roomsView.appendChild(createRoomsTimetable());
    tabContent.appendChild(roomsView);

    timetableContainer.appendChild(tabContent);

    tabs.querySelectorAll('.timetable-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.querySelectorAll('.timetable-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            tabContent.querySelectorAll('.timetable-view').forEach(view => {
                view.classList.remove('active');
            });
            document.getElementById(`${tab.dataset.view}-view`).classList.add('active');
        });
    });
}

function createDailyTimetable() {
    const days = SharedData.getDays();
    const { startHour, endHour } = SharedData.getHoursRange();
    const timetable = document.createElement('div');
    timetable.className = 'daily-timetable';
    
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
                    <th>النوع</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        const dayLessons = SharedData.schedule.filter(l => l.day === day)
            .sort((a, b) => a.hour - b.hour);
            
        dayLessons.forEach(lesson => {
            const teacher = SharedData.getTeacherById(lesson.teacherId);
            const room = SharedData.getRoomById(lesson.roomId);
            const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
            const courseType = course?.type || '';
            const typeName = courseType === 'required' ? 'إجبارية' : 
                            courseType === 'general' ? 'عامة' : 'اختيارية';
            
            table.querySelector('tbody').innerHTML += `
                <tr>
                    <td>${SharedData.formatHourToAMPM(lesson.hour)}</td>
                    <td>${course?.name || lesson.subject || 'غير معروف'}</td>
                    <td>${teacher?.name || 'غير معروف'}</td>
                    <td>${room?.name || 'غير معروف'}</td>
                    <td>${lesson.duration} ساعة</td>
                    <td>${typeName}</td>
                </tr>
            `;
        });
        
        daySection.appendChild(table);
        timetable.appendChild(daySection);
    });
    
    return timetable;
}

function createWeeklyTimetable() {
    const days = SharedData.getDays();
    const { startHour, endHour } = SharedData.getHoursRange();
    const timetable = document.createElement('div');
    timetable.className = 'weekly-timetable';
    
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
    
    for (let hour = startHour; hour < endHour; hour++) {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${SharedData.formatHourToAMPM(hour)}</td>`;
        
        days.forEach(day => {
            const lessons = SharedData.schedule.filter(l => 
                l.day === day && hour >= l.hour && hour < l.hour + l.duration
            );
            
            if (lessons.length > 0) {
                const lesson = lessons[0];
                // Only create cell if this is the starting hour
                if (hour === lesson.hour) {
                    const cell = document.createElement('td');
                    const teacher = SharedData.getTeacherById(lesson.teacherId);
                    const room = SharedData.getRoomById(lesson.roomId);
                    const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
                    const courseType = course?.type || '';
                    const typeClass = courseType === 'required' ? 'required-course' : 
                                    courseType === 'general' ? 'general-course' : 'elective-course';
                    
                    cell.innerHTML = `
                        <div class="lesson-cell ${typeClass}">
                            <div class="subject">${course?.name || lesson.subject || 'غير معروف'}</div>
                            <div class="teacher">${teacher?.name || 'غير معروف'}</div>
                            <div class="room">${room?.name || 'غير معروف'}</div>
                            ${lesson.duration > 1 ? `<div class="duration">${lesson.duration} ساعات</div>` : ''}
                        </div>
                    `;
                    
                    if (lesson.duration > 1) {
                        cell.rowSpan = lesson.duration;
                        cell.classList.add('multi-hour-cell');
                    }
                    
                    row.appendChild(cell);
                }
            } else {
                // Empty cell
                const cell = document.createElement('td');
                row.appendChild(cell);
            }
        });
        
        table.querySelector('tbody').appendChild(row);
    }
    
    timetable.appendChild(table);
    return timetable;
}

function createTeachersTimetable() {
    const teachers = [...new Set(SharedData.schedule.map(l => l.teacherId))]
        .map(id => SharedData.getTeacherById(id))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
    
    const timetable = document.createElement('div');
    timetable.className = 'teachers-timetable';
    
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
                    <th>النوع</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        const teacherLessons = SharedData.schedule.filter(l => l.teacherId === teacher.id)
            .sort((a, b) => a.day.localeCompare(b.day) || a.hour - b.hour);
            
        teacherLessons.forEach(lesson => {
            const room = SharedData.getRoomById(lesson.roomId);
            const course = SharedData.getCourseById(teacher.courseId);
            const courseType = course?.type || '';
            const typeName = courseType === 'required' ? 'إجبارية' : 
                            courseType === 'general' ? 'عامة' : 'اختيارية';
            
            table.querySelector('tbody').innerHTML += `
                <tr>
                    <td>${lesson.day}</td>
                    <td>${SharedData.formatHourToAMPM(lesson.hour)}</td>
                    <td>${course?.name || lesson.subject || 'غير معروف'}</td>
                    <td>${room?.name || 'غير معروف'}</td>
                    <td>${lesson.duration} ساعة</td>
                    <td>${typeName}</td>
                </tr>
            `;
        });
        
        teacherSection.appendChild(table);
        timetable.appendChild(teacherSection);
    });
    
    return timetable;
}

function createRoomsTimetable() {
    const rooms = [...new Set(SharedData.schedule.map(l => l.roomId))]
        .map(id => SharedData.getRoomById(id))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
    
    const timetable = document.createElement('div');
    timetable.className = 'rooms-timetable';
    
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
                    <th>النوع</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        const roomLessons = SharedData.schedule.filter(l => l.roomId === room.id)
            .sort((a, b) => a.day.localeCompare(b.day) || a.hour - b.hour);
            
        roomLessons.forEach(lesson => {
            const teacher = SharedData.getTeacherById(lesson.teacherId);
            const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
            const courseType = course?.type || '';
            const typeName = courseType === 'required' ? 'إجبارية' : 
                            courseType === 'general' ? 'عامة' : 'اختيارية';
            
            table.querySelector('tbody').innerHTML += `
                <tr>
                    <td>${lesson.day}</td>
                    <td>${SharedData.formatHourToAMPM(lesson.hour)}</td>
                    <td>${course?.name || lesson.subject || 'غير معروف'}</td>
                    <td>${teacher?.name || 'غير معروف'}</td>
                    <td>${lesson.duration} ساعة</td>
                    <td>${typeName}</td>
                </tr>
            `;
        });
        
        roomSection.appendChild(table);
        timetable.appendChild(roomSection);
    });
    
    return timetable;
}

function generateSchedule(options) {
    console.clear();
    console.group("=== Starting Schedule Generation ===");
    console.log("Generation Options:", options);
    
    const startTime = Date.now();
    let bestSchedule = null;
    let bestScore = 0;
    let attempts = 0;
    
    const teachers = options.deptFilter 
        ? SharedData.teachers.filter(t => t.department === options.deptFilter)
        : SharedData.teachers;
    
    const rooms = options.deptFilter
        ? SharedData.rooms.filter(r => !r.department || r.department === options.deptFilter)
        : SharedData.rooms;

    console.log(`Processing ${teachers.length} teachers and ${rooms.length} rooms`);
    
    // Sort teachers - priority courses first, then by availability
    const sortedTeachers = [...teachers].sort((a, b) => {
        const aCourse = SharedData.getCourseById(a.courseId);
        const bCourse = SharedData.getCourseById(b.courseId);
        const aIsPriority = aCourse && (aCourse.type === 'required' || aCourse.type === 'general');
        const bIsPriority = bCourse && (bCourse.type === 'required' || bCourse.type === 'general');
        
        // Priority courses first
        if (aIsPriority !== bIsPriority) return bIsPriority - aIsPriority;
        
        // Then by availability
        const aSlots = calculateAvailableSlots(a);
        const bSlots = calculateAvailableSlots(b);
        if (aSlots !== bSlots) return aSlots - bSlots;
        
        return (b.duration || 1) - (a.duration || 1);
    });
    
    if (options.prioritizeLabs) {
        sortedTeachers.sort((a, b) => (b.requiresLab ? 1 : 0) - (a.requiresLab ? 1 : 0));
    }
    
    console.group("Teacher Priority List:");
    sortedTeachers.forEach(teacher => {
        const course = SharedData.getCourseById(teacher.courseId);
        const priority = course && (course.type === 'required' || course.type === 'general') ? 'PRIORITY' : 'normal';
        console.log(`${priority} ${teacher.name}: ${course?.name || 'No Course'} (${teacher.requiredLessons || 2} lessons, ${teacher.lessonDuration || 1}hr each, ${calculateAvailableSlots(teacher)} slots)`);
    });
    console.groupEnd();
    
    let maxAttempts, timePerAttempt;
    switch (options.algorithm) {
        case 'fast':
            maxAttempts = 10;
            timePerAttempt = 100;
            break;
        case 'thorough':
            maxAttempts = 500;
            timePerAttempt = 50;
            break;
        case 'optimized':
        default:
            maxAttempts = 100;
            timePerAttempt = 100;
    }
    
    generationWorker = setInterval(() => {
        if (!generationInProgress) {
            clearInterval(generationWorker);
            return;
        }
        
        attempts++;
        const currentAttempt = attempts;
        
        const { schedule, conflicts } = generateScheduleAttempt(
            sortedTeachers, 
            rooms, 
            options
        );
        
        const score = calculateScheduleScore(
            schedule, 
            teachers, 
            conflicts,
            options
        );
        
        console.group(`Attempt #${currentAttempt}`);
        console.log(`Score: ${score}%`);
        console.log(`Scheduled Lessons: ${schedule.length}`);
        console.log(`Conflicts: ${conflicts}`);
        
        if (score > bestScore || bestSchedule === null) {
            bestScore = score;
            bestSchedule = schedule;
            
            console.log("🔥 New best schedule found!");
            logScheduleDetails(schedule);
            
            if (score > 70) {
                SharedData.schedule = schedule;
                SharedData.lastScheduleGeneration = new Date().toISOString();
                SharedData.saveToLocalStorage();
            }
        }
        
        console.groupEnd();
        
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const progress = Math.min(100, Math.floor((attempts / maxAttempts) * 100));
        
        document.getElementById('progressPercent').textContent = `${progress}%`;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('elapsedTime').textContent = `${elapsed} ثانية`;
        document.getElementById('attemptCount').textContent = currentAttempt;
        document.getElementById('bestScore').textContent = `${bestScore}%`;
        document.getElementById('scheduledLessons').textContent = schedule.length;
        document.getElementById('conflictsCount').textContent = conflicts;
        
        if (attempts >= maxAttempts || elapsed >= options.maxTime) {
            stopGeneration();
            console.group("=== Final Schedule ===");
            console.log(`Best Score: ${bestScore}%`);
            console.log(`Total Attempts: ${attempts}`);
            console.log(`Time Elapsed: ${elapsed} seconds`);
            logScheduleDetails(bestSchedule);
            console.groupEnd();
            
            showResultsUI({
                score: bestScore,
                scheduled: bestSchedule.length,
                unscheduled: calculateUnscheduledLessons(bestSchedule, teachers),
                time: elapsed
            });
        }
    }, timePerAttempt);
}

function generateScheduleAttempt(teachers, rooms, options) {
    const days = SharedData.getDays();
    const { startHour, endHour } = SharedData.getHoursRange();
    const schedule = [];
    let conflicts = 0;
    
    const teacherAssignments = {};
    const roomAssignments = {};
    const teacherDailySubjects = {};
    const prioritySlots = {}; // Track slots reserved for priority courses
    
    // Initialize priority slots tracking
    days.forEach(day => {
        prioritySlots[day] = Array(endHour - startHour).fill(false);
    });
    
    // Initialize teacher assignments
    teachers.forEach(teacher => {
        const course = SharedData.getCourseById(teacher.courseId);
        teacherAssignments[teacher.id] = {
            assigned: 0,
            required: teacher.lessons || 2,
            daysUsed: {},
            duration: teacher.duration || 1,
            subject: course?.name || teacher.subject || 'مادة',
            isPriority: course && (course.type === 'required' || course.type === 'general')
        };
        
        teacherDailySubjects[teacher.id] = {};
        days.forEach(day => {
            teacherDailySubjects[teacher.id][day] = new Set();
        });
    });
    
    // Initialize room assignments
    rooms.forEach(room => {
        roomAssignments[room.id] = {};
        days.forEach(day => {
            roomAssignments[room.id][day] = Array(endHour - startHour).fill(null);
        });
    });
    
    // Schedule each teacher's lessons
    for (const teacher of teachers) {
        const teacherData = teacherAssignments[teacher.id];
        const lessonsToSchedule = teacherData.required;
        const duration = teacherData.duration;
        const subject = teacherData.subject;
        const isPriority = teacherData.isPriority;
        
        for (let i = 0; i < lessonsToSchedule; i++) {
            const slot = findOptimalSlot(
                teacher, 
                days, 
                startHour, 
                endHour, 
                teacherAssignments, 
                roomAssignments, 
                rooms, 
                options,
                duration,
                teacherDailySubjects,
                prioritySlots,
                isPriority
            );
            
            if (slot) {
                const lesson = {
                    id: SharedData.generateId(),
                    teacherId: teacher.id,
                    subject: subject,
                    day: slot.day,
                    hour: slot.hour,
                    duration: duration,
                    roomId: slot.roomId,
                    department: teacher.department,
                    yearId: teacher.yearId,
                    groupId: teacher.groupId,
                    requiresLab: teacher.requiresLab || false,
                    createdAt: new Date().toISOString(),
                    isPriority: isPriority
                };
                
                schedule.push(lesson);
                
                // Block the room and time slots
                for (let h = 0; h < duration; h++) {
                    const slotHour = slot.hour + h;
                    if (slotHour < endHour) {
                        const slotIndex = slotHour - startHour;
                        roomAssignments[lesson.roomId][lesson.day][slotIndex] = lesson.id;
                        if (isPriority) {
                            prioritySlots[lesson.day][slotIndex] = true;
                        }
                    }
                }
                
                teacherData.assigned++;
                teacherData.daysUsed[slot.day] = (teacherData.daysUsed[slot.day] || 0) + 1;
                teacherDailySubjects[teacher.id][slot.day].add(subject);
            } else {
                conflicts++;
            }
        }
    }
    
    return { schedule, conflicts };
}

function findOptimalSlot(teacher, days, startHour, endHour, teacherAssignments, roomAssignments, rooms, options, duration, teacherDailySubjects, prioritySlots, isPriority) {
    const availability = teacher.availability || {};
    const possibleSlots = [];
    const subject = teacherAssignments[teacher.id].subject;
    
    days.forEach(day => {
        if (teacherDailySubjects[teacher.id][day].has(subject)) {
            return;
        }
        
        if (!availability[day] || availability[day].length === 0) return;
        
        if (options.minimizeGaps && teacherAssignments[teacher.id]?.daysUsed?.[day] === 0) {
            return;
        }
        
        availability[day].forEach(hour => {
            if (hour + duration > endHour) return;
            
            // Check if any slot is already reserved for priority courses
            if (isPriority) {
                let slotAvailable = true;
                for (let h = 0; h < duration; h++) {
                    const slotHour = hour + h;
                    if (slotHour >= endHour) {
                        slotAvailable = false;
                        break;
                    }
                    const slotIndex = slotHour - startHour;
                    if (prioritySlots[day][slotIndex]) {
                        slotAvailable = false;
                        break;
                    }
                }
                if (!slotAvailable) return;
            }
            
            let allHoursAvailable = true;
            for (let h = 0; h < duration; h++) {
                const checkHour = hour + h;
                const availableRooms = findAvailableRooms(
                    rooms, 
                    roomAssignments, 
                    day, 
                    checkHour, 
                    1,
                    teacher.requiresLab,
                    startHour,
                    endHour,
                    teacher.id
                );
                
                if (availableRooms.length === 0) {
                    allHoursAvailable = false;
                    break;
                }
            }
            
            if (allHoursAvailable) {
                const availableRooms = findAvailableRooms(
                    rooms, 
                    roomAssignments, 
                    day, 
                    hour, 
                    duration, 
                    teacher.requiresLab,
                    startHour,
                    endHour,
                    teacher.id
                );
                
                if (availableRooms.length > 0) {
                    possibleSlots.push({
                        day,
                        hour,
                        availableRooms,
                        teacherDayUsage: teacherAssignments[teacher.id]?.daysUsed?.[day] || 0,
                        roomUsageScore: calculateRoomUsageScore(availableRooms, roomAssignments)
                    });
                }
            }
        });
    });
    
    if (possibleSlots.length === 0) return null;
    
    possibleSlots.sort((a, b) => {
        if (options.minimizeGaps && a.teacherDayUsage !== b.teacherDayUsage) {
            return b.teacherDayUsage - a.teacherDayUsage;
        }
        
        return a.hour - b.hour;
    });
    
    return {
        day: possibleSlots[0].day,
        hour: possibleSlots[0].hour,
        roomId: selectBestRoom(possibleSlots[0].availableRooms, roomAssignments, options.balanceLoad)
    };
}

function findAvailableRooms(rooms, roomAssignments, day, hour, duration, needsLab, startHour, endHour, teacherId) {
    const teacher = SharedData.getTeacherById(teacherId);
    const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
    const isPriorityCourse = course && (course.type === 'required' || course.type === 'general');
    
    return rooms.filter(room => {
        // Skip if room doesn't meet lab requirements
        if (needsLab && (!room.type || room.type === 'room')) return false;
        
        // Check all time slots for this lesson
        for (let h = 0; h < duration; h++) {
            const slotHour = hour + h;
            if (slotHour >= endHour) return false;
            
            const slotIndex = slotHour - startHour;
            const existingLessonId = roomAssignments[room.id][day][slotIndex];
            
            if (existingLessonId !== null) {
                // If this is a priority course, it needs exclusive slot
                if (isPriorityCourse) return false;
                
                // Check if existing lesson is a priority course
                const existingLesson = SharedData.schedule.find(l => l.id === existingLessonId);
                if (existingLesson && existingLesson.isPriority) {
                    return false;
                }
            }
        }
        return true;
    });
}

function calculateRoomUsageScore(rooms, roomAssignments) {
    return Math.min(...rooms.map(room => 
        Object.values(roomAssignments[room.id])
            .flat()
            .filter(slot => slot !== null)
            .length
    ));
}

function selectBestRoom(rooms, roomAssignments, balanceLoad) {
    if (!balanceLoad || rooms.length === 1) {
        return rooms[0].id;
    }

    return rooms.sort((a, b) => 
        Object.values(roomAssignments[a.id]).flat().filter(s => s !== null).length - 
        Object.values(roomAssignments[b.id]).flat().filter(s => s !== null).length
    )[0].id;
}

function calculateAvailableSlots(teacher) {
    const days = SharedData.getDays();
    const { startHour, endHour } = SharedData.getHoursRange();
    const availability = teacher.availability || {};
    let count = 0;
    const duration = teacher.duration || 1;
    
    days.forEach(day => {
        if (!availability[day] || availability[day].length === 0) return;
        
        availability[day].forEach(hour => {
            if (hour + duration <= endHour) {
                count++;
            }
        });
    });
    
    return count;
}

function calculateScheduleScore(schedule, teachers, conflicts, options) {
    if (!schedule?.length) return 0;

    const totalRequired = teachers.reduce((sum, t) => sum + (t.requiredLessons || 2), 0);
    let score = (schedule.length / totalRequired) * 70;
    
    score -= conflicts * 2;
    
    if (options.balanceLoad) {
        const teacherLoads = {};
        teachers.forEach(t => {
            teacherLoads[t.id] = {
                required: t.requiredLessons || 2,
                assigned: 0
            };
        });
        
        schedule.forEach(lesson => {
            if (teacherLoads[lesson.teacherId]) {
                teacherLoads[lesson.teacherId].assigned++;
            }
        });
        
        const loadRatios = Object.values(teacherLoads)
            .map(t => t.required > 0 ? t.assigned / t.required : 1);
        
        const variance = calculateVariance(loadRatios);
        score += 30 * (1 - Math.min(1, variance));
    }
    
    // Bonus for scheduling priority courses
    const priorityCoursesScheduled = schedule.filter(l => l.isPriority).length;
    const totalPriorityCourses = teachers.filter(t => {
        const course = SharedData.getCourseById(t.courseId);
        return course && (course.type === 'required' || course.type === 'general');
    }).reduce((sum, t) => sum + (t.requiredLessons || 2), 0);
    
    if (totalPriorityCourses > 0) {
        const priorityRatio = priorityCoursesScheduled / totalPriorityCourses;
        score += 10 * priorityRatio; // Add up to 10% bonus for scheduling priority courses
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    return numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
}

function calculateUnscheduledLessons(schedule, teachers) {
    if (!schedule) return teachers.reduce((sum, t) => sum + (t.requiredLessons || 2), 0);

    const scheduledCounts = teachers.reduce((acc, t) => {
        acc[t.id] = 0;
        return acc;
    }, {});

    schedule.forEach(lesson => {
        scheduledCounts[lesson.teacherId]++;
    });

    return teachers.reduce((sum, t) => {
        return sum + Math.max(0, (t.requiredLessons || 2) - scheduledCounts[t.id]);
    }, 0);
}

function exportSchedule() {
    if (!SharedData.schedule?.length) {
        SharedData.showToast('لا يوجد جدول لتصديره', 'warning');
        return;
    }

    const exportData = {
        schedule: SharedData.schedule,
        generatedAt: new Date().toISOString(),
        stats: {
            totalLessons: SharedData.schedule.length,
            totalTeachers: new Set(SharedData.schedule.map(l => l.teacherId)).size,
            totalRooms: new Set(SharedData.schedule.map(l => l.roomId)).size
        }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `الجدول_الدراسي_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

function logScheduleDetails(schedule) {
    if (!schedule || schedule.length === 0) {
        console.log("No lessons scheduled");
        return;
    }
    
    console.group("Schedule Details");
    
    const days = SharedData.getDays();
    days.forEach(day => {
        const dayLessons = schedule.filter(l => l.day === day);
        if (dayLessons.length === 0) return;
        
        console.groupCollapsed(`${day} (${dayLessons.length} lessons)`);
        
        dayLessons.sort((a, b) => a.hour - b.hour);
        
        dayLessons.forEach(lesson => {
            const teacher = SharedData.getTeacherById(lesson.teacherId);
            const room = SharedData.getRoomById(lesson.roomId);
            const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
            const priority = lesson.isPriority ? 'PRIORITY' : 'normal';
            console.log(
                `${priority} ${lesson.hour}:00 - ${lesson.hour + lesson.duration}:00 | ` +
                `Subject: ${course?.name || lesson.subject || 'N/A'} | ` +
                `Teacher: ${teacher?.name || 'Unknown'} | ` +
                `Room: ${room?.name || 'Unknown'} | ` +
                `Duration: ${lesson.duration}hr`
            );
        });
        
        console.groupEnd();
    });
    
    console.group("Teacher Workload");
    const teacherStats = {};
    schedule.forEach(lesson => {
        teacherStats[lesson.teacherId] = (teacherStats[lesson.teacherId] || 0) + 1;
    });
    
    Object.entries(teacherStats).forEach(([teacherId, count]) => {
        const teacher = SharedData.getTeacherById(teacherId);
        const required = teacher?.requiredLessons || 2;
        console.log(
            `${teacher?.name || 'Unknown'}: ${count}/${required} ` +
            `(${Math.round((count/required)*100)}%)`
        );
    });
    console.groupEnd();
    
    console.group("Room Utilization");
    const roomStats = {};
    schedule.forEach(lesson => {
        roomStats[lesson.roomId] = (roomStats[lesson.roomId] || 0) + lesson.duration;
    });
    
    Object.entries(roomStats).forEach(([roomId, hours]) => {
        const room = SharedData.getRoomById(roomId);
        console.log(`${room?.name || 'Unknown'}: ${hours} hours`);
    });
    console.groupEnd();
    
    console.group("Priority Courses");
    const priorityLessons = schedule.filter(l => l.isPriority);
    console.log(`Scheduled ${priorityLessons.length} priority lessons`);
    priorityLessons.forEach(lesson => {
        const teacher = SharedData.getTeacherById(lesson.teacherId);
        const room = SharedData.getRoomById(lesson.roomId);
        const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
        console.log(
            `${lesson.day} ${lesson.hour}:00 - ${lesson.hour + lesson.duration}:00 | ` +
            `Subject: ${course?.name || lesson.subject || 'N/A'} | ` +
            `Room: ${room?.name || 'Unknown'}`
        );
    });
    console.groupEnd();
    
    console.groupEnd();
}