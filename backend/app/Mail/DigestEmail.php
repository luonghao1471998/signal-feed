<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class DigestEmail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public User $user,
        public Collection $signals,
        public Carbon $date
    ) {
        $this->mailer('resend');
    }

    public function envelope(): Envelope
    {
        $fromAddress = (string) config('services.resend.from_address', 'onboarding@resend.dev');
        $fromName = (string) config('services.resend.from_name', 'SignalFeed');

        return new Envelope(
            from: new Address($fromAddress, $fromName),
            subject: sprintf('Your SignalFeed digest — %s', $this->date->format('M j, Y'))
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.digest',
            with: [
                'user' => $this->user,
                'signals' => $this->signals,
                'date' => $this->date,
                'appUrl' => rtrim((string) (config('app.frontend_url') ?: config('app.url', 'http://localhost:8000')), '/'),
            ]
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
