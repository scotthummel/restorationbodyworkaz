<?php

namespace App\Rbwmt\Services\Validators;

abstract class Validator {
    public $attributes;
    public $errors;

    public function __construct($attributes = null) {
        $this->attributes = $attributes ?: \Input::all();
    }

    public function passes() {
        $validation = \Validator::make($this->attributes, static::$rules);

        if ($validation->passes()) return true;

        $this->errors = $validation->messages();

        return false;
    }
}
