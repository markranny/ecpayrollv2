// resources/js/Pages/TravelOrder/TravelOrderPage.jsx
import React, { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import TravelOrderList from './TravelOrderList';
import TravelOrderForm from './TravelOrderForm';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { MapPin, Plus, ListFilter, Loader2 } from 'lucide-react';

const TravelOrderPage = () => {
    const { props } = usePage();
    const { auth, flash = {}, userRoles = {}, travelOrders = [], employees = [], departments = [], transportationTypes = [] } = props;
    
    // State to manage component data
    const [travelOrderData, setTravelOrderData] = useState(travelOrders);
    const [activeTab, setActiveTab] = useState('create'); // Default to create tab
    const [processing, setProcessing] = useState(false);
    const [globalLoading, setGlobalLoading] = useState(false);
    
    // Display flash messages with proper null checking
    useEffect(() => {
        if (flash && flash.message) {
            toast.success(flash.message);
        }
        if (flash && flash.error) {
            toast.error(flash.error);
        }
    }, [flash]);
    
    // Handle form submission with proper async handling
    const handleSubmitTravelOrder = (formData) => {
        return new Promise((resolve, reject) => {
            setProcessing(true);
            setGlobalLoading(true);
            
            router.post(route('travel-orders.store'), formData, {
                preserveScroll: true,
                onStart: () => {
                    // Optional: Additional loading state management
                },
                onSuccess: (page) => {
                    // Update travel orders list with the new data from the response
                    if (page.props.travelOrders) {
                        setTravelOrderData(page.props.travelOrders);
                    }
                    
                    toast.success('Travel orders created successfully');
                    setActiveTab('list'); // Switch to list view after successful submission
                    setProcessing(false);
                    setGlobalLoading(false);
                    resolve(page);
                },
                onError: (errors) => {
                    setProcessing(false);
                    setGlobalLoading(false);
                    
                    if (errors && typeof errors === 'object') {
                        Object.keys(errors).forEach(key => {
                            toast.error(errors[key]);
                        });
                    } else {
                        toast.error('An error occurred while submitting form');
                    }
                    reject(errors);
                },
                onFinish: () => {
                    setProcessing(false);
                    setGlobalLoading(false);
                }
            });
        });
    };
    
    // Handle status updates (approve/reject) with loading states
    const handleStatusUpdate = (id, data) => {
        if (processing) return Promise.reject('Already processing');
        
        console.log("Status update called with:", id, data);
        setProcessing(true);

        return new Promise((resolve, reject) => {
            router.post(route('travel-orders.updateStatus', id), data, {
                preserveScroll: true,
                onSuccess: (page) => {
                    // Update travel orders list with the new data
                    if (page.props.travelOrders) {
                        setTravelOrderData(page.props.travelOrders);
                    }
                    resolve(page);
                },
                onError: (errors) => {
                    let errorMessage = 'An error occurred while updating status';
                    if (errors && typeof errors === 'object') {
                        errorMessage = Object.values(errors).join(', ');
                    }
                    reject(errorMessage);
                }
            });
        })
        .then(() => {
            toast.success('Travel order status updated successfully');
            setProcessing(false);
        })
        .catch(error => {
            toast.error(error);
            setProcessing(false);
            throw error;
        });
    };
    
    // Handle travel order deletion with loading state
    const handleDeleteTravelOrder = (id) => {
        if (confirm('Are you sure you want to delete this travel order?')) {
            setProcessing(true);
            
            router.delete(route('travel-orders.destroy', id), {
                preserveScroll: true,
                onSuccess: (page) => {
                    // Update travel orders list with the new data
                    if (page.props.travelOrders) {
                        setTravelOrderData(page.props.travelOrders);
                    } else {
                        // Remove the deleted item from the current state if not provided in response
                        setTravelOrderData(travelOrderData.filter(to => to.id !== id));
                    }
                    toast.success('Travel order deleted successfully');
                    setProcessing(false);
                },
                onError: () => {
                    toast.error('Failed to delete travel order');
                    setProcessing(false);
                },
                onFinish: () => {
                    setProcessing(false);
                }
            });
        }
    };
    
    // Handle tab switching with loading state
    const handleTabSwitch = (tab) => {
        if (processing) return; // Prevent tab switching during operations
        setActiveTab(tab);
    };
    
    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Travel Order Management" />
            
            <div className="flex min-h-screen bg-gray-50">
                {/* Include the Sidebar */}
                <Sidebar />
                
                {/* Global Loading Overlay */}
                {globalLoading && (
                    <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-lg text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-indigo-600" />
                            <p className="text-gray-700">Processing travel orders...</p>
                        </div>
                    </div>
                )}
                
                {/* Main Content */}
                <div className="flex-1 p-8 ml-0">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                    <MapPin className="inline-block w-7 h-7 mr-2 text-indigo-600" />
                                    Travel Order Management
                                </h1>
                                <p className="text-gray-600">
                                    Manage employee travel orders and approvals
                                </p>
                            </div>
                            
                            {/* Processing indicator */}
                            {processing && (
                                <div className="flex items-center text-indigo-600">
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    <span className="text-sm">Processing...</span>
                                </div>
                            )}
                        </div>
                
                        <div className="bg-white overflow-hidden shadow-sm rounded-lg">
                            <div className="p-6 bg-white border-b border-gray-200">
                                <div className="mb-6">
                                    <div className="border-b border-gray-200">
                                        <nav className="-mb-px flex space-x-8">
                                            <button
                                                className={`${
                                                    activeTab === 'list'
                                                        ? 'border-indigo-500 text-indigo-600'
                                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors ${
                                                    processing ? 'opacity-50 cursor-not-allowed' : ''
                                                }`}
                                                onClick={() => handleTabSwitch('list')}
                                                disabled={processing}
                                            >
                                                <ListFilter className="w-4 h-4 mr-2" />
                                                View Travel Orders
                                                {travelOrderData.length > 0 && (
                                                    <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                                                        {travelOrderData.length}
                                                    </span>
                                                )}
                                            </button>
                                            <button
                                                className={`${
                                                    activeTab === 'create'
                                                        ? 'border-indigo-500 text-indigo-600'
                                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors ${
                                                    processing ? 'opacity-50 cursor-not-allowed' : ''
                                                }`}
                                                onClick={() => handleTabSwitch('create')}
                                                disabled={processing}
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                File New Travel Order
                                            </button>
                                        </nav>
                                    </div>
                                </div>
                                
                                <div className={`transition-opacity duration-200 ${processing ? 'opacity-50' : ''}`}>
                                    {activeTab === 'list' ? (
                                        <TravelOrderList 
                                            travelOrders={travelOrderData} 
                                            onStatusUpdate={handleStatusUpdate}
                                            onDelete={handleDeleteTravelOrder}
                                            userRoles={userRoles}
                                            processing={processing}
                                        />
                                    ) : (
                                        <TravelOrderForm 
                                            employees={employees} 
                                            departments={departments} 
                                            transportationTypes={transportationTypes}
                                            onSubmit={handleSubmitTravelOrder}
                                            processing={processing}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <ToastContainer 
                position="top-right" 
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
            />
        </AuthenticatedLayout>
    );
};

export default TravelOrderPage;