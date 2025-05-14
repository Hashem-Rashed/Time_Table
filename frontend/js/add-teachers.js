// add-teachers.js - Final Version
// Handles basic teacher information (name and notes only)

document.addEventListener('DOMContentLoaded', () => {
    // Initialize after SharedData is ready
    if (window.SharedData) {
        initTeacherPage();
    } else {
        document.addEventListener('SharedDataReady', initTeacherPage);
    }
});

/**
 * Initialize the teacher management page
 */
function initTeacherPage() {
    // Ensure SharedData is properly initialized
    if (!window.SharedData) {
        console.error('SharedData not loaded - make sure shared.js is loaded first');
        return;
    }

    // Initialize basicTeachers array if it doesn't exist
    if (!SharedData.basicTeachers) {
        SharedData.basicTeachers = [];
        
        // Migrate existing teachers if any
        if (SharedData.teachers && SharedData.teachers.length > 0) {
            SharedData.basicTeachers = SharedData.teachers.map(teacher => ({
                id: teacher.id,
                name: teacher.name,
                notes: teacher.notes || '',
                createdAt: teacher.createdAt || new Date().toISOString(),
                updatedAt: teacher.updatedAt || new Date().toISOString()
            }));
            SharedData.saveToLocalStorage();
        }
    }

    // Set up form and display
    setupTeacherForm();
    displayTeachersTable();

    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
}

/**
 * Set up the teacher form submission
 */
function setupTeacherForm() {
    const form = document.getElementById('teacherForm');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTeacher();
    });

    // Clear form button
    document.getElementById('clearFormBtn').addEventListener('click', () => {
        resetForm();
    });

    // Cancel edit button
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
        resetForm();
    });
}

/**
 * Save teacher (add new or update existing)
 */
function saveTeacher() {
    const idInput = document.getElementById('teacherId');
    const nameInput = document.getElementById('teacherName');
    const notesInput = document.getElementById('teacherNotes');

    // Basic validation
    if (!nameInput.value.trim()) {
        SharedData.showToast('اسم المدرس مطلوب', 'error');
        nameInput.focus();
        return;
    }

    // Check for duplicate names (case insensitive)
    const duplicate = SharedData.basicTeachers.find(
        teacher => teacher.name.toLowerCase() === nameInput.value.trim().toLowerCase() && 
                  teacher.id !== idInput.value
    );
    
    if (duplicate) {
        SharedData.showToast('اسم المدرس موجود بالفعل', 'error');
        nameInput.focus();
        return;
    }

    const teacherData = {
        id: idInput.value || SharedData.generateId(),
        name: nameInput.value.trim(),
        notes: notesInput.value.trim(),
        updatedAt: new Date().toISOString()
    };

    if (idInput.value) {
        // Update existing teacher
        updateTeacher(teacherData);
    } else {
        // Add new teacher
        addTeacher(teacherData);
    }
}

/**
 * Add a new teacher to the system
 */
function addTeacher(teacherData) {
    teacherData.createdAt = new Date().toISOString();
    
    // Add to basicTeachers
    SharedData.basicTeachers.push(teacherData);
    SharedData.saveToLocalStorage();

    // Show success message
    SharedData.showToast('تم إضافة المدرس بنجاح', 'success');

    // Reset form and update table
    resetForm();
    displayTeachersTable();
}

/**
 * Update an existing teacher
 */
function updateTeacher(teacherData) {
    const teacherIndex = SharedData.basicTeachers.findIndex(t => t.id === teacherData.id);
    
    if (teacherIndex === -1) {
        SharedData.showToast('لم يتم العثور على المدرس', 'error');
        return;
    }

    // Preserve creation date
    teacherData.createdAt = SharedData.basicTeachers[teacherIndex].createdAt;
    
    // Update teacher data
    SharedData.basicTeachers[teacherIndex] = teacherData;
    SharedData.saveToLocalStorage();
    
    // Update extended teacher data if exists
    const extendedIndex = SharedData.teachers.findIndex(t => t.id === teacherData.id);
    if (extendedIndex !== -1) {
        SharedData.teachers[extendedIndex].name = teacherData.name;
        SharedData.teachers[extendedIndex].notes = teacherData.notes;
    }

    SharedData.showToast('تم تحديث بيانات المدرس بنجاح', 'success');
    
    // Reset form and update table
    resetForm();
    displayTeachersTable();
}

/**
 * Delete a teacher from the system
 */
function deleteTeacher(teacherId) {
    if (!confirm('هل أنت متأكد من حذف هذا المدرس؟ سيتم حذفه من جميع الأماكن ولا يمكن التراجع عن هذه العملية.')) {
        return;
    }

    // Check if teacher is used in extended data
    const isUsedInExtended = SharedData.teachers.some(t => t.id === teacherId);
    if (isUsedInExtended) {
        if (!confirm('تحذير: هذا المدرس مستخدم في بيانات المدرسين الموسعة. هل تريد المتابعة في الحذف؟')) {
            return;
        }
    }

    // Remove from basic teachers
    const basicIndex = SharedData.basicTeachers.findIndex(t => t.id === teacherId);
    if (basicIndex !== -1) {
        SharedData.basicTeachers.splice(basicIndex, 1);
    }

    // Remove from extended teachers if exists
    const extendedIndex = SharedData.teachers.findIndex(t => t.id === teacherId);
    if (extendedIndex !== -1) {
        SharedData.teachers.splice(extendedIndex, 1);
    }

    SharedData.saveToLocalStorage();
    SharedData.showToast('تم حذف المدرس بنجاح', 'success');
    
    // Update table
    displayTeachersTable();
}

/**
 * Edit a teacher - load data into form
 */
function editTeacher(teacherId) {
    const teacher = SharedData.basicTeachers.find(t => t.id === teacherId);
    
    if (!teacher) {
        SharedData.showToast('لم يتم العثور على المدرس', 'error');
        return;
    }

    // Fill form with teacher data
    document.getElementById('teacherId').value = teacher.id;
    document.getElementById('teacherName').value = teacher.name;
    document.getElementById('teacherNotes').value = teacher.notes || '';

    // Change button states
    document.getElementById('saveTeacherBtn').querySelector('.text').textContent = 'تحديث';
    document.getElementById('cancelEditBtn').classList.remove('hidden');
    
    // Scroll to form and focus on name field
    document.getElementById('teacherForm').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('teacherName').focus();
}

/**
 * Reset the form to its initial state
 */
function resetForm() {
    document.getElementById('teacherForm').reset();
    document.getElementById('teacherId').value = '';
    document.getElementById('saveTeacherBtn').querySelector('.text').textContent = 'حفظ';
    document.getElementById('cancelEditBtn').classList.add('hidden');
    document.getElementById('teacherName').focus();
}

/**
 * Display teachers in the table
 */
function displayTeachersTable() {
    const tbody = document.querySelector('#teachersTable tbody');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    // Add each teacher to the table
    SharedData.basicTeachers.forEach((teacher, index) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${teacher.name}</td>
            <td>${teacher.notes || '-'}</td>
            <td class="actions-cell">
                <button class="btn-small btn-edit" data-id="${teacher.id}" aria-label="تعديل">
                    <span class="icon">✏️</span>
                </button>
                <button class="btn-small btn-delete" data-id="${teacher.id}" aria-label="حذف">
                    <span class="icon">🗑️</span>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });

    // Add event listeners to action buttons
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            editTeacher(e.currentTarget.dataset.id);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteTeacher(e.currentTarget.dataset.id);
        });
    });

    // Show message if no teachers
    if (SharedData.basicTeachers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-table-message">لا يوجد مدرسين مسجلين بعد</td>
            </tr>
        `;
    }
}

// Handle storage events for cross-tab synchronization
window.addEventListener('storage', (e) => {
    if (e.key === SharedData.STORAGE_KEY && e.newValue) {
        try {
            const newData = JSON.parse(e.newValue);
            if (newData.basicTeachers) {
                SharedData.basicTeachers = newData.basicTeachers;
                displayTeachersTable();
            }
        } catch (error) {
            console.error('Error processing storage event:', error);
        }
    }
});