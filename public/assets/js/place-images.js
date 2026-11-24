(function () {
    const GENERIC_PHOTO = '1488646953014';
    const imageLookupCache = new Map();

    function forActivity(activity, destination) {
        const title = String(activity.title || activity.place || '').trim().toLowerCase();
        const catalog = window.RoamitraDestinations;
        const catalogPhoto = catalog && catalog.findPlaceImage
            ? catalog.findPlaceImage(title, destination)
            : '';
        if (catalogPhoto) return catalogPhoto;
        const stored = String(activity.image || '');
        if (/^https?:\/\//i.test(stored)
            && !/images\.unsplash\.com/i.test(stored)
            && stored.indexOf(GENERIC_PHOTO) === -1) return stored;
        return '';
    }

    function wikiThumbnail(query, target) {
        const cacheKey = String(query || '').toLowerCase() + '|' + String(target || '').toLowerCase();
        if (imageLookupCache.has(cacheKey)) return imageLookupCache.get(cacheKey);
        const normalizedTarget = String(target || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        const tokens = normalizedTarget.split(' ').filter((token) =>
            token.length > 2 && token !== 'the' && token !== 'new'
        );
        const params = new URLSearchParams({
            action: 'query',
            generator: 'search',
            gsrsearch: query,
            gsrnamespace: '0',
            gsrlimit: '10',
            prop: 'pageimages',
            piprop: 'thumbnail',
            pithumbsize: '800',
            format: 'json',
            origin: '*'
        });
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        const request = fetch('https://en.wikipedia.org/w/api.php?' + params.toString(), { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error('Wikipedia image search returned HTTP ' + response.status + '.');
                return response.json();
            })
            .then((data) => {
                const pages = Object.values((data.query && data.query.pages) || [])
                    .filter((page) => page.thumbnail && page.thumbnail.source)
                    .map((page) => {
                        const pageTitle = String(page.title || '')
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, ' ')
                            .trim();
                        const matches = tokens.filter((token) => pageTitle.split(' ').includes(token)).length;
                        return { page, matches };
                    })
                    .filter((item) => item.matches >= Math.max(1, Math.ceil(tokens.length * 0.6)))
                    .sort((a, b) => b.matches - a.matches);
                return pages.length ? pages[0].page.thumbnail.source : '';
            })
            .catch((error) => {
                console.warn('Could not look up a location photo for "' + query + '".', error);
                return '';
            })
            .finally(() => window.clearTimeout(timeout));
        imageLookupCache.set(cacheKey, request);
        return request;
    }

    function resolve(activity, destination) {
        const title = String(activity.title || activity.place || '').trim();
        const city = String(destination || '').split(',')[0].trim();
        const placeQuery = [title, city].filter(Boolean).join(' ');
        const catalog = window.RoamitraDestinations;
        const catalogPlace = title && catalog && catalog.findPlaceImage
            ? catalog.findPlaceImage(title, destination)
            : '';
        if (catalogPlace) return Promise.resolve(catalogPlace);
        const catalogCity = catalog && catalog.findCityImage
            ? catalog.findCityImage(destination)
            : '';
        return (title ? wikiThumbnail(placeQuery, title) : Promise.resolve(''))
            .then((placePhoto) => placePhoto
                || catalogCity
                || (city ? wikiThumbnail(city, city) : '')
            );
    }

    window.RoamitraPlaceImages = { forActivity, resolve };
})();
