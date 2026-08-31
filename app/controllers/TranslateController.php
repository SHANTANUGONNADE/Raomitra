<?php
declare(strict_types=1);

final class TranslateController
{
    public static function translate(array $input): void
    {
        $text = trim((string) ($input['text'] ?? ''));
        $source = (string) ($input['source_lang'] ?? 'en');
        $target = (string) ($input['target_lang'] ?? 'hi');
        $mode = (string) ($input['mode'] ?? 'text');
        if ($text === '') {
            Response::error('Enter a phrase to translate.');
        }
        if (!in_array($mode, ['text', 'voice'], true)) {
            $mode = 'text';
        }
        try {
            $translated = TranslatorService::translate($text, $source, $target);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 422);
        }

        $userId = Auth::userId();
        if ($userId) {
            Database::pdo()->prepare(
                'INSERT INTO translator_history (user_id, source_lang, target_lang, source_text, translated_text, mode)
                 VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([$userId, $source, $target, $text, $translated, $mode]);
            Database::pdo()->prepare(
                'INSERT INTO translator_prefs (user_id, source_lang, target_lang) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE source_lang = VALUES(source_lang), target_lang = VALUES(target_lang)'
            )->execute([$userId, $source, $target]);
        }

        Response::ok([
            'source_lang' => $source,
            'target_lang' => $target,
            'source_text' => $text,
            'translated_text' => $translated,
            'mode' => $mode,
        ]);
    }

    public static function history(): void
    {
        $userId = Auth::requireUser();
        $stmt = Database::pdo()->prepare(
            'SELECT id, source_lang, target_lang, source_text, translated_text, mode, created_at
             FROM translator_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
        );
        $stmt->execute([$userId]);
        $prefs = Database::pdo()->prepare('SELECT source_lang, target_lang FROM translator_prefs WHERE user_id = ?');
        $prefs->execute([$userId]);
        Response::ok([
            'history' => $stmt->fetchAll(),
            'prefs' => $prefs->fetch() ?: ['source_lang' => 'en', 'target_lang' => 'hi'],
        ]);
    }
}
