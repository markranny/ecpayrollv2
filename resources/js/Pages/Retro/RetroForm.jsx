import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

const RetroForm = ({ employees, departments, onSubmit }) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Form state
    const [formData, setFormData] = useState({
        employee_ids: [],
        retro_type: 'salary',
        adjustment_type: 'increase',
        retro_date: today,
        original_value: '',
        requested_value: '',
        reason: ''
    });
    
    // Filtered employees state
    const [displayedEmployees, setDisplayedEmployees] = useState(employees || []);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    
    // Retro type options
    const retroTypes = [
        { value: 'salary', label: 'Salary Adjustment' },
        { value: 'allowance', label: 'Allowance Adjustment' },
        { value: 'overtime', label: 'Overtime Adjustment' },
        { value: 'bonus', label: 'Bonus Adjustment' },
        { value: 'deduction', label: 'Deduction Adjustment' },
        { value: 'other', label: 'Other Adjustment' }
    ];
    
    // Adjustment type options
    const adjustmentTypes = [
        { value: 'increase', label: 'Increase' },
        { value: 'decrease', label: 'Decrease' },
        { value: 'correction', label: 'Correction' },
        { value: 'backdated', label: 'Backdated Adjustment' }
    ];
    
    // Update displayed employees when search or department selection changes
    useEffect(() => {
        let result = [...employees];
        
        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(employee => 
                (employee.name && employee.name.toLowerCase().includes(term)) ||
                (employee.Fname && employee.Fname.toLowerCase().includes(term)) || 
                (employee.Lname && employee.Lname.toLowerCase().includes(term)) || 
                (employee.idno && employee.idno.toString().includes(term))
            );
        }
        
        // Filter by department
        if (selectedDepartment) {
            result = result.filter(employee => 
                (employee.department === selectedDepartment) ||
                (employee.Department === selectedDepartment)
            );
        }
        
        // Sort selected employees to top
        result.sort((a, b) => {
            const aSelected = formData.employee_ids.includes(a.id);
            const bSelected = formData.employee_ids.includes(b.id);
            
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return 0;
        });
        
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
    
    // Handle form submission
    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validate form
        if (formData.employee_ids.length === 0) {
            alert('Please select at least one employee');
            return;
        }
        
        if (!formData.retro_date) {
            alert('Please select a retro date');
            return;
        }
        
        if (!formData.original_value || !formData.requested_value) {
            alert('Please fill in both original and requested values');
            return;
        }
        
        if (parseFloat(formData.original_value) < 0 || parseFloat(formData.requested_value) < 0) {
            alert('Values cannot be negative');
            return;
        }
        
        if (!formData.reason.trim()) {
            alert('Please provide a reason for the retro adjustment');
            return;
        }
        
        // Call the onSubmit prop with the form data
        onSubmit(formData);
        
        // Reset form after submission 
        setFormData({
            employee_ids: [],
            retro_type: 'salary',
            adjustment_type: 'increase',
            retro_date: today,
            original_value: '',
            requested_value: '',
            reason: ''
        });
        
        // Reset filters
        setSearchTerm('');
        setSelectedDepartment('');
    };
    
    // Helper function to get employee name
    const getEmployeeName = (employee) => {
        if (employee.name) {
            return employee.name;
        }
        
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
                <h3 className="text-lg font-semibold">File Retro Request</h3>
                <p className="text-sm text-gray-500">Create retrospective adjustment request for one or multiple employees</p>
            </div>
            
            <form onSubmit={handleSubmit}>
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
                                                return name.split(',')[0];
                                            }).join(', ')})
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-yellow-600">No employees selected</span>
                            )}
                        </div>
                    </div>
                    
                    {/* Retro Details Section */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Retro Details</h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="retro_type" className="block text-sm font-medium text-gray-700 mb-1">
                                    Retro Type <span className="text-red-600">*</span>
                                </label>
                                <select
                                    id="retro_type"
                                    name="retro_type"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.retro_type}
                                    onChange={handleChange}
                                    required
                                >
                                    {retroTypes.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label htmlFor="adjustment_type" className="block text-sm font-medium text-gray-700 mb-1">
                                    Adjustment Type <span className="text-red-600">*</span>
                                </label>
                                <select
                                    id="adjustment_type"
                                    name="adjustment_type"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.adjustment_type}
                                    onChange={handleChange}
                                    required
                                >
                                    {adjustmentTypes.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label htmlFor="retro_date" className="block text-sm font-medium text-gray-700 mb-1">
                                    Retro Date <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="date"
                                    id="retro_date"
                                    name="retro_date"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.retro_date}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Value Information</h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="original_value" className="block text-sm font-medium text-gray-700 mb-1">
                                    Original Value <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    id="original_value"
                                    name="original_value"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.original_value}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label htmlFor="requested_value" className="block text-sm font-medium text-gray-700 mb-1">
                                    Requested Value <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    id="requested_value"
                                    name="requested_value"
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={formData.requested_value}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                            
                            {formData.original_value && formData.requested_value && (
                                <div className="p-3 bg-blue-50 rounded-md">
                                    <p className="text-sm text-blue-700">
                                        <strong>Difference:</strong> {
                                            (parseFloat(formData.requested_value) - parseFloat(formData.original_value)).toFixed(2)
                                        }
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-medium mb-3">Reason for Adjustment</h4>
                        
                        <div>
                            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                                Reason <span className="text-red-600">*</span>
                            </label>
                            <textarea
                                id="reason"
                                name="reason"
                                rows="4"
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                placeholder="Provide a detailed reason for the retro adjustment request"
                                value={formData.reason}
                                onChange={handleChange}
                                required
                            ></textarea>
                            <p className="mt-1 text-xs text-gray-500">
                                Please provide a clear justification for the retrospective adjustment.
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 border-t">
                    <button
                        type="submit"
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Submit Retro Request
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RetroForm;