<?php
// Create this file: app/Console/Commands/RecalculateAttendanceMetrics.php
// Generate with: php artisan make:command RecalculateAttendanceMetrics

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ProcessedAttendance;
use Carbon\Carbon;

class RecalculateAttendanceMetrics extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'attendance:recalculate 
                            {--date= : Specific date to recalculate (YYYY-MM-DD)}
                            {--start-date= : Start date for range (YYYY-MM-DD)}
                            {--end-date= : End date for range (YYYY-MM-DD)}
                            {--employee-id= : Specific employee ID to recalculate}
                            {--force : Force recalculation even if already calculated}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculate late minutes, undertime minutes, and hours worked for attendance records';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting attendance metrics recalculation...');
        
        // Build query based on options
        $query = ProcessedAttendance::whereNotNull('time_in');
        
        if ($this->option('date')) {
            $query->whereDate('attendance_date', $this->option('date'));
            $this->info('Filtering by date: ' . $this->option('date'));
        } elseif ($this->option('start-date') && $this->option('end-date')) {
            $query->whereBetween('attendance_date', [
                $this->option('start-date'),
                $this->option('end-date')
            ]);
            $this->info('Filtering by date range: ' . $this->option('start-date') . ' to ' . $this->option('end-date'));
        }
        
        if ($this->option('employee-id')) {
            $query->where('employee_id', $this->option('employee-id'));
            $this->info('Filtering by employee ID: ' . $this->option('employee-id'));
        }
        
        $totalRecords = $query->count();
        $this->info("Found {$totalRecords} records to process");
        
        if ($totalRecords === 0) {
            $this->warn('No records found to process');
            return Command::SUCCESS;
        }
        
        $processedCount = 0;
        $errorCount = 0;
        
        // Create progress bar
        $progressBar = $this->output->createProgressBar($totalRecords);
        $progressBar->start();
        
        // Process in chunks to avoid memory issues
        $query->chunk(100, function ($attendances) use (&$processedCount, &$errorCount, $progressBar) {
            foreach ($attendances as $attendance) {
                try {
                    // Calculate late minutes (no grace period)
                    $lateMinutes = 0;
                    if ($attendance->time_in) {
                        $attendanceDate = Carbon::parse($attendance->attendance_date);
                        $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0); // 8:00 AM
                        $actualTimeIn = Carbon::parse($attendance->time_in);
                        
                        if ($actualTimeIn->gt($expectedTimeIn)) {
                            $lateMinutes = $actualTimeIn->diffInMinutes($expectedTimeIn);
                        }
                    }
                    
                    // Calculate undertime minutes
                    $undertimeMinutes = 0;
                    $timeOut = $attendance->is_nightshift && $attendance->next_day_timeout 
                        ? $attendance->next_day_timeout 
                        : $attendance->time_out;
                    
                    if ($attendance->time_in && $timeOut) {
                        $timeIn = Carbon::parse($attendance->time_in);
                        $timeOut = Carbon::parse($timeOut);
                        
                        // Calculate total worked minutes
                        $totalWorkedMinutes = $timeOut->diffInMinutes($timeIn);
                        
                        // Subtract break time
                        $breakMinutes = 60; // Default 1-hour break
                        if ($attendance->break_out && $attendance->break_in) {
                            $breakOut = Carbon::parse($attendance->break_out);
                            $breakIn = Carbon::parse($attendance->break_in);
                            if ($breakIn->gt($breakOut)) {
                                $breakMinutes = $breakIn->diffInMinutes($breakOut);
                            }
                        }
                        
                        $netWorkedMinutes = max(0, $totalWorkedMinutes - $breakMinutes);
                        $standardWorkMinutes = 8 * 60; // 8 hours = 480 minutes
                        
                        if ($netWorkedMinutes < $standardWorkMinutes) {
                            $undertimeMinutes = $standardWorkMinutes - $netWorkedMinutes;
                        }
                    }
                    
                    // Calculate hours worked
                    $hoursWorked = 0;
                    if ($attendance->time_in && $timeOut) {
                        $timeIn = Carbon::parse($attendance->time_in);
                        $timeOut = Carbon::parse($timeOut);
                        
                        $totalWorkedMinutes = $timeOut->diffInMinutes($timeIn);
                        
                        // Subtract break time
                        $breakMinutes = 60;
                        if ($attendance->break_out && $attendance->break_in) {
                            $breakOut = Carbon::parse($attendance->break_out);
                            $breakIn = Carbon::parse($attendance->break_in);
                            if ($breakIn->gt($breakOut)) {
                                $breakMinutes = $breakIn->diffInMinutes($breakOut);
                            }
                        }
                        
                        $netWorkedMinutes = max(0, $totalWorkedMinutes - $breakMinutes);
                        $hoursWorked = round($netWorkedMinutes / 60, 2);
                    }
                    
                    // Update the record
                    $attendance->update([
                        'late_minutes' => $lateMinutes,
                        'undertime_minutes' => $undertimeMinutes,
                        'hours_worked' => $hoursWorked
                    ]);
                    
                    $processedCount++;
                    
                } catch (\Exception $e) {
                    $errorCount++;
                    $this->error("Error processing attendance ID {$attendance->id}: " . $e->getMessage());
                }
                
                $progressBar->advance();
            }
        });
        
        $progressBar->finish();
        $this->newLine();
        
        $this->info("Recalculation completed!");
        $this->info("Processed: {$processedCount} records");
        
        if ($errorCount > 0) {
            $this->warn("Errors: {$errorCount} records");
        }
        
        return Command::SUCCESS;
    }
}