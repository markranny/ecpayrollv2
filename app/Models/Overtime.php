<?php
// app/Models/Overtime.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Overtime extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'date',
        'start_time',
        'end_time',
        'total_hours',
        'rate_multiplier',
        'overtime_type',           // New field
        'has_night_differential',  // New field
        'reason',
        'status',                 // pending, manager_approved, approved, rejected
        'dept_manager_id',        // Department manager assigned to review
        'dept_approved_by',       // Department manager who approved/rejected
        'dept_approved_at',       // When department approval happened
        'dept_remarks',           // Department manager remarks
        'hrd_approved_by',        // HRD manager who gave final approval/rejection
        'hrd_approved_at',        // When HRD final approval happened
        'hrd_remarks',            // HRD manager remarks
        'created_by',             // User who created the overtime request
        'rate_edited',            // Track if rate has been manually edited
        'rate_edited_at',         // When rate was last edited
        'rate_edited_by',         // Who edited the rate
    ];

    protected $casts = [
        'date' => 'date',
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'total_hours' => 'decimal:2',
        'rate_multiplier' => 'decimal:2',
        'has_night_differential' => 'boolean',
        'dept_approved_at' => 'datetime',
        'hrd_approved_at' => 'datetime'
    ];

    /**
     * Get available overtime types
     */
    public static function getOvertimeTypes()
    {
        return [
            'regular_weekday' => 'Regular Weekday Overtime',
            'rest_day' => 'Rest Day Work',
            'scheduled_rest_day' => 'Scheduled Rest Day Work',
            'regular_holiday' => 'Regular Holiday Work',
            'special_holiday' => 'Special Holiday Work',
            'emergency_work' => 'Emergency Work',
            'extended_shift' => 'Extended Shift',
            'weekend_work' => 'Weekend Work',
            'night_shift' => 'Night Shift Work',
            'other' => 'Other'
        ];
    }

    /**
     * Get the overtime type label
     */
    public function getOvertimeTypeLabel()
    {
        $types = self::getOvertimeTypes();
        return $types[$this->overtime_type] ?? ucfirst(str_replace('_', ' ', $this->overtime_type));
    }

    /**
     * Get the full overtime description including night differential
     */
    public function getOvertimeDescription()
    {
        $description = $this->getOvertimeTypeLabel();
        
        if ($this->has_night_differential) {
            $description .= ' (with Night Differential)';
        }
        
        return $description;
    }

    /**
     * Scope to filter by overtime type
     */
    public function scopeByType($query, $type)
    {
        return $query->where('overtime_type', $type);
    }

    /**
     * Scope to filter overtimes with night differential
     */
    public function scopeWithNightDifferential($query)
    {
        return $query->where('has_night_differential', true);
    }

    /**
     * Scope to filter overtimes without night differential
     */
    public function scopeWithoutNightDifferential($query)
    {
        return $query->where('has_night_differential', false);
    }

    /**
     * Get overtime statistics by type
     */
    public static function getOvertimeStatsByType($startDate = null, $endDate = null)
    {
        $query = self::query()
            ->selectRaw('overtime_type, has_night_differential, COUNT(*) as count, SUM(total_hours) as total_hours')
            ->where('status', 'approved')
            ->groupBy('overtime_type', 'has_night_differential');

        if ($startDate) {
            $query->whereDate('date', '>=', $startDate);
        }

        if ($endDate) {
            $query->whereDate('date', '<=', $endDate);
        }

        return $query->get();
    }

    /**
     * Automatically determine overtime type based on date and time
     */
    public static function determineOvertimeType($date, $startTime, $endTime)
    {
        $dayOfWeek = \Carbon\Carbon::parse($date)->dayOfWeek;
        $isWeekend = in_array($dayOfWeek, [0, 6]); // Sunday = 0, Saturday = 6
        
        // Check if it's a holiday (you might want to implement a holiday checker)
        $isHoliday = self::isHoliday($date);
        
        // Check for night differential (10pm to 6am)
        $hasNightDiff = self::hasNightDifferential($startTime, $endTime);
        
        // Determine overtime type
        if ($isHoliday) {
            $type = 'regular_holiday';
        } elseif ($isWeekend) {
            $type = 'rest_day';
        } else {
            $type = 'regular_weekday';
        }
        
        return [
            'overtime_type' => $type,
            'has_night_differential' => $hasNightDiff
        ];
    }

    /**
     * Check if given date is a holiday
     * You should implement this based on your holiday calendar
     */
    private static function isHoliday($date)
    {
        // This should be implemented based on your holiday calendar
        // For now, returning false as placeholder
        return false;
    }

    /**
     * Check if time period overlaps with night differential hours
     */
    private static function hasNightDifferential($startTime, $endTime)
    {
        $start = \Carbon\Carbon::parse($startTime);
        $end = \Carbon\Carbon::parse($endTime);
        
        // Night differential is typically 10pm to 6am
        $nightStart = $start->copy()->setTime(22, 0, 0); // 10pm
        $nightEnd = $start->copy()->addDay()->setTime(6, 0, 0); // 6am next day
        
        // Check if any part of the work period falls within night hours
        return ($start->lt($nightEnd) && $end->gt($nightStart));
    }

    // Existing relationships and methods remain the same...
    
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function departmentManager()
    {
        return $this->belongsTo(User::class, 'dept_manager_id');
    }

    public function departmentApprover()
    {
        return $this->belongsTo(User::class, 'dept_approved_by');
    }

    public function hrdApprover()
    {
        return $this->belongsTo(User::class, 'hrd_approved_by');
    }

    // Helper methods for status checks
    public function isPending()
    {
        return $this->status === 'pending';
    }

    public function isManagerApproved()
    {
        return $this->status === 'manager_approved';
    }

    public function isFullyApproved()
    {
        return $this->status === 'approved';
    }

    public function isRejected()
    {
        return $this->status === 'rejected';
    }

    // Get the current approver based on status
    public function getCurrentApprover()
    {
        if ($this->status === 'pending') {
            return $this->departmentManager;
        } elseif ($this->status === 'manager_approved') {
            return User::whereHas('roles', function($query) {
                $query->where('name', 'hrd_manager');
            })->first();
        }
        
        return null;
    }
}