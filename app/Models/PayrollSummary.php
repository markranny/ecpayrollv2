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
        'payroll_status',
        'posted_by',
        'posted_at',
        'notes',
        // Deduction columns
        'advance',
        'charge_store',
        'charge',
        'meals',
        'miscellaneous',
        'other_deductions',
        // Benefit columns
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
        // Deduction columns casts
        'advance' => 'decimal:2',
        'charge_store' => 'decimal:2',
        'charge' => 'decimal:2',
        'meals' => 'decimal:2',
        'miscellaneous' => 'decimal:2',
        'other_deductions' => 'decimal:2',
        // Benefit columns casts
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
     * ENHANCED: Sync benefits data from posted benefits
     */
    public function syncBenefitsData($employeeId, $year, $month, $periodType)
    {
        try {
            // Determine cutoff based on period type
            $cutoff = $periodType === '1st_half' ? '1st' : '2nd';
            
            // Calculate date range
            [$startDate, $endDate] = self::calculatePeriodDates($year, $month, $periodType);
            
            // Get the latest posted benefit for this employee in this period
            $benefit = Benefit::where('employee_id', $employeeId)
                ->where('cutoff', $cutoff)
                ->whereBetween('date', [$startDate, $endDate])
                ->where('is_posted', true)
                ->latest('date_posted')
                ->first();
                
            if ($benefit) {
                // Update benefit fields in payroll summary
                $this->update([
                    'mf_shares' => $benefit->mf_shares ?? 0,
                    'mf_loan' => $benefit->mf_loan ?? 0,
                    'sss_loan' => $benefit->sss_loan ?? 0,
                    'hmdf_loan' => $benefit->hmdf_loan ?? 0,
                    'hmdf_prem' => $benefit->hmdf_prem ?? 0,
                    'sss_prem' => $benefit->sss_prem ?? 0,
                    'philhealth' => $benefit->philhealth ?? 0,
                    'allowances' => $benefit->allowances ?? 0,
                ]);
                
                \Log::info("Synced benefit data to payroll summary", [
                    'payroll_summary_id' => $this->id,
                    'employee_id' => $employeeId,
                    'benefit_id' => $benefit->id,
                    'period' => "{$year}-{$month}-{$periodType}"
                ]);
                
                return true;
            }
            
            return false;
        } catch (\Exception $e) {
            \Log::error("Error syncing benefit data to payroll summary", [
                'payroll_summary_id' => $this->id,
                'employee_id' => $employeeId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * ENHANCED: Sync deductions data from posted deductions
     */
    public function syncDeductionsData($employeeId, $year, $month, $periodType)
    {
        try {
            // Determine cutoff based on period type
            $cutoff = $periodType === '1st_half' ? '1st' : '2nd';
            
            // Calculate date range
            [$startDate, $endDate] = self::calculatePeriodDates($year, $month, $periodType);
            
            // Get the latest posted deduction for this employee in this period
            $deduction = Deduction::where('employee_id', $employeeId)
                ->where('cutoff', $cutoff)
                ->whereBetween('date', [$startDate, $endDate])
                ->where('is_posted', true)
                ->latest('date_posted')
                ->first();
                
            if ($deduction) {
                // Update deduction fields in payroll summary
                $this->update([
                    'advance' => $deduction->advance ?? 0,
                    'charge_store' => $deduction->charge_store ?? 0,
                    'charge' => $deduction->charge ?? 0,
                    'meals' => $deduction->meals ?? 0,
                    'miscellaneous' => $deduction->miscellaneous ?? 0,
                    'other_deductions' => $deduction->other_deductions ?? 0,
                ]);
                
                \Log::info("Synced deduction data to payroll summary", [
                    'payroll_summary_id' => $this->id,
                    'employee_id' => $employeeId,
                    'deduction_id' => $deduction->id,
                    'period' => "{$year}-{$month}-{$periodType}"
                ]);
                
                return true;
            }
            
            return false;
        } catch (\Exception $e) {
            \Log::error("Error syncing deduction data to payroll summary", [
                'payroll_summary_id' => $this->id,
                'employee_id' => $employeeId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * ENHANCED: Create or update payroll summary when benefits/deductions are posted
     */
    public static function createOrUpdateFromPostedData($employeeId, $cutoff, $date, $type = 'both')
    {
        try {
            // Parse date and determine period
            $carbonDate = Carbon::parse($date);
            $year = $carbonDate->year;
            $month = $carbonDate->month;
            $periodType = $cutoff === '1st' ? '1st_half' : '2nd_half';
            
            // Calculate period dates
            [$startDate, $endDate] = self::calculatePeriodDates($year, $month, $periodType);
            
            // Get employee information
            $employee = Employee::findOrFail($employeeId);
            
            // Find existing payroll summary or create new one
            $summary = self::where('employee_id', $employeeId)
                ->where('year', $year)
                ->where('month', $month)
                ->where('period_type', $periodType)
                ->first();
                
            if (!$summary) {
                // Create new summary with attendance data
                $attendanceData = self::generateFromAttendance($employeeId, $year, $month, $periodType);
                $summary = self::create($attendanceData);
                
                \Log::info("Created new payroll summary from posted data", [
                    'payroll_summary_id' => $summary->id,
                    'employee_id' => $employeeId,
                    'type' => $type
                ]);
            }
            
            // Sync benefits data if needed
            if ($type === 'benefits' || $type === 'both') {
                $summary->syncBenefitsData($employeeId, $year, $month, $periodType);
            }
            
            // Sync deductions data if needed
            if ($type === 'deductions' || $type === 'both') {
                $summary->syncDeductionsData($employeeId, $year, $month, $periodType);
            }
            
            return $summary;
            
        } catch (\Exception $e) {
            \Log::error("Error creating/updating payroll summary from posted data", [
                'employee_id' => $employeeId,
                'cutoff' => $cutoff,
                'date' => $date,
                'type' => $type,
                'error' => $e->getMessage()
            ]);
            return null;
        }
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
     * Generate summary data from attendance records with enhanced benefits/deductions sync.
     */
    public static function generateFromAttendance($employeeId, $year, $month, $periodType)
    {
        [$startDate, $endDate] = self::calculatePeriodDates($year, $month, $periodType);
        
        // Get employee information
        $employee = Employee::findOrFail($employeeId);
        
        // Get attendance records for the period (only non-posted records)
        $attendanceRecords = ProcessedAttendance::where('employee_id', $employeeId)
            ->whereBetween('attendance_date', [$startDate, $endDate])
            ->where('posting_status', 'not_posted')
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
            // Initialize benefit columns with zeros (will be synced from posted benefits)
            'mf_shares' => 0,
            'mf_loan' => 0,
            'sss_loan' => 0,
            'hmdf_loan' => 0,
            'hmdf_prem' => 0,
            'sss_prem' => 0,
            'philhealth' => 0,
            'allowances' => 0,
            // Initialize deduction columns with zeros (will be synced from posted deductions)
            'advance' => 0,
            'charge_store' => 0,
            'charge' => 0,
            'meals' => 0,
            'miscellaneous' => 0,
            'other_deductions' => 0
        ];
        
        foreach ($attendanceRecords as $record) {
            // Calculate attendance data (same as before)
            if ($record->time_in) {
                if ($record->slvl >= 1.0) {
                    $summary['days_worked'] += 0;
                } elseif ($record->slvl > 0 && $record->slvl < 1.0) {
                    $summary['days_worked'] += (1 - $record->slvl);
                } else {
                    $summary['days_worked'] += 1;
                }
            } else {
                if ($record->slvl > 0) {
                    $summary['days_worked'] += 0;
                } else {
                    $summary['days_worked'] += 0;
                }
            }
            
            // Sum other attendance data
            $summary['ot_hours'] += $record->overtime ?? 0;
            if ($record->restday) $summary['off_days'] += 1;
            $summary['late_under_minutes'] += ($record->late_minutes ?? 0) + ($record->undertime_minutes ?? 0);
            if ($record->is_nightshift && $record->hours_worked > 0) {
                $summary['nsd_hours'] += $record->hours_worked;
            }
            $summary['slvl_days'] += $record->slvl ?? 0;
            $summary['retro'] += $record->retromultiplier ?? 0;
            $summary['travel_order_hours'] += $record->travel_order ?? 0;
            $summary['holiday_hours'] += $record->holiday ?? 0;
            $summary['ot_reg_holiday_hours'] += $record->ot_reg_holiday ?? 0;
            $summary['ot_special_holiday_hours'] += $record->ot_special_holiday ?? 0;
            $summary['offset_hours'] += $record->offset ?? 0;
            $summary['trip_count'] += $record->trip ?? 0;
            
            if ($record->ct) $summary['has_ct'] = true;
            if ($record->cs) $summary['has_cs'] = true;
            if ($record->ob) $summary['has_ob'] = true;
        }
        
        $summary['days_worked'] = round($summary['days_worked'], 1);
        
        // ENHANCED: Sync posted benefits and deductions data
        $cutoff = $periodType === '1st_half' ? '1st' : '2nd';
        
        // Get posted benefit data
        $benefit = Benefit::where('employee_id', $employeeId)
            ->where('cutoff', $cutoff)
            ->whereBetween('date', [$startDate, $endDate])
            ->where('is_posted', true)
            ->latest('date_posted')
            ->first();
            
        if ($benefit) {
            $summary['mf_shares'] = $benefit->mf_shares ?? 0;
            $summary['mf_loan'] = $benefit->mf_loan ?? 0;
            $summary['sss_loan'] = $benefit->sss_loan ?? 0;
            $summary['hmdf_loan'] = $benefit->hmdf_loan ?? 0;
            $summary['hmdf_prem'] = $benefit->hmdf_prem ?? 0;
            $summary['sss_prem'] = $benefit->sss_prem ?? 0;
            $summary['philhealth'] = $benefit->philhealth ?? 0;
            $summary['allowances'] = $benefit->allowances ?? 0;
        }
        
        // Get posted deduction data
        $deduction = Deduction::where('employee_id', $employeeId)
            ->where('cutoff', $cutoff)
            ->whereBetween('date', [$startDate, $endDate])
            ->where('is_posted', true)
            ->latest('date_posted')
            ->first();
            
        if ($deduction) {
            $summary['advance'] = $deduction->advance ?? 0;
            $summary['charge_store'] = $deduction->charge_store ?? 0;
            $summary['charge'] = $deduction->charge ?? 0;
            $summary['meals'] = $deduction->meals ?? 0;
            $summary['miscellaneous'] = $deduction->miscellaneous ?? 0;
            $summary['other_deductions'] = $deduction->other_deductions ?? 0;
        }
        
        return $summary;
    }
}