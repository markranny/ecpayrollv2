// resources/js/Pages/TravelOrder/TravelOrderBulkActionModal.jsx
import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { toast } from 'react-toastify';
import { Loader2, MapPin, CheckCircle, XCircle, Clock } from 'lucide-react';

const TravelOrderBulkActionModal = ({ selectedCount, onClose, onSubmit, userRoles = {} }) => {
    const [status, setStatus] = useState('approved');
    const [remarks, setRemarks] = useState('');
    const [processing, setProcessing] = useState(false);
    const [showSuccessImage, setShowSuccessImage] = useState(false);

    const handleSubmit = () => {
        if (processing) return;

        // Validation for rejected status
        if (status === 'rejected' && !remarks.trim()) {
            alert('Please provide remarks for rejection');
            return;
        }

        // Validation for force approval
        if (status === 'force_approved' && !remarks.trim()) {
            alert('Please provide remarks for force approval');
            return;
        }

        setProcessing(true);
        
        // Ensure selectedCount is properly converted to an array if it's a JSON string
        const travelOrderIds = Array.isArray(selectedCount) ? selectedCount : 
                               typeof selectedCount === 'string' && selectedCount.startsWith('[') ? 
                               JSON.parse(selectedCount) : [selectedCount];
        
        router.post(route('travel-orders.bulkUpdateStatus'), {
            travel_order_ids: travelOrderIds,
            status: status,
            remarks: remarks
        }, {
            preserveScroll: true,
            onSuccess: () => {
                // Display success message based on the status
                const actionText = status === 'rejected' 
                    ? 'rejected' 
                    : status === 'force_approved' 
                        ? 'force approved' 
                        : status === 'completed'
                            ? 'marked as completed'
                            : status === 'cancelled'
                                ? 'cancelled'
                                : 'approved';
                    
                // Show success image
                setShowSuccessImage(true);
                
                // Show success toast
                toast.success(`Successfully ${actionText} ${Array.isArray(travelOrderIds) ? travelOrderIds.length : 1} travel order${Array.isArray(travelOrderIds) && travelOrderIds.length !== 1 ? 's' : ''}`);
                
                // Close modal and reload after a delay
                setTimeout(() => {
                    onClose();
                    setProcessing(false);
                    window.location.reload();
                }, 2000);
            },
            onError: (errors) => {
                console.error('Error in bulk action:', errors);
                toast.error('Failed to process bulk action. Please try again.');
                setProcessing(false);
            }
        });
    };

    // Get action button properties based on status
    const getActionButtonProps = () => {
        switch (status) {
            case 'approved':
                return {
                    className: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
                    text: 'Approve All',
                    icon: CheckCircle
                };
            case 'rejected':
                return {
                    className: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
                    text: 'Reject All',
                    icon: XCircle
                };
            case 'completed':
                return {
                    className: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
                    text: 'Mark All Completed',
                    icon: CheckCircle
                };
            case 'cancelled':
                return {
                    className: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500',
                    text: 'Cancel All',
                    icon: XCircle
                };
            case 'force_approved':
                return {
                    className: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500',
                    text: 'Force Approve All',
                    icon: CheckCircle
                };
            default:
                return {
                    className: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500',
                    text: 'Update All',
                    icon: Clock
                };
        }
    };

    const actionProps = getActionButtonProps();
    const ActionIcon = actionProps.icon;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative">
                    
                    {/* Processing Overlay */}
                    {processing && !showSuccessImage && (
                        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
                            <div className="text-center">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-600" />
                                <p className="text-sm text-gray-600">Processing bulk action...</p>
                                <p className="text-xs text-gray-500 mt-1">Please wait, this may take a moment.</p>
                            </div>
                        </div>
                    )}
                    
                    {showSuccessImage ? (
                        // Success state
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 text-center">
                            <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 mb-4">
                                <svg className="h-16 w-16 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg leading-6 font-medium text-gray-900">
                                Bulk Action Successful!
                            </h3>
                            <p className="mt-2 text-sm text-gray-500">
                                The selected travel orders have been processed.
                            </p>
                            <div className="mt-3">
                                <div className="bg-green-50 p-3 rounded-md">
                                    <p className="text-sm text-green-700">
                                        Refreshing the travel order list...
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Form state
                        <>
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                                        <MapPin className="h-6 w-6 text-indigo-600" />
                                    </div>
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                                            Bulk Update {Array.isArray(selectedCount) ? selectedCount.length : 
                                                      typeof selectedCount === 'string' && selectedCount.startsWith('[') ? 
                                                      JSON.parse(selectedCount).length : selectedCount} Travel Order{selectedCount !== 1 ? 's' : ''}
                                        </h3>
                                        <div className="mt-4">
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Action to Perform
                                                </label>
                                                <div className="flex flex-col space-y-2">
                                                    <label className="inline-flex items-center">
                                                        <input
                                                            type="radio"
                                                            className="form-radio text-green-600"
                                                            name="status"
                                                            value="approved"
                                                            checked={status === 'approved'}
                                                            onChange={() => setStatus('approved')}
                                                            disabled={processing}
                                                        />
                                                        <span className="ml-2 text-gray-700">Approve</span>
                                                    </label>
                                                    <label className="inline-flex items-center">
                                                        <input
                                                            type="radio"
                                                            className="form-radio text-red-600"
                                                            name="status"
                                                            value="rejected"
                                                            checked={status === 'rejected'}
                                                            onChange={() => setStatus('rejected')}
                                                            disabled={processing}
                                                        />
                                                        <span className="ml-2 text-gray-700">Reject</span>
                                                    </label>
                                                    <label className="inline-flex items-center">
                                                        <input
                                                            type="radio"
                                                            className="form-radio text-blue-600"
                                                            name="status"
                                                            value="completed"
                                                            checked={status === 'completed'}
                                                            onChange={() => setStatus('completed')}
                                                            disabled={processing}
                                                        />
                                                        <span className="ml-2 text-gray-700">Mark as Completed</span>
                                                    </label>
                                                    <label className="inline-flex items-center">
                                                        <input
                                                            type="radio"
                                                            className="form-radio text-gray-600"
                                                            name="status"
                                                            value="cancelled"
                                                            checked={status === 'cancelled'}
                                                            onChange={() => setStatus('cancelled')}
                                                            disabled={processing}
                                                        />
                                                        <span className="ml-2 text-gray-700">Cancel</span>
                                                    </label>
                                                    
                                                    {/* Force Approve option for superadmins only */}
                                                    {userRoles && userRoles.isSuperAdmin && (
                                                        <label className="inline-flex items-center">
                                                            <input
                                                                type="radio"
                                                                className="form-radio text-purple-600"
                                                                name="status"
                                                                value="force_approved"
                                                                checked={status === "force_approved"}
                                                                onChange={() => setStatus("force_approved")}
                                                                disabled={processing}
                                                            />
                                                            <span className="ml-2 text-gray-700">Force Approve (Admin Override)</span>
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Warning message for force approval */}
                                            {status === 'force_approved' && (
                                                <div className="mb-4 bg-yellow-50 p-3 rounded-md">
                                                    <div className="flex">
                                                        <div className="flex-shrink-0">
                                                            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                        <div className="ml-3">
                                                            <p className="text-sm text-yellow-700">
                                                                Force approving will bypass normal approval workflow. This action will be logged.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Warning message for cancellation */}
                                            {status === 'cancelled' && (
                                                <div className="mb-4 bg-red-50 p-3 rounded-md">
                                                    <div className="flex">
                                                        <div className="flex-shrink-0">
                                                            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                        <div className="ml-3">
                                                            <p className="text-sm text-red-700">
                                                                Cancelling travel orders cannot be undone. Please ensure this is the correct action.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Remarks {(status === 'rejected' || status === 'force_approved' || status === 'cancelled') && <span className="text-red-500">*</span>}
                                                </label>
                                                <textarea
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                    rows={3}
                                                    value={remarks}
                                                    onChange={(e) => setRemarks(e.target.value)}
                                                    placeholder={`Enter remarks for travel order ${status === 'rejected' ? 'rejection' : status === 'cancelled' ? 'cancellation' : 'update'}`}
                                                    disabled={processing}
                                                ></textarea>
                                                {status === 'rejected' && (
                                                    <p className="mt-1 text-sm text-gray-500">
                                                        Remarks are required when rejecting travel orders
                                                    </p>
                                                )}
                                                {status === 'force_approved' && (
                                                    <p className="mt-1 text-sm text-gray-500">
                                                        Please provide a reason for the administrative override
                                                    </p>
                                                )}
                                                {status === 'cancelled' && (
                                                    <p className="mt-1 text-sm text-gray-500">
                                                        Please provide a reason for cancelling these travel orders
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    type="button"
                                    className={`w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 ${actionProps.className} text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                                    onClick={handleSubmit}
                                    disabled={processing || ((status === 'rejected' || status === 'force_approved' || status === 'cancelled') && !remarks.trim())}
                                >
                                    {processing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <ActionIcon className="h-4 w-4 mr-2" />
                                            {actionProps.text}
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                                    onClick={onClose}
                                    disabled={processing}
                                >
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TravelOrderBulkActionModal;