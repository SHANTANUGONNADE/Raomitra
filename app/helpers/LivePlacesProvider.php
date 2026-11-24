<?php
declare(strict_types=1);

final class LivePlacesProvider
{
    private static array $cache = [];

    public static function forDestination(string $destination): ?array
    {
        if (strtolower((string) getenv('ROAMITRA_PLACES_MODE')) === 'offline') {
            return null;
        }
        $destination = trim($destination);
        if ($destination === '') {
            throw new InvalidArgumentException('Enter a destination to find real places.');
        }
        $key = mb_strtolower($destination);
        if (isset(self::$cache[$key]) && self::$cache[$key]['expires'] > time()) {
            return self::$cache[$key]['data'];
        }

        try {
            $geocoded = self::fetchJson(
                'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' . rawurlencode($destination),
                ['User-Agent: RoamitraTravelPlanner/1.0', 'Accept: application/json'],
                5
            );
            if (!isset($geocoded[0]['lat'], $geocoded[0]['lon'])) {
                throw new RuntimeException('No mapped location was found for "' . $destination . '". Try a city or nearby landmark.', 422);
            }
            $lat = (float) $geocoded[0]['lat'];
            $lon = (float) $geocoded[0]['lon'];
            $query = '[out:json][timeout:8];('
                . 'nwr(around:12000,' . $lat . ',' . $lon . ')["tourism"~"attraction|museum|gallery|viewpoint|hotel|hostel|guest_house|motel|apartment|zoo|aquarium|artwork"];'
                . 'nwr(around:12000,' . $lat . ',' . $lon . ')["amenity"~"restaurant|cafe|food_court|marketplace|place_of_worship"];'
                . 'nwr(around:12000,' . $lat . ',' . $lon . ')["historic"];'
                . 'nwr(around:12000,' . $lat . ',' . $lon . ')["leisure"~"park|nature_reserve"];'
                . ');out center tags 120;';
            $result = null;
            $providerError = null;
            foreach ([
                'https://overpass-api.de/api/interpreter',
                'https://overpass.kumi.systems/api/interpreter',
                'https://overpass.private.coffee/api/interpreter',
            ] as $endpoint) {
                try {
                    $candidate = self::fetchJson(
                        $endpoint,
                        ['User-Agent: RoamitraTravelPlanner/1.0', 'Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
                        8,
                        'data=' . rawurlencode($query)
                    );
                } catch (RuntimeException $error) {
                    $providerError = $error;
                    continue;
                }
                $result = $candidate;
                if (!empty($candidate['elements'])) {
                    break;
                }
            }
            if ($result === null) {
                throw $providerError ?? new RuntimeException('All OpenStreetMap query servers are unavailable.');
            }
        } catch (RuntimeException $error) {
            if ($error->getCode() === 422) {
                throw $error;
            }
            error_log(
                'Live place lookup failed for "' . $destination . '"; using the local itinerary guide. '
                . $error->getMessage()
            );
            return null;
        }

        $activities = [];
        $stays = [];
        $seen = [];
        foreach (($result['elements'] ?? []) as $element) {
            $tags = $element['tags'] ?? [];
            $name = trim((string) ($tags['name'] ?? $tags['name:en'] ?? ''));
            $point = ($element['type'] ?? '') === 'node' ? $element : ($element['center'] ?? []);
            if ($name === '' || !isset($point['lat'], $point['lon'])) {
                continue;
            }
            $category = self::category($tags);
            if ($category === '') {
                continue;
            }
            $unique = mb_strtolower($name);
            if (isset($seen[$unique])) {
                continue;
            }
            $seen[$unique] = true;
            $latitude = (float) $point['lat'];
            $longitude = (float) $point['lon'];
            $mapQuery = rawurlencode($name . ', ' . ($tags['addr:city'] ?? $destination));
            $osmUrl = 'https://www.openstreetmap.org/' . rawurlencode((string) $element['type']) . '/' . (int) $element['id'];
            $mapped = [
                'id' => (string) $element['type'] . '/' . (int) $element['id'],
                'name' => $name,
                'category' => $category,
                'lat' => $latitude,
                'lon' => $longitude,
                'address' => implode(', ', array_filter([$tags['addr:street'] ?? '', $tags['addr:city'] ?? ''])),
                'opening_hours' => (string) ($tags['opening_hours'] ?? ''),
                'fee' => (string) ($tags['fee'] ?? ''),
                'map_url' => 'https://www.google.com/maps/search/?api=1&query=' . $mapQuery,
                'osm_url' => $osmUrl,
            ];
            if ($category === 'accommodation') {
                $stays[] = $mapped;
                continue;
            }
            $notes = $mapped['address'];
            $notes .= $mapped['opening_hours'] !== '' ? ' Opening hours listed: ' . $mapped['opening_hours'] . '.' : ' Check current opening hours before visiting.';
            $notes .= $mapped['fee'] === 'no' ? ' OpenStreetMap lists no admission fee.' : ' Admission cost is not verified; check with the venue.';
            $activities[] = array_merge($mapped, [
                'hours' => '00:00-23:59',
                'cost' => 0,
                'tags' => [$category],
                'notes' => trim($notes),
                'indoor' => in_array($category, ['museum', 'cafe', 'restaurant', 'market'], true),
                'live' => true,
            ]);
        }
        if (!$activities) {
            error_log(
                'No mapped attractions or businesses were found near "' . $destination . '"; using the local itinerary guide.'
            );
            return null;
        }
        $data = [
            'activities' => $activities,
            'stays' => $stays,
            'source' => 'OpenStreetMap',
            'attribution_url' => 'https://www.openstreetmap.org/copyright',
            'fetched_at' => gmdate('c'),
        ];
        self::$cache[$key] = ['data' => $data, 'expires' => time() + 3600];
        return $data;
    }

    private static function fetchJson(string $url, array $headers, int $timeout, ?string $body = null): array
    {
        if (!function_exists('curl_init')) {
            throw new RuntimeException('The server is missing cURL, which is needed to retrieve live place data.', 503);
        }
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => $timeout,
        ]);
        if ($body !== null) {
            curl_setopt($curl, CURLOPT_POST, true);
            curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
        }
        $raw = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        if (!is_string($raw) || $status < 200 || $status >= 300) {
            throw new RuntimeException($error !== '' ? $error : 'Place provider returned HTTP ' . $status . '.');
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new RuntimeException('Place provider returned invalid JSON.');
        }
        return $data;
    }

    private static function category(array $tags): string
    {
        if (in_array($tags['tourism'] ?? '', ['hotel', 'hostel', 'guest_house', 'motel', 'apartment', 'chalet', 'alpine_hut'], true)) return 'accommodation';
        if (($tags['amenity'] ?? '') === 'cafe') return 'cafe';
        if (in_array($tags['amenity'] ?? '', ['restaurant', 'food_court'], true)) return 'restaurant';
        if (($tags['amenity'] ?? '') === 'marketplace' || ($tags['shop'] ?? '') === 'market') return 'market';
        if (in_array($tags['tourism'] ?? '', ['museum', 'gallery'], true)) return 'museum';
        if (($tags['tourism'] ?? '') === 'viewpoint' || !empty($tags['historic'])) return 'landmark';
        if (($tags['amenity'] ?? '') === 'place_of_worship') return 'temple';
        if (in_array($tags['leisure'] ?? '', ['park', 'nature_reserve'], true)) return 'nature';
        if (in_array($tags['tourism'] ?? '', ['attraction', 'artwork', 'zoo', 'aquarium'], true)) return 'culture';
        return '';
    }
}
