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
    
    // Create timetable container if it doesn't exist
    const container = document.querySelector('.container');
    if (!document.getElementById('timetableContainer')) {
        const timetableDiv = document.createElement('div');
        timetableDiv.id = 'timetableContainer';
        timetableDiv.className = 'timetable-container hidden';
        container.appendChild(timetableDiv);
    }
}

function setupEventListeners() {
    document.getElementById('generateBtn')?.addEventListener('click', startGeneration);
    document.getElementById('stopBtn')?.addEventListener('click', stopGeneration);
    document.getElementById('viewScheduleBtn')?.addEventListener('click', renderTimetable);
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

    // Teachers check
    updateCheckStatus('teachers', 
        teachers.length > 0,
        `تم العثور على ${teachers.length} مدرس`,
        'لا يوجد مدرسين مسجلين'
    );

    // Rooms check
    updateCheckStatus('rooms',
        rooms.length > 0,
        `تم العثور على ${rooms.length} مكان`,
        'لا يوجد أماكن مسجلة'
    );

    // Availability check
    const availableTeachers = teachers.filter(t => 
        t.availability && Object.values(t.availability).some(h => h.length > 0)
    ).length;
    
    updateCheckStatus('availability',
        availableTeachers > 0,
        `${availableTeachers}/${teachers.length} مدرس لديهم توفر`,
        'لا يوجد مدرسين لديهم أوقات متاحة',
        availableTeachers !== teachers.length
    );

    // Labs check
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
    document.getElementById('timetableContainer').classList.add('hidden');
    
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
    
    // Update results
    document.getElementById('finalScore').textContent = `${results.score}%`;
    document.getElementById('finalScheduled').textContent = results.scheduled;
    document.getElementById('finalUnscheduled').textContent = results.unscheduled;
    document.getElementById('finalTime').textContent = `${results.time} ثانية`;
    
    // Color code the score
    const scoreElement = document.getElementById('finalScore');
    scoreElement.className = 'score-badge ' + (
        results.score > 90 ? 'excellent' :
        results.score > 75 ? 'good' :
        results.score > 50 ? 'fair' : 'poor'
    );
    
    // Render the timetable
    renderTimetable();
}

function resetUI() {
    document.getElementById('progressContainer').classList.add('hidden');
    document.getElementById('resultsContainer').classList.add('hidden');
    document.getElementById('timetableContainer').classList.add('hidden');
    
    document.getElementById('generateBtn').classList.remove('hidden');
    document.getElementById('stopBtn').classList.add('hidden');
}

function renderTimetable() {
    if (!SharedData.schedule || SharedData.schedule.length === 0) {
        SharedData.showToast('لا يوجد جدول لعرضه', 'warning');
        return;
    }

    const timetableContainer = document.getElementById('timetableContainer');
    if (!timetableContainer) return;

    // Clear previous timetable
    timetableContainer.innerHTML = '';
    timetableContainer.classList.remove('hidden');

    // Create tabs for each department
    const departments = getDepartmentsFromSchedule();
    
    if (departments.length === 0) {
        SharedData.showToast('لا يوجد بيانات لعرضها', 'info');
        return;
    }

    // Create tab navigation
    const tabNav = document.createElement('div');
    tabNav.className = 'timetable-tabs';
    
    departments.forEach((dept, index) => {
        const tab = document.createElement('button');
        tab.className = `timetable-tab ${index === 0 ? 'active' : ''}`;
        tab.textContent = dept.name;
        tab.dataset.deptId = dept.id;
        tab.addEventListener('click', () => switchTimetableTab(dept.id));
        tabNav.appendChild(tab);
    });
    
    timetableContainer.appendChild(tabNav);

    // Create tab content
    const tabContent = document.createElement('div');
    tabContent.className = 'timetable-tab-content';
    
    departments.forEach((dept, index) => {
        const tabPane = document.createElement('div');
        tabPane.className = `timetable-pane ${index === 0 ? 'active' : ''}`;
        tabPane.id = `timetable-${dept.id}`;
        
        // Create timetable for this department
        const timetable = createDepartmentTimetable(dept.id);
        tabPane.appendChild(timetable);
        
        tabContent.appendChild(tabPane);
    });
    
    timetableContainer.appendChild(tabContent);
}

function switchTimetableTab(deptId) {
    // Update active tab
    document.querySelectorAll('.timetable-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.deptId === deptId);
    });
    
    // Update active pane
    document.querySelectorAll('.timetable-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `timetable-${deptId}`);
    });
}

function getDepartmentsFromSchedule() {
    const deptIds = [...new Set(SharedData.schedule.map(lesson => lesson.department))];
    return deptIds.map(id => SharedData.getDepartmentById(id)).filter(Boolean);
}

function createDepartmentTimetable(deptId) {
    const timetable = document.createElement('div');
    timetable.className = 'fet-style-timetable';
    
    // Filter schedule for this department
    const deptSchedule = SharedData.schedule.filter(lesson => lesson.department === deptId);
    if (deptSchedule.length === 0) return timetable;
    
    const days = SharedData.getDays();
    const { startHour, endHour } = SharedData.getHoursRange();
    
    // Create table
    const table = document.createElement('table');
    
    // Create header row
    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th')); // Empty corner cell
    
    // Add day headers
    days.forEach(day => {
        const th = document.createElement('th');
        th.textContent = day;
        headerRow.appendChild(th);
    });
    
    table.appendChild(headerRow);
    
    // Create time slots rows
    for (let hour = startHour; hour < endHour; hour++) {
        const row = document.createElement('tr');
        
        // Add time cell
        const timeCell = document.createElement('td');
        timeCell.className = 'time-cell';
        timeCell.textContent = SharedData.formatHourToAMPM(hour);
        row.appendChild(timeCell);
        
        // Add day cells
        days.forEach(day => {
            const cell = document.createElement('td');
            
            // Find lessons for this day and hour
            const lessons = deptSchedule.filter(lesson => 
                lesson.day === day && 
                lesson.hour <= hour && 
                hour < lesson.hour + lesson.duration
            );
            
            if (lessons.length > 0) {
                const lesson = lessons[0]; // Only show first lesson if multiple (shouldn't happen)
                const lessonDiv = createLessonDiv(lesson);
                cell.appendChild(lessonDiv);
                
                // Add rowspan if this is a multi-hour lesson
                if (lesson.hour === hour && lesson.duration > 1) {
                    cell.rowSpan = lesson.duration;
                } else if (lesson.hour !== hour) {
                    // This cell is part of a multi-hour lesson, skip it
                    return;
                }
            }
            
            row.appendChild(cell);
        });
        
        table.appendChild(row);
    }
    
    timetable.appendChild(table);
    return timetable;
}

function createLessonDiv(lesson) {
    const lessonDiv = document.createElement('div');
    lessonDiv.className = 'timetable-lesson';
    
    const teacher = SharedData.getTeacherById(lesson.teacherId);
    const room = SharedData.getRoomById(lesson.roomId);
    const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
    
    // Add subject - use course name if available, otherwise fall back to lesson.subject
    const subjectName = course?.name || lesson.subject || 'مادة';
    const subjectDiv = document.createElement('div');
    subjectDiv.className = 'lesson-subject';
    subjectDiv.textContent = subjectName;
    
    // Add course code if available
    if (course?.code) {
        const codeSpan = document.createElement('span');
        codeSpan.className = 'lesson-code';
        codeSpan.textContent = ` (${course.code})`;
        subjectDiv.appendChild(codeSpan);
    }
    
    lessonDiv.appendChild(subjectDiv);
    
    // Add teacher
    if (teacher) {
        const teacherDiv = document.createElement('div');
        teacherDiv.className = 'lesson-teacher';
        teacherDiv.textContent = teacher.name;
        lessonDiv.appendChild(teacherDiv);
    }
    
    // Add room
    if (room) {
        const roomDiv = document.createElement('div');
        roomDiv.className = 'lesson-room';
        roomDiv.textContent = room.name;
        lessonDiv.appendChild(roomDiv);
    }
    
    // Add duration if more than 1 hour
    if (lesson.duration > 1) {
        const durationDiv = document.createElement('div');
        durationDiv.className = 'lesson-duration';
        durationDiv.textContent = `${lesson.duration} ساعات`;
        lessonDiv.appendChild(durationDiv);
    }
    
    return lessonDiv;
}

function generateSchedule(options) {
    console.clear();
    console.group("=== Starting Schedule Generation ===");
    console.log("Generation Options:", options);
    
    const startTime = Date.now();
    let bestSchedule = null;
    let bestScore = 0;
    let attempts = 0;
    
    // Filter data based on department
    const teachers = options.deptFilter 
        ? SharedData.teachers.filter(t => t.department === options.deptFilter)
        : SharedData.teachers;
    
    const rooms = options.deptFilter
        ? SharedData.rooms.filter(r => !r.department || r.department === options.deptFilter)
        : SharedData.rooms;

    console.log(`Processing ${teachers.length} teachers and ${rooms.length} rooms`);
    
    // Sort teachers by those with least availability and longest durations first
    const sortedTeachers = [...teachers].sort((a, b) => {
        const aSlots = calculateAvailableSlots(a);
        const bSlots = calculateAvailableSlots(b);
        if (aSlots !== bSlots) return aSlots - bSlots;
        return (b.lessonDuration || 1) - (a.lessonDuration || 1);
    });
    
    if (options.prioritizeLabs) {
        sortedTeachers.sort((a, b) => (b.requiresLab ? 1 : 0) - (a.requiresLab ? 1 : 0));
    }
    
    console.group("Teacher Priority List:");
    sortedTeachers.forEach(teacher => {
        const course = SharedData.getCourseById(teacher.courseId);
        console.log(`${teacher.name}: ${course?.name || 'No Course'} (${teacher.requiredLessons || 2} lessons, ${teacher.lessonDuration || 1}hr each, ${calculateAvailableSlots(teacher)} slots)`);
    });
    console.groupEnd();
    
    // Determine generation parameters based on algorithm type
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
        
        // Generate a schedule attempt
        const { schedule, conflicts } = generateScheduleAttempt(
            sortedTeachers, 
            rooms, 
            options
        );
        
        // Calculate score for this attempt
        const score = calculateScheduleScore(
            schedule, 
            teachers, 
            conflicts,
            options
        );
        
        // Log attempt details
        console.group(`Attempt #${currentAttempt}`);
        console.log(`Score: ${score}%`);
        console.log(`Scheduled Lessons: ${schedule.length}`);
        console.log(`Conflicts: ${conflicts}`);
        
        // Update best schedule if this is better
        if (score > bestScore || bestSchedule === null) {
            bestScore = score;
            bestSchedule = schedule;
            
            console.log("🔥 New best schedule found!");
            logScheduleDetails(schedule);
            
            // Save to shared data if it's good enough
            if (score > 70) {
                SharedData.schedule = schedule;
                SharedData.lastScheduleGeneration = new Date().toISOString();
                SharedData.saveToLocalStorage();
            }
        }
        
        console.groupEnd();
        
        // Update UI
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const progress = Math.min(100, Math.floor((attempts / maxAttempts) * 100));
        
        document.getElementById('progressPercent').textContent = `${progress}%`;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('elapsedTime').textContent = `${elapsed} ثانية`;
        document.getElementById('attemptCount').textContent = currentAttempt;
        document.getElementById('bestScore').textContent = `${bestScore}%`;
        document.getElementById('scheduledLessons').textContent = schedule.length;
        document.getElementById('conflictsCount').textContent = conflicts;
        
        // Check if we should stop
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
    
    // Initialize tracking structures
    const teacherAssignments = {};
    const roomAssignments = {};
    
    teachers.forEach(teacher => {
        const course = SharedData.getCourseById(teacher.courseId);
        teacherAssignments[teacher.id] = {
            assigned: 0,
            required: teacher.requiredLessons || 2,
            daysUsed: {},
            duration: teacher.lessonDuration || 1,
            subject: course?.name || teacher.subject || 'مادة'
        };
    });
    
    rooms.forEach(room => {
        roomAssignments[room.id] = {};
        days.forEach(day => {
            roomAssignments[room.id][day] = Array(endHour - startHour).fill(null);
        });
    });
    
    // Schedule each teacher's lessons
    for (const teacher of teachers) {
        const lessonsToSchedule = teacher.requiredLessons || 2;
        const duration = teacher.lessonDuration || 1;
        const course = SharedData.getCourseById(teacher.courseId);
        const subject = course?.name || teacher.subject || 'مادة';
        
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
                duration
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
                    requiresLab: teacher.requiresLab || false,
                    createdAt: new Date().toISOString()
                };
                
                schedule.push(lesson);
                
                // Mark all hours in the duration as booked
                for (let h = 0; h < duration; h++) {
                    const slotHour = slot.hour + h;
                    if (slotHour < endHour) {
                        const slotIndex = slotHour - startHour;
                        roomAssignments[lesson.roomId][lesson.day][slotIndex] = lesson.id;
                    }
                }
                
                teacherAssignments[teacher.id].assigned++;
                teacherAssignments[teacher.id].daysUsed[slot.day] = 
                    (teacherAssignments[teacher.id].daysUsed[slot.day] || 0) + 1;
            } else {
                conflicts++;
            }
        }
    }
    
    return { schedule, conflicts };
}

function findOptimalSlot(teacher, days, startHour, endHour, teacherAssignments, roomAssignments, rooms, options, duration) {
    const availability = teacher.availability || {};
    const possibleSlots = [];
    
    // Collect all possible slots that can accommodate the duration
    days.forEach(day => {
        if (!availability[day] || availability[day].length === 0) return;
        
        // If minimizing gaps, prefer days already used by this teacher
        if (options.minimizeGaps && teacherAssignments[teacher.id]?.daysUsed?.[day] === 0) {
            return;
        }
        
        availability[day].forEach(hour => {
            // Check if this hour can accommodate the full duration
            if (hour + duration > endHour) return;
            
            // Verify all hours in the duration are available
            let allHoursAvailable = true;
            for (let h = 0; h < duration; h++) {
                const checkHour = hour + h;
                const availableRooms = findAvailableRooms(
                    rooms, 
                    roomAssignments, 
                    day, 
                    checkHour, 
                    1, // Check single hour availability
                    teacher.requiresLab,
                    startHour,
                    endHour
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
                    endHour
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
    
    // Sort slots based on optimization criteria
    possibleSlots.sort((a, b) => {
        // Prefer days already used by this teacher (minimize gaps)
        if (options.minimizeGaps && a.teacherDayUsage !== b.teacherDayUsage) {
            return b.teacherDayUsage - a.teacherDayUsage;
        }
        
        // Prefer slots that are earlier in the day
        return a.hour - b.hour;
    });
    
    return {
        day: possibleSlots[0].day,
        hour: possibleSlots[0].hour,
        roomId: selectBestRoom(possibleSlots[0].availableRooms, roomAssignments, options.balanceLoad)
    };
}

function findAvailableRooms(rooms, roomAssignments, day, hour, duration, needsLab, startHour, endHour) {
    return rooms.filter(room => {
        if (needsLab && (!room.type || room.type === 'room')) return false;
        
        // Check if all required hours are available
        for (let h = 0; h < duration; h++) {
            const slotHour = hour + h;
            if (slotHour >= endHour) return false;
            
            const slotIndex = slotHour - startHour;
            if (roomAssignments[room.id][day][slotIndex] !== null) {
                return false;
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
    const duration = teacher.lessonDuration || 1;
    
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
    
    // Penalize for conflicts
    score -= conflicts * 2;
    
    if (options.balanceLoad) {
        // Calculate teacher load balance
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
    
    // Group by day
    const days = SharedData.getDays();
    days.forEach(day => {
        const dayLessons = schedule.filter(l => l.day === day);
        if (dayLessons.length === 0) return;
        
        console.groupCollapsed(`${day} (${dayLessons.length} lessons)`);
        
        // Sort by hour
        dayLessons.sort((a, b) => a.hour - b.hour);
        
        dayLessons.forEach(lesson => {
            const teacher = SharedData.getTeacherById(lesson.teacherId);
            const room = SharedData.getRoomById(lesson.roomId);
            const course = teacher ? SharedData.getCourseById(teacher.courseId) : null;
            console.log(
                `${lesson.hour}:00 - ${lesson.hour + lesson.duration}:00 | ` +
                `Subject: ${course?.name || lesson.subject || 'N/A'} | ` +
                `Teacher: ${teacher?.name || 'Unknown'} | ` +
                `Room: ${room?.name || 'Unknown'} | ` +
                `Duration: ${lesson.duration}hr`
            );
        });
        
        console.groupEnd();
    });
    
    // Teacher workload statistics
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
    
    // Room utilization statistics
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
    
    console.groupEnd();
}