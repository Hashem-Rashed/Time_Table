// courses.js - Updated Course Management System with automatic list refresh

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the courses manager
    if (typeof coursesManager === 'undefined') {
        window.coursesManager = new CoursesManager();
    }
    coursesManager.init();
});

class CoursesManager {
    constructor() {
        this.courses = [];
        this.filteredCourses = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentEditId = null; // Track editing state
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderDepartmentsDropdown();
        this.updateStats();
        this.renderCoursesList();
    }

    loadData() {
        // Load from SharedData or initialize empty array
        this.courses = SharedData.courses || [];
        this.filteredCourses = [...this.courses];
    }

    saveData() {
        SharedData.courses = this.courses;
        SharedData.saveToLocalStorage();
    }

    setupEventListeners() {
        // Course form submission
        document.getElementById('courseForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCourseSubmit();
        });

        // Clear form button
        document.getElementById('clearFormBtn')?.addEventListener('click', () => {
            this.clearForm();
        });

        // Edit cancel button
        document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
            this.cancelEdit();
        });

        // Search functionality
        document.getElementById('courseSearch')?.addEventListener('input', (e) => {
            this.filterCourses(e.target.value);
        });

        // Filter dropdowns
        document.getElementById('filterDept')?.addEventListener('change', () => {
            this.filterCourses();
        });

        document.getElementById('filterYear')?.addEventListener('change', () => {
            this.filterCourses();
        });

        document.getElementById('filterType')?.addEventListener('change', () => {
            this.filterCourses();
        });

        // Pagination
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderCoursesList();
            }
        });

        document.getElementById('nextPage')?.addEventListener('click', () => {
            if (this.currentPage < this.totalPages()) {
                this.currentPage++;
                this.renderCoursesList();
            }
        });

        // Add sample data button
        document.getElementById('addSampleCourses')?.addEventListener('click', () => {
            this.addSampleData();
        });
    }

    renderDepartmentsDropdown() {
        const deptDropdown = document.getElementById('courseDept');
        const filterDeptDropdown = document.getElementById('filterDept');

        if (!deptDropdown) return;

        // Clear existing options
        deptDropdown.innerHTML = '<option value="">اختر القسم...</option>';
        if (filterDeptDropdown) filterDeptDropdown.innerHTML = '<option value="">جميع الأقسام</option>';

        // Add departments
        SharedData.departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.id;
            option.textContent = dept.name;
            deptDropdown.appendChild(option.cloneNode(true));
            
            if (filterDeptDropdown) {
                filterDeptDropdown.appendChild(option.cloneNode(true));
            }
        });
    }

    handleCourseSubmit() {
        const name = document.getElementById('courseName').value.trim();
        const code = document.getElementById('courseCode').value.trim().toUpperCase();
        const deptId = document.getElementById('courseDept').value;
        const year = parseInt(document.getElementById('courseYear').value);
        const credits = parseInt(document.getElementById('courseCredits').value);
        const type = document.getElementById('courseType').value;
        const needsLab = document.getElementById('needsLab').checked;
        const description = document.getElementById('courseDescription').value.trim();

        // Validate inputs
        if (!name || !code || !deptId || !year || !credits || !type) {
            SharedData.showToast('الرجاء ملء جميع الحقول المطلوبة', 'error');
            return;
        }

        // Check if code is unique (except when editing the same course)
        const codeExists = this.courses.some(
            course => course.code === code && course.id !== this.currentEditId
        );
        
        if (codeExists) {
            SharedData.showToast('كود المادة هذا مستخدم بالفعل', 'error');
            return;
        }

        if (this.currentEditId) {
            // Update existing course
            const courseIndex = this.courses.findIndex(c => c.id === this.currentEditId);
            if (courseIndex !== -1) {
                this.courses[courseIndex] = {
                    ...this.courses[courseIndex],
                    name,
                    code,
                    deptId,
                    year,
                    credits,
                    type,
                    needsLab,
                    description,
                    updatedAt: new Date().toISOString()
                };
                SharedData.showToast('تم تحديث المادة بنجاح', 'success');
            }
        } else {
            // Add new course
            const newCourse = {
                id: SharedData.generateId(),
                name,
                code,
                deptId,
                year,
                credits,
                type,
                needsLab,
                description,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.courses.push(newCourse);
            SharedData.showToast('تمت إضافة المادة بنجاح', 'success');
        }

        this.saveData();
        this.clearForm();
        this.filterCourses(); // Refresh filters
        this.renderCoursesList(); // Refresh the list
        this.updateStats();
    }

    clearForm() {
        document.getElementById('courseForm').reset();
        this.currentEditId = null;
        document.getElementById('addCourseBtn').classList.remove('hidden');
        document.getElementById('cancelEditBtn').classList.add('hidden');
        document.getElementById('courseName').focus();
    }

    cancelEdit() {
        if (confirm('هل تريد إلغاء التعديل؟ سيتم فقدان التغييرات غير المحفوظة.')) {
            this.clearForm();
        }
    }

    editCourse(courseId) {
        const course = this.courses.find(c => c.id === courseId);
        if (!course) return;

        this.currentEditId = courseId;
        
        // Fill form with course data
        document.getElementById('courseName').value = course.name;
        document.getElementById('courseCode').value = course.code;
        document.getElementById('courseDept').value = course.deptId;
        document.getElementById('courseYear').value = course.year;
        document.getElementById('courseCredits').value = course.credits;
        document.getElementById('courseType').value = course.type;
        document.getElementById('needsLab').checked = course.needsLab;
        document.getElementById('courseDescription').value = course.description || '';

        // Update UI for edit mode
        document.getElementById('addCourseBtn').classList.add('hidden');
        document.getElementById('cancelEditBtn').classList.remove('hidden');
        
        // Scroll to form
        document.getElementById('courseForm').scrollIntoView({ behavior: 'smooth' });
    }

    deleteCourse(courseId) {
        if (!confirm('هل أنت متأكد من حذف هذه المادة؟ لا يمكن التراجع عن هذا الإجراء.')) {
            return;
        }

        this.courses = this.courses.filter(course => course.id !== courseId);
        this.saveData();
        this.filterCourses(); // Refresh filters
        this.renderCoursesList(); // Refresh the list
        this.updateStats();

        SharedData.showToast('تم حذف المادة بنجاح', 'success');
    }

    filterCourses(searchTerm = '') {
        const deptFilter = document.getElementById('filterDept')?.value || '';
        const yearFilter = document.getElementById('filterYear')?.value || '';
        const typeFilter = document.getElementById('filterType')?.value || '';

        this.filteredCourses = this.courses.filter(course => {
            // Apply filters
            if (deptFilter && course.deptId !== deptFilter) return false;
            if (yearFilter && course.year.toString() !== yearFilter) return false;
            if (typeFilter && course.type !== typeFilter) return false;

            // Apply search term
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    course.name.toLowerCase().includes(term) || 
                    course.code.toLowerCase().includes(term)
                );
            }

            return true;
        });

        this.currentPage = 1;
        this.renderCoursesList();
    }

    renderCoursesList() {
        const tableBody = document.querySelector('#coursesTable tbody');
        if (!tableBody) return;

        if (this.filteredCourses.length === 0) {
            tableBody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="8">
                        <div class="empty-table-message">
                            <p>لا توجد مواد مسجلة بعد</p>
                            <button id="addSampleCourses" class="btn-small btn-secondary">
                                إضافة مواد نموذجية
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            // Re-add event listener to sample button
            document.getElementById('addSampleCourses')?.addEventListener('click', () => {
                this.addSampleData();
            });
            
            return;
        }

        // Calculate pagination
        const startIdx = (this.currentPage - 1) * this.itemsPerPage;
        const paginatedCourses = this.filteredCourses.slice(startIdx, startIdx + this.itemsPerPage);

        tableBody.innerHTML = paginatedCourses.map(course => {
            const dept = SharedData.getDepartmentById(course.deptId);
            const deptName = dept ? dept.name : 'غير محدد';

            return `
                <tr data-course-id="${course.id}">
                    <td>${course.name}</td>
                    <td>${course.code}</td>
                    <td>${deptName}</td>
                    <td>السنة ${course.year}</td>
                    <td>${course.credits}</td>
                    <td>${this.getCourseTypeName(course.type)}</td>
                    <td>${course.needsLab ? 'نعم' : 'لا'}</td>
                    <td class="actions-cell">
                        <button class="btn-small btn-secondary edit-course-action" data-course-id="${course.id}">
                            <span class="icon">✏️</span>
                            <span class="text">تعديل</span>
                        </button>
                        <button class="btn-small btn-danger delete-course-action" data-course-id="${course.id}">
                            <span class="icon">🗑️</span>
                            <span class="text">حذف</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Add event listeners to action buttons
        document.querySelectorAll('.edit-course-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.editCourse(e.currentTarget.dataset.courseId);
            });
        });

        document.querySelectorAll('.delete-course-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteCourse(e.currentTarget.dataset.courseId);
            });
        });

        // Update pagination info
        this.updatePagination();
    }

    getCourseTypeName(type) {
        const types = {
            'required': 'إجبارية',
            'elective': 'اختيارية',
            'general': 'عامة'
        };
        return types[type] || type;
    }

    updatePagination() {
        const totalItems = this.filteredCourses.length;
        const totalPages = this.totalPages();
        const currentCount = Math.min(this.itemsPerPage, totalItems - (this.currentPage - 1) * this.itemsPerPage);

        document.getElementById('currentCount').textContent = currentCount;
        document.getElementById('totalCount').textContent = totalItems;
        document.getElementById('pageInfo').textContent = `الصفحة ${this.currentPage} من ${totalPages}`;

        // Disable/enable pagination buttons
        document.getElementById('prevPage').disabled = this.currentPage === 1;
        document.getElementById('nextPage').disabled = this.currentPage === totalPages;
    }

    totalPages() {
        return Math.ceil(this.filteredCourses.length / this.itemsPerPage);
    }

    updateStats() {
        const requiredCount = this.courses.filter(c => c.type === 'required').length;
        const labsCount = this.courses.filter(c => c.needsLab).length;
        const totalCredits = this.courses.reduce((sum, course) => sum + course.credits, 0);

        document.getElementById('coursesCount').textContent = this.courses.length;
        document.getElementById('requiredCount').textContent = requiredCount;
        document.getElementById('labsCount').textContent = labsCount;
        document.getElementById('totalCredits').textContent = totalCredits;
    }

    addSampleData() {
        const sampleCourses = [
            {
                name: "هيكلة البيانات",
                code: "CS201",
                deptId: SharedData.departments.length > 0 ? SharedData.departments[0].id : "",
                year: 2,
                credits: 3,
                type: "required",
                needsLab: true,
                description: "مادة أساسية في علوم الحاسب"
            },
            {
                name: "قواعد البيانات",
                code: "CS202",
                deptId: SharedData.departments.length > 0 ? SharedData.departments[0].id : "",
                year: 2,
                credits: 3,
                type: "required",
                needsLab: true,
                description: "مادة أساسية في نظم قواعد البيانات"
            },
            {
                name: "الذكاء الاصطناعي",
                code: "CS401",
                deptId: SharedData.departments.length > 0 ? SharedData.departments[0].id : "",
                year: 4,
                credits: 3,
                type: "elective",
                needsLab: false,
                description: "مادة اختيارية في الذكاء الاصطناعي"
            }
        ];

        // Only add courses that don't already exist (based on code)
        const coursesToAdd = sampleCourses.filter(sample => 
            !this.courses.some(c => c.code === sample.code)
        );

        if (coursesToAdd.length === 0) {
            SharedData.showToast('المواد النموذجية موجودة بالفعل', 'info');
            return;
        }

        coursesToAdd.forEach(course => {
            this.courses.push({
                ...course,
                id: SharedData.generateId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        });

        this.saveData();
        this.filterCourses();
        this.renderCoursesList();
        this.updateStats();

        SharedData.showToast(`تم إضافة ${coursesToAdd.length} مواد نموذجية`, 'success');
    }
}