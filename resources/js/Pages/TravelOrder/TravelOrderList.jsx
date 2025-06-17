import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Download, Search, X, Filter, Loader2, MapPin, Calendar, Clock } from 'lucide-react';
import TravelOrderStatusBadge from './StatusBadge';
import TravelOrderDetailModal from './TravelOrderDetailModal';
import TravelOrderBulkActionModal from './MultiBulkActionModal';
import TravelOrderForceApproveButton from './TravelOrderForceApproveButton';
import { router } from '@inertiajs/react';
import { toast } from 'react-toastify';

const TravelOrderList = ({ 
    travelOrders, 
    onStatusUpdate, 
    onDelete, 
    refreshInterval = 5000,
    userRoles = {},
    processing = false
}) => {
    const [selectedTravelOrder, setSelectedTravelOrder] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState('');
    const [filteredTravelOrders, setFilteredTravelOrders] = useState(travelOrders || []);
    const [localTravelOrders, setLocalTravelOrders] = useState(travelOrders || []);
    const timerRef = useRef(null);
    
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
        if (!travelOrders) return;
        setLocalTravelOrders(travelOrders);
        applyFilters(travelOrders, filterStatus, searchTerm, dateRange);
    }, [travelOrders]);
    
    // Set up auto-refresh timer
    useEffect(() => {
        const refreshData = async () => {
            try {
                if (typeof window.refreshTravelOrders === 'function') {
                    const freshData = await window.refreshTravelOrders();
                    setLocalTravelOrders(freshData);
                    applyFilters(freshData, filterStatus, searchTerm, dateRange);
                }
            } catch (error) {
                console.error('Error refreshing travel order data:', error);
            }
        };
        
        if (!processing && !localProcessing) {
            timerRef.current = setInterval(refreshData, refreshInterval);
        }
        
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [refreshInterval, filterStatus, searchTerm, dateRange, processing, localProcessing]);
    
    // Function to apply all filters
    const applyFilters = (data, status, search, dates) => {
        let result = [...data];
        
        // Apply status filter
        if (status) {
            result = result.filter(to => to.status === status);
        }
        
        // Apply search filter
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(to => 
                // Search by employee name
                (to.employee && 
                    ((to.employee.Fname && to.employee.Fname.toLowerCase().includes(searchLower)) || 
                     (to.employee.Lname && to.employee.Lname.toLowerCase().includes(searchLower)))) ||
                // Search by employee ID
                (to.employee && to.employee.idno && to.employee.idno.toString().includes(searchLower)) ||
                // Search by department
                (to.employee && to.employee.Department && to.employee.Department.toLowerCase().includes(searchLower)) ||
                // Search by destination
                (to.destination && to.destination.toLowerCase().includes(searchLower)) ||
                // Search by purpose
                (to.purpose && to.purpose.toLowerCase().includes(searchLower))
            );
        }
        
        // Apply date range filter
        if (dates.from && dates.to) {
            result = result.filter(to => {
                if (!to.start_date) return false;
                const startDate = new Date(to.start_date);
                const fromDate = new Date(dates.from);
                const toDate = new Date(dates.to);
                toDate.setHours(23, 59, 59);
                
                return startDate >= fromDate && startDate <= toDate;
            });
        } else if (dates.from) {
            result = result.filter(to => {
                if (!to.start_date) return false;
                const startDate = new Date(to.start_date);
                const fromDate = new Date(dates.from);
                return startDate >= fromDate;
            });
        } else if (dates.to) {
            result = result.filter(to => {
                if (!to.start_date) return false;
                const startDate = new Date(to.start_date);
                const toDate = new Date(dates.to);
                toDate.setHours(23, 59, 59);
                return startDate <= toDate;
            });
        }
        
        setFilteredTravelOrders(result);
        return result;
    };
    
    // Handle status filter change
    const handleStatusFilterChange = (e) => {
        if (processing || localProcessing) return;
        const status = e.target.value;
        setFilterStatus(status);
        applyFilters(localTravelOrders, status, searchTerm, dateRange);
    };
    
    // Handle search input change
    const handleSearchChange = (e) => {
        if (processing || localProcessing) return;
        const value = e.target.value;
        setSearchTerm(value);
        applyFilters(localTravelOrders, filterStatus, value, dateRange);
    };
    
    // Handle date range changes
    const handleDateRangeChange = (field, value) => {
        if (processing || localProcessing) return;
        const newDateRange = { ...dateRange, [field]: value };
        setDateRange(newDateRange);
        applyFilters(localTravelOrders, filterStatus, searchTerm, newDateRange);
    };
    
    // Clear all filters
    const clearFilters = () => {
        if (processing || localProcessing) return;
        setFilterStatus('');
        setSearchTerm('');
        setDateRange({ from: '', to: '' });
        applyFilters(localTravelOrders, '', '', { from: '', to: '' });
    };
    
    // Open detail modal
    const handleViewDetail = (travelOrder) => {
        if (processing || localProcessing) return;
        
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        
        setSelectedTravelOrder(travelOrder);
        setShowModal(true);
    };
    
    // Close detail modal
    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedTravelOrder(null);
        
        if (!processing && !localProcessing) {
            const refreshData = async () => {
                try {
                    if (typeof window.refreshTravelOrders === 'function') {
                        const freshData = await window.refreshTravelOrders();
                        setLocalTravelOrders(freshData);
                        applyFilters(freshData, filterStatus, searchTerm, dateRange);
                    }
                } catch (error) {
                    console.error('Error refreshing travel order data:', error);
                }
            };
            
            timerRef.current = setInterval(refreshData, refreshInterval);
        }
    };

// Updated handleDelete function in your TravelOrderList component
const handleDelete = async (id) => {
    if (processing || localProcessing || deletingId) return;
    
    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this travel order? This action cannot be undone.')) {
        return;
    }
    
    setDeletingId(id);
    setLocalProcessing(true);
    
    try {
        if (typeof onDelete === 'function') {
            const result = onDelete(id);
            
            if (result && typeof result.then === 'function') {
                await result;
                
                // Update local state to remove the deleted item
                setLocalTravelOrders(prevOrders => 
                    prevOrders.filter(order => order.id !== id)
                );
                setFilteredTravelOrders(prevFiltered => 
                    prevFiltered.filter(order => order.id !== id)
                );
                setSelectedIds(prevIds => prevIds.filter(itemId => itemId !== id));
                
                console.log('Travel order deleted successfully');
            } else {
                // Update local state for non-promise result
                setLocalTravelOrders(prevOrders => 
                    prevOrders.filter(order => order.id !== id)
                );
                setFilteredTravelOrders(prevFiltered => 
                    prevFiltered.filter(order => order.id !== id)
                );
                setSelectedIds(prevIds => prevIds.filter(itemId => itemId !== id));
            }
        } else {
            // Use the Laravel DELETE route - try the standard approach first
            router.delete(route('travel-orders.destroy', id), {
                preserveScroll: true,
                onSuccess: () => {
                    setLocalTravelOrders(prevOrders => 
                        prevOrders.filter(order => order.id !== id)
                    );
                    setFilteredTravelOrders(prevFiltered => 
                        prevFiltered.filter(order => order.id !== id)
                    );
                    setSelectedIds(prevIds => prevIds.filter(itemId => itemId !== id));
                    
                    console.log('Travel order deleted successfully');
                    toast.success('Travel order deleted successfully');
                },
                onError: (errors) => {
                    console.error('Error deleting travel order:', errors);
                    
                    // If DELETE method fails, try the POST alternative
                    if (errors?.message?.includes('Method Not Allowed') || errors?.message?.includes('DELETE')) {
                        router.post(route('travel-orders.destroy.post', id), {
                            _method: 'DELETE', // Laravel method spoofing
                            preserveScroll: true,
                            onSuccess: () => {
                                setLocalTravelOrders(prevOrders => 
                                    prevOrders.filter(order => order.id !== id)
                                );
                                setFilteredTravelOrders(prevFiltered => 
                                    prevFiltered.filter(order => order.id !== id)
                                );
                                setSelectedIds(prevIds => prevIds.filter(itemId => itemId !== id));
                                
                                console.log('Travel order deleted successfully via POST');
                                toast.success('Travel order deleted successfully');
                            },
                            onError: (postErrors) => {
                                console.error('Error deleting travel order via POST:', postErrors);
                                toast.error('Error: Failed to delete travel order. ' + 
                                    (postErrors?.message || 'Please try again.'));
                            }
                        });
                    } else {
                        toast.error('Error: Failed to delete travel order. ' + 
                            (errors?.message || 'Please try again.'));
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error deleting travel order:', error);
        toast.error('Error: Failed to delete travel order. Please try again.');
    } finally {
        setDeletingId(null);
        setLocalProcessing(false);
    }
};
    
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
                        // Close modal AFTER successful update
                        handleCloseModal();
                    })
                    .catch((error) => {
                        console.error('Error updating status:', error);
                        alert('Error: Unable to update status. Please try again.');
                        setUpdatingId(null);
                        setLocalProcessing(false);
                        // Don't close modal on error - user might want to retry
                    });
            } else {
                setUpdatingId(null);
                setLocalProcessing(false);
                // Close modal if non-promise result (assuming success)
                handleCloseModal();
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error: Unable to update status. Please try again.');
            setUpdatingId(null);
            setLocalProcessing(false);
            // Don't close modal on error
        }
    } else {
        console.error('onStatusUpdate is not a function');
        alert('Error: Unable to update status. Please refresh the page and try again.');
        setUpdatingId(null);
        setLocalProcessing(false);
        // Don't close modal on error
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
    
    const formatTime = (timeString) => {
        if (!timeString) return '-';
        
        try {
            let timeOnly;
            if (timeString.includes('T')) {
                const [, time] = timeString.split('T');
                timeOnly = time.slice(0, 5);
            } else {
                const timeParts = timeString.split(' ');
                timeOnly = timeParts[timeParts.length - 1].slice(0, 5);
            }
            
            const [hours, minutes] = timeOnly.split(':');
            const hourNum = parseInt(hours, 10);
            
            const ampm = hourNum >= 12 ? 'PM' : 'AM';
            const formattedHours = hourNum % 12 || 12;
            
            return `${formattedHours}:${minutes} ${ampm}`;
        } catch (error) {
            console.error('Time formatting error:', error);
            return '-';
        }
    };

    // Multiple selection handlers
    const toggleSelectAll = () => {
        if (processing || localProcessing) return;
        
        setSelectAll(!selectAll);
        if (!selectAll) {
            // Only select appropriate travel orders based on user role
            let selectableIds = [];
            
            if (userRoles.isHrdManager || userRoles.isSuperAdmin) {
                // HRD managers and superadmins can select pending travel orders
                selectableIds = filteredTravelOrders
                    .filter(to => to.status === 'pending')
                    .map(to => to.id);
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
            alert('Please select at least one travel order');
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
        
        // Create data for bulk update
        const data = {
            travel_order_ids: selectedIds,
            status: status,
            remarks: remarks
        };
        
        // Make direct API call using router.post
        router.post(route('travel-orders.bulkUpdateStatus'), data, {
            preserveScroll: true,
            onSuccess: (response) => {
                // Clear selections after successful update
                setSelectedIds([]);
                setSelectAll(false);
                
                // Refresh the data
                router.reload({
                    only: ['travelOrders'],
                    preserveScroll: true,
                    onFinish: () => {
                        setLocalProcessing(false);
                    }
                });
            },
            onError: (errors) => {
                console.error('Error during bulk update:', errors);
                toast.error('Failed to update travel orders: ' + 
                    (errors?.message || 'Unknown error'));
                setLocalProcessing(false);
            }
        });
        
        handleCloseBulkActionModal();
    };

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
        
        const exportUrl = `/travel-orders/export?${queryParams.toString()}`;
        
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

    const canSelectTravelOrder = (travelOrder) => {
        if (userRoles.isSuperAdmin) {
            // Superadmin can select any pending travel order
            return travelOrder.status === 'pending';
        } else if (userRoles.isHrdManager) {
            // HRD managers can select pending travel orders
            return travelOrder.status === 'pending';
        }
        return false;
    };

    // Get selectable items count
    const selectableItemsCount = filteredTravelOrders.filter(to => canSelectTravelOrder(to)).length;

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
                            {processing ? 'Processing travel orders...' : 'Updating data...'}
                        </p>
                    </div>
                </div>
            )}
            
            <div className="p-4 border-b">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                    <h3 className="text-lg font-semibold flex items-center">
                        <MapPin className="h-5 w-5 mr-2 text-indigo-600" />
                        Travel Orders
                    </h3>
                    
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
                            <TravelOrderForceApproveButton 
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
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
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
                            placeholder="Search by name, ID, department, destination, or purpose"
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
                                Travel Period
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Destination
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Duration
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Filed By
                            </th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTravelOrders.length === 0 ? (
                            <tr>
                                <td colSpan={selectableItemsCount > 0 ? "9" : "8"} className="px-6 py-4 text-center text-sm text-gray-500">
                                    {processing || localProcessing ? 'Loading travel orders...' : 'No travel orders found'}
                                </td>
                            </tr>
                        ) : (
                            filteredTravelOrders.map(travelOrder => (
                                <tr key={travelOrder.id} className={`hover:bg-gray-50 transition-colors duration-200 ${
                                    (deletingId === travelOrder.id || updatingId === travelOrder.id) ? 'opacity-50' : ''
                                }`}>
                                    {selectableItemsCount > 0 && (
                                        <td className="px-4 py-4">
                                            {canSelectTravelOrder(travelOrder) && (
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                    checked={selectedIds.includes(travelOrder.id)}
                                                    onChange={() => toggleSelectItem(travelOrder.id)}
                                                    disabled={processing || localProcessing || deletingId === travelOrder.id || updatingId === travelOrder.id}
                                                />
                                            )}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                            {travelOrder.employee ? 
                                                `${travelOrder.employee.Lname}, ${travelOrder.employee.Fname}` : 
                                                'Unknown employee'}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {travelOrder.employee?.idno || 'N/A'}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {travelOrder.employee?.Department || 'No Dept'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 flex items-center">
                                            <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                                            {travelOrder.start_date ? formatDate(travelOrder.start_date) : 'N/A'}
                                            {travelOrder.end_date && travelOrder.start_date !== travelOrder.end_date && (
                                                <span> - {formatDate(travelOrder.end_date)}</span>
                                            )}
                                        </div>
                                        {travelOrder.departure_time && (
                                            <div className="text-sm text-gray-500 flex items-center">
                                                <Clock className="h-3 w-3 mr-1 text-gray-400" />
                                                {formatTime(travelOrder.departure_time)}
                                                {travelOrder.return_time && (
                                                    <span> - {formatTime(travelOrder.return_time)}</span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900 max-w-xs truncate" title={travelOrder.destination}>
                                            {travelOrder.destination}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {travelOrder.transportation_type}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {travelOrder.total_days} day{travelOrder.total_days !== 1 ? 's' : ''}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {travelOrder.working_days} working day{travelOrder.working_days !== 1 ? 's' : ''}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col space-y-1">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                travelOrder.is_full_day 
                                                    ? 'bg-blue-100 text-blue-800' 
                                                    : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {travelOrder.is_full_day ? 'Full Day' : 'Partial Day'}
                                            </span>
                                            {travelOrder.return_to_office && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Return to Office
                                                </span>
                                            )}
                                            {travelOrder.force_approved && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                    Force Approved
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <TravelOrderStatusBadge status={travelOrder.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {travelOrder.creator ? travelOrder.creator.name : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-2">
                                            <button
                                                onClick={() => handleViewDetail(travelOrder)}
                                                className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                                disabled={processing || localProcessing || updatingId === travelOrder.id}
                                            >
                                                View
                                            </button>
                                            
                                            {(travelOrder.status === 'pending' && 
                                              (userRoles.isSuperAdmin || 
                                               travelOrder.created_by === userRoles.userId || 
                                               (userRoles.isDepartmentManager && 
                                                userRoles.managedDepartments?.includes(travelOrder.employee?.Department)))) && (
                                                <button
                                                    onClick={() => handleDelete(travelOrder.id)}
                                                    className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors duration-200"
                                                    disabled={processing || localProcessing || deletingId === travelOrder.id}
                                                >
                                                    {deletingId === travelOrder.id ? (
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
                        Showing {filteredTravelOrders.length} of {localTravelOrders.length} travel orders
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
            {showModal && selectedTravelOrder && (
                <TravelOrderDetailModal
                    travelOrder={selectedTravelOrder}
                    onClose={handleCloseModal}
                    onStatusUpdate={handleStatusUpdate}
                    userRoles={userRoles}
                    viewOnly={processing || localProcessing}
                    processing={updatingId === selectedTravelOrder.id}
                />
            )}

            {/* Bulk Action Modal */}
            {showBulkActionModal && (
                <TravelOrderBulkActionModal
                    selectedCount={selectedIds} 
                    onClose={handleCloseBulkActionModal}
                    onSubmit={handleBulkStatusUpdate}
                    userRoles={userRoles}
                />
            )}
        </div>
    );
};

export default TravelOrderList;