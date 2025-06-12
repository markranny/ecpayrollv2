import React, { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import CancelRestDayList from './CancelRestDayList';
import CancelRestDayForm from './CancelRestDayForm';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Ban, Plus, ListFilter } from 'lucide-react';

const CancelRestDayPage = () => {
    const { props } = usePage();
    const { auth, flash = {}, userRoles = {}, cancelRestDays = [], employees = [], departments = [] } = props;
    
    // State to manage component data
    const [cancelRestDayData, setCancelRestDayData] = useState(cancelRestDays);
    const [activeTab, setActiveTab] = useState('create');
    const [processing, setProcessing] = useState(false);
    
    // Display flash messages
    useEffect(() => {
        if (flash && flash.message) {
            toast.success(flash.message);
        }
        if (flash && flash.error) {
            toast.error(flash.error);
        }
    }, [flash]);
    
    // Handle form submission
    const handleSubmitCancelRestDay = (formData) => {
        router.post(route('cancel-rest-days.store'), formData, {
            onSuccess: (page) => {
                // Update cancel rest days list with the new data from the response
                if (page.props.cancelRestDays) {
                    setCancelRestDayData(page.props.cancelRestDays);
                }
                toast.success('Cancel rest day requests created successfully');
                /* setActiveTab('list');  */
            },
            onError: (errors) => {
                if (errors && typeof errors === 'object') {
                    Object.keys(errors).forEach(key => {
                        toast.error(errors[key]);
                    });
                } else {
                    toast.error('An error occurred while submitting form');
                }
            }
        });
    };
    
    // Handle status updates (approve/reject)
    const handleStatusUpdate = (id, data) => {
        if (processing) return;
        
        setProcessing(true);
        
        router.post(route('cancel-rest-days.updateStatus', id), data, {
            preserveScroll: true,
            onSuccess: (page) => {
                // Update cancel rest days list
                if (page.props.cancelRestDays) {
                    setCancelRestDayData(page.props.cancelRestDays);
                }
                toast.success('Cancel rest day status updated successfully');
                setProcessing(false);
            },
            onError: (errors) => {
                let errorMessage = 'An error occurred while updating status';
                if (errors && typeof errors === 'object') {
                    errorMessage = Object.values(errors).join(', ');
                }
                toast.error(errorMessage);
                setProcessing(false);
            }
        });
    };
    
    // Handle deletion
    const handleDeleteCancelRestDay = (id) => {
        if (confirm('Are you sure you want to delete this cancel rest day request?')) {
            router.delete(route('cancel-rest-days.destroy', id), {
                preserveScroll: true,
                onSuccess: (page) => {
                    // Update cancel rest days list
                    if (page.props.cancelRestDays) {
                        setCancelRestDayData(page.props.cancelRestDays);
                    } else {
                        // Remove the deleted item from the current state
                        setCancelRestDayData(cancelRestDayData.filter(crd => crd.id !== id));
                    }
                    toast.success('Cancel rest day request deleted successfully');
                },
                onError: () => toast.error('Failed to delete cancel rest day request')
            });
        }
    };
    
    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Cancel Rest Day Management" />
            
            <div className="flex min-h-screen bg-gray-50">
                {/* Include the Sidebar */}
                <Sidebar />
                
                {/* Main Content */}
                <div className="flex-1 p-8 ml-0">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                    <Ban className="inline-block w-7 h-7 mr-2 text-red-600" />
                                    Cancel Rest Day Management
                                </h1>
                                <p className="text-gray-600">
                                    Manage employee rest day cancellation requests
                                </p>
                            </div>
                        </div>
                
                        <div className="bg-white overflow-hidden shadow-sm rounded-lg">
                            <div className="p-6 bg-white border-b border-gray-200">
                                <div className="mb-6">
                                    <div className="border-b border-gray-200">
                                        <nav className="-mb-px flex space-x-8">
                                            <button
                                                className={`${
                                                    activeTab === 'list'
                                                        ? 'border-red-500 text-red-600'
                                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                                                onClick={() => setActiveTab('list')}
                                            >
                                                <ListFilter className="w-4 h-4 mr-2" />
                                                View Cancel Requests
                                            </button>
                                            <button
                                                className={`${
                                                    activeTab === 'create'
                                                        ? 'border-red-500 text-red-600'
                                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                                                onClick={() => setActiveTab('create')}
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                New Cancel Request
                                            </button>
                                        </nav>
                                    </div>
                                </div>
                                
                                {activeTab === 'list' ? (
                                    <CancelRestDayList 
                                        cancelRestDays={cancelRestDayData} 
                                        onStatusUpdate={handleStatusUpdate}
                                        onDelete={handleDeleteCancelRestDay}
                                        userRoles={userRoles}
                                    />
                                ) : (
                                    <CancelRestDayForm 
                                        employees={employees} 
                                        departments={departments} 
                                        onSubmit={handleSubmitCancelRestDay}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <ToastContainer position="top-right" autoClose={3000} />
        </AuthenticatedLayout>
    );
};

export default CancelRestDayPage;