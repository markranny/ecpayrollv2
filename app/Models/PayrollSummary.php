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
        'payroll_status ',
        'posted_by',
        'posted_at',
        'notes',
        // New deduction columns
        'advance',
        'charge_store',
        'charge',
        'meals',
        'miscellaneous',
        'other_deductions',
        // New benefit columns
        'mf_shares',
        'mf_loan',
        'sss_loan',
        'hmdf_loan',
        'hmdf_prem',
        'sss_prem',
        'philhealth',
        'allowances'
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
        'posted_at' => 'datetime',
        // New deduction columns casts
        'advance' => 'decimal:2',
        'charge_store' => 'decimal:2',
        'charge' => 'decimal:2',
        'meals' => 'decimal:2',
        'miscellaneous' => 'decimal:2',
        'other_deductions' => 'decimal:2',
        // New benefit columns casts
        'mf_shares' => 'decimal:2',
        'mf_loan' => 'decimal:2',
        'sss_loan' => 'decimal:2',
        'hmdf_loan' => 'decimal:2',
        'hmdf_prem' => 'decimal:2',
        'sss_prem' => 'decimal:2',
        'philhealth' => 'decimal:2',
        'allowances' => 'decimal:2'
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
     * Get total deductions amount.
     */
    public function getTotalDeductionsAttribute()
    {
        return $this->advance + $this->charge_store + $this->charge + $this->meals + 
               $this->miscellaneous + $this->other_deductions + $this->mf_loan + 
               $this->sss_loan + $this->hmdf_loan + $this->hmdf_prem + $this->sss_prem + 
               $this->philhealth;
    }

    /**
     * Get total benefits amount.
     */
    public function getTotalBenefitsAttribute()
    {
        return $this->mf_shares + $this->allowances;
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
                AVG(ot_hours) as avg_ot_hours,
                SUM(advance + charge_store + charge + meals + miscellaneous + other_deductions + mf_loan + sss_loan + hmdf_loan + hmdf_prem + sss_prem + philhealth) as total_deductions,
                SUM(mf_shares + allowances) as total_benefits
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
     * Generate summary data from attendance records.
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
            'has_ob' => false,
            // Initialize new deduction columns
            'advance' => 0,
            'charge_store' => 0,
            'charge' => 0,
            'meals' => 0,
            'miscellaneous' => 0,
            'other_deductions' => 0,
            // Initialize new benefit columns
            'mf_shares' => 0,
            'mf_loan' => 0,
            'sss_loan' => 0,
            'hmdf_loan' => 0,
            'hmdf_prem' => 0,
            'sss_prem' => 0,
            'philhealth' => 0,
            'allowances' => 0
        ];
        
        foreach ($attendanceRecords as $record) {
            // FIXED: Days worked calculation
            // Count any record that has time_in as a working day, regardless of hours worked
            // This includes partial days, late arrivals, early departures, etc.
            if ($record->time_in) {
                // Check if it's a full SLVL day (sick/vacation leave)
                if ($record->slvl >= 1.0) {
                    // Full SLVL day - don't count as working day
                    $summary['days_worked'] += 0;
                } elseif ($record->slvl > 0 && $record->slvl < 1.0) {
                    // Partial SLVL day (e.g., 0.5) - count the working portion
                    $summary['days_worked'] += (1 - $record->slvl);
                } else {
                    // No SLVL or minimal SLVL - count as full working day
                    $summary['days_worked'] += 1;
                }
            } else {
                // No time_in recorded
                if ($record->slvl > 0) {
                    // Pure leave day without time_in - don't count as working day
                    $summary['days_worked'] += 0;
                } else {
                    // No time_in and no SLVL - might be absent, don't count
                    $summary['days_worked'] += 0;
                }
            }
            
            // OT hours calculation
            $summary['ot_hours'] += $record->overtime ?? 0;
            
            // Rest days (off days) calculation
            if ($record->restday) {
                $summary['off_days'] += 1;
            }
            
            // Late and undertime calculation (convert to total minutes)
            $summary['late_under_minutes'] += ($record->late_minutes ?? 0) + ($record->undertime_minutes ?? 0);
            
            // Night shift differential hours calculation
            // NSD hours = hours worked during night shift
            if ($record->is_nightshift && $record->hours_worked > 0) {
                $summary['nsd_hours'] += $record->hours_worked;
            }
            
            // SLVL days calculation
            $summary['slvl_days'] += $record->slvl ?? 0;
            
            // Retro calculation
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
        
        // Ensure days_worked is properly formatted
        $summary['days_worked'] = round($summary['days_worked'], 1);
        
        return $summary;
    }
}