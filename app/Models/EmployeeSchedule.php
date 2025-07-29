<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class EmployeeSchedule extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'shift_type',
        'start_time',
        'end_time',
        'break_start',
        'break_end',
        'work_days',
        'effective_date',
        'end_date',
        'status',
        'notes',
        'created_by',
        'updated_by'
    ];

    protected $casts = [
        'effective_date' => 'date',
        'end_date' => 'date',
        'work_days' => 'array'
    ];

    /**
     * Get the employee that owns the schedule.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Get the user who created the schedule.
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated the schedule.
     */
    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Scope for active schedules.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope for inactive schedules.
     */
    public function scopeInactive($query)
    {
        return $query->where('status', 'inactive');
    }

    /**
     * Scope for pending schedules.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope for current schedules (effective today).
     */
    public function scopeCurrent($query)
    {
        $today = Carbon::today();
        return $query->where('effective_date', '<=', $today)
            ->where(function($q) use ($today) {
                $q->whereNull('end_date')
                  ->orWhere('end_date', '>=', $today);
            });
    }

    /**
     * Scope for schedules by shift type.
     */
    public function scopeByShiftType($query, $shiftType)
    {
        return $query->where('shift_type', $shiftType);
    }

    /**
     * Scope for schedules by department.
     */
    public function scopeByDepartment($query, $department)
    {
        return $query->whereHas('employee', function($q) use ($department) {
            $q->where('Department', $department);
        });
    }

    /**
     * Scope for schedules effective within a date range.
     */
    public function scopeEffectiveBetween($query, $startDate, $endDate)
    {
        return $query->where(function($q) use ($startDate, $endDate) {
            $q->where('effective_date', '<=', $endDate)
              ->where(function($subQ) use ($startDate) {
                  $subQ->whereNull('end_date')
                       ->orWhere('end_date', '>=', $startDate);
              });
        });
    }

    /**
     * Check if the schedule is currently active.
     */
    public function isCurrentlyActive()
    {
        if ($this->status !== 'active') {
            return false;
        }

        $today = Carbon::today();
        
        if ($this->effective_date > $today) {
            return false;
        }

        if ($this->end_date && $this->end_date < $today) {
            return false;
        }

        return true;
    }

    /**
     * Check if the schedule applies to a specific day of the week.
     */
    public function appliesToDay($dayOfWeek)
    {
        $workDays = $this->work_days;
        
        if (!is_array($workDays)) {
            $workDays = json_decode($workDays, true) ?: [];
        }

        $dayNames = [
            0 => 'sunday',
            1 => 'monday',
            2 => 'tuesday',
            3 => 'wednesday',
            4 => 'thursday',
            5 => 'friday',
            6 => 'saturday'
        ];

        $dayName = $dayNames[$dayOfWeek] ?? null;
        
        return $dayName && in_array($dayName, $workDays);
    }

    /**
     * Get the total work hours per day.
     */
    public function getTotalWorkHours()
    {
        if (!$this->start_time || !$this->end_time) {
            return 0;
        }

        $start = Carbon::createFromFormat('H:i', $this->start_time);
        $end = Carbon::createFromFormat('H:i', $this->end_time);

        // Handle overnight shifts
        if ($end->lt($start)) {
            $end->addDay();
        }

        $totalMinutes = $end->diffInMinutes($start);

        // Subtract break time if specified
        if ($this->break_start && $this->break_end) {
            $breakStart = Carbon::createFromFormat('H:i', $this->break_start);
            $breakEnd = Carbon::createFromFormat('H:i', $this->break_end);
            
            if ($breakEnd->gt($breakStart)) {
                $breakMinutes = $breakEnd->diffInMinutes($breakStart);
                $totalMinutes -= $breakMinutes;
            }
        }

        return round($totalMinutes / 60, 2);
    }

    /**
     * Get the formatted work time display.
     */
    public function getFormattedWorkTimeAttribute()
    {
        if (!$this->start_time || !$this->end_time) {
            return 'Not set';
        }

        $start = Carbon::createFromFormat('H:i', $this->start_time)->format('g:i A');
        $end = Carbon::createFromFormat('H:i', $this->end_time)->format('g:i A');

        return "{$start} - {$end}";
    }

    /**
     * Get the formatted break time display.
     */
    public function getFormattedBreakTimeAttribute()
    {
        if (!$this->break_start || !$this->break_end) {
            return 'No break set';
        }

        $start = Carbon::createFromFormat('H:i', $this->break_start)->format('g:i A');
        $end = Carbon::createFromFormat('H:i', $this->break_end)->format('g:i A');

        return "{$start} - {$end}";
    }

    /**
     * Get the formatted work days display.
     */
    public function getFormattedWorkDaysAttribute()
    {
        $workDays = $this->work_days;
        
        if (!is_array($workDays)) {
            $workDays = json_decode($workDays, true) ?: [];
        }

        if (empty($workDays)) {
            return 'No days set';
        }

        $dayLabels = [
            'monday' => 'Mon',
            'tuesday' => 'Tue',
            'wednesday' => 'Wed',
            'thursday' => 'Thu',
            'friday' => 'Fri',
            'saturday' => 'Sat',
            'sunday' => 'Sun'
        ];

        $formatted = array_map(function($day) use ($dayLabels) {
            return $dayLabels[$day] ?? ucfirst($day);
        }, $workDays);

        return implode(', ', $formatted);
    }

    /**
     * Get the shift type label.
     */
    public function getShiftTypeLabelAttribute()
    {
        $labels = [
            'regular' => 'Regular Shift',
            'night' => 'Night Shift',
            'flexible' => 'Flexible Shift',
            'rotating' => 'Rotating Shift'
        ];

        return $labels[$this->shift_type] ?? ucfirst($this->shift_type);
    }

    /**
     * Get the status label.
     */
    public function getStatusLabelAttribute()
    {
        return ucfirst($this->status);
    }

    /**
     * Get the status color for UI display.
     */
    public function getStatusColorAttribute()
    {
        $colors = [
            'active' => 'green',
            'inactive' => 'red',
            'pending' => 'yellow'
        ];

        return $colors[$this->status] ?? 'gray';
    }

    /**
     * Check if this schedule conflicts with another schedule.
     */
    public function conflictsWith(EmployeeSchedule $other)
    {
        // Must be same employee
        if ($this->employee_id !== $other->employee_id) {
            return false;
        }

        // Must be different schedules
        if ($this->id === $other->id) {
            return false;
        }

        // Both must be active or pending
        if (!in_array($this->status, ['active', 'pending']) || 
            !in_array($other->status, ['active', 'pending'])) {
            return false;
        }

        // Check date overlap
        $thisStart = $this->effective_date;
        $thisEnd = $this->end_date ?: Carbon::create(2099, 12, 31); // Far future if no end date
        
        $otherStart = $other->effective_date;
        $otherEnd = $other->end_date ?: Carbon::create(2099, 12, 31);

        return $thisStart <= $otherEnd && $thisEnd >= $otherStart;
    }

    /**
     * Get the next working day for this schedule.
     */
    public function getNextWorkingDay($fromDate = null)
    {
        $fromDate = $fromDate ?: Carbon::today();
        $workDays = $this->work_days;
        
        if (!is_array($workDays)) {
            $workDays = json_decode($workDays, true) ?: [];
        }

        if (empty($workDays)) {
            return null;
        }

        $dayNumbers = [
            'sunday' => 0,
            'monday' => 1,
            'tuesday' => 2,
            'wednesday' => 3,
            'thursday' => 4,
            'friday' => 5,
            'saturday' => 6
        ];

        $workDayNumbers = array_map(function($day) use ($dayNumbers) {
            return $dayNumbers[$day] ?? null;
        }, $workDays);

        $workDayNumbers = array_filter($workDayNumbers, function($day) {
            return $day !== null;
        });

        if (empty($workDayNumbers)) {
            return null;
        }

        sort($workDayNumbers);

        $currentDay = $fromDate->dayOfWeek;
        
        // Find the next working day
        foreach ($workDayNumbers as $workDay) {
            if ($workDay > $currentDay) {
                return $fromDate->copy()->addDays($workDay - $currentDay);
            }
        }

        // If no working day found this week, get the first working day of next week
        $firstWorkDay = $workDayNumbers[0];
        $daysToAdd = (7 - $currentDay) + $firstWorkDay;
        
        return $fromDate->copy()->addDays($daysToAdd);
    }

    /**
     * Generate calendar events for this schedule within a date range.
     */
    public function generateCalendarEvents($startDate, $endDate)
    {
        $events = [];
        $workDays = $this->work_days;
        
        if (!is_array($workDays)) {
            $workDays = json_decode($workDays, true) ?: [];
        }

        if (empty($workDays) || !$this->isCurrentlyActive()) {
            return $events;
        }

        $dayNumbers = [
            'sunday' => 0,
            'monday' => 1,
            'tuesday' => 2,
            'wednesday' => 3,
            'thursday' => 4,
            'friday' => 5,
            'saturday' => 6
        ];

        $workDayNumbers = array_map(function($day) use ($dayNumbers) {
            return $dayNumbers[$day] ?? null;
        }, $workDays);

        $workDayNumbers = array_filter($workDayNumbers);

        $current = Carbon::parse($startDate);
        $end = Carbon::parse($endDate);

        // Ensure we start from the schedule's effective date
        if ($current->lt($this->effective_date)) {
            $current = $this->effective_date->copy();
        }

        // Ensure we don't go past the schedule's end date
        if ($this->end_date && $end->gt($this->end_date)) {
            $end = $this->end_date->copy();
        }

        while ($current->lte($end)) {
            if (in_array($current->dayOfWeek, $workDayNumbers)) {
                $eventStart = $current->copy()->setTimeFromTimeString($this->start_time);
                $eventEnd = $current->copy()->setTimeFromTimeString($this->end_time);

                // Handle overnight shifts
                if ($eventEnd->lt($eventStart)) {
                    $eventEnd->addDay();
                }

                $events[] = [
                    'id' => "schedule_{$this->id}_{$current->format('Y-m-d')}",
                    'title' => $this->employee->Fname . ' ' . $this->employee->Lname . ' - ' . $this->shift_type_label,
                    'start' => $eventStart->toISOString(),
                    'end' => $eventEnd->toISOString(),
                    'allDay' => false,
                    'backgroundColor' => $this->getShiftTypeColor(),
                    'borderColor' => $this->getShiftTypeColor(),
                    'extendedProps' => [
                        'schedule_id' => $this->id,
                        'employee_id' => $this->employee_id,
                        'shift_type' => $this->shift_type,
                        'status' => $this->status
                    ]
                ];
            }

            $current->addDay();
        }

        return $events;
    }

    /**
     * Get color for shift type.
     */
    public function getShiftTypeColor()
    {
        $colors = [
            'regular' => '#10b981',   // emerald
            'night' => '#8b5cf6',     // purple
            'flexible' => '#3b82f6',  // blue
            'rotating' => '#f97316'   // orange
        ];

        return $colors[$this->shift_type] ?? '#6b7280'; // gray
    }

    /**
     * Get statistics for schedules.
     */
    public static function getStatistics($filters = [])
    {
        $query = static::query();

        // Apply filters
        if (isset($filters['department'])) {
            $query->byDepartment($filters['department']);
        }

        if (isset($filters['shift_type'])) {
            $query->byShiftType($filters['shift_type']);
        }

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        $total = $query->count();
        $active = $query->clone()->where('status', 'active')->count();
        $inactive = $query->clone()->where('status', 'inactive')->count();
        $pending = $query->clone()->where('status', 'pending')->count();

        // Get shift type counts
        $shiftCounts = $query->clone()
            ->select('shift_type', \DB::raw('count(*) as count'))
            ->groupBy('shift_type')
            ->pluck('count', 'shift_type')
            ->toArray();

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $inactive,
            'pending' => $pending,
            'shift_types' => $shiftCounts
        ];
    }

    /**
     * Boot method to handle model events.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($schedule) {
            if (auth()->check()) {
                $schedule->created_by = auth()->id();
            }
        });

        static::updating(function ($schedule) {
            if (auth()->check()) {
                $schedule->updated_by = auth()->id();
            }
        });
    }
}