<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Retro extends Model
{
    use HasFactory;

    protected $table = 'retros';

    protected $fillable = [
        'employee_id',
        'retro_type',
        'retro_date',
        'adjustment_type',
        'original_value',
        'requested_value',
        'reason',
        'status',
        'approved_by',
        'approved_at',
        'remarks',
        'created_by'
    ];

    protected $casts = [
        'retro_date' => 'date',
        'approved_at' => 'datetime',
        'original_value' => 'decimal:2',
        'requested_value' => 'decimal:2'
    ];

    /**
     * Get the employee that owns the retro request.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    /**
     * Get the user who approved/rejected the request.
     */
    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Get the user who created the request.
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scope for pending requests.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope for approved requests.
     */
    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    /**
     * Scope for rejected requests.
     */
    public function scopeRejected($query)
    {
        return $query->where('status', 'rejected');
    }

    /**
     * Get the status label.
     */
    public function getStatusLabelAttribute()
    {
        return ucfirst($this->status);
    }

    /**
     * Check if the request is pending.
     */
    public function isPending()
    {
        return $this->status === 'pending';
    }

    /**
     * Check if the request is approved.
     */
    public function isApproved()
    {
        return $this->status === 'approved';
    }

    /**
     * Check if the request is rejected.
     */
    public function isRejected()
    {
        return $this->status === 'rejected';
    }

    /**
     * Get the retro type label.
     */
    public function getRetroTypeLabel()
    {
        $types = [
            'salary' => 'Salary Adjustment',
            'allowance' => 'Allowance Adjustment',
            'overtime' => 'Overtime Adjustment',
            'bonus' => 'Bonus Adjustment',
            'deduction' => 'Deduction Adjustment',
            'other' => 'Other Adjustment'
        ];

        return $types[$this->retro_type] ?? ucfirst($this->retro_type);
    }

    /**
     * Get the adjustment type label.
     */
    public function getAdjustmentTypeLabel()
    {
        $types = [
            'increase' => 'Increase',
            'decrease' => 'Decrease',
            'correction' => 'Correction',
            'backdated' => 'Backdated Adjustment'
        ];

        return $types[$this->adjustment_type] ?? ucfirst($this->adjustment_type);
    }
}