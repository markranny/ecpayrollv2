import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Sidebar from '@/Components/Sidebar';
import { 
  Search, Calendar, Filter, Download, Trash2, RefreshCw, Users, 
  Calculator, FileText, AlertTriangle, CheckCircle, Clock, Target, 
  Eye, X, User, Building, DollarSign, TrendingUp, Edit, Check, 
  XCircle, Play, Pause, CreditCard, BarChart3, FileSpreadsheet,
  PlusCircle, Settings, Award, AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Final Payroll Detail Modal
const FinalPayrollDetailModal = ({ isOpen, payroll, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [calculationBreakdown, setCalculationBreakdown] = useState(null);

  useEffect(() => {
    if (isOpen && payroll) {
      setFormData({
        basic_rate: payroll.basic_rate || 0,
        pay_allowance: payroll.pay_allowance || 0,
        other_earnings: payroll.other_earnings || 0,
        advance_deduction: payroll.advance_deduction || 0,
        charge_store: payroll.charge_store || 0,
        charge_deduction: payroll.charge_deduction || 0,
        meals_deduction: payroll.meals_deduction || 0,
        miscellaneous_deduction: payroll.miscellaneous_deduction || 0,
        other_deductions: payroll.other_deductions || 0,
        calculation_notes: payroll.calculation_notes || ''
      });
      loadCalculationBreakdown();
    }
  }, [isOpen, payroll]);

  const loadCalculationBreakdown = async () => {
    try {
      const response = await fetch(`/final-payrolls/${payroll.id}/calculation-breakdown`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCalculationBreakdown(data.data);
        }
      }
    } catch (err) {
      console.error('Error loading calculation breakdown:', err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/final-payrolls/${payroll.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        setEditing(false);
        onUpdate();
        await loadCalculationBreakdown();
      } else {
        alert(data.message || 'Failed to update payroll');
      }
    } catch (err) {
      console.error('Error updating payroll:', err);
      alert('Failed to update payroll');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatNumber = (num, decimals = 2) => {
    return parseFloat(num || 0).toFixed(decimals);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-lg max-w-6xl w-full mx-4 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-semibold text-gray-800">
              Final Payroll Details
            </h2>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              payroll?.status === 'paid' 
                ? 'bg-green-100 text-green-800'
                : payroll?.status === 'finalized'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {payroll?.status?.charAt(0).toUpperCase() + payroll?.status?.slice(1)}
            </span>
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              payroll?.approval_status === 'approved' 
                ? 'bg-green-100 text-green-800'
                : payroll?.approval_status === 'rejected'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {payroll?.approval_status?.charAt(0).toUpperCase() + payroll?.approval_status?.slice(1)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {payroll?.is_editable && !editing && (
              <Button
                onClick={() => setEditing(true)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            
            {editing && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
                <Button
                  onClick={() => setEditing(false)}
                  size="sm"
                  variant="outline"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </>
            )}
            
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Employee Information */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Employee Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Employee</label>
                <p className="text-gray-900 font-medium">{payroll?.employee_name}</p>
                <p className="text-sm text-gray-500">{payroll?.employee_no}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Department</label>
                <p className="text-gray-900">{payroll?.department}</p>
                <p className="text-sm text-gray-500">{payroll?.line}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Period</label>
                <p className="text-gray-900">{payroll?.full_period}</p>
                <p className="text-sm text-gray-500">Cost Center: {payroll?.cost_center || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Pay Type:</span>
                  <span className="font-medium">{payroll?.pay_type || 'Daily'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Basic Rate:</span>
                  {editing ? (
                    <input
                      type="number"
                      step="0.01"
                      value={formData.basic_rate}
                      onChange={(e) => handleInputChange('basic_rate', e.target.value)}
                      className="w-24 px-2 py-1 border rounded text-right"
                    />
                  ) : (
                    <span className="font-medium">{formatCurrency(payroll?.basic_rate)}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Days Worked:</span>
                  <span className="font-medium">{formatNumber(payroll?.days_worked, 1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Hours Worked:</span>
                  <span className="font-medium">{formatNumber(payroll?.hours_worked)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Is Taxable:</span>
                  <span className="font-medium">{payroll?.is_taxable ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Attendance Summary</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Late/Under (Hours):</span>
                  <span className="font-medium text-red-600">{formatNumber(payroll?.late_under_hours)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">SLVL Days:</span>
                  <span className="font-medium">{formatNumber(payroll?.slvl_days, 1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Absence Days:</span>
                  <span className="font-medium text-red-600">{formatNumber(payroll?.absence_days, 1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Trip Count:</span>
                  <span className="font-medium">{formatNumber(payroll?.trip_count, 1)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Earnings Breakdown */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Earnings Breakdown
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Basic & Allowances</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Basic Pay:</span>
                    <span className="font-medium">{formatCurrency(payroll?.basic_pay)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pay Allowance:</span>
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={formData.pay_allowance}
                        onChange={(e) => handleInputChange('pay_allowance', e.target.value)}
                        className="w-20 px-1 py-0.5 border rounded text-right text-xs"
                      />
                    ) : (
                      <span className="font-medium">{formatCurrency(payroll?.pay_allowance)}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Other Allowances:</span>
                    <span className="font-medium">{formatCurrency(payroll?.allowances)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Other Earnings:</span>
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={formData.other_earnings}
                        onChange={(e) => handleInputChange('other_earnings', e.target.value)}
                        className="w-20 px-1 py-0.5 border rounded text-right text-xs"
                      />
                    ) : (
                      <span className="font-medium">{formatCurrency(payroll?.other_earnings)}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Overtime & Premium</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Regular OT:</span>
                    <span className="font-medium">{formatCurrency(payroll?.ot_regular_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rest Day OT:</span>
                    <span className="font-medium">{formatCurrency(payroll?.ot_rest_day_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Holiday OT:</span>
                    <span className="font-medium">{formatCurrency(payroll?.ot_regular_holiday_amount + payroll?.ot_special_holiday_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>NSD Premium:</span>
                    <span className="font-medium">{formatCurrency(payroll?.nsd_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Holiday Premium:</span>
                    <span className="font-medium">{formatCurrency(payroll?.holiday_amount)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Additional Earnings</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>SLVL Amount:</span>
                    <span className="font-medium">{formatCurrency(payroll?.slvl_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Travel Order:</span>
                    <span className="font-medium">{formatCurrency(payroll?.travel_order_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Offset Amount:</span>
                    <span className="font-medium">{formatCurrency(payroll?.offset_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Trip Allowance:</span>
                    <span className="font-medium">{formatCurrency(payroll?.trip_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Retro Amount:</span>
                    <span className="font-medium">{formatCurrency(payroll?.retro_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-green-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-800">Gross Earnings:</span>
                <span className="text-xl font-bold text-green-600">{formatCurrency(payroll?.gross_earnings)}</span>
              </div>
            </div>
          </div>

          {/* Deductions Breakdown */}
          <div className="bg-red-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Deductions Breakdown
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Government Deductions</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>SSS Contribution:</span>
                    <span className="font-medium">{formatCurrency(payroll?.sss_contribution)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PhilHealth:</span>
                    <span className="font-medium">{formatCurrency(payroll?.philhealth_contribution)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HDMF/Pag-IBIG:</span>
                    <span className="font-medium">{formatCurrency(payroll?.hdmf_contribution)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Withholding Tax:</span>
                    <span className="font-medium">{formatCurrency(payroll?.withholding_tax)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Gov't Total:</span>
                    <span>{formatCurrency(payroll?.total_government_deductions)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Company Deductions</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>MF Shares:</span>
                    <span className="font-medium">{formatCurrency(payroll?.mf_shares)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MF Loan:</span>
                    <span className="font-medium">{formatCurrency(payroll?.mf_loan)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SSS Loan:</span>
                    <span className="font-medium">{formatCurrency(payroll?.sss_loan)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HDMF Loan:</span>
                    <span className="font-medium">{formatCurrency(payroll?.hdmf_loan)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t pt-1">
                    <span>Company Total:</span>
                    <span>{formatCurrency(payroll?.total_company_deductions)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 mb-2">Other Deductions</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Cash Advance:</span>
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={formData.advance_deduction}
                        onChange={(e) => handleInputChange('advance_deduction', e.target.value)}
                        className="w-20 px-1 py-0.5 border rounded text-right text-xs"
                      />
                    ) : (
                      <span className="font-medium">{formatCurrency(payroll?.advance_deduction)}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Store Charge:</span>
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={formData.charge_store}
                        onChange={(e) => handleInputChange('charge_store', e.target.value)}
                        className="w-20 px-1 py-0.5 border rounded text-right text-xs"
                      />
                    ) : (
                      <span className="font-medium">{formatCurrency(payroll?.charge_store)}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Meals:</span>
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={formData.meals_deduction}
                        onChange={(e) => handleInputChange('meals_deduction', e.target.value)}
                        className="w-20 px-1 py-0.5 border rounded text-right text-xs"
                      />
                    ) : (
                      <span className="font-medium">{formatCurrency(payroll?.meals_deduction)}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Late/Under:</span>
                    <span className="font-medium">{formatCurrency(payroll?.late_under_deduction)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Miscellaneous:</span>
                    {editing ? (
                      <input
                        type="number"
                        step="0.01"
                        value={formData.miscellaneous_deduction}
                        onChange={(e) => handleInputChange('miscellaneous_deduction', e.target.value)}
                        className="w-20 px-1 py-0.5 border rounded text-right text-xs"
                      />
                    ) : (
                      <span className="font-medium">{formatCurrency(payroll?.miscellaneous_deduction)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-red-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-800">Total Deductions:</span>
                <span className="text-xl font-bold text-red-600">{formatCurrency(payroll?.total_deductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Pay Summary */}
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Net Pay</h3>
              <div className="text-4xl font-bold text-blue-600 mb-4">
                {formatCurrency(payroll?.net_pay)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-gray-600">Gross Earnings</div>
                  <div className="font-semibold text-green-600">{formatCurrency(payroll?.gross_earnings)}</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-600">Total Deductions</div>
                  <div className="font-semibold text-red-600">({formatCurrency(payroll?.total_deductions)})</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-600">Taxable Income</div>
                  <div className="font-semibold text-gray-800">{formatCurrency(payroll?.taxable_income)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Calculation Notes */}
          {editing && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Calculation Notes</h4>
              <textarea
                value={formData.calculation_notes}
                onChange={(e) => handleInputChange('calculation_notes', e.target.value)}
                placeholder="Add any notes about manual adjustments or special calculations..."
                className="w-full h-20 px-3 py-2 border rounded-lg resize-none"
              />
            </div>
          )}

          {/* Audit Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Creation Info</h4>
              <div className="space-y-1 text-sm">
                <div>Created: {new Date(payroll?.created_at).toLocaleString()}</div>
                <div>Created by: {payroll?.creator?.name}</div>
                {payroll?.has_adjustments && (
                  <div className="text-orange-600 font-medium">⚠ Has manual adjustments</div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Approval Info</h4>
              <div className="space-y-1 text-sm">
                {payroll?.approved_at && (
                  <>
                    <div>Approved: {new Date(payroll.approved_at).toLocaleString()}</div>
                    <div>Approved by: {payroll?.approver?.name}</div>
                    {payroll?.approval_remarks && (
                      <div className="text-gray-600">Remarks: {payroll.approval_remarks}</div>
                    )}
                  </>
                )}
                {payroll?.finalized_at && (
                  <>
                    <div>Finalized: {new Date(payroll.finalized_at).toLocaleString()}</div>
                    <div>Finalized by: {payroll?.finalizer?.name}</div>
                  </>
                )}
                {payroll?.paid_at && (
                  <>
                    <div>Paid: {new Date(payroll.paid_at).toLocaleString()}</div>
                    <div>Paid by: {payroll?.paid_by?.name}</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Calculation Breakdown */}
          {calculationBreakdown && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Detailed Calculation Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <h5 className="font-medium mb-2">Basic Calculation</h5>
                  <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
                    {JSON.stringify(calculationBreakdown.basic_calculation, null, 2)}
                  </pre>
                </div>
                <div>
                  <h5 className="font-medium mb-2">Overtime Calculation</h5>
                  <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
                    {JSON.stringify(calculationBreakdown.overtime_calculation, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Final Payroll Component
const FinalPayroll = ({ auth }) => {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filter state
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [periodType, setPeriodType] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departments, setDepartments] = useState([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [perPage, setPerPage] = useState(25);
  
  // Statistics
  const [statistics, setStatistics] = useState(null);

  // Detail modal state
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Generation modal state
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [availableSummaries, setAvailableSummaries] = useState([]);

  // Load final payrolls
  const loadPayrolls = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      params.append('year', year);
      params.append('month', month);
      params.append('page', currentPage);
      params.append('per_page', perPage);
      
      if (periodType) params.append('period_type', periodType);
      if (department) params.append('department', department);
      if (status) params.append('status', status);
      if (approvalStatus) params.append('approval_status', approvalStatus);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await fetch('/final-payrolls?' + params.toString(), {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPayrolls(data.data);
        setTotalPages(data.pagination.last_page);
        setCurrentPage(data.pagination.current_page);
        setStatistics(data.statistics);
        setDepartments(data.departments);
      } else {
        setError('Failed to load final payrolls');
      }
    } catch (err) {
      console.error('Error loading payrolls:', err);
      setError('Error loading final payrolls: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Handle row double-click
  const handleRowDoubleClick = async (payroll) => {
    try {
      const response = await fetch(`/final-payrolls/${payroll.id}`, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSelectedPayroll(data.data);
          setShowDetailModal(true);
        }
      }
    } catch (err) {
      console.error('Error loading payroll details:', err);
    }
  };

  // Handle payroll update
  const handlePayrollUpdate = () => {
    loadPayrolls();
  };

  // Handle generation
  const handleGeneration = async () => {
    try {
      const response = await fetch('/final-payrolls/available-summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content'),
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          year,
          month,
          period_type: periodType || '1st_half',
          department
        })
      });

      const data = await response.json();
      if (data.success) {
        setAvailableSummaries(data.data);
        setShowGenerationModal(true);
      } else {
        setError(data.message || 'Failed to get available summaries');
      }
    } catch (err) {
      console.error('Error getting available summaries:', err);
      setError('Failed to get available summaries');
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      return 'Invalid Date';
    }
  };

  // Load data on component mount and filter changes
  useEffect(() => {
    loadPayrolls();
  }, [year, month, periodType, department, status, approvalStatus, searchTerm, currentPage]);

  return (
    <AuthenticatedLayout user={auth.user}>
      <Head title="Final Payroll" />
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar />
        <div className="flex-1 p-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Final Payroll
                </h1>
                <p className="text-sm text-blue-600 mt-1">
                  💡 Tip: Double-click any row to view detailed payroll information
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleGeneration}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <PlusCircle className="h-4 w-4 mr-1" />
                  Generate
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}

            {/* Filters Card */}
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search by name or ID..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                    <input
                      type="number"
                      min="2020"
                      max="2030"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value))}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={month}
                      onChange={(e) => setMonth(parseInt(e.target.value))}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Period</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={periodType}
                      onChange={(e) => setPeriodType(e.target.value)}
                    >
                      <option value="">All Periods</option>
                      <option value="1st_half">1st Half (1-15)</option>
                      <option value="2nd_half">2nd Half (16-30/31)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    >
                      <option value="">All Departments</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">All Status</option>
                      <option value="draft">Draft</option>
                      <option value="finalized">Finalized</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Approval</label>
                    <select
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={approvalStatus}
                      onChange={(e) => setApprovalStatus(e.target.value)}
                    >
                      <option value="">All Approval Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Statistics */}
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <Users className="h-8 w-8 text-blue-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Employees</p>
                        <p className="text-2xl font-bold text-gray-900">{statistics.total_employees || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <DollarSign className="h-8 w-8 text-green-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Net Pay</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(statistics.total_net_pay)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <TrendingUp className="h-8 w-8 text-orange-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Gross</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(statistics.total_gross_earnings)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center">
                      <AlertCircle className="h-8 w-8 text-red-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Deductions</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(statistics.total_deductions)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Table container */}
            <div className="bg-white rounded-lg shadow">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                  <span className="ml-2 text-lg">Loading...</span>
                </div>
              ) : payrolls.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No final payrolls found</h3>
                  <p className="text-gray-500">Try adjusting your filters or generate payrolls from posted summaries.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Basic Pay</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overtime</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gross</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deductions</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Pay</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {payrolls.map((payroll) => (
                        <tr 
                          key={payroll.id} 
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                          onDoubleClick={() => handleRowDoubleClick(payroll)}
                          title="Double-click to view detailed payroll breakdown"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {payroll.employee_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {payroll.employee_no}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>
                              <div>{payroll.department}</div>
                              <div className="text-xs text-gray-400">{payroll.line}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {payroll.full_period}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {formatCurrency(payroll.basic_pay)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {formatCurrency(payroll.overtime_pay)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {formatCurrency(payroll.gross_earnings)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                            {formatCurrency(payroll.total_deductions)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                            <span className="text-lg text-blue-600">
                              {formatCurrency(payroll.net_pay)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              payroll.status === 'paid' 
                                ? 'bg-green-100 text-green-800'
                                : payroll.status === 'finalized'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {payroll.status === 'paid' && <CreditCard className="h-3 w-3 mr-1" />}
                              {payroll.status === 'finalized' && <CheckCircle className="h-3 w-3 mr-1" />}
                              {payroll.status === 'draft' && <Clock className="h-3 w-3 mr-1" />}
                              {payroll.status.charAt(0).toUpperCase() + payroll.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              payroll.approval_status === 'approved' 
                                ? 'bg-green-100 text-green-800'
                                : payroll.approval_status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {payroll.approval_status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                              {payroll.approval_status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                              {payroll.approval_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                              {payroll.approval_status.charAt(0).toUpperCase() + payroll.approval_status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRowDoubleClick(payroll);
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {payroll.has_adjustments && (
                                <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-orange-100 text-orange-800" title="Has manual adjustments">
                                  <Settings className="h-3 w-3" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 bg-white">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <Button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing page <span className="font-medium">{currentPage}</span> of{' '}
                        <span className="font-medium">{totalPages}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <Button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          variant="outline"
                          size="sm"
                          className="rounded-l-md"
                        >
                          First
                        </Button>
                        <Button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          variant="outline"
                          size="sm"
                        >
                          Previous
                        </Button>
                        
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = currentPage <= 3 
                            ? i + 1 
                            : (currentPage >= totalPages - 2 
                              ? totalPages - 4 + i 
                              : currentPage - 2 + i);
                          
                          if (pageNum > 0 && pageNum <= totalPages) {
                            return (
                              <Button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                className={currentPage === pageNum ? "bg-blue-500 text-white" : ""}
                              >
                                {pageNum}
                              </Button>
                            );
                          }
                          return null;
                        })}
                        
                        <Button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          variant="outline"
                          size="sm"
                        >
                          Next
                        </Button>
                        <Button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          variant="outline"
                          size="sm"
                          className="rounded-r-md"
                        >
                          Last
                        </Button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <FinalPayrollDetailModal
        isOpen={showDetailModal}
        payroll={selectedPayroll}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedPayroll(null);
        }}
        onUpdate={handlePayrollUpdate}
      />
    </AuthenticatedLayout>
  );
};

export default FinalPayroll;