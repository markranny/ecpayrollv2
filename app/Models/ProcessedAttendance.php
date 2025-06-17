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
        'retromultiplier',
        'restday',
        'ob', // Add the missing 'ob' field from migration
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
        'retromultiplier' => 'decimal:2',
        'restday' => 'boolean',
        'ob' => 'boolean', // Cast the 'ob' field to boolean
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