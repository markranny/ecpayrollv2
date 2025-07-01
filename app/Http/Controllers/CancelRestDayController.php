<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\CancelRestDay;
use App\Models\Employee;
use App\Models\Department;
use App\Models\DepartmentManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Inertia\Inertia;

class CancelRestDayController extends Controller
{
    /**
     * Display a listing of cancel rest day requests.
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
            
        // Query cancel rest day requests based on user role
        $cancelRestDayQuery = CancelRestDay::with(['employee', 'approver']);
        
        // Filter based on user roles
        if ($userRoles['isEmployee'] && !$userRoles['isDepartmentManager'] && !$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
            // Regular employees can only see their own requests
            $employeeId = $user->employee ? $user->employee->id : null;
            if ($employeeId) {
                $cancelRestDayQuery->where('employee_id', $employeeId);
            }
        } elseif ($userRoles['isDepartmentManager'] && !$userRoles['isSuperAdmin']) {
            // Department managers can see requests from their department
            $managedDepartments = DepartmentManager::where('manager_id', $user->id)
                ->pluck('department')
                ->toArray();
                
            $cancelRestDayQuery->whereHas('employee', function($q) use ($managedDepartments) {
                $q->whereIn('Department', $managedDepartments);
            });
        }
        // HRD managers and superadmins can see all requests
        
        // Sort by latest first
        $cancelRestDayQuery->orderBy('created_at', 'desc');
        
        // Get active employees for the form
        $employees = Employee::where('JobStatus', 'Active')
            ->orderBy('Lname')
            ->get()
            ->map(function ($employee) {
                // Handle null values properly
                $firstName = $employee->Fname ?? '';
                $lastName = $employee->Lname ?? '';
                $middleName = $employee->MName ?? '';
                $department = $employee->Department ?? '';
                $position = $employee->Jobtitle ?? '';
                
                // Build name properly
                $name = trim($lastName);
                if (!empty($firstName)) {
                    $name .= !empty($name) ? ', ' . $firstName : $firstName;
                }
                if (!empty($middleName)) {
                    $name .= ' ' . $middleName;
                }
                
                // If name is still empty, use employee ID
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
        $selectedCancelRestDay = null;
        
        if ($selectedId) {
            $selectedCancelRestDay = CancelRestDay::with(['employee', 'approver'])
                ->find($selectedId);
        }
        
        // Get the list of cancel rest day requests
        $cancelRestDays = $cancelRestDayQuery->get();
        
        return inertia('CancelRestDay/CancelRestDayPage', [
            'auth' => [
                'user' => $user,
            ],
            'cancelRestDays' => $cancelRestDays,
            'employees' => $employees,
            'departments' => $departments,
            'selectedCancelRestDay' => $selectedCancelRestDay,
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
     * Store a newly created cancel rest day request.
     */
    public function store(Request $request)
    {
        $user = Auth::user();
        $userRoles = $this->getUserRoles($user);
        
        // Determine if user can select any date (including past dates)
        $canSelectAnyDate = $userRoles['isSuperAdmin'] || $userRoles['isHrdManager'];
        
        // Set validation rules based on user privileges
        $validationRules = [
            'employee_ids' => 'required|array',
            'employee_ids.*' => 'required|integer|exists:employees,id',
            'replacement_work_date' => 'nullable|date|different:rest_day_date',
            'reason' => 'required|string|max:1000',
        ];
        
        // Add date validation based on user role
        if ($canSelectAnyDate) {
            $validationRules['rest_day_date'] = 'required|date';
        } else {
            $validationRules['rest_day_date'] = 'required|date|after_or_equal:today';
        }
        
        $validated = $request->validate($validationRules);
        
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
                
                // Check for duplicate cancel rest day entries
                $existingRequest = CancelRestDay::where('employee_id', $employeeId)
                    ->where('rest_day_date', $validated['rest_day_date'])
                    ->first();
                
                if ($existingRequest) {
                    $employeeName = ($employee->Fname ?? '') . ' ' . ($employee->Lname ?? '');
                    $errorMessages[] = "Cancel rest day request for {$employeeName} on {$validated['rest_day_date']} already exists";
                    continue;
                }
                
                $cancelRestDay = new CancelRestDay();
                $cancelRestDay->employee_id = $employeeId;
                $cancelRestDay->rest_day_date = $validated['rest_day_date'];
                $cancelRestDay->replacement_work_date = $validated['replacement_work_date'];
                $cancelRestDay->reason = $validated['reason'];
                $cancelRestDay->status = 'pending';
                
                $cancelRestDay->save();
                $successCount++;
            }
            
            DB::commit();
            
            $message = "Successfully created {$successCount} cancel rest day request(s)";
            
            // Add note if admin/HR created past date request
            if ($canSelectAnyDate && $validated['rest_day_date'] < now()->toDateString()) {
                $message .= " (including past date - Admin/HR privilege used)";
            }
            
            if (!empty($errorMessages)) {
                return redirect()->back()->with([
                    'message' => $message,
                    'errors' => $errorMessages
                ]);
            }
            
            return redirect()->back()->with('message', $message);
        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()->with('error', 'Error creating cancel rest day requests: ' . $e->getMessage());
        }
    }

    /**
     * Update the status of a cancel rest day request.
     */
    public function updateStatus(Request $request, $id)
    {
        $user = Auth::user();
        $cancelRestDay = CancelRestDay::findOrFail($id);
        
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
            // Force approval becomes a regular approval but with admin override
            $validated['status'] = 'approved';
        }
        // Department manager can approve/reject for their department
        elseif ($userRoles['isDepartmentManager'] && 
            in_array($cancelRestDay->employee->Department, $userRoles['managedDepartments']) &&
            !$isForceApproval) {
            $canUpdate = true;
        }
        // HRD manager or superadmin can approve/reject any request
        elseif (($userRoles['isHrdManager'] || $userRoles['isSuperAdmin']) && !$isForceApproval) {
            $canUpdate = true;
        }

        if (!$canUpdate) {
            return back()->with('error', 'You are not authorized to update this cancel rest day request.');
        }

        try {
            // Special case for force approval by superadmin
            if ($isForceApproval) {
                $cancelRestDay->remarks = 'Administrative override: ' . ($validated['remarks'] ?? 'Force approved by admin');
            } else {
                $cancelRestDay->remarks = $validated['remarks'];
            }
            
            $cancelRestDay->status = $validated['status'];
            $cancelRestDay->approved_by = $user->id;
            $cancelRestDay->approved_at = now();
            $cancelRestDay->save();

            // Return to previous page with success message
            return redirect()->back()->with([
                'message' => 'Cancel rest day status updated successfully.',
            ]);
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to update cancel rest day status: ' . $e->getMessage());
        }
    }

    /**
     * Bulk update the status of multiple cancel rest day requests.
     */
    public function bulkUpdateStatus(Request $request)
    {
        $user = Auth::user();
        
        $validated = $request->validate([
            'cancel_rest_day_ids' => 'required|array',
            'cancel_rest_day_ids.*' => 'required|integer|exists:cancel_rest_days,id',
            'status' => 'required|in:approved,rejected,force_approved',
            'remarks' => 'nullable|string|max:500',
        ]);
        
        $successCount = 0;
        $failCount = 0;
        $errors = [];
        
        DB::beginTransaction();
        
        try {
            foreach ($validated['cancel_rest_day_ids'] as $cancelRestDayId) {
                $cancelRestDay = CancelRestDay::findOrFail($cancelRestDayId);
                
                // Check permission
                $canUpdate = false;
                $userRoles = $this->getUserRoles($user);
                
                // Force approve option for superadmins
                if ($validated['status'] === 'force_approved' && $userRoles['isSuperAdmin']) {
                    $canUpdate = true;
                }
                // Department manager can approve/reject for their department
                elseif ($userRoles['isDepartmentManager'] && 
                    in_array($cancelRestDay->employee->Department, $userRoles['managedDepartments']) &&
                    $validated['status'] !== 'force_approved') {
                    $canUpdate = true;
                }
                // HRD manager or superadmin can approve/reject any request
                elseif (($userRoles['isHrdManager'] || $userRoles['isSuperAdmin']) && 
                    $validated['status'] !== 'force_approved') {
                    $canUpdate = true;
                }
                
                if (!$canUpdate) {
                    $failCount++;
                    $errors[] = "Not authorized to update cancel rest day request #{$cancelRestDayId}";
                    continue;
                }
                
                // Update the status
                if ($validated['status'] === 'force_approved') {
                    $cancelRestDay->status = 'approved';
                    $cancelRestDay->remarks = 'Administrative override: ' . ($validated['remarks'] ?? 'Force approved by admin');
                } else {
                    $cancelRestDay->status = $validated['status'];
                    $cancelRestDay->remarks = $validated['remarks'] ?? 'Bulk ' . $validated['status'];
                }
                $cancelRestDay->approved_by = $user->id;
                $cancelRestDay->approved_at = now();
                $cancelRestDay->save();
                $successCount++;
            }
            
            DB::commit();
            
            $message = "{$successCount} cancel rest day requests updated successfully.";
            if ($failCount > 0) {
                $message .= " {$failCount} updates failed.";
            }
            
            return redirect()->back()->with('message', $message);
            
        } catch (\Exception $e) {
            DB::rollBack();
            return redirect()->back()->with('error', 'Error updating cancel rest day statuses: ' . $e->getMessage());
        }
    }

    public function destroy($id)
    {
        $user = Auth::user();
        $cancelRestDay = CancelRestDay::findOrFail($id);
        
        // Only allow deletion if status is pending and user has permission
        if ($cancelRestDay->status !== 'pending') {
            return back()->with('error', 'Only pending cancel rest day requests can be deleted');
        }
        
        $userRoles = $this->getUserRoles($user);
        $canDelete = false;
        
        // Check permissions
        if ($userRoles['isSuperAdmin']) {
            $canDelete = true;
        } elseif ($cancelRestDay->employee_id === $userRoles['employeeId']) {
            // Users can delete their own pending requests
            $canDelete = true;
        } elseif ($userRoles['isDepartmentManager'] && 
                in_array($cancelRestDay->employee->Department, $userRoles['managedDepartments'])) {
            $canDelete = true;
        } elseif ($userRoles['isHrdManager']) {
            $canDelete = true;
        }
        
        if (!$canDelete) {
            return back()->with('error', 'You are not authorized to delete this cancel rest day request');
        }
        
        try {
            $cancelRestDay->delete();
            return back()->with('message', 'Cancel rest day request deleted successfully');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to delete cancel rest day request: ' . $e->getMessage());
        }
    }

    /**
     * Export cancel rest day requests to Excel.
     */
    public function export(Request $request)
    {
        $filterStatus = $request->input('status');
        $searchTerm = $request->input('search');
        $fromDate = $request->input('from_date');
        $toDate = $request->input('to_date');
        
        $user = Auth::user();
        $userRoles = $this->getUserRoles($user);
        
        $cancelRestDayQuery = CancelRestDay::with(['employee', 'approver']);
        
        // Apply role-based filtering
        if ($userRoles['isEmployee'] && !$userRoles['isDepartmentManager'] && !$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
            $employeeId = $user->employee ? $user->employee->id : null;
            if ($employeeId) {
                $cancelRestDayQuery->where('employee_id', $employeeId);
            }
        } elseif ($userRoles['isDepartmentManager'] && !$userRoles['isSuperAdmin']) {
            $managedDepartments = DepartmentManager::where('manager_id', $user->id)
                ->pluck('department')
                ->toArray();
                
            $cancelRestDayQuery->whereHas('employee', function($q) use ($managedDepartments) {
                $q->whereIn('Department', $managedDepartments);
            });
        }
        
        // Apply filters
        if ($filterStatus) {
            $cancelRestDayQuery->where('status', $filterStatus);
        }
        
        if ($searchTerm) {
            $cancelRestDayQuery->where(function($query) use ($searchTerm) {
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
            $cancelRestDayQuery->whereDate('rest_day_date', '>=', $fromDate);
        }
        
        if ($toDate) {
            $cancelRestDayQuery->whereDate('rest_day_date', '<=', $toDate);
        }
        
        $cancelRestDays = $cancelRestDayQuery->orderBy('created_at', 'desc')->get();
        
        // Create Excel file
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        
        // Set headers
        $sheet->setCellValue('A1', 'ID');
        $sheet->setCellValue('B1', 'Employee ID');
        $sheet->setCellValue('C1', 'Employee Name');
        $sheet->setCellValue('D1', 'Department');
        $sheet->setCellValue('E1', 'Rest Day Date');
        $sheet->setCellValue('F1', 'Replacement Work Date');
        $sheet->setCellValue('G1', 'Reason');
        $sheet->setCellValue('H1', 'Status');
        $sheet->setCellValue('I1', 'Approved By');
        $sheet->setCellValue('J1', 'Approved Date');
        $sheet->setCellValue('K1', 'Remarks');
        $sheet->setCellValue('L1', 'Created Date');
        
        // Add data
        $row = 2;
        foreach ($cancelRestDays as $cancelRestDay) {
            $sheet->setCellValue('A' . $row, $cancelRestDay->id);
            $sheet->setCellValue('B' . $row, $cancelRestDay->employee ? $cancelRestDay->employee->idno : '');
            $sheet->setCellValue('C' . $row, $cancelRestDay->employee ? $cancelRestDay->employee->Lname . ', ' . $cancelRestDay->employee->Fname : '');
            $sheet->setCellValue('D' . $row, $cancelRestDay->employee ? $cancelRestDay->employee->Department : '');
            $sheet->setCellValue('E' . $row, $cancelRestDay->rest_day_date ? Carbon::parse($cancelRestDay->rest_day_date)->format('Y-m-d') : '');
            $sheet->setCellValue('F' . $row, $cancelRestDay->replacement_work_date ? Carbon::parse($cancelRestDay->replacement_work_date)->format('Y-m-d') : '');
            $sheet->setCellValue('G' . $row, $cancelRestDay->reason);
            $sheet->setCellValue('H' . $row, ucfirst($cancelRestDay->status));
            $sheet->setCellValue('I' . $row, $cancelRestDay->approver ? $cancelRestDay->approver->name : '');
            $sheet->setCellValue('J' . $row, $cancelRestDay->approved_at ? Carbon::parse($cancelRestDay->approved_at)->format('Y-m-d H:i:s') : '');
            $sheet->setCellValue('K' . $row, $cancelRestDay->remarks);
            $sheet->setCellValue('L' . $row, $cancelRestDay->created_at ? Carbon::parse($cancelRestDay->created_at)->format('Y-m-d H:i:s') : '');
            $row++;
        }
        
        // Auto-size columns
        foreach (range('A', 'L') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
        
        // Create writer and save
        $writer = new Xlsx($spreadsheet);
        $filename = 'Cancel_Rest_Day_' . date('Y-m-d_H-i-s') . '.xlsx';
        
        $tempFile = tempnam(sys_get_temp_dir(), 'cancelrestday_export_');
        $writer->save($tempFile);
        
        return response()->download($tempFile, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /**
     * Force approve cancel rest day requests (admin only).
     */
    public function forceApprove(Request $request)
    {
        // Ensure only superadmins can force approve
        if (!$this->isSuperAdmin(Auth::user())) {
            return back()->with('error', 'Only administrators can force approve cancel rest day requests.');
        }
        
        $validated = $request->validate([
            'cancel_rest_day_ids' => 'required|array',
            'cancel_rest_day_ids.*' => 'required|integer|exists:cancel_rest_days,id',
            'remarks' => 'nullable|string|max:500',
        ]);
        
        $user = Auth::user();
        $remarks = $validated['remarks'] ?? 'Administrative override: Force approved by admin';
        $successCount = 0;
        $failCount = 0;
        $errors = [];
        
        // Log the force approval action
        \Log::info('Force approval of cancel rest day initiated', [
            'admin_id' => $user->id,
            'admin_name' => $user->name,
            'count' => count($validated['cancel_rest_day_ids'])
        ]);
        
        foreach ($validated['cancel_rest_day_ids'] as $cancelRestDayId) {
            try {
                $cancelRestDay = CancelRestDay::findOrFail($cancelRestDayId);
                
                // Skip already approved requests
                if ($cancelRestDay->status === 'approved') {
                    $errors[] = "Cancel rest day #{$cancelRestDayId} is already approved";
                    $failCount++;
                    continue;
                }
                
                // Force approve
                $cancelRestDay->status = 'approved';
                $cancelRestDay->approved_by = $user->id;
                $cancelRestDay->approved_at = now();
                $cancelRestDay->remarks = 'Administrative override: ' . $remarks;
                $cancelRestDay->save();
                
                $successCount++;
                
                // Log individual approvals
                \Log::info("Force approved cancel rest day #{$cancelRestDayId}", [
                    'admin_id' => $user->id,
                    'cancel_rest_day_id' => $cancelRestDayId,
                    'previous_status' => $cancelRestDay->getOriginal('status')
                ]);
            } catch (\Exception $e) {
                \Log::error("Error force approving cancel rest day #{$cancelRestDayId}: " . $e->getMessage());
                $failCount++;
                $errors[] = "Error force approving cancel rest day #{$cancelRestDayId}: " . $e->getMessage();
            }
        }
        
        // Create appropriate flash message
        $message = "{$successCount} cancel rest day requests force approved successfully.";
        if ($failCount > 0) {
            $message .= " {$failCount} force approvals failed.";
        }
        
        // Return with message
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