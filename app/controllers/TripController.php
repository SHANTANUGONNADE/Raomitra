<?php
declare(strict_types=1);

final class TripController
{
    private const WITH = ['solo', 'couple', 'family', 'friends', 'group'];
    private const TIMES = ['morning', 'afternoon', 'evening', 'late_night'];
    private const PACE = ['relaxed', 'moderate', 'packed'];

    public static function create(array $input): void
    {
        $userId = Auth::requireUser();
        $trip = self::validate($input, false);
        $prefs = json_encode($trip['preferences'], JSON_UNESCAPED_UNICODE);

        $stmt = Database::pdo()->prepare(
            'INSERT INTO trips (user_id, destination, start_date, end_date, budget, budget_currency, traveling_with, group_size, arrival_time, departure_time, preferences, pace, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $userId,
            $trip['destination'],
            $trip['start_date'],
            $trip['end_date'],
            $trip['budget'],
            $trip['budget_currency'],
            $trip['traveling_with'],
            $trip['group_size'],
            $trip['arrival_time'],
            $trip['departure_time'],
            $prefs,
            $trip['pace'],
            'draft',
        ]);
        $id = (int) Database::pdo()->lastInsertId();
        Response::ok(['trip' => self::getOwned($id, $userId)], 201);
    }

    public static function list(): void
    {
        $userId = Auth::requireUser();
        $stmt = Database::pdo()->prepare(
            'SELECT t.*,
                    (SELECT i.id FROM itineraries i WHERE i.trip_id = t.id AND i.is_current = 1 ORDER BY i.version DESC LIMIT 1) AS current_itinerary_id
             FROM trips t
             WHERE t.user_id = ?
             ORDER BY t.updated_at DESC'
        );
        $stmt->execute([$userId]);
        Response::ok(['trips' => $stmt->fetchAll()]);
    }

    public static function show(int $id): void
    {
        $userId = Auth::requireUser();
        $trip = self::getOwned($id, $userId);
        $itinerary = self::currentItinerary($id);
        $versions = Database::pdo()->prepare(
            'SELECT id, version, is_current, summary, created_at FROM itineraries WHERE trip_id = ? ORDER BY version DESC'
        );
        $versions->execute([$id]);
        $messages = Database::pdo()->prepare(
            'SELECT id, role, message, created_at FROM itinerary_messages WHERE trip_id = ? ORDER BY id ASC'
        );
        $messages->execute([$id]);
        Response::ok([
            'trip' => $trip,
            'itinerary' => $itinerary,
            'versions' => $versions->fetchAll(),
            'messages' => $messages->fetchAll(),
        ]);
    }

    public static function save(int $id): void
    {
        $userId = Auth::requireUser();
        self::getOwned($id, $userId);
        Database::pdo()->prepare("UPDATE trips SET is_saved = 1, status = 'saved' WHERE id = ? AND user_id = ?")
            ->execute([$id, $userId]);
        $trip = self::getOwned($id, $userId);
        NotificationService::create(
            $userId,
            'saved_trip',
            'Trip saved',
            'Saved your ' . $trip['destination'] . ' trip.',
            'itinerary.html?trip=' . $id
        );
        Response::ok(['trip' => $trip]);
    }

    public static function generate(int $id): void
    {
        $userId = Auth::requireUser();
        $trip = self::getOwned($id, $userId);
        try {
            $data = ItineraryEngine::generate($trip);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 422);
        }

        $pdo = Database::pdo();
        $pdo->prepare('UPDATE itineraries SET is_current = 0 WHERE trip_id = ?')->execute([$id]);
        $version = self::nextVersion($id);
        $pdo->prepare(
            'INSERT INTO itineraries (trip_id, version, is_current, itinerary_json, summary) VALUES (?, ?, 1, ?, ?)'
        )->execute([$id, $version, json_encode($data, JSON_UNESCAPED_UNICODE), $data['summary'] ?? null]);
        $itineraryId = (int) $pdo->lastInsertId();
        $pdo->prepare("UPDATE trips SET status = 'generated' WHERE id = ?")->execute([$id]);

        NotificationService::create(
            $userId,
            'itinerary',
            'Itinerary generated',
            'Your ' . $trip['destination'] . ' itinerary is ready.',
            'itinerary.html?trip=' . $id
        );

        Response::ok([
            'trip' => self::getOwned($id, $userId),
            'itinerary' => array_merge($data, ['id' => $itineraryId, 'version' => $version]),
        ]);
    }

    public static function assistant(int $id, array $input): void
    {
        $userId = Auth::requireUser();
        $trip = self::getOwned($id, $userId);
        $message = trim((string) ($input['message'] ?? ''));
        if ($message === '') {
            Response::error('Enter a message for the travel assistant.');
        }
        $current = self::currentItinerary($id);
        if (!$current) {
            Response::error('Generate an itinerary first.', 409);
        }

        $result = ItineraryEngine::modify($current, $trip, $message);
        $data = $result['itinerary'];
        $pdo = Database::pdo();
        $pdo->prepare('UPDATE itineraries SET is_current = 0 WHERE trip_id = ?')->execute([$id]);
        $version = self::nextVersion($id);
        $pdo->prepare(
            'INSERT INTO itineraries (trip_id, version, is_current, itinerary_json, summary) VALUES (?, ?, 1, ?, ?)'
        )->execute([$id, $version, json_encode($data, JSON_UNESCAPED_UNICODE), $data['summary'] ?? $current['summary'] ?? null]);
        $itineraryId = (int) $pdo->lastInsertId();

        $pdo->prepare('INSERT INTO itinerary_messages (trip_id, itinerary_id, role, message) VALUES (?, ?, ?, ?)')
            ->execute([$id, $itineraryId, 'user', $message]);
        $pdo->prepare('INSERT INTO itinerary_messages (trip_id, itinerary_id, role, message) VALUES (?, ?, ?, ?)')
            ->execute([$id, $itineraryId, 'assistant', $result['reply']]);

        Response::ok([
            'reply' => $result['reply'],
            'itinerary' => array_merge($data, ['id' => $itineraryId, 'version' => $version]),
            'messages' => self::messages($id),
        ]);
    }

    private static function validate(array $input, bool $partial): array
    {
        $destination = trim((string) ($input['destination'] ?? ''));
        $start = (string) ($input['start_date'] ?? '');
        $end = (string) ($input['end_date'] ?? '');
        $with = (string) ($input['traveling_with'] ?? 'solo');
        $arrival = (string) ($input['arrival_time'] ?? '');
        $departure = (string) ($input['departure_time'] ?? '');
        $pace = (string) ($input['pace'] ?? 'moderate');
        $prefs = $input['preferences'] ?? [];
        if (!is_array($prefs)) {
            $prefs = [];
        }

        if ($destination === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
            Response::error('Destination, start date, and end date are required.');
        }
        if ($end < $start) {
            Response::error('Departure date must be on or after arrival date.');
        }
        if (!in_array($with, self::WITH, true)) {
            Response::error('Choose who you are traveling with.');
        }
        if (!in_array($arrival, self::TIMES, true) || !in_array($departure, self::TIMES, true)) {
            Response::error('Select arrival and departure times.');
        }
        if (!in_array($pace, self::PACE, true)) {
            $pace = 'moderate';
        }

        $groupSize = null;
        if ($with === 'group') {
            $raw = (string) ($input['group_size'] ?? '');
            if ($raw === '10+') {
                $groupSize = 10;
            } else {
                $groupSize = (int) $raw;
            }
            if ($groupSize < 3 || $groupSize > 12) {
                Response::error('Select how many people are traveling (3 to 10+).');
            }
        } else {
            $groupSize = match ($with) {
                'couple' => 2,
                'family', 'friends' => 4,
                default => 1,
            };
        }

        $budget = $input['budget'] ?? null;
        if ($budget === '' || $budget === null) {
            $budget = null;
        } else {
            $budget = (float) $budget;
            if ($budget < 0) {
                Response::error('Budget cannot be negative.');
            }
        }

        return [
            'destination' => $destination,
            'start_date' => $start,
            'end_date' => $end,
            'budget' => $budget,
            'budget_currency' => 'USD',
            'traveling_with' => $with,
            'group_size' => $groupSize,
            'arrival_time' => $arrival,
            'departure_time' => $departure,
            'preferences' => array_values(array_filter(array_map('strval', $prefs))),
            'pace' => $pace,
        ];
    }

    private static function getOwned(int $id, int $userId): array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM trips WHERE id = ? AND user_id = ? LIMIT 1');
        $stmt->execute([$id, $userId]);
        $trip = $stmt->fetch();
        if (!$trip) {
            Response::error('Trip not found.', 404);
        }
        if (isset($trip['preferences']) && is_string($trip['preferences'])) {
            $trip['preferences'] = json_decode($trip['preferences'], true) ?: [];
        }
        return $trip;
    }

    private static function currentItinerary(int $tripId): ?array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, version, itinerary_json, summary, created_at FROM itineraries WHERE trip_id = ? AND is_current = 1 ORDER BY version DESC LIMIT 1'
        );
        $stmt->execute([$tripId]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        $data = json_decode((string) $row['itinerary_json'], true);
        if (!is_array($data)) {
            return null;
        }
        $data['id'] = (int) $row['id'];
        $data['version'] = (int) $row['version'];
        $data['summary'] = $row['summary'];
        $data['created_at'] = $row['created_at'];
        return $data;
    }

    private static function nextVersion(int $tripId): int
    {
        $stmt = Database::pdo()->prepare('SELECT COALESCE(MAX(version), 0) FROM itineraries WHERE trip_id = ?');
        $stmt->execute([$tripId]);
        return (int) $stmt->fetchColumn() + 1;
    }

    private static function messages(int $tripId): array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, role, message, created_at FROM itinerary_messages WHERE trip_id = ? ORDER BY id ASC'
        );
        $stmt->execute([$tripId]);
        return $stmt->fetchAll();
    }
}
