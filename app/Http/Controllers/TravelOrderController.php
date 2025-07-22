<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\TravelOrder;
use App\Models\Employee;
use App\Models\Department;
use App\Models\DepartmentManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class TravelOrderController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        $userRoles = $this->getUserRoles($user);
        
        // Get all active departments
        $departments = Department::where('is_active', true)
            ->orderBy('name')
            ->pluck('name')
            ->toArray();
            
        // Get transportation types
        $transportationTypes = [
            'Company Vehicle',
            'Public Transportation',
            'Personal Vehicle',
            'Airplane',
            'Train',
            'Bus',
            'Others'
        ];
        
        // Query travel orders based on user role
        $travelOrdersQuery = TravelOrder::with(['employee', 'creator', 'approver', 'forceApprover']);
        
        // Filter based on user roles
        if ($userRoles['isEmployee'] && !$userRoles['isDepartmentManager'] && !$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
            // Regular employees can only see their own travel orders
            $employeeId = $user->employee ? $user->employee->id : null;
            if ($employeeId) {
                $travelOrdersQuery->where('employee_id', $employeeId);
            } else {
                // If no employee record linked, show travel orders created by this user
                $travelOrdersQuery->where('created_by', $user->id);
            }
        } elseif ($userRoles['isDepartmentManager'] && !$userRoles['isSuperAdmin']) {
            // Department managers can see travel orders for their department employees
            $managedDepartments = DepartmentManager::where('manager_id', $user->id)
                ->pluck('department')
                ->toArray();
                
            $travelOrdersQuery->where(function($query) use ($user, $managedDepartments) {
                $query->where('created_by', $user->id)
                    ->orWhereHas('employee', function($q) use ($managedDepartments) {
                        $q->whereIn('Department', $managedDepartments);
                    });
            });
        } elseif ($userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
            // HRD managers can see all travel orders
            // No additional filtering needed
        }
        
        // Sort by latest first
        $travelOrdersQuery->orderBy('created_at', 'desc');
        
        // Get active employees for the form
        $employees = Employee::where('JobStatus', 'Active')
            ->whereHas('department', function($query) {
                $query->where('is_active', true);
            })
            ->orderBy('Lname')
            ->get();
            
        // Check if a specific travel order is selected for viewing
        $selectedId = $request->input('selected');
        $selectedTravelOrder = null;
        
        if ($selectedId) {
            $selectedTravelOrder = TravelOrder::with(['employee', 'creator', 'approver', 'forceApprover'])
                ->find($selectedId);
        }
        
        // Get the list of travel orders
        $travelOrders = $travelOrdersQuery->get();
        
        return inertia('TravelOrder/TravelOrderPage', [
            'auth' => [
                'user' => $user,
            ],
            'travelOrders' => $travelOrders,
            'employees' => $employees,
            'departments' => $departments,
            'transportationTypes' => $transportationTypes,
            'selectedTravelOrder' => $selectedTravelOrder,
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

    private function isHrdManager($user)
    {
        // First try checking through the roles relationship
        if (method_exists($user, 'roles') && $user->roles && $user->roles->count() > 0) {
            if ($user->roles->contains('name', 'hrd_manager') || $user->roles->contains('slug', 'hrd')) {
                return true;
            }
        }
        
        // Then try the hasRole method
        if (method_exists($user, 'hasRole') && $user->hasRole('hrd_manager')) {
            return true;
        }
        
        // Fallback check by name or email
        if (stripos($user->name, 'hrd manager') !== false || 
            stripos($user->email, 'hrd@') !== false ||
            stripos($user->email, 'hrdmanager') !== false) {
            return true;
        }
        
        return false;
    }

    private function isSuperAdmin($user)
    {
        // First try checking through the roles relationship
        if (method_exists($user, 'roles') && $user->roles && $user->roles->count() > 0) {
            if ($user->roles->contains('name', 'superadmin') || $user->roles->contains('slug', 'superadmin')) {
                return true;
            }
        }
        
        // Then try the hasRole method
        if (method_exists($user, 'hasRole') && $user->hasRole('superadmin')) {
            return true;
        }
        
        // Fallback check by user ID or name
        if ($user->id === 1 || stripos($user->name, 'admin') !== false) {
            return true;
        }
        
        return false;
    }

    // Updated TravelOrderController store method with proper validation
    public function store(Request $request)
    {
        // Debug logging
        Log::info('Travel Order Store Request Data:', $request->all());
        
        try {
            $validated = $request->validate([
                'employee_ids' => 'required|array|min:1',
                'employee_ids.*' => 'required|integer|exists:employees,id',
                /* 'start_date' => 'required|date|after_or_equal:today',
                'end_date' => 'required|date|after_or_equal:start_date', */
                'start_date' => 'required|date',
                'end_date' => 'required|date',
                'departure_time' => 'nullable|string',
                'return_time' => 'nullable|string',
                'destination' => 'required|string|max:255',
                'transportation_type' => 'required|string|max:100',
                'purpose' => 'required|string|max:1000',
                'accommodation_required' => 'sometimes|in:0,1,true,false',
                'meal_allowance' => 'sometimes|in:0,1,true,false',
                'return_to_office' => 'sometimes|in:0,1,true,false',
                'other_expenses' => 'nullable|string|max:500',
                'estimated_cost' => 'nullable|numeric|min:0',
                'office_return_time' => 'nullable|string',
                'documents' => 'nullable|array',
                'documents.*' => 'file|mimes:pdf,doc,docx,jpg,jpeg,png|max:5120', // 5MB max per file
            ]);
            
            Log::info('Travel Order Validation Passed:', $validated);
            
            // Convert string boolean values to actual booleans
            $validated['accommodation_required'] = $this->convertToBoolean($validated['accommodation_required'] ?? false);
            $validated['meal_allowance'] = $this->convertToBoolean($validated['meal_allowance'] ?? false);
            $validated['return_to_office'] = $this->convertToBoolean($validated['return_to_office'] ?? false);
            
            // Additional validation for office return time
            if ($validated['return_to_office'] && empty($validated['office_return_time'])) {
                return back()->withErrors([
                    'office_return_time' => 'Office return time is required when "Return to Office" is checked.'
                ])->withInput();
            }
            
            Log::info('Travel Order After Boolean Conversion:', $validated);
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('Travel Order Validation Failed:', $e->errors());
            return back()->withErrors($e->errors())->withInput();
        }
        
        $user = Auth::user();
        $userRoles = $this->getUserRoles($user);
        $isDepartmentManager = $userRoles['isDepartmentManager'];
        
        $successCount = 0;
        $skippedCount = 0;
        $errorMessages = [];
        
        DB::beginTransaction();
        
        try {
            foreach ($validated['employee_ids'] as $employeeId) {
                $employee = Employee::with('department')->find($employeeId);
                
                if (!$employee) {
                    $errorMessages[] = "Employee ID $employeeId not found";
                    continue;
                }
                
                // Check if employee belongs to an active department
                if (!$employee->department || !$employee->department->is_active) {
                    $errorMessages[] = "Employee {$employee->Fname} {$employee->Lname} belongs to an inactive department";
                    continue;
                }
                
                // Check for overlapping travel orders
                $overlappingTravel = TravelOrder::where('employee_id', $employeeId)
                    ->where('status', '!=', 'rejected')
                    ->where(function($query) use ($validated) {
                        $query->whereBetween('start_date', [$validated['start_date'], $validated['end_date']])
                              ->orWhereBetween('end_date', [$validated['start_date'], $validated['end_date']])
                              ->orWhere(function($q) use ($validated) {
                                  $q->where('start_date', '<=', $validated['start_date'])
                                    ->where('end_date', '>=', $validated['end_date']);
                              });
                    })
                    ->first();
                
                if ($overlappingTravel) {
                    $skippedCount++;
                    $errorMessages[] = "Travel order for {$employee->Fname} {$employee->Lname} overlaps with existing travel from {$overlappingTravel->start_date} to {$overlappingTravel->end_date}";
                    continue;
                }
                
                // Calculate total days and working days
                $startDate = Carbon::parse($validated['start_date']);
                $endDate = Carbon::parse($validated['end_date']);
                $totalDays = $startDate->diffInDays($endDate) + 1;
                $workingDays = $this->calculateWorkingDays($startDate, $endDate);
                
                // Handle time conversion - ensure proper format
                $departureTime = null;
                $returnTime = null;
                $officeReturnTime = null;
                
                if (!empty($validated['departure_time'])) {
                    try {
                        $departureTime = $this->convertTimeToDateTime($validated['departure_time'], $validated['start_date']);
                    } catch (\Exception $e) {
                        Log::warning('Invalid departure time format: ' . $validated['departure_time']);
                    }
                }
                
                if (!empty($validated['return_time'])) {
                    try {
                        $returnTime = $this->convertTimeToDateTime($validated['return_time'], $validated['end_date']);
                    } catch (\Exception $e) {
                        Log::warning('Invalid return time format: ' . $validated['return_time']);
                    }
                }
                
                if (!empty($validated['office_return_time']) && $validated['return_to_office']) {
                    try {
                        $officeReturnTime = $this->convertTimeToDateTime($validated['office_return_time'], $validated['end_date']);
                    } catch (\Exception $e) {
                        Log::warning('Invalid office return time format: ' . $validated['office_return_time']);
                    }
                }
                
                // Determine if this is a full day travel or partial day
                $isFullDay = $this->determineIfFullDay(
                    $validated['departure_time'] ?? null,
                    $validated['return_time'] ?? null,
                    $validated['return_to_office'] ?? false,
                    $validated['office_return_time'] ?? null
                );
                
                // Handle document uploads
                $documentPaths = [];
                if ($request->hasFile('documents')) {
                    foreach ($request->file('documents') as $file) {
                        try {
                            $filename = time() . '_' . uniqid() . '_' . $file->getClientOriginalName();
                            $path = $file->storeAs('travel_orders', $filename, 'public');
                            $documentPaths[] = $path;
                        } catch (\Exception $e) {
                            Log::error('Error uploading document: ' . $e->getMessage());
                            $errorMessages[] = "Failed to upload document: " . $file->getClientOriginalName();
                        }
                    }
                }
                
                // Create travel order
                $travelOrder = new TravelOrder();
                $travelOrder->employee_id = $employeeId;
                $travelOrder->start_date = $validated['start_date'];
                $travelOrder->end_date = $validated['end_date'];
                $travelOrder->departure_time = $departureTime;
                $travelOrder->return_time = $returnTime;
                $travelOrder->destination = $validated['destination'];
                $travelOrder->transportation_type = $validated['transportation_type'];
                $travelOrder->purpose = $validated['purpose'];
                $travelOrder->accommodation_required = $validated['accommodation_required'];
                $travelOrder->meal_allowance = $validated['meal_allowance'];
                $travelOrder->other_expenses = $validated['other_expenses'];
                $travelOrder->estimated_cost = $validated['estimated_cost'];
                $travelOrder->return_to_office = $validated['return_to_office'];
                $travelOrder->office_return_time = $officeReturnTime;
                $travelOrder->total_days = $totalDays;
                $travelOrder->working_days = $workingDays;
                $travelOrder->is_full_day = $isFullDay;
                $travelOrder->created_by = $user->id;
                $travelOrder->document_paths = !empty($documentPaths) ? json_encode($documentPaths) : null;
                
                // Set initial status based on user role and permissions
                if ($isDepartmentManager && 
                    ($employeeId == $userRoles['employeeId'] || 
                     ($employee->Department && in_array($employee->Department, $userRoles['managedDepartments'])))) {
                    // Auto-approve for department manager's own travel or their department
                    $travelOrder->status = 'approved';
                    $travelOrder->approved_by = $user->id;
                    $travelOrder->approved_at = now();
                    $travelOrder->remarks = 'Auto-approved (Department Manager)';
                } else {
                    $travelOrder->status = 'pending';
                }
                
                Log::info('Saving travel order for employee: ' . $employeeId, $travelOrder->toArray());
                
                $travelOrder->save();
                $successCount++;
                
                Log::info('Travel order saved successfully with ID: ' . $travelOrder->id);
            }
            
            DB::commit();
            
            $message = "Successfully created {$successCount} travel order(s)";
            if ($skippedCount > 0) {
                $message .= ". Skipped {$skippedCount} overlapping entries.";
            }
            
            if (!empty($errorMessages)) {
                return back()->with([
                    'message' => $message,
                    'errors' => $errorMessages
                ])->withInput();
            }
            
            return back()->with('message', $message);
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Travel Order Creation Error: ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return back()->with('error', 'Error creating travel orders: ' . $e->getMessage())->withInput();
        }
    }

    private function convertToBoolean($value)
{
    // If already boolean, return as is
    if (is_bool($value)) {
        return $value;
    }
    
    // Handle null/empty values
    if (is_null($value) || $value === '') {
        return false;
    }
    
    // Handle string values
    if (is_string($value)) {
        $value = strtolower(trim($value));
        
        // True values
        if (in_array($value, ['true', '1', 'yes', 'on', 'checked'], true)) {
            return true;
        }
        
        // False values
        if (in_array($value, ['false', '0', 'no', 'off', 'unchecked', ''], true)) {
            return false;
        }
    }
    
    // Handle numeric values
    if (is_numeric($value)) {
        return (bool) intval($value);
    }
    
    // Default fallback - convert to boolean
    return (bool) $value;
}

    private function convertTimeToDateTime($timeString, $date)
    {
        if (empty($timeString)) {
            return null;
        }
        
        // Remove any extra whitespace
        $timeString = trim($timeString);
        
        // Handle different time formats
        if (preg_match('/^\d{2}:\d{2}$/', $timeString)) {
            // Format: HH:MM
            return Carbon::createFromFormat('Y-m-d H:i', $date . ' ' . $timeString);
        } elseif (preg_match('/^\d{2}:\d{2}:\d{2}$/', $timeString)) {
            // Format: HH:MM:SS
            return Carbon::createFromFormat('Y-m-d H:i:s', $date . ' ' . $timeString);
        }
        
        // If format doesn't match, try to parse it anyway
        try {
            return Carbon::createFromFormat('Y-m-d H:i', $date . ' ' . $timeString);
        } catch (\Exception $e) {
            Log::warning('Could not parse time string: ' . $timeString);
            return null;
        }
    }

    /**
     * Calculate working days between two dates (excluding weekends)
     */
    private function calculateWorkingDays($startDate, $endDate)
    {
        $workingDays = 0;
        $current = $startDate->copy();
        
        while ($current->lte($endDate)) {
            // Skip weekends (Saturday = 6, Sunday = 0)
            if (!in_array($current->dayOfWeek, [0, 6])) {
                // Also check if it's not a holiday
                if (!$this->isHoliday($current->toDateString())) {
                    $workingDays++;
                }
            }
            $current->addDay();
        }
        
        return $workingDays;
    }

    /**
     * Determine if this is a full day travel based on business rules
     */
    private function determineIfFullDay($departureTime, $returnTime, $returnToOffice, $officeReturnTime)
    {
        // If no times specified, assume full day
        if (!$departureTime || !$returnTime) {
            return true;
        }
        
        try {
            // Parse times - handle string format
            $departure = Carbon::createFromFormat('H:i', substr($departureTime, 0, 5));
            $return = Carbon::createFromFormat('H:i', substr($returnTime, 0, 5));
            
            // If they return to office, check if they have significant office time
            if ($returnToOffice && $officeReturnTime) {
                $officeReturn = Carbon::createFromFormat('H:i', substr($officeReturnTime, 0, 5));
                $officeHours = $return->diffInHours($officeReturn);
                
                // If they return to office for less than 3 hours, count as full day
                if ($officeHours < 3) {
                    return true;
                }
                
                // If travel + office time is more than 8 hours total, count as full day
                $travelHours = $departure->diffInHours($return);
                if (($travelHours + $officeHours) >= 8) {
                    return true;
                }
                
                return false; // Partial day if significant office work
            }
            
            // If travel duration is 5+ hours, count as full day
            $travelHours = $departure->diffInHours($return);
            if ($travelHours >= 5) {
                return true;
            }
            
            // If travel starts before 9 AM or ends after 3 PM, likely full day
            if ($departure->hour < 9 || $return->hour >= 15) {
                return true;
            }
            
            return false; // Otherwise partial day
            
        } catch (\Exception $e) {
            Log::warning('Error determining full day status: ' . $e->getMessage());
            return true; // Default to full day if can't determine
        }
    }

    /**
     * Check if the given date is a holiday
     */
    private function isHoliday($date)
    {
        $holidays = [
            '2025-01-01', // New Year's Day
            '2025-04-09', // Araw ng Kagitingan
            '2025-04-18', // Good Friday
            '2025-05-01', // Labor Day
            '2025-06-12', // Independence Day
            '2025-08-25', // National Heroes Day
            '2025-11-30', // Bonifacio Day
            '2025-12-25', // Christmas Day
            '2025-12-30', // Rizal Day
        ];
        
        return in_array($date, $holidays);
    }

    public function updateStatus(Request $request, TravelOrder $travelOrder)
{
    $user = Auth::user();
    
    $validated = $request->validate([
        'status' => 'required|in:approved,rejected,completed,cancelled,force_approved',
        'remarks' => 'nullable|string|max:500',
    ]);

    // Check permission
    $canUpdate = false;
    
    // Check if force approval is only used by superadmin
    if ($validated['status'] === 'force_approved') {
        if (!$this->isSuperAdmin($user)) {
            return response()->json([
                'message' => 'Only superadmin can force approve travel orders.',
                'success' => false
            ], 403);
        }
        $canUpdate = true;
    } elseif ($this->isHrdManager($user) || $this->isSuperAdmin($user)) {
        $canUpdate = true;
    }

    if (!$canUpdate) {
        return response()->json([
            'message' => 'You are not authorized to update this travel order status.',
            'success' => false
        ], 403);
    }

    // Log the action for debugging
    \Log::info('Updating travel order status', [
        'travel_order_id' => $travelOrder->id,
        'current_status' => $travelOrder->status,
        'new_status' => $validated['status'],
        'user_id' => $user->id,
        'user_name' => $user->name,
        'remarks' => $validated['remarks']
    ]);

    try {
        DB::beginTransaction();
        
        $actualStatus = $validated['status'] === 'force_approved' ? 'approved' : $validated['status'];
        
        $travelOrder->status = $actualStatus;
        $travelOrder->remarks = $validated['remarks'];
        
        if (in_array($validated['status'], ['approved', 'rejected', 'completed', 'cancelled', 'force_approved'])) {
            $travelOrder->approved_by = $user->id;
            $travelOrder->approved_at = now();
        }

        // If this is a force approval, set the force approval fields
        if ($validated['status'] === 'force_approved') {
            $travelOrder->force_approved = true;
            $travelOrder->force_approved_by = $user->id;
            $travelOrder->force_approved_at = now();
            $travelOrder->force_approve_remarks = $validated['remarks'] ?? 'Force approved by admin';
        }
        
        $travelOrder->save();
        
        DB::commit();

        // For AJAX requests, return JSON response
        if ($request->expectsJson()) {
            // Get fresh travel order data for the response
            $travelOrder = TravelOrder::with(['employee', 'creator', 'approver', 'forceApprover'])
                ->find($travelOrder->id);

            return response()->json([
                'message' => 'Travel order status updated successfully.',
                'success' => true,
                'travelOrder' => $travelOrder
            ]);
        }

        // For regular requests, redirect back with fresh data
        $freshTravelOrders = $this->getFreshTravelOrdersForUser($user);
        
        return redirect()->back()->with([
            'message' => 'Travel order status updated successfully.',
            'travelOrders' => $freshTravelOrders
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        
        \Log::error('Failed to update travel order status', [
            'travel_order_id' => $travelOrder->id,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        
        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Failed to update travel order status: ' . $e->getMessage(),
                'success' => false
            ], 500);
        }
        
        return redirect()->back()->with('error', 'Failed to update travel order status: ' . $e->getMessage());
    }
}

private function getFreshTravelOrdersForUser($user)
{
    $userRoles = $this->getUserRoles($user);
    
    $travelOrdersQuery = TravelOrder::with(['employee', 'creator', 'approver', 'forceApprover']);
    
    // Filter based on user roles (same logic as index method)
    if ($userRoles['isEmployee'] && !$userRoles['isDepartmentManager'] && !$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
        $employeeId = $user->employee ? $user->employee->id : null;
        if ($employeeId) {
            $travelOrdersQuery->where('employee_id', $employeeId);
        } else {
            $travelOrdersQuery->where('created_by', $user->id);
        }
    } elseif ($userRoles['isDepartmentManager'] && !$userRoles['isSuperAdmin']) {
        $managedDepartments = DepartmentManager::where('manager_id', $user->id)
            ->pluck('department')
            ->toArray();
            
        $travelOrdersQuery->where(function($query) use ($user, $managedDepartments) {
            $query->where('created_by', $user->id)
                ->orWhereHas('employee', function($q) use ($managedDepartments) {
                    $q->whereIn('Department', $managedDepartments);
                });
        });
    }
    
    return $travelOrdersQuery->orderBy('created_at', 'desc')->get();
}

    public function bulkUpdateStatus(Request $request)
{
    $user = Auth::user();
    
    $validated = $request->validate([
        'travel_order_ids' => 'required|array',
        'travel_order_ids.*' => 'required|integer|exists:travel_orders,id',
        'status' => 'required|in:approved,rejected,completed,cancelled,force_approved',
        'remarks' => 'nullable|string|max:500',
    ]);

    // Check permission
    if (!$this->isHrdManager($user) && !$this->isSuperAdmin($user)) {
        return response()->json([
            'message' => 'You are not authorized to update travel order status.',
            'success' => false
        ], 403);
    }

    // Check if force_approved is only used by superadmin
    if ($validated['status'] === 'force_approved' && !$this->isSuperAdmin($user)) {
        return response()->json([
            'message' => 'Only superadmin can force approve travel orders.',
            'success' => false
        ], 403);
    }

    \Log::info('Bulk update of travel order statuses initiated', [
        'user_id' => $user->id,
        'user_name' => $user->name,
        'count' => count($validated['travel_order_ids']),
        'target_status' => $validated['status'],
        'remarks' => $validated['remarks']
    ]);

    $successCount = 0;
    $failCount = 0;
    $errors = [];

    DB::beginTransaction();
    
    try {
        $actualStatus = $validated['status'] === 'force_approved' ? 'approved' : $validated['status'];
        
        foreach ($validated['travel_order_ids'] as $travelOrderId) {
            try {
                $travelOrder = TravelOrder::findOrFail($travelOrderId);
                
                $updateData = [
                    'status' => $actualStatus,
                    'remarks' => $validated['remarks'],
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                ];

                // If this is a force approval, add force approval fields
                if ($validated['status'] === 'force_approved') {
                    $updateData['force_approved'] = true;
                    $updateData['force_approved_by'] = $user->id;
                    $updateData['force_approved_at'] = now();
                    $updateData['force_approve_remarks'] = $validated['remarks'] ?? 'Force approved by admin';
                }

                $travelOrder->update($updateData);
                $successCount++;

                \Log::info("Successfully updated travel order #{$travelOrderId}", [
                    'from_status' => $travelOrder->getOriginal('status'),
                    'to_status' => $actualStatus,
                    'by_user' => $user->name
                ]);
            } catch (\Exception $e) {
                $failCount++;
                $errors[] = "Error updating travel order #{$travelOrderId}: " . $e->getMessage();
                \Log::error("Error updating travel order #{$travelOrderId}: " . $e->getMessage());
            }
        }

        DB::commit();

        $actionText = $validated['status'] === 'force_approved' ? 'force approved' : $actualStatus;
        $message = "Successfully {$actionText} {$successCount} travel order(s).";
        
        if ($failCount > 0) {
            $message .= " {$failCount} updates failed.";
        }

        // For AJAX requests, return JSON response
        if ($request->expectsJson()) {
            return response()->json([
                'message' => $message,
                'success' => true,
                'errors' => $errors,
                'successCount' => $successCount,
                'failCount' => $failCount
            ]);
        }

        // For regular requests, redirect back with fresh data
        $freshTravelOrders = $this->getFreshTravelOrdersForUser($user);
        
        return redirect()->back()->with([
            'message' => $message,
            'travelOrders' => $freshTravelOrders
        ]);

    } catch (\Exception $e) {
        DB::rollBack();
        
        \Log::error('Error during bulk travel order update', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Error updating travel order statuses: ' . $e->getMessage(),
                'success' => false
            ], 500);
        }

        return redirect()->back()->with('error', 'Error updating travel order statuses: ' . $e->getMessage());
    }
}

    /**
     * Force approve travel orders (Superadmin only)
     */
    /**
 * Force approve travel orders (Superadmin only)
 */
public function forceApprove(Request $request)
{
    $user = Auth::user();
    
    // Check if user is superadmin
    if (!$this->isSuperAdmin($user)) {
        return redirect()->back()->with('error', 'Only superadmin can force approve travel orders.');
    }
    
    $validated = $request->validate([
        'travel_order_ids' => 'required|array',
        'travel_order_ids.*' => 'required|integer|exists:travel_orders,id',
        'remarks' => 'required|string|max:500',
    ]);

    // Log the force approval action
    \Log::info('Force approval of travel orders initiated', [
        'admin_id' => $user->id,
        'admin_name' => $user->name,
        'count' => count($validated['travel_order_ids'])
    ]);

    $successCount = 0;
    $failCount = 0;
    $errors = [];

    DB::beginTransaction();
    
    try {
        foreach ($validated['travel_order_ids'] as $travelOrderId) {
            try {
                $travelOrder = TravelOrder::findOrFail($travelOrderId);
                
                // Skip already approved travel orders
                if ($travelOrder->status === 'approved') {
                    $errors[] = "Travel order #{$travelOrderId} is already approved";
                    $failCount++;
                    continue;
                }
                
                // Force approve - set all necessary approval information
                $travelOrder->update([
                    'status' => 'approved',
                    'approved_by' => $user->id,
                    'approved_at' => now(),
                    'force_approved' => true,
                    'force_approved_by' => $user->id,
                    'force_approved_at' => now(),
                    'force_approve_remarks' => $validated['remarks'],
                    'remarks' => $validated['remarks'],
                ]);
                
                $successCount++;
                
                // Log individual approvals
                \Log::info("Force approved travel order #{$travelOrderId}", [
                    'admin_id' => $user->id,
                    'travel_order_id' => $travelOrderId,
                    'previous_status' => $travelOrder->getOriginal('status')
                ]);
            } catch (\Exception $e) {
                \Log::error("Error force approving travel order #{$travelOrderId}: " . $e->getMessage());
                $failCount++;
                $errors[] = "Error force approving travel order #{$travelOrderId}: " . $e->getMessage();
            }
        }
        
        DB::commit();
        
        // Create appropriate flash message
        $message = "{$successCount} travel orders force approved successfully.";
        if ($failCount > 0) {
            $message .= " {$failCount} force approvals failed.";
        }
        
        // Return JSON response for AJAX requests
        if ($request->expectsJson()) {
            return response()->json([
                'message' => $message,
                'errors' => $errors,
                'success' => true
            ]);
        }
        
        return redirect()->back()->with([
            'message' => $message,
            'errors' => $errors
        ]);
        
    } catch (\Exception $e) {
        DB::rollBack();
        
        \Log::error('Error during force approval', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);

        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Error force approving travel orders: ' . $e->getMessage(),
                'success' => false
            ], 500);
        }

        return redirect()->back()->with('error', 'Error force approving travel orders: ' . $e->getMessage());
    }
}

/**
 * Remove the specified travel order.
 */
public function destroy($id)
{
    try {
        $user = Auth::user();
        
        // Find the travel order
        $travelOrder = TravelOrder::findOrFail($id);
        
        // Check authorization
        $canDelete = false;
        $userRoles = $this->getUserRoles($user);
        
        // Allow deletion if:
        // 1. User is superadmin or HRD manager
        // 2. User created the travel order and it's still pending
        // 3. User is department manager and manages the employee's department (and order is pending)
        if ($userRoles['isSuperAdmin'] || $userRoles['isHrdManager']) {
            $canDelete = true;
        } elseif ($travelOrder->created_by === $user->id && $travelOrder->status === 'pending') {
            $canDelete = true;
        } elseif ($userRoles['isDepartmentManager'] && $travelOrder->status === 'pending') {
            $employeeDepartment = $travelOrder->employee ? $travelOrder->employee->Department : null;
            if ($employeeDepartment && in_array($employeeDepartment, $userRoles['managedDepartments'])) {
                $canDelete = true;
            }
        }
        
        if (!$canDelete) {
            if (request()->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not authorized to delete this travel order'
                ], 403);
            }
            return back()->with('error', 'You are not authorized to delete this travel order');
        }
        
        // Delete associated documents
        if ($travelOrder->document_paths) {
            $documentPaths = json_decode($travelOrder->document_paths, true);
            if (is_array($documentPaths)) {
                foreach ($documentPaths as $path) {
                    try {
                        Storage::disk('public')->delete($path);
                    } catch (\Exception $e) {
                        \Log::warning('Failed to delete document file: ' . $path);
                    }
                }
            }
        }
        
        // Delete the travel order
        $travelOrder->delete();
        
        \Log::info('Travel order deleted successfully', [
            'travel_order_id' => $travelOrder->id,
            'deleted_by' => $user->id,
            'deleted_by_name' => $user->name
        ]);
        
        if (request()->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Travel order deleted successfully'
            ]);
        }
        
        return back()->with('message', 'Travel order deleted successfully');
        
    } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
        \Log::error('Travel order not found for deletion', [
            'travel_order_id' => $id,
            'user_id' => Auth::id()
        ]);
        
        if (request()->expectsJson()) {
            return response()->json([
                'success' => false,
                'message' => 'Travel order not found'
            ], 404);
        }
        
        return back()->with('error', 'Travel order not found');
        
    } catch (\Exception $e) {
        \Log::error('Failed to delete travel order', [
            'travel_order_id' => $id,
            'error' => $e->getMessage(),
            'user_id' => Auth::id()
        ]);
        
        if (request()->expectsJson()) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete travel order: ' . $e->getMessage()
            ], 500);
        }
        
        return back()->with('error', 'Failed to delete travel order: ' . $e->getMessage());
    }
}

    public function export(Request $request)
    {
        $user = Auth::user();
        $userRoles = $this->getUserRoles($user);
        
        // Query travel orders based on user role (same logic as index)
        $travelOrdersQuery = TravelOrder::with(['employee', 'creator', 'approver']);
        
        // Apply same role-based filtering as index method
        if ($userRoles['isEmployee'] && !$userRoles['isDepartmentManager'] && !$userRoles['isHrdManager'] && !$userRoles['isSuperAdmin']) {
            $employeeId = $user->employee ? $user->employee->id : null;
            if ($employeeId) {
                $travelOrdersQuery->where('employee_id', $employeeId);
            } else {
                $travelOrdersQuery->where('created_by', $user->id);
            }
        } elseif ($userRoles['isDepartmentManager'] && !$userRoles['isSuperAdmin']) {
            $managedDepartments = DepartmentManager::where('manager_id', $user->id)
                ->pluck('department')
                ->toArray();
                
            $travelOrdersQuery->where(function($query) use ($user, $managedDepartments) {
                $query->where('created_by', $user->id)
                    ->orWhereHas('employee', function($q) use ($managedDepartments) {
                        $q->whereIn('Department', $managedDepartments);
                    });
            });
        }
        
        // Apply filters from request
        $filterStatus = $request->input('status');
        $searchTerm = $request->input('search');
        $fromDate = $request->input('from_date');
        $toDate = $request->input('to_date');
        
        if ($filterStatus) {
            $travelOrdersQuery->where('status', $filterStatus);
        }
        
        if ($searchTerm) {
            $travelOrdersQuery->where(function($query) use ($searchTerm) {
                $query->whereHas('employee', function($q) use ($searchTerm) {
                    $q->where('Fname', 'like', "%{$searchTerm}%")
                      ->orWhere('Lname', 'like', "%{$searchTerm}%")
                      ->orWhere('idno', 'like', "%{$searchTerm}%")
                      ->orWhere('Department', 'like', "%{$searchTerm}%");
                })
                ->orWhere('destination', 'like', "%{$searchTerm}%")
                ->orWhere('purpose', 'like', "%{$searchTerm}%");
            });
        }
        
        if ($fromDate) {
            $travelOrdersQuery->whereDate('start_date', '>=', $fromDate);
        }
        
        if ($toDate) {
            $travelOrdersQuery->whereDate('end_date', '<=', $toDate);
        }
        
        $travelOrders = $travelOrdersQuery->orderBy('created_at', 'desc')->get();
        
        // Create spreadsheet
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        
        // Set headers
        $sheet->setCellValue('A1', 'ID');
        $sheet->setCellValue('B1', 'Employee ID');
        $sheet->setCellValue('C1', 'Employee Name');
        $sheet->setCellValue('D1', 'Department');
        $sheet->setCellValue('E1', 'Start Date');
        $sheet->setCellValue('F1', 'End Date');
        $sheet->setCellValue('G1', 'Destination');
        $sheet->setCellValue('H1', 'Transportation');
        $sheet->setCellValue('I1', 'Purpose');
        $sheet->setCellValue('J1', 'Total Days');
        $sheet->setCellValue('K1', 'Working Days');
        $sheet->setCellValue('L1', 'Is Full Day');
        $sheet->setCellValue('M1', 'Return to Office');
        $sheet->setCellValue('N1', 'Accommodation');
        $sheet->setCellValue('O1', 'Meal Allowance');
        $sheet->setCellValue('P1', 'Estimated Cost');
        $sheet->setCellValue('Q1', 'Status');
        $sheet->setCellValue('R1', 'Filed By');
        $sheet->setCellValue('S1', 'Filed Date');
        $sheet->setCellValue('T1', 'Approved By');
        $sheet->setCellValue('U1', 'Approved Date');
        $sheet->setCellValue('V1', 'Remarks');
        $sheet->setCellValue('W1', 'Has Documents');
        $sheet->setCellValue('X1', 'Force Approved');
        $sheet->setCellValue('Y1', 'Force Approved By');
        $sheet->setCellValue('Z1', 'Force Approved Date');
        
        // Style header
        $headerStyle = [
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['rgb' => '4F81BD']],
            'borders' => ['allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN]],
        ];
        
        $sheet->getStyle('A1:Z1')->applyFromArray($headerStyle);
        
        // Add data
        $row = 2;
        foreach ($travelOrders as $travelOrder) {
            $sheet->setCellValue('A' . $row, $travelOrder->id);
            $sheet->setCellValue('B' . $row, $travelOrder->employee ? $travelOrder->employee->idno : '');
            $sheet->setCellValue('C' . $row, $travelOrder->employee ? $travelOrder->employee->Lname . ', ' . $travelOrder->employee->Fname : '');
            $sheet->setCellValue('D' . $row, $travelOrder->employee ? $travelOrder->employee->Department : '');
            $sheet->setCellValue('E' . $row, $travelOrder->start_date ? Carbon::parse($travelOrder->start_date)->format('Y-m-d') : '');
            $sheet->setCellValue('F' . $row, $travelOrder->end_date ? Carbon::parse($travelOrder->end_date)->format('Y-m-d') : '');
            $sheet->setCellValue('G' . $row, $travelOrder->destination);
            $sheet->setCellValue('H' . $row, $travelOrder->transportation_type);
            $sheet->setCellValue('I' . $row, $travelOrder->purpose);
            $sheet->setCellValue('J' . $row, $travelOrder->total_days);
            $sheet->setCellValue('K' . $row, $travelOrder->working_days);
            $sheet->setCellValue('L' . $row, $travelOrder->is_full_day ? 'Yes' : 'No');
            $sheet->setCellValue('M' . $row, $travelOrder->return_to_office ? 'Yes' : 'No');
            $sheet->setCellValue('N' . $row, $travelOrder->accommodation_required ? 'Yes' : 'No');
            $sheet->setCellValue('O' . $row, $travelOrder->meal_allowance ? 'Yes' : 'No');
            $sheet->setCellValue('P' . $row, $travelOrder->estimated_cost);
            $sheet->setCellValue('Q' . $row, $travelOrder->status);
            $sheet->setCellValue('R' . $row, $travelOrder->creator ? $travelOrder->creator->name : '');
            $sheet->setCellValue('S' . $row, $travelOrder->created_at ? Carbon::parse($travelOrder->created_at)->format('Y-m-d h:i A') : '');
            $sheet->setCellValue('T' . $row, $travelOrder->approver ? $travelOrder->approver->name : '');
            $sheet->setCellValue('U' . $row, $travelOrder->approved_at ? Carbon::parse($travelOrder->approved_at)->format('Y-m-d h:i A') : '');
            $sheet->setCellValue('V' . $row, $travelOrder->remarks);
            $sheet->setCellValue('W' . $row, $travelOrder->document_paths ? 'Yes' : 'No');
            $sheet->setCellValue('X' . $row, $travelOrder->force_approved ? 'Yes' : 'No');
            $sheet->setCellValue('Y' . $row, $travelOrder->forceApprover ? $travelOrder->forceApprover->name : '');
            $sheet->setCellValue('Z' . $row, $travelOrder->force_approved_at ? Carbon::parse($travelOrder->force_approved_at)->format('Y-m-d h:i A') : '');
            
            $row++;
        }
        
        // Auto-size columns
        foreach (range('A', 'Z') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
        
        // Create writer and download
        $writer = new Xlsx($spreadsheet);
        $filename = 'Travel_Orders_' . date('Y-m-d_H-i-s') . '.xlsx';
        
        $tempFile = tempnam(sys_get_temp_dir(), 'travel_order_export_');
        $writer->save($tempFile);
        
        return response()->download($tempFile, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /**
     * Download document attachment
     */
    /**
 * Download document attachment
 */
public function downloadDocument($id, $index)
{
    $travelOrder = TravelOrder::findOrFail($id);
    $user = Auth::user();
    
    // Check if user can access this travel order
    $userRoles = $this->getUserRoles($user);
    $canAccess = false;
    
    // Allow access if:
    // 1. User is superadmin or HRD manager
    // 2. User created the travel order
    // 3. User is the employee on the travel order
    // 4. User is a department manager who manages the employee's department
    if ($userRoles['isSuperAdmin'] || $userRoles['isHrdManager']) {
        $canAccess = true;
    } elseif ($travelOrder->created_by === $user->id) {
        $canAccess = true;
    } elseif ($travelOrder->employee_id === ($user->employee ? $user->employee->id : null)) {
        $canAccess = true;
    } elseif ($userRoles['isDepartmentManager']) {
        $employeeDepartment = $travelOrder->employee ? $travelOrder->employee->Department : null;
        if ($employeeDepartment && in_array($employeeDepartment, $userRoles['managedDepartments'])) {
            $canAccess = true;
        }
    }
    
    if (!$canAccess) {
        abort(403, 'Unauthorized access to document');
    }
    
    if (!$travelOrder->document_paths) {
        abort(404, 'No documents found');
    }
    
    // Parse the JSON document paths
    $documentPaths = json_decode($travelOrder->document_paths, true);
    
    // Check if parsing was successful
    if (!is_array($documentPaths)) {
        \Log::error('Failed to parse document paths', [
            'travel_order_id' => $id,
            'document_paths' => $travelOrder->document_paths
        ]);
        abort(404, 'Invalid document data');
    }
    
    // Check if the requested index exists
    if (!isset($documentPaths[$index])) {
        abort(404, 'Document not found at index ' . $index);
    }
    
    $path = $documentPaths[$index];
    $fullPath = storage_path('app/public/' . $path);
    
    if (!file_exists($fullPath)) {
        \Log::error('Document file not found', [
            'travel_order_id' => $id,
            'path' => $path,
            'full_path' => $fullPath
        ]);
        abort(404, 'Document file not found on server');
    }
    
    // Get the original filename from the path
    $filename = basename($path);
    
    // If the filename contains timestamp prefix, try to extract original name
    if (preg_match('/^\d+_[a-f0-9]+_(.+)$/', $filename, $matches)) {
        $filename = $matches[1];
    }
    
    // Return the file download response
    return response()->download($fullPath, $filename, [
        'Content-Type' => mime_content_type($fullPath),
        'Content-Disposition' => 'attachment; filename="' . $filename . '"'
    ]);
}
}