import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import papaparse from 'papaparse';
import * as XLSX from 'xlsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    UploadCloud, 
    FileSpreadsheet, 
    Download, 
    AlertCircle,
    CheckCircle2,
    XCircle,
    Clock 
} from 'lucide-react';

// Create an alias for papaparse to use as Papa
const Papa = papaparse;

// Loader component for showing during import process
const Loader = () => (
    <div className="animate-spin h-5 w-5">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

const ImportAttendance = () => {
    const { auth } = usePage().props;
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [importResult, setImportResult] = useState(null);
    const [validationStatus, setValidationStatus] = useState(null);
    const [showSuccessActions, setShowSuccessActions] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    // Column definitions that match the UI and backend expectations
    const requiredColumns = [
        'employee_no',
        'date',
        'day',
        'in',
        'out',
        'in2',
        'out2',
        'next_day',
        'hours_work'
    ];

    // Define column mapping to handle variations in header names
    const columnMapping = {
        // Employee number variations
        'employee_no': ['employee_no', 'employee no', 'employee no.', 'employeeno', 'idno', 'employee number', 'id', 'id no', 'employee_no.'],
        
        // Date column
        'date': ['date'],
        
        // Day of week
        'day': ['day'],
        
        // First time in variations
        'in': ['in', 'in1', 'time in', 'time_in', 'timein', 'in time', 'first in', 'morning in', 'IN'],
        
        // First time out variations
        'out': ['out', 'out1', 'time out', 'time_out', 'timeout', 'out time', 'first out', 'morning out', 'OUT'],
        
        // Second time in (break end) variations
        'in2': ['in2', 'second in', 'break in', 'break_in', 'afternoon in', 'IN'],
        
        // Second time out (break start) variations
        'out2': ['out2', 'second out', 'break out', 'break_out', 'afternoon out', 'OUT'],
        
        // Next day time out variations
        'next_day': ['next day', 'next_day', 'nextday', 'overnight', 'next', 'Next day'],
        
        // Hours worked variations
        'hours_work': ['hours work', 'hours_work', 'work hours', 'total hours', 'hours', 'hours worked', 'Hours Work']
    };

    const resetState = () => {
        setFile(null);
        setPreview([]);
        setError('');
        setImportResult(null);
        setValidationStatus(null);
        setShowSuccessActions(false);
    };

    const formatDate = (dateString) => {
          try {
              return format(new Date(dateString), 'yyyy-MM-dd');
          } catch (error) {
              console.error('Error formatting date:', error);
              return 'Invalid date';
          }
      };
      
      const formatTime = (timeString) => {
          if (!timeString) return '-';
          
          try {
              let timeOnly;
              // Handle ISO 8601 format
              if (timeString.includes('T')) {
                  const [, time] = timeString.split('T');
                  timeOnly = time.slice(0, 5); // Extract HH:MM
              } else {
                  // If the time includes a date (like "2024-04-10 14:30:00"), split and take the time part
                  const timeParts = timeString.split(' ');
                  timeOnly = timeParts[timeParts.length - 1].slice(0, 5);
              }
              
              // Parse hours and minutes
              const [hours, minutes] = timeOnly.split(':');
              const hourNum = parseInt(hours, 10);
              
              // Convert to 12-hour format with AM/PM
              const ampm = hourNum >= 12 ? 'PM' : 'AM';
              const formattedHours = hourNum % 12 || 12; // handle midnight and noon
              
              return `${formattedHours}:${minutes} ${ampm}`;
          } catch (error) {
              console.error('Time formatting error:', error);
              return '-';
          }
      };

    // Format numeric values (like hours worked) to 2 decimal places
    const formatNumeric = (value) => {
        if (value === null || value === undefined || value === '') return '';
        const numValue = parseFloat(value);
        return isNaN(numValue) ? value : numValue.toFixed(2);
    };

    // Helper to normalize header names for comparison
    const normalizeHeaderName = (header) => {
        if (header === undefined || header === null) return '';
        return String(header).toLowerCase().trim().replace(/\s+/g, '_');
    };

    // Special handling for multiple "IN" and "OUT" columns
    const handleDuplicateInOutColumns = (headers) => {
        // Find indices of all columns containing "IN" and "OUT"
        const inColumns = headers
            .map((header, index) => ({ header: normalizeHeaderName(header), index }))
            .filter(item => item.header === 'in');
            
        const outColumns = headers
            .map((header, index) => ({ header: normalizeHeaderName(header), index }))
            .filter(item => item.header === 'out');
            
        // If there are exactly two "IN" columns, map them to "in" and "in2"
        if (inColumns.length === 2) {
            return { 
                'in': inColumns[0].index,
                'in2': inColumns[1].index
            };
        }
        
        // If there are exactly two "OUT" columns, map them to "out" and "out2"
        if (outColumns.length === 2) {
            return { 
                'out': outColumns[0].index,
                'out2': outColumns[1].index
            };
        }
        
        return {};
    };

    // Map a header to our standard column names
    const mapHeaderToColumn = (header) => {
        const normalizedHeader = normalizeHeaderName(header);
        
        for (const [column, variations] of Object.entries(columnMapping)) {
            const normalizedVariations = variations.map(normalizeHeaderName);
            if (normalizedVariations.includes(normalizedHeader)) {
                return column;
            }
        }
        
        return null;
    };

    // Validate if all required headers are present in the file
    const validateHeaders = (headers) => {
        // Create a map of column name -> index for all recognized headers
        const columnIndices = {};
        
        // Handle special case of multiple IN/OUT columns
        const duplicateInOutMapping = handleDuplicateInOutColumns(headers);
        Object.assign(columnIndices, duplicateInOutMapping);
        
        // Map all other headers to standard column names
        headers.forEach((header, index) => {
            const column = mapHeaderToColumn(header);
            if (column && !columnIndices[column]) {
                columnIndices[column] = index;
            }
        });
        
        // Find which required columns are missing
        const missingColumns = requiredColumns.filter(column => columnIndices[column] === undefined);
        
        return {
            valid: missingColumns.length === 0,
            missingColumns,
            columnIndices
        };
    };

    // Format row data based on column type
    const formatRowData = (row, headers, columnIndices) => {
        const formattedRow = [...row]; // Create a copy to avoid modifying the original
        
        // Format each cell based on its column type
        Object.entries(columnIndices).forEach(([column, index]) => {
            if (index >= 0 && index < row.length) {
                const value = row[index];
                
                switch (column) {
                    case 'date':
                        formattedRow[index] = formatDate(value);
                        break;
                    case 'in':
                    case 'out':
                    case 'in2':
                    case 'out2':
                    case 'next_day':
                        formattedRow[index] = formatTime(value);
                        break;
                    case 'hours_work':
                        formattedRow[index] = formatNumeric(value);
                        break;
                }
            }
        });
        
        return formattedRow;
    };

    // Validate file type and size
    const validateFile = (selectedFile) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv'
        ];

        // Check file type
        if (!allowedTypes.includes(selectedFile.type) && 
            !selectedFile.name.endsWith('.csv') && 
            !selectedFile.name.endsWith('.xlsx') && 
            !selectedFile.name.endsWith('.xls')) {
            throw new Error('Please upload only Excel or CSV files (.xlsx, .xls, .csv)');
        }

        // Check file size (10MB limit)
        if (selectedFile.size > 10 * 1024 * 1024) {  
            throw new Error('File size should not exceed 10MB');
        }

        return true;
    };

    // Process the selected file (shared logic for both drag & drop and file input)
    const processFile = useCallback(async (selectedFile) => {
        if (!selectedFile) return;

        try {
            validateFile(selectedFile);
        } catch (error) {
            setError(error.message);
            setValidationStatus('error');
            return;
        }

        setFile(selectedFile);
        setError('');
        setValidationStatus('validating');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                let jsonData;
                
                // Parse based on file type
                if (selectedFile.name.endsWith('.csv')) {
                    // For CSV files
                    const csvText = e.target.result;
                    const result = Papa.parse(csvText, { 
                        header: false,
                        skipEmptyLines: true
                    });
                    jsonData = result.data;
                } else {
                    // For Excel files
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                }
                
                // Validate the data
                if (!jsonData[0] || jsonData[0].length === 0) {
                    throw new Error('File appears to be empty');
                }

                const headerValidation = validateHeaders(jsonData[0]);
                
                if (!headerValidation.valid) {
                    setError(`Missing required columns: ${headerValidation.missingColumns.join(', ')}`);
                    setValidationStatus('error');
                    setFile(null);
                    return;
                }

                // Format the preview data
                const previewData = jsonData
                    .filter(row => row.some(cell => cell !== ''))
                    .slice(0, 6)
                    .map((row, index) => 
                        index === 0 ? row : formatRowData(row, jsonData[0], headerValidation.columnIndices)
                    );
                
                setPreview(previewData);
                setValidationStatus('success');
            } catch (error) {
                console.error('File reading error:', error);
                setError('Error reading file. Please make sure it\'s a valid Excel or CSV file.');
                setValidationStatus('error');
                setFile(null);
            }
        };

        // Read the file as array buffer for Excel files or text for CSV
        if (selectedFile.name.endsWith('.csv')) {
            reader.readAsText(selectedFile);
        } else {
            reader.readAsArrayBuffer(selectedFile);
        }
    }, []);

    // Handle file input change
    const handleFileChange = useCallback(async (e) => {
        const selectedFile = e.target.files[0];
        await processFile(selectedFile);
    }, [processFile]);

    // Simple and effective drag and drop - minimal approach
    const dropZoneRef = React.useRef(null);
    
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
    }, []);

    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Only hide if truly leaving the drop zone
        const rect = e.currentTarget.getBoundingClientRect();
        if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
        ) {
            setIsDragOver(false);
        }
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            await processFile(files[0]);
        }
    }, [processFile]);

    // Global drag prevention - only prevent defaults, don't interfere with our handlers
    React.useEffect(() => {
        const handleGlobalDragOver = (e) => {
            // Only prevent if not over our drop zone
            if (!dropZoneRef.current?.contains(e.target)) {
                e.preventDefault();
            }
        };

        const handleGlobalDrop = (e) => {
            // Only prevent if not over our drop zone
            if (!dropZoneRef.current?.contains(e.target)) {
                e.preventDefault();
            }
        };

        document.addEventListener('dragover', handleGlobalDragOver);
        document.addEventListener('drop', handleGlobalDrop);

        return () => {
            document.removeEventListener('dragover', handleGlobalDragOver);
            document.removeEventListener('drop', handleGlobalDrop);
        };
    }, []);

    // Handle the upload and import process
    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        setUploading(true);
        setError('');
        setImportResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/attendance/import', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                },
                credentials: 'same-origin',
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.message || 'Import failed');
            }

            setImportResult(data);
            if (data.failures?.length === 0) {
                setShowSuccessActions(true);
            }
        } catch (error) {
            console.error('Import error:', error);
            setError(error.message || 'Import failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    // Download template function
    const downloadTemplate = async () => {
        try {
            // Use direct URL for download
            window.location.href = '/attendance/template/download';
        } catch (error) {
            console.error('Download error:', error);
            setError('Failed to download template: ' + error.message);
        }
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Import Attendance Records" />
            <div className="flex min-h-screen bg-gray-50/50">
                <Sidebar />
                <div className="flex-1 p-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                    Import Attendance Records
                                </h1>
                                <p className="text-gray-600">
                                    Bulk import employee attendance data using our Excel template.
                                </p>
                            </div>
                        </div>
                        
                        <Card className="max-w-4xl mx-auto">
                            {/* Full-screen drag overlay */}
                            {isDragOver && (
                                <div 
                                    className="fixed inset-0 z-50 bg-blue-500 bg-opacity-20 flex items-center justify-center"
                                    style={{ pointerEvents: 'none' }}
                                >
                                    <div className="bg-white p-8 rounded-lg shadow-lg border-2 border-blue-400 border-dashed">
                                        <div className="text-center">
                                            <UploadCloud className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                                            <p className="text-xl font-semibold text-blue-600">Drop your Excel file here</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <CardHeader>
                                <CardTitle>Import Attendance</CardTitle>
                                <p className="text-gray-600">
                                    Upload your Excel file containing attendance records with the format matching the sample template.
                                </p>
                            </CardHeader>

                            <CardContent>
                                <div className="space-y-6">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <h3 className="text-sm font-medium text-blue-800 mb-2">Required Columns:</h3>
                                        <div className="grid grid-cols-3 gap-2">
                                            {/* Display the same column names as in the UI screenshot */}
                                            {[
                                                'employee no', 'date', 'day',
                                                'in', 'out', 'in2',
                                                'out2', 'next day', 'hours work'
                                            ].map((col) => (
                                                <div key={col} className="flex items-center text-sm text-blue-700">
                                                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-2" />
                                                    {col}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <Button
                                        onClick={downloadTemplate}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download Attendance Import Template
                                    </Button>

                                    <div 
                                        ref={dropZoneRef}
                                        className={`border-2 border-dashed rounded-lg p-8 transition-colors relative ${
                                            isDragOver 
                                                ? 'border-blue-400 bg-blue-50' 
                                                : validationStatus === 'success' 
                                                    ? 'border-green-300 bg-green-50' 
                                                    : validationStatus === 'error' 
                                                        ? 'border-red-300 bg-red-50' 
                                                        : 'border-gray-300'
                                        }`}
                                        onDragEnter={handleDragEnter}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        style={{ 
                                            minHeight: '200px',
                                            position: 'relative'
                                        }}
                                    >
                                        <input
                                            type="file"
                                            onChange={handleFileChange}
                                            className="hidden"
                                            id="file-upload"
                                            accept=".xlsx,.xls,.csv"
                                        />
                                        <label
                                            htmlFor="file-upload"
                                            className="cursor-pointer flex flex-col items-center"
                                        >
                                            {validationStatus === 'success' ? (
                                                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                                            ) : validationStatus === 'error' ? (
                                                <XCircle className="h-12 w-12 text-red-500 mb-4" />
                                            ) : (
                                                <UploadCloud className={`h-12 w-12 mb-4 ${
                                                    isDragOver ? 'text-blue-500' : 'text-gray-400'
                                                }`} />
                                            )}
                                            <span className={`text-center ${
                                                isDragOver ? 'text-blue-600' : 'text-gray-600'
                                            }`}>
                                                {file ? (
                                                    <div className="flex items-center gap-2">
                                                        <FileSpreadsheet className="h-5 w-5" />
                                                        {file.name}
                                                    </div>
                                                ) : isDragOver ? (
                                                    'Drop your file here'
                                                ) : (
                                                    'Drop your Excel file here or click to browse'
                                                )}
                                            </span>
                                            {!file && (
                                                <span className="text-sm text-gray-500 mt-2">
                                                    Supports .xlsx, .xls, and .csv files (max 10MB)
                                                </span>
                                            )}
                                        </label>
                                    </div>

                                    {preview.length > 0 && (
                                        <div className="border rounded-lg overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            {preview[0].map((header, index) => (
                                                                <th
                                                                    key={index}
                                                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                                >
                                                                    {header}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {preview.slice(1).map((row, rowIndex) => (
                                                            <tr key={rowIndex}>
                                                                {row.map((cell, cellIndex) => (
                                                                    <td
                                                                        key={cellIndex}
                                                                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                                                    >
                                                                        {cell}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {error && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    {importResult && (
                                        <Alert variant={importResult.failures?.length === 0 ? "default" : "warning"}>
                                            <AlertTitle>
                                                {importResult.failures?.length === 0 ? "Success!" : "Import Complete"}
                                            </AlertTitle>
                                            <AlertDescription>
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                        <span className="font-medium">
                                                            {importResult.message}
                                                        </span>
                                                    </div>
                                                    {importResult.successful > 0 && (
                                                        <div className="text-sm text-green-600">
                                                            Total records processed: {importResult.total_processed}
                                                        </div>
                                                    )}
                                                    {importResult.failures?.length > 0 && (
                                                        <>
                                                            <div className="flex items-center gap-2 mt-4">
                                                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                                                <span className="font-medium">Failed Imports</span>
                                                            </div>
                                                            <div className="mt-2 max-h-40 overflow-y-auto border-l-2 border-amber-200 pl-4">
                                                                {importResult.failures.map((failure, index) => (
                                                                    <div key={index} className="text-sm text-amber-600 mb-1">
                                                                        Row {failure.row}: {failure.errors.join(", ")}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <Button
                                        onClick={handleUpload}
                                        disabled={!file || uploading || validationStatus !== 'success'}
                                        className="w-full"
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader />
                                                <span className="ml-2">Importing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Clock className="w-4 h-4 mr-2" />
                                                Upload and Import Attendance
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
};

export default ImportAttendance;