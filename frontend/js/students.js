// students.js - Complete Fixed Version

document.addEventListener('DOMContentLoaded', () => {
    window.studentsManager = new StudentsManager();
    studentsManager.init();
});

class StudentsManager {
    constructor() {
        this.years = [];
        this.filteredYears = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentEditId = null;
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.renderDepartmentsDropdown();
        this.updateStats();
        this.renderYearsList();
    }

    loadData() {
        this.years = SharedData.studentYears || [];
        this.filteredYears = [...this.years];
    }

    saveData() {
        SharedData.studentYears = this.years;
        SharedData.saveToLocalStorage();
    }

    setupEventListeners() {
        // Form submissions
        document.getElementById('yearForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleYearFormSubmit();
        });

        document.getElementById('groupForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleGroupFormSubmit();
        });

        // Clear forms
        document.getElementById('clearFormBtn')?.addEventListener('click', () => {
            this.clearYearForm();
        });

        document.getElementById('clearGroupFormBtn')?.addEventListener('click', () => {
            this.clearGroupForm();
        });

        // Search and filter
        document.getElementById('yearSearch')?.addEventListener('input', (e) => {
            this.filterYears(e.target.value);
        });

        document.getElementById('filterDept')?.addEventListener('change', () => {
            this.filterYears();
        });

        document.getElementById('filterLevel')?.addEventListener('change', () => {
            this.filterYears();
        });

        // Pagination
        document.getElementById('prevPage')?.addEventListener('click', () => {
            this.prevPage();
        });

        document.getElementById('nextPage')?.addEventListener('click', () => {
            this.nextPage();
        });

        // Event delegation for dynamic elements
        document.addEventListener('click', (e) => {
            // Sample data button
            if (e.target.id === 'addSampleData' || e.target.closest('#addSampleData')) {
                this.handleAddSampleData();
            }
            
            // Delete year buttons
            if (e.target.classList.contains('delete-year') || e.target.closest('.delete-year')) {
                const btn = e.target.classList.contains('delete-year') ? e.target : e.target.closest('.delete-year');
                this.deleteYear(btn.dataset.id);
            }
            
            // Delete group buttons
            if (e.target.classList.contains('delete-group') || e.target.closest('.delete-group')) {
                const btn = e.target.classList.contains('delete-group') ? e.target : e.target.closest('.delete-group');
                this.deleteGroup(btn.dataset.yearId, btn.dataset.groupId);
            }
            
            // Add group buttons
            if (e.target.classList.contains('add-group') || e.target.closest('.add-group')) {
                const btn = e.target.classList.contains('add-group') ? e.target : e.target.closest('.add-group');
                document.getElementById('groupYear').value = btn.dataset.yearId;
                document.getElementById('groupName').focus();
            }
            
            // Edit year buttons
            if (e.target.classList.contains('edit-year') || e.target.closest('.edit-year')) {
                const btn = e.target.classList.contains('edit-year') ? e.target : e.target.closest('.edit-year');
                this.editYear(btn.dataset.id);
            }
        });

        // Keyboard navigation
        document.getElementById('yearForm')?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.clearYearForm();
        });

        document.getElementById('groupForm')?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.clearGroupForm();
        });
    }

    handleAddSampleData() {
        if (SharedData.departments.length === 0) {
            SharedData.showToast('الرجاء إضافة قسم واحد على الأقل أولاً', 'error');
            return;
        }

        const defaultDeptId = SharedData.departments[0].id;

        const sampleYears = [
            {
                name: "السنة الأولى",
                level: 1,
                deptId: defaultDeptId,
                groups: [
                    { name: "الفرقة أ", code: "G1", students: 30 },
                    { name: "الفرقة ب", code: "G2", students: 28 }
                ]
            },
            {
                name: "السنة الثانية",
                level: 2,
                deptId: defaultDeptId,
                groups: [
                    { name: "الفرقة أ", code: "G1", students: 25 },
                    { name: "الفرقة ب", code: "G2", students: 27 }
                ]
            }
        ];

        SharedData.showConfirmationDialog(
            'إضافة بيانات نموذجية',
            'هل تريد إضافة بيانات نموذجية للطلاب؟ سيتم إنشاء سنتين دراسيتين مع فرق لكل منهما.',
            () => {
                sampleYears.forEach(sample => {
                    if (!this.years.some(y => y.name === sample.name && y.deptId === sample.deptId)) {
                        const newYear = {
                            id: SharedData.generateId(),
                            name: sample.name,
                            level: sample.level,
                            deptId: sample.deptId,
                            groups: sample.groups.map(g => ({
                                ...g,
                                id: SharedData.generateId(),
                                createdAt: new Date().toISOString()
                            })),
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        this.years.push(newYear);
                    }
                });

                this.saveData();
                this.filterYears(); // Refresh the display
                this.renderDepartmentsDropdown();
                this.updateStats();
                SharedData.showToast('تمت إضافة البيانات النموذجية بنجاح', 'success');
            }
        );
    }

    renderDepartmentsDropdown() {
        const dropdowns = [
            document.getElementById('yearDept'),
            document.getElementById('filterDept'),
            document.getElementById('groupYear')
        ];

        dropdowns.forEach((dropdown, index) => {
            if (!dropdown) return;

            dropdown.innerHTML = '';
            
            if (index === 0) {
                dropdown.appendChild(this.createOption('', 'اختر القسم...'));
            } else if (index === 1) {
                dropdown.appendChild(this.createOption('', 'جميع الأقسام'));
            } else {
                dropdown.appendChild(this.createOption('', 'اختر السنة...'));
            }

            if (index === 2) {
                this.years.forEach(year => {
                    const dept = SharedData.getDepartmentById(year.deptId);
                    const deptName = dept ? dept.name : 'غير محدد';
                    dropdown.appendChild(this.createOption(
                        year.id,
                        `${year.name} (${deptName})`
                    ));
                });
            } else {
                SharedData.departments.forEach(dept => {
                    dropdown.appendChild(this.createOption(
                        dept.id,
                        `${dept.name} (${dept.code})`
                    ));
                });
            }
        });
    }

    createOption(value, text) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        return option;
    }

    handleYearFormSubmit() {
        const name = document.getElementById('yearName').value.trim();
        const level = parseInt(document.getElementById('yearLevel').value);
        const deptId = document.getElementById('yearDept').value;
        const defaultGroups = parseInt(document.getElementById('defaultGroups').value) || 1;

        if (!name || isNaN(level) || !deptId) {
            SharedData.showToast('الرجاء ملء جميع الحقول المطلوبة', 'error');
            return;
        }

        if (this.currentEditId) {
            const yearIndex = this.years.findIndex(y => y.id === this.currentEditId);
            if (yearIndex !== -1) {
                this.years[yearIndex] = {
                    ...this.years[yearIndex],
                    name,
                    level,
                    deptId,
                    updatedAt: new Date().toISOString()
                };
                SharedData.showToast('تم تحديث السنة الدراسية بنجاح', 'success');
            }
        } else {
            const newYear = {
                id: SharedData.generateId(),
                name,
                level,
                deptId,
                groups: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            for (let i = 0; i < defaultGroups; i++) {
                const groupLetter = String.fromCharCode(65 + i);
                newYear.groups.push(this.createDefaultGroup(groupLetter));
            }

            this.years.push(newYear);
            SharedData.showToast('تمت إضافة السنة الدراسية بنجاح', 'success');
        }

        this.saveData();
        this.filterYears(); // Refresh the display
        this.renderDepartmentsDropdown();
        this.updateStats();
        this.clearYearForm();
    }

    createDefaultGroup(letter) {
        return {
            id: SharedData.generateId(),
            name: `الفرقة ${letter}`,
            code: `G${letter}`,
            students: 30,
            createdAt: new Date().toISOString()
        };
    }

    handleGroupFormSubmit() {
        const yearId = document.getElementById('groupYear').value;
        const name = document.getElementById('groupName').value.trim();
        const code = document.getElementById('groupCode').value.trim().toUpperCase();
        const students = parseInt(document.getElementById('groupStudents').value) || 0;

        if (!yearId || !name || students <= 0) {
            SharedData.showToast('الرجاء ملء جميع الحقول المطلوبة', 'error');
            return;
        }

        const year = this.years.find(y => y.id === yearId);
        if (!year) {
            SharedData.showToast('السنة الدراسية المحددة غير موجودة', 'error');
            return;
        }

        if (code && year.groups.some(g => g.code === code)) {
            SharedData.showToast('كود الفرقة مستخدم بالفعل', 'error');
            return;
        }

        const newGroup = {
            id: SharedData.generateId(),
            name,
            code: code || `G${year.groups.length + 1}`,
            students,
            createdAt: new Date().toISOString()
        };

        year.groups.push(newGroup);
        this.saveData();
        
        // Refresh the display immediately
        this.filterYears(document.getElementById('yearSearch').value);
        this.updateStats();
        this.clearGroupForm();

        SharedData.showToast('تمت إضافة الفرقة بنجاح', 'success');
        
        // Scroll to and highlight the new group
        setTimeout(() => {
            const newGroupElement = document.querySelector(`[data-id="${newGroup.id}"]`);
            if (newGroupElement) {
                newGroupElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                newGroupElement.classList.add('highlight-new');
                setTimeout(() => newGroupElement.classList.remove('highlight-new'), 2000);
            }
        }, 100);
    }

    clearYearForm() {
        document.getElementById('yearForm').reset();
        this.currentEditId = null;
        const addYearBtn = document.getElementById('addYearBtn');
        addYearBtn.innerHTML = '<span class="icon">➕</span><span class="text">إضافة سنة</span>';
    }

    clearGroupForm() {
        document.getElementById('groupForm').reset();
    }

    filterYears(searchTerm = '') {
        const deptFilter = document.getElementById('filterDept')?.value || '';
        const levelFilter = document.getElementById('filterLevel')?.value || '';

        this.filteredYears = this.years.filter(year => {
            if (deptFilter && year.deptId !== deptFilter) return false;
            if (levelFilter && year.level.toString() !== levelFilter) return false;
            
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const yearMatches = year.name.toLowerCase().includes(term);
                const groupMatches = year.groups.some(group => 
                    group.name.toLowerCase().includes(term) || 
                    (group.code && group.code.toLowerCase().includes(term))
                );
                return yearMatches || groupMatches;
            }
            
            return true;
        });

        this.currentPage = 1;
        this.renderYearsList();
    }

    renderYearsList() {
        const container = document.getElementById('yearsContainer');
        if (!container) return;

        if (this.filteredYears.length === 0) {
            container.innerHTML = `
                <div class="empty-message">
                    <p>لا توجد سنوات دراسية مسجلة</p>
                    <button id="addSampleData" class="btn-small btn-secondary">
                        إضافة بيانات نموذجية
                    </button>
                </div>
            `;
            return;
        }

        const startIdx = (this.currentPage - 1) * this.itemsPerPage;
        const paginatedYears = this.filteredYears.slice(startIdx, startIdx + this.itemsPerPage);

        container.innerHTML = paginatedYears.map(year => {
            const dept = SharedData.getDepartmentById(year.deptId);
            const deptName = dept ? dept.name : 'غير محدد';

            return `
                <div class="year-card" data-year-id="${year.id}">
                    <div class="year-header">
                        <h3>${year.name} (المستوى ${year.level})</h3>
                        <span class="dept-name">${deptName}</span>
                        <div class="year-actions">
                            <button class="btn-small btn-secondary edit-year" data-id="${year.id}">
                                <span class="icon">✏️</span>
                                تعديل
                            </button>
                            <button class="btn-small btn-danger delete-year" data-id="${year.id}">
                                <span class="icon">🗑️</span>
                                حذف
                            </button>
                        </div>
                    </div>
                    
                    <div class="groups-list">
                        ${year.groups.map(group => `
                            <div class="group-item" data-id="${group.id}">
                                <span class="group-name">${group.name}</span>
                                ${group.code ? `<span class="group-code">(${group.code})</span>` : ''}
                                <span class="group-students">${group.students} طالب</span>
                                <button class="btn-small btn-danger delete-group" 
                                        data-year-id="${year.id}" 
                                        data-group-id="${group.id}">
                                    <span class="icon">🗑️</span>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    
                    <button class="btn-small btn-primary add-group" data-year-id="${year.id}">
                        <span class="icon">➕</span>
                        إضافة فرقة
                    </button>
                </div>
            `;
        }).join('');

        this.updatePagination();
    }

    editYear(yearId) {
        const year = this.years.find(y => y.id === yearId);
        if (!year) return;

        this.currentEditId = yearId;
        
        document.getElementById('yearName').value = year.name;
        document.getElementById('yearLevel').value = year.level;
        document.getElementById('yearDept').value = year.deptId;
        
        const addYearBtn = document.getElementById('addYearBtn');
        addYearBtn.innerHTML = '<span class="icon">✏️</span><span class="text">تحديث السنة</span>';
        document.getElementById('yearName').focus();
    }

    deleteYear(yearId) {
        SharedData.showConfirmationDialog(
            'حذف السنة الدراسية',
            'هل أنت متأكد من حذف هذه السنة الدراسية؟ سيتم حذف جميع الفرق التابعة لها.',
            () => {
                this.years = this.years.filter(y => y.id !== yearId);
                this.saveData();
                this.filterYears(); // Refresh the display
                this.renderDepartmentsDropdown();
                this.updateStats();
                SharedData.showToast('تم حذف السنة الدراسية بنجاح', 'success');
            },
            () => {
                SharedData.showToast('تم إلغاء عملية الحذف', 'info');
            }
        );
    }

    deleteGroup(yearId, groupId) {
        SharedData.showConfirmationDialog(
            'حذف الفرقة',
            'هل أنت متأكد من حذف هذه الفرقة؟',
            () => {
                const year = this.years.find(y => y.id === yearId);
                if (year) {
                    year.groups = year.groups.filter(g => g.id !== groupId);
                    this.saveData();
                    this.filterYears(); // Refresh the display
                    this.updateStats();
                    SharedData.showToast('تم حذف الفرقة بنجاح', 'success');
                }
            },
            () => {
                SharedData.showToast('تم إلغاء عملية الحذف', 'info');
            }
        );
    }

    updatePagination() {
        const totalItems = this.filteredYears.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const currentCount = Math.min(
            this.itemsPerPage, 
            totalItems - (this.currentPage - 1) * this.itemsPerPage
        );

        document.getElementById('currentCount').textContent = currentCount;
        document.getElementById('totalCount').textContent = totalItems;
        document.getElementById('pageInfo').textContent = `الصفحة ${this.currentPage} من ${totalPages}`;

        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderYearsList();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages()) {
            this.currentPage++;
            this.renderYearsList();
        }
    }

    totalPages() {
        return Math.ceil(this.filteredYears.length / this.itemsPerPage);
    }

    updateStats() {
        const totalGroups = this.years.reduce((sum, year) => sum + year.groups.length, 0);
        const totalStudents = this.years.reduce((sum, year) => 
            sum + year.groups.reduce((gSum, group) => gSum + (group.students || 0), 0), 0);

        document.getElementById('deptsCount').textContent = SharedData.departments.length;
        document.getElementById('yearsCount').textContent = this.years.length;
        document.getElementById('groupsCount').textContent = totalGroups;
        document.getElementById('totalStudents').textContent = totalStudents;
    }
}