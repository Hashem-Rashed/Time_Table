const express = require('express');
const cors = require('cors');
const { generateSchedule } = require('./scheduler');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let database = {
    college: {},
    teachers: [],
    rooms: []
};

// استلام البيانات
app.post('/api/save-data', (req, res) => {
    database = req.body;
    res.send({ message: 'Data saved successfully' });
});

// توليد الجدول
app.get('/api/generate-schedule', (req, res) => {
    const schedule = generateSchedule(database);
    res.json(schedule);
});

// تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
