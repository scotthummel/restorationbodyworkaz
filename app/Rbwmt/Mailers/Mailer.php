<?php

namespace App\Rbwmt\Mailers;

abstract class Mailer {
    public $to;
    public $email;
    public $subject;
    public $view;
    public $title;
    public $data = array();

    public function __construct($user) {
        $this->name        = $user->name;
        $this->email       = $user->email;
        $this->phone       = $user->phone;
        $this->messageText = $user->messageText;
    }

    public function deliver() {
        $self = $this;

        return \Mail::send($this->view, $this->data, function($message) use($self) {
           $message->to($self->email, $self->to)
               ->subject($self->subject);
        });
    }
}