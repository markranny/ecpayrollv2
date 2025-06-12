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
        Schema::create('cancel_rest_days', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->onDelete('cascade');
            $table->date('rest_day_date'); // The rest day being cancelled
            $table->date('replacement_work_date')->nullable(); // Optional replacement work date
            $table->text('reason'); // Reason for cancellation
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->datetime('approved_at')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
            
            // Indexes for better performance
            $table->index(['employee_id', 'status']);
            $table->index(['rest_day_date', 'status']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cancel_rest_days');
    }
};