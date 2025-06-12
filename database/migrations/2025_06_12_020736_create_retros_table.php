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
        if (!Schema::hasTable('retros')) {
            Schema::create('retros', function (Blueprint $table) {
                $table->id();
                $table->foreignId('employee_id')->constrained()->onDelete('cascade');
                $table->string('retro_type'); // salary, allowance, overtime, bonus, deduction, other
                $table->string('adjustment_type'); // increase, decrease, correction, backdated
                $table->date('retro_date');
                $table->decimal('original_value', 10, 2);
                $table->decimal('requested_value', 10, 2);
                $table->text('reason');
                $table->string('status')->default('pending'); // pending, approved, rejected
                $table->foreignId('approved_by')->nullable()->constrained('users');
                $table->datetime('approved_at')->nullable();
                $table->text('remarks')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users');
                $table->timestamps();
                
                // Indexes for better performance
                $table->index(['employee_id', 'status']);
                $table->index(['retro_type', 'status']);
                $table->index(['retro_date']);
                $table->index('created_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('retros');
    }
};