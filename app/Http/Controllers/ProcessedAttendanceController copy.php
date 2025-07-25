<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Department;
use App\Models\ProcessedAttendance;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class ProcessedAttendanceController extends Controller
{
    /**
     * Display the processed attendance records page
     */
    public function index(Request $request)
    {
        // Get query parameters for filtering
        $searchTerm = $request->input('search');
        $dateFilter = $request->input('date');
        $departmentFilter = $request->input('department');
        $editsOnlyFilter = $request->boolean('edits_only');
        $perPage = $request->input('per_page', 25);
        
        // Build query
        $query = $this->buildAttendanceQuery($request);
        
        // Order by date descending and paginate
        $attendances = $query->orderBy('processed_attendances.attendance_date', 'asc')
                             ->paginate($perPage);
        
        // Return Inertia view with data
        return Inertia::render('Timesheet/ProcessedAttendanceList', [
            'attendances' => $attendances->items(),
            'pagination' => [
                'total' => $attendances->total(),
                'per_page' => $attendances->perPage(),
                'current_page' => $attendances->currentPage(),
                'last_page' => $attendances->lastPage()
            ],
            'filters' => [
                'search' => $searchTerm,
                'date' => $dateFilter,
                'department' => $departmentFilter,
                'edits_only' => $editsOnlyFilter
            ],
            'auth' => [
                'user' => auth()->user()
            ]
        ]);
    }
    
    public function list(Request $request)
    {
        try {
            // Build query
            $query = $this->buildAttendanceQuery($request);
            $perPage = $request->input('per_page', 25);
            
            // Order by date descending and paginate
            $attendances = $query->orderBy('processed_attendances.attendance_date', 'desc')
                                ->paginate($perPage);
            
            // Process attendance data with accessors
            $processedData = $attendances->items();
            
            // Format the datetime fields for each record - WITH IMPROVED FORMATTING
            foreach ($processedData as &$attendance) {
                // Safely format time values to 12-hour format with better null handling
                $attendance->time_in = $this->safeFormatTime($attendance->time_in);
                $attendance->time_out = $this->safeFormatTime($attendance->time_out);
                $attendance->break_in = $this->safeFormatTime($attendance->break_in);
                $attendance->break_out = $this->safeFormatTime($attendance->break_out);
                $attendance->next_day_timeout = $this->safeFormatTime($attendance->next_day_timeout);
                
                // Format date and get day of week
                if ($attendance->attendance_date) {
                    $attendance->attendance_date_formatted = $attendance->attendance_date->format('Y-m-d');
                    $attendance->day = $attendance->attendance_date->format('l'); // This gets the day name (Monday, Tuesday, etc.)
                } else {
                    $attendance->attendance_date_formatted = null;
                    $attendance->day = null;
                }
                
                // Add employee name for display
                if ($attendance->employee) {
                    $attendance->employee_name = trim($attendance->employee->Fname . ' ' . $attendance->employee->Lname);
                    $attendance->idno = $attendance->employee->idno;
                    $attendance->department = $attendance->employee->Department;
                    $attendance->line = $attendance->employee->Line;
                } else {
                    $attendance->employee_name = 'Unknown Employee';
                    $attendance->idno = 'N/A';
                    $attendance->department = 'N/A';
                    $attendance->line = 'N/A';
                }
            }
            
            return response()->json([
                'success' => true,
                'data' => $processedData,
                'pagination' => [
                    'total' => $attendances->total(),
                    'per_page' => $attendances->perPage(),
                    'current_page' => $attendances->currentPage(),
                    'last_page' => $attendances->lastPage()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching attendance data: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch attendance data: ' . $e->getMessage()
            ], 500);
        }
    }

    private function safeFormatTime($timeValue)
    {
        // Return dash for null/empty values
        if ($timeValue === null) {
            return null;
        }
        
        try {
            // Check if it's already a Carbon instance
            if ($timeValue instanceof \Carbon\Carbon) {
                return $timeValue->format('h:i A');
            }
            
            // Try to parse the value using Carbon
            return \Carbon\Carbon::parse($timeValue)->format('h:i A');
        } catch (\Exception $e) {
            Log::warning('Time formatting error: ' . $e->getMessage(), [
                'time_value' => $timeValue
            ]);
            return null;
        }
    }

    /**
     * Build attendance query with filters
     */
    private function buildAttendanceQuery(Request $request)
    {
        // Get query parameters for filtering
        $searchTerm = $request->input('search');
        $dateFilter = $request->input('date');
        $departmentFilter = $request->input('department');
        $editsOnlyFilter = $request->boolean('edits_only');
        
        // Start building the query
        $query = ProcessedAttendance::with('employee');
        
        // Apply filters if present
        if ($searchTerm) {
            $query->whereHas('employee', function ($q) use ($searchTerm) {
                $q->where('idno', 'LIKE', "%{$searchTerm}%")
                  ->orWhere('Fname', 'LIKE', "%{$searchTerm}%")
                  ->orWhere('Lname', 'LIKE', "%{$searchTerm}%");
            });
        }
        
        if ($dateFilter) {
            $query->whereDate('attendance_date', $dateFilter);
        }
        
        if ($departmentFilter) {
            $query->whereHas('employee', function ($q) use ($departmentFilter) {
                $q->where('Department', $departmentFilter);
            });
        }
        
        if ($editsOnlyFilter) {
            $query->where('source', 'manual_edit');
        }
        
        return $query;
    }
    
    /**
     * Update processed attendance record
     */
    public function update(Request $request, $id)
    {
        try {
            // Log incoming request data
            Log::info('Attendance update request for ID: ' . $id, [
                'request_data' => $request->all()
            ]);

            $validator = Validator::make($request->all(), [
                'time_in' => 'nullable|date',
                'time_out' => 'nullable|date',
                'break_in' => 'nullable|date',
                'break_out' => 'nullable|date',
                'next_day_timeout' => 'nullable|date',
                'is_nightshift' => 'boolean', 
            ]);

            if ($validator->fails()) {
                Log::warning('Validation failed for attendance update ID: ' . $id, [
                    'errors' => $validator->errors()->toArray()
                ]);
                
                return back()->withErrors($validator)->withInput();
            }

            // Find the attendance record
            $attendance = ProcessedAttendance::findOrFail($id);
            
            // Log the existing record before update
            Log::info('Existing attendance record before update', [
                'id' => $attendance->id,
                'employee_id' => $attendance->employee_id,
                'current_is_nightshift' => $attendance->is_nightshift
            ]);
            
            // Parse booleans correctly - cast explicitly to boolean
            $isNightshift = (bool)$request->is_nightshift;
            
            // Log the sanitized value
            Log::info('Sanitized is_nightshift value', [
                'original' => $request->is_nightshift,
                'sanitized' => $isNightshift
            ]);
            
            // Prepare update data
            $updateData = [
                'time_in' => $request->time_in ?: null,
                'time_out' => $request->time_out ?: null,
                'break_in' => $request->break_in ?: null,
                'break_out' => $request->break_out ?: null,
                'next_day_timeout' => $isNightshift ? ($request->next_day_timeout ?: null) : null,
                'is_nightshift' => $isNightshift,
                'source' => 'manual_edit', // Mark as manually edited
            ];
            
            // Log the update data
            Log::info('Updating attendance record with data', [
                'id' => $id,
                'update_data' => $updateData
            ]);
            
            // Update the record
            $attendance->update($updateData);
            
            // Log after successful update
            Log::info('Attendance record updated successfully', [
                'id' => $attendance->id,
                'new_is_nightshift' => $attendance->is_nightshift
            ]);
            
            // Calculate hours worked
            Log::info('Calculating hours worked for attendance record', ['id' => $attendance->id]);
            $this->calculateHoursWorked($attendance);
            Log::info('Hours calculation complete', [
                'id' => $attendance->id, 
                'hours_worked' => $attendance->hours_worked
            ]);
            
            // Build query for the list page
            $query = $this->buildAttendanceQuery($request);
            $perPage = $request->input('per_page', 25);
            
            // Order by date descending and paginate
            $attendances = $query->orderBy('processed_attendances.attendance_date', 'asc')
                                 ->paginate($perPage);

            // Get query parameters for filtering
            $searchTerm = $request->input('search');
            $dateFilter = $request->input('date');
            $departmentFilter = $request->input('department');
            $editsOnlyFilter = $request->boolean('edits_only');
            
            // Return Inertia view with data and success message
            return Inertia::render('Timesheet/ProcessedAttendanceList', [
                'attendances' => $attendances->items(),
                'pagination' => [
                    'total' => $attendances->total(),
                    'per_page' => $attendances->perPage(),
                    'current_page' => $attendances->currentPage(),
                    'last_page' => $attendances->lastPage()
                ],
                'filters' => [
                    'search' => $searchTerm,
                    'date' => $dateFilter,
                    'department' => $departmentFilter,
                    'edits_only' => $editsOnlyFilter
                ],
                'auth' => [
                    'user' => auth()->user()
                ],
                'flash' => [
                    'success' => 'Attendance record updated successfully'
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error updating attendance: ' . $e->getMessage(), [
                'id' => $id,
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return back()->withErrors(['error' => 'Failed to update attendance: ' . $e->getMessage()]);
        }
    }

    /**
     * Delete processed attendance record
     */
    public function destroy($id)
    {
        try {
            Log::info('Attendance delete request for ID: ' . $id);

            // Find the attendance record
            $attendance = ProcessedAttendance::findOrFail($id);
            
            // Log the record being deleted
            Log::info('Deleting attendance record', [
                'id' => $attendance->id,
                'employee_id' => $attendance->employee_id,
                'attendance_date' => $attendance->attendance_date
            ]);
            
            // Store employee info for response
            $employee = $attendance->employee;
            $employeeName = $employee ? trim($employee->Fname . ' ' . $employee->Lname) : 'Unknown Employee';
            $attendanceDate = $attendance->attendance_date->format('Y-m-d');
            
            // Delete the record
            $attendance->delete();
            
            Log::info('Attendance record deleted successfully', ['id' => $id]);
            
            return response()->json([
                'success' => true,
                'message' => "Attendance record for {$employeeName} on {$attendanceDate} has been deleted successfully."
            ]);
        } catch (\Exception $e) {
            Log::error('Error deleting attendance: ' . $e->getMessage(), [
                'id' => $id,
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete attendance record: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk delete attendance records
     */
    public function bulkDestroy(Request $request)
    {
        try {
            // First determine if we're deleting by IDs or by date range
            $hasIds = $request->has('ids') && !empty($request->ids);
            $hasDateRange = $request->has('start_date') && $request->has('end_date');
            
            // Validate based on the mode
            if ($hasIds) {
                // Validate for ID-based deletion
                $validator = Validator::make($request->all(), [
                    'ids' => 'required|array|min:1',
                    'ids.*' => 'integer|exists:processed_attendances,id'
                ]);
            } elseif ($hasDateRange) {
                // Validate for date range deletion
                $validator = Validator::make($request->all(), [
                    'start_date' => 'required|date',
                    'end_date' => 'required|date|after_or_equal:start_date',
                    'employee_id' => 'nullable|integer|exists:employees,id',
                    'department' => 'nullable|string'
                ]);
            } else {
                // Neither mode is properly set
                return response()->json([
                    'success' => false,
                    'message' => 'Either IDs or date range must be provided for deletion'
                ], 422);
            }

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $deletedCount = 0;
            $errors = [];

            // Delete by IDs
            if ($hasIds) {
                foreach ($request->ids as $id) {
                    try {
                        $attendance = ProcessedAttendance::findOrFail($id);
                        $attendance->delete();
                        $deletedCount++;
                    } catch (\Exception $e) {
                        $errors[] = "Failed to delete record ID {$id}: " . $e->getMessage();
                    }
                }
            }
            // Delete by date range
            elseif ($hasDateRange) {
                $query = ProcessedAttendance::query();

                // Apply date range filter
                $query->whereBetween('attendance_date', [$request->start_date, $request->end_date]);

                // Apply optional filters
                if ($request->employee_id) {
                    $query->where('employee_id', $request->employee_id);
                }

                if ($request->department) {
                    $query->whereHas('employee', function ($q) use ($request) {
                        $q->where('Department', $request->department);
                    });
                }

                // Get count before deletion for reporting
                $deletedCount = $query->count();
                
                // Perform the deletion
                $query->delete();
            }

            Log::info('Bulk delete completed', [
                'deleted_count' => $deletedCount,
                'error_count' => count($errors),
                'mode' => $hasIds ? 'ids' : 'date_range'
            ]);

            $message = "Successfully deleted {$deletedCount} attendance record(s)";
            if (count($errors) > 0) {
                $message .= ". " . count($errors) . " errors occurred.";
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'deleted_count' => $deletedCount,
                'errors' => $errors
            ]);

        } catch (\Exception $e) {
            Log::error('Error in bulk delete: ' . $e->getMessage(), [
                'request_data' => $request->all(),
                'exception' => $e
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Bulk delete failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Calculate hours worked for an attendance record
     */
    private function calculateHoursWorked(ProcessedAttendance $attendance)
    {
        if ($attendance->time_in) {
            $start = $attendance->time_in;
            $end = null;
            
            // Use next_day_timeout for night shifts, otherwise use time_out
            if ($attendance->is_nightshift && $attendance->next_day_timeout) {
                $end = $attendance->next_day_timeout;
            } else if ($attendance->time_out) {
                $end = $attendance->time_out;
            }
            
            if ($end) {
                // Calculate total minutes
                $totalMinutes = $end->diffInMinutes($start);
                
                // Subtract break time if both break_in and break_out are set
                if ($attendance->break_in && $attendance->break_out) {
                    $breakMinutes = $attendance->break_out->diffInMinutes($attendance->break_in);
                    $totalMinutes -= $breakMinutes;
                }
                
                // Convert minutes to hours with proper rounding
                $attendance->hours_worked = round($totalMinutes / 60, 2);
                $attendance->save();
            }
        }
    }

    /**
     * Get available departments for filtering from departments table
     */
    public function getDepartments()
    {
        try {
            $departments = Department::select('name')
                ->where('is_active', true)
                ->orderBy('name')
                ->pluck('name');
                
            return response()->json([
                'success' => true,
                'data' => $departments
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching departments: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch departments: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export attendance data to CSV
     */
    public function export(Request $request)
    {
        try {
            // Build query with filters
            $query = $this->buildAttendanceQuery($request);
            
            // Order by date and employee
            $attendances = $query->orderBy('attendance_date', 'desc')
                               ->with('employee')
                               ->get();
            
            // Prepare file name
            $fileName = 'attendance_export_' . date('Y-m-d_H-i-s') . '.csv';
            
            // Define headers
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="' . $fileName . '"',
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0'
            ];
            
            // Create callback for streamed response
            $callback = function() use ($attendances) {
                $file = fopen('php://output', 'w');
                
                // Add CSV header row
                fputcsv($file, [
                    'Employee ID',
                    'Employee Name',
                    'Department',
                    'Line',
                    'Date',
                    'Time In',
                    'Time Out',
                    'Break Out',
                    'Break In',
                    'Next Day Timeout',
                    'Hours Worked',
                    'Night Shift',
                    'Overtime',
                    'Travel Order',
                    'SLVL',
                    'CT',
                    'CS',
                    'Holiday',
                    'OT Reg Holiday',
                    'OT Special Holiday',
                    'Rest Day',
                    'Retro Multiplier',
                    'OB',
                    'Source',
                    'Edited'
                ]);
                
                // Add data rows
                foreach ($attendances as $attendance) {
                    $employee = $attendance->employee;
                    
                    $row = [
                        $employee ? $employee->idno : 'N/A',
                        $employee ? trim($employee->Fname . ' ' . $employee->Lname) : 'Unknown',
                        $employee ? $employee->Department : 'N/A',
                        $employee ? $employee->Line : 'N/A',
                        $attendance->attendance_date ? $attendance->attendance_date->format('Y-m-d') : 'N/A',
                        $attendance->time_in ? $attendance->time_in->format('h:i A') : 'N/A',
                        $attendance->time_out ? $attendance->time_out->format('h:i A') : 'N/A',
                        $attendance->break_in ? $attendance->break_in->format('h:i A') : 'N/A',
                        $attendance->break_out ? $attendance->break_out->format('h:i A') : 'N/A',
                        $attendance->next_day_timeout ? $attendance->next_day_timeout->format('h:i A') : 'N/A',
                        $attendance->hours_worked ?? 'N/A',
                        $attendance->is_nightshift ? 'Yes' : 'No',
                        $attendance->overtime ?? 'N/A',
                        $attendance->travel_order ?? 'N/A',
                        $attendance->slvl ?? 'N/A',
                        $attendance->ct ? 'Yes' : 'No',
                        $attendance->cs ? 'Yes' : 'No',
                        $attendance->holiday ? 'Yes' : 'No',
                        $attendance->ot_reg_holiday ?? 'N/A',
                        $attendance->ot_special_holiday ?? 'N/A',
                        $attendance->restday ? 'Yes' : 'No',
                        $attendance->retromultiplier ?? 'N/A',
                        $attendance->ob ? 'Yes' : 'No',
                        ucfirst($attendance->source ?? 'Unknown'),
                        $attendance->source === 'manual_edit' ? 'Yes' : 'No'
                    ];
                    
                    fputcsv($file, $row);
                }
                
                fclose($file);
            };
            
            return response()->stream($callback, 200, $headers);
        } catch (\Exception $e) {
            Log::error('Error exporting attendance data: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to export attendance data: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * IMPROVED Sync processed attendance with all related data sources
     */
    public function sync(Request $request)
    {
        // Use database transactions for better data integrity
        return DB::transaction(function () use ($request) {
            try {
                Log::info('Starting comprehensive attendance sync process');
                
                $syncedCount = 0;
                $errorCount = 0;
                $errors = [];
                $createdRecords = 0;
                
                // Get date range for sync - default to current month if not provided
                /* $startDate = $request->input('start_date', now()->startOfMonth()->format('Y-m-d'));
                $endDate = $request->input('end_date', now()->endOfMonth()->format('Y-m-d')); */

                $startDate = '2025-01-01';
                $endDate = '2025-01-31';
                
                Log::info("Syncing attendance data from {$startDate} to {$endDate}");
                
                // Validate models exist and are accessible
                $this->validateSyncModels();
                
                // 1. First, create SLVL attendance records
                $this->syncSLVLRecords($startDate, $endDate, $createdRecords, $errorCount, $errors);
                
                // 2. Get all processed attendance records within the date range (including newly created ones)
                $attendances = ProcessedAttendance::whereBetween('attendance_date', [$startDate, $endDate])
                    ->with('employee')
                    ->get();
                
                Log::info("Found {$attendances->count()} attendance records to sync");
                
                foreach ($attendances as $attendance) {
                    try {
                        $updated = false;
                        $employeeId = $attendance->employee_id;
                        $attendanceDate = $attendance->attendance_date;
                        
                        // Log current processing
                        Log::debug("Processing attendance for employee {$employeeId} on {$attendanceDate}");
                        
                        // 3. Sync Travel Order Data
                        $travelOrderValue = $this->calculateTravelOrderValue($employeeId, $attendanceDate);
                        if ($attendance->travel_order != $travelOrderValue) {
                            $attendance->travel_order = $travelOrderValue;
                            $updated = true;
                            Log::debug("Updated travel_order: {$travelOrderValue}");
                        }
                        
                        // 4. Sync SLVL Data (for existing records)
                        $slvlValue = $this->calculateSLVLValue($employeeId, $attendanceDate);
                        if ($attendance->slvl != $slvlValue) {
                            $attendance->slvl = $slvlValue;
                            $updated = true;
                            Log::debug("Updated slvl: {$slvlValue}");
                        }
                        
                        // 5. Sync CT (Compensatory Time) Data
                        $ctValue = $this->calculateCTValue($employeeId, $attendanceDate);
                        if ($attendance->ct != $ctValue) {
                            $attendance->ct = $ctValue;
                            $updated = true;
                            Log::debug("Updated ct: " . ($ctValue ? 'true' : 'false'));
                        }
                        
                        // 6. Sync CS (Compressed Schedule) Data
                        $csValue = $this->calculateCSValue($employeeId, $attendanceDate);
                        if ($attendance->cs != $csValue) {
                            $attendance->cs = $csValue;
                            $updated = true;
                            Log::debug("Updated cs: " . ($csValue ? 'true' : 'false'));
                        }
                        
                        // 7. Sync Regular Holiday Overtime Data
                        $otRegHolidayValue = $this->calculateOTRegHolidayValue($employeeId, $attendanceDate);
                        if ($attendance->ot_reg_holiday != $otRegHolidayValue) {
                            $attendance->ot_reg_holiday = $otRegHolidayValue;
                            $updated = true;
                            Log::debug("Updated ot_reg_holiday: {$otRegHolidayValue}");
                        }
                        
                        // 8. Sync Special Holiday Overtime Data
                        $otSpecialHolidayValue = $this->calculateOTSpecialHolidayValue($employeeId, $attendanceDate);
                        if ($attendance->ot_special_holiday != $otSpecialHolidayValue) {
                            $attendance->ot_special_holiday = $otSpecialHolidayValue;
                            $updated = true;
                            Log::debug("Updated ot_special_holiday: {$otSpecialHolidayValue}");
                        }
                        
                        // 9. Sync Rest Day Data
                        $restDayValue = $this->calculateRestDayValue($employeeId, $attendanceDate);
                        if ($attendance->restday != $restDayValue) {
                            $attendance->restday = $restDayValue;
                            $updated = true;
                            Log::debug("Updated restday: " . ($restDayValue ? 'true' : 'false'));
                        }
                        
                        // 10. Sync Retro Multiplier Data
                        $retroMultiplierValue = $this->calculateRetroMultiplierValue($employeeId, $attendanceDate);
                        if ($attendance->retromultiplier != $retroMultiplierValue) {
                            $attendance->retromultiplier = $retroMultiplierValue;
                            $updated = true;
                            Log::debug("Updated retromultiplier: {$retroMultiplierValue}");
                        }
                        
                        // 11. Sync Overtime Data (updated to use rate_multiplier)
                        $overtimeValue = $this->calculateOvertimeHours($employeeId, $attendanceDate);
                        if ($attendance->overtime != $overtimeValue) {
                            $attendance->overtime = $overtimeValue;
                            $updated = true;
                            Log::debug("Updated overtime: {$overtimeValue}");
                        }
                        
                        // 12. Sync Offset Data
                        $offsetValue = $this->calculateOffsetValue($employeeId, $attendanceDate);
                        if ($attendance->offset != $offsetValue) {
                            $attendance->offset = $offsetValue;
                            $updated = true;
                            Log::debug("Updated offset: {$offsetValue}");
                        }
                        
                        // Save if any changes were made
                        if ($updated) {
                            $attendance->save();
                            $syncedCount++;
                            
                            Log::info("Synced attendance for employee {$employeeId} on {$attendanceDate}");
                        }
                        
                    } catch (\Exception $e) {
                        $errorCount++;
                        $error = "Error syncing attendance ID {$attendance->id}: " . $e->getMessage();
                        $errors[] = $error;
                        Log::error($error, ['exception' => $e]);
                    }
                }
                
                Log::info("Attendance sync completed", [
                    'synced_count' => $syncedCount,
                    'created_records' => $createdRecords,
                    'error_count' => $errorCount,
                    'total_processed' => $attendances->count()
                ]);
                
                $message = "Sync completed successfully. {$syncedCount} records updated";
                if ($createdRecords > 0) {
                    $message .= ", {$createdRecords} new records created";
                }
                if ($errorCount > 0) {
                    $message .= ", {$errorCount} errors occurred.";
                }
                
                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'details' => [
                        'synced_count' => $syncedCount,
                        'created_records' => $createdRecords,
                        'error_count' => $errorCount,
                        'total_processed' => $attendances->count(),
                        'errors' => $errorCount > 0 ? array_slice($errors, 0, 10) : []
                    ]
                ]);
                
            } catch (\Exception $e) {
                Log::error('Error in attendance sync process: ' . $e->getMessage(), [
                    'exception' => $e,
                    'trace' => $e->getTraceAsString()
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'Sync failed: ' . $e->getMessage()
                ], 500);
            }
        });
    }
    
    /**
     * Validate that all required models exist before syncing
     */
    private function validateSyncModels()
    {
        $requiredModels = [
            'App\Models\SLVL',
            'App\Models\TravelOrder', 
            'App\Models\TimeSchedule',
            'App\Models\ChangeOffSchedule',
            'App\Models\Overtime',
            'App\Models\CancelRestDay',
            'App\Models\Retro',
            'App\Models\Offset'
        ];
        
        foreach ($requiredModels as $model) {
            if (!class_exists($model)) {
                throw new \Exception("Required model {$model} does not exist");
            }
        }
        
        Log::info('All required models validated successfully');
    }
    
    /**
     * Create SLVL attendance records
     */
    private function syncSLVLRecords($startDate, $endDate, &$createdRecords, &$errorCount, &$errors)
    {
        try {
            Log::info('Starting SLVL records sync');
            
            // Check if SLVL model exists
            if (!class_exists('App\Models\SLVL')) {
                Log::warning('SLVL model not found, skipping SLVL sync');
                return;
            }
            
            // Get all approved SLVL records that overlap with our date range
            $slvlRecords = \App\Models\SLVL::where('status', 'approved')
                ->where(function($query) use ($startDate, $endDate) {
                    $query->whereBetween('start_date', [$startDate, $endDate])
                          ->orWhereBetween('end_date', [$startDate, $endDate])
                          ->orWhere(function($subQuery) use ($startDate, $endDate) {
                              $subQuery->where('start_date', '<=', $startDate)
                                       ->where('end_date', '>=', $endDate);
                          });
                })
                ->get();
            
            Log::info("Found {$slvlRecords->count()} SLVL records to process");
            
            foreach ($slvlRecords as $slvl) {
                try {
                    // Calculate date range for this SLVL
                    $currentDate = Carbon::parse($slvl->start_date);
                    $endSlvlDate = Carbon::parse($slvl->end_date);
                    
                    // Create attendance record for each date in the range
                    while ($currentDate->lte($endSlvlDate)) {
                        // Only create if within our sync range
                        if ($currentDate->between($startDate, $endDate)) {
                            // Check if record already exists
                            $existingRecord = ProcessedAttendance::where('employee_id', $slvl->employee_id)
                                ->where('attendance_date', $currentDate->format('Y-m-d'))
                                ->first();
                            
                            if (!$existingRecord) {
                                // Create new attendance record
                                $slvlValue = 0;
                                if ($slvl->pay_type === 'with_pay') {
                                    $slvlValue = $slvl->half_day ? 0.5 : 1;
                                } else {
                                    $slvlValue = $slvl->half_day ? 0.5 : 0;
                                }
                                
                                ProcessedAttendance::create([
                                    'employee_id' => $slvl->employee_id,
                                    'attendance_date' => $currentDate->format('Y-m-d'),
                                    'day' => $currentDate->format('l'),
                                    'time_in' => $currentDate->copy()->setTime(8, 0, 0), // 8:00 AM
                                    'break_out' => $currentDate->copy()->setTime(12, 0, 0), // 12:00 PM
                                    'break_in' => $currentDate->copy()->setTime(13, 0, 0), // 1:00 PM
                                    'time_out' => $currentDate->copy()->setTime(17, 0, 0), // 5:00 PM
                                    'hours_worked' => $slvl->half_day ? 4 : 8,
                                    'slvl' => $slvlValue,
                                    'source' => 'slvl_sync',
                                    'status' => 'approved'
                                ]);
                                
                                $createdRecords++;
                                Log::debug("Created SLVL attendance record for employee {$slvl->employee_id} on {$currentDate->format('Y-m-d')}");
                            }
                        }
                        
                        $currentDate->addDay();
                    }
                    
                } catch (\Exception $e) {
                    $errorCount++;
                    $error = "Error creating SLVL record for employee {$slvl->employee_id}: " . $e->getMessage();
                    $errors[] = $error;
                    Log::error($error, ['exception' => $e]);
                }
            }
            
            Log::info("SLVL sync completed. Created {$createdRecords} new records");
            
        } catch (\Exception $e) {
            $errorCount++;
            $error = "Error in SLVL sync: " . $e->getMessage();
            $errors[] = $error;
            Log::error($error, ['exception' => $e]);
        }
    }
    
    /**
     * Calculate travel order value for employee on specific date
     */
    private function calculateTravelOrderValue($employeeId, $attendanceDate)
    {
        try {
            if (!class_exists('App\Models\TravelOrder')) {
                Log::debug('TravelOrder model not found');
                return 0.0;
            }
            
            $travelOrder = \App\Models\TravelOrder::where('employee_id', $employeeId)
                ->where('start_date', '<=', $attendanceDate)
                ->where('end_date', '>=', $attendanceDate)
                ->where('status', 'approved')
                ->first();
                
            if ($travelOrder) {
                if ($travelOrder->is_full_day == 1) {
                    return 1.0;
                } elseif ($travelOrder->is_full_day == 0) {
                    return 0.0;
                } else {
                    return 0.5; // Handle 0.5 case
                }
            }
            
            return 0.0;
        } catch (\Exception $e) {
            Log::error("Error calculating travel order value: " . $e->getMessage());
            return 0.0;
        }
    }
    
    /**
     * Calculate SLVL value for employee on specific date
     */
    private function calculateSLVLValue($employeeId, $attendanceDate)
    {
        try {
            if (!class_exists('App\Models\SLVL')) {
                return 0.0;
            }
            
            $slvl = \App\Models\SLVL::where('employee_id', $employeeId)
                ->where('start_date', '<=', $attendanceDate)
                ->where('end_date', '>=', $attendanceDate)
                ->where('status', 'approved')
                ->first();
                
            if ($slvl) {
                if ($slvl->pay_type === 'with_pay') {
                    return $slvl->half_day ? 0.5 : 1.0;
                } else {
                    return $slvl->half_day ? 0.5 : 0.0;
                }
            }
            
            return 0.0;
        } catch (\Exception $e) {
            Log::error("Error calculating SLVL value: " . $e->getMessage());
            return 0.0;
        }
    }
    
    /**
     * Calculate CT (Compensatory Time) value for employee on specific date
     */
    private function calculateCTValue($employeeId, $attendanceDate)
    {
        try {
            if (!class_exists('App\Models\TimeSchedule')) {
                return false;
            }
            
            $timeSchedule = \App\Models\TimeSchedule::where('employee_id', $employeeId)
                ->where('effective_date', $attendanceDate)
                ->where('status', 'approved')
                ->exists();
                
            return $timeSchedule;
        } catch (\Exception $e) {
            Log::error("Error calculating CT value: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Calculate CS (Compressed Schedule) value for employee on specific date
     */
    private function calculateCSValue($employeeId, $attendanceDate)
    {
        try {
            if (!class_exists('App\Models\ChangeOffSchedule')) {
                return false;
            }
            
            $changeOffSchedule = \App\Models\ChangeOffSchedule::where('employee_id', $employeeId)
                ->where('requested_date', $attendanceDate)
                ->where('status', 'approved')
                ->exists();
                
            return $changeOffSchedule;
        } catch (\Exception $e) {
            Log::error("Error calculating CS value: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Calculate Regular Holiday Overtime value for employee on specific date
     */
    private function calculateOTRegHolidayValue($employeeId, $attendanceDate)
    {
        try {
            if (!class_exists('App\Models\Overtime')) {
                return 0.0;
            }
            
            $overtime = \App\Models\Overtime::where('employee_id', $employeeId)
                ->whereDate('date', $attendanceDate)
                ->where('overtime_type', 'regular_holiday')
                ->where('status', 'approved')
                ->first();
                
            if ($overtime) {
                return $overtime->rate_multiplier;
            }
            
            return 0.0;
        } catch (\Exception $e) {
            Log::error("Error calculating OT Regular Holiday value: " . $e->getMessage());
            return 0.0;
        }
    }
    
    /**
     * Calculate Special Holiday Overtime value for employee on specific date
     */
    private function calculateOTSpecialHolidayValue($employeeId, $attendanceDate)
    {
        try {
            if (!class_exists('App\Models\Overtime')) {
                return 0.0;
            }
            
            $overtime = \App\Models\Overtime::where('employee_id', $employeeId)
                ->whereDate('date', $attendanceDate)
                ->where('overtime_type', 'special_holiday')
                ->where('status', 'approved')
                ->first();
                
            if ($overtime) {
                return $overtime->rate_multiplier;
            }
            
            return 0.0;
        } catch (\Exception $e) {
            Log::error("Error calculating OT Special Holiday value: " . $e->getMessage());
            return 0.0;
        }
    }

    /**
     * Calculate offset hours for employee on specific date
     */
    private function calculateOffsetValue($employeeId, $attendanceDate)
    {
        try {
            if (!class_exists('App\Models\Offset')) {
                return 0.0;
            }
            
            $offset = \App\Models\Offset::where('employee_id', $employeeId)
                ->whereDate('date', $attendanceDate)
                ->where('transaction_type', 'debit')
                ->where('status', 'approved')
                ->first();
                
            if ($offset) {
                return $offset->hours;
            }
            
            return 0.0;
        } catch (\Exception $e) {
            Log::error("Error calculating offset value: " . $e->getMessage());
            return 0.0;
        }
    }
    
    /**
     * Calculate Rest Day value for employee on specific date
     */
    private function calculateRestDayValue($employeeId, $attendanceDate)
    {
        try {
            if (!class_exists('App\Models\CancelRestDay')) {
                return false;
            }
            
            $cancelRestDay = \App\Models\CancelRestDay::where('employee_id', $employeeId)
                ->whereDate('rest_day_date', $attendanceDate)
                ->where('status', 'approved')
                ->exists();
                
            return $cancelRestDay;
        } catch (\Exception $e) {
            Log::error("Error calculating Rest Day value: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Calculate Retro Multiplier value for employee on specific date
     */
    private function calculateRetroMultiplierValue($employeeId, $attendanceDate)
    {
        try {
            if (!class_exists('App\Models\Retro')) {
                return 0.0;
            }
            
            $retro = \App\Models\Retro::where('employee_id', $employeeId)
                ->whereDate('retro_date', $attendanceDate)
                ->where('status', 'approved')
                ->first();
                
            if ($retro) {
                return $retro->multiplier_rate * $retro->hours_days;
            }
            
            return 0.0;
        } catch (\Exception $e) {
            Log::error("Error calculating Retro Multiplier value: " . $e->getMessage());
            return 0.0;
        }
    }
    
    /**
     * Calculate overtime hours for employee on specific date (updated)
     */
    private function calculateOvertimeHours($employeeId, $attendanceDate)
    {
        try {
            if (!class_exists('App\Models\Overtime')) {
                return 0.0;
            }
            
            // Get regular overtime (excluding Special Holiday and Regular Holiday)
            $overtime = \App\Models\Overtime::where('employee_id', $employeeId)
                ->whereDate('date', $attendanceDate)
                ->where('status', 'approved')
                ->whereNotIn('overtime_type', ['special_holiday', 'regular_holiday'])
                ->first();
                
            if ($overtime) {
                return $overtime->rate_multiplier;
            }
            
            return 0.0;
        } catch (\Exception $e) {
            Log::error("Error calculating overtime hours: " . $e->getMessage());
            return 0.0;
        }
    }
}