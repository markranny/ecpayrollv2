import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Download, Search, X, Filter } from 'lucide-react';
import CancelRestDayStatusBadge from './CancelRestDayStatusBadge';
import CancelRestDayDetailModal from './CancelRestDayDetailModal';
import CancelRestDayBulkActionModal from './CancelRestDayBulkActionModal';
import CancelRestDayForceApproveButton from './CancelRestDayForceApproveButton';
import { router } from '@inertiajs/react';
import { toast } from 'react-toastify';

const CancelRestDayList = ({ 
    cancelRestDays, 
    onStatusUpdate, 
    onDelete, 
    userRoles = {}
}) => {
    const [selectedCancelRestDay, setSelectedCancelRestDay] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');
    const [filteredCancelRestDays, setFilteredCancelRestDays] = useState(cancelRestDays || []);
    const [localCancelRestDays, setLocalCancelRestDays] = useState(cancelRestDays || []);
    
    // Add processing state
    const [processing, setProcessing] = useState(false);
    
    // Search functionality
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    
    // For multiple selection
    const [selectedIds, setSelectedIds] = useState([]);
    const [showBulkActionModal, setShowBulkActionModal] = useState(false);
    const [selectAll, setSelectAll] = useState(false);
    
    // Update local state when props change
    useEffect(() => {
        if (!cancelRestDays) return;
        setLocalCancelRestDays(cancelRestDays);
        applyFilters(cancelRestDays, filterStatus, searchTerm, dateRange);
    }, [cancelRestDays]);
    
    // Function to apply all filters
    const applyFilters = (data, status, search, dates) => {
        let result = [...data];
        
        // Apply status filter
        if (status) {
            result = result.filter(crd => crd.status === status);
        }
        
        // Apply search filter
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(crd => 
                // Search by employee name
                (crd.employee && 
                    ((crd.employee.Fname && crd.employee.Fname.toLowerCase().includes(searchLower)) || 
                     (crd.employee.Lname && crd.employee.Lname.toLowerCase().includes(searchLower)))) ||
                // Search by employee ID
                (crd.employee && crd.employee.idno && crd.employee.idno.toString().includes(searchLower)) ||
                // Search by department
                (crd.employee && crd.employee.Department && crd.employee.Department.toLowerCase().includes(searchLower)) ||
                // Search by reason
                (crd.reason && crd.reason.toLowerCase().includes(searchLower))
            );
        }
        
        // Apply date range filter
        if (dates.from && dates.to) {
            result = result.filter(crd => {
                if (!crd.rest_day_date) return false;
                const restDayDate = new Date(crd.rest_day_date);
                const fromDate = new Date(dates.from);
                const toDate = new Date(dates.to);
                toDate.setHours(23, 59, 59);
                
                return restDayDate >= fromDate && restDayDate <= toDate;
            });
        } else if (dates.from) {
            result = result.filter(crd => {
                if (!crd.rest_day_date) return false;
                const restDayDate = new Date(crd.rest_day_date);
                const fromDate = new Date(dates.from);
                return restDayDate >= fromDate;
            });
        } else if (dates.to) {
            result = result.filter(crd => {
                if (!crd.rest_day_date) return false;
                const restDayDate = new Date(crd.rest_day_date);
                const toDate = new Date(dates.to);
                toDate.setHours(23, 59, 59);
                return restDayDate <= toDate;
            });
        }
        
        setFilteredCancelRestDays(result);
        return result;
    };
    
    // Handle status filter change
    const handleStatusFilterChange = (e) => {
        const status = e.target.value;
        setFilterStatus(status);
        applyFilters(localCancelRestDays, status, searchTerm, dateRange);
    };
    
    // Handle search input change
    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        applyFilters(localCancelRestDays, filterStatus, value, dateRange);
    };
    
    // Handle date range changes
    const handleDateRangeChange = (field, value) => {
        const newDateRange = { ...dateRange, [field]: value };
        setDateRange(newDateRange);
        applyFilters(localCancelRestDays, filterStatus, searchTerm, newDateRange);
    };
    
    // Clear all filters
    const clearFilters = () => {
        setFilterStatus('');
        setSearchTerm('');
        setDateRange({ from: '', to: '' });
        applyFilters(localCancelRestDays, '', '', { from: '', to: '' });
    };
    
    // Open detail modal
    const handleViewDetail = (cancelRestDay) => {
        setSelectedCancelRestDay(cancelRestDay);
        setShowModal(true);
    };
    
    // Close detail modal
    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedCancelRestDay(null);
    };
    
    // Handle status update (from modal)
    const handleStatusUpdate = (id, data) => {
        if (typeof onStatusUpdate === 'function') {
            onStatusUpdate(id, data);
        }
        handleCloseModal();
    };
    
    const handleDelete = (id) => {
        if (confirm('Are you sure you want to delete this cancel rest day request?')) {
            setProcessing(true);
            
            router.post(route('cancel-rest-days.destroy', id), {
                _method: 'DELETE'
            }, {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Cancel rest day request deleted successfully');
                    
                    // Update the local state instead of reloading the page
                    const updatedLocalCancelRestDays = localCancelRestDays.filter(item => item.id !== id);
                    setLocalCancelRestDays(updatedLocalCancelRestDays);
                    
                    // Also update filtered cancel rest days
                    setFilteredCancelRestDays(prev => prev.filter(item => item.id !== id));
                    
                    // Clear selection if the deleted item was selected
                    if (selectedIds.includes(id)) {
                        setSelectedIds(prev => prev.filter(itemId => itemId !== id));
                    }
                    
                    setProcessing(false);
                },
                onError: (errors) => {
                    console.error('Error deleting:', errors);
                    toast.error('Failed to delete cancel rest day request');
                    setProcessing(false);
                }
            });
        }
    }
    
    // Format date safely
    const formatDate = (dateString) => {
        try {
            return format(new Date(dateString), 'yyyy-MM-dd');
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid date';
        }
    };

    // Multiple selection handlers
    const toggleSelectAll = () => {
        setSelectAll(!selectAll);
        if (!selectAll) {
            let selectableIds = [];
            
            if (userRoles.isDepartmentManager || userRoles.isHrdManager || userRoles.isSuperAdmin) {
                selectableIds = filteredCancelRestDays
                    .filter(crd => crd.status === 'pending')
                    .map(crd => crd.id);
            }
            
            setSelectedIds(selectableIds);
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelectItem = (id) => {
        setSelectedIds(prevIds => {
            if (prevIds.includes(id)) {
                return prevIds.filter(itemId => itemId !== id);
            } else {
                return [...prevIds, id];
            }
        });
    };

    const handleOpenBulkActionModal = () => {
        if (selectedIds.length === 0) {
            alert('Please select at least one cancel rest day request');
            return;
        }
        setShowBulkActionModal(true);
    };

    const handleCloseBulkActionModal = () => {
        setShowBulkActionModal(false);
    };

    const handleBulkStatusUpdate = (status, remarks) => {
        setProcessing(true);
        
        const data = {
            cancel_rest_day_ids: selectedIds,
            status: status,
            remarks: remarks
        };
        
        router.post(route('cancel-rest-days.bulkUpdateStatus'), data, {
            preserveScroll: true,
            onSuccess: (page) => {
                // Update local state instead of reloading the page
                const updatedCancelRestDays = localCancelRestDays.map(item => {
                    if (selectedIds.includes(item.id)) {
                        return {
                            ...item,
                            status: status,
                            remarks: remarks,
                            approved_at: new Date().toISOString(),
                            approver: page.props?.auth?.user ? {
                                id: page.props.auth.user.id,
                                name: page.props.auth.user.name
                            } : null
                        };
                    }
                    return item;
                });
                
                // Update both local and filtered states
                setLocalCancelRestDays(updatedCancelRestDays);
                
                // Re-apply current filters to the updated data
                applyFilters(updatedCancelRestDays, filterStatus, searchTerm, dateRange);
                
                // Show success message
                if (page.props?.flash?.message) {
                    toast.success(page.props.flash.message);
                } else {
                    toast.success(`Successfully ${status} ${selectedIds.length} cancel rest day requests`);
                }
                
                // Clear selected items
                setSelectedIds([]);
                setSelectAll(false);
                
                // Close modal and reset processing state
                handleCloseBulkActionModal();
                setProcessing(false);
            },
            onError: (errors) => {
                console.error('Error during bulk update:', errors);
                toast.error('Failed to update cancel rest day requests');
                setProcessing(false);
            }
        });
    }
    
    // Export to Excel functionality
    const exportToExcel = () => {
        const queryParams = new URLSearchParams();
        
        if (filterStatus) {
            queryParams.append('status', filterStatus);
        }
        
        if (searchTerm) {
            queryParams.append('search', searchTerm);
        }
        
        if (dateRange.from) {
            queryParams.append('from_date', dateRange.from);
        }
        
        if (dateRange.to) {
            queryParams.append('to_date', dateRange.to);
        }
        
        const exportUrl = `/cancel-rest-days/export?${queryParams.toString()}`;
        window.open(exportUrl, '_blank');
    };

    const canSelectCancelRestDay = (cancelRestDay) => {
        if (userRoles.isSuperAdmin || userRoles.isHrdManager) {
            return cancelRestDay.status === 'pending';
        } else if (userRoles.isDepartmentManager) {
            return cancelRestDay.status === 'pending' && 
                   userRoles.managedDepartments?.includes(cancelRestDay.employee?.Department);
        }
        return false;
    };

    // Get selectable items count
    const selectableItemsCount = filteredCancelRestDays.filter(crd => canSelectCancelRestDay(crd)).length;

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden flex flex-col h-[62vh]">
            <div className="p-4 border-b">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                    <h3 className="text-lg font-semibold">Cancel Rest Day Requests</h3>
                    
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        {/* Export Button */}
                        <button
                            onClick={exportToExcel}
                            className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center"
                            title="Export to Excel"
                        >
                            <Download className="h-4 w-4 mr-1" />
                            Export
                        </button>

                        {/* Force Approve Button - Only visible for SuperAdmin */}
                        {userRoles.isSuperAdmin && (
                            <CancelRestDayForceApproveButton 
                                selectedIds={selectedIds} 
                                disabled={processing}
                            />
                        )}
                        
                        {/* Bulk Action Button */}
                        {selectedIds.length > 0 && (
                            <button
                                onClick={handleOpenBulkActionModal}
                                className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                                disabled={processing}
                            >
                                Bulk Action ({selectedIds.length})
                            </button>
                        )}
                        
                        {/* Status Filter */}
                        <div className="flex items-center">
                            <select
                                id="statusFilter"
                                className="rounded-md border-gray-300 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                                value={filterStatus}
                                onChange={handleStatusFilterChange}
                            >
                                <option value="">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                {/* Search and date filters */}
                <div className="mt-4 flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, ID, department, or reason"
                            className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        <div className="flex items-center">
                            <label htmlFor="fromDate" className="mr-2 text-sm font-medium text-gray-700">
                                From:
                            </label>
                            <input
                                id="fromDate"
                                type="date"
                                className="rounded-md border-gray-300 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                                value={dateRange.from}
                                onChange={(e) => handleDateRangeChange('from', e.target.value)}
                            />
                        </div>
                        
                        <div className="flex items-center">
                            <label htmlFor="toDate" className="mr-2 text-sm font-medium text-gray-700">
                                To:
                            </label>
                            <input
                                id="toDate"
                                type="date"
                                className="rounded-md border-gray-300 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                                value={dateRange.to}
                                onChange={(e) => handleDateRangeChange('to', e.target.value)}
                            />
                        </div>
                        
                        {/* Clear filters button */}
                        {(filterStatus || searchTerm || dateRange.from || dateRange.to) && (
                            <button
                                onClick={clearFilters}
                                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm flex items-center"
                                title="Clear all filters"
                            >
                                <X className="h-4 w-4 mr-1" />
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="overflow-auto flex-grow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            {selectableItemsCount > 0 && (
                                <th scope="col" className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                                        checked={selectAll && selectedIds.length === selectableItemsCount}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                            )}
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Employee
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rest Day Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Replacement Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Approved By
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredCancelRestDays.length === 0 ? (
                            <tr>
                                <td colSpan={selectableItemsCount > 0 ? "7" : "6"} className="px-6 py-4 text-center text-sm text-gray-500">
                                    No cancel rest day records found
                                </td>
                            </tr>
                        ) : (
                            filteredCancelRestDays.map(cancelRestDay => (
                                <tr key={cancelRestDay.id} className="hover:bg-gray-50">
                                    {selectableItemsCount > 0 && (
                                        <td className="px-4 py-4">
                                            {canSelectCancelRestDay(cancelRestDay) && (
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                                                    checked={selectedIds.includes(cancelRestDay.id)}
                                                    onChange={() => toggleSelectItem(cancelRestDay.id)}
                                                />
                                            )}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {cancelRestDay.employee ? 
                                                `${cancelRestDay.employee.Lname}, ${cancelRestDay.employee.Fname}` : 
                                                'Unknown employee'}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {cancelRestDay.employee?.idno || 'N/A'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {cancelRestDay.rest_day_date ? formatDate(cancelRestDay.rest_day_date) : 'N/A'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {cancelRestDay.replacement_work_date ? formatDate(cancelRestDay.replacement_work_date) : 'Not specified'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <CancelRestDayStatusBadge status={cancelRestDay.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {cancelRestDay.approver ? cancelRestDay.approver.name : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleViewDetail(cancelRestDay)}
                                            className="text-red-600 hover:text-red-900 mr-3"
                                        >
                                            View
                                        </button>
                                        
                                        {(cancelRestDay.status === 'pending' && 
                                          (userRoles.isSuperAdmin || 
                                           cancelRestDay.employee_id === userRoles.employeeId || 
                                           (userRoles.isDepartmentManager && 
                                            userRoles.managedDepartments?.includes(cancelRestDay.employee?.Department)))) && (
                                            <button
                                                onClick={() => handleDelete(cancelRestDay.id)}
                                                className="text-red-600 hover:text-red-900"
                                                disabled={processing}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Detail Modal */}
            {showModal && selectedCancelRestDay && (
                <CancelRestDayDetailModal
                    cancelRestDay={selectedCancelRestDay}
                    onClose={handleCloseModal}
                    onStatusUpdate={handleStatusUpdate}
                    userRoles={userRoles}
                />
            )}

            {/* Bulk Action Modal */}
            {showBulkActionModal && (
                <CancelRestDayBulkActionModal
                    selectedCount={selectedIds.length} 
                    onClose={handleCloseBulkActionModal}
                    onSubmit={handleBulkStatusUpdate}
                    userRoles={userRoles}
                />
            )}
        </div>
    );
};

export default CancelRestDayList;