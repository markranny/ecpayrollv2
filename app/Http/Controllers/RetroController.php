<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Retro;
use App\Models\Employee;
use App\Models\Department;
use App\Models\DepartmentManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Inertia\Inertia;

class RetroController extends Controller
{
    /**
     * Display a listing of retro requests.
     */
    public function index(Request $request)
    {
        $user = Auth::user();
        $userRoles = $this->getUserRoles($user);
        
        // Get departments from the departments table
        $departments = Department::where('is_active', true)
            ->orderBy('name')
            ->pluck('name')
            ->toArray();
            
        // Query retros based on user role
        $retroQuery = Retro::with(['employee', 'approver', 'creator']);
        
        // Filter based on user roles
        if ($userRoles['isEmployee'] && !$userRoles['isDepartmentManager'] && !$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
            // Regular employees can only see their own requests
            $employeeId = $user->employee ? $user->employee->id : null;
            if ($employeeId) {
                $retroQuery->where('employee_id', $employeeId);
            }
        } elseif ($userRoles['isDepartmentManager'] && !$userRoles['isSuperAdmin']) {
            // Department managers can see requests from their department
            $managedDepartments = DepartmentManager::where('manager_id', $user->id)
                ->pluck('department')
                ->toArray();
                
            $retroQuery->whereHas('employee', function($q) use ($managedDepartments) {
                $q->whereIn('Department', $managedDepartments);
            });
        }
        // HRD managers and superadmins can see all requests
        
        // Sort by latest first
        $retroQuery->orderBy('created_at', 'desc');
        
        // Get active employees for the form
        $employees = Employee::where('JobStatus', 'Active')
            ->orderBy('Lname')
            ->get()
            ->map(function ($employee) {
                $firstName = $employee->Fname ?? '';
                $lastName = $employee->Lname ?? '';
                $middleName = $employee->MName ?? '';
                $department = $employee->Department ?? '';
                $position = $employee->Jobtitle ?? '';
                
                $name = trim($lastName);
                if (!empty($firstName)) {
                    $name .= !empty($name) ? ', ' . $firstName : $firstName;
                }
                if (!empty($middleName)) {
                    $name .= ' ' . $middleName;
                }
                
                if (empty($name)) {
                    $name = 'Employee #' . $employee->id;
                }
                
                return [
                    'id' => $employee->id,
                    'idno' => $employee->idno ?? '',
                    'name' => $name,
                    'department' => $department,
                    'position' => $position,
                ];
            });
            
        // Check if a specific request is selected for viewing
        $selectedId = $request->input('selected');
        $selectedRetro = null;
        
        if ($selectedId) {
            $selectedRetro = Retro::with(['employee', 'approver', 'creator'])
                ->find($selectedId);
        }
        
        // Get the list of retro requests
        $retros = $retroQuery->get();
        
        return inertia('Retro/RetroPage', [
            'auth' => [
                'user' => $user,
            ],
            'retros' => $retros,
            'employees' => $employees,
            'departments' => $departments,
            'selectedRetro' => $selectedRetro,
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
     * Store a newly created retro request.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_ids' => 'required|array',
            'employee_ids.*' => 'required|integer|exists:employees,id',
            'retro_type' => 'required|string|in:salary,allowance,overtime,bonus,deduction,other',
            'adjustment_type' => 'required|string|in:increase,decrease,correction,backdated',
            'retro_date' => 'required|date',
            'original_value' => 'required|numeric|min:0',
            'requested_value' => 'required|numeric|min:0',
            'reason' => 'required|string|max:1000',
        ]);
        
        $user = Auth::user();
        $successCount = 0;
        $errorMessages = [];
        
        DB::beginTransaction();
        
        try {
            foreach ($validated['employee_ids'] as $employeeId) {
                $employee = Employee::find($employeeId);
                
                if (!$employee) {
                    $errorMessages[] = "Employee ID $employeeId not found";
                    continue;
                }
                
                // Check for duplicate retro entries
                $existingRequest = Retro::where('employee_id', $employeeId)
                    ->where('retro_type', $validated['retro_type'])
                    ->where('retro_date', $validated['retro_date'])
                    ->where('status', 'pending')
                    ->first();
                
                if ($existingRequest) {
                    $employeeName = ($employee->Fname ?? '') . ' ' . ($employee->Lname ?? '');
                    $errorMessages[] = "Pending retro request for {$employeeName} of type {$validated['retro_type']} on {$validated['retro_date']} already exists";
                    continue;
                }
                
                $retro = new Retro();
                $retro->employee_id = $employeeId;
                $retro->retro_type = $validated['retro_type'];
                $retro->adjustment_type = $validated['adjustment_type'];
                $retro->retro_date = $validated['retro_date'];
                $retro->original_value = $validated['original_value'];
                $retro->requested_value = $validated['requested_value'];
                $retro->reason = $validated['reason'];
                $retro->status = 'pending';
                $retro->created_by = $user->id;
                
                $retro->save();
                $successCount++;
            }
            
            DB::commit();
            
            $message = "Successfully created {$successCount} retro request(s)";
            
            if (!empty($errorMessages)) {
                return redirect()->back()->with([
                    'message' => $message,
                    'errors' => $errorMessages
                ]);
            }
            
            return redirect()->back()->with('message', $message);
        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()->with('error', 'Error creating retro requests: ' . $e->getMessage());
        }
    }

    /**
     * Update the status of a retro request.
     */
    public function updateStatus(Request $request, $id)
    {
        $user = Auth::user();
        $retro = Retro::findOrFail($id);
        
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
            in_array($retro->employee->Department, $userRoles['managedDepartments']) &&
            !$isForceApproval) {
            $canUpdate = true;
        }
        // HRD manager or superadmin can approve/reject any request
        elseif (($userRoles['isHrdManager'] || $userRoles['isSuperAdmin']) && !$isForceApproval) {
            $canUpdate = true;
        }

        if (!$canUpdate) {
            return back()->with('error', 'You are not authorized to update this retro request.');
        }

        try {
            if ($isForceApproval) {
                $retro->remarks = 'Administrative override: ' . ($validated['remarks'] ?? 'Force approved by admin');
            } else {
                $retro->remarks = $validated['remarks'];
            }
            
            $retro->status = $validated['status'];
            $retro->approved_by = $user->id;
            $retro->approved_at = now();
            $retro->save();

            return redirect()->back()->with([
                'message' => 'Retro status updated successfully.'
            ]);
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to update retro status: ' . $e->getMessage());
        }
    }

    /**
     * Bulk update the status of multiple retro requests.
     */
    public function bulkUpdateStatus(Request $request)
    {
        $user = Auth::user();
        
        $validated = $request->validate([
            'retro_ids' => 'required|array',
            'retro_ids.*' => 'required|integer|exists:retros,id',
            'status' => 'required|in:approved,rejected,force_approved',
            'remarks' => 'nullable|string|max:500',
        ]);
        
        $successCount = 0;
        $failCount = 0;
        $errors = [];
        
        DB::beginTransaction();
        
        try {
            foreach ($validated['retro_ids'] as $retroId) {
                $retro = Retro::findOrFail($retroId);
                
                // Check permission
                $canUpdate = false;
                $userRoles = $this->getUserRoles($user);
                
                if ($validated['status'] === 'force_approved' && $userRoles['isSuperAdmin']) {
                    $canUpdate = true;
                }
                elseif ($userRoles['isDepartmentManager'] && 
                    in_array($retro->employee->Department, $userRoles['managedDepartments']) &&
                    $validated['status'] !== 'force_approved') {
                    $canUpdate = true;
                }
                elseif (($userRoles['isHrdManager'] || $userRoles['isSuperAdmin']) && 
                    $validated['status'] !== 'force_approved') {
                    $canUpdate = true;
                }
                
                if (!$canUpdate) {
                    $failCount++;
                    $errors[] = "Not authorized to update retro request #{$retroId}";
                    continue;
                }
                
                if ($validated['status'] === 'force_approved') {
                    $retro->status = 'approved';
                    $retro->remarks = 'Administrative override: ' . ($validated['remarks'] ?? 'Force approved by admin');
                } else {
                    $retro->status = $validated['status'];
                    $retro->remarks = $validated['remarks'] ?? 'Bulk ' . $validated['status'];
                }
                $retro->approved_by = $user->id;
                $retro->approved_at = now();
                $retro->save();
                $successCount++;
            }
            
            DB::commit();
            
            $message = "{$successCount} retro requests updated successfully.";
            if ($failCount > 0) {
                $message .= " {$failCount} updates failed.";
            }
            
            return redirect()->back()->with('message', $message);
            
        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()->with('error', 'Error updating retro statuses: ' . $e->getMessage());
        }
    }

    public function destroy($id)
{
    // Validate that ID is provided and is numeric
    if (!$id || !is_numeric($id)) {
        return back()->with('error', 'Invalid retro request ID provided');
    }

    $user = Auth::user();
    
    try {
        $retro = Retro::findOrFail($id);
        
        // Only allow deletion if status is pending and user has permission
        if ($retro->status !== 'pending') {
            return back()->with('error', 'Only pending retro requests can be deleted');
        }
        
        $userRoles = $this->getUserRoles($user);
        $canDelete = false;
        
        // Check permissions
        if ($userRoles['isSuperAdmin']) {
            $canDelete = true;
        } elseif ($retro->employee_id === $userRoles['employeeId']) {
            $canDelete = true;
        } elseif ($userRoles['isDepartmentManager'] && 
                in_array($retro->employee->Department, $userRoles['managedDepartments'])) {
            $canDelete = true;
        } elseif ($userRoles['isHrdManager']) {
            $canDelete = true;
        }
        
        if (!$canDelete) {
            return back()->with('error', 'You are not authorized to delete this retro request');
        }
        
        $retro->delete();
        
        // Return success response for both web and AJAX requests
        if (request()->expectsJson()) {
            return response()->json(['message' => 'Retro request deleted successfully']);
        }
        
        return back()->with('message', 'Retro request deleted successfully');
        
    } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
        $errorMessage = 'Retro request not found';
        
        if (request()->expectsJson()) {
            return response()->json(['error' => $errorMessage], 404);
        }
        
        return back()->with('error', $errorMessage);
    } catch (\Exception $e) {
        \Log::error('Error deleting retro request: ' . $e->getMessage(), [
            'retro_id' => $id,
            'user_id' => $user->id,
            'trace' => $e->getTraceAsString()
        ]);
        
        $errorMessage = 'Failed to delete retro request: ' . $e->getMessage();
        
        if (request()->expectsJson()) {
            return response()->json(['error' => $errorMessage], 500);
        }
        
        return back()->with('error', $errorMessage);
    }
}

    /**
     * Export retro requests to Excel.
     */
    public function export(Request $request)
    {
        $filterStatus = $request->input('status');
        $searchTerm = $request->input('search');
        $fromDate = $request->input('from_date');
        $toDate = $request->input('to_date');
        
        $user = Auth::user();
        $userRoles = $this->getUserRoles($user);
        
        $retroQuery = Retro::with(['employee', 'approver', 'creator']);
        
        // Apply role-based filtering
        if ($userRoles['isEmployee'] && !$userRoles['isDepartmentManager'] && !$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
            $employeeId = $user->employee ? $user->employee->id : null;
            if ($employeeId) {
                $retroQuery->where('employee_id', $employeeId);
            }
        } elseif ($userRoles['isDepartmentManager'] && !$userRoles['isSuperAdmin']) {
            $managedDepartments = DepartmentManager::where('manager_id', $user->id)
                ->pluck('department')
                ->toArray();
                
            $retroQuery->whereHas('employee', function($q) use ($managedDepartments) {
                $q->whereIn('Department', $managedDepartments);
            });
        }
        
        // Apply filters
        if ($filterStatus) {
            $retroQuery->where('status', $filterStatus);
        }
        
        if ($searchTerm) {
            $retroQuery->where(function($query) use ($searchTerm) {
                $query->whereHas('employee', function($q) use ($searchTerm) {
                    $q->where('Fname', 'like', "%{$searchTerm}%")
                      ->orWhere('Lname', 'like', "%{$searchTerm}%")
                      ->orWhere('idno', 'like', "%{$searchTerm}%")
                      ->orWhere('Department', 'like', "%{$searchTerm}%");
                })
                ->orWhere('reason', 'like', "%{$searchTerm}%")
                ->orWhere('retro_type', 'like', "%{$searchTerm}%");
            });
        }
        
        if ($fromDate) {
            $retroQuery->whereDate('retro_date', '>=', $fromDate);
        }
        
        if ($toDate) {
            $retroQuery->whereDate('retro_date', '<=', $toDate);
        }
        
        $retros = $retroQuery->orderBy('created_at', 'desc')->get();
        
        // Create Excel file
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        
        // Set headers
        $sheet->setCellValue('A1', 'ID');
        $sheet->setCellValue('B1', 'Employee ID');
        $sheet->setCellValue('C1', 'Employee Name');
        $sheet->setCellValue('D1', 'Department');
        $sheet->setCellValue('E1', 'Retro Type');
        $sheet->setCellValue('F1', 'Adjustment Type');
        $sheet->setCellValue('G1', 'Retro Date');
        $sheet->setCellValue('H1', 'Original Value');
        $sheet->setCellValue('I1', 'Requested Value');
        $sheet->setCellValue('J1', 'Reason');
        $sheet->setCellValue('K1', 'Status');
        $sheet->setCellValue('L1', 'Approved By');
        $sheet->setCellValue('M1', 'Approved Date');
        $sheet->setCellValue('N1', 'Remarks');
        $sheet->setCellValue('O1', 'Created Date');
        
        // Add data
        $row = 2;
        foreach ($retros as $retro) {
            $sheet->setCellValue('A' . $row, $retro->id);
            $sheet->setCellValue('B' . $row, $retro->employee ? $retro->employee->idno : '');
            $sheet->setCellValue('C' . $row, $retro->employee ? $retro->employee->Lname . ', ' . $retro->employee->Fname : '');
            $sheet->setCellValue('D' . $row, $retro->employee ? $retro->employee->Department : '');
            $sheet->setCellValue('E' . $row, $retro->getRetroTypeLabel());
            $sheet->setCellValue('F' . $row, $retro->getAdjustmentTypeLabel());
            $sheet->setCellValue('G' . $row, $retro->retro_date ? Carbon::parse($retro->retro_date)->format('Y-m-d') : '');
            $sheet->setCellValue('H' . $row, $retro->original_value);
            $sheet->setCellValue('I' . $row, $retro->requested_value);
            $sheet->setCellValue('J' . $row, $retro->reason);
            $sheet->setCellValue('K' . $row, ucfirst($retro->status));
            $sheet->setCellValue('L' . $row, $retro->approver ? $retro->approver->name : '');
            $sheet->setCellValue('M' . $row, $retro->approved_at ? Carbon::parse($retro->approved_at)->format('Y-m-d H:i:s') : '');
            $sheet->setCellValue('N' . $row, $retro->remarks);
            $sheet->setCellValue('O' . $row, $retro->created_at ? Carbon::parse($retro->created_at)->format('Y-m-d H:i:s') : '');
            $row++;
        }
        
        // Auto-size columns
        foreach (range('A', 'O') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
        
        // Create writer and save
        $writer = new Xlsx($spreadsheet);
        $filename = 'Retro_Requests_' . date('Y-m-d_H-i-s') . '.xlsx';
        
        $tempFile = tempnam(sys_get_temp_dir(), 'retro_export_');
        $writer->save($tempFile);
        
        return response()->download($tempFile, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /**
     * Force approve retro requests (admin only).
     */
    public function forceApprove(Request $request)
    {
        if (!$this->isSuperAdmin(Auth::user())) {
            return back()->with('error', 'Only administrators can force approve retro requests.');
        }
        
        $validated = $request->validate([
            'retro_ids' => 'required|array',
            'retro_ids.*' => 'required|integer|exists:retros,id',
            'remarks' => 'nullable|string|max:500',
        ]);
        
        $user = Auth::user();
        $remarks = $validated['remarks'] ?? 'Administrative override: Force approved by admin';
        $successCount = 0;
        $failCount = 0;
        $errors = [];
        
        \Log::info('Force approval of retro initiated', [
            'admin_id' => $user->id,
            'admin_name' => $user->name,
            'count' => count($validated['retro_ids'])
        ]);
        
        foreach ($validated['retro_ids'] as $retroId) {
            try {
                $retro = Retro::findOrFail($retroId);
                
                if ($retro->status === 'approved') {
                    $errors[] = "Retro #{$retroId} is already approved";
                    $failCount++;
                    continue;
                }
                
                $retro->status = 'approved';
                $retro->approved_by = $user->id;
                $retro->approved_at = now();
                $retro->remarks = 'Administrative override: ' . $remarks;
                $retro->save();
                
                $successCount++;
                
                \Log::info("Force approved retro #{$retroId}", [
                    'admin_id' => $user->id,
                    'retro_id' => $retroId,
                    'previous_status' => $retro->getOriginal('status')
                ]);
            } catch (\Exception $e) {
                \Log::error("Error force approving retro #{$retroId}: " . $e->getMessage());
                $failCount++;
                $errors[] = "Error force approving retro #{$retroId}: " . $e->getMessage();
            }
        }
        
        $message = "{$successCount} retro requests force approved successfully.";
        if ($failCount > 0) {
            $message .= " {$failCount} force approvals failed.";
        }
        
        return back()->with('message', $message);
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