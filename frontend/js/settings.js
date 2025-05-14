// settings.js - Updated College Settings Management

document.addEventListener('DOMContentLoaded', () => {
    // Ensure SharedData is initialized
    if (typeof SharedData === 'undefined') {
        console.error('SharedData is not defined. Make sure shared.js is loaded first.');
        return;
    }

    // Initialize settings manager
    const settingsManager = new SettingsManager();
    settingsManager.init();
});

class SettingsManager {
    constructor() {
        this.currentSettings = {};
        this.defaultSettings = {
            studyDays: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
            startHour: 8,
            endHour: 17,
            minHour: 6,
            maxHour: 22,
            version: '2.0'
        };
    }

    init() {
        this.loadCurrentSettings();
        this.setupEventListeners();
        this.updateCurrentSettingsDisplay();
        this.setupAccessibility();
    }

    loadCurrentSettings() {
        try {
            // Merge current settings with defaults
            this.currentSettings = {
                ...this.defaultSettings,
                ...SharedData.settings
            };

            // Set form values
            this.setStudyDaysCheckboxes();
            document.getElementById('startHour').value = this.currentSettings.startHour;
            document.getElementById('endHour').value = this.currentSettings.endHour;
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.showToast('حدث خطأ أثناء تحميل الإعدادات', 'error');
        }
    }

    setStudyDaysCheckboxes() {
        const checkboxes = document.querySelectorAll('input[name="studyDays"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.currentSettings.studyDays.includes(checkbox.value);
        });
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('settingsForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSettingsSubmit();
        });

        // Reset button
        document.getElementById('resetBtn')?.addEventListener('click', () => {
            this.resetSettings();
        });

        // Export button
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            this.exportSettings();
        });

        // Import button
        document.getElementById('importBtn')?.addEventListener('click', () => {
            this.importSettings();
        });

        // Real-time updates
        document.querySelectorAll('input[name="studyDays"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateCurrentSettingsDisplay();
            });
        });

        const hourInputs = ['startHour', 'endHour'];
        hourInputs.forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                this.validateHourInputs();
                this.updateCurrentSettingsDisplay();
            });
        });
    }

    setupAccessibility() {
        // Add ARIA attributes and keyboard navigation
        const checkboxes = document.querySelectorAll('input[name="studyDays"]');
        checkboxes.forEach((checkbox, index) => {
            checkbox.setAttribute('aria-label', `يوم ${checkbox.value}`);
            checkbox.setAttribute('role', 'checkbox');
            
            // Keyboard navigation
            checkbox.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = checkboxes[(index + 1) % checkboxes.length];
                    next.focus();
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = checkboxes[(index - 1 + checkboxes.length) % checkboxes.length];
                    prev.focus();
                }
            });
        });
    }

    validateHourInputs() {
        const startHour = parseInt(document.getElementById('startHour').value);
        const endHour = parseInt(document.getElementById('endHour').value);

        if (isNaN(startHour)) {
            this.showInputError('startHour', 'قيمة غير صالحة');
            return false;
        }

        if (isNaN(endHour)) {
            this.showInputError('endHour', 'قيمة غير صالحة');
            return false;
        }

        if (startHour >= endHour) {
            this.showInputError('endHour', 'يجب أن تكون ساعة الانتهاء بعد ساعة البدء');
            return false;
        }

        if (startHour < this.defaultSettings.minHour || startHour > this.defaultSettings.maxHour) {
            this.showInputError('startHour', `يجب أن تكون بين ${this.defaultSettings.minHour} و ${this.defaultSettings.maxHour}`);
            return false;
        }

        if (endHour < this.defaultSettings.minHour || endHour > this.defaultSettings.maxHour) {
            this.showInputError('endHour', `يجب أن تكون بين ${this.defaultSettings.minHour} و ${this.defaultSettings.maxHour}`);
            return false;
        }

        this.clearInputErrors();
        return true;
    }

    showInputError(inputId, message) {
        const input = document.getElementById(inputId);
        if (!input) return;

        let errorElement = input.nextElementSibling;
        if (!errorElement || !errorElement.classList.contains('error-message')) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            input.insertAdjacentElement('afterend', errorElement);
        }

        errorElement.textContent = message;
        input.classList.add('error');
        input.setAttribute('aria-invalid', 'true');
    }

    clearInputErrors() {
        document.querySelectorAll('.error-message').forEach(el => el.remove());
        document.querySelectorAll('.error').forEach(el => {
            el.classList.remove('error');
            el.removeAttribute('aria-invalid');
        });
    }

    handleSettingsSubmit() {
        // Validate inputs
        if (!this.validateHourInputs()) {
            return;
        }

        // Get selected days
        const selectedDays = Array.from(document.querySelectorAll('input[name="studyDays"]:checked'))
            .map(checkbox => checkbox.value);

        if (selectedDays.length === 0) {
            this.showToast('يجب اختيار يوم دراسة واحد على الأقل', 'error');
            document.querySelector('input[name="studyDays"]').focus();
            return;
        }

        // Get hours
        const startHour = parseInt(document.getElementById('startHour').value);
        const endHour = parseInt(document.getElementById('endHour').value);

        // Update SharedData
        SharedData.settings = {
            ...SharedData.settings,
            studyDays: selectedDays,
            startHour: startHour,
            endHour: endHour,
            lastUpdated: new Date().toISOString()
        };

        // Save and notify
        SharedData.saveToLocalStorage();
        this.showToast('تم حفظ الإعدادات بنجاح', 'success');
        this.updateCurrentSettingsDisplay();

        // Focus management for accessibility
        document.getElementById('saveSettingsBtn').focus();
    }

    updateCurrentSettingsDisplay() {
        try {
            // Get selected days
            const selectedDays = Array.from(document.querySelectorAll('input[name="studyDays"]:checked'))
                .map(checkbox => checkbox.value);

            // Format days display
            const daysDisplay = this.formatDaysDisplay(selectedDays);
            document.getElementById('currentDaysDisplay').textContent = daysDisplay;

            // Get and validate hours
            const startHour = parseInt(document.getElementById('startHour').value) || this.defaultSettings.startHour;
            const endHour = parseInt(document.getElementById('endHour').value) || this.defaultSettings.endHour;

            // Format hours display
            const hoursDisplay = `${SharedData.formatHourToAMPM(startHour)} - ${SharedData.formatHourToAMPM(endHour)}`;
            document.getElementById('currentHoursDisplay').textContent = hoursDisplay;

            // Calculate daily hours
            const dailyHours = endHour - startHour;
            const hoursText = dailyHours === 1 ? 'ساعة' : 'ساعات';
            document.getElementById('dailyHoursDisplay').textContent = `${dailyHours} ${hoursText}`;

        } catch (error) {
            console.error('Error updating settings display:', error);
            this.showToast('حدث خطأ أثناء تحديث عرض الإعدادات', 'error');
        }
    }

    formatDaysDisplay(days) {
        const dayOrder = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
        const sortedDays = [...days].sort((a, b) => 
            dayOrder.indexOf(a) - dayOrder.indexOf(b)
        );

        if (sortedDays.length === dayOrder.length) {
            return 'كل أيام الأسبوع';
        }

        if (sortedDays.length === 6 && !sortedDays.includes('الجمعة')) {
            return 'السبت إلى الخميس';
        }

        if (sortedDays.length === 5 && 
            sortedDays.includes('السبت') && 
            sortedDays.includes('الأحد') && 
            sortedDays.includes('الإثنين') && 
            sortedDays.includes('الثلاثاء') && 
            sortedDays.includes('الأربعاء')) {
            return 'السبت إلى الأربعاء';
        }

        return sortedDays.join('، ');
    }

    resetSettings() {
        if (confirm('هل أنت متأكد من إعادة تعيين الإعدادات إلى القيم الافتراضية؟')) {
            try {
                SharedData.settings = {
                    ...this.defaultSettings,
                    lastUpdated: new Date().toISOString()
                };
                
                SharedData.saveToLocalStorage();
                this.loadCurrentSettings();
                this.updateCurrentSettingsDisplay();
                this.showToast('تم إعادة تعيين الإعدادات بنجاح', 'success');
                
            } catch (error) {
                console.error('Error resetting settings:', error);
                this.showToast('حدث خطأ أثناء إعادة تعيين الإعدادات', 'error');
            }
        }
    }

    exportSettings() {
        try {
            const settingsToExport = {
                ...SharedData.settings,
                exportDate: new Date().toISOString(),
                exportVersion: '2.0',
                system: 'College Schedule Generator'
            };

            const blob = new Blob([JSON.stringify(settingsToExport, null, 2)], { 
                type: 'application/json' 
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `college-settings-${new Date().toISOString().split('T')[0]}.json`;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            this.showToast('تم تصدير الإعدادات بنجاح', 'success');
            
        } catch (error) {
            console.error('Error exporting settings:', error);
            this.showToast('حدث خطأ أثناء تصدير الإعدادات', 'error');
        }
    }

    importSettings() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const importedSettings = JSON.parse(event.target.result);
                    
                    // Validate imported settings
                    if (!this.validateImportedSettings(importedSettings)) {
                        throw new Error('ملف الإعدادات غير صالح');
                    }
                    
                    if (confirm('هل تريد استيراد هذه الإعدادات؟ سيتم استبدال الإعدادات الحالية.')) {
                        SharedData.settings = {
                            ...SharedData.settings,
                            studyDays: importedSettings.studyDays,
                            startHour: importedSettings.startHour,
                            endHour: importedSettings.endHour,
                            lastUpdated: new Date().toISOString()
                        };
                        
                        SharedData.saveToLocalStorage();
                        this.loadCurrentSettings();
                        this.updateCurrentSettingsDisplay();
                        this.showToast('تم استيراد الإعدادات بنجاح', 'success');
                    }
                } catch (error) {
                    console.error('Error importing settings:', error);
                    this.showToast(`فشل استيراد الإعدادات: ${error.message}`, 'error');
                }
            };
            
            reader.onerror = () => {
                this.showToast('حدث خطأ أثناء قراءة الملف', 'error');
            };
            
            reader.readAsText(file);
        };
        
        document.body.appendChild(input);
        input.click();
        setTimeout(() => document.body.removeChild(input), 1000);
    }

    validateImportedSettings(settings) {
        const validDays = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
        
        return (
            Array.isArray(settings.studyDays) &&
            settings.studyDays.every(day => validDays.includes(day)) &&
            typeof settings.startHour === 'number' &&
            typeof settings.endHour === 'number' &&
            settings.startHour < settings.endHour &&
            settings.startHour >= this.defaultSettings.minHour &&
            settings.endHour <= this.defaultSettings.maxHour
        );
    }

    showToast(message, type = 'info') {
        SharedData.showToast(message, type);
    }
}