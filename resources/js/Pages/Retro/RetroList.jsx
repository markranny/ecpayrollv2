import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Download, Search, X, Filter, Loader2 } from 'lucide-react';
import RetroStatusBadge from './RetroStatusBadge';
import RetroDetailModal from './RetroDetailModal';
import RetroBulkActionModal from './RetroBulkActionModal';
import RetroForceApproveButton from './RetroForceApproveButton';
import { router } from '@inertiajs/react';
import { toast } from 'react-toastify';

const RetroList = ({ 
    retros, 
    onStatusUpdate, 
    onDelete, 
    userRoles = {},
    processing = false
}) => {
    const [selectedRetro, setSelectedRetro] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');
    const [filteredRetros, setFilteredRetros] = useState(retros || []);
    const [localRetros, setLocalRetros] = useState(retros || []);
    
    // Loading states for various operations
    const [localProcessing, setLocalProcessing] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);
    const [exporting, setExporting] = useState(false);
    
    // Search functionality
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    
    // For multiple selection
    const [selectedIds, setSelectedIds] = useState([]);
    const [showBulkActionModal, setShowBulkActionModal] = useState(false);
    const [selectAll, setSelectAll] = useState(false);
    
    // Update local state when props change
    useEffect(() => {
        if (!retros) return;
        setLocalRetros(retros);
        applyFilters(retros, filterStatus, searchTerm, dateRange);
    }, [retros]);
    
    // Function to apply all filters
    const applyFilters = (data, status, search, dates) => {
        let result = [...data];
        
        // Apply status filter
        if (status) {
            result = result.filter(retro => retro.status === status);
        }
        
        // Apply search filter
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(retro => 
                // Search by employee name
                (retro.employee && 
                    ((retro.employee.Fname && retro.employee.Fname.toLowerCase().includes(searchLower)) || 
                     (retro.employee.Lname && retro.employee.Lname.toLowerCase().includes(searchLower)))) ||
                // Search by employee ID
                (retro.employee && retro.employee.idno && retro.employee.idno.toString().includes(searchLower)) ||
                // Search by department
                (retro.employee && retro.employee.Department && retro.employee.Department.toLowerCase().includes(searchLower)) ||
                // Search by reason
                (retro.reason && retro.reason.toLowerCase().includes(searchLower)) ||
                // Search by retro type
                (retro.retro_type && retro.retro_type.toLowerCase().includes(searchLower))
            );
        }
        
        // Apply date range filter
        if (dates.from && dates.to) {
            result = result.filter(retro => {
                if (!retro.retro_date) return false;
                const retroDate = new Date(retro.retro_date);
                const fromDate = new Date(dates.from);
                const toDate = new Date(dates.to);
                toDate.setHours(23, 59, 59);
                
                return retroDate >= fromDate && retroDate <= toDate;
            });
        } else if (dates.from) {
            result = result.filter(retro => {
                if (!retro.retro_date) return false;
                const retroDate = new Date(retro.retro_date);
                const fromDate = new Date(dates.from);
                return retroDate >= fromDate;
            });
        } else if (dates.to) {
            result = result.filter(retro => {
                if (!retro.retro_date) return false;
                const retroDate = new Date(retro.retro_date);
                const toDate = new Date(dates.to);
                toDate.setHours(23, 59, 59);
                return retroDate <= toDate;
            });
        }
        
        setFilteredRetros(result);
        return result;
    };
    
    // Handle status filter change
    const handleStatusFilterChange = (e) => {
        if (processing || localProcessing) return;
        const status = e.target.value;
        setFilterStatus(status);
        applyFilters(localRetros, status, searchTerm, dateRange);
    };
    
    // Handle search input change
    const handleSearchChange = (e) => {
        if (processing || localProcessing) return;
        const value = e.target.value;
        setSearchTerm(value);
        applyFilters(localRetros, filterStatus, value, dateRange);
    };
    
    // Handle date range changes
    const handleDateRangeChange = (field, value) => {
        if (processing || localProcessing) return;
        const newDateRange = { ...dateRange, [field]: value };
        setDateRange(newDateRange);
        applyFilters(localRetros, filterStatus, searchTerm, newDateRange);
    };
    
    // Clear all filters
    const clearFilters = () => {
        if (processing || localProcessing) return;
        setFilterStatus('');
        setSearchTerm('');
        setDateRange({ from: '', to: '' });
        applyFilters(localRetros, '', '', { from: '', to: '' });
    };
    
    // Open detail modal
    const handleViewDetail = (retro) => {
        if (processing || localProcessing) return;
        setSelectedRetro(retro);
        setShowModal(true);
    };
    
    // Close detail modal
    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedRetro(null);
    };
    
    // Handle status update (from modal)
    const handleStatusUpdate = (id, data) => {
        setUpdatingId(id);
        setLocalProcessing(true);
        
        if (typeof onStatusUpdate === 'function') {
            try {
                const result = onStatusUpdate(id, data);
                
                if (result && typeof result.then === 'function') {
                    result
                        .then(() => {
                            setUpdatingId(null);
                            setLocalProcessing(false);
                            handleCloseModal();
                        })
                        .catch((error) => {
                            console.error('Error updating status:', error);
                            toast.error('Error: Unable to update status. Please try again.');
                            setUpdatingId(null);
                            setLocalProcessing(false);
                        });
                } else {
                    setUpdatingId(null);
                    setLocalProcessing(false);
                    handleCloseModal();
                }
            } catch (error) {
                console.error('Error updating status:', error);
                toast.error('Error: Unable to update status. Please refresh the page and try again.');
                setUpdatingId(null);
                setLocalProcessing(false);
            }
        } else {
            console.error('onStatusUpdate is not a function');
            toast.error('Error: Unable to update status. Please refresh the page and try again.');
            setUpdatingId(null);
            setLocalProcessing(false);
        }
    };
    
    const handleDelete = (id) => {
    // Add validation to ensure ID exists and is valid
    if (!id || isNaN(id) || id <= 0) {
        console.error('Delete failed: Invalid ID provided', id);
        toast.error('Error: Invalid retro request ID');
        return;
    }

    if (confirm('Are you sure you want to delete this retro request?')) {
        setDeletingId(id);
        setLocalProcessing(true);
        
        console.log('Attempting to delete retro with ID:', id);
        
        // Solution 1: Use POST with _method parameter (more reliable)
        const deleteUrl = `/retro/${id}/delete`; // Uses the POST delete route
        
        console.log('Delete URL:', deleteUrl);
        
        router.post(deleteUrl, {}, {
            preserveScroll: true,
            onSuccess: (page) => {
                console.log('Delete successful for ID:', id);
                toast.success('Retro request deleted successfully');
                
                // Update the local state instead of reloading the page
                const updatedLocalRetros = localRetros.filter(item => item.id !== id);
                setLocalRetros(updatedLocalRetros);
                
                // Re-apply current filters to the updated data
                applyFilters(updatedLocalRetros, filterStatus, searchTerm, dateRange);
                
                // Clear selection if the deleted item was selected
                if (selectedIds.includes(id)) {
                    setSelectedIds(prev => prev.filter(itemId => itemId !== id));
                }
                
                setDeletingId(null);
                setLocalProcessing(false);
            },
            onError: (errors) => {
                console.error('POST Delete failed, trying direct DELETE:', errors);
                
                // Fallback: Try direct DELETE with manual URL construction
                const directDeleteUrl = `/retro/${id}`;
                console.log('Trying direct DELETE to:', directDeleteUrl);
                
                router.delete(directDeleteUrl, {
                    preserveScroll: true,
                    onSuccess: (page) => {
                        console.log('Direct DELETE successful for ID:', id);
                        toast.success('Retro request deleted successfully');
                        
                        // Update the local state
                        const updatedLocalRetros = localRetros.filter(item => item.id !== id);
                        setLocalRetros(updatedLocalRetros);
                        
                        // Re-apply current filters to the updated data
                        applyFilters(updatedLocalRetros, filterStatus, searchTerm, dateRange);
                        
                        // Clear selection if the deleted item was selected
                        if (selectedIds.includes(id)) {
                            setSelectedIds(prev => prev.filter(itemId => itemId !== id));
                        }
                        
                        setDeletingId(null);
                        setLocalProcessing(false);
                    },
                    onError: (deleteErrors) => {
                        console.error('Both POST and DELETE methods failed:', deleteErrors);
                        let errorMessage = 'Failed to delete retro request';
                        
                        if (deleteErrors && typeof deleteErrors === 'object') {
                            errorMessage += ': ' + (Object.values(deleteErrors).join(', ') || 'Unknown error');
                        }
                        
                        toast.error(errorMessage);
                        setDeletingId(null);
                        setLocalProcessing(false);
                    }
                });
            }
        });
    }
};
    
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
        if (processing || localProcessing) return;
        
        setSelectAll(!selectAll);
        if (!selectAll) {
            let selectableIds = [];
            
            if (userRoles.isDepartmentManager || userRoles.isHrdManager || userRoles.isSuperAdmin) {
                selectableIds = filteredRetros
                    .filter(retro => retro.status === 'pending')
                    .map(retro => retro.id);
            }
            
            setSelectedIds(selectableIds);
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelectItem = (id) => {
        if (processing || localProcessing) return;
        
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
            alert('Please select at least one retro request');
            return;
        }
        if (processing || localProcessing) return;
        setShowBulkActionModal(true);
    };

    const handleCloseBulkActionModal = () => {
        setShowBulkActionModal(false);
    };

    const handleBulkStatusUpdate = (status, remarks) => {
        setLocalProcessing(true);
        
        const data = {
            retro_ids: selectedIds,
            status: status,
            remarks: remarks
        };
        
        router.post(route('retro.bulkUpdateStatus'), data, {
            preserveScroll: true,
            onSuccess: (page) => {
                // Update local state instead of reloading the page
                const updatedRetros = localRetros.map(item => {
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
                setLocalRetros(updatedRetros);
                
                // Re-apply current filters to the updated data
                applyFilters(updatedRetros, filterStatus, searchTerm, dateRange);
                
                // Show success message
                if (page.props?.flash?.message) {
                    toast.success(page.props.flash.message);
                } else {
                    toast.success(`Successfully ${status} ${selectedIds.length} retro requests`);
                }
                
                // Clear selected items
                setSelectedIds([]);
                setSelectAll(false);
                
                // Close modal and reset processing state
                handleCloseBulkActionModal();
                setLocalProcessing(false);
            },
            onError: (errors) => {
                console.error('Error during bulk update:', errors);
                toast.error('Failed to update retro requests: ' + 
                    (errors?.message || 'Unknown error'));
                setLocalProcessing(false);
            }
        });
    }
    
    // Export to Excel functionality
    const exportToExcel = () => {
        if (processing || localProcessing || exporting) return;
        
        setExporting(true);
        
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
        
        const exportUrl = `/retro/export?${queryParams.toString()}`;
        
        const link = document.createElement('a');
        link.href = exportUrl;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => {
            setExporting(false);
        }, 2000);
    };

    const canSelectRetro = (retro) => {
        if (userRoles.isSuperAdmin || userRoles.isHrdManager) {
            return retro.status === 'pending';
        } else if (userRoles.isDepartmentManager) {
            return retro.status === 'pending' && 
                   userRoles.managedDepartments?.includes(retro.employee?.Department);
        }
        return false;
    };

    // Get selectable items count
    const selectableItemsCount = filteredRetros.filter(retro => canSelectRetro(retro)).length;

    // Format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP'
        }).format(value);
    };

    // Helper function for bulk action button content
    const bulkActionButtonContent = () => {
        if (localProcessing || processing) {
            return (
                <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Processing...
                </>
            );
        }
        return `Bulk Action (${selectedIds.length})`;
    };

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden flex flex-col h-[62vh] relative">
            {/* Global loading overlay for the entire list */}
            {(processing || localProcessing) && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-40">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-600" />
                        <p className="text-sm text-gray-600">
                            {processing ? 'Processing retro requests...' : 'Updating data...'}
                        </p>
                    </div>
                </div>
            )}
            
            <div className="p-4 border-b">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                    <h3 className="text-lg font-semibold">Retro Requests</h3>
                    
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        {/* Export Button */}
                        <button
                            onClick={exportToExcel}
                            className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            title="Export to Excel"
                            disabled={exporting || processing || localProcessing}
                        >
                            {exporting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4 mr-1" />
                                    Export
                                </>
                            )}
                        </button>

                        {/* Force Approve Button - Only visible for SuperAdmin */}
                        {userRoles.isSuperAdmin && (
                            <RetroForceApproveButton 
                                selectedIds={selectedIds} 
                                disabled={processing || localProcessing}
                            />
                        )}
                        
                        {/* Bulk Action Button */}
                        {selectedIds.length > 0 && (
                            <button
                                onClick={handleOpenBulkActionModal}
                                className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                disabled={processing || localProcessing}
                            >
                                {bulkActionButtonContent()}
                            </button>
                        )}
                        
                        {/* Status Filter */}
                        <div className="flex items-center">
                            <select
                                id="statusFilter"
                                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                value={filterStatus}
                                onChange={handleStatusFilterChange}
                                disabled={processing || localProcessing}
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
                            placeholder="Search by name, ID, department, reason, or type"
                            className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            disabled={processing || localProcessing}
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
                                disabled={processing || localProcessing}
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
                                disabled={processing || localProcessing}
                            />
                        </div>
                        
                        {/* Clear filters button */}
                        {(filterStatus || searchTerm || dateRange.from || dateRange.to) && (
                            <button
                                onClick={clearFilters}
                                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                title="Clear all filters"
                                disabled={processing || localProcessing}
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
                                        disabled={processing || localProcessing}
                                    />
                                </th>
                            )}
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Employee
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Retro Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Values
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
                        {filteredRetros.length === 0 ? (
                            <tr>
                                <td colSpan={selectableItemsCount > 0 ? "8" : "7"} className="px-6 py-4 text-center text-sm text-gray-500">
                                    {processing || localProcessing ? 'Loading retro requests...' : 'No retro records found'}
                                </td>
                            </tr>
                        ) : (
                            filteredRetros.map(retro => (
                                <tr key={retro.id} className={`hover:bg-gray-50 transition-colors duration-200 ${
                                    (deletingId === retro.id || updatingId === retro.id) ? 'opacity-50' : ''
                                }`}>
                                    {selectableItemsCount > 0 && (
                                        <td className="px-4 py-4">
                                            {canSelectRetro(retro) && (
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                    checked={selectedIds.includes(retro.id)}
                                                    onChange={() => toggleSelectItem(retro.id)}
                                                    disabled={processing || localProcessing || deletingId === retro.id || updatingId === retro.id}
                                                />
                                            )}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {retro.employee ? 
                                                `${retro.employee.Lname}, ${retro.employee.Fname}` : 
                                                'Unknown employee'}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {retro.employee?.idno || 'N/A'}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {retro.employee?.Department || 'No Dept'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {retro.retro_type ? retro.retro_type.charAt(0).toUpperCase() + retro.retro_type.slice(1) : 'N/A'}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {retro.adjustment_type ? retro.adjustment_type.charAt(0).toUpperCase() + retro.adjustment_type.slice(1) : ''}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {retro.retro_date ? formatDate(retro.retro_date) : 'N/A'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            Original: {formatCurrency(retro.original_value || 0)}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            Requested: {formatCurrency(retro.requested_value || 0)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <RetroStatusBadge status={retro.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {retro.approver ? retro.approver.name : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-2">
                                            <button
                                                onClick={() => handleViewDetail(retro)}
                                                className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                                disabled={processing || localProcessing || updatingId === retro.id}
                                            >
                                                View
                                            </button>
                                            
                                            {(retro.status === 'pending' && 
                                              (userRoles.isSuperAdmin || 
                                               retro.employee_id === userRoles.employeeId || 
                                               (userRoles.isDepartmentManager && 
                                                userRoles.managedDepartments?.includes(retro.employee?.Department)))) && (
                                                <button
                                                    onClick={() => handleDelete(retro.id)}
                                                    className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors duration-200"
                                                    disabled={processing || localProcessing || deletingId === retro.id}
                                                >
                                                    {deletingId === retro.id ? (
                                                        <>
                                                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                            Deleting...
                                                        </>
                                                    ) : (
                                                        'Delete'
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Footer with summary information */}
            <div className="px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
                <div className="flex justify-between items-center">
                    <div>
                        Showing {filteredRetros.length} of {localRetros.length} retro requests
                        {selectedIds.length > 0 && (
                            <span className="ml-4 text-indigo-600 font-medium">
                                {selectedIds.length} selected
                            </span>
                        )}
                    </div>
                    
                    {/* Processing indicator */}
                    {(processing || localProcessing) && (
                        <div className="flex items-center text-indigo-600">
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            <span className="text-xs">
                                {processing ? 'Processing...' : 'Updating...'}
                            </span>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Detail Modal */}
            {showModal && selectedRetro && (
                <RetroDetailModal
                    retro={selectedRetro}
                    onClose={handleCloseModal}
                    onStatusUpdate={handleStatusUpdate}
                    userRoles={userRoles}
                    viewOnly={processing || localProcessing}
                    processing={updatingId === selectedRetro.id}
                />
            )}

            {/* Bulk Action Modal */}
            {showBulkActionModal && (
                <RetroBulkActionModal
                    selectedCount={selectedIds.length} 
                    onClose={handleCloseBulkActionModal}
                    onSubmit={handleBulkStatusUpdate}
                    userRoles={userRoles}
                />
            )}
        </div>
    );
};

export default RetroList;