<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class FinalPayroll extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'employee_no',
        'employee_name',
        'cost_center',
        'department',
        'line',
        'job_title',
        'rank_file',
        'period_start',
        'period_end',
        'period_type',
        'year',
        'month',
        'pay_type',
        'basic_rate',
        'pay_allowance',
        'is_taxable',
        'days_worked',
        'hours_worked',
        'late_under_minutes',
        'late_under_hours',
        'ot_regular_hours',
        'ot_regular_amount',
        'ot_rest_day_hours',
        'ot_rest_day_amount',
        'ot_special_holiday_hours',
        'ot_special_holiday_amount',
        'ot_regular_holiday_hours',
        'ot_regular_holiday_amount',
        'nsd_hours',
        'nsd_amount',
        'holiday_hours',
        'holiday_amount',
        'travel_order_hours',
        'travel_order_amount',
        'slvl_days',
        'slvl_amount',
        'absence_days',
        'absence_deduction',
        'late_under_deduction',
        'retro_amount',
        'offset_hours',
        'offset_amount',
        'trip_count',
        'trip_amount',
        'other_earnings',
        'basic_pay',
        'overtime_pay',
        'premium_pay',
        'allowances',
        'gross_earnings',
        'sss_contribution',
        'philhealth_contribution',
        'hdmf_contribution',
        'withholding_tax',
        'mf_shares',
        'mf_loan',
        'sss_loan',
        'hdmf_loan',
        'advance_deduction',
        'charge_store',
        'charge_deduction',
        'meals_deduction',
        'miscellaneous_deduction',
        'other_deductions',
        'total_government_deductions',
        'total_company_deductions',
        'total_other_deductions',
        'total_deductions',
        'taxable_income',
        'net_pay',
        'has_ct',
        'has_cs',
        'has_ob',
        'has_adjustments',
        'status',
        'approval_status',
        'created_by',
        'approved_by',
        'approved_at',
        'finalized_by',
        'finalized_at',
        'paid_by',
        'paid_at',
        'payroll_summary_id',
        'benefit_id',
        'deduction_id',
        'calculation_notes',
        'approval_remarks',
        'calculation_breakdown'
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'year' => 'integer',
        'month' => 'integer',
        'is_taxable' => 'boolean',
        'basic_rate' => 'decimal:2',
        'pay_allowance' => 'decimal:2',
        'days_worked' => 'decimal:2',
        'hours_worked' => 'decimal:2',
        'late_under_minutes' => 'decimal:2',
        'late_under_hours' => 'decimal:2',
        'ot_regular_hours' => 'decimal:2',
        'ot_regular_amount' => 'decimal:2',
        'ot_rest_day_hours' => 'decimal:2',
        'ot_rest_day_amount' => 'decimal:2',
        'ot_special_holiday_hours' => 'decimal:2',
        'ot_special_holiday_amount' => 'decimal:2',
        'ot_regular_holiday_hours' => 'decimal:2',
        'ot_regular_holiday_amount' => 'decimal:2',
        'nsd_hours' => 'decimal:2',
        'nsd_amount' => 'decimal:2',
        'holiday_hours' => 'decimal:2',
        'holiday_amount' => 'decimal:2',
        'travel_order_hours' => 'decimal:2',
        'travel_order_amount' => 'decimal:2',
        'slvl_days' => 'decimal:1',
        'slvl_amount' => 'decimal:2',
        'absence_days' => 'decimal:1',
        'absence_deduction' => 'decimal:2',
        'late_under_deduction' => 'decimal:2',
        'retro_amount' => 'decimal:2',
        'offset_hours' => 'decimal:2',
        'offset_amount' => 'decimal:2',
        'trip_count' => 'decimal:1',
        'trip_amount' => 'decimal:2',
        'other_earnings' => 'decimal:2',
        'basic_pay' => 'decimal:2',
        'overtime_pay' => 'decimal:2',
        'premium_pay' => 'decimal:2',
        'allowances' => 'decimal:2',
        'gross_earnings' => 'decimal:2',
        'sss_contribution' => 'decimal:2',
        'philhealth_contribution' => 'decimal:2',
        'hdmf_contribution' => 'decimal:2',
        'withholding_tax' => 'decimal:2',
        'mf_shares' => 'decimal:2',
        'mf_loan' => 'decimal:2',
        'sss_loan' => 'decimal:2',
        'hdmf_loan' => 'decimal:2',
        'advance_deduction' => 'decimal:2',
        'charge_store' => 'decimal:2',
        'charge_deduction' => 'decimal:2',
        'meals_deduction' => 'decimal:2',
        'miscellaneous_deduction' => 'decimal:2',
        'other_deductions' => 'decimal:2',
        'total_government_deductions' => 'decimal:2',
        'total_company_deductions' => 'decimal:2',
        'total_other_deductions' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'taxable_income' => 'decimal:2',
        'net_pay' => 'decimal:2',
        'has_ct' => 'boolean',
        'has_cs' => 'boolean',
        'has_ob' => 'boolean',
        'has_adjustments' => 'boolean',
        'approved_at' => 'datetime',
        'finalized_at' => 'datetime',
        'paid_at' => 'datetime',
        'calculation_breakdown' => 'array'
    ];

    /**
     * Get the employee that owns the final payroll.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Get the user who created this payroll.
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who approved this payroll.
     */
    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Get the user who finalized this payroll.
     */
    public function finalizer()
    {
        return $this->belongsTo(User::class, 'finalized_by');
    }

    /**
     * Get the user who marked this payroll as paid.
     */
    public function paidBy()
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    /**
     * Get the source payroll summary.
     */
    public function payrollSummary()
    {
        return $this->belongsTo(PayrollSummary::class, 'payroll_summary_id');
    }

    /**
     * Get the source benefit record.
     */
    public function benefit()
    {
        return $this->belongsTo(Benefit::class, 'benefit_id');
    }

    /**
     * Get the source deduction record.
     */
    public function deduction()
    {
        return $this->belongsTo(Deduction::class, 'deduction_id');
    }

    /**
     * Scope for draft payrolls.
     */
    public function scopeDraft($query)
    {
        return $query->where('status', 'draft');
    }

    /**
     * Scope for finalized payrolls.
     */
    public function scopeFinalized($query)
    {
        return $query->where('status', 'finalized');
    }

    /**
     * Scope for paid payrolls.
     */
    public function scopePaid($query)
    {
        return $query->where('status', 'paid');
    }

    /**
     * Scope for approved payrolls.
     */
    public function scopeApproved($query)
    {
        return $query->where('approval_status', 'approved');
    }

    /**
     * Scope for pending approval.
     */
    public function scopePendingApproval($query)
    {
        return $query->where('approval_status', 'pending');
    }

    /**
     * Scope for specific period.
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
     * Scope for specific department.
     */
    public function scopeForDepartment($query, $department)
    {
        return $query->where('department', $department);
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
     * Check if payroll is editable.
     */
    public function isEditable()
    {
        return in_array($this->status, ['draft']) && $this->approval_status === 'pending';
    }

    /**
     * Check if payroll can be approved.
     */
    public function canBeApproved()
    {
        return $this->status === 'draft' && $this->approval_status === 'pending';
    }

    /**
     * Check if payroll can be finalized.
     */
    public function canBeFinalized()
    {
        return $this->status === 'draft' && $this->approval_status === 'approved';
    }

    /**
     * Check if payroll can be marked as paid.
     */
    public function canBeMarkedAsPaid()
    {
        return $this->status === 'finalized';
    }

    /**
     * Mark payroll as approved.
     */
    public function markAsApproved($userId = null, $remarks = null)
    {
        $this->update([
            'approval_status' => 'approved',
            'approved_by' => $userId ?? auth()->id(),
            'approved_at' => now(),
            'approval_remarks' => $remarks
        ]);
    }

    /**
     * Mark payroll as rejected.
     */
    public function markAsRejected($userId = null, $remarks = null)
    {
        $this->update([
            'approval_status' => 'rejected',
            'approved_by' => $userId ?? auth()->id(),
            'approved_at' => now(),
            'approval_remarks' => $remarks
        ]);
    }

    /**
     * Mark payroll as finalized.
     */
    public function markAsFinalized($userId = null)
    {
        $this->update([
            'status' => 'finalized',
            'finalized_by' => $userId ?? auth()->id(),
            'finalized_at' => now()
        ]);
    }

    /**
     * Mark payroll as paid.
     */
    public function markAsPaid($userId = null)
    {
        $this->update([
            'status' => 'paid',
            'paid_by' => $userId ?? auth()->id(),
            'paid_at' => now()
        ]);
    }

    /**
 * Enhanced generation from payroll summary with better error handling and flexibility
 */
public static function generateFromPayrollSummary($payrollSummaryId, $userId = null, $options = [])
{
    try {
        $summary = PayrollSummary::with(['employee'])->findOrFail($payrollSummaryId);
        $employee = $summary->employee;
        
        // Check if final payroll already exists
        $existing = self::where('employee_id', $summary->employee_id)
            ->where('year', $summary->year)
            ->where('month', $summary->month)
            ->where('period_type', $summary->period_type)
            ->first();
            
        if ($existing && !($options['force_regenerate'] ?? false)) {
            throw new \Exception('Final payroll already exists for this employee and period.');
        }
        
        // If force regenerate and existing payroll is not editable, throw error
        if ($existing && ($options['force_regenerate'] ?? false)) {
            if ($existing->status !== 'draft') {
                throw new \Exception('Cannot regenerate finalized payroll.');
            }
            $existing->delete();
        }
        
        // Get corresponding benefit and deduction records
        $benefit = null;
        $deduction = null;
        
        if ($options['include_benefits'] ?? true) {
            $benefit = Benefit::where('employee_id', $summary->employee_id)
                ->where('cutoff', $summary->period_type === '1st_half' ? '1st' : '2nd')
                ->whereYear('date', $summary->year)
                ->whereMonth('date', $summary->month)
                ->where('is_posted', true)
                ->latest('date_posted')
                ->first();
        }
        
        if ($options['include_deductions'] ?? true) {
            $deduction = Deduction::where('employee_id', $summary->employee_id)
                ->where('cutoff', $summary->period_type === '1st_half' ? '1st' : '2nd')
                ->whereYear('date', $summary->year)
                ->whereMonth('date', $summary->month)
                ->where('is_posted', true)
                ->latest('date_posted')
                ->first();
        }
        
        // Create final payroll with enhanced data mapping
        $finalPayrollData = [
            'employee_id' => $summary->employee_id,
            'employee_no' => $summary->employee_no,
            'employee_name' => $summary->employee_name,
            'cost_center' => $summary->cost_center,
            'department' => $summary->department,
            'line' => $summary->line,
            'job_title' => $employee->Jobtitle,
            'rank_file' => $employee->RankFile,
            'period_start' => $summary->period_start,
            'period_end' => $summary->period_end,
            'period_type' => $summary->period_type,
            'year' => $summary->year,
            'month' => $summary->month,
            'pay_type' => $employee->pay_type ?: 'daily',
            'basic_rate' => $employee->payrate ?: 0,
            'pay_allowance' => $employee->pay_allowance ?: 0,
            'is_taxable' => $employee->Taxable ?? true,
            
            // From payroll summary - attendance data
            'days_worked' => $summary->days_worked ?? 0,
            'hours_worked' => ($summary->days_worked ?? 0) * 8, // Assuming 8 hours per day
            'late_under_minutes' => $summary->late_under_minutes ?? 0,
            'late_under_hours' => ($summary->late_under_minutes ?? 0) / 60,
            'ot_regular_hours' => $summary->ot_hours ?? 0,
            'nsd_hours' => $summary->nsd_hours ?? 0,
            'holiday_hours' => $summary->holiday_hours ?? 0,
            'ot_regular_holiday_hours' => $summary->ot_reg_holiday_hours ?? 0,
            'ot_special_holiday_hours' => $summary->ot_special_holiday_hours ?? 0,
            'travel_order_hours' => $summary->travel_order_hours ?? 0,
            'slvl_days' => $summary->slvl_days ?? 0,
            'retro_amount' => $summary->retro ?? 0,
            'offset_hours' => $summary->offset_hours ?? 0,
            'trip_count' => $summary->trip_count ?? 0,
            'has_ct' => $summary->has_ct ?? false,
            'has_cs' => $summary->has_cs ?? false,
            'has_ob' => $summary->has_ob ?? false,
            
            // From benefits (if included and available)
            'mf_shares' => $benefit ? ($benefit->mf_shares ?? 0) : 0,
            'allowances' => $benefit ? ($benefit->allowances ?? 0) : 0,
            
            // From deductions (if included and available)
            'mf_loan' => $benefit ? ($benefit->mf_loan ?? 0) : 0,
            'sss_loan' => $benefit ? ($benefit->sss_loan ?? 0) : 0,
            'hdmf_loan' => $benefit ? ($benefit->hmdf_loan ?? 0) : 0,
            'advance_deduction' => $deduction ? ($deduction->advance ?? 0) : 0,
            'charge_store' => $deduction ? ($deduction->charge_store ?? 0) : 0,
            'charge_deduction' => $deduction ? ($deduction->charge ?? 0) : 0,
            'meals_deduction' => $deduction ? ($deduction->meals ?? 0) : 0,
            'miscellaneous_deduction' => $deduction ? ($deduction->miscellaneous ?? 0) : 0,
            'other_deductions' => $deduction ? ($deduction->other_deductions ?? 0) : 0,
            
            // References
            'payroll_summary_id' => $summary->id,
            'benefit_id' => $benefit?->id,
            'deduction_id' => $deduction?->id,
            'created_by' => $userId ?? auth()->id(),
            'status' => 'draft', // Always start as draft
            'approval_status' => 'pending', // Always start as pending
            'has_adjustments' => false
        ];
        
        $finalPayroll = self::create($finalPayrollData);
        
        // Calculate all payroll components
        $finalPayroll->calculatePayroll();
        
        // Auto-approve if requested and user has permission
        /* if ($options['auto_approve'] ?? false) {
            $finalPayroll->markAsApproved($userId ?? auth()->id(), 'Auto-approved during generation');
        } */
        
        // Log the generation
        \Log::info('Final payroll generated from summary', [
            'final_payroll_id' => $finalPayroll->id,
            'payroll_summary_id' => $summary->id,
            'employee_id' => $summary->employee_id,
            'employee_name' => $summary->employee_name,
            'period' => $summary->year . '-' . $summary->month . '-' . $summary->period_type,
            'net_pay' => $finalPayroll->net_pay,
            'generated_by' => $userId ?? auth()->id()
        ]);
        
        return $finalPayroll;
        
    } catch (\Exception $e) {
        \Log::error('Error generating final payroll from summary: ' . $e->getMessage(), [
            'payroll_summary_id' => $payrollSummaryId,
            'user_id' => $userId,
            'options' => $options,
            'trace' => $e->getTraceAsString()
        ]);
        throw $e;
    }
}

/**
 * Enhanced bulk generation method
 */
public static function bulkGenerateFromSummaries(array $summaryIds, $userId = null, $options = [])
{
    $results = [
        'generated' => 0,
        'skipped' => 0,
        'errors' => []
    ];
    
    DB::beginTransaction();
    
    try {
        foreach ($summaryIds as $summaryId) {
            try {
                $finalPayroll = self::generateFromPayrollSummary($summaryId, $userId, $options);
                $results['generated']++;
            } catch (\Exception $e) {
                if (str_contains($e->getMessage(), 'already exists')) {
                    $results['skipped']++;
                } else {
                    $results['errors'][] = "Summary ID {$summaryId}: " . $e->getMessage();
                }
            }
        }
        
        DB::commit();
        
        \Log::info('Bulk final payroll generation completed', [
            'results' => $results,
            'total_processed' => count($summaryIds),
            'user_id' => $userId
        ]);
        
        return $results;
        
    } catch (\Exception $e) {
        DB::rollBack();
        \Log::error('Bulk final payroll generation failed: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * Check if payroll summary has corresponding final payroll
 */
public static function existsForSummary($summaryId)
{
    $summary = PayrollSummary::findOrFail($summaryId);
    
    return self::where('employee_id', $summary->employee_id)
        ->where('year', $summary->year)
        ->where('month', $summary->month)
        ->where('period_type', $summary->period_type)
        ->exists();
}

/**
 * Get final payroll by summary
 */
public static function getBySummary($summaryId)
{
    $summary = PayrollSummary::findOrFail($summaryId);
    
    return self::where('employee_id', $summary->employee_id)
        ->where('year', $summary->year)
        ->where('month', $summary->month)
        ->where('period_type', $summary->period_type)
        ->with(['employee', 'creator', 'approver', 'finalizer', 'paidBy'])
        ->first();
}

/**
 * Enhanced calculation method with better breakdown tracking
 */
public function calculatePayroll()
{
    try {
        // Store original values for comparison
        $originalNetPay = $this->net_pay;
        
        // Calculate basic pay based on pay type
        $this->calculateBasicPay();
        
        // Calculate overtime pay
        $this->calculateOvertimePay();
        
        // Calculate premium pay
        $this->calculatePremiumPay();
        
        // Calculate deductions
        $this->calculateDeductions();
        
        // Calculate government contributions
        $this->calculateGovernmentContributions();
        
        // Calculate totals
        $this->calculateTotals();
        
        // Generate calculation breakdown
        $this->generateCalculationBreakdown();
        
        // Mark as having adjustments if values changed significantly
        if ($originalNetPay > 0 && abs($this->net_pay - $originalNetPay) > 0.01) {
            $this->has_adjustments = true;
        }
        
        // Save calculations
        $this->save();
        
        \Log::info('Payroll calculation completed', [
            'final_payroll_id' => $this->id,
            'employee_name' => $this->employee_name,
            'net_pay' => $this->net_pay,
            'gross_earnings' => $this->gross_earnings,
            'total_deductions' => $this->total_deductions
        ]);
        
    } catch (\Exception $e) {
        \Log::error('Error calculating payroll: ' . $e->getMessage(), [
            'final_payroll_id' => $this->id,
            'employee_id' => $this->employee_id
        ]);
        throw $e;
    }
}

/**
 * Enhanced validation before generation
 */
public static function validateSummaryForGeneration($summaryId)
{
    $summary = PayrollSummary::with(['employee'])->findOrFail($summaryId);
    
    $errors = [];
    
    // Check if summary is posted
    if ($summary->status !== 'posted') {
        $errors[] = 'Payroll summary must be posted before generating final payroll';
    }
    
    // Check if employee exists and is active
    if (!$summary->employee || $summary->employee->JobStatus !== 'Active') {
        $errors[] = 'Employee must be active to generate final payroll';
    }
    
    // Check if employee has basic rate
    if (!$summary->employee->payrate || $summary->employee->payrate <= 0) {
        $errors[] = 'Employee must have a valid basic rate';
    }
    
    // Check for negative critical values
    if ($summary->days_worked < 0) {
        $errors[] = 'Days worked cannot be negative';
    }
    
    return [
        'valid' => empty($errors),
        'errors' => $errors,
        'summary' => $summary
    ];
}

/**
 * Get generation statistics for a period
 */
public static function getGenerationStats($year, $month, $periodType = null)
{
    $summariesQuery = PayrollSummary::where('year', $year)
        ->where('month', $month)
        ->where('status', 'posted');
        
    $finalPayrollsQuery = self::where('year', $year)
        ->where('month', $month);
        
    if ($periodType) {
        $summariesQuery->where('period_type', $periodType);
        $finalPayrollsQuery->where('period_type', $periodType);
    }
    
    $totalSummaries = $summariesQuery->count();
    $generatedPayrolls = $finalPayrollsQuery->count();
    
    return [
        'total_summaries' => $totalSummaries,
        'generated_payrolls' => $generatedPayrolls,
        'pending_generation' => $totalSummaries - $generatedPayrolls,
        'generation_percentage' => $totalSummaries > 0 ? round(($generatedPayrolls / $totalSummaries) * 100, 2) : 0
    ];
}

    /**
     * Calculate basic pay.
     */
    private function calculateBasicPay()
    {
        switch ($this->pay_type) {
            case 'daily':
                $this->basic_pay = $this->basic_rate * $this->days_worked;
                break;
            case 'hourly':
                $this->basic_pay = $this->basic_rate * $this->hours_worked;
                break;
            case 'monthly':
                // For monthly, calculate based on days worked vs expected working days
                $expectedDays = $this->period_type === '1st_half' ? 15 : 
                    ($this->period_end->day - 15); // Days in second half
                $this->basic_pay = ($this->basic_rate / 30) * $expectedDays; // Assuming 30-day month
                break;
            default:
                $this->basic_pay = $this->basic_rate * $this->days_worked;
        }

        // Add allowances
        $this->allowances = $this->pay_allowance;
        
        // Calculate late/undertime deductions
        if ($this->late_under_hours > 0) {
            $hourlyRate = $this->basic_rate / 8; // Assuming 8 hours per day
            $this->late_under_deduction = $hourlyRate * $this->late_under_hours;
        }
        
        // Calculate absence deductions
        if ($this->absence_days > 0) {
            $this->absence_deduction = $this->basic_rate * $this->absence_days;
        }
    }

    /**
     * Calculate overtime pay.
     */
    private function calculateOvertimePay()
    {
        $hourlyRate = $this->basic_rate / 8; // Assuming 8 hours per day
        
        // Regular overtime (1.25x)
        $this->ot_regular_amount = $this->ot_regular_hours * $hourlyRate * 1.25;
        
        // Rest day overtime (1.30x)
        $this->ot_rest_day_amount = $this->ot_rest_day_hours * $hourlyRate * 1.30;
        
        // Special holiday overtime
        $this->ot_special_holiday_amount = $this->ot_special_holiday_hours * $hourlyRate * 1.30;
        
        // Regular holiday overtime
        $this->ot_regular_holiday_amount = $this->ot_regular_holiday_hours * $hourlyRate * 2.0;
        
        // Total overtime pay
        $this->overtime_pay = $this->ot_regular_amount + $this->ot_rest_day_amount + 
                             $this->ot_special_holiday_amount + $this->ot_regular_holiday_amount;
    }

    /**
     * Calculate premium pay.
     */
    private function calculatePremiumPay()
    {
        $hourlyRate = $this->basic_rate / 8;
        
        // Night shift differential (10% of hourly rate)
        $this->nsd_amount = $this->nsd_hours * $hourlyRate * 0.10;
        
        // Holiday premium
        $this->holiday_amount = $this->holiday_hours * $hourlyRate;
        
        // Travel order
        $this->travel_order_amount = $this->travel_order_hours * $hourlyRate;
        
        // SLVL (if with pay)
        $this->slvl_amount = $this->slvl_days * $this->basic_rate;
        
        // Offset
        $this->offset_amount = $this->offset_hours * $hourlyRate;
        
        // Trip allowance (assuming fixed rate per trip)
        $this->trip_amount = $this->trip_count * 50; // Assuming PHP 50 per trip
        
        // Total premium pay
        $this->premium_pay = $this->nsd_amount + $this->holiday_amount + 
                            $this->travel_order_amount + $this->offset_amount;
    }

    /**
     * Calculate deductions.
     */
    private function calculateDeductions()
    {
        // Company deductions
        $this->total_company_deductions = $this->mf_shares + $this->mf_loan + 
                                         $this->sss_loan + $this->hdmf_loan;
        
        // Other deductions
        $this->total_other_deductions = $this->advance_deduction + $this->charge_store + 
                                       $this->charge_deduction + $this->meals_deduction + 
                                       $this->miscellaneous_deduction + $this->other_deductions;
    }

    /**
     * Calculate government contributions.
     */
    private function calculateGovernmentContributions()
    {
        if (!$this->is_taxable) {
            return;
        }

        $monthlyBasic = $this->basic_pay * 2; // Approximate monthly for contribution calculation
        
        // SSS Contribution (simplified - should use actual SSS table)
        $this->sss_contribution = min($monthlyBasic * 0.045, 1000); // Max PHP 1,000
        
        // PhilHealth Contribution (simplified - should use actual PhilHealth table)
        $this->philhealth_contribution = min($monthlyBasic * 0.015, 2000); // Max PHP 2,000
        
        // HDMF Contribution
        $this->hdmf_contribution = min($monthlyBasic * 0.02, 100); // Max PHP 100
        
        $this->total_government_deductions = $this->sss_contribution + 
                                           $this->philhealth_contribution + 
                                           $this->hdmf_contribution;
    }

    /**
     * Calculate withholding tax.
     */
    private function calculateWithholdingTax()
    {
        if (!$this->is_taxable) {
            $this->withholding_tax = 0;
            return;
        }

        // Calculate taxable income
        $this->taxable_income = $this->basic_pay + $this->overtime_pay + $this->premium_pay + 
                               $this->allowances + $this->retro_amount + $this->other_earnings -
                               $this->total_government_deductions - $this->absence_deduction - 
                               $this->late_under_deduction;

        // Simplified withholding tax calculation (should use actual BIR tax table)
        $monthlyTaxableIncome = $this->taxable_income * 2; // Approximate monthly
        
        if ($monthlyTaxableIncome <= 20833) {
            $this->withholding_tax = 0;
        } elseif ($monthlyTaxableIncome <= 33333) {
            $this->withholding_tax = ($monthlyTaxableIncome - 20833) * 0.15 / 2;
        } elseif ($monthlyTaxableIncome <= 66667) {
            $this->withholding_tax = (1875 + ($monthlyTaxableIncome - 33333) * 0.20) / 2;
        } elseif ($monthlyTaxableIncome <= 166667) {
            $this->withholding_tax = (8541.80 + ($monthlyTaxableIncome - 66667) * 0.25) / 2;
        } elseif ($monthlyTaxableIncome <= 666667) {
            $this->withholding_tax = (33541.80 + ($monthlyTaxableIncome - 166667) * 0.30) / 2;
        } else {
            $this->withholding_tax = (183541.80 + ($monthlyTaxableIncome - 666667) * 0.35) / 2;
        }
    }

    /**
     * Calculate all totals.
     */
    private function calculateTotals()
    {
        // Calculate withholding tax first
        $this->calculateWithholdingTax();
        
        // Gross earnings
        $this->gross_earnings = $this->basic_pay + $this->overtime_pay + $this->premium_pay + 
                               $this->allowances + $this->retro_amount + $this->slvl_amount + 
                               $this->trip_amount + $this->other_earnings;
        
        // Total deductions
        $this->total_deductions = $this->total_government_deductions + $this->total_company_deductions + 
                                 $this->total_other_deductions + $this->withholding_tax + 
                                 $this->absence_deduction + $this->late_under_deduction;
        
        // Net pay
        $this->net_pay = $this->gross_earnings - $this->total_deductions;
        
        // Ensure net pay is not negative
        $this->net_pay = max(0, $this->net_pay);
    }
    
    /**
     * Get payroll statistics for a period.
     */
    public static function getPeriodStatistics($year, $month, $periodType = null, $department = null)
    {
        $query = self::forPeriod($year, $month, $periodType);
        
        if ($department) {
            $query->forDepartment($department);
        }
        
        return [
            'total_employees' => $query->count(),
            'total_gross_earnings' => $query->sum('gross_earnings'),
            'total_net_pay' => $query->sum('net_pay'),
            'total_deductions' => $query->sum('total_deductions'),
            'total_government_deductions' => $query->sum('total_government_deductions'),
            'total_company_deductions' => $query->sum('total_company_deductions'),
            'total_other_deductions' => $query->sum('total_other_deductions'),
            'total_basic_pay' => $query->sum('basic_pay'),
            'total_overtime_pay' => $query->sum('overtime_pay'),
            'total_premium_pay' => $query->sum('premium_pay'),
            'average_net_pay' => $query->avg('net_pay'),
            'status_counts' => [
                'draft' => $query->clone()->where('status', 'draft')->count(),
                'finalized' => $query->clone()->where('status', 'finalized')->count(),
                'paid' => $query->clone()->where('status', 'paid')->count(),
            ],
            'approval_counts' => [
                'pending' => $query->clone()->where('approval_status', 'pending')->count(),
                'approved' => $query->clone()->where('approval_status', 'approved')->count(),
                'rejected' => $query->clone()->where('approval_status', 'rejected')->count(),
            ]
        ];
    }

    /**
     * Generate calculation breakdown.
     */
    public function generateCalculationBreakdown()
    {
        $breakdown = [
            'basic_calculation' => [
                'pay_type' => $this->pay_type,
                'basic_rate' => $this->basic_rate,
                'days_worked' => $this->days_worked,
                'hours_worked' => $this->hours_worked,
                'basic_pay' => $this->basic_pay,
                'allowances' => $this->allowances
            ],
            'overtime_calculation' => [
                'regular_ot' => [
                    'hours' => $this->ot_regular_hours,
                    'rate' => $this->basic_rate / 8 * 1.25,
                    'amount' => $this->ot_regular_amount
                ],
                'rest_day_ot' => [
                    'hours' => $this->ot_rest_day_hours,
                    'rate' => $this->basic_rate / 8 * 1.30,
                    'amount' => $this->ot_rest_day_amount
                ],
                'special_holiday_ot' => [
                    'hours' => $this->ot_special_holiday_hours,
                    'rate' => $this->basic_rate / 8 * 1.30,
                    'amount' => $this->ot_special_holiday_amount
                ],
                'regular_holiday_ot' => [
                    'hours' => $this->ot_regular_holiday_hours,
                    'rate' => $this->basic_rate / 8 * 2.0,
                    'amount' => $this->ot_regular_holiday_amount
                ]
            ],
            'premium_calculation' => [
                'nsd' => [
                    'hours' => $this->nsd_hours,
                    'rate' => $this->basic_rate / 8 * 0.10,
                    'amount' => $this->nsd_amount
                ],
                'holiday_premium' => $this->holiday_amount,
                'travel_order' => $this->travel_order_amount,
                'offset' => $this->offset_amount,
                'trip_allowance' => $this->trip_amount
            ],
            'deductions_calculation' => [
                'government' => [
                    'sss' => $this->sss_contribution,
                    'philhealth' => $this->philhealth_contribution,
                    'hdmf' => $this->hdmf_contribution,
                    'withholding_tax' => $this->withholding_tax
                ],
                'company' => [
                    'mf_shares' => $this->mf_shares,
                    'mf_loan' => $this->mf_loan,
                    'sss_loan' => $this->sss_loan,
                    'hdmf_loan' => $this->hdmf_loan
                ],
                'other' => [
                    'advance' => $this->advance_deduction,
                    'charge_store' => $this->charge_store,
                    'charge' => $this->charge_deduction,
                    'meals' => $this->meals_deduction,
                    'miscellaneous' => $this->miscellaneous_deduction,
                    'other' => $this->other_deductions,
                    'late_under' => $this->late_under_deduction,
                    'absence' => $this->absence_deduction
                ]
            ],
            'summary' => [
                'gross_earnings' => $this->gross_earnings,
                'total_deductions' => $this->total_deductions,
                'taxable_income' => $this->taxable_income,
                'net_pay' => $this->net_pay
            ]
        ];
        
        $this->calculation_breakdown = $breakdown;
        $this->save();
        
        return $breakdown;
    }

    /**
     * Export final payrolls to array format.
     */
    public static function exportToArray($year, $month, $periodType = null, $department = null)
    {
        $query = self::forPeriod($year, $month, $periodType)
            ->with(['employee', 'creator', 'approver']);
            
        if ($department) {
            $query->forDepartment($department);
        }
        
        $payrolls = $query->orderBy('department')
            ->orderBy('employee_name')
            ->get();
        
        $exportData = [];
        
        foreach ($payrolls as $payroll) {
            $exportData[] = [
                'Employee No' => $payroll->employee_no,
                'Employee Name' => $payroll->employee_name,
                'Department' => $payroll->department,
                'Line' => $payroll->line,
                'Cost Center' => $payroll->cost_center,
                'Period' => $payroll->full_period,
                'Basic Rate' => number_format($payroll->basic_rate, 2),
                'Days Worked' => number_format($payroll->days_worked, 1),
                'Basic Pay' => number_format($payroll->basic_pay, 2),
                'Overtime Pay' => number_format($payroll->overtime_pay, 2),
                'Premium Pay' => number_format($payroll->premium_pay, 2),
                'Allowances' => number_format($payroll->allowances, 2),
                'Gross Earnings' => number_format($payroll->gross_earnings, 2),
                'SSS Contribution' => number_format($payroll->sss_contribution, 2),
                'PhilHealth Contribution' => number_format($payroll->philhealth_contribution, 2),
                'HDMF Contribution' => number_format($payroll->hdmf_contribution, 2),
                'Withholding Tax' => number_format($payroll->withholding_tax, 2),
                'Other Deductions' => number_format($payroll->total_other_deductions, 2),
                'Total Deductions' => number_format($payroll->total_deductions, 2),
                'Net Pay' => number_format($payroll->net_pay, 2),
                'Status' => ucfirst($payroll->status),
                'Approval Status' => ucfirst($payroll->approval_status),
                'Created At' => $payroll->created_at->format('Y-m-d H:i:s'),
                'Approved At' => $payroll->approved_at ? $payroll->approved_at->format('Y-m-d H:i:s') : '',
                'Finalized At' => $payroll->finalized_at ? $payroll->finalized_at->format('Y-m-d H:i:s') : '',
                'Paid At' => $payroll->paid_at ? $payroll->paid_at->format('Y-m-d H:i:s') : ''
            ];
        }
        
        return $exportData;
    }
}