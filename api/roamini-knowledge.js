'use strict';

const fs = require('fs');
const path = require('path');

let cachedData;

function loadData() {
    if (cachedData) return cachedData;
    const root = path.resolve(__dirname, '..');
    const sourcePath = path.join(root, 'public', 'assets', 'js', 'mumbai-data.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const separator = source.indexOf('=');
    if (separator < 0) throw new Error('Roamini Mumbai reference data file is invalid.');
    const json = source.slice(separator + 1).trim().replace(/;$/, '');
    const mumbai = JSON.parse(json);
    if (!Array.isArray(mumbai.places) || !Array.isArray(mumbai.tips)) {
        throw new Error('Roamini Mumbai reference data has an unexpected format.');
    }

    const examplesPath = path.join(root, 'app', 'data', 'roamini-examples.json');
    const examples = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
    if (!Array.isArray(examples.examples)) {
        throw new Error('Roamini approved examples have an unexpected format.');
    }
    cachedData = { places: mumbai.places, tips: mumbai.tips, examples: examples.examples };
    return cachedData;
}

function tokens(text) {
    const stopWords = new Set([
        'a', 'about', 'an', 'and', 'are', 'can', 'could', 'do', 'does', 'for', 'from',
        'give', 'help', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or',
        'please', 'should', 'some', 'tell', 'the', 'to', 'what', 'where', 'which',
        'who', 'why', 'with', 'you', 'your', 'best', 'go', 'kahan', 'ka', 'ki', 'ko',
        'mein', 'mujhe', 'batao', 'hai', 'aur', 'kya',
    ]);
    const aliases = {
        affordable: 'budget', cheap: 'budget', cheaper: 'budget',
        sasta: 'budget', saste: 'budget', sasti: 'budget',
        cafes: 'cafe', restaurants: 'restaurant', food: 'restaurant',
        eat: 'restaurant', dining: 'restaurant', photos: 'photo',
        swim: 'swimming', swims: 'swimming', beaches: 'beach',
        children: 'kid', kids: 'kid', tips: 'tip',
    };
    const found = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g) || [];
    return Array.from(new Set(found
        .filter((token) => token.length >= 3 && !stopWords.has(token))
        .map((token) => aliases[token] || token)));
}

function rank(rows, queryTokens, weights) {
    return rows.map((row) => {
        let score = 0;
        Object.entries(weights).forEach(([field, weight]) => {
            const fieldTokens = new Set(tokens(row[field]));
            queryTokens.forEach((token) => {
                if (fieldTokens.has(token)) score += weight;
            });
        });
        return { row, score };
    }).filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .map(({ row, score }) => Object.assign({ _score: score }, row));
}

function retrieve(message, history = []) {
    const previousTurns = Array.isArray(history) ? history.slice(-6) : [];
    const searchText = [message, ...previousTurns.map((turn) => turn && turn.content || '')].join(' ');
    const queryTokens = tokens(searchText);
    if (!queryTokens.length) return { has_relevant: false, context: '' };

    const data = loadData();
    const places = rank(data.places, queryTokens, {
        title: 5, area: 4, category: 2, keywords: 3,
        desc: 1, local_tip: 1, nearest_station: 2,
    }).filter((row) => row._score >= 3);
    const tips = rank(data.tips, queryTokens, { tip: 1, category: 2 }).filter((row) => row._score >= 2);
    const examples = rank(data.examples, queryTokens, {
        question: 4, type: 1, rubric: 1,
    }).filter((row) => row._score >= 3);
    if (!places.length && !tips.length && !examples.length) {
        return { has_relevant: false, context: '' };
    }

    const lines = [
        'Reference data below is from Roamitra guide content marked "Needs verification"; qualify uncertain details and never present these entries as live listings.',
    ];
    places.slice(0, 4).forEach((place) => {
        const fields = ['area', 'category', 'desc', 'approx_cost', 'timings', 'best_time', 'nearest_station', 'local_tip']
            .filter((field) => place[field])
            .map((field) => field + ': ' + place[field]);
        lines.push('Mumbai place — ' + place.title + '; ' + fields.join('; '));
    });
    tips.slice(0, 3).forEach((tip) => {
        lines.push('Mumbai local tip — ' + (tip.category || 'General') + ': ' + (tip.tip || ''));
    });
    examples.slice(0, 2).forEach((example) => {
        lines.push('Approved example for style/behavior only — Question: ' + example.question
            + ' | Guidance: ' + example.rubric
            + ' | Approved answer: ' + String(example.answer).slice(0, 500));
    });
    return { has_relevant: true, context: lines.join('\n') };
}

module.exports = { retrieve };
