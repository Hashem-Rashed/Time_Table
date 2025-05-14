// generate.js - Complete Schedule Generation System (Fixed Version)

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
}

function setupUI() {
    populateDepartmentFilter();
    updateReadinessChecks();
}

function setupEventListeners() {
    document.getElementById('generateBtn')?.addEventListener('click', () => startGeneration(false));
    document.getElementById('generateBestBtn')?.addEventListener('click', () => startGeneration(true));
    document.getElementById('viewScheduleBtn')?.addEventListener('click', () => window.location.href = 'schedule.html');
    document.getElementById('tryAgainBtn')?.addEventListener('click', resetUI);
    document.getElementById('exportResultsBtn')?.addEventListener('click', exportSchedule);
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
    const teachers = SharedData.teachers || [];
    const rooms = SharedData.rooms || [];

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

    const availableTeachers = teachers.filter(t => {
        const teacher = SharedData.getTeacherById(t.id);
        return teacher?.availability && Object.values(teacher.availability).some(hours => hours.length > 0);
    }).length;
    
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

    element.innerHTML = `
        <span class="check-icon">${isReady ? (isWarning ? '!' : '✓') : '✗'}</span>
        <span class="check-text">${isReady ? readyText : notReadyText}</span>
    `;
    element.className = `check-item ${isReady ? (isWarning ? 'warning' : 'success') : 'error'}`;
}

function startGeneration(preciseMode) {
    if (!validateGenerationInputs()) return;

    const options = {
        precise: preciseMode,
        deptFilter: document.getElementById('deptFilter').value,
        optimize: document.getElementById('optimizeCheckbox').checked,
        balanceLoad: document.getElementById('balanceLoadCheckbox').checked,
        minimizeGaps: document.getElementById('minimizeGapsCheckbox').checked,
        maxTime: parseInt(document.getElementById('maxGenerationTime').value) || 30
    };

    showProgressUI();
    generateSchedule(options);
}

function validateGenerationInputs() {
    if (!SharedData.teachers?.length || !SharedData.rooms?.length) {
        SharedData.showToast('يجب إضافة مدرسين وأماكن أولاً', 'error');
        return false;
    }
    return true;
}

function showProgressUI() {
    document.getElementById('generationProgress').classList.remove('hidden');
    document.getElementById('generationResults').classList.add('hidden');
}

function resetUI() {
    document.getElementById('generationProgress').classList.add('hidden');
    document.getElementById('generationResults').classList.add('hidden');
}

function generateSchedule(options) {
    const { precise, deptFilter, optimize, balanceLoad, minimizeGaps, maxTime } = options;
    const days = SharedData.getDays();
    const { startHour, endHour } = SharedData.getHoursRange();

    // Filter data based on department
    const teachers = filterByDepartment(SharedData.teachers || [], deptFilter);
    const rooms = filterByDepartment(SharedData.rooms || [], deptFilter, true);

    // Initialize tracking
    const teacherAssignments = initializeTeacherAssignments(teachers);
    const roomAssignments = initializeRoomAssignments(rooms, days, startHour, endHour);

    // Generation parameters
    const maxAttempts = precise ? 100 : 10;
    let attempts = 0;
    let bestScore = 0;
    let bestSchedule = null;
    const startTime = Date.now();

    const generationInterval = setInterval(() => {
        attempts++;
        
        const { schedule, teacherAssignments: tempTeacherAssignments } = 
            generateSingleScheduleAttempt(teachers, rooms, days, startHour, endHour, 
                JSON.parse(JSON.stringify(teacherAssignments)), 
                JSON.parse(JSON.stringify(roomAssignments)), 
                optimize, minimizeGaps);

        const score = calculateScheduleScore(schedule, teachers, tempTeacherAssignments, balanceLoad);

        if (score > bestScore || bestSchedule === null) {
            bestScore = score;
            bestSchedule = schedule;
        }

        updateProgressUI(attempts, bestScore, maxAttempts, startTime, schedule?.length || 0);

        if (attempts >= maxAttempts || (Date.now() - startTime) / 1000 >= maxTime) {
            clearInterval(generationInterval);
            handleGenerationResult({
                success: bestSchedule?.length > 0,
                schedule: bestSchedule,
                score: bestScore,
                attempts,
                elapsed: (Date.now() - startTime) / 1000,
                unscheduled: calculateUnscheduledLessons(bestSchedule, teachers)
            });
        }
    }, 100);
}

function generateSingleScheduleAttempt(teachers, rooms, days, startHour, endHour, teacherAssignments, roomAssignments, optimize, minimizeGaps) {
    const schedule = [];
    
    // Create a priority queue of teachers based on their constraints
    const teacherQueue = createTeacherQueue(teachers, days, startHour, endHour, minimizeGaps);

    while (teacherQueue.length > 0) {
        const teacher = teacherQueue.shift();
        const teacherData = SharedData.getTeacherById(teacher.id);
        const requiredLessons = teacher.requiredLessons || 2;
        const lessonsToSchedule = requiredLessons - (teacherAssignments[teacher.id]?.assigned || 0);

        for (let i = 0; i < lessonsToSchedule; i++) {
            const slot = findOptimalSlot(teacher, days, startHour, endHour, 
                teacherAssignments, roomAssignments, rooms, optimize, minimizeGaps);

            if (slot) {
                const lesson = createLesson(teacher, slot);
                schedule.push(lesson);

                // Mark timeslot as booked
                for (let h = 0; h < lesson.duration; h++) {
                    if (!roomAssignments[lesson.roomId][lesson.day]) {
                        roomAssignments[lesson.roomId][lesson.day] = Array(endHour - startHour).fill(null);
                    }
                    roomAssignments[lesson.roomId][lesson.day][lesson.hour + h - startHour] = lesson.id;
                }

                teacherAssignments[teacher.id].assigned++;
                teacherAssignments[teacher.id].daysUsed[slot.day] = (teacherAssignments[teacher.id].daysUsed[slot.day] || 0) + 1;
                
                // Re-sort the queue as priorities may have changed
                teacherQueue.sort((a, b) => compareTeacherPriority(a, b, teacherAssignments, days, startHour, endHour, minimizeGaps));
            }
        }
    }

    return { schedule, teacherAssignments };
}

function createTeacherQueue(teachers, days, startHour, endHour, minimizeGaps) {
    // Create a prioritized list of teachers
    return [...teachers].sort((a, b) => 
        compareTeacherPriority(a, b, {}, days, startHour, endHour, minimizeGaps)
    );
}

function compareTeacherPriority(a, b, teacherAssignments, days, startHour, endHour, minimizeGaps) {
    // Teachers with fewer available slots get higher priority
    const aSlots = calculateAvailableSlots(a, days, startHour, endHour, teacherAssignments[a.id], minimizeGaps);
    const bSlots = calculateAvailableSlots(b, days, startHour, endHour, teacherAssignments[b.id], minimizeGaps);
    
    // Teachers requiring labs get higher priority if labs are limited
    if (a.requiresLab !== b.requiresLab) {
        return a.requiresLab ? -1 : 1;
    }
    
    // Teachers with more required lessons get priority
    if (a.requiredLessons !== b.requiredLessons) {
        return b.requiredLessons - a.requiredLessons;
    }
    
    return aSlots - bSlots;
}

function calculateAvailableSlots(teacher, days, startHour, endHour, assignment = {}, minimizeGaps) {
    const teacherData = SharedData.getTeacherById(teacher.id);
    const availability = teacherData?.availability || {};
    let count = 0;
    const duration = teacher.lessonDuration || 1;
    
    days.forEach(day => {
        if (!availability[day] || availability[day].length === 0) return;
        if (minimizeGaps && assignment.daysUsed?.[day]) return;

        availability[day].forEach(hour => {
            if (hour + duration <= endHour) {
                count++;
            }
        });
    });
    
    return count;
}

function findOptimalSlot(teacher, days, startHour, endHour, teacherAssignments, roomAssignments, rooms, optimize, minimizeGaps) {
    const duration = teacher.lessonDuration || 1;
    const teacherData = SharedData.getTeacherById(teacher.id);
    const availability = teacherData?.availability || {};
    const possibleSlots = [];

    // Collect all possible slots
    days.forEach(day => {
        if (!availability[day] || availability[day].length === 0) return;
        if (minimizeGaps && teacherAssignments[teacher.id]?.daysUsed?.[day]) return;

        availability[day].forEach(hour => {
            if (hour + duration > endHour) return;

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
        });
    });

    if (possibleSlots.length === 0) return null;

    // Sort slots based on optimization criteria
    possibleSlots.sort((a, b) => {
        // 1. Consider day usage based on minimizeGaps setting
        if (minimizeGaps) {
            if (a.teacherDayUsage !== b.teacherDayUsage) {
                return b.teacherDayUsage - a.teacherDayUsage;
            }
        } else {
            if (a.teacherDayUsage !== b.teacherDayUsage) {
                return a.teacherDayUsage - b.teacherDayUsage;
            }
        }

        // 2. Consider room usage if optimizing
        if (optimize && a.roomUsageScore !== b.roomUsageScore) {
            return a.roomUsageScore - b.roomUsageScore;
        }

        // 3. Default: earlier in the week/day
        if (a.day !== b.day) return days.indexOf(a.day) - days.indexOf(b.day);
        return a.hour - b.hour;
    });

    return {
        day: possibleSlots[0].day,
        hour: possibleSlots[0].hour,
        roomId: selectBestRoom(possibleSlots[0].availableRooms, roomAssignments, optimize)
    };
}

function findAvailableRooms(rooms, roomAssignments, day, hour, duration, needsLab, startHour, endHour) {
    return rooms.filter(room => {
        if (needsLab && (!room.type || room.type === 'room')) return false;
        
        if (!roomAssignments[room.id][day]) {
            roomAssignments[room.id][day] = Array(endHour - startHour).fill(null);
        }
        
        for (let h = 0; h < duration; h++) {
            const timeSlot = hour + h - startHour;
            if (timeSlot < 0 || timeSlot >= endHour - startHour) return false;
            if (roomAssignments[room.id][day][timeSlot] !== null) {
                return false;
            }
        }
        return true;
    });
}

function calculateRoomUsageScore(rooms, roomAssignments) {
    return Math.min(...rooms.map(room => 
        countRoomUsage(room.id, roomAssignments)
    ));
}

function selectBestRoom(rooms, roomAssignments, optimize) {
    if (!optimize || rooms.length === 1) {
        return rooms[Math.floor(Math.random() * rooms.length)].id;
    }

    return rooms.sort((a, b) => 
        countRoomUsage(a.id, roomAssignments) - 
        countRoomUsage(b.id, roomAssignments)
    )[0].id;
}

function countRoomUsage(roomId, roomAssignments) {
    return Object.values(roomAssignments[roomId])
        .flat()
        .filter(slot => slot !== null)
        .length;
}

function createLesson(teacher, slot) {
    return {
        id: SharedData.generateId(),
        teacherId: teacher.id,
        subject: teacher.subject,
        day: slot.day,
        hour: slot.hour,
        duration: teacher.lessonDuration || 1,
        roomId: slot.roomId,
        department: teacher.department,
        requiresLab: teacher.requiresLab || false,
        createdAt: new Date().toISOString()
    };
}

function filterByDepartment(items, deptId, isRoom = false) {
    return deptId 
        ? items.filter(item => isRoom ? (!item.department || item.department === deptId) : item.department === deptId)
        : [...items];
}

function initializeTeacherAssignments(teachers) {
    return teachers.reduce((acc, teacher) => {
        const teacherData = SharedData.getTeacherById(teacher.id);
        acc[teacher.id] = {
            assigned: 0,
            required: teacher.requiredLessons || 2,
            daysUsed: {},
            availability: teacherData?.availability || {}
        };
        return acc;
    }, {});
}

function initializeRoomAssignments(rooms, days, startHour, endHour) {
    return rooms.reduce((acc, room) => {
        acc[room.id] = days.reduce((dayAcc, day) => {
            dayAcc[day] = Array(endHour - startHour).fill(null);
            return dayAcc;
        }, {});
        return acc;
    }, {});
}

function calculateScheduleScore(schedule, teachers, teacherAssignments, balanceLoad) {
    if (!schedule?.length) return 0;

    const totalRequired = teachers.reduce((sum, t) => sum + (t.requiredLessons || 2), 0);
    let score = (schedule.length / totalRequired) * 70;

    if (balanceLoad) {
        const teacherLoads = Object.values(teacherAssignments).map(ta => ta.assigned / ta.required);
        const loadVariance = calculateVariance(teacherLoads);
        score += 30 * (1 - Math.min(1, loadVariance));
    }

    return Math.round(score);
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

function updateProgressUI(attempts, bestScore, maxAttempts, startTime, scheduledCount) {
    const progress = Math.min(100, (attempts / maxAttempts) * 100);
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    document.getElementById('progressStatus').textContent = `جارٍ التوليد (المحاولة ${attempts})`;
    document.getElementById('progressPercent').textContent = `${Math.round(progress)}%`;
    document.getElementById('progressBar').style.width = `${progress}%`;
    document.getElementById('attemptsCount').textContent = attempts;
    document.getElementById('bestScore').textContent = `${bestScore}%`;
    document.getElementById('elapsedTime').textContent = `${elapsed} ثانية`;
}

function handleGenerationResult(result) {
    document.getElementById('generationProgress').classList.add('hidden');

    const resultsEl = document.getElementById('generationResults');
    resultsEl.classList.remove('hidden');

    document.getElementById('scheduledLessons').textContent = result.schedule?.length || 0;
    document.getElementById('unscheduledLessons').textContent = result.unscheduled || 0;
    document.getElementById('generationTime').textContent = `${Math.round(result.elapsed)} ثانية`;
    document.getElementById('scheduleQuality').textContent = `${result.score}%`;

    if (result.success) {
        SharedData.schedule = result.schedule;
        SharedData.lastScheduleGeneration = new Date().toISOString();
        SharedData.saveToLocalStorage();
    }
}

function exportSchedule() {
    if (!SharedData.schedule?.length) {
        SharedData.showToast('لا يوجد جدول لتصديره', 'warning');
        return;
    }

    const exportData = {
        metadata: {
            generatedAt: new Date().toISOString(),
            college: SharedData.settings?.collegeName || 'غير محدد',
            academicTerm: document.getElementById('scheduleSubtitle')?.textContent || 'غير محدد'
        },
        schedule: SharedData.schedule.map(lesson => {
            const teacher = SharedData.getTeacherById(lesson.teacherId);
            const room = SharedData.getRoomById(lesson.roomId);
            const department = SharedData.getDepartmentById(teacher?.department);

            return {
                id: lesson.id,
                subject: lesson.subject,
                teacher: teacher?.name || 'غير معروف',
                teacherId: lesson.teacherId,
                day: lesson.day,
                time: SharedData.formatHourToAMPM(lesson.hour),
                duration: lesson.duration,
                room: room?.name || 'غير معروف',
                roomId: lesson.roomId,
                roomType: room?.type === 'room' ? 'قاعة' : 'معمل',
                department: department?.name || 'غير معروف',
                departmentCode: department?.code || 'غير معروف',
                requiresLab: lesson.requiresLab || false
            };
        }),
        statistics: {
            totalLessons: SharedData.schedule.length,
            totalTeachers: new Set(SharedData.schedule.map(l => l.teacherId)).size,
            totalRooms: new Set(SharedData.schedule.map(l => l.roomId)).size,
            generationTime: document.getElementById('generationTime').textContent,
            qualityScore: document.getElementById('scheduleQuality').textContent
        }
    };

    try {
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

        SharedData.showToast('تم تصدير الجدول بنجاح', 'success');
    } catch (error) {
        console.error('Export failed:', error);
        SharedData.showToast('فشل تصدير الجدول', 'error');
    }
}