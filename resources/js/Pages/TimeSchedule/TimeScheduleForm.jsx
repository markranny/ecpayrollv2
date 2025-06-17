import React, { useState, useEffect } from 'react';

const TimeScheduleForm = ({ employees, departments, onSubmit }) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Format today's date for display (e.g., "2024-12-20 8AM-5PM")
    const getCurrentScheduleDefault = () => {
        return `${today} 8AM-5PM`;
    };
    
    // Form state
    const [formData, setFormData] = useState({
        employee_ids: [],
        effective_date: today,
        end_date: today,
        current_schedule: getCurrentScheduleDefault(),
        new_schedule: '',
        new_start_time: '',
        new_end_time: '',
        reason: ''
    });
    
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
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };
    
    // Handle employee selection
    const handleEmployeeSelection = (employeeId) => {
        const numericId = parseInt(employeeId, 10);
        setFormData(prevData => {
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
                // Deselect all displayed employees
                return {
                    ...prevData,
                    employee_ids: prevData.employee_ids.filter(id => !displayedIds.includes(id))
                };
            } else {
                // Select all displayed employees
                const remainingSelectedIds = prevData.employee_ids.filter(id => !displayedIds.includes(id));
                return {
                    ...prevData,
                    employee_ids: [...remainingSelectedIds, ...displayedIds]
                };
            }
        });
    };
    
    // Handle form submission
    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validate form
        if (formData.employee_ids.length === 0) {
            alert('Please select at least one employee');
            return;
        }
        
        if (!formData.effective_date) {
            alert('Please provide an effective date');
            return;
        }
        
        /* if (!formData.new_schedule.trim()) {
            alert('Please provide a new schedule name');
            return;
        } */
        
        if (!formData.new_start_time || !formData.new_end_time) {
            alert('Please provide both start and end times');
            return;
        }
        
        if (!formData.reason.trim()) {
            alert('Please provide a reason for the time schedule change');
            return;
        }
        
        // Call the onSubmit prop with the form data
        onSubmit(formData);
        
        // Reset form after submission 
        setFormData({
            employee_ids: [],
            effective_date: today,
            end_date: today,
            current_schedule: getCurrentScheduleDefault(),
            new_schedule: '',
            new_start_time: '',
            new_end_time: '',
            reason: ''
        });
        
        // Reset filters
        setSearchTerm('');
        setSelectedDepartment('');
    };
    
    // Helper function to get employee name - handles both mapped and direct data
    const getEmployeeName = (employee) => {
        if (employee.name) {
            return employee.name; // Use mapped name if available
        }
        
        // Fallback to constructing name from individual fields
        const firstName = employee.Fname || '';
        const lastName = employee.Lname || '';
        const middleName = employee.MName || '';
        
        let name = lastName;
        if (firstName) {
            name += name ? ', ' + firstName : firstName;
        }
        if (middleName) {
            name += ' ' + middleName;
        }
        
        return name || `Employee #${employee.id}`;
    };
    
    // Helper function to get employee department
    const getEmployeeDepartment = (employee) => {
        return employee.department || employee.Department || '';
    };
    
    // Helper function to get employee position
    const getEmployeePosition = (employee) => {
        return employee.position || employee.Jobtitle || '';
    };
    
    // Calculate if all displayed employees are selected
    const allDisplayedSelected = displayedEmployees.length > 0 && 
        displayedEmployees.every(emp => formData.employee_ids.includes(emp.id));
    
    // Get selected employees details for display
    const selectedEmployees = employees.filter(emp => formData.employee_ids.includes(emp.id));
    
    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">File Time Schedule Change Request</h3>
                <p className="text-sm text-gray-500">Create time schedule change request for one or multiple employees</p>
            </div>
            
            <div onSubmit={handleSubmit}>
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
                            
                            <div className="md:flex-initial">
                                <button
                                    type="button"
                                    className={`w-full px-4 py-2 rounded-md ${
                                        allDisplayedSelected 
                                            ? 'bg-indigo-700 hover:bg-indigo-800' 
                                            : 'bg-indigo-500 hover:bg-indigo-600'
                                    } text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                                    onClick={handleSelectAll}
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
                                                }`}
                                                onClick={() => handleEmployeeSelection(employee.id)}
                                            >
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                                        checked={formData.employee_ids.includes(employee.id)}
                                                        onChange={(e) => handleCheckboxChange(e, employee.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                    {employee.idno || ''}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {getEmployeeName(employee)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                    {getEmployeeDepartment(employee)}
                                                </td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                                    {getEmployeePosition(employee)}
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
                                            ({selectedEmployees.map(emp => {
                                                const name = getEmployeeName(emp);
                                                return name.split(',')[0]; // Get last name only for display
                                            }).join(', ')})
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-yellow-600">No employees selected</span>
                            )}
                        </div>
                    </div>
                    
                    {/* Time Schedule Change Details Section */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Schedule Change Details</h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="effective_date" className="block text-sm font-medium text-gray-700 mb-1">
                                    Effective Date <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="date"
                                    id="effective_date"
                                    name="effective_date"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.effective_date}
                                    onChange={handleChange}
                                    required
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    The date when the new schedule will start
                                </p>
                            </div>
                            
                            <div>
                                <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    id="end_date"
                                    name="end_date"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.end_date}
                                    onChange={handleChange}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Optional: Leave blank if this is a permanent change
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Time Schedule Information</h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="current_schedule" className="block text-sm font-medium text-gray-700 mb-1">
                                    Current Schedule
                                </label>
                                <input
                                    type="text"
                                    id="current_schedule"
                                    name="current_schedule"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.current_schedule}
                                    onChange={handleChange}
                                    placeholder="e.g., 2024-12-20 8AM-5PM"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Current date and time schedule (automatically set to today's date)
                                </p>
                            </div>
                            
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="new_start_time" className="block text-sm font-medium text-gray-700 mb-1">
                                        Start Time <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        id="new_start_time"
                                        name="new_start_time"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        value={formData.new_start_time}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label htmlFor="new_end_time" className="block text-sm font-medium text-gray-700 mb-1">
                                        End Time <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        id="new_end_time"
                                        name="new_end_time"
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                        value={formData.new_end_time}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                                    Reason <span className="text-red-600">*</span>
                                </label>
                                <textarea
                                    id="reason"
                                    name="reason"
                                    rows="5"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    placeholder="Provide a detailed reason for the time schedule change request"
                                    value={formData.reason}
                                    onChange={handleChange}
                                    required
                                ></textarea>
                                <p className="mt-1 text-xs text-gray-500">
                                    Please provide a clear justification for changing the time schedule.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 border-t">
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Submit Time Schedule Change Request
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TimeScheduleForm;