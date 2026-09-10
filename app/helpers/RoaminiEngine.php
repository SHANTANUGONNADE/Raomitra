<?php
declare(strict_types=1);

final class RoaminiEngine
{
    public static function reply(string $message, array $history = []): string
    {
        $message = trim($message);
        if ($message === '') {
            return 'Ask me anything — travel, Roamitra, or a general question — and I will answer.';
        }

        $local = self::localAnswer($message);
        if ($local !== null) {
            return $local;
        }

        $config = require dirname(__DIR__) . '/config/config.php';
        if (!empty($config['openai_api_key'])) {
            $llm = self::tryLlm($message, $history, (string) $config['openai_api_key'], (string) $config['openai_model']);
            if ($llm !== null) {
                return $llm;
            }
        }

        if (self::looksFactual($message)) {
            $wiki = self::tryWikipedia($message);
            if ($wiki !== null) {
                return $wiki;
            }
            $duck = self::tryDuckDuckGo($message);
            if ($duck !== null) {
                return $duck;
            }
        }

        return self::fallbackAnswer($message);
    }

    private static function normalize(string $message): string
    {
        $q = strtolower($message);
        $q = str_replace(['-', '_'], ' ', $q);
        $map = [
            'sigin' => 'sign in',
            'signin' => 'sign in',
            'signn' => 'sign in',
            'logn' => 'login',
            'signup' => 'sign up',
            'singup' => 'sign up',
            'regiser' => 'register',
            'passowrd' => 'password',
        ];
        foreach ($map as $typo => $fix) {
            $q = preg_replace('/\b' . preg_quote($typo, '/') . '\b/', $fix, $q) ?? $q;
        }
        $q = str_replace('log in', 'login', $q);
        $q = preg_replace('/\s+/', ' ', $q) ?? $q;
        return trim($q);
    }

    private static function hasWord(string $haystack, array $needles, int $distance = 2): bool
    {
        $words = preg_split('/\s+/', $haystack) ?: [];
        foreach ($needles as $needle) {
            if (str_contains($haystack, $needle)) {
                return true;
            }
            foreach ($words as $word) {
                if (strlen($needle) >= 4 && strlen($word) >= 3 && levenshtein($word, $needle) <= $distance) {
                    return true;
                }
            }
        }
        return false;
    }

    private static function looksFactual(string $message): bool
    {
        $q = strtolower(trim($message));
        if (preg_match('/^(how to|how do i|how can i|how do you)\b/', $q) === 1) {
            return false;
        }
        return preg_match('/^(what|who|where|when|which|why)\b/', $q) === 1
            || preg_match('/\b(tell me about|explain|define|meaning of)\b/', $q) === 1;
    }

    private static function localAnswer(string $message): ?string
    {
        $q = self::normalize($message);

        if (preg_match('/^(hi|hello|hey|yo|namaste|good morning|good afternoon|good evening)\b/i', $q) === 1) {
            return 'Hello! I am Roamini, your Roamitra assistant. Ask me about destinations, Ask to Rent, Ask to Host, trip planning, or how to use the site.';
        }

        if (preg_match('/what( is|\'s)? (your )?name|who are you/i', $q) === 1) {
            return 'I am Roamini, the travel assistant on Roamitra. I help with destinations, bookings, hosts, meetups, and how to use the site.';
        }

        if (self::hasWord($q, ['login', 'signin']) || str_contains($q, 'sign in')
            || preg_match('/\b(log ?in|sign ?in|sigin|signin)\b/', strtolower($message)) === 1) {
            return 'To sign in to Roamitra: click Log in at the top right, enter the email and password you used to sign up, then submit. If you do not have an account yet, click Sign up first. After you are logged in you can book rentals, plan trips, and use Community.';
        }

        if (self::hasWord($q, ['register', 'signup']) || str_contains($q, 'sign up') || str_contains($q, 'create account')) {
            return 'To create a Roamitra account: click Sign up at the top right, enter your name, email, and password, then submit. After that, use Log in with the same email. Then you can book vehicles, apply to host, and post in Community.';
        }

        if (str_contains($q, 'password') || str_contains($q, 'forgot')) {
            return 'Use Log in with the email you registered. If you cannot remember the password, try the password you set at Sign up. On this site you sign in from the Log in page at the top right.';
        }

        if (str_contains($q, 'logout') || str_contains($q, 'log out') || str_contains($q, 'sign out')) {
            return 'Open your profile menu at the top right and log out. You can sign back in anytime with Log in.';
        }

        if (str_contains($q, 'become a host') || str_contains($q, 'ask to host') || (str_contains($q, 'host') && preg_match('/\b(how|apply|become)\b/', $q) === 1)) {
            return 'To become a host, log in and open Ask to Host. Submit your city, phone, and a short bio. After admin approval you get a verified host badge and can welcome travelers.';
        }

        if (str_contains($q, 'ask to rent') || str_contains($q, 'book a') || str_contains($q, 'booking') || str_contains($q, 'rent a scooter') || str_contains($q, 'rent a bike') || str_contains($q, 'rent a car')) {
            return 'Open Community → Ask to Rent, pick a vehicle (scooter, bike, or car), then Book Now. Choose pickup and return dates. You need to be logged in. Most cancellations up to 48 hours before are fully refunded.';
        }

        if (str_contains($q, 'meetup')) {
            return 'Meetups are group activities with other travelers. Open Community → Meetups (or the Meetups page) to find events in your city and join.';
        }

        if (str_contains($q, 'cancel')) {
            return 'Most Roamitra bookings can be cancelled up to 48 hours before for a full refund. Vehicle rentals and meetups can have their own terms — check the listing before you confirm.';
        }

        if (str_contains($q, 'explore') && preg_match('/\b(how|use|open|search)\b/', $q) === 1) {
            return 'On Explore, use the search bar for a place (for example Bali or Tokyo). Open a destination to see details. Community has locals, hosts, stays, and Ask to Rent.';
        }

        if (str_contains($q, 'bali')) {
            return 'Bali is a tropical favorite: temples, rice terraces, beaches, and Ubud culture. Typical Explore packages start around $1,200/week. Ask to Rent for scooters, and connect with locals for warungs and sunrise treks.';
        }

        if (str_contains($q, 'destination') || str_contains($q, 'where should i go') || str_contains($q, 'recommend')) {
            return 'Popular Roamitra picks include Bali, Tokyo, Paris, Rome, Barcelona, Santorini, Dubai, Iceland, Kyoto, New York, Marrakech, Sydney, Yosemite, Lake Tahoe, and Big Sur. Open Explore, search a place, or tell me your budget and travel style.';
        }

        if (str_contains($q, 'plan trip') || str_contains($q, 'itinerary') || str_contains($q, 'planner')) {
            return 'Use Plan Trip to generate an itinerary, then open it and chat to add or remove places, change timings, or adjust for weather and budget. I can also suggest ideas here if you tell me destination and dates.';
        }

        if (preg_match('/^\s*(-?\d+(?:\.\d+)?)\s*([+\-*\/x×])\s*(-?\d+(?:\.\d+)?)\s*$/', $message, $m) === 1) {
            $a = (float) $m[1];
            $b = (float) $m[3];
            $op = $m[2];
            $result = match ($op) {
                '+' => $a + $b,
                '-' => $a - $b,
                '*', 'x', '×' => $a * $b,
                '/' => ($b == 0.0 ? null : $a / $b),
                default => null,
            };
            if ($result === null) {
                return 'That division is not possible (cannot divide by zero).';
            }
            return 'That equals ' . (floor($result) == $result ? (string) (int) $result : (string) round($result, 6)) . '.';
        }

        if (preg_match('/^(how to|how do i|how can i|how do you)\b/', $q) === 1) {
            return 'On Roamitra you can: Log in / Sign up (top right), Explore destinations, Plan Trip for an itinerary, Community for questions, Ask to Rent vehicles, Ask to Host, and Meetups. Tell me which of those you want step-by-step.';
        }

        return null;
    }

    private static function fallbackAnswer(string $message): string
    {
        return 'Here is a useful take on that: I could not pull a live source just now, but I can still help. '
            . 'If this is about travel, tell me the city, dates, and whether you want stays, rentals, hosts, or an itinerary. '
            . 'If it is a general question, rephrase it in a few words (for example “what is Kyoto” or “how does jet lag work”) and I will answer more specifically. '
            . 'Your question was: “' . mb_substr($message, 0, 180) . '”.';
    }

    private static function tryLlm(string $message, array $history, string $apiKey, string $model): ?string
    {
        $messages = [
            [
                'role' => 'system',
                'content' => 'You are Roamini, the helpful assistant for Roamitra, a travel community. Answer any question clearly and completely. Prefer practical travel advice when relevant (Explore destinations, Ask to Rent vehicles, Ask to Host, meetups, Plan Trip). If the question is not about travel, still answer it helpfully. Keep replies under 180 words unless the user needs steps.',
            ],
        ];
        foreach (array_slice($history, -8) as $turn) {
            $role = ($turn['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
            $content = trim((string) ($turn['content'] ?? ''));
            if ($content !== '') {
                $messages[] = ['role' => $role, 'content' => $content];
            }
        }
        $messages[] = ['role' => 'user', 'content' => $message];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'model' => $model,
                'temperature' => 0.5,
                'max_tokens' => 500,
                'messages' => $messages,
            ]),
            CURLOPT_TIMEOUT => 35,
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);
        if (!is_string($raw) || $raw === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        $text = $decoded['choices'][0]['message']['content'] ?? null;
        if (!is_string($text) || trim($text) === '') {
            return null;
        }
        return trim($text);
    }

    private static function tryWikipedia(string $message): ?string
    {
        $query = self::searchQuery($message);
        if ($query === '') {
            return null;
        }
        $searchUrl = 'https://en.wikipedia.org/w/api.php?' . http_build_query([
            'action' => 'opensearch',
            'search' => $query,
            'limit' => 1,
            'namespace' => 0,
            'format' => 'json',
        ]);
        $search = self::httpGet($searchUrl);
        if ($search === null) {
            return null;
        }
        $data = json_decode($search, true);
        $title = $data[1][0] ?? null;
        $snippet = $data[2][0] ?? '';
        if (!is_string($title) || $title === '') {
            return null;
        }
        if (!self::titleMatchesQuery($query, $title)) {
            return null;
        }
        $sumUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/' . rawurlencode(str_replace(' ', '_', $title));
        $sumRaw = self::httpGet($sumUrl);
        if (is_string($sumRaw)) {
            $sum = json_decode($sumRaw, true);
            $extract = trim((string) ($sum['extract'] ?? ''));
            if ($extract !== '') {
                return $extract;
            }
        }
        $snippet = trim((string) $snippet);
        return $snippet !== '' ? $snippet : null;
    }

    private static function tryDuckDuckGo(string $message): ?string
    {
        $url = 'https://api.duckduckgo.com/?' . http_build_query([
            'q' => $message,
            'format' => 'json',
            'no_html' => 1,
            'skip_disambig' => 1,
        ]);
        $raw = self::httpGet($url);
        if ($raw === null) {
            return null;
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            return null;
        }
        $abstract = trim((string) ($data['AbstractText'] ?? ''));
        if ($abstract !== '') {
            return $abstract;
        }
        $def = trim((string) ($data['Definition'] ?? ''));
        if ($def !== '') {
            return $def;
        }
        $related = $data['RelatedTopics'][0]['Text'] ?? null;
        if (is_string($related) && trim($related) !== '') {
            return trim($related);
        }
        return null;
    }

    private static function titleMatchesQuery(string $query, string $title): bool
    {
        $stop = ['a', 'an', 'the', 'to', 'how', 'do', 'i', 'is', 'of', 'in', 'on', 'for', 'and'];
        $tokens = static function (string $s) use ($stop): array {
            $parts = preg_split('/\s+/', strtolower(preg_replace('/[^a-z0-9\s]/', ' ', $s) ?? $s)) ?: [];
            return array_values(array_filter($parts, static fn($w) => strlen($w) > 2 && !in_array($w, $stop, true)));
        };
        $q = $tokens($query);
        $t = $tokens($title);
        if ($q === [] || $t === []) {
            return false;
        }
        $overlap = count(array_intersect($q, $t));
        similar_text(strtolower($query), strtolower($title), $pct);
        return $overlap >= 1 || $pct >= 62;
    }

    private static function searchQuery(string $message): string
    {
        $q = trim(preg_replace('/[?!.]+/', '', $message) ?? $message);
        $q = preg_replace('/^(please |can you |could you |what is |what\'s |whats |who is |who\'s |tell me about |explain |define )/i', '', $q) ?? $q;
        return trim($q);
    }

    private static function httpGet(string $url): ?string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'User-Agent: RoamitraRoamini/1.0 (travel-assistant)',
            ],
        ]);
        $raw = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if (!is_string($raw) || $raw === '' || $code >= 400) {
            return null;
        }
        return $raw;
    }
}
