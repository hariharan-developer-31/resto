<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    use ApiResponse;

    /**
     * User Login.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'login' => 'required|string',
            'password' => 'required|string',
        ]);

        $loginInput = $request->input('login');
        $user = User::with(['roles.permissions', 'permissions', 'restaurants', 'branches'])
            ->where('email', $loginInput)
            ->orWhere('username', $loginInput)
            ->first();

        if (!$user || !Hash::check($request->input('password'), $user->password)) {
            return $this->errorResponse('Invalid credentials provided.', 401);
        }

        if (!$user->is_active) {
            return $this->errorResponse('Your account has been deactivated. Please contact an administrator.', 403);
        }

        // Update login metadata
        $user->update([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ]);

        // Revoke prior tokens if single session or create fresh token
        $token = $user->createToken('resto_auth_token')->plainTextToken;

        // Log audit record
        AuditLog::log(
            action: 'auth.login',
            auditable: $user,
            userId: $user->id
        );

        $userData = $this->formatUserData($user);

        return $this->successResponse([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $userData,
        ], 'Login successful.');
    }

    /**
     * Get Authenticated User Details.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load(['roles.permissions', 'permissions', 'restaurants', 'branches']);

        return $this->successResponse([
            'user' => $this->formatUserData($user),
        ], 'User profile retrieved.');
    }

    /**
     * User Logout.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();

            AuditLog::log(
                action: 'auth.logout',
                auditable: $user,
                userId: $user->id
            );
        }

        return $this->successResponse(null, 'Successfully logged out.');
    }

    /**
     * Change User Password.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->input('current_password'), $user->password)) {
            return $this->errorResponse('Current password does not match.', 422);
        }

        $user->update([
            'password' => Hash::make($request->input('new_password')),
        ]);

        AuditLog::log(
            action: 'auth.change_password',
            auditable: $user,
            userId: $user->id
        );

        return $this->successResponse(null, 'Password updated successfully.');
    }

    /**
     * Request Password Reset.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $request->input('email'))->first();

        if (!$user) {
            // Keep generic response for security
            return $this->successResponse(null, 'If an account exists with that email, a reset token has been issued.');
        }

        $token = Str::random(60);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            [
                'token' => Hash::make($token),
                'created_at' => now(),
            ]
        );

        AuditLog::log(
            action: 'auth.forgot_password_requested',
            auditable: $user,
            userId: $user->id
        );

        // For dev/demo return token or log it
        return $this->successResponse([
            'dev_reset_token' => config('app.debug') ? $token : null,
        ], 'Password reset instructions dispatched.');
    }

    /**
     * Reset Password with Token.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $record = DB::table('password_reset_tokens')
            ->where('email', $request->input('email'))
            ->first();

        if (!$record || !Hash::check($request->input('token'), $record->token)) {
            return $this->errorResponse('Invalid or expired password reset token.', 422);
        }

        $user = User::where('email', $request->input('email'))->first();
        if (!$user) {
            return $this->errorResponse('User not found.', 404);
        }

        $user->update([
            'password' => Hash::make($request->input('password')),
        ]);

        DB::table('password_reset_tokens')->where('email', $user->email)->delete();

        AuditLog::log(
            action: 'auth.password_reset_completed',
            auditable: $user,
            userId: $user->id
        );

        return $this->successResponse(null, 'Password has been reset successfully. You may now login.');
    }

    /**
     * Helper to format consistent user payload.
     */
    private function formatUserData(User $user): array
    {
        $roles = $user->getRoleNames();
        $permissions = $user->getAllPermissions()->pluck('name');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'phone' => $user->phone,
            'avatar' => $user->avatar,
            'is_active' => $user->is_active,
            'is_super_admin' => $user->isSuperAdmin(),
            'roles' => $roles,
            'permissions' => $permissions,
            'restaurants' => $user->isSuperAdmin() 
                ? \App\Models\Restaurant::where('is_active', true)->get(['id', 'name', 'slug', 'currency', 'currency_symbol', 'primary_color'])
                : $user->restaurants()->where('is_active', true)->get(['restaurants.id', 'restaurants.name', 'restaurants.slug', 'restaurants.currency', 'restaurants.currency_symbol', 'restaurants.primary_color']),
            'branches' => $user->isSuperAdmin()
                ? \App\Models\Branch::where('is_active', true)->get(['id', 'restaurant_id', 'name', 'code', 'is_main_branch'])
                : $user->branches()->where('is_active', true)->get(['branches.id', 'branches.restaurant_id', 'branches.name', 'branches.code', 'branches.is_main_branch']),
            'last_login_at' => $user->last_login_at?->toIso8601String(),
        ];
    }
}
