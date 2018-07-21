<?php

namespace App\Rbwmt\Services\Validators;

class Contact extends Validator {

    public static $rules = array(
        'name'    => 'required|min:5',
        'email'   => 'required|email',
        'message' => 'required|min:10'
    );
}