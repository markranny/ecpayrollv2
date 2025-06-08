<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddForceApprovalFieldsToTravelOrdersTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('travel_orders', function (Blueprint $table) {
            // Force approval fields
            $table->boolean('force_approved')->default(false)->after('approved_at');
            $table->unsignedBigInteger('force_approved_by')->nullable()->after('force_approved');
            $table->timestamp('force_approved_at')->nullable()->after('force_approved_by');
            $table->text('force_approve_remarks')->nullable()->after('force_approved_at');
            
            // Add foreign key constraint for force_approved_by
            $table->foreign('force_approved_by')->references('id')->on('users')->onDelete('set null');
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
            $table->dropForeign(['force_approved_by']);
            
            // Drop the columns
            $table->dropColumn([
                'force_approved',
                'force_approved_by',
                'force_approved_at',
                'force_approve_remarks'
            ]);
        });
    }
}