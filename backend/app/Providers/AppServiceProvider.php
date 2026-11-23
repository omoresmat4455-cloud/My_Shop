<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            if (! $request->user()) {
                return Limit::perMinute(300)->by('api-anonymous:'.$request->ip());
            }

            return [
                Limit::perMinute(120)->by('api-user:'.$request->user()->getAuthIdentifier()),
                Limit::perMinute(6000)->by('api-ip:'.$request->ip()),
            ];
        });

        RateLimiter::for('login', function (Request $request) {
            $ip = $request->ip();
            $email = Str::lower((string) $request->input('email'));

            return [
                Limit::perMinute(5)->by('login:'.$ip.':'.hash('sha256', $email)),
                Limit::perMinute(60)->by("login-ip:{$ip}"),
            ];
        });

        RateLimiter::for('register', function (Request $request) {
            return Limit::perMinute(10)->by('register:'.$request->ip());
        });
    }
}
