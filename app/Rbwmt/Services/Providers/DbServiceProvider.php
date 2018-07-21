<?php

namespace Rbwmt\Services\Providers;

use Illuminate\Support\ServiceProvider;

class DbServiceProvider extends ServiceProvider {

    public function register()
    {
        $this->app->bind('Rbwmt\Repositories\PagesRepositoryInterface', 'Rbwmt\Repositories\PagesRepository');
    }
}