<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('processed_attendances', function (Blueprint $table) {
            // Add late/under time tracking
            $table->decimal('late_minutes', 5, 2)->default(0)->after('hours_worked')
                ->comment('Minutes late for time in');
            $table->decimal('undertime_minutes', 5, 2)->default(0)->after('late_minutes')
                ->comment('Minutes of undertime (early out)');
            
            // Add night shift indicator (already exists in is_nightshift, but adding computed column for display)
            $table->boolean('is_night_shift_display')->default(false)->after('is_nightshift')
                ->comment('Display indicator for night shift');
            
            // Add posting status
            $table->enum('posting_status', ['not_posted', 'posted'])->default('not_posted')->after('source')
                ->comment('Whether this record has been posted to payroll');
            $table->timestamp('posted_at')->nullable()->after('posting_status')
                ->comment('When this record was posted');
            $table->foreignId('posted_by')->nullable()->after('posted_at')
                ->constrained('users')->comment('User who posted this record');
            
            // Add indexes for better performance
            $table->index(['late_minutes'], 'idx_processed_late_minutes');
            $table->index(['undertime_minutes'], 'idx_processed_undertime_minutes');
            $table->index(['posting_status'], 'idx_processed_posting_status');
            $table->index(['posted_at'], 'idx_processed_posted_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('processed_attendances', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex('idx_processed_late_minutes');
            $table->dropIndex('idx_processed_undertime_minutes');
            $table->dropIndex('idx_processed_posting_status');
            $table->dropIndex('idx_processed_posted_at');
            
            // Drop foreign key constraint
            $table->dropForeign(['posted_by']);
            
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
};