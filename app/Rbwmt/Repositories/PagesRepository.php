<?php

namespace App\Rbwmt\Repositories;

use App\Models\Page;

class PagesRepository {

    public function getWhereSlug($slug)
    {
        return Page::where('slug', $slug)->first();
    }
}