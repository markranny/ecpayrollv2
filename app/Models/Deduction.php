<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Deduction extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'advance',
        'charge_store',
        'charge',
        'meals',
        'miscellaneous',
        'other_deductions',
        'cutoff',
        'date',
        'date_posted',
        'is_posted',
        'is_default'
    ];

    protected $casts = [
        'advance' => 'decimal:2',
        'charge_store' => 'decimal:2',
        'charge' => 'decimal:2',
        'meals' => 'decimal:2',
        'miscellaneous' => 'decimal:2',
        'other_deductions' => 'decimal:2',
        'date' => 'date',
        'date_posted' => 'date',
        'is_posted' => 'boolean',
        'is_default' => 'boolean'
    ];

    // Define the relationship with the Employee model
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    // Scope for first cutoff (dates 1-15)
    public function scopeFirstCutoff($query)
    {
        return $query->where('cutoff', '1st');
    }

    // Scope for second cutoff (dates 16-31)
    public function scopeSecondCutoff($query)
    {
        return $query->where('cutoff', '2nd');
    }

    // Scope for posted deductions
    public function scopePosted($query)
    {
        return $query->where('is_posted', true);
    }

    // Scope for unposted deductions
    public function scopeUnposted($query)
    {
        return $query->where('is_posted', false);
    }

    // Scope for default deductions
    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }

    // Method to copy values from one deduction to another
    public static function copyFromDefault($employeeId, $cutoff, $date)
    {
        $defaultDeduction = self::where('employee_id', $employeeId)
            ->where('is_default', true)
            ->latest()
            ->first();

        if (!$defaultDeduction) {
            return null;
        }

        // Create a new deduction based on the default one
        return self::create([
            'employee_id' => $employeeId,
            'advance' => $defaultDeduction->advance,
            'charge_store' => $defaultDeduction->charge_store,
            'charge' => $defaultDeduction->charge,
            'meals' => $defaultDeduction->meals,
            'miscellaneous' => $defaultDeduction->miscellaneous,
            'other_deductions' => $defaultDeduction->other_deductions,
            'cutoff' => $cutoff,
            'date' => $date,
            'is_posted' => false,
            'is_default' => false
        ]);
    }

    // Get total deductions for this record
    public function getTotalDeductionsAttribute()
    {
        return $this->advance + $this->charge_store + $this->charge + 
               $this->meals + $this->miscellaneous + $this->other_deductions;
    }
}