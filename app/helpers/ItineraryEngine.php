<?php
declare(strict_types=1);

final class ItineraryEngine
{
    public static function generate(array $trip): array
    {
        $start = new DateTimeImmutable($trip['start_date']);
        $end = new DateTimeImmutable($trip['end_date']);
        if ($end < $start) {
            throw new InvalidArgumentException('End date must be on or after start date.');
        }

        $dayCount = (int) $start->diff($end)->days + 1;
        $dayCount = max(1, min($dayCount, 14));
        $people = self::partySize($trip);
        $prefs = self::preferences($trip);
        $pace = $trip['pace'] ?? 'moderate';
        $perDay = $pace === 'relaxed' ? 3 : ($pace === 'packed' ? 5 : 4);
        $budget = isset($trip['budget']) && $trip['budget'] !== null ? (float) $trip['budget'] : null;

        $catalog = PlacesCatalog::forDestination((string) $trip['destination']);
        $catalog = self::scoreAndSort($catalog, $prefs, $budget, $people);
        $used = [];
        $days = [];
        $activityCost = 0.0;

        for ($i = 0; $i < $dayCount; $i++) {
            $date = $start->modify('+' . $i . ' days');
            $window = self::dayWindow($i, $dayCount, $trip['arrival_time'] ?? null, $trip['departure_time'] ?? null);
            $slots = self::timeSlots($window['start'], $window['end'], $perDay);
            if ($window['kind'] === 'arrival_late' || $window['kind'] === 'depart_early') {
                $slots = array_slice($slots, 0, max(1, count($slots)));
            }

            $activities = [];
            if ($window['kind'] === 'arrival_late') {
                $activities[] = self::activity(
                    'Hotel check-in & rest',
                    'accommodation',
                    $window['start'],
                    self::addMinutes($window['start'], 90),
                    0,
                    'Late-night arrival — keep this evening light and rest for tomorrow.'
                );
            } elseif ($window['kind'] === 'depart_early') {
                $activities[] = self::activity(
                    'Breakfast & departure transfer',
                    'logistics',
                    $window['start'],
                    $window['end'],
                    15,
                    'Morning departure — only a short buffer before leaving ' . $trip['destination'] . '.'
                );
            } else {
                foreach ($slots as $slot) {
                    $place = self::pickPlace($catalog, $used, $slot['start'], $prefs, $budget);
                    if (!$place) {
                        break;
                    }
                    $used[] = PlacesCatalog::normalize($place['name']);
                    $endTime = self::clampTime(self::addMinutes($slot['start'], 90), $window['end']);
                    if ($endTime <= $slot['start']) {
                        continue;
                    }
                    $cost = self::scaledCost((int) $place['cost'], $people, (string) $trip['traveling_with']);
                    $activityCost += $cost;
                    $activities[] = self::activity(
                        $place['name'],
                        $place['category'],
                        $slot['start'],
                        $endTime,
                        $cost,
                        $place['notes'] !== '' ? $place['notes'] : ('Typical hours: ' . $place['hours'])
                    );
                }
            }

            $days[] = [
                'day' => $i + 1,
                'date' => $date->format('Y-m-d'),
                'theme' => self::dayTheme($i, $dayCount, $window['kind'], (string) $trip['destination']),
                'window' => $window,
                'activities' => $activities,
            ];
        }

        $accommodation = self::accommodation($trip, $people, $budget);
        $transport = self::transport($trip, $people);
        $estStay = $accommodation['nightly'] * max(1, $dayCount - 1);
        $estFood = self::foodPerDay($trip, $people) * $dayCount;
        $estLocal = $transport['local_total'];
        $total = round($activityCost + $estStay + $estFood + $estLocal, 2);

        $itinerary = [
            'destination' => $trip['destination'],
            'version' => 1,
            'generated_at' => gmdate('c'),
            'party' => [
                'traveling_with' => $trip['traveling_with'],
                'group_size' => $people,
            ],
            'arrival_time' => $trip['arrival_time'],
            'departure_time' => $trip['departure_time'],
            'days' => $days,
            'budget' => [
                'user_budget' => $budget,
                'currency' => $trip['budget_currency'] ?? 'USD',
                'estimated_total' => $total,
                'per_person' => round($total / max(1, $people), 2),
                'breakdown' => [
                    'activities' => round($activityCost, 2),
                    'accommodation' => round($estStay, 2),
                    'food' => round($estFood, 2),
                    'local_transport' => round($estLocal, 2),
                ],
                'within_budget' => $budget === null ? null : $total <= $budget,
            ],
            'accommodation' => $accommodation,
            'transportation' => $transport,
            'weather_note' => 'If rain is expected, swap outdoor viewpoints for museums, markets, and cafés. Ask the assistant to adjust for weather.',
            'summary' => sprintf(
                '%d-day plan for %s in %s (%s, party of %d). Arrival: %s. Departure: %s.',
                $dayCount,
                $trip['traveling_with'],
                $trip['destination'],
                $pace,
                $people,
                self::labelTime($trip['arrival_time'] ?? null),
                self::labelTime($trip['departure_time'] ?? null)
            ),
        ];

        return self::dedupe($itinerary);
    }

    public static function modify(array $itinerary, array $trip, string $userMessage): array
    {
        $config = require dirname(__DIR__) . '/config/config.php';
        $updated = $itinerary;
        $reply = '';

        if (!empty($config['openai_api_key'])) {
            $llm = self::tryLlmModify($itinerary, $trip, $userMessage, (string) $config['openai_api_key'], (string) $config['openai_model']);
            if ($llm) {
                $updated = self::dedupe($llm['itinerary']);
                $updated['version'] = (int) ($itinerary['version'] ?? 1) + 1;
                return ['itinerary' => $updated, 'reply' => $llm['reply']];
            }
        }

        $intent = self::parseIntent($userMessage);
        $catalog = PlacesCatalog::forDestination((string) $trip['destination']);

        switch ($intent['action']) {
            case 'remove':
                $before = self::countActivities($updated);
                $updated = self::removePlaces($updated, $intent['query']);
                $removed = $before - self::countActivities($updated);
                $reply = $removed > 0
                    ? "Removed matching activities and kept the rest of your plan."
                    : "I could not find that place in the current itinerary. Try the exact activity name.";
                break;
            case 'add':
                $added = self::addPlace($updated, $trip, $catalog, $intent);
                $updated = $added['itinerary'];
                $reply = $added['reply'];
                break;
            case 'nearby_food':
                $kind = $intent['food'] === 'cafe' ? 'cafe' : 'restaurant';
                $added = self::addPlace($updated, $trip, $catalog, ['action' => 'add', 'query' => $kind, 'day' => $intent['day'], 'food' => $kind]);
                $updated = $added['itinerary'];
                $reply = $kind === 'cafe'
                    ? 'Added a nearby café slot without duplicating places already on your itinerary.'
                    : 'Added a nearby restaurant slot based on your destination and current plan.';
                break;
            case 'times':
                $updated = self::shiftTimes($updated, $intent);
                $reply = 'Updated activity timings and kept travel order logical.';
                break;
            case 'rearrange':
                $updated = self::rearrange($updated, $intent);
                $reply = 'Rearranged activities as requested and preserved unchanged days.';
                break;
            case 'weather':
                $updated = self::adjustWeather($updated, $catalog, $trip);
                $reply = 'Shifted outdoor-heavy slots toward indoor museums, markets, and cafés where possible.';
                break;
            case 'budget':
                $updated = self::adjustBudget($updated, $catalog, $trip);
                $reply = 'Swapped higher-cost activities for better-value options and refreshed the budget estimate.';
                break;
            case 'transport':
                $updated['transportation'] = self::transport($trip, self::partySize($trip));
                $updated['transportation']['assistant_note'] = self::transportAdvice($trip, $userMessage);
                $reply = $updated['transportation']['assistant_note'];
                break;
            case 'preferences':
                $updated = self::adjustPreferences($updated, $catalog, $trip, $userMessage);
                $reply = 'Adjusted remaining free slots toward your stated preferences while keeping the rest intact.';
                break;
            default:
                $added = self::addPlace($updated, $trip, $catalog, ['action' => 'add', 'query' => $userMessage, 'day' => $intent['day']]);
                if ($added['changed']) {
                    $updated = $added['itinerary'];
                    $reply = $added['reply'];
                } else {
                    $reply = 'I can modify this itinerary: add or remove places, change timings, rearrange activities, find nearby restaurants or cafés, suggest transport, or adjust for weather, budget, or preferences.';
                }
        }

        $updated = self::recalculateBudget($updated, $trip);
        $updated = self::dedupe($updated);
        $updated['version'] = (int) ($itinerary['version'] ?? 1) + 1;
        $updated['generated_at'] = gmdate('c');
        return ['itinerary' => $updated, 'reply' => $reply];
    }

    private static function tryLlmModify(array $itinerary, array $trip, string $message, string $apiKey, string $model): ?array
    {
        $payload = [
            'model' => $model,
            'temperature' => 0.3,
            'response_format' => ['type' => 'json_object'],
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You edit travel itineraries. Return JSON {"reply": string, "itinerary": object}. Preserve activities the user did not ask to change. Avoid duplicate place names. Respect arrival/departure windows in itinerary.days[].window. Keep the same schema.',
                ],
                [
                    'role' => 'user',
                    'content' => json_encode([
                        'request' => $message,
                        'trip' => [
                            'destination' => $trip['destination'],
                            'traveling_with' => $trip['traveling_with'],
                            'group_size' => self::partySize($trip),
                            'budget' => $trip['budget'],
                            'arrival_time' => $trip['arrival_time'],
                            'departure_time' => $trip['departure_time'],
                            'preferences' => $trip['preferences'] ?? [],
                        ],
                        'itinerary' => $itinerary,
                    ], JSON_UNESCAPED_UNICODE),
                ],
            ],
        ];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_TIMEOUT => 40,
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);
        if (!is_string($raw) || $raw === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        $content = $decoded['choices'][0]['message']['content'] ?? null;
        if (!is_string($content)) {
            return null;
        }
        $obj = json_decode($content, true);
        if (!is_array($obj) || empty($obj['itinerary']['days']) || !is_array($obj['itinerary']['days'])) {
            return null;
        }
        return [
            'itinerary' => $obj['itinerary'],
            'reply' => (string) ($obj['reply'] ?? 'Updated your itinerary.'),
        ];
    }

    private static function parseIntent(string $message): array
    {
        $t = mb_strtolower($message);
        $day = null;
        if (preg_match('/day\s*(\d+)/', $t, $m)) {
            $day = (int) $m[1];
        }
        $intent = ['action' => 'unknown', 'query' => $message, 'day' => $day, 'food' => null];

        if (preg_match('/\b(remove|delete|drop|skip)\b/', $t)) {
            $intent['action'] = 'remove';
            $intent['query'] = trim((string) preg_replace('/\b(please|can you|remove|delete|drop|skip|the|from|itinerary|day\s*\d+)\b/i', ' ', $message));
        } elseif (preg_match('/\b(cafe|cafés|coffee)\b/', $t) && preg_match('/\b(find|nearby|add|suggest)\b/', $t)) {
            $intent['action'] = 'nearby_food';
            $intent['food'] = 'cafe';
        } elseif (preg_match('/\b(restaurant|dinner|lunch|food nearby|nearby food)\b/', $t) && preg_match('/\b(find|nearby|add|suggest)\b/', $t)) {
            $intent['action'] = 'nearby_food';
            $intent['food'] = 'restaurant';
        } elseif (preg_match('/\b(weather|rain|sunny|hot|cold|indoor)\b/', $t)) {
            $intent['action'] = 'weather';
        } elseif (preg_match('/\b(budget|cheaper|expensive|affordable|cost)\b/', $t)) {
            $intent['action'] = 'budget';
        } elseif (preg_match('/\b(taxi|metro|train|bus|uber|transport|commute)\b/', $t)) {
            $intent['action'] = 'transport';
        } elseif (preg_match('/\b(swap|move|rearrange|switch)\b/', $t)) {
            $intent['action'] = 'rearrange';
        } elseif (preg_match('/\b(time|timing|later|earlier|morning|afternoon|evening)\b/', $t) && preg_match('/\b(change|shift|make|move)\b/', $t)) {
            $intent['action'] = 'times';
        } elseif (preg_match('/\b(prefer|preference|romantic|family|kids|nightlife|temple|museum)\b/', $t)) {
            $intent['action'] = 'preferences';
        } elseif (preg_match('/\b(add|include|insert)\b/', $t)) {
            $intent['action'] = 'add';
            $intent['query'] = trim((string) preg_replace('/\b(please|can you|add|include|insert|a|an|the|to|my|itinerary|day\s*\d+)\b/i', ' ', $message));
        }
        return $intent;
    }

    private static function removePlaces(array $itinerary, string $query): array
    {
        $q = PlacesCatalog::normalize($query);
        foreach ($itinerary['days'] as &$day) {
            $day['activities'] = array_values(array_filter($day['activities'], static function ($a) use ($q) {
                $hay = PlacesCatalog::normalize(($a['title'] ?? '') . ' ' . ($a['place'] ?? ''));
                return $q === '' || !str_contains($hay, $q);
            }));
        }
        unset($day);
        return $itinerary;
    }

    private static function addPlace(array $itinerary, array $trip, array $catalog, array $intent): array
    {
        $used = self::usedNames($itinerary);
        $query = PlacesCatalog::normalize((string) ($intent['query'] ?? ''));
        $food = $intent['food'] ?? null;
        $match = null;
        foreach ($catalog as $place) {
            $name = PlacesCatalog::normalize($place['name']);
            if (in_array($name, $used, true)) {
                continue;
            }
            if ($food && $place['category'] !== $food && !in_array($food, $place['tags'], true)) {
                continue;
            }
            if ($query !== '' && (str_contains($name, $query) || str_contains($query, $name) || in_array($query, $place['tags'], true) || $place['category'] === $query)) {
                $match = $place;
                break;
            }
        }
        if (!$match) {
            foreach ($catalog as $place) {
                if (!in_array(PlacesCatalog::normalize($place['name']), $used, true)) {
                    if ($food && $place['category'] !== $food) {
                        continue;
                    }
                    $match = $place;
                    break;
                }
            }
        }
        if (!$match) {
            return ['itinerary' => $itinerary, 'reply' => 'Every catalog place is already on this itinerary. Try removing something first.', 'changed' => false];
        }

        $dayIndex = 0;
        if (!empty($intent['day'])) {
            $dayIndex = max(0, min(count($itinerary['days']) - 1, (int) $intent['day'] - 1));
        } else {
            foreach ($itinerary['days'] as $i => $d) {
                if (count($d['activities']) < 5 && ($d['window']['kind'] ?? '') !== 'depart_early') {
                    $dayIndex = $i;
                    break;
                }
            }
        }

        $day = $itinerary['days'][$dayIndex];
        if (($day['window']['kind'] ?? '') === 'depart_early') {
            return ['itinerary' => $itinerary, 'reply' => 'The final day is reserved for departure, so I did not add activities there.', 'changed' => false];
        }

        $start = $day['window']['start'] ?? '10:00';
        if (!empty($day['activities'])) {
            $last = $day['activities'][count($day['activities']) - 1];
            $start = self::addMinutes($last['end_time'] ?? $last['time'], 30);
        }
        $endLimit = $day['window']['end'] ?? '20:00';
        if ($start >= $endLimit) {
            $start = $day['window']['start'] ?? '11:00';
        }
        $people = self::partySize($trip);
        $day['activities'][] = self::activity(
            $match['name'],
            $match['category'],
            $start,
            self::clampTime(self::addMinutes($start, 90), $endLimit),
            self::scaledCost((int) $match['cost'], $people, (string) $trip['traveling_with']),
            'Added from your request. Typical hours: ' . $match['hours']
        );
        $itinerary['days'][$dayIndex] = $day;
        return ['itinerary' => $itinerary, 'reply' => 'Added ' . $match['name'] . ' to Day ' . ($dayIndex + 1) . '.', 'changed' => true];
    }

    private static function shiftTimes(array $itinerary, array $intent): array
    {
        $later = true;
        $msg = mb_strtolower((string) $intent['query']);
        if (str_contains($msg, 'earlier')) {
            $later = false;
        }
        $delta = $later ? 60 : -60;
        foreach ($itinerary['days'] as $i => &$day) {
            if ($intent['day'] && (int) $intent['day'] !== $i + 1) {
                continue;
            }
            $startLimit = $day['window']['start'] ?? '08:00';
            $endLimit = $day['window']['end'] ?? '21:00';
            foreach ($day['activities'] as &$a) {
                $ns = self::clampTime(self::addMinutes($a['time'], $delta), $endLimit);
                if ($ns < $startLimit) {
                    $ns = $startLimit;
                }
                $ne = self::clampTime(self::addMinutes($a['end_time'], $delta), $endLimit);
                if ($ne <= $ns) {
                    $ne = self::addMinutes($ns, 60);
                }
                $a['time'] = $ns;
                $a['end_time'] = $ne;
            }
            unset($a);
        }
        unset($day);
        return $itinerary;
    }

    private static function rearrange(array $itinerary, array $intent): array
    {
        $dayIndex = $intent['day'] ? max(0, (int) $intent['day'] - 1) : 0;
        if (!isset($itinerary['days'][$dayIndex])) {
            return $itinerary;
        }
        $acts = $itinerary['days'][$dayIndex]['activities'];
        $itinerary['days'][$dayIndex]['activities'] = array_reverse($acts);
        $start = $itinerary['days'][$dayIndex]['window']['start'] ?? '09:00';
        foreach ($itinerary['days'][$dayIndex]['activities'] as &$a) {
            $a['time'] = $start;
            $a['end_time'] = self::addMinutes($start, 90);
            $start = self::addMinutes($a['end_time'], 30);
        }
        unset($a);
        return $itinerary;
    }

    private static function adjustWeather(array $itinerary, array $catalog, array $trip): array
    {
        $used = self::usedNames($itinerary);
        $indoor = array_values(array_filter($catalog, static fn($p) => !empty($p['indoor'])));
        foreach ($itinerary['days'] as &$day) {
            foreach ($day['activities'] as &$a) {
                if (in_array($a['category'] ?? '', ['nature', 'beach', 'adventure', 'landmark'], true)) {
                    foreach ($indoor as $place) {
                        $n = PlacesCatalog::normalize($place['name']);
                        if (!in_array($n, $used, true)) {
                            $used[] = $n;
                            $a['title'] = $place['name'];
                            $a['place'] = $place['name'];
                            $a['category'] = $place['category'];
                            $a['notes'] = 'Swapped for indoor-friendly weather. Hours: ' . $place['hours'];
                            break;
                        }
                    }
                }
            }
            unset($a);
        }
        unset($day);
        $itinerary['weather_note'] = 'Plan adjusted toward indoor options for weather.';
        return $itinerary;
    }

    private static function adjustBudget(array $itinerary, array $catalog, array $trip): array
    {
        $cheap = $catalog;
        usort($cheap, static fn($a, $b) => $a['cost'] <=> $b['cost']);
        $used = [];
        foreach ($itinerary['days'] as &$day) {
            foreach ($day['activities'] as &$a) {
                if (($a['cost_estimate'] ?? 0) >= 20) {
                    foreach ($cheap as $place) {
                        $n = PlacesCatalog::normalize($place['name']);
                        if (!in_array($n, $used, true) && $place['cost'] <= 12) {
                            $used[] = $n;
                            $a['title'] = $place['name'];
                            $a['place'] = $place['name'];
                            $a['category'] = $place['category'];
                            $a['cost_estimate'] = self::scaledCost((int) $place['cost'], self::partySize($trip), (string) $trip['traveling_with']);
                            $a['notes'] = 'Budget-friendly swap. Hours: ' . $place['hours'];
                            break;
                        }
                    }
                } else {
                    $used[] = PlacesCatalog::normalize($a['title'] ?? '');
                }
            }
            unset($a);
        }
        unset($day);
        return $itinerary;
    }

    private static function adjustPreferences(array $itinerary, array $catalog, array $trip, string $message): array
    {
        $prefs = array_merge(self::preferences($trip), preg_split('/\W+/', mb_strtolower($message)) ?: []);
        $sorted = self::scoreAndSort($catalog, $prefs, isset($trip['budget']) ? (float) $trip['budget'] : null, self::partySize($trip));
        $used = self::usedNames($itinerary);
        foreach ($itinerary['days'] as &$day) {
            if (count($day['activities']) >= 4) {
                continue;
            }
            foreach ($sorted as $place) {
                $n = PlacesCatalog::normalize($place['name']);
                if (in_array($n, $used, true)) {
                    continue;
                }
                $used[] = $n;
                $start = $day['window']['start'] ?? '11:00';
                $day['activities'][] = self::activity(
                    $place['name'],
                    $place['category'],
                    $start,
                    self::addMinutes($start, 90),
                    self::scaledCost((int) $place['cost'], self::partySize($trip), (string) $trip['traveling_with']),
                    'Matched to your preferences. Hours: ' . $place['hours']
                );
                break;
            }
        }
        unset($day);
        return $itinerary;
    }

    private static function recalculateBudget(array $itinerary, array $trip): array
    {
        $activityCost = 0.0;
        foreach ($itinerary['days'] as $day) {
            foreach ($day['activities'] as $a) {
                $activityCost += (float) ($a['cost_estimate'] ?? 0);
            }
        }
        $people = self::partySize($trip);
        $dayCount = max(1, count($itinerary['days']));
        $acc = self::accommodation($trip, $people, isset($trip['budget']) ? (float) $trip['budget'] : null);
        $tr = $itinerary['transportation'] ?? self::transport($trip, $people);
        $food = self::foodPerDay($trip, $people) * $dayCount;
        $stay = $acc['nightly'] * max(1, $dayCount - 1);
        $total = round($activityCost + $stay + $food + (float) ($tr['local_total'] ?? 0), 2);
        $userBudget = isset($trip['budget']) && $trip['budget'] !== null ? (float) $trip['budget'] : null;
        $itinerary['budget'] = [
            'user_budget' => $userBudget,
            'currency' => $trip['budget_currency'] ?? 'USD',
            'estimated_total' => $total,
            'per_person' => round($total / max(1, $people), 2),
            'breakdown' => [
                'activities' => round($activityCost, 2),
                'accommodation' => round($stay, 2),
                'food' => round($food, 2),
                'local_transport' => round((float) ($tr['local_total'] ?? 0), 2),
            ],
            'within_budget' => $userBudget === null ? null : $total <= $userBudget,
        ];
        $itinerary['accommodation'] = $acc;
        return $itinerary;
    }

    public static function partySize(array $trip): int
    {
        $with = $trip['traveling_with'] ?? 'solo';
        if ($with === 'group') {
            $size = (int) ($trip['group_size'] ?? 4);
            return max(3, min(12, $size > 0 ? $size : 4));
        }
        return match ($with) {
            'couple' => 2,
            'family' => 4,
            'friends' => 4,
            default => 1,
        };
    }

    private static function preferences(array $trip): array
    {
        $prefs = $trip['preferences'] ?? [];
        if (is_string($prefs)) {
            $decoded = json_decode($prefs, true);
            $prefs = is_array($decoded) ? $decoded : [];
        }
        return array_map('strval', $prefs);
    }

    private static function dayWindow(int $index, int $dayCount, ?string $arrival, ?string $departure): array
    {
        $fullStart = '09:00';
        $fullEnd = '20:00';
        if ($index === 0) {
            return match ($arrival) {
                'morning' => ['start' => '10:00', 'end' => '20:00', 'kind' => 'arrival_morning'],
                'afternoon' => ['start' => '14:30', 'end' => '20:30', 'kind' => 'arrival_afternoon'],
                'evening' => ['start' => '18:30', 'end' => '21:30', 'kind' => 'arrival_evening'],
                'late_night' => ['start' => '21:30', 'end' => '23:00', 'kind' => 'arrival_late'],
                default => ['start' => $fullStart, 'end' => $fullEnd, 'kind' => 'full'],
            };
        }
        if ($index === $dayCount - 1 && $dayCount > 1) {
            return match ($departure) {
                'morning' => ['start' => '07:00', 'end' => '09:00', 'kind' => 'depart_early'],
                'afternoon' => ['start' => '08:00', 'end' => '13:00', 'kind' => 'depart_afternoon'],
                'evening' => ['start' => '08:30', 'end' => '17:00', 'kind' => 'depart_evening'],
                'late_night' => ['start' => '09:00', 'end' => '20:00', 'kind' => 'depart_late'],
                default => ['start' => $fullStart, 'end' => $fullEnd, 'kind' => 'full'],
            };
        }
        return ['start' => $fullStart, 'end' => $fullEnd, 'kind' => 'full'];
    }

    private static function timeSlots(string $start, string $end, int $count): array
    {
        $slots = [];
        $cursor = $start;
        for ($i = 0; $i < $count; $i++) {
            if ($cursor >= $end) {
                break;
            }
            $slots[] = ['start' => $cursor, 'end' => self::clampTime(self::addMinutes($cursor, 90), $end)];
            $cursor = self::addMinutes($cursor, 120);
        }
        return $slots;
    }

    private static function scoreAndSort(array $catalog, array $prefs, ?float $budget, int $people): array
    {
        $pref = array_map('strtolower', $prefs);
        foreach ($catalog as &$p) {
            $score = 1;
            foreach ($p['tags'] as $tag) {
                if (in_array(strtolower((string) $tag), $pref, true)) {
                    $score += 3;
                }
            }
            if ($budget !== null && $budget < 400 && $p['cost'] <= 12) {
                $score += 2;
            }
            if ($people >= 5 && in_array('family', $p['tags'], true)) {
                $score += 1;
            }
            $p['_score'] = $score;
        }
        unset($p);
        usort($catalog, static fn($a, $b) => $b['_score'] <=> $a['_score']);
        return $catalog;
    }

    private static function pickPlace(array $catalog, array $used, string $time, array $prefs, ?float $budget): ?array
    {
        foreach ($catalog as $place) {
            $n = PlacesCatalog::normalize($place['name']);
            if (in_array($n, $used, true)) {
                continue;
            }
            if (!self::openAt($place['hours'], $time)) {
                continue;
            }
            return $place;
        }
        foreach ($catalog as $place) {
            if (!in_array(PlacesCatalog::normalize($place['name']), $used, true)) {
                return $place;
            }
        }
        return null;
    }

    private static function openAt(string $hours, string $time): bool
    {
        if (!preg_match('/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/', $hours, $m)) {
            return true;
        }
        return $time >= $m[1] && $time <= $m[2];
    }

    private static function activity(string $title, string $category, string $start, string $end, float $cost, string $notes): array
    {
        return [
            'id' => 'act_' . substr(sha1($title . $start . $end), 0, 10),
            'time' => $start,
            'end_time' => $end,
            'title' => $title,
            'place' => $title,
            'category' => $category,
            'cost_estimate' => round($cost, 2),
            'notes' => $notes,
        ];
    }

    private static function accommodation(array $trip, int $people, ?float $budget): array
    {
        $with = $trip['traveling_with'] ?? 'solo';
        $nightly = 40;
        $type = 'Private room / hostel';
        $reason = 'Solo travelers usually get the best value in guesthouses or private hostel rooms.';
        if ($with === 'couple') {
            $nightly = 70;
            $type = 'Boutique hotel / apartment';
            $reason = 'Couples typically prefer a quiet boutique stay near the center.';
        } elseif ($with === 'family') {
            $nightly = 95;
            $type = 'Family apartment (2 bedrooms)';
            $reason = 'Family travel works best with kitchen access and extra space for kids.';
        } elseif ($with === 'friends') {
            $nightly = 85;
            $type = 'Shared apartment / 2 rooms';
            $reason = 'Friends usually split a central apartment to keep nights flexible.';
        } elseif ($with === 'group') {
            $nightly = 28 * max(3, $people);
            $type = 'Hotel block or large villa';
            $reason = 'A group of ' . $people . ' is easier (and cheaper per person) in a hotel block or villa than in many small rooms.';
        }
        if ($budget !== null && $budget < 300) {
            $nightly = max(18, $nightly * 0.6);
            $type .= ' (budget-focused)';
        }
        return [
            'type' => $type,
            'nightly' => round($nightly, 2),
            'recommendation' => $type . ' near the city center of ' . $trip['destination'],
            'reason' => $reason,
        ];
    }

    private static function transport(array $trip, int $people): array
    {
        $with = $trip['traveling_with'] ?? 'solo';
        $local = 'Metro, buses, and walking';
        $airport = 'Airport train or shared shuttle';
        $total = 25 * max(1, (int) ((new DateTimeImmutable($trip['end_date']))->diff(new DateTimeImmutable($trip['start_date']))->days + 1));
        if ($with === 'couple') {
            $local = 'Metro plus occasional taxi for evenings';
            $airport = 'Airport express or pre-booked cab';
            $total *= 1.3;
        } elseif ($with === 'family') {
            $local = 'Ride-hail / private car for kid-friendly transfers';
            $airport = 'Private airport transfer';
            $total *= 1.8;
        } elseif ($with === 'friends') {
            $local = 'Transit day passes plus split ride-hails at night';
            $airport = 'Shared van or two cabs';
            $total *= 1.5;
        } elseif ($with === 'group') {
            $local = 'Hired van or mini-bus for ' . $people . ' people (usually cheaper than many taxis)';
            $airport = 'Group airport coach or 2–3 vans';
            $total = 40 * $people;
        }
        return [
            'local' => $local,
            'airport' => $airport,
            'local_total' => round($total, 2),
            'note' => 'Estimates scale with party size and trip length.',
        ];
    }

    private static function transportAdvice(array $trip, string $message): string
    {
        $t = self::transport($trip, self::partySize($trip));
        return 'For this trip: ' . $t['local'] . '. Airport: ' . $t['airport'] . '.';
    }

    private static function foodPerDay(array $trip, int $people): float
    {
        $base = match ($trip['traveling_with'] ?? 'solo') {
            'couple' => 45,
            'family' => 70,
            'friends' => 55,
            'group' => 22 * $people,
            default => 28,
        };
        $budget = isset($trip['budget']) ? (float) $trip['budget'] : null;
        if ($budget !== null && $budget < 300) {
            $base *= 0.7;
        }
        return $base;
    }

    private static function scaledCost(int $cost, int $people, string $with): float
    {
        if ($with === 'group' || $with === 'family' || $with === 'friends') {
            return $cost * max(1, min($people, 6));
        }
        return $cost * max(1, min($people, 2));
    }

    private static function dayTheme(int $i, int $count, string $kind, string $destination): string
    {
        if ($kind === 'arrival_late') {
            return 'Arrival night in ' . $destination;
        }
        if (str_starts_with($kind, 'depart')) {
            return 'Departure day';
        }
        if ($i === 0) {
            return 'Arrive & get oriented';
        }
        if ($i === $count - 1) {
            return 'Final highlights';
        }
        return 'Explore ' . $destination;
    }

    private static function labelTime(?string $value): string
    {
        return match ($value) {
            'morning' => 'Morning',
            'afternoon' => 'Afternoon',
            'evening' => 'Evening',
            'late_night' => 'Late night',
            default => 'Flexible',
        };
    }

    private static function addMinutes(string $time, int $minutes): string
    {
        $dt = DateTimeImmutable::createFromFormat('H:i', $time) ?: new DateTimeImmutable('10:00');
        return $dt->modify(($minutes >= 0 ? '+' : '') . $minutes . ' minutes')->format('H:i');
    }

    private static function clampTime(string $time, string $max): string
    {
        return $time > $max ? $max : $time;
    }

    private static function usedNames(array $itinerary): array
    {
        $used = [];
        foreach ($itinerary['days'] as $day) {
            foreach ($day['activities'] as $a) {
                $used[] = PlacesCatalog::normalize((string) ($a['title'] ?? ''));
            }
        }
        return $used;
    }

    private static function countActivities(array $itinerary): int
    {
        $n = 0;
        foreach ($itinerary['days'] as $day) {
            $n += count($day['activities']);
        }
        return $n;
    }

    private static function dedupe(array $itinerary): array
    {
        $seen = [];
        foreach ($itinerary['days'] as &$day) {
            $keep = [];
            foreach ($day['activities'] as $a) {
                $k = PlacesCatalog::normalize((string) ($a['title'] ?? ''));
                if ($k === '' || isset($seen[$k])) {
                    continue;
                }
                $seen[$k] = true;
                $keep[] = $a;
            }
            $day['activities'] = $keep;
        }
        unset($day);
        return $itinerary;
    }
}
