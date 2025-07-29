<?php

namespace App\Http\Controllers;

use App\Models\FinalPayroll;
use App\Models\PayrollSummary;
use App\Models\Employee;
use App\Models\Benefit;
use App\Models\Deduction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Carbon\Carbon;
use Inertia\Inertia;

class FinalPayrollController extends Controller
{
    public function getFullPeriodAttribute()
{
    $monthName = Carbon::create($this->year, $this->month, 1)->format('F Y');
    $periodLabel = $this->period_type === '1st_half' ? '(1-15)' : '(16-30/31)';
    
    return "{$monthName} {$periodLabel}";
}

    /**
     * Display a listing of final payrolls.
     */
    public function index(Request $request)
{
    try {
        $year = $request->input('year', now()->year);
        $month = $request->input('month', now()->month);
        $periodType = $request->input('period_type');
        $department = $request->input('department');
        $status = $request->input('status');
        $approvalStatus = $request->input('approval_status');
        $search = $request->input('search');
        $perPage = $request->input('per_page', 25);

        $query = FinalPayroll::with(['employee', 'creator', 'approver', 'finalizer'])
            ->forPeriod($year, $month, $periodType);

        // Apply filters
        if ($department) {
            $query->forDepartment($department);
        }

        if ($status) {
            $query->where('status', $status);
        }

        if ($approvalStatus) {
            $query->where('approval_status', $approvalStatus);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('employee_name', 'like', "%{$search}%")
                    ->orWhere('employee_no', 'like', "%{$search}%");
            });
        }

        // Get statistics BEFORE paginating
        $statistics = FinalPayroll::getPeriodStatistics($year, $month, $periodType, $department);

        // Get departments for filter
        $departments = FinalPayroll::forPeriod($year, $month)
            ->distinct()
            ->pluck('department')
            ->filter()
            ->sort()
            ->values();

        // Get paginated results
        $finalPayrolls = $query->orderBy('department')
            ->orderBy('employee_name')
            ->paginate($perPage);

        $transformedPayrolls = $finalPayrolls->getCollection()->map(function ($payroll) {
            $payroll->full_period = $payroll->getFullPeriodAttribute();
            return $payroll;
        });

        $finalPayrolls->setCollection($transformedPayrolls);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'data' => $finalPayrolls->items(),
                'pagination' => [
                    'current_page' => $finalPayrolls->currentPage(),
                    'last_page' => $finalPayrolls->lastPage(),
                    'per_page' => $finalPayrolls->perPage(),
                    'total' => $finalPayrolls->total(),
                ],
                'statistics' => $statistics,
                'departments' => $departments
            ]);
        }

        return Inertia::render('Payroll/FinalPayroll', [
            'auth' => ['user' => auth()->user()],
            'finalPayrolls' => $finalPayrolls,
            'statistics' => $statistics,
            'departments' => $departments,
            'filters' => [
                'year' => $year,
                'month' => $month,
                'period_type' => $periodType,
                'department' => $department,
                'status' => $status,
                'approval_status' => $approvalStatus,
                'search' => $search
            ]
        ]);

    } catch (\Exception $e) {
        Log::error('Error loading final payrolls: ' . $e->getMessage());
        
        if ($request->wantsJson()) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to load final payrolls'
            ], 500);
        }

        return back()->withErrors(['error' => 'Failed to load final payrolls']);
    }
}

    /**
     * Show a specific final payroll.
     */
    public function show($id)
    {
        try {
            $finalPayroll = FinalPayroll::with([
                'employee', 
                'creator', 
                'approver', 
                'finalizer', 
                'paidBy',
                'payrollSummary',
                'benefit',
                'deduction'
            ])->findOrFail($id);

            // Generate calculation breakdown if not exists
            if (!$finalPayroll->calculation_breakdown) {
                $finalPayroll->generateCalculationBreakdown();
            }

            return response()->json([
                'success' => true,
                'data' => $finalPayroll
            ]);

        } catch (\Exception $e) {
            Log::error('Error loading final payroll: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Final payroll not found'
            ], 404);
        }
    }

    /**
     * Update a final payroll.
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'basic_rate' => 'nullable|numeric|min:0',
            'pay_allowance' => 'nullable|numeric|min:0',
            'other_earnings' => 'nullable|numeric|min:0',
            'advance_deduction' => 'nullable|numeric|min:0',
            'charge_store' => 'nullable|numeric|min:0',
            'charge_deduction' => 'nullable|numeric|min:0',
            'meals_deduction' => 'nullable|numeric|min:0',
            'miscellaneous_deduction' => 'nullable|numeric|min:0',
            'other_deductions' => 'nullable|numeric|min:0',
            'calculation_notes' => 'nullable|string|max:1000'
        ]);

        try {
            $finalPayroll = FinalPayroll::findOrFail($id);

            // Check if editable
            if (!$finalPayroll->isEditable()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This payroll cannot be edited in its current status'
                ], 422);
            }

            DB::beginTransaction();

            // Update fields
            $finalPayroll->fill($request->only([
                'basic_rate',
                'pay_allowance', 
                'other_earnings',
                'advance_deduction',
                'charge_store',
                'charge_deduction',
                'meals_deduction',
                'miscellaneous_deduction',
                'other_deductions',
                'calculation_notes'
            ]));

            // Mark as having adjustments if any manual changes
            $finalPayroll->has_adjustments = true;
            $finalPayroll->save();

            // Recalculate payroll
            $finalPayroll->calculatePayroll();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Final payroll updated successfully',
                'data' => $finalPayroll->fresh()
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error updating final payroll: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to update final payroll'
            ], 500);
        }
    }

    /**
     * Approve final payroll.
     */
    public function approve(Request $request, $id)
    {
        $request->validate([
            'approval_remarks' => 'nullable|string|max:500'
        ]);

        try {
            $finalPayroll = FinalPayroll::findOrFail($id);

            if (!$finalPayroll->canBeApproved()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This payroll cannot be approved in its current status'
                ], 422);
            }

            $finalPayroll->markAsApproved(auth()->id(), $request->approval_remarks);

            return response()->json([
                'success' => true,
                'message' => 'Final payroll approved successfully',
                'data' => $finalPayroll->fresh()
            ]);

        } catch (\Exception $e) {
            Log::error('Error approving final payroll: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to approve final payroll'
            ], 500);
        }
    }

    /**
     * Reject final payroll.
     */
    public function reject(Request $request, $id)
    {
        $request->validate([
            'approval_remarks' => 'required|string|max:500'
        ]);

        try {
            $finalPayroll = FinalPayroll::findOrFail($id);

            if (!$finalPayroll->canBeApproved()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This payroll cannot be rejected in its current status'
                ], 422);
            }

            $finalPayroll->markAsRejected(auth()->id(), $request->approval_remarks);

            return response()->json([
                'success' => true,
                'message' => 'Final payroll rejected successfully',
                'data' => $finalPayroll->fresh()
            ]);

        } catch (\Exception $e) {
            Log::error('Error rejecting final payroll: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to reject final payroll'
            ], 500);
        }
    }

    /**
     * Finalize final payroll.
     */
    public function finalize($id)
    {
        try {
            $finalPayroll = FinalPayroll::findOrFail($id);

            if (!$finalPayroll->canBeFinalized()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This payroll cannot be finalized in its current status'
                ], 422);
            }

            $finalPayroll->markAsFinalized(auth()->id());

            return response()->json([
                'success' => true,
                'message' => 'Final payroll finalized successfully',
                'data' => $finalPayroll->fresh()
            ]);

        } catch (\Exception $e) {
            Log::error('Error finalizing final payroll: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to finalize final payroll'
            ], 500);
        }
    }

    /**
     * Mark final payroll as paid.
     */
    public function markAsPaid($id)
    {
        try {
            $finalPayroll = FinalPayroll::findOrFail($id);

            if (!$finalPayroll->canBeMarkedAsPaid()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This payroll cannot be marked as paid in its current status'
                ], 422);
            }

            $finalPayroll->markAsPaid(auth()->id());

            return response()->json([
                'success' => true,
                'message' => 'Final payroll marked as paid successfully',
                'data' => $finalPayroll->fresh()
            ]);

        } catch (\Exception $e) {
            Log::error('Error marking final payroll as paid: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to mark final payroll as paid'
            ], 500);
        }
    }

    /**
     * Bulk approve final payrolls.
     */
    public function bulkApprove(Request $request)
    {
        $request->validate([
            'payroll_ids' => 'required|array|min:1',
            'payroll_ids.*' => 'integer|exists:final_payrolls,id',
            'approval_remarks' => 'nullable|string|max:500'
        ]);

        try {
            DB::beginTransaction();

            $approved = 0;
            $skipped = 0;
            $errors = [];

            foreach ($request->payroll_ids as $id) {
                try {
                    $finalPayroll = FinalPayroll::findOrFail($id);

                    if ($finalPayroll->canBeApproved()) {
                        $finalPayroll->markAsApproved(auth()->id(), $request->approval_remarks);
                        $approved++;
                    } else {
                        $skipped++;
                    }
                } catch (\Exception $e) {
                    $errors[] = "Error approving payroll ID {$id}: " . $e->getMessage();
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Approved {$approved} payrolls, skipped {$skipped}",
                'data' => [
                    'approved' => $approved,
                    'skipped' => $skipped,
                    'errors' => $errors
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error bulk approving final payrolls: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to bulk approve final payrolls'
            ], 500);
        }
    }

    /**
     * Bulk finalize final payrolls.
     */
    public function bulkFinalize(Request $request)
    {
        $request->validate([
            'payroll_ids' => 'required|array|min:1',
            'payroll_ids.*' => 'integer|exists:final_payrolls,id'
        ]);

        try {
            DB::beginTransaction();

            $finalized = 0;
            $skipped = 0;
            $errors = [];

            foreach ($request->payroll_ids as $id) {
                try {
                    $finalPayroll = FinalPayroll::findOrFail($id);

                    if ($finalPayroll->canBeFinalized()) {
                        $finalPayroll->markAsFinalized(auth()->id());
                        $finalized++;
                    } else {
                        $skipped++;
                    }
                } catch (\Exception $e) {
                    $errors[] = "Error finalizing payroll ID {$id}: " . $e->getMessage();
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Finalized {$finalized} payrolls, skipped {$skipped}",
                'data' => [
                    'finalized' => $finalized,
                    'skipped' => $skipped,
                    'errors' => $errors
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error bulk finalizing final payrolls: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to bulk finalize final payrolls'
            ], 500);
        }
    }

    /**
     * Bulk mark as paid.
     */
    public function bulkMarkAsPaid(Request $request)
    {
        $request->validate([
            'payroll_ids' => 'required|array|min:1',
            'payroll_ids.*' => 'integer|exists:final_payrolls,id'
        ]);

        try {
            DB::beginTransaction();

            $paid = 0;
            $skipped = 0;
            $errors = [];

            foreach ($request->payroll_ids as $id) {
                try {
                    $finalPayroll = FinalPayroll::findOrFail($id);

                    if ($finalPayroll->canBeMarkedAsPaid()) {
                        $finalPayroll->markAsPaid(auth()->id());
                        $paid++;
                    } else {
                        $skipped++;
                    }
                } catch (\Exception $e) {
                    $errors[] = "Error marking payroll ID {$id} as paid: " . $e->getMessage();
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Marked {$paid} payrolls as paid, skipped {$skipped}",
                'data' => [
                    'paid' => $paid,
                    'skipped' => $skipped,
                    'errors' => $errors
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error bulk marking final payrolls as paid: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to bulk mark final payrolls as paid'
            ], 500);
        }
    }

    /**
     * Delete a final payroll.
     */
    public function destroy($id)
    {
        try {
            $finalPayroll = FinalPayroll::findOrFail($id);

            // Only allow deletion of draft payrolls
            if ($finalPayroll->status !== 'draft') {
                return response()->json([
                    'success' => false,
                    'message' => 'Only draft payrolls can be deleted'
                ], 422);
            }

            $finalPayroll->delete();

            return response()->json([
                'success' => true,
                'message' => 'Final payroll deleted successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Error deleting final payroll: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete final payroll'
            ], 500);
        }
    }

    /**
     * Export final payrolls.
     */
    public function export(Request $request)
    {
        $request->validate([
            'year' => 'required|integer|min:2020|max:2030',
            'month' => 'required|integer|min:1|max:12',
            'period_type' => 'nullable|in:1st_half,2nd_half',
            'department' => 'nullable|string',
            'status' => 'nullable|in:draft,finalized,paid',
            'format' => 'nullable|in:csv,excel'
        ]);

        try {
            $year = $request->year;
            $month = $request->month;
            $periodType = $request->period_type;
            $department = $request->department;
            $format = $request->format ?? 'csv';

            // Get export data
            $exportData = FinalPayroll::exportToArray($year, $month, $periodType, $department);

            if (empty($exportData)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No data found for export'
                ], 404);
            }

            // Generate filename
            $periodLabel = $periodType === '1st_half' ? '1st_half' : 
                          ($periodType === '2nd_half' ? '2nd_half' : 'full_month');
            $filename = "final_payroll_{$year}_{$month}_{$periodLabel}_" . date('Y-m-d');

            if ($format === 'excel') {
                // For Excel export, you might want to use a package like PhpSpreadsheet
                return $this->exportToExcel($exportData, $filename);
            } else {
                // CSV export
                return $this->exportToCsv($exportData, $filename);
            }

        } catch (\Exception $e) {
            Log::error('Error exporting final payrolls: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to export final payrolls'
            ], 500);
        }
    }

    /**
     * Export to CSV.
     */
    private function exportToCsv($data, $filename)
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}.csv\"",
        ];

        $callback = function() use ($data) {
            $file = fopen('php://output', 'w');
            
            // Add BOM for proper Excel encoding
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));
            
            // Add headers
            if (!empty($data)) {
                fputcsv($file, array_keys($data[0]));
                
                // Add data rows
                foreach ($data as $row) {
                    fputcsv($file, $row);
                }
            }
            
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Export to Excel (basic implementation).
     */
    private function exportToExcel($data, $filename)
    {
        // This is a basic implementation. For full Excel support, use PhpSpreadsheet
        return $this->exportToCsv($data, $filename);
    }

    /**
     * Get available payroll summaries for generation.
     */
    public function getAvailableSummaries(Request $request)
    {
        $request->validate([
            'year' => 'required|integer|min:2020|max:2030',
            'month' => 'required|integer|min:1|max:12',
            'period_type' => 'required|in:1st_half,2nd_half',
            'department' => 'nullable|string'
        ]);

        try {
            $year = $request->year;
            $month = $request->month;
            $periodType = $request->period_type;
            $department = $request->department;

            // Get posted payroll summaries that don't have final payrolls yet
            $query = PayrollSummary::where('year', $year)
                ->where('month', $month)
                ->where('period_type', $periodType)
                ->where('status', 'posted')
                ->whereNotExists(function ($q) use ($year, $month, $periodType) {
                    $q->select(DB::raw(1))
                        ->from('final_payrolls')
                        ->whereColumn('final_payrolls.employee_id', 'payroll_summaries.employee_id')
                        ->where('final_payrolls.year', $year)
                        ->where('final_payrolls.month', $month)
                        ->where('final_payrolls.period_type', $periodType);
                });

            if ($department) {
                $query->where('department', $department);
            }

            $summaries = $query->orderBy('department')
                ->orderBy('employee_name')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $summaries,
                'count' => $summaries->count()
            ]);

        } catch (\Exception $e) {
            Log::error('Error getting available summaries: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to get available summaries'
            ], 500);
        }
    }

    /**
     * Recalculate final payroll.
     */
    public function recalculate($id)
    {
        try {
            $finalPayroll = FinalPayroll::findOrFail($id);

            // Check if editable
            if (!$finalPayroll->isEditable()) {
                return response()->json([
                    'success' => false,
                    'message' => 'This payroll cannot be recalculated in its current status'
                ], 422);
            }

            // Recalculate payroll
            $finalPayroll->calculatePayroll();

            return response()->json([
                'success' => true,
                'message' => 'Final payroll recalculated successfully',
                'data' => $finalPayroll->fresh()
            ]);

        } catch (\Exception $e) {
            Log::error('Error recalculating final payroll: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to recalculate final payroll'
            ], 500);
        }
    }

    /**
     * Get payroll calculation breakdown.
     */
    public function getCalculationBreakdown($id)
    {
        try {
            $finalPayroll = FinalPayroll::findOrFail($id);

            // Generate calculation breakdown if not exists
            if (!$finalPayroll->calculation_breakdown) {
                $breakdown = $finalPayroll->generateCalculationBreakdown();
            } else {
                $breakdown = $finalPayroll->calculation_breakdown;
            }

            return response()->json([
                'success' => true,
                'data' => $breakdown
            ]);

        } catch (\Exception $e) {
            Log::error('Error getting calculation breakdown: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to get calculation breakdown'
            ], 500);
        }
    }

    /**
     * Generate payroll report.
     */
    public function generateReport(Request $request)
    {
        $request->validate([
            'year' => 'required|integer|min:2020|max:2030',
            'month' => 'required|integer|min:1|max:12',
            'period_type' => 'nullable|in:1st_half,2nd_half',
            'department' => 'nullable|string',
            'report_type' => 'required|in:summary,detailed,government_remittance'
        ]);

        try {
            $year = $request->year;
            $month = $request->month;
            $periodType = $request->period_type;
            $department = $request->department;
            $reportType = $request->report_type;

            switch ($reportType) {
                case 'summary':
                    return $this->generateSummaryReport($year, $month, $periodType, $department);
                case 'detailed':
                    return $this->generateDetailedReport($year, $month, $periodType, $department);
                case 'government_remittance':
                    return $this->generateGovernmentRemittanceReport($year, $month, $periodType, $department);
                default:
                    throw new \Exception('Invalid report type');
            }

        } catch (\Exception $e) {
            Log::error('Error generating payroll report: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to generate payroll report'
            ], 500);
        }
    }

    /**
     * Generate summary report.
     */
    private function generateSummaryReport($year, $month, $periodType, $department)
    {
        $statistics = FinalPayroll::getPeriodStatistics($year, $month, $periodType, $department);
        
        // Get department breakdown
        $departmentBreakdown = FinalPayroll::forPeriod($year, $month, $periodType)
            ->when($department, function ($query) use ($department) {
                return $query->forDepartment($department);
            })
            ->selectRaw('
                department,
                COUNT(*) as employee_count,
                SUM(gross_earnings) as total_gross,
                SUM(total_deductions) as total_deductions,
                SUM(net_pay) as total_net_pay,
                AVG(net_pay) as avg_net_pay
            ')
            ->groupBy('department')
            ->orderBy('department')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'statistics' => $statistics,
                'department_breakdown' => $departmentBreakdown,
                'period' => [
                    'year' => $year,
                    'month' => $month,
                    'period_type' => $periodType,
                    'department' => $department
                ]
            ]
        ]);
    }

    /**
     * Generate detailed report.
     */
    private function generateDetailedReport($year, $month, $periodType, $department)
    {
        $payrolls = FinalPayroll::forPeriod($year, $month, $periodType)
            ->when($department, function ($query) use ($department) {
                return $query->forDepartment($department);
            })
            ->with('employee')
            ->orderBy('department')
            ->orderBy('employee_name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $payrolls
        ]);
    }

    /**
     * Generate government remittance report.
     */
    private function generateGovernmentRemittanceReport($year, $month, $periodType, $department)
    {
        $remittances = FinalPayroll::forPeriod($year, $month, $periodType)
            ->when($department, function ($query) use ($department) {
                return $query->forDepartment($department);
            })
            ->selectRaw('
                SUM(sss_contribution) as total_sss,
                SUM(philhealth_contribution) as total_philhealth,
                SUM(hdmf_contribution) as total_hdmf,
                SUM(withholding_tax) as total_withholding_tax,
                COUNT(*) as employee_count
            ')
            ->first();

        // Get individual employee contributions for detailed remittance
        $employeeContributions = FinalPayroll::forPeriod($year, $month, $periodType)
            ->when($department, function ($query) use ($department) {
                return $query->forDepartment($department);
            })
            ->select([
                'employee_no',
                'employee_name',
                'sss_contribution',
                'philhealth_contribution',
                'hdmf_contribution',
                'withholding_tax'
            ])
            ->orderBy('employee_name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => $remittances,
                'employee_contributions' => $employeeContributions,
                'period' => [
                    'year' => $year,
                    'month' => $month,
                    'period_type' => $periodType,
                    'department' => $department
                ]
            ]
        ]);
    }

    /**
 * Enhanced generation from summaries with better error handling
 */
public function generateFromSummaries(Request $request)
{
    $request->validate([
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

    try {
        DB::beginTransaction();

        $summaryIds = $request->input('summary_ids');
        $includeBenefits = $request->boolean('include_benefits', true);
        $includeDeductions = $request->boolean('include_deductions', true);
        $forceRegenerate = $request->boolean('force_regenerate', false);
        $autoApprove = $request->boolean('auto_approve', false);

        $generated = 0;
        $skipped = 0;
        $errors = [];

        foreach ($summaryIds as $summaryId) {
            try {
                $summary = PayrollSummary::findOrFail($summaryId);

                // Check if final payroll already exists
                $existing = FinalPayroll::where('employee_id', $summary->employee_id)
                    ->where('year', $summary->year)
                    ->where('month', $summary->month)
                    ->where('period_type', $summary->period_type)
                    ->first();

                if ($existing && !$forceRegenerate) {
                    $skipped++;
                    continue;
                }

                // If force regenerate, delete existing if it's still editable
                if ($existing && $forceRegenerate) {
                    if ($existing->status === 'draft') {
                        $existing->delete();
                    } else {
                        $errors[] = "Cannot regenerate finalized payroll for {$summary->employee_name}";
                        continue;
                    }
                }

                // Generate final payroll using the static method
                $finalPayroll = FinalPayroll::generateFromPayrollSummary($summary->id, auth()->id());
                
                if ($autoApprove) {
                    $finalPayroll->markAsApproved(auth()->id(), 'Auto-approved during bulk generation');
                }

                $generated++;

            } catch (\Exception $e) {
                $errors[] = "Error generating payroll for {$summary->employee_name}: " . $e->getMessage();
                Log::error("Error generating final payroll for summary {$summaryId}: " . $e->getMessage());
            }
        }

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => "Generated {$generated} final payrolls, skipped {$skipped} existing records",
            'data' => [
                'generated' => $generated,
                'skipped' => $skipped,
                'errors' => $errors
            ]
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Error generating final payrolls: ' . $e->getMessage());

        return response()->json([
            'success' => false,
            'message' => 'Failed to generate final payrolls: ' . $e->getMessage()
        ], 500);
    }
}
}