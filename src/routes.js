const { registerAuthRoutes } = require('./core/auth');
const { registerFormConfigRoutes } = require('./config/formConfig');
const { registerCoursesRoutes } = require('./data/courses');
const { registerStudentsRoutes } = require('./data/students');
const { registerRegistrationRoutes } = require('./features/registration');
const { registerAttendanceRoutes } = require('./features/attendance');
const { registerExportRoutes } = require('./features/export');

function registerAllRoutes(app) {
    registerAuthRoutes(app);
    registerCoursesRoutes(app);
    registerFormConfigRoutes(app);
    registerStudentsRoutes(app);
    registerRegistrationRoutes(app);
    registerAttendanceRoutes(app);
    registerExportRoutes(app);
}

module.exports = { registerAllRoutes };
