<?php
declare(strict_types=1);

final class RoaminiKnowledge
{
    private static $data = null;

    public static function cityLocationsAnswer(string $message): ?string
    {
        $data = self::loadData();
        $query = self::normalizePlaceName($message);
        $cities = [];
        foreach ($data['cities'] as $place) {
            $city = trim((string) ($place['planner'] ?? ''));
            if ($city !== '') {
                $cities[self::normalizePlaceName($city)] = $city;
            }
        }
        uasort($cities, static fn (string $left, string $right): int => strlen($right) <=> strlen($left));

        $city = null;
        foreach ($cities as $normalized => $name) {
            if (preg_match('/(?:^| )' . preg_quote($normalized, '/') . '(?: |$)/', $query) === 1) {
                $city = $name;
                break;
            }
        }
        if ($city === null && preg_match('/(?:^| )bombay(?: |$)/', $query) === 1) {
            $city = $cities['mumbai'] ?? null;
        }
        if ($city === null) {
            return null;
        }

        $cityName = self::normalizePlaceName($city);
        $filler = [
            'a', 'about', 'any', 'are', 'can', 'city', 'do', 'find', 'for', 'give', 'help', 'in',
            'location', 'locations', 'me', 'nearby', 'of', 'place', 'places', 'show', 'some',
            'tell', 'the', 'things', 'to', 'tourist', 'travel', 'visit', 'what', 'where', 'which',
            'with', 'you', 'is', 'best', 'attraction', 'attractions', 'spot', 'spots', 'explore',
        ];
        $remaining = array_filter(
            explode(' ', $query),
            static fn (string $word): bool => $word !== ''
                && !in_array($word, explode(' ', $cityName), true)
                && !in_array($word, $filler, true)
        );
        $locationIntent = preg_match('/\b(location|locations|place|places|attraction|attractions|spot|spots|visit|tourist|explore|nearby|travel|things to do)\b/', $query) === 1;
        if ($remaining !== [] && !$locationIntent) {
            return null;
        }

        $places = $cityName === 'mumbai'
            ? $data['places']
            : array_values(array_filter(
                $data['cities'],
                static fn (array $place): bool => self::normalizePlaceName((string) ($place['planner'] ?? '')) === $cityName
            ));
        $score = static function (array $place): int {
            $title = self::normalizePlaceName((string) ($place['title'] ?? ''));
            if (preg_match('/\b(gateway|marine drive|beach|fort|temple|museum|market|garden|park|palace|monument|caves|promenade|lake|waterfall)\b/', $title) === 1) {
                return 3;
            }
            if (preg_match('/\b(airport|railway station|bus stand|office|school|college|hospital)\b/', $title) === 1) {
                return -1;
            }
            return 0;
        };
        if ($cityName !== 'mumbai') {
            usort($places, static fn (array $left, array $right): int => $score($right) <=> $score($left)
                ?: strcasecmp((string) ($left['title'] ?? ''), (string) ($right['title'] ?? '')));
        }
        $selected = array_slice($places, 0, 8);
        if ($selected === []) {
            return null;
        }

        $lines = array_map(static fn (array $place): string => '- ' . (string) ($place['title'] ?? '')
            . (!empty($place['area']) ? ' (' . (string) $place['area'] . ')' : ''), $selected);
        return 'Popular places in ' . $city . ' from Roamitra’s mapped guide (' . count($places)
            . (count($places) === 1 ? ' place listed' : ' places listed')
            . '; details may need verification):' . "\n" . implode("\n", $lines)
            . "\nTell me what kind of places you want—food, heritage, beaches, or family-friendly spots.";
    }

    public static function retrieve(string $message, array $history = []): array
    {
        $searchText = $message;
        foreach (array_slice($history, -6) as $turn) {
            $content = trim((string) ($turn['content'] ?? ''));
            if ($content !== '') {
                $searchText .= ' ' . $content;
            }
        }
        $queryTokens = self::tokens($searchText);
        if ($queryTokens === []) {
            return ['has_relevant' => false, 'context' => ''];
        }

        $data = self::loadData();
        $places = self::rank($data['places'], $queryTokens, [
            'title' => 5, 'area' => 4, 'category' => 2, 'keywords' => 3,
            'desc' => 1, 'local_tip' => 1, 'nearest_station' => 2,
        ]);
        $tips = self::rank($data['tips'], $queryTokens, [
            'tip' => 1, 'category' => 2,
        ]);
        $examples = self::rank($data['examples'], $queryTokens, [
            'question' => 4, 'type' => 1, 'rubric' => 1,
        ]);

        $relevantPlaces = array_values(array_filter($places, static fn (array $row): bool => $row['_score'] >= 3));
        $relevantTips = array_values(array_filter($tips, static fn (array $row): bool => $row['_score'] >= 2));
        $relevantExamples = array_values(array_filter($examples, static fn (array $row): bool => $row['_score'] >= 3));
        $hasRelevant = $relevantPlaces !== [] || $relevantTips !== [] || $relevantExamples !== [];
        if (!$hasRelevant) {
            return ['has_relevant' => false, 'context' => ''];
        }

        $lines = [
            'Reference data below is from Roamitra guide content marked "Needs verification"; qualify uncertain details and never present these entries as live listings.',
        ];
        foreach (array_slice($relevantPlaces, 0, 4) as $place) {
            $fields = [];
            foreach (['area', 'category', 'desc', 'approx_cost', 'timings', 'best_time', 'nearest_station', 'local_tip'] as $field) {
                if (!empty($place[$field])) {
                    $fields[] = $field . ': ' . $place[$field];
                }
            }
            $lines[] = 'Mumbai place — ' . $place['title'] . '; ' . implode('; ', $fields);
        }
        foreach (array_slice($relevantTips, 0, 3) as $tip) {
            $lines[] = 'Mumbai local tip — ' . ($tip['category'] ?? 'General') . ': ' . ($tip['tip'] ?? '');
        }
        foreach (array_slice($relevantExamples, 0, 2) as $example) {
            $lines[] = 'Approved example for style/behavior only — Question: ' . $example['question']
                . ' | Guidance: ' . $example['rubric']
                . ' | Approved answer: ' . mb_substr($example['answer'], 0, 500);
        }

        return ['has_relevant' => true, 'context' => implode("\n", $lines)];
    }

    private static function loadData(): array
    {
        if (is_array(self::$data)) {
            return self::$data;
        }

        $root = dirname(__DIR__, 2);
        $mumbaiPath = $root . '/public/assets/js/mumbai-data.js';
        if (!is_file($mumbaiPath)) {
            throw new RuntimeException('Roamini Mumbai reference data file is missing.');
        }
        $source = file_get_contents($mumbaiPath);
        if (!is_string($source) || ($separator = strpos($source, '=')) === false) {
            throw new RuntimeException('Roamini Mumbai reference data file is invalid.');
        }
        $json = trim(substr($source, $separator + 1));
        if (substr($json, -1) === ';') {
            $json = rtrim(substr($json, 0, -1));
        }
        $mumbai = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($mumbai) || !is_array($mumbai['places'] ?? null) || !is_array($mumbai['tips'] ?? null)) {
            throw new RuntimeException('Roamini Mumbai reference data has an unexpected format.');
        }

        $examplesPath = $root . '/app/data/roamini-examples.json';
        if (!is_file($examplesPath)) {
            throw new RuntimeException('Roamini approved examples file is missing.');
        }
        $examplesJson = file_get_contents($examplesPath);
        if (!is_string($examplesJson)) {
            throw new RuntimeException('Roamini approved examples file could not be read.');
        }
        $examples = json_decode($examplesJson, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($examples) || !is_array($examples['examples'] ?? null)) {
            throw new RuntimeException('Roamini approved examples have an unexpected format.');
        }

        $cityPath = $root . '/public/assets/js/india-cities.js';
        if (!is_file($cityPath)) {
            throw new RuntimeException('Roamini city reference data file is missing.');
        }
        $citySource = file_get_contents($cityPath);
        if (!is_string($citySource)
            || preg_match('/^window\.RoamitraIndiaCities\s*=\s*(\{.*\});\r?$/m', $citySource, $cityMatch) !== 1) {
            throw new RuntimeException('Roamini city reference data file is invalid.');
        }
        $cities = json_decode($cityMatch[1], true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($cities)) {
            throw new RuntimeException('Roamini city reference data has an unexpected format.');
        }

        self::$data = [
            'places' => $mumbai['places'],
            'tips' => $mumbai['tips'],
            'examples' => $examples['examples'],
            'cities' => $cities,
        ];
        return self::$data;
    }

    private static function normalizePlaceName(string $text): string
    {
        $text = strtolower($text);
        if (function_exists('iconv')) {
            $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
            if (is_string($ascii)) {
                $text = $ascii;
            }
        }
        return trim(preg_replace('/[^a-z0-9]+/', ' ', $text) ?? $text);
    }

    private static function rank(array $rows, array $queryTokens, array $weights): array
    {
        $ranked = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $score = 0;
            foreach ($weights as $field => $weight) {
                $fieldTokens = self::tokens((string) ($row[$field] ?? ''));
                foreach ($queryTokens as $token) {
                    if (in_array($token, $fieldTokens, true)) {
                        $score += $weight;
                    }
                }
            }
            if ($score > 0) {
                $row['_score'] = $score;
                $ranked[] = $row;
            }
        }
        usort($ranked, static fn (array $left, array $right): int => $right['_score'] <=> $left['_score']);
        return $ranked;
    }

    private static function tokens(string $text): array
    {
        $text = strtolower($text);
        if (function_exists('iconv')) {
            $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
            if (is_string($ascii)) {
                $text = $ascii;
            }
        }
        preg_match_all('/[a-z0-9]+/', $text, $matches);
        $stopWords = [
            'a', 'about', 'an', 'and', 'are', 'can', 'could', 'do', 'does', 'for', 'from',
            'give', 'help', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or',
            'please', 'should', 'some', 'tell', 'the', 'to', 'what', 'where', 'which',
            'who', 'why', 'with', 'you', 'your', 'best', 'go', 'kahan', 'ka', 'ki', 'ko',
            'mein', 'mujhe', 'batao', 'hai', 'aur', 'kya',
        ];
        $aliases = [
            'affordable' => 'budget', 'cheap' => 'budget', 'cheaper' => 'budget',
            'sasta' => 'budget', 'saste' => 'budget', 'sasti' => 'budget',
            'cafes' => 'cafe', 'restaurants' => 'restaurant', 'food' => 'restaurant',
            'eat' => 'restaurant', 'dining' => 'restaurant', 'photos' => 'photo',
            'swim' => 'swimming', 'swims' => 'swimming', 'beaches' => 'beach',
            'children' => 'kid', 'kids' => 'kid', 'tips' => 'tip',
        ];
        $tokens = [];
        foreach ($matches[0] as $token) {
            if (strlen($token) < 3 || in_array($token, $stopWords, true)) {
                continue;
            }
            $token = $aliases[$token] ?? $token;
            if (!in_array($token, $tokens, true)) {
                $tokens[] = $token;
            }
        }
        return $tokens;
    }
}
