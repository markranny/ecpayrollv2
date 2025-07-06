<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class ProcessedAttendance extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'employee_id',
        'attendance_date',
        'day',
        'time_in',
        'time_out',
        'break_in',
        'break_out',
        'next_day_timeout',
        'hours_worked',
        'late_minutes',
        'undertime_minutes',
        'overtime',
        'travel_order',
        'slvl',
        'ct',
        'cs',
        'holiday',
        'ot_reg_holiday',
        'ot_special_holiday',
        'retromultiplier',
        'restday',
        'offset',
        'ob',
        'status',
        'source',
        'remarks',
        'is_nightshift',
        'is_night_shift_display',
        'posting_status',
        'posted_at',
        'posted_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'attendance_date' => 'date',
        'time_in' => 'datetime',
        'time_out' => 'datetime',
        'break_in' => 'datetime',
        'break_out' => 'datetime',
        'next_day_timeout' => 'datetime',
        'hours_worked' => 'float',
        'late_minutes' => 'decimal:2',
        'undertime_minutes' => 'decimal:2',
        'overtime' => 'decimal:2',
        'travel_order' => 'decimal:2',
        'slvl' => 'decimal:1',
        'ct' => 'boolean',
        'cs' => 'boolean',
        'holiday' => 'decimal:2',
        'ot_reg_holiday' => 'decimal:2',
        'ot_special_holiday' => 'decimal:2',
        'retromultiplier' => 'decimal:2',
        'restday' => 'boolean',
        'offset' => 'decimal:2',
        'ob' => 'boolean',
        'is_nightshift' => 'boolean',
        'is_night_shift_display' => 'boolean',
        'posted_at' => 'datetime',
    ];

    /**
     * Get the employee associated with this attendance record.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Get the user who posted this record.
     */
    public function postedBy()
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    /**
     * Calculate late minutes based on expected time in (8:00 AM with 5-minute grace period)
     */
    public function calculateLateMinutes($expectedTimeIn = '08:00', $gracePeriodMinutes = 0)
    {
        if (!$this->time_in) {
            return 0;
        }

        try {
            // Parse expected time in (8:00 AM sharp)
            $attendanceDate = Carbon::parse($this->attendance_date);
            $expected = $attendanceDate->copy()->setTime(8, 0, 0); // 8:00 AM exactly
            $actual = Carbon::parse($this->time_in);

            // FIXED: If actual time is after expected time, calculate late minutes
            if ($actual->gt($expected)) {
                $lateMinutes = $actual->diffInMinutes($expected);
                \Log::info("Late calculation", [
                    'employee_id' => $this->employee_id,
                    'expected' => $expected->format('H:i:s'),
                    'actual' => $actual->format('H:i:s'),
                    'late_minutes' => $lateMinutes
                ]);
                return $lateMinutes;
            }

            return 0;
        } catch (\Exception $e) {
            \Log::error('Error calculating late minutes: ' . $e->getMessage(), [
                'attendance_id' => $this->id,
                'time_in' => $this->time_in
            ]);
            return 0;
        }
    }

    /**
     * FIXED: Calculate undertime minutes based on standard 8-hour workday
     */
    public function calculateUndertimeMinutes($standardWorkingHours = 8)
    {
        // For night shifts, use next_day_timeout if available
        $timeOut = $this->is_nightshift && $this->next_day_timeout 
            ? $this->next_day_timeout 
            : $this->time_out;

        if (!$timeOut || !$this->time_in) {
            return 0;
        }

        try {
            $timeIn = Carbon::parse($this->time_in);
            $timeOut = Carbon::parse($timeOut);
            
            // Handle next day scenarios for night shifts
            if ($this->is_nightshift && $timeOut->lt($timeIn)) {
                $timeOut->addDay();
            }
            
            // Calculate total worked minutes
            $totalWorkedMinutes = $timeOut->diffInMinutes($timeIn);
            
            // Subtract break time
            $breakMinutes = 60; // Default 1-hour break
            if ($this->break_out && $this->break_in) {
                $breakOut = Carbon::parse($this->break_out);
                $breakIn = Carbon::parse($this->break_in);
                
                // Handle same day break times
                if ($breakIn->gt($breakOut)) {
                    $breakMinutes = $breakIn->diffInMinutes($breakOut);
                }
            }
            
            $netWorkedMinutes = max(0, $totalWorkedMinutes - $breakMinutes);
            $standardWorkMinutes = $standardWorkingHours * 60; // Convert hours to minutes
            
            // FIXED: Calculate undertime if worked less than standard
            if ($netWorkedMinutes < $standardWorkMinutes) {
                $undertimeMinutes = $standardWorkMinutes - $netWorkedMinutes;
                \Log::info("Undertime calculation", [
                    'employee_id' => $this->employee_id,
                    'net_worked_minutes' => $netWorkedMinutes,
                    'standard_work_minutes' => $standardWorkMinutes,
                    'undertime_minutes' => $undertimeMinutes
                ]);
                return $undertimeMinutes;
            }

            return 0;
        } catch (\Exception $e) {
            \Log::error('Error calculating undertime minutes: ' . $e->getMessage(), [
                'attendance_id' => $this->id,
                'time_in' => $this->time_in,
                'time_out' => $timeOut
            ]);
            return 0;
        }
    }

    /**
     * FIXED: Calculate hours worked correctly
     */
    public function calculateHoursWorked()
    {
        if (!$this->time_in) {
            return 0;
        }

        // For night shifts, use next_day_timeout if available
        $timeOut = $this->is_nightshift && $this->next_day_timeout 
            ? $this->next_day_timeout 
            : $this->time_out;

        if (!$timeOut) {
            return 0;
        }

        try {
            $timeIn = Carbon::parse($this->time_in);
            $timeOut = Carbon::parse($timeOut);
            
            // Handle next day scenarios for night shifts
            if ($this->is_nightshift && $timeOut->lt($timeIn)) {
                $timeOut->addDay();
            }
            
            // Calculate total worked minutes
            $totalWorkedMinutes = $timeOut->diffInMinutes($timeIn);
            
            // Subtract break time
            $breakMinutes = 60; // Default 1-hour break
            if ($this->break_out && $this->break_in) {
                $breakOut = Carbon::parse($this->break_out);
                $breakIn = Carbon::parse($this->break_in);
                
                if ($breakIn->gt($breakOut)) {
                    $breakMinutes = $breakIn->diffInMinutes($breakOut);
                }
            }
            
            $netWorkedMinutes = max(0, $totalWorkedMinutes - $breakMinutes);
            $hoursWorked = round($netWorkedMinutes / 60, 2);
            
            \Log::info("Hours worked calculation", [
                'employee_id' => $this->employee_id,
                'total_worked_minutes' => $totalWorkedMinutes,
                'break_minutes' => $breakMinutes,
                'net_worked_minutes' => $netWorkedMinutes,
                'hours_worked' => $hoursWorked
            ]);
            
            return $hoursWorked;
        } catch (\Exception $e) {
            \Log::error('Error calculating hours worked: ' . $e->getMessage(), [
                'attendance_id' => $this->id,
                'time_in' => $this->time_in,
                'time_out' => $timeOut
            ]);
            return 0;
        }
    }

    /**
     * FIXED: Auto-calculate late, undertime, and hours when model is saved
     */
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($attendance) {
            // Only auto-calculate if time_in exists
            if ($attendance->time_in) {
                // FIXED: Calculate late minutes (NO grace period)
                $calculatedLateMinutes = $attendance->calculateLateMinutes();
                
                // FIXED: Calculate undertime minutes
                $calculatedUndertimeMinutes = $attendance->calculateUndertimeMinutes();
                
                // FIXED: Calculate hours worked
                $calculatedHoursWorked = $attendance->calculateHoursWorked();
                
                // Always update the values to ensure sync
                $attendance->late_minutes = $calculatedLateMinutes;
                $attendance->undertime_minutes = $calculatedUndertimeMinutes;
                $attendance->hours_worked = $calculatedHoursWorked;
                
                \Log::info('Auto-calculated attendance metrics', [
                    'id' => $attendance->id ?? 'new',
                    'employee_id' => $attendance->employee_id,
                    'time_in' => $attendance->time_in,
                    'time_out' => $attendance->time_out,
                    'late_minutes' => $attendance->late_minutes,
                    'undertime_minutes' => $attendance->undertime_minutes,
                    'hours_worked' => $attendance->hours_worked
                ]);
            }
            
            // Set night shift display flag
            $attendance->is_night_shift_display = $attendance->is_nightshift;
        });

        static::updating(function ($attendance) {
            // Force recalculation on update if times have changed
            if ($attendance->isDirty(['time_in', 'time_out', 'break_in', 'break_out', 'next_day_timeout', 'is_nightshift'])) {
                \Log::info('Time fields changed, forcing recalculation', [
                    'id' => $attendance->id,
                    'dirty_fields' => array_keys($attendance->getDirty())
                ]);
                
                // Force recalculation
                $attendance->late_minutes = $attendance->calculateLateMinutes();
                $attendance->undertime_minutes = $attendance->calculateUndertimeMinutes();
                $attendance->hours_worked = $attendance->calculateHoursWorked();
            }
        });
    }

    /**
     * Scope for posted records
     */
    public function scopePosted($query)
    {
        return $query->where('posting_status', 'posted');
    }

    /**
     * Scope for not posted records
     */
    public function scopeNotPosted($query)
    {
        return $query->where('posting_status', 'not_posted');
    }

    /**
     * Check if record is posted
     */
    public function isPosted()
    {
        return $this->posting_status === 'posted';
    }

    /**
     * Mark record as posted
     */
    public function markAsPosted($userId = null)
    {
        $this->posting_status = 'posted';
        $this->posted_at = now();
        $this->posted_by = $userId ?? auth()->id();
        $this->save();
    }

    /**
     * Mark record as not posted
     */
    public function markAsNotPosted()
    {
        $this->posting_status = 'not_posted';
        $this->posted_at = null;
        $this->posted_by = null;
        $this->save();
    }

    /**
     * Get late/undertime summary for display
     */
    public function getLateUndertimeSummary()
    {
        $summary = [];
        
        if ($this->late_minutes > 0) {
            $hours = floor($this->late_minutes / 60);
            $minutes = $this->late_minutes % 60;
            $summary[] = $hours > 0 
                ? sprintf('%dh %dm late', $hours, $minutes)
                : sprintf('%dm late', $minutes);
        }
        
        if ($this->undertime_minutes > 0) {
            $hours = floor($this->undertime_minutes / 60);
            $minutes = $this->undertime_minutes % 60;
            $summary[] = $hours > 0 
                ? sprintf('%dh %dm under', $hours, $minutes)
                : sprintf('%dm under', $minutes);
        }
        
        return empty($summary) ? 'On time' : implode(', ', $summary);
    }

    /**
     * Get posting status label
     */
    public function getPostingStatusLabel()
    {
        return $this->posting_status === 'posted' ? 'Posted' : 'Not Posted';
    }

    /**
     * Get human-readable time format
     */
    public function getFormattedTimeIn()
    {
        return $this->time_in ? $this->time_in->format('h:i A') : null;
    }

    /**
     * Get human-readable time format
     */
    public function getFormattedTimeOut()
    {
        $timeOut = $this->is_nightshift && $this->next_day_timeout 
            ? $this->next_day_timeout 
            : $this->time_out;
            
        return $timeOut ? $timeOut->format('h:i A') : null;
    }

    /**
     * Get human-readable break out time format
     */
    public function getFormattedBreakOut()
    {
        return $this->break_out ? $this->break_out->format('h:i A') : null;
    }

    /**
     * Get human-readable break in time format
     */
    public function getFormattedBreakIn()
    {
        return $this->break_in ? $this->break_in->format('h:i A') : null;
    }

    /**
     * Check if attendance is complete (has both time in and time out)
     */
    public function isComplete()
    {
        if (!$this->time_in) {
            return false;
        }
        
        if ($this->is_nightshift) {
            return $this->next_day_timeout || $this->time_out;
        }
        
        return $this->time_out;
    }

    /**
     * Get total worked hours (calculated property)
     */
    public function getTotalWorkedHours()
    {
        if (!$this->isComplete()) {
            return 0;
        }

        try {
            $timeIn = Carbon::parse($this->time_in);
            $timeOut = $this->is_nightshift && $this->next_day_timeout 
                ? Carbon::parse($this->next_day_timeout)
                : Carbon::parse($this->time_out);
            
            // Calculate total minutes
            $totalMinutes = $timeOut->diffInMinutes($timeIn);
            
            // Subtract break time
            if ($this->break_out && $this->break_in) {
                $breakOut = Carbon::parse($this->break_out);
                $breakIn = Carbon::parse($this->break_in);
                if ($breakIn->gt($breakOut)) {
                    $breakMinutes = $breakIn->diffInMinutes($breakOut);
                    $totalMinutes -= $breakMinutes;
                }
            } else {
                // Default 1-hour break
                $totalMinutes -= 60;
            }
            
            return round($totalMinutes / 60, 2);
        } catch (\Exception $e) {
            \Log::error('Error calculating total worked hours: ' . $e->getMessage());
            return 0;
        }
    }

    /**
     * Check if employee was late
     */
    public function isLate()
    {
        return $this->late_minutes > 0;
    }

    /**
     * Check if employee has undertime
     */
    public function hasUndertime()
    {
        return $this->undertime_minutes > 0;
    }

    /**
     * Get the effective timeout (considers night shift)
     */
    public function getEffectiveTimeOut()
    {
        return $this->is_nightshift && $this->next_day_timeout 
            ? $this->next_day_timeout 
            : $this->time_out;
    }

    /**
     * Check if this is a manual edit
     */
    public function isManualEdit()
    {
        return $this->source === 'manual_edit';
    }

    /**
     * Check if this came from SLVL sync
     */
    public function isFromSLVL()
    {
        return $this->source === 'slvl_sync';
    }

    /**
     * Get status badge color class
     */
    public function getStatusBadgeClass()
    {
        switch ($this->source) {
            case 'manual_edit':
                return 'bg-red-100 text-red-800';
            case 'slvl_sync':
                return 'bg-indigo-100 text-indigo-800';
            case 'import':
                return 'bg-blue-100 text-blue-800';
            case 'biometric':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    /**
     * Get posting status badge class
     */
    public function getPostingStatusBadgeClass()
    {
        return $this->posting_status === 'posted' 
            ? 'bg-green-100 text-green-800'
            : 'bg-yellow-100 text-yellow-800';
    }

    /**
     * Force recalculate all attendance metrics
     */
    public function recalculateMetrics()
    {
        if ($this->time_in) {
            $this->late_minutes = $this->calculateLateMinutes();
            $this->undertime_minutes = $this->calculateUndertimeMinutes();
            $this->hours_worked = $this->calculateHoursWorked();
            
            \Log::info('Force recalculated attendance metrics', [
                'id' => $this->id,
                'employee_id' => $this->employee_id,
                'late_minutes' => $this->late_minutes,
                'undertime_minutes' => $this->undertime_minutes,
                'hours_worked' => $this->hours_worked
            ]);
        }
        
        return $this;
    }
}