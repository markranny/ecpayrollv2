<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Illuminate\Support\Facades\Validator;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

class EmployeeController extends Controller
{
    /**
     * Display a listing of employees.
     */
    public function index(Request $request)
    {
        $status = $request->input('status', 'all');
        
        $query = Employee::query();
        
        // Filter by employee status
        if ($status !== 'all') {
            $query->where('JobStatus', $status);
        }
        
        $employees = $query->get();
        
        // If it's an AJAX or JSON request, return JSON response
        // Fix: Make sure to properly check if the request is actually expecting JSON
        if ($request->expectsJson()) {
            Log::info('Returning employee list as JSON', [
                'count' => $employees->count(),
                'status' => $status
            ]);
            
            return response()->json([
                'data' => $employees
            ]);
        }
        
        // Otherwise, render the Inertia page
        // Fix: Make sure to properly share the data with Inertia
        return Inertia::render('Employee/EmployeePage', [
            'employees' => $employees,
            'currentStatus' => $status,
            'auth' => [
                'user' => Auth::user(),
            ],
        ]);
    }
    
    /**
     * Store a newly created employee.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'idno' => 'nullable|unique:employees',
            'bid' => 'nullable|string',
            'Lname' => 'required|string',
            'Fname' => 'required|string',
            'MName' => 'nullable|string',
            'Suffix' => 'nullable|string',
            'Gender' => 'nullable|in:Male,Female',
            'EducationalAttainment' => 'nullable|string',
            'Degree' => 'nullable|string',
            'CivilStatus' => 'nullable|string',
            'Birthdate' => 'nullable|date',
            'ContactNo' => 'nullable|string',
            'Email' => 'required|email|unique:employees',
            'PresentAddress' => 'nullable|string',
            'PermanentAddress' => 'nullable|string',
            'EmerContactName' => 'nullable|string',
            'EmerContactNo' => 'nullable|string',
            'EmerRelationship' => 'nullable|string',
            'EmpStatus' => 'nullable|string',
            'JobStatus' => 'nullable|string',
            'RankFile' => 'nullable|string',
            'Department' => 'required|string',
            'Line' => 'nullable|string',
            'Jobtitle' => 'required|string',
            'HiredDate' => 'nullable|date',
            'EndOfContract' => 'nullable|date',
            'pay_type' => 'nullable|string',
            'payrate' => 'nullable|numeric|between:0,999999.99',
            'pay_allowance' => 'nullable|numeric|between:0,999999.99',
            'SSSNO' => 'nullable|string',
            'PHILHEALTHNo' => 'nullable|string',
            'HDMFNo' => 'nullable|string',
            'TaxNo' => 'nullable|string',
            'Taxable' => 'nullable|boolean',
            'CostCenter' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        // Fix: Changed from Employees to Employee
        Employee::create($request->all());

        // Fix: Check if the request expects JSON and return appropriate response
        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'Employee created successfully'
            ]);
        }

        return redirect()->back()->with('message', 'Employee created successfully');
    }

    public function update(Request $request, $id)
    {
        $employee = Employee::findOrFail($id);
        
        $validator = Validator::make($request->all(), [
            'idno' => 'nullable|unique:employees,idno,' . $id,
            'bid' => 'nullable|string',
            'Lname' => 'required|string',
            'Fname' => 'required|string',
            'MName' => 'nullable|string',
            'Suffix' => 'nullable|string',
            'Gender' => 'nullable|in:Male,Female',
            'EducationalAttainment' => 'nullable|string',
            'Degree' => 'nullable|string',
            'CivilStatus' => 'nullable|string',
            'Birthdate' => 'nullable|date',
            'ContactNo' => 'nullable|string',
            'Email' => 'required|email|unique:employees,Email,' . $id,
            'PresentAddress' => 'nullable|string',
            'PermanentAddress' => 'nullable|string',
            'EmerContactName' => 'nullable|string',
            'EmerContactNo' => 'nullable|string',
            'EmerRelationship' => 'nullable|string',
            'EmpStatus' => 'nullable|string',
            'JobStatus' => 'nullable|string',
            'RankFile' => 'nullable|string',
            'Department' => 'required|string',
            'Line' => 'nullable|string',
            'Jobtitle' => 'required|string',
            'HiredDate' => 'nullable|date',
            'EndOfContract' => 'nullable|date',
            'pay_type' => 'nullable|string',
            'payrate' => 'nullable|numeric|between:0,999999.99',
            'pay_allowance' => 'nullable|numeric|between:0,999999.99',
            'SSSNO' => 'nullable|string',
            'PHILHEALTHNo' => 'nullable|string',
            'HDMFNo' => 'nullable|string',
            'TaxNo' => 'nullable|string',
            'Taxable' => 'nullable|boolean',
            'CostCenter' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            // Since this is an Inertia request, return with errors
            return redirect()->back()
                ->withErrors($validator)
                ->withInput();
        }

        try {
            $employee->update($request->all());
            
            // Return Inertia redirect with success message
            return redirect()->route('employees.index')
                ->with('message', 'Employee updated successfully');
        } catch (\Exception $e) {
            Log::error('Failed to update employee', [
                'id' => $id,
                'error' => $e->getMessage()
            ]);
            
            return redirect()->back()
                ->with('error', 'Failed to update employee: ' . $e->getMessage())
                ->withInput();
        }
    }

    /**
     * Remove the specified employee.
     */
    public function destroy($id)
    {
        try {
            $employee = Employee::findOrFail($id);
            $employee->delete();
            
            // Fix: Check if the request expects JSON and return appropriate response
            if (request()->expectsJson()) {
                return response()->json([
                    'message' => 'Employee deleted successfully'
                ]);
            }
            
            return redirect()->route('employees.index')->with([
                'message' => 'Employee deleted successfully'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Failed to delete employee', [
                'id' => $id,
                'error' => $e->getMessage()
            ]);
            
            // Fix: Check if the request expects JSON and return appropriate response
            if (request()->expectsJson()) {
                return response()->json([
                    'error' => 'Failed to delete employee: ' . $e->getMessage()
                ], 500);
            }
            
            return redirect()->route('employees.index')->with('error', 'Failed to delete employee');
        }
    }
    
    public function markInactive($id)
    {
        $employee = Employee::findOrFail($id);
        $employee->JobStatus = 'Inactive';
        $employee->save();
        
        // Fix: Check if the request expects JSON and return appropriate response
        if (request()->expectsJson()) {
            return response()->json([
                'message' => 'Employee marked as inactive.'
            ]);
        }
        
        return back()->with('message', 'Employee marked as inactive.');
    }

    public function markBlocked($id)
    {
        $employee = Employee::findOrFail($id);
        $employee->JobStatus = 'Blocked';
        $employee->save();
        
        // Fix: Check if the request expects JSON and return appropriate response
        if (request()->expectsJson()) {
            return response()->json([
                'message' => 'Employee blocked successfully.'
            ]);
        }
        
        return back()->with('message', 'Employee blocked successfully.');
    }

    public function markActive($id)
    {
        $employee = Employee::findOrFail($id);
        $employee->JobStatus = 'Active';
        $employee->save();
        
        // Fix: Check if the request expects JSON and return appropriate response
        if (request()->expectsJson()) {
            return response()->json([
                'message' => 'Employee activated successfully.'
            ]);
        }
        
        return back()->with('message', 'Employee activated successfully.');
    }

    /**
     * Show import page
     */
    public function showImportPage()
    {
        return Inertia::render('Employee/ImportEmployeesPage', [
            'auth' => [
                'user' => Auth::user(),
            ],
        ]);
    }

    /**
     * Export employees to Excel
     */
    public function exportExcel(Request $request)
    {
        try {
            // Get filter parameters
            $status = $request->input('status', 'all');
            $search = $request->input('search', '');
            
            // Build query
            $query = Employee::query();
            
            // Apply status filter
            if ($status !== 'all') {
                $query->where('JobStatus', $status);
            }
            
            // Apply search filter
            if (!empty($search)) {
                $query->where(function($q) use ($search) {
                    $q->where('Lname', 'LIKE', "%{$search}%")
                      ->orWhere('Fname', 'LIKE', "%{$search}%")
                      ->orWhere('Email', 'LIKE', "%{$search}%")
                      ->orWhere('Department', 'LIKE', "%{$search}%")
                      ->orWhere('idno', 'LIKE', "%{$search}%");
                });
            }
            
            $employees = $query->orderBy('Lname')->orderBy('Fname')->get();
            
            // Create new Spreadsheet
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            
            // Set sheet title
            $sheet->setTitle('Employee List');
            
            // Define headers
            $headers = [
                'A1' => 'ID No.',
                'B1' => 'Business ID',
                'C1' => 'Last Name',
                'D1' => 'First Name',
                'E1' => 'Middle Name',
                'F1' => 'Suffix',
                'G1' => 'Gender',
                'H1' => 'Civil Status',
                'I1' => 'Birthdate',
                'J1' => 'Contact No.',
                'K1' => 'Email',
                'L1' => 'Present Address',
                'M1' => 'Permanent Address',
                'N1' => 'Emergency Contact Name',
                'O1' => 'Emergency Contact No.',
                'P1' => 'Emergency Relationship',
                'Q1' => 'Educational Attainment',
                'R1' => 'Degree',
                'S1' => 'Employment Status',
                'T1' => 'Job Status',
                'U1' => 'Rank/File',
                'V1' => 'Department',
                'W1' => 'Line',
                'X1' => 'Job Title',
                'Y1' => 'Hired Date',
                'Z1' => 'End of Contract',
                'AA1' => 'Pay Type',
                'AB1' => 'Pay Rate',
                'AC1' => 'Pay Allowance',
                'AD1' => 'SSS No.',
                'AE1' => 'PhilHealth No.',
                'AF1' => 'HDMF No.',
                'AG1' => 'Tax No.',
                'AH1' => 'Taxable',
                'AI1' => 'Cost Center'
            ];
            
            // Set headers
            foreach ($headers as $cell => $header) {
                $sheet->setCellValue($cell, $header);
            }
            
            // Style headers
            $headerRange = 'A1:AI1';
            $sheet->getStyle($headerRange)->applyFromArray([
                'font' => [
                    'bold' => true,
                    'color' => ['rgb' => 'FFFFFF'],
                    'size' => 12
                ],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '4F46E5']
                ],
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => Border::BORDER_THIN,
                        'color' => ['rgb' => '000000']
                    ]
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical' => Alignment::VERTICAL_CENTER
                ]
            ]);
            
            // Auto-size header columns
            foreach (range('A', 'AI') as $column) {
                $sheet->getColumnDimension($column)->setAutoSize(true);
            }
            
            // Set row height for header
            $sheet->getRowDimension(1)->setRowHeight(25);
            
            // Add employee data
            $row = 2;
            foreach ($employees as $employee) {
                $sheet->setCellValue('A' . $row, $employee->idno);
                $sheet->setCellValue('B' . $row, $employee->bid);
                $sheet->setCellValue('C' . $row, $employee->Lname);
                $sheet->setCellValue('D' . $row, $employee->Fname);
                $sheet->setCellValue('E' . $row, $employee->MName);
                $sheet->setCellValue('F' . $row, $employee->Suffix);
                $sheet->setCellValue('G' . $row, $employee->Gender);
                $sheet->setCellValue('H' . $row, $employee->CivilStatus);
                $sheet->setCellValue('I' . $row, $employee->Birthdate ? $employee->Birthdate->format('Y-m-d') : '');
                $sheet->setCellValue('J' . $row, $employee->ContactNo);
                $sheet->setCellValue('K' . $row, $employee->Email);
                $sheet->setCellValue('L' . $row, $employee->PresentAddress);
                $sheet->setCellValue('M' . $row, $employee->PermanentAddress);
                $sheet->setCellValue('N' . $row, $employee->EmerContactName);
                $sheet->setCellValue('O' . $row, $employee->EmerContactNo);
                $sheet->setCellValue('P' . $row, $employee->EmerRelationship);
                $sheet->setCellValue('Q' . $row, $employee->EducationalAttainment);
                $sheet->setCellValue('R' . $row, $employee->Degree);
                $sheet->setCellValue('S' . $row, $employee->EmpStatus);
                $sheet->setCellValue('T' . $row, $employee->JobStatus);
                $sheet->setCellValue('U' . $row, $employee->RankFile);
                $sheet->setCellValue('V' . $row, $employee->Department);
                $sheet->setCellValue('W' . $row, $employee->Line);
                $sheet->setCellValue('X' . $row, $employee->Jobtitle);
                $sheet->setCellValue('Y' . $row, $employee->HiredDate ? $employee->HiredDate->format('Y-m-d') : '');
                $sheet->setCellValue('Z' . $row, $employee->EndOfContract ? $employee->EndOfContract->format('Y-m-d') : '');
                $sheet->setCellValue('AA' . $row, $employee->pay_type);
                $sheet->setCellValue('AB' . $row, $employee->payrate);
                $sheet->setCellValue('AC' . $row, $employee->pay_allowance);
                $sheet->setCellValue('AD' . $row, $employee->SSSNO);
                $sheet->setCellValue('AE' . $row, $employee->PHILHEALTHNo);
                $sheet->setCellValue('AF' . $row, $employee->HDMFNo);
                $sheet->setCellValue('AG' . $row, $employee->TaxNo);
                $sheet->setCellValue('AH' . $row, $employee->Taxable ? 'Yes' : 'No');
                $sheet->setCellValue('AI' . $row, $employee->CostCenter);
                
                $row++;
            }
            
            // Apply borders to all data
            if ($row > 2) {
                $dataRange = 'A1:AI' . ($row - 1);
                $sheet->getStyle($dataRange)->applyFromArray([
                    'borders' => [
                        'allBorders' => [
                            'borderStyle' => Border::BORDER_THIN,
                            'color' => ['rgb' => 'CCCCCC']
                        ]
                    ]
                ]);
            }
            
            // Apply alternating row colors
            for ($i = 2; $i < $row; $i++) {
                if ($i % 2 == 0) {
                    $sheet->getStyle('A' . $i . ':AI' . $i)->applyFromArray([
                        'fill' => [
                            'fillType' => Fill::FILL_SOLID,
                            'startColor' => ['rgb' => 'F8F9FA']
                        ]
                    ]);
                }
            }
            
            // Create filename with current date and filter info
            $dateStr = now()->format('Y-m-d_H-i-s');
            $statusStr = $status !== 'all' ? "_{$status}" : '';
            $searchStr = !empty($search) ? "_search" : '';
            $filename = "employees_export{$statusStr}{$searchStr}_{$dateStr}.xlsx";
            
            // Set up the response headers
            $writer = new Xlsx($spreadsheet);
            
            // Create temporary file
            $temp_file = tempnam(sys_get_temp_dir(), 'employee_export');
            $writer->save($temp_file);
            
            // Log the export action
            Log::info('Employee export completed', [
                'user_id' => Auth::id(),
                'employee_count' => $employees->count(),
                'status_filter' => $status,
                'search_filter' => $search,
                'filename' => $filename
            ]);
            
            return response()->download($temp_file, $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Cache-Control' => 'max-age=0',
            ])->deleteFileAfterSend(true);
            
        } catch (\Exception $e) {
            Log::error('Employee export failed', [
                'error' => $e->getMessage(),
                'user_id' => Auth::id(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return redirect()->back()->with('error', 'Failed to export employees: ' . $e->getMessage());
        }
    }
}