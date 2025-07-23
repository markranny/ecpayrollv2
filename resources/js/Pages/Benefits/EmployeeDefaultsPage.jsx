import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Search, 
    Save,
    Plus,
    Edit,
    CheckCircle,
    ArrowLeft,
    Star,
    Loader,
    Download,
    Upload,
    Lock,
    AlertCircle,
    CheckSquare
} from 'lucide-react';
import { debounce } from 'lodash';
import axios from 'axios';
import * as XLSX from 'xlsx';

const EditableCell = ({ 
    value, 
    isEditing, 
    onChange, 
    onSave, 
    isDisabled, 
    onKeyDown,
    rowIndex,
    colIndex,
    field,
    onClick,
    onCreateAndEdit,
    benefitExists
}) => {
    const [localValue, setLocalValue] = useState(value !== undefined ? value.toString() : "0.00");
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    useEffect(() => {
        if (value !== undefined) {
            setLocalValue(value.toString());
        }
    }, [value]);

    const handleChange = (e) => {
        setLocalValue(e.target.value);
        if (onChange) {
            onChange(e.target.value);
        }
    };

    const handleBlur = () => {
        if (onSave) {
            onSave(localValue);
        }
    };

    const handleKeyDown = (e) => {
        // Handle Enter key to save
        if (e.key === 'Enter') {
            if (onSave) {
                onSave(localValue);
            }
            e.preventDefault();
        }
        // Pass keyboard events up to parent for navigation
        if (onKeyDown) {
            onKeyDown(e, rowIndex, colIndex, field);
        }
    };

    // Handle paste functionality
    const handlePaste = (e) => {
        // Get pasted data from clipboard
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData('text');
        
        // Check if it contains multiple lines/cells (from Excel)
        if (pastedData.includes('\t') || pastedData.includes('\n')) {
            e.preventDefault();
            
            // Split the pasted data into rows and cells
            const rows = pastedData.split(/\r\n|\n|\r/).filter(row => row.trim() !== '');
            const grid = rows.map(row => row.split('\t'));
            
            // Notify parent component about pasted data
            if (onChange) {
                onChange(localValue, { pastedData: grid, rowIndex, colIndex });
            }
        }
    };

    if (isDisabled) {
        return (
            <div 
                className="px-3 py-2 text-right text-gray-700 cursor-default min-h-[36px] flex items-center justify-end" 
                onClick={(e) => {
                    e.stopPropagation();
                    if (onClick) onClick();
                }}
            >
                {parseFloat(value || 0).toFixed(2)}
            </div>
        );
    }

    // Cell appearance when not editing
    if (!isEditing) {
        return (
            <div 
                className={`px-3 py-2 text-right ${benefitExists ? 'text-gray-700' : 'text-gray-400'} cursor-pointer hover:bg-gray-100 min-h-[36px] flex items-center justify-end transition-colors`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (benefitExists) {
                        if (onClick) onClick();
                    } else {
                        if (onCreateAndEdit) onCreateAndEdit();
                    }
                }}
            >
                {benefitExists ? parseFloat(value || 0).toFixed(2) : "0.00"}
            </div>
        );
    }

    // Cell appearance when editing
    return (
        <div className="px-3 py-2">
            <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0"
                className="w-full p-1 px-2 border border-blue-400 rounded text-right bg-white text-black font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                data-row={rowIndex}
                data-col={colIndex}
                data-field={field}
                onClick={(e) => e.stopPropagation()}
                style={{ 
                    boxShadow: "0 0 0 1px rgba(59, 130, 246, 0.5)", 
                    fontSize: '14px',
                    height: '32px'
                }}
                autoComplete="off"
            />
        </div>
    );
};

const BulkActionBar = ({ 
    selectedItems, 
    onClearSelection, 
    onBulkSetDefault, 
    onExportSelected,
    disabled 
}) => {
    const count = selectedItems.length;
    
    if (count === 0) return null;
    
    return (
        <div className="bg-blue-50 p-3 mb-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
                <CheckSquare className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-blue-700 font-medium">
                    {count} {count === 1 ? 'item' : 'items'} selected
                </span>
            </div>
            <div className="flex space-x-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-white hover:bg-gray-50"
                    onClick={onClearSelection}
                >
                    Clear Selection
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-yellow-50 hover:bg-yellow-100 border-yellow-300"
                    onClick={onBulkSetDefault}
                    disabled={disabled}
                >
                    <Star className="h-4 w-4 text-yellow-600 mr-1" />
                    Update Selected
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-blue-50 hover:bg-blue-100 border-blue-300"
                    onClick={onExportSelected}
                    disabled={disabled}
                >
                    <Download className="h-4 w-4 text-blue-600 mr-1" />
                    Export Selected
                </Button>
            </div>
        </div>
    );
};

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="default"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={onConfirm}
                    >
                        Confirm
                    </Button>
                </div>
            </div>
        </div>
    );
};

const EmployeeDefaultsPage = () => {
    // Make sure we safely access auth and user
    const { auth } = usePage().props || {};
    const user = auth?.user || {};
    
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [alertMessage, setAlertMessage] = useState(null);
    const [editingCell, setEditingCell] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [confirmation, setConfirmation] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });
    const [creatingBenefit, setCreatingBenefit] = useState(null);

    // Define benefit fields for keyboard navigation and editing
    const benefitFields = [
        { id: 'allowances', label: 'Allowances', width: '140px' },
        { id: 'mf_shares', label: 'MF Shares', width: '140px' },
        { id: 'mf_loan', label: 'MF Loan', width: '140px' },
        { id: 'sss_loan', label: 'SSS Loan', width: '140px' },
        { id: 'sss_prem', label: 'SSS Premium', width: '140px' },
        { id: 'hmdf_loan', label: 'HMDF Loan', width: '140px' },
        { id: 'hmdf_prem', label: 'HMDF Premium', width: '140px' },
        { id: 'philhealth', label: 'PhilHealth', width: '140px' }
    ];

    // Reset selection when employees change
    useEffect(() => {
        setSelectedItems([]);
        setSelectAll(false);
    }, [employees]);

    const loadEmployeeDefaults = useCallback(async () => {
        setLoading(true);
        setAlertMessage(null);
        
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            params.append('page', currentPage);
            
            const url = `/api/employee-defaults?${params.toString()}`;
            console.log('Requesting URL:', url);
            
            const response = await axios.get(url);
            
            console.log('API Response:', response);
            
            // More robust data validation
            if (response.data && Array.isArray(response.data.data)) {
                // Valid paginated response
                setEmployees(response.data.data);
                setCurrentPage(response.data.current_page || 1);
                setLastPage(response.data.last_page || 1);
                setTotal(response.data.total || 0);
            } else if (response.data && Array.isArray(response.data)) {
                // Handle case where the response is a direct array
                setEmployees(response.data);
                setCurrentPage(1);
                setLastPage(1);
                setTotal(response.data.length);
            } else {
                console.error('Invalid response format:', response.data);
                setAlertMessage('Error: Invalid data format received from server');
                setEmployees([]);
            }
        } catch (error) {
            console.error('Error loading employee defaults:', error);
            
            // More detailed error logging and user-friendly messages
            let errorMessage = 'Error loading employee defaults. ';
            
            if (error.response) {
                console.error('Error status:', error.response.status);
                console.error('Error data:', error.response.data);
                
                if (error.response.status === 401) {
                    errorMessage += 'Authentication required. Please log in again.';
                } else if (error.response.status === 403) {
                    errorMessage += 'You do not have permission to access this resource.';
                } else if (error.response.status === 404) {
                    errorMessage += 'API endpoint not found. Please contact support.';
                } else if (error.response.status >= 500) {
                    errorMessage += 'Server error. Please try again later.';
                } else {
                    errorMessage += error.response.data.message || 'Unknown error occurred.';
                }
            } else if (error.request) {
                console.error('Error request:', error.request);
                errorMessage += 'No response from server. Please check your connection.';
            } else {
                console.error('Error message:', error.message);
                errorMessage += error.message || 'Unknown error occurred.';
            }
            
            setAlertMessage(errorMessage);
            setEmployees([]);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, currentPage]);

    // Load data on component mount and when dependencies change
    useEffect(() => {
        loadEmployeeDefaults();
    }, [loadEmployeeDefaults]);

    // Debounced search to prevent too many requests
    const debouncedSearch = useCallback(
        debounce((value) => {
            setSearchTerm(value);
            setCurrentPage(1); // Reset to first page on new search
        }, 300),
        []
    );

    const handleSearch = (e) => {
        debouncedSearch(e.target.value);
    };

    const handleEditCell = (employeeId, benefitId, field, rowIndex, colIndex) => {
        if (!benefitId) return; // No benefit to edit
        
        setEditingCell({
            employeeId,
            benefitId,
            field,
            rowIndex,
            colIndex
        });
    };

    // New function to handle creating a benefit and then editing it
    const handleCreateAndEditCell = (employeeId, field, rowIndex, colIndex) => {
        // Set status to indicate we're creating
        setCreatingBenefit({
            employeeId,
            field,
            rowIndex,
            colIndex
        });
        
        // Create the benefit
        createDefaultBenefit(employeeId);
    };

    // Watch for benefit creation and start editing when it's done
    useEffect(() => {
        if (creatingBenefit) {
            const { employeeId, field, rowIndex, colIndex } = creatingBenefit;
            
            // Find the employee to see if the benefit is now available
            const employee = employees.find(emp => emp.id === employeeId);
            const benefit = getEmployeeDefaultBenefit(employee);
            
            if (benefit) {
                // We have a benefit now, so we can edit
                setEditingCell({
                    employeeId,
                    benefitId: benefit.id,
                    field,
                    rowIndex,
                    colIndex
                });
                
                // Reset creation state
                setCreatingBenefit(null);
            }
        }
    }, [employees, creatingBenefit]);

    // Handle keyboard navigation
    const handleKeyNavigation = (e, rowIndex, colIndex, field) => {
        const currentEmployee = employees[rowIndex];
        const currentBenefit = getEmployeeDefaultBenefit(currentEmployee);
        
        if (!currentBenefit) return;
        
        let newRow = rowIndex;
        let newCol = colIndex;
        
        // Navigate based on arrow keys
        switch (e.key) {
            case 'ArrowUp':
                newRow = Math.max(0, rowIndex - 1);
                e.preventDefault();
                break;
            case 'ArrowDown':
                newRow = Math.min(employees.length - 1, rowIndex + 1);
                e.preventDefault();
                break;
            case 'ArrowLeft':
                newCol = Math.max(0, colIndex - 1);
                e.preventDefault();
                break;
            case 'ArrowRight':
                newCol = Math.min(benefitFields.length - 1, colIndex + 1);
                e.preventDefault();
                break;
            case 'Tab':
                if (e.shiftKey) {
                    // Shift+Tab (move left/up)
                    newCol--;
                    if (newCol < 0) {
                        newRow = Math.max(0, newRow - 1);
                        newCol = benefitFields.length - 1;
                    }
                } else {
                    // Tab (move right/down)
                    newCol++;
                    if (newCol >= benefitFields.length) {
                        newRow = Math.min(employees.length - 1, newRow + 1);
                        newCol = 0;
                    }
                }
                e.preventDefault();
                break;
            default:
                return; // Don't navigate for other keys
        }
        
        // Get the target employee and benefit
        if (newRow !== rowIndex || newCol !== colIndex) {
            const newEmployee = employees[newRow];
            const newBenefit = getEmployeeDefaultBenefit(newEmployee);
            const newField = benefitFields[newCol].id;
            
            // Save current cell if edited
            if (editingCell) {
                const inputElement = document.querySelector(`input[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                if (inputElement) {
                    handleCellSave(currentBenefit.id, field, inputElement.value);
                }
            }
            
            if (newBenefit) {
                // Move to the new cell with existing benefit
                setEditingCell({
                    employeeId: newEmployee.id,
                    benefitId: newBenefit.id,
                    field: newField,
                    rowIndex: newRow,
                    colIndex: newCol
                });
            } else {
                // Need to create a benefit first
                handleCreateAndEditCell(newEmployee.id, newField, newRow, newCol);
            }
        }
    };

    // Improved cell saving functionality
    const handleCellSave = async (benefitId, field, value, additionalData) => {
        // Check if this is a bulk paste operation
        if (additionalData && additionalData.pastedData) {
            handleBulkPaste(additionalData.pastedData, additionalData.rowIndex, additionalData.colIndex);
            return;
        }
        
        try {
            const response = await axios.patch(`/benefits/${benefitId}/field`, { 
                field: field,
                value: value
            });
            
            // Update the employees state to reflect the change
            setEmployees(currentEmployees => 
                currentEmployees.map(employee => {
                    if (employee.benefits && employee.benefits.length > 0 && employee.benefits[0].id === benefitId) {
                        const updatedBenefits = [...employee.benefits];
                        updatedBenefits[0] = response.data;
                        return { ...employee, benefits: updatedBenefits };
                    }
                    return employee;
                })
            );
            
            setAlertMessage('Default benefit updated successfully');
            setTimeout(() => setAlertMessage(null), 3000);
        } catch (error) {
            console.error('Error updating benefit:', error);
            
            // More descriptive error message
            let errorMessage = 'Error updating benefit: ';
            if (error.response && error.response.data && error.response.data.message) {
                errorMessage += error.response.data.message;
            } else if (error.message) {
                errorMessage += error.message;
            } else {
                errorMessage += 'Unknown error occurred';
            }
            
            setAlertMessage(errorMessage);
            setTimeout(() => setAlertMessage(null), 5000);
        } finally {
            setEditingCell(null);
        }
    };

    // Handle bulk paste from Excel
    const handleBulkPaste = (data, startRow, startCol) => {
        // Map column index to field name
        const columnToFieldMap = benefitFields.reduce((map, column, index) => {
            map[index] = column.id;
            return map;
        }, {});
        
        // Process each cell in the pasted data
        data.forEach((row, rowOffset) => {
            row.forEach((cellValue, colOffset) => {
                const targetRow = startRow + rowOffset;
                const targetCol = startCol + colOffset;
                
                // Skip if out of bounds
                if (targetRow >= employees.length || targetCol >= benefitFields.length) {
                    return;
                }
                
                const employee = employees[targetRow];
                const benefit = getEmployeeDefaultBenefit(employee);
                
                // If no benefit yet, we need to create one first
                if (!benefit) {
                    return;
                }
                
                const field = columnToFieldMap[targetCol];
                if (field) {
                    // Parse the cell value to a number
                    const numValue = parseFloat(cellValue);
                    if (!isNaN(numValue)) {
                        handleCellSave(benefit.id, field, numValue);
                    }
                }
            });
        });
        
        setEditingCell(null);
    };

    // Improved create default benefit functionality
    const createDefaultBenefit = async (employeeId) => {
        try {
            setLoading(true);
            const today = new Date().toISOString().split('T')[0];
            
            // Show temporary message
            setAlertMessage('Creating default benefit...');
            
            const response = await axios.post('/benefits', {
                employee_id: employeeId,
                cutoff: '1st', // Doesn't matter for defaults
                date: today,
                is_default: true
            });
            
            // Update the employees state to add the new benefit
            setEmployees(currentEmployees => 
                currentEmployees.map(employee => {
                    if (employee.id === employeeId) {
                        return { 
                            ...employee, 
                            benefits: [response.data, ...(employee.benefits || [])] 
                        };
                    }
                    return employee;
                })
            );
            
            setAlertMessage('New default benefit created');
            setTimeout(() => setAlertMessage(null), 3000);
        } catch (error) {
            console.error('Error creating default benefit:', error);
            
            // More descriptive error message
            let errorMessage = 'Error creating default benefit: ';
            if (error.response && error.response.data && error.response.data.message) {
                errorMessage += error.response.data.message;
            } else if (error.message) {
                errorMessage += error.message;
            } else {
                errorMessage += 'Unknown error occurred';
            }
            
            setAlertMessage(errorMessage);
            setTimeout(() => setAlertMessage(null), 5000);
        } finally {
            setLoading(false);
        }
    };

    // Format employee name
    const formatEmployeeName = (employee) => {
        return `${employee.Lname}, ${employee.Fname} ${employee.MName || ''}`.trim();
    };

    // Get default benefit for an employee or null if none exists
    const getEmployeeDefaultBenefit = (employee) => {
        return employee.benefits && employee.benefits.length > 0 ? employee.benefits[0] : null;
    };

    // Check if a benefit is marked as default
    const isBenefitDefault = (benefit) => {
        return benefit && benefit.is_default;
    };

    // Handle pagination
    const handlePageChange = (page) => {
        setCurrentPage(page);
    };

    // Handle item selection
    const toggleItemSelection = (benefitId, event) => {
        // Make sure we stop event propagation
        if (event) {
            event.stopPropagation();
        }
        
        if (selectedItems.includes(benefitId)) {
            setSelectedItems(selectedItems.filter(id => id !== benefitId));
        } else {
            setSelectedItems([...selectedItems, benefitId]);
        }
    };

    // Handle select all
    const toggleSelectAll = (event) => {
        // Make sure we stop event propagation
        if (event) {
            event.stopPropagation();
        }
        
        if (selectAll) {
            // Deselect all
            setSelectedItems([]);
        } else {
            // Select all benefits
            const newSelection = employees
                .map(employee => getEmployeeDefaultBenefit(employee))
                .filter(benefit => benefit)
                .map(benefit => benefit.id);
            
            setSelectedItems(newSelection);
        }
        setSelectAll(!selectAll);
    };

    // Export selected benefits to Excel
    const handleExportSelected = () => {
        if (selectedItems.length === 0) return;
        
        // Filter employees with selected benefits
        const selectedEmployees = employees.filter(employee => {
            const benefit = getEmployeeDefaultBenefit(employee);
            return benefit && selectedItems.includes(benefit.id);
        });
        
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        
        // Create data for export
        const exportData = selectedEmployees.map(employee => {
            const benefit = getEmployeeDefaultBenefit(employee);
            
            // Create a record for each employee with their benefit data
            const record = {
                'Employee ID': employee.idno || '',
                'Employee Name': formatEmployeeName(employee),
                'Department': employee.Department || ''
            };
            
            // Add benefit fields
            benefitFields.forEach(column => {
                record[column.label.toUpperCase()] = benefit ? parseFloat(benefit[column.id] || 0).toFixed(2) : '0.00';
            });
            
            return record;
        });
        
        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Set column widths
        const columnWidths = [
            { wch: 15 }, // Employee ID
            { wch: 30 }, // Employee Name
            { wch: 20 }, // Department
        ];
        
        // Add column widths for benefit fields
        benefitFields.forEach(() => {
            columnWidths.push({ wch: 15 });
        });
        
        ws['!cols'] = columnWidths;
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, "Default Benefits");
        
        // Create date string for filename
        const date = new Date();
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        // Generate Excel file and trigger download
        XLSX.writeFile(wb, `employee_default_benefits_${dateString}.xlsx`);
    };

    // Bulk update selected benefits
    const handleBulkUpdate = () => {
        if (selectedItems.length === 0) return;
        
        setConfirmation({
            isOpen: true,
            title: 'Update Selected Benefits',
            message: `Are you sure you want to update ${selectedItems.length} selected default benefits?`,
            onConfirm: () => {
                // Implement bulk update logic here
                console.log('Bulk updating benefits:', selectedItems);
                setSelectedItems([]);
                setSelectAll(false);
                setConfirmation({ ...confirmation, isOpen: false });
            }
        });
    };

    // Refresh data function
    const refreshData = () => {
        loadEmployeeDefaults();
    };

    // Download template for defaults
    const downloadTemplate = () => {
        window.location.href = '/benefits/defaults/template/download';
    };

    // Export current defaults
    const exportDefaults = () => {
        window.location.href = '/benefits/defaults/export';
    };

    // Handle import for defaults
    const handleImport = async () => {
        if (!importFile) {
            setAlertMessage('Please select a file to import');
            setTimeout(() => setAlertMessage(null), 3000);
            return;
        }

        const formData = new FormData();
        formData.append('file', importFile);

        try {
            setLoading(true);
            const response = await axios.post('/benefits/defaults/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            setShowImportModal(false);
            setImportFile(null);
            loadEmployeeDefaults(); // Refresh the data
            
            if (response.data.errors && response.data.errors.length > 0) {
                setAlertMessage(`Import completed with ${response.data.errors.length} errors. Check console for details.`);
                console.log('Import errors:', response.data.errors);
            } else {
                setAlertMessage(`Successfully imported: ${response.data.imported_count} created, ${response.data.updated_count || 0} updated`);
            }
            setTimeout(() => setAlertMessage(null), 5000);
        } catch (error) {
            console.error('Error importing defaults:', error);
            setAlertMessage(error.response?.data?.message || 'Error importing defaults');
            setTimeout(() => setAlertMessage(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    // Render empty row message
    if (employees.length === 0 && !loading) {
        return (
            <AuthenticatedLayout user={user}>
                <Head title="Employee Default Benefits" />
                <div className="flex min-h-screen bg-gray-50/50">
                    <Sidebar />
                    <div className="flex-1 p-8">
                        <div className="max-w-7xl mx-auto">
                            <div className="p-8 text-center text-gray-500">
                                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                <h3 className="text-lg font-medium mb-2">No Employee Defaults Found</h3>
                                <p>There are no employee default benefits to display for the selected filters.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout user={user}>
            <Head title="Employee Default Benefits" />
            <div className="flex min-h-screen bg-gray-50/50">
                <Sidebar />
                <div className="flex-1 p-8">
                    <div className="max-w-7xl mx-auto">
                        {alertMessage && (
                            <Alert className="mb-4">
                                <AlertDescription>{alertMessage}</AlertDescription>
                            </Alert>
                        )}

                        {/* Header Section */}
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                    Employee Default Benefits
                                </h1>
                                <p className="text-gray-600">
                                    Manage default benefit values that will be used for new benefit entries.
                                </p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Button
                                    onClick={() => setShowImportModal(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center"
                                    disabled={loading}
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Import
                                </Button>
                                <Button
                                    onClick={exportDefaults}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center"
                                    disabled={loading}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Export
                                </Button>
                                <Button
                                    onClick={refreshData}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 flex items-center"
                                    disabled={loading}
                                >
                                    {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Edit className="w-4 h-4 mr-2" />}
                                    Refresh
                                </Button>
                                <Button
                                    onClick={() => router.visit('/benefits')}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                            </div>
                        </div>

                        {/* Search Field */}
                        <div className="flex gap-4 mb-6">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <input
                                    type="text"
                                    placeholder="Search employees..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    onChange={handleSearch}
                                />
                            </div>
                        </div>

                        {/* Bulk Action Bar */}
                        <BulkActionBar 
                            selectedItems={selectedItems}
                            onClearSelection={() => {
                                setSelectedItems([]);
                                setSelectAll(false);
                            }}
                            onBulkSetDefault={handleBulkUpdate}
                            onExportSelected={handleExportSelected}
                            disabled={loading}
                        />

                        {/* Table */}
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="w-12 px-3 py-3 text-center">
                                                <div 
                                                    className="flex items-center justify-center cursor-pointer" 
                                                    onClick={(e) => toggleSelectAll(e)}
                                                >
                                                    <Checkbox
                                                        checked={selectAll}
                                                        onCheckedChange={(checked) => {
                                                            // This will be triggered by the click handler above
                                                            // We just need to keep this for visual feedback
                                                        }}
                                                        disabled={loading}
                                                        className="h-4 w-4"
                                                    />
                                                </div>
                                            </th>
                                            <th className="w-24 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                            <th className="w-64 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Employee
                                            </th>
                                            {benefitFields.map((column) => (
                                                <th 
                                                    key={column.id} 
                                                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                    style={{ width: column.width }}
                                                >
                                                    {column.label}
                                                </th>
                                            ))}
                                            <th className="w-24 px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={benefitFields.length + 4} className="px-3 py-4 text-center text-gray-500">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                                        <span>Loading...</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            employees.map((employee, rowIndex) => {
                                                const benefit = getEmployeeDefaultBenefit(employee);
                                                const isDefault = isBenefitDefault(benefit);
                                                const isSelected = benefit ? selectedItems.includes(benefit.id) : false;

                                                return (
                                                    <tr 
                                                        key={employee.id}
                                                        className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                                                    >
                                                        <td className="w-12 px-3 py-3 text-center">
                                                            {benefit ? (
                                                                <div 
                                                                    className="flex items-center justify-center cursor-pointer" 
                                                                    onClick={(e) => toggleItemSelection(benefit.id, e)}
                                                                >
                                                                    <Checkbox
                                                                        checked={isSelected}
                                                                        onCheckedChange={(checked) => {
                                                                            // This is just for visual feedback
                                                                            // Actual state changes are handled in the onClick handler
                                                                        }}
                                                                        className="h-4 w-4"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="h-4 w-4" />
                                                            )}
                                                        </td>
                                                        
                                                        <td className="w-24 px-3 py-3">
                                                            <div className="flex space-x-1">
                                                                {benefit ? (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className={`p-1 h-8 w-8 ${isDefault ? 'bg-yellow-50' : ''}`}
                                                                        title={isDefault ? "Default Values Set" : "Default Values"}
                                                                    >
                                                                        <Star className={`h-3 w-3 ${isDefault ? 'text-yellow-500' : 'text-gray-400'}`} />
                                                                    </Button>
                                                                ) : (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="p-1 h-8 w-8"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            createDefaultBenefit(employee.id);
                                                                        }}
                                                                        title="Create Default Values"
                                                                        disabled={loading}
                                                                    >
                                                                        <Plus className="h-3 w-3 text-blue-600" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        
                                                        <td className="w-64 px-3 py-3">
                                                            <div className="flex flex-col">
                                                                <div className="text-sm font-medium text-gray-900 truncate">
                                                                    {formatEmployeeName(employee)}
                                                                </div>
                                                                <div className="text-sm text-gray-500 truncate">
                                                                    {employee.Department || 'N/A'}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        
                                                        {/* Benefit cells */}
                                                        {benefitFields.map((column, colIndex) => (
                                                            <td 
                                                                key={column.id} 
                                                                className="relative border-l border-gray-100"
                                                                style={{ width: column.width }}
                                                            >
                                                                <EditableCell 
                                                                    value={benefit ? benefit[column.id] || 0 : 0}
                                                                    isEditing={
                                                                        editingCell?.employeeId === employee.id && 
                                                                        editingCell?.benefitId === (benefit?.id || 'pending') && 
                                                                        editingCell?.field === column.id
                                                                    }
                                                                    isDisabled={false}
                                                                    onSave={(value, additionalData) => benefit && handleCellSave(benefit.id, column.id, value, additionalData)}
                                                                    onKeyDown={handleKeyNavigation}
                                                                    rowIndex={rowIndex}
                                                                    colIndex={colIndex}
                                                                    field={column.id}
                                                                    onClick={() => benefit && handleEditCell(employee.id, benefit.id, column.id, rowIndex, colIndex)}
                                                                    onCreateAndEdit={() => handleCreateAndEditCell(employee.id, column.id, rowIndex, colIndex)}
                                                                    benefitExists={!!benefit}
                                                                />
                                                            </td>
                                                        ))}
                                                        
                                                        <td className="w-24 px-3 py-3 text-center">
                                                            {benefit ? (
                                                                isDefault ? (
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                        <CheckCircle className="w-3 h-3 mr-1" />
                                                                        Default
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                        Active
                                                                    </span>
                                                                )
                                                            ) : (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                                    No Data
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Pagination */}
                            {total > 0 && (
                                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm text-gray-700">
                                                Showing <span className="font-medium">{(currentPage - 1) * 50 + 1}</span> to{' '}
                                                <span className="font-medium">
                                                    {Math.min(currentPage * 50, total)}
                                                </span>{' '}
                                                of <span className="font-medium">{total}</span> results
                                            </p>
                                        </div>
                                        <div>
                                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                                {/* Previous Page Button */}
                                                <button
                                                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                                    disabled={currentPage === 1 || loading}
                                                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                                                        currentPage === 1 || loading
                                                            ? 'text-gray-300 cursor-not-allowed'
                                                            : 'text-gray-500 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    Previous
                                                </button>
                                                
                                                {/* Page Numbers */}
                                                {Array.from({ length: Math.min(5, lastPage) }, (_, i) => {
                                                    // Show pages around current page
                                                    const pageOffset = Math.max(0, currentPage - 3);
                                                    const pageNum = i + 1 + pageOffset;
                                                    if (pageNum > lastPage) return null;
                                                    
                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => handlePageChange(pageNum)}
                                                            disabled={loading}
                                                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                                                currentPage === pageNum
                                                                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                })}
                                                
                                                {/* Next Page Button */}
                                                <button
                                                    onClick={() => handlePageChange(Math.min(lastPage, currentPage + 1))}
                                                    disabled={currentPage === lastPage || loading}
                                                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                                                        currentPage === lastPage || loading
                                                            ? 'text-gray-300 cursor-not-allowed'
                                                            : 'text-gray-500 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    Next
                                                </button>
                                            </nav>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Import Modal */}
                        {showImportModal && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                                <div className="bg-white rounded-lg max-w-md w-full p-6">
                                    <h3 className="text-lg font-semibold mb-4">Import Default Benefits</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Select Excel File
                                            </label>
                                            <input
                                                type="file"
                                                accept=".xlsx,.xls,.csv"
                                                onChange={(e) => setImportFile(e.target.files[0])}
                                                className="w-full border border-gray-300 rounded-md px-3 py-2"
                                            />
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            <p>Import will update default benefit values for employees based on Employee ID.</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Button
                                                onClick={downloadTemplate}
                                                variant="outline"
                                                size="sm"
                                                className="flex items-center"
                                            >
                                                <Download className="w-4 h-4 mr-1" />
                                                Download Template
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex justify-end space-x-3 mt-6">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setShowImportModal(false);
                                                setImportFile(null);
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleImport}
                                            disabled={!importFile || loading}
                                            className="bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                            {loading ? 'Importing...' : 'Import'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Confirmation Modal */}
                        <ConfirmationModal
                            isOpen={confirmation.isOpen}
                            title={confirmation.title}
                            message={confirmation.message}
                            onConfirm={confirmation.onConfirm}
                            onCancel={() => setConfirmation({ ...confirmation, isOpen: false })}
                        />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
};

export default EmployeeDefaultsPage;