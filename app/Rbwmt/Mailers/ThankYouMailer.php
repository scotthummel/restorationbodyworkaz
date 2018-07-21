<?php

namespace App\Rbwmt\Mailers;

class ThankYouMailer extends Mailer {
    public function contact() {
        $this->subject = 'Thank You for Contacting Restoration Bodywork and Massage Therapy';
        $this->view    = 'emails.thank-yous.contact';
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