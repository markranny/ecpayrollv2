import React, { useState, useEffect, useCallback } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import DeductionsTable from './DeductionsTable';
import DeductionsFilters from './DeductionsFilters';
import DeductionsStatusCards from './DeductionsStatusCards';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
    Search, 
    Calendar,
    FileText,
    Download,
    Upload,
    Plus,
    Save,
    Settings,
    AlertCircle
} from 'lucide-react';
import ConfirmModal from '@/Components/ConfirmModal';
import axios from 'axios';
import { debounce } from 'lodash';
import * as XLSX from 'xlsx';

const DeductionsPage = ({ employees: initialEmployees, cutoff: initialCutoff, month: initialMonth, year: initialYear, search: initialSearch, status, dateRange, flash }) => {
    // Make sure we safely access auth and user
    const { auth } = usePage().props || {};
    const user = auth?.user || {};
    
    const [employees, setEmployees] = useState(initialEmployees?.data || []);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        cutoff: initialCutoff || '1st',
        month: initialMonth || new Date().getMonth() + 1,
        year: initialYear || new Date().getFullYear(),
        search: initialSearch || '',
    });
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: '',
        confirmVariant: 'destructive',
        onConfirm: () => {}
    });
    const [alertMessage, setAlertMessage] = useState(flash?.message || null);
    const [pagination, setPagination] = useState({
        currentPage: initialEmployees?.current_page || 1,
        perPage: initialEmployees?.per_page || 50,
        total: initialEmployees?.total || 0,
    });

    // Update pagination when initialEmployees changes
    useEffect(() => {
        if (initialEmployees) {
            setPagination({
                currentPage: initialEmployees.current_page || 1,
                perPage: initialEmployees.per_page || 50,
                total: initialEmployees.total || 0,
            });
            setEmployees(initialEmployees.data || []);
        }
    }, [initialEmployees]);

    // Handle filter changes
    const handleFilterChange = (name, value) => {
        setFilters(prev => {
            const newFilters = {
                ...prev,
                [name]: value
            };
            
            // Reset page to 1 when filters change
            if (name !== 'page') {
                return {
                    ...newFilters,
                    page: 1
                };
            }
            
            return newFilters;
        });
    };

    // Debounced search to prevent too many requests
    const debouncedSearch = useCallback(
        debounce((value) => {
            handleFilterChange('search', value);
        }, 300), // Reduced debounce time for better responsiveness
        []
    );

    // Apply filters and reload data
    const applyFilters = () => {
        setLoading(true);
        router.visit(
            `/deductions?cutoff=${filters.cutoff}&month=${filters.month}&year=${filters.year}&search=${filters.search}`,
            {
                preserveState: true,
                preserveScroll: true,
                only: ['employees', 'status', 'dateRange'],
                onFinish: () => setLoading(false)
            }
        );
    };

    // Watch for filter changes and apply them
    useEffect(() => {
        applyFilters();
    }, [filters.cutoff, filters.month, filters.year, filters.search]);

    // Handle table cell update
    const handleCellUpdate = async (deductionId, field, value) => {
        try {
            const response = await axios.patch(`/deductions/${deductionId}/field`, { 
                field: field,
                value: value
            });
            
            // Update the employees state to reflect the change
            setEmployees(currentEmployees => 
                currentEmployees.map(employee => {
                    if (employee.deductions && employee.deductions.length > 0 && employee.deductions[0].id === deductionId) {
                        const updatedDeductions = [...employee.deductions];
                        updatedDeductions[0] = response.data;
                        return { ...employee, deductions: updatedDeductions };
                    }
                    return employee;
                })
            );
            
        } catch (error) {
            console.error('Error updating deduction:', error);
            setAlertMessage(error.response?.data?.message || 'Error updating deduction');
            setTimeout(() => setAlertMessage(null), 3000);
        }
    };

    // Modified createDeduction method to better handle async creation
    const createDeduction = async (employeeId) => {
        try {
            setLoading(true);
            const response = await axios.post('/deductions/create-from-default', {
                employee_id: employeeId,
                cutoff: filters.cutoff,
                date: new Date(`${filters.year}-${filters.month}-${filters.cutoff === '1st' ? 15 : 28}`).toISOString().split('T')[0]
            });
            
            // Update the employees state to add the new deduction
            setEmployees(currentEmployees => 
                currentEmployees.map(employee => {
                    if (employee.id === employeeId) {
                        return { 
                            ...employee, 
                            deductions: [response.data, ...(employee.deductions || [])] 
                        };
                    }
                    return employee;
                })
            );
            
            return response.data;
        } catch (error) {
            console.error('Error creating deduction:', error);
            setAlertMessage(error.response?.data?.message || 'Error creating deduction');
            setTimeout(() => setAlertMessage(null), 3000);
            return null;
        } finally {
            setLoading(false);
        }
    };

    // Post a single deduction
    const postDeduction = async (deductionId) => {
        try {
            const response = await axios.post(`/deductions/${deductionId}/post`);
            
            // Update the employees state to reflect the posted deduction
            setEmployees(currentEmployees => 
                currentEmployees.map(employee => {
                    if (employee.deductions && employee.deductions.length > 0 && employee.deductions[0].id === deductionId) {
                        const updatedDeductions = [...employee.deductions];
                        updatedDeductions[0] = response.data;
                        return { ...employee, deductions: updatedDeductions };
                    }
                    return employee;
                })
            );
            
            // Also update the status counts
            applyFilters();
            
            setAlertMessage('Deduction posted successfully');
            setTimeout(() => setAlertMessage(null), 3000);
        } catch (error) {
            console.error('Error posting deduction:', error);
            setAlertMessage(error.response?.data?.message || 'Error posting deduction');
            setTimeout(() => setAlertMessage(null), 3000);
        }
    };

    // Bulk post deductions
    const bulkPostDeductions = async (deductionIds) => {
        if (!deductionIds || deductionIds.length === 0) return;
        
        try {
            setLoading(true);
            
            const response = await axios.post('/deductions/bulk-post', {
                deduction_ids: deductionIds
            });
            
            // Refresh data instead of manual state update
            applyFilters();
            
            setAlertMessage(`Successfully posted ${deductionIds.length} deductions`);
            setTimeout(() => setAlertMessage(null), 3000);
        } catch (error) {
            console.error('Error posting deductions in bulk:', error);
            setAlertMessage(error.response?.data?.message || 'Error posting deductions');
            setTimeout(() => setAlertMessage(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    // Bulk set default deductions
    const bulkSetDefaultDeductions = async (deductionIds) => {
        if (!deductionIds || deductionIds.length === 0) return;
        
        try {
            setLoading(true);
            
            const response = await axios.post('/deductions/bulk-set-default', {
                deduction_ids: deductionIds
            });
            
            // Refresh data
            applyFilters();
            
            setAlertMessage(`Successfully set ${deductionIds.length} deductions as default`);
            setTimeout(() => setAlertMessage(null), 3000);
        } catch (error) {
            console.error('Error setting default deductions in bulk:', error);
            setAlertMessage(error.response?.data?.message || 'Error setting default deductions');
            setTimeout(() => setAlertMessage(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    // Post all deductions
    const postAllDeductions = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Post All Deductions',
            message: `Are you sure you want to post all deductions for the ${filters.cutoff} cutoff of ${filters.month}/${filters.year}? This action cannot be undone.`,
            confirmText: 'Post All',
            confirmVariant: 'destructive',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    
                    const response = await axios.post('/deductions/post-all', {
                        cutoff: filters.cutoff,
                        start_date: dateRange.start,
                        end_date: dateRange.end
                    });
                    
                    // Reload data after posting
                    applyFilters();
                    
                    setConfirmModal({ ...confirmModal, isOpen: false });
                    setAlertMessage(`${response.data.updated_count} deductions posted successfully`);
                    setTimeout(() => setAlertMessage(null), 3000);
                } catch (error) {
                    console.error('Error posting all deductions:', error);
                    setConfirmModal({ ...confirmModal, isOpen: false });
                    setAlertMessage(error.response?.data?.message || 'Error posting deductions');
                    setTimeout(() => setAlertMessage(null), 3000);
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    // Create deductions for all active employees
    const createBulkDeductions = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Create Deductions for All Employees',
            message: `This will create deduction entries for all active employees for the ${filters.cutoff} cutoff of ${filters.month}/${filters.year} using their default values.`,
            confirmText: 'Create Deductions',
            confirmVariant: 'default',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    
                    const response = await axios.post('/deductions/bulk-create', {
                        cutoff: filters.cutoff,
                        date: new Date(`${filters.year}-${filters.month}-${filters.cutoff === '1st' ? 15 : 28}`).toISOString().split('T')[0]
                    });
                    
                    // Reload data after creating
                    applyFilters();
                    
                    setConfirmModal({ ...confirmModal, isOpen: false });
                    setAlertMessage(`${response.data.created_count} deduction entries created successfully`);
                    setTimeout(() => setAlertMessage(null), 3000);
                } catch (error) {
                    console.error('Error creating bulk deductions:', error);
                    setConfirmModal({ ...confirmModal, isOpen: false });
                    setAlertMessage(error.response?.data?.message || 'Error creating deductions');
                    setTimeout(() => setAlertMessage(null), 3000);
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    // Set a deduction as default
    const setDefaultDeduction = async (deductionId) => {
        try {
            const response = await axios.post(`/deductions/${deductionId}/set-default`);
            
            // Update employees state to reflect the change
            setEmployees(currentEmployees => 
                currentEmployees.map(employee => {
                    if (employee.deductions && employee.deductions.length > 0 && employee.deductions[0].id === deductionId) {
                        const updatedDeductions = [...employee.deductions];
                        updatedDeductions[0] = response.data;
                        return { ...employee, deductions: updatedDeductions };
                    }
                    return employee;
                })
            );
            
            setAlertMessage('Default deduction set successfully');
            setTimeout(() => setAlertMessage(null), 3000);
        } catch (error) {
            console.error('Error setting default deduction:', error);
            setAlertMessage(error.response?.data?.message || 'Error setting default deduction');
            setTimeout(() => setAlertMessage(null), 3000);
        }
    };

    // Handle pagination
    const handlePageChange = (page) => {
        setLoading(true);
        router.visit(
            `/deductions?cutoff=${filters.cutoff}&month=${filters.month}&year=${filters.year}&search=${filters.search}&page=${page}`,
            {
                preserveState: true,
                preserveScroll: true,
                only: ['employees'],
                onFinish: () => setLoading(false)
            }
        );
    };

    // Export to Excel
    const exportToExcel = (selectedEmployees) => {
        if (!selectedEmployees || selectedEmployees.length === 0) return;
        
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        
        // Create data for export
        const exportData = selectedEmployees.map(employee => {
            const deduction = employee.deductions && employee.deductions.length > 0 ? employee.deductions[0] : null;
            
            // Create a record for each employee with their deduction data
            const record = {
                'Employee ID': employee.idno || '',
                'Employee Name': `${employee.Lname}, ${employee.Fname} ${employee.MName || ''}`.trim(),
                'Department': employee.Department || ''
            };
            
            // Add deduction fields
            const deductionFields = [
                'advance', 'charge_store', 'charge', 'meals', 'miscellaneous', 'other_deductions'
            ];
            
            deductionFields.forEach(field => {
                record[field.replace('_', ' ').toUpperCase()] = deduction ? parseFloat(deduction[field] || 0).toFixed(2) : '0.00';
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
        for (let i = 0; i < 6; i++) {
            columnWidths.push({ wch: 15 });
        }
        
        ws['!cols'] = columnWidths;
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, "Deductions");
        
        // Create date string for filename
        const date = new Date();
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        // Generate Excel file and trigger download
        XLSX.writeFile(wb, `employee_deductions_${dateString}.xlsx`);
    };

    // Generate months
    const months = [
        { id: 1, name: 'January' },
        { id: 2, name: 'February' },
        { id: 3, name: 'March' },
        { id: 4, name: 'April' },
        { id: 5, name: 'May' },
        { id: 6, name: 'June' },
        { id: 7, name: 'July' },
        { id: 8, name: 'August' },
        { id: 9, name: 'September' },
        { id: 10, name: 'October' },
        { id: 11, name: 'November' },
        { id: 12, name: 'December' }
    ];

    // Generate years (current year ± 2 years)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    // Navigate to defaults page
    const navigateToDefaults = () => {
        router.visit('/deduction-defaults');
    };

    return (
        <AuthenticatedLayout user={user}>
            <Head title="Employee Deductions" />
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
                                    Employee Deductions Management
                                </h1>
                                <p className="text-gray-600">
                                    Manage employee deductions including advances, charges, meals, and miscellaneous deductions.
                                </p>
                            </div>
                            <div className="flex items-center space-x-4">
                                <Button
                                    onClick={createBulkDeductions}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors duration-200 flex items-center"
                                >
                                    <Plus className="w-5 h-5 mr-2" />
                                    Create All Deductions
                                </Button>
                                <Button
                                    onClick={postAllDeductions}
                                    className="px-5 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors duration-200 flex items-center"
                                    disabled={status?.pendingCount === 0}
                                >
                                    <Save className="w-5 h-5 mr-2" />
                                    Post All Deductions
                                </Button>
                                <Button
                                    onClick={navigateToDefaults}
                                    className="px-5 py-2.5 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors duration-200 flex items-center"
                                >
                                    <Settings className="w-5 h-5 mr-2" />
                                    Manage Defaults
                                </Button>
                            </div>
                        </div>
                        
                        {/* Status Cards */}
                        <DeductionsStatusCards 
                            total={status?.allCount || 0}
                            posted={status?.postedCount || 0}
                            pending={status?.pendingCount || 0}
                        />

                        {/* Filters */}
                        <DeductionsFilters 
                            filters={filters}
                            months={months}
                            years={years}
                            onFilterChange={handleFilterChange}
                            onSearch={debouncedSearch}
                        />

                        {/* Deductions Table */}
                        <div className="bg-white rounded-lg shadow mt-6">
                            <DeductionsTable
                                employees={employees}
                                loading={loading}
                                onCellUpdate={handleCellUpdate}
                                onCreateDeduction={createDeduction}
                                onPostDeduction={postDeduction}
                                onSetDefault={setDefaultDeduction}
                                onBulkPostDeductions={bulkPostDeductions}
                                onBulkSetDefaultDeductions={bulkSetDefaultDeductions}
                                onExportToExcel={exportToExcel}
                                pagination={{
                                    ...pagination,
                                    onPageChange: handlePageChange,
                                    links: initialEmployees?.links || []
                                }}
                            />
                        </div>

                        {/* Confirm Modal */}
                        <ConfirmModal
                            isOpen={confirmModal.isOpen}
                            onClose={() => setConfirmModal({...confirmModal, isOpen: false})}
                            title={confirmModal.title}
                            message={confirmModal.message}
                            confirmText={confirmModal.confirmText}
                            confirmVariant={confirmModal.confirmVariant}
                            onConfirm={confirmModal.onConfirm}
                        />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
};

export default DeductionsPage;