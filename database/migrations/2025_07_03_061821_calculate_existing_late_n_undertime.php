<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use App\Models\ProcessedAttendance;
use Carbon\Carbon;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('processed_attendances', 'late_minutes')) {
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->decimal('late_minutes', 5, 2)->default(0)->after('hours_worked')
                    ->comment('Minutes late for time in');
            });
        }

        if (!Schema::hasColumn('processed_attendances', 'undertime_minutes')) {
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->decimal('undertime_minutes', 5, 2)->default(0)->after('late_minutes')
                    ->comment('Minutes of undertime (early out)');
            });
        }

        // ✅ Only add indexes if they don't already exist
        if (!$this->indexExists('processed_attendances', 'idx_processed_late_minutes')) {
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->index(['late_minutes'], 'idx_processed_late_minutes');
            });
        }

        if (!$this->indexExists('processed_attendances', 'idx_processed_undertime_minutes')) {
            Schema::table('processed_attendances', function (Blueprint $table) {
                $table->index(['undertime_minutes'], 'idx_processed_undertime_minutes');
            });
        }

        $this->calculateExistingLateUndertime();
    }

    public function down(): void
    {
        Schema::table('processed_attendances', function (Blueprint $table) {
            $table->dropIndex('idx_processed_late_minutes');
            $table->dropIndex('idx_processed_undertime_minutes');

            if (Schema::hasColumn('processed_attendances', 'late_minutes')) {
                $table->dropColumn('late_minutes');
            }

            if (Schema::hasColumn('processed_attendances', 'undertime_minutes')) {
                $table->dropColumn('undertime_minutes');
            }
        });
    }

    /**
     * Check if a given index exists on a table using raw SQL
     */
    private function indexExists(string $table, string $indexName): bool
    {
        $database = DB::getDatabaseName();
        $result = DB::select(
            'SELECT COUNT(1) AS exists_index FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?',
            [$database, $table, $indexName]
        );

        return isset($result[0]) && $result[0]->exists_index > 0;
    }

    private function calculateExistingLateUndertime()
    {
        echo "Calculating late and undertime for existing attendance records...\n";

        $batchSize = 100;
        $processedCount = 0;

        ProcessedAttendance::whereNotNull('time_in')
            ->chunk($batchSize, function ($attendances) use (&$processedCount) {
                foreach ($attendances as $attendance) {
                    $this->calculateForRecord($attendance);
                    $processedCount++;

                    if ($processedCount % 100 === 0) {
                        echo "Processed {$processedCount} records...\n";
                    }
                }
            });

        echo "Completed calculation for {$processedCount} attendance records.\n";
    }

    private function calculateForRecord($attendance)
    {
        try {
            $lateMinutes = 0;
            $undertimeMinutes = 0;

            $standardStartHour = 8;
            $gracePeriodMinutes = 5;

            if ($attendance->time_in) {
                $timeIn = Carbon::parse($attendance->time_in);
                $attendanceDate = Carbon::parse($attendance->attendance_date);
                $standardStart = $attendanceDate->copy()->setTime($standardStartHour, 0, 0);
                $graceTime = $standardStart->copy()->addMinutes($gracePeriodMinutes);

                if ($timeIn->gt($graceTime)) {
                    $lateMinutes = $timeIn->diffInMinutes($standardStart);
                }
            }

            $timeOut = null;
            if ($attendance->is_nightshift && $attendance->next_day_timeout) {
                $timeOut = Carbon::parse($attendance->next_day_timeout);
            } elseif ($attendance->time_out) {
                $timeOut = Carbon::parse($attendance->time_out);
            }

            if ($timeOut && $attendance->time_in) {
                $timeIn = Carbon::parse($attendance->time_in);
                $totalWorkedMinutes = $timeOut->diffInMinutes($timeIn);

                $breakMinutes = 60;
                if ($attendance->break_out && $attendance->break_in) {
                    $breakOut = Carbon::parse($attendance->break_out);
                    $breakIn = Carbon::parse($attendance->break_in);
                    $breakMinutes = $breakIn->diffInMinutes($breakOut);
                }

                $netWorkedMinutes = $totalWorkedMinutes - $breakMinutes;
                $standardWorkMinutes = 8 * 60;

                if ($netWorkedMinutes < $standardWorkMinutes) {
                    $undertimeMinutes = $standardWorkMinutes - $netWorkedMinutes;
                }
            }

            $attendance->late_minutes = round($lateMinutes, 2);
            $attendance->undertime_minutes = round($undertimeMinutes, 2);
            $attendance->save();

        } catch (\Exception $e) {
            echo "Error calculating for attendance ID {$attendance->id}: " . $e->getMessage() . "\n";
        }
    }
};
