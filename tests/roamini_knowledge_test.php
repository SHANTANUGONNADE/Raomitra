<?php
declare(strict_types=1);

require dirname(__DIR__) . '/app/helpers/RoaminiKnowledge.php';

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

echo "Roamini knowledge retrieval tests passed.\n";
