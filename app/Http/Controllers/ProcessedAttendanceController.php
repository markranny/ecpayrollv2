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
 * Auto-recalculate attendance metrics for displayed records
 */
// Add this helper function before your autoRecalculateMetrics function
private function applyTimeOutRounding($timeString)
{
    try {
        $time = \Carbon\Carbon::parse($timeString);
        
        // For time out - round down to the nearest hour
        // This treats 5:16 PM as 5:00 PM, 5:31 PM as 5:00 PM, 5:46 PM as 5:00 PM
        if ($time->minute > 0 || $time->second > 0) {
            $time->minute = 0;
            $time->second = 0;
        }
        
        return $time;
        
    } catch (\Exception $e) {
        Log::error("Error in time out rounding: " . $e->getMessage());
        return \Carbon\Carbon::parse($timeString); // Return original if rounding fails
    }
}

private function autoRecalculateMetrics($attendances)
{
    try {
        $recalculatedCount = 0;
        
        Log::info("autoRecalculateMetrics function called with " . count($attendances) . " records");
        
        foreach ($attendances as $attendance) {
            Log::info("Processing attendance record", [
                'id' => $attendance->id,
                'employee_id' => $attendance->employee_id,
                'raw_time_in' => $attendance->time_in,
                'raw_time_out' => $attendance->time_out,
                'raw_next_day_timeout' => $attendance->next_day_timeout ?? null,
                'is_nightshift' => $attendance->is_nightshift ?? false,
                'attendance_date' => $attendance->attendance_date
            ]);
            
            // Initialize variables
            $lateMinutes = 0;
            $undertimeMinutes = 0;
            $hoursWorked = 0;
            $isHalfday = false;
            
            if ($attendance->time_in) {
                // Calculate late minutes - Need to determine correct shift schedule
                try {
                    $attendanceDate = \Carbon\Carbon::parse($attendance->attendance_date);
                    $actualTimeIn = \Carbon\Carbon::parse($attendance->time_in);
                    
                    // Determine expected time based on actual time_in to identify shift type
                    $timeInHour = $actualTimeIn->hour;
                    $expectedTimeIn = null;
                    
                    if ($timeInHour >= 6 && $timeInHour <= 10) {
                        // Morning shift: 8:00 AM
                        $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0);
                    } elseif ($timeInHour >= 13 && $timeInHour <= 16) {
                        // Afternoon shift: 2:00 PM
                        $expectedTimeIn = $attendanceDate->copy()->setTime(14, 0, 0);
                    } elseif ($timeInHour >= 17 && $timeInHour <= 20) {
                        // Evening shift: 6:00 PM
                        $expectedTimeIn = $attendanceDate->copy()->setTime(18, 0, 0);
                    } elseif ($timeInHour >= 21 || $timeInHour <= 5) {
                        // Night shift: 10:00 PM
                        $expectedTimeIn = $attendanceDate->copy()->setTime(22, 0, 0);
                    } else {
                        // Default to morning shift if uncertain
                        $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0);
                    }
                    
                    // Debug time parsing
                    Log::info("Time parsing debug", [
                        'attendance_id' => $attendance->id,
                        'raw_attendance_date' => $attendance->attendance_date,
                        'raw_time_in' => $attendance->time_in,
                        'parsed_attendance_date' => $attendanceDate->format('Y-m-d H:i:s'),
                        'parsed_expected_time_in' => $expectedTimeIn->format('Y-m-d H:i:s'),
                        'parsed_actual_time_in' => $actualTimeIn->format('Y-m-d H:i:s')
                    ]);
                    
                    // Calculate initial late minutes
                    $initialLateMinutes = 0;
                    if ($actualTimeIn->gt($expectedTimeIn)) {
                        $initialLateMinutes = abs($actualTimeIn->diffInMinutes($expectedTimeIn));
                    }
                    
                } catch (\Exception $e) {
                    Log::error("Error parsing time_in for attendance {$attendance->id}: " . $e->getMessage());
                    continue; // Skip this record if time parsing fails
                }
                
                // Calculate working hours and determine if it's a halfday
                $timeOut = null;
                if ($attendance->is_nightshift && $attendance->next_day_timeout) {
                    $timeOut = $attendance->next_day_timeout;
                } elseif ($attendance->time_out) {
                    $timeOut = $attendance->time_out;
                }
                
                Log::info("Time out determination", [
                    'attendance_id' => $attendance->id,
                    'is_nightshift' => $attendance->is_nightshift ?? false,
                    'raw_time_out' => $attendance->time_out,
                    'raw_next_day_timeout' => $attendance->next_day_timeout ?? null,
                    'selected_time_out' => $timeOut
                ]);
                
                // Check if this is a halfday scenario
                $hasPartialData = ($attendance->time_in || $attendance->break_in || $attendance->break_out || $timeOut);
                
                if ($timeOut) {
                    try {
                        // Apply time rounding for time out only (round down to nearest hour)
                        $timeIn = \Carbon\Carbon::parse($attendance->time_in);
                        $timeOutParsed = \Carbon\Carbon::parse($timeOut);
                        $roundedTimeOut = $this->applyTimeOutRounding($timeOut);
                        
                        Log::info("Time out rounding applied", [
                            'attendance_id' => $attendance->id,
                            'original_time_in' => $timeIn->format('H:i:s'),
                            'original_time_out' => $timeOutParsed->format('H:i:s'),
                            'rounded_time_out' => $roundedTimeOut->format('H:i:s')
                        ]);
                        
                        // Handle next day scenarios for night shifts
                        if ($attendance->is_nightshift && $roundedTimeOut->lt($timeIn)) {
                            $roundedTimeOut->addDay();
                            Log::info("Added day to night shift rounded time out", [
                                'attendance_id' => $attendance->id,
                                'adjusted_rounded_time_out' => $roundedTimeOut->format('Y-m-d H:i:s')
                            ]);
                        }
                        
                        // Calculate total worked minutes using original time in and rounded time out
                        $totalWorkedMinutes = abs($roundedTimeOut->diffInMinutes($timeIn));
                        
                        // Additional validation - if time_out is before time_in, something is wrong
                        if ($roundedTimeOut->lt($timeIn)) {
                            Log::warning("Rounded time out is before time in - possible data issue", [
                                'attendance_id' => $attendance->id,
                                'time_in' => $timeIn->format('Y-m-d H:i:s'),
                                'rounded_time_out' => $roundedTimeOut->format('Y-m-d H:i:s')
                            ]);
                        }
                        
                        Log::info("Total worked time calculation with time out rounding", [
                            'attendance_id' => $attendance->id,
                            'time_in' => $timeIn->format('Y-m-d H:i:s'),
                            'rounded_time_out' => $roundedTimeOut->format('Y-m-d H:i:s'),
                            'total_worked_minutes' => $totalWorkedMinutes
                        ]);
                        
                        // Continue with break calculation (using original break times)
                        $breakMinutes = 0;
                        
                        if ($attendance->break_out && $attendance->break_in) {
                            try {
                                $breakOut = \Carbon\Carbon::parse($attendance->break_out);
                                $breakIn = \Carbon\Carbon::parse($attendance->break_in);
                                
                                // Validate break times are within work period (using original times)
                                if ($breakOut->gte($timeIn) && $breakOut->lte($timeOutParsed) && 
                                    $breakIn->gte($timeIn) && $breakIn->lte($timeOutParsed) &&
                                    $breakIn->gt($breakOut)) {
                                    $breakMinutes = abs($breakIn->diffInMinutes($breakOut));
                                    
                                    // Reasonable break time validation (max 4 hours)
                                    if ($breakMinutes > 240) {
                                        Log::warning("Break time too long, using default", [
                                            'attendance_id' => $attendance->id,
                                            'calculated_break_minutes' => $breakMinutes
                                        ]);
                                        $breakMinutes = 60;
                                    }
                                } else {
                                    Log::warning("Invalid break times, no break deduction applied", [
                                        'attendance_id' => $attendance->id,
                                        'break_out' => $breakOut->format('Y-m-d H:i:s'),
                                        'break_in' => $breakIn->format('Y-m-d H:i:s'),
                                        'work_period' => $timeIn->format('H:i') . ' - ' . $timeOutParsed->format('H:i')
                                    ]);
                                    $breakMinutes = 0;
                                }
                                
                                Log::info("Break time calculation", [
                                    'attendance_id' => $attendance->id,
                                    'break_out' => $breakOut->format('Y-m-d H:i:s'),
                                    'break_in' => $breakIn->format('Y-m-d H:i:s'),
                                    'break_minutes' => $breakMinutes
                                ]);
                            } catch (\Exception $e) {
                                Log::error("Error parsing break times for attendance {$attendance->id}: " . $e->getMessage());
                                $breakMinutes = 0;
                            }
                        } else {
                            $breakMinutes = 0;
                            Log::info("No break times recorded, no break deduction applied", [
                                'attendance_id' => $attendance->id
                            ]);
                        }
                        
                        // Calculate net worked time
                        $netWorkedMinutes = max(0, $totalWorkedMinutes - $breakMinutes);
                        
                        // Calculate hours worked
                        $hoursWorked = round($netWorkedMinutes / 60, 2);
                        
                        Log::info("Work hours calculation with time out rounding", [
                            'attendance_id' => $attendance->id,
                            'total_worked_minutes' => $totalWorkedMinutes,
                            'break_minutes' => $breakMinutes,
                            'net_worked_minutes' => $netWorkedMinutes,
                            'hours_worked' => $hoursWorked
                        ]);
                        
                    } catch (\Exception $e) {
                        Log::error("Error calculating work hours for attendance {$attendance->id}: " . $e->getMessage());
                        // Keep default values (0) if calculation fails
                    }
                } else {
                    Log::warning("No time_out found for attendance {$attendance->id}");
                }
                
                // Check if it's a halfday
                if ($hoursWorked == 0 && $hasPartialData) {
                    $isHalfday = true;
                    Log::info("Detected halfday scenario", [
                        'attendance_id' => $attendance->id,
                        'has_time_in' => !empty($attendance->time_in),
                        'has_break_in' => !empty($attendance->break_in),
                        'has_break_out' => !empty($attendance->break_out),
                        'has_time_out' => !empty($timeOut),
                        'hours_worked' => $hoursWorked
                    ]);
                }
                
                // Apply late calculation rules
                if ($isHalfday) {
                    // For halfday, no late calculation
                    $lateMinutes = 0;
                    Log::info("Halfday detected - setting late minutes to 0", [
                        'attendance_id' => $attendance->id
                    ]);
                } elseif ($hoursWorked >= 9) {
                    // If working 9+ hours, not considered late
                    $lateMinutes = 0;
                    Log::info("Working 9+ hours - not considered late", [
                        'attendance_id' => $attendance->id,
                        'hours_worked' => $hoursWorked,
                        'initial_late_minutes' => $initialLateMinutes
                    ]);
                } else {
                    // Apply normal late calculation for less than 9 hours
                    $lateMinutes = $initialLateMinutes;
                    Log::info("Normal late calculation applied", [
                        'attendance_id' => $attendance->id,
                        'hours_worked' => $hoursWorked,
                        'late_minutes' => $lateMinutes
                    ]);
                }
                
                // Apply undertime calculation rules
                if ($isHalfday) {
                    // For halfday, no undertime calculation
                    $undertimeMinutes = 0;
                    Log::info("Halfday detected - setting undertime minutes to 0", [
                        'attendance_id' => $attendance->id
                    ]);
                } else {
                    // Calculate undertime based on 9-hour minimum requirement
                    $minimumWorkHours = 9;
                    $minimumWorkMinutes = $minimumWorkHours * 60; // 9 hours = 540 minutes
                    $netWorkedMinutes = $hoursWorked * 60;
                    
                    if ($netWorkedMinutes < $minimumWorkMinutes) {
                        $undertimeMinutes = $minimumWorkMinutes - $netWorkedMinutes;
                    }
                    
                    Log::info("Undertime calculation", [
                        'attendance_id' => $attendance->id,
                        'hours_worked' => $hoursWorked,
                        'minimum_work_hours' => $minimumWorkHours,
                        'undertime_minutes' => $undertimeMinutes,
                        'is_undertime' => $hoursWorked < $minimumWorkHours
                    ]);
                }
                
                Log::info("Final calculations", [
                    'attendance_id' => $attendance->id,
                    'hours_worked' => $hoursWorked,
                    'late_minutes' => $lateMinutes,
                    'undertime_minutes' => $undertimeMinutes,
                    'is_halfday' => $isHalfday
                ]);
                
                // Check if values need updating (more precise comparison)
                $needsUpdate = false;
                
                if (abs($attendance->late_minutes - $lateMinutes) > 0.01) {
                    $needsUpdate = true;
                    Log::info("Late minutes changed", [
                        'attendance_id' => $attendance->id,
                        'old_value' => $attendance->late_minutes,
                        'new_value' => $lateMinutes
                    ]);
                }
                
                if (abs($attendance->undertime_minutes - $undertimeMinutes) > 0.01) {
                    $needsUpdate = true;
                    Log::info("Undertime minutes changed", [
                        'attendance_id' => $attendance->id,
                        'old_value' => $attendance->undertime_minutes,
                        'new_value' => $undertimeMinutes
                    ]);
                }
                
                if (abs($attendance->hours_worked - $hoursWorked) > 0.01) {
                    $needsUpdate = true;
                    Log::info("Hours worked changed", [
                        'attendance_id' => $attendance->id,
                        'old_value' => $attendance->hours_worked,
                        'new_value' => $hoursWorked
                    ]);
                }
                
                if ($needsUpdate) {
                    try {
                        // Update without triggering model events to avoid recursion
                        $updateResult = DB::table('processed_attendances')
                            ->where('id', $attendance->id)
                            ->update([
                                'late_minutes' => $lateMinutes,
                                'undertime_minutes' => $undertimeMinutes,
                                'hours_worked' => $hoursWorked,
                                'updated_at' => now()
                            ]);
                        
                        Log::info("Database update result", [
                            'attendance_id' => $attendance->id,
                            'affected_rows' => $updateResult
                        ]);
                        
                        // Update the current object for display
                        $attendance->late_minutes = $lateMinutes;
                        $attendance->undertime_minutes = $undertimeMinutes;
                        $attendance->hours_worked = $hoursWorked;
                        
                        $recalculatedCount++;
                        
                        Log::info("Recalculated attendance metrics", [
                            'id' => $attendance->id,
                            'employee_id' => $attendance->employee_id,
                            'late_minutes' => $lateMinutes,
                            'undertime_minutes' => $undertimeMinutes,
                            'hours_worked' => $hoursWorked,
                            'is_halfday' => $isHalfday,
                            'original_time_out' => $timeOut,
                            'rounded_time_out' => isset($roundedTimeOut) ? $roundedTimeOut->format('H:i:s') : null
                        ]);
                        
                    } catch (\Exception $e) {
                        Log::error("Error updating attendance {$attendance->id}: " . $e->getMessage());
                    }
                } else {
                    Log::info("No update needed for attendance {$attendance->id}");
                }
            } else {
                Log::warning("No time_in found for attendance {$attendance->id}");
            }
        }
        
        if ($recalculatedCount > 0) {
            Log::info("Auto-recalculated {$recalculatedCount} attendance records on page load");
        } else {
            Log::info("No attendance records needed recalculation");
        }
        
        return $recalculatedCount;
        
    } catch (\Exception $e) {
        Log::error('Error in auto-recalculation: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString()
        ]);
        return 0;
    }
}

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
    
    // AUTO-RECALCULATE: Recalculate metrics for displayed records
    $recalculatedCount = $this->autoRecalculateMetrics($attendances->items());
    
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
        ],
        'recalculated_count' => $recalculatedCount // Pass recalculation info to frontend
    ]);
}

/**
 * Get attendance list with auto-recalculation
 */
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
        
        // AUTO-RECALCULATE: Recalculate metrics for displayed records
        $recalculatedCount = $this->autoRecalculateMetrics($processedData);
        
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
            ],
            'recalculated_count' => $recalculatedCount // Include recalculation info
        ]);
    } catch (\Exception $e) {
        Log::error('Error fetching attendance data: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch attendance data: ' . $e->getMessage()
        ], 500);
    }
}

public function recalculateAll(Request $request)
{
    try {
        $dateFilter = $request->input('date');
        $departmentFilter = $request->input('department');
        
        // Build query for recalculation
        $query = ProcessedAttendance::whereNotNull('time_in');
        
        if ($dateFilter) {
            $query->whereDate('attendance_date', $dateFilter);
        }
        
        if ($departmentFilter) {
            $query->whereHas('employee', function ($q) use ($departmentFilter) {
                $q->where('Department', $departmentFilter);
            });
        }
        
        $attendances = $query->get();
        $recalculatedCount = 0;
        
        foreach ($attendances as $attendance) {
            try {
                // Store original values
                $originalLate = $attendance->late_minutes ?? 0;
                $originalUnder = $attendance->undertime_minutes ?? 0;
                $originalHours = $attendance->hours_worked ?? 0;
                
                // FIXED: Calculate late minutes (NO grace period - 8:00 AM sharp)
                $lateMinutes = 0;
                if ($attendance->time_in) {
                    $attendanceDate = \Carbon\Carbon::parse($attendance->attendance_date);
                    $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0); // 8:00 AM exactly
                    $actualTimeIn = \Carbon\Carbon::parse($attendance->time_in);
                    
                    if ($actualTimeIn->gt($expectedTimeIn)) {
                        $lateMinutes = $actualTimeIn->diffInMinutes($expectedTimeIn);
                    }
                }
                
                // FIXED: Calculate undertime minutes
                $undertimeMinutes = 0;
                $timeOut = $attendance->is_nightshift && $attendance->next_day_timeout 
                    ? $attendance->next_day_timeout 
                    : $attendance->time_out;
                
                if ($attendance->time_in && $timeOut) {
                    $timeIn = \Carbon\Carbon::parse($attendance->time_in);
                    $timeOut = \Carbon\Carbon::parse($timeOut);
                    
                    // Handle next day scenarios for night shifts
                    if ($attendance->is_nightshift && $timeOut->lt($timeIn)) {
                        $timeOut->addDay();
                    }
                    
                    // Calculate total worked minutes
                    $totalWorkedMinutes = $timeOut->diffInMinutes($timeIn);
                    
                    // Subtract break time
                    $breakMinutes = 60; // Default 1-hour break
                    if ($attendance->break_out && $attendance->break_in) {
                        $breakOut = \Carbon\Carbon::parse($attendance->break_out);
                        $breakIn = \Carbon\Carbon::parse($attendance->break_in);
                        if ($breakIn->gt($breakOut)) {
                            $breakMinutes = $breakIn->diffInMinutes($breakOut);
                        }
                    }
                    
                    $netWorkedMinutes = max(0, $totalWorkedMinutes - $breakMinutes);
                    $standardWorkMinutes = 8 * 60; // 8 hours = 480 minutes
                    
                    if ($netWorkedMinutes < $standardWorkMinutes) {
                        $undertimeMinutes = $standardWorkMinutes - $netWorkedMinutes;
                    }
                }
                
                // FIXED: Calculate hours worked
                $hoursWorked = 0;
                if ($attendance->time_in && $timeOut) {
                    $timeIn = \Carbon\Carbon::parse($attendance->time_in);
                    $timeOut = \Carbon\Carbon::parse($timeOut);
                    
                    // Handle next day scenarios for night shifts
                    if ($attendance->is_nightshift && $timeOut->lt($timeIn)) {
                        $timeOut->addDay();
                    }
                    
                    $totalWorkedMinutes = $timeOut->diffInMinutes($timeIn);
                    
                    // Subtract break time
                    $breakMinutes = 60;
                    if ($attendance->break_out && $attendance->break_in) {
                        $breakOut = \Carbon\Carbon::parse($attendance->break_out);
                        $breakIn = \Carbon\Carbon::parse($attendance->break_in);
                        if ($breakIn->gt($breakOut)) {
                            $breakMinutes = $breakIn->diffInMinutes($breakOut);
                        }
                    }
                    
                    $netWorkedMinutes = max(0, $totalWorkedMinutes - $breakMinutes);
                    $hoursWorked = round($netWorkedMinutes / 60, 2);
                }
                
                // Check if anything changed
                if ($originalLate != $lateMinutes || 
                    $originalUnder != $undertimeMinutes || 
                    $originalHours != $hoursWorked) {
                    
                    // Update the record
                    DB::table('processed_attendances')
                        ->where('id', $attendance->id)
                        ->update([
                            'late_minutes' => $lateMinutes,
                            'undertime_minutes' => $undertimeMinutes,
                            'hours_worked' => $hoursWorked,
                            'updated_at' => now()
                        ]);
                    
                    $recalculatedCount++;
                }
                
            } catch (\Exception $e) {
                Log::error("Error recalculating attendance ID {$attendance->id}: " . $e->getMessage());
            }
        }
        
        return response()->json([
            'success' => true,
            'message' => "Recalculated {$recalculatedCount} attendance records",
            'recalculated_count' => $recalculatedCount
        ]);
        
    } catch (\Exception $e) {
        Log::error('Error in manual recalculation: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'Recalculation failed: ' . $e->getMessage()
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

    
    
    private function buildAttendanceQuery(Request $request)
{
    // Get query parameters for filtering
    $searchTerm = $request->input('search');
    $dateFilter = $request->input('date');
    $departmentFilter = $request->input('department');
    $editsOnlyFilter = $request->boolean('edits_only');
    $nightShiftFilter = $request->boolean('night_shift_only'); // NEW: Night shift filter
    
    // Start building the query - UPDATED to show only non-posted records by default
    $query = ProcessedAttendance::with('employee')
        ->where('posting_status', '!=', 'posted'); // Only show non-posted records
    
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
    
    // NEW: Night shift filter
    if ($nightShiftFilter) {
        $query->where('is_nightshift', true);
    }
    
    return $query;
}

/**
 * Update processed attendance record (UPDATED to include trip)
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
            'trip' => 'nullable|numeric|min:0|max:999.99', // NEW: Trip validation
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
            'current_is_nightshift' => $attendance->is_nightshift,
            'current_trip' => $attendance->trip
        ]);
        
        // Parse booleans correctly - cast explicitly to boolean
        $isNightshift = (bool)$request->is_nightshift;
        
        // Log the sanitized value
        Log::info('Sanitized values', [
            'is_nightshift_original' => $request->is_nightshift,
            'is_nightshift_sanitized' => $isNightshift,
            'trip' => $request->trip
        ]);
        
        // Prepare update data
        $updateData = [
            'time_in' => $request->time_in ?: null,
            'time_out' => $request->time_out ?: null,
            'break_in' => $request->break_in ?: null,
            'break_out' => $request->break_out ?: null,
            'next_day_timeout' => $isNightshift ? ($request->next_day_timeout ?: null) : null,
            'is_nightshift' => $isNightshift,
            'trip' => $request->trip ? (float)$request->trip : 0, // NEW: Trip field
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
            'new_is_nightshift' => $attendance->is_nightshift,
            'new_trip' => $attendance->trip
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
        $nightShiftFilter = $request->boolean('night_shift_only'); // NEW
        
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
                'edits_only' => $editsOnlyFilter,
                'night_shift_only' => $nightShiftFilter, // NEW
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
     * NEW: Sync individual processed attendance record with all related data sources
     */
    public function syncIndividual($id)
    {
        return DB::transaction(function () use ($id) {
            try {
                Log::info("Starting individual attendance sync for ID: {$id}");
                
                // Find the specific attendance record
                $attendance = ProcessedAttendance::with('employee')->findOrFail($id);
                
                $updated = false;
                $employeeId = $attendance->employee_id;
                $attendanceDate = $attendance->attendance_date;
                
                Log::info("Syncing attendance for employee {$employeeId} on {$attendanceDate}");
                
                // Validate models exist and are accessible
                $this->validateSyncModels();
                
                // Sync all related data for this specific record
                
                // 1. Sync Travel Order Data
                $travelOrderValue = $this->calculateTravelOrderValue($employeeId, $attendanceDate);
                if ($attendance->travel_order != $travelOrderValue) {
                    $attendance->travel_order = $travelOrderValue;
                    $updated = true;
                    Log::debug("Updated travel_order: {$travelOrderValue}");
                }
                
                // 2. Sync SLVL Data
                $slvlValue = $this->calculateSLVLValue($employeeId, $attendanceDate);
                if ($attendance->slvl != $slvlValue) {
                    $attendance->slvl = $slvlValue;
                    $updated = true;
                    Log::debug("Updated slvl: {$slvlValue}");
                }
                
                // 3. Sync CT (Compensatory Time) Data
                $ctValue = $this->calculateCTValue($employeeId, $attendanceDate);
                if ($attendance->ct != $ctValue) {
                    $attendance->ct = $ctValue;
                    $updated = true;
                    Log::debug("Updated ct: " . ($ctValue ? 'true' : 'false'));
                }
                
                // 4. Sync CS (Compressed Schedule) Data
                $csValue = $this->calculateCSValue($employeeId, $attendanceDate);
                if ($attendance->cs != $csValue) {
                    $attendance->cs = $csValue;
                    $updated = true;
                    Log::debug("Updated cs: " . ($csValue ? 'true' : 'false'));
                }
                
                // 5. Sync Regular Holiday Overtime Data
                $otRegHolidayValue = $this->calculateOTRegHolidayValue($employeeId, $attendanceDate);
                if ($attendance->ot_reg_holiday != $otRegHolidayValue) {
                    $attendance->ot_reg_holiday = $otRegHolidayValue;
                    $updated = true;
                    Log::debug("Updated ot_reg_holiday: {$otRegHolidayValue}");
                }
                
                // 6. Sync Special Holiday Overtime Data
                $otSpecialHolidayValue = $this->calculateOTSpecialHolidayValue($employeeId, $attendanceDate);
                if ($attendance->ot_special_holiday != $otSpecialHolidayValue) {
                    $attendance->ot_special_holiday = $otSpecialHolidayValue;
                    $updated = true;
                    Log::debug("Updated ot_special_holiday: {$otSpecialHolidayValue}");
                }
                
                // 7. Sync Rest Day Data
                $restDayValue = $this->calculateRestDayValue($employeeId, $attendanceDate);
                if ($attendance->restday != $restDayValue) {
                    $attendance->restday = $restDayValue;
                    $updated = true;
                    Log::debug("Updated restday: " . ($restDayValue ? 'true' : 'false'));
                }
                
                // 8. Sync Retro Multiplier Data
                $retroMultiplierValue = $this->calculateRetroMultiplierValue($employeeId, $attendanceDate);
                if ($attendance->retromultiplier != $retroMultiplierValue) {
                    $attendance->retromultiplier = $retroMultiplierValue;
                    $updated = true;
                    Log::debug("Updated retromultiplier: {$retroMultiplierValue}");
                }
                
                // 9. Sync Overtime Data
                $overtimeValue = $this->calculateOvertimeHours($employeeId, $attendanceDate);
                if ($attendance->overtime != $overtimeValue) {
                    $attendance->overtime = $overtimeValue;
                    $updated = true;
                    Log::debug("Updated overtime: {$overtimeValue}");
                }
                
                // 10. Sync Offset Data
                $offsetValue = $this->calculateOffsetValue($employeeId, $attendanceDate);
                if ($attendance->offset != $offsetValue) {
                    $attendance->offset = $offsetValue;
                    $updated = true;
                    Log::debug("Updated offset: {$offsetValue}");
                }
                
                // Save if any changes were made
                if ($updated) {
                    $attendance->save();
                    Log::info("Individual attendance sync completed for ID {$id} - record updated");
                    
                    $message = "Attendance record synced successfully - data updated from related records";
                } else {
                    Log::info("Individual attendance sync completed for ID {$id} - no changes needed");
                    $message = "Attendance record synced successfully - all data is already up to date";
                }
                
                // Return the updated attendance record
                $attendance->refresh();
                $attendance->load('employee');
                
                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'data' => $attendance,
                    'updated' => $updated
                ]);
                
            } catch (\Exception $e) {
                Log::error("Error in individual attendance sync for ID {$id}: " . $e->getMessage(), [
                    'exception' => $e,
                    'trace' => $e->getTraceAsString()
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'Individual sync failed: ' . $e->getMessage()
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

    /**
 * Download attendance data template/current data
 */
public function downloadTemplate(Request $request)
{
    try {
        // Get query parameters for filtering (same as main list)
        $searchTerm = $request->input('search');
        $dateFilter = $request->input('date');
        $departmentFilter = $request->input('department');
        $editsOnlyFilter = $request->boolean('edits_only');
        $nightShiftFilter = $request->boolean('night_shift_only');
        
        // Build query with filters
        $query = ProcessedAttendance::with('employee')
            ->where('posting_status', '!=', 'posted'); // Only non-posted records
        
        // Apply same filters as main list
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
        
        if ($nightShiftFilter) {
            $query->where('is_nightshift', true);
        }
        
        // Get the data
        $attendances = $query->orderBy('attendance_date', 'asc')
                           ->orderBy('employee_id', 'asc')
                           ->get();
        
        // Prepare file name
        $fileName = 'attendance_data_' . date('Y-m-d_H-i-s') . '.csv';
        
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
                'Employee Number',
                'Employee Name',
                'Department',
                'Date',
                'Day',
                'Time In',
                'Break Out',
                'Break In',
                'Time Out',
                'Next Day Timeout',
                'Hours Worked', // This will be calculated on import
                'Night Shift',
                'Trip'
            ]);
            
            // Add data rows
            foreach ($attendances as $attendance) {
                $employee = $attendance->employee;
                
                // Format times to simple HH:MM format for Excel compatibility
                $timeIn = $attendance->time_in ? $attendance->time_in->format('H:i') : '';
                $timeOut = $attendance->time_out ? $attendance->time_out->format('H:i') : '';
                $breakOut = $attendance->break_out ? $attendance->break_out->format('H:i') : '';
                $breakIn = $attendance->break_in ? $attendance->break_in->format('H:i') : '';
                $nextDayTimeout = $attendance->next_day_timeout ? $attendance->next_day_timeout->format('H:i') : '';
                
                $row = [
                    $employee ? $employee->idno : '',
                    $employee ? trim($employee->Fname . ' ' . $employee->Lname) : '',
                    $employee ? $employee->Department : '',
                    $attendance->attendance_date ? $attendance->attendance_date->format('Y-m-d') : '',
                    $attendance->day ?: ($attendance->attendance_date ? $attendance->attendance_date->format('l') : ''),
                    $timeIn,
                    $breakOut,
                    $breakIn,
                    $timeOut,
                    $nextDayTimeout,
                    $attendance->hours_worked ?: '', // Current hours (will be recalculated on import)
                    $attendance->is_nightshift ? 'Yes' : 'No',
                    $attendance->trip ?: 0
                ];
                
                fputcsv($file, $row);
            }
            
            fclose($file);
        };
        
        return response()->stream($callback, 200, $headers);
        
    } catch (\Exception $e) {
        Log::error('Error downloading attendance data: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to download attendance data: ' . $e->getMessage()
        ], 500);
    }
}

/**
 * Import attendance data with automatic hours calculation
 */
public function importAttendance(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:csv,txt|max:10240', // 10MB max
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $file = $request->file('file');
        $csvData = array_map('str_getcsv', file($file->path()));
        
        // Remove header row
        $header = array_shift($csvData);
        
        $imported = 0;
        $updated = 0;
        $errors = [];
        
        DB::transaction(function () use ($csvData, &$imported, &$updated, &$errors) {
            foreach ($csvData as $lineNumber => $row) {
                try {
                    // Skip empty rows
                    if (empty(array_filter($row))) {
                        continue;
                    }
                    
                    // Map CSV columns (adjust indices based on your CSV structure)
                    $employeeNumber = trim($row[0] ?? '');
                    $employeeName = trim($row[1] ?? '');
                    $department = trim($row[2] ?? '');
                    $date = trim($row[3] ?? '');
                    $day = trim($row[4] ?? '');
                    $timeIn = trim($row[5] ?? '');
                    $breakOut = trim($row[6] ?? '');
                    $breakIn = trim($row[7] ?? '');
                    $timeOut = trim($row[8] ?? '');
                    $nextDayTimeout = trim($row[9] ?? '');
                    // $hoursWorked = trim($row[10] ?? ''); // Will be calculated
                    $nightShift = trim($row[11] ?? '');
                    $trip = trim($row[12] ?? '0');
                    
                    // Validate required fields
                    if (empty($employeeNumber) || empty($date)) {
                        $errors[] = "Line " . ($lineNumber + 2) . ": Employee Number and Date are required";
                        continue;
                    }
                    
                    // Find employee
                    $employee = Employee::where('idno', $employeeNumber)->first();
                    if (!$employee) {
                        $errors[] = "Line " . ($lineNumber + 2) . ": Employee with ID {$employeeNumber} not found";
                        continue;
                    }
                    
                    // Parse date
                    $attendanceDate = Carbon::parse($date);
                    
                    // Parse times with validation
                    $timeInParsed = $this->parseTimeForImport($timeIn, $attendanceDate);
                    $timeOutParsed = $this->parseTimeForImport($timeOut, $attendanceDate);
                    $breakOutParsed = $this->parseTimeForImport($breakOut, $attendanceDate);
                    $breakInParsed = $this->parseTimeForImport($breakIn, $attendanceDate);
                    $nextDayTimeoutParsed = null;
                    
                    // Handle night shift
                    $isNightShift = strtolower($nightShift) === 'yes' || $nightShift === '1';
                    
                    if ($isNightShift && !empty($nextDayTimeout)) {
                        $nextDay = $attendanceDate->copy()->addDay();
                        $nextDayTimeoutParsed = $this->parseTimeForImport($nextDayTimeout, $nextDay);
                    }
                    
                    // Calculate hours worked automatically
                    $hoursWorked = $this->calculateHoursFromTimes(
                        $timeInParsed,
                        $isNightShift ? $nextDayTimeoutParsed : $timeOutParsed,
                        $breakOutParsed,
                        $breakInParsed
                    );
                    
                    // Check if record exists
                    $existingRecord = ProcessedAttendance::where('employee_id', $employee->id)
                        ->where('attendance_date', $attendanceDate->format('Y-m-d'))
                        ->first();
                    
                    $attendanceData = [
                        'employee_id' => $employee->id,
                        'attendance_date' => $attendanceDate->format('Y-m-d'),
                        'day' => $day ?: $attendanceDate->format('l'),
                        'time_in' => $timeInParsed,
                        'time_out' => $timeOutParsed,
                        'break_out' => $breakOutParsed,
                        'break_in' => $breakInParsed,
                        'next_day_timeout' => $nextDayTimeoutParsed,
                        'hours_worked' => $hoursWorked,
                        'is_nightshift' => $isNightShift,
                        'trip' => floatval($trip),
                        'source' => 'import',
                        'posting_status' => 'not_posted'
                    ];
                    
                    if ($existingRecord) {
                        // Update existing record
                        $existingRecord->update($attendanceData);
                        $updated++;
                    } else {
                        // Create new record
                        ProcessedAttendance::create($attendanceData);
                        $imported++;
                    }
                    
                } catch (\Exception $e) {
                    $errors[] = "Line " . ($lineNumber + 2) . ": " . $e->getMessage();
                    Log::error("Import error on line " . ($lineNumber + 2), [
                        'error' => $e->getMessage(),
                        'row' => $row
                    ]);
                }
            }
        });
        
        $message = "Import completed. {$imported} records imported, {$updated} records updated";
        if (count($errors) > 0) {
            $message .= ". " . count($errors) . " errors occurred.";
        }
        
        return response()->json([
            'success' => true,
            'message' => $message,
            'imported' => $imported,
            'updated' => $updated,
            'errors' => array_slice($errors, 0, 10) // Limit errors shown
        ]);
        
    } catch (\Exception $e) {
        Log::error('Error importing attendance data: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'Import failed: ' . $e->getMessage()
        ], 500);
    }
}

/**
 * Helper method to parse time for import
 */
private function parseTimeForImport($timeString, $date)
{
    if (empty($timeString)) {
        return null;
    }
    
    try {
        // Handle various time formats: HH:MM, H:MM, HH:MM:SS
        if (preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/', $timeString, $matches)) {
            $hour = intval($matches[1]);
            $minute = intval($matches[2]);
            $second = isset($matches[3]) ? intval($matches[3]) : 0;
            
            return $date->copy()->setTime($hour, $minute, $second);
        }
        
        return null;
    } catch (\Exception $e) {
        Log::warning("Could not parse time: {$timeString}");
        return null;
    }
}

/**
 * Helper method to calculate hours from time values
 */
private function calculateHoursFromTimes($timeIn, $timeOut, $breakOut, $breakIn)
{
    if (!$timeIn || !$timeOut) {
        return 0;
    }
    
    try {
        // Calculate total worked minutes
        $totalMinutes = $timeOut->diffInMinutes($timeIn);
        
        // Subtract break time if available
        $breakMinutes = 0;
        if ($breakOut && $breakIn && $breakIn->gt($breakOut)) {
            $breakMinutes = $breakIn->diffInMinutes($breakOut);
        } else {
            // Default 1-hour break if no break times provided
            $breakMinutes = 60;
        }
        
        $netMinutes = max(0, $totalMinutes - $breakMinutes);
        return round($netMinutes / 60, 2);
        
    } catch (\Exception $e) {
        Log::warning("Could not calculate hours: " . $e->getMessage());
        return 0;
    }
}

/**
 * Set holiday for multiple employees on a specific date
 */
public function setHoliday(Request $request)
{
    try {
        // Enhanced validation with proper error messages
        $validator = Validator::make($request->all(), [
            'date' => 'required|date',
            'multiplier' => 'required|numeric|min:0.1|max:10',
            'department' => 'nullable|string|max:255',
            'employee_ids' => 'nullable|array',
            'employee_ids.*' => 'integer|exists:employees,id'
        ], [
            'date.required' => 'Holiday date is required',
            'date.date' => 'Please provide a valid date',
            'multiplier.required' => 'Holiday multiplier is required',
            'multiplier.numeric' => 'Holiday multiplier must be a number',
            'multiplier.min' => 'Holiday multiplier must be at least 0.1',
            'multiplier.max' => 'Holiday multiplier cannot exceed 10',
            'employee_ids.*.exists' => 'One or more selected employees do not exist'
        ]);

        if ($validator->fails()) {
            Log::warning('Holiday validation failed', [
                'errors' => $validator->errors()->toArray(),
                'request_data' => $request->all()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $date = $request->input('date');
        $multiplier = (float) $request->input('multiplier');
        $department = $request->input('department');
        
        // FIX: Properly handle employee_ids to avoid null count() error
        $employeeIds = $request->input('employee_ids');
        
        // Ensure employee_ids is always an array (empty array if null)
        if (!is_array($employeeIds)) {
            $employeeIds = [];
        }

        Log::info('Setting holiday', [
            'date' => $date,
            'multiplier' => $multiplier,
            'department' => $department,
            'employee_ids_count' => count($employeeIds)  // Now safe to count
        ]);

        // Build query for affected attendance records
        $query = ProcessedAttendance::whereDate('attendance_date', $date)
            ->where('posting_status', '!=', 'posted') // Only non-posted records
            // Only set holiday for records that don't have overtime
            ->where(function ($q) {
                $q->where(function($subQ) {
                    $subQ->where('overtime', 0)->orWhereNull('overtime');
                })
                ->where(function($subQ) {
                    $subQ->where('ot_reg_holiday', 0)->orWhereNull('ot_reg_holiday');
                })
                ->where(function($subQ) {
                    $subQ->where('ot_special_holiday', 0)->orWhereNull('ot_special_holiday');
                });
            });

        // Filter by department if specified
        if (!empty($department)) {
            $query->whereHas('employee', function ($q) use ($department) {
                $q->where('Department', $department);
            });
        }

        // Filter by specific employees if specified
        if (count($employeeIds) > 0) {  // Now safe to use count()
            $query->whereIn('employee_id', $employeeIds);
        }

        // Get affected records
        $affectedRecords = $query->get();

        Log::info('Found records for holiday update', [
            'count' => $affectedRecords->count(),
            'date' => $date
        ]);

        if ($affectedRecords->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No eligible attendance records found for the specified date and criteria. Records with existing overtime are excluded.'
            ], 404);
        }

        // Update records using database transaction for consistency
        DB::beginTransaction();
        
        try {
            $updatedCount = 0;
            foreach ($affectedRecords as $record) {
                $record->update([
                    'holiday' => $multiplier,
                    'source' => 'holiday_set',
                    'updated_at' => now()
                ]);
                $updatedCount++;
                
                Log::debug('Updated holiday for record', [
                    'id' => $record->id,
                    'employee_id' => $record->employee_id,
                    'multiplier' => $multiplier
                ]);
            }
            
            DB::commit();
            
            Log::info("Holiday set for {$updatedCount} records", [
                'date' => $date,
                'multiplier' => $multiplier,
                'department' => $department,
                'employee_count' => count($employeeIds),  // Safe to count
                'updated_count' => $updatedCount
            ]);

            return response()->json([
                'success' => true,
                'message' => "Holiday multiplier ({$multiplier}) set for {$updatedCount} attendance records on {$date}",
                'updated_count' => $updatedCount
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

    } catch (\Exception $e) {
        Log::error('Error setting holiday', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
            'request_data' => $request->all()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'Failed to set holiday: ' . $e->getMessage()
        ], 500);
    }
}

/**
     * POST to Payroll - Create payroll summaries
     */
    public function postToPayroll(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'year' => 'required|integer|min:2020|max:2030',
                'month' => 'required|integer|min:1|max:12',
                'period_type' => 'required|in:1st_half,2nd_half',
                'department' => 'nullable|string',
                'employee_ids' => 'nullable|array',
                'employee_ids.*' => 'integer|exists:employees,id'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $year = $request->input('year');
            $month = $request->input('month');
            $periodType = $request->input('period_type');
            $department = $request->input('department');
            
            // FIX: Properly handle employee_ids to avoid null count() error
            $employeeIds = $request->input('employee_ids');
            
            // Ensure employee_ids is always an array (empty array if null)
            if (!is_array($employeeIds)) {
                $employeeIds = [];
            }

            Log::info('Starting payroll posting process', [
                'year' => $year,
                'month' => $month,
                'period_type' => $periodType,
                'department' => $department,
                'employee_ids_count' => count($employeeIds)
            ]);

            // Calculate period dates
            [$startDate, $endDate] = \App\Models\PayrollSummary::calculatePeriodDates($year, $month, $periodType);

            // Build query for attendance records to post
            $attendanceQuery = ProcessedAttendance::whereBetween('attendance_date', [$startDate, $endDate])
                ->where('posting_status', 'not_posted')
                ->with('employee');

            // Apply filters
            if ($department) {
                $attendanceQuery->whereHas('employee', function ($q) use ($department) {
                    $q->where('Department', $department);
                });
            }

            if (count($employeeIds) > 0) {
                $attendanceQuery->whereIn('employee_id', $employeeIds);
            }

            // Get attendance records grouped by employee
            $attendanceRecords = $attendanceQuery->get();
            $employeeGroups = $attendanceRecords->groupBy('employee_id');

            if ($employeeGroups->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No attendance records found for the specified criteria'
                ], 404);
            }

            DB::beginTransaction();

            try {
                $postedEmployees = 0;
                $updatedRecords = 0;
                $errors = [];

                foreach ($employeeGroups as $employeeId => $records) {
                    try {
                        // Check if summary already exists
                        $existingSummary = \App\Models\PayrollSummary::where('employee_id', $employeeId)
                            ->where('year', $year)
                            ->where('month', $month)
                            ->where('period_type', $periodType)
                            ->first();

                        if ($existingSummary && $existingSummary->isPosted()) {
                            $errors[] = "Employee {$records->first()->employee->idno} already has a posted summary for this period";
                            continue;
                        }

                        // FIXED: Generate summary data using the corrected method
                        $summaryData = \App\Models\PayrollSummary::generateFromAttendance($employeeId, $year, $month, $periodType);
                        $summaryData['status'] = 'posted';
                        $summaryData['posted_by'] = auth()->id();
                        $summaryData['posted_at'] = now();

                        // Create or update summary
                        if ($existingSummary) {
                            $existingSummary->update($summaryData);
                            $summary = $existingSummary;
                        } else {
                            $summary = \App\Models\PayrollSummary::create($summaryData);
                        }

                        // Mark attendance records as posted
                        foreach ($records as $record) {
                            $record->update([
                                'posting_status' => 'posted',
                                'posted_at' => now(),
                                'posted_by' => auth()->id()
                            ]);
                            $updatedRecords++;
                        }

                        $postedEmployees++;

                        Log::info('Created payroll summary', [
                            'employee_id' => $employeeId,
                            'employee_no' => $summary->employee_no,
                            'period' => $summary->full_period,
                            'days_worked' => $summary->days_worked,
                            'ot_hours' => $summary->ot_hours,
                            'off_days' => $summary->off_days,
                            'late_under_minutes' => $summary->late_under_minutes,
                            'nsd_hours' => $summary->nsd_hours,
                            'slvl_days' => $summary->slvl_days,
                            'retro' => $summary->retro
                        ]);

                    } catch (\Exception $e) {
                        $employee = $records->first()->employee;
                        $errors[] = "Failed to process employee {$employee->idno}: " . $e->getMessage();
                        Log::error("Error processing employee {$employeeId}", [
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString()
                        ]);
                    }
                }

                DB::commit();

                $message = "Successfully posted {$postedEmployees} employee summaries and updated {$updatedRecords} attendance records";
                if (!empty($errors)) {
                    $message .= ". " . count($errors) . " errors occurred.";
                }

                Log::info('Payroll posting completed', [
                    'posted_employees' => $postedEmployees,
                    'updated_records' => $updatedRecords,
                    'error_count' => count($errors)
                ]);

                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'posted_employees' => $postedEmployees,
                    'updated_records' => $updatedRecords,
                    'errors' => $errors
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Error in payroll posting process', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Payroll posting failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get posting preview data (FIXED VERSION)
     */
    public function getPostingPreview(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'year' => 'required|integer|min:2020|max:2030',
                'month' => 'required|integer|min:1|max:12',
                'period_type' => 'required|in:1st_half,2nd_half',
                'department' => 'nullable|string',
                'employee_ids' => 'nullable|array',
                'employee_ids.*' => 'integer|exists:employees,id'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $year = $request->input('year');
            $month = $request->input('month');
            $periodType = $request->input('period_type');
            $department = $request->input('department');
            
            // FIX: Properly handle employee_ids to avoid null count() error
            $employeeIds = $request->input('employee_ids');
            
            // Ensure employee_ids is always an array (empty array if null)
            if (!is_array($employeeIds)) {
                $employeeIds = [];
            }

            // Calculate period dates
            [$startDate, $endDate] = \App\Models\PayrollSummary::calculatePeriodDates($year, $month, $periodType);

            // Build query for attendance records
            $attendanceQuery = ProcessedAttendance::whereBetween('attendance_date', [$startDate, $endDate])
                ->where('posting_status', 'not_posted')
                ->with('employee');

            // Apply filters
            if ($department) {
                $attendanceQuery->whereHas('employee', function ($q) use ($department) {
                    $q->where('Department', $department);
                });
            }

            if (count($employeeIds) > 0) {
                $attendanceQuery->whereIn('employee_id', $employeeIds);
            }

            // Get attendance records grouped by employee
            $attendanceRecords = $attendanceQuery->get();
            $employeeGroups = $attendanceRecords->groupBy('employee_id');

            $preview = [];
            $totals = [
                'employees' => 0,
                'records' => 0,
                'days_worked' => 0,
                'ot_hours' => 0,
                'off_days' => 0,
                'late_under_minutes' => 0,
                'nsd_hours' => 0,
                'slvl_days' => 0,
                'retro' => 0
            ];

            foreach ($employeeGroups as $employeeId => $records) {
                $employee = $records->first()->employee;
                
                // Check if summary already exists
                $existingSummary = \App\Models\PayrollSummary::where('employee_id', $employeeId)
                    ->where('year', $year)
                    ->where('month', $month)
                    ->where('period_type', $periodType)
                    ->first();

                // FIXED: Generate preview summary using the corrected method
                $summaryData = \App\Models\PayrollSummary::generateFromAttendance($employeeId, $year, $month, $periodType);
                
                $preview[] = [
                    'employee_id' => $employeeId,
                    'employee_no' => $employee->idno,
                    'employee_name' => trim($employee->Fname . ' ' . $employee->Lname),
                    'department' => $employee->Department,
                    'line' => $employee->Line,
                    'record_count' => $records->count(),
                    'days_worked' => $summaryData['days_worked'],
                    'ot_hours' => $summaryData['ot_hours'],
                    'off_days' => $summaryData['off_days'],
                    'late_under_minutes' => $summaryData['late_under_minutes'],
                    'nsd_hours' => $summaryData['nsd_hours'],
                    'slvl_days' => $summaryData['slvl_days'],
                    'retro' => $summaryData['retro'],
                    'existing_summary' => $existingSummary ? [
                        'id' => $existingSummary->id,
                        'status' => $existingSummary->status,
                        'posted_at' => $existingSummary->posted_at
                    ] : null,
                    'will_update' => $existingSummary && !$existingSummary->isPosted()
                ];

                // Add to totals
                $totals['employees']++;
                $totals['records'] += $records->count();
                $totals['days_worked'] += $summaryData['days_worked'];
                $totals['ot_hours'] += $summaryData['ot_hours'];
                $totals['off_days'] += $summaryData['off_days'];
                $totals['late_under_minutes'] += $summaryData['late_under_minutes'];
                $totals['nsd_hours'] += $summaryData['nsd_hours'];
                $totals['slvl_days'] += $summaryData['slvl_days'];
                $totals['retro'] += $summaryData['retro'];
            }

            return response()->json([
                'success' => true,
                'preview' => $preview,
                'totals' => $totals,
                'period' => [
                    'start_date' => $startDate->format('Y-m-d'),
                    'end_date' => $endDate->format('Y-m-d'),
                    'period_type' => $periodType,
                    'year' => $year,
                    'month' => $month,
                    'label' => $periodType === '1st_half' ? '1-15' : '16-' . $endDate->day
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error generating posting preview', [
                'error' => $e->getMessage(),
                'request_data' => $request->all()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to generate posting preview: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get payroll summaries with filtering and pagination
     */
    public function getPayrollSummaries(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'year' => 'nullable|integer|min:2020|max:2030',
                'month' => 'nullable|integer|min:1|max:12',
                'period_type' => 'nullable|in:1st_half,2nd_half',
                'department' => 'nullable|string',
                'status' => 'nullable|in:draft,posted,locked',
                'page' => 'nullable|integer|min:1',
                'per_page' => 'nullable|integer|min:1|max:100'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Get filter parameters with defaults
            $year = $request->input('year', now()->year);
            $month = $request->input('month', now()->month);
            $periodType = $request->input('period_type');
            $department = $request->input('department');
            $status = $request->input('status');
            $perPage = $request->input('per_page', 25);

            // Build query
            $query = \App\Models\PayrollSummary::with(['employee', 'postedBy'])
                ->where('year', $year)
                ->where('month', $month);

            // Apply filters
            if ($periodType) {
                $query->where('period_type', $periodType);
            }

            if ($department) {
                $query->where('department', $department);
            }

            if ($status) {
                $query->where('status', $status);
            }

            // Order by creation date descending
            $query->orderBy('created_at', 'desc');

            // Paginate results
            $summaries = $query->paginate($perPage);

            // Calculate statistics
            $statisticsQuery = \App\Models\PayrollSummary::where('year', $year)
                ->where('month', $month);

            if ($periodType) {
                $statisticsQuery->where('period_type', $periodType);
            }
            if ($department) {
                $statisticsQuery->where('department', $department);
            }
            if ($status) {
                $statisticsQuery->where('status', $status);
            }

            $statistics = $statisticsQuery->selectRaw('
                COUNT(*) as total_summaries,
                SUM(days_worked) as total_days_worked,
                SUM(ot_hours) as total_ot_hours,
                SUM(off_days) as total_off_days,
                SUM(late_under_minutes) as total_late_under_minutes,
                SUM(nsd_hours) as total_nsd_hours,
                SUM(slvl_days) as total_slvl_days,
                SUM(retro) as total_retro,
                AVG(days_worked) as avg_days_worked,
                AVG(ot_hours) as avg_ot_hours
            ')->first();

            // Process the summaries data
            $processedSummaries = $summaries->map(function ($summary) {
                $summary->full_period = $summary->getFullPeriodAttribute();
                return $summary;
            });

            return response()->json([
                'success' => true,
                'data' => $processedSummaries,
                'pagination' => [
                    'total' => $summaries->total(),
                    'per_page' => $summaries->perPage(),
                    'current_page' => $summaries->currentPage(),
                    'last_page' => $summaries->lastPage(),
                    'from' => $summaries->firstItem(),
                    'to' => $summaries->lastItem()
                ],
                'statistics' => $statistics,
                'filters' => [
                    'year' => $year,
                    'month' => $month,
                    'period_type' => $periodType,
                    'department' => $department,
                    'status' => $status
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching payroll summaries: ' . $e->getMessage(), [
                'request_data' => $request->all(),
                'exception' => $e
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch payroll summaries: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export payroll summaries to CSV
     */
    public function exportPayrollSummaries(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'year' => 'nullable|integer|min:2020|max:2030',
                'month' => 'nullable|integer|min:1|max:12',
                'period_type' => 'nullable|in:1st_half,2nd_half',
                'department' => 'nullable|string',
                'status' => 'nullable|in:draft,posted,locked'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Get filter parameters with defaults
            $year = $request->input('year', now()->year);
            $month = $request->input('month', now()->month);
            $periodType = $request->input('period_type');
            $department = $request->input('department');
            $status = $request->input('status');

            // Build query
            $query = \App\Models\PayrollSummary::with(['employee', 'postedBy'])
                ->where('year', $year)
                ->where('month', $month);

            // Apply filters
            if ($periodType) {
                $query->where('period_type', $periodType);
            }
            if ($department) {
                $query->where('department', $department);
            }
            if ($status) {
                $query->where('status', $status);
            }

            // Order by employee name
            $query->orderBy('employee_name', 'asc');

            // Get all matching records
            $summaries = $query->get();

            // Prepare file name
            $fileName = 'payroll_summaries_' . $year . '_' . str_pad($month, 2, '0', STR_PAD_LEFT);
            if ($periodType) {
                $fileName .= '_' . $periodType;
            }
            if ($department) {
                $fileName .= '_' . str_replace(' ', '_', $department);
            }
            $fileName .= '_' . date('Y-m-d_H-i-s') . '.csv';

            // Define headers
            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="' . $fileName . '"',
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0'
            ];

            // Create callback for streamed response
            $callback = function() use ($summaries) {
                $file = fopen('php://output', 'w');

                // Add CSV header row
                fputcsv($file, [
                    'Employee No',
                    'Employee Name',
                    'Cost Center',
                    'Department',
                    'Line',
                    'Period Start',
                    'Period End',
                    'Period Type',
                    'Year',
                    'Month',
                    'Days Worked',
                    'OT Hours',
                    'Off Days',
                    'Late/Under Minutes',
                    'Late/Under Hours',
                    'NSD Hours',
                    'SLVL Days',
                    'Retro',
                    'Travel Order Hours',
                    'Holiday Hours',
                    'OT Reg Holiday Hours',
                    'OT Special Holiday Hours',
                    'Offset Hours',
                    'Trip Count',
                    'Has CT',
                    'Has CS',
                    'Has OB',
                    'Status',
                    'Posted By',
                    'Posted At',
                    'Created At'
                ]);

                // Add data rows
                foreach ($summaries as $summary) {
                    $row = [
                        $summary->employee_no,
                        $summary->employee_name,
                        $summary->cost_center,
                        $summary->department,
                        $summary->line,
                        $summary->period_start ? $summary->period_start->format('Y-m-d') : '',
                        $summary->period_end ? $summary->period_end->format('Y-m-d') : '',
                        $summary->period_type,
                        $summary->year,
                        $summary->month,
                        number_format($summary->days_worked, 2),
                        number_format($summary->ot_hours, 2),
                        number_format($summary->off_days, 2),
                        number_format($summary->late_under_minutes, 2),
                        number_format($summary->late_under_minutes / 60, 2),
                        number_format($summary->nsd_hours, 2),
                        number_format($summary->slvl_days, 2),
                        number_format($summary->retro, 2),
                        number_format($summary->travel_order_hours, 2),
                        number_format($summary->holiday_hours, 2),
                        number_format($summary->ot_reg_holiday_hours, 2),
                        number_format($summary->ot_special_holiday_hours, 2),
                        number_format($summary->offset_hours, 2),
                        number_format($summary->trip_count, 2),
                        $summary->has_ct ? 'Yes' : 'No',
                        $summary->has_cs ? 'Yes' : 'No',
                        $summary->has_ob ? 'Yes' : 'No',
                        ucfirst($summary->status),
                        $summary->postedBy ? $summary->postedBy->name : '',
                        $summary->posted_at ? $summary->posted_at->format('Y-m-d H:i:s') : '',
                        $summary->created_at ? $summary->created_at->format('Y-m-d H:i:s') : ''
                    ];

                    fputcsv($file, $row);
                }

                fclose($file);
            };

            return response()->stream($callback, 200, $headers);

        } catch (\Exception $e) {
            Log::error('Error exporting payroll summaries: ' . $e->getMessage(), [
                'request_data' => $request->all(),
                'exception' => $e
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to export payroll summaries: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a payroll summary and revert attendance records
     */
    public function deletePayrollSummary($id)
    {
        try {
            $summary = \App\Models\PayrollSummary::findOrFail($id);

            // Check if summary is locked
            if ($summary->status === 'locked') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete a locked payroll summary'
                ], 403);
            }

            DB::beginTransaction();

            try {
                // Calculate period dates
                [$startDate, $endDate] = \App\Models\PayrollSummary::calculatePeriodDates(
                    $summary->year, 
                    $summary->month, 
                    $summary->period_type
                );

                // Revert attendance records to not-posted status
                $updatedRecords = ProcessedAttendance::where('employee_id', $summary->employee_id)
                    ->whereBetween('attendance_date', [$startDate, $endDate])
                    ->where('posting_status', 'posted')
                    ->update([
                        'posting_status' => 'not_posted',
                        'posted_at' => null,
                        'posted_by' => null,
                        'updated_at' => now()
                    ]);

                // Delete the summary
                $summary->delete();

                DB::commit();

                Log::info('Payroll summary deleted and attendance records reverted', [
                    'summary_id' => $id,
                    'employee_id' => $summary->employee_id,
                    'period' => $summary->period_type,
                    'year' => $summary->year,
                    'month' => $summary->month,
                    'reverted_records' => $updatedRecords
                ]);

                return response()->json([
                    'success' => true,
                    'message' => "Payroll summary deleted successfully. {$updatedRecords} attendance records reverted to not-posted status.",
                    'reverted_records' => $updatedRecords
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Payroll summary not found'
            ], 404);
        } catch (\Exception $e) {
            Log::error('Error deleting payroll summary: ' . $e->getMessage(), [
                'summary_id' => $id,
                'exception' => $e
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete payroll summary: ' . $e->getMessage()
            ], 500);
        }
    }
}