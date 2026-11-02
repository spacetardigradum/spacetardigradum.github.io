(() => {
	const svg = document.querySelector('#world-map');
	const mapStatus = document.querySelector('#map-status');
	const dataStatus = document.querySelector('#data-status');
	const number = new Intl.NumberFormat('en-US');
	const colors = ['#183b39', '#28695e', '#6bad88', '#d5c27d'];
	const populationUrl = 'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&MRNEV=1&per_page=500';

	function setText(id, value) {
		const element = document.getElementById(id);
		if (element) element.textContent = value;
	}

	async function fetchJson(url) {
		const response = await fetch(url, { headers: { Accept: 'application/json' } });
		if (!response.ok) throw new Error(`Request failed (${response.status})`);
		return response.json();
	}

	function recordsFromWorldBank(payload) {
		if (!Array.isArray(payload) || !Array.isArray(payload[1])) throw new Error('Unexpected World Bank response');
		return payload[1].filter((record) => record && record.value !== null);
	}

	function worldRecord(records) {
		return records.find((record) => record.countryiso3code === 'WLD');
	}

	function updateWorldStat(records, valueId, yearId, formatValue) {
		const record = worldRecord(records);
		if (!record) return false;
		setText(valueId, formatValue(record.value));
		setText(yearId, `World Bank · ${record.date}`);
		return true;
	}

	function colorForPopulation(population, maxPopulation) {
		if (!population || !maxPopulation) return '#213632';
		const t = Math.max(0, Math.min(1, Math.log10(population + 1) / Math.log10(maxPopulation + 1)));
		const scaled = t * (colors.length - 1);
		const index = Math.min(colors.length - 2, Math.floor(scaled));
		const fraction = scaled - index;
		const from = colors[index].match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16));
		const to = colors[index + 1].match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16));
		return `rgb(${from.map((channel, i) => Math.round(channel + (to[i] - channel) * fraction)).join(',')})`;
	}

	function showCountry(feature, datum) {
		setText('country-name', datum?.name || feature.properties?.name || 'Unknown place');
		setText('country-region', datum?.region || 'Region unavailable');
		setText('country-population', datum?.population ? number.format(datum.population) : 'No data');
		setText('country-data-year', datum?.year || '—');
		svg.querySelectorAll('.is-active').forEach((path) => path.classList.remove('is-active'));
		const path = svg.querySelector(`[data-map-id="${feature.id}"]`);
		if (path) path.classList.add('is-active');
	}

	async function loadMap() {
		if (!window.d3 || !window.topojson) throw new Error('Map libraries unavailable');
		const [topology, countryList, populationPayload] = await Promise.all([
			fetchJson('data/countries-110m.json'),
			fetchJson('https://countries.dev/countries?fields=name,alpha3Code,numericCode,region'),
			fetchJson(populationUrl)
		]);
		const countryFeatures = topojson.feature(topology, topology.objects.countries).features;
		const countryInfo = new Map();
		for (const country of countryList) {
			const id = String(country.numericCode || '').padStart(3, '0');
			if (id !== '000') countryInfo.set(id, country);
		}
		const populations = recordsFromWorldBank(populationPayload);
		const populationByCode = new Map(populations
			.filter((record) => record.countryiso3code)
			.map((record) => [record.countryiso3code, record]));
		const joined = countryFeatures.map((feature) => {
			const ref = countryInfo.get(String(feature.id).padStart(3, '0'));
			const population = ref ? populationByCode.get(ref.alpha3Code) : undefined;
			return {
				feature,
				name: ref?.name || feature.properties?.name || 'Unknown place',
				region: ref?.region || '',
				population: population?.value == null ? null : Number(population.value),
				year: population?.date || ''
			};
		});
		const maxPopulation = Math.max(...joined.map((datum) => datum.population || 0));
		const projection = d3.geoNaturalEarth1().fitExtent([[12, 16], [1188, 544]], { type: 'FeatureCollection', features: countryFeatures });
		const pathGenerator = d3.geoPath(projection);
		const graticule = d3.geoGraticule10();
		const gridPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		gridPath.setAttribute('class', 'graticule');
		gridPath.setAttribute('d', pathGenerator(graticule));
		svg.append(gridPath);
		const paths = joined.map((datum) => {
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('class', `country${datum.population ? '' : ' no-data'}`);
			path.setAttribute('d', pathGenerator(datum.feature));
			path.setAttribute('fill', colorForPopulation(datum.population, maxPopulation));
			path.setAttribute('data-map-id', datum.feature.id);
			path.setAttribute('tabindex', '0');
			path.setAttribute('role', 'button');
			path.setAttribute('aria-label', `${datum.name}, population ${datum.population ? number.format(datum.population) : 'data unavailable'}`);
			path.addEventListener('mouseenter', () => showCountry(datum.feature, datum));
			path.addEventListener('focus', () => showCountry(datum.feature, datum));
			path.addEventListener('click', () => showCountry(datum.feature, datum));
			return path;
		});
		for (const path of paths) svg.append(path);
		setText('stat-countries', number.format(countryFeatures.filter((feature) => String(feature.id) !== '010').length));
		const world = worldRecord(populations);
		if (world) {
			setText('stat-population', number.format(Number(world.value)));
			setText('stat-population-year', `World Bank · ${world.date}`);
		}
		const initialCountry = joined.find((datum) => datum.name === 'United States') || joined[0];
		showCountry(initialCountry.feature, initialCountry);
		mapStatus.textContent = `${number.format(countryFeatures.length)} mapped places · Natural Earth 1:110m`;
		return populations;
	}

	async function loadGlobalStats() {
		const [landPayload, lifePayload] = await Promise.all([
			fetchJson('https://api.worldbank.org/v2/country/WLD/indicator/AG.LND.TOTL.K2?format=json&MRNEV=1&per_page=1'),
			fetchJson('https://api.worldbank.org/v2/country/WLD/indicator/SP.DYN.LE00.IN?format=json&MRNEV=1&per_page=1')
		]);
		const land = recordsFromWorldBank(landPayload);
		const life = recordsFromWorldBank(lifePayload);
		updateWorldStat(land, 'stat-land', 'stat-land-year', (value) => `${number.format(Number(value))} km²`);
		updateWorldStat(life, 'stat-life', 'stat-life-year', (value) => `${Number(value).toFixed(1)} years`);
	}

	(async () => {
		const results = await Promise.allSettled([loadMap(), loadGlobalStats()]);
		const mapResult = results[0];
		if (mapResult.status === 'rejected') {
			mapStatus.textContent = 'Map data could not be loaded. Please refresh to try again.';
			console.error('Map load failed:', mapResult.reason);
		}
		const statsFailed = results.slice(1).some((result) => result.status === 'rejected');
		if (statsFailed) console.error('One or more global indicators could not be loaded.');
		dataStatus.textContent = statsFailed ? 'Some indicators could not be loaded' : 'Latest available annual data';
	})();
})();
