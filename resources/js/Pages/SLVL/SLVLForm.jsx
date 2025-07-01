import React, { useState, useEffect } from 'react';
import { format, addDays, differenceInDays } from 'date-fns';
import { Upload, X, FileText, AlertCircle, Calendar, Loader } from 'lucide-react';

const SLVLForm = ({ employees, leaveTypes, payOptions, departments, onSubmit }) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const currentYear = new Date().getFullYear();
    
    // Generate year options (current year ± 3 years)
    const yearOptions = [];
    for (let year = currentYear - 3; year <= currentYear + 3; year++) {
        yearOptions.push(year);
    }
    
    // Form state - Initialize with current year but allow user to change
    const [formData, setFormData] = useState({
        employee_id: '',
        type: '',
        start_date: today,
        end_date: today,
        half_day: false,
        am_pm: 'AM',
        pay_type: 'with_pay',
        reason: '',
        supporting_documents: null,
        bank_year: currentYear // Initialize with current year
    });
    
    // Filtered employees state
    const [filteredEmployees, setFilteredEmployees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [totalDays, setTotalDays] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Bank data state
    const [employeeBankData, setEmployeeBankData] = useState(null);
    const [loadingBankData, setLoadingBankData] = useState(false);
    
    // File upload state
    const [uploadedFile, setUploadedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    
    // Update filtered employees when search or department selection changes
    useEffect(() => {
        let result = employees || [];
        
        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(employee => 
                employee.name.toLowerCase().includes(term) || 
                employee.idno?.toString().includes(term)
            );
        }
        
        // Filter by department
        if (selectedDepartment) {
            result = result.filter(employee => employee.department === selectedDepartment);
        }
        
        setFilteredEmployees(result);
    }, [searchTerm, selectedDepartment, employees]);
    
    // Calculate total days when dates change
    useEffect(() => {
        if (formData.start_date && formData.end_date) {
            if (formData.half_day) {
                setTotalDays(0.5);
            } else {
                const start = new Date(formData.start_date);
                const end = new Date(formData.end_date);
                const days = differenceInDays(end, start) + 1;
                setTotalDays(days);
            }
        }
    }, [formData.start_date, formData.end_date, formData.half_day]);
    
    // Fetch bank data when employee or year changes
    useEffect(() => {
        if (formData.employee_id && formData.bank_year) {
            fetchEmployeeBankData(formData.employee_id, formData.bank_year);
        } else {
            setEmployeeBankData(null);
        }
    }, [formData.employee_id, formData.bank_year]);
    
    // Function to fetch employee bank data for specific year
    const fetchEmployeeBankData = async (employeeId, year) => {
        setLoadingBankData(true);
        try {
            const response = await fetch(`/slvl/bank/${employeeId}?year=${year}`);
            if (!response.ok) {
                throw new Error('Failed to fetch bank data');
            }
            const data = await response.json();
            setEmployeeBankData(data);
        } catch (error) {
            console.error('Error fetching bank data:', error);
            setEmployeeBankData(null);
        } finally {
            setLoadingBankData(false);
        }
    };
    
    // Handle input changes
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = type === 'checkbox' ? checked : value;
        
        // Convert bank_year to integer to ensure proper handling
        if (name === 'bank_year') {
            newValue = parseInt(value, 10);
            console.log('Bank year changed to:', newValue); // Debug log
        }
        
        setFormData({
            ...formData,
            [name]: newValue
        });
        
        // If start date changes and end date is before start date, update end date
        if (name === 'start_date' && formData.end_date < value) {
            setFormData(prev => ({
                ...prev,
                [name]: newValue,
                end_date: value
            }));
        }
        
        // If half day is unchecked, reset am_pm
        if (name === 'half_day' && !checked) {
            setFormData(prev => ({
                ...prev,
                [name]: newValue,
                am_pm: 'AM'
            }));
        }
    };
    
    // Handle file upload
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                alert('File size must be less than 5MB');
                e.target.value = '';
                return;
            }
            
            // Validate file type
            const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.type)) {
                alert('Only PDF, DOC, DOCX, JPG, JPEG, and PNG files are allowed');
                e.target.value = '';
                return;
            }
            
            setUploadedFile(file);
            setFormData({
                ...formData,
                supporting_documents: file
            });
            
            // Create preview for images
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => setFilePreview(e.target.result);
                reader.readAsDataURL(file);
            } else {
                setFilePreview(null);
            }
        }
    };
    
    // Remove uploaded file
    const removeFile = () => {
        setUploadedFile(null);
        setFilePreview(null);
        setFormData({
            ...formData,
            supporting_documents: null
        });
        const fileInput = document.getElementById('supporting_documents');
        if (fileInput) {
            fileInput.value = '';
        }
    };
    
    // Handle employee selection
    const handleEmployeeSelect = (employee) => {
        setFormData({
            ...formData,
            employee_id: employee.id
        });
        setSelectedEmployee(employee);
    };
    
    // Check if current leave type requires documents
    const requiresDocuments = () => {
        const selectedLeaveType = leaveTypes.find(type => type.value === formData.type);
        return selectedLeaveType ? selectedLeaveType.requires_documents : false;
    };
    
    // Get available days for the selected leave type and year
    const getAvailableDays = () => {
        if (!employeeBankData || !formData.type) return 0;
        
        if (formData.type === 'sick') {
            return employeeBankData.slvl_banks?.sick?.remaining_days || 0;
        } else if (formData.type === 'vacation') {
            return employeeBankData.slvl_banks?.vacation?.remaining_days || 0;
        }
        
        return 0;
    };
    
    // Handle form submission
    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (isSubmitting) return;
        
        // Validate form
        if (!formData.employee_id) {
            alert('Please select an employee');
            return;
        }
        
        if (!formData.type) {
            alert('Please select a leave type');
            return;
        }
        
        if (!formData.start_date || !formData.end_date) {
            alert('Please specify both start and end dates');
            return;
        }
        
        if (formData.start_date > formData.end_date) {
            alert('End date must be after or equal to start date');
            return;
        }
        
        if (!formData.reason.trim()) {
            alert('Please provide a reason for the leave');
            return;
        }
        
        // Check if documents are required but not uploaded
        if (requiresDocuments() && !uploadedFile) {
            alert(`Supporting documents are required for ${formData.type} leave`);
            return;
        }
        
        // Check available leave days for sick and vacation leave (only for with_pay)
        if (['sick', 'vacation'].includes(formData.type) && formData.pay_type === 'with_pay') {
            const availableDays = getAvailableDays();
                
            if (totalDays > availableDays) {
                alert(`Insufficient ${formData.type} leave days for ${formData.bank_year}. Employee only has ${availableDays} days available.`);
                return;
            }
        }
        
        setIsSubmitting(true);
        
        try {
            // Create FormData for file upload
            const submitData = new FormData();
            
            // Add all form fields explicitly with proper type conversion
            submitData.append('employee_id', formData.employee_id);
            submitData.append('type', formData.type);
            submitData.append('start_date', formData.start_date);
            submitData.append('end_date', formData.end_date);
            submitData.append('half_day', formData.half_day ? '1' : '0');
            if (formData.am_pm) {
                submitData.append('am_pm', formData.am_pm);
            }
            submitData.append('pay_type', formData.pay_type);
            submitData.append('reason', formData.reason);
            
            // Ensure bank_year is sent as integer
            submitData.append('bank_year', parseInt(formData.bank_year, 10));
            
            // Add file if exists
            if (uploadedFile) {
                submitData.append('supporting_documents', uploadedFile);
            }
            
            // Debug log before submission
            console.log('Submitting form with bank_year:', formData.bank_year);
            
            // Call the onSubmit prop with the form data
            onSubmit(submitData);
            
            // Reset form after submission
            setFormData({
                employee_id: '',
                type: '',
                start_date: today,
                end_date: today,
                half_day: false,
                am_pm: 'AM',
                pay_type: 'with_pay',
                reason: '',
                supporting_documents: null,
                bank_year: currentYear // Reset to current year
            });
            setSelectedEmployee(null);
            setSearchTerm('');
            setSelectedDepartment('');
            setUploadedFile(null);
            setFilePreview(null);
            setEmployeeBankData(null);
            
            // Clear file input
            const fileInput = document.getElementById('supporting_documents');
            if (fileInput) {
                fileInput.value = '';
            }
            
        } catch (error) {
            console.error('Error during form submission:', error);
            alert('An error occurred while submitting the form. Please try again.');
        } finally {
            setIsSubmitting(false);
        }

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };
    
    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Request Leave (SLVL)</h3>
                <p className="text-sm text-gray-500">Create leave request for employee</p>
            </div>
            
            <form onSubmit={handleSubmit} encType="multipart/form-data">
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Bank Year Selection */}
                    <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center mb-3">
                            <Calendar className="w-5 h-5 text-blue-600 mr-2" />
                            <h4 className="font-medium text-blue-800">Leave Bank Year Selection</h4>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex-1">
                                <label htmlFor="bank_year" className="block text-sm font-medium text-blue-700 mb-1">
                                    Select Bank Year <span className="text-red-600">*</span>
                                </label>
                                <select
                                    id="bank_year"
                                    name="bank_year"
                                    className="w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                                    value={formData.bank_year}
                                    onChange={handleChange}
                                    required
                                >
                                    {yearOptions.map(year => (
                                        <option key={year} value={year}>
                                            {year} {year === currentYear && '(Current)'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-2">
                                <div className="text-sm text-blue-700">
                                    <p className="font-medium">Selected Year: {formData.bank_year}</p>
                                    <p className="text-xs mt-1">Leave days will be deducted from this year's bank</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Employee Selection Section */}
                    <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Select Employee</h4>
                        
                        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 mb-4">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    placeholder="Search by name or ID"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <div className="flex-1">
                                <select
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={selectedDepartment}
                                    onChange={(e) => setSelectedDepartment(e.target.value)}
                                >
                                    <option value="">All Departments</option>
                                    {departments.map((department, index) => (
                                        <option key={index} value={department}>{department}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="border rounded-md overflow-hidden max-h-60 overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            ID
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Department
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Position
                                        </th>
                                    </tr>
                                </thead>
                                
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredEmployees.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-4 py-3 text-center text-sm text-gray-500">
                                                No employees match your search criteria
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredEmployees.map(employee => (
                                            <tr 
                                                key={employee.id} 
                                                className={`hover:bg-gray-50 cursor-pointer ${
                                                    formData.employee_id === employee.id ? 'bg-indigo-50' : ''
                                                }`}
                                                onClick={() => handleEmployeeSelect(employee)}
                                            >
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                    {employee.idno}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {employee.name}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                    {employee.department}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                    {employee.position}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Employee Selection Summary with Bank Data */}
                        <div className="mt-3">
                            {selectedEmployee ? (
                                <div className="bg-white border border-gray-200 rounded-md p-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-medium text-gray-900">Selected: {selectedEmployee.name}</span>
                                            <div className="text-sm text-gray-500 mt-1">
                                                Employee ID: {selectedEmployee.idno} • Department: {selectedEmployee.department}
                                            </div>
                                        </div>
                                        
                                        <div className="text-right">
                                            {loadingBankData ? (
                                                <div className="flex items-center space-x-2">
                                                    <Loader className="w-4 h-4 animate-spin text-blue-500" />
                                                    <span className="text-sm text-gray-500">Loading bank data...</span>
                                                </div>
                                            ) : employeeBankData ? (
                                                <div className="space-y-1">
                                                    <div className="text-sm">
                                                        <span className="font-medium text-blue-600">
                                                            Sick Leave ({formData.bank_year}): 
                                                        </span>
                                                        <span className={`ml-1 font-bold ${employeeBankData.slvl_banks?.sick?.remaining_days > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {employeeBankData.slvl_banks?.sick?.remaining_days || 0} days
                                                        </span>
                                                    </div>
                                                    <div className="text-sm">
                                                        <span className="font-medium text-green-600">
                                                            Vacation Leave ({formData.bank_year}): 
                                                        </span>
                                                        <span className={`ml-1 font-bold ${employeeBankData.slvl_banks?.vacation?.remaining_days > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {employeeBankData.slvl_banks?.vacation?.remaining_days || 0} days
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-gray-500">
                                                    No bank data available for {formData.bank_year}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-md p-2">
                                    No employee selected
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Leave Details Section */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Leave Details</h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                                    Leave Type <span className="text-red-600">*</span>
                                </label>
                                <select
                                    id="type"
                                    name="type"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.type}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="">Select Leave Type</option>
                                    {leaveTypes.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                                {formData.type && requiresDocuments() && (
                                    <div className="mt-1 flex items-center text-xs text-amber-600">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Supporting documents required for this leave type
                                    </div>
                                )}
                            </div>
                            
                            <div>
                                <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                                    Start Date <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="date"
                                    id="start_date"
                                    name="start_date"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.start_date}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
                                    End Date <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="date"
                                    id="end_date"
                                    name="end_date"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.end_date}
                                    onChange={handleChange}
                                    min={formData.start_date}
                                    required
                                />
                            </div>
                            
                            <div className="flex items-center space-x-4">
                                <label className="inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        name="half_day"
                                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        checked={formData.half_day}
                                        onChange={handleChange}
                                    />
                                    <span className="ml-2 text-sm text-gray-700">Half Day</span>
                                </label>
                                
                                {formData.half_day && (
                                    <div className="flex space-x-2">
                                        <label className="inline-flex items-center">
                                            <input
                                                type="radio"
                                                name="am_pm"
                                                value="AM"
                                                className="text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                checked={formData.am_pm === 'AM'}
                                                onChange={handleChange}
                                            />
                                            <span className="ml-1 text-sm text-gray-700">AM</span>
                                        </label>
                                        <label className="inline-flex items-center">
                                            <input
                                                type="radio"
                                                name="am_pm"
                                                value="PM"
                                                className="text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                checked={formData.am_pm === 'PM'}
                                                onChange={handleChange}
                                            />
                                            <span className="ml-1 text-sm text-gray-700">PM</span>
                                        </label>
                                    </div>
                                )}
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Pay Type <span className="text-red-600">*</span>
                                </label>
                                <div className="space-y-2">
                                    {payOptions.map(option => (
                                        <label key={option.value} className="inline-flex items-center mr-4">
                                            <input
                                                type="radio"
                                                name="pay_type"
                                                value={option.value}
                                                className="text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                checked={formData.pay_type === option.value}
                                                onChange={handleChange}
                                            />
                                            <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                                {formData.pay_type === 'non_pay' && (
                                    <div className="mt-1 text-xs text-blue-600">
                                        Non-pay leave will not deduct from leave bank balance
                                    </div>
                                )}
                            </div>
                            
                            {/* Enhanced Days Summary */}
                            <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                                <div className="text-sm font-medium text-blue-800 mb-2">
                                    Leave Request Summary
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-blue-700">Total Days:</span>
                                        <span className="text-sm font-medium text-blue-900">
                                            {totalDays} {totalDays === 1 ? 'day' : 'days'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-blue-700">Bank Year:</span>
                                        <span className="text-sm font-medium text-blue-900">{formData.bank_year}</span>
                                    </div>
                                    {selectedEmployee && ['sick', 'vacation'].includes(formData.type) && formData.pay_type === 'with_pay' && (
                                        <div className="flex justify-between">
                                            <span className="text-sm text-blue-700">Available {formData.type} days:</span>
                                            <span className={`text-sm font-medium ${getAvailableDays() >= totalDays ? 'text-green-700' : 'text-red-700'}`}>
                                                {getAvailableDays()} days
                                            </span>
                                        </div>
                                    )}
                                    {selectedEmployee && ['sick', 'vacation'].includes(formData.type) && formData.pay_type === 'with_pay' && totalDays > getAvailableDays() && (
                                        <div className="mt-2 text-xs text-red-700 bg-red-100 p-2 rounded border border-red-200">
                                            ⚠️ Insufficient leave days available for {formData.bank_year}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Reason and Documents Section */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Additional Information</h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                                    Reason <span className="text-red-600">*</span>
                                </label>
                                <textarea
                                    id="reason"
                                    name="reason"
                                    rows="4"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    placeholder="Please provide a detailed reason for your leave request"
                                    value={formData.reason}
                                    onChange={handleChange}
                                    required
                                ></textarea>
                            </div>
                            
                            {/* File Upload Section */}
                            <div>
                                <label htmlFor="supporting_documents" className="block text-sm font-medium text-gray-700 mb-1">
                                    Supporting Documents {requiresDocuments() && <span className="text-red-600">*</span>}
                                </label>
                                
                                {!uploadedFile ? (
                                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                                        <div className="space-y-1 text-center">
                                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                            <div className="flex text-sm text-gray-600">
                                                <label
                                                    htmlFor="supporting_documents"
                                                    className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                                                >
                                                    <span>Upload a file</span>
                                                    <input
                                                        id="supporting_documents"
                                                        name="supporting_documents"
                                                        type="file"
                                                        className="sr-only"
                                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                        onChange={handleFileUpload}
                                                    />
                                                </label>
                                                <p className="pl-1">or drag and drop</p>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                PDF, DOC, DOCX, JPG, JPEG, PNG up to 5MB
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-1 bg-white border border-gray-300 rounded-md p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="flex-shrink-0">
                                                    {uploadedFile.type.startsWith('image/') ? (
                                                        <img 
                                                            src={filePreview} 
                                                            alt="Preview" 
                                                            className="h-10 w-10 object-cover rounded border"
                                                        />
                                                    ) : (
                                                        <FileText className="h-10 w-10 text-gray-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {uploadedFile.name}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={removeFile}
                                                className="ml-3 flex-shrink-0 bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                <p className="mt-1 text-xs text-gray-500">
                                    {requiresDocuments() 
                                        ? `Supporting documents are required for ${formData.type} leave`
                                        : 'Supporting documents are optional for this leave type'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 border-t">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SLVLForm;