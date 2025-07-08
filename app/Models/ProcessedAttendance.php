<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class PayrollSummary extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'employee_no',
        'employee_name',
        'cost_center',
        'department',
        'line',
        'period_start',
        'period_end',
        'period_type',
        'year',
        'month',
        'days_worked',
        'ot_hours',
        'off_days',
        'late_under_minutes',
        'nsd_hours',
        'slvl_days',
        'retro',
        'travel_order_hours',
        'holiday_hours',
        'ot_reg_holiday_hours',
        'ot_special_holiday_hours',
        'offset_hours',
        'trip_count',
        'has_ct',
        'has_cs',
        'has_ob',
        'status',
        'posted_by',
        'posted_at',
        'notes'
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'year' => 'integer',
        'month' => 'integer',
        'days_worked' => 'decimal:2',
        'ot_hours' => 'decimal:2',
        'off_days' => 'decimal:2',
        'late_under_minutes' => 'decimal:2',
        'nsd_hours' => 'decimal:2',
        'slvl_days' => 'decimal:2',
        'retro' => 'decimal:2',
        'travel_order_hours' => 'decimal:2',
        'holiday_hours' => 'decimal:2',
        'ot_reg_holiday_hours' => 'decimal:2',
        'ot_special_holiday_hours' => 'decimal:2',
        'offset_hours' => 'decimal:2',
        'trip_count' => 'decimal:2',
        'has_ct' => 'boolean',
        'has_cs' => 'boolean',
        'has_ob' => 'boolean',
        'posted_at' => 'datetime'
    ];

    /**
     * Get the employee associated with this payroll summary.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Get the user who posted this summary.
     */
    public function postedBy()
    {
        return $this->belongsTo(User::class, 'posted_by');
    }

    /**
     * Scope for first half period (1-15).
     */
    public function scopeFirstHalf($query)
    {
        return $query->where('period_type', '1st_half');
    }

    /**
     * Scope for second half period (16-30/31).
     */
    public function scopeSecondHalf($query)
    {
        return $query->where('period_type', '2nd_half');
    }

    /**
     * Scope for specific year and month.
     */
    public function scopeForPeriod($query, $year, $month, $periodType = null)
    {
        $query->where('year', $year)->where('month', $month);
        
        if ($periodType) {
            $query->where('period_type', $periodType);
        }
        
        return $query;
    }

    /**
     * Scope for posted summaries.
     */
    public function scopePosted($query)
    {
        return $query->where('status', 'posted');
    }

    /**
     * Scope for draft summaries.
     */
    public function scopeDraft($query)
    {
        return $query->where('status', 'draft');
    }

    /**
     * Get the period label.
     */
    public function getPeriodLabelAttribute()
    {
        return $this->period_type === '1st_half' ? '1-15' : '16-' . $this->period_end->day;
    }

    /**
     * Get the full period description.
     */
    public function getFullPeriodAttribute()
    {
        return Carbon::create($this->year, $this->month, 1)->format('F Y') . ' (' . $this->period_label . ')';
    }

    /**
     * Get late/undertime in hours.
     */
    public function getLateUnderHoursAttribute()
    {
        return round($this->late_under_minutes / 60, 2);
    }

    /**
     * Check if summary is posted.
     */
    public function isPosted()
    {
        return $this->status === 'posted';
    }

    /**
     * Check if summary is locked.
     */
    public function isLocked()
    {
        return $this->status === 'locked';
    }

    /**
     * Mark summary as posted.
     */
    public function markAsPosted($userId = null)
    {
        $this->update([
            'status' => 'posted',
            'posted_by' => $userId ?? auth()->id(),
            'posted_at' => now()
        ]);
    }

    /**
     * Get summary statistics for a period.
     */
    public static function getPeriodStatistics($year, $month, $periodType)
    {
        return self::forPeriod($year, $month, $periodType)
            ->selectRaw('
                COUNT(*) as total_employees,
                SUM(days_worked) as total_days_worked,
                SUM(ot_hours) as total_ot_hours,
                SUM(off_days) as total_off_days,
                SUM(late_under_minutes) as total_late_under_minutes,
                SUM(nsd_hours) as total_nsd_hours,
                SUM(slvl_days) as total_slvl_days,
                SUM(retro) as total_retro,
                AVG(days_worked) as avg_days_worked,
                AVG(ot_hours) as avg_ot_hours
            ')
            ->first();
    }

    /**
     * Calculate period dates based on year, month, and period type.
     */
    public static function calculatePeriodDates($year, $month, $periodType)
    {
        $startDate = Carbon::create($year, $month, 1);
        
        if ($periodType === '1st_half') {
            $endDate = Carbon::create($year, $month, 15);
        } else {
            $endDate = $startDate->copy()->endOfMonth();
        }
        
        return [$startDate, $endDate];
    }

    /**
     * FIXED: Generate summary data from attendance records with proper calculations.
     */
    public static function generateFromAttendance($employeeId, $year, $month, $periodType)
    {
        [$startDate, $endDate] = self::calculatePeriodDates($year, $month, $periodType);
        
        // Get employee information
        $employee = Employee::findOrFail($employeeId);
        
        // Get attendance records for the period (only non-posted records)
        $attendanceRecords = ProcessedAttendance::where('employee_id', $employeeId)
            ->whereBetween('attendance_date', [$startDate, $endDate])
            ->where('posting_status', 'not_posted') // Only process non-posted records
            ->get();
        
        // Initialize summary values
        $summary = [
            'employee_id' => $employeeId,
            'employee_no' => $employee->idno,
            'employee_name' => trim($employee->Fname . ' ' . $employee->Lname),
            'cost_center' => $employee->CostCenter,
            'department' => $employee->Department,
            'line' => $employee->Line,
            'period_start' => $startDate,
            'period_end' => $endDate,
            'period_type' => $periodType,
            'year' => $year,
            'month' => $month,
            'days_worked' => 0,
            'ot_hours' => 0,
            'off_days' => 0,
            'late_under_minutes' => 0,
            'nsd_hours' => 0,
            'slvl_days' => 0,
            'retro' => 0,
            'travel_order_hours' => 0,
            'holiday_hours' => 0,
            'ot_reg_holiday_hours' => 0,
            'ot_special_holiday_hours' => 0,
            'offset_hours' => 0,
            'trip_count' => 0,
            'has_ct' => false,
            'has_cs' => false,
            'has_ob' => false
        ];
        
        foreach ($attendanceRecords as $record) {
            // FIXED: Days worked calculation
            // Count actual working days (exclude full SLVL days but include partial SLVL)
            if ($record->slvl == 0 && $record->hours_worked > 0) {
                // Full working day with no SLVL
                $summary['days_worked'] += 1;
            } elseif ($record->slvl > 0 && $record->slvl < 1) {
                // Partial SLVL day (0.5 SLVL = 0.5 working day)
                $summary['days_worked'] += (1 - $record->slvl);
            } elseif ($record->slvl == 0 && $record->hours_worked == 0) {
                // No work hours and no SLVL - might be absent or other reason
                // Don't count as working day
            }
            // If slvl >= 1, it's a full leave day, don't count as working day
            
            // FIXED: OT hours calculation
            $summary['ot_hours'] += $record->overtime ?? 0;
            
            // FIXED: Rest days (off days) calculation
            if ($record->restday) {
                $summary['off_days'] += 1;
            }
            
            // FIXED: Late and undertime calculation (convert to total minutes)
            $summary['late_under_minutes'] += ($record->late_minutes ?? 0) + ($record->undertime_minutes ?? 0);
            
            // FIXED: Night shift differential hours calculation
            // NSD hours = hours worked during night shift
            if ($record->is_nightshift && $record->hours_worked > 0) {
                $summary['nsd_hours'] += $record->hours_worked;
            }
            
            // FIXED: SLVL days calculation
            $summary['slvl_days'] += $record->slvl ?? 0;
            
            // FIXED: Retro calculation
            $summary['retro'] += $record->retromultiplier ?? 0;
            
            // Additional fields for comprehensive payroll
            $summary['travel_order_hours'] += $record->travel_order ?? 0;
            $summary['holiday_hours'] += $record->holiday ?? 0;
            $summary['ot_reg_holiday_hours'] += $record->ot_reg_holiday ?? 0;
            $summary['ot_special_holiday_hours'] += $record->ot_special_holiday ?? 0;
            $summary['offset_hours'] += $record->offset ?? 0;
            $summary['trip_count'] += $record->trip ?? 0;
            
            // Boolean flags - set to true if any record has these
            if ($record->ct) $summary['has_ct'] = true;
            if ($record->cs) $summary['has_cs'] = true;
            if ($record->ob) $summary['has_ob'] = true;
        }
        
        return $summary;
    }
}