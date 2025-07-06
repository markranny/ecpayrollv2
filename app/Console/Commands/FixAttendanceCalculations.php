<?php

// Create this file: app/Console/Commands/FixAttendanceCalculations.php
// Generate with: php artisan make:command FixAttendanceCalculations

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ProcessedAttendance;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class FixAttendanceCalculations extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'attendance:fix-calculations 
                            {--date= : Specific date to fix (YYYY-MM-DD)}
                            {--start-date= : Start date for range (YYYY-MM-DD)}
                            {--end-date= : End date for range (YYYY-MM-DD)}
                            {--employee-id= : Specific employee ID to fix}
                            {--dry-run : Show what would be changed without making changes}
                            {--batch-size=100 : Number of records to process at once}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fix late minutes, undertime minutes, and hours worked calculations for all attendance records';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting attendance calculations fix...');
        
        $isDryRun = $this->option('dry-run');
        $batchSize = (int) $this->option('batch-size');
        
        if ($isDryRun) {
            $this->warn('DRY RUN MODE - No changes will be made to the database');
        }
        
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
        $changedCount = 0;
        $errorCount = 0;
        
        // Create progress bar
        $progressBar = $this->output->createProgressBar($totalRecords);
        $progressBar->start();
        
        // Process in chunks to avoid memory issues
        $query->chunk($batchSize, function ($attendances) use (&$processedCount, &$changedCount, &$errorCount, $progressBar, $isDryRun) {
            foreach ($attendances as $attendance) {
                try {
                    // Store original values for comparison
                    $originalLate = $attendance->late_minutes ?? 0;
                    $originalUnder = $attendance->undertime_minutes ?? 0;
                    $originalHours = $attendance->hours_worked ?? 0;
                    
                    // FIXED: Calculate late minutes (NO grace period - 8:00 AM sharp)
                    $lateMinutes = 0;
                    if ($attendance->time_in) {
                        $attendanceDate = Carbon::parse($attendance->attendance_date);
                        $expectedTimeIn = $attendanceDate->copy()->setTime(8, 0, 0); // 8:00 AM exactly
                        $actualTimeIn = Carbon::parse($attendance->time_in);
                        
                        if ($actualTimeIn->gt($expectedTimeIn)) {
                            $lateMinutes = $actualTimeIn->diffInMinutes($expectedTimeIn);
                        }
                    }
                    
                    // FIXED: Calculate undertime minutes
                    $undertimeMinutes = 0;
                    $timeOut = $attendance->is_nightshift && $attendance->next_day_timeout 
                        ? $attendance->next_day_timeout 
                        : $attendance->time_out;
                    
                    if ($attendance->time_in && $timeOut) {
                        $timeIn = Carbon::parse($attendance->time_in);
                        $timeOut = Carbon::parse($timeOut);
                        
                        // Handle next day scenarios for night shifts
                        if ($attendance->is_nightshift && $timeOut->lt($timeIn)) {
                            $timeOut->addDay();
                        }
                        
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
                    
                    // FIXED: Calculate hours worked
                    $hoursWorked = 0;
                    if ($attendance->time_in && $timeOut) {
                        $timeIn = Carbon::parse($attendance->time_in);
                        $timeOut = Carbon::parse($timeOut);
                        
                        // Handle next day scenarios for night shifts
                        if ($attendance->is_nightshift && $timeOut->lt($timeIn)) {
                            $timeOut->addDay();
                        }
                        
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
                    
                    // Check if values changed
                    $hasChanges = (
                        abs($originalLate - $lateMinutes) > 0.01 ||
                        abs($originalUnder - $undertimeMinutes) > 0.01 ||
                        abs($originalHours - $hoursWorked) > 0.01
                    );
                    
                    if ($hasChanges) {
                        $changedCount++;
                        
                        if ($isDryRun) {
                            // Show what would change in dry run mode
                            $this->line('');
                            $this->info("Would update Attendance ID {$attendance->id} (Employee: {$attendance->employee_id}):");
                            $this->line("  Late Minutes: {$originalLate} → {$lateMinutes}");
                            $this->line("  Undertime Minutes: {$originalUnder} → {$undertimeMinutes}");
                            $this->line("  Hours Worked: {$originalHours} → {$hoursWorked}");
                        } else {
                            // Update the record
                            DB::table('processed_attendances')
                                ->where('id', $attendance->id)
                                ->update([
                                    'late_minutes' => $lateMinutes,
                                    'undertime_minutes' => $undertimeMinutes,
                                    'hours_worked' => $hoursWorked,
                                    'updated_at' => now()
                                ]);
                        }
                    }
                    
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
        
        $this->info("Processing completed!");
        $this->info("Total processed: {$processedCount} records");
        $this->info("Records that " . ($isDryRun ? 'would be' : 'were') . " changed: {$changedCount}");
        
        if ($errorCount > 0) {
            $this->warn("Errors: {$errorCount} records");
        }
        
        if ($isDryRun && $changedCount > 0) {
            $this->info("Run the command without --dry-run to apply these changes");
        }
        
        return Command::SUCCESS;
    }
}