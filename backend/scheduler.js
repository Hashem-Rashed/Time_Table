function generateSchedule(database) {
  const { college, teachers, rooms } = database;
  const schedule = [];

  const workingHours = [];
  for (let hour = college.startHour; hour < college.endHour; hour++) {
      workingHours.push(hour);
  }

  const days = college.days;

  teachers.forEach(teacher => {
      let hoursLeft = teacher.hoursPerWeek;

      for (let day of days) {
          if (!teacher.available[day] || hoursLeft <= 0) continue;

          for (let hour of workingHours) {
              if (teacher.available[day].includes(hour) && hoursLeft > 0) {
                  const availableRoom = rooms.find(room => {
                      return !schedule.some(s => s.day === day && s.hour === hour && s.room === room.name);
                  });

                  if (availableRoom) {
                      schedule.push({
                          teacher: teacher.name,
                          subject: teacher.subject,
                          day,
                          hour,
                          room: availableRoom.name
                      });
                      hoursLeft--;
                  }
              }
          }
      }
  });

  return schedule;
}

module.exports = { generateSchedule };
