// resources/js/Pages/TravelOrder/TravelOrderForm.jsx
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Loader2, MapPin, Clock, DollarSign, Upload, X, FileText } from 'lucide-react';

const TravelOrderForm = ({ employees, departments, transportationTypes, onSubmit }) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Form state
    const [formData, setFormData] = useState({
        employee_ids: [],
        start_date: today,
        end_date: today,
        departure_time: '08:00',
        return_time: '17:00',
        destination: '',
        transportation_type: transportationTypes[0] || '',
        purpose: '',
        accommodation_required: false,
        meal_allowance: false,
        other_expenses: '',
        estimated_cost: '',
        return_to_office: false,
        office_return_time: ''
    });
    
    // Document state
    const [documents, setDocuments] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    
    // Loading and processing states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    
    // Filtered employees state
    const [displayedEmployees, setDisplayedEmployees] = useState(employees || []);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    
    // Enhanced useEffect for CancelRestDayForm employee filtering and sorting
useEffect(() => {
    // Define our categories of employees with clear priorities
    let selectedAndExactMatch = [];      // Priority 1: Selected + Exact match
    let selectedAndPartialMatch = [];    // Priority 2: Selected + Partial match  
    let selectedButNotMatched = [];      // Priority 3: Selected but no search match
    let exactSearchMatches = [];         // Priority 4: Not selected + Exact match
    let partialSearchMatches = [];       // Priority 5: Not selected + Partial match
    let otherEmployees = [];             // Priority 6: Everything else
    
    employees.forEach(employee => {
        const isSelected = formData.employee_ids.includes(employee.id);
        
        // Check search match
        let matchesSearch = true;
        let exactMatch = false;
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase().trim();
            
            // Get employee name parts for comparison
            const firstName = (employee.Fname || '').toLowerCase();
            const lastName = (employee.Lname || '').toLowerCase();
            const middleName = (employee.MName || '').toLowerCase();
            const fullName = `${firstName} ${lastName}`.trim();
            const reverseName = `${lastName} ${firstName}`.trim();
            const employeeId = employee.idno?.toString().toLowerCase();
            const mappedName = (employee.name || '').toLowerCase();
            
            // Check for exact match first
            if (
                firstName === term || 
                lastName === term ||
                fullName === term ||
                reverseName === term ||
                mappedName === term ||
                employeeId === term
            ) {
                exactMatch = true;
                matchesSearch = true;
            } else {
                // Check for partial match
                matchesSearch = 
                    firstName.includes(term) || 
                    lastName.includes(term) || 
                    middleName.includes(term) ||
                    mappedName.includes(term) ||
                    employeeId?.includes(term);
            }
        }
        
        // Check department match - handle both mapped and direct data
        let matchesDepartment = true;
        if (selectedDepartment) {
            const employeeDepartment = employee.department || employee.Department || '';
            matchesDepartment = employeeDepartment === selectedDepartment;
        }
        
        // Skip if doesn't match department filter
        if (!matchesDepartment) {
            return;
        }
        
        // Categorize based on selection status and search matches
        if (isSelected && exactMatch) {
            selectedAndExactMatch.push(employee);
        } else if (isSelected && matchesSearch) {
            selectedAndPartialMatch.push(employee);
        } else if (isSelected) {
            selectedButNotMatched.push(employee);
        } else if (exactMatch) {
            exactSearchMatches.push(employee);
        } else if (matchesSearch) {
            partialSearchMatches.push(employee);
        } else if (!searchTerm) {
            // Only show non-matching employees when no search term
            otherEmployees.push(employee);
        }
    });
    
    // Sort each category alphabetically by name
    const sortByName = (a, b) => {
        const getName = (emp) => {
            if (emp.name) return emp.name.toLowerCase();
            const lastName = emp.Lname || '';
            const firstName = emp.Fname || '';
            return `${lastName}, ${firstName}`.toLowerCase();
        };
        
        return getName(a).localeCompare(getName(b));
    };
    
    selectedAndExactMatch.sort(sortByName);
    selectedAndPartialMatch.sort(sortByName);
    selectedButNotMatched.sort(sortByName);
    exactSearchMatches.sort(sortByName);
    partialSearchMatches.sort(sortByName);
    otherEmployees.sort(sortByName);
    
    // Combine all categories in priority order
    const result = [
        ...selectedAndExactMatch,
        ...selectedAndPartialMatch,
        ...selectedButNotMatched,
        ...exactSearchMatches,
        ...partialSearchMatches,
        ...otherEmployees
    ];
    
    setDisplayedEmployees(result);
}, [searchTerm, selectedDepartment, employees, formData.employee_ids]);
    
    // Handle input changes
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };
    
    // Handle employee selection
    const handleEmployeeSelection = (employeeId) => {
        const numericId = parseInt(employeeId, 10);
        setFormData(prevData => {
            if (prevData.employee_ids.includes(numericId)) {
                return {
                    ...prevData,
                    employee_ids: prevData.employee_ids.filter(id => id !== numericId)
                };
            } else {
                return {
                    ...prevData,
                    employee_ids: [...prevData.employee_ids, numericId]
                };
            }
        });
    };
    
    // Handle checkbox change
    const handleCheckboxChange = (e, employeeId) => {
        e.stopPropagation();
        handleEmployeeSelection(employeeId);
    };
    
    // Handle select all employees
    const handleSelectAll = () => {
        setFormData(prevData => {
            const displayedIds = displayedEmployees.map(emp => emp.id);
            const allSelected = displayedIds.every(id => prevData.employee_ids.includes(id));
            
            if (allSelected) {
                return {
                    ...prevData,
                    employee_ids: prevData.employee_ids.filter(id => !displayedIds.includes(id))
                };
            } else {
                const remainingSelectedIds = prevData.employee_ids.filter(id => !displayedIds.includes(id));
                return {
                    ...prevData,
                    employee_ids: [...remainingSelectedIds, ...displayedIds]
                };
            }
        });
    };
    
    // Document handling functions
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        addFiles(files);
    };
    
    const addFiles = (files) => {
        const validFiles = files.filter(file => {
            // Check file type
            const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!validTypes.includes(file.type)) {
                alert(`File ${file.name} is not a valid type. Please upload PDF, DOC, DOCX, JPG, JPEG, or PNG files only.`);
                return false;
            }
            
            // Check file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                alert(`File ${file.name} is too large. Maximum size is 5MB.`);
                return false;
            }
            
            return true;
        });
        
        setDocuments(prev => [...prev, ...validFiles]);
    };
    
    const removeDocument = (index) => {
        setDocuments(prev => prev.filter((_, i) => i !== index));
    };
    
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };
    
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const files = Array.from(e.dataTransfer.files);
            addFiles(files);
        }
    };
    
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    // Calculate estimated travel days
    const calculateTravelInfo = () => {
        if (!formData.start_date || !formData.end_date) return { days: 0, isMultiDay: false };
        
        const startDate = new Date(formData.start_date);
        const endDate = new Date(formData.end_date);
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        const isMultiDay = days > 1;
        
        return { days, isMultiDay };
    };
    
    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isSubmitting) return;
        
        // Validate form
        if (formData.employee_ids.length === 0) {
            alert('Please select at least one employee');
            return;
        }
        
        if (!formData.start_date || !formData.end_date) {
            alert('Please fill in start and end dates');
            return;
        }
        
        if (new Date(formData.end_date) < new Date(formData.start_date)) {
            alert('End date must be on or after start date');
            return;
        }
        
        if (!formData.destination.trim()) {
            alert('Please provide the destination');
            return;
        }
        
        if (!formData.purpose.trim()) {
            alert('Please provide the purpose of travel');
            return;
        }
        
        // Validate return to office logic
        if (formData.return_to_office && !formData.office_return_time) {
            alert('Please specify office return time when "Return to Office" is checked');
            return;
        }
        
        setIsSubmitting(true);
        setLoadingMessage(`Processing travel order for ${formData.employee_ids.length} employee${formData.employee_ids.length > 1 ? 's' : ''}...`);
        
        try {
            // Create FormData for file upload
            const submitData = new FormData();
            
            // Add form fields
            Object.keys(formData).forEach(key => {
                if (key === 'employee_ids') {
                    formData[key].forEach(id => {
                        submitData.append('employee_ids[]', id);
                    });
                } else {
                    submitData.append(key, formData[key]);
                }
            });
            
            // Add documents
            documents.forEach((file, index) => {
                submitData.append(`documents[${index}]`, file);
            });
            
            await onSubmit(submitData);
            
            // Reset form after successful submission 
            setFormData({
                employee_ids: [],
                start_date: today,
                end_date: today,
                departure_time: '08:00',
                return_time: '17:00',
                destination: '',
                transportation_type: transportationTypes[0] || '',
                purpose: '',
                accommodation_required: false,
                meal_allowance: false,
                other_expenses: '',
                estimated_cost: '',
                return_to_office: false,
                office_return_time: ''
            });
            
            // Reset documents
            setDocuments([]);
            
            // Reset filters
            setSearchTerm('');
            setSelectedDepartment('');
            
            setLoadingMessage('Travel orders submitted successfully!');
            
            setTimeout(() => {
                setLoadingMessage('');
            }, 2000);
            
        } catch (error) {
            console.error('Error submitting travel order:', error);
            setLoadingMessage('');
        } finally {
            setIsSubmitting(false);
        }

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };
    
    // Calculate if all displayed employees are selected
    const allDisplayedSelected = displayedEmployees.length > 0 && 
        displayedEmployees.every(emp => formData.employee_ids.includes(emp.id));
    
    // Get selected employees details for display
    const selectedEmployees = employees.filter(emp => formData.employee_ids.includes(emp.id));
    
    const travelInfo = calculateTravelInfo();

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-4 border-b">
                <h3 className="text-lg font-semibold flex items-center">
                    <MapPin className="h-5 w-5 mr-2 text-indigo-600" />
                    File New Travel Order
                </h3>
                <p className="text-sm text-gray-500">Create travel order for one or multiple employees</p>
            </div>
            
            {/* Loading Overlay */}
            {isSubmitting && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50 rounded-lg">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-indigo-600" />
                        <p className="text-sm text-gray-600">{loadingMessage}</p>
                    </div>
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="relative">
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Employee Selection Section */}
                    <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Select Employees</h4>
                        
                        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 mb-4">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    placeholder="Search by name or ID"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>
                            
                            <div className="flex-1">
                                <select
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={selectedDepartment}
                                    onChange={(e) => setSelectedDepartment(e.target.value)}
                                    disabled={isSubmitting}
                                >
                                    <option value="">All Departments</option>
                                    {departments.map((department, index) => (
                                        <option key={index} value={department}>{department}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="md:flex-initial">
                                <button
                                    type="button"
                                    className={`w-full px-4 py-2 rounded-md ${
                                        allDisplayedSelected 
                                            ? 'bg-indigo-700 hover:bg-indigo-800' 
                                            : 'bg-indigo-500 hover:bg-indigo-600'
                                    } text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50`}
                                    onClick={handleSelectAll}
                                    disabled={isSubmitting}
                                >
                                    {allDisplayedSelected ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                        </div>
                        
                        <div className="border rounded-md overflow-hidden max-h-60 overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                                            Select
                                        </th>
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
                                    {displayedEmployees.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-4 py-3 text-center text-sm text-gray-500">
                                                No employees match your search criteria
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedEmployees.map(employee => (
                                            <tr 
                                                key={employee.id} 
                                                className={`hover:bg-gray-50 cursor-pointer ${
                                                    formData.employee_ids.includes(employee.id) ? 'bg-indigo-50' : ''
                                                } ${isSubmitting ? 'opacity-50' : ''}`}
                                                onClick={() => !isSubmitting && handleEmployeeSelection(employee.id)}
                                            >
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                        checked={formData.employee_ids.includes(employee.id)}
                                                        onChange={(e) => handleCheckboxChange(e, employee.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        disabled={isSubmitting}
                                                    />
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                    {employee.idno}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {employee.Lname}, {employee.Fname} {employee.MName || ''}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                    {employee.department?.name || employee.Department || 'No Department'}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                    {employee.Jobtitle}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="mt-2 text-sm text-gray-600">
                            {formData.employee_ids.length > 0 ? (
                                <div>
                                    <span className="font-medium">{formData.employee_ids.length} employee(s) selected</span>
                                    {formData.employee_ids.length <= 5 && (
                                        <span className="ml-2">
                                            ({selectedEmployees.map(emp => emp.Lname).join(', ')})
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-yellow-600">No employees selected</span>
                            )}
                        </div>
                    </div>
                    
                    {/* Travel Details Section */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-indigo-600" />
                            Travel Details
                        </h4>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
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
                                        disabled={isSubmitting}
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
                                        disabled={isSubmitting}
                                        min={formData.start_date}
                                        required
                                    />
                                </div>
                            </div>
                            
                            {travelInfo.days > 0 && (
                                <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                                    <strong>Travel Duration:</strong> {travelInfo.days} day{travelInfo.days !== 1 ? 's' : ''}
                                    {travelInfo.isMultiDay && <span className="text-blue-600 ml-2">(Multi-day travel)</span>}
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="departure_time" className="block text-sm font-medium text-gray-700 mb-1">
                                        Departure Time
                                    </label>
                                    <input
                                        type="time"
                                        id="departure_time"
                                        name="departure_time"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        value={formData.departure_time}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    />
                                </div>
                                
                                <div>
                                    <label htmlFor="return_time" className="block text-sm font-medium text-gray-700 mb-1">
                                        Return Time
                                    </label>
                                    <input
                                        type="time"
                                        id="return_time"
                                        name="return_time"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        value={formData.return_time}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-1">
                                    Destination <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="destination"
                                    name="destination"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.destination}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    placeholder="Enter travel destination"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="transportation_type" className="block text-sm font-medium text-gray-700 mb-1">
                                    Transportation Type
                                </label>
                                <select
                                    id="transportation_type"
                                    name="transportation_type"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.transportation_type}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                >
                                    {transportationTypes.map((type, index) => (
                                        <option key={index} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    {/* Return to Office Section */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Return to Office</h4>
                        
                        <div className="space-y-4">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="return_to_office"
                                    name="return_to_office"
                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    checked={formData.return_to_office}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                />
                                <label htmlFor="return_to_office" className="ml-2 text-sm text-gray-700">
                                    Employee will return to office after travel
                                </label>
                            </div>
                            
                            {formData.return_to_office && (
                                <div>
                                    <label htmlFor="office_return_time" className="block text-sm font-medium text-gray-700 mb-1">
                                        Office Return Time <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        id="office_return_time"
                                        name="office_return_time"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        value={formData.office_return_time}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                        required={formData.return_to_office}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        This affects whether the travel is counted as full day or partial day
                                    </p>
                                </div>
                            )}
                            
                            <div className="text-sm text-gray-600 bg-yellow-50 p-2 rounded">
                                <strong>Day Counting Logic:</strong><br />
                                • Travel of 5+ hours = Full day<br />
                                • Return to office with 3+ hours work = Partial day<br />
                                • Travel before 9 AM or after 3 PM = Full day
                            </div>
                        </div>
                    </div>
                    
                    {/* Purpose and Expenses Section */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Purpose & Expenses</h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
                                    Purpose of Travel <span className="text-red-600">*</span>
                                </label>
                                <textarea
                                    id="purpose"
                                    name="purpose"
                                    rows="3"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    placeholder="Provide detailed purpose for the travel"
                                    value={formData.purpose}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                ></textarea>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="accommodation_required"
                                        name="accommodation_required"
                                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        checked={formData.accommodation_required}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    />
                                    <label htmlFor="accommodation_required" className="ml-2 text-sm text-gray-700">
                                        Accommodation Required
                                    </label>
                                </div>
                                
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="meal_allowance"
                                        name="meal_allowance"
                                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        checked={formData.meal_allowance}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    />
                                    <label htmlFor="meal_allowance" className="ml-2 text-sm text-gray-700">
                                        Meal Allowance
                                    </label>
                                </div>
                            </div>
                            
                            <div>
                                <label htmlFor="estimated_cost" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    Estimated Cost
                                </label>
                                <input
                                    type="number"
                                    id="estimated_cost"
                                    name="estimated_cost"
                                    step="0.01"
                                    min="0"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.estimated_cost}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    placeholder="0.00"
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="other_expenses" className="block text-sm font-medium text-gray-700 mb-1">
                                    Other Expenses
                                </label>
                                <textarea
                                    id="other_expenses"
                                    name="other_expenses"
                                    rows="2"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    placeholder="List any other anticipated expenses"
                                    value={formData.other_expenses}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                ></textarea>
                            </div>
                        </div>
                    </div>
                    
                    {/* Document Upload Section */}
                    <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3 flex items-center">
                            <Upload className="h-4 w-4 mr-2 text-indigo-600" />
                            Supporting Documents
                        </h4>
                        <p className="text-sm text-gray-500 mb-4">
                            Upload supporting documents (PDF, DOC, DOCX, JPG, PNG - Max 5MB each)
                        </p>
                        
                        {/* File Upload Area */}
                        <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                                dragActive 
                                    ? 'border-indigo-400 bg-indigo-50' 
                                    : 'border-gray-300 hover:border-gray-400'
                            } ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="mt-4">
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    <span className="mt-2 block text-sm font-medium text-gray-900">
                                        Drop files here or click to browse
                                    </span>
                                    <input
                                        id="file-upload"
                                        name="file-upload"
                                        type="file"
                                        className="sr-only"
                                        multiple
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                        onChange={handleFileSelect}
                                        disabled={isSubmitting}
                                    />
                                </label>
                                <p className="mt-1 text-xs text-gray-500">
                                    PDF, DOC, DOCX, JPG, PNG up to 5MB each
                                </p>
                            </div>
                        </div>
                        
                        {/* Document List */}
                        {documents.length > 0 && (
                            <div className="mt-4">
                                <h5 className="text-sm font-medium text-gray-700 mb-2">Selected Documents:</h5>
                                <div className="space-y-2">
                                    {documents.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between bg-white p-3 rounded border">
                                            <div className="flex items-center">
                                                <FileText className="h-5 w-5 text-gray-400 mr-2" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeDocument(index)}
                                                className="text-red-500 hover:text-red-700 disabled:opacity-50"
                                                disabled={isSubmitting}
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 border-t">
                    <button
                        type="submit"
                        className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Submit Travel Order'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TravelOrderForm;