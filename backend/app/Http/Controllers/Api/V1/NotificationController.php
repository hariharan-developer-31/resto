<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Notification;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use ApiResponse;

    /**
     * List recent notifications and unread count for the active restaurant/branch.
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

        if (!$restaurantId || !$user->hasRestaurantAccess((int) $restaurantId)) {
            return $this->errorResponse('Unauthorized or missing restaurant context.', 403);
        }

        $branchId = $request->header('X-Branch-ID') ?? $request->input('branch_id');

        $query = Notification::where('restaurant_id', $restaurantId);
        if ($branchId) {
            $query->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->orWhereNull('branch_id');
            });
        }

        $unreadCount = (clone $query)->whereNull('read_at')->count();
        $notifications = $query->latest()->take(20)->get();

        return $this->successResponse([
            'unread_count' => $unreadCount,
            'notifications' => $notifications,
        ], 'Notifications retrieved successfully.');
    }

    /**
     * Mark a single notification as read.
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = Notification::find($id);
        if (!$notification) {
            return $this->errorResponse('Notification not found.', 404);
        }

        if ($notification->restaurant_id && !$request->user()->hasRestaurantAccess($notification->restaurant_id)) {
            return $this->errorResponse('Unauthorized access to this notification.', 403);
        }

        $notification->markAsRead();

        return $this->successResponse($notification, 'Notification marked as read.');
    }

    /**
     * Mark all unread notifications for the active restaurant/branch as read.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();

        $restaurantId = $request->header('X-Restaurant-ID')
            ?? $request->input('restaurant_id')
            ?? $user->restaurants()->first()?->id;

        if (!$restaurantId && $user->isSuperAdmin()) {
            $restaurantId = Branch::first()?->restaurant_id;
        }

        if (!$restaurantId || !$user->hasRestaurantAccess((int) $restaurantId)) {
            return $this->errorResponse('Unauthorized or missing restaurant context.', 403);
        }

        $branchId = $request->header('X-Branch-ID') ?? $request->input('branch_id');

        $query = Notification::where('restaurant_id', $restaurantId)->whereNull('read_at');
        if ($branchId) {
            $query->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->orWhereNull('branch_id');
            });
        }

        $updated = $query->update(['read_at' => now()]);

        return $this->successResponse(['updated_count' => $updated], 'All notifications marked as read.');
    }
}
