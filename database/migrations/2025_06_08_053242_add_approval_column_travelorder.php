<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('travel_orders', function (Blueprint $table) {
            // Check if columns exist before adding them
            if (!Schema::hasColumn('travel_orders', 'force_approved')) {
                $table->boolean('force_approved')->default(false)->after('approved_at');
            }
            
            if (!Schema::hasColumn('travel_orders', 'force_approved_by')) {
                $table->unsignedBigInteger('force_approved_by')->nullable()->after('force_approved');
            }
            
            if (!Schema::hasColumn('travel_orders', 'force_approved_at')) {
                $table->timestamp('force_approved_at')->nullable()->after('force_approved_by');
            }
            
            if (!Schema::hasColumn('travel_orders', 'force_approve_remarks')) {
                $table->text('force_approve_remarks')->nullable()->after('force_approved_at');
            }
            
            // Add foreign key constraint for force_approved_by
            $existingForeignKeys = collect(Schema::getConnection()->getDoctrineSchemaManager()->listTableForeignKeys('travel_orders'))
                ->map(function ($key) {
                    return $key->getName();
                })->toArray();
            
            if (!in_array('travel_orders_force_approved_by_foreign', $existingForeignKeys)) {
                $table->foreign('force_approved_by')->references('id')->on('users')->onDelete('set null');
            }
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('travel_orders', function (Blueprint $table) {
            // Drop foreign key first
            try {
                $table->dropForeign(['force_approved_by']);
            } catch (\Exception $e) {
                // Foreign key might not exist
            }
            
            // Drop the columns
            $columnsToRemove = [
                'force_approved',
                'force_approved_by',
                'force_approved_at',
                'force_approve_remarks'
            ];
            
            foreach ($columnsToRemove as $column) {
                if (Schema::hasColumn('travel_orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};