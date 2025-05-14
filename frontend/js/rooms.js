// rooms.js - Combined Rooms and Labs Management Script (Updated)

document.addEventListener('DOMContentLoaded', () => {
    window.roomsManager = new RoomsManager();
    roomsManager.init();
});

class RoomsManager {
    constructor() {
        this.currentView = 'table';
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filteredPlaces = [];
        this.currentEditId = null;
        this.currentTypeFilter = '';
        this.currentFilter = '';
    }

    /**
     * Initialize the places manager
     */
    init() {
        // Initialize UI
        this.populateDepartmentSelects();
        this.updatePlacesList();
        this.updateStats();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check if we have any places, show sample button if empty
        if (SharedData.rooms.length === 0) {
            document.querySelectorAll('.empty-table-message, .empty-message').forEach(el => {
                el.style.display = 'block';
            });
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Place form submission
        document.getElementById('placeForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePlaceFormSubmit();
        });

        // Batch form submission
        document.getElementById('batchPlaceForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBatchAdd();
        });

        // Clear form button
        document.getElementById('clearPlacesBtn')?.addEventListener('click', () => {
            this.clearPlaceForm();
        });

        // Clear batch form button
        document.getElementById('clearBatchForm')?.addEventListener('click', () => {
            this.clearBatchForm();
        });

        // Search input
        document.getElementById('placeSearch')?.addEventListener('input', (e) => {
            this.currentFilter = e.target.value.toLowerCase();
            this.currentPage = 1;
            this.updatePlacesList();
        });

        // Type filter
        document.getElementById('placeTypeFilter')?.addEventListener('change', (e) => {
            this.currentTypeFilter = e.target.value;
            this.currentPage = 1;
            this.updatePlacesList();
        });

        // Pagination buttons
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.updatePlacesList();
            }
        });

        document.getElementById('nextPage')?.addEventListener('click', () => {
            const totalPages = Math.ceil(this.getFilteredPlaces().length / this.itemsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.updatePlacesList();
            }
        });

        // Delete all button
        document.getElementById('deleteAllPlaces')?.addEventListener('click', () => {
            this.deleteAllPlaces();
        });

        // View toggle button
        document.getElementById('toggleView')?.addEventListener('click', () => {
            this.toggleView();
        });

        // Sample places button
        document.querySelectorAll('[id^="addSamplePlaces"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.addSamplePlaces();
            });
        });
    }

    /**
     * Populate department selects in forms
     */
    populateDepartmentSelects() {
        const selects = [
            document.getElementById('placeDept'),
            document.getElementById('batchDept')
        ];

        selects.forEach(select => {
            if (!select) return;

            // Clear existing options except the first one
            while (select.options.length > 1) {
                select.remove(1);
            }

            // Add departments
            SharedData.departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept.id;
                option.textContent = `${dept.name} (${dept.code})`;
                select.appendChild(option);
            });
        });
    }

    /**
     * Handle place form submission
     */
    handlePlaceFormSubmit() {
        const nameInput = document.getElementById('placeInput');
        const deptSelect = document.getElementById('placeDept');
        const typeSelect = document.getElementById('placeType');
        const capacityInput = document.getElementById('placeCapacity');

        // Validate inputs
        if (!nameInput.value.trim()) {
            SharedData.showToast('الرجاء إدخال اسم المكان', 'error');
            nameInput.focus();
            return;
        }

        if (!capacityInput.value || parseInt(capacityInput.value) < 1) {
            SharedData.showToast('الرجاء إدخال سعة صالحة', 'error');
            capacityInput.focus();
            return;
        }

        const placeData = {
            name: nameInput.value.trim(),
            type: typeSelect.value === 'room' ? undefined : typeSelect.value,
            capacity: parseInt(capacityInput.value),
            department: deptSelect.value || ''
        };

        if (this.currentEditId) {
            // Update existing place
            const placeIndex = SharedData.rooms.findIndex(place => place.id === this.currentEditId);
            if (placeIndex !== -1) {
                placeData.id = this.currentEditId;
                placeData.createdAt = SharedData.rooms[placeIndex].createdAt;
                SharedData.rooms[placeIndex] = placeData;
                
                // Reset form
                this.clearPlaceForm();
                SharedData.showToast('تم تحديث المكان بنجاح', 'success');
            }
        } else {
            // Add new place
            placeData.id = SharedData.generateId();
            placeData.createdAt = new Date().toISOString();
            SharedData.rooms.push(placeData);
            
            // Reset form
            this.clearPlaceForm();
            SharedData.showToast('تم إضافة المكان بنجاح', 'success');
        }

        // Save and update UI
        SharedData.saveToLocalStorage();
        this.updatePlacesList();
        this.updateStats();
    }

    /**
     * Clear the place form
     */
    clearPlaceForm() {
        document.getElementById('placeForm').reset();
        document.getElementById('placeType').value = 'room';
        document.getElementById('placeCapacity').value = '30';
        this.currentEditId = null;
        document.getElementById('addPlaceBtn').querySelector('.text').textContent = 'إضافة مكان';
    }

    /**
     * Clear the batch form
     */
    clearBatchForm() {
        document.getElementById('batchPlaceForm').reset();
        document.getElementById('placeTypeBatch').value = 'room';
        document.getElementById('batchCapacity').value = '30';
    }

    /**
     * Handle batch place addition
     */
    handleBatchAdd() {
        const prefix = document.getElementById('placePrefix').value.trim() || 'قاعة';
        const start = parseInt(document.getElementById('startNumber').value);
        const end = parseInt(document.getElementById('endNumber').value);
        const type = document.getElementById('placeTypeBatch').value === 'room' ? undefined : document.getElementById('placeTypeBatch').value;
        const dept = document.getElementById('batchDept').value;
        const capacity = parseInt(document.getElementById('batchCapacity').value);

        if (start > end) {
            SharedData.showToast('يجب أن يكون الرقم النهائي أكبر أو يساوي الرقم البدائي', 'error');
            return;
        }

        const newPlaces = [];
        for (let i = start; i <= end; i++) {
            const placeName = `${prefix} ${i}`;
            
            // Only add if not already exists
            if (!SharedData.rooms.some(place => place.name === placeName)) {
                newPlaces.push({
                    name: placeName,
                    type: type,
                    capacity: capacity,
                    department: dept,
                    id: SharedData.generateId(),
                    createdAt: new Date().toISOString()
                });
            }
        }

        if (newPlaces.length === 0) {
            SharedData.showToast('لم يتم إضافة أي أماكن جديدة (قد تكون موجودة مسبقاً)', 'warning');
            return;
        }

        // Add new places
        SharedData.rooms.push(...newPlaces);
        SharedData.saveToLocalStorage();
        
        // Update UI
        this.updatePlacesList();
        this.updateStats();
        SharedData.showToast(`تم إضافة ${newPlaces.length} مكان بنجاح`, 'success');
        
        // Clear the batch form
        this.clearBatchForm();
    }

    /**
     * Add sample places for demonstration
     */
    addSamplePlaces() {
        if (SharedData.rooms.length > 0 && !confirm('هذا سيضيف أماكن نموذجية إلى الأماكن الحالية. هل تريد المتابعة؟')) {
            return;
        }

        const samplePlaces = [
            { name: "قاعة 101", type: undefined, capacity: 30, department: "" },
            { name: "قاعة 102", type: undefined, capacity: 40, department: "" },
            { name: "معمل الحاسوب 1", type: "computer", capacity: 25, department: "" },
            { name: "معمل الفيزياء", type: "physics", capacity: 20, department: "" },
            { name: "معمل الكيمياء", type: "chemistry", capacity: 18, department: "" },
            { name: "معمل الأحياء", type: "biology", capacity: 15, department: "" }
        ];

        // Only add places that don't already exist
        const placesToAdd = samplePlaces.filter(place => 
            !SharedData.rooms.some(existing => existing.name === place.name)
        );

        if (placesToAdd.length === 0) {
            SharedData.showToast('الأماكن النموذجية موجودة بالفعل', 'info');
            return;
        }

        // Add sample places
        placesToAdd.forEach(place => {
            SharedData.rooms.push({
                ...place,
                id: SharedData.generateId(),
                createdAt: new Date().toISOString()
            });
        });

        // Save and update UI
        SharedData.saveToLocalStorage();
        this.updatePlacesList();
        this.updateStats();
        SharedData.showToast(`تم إضافة ${placesToAdd.length} مكان نموذجي`, 'success');
    }

    /**
     * Get filtered places based on current filters
     * @returns {Array} Filtered places array
     */
    getFilteredPlaces() {
        return SharedData.rooms.filter(place => {
            // Search filter
            const matchesSearch = !this.currentFilter || 
                place.name.toLowerCase().includes(this.currentFilter);
            
            // Type filter
            const matchesType = !this.currentTypeFilter || 
                (this.currentTypeFilter === 'room' && !place.type) ||
                place.type === this.currentTypeFilter;
            
            return matchesSearch && matchesType;
        });
    }

    /**
     * Update the places list in both table and card views
     */
    updatePlacesList() {
        const filteredPlaces = this.getFilteredPlaces();
        const paginatedPlaces = this.paginatePlaces(filteredPlaces);
        
        // Update table view
        this.updatePlacesTableView(paginatedPlaces);
        
        // Update card view
        this.updatePlacesCardView(paginatedPlaces);
        
        // Update pagination info
        this.updatePaginationInfo(filteredPlaces.length);
    }

    /**
     * Paginate places array
     * @param {Array} places - Places array to paginate
     * @returns {Array} Paginated places array
     */
    paginatePlaces(places) {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        return places.slice(startIndex, startIndex + this.itemsPerPage);
    }

    /**
     * Update places table view
     * @param {Array} places - Places to display
     */
    updatePlacesTableView(places) {
        const tableBody = document.querySelector('#placesTable tbody');
        if (!tableBody) return;

        // Clear existing rows
        tableBody.innerHTML = '';

        if (places.length === 0) {
            // Show empty message
            const emptyRow = document.createElement('tr');
            emptyRow.className = 'empty-row';
            emptyRow.innerHTML = `
                <td colspan="5">
                    <div class="empty-table-message">
                        <p>لا توجد أماكن مسجلة</p>
                        <button id="addSamplePlaces2" class="btn-small btn-secondary">
                            إضافة أماكن نموذجية
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(emptyRow);
            
            // Add event listener to sample button
            document.getElementById('addSamplePlaces2')?.addEventListener('click', () => {
                this.addSamplePlaces();
            });
            
            return;
        }

        // Type display names
        const typeNames = {
            room: 'قاعة',
            computer: 'معمل حاسوب',
            physics: 'معمل فيزياء',
            chemistry: 'معمل كيمياء',
            biology: 'معمل أحياء',
            language: 'معمل لغة'
        };

        // Add places to table
        places.forEach(place => {
            const row = document.createElement('tr');
            row.dataset.id = place.id;
            
            // Get department name if exists
            let deptName = 'عام';
            if (place.department) {
                const dept = SharedData.getDepartmentById(place.department);
                if (dept) {
                    deptName = dept.name;
                }
            }
            
            // Get place type display name
            const typeDisplay = typeNames[place.type] || 'قاعة';
            
            row.innerHTML = `
                <td>${place.name}</td>
                <td>${typeDisplay}</td>
                <td>${deptName}</td>
                <td>${place.capacity}</td>
                <td>
                    <button class="btn-small btn-secondary edit-place" data-id="${place.id}">
                        <span class="icon">✏️</span>
                        <span class="text">تعديل</span>
                    </button>
                    <button class="btn-small btn-accent delete-place" data-id="${place.id}">
                        <span class="icon">🗑️</span>
                        <span class="text">حذف</span>
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });

        // Add event listeners to action buttons
        document.querySelectorAll('.edit-place').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.editPlace(e.target.closest('button').dataset.id);
            });
        });

        document.querySelectorAll('.delete-place').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deletePlace(e.target.closest('button').dataset.id);
            });
        });
    }

    /**
     * Update places card view
     * @param {Array} places - Places to display
     */
    updatePlacesCardView(places) {
        const cardsContainer = document.getElementById('cardsView');
        if (!cardsContainer) return;

        // Clear existing cards
        cardsContainer.innerHTML = '';

        if (places.length === 0) {
            // Show empty message
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.innerHTML = `
                <p>لا توجد أماكن مسجلة</p>
                <button id="addSamplePlaces" class="btn-small btn-secondary">
                    إضافة أماكن نموذجية
                </button>
            `;
            cardsContainer.appendChild(emptyMessage);
            
            // Add event listener to sample button
            document.getElementById('addSamplePlaces')?.addEventListener('click', () => {
                this.addSamplePlaces();
            });
            
            return;
        }

        // Type display names and icons
        const typeInfo = {
            room: { name: 'قاعة', icon: '🏫' },
            computer: { name: 'معمل حاسوب', icon: '💻' },
            physics: { name: 'معمل فيزياء', icon: '⚛️' },
            chemistry: { name: 'معمل كيمياء', icon: '🧪' },
            biology: { name: 'معمل أحياء', icon: '🔬' },
            language: { name: 'معمل لغة', icon: '🔤' }
        };

        // Add places as cards
        places.forEach(place => {
            const card = document.createElement('div');
            card.className = 'place-card';
            card.dataset.id = place.id;
            
            // Get department name if exists
            let deptName = 'عام';
            if (place.department) {
                const dept = SharedData.getDepartmentById(place.department);
                if (dept) {
                    deptName = dept.name;
                }
            }
            
            // Get place type display name and icon
            const typeDisplay = typeInfo[place.type] || { name: 'قاعة', icon: '🏫' };
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="place-icon">${typeDisplay.icon}</div>
                    <h3>${place.name}</h3>
                </div>
                <div class="card-body">
                    <p><strong>النوع:</strong> ${typeDisplay.name}</p>
                    <p><strong>القسم:</strong> ${deptName}</p>
                    <p><strong>السعة:</strong> ${place.capacity}</p>
                </div>
                <div class="card-actions">
                    <button class="btn-small btn-secondary edit-place" data-id="${place.id}">
                        <span class="icon">✏️</span>
                        <span class="text">تعديل</span>
                    </button>
                    <button class="btn-small btn-accent delete-place" data-id="${place.id}">
                        <span class="icon">🗑️</span>
                        <span class="text">حذف</span>
                    </button>
                </div>
            `;
            
            cardsContainer.appendChild(card);
        });

        // Add event listeners to action buttons
        document.querySelectorAll('.edit-place').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.editPlace(e.target.closest('button').dataset.id);
            });
        });

        document.querySelectorAll('.delete-place').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deletePlace(e.target.closest('button').dataset.id);
            });
        });
    }

    /**
     * Update pagination information
     * @param {number} totalItems - Total number of items
     */
    updatePaginationInfo(totalItems) {
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        // Update page info
        document.getElementById('pageInfo').textContent = `الصفحة ${this.currentPage}`;
        document.getElementById('currentCount').textContent = 
            Math.min(this.itemsPerPage * this.currentPage, totalItems);
        document.getElementById('totalCount').textContent = totalItems;
        
        // Enable/disable pagination buttons
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
    }

    /**
     * Update statistics cards
     */
    updateStats() {
        const totalRooms = SharedData.rooms.filter(place => !place.type || place.type === 'room').length;
        const totalLabs = SharedData.rooms.filter(place => place.type && place.type !== 'room').length;
        const compLabs = SharedData.rooms.filter(place => place.type === 'computer').length;
        const chemLabs = SharedData.rooms.filter(place => place.type === 'chemistry').length;
        
        document.getElementById('roomsCount').textContent = totalRooms;
        document.getElementById('labsCount').textContent = totalLabs;
        document.getElementById('compLabsCount').textContent = compLabs;
        document.getElementById('chemLabsCount').textContent = chemLabs;
    }

    /**
     * Edit a place
     * @param {string} placeId - ID of the place to edit
     */
    editPlace(placeId) {
        const place = SharedData.rooms.find(p => p.id === placeId);
        if (!place) return;

        this.currentEditId = placeId;
        
        // Fill form with place data
        document.getElementById('placeInput').value = place.name;
        document.getElementById('placeDept').value = place.department || '';
        document.getElementById('placeType').value = place.type || 'room';
        document.getElementById('placeCapacity').value = place.capacity;
        
        // Update button text
        document.getElementById('addPlaceBtn').querySelector('.text').textContent = 'تحديث المكان';
        
        // Scroll to form
        document.getElementById('placeInput').focus();
    }

    /**
     * Delete a place
     * @param {string} placeId - ID of the place to delete
     */
    deletePlace(placeId) {
        if (!confirm('هل أنت متأكد من حذف هذا المكان؟ لا يمكن التراجع عن هذا الإجراء.')) {
            return;
        }

        const placeIndex = SharedData.rooms.findIndex(p => p.id === placeId);
        if (placeIndex === -1) return;

        // Check if this place is used in any schedule
        const isUsed = SharedData.schedule?.some(lesson => lesson.roomId === placeId || lesson.labId === placeId);
        if (isUsed) {
            alert('لا يمكن حذف هذا المكان لأنه مستخدم في الجدول الدراسي الحالي');
            return;
        }

        // Remove place
        SharedData.rooms.splice(placeIndex, 1);
        SharedData.saveToLocalStorage();
        
        // Update UI
        this.updatePlacesList();
        this.updateStats();
        SharedData.showToast('تم حذف المكان بنجاح', 'success');
        
        // If we were editing this place, clear the form
        if (this.currentEditId === placeId) {
            this.clearPlaceForm();
        }
    }

    /**
     * Delete all places
     */
    deleteAllPlaces() {
        if (SharedData.rooms.length === 0) {
            SharedData.showToast('لا توجد أماكن لحذفها', 'info');
            return;
        }

        if (!confirm('هل أنت متأكد من حذف جميع الأماكن؟ لا يمكن التراجع عن هذا الإجراء.')) {
            return;
        }

        // Check if any places are used in schedule
        const usedPlaces = SharedData.schedule?.some(lesson => 
            SharedData.rooms.some(place => place.id === lesson.roomId || place.id === lesson.labId)
        );
        
        if (usedPlaces) {
            alert('لا يمكن حذف جميع الأماكن لأن بعضها مستخدم في الجدول الدراسي الحالي');
            return;
        }

        // Remove all places
        SharedData.rooms = [];
        SharedData.saveToLocalStorage();
        
        // Update UI
        this.updatePlacesList();
        this.updateStats();
        SharedData.showToast('تم حذف جميع الأماكن بنجاح', 'success');
    }

    /**
     * Toggle between table and card views
     */
    toggleView() {
        const cardsView = document.getElementById('cardsView');
        const tableView = document.getElementById('tableView');
        const viewIcon = document.getElementById('viewIcon');
        
        if (this.currentView === 'table') {
            this.currentView = 'cards';
            cardsView.classList.remove('hidden');
            tableView.classList.add('hidden');
            viewIcon.textContent = '📋';
        } else {
            this.currentView = 'table';
            cardsView.classList.add('hidden');
            tableView.classList.remove('hidden');
            viewIcon.textContent = '☰';
        }
        
        localStorage.setItem('placesViewPreference', this.currentView);
    }
}