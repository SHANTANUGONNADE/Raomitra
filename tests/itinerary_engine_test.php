<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/helpers/PlacesCatalog.php';
require dirname(__DIR__) . '/app/helpers/LivePlacesProvider.php';
require dirname(__DIR__) . '/app/helpers/ItineraryEngine.php';

putenv('ROAMITRA_PLACES_MODE=offline');

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
assert_true(PlacesCatalog::hasDestination('Mumbai'), 'recognizes a curated city guide');
assert_true(!PlacesCatalog::hasDestination('Atlantis'), 'does not claim unknown cities have curated guides');
assert_true(!empty($it['days']), 'generates days');
assert_true(($it['days'][0]['window']['kind'] ?? '') === 'arrival_late', 'late-night arrival shortens day 1');
$last = $it['days'][count($it['days']) - 1];
assert_true(($last['window']['kind'] ?? '') === 'depart_early', 'morning departure shortens last day');
assert_true((int) $it['party']['group_size'] === 6, 'group size is 6');
$clockTrip = array_merge($trip, ['arrival_time' => '17:45', 'departure_time' => '15:30']);
$clockItinerary = ItineraryEngine::generate($clockTrip);
$clockLast = $clockItinerary['days'][count($clockItinerary['days']) - 1];
assert_true(($clockItinerary['days'][0]['window']['start'] ?? '') === '19:15', 'arrival time controls first-day activity window');
assert_true(($clockLast['window']['end'] ?? '') === '12:30', 'departure time controls last-day activity window');
assert_true(str_contains($clockItinerary['summary'] ?? '', 'Arrival: 17:45 IST. Departure: 15:30 IST.'), 'summary reports exact IST times');
$relaxedItinerary = ItineraryEngine::generate(array_merge($trip, ['pace' => 'relaxed']));
$packedItinerary = ItineraryEngine::generate(array_merge($trip, ['pace' => 'packed']));
assert_true(
    count($packedItinerary['days'][1]['activities'] ?? []) > count($relaxedItinerary['days'][1]['activities'] ?? []),
    'packed pace schedules more activities than relaxed pace'
);
$edgeTrip = array_merge($trip, ['arrival_time' => '23:30', 'departure_time' => '01:00']);
$edgeItinerary = ItineraryEngine::generate($edgeTrip);
$edgeArrival = $edgeItinerary['days'][0];
$edgeDeparture = $edgeItinerary['days'][count($edgeItinerary['days']) - 1];
assert_true(($edgeArrival['activities'][0]['end_time'] ?? '') === '23:59', 'late arrival activity stays within the arrival day');
assert_true(($edgeDeparture['window']['start'] ?? '') === '00:00', 'overnight departure window does not wrap to the previous day');
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

$lowBudgetTrip = array_merge($trip, [
    'destination' => 'Mumbai',
    'start_date' => '2026-11-24',
    'end_date' => '2026-11-26',
    'budget' => 319,
    'budget_currency' => 'INR',
    'traveling_with' => 'solo',
    'group_size' => 1,
    'arrival_time' => '10:00',
    'departure_time' => '14:00',
]);
$lowBudgetItinerary = ItineraryEngine::generate($lowBudgetTrip);
$lowBudgetActivities = array_merge(...array_map(static fn(array $day): array => $day['activities'], $lowBudgetItinerary['days']));
assert_true(($lowBudgetItinerary['budget']['feasibility'] ?? '') === 'tight', 'flags a very tight total trip budget');
assert_true(
    count($lowBudgetActivities) > 0 && array_reduce($lowBudgetActivities, static fn(bool $free, array $activity): bool => $free && (float) $activity['cost_estimate'] === 0.0, true),
    'prioritizes free catalog places when the INR budget is tight'
);

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
