<?php

namespace App\Http\Controllers;

use App\Models\Deduction;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class DeductionController extends Controller
{
    /**
     * Display the deductions page with employee deductions data.
     */
    public function index(Request $request)
    {
        $cutoff = $request->input('cutoff', '1st');
        $month = $request->input('month', Carbon::now()->month);
        $year = $request->input('year', Carbon::now()->year);
        $search = $request->input('search', '');
        $perPage = $request->input('perPage', 50); // Default to 50 for virtualization
        
        // Build date range for selected month and cutoff
        $startDate = Carbon::createFromDate($year, $month, $cutoff === '1st' ? 1 : 16);
        $endDate = $cutoff === '1st' 
            ? Carbon::createFromDate($year, $month, 15)
            : Carbon::createFromDate($year, $month)->endOfMonth();
        
        // Query to get employees with deductions for the selected period
        $query = Employee::with(['deductions' => function ($query) use ($cutoff, $startDate, $endDate) {
                $query->where('cutoff', $cutoff)
                    ->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
                    ->latest('date');
            }])
            ->where('JobStatus', 'Active')
            ->select('id', 'idno', 'Lname', 'Fname', 'MName', 'Suffix', 'Department', 'JobStatus');
            
        // Apply search term if provided
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('Lname', 'like', "%{$search}%")
                  ->orWhere('Fname', 'like', "%{$search}%")
                  ->orWhere('idno', 'like', "%{$search}%")
                  ->orWhere('Department', 'like', "%{$search}%");
            });
        }
            
        // Get employees with pagination
        $employees = $query->paginate($perPage);
        
        // Get total count for various statuses
        $allDeductionsCount = Deduction::whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
            ->where('cutoff', $cutoff)
            ->count();
        
        $postedDeductionsCount = Deduction::whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
            ->where('cutoff', $cutoff)
            ->where('is_posted', true)
            ->count();
        
        // Return Inertia view with data
        return Inertia::render('Deductions/DeductionsPage', [
            'employees' => $employees,
            'cutoff' => $cutoff,
            'month' => $month,
            'year' => $year,
            'search' => $search,
            'status' => [
                'allCount' => $allDeductionsCount,
                'postedCount' => $postedDeductionsCount,
                'pendingCount' => $allDeductionsCount - $postedDeductionsCount,
            ],
            'dateRange' => [
                'start' => $startDate->format('Y-m-d'),
                'end' => $endDate->format('Y-m-d'),
            ],
            'auth' => [
                'user' => Auth::user(),
            ],
        ]);
    }

    /**
     * Store a newly created or update existing deduction in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'advance' => 'nullable|numeric|min:0',
            'charge_store' => 'nullable|numeric|min:0',
            'charge' => 'nullable|numeric|min:0',
            'meals' => 'nullable|numeric|min:0',
            'miscellaneous' => 'nullable|numeric|min:0',
            'other_deductions' => 'nullable|numeric|min:0',
            'cutoff' => 'required|in:1st,2nd',
            'date' => 'required|date',
            'is_default' => 'nullable|boolean',
        ]);
        
        // Check if the deduction is already posted
        if ($request->has('id')) {
            $existingDeduction = Deduction::find($request->input('id'));
            if ($existingDeduction && $existingDeduction->is_posted) {
                throw ValidationException::withMessages([
                    'general' => ['This deduction has been posted and cannot be updated.'],
                ]);
            }
        }
        
        // Set default values for null numeric fields
        foreach (['advance', 'charge_store', 'charge', 
                 'meals', 'miscellaneous', 'other_deductions'] as $field) {
            $validated[$field] = $validated[$field] ?? 0;
        }
        
        // Create or update the deduction
        if ($request->has('id')) {
            $deduction = Deduction::findOrFail($request->input('id'));
            $deduction->update($validated);
        } else {
            $deduction = Deduction::create($validated);
        }
        
        // Return the updated deduction
        return response()->json($deduction);
    }

    /**
     * Update the specified deduction in storage.
     */
    public function update(Request $request, $id)
    {
        $deduction = Deduction::findOrFail($id);
        
        // Check if the deduction is already posted
        if ($deduction->is_posted) {
            throw ValidationException::withMessages([
                'general' => ['This deduction has been posted and cannot be updated.'],
            ]);
        }
        
        $validated = $request->validate([
            'advance' => 'nullable|numeric|min:0',
            'charge_store' => 'nullable|numeric|min:0',
            'charge' => 'nullable|numeric|min:0',
            'meals' => 'nullable|numeric|min:0',
            'miscellaneous' => 'nullable|numeric|min:0',
            'other_deductions' => 'nullable|numeric|min:0',
        ]);
        
        // Set default values for null numeric fields
        foreach (['advance', 'charge_store', 'charge', 
                 'meals', 'miscellaneous', 'other_deductions'] as $field) {
            $validated[$field] = $validated[$field] ?? 0;
        }
        
        // Update the deduction
        $deduction->update($validated);
        
        // Return the updated deduction
        return response()->json($deduction);
    }

    /**
     * Update a single field in a deduction record
     */
    public function updateField(Request $request, $id)
    {
        $deduction = Deduction::findOrFail($id);
        
        // Check if the deduction is already posted
        if ($deduction->is_posted) {
            throw ValidationException::withMessages([
                'general' => ['This deduction has been posted and cannot be updated.'],
            ]);
        }
        
        $field = $request->input('field');
        $value = $request->input('value');
        
        // Validate that the field exists
        $allowedFields = [
            'advance', 'charge_store', 'charge', 'meals', 
            'miscellaneous', 'other_deductions'
        ];
        
        if (!in_array($field, $allowedFields)) {
            throw ValidationException::withMessages([
                'field' => ['Invalid field specified.'],
            ]);
        }
        
        // Validate the value
        $request->validate([
            'value' => 'nullable|numeric|min:0',
        ]);
        
        // Update the field
        $deduction->$field = $value ?? 0;
        $deduction->save();
        
        // Return the updated deduction
        return response()->json($deduction);
    }

    /**
     * Mark deduction as posted.
     */
    public function postDeduction($id)
    {
        $deduction = Deduction::findOrFail($id);
        
        // Check if already posted
        if ($deduction->is_posted) {
            throw ValidationException::withMessages([
                'general' => ['This deduction is already posted.'],
            ]);
        }
        
        // Post the deduction
        $deduction->is_posted = true;
        $deduction->date_posted = Carbon::now();
        $deduction->save();
        
        return response()->json($deduction);
    }

    /**
     * Post all deductions for a specific cutoff period.
     */
    public function postAll(Request $request)
    {
        $cutoff = $request->input('cutoff', '1st');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        
        if (!$startDate || !$endDate) {
            throw ValidationException::withMessages([
                'date' => ['Start date and end date are required.'],
            ]);
        }
        
        // Post all unposted deductions for the specified period
        $updatedCount = Deduction::whereBetween('date', [$startDate, $endDate])
            ->where('cutoff', $cutoff)
            ->where('is_posted', false)
            ->update([
                'is_posted' => true, 
                'date_posted' => Carbon::now()
            ]);
        
        return response()->json([
            'message' => "{$updatedCount} deductions have been successfully posted.",
            'updated_count' => $updatedCount
        ]);
    }

    /**
     * Post multiple deductions in bulk
     */
    public function bulkPost(Request $request)
    {
        $deductionIds = $request->input('deduction_ids', []);
        
        if (empty($deductionIds)) {
            throw ValidationException::withMessages([
                'deduction_ids' => ['No deductions selected for posting.'],
            ]);
        }
        
        // Begin transaction
        DB::beginTransaction();
        
        try {
            $postedCount = 0;
            $now = Carbon::now();
            
            foreach ($deductionIds as $id) {
                $deduction = Deduction::find($id);
                
                if ($deduction && !$deduction->is_posted) {
                    $deduction->is_posted = true;
                    $deduction->date_posted = $now;
                    $deduction->save();
                    $postedCount++;
                }
            }
            
            DB::commit();
            
            return response()->json([
                'message' => "{$postedCount} deductions have been successfully posted.",
                'posted_count' => $postedCount
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            
            throw ValidationException::withMessages([
                'general' => ['Failed to post deductions: ' . $e->getMessage()],
            ]);
        }
    }

    /**
     * Mark a deduction as default for an employee.
     */
    public function setDefault(Request $request, $id)
    {
        $deduction = Deduction::findOrFail($id);
        
        // Begin transaction to ensure atomicity
        DB::beginTransaction();
        
        try {
            // Remove other default deductions for this employee
            Deduction::where('employee_id', $deduction->employee_id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
            
            // Set this deduction as default
            $deduction->is_default = true;
            $deduction->save();
            
            DB::commit();
            
            return response()->json($deduction);
        } catch (\Exception $e) {
            DB::rollBack();
            
            throw ValidationException::withMessages([
                'general' => ['Failed to set default deduction: ' . $e->getMessage()],
            ]);
        }
    }

    /**
     * Set multiple deductions as default in bulk
     */
    public function bulkSetDefault(Request $request)
    {
        $deductionIds = $request->input('deduction_ids', []);
        
        if (empty($deductionIds)) {
            throw ValidationException::withMessages([
                'deduction_ids' => ['No deductions selected to set as default.'],
            ]);
        }
        
        // Begin transaction
        DB::beginTransaction();
        
        try {
            $updatedCount = 0;
            
            // Group deductions by employee_id
            $deductions = Deduction::whereIn('id', $deductionIds)->get();
            $employeeIds = $deductions->pluck('employee_id')->unique();
            
            // For each employee, clear existing defaults
            foreach ($employeeIds as $employeeId) {
                Deduction::where('employee_id', $employeeId)
                    ->where('is_default', true)
                    ->update(['is_default' => false]);
                
                // Find the deduction for this employee from our selection
                $deductionForEmployee = $deductions->firstWhere('employee_id', $employeeId);
                
                if ($deductionForEmployee) {
                    $deductionForEmployee->is_default = true;
                    $deductionForEmployee->save();
                    $updatedCount++;
                }
            }
            
            DB::commit();
            
            return response()->json([
                'message' => "{$updatedCount} deductions have been set as default.",
                'updated_count' => $updatedCount
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            
            throw ValidationException::withMessages([
                'general' => ['Failed to set default deductions: ' . $e->getMessage()],
            ]);
        }
    }

    /**
     * Create a new deduction entry based on defaults.
     */
    public function createFromDefault(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'cutoff' => 'required|in:1st,2nd',
            'date' => 'required|date',
        ]);
        
        // Begin transaction
        DB::beginTransaction();
        
        try {
            // Check if deduction already exists for this cutoff and date
            $existingDeduction = Deduction::where('employee_id', $validated['employee_id'])
                ->where('cutoff', $validated['cutoff'])
                ->where('date', $validated['date'])
                ->first();
                
            if ($existingDeduction) {
                DB::commit();
                return response()->json($existingDeduction);
            }
            
            // Get the default deduction for this employee
            $defaultDeduction = Deduction::where('employee_id', $validated['employee_id'])
                ->where('is_default', true)
                ->latest()
                ->first();
                
            if ($defaultDeduction) {
                // Create new deduction based on default values
                $deduction = new Deduction();
                $deduction->employee_id = $validated['employee_id'];
                $deduction->cutoff = $validated['cutoff'];
                $deduction->date = $validated['date'];
                $deduction->is_posted = false;
                $deduction->is_default = false;
                
                // Copy values from default deduction
                $deduction->advance = $defaultDeduction->advance;
                $deduction->charge_store = $defaultDeduction->charge_store;
                $deduction->charge = $defaultDeduction->charge;
                $deduction->meals = $defaultDeduction->meals;
                $deduction->miscellaneous = $defaultDeduction->miscellaneous;
                $deduction->other_deductions = $defaultDeduction->other_deductions;
                
                $deduction->save();
            } else {
                // If no default deduction exists, create an empty one
                $deduction = Deduction::create([
                    'employee_id' => $validated['employee_id'],
                    'cutoff' => $validated['cutoff'],
                    'date' => $validated['date'],
                    'is_posted' => false,
                    'is_default' => false
                ]);
            }
            
            DB::commit();
            return response()->json($deduction);
        } catch (\Exception $e) {
            DB::rollBack();
            
            throw ValidationException::withMessages([
                'general' => ['Failed to create deduction: ' . $e->getMessage()],
            ]);
        }
    }

    /**
     * Bulk create deduction entries for all active employees based on defaults.
     */
    public function bulkCreateFromDefault(Request $request)
    {
        $validated = $request->validate([
            'cutoff' => 'required|in:1st,2nd',
            'date' => 'required|date',
        ]);
        
        $cutoff = $validated['cutoff'];
        $date = $validated['date'];
        
        // Get all active employees
        $employees = Employee::where('JobStatus', 'Active')->get();
        $createdCount = 0;
        
        // Start transaction
        DB::beginTransaction();
        
        try {
            foreach ($employees as $employee) {
                // Check if a deduction already exists for this employee, cutoff, and date
                $existingDeduction = Deduction::where('employee_id', $employee->id)
                    ->where('cutoff', $cutoff)
                    ->where('date', $date)
                    ->first();
                
                if (!$existingDeduction) {
                    // Get default deduction for this employee
                    $defaultDeduction = Deduction::where('employee_id', $employee->id)
                        ->where('is_default', true)
                        ->latest()
                        ->first();
                    
                    if ($defaultDeduction) {
                        // Create new deduction based on default values
                        $deduction = new Deduction();
                        $deduction->employee_id = $employee->id;
                        $deduction->cutoff = $cutoff;
                        $deduction->date = $date;
                        $deduction->is_posted = false;
                        $deduction->is_default = false;
                        
                        // Copy values from default deduction
                        $deduction->advance = $defaultDeduction->advance;
                        $deduction->charge_store = $defaultDeduction->charge_store;
                        $deduction->charge = $defaultDeduction->charge;
                        $deduction->meals = $defaultDeduction->meals;
                        $deduction->miscellaneous = $defaultDeduction->miscellaneous;
                        $deduction->other_deductions = $defaultDeduction->other_deductions;
                        
                        $deduction->save();
                    } else {
                        // If no default exists, create an empty deduction
                        $deduction = Deduction::create([
                            'employee_id' => $employee->id,
                            'cutoff' => $cutoff,
                            'date' => $date,
                            'is_posted' => false,
                            'is_default' => false
                        ]);
                    }
                    
                    $createdCount++;
                }
            }
            
            DB::commit();
            
            return response()->json([
                'message' => "Created {$createdCount} new deduction entries.",
                'created_count' => $createdCount
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            
            throw ValidationException::withMessages([
                'general' => ['Failed to create deduction entries: ' . $e->getMessage()],
            ]);
        }
    }
    
    public function getEmployeeDefaults(Request $request)
    {
        try {
            $search = $request->input('search', '');
            $perPage = $request->input('perPage', 50);
            
            $query = Employee::with(['deductions' => function ($query) {
                $query->where('is_default', true)->latest();
            }])
            ->where('JobStatus', 'Active')
            ->select('id', 'idno', 'Lname', 'Fname', 'MName', 'Suffix', 'Department');
            
            // Apply search if provided
            if ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('Lname', 'like', "%{$search}%")
                      ->orWhere('Fname', 'like', "%{$search}%")
                      ->orWhere('idno', 'like', "%{$search}%")
                      ->orWhere('Department', 'like', "%{$search}%");
                });
            }
            
            // Get employees with pagination
            $employees = $query->paginate($perPage);
            
            // Return JSON response for API requests
            return response()->json($employees);
        } catch (\Exception $e) {
            // Return error response
            return response()->json([
                'error' => 'Failed to retrieve employee defaults',
                'message' => $e->getMessage()
            ], 500);
        }
    }
    
    public function showEmployeeDefaultsPage()
    {
        return Inertia::render('Deductions/EmployeeDefaultsPage', [
            'auth' => [
                'user' => Auth::user(),
            ],
        ]);
    }
}