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
     * Calculate late minutes based on expected time in
     * You can customize this logic based on your business rules
     */
    public function calculateLateMinutes($expectedTimeIn = '08:00')
    {
        if (!$this->time_in) {
            return 0;
        }

        try {
            // Parse expected time in (default 8:00 AM)
            $expected = Carbon::parse($this->attendance_date->format('Y-m-d') . ' ' . $expectedTimeIn);
            $actual = Carbon::parse($this->time_in);

            // If actual time is after expected time, calculate late minutes
            if ($actual->gt($expected)) {
                return $actual->diffInMinutes($expected);
            }

            return 0;
        } catch (\Exception $e) {
            \Log::error('Error calculating late minutes: ' . $e->getMessage());
            return 0;
        }
    }

    /**
     * Calculate undertime minutes based on expected time out
     * You can customize this logic based on your business rules
     */
    public function calculateUndertimeMinutes($expectedTimeOut = '17:00')
    {
        // For night shifts, use next_day_timeout if available
        $timeOut = $this->is_nightshift && $this->next_day_timeout 
            ? $this->next_day_timeout 
            : $this->time_out;

        if (!$timeOut) {
            return 0;
        }

        try {
            // For night shifts, expected time out might be next day
            if ($this->is_nightshift && $this->next_day_timeout) {
                $expectedDate = $this->attendance_date->copy()->addDay()->format('Y-m-d');
                $expected = Carbon::parse($expectedDate . ' ' . $expectedTimeOut);
            } else {
                $expected = Carbon::parse($this->attendance_date->format('Y-m-d') . ' ' . $expectedTimeOut);
            }
            
            $actual = Carbon::parse($timeOut);

            // If actual time is before expected time, calculate undertime minutes
            if ($actual->lt($expected)) {
                return $expected->diffInMinutes($actual);
            }

            return 0;
        } catch (\Exception $e) {
            \Log::error('Error calculating undertime minutes: ' . $e->getMessage());
            return 0;
        }
    }

    /**
     * Auto-calculate late and undertime when model is saved
     */
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($attendance) {
            // Auto-calculate late minutes
            $attendance->late_minutes = $attendance->calculateLateMinutes();
            
            // Auto-calculate undertime minutes
            $attendance->undertime_minutes = $attendance->calculateUndertimeMinutes();
            
            // Set night shift display flag
            $attendance->is_night_shift_display = $attendance->is_nightshift;
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
     * Get late/undertime summary
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
}