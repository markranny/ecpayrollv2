<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\SLVL;
use App\Models\SLVLBank;
use App\Models\Employee;
use App\Models\DepartmentManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class SLVLController extends Controller
{
    /**
     * Display a listing of SLVL requests.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $userRoles = $this->getUserRoles($user);
        
        // Get all departments for filtering
        $departments = Employee::select('Department')
            ->distinct()
            ->whereNotNull('Department')
            ->orderBy('Department')
            ->pluck('Department')
            ->toArray();
            
        // Query SLVL based on user role
        $slvlQuery = SLVL::with(['employee', 'approver']);
        
        // Filter based on user roles
        if ($userRoles['isEmployee'] && !$userRoles['isDepartmentManager'] && !$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
            // Regular employees can only see their own SLVL
            $employeeId = $user->employee ? $user->employee->id : null;
            if ($employeeId) {
                $slvlQuery->where('employee_id', $employeeId);
            }
        } elseif ($userRoles['isDepartmentManager'] && !$userRoles['isSuperAdmin']) {
            // Department managers can see SLVL from their department
            $managedDepartments = DepartmentManager::where('manager_id', $user->id)
                ->pluck('department')
                ->toArray();
                
            $slvlQuery->whereHas('employee', function($q) use ($managedDepartments) {
                $q->whereIn('Department', $managedDepartments);
            });
        }
        // HRD managers and superadmins can see all SLVL
        
        // Sort by latest first
        $slvlQuery->orderBy('created_at', 'desc');
        
        // Get active employees for the form with bank data for multiple years
        $employees = Employee::where('JobStatus', 'Active')
            ->orderBy('Lname')
            ->get()
            ->map(function ($employee) {
                $currentYear = now()->year;
                $previousYear = $currentYear - 1;
                $nextYear = $currentYear + 1;
                
                // Get bank data for current, previous, and next year
                $bankData = [];
                foreach ([$previousYear, $currentYear, $nextYear] as $year) {
                    $sickBank = $employee->slvlBanks()->where('leave_type', 'sick')->where('year', $year)->first();
                    $vacationBank = $employee->slvlBanks()->where('leave_type', 'vacation')->where('year', $year)->first();
                    
                    $bankData[$year] = [
                        'sick_leave_days' => $sickBank ? $sickBank->remaining_days : 0,
                        'vacation_leave_days' => $vacationBank ? $vacationBank->remaining_days : 0,
                    ];
                }
                
                return [
                    'id' => $employee->id,
                    'idno' => $employee->idno,
                    'name' => "{$employee->Lname}, {$employee->Fname} {$employee->MName}",
                    'department' => $employee->Department,
                    'position' => $employee->Jobtitle,
                    'bank_data' => $bankData,
                    // Keep backward compatibility
                    'sick_leave_days' => $bankData[$currentYear]['sick_leave_days'],
                    'vacation_leave_days' => $bankData[$currentYear]['vacation_leave_days'],
                ];
            });
            
        // Leave types with document requirements
        $leaveTypes = [
            ['value' => 'sick', 'label' => 'Sick Leave', 'requires_documents' => true],
            ['value' => 'vacation', 'label' => 'Vacation Leave', 'requires_documents' => false],
            ['value' => 'emergency', 'label' => 'Emergency Leave', 'requires_documents' => true],
            ['value' => 'bereavement', 'label' => 'Bereavement Leave', 'requires_documents' => true],
            ['value' => 'maternity', 'label' => 'Maternity Leave', 'requires_documents' => true],
            ['value' => 'paternity', 'label' => 'Paternity Leave', 'requires_documents' => true],
            ['value' => 'personal', 'label' => 'Personal Leave', 'requires_documents' => false],
            ['value' => 'study', 'label' => 'Study Leave', 'requires_documents' => true],
        ];

        // Pay options
        $payOptions = [
            ['value' => 'with_pay', 'label' => 'With Pay'],
            ['value' => 'non_pay', 'label' => 'Non Pay'],
        ];

        // Available years for bank selection
        $currentYear = now()->year;
        $availableYears = range($currentYear - 2, $currentYear + 1); // 3 years back, current, and next year
        
        // Check if a specific request is selected for viewing
        $selectedId = $request->input('selected');
        $selectedSLVL = null;
        
        if ($selectedId) {
            $selectedSLVL = SLVL::with(['employee', 'approver'])
                ->find($selectedId);
        }
        
        // Get the list of SLVL requests
        $slvls = $slvlQuery->get()->map(function ($slvl) {
            // Get the employee's remaining leave days for the bank year used
            $employee = $slvl->employee;
            $bankYear = $slvl->bank_year ?? Carbon::parse($slvl->start_date)->year;
            $remainingDays = 0;
            
            if ($employee) {
                $bank = $employee->slvlBanks()
                    ->where('leave_type', $slvl->type)
                    ->where('year', $bankYear)
                    ->first();
                $remainingDays = $bank ? $bank->remaining_days : 0;
            }
            
            return array_merge($slvl->toArray(), [
                'employee_remaining_days' => $remainingDays,
                'bank_year' => $bankYear
            ]);
        });
        
        return inertia('SLVL/SLVLPage', [
            'auth' => [
                'user' => $user,
            ],
            'slvls' => $slvls,
            'employees' => $employees,
            'leaveTypes' => $leaveTypes,
            'payOptions' => $payOptions,
            'departments' => $departments,
            'availableYears' => $availableYears,
            'selectedSLVL' => $selectedSLVL,
            'userRoles' => $userRoles
        ]);
    }

    private function getUserRoles($user)
    {
        // Check department manager directly from database first
        $isDepartmentManager = DepartmentManager::where('manager_id', $user->id)->exists();
        
        // Check if user is an HRD manager
        $isHrdManager = $this->isHrdManager($user);
        
        $userRoles = [
            'isSuperAdmin' => $user->hasRole('superadmin'),
            'isHrdManager' => $isHrdManager,
            'isDepartmentManager' => $isDepartmentManager || $user->hasRole('department_manager'),
            'isEmployee' => $user->is_employee || ($user->employee && $user->employee->exists()),
            'userId' => $user->id,
            'employeeId' => $user->employee ? $user->employee->id : null,
            'managedDepartments' => [],
        ];
        
        // If user is a department manager, get their managed departments
        if ($userRoles['isDepartmentManager']) {
            $userRoles['managedDepartments'] = DepartmentManager::where('manager_id', $user->id)
                ->pluck('department')
                ->toArray();
        }
        
        return $userRoles;
    }

    /**
     * Store a newly created SLVL request.
     */
    public function store(Request $request)
    {
        // Log the incoming request for debugging
        Log::info('SLVL Store Request Data:', [
            'all_data' => $request->all(),
            'files' => $request->allFiles(),
            'method' => $request->method(),
            'content_type' => $request->header('Content-Type'),
            'bank_year_from_request' => $request->input('bank_year') // Specific log for bank_year
        ]);

        // Define which leave types require supporting documents
        $leaveTypesRequiringDocuments = ['sick', 'emergency', 'bereavement', 'maternity', 'paternity', 'study'];
        
        // Handle boolean conversion for FormData
        if ($request->has('half_day')) {
            $halfDay = $request->input('half_day');
            if ($halfDay === 'true' || $halfDay === '1' || $halfDay === 1) {
                $request->merge(['half_day' => true]);
            } else {
                $request->merge(['half_day' => false]);
            }
        }

        // Base validation rules - IMPROVED bank_year validation
        $currentYear = now()->year;
        $validationRules = [
            'employee_id' => 'required|integer|exists:employees,id',
            'type' => 'required|string|in:sick,vacation,emergency,bereavement,maternity,paternity,personal,study',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'half_day' => 'sometimes|boolean',
            'am_pm' => 'nullable|string|in:AM,PM',
            'pay_type' => 'required|string|in:with_pay,non_pay',
            'reason' => 'required|string|max:1000',
            'bank_year' => ['required', 'integer', 'min:' . ($currentYear - 5), 'max:' . ($currentYear + 2)], // More flexible range
        ];

        // Add conditional validation for supporting documents
        if (in_array($request->input('type'), $leaveTypesRequiringDocuments)) {
            $validationRules['supporting_documents'] = 'required|file|mimes:pdf,doc,docx,jpg,jpeg,png|max:5120'; // 5MB max
        } else {
            $validationRules['supporting_documents'] = 'nullable|file|mimes:pdf,doc,docx,jpg,jpeg,png|max:5120'; // 5MB max
        }

        try {
            $validated = $request->validate($validationRules);
            Log::info('SLVL Validation passed:', [
                'validated_data' => $validated,
                'validated_bank_year' => $validated['bank_year'] ?? 'MISSING'
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('SLVL Validation failed:', [
                'errors' => $e->errors(),
                'request_data' => $request->all()
            ]);
            throw $e;
        }
        
        $user = Auth::user();
        
        // Calculate total days
        $startDate = Carbon::parse($validated['start_date']);
        $endDate = Carbon::parse($validated['end_date']);
        
        if ($validated['half_day'] ?? false) {
            $totalDays = 0.5;
        } else {
            $totalDays = $startDate->diffInDays($endDate) + 1;
        }
        
        // Check for overlapping leaves
        $employee = Employee::find($validated['employee_id']);
        if (!$employee) {
            Log::error('Employee not found:', ['employee_id' => $validated['employee_id']]);
            return back()->with('error', 'Employee not found.');
        }

        $hasOverlap = SLVL::where('employee_id', $validated['employee_id'])
            ->where('status', '!=', 'rejected')
            ->where(function($query) use ($startDate, $endDate) {
                $query->where(function($q) use ($startDate, $endDate) {
                    $q->whereBetween('start_date', [$startDate, $endDate])
                      ->orWhereBetween('end_date', [$startDate, $endDate]);
                })->orWhere(function($q) use ($startDate, $endDate) {
                    $q->where('start_date', '<=', $startDate)
                      ->where('end_date', '>=', $endDate);
                });
            })
            ->exists();
            
        if ($hasOverlap) {
            Log::warning('Leave request overlaps detected:', [
                'employee_id' => $validated['employee_id'],
                'start_date' => $startDate,
                'end_date' => $endDate
            ]);
            return back()->with('error', 'Leave request overlaps with existing leave period.');
        }
        
        // Use the selected bank year - WITH ADDITIONAL VALIDATION
        $selectedBankYear = intval($validated['bank_year']); // Ensure it's an integer
        
        // Log bank year processing
        Log::info('SLVL Bank Year Processing:', [
            'raw_bank_year' => $validated['bank_year'],
            'selected_bank_year' => $selectedBankYear,
            'current_year' => $currentYear,
            'start_date_year' => $startDate->year
        ]);
        
        // IMPROVED: Check available leave days for sick and vacation leave
        if (in_array($validated['type'], ['sick', 'vacation']) && $validated['pay_type'] === 'with_pay') {
            $bank = SLVLBank::where('employee_id', $validated['employee_id'])
                ->where('leave_type', $validated['type'])
                ->where('year', $selectedBankYear)
                ->first();
                
            if (!$bank) {
                // Create default bank if it doesn't exist for the selected year
                $defaultDays = $validated['type'] === 'sick' ? 15 : 15; // You can adjust these defaults
                $bank = SLVLBank::create([
                    'employee_id' => $validated['employee_id'],
                    'leave_type' => $validated['type'],
                    'total_days' => $defaultDays,
                    'used_days' => 0,
                    'year' => $selectedBankYear,
                    'created_by' => $user->id,
                    'notes' => "Auto-created default bank for year {$selectedBankYear}"
                ]);
                Log::info('Created default SLVL bank:', [
                    'bank_id' => $bank->id, 
                    'year' => $selectedBankYear,
                    'employee_id' => $validated['employee_id'],
                    'leave_type' => $validated['type']
                ]);
            }
            
            // Check if sufficient days are available
            if ($bank->remaining_days < $totalDays) {
                Log::warning('Insufficient leave days:', [
                    'employee_id' => $validated['employee_id'],
                    'type' => $validated['type'],
                    'required_days' => $totalDays,
                    'available_days' => $bank->remaining_days,
                    'bank_year' => $selectedBankYear,
                    'bank_total' => $bank->total_days,
                    'bank_used' => $bank->used_days
                ]);
                return back()->with('error', "Insufficient {$validated['type']} leave days for year {$selectedBankYear}. Employee has {$bank->remaining_days} days available out of {$bank->total_days} total days.");
            }
        }
        
        DB::beginTransaction();
        
        try {
            // Handle file upload
            $documentsPath = null;
            if ($request->hasFile('supporting_documents')) {
                $file = $request->file('supporting_documents');
                Log::info('Processing file upload:', [
                    'original_name' => $file->getClientOriginalName(),
                    'size' => $file->getSize(),
                    'mime_type' => $file->getMimeType()
                ]);
                
                $filename = time() . '_' . $file->getClientOriginalName();
                $documentsPath = $file->storeAs('slvl_documents', $filename, 'public');
                
                Log::info('File uploaded successfully:', ['path' => $documentsPath]);
            }
            
            // Create SLVL record with bank_year field - CRITICAL: Store the actual selected year
            $slvlData = [
                'employee_id' => $validated['employee_id'],
                'type' => $validated['type'],
                'start_date' => $validated['start_date'],
                'end_date' => $validated['end_date'],
                'half_day' => $validated['half_day'] ?? false,
                'am_pm' => $validated['am_pm'],
                'total_days' => $totalDays,
                'with_pay' => $validated['pay_type'] === 'with_pay',
                'pay_type' => $validated['pay_type'],
                'reason' => $validated['reason'],
                'documents_path' => $documentsPath,
                'status' => 'pending',
                'created_by' => $user->id,
                'bank_year' => $selectedBankYear, // Store the SELECTED bank year, not calculated
            ];

            Log::info('Creating SLVL record with data:', [
                'slvl_data' => $slvlData,
                'bank_year_being_stored' => $selectedBankYear
            ]);
            
            $slvl = SLVL::create($slvlData);
            
            if (!$slvl) {
                throw new \Exception('Failed to create SLVL record');
            }
            
            // Verify the created record has the correct bank_year
            $createdSlvl = SLVL::find($slvl->id);
            Log::info('SLVL record created successfully:', [
                'slvl_id' => $slvl->id, 
                'stored_bank_year' => $createdSlvl->bank_year,
                'selected_bank_year' => $selectedBankYear,
                'start_date' => $createdSlvl->start_date,
                'employee_id' => $createdSlvl->employee_id
            ]);
            
            // Additional verification
            if ($createdSlvl->bank_year != $selectedBankYear) {
                Log::error('CRITICAL: Bank year mismatch after creation!', [
                    'expected_bank_year' => $selectedBankYear,
                    'actual_bank_year' => $createdSlvl->bank_year,
                    'slvl_id' => $slvl->id
                ]);
            }
            
            DB::commit();
            
            // Log the successful creation
            Log::info('SLVL request created successfully', [
                'slvl_id' => $slvl->id,
                'employee_id' => $validated['employee_id'],
                'user_id' => $user->id,
                'type' => $validated['type'],
                'pay_type' => $validated['pay_type'],
                'total_days' => $totalDays,
                'bank_year' => $selectedBankYear,
                'final_stored_bank_year' => $createdSlvl->bank_year
            ]);
            
            // Redirect back with success message
            return redirect()->route('slvl.index')->with([
                'message' => "SLVL request created successfully for year {$selectedBankYear}"
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            // Clean up uploaded file if database save failed
            if ($documentsPath && Storage::disk('public')->exists($documentsPath)) {
                Storage::disk('public')->delete($documentsPath);
                Log::info('Cleaned up uploaded file after database error:', ['path' => $documentsPath]);
            }
            
            // Log the error
            Log::error('Error creating SLVL request', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $user->id,
                'employee_id' => $validated['employee_id'] ?? null,
                'validated_data' => $validated,
                'selected_bank_year' => $selectedBankYear
            ]);
            
            return back()->with('error', 'Error creating SLVL request: ' . $e->getMessage());
        }
    }

    /**
     * Get employees with SLVL bank data for a specific year
     */
    public function getEmployeesWithBankData(Request $request)
    {
        $year = $request->input('year', now()->year);
        
        // Get active employees
        $employees = Employee::where('JobStatus', 'Active')
            ->orderBy('Lname')
            ->get()
            ->map(function ($employee) use ($year) {
                // Get SLVL bank info for specified year
                $sickBank = $employee->slvlBanks()
                    ->where('leave_type', 'sick')
                    ->where('year', $year)
                    ->first();
                $vacationBank = $employee->slvlBanks()
                    ->where('leave_type', 'vacation')
                    ->where('year', $year)
                    ->first();
                
                return [
                    'id' => $employee->id,
                    'idno' => $employee->idno,
                    'name' => "{$employee->Lname}, {$employee->Fname} {$employee->MName}",
                    'department' => $employee->Department,
                    'position' => $employee->Jobtitle,
                    'sick_leave_days' => $sickBank ? $sickBank->remaining_days : 0,
                    'vacation_leave_days' => $vacationBank ? $vacationBank->remaining_days : 0,
                    'sick_total_days' => $sickBank ? $sickBank->total_days : 0,
                    'vacation_total_days' => $vacationBank ? $vacationBank->total_days : 0,
                    'sick_used_days' => $sickBank ? $sickBank->used_days : 0,
                    'vacation_used_days' => $vacationBank ? $vacationBank->used_days : 0,
                ];
            });
            
        return response()->json([
            'employees' => $employees,
            'year' => $year
        ]);
    }

    /**
     * Update the status of an SLVL request.
     */
    public function updateStatus(Request $request, $id)
    {
        $user = Auth::user();
        $slvl = SLVL::findOrFail($id);
        
        $validated = $request->validate([
            'status' => 'required|in:approved,rejected,force_approved',
            'remarks' => 'nullable|string|max:500',
        ]);

        // Check permission
        $canUpdate = false;
        $isForceApproval = $validated['status'] === 'force_approved';
        
        $userRoles = $this->getUserRoles($user);
        
        // Only superadmin can force approve
        if ($isForceApproval && $userRoles['isSuperAdmin']) {
            $canUpdate = true;
            $validated['status'] = 'approved';
        }
        // Department manager can approve/reject for their department
        elseif ($userRoles['isDepartmentManager'] && 
            in_array($slvl->employee->Department, $userRoles['managedDepartments']) &&
            !$isForceApproval) {
            $canUpdate = true;
        }
        // HRD manager or superadmin can approve/reject any request
        elseif (($userRoles['isHrdManager'] || $userRoles['isSuperAdmin']) && !$isForceApproval) {
            $canUpdate = true;
        }

        if (!$canUpdate) {
            return redirect()->back()->with('error', 'You are not authorized to update this SLVL request.');
        }

        DB::beginTransaction();
        
        try {
            if ($isForceApproval) {
                $slvl->remarks = 'Administrative override: ' . ($validated['remarks'] ?? 'Force approved by admin');
            } else {
                $slvl->remarks = $validated['remarks'];
            }
            
            $oldStatus = $slvl->status;
            $slvl->status = $validated['status'];
            $slvl->approved_by = $user->id;
            $slvl->approved_at = now();
            $slvl->save();
            
            // Get the bank year from the SLVL record or use the year from start_date
            $bankYear = $slvl->bank_year ?? Carbon::parse($slvl->start_date)->year;
            
            // Log the bank year being used for approval
            Log::info('SLVL status update - bank year determination:', [
                'slvl_id' => $slvl->id,
                'stored_bank_year' => $slvl->bank_year,
                'start_date_year' => Carbon::parse($slvl->start_date)->year,
                'final_bank_year' => $bankYear,
                'old_status' => $oldStatus,
                'new_status' => $validated['status']
            ]);
            
            // Update SLVL bank if approved and with_pay
            if ($slvl->status === 'approved' && $oldStatus !== 'approved' && $slvl->with_pay) {
                if (in_array($slvl->type, ['sick', 'vacation'])) {
                    $bank = SLVLBank::where('employee_id', $slvl->employee_id)
                        ->where('leave_type', $slvl->type)
                        ->where('year', $bankYear)
                        ->first();
                    
                    if (!$bank) {
                        $defaultDays = $slvl->type === 'sick' ? 15 : 15;
                        $bank = SLVLBank::create([
                            'employee_id' => $slvl->employee_id,
                            'leave_type' => $slvl->type,
                            'total_days' => $defaultDays,
                            'used_days' => 0,
                            'year' => $bankYear,
                            'created_by' => $user->id,
                            'notes' => "Auto-created bank for year {$bankYear}"
                        ]);
                    }
                    
                    if ($bank->remaining_days < $slvl->total_days) {
                        DB::rollBack();
                        return redirect()->back()->with('error', "Insufficient days in SLVL bank for year {$bankYear}. Employee has {$bank->remaining_days} days available out of {$bank->total_days} total days.");
                    }
                    
                    $bank->used_days += $slvl->total_days;
                    $bank->notes = ($bank->notes ? $bank->notes . "\n" : '') . 
                                  now()->format('Y-m-d H:i') . " - Used {$slvl->total_days} days for SLVL ID {$slvl->id}";
                    $bank->save();
                }
            }
            
            // Undo bank update if status changed from approved to something else
            if ($oldStatus === 'approved' && $slvl->status !== 'approved' && $slvl->with_pay) {
                if (in_array($slvl->type, ['sick', 'vacation'])) {
                    $bank = SLVLBank::where('employee_id', $slvl->employee_id)
                        ->where('leave_type', $slvl->type)
                        ->where('year', $bankYear)
                        ->first();
                    
                    if ($bank) {
                        $bank->used_days = max(0, $bank->used_days - $slvl->total_days);
                        $bank->notes = ($bank->notes ? $bank->notes . "\n" : '') . 
                                      now()->format('Y-m-d H:i') . " - Restored {$slvl->total_days} days from SLVL ID {$slvl->id} (status changed to {$slvl->status})";
                        $bank->save();
                    }
                }
            }

            DB::commit();
            
            return redirect()->back()->with('message', 'SLVL status updated successfully.');
            
        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()->with('error', 'Failed to update SLVL status: ' . $e->getMessage());
        }
    }

    /**
     * Bulk update the status of multiple SLVL requests.
     */
    public function bulkUpdateStatus(Request $request)
{
    $user = Auth::user();
    
    $validated = $request->validate([
        'slvl_ids' => 'required|array',
        'slvl_ids.*' => 'required|integer|exists:slvl,id',
        'status' => 'required|in:approved,rejected,force_approved',
        'remarks' => 'nullable|string|max:500',
    ]);
    
    $successCount = 0;
    $failCount = 0;
    $errors = [];
    
    DB::beginTransaction();
    
    try {
        foreach ($validated['slvl_ids'] as $slvlId) {
            try {
                $slvl = SLVL::findOrFail($slvlId);
                
                // Check permission
                $canUpdate = false;
                $userRoles = $this->getUserRoles($user);
                
                if ($validated['status'] === 'force_approved' && $userRoles['isSuperAdmin']) {
                    $canUpdate = true;
                } elseif ($userRoles['isDepartmentManager'] && 
                    in_array($slvl->employee->Department, $userRoles['managedDepartments']) &&
                    $validated['status'] !== 'force_approved') {
                    $canUpdate = true;
                } elseif (($userRoles['isHrdManager'] || $userRoles['isSuperAdmin']) && 
                    $validated['status'] !== 'force_approved') {
                    $canUpdate = true;
                }
                
                if (!$canUpdate) {
                    $failCount++;
                    $errors[] = "Not authorized to update SLVL request #{$slvlId}";
                    continue;
                }
                
                // Store the old status before updating
                $oldStatus = $slvl->status;
                $newStatus = $validated['status'] === 'force_approved' ? 'approved' : $validated['status'];
                
                // Get the bank year from the SLVL record or use the year from start_date
                $bankYear = $slvl->bank_year ?? Carbon::parse($slvl->start_date)->year;
                
                // Handle SLVL bank updates BEFORE updating the SLVL record
                if ($slvl->with_pay && in_array($slvl->type, ['sick', 'vacation'])) {
                    $bank = SLVLBank::where('employee_id', $slvl->employee_id)
                        ->where('leave_type', $slvl->type)
                        ->where('year', $bankYear)
                        ->first();
                    
                    // Create bank if it doesn't exist for the specific year
                    if (!$bank) {
                        $bank = SLVLBank::create([
                            'employee_id' => $slvl->employee_id,
                            'leave_type' => $slvl->type,
                            'total_days' => $slvl->type === 'sick' ? 15 : 15,
                            'used_days' => 0,
                            'year' => $bankYear,
                            'created_by' => $user->id,
                            'notes' => "Auto-created bank for year {$bankYear}"
                        ]);
                    }
                    
                    // Handle bank updates based on status changes
                    if ($oldStatus !== 'approved' && $newStatus === 'approved') {
                        // Approving a request - deduct from bank
                        if ($bank->remaining_days < $slvl->total_days) {
                            $errors[] = "SLVL #{$slvlId}: Insufficient days in SLVL bank for year {$bankYear}. Employee only has " . $bank->remaining_days . " days available.";
                            $failCount++;
                            continue;
                        }
                        
                        $bank->used_days += $slvl->total_days;
                        $bank->notes = ($bank->notes ? $bank->notes . "\n" : '') . 
                                      now()->format('Y-m-d H:i') . " - Used {$slvl->total_days} days for SLVL ID {$slvl->id} (bulk approved)";
                        $bank->save();
                        
                    } elseif ($oldStatus === 'approved' && $newStatus !== 'approved') {
                        // Rejecting/canceling an approved request - restore to bank
                        $bank->used_days = max(0, $bank->used_days - $slvl->total_days);
                        $bank->notes = ($bank->notes ? $bank->notes . "\n" : '') . 
                                      now()->format('Y-m-d H:i') . " - Restored {$slvl->total_days} days from SLVL ID {$slvl->id} (bulk status changed to {$newStatus})";
                        $bank->save();
                    }
                }
                
                // Update the SLVL record
                if ($validated['status'] === 'force_approved') {
                    $slvl->status = 'approved';
                    $slvl->remarks = 'Administrative override: ' . ($validated['remarks'] ?? 'Force approved by admin');
                } else {
                    $slvl->status = $validated['status'];
                    $slvl->remarks = $validated['remarks'] ?? 'Bulk ' . $validated['status'];
                }
                $slvl->approved_by = $user->id;
                $slvl->approved_at = now();
                $slvl->save();
                
                $successCount++;
                
            } catch (\Exception $e) {
                $failCount++;
                $errors[] = "Error updating SLVL #{$slvlId}: " . $e->getMessage();
                Log::error("Bulk update error for SLVL {$slvlId}: " . $e->getMessage());
            }
        }
        
        DB::commit();
        
        $message = "{$successCount} SLVL requests updated successfully.";
        if ($failCount > 0) {
            $message .= " {$failCount} updates failed.";
        }
        
        return redirect()->back()->with([
            'message' => $message,
            'errors' => $errors
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Bulk update SLVL status failed: ' . $e->getMessage());
        return redirect()->back()->with('error', 'Error updating SLVL statuses: ' . $e->getMessage());
    }
}

public function initializeBanksForYear(Request $request)
{
    $user = Auth::user();
    $userRoles = $this->getUserRoles($user);
    
    if (!$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
        return back()->with('error', 'You are not authorized to perform this action.');
    }
    
    $validated = $request->validate([
        'year' => 'required|integer|min:2020|max:2030',
        'sick_days' => 'required|numeric|min:0|max:365',
        'vacation_days' => 'required|numeric|min:0|max:365',
        'department' => 'nullable|string', // Optional department filter
    ]);
    
    DB::beginTransaction();
    
    try {
        $employeesQuery = Employee::query();
        
        // Filter by department if specified
        if (!empty($validated['department'])) {
            $employeesQuery->where('Department', $validated['department']);
        }
        
        $employees = $employeesQuery->get();
        $processedCount = 0;
        $skippedCount = 0;
        
        foreach ($employees as $employee) {
            // Create sick leave bank if it doesn't exist
            $sickBank = SLVLBank::where('employee_id', $employee->id)
                ->where('leave_type', 'sick')
                ->where('year', $validated['year'])
                ->first();
                
            if (!$sickBank) {
                SLVLBank::create([
                    'employee_id' => $employee->id,
                    'leave_type' => 'sick',
                    'total_days' => $validated['sick_days'],
                    'used_days' => 0,
                    'year' => $validated['year'],
                    'created_by' => $user->id,
                    'notes' => "Initialized for year {$validated['year']} by {$user->name}"
                ]);
            } else {
                $skippedCount++;
                continue; // Skip if bank already exists
            }
            
            // Create vacation leave bank if it doesn't exist
            $vacationBank = SLVLBank::where('employee_id', $employee->id)
                ->where('leave_type', 'vacation')
                ->where('year', $validated['year'])
                ->first();
                
            if (!$vacationBank) {
                SLVLBank::create([
                    'employee_id' => $employee->id,
                    'leave_type' => 'vacation',
                    'total_days' => $validated['vacation_days'],
                    'used_days' => 0,
                    'year' => $validated['year'],
                    'created_by' => $user->id,
                    'notes' => "Initialized for year {$validated['year']} by {$user->name}"
                ]);
            }
            
            $processedCount++;
        }
        
        DB::commit();
        
        $message = "Successfully initialized SLVL banks for {$processedCount} employees for year {$validated['year']}.";
        if ($skippedCount > 0) {
            $message .= " {$skippedCount} employees already had banks for this year.";
        }
        
        return back()->with('message', $message);
        
    } catch (\Exception $e) {
        DB::rollBack();
        Log::error('Initialize SLVL banks failed: ' . $e->getMessage());
        return back()->with('error', 'Failed to initialize SLVL banks: ' . $e->getMessage());
    }
}

    private function getFilteredSLVLs($user)
{
    $userRoles = $this->getUserRoles($user);
    
    $slvlQuery = SLVL::with(['employee', 'approver']);
    
    // Filter based on user roles
    if ($userRoles['isEmployee'] && !$userRoles['isDepartmentManager'] && !$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
        $employeeId = $user->employee ? $user->employee->id : null;
        if ($employeeId) {
            $slvlQuery->where('employee_id', $employeeId);
        }
    } elseif ($userRoles['isDepartmentManager'] && !$userRoles['isSuperAdmin']) {
        $managedDepartments = DepartmentManager::where('manager_id', $user->id)
            ->pluck('department')
            ->toArray();
            
        $slvlQuery->whereHas('employee', function($q) use ($managedDepartments) {
            $q->whereIn('Department', $managedDepartments);
        });
    }
    
    $slvls = $slvlQuery->orderBy('created_at', 'desc')->get();
    
    // Add remaining days to each SLVL
    return $slvls->map(function ($slvl) {
        $employee = $slvl->employee;
        $bankYear = $slvl->bank_year ?? Carbon::parse($slvl->start_date)->year;
        $remainingDays = 0;
        
        if ($employee && in_array($slvl->type, ['sick', 'vacation'])) {
            // Get the specific bank for the correct year
            $bank = SLVLBank::where('employee_id', $employee->id)
                ->where('leave_type', $slvl->type)
                ->where('year', $bankYear)
                ->first();
                
            // If no bank exists for the specific year, create one with default values
            if (!$bank) {
                $bank = SLVLBank::create([
                    'employee_id' => $employee->id,
                    'leave_type' => $slvl->type,
                    'total_days' => $slvl->type === 'sick' ? 15 : 15, // Default values
                    'used_days' => 0,
                    'year' => $bankYear,
                    'created_by' => auth()->id(),
                    'notes' => "Auto-created bank for year {$bankYear}"
                ]);
            }
            
            $remainingDays = $bank->remaining_days;
        }
        
        return array_merge($slvl->toArray(), [
            'employee_remaining_days' => $remainingDays,
            'bank_year' => $bankYear
        ]);
    });
}

    public function destroy($id)
    {
        $user = Auth::user();
        $slvl = SLVL::findOrFail($id);
        
        // Only allow deletion if status is pending and user has permission
        if ($slvl->status !== 'pending') {
            return back()->with('error', 'Only pending SLVL requests can be deleted');
        }
        
        $userRoles = $this->getUserRoles($user);
        $canDelete = false;
        
        // Check permissions
        if ($userRoles['isSuperAdmin']) {
            $canDelete = true;
        } elseif ($slvl->employee_id === $userRoles['employeeId']) {
            $canDelete = true;
        } elseif ($userRoles['isDepartmentManager'] && 
                in_array($slvl->employee->Department, $userRoles['managedDepartments'])) {
            $canDelete = true;
        } elseif ($userRoles['isHrdManager']) {
            $canDelete = true;
        }
        
        if (!$canDelete) {
            return back()->with('error', 'You are not authorized to delete this SLVL request');
        }
        
        try {
            $slvl->delete();
            return back()->with('message', 'SLVL request deleted successfully');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to delete SLVL request: ' . $e->getMessage());
        }
    }

    /**
     * Export SLVL requests to Excel.
     */
    public function export(Request $request)
    {
        $filterStatus = $request->input('status');
        $searchTerm = $request->input('search');
        $fromDate = $request->input('from_date');
        $toDate = $request->input('to_date');
        
        $user = Auth::user();
        $userRoles = $this->getUserRoles($user);
        
        $slvlQuery = SLVL::with(['employee', 'approver']);
        
        // Apply role-based filtering
        if ($userRoles['isEmployee'] && !$userRoles['isDepartmentManager'] && !$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
            $employeeId = $user->employee ? $user->employee->id : null;
            if ($employeeId) {
                $slvlQuery->where('employee_id', $employeeId);
            }
        } elseif ($userRoles['isDepartmentManager'] && !$userRoles['isSuperAdmin']) {
            $managedDepartments = DepartmentManager::where('manager_id', $user->id)
                ->pluck('department')
                ->toArray();
                
            $slvlQuery->whereHas('employee', function($q) use ($managedDepartments) {
                $q->whereIn('Department', $managedDepartments);
            });
        }
        
        // Apply filters
        if ($filterStatus) {
            $slvlQuery->where('status', $filterStatus);
        }
        
        if ($searchTerm) {
            $slvlQuery->where(function($query) use ($searchTerm) {
                $query->whereHas('employee', function($q) use ($searchTerm) {
                    $q->where('Fname', 'like', "%{$searchTerm}%")
                      ->orWhere('Lname', 'like', "%{$searchTerm}%")
                      ->orWhere('idno', 'like', "%{$searchTerm}%")
                      ->orWhere('Department', 'like', "%{$searchTerm}%");
                })
                ->orWhere('reason', 'like', "%{$searchTerm}%");
            });
        }
        
        if ($fromDate) {
            $slvlQuery->whereDate('start_date', '>=', $fromDate);
        }
        
        if ($toDate) {
            $slvlQuery->whereDate('end_date', '<=', $toDate);
        }
        
        $slvls = $slvlQuery->orderBy('created_at', 'desc')->get();
        
        // Create Excel file
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        
        // Set headers
        $sheet->setCellValue('A1', 'ID');
        $sheet->setCellValue('B1', 'Employee ID');
        $sheet->setCellValue('C1', 'Employee Name');
        $sheet->setCellValue('D1', 'Department');
        $sheet->setCellValue('E1', 'Leave Type');
        $sheet->setCellValue('F1', 'Start Date');
        $sheet->setCellValue('G1', 'End Date');
        $sheet->setCellValue('H1', 'Total Days');
        $sheet->setCellValue('I1', 'Half Day');
        $sheet->setCellValue('J1', 'AM/PM');
        $sheet->setCellValue('K1', 'Pay Type');
        $sheet->setCellValue('L1', 'Bank Year'); // ADD Bank Year column
        $sheet->setCellValue('M1', 'Reason');
        $sheet->setCellValue('N1', 'Status');
        $sheet->setCellValue('O1', 'Approved By');
        $sheet->setCellValue('P1', 'Approved Date');
        $sheet->setCellValue('Q1', 'Remarks');
        $sheet->setCellValue('R1', 'Created Date');
        
        // Add data
        $row = 2;
        foreach ($slvls as $slvl) {
            $bankYear = $slvl->bank_year ?? Carbon::parse($slvl->start_date)->year;
            
            $sheet->setCellValue('A' . $row, $slvl->id);
            $sheet->setCellValue('B' . $row, $slvl->employee ? $slvl->employee->idno : '');
            $sheet->setCellValue('C' . $row, $slvl->employee ? $slvl->employee->Lname . ', ' . $slvl->employee->Fname : '');
            $sheet->setCellValue('D' . $row, $slvl->employee ? $slvl->employee->Department : '');
            $sheet->setCellValue('E' . $row, ucfirst($slvl->type));
            $sheet->setCellValue('F' . $row, $slvl->start_date ? Carbon::parse($slvl->start_date)->format('Y-m-d') : '');
            $sheet->setCellValue('G' . $row, $slvl->end_date ? Carbon::parse($slvl->end_date)->format('Y-m-d') : '');
            $sheet->setCellValue('H' . $row, $slvl->total_days);
            $sheet->setCellValue('I' . $row, $slvl->half_day ? 'Yes' : 'No');
            $sheet->setCellValue('J' . $row, $slvl->am_pm ?? '');
            $sheet->setCellValue('K' . $row, $slvl->pay_type ? ucfirst(str_replace('_', ' ', $slvl->pay_type)) : ($slvl->with_pay ? 'With Pay' : 'Non Pay'));
            $sheet->setCellValue('L' . $row, $bankYear); // ADD Bank Year data
            $sheet->setCellValue('M' . $row, $slvl->reason);
            $sheet->setCellValue('N' . $row, ucfirst($slvl->status));
            $sheet->setCellValue('O' . $row, $slvl->approver ? $slvl->approver->name : '');
            $sheet->setCellValue('P' . $row, $slvl->approved_at ? Carbon::parse($slvl->approved_at)->format('Y-m-d H:i:s') : '');
            $sheet->setCellValue('Q' . $row, $slvl->remarks);
            $sheet->setCellValue('R' . $row, $slvl->created_at ? Carbon::parse($slvl->created_at)->format('Y-m-d H:i:s') : '');
            $row++;
        }
        
        // Auto-size columns
        foreach (range('A', 'R') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
        
        // Create writer and save
        $writer = new Xlsx($spreadsheet);
        $filename = 'SLVL_Requests_' . date('Y-m-d_H-i-s') . '.xlsx';
        
        $tempFile = tempnam(sys_get_temp_dir(), 'slvl_export_');
        $writer->save($tempFile);
        
        return response()->download($tempFile, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /**
     * Force approve SLVL requests (admin only).
     */
    public function forceApprove(Request $request)
{
    if (!$this->isSuperAdmin(Auth::user())) {
        return back()->with('error', 'Only administrators can force approve SLVL requests.');
    }
    
    $validated = $request->validate([
        'slvl_ids' => 'required|array',
        'slvl_ids.*' => 'required|integer|exists:slvl,id',
        'remarks' => 'nullable|string|max:500',
    ]);
    
    $user = Auth::user();
    $remarks = $validated['remarks'] ?? 'Administrative override: Force approved by admin';
    $successCount = 0;
    $failCount = 0;
    $errors = [];
    
    \Log::info('Force approval of SLVL initiated', [
        'admin_id' => $user->id,
        'admin_name' => $user->name,
        'count' => count($validated['slvl_ids'])
    ]);
    
    DB::beginTransaction();
    
    try {
        foreach ($validated['slvl_ids'] as $slvlId) {
            $slvl = SLVL::findOrFail($slvlId);
            
            if ($slvl->status === 'approved') {
                $errors[] = "SLVL #{$slvlId} is already approved";
                $failCount++;
                continue;
            }
            
            $oldStatus = $slvl->status;
            
            $slvl->status = 'approved';
            $slvl->approved_by = $user->id;
            $slvl->approved_at = now();
            $slvl->remarks = 'Administrative override: ' . $remarks;
            $slvl->save();
            
            // Use the bank_year from the SLVL record (which comes from form submission)
            // Fall back to start_date year only if bank_year is not set
            $bankYear = $slvl->bank_year ?? Carbon::parse($slvl->start_date)->year;
            
            // ENHANCED LOGGING for debugging
            \Log::info("Force approved SLVL #{$slvlId} - Bank Year Details", [
                'slvl_id' => $slvlId,
                'admin_id' => $user->id,
                'previous_status' => $oldStatus,
                'stored_bank_year' => $slvl->bank_year,
                'start_date' => $slvl->start_date,
                'start_date_year' => Carbon::parse($slvl->start_date)->year,
                'final_bank_year' => $bankYear,
                'employee_id' => $slvl->employee_id,
                'leave_type' => $slvl->type,
                'pay_type' => $slvl->pay_type,
                'with_pay' => $slvl->with_pay
            ]);
            
            // Update SLVL bank only for with_pay requests
            if ($oldStatus !== 'approved' && $slvl->with_pay && in_array($slvl->type, ['sick', 'vacation'])) {
                $bank = SLVLBank::where('employee_id', $slvl->employee_id)
                    ->where('leave_type', $slvl->type)
                    ->where('year', $bankYear)
                    ->first();
                
                if (!$bank) {
                    $bank = SLVLBank::create([
                        'employee_id' => $slvl->employee_id,
                        'leave_type' => $slvl->type,
                        'total_days' => $slvl->type === 'sick' ? 15 : 15,
                        'used_days' => 0,
                        'year' => $bankYear,
                        'created_by' => $user->id,
                        'notes' => "Auto-created bank for year {$bankYear} (force approved)"
                    ]);
                    
                    \Log::info("Created new SLVL bank during force approval", [
                        'bank_id' => $bank->id,
                        'employee_id' => $slvl->employee_id,
                        'leave_type' => $slvl->type,
                        'year' => $bankYear,
                        'total_days' => $bank->total_days
                    ]);
                }
                
                if ($bank->remaining_days < $slvl->total_days) {
                    $errors[] = "SLVL #{$slvlId}: Insufficient days in SLVL bank for year {$bankYear}. Employee only has " . $bank->remaining_days . " days available.";
                    
                    $slvl->status = $oldStatus;
                    $slvl->approved_by = null;
                    $slvl->approved_at = null;
                    $slvl->remarks = null;
                    $slvl->save();
                    
                    $failCount++;
                    continue;
                }
                
                $bank->used_days += $slvl->total_days;
                $bank->notes = "Used for SLVL ID {$slvl->id} (force approved for year {$bankYear})";
                $bank->save();
                
                \Log::info("Updated SLVL bank during force approval", [
                    'bank_id' => $bank->id,
                    'used_days' => $bank->used_days,
                    'remaining_days' => $bank->remaining_days,
                    'total_days_used' => $slvl->total_days
                ]);
            }
            
            $successCount++;
        }
        
        DB::commit();
        
        $message = "{$successCount} SLVL requests force approved successfully.";
        if ($failCount > 0) {
            $message .= " {$failCount} force approvals failed.";
        }
        
        return back()->with([
            'message' => $message,
            'errors' => $errors
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        \Log::error("Error during SLVL force approval: " . $e->getMessage());
        return back()->with('error', 'Error during force approval: ' . $e->getMessage());
    }
}
    
    /**
     * Add days directly to an employee's SLVL bank.
     */
    public function addDaysToBank(Request $request)
    {
        $user = Auth::user();
        $userRoles = $this->getUserRoles($user);
        
        if (!$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
            return back()->with('error', 'You are not authorized to perform this action.');
        }
        
        $validated = $request->validate([
            'employee_id' => 'required|integer|exists:employees,id',
            'leave_type' => 'required|string|in:sick,vacation',
            'days' => 'required|numeric|min:0.5|max:365',
            'year' => 'required|integer|min:2020|max:2030',
            'notes' => 'nullable|string|max:500',
        ]);
        
        DB::beginTransaction();
        
        try {
            $employee = Employee::find($validated['employee_id']);
            
            // Get or create SLVL bank
            $bank = SLVLBank::where('employee_id', $validated['employee_id'])
                ->where('leave_type', $validated['leave_type'])
                ->where('year', $validated['year'])
                ->first();
            
            if (!$bank) {
                $bank = SLVLBank::create([
                    'employee_id' => $validated['employee_id'],
                    'leave_type' => $validated['leave_type'],
                    'total_days' => $validated['days'],
                    'used_days' => 0,
                    'year' => $validated['year'],
                    'created_by' => $user->id,
                    'notes' => $validated['notes'] ?? "Manual addition by {$user->name}"
                ]);
            } else {
                $bank->total_days += $validated['days'];
                $bank->notes = ($bank->notes ? $bank->notes . "\n" : '') . 
                              (now()->format('Y-m-d H:i') . " - Added {$validated['days']} days by {$user->name}" . 
                              ($validated['notes'] ? ": {$validated['notes']}" : ''));
                $bank->save();
            }
            
            DB::commit();
            
            // Return redirect with success message instead of JSON
            return back()->with('message', "Successfully added {$validated['days']} {$validated['leave_type']} leave days to {$employee->Fname} {$employee->Lname}'s bank for year {$validated['year']}.");
            
        } catch (\Exception $e) {
            DB::rollBack();
            return back()->with('error', 'Failed to add days to SLVL bank: ' . $e->getMessage());
        }
    }
    
    /**
     * Get the SLVL bank details for an employee.
     */
    public function getSLVLBank($employeeId)
    {
        $employee = Employee::findOrFail($employeeId);
        $currentYear = request('year', now()->year); // Allow year parameter
        
        $sickBank = SLVLBank::where('employee_id', $employeeId)
            ->where('leave_type', 'sick')
            ->where('year', $currentYear)
            ->first();
            
        $vacationBank = SLVLBank::where('employee_id', $employeeId)
            ->where('leave_type', 'vacation')
            ->where('year', $currentYear)
            ->first();
        
        return response()->json([
            'employee' => [
                'id' => $employee->id,
                'name' => "{$employee->Lname}, {$employee->Fname}",
                'department' => $employee->Department,
            ],
            'slvl_banks' => [
                'sick' => $sickBank ? [
                    'total_days' => $sickBank->total_days,
                    'used_days' => $sickBank->used_days,
                    'remaining_days' => $sickBank->remaining_days,
                    'year' => $sickBank->year,
                    'notes' => $sickBank->notes,
                ] : [
                    'total_days' => 0,
                    'used_days' => 0,
                    'remaining_days' => 0,
                    'year' => $currentYear,
                    'notes' => null,
                ],
                'vacation' => $vacationBank ? [
                    'total_days' => $vacationBank->total_days,
                    'used_days' => $vacationBank->used_days,
                    'remaining_days' => $vacationBank->remaining_days,
                    'year' => $vacationBank->year,
                    'notes' => $vacationBank->notes,
                ] : [
                    'total_days' => 0,
                    'used_days' => 0,
                    'remaining_days' => 0,
                    'year' => $currentYear,
                    'notes' => null,
                ]
            ]
        ]);
    }

    public function bulkAddDaysToBank(Request $request)
    {
        $user = Auth::user();
        $userRoles = $this->getUserRoles($user);
        
        if (!$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
            return back()->with('error', 'You are not authorized to perform this action.');
        }
        
        $validated = $request->validate([
            'employee_ids' => 'required|array|min:1',
            'employee_ids.*' => 'required|integer|exists:employees,id',
            'leave_type' => 'required|string|in:sick,vacation',
            'days' => 'required|numeric|min:0.5|max:365',
            'year' => 'required|integer|min:2020|max:2030',
            'notes' => 'nullable|string|max:500',
        ]);
        
        DB::beginTransaction();
        
        $successCount = 0;
        $errorCount = 0;
        $errors = [];
        
        try {
            foreach ($validated['employee_ids'] as $employeeId) {
                try {
                    $employee = Employee::find($employeeId);
                    
                    if (!$employee) {
                        $errorCount++;
                        $errors[] = "Employee with ID {$employeeId} not found";
                        continue;
                    }
                    
                    // Get or create SLVL bank
                    $bank = SLVLBank::where('employee_id', $employeeId)
                        ->where('leave_type', $validated['leave_type'])
                        ->where('year', $validated['year'])
                        ->first();
                    
                    if (!$bank) {
                        $bank = SLVLBank::create([
                            'employee_id' => $employeeId,
                            'leave_type' => $validated['leave_type'],
                            'total_days' => $validated['days'],
                            'used_days' => 0,
                            'year' => $validated['year'],
                            'created_by' => $user->id,
                            'notes' => $validated['notes'] ?? "Bulk addition by {$user->name} for {$employee->Fname} {$employee->Lname}"
                        ]);
                    } else {
                        $bank->total_days += $validated['days'];
                        $bank->notes = ($bank->notes ? $bank->notes . "\n" : '') . 
                                      (now()->format('Y-m-d H:i') . " - Bulk added {$validated['days']} days by {$user->name}" . 
                                      ($validated['notes'] ? ": {$validated['notes']}" : ''));
                        $bank->save();
                    }
                    
                    $successCount++;
                    
                } catch (\Exception $e) {
                    $errorCount++;
                    $errors[] = "Error for employee {$employee->Fname} {$employee->Lname}: " . $e->getMessage();
                    \Log::error("Bulk add SLVL days error for employee {$employeeId}: " . $e->getMessage());
                }
            }
            
            DB::commit();
            
            // Prepare response message
            $message = "Successfully added {$validated['days']} {$validated['leave_type']} leave days to {$successCount} employee(s)";
            if ($errorCount > 0) {
                $message .= ". {$errorCount} errors occurred.";
            }
            
            return back()->with([
                'message' => $message,
                'errors' => $errors
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Bulk add SLVL days failed: ' . $e->getMessage());
            return back()->with('error', 'Failed to bulk add days to SLVL bank: ' . $e->getMessage());
        }
    }
    
    private function isSuperAdmin($user)
    {
        if (method_exists($user, 'roles') && $user->roles && $user->roles->count() > 0) {
            if ($user->roles->contains('name', 'superadmin') || $user->roles->contains('slug', 'superadmin')) {
                return true;
            }
        }
        
        if (method_exists($user, 'hasRole') && $user->hasRole('superadmin')) {
            return true;
        }
        
        return false;
    }

    private function isHrdManager($user)
    {
        if (method_exists($user, 'roles') && $user->roles && $user->roles->count() > 0) {
            if ($user->roles->contains('name', 'hrd_manager') || $user->roles->contains('slug', 'hrd')) {
                return true;
            }
        }
        
        if (method_exists($user, 'hasRole') && $user->hasRole('hrd_manager')) {
            return true;
        }
        
        return false;
    }
}