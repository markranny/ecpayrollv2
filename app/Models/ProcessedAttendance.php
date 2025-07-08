<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class ProcessedAttendance extends Model
{
    use HasFactory;

    protected $table = 'processed_attendances';

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
        'restday',
        'retromultiplier',
        'offset',
        'ob',
        'trip',
        'is_nightshift',
        'status',
        'source',
        'remarks',
        'posting_status',
        'posted_at',
        'posted_by',
    ];

    protected $casts = [
        'attendance_date' => 'date',
        'time_in' => 'datetime',
        'time_out' => 'datetime',
        'break_in' => 'datetime',
        'break_out' => 'datetime',
        'next_day_timeout' => 'datetime',
        'hours_worked' => 'decimal:2',
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
        'restday' => 'boolean',
        'retromultiplier' => 'decimal:2',
        'offset' => 'decimal:2',
        'ob' => 'boolean',
        'trip' => 'decimal:2',
        'is_nightshift' => 'boolean',
        'posted_at' => 'datetime',
    ];

    /**
     * Get the employee that owns the attendance record.
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
     * Scope for posted records.
     */
    public function scopePosted($query)
    {
        return $query->where('posting_status', 'posted');
    }

    /**
     * Scope for non-posted records.
     */
    public function scopeNotPosted($query)
    {
        return $query->where('posting_status', 'not_posted');
    }

    /**
     * Scope for night shift records.
     */
    public function scopeNightShift($query)
    {
        return $query->where('is_nightshift', true);
    }

    /**
     * Scope for manual edits.
     */
    public function scopeManualEdits($query)
    {
        return $query->where('source', 'manual_edit');
    }

    /**
     * Check if record is posted.
     */
    public function isPosted()
    {
        return $this->posting_status === 'posted';
    }

    /**
     * Check if record is manually edited.
     */
    public function isManuallyEdited()
    {
        return $this->source === 'manual_edit';
    }

    /**
     * Get formatted attendance date.
     */
    public function getFormattedDateAttribute()
    {
        return $this->attendance_date ? $this->attendance_date->format('Y-m-d') : null;
    }

    /**
     * Get total late and undertime in minutes.
     */
    public function getTotalLateUndertimeMinutesAttribute()
    {
        return ($this->late_minutes ?? 0) + ($this->undertime_minutes ?? 0);
    }

    /**
     * Get late and undertime in hours.
     */
    public function getLateUndertimeHoursAttribute()
    {
        return round($this->total_late_undertime_minutes / 60, 2);
    }

    /**
     * Calculate hours worked from time in/out with break deduction.
     */
    public function calculateHoursWorked()
    {
        if (!$this->time_in) {
            return 0;
        }

        $timeOut = null;
        
        // Use next_day_timeout for night shifts, otherwise use time_out
        if ($this->is_nightshift && $this->next_day_timeout) {
            $timeOut = $this->next_day_timeout;
        } elseif ($this->time_out) {
            $timeOut = $this->time_out;
        }

        if (!$timeOut) {
            return 0;
        }

        $timeIn = Carbon::parse($this->time_in);
        $timeOut = Carbon::parse($timeOut);

        // Handle next day scenarios for night shifts
        if ($this->is_nightshift && $timeOut->lt($timeIn)) {
            $timeOut->addDay();
        }

        // Calculate total minutes worked
        $totalMinutes = $timeOut->diffInMinutes($timeIn);

        // Subtract break time if available
        $breakMinutes = 0;
        if ($this->break_out && $this->break_in) {
            $breakOut = Carbon::parse($this->break_out);
            $breakIn = Carbon::parse($this->break_in);
            
            if ($breakIn->gt($breakOut)) {
                $breakMinutes = $breakIn->diffInMinutes($breakOut);
            }
        } else {
            // Default 1-hour break if no break times recorded
            $breakMinutes = 60;
        }

        $netMinutes = max(0, $totalMinutes - $breakMinutes);
        
        return round($netMinutes / 60, 2);
    }

    /**
     * Calculate late minutes based on expected time in.
     */
    public function calculateLateMinutes($expectedTimeIn = '08:00:00')
    {
        if (!$this->time_in || !$this->attendance_date) {
            return 0;
        }

        $attendanceDate = Carbon::parse($this->attendance_date);
        $expectedTime = $attendanceDate->copy()->setTimeFromTimeString($expectedTimeIn);
        $actualTimeIn = Carbon::parse($this->time_in);

        if ($actualTimeIn->gt($expectedTime)) {
            return $actualTimeIn->diffInMinutes($expectedTime);
        }

        return 0;
    }

    /**
     * Calculate undertime minutes based on standard work hours.
     */
    public function calculateUndertimeMinutes($standardWorkHours = 8)
    {
        if (!$this->hours_worked) {
            return 0;
        }

        $standardMinutes = $standardWorkHours * 60;
        $workedMinutes = $this->hours_worked * 60;

        if ($workedMinutes < $standardMinutes) {
            return $standardMinutes - $workedMinutes;
        }

        return 0;
    }

    /**
     * Auto-calculate and save metrics.
     */
    public function recalculateMetrics()
    {
        $this->hours_worked = $this->calculateHoursWorked();
        $this->late_minutes = $this->calculateLateMinutes();
        $this->undertime_minutes = $this->calculateUndertimeMinutes();
        
        return $this->save();
    }

    /**
     * Scope for filtering by date range.
     */
    public function scopeWhereDateBetween($query, $startDate, $endDate)
    {
        return $query->whereBetween('attendance_date', [$startDate, $endDate]);
    }

    /**
     * Scope for filtering by employee.
     */
    public function scopeWhereEmployee($query, $employeeId)
    {
        return $query->where('employee_id', $employeeId);
    }

    /**
     * Scope for filtering by department through employee relationship.
     */
    public function scopeWhereDepartment($query, $department)
    {
        return $query->whereHas('employee', function ($q) use ($department) {
            $q->where('Department', $department);
        });
    }
}