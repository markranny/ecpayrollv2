import React, { useState, useRef } from 'react';
import { X, Upload, Download, Calendar, Users, AlertTriangle, CheckCircle, Loader2, FileText, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Import Modal Component
export const ImportModal = ({ isOpen, onClose, onImport }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        setError('File size must be less than 10MB');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setImporting(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      
      const response = await fetch('/attendance/import', {
        method: 'POST',
        headers: {
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        setImportResults(data);
        
        // Call parent callback to refresh data
        if (onImport) {
          onImport();
        }
      } else {
        setError(data.message || 'Import failed');
        if (data.errors && data.errors.length > 0) {
          setError(data.message + '\n\nErrors:\n' + data.errors.join('\n'));
        }
      }
    } catch (err) {
      console.error('Import error:', err);
      setError('Import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  const resetModal = () => {
    setFile(null);
    setError('');
    setSuccess('');
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center space-x-3">
            <Upload className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">Import Attendance Data</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {importResults && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">Import Results:</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Imported:</span> {importResults.imported} records
                </div>
                <div>
                  <span className="font-medium">Updated:</span> {importResults.updated} records
                </div>
                {importResults.errors && importResults.errors.length > 0 && (
                  <div className="col-span-2">
                    <span className="font-medium text-red-600">Errors:</span> {importResults.errors.length}
                    <div className="mt-1 text-xs text-red-600 max-h-20 overflow-y-auto">
                      {importResults.errors.map((error, index) => (
                        <div key={index}>{error}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <h4 className="font-medium mb-2">Import Instructions:</h4>
                <ul className="space-y-1 list-disc ml-4">
                  <li>Use the CSV format with columns: Employee Number, Employee Name, Department, Date, Day, Time In, Break Out, Break In, Time Out, Next Day Timeout, Hours Worked, Night Shift, Trip</li>
                  <li>Time format should be HH:MM (24-hour format, e.g., 08:30, 17:00)</li>
                  <li>Date format should be YYYY-MM-DD (e.g., 2024-12-25)</li>
                  <li>Night Shift should be "Yes" or "No"</li>
                  <li>Hours will be automatically calculated based on time entries</li>
                  <li>Existing records will be updated, new records will be created</li>
                </ul>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select CSV File
              </label>
              <div className="flex items-center space-x-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              {file && (
                <div className="mt-2 text-sm text-gray-600">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || importing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Data
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Holiday Modal Component
export const HolidayModal = ({ isOpen, onClose, onSetHoliday, departments = [] }) => {
  const [date, setDate] = useState('');
  const [multiplier, setMultiplier] = useState('2.0');
  const [department, setDepartment] = useState('');
  const [setting, setSetting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSetHoliday = async () => {
    if (!date) {
      setError('Please select a date');
      return;
    }
    
    if (!multiplier || parseFloat(multiplier) <= 0) {
      setError('Please enter a valid multiplier');
      return;
    }

    setSetting(true);
    setError('');
    setSuccess('');

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
      
      const response = await fetch('/attendance/set-holiday', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          date,
          multiplier: parseFloat(multiplier),
          department: department || null
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data.message);
        
        // Call parent callback to refresh data
        if (onSetHoliday) {
          onSetHoliday();
        }
        
        // Auto-close after 2 seconds
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setError(data.message || 'Failed to set holiday');
      }
    } catch (err) {
      console.error('Set holiday error:', err);
      setError('Failed to set holiday: ' + (err.message || 'Unknown error'));
    } finally {
      setSetting(false);
    }
  };

  const resetModal = () => {
    setDate('');
    setMultiplier('2.0');
    setDepartment('');
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-lg max-w-lg w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center space-x-3">
            <Calendar className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-800">Set Holiday</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <Calendar className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <h4 className="font-medium mb-2">Holiday Setting Rules:</h4>
                <ul className="space-y-1 list-disc ml-4">
                  <li>Holiday multiplier will only be applied to employees who don't have overtime (OT, OT Reg, or OT Spl)</li>
                  <li>Only non-posted attendance records will be affected</li>
                  <li>Common multipliers: 2.0 (Regular Holiday), 1.3 (Special Holiday)</li>
                  <li>You can filter by department or apply to all departments</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Holiday Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Holiday Multiplier <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calculator className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="2.0"
                />
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Common values: 2.0 (Regular Holiday), 1.3 (Special Holiday)
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department (Optional)
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Leave empty to apply to all departments
              </div>
            </div>
          </div>

          {/* Preview */}
          {date && multiplier && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2">Preview:</h4>
              <div className="text-sm text-green-700">
                <div>Date: <span className="font-medium">{new Date(date).toLocaleDateString()}</span></div>
                <div>Multiplier: <span className="font-medium">{multiplier}x</span></div>
                <div>Department: <span className="font-medium">{department || 'All Departments'}</span></div>
                <div className="mt-2 text-xs">
                  This will update all eligible attendance records (no existing overtime) for the selected criteria.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={setting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSetHoliday}
            disabled={!date || !multiplier || setting}
            className="bg-green-600 hover:bg-green-700"
          >
            {setting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting Holiday...
              </>
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                Set Holiday
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;