<?php
declare(strict_types=1);

final class RoaminiController
{
    public static function chat(array $input): void
    {
        $message = trim((string) ($input['message'] ?? $input['text'] ?? ''));
        if ($message === '') {
            Response::error('Type a question for Roamini.');
        }
        $history = $input['history'] ?? [];
        if (!is_array($history)) {
            $history = [];
        }
        $reply = RoaminiEngine::reply($message, $history);
        Response::ok(['reply' => $reply]);
    }
}
