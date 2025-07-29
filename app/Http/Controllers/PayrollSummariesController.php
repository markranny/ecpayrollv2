<?php

namespace App\Http\Controllers;

use App\Models\PayrollSummary;
use App\Models\FinalPayroll;
use App\Models\ProcessedAttendance;
use App\Models\Employee;
use App\Models\Department;
use App\Models\Benefit;
use App\Models\Deduction;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;

class PayrollSummariesController extends Controller
{
    /**
     * Display the payroll summaries page
     */
    public function index()
    {
        return Inertia::render('Payroll/PayrollSummaries', [
            'auth' => ['user' => auth()->user()]
        ]);
    }

    /**
     * Get available payroll summaries for final payroll generation
     */
    public function getAvailableForFinalPayroll(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'year' => 'required|integer|min:2020|max:2030',
                'month' => 'required|integer|min:1|max:12',
                'period_type' => 'nullable|in:1st_half,2nd_half',
                'department' => 'nullable|string|max:255',
                'force_regenerate' => 'boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $year = $request->input('year');
            $month = $request->input('month');
            $periodType = $request->input('period_type');
            $department = $request->input('department');
            $forceRegenerate = $request->boolean('force_regenerate', false);

            // Base query for posted payroll summaries
            $query = PayrollSummary::query()
                ->where('year', $year)
                ->where('month', $month)
                ->where('status', 'posted'); // Only posted summaries

            // Apply filters
            if ($periodType) {
                $query->where('period_type', $periodType);
            }

            if ($department) {
                $query->where('department', $department);
            }

            // If not force regenerate, exclude summaries that already have final payrolls
            if (!$forceRegenerate) {
                $query->whereNotExists(function ($subQuery) use ($year, $month, $periodType) {
                    $subQuery->select(DB::raw(1))
                        ->from('final_payrolls')
                        ->whereColumn('final_payrolls.employee_id', 'payroll_summaries.employee_id')
                        ->where('final_payrolls.year', $year)
                        ->where('final_payrolls.month', $month);
                    
                    if ($periodType) {
                        $subQuery->where('final_payrolls.period_type', $periodType);
                    }
                });
            }

            $summaries = $query->orderBy('department')
                ->orderBy('employee_name')
                ->get();

            // Calculate totals for each summary
            $summaries = $summaries->map(function ($summary) {
                $totalDeductions = ($summary->advance ?? 0) + 
                    ($summary->charge_store ?? 0) + 
                    ($summary->charge ?? 0) + 
                    ($summary->meals ?? 0) + 
                    ($summary->miscellaneous ?? 0) + 
                    ($summary->other_deductions ?? 0) + 
                    ($summary->mf_loan ?? 0) + 
                    ($summary->sss_loan ?? 0) + 
                    ($summary->hmdf_loan ?? 0) + 
                    ($summary->hmdf_prem ?? 0) + 
                    ($summary->sss_prem ?? 0) + 
                    ($summary->philhealth ?? 0);

                $totalBenefits = ($summary->mf_shares ?? 0) + ($summary->allowances ?? 0);

                $summary->total_deductions = $totalDeductions;
                $summary->total_benefits = $totalBenefits;
                $summary->full_period = $this->getFullPeriodLabel($summary->year, $summary->month, $summary->period_type);

                return $summary;
            });

            return response()->json([
                'success' => true,
                'data' => $summaries,
                'count' => $summaries->count(),
                'message' => $summaries->count() > 0 
                    ? "Found {$summaries->count()} available summaries for final payroll generation"
                    : 'No available summaries found for final payroll generation'
            ]);

        } catch (\Exception $e) {
            Log::error('Error getting available summaries for final payroll: ' . $e->getMessage(), [
                'request_data' => $request->all(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to get available summaries: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate final payrolls from selected payroll summaries
     */
    public function generateFinalPayrollsFromSummaries(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'summary_ids' => 'required|array|min:1',
                'summary_ids.*' => 'integer|exists:payroll_summaries,id',
                'year' => 'required|integer|min:2020|max:2030',
                'month' => 'required|integer|min:1|max:12',
                'period_type' => 'nullable|in:1st_half,2nd_half',
                'department' => 'nullable|string',
                'include_benefits' => 'boolean',
                'include_deductions' => 'boolean',
                'force_regenerate' => 'boolean',
                'auto_approve' => 'boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $summaryIds = $request->input('summary_ids');
            $includeBenefits = $request->boolean('include_benefits', true);
            $includeDeductions = $request->boolean('include_deductions', true);
            $forceRegenerate = $request->boolean('force_regenerate', false);
            $autoApprove = $request->boolean('auto_approve', false);

            DB::beginTransaction();

            try {
                $generated = 0;
                $skipped = 0;
                $errors = [];

                foreach ($summaryIds as $summaryId) {
                    try {
                        $summary = PayrollSummary::findOrFail($summaryId);

                        // Check if final payroll already exists
                        $existingFinalPayroll = FinalPayroll::where('employee_id', $summary->employee_id)
                            ->where('year', $summary->year)
                            ->where('month', $summary->month)
                            ->where('period_type', $summary->period_type)
                            ->first();

                        if ($existingFinalPayroll && !$forceRegenerate) {
                            $skipped++;
                            continue;
                        }

                        // If force regenerate and exists, delete the existing one first
                        if ($existingFinalPayroll && $forceRegenerate) {
                            // Only allow deletion if it's still in draft status
                            if ($existingFinalPayroll->status === 'draft') {
                                $existingFinalPayroll->delete();
                            } else {
                                $errors[] = "Cannot regenerate finalized payroll for {$summary->employee_name}";
                                continue;
                            }
                        }

                        // Generate final payroll from summary
                        $finalPayroll = $this->createFinalPayrollFromSummary(
                            $summary, 
                            $includeBenefits, 
                            $includeDeductions,
                            $autoApprove
                        );

                        if ($finalPayroll) {
                            $generated++;
                        }

                    } catch (\Exception $e) {
                        $errors[] = "Error generating payroll for summary ID {$summaryId}: " . $e->getMessage();
                        Log::error("Error generating final payroll for summary {$summaryId}: " . $e->getMessage());
                    }
                }

                DB::commit();

                $message = "Successfully generated {$generated} final payroll records";
                if ($skipped > 0) {
                    $message .= ", skipped {$skipped} existing records";
                }
                if (!empty($errors)) {
                    $message .= ", " . count($errors) . " errors occurred";
                }

                Log::info('Final payroll generation completed', [
                    'generated_count' => $generated,
                    'skipped_count' => $skipped,
                    'error_count' => count($errors),
                    'initiated_by' => auth()->id()
                ]);

                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'data' => [
                        'generated' => $generated,
                        'skipped' => $skipped,
                        'errors' => array_slice($errors, 0, 10) // Limit errors shown
                    ]
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Error in final payroll generation: ' . $e->getMessage(), [
                'request_data' => $request->all(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Final payroll generation failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create final payroll from payroll summary
     */
    private function createFinalPayrollFromSummary(
        PayrollSummary $summary, 
        bool $includeBenefits = true, 
        bool $includeDeductions = true,
        bool $autoApprove = false
    ) {
        try {
            // Get employee information
            $employee = Employee::findOrFail($summary->employee_id);

            // Get corresponding benefit record if needed
            $benefit = null;
            if ($includeBenefits) {
                $cutoff = $summary->period_type === '1st_half' ? '1st' : '2nd';
                $benefit = Benefit::where('employee_id', $summary->employee_id)
                    ->where('cutoff', $cutoff)
                    ->whereYear('date', $summary->year)
                    ->whereMonth('date', $summary->month)
                    ->where('is_posted', true)
                    ->latest('date_posted')
                    ->first();
            }

            // Get corresponding deduction record if needed
            $deduction = null;
            if ($includeDeductions) {
                $cutoff = $summary->period_type === '1st_half' ? '1st' : '2nd';
                $deduction = Deduction::where('employee_id', $summary->employee_id)
                    ->where('cutoff', $cutoff)
                    ->whereYear('date', $summary->year)
                    ->whereMonth('date', $summary->month)
                    ->where('is_posted', true)
                    ->latest('date_posted')
                    ->first();
            }

            // Create final payroll record
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
                'days_worked' => $summary->days_worked,
                'late_under_minutes' => $summary->late_under_minutes,
                'late_under_hours' => $summary->late_under_minutes / 60,
                'ot_regular_hours' => $summary->ot_hours,
                'nsd_hours' => $summary->nsd_hours,
                'holiday_hours' => $summary->holiday_hours,
                'ot_regular_holiday_hours' => $summary->ot_reg_holiday_hours ?? 0,
                'ot_special_holiday_hours' => $summary->ot_special_holiday_hours ?? 0,
                'travel_order_hours' => $summary->travel_order_hours,
                'slvl_days' => $summary->slvl_days,
                'retro_amount' => $summary->retro,
                'offset_hours' => $summary->offset_hours,
                'trip_count' => $summary->trip_count,
                'has_ct' => $summary->has_ct,
                'has_cs' => $summary->has_cs,
                'has_ob' => $summary->has_ob,

                // From benefits (if included and available)
                'mf_shares' => $benefit ? ($benefit->mf_shares ?? 0) : 0,
                'allowances' => $benefit ? ($benefit->allowances ?? 0) : 0,

                // From deductions (if included and available)
                'advance_deduction' => $deduction ? ($deduction->advance ?? 0) : 0,
                'charge_store' => $deduction ? ($deduction->charge_store ?? 0) : 0,
                'charge_deduction' => $deduction ? ($deduction->charge ?? 0) : 0,
                'meals_deduction' => $deduction ? ($deduction->meals ?? 0) : 0,
                'miscellaneous_deduction' => $deduction ? ($deduction->miscellaneous ?? 0) : 0,
                'other_deductions' => $deduction ? ($deduction->other_deductions ?? 0) : 0,
                'mf_loan' => $deduction ? ($deduction->mf_loan ?? 0) : 0,

                // References
                'payroll_summary_id' => $summary->id,
                'benefit_id' => $benefit ? $benefit->id : null,
                'deduction_id' => $deduction ? $deduction->id : null,
                'created_by' => auth()->id(),
                'status' => 'draft',
                'approval_status' => $autoApprove ? 'approved' : 'pending'
            ];

            // Create the final payroll
            $finalPayroll = FinalPayroll::create($finalPayrollData);

            // Calculate all payroll components
            $finalPayroll->calculatePayroll();

            // If auto-approve is enabled and user has permission
            if ($autoApprove) {
                $finalPayroll->markAsApproved(auth()->id(), 'Auto-approved during generation');
            }

            return $finalPayroll;

        } catch (\Exception $e) {
            Log::error("Error creating final payroll from summary {$summary->id}: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Helper method to get full period label
     */
    private function getFullPeriodLabel($year, $month, $periodType)
    {
        $monthName = Carbon::create($year, $month, 1)->format('F Y');
        $periodLabel = $periodType === '1st_half' ? '(1-15)' : '(16-30/31)';
        
        return "{$monthName} {$periodLabel}";
    }

    /**
 * Update the list method to include calculated totals
 */
public function list(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'year' => 'nullable|integer|min:2020|max:2030',
                'month' => 'nullable|integer|min:1|max:12',
                'period_type' => 'nullable|in:1st_half,2nd_half',
                'department' => 'nullable|string|max:255',
                'status' => 'nullable|in:draft,posted,locked',
                'search' => 'nullable|string|max:255',
                'page' => 'nullable|integer|min:1',
                'per_page' => 'nullable|integer|min:1|max:100'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $year = $request->input('year', now()->year);
            $month = $request->input('month', now()->month);
            $periodType = $request->input('period_type');
            $department = $request->input('department');
            $status = $request->input('status');
            $search = $request->input('search');
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 25);

            // Build the query
            $query = PayrollSummary::query()
                ->with(['employee:id,idno,Fname,Lname,Department,Line,CostCenter', 'postedBy:id,name'])
                ->where('year', $year)
                ->where('month', $month);

            // Apply filters
            if ($periodType) {
                $query->where('period_type', $periodType);
            }

            if ($department) {
                $query->where('department', $department);
            }

            if ($status) {
                $query->where('status', $status);
            }

            // Apply search filter
            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('employee_name', 'LIKE', "%{$search}%")
                      ->orWhere('employee_no', 'LIKE', "%{$search}%")
                      ->orWhere('department', 'LIKE', "%{$search}%")
                      ->orWhere('line', 'LIKE', "%{$search}%")
                      ->orWhere('cost_center', 'LIKE', "%{$search}%");
                });
            }

            // Get total count for statistics
            $totalQuery = clone $query;
            $totalCount = $totalQuery->count();

            // Apply pagination
            $summaries = $query->orderBy('employee_name', 'asc')
                ->paginate($perPage, ['*'], 'page', $page);

            // Calculate comprehensive statistics
            $statisticsQuery = PayrollSummary::query()
                ->where('year', $year)
                ->where('month', $month);
                
            if ($periodType) {
                $statisticsQuery->where('period_type', $periodType);
            }
            if ($department) {
                $statisticsQuery->where('department', $department);
            }
            if ($status) {
                $statisticsQuery->where('status', $status);
            }
            if ($search) {
                $statisticsQuery->where(function ($q) use ($search) {
                    $q->where('employee_name', 'LIKE', "%{$search}%")
                      ->orWhere('employee_no', 'LIKE', "%{$search}%")
                      ->orWhere('department', 'LIKE', "%{$search}%")
                      ->orWhere('line', 'LIKE', "%{$search}%")
                      ->orWhere('cost_center', 'LIKE', "%{$search}%");
                });
            }

            $statisticsQuery = PayrollSummary::query()
            ->where('year', $year)
            ->where('month', $month);
            
        if ($periodType) {
            $statisticsQuery->where('period_type', $periodType);
        }
        if ($department) {
            $statisticsQuery->where('department', $department);
        }
        if ($status) {
            $statisticsQuery->where('status', $status);
        }
        if ($search) {
            $statisticsQuery->where(function ($q) use ($search) {
                $q->where('employee_name', 'LIKE', "%{$search}%")
                  ->orWhere('employee_no', 'LIKE', "%{$search}%")
                  ->orWhere('department', 'LIKE', "%{$search}%")
                  ->orWhere('line', 'LIKE', "%{$search}%")
                  ->orWhere('cost_center', 'LIKE', "%{$search}%");
            });
        }

        $statistics = $statisticsQuery->selectRaw('
            COUNT(*) as total_summaries,
            SUM(days_worked) as total_days_worked,
            SUM(ot_hours) as total_ot_hours,
            SUM(late_under_minutes) as total_late_under_minutes,
            SUM(nsd_hours) as total_nsd_hours,
            SUM(slvl_days) as total_slvl_days,
            SUM(retro) as total_retro,
            SUM(travel_order_hours) as total_travel_order_hours,
            SUM(holiday_hours) as total_holiday_hours,
            SUM(trip_count) as total_trip_count,
            
            -- FIXED: Calculate deductions properly with COALESCE for NULL safety
            SUM(COALESCE(advance, 0) + COALESCE(charge_store, 0) + COALESCE(charge, 0) + 
                COALESCE(meals, 0) + COALESCE(miscellaneous, 0) + COALESCE(other_deductions, 0) + 
                COALESCE(mf_loan, 0) + COALESCE(sss_loan, 0) + COALESCE(hmdf_loan, 0) + 
                COALESCE(hmdf_prem, 0) + COALESCE(sss_prem, 0) + COALESCE(philhealth, 0)) as total_deductions,
            
            -- FIXED: Calculate benefits properly with COALESCE for NULL safety
            SUM(COALESCE(mf_shares, 0) + COALESCE(allowances, 0)) as total_benefits,
            
            AVG(days_worked) as avg_days_worked,
            AVG(ot_hours) as avg_ot_hours
        ')->first();

            // Get departments for filter
            $departments = PayrollSummary::where('year', $year)
                ->where('month', $month)
                ->whereNotNull('department')
                ->distinct()
                ->pluck('department')
                ->sort()
                ->values();

            // Transform summaries data with calculated totals
            $transformedSummaries = $summaries->getCollection()->map(function ($summary) {
                // Calculate total deductions
                $totalDeductions = ($summary->advance ?? 0) + 
                    ($summary->charge_store ?? 0) + 
                    ($summary->charge ?? 0) + 
                    ($summary->meals ?? 0) + 
                    ($summary->miscellaneous ?? 0) + 
                    ($summary->other_deductions ?? 0) + 
                    ($summary->mf_loan ?? 0) + 
                    ($summary->sss_loan ?? 0) + 
                    ($summary->hmdf_loan ?? 0) + 
                    ($summary->hmdf_prem ?? 0) + 
                    ($summary->sss_prem ?? 0) + 
                    ($summary->philhealth ?? 0);

                // Calculate total benefits
                $totalBenefits = ($summary->mf_shares ?? 0) + ($summary->allowances ?? 0);

                return [
                    'id' => $summary->id,
                    'employee_id' => $summary->employee_id,
                    'employee_no' => $summary->employee_no,
                    'employee_name' => $summary->employee_name,
                    'cost_center' => $summary->cost_center,
                    'department' => $summary->department,
                    'line' => $summary->line,
                    'period_start' => $summary->period_start,
                    'period_end' => $summary->period_end,
                    'period_type' => $summary->period_type,
                    'year' => $summary->year,
                    'month' => $summary->month,
                    'days_worked' => (float) $summary->days_worked,
                    'ot_hours' => (float) $summary->ot_hours,
                    'off_days' => (float) $summary->off_days,
                    'late_under_minutes' => (float) $summary->late_under_minutes,
                    'nsd_hours' => (float) $summary->nsd_hours,
                    'slvl_days' => (float) $summary->slvl_days,
                    'retro' => (float) $summary->retro,
                    'travel_order_hours' => (float) $summary->travel_order_hours,
                    'holiday_hours' => (float) $summary->holiday_hours,
                    'ot_reg_holiday_hours' => (float) $summary->ot_reg_holiday_hours,
                    'ot_special_holiday_hours' => (float) $summary->ot_special_holiday_hours,
                    'offset_hours' => (float) $summary->offset_hours,
                    'trip_count' => (float) $summary->trip_count,
                    'has_ct' => (bool) $summary->has_ct,
                    'has_cs' => (bool) $summary->has_cs,
                    'has_ob' => (bool) $summary->has_ob,
                    // Deduction fields
                    'advance' => (float) $summary->advance,
                    'charge_store' => (float) $summary->charge_store,
                    'charge' => (float) $summary->charge,
                    'meals' => (float) $summary->meals,
                    'miscellaneous' => (float) $summary->miscellaneous,
                    'other_deductions' => (float) $summary->other_deductions,
                    'mf_loan' => (float) $summary->mf_loan,
                    'sss_loan' => (float) $summary->sss_loan,
                    'hmdf_loan' => (float) $summary->hmdf_loan,
                    'hmdf_prem' => (float) $summary->hmdf_prem,
                    'sss_prem' => (float) $summary->sss_prem,
                    'philhealth' => (float) $summary->philhealth,
                    // Benefit fields
                    'mf_shares' => (float) $summary->mf_shares,
                    'allowances' => (float) $summary->allowances,
                    // Status and metadata
                    'status' => $summary->status,
                    'posted_by' => $summary->postedBy,
                    'posted_at' => $summary->posted_at,
                    'notes' => $summary->notes,
                    'created_at' => $summary->created_at,
                    'updated_at' => $summary->updated_at,
                    // Calculated fields
                    'full_period' => $this->getFullPeriodLabel($summary->year, $summary->month, $summary->period_type),
                    'total_deductions' => $totalDeductions,
                    'total_benefits' => $totalBenefits,
                ];
            });

            return response()->json([
            'success' => true,
            'data' => $transformedSummaries,
            'pagination' => [
                'current_page' => $summaries->currentPage(),
                'last_page' => $summaries->lastPage(),
                'per_page' => $summaries->perPage(),
                'total' => $summaries->total(),
                'from' => $summaries->firstItem(),
                'to' => $summaries->lastItem(),
            ],
            'statistics' => [
                'total_summaries' => $statistics->total_summaries ?: 0,
                'total_days_worked' => (float) ($statistics->total_days_worked ?: 0),
                'total_ot_hours' => (float) ($statistics->total_ot_hours ?: 0),
                'total_late_under_minutes' => (float) ($statistics->total_late_under_minutes ?: 0),
                'total_nsd_hours' => (float) ($statistics->total_nsd_hours ?: 0),
                'total_slvl_days' => (float) ($statistics->total_slvl_days ?: 0),
                'total_retro' => (float) ($statistics->total_retro ?: 0),
                'total_travel_order_hours' => (float) ($statistics->total_travel_order_hours ?: 0),
                'total_holiday_hours' => (float) ($statistics->total_holiday_hours ?: 0),
                'total_trip_count' => (float) ($statistics->total_trip_count ?: 0),
                'total_deductions' => (float) ($statistics->total_deductions ?: 0), // FIXED
                'total_benefits' => (float) ($statistics->total_benefits ?: 0), // FIXED
                'avg_days_worked' => (float) ($statistics->avg_days_worked ?: 0),
                'avg_ot_hours' => (float) ($statistics->avg_ot_hours ?: 0),
            ],
            'departments' => $departments,
            'filters' => [
                'year' => $year,
                'month' => $month,
                'period_type' => $periodType,
                'department' => $department,
                'status' => $status,
                'search' => $search,
            ]
        ]);

    } catch (\Exception $e) {
        Log::error('Error getting payroll summaries: ' . $e->getMessage(), [
            'filters' => $request->all(),
            'trace' => $e->getTraceAsString()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'Failed to load payroll summaries: ' . $e->getMessage()
        ], 500);
    }
}

/**
 * Add missing deduction and benefit columns to payroll_summaries table
 */
public function addMissingColumns()
{
    try {
        // Check if columns exist and add them if they don't
        $columnsToAdd = [
            // Deduction columns
            'advance' => 'decimal(10,2)->default(0)->after("has_ob")->comment("Cash advance deduction")',
            'charge_store' => 'decimal(10,2)->default(0)->after("advance")->comment("Store charge deduction")',
            'charge' => 'decimal(10,2)->default(0)->after("charge_store")->comment("General charge deduction")',
            'meals' => 'decimal(10,2)->default(0)->after("charge")->comment("Meals deduction")',
            'miscellaneous' => 'decimal(10,2)->default(0)->after("meals")->comment("Miscellaneous deduction")',
            'other_deductions' => 'decimal(10,2)->default(0)->after("miscellaneous")->comment("Other deductions")',
            
            // Benefit/Government deduction columns
            'mf_shares' => 'decimal(10,2)->default(0)->after("other_deductions")->comment("MF shares deduction")',
            'mf_loan' => 'decimal(10,2)->default(0)->after("mf_shares")->comment("MF loan deduction")',
            'sss_loan' => 'decimal(10,2)->default(0)->after("mf_loan")->comment("SSS loan deduction")',
            'hmdf_loan' => 'decimal(10,2)->default(0)->after("sss_loan")->comment("HDMF loan deduction")',
            'hmdf_prem' => 'decimal(10,2)->default(0)->after("hmdf_loan")->comment("HDMF premium deduction")',
            'sss_prem' => 'decimal(10,2)->default(0)->after("hmdf_prem")->comment("SSS premium deduction")',
            'philhealth' => 'decimal(10,2)->default(0)->after("sss_prem")->comment("PhilHealth deduction")',
            'allowances' => 'decimal(10,2)->default(0)->after("philhealth")->comment("Employee allowances")',
        ];

        foreach ($columnsToAdd as $column => $definition) {
            if (!Schema::hasColumn('payroll_summaries', $column)) {
                Schema::table('payroll_summaries', function (Blueprint $table) use ($column, $definition) {
                    // Parse the definition and add the column
                    // This is a simplified approach - you might need to adjust based on your needs
                    $table->decimal($column, 10, 2)->default(0);
                });
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Missing columns added successfully'
        ]);

    } catch (\Exception $e) {
        Log::error('Error adding missing columns: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Failed to add missing columns: ' . $e->getMessage()
        ], 500);
    }
}

    /**
     * Store a new payroll summary
     */
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'employee_id' => 'required|exists:employees,id',
                'year' => 'required|integer|min:2020|max:2030',
                'month' => 'required|integer|min:1|max:12',
                'period_type' => 'required|in:1st_half,2nd_half',
                'days_worked' => 'nullable|numeric|min:0|max:31',
                'ot_hours' => 'nullable|numeric|min:0',
                'off_days' => 'nullable|numeric|min:0',
                'late_under_minutes' => 'nullable|numeric|min:0',
                'nsd_hours' => 'nullable|numeric|min:0',
                'slvl_days' => 'nullable|numeric|min:0',
                'retro' => 'nullable|numeric',
                // Deduction validations
                'advance' => 'nullable|numeric|min:0',
                'charge_store' => 'nullable|numeric|min:0',
                'charge' => 'nullable|numeric|min:0',
                'meals' => 'nullable|numeric|min:0',
                'miscellaneous' => 'nullable|numeric|min:0',
                'other_deductions' => 'nullable|numeric|min:0',
                // Benefit validations
                'mf_shares' => 'nullable|numeric|min:0',
                'mf_loan' => 'nullable|numeric|min:0',
                'sss_loan' => 'nullable|numeric|min:0',
                'hmdf_loan' => 'nullable|numeric|min:0',
                'hmdf_prem' => 'nullable|numeric|min:0',
                'sss_prem' => 'nullable|numeric|min:0',
                'philhealth' => 'nullable|numeric|min:0',
                'allowances' => 'nullable|numeric|min:0',
                'notes' => 'nullable|string|max:1000'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Check for existing summary
            $existingSummary = PayrollSummary::where('employee_id', $request->employee_id)
                ->where('year', $request->year)
                ->where('month', $request->month)
                ->where('period_type', $request->period_type)
                ->first();

            if ($existingSummary) {
                return response()->json([
                    'success' => false,
                    'message' => 'Payroll summary already exists for this employee and period'
                ], 409);
            }

            // Get employee information
            $employee = Employee::findOrFail($request->employee_id);

            // Calculate period dates
            [$startDate, $endDate] = PayrollSummary::calculatePeriodDates(
                $request->year, 
                $request->month, 
                $request->period_type
            );

            // Create payroll summary
            $summaryData = array_merge($request->all(), [
                'employee_no' => $employee->idno,
                'employee_name' => trim($employee->Fname . ' ' . $employee->Lname),
                'cost_center' => $employee->CostCenter,
                'department' => $employee->Department,
                'line' => $employee->Line,
                'period_start' => $startDate,
                'period_end' => $endDate,
                'status' => 'draft'
            ]);

            $summary = PayrollSummary::create($summaryData);

            Log::info('Payroll summary created', [
                'summary_id' => $summary->id,
                'employee_id' => $summary->employee_id,
                'period' => $summary->full_period,
                'created_by' => auth()->id()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Payroll summary created successfully',
                'data' => $summary->fresh(['employee', 'postedBy'])
            ]);

        } catch (\Exception $e) {
            Log::error('Error creating payroll summary: ' . $e->getMessage(), [
                'request_data' => $request->all(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to create payroll summary: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update payroll summary
     */
    public function update(Request $request, $id)
    {
        try {
            $summary = PayrollSummary::findOrFail($id);

            // Check if summary can be updated
            if ($summary->status === 'locked') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot update a locked payroll summary'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'days_worked' => 'nullable|numeric|min:0|max:31',
                'ot_hours' => 'nullable|numeric|min:0',
                'off_days' => 'nullable|numeric|min:0',
                'late_under_minutes' => 'nullable|numeric|min:0',
                'nsd_hours' => 'nullable|numeric|min:0',
                'slvl_days' => 'nullable|numeric|min:0',
                'retro' => 'nullable|numeric',
                // Deduction validations
                'advance' => 'nullable|numeric|min:0',
                'charge_store' => 'nullable|numeric|min:0',
                'charge' => 'nullable|numeric|min:0',
                'meals' => 'nullable|numeric|min:0',
                'miscellaneous' => 'nullable|numeric|min:0',
                'other_deductions' => 'nullable|numeric|min:0',
                // Benefit validations
                'mf_shares' => 'nullable|numeric|min:0',
                'mf_loan' => 'nullable|numeric|min:0',
                'sss_loan' => 'nullable|numeric|min:0',
                'hmdf_loan' => 'nullable|numeric|min:0',
                'hmdf_prem' => 'nullable|numeric|min:0',
                'sss_prem' => 'nullable|numeric|min:0',
                'philhealth' => 'nullable|numeric|min:0',
                'allowances' => 'nullable|numeric|min:0',
                'notes' => 'nullable|string|max:1000'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $summary->update($request->all());

            Log::info('Payroll summary updated', [
                'summary_id' => $summary->id,
                'employee_id' => $summary->employee_id,
                'updated_by' => auth()->id()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Payroll summary updated successfully',
                'data' => $summary->fresh(['employee', 'postedBy'])
            ]);

        } catch (\Exception $e) {
            Log::error('Error updating payroll summary: ' . $e->getMessage(), [
                'summary_id' => $id,
                'request_data' => $request->all(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update payroll summary: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete payroll summary
     */
    public function destroy($id)
    {
        try {
            $summary = PayrollSummary::findOrFail($id);

            // Check if summary can be deleted
            if ($summary->status === 'locked') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete a locked payroll summary'
                ], 403);
            }

            // If posted, revert related attendance records
            if ($summary->status === 'posted') {
                $this->revertAttendanceRecords($summary);
            }

            $summary->delete();

            Log::info('Payroll summary deleted', [
                'summary_id' => $id,
                'employee_id' => $summary->employee_id,
                'deleted_by' => auth()->id()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Payroll summary deleted successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error deleting payroll summary: ' . $e->getMessage(), [
                'summary_id' => $id,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete payroll summary: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk generate payroll summaries from attendance data
     */
    public function bulkGenerate(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'year' => 'required|integer|min:2020|max:2030',
                'month' => 'required|integer|min:1|max:12',
                'period_type' => 'required|in:1st_half,2nd_half',
                'department' => 'nullable|string',
                'employee_ids' => 'nullable|array',
                'employee_ids.*' => 'integer|exists:employees,id',
                'include_benefits' => 'boolean',
                'include_deductions' => 'boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $year = $request->input('year');
            $month = $request->input('month');
            $periodType = $request->input('period_type');
            $department = $request->input('department');
            $employeeIds = $request->input('employee_ids', []);
            $includeBenefits = $request->boolean('include_benefits', true);
            $includeDeductions = $request->boolean('include_deductions', true);

            // Calculate period dates
            [$startDate, $endDate] = PayrollSummary::calculatePeriodDates($year, $month, $periodType);

            // Build employee query
            $employeeQuery = Employee::query();
            
            if ($department) {
                $employeeQuery->where('Department', $department);
            }
            
            if (!empty($employeeIds)) {
                $employeeQuery->whereIn('id', $employeeIds);
            }
            
            $employees = $employeeQuery->get();

            DB::beginTransaction();

            try {
                $generatedCount = 0;
                $skippedCount = 0;
                $errors = [];

                foreach ($employees as $employee) {
                    try {
                        // Check if summary already exists
                        $existingSummary = PayrollSummary::where('employee_id', $employee->id)
                            ->where('year', $year)
                            ->where('month', $month)
                            ->where('period_type', $periodType)
                            ->first();

                        if ($existingSummary) {
                            $skippedCount++;
                            continue;
                        }

                        // Generate summary from attendance data
                        $summaryData = PayrollSummary::generateFromAttendance($employee->id, $year, $month, $periodType);

                        // Include benefits if requested
                        if ($includeBenefits) {
                            $benefits = $this->getBenefitsForEmployee($employee->id, $year, $month, $periodType);
                            $summaryData = array_merge($summaryData, $benefits);
                        }

                        // Include deductions if requested
                        if ($includeDeductions) {
                            $deductions = $this->getDeductionsForEmployee($employee->id, $year, $month, $periodType);
                            $summaryData = array_merge($summaryData, $deductions);
                        }

                        $summaryData['status'] = 'draft';
                        
                        PayrollSummary::create($summaryData);
                        $generatedCount++;

                    } catch (\Exception $e) {
                        $errors[] = "Employee {$employee->idno}: " . $e->getMessage();
                        Log::error("Error generating summary for employee {$employee->id}", [
                            'error' => $e->getMessage(),
                            'employee_id' => $employee->id
                        ]);
                    }
                }

                DB::commit();

                $message = "Generated {$generatedCount} payroll summaries";
                if ($skippedCount > 0) {
                    $message .= ", skipped {$skippedCount} existing summaries";
                }
                if (!empty($errors)) {
                    $message .= ", " . count($errors) . " errors occurred";
                }

                Log::info('Bulk payroll summary generation completed', [
                    'generated_count' => $generatedCount,
                    'skipped_count' => $skippedCount,
                    'error_count' => count($errors),
                    'initiated_by' => auth()->id()
                ]);

                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'generated_count' => $generatedCount,
                    'skipped_count' => $skippedCount,
                    'errors' => array_slice($errors, 0, 10) // Limit errors shown
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Error in bulk payroll summary generation: ' . $e->getMessage(), [
                'request_data' => $request->all(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Bulk generation failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export payroll summaries to CSV
     */
    public function export(Request $request)
    {
        try {
            $year = $request->input('year', now()->year);
            $month = $request->input('month', now()->month);
            $periodType = $request->input('period_type');
            $department = $request->input('department');
            $status = $request->input('status');
            $search = $request->input('search');

            // Build the query (same as list but without pagination)
            $query = PayrollSummary::query()
                ->with(['employee:id,idno,Fname,Lname,Department,Line,CostCenter', 'postedBy:id,name'])
                ->where('year', $year)
                ->where('month', $month);

            // Apply filters
            if ($periodType) {
                $query->where('period_type', $periodType);
            }

            if ($department) {
                $query->where('department', $department);
            }

            if ($status) {
                $query->where('status', $status);
            }

            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('employee_name', 'LIKE', "%{$search}%")
                      ->orWhere('employee_no', 'LIKE', "%{$search}%")
                      ->orWhere('department', 'LIKE', "%{$search}%")
                      ->orWhere('line', 'LIKE', "%{$search}%")
                      ->orWhere('cost_center', 'LIKE', "%{$search}%");
                });
            }

            $summaries = $query->orderBy('cost_center', 'asc')
                              ->orderBy('employee_name', 'asc')
                              ->get();

            // Generate CSV content
            $csvData = [];

            // Add company header
            $csvData[] = ['ELJIN CORP - BWSUPERBAKESHOP | COMPREHENSIVE PAYROLL SUMMARIES', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
            $csvData[] = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];

            // Add period information
            $periodLabel = $this->getFullPeriodLabel($year, $month, $periodType);
            $csvData[] = ['Period', $periodLabel, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
            $csvData[] = ['Generated At', now()->format('Y-m-d H:i:s'), '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
            $csvData[] = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];

            // Add comprehensive header row
            $csvData[] = [
                'Cost Center',
                'Employee ID',
                'Employee Name',
                'Department',
                'Line',
                'Days Worked',
                'OT Hours',
                'Off Days',
                'Late/Under Minutes',
                'Late/Under Hours',
                'NSD Hours',
                'SLVL Days',
                'Retro',
                'Travel Order Hours',
                'Holiday Hours',
                'OT Regular Holiday',
                'OT Special Holiday',
                'Offset Hours',
                'Trip Count',
                'Advance',
                'Charge Store',
                'Charge',
                'Meals',
                'Miscellaneous',
                'Other Deductions',
                'MF Shares',
                'MF Loan',
                'SSS Loan',
                'HMDF Loan',
                'HMDF Premium',
                'SSS Premium',
                'PhilHealth',
                'Allowances',
                'Total Deductions',
                'Total Benefits',
                'Status'
            ];

            // Group data by cost center
            $groupedData = $summaries->groupBy('cost_center');

            // Initialize grand totals
            $grandTotals = [
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
                'advance' => 0,
                'charge_store' => 0,
                'charge' => 0,
                'meals' => 0,
                'miscellaneous' => 0,
                'other_deductions' => 0,
                'mf_shares' => 0,
                'mf_loan' => 0,
                'sss_loan' => 0,
                'hmdf_loan' => 0,
                'hmdf_prem' => 0,
                'sss_prem' => 0,
                'philhealth' => 0,
                'allowances' => 0,
                'total_deductions' => 0,
                'total_benefits' => 0
            ];

            // Add data rows grouped by cost center
            foreach ($groupedData as $costCenter => $costCenterSummaries) {
                foreach ($costCenterSummaries as $summary) {
                    $totalDeductions = $summary->total_deductions;
                    $totalBenefits = $summary->total_benefits;

                    $csvData[] = [
                        $costCenter ?: 'N/A',
                        $summary->employee_no,
                        $summary->employee_name,
                        $summary->department,
                        $summary->line,
                        $this->formatNumber($summary->days_worked, 1),
                        $this->formatNumber($summary->ot_hours, 2),
                        $this->formatNumber($summary->off_days, 1),
                        $this->formatNumber($summary->late_under_minutes, 0),
                        $this->formatNumber($summary->late_under_minutes / 60, 2),
                        $this->formatNumber($summary->nsd_hours, 2),
                        $this->formatNumber($summary->slvl_days, 1),
                        $this->formatNumber($summary->retro, 2),
                        $this->formatNumber($summary->travel_order_hours, 2),
                        $this->formatNumber($summary->holiday_hours, 2),
                        $this->formatNumber($summary->ot_reg_holiday_hours, 2),
                        $this->formatNumber($summary->ot_special_holiday_hours, 2),
                        $this->formatNumber($summary->offset_hours, 2),
                        $this->formatNumber($summary->trip_count, 1),
                        $this->formatNumber($summary->advance, 2),
                        $this->formatNumber($summary->charge_store, 2),
                        $this->formatNumber($summary->charge, 2),
                        $this->formatNumber($summary->meals, 2),
                        $this->formatNumber($summary->miscellaneous, 2),
                        $this->formatNumber($summary->other_deductions, 2),
                        $this->formatNumber($summary->mf_shares, 2),
                        $this->formatNumber($summary->mf_loan, 2),
                        $this->formatNumber($summary->sss_loan, 2),
                        $this->formatNumber($summary->hmdf_loan, 2),
                        $this->formatNumber($summary->hmdf_prem, 2),
                        $this->formatNumber($summary->sss_prem, 2),
                        $this->formatNumber($summary->philhealth, 2),
                        $this->formatNumber($summary->allowances, 2),
                        $this->formatNumber($totalDeductions, 2),
                        $this->formatNumber($totalBenefits, 2),
                        ucfirst($summary->status)
                    ];

                    // Add to grand totals
                    $grandTotals['days_worked'] += $summary->days_worked;
                    $grandTotals['ot_hours'] += $summary->ot_hours;
                    $grandTotals['off_days'] += $summary->off_days;
                    $grandTotals['late_under_minutes'] += $summary->late_under_minutes;
                    $grandTotals['nsd_hours'] += $summary->nsd_hours;
                    $grandTotals['slvl_days'] += $summary->slvl_days;
                    $grandTotals['retro'] += $summary->retro;
                    $grandTotals['travel_order_hours'] += $summary->travel_order_hours;
                    $grandTotals['holiday_hours'] += $summary->holiday_hours;
                    $grandTotals['ot_reg_holiday_hours'] += $summary->ot_reg_holiday_hours;
                    $grandTotals['ot_special_holiday_hours'] += $summary->ot_special_holiday_hours;
                    $grandTotals['offset_hours'] += $summary->offset_hours;
                    $grandTotals['trip_count'] += $summary->trip_count;
                    $grandTotals['advance'] += $summary->advance;
                    $grandTotals['charge_store'] += $summary->charge_store;
                    $grandTotals['charge'] += $summary->charge;
                    $grandTotals['meals'] += $summary->meals;
                    $grandTotals['miscellaneous'] += $summary->miscellaneous;
                    $grandTotals['other_deductions'] += $summary->other_deductions;
                    $grandTotals['mf_shares'] += $summary->mf_shares;
                    $grandTotals['mf_loan'] += $summary->mf_loan;
                    $grandTotals['sss_loan'] += $summary->sss_loan;
                    $grandTotals['hmdf_loan'] += $summary->hmdf_loan;
                    $grandTotals['hmdf_prem'] += $summary->hmdf_prem;
                    $grandTotals['sss_prem'] += $summary->sss_prem;
                    $grandTotals['philhealth'] += $summary->philhealth;
                    $grandTotals['allowances'] += $summary->allowances;
                    $grandTotals['total_deductions'] += $totalDeductions;
                    $grandTotals['total_benefits'] += $totalBenefits;
                }
            }

            // Add grand total row
            $csvData[] = [
                'GRAND TOTAL',
                '',
                "({$summaries->count()} employees)",
                '',
                '',
                $this->formatNumber($grandTotals['days_worked'], 1),
                $this->formatNumber($grandTotals['ot_hours'], 2),
                $this->formatNumber($grandTotals['off_days'], 1),
                $this->formatNumber($grandTotals['late_under_minutes'], 0),
                $this->formatNumber($grandTotals['late_under_minutes'] / 60, 2),
                $this->formatNumber($grandTotals['nsd_hours'], 2),
                $this->formatNumber($grandTotals['slvl_days'], 1),
                $this->formatNumber($grandTotals['retro'], 2),
                $this->formatNumber($grandTotals['travel_order_hours'], 2),
                $this->formatNumber($grandTotals['holiday_hours'], 2),
                $this->formatNumber($grandTotals['ot_reg_holiday_hours'], 2),
                $this->formatNumber($grandTotals['ot_special_holiday_hours'], 2),
                $this->formatNumber($grandTotals['offset_hours'], 2),
                $this->formatNumber($grandTotals['trip_count'], 1),
                $this->formatNumber($grandTotals['advance'], 2),
                $this->formatNumber($grandTotals['charge_store'], 2),
                $this->formatNumber($grandTotals['charge'], 2),
                $this->formatNumber($grandTotals['meals'], 2),
                $this->formatNumber($grandTotals['miscellaneous'], 2),
                $this->formatNumber($grandTotals['other_deductions'], 2),
                $this->formatNumber($grandTotals['mf_shares'], 2),
                $this->formatNumber($grandTotals['mf_loan'], 2),
                $this->formatNumber($grandTotals['sss_loan'], 2),
                $this->formatNumber($grandTotals['hmdf_loan'], 2),
                $this->formatNumber($grandTotals['hmdf_prem'], 2),
                $this->formatNumber($grandTotals['sss_prem'], 2),
                $this->formatNumber($grandTotals['philhealth'], 2),
                $this->formatNumber($grandTotals['allowances'], 2),
                $this->formatNumber($grandTotals['total_deductions'], 2),
                $this->formatNumber($grandTotals['total_benefits'], 2),
                ''
            ];

            // Generate CSV content
            $csvContent = '';
            foreach ($csvData as $row) {
                $csvContent .= implode(',', array_map(function($cell) {
                    if ($cell === '' || (!str_contains($cell, ',') && !str_contains($cell, '"') && !str_contains($cell, "\n"))) {
                        return $cell;
                    }
                    return '"' . str_replace('"', '""', $cell) . '"';
                }, $row)) . "\r\n";
            }

            // Generate filename
            $filename = 'comprehensive_payroll_summaries_' . $year . '_' . $month;
            if ($periodType) {
                $filename .= '_' . $periodType;
            }
            if ($department) {
                $filename .= '_' . str_replace(' ', '_', strtolower($department));
            }
            $filename .= '_' . now()->format('Ymd') . '.csv';

            return response($csvContent)
                ->header('Content-Type', 'text/csv; charset=utf-8')
                ->header('Content-Disposition', 'attachment; filename="' . $filename . '"')
                ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
                ->header('Pragma', 'no-cache')
                ->header('Expires', '0');

        } catch (\Exception $e) {
            Log::error('Error exporting payroll summaries: ' . $e->getMessage(), [
                'filters' => $request->all(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to export payroll summaries: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available departments
     */
    public function getDepartments()
    {
        try {
            $departments = Department::select('name')
                ->where('is_active', true)
                ->orderBy('name')
                ->pluck('name');

            return response()->json([
                'success' => true,
                'data' => $departments
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching departments: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch departments: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get benefits for employee
     */
    private function getBenefitsForEmployee($employeeId, $year, $month, $periodType)
    {
        $benefits = [
            'mf_shares' => 0,
            'allowances' => 0
        ];

        try {
            $benefitRecords = Benefit::where('employee_id', $employeeId)
                ->where('year', $year)
                ->where('month', $month)
                ->where('period_type', $periodType)
                ->where('posting_status', 'posted')
                ->get();

            foreach ($benefitRecords as $benefit) {
                $benefits['mf_shares'] += $benefit->mf_shares ?? 0;
                $benefits['allowances'] += $benefit->allowances ?? 0;
            }
        } catch (\Exception $e) {
            Log::warning("Could not fetch benefits for employee {$employeeId}: " . $e->getMessage());
        }

        return $benefits;
    }

    /**
     * Get deductions for employee
     */
    private function getDeductionsForEmployee($employeeId, $year, $month, $periodType)
    {
        $deductions = [
            'advance' => 0,
            'charge_store' => 0,
            'charge' => 0,
            'meals' => 0,
            'miscellaneous' => 0,
            'other_deductions' => 0,
            'mf_loan' => 0,
            'sss_loan' => 0,
            'hmdf_loan' => 0,
            'hmdf_prem' => 0,
            'sss_prem' => 0,
            'philhealth' => 0
        ];

        try {
            $deductionRecords = Deduction::where('employee_id', $employeeId)
                ->where('year', $year)
                ->where('month', $month)
                ->where('period_type', $periodType)
                ->where('posting_status', 'posted')
                ->get();

            foreach ($deductionRecords as $deduction) {
                $deductions['advance'] += $deduction->advance ?? 0;
                $deductions['charge_store'] += $deduction->charge_store ?? 0;
                $deductions['charge'] += $deduction->charge ?? 0;
                $deductions['meals'] += $deduction->meals ?? 0;
                $deductions['miscellaneous'] += $deduction->miscellaneous ?? 0;
                $deductions['other_deductions'] += $deduction->other_deductions ?? 0;
                $deductions['mf_loan'] += $deduction->mf_loan ?? 0;
                $deductions['sss_loan'] += $deduction->sss_loan ?? 0;
                $deductions['hmdf_loan'] += $deduction->hmdf_loan ?? 0;
                $deductions['hmdf_prem'] += $deduction->hmdf_prem ?? 0;
                $deductions['sss_prem'] += $deduction->sss_prem ?? 0;
                $deductions['philhealth'] += $deduction->philhealth ?? 0;
            }
        } catch (\Exception $e) {
            Log::warning("Could not fetch deductions for employee {$employeeId}: " . $e->getMessage());
        }

        return $deductions;
    }

    /**
     * Revert attendance records when summary is deleted
     */
    private function revertAttendanceRecords(PayrollSummary $summary)
    {
        try {
            [$startDate, $endDate] = PayrollSummary::calculatePeriodDates(
                $summary->year, 
                $summary->month, 
                $summary->period_type
            );

            $revertedCount = ProcessedAttendance::where('employee_id', $summary->employee_id)
                ->whereBetween('attendance_date', [$startDate, $endDate])
                ->where('posting_status', 'posted')
                ->update([
                    'posting_status' => 'not_posted',
                    'posted_at' => null,
                    'posted_by' => null,
                    'updated_at' => now()
                ]);

            Log::info("Reverted {$revertedCount} attendance records for payroll summary {$summary->id}");

        } catch (\Exception $e) {
            Log::error("Error reverting attendance records for summary {$summary->id}: " . $e->getMessage());
        }
    }

    /**
     * Helper method to format numbers consistently
     */
    private function formatNumber($value, $decimals = 2)
    {
        if ($value == 0) {
            return $decimals > 0 ? '0' : '0';
        }
        return number_format($value, $decimals, '.', '');
    }

    /**
     * Update payroll summary status
     */
    public function updateStatus(Request $request, $id)
    {
        try {
            $validator = Validator::make($request->all(), [
                'status' => 'required|in:draft,posted,locked',
                'notes' => 'nullable|string|max:1000'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $summary = PayrollSummary::findOrFail($id);
            $newStatus = $request->input('status');
            $notes = $request->input('notes');

            // Status transition validation
            if ($summary->status === 'locked' && $newStatus !== 'locked') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot change status of a locked payroll summary'
                ], 403);
            }

            $oldStatus = $summary->status;
            
            // Update status
            $summary->status = $newStatus;
            
            if ($notes) {
                $summary->notes = $notes;
            }

            // Set posted information when changing to posted
            if ($newStatus === 'posted' && $oldStatus !== 'posted') {
                $summary->posted_by = auth()->id();
                $summary->posted_at = now();
            }

            // Clear posted information when changing from posted to draft
            if ($newStatus === 'draft' && $oldStatus === 'posted') {
                $summary->posted_by = null;
                $summary->posted_at = null;
            }

            $summary->save();

            Log::info('Payroll summary status updated', [
                'summary_id' => $summary->id,
                'employee_id' => $summary->employee_id,
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                'updated_by' => auth()->id()
            ]);

            return response()->json([
                'success' => true,
                'message' => "Payroll summary status updated to {$newStatus}",
                'data' => $summary->fresh(['employee', 'postedBy'])
            ]);

        } catch (\Exception $e) {
            Log::error('Error updating payroll summary status: ' . $e->getMessage(), [
                'summary_id' => $id,
                'request_data' => $request->all(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk update status for multiple payroll summaries
     */
    public function bulkUpdateStatus(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'summary_ids' => 'required|array|min:1',
                'summary_ids.*' => 'integer|exists:payroll_summaries,id',
                'status' => 'required|in:draft,posted,locked',
                'notes' => 'nullable|string|max:1000'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $summaryIds = $request->input('summary_ids');
            $newStatus = $request->input('status');
            $notes = $request->input('notes');

            DB::beginTransaction();

            try {
                $updatedCount = 0;
                $skippedCount = 0;
                $errors = [];

                foreach ($summaryIds as $summaryId) {
                    try {
                        $summary = PayrollSummary::findOrFail($summaryId);

                        // Skip locked summaries unless we're setting to locked
                        if ($summary->status === 'locked' && $newStatus !== 'locked') {
                            $skippedCount++;
                            continue;
                        }

                        $oldStatus = $summary->status;
                        $summary->status = $newStatus;

                        if ($notes) {
                            $summary->notes = $notes;
                        }

                        // Set posted information when changing to posted
                        if ($newStatus === 'posted' && $oldStatus !== 'posted') {
                            $summary->posted_by = auth()->id();
                            $summary->posted_at = now();
                        }

                        // Clear posted information when changing from posted to draft
                        if ($newStatus === 'draft' && $oldStatus === 'posted') {
                            $summary->posted_by = null;
                            $summary->posted_at = null;
                        }

                        $summary->save();
                        $updatedCount++;

                    } catch (\Exception $e) {
                        $errors[] = "Summary ID {$summaryId}: " . $e->getMessage();
                        Log::error("Error updating summary {$summaryId}", [
                            'error' => $e->getMessage(),
                            'summary_id' => $summaryId
                        ]);
                    }
                }

                DB::commit();

                $message = "Updated {$updatedCount} payroll summaries to {$newStatus} status";
                if ($skippedCount > 0) {
                    $message .= ", skipped {$skippedCount} locked summaries";
                }
                if (!empty($errors)) {
                    $message .= ", " . count($errors) . " errors occurred";
                }

                Log::info('Bulk payroll summary status update completed', [
                    'updated_count' => $updatedCount,
                    'skipped_count' => $skippedCount,
                    'error_count' => count($errors),
                    'new_status' => $newStatus,
                    'initiated_by' => auth()->id()
                ]);

                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'updated_count' => $updatedCount,
                    'skipped_count' => $skippedCount,
                    'errors' => array_slice($errors, 0, 10)
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Error in bulk status update: ' . $e->getMessage(), [
                'request_data' => $request->all(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Bulk status update failed: ' . $e->getMessage()
            ], 500);
        }
    }
}