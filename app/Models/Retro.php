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
        'hours_days',
        'multiplier_rate',
        'base_rate',
        'computed_amount',
        'original_total_amount',
        'requested_total_amount',
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
        'hours_days' => 'decimal:2',
        'multiplier_rate' => 'decimal:2',
        'base_rate' => 'decimal:2',
        'computed_amount' => 'decimal:2',
        'original_total_amount' => 'decimal:2',
        'requested_total_amount' => 'decimal:2'
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
            'DAYS' => 'Regular Days',
            'OVERTIME' => 'Overtime Hours',
            'SLVL' => 'Sick/Vacation Leave',
            'HOLIDAY' => 'Holiday Work',
            'RD_OT' => 'Rest Day Overtime'
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

    /**
     * Get the unit label based on retro type.
     */
    public function getUnitLabel()
    {
        $units = [
            'DAYS' => 'Days',
            'OVERTIME' => 'Hours',
            'SLVL' => 'Days',
            'HOLIDAY' => 'Hours',
            'RD_OT' => 'Hours'
        ];

        return $units[$this->retro_type] ?? 'Units';
    }

    /**
     * Get default multiplier rates for different retro types.
     */
    public static function getDefaultMultipliers()
    {
        return [
            'DAYS' => 1.0,
            'OVERTIME' => 1.25,
            'SLVL' => 1.0,
            'HOLIDAY' => 2.0,
            'RD_OT' => 1.3
        ];
    }

    /**
     * Calculate the computed amount based on hours/days, multiplier, and base rate.
     */
    public function calculateComputedAmount()
    {
        if ($this->hours_days && $this->multiplier_rate && $this->base_rate) {
            return $this->hours_days * $this->multiplier_rate * $this->base_rate;
        }
        return 0;
    }

    /**
     * Auto-calculate computed amount before saving.
     */
    protected static function boot()
    {
        parent::boot();

        static::saving(function ($retro) {
            $retro->computed_amount = $retro->calculateComputedAmount();
        });
    }

    /**
     * Get retro type validation rules.
     */
    public static function getRetroTypeValidationRule()
    {
        return 'required|string|in:DAYS,OVERTIME,SLVL,HOLIDAY,RD_OT';
    }

    /**
     * Get multiplier validation rules based on retro type.
     */
    public static function getMultiplierValidationRule()
    {
        return 'required|numeric|min:0.1|max:10';
    }
}