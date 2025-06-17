import React, { useState } from 'react';
import { X, User, Calendar, DollarSign, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import RetroStatusBadge from './RetroStatusBadge';

const RetroDetailModal = ({ retro, onClose, onStatusUpdate, userRoles = {} }) => {
    const [status, setStatus] = useState('approved');
    const [remarks, setRemarks] = useState('');
    const [processing, setProcessing] = useState(false);

    // Check if user can update status
    const canUpdateStatus = () => {
        if (retro.status !== 'pending') return false;
        
        if (userRoles.isSuperAdmin || userRoles.isHrdManager) {
            return true;
        }
        
        if (userRoles.isDepartmentManager && 
            userRoles.managedDepartments?.includes(retro.employee?.Department)) {
            return true;
        }
        
        return false;
    };

    // Handle status update
    const handleStatusUpdate = () => {
        if (processing) return;
        
        if (status === 'rejected' && !remarks.trim()) {
            alert('Please provide remarks for rejection');
            return;
        }
        
        setProcessing(true);
        
        const data = {
            status: status,
            remarks: remarks
        };
        
        onStatusUpdate(retro.id, data);
        setProcessing(false);
    };

    // Format date safely
    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return 'Invalid date';
        }
    };

    // Format datetime safely
    const formatDateTime = (dateString) => {
        try {
            return new Date(dateString).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return 'Invalid date';
        }
    };

    // Format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'PHP'
        }).format(value || 0);
    };

    // Get employee name
    const getEmployeeName = (employee) => {
        if (!employee) return 'Unknown Employee';
        return `${employee.Lname || ''}, ${employee.Fname || ''}`.trim();
    };

    // Get retro type label
    const getRetroTypeLabel = (type) => {
        const types = {
            'DAYS': 'Regular Days',
            'OVERTIME': 'Overtime Hours',
            'SLVL': 'Sick/Vacation Leave',
            'HOLIDAY': 'Holiday Work',
            'RD_OT': 'Rest Day Overtime'
        };
        return types[type] || type?.charAt(0).toUpperCase() + type?.slice(1);
    };

    // Get adjustment type label
    const getAdjustmentTypeLabel = (type) => {
        const types = {
            'increase': 'Increase',
            'decrease': 'Decrease',
            'correction': 'Correction',
            'backdated': 'Backdated Adjustment'
        };
        return types[type] || type?.charAt(0).toUpperCase() + type?.slice(1);
    };

    // Get unit label
    const getUnitLabel = (retroType) => {
        const units = {
            'DAYS': 'Days',
            'OVERTIME': 'Hours',
            'SLVL': 'Days',
            'HOLIDAY': 'Hours',
            'RD_OT': 'Hours'
        };
        return units[retroType] || 'Units';
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    {/* Header */}
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                                <DollarSign className="h-6 w-6 mr-2 text-indigo-600" />
                                Retro Request Details
                            </h3>
                            <button
                                onClick={onClose}
                                className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Employee Information */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                    <User className="h-5 w-5 mr-2 text-gray-600" />
                                    Employee Information
                                </h4>
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Name:</span>
                                        <span className="ml-2 text-sm text-gray-900">
                                            {getEmployeeName(retro.employee)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Employee ID:</span>
                                        <span className="ml-2 text-sm text-gray-900">
                                            {retro.employee?.idno || 'N/A'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Department:</span>
                                        <span className="ml-2 text-sm text-gray-900">
                                            {retro.employee?.Department || 'N/A'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Position:</span>
                                        <span className="ml-2 text-sm text-gray-900">
                                            {retro.employee?.Jobtitle || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Retro Information */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                    <Calendar className="h-5 w-5 mr-2 text-gray-600" />
                                    Retro Information
                                </h4>
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Type:</span>
                                        <span className="ml-2 text-sm text-gray-900">
                                            {getRetroTypeLabel(retro.retro_type)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Adjustment:</span>
                                        <span className="ml-2 text-sm text-gray-900">
                                            {getAdjustmentTypeLabel(retro.adjustment_type)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Retro Date:</span>
                                        <span className="ml-2 text-sm text-gray-900">
                                            {formatDate(retro.retro_date)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Status:</span>
                                        <span className="ml-2">
                                            <RetroStatusBadge status={retro.status} />
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Time & Rate Information */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                    <Clock className="h-5 w-5 mr-2 text-gray-600" />
                                    Time & Rate Details
                                </h4>
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">
                                            {getUnitLabel(retro.retro_type)}:
                                        </span>
                                        <span className="ml-2 text-sm text-gray-900">
                                            {retro.hours_days || 'N/A'} {getUnitLabel(retro.retro_type)?.toLowerCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Multiplier Rate:</span>
                                        <span className="ml-2 text-sm text-gray-900">
                                            {retro.multiplier_rate ? `${retro.multiplier_rate}x` : 'N/A'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Base Rate:</span>
                                        <span className="ml-2 text-sm text-gray-900">
                                            {retro.base_rate ? formatCurrency(retro.base_rate) : 'N/A'}
                                        </span>
                                    </div>
                                    {retro.hours_days && retro.multiplier_rate && retro.base_rate && (
                                        <div className="mt-3 p-2 bg-blue-50 rounded border">
                                            <div className="text-xs text-blue-600 mb-1">Calculation:</div>
                                            <div className="text-sm text-blue-800">
                                                {retro.hours_days} × {retro.multiplier_rate} × {formatCurrency(retro.base_rate)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Financial Information */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                    <DollarSign className="h-5 w-5 mr-2 text-gray-600" />
                                    Financial Details
                                </h4>
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-sm font-medium text-gray-700">Computed Amount:</span>
                                        <span className="ml-2 text-sm text-gray-900 font-semibold">
                                            {formatCurrency(retro.computed_amount || retro.requested_total_amount)}
                                        </span>
                                    </div>
                                    {retro.original_total_amount !== undefined && (
                                        <div>
                                            <span className="text-sm font-medium text-gray-700">Original Amount:</span>
                                            <span className="ml-2 text-sm text-gray-900">
                                                {formatCurrency(retro.original_total_amount)}
                                            </span>
                                        </div>
                                    )}
                                    {retro.requested_total_amount !== undefined && (
                                        <div>
                                            <span className="text-sm font-medium text-gray-700">Requested Amount:</span>
                                            <span className="ml-2 text-sm text-gray-900">
                                                {formatCurrency(retro.requested_total_amount)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Approval Information */}
                            <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                    <CheckCircle className="h-5 w-5 mr-2 text-gray-600" />
                                    Approval Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div>
                                            <span className="text-sm font-medium text-gray-700">Created By:</span>
                                            <span className="ml-2 text-sm text-gray-900">
                                                {retro.creator?.name || 'System'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-gray-700">Created At:</span>
                                            <span className="ml-2 text-sm text-gray-900">
                                                {formatDateTime(retro.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                    {retro.approved_by && (
                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-sm font-medium text-gray-700">Approved By:</span>
                                                <span className="ml-2 text-sm text-gray-900">
                                                    {retro.approver?.name || 'N/A'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-gray-700">Approved At:</span>
                                                <span className="ml-2 text-sm text-gray-900">
                                                    {formatDateTime(retro.approved_at)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Reason */}
                            <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                    <FileText className="h-5 w-5 mr-2 text-gray-600" />
                                    Reason for Adjustment
                                </h4>
                                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                                    {retro.reason || 'No reason provided'}
                                </p>
                            </div>

                            {/* Remarks */}
                            {retro.remarks && (
                                <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                                    <h4 className="font-medium text-gray-900 mb-3">
                                        Remarks
                                    </h4>
                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                                        {retro.remarks}
                                    </p>
                                </div>
                            )}

                            {/* Status Update Section - Only show if user can update */}
                            {canUpdateStatus() && (
                                <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <h4 className="font-medium text-blue-900 mb-3">
                                        Update Status
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-blue-700 mb-1">
                                                Action
                                            </label>
                                            <div className="flex space-x-4">
                                                <label className="inline-flex items-center">
                                                    <input
                                                        type="radio"
                                                        className="form-radio text-green-600"
                                                        name="status"
                                                        value="approved"
                                                        checked={status === 'approved'}
                                                        onChange={() => setStatus('approved')}
                                                    />
                                                    <span className="ml-2 text-green-700">Approve</span>
                                                </label>
                                                <label className="inline-flex items-center">
                                                    <input
                                                        type="radio"
                                                        className="form-radio text-red-600"
                                                        name="status"
                                                        value="rejected"
                                                        checked={status === 'rejected'}
                                                        onChange={() => setStatus('rejected')}
                                                    />
                                                    <span className="ml-2 text-red-700">Reject</span>
                                                </label>
                                                {userRoles.isSuperAdmin && (
                                                    <label className="inline-flex items-center">
                                                        <input
                                                            type="radio"
                                                            className="form-radio text-purple-600"
                                                            name="status"
                                                            value="force_approved"
                                                            checked={status === 'force_approved'}
                                                            onChange={() => setStatus('force_approved')}
                                                        />
                                                        <span className="ml-2 text-purple-700">Force Approve</span>
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-blue-700 mb-1">
                                                Remarks {status === 'rejected' && <span className="text-red-500">*</span>}
                                            </label>
                                            <textarea
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                                rows={3}
                                                value={remarks}
                                                onChange={(e) => setRemarks(e.target.value)}
                                                placeholder="Enter remarks for this decision"
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        {canUpdateStatus() && (
                            <button
                                type="button"
                                className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 ${
                                    status === 'rejected' 
                                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                                        : status === 'force_approved'
                                        ? 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                                        : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                                } text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm`}
                                onClick={handleStatusUpdate}
                                disabled={processing}
                            >
                                {processing ? 'Processing...' : (
                                    <>
                                        {status === 'rejected' ? (
                                            <><XCircle className="h-4 w-4 mr-1" /> Reject</>
                                        ) : status === 'force_approved' ? (
                                            <><CheckCircle className="h-4 w-4 mr-1" /> Force Approve</>
                                        ) : (
                                            <><CheckCircle className="h-4 w-4 mr-1" /> Approve</>
                                        )}
                                    </>
                                )}
                            </button>
                        )}
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                            disabled={processing}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RetroDetailModal;