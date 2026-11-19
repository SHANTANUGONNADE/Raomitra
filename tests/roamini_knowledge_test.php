<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/helpers/RoaminiKnowledge.php';
require dirname(__DIR__) . '/app/helpers/RoaminiEngine.php';

function expectKnowledge(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$swimming = RoaminiKnowledge::retrieve('Can I swim at Juhu Beach?');
expectKnowledge($swimming['has_relevant'], 'Juhu beach question should retrieve Mumbai references.');
expectKnowledge(str_contains($swimming['context'], 'Juhu Beach'), 'Juhu place details should be included.');
expectKnowledge(str_contains($swimming['context'], 'Approved example'), 'Relevant approved examples should be included.');

$hinglish = RoaminiKnowledge::retrieve('Bandra mein sasta khana kahan milega?');
expectKnowledge($hinglish['has_relevant'], 'Hinglish and budget aliases should retrieve relevant references.');

$followUp = RoaminiKnowledge::retrieve(
    'Something closer to the station',
    [['role' => 'user', 'content' => 'I have a few hours near CSMT before my train.']]
);
expectKnowledge($followUp['has_relevant'], 'Recent conversation context should support follow-up retrieval.');
expectKnowledge(str_contains($followUp['context'], 'CSMT'), 'Follow-up retrieval should retain the station context.');

$general = RoaminiKnowledge::retrieve('What is photosynthesis?');
expectKnowledge(!$general['has_relevant'], 'Unrelated general questions should not receive unrelated Mumbai context.');

$mumbai = RoaminiKnowledge::cityLocationsAnswer('mumbai locations');
expectKnowledge(is_string($mumbai) && str_contains($mumbai, 'Popular places in Mumbai'), 'Mumbai locations should return mapped places.');
expectKnowledge(str_contains($mumbai, 'Gateway of India'), 'Mumbai results should include mapped landmarks.');
expectKnowledge(str_contains($mumbai, 'Marine Drive'), 'Mumbai results should include mapped landmarks.');

$cityOnly = RoaminiKnowledge::cityLocationsAnswer('Mumbai');
expectKnowledge(is_string($cityOnly) && str_contains($cityOnly, 'Popular places in Mumbai'), 'A city-only prompt should return places.');

$abuRoad = RoaminiKnowledge::cityLocationsAnswer('Abu Road');
expectKnowledge(is_string($abuRoad) && str_contains($abuRoad, 'Achalgarh Fort'), 'Known smaller cities should return mapped places.');

$recommended = RoaminiEngine::reply('Recommend places in Mumbai');
expectKnowledge(str_contains($recommended, 'Marine Drive'), 'City recommendations should list known locations.');

echo "Roamini knowledge retrieval tests passed.\n";
