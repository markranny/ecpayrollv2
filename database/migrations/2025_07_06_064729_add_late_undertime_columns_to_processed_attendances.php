<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('processed_attendances', function (Blueprint $table) {
            // Add missing late_minutes and undertime_minutes columns
            if (!Schema::hasColumn('processed_attendances', 'late_minutes')) {
                $table->decimal('late_minutes', 5, 2)->default(0)->after('hours_worked')
                    ->comment('Minutes late for time in');
            }
            
            if (!Schema::hasColumn('processed_attendances', 'undertime_minutes')) {
                $table->decimal('undertime_minutes', 5, 2)->default(0)->after('late_minutes')
                    ->comment('Minutes of undertime (early out)');
            }
            
            // Add night shift indicator (already exists in is_nightshift, but adding computed column for display)
            if (!Schema::hasColumn('processed_attendances', 'is_night_shift_display')) {
                $table->boolean('is_night_shift_display')->default(false)->after('is_nightshift')
                    ->comment('Display indicator for night shift');
            }
            
            // Add posting status
            if (!Schema::hasColumn('processed_attendances', 'posting_status')) {
                $table->enum('posting_status', ['not_posted', 'posted'])->default('not_posted')->after('source')
                    ->comment('Whether this record has been posted to payroll');
            }
            
            if (!Schema::hasColumn('processed_attendances', 'posted_at')) {
                $table->timestamp('posted_at')->nullable()->after('posting_status')
                    ->comment('When this record was posted');
            }
            
            if (!Schema::hasColumn('processed_attendances', 'posted_by')) {
                $table->foreignId('posted_by')->nullable()->after('posted_at')
                    ->constrained('users')->comment('User who posted this record');
            }
        });
        
        // Add indexes separately with existence checks
        $this->addIndexIfNotExists('processed_attendances', ['late_minutes'], 'idx_processed_late_minutes');
        $this->addIndexIfNotExists('processed_attendances', ['undertime_minutes'], 'idx_processed_undertime_minutes');
        $this->addIndexIfNotExists('processed_attendances', ['posting_status'], 'idx_processed_posting_status');
        $this->addIndexIfNotExists('processed_attendances', ['posted_at'], 'idx_processed_posted_at');
    }

    /**
     * Add index if it doesn't exist
     */
    private function addIndexIfNotExists(string $table, array $columns, string $indexName): void
    {
        $indexExists = DB::select(
            "SELECT COUNT(*) as count FROM information_schema.statistics 
             WHERE table_schema = ? AND table_name = ? AND index_name = ?",
            [config('database.connections.mysql.database'), $table, $indexName]
        );
        
        if ($indexExists[0]->count == 0) {
            Schema::table($table, function (Blueprint $table) use ($columns, $indexName) {
                $table->index($columns, $indexName);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('processed_attendances', function (Blueprint $table) {
            // Drop indexes first (with existence checks)
            $this->dropIndexIfExists('processed_attendances', 'idx_processed_late_minutes');
            $this->dropIndexIfExists('processed_attendances', 'idx_processed_undertime_minutes');
            $this->dropIndexIfExists('processed_attendances', 'idx_processed_posting_status');
            $this->dropIndexIfExists('processed_attendances', 'idx_processed_posted_at');
            
            // Drop foreign key constraint
            if (Schema::hasColumn('processed_attendances', 'posted_by')) {
                $table->dropForeign(['posted_by']);
            }
            
            // Drop the columns
            $table->dropColumn([
                'late_minutes',
                'undertime_minutes',
                'is_night_shift_display',
                'posting_status',
                'posted_at',
                'posted_by'
            ]);
        });
    }
    
    /**
     * Drop index if it exists
     */
    private function dropIndexIfExists(string $table, string $indexName): void
    {
        $indexExists = DB::select(
            "SELECT COUNT(*) as count FROM information_schema.statistics 
             WHERE table_schema = ? AND table_name = ? AND index_name = ?",
            [config('database.connections.mysql.database'), $table, $indexName]
        );
        
        if ($indexExists[0]->count > 0) {
            Schema::table($table, function (Blueprint $table) use ($indexName) {
                $table->dropIndex($indexName);
            });
        }
    }
};