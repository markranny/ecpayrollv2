<?php

namespace App\Http\Controllers;

use App\Models\Benefit;
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
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Color;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

class BenefitController extends Controller
{
    /**
     * Display the benefits page with employee benefits data.
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
        
        // Query to get employees with benefits for the selected period
        $query = Employee::with(['benefits' => function ($query) use ($cutoff, $startDate, $endDate) {
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
        $allBenefitsCount = Benefit::whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
            ->where('cutoff', $cutoff)
            ->count();
        
        $postedBenefitsCount = Benefit::whereBetween('date', [$startDate->toDateString(), $endDate->toDateString()])
            ->where('cutoff', $cutoff)
            ->where('is_posted', true)
            ->count();
        
        // Return Inertia view with data
        return Inertia::render('Benefits/BenefitsPage', [
            'employees' => $employees,
            'cutoff' => $cutoff,
            'month' => $month,
            'year' => $year,
            'search' => $search,
            'status' => [
                'allCount' => $allBenefitsCount,
                'postedCount' => $postedBenefitsCount,
                'pendingCount' => $allBenefitsCount - $postedBenefitsCount,
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

    public function downloadTemplate()
    {
        $spreadsheet = new Spreadsheet();
        
        // Create the Benefits Template sheet
        $benefitsSheet = $spreadsheet->getActiveSheet();
        $benefitsSheet->setTitle('Benefits Template');
        
        // Define headers for benefits template
        $headers = [
            'A1' => 'Employee ID',
            'B1' => 'Employee Name',
            'C1' => 'Department',
            'D1' => 'Allowances',
            'E1' => 'MF Shares',
            'F1' => 'MF Loan',
            'G1' => 'SSS Loan',
            'H1' => 'SSS Premium',
            'I1' => 'HMDF Loan',
            'J1' => 'HMDF Premium',
            'K1' => 'PhilHealth',
            'L1' => 'Cutoff (1st/2nd)',
            'M1' => 'Date (YYYY-MM-DD)'
        ];
        
        // Set headers with styling
        foreach ($headers as $cell => $header) {
            $benefitsSheet->setCellValue($cell, $header);
        }
        
        // Style the header row
        $headerRange = 'A1:M1';
        $benefitsSheet->getStyle($headerRange)->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 12
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'color' => ['rgb' => '4472C4']
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => '000000']
                ]
            ]
        ]);
        
        // Auto-size columns
        foreach (range('A', 'M') as $column) {
            $benefitsSheet->getColumnDimension($column)->setAutoSize(true);
        }
        
        // Add sample data rows (5 examples)
        $sampleData = [
            ['EMP001', 'Sample Employee 1', 'IT Department', '5000.00', '500.00', '1000.00', '800.00', '300.00', '500.00', '200.00', '400.00', '1st', date('Y-m-d')],
            ['EMP002', 'Sample Employee 2', 'HR Department', '4500.00', '400.00', '800.00', '600.00', '250.00', '400.00', '180.00', '350.00', '2nd', date('Y-m-d')],
            ['EMP003', 'Sample Employee 3', 'Finance Department', '5500.00', '600.00', '1200.00', '900.00', '350.00', '600.00', '220.00', '450.00', '1st', date('Y-m-d')],
            ['EMP004', 'Sample Employee 4', 'Operations', '4000.00', '300.00', '700.00', '500.00', '200.00', '350.00', '150.00', '300.00', '2nd', date('Y-m-d')],
            ['EMP005', 'Sample Employee 5', 'Marketing', '4800.00', '450.00', '900.00', '700.00', '280.00', '450.00', '190.00', '380.00', '1st', date('Y-m-d')]
        ];
        
        // Add sample data
        $row = 2;
        foreach ($sampleData as $rowData) {
            $col = 'A';
            foreach ($rowData as $value) {
                $benefitsSheet->setCellValue($col . $row, $value);
                $col++;
            }
            $row++;
        }
        
        // Style sample data rows
        $sampleRange = 'A2:M6';
        $benefitsSheet->getStyle($sampleRange)->applyFromArray([
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'color' => ['rgb' => 'FFF2CC']
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'CCCCCC']
                ]
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER
            ]
        ]);
        
        // Add instructions
        $benefitsSheet->setCellValue('A8', 'INSTRUCTIONS:');
        $benefitsSheet->setCellValue('A9', '1. Replace sample data with actual employee information');
        $benefitsSheet->setCellValue('A10', '2. Employee ID must match exactly with system records');
        $benefitsSheet->setCellValue('A11', '3. Use numeric values for all benefit amounts (e.g., 1000.00)');
        $benefitsSheet->setCellValue('A12', '4. Cutoff must be either "1st" or "2nd"');
        $benefitsSheet->setCellValue('A13', '5. Date format: YYYY-MM-DD (e.g., ' . date('Y-m-d') . ')');
        $benefitsSheet->setCellValue('A14', '6. Delete sample rows before importing');
        
        // Style instructions
        $benefitsSheet->getStyle('A8')->getFont()->setBold(true)->setSize(12);
        $benefitsSheet->getStyle('A8:A14')->getFont()->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF0000'));
        
        // Create Employee List sheet
        $employeeSheet = $spreadsheet->createSheet();
        $employeeSheet->setTitle('Employee List');
        
        // Get all active employees
        $employees = Employee::where('JobStatus', 'Active')
            ->select('idno', 'Lname', 'Fname', 'MName', 'Suffix', 'Department', 'Jobtitle')
            ->orderBy('Department')
            ->orderBy('Lname')
            ->get();
        
        // Employee list headers
        $empHeaders = [
            'A1' => 'Employee ID',
            'B1' => 'Last Name',
            'C1' => 'First Name',
            'D1' => 'Middle Name',
            'E1' => 'Suffix',
            'F1' => 'Full Name',
            'G1' => 'Department',
            'H1' => 'Job Title'
        ];
        
        // Set employee headers
        foreach ($empHeaders as $cell => $header) {
            $employeeSheet->setCellValue($cell, $header);
        }
        
        // Style employee headers
        $empHeaderRange = 'A1:H1';
        $employeeSheet->getStyle($empHeaderRange)->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 12
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'color' => ['rgb' => '70AD47']
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => '000000']
                ]
            ]
        ]);
        
        // Add employee data
        $row = 2;
        foreach ($employees as $employee) {
            $fullName = trim($employee->Lname . ', ' . $employee->Fname . ' ' . ($employee->MName ?? '') . ' ' . ($employee->Suffix ?? ''));
            
            $employeeSheet->setCellValue('A' . $row, $employee->idno);
            $employeeSheet->setCellValue('B' . $row, $employee->Lname);
            $employeeSheet->setCellValue('C' . $row, $employee->Fname);
            $employeeSheet->setCellValue('D' . $row, $employee->MName ?? '');
            $employeeSheet->setCellValue('E' . $row, $employee->Suffix ?? '');
            $employeeSheet->setCellValue('F' . $row, $fullName);
            $employeeSheet->setCellValue('G' . $row, $employee->Department ?? '');
            $employeeSheet->setCellValue('H' . $row, $employee->Jobtitle ?? '');
            
            $row++;
        }
        
        // Auto-size employee sheet columns
        foreach (range('A', 'H') as $column) {
            $employeeSheet->getColumnDimension($column)->setAutoSize(true);
        }
        
        // Style employee data
        if ($row > 2) {
            $empDataRange = 'A2:H' . ($row - 1);
            $employeeSheet->getStyle($empDataRange)->applyFromArray([
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => Border::BORDER_THIN,
                        'color' => ['rgb' => 'CCCCCC']
                    ]
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_LEFT
                ]
            ]);
        }
        
        // Add summary at the bottom of employee sheet
        $summaryRow = $row + 2;
        $employeeSheet->setCellValue('A' . $summaryRow, 'Total Active Employees: ' . ($row - 2));
        $employeeSheet->getStyle('A' . $summaryRow)->getFont()->setBold(true);
        
        // Create Default Values sheet for reference
        $defaultsSheet = $spreadsheet->createSheet();
        $defaultsSheet->setTitle('Default Values Reference');
        
        // Get employees with default benefits
        $employeesWithDefaults = Employee::with(['benefits' => function ($query) {
                $query->where('is_default', true)->latest();
            }])
            ->where('JobStatus', 'Active')
            ->select('id', 'idno', 'Lname', 'Fname', 'MName', 'Suffix', 'Department')
            ->get();
        
        // Default values headers
        $defaultHeaders = [
            'A1' => 'Employee ID',
            'B1' => 'Employee Name',
            'C1' => 'Department',
            'D1' => 'Allowances',
            'E1' => 'MF Shares',
            'F1' => 'MF Loan',
            'G1' => 'SSS Loan',
            'H1' => 'SSS Premium',
            'I1' => 'HMDF Loan',
            'J1' => 'HMDF Premium',
            'K1' => 'PhilHealth'
        ];
        
        // Set default headers
        foreach ($defaultHeaders as $cell => $header) {
            $defaultsSheet->setCellValue($cell, $header);
        }
        
        // Style default headers
        $defaultHeaderRange = 'A1:K1';
        $defaultsSheet->getStyle($defaultHeaderRange)->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 12
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'color' => ['rgb' => 'FFC000']
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => '000000']
                ]
            ]
        ]);
        
        // Add default values data
        $row = 2;
        foreach ($employeesWithDefaults as $employee) {
            $benefit = $employee->benefits->first();
            $employeeName = trim($employee->Lname . ', ' . $employee->Fname . ' ' . ($employee->MName ?? ''));
            
            $defaultsSheet->setCellValue('A' . $row, $employee->idno);
            $defaultsSheet->setCellValue('B' . $row, $employeeName);
            $defaultsSheet->setCellValue('C' . $row, $employee->Department ?? '');
            
            if ($benefit) {
                $defaultsSheet->setCellValue('D' . $row, number_format($benefit->allowances ?? 0, 2));
                $defaultsSheet->setCellValue('E' . $row, number_format($benefit->mf_shares ?? 0, 2));
                $defaultsSheet->setCellValue('F' . $row, number_format($benefit->mf_loan ?? 0, 2));
                $defaultsSheet->setCellValue('G' . $row, number_format($benefit->sss_loan ?? 0, 2));
                $defaultsSheet->setCellValue('H' . $row, number_format($benefit->sss_prem ?? 0, 2));
                $defaultsSheet->setCellValue('I' . $row, number_format($benefit->hmdf_loan ?? 0, 2));
                $defaultsSheet->setCellValue('J' . $row, number_format($benefit->hmdf_prem ?? 0, 2));
                $defaultsSheet->setCellValue('K' . $row, number_format($benefit->philhealth ?? 0, 2));
            } else {
                // Set default zeros if no default benefit exists
                foreach (range('D', 'K') as $col) {
                    $defaultsSheet->setCellValue($col . $row, '0.00');
                }
            }
            
            $row++;
        }
        
        // Auto-size default sheet columns
        foreach (range('A', 'K') as $column) {
            $defaultsSheet->getColumnDimension($column)->setAutoSize(true);
        }
        
        // Style default data
        if ($row > 2) {
            $defaultDataRange = 'A2:K' . ($row - 1);
            $defaultsSheet->getStyle($defaultDataRange)->applyFromArray([
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => Border::BORDER_THIN,
                        'color' => ['rgb' => 'CCCCCC']
                    ]
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER
                ]
            ]);
        }
        
        // Add note at the bottom
        $noteRow = $row + 2;
        $defaultsSheet->setCellValue('A' . $noteRow, 'NOTE: This sheet shows current default values for employees. Use this as reference when creating new benefits.');
        $defaultsSheet->getStyle('A' . $noteRow)->getFont()->setBold(true)->setItalic(true);
        $defaultsSheet->mergeCells('A' . $noteRow . ':K' . $noteRow);
        
        // Set the active sheet back to Benefits Template
        $spreadsheet->setActiveSheetIndex(0);
        
        $writer = new Xlsx($spreadsheet);
        
        // Set headers for download
        $date = date('Y-m-d');
        $filename = "benefits_import_template_with_employee_list_{$date}.xlsx";
        
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment;filename="' . $filename . '"');
        header('Cache-Control: max-age=0');
        
        $writer->save('php://output');
        exit;
    }

    /**
     * Enhanced import method to handle the new template format
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
            
            // Try to get the Benefits Template sheet first, fallback to first sheet
            $worksheet = null;
            try {
                $worksheet = $spreadsheet->getSheetByName('Benefits Template');
            } catch (\Exception $e) {
                $worksheet = $spreadsheet->getActiveSheet();
            }
            
            $rows = $worksheet->toArray();
            
            // Remove header row
            array_shift($rows);
            
            $imported = 0;
            $errors = [];
            $skippedSamples = 0;
            
            DB::beginTransaction();
            
            foreach ($rows as $index => $row) {
                $rowNumber = $index + 2; // +2 because we removed header and array is 0-indexed
                
                // Skip empty rows
                if (empty(array_filter($row))) {
                    continue;
                }
                
                // Skip sample data rows (check if employee ID starts with "EMP" and name contains "Sample")
                if (isset($row[0]) && isset($row[1]) && 
                    (strpos($row[0], 'EMP') === 0 || strpos($row[1], 'Sample') !== false)) {
                    $skippedSamples++;
                    continue;
                }
                
                try {
                    // Find employee by ID
                    $employee = Employee::where('idno', trim($row[0]))->first();
                    
                    if (!$employee) {
                        $errors[] = "Row {$rowNumber}: Employee with ID '{$row[0]}' not found.";
                        continue;
                    }
                    
                    // Check if benefit already exists
                    $existingBenefit = Benefit::where('employee_id', $employee->id)
                        ->where('cutoff', $cutoff)
                        ->where('date', $date)
                        ->first();
                    
                    $benefitData = [
                        'employee_id' => $employee->id,
                        'allowances' => floatval($row[3] ?? 0),      // Column D
                        'mf_shares' => floatval($row[4] ?? 0),       // Column E
                        'mf_loan' => floatval($row[5] ?? 0),         // Column F
                        'sss_loan' => floatval($row[6] ?? 0),        // Column G
                        'sss_prem' => floatval($row[7] ?? 0),        // Column H
                        'hmdf_loan' => floatval($row[8] ?? 0),       // Column I
                        'hmdf_prem' => floatval($row[9] ?? 0),       // Column J
                        'philhealth' => floatval($row[10] ?? 0),     // Column K
                        'cutoff' => $cutoff,
                        'date' => $date,
                        'is_posted' => false,
                        'is_default' => false,
                    ];
                    
                    if ($existingBenefit) {
                        // Update existing benefit if not posted
                        if ($existingBenefit->is_posted) {
                            $errors[] = "Row {$rowNumber}: Benefit for employee '{$row[0]}' is already posted and cannot be updated.";
                            continue;
                        }
                        $existingBenefit->update($benefitData);
                    } else {
                        // Create new benefit
                        Benefit::create($benefitData);
                    }
                    
                    $imported++;
                    
                } catch (\Exception $e) {
                    $errors[] = "Row {$rowNumber}: " . $e->getMessage();
                }
            }
            
            DB::commit();
            
            $message = "Successfully imported {$imported} benefits.";
            if ($skippedSamples > 0) {
                $message .= " Skipped {$skippedSamples} sample data rows.";
            }
            
            return response()->json([
                'success' => true,
                'message' => $message,
                'imported_count' => $imported,
                'skipped_samples' => $skippedSamples,
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
     * Validate numeric value for import
     */
    private function validateNumericValue($value, $rowNumber, $fieldName)
    {
        if (empty($value) || $value === '') {
            return 0;
        }
        
        $numericValue = floatval($value);
        
        if ($numericValue < 0) {
            throw new \Exception("Invalid {$fieldName} value. Must be non-negative.");
        }
        
        return $numericValue;
    }

    /**
     * Export benefits to Excel - Enhanced formatting
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
        
        // Query to get employees with benefits
        $query = Employee::with(['benefits' => function ($query) use ($cutoff, $startDate, $endDate) {
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
        $sheet->setTitle('Benefits Export');
        
        // Set headers with formatting
        $headers = [
            'A1' => 'Employee ID',
            'B1' => 'Employee Name',
            'C1' => 'Department',
            'D1' => 'Allowances',
            'E1' => 'MF Shares',
            'F1' => 'MF Loan',
            'G1' => 'SSS Loan',
            'H1' => 'SSS Premium',
            'I1' => 'HMDF Loan',
            'J1' => 'HMDF Premium',
            'K1' => 'PhilHealth',
            'L1' => 'Cutoff',
            'M1' => 'Date',
            'N1' => 'Status',
            'O1' => 'Is Default'
        ];
        
        foreach ($headers as $cell => $header) {
            $sheet->setCellValue($cell, $header);
            $sheet->getStyle($cell)->getFont()->setBold(true);
            $sheet->getStyle($cell)->getFill()
                ->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setARGB('FFE2EFDA');
            $sheet->getStyle($cell)->getAlignment()
                ->setHorizontal(Alignment::HORIZONTAL_CENTER);
        }
        
        // Add data with formatting
        $row = 2;
        foreach ($employees as $employee) {
            $benefit = $employee->benefits->first();
            $employeeName = trim($employee->Lname . ', ' . $employee->Fname . ' ' . ($employee->MName ?? ''));
            
            $sheet->setCellValue('A' . $row, $employee->idno);
            $sheet->setCellValue('B' . $row, $employeeName);
            $sheet->setCellValue('C' . $row, $employee->Department ?? '');
            $sheet->setCellValue('D' . $row, $benefit ? number_format($benefit->allowances, 2) : '0.00');
            $sheet->setCellValue('E' . $row, $benefit ? number_format($benefit->mf_shares, 2) : '0.00');
            $sheet->setCellValue('F' . $row, $benefit ? number_format($benefit->mf_loan, 2) : '0.00');
            $sheet->setCellValue('G' . $row, $benefit ? number_format($benefit->sss_loan, 2) : '0.00');
            $sheet->setCellValue('H' . $row, $benefit ? number_format($benefit->sss_prem, 2) : '0.00');
            $sheet->setCellValue('I' . $row, $benefit ? number_format($benefit->hmdf_loan, 2) : '0.00');
            $sheet->setCellValue('J' . $row, $benefit ? number_format($benefit->hmdf_prem, 2) : '0.00');
            $sheet->setCellValue('K' . $row, $benefit ? number_format($benefit->philhealth, 2) : '0.00');
            $sheet->setCellValue('L' . $row, $benefit ? $benefit->cutoff : $cutoff);
            $sheet->setCellValue('M' . $row, $benefit ? $benefit->date->format('Y-m-d') : '');
            $sheet->setCellValue('N' . $row, $benefit ? ($benefit->is_posted ? 'Posted' : 'Pending') : 'No Data');
            $sheet->setCellValue('O' . $row, $benefit ? ($benefit->is_default ? 'Yes' : 'No') : 'No');
            
            // Add row coloring based on status
            if (!$benefit) {
                $sheet->getStyle('A' . $row . ':O' . $row)->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()->setARGB('FFFCE4EC');
            } elseif ($benefit->is_posted) {
                $sheet->getStyle('A' . $row . ':O' . $row)->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()->setARGB('FFE8F5E8');
            } elseif ($benefit->is_default) {
                $sheet->getStyle('A' . $row . ':O' . $row)->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()->setARGB('FFFFF3CD');
            }
            
            $row++;
        }
        
        // Auto-size columns
        foreach (range('A', 'O') as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }
        
        // Add summary information
        $summaryRow = $row + 2;
        $sheet->setCellValue('A' . $summaryRow, 'EXPORT SUMMARY:');
        $sheet->getStyle('A' . $summaryRow)->getFont()->setBold(true);
        
        $sheet->setCellValue('A' . ($summaryRow + 1), 'Export Date: ' . date('Y-m-d H:i:s'));
        $sheet->setCellValue('A' . ($summaryRow + 2), 'Period: ' . $cutoff . ' cutoff, ' . $month . '/' . $year);
        $sheet->setCellValue('A' . ($summaryRow + 3), 'Total Employees: ' . $employees->count());
        $sheet->setCellValue('A' . ($summaryRow + 4), 'With Benefits: ' . $employees->filter(function($emp) { return $emp->benefits->count() > 0; })->count());
        $sheet->setCellValue('A' . ($summaryRow + 5), 'Without Benefits: ' . $employees->filter(function($emp) { return $emp->benefits->count() == 0; })->count());
        
        $writer = new Xlsx($spreadsheet);
        
        // Set headers for download
        $filename = 'benefits_export_' . $cutoff . '_' . $month . '_' . $year . '_' . date('Y-m-d') . '.xlsx';
        
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment;filename="' . $filename . '"');
        header('Cache-Control: max-age=0');
        
        $writer->save('php://output');
        exit;
    }

    /**
     * Get employee defaults with enhanced pagination and search
     */
    public function getEmployeeDefaults(Request $request)
    {
        try {
            $search = $request->input('search', '');
            $perPage = $request->input('perPage', 50);
            
            $query = Employee::with(['benefits' => function ($query) {
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
    
    /**
     * Show employee defaults management page
     */
    public function showEmployeeDefaultsPage()
    {
        return Inertia::render('Benefits/EmployeeDefaultsPage', [
            'auth' => [
                'user' => Auth::user(),
            ],
        ]);
    }
    
    /**
     * Store a newly created or update existing benefit in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'mf_shares' => 'nullable|numeric|min:0',
            'mf_loan' => 'nullable|numeric|min:0',
            'sss_loan' => 'nullable|numeric|min:0',
            'hmdf_loan' => 'nullable|numeric|min:0',
            'hmdf_prem' => 'nullable|numeric|min:0',
            'sss_prem' => 'nullable|numeric|min:0',
            'philhealth' => 'nullable|numeric|min:0',
            'allowances' => 'nullable|numeric|min:0',
            'cutoff' => 'required|in:1st,2nd',
            'date' => 'required|date',
            'is_default' => 'nullable|boolean',
        ]);
        
        // Check if the benefit is already posted
        if ($request->has('id')) {
            $existingBenefit = Benefit::find($request->input('id'));
            if ($existingBenefit && $existingBenefit->is_posted) {
                throw ValidationException::withMessages([
                    'general' => ['This benefit has been posted and cannot be updated.'],
                ]);
            }
        }
        
        // Set default values for null numeric fields
        foreach (['mf_shares', 'mf_loan', 'sss_loan', 
                 'hmdf_loan', 'hmdf_prem', 'sss_prem', 'philhealth', 'allowances'] as $field) {
            $validated[$field] = $validated[$field] ?? 0;
        }
        
        // Create or update the benefit
        if ($request->has('id')) {
            $benefit = Benefit::findOrFail($request->input('id'));
            $benefit->update($validated);
        } else {
            $benefit = Benefit::create($validated);
        }
        
        // Return the updated benefit
        return response()->json($benefit);
    }

    /**
     * Update the specified benefit in storage.
     */
    public function update(Request $request, $id)
    {
        $benefit = Benefit::findOrFail($id);
        
        // Check if the benefit is already posted
        if ($benefit->is_posted) {
            throw ValidationException::withMessages([
                'general' => ['This benefit has been posted and cannot be updated.'],
            ]);
        }
        
        $validated = $request->validate([
            'mf_shares' => 'nullable|numeric|min:0',
            'mf_loan' => 'nullable|numeric|min:0',
            'sss_loan' => 'nullable|numeric|min:0',
            'hmdf_loan' => 'nullable|numeric|min:0',
            'hmdf_prem' => 'nullable|numeric|min:0',
            'sss_prem' => 'nullable|numeric|min:0',
            'philhealth' => 'nullable|numeric|min:0',
            'allowances' => 'nullable|numeric|min:0',
        ]);
        
        // Set default values for null numeric fields
        foreach (['mf_shares', 'mf_loan', 'sss_loan', 
                 'hmdf_loan', 'hmdf_prem', 'sss_prem', 'philhealth', 'allowances'] as $field) {
            $validated[$field] = $validated[$field] ?? 0;
        }
        
        // Update the benefit
        $benefit->update($validated);
        
        // Return the updated benefit
        return response()->json($benefit);
    }

    /**
     * Update a single field in a benefit record
     */
    public function updateField(Request $request, $id)
    {
        $benefit = Benefit::findOrFail($id);
        
        // Check if the benefit is already posted
        if ($benefit->is_posted) {
            throw ValidationException::withMessages([
                'general' => ['This benefit has been posted and cannot be updated.'],
            ]);
        }
        
        $field = $request->input('field');
        $value = $request->input('value');
        
        // Validate that the field exists - Added allowances
        $allowedFields = [
            'mf_shares', 'mf_loan', 'sss_loan', 'hmdf_loan', 
            'hmdf_prem', 'sss_prem', 'philhealth', 'allowances'
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
        $benefit->$field = $value ?? 0;
        $benefit->save();
        
        // Return the updated benefit
        return response()->json($benefit);
    }

    /**
     * Mark benefit as posted.
     */
    public function postBenefit($id)
    {
        $benefit = Benefit::findOrFail($id);
        
        // Check if already posted
        if ($benefit->is_posted) {
            throw ValidationException::withMessages([
                'general' => ['This benefit is already posted.'],
            ]);
        }
        
        // Post the benefit
        $benefit->is_posted = true;
        $benefit->date_posted = Carbon::now();
        $benefit->save();
        
        return response()->json($benefit);
    }

    /**
     * Post all benefits for a specific cutoff period.
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
        
        // Post all unposted benefits for the specified period
        $updatedCount = Benefit::whereBetween('date', [$startDate, $endDate])
            ->where('cutoff', $cutoff)
            ->where('is_posted', false)
            ->update([
                'is_posted' => true, 
                'date_posted' => Carbon::now()
            ]);
        
        return response()->json([
            'message' => "{$updatedCount} benefits have been successfully posted.",
            'updated_count' => $updatedCount
        ]);
    }

    /**
     * Post multiple benefits in bulk
     */
    public function bulkPost(Request $request)
    {
        $benefitIds = $request->input('benefit_ids', []);
        
        if (empty($benefitIds)) {
            throw ValidationException::withMessages([
                'benefit_ids' => ['No benefits selected for posting.'],
            ]);
        }
        
        // Begin transaction
        DB::beginTransaction();
        
        try {
            $postedCount = 0;
            $now = Carbon::now();
            
            foreach ($benefitIds as $id) {
                $benefit = Benefit::find($id);
                
                if ($benefit && !$benefit->is_posted) {
                    $benefit->is_posted = true;
                    $benefit->date_posted = $now;
                    $benefit->save();
                    $postedCount++;
                }
            }
            
            DB::commit();
            
            return response()->json([
                'message' => "{$postedCount} benefits have been successfully posted.",
                'posted_count' => $postedCount
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            
            throw ValidationException::withMessages([
                'general' => ['Failed to post benefits: ' . $e->getMessage()],
            ]);
        }
    }

    /**
     * Mark a benefit as default for an employee.
     */
    public function setDefault(Request $request, $id)
    {
        $benefit = Benefit::findOrFail($id);
        
        // Begin transaction to ensure atomicity
        DB::beginTransaction();
        
        try {
            // Remove other default benefits for this employee
            Benefit::where('employee_id', $benefit->employee_id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
            
            // Set this benefit as default
            $benefit->is_default = true;
            $benefit->save();
            
            DB::commit();
            
            return response()->json($benefit);
        } catch (\Exception $e) {
            DB::rollBack();
            
            throw ValidationException::withMessages([
                'general' => ['Failed to set default benefit: ' . $e->getMessage()],
            ]);
        }
    }

    /**
     * Set multiple benefits as default in bulk
     */
    public function bulkSetDefault(Request $request)
    {
        $benefitIds = $request->input('benefit_ids', []);
        
        if (empty($benefitIds)) {
            throw ValidationException::withMessages([
                'benefit_ids' => ['No benefits selected to set as default.'],
            ]);
        }
        
        // Begin transaction
        DB::beginTransaction();
        
        try {
            $updatedCount = 0;
            
            // Group benefits by employee_id
            $benefits = Benefit::whereIn('id', $benefitIds)->get();
            $employeeIds = $benefits->pluck('employee_id')->unique();
            
            // For each employee, clear existing defaults
            foreach ($employeeIds as $employeeId) {
                Benefit::where('employee_id', $employeeId)
                    ->where('is_default', true)
                    ->update(['is_default' => false]);
                
                // Find the benefit for this employee from our selection
                $benefitForEmployee = $benefits->firstWhere('employee_id', $employeeId);
                
                if ($benefitForEmployee) {
                    $benefitForEmployee->is_default = true;
                    $benefitForEmployee->save();
                    $updatedCount++;
                }
            }
            
            DB::commit();
            
            return response()->json([
                'message' => "{$updatedCount} benefits have been set as default.",
                'updated_count' => $updatedCount
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            
            throw ValidationException::withMessages([
                'general' => ['Failed to set default benefits: ' . $e->getMessage()],
            ]);
        }
    }

    /**
     * Create a new benefit entry based on defaults.
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
            // Check if benefit already exists for this cutoff and date
            $existingBenefit = Benefit::where('employee_id', $validated['employee_id'])
                ->where('cutoff', $validated['cutoff'])
                ->where('date', $validated['date'])
                ->first();
                
            if ($existingBenefit) {
                DB::commit();
                return response()->json($existingBenefit);
            }
            
            // Get the default benefit for this employee
            $defaultBenefit = Benefit::where('employee_id', $validated['employee_id'])
                ->where('is_default', true)
                ->latest()
                ->first();
                
            if ($defaultBenefit) {
                // Create new benefit based on default values
                $benefit = new Benefit();
                $benefit->employee_id = $validated['employee_id'];
                $benefit->cutoff = $validated['cutoff'];
                $benefit->date = $validated['date'];
                $benefit->is_posted = false;
                $benefit->is_default = false;
                
                // Copy values from default benefit - Added allowances
                $benefit->mf_shares = $defaultBenefit->mf_shares;
                $benefit->mf_loan = $defaultBenefit->mf_loan;
                $benefit->sss_loan = $defaultBenefit->sss_loan;
                $benefit->hmdf_loan = $defaultBenefit->hmdf_loan;
                $benefit->hmdf_prem = $defaultBenefit->hmdf_prem;
                $benefit->sss_prem = $defaultBenefit->sss_prem;
                $benefit->philhealth = $defaultBenefit->philhealth;
                $benefit->allowances = $defaultBenefit->allowances;
                
                $benefit->save();
            } else {
                // If no default benefit exists, create an empty one
                $benefit = Benefit::create([
                    'employee_id' => $validated['employee_id'],
                    'cutoff' => $validated['cutoff'],
                    'date' => $validated['date'],
                    'is_posted' => false,
                    'is_default' => false
                ]);
            }
            
            DB::commit();
            return response()->json($benefit);
        } catch (\Exception $e) {
            DB::rollBack();
            
            throw ValidationException::withMessages([
                'general' => ['Failed to create benefit: ' . $e->getMessage()],
            ]);
        }
    }

    /**
     * Bulk create benefit entries for all active employees based on defaults.
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
                // Check if a benefit already exists for this employee, cutoff, and date
                $existingBenefit = Benefit::where('employee_id', $employee->id)
                    ->where('cutoff', $cutoff)
                    ->where('date', $date)
                    ->first();
                
                if (!$existingBenefit) {
                    // Get default benefit for this employee
                    $defaultBenefit = Benefit::where('employee_id', $employee->id)
                        ->where('is_default', true)
                        ->latest()
                        ->first();
                    
                    if ($defaultBenefit) {
                        // Create new benefit based on default values
                        $benefit = new Benefit();
                        $benefit->employee_id = $employee->id;
                        $benefit->cutoff = $cutoff;
                        $benefit->date = $date;
                        $benefit->is_posted = false;
                        $benefit->is_default = false;
                        
                        // Copy values from default benefit - Added allowances
                        $benefit->mf_shares = $defaultBenefit->mf_shares;
                        $benefit->mf_loan = $defaultBenefit->mf_loan;
                        $benefit->sss_loan = $defaultBenefit->sss_loan;
                        $benefit->hmdf_loan = $defaultBenefit->hmdf_loan;
                        $benefit->hmdf_prem = $defaultBenefit->hmdf_prem;
                        $benefit->sss_prem = $defaultBenefit->sss_prem;
                        $benefit->philhealth = $defaultBenefit->philhealth;
                        $benefit->allowances = $defaultBenefit->allowances;
                        
                        $benefit->save();
                    } else {
                        // If no default exists, create an empty benefit
                        $benefit = Benefit::create([
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
                'message' => "Created {$createdCount} new benefit entries.",
                'created_count' => $createdCount
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            
            throw ValidationException::withMessages([
                'general' => ['Failed to create benefit entries: ' . $e->getMessage()],
            ]);
        }
    }
}