import React, { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import RetroList from './RetroList';
import RetroForm from './RetroForm';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { DollarSign, Plus, ListFilter } from 'lucide-react';

const RetroPage = () => {
    const { props } = usePage();
    const { auth, flash = {}, userRoles = {}, retros = [], employees = [], departments = [] } = props;
    
    // State to manage component data
    const [retroData, setRetroData] = useState(retros);
    const [activeTab, setActiveTab] = useState('create'); // Start with list view instead of create
    const [processing, setProcessing] = useState(false);
    
    // Display flash messages
    useEffect(() => {
        if (flash && flash.message) {
            toast.success(flash.message);
        }
        if (flash && flash.error) {
            toast.error(flash.error);
        }
        if (flash && flash.errors) {
            // Handle validation errors
            Object.keys(flash.errors).forEach(key => {
                if (Array.isArray(flash.errors[key])) {
                    flash.errors[key].forEach(error => toast.error(error));
                } else {
                    toast.error(flash.errors[key]);
                }
            });
        }
    }, [flash]);
    
    // Handle form submission
    const handleSubmitRetro = (formData) => {
        setProcessing(true);
        
        router.post(route('retro.store'), formData, {
            onSuccess: (page) => {
                // Update retros list with the new data from the response
                if (page.props.retros) {
                    setRetroData(page.props.retros);
                }
                toast.success('Retro requests created successfully');
                setActiveTab('list'); // Switch to list view after successful creation
                setProcessing(false);
            },
            onError: (errors) => {
                console.error('Submission errors:', errors);
                if (errors && typeof errors === 'object') {
                    Object.keys(errors).forEach(key => {
                        if (Array.isArray(errors[key])) {
                            errors[key].forEach(error => toast.error(error));
                        } else {
                            toast.error(errors[key]);
                        }
                    });
                } else {
                    toast.error('An error occurred while submitting form');
                }
                setProcessing(false);
            }
        });
    };
    
    // Handle status updates (approve/reject)
    const handleStatusUpdate = (id, data) => {
        if (processing) return;
        
        setProcessing(true);
        
        router.post(route('retro.updateStatus', id), data, {
            preserveScroll: true,
            onSuccess: (page) => {
                // Update retros list
                if (page.props.retros) {
                    setRetroData(page.props.retros);
                } else {
                    // Update the specific item in the state
                    setRetroData(prevData => 
                        prevData.map(item => 
                            item.id === id 
                                ? { ...item, status: data.status, remarks: data.remarks, approved_at: new Date().toISOString() }
                                : item
                        )
                    );
                }
                toast.success('Retro status updated successfully');
                setProcessing(false);
            },
            onError: (errors) => {
                console.error('Status update errors:', errors);
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
    const handleDeleteRetro = (id) => {
        if (processing) return;
        
        if (confirm('Are you sure you want to delete this retro request?')) {
            setProcessing(true);
            
            router.delete(route('retro.destroy', id), {
                preserveScroll: true,
                onSuccess: (page) => {
                    // Update retros list
                    if (page.props.retros) {
                        setRetroData(page.props.retros);
                    } else {
                        // Remove the deleted item from the current state
                        setRetroData(prevData => prevData.filter(retro => retro.id !== id));
                    }
                    toast.success('Retro request deleted successfully');
                    setProcessing(false);
                },
                onError: (errors) => {
                    console.error('Delete errors:', errors);
                    toast.error('Failed to delete retro request');
                    setProcessing(false);
                }
            });
        }
    };
    
    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Retro Management" />
            
            <div className="flex min-h-screen bg-gray-50">
                {/* Include the Sidebar */}
                <Sidebar />
                
                {/* Main Content */}
                <div className="flex-1 p-8 ml-0">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                                    {/* <DollarSign className="inline-block w-7 h-7 mr-2 text-indigo-600" /> */}
                                    ₱
                                    Retro Management
                                </h1>
                                <p className="text-gray-600">
                                    Manage retrospective adjustments and corrections
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
                                                    activeTab === 'create'
                                                        ? 'border-indigo-500 text-indigo-600'
                                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                                                onClick={() => setActiveTab('create')}
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                New Retro Request
                                            </button>

                                            <button
                                                className={`${
                                                    activeTab === 'list'
                                                        ? 'border-indigo-500 text-indigo-600'
                                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                                                onClick={() => setActiveTab('list')}
                                            >
                                                <ListFilter className="w-4 h-4 mr-2" />
                                                View Retro Requests
                                                <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                                                        {retroData.length}
                                                </span>
                                            </button>
                                            
                                        </nav>
                                    </div>
                                </div>
                                
                                {activeTab === 'list' ? (
                                    <RetroList 
                                        retros={retroData} 
                                        onStatusUpdate={handleStatusUpdate}
                                        onDelete={handleDeleteRetro}
                                        userRoles={userRoles}
                                        processing={processing}
                                    />
                                ) : (
                                    <RetroForm 
                                        employees={employees} 
                                        departments={departments} 
                                        onSubmit={handleSubmitRetro}
                                        processing={processing}
                                    />
                                )}
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
            />
        </AuthenticatedLayout>
    );
};

export default RetroPage;