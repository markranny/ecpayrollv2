import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Edit, 
    Save, 
    Lock, 
    Plus, 
    Star,
    AlertCircle,
    Check,
    CheckSquare,
    Download
} from 'lucide-react';
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
    deductionExists
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
                className={`px-3 py-2 text-right ${deductionExists ? 'text-gray-700' : 'text-gray-400'} cursor-pointer hover:bg-gray-100 min-h-[36px] flex items-center justify-end transition-colors`}
                onClick={(e) => {
                    e.stopPropagation();
                    if (deductionExists) {
                        if (onClick) onClick();
                    } else {
                        if (onCreateAndEdit) onCreateAndEdit();
                    }
                }}
            >
                {deductionExists ? parseFloat(value || 0).toFixed(2) : "0.00"}
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
    onBulkPost, 
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
                    Set as Default
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
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-green-50 hover:bg-green-100 border-green-300"
                    onClick={onBulkPost}
                    disabled={disabled}
                >
                    <Save className="h-4 w-4 text-green-600 mr-1" />
                    Post Selected
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

const DeductionsTable = ({ 
    employees, 
    loading, 
    onCellUpdate, 
    onCreateDeduction, 
    onPostDeduction, 
    onSetDefault,
    onBulkPostDeductions,
    onBulkSetDefaultDeductions,
    onExportToExcel,
    pagination,
    // Field columns for deductions
    fieldColumnsParam = [
        'advance',
        'charge_store',
        'charge',
        'meals',
        'miscellaneous',
        'other_deductions'
    ]
}) => {
    // Transform field columns with proper width settings
    const fieldColumns = Array.isArray(fieldColumnsParam) && typeof fieldColumnsParam[0] === 'string' 
        ? fieldColumnsParam.map(field => ({
            id: field,
            label: field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            width: '140px'
        }))
        : fieldColumnsParam;

    const [editingCell, setEditingCell] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [confirmation, setConfirmation] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });
    const [creatingDeduction, setCreatingDeduction] = useState(null);

    // Reset selection when employees change
    useEffect(() => {
        setSelectedItems([]);
        setSelectAll(false);
    }, [employees]);

    const handleEditCell = (employeeId, deductionId, field, rowIndex, colIndex) => {
        if (!deductionId) return; // No deduction to edit
        
        setEditingCell({
            employeeId,
            deductionId,
            field,
            rowIndex,
            colIndex
        });
    };

    // New function to handle creating a deduction and then editing it
    const handleCreateAndEditCell = (employeeId, field, rowIndex, colIndex) => {
        // Set status to indicate we're creating
        setCreatingDeduction({
            employeeId,
            field,
            rowIndex,
            colIndex
        });
        
        // Create the deduction
        onCreateDeduction(employeeId);
    };

    // Watch for deduction creation and start editing when it's done
    useEffect(() => {
        if (creatingDeduction) {
            const { employeeId, field, rowIndex, colIndex } = creatingDeduction;
            
            // Find the employee to see if the deduction is now available
            const employee = employees.find(emp => emp.id === employeeId);
            const deduction = employee?.deductions && employee.deductions.length > 0 ? employee.deductions[0] : null;
            
            if (deduction) {
                // We have a deduction now, so we can edit
                setEditingCell({
                    employeeId,
                    deductionId: deduction.id,
                    field,
                    rowIndex,
                    colIndex
                });
                
                // Reset creation state
                setCreatingDeduction(null);
            }
        }
    }, [employees, creatingDeduction]);

    const handleCellSave = (deductionId, field, value, additionalData) => {
        // Check if this is a bulk paste operation
        if (additionalData && additionalData.pastedData) {
            handleBulkPaste(additionalData.pastedData, additionalData.rowIndex, additionalData.colIndex);
            return;
        }
        
        onCellUpdate(deductionId, field, value);
        setEditingCell(null);
    };

    // Handle bulk paste from Excel
    const handleBulkPaste = (data, startRow, startCol) => {
        // Map column index to field name
        const columnToFieldMap = fieldColumns.reduce((map, column, index) => {
            map[index] = column.id;
            return map;
        }, {});
        
        // Process each cell in the pasted data
        data.forEach((row, rowOffset) => {
            row.forEach((cellValue, colOffset) => {
                const targetRow = startRow + rowOffset;
                const targetCol = startCol + colOffset;
                
                // Skip if out of bounds
                if (targetRow >= employees.length || targetCol >= fieldColumns.length) {
                    return;
                }
                
                const employee = employees[targetRow];
                const deduction = getEmployeeDeduction(employee);
                
                // If no deduction yet, we need to create one first
                if (!deduction) {
                    return;
                }
                
                // Skip if it's posted
                if (deduction.is_posted) {
                    return;
                }
                
                const field = columnToFieldMap[targetCol];
                if (field) {
                    // Parse the cell value to a number
                    const numValue = parseFloat(cellValue);
                    if (!isNaN(numValue)) {
                        onCellUpdate(deduction.id, field, numValue);
                    }
                }
            });
        });
        
        setEditingCell(null);
    };

    // Handle keyboard navigation
    const handleKeyNavigation = (e, rowIndex, colIndex, field) => {
        const currentEmployee = employees[rowIndex];
        const currentDeduction = getEmployeeDeduction(currentEmployee);
        
        if (!currentDeduction) return;
        
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
                newCol = Math.min(fieldColumns.length - 1, colIndex + 1);
                e.preventDefault();
                break;
            case 'Tab':
                if (e.shiftKey) {
                    // Shift+Tab (move left/up)
                    newCol--;
                    if (newCol < 0) {
                        newRow = Math.max(0, newRow - 1);
                        newCol = fieldColumns.length - 1;
                    }
                } else {
                    // Tab (move right/down)
                    newCol++;
                    if (newCol >= fieldColumns.length) {
                        newRow = Math.min(employees.length - 1, newRow + 1);
                        newCol = 0;
                    }
                }
                e.preventDefault();
                break;
            default:
                return; // Don't navigate for other keys
        }
        
        // Get the target employee and deduction
        if (newRow !== rowIndex || newCol !== colIndex) {
            const newEmployee = employees[newRow];
            const newDeduction = getEmployeeDeduction(newEmployee);
            const newField = fieldColumns[newCol].id;
            
            // Save current cell if edited
            if (editingCell) {
                const inputElement = document.querySelector(`input[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                if (inputElement) {
                    onCellUpdate(currentDeduction.id, field, inputElement.value);
                }
            }
            
            if (newDeduction && !newDeduction.is_posted) {
                // Move to the new cell with existing deduction
                setEditingCell({
                    employeeId: newEmployee.id,
                    deductionId: newDeduction.id,
                    field: newField,
                    rowIndex: newRow,
                    colIndex: newCol
                });
            } else if (!newDeduction) {
                // Need to create a deduction first
                handleCreateAndEditCell(newEmployee.id, newField, newRow, newCol);
            }
        }
    };

    // Get deduction record for an employee or null if none exists
    const getEmployeeDeduction = (employee) => {
        return employee.deductions && employee.deductions.length > 0 ? employee.deductions[0] : null;
    };
    
    // Check if a deduction is posted (locked)
    const isDeductionPosted = (deduction) => {
        return deduction && deduction.is_posted;
    };
    
    // Check if a deduction is marked as default
    const isDeductionDefault = (deduction) => {
        return deduction && deduction.is_default;
    };

    // Format employee name
    const formatEmployeeName = (employee) => {
        return `${employee.Lname}, ${employee.Fname} ${employee.MName || ''}`.trim();
    };

    // Handle item selection
    const toggleItemSelection = (deductionId, event) => {
        // Make sure we stop event propagation
        if (event) {
            event.stopPropagation();
        }
        
        if (selectedItems.includes(deductionId)) {
            setSelectedItems(selectedItems.filter(id => id !== deductionId));
        } else {
            setSelectedItems([...selectedItems, deductionId]);
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
            // Select all unposted deductions
            const newSelection = employees
                .map(employee => getEmployeeDeduction(employee))
                .filter(deduction => deduction && !deduction.is_posted)
                .map(deduction => deduction.id);
            
            setSelectedItems(newSelection);
        }
        setSelectAll(!selectAll);
    };

    // Export selected deductions to Excel
    const handleExportSelected = () => {
        if (selectedItems.length === 0) return;
        
        // Filter employees with selected deductions
        const selectedEmployees = employees.filter(employee => {
            const deduction = getEmployeeDeduction(employee);
            return deduction && selectedItems.includes(deduction.id);
        });
        
        if (onExportToExcel) {
            onExportToExcel(selectedEmployees);
        } else {
            // Default export implementation if not provided by parent
            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            
            // Create data for export
            const exportData = selectedEmployees.map(employee => {
                const deduction = getEmployeeDeduction(employee);
                
                // Create a record for each employee with their deduction data
                const record = {
                    'Employee ID': employee.idno || '',
                    'Employee Name': formatEmployeeName(employee),
                    'Department': employee.Department || ''
                };
                
                // Add deduction fields
                fieldColumns.forEach(column => {
                    record[column.label.toUpperCase()] = deduction ? parseFloat(deduction[column.id] || 0).toFixed(2) : '0.00';
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
            
            // Add column widths for deduction fields
            fieldColumns.forEach(() => {
                columnWidths.push({ wch: 15 });
            });
            
            ws['!cols'] = columnWidths;
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, "Deductions");
            
            // Create date string for filename
            const date = new Date();
            const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            
            // Generate Excel file and trigger download
            XLSX.writeFile(wb, `employee_deductions_${dateString}.xlsx`);
        }
    };

    // Bulk post deductions
    const handleBulkPost = () => {
        if (selectedItems.length === 0) return;
        
        setConfirmation({
            isOpen: true,
            title: 'Post Selected Deductions',
            message: `Are you sure you want to post ${selectedItems.length} selected deductions? This action cannot be undone.`,
            onConfirm: () => {
                onBulkPostDeductions(selectedItems);
                setSelectedItems([]);
                setSelectAll(false);
                setConfirmation({ ...confirmation, isOpen: false });
            }
        });
    };

    // Bulk set as default
    const handleBulkSetDefault = () => {
        if (selectedItems.length === 0) return;
        
        setConfirmation({
            isOpen: true,
            title: 'Set as Default Deductions',
            message: `Are you sure you want to set ${selectedItems.length} selected deductions as default? This will override existing default values.`,
            onConfirm: () => {
                onBulkSetDefaultDeductions(selectedItems);
                setSelectedItems([]);
                setSelectAll(false);
                setConfirmation({ ...confirmation, isOpen: false });
            }
        });
    };

    // Render empty row message
    if (employees.length === 0 && !loading) {
        return (
            <div className="p-8 text-center text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No Deductions Found</h3>
                <p>There are no deductions to display for the selected filters.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden">
            {/* Bulk Action Bar */}
            <BulkActionBar 
                selectedItems={selectedItems}
                onClearSelection={() => {
                    setSelectedItems([]);
                    setSelectAll(false);
                }}
                onBulkPost={handleBulkPost}
                onBulkSetDefault={handleBulkSetDefault}
                onExportSelected={handleExportSelected}
                disabled={loading}
            />
            
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
                            {fieldColumns.map((column) => (
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
                                <td colSpan={fieldColumns.length + 4} className="px-3 py-4 text-center text-gray-500">
                                    <div className="flex items-center justify-center space-x-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                        <span>Loading...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            employees.map((employee, rowIndex) => {
                                const deduction = getEmployeeDeduction(employee);
                                const isPosted = isDeductionPosted(deduction);
                                const isDefault = isDeductionDefault(deduction);
                                const isSelected = deduction ? selectedItems.includes(deduction.id) : false;

                                return (
                                    <tr 
                                        key={employee.id}
                                        className={`hover:bg-gray-50 ${
                                            isPosted ? 'bg-gray-50' : ''
                                        } ${isSelected ? 'bg-blue-50' : ''}`}
                                    >
                                        <td className="w-12 px-3 py-3 text-center">
                                            {deduction && !isPosted ? (
                                                <div 
                                                    className="flex items-center justify-center cursor-pointer" 
                                                    onClick={(e) => toggleItemSelection(deduction.id, e)}
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
                                                {deduction ? (
                                                    <>
                                                        {!isPosted && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="p-1 h-8 w-8"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setConfirmation({
                                                                        isOpen: true,
                                                                        title: 'Post Deduction',
                                                                        message: 'Are you sure you want to post this deduction? This action cannot be undone.',
                                                                        onConfirm: () => {
                                                                            onPostDeduction(deduction.id);
                                                                            setConfirmation({ ...confirmation, isOpen: false });
                                                                        }
                                                                    });
                                                                }}
                                                                title="Post Deduction"
                                                            >
                                                                <Save className="h-3 w-3 text-green-600" />
                                                            </Button>
                                                        )}
                                                        
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className={`p-1 h-8 w-8 ${isDefault ? 'bg-yellow-50' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConfirmation({
                                                                    isOpen: true,
                                                                    title: 'Set as Default',
                                                                    message: 'Are you sure you want to set this deduction as the default? This will override the existing default value.',
                                                                    onConfirm: () => {
                                                                        onSetDefault(deduction.id);
                                                                        setConfirmation({ ...confirmation, isOpen: false });
                                                                    }
                                                                });
                                                            }}
                                                            title={isDefault ? "Default Values" : "Set as Default"}
                                                        >
                                                            <Star className={`h-3 w-3 ${isDefault ? 'text-yellow-500' : 'text-gray-400'}`} />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="p-1 h-8 w-8"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onCreateDeduction(employee.id);
                                                        }}
                                                        title="Create Deduction"
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
                                        
                                        {/* Deduction cells */}
                                        {fieldColumns.map((column, colIndex) => (
                                            <td 
                                                key={column.id} 
                                                className="relative border-l border-gray-100"
                                                style={{ width: column.width }}
                                            >
                                                <EditableCell 
                                                    value={deduction ? deduction[column.id] || 0 : 0}
                                                    isEditing={
                                                        editingCell?.employeeId === employee.id && 
                                                        editingCell?.deductionId === (deduction?.id || 'pending') && 
                                                        editingCell?.field === column.id
                                                    }
                                                    isDisabled={isPosted}
                                                    onSave={(value, additionalData) => deduction && handleCellSave(deduction.id, column.id, value, additionalData)}
                                                    onKeyDown={handleKeyNavigation}
                                                    rowIndex={rowIndex}
                                                    colIndex={colIndex}
                                                    field={column.id}
                                                    onClick={() => !isPosted && deduction && handleEditCell(employee.id, deduction.id, column.id, rowIndex, colIndex)}
                                                    onCreateAndEdit={() => !isPosted && handleCreateAndEditCell(employee.id, column.id, rowIndex, colIndex)}
                                                    deductionExists={!!deduction}
                                                />
                                            </td>
                                        ))}
                                        
                                        <td className="w-24 px-3 py-3 text-center">
                                            {deduction ? (
                                                isPosted ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        <Lock className="w-3 h-3 mr-1" />
                                                        Posted
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                        Pending
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
            {pagination && pagination.total > pagination.perPage && (
                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                Showing <span className="font-medium">{(pagination.currentPage - 1) * pagination.perPage + 1}</span> to{' '}
                                <span className="font-medium">
                                    {Math.min(pagination.currentPage * pagination.perPage, pagination.total)}
                                </span>{' '}
                                of <span className="font-medium">{pagination.total}</span> results
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                {pagination.links && pagination.links.map((link, i) => {
                                    if (link.url === null) return null;
                                    
                                    return (
                                        <button
                                            key={i}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!link.url) return;
                                                const pageNum = link.url.split('page=')[1];
                                                pagination.onPageChange(pageNum);
                                            }}
                                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                                link.active
                                                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                            }`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    );
                                })}
                            </nav>
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
    );
};

export default DeductionsTable;