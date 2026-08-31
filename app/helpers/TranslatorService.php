<?php
declare(strict_types=1);

final class TranslatorService
{
    public static function translate(string $text, string $source, string $target): string
    {
        $source = self::normalizeLang($source);
        $target = self::normalizeLang($target);
        if ($source === $target) {
            return $text;
        }

        $translated = self::gtxTranslate($text, $source, $target);
        if ($translated === null) {
            $url = 'https://api.mymemory.translated.net/get?' . http_build_query([
                'q' => $text,
                'langpair' => $source . '|' . $target,
            ]);
            $raw = self::httpGet($url);
            if ($raw !== null) {
                $data = json_decode($raw, true);
                $candidate = $data['responseData']['translatedText'] ?? null;
                $status = (int) ($data['responseStatus'] ?? 0);
                if (is_string($candidate) && $candidate !== '' && $status !== 403 && !self::isUnusable($text, $candidate)) {
                    $translated = html_entity_decode($candidate, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                }
            }
        }
        if ($translated === null) {
            throw new RuntimeException('Translation service is unavailable. Try again shortly.');
        }
        if (stripos($translated, 'INVALID LANGUAGE PAIR') !== false) {
            throw new RuntimeException('That language pair is not supported.');
        }
        return $translated;
    }

    private static function isUnusable(string $source, string $translated): bool
    {
        $t = strtoupper($translated);
        if (str_contains($t, 'MYMEMORY WARNING') || str_contains($t, 'INVALID LANGUAGE PAIR')) {
            return true;
        }
        if (mb_strlen($source) <= 16 && mb_strlen($translated) > max(48, mb_strlen($source) * 8)) {
            return true;
        }
        return false;
    }

    private static function gtxTranslate(string $text, string $source, string $target): ?string
    {
        $sl = $source === 'autodetect' ? 'auto' : $source;
        $url = 'https://translate.googleapis.com/translate_a/single?' . http_build_query([
            'client' => 'gtx',
            'sl' => $sl,
            'tl' => $target,
            'dt' => 't',
            'q' => $text,
        ]);
        $raw = self::httpGet($url);
        if ($raw === null) {
            return null;
        }
        $data = json_decode($raw, true);
        if (!is_array($data) || !isset($data[0]) || !is_array($data[0])) {
            return null;
        }
        $out = '';
        foreach ($data[0] as $chunk) {
            if (isset($chunk[0]) && is_string($chunk[0])) {
                $out .= $chunk[0];
            }
        }
        $out = trim($out);
        return $out !== '' ? $out : null;
    }

    public static function normalizeLang(string $code): string
    {
        $code = strtolower(trim($code));
        $map = [
            'english' => 'en', 'hindi' => 'hi', 'spanish' => 'es', 'french' => 'fr',
            'german' => 'de', 'italian' => 'it', 'japanese' => 'ja', 'korean' => 'ko',
            'chinese' => 'zh-CN', 'arabic' => 'ar', 'portuguese' => 'pt', 'russian' => 'ru',
            'tamil' => 'ta', 'telugu' => 'te', 'kannada' => 'kn', 'malayalam' => 'ml',
            'bengali' => 'bn', 'marathi' => 'mr', 'gujarati' => 'gu', 'punjabi' => 'pa',
            'dutch' => 'nl', 'turkish' => 'tr', 'thai' => 'th', 'vietnamese' => 'vi',
            'auto' => 'autodetect',
        ];
        return $map[$code] ?? $code;
    }

    private static function httpGet(string $url): ?string
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 20,
                CURLOPT_FOLLOWLOCATION => true,
            ]);
            $raw = curl_exec($ch);
            curl_close($ch);
            return is_string($raw) ? $raw : null;
        }
        $ctx = stream_context_create(['http' => ['timeout' => 20]]);
        $raw = @file_get_contents($url, false, $ctx);
        return is_string($raw) ? $raw : null;
    }
}
