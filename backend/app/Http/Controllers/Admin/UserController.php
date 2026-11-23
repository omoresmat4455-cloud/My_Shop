<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index()
    {
        return User::withCount('orders')
            ->latest()
            ->orderByDesc('id')
            ->get()
            ->map(function (User $user) {
                if ($user->role === 'customer') {
                    $user->role = 'user';
                }

                return $user;
            });
    }

    public function updateRole(Request $request, User $user)
    {
        $data = $request->validate([
            'role' => ['required', Rule::in(['user', 'admin'])],
        ]);

        abort_if(
            $request->user()->is($user) && $data['role'] !== 'admin',
            422,
            'You cannot remove your own admin role'
        );

        $user->update([
            'role' => $data['role'] === 'user' ? 'customer' : 'admin',
        ]);

        return $this->present($user);
    }

    public function updateStatus(Request $request, User $user)
    {
        $data = $request->validate([
            'is_active' => 'required|boolean',
        ]);

        abort_if(
            $request->user()->is($user) && ! $data['is_active'],
            422,
            'You cannot deactivate your own account'
        );

        $user->update(['is_active' => $data['is_active']]);

        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        return $this->present($user);
    }

    private function present(User $user): User
    {
        if ($user->role === 'customer') {
            $user->role = 'user';
        }

        return $user->loadCount('orders');
    }
}
