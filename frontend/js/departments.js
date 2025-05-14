// departments.js - Department Management (Updated for SharedData consistency)

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the departments manager
    if (!window.departmentsManager) {
        window.departmentsManager = new DepartmentsManager();
    }
    window.departmentsManager.init();
});

/**
 * Departments Manager Class (Updated)
 */
class DepartmentsManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentEditId = null;
        this.filteredDepartments = [];
    }

    /**
     * Initialize the departments manager
     */
    init() {
        // Load departments and update UI
        this.loadDepartments();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize department form
        this.initDepartmentForm();
    }

    /**
     * Load departments from SharedData
     */
    loadDepartments() {
        // Update filtered departments (initially all departments)
        this.filteredDepartments = [...SharedData.departments];
        
        // Update UI
        this.updateDepartmentsTable();
        this.updateStats();
    }

    /**
     * Set up event listeners (Updated)
     */
    setupEventListeners() {
        // Department form submission
        document.getElementById('departmentForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleDepartmentSubmit();
        });

        // Clear form button
        document.getElementById('clearFormBtn')?.addEventListener('click', () => {
            this.clearDepartmentForm();
        });

        // Cancel edit button
        document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
            this.cancelEdit();
        });

        // Search functionality
        document.getElementById('deptSearch')?.addEventListener('input', (e) => {
            this.filterDepartments(e.target.value);
        });

        // Pagination buttons
        document.getElementById('prevPage')?.addEventListener('click', () => {
            this.prevPage();
        });

        document.getElementById('nextPage')?.addEventListener('click', () => {
            this.nextPage();
        });

        // Export departments button
        document.getElementById('exportDeptsBtn')?.addEventListener('click', () => {
            this.exportDepartments();
        });

        // Add sample departments button
        document.getElementById('addSampleDepts')?.addEventListener('click', () => {
            this.addSampleDepartments();
        });

        // Context menu event listeners
        this.setupContextMenu();
    }

    /**
     * Initialize department form
     */
    initDepartmentForm() {
        // Color picker interaction
        const colorInput = document.getElementById('deptColor');
        const colorPreview = document.getElementById('colorPreview');
        
        if (colorInput && colorPreview) {
            colorInput.addEventListener('input', () => {
                colorPreview.style.backgroundColor = colorInput.value;
            });
        }
    }

    /**
     * Handle department form submission (Updated)
     */
    handleDepartmentSubmit() {
        // Get form values
        const name = document.getElementById('deptName').value.trim();
        const code = document.getElementById('deptCode').value.trim().toUpperCase();
        const color = document.getElementById('deptColor').value;
        
        // Clear previous errors
        document.querySelectorAll('.error-message').forEach(el => el.remove());
        
        // Validate inputs
        let isValid = true;
        
        if (!name) {
            this.showFormError('deptName', 'اسم القسم مطلوب');
            isValid = false;
        }
        
        if (!code) {
            this.showFormError('deptCode', 'كود القسم مطلوب');
            isValid = false;
        } else if (code.length < 2 || code.length > 6) {
            this.showFormError('deptCode', 'يجب أن يكون كود القسم بين 2 و 6 أحرف');
            isValid = false;
        }
        
        if (!isValid) return;
        
        // Check if code is already used (except when editing the same department)
        const codeExists = SharedData.departments.some(
            dept => dept.code === code && dept.id !== this.currentEditId
        );
        
        if (codeExists) {
            this.showFormError('deptCode', 'كود القسم هذا مستخدم بالفعل، الرجاء اختيار كود آخر');
            return;
        }
        
        // If editing an existing department
        if (this.currentEditId) {
            const deptIndex = SharedData.departments.findIndex(dept => dept.id === this.currentEditId);
            if (deptIndex !== -1) {
                SharedData.departments[deptIndex] = {
                    ...SharedData.departments[deptIndex],
                    name,
                    code,
                    color,
                    updatedAt: new Date().toISOString()
                };
                
                // Show success message
                SharedData.showToast('تم تحديث القسم بنجاح', 'success');
            }
        } 
        // If adding a new department
        else {
            const newDept = {
                id: SharedData.generateId(),
                name,
                code,
                color,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            SharedData.departments.push(newDept);
            
            // Show success message
            SharedData.showToast('تم إضافة القسم بنجاح', 'success');
        }
        
        // Save to SharedData and localStorage
        SharedData.saveToLocalStorage();
        
        // Update UI
        this.loadDepartments();
        this.clearDepartmentForm();
    }

    /**
     * Show form error message
     */
    showFormError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        // Remove existing error if any
        const existingError = field.nextElementSibling;
        if (existingError && existingError.classList.contains('error-message')) {
            existingError.remove();
        }
        
        // Create error element
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = message;
        errorEl.style.color = 'var(--accent-color)';
        errorEl.style.marginTop = '5px';
        errorEl.style.fontSize = '0.8em';
        
        // Insert after the field
        field.insertAdjacentElement('afterend', errorEl);
        
        // Focus on the field
        field.focus();
    }

    /**
     * Clear the department form
     */
    clearDepartmentForm() {
        document.getElementById('deptName').value = '';
        document.getElementById('deptCode').value = '';
        document.getElementById('deptColor').value = '#8e44ad';
        document.getElementById('colorPreview').style.backgroundColor = '#8e44ad';
        
        // Clear any error messages
        document.querySelectorAll('.error-message').forEach(el => el.remove());
        
        // Reset edit mode if active
        if (this.currentEditId) {
            this.cancelEdit();
        }
    }

    /**
     * Edit a department (Updated)
     */
    editDepartment(id) {
        const dept = SharedData.getDepartmentById(id);
        if (!dept) return;
        
        // Set form values
        document.getElementById('deptName').value = dept.name;
        document.getElementById('deptCode').value = dept.code;
        document.getElementById('deptColor').value = dept.color || '#8e44ad';
        document.getElementById('colorPreview').style.backgroundColor = dept.color || '#8e44ad';
        
        // Change submit button text
        document.getElementById('submitBtnText').textContent = 'تحديث القسم';
        
        // Show cancel button
        document.getElementById('cancelEditBtn').classList.remove('hidden');
        
        // Set current edit ID
        this.currentEditId = id;
        
        // Scroll to form
        document.getElementById('departmentForm').scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Cancel edit mode
     */
    cancelEdit() {
        this.currentEditId = null;
        this.clearDepartmentForm();
        document.getElementById('submitBtnText').textContent = 'إضافة قسم';
        document.getElementById('cancelEditBtn').classList.add('hidden');
    }

    /**
     * Delete a department (Updated)
     */
    deleteDepartment(id) {
        if (!confirm('هل أنت متأكد من حذف هذا القسم؟ سيتم حذف جميع المدرسين المرتبطين بهذا القسم.')) {
            return;
        }
        
        // Find department index
        const deptIndex = SharedData.departments.findIndex(d => d.id === id);
        if (deptIndex === -1) return;
        
        // Check if any teachers are assigned to this department
        const teachersInDept = SharedData.teachers.filter(t => t.department === id);
        if (teachersInDept.length > 0) {
            if (!confirm(`هناك ${teachersInDept.length} مدرس مرتبط بهذا القسم. سيتم إزالة القسم منهم. هل تريد المتابعة؟`)) {
                return;
            }
            
            // Remove department from teachers
            teachersInDept.forEach(teacher => {
                teacher.department = '';
            });
        }
        
        // Remove department
        SharedData.departments.splice(deptIndex, 1);
        
        // Save changes
        SharedData.saveToLocalStorage();
        
        // Update UI
        this.loadDepartments();
        SharedData.showToast('تم حذف القسم بنجاح', 'success');
    }

    /**
     * Filter departments by search term (Updated)
     */
    filterDepartments(searchTerm = '') {
        if (!searchTerm) {
            this.filteredDepartments = [...SharedData.departments];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredDepartments = SharedData.departments.filter(dept => 
                dept.name.toLowerCase().includes(term) || 
                dept.code.toLowerCase().includes(term)
            );
        }
        
        // Reset to first page when filtering
        this.currentPage = 1;
        
        // Update table
        this.updateDepartmentsTable();
    }

    /**
     * Update the departments table with current data (Updated)
     */
    updateDepartmentsTable() {
        const tableBody = document.querySelector('#departmentsTable tbody');
        if (!tableBody) return;
        
        // If no departments, show empty message
        if (this.filteredDepartments.length === 0) {
            tableBody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="6">
                        <div class="empty-table-message">
                            <p>لا توجد أقسام مسجلة بعد</p>
                            <button id="addSampleDepts" class="btn-small btn-secondary">
                                إضافة أقسام نموذجية
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            // Re-add event listener to sample button
            document.getElementById('addSampleDepts')?.addEventListener('click', () => {
                this.addSampleDepartments();
            });
            
            // Update pagination info
            this.updatePaginationInfo();
            return;
        }
        
        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedDepts = this.filteredDepartments.slice(startIndex, endIndex);
        
        // Generate table rows
        tableBody.innerHTML = paginatedDepts.map(dept => {
            // Count teachers in this department
            const teacherCount = SharedData.teachers.filter(t => t.department === dept.id).length;
            
            // Count rooms in this department
            const roomCount = SharedData.rooms.filter(r => r.department === dept.id).length;
            
            return `
                <tr data-id="${dept.id}">
                    <td>
                        <span class="dept-color-badge" style="background-color: ${dept.color || '#8e44ad'};"></span>
                        ${dept.name}
                    </td>
                    <td>${dept.code}</td>
                    <td>${teacherCount}</td>
                    <td>${roomCount}</td>
                    <td>
                        <button class="btn-small btn-secondary edit-dept" data-id="${dept.id}" aria-label="تعديل ${dept.name}">
                            <span class="icon">✏️</span>
                            <span class="text">تعديل</span>
                        </button>
                        <button class="btn-small btn-danger delete-dept" data-id="${dept.id}" aria-label="حذف ${dept.name}">
                            <span class="icon">🗑️</span>
                            <span class="text">حذف</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Add event listeners to action buttons
        document.querySelectorAll('.edit-dept').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.editDepartment(e.currentTarget.dataset.id);
            });
        });
        
        document.querySelectorAll('.delete-dept').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteDepartment(e.currentTarget.dataset.id);
            });
        });
        
        // Update pagination info
        this.updatePaginationInfo();
    }

    /**
     * Update the statistics cards (Updated)
     */
    updateStats() {
        document.getElementById('deptCount').textContent = SharedData.departments.length;
        
        // Count teachers across all departments
        document.getElementById('teacherCount').textContent = SharedData.teachers.length;
        
        // Count rooms across all departments
        document.getElementById('roomCount').textContent = SharedData.rooms.length;
    }

    /**
     * Update pagination information
     */
    updatePaginationInfo() {
        const totalPages = Math.ceil(this.filteredDepartments.length / this.itemsPerPage);
        
        // Update current/total count
        const startCount = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endCount = Math.min(this.currentPage * this.itemsPerPage, this.filteredDepartments.length);
        
        document.getElementById('currentCount').textContent = endCount > 0 ? startCount : 0;
        document.getElementById('totalCount').textContent = this.filteredDepartments.length;
        
        // Update page info
        document.getElementById('pageInfo').textContent = `الصفحة ${this.currentPage}`;
        
        // Enable/disable pagination buttons
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
    }

    /**
     * Go to previous page
     */
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateDepartmentsTable();
        }
    }

    /**
     * Go to next page
     */
    nextPage() {
        const totalPages = Math.ceil(this.filteredDepartments.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.updateDepartmentsTable();
        }
    }

    /**
     * Export departments to Excel/CSV (Updated)
     */
    exportDepartments() {
        if (SharedData.departments.length === 0) {
            SharedData.showToast('لا توجد أقسام لتصديرها', 'warning');
            return;
        }
        
        // Prepare CSV content
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Add headers
        csvContent += "اسم القسم,كود القسم,عدد المدرسين,عدد القاعات,تاريخ الإنشاء\n";
        
        // Add department data
        SharedData.departments.forEach(dept => {
            const teacherCount = SharedData.teachers.filter(t => t.department === dept.id).length;
            const roomCount = SharedData.rooms.filter(r => r.department === dept.id).length;
            
            csvContent += `"${dept.name}","${dept.code}",${teacherCount},${roomCount},"${dept.createdAt}"\n`;
        });
        
        // Create download link
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "الأقسام_الدراسية.csv");
        document.body.appendChild(link);
        
        // Trigger download
        link.click();
        
        // Clean up
        document.body.removeChild(link);
        
        SharedData.showToast('تم تصدير الأقسام بنجاح', 'success');
    }

    /**
     * Add sample departments for demonstration (Updated)
     */
    addSampleDepartments() {
        if (SharedData.departments.length > 0 && 
            !confirm('هذا سيضيف أقساماً نموذجية إلى الأقسام الحالية. هل تريد المتابعة؟')) {
            return;
        }
        
        const sampleDepts = [
            { name: "علوم الحاسب", code: "CS", color: "#3498db" },
            { name: "الرياضيات", code: "MATH", color: "#e74c3c" },
            { name: "الفيزياء", code: "PHYS", color: "#2ecc71" },
            { name: "الكيمياء", code: "CHEM", color: "#f39c12" },
            { name: "الأحياء", code: "BIO", color: "#9b59b6" }
        ];
        
        sampleDepts.forEach(dept => {
            if (!SharedData.departments.some(d => d.code === dept.code)) {
                SharedData.departments.push({
                    ...dept,
                    id: SharedData.generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        });
        
        // Save and update UI
        SharedData.saveToLocalStorage();
        this.loadDepartments();
        SharedData.showToast('تم إضافة الأقسام النموذجية', 'success');
    }

    /**
     * Set up context menu for department actions
     */
    setupContextMenu() {
        const contextMenu = document.getElementById('contextMenu');
        if (!contextMenu) return;
        
        let selectedDeptId = null;
        
        
        // Context menu actions
        document.getElementById('ctxEdit')?.addEventListener('click', () => {
            if (selectedDeptId) {
                this.editDepartment(selectedDeptId);
            }
        });
        
        document.getElementById('ctxDelete')?.addEventListener('click', () => {
            if (selectedDeptId) {
                this.deleteDepartment(selectedDeptId);
            }
        });
        
        document.getElementById('ctxViewTeachers')?.addEventListener('click', () => {
            if (selectedDeptId) {
                // Store the department filter and redirect to teachers page
                localStorage.setItem('deptFilter', selectedDeptId);
                window.location.href = 'teachers.html';
            }
        });
        
        document.getElementById('ctxViewRooms')?.addEventListener('click', () => {
            if (selectedDeptId) {
                // Store the department filter and redirect to rooms page
                localStorage.setItem('deptFilter', selectedDeptId);
                window.location.href = 'rooms.html';
            }
        });
    }
}