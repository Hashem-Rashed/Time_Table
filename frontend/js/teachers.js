// teachers.js - Final Complete Version
// Handles extended teacher information and availability

document.addEventListener('DOMContentLoaded', () => {
    window.teachersManager = new TeachersManager();
    teachersManager.init();
});

class TeachersManager {
    constructor() {
        this.currentTeacher = null;
        this.isEditing = false;
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filteredTeachers = [];
        this.availabilityTemplates = [];
        this.currentTemplateName = '';
    }

    init() {
        if (!window.SharedData) {
            console.error('SharedData not loaded');
            return;
        }

        // Initialize basicTeachers if not exists
        if (!SharedData.basicTeachers) {
            SharedData.basicTeachers = [];
        }

        this.loadData();
        this.populateDepartmentDropdowns();
        this.populateTeacherNamesDropdown();
        this.populateCoursesDropdown();
        this.initAvailabilityGrid();
        this.setupEventListeners();
        this.loadAvailabilityTemplates();
        this.updateTeachersTable();
        this.updateStats();

        // Set current year in footer
        document.getElementById('currentYear').textContent = new Date().getFullYear();
    }

    loadData() {
        // Combine basic teacher info with extended data
        this.filteredTeachers = SharedData.teachers.map(teacher => {
            const basicInfo = SharedData.basicTeachers.find(t => t.id === teacher.id) || {};
            return {
                ...basicInfo,
                ...teacher
            };
        });
    }

    populateDepartmentDropdowns() {
        const dropdowns = [
            document.getElementById('teacherDept'),
            document.getElementById('filterDept'),
            document.getElementById('batchDept')
        ];

        dropdowns.forEach(dropdown => {
            if (!dropdown) return;

            dropdown.innerHTML = `
                <option value="">${dropdown.id === 'filterDept' ? 'جميع الأقسام' : 'اختر القسم...'}</option>
                ${SharedData.departments.map(dept => `
                    <option value="${dept.id}">${dept.name} (${dept.code})</option>
                `).join('')}
            `;
        });
    }

    populateTeacherNamesDropdown() {
        const teacherSelect = document.getElementById('teacherName');
        if (!teacherSelect) return;

        teacherSelect.innerHTML = '<option value="">اختر اسم المدرس...</option>';

        SharedData.basicTeachers
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(teacher => {
                const option = document.createElement('option');
                option.value = teacher.id;
                option.textContent = teacher.name;
                teacherSelect.appendChild(option);
            });
    }

    populateCoursesDropdown() {
        const courseSelect = document.getElementById('teacherCourse');
        if (!courseSelect) return;

        courseSelect.innerHTML = '<option value="">اختر المادة...</option>';

        const deptId = document.getElementById('teacherDept')?.value;
        const courses = deptId 
            ? SharedData.courses.filter(c => c.deptId === deptId) 
            : SharedData.courses;

        courses.sort((a, b) => a.name.localeCompare(b.name)).forEach(course => {
            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = `${course.name} (${course.code}) - ${course.credits} ساعات`;
            courseSelect.appendChild(option);
        });
    }

    setupEventListeners() {
        document.getElementById('teacherForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        document.getElementById('teacherDept')?.addEventListener('change', () => {
            this.populateCoursesDropdown();
        });

        document.getElementById('clearFormBtn')?.addEventListener('click', () => {
            this.resetForm();
        });

        document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
            this.cancelEdit();
        });

        document.getElementById('selectAllAvailability')?.addEventListener('click', () => {
            this.selectAllAvailability(true);
        });

        document.getElementById('deselectAllAvailability')?.addEventListener('click', () => {
            this.selectAllAvailability(false);
        });

        document.getElementById('teacherSearch')?.addEventListener('input', (e) => {
            this.filterTeachers(e.target.value);
        });

        document.getElementById('filterDept')?.addEventListener('change', () => {
            this.filterTeachers();
        });

        document.getElementById('filterType')?.addEventListener('change', () => {
            this.filterTeachers();
        });

        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.updateTeachersTable();
            }
        });

        document.getElementById('nextPage')?.addEventListener('click', () => {
            if (this.currentPage < this.totalPages()) {
                this.currentPage++;
                this.updateTeachersTable();
            }
        });

        document.getElementById('addSampleTeachers')?.addEventListener('click', () => {
            this.addSampleTeachers();
        });

        document.getElementById('saveTemplateBtn')?.addEventListener('click', () => {
            this.saveCurrentAsTemplate();
        });

        document.getElementById('loadTemplateBtn')?.addEventListener('click', () => {
            this.showTemplateSelection();
        });

        document.getElementById('deleteAllTeachers')?.addEventListener('click', () => {
            this.deleteAllTeachers();
        });
    }

    handleFormSubmit() {
        const teacherSelect = document.getElementById('teacherName');
        const teacherId = teacherSelect.value;
        const basicTeacher = SharedData.basicTeachers.find(t => t.id === teacherId);
        
        if (!teacherId) {
            SharedData.showToast('الرجاء اختيار مدرس من القائمة', 'error');
            return;
        }

        if (!basicTeacher) {
            SharedData.showToast('المدرس المحدد غير موجود في السجلات الأساسية', 'error');
            return;
        }

        const deptId = document.getElementById('teacherDept').value;
        const type = document.getElementById('teacherType').value;
        const courseId = document.getElementById('teacherCourse').value;
        const lessons = parseInt(document.getElementById('requiredLessons').value);
        const duration = parseInt(document.getElementById('lessonDuration').value);
        const requiresLab = document.getElementById('requiresLab').checked;
        const notes = document.getElementById('teacherNotes').value.trim();
        const availability = this.getAvailabilityFromGrid();
        
        if (!deptId) {
            SharedData.showToast('الرجاء اختيار قسم للمدرس', 'error');
            return;
        }
        
        if (!courseId) {
            SharedData.showToast('الرجاء اختيار المادة', 'error');
            return;
        }
        
        if (isNaN(lessons) || lessons < 1) {
            SharedData.showToast('الرجاء إدخال عدد حصص صحيح', 'error');
            return;
        }
        
        if (isNaN(duration) || duration < 1) {
            SharedData.showToast('الرجاء إدخال مدة الحصة صحيحة', 'error');
            return;
        }

        const course = SharedData.getCourseById(courseId);
        if (!course) {
            SharedData.showToast('المادة المحددة غير موجودة', 'error');
            return;
        }

        const hasAvailability = Object.values(availability).some(hours => hours.length > 0);
        if (!hasAvailability && !confirm('لم يتم تحديد أي أوقات متاحة للمدرس. هل تريد المتابعة؟')) {
            return;
        }
        
        if (this.isEditing && this.currentTeacher) {
            Object.assign(this.currentTeacher, {
                name: basicTeacher.name, // Always use name from basic teachers
                department: deptId,
                type,
                courseId,
                lessons,
                duration,
                requiresLab: requiresLab || course.needsLab,
                notes: notes || basicTeacher.notes || '',
                availability,
                updatedAt: new Date().toISOString()
            });
            
            SharedData.showToast('تم تحديث بيانات المدرس بنجاح', 'success');
        } else {
            const newTeacher = {
                id: teacherId,
                name: basicTeacher.name, // Always use name from basic teachers
                department: deptId,
                type,
                courseId,
                lessons,
                duration,
                requiresLab: requiresLab || course.needsLab,
                notes: notes || basicTeacher.notes || '',
                availability,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            SharedData.teachers.push(newTeacher);
            SharedData.showToast('تم إضافة المدرس بنجاح', 'success');
        }
        
        SharedData.saveToLocalStorage();
        this.loadData();
        this.updateTeachersTable();
        this.updateStats();
        this.resetForm();
    }

    resetForm() {
        document.getElementById('teacherForm').reset();
        document.getElementById('teacherName').value = '';
        document.getElementById('teacherType').value = 'professor';
        document.getElementById('lessonDuration').value = '1';
        document.getElementById('requiresLab').checked = false;
        this.selectAllAvailability(false);
        this.currentTeacher = null;
        this.isEditing = false;
        document.getElementById('submitTeacherText').textContent = 'إضافة مدرس';
        document.getElementById('cancelEditBtn').classList.add('hidden');
    }

    cancelEdit() {
        if (confirm('هل تريد إلغاء التعديل؟ سيتم فقدان جميع التغييرات غير المحفوظة.')) {
            this.resetForm();
        }
    }

    filterTeachers(searchTerm = '') {
        const deptFilter = document.getElementById('filterDept')?.value || '';
        const typeFilter = document.getElementById('filterType')?.value || '';
        const term = searchTerm.toLowerCase();

        this.filteredTeachers = SharedData.teachers.map(teacher => {
            const basicInfo = SharedData.basicTeachers.find(t => t.id === teacher.id) || {};
            return {
                ...basicInfo,
                ...teacher
            };
        }).filter(teacher => {
            if (deptFilter && teacher.department !== deptFilter) return false;
            
            if (typeFilter && teacher.type !== typeFilter) return false;
            
            if (term) {
                const teacherName = teacher.name.toLowerCase();
                const course = SharedData.getCourseById(teacher.courseId);
                const courseName = course?.name.toLowerCase() || '';
                const dept = SharedData.getDepartmentById(teacher.department);
                const deptName = dept?.name.toLowerCase() || '';
                
                return teacherName.includes(term) || 
                       courseName.includes(term) || 
                       deptName.includes(term);
            }
            
            return true;
        });

        this.currentPage = 1;
        this.updateTeachersTable();
    }

    updateTeachersTable() {
        const tableBody = document.getElementById('teachersTable')?.querySelector('tbody');
        if (!tableBody) return;

        const startIdx = (this.currentPage - 1) * this.itemsPerPage;
        const paginatedTeachers = this.filteredTeachers.slice(startIdx, startIdx + this.itemsPerPage);

        tableBody.innerHTML = paginatedTeachers.map(teacher => {
            const dept = SharedData.getDepartmentById(teacher.department);
            const deptName = dept ? `${dept.name} (${dept.code})` : 'غير محدد';
            
            const course = SharedData.getCourseById(teacher.courseId);
            const courseName = course ? `${course.name} (${course.code})` : 'غير محدد';

            const typeNames = {
                professor: 'أستاذ دكتور',
                assistant: 'معيد',
                lecturer: 'مدرس',
                visiting: 'أستاذ زائر'
            };

            return `
                <tr data-id="${teacher.id}">
                    <td>${teacher.name}</td>
                    <td>${deptName}</td>
                    <td>${typeNames[teacher.type] || teacher.type}</td>
                    <td>${courseName}</td>
                    <td>${teacher.lessons}</td>
                    <td>${teacher.duration} ساعة</td>
                    <td>${teacher.requiresLab ? 'نعم' : 'لا'}</td>
                    <td>
                        <button class="btn-small btn-secondary edit-btn" data-id="${teacher.id}">
                            <span class="icon">✏️</span>
                            <span class="text">تعديل</span>
                        </button>
                        <button class="btn-small btn-danger delete-btn" data-id="${teacher.id}">
                            <span class="icon">🗑️</span>
                            <span class="text">حذف</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        this.updatePagination();

        tableBody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => this.editTeacher(btn.dataset.id));
        });

        tableBody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => this.deleteTeacher(btn.dataset.id));
        });
    }

    editTeacher(teacherId) {
        const teacher = SharedData.teachers.find(t => t.id === teacherId);
        if (!teacher) return;
        
        this.currentTeacher = teacher;
        this.isEditing = true;
        
        document.getElementById('teacherName').value = teacher.id;
        document.getElementById('teacherDept').value = teacher.department;
        document.getElementById('teacherType').value = teacher.type;
        document.getElementById('requiredLessons').value = teacher.lessons;
        document.getElementById('lessonDuration').value = teacher.duration;
        document.getElementById('requiresLab').checked = teacher.requiresLab;
        document.getElementById('teacherNotes').value = teacher.notes || '';
        
        this.populateCoursesDropdown();
        document.getElementById('teacherCourse').value = teacher.courseId || '';
        
        this.updateAvailabilityGrid(teacher.availability);
        
        document.getElementById('submitTeacherText').textContent = 'حفظ التعديلات';
        document.getElementById('cancelEditBtn').classList.remove('hidden');
        document.getElementById('teacherForm').scrollIntoView({ behavior: 'smooth' });
    }

    deleteTeacher(teacherId) {
        if (!confirm('هل أنت متأكد من حذف هذا المدرس؟ لا يمكن التراجع عن هذا الإجراء.')) {
            return;
        }
        
        // Check if teacher is used in schedule
        if (SharedData.schedule?.some(lesson => lesson.teacherId === teacherId)) {
            SharedData.showToast('لا يمكن حذف المدرس لأنه مستخدم في الجدول الدراسي', 'error');
            return;
        }
        
        // Store initial count for comparison
        const initialCount = SharedData.teachers.length;
        
        // Find the index of the teacher to delete
        const teacherIndex = SharedData.teachers.findIndex(t => String(t.id) === String(teacherId));
        
        // Check if teacher was found
        if (teacherIndex === -1) {
            SharedData.showToast('لم يتم العثور على المدرس', 'error');
            return;
        }
        
        // Remove the teacher from the array
        SharedData.teachers.splice(teacherIndex, 1);
        
        // Save changes and update UI
        SharedData.saveToLocalStorage();
        this.loadData();
        this.populateTeacherNamesDropdown();
        this.updateTeachersTable();
        this.updateStats();
        
        // Reset form if editing the deleted teacher
        if (this.isEditing && this.currentTeacher?.id === teacherId) {
            this.resetForm();
        }
        
        SharedData.showToast('تم حذف المدرس بنجاح', 'success');
    }

    updatePagination() {
        const totalItems = this.filteredTeachers.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);

        document.getElementById('pageInfo').textContent = `الصفحة ${this.currentPage} من ${totalPages}`;
        document.getElementById('currentCount').textContent = endItem;
        document.getElementById('totalCount').textContent = totalItems;
        
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
        
        document.getElementById('deleteAllTeachers').disabled = totalItems === 0;
    }

    totalPages() {
        return Math.ceil(this.filteredTeachers.length / this.itemsPerPage);
    }

    updateStats() {
        document.getElementById('teacherCount').textContent = SharedData.teachers.length;
        document.getElementById('professorCount').textContent = 
            SharedData.teachers.filter(t => t.type === 'professor').length;
        document.getElementById('assistantCount').textContent = 
            SharedData.teachers.filter(t => t.type === 'assistant').length;
        document.getElementById('totalLessons').textContent = 
            SharedData.teachers.reduce((sum, t) => sum + t.lessons, 0);
    }

    initAvailabilityGrid() {
        const days = SharedData.getDays();
        const { startHour, endHour } = SharedData.getHoursRange();
        const grid = document.getElementById('availabilityGrid');
        
        if (!grid) return;
        
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>اليوم</th>
                        ${Array.from({ length: endHour - startHour }, (_, i) => {
                            const hour = startHour + i;
                            const displayHour = hour % 12 || 12;
                            const ampm = hour < 12 ? 'ص' : 'م';
                            return `<th>${displayHour} ${ampm}</th>`;
                        }).join('')}
                        <th>تحديد الكل</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        days.forEach(day => {
            html += `
                <tr>
                    <td>${day}</td>
                    ${Array.from({ length: endHour - startHour }, (_, i) => {
                        const hour = startHour + i;
                        return `
                            <td>
                                <input type="checkbox" 
                                       id="avail-${day}-${hour}" 
                                       data-day="${day}" 
                                       data-hour="${hour}" 
                                       class="availability-checkbox">
                                <label for="avail-${day}-${hour}" class="availability-label"></label>
                            </td>
                        `;
                    }).join('')}
                    <td>
                        <button class="btn-small select-day-btn" data-day="${day}">
                            <span class="icon">✓</span>
                            <span class="text">تحديد</span>
                        </button>
                        <button class="btn-small deselect-day-btn" data-day="${day}">
                            <span class="icon">✗</span>
                            <span class="text">إلغاء</span>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        grid.innerHTML = html;
        
        document.querySelectorAll('.availability-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    checkbox.parentElement.style.backgroundColor = 'rgba(46, 204, 113, 0.2)';
                } else {
                    checkbox.parentElement.style.backgroundColor = '';
                }
            });
        });
        
        document.querySelectorAll('.select-day-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectDayAvailability(btn.dataset.day, true);
            });
        });
        
        document.querySelectorAll('.deselect-day-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectDayAvailability(btn.dataset.day, false);
            });
        });
    }

    selectDayAvailability(day, select) {
        const checkboxes = document.querySelectorAll(`.availability-checkbox[data-day="${day}"]`);
        checkboxes.forEach(checkbox => {
            checkbox.checked = select;
            const event = new Event('change');
            checkbox.dispatchEvent(event);
        });
    }

    updateAvailabilityGrid(availability = {}) {
        const checkboxes = document.querySelectorAll('.availability-checkbox');
        checkboxes.forEach(checkbox => {
            const day = checkbox.dataset.day;
            const hour = parseInt(checkbox.dataset.hour);
            checkbox.checked = availability[day]?.includes(hour) || false;
            checkbox.parentElement.style.backgroundColor = checkbox.checked ? 'rgba(46, 204, 113, 0.2)' : '';
        });
    }

    getAvailabilityFromGrid() {
        const availability = {};
        const checkboxes = document.querySelectorAll('.availability-checkbox:checked');
        
        SharedData.getDays().forEach(day => {
            availability[day] = [];
        });
        
        checkboxes.forEach(checkbox => {
            const day = checkbox.dataset.day;
            const hour = parseInt(checkbox.dataset.hour);
            availability[day].push(hour);
        });
        
        return availability;
    }

    selectAllAvailability(select) {
        const checkboxes = document.querySelectorAll('.availability-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = select;
            const event = new Event('change');
            checkbox.dispatchEvent(event);
        });
    }

    loadAvailabilityTemplates() {
        const savedTemplates = localStorage.getItem('teacherAvailabilityTemplates');
        this.availabilityTemplates = savedTemplates ? JSON.parse(savedTemplates) : [];
        
        if (this.availabilityTemplates.length === 0) {
            this.availabilityTemplates = [
                {
                    name: "دوام كامل",
                    availability: this.createFullTimeAvailability()
                },
                {
                    name: "دوام جزئي صباحي",
                    availability: this.createMorningAvailability()
                },
                {
                    name: "دوام جزئي مسائي",
                    availability: this.createAfternoonAvailability()
                }
            ];
            this.saveAvailabilityTemplates();
        }
    }

    saveAvailabilityTemplates() {
        localStorage.setItem('teacherAvailabilityTemplates', JSON.stringify(this.availabilityTemplates));
    }

    createFullTimeAvailability() {
        const availability = {};
        const { startHour, endHour } = SharedData.getHoursRange();
        
        SharedData.getDays().forEach(day => {
            availability[day] = [];
            for (let h = startHour; h < endHour; h++) {
                availability[day].push(h);
            }
        });
        
        return availability;
    }

    createMorningAvailability() {
        const availability = {};
        const { startHour } = SharedData.getHoursRange();
        
        SharedData.getDays().forEach(day => {
            availability[day] = [];
            for (let h = startHour; h < 12; h++) {
                availability[day].push(h);
            }
        });
        
        return availability;
    }

    createAfternoonAvailability() {
        const availability = {};
        const { endHour } = SharedData.getHoursRange();
        
        SharedData.getDays().forEach(day => {
            availability[day] = [];
            for (let h = 12; h < endHour; h++) {
                availability[day].push(h);
            }
        });
        
        return availability;
    }

    saveCurrentAsTemplate() {
        const availability = this.getAvailabilityFromGrid();
        const templateName = prompt('أدخل اسم للقالب:', this.currentTemplateName || 'قالب جديد');
        
        if (!templateName) return;
        
        const existingIndex = this.availabilityTemplates.findIndex(t => t.name === templateName);
        const newTemplate = { name: templateName, availability };
        
        if (existingIndex >= 0) {
            if (confirm('يوجد قالب بنفس الاسم بالفعل. هل تريد استبداله؟')) {
                this.availabilityTemplates[existingIndex] = newTemplate;
            } else {
                return;
            }
        } else {
            this.availabilityTemplates.push(newTemplate);
        }
        
        this.saveAvailabilityTemplates();
        SharedData.showToast(`تم حفظ القالب "${templateName}" بنجاح`, 'success');
        this.currentTemplateName = templateName;
    }

    showTemplateSelection() {
        if (this.availabilityTemplates.length === 0) {
            SharedData.showToast('لا يوجد قوالب محفوظة', 'info');
            return;
        }
        
        const templateList = this.availabilityTemplates.map(t => 
            `<option value="${t.name}">${t.name}</option>`
        ).join('');
        
        const selectedTemplate = prompt(
            `اختر قالب:\n\n${this.availabilityTemplates.map((t, i) => 
                `${i+1}. ${t.name}`).join('\n')}\n\nأدخل رقم القالب:`, 
            '1'
        );
        
        if (!selectedTemplate) return;
        
        const templateIndex = parseInt(selectedTemplate) - 1;
        if (isNaN(templateIndex) || templateIndex < 0 || templateIndex >= this.availabilityTemplates.length) {
            SharedData.showToast('اختيار غير صحيح', 'error');
            return;
        }
        
        const template = this.availabilityTemplates[templateIndex];
        this.updateAvailabilityGrid(template.availability);
        this.currentTemplateName = template.name;
        SharedData.showToast(`تم تحميل القالب "${template.name}"`, 'success');
    }

    addSampleTeachers() {
        if (SharedData.departments.length === 0) {
            SharedData.showToast('الرجاء إضافة أقسام أولاً', 'error');
            return;
        }

        if (SharedData.courses.length === 0) {
            SharedData.showToast('الرجاء إضافة مواد أولاً', 'error');
            return;
        }

        const sampleTeachers = [
            {
                name: "د. أحمد محمد",
                department: SharedData.departments[0].id,
                type: "professor",
                courseId: SharedData.courses.find(c => c.deptId === SharedData.departments[0].id)?.id,
                lessons: 3,
                duration: 1,
                requiresLab: false,
                availability: this.generateSampleAvailability()
            },
            {
                name: "أ. علي محمود",
                department: SharedData.departments[0].id,
                type: "assistant",
                courseId: SharedData.courses.find(c => c.needsLab)?.id,
                lessons: 4,
                duration: 2,
                requiresLab: true,
                availability: this.generateSampleAvailability()
            }
        ];

        sampleTeachers.forEach(teacher => {
            if (!teacher.courseId) return;
            
            if (!SharedData.teachers.some(t => t.name === teacher.name)) {
                SharedData.teachers.push({
                    ...teacher,
                    id: SharedData.generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    notes: "مدرس نموذجي"
                });
            }
        });

        SharedData.saveToLocalStorage();
        this.loadData();
        this.updateTeachersTable();
        this.updateStats();
    }

    generateSampleAvailability() {
        const days = SharedData.getDays();
        const { startHour, endHour } = SharedData.getHoursRange();
        const availability = {};
        
        days.forEach(day => {
            availability[day] = [];
            for (let h = startHour; h < endHour; h++) {
                if (Math.random() > 0.3) {
                    availability[day].push(h);
                }
            }
        });
        
        return availability;
    }

    deleteAllTeachers() {
        if (SharedData.teachers.length === 0) {
            SharedData.showToast('لا يوجد مدرسين لحذفهم', 'info');
            return;
        }

        if (!confirm('⚠️ هل أنت متأكد من حذف جميع المدرسين؟\nهذا الإجراء سيحذف جميع بيانات المدرسين ولا يمكن التراجع عنه!')) {
            return;
        }

        // Check if any teachers are used in schedule
        const teachersInSchedule = SharedData.teachers.filter(teacher => 
            SharedData.schedule?.some(lesson => lesson.teacherId === teacher.id)
        );

        if (teachersInSchedule.length > 0) {
            SharedData.showToast(
                `لا يمكن حذف ${teachersInSchedule.length} مدرس/مدرسين لأنهم مستخدمين في الجدول الدراسي`,
                'error'
            );
            return;
        }

        // Delete all teachers not in schedule
        SharedData.teachers = [];
        
        SharedData.saveToLocalStorage();
        this.loadData();
        this.populateTeacherNamesDropdown();
        this.updateTeachersTable();
        this.updateStats();
        
        SharedData.showToast('تم حذف جميع المدرسين بنجاح', 'success');
    }
}