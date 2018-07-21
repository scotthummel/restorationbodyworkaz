<?php

namespace App\Rbwmt\Mailers;

class ContactMailer extends Contact {
    public function contact() {
        $this->subject = 'Message from the Website';
        $this->view    = 'emails.user.contact';
        $this->data    = array(
            'name'        => $this->name,
            'email'       => $this->email,
            'phone'       => $this->phone,
            'messageText' => $this->messageText,
            'subject'     => $this->subject,
        );

        return $this;
    }
}