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
        Schema::table('overtimes', function (Blueprint $table) {
            // Add rate editing tracking fields
            $table->boolean('rate_edited')->default(false)->after('rate_multiplier')->comment('Track if rate has been manually edited');
            $table->timestamp('rate_edited_at')->nullable()->after('rate_edited')->comment('When rate was last edited');
            $table->foreignId('rate_edited_by')->nullable()->after('rate_edited_at')->constrained('users')->comment('Who edited the rate');
            
            // Add indexes for better query performance
            $table->index(['rate_edited'], 'idx_overtimes_rate_edited');
            $table->index(['rate_edited_at'], 'idx_overtimes_rate_edited_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('overtimes', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex('idx_overtimes_rate_edited');
            $table->dropIndex('idx_overtimes_rate_edited_at');
            
            // Drop foreign key constraint
            $table->dropForeign(['rate_edited_by']);
            
            // Drop the columns
            $table->dropColumn(['rate_edited', 'rate_edited_at', 'rate_edited_by']);
        });
    }
};