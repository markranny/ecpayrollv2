// resources/js/Pages/Timesheet/ManualAttendance.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Calendar, Clock, User, Save, AlertTriangle, Search, Loader2 } from 'lucide-react';

const ManualAttendance = ({ auth, employees = [], departments = [] }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { errors } = usePage().props;
    
    // Form state
    const [formData, setFormData] = useState({
        employee_ids: [], // Changed to array for multiple selection
        attendance_date: new Date().toISOString().split('T')[0],
        time_in: '08:00',
        time_out: '17:00',
        break_in: '',
        break_out: '',
        is_nightshift: false,
        next_day_timeout: '',
        remarks: ''
    });
    
    // Employee selection state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    
    // Enhanced useEffect for employee filtering and sorting
    const displayedEmployees = useMemo(() => {
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
            
            // Check department match
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
        
        return result;
    }, [searchTerm, selectedDepartment, employees, formData.employee_ids]);
    
    // Handle form input changes
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ 
            ...formData, 
            [name]: type === 'checkbox' ? checked : value 
        });
    };
    
    // Handle employee selection (multiple)
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
    
    // Handle department selection for bulk operations
    const handleSelectByDepartment = (department) => {
        // Filter employees by department
        const departmentEmployees = employees.filter(emp => {
            const employeeDepartment = emp.department?.name || emp.Department;
            return employeeDepartment === department;
        });
        const departmentIds = departmentEmployees.map(emp => emp.id);
        
        setFormData(prevData => {
            // Check if all employees from this department are already selected
            const allDeptSelected = departmentIds.every(id => prevData.employee_ids.includes(id));
            
            if (allDeptSelected) {
                // If all are selected, deselect them
                return {
                    ...prevData,
                    employee_ids: prevData.employee_ids.filter(id => !departmentIds.includes(id))
                };
            } else {
                // Select all employees from this department
                const remainingIds = prevData.employee_ids.filter(id => !departmentIds.includes(id));
                return {
                    ...prevData,
                    employee_ids: [...remainingIds, ...departmentIds]
                };
            }
        });
    };
    
    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isSubmitting) return; // Prevent double submission
        
        // Validate form
        if (formData.employee_ids.length === 0) {
            toast.error('Please select at least one employee');
            return;
        }
        
        if (!formData.attendance_date) {
            toast.error('Please select a date');
            return;
        }
        
        if (!formData.time_in || !formData.time_out) {
            toast.error('Please enter both time in and time out');
            return;
        }
        
        // For non-nightshift, check if time_out is after time_in
        if (!formData.is_nightshift) {
            const timeIn = formData.time_in.split(':').map(Number);
            const timeOut = formData.time_out.split(':').map(Number);
            
            if (timeIn[0] > timeOut[0] || (timeIn[0] === timeOut[0] && timeIn[1] >= timeOut[1])) {
                toast.error('Time out must be after time in for regular shifts');
                return;
            }
        }
        
        // For nightshift, require next_day_timeout if no regular time_out
        if (formData.is_nightshift && !formData.next_day_timeout && !formData.time_out) {
            toast.error('Please enter either time out or next day timeout for night shift');
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            // Submit each employee individually
            const results = [];
            const errors = [];
            
            for (const employeeId of formData.employee_ids) {
                try {
                    const payload = {
                        employee_id: employeeId,
                        attendance_date: formData.attendance_date,
                        time_in: formData.time_in,
                        time_out: formData.time_out,
                        break_in: formData.break_in || null,
                        break_out: formData.break_out || null,
                        is_nightshift: formData.is_nightshift,
                        next_day_timeout: formData.is_nightshift ? formData.next_day_timeout : null,
                        remarks: formData.remarks
                    };
                    
                    const response = await fetch(route('attendance.manual.store'), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        results.push(data);
                    } else {
                        const employee = employees.find(emp => emp.id === employeeId);
                        errors.push(`${employee?.Fname} ${employee?.Lname}: ${data.message}`);
                    }
                } catch (error) {
                    const employee = employees.find(emp => emp.id === employeeId);
                    errors.push(`${employee?.Fname} ${employee?.Lname}: Failed to create attendance`);
                }
            }
            
            // Show results
            if (results.length > 0) {
                toast.success(`Successfully created attendance records for ${results.length} employee(s)`);
            }
            
            if (errors.length > 0) {
                errors.forEach(error => toast.error(error));
            }
            
            // Reset form if all successful
            if (errors.length === 0) {
                setFormData({
                    employee_ids: [],
                    attendance_date: formData.attendance_date, // Keep the same date
                    time_in: formData.time_in, // Keep the same times
                    time_out: formData.time_out,
                    break_in: formData.break_in,
                    break_out: formData.break_out,
                    is_nightshift: formData.is_nightshift,
                    next_day_timeout: formData.next_day_timeout,
                    remarks: ''
                });
                setSearchTerm('');
            }
            
        } catch (error) {
            console.error('Error submitting manual attendance:', error);
            toast.error('Error submitting attendance records');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Calculate if all displayed employees are selected
    const allDisplayedSelected = displayedEmployees.length > 0 && 
        displayedEmployees.every(emp => formData.employee_ids.includes(emp.id));
    
    // Get selected employees details for display
    const selectedEmployees = employees.filter(emp => formData.employee_ids.includes(emp.id));
    
    // Get department statistics for quick selection
    const departmentStats = departments.map(dept => {
        const deptEmployees = employees.filter(emp => {
            const employeeDepartment = emp.department?.name || emp.Department;
            return employeeDepartment === dept;
        });
        const selectedFromDept = deptEmployees.filter(emp => formData.employee_ids.includes(emp.id));
        return {
            name: dept,
            total: deptEmployees.length,
            selected: selectedFromDept.length,
            allSelected: deptEmployees.length > 0 && selectedFromDept.length === deptEmployees.length
        };
    });
    
    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Manual Attendance Entry" />
            <div className="flex min-h-screen bg-gray-50/50">
                <Sidebar />
                <div className="flex-1 p-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                            <div className="p-6 bg-white border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-800 mb-6">Manual Attendance Entry</h2>
                                
                                {/* Debug Info - Remove in production */}
                                {process.env.NODE_ENV !== 'production' && errors && Object.keys(errors).length > 0 && (
                                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
                                        <h3 className="text-sm font-medium text-red-800">Validation Errors:</h3>
                                        <ul className="mt-2 text-sm text-red-700">
                                            {Object.entries(errors).map(([key, messages]) => (
                                                <li key={key}><strong>{key}:</strong> {messages}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Form Section */}
                                    <div className="md:col-span-2">
                                        <form onSubmit={handleSubmit} className="space-y-6">
                                            {/* Employee Selection Section */}
                                            <div className="bg-gray-50 p-4 rounded-lg">
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
                                                
                                                {/* Department Quick Selection */}
                                                {departmentStats.length > 0 && (
                                                    <div className="mb-4">
                                                        <div className="text-sm text-gray-600 mb-2">Quick select by department:</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {departmentStats.map(dept => (
                                                                <button
                                                                    key={dept.name}
                                                                    type="button"
                                                                    onClick={() => handleSelectByDepartment(dept.name)}
                                                                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                                        dept.allSelected
                                                                            ? 'bg-indigo-600 text-white'
                                                                            : dept.selected > 0
                                                                                ? 'bg-indigo-100 text-indigo-800'
                                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                    }`}
                                                                    disabled={isSubmitting}
                                                                >
                                                                    {dept.name} ({dept.selected}/{dept.total})
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
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
                                            
                                            <div>
                                                <label htmlFor="attendance_date" className="block text-sm font-medium text-gray-700 mb-1">
                                                    Date
                                                </label>
                                                <div className="relative rounded-md shadow-sm">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <Calendar className="h-5 w-5 text-gray-400" />
                                                    </div>
                                                    <input
                                                        type="date"
                                                        id="attendance_date"
                                                        name="attendance_date"
                                                        className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                        value={formData.attendance_date}
                                                        onChange={handleChange}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* Night Shift Toggle */}
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="is_nightshift"
                                                    name="is_nightshift"
                                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                    checked={formData.is_nightshift}
                                                    onChange={handleChange}
                                                />
                                                <label htmlFor="is_nightshift" className="ml-2 block text-sm text-gray-900">
                                                    Night Shift
                                                </label>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label htmlFor="time_in" className="block text-sm font-medium text-gray-700 mb-1">
                                                        Time In
                                                    </label>
                                                    <div className="relative rounded-md shadow-sm">
                                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                            <Clock className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <input
                                                            type="time"
                                                            id="time_in"
                                                            name="time_in"
                                                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                            value={formData.time_in}
                                                            onChange={handleChange}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div>
                                                    <label htmlFor="time_out" className="block text-sm font-medium text-gray-700 mb-1">
                                                        Time Out
                                                    </label>
                                                    <div className="relative rounded-md shadow-sm">
                                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                            <Clock className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <input
                                                            type="time"
                                                            id="time_out"
                                                            name="time_out"
                                                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                            value={formData.time_out}
                                                            onChange={handleChange}
                                                            required={!formData.is_nightshift}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Break Times */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label htmlFor="break_out" className="block text-sm font-medium text-gray-700 mb-1">
                                                        Break Out (Optional)
                                                    </label>
                                                    <div className="relative rounded-md shadow-sm">
                                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                            <Clock className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <input
                                                            type="time"
                                                            id="break_out"
                                                            name="break_out"
                                                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                            value={formData.break_out}
                                                            onChange={handleChange}
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div>
                                                    <label htmlFor="break_in" className="block text-sm font-medium text-gray-700 mb-1">
                                                        Break In (Optional)
                                                    </label>
                                                    <div className="relative rounded-md shadow-sm">
                                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                            <Clock className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <input
                                                            type="time"
                                                            id="break_in"
                                                            name="break_in"
                                                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                            value={formData.break_in}
                                                            onChange={handleChange}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Next Day Timeout for Night Shift */}
                                            {formData.is_nightshift && (
                                                <div>
                                                    <label htmlFor="next_day_timeout" className="block text-sm font-medium text-gray-700 mb-1">
                                                        Next Day Timeout
                                                    </label>
                                                    <div className="relative rounded-md shadow-sm">
                                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                            <Clock className="h-5 w-5 text-gray-400" />
                                                        </div>
                                                        <input
                                                            type="time"
                                                            id="next_day_timeout"
                                                            name="next_day_timeout"
                                                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                            value={formData.next_day_timeout}
                                                            onChange={handleChange}
                                                        />
                                                    </div>
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        For night shifts, specify when the employee clocked out on the following day.
                                                    </p>
                                                </div>
                                            )}
                                            
                                            <div>
                                                <label htmlFor="remarks" className="block text-sm font-medium text-gray-700 mb-1">
                                                    Remarks (Optional)
                                                </label>
                                                <textarea
                                                    id="remarks"
                                                    name="remarks"
                                                    rows="3"
                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                    placeholder="Add any notes or remarks here..."
                                                    value={formData.remarks}
                                                    onChange={handleChange}
                                                ></textarea>
                                            </div>
                                            
                                            <div className="flex justify-end">
                                                <button
                                                    type="submit"
                                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                    disabled={isSubmitting || formData.employee_ids.length === 0}
                                                >
                                                    {isSubmitting ? (
                                                        <>
                                                            <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                                                            Creating Records...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="-ml-1 mr-2 h-5 w-5" />
                                                            Create Attendance for {formData.employee_ids.length} Employee{formData.employee_ids.length !== 1 ? 's' : ''}
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                    
                                    {/* Instructions Section */}
                                    <div className="bg-gray-50 p-6 rounded-lg">
                                        <h3 className="text-lg font-medium text-gray-900 mb-4">Instructions</h3>
                                        
                                        <div className="space-y-4 text-sm text-gray-600">
                                            <p>
                                                Use this form to manually enter attendance records for multiple employees when biometric data is not available.
                                            </p>
                                            
                                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                                                <div className="flex">
                                                    <div className="flex-shrink-0">
                                                        <AlertTriangle className="h-5 w-5 text-yellow-400" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <p className="text-sm text-yellow-700">
                                                            This should only be used for exceptional cases where the biometric system was not available or malfunctioning.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <h4 className="font-medium text-gray-700">Employee Selection:</h4>
                                                <ul className="list-disc list-inside mt-2 space-y-1">
                                                    <li>Search by name or employee ID</li>
                                                    <li>Filter by department</li>
                                                    <li>Select multiple employees using checkboxes</li>
                                                    <li>Use "Select All" to select all filtered employees</li>
                                                    <li>Use department buttons for quick selection</li>
                                                </ul>
                                            </div>
                                            
                                            <div>
                                                <h4 className="font-medium text-gray-700">Required Fields:</h4>
                                                <ul className="list-disc list-inside mt-2 space-y-1">
                                                    <li>At least one employee</li>
                                                    <li>Date</li>
                                                    <li>Time In</li>
                                                    <li>Time Out (for regular shifts)</li>
                                                </ul>
                                            </div>
                                            
                                            <div>
                                                <h4 className="font-medium text-gray-700">Notes:</h4>
                                                <ul className="list-disc list-inside mt-2 space-y-1">
                                                    <li>Time format is 24-hour (00:00 - 23:59)</li>
                                                    <li>For regular shifts, time out must be after time in</li>
                                                    <li>For night shifts, use the "Next Day Timeout" field</li>
                                                    <li>Break times are optional but both must be filled if used</li>
                                                    <li>All manual entries are marked and can be identified in reports</li>
                                                    <li>Same time settings apply to all selected employees</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <ToastContainer />
        </AuthenticatedLayout>
    );
};

export default ManualAttendance;