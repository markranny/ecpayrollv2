<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Department;
use App\Models\ProcessedAttendance;
use App\Models\PayrollSummary;
use App\Models\Offset;
use App\Models\CancelRestDay;
use App\Models\Retro;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
class ProcessedAttendanceController extends Controller
{

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

    // FIXED: Late calculation logic - always calculate from expected time, regardless of hours worked
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
                // Calculate late minutes - FIXED: Always calculate from expected time
                try {
                    $attendanceDate = \Carbon\Carbon::parse($attendance->attendance_date);
                    $actualTimeIn = \Carbon\Carbon::parse($attendance->time_in);
                    
                    // FIXED: Determine expected time based on time_out to better identify shift type
                    // Look ahead to see the time_out to determine correct shift
                    $timeOut = null;
                    if ($attendance->is_nightshift && $attendance->next_day_timeout) {
                        $timeOut = \Carbon\Carbon::parse($attendance->next_day_timeout);
                    } elseif ($attendance->time_out) {
                        $timeOut = \Carbon\Carbon::parse($attendance->time_out);
                    }
                    
                    $timeInHour = $actualTimeIn->hour;
                    $expectedTimeIn = null;
                    
                    // Use time_out to better determine shift type
                    if ($timeOut) {
                        $timeOutHour = $timeOut->hour;
                        $timeOutMinute = $timeOut->minute;
                        
                        Log::info("Shift detection", [
                            'attendance_id' => $attendance->id,
                            'time_out_hour' => $timeOutHour,
                            'time_out_minute' => $timeOutMinute,
                            'time_out_full' => $timeOut->format('H:i:s')
                        ]);
                        
                        // 8 AM - 5 PM shift: time_out around 5:00-5:30 PM (17:00-17:30)
                        if ($timeOutHour == 17 && $timeOutMinute <= 30) {
                            $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0); // 8:00 AM for 8-5 shift
                            Log::info("Detected 8-5 shift", ['attendance_id' => $attendance->id]);
                        }
                        // 9 AM - 6 PM shift: time_out around 6:00-6:30 PM (18:00-18:30)
                        else if ($timeOutHour == 18 && $timeOutMinute <= 30) {
                            $expectedTimeIn = $attendanceDate->copy()->setTime(9, 0, 0); // 9:00 AM for 9-6 shift
                            Log::info("Detected 9-6 shift", ['attendance_id' => $attendance->id]);
                        }
                        // Flexible 8-5 shift: time_out between 5:00-5:59 PM
                        else if ($timeOutHour == 17) {
                            $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0); // 8:00 AM for 8-5 shift
                            Log::info("Detected flexible 8-5 shift", ['attendance_id' => $attendance->id]);
                        }
                        // Flexible 9-6 shift: time_out between 6:00-6:59 PM  
                        else if ($timeOutHour == 18) {
                            $expectedTimeIn = $attendanceDate->copy()->setTime(9, 0, 0); // 9:00 AM for 9-6 shift
                            Log::info("Detected flexible 9-6 shift", ['attendance_id' => $attendance->id]);
                        }
                        // Evening shift: time_out around 2 AM next day
                        else if ($timeOutHour >= 1 && $timeOutHour <= 3) {
                            $expectedTimeIn = $attendanceDate->copy()->setTime(18, 0, 0); // 6:00 PM
                            Log::info("Detected evening shift", ['attendance_id' => $attendance->id]);
                        }
                        // Night shift: time_out around 6-8 AM next day
                        else if ($timeOutHour >= 6 && $timeOutHour <= 8) {
                            $expectedTimeIn = $attendanceDate->copy()->setTime(22, 0, 0); // 10:00 PM
                            Log::info("Detected night shift", ['attendance_id' => $attendance->id]);
                        }
                        else {
                            Log::info("Using fallback shift detection", ['attendance_id' => $attendance->id]);
                            // Fallback to time_in based detection
                            if ($timeInHour >= 6 && $timeInHour <= 10) {
                                $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0); // 8:00 AM
                            } elseif ($timeInHour >= 13 && $timeInHour <= 16) {
                                $expectedTimeIn = $attendanceDate->copy()->setTime(14, 0, 0); // 2:00 PM
                            } elseif ($timeInHour >= 17 && $timeInHour <= 20) {
                                $expectedTimeIn = $attendanceDate->copy()->setTime(18, 0, 0); // 6:00 PM
                            } elseif ($timeInHour >= 21 || $timeInHour <= 5) {
                                $expectedTimeIn = $attendanceDate->copy()->setTime(22, 0, 0); // 10:00 PM
                            } else {
                                $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0); // Default 8:00 AM
                            }
                        }
                    } else {
                        // No time_out available, use time_in based detection
                        if ($timeInHour >= 6 && $timeInHour <= 10) {
                            $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0); // 8:00 AM
                        } elseif ($timeInHour >= 13 && $timeInHour <= 16) {
                            $expectedTimeIn = $attendanceDate->copy()->setTime(14, 0, 0); // 2:00 PM
                        } elseif ($timeInHour >= 17 && $timeInHour <= 20) {
                            $expectedTimeIn = $attendanceDate->copy()->setTime(18, 0, 0); // 6:00 PM
                        } elseif ($timeInHour >= 21 || $timeInHour <= 5) {
                            $expectedTimeIn = $attendanceDate->copy()->setTime(22, 0, 0); // 10:00 PM
                        } else {
                            $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0); // Default 8:00 AM
                        }
                    }
                    
                    // FIXED: Always calculate late minutes if time_in is after expected time
                    if ($actualTimeIn->gt($expectedTimeIn)) {
                        $lateMinutes = abs($actualTimeIn->diffInMinutes($expectedTimeIn));
                    } else {
                        $lateMinutes = 0;
                    }
                    
                    Log::info("Late calculation", [
                        'attendance_id' => $attendance->id,
                        'expected_time_in' => $expectedTimeIn->format('H:i:s'),
                        'actual_time_in' => $actualTimeIn->format('H:i:s'),
                        'late_minutes' => $lateMinutes
                    ]);
                    
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
                
                // Check if this is a halfday scenario
                $hasPartialData = ($attendance->time_in || $attendance->break_in || $attendance->break_out || $timeOut);
                
                if ($timeOut) {
                    try {
                        // Apply time rounding for time out only (round down to nearest hour)
                        $timeIn = \Carbon\Carbon::parse($attendance->time_in);
                        $timeOutParsed = \Carbon\Carbon::parse($timeOut);
                        $roundedTimeOut = $this->applyTimeOutRounding($timeOut);
                        
                        // Handle next day scenarios for night shifts
                        if ($attendance->is_nightshift && $roundedTimeOut->lt($timeIn)) {
                            $roundedTimeOut->addDay();
                        }
                        
                        // Calculate total worked minutes using original time in and rounded time out
                        $totalWorkedMinutes = abs($roundedTimeOut->diffInMinutes($timeIn));
                        
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
                                    $breakMinutes = 0;
                                }
                            } catch (\Exception $e) {
                                Log::error("Error parsing break times for attendance {$attendance->id}: " . $e->getMessage());
                                $breakMinutes = 0;
                            }
                        } else {
                            $breakMinutes = 0;
                        }
                        
                        // Calculate net worked time
                        $netWorkedMinutes = max(0, $totalWorkedMinutes - $breakMinutes);
                        
                        // Calculate hours worked
                        $hoursWorked = round($netWorkedMinutes / 60, 2);
                        
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
                }
                
                // FIXED: Late calculation logic - removed the 9+ hours check
                // Late minutes are always calculated from expected time if employee is late
                // No special handling based on hours worked
                
                // Calculate undertime
                if ($isHalfday) {
                    // For halfday, no undertime calculation
                    $undertimeMinutes = 0;
                    Log::info("Halfday detected - setting undertime minutes to 0", [
                        'attendance_id' => $attendance->id
                    ]);
                } elseif ($hoursWorked == 0 || !$timeOut) {
                    // If no valid hours worked or no time_out, set undertime to 0
                    $undertimeMinutes = 0;
                    Log::info("No valid work hours calculated - setting undertime minutes to 0", [
                        'attendance_id' => $attendance->id,
                        'hours_worked' => $hoursWorked,
                        'has_time_out' => !empty($timeOut)
                    ]);
                } else {
                    // Calculate undertime based on 9-hour minimum requirement
                    $minimumWorkHours = 9;
                    $minimumWorkMinutes = $minimumWorkHours * 60; // 9 hours = 540 minutes
                    $netWorkedMinutes = $hoursWorked * 60;
                    
                    if ($netWorkedMinutes < $minimumWorkMinutes) {
                        $calculatedUndertime = round($minimumWorkMinutes - $netWorkedMinutes, 2);
                        
                        // If undertime is less than 60 minutes (1 hour), set to 0
                        if ($calculatedUndertime < 60) {
                            $undertimeMinutes = 0;
                            Log::info("Undertime less than 60 minutes - setting to 0", [
                                'attendance_id' => $attendance->id,
                                'calculated_undertime' => $calculatedUndertime,
                                'final_undertime' => $undertimeMinutes
                            ]);
                        } else {
                            $undertimeMinutes = $calculatedUndertime;
                        }
                    } else {
                        $undertimeMinutes = 0;
                    }
                    
                    Log::info("Undertime calculation", [
                        'attendance_id' => $attendance->id,
                        'hours_worked' => $hoursWorked,
                        'minimum_work_hours' => $minimumWorkHours,
                        'net_worked_minutes' => $netWorkedMinutes,
                        'undertime_minutes' => $undertimeMinutes,
                        'is_undertime' => $hoursWorked < $minimumWorkHours
                    ]);
                }
                
                Log::info("Final calculations", [
                    'attendance_id' => $attendance->id,
                    'hours_worked' => $hoursWorked,
                    'late_minutes' => $lateMinutes,  // FIXED: This will now show 12 minutes for your example
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
            
            // Format the datetime fields for each record - IMPROVED FORMATTING
            foreach ($processedData as &$attendance) {
                // FIXED: Format times consistently with seconds for better parsing
                $attendance->time_in_formatted = $this->formatTimeForAPI($attendance->time_in);
                $attendance->time_out_formatted = $this->formatTimeForAPI($attendance->time_out);
                $attendance->break_in_formatted = $this->formatTimeForAPI($attendance->break_in);
                $attendance->break_out_formatted = $this->formatTimeForAPI($attendance->break_out);
                $attendance->next_day_timeout_formatted = $this->formatTimeForAPI($attendance->next_day_timeout);
                
                // Keep original timestamps for editing - FIXED: Use proper format check
                $attendance->time_in_raw = $attendance->time_in ? 
                    ($attendance->time_in instanceof \Carbon\Carbon ? 
                        $attendance->time_in->format('Y-m-d H:i:s') : 
                        $attendance->time_in) : null;
                        
                $attendance->time_out_raw = $attendance->time_out ? 
                    ($attendance->time_out instanceof \Carbon\Carbon ? 
                        $attendance->time_out->format('Y-m-d H:i:s') : 
                        $attendance->time_out) : null;
                        
                $attendance->break_in_raw = $attendance->break_in ? 
                    ($attendance->break_in instanceof \Carbon\Carbon ? 
                        $attendance->break_in->format('Y-m-d H:i:s') : 
                        $attendance->break_in) : null;
                        
                $attendance->break_out_raw = $attendance->break_out ? 
                    ($attendance->break_out instanceof \Carbon\Carbon ? 
                        $attendance->break_out->format('Y-m-d H:i:s') : 
                        $attendance->break_out) : null;
                        
                $attendance->next_day_timeout_raw = $attendance->next_day_timeout ? 
                    ($attendance->next_day_timeout instanceof \Carbon\Carbon ? 
                        $attendance->next_day_timeout->format('Y-m-d H:i:s') : 
                        $attendance->next_day_timeout) : null;
                
                // Format date and get day of week - unchanged
                if ($attendance->attendance_date) {
                    $attendance->attendance_date_formatted = $attendance->attendance_date->format('Y-m-d');
                    $attendance->day = $attendance->attendance_date->format('l');
                } else {
                    $attendance->attendance_date_formatted = null;
                    $attendance->day = null;
                }
                
                // Add employee info - unchanged
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

                // NEW: Add offset, rest day, and retro data from related tables
                $this->populateRelatedData($attendance);
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

     private function populateRelatedData($attendance)
    {
        try {
            $attendanceDate = $attendance->attendance_date;
            $employeeId = $attendance->employee_id;

            // Get offset data for this employee on this date (debit transactions)
            $offsetData = Offset::where('employee_id', $employeeId)
                ->whereDate('date', $attendanceDate)
                ->where('transaction_type', 'debit')
                ->where('status', 'approved')
                ->sum('hours');
            
            // Update the offset field in the attendance record if different
            if ($attendance->offset != $offsetData) {
                $attendance->offset = $offsetData;
                DB::table('processed_attendances')
                    ->where('id', $attendance->id)
                    ->update(['offset' => $offsetData]);
            }

            // Get rest day data (cancel rest day)
            $restDayData = CancelRestDay::where('employee_id', $employeeId)
                ->whereDate('rest_day_date', $attendanceDate)
                ->where('status', 'approved')
                ->exists();
            
            // Update the restday field in the attendance record if different
            if ($attendance->restday != $restDayData) {
                $attendance->restday = $restDayData;
                DB::table('processed_attendances')
                    ->where('id', $attendance->id)
                    ->update(['restday' => $restDayData]);
            }

            // Get retro data for this employee on this date
            $retroData = Retro::where('employee_id', $employeeId)
                ->whereDate('retro_date', $attendanceDate)
                ->where('status', 'approved')
                ->sum(DB::raw('computed_amount'));
            
            // Update the retromultiplier field in the attendance record if different
            // Note: Using retromultiplier field to store computed retro amount
            if ($attendance->retromultiplier != $retroData) {
                $attendance->retromultiplier = $retroData;
                DB::table('processed_attendances')
                    ->where('id', $attendance->id)
                    ->update(['retromultiplier' => $retroData]);
            }

            Log::debug("Populated related data for attendance {$attendance->id}", [
                'offset_hours' => $offsetData,
                'is_rest_day' => $restDayData,
                'retro_amount' => $retroData
            ]);

        } catch (\Exception $e) {
            Log::error("Error populating related data for attendance {$attendance->id}: " . $e->getMessage());
        }
    }
private function formatTimeForAPI($timeValue)
    {
        if ($timeValue === null || $timeValue === '') {
            return null;
        }
        
        try {
            if ($timeValue instanceof \Carbon\Carbon) {
                // Return time in H:i:s format for consistent parsing
                return $timeValue->format('H:i:s');
            }
            
            $carbonTime = \Carbon\Carbon::parse($timeValue);
            // Return time in H:i:s format for consistent parsing
            return $carbonTime->format('H:i:s');
            
        } catch (\Exception $e) {
            Log::warning('API time formatting error: ' . $e->getMessage(), [
                'time_value' => $timeValue
            ]);
            return null;
        }
    }

    public function recalculateAll(Request $request)
{
    try {
        // Enhanced validation
        $validator = Validator::make($request->all(), [
            'date' => 'nullable|date',
            'department' => 'nullable|string|max:255'
        ]);

        if ($validator->fails()) {
            Log::warning('Recalculation validation failed', [
                'errors' => $validator->errors()->toArray(),
                'request_data' => $request->all()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $dateFilter = $request->input('date');
        $departmentFilter = $request->input('department');
        
        Log::info('Starting manual recalculation', [
            'date_filter' => $dateFilter,
            'department_filter' => $departmentFilter,
            'initiated_by' => auth()->id()
        ]);
        
        // Build query for recalculation with enhanced filtering
        $query = ProcessedAttendance::whereNotNull('time_in')
            ->where('posting_status', '!=', 'posted'); // Only recalculate non-posted records
        
        if ($dateFilter) {
            $query->whereDate('attendance_date', $dateFilter);
        }
        
        if ($departmentFilter) {
            $query->whereHas('employee', function ($q) use ($departmentFilter) {
                $q->where('Department', $departmentFilter);
            });
        }
        
        $attendances = $query->with('employee')->get();
        $recalculatedCount = 0;
        $errorCount = 0;
        $errors = [];
        
        Log::info("Found {$attendances->count()} attendance records for recalculation");
        
        // Use database transaction for better data integrity
        DB::beginTransaction();
        
        try {
            foreach ($attendances as $attendance) {
                try {
                    // Store original values for comparison
                    $originalLate = $attendance->late_minutes ?? 0;
                    $originalUnder = $attendance->undertime_minutes ?? 0;
                    $originalHours = $attendance->hours_worked ?? 0;
                    $originalRetro = $attendance->retromultiplier ?? 0;
                    
                    // Initialize variables
                    $lateMinutes = 0;
                    $undertimeMinutes = 0;
                    $hoursWorked = 0;
                    $isHalfday = false;
                    
                    if ($attendance->time_in) {
                        // Calculate late minutes using improved logic
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
                        
                        // Check if this is a halfday scenario
                        $hasPartialData = ($attendance->time_in || $attendance->break_in || $attendance->break_out || $timeOut);
                        
                        if ($timeOut) {
                            try {
                                // Apply time rounding for time out only (round down to nearest hour)
                                $timeIn = \Carbon\Carbon::parse($attendance->time_in);
                                $timeOutParsed = \Carbon\Carbon::parse($timeOut);
                                $roundedTimeOut = $this->applyTimeOutRounding($timeOut);
                                
                                // Handle next day scenarios for night shifts
                                if ($attendance->is_nightshift && $roundedTimeOut->lt($timeIn)) {
                                    $roundedTimeOut->addDay();
                                }
                                
                                // Calculate total worked minutes using original time in and rounded time out
                                $totalWorkedMinutes = abs($roundedTimeOut->diffInMinutes($timeIn));
                                
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
                                            $breakMinutes = 0;
                                        }
                                    } catch (\Exception $e) {
                                        Log::error("Error parsing break times for attendance {$attendance->id}: " . $e->getMessage());
                                        $breakMinutes = 0;
                                    }
                                } else {
                                    $breakMinutes = 0;
                                }
                                
                                // Calculate net worked time
                                $netWorkedMinutes = max(0, $totalWorkedMinutes - $breakMinutes);
                                
                                // Calculate hours worked
                                $hoursWorked = round($netWorkedMinutes / 60, 2);
                                
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
                        }
                        
                        // Apply late calculation rules
                        if ($isHalfday) {
                            // For halfday, no late calculation
                            $lateMinutes = 0;
                        } elseif ($hoursWorked >= 9) {
                            // If working 9+ hours, not considered late
                            $lateMinutes = 0;
                        } else {
                            // Apply normal late calculation for less than 9 hours
                            $lateMinutes = $initialLateMinutes;
                        }
                        
                        // Calculate undertime
                        if ($isHalfday) {
                            // For halfday, no undertime calculation
                            $undertimeMinutes = 0;
                        } elseif ($hoursWorked == 0 || !$timeOut) {
                            // If no valid hours worked or no time_out, set undertime to 0
                            $undertimeMinutes = 0;
                        } else {
                            // Calculate undertime based on 9-hour minimum requirement
                            $minimumWorkHours = 9;
                            $minimumWorkMinutes = $minimumWorkHours * 60; // 9 hours = 540 minutes
                            $netWorkedMinutes = $hoursWorked * 60;
                            
                            if ($netWorkedMinutes < $minimumWorkMinutes) {
                                $calculatedUndertime = round($minimumWorkMinutes - $netWorkedMinutes, 2);
                                
                                // If undertime is less than 60 minutes (1 hour), set to 0
                                if ($calculatedUndertime < 60) {
                                    $undertimeMinutes = 0;
                                } else {
                                    $undertimeMinutes = $calculatedUndertime;
                                }
                            } else {
                                $undertimeMinutes = 0;
                            }
                        }
                    }
                    
                    // FIXED: Calculate retro value properly
                    $retroValue = $this->calculateRetroMultiplierValue($attendance->employee_id, $attendance->attendance_date);
                    
                    // Check if values need updating (more precise comparison)
                    $needsUpdate = false;
                    
                    if (abs($attendance->late_minutes - $lateMinutes) > 0.01) {
                        $needsUpdate = true;
                    }
                    
                    if (abs($attendance->undertime_minutes - $undertimeMinutes) > 0.01) {
                        $needsUpdate = true;
                    }
                    
                    if (abs($attendance->hours_worked - $hoursWorked) > 0.01) {
                        $needsUpdate = true;
                    }
                    
                    if (abs($attendance->retromultiplier - $retroValue) > 0.01) {
                        $needsUpdate = true;
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
                                    'retromultiplier' => $retroValue, // FIXED: Update retro value
                                    'updated_at' => now()
                                ]);
                            
                            $recalculatedCount++;
                            
                            Log::debug("Recalculated attendance metrics", [
                                'id' => $attendance->id,
                                'employee_id' => $attendance->employee_id,
                                'late_minutes' => $lateMinutes,
                                'undertime_minutes' => $undertimeMinutes,
                                'hours_worked' => $hoursWorked,
                                'retromultiplier' => $retroValue,
                                'affected_rows' => $updateResult
                            ]);
                            
                        } catch (\Exception $e) {
                            $errorCount++;
                            $error = "Error updating attendance {$attendance->id}: " . $e->getMessage();
                            $errors[] = $error;
                            Log::error($error);
                        }
                    }
                    
                } catch (\Exception $e) {
                    $errorCount++;
                    $error = "Error processing attendance {$attendance->id}: " . $e->getMessage();
                    $errors[] = $error;
                    Log::error($error, ['exception' => $e]);
                }
            }
            
            DB::commit();
            
            Log::info("Manual recalculation completed", [
                'total_processed' => $attendances->count(),
                'recalculated_count' => $recalculatedCount,
                'error_count' => $errorCount
            ]);
            
            $message = "Recalculated {$recalculatedCount} attendance records";
            if ($errorCount > 0) {
                $message .= ". {$errorCount} errors occurred.";
            }
            
            return response()->json([
                'success' => true,
                'message' => $message,
                'recalculated_count' => $recalculatedCount,
                'error_count' => $errorCount,
                'errors' => $errorCount > 0 ? array_slice($errors, 0, 5) : []
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
        
    } catch (\Exception $e) {
        Log::error('Error in manual recalculation process: ' . $e->getMessage(), [
            'exception' => $e,
            'trace' => $e->getTraceAsString(),
            'request_data' => $request->all()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'Recalculation failed: ' . $e->getMessage()
        ], 500);
    }
}

    private function updateRelatedDataFromTables($attendance)
    {
        try {
            $attendanceDate = $attendance->attendance_date;
            $employeeId = $attendance->employee_id;

            // Update offset data
            $offsetHours = Offset::where('employee_id', $employeeId)
                ->whereDate('date', $attendanceDate)
                ->where('transaction_type', 'debit')
                ->where('status', 'approved')
                ->sum('hours');

            // Update rest day data
            $isRestDay = CancelRestDay::where('employee_id', $employeeId)
                ->whereDate('rest_day_date', $attendanceDate)
                ->where('status', 'approved')
                ->exists();

            // Update retro data
            $retroAmount = Retro::where('employee_id', $employeeId)
                ->whereDate('retro_date', $attendanceDate)
                ->where('status', 'approved')
                ->sum(DB::raw('computed_amount'));

            // Update the database
            DB::table('processed_attendances')
                ->where('id', $attendance->id)
                ->update([
                    'offset' => $offsetHours,
                    'restday' => $isRestDay,
                    'retromultiplier' => $retroAmount,
                    'updated_at' => now()
                ]);

            Log::debug("Updated related data for attendance {$attendance->id}", [
                'offset_hours' => $offsetHours,
                'is_rest_day' => $isRestDay,
                'retro_amount' => $retroAmount
            ]);

        } catch (\Exception $e) {
            Log::error("Error updating related data for attendance {$attendance->id}: " . $e->getMessage());
        }
    }

    private function safeFormatTime($timeValue)
    {
        // Return null for empty values
        if ($timeValue === null || $timeValue === '') {
            return null;
        }
        
        try {
            // Check if it's already a Carbon instance
            if ($timeValue instanceof \Carbon\Carbon) {
                // Return in H:i:s format (24-hour) for consistent frontend processing
                return $timeValue->format('H:i:s');
            }
            
            // Try to parse the value using Carbon
            $carbonTime = \Carbon\Carbon::parse($timeValue);
            
            // Return in H:i:s format (24-hour) for consistent frontend processing
            return $carbonTime->format('H:i:s');
            
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
    $nightShiftFilter = $request->boolean('night_shift_only');
    $problemsOnlyFilter = $request->boolean('problems_only'); // ADD THIS LINE
    
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
    
    // NEW: Problems only filter - this is complex, so we'll handle it in post-processing
    // We can't easily filter in SQL for problems, so we'll mark this for frontend filtering
    if ($problemsOnlyFilter) {
        // Add a flag to indicate we need to filter for problems in the frontend
        $query->addSelect('*');
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
            'request_data' => $request->all(),
            'is_ajax' => $request->ajax(),
            'expects_json' => $request->expectsJson(),
            'content_type' => $request->header('Content-Type'),
            'accept' => $request->header('Accept')
        ]);

        $validator = Validator::make($request->all(), [
            'time_in' => 'nullable|date_format:H:i',
            'time_out' => 'nullable|date_format:H:i', 
            'break_in' => 'nullable|date_format:H:i',
            'break_out' => 'nullable|date_format:H:i',
            'next_day_timeout' => 'nullable|date_format:H:i',
            'is_nightshift' => 'boolean',
            'trip' => 'nullable|numeric|min:0|max:999.99',
        ]);

        if ($validator->fails()) {
            Log::warning('Validation failed for attendance update ID: ' . $id, [
                'errors' => $validator->errors()->toArray()
            ]);
            
            // Return JSON response for AJAX requests
            if ($request->expectsJson() || $request->ajax()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }
            
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
            'trip' => $request->trip ? (float)$request->trip : 0,
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
        
        // Update related data from other tables
        $this->updateRelatedDataFromTables($attendance);
        
        // **CRITICAL FIX**: Check if this is an AJAX/JSON request
        if ($request->expectsJson() || $request->ajax()) {
            // Return JSON response for AJAX requests
            return response()->json([
                'success' => true,
                'message' => 'Attendance record updated successfully',
                'data' => $attendance->fresh() // Return fresh data from database
            ]);
        }
        
        // For non-AJAX requests, return Inertia response
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
        $nightShiftFilter = $request->boolean('night_shift_only');
        
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
                'night_shift_only' => $nightShiftFilter,
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
        
        // Return JSON error for AJAX requests
        if ($request->expectsJson() || $request->ajax()) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update attendance: ' . $e->getMessage()
            ], 500);
        }
        
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
                $endDate = '2025-08-31';
                
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
                        if (abs($attendance->retromultiplier - $retroMultiplierValue) > 0.01) {
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
                if (abs($attendance->retromultiplier - $retroMultiplierValue) > 0.01) {
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
            Log::debug('Retro model not found');
            return 0.0;
        }
        
        // Get all approved retro records for this employee on this date
        $retroRecords = \App\Models\Retro::where('employee_id', $employeeId)
            ->whereDate('retro_date', $attendanceDate)
            ->where('status', 'approved')
            ->get();
            
        if ($retroRecords->isEmpty()) {
            Log::debug("No retro records found for employee {$employeeId} on {$attendanceDate}");
            return 0.0;
        }
        
        $totalRetroAmount = 0.0;
        
        foreach ($retroRecords as $retro) {
            // Calculate based on your retro table structure
            // Option 1: If you have a computed_amount field
            if (isset($retro->computed_amount)) {
                $totalRetroAmount += (float) $retro->computed_amount;
            }
            // Option 2: If you need to calculate from multiplier_rate and hours_days
            elseif (isset($retro->multiplier_rate) && isset($retro->hours_days)) {
                $totalRetroAmount += (float) ($retro->multiplier_rate * $retro->hours_days);
            }
            // Option 3: If you have a direct amount field
            elseif (isset($retro->amount)) {
                $totalRetroAmount += (float) $retro->amount;
            }
        }
        
        Log::debug("Calculated retro amount for employee {$employeeId} on {$attendanceDate}: {$totalRetroAmount}");
        
        return $totalRetroAmount;
        
    } catch (\Exception $e) {
        Log::error("Error calculating Retro Multiplier value: " . $e->getMessage(), [
            'employee_id' => $employeeId,
            'attendance_date' => $attendanceDate,
            'trace' => $e->getTraceAsString()
        ]);
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

    /**
 * Get attendance details for a specific payroll summary
 */
public function getPayrollSummaryAttendanceDetails($summaryId)
{
    try {
        // Find the payroll summary
        $summary = PayrollSummary::findOrFail($summaryId);
        
        // Get the processed attendance records that were used to create this summary
        $attendanceRecords = ProcessedAttendance::where('employee_id', $summary->employee_id)
            ->whereBetween('attendance_date', [$summary->period_start, $summary->period_end])
            ->where('posting_status', 'posted')
            ->with(['employee:id,idno,Fname,Lname,Department,Line'])
            ->orderBy('attendance_date', 'asc')
            ->get();
        
        // Transform the data for the frontend
        $transformedRecords = $attendanceRecords->map(function ($record) {
            return [
                'id' => $record->id,
                'employee_id' => $record->employee_id,
                'attendance_date' => $record->attendance_date,
                'day' => $record->day,
                'time_in' => $record->time_in,
                'time_out' => $record->time_out,
                'break_in' => $record->break_in,
                'break_out' => $record->break_out,
                'next_day_timeout' => $record->next_day_timeout,
                'hours_worked' => (float) $record->hours_worked,
                'late_minutes' => (float) $record->late_minutes,
                'undertime_minutes' => (float) $record->undertime_minutes,
                'overtime' => (float) $record->overtime,
                'travel_order' => (float) $record->travel_order,
                'slvl' => (float) $record->slvl,
                'ct' => (bool) $record->ct,
                'cs' => (bool) $record->cs,
                'holiday' => (float) $record->holiday,
                'ot_reg_holiday' => (float) $record->ot_reg_holiday,
                'ot_special_holiday' => (float) $record->ot_special_holiday,
                'restday' => (bool) $record->restday,
                'retromultiplier' => (float) $record->retromultiplier,
                'offset' => (float) $record->offset,
                'ob' => (bool) $record->ob,
                'trip' => (float) $record->trip,
                'is_nightshift' => (bool) $record->is_nightshift,
                'source' => $record->source,
                'posting_status' => $record->posting_status,
                'posted_at' => $record->posted_at,
                'remarks' => $record->remarks,
            ];
        });
        
        return response()->json([
            'success' => true,
            'data' => $transformedRecords,
            'summary' => [
                'employee_name' => $summary->employee_name,
                'employee_no' => $summary->employee_no,
                'department' => $summary->department,
                'period' => $summary->full_period,
                'total_records' => $transformedRecords->count(),
            ]
        ]);
        
    } catch (\Exception $e) {
        Log::error('Error getting payroll summary attendance details: ' . $e->getMessage(), [
            'summary_id' => $summaryId,
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to load attendance details: ' . $e->getMessage()
        ], 500);
    }
}

/**
 * Enhanced getPayrollSummaries method with search functionality
 */
public function getPayrollSummaries(Request $request)
{
    try {
        $year = $request->input('year', now()->year);
        $month = $request->input('month', now()->month);
        $periodType = $request->input('period_type');
        $department = $request->input('department');
        $status = $request->input('status');
        $search = $request->input('search'); // Add search parameter
        $page = $request->input('page', 1);
        $perPage = $request->input('per_page', 25);
        
        // Build the query
        $query = PayrollSummary::query()
            ->with(['employee:id,idno,Fname,Lname,Department,Line', 'postedBy:id,name'])
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
        
        // Apply search filter
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('employee_name', 'LIKE', "%{$search}%")
                  ->orWhere('employee_no', 'LIKE', "%{$search}%")
                  ->orWhere('department', 'LIKE', "%{$search}%")
                  ->orWhere('line', 'LIKE', "%{$search}%");
            });
        }
        
        // Get total count for statistics
        $totalQuery = clone $query;
        $totalCount = $totalQuery->count();
        
        // Apply pagination
        $summaries = $query->orderBy('employee_name', 'asc')
            ->paginate($perPage, ['*'], 'page', $page);
        
        // Calculate statistics
        $statisticsQuery = PayrollSummary::query()
            ->where('year', $year)
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
        if ($search) {
            $statisticsQuery->where(function ($q) use ($search) {
                $q->where('employee_name', 'LIKE', "%{$search}%")
                  ->orWhere('employee_no', 'LIKE', "%{$search}%")
                  ->orWhere('department', 'LIKE', "%{$search}%")
                  ->orWhere('line', 'LIKE', "%{$search}%");
            });
        }
        
        $statistics = $statisticsQuery->selectRaw('
            COUNT(*) as total_summaries,
            SUM(days_worked) as total_days_worked,
            SUM(ot_hours) as total_ot_hours,
            SUM(late_under_minutes) as total_late_under_minutes,
            SUM(nsd_hours) as total_nsd_hours,
            SUM(slvl_days) as total_slvl_days,
            AVG(days_worked) as avg_days_worked,
            AVG(ot_hours) as avg_ot_hours
        ')->first();
        
        // Transform summaries data
        $transformedSummaries = $summaries->getCollection()->map(function ($summary) {
            return [
                'id' => $summary->id,
                'employee_id' => $summary->employee_id,
                'employee_no' => $summary->employee_no,
                'employee_name' => $summary->employee_name,
                'cost_center' => $summary->cost_center,
                'department' => $summary->department,
                'line' => $summary->line,
                'period_start' => $summary->period_start,
                'period_end' => $summary->period_end,
                'period_type' => $summary->period_type,
                'year' => $summary->year,
                'month' => $summary->month,
                'days_worked' => (float) $summary->days_worked,
                'ot_hours' => (float) $summary->ot_hours,
                'off_days' => (float) $summary->off_days,
                'late_under_minutes' => (float) $summary->late_under_minutes,
                'nsd_hours' => (float) $summary->nsd_hours,
                'slvl_days' => (float) $summary->slvl_days,
                'retro' => (float) $summary->retro,
                'travel_order_hours' => (float) $summary->travel_order_hours,
                'holiday_hours' => (float) $summary->holiday_hours,
                'ot_reg_holiday_hours' => (float) $summary->ot_reg_holiday_hours,
                'ot_special_holiday_hours' => (float) $summary->ot_special_holiday_hours,
                'offset_hours' => (float) $summary->offset_hours,
                'trip_count' => (float) $summary->trip_count,
                'has_ct' => (bool) $summary->has_ct,
                'has_cs' => (bool) $summary->has_cs,
                'has_ob' => (bool) $summary->has_ob,
                'status' => $summary->status,
                'posted_by' => $summary->postedBy,
                'posted_at' => $summary->posted_at,
                'notes' => $summary->notes,
                'created_at' => $summary->created_at,
                'updated_at' => $summary->updated_at,
                // Add formatted period for display
                'full_period' => $this->getFullPeriodLabel($summary->year, $summary->month, $summary->period_type),
            ];
        });
        
        return response()->json([
            'success' => true,
            'data' => $transformedSummaries,
            'pagination' => [
                'current_page' => $summaries->currentPage(),
                'last_page' => $summaries->lastPage(),
                'per_page' => $summaries->perPage(),
                'total' => $summaries->total(),
                'from' => $summaries->firstItem(),
                'to' => $summaries->lastItem(),
            ],
            'statistics' => [
                'total_summaries' => $statistics->total_summaries ?: 0,
                'total_days_worked' => (float) ($statistics->total_days_worked ?: 0),
                'total_ot_hours' => (float) ($statistics->total_ot_hours ?: 0),
                'total_late_under_minutes' => (float) ($statistics->total_late_under_minutes ?: 0),
                'total_nsd_hours' => (float) ($statistics->total_nsd_hours ?: 0),
                'total_slvl_days' => (float) ($statistics->total_slvl_days ?: 0),
                'avg_days_worked' => (float) ($statistics->avg_days_worked ?: 0),
                'avg_ot_hours' => (float) ($statistics->avg_ot_hours ?: 0),
            ],
            'filters' => [
                'year' => $year,
                'month' => $month,
                'period_type' => $periodType,
                'department' => $department,
                'status' => $status,
                'search' => $search,
            ]
        ]);
        
    } catch (\Exception $e) {
        Log::error('Error getting payroll summaries: ' . $e->getMessage(), [
            'filters' => $request->all(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to load payroll summaries: ' . $e->getMessage()
        ], 500);
    }
}

/**
 * Helper method to format period label
 */
private function getFullPeriodLabel($year, $month, $periodType)
{
    $monthName = \Carbon\Carbon::create($year, $month, 1)->format('F Y');
    $periodLabel = $periodType === '1st_half' ? '(1-15)' : '(16-30/31)';
    
    return "{$monthName} {$periodLabel}";
}

/**
 * Enhanced exportPayrollSummaries method with search support
 */
public function exportPayrollSummaries(Request $request)
{
    try {
        $year = $request->input('year', now()->year);
        $month = $request->input('month', now()->month);
        $periodType = $request->input('period_type');
        $department = $request->input('department');
        $status = $request->input('status');
        $search = $request->input('search');
        
        // Build the query (same as getPayrollSummaries but without pagination)
        $query = PayrollSummary::query()
            ->with(['employee:id,idno,Fname,Lname,Department,Line', 'postedBy:id,name'])
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
        
        // Apply search filter
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('employee_name', 'LIKE', "%{$search}%")
                  ->orWhere('employee_no', 'LIKE', "%{$search}%")
                  ->orWhere('department', 'LIKE', "%{$search}%")
                  ->orWhere('line', 'LIKE', "%{$search}%");
            });
        }
        
        $summaries = $query->orderBy('cost_center', 'asc')
                          ->orderBy('employee_name', 'asc')
                          ->get();
        
        // Create CSV content array
        $csvData = [];
        
        // Add company header
        $csvData[] = ['ELJIN CORP - BWSUPERBAKESHOP | DAILY TIME RECORDS', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        $csvData[] = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        
        // Add period information
        $periodLabel = $this->getFullPeriodLabel($year, $month, $periodType);
        $csvData[] = ['Period', $periodLabel, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        $csvData[] = ['Year', $year, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        $csvData[] = ['Month', $this->getMonthName($month), '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        $csvData[] = ['Period Type', $periodType, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        $csvData[] = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
        
        // Add header row (without the "Period", "Year", "Month", "Period Type" columns from your original code)
        $csvData[] = [
            'COST CENTER',
            'Employee ID',
            'Employee Name',
            'Department',
            'Line',
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
            'OT Regular Holiday Hours',
            'OT Special Holiday Hours',
            'Offset Hours',
            'Trip Count'
        ];
        
        // Group data by cost center
        $groupedData = $summaries->groupBy('cost_center');
        
        // Initialize grand totals
        $grandTotals = [
            'days_worked' => 0,
            'ot_hours' => 0,
            'off_days' => 0,
            'late_under_minutes' => 0,
            'late_under_hours' => 0,
            'nsd_hours' => 0,
            'slvl_days' => 0,
            'retro' => 0,
            'travel_order_hours' => 0,
            'holiday_hours' => 0,
            'ot_reg_holiday_hours' => 0,
            'ot_special_holiday_hours' => 0,
            'offset_hours' => 0,
            'trip_count' => 0
        ];
        
        // Add data rows grouped by cost center
        foreach ($groupedData as $costCenter => $costCenterSummaries) {
            $isFirstRow = true;
            
            // Initialize subtotals for this cost center
            $subTotals = [
                'days_worked' => 0,
                'ot_hours' => 0,
                'off_days' => 0,
                'late_under_minutes' => 0,
                'late_under_hours' => 0,
                'nsd_hours' => 0,
                'slvl_days' => 0,
                'retro' => 0,
                'travel_order_hours' => 0,
                'holiday_hours' => 0,
                'ot_reg_holiday_hours' => 0,
                'ot_special_holiday_hours' => 0,
                'offset_hours' => 0,
                'trip_count' => 0
            ];
            
            foreach ($costCenterSummaries as $summary) {
                $csvData[] = [
                    $isFirstRow ? ($costCenter ?: '') : '', // Show cost center only on first row
                    $summary->employee_no,
                    $summary->employee_name,
                    $summary->department,
                    $summary->line,
                    $this->formatNumber($summary->days_worked, 0),
                    $this->formatNumber($summary->ot_hours, 0),
                    $this->formatNumber($summary->off_days, 0),
                    $this->formatNumber($summary->late_under_minutes, 0),
                    $this->formatNumber($summary->late_under_minutes / 60, 0),
                    $this->formatNumber($summary->nsd_hours, 2),
                    $this->formatNumber($summary->slvl_days, 0),
                    $this->formatNumber($summary->retro, 0),
                    $this->formatNumber($summary->travel_order_hours, 0),
                    $this->formatNumber($summary->holiday_hours, 0),
                    $this->formatNumber($summary->ot_reg_holiday_hours, 0),
                    $this->formatNumber($summary->ot_special_holiday_hours, 0),
                    $this->formatNumber($summary->offset_hours, 0),
                    $this->formatNumber($summary->trip_count, 0)
                ];
                
                // Add to subtotals
                $subTotals['days_worked'] += $summary->days_worked;
                $subTotals['ot_hours'] += $summary->ot_hours;
                $subTotals['off_days'] += $summary->off_days;
                $subTotals['late_under_minutes'] += $summary->late_under_minutes;
                $subTotals['late_under_hours'] += $summary->late_under_minutes / 60;
                $subTotals['nsd_hours'] += $summary->nsd_hours;
                $subTotals['slvl_days'] += $summary->slvl_days;
                $subTotals['retro'] += $summary->retro;
                $subTotals['travel_order_hours'] += $summary->travel_order_hours;
                $subTotals['holiday_hours'] += $summary->holiday_hours;
                $subTotals['ot_reg_holiday_hours'] += $summary->ot_reg_holiday_hours;
                $subTotals['ot_special_holiday_hours'] += $summary->ot_special_holiday_hours;
                $subTotals['offset_hours'] += $summary->offset_hours;
                $subTotals['trip_count'] += $summary->trip_count;
                
                $isFirstRow = false;
            }
            
            // Add subtotal row for this cost center (only if there are multiple cost centers)
            if ($groupedData->count() > 1) {
                $csvData[] = [
                    'TOTAL',
                    '',
                    '',
                    '',
                    '',
                    $this->formatNumber($subTotals['days_worked'], 0),
                    $this->formatNumber($subTotals['ot_hours'], 0),
                    $this->formatNumber($subTotals['off_days'], 0),
                    $this->formatNumber($subTotals['late_under_minutes'], 0),
                    $this->formatNumber($subTotals['late_under_hours'], 0),
                    $this->formatNumber($subTotals['nsd_hours'], 2),
                    $this->formatNumber($subTotals['slvl_days'], 0),
                    $this->formatNumber($subTotals['retro'], 0),
                    $this->formatNumber($subTotals['travel_order_hours'], 0),
                    $this->formatNumber($subTotals['holiday_hours'], 0),
                    $this->formatNumber($subTotals['ot_reg_holiday_hours'], 0),
                    $this->formatNumber($subTotals['ot_special_holiday_hours'], 0),
                    $this->formatNumber($subTotals['offset_hours'], 0),
                    $this->formatNumber($subTotals['trip_count'], 0)
                ];
            }
            
            // Add to grand totals
            foreach ($subTotals as $key => $value) {
                $grandTotals[$key] += $value;
            }
        }
        
        // Add grand total row
        $csvData[] = [
            'GRAND TOTAL',
            '',
            '',
            '',
            '',
            $this->formatNumber($grandTotals['days_worked'], 0),
            $this->formatNumber($grandTotals['ot_hours'], 0),
            $this->formatNumber($grandTotals['off_days'], 0),
            $this->formatNumber($grandTotals['late_under_minutes'], 0),
            $this->formatNumber($grandTotals['late_under_hours'], 0),
            $this->formatNumber($grandTotals['nsd_hours'], 2),
            $this->formatNumber($grandTotals['slvl_days'], 0),
            $this->formatNumber($grandTotals['retro'], 0),
            $this->formatNumber($grandTotals['travel_order_hours'], 0),
            $this->formatNumber($grandTotals['holiday_hours'], 0),
            $this->formatNumber($grandTotals['ot_reg_holiday_hours'], 0),
            $this->formatNumber($grandTotals['ot_special_holiday_hours'], 0),
            $this->formatNumber($grandTotals['offset_hours'], 0),
            $this->formatNumber($grandTotals['trip_count'], 0)
        ];
        
        // Generate CSV content
        $csvContent = '';
        foreach ($csvData as $row) {
            // Handle empty values properly - don't quote empty strings
            $processedRow = array_map(function($cell) {
                return $cell === '' ? '' : $cell;
            }, $row);
            
            $csvContent .= implode(',', array_map(function($cell) {
                // Only quote cells that contain commas, quotes, or newlines
                if ($cell === '' || (!str_contains($cell, ',') && !str_contains($cell, '"') && !str_contains($cell, "\n"))) {
                    return $cell;
                }
                return '"' . str_replace('"', '""', $cell) . '"';
            }, $processedRow)) . "\r\n";
        }
        
        // Generate filename
        $filename = 'payroll_summaries_' . $year . '_' . $month;
        if ($periodType) {
            $filename .= '_' . $periodType;
        }
        if ($department) {
            $filename .= '_' . str_replace(' ', '_', strtolower($department));
        }
        if ($search) {
            $filename .= '_search_' . str_replace(' ', '_', strtolower($search));
        }
        $filename .= '_' . now()->format('Ymd') . '.csv';
        
        return response($csvContent)
            ->header('Content-Type', 'text/csv; charset=utf-8')
            ->header('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
            ->header('Pragma', 'no-cache')
            ->header('Expires', '0');
            
    } catch (\Exception $e) {
        Log::error('Error exporting payroll summaries: ' . $e->getMessage(), [
            'filters' => $request->all(),
            'trace' => $e->getTraceAsString()
        ]);
        
        return response()->json([
            'success' => false,
            'message' => 'Failed to export payroll summaries: ' . $e->getMessage()
        ], 500);
    }
}

/**
 * Helper method to format numbers consistently
 */
private function formatNumber($value, $decimals = 0)
{
    if ($value == 0) {
        return $decimals > 0 ? '0' : '0';
    }
    return number_format($value, $decimals, '.', '');
}

/**
 * Helper method to get month name
 */
private function getMonthName($month)
{
    $months = [
        1 => 'January', 2 => 'February', 3 => 'March', 4 => 'April',
        5 => 'May', 6 => 'June', 7 => 'July', 8 => 'August',
        9 => 'September', 10 => 'October', 11 => 'November', 12 => 'December'
    ];
    
    return $months[$month] ?? 'Unknown';
}

public function detectDtrProblems(Request $request)
{
    try {
        $validator = Validator::make($request->all(), [
            'date' => 'nullable|date',
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

        // Build query for attendance records - FIXED: Ensure employee relationship is loaded
        $query = $this->buildAttendanceQuery($request);
        
        // IMPORTANT: Eager load employee relationship with specific fields we need
        $attendances = $query->with(['employee:id,idno,Fname,Lname,Department,Line'])
                            ->get();

        $problemRecords = [];
        $problemSummary = [
            'total_records' => $attendances->count(),
            'problem_records' => 0,
            'problems' => [
                'missing_time_in' => 0,
                'missing_time_out' => 0,
                'missing_break_times' => 0,
                'excessive_hours' => 0,
                'negative_hours' => 0,
                'late_no_timeout' => 0,
                'invalid_break_sequence' => 0,
                'night_shift_issues' => 0,
                'weekend_attendance' => 0,
                'duplicate_entries' => 0
            ]
        ];

        // Group by employee and date to detect duplicates
        $groupedRecords = $attendances->groupBy(function($item) {
            return $item->employee_id . '_' . $item->attendance_date->format('Y-m-d');
        });

        foreach ($groupedRecords as $key => $records) {
            foreach ($records as $attendance) {
                $problems = $this->detectRecordProblems($attendance, $records->count() > 1);
                
                if (!empty($problems)) {
                    // FIXED: Properly extract employee information
                    $employee = $attendance->employee;
                    $employeeName = 'Unknown';
                    $employeeNo = 'N/A';
                    $department = 'N/A';
                    
                    if ($employee) {
                        $employeeName = trim(($employee->Fname ?? '') . ' ' . ($employee->Lname ?? ''));
                        $employeeNo = $employee->idno ?? 'N/A';
                        $department = $employee->Department ?? 'N/A';
                    }
                    
                    $problemRecords[] = [
                        'id' => $attendance->id,
                        'employee_id' => $attendance->employee_id,
                        'employee_name' => $employeeName,
                        'employee_no' => $employeeNo,
                        'department' => $department,
                        'attendance_date' => $attendance->attendance_date->format('Y-m-d'),
                        'problems' => $problems,
                        'severity' => $this->calculateProblemSeverity($problems),
                        'time_in' => $attendance->time_in ? $attendance->time_in->format('H:i') : null,
                        'time_out' => $attendance->time_out ? $attendance->time_out->format('H:i') : null,
                        'hours_worked' => $attendance->hours_worked,
                        'is_nightshift' => $attendance->is_nightshift
                    ];
                    
                    $problemSummary['problem_records']++;
                    
                    // Count specific problems
                    foreach ($problems as $problem) {
                        $problemType = $problem['type'];
                        if (isset($problemSummary['problems'][$problemType])) {
                            $problemSummary['problems'][$problemType]++;
                        }
                    }
                }
            }
        }

        // Sort by severity (high to low)
        usort($problemRecords, function($a, $b) {
            $severityOrder = ['high' => 3, 'medium' => 2, 'low' => 1];
            return ($severityOrder[$b['severity']] ?? 0) - ($severityOrder[$a['severity']] ?? 0);
        });

        Log::info("DTR problem detection completed", [
            'total_records' => $problemSummary['total_records'],
            'problem_records' => $problemSummary['problem_records'],
            'problems_breakdown' => $problemSummary['problems']
        ]);

        return response()->json([
            'success' => true,
            'data' => $problemRecords,
            'summary' => $problemSummary,
            'message' => "Found {$problemSummary['problem_records']} records with DTR problems out of {$problemSummary['total_records']} total records"
        ]);

    } catch (\Exception $e) {
        Log::error('Error detecting DTR problems: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'Failed to detect DTR problems: ' . $e->getMessage()
        ], 500);
    }
}


/**
 * Detect specific problems for a single attendance record
 */
private function detectRecordProblems($attendance, $isDuplicate = false)
{
    $problems = [];

    // Check for duplicate entries
    if ($isDuplicate) {
        $problems[] = [
            'type' => 'duplicate_entries',
            'message' => 'Multiple attendance records found for the same date',
            'severity' => 'high'
        ];
    }

    // UPDATED LOGIC: If both time_in and time_out are missing, consider it as good (no problem)
    // This typically indicates a day off, sick leave, or absence
    $hasTimeIn = !empty($attendance->time_in);
    $hasTimeOut = !empty($attendance->time_out) || ($attendance->is_nightshift && !empty($attendance->next_day_timeout));
    
    // Only flag as problem if one is missing but not both
    if (!$hasTimeIn && $hasTimeOut) {
        $problems[] = [
            'type' => 'missing_time_in',
            'message' => 'Time In is missing but Time Out is present',
            'severity' => 'high'
        ];
    }

    if ($hasTimeIn && !$hasTimeOut) {
        $problems[] = [
            'type' => 'missing_time_out',
            'message' => 'Time Out is missing but Time In is present',
            'severity' => 'high'
        ];
    }

    // Only check other validations if there's at least some time data
    // Skip additional checks if both time_in and time_out are missing (day off scenario)
    if (!$hasTimeIn && !$hasTimeOut) {
        // This is considered a good record (day off, absence, etc.)
        return $problems; // Return early with only duplicate check if applicable
    }

    // Check for missing break times (if one is present, both should be)
    if (($attendance->break_in && !$attendance->break_out) || (!$attendance->break_in && $attendance->break_out)) {
        $problems[] = [
            'type' => 'missing_break_times',
            'message' => 'Incomplete break time (missing break in or break out)',
            'severity' => 'medium'
        ];
    }

    // Check for invalid break sequence
    if ($attendance->break_in && $attendance->break_out) {
        try {
            $breakIn = \Carbon\Carbon::parse($attendance->break_in);
            $breakOut = \Carbon\Carbon::parse($attendance->break_out);
            
            if ($breakIn->lte($breakOut)) {
                $problems[] = [
                    'type' => 'invalid_break_sequence',
                    'message' => 'Break In time should be after Break Out time',
                    'severity' => 'medium'
                ];
            }
        } catch (\Exception $e) {
            $problems[] = [
                'type' => 'invalid_break_sequence',
                'message' => 'Invalid break time format',
                'severity' => 'medium'
            ];
        }
    }

    // Check for excessive hours (more than 16 hours)
    if ($attendance->hours_worked && $attendance->hours_worked > 16) {
        $problems[] = [
            'type' => 'excessive_hours',
            'message' => "Excessive work hours: {$attendance->hours_worked} hours",
            'severity' => 'high'
        ];
    }

    // Check for negative hours
    if ($attendance->hours_worked && $attendance->hours_worked < 0) {
        $problems[] = [
            'type' => 'negative_hours',
            'message' => "Negative work hours: {$attendance->hours_worked} hours",
            'severity' => 'high'
        ];
    }

    // Check for late with no time out (suspicious) - only if time_in exists
    if ($hasTimeIn && $attendance->late_minutes > 0 && !$hasTimeOut) {
        $problems[] = [
            'type' => 'late_no_timeout',
            'message' => 'Employee is late but has no time out',
            'severity' => 'medium'
        ];
    }

    // Check for night shift issues
    if ($attendance->is_nightshift && $hasTimeIn) {
        if (!$attendance->next_day_timeout) {
            $problems[] = [
                'type' => 'night_shift_issues',
                'message' => 'Night shift record missing next day timeout',
                'severity' => 'medium'
            ];
        }
    }

    // Check for weekend attendance (might be unusual) - only if there's actual attendance
    if ($attendance->attendance_date && ($hasTimeIn || $hasTimeOut)) {
        $dayOfWeek = $attendance->attendance_date->dayOfWeek;
        if ($dayOfWeek == 0 || $dayOfWeek == 6) { // Sunday = 0, Saturday = 6
            if (!$attendance->restday && !$attendance->overtime) {
                $problems[] = [
                    'type' => 'weekend_attendance',
                    'message' => 'Attendance on weekend without overtime or rest day marker',
                    'severity' => 'low'
                ];
            }
        }
    }

    return $problems;
}

/**
 * Calculate overall problem severity for a record
 */
private function calculateProblemSeverity($problems)
{
    $hasHigh = false;
    $hasMedium = false;
    
    foreach ($problems as $problem) {
        if ($problem['severity'] === 'high') {
            $hasHigh = true;
        } elseif ($problem['severity'] === 'medium') {
            $hasMedium = true;
        }
    }
    
    if ($hasHigh) return 'high';
    if ($hasMedium) return 'medium';
    return 'low';
}
}