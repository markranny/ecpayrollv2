<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Benefit extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'mf_shares',
        'mf_loan',
        'sss_loan',
        'hmdf_loan',
        'hmdf_prem',
        'sss_prem',
        'philhealth',
        'allowances', // Added allowances field
        'cutoff',
        'date',
        'date_posted',
        'is_posted',
        'is_default'
    ];

    protected $casts = [
        'mf_shares' => 'decimal:2',
        'mf_loan' => 'decimal:2',
        'sss_loan' => 'decimal:2',
        'hmdf_loan' => 'decimal:2',
        'hmdf_prem' => 'decimal:2',
        'sss_prem' => 'decimal:2',
        'philhealth' => 'decimal:2',
        'allowances' => 'decimal:2', // Added allowances cast
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

    // Scope for posted benefits
    public function scopePosted($query)
    {
        return $query->where('is_posted', true);
    }

    // Scope for unposted benefits
    public function scopeUnposted($query)
    {
        return $query->where('is_posted', false);
    }

    // Scope for default benefits
    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }

    // Method to copy values from one benefit to another
    public static function copyFromDefault($employeeId, $cutoff, $date)
    {
        $defaultBenefit = self::where('employee_id', $employeeId)
            ->where('is_default', true)
            ->latest()
            ->first();

        if (!$defaultBenefit) {
            return null;
        }

        // Create a new benefit based on the default one
        return self::create([
            'employee_id' => $employeeId,
            'mf_shares' => $defaultBenefit->mf_shares,
            'mf_loan' => $defaultBenefit->mf_loan,
            'sss_loan' => $defaultBenefit->sss_loan,
            'hmdf_loan' => $defaultBenefit->hmdf_loan,
            'hmdf_prem' => $defaultBenefit->hmdf_prem,
            'sss_prem' => $defaultBenefit->sss_prem,
            'philhealth' => $defaultBenefit->philhealth,
            'allowances' => $defaultBenefit->allowances, // Copy allowances
            'cutoff' => $cutoff,
            'date' => $date,
            'is_posted' => false,
            'is_default' => false
        ]);
    }

    // Get total benefits amount for this record
    public function getTotalBenefitsAttribute()
    {
        return $this->mf_shares + $this->mf_loan + $this->sss_loan + 
               $this->hmdf_loan + $this->hmdf_prem + $this->sss_prem + 
               $this->philhealth + $this->allowances;
    }
}