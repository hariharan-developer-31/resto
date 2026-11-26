<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DiningTable;
use App\Models\Reservation;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReservationController extends Controller
{
    use ApiResponse;

    /**
     * Display a listing of reservations with filtering.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Branch::first()?->restaurant_id;
        }

        if (!$restaurantId) {
            return $this->errorResponse('Please specify an active restaurant context.', 400);
        }

        $query = Reservation::where('restaurant_id', $restaurantId)
            ->with(['table:id,table_number,capacity,status', 'branch:id,name']);

        // Filter by branch
        if ($branchId = $request->header('X-Branch-ID') ?? $request->input('branch_id')) {
            $query->where('branch_id', $branchId);
        }

        // Filter by date
        if ($date = $request->input('date')) {
            $query->whereDate('reservation_date', $date);
        }

        // Filter by status
        if ($status = $request->input('status')) {
            if ($status !== 'all') {
                $query->where('status', $status);
            }
        }

        // Search by customer name or phone
        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('customer_name', 'like', "%{$search}%")
                  ->orWhere('customer_phone', 'like', "%{$search}%")
                  ->orWhere('customer_email', 'like', "%{$search}%");
            });
        }

        $reservations = $query->orderBy('reservation_date', 'asc')
            ->orderBy('reservation_time', 'asc')
            ->paginate($request->input('per_page', 25));

        return $this->successResponse($reservations, 'Reservations retrieved successfully.');
    }

    /**
     * Create a new reservation manually from staff portal.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'restaurant_id' => 'nullable|exists:restaurants,id',
            'branch_id' => 'required|exists:branches,id',
            'table_id' => 'nullable|exists:dining_tables,id',
            'customer_name' => 'required|string|max:100',
            'customer_phone' => 'required|string|max:30',
            'customer_email' => 'nullable|email|max:100',
            'guest_count' => 'required|integer|min:1|max:50',
            'reservation_date' => 'required|date|after_or_equal:today',
            'reservation_time' => 'required|string|max:20',
            'special_requests' => 'nullable|string|max:1000',
        ]);

        $branch = Branch::findOrFail($validated['branch_id']);
        $restaurantId = $validated['restaurant_id'] ?? $branch->restaurant_id;

        // Check table conflict if table specified
        if (!empty($validated['table_id'])) {
            $table = DiningTable::findOrFail($validated['table_id']);
            if ($table->branch_id !== $branch->id) {
                return $this->errorResponse('Selected table does not belong to the chosen branch.', 422);
            }

            if (Reservation::hasTableConflict($table->id, $validated['reservation_date'], $validated['reservation_time'])) {
                return $this->errorResponse('The selected table has a conflicting active reservation at this time slot.', 422);
            }
        }

        $reservation = Reservation::create([
            'restaurant_id' => $restaurantId,
            'branch_id' => $branch->id,
            'table_id' => $validated['table_id'] ?? null,
            'customer_name' => $validated['customer_name'],
            'customer_phone' => $validated['customer_phone'],
            'customer_email' => $validated['customer_email'] ?? null,
            'guest_count' => $validated['guest_count'],
            'reservation_date' => $validated['reservation_date'],
            'reservation_time' => $validated['reservation_time'],
            'status' => 'confirmed',
            'special_requests' => $validated['special_requests'] ?? null,
        ]);

        AuditLog::log(
            'reservation.created',
            $reservation,
            null,
            ['customer_name' => $reservation->customer_name, 'guest_count' => $reservation->guest_count],
            $user
        );

        return $this->successResponse($reservation->load(['table', 'branch']), 'Reservation booked successfully.', 201);
    }

    /**
     * Display a specific reservation.
     */
    public function show(int $id): JsonResponse
    {
        $reservation = Reservation::with(['table', 'branch', 'restaurant'])->findOrFail($id);
        return $this->successResponse($reservation, 'Reservation details retrieved.');
    }

    /**
     * Update reservation details.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $reservation = Reservation::findOrFail($id);

        $validated = $request->validate([
            'table_id' => 'nullable|exists:dining_tables,id',
            'customer_name' => 'sometimes|string|max:100',
            'customer_phone' => 'sometimes|string|max:30',
            'customer_email' => 'nullable|email|max:100',
            'guest_count' => 'sometimes|integer|min:1|max:50',
            'reservation_date' => 'sometimes|date',
            'reservation_time' => 'sometimes|string|max:20',
            'special_requests' => 'nullable|string|max:1000',
            'status' => ['sometimes', Rule::in(['pending', 'confirmed', 'checked_in', 'seated', 'completed', 'cancelled', 'no_show'])],
        ]);

        $date = $validated['reservation_date'] ?? $reservation->reservation_date->toDateString();
        $time = $validated['reservation_time'] ?? $reservation->reservation_time;
        $tableId = array_key_exists('table_id', $validated) ? $validated['table_id'] : $reservation->table_id;

        if ($tableId && ($tableId !== $reservation->table_id || $date !== $reservation->reservation_date->toDateString() || $time !== $reservation->reservation_time)) {
            if (Reservation::hasTableConflict($tableId, $date, $time, $reservation->id)) {
                return $this->errorResponse('The selected table has a conflicting active reservation at this time slot.', 422);
            }
        }

        $old = $reservation->toArray();
        $reservation->update($validated);

        AuditLog::log('reservation.updated', $reservation, $old, $reservation->getChanges(), $user);

        return $this->successResponse($reservation->load(['table', 'branch']), 'Reservation updated successfully.');
    }

    /**
     * Transition reservation status.
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $reservation = Reservation::findOrFail($id);

        $validated = $request->validate([
            'status' => ['required', Rule::in(['pending', 'confirmed', 'checked_in', 'seated', 'completed', 'cancelled', 'no_show'])],
            'table_id' => 'nullable|exists:dining_tables,id',
            'cancellation_reason' => 'nullable|string|max:255',
        ]);

        $newStatus = $validated['status'];

        switch ($newStatus) {
            case 'seated':
                $tableId = $validated['table_id'] ?? $reservation->table_id;
                if (!$tableId) {
                    return $this->errorResponse('Please specify or assign a table before seating the guest.', 422);
                }
                $reservation->seatGuest($tableId);
                break;

            case 'checked_in':
                $reservation->checkInGuest();
                break;

            case 'completed':
                $reservation->completeReservation();
                break;

            case 'cancelled':
                $reason = $validated['cancellation_reason'] ?? 'Cancelled by restaurant staff';
                $reservation->cancelReservation($reason);
                break;

            default:
                $reservation->update(['status' => $newStatus]);
                break;
        }

        AuditLog::log(
            'reservation.status_changed',
            $reservation,
            null,
            ['status' => $newStatus, 'table_id' => $reservation->table_id],
            $user
        );

        return $this->successResponse($reservation->fresh(['table', 'branch']), "Reservation status updated to {$newStatus}.");
    }

    /**
     * Assign a table to a reservation with conflict check.
     */
    public function assignTable(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $reservation = Reservation::findOrFail($id);

        $validated = $request->validate([
            'table_id' => 'required|exists:dining_tables,id',
        ]);

        $table = DiningTable::findOrFail($validated['table_id']);

        if ($table->branch_id !== $reservation->branch_id) {
            return $this->errorResponse('Selected table does not belong to this reservation branch.', 422);
        }

        $date = $reservation->reservation_date instanceof \DateTimeInterface 
            ? $reservation->reservation_date->format('Y-m-d') 
            : (string) $reservation->reservation_date;

        if (Reservation::hasTableConflict($table->id, $date, $reservation->reservation_time, $reservation->id)) {
            return $this->errorResponse('This table already has an active reservation during this time window.', 422);
        }

        $reservation->update(['table_id' => $table->id]);

        AuditLog::log(
            'reservation.table_assigned',
            $reservation,
            null,
            ['table_number' => $table->table_number, 'table_id' => $table->id],
            $user
        );

        return $this->successResponse($reservation->load(['table', 'branch']), "Table {$table->table_number} assigned to reservation.");
    }

    /**
     * Cancel and soft delete reservation.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $reservation = Reservation::findOrFail($id);

        AuditLog::log('reservation.deleted', $reservation, $reservation->toArray(), null, $user);
        $reservation->delete();

        return $this->successResponse(null, 'Reservation deleted successfully.');
    }
}
