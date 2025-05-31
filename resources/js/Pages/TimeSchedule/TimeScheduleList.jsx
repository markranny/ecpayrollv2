import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Download, Search, X, Filter } from 'lucide-react';
import TimeScheduleStatusBadge from './TimeScheduleStatusBadge';
import TimeScheduleDetailModal from './TimeScheduleDetailModal';
import TimeScheduleBulkActionModal from './TimeScheduleBulkActionModal';
import TimeScheduleForceApproveButton from './TimeScheduleForceApproveButton';
import { router } from '@inertiajs/react';
import { toast } from 'react-toastify';

const TimeScheduleList = ({ 
    timeSchedules, 
    onStatusUpdate, 
    onDelete, 
    userRoles = {}
}) => {
    const [selectedTimeSchedule, setSelectedTimeSchedule] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');
    const [filteredTimeSchedules, setFilteredTimeSchedules] = useState(timeSchedules || []);
    const [localTimeSchedules, setLocalTimeSchedules] = useState(timeSchedules || []);
    
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
        if (!timeSchedules) return;
        setLocalTimeSchedules(timeSchedules);
        applyFilters(timeSchedules, filterStatus, searchTerm, dateRange);
    }, [timeSchedules]);
    
    // Function to apply all filters
    const applyFilters = (data, status, search, dates) => {
        let result = [...data];
        
        // Apply status filter
        if (status) {
            result = result.filter(ts => ts.status === status);
        }
        
        // Apply search filter
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(ts => 
                // Search by employee name
                (ts.employee && 
                    ((ts.employee.Fname && ts.employee.Fname.toLowerCase().includes(searchLower)) || 
                     (ts.employee.Lname && ts.employee.Lname.toLowerCase().includes(searchLower)))) ||
                // Search by employee ID
                (ts.employee && ts.employee.idno && ts.employee.idno.toString().includes(searchLower)) ||
                // Search by department
                (ts.employee && ts.employee.Department && ts.employee.Department.toLowerCase().includes(searchLower)) ||
                // Search by reason
                (ts.reason && ts.reason.toLowerCase().includes(searchLower)) ||
                // Search by schedule name
                (ts.new_schedule && ts.new_schedule.toLowerCase().includes(searchLower))
            );
        }
        
        // Apply date range filter
        if (dates.from && dates.to) {
            result = result.filter(ts => {
                if (!ts.effective_date) return false;
                const effectiveDate = new Date(ts.effective_date);
                const fromDate = new Date(dates.from);
                const toDate = new Date(dates.to);
                toDate.setHours(23, 59, 59);
                
                return effectiveDate >= fromDate && effectiveDate <= toDate;
            });
        } else if (dates.from) {
            result = result.filter(ts => {
                if (!ts.effective_date) return false;
                const effectiveDate = new Date(ts.effective_date);
                const fromDate = new Date(dates.from);
                return effectiveDate >= fromDate;
            });
        } else if (dates.to) {
            result = result.filter(ts => {
                if (!ts.effective_date) return false;
                const effectiveDate = new Date(ts.effective_date);
                const toDate = new Date(dates.to);
                toDate.setHours(23, 59, 59);
                return effectiveDate <= toDate;
            });
        }
        
        setFilteredTimeSchedules(result);
        return result;
    };
    
    // Handle status filter change
    const handleStatusFilterChange = (e) => {
        const status = e.target.value;
        setFilterStatus(status);
        applyFilters(localTimeSchedules, status, searchTerm, dateRange);
    };
    
    // Handle search input change
    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        applyFilters(localTimeSchedules, filterStatus, value, dateRange);
    };
    
    // Handle date range changes
    const handleDateRangeChange = (field, value) => {
        const newDateRange = { ...dateRange, [field]: value };
        setDateRange(newDateRange);
        applyFilters(localTimeSchedules, filterStatus, searchTerm, newDateRange);
    };
    
    // Clear all filters
    const clearFilters = () => {
        setFilterStatus('');
        setSearchTerm('');
        setDateRange({ from: '', to: '' });
        applyFilters(localTimeSchedules, '', '', { from: '', to: '' });
    };
    
    // Open detail modal
    const handleViewDetail = (timeSchedule) => {
        setSelectedTimeSchedule(timeSchedule);
        setShowModal(true);
    };
    
    // Close detail modal
    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedTimeSchedule(null);
    };
    
    // Handle status update (from modal)
    const handleStatusUpdate = (id, data) => {
        if (typeof onStatusUpdate === 'function') {
            onStatusUpdate(id, data);
        }
        handleCloseModal();
    };
    
    const handleDelete = (id) => {
        if (confirm('Are you sure you want to delete this time schedule change request?')) {
            setProcessing(true);
            
            router.post(route('time-schedules.destroy', id), {
                _method: 'DELETE'
            }, {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Time schedule change request deleted successfully');
                    
                    // Update the local state instead of reloading the page
                    const updatedLocalTimeSchedules = localTimeSchedules.filter(item => item.id !== id);
                    setLocalTimeSchedules(updatedLocalTimeSchedules);
                    
                    // Also update filtered time schedules
                    setFilteredTimeSchedules(prev => prev.filter(item => item.id !== id));
                    
                    // Clear selection if the deleted item was selected
                    if (selectedIds.includes(id)) {
                        setSelectedIds(prev => prev.filter(itemId => itemId !== id));
                    }
                    
                    setProcessing(false);
                },
                onError: (errors) => {
                    console.error('Error deleting:', errors);
                    toast.error('Failed to delete time schedule change request');
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

    // Format time safely
    const formatTime = (timeString) => {
        try {
            return format(new Date(timeString), 'h:mm a');
        } catch (error) {
            try {
                // Try alternative parsing for time-only strings
                const today = new Date().toISOString().split('T')[0];
                return format(new Date(`${today}T${timeString}`), 'h:mm a');
            } catch (error) {
                console.error('Error formatting time:', error);
                return timeString || 'N/A';
            }
        }
    };

    // Multiple selection handlers
    const toggleSelectAll = () => {
        setSelectAll(!selectAll);
        if (!selectAll) {
            let selectableIds = [];
            
            if (userRoles.isDepartmentManager || userRoles.isHrdManager || userRoles.isSuperAdmin) {
                selectableIds = filteredTimeSchedules
                    .filter(ts => ts.status === 'pending')
                    .map(ts => ts.id);
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
            alert('Please select at least one time schedule change request');
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
            time_schedule_ids: selectedIds,
            status: status,
            remarks: remarks
        };
        
        router.post(route('time-schedules.bulkUpdateStatus'), data, {
            preserveScroll: true,
            onSuccess: (page) => {
                // Update local state instead of reloading the page
                const updatedTimeSchedules = localTimeSchedules.map(item => {
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
                setLocalTimeSchedules(updatedTimeSchedules);
                
                // Re-apply current filters to the updated data
                applyFilters(updatedTimeSchedules, filterStatus, searchTerm, dateRange);
                
                // Show success message
                if (page.props?.flash?.message) {
                    toast.success(page.props.flash.message);
                } else {
                    toast.success(`Successfully ${status} ${selectedIds.length} time schedule change requests`);
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
                toast.error('Failed to update time schedule change requests');
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
        
        const exportUrl = `/time-schedules/export?${queryParams.toString()}`;
        window.open(exportUrl, '_blank');
    };

    const canSelectTimeSchedule = (timeSchedule) => {
        if (userRoles.isSuperAdmin || userRoles.isHrdManager) {
            return timeSchedule.status === 'pending';
        } else if (userRoles.isDepartmentManager) {
            return timeSchedule.status === 'pending' && 
                   userRoles.managedDepartments?.includes(timeSchedule.employee?.Department);
        }
        return false;
    };

    // Get selectable items count
    const selectableItemsCount = filteredTimeSchedules.filter(ts => canSelectTimeSchedule(ts)).length;

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden flex flex-col h-[62vh]">
            <div className="p-4 border-b">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                    <h3 className="text-lg font-semibold">Time Schedule Change Requests</h3>
                    
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
                            <TimeScheduleForceApproveButton 
                                selectedIds={selectedIds} 
                                disabled={processing}
                            />
                        )}
                        
                        {/* Bulk Action Button */}
                        {selectedIds.length > 0 && (
                            <button
                                onClick={handleOpenBulkActionModal}
                                className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                disabled={processing}
                            >
                                Bulk Action ({selectedIds.length})
                            </button>
                        )}
                        
                        {/* Status Filter */}
                        <div className="flex items-center">
                            <select
                                id="statusFilter"
                                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
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
                            placeholder="Search by name, ID, department, or schedule"
                            className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
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
                                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
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
                                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
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
                                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        checked={selectAll && selectedIds.length === selectableItemsCount}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                            )}
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Employee
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Schedule Type
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Effective Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                New Schedule
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Time
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTimeSchedules.length === 0 ? (
                            <tr>
                                <td colSpan={selectableItemsCount > 0 ? "8" : "7"} className="px-6 py-4 text-center text-sm text-gray-500">
                                    No time schedule change records found
                                </td>
                            </tr>
                        ) : (
                            filteredTimeSchedules.map(timeSchedule => (
                                <tr key={timeSchedule.id} className="hover:bg-gray-50">
                                    {selectableItemsCount > 0 && (
                                        <td className="px-4 py-4">
                                            {canSelectTimeSchedule(timeSchedule) && (
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                    checked={selectedIds.includes(timeSchedule.id)}
                                                    onChange={() => toggleSelectItem(timeSchedule.id)}
                                                />
                                            )}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {timeSchedule.employee ? 
                                                `${timeSchedule.employee.Lname}, ${timeSchedule.employee.Fname}` : 
                                                'Unknown employee'}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {timeSchedule.employee?.idno || 'N/A'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {timeSchedule.scheduleType?.name || 'N/A'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {timeSchedule.effective_date ? formatDate(timeSchedule.effective_date) : 'N/A'}
                                        </div>
                                        {timeSchedule.end_date && (
                                            <div className="text-xs text-gray-500">
                                                Until: {formatDate(timeSchedule.end_date)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {timeSchedule.new_schedule || 'N/A'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {timeSchedule.new_start_time ? formatTime(timeSchedule.new_start_time) : 'N/A'} - {timeSchedule.new_end_time ? formatTime(timeSchedule.new_end_time) : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <TimeScheduleStatusBadge status={timeSchedule.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleViewDetail(timeSchedule)}
                                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                                        >
                                            View
                                        </button>
                                        
                                        {(timeSchedule.status === 'pending' && 
                                          (userRoles.isSuperAdmin || 
                                           timeSchedule.employee_id === userRoles.employeeId || 
                                           (userRoles.isDepartmentManager && 
                                            userRoles.managedDepartments?.includes(timeSchedule.employee?.Department)))) && (
                                            <button
                                                onClick={() => handleDelete(timeSchedule.id)}
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
            {showModal && selectedTimeSchedule && (
                <TimeScheduleDetailModal
                    timeSchedule={selectedTimeSchedule}
                    onClose={handleCloseModal}
                    onStatusUpdate={handleStatusUpdate}
                    userRoles={userRoles}
                />
            )}

            {/* Bulk Action Modal */}
            {showBulkActionModal && (
                <TimeScheduleBulkActionModal
                    selectedCount={selectedIds.length} 
                    onClose={handleCloseBulkActionModal}
                    onSubmit={handleBulkStatusUpdate}
                    userRoles={userRoles}
                />
            )}
        </div>
    );
};

export default TimeScheduleList;