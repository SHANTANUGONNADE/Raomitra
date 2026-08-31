<?php
declare(strict_types=1);

/**
 * Destination activity catalog used by itinerary generation and AI edits.
 */
final class PlacesCatalog
{
    public static function forDestination(string $destination): array
    {
        $key = self::normalize($destination);
        $all = self::all();
        foreach ($all as $name => $places) {
            if (self::normalize($name) === $key || str_contains(self::normalize($name), $key) || str_contains($key, self::normalize($name))) {
                return $places;
            }
        }
        return self::generic($destination);
    }

    public static function normalize(string $value): string
    {
        return trim(mb_strtolower($value));
    }

    private static function place(string $name, string $category, string $hours, int $cost, array $tags, string $notes = ''): array
    {
        return [
            'name' => $name,
            'category' => $category,
            'hours' => $hours,
            'cost' => $cost,
            'tags' => $tags,
            'notes' => $notes,
            'indoor' => in_array($category, ['museum', 'cafe', 'restaurant', 'market', 'shopping'], true),
        ];
    }

    public static function all(): array
    {
        return [
            'Bali' => [
                self::place('Uluwatu Temple', 'temple', '09:00-19:00', 15, ['culture', 'adventure', 'beach']),
                self::place('Tegallalang Rice Terraces', 'nature', '07:00-18:00', 10, ['nature', 'adventure', 'culture']),
                self::place('Ubud Sacred Monkey Forest', 'nature', '08:30-18:00', 8, ['nature', 'culture']),
                self::place('Seminyak Beach Walk', 'beach', '06:00-19:00', 0, ['beach', 'relaxed']),
                self::place('Ubud Art Market', 'market', '08:00-18:00', 20, ['shopping', 'culture', 'budget']),
                self::place('Tirta Empul Temple', 'temple', '08:00-18:00', 12, ['culture']),
                self::place('Nusa Penida Day Trip', 'adventure', '07:00-17:00', 45, ['adventure', 'beach']),
                self::place('Canggu Cafe Hopping', 'cafe', '08:00-17:00', 18, ['food', 'cafe', 'relaxed']),
                self::place('Jimbaran Seafood Dinner', 'restaurant', '17:00-22:00', 35, ['food', 'beach']),
                self::place('Tanah Lot Sunset', 'temple', '16:00-19:00', 12, ['culture', 'nature']),
                self::place('Warung Babi Guling Ibu Oka', 'restaurant', '11:00-18:00', 8, ['food', 'budget']),
                self::place('Revolver Espresso', 'cafe', '07:00-16:00', 6, ['cafe', 'food']),
            ],
            'Tokyo' => [
                self::place('Senso-ji Temple', 'temple', '06:00-17:00', 0, ['culture']),
                self::place('Shibuya Crossing & Hachiko', 'city', '00:00-23:59', 0, ['city', 'culture']),
                self::place('Tsukiji Outer Market', 'market', '08:00-14:00', 25, ['food', 'market']),
                self::place('Meiji Jingu Shrine', 'temple', '05:00-18:00', 0, ['culture', 'nature']),
                self::place('teamLab Planets', 'museum', '10:00-20:00', 32, ['art', 'indoor']),
                self::place('Akihabara Electric Town', 'shopping', '10:00-20:00', 20, ['shopping', 'city']),
                self::place('Shinjuku Gyoen', 'nature', '09:00-16:30', 5, ['nature', 'relaxed']),
                self::place('Tokyo Skytree', 'city', '10:00-21:00', 25, ['city']),
                self::place('Ichiran Ramen Shibuya', 'restaurant', '11:00-22:00', 12, ['food', 'budget']),
                self::place('% Arabica Omotesando', 'cafe', '08:00-19:00', 7, ['cafe']),
                self::place('Omoide Yokocho', 'restaurant', '17:00-23:00', 22, ['food', 'nightlife']),
                self::place('Ghibli Museum', 'museum', '10:00-17:00', 18, ['art', 'family']),
            ],
            'Paris' => [
                self::place('Eiffel Tower', 'landmark', '09:00-23:00', 28, ['romance', 'city']),
                self::place('Louvre Museum', 'museum', '09:00-18:00', 22, ['art', 'culture', 'indoor']),
                self::place('Notre-Dame & Île de la Cité', 'landmark', '08:00-19:00', 0, ['culture']),
                self::place('Montmartre & Sacré-Cœur', 'landmark', '08:00-20:00', 0, ['art', 'romance']),
                self::place('Seine River Walk', 'nature', '07:00-21:00', 0, ['romance', 'relaxed']),
                self::place('Musée d\'Orsay', 'museum', '09:30-18:00', 16, ['art', 'indoor']),
                self::place('Le Marais Food Walk', 'food', '11:00-18:00', 30, ['food', 'shopping']),
                self::place('Café de Flore', 'cafe', '07:30-23:00', 18, ['cafe', 'romance']),
                self::place('Bouillon Chartier', 'restaurant', '11:30-22:00', 20, ['food', 'budget']),
                self::place('Luxembourg Gardens', 'nature', '08:00-19:00', 0, ['nature', 'family', 'relaxed']),
                self::place('Versailles Day Trip', 'landmark', '09:00-18:00', 40, ['culture', 'art']),
                self::place('Latin Quarter Bistro Dinner', 'restaurant', '18:00-22:30', 35, ['food', 'romance']),
            ],
            'Bangalore' => [
                self::place('Lalbagh Botanical Garden', 'nature', '06:00-19:00', 2, ['nature', 'relaxed']),
                self::place('Bangalore Palace', 'landmark', '10:00-17:30', 8, ['culture']),
                self::place('UB City & Cubbon Park', 'city', '07:00-20:00', 0, ['city', 'nature']),
                self::place('ISKCON Temple', 'temple', '07:00-20:30', 0, ['culture']),
                self::place('Commercial Street', 'shopping', '11:00-21:00', 15, ['shopping', 'budget']),
                self::place('CTR Malleshwaram Breakfast', 'restaurant', '07:00-12:30', 5, ['food', 'budget']),
                self::place('Nandi Hills Sunrise', 'adventure', '04:30-10:00', 10, ['adventure', 'nature']),
                self::place('Church Street Cafe Crawl', 'cafe', '10:00-20:00', 12, ['cafe', 'food']),
                self::place('Vidyarthi Bhavan', 'restaurant', '06:30-11:30', 4, ['food', 'budget']),
                self::place('Wonderla (family day)', 'adventure', '11:00-18:00', 25, ['family', 'adventure']),
                self::place('Toit Brewpub Dinner', 'restaurant', '12:00-23:00', 22, ['food', 'nightlife', 'friends']),
                self::place('Third Wave Coffee', 'cafe', '08:00-22:00', 5, ['cafe']),
            ],
            'Goa' => [
                self::place('Baga & Calangute Beach', 'beach', '07:00-19:00', 0, ['beach', 'friends']),
                self::place('Old Goa Churches', 'culture', '09:00-17:00', 0, ['culture']),
                self::place('Fort Aguada', 'landmark', '08:30-17:30', 0, ['culture', 'beach']),
                self::place('Anjuna Flea Market', 'market', '08:00-18:00', 15, ['shopping', 'beach']),
                self::place('Dudhsagar Waterfalls', 'nature', '08:00-16:00', 20, ['adventure', 'nature']),
                self::place('Fontainhas Heritage Walk', 'culture', '09:00-13:00', 5, ['culture']),
                self::place('Beach Shack Seafood', 'restaurant', '12:00-22:00', 18, ['food', 'beach']),
                self::place('Cafe Coffee Day / local cafe', 'cafe', '08:00-20:00', 4, ['cafe']),
                self::place('Palolem Sunset', 'beach', '16:00-19:00', 0, ['beach', 'relaxed']),
                self::place('Spice Plantation Lunch', 'food', '11:00-16:00', 16, ['food', 'nature', 'family']),
            ],
            'Mumbai' => [
                self::place('Gateway of India', 'landmark', '06:00-22:00', 0, ['city', 'culture']),
                self::place('Marine Drive Sunset', 'city', '16:00-21:00', 0, ['romance', 'city']),
                self::place('Elephanta Caves', 'culture', '09:00-17:00', 12, ['culture', 'adventure']),
                self::place('Crawford Market', 'market', '11:00-20:00', 10, ['shopping', 'food']),
                self::place('Bandra-Worli Sea Link View', 'city', '08:00-20:00', 0, ['city']),
                self::place('Leopold Cafe', 'cafe', '08:00-23:00', 14, ['cafe', 'food']),
                self::place('Trishna Fort', 'restaurant', '12:00-23:00', 40, ['food']),
                self::place('Juhu Beach', 'beach', '06:00-21:00', 0, ['beach', 'family']),
                self::place('Chhatrapati Shivaji Terminus', 'landmark', '08:00-20:00', 0, ['culture', 'city']),
            ],
            'Delhi' => [
                self::place('Red Fort', 'landmark', '09:30-16:30', 6, ['culture']),
                self::place('Jama Masjid & Chandni Chowk', 'culture', '07:00-18:00', 8, ['culture', 'food']),
                self::place('Qutub Minar', 'landmark', '07:00-17:00', 6, ['culture']),
                self::place('Humayun\'s Tomb', 'landmark', '06:00-18:00', 6, ['culture', 'nature']),
                self::place('India Gate & Rajpath', 'city', '06:00-21:00', 0, ['city', 'family']),
                self::place('Lodhi Garden Walk', 'nature', '06:00-19:00', 0, ['nature', 'relaxed']),
                self::place('Karim\'s Jama Masjid', 'restaurant', '11:00-23:00', 10, ['food', 'budget']),
                self::place('Khan Market Cafes', 'cafe', '10:00-22:00', 12, ['cafe', 'shopping']),
                self::place('Lotus Temple', 'temple', '09:00-17:00', 0, ['culture', 'relaxed']),
            ],
            'Jaipur' => [
                self::place('Amber Fort', 'landmark', '08:00-17:30', 10, ['culture', 'adventure']),
                self::place('City Palace', 'landmark', '09:30-17:00', 12, ['culture']),
                self::place('Hawa Mahal', 'landmark', '09:00-16:30', 4, ['culture']),
                self::place('Jantar Mantar', 'landmark', '09:00-17:00', 4, ['culture']),
                self::place('Bapu Bazaar', 'shopping', '10:30-21:00', 15, ['shopping']),
                self::place('Laxmi Misthan Bhandar', 'restaurant', '08:00-22:00', 8, ['food', 'budget']),
                self::place('Nahargarh Fort Sunset', 'landmark', '16:00-18:30', 5, ['culture', 'nature']),
                self::place('Tapri Central Cafe', 'cafe', '09:00-22:00', 6, ['cafe']),
            ],
            'London' => [
                self::place('British Museum', 'museum', '10:00-17:00', 0, ['culture', 'art', 'indoor']),
                self::place('Tower of London', 'landmark', '09:00-17:30', 35, ['culture']),
                self::place('Hyde Park Walk', 'nature', '07:00-20:00', 0, ['nature', 'relaxed', 'family']),
                self::place('Borough Market', 'market', '10:00-17:00', 20, ['food', 'market']),
                self::place('West End Theatre', 'art', '19:00-22:00', 45, ['art', 'nightlife']),
                self::place('Camden Market', 'market', '10:00-18:00', 15, ['shopping', 'food']),
                self::place('Monmouth Coffee', 'cafe', '08:00-18:00', 8, ['cafe']),
                self::place('Dishoom Covent Garden', 'restaurant', '08:00-23:00', 28, ['food']),
            ],
            'Dubai' => [
                self::place('Burj Khalifa At The Top', 'landmark', '10:00-22:00', 45, ['city']),
                self::place('Dubai Mall & Fountain', 'shopping', '10:00-23:00', 20, ['shopping', 'family']),
                self::place('Old Dubai Creek Abra', 'culture', '08:00-20:00', 5, ['culture', 'budget']),
                self::place('Desert Safari', 'adventure', '15:00-21:00', 55, ['adventure']),
                self::place('Jumeirah Beach', 'beach', '07:00-19:00', 0, ['beach']),
                self::place('Al Seef Cafes', 'cafe', '09:00-22:00', 12, ['cafe', 'culture']),
                self::place('Global Village (seasonal)', 'market', '16:00-23:00', 15, ['family', 'shopping']),
            ],
        ];
    }

    private static function generic(string $destination): array
    {
        $city = $destination !== '' ? $destination : 'the city';
        return [
            self::place($city . ' Old Town Walking Tour', 'culture', '09:00-17:00', 12, ['culture', 'city']),
            self::place($city . ' Central Market', 'market', '08:00-18:00', 10, ['food', 'shopping', 'budget']),
            self::place($city . ' Landmark Viewpoint', 'landmark', '08:00-19:00', 8, ['city', 'nature']),
            self::place($city . ' Museum of Local History', 'museum', '10:00-17:00', 12, ['culture', 'indoor', 'art']),
            self::place($city . ' Riverside / Park Stroll', 'nature', '07:00-19:00', 0, ['nature', 'relaxed', 'family']),
            self::place($city . ' Neighborhood Cafe', 'cafe', '08:00-18:00', 7, ['cafe', 'food']),
            self::place($city . ' Signature Local Restaurant', 'restaurant', '12:00-22:00', 22, ['food']),
            self::place($city . ' Night Food Street', 'food', '17:00-22:00', 15, ['food', 'nightlife']),
            self::place($city . ' Day Trip Outlook', 'adventure', '08:00-16:00', 25, ['adventure', 'nature']),
            self::place($city . ' Shopping District', 'shopping', '11:00-21:00', 18, ['shopping']),
        ];
    }
}
