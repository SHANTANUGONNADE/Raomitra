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
            'image' => self::imageFor($category, $title),
        ];
    }

    public static function imageFor(string $category, string $title): string
    {
        $key = mb_strtolower(trim($title));
        $known = self::placeImages();
        if (isset($known[$key])) {
            return self::unsplash($known[$key]);
        }
        foreach ($known as $name => $photo) {
            if ($name !== '' && str_contains($key, $name)) {
                return self::unsplash($photo);
            }
        }

        $sets = [
            'food' => ['photo-1414235077428-338989a2e8c0', 'photo-1504674900247-0877df9cc836', 'photo-1476224203421-9ac39bcb3327', 'photo-1565299624946-b28f40a0ae38'],
            'restaurant' => ['photo-1414235077428-338989a2e8c0', 'photo-1559339352-11d035aa65de', 'photo-1567620905732-2d1ec7ab7445', 'photo-1540189549336-e6e99c3679fe'],
            'cafe' => ['photo-1495474472287-4d71bcdd2085', 'photo-1501339847302-ac426a4a7cbb', 'photo-1442512595331-e89e73853f31', 'photo-1498804103079-a6351b050096'],
            'nature' => ['photo-1501785888041-af3ef285b470', 'photo-1432405972618-c60b0225b8f9', 'photo-1441974231531-c6227db76b6e', 'photo-1500530855697-b586d89ba3ee'],
            'adventure' => ['photo-1464822759023-fed622ff2c3b', 'photo-1551632811-561732d1e306', 'photo-1500534314209-a25ddb2bd429', 'photo-1469474968028-56623f02e42e'],
            'culture' => ['photo-1524492412937-b28074a5d7da', 'photo-1555881400-74d7acaacd8b', 'photo-1548013146-72479768bada', 'photo-1528164344705-47542687000d'],
            'temple' => ['photo-1537996194471-e657df975ab4', 'photo-1573790387438-4da905039392', 'photo-1493976040374-85c8e12f0c0e', 'photo-1548013146-72479768bada'],
            'landmark' => ['photo-1502602898657-3e91760cbb34', 'photo-1477587458883-47145ed94245', 'photo-1587474260584-136574528ed5', 'photo-1512453979798-5ea266f8880c'],
            'city' => ['photo-1540959733332-eab4deabeeaf', 'photo-1513635269975-59663e0ac1ad', 'photo-1480714378408-67cf0d13bc1b', 'photo-1449824913935-59a10b8d2000'],
            'museum' => ['photo-1577083552431-6e5fd01988ec', 'photo-1566127444979-b3d2b654e3d7', 'photo-1554907984-15263bfd63bd', 'photo-1572947650440-e8a97ef053b2'],
            'market' => ['photo-1555400038-63f5ba517a47', 'photo-1555529669-e69e7aa0ba9a', 'photo-1488459716781-31db52582fe9', 'photo-1578916171728-46686eac8d58'],
            'shopping' => ['photo-1555529669-e69e7aa0ba9a', 'photo-1441986300917-64674bd600d8', 'photo-1472851294608-062f824d29cc', 'photo-1483985988355-763728e1935b'],
            'nightlife' => ['photo-1470229722913-7c0e2dbbafd3', 'photo-1514525253161-7a46d19cd819', 'photo-1492684223066-81342ee5ff30', 'photo-1566737236500-c8ac43014a67'],
            'beach' => ['photo-1507525428034-b723cf961d3e', 'photo-1512343879784-a960bf40e7f2', 'photo-1500375592092-40eb2168fd21', 'photo-1473496169904-658ba7c44d8a'],
            'accommodation' => ['photo-1566073771259-6a8506099945', 'photo-1522708323590-d24dbb6b0267', 'photo-1551882547-ff40c63fe5fa', 'photo-1611892440504-42a792e24d32'],
            'art' => ['photo-1577083552431-6e5fd01988ec', 'photo-1579783902614-a3fb3927b6a5', 'photo-1460661419201-fd4cecdf8a8b', 'photo-1513364776144-60967b0f800f'],
            'logistics' => ['photo-1436491865332-7a61a109cc05', 'photo-1544620341-11cb2cd7c626', 'photo-1464037864426-26c8a1e2d1c1', 'photo-1474487548417-781cb71495f3'],
        ];
        $list = $sets[$category] ?? [
            'photo-1467269204594-9661b134dd2b',
            'photo-1488646953014-85cb44e25828',
            'photo-1476514525535-07fb3b4ae5f1',
            'photo-1500530855697-b586d89ba3ee',
        ];
        $index = hexdec(substr(sha1($title . '|' . $category), 0, 4)) % count($list);
        return self::unsplash($list[$index]);
    }

    private static function unsplash(string $photo): string
    {
        return 'https://images.unsplash.com/' . $photo . '?auto=format&fit=crop&w=480&q=60';
    }

    /** Place name => Unsplash photo id, so each stop shows that place. */
    private static function placeImages(): array
    {
        return [
            'uluwatu temple' => 'photo-1537996194471-e657df975ab4',
            'tegallalang rice terraces' => 'photo-1518548419970-58e3b4079ab2',
            'ubud sacred monkey forest' => 'photo-1540573133985-87b6da6d54a9',
            'seminyak beach walk' => 'photo-1539367628448-4bc5c82d8e8a',
            'ubud art market' => 'photo-1555400038-63f5ba517a47',
            'tirta empul temple' => 'photo-1559628233-100c798642d4',
            'nusa penida day trip' => 'photo-1570789210967-2cac24afeb00',
            'canggu cafe hopping' => 'photo-1495474472287-4d71bcdd2085',
            'jimbaran seafood dinner' => 'photo-1559339352-11d035aa65de',
            'tanah lot sunset' => 'photo-1573790387438-4da905039392',
            'warung babi guling ibu oka' => 'photo-1569050467447-ce54b3bbc37d',
            'revolver espresso' => 'photo-1501339847302-ac426a4a7cbb',
            'senso-ji temple' => 'photo-1493976040374-85c8e12f0c0e',
            'shibuya crossing & hachiko' => 'photo-1542051841857-5f90071e7989',
            'tsukiji outer market' => 'photo-1579871494447-9811cf80d66c',
            'meiji jingu shrine' => 'photo-1528164344705-47542687000d',
            'teamlab planets' => 'photo-1561214115-f2f134cc4912',
            'akihabara electric town' => 'photo-1554797589-7241bb691973',
            'shinjuku gyoen' => 'photo-1490806843957-4378d406b619',
            'tokyo skytree' => 'photo-1540959733332-eab4deabeeaf',
            'ichiran ramen shibuya' => 'photo-1569718212165-3a8278d5f624',
            '% arabica omotesando' => 'photo-1442512595331-e89e73853f31',
            'omoide yokocho' => 'photo-1553621042-f6e147245754',
            'ghibli museum' => 'photo-1579783902614-a3fb3927b6a5',
            'eiffel tower' => 'photo-1502602898657-3e91760cbb34',
            'louvre museum' => 'photo-1566127444979-b3d2b654e3d7',
            'notre-dame & île de la cité' => 'photo-1431274172761-fca41d930114',
            'montmartre & sacré-cœur' => 'photo-1499856871958-5b9627545d1a',
            'seine river walk' => 'photo-1502602898657-3e91760cbb34',
            'musée d\'orsay' => 'photo-1577083552431-6e5fd01988ec',
            'le marais food walk' => 'photo-1559339352-11d035aa65de',
            'café de flore' => 'photo-1495474472287-4d71bcdd2085',
            'bouillon chartier' => 'photo-1414235077428-338989a2e8c0',
            'luxembourg gardens' => 'photo-1502602898657-3e91760cbb34',
            'versailles day trip' => 'photo-1524396309943-e03f5249f002',
            'latin quarter bistro dinner' => 'photo-1540189549336-e6e99c3679fe',
            'lalbagh botanical garden' => 'photo-1441974231531-c6227db76b6e',
            'bangalore palace' => 'photo-1596176530529-78163a4f7af2',
            'ub city & cubbon park' => 'photo-1529253355930-ddbe423a2ac7',
            'iskcon temple' => 'photo-1548013146-72479768bada',
            'commercial street' => 'photo-1441986300917-64674bd600d8',
            'ctr malleshwaram breakfast' => 'photo-1567620905732-2d1ec7ab7445',
            'nandi hills sunrise' => 'photo-1469474968028-56623f02e42e',
            'church street cafe crawl' => 'photo-1501339847302-ac426a4a7cbb',
            'vidyarthi bhavan' => 'photo-1504674900247-0877df9cc836',
            'wonderla (family day)' => 'photo-1513889961551-628c1e5e2ee8',
            'toit brewpub dinner' => 'photo-1514933651103-005eec06c04b',
            'third wave coffee' => 'photo-1495474472287-4d71bcdd2085',
            'baga & calangute beach' => 'photo-1512343879784-a960bf40e7f2',
            'old goa churches' => 'photo-1548013146-72479768bada',
            'fort aguada' => 'photo-1582510003544-4d00b7f74220',
            'anjuna flea market' => 'photo-1555400038-63f5ba517a47',
            'dudhsagar waterfalls' => 'photo-1432405972618-c60b0225b8f9',
            'fontainhas heritage walk' => 'photo-1467269204594-9661b134dd2b',
            'beach shack seafood' => 'photo-1559339352-11d035aa65de',
            'cafe coffee day / local cafe' => 'photo-1442512595331-e89e73853f31',
            'palolem sunset' => 'photo-1507525428034-b723cf961d3e',
            'spice plantation lunch' => 'photo-1476224203421-9ac39bcb3327',
            'gateway of india' => 'photo-1570168007204-dfb528c6958f',
            'marine drive sunset' => 'photo-1567157577867-05ccb1388e66',
            'elephanta caves' => 'photo-1524492412937-b28074a5d7da',
            'crawford market' => 'photo-1488459716781-31db52582fe9',
            'bandra-worli sea link view' => 'photo-1595658658481-d53d3f999875',
            'leopold cafe' => 'photo-1554118811-1e0d58224f24',
            'trishna fort' => 'photo-1414235077428-338989a2e8c0',
            'juhu beach' => 'photo-1507525428034-b723cf961d3e',
            'chhatrapati shivaji terminus' => 'photo-1570168007204-dfb528c6958f',
            'red fort' => 'photo-1587474260584-136574528ed5',
            'jama masjid & chandni chowk' => 'photo-1548013146-72479768bada',
            'qutub minar' => 'photo-1548013146-72479768bada',
            'humayun\'s tomb' => 'photo-1548013146-72479768bada',
            'india gate & rajpath' => 'photo-1587474260584-136574528ed5',
            'lodhi garden walk' => 'photo-1441974231531-c6227db76b6e',
            'karim\'s jama masjid' => 'photo-1569050467447-ce54b3bbc37d',
            'khan market cafes' => 'photo-1501339847302-ac426a4a7cbb',
            'lotus temple' => 'photo-1548013146-72479768bada',
            'amber fort' => 'photo-1477587458883-47145ed94245',
            'city palace' => 'photo-1599661046289-e31897846e41',
            'hawa mahal' => 'photo-1477587458883-47145ed94245',
            'jantar mantar' => 'photo-1599661046289-e31897846e41',
            'bapu bazaar' => 'photo-1555529669-e69e7aa0ba9a',
            'laxmi misthan bhandar' => 'photo-1567620905732-2d1ec7ab7445',
            'nahargarh fort sunset' => 'photo-1599661046289-e31897846e41',
            'tapri central cafe' => 'photo-1495474472287-4d71bcdd2085',
            'british museum' => 'photo-1572947650440-e8a97ef053b2',
            'tower of london' => 'photo-1513635269975-59663e0ac1ad',
            'hyde park walk' => 'photo-1501785888041-af3ef285b470',
            'borough market' => 'photo-1488459716781-31db52582fe9',
            'west end theatre' => 'photo-1503095396549-807759245b35',
            'camden market' => 'photo-1555529669-e69e7aa0ba9a',
            'monmouth coffee' => 'photo-1442512595331-e89e73853f31',
            'dishoom covent garden' => 'photo-1414235077428-338989a2e8c0',
            'burj khalifa at the top' => 'photo-1512453979798-5ea266f8880c',
            'dubai mall & fountain' => 'photo-1518684079-3c830dcef090',
            'old dubai creek abra' => 'photo-1518684079-3c830dcef090',
            'desert safari' => 'photo-1451337516015-6b6e9a44a8a3',
            'jumeirah beach' => 'photo-1512453979798-5ea266f8880c',
            'al seef cafes' => 'photo-1495474472287-4d71bcdd2085',
            'global village (seasonal)' => 'photo-1492684223066-81342ee5ff30',
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
