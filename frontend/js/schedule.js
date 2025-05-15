// schedule.js - Complete with Delete Functionality

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
        this.currentView = 'normal';
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
        document.getElementById('toggleCompactView')?.addEventListener('click', () => {
            this.currentView = 'normal';
            this.renderSchedule();
        });
        
        document.getElementById('toggleColorView')?.addEventListener('click', () => {
            this.currentView = 'color';
            this.renderSchedule();
        });

        document.getElementById('deptFilter')?.addEventListener('change', (e) => {
            this.currentFilters.department = e.target.value;
            this.updateTeacherFilter();
            this.renderSchedule();
        });
        
        document.getElementById('teacherFilter')?.addEventListener('change', (e) => {
            this.currentFilters.teacher = e.target.value;
            this.renderSchedule();
        });
        
        document.getElementById('roomFilter')?.addEventListener('change', (e) => {
            this.currentFilters.room = e.target.value;
            this.renderSchedule();
        });

        document.getElementById('downloadPdfBtn')?.addEventListener('click', () => {
            this.exportToPDF();
        });
        
        document.getElementById('downloadExcelBtn')?.addEventListener('click', () => {
            this.exportToExcel();
        });
        
        document.getElementById('printScheduleBtn')?.addEventListener('click', () => {
            this.printSchedule();
        });
        
        document.getElementById('refreshScheduleBtn')?.addEventListener('click', () => {
            this.renderSchedule();
            this.showToast('تم تحديث الجدول بنجاح', 'success');
        });

        document.getElementById('toggleAnalysis')?.addEventListener('click', () => {
            const analysisContent = document.getElementById('analysisContent');
            analysisContent.classList.toggle('hidden');
        });

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
        const days = SharedData.getDays();
        const { startHour, endHour } = SharedData.getHoursRange();
        
        // Track which cells should be hidden due to multi-hour lessons
        const hiddenCells = new Set();
        
        // Create table header
        let tableHTML = `
            <div class="schedule-table-container">
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th class="time-column">الوقت</th>
                            ${days.map(day => `<th>${day}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Create time slots
        for (let hour = startHour; hour < endHour; hour++) {
            tableHTML += `
                <tr>
                    <td class="time-column">${SharedData.formatHourToAMPM(hour)}</td>
            `;
            
            // Create cells for each day
            for (const day of days) {
                const cellKey = `${day}-${hour}`;
                
                // Skip if this cell is part of a multi-hour lesson
                if (hiddenCells.has(cellKey)) {
                    continue;
                }
                
                const lessons = filteredSchedule.filter(lesson => 
                    lesson.day === day && lesson.hour === hour
                );
                
                if (lessons.length === 0) {
                    tableHTML += `<td class="time-slot empty" data-day="${day}" data-hour="${hour}"></td>`;
                } else {
                    const lesson = lessons[0];
                    const teacher = SharedData.getTeacherById(lesson.teacherId);
                    const room = SharedData.getRoomById(lesson.roomId);
                    const dept = teacher ? SharedData.getDepartmentById(teacher.department) : null;
                    const course = SharedData.getCourseById(lesson.courseId) || { name: lesson.subject };
                    
                    // Determine cell styling
                    let cellStyle = '';
                    let cellClass = 'time-slot';
                    if (this.currentView === 'color' && dept) {
                        cellStyle = `style="background-color: ${dept.color}20; border-left: 3px solid ${dept.color};"`;
                    }
                    if (lesson.duration > 1) {
                        cellClass += ' multi-hour';
                        
                        // Mark subsequent hours as hidden
                        for (let h = 1; h < lesson.duration; h++) {
                            const nextHour = hour + h;
                            if (nextHour < endHour) {
                                hiddenCells.add(`${day}-${nextHour}`);
                            }
                        }
                    }
                    
                    tableHTML += `
                        <td class="${cellClass}" data-lesson-id="${lesson.id}" ${cellStyle} 
                            rowspan="${lesson.duration}" data-day="${day}" data-hour="${hour}">
                            <div class="time-slot-content">
                                <div class="lesson-actions">
                                    <button class="delete-lesson-btn" title="حذف هذه الحصة">🗑️</button>
                                </div>
                                ${lesson.duration > 1 ? `<span class="duration-badge">${lesson.duration} ساعات</span>` : ''}
                                <div class="subject">${course.name || 'غير معروف'}</div>
                                <div class="teacher">${teacher?.name || 'غير معروف'}</div>
                                <div class="room">${room?.name || 'غير معروف'}</div>
                                <div class="department">${dept?.name || 'عام'}</div>
                                ${lesson.requiresLab ? '<div class="lab-indicator">🔬 معمل</div>' : ''}
                            </div>
                        </td>
                    `;
                }
            }
            
            tableHTML += `</tr>`;
        }
        
        tableHTML += `</tbody></table></div>`;
        
        document.getElementById('finalSchedule').innerHTML = tableHTML;
        this.updateLegend();
        this.setupLessonDeleteButtons();
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
        
        if (this.currentView !== 'color') {
            legendContainer.classList.add('hidden');
            return;
        }
        
        legendContainer.classList.remove('hidden');
        
        let legendHTML = `
            <h3>مفتاح الألوان:</h3>
            <div class="legend-items-container">
        `;
        
        SharedData.departments.forEach(dept => {
            legendHTML += `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${dept.color}"></span>
                    <span class="legend-text">${dept.name} (${dept.code})</span>
                </div>
            `;
        });
        
        legendHTML += `</div>`;
        document.getElementById('legendItems').innerHTML = legendHTML;
    }

    updateStats() {
        if (!SharedData.schedule || SharedData.schedule.length === 0) return;
        
        const totalRequiredLessons = SharedData.teachers.reduce((sum, teacher) => {
            return sum + (teacher.requiredLessons || 0);
        }, 0);
        
        const completionPercentage = Math.round((SharedData.schedule.length / totalRequiredLessons) * 100);
        document.getElementById('completionBar').style.width = `${completionPercentage}%`;
        document.getElementById('completionPercent').textContent = `${completionPercentage}%`;
        
        const score = this.calculateScheduleScore();
        document.getElementById('scheduleScore').textContent = score;
        
        document.getElementById('totalLessons').textContent = SharedData.schedule.length;
        document.getElementById('totalTeachers').textContent = new Set(SharedData.schedule.map(l => l.teacherId)).size;
        
        this.updateAnalysis();
    }

    calculateScheduleScore() {
        if (!SharedData.schedule || SharedData.schedule.length === 0) return 0;
        
        let score = 80;
        const teacherConflicts = this.checkTeacherConflicts();
        score -= teacherConflicts * 5;
        const roomConflicts = this.checkRoomConflicts();
        score -= roomConflicts * 3;
        const labIssues = this.checkLabRequirements();
        score -= labIssues * 2;
        
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    checkTeacherConflicts() {
        const conflicts = new Set();
        const teacherSlots = {};
        
        SharedData.schedule.forEach(lesson => {
            const key = `${lesson.day}-${lesson.hour}`;
            if (!teacherSlots[key]) {
                teacherSlots[key] = new Set();
            }
            
            if (teacherSlots[key].has(lesson.teacherId)) {
                conflicts.add(`${lesson.teacherId}-${key}`);
            } else {
                teacherSlots[key].add(lesson.teacherId);
            }
        });
        
        return conflicts.size;
    }

    checkRoomConflicts() {
        const conflicts = new Set();
        const roomSlots = {};
        
        SharedData.schedule.forEach(lesson => {
            const key = `${lesson.day}-${lesson.hour}`;
            if (!roomSlots[key]) {
                roomSlots[key] = new Set();
            }
            
            if (roomSlots[key].has(lesson.roomId)) {
                conflicts.add(`${lesson.roomId}-${key}`);
            } else {
                roomSlots[key].add(lesson.roomId);
            }
        });
        
        return conflicts.size;
    }

    checkLabRequirements() {
        let issues = 0;
        
        SharedData.schedule.forEach(lesson => {
            if (lesson.requiresLab) {
                const room = SharedData.getRoomById(lesson.roomId);
                const lab = SharedData.getLabById(lesson.roomId);
                
                if (!room && !lab) {
                    issues++;
                } else if (room && !room.isLab) {
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
                    @page { size: A3 landscape; margin: 10mm; }
                </style>
            </head>
            <body>
                <h1>الجدول الدراسي</h1>
                <p style="text-align:center;">${document.getElementById('scheduleDetails').textContent}</p>
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