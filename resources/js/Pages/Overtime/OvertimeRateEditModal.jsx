// resources/js/Pages/Overtime/OvertimeRateEditModal.jsx
import React, { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Loader2, Edit3, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';

const OvertimeRateEditModal = ({ 
    isOpen, 
    onClose, 
    overtime, 
    userRoles = {},
    processing = false,
    onRateUpdated = null // Add callback prop
}) => {
    const [formData, setFormData] = useState({
        rate_multiplier: '',
        reason: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    // Initialize form data when modal opens
    useEffect(() => {
        if (isOpen && overtime) {
            setFormData({
                rate_multiplier: overtime.rate_multiplier || '',
                reason: ''
            });
            setErrors({});
        }
    }, [isOpen, overtime]);

    // Check if user can edit rate
    const canEditRate = () => {
        if (!overtime || overtime.status !== 'pending') return false;
        
        return (
            userRoles.isSuperAdmin ||
            userRoles.isHrdManager ||
            userRoles.isDepartmentManager ||
            overtime.created_by === userRoles.userId
        );
    };

    // Handle input changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear specific error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    // Validate form
    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.rate_multiplier) {
            newErrors.rate_multiplier = 'Rate multiplier is required';
        } else {
            const rate = parseFloat(formData.rate_multiplier);
            if (isNaN(rate) || rate < 1 || rate > 10) {
                newErrors.rate_multiplier = 'Rate multiplier must be between 1.0 and 10.0';
            }
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (isSubmitting || processing || !validateForm()) return;
        
        setIsSubmitting(true);
        
        router.post(route('overtimes.updateRate', overtime.id), formData, {
            preserveScroll: true,
            onSuccess: (page) => {
                setIsSubmitting(false);
                
                // Show immediate success feedback
                toast.success('Overtime rate updated successfully');
                
                // Call the callback to refresh the data in parent component
                if (typeof onRateUpdated === 'function') {
                    onRateUpdated(page.props.overtimes || null);
                }
                
                // Close the modal
                //onClose();

                window.location.reload();
            },
            onError: (errors) => {
                setIsSubmitting(false);
                if (typeof errors === 'object') {
                    setErrors(errors);
                } else {
                    setErrors({ general: 'An error occurred while updating the rate' });
                }
            },
            onFinish: () => {
                setIsSubmitting(false);
            }
        });
    };

    // Handle backdrop click
    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget && !isSubmitting && !processing) {
            onClose();
        }
    };

    // Prevent modal content click from closing modal
    const handleModalClick = (e) => {
        e.stopPropagation();
    };

    if (!isOpen || !overtime) return null;

    // Don't show modal if user can't edit or overtime is not pending
    if (!canEditRate()) {
        return null;
    }

    return (
        <div 
            className="fixed inset-0 z-50 overflow-y-auto" 
            onClick={handleBackdropClick}
        >
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                
                <div 
                    className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
                    onClick={handleModalClick}
                >
                    {/* Loading overlay */}
                    {(isSubmitting || processing) && (
                        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                            <div className="text-center">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-600" />
                                <p className="text-sm text-gray-600">Updating overtime rate...</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start">
                                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                                    <Edit3 className="h-6 w-6 text-blue-600" />
                                </div>
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                        Edit Overtime Rate
                                    </h3>
                                    
                                    {/* Employee Info */}
                                    <div className="mb-4 p-3 bg-gray-50 rounded-md">
                                        <div className="text-sm">
                                            <div className="font-medium text-gray-900">
                                                {overtime.employee ? 
                                                    `${overtime.employee.Lname}, ${overtime.employee.Fname}` : 
                                                    'Unknown Employee'}
                                            </div>
                                            <div className="text-gray-500">
                                                {overtime.employee?.idno} • {overtime.employee?.Department}
                                            </div>
                                            <div className="text-gray-500 mt-1">
                                                {overtime.date} • {overtime.total_hours} hours
                                            </div>
                                        </div>
                                    </div>

                                    {/* Warning for pending status */}
                                    <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                                        <div className="flex">
                                            <div className="flex-shrink-0">
                                                <AlertTriangle className="h-5 w-5 text-yellow-400" />
                                            </div>
                                            <div className="ml-3">
                                                <h3 className="text-sm font-medium text-yellow-800">
                                                    Rate Editing Notice
                                                </h3>
                                                <div className="mt-1 text-sm text-yellow-700">
                                                    <p>Rate can only be modified while the overtime is in pending status.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Rate Multiplier Input */}
                                    <div className="mb-4">
                                        <label htmlFor="rate_multiplier" className="block text-sm font-medium text-gray-700 mb-1">
                                            Rate Multiplier <span className="text-red-600">*</span>
                                        </label>
                                        <div className="mt-1 relative">
                                            <input
                                                type="number"
                                                id="rate_multiplier"
                                                name="rate_multiplier"
                                                step="0.001"
                                                min="1.0"
                                                max="10.0"
                                                className={`block w-full rounded-md shadow-sm focus:ring focus:ring-indigo-200 focus:ring-opacity-50 ${
                                                    errors.rate_multiplier 
                                                        ? 'border-red-300 focus:border-red-300' 
                                                        : 'border-gray-300 focus:border-indigo-300'
                                                }`}
                                                value={formData.rate_multiplier}
                                                onChange={handleChange}
                                                placeholder="e.g., 1.25"
                                                disabled={isSubmitting || processing}
                                            />
                                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-gray-500">
                                                x
                                            </div>
                                        </div>
                                        {errors.rate_multiplier && (
                                            <p className="mt-1 text-sm text-red-600">{errors.rate_multiplier}</p>
                                        )}
                                        <p className="mt-1 text-xs text-gray-500">
                                            Enter the overtime rate multiplier (1.0 to 10.0). Current rate: {overtime.rate_multiplier}x
                                        </p>
                                    </div>
                                    
                                    {/* Reason Input */}
                                    <div className="mb-4">
                                        <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                                            Reason for Rate Change
                                        </label>
                                        <textarea
                                            id="reason"
                                            name="reason"
                                            rows={3}
                                            className={`block w-full rounded-md shadow-sm focus:ring focus:ring-indigo-200 focus:ring-opacity-50 ${
                                                errors.reason 
                                                    ? 'border-red-300 focus:border-red-300' 
                                                    : 'border-gray-300 focus:border-indigo-300'
                                            }`}
                                            value={formData.reason}
                                            onChange={handleChange}
                                            placeholder="Optional: Explain why the rate is being changed"
                                            disabled={isSubmitting || processing}
                                        ></textarea>
                                        {errors.reason && (
                                            <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
                                        )}
                                        <p className="mt-1 text-xs text-gray-500">
                                            This reason will be added to the overtime remarks for audit purposes.
                                        </p>
                                    </div>

                                    {/* General Error */}
                                    {errors.general && (
                                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                            <p className="text-sm text-red-600">{errors.general}</p>
                                        </div>
                                    )}

                                    {/* Rate Examples */}
                                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                        <h4 className="text-sm font-medium text-blue-900 mb-2">Common Rate Examples:</h4>
                                        <div className="text-xs text-blue-800 space-y-1">
                                            <div>• 1.25x - Regular weekday overtime</div>
                                            <div>• 1.30x - Rest day work</div>
                                            <div>• 1.69x - Rest day overtime</div>
                                            <div>• 2.00x - Regular holiday work</div>
                                            <div>• 2.60x - Regular holiday overtime</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            <button
                                type="submit"
                                className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                disabled={isSubmitting || processing}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    'Update Rate'
                                )}
                            </button>
                            <button
                                type="button"
                                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-all duration-200"
                                onClick={onClose}
                                disabled={isSubmitting || processing}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default OvertimeRateEditModal;