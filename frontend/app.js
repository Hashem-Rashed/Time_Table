class ScheduleGenerator {
    constructor() {
        this.teachers = [];
        this.rooms = [];
        this.hardConstraints = [];
        this.softConstraints = [];
        this.schedule = null;
        this.generationInProgress = false;
        this.copiedAvailability = null;
        
        this.initElements();
        this.initEventListeners();
        this.setupDefaultConstraints();
        this.generateAvailabilityGrid();
    }

    initElements() {
        this.elements = {
            daysInputs: document.querySelectorAll('input[name="studyDays"]'),
            startHour: document.getElementById('startHour'),
            endHour: document.getElementById('endHour'),
            roomInput: document.getElementById('roomInput'),
            teacherName: document.getElementById('teacherName'),
            subjectName: document.getElementById('subjectName'),
            requiredLessons: document.getElementById('requiredLessons'),
            lessonDuration: document.getElementById('lessonDuration'),
            addRoomBtn: document.getElementById('addRoomBtn'),
            addTeacherBtn: document.getElementById('addTeacherBtn'),
            generateBtn: document.getElementById('generateBtn'),
            generateBestBtn: document.getElementById('generateBestBtn'),
            downloadPdfBtn: document.getElementById('downloadPdfBtn'),
            selectAllAvailability: document.getElementById('selectAllAvailability'),
            deselectAllAvailability: document.getElementById('deselectAllAvailability'),
            copyAvailabilityBtn: document.getElementById('copyAvailabilityBtn'),
            pasteAvailabilityBtn: document.getElementById('pasteAvailabilityBtn'),
            clearRoomsBtn: document.getElementById('clearRoomsBtn'),
            clearTeachersBtn: document.getElementById('clearTeachersBtn'),
            refreshScheduleBtn: document.getElementById('refreshScheduleBtn'),
            roomsList: document.getElementById('roomsList'),
            availabilityGrid: document.getElementById('availabilityGrid'),
            teachersTable: document.querySelector('#teachersTable tbody'),
            finalSchedule: document.getElementById('finalSchedule'),
            scheduleScore: document.getElementById('scheduleScore'),
            progressContainer: document.createElement('div')
        };
    }

    initEventListeners() {
        this.elements.addRoomBtn.addEventListener('click', () => this.addRoom());
        this.elements.addTeacherBtn.addEventListener('click', () => this.addTeacher());
        this.elements.generateBtn.addEventListener('click', () => this.generate());
        this.elements.generateBestBtn.addEventListener('click', () => this.generateBest());
        this.elements.downloadPdfBtn.addEventListener('click', () => this.downloadPDF());
        this.elements.selectAllAvailability.addEventListener('click', () => this.selectAllAvailability());
        this.elements.deselectAllAvailability.addEventListener('click', () => this.deselectAllAvailability());
        this.elements.copyAvailabilityBtn.addEventListener('click', () => this.copyAvailability());
        this.elements.pasteAvailabilityBtn.addEventListener('click', () => this.pasteAvailability());
        this.elements.clearRoomsBtn.addEventListener('click', () => this.clearRooms());
        this.elements.clearTeachersBtn.addEventListener('click', () => this.clearTeachers());
        this.elements.refreshScheduleBtn.addEventListener('click', () => this.refreshSchedule());
        
        this.elements.roomInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addRoom();
        });

        this.elements.daysInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.generateAvailabilityGrid();
                this.updateTeacherAvailabilityInForm();
            });
        });
        this.elements.startHour.addEventListener('change', () => {
            this.generateAvailabilityGrid();
            this.updateTeacherAvailabilityInForm();
        });
        this.elements.endHour.addEventListener('change', () => {
            this.generateAvailabilityGrid();
            this.updateTeacherAvailabilityInForm();
        });
    }

    formatHourToAMPM(hour) {
        if (hour === 0) return '12 AM';
        if (hour < 12) return `${hour} AM`;
        if (hour === 12) return '12 PM';
        return `${hour - 12} PM`;
    }

    generateAvailabilityGrid() {
        const days = this.getDays();
        const startHour = parseInt(this.elements.startHour.value);
        const endHour = parseInt(this.elements.endHour.value);
        
        if (days.length === 0 || startHour >= endHour) {
            this.elements.availabilityGrid.innerHTML = '<div class="error">الرجاء تحديد أيام الدراسة وأوقات صحيحة أولاً</div>';
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>اليوم/الساعة</th>
        `;
        
        for (let hour = startHour; hour < endHour; hour++) {
            html += `<th>${this.formatHourToAMPM(hour)}</th>`;
        }
        
        html += `</tr></thead><tbody>`;
        
        days.forEach(day => {
            html += `<tr><td>${day}</td>`;
            
            for (let hour = startHour; hour < endHour; hour++) {
                const id = `availability-${day}-${hour}`;
                html += `
                    <td>
                        <input type="checkbox" id="${id}" name="${id}">
                        <label for="${id}" class="availability-checkbox"></label>
                    </td>
                `;
            }
            
            html += `</tr>`;
        });
        
        html += `<tr class="select-row-buttons"><td>تحديد الكل</td>`;
        for (let hour = startHour; hour < endHour; hour++) {
            html += `<td><button class="btn-small select-hour-btn" data-hour="${hour}">✓</button></td>`;
        }
        html += `</tr>`;
        
        html += `</tbody></table>`;
        this.elements.availabilityGrid.innerHTML = html;
        
        document.querySelectorAll('.select-hour-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const hour = parseInt(e.target.dataset.hour);
                this.toggleHourColumn(hour);
            });
        });
    }

    toggleHourColumn(hour) {
        const days = this.getDays();
        let allChecked = true;
        
        days.forEach(day => {
            const checkbox = document.querySelector(`input[name="availability-${day}-${hour}"]`);
            if (checkbox && !checkbox.checked) {
                allChecked = false;
            }
        });
        
        days.forEach(day => {
            const checkbox = document.querySelector(`input[name="availability-${day}-${hour}"]`);
            if (checkbox) {
                checkbox.checked = !allChecked;
            }
        });
        
        const buttons = document.querySelectorAll(`.select-hour-btn[data-hour="${hour}"]`);
        buttons.forEach(btn => {
            btn.textContent = allChecked ? '✓' : '✗';
        });
    }

    selectAllAvailability() {
        document.querySelectorAll('#availabilityGrid input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
        });
        
        document.querySelectorAll('.select-hour-btn').forEach(btn => {
            btn.textContent = '✗';
        });
    }

    deselectAllAvailability() {
        document.querySelectorAll('#availabilityGrid input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        document.querySelectorAll('.select-hour-btn').forEach(btn => {
            btn.textContent = '✓';
        });
    }

    copyAvailability() {
        const availability = this.getTeacherAvailability();
        this.copiedAvailability = availability;
        alert("تم نسخ التوافر بنجاح");
    }

    pasteAvailability() {
        if (!this.copiedAvailability) {
            alert("لا يوجد توافر محفوظ للصق");
            return;
        }

        const days = this.getDays();
        const startHour = parseInt(this.elements.startHour.value);
        const endHour = parseInt(this.elements.endHour.value);

        days.forEach(day => {
            for (let hour = startHour; hour < endHour; hour++) {
                const checkbox = document.querySelector(`input[name="availability-${day}-${hour}"]`);
                if (checkbox) {
                    const isAvailable = this.copiedAvailability[day]?.includes(hour) || false;
                    checkbox.checked = isAvailable;
                }
            }
        });

        alert("تم لصق التوافر بنجاح");
    }

    getTeacherAvailability() {
        const availability = {};
        const days = this.getDays();
        const startHour = parseInt(this.elements.startHour.value);
        const endHour = parseInt(this.elements.endHour.value);
        
        days.forEach(day => {
            availability[day] = [];
            for (let hour = startHour; hour < endHour; hour++) {
                const checkbox = document.querySelector(`input[name="availability-${day}-${hour}"]`);
                if (checkbox && checkbox.checked) {
                    availability[day].push(hour);
                }
            }
        });
        
        return availability;
    }

    addRoom() {
        const roomName = this.elements.roomInput.value.trim();
        if (!roomName) {
            alert("الرجاء إدخال اسم القاعة");
            return;
        }
        
        if (this.rooms.includes(roomName)) {
            alert("هذه القاعة مضافه مسبقاً");
            return;
        }
        
        this.rooms.push(roomName);
        this.updateRoomsList();
        this.elements.roomInput.value = "";
    }

    updateRoomsList() {
        this.elements.roomsList.innerHTML = this.rooms.map(room => `
            <li>
                <span>${room}</span>
                <button class="btn-danger" onclick="app.removeRoom('${room}')">حذف</button>
            </li>
        `).join("");
        
        document.getElementById('roomStats').querySelector('strong').textContent = this.rooms.length;
    }

    removeRoom(roomName) {
        this.rooms = this.rooms.filter(room => room !== roomName);
        this.updateRoomsList();
    }

    clearRooms() {
        if (confirm("هل أنت متأكد من مسح جميع القاعات؟")) {
            this.rooms = [];
            this.updateRoomsList();
        }
    }

    addTeacher() {
        const name = this.elements.teacherName.value.trim();
        const subject = this.elements.subjectName.value.trim();
        const lessons = parseInt(this.elements.requiredLessons.value);
        const duration = parseInt(this.elements.lessonDuration.value);
        
        if (!name || !subject || isNaN(lessons) || isNaN(duration)) {
            alert("الرجاء ملء جميع الحقول");
            return;
        }
        
        const availability = this.getTeacherAvailability();
        
        const existingIndex = this.teachers.findIndex(t => t.name === name);
        if (existingIndex >= 0) {
            this.teachers[existingIndex] = { name, subject, lessons, duration, availability };
        } else {
            this.teachers.push({ name, subject, lessons, duration, availability });
        }
        
        this.updateTeachersTable();
        this.clearTeacherForm();
    }

    updateTeachersTable() {
        this.elements.teachersTable.innerHTML = this.teachers.map(teacher => `
            <tr>
                <td>${teacher.name}</td>
                <td>${teacher.subject}</td>
                <td>${teacher.lessons}</td>
                <td>${teacher.duration}</td>
                <td><button class="btn-secondary btn-small" onclick="app.editTeacher('${teacher.name}')">تعديل</button></td>
                <td><button class="btn-danger btn-small" onclick="app.removeTeacher('${teacher.name}')">حذف</button></td>
            </tr>
        `).join("");
        
        const stats = document.getElementById('teacherStats');
        stats.querySelector('strong:nth-child(1)').textContent = this.teachers.length;
        stats.querySelector('strong:nth-child(2)').textContent = 
            this.teachers.reduce((sum, teacher) => sum + teacher.lessons, 0);
    }

    editTeacher(teacherName) {
        const teacher = this.teachers.find(t => t.name === teacherName);
        if (!teacher) return;

        // Fill the form with teacher data
        this.elements.teacherName.value = teacher.name;
        this.elements.subjectName.value = teacher.subject;
        this.elements.requiredLessons.value = teacher.lessons;
        this.elements.lessonDuration.value = teacher.duration;

        // Set availability checkboxes
        const days = this.getDays();
        const startHour = parseInt(this.elements.startHour.value);
        const endHour = parseInt(this.elements.endHour.value);
        
        days.forEach(day => {
            for (let hour = startHour; hour < endHour; hour++) {
                const checkbox = document.querySelector(`input[name="availability-${day}-${hour}"]`);
                if (checkbox) {
                    checkbox.checked = teacher.availability[day]?.includes(hour) || false;
                }
            }
        });

        // Remove the teacher from the list (will be re-added when saving)
        this.teachers = this.teachers.filter(t => t.name !== teacherName);
        this.updateTeachersTable();

        // Scroll to the teacher form
        document.querySelector('#teacherName').scrollIntoView({ behavior: 'smooth' });
    }

    removeTeacher(teacherName) {
        this.teachers = this.teachers.filter(teacher => teacher.name !== teacherName);
        this.updateTeachersTable();
    }

    clearTeachers() {
        if (confirm("هل أنت متأكد من مسح جميع المدرسين؟")) {
            this.teachers = [];
            this.updateTeachersTable();
        }
    }

    clearTeacherForm() {
        this.elements.teacherName.value = "";
        this.elements.subjectName.value = "";
        this.elements.requiredLessons.value = "2";
        this.elements.lessonDuration.value = "1";
        this.deselectAllAvailability();
    }

    updateTeacherAvailabilityInForm() {
        if (!this.elements.teacherName.value) return;
        
        const teacherName = this.elements.teacherName.value.trim();
        const existingTeacher = this.teachers.find(t => t.name === teacherName);
        
        if (existingTeacher) {
            const days = this.getDays();
            const startHour = parseInt(this.elements.startHour.value);
            const endHour = parseInt(this.elements.endHour.value);
            
            days.forEach(day => {
                for (let hour = startHour; hour < endHour; hour++) {
                    const checkbox = document.querySelector(`input[name="availability-${day}-${hour}"]`);
                    if (checkbox) {
                        checkbox.checked = existingTeacher.availability[day]?.includes(hour) || false;
                    }
                }
            });
        }
    }

    generate() {
        if (this.generationInProgress) return;
        
        const days = this.getDays();
        if (!days || days.length === 0) {
            alert("الرجاء تحديد أيام الدراسة أولاً");
            return;
        }
        
        const { valid, message } = this.validateInputs();
        if (!valid) {
            alert(message);
            return;
        }

        this.generationInProgress = true;
        this.showProgress('جارٍ توليد الجدول...', 0);
        
        setTimeout(() => {
            try {
                this.schedule = this.geneticAlgorithm(days, 
                    parseInt(this.elements.startHour.value),
                    parseInt(this.elements.endHour.value),
                    20,  // Population size
                    10   // Generations
                );
                
                this.renderSchedule();
                this.analyzeScheduleQuality();
            } catch (error) {
                this.showError("فشل توليد الجدول", error.message);
                console.error(error);
            } finally {
                this.generationInProgress = false;
            }
        }, 100);
    }

    generateBest() {
        if (this.generationInProgress) return;
        
        const days = this.getDays();
        if (!days || days.length === 0) {
            alert("الرجاء تحديد أيام الدراسة أولاً");
            return;
        }
        
        const { valid, message } = this.validateInputs();
        if (!valid) {
            alert(message);
            return;
        }

        this.generationInProgress = true;
        this.showProgress('جارٍ توليد أفضل جدول... قد يستغرق بضع دقائق', 0);
        
        setTimeout(() => {
            try {
                this.schedule = this.geneticAlgorithm(days,
                    parseInt(this.elements.startHour.value),
                    parseInt(this.elements.endHour.value),
                    50,  // Population size
                    100  // Generations
                );
                
                this.renderSchedule();
                this.analyzeScheduleQuality();
            } catch (error) {
                this.showError("فشل توليد الجدول", error.message);
                console.error(error);
            } finally {
                this.generationInProgress = false;
            }
        }, 100);
    }

    geneticAlgorithm(days, startHour, endHour, populationSize, generations) {
        let population = [];
        for (let i = 0; i < populationSize; i++) {
            population.push(this.generateSmartSchedule(days, startHour, endHour));
        }
        
        let bestOverall = null;
        let bestScore = -Infinity;
        
        for (let gen = 0; gen < generations; gen++) {
            population.forEach(schedule => {
                if (!schedule.score) {
                    schedule.score = this.evaluateSchedule(schedule);
                }
            });
            
            population.sort((a, b) => b.score - a.score);
            
            if (population[0].score > bestScore) {
                bestScore = population[0].score;
                bestOverall = JSON.parse(JSON.stringify(population[0]));
            }
            
            if (bestScore >= 200) break;
            
            const newPopulation = population.slice(0, Math.floor(populationSize * 0.5));
            while (newPopulation.length < populationSize * 0.7) {
                newPopulation.push(population[Math.floor(Math.random() * population.length)]);
            }
            
            while (newPopulation.length < populationSize) {
                const parent1 = this.selectParent(population);
                const parent2 = this.selectParent(population);
                const child = this.crossover(parent1, parent2);
                const mutatedChild = this.mutate(child, days, startHour, endHour);
                newPopulation.push(mutatedChild);
            }
            
            population = newPopulation;
            
            if (gen % 10 === 0) {
                const progress = Math.round((gen / generations) * 100);
                this.updateProgress(progress);
            }
        }
        
        return bestOverall || [];
    }

    generateSmartSchedule(days, startHour, endHour) {
        const schedule = [];
        const teachersCopy = [...this.teachers];
        
        teachersCopy.forEach(teacher => {
            const availableDays = Object.keys(teacher.availability)
                .filter(day => days.includes(day) && teacher.availability[day].length > 0);
            
            if (availableDays.length === 0) return;
            
            const randomDay = availableDays[Math.floor(Math.random() * availableDays.length)];
            const availableHours = teacher.availability[randomDay];
            const startTime = availableHours[Math.floor(Math.random() * availableHours.length)];
            
            if (startTime + teacher.duration > endHour) return;
            
            const room = this.findAvailableRoom(schedule, randomDay, startTime, teacher.duration, teacher.name);
            if (!room) return;
            
            for (let h = startTime; h < startTime + teacher.duration; h++) {
                schedule.push({
                    day: randomDay,
                    hour: h,
                    teacher: teacher.name,
                    subject: teacher.subject,
                    room: room
                });
            }
        });
        
        teachersCopy.forEach(teacher => {
            const lessonsToSchedule = teacher.lessons - 
                (schedule.filter(s => s.teacher === teacher.name).length / teacher.duration);
            
            let scheduled = 0;
            let attempts = 0;
            const maxAttempts = 50;
            
            while (scheduled < lessonsToSchedule && attempts < maxAttempts) {
                attempts++;
                
                const availableDays = Object.keys(teacher.availability)
                    .filter(day => days.includes(day) && teacher.availability[day].length > 0);
                
                if (availableDays.length === 0) break;
                
                const randomDay = availableDays[Math.floor(Math.random() * availableDays.length)];
                const availableHours = teacher.availability[randomDay];
                const startTime = availableHours[Math.floor(Math.random() * availableHours.length)];
                
                if (startTime + teacher.duration > endHour) continue;
                
                const room = this.findAvailableRoom(schedule, randomDay, startTime, teacher.duration, teacher.name);
                if (!room) continue;
                
                for (let h = startTime; h < startTime + teacher.duration; h++) {
                    schedule.push({
                        day: randomDay,
                        hour: h,
                        teacher: teacher.name,
                        subject: teacher.subject,
                        room: room
                    });
                }
                
                scheduled++;
            }
        });
        
        return schedule;
    }

    findAvailableRoom(schedule, day, startTime, duration, teacherName) {
        const shuffledRooms = [...this.rooms];
        this.shuffleArray(shuffledRooms);
        
        for (const room of shuffledRooms) {
            let available = true;
            
            for (let h = startTime; h < startTime + duration; h++) {
                if (this.isConflict(schedule, day, h, room, teacherName)) {
                    available = false;
                    break;
                }
            }
            
            if (available) return room;
        }
        
        return null;
    }

    isConflict(schedule, day, hour, room, teacherName) {
        return schedule.some(s => 
            s.day === day && 
            s.hour === hour && 
            (s.room === room || s.teacher === teacherName)
        );
    }

    selectParent(population) {
        if (Math.random() < 0.8 && population.length > 5) {
            const tournament = population.slice(0, Math.floor(population.length * 0.2));
            return tournament[Math.floor(Math.random() * tournament.length)];
        }
        
        const tournamentSize = 5;
        let best = null;
        
        for (let i = 0; i < tournamentSize; i++) {
            const candidate = population[Math.floor(Math.random() * population.length)];
            if (!best || candidate.score > best.score) {
                best = candidate;
            }
        }
        
        return best;
    }

    crossover(parent1, parent2) {
        const child = [];
        const lessons1 = this.groupIntoLessons(parent1);
        const lessons2 = this.groupIntoLessons(parent2);
        const allLessons = [...lessons1, ...lessons2];
        
        this.shuffleArray(allLessons);
        
        for (const lesson of allLessons) {
            let canAdd = true;
            
            for (const entry of lesson) {
                if (this.isConflict(child, entry.day, entry.hour, entry.room, entry.teacher)) {
                    canAdd = false;
                    break;
                }
            }
            
            if (canAdd) {
                child.push(...lesson);
            }
        }
        
        return child;
    }

    groupIntoLessons(schedule) {
        const lessons = [];
        const processed = new Set();
        
        for (const entry of schedule) {
            if (processed.has(entry)) continue;
            
            const lessonEntries = [entry];
            let currentHour = entry.hour + 1;
            
            while (true) {
                const nextEntry = schedule.find(s => 
                    s.teacher === entry.teacher &&
                    s.subject === entry.subject &&
                    s.day === entry.day &&
                    s.hour === currentHour
                );
                
                if (!nextEntry) break;
                
                lessonEntries.push(nextEntry);
                currentHour++;
            }
            
            lessons.push(lessonEntries);
            lessonEntries.forEach(e => processed.add(e));
        }
        
        return lessons;
    }

    mutate(schedule, days, startHour, endHour) {
        const newSchedule = [...schedule];
        
        if (Math.random() > 0.3) return newSchedule;
        
        const teacherStats = {};
        this.teachers.forEach(teacher => {
            teacherStats[teacher.name] = {
                required: teacher.lessons * teacher.duration,
                scheduled: 0
            };
        });
        
        newSchedule.forEach(entry => {
            teacherStats[entry.teacher].scheduled++;
        });
        
        const teachersByPriority = [...this.teachers].sort((a, b) => {
            const aRatio = teacherStats[a.name].scheduled / teacherStats[a.name].required;
            const bRatio = teacherStats[b.name].scheduled / teacherStats[b.name].required;
            return aRatio - bRatio;
        });
        
        for (const teacher of teachersByPriority) {
            if (teacherStats[teacher.name].scheduled < teacherStats[teacher.name].required) {
                const added = this.tryAddLesson(newSchedule, teacher, days, startHour, endHour);
                if (added) break;
            }
            
            if (Math.random() > 0.5) {
                const improved = this.tryImproveLesson(newSchedule, teacher, days, startHour, endHour);
                if (improved) break;
            }
        }
        
        return newSchedule;
    }

    tryAddLesson(schedule, teacher, days, startHour, endHour) {
        const availableDays = Object.keys(teacher.availability)
            .filter(day => days.includes(day) && teacher.availability[day].length > 0);
        
        if (availableDays.length === 0) return false;
        
        const attempts = 10;
        for (let i = 0; i < attempts; i++) {
            const randomDay = availableDays[Math.floor(Math.random() * availableDays.length)];
            const availableHours = teacher.availability[randomDay];
            const startTime = availableHours[Math.floor(Math.random() * availableHours.length)];
            
            if (startTime + teacher.duration > endHour) continue;
            
            const room = this.findAvailableRoom(schedule, randomDay, startTime, teacher.duration, teacher.name);
            if (!room) continue;
            
            for (let h = startTime; h < startTime + teacher.duration; h++) {
                schedule.push({
                    day: randomDay,
                    hour: h,
                    teacher: teacher.name,
                    subject: teacher.subject,
                    room: room
                });
            }
            
            return true;
        }
        
        return false;
    }

    tryImproveLesson(schedule, teacher, days, startHour, endHour) {
        const teacherLessons = this.groupIntoLessons(schedule)
            .filter(lesson => lesson[0].teacher === teacher.name);
        
        if (teacherLessons.length === 0) return false;
        
        const lessonToMove = teacherLessons[Math.floor(Math.random() * teacherLessons.length)];
        const duration = lessonToMove.length;
        
        const newSchedule = schedule.filter(entry => !lessonToMove.includes(entry));
        
        for (const day of days) {
            for (const hour of teacher.availability[day] || []) {
                if (hour + duration > endHour) continue;
                
                const room = this.findAvailableRoom(newSchedule, day, hour, duration, teacher.name);
                if (!room) continue;
                
                for (let h = hour; h < hour + duration; h++) {
                    newSchedule.push({
                        day: day,
                        hour: h,
                        teacher: teacher.name,
                        subject: teacher.subject,
                        room: room
                    });
                }
                
                schedule.length = 0;
                schedule.push(...newSchedule);
                return true;
            }
        }
        
        return false;
    }

    evaluateSchedule(schedule) {
        if (schedule.length === 0) return -Infinity;
        
        let completionScore = 0;
        let teachersWithLessons = 0;
        const teacherStats = {};
        
        this.teachers.forEach(teacher => {
            const scheduled = schedule.filter(s => s.teacher === teacher.name).length;
            teacherStats[teacher.name] = {
                required: teacher.lessons * teacher.duration,
                scheduled: scheduled
            };
            
            if (scheduled > 0) {
                const completionRatio = scheduled / (teacher.lessons * teacher.duration);
                completionScore += completionRatio;
                teachersWithLessons++;
            }
        });
        
        completionScore = teachersWithLessons > 0 
            ? (completionScore / teachersWithLessons) * 100 
            : 0;
        
        let constraintScore = this.softConstraints.reduce(
            (score, constraint) => score + constraint(schedule),
            0
        );
        
        return (completionScore * 2) + constraintScore;
    }

    validateInputs() {
        const days = this.getDays();
        if (!days || days.length === 0) {
            return { valid: false, message: "الرجاء اختيار يوم واحد على الأقل" };
        }
        
        const startHour = parseInt(this.elements.startHour.value);
        const endHour = parseInt(this.elements.endHour.value);
        
        if (startHour >= endHour) {
            return { valid: false, message: "ساعة الانتهاء يجب أن تكون بعد ساعة البدء" };
        }
        
        if (this.teachers.length === 0) {
            return { valid: false, message: "الرجاء إضافة مدرسين أولاً" };
        }
        
        if (this.rooms.length === 0) {
            return { valid: false, message: "الرجاء إضافة قاعات أولاً" };
        }
        
        for (const teacher of this.teachers) {
            const hasAvailability = Object.keys(teacher.availability)
                .some(day => days.includes(day) && teacher.availability[day].length > 0);
            
            if (!hasAvailability) {
                return { 
                    valid: false, 
                    message: `المدرس ${teacher.name} ليس لديه توفر في الأيام المحددة`
                };
            }
        }
        
        return { valid: true };
    }

    renderSchedule() {
        if (!this.schedule || this.schedule.length === 0) {
            this.elements.finalSchedule.innerHTML = '<div class="empty-schedule">لا يوجد جدول مدرسي لعرضه</div>';
            return;
        }
    
        // Get days in the order they appear in the UI (RTL)
        const days = Array.from(this.elements.daysInputs)
            .filter(input => input.checked)
            .map(input => input.value);
    
        const startHour = parseInt(this.elements.startHour.value);
        const endHour = parseInt(this.elements.endHour.value);
    
        // Create schedule map
        const scheduleMap = {};
        days.forEach(day => {
            scheduleMap[day] = {};
            for (let h = startHour; h < endHour; h++) {
                scheduleMap[day][h] = this.schedule.filter(s => s.day === day && s.hour === h);
            }
        });
    
        // Build HTML
        let html = `
        <div class="schedule-container">
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th class="time-column">الوقت</th>
        `;
    
        // Add day headers
        days.forEach(day => {
            html += `<th>${day}</th>`;
        });
    
        html += `</tr></thead><tbody>`;
    
        // Add time slots
        for (let h = startHour; h < endHour; h++) {
            html += `<tr>`;
            html += `<td class="time-column">${this.formatHourToAMPM(h)}</td>`;
            
            days.forEach(day => {
                const entries = scheduleMap[day][h];
                const isContinued = this.schedule.some(s => 
                    s.day === day && 
                    s.hour === h - 1 && 
                    s.teacher === entries[0]?.teacher && 
                    s.subject === entries[0]?.subject
                );
    
                if (entries.length > 0 && !isContinued) {
                    const duration = this.schedule.filter(s => 
                        s.day === day && 
                        s.hour >= h && 
                        s.teacher === entries[0].teacher && 
                        s.subject === entries[0].subject
                    ).length;
    
                    html += `<td rowspan="${duration}" class="time-slot">`;
                    html += `<div class="time-slot-content">`;
                    html += `<div class="subject">${entries[0].subject}</div>`;
                    html += `<div class="teacher">${entries[0].teacher}</div>`;
                    html += `<div class="room">${entries[0].room}</div>`;
                    html += `</div>`;
                    if (duration > 1) {
                        html += `<div class="duration-badge">${duration} ساعات</div>`;
                    }
                    html += `</td>`;
                } else if (entries.length === 0 && !isContinued) {
                    html += `<td class="time-slot empty"></td>`;
                }
            });
            
            html += `</tr>`;
        }
        
        html += `</tbody></table></div>`;
        this.elements.finalSchedule.innerHTML = html;
        
        this.updateCompletionStats();
    }

    updateCompletionStats() {
        if (!this.schedule || this.schedule.length === 0) return;
        
        let totalRequired = 0;
        let totalScheduled = 0;
        
        this.teachers.forEach(teacher => {
            totalRequired += teacher.lessons * teacher.duration;
            totalScheduled += this.schedule.filter(s => s.teacher === teacher.name).length;
        });
        
        const completionPercent = Math.round((totalScheduled / totalRequired) * 100);
        document.getElementById('completionBar').style.width = `${completionPercent}%`;
        document.getElementById('completionPercent').textContent = `${completionPercent}%`;
        document.getElementById('totalLessons').textContent = this.schedule.length;
        
        const score = this.evaluateSchedule(this.schedule);
        document.getElementById('scheduleScore').textContent = Math.round(score);
    }

    analyzeScheduleQuality() {
        if (!this.schedule || this.schedule.length === 0) return;
        
        const teacherStats = {};
        this.teachers.forEach(teacher => {
            const scheduled = this.schedule.filter(s => s.teacher === teacher.name).length;
            teacherStats[teacher.name] = {
                required: teacher.lessons * teacher.duration,
                scheduled: scheduled,
                percent: Math.round((scheduled / (teacher.lessons * teacher.duration)) * 100)
            };
        });
        
        const roomStats = {};
        this.rooms.forEach(room => {
            roomStats[room] = this.schedule.filter(s => s.room === room).length;
        });
        
        const timeStats = {
            days: {},
            hours: {}
        };
        
        const days = this.getDays();
        const startHour = parseInt(this.elements.startHour.value);
        const endHour = parseInt(this.elements.endHour.value);
        
        days.forEach(day => {
            timeStats.days[day] = this.schedule.filter(s => s.day === day).length;
        });
        
        for (let h = startHour; h < endHour; h++) {
            timeStats.hours[h] = this.schedule.filter(s => s.hour === h).length;
        }
        
        console.log("Schedule Quality Analysis:", {
            teacherStats,
            roomStats,
            timeStats
        });
    }

    downloadPDF() {
        if (!this.schedule || this.schedule.length === 0) {
            alert("لا يوجد جدول مدرسي لتحميله");
            return;
        }

        const element = document.getElementById('finalSchedule');
        const opt = {
            margin: 10,
            filename: 'الجدول_المدرسي.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a3', orientation: 'landscape' }
        };

        const originalContent = element.innerHTML;
        element.innerHTML = '<div class="loading">جارٍ تحضير الملف للتحميل...</div>';

        setTimeout(() => {
            html2pdf().from(element).set(opt).save().then(() => {
                element.innerHTML = originalContent;
            });
        }, 500);
    }

    refreshSchedule() {
        if (this.schedule) {
            this.renderSchedule();
        }
    }

    setupDefaultConstraints() {
        this.hardConstraints = [];
        this.softConstraints = [];
    }

    getDays() {
        const days = [];
        this.elements.daysInputs.forEach(input => {
            if (input.checked) days.push(input.value);
        });
        return days;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    showProgress(message, percent) {
        this.elements.progressContainer.innerHTML = `
            <div class="progress-message">${message}</div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${percent}%"></div>
            </div>
            <div class="progress-percent">${percent}%</div>
        `;
        this.elements.finalSchedule.appendChild(this.elements.progressContainer);
    }

    updateProgress(percent) {
        const percentElement = this.elements.progressContainer.querySelector('.progress-percent');
        const barElement = this.elements.progressContainer.querySelector('.progress-bar');
        
        if (percentElement && barElement) {
            percentElement.textContent = `${percent}%`;
            barElement.style.width = `${percent}%`;
        }
    }

    showError(title, message) {
        this.elements.finalSchedule.innerHTML = `
            <div class="error-container">
                <div class="error-icon">⚠️</div>
                <div class="error-text">
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <ul class="suggestions">
                        <li>تحقق من توفر المدرسين في الأوقات المحددة</li>
                        <li>تأكد من أن عدد القاعات كافٍ</li>
                        <li>قلل من القيود اليدوية إذا كانت كثيرة</li>
                        <li>جرب تغيير أوقات البدء أو الانتهاء</li>
                    </ul>
                </div>
            </div>
        `;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const app = new ScheduleGenerator();
    window.app = app;
});