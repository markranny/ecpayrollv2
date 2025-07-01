// Enhanced OvertimeForm.jsx with automatic military time formatting
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { HelpCircle, Loader2, Info, Clock } from 'lucide-react';
import OvertimeRateHelpModal from './OvertimeRateHelpModal';

const OvertimeForm = ({ employees, departments, rateMultipliers, onSubmit }) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Form state
    const [formData, setFormData] = useState({
        employee_ids: [],
        date: today,
        start_time: '17:00',
        end_time: '20:00',
        overtime_hours: '3.00',
        reason: '',
        rate_multiplier: rateMultipliers.length > 0 ? rateMultipliers[0].value : 1.25,
        overtime_type: 'regular_weekday',
        has_night_differential: false
    });
    
    // Loading and processing states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    
    // Filtered employees state
    const [displayedEmployees, setDisplayedEmployees] = useState(employees || []);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    
    // Rate help modal state
    const [showRateHelpModal, setShowRateHelpModal] = useState(false);
    
    // Time input display states for user-friendly formatting
    const [timeDisplays, setTimeDisplays] = useState({
        start_time: '5:00 PM',
        end_time: '8:00 PM'
    });
    
    // Overtime type options
    const overtimeTypes = {
        'regular_weekday': 'Regular Weekday Overtime',
        'rest_day': 'Rest Day Work',
        'scheduled_rest_day': 'Scheduled Rest Day Work',
        'regular_holiday': 'Regular Holiday Work',
        'special_holiday': 'Special Holiday Work',
        'emergency_work': 'Emergency Work',
        'extended_shift': 'Extended Shift',
        'weekend_work': 'Weekend Work',
        'night_shift': 'Night Shift Work',
        'other': 'Other'
    };
    
    // Helper function to format military time input
    const formatMilitaryTimeEntry = (digits) => {
        if (digits.length === 1) {
            // Single digit: 2 → 02:00
            const hour = parseInt(digits);
            if (hour >= 0 && hour <= 9) {
                return `0${hour}:00`;
            }
        } else if (digits.length === 2) {
            // Two digits: 22 → 22:00
            const hour = parseInt(digits);
            if (hour >= 0 && hour <= 23) {
                return `${digits}:00`;
            }
        } else if (digits.length === 3) {
            // Three digits: 145 → 01:45
            const hour = parseInt(digits.substring(0, 1));
            const minute = parseInt(digits.substring(1, 3));
            if (hour >= 0 && hour <= 9 && minute >= 0 && minute <= 59) {
                return `0${hour}:${digits.substring(1, 3)}`;
            }
        } else if (digits.length >= 4) {
            // Four or more digits: 1430 → 14:30
            const hour = parseInt(digits.substring(0, 2));
            const minute = parseInt(digits.substring(2, 4));
            if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                return `${digits.substring(0, 2)}:${digits.substring(2, 4)}`;
            }
        }
        return null;
    };
    
    // Helper function to convert 24-hour time to 12-hour display
    const formatDisplayTime = (time24) => {
        if (!time24 || !time24.includes(':')) return time24;
        
        try {
            const [hours, minutes] = time24.split(':');
            const hour = parseInt(hours);
            const minute = parseInt(minutes);
            
            if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                const period = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                return `${displayHour}:${minutes} ${period}`;
            }
        } catch (error) {
            console.error('Error formatting display time:', error);
        }
        
        return time24;
    };
    
    // Enhanced time input handler with proper military time conversion
    const handleTimeInput = (fieldName, event) => {
        const value = event.target.value;
        
        // If it's already in HH:MM format (from time picker), use as-is
        if (value.includes(':')) {
            setFormData(prev => ({
                ...prev,
                [fieldName]: value
            }));
            
            setTimeDisplays(prev => ({
                ...prev,
                [fieldName]: formatDisplayTime(value)
            }));
            return;
        }
        
        // Handle military time input
        const digits = value.replace(/\D/g, '');
        if (digits.length === 0) {
            setFormData(prev => ({
                ...prev,
                [fieldName]: ''
            }));
            setTimeDisplays(prev => ({
                ...prev,
                [fieldName]: ''
            }));
            return;
        }
        
        const formattedTime = formatMilitaryTimeEntry(digits);
        
        if (formattedTime) {
            setFormData(prev => ({
                ...prev,
                [fieldName]: formattedTime
            }));
            
            setTimeDisplays(prev => ({
                ...prev,
                [fieldName]: formatDisplayTime(formattedTime)
            }));
        }
    };
    
    // Handle blur event for time inputs to ensure proper formatting
    const handleTimeBlur = (fieldName, event) => {
        const value = event.target.value;
        if (value && value.includes(':')) {
            setTimeDisplays(prev => ({
                ...prev,
                [fieldName]: formatDisplayTime(value)
            }));
        }
    };
    
    // Auto-detect overtime type and night differential based on date and time
    const autoDetectOvertimeType = () => {
        const selectedDate = new Date(formData.date);
        const startTime = formData.start_time;
        const endTime = formData.end_time;
        
        // Check if it overlaps with night hours (10 PM to 6 AM)
        const startHour = parseInt(startTime.split(':')[0]);
        const endHour = parseInt(endTime.split(':')[0]);
        const hasNightHours = startHour >= 22 || endHour <= 6 || (startHour > endHour);
        
        // Always default to regular weekday - no automatic weekend detection
        const detectedType = 'regular_weekday';
        
        setFormData(prev => ({
            ...prev,
            overtime_type: detectedType,
            has_night_differential: hasNightHours
        }));
    };
    
    // Enhanced useEffect for employee filtering and sorting
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
                const fullName = `${employee.Fname} ${employee.Lname}`.toLowerCase();
                const reverseName = `${employee.Lname} ${employee.Fname}`.toLowerCase();
                const employeeId = employee.idno?.toString().toLowerCase();
                
                // Check for exact match first
                if (
                    employee.Lname.toLowerCase() === term || 
                    employee.Fname.toLowerCase() === term ||
                    fullName === term ||
                    reverseName === term ||
                    employeeId === term
                ) {
                    exactMatch = true;
                    matchesSearch = true;
                } else {
                    // Check for partial match
                    matchesSearch = 
                        employee.Fname.toLowerCase().includes(term) || 
                        employee.Lname.toLowerCase().includes(term) || 
                        employeeId?.includes(term);
                }
            }
            
            // Check department match - using proper department relationship
            let matchesDepartment = true;
            if (selectedDepartment) {
                const employeeDepartment = employee.department?.name || employee.Department;
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
        
        // Sort each category alphabetically by last name
        const sortByName = (a, b) => {
            const aName = `${a.Lname}, ${a.Fname}`.toLowerCase();
            const bName = `${b.Lname}, ${b.Fname}`.toLowerCase();
            return aName.localeCompare(bName);
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
        
        // Handle time inputs specially
        if (name === 'start_time' || name === 'end_time') {
            handleTimeInput(name, e);
            return;
        }
        
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value
        });
    };
    
    // Handle employee selection
    const handleEmployeeSelection = (employeeId) => {
        const numericId = parseInt(employeeId, 10);
        setFormData(prevData => {
            // Check if employee is already selected
            if (prevData.employee_ids.includes(numericId)) {
                // Remove the employee
                return {
                    ...prevData,
                    employee_ids: prevData.employee_ids.filter(id => id !== numericId)
                };
            } else {
                // Add the employee
                return {
                    ...prevData,
                    employee_ids: [...prevData.employee_ids, numericId]
                };
            }
        });
    };
    
    // Handle individual checkbox change - directly modify the checkbox without affecting the row click
    const handleCheckboxChange = (e, employeeId) => {
        e.stopPropagation(); // Prevent row click handler from firing
        handleEmployeeSelection(employeeId);
    };
    
    // Handle select all employees (currently displayed only)
    const handleSelectAll = () => {
        setFormData(prevData => {
            // Get IDs of all currently displayed employees
            const displayedIds = displayedEmployees.map(emp => emp.id);
            
            // Check if all displayed employees are already selected
            const allSelected = displayedIds.every(id => prevData.employee_ids.includes(id));
            
            if (allSelected) {
                // If all are selected, deselect them
                return {
                    ...prevData,
                    employee_ids: prevData.employee_ids.filter(id => !displayedIds.includes(id))
                };
            } else {
                // If not all are selected, select all displayed employees
                // First remove any existing displayed employees to avoid duplicates
                const remainingSelectedIds = prevData.employee_ids.filter(id => !displayedIds.includes(id));
                return {
                    ...prevData,
                    employee_ids: [...remainingSelectedIds, ...displayedIds]
                };
            }
        });
    };
    
    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isSubmitting) return; // Prevent double submission
        
        // Validation for form
        if (formData.employee_ids.length === 0) {
            alert('Please select at least one employee');
            return;
        }
        
        if (!formData.date || !formData.start_time || !formData.end_time) {
            alert('Please fill in all required fields');
            return;
        }
        
        if (!formData.reason.trim()) {
            alert('Please provide a reason for the overtime');
            return;
        }
        
        // Validate overtime hours
        const overtimeHours = parseFloat(formData.overtime_hours);
        if (isNaN(overtimeHours) || overtimeHours <= 0) {
            alert('Please enter a valid number of overtime hours');
            return;
        }
        
        if (overtimeHours > 24) {
            alert('Overtime hours cannot exceed 24 hours');
            return;
        }
        
        // Set loading state
        setIsSubmitting(true);
        setLoadingMessage(`Processing overtime for ${formData.employee_ids.length} employee${formData.employee_ids.length > 1 ? 's' : ''}...`);
        
        try {
            // Call the onSubmit prop with the form data
            await onSubmit(formData);
            
            // Reset form after successful submission 
            setFormData({
                employee_ids: [],
                date: today,
                start_time: '17:00',
                end_time: '20:00',
                overtime_hours: '3.00',
                reason: '',
                rate_multiplier: rateMultipliers.length > 0 ? rateMultipliers[0].value : 1.25,
                overtime_type: 'regular_weekday',
                has_night_differential: false
            });
            
            // Reset time displays
            setTimeDisplays({
                start_time: '5:00 PM',
                end_time: '8:00 PM'
            });
            
            // Reset filters
            setSearchTerm('');
            setSelectedDepartment('');
            
            setLoadingMessage('Overtime requests submitted successfully!');
            
            // Scroll to top of the page
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            
            // Clear success message after a delay
            setTimeout(() => {
                setLoadingMessage('');
            }, 2000);
            
        } catch (error) {
            console.error('Error submitting overtime:', error);
            setLoadingMessage('');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Calculate if all displayed employees are selected
    const allDisplayedSelected = displayedEmployees.length > 0 && 
        displayedEmployees.every(emp => formData.employee_ids.includes(emp.id));
    
    // Get selected employees details for display
    const selectedEmployees = employees.filter(emp => formData.employee_ids.includes(emp.id));

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">File New Overtime</h3>
                <p className="text-sm text-gray-500">Create overtime request for one or multiple employees</p>
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
                    
                    {/* Overtime Details Section */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Overtime Details</h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                                    Date <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="date"
                                    id="date"
                                    name="date"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.date}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
                                        Start Time <span className="text-red-600">*</span>
                                    </label>
                                    <div className="space-y-2">
                                        {/* Military time text input */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                id="start_time_military"
                                                name="start_time_military"
                                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 pr-8"
                                                placeholder="Type: 22, 0800, 1430..."
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    handleTimeInput('start_time', e);
                                                }}
                                                disabled={isSubmitting}
                                            />
                                            <Clock className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                        </div>
                                        {/* Hidden HTML5 time input */}
                                        <input
                                            type="time"
                                            id="start_time"
                                            name="start_time"
                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                            value={formData.start_time}
                                            onChange={handleChange}
                                            onBlur={(e) => handleTimeBlur('start_time', e)}
                                            disabled={isSubmitting}
                                            required
                                        />
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        {timeDisplays.start_time && formData.start_time ? (
                                            <span className="text-blue-600 font-medium">{timeDisplays.start_time}</span>
                                        ) : (
                                            'Type 22 for 10:00 PM, 0800 for 8:00 AM'
                                        )}
                                    </div>
                                </div>
                                
                                <div>
                                    <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1">
                                        End Time <span className="text-red-600">*</span>
                                    </label>
                                    <div className="space-y-2">
                                        {/* Military time text input */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                id="end_time_military"
                                                name="end_time_military"
                                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 pr-8"
                                                placeholder="Type: 02, 1600, 2300..."
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    handleTimeInput('end_time', e);
                                                }}
                                                disabled={isSubmitting}
                                            />
                                            <Clock className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                        </div>
                                        {/* Hidden HTML5 time input */}
                                        <input
                                            type="time"
                                            id="end_time"
                                            name="end_time"
                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                            value={formData.end_time}
                                            onChange={handleChange}
                                            onBlur={(e) => handleTimeBlur('end_time', e)}
                                            disabled={isSubmitting}
                                            required
                                        />
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        {timeDisplays.end_time && formData.end_time ? (
                                            <span className="text-blue-600 font-medium">{timeDisplays.end_time}</span>
                                        ) : (
                                            'Type 2 for 2:00 AM, 1430 for 2:30 PM'
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Military Time Help */}
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                                <div className="flex items-start">
                                    <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                                    <div className="text-sm text-blue-800">
                                        <p className="font-medium mb-1">Military Time Quick Entry:</p>
                                        <ul className="text-xs space-y-1">
                                            <li>• Type <strong>22</strong> in text field → 22:00 (10:00 PM)</li>
                                            <li>• Type <strong>0800</strong> → 08:00 (8:00 AM)</li>
                                            <li>• Type <strong>1430</strong> → 14:30 (2:30 PM)</li>
                                            <li>• Type <strong>2</strong> → 02:00 (2:00 AM)</li>
                                            <li>• Or use the time picker below for manual selection</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Auto-detect button */}
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={autoDetectOvertimeType}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center disabled:opacity-50"
                                    disabled={isSubmitting}
                                >
                                    <Info className="h-3 w-3 mr-1" />
                                    Auto-detect overtime type
                                </button>
                            </div>
                            
                            {/* Overtime Hours */}
                            <div>
                                <label htmlFor="overtime_hours" className="block text-sm font-medium text-gray-700 mb-1">
                                    Overtime Hours <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="number"
                                    id="overtime_hours"
                                    name="overtime_hours"
                                    step="0.25"
                                    min="0.25"
                                    max="24"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.overtime_hours}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                    placeholder="Enter overtime hours (e.g., 3.5)"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Enter the actual overtime hours worked (0.25 to 24 hours, in 15-minute increments).
                                </p>
                            </div>
                            
                            {/* Overtime Type */}
                            <div>
                                <label htmlFor="overtime_type" className="block text-sm font-medium text-gray-700 mb-1">
                                    Overtime Type <span className="text-red-600">*</span>
                                </label>
                                <select
                                    id="overtime_type"
                                    name="overtime_type"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.overtime_type}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                >
                                    {Object.entries(overtimeTypes).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-gray-500">
                                    Select the category that best describes this overtime work.
                                </p>
                            </div>
                            
                            {/* Night Differential */}
                            <div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="has_night_differential"
                                        name="has_night_differential"
                                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        checked={formData.has_night_differential}
                                        onChange={handleChange}
                                        disabled={isSubmitting}
                                    />
                                    <label htmlFor="has_night_differential" className="ml-2 block text-sm text-gray-700">
                                        Night Differential (10PM - 6AM)
                                    </label>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Check this if any part of the overtime work falls between 10PM and 6AM.
                                </p>
                            </div>
                            
                            {/* Rate Multiplier */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <label htmlFor="rate_multiplier" className="block text-sm font-medium text-gray-700 mb-1">
                                        Rate Type <span className="text-red-600">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowRateHelpModal(true)}
                                        className="text-indigo-600 hover:text-indigo-800 flex items-center text-xs focus:outline-none disabled:opacity-50"
                                        disabled={isSubmitting}
                                    >
                                        <HelpCircle className="h-4 w-4 mr-1" />
                                        Rate Guide
                                    </button>
                                </div>
                                <select
                                    id="rate_multiplier"
                                    name="rate_multiplier"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.rate_multiplier}
                                    onChange={handleChange}
                                    disabled={isSubmitting}
                                    required
                                >
                                    <optgroup label="Regular Work Hours">
                                        <option value="1.25">Ordinary Weekday Overtime (125%)</option>
                                    </optgroup>
                                    
                                    <optgroup label="Special Days - Regular Hours">
                                        <option value="1.30">Rest Day/Special Day (130%)</option>
                                        <option value="1.50">Scheduled Rest Day (150%)</option>
                                        <option value="2.00">Regular Holiday (200%)</option>
                                    </optgroup>
                                    
                                    <optgroup label="Special Days - Overtime">
                                        <option value="1.69">Rest Day/Special Day Overtime (169%)</option>
                                        <option value="1.95">Scheduled Rest Day Overtime (195%)</option>
                                        <option value="2.60">Regular Holiday Overtime (260%)</option>
                                    </optgroup>
                                    
                                    <optgroup label="Night Shift Differential">
                                        <option value="1.375">Ordinary Weekday Overtime + Night Differential (137.5%)</option>
                                        <option value="1.43">Rest Day/Special Day + Night Differential (143%)</option>
                                        <option value="1.65">Scheduled Rest Day + Night Differential (165%)</option>
                                        <option value="2.20">Regular Holiday + Night Differential (220%)</option>
                                        <option value="1.859">Rest Day/Special Day Overtime + Night Differential (185.9%)</option>
                                        <option value="2.145">Scheduled Rest Day Overtime + Night Differential (214.5%)</option>
                                        <option value="2.86">Regular Holiday Overtime + Night Differential (286%)</option>
                                    </optgroup>
                                </select>
                                <p className="mt-1 text-xs text-gray-500">
                                    Select the appropriate rate type based on when the overtime was performed.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Reason for Overtime</h4>
                        
                        <div>
                            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                                Reason <span className="text-red-600">*</span>
                            </label>
                            <textarea
                                id="reason"
                                name="reason"
                                rows="5"
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                placeholder="Provide a detailed reason for the overtime request"
                                value={formData.reason}
                                onChange={handleChange}
                                disabled={isSubmitting}
                                required
                            ></textarea>
                            <p className="mt-1 text-xs text-gray-500">
                                Please provide a clear justification for the overtime work.
                            </p>
                        </div>
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
                            'Submit Overtime Request'
                        )}
                    </button>
                </div>
            </form>
            
            {/* Rate Help Modal */}
            <OvertimeRateHelpModal 
                isOpen={showRateHelpModal && !isSubmitting}
                onClose={() => setShowRateHelpModal(false)}
            />
        </div>
    );
};

export default OvertimeForm;