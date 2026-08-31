<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/helpers/PlacesCatalog.php';
require dirname(__DIR__) . '/app/helpers/ItineraryEngine.php';

$failures = 0;
function assert_true(bool $cond, string $msg): void
{
    global $failures;
    if (!$cond) {
        $failures++;
        fwrite(STDERR, "FAIL: $msg\n");
    } else {
        echo "OK: $msg\n";
    }
}

$trip = [
    'destination' => 'Bali',
    'start_date' => '2026-09-10',
    'end_date' => '2026-09-13',
    'budget' => 800,
    'budget_currency' => 'USD',
    'traveling_with' => 'group',
    'group_size' => 6,
    'arrival_time' => 'late_night',
    'departure_time' => 'morning',
    'preferences' => ['food', 'culture'],
    'pace' => 'moderate',
];

$it = ItineraryEngine::generate($trip);
assert_true(!empty($it['days']), 'generates days');
assert_true(($it['days'][0]['window']['kind'] ?? '') === 'arrival_late', 'late-night arrival shortens day 1');
$last = $it['days'][count($it['days']) - 1];
assert_true(($last['window']['kind'] ?? '') === 'depart_early', 'morning departure shortens last day');
assert_true((int) $it['party']['group_size'] === 6, 'group size is 6');
$names = [];
$dup = false;
foreach ($it['days'] as $day) {
    foreach ($day['activities'] as $a) {
        $k = strtolower($a['title']);
        if (isset($names[$k])) {
            $dup = true;
        }
        $names[$k] = true;
    }
}
assert_true(!$dup, 'no duplicate place names on generate');

$removed = ItineraryEngine::modify($it, $trip, 'Remove Uluwatu Temple');
assert_true(is_string($removed['reply']) && $removed['reply'] !== '', 'remove returns a reply');
$added = ItineraryEngine::modify($removed['itinerary'], $trip, 'Add a nearby cafe to day 2');
$titles = [];
foreach ($added['itinerary']['days'] as $day) {
    foreach ($day['activities'] as $a) {
        $titles[] = strtolower($a['title']);
    }
}
assert_true(count($titles) === count(array_unique($titles)), 'no duplicates after add');
$timed = ItineraryEngine::modify($added['itinerary'], $trip, 'Change timings to start later in the morning');
assert_true(!empty($timed['itinerary']['days']), 'timing change keeps itinerary');

if ($failures > 0) {
    fwrite(STDERR, "\n$failures assertion(s) failed.\n");
    exit(1);
}
echo "\nAll itinerary engine checks passed.\n";
