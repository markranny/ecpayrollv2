<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\EmployeeImportController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\BiometricController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AttendanceLogsController;
use App\Http\Controllers\EmployeeAttendanceImportController;
use App\Http\Controllers\OvertimeController;
use App\Http\Controllers\DepartmentManagerController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ChangeOffScheduleController;
use App\Http\Controllers\TimeScheduleController;
use App\Http\Controllers\TravelOrderController;
use App\Http\Controllers\OfficialBusinessController;
use App\Http\Controllers\OffsetController;
use App\Http\Controllers\SLVLController;
use App\Http\Controllers\RetroController;
use App\Http\Controllers\BenefitController;
use App\Http\Controllers\DeductionController;
use App\Http\Controllers\FinalPayrollController; 
use App\Http\Controllers\PayrollSummariesController;
use App\Http\Controllers\Auth\EmployeeRegistrationController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\ProcessedAttendanceController;
use App\Http\Controllers\EmployeeScheduleController;
use App\Http\Controllers\PromotionController;
use App\Http\Controllers\AwardController;
use App\Http\Controllers\TransferController;
use App\Http\Controllers\ResignationController;
use App\Http\Controllers\ComplaintController;
use App\Http\Controllers\WarningController;
use App\Http\Controllers\TerminationController;
use App\Http\Controllers\DepartmentController;
use App\Http\Controllers\LineController;
use App\Http\Controllers\SectionController;
use App\Http\Controllers\TrainingsController;
use App\Http\Controllers\MeetingsController; 
use App\Http\Controllers\EventsController; 
use App\Http\Controllers\HrCalendarController;
use App\Http\Controllers\CancelRestDayController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// Public Routes
Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

// Clear Cache Route
Route::get('cls', function(){
    Artisan::call('clear-compiled');
    echo "clear-compiled: complete<br>";
    Artisan::call('cache:clear');
    echo "cache:clear: complete<br>";
    Artisan::call('config:clear');
    echo "config:clear: complete<br>";
    Artisan::call('view:clear');
    echo "view:clear: complete<br>";
    Artisan::call('optimize:clear');
    echo "optimize:clear: complete<br>";
    Artisan::call('config:cache');
    echo "config:cache: complete<br>";
    Artisan::call('view:cache');
    echo "view:cache: complete<br>";
});

/*
|--------------------------------------------------------------------------
| Guest Routes (Authentication & Registration)
|--------------------------------------------------------------------------
*/
Route::middleware('guest')->group(function () {
    // Authentication Routes
    Route::get('login', [AuthenticatedSessionController::class, 'create'])
        ->name('login');
    Route::post('login', [AuthenticatedSessionController::class, 'store']);
    
    // Employee Registration Routes
    Route::get('employee/register', [EmployeeRegistrationController::class, 'create'])
        ->name('employee.register');
    Route::post('employee/register', [EmployeeRegistrationController::class, 'store']);
});

// Logout Route
Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
    ->middleware('auth')
    ->name('logout');

/*
|--------------------------------------------------------------------------
| Authenticated Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified'])->group(function () {
    
    /*
    |--------------------------------------------------------------------------
    | Dashboard Routes
    |--------------------------------------------------------------------------
    */
    // Main Dashboard Route - redirects to the appropriate dashboard based on role
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    
    // Role-Specific Dashboard Routes
    Route::get('/employee/dashboard', function () {
        return Inertia::render('EmployeeDashboard', [
            'auth' => ['user' => auth()->user()]
        ]);
    })->name('employee.dashboard');

    Route::get('/department-manager/dashboard', [DashboardController::class, 'departmentManagerDashboard'])
        ->middleware('role:department_manager,superadmin')
        ->name('department_manager.dashboard');

    Route::get('/superadmin/dashboard', function () {
        return Inertia::render('SuperadminDashboard', [
            'auth' => ['user' => auth()->user()]
        ]);
    })->middleware('role:superadmin')->name('superadmin.dashboard');

    Route::get('/hrd/dashboard', [DashboardController::class, 'hrdManagerDashboard'])
        ->middleware('role:hrd_manager,superadmin')
        ->name('hrd_manager.dashboard');

    Route::get('/finance/dashboard', function () {
        return Inertia::render('FinanceDashboard', [
            'auth' => ['user' => auth()->user()]
        ]);
    })->middleware('role:finance,superadmin')->name('finance.dashboard');

    /*
    |--------------------------------------------------------------------------
    | Profile Routes
    |--------------------------------------------------------------------------
    */
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    /*
    |--------------------------------------------------------------------------
    | Reports Routes
    |--------------------------------------------------------------------------
    */
    Route::get('/reports', function () {
        return Inertia::render('Reports/Index', [
            'auth' => ['user' => auth()->user()]
        ]);
    })->name('reports.index');

    /*
    |--------------------------------------------------------------------------
    | Employee Self-Service Routes (Payroll)
    |--------------------------------------------------------------------------
    */
    // Employee payroll lookup (for employee self-service)
    Route::get('/my-payroll', [FinalPayrollController::class, 'myPayroll'])
        ->name('my-payroll');
    
    Route::get('/my-payroll/{id}/payslip', [FinalPayrollController::class, 'generatePayslip'])
        ->name('my-payroll.payslip')
        ->where('id', '[0-9]+');
    
    // Payroll statistics for dashboard
    Route::get('/payroll-stats', [FinalPayrollController::class, 'getPayrollStats'])
        ->name('payroll.stats');
});

/*
|--------------------------------------------------------------------------
| SuperAdmin Only Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified', 'role:superadmin'])->group(function () {
    // Department Manager Routes
    Route::post('/department-managers', [DepartmentManagerController::class, 'store'])
        ->name('department-managers.store');
    Route::delete('/department-managers/{id}', [DepartmentManagerController::class, 'destroy'])
        ->name('department-managers.destroy');

    /*
    |--------------------------------------------------------------------------
    | Comprehensive Payroll Summaries Admin Routes
    |--------------------------------------------------------------------------
    */
    
    // Force unlock locked summaries
    Route::post('/comprehensive-payroll-summaries/force-unlock', [PayrollSummariesController::class, 'forceUnlock'])
        ->name('comprehensive-payroll-summaries.force-unlock');
    
    // Bulk delete summaries
    Route::delete('/comprehensive-payroll-summaries/bulk-delete', [PayrollSummariesController::class, 'bulkDelete'])
        ->name('comprehensive-payroll-summaries.bulk-delete');
    
    // Force recalculation
    Route::post('/comprehensive-payroll-summaries/force-recalculate-all', [PayrollSummariesController::class, 'forceRecalculateAll'])
        ->name('comprehensive-payroll-summaries.force-recalculate-all');

    /*
    |--------------------------------------------------------------------------
    | Final Payroll Administrative Routes (Superadmin only)
    |--------------------------------------------------------------------------
    */
    // Data migration and fixes
    Route::post('/final-payrolls/migrate-legacy-data', [FinalPayrollController::class, 'migrateLegacyData'])
        ->name('final-payrolls.migrate-legacy-data');
    
    Route::post('/final-payrolls/fix-calculations', [FinalPayrollController::class, 'fixCalculations'])
        ->name('final-payrolls.fix-calculations');
    
    Route::post('/final-payrolls/recalculate-all', [FinalPayrollController::class, 'recalculateAll'])
        ->name('final-payrolls.recalculate-all');
    
    Route::post('/final-payrolls/force-approve', [FinalPayrollController::class, 'forceApprove'])
        ->name('final-payrolls.force-approve');
    
    // Archive and cleanup
    Route::post('/final-payrolls/archive-old-payrolls', [FinalPayrollController::class, 'archiveOldPayrolls'])
        ->name('final-payrolls.archive-old-payrolls');
    
    Route::delete('/final-payrolls/purge-drafts', [FinalPayrollController::class, 'purgeDrafts'])
        ->name('final-payrolls.purge-drafts');
});

/*
|--------------------------------------------------------------------------
| Employee Management Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified', 'role:hrd_manager,superadmin'])
    ->prefix('employees')
    ->group(function () {
        // Import Routes - MUST be defined before the general routes to avoid conflicts
        Route::get('/import', [EmployeeImportController::class, 'showImport'])->name('employees.import');
        Route::post('/import', [EmployeeImportController::class, 'import'])->name('employees.import.process');
        Route::get('/template/download', [EmployeeImportController::class, 'downloadTemplate'])->name('employees.template.download');
        
        // Regular Employee Routes
        Route::get('/', [EmployeeController::class, 'index'])->name('employees.index');
        Route::get('/list', [EmployeeController::class, 'index'])->name('employees.list');
        Route::post('/', [EmployeeController::class, 'store'])->name('employees.store');
        Route::put('/{id}', [EmployeeController::class, 'update'])->name('employees.update');
        Route::delete('/{id}', [EmployeeController::class, 'destroy'])->name('employees.destroy');
        
        // Employee Status Management
        Route::post('/{id}/mark-inactive', [EmployeeController::class, 'markInactive'])->name('employees.markInactive');
        Route::post('/{id}/mark-blocked', [EmployeeController::class, 'markBlocked'])->name('employees.markBlocked');
        Route::post('/{id}/mark-active', [EmployeeController::class, 'markActive'])->name('employees.markActive');

        Route::get('/export', [EmployeeController::class, 'exportExcel'])->name('employees.export');
    });

/*
|--------------------------------------------------------------------------
| Attendance Management Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified', 'role:hrd_manager,superadmin'])->group(function () {

    // Main Employee Scheduling Page
    Route::get('/employee-scheduling', [EmployeeScheduleController::class, 'index'])
        ->name('employee-schedules.index');
    
    // API Routes for Employee Schedules
    Route::get('/employee-schedules/list', [EmployeeScheduleController::class, 'list'])
        ->name('employee-schedules.list');
    
    Route::post('/employee-schedules', [EmployeeScheduleController::class, 'store'])
        ->name('employee-schedules.store');
    
    Route::put('/employee-schedules/{id}', [EmployeeScheduleController::class, 'update'])
        ->name('employee-schedules.update')
        ->where('id', '[0-9]+');
    
    Route::delete('/employee-schedules/{id}', [EmployeeScheduleController::class, 'destroy'])
        ->name('employee-schedules.destroy')
        ->where('id', '[0-9]+');
    
    // Import/Export Routes
    Route::post('/employee-schedules/import', [EmployeeScheduleController::class, 'import'])
        ->name('employee-schedules.import');
    
    Route::get('/employee-schedules/export', [EmployeeScheduleController::class, 'export'])
        ->name('employee-schedules.export');
    
    Route::get('/employee-schedules/template/download', [EmployeeScheduleController::class, 'downloadTemplate'])
        ->name('employee-schedules.template.download');
    
    // Utility Routes
    Route::get('/employee-schedules/departments', [EmployeeScheduleController::class, 'getDepartments'])
        ->name('employee-schedules.departments');
    
    // Calendar Data Routes
    Route::get('/employee-schedules/calendar-events', [EmployeeScheduleController::class, 'getCalendarEvents'])
        ->name('employee-schedules.calendar-events');
    
    // Statistics Route
    Route::get('/employee-schedules/statistics', [EmployeeScheduleController::class, 'getStatistics'])
        ->name('employee-schedules.statistics');

    Route::middleware(['auth:sanctum'])->prefix('api/employee-schedules')->group(function () {
    
    // Get employee's current schedule
    Route::get('/employee/{employeeId}/current', [EmployeeScheduleController::class, 'getEmployeeCurrentSchedule'])
        ->name('api.employee-schedules.employee.current')
        ->where('employeeId', '[0-9]+');
    
    // Get employee's schedule history
    Route::get('/employee/{employeeId}/history', [EmployeeScheduleController::class, 'getEmployeeScheduleHistory'])
        ->name('api.employee-schedules.employee.history')
        ->where('employeeId', '[0-9]+');
    
    // Get schedules for a specific date range
    Route::get('/date-range/{startDate}/{endDate}', [EmployeeScheduleController::class, 'getSchedulesInDateRange'])
        ->name('api.employee-schedules.date-range')
        ->where(['startDate' => '[0-9]{4}-[0-9]{2}-[0-9]{2}', 'endDate' => '[0-9]{4}-[0-9]{2}-[0-9]{2}']);
    
    // Get department schedules
    Route::get('/department/{department}', [EmployeeScheduleController::class, 'getDepartmentSchedules'])
        ->name('api.employee-schedules.department');
    
    // Get shift conflicts
    Route::post('/check-conflicts', [EmployeeScheduleController::class, 'checkScheduleConflicts'])
        ->name('api.employee-schedules.check-conflicts');
});

    // Biometric Devices
    Route::get('/biometric-devices', [BiometricController::class, 'index'])
        ->name('biometric-devices.index');
    Route::post('/biometric-devices', [BiometricController::class, 'storeDevice'])
        ->name('biometric-devices.store');
    Route::put('/biometric-devices/{id}', [BiometricController::class, 'updateDevice'])
        ->name('biometric-devices.update');
    Route::delete('/biometric-devices/{id}', [BiometricController::class, 'deleteDevice'])
        ->name('biometric-devices.destroy');
    Route::post('/biometric-devices/test-connection', [BiometricController::class, 'testConnection'])
        ->name('biometric-devices.test-connection');
    Route::post('/biometric-devices/fetch-logs', [BiometricController::class, 'fetchLogs'])
        ->name('biometric-devices.fetch-logs');
    Route::post('/biometric-devices/diagnostic', [BiometricController::class, 'diagnosticTest'])
        ->name('biometric-devices.diagnostic');
    
    // Attendance Import Routes
    Route::get('/attendance/import', [AttendanceController::class, 'showImportPage'])
        ->name('attendance.import');
    Route::post('/attendance/import', [AttendanceController::class, 'import'])
        ->name('attendance.import.process');
    Route::get('/attendance/template/download', [AttendanceController::class, 'downloadTemplate'])
        ->name('attendance.template.download');
    
    // Manual Attendance Entry
    Route::get('/timesheet/manual-entry', [BiometricController::class, 'manualEntryForm'])
        ->name('timesheet.manual-entry');
    Route::post('/attendance/manual', [BiometricController::class, 'storeManualEntry'])
        ->name('attendance.manual.store');
    
    // Attendance Reports
    Route::get('/timesheet/report', [BiometricController::class, 'getAttendanceReport'])
        ->name('attendance.report');
    Route::get('/timesheet/report/data', [BiometricController::class, 'getAttendanceReport'])
        ->name('attendance.report.data');
    Route::get('/timesheet/report/export', [BiometricController::class, 'exportAttendanceReport'])
        ->name('attendance.report.export');
    
    // Attendance CRUD Operations
    Route::get('/timesheet/attendance/{id}/edit', [BiometricController::class, 'editAttendance'])
        ->name('attendance.edit');
    Route::put('/timesheet/attendance/{id}', [BiometricController::class, 'updateAttendance'])
        ->name('attendance.update');
    Route::delete('/timesheet/attendance/{id}', [BiometricController::class, 'deleteAttendance'])
        ->name('attendance.delete');

    // Processed Attendance Routes
    Route::get('/attendance', [ProcessedAttendanceController::class, 'index'])
        ->name('attendance.index');
    Route::get('/attendance/list', [ProcessedAttendanceController::class, 'list'])
        ->name('attendance.list');
    Route::put('/attendance/{id}', [ProcessedAttendanceController::class, 'update'])
        ->name('attendance.update');
    
    // Auto-recalculation route
    Route::post('/attendance/recalculate-all', [ProcessedAttendanceController::class, 'recalculateAll'])
        ->name('attendance.recalculate-all');
    
    Route::get('/processattendance/download-template', [ProcessedAttendanceController::class, 'downloadTemplate'])
        ->name('processattendance.download-template');
    Route::post('/processattendance/import', [ProcessedAttendanceController::class, 'importAttendance'])
        ->name('attendance.import');
    
    // Set holiday route
    Route::post('/attendance/set-holiday', [ProcessedAttendanceController::class, 'setHoliday'])
        ->name('attendance.set-holiday');
    
    // Sync and Delete functionality
    Route::post('/attendance/sync', [ProcessedAttendanceController::class, 'sync'])
        ->name('attendance.sync');
    Route::post('/attendance/{id}/sync', [ProcessedAttendanceController::class, 'syncIndividual'])
        ->name('attendance.sync.individual');
    Route::delete('/attendance/{id}', [ProcessedAttendanceController::class, 'destroy'])
        ->name('attendance.destroy');
    Route::post('/attendance/bulk-delete', [ProcessedAttendanceController::class, 'bulkDestroy'])
        ->name('attendance.bulk-delete');
    
    // Posting Status Routes
    Route::post('/attendance/mark-as-posted', [ProcessedAttendanceController::class, 'markAsPosted'])
        ->name('attendance.mark-as-posted');
    Route::post('/attendance/mark-as-not-posted', [ProcessedAttendanceController::class, 'markAsNotPosted'])
        ->name('attendance.mark-as-not-posted');
    
    // Utility routes
    Route::get('/attendance/departments', [ProcessedAttendanceController::class, 'getDepartments'])
        ->name('attendance.departments');
    Route::get('/attendance/export', [ProcessedAttendanceController::class, 'export'])
        ->name('attendance.export');

    Route::post('/attendance/posting-preview', [ProcessedAttendanceController::class, 'getPostingPreview'])
        ->name('attendance.posting-preview');
    Route::post('/attendance/post-to-payroll', [ProcessedAttendanceController::class, 'postToPayroll'])
        ->name('attendance.post-to-payroll');
    
    // Payroll summaries management
    Route::get('/payroll-summaries', [ProcessedAttendanceController::class, 'getPayrollSummaries'])
        ->name('payroll-summaries.index');
    Route::get('/payroll-summaries/export', [ProcessedAttendanceController::class, 'exportPayrollSummaries'])
        ->name('payroll-summaries.export');
    Route::delete('/payroll-summaries/{id}', [ProcessedAttendanceController::class, 'deletePayrollSummary'])
        ->name('payroll-summaries.destroy');

    Route::post('/attendance/detect-dtr-problems', [ProcessedAttendanceController::class, 'detectDtrProblems'])
    ->name('attendance.detect-dtr-problems');
    
    // Attendance details for payroll summaries
    Route::get('/payroll-summaries/{id}/attendance-details', [ProcessedAttendanceController::class, 'getPayrollSummaryAttendanceDetails'])
        ->name('payroll-summaries.attendance-details')
        ->where('id', '[0-9]+');
    
    // Payroll summaries page view
    Route::get('/payroll-summaries-page', function () {
        return Inertia::render('Timesheet/PayrollSummaries', [
            'auth' => ['user' => auth()->user()]
        ]);
    })->name('payroll-summaries.page');
});

/*
|--------------------------------------------------------------------------
| Travel Orders Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified', 'role:hrd_manager,superadmin'])->group(function () {
    // Index route
    Route::get('/travel-orders', [TravelOrderController::class, 'index'])
        ->name('travel-orders.index');
    
    // Export route - specific route, must come before parameterized routes
    Route::get('/travel-orders/export', [TravelOrderController::class, 'export'])
        ->name('travel-orders.export');
    
    // Store route
    Route::post('/travel-orders', [TravelOrderController::class, 'store'])
        ->name('travel-orders.store');
    
    // Bulk actions - specific routes, must come before parameterized routes
    Route::post('/travel-orders/bulk-update', [TravelOrderController::class, 'bulkUpdateStatus'])
        ->name('travel-orders.bulkUpdateStatus');
    
    // Force approve route (superadmin only)
    Route::post('/travel-orders/force-approve', [TravelOrderController::class, 'forceApprove'])
        ->middleware('role:superadmin')
        ->name('travel-orders.force-approve');
    
    // Document download route - specific parameterized route
    Route::get('/travel-orders/{id}/documents/{index}/download', [TravelOrderController::class, 'downloadDocument'])
        ->name('travel-orders.download-document')
        ->where(['id' => '[0-9]+', 'index' => '[0-9]+']);
    
    // Status update route
    Route::post('/travel-orders/{travelOrder}/status', [TravelOrderController::class, 'updateStatus'])
        ->name('travel-orders.updateStatus')
        ->where(['travelOrder' => '[0-9]+']);
    
    // DELETE routes
    Route::delete('/travel-orders/{id}', [TravelOrderController::class, 'destroy'])
        ->name('travel-orders.destroy')
        ->where(['id' => '[0-9]+']);
    
    // Alternative POST delete route for browsers that don't support DELETE
    Route::post('/travel-orders/{id}/delete', [TravelOrderController::class, 'destroy'])
        ->name('travel-orders.destroy.post')
        ->where(['id' => '[0-9]+']);
});

/*
|--------------------------------------------------------------------------
| Overtime Routes - Available to all authenticated users
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/overtimes', [OvertimeController::class, 'index'])
        ->name('overtimes.index');
    Route::post('/overtimes', [OvertimeController::class, 'store'])
        ->name('overtimes.store');
    Route::post('/overtimes/{overtime}/status', [OvertimeController::class, 'updateStatus'])
        ->name('overtimes.updateStatus');
    Route::post('/overtimes/{overtime}/delete', [OvertimeController::class, 'destroy'])
        ->name('overtimes.destroy.post');
    Route::get('/overtimes/export', [OvertimeController::class, 'export'])
        ->name('overtimes.export');
    Route::post('/overtimes/explain-rate', [OvertimeController::class, 'explainRateCalculation'])
        ->name('overtimes.explain-rate');
    
    // Rate update route - Allow updating rate for pending overtimes
    Route::post('/overtimes/{overtime}/rate', [OvertimeController::class, 'updateRate'])
        ->name('overtimes.updateRate');
    
    // Bulk Actions for managers
    Route::middleware('role:department_manager,hrd_manager,superadmin')->group(function () {
        Route::post('/overtimes/bulk-update', [OvertimeController::class, 'bulkUpdateStatus'])
            ->name('overtimes.bulkUpdateStatus');
        
        // Force approve route (superadmin only)
        Route::middleware('role:superadmin')->group(function () {
            Route::post('/overtimes/force-approve', [OvertimeController::class, 'forceApprove'])
                ->name('overtimes.force-approve');
        });
    });
});

/*
|--------------------------------------------------------------------------
| HR-Related Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified', 'role:hrd_manager,superadmin'])->group(function () {
    
    // Offsets Routes
    Route::get('/offsets', [OffsetController::class, 'index'])->name('offsets.index');
    Route::post('/offsets', [OffsetController::class, 'store'])->name('offsets.store');
    Route::post('/offsets/{id}/status', [OffsetController::class, 'updateStatus'])->name('offsets.updateStatus');
    Route::delete('/offsets/{id}', [OffsetController::class, 'destroy'])->name('offsets.destroy');
    Route::get('/offsets/export', [OffsetController::class, 'export'])->name('offsets.export');
    Route::get('/offsets/bank/{employeeId}', [OffsetController::class, 'getOffsetBank'])->name('offsets.getOffsetBank');
    Route::post('/offsets/add-hours-to-bank', [OffsetController::class, 'addHoursToBank'])->name('offsets.addHoursToBank');
    
    // Bulk Actions for managers
    Route::middleware('role:department_manager,hrd_manager,superadmin')->group(function () {
        Route::post('/offsets/bulk-update', [OffsetController::class, 'bulkUpdateStatus'])
            ->name('offsets.bulkUpdateStatus');
        
        // Force approve route (superadmin only)
        Route::middleware('role:superadmin')->group(function () {
            Route::post('/offsets/force-approve', [OffsetController::class, 'forceApprove'])
                ->name('offsets.force-approve');
        });
    });

    // Change Off Schedule Routes
    Route::get('/change-off-schedules', [ChangeOffScheduleController::class, 'index'])->name('change-off-schedules.index');
    Route::post('/change-off-schedules', [ChangeOffScheduleController::class, 'store'])->name('change-off-schedules.store');
    Route::post('/change-off-schedules/{id}/status', [ChangeOffScheduleController::class, 'updateStatus'])->name('change-off-schedules.updateStatus');
    Route::delete('/change-off-schedules/{id}', [ChangeOffScheduleController::class, 'destroy'])->name('change-off-schedules.destroy');
    Route::post('/change-off-schedules/{id}/delete', [ChangeOffScheduleController::class, 'destroy'])->name('change-off-schedules.destroy-post');
    Route::get('/change-off-schedules/export', [ChangeOffScheduleController::class, 'export'])->name('change-off-schedules.export');
    Route::post('/change-off-schedules/bulk-update', [ChangeOffScheduleController::class, 'bulkUpdateStatus'])->name('change-off-schedules.bulkUpdateStatus');
    
    // Force approve route (superadmin only)
    Route::middleware('role:superadmin')->group(function () {
        Route::post('/change-off-schedules/force-approve', [ChangeOffScheduleController::class, 'forceApprove'])
            ->name('change-off-schedules.force-approve');
    });

    // Time Schedule Routes
    Route::get('/time-schedules', [TimeScheduleController::class, 'index'])->name('time-schedules.index');
    Route::post('/time-schedules', [TimeScheduleController::class, 'store'])->name('time-schedules.store');
    Route::post('/time-schedules/{id}/status', [TimeScheduleController::class, 'updateStatus'])->name('time-schedules.updateStatus');
    Route::delete('/time-schedules/{id}', [TimeScheduleController::class, 'destroy'])->name('time-schedules.destroy');
    Route::post('/time-schedules/{id}/delete', [TimeScheduleController::class, 'destroy'])->name('time-schedules.destroy-post');
    Route::get('/time-schedules/export', [TimeScheduleController::class, 'export'])->name('time-schedules.export');
    Route::post('/time-schedules/bulk-update', [TimeScheduleController::class, 'bulkUpdateStatus'])->name('time-schedules.bulkUpdateStatus');
    
    // Force approve route (superadmin only)
    Route::middleware('role:superadmin')->group(function () {
        Route::post('/time-schedules/force-approve', [TimeScheduleController::class, 'forceApprove'])
            ->name('time-schedules.force-approve');
    });

    // Official Business Routes
    Route::get('/official-business', [OfficialBusinessController::class, 'index'])->name('official-business.index');
    Route::post('/official-business', [OfficialBusinessController::class, 'store'])->name('official-business.store');
    Route::post('/official-business/{id}/status', [OfficialBusinessController::class, 'updateStatus'])->name('official-business.updateStatus');
    Route::delete('/official-business/{id}', [OfficialBusinessController::class, 'destroy'])->name('official-business.destroy');
    Route::get('/official-business/export', [OfficialBusinessController::class, 'export'])->name('official-business.export');

    // Retro Routes
    Route::get('/retro', [RetroController::class, 'index'])->name('retro.index');
    Route::post('/retro', [RetroController::class, 'store'])->name('retro.store');
    Route::get('/retro/export', [RetroController::class, 'export'])->name('retro.export');
    Route::post('/retro/bulk-update-status', [RetroController::class, 'bulkUpdateStatus'])->name('retro.bulkUpdateStatus');
    Route::post('/retro/force-approve', [RetroController::class, 'forceApprove'])
        ->middleware('role:superadmin')
        ->name('retro.force-approve');
    Route::post('/retro/{id}/status', [RetroController::class, 'updateStatus'])
        ->name('retro.updateStatus')
        ->where('id', '[0-9]+');
    Route::delete('/retro/{id}', [RetroController::class, 'destroy'])
        ->name('retro.destroy')
        ->where('id', '[0-9]+');
    Route::post('/retro/{id}/delete', [RetroController::class, 'destroy'])
        ->name('retro.destroy.post')
        ->where('id', '[0-9]+');

    // SLVL (Sick Leave/Vacation Leave) Routes
    Route::get('/slvl', [SLVLController::class, 'index'])->name('slvl.index');
    Route::post('/slvl', [SLVLController::class, 'store'])->name('slvl.store');
    Route::post('/slvl/{id}/status', [SLVLController::class, 'updateStatus'])->name('slvl.updateStatus');
    Route::delete('/slvl/{id}', [SLVLController::class, 'destroy'])->name('slvl.destroy');
    Route::get('/slvl/export', [SLVLController::class, 'export'])->name('slvl.export');
    Route::get('/slvl/bank/{employeeId}', [SLVLController::class, 'getSLVLBank'])->name('slvl.getSLVLBank');
    Route::get('/slvl/employees-bank-data', [SLVLController::class, 'getEmployeesWithBankData'])->name('slvl.getEmployeesWithBankData');
    Route::post('/slvl/add-days-to-bank', [SLVLController::class, 'addDaysToBank'])->name('slvl.addDaysToBank');
    Route::post('/slvl/bulk-add-days-to-bank', [SLVLController::class, 'bulkAddDaysToBank'])->name('slvl.bulkAddDaysToBank');
    
    // Bulk Actions for managers
    Route::middleware('role:department_manager,hrd_manager,superadmin')->group(function () {
        Route::post('/slvl/bulk-update', [SLVLController::class, 'bulkUpdateStatus'])
            ->name('slvl.bulkUpdateStatus');
        
        // Force approve route (superadmin only)
        Route::middleware('role:superadmin')->group(function () {
            Route::post('/slvl/force-approve', [SLVLController::class, 'forceApprove'])
                ->name('slvl.force-approve');
        });
    });

    // Cancel Rest Day Routes
    Route::get('/cancel-rest-days', [CancelRestDayController::class, 'index'])->name('cancel-rest-days.index');
    Route::post('/cancel-rest-days', [CancelRestDayController::class, 'store'])->name('cancel-rest-days.store');
    Route::post('/cancel-rest-days/{id}/status', [CancelRestDayController::class, 'updateStatus'])
        ->name('cancel-rest-days.updateStatus')
        ->where(['id' => '[0-9]+']);
    Route::post('/cancel-rest-days/bulk-update', [CancelRestDayController::class, 'bulkUpdateStatus'])
        ->name('cancel-rest-days.bulkUpdateStatus');
    Route::get('/cancel-rest-days/export', [CancelRestDayController::class, 'export'])
        ->name('cancel-rest-days.export');
    Route::delete('/cancel-rest-days/{id}', [CancelRestDayController::class, 'destroy'])
        ->name('cancel-rest-days.destroy')
        ->where(['id' => '[0-9]+']);
    Route::post('/cancel-rest-days/{id}/delete', [CancelRestDayController::class, 'destroy'])
        ->name('cancel-rest-days.destroy.post')
        ->where(['id' => '[0-9]+']);
    
    // Force approve route (superadmin only)
    Route::middleware('role:superadmin')->group(function () {
        Route::post('/cancel-rest-days/force-approve', [CancelRestDayController::class, 'forceApprove'])
            ->name('cancel-rest-days.force-approve');
    });

    /*
    |--------------------------------------------------------------------------
    | Final Payroll Management Routes (HRD Manager access)
    |--------------------------------------------------------------------------
    */
    // Advanced Final Payroll Operations
    Route::post('/final-payrolls/bulk-generate', [FinalPayrollController::class, 'bulkGenerate'])
        ->name('final-payrolls.bulk-generate');
    
    Route::post('/final-payrolls/batch-recalculate', [FinalPayrollController::class, 'batchRecalculate'])
        ->name('final-payrolls.batch-recalculate');
    
    // Payroll Validation Routes
    Route::post('/final-payrolls/validate-period', [FinalPayrollController::class, 'validatePeriod'])
        ->name('final-payrolls.validate-period');
    
    Route::post('/final-payrolls/check-consistency', [FinalPayrollController::class, 'checkConsistency'])
        ->name('final-payrolls.check-consistency');
});

/*
|--------------------------------------------------------------------------
| Finance Routes (Including Final Payroll)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified', 'role:finance,hrd_manager,superadmin'])->group(function () {

    /*
    |--------------------------------------------------------------------------
    | Comprehensive Payroll Summaries Routes
    |--------------------------------------------------------------------------
    */
    
    // Main page route
    Route::get('/comprehensive-payroll-summaries', [PayrollSummariesController::class, 'index'])
        ->name('comprehensive-payroll-summaries.index');
    
    // Data Management Routes
    Route::get('/api/comprehensive-payroll-summaries/list', [PayrollSummariesController::class, 'list'])
        ->name('comprehensive-payroll-summaries.list');
    
    Route::post('/comprehensive-payroll-summaries', [PayrollSummariesController::class, 'store'])
        ->name('comprehensive-payroll-summaries.store');
    
    Route::put('/comprehensive-payroll-summaries/{id}', [PayrollSummariesController::class, 'update'])
        ->name('comprehensive-payroll-summaries.update')
        ->where('id', '[0-9]+');
    
    Route::delete('/comprehensive-payroll-summaries/{id}', [PayrollSummariesController::class, 'destroy'])
        ->name('comprehensive-payroll-summaries.destroy')
        ->where('id', '[0-9]+');
    
    // Status Management Routes
    Route::patch('/comprehensive-payroll-summaries/{id}/status', [PayrollSummariesController::class, 'updateStatus'])
        ->name('comprehensive-payroll-summaries.update-status')
        ->where('id', '[0-9]+');
    
    Route::patch('/comprehensive-payroll-summaries/bulk-status', [PayrollSummariesController::class, 'bulkUpdateStatus'])
        ->name('comprehensive-payroll-summaries.bulk-update-status');
    
    // Bulk Operations Routes
    Route::post('/comprehensive-payroll-summaries/bulk-generate', [PayrollSummariesController::class, 'bulkGenerate'])
        ->name('comprehensive-payroll-summaries.bulk-generate');
    
    // Export Routes
    Route::get('/comprehensive-payroll-summaries/export', [PayrollSummariesController::class, 'export'])
        ->name('comprehensive-payroll-summaries.export');
    
    // Utility Routes
    Route::get('/comprehensive-payroll-summaries/departments', [PayrollSummariesController::class, 'getDepartments'])
        ->name('comprehensive-payroll-summaries.departments');
    
    // Sync Routes
    Route::post('/comprehensive-payroll-summaries/sync-attendance', [PayrollSummariesController::class, 'syncWithAttendance'])
        ->name('comprehensive-payroll-summaries.sync-attendance');
    
    Route::post('/comprehensive-payroll-summaries/sync-benefits-deductions', [PayrollSummariesController::class, 'syncBenefitsDeductions'])
        ->name('comprehensive-payroll-summaries.sync-benefits-deductions');
    
    /*
    |--------------------------------------------------------------------------
    | Final Payroll Routes
    |--------------------------------------------------------------------------
    */
    
    // Final Payroll Main Routes
    Route::get('/final-payrolls', [FinalPayrollController::class, 'index'])
        ->name('final-payrolls.index');
    
    Route::get('/final-payroll', function () {
        return Inertia::render('Payroll/FinalPayroll', [
            'auth' => ['user' => auth()->user()]
        ]);
    })->name('final-payroll.page');
    
    // Individual Final Payroll Operations
    Route::get('/final-payrolls/{id}', [FinalPayrollController::class, 'show'])
        ->name('final-payrolls.show')
        ->where('id', '[0-9]+');
    
    Route::put('/final-payrolls/{id}', [FinalPayrollController::class, 'update'])
        ->name('final-payrolls.update')
        ->where('id', '[0-9]+');
    
    Route::delete('/final-payrolls/{id}', [FinalPayrollController::class, 'destroy'])
        ->name('final-payrolls.destroy')
        ->where('id', '[0-9]+');
    
    // Generation Routes
    Route::post('/final-payrolls/generate-from-summaries', [FinalPayrollController::class, 'generateFromSummaries'])
        ->name('final-payrolls.generate-from-summaries');
    
    Route::post('/final-payrolls/available-summaries', [FinalPayrollController::class, 'getAvailableSummaries'])
        ->name('final-payrolls.available-summaries');
    
    // Status Management Routes
    Route::post('/final-payrolls/{id}/approve', [FinalPayrollController::class, 'approve'])
        ->name('final-payrolls.approve')
        ->where('id', '[0-9]+');
    
    Route::post('/final-payrolls/{id}/reject', [FinalPayrollController::class, 'reject'])
        ->name('final-payrolls.reject')
        ->where('id', '[0-9]+');
    
    Route::post('/final-payrolls/{id}/finalize', [FinalPayrollController::class, 'finalize'])
        ->name('final-payrolls.finalize')
        ->where('id', '[0-9]+');
    
    Route::post('/final-payrolls/{id}/mark-as-paid', [FinalPayrollController::class, 'markAsPaid'])
        ->name('final-payrolls.mark-as-paid')
        ->where('id', '[0-9]+');
    
    // Bulk Operations
    Route::post('/final-payrolls/bulk-approve', [FinalPayrollController::class, 'bulkApprove'])
        ->name('final-payrolls.bulk-approve');
    
    Route::post('/final-payrolls/bulk-finalize', [FinalPayrollController::class, 'bulkFinalize'])
        ->name('final-payrolls.bulk-finalize');
    
    Route::post('/final-payrolls/bulk-mark-as-paid', [FinalPayrollController::class, 'bulkMarkAsPaid'])
        ->name('final-payrolls.bulk-mark-as-paid');
    
    // Calculation and Analysis Routes
    Route::post('/final-payrolls/{id}/recalculate', [FinalPayrollController::class, 'recalculate'])
        ->name('final-payrolls.recalculate')
        ->where('id', '[0-9]+');
    
    Route::get('/final-payrolls/{id}/calculation-breakdown', [FinalPayrollController::class, 'getCalculationBreakdown'])
        ->name('final-payrolls.calculation-breakdown')
        ->where('id', '[0-9]+');
    
    // Export Routes
    Route::get('/final-payrolls/export', [FinalPayrollController::class, 'export'])
        ->name('final-payrolls.export');
    
    // Reports Routes
    Route::post('/final-payrolls/generate-report', [FinalPayrollController::class, 'generateReport'])
        ->name('final-payrolls.generate-report');

    Route::middleware(['auth:sanctum'])->prefix('api/comprehensive-payroll-summaries')->group(function () {

    // Enhanced API endpoints for final payroll integration
    Route::get('/available-for-final-payroll', [PayrollSummariesController::class, 'getAvailableForFinalPayroll'])
        ->name('api.comprehensive-payroll-summaries.available-for-final-payroll');
    
    Route::post('/generate-final-payrolls', [PayrollSummariesController::class, 'generateFinalPayrollsFromSummaries'])
        ->name('api.comprehensive-payroll-summaries.generate-final-payrolls');
    
    // Get summaries that can be regenerated
    Route::get('/regeneratable/{year}/{month}', [PayrollSummariesController::class, 'getRegeneratableSummaries'])
        ->name('api.comprehensive-payroll-summaries.regeneratable')
        ->where(['year' => '[0-9]{4}', 'month' => '[0-9]{1,2}']);
    
    // API endpoints for external integrations
    Route::get('/period/{year}/{month}/{period_type}', [PayrollSummariesController::class, 'apiGetPeriodSummaries'])
        ->name('api.comprehensive-payroll-summaries.period')
        ->where(['year' => '[0-9]{4}', 'month' => '[0-9]{1,2}', 'period_type' => '(1st_half|2nd_half)']);
    
    Route::get('/employee/{employeeId}/summary/{year}/{month}', [PayrollSummariesController::class, 'apiGetEmployeeSummary'])
        ->name('api.comprehensive-payroll-summaries.employee')
        ->where(['employeeId' => '[0-9]+', 'year' => '[0-9]{4}', 'month' => '[0-9]{1,2}']);

    // Get available summaries for final payroll generation
    Route::get('/api/comprehensive-payroll-summaries/available-for-final-payroll', [PayrollSummariesController::class, 'getAvailableForFinalPayroll'])
        ->name('comprehensive-payroll-summaries.available-for-final-payroll');

    // Generate final payrolls from summaries (connects to FinalPayrollController)
    Route::post('/comprehensive-payroll-summaries/generate-final-payrolls', [PayrollSummariesController::class, 'generateFinalPayrollsFromSummaries'])
        ->name('comprehensive-payroll-summaries.generate-final-payrolls');
    
});

    /*
    |--------------------------------------------------------------------------
    | Benefits Routes
    |--------------------------------------------------------------------------
    */
    Route::get('/benefits', [BenefitController::class, 'index'])->name('benefits.index');
    Route::post('/benefits', [BenefitController::class, 'store'])->name('benefits.store');
    Route::patch('/benefits/{id}', [BenefitController::class, 'update'])->name('benefits.update');
    Route::patch('/benefits/{id}/field', [BenefitController::class, 'updateField'])->name('benefits.updateField');
    Route::post('/benefits/{id}/post', [BenefitController::class, 'postBenefit'])->name('benefits.post');
    Route::post('/benefits/post-all', [BenefitController::class, 'postAll'])->name('benefits.postAll');
    Route::post('/benefits/bulk-post', [BenefitController::class, 'bulkPost'])->name('benefits.bulkPost');
    Route::post('/benefits/{id}/set-default', [BenefitController::class, 'setDefault'])->name('benefits.setDefault');
    Route::post('/benefits/bulk-set-default', [BenefitController::class, 'bulkSetDefaultBenefits'])->name('benefits.bulkSetDefault');
    Route::post('/benefits/create-from-default', [BenefitController::class, 'createFromDefault'])->name('benefits.createFromDefault');
    Route::post('/benefits/bulk-create', [BenefitController::class, 'bulkCreateFromDefault'])->name('benefits.bulkCreate');
    
    // Template and import/export routes
    Route::get('/benefits/template/download', [BenefitController::class, 'downloadTemplate'])->name('benefits.template.download');
    Route::post('/benefits/import', [BenefitController::class, 'import'])->name('benefits.import');
    Route::get('/benefits/export', [BenefitController::class, 'export'])->name('benefits.export');
    
    // Delete all not posted benefits
    Route::post('/benefits/delete-all-not-posted', [BenefitController::class, 'deleteAllNotPosted'])->name('benefits.deleteAllNotPosted');
    
    // Employee defaults routes
    Route::get('/employee-defaults', [BenefitController::class, 'showEmployeeDefaultsPage'])->name('employee-defaults.index');
    Route::get('/api/employee-defaults', [BenefitController::class, 'getEmployeeDefaults'])->name('api.employee-defaults');
    
    // Employee defaults template and import/export
    Route::get('/benefits/defaults/template/download', [BenefitController::class, 'downloadDefaultsTemplate'])->name('benefits.defaults.template.download');
    Route::post('/benefits/defaults/import', [BenefitController::class, 'importDefaults'])->name('benefits.defaults.import');
    Route::get('/benefits/defaults/export', [BenefitController::class, 'exportDefaults'])->name('benefits.defaults.export');

    /*
    |--------------------------------------------------------------------------
    | Deductions Routes
    |--------------------------------------------------------------------------
    */
    Route::get('/deductions', [DeductionController::class, 'index'])->name('deductions.index');
    Route::post('/deductions', [DeductionController::class, 'store'])->name('deductions.store');
    Route::patch('/deductions/{id}', [DeductionController::class, 'update'])->name('deductions.update');
    Route::patch('/deductions/{id}/field', [DeductionController::class, 'updateField'])->name('deductions.update-field');
    Route::post('/deductions/{id}/post', [DeductionController::class, 'postDeduction'])->name('deductions.post');
    Route::post('/deductions/{id}/set-default', [DeductionController::class, 'setDefault'])->name('deductions.set-default');
    Route::post('/deductions/post-all', [DeductionController::class, 'postAll'])->name('deductions.post-all');
    
    // Delete all not posted deductions route
    Route::post('/deductions/delete-all-not-posted', [DeductionController::class, 'deleteAllNotPosted'])->name('deductions.delete-all-not-posted');
    
    Route::post('/deductions/bulk-post', [DeductionController::class, 'bulkPost'])->name('deductions.bulk-post');
    Route::post('/deductions/bulk-set-default', [DeductionController::class, 'bulkSetDefault'])->name('deductions.bulk-set-default');
    Route::post('/deductions/create-from-default', [DeductionController::class, 'createFromDefault'])->name('deductions.create-from-default');
    Route::post('/deductions/bulk-create', [DeductionController::class, 'bulkCreateFromDefault'])->name('deductions.bulk-create');
    
    // Deductions Import/Export Routes
    Route::get('/deductions/template/download', [DeductionController::class, 'downloadTemplate'])->name('deductions.template.download');
    Route::post('/deductions/import', [DeductionController::class, 'import'])->name('deductions.import');
    Route::get('/deductions/export', [DeductionController::class, 'export'])->name('deductions.export');
});

/*
|--------------------------------------------------------------------------
| API Routes for Final Payroll Integration
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum'])->prefix('api/final-payrolls')->group(function () {
    
    // API endpoints for external integrations
    Route::get('/summary/{year}/{month}', [FinalPayrollController::class, 'apiGetPeriodSummary'])
        ->name('api.final-payrolls.period-summary')
        ->where(['year' => '[0-9]{4}', 'month' => '[0-9]{1,2}']);
    
    Route::get('/employee/{employeeId}/history', [FinalPayrollController::class, 'apiGetEmployeePayrollHistory'])
        ->name('api.final-payrolls.employee-history')
        ->where('employeeId', '[0-9]+');
    
    Route::get('/government-remittance/{year}/{month}', [FinalPayrollController::class, 'apiGetGovernmentRemittance'])
        ->name('api.final-payrolls.government-remittance')
        ->where(['year' => '[0-9]{4}', 'month' => '[0-9]{1,2}']);
    
    // Bank file generation
    Route::post('/generate-bank-file', [FinalPayrollController::class, 'generateBankFile'])
        ->name('api.final-payrolls.generate-bank-file');
    
    // Alphalist generation
    Route::post('/generate-alphalist', [FinalPayrollController::class, 'generateAlphalist'])
        ->name('api.final-payrolls.generate-alphalist');
});

/*
|--------------------------------------------------------------------------
| Management Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified', 'role:superadmin,hrd_manager'])->prefix('manage')->group(function () {
    Route::get('/departments', function () {
        return Inertia::render('Manage/Departments', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('manage.departments');
    
    Route::get('/lines-sections', function () {
        return Inertia::render('Manage/LineAndSection', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('manage.lines-sections');
    
    Route::get('/line-section', function () {
        return Inertia::render('Manage/LineAndSection', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('manage.line-section');
    
    Route::get('/roles', function () {
        return Inertia::render('Manage/RolesAndAccess', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('manage.roles');
});

/*
|--------------------------------------------------------------------------
| API Routes for Management
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum'])->group(function () {
    // Department routes
    Route::get('/departments', [DepartmentController::class, 'index']);
    Route::post('/departments', [DepartmentController::class, 'store']);
    Route::put('/departments/{id}', [DepartmentController::class, 'update']);
    Route::delete('/departments/{id}', [DepartmentController::class, 'destroy']);
    Route::patch('/departments/{id}/toggle-active', [DepartmentController::class, 'toggleActive']);
    
    // Line routes
    Route::get('/lines', [LineController::class, 'index']);
    Route::post('/lines', [LineController::class, 'store']);
    Route::put('/lines/{id}', [LineController::class, 'update']);
    Route::delete('/lines/{id}', [LineController::class, 'destroy']);
    Route::patch('/lines/{id}/toggle-active', [LineController::class, 'toggleActive']);

    // Section routes
    Route::get('/sections', [SectionController::class, 'index']);
    Route::post('/sections', [SectionController::class, 'store']);
    Route::put('/sections/{id}', [SectionController::class, 'update']);
    Route::delete('/sections/{id}', [SectionController::class, 'destroy']);
    Route::patch('/sections/{id}/toggle-active', [SectionController::class, 'toggleActive']);
});

/*
|--------------------------------------------------------------------------
| CoreHR Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified', 'role:superadmin,hrd_manager'])->group(function () {
    // Promotion Routes
    Route::get('/core-hr/promotion', function () {
        return Inertia::render('CoreHR/Promotion', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('promotions.page');
    Route::get('/promotions/list', [PromotionController::class, 'list'])->name('promotions.list');
    Route::post('/promotions', [PromotionController::class, 'store'])->name('promotions.store');
    Route::put('/promotions/{id}', [PromotionController::class, 'update'])->name('promotions.update');
    Route::post('/promotions/{id}/status', [PromotionController::class, 'updateStatus'])->name('promotions.updateStatus');
    Route::delete('/promotions/{id}', [PromotionController::class, 'destroy'])->name('promotions.destroy');
    Route::get('/promotions/export', [PromotionController::class, 'export'])->name('promotions.export');

    // Award Routes
    Route::get('/core-hr/award', function () {
        return Inertia::render('CoreHR/Award', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('awards.page');
    Route::get('/awards/list', [AwardController::class, 'list'])->name('awards.list');
    Route::post('/awards', [AwardController::class, 'store'])->name('awards.store');
    Route::put('/awards/{id}', [AwardController::class, 'update'])->name('awards.update');
    Route::delete('/awards/{id}', [AwardController::class, 'destroy'])->name('awards.destroy');
    Route::get('/awards/export', [AwardController::class, 'export'])->name('awards.export');

    // Transfer Routes
    Route::get('/core-hr/transfer', function () {
        return Inertia::render('CoreHR/Transfer', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('transfers.page');
    Route::get('/transfers/list', [TransferController::class, 'list'])->name('transfers.list');
    Route::post('/transfers', [TransferController::class, 'store'])->name('transfers.store');
    Route::put('/transfers/{id}', [TransferController::class, 'update'])->name('transfers.update');
    Route::post('/transfers/{id}/status', [TransferController::class, 'updateStatus'])->name('transfers.updateStatus');
    Route::delete('/transfers/{id}', [TransferController::class, 'destroy'])->name('transfers.destroy');
    Route::get('/transfers/export', [TransferController::class, 'export'])->name('transfers.export');

    // Resignation Routes
    Route::get('/core-hr/resignations', function () {
        return Inertia::render('CoreHR/Resignations', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('resignations.page');
    Route::get('/resignations/list', [ResignationController::class, 'list'])->name('resignations.list');
    Route::post('/resignations', [ResignationController::class, 'store'])->name('resignations.store');
    Route::put('/resignations/{id}', [ResignationController::class, 'update'])->name('resignations.update');
    Route::post('/resignations/{id}/status', [ResignationController::class, 'updateStatus'])->name('resignations.updateStatus');
    Route::delete('/resignations/{id}', [ResignationController::class, 'destroy'])->name('resignations.destroy');
    Route::get('/resignations/export', [ResignationController::class, 'export'])->name('resignations.export');

    // Complaint Routes
    Route::get('/core-hr/complaints', function () {
        return Inertia::render('CoreHR/Complaints', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('complaints.page');
    Route::get('/complaints/list', [ComplaintController::class, 'list'])->name('complaints.list');
    Route::post('/complaints', [ComplaintController::class, 'store'])->name('complaints.store');
    Route::put('/complaints/{id}', [ComplaintController::class, 'update'])->name('complaints.update');
    Route::post('/complaints/{id}/status', [ComplaintController::class, 'updateStatus'])->name('complaints.updateStatus');
    Route::delete('/complaints/{id}', [ComplaintController::class, 'destroy'])->name('complaints.destroy');
    Route::get('/complaints/export', [ComplaintController::class, 'export'])->name('complaints.export');

    // Warning Routes
    Route::get('/core-hr/warnings', function () {
        return Inertia::render('CoreHR/Warnings', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('warnings.page');
    Route::get('/warnings/list', [WarningController::class, 'list'])->name('warnings.list');
    Route::post('/warnings', [WarningController::class, 'store'])->name('warnings.store');
    Route::put('/warnings/{id}', [WarningController::class, 'update'])->name('warnings.update');
    Route::delete('/warnings/{id}', [WarningController::class, 'destroy'])->name('warnings.destroy');
    Route::get('/warnings/export', [WarningController::class, 'export'])->name('warnings.export');

    // Termination Routes
    Route::get('/core-hr/terminations', function () {
        return Inertia::render('CoreHR/Termination', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('terminations.page');
    Route::get('/terminations/list', [TerminationController::class, 'list'])->name('terminations.list');
    Route::post('/terminations', [TerminationController::class, 'store'])->name('terminations.store');
    Route::put('/terminations/{id}', [TerminationController::class, 'update'])->name('terminations.update');
    Route::post('/terminations/{id}/status', [TerminationController::class, 'updateStatus'])->name('terminations.updateStatus');
    Route::delete('/terminations/{id}', [TerminationController::class, 'destroy'])->name('terminations.destroy');
    Route::get('/terminations/export', [TerminationController::class, 'export'])->name('terminations.export');
});

/*
|--------------------------------------------------------------------------
| Meetings and Events Routes
|--------------------------------------------------------------------------
*/
Route::middleware(['auth', 'verified', 'role:superadmin,hrd_manager'])->group(function () {
    // Meetings Routes
    Route::get('/meetings', function () {
        $status = request()->input('status', 'all');
        
        $meetings = \App\Models\Meeting::query()
            ->when($status !== 'all', function ($query) use ($status) {
                return $query->where('status', $status);
            })
            ->with('participants')
            ->withCount('participants')
            ->orderBy('start_time', 'desc')
            ->get();
        
        $counts = [
            'total' => \App\Models\Meeting::count(),
            'scheduled' => \App\Models\Meeting::where('status', 'Scheduled')->count(),
            'completed' => \App\Models\Meeting::where('status', 'Completed')->count(),
            'cancelled' => \App\Models\Meeting::where('status', 'Cancelled')->count(),
            'postponed' => \App\Models\Meeting::where('status', 'Postponed')->count(),
        ];
        
        return Inertia::render('MeetingAndEvents/Meetings', [
            'meetings' => $meetings,
            'counts' => $counts,
            'currentStatus' => $status,
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('meetings.index');
    
    // API routes for Meetings
    Route::post('/meetings/{id}/reschedule', [MeetingsController::class, 'reschedule'])->name('meetings.reschedule');
    Route::get('/meetings/list', [MeetingsController::class, 'list'])->name('meetings.list');
    Route::post('/meetings', [MeetingsController::class, 'store'])->name('meetings.store');
    Route::put('/meetings/{id}', [MeetingsController::class, 'update'])->name('meetings.update');
    Route::delete('/meetings/{id}', [MeetingsController::class, 'destroy'])->name('meetings.destroy');
    Route::post('/meetings/{id}/mark-completed', [MeetingsController::class, 'markCompleted'])->name('meetings.mark-completed');
    Route::post('/meetings/{id}/mark-cancelled', [MeetingsController::class, 'markCancelled'])->name('meetings.mark-cancelled');
    Route::post('/meetings/{id}/mark-scheduled', [MeetingsController::class, 'markScheduled'])->name('meetings.mark-scheduled');
    Route::get('/meetings/export', [MeetingsController::class, 'export'])->name('meetings.export');
    Route::get('/api/employees', [EmployeeScheduleController::class, 'getEmployeesForSelect'])->name('api.employees');

    // Events Routes
    Route::get('/events', [EventsController::class, 'index'])->name('events.index');
    Route::get('/events/debug', [EventsController::class, 'debug'])->name('events.debug');
    Route::get('/events/list', [EventsController::class, 'list'])->name('events.list');
    Route::post('/events', [EventsController::class, 'store'])->name('events.store');
    Route::put('/events/{id}', [EventsController::class, 'update'])->name('events.update');
    Route::delete('/events/{id}', [EventsController::class, 'destroy'])->name('events.destroy');
    Route::post('/events/{id}/status', [EventsController::class, 'updateStatus'])->name('events.updateStatus');
    Route::get('/events/export', [EventsController::class, 'export'])->name('events.export');
    Route::put('/events/{id}/reschedule', [EventsController::class, 'reschedule'])->name('events.reschedule');

    // HR Calendar routes
    Route::get('/hr-calendar', function () {
        return Inertia::render('HRCalendar/HrCalendar', [
            'auth' => ['user' => Auth::user()]
        ]);
    })->name('hr-calendar.index');

    // API endpoints for HR Calendar
    Route::get('/hr-calendar/data', [HrCalendarController::class, 'getData'])->name('hr-calendar.data');
    Route::get('/hr-calendar/departments', [HrCalendarController::class, 'getDepartments'])->name('hr-calendar.departments');
});

// Include auth routes
require __DIR__.'/auth.php';