<?php

namespace App\Http\Controllers;

use App\Models\EmployeeSchedule;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Carbon\Carbon;

class EmployeeScheduleController extends Controller
{
    /**
     * Display the employee scheduling page
     */
    public function index(Request $request)
    {
        $employees = Employee::select('id', 'idno', 'Fname', 'Lname', 'Department')
            ->where('JobStatus', 'Active')
            ->orderBy('Fname')
            ->get();

        return Inertia::render('Scheduling/EmployeeScheduling', [
            'employees' => $employees,
            'auth' => ['user' => auth()->user()]
        ]);
    }

    /**
     * Get list of employee schedules with filtering
     */
    public function list(Request $request)
    {
        try {
            $query = EmployeeSchedule::with(['employee:id,idno,Fname,Lname,Department']);

            // Apply search filter
            if ($request->filled('search')) {
                $search = $request->search;
                $query->whereHas('employee', function($q) use ($search) {
                    $q->where('Fname', 'like', "%{$search}%")
                      ->orWhere('Lname', 'like', "%{$search}%")
                      ->orWhere('idno', 'like', "%{$search}%")
                      ->orWhere('Department', 'like', "%{$search}%");
                });
            }

            // Apply department filter
            if ($request->filled('department')) {
                $query->whereHas('employee', function($q) use ($request) {
                    $q->where('Department', $request->department);
                });
            }

            // Apply status filter
            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }

            // Apply shift type filter
            if ($request->filled('shift_type')) {
                $query->where('shift_type', $request->shift_type);
            }

            // Order by effective date (newest first)
            $schedules = $query->orderBy('effective_date', 'desc')
                              ->orderBy('created_at', 'desc')
                              ->get();

            return response()->json([
                'schedules' => $schedules,
                'total' => $schedules->count()
            ]);

        } catch (\Exception $e) {
            \Log::error('Error fetching employee schedules: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch schedules'], 500);
        }
    }

    /**
     * Store a new employee schedule
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'employee_id' => 'required|exists:employees,id',
            'shift_type' => 'required|in:regular,night,flexible,rotating',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'break_start' => 'nullable|date_format:H:i',
            'break_end' => 'nullable|date_format:H:i|after:break_start',
            'work_days' => 'required|array|min:1',
            'work_days.*' => 'in:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
            'effective_date' => 'required|date|after_or_equal:today',
            'end_date' => 'nullable|date|after:effective_date',
            'status' => 'required|in:active,inactive,pending',
            'notes' => 'nullable|string|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'messages' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        
        try {
            // Check for overlapping active schedules
            $overlapping = EmployeeSchedule::where('employee_id', $request->employee_id)
                ->where('status', 'active')
                ->where(function($query) use ($request) {
                    $query->where(function($q) use ($request) {
                        // New schedule starts during existing schedule
                        $q->where('effective_date', '<=', $request->effective_date)
                          ->where(function($subQ) use ($request) {
                              $subQ->whereNull('end_date')
                                   ->orWhere('end_date', '>=', $request->effective_date);
                          });
                    })->orWhere(function($q) use ($request) {
                        // New schedule ends during existing schedule
                        if ($request->end_date) {
                            $q->where('effective_date', '<=', $request->end_date)
                              ->where(function($subQ) use ($request) {
                                  $subQ->whereNull('end_date')
                                       ->orWhere('end_date', '>=', $request->end_date);
                              });
                        }
                    });
                })
                ->exists();

            if ($overlapping) {
                return response()->json([
                    'error' => 'Schedule conflict detected. Employee already has an active schedule for this period.'
                ], 422);
            }

            $schedule = EmployeeSchedule::create([
                'employee_id' => $request->employee_id,
                'shift_type' => $request->shift_type,
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'break_start' => $request->break_start,
                'break_end' => $request->break_end,
                'work_days' => json_encode($request->work_days),
                'effective_date' => $request->effective_date,
                'end_date' => $request->end_date,
                'status' => $request->status,
                'notes' => $request->notes,
                'created_by' => auth()->id()
            ]);

            DB::commit();

            // Load the schedule with employee relationship
            $schedule->load('employee:id,idno,Fname,Lname,Department');

            return response()->json([
                'message' => 'Schedule created successfully',
                'schedule' => $schedule
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error creating employee schedule: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to create schedule'], 500);
        }
    }

    /**
     * Update an existing employee schedule
     */
    public function update(Request $request, $id)
    {
        $schedule = EmployeeSchedule::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'employee_id' => 'required|exists:employees,id',
            'shift_type' => 'required|in:regular,night,flexible,rotating',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'break_start' => 'nullable|date_format:H:i',
            'break_end' => 'nullable|date_format:H:i|after:break_start',
            'work_days' => 'required|array|min:1',
            'work_days.*' => 'in:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
            'effective_date' => 'required|date',
            'end_date' => 'nullable|date|after:effective_date',
            'status' => 'required|in:active,inactive,pending',
            'notes' => 'nullable|string|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Validation failed',
                'messages' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        
        try {
            // Check for overlapping active schedules (excluding current schedule)
            $overlapping = EmployeeSchedule::where('employee_id', $request->employee_id)
                ->where('id', '!=', $id)
                ->where('status', 'active')
                ->where(function($query) use ($request) {
                    $query->where(function($q) use ($request) {
                        $q->where('effective_date', '<=', $request->effective_date)
                          ->where(function($subQ) use ($request) {
                              $subQ->whereNull('end_date')
                                   ->orWhere('end_date', '>=', $request->effective_date);
                          });
                    })->orWhere(function($q) use ($request) {
                        if ($request->end_date) {
                            $q->where('effective_date', '<=', $request->end_date)
                              ->where(function($subQ) use ($request) {
                                  $subQ->whereNull('end_date')
                                       ->orWhere('end_date', '>=', $request->end_date);
                              });
                        }
                    });
                })
                ->exists();

            if ($overlapping) {
                return response()->json([
                    'error' => 'Schedule conflict detected. Employee already has an active schedule for this period.'
                ], 422);
            }

            $schedule->update([
                'employee_id' => $request->employee_id,
                'shift_type' => $request->shift_type,
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'break_start' => $request->break_start,
                'break_end' => $request->break_end,
                'work_days' => json_encode($request->work_days),
                'effective_date' => $request->effective_date,
                'end_date' => $request->end_date,
                'status' => $request->status,
                'notes' => $request->notes,
                'updated_by' => auth()->id()
            ]);

            DB::commit();

            // Load the schedule with employee relationship
            $schedule->load('employee:id,idno,Fname,Lname,Department');

            return response()->json([
                'message' => 'Schedule updated successfully',
                'schedule' => $schedule
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error updating employee schedule: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to update schedule'], 500);
        }
    }

    /**
     * Delete an employee schedule
     */
    public function destroy($id)
    {
        try {
            $schedule = EmployeeSchedule::findOrFail($id);
            $schedule->delete();

            return response()->json([
                'message' => 'Schedule deleted successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error deleting employee schedule: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to delete schedule'], 500);
        }
    }

    /**
     * Import employee schedules from Excel/CSV file
     */
    public function import(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:xlsx,xls,csv|max:10240', // 10MB max
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Invalid file format or size',
                'messages' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            $file = $request->file('file');
            $spreadsheet = IOFactory::load($file->getPathname());
            $worksheet = $spreadsheet->getActiveSheet();
            $rows = $worksheet->toArray();

            if (count($rows) < 2) {
                return response()->json(['error' => 'File must contain at least one data row'], 422);
            }

            // Expected headers
            $expectedHeaders = [
                'employee_no', 'shift_type', 'start_time', 'end_time', 
                'break_start', 'break_end', 'work_days', 'effective_date', 'status'
            ];

            $headers = array_map('strtolower', array_map('trim', $rows[0]));
            
            // Validate headers
            foreach ($expectedHeaders as $header) {
                if (!in_array($header, $headers)) {
                    return response()->json([
                        'error' => "Missing required column: {$header}"
                    ], 422);
                }
            }

            $successful = 0;
            $failed = 0;
            $failures = [];

            // Process each row
            for ($i = 1; $i < count($rows); $i++) {
                $row = $rows[$i];
                
                if (empty(array_filter($row))) {
                    continue; // Skip empty rows
                }

                try {
                    // Map row data to associative array
                    $data = [];
                    foreach ($headers as $index => $header) {
                        $data[$header] = $row[$index] ?? null;
                    }

                    // Find employee by employee number
                    $employee = Employee::where('idno', $data['employee_no'])->first();
                    if (!$employee) {
                        $failures[] = [
                            'row' => $i + 1,
                            'errors' => ["Employee with ID {$data['employee_no']} not found"]
                        ];
                        $failed++;
                        continue;
                    }

                    // Parse work days
                    $workDays = [];
                    if (!empty($data['work_days'])) {
                        $workDaysStr = strtolower(trim($data['work_days']));
                        $workDays = array_map('trim', explode(',', $workDaysStr));
                        
                        // Validate work days
                        $validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                        $workDays = array_intersect($workDays, $validDays);
                        
                        if (empty($workDays)) {
                            $failures[] = [
                                'row' => $i + 1,
                                'errors' => ['Invalid work days format']
                            ];
                            $failed++;
                            continue;
                        }
                    }

                    // Validate and format dates
                    try {
                        $effectiveDate = Carbon::createFromFormat('Y-m-d', $data['effective_date'])->format('Y-m-d');
                    } catch (\Exception $e) {
                        try {
                            $effectiveDate = Carbon::createFromFormat('m/d/Y', $data['effective_date'])->format('Y-m-d');
                        } catch (\Exception $e) {
                            $failures[] = [
                                'row' => $i + 1,
                                'errors' => ['Invalid effective date format']
                            ];
                            $failed++;
                            continue;
                        }
                    }

                    // Validate times
                    $startTime = $this->validateTimeFormat($data['start_time']);
                    $endTime = $this->validateTimeFormat($data['end_time']);
                    $breakStart = !empty($data['break_start']) ? $this->validateTimeFormat($data['break_start']) : null;
                    $breakEnd = !empty($data['break_end']) ? $this->validateTimeFormat($data['break_end']) : null;

                    if (!$startTime || !$endTime) {
                        $failures[] = [
                            'row' => $i + 1,
                            'errors' => ['Invalid time format']
                        ];
                        $failed++;
                        continue;
                    }

                    // Validate shift type
                    $shiftType = strtolower(trim($data['shift_type']));
                    if (!in_array($shiftType, ['regular', 'night', 'flexible', 'rotating'])) {
                        $failures[] = [
                            'row' => $i + 1,
                            'errors' => ['Invalid shift type']
                        ];
                        $failed++;
                        continue;
                    }

                    // Validate status
                    $status = strtolower(trim($data['status'] ?? 'active'));
                    if (!in_array($status, ['active', 'inactive', 'pending'])) {
                        $status = 'active';
                    }

                    // Check for existing active schedule
                    $existing = EmployeeSchedule::where('employee_id', $employee->id)
                        ->where('status', 'active')
                        ->where('effective_date', '<=', $effectiveDate)
                        ->where(function($query) use ($effectiveDate) {
                            $query->whereNull('end_date')
                                  ->orWhere('end_date', '>=', $effectiveDate);
                        })
                        ->exists();

                    if ($existing) {
                        $failures[] = [
                            'row' => $i + 1,
                            'errors' => ['Employee already has an active schedule for this period']
                        ];
                        $failed++;
                        continue;
                    }

                    // Create the schedule
                    EmployeeSchedule::create([
                        'employee_id' => $employee->id,
                        'shift_type' => $shiftType,
                        'start_time' => $startTime,
                        'end_time' => $endTime,
                        'break_start' => $breakStart,
                        'break_end' => $breakEnd,
                        'work_days' => json_encode($workDays),
                        'effective_date' => $effectiveDate,
                        'end_date' => null,
                        'status' => $status,
                        'notes' => $data['notes'] ?? null,
                        'created_by' => auth()->id()
                    ]);

                    $successful++;

                } catch (\Exception $e) {
                    $failures[] = [
                        'row' => $i + 1,
                        'errors' => ['Error processing row: ' . $e->getMessage()]
                    ];
                    $failed++;
                }
            }

            DB::commit();

            return response()->json([
                'message' => "Import completed. {$successful} schedules imported successfully.",
                'successful' => $successful,
                'failed' => $failed,
                'failures' => $failures,
                'total_processed' => $successful + $failed
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error importing employee schedules: ' . $e->getMessage());
            return response()->json(['error' => 'Import failed: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Export employee schedules to Excel
     */
    public function export(Request $request)
    {
        try {
            $query = EmployeeSchedule::with(['employee:id,idno,Fname,Lname,Department']);

            // Apply same filters as list method
            if ($request->filled('search')) {
                $search = $request->search;
                $query->whereHas('employee', function($q) use ($search) {
                    $q->where('Fname', 'like', "%{$search}%")
                      ->orWhere('Lname', 'like', "%{$search}%")
                      ->orWhere('idno', 'like', "%{$search}%")
                      ->orWhere('Department', 'like', "%{$search}%");
                });
            }

            if ($request->filled('department')) {
                $query->whereHas('employee', function($q) use ($request) {
                    $q->where('Department', $request->department);
                });
            }

            if ($request->filled('status')) {
                $query->where('status', $request->status);
            }

            if ($request->filled('shift_type')) {
                $query->where('shift_type', $request->shift_type);
            }

            $schedules = $query->orderBy('effective_date', 'desc')->get();

            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            
            // Set headers
            $headers = [
                'Employee ID', 'Employee Name', 'Department', 'Shift Type',
                'Start Time', 'End Time', 'Break Start', 'Break End',
                'Work Days', 'Effective Date', 'End Date', 'Status', 'Notes'
            ];
            
            $sheet->fromArray($headers, null, 'A1');

            // Add data
            $row = 2;
            foreach ($schedules as $schedule) {
                $workDays = is_string($schedule->work_days) 
                    ? json_decode($schedule->work_days, true) 
                    : $schedule->work_days;
                    
                $workDaysStr = is_array($workDays) 
                    ? implode(', ', array_map('ucfirst', $workDays))
                    : '';

                $sheet->fromArray([
                    $schedule->employee->idno,
                    $schedule->employee->Fname . ' ' . $schedule->employee->Lname,
                    $schedule->employee->Department,
                    ucfirst($schedule->shift_type),
                    $schedule->start_time,
                    $schedule->end_time,
                    $schedule->break_start,
                    $schedule->break_end,
                    $workDaysStr,
                    $schedule->effective_date,
                    $schedule->end_date,
                    ucfirst($schedule->status),
                    $schedule->notes
                ], null, "A{$row}");
                $row++;
            }

            // Style the header row
            $headerStyle = [
                'font' => ['bold' => true],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FFCCCCCC']
                ]
            ];
            $sheet->getStyle('A1:M1')->applyFromArray($headerStyle);

            // Auto-size columns
            foreach (range('A', 'M') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }

            $writer = new Xlsx($spreadsheet);
            $filename = 'employee-schedules-' . date('Y-m-d-H-i-s') . '.xlsx';
            $tempFile = tempnam(sys_get_temp_dir(), 'employee_schedules');
            
            $writer->save($tempFile);

            return response()->download($tempFile, $filename)->deleteFileAfterSend(true);

        } catch (\Exception $e) {
            \Log::error('Error exporting employee schedules: ' . $e->getMessage());
            return response()->json(['error' => 'Export failed'], 500);
        }
    }

    /**
     * Download template for importing employee schedules
     */
    public function downloadTemplate()
    {
        try {
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            
            // Set headers
            $headers = [
                'employee_no', 'shift_type', 'start_time', 'end_time',
                'break_start', 'break_end', 'work_days', 'effective_date', 'status', 'notes'
            ];
            
            $sheet->fromArray($headers, null, 'A1');

            // Add sample data
            $sampleData = [
                ['EMP001', 'regular', '08:00', '17:00', '12:00', '13:00', 'monday,tuesday,wednesday,thursday,friday', '2024-01-01', 'active', 'Regular business hours'],
                ['EMP002', 'night', '22:00', '06:00', '02:00', '03:00', 'monday,tuesday,wednesday,thursday,friday', '2024-01-01', 'active', 'Night shift'],
                ['EMP003', 'flexible', '09:00', '18:00', '12:30', '13:30', 'monday,tuesday,wednesday,thursday', '2024-01-01', 'pending', 'Flexible working hours']
            ];
            
            $row = 2;
            foreach ($sampleData as $data) {
                $sheet->fromArray($data, null, "A{$row}");
                $row++;
            }

            // Style the header row
            $headerStyle = [
                'font' => ['bold' => true],
                'fill' => [
                    'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FF4472C4']
                ],
                'font' => ['color' => ['argb' => 'FFFFFFFF']]
            ];
            $sheet->getStyle('A1:J1')->applyFromArray($headerStyle);

            // Auto-size columns
            foreach (range('A', 'J') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }

            // Add instructions sheet
            $instructionsSheet = $spreadsheet->createSheet();
            $instructionsSheet->setTitle('Instructions');
            
            $instructions = [
                ['Employee Schedule Import Template - Instructions'],
                [''],
                ['Required Columns:'],
                ['employee_no', 'Employee ID number (must exist in system)'],
                ['shift_type', 'Type of shift: regular, night, flexible, rotating'],
                ['start_time', 'Start time in HH:MM format (24-hour)'],
                ['end_time', 'End time in HH:MM format (24-hour)'],
                ['break_start', 'Break start time (optional)'],
                ['break_end', 'Break end time (optional)'],
                ['work_days', 'Comma-separated list: monday,tuesday,wednesday,thursday,friday'],
                ['effective_date', 'Start date in YYYY-MM-DD format'],
                ['status', 'Schedule status: active, inactive, pending'],
                ['notes', 'Additional notes (optional)'],
                [''],
                ['Important Notes:'],
                ['- Employee ID must exist in the system'],
                ['- Times must be in 24-hour format (HH:MM)'],
                ['- Work days must be lowercase, comma-separated'],
                ['- Effective date must be YYYY-MM-DD format'],
                ['- Cannot create overlapping active schedules for same employee']
            ];

            $instructionsSheet->fromArray($instructions, null, 'A1');
            $instructionsSheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
            $instructionsSheet->getStyle('A3')->getFont()->setBold(true);
            $instructionsSheet->getStyle('A15')->getFont()->setBold(true);

            foreach (range('A', 'B') as $col) {
                $instructionsSheet->getColumnDimension($col)->setAutoSize(true);
            }

            $spreadsheet->setActiveSheetIndex(0);

            $writer = new Xlsx($spreadsheet);
            $filename = 'employee-schedules-template.xlsx';
            $tempFile = tempnam(sys_get_temp_dir(), 'schedule_template');
            
            $writer->save($tempFile);

            return response()->download($tempFile, $filename)->deleteFileAfterSend(true);

        } catch (\Exception $e) {
            \Log::error('Error generating template: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to generate template'], 500);
        }
    }

    /**
     * Validate time format and convert to HH:MM
     */
    private function validateTimeFormat($time)
    {
        if (empty($time)) return null;

        try {
            // Try to parse as Carbon time
            $carbon = Carbon::createFromFormat('H:i', $time);
            return $carbon->format('H:i');
        } catch (\Exception $e) {
            try {
                // Try to parse as Carbon time with seconds
                $carbon = Carbon::createFromFormat('H:i:s', $time);
                return $carbon->format('H:i');
            } catch (\Exception $e) {
                return false;
            }
        }
    }

    /**
 * Get employees formatted for select dropdown
 */
public function getEmployeesForSelect(Request $request)
{
    try {
        $query = Employee::select('id', 'idno', 'Fname', 'Lname', 'Department')
            ->where('JobStatus', 'Active')
            ->orderBy('Fname')
            ->orderBy('Lname');

        // Apply search filter if provided
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('Fname', 'like', "%{$search}%")
                  ->orWhere('Lname', 'like', "%{$search}%")
                  ->orWhere('idno', 'like', "%{$search}%");
            });
        }

        // Apply department filter if provided
        if ($request->filled('department')) {
            $query->where('Department', $request->department);
        }

        // Limit results for performance (optional)
        $limit = $request->input('limit', 100);
        if ($limit > 0) {
            $query->limit($limit);
        }

        $employees = $query->get();

        return response()->json($employees);

    } catch (\Exception $e) {
        \Log::error('Error fetching employees for select: ' . $e->getMessage());
        return response()->json([
            'error' => 'Failed to fetch employees',
            'employees' => [],
            'total' => 0
        ], 500);
    }
}


    /**
     * Get departments for filtering
     */
    public function getDepartments()
    {
        try {
            $departments = Employee::select('Department')
                ->whereNotNull('Department')
                ->where('Department', '!=', '')
                ->distinct()
                ->orderBy('Department')
                ->pluck('Department');

            return response()->json($departments);
        } catch (\Exception $e) {
            \Log::error('Error fetching departments: ' . $e->getMessage());
            return response()->json([], 500);
        }
    }
}