<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Now populate the late_minutes and undertime_minutes data
        $attendances = DB::table('processed_attendances')
            ->whereNotNull('time_in')
            ->get();

        $totalFixed = 0;

        foreach ($attendances as $attendance) {
            try {
                // FIXED: Calculate late minutes (NO grace period - 8:00 AM sharp)
                $lateMinutes = 0;
                if ($attendance->time_in) {
                    $attendanceDate = Carbon::parse($attendance->attendance_date);
                    $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0); // 8:00 AM exactly
                    $actualTimeIn = Carbon::parse($attendance->time_in);
                    
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
                    $timeIn = Carbon::parse($attendance->time_in);
                    $timeOut = Carbon::parse($timeOut);
                    
                    // Handle next day scenarios for night shifts
                    if ($attendance->is_nightshift && $timeOut->lt($timeIn)) {
                        $timeOut->addDay();
                    }
                    
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
                
                // FIXED: Calculate hours worked
                $hoursWorked = 0;
                if ($attendance->time_in && $timeOut) {
                    $timeIn = Carbon::parse($attendance->time_in);
                    $timeOut = Carbon::parse($timeOut);
                    
                    // Handle next day scenarios for night shifts
                    if ($attendance->is_nightshift && $timeOut->lt($timeIn)) {
                        $timeOut->addDay();
                    }
                    
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
                
                // Update the record
                DB::table('processed_attendances')
                    ->where('id', $attendance->id)
                    ->update([
                        'late_minutes' => $lateMinutes,
                        'undertime_minutes' => $undertimeMinutes,
                        'hours_worked' => $hoursWorked,
                        'is_night_shift_display' => $attendance->is_nightshift ?? false,
                        'updated_at' => now()
                    ]);
                
                $totalFixed++;
                
            } catch (\Exception $e) {
                \Log::error("Error calculating for attendance ID {$attendance->id}: " . $e->getMessage());
            }
        }
        
        \Log::info("Populated late/undertime data for {$totalFixed} records");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reset all late_minutes and undertime_minutes to 0
        DB::table('processed_attendances')->update([
            'late_minutes' => 0,
            'undertime_minutes' => 0,
            'is_night_shift_display' => false
        ]);
    }
};