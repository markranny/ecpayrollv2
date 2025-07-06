<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\ProcessedAttendance;
use Carbon\Carbon;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Recalculate late_minutes and undertime_minutes for all existing records
        ProcessedAttendance::whereNotNull('time_in')->chunk(100, function ($attendances) {
            foreach ($attendances as $attendance) {
                try {
                    // Calculate late minutes (no grace period)
                    $lateMinutes = 0;
                    if ($attendance->time_in) {
                        $attendanceDate = Carbon::parse($attendance->attendance_date);
                        $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0); // 8:00 AM
                        $actualTimeIn = Carbon::parse($attendance->time_in);
                        
                        if ($actualTimeIn->gt($expectedTimeIn)) {
                            $lateMinutes = $actualTimeIn->diffInMinutes($expectedTimeIn);
                        }
                    }
                    
                    // Calculate undertime minutes
                    $undertimeMinutes = 0;
                    $timeOut = $attendance->is_nightshift && $attendance->next_day_timeout 
                        ? $attendance->next_day_timeout 
                        : $attendance->time_out;
                    
                    if ($attendance->time_in && $timeOut) {
                        $timeIn = Carbon::parse($attendance->time_in);
                        $timeOut = Carbon::parse($timeOut);
                        
                        // Calculate total worked minutes
                        $totalWorkedMinutes = $timeOut->diffInMinutes($timeIn);
                        
                        // Subtract break time
                        $breakMinutes = 60; // Default 1-hour break
                        if ($attendance->break_out && $attendance->break_in) {
                            $breakOut = Carbon::parse($attendance->break_out);
                            $breakIn = Carbon::parse($attendance->break_in);
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
                    
                    // Calculate hours worked
                    $hoursWorked = 0;
                    if ($attendance->time_in && $timeOut) {
                        $timeIn = Carbon::parse($attendance->time_in);
                        $timeOut = Carbon::parse($timeOut);
                        
                        $totalWorkedMinutes = $timeOut->diffInMinutes($timeIn);
                        
                        // Subtract break time
                        $breakMinutes = 60;
                        if ($attendance->break_out && $attendance->break_in) {
                            $breakOut = Carbon::parse($attendance->break_out);
                            $breakIn = Carbon::parse($attendance->break_in);
                            if ($breakIn->gt($breakOut)) {
                                $breakMinutes = $breakIn->diffInMinutes($breakOut);
                            }
                        }
                        
                        $netWorkedMinutes = max(0, $totalWorkedMinutes - $breakMinutes);
                        $hoursWorked = round($netWorkedMinutes / 60, 2);
                    }
                    
                    // Update the record without triggering model events to avoid infinite loops
                    \DB::table('processed_attendances')
                        ->where('id', $attendance->id)
                        ->update([
                            'late_minutes' => $lateMinutes,
                            'undertime_minutes' => $undertimeMinutes,
                            'hours_worked' => $hoursWorked,
                            'updated_at' => now()
                        ]);
                        
                    \Log::info("Recalculated metrics for attendance ID {$attendance->id}", [
                        'employee_id' => $attendance->employee_id,
                        'date' => $attendance->attendance_date,
                        'late_minutes' => $lateMinutes,
                        'undertime_minutes' => $undertimeMinutes,
                        'hours_worked' => $hoursWorked
                    ]);
                    
                } catch (\Exception $e) {
                    \Log::error("Error recalculating metrics for attendance ID {$attendance->id}: " . $e->getMessage());
                }
            }
        });
        
        \Log::info('Attendance metrics recalculation completed');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reset all late_minutes and undertime_minutes to 0
        \DB::table('processed_attendances')->update([
            'late_minutes' => 0,
            'undertime_minutes' => 0
        ]);
    }
};