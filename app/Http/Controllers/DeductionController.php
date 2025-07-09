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
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\IOFactory;

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
        $perPage = $request->input('perPage', 50);
        
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

    /**
     * Download Excel template for deductions import with actual employee data
     */
    public function downloadTemplate()
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        
        // Set headers
        $headers = [
            'A1' => 'Employee ID',
            'B1' => 'Employee Name',
            'C1' => 'Department',
            'D1' => 'Advance',
            'E1' => 'Charge Store',
            'F1' => 'Charge',
            'G1' => 'Meals',
            'H1' => 'Miscellaneous',
            'I1' => 'Other Deductions',
            'J1' => 'Cutoff (1st/2nd)',
            'K1' => 'Date (YYYY-MM-DD)'
        ];
        
        foreach ($headers as $cell => $header) {
            $sheet->setCellValue($cell, $header);
            $sheet->getStyle($cell)->getFont()->setBold(true);
            $sheet->getStyle($cell)->getFill()
                ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                ->getStartColor()->setARGB('FFE2E8F0');
        }
        
        // Get all active employees
        $employees = Employee::where('JobStatus', 'Active')
            ->select('idno', 'Lname', 'Fname', 'MName', 'Department')
            ->orderBy('Lname')
            ->orderBy('Fname')
            ->get();
        
        // Add employee data starting from row 2
        $row = 2;
        foreach ($employees as $employee) {
            $employeeName = trim($employee->Lname . ', ' . $employee->Fname . ' ' . ($employee->MName ?? ''));
            
            $sheet->setCellValue('A' . $row, $employee->idno);
            $sheet->setCellValue('B' . $row, $employeeName);
            $sheet->setCellValue('C' . $row, $employee->Department ?? '');
            $sheet->setCellValue('D' . $row, '0.00'); // Default values
            $sheet->setCellValue('E' . $row, '0.00');
            $sheet->setCellValue('F' . $row, '0.00');
            $sheet->setCellValue('G' . $row, '0.00');
            $sheet->setCellValue('H' . $row, '0.00');
            $sheet->setCellValue('I' . $row, '0.00');
            $sheet->setCellValue('J' . $row, '1st'); // Default cutoff
            $sheet->setCellValue('K' . $row, date('Y-m-d')); // Current date
            
            $row++;
        }
        
        // Auto-size columns
        foreach (range('A', 'K') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
        
        // Set minimum column widths
        $sheet->getColumnDimension('A')->setWidth(15);
        $sheet->getColumnDimension('B')->setWidth(30);
        $sheet->getColumnDimension('C')->setWidth(20);
        
        // Add data validation for cutoff column
        $cutoffValidation = $sheet->getDataValidation('J2:J' . ($row - 1));
        $cutoffValidation->setType(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::TYPE_LIST);
        $cutoffValidation->setErrorStyle(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::STYLE_INFORMATION);
        $cutoffValidation->setAllowBlank(false);
        $cutoffValidation->setShowInputMessage(true);
        $cutoffValidation->setShowErrorMessage(true);
        $cutoffValidation->setShowDropDown(true);
        $cutoffValidation->setErrorTitle('Input error');
        $cutoffValidation->setError('Please select either "1st" or "2nd"');
        $cutoffValidation->setPromptTitle('Cutoff Period');
        $cutoffValidation->setPrompt('Select cutoff period');
        $cutoffValidation->setFormula1('"1st,2nd"');
        
        $writer = new Xlsx($spreadsheet);
        
        // Set headers for download
        $filename = 'deductions_import_template_' . date('Y-m-d') . '.xlsx';
        
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment;filename="' . $filename . '"');
        header('Cache-Control: max-age=0');
        
        $writer->save('php://output');
        exit;
    }

    /**
     * Import deductions from Excel file
     */
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240', // 10MB max
            'cutoff' => 'required|in:1st,2nd',
            'date' => 'required|date',
        ]);

        try {
            $file = $request->file('file');
            $cutoff = $request->input('cutoff');
            $date = $request->input('date');
            
            // Load the spreadsheet
            $spreadsheet = IOFactory::load($file->getPathname());
            $worksheet = $spreadsheet->getActiveSheet();
            $rows = $worksheet->toArray();
            
            // Remove header row
            array_shift($rows);
            
            $imported = 0;
            $errors = [];
            
            DB::beginTransaction();
            
            foreach ($rows as $index => $row) {
                $rowNumber = $index + 2; // +2 because we removed header and array is 0-indexed
                
                // Skip empty rows
                if (empty(array_filter($row))) {
                    continue;
                }
                
                try {
                    // Find employee by ID
                    $employee = Employee::where('idno', trim($row[0]))->first();
                    
                    if (!$employee) {
                        $errors[] = "Row {$rowNumber}: Employee with ID '{$row[0]}' not found.";
                        continue;
                    }
                    
                    // Check if deduction already exists
                    $existingDeduction = Deduction::where('employee_id', $employee->id)
                        ->where('cutoff', $cutoff)
                        ->where('date', $date)
                        ->first();
                    
                    $deductionData = [
                        'employee_id' => $employee->id,
                        'advance' => floatval($row[3] ?? 0),
                        'charge_store' => floatval($row[4] ?? 0),
                        'charge' => floatval($row[5] ?? 0),
                        'meals' => floatval($row[6] ?? 0),
                        'miscellaneous' => floatval($row[7] ?? 0),
                        'other_deductions' => floatval($row[8] ?? 0),
                        'cutoff' => $cutoff,
                        'date' => $date,
                        'is_posted' => false,
                        'is_default' => false,
                    ];
                    
                    if ($existingDeduction) {
                        // Update existing deduction if not posted
                        if ($existingDeduction->is_posted) {
                            $errors[] = "Row {$rowNumber}: Deduction for employee '{$row[0]}' is already posted and cannot be updated.";
                            continue;
                        }
                        $existingDeduction->update($deductionData);
                    } else {
                        // Create new deduction
                        Deduction::create($deductionData);
                    }
                    
                    $imported++;
                    
                } catch (\Exception $e) {
                    $errors[] = "Row {$rowNumber}: " . $e->getMessage();
                }
            }
            
            DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => "Successfully imported {$imported} deductions.",
                'imported_count' => $imported,
                'errors' => $errors
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            return response()->json([
                'success' => false,
                'message' => 'Import failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Export deductions to Excel
     */
    public function export(Request $request)
    {
        $cutoff = $request->input('cutoff', '1st');
        $month = $request->input('month', Carbon::now()->month);
        $year = $request->input('year', Carbon::now()->year);
        $search = $request->input('search', '');
        
        // Build date range for selected month and cutoff
        $startDate = Carbon::createFromDate($year, $month, $cutoff === '1st' ? 1 : 16);
        $endDate = $cutoff === '1st' 
            ? Carbon::createFromDate($year, $month, 15)
            : Carbon::createFromDate($year, $month)->endOfMonth();
        
        // Query to get employees with deductions
        $query = Employee::with(['deductions' => function ($query) use ($cutoff, $startDate, $endDate) {
                $query->where('cutoff', $cutoff)
                    ->whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
                    ->latest('date');
            }])
            ->where('JobStatus', 'Active')
            ->select('id', 'idno', 'Lname', 'Fname', 'MName', 'Suffix', 'Department');
            
        // Apply search term if provided
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('Lname', 'like', "%{$search}%")
                  ->orWhere('Fname', 'like', "%{$search}%")
                  ->orWhere('idno', 'like', "%{$search}%")
                  ->orWhere('Department', 'like', "%{$search}%");
            });
        }
        
        $employees = $query->get();
        
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        
        // Set headers
        $headers = [
            'A1' => 'Employee ID',
            'B1' => 'Employee Name',
            'C1' => 'Department',
            'D1' => 'Advance',
            'E1' => 'Charge Store',
            'F1' => 'Charge',
            'G1' => 'Meals',
            'H1' => 'Miscellaneous',
            'I1' => 'Other Deductions',
            'J1' => 'Cutoff',
            'K1' => 'Date',
            'L1' => 'Status',
            'M1' => 'Is Default'
        ];
        
        foreach ($headers as $cell => $header) {
            $sheet->setCellValue($cell, $header);
            $sheet->getStyle($cell)->getFont()->setBold(true);
        }
        
        // Add data
        $row = 2;
        foreach ($employees as $employee) {
            $deduction = $employee->deductions->first();
            $employeeName = trim($employee->Lname . ', ' . $employee->Fname . ' ' . ($employee->MName ?? ''));
            
            $sheet->setCellValue('A' . $row, $employee->idno);
            $sheet->setCellValue('B' . $row, $employeeName);
            $sheet->setCellValue('C' . $row, $employee->Department ?? '');
            $sheet->setCellValue('D' . $row, $deduction ? number_format($deduction->advance, 2) : '0.00');
            $sheet->setCellValue('E' . $row, $deduction ? number_format($deduction->charge_store, 2) : '0.00');
            $sheet->setCellValue('F' . $row, $deduction ? number_format($deduction->charge, 2) : '0.00');
            $sheet->setCellValue('G' . $row, $deduction ? number_format($deduction->meals, 2) : '0.00');
            $sheet->setCellValue('H' . $row, $deduction ? number_format($deduction->miscellaneous, 2) : '0.00');
            $sheet->setCellValue('I' . $row, $deduction ? number_format($deduction->other_deductions, 2) : '0.00');
            $sheet->setCellValue('J' . $row, $deduction ? $deduction->cutoff : $cutoff);
            $sheet->setCellValue('K' . $row, $deduction ? $deduction->date->format('Y-m-d') : '');
            $sheet->setCellValue('L' . $row, $deduction ? ($deduction->is_posted ? 'Posted' : 'Pending') : 'No Data');
            $sheet->setCellValue('M' . $row, $deduction ? ($deduction->is_default ? 'Yes' : 'No') : 'No');
            
            $row++;
        }
        
        // Auto-size columns
        foreach (range('A', 'M') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
        
        $writer = new Xlsx($spreadsheet);
        
        // Set headers for download
        $filename = 'deductions_export_' . $cutoff . '_' . $month . '_' . $year . '_' . date('Y-m-d') . '.xlsx';
        
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment;filename="' . $filename . '"');
        header('Cache-Control: max-age=0');
        
        $writer->save('php://output');
        exit;
    }

    /**
     * Delete all not posted deductions for a specific cutoff period.
     */
    public function deleteAllNotPosted(Request $request)
    {
        $cutoff = $request->input('cutoff', '1st');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        
        if (!$startDate || !$endDate) {
            throw ValidationException::withMessages([
                'date' => ['Start date and end date are required.'],
            ]);
        }
        
        // Delete all unposted deductions for the specified period
        $deletedCount = Deduction::whereBetween('date', [$startDate, $endDate])
            ->where('cutoff', $cutoff)
            ->where('is_posted', false)
            ->delete();
        
        return response()->json([
            'message' => "{$deletedCount} not posted deductions have been successfully deleted.",
            'deleted_count' => $deletedCount
        ]);
    }


}