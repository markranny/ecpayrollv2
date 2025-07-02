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
            // Add offset column after retromultiplier
            $table->decimal('offset', 5, 2)->default(0)->after('retromultiplier')->comment('Offset hours (debit transactions)');
            
            // Change holiday from boolean to decimal to store rate multiplier
            $table->decimal('holiday', 4, 2)->default(0)->change()->comment('Holiday rate multiplier instead of boolean');
            
            // Add indexes for better query performance
            $table->index(['offset'], 'idx_processed_offset');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('processed_attendances', function (Blueprint $table) {
            // Drop index first
            $table->dropIndex('idx_processed_offset');
            
            // Drop the offset column
            $table->dropColumn('offset');
            
            // Change holiday back to boolean
            $table->boolean('holiday')->default(false)->change();
        });
    }
};