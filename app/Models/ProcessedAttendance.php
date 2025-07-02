<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProcessedAttendance extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'employee_id',
        'attendance_date',
        'day',
        'time_in',
        'time_out',
        'break_in',
        'break_out',
        'next_day_timeout',
        'hours_worked',
        'overtime',
        'travel_order',
        'slvl',
        'ct',
        'cs',
        'holiday',
        'ot_reg_holiday',
        'ot_special_holiday',
        'retromultiplier',
        'restday',
        'offset', // Add the new offset field
        'ob',
        'status',
        'source',
        'remarks',
        'is_nightshift',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'attendance_date' => 'date',
        'time_in' => 'datetime',
        'time_out' => 'datetime',
        'break_in' => 'datetime',
        'break_out' => 'datetime',
        'next_day_timeout' => 'datetime',
        'hours_worked' => 'float',
        'overtime' => 'decimal:2',
        'travel_order' => 'decimal:2',
        'slvl' => 'decimal:1',
        'ct' => 'boolean',
        'cs' => 'boolean',
        'holiday' => 'decimal:2', // Changed from boolean to decimal for rate multiplier
        'ot_reg_holiday' => 'decimal:2',
        'ot_special_holiday' => 'decimal:2',
        'retromultiplier' => 'decimal:2',
        'restday' => 'boolean',
        'offset' => 'decimal:2', // Add casting for the new offset field
        'ob' => 'boolean',
        'is_nightshift' => 'boolean',
    ];

    /**
     * Get the employee associated with this attendance record.
     */
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}