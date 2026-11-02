# World Atlas

A small, static global overview hosted with GitHub Pages. It contains an interactive country map and four global indicators; it does not collect visitor data.

## Data sources

- Country outlines: Natural Earth 1:110m geometry distributed by [world-atlas](https://github.com/topojson/world-atlas), stored locally in `data/countries-110m.json`.
- Country names, regions, and numeric ISO codes: [countries.dev](https://countries.dev/docs/api/countries).
- Population, land area, and life expectancy: [World Bank Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation). The page requests the latest non-empty annual observation available for each indicator.
- Map projection and TopoJSON conversion: [d3-geo](https://github.com/d3/d3-geo) and [topojson-client](https://github.com/topojson/topojson-client), loaded from jsDelivr.

The map is a schematic overview. The source geometry simplifies boundaries at 1:110m scale; country populations may have different observation years, shown when a place is selected.

## Local preview

Serve this directory over HTTP, for example with `python3 -m http.server 8000`, then open `http://localhost:8000`. The data APIs require an internet connection.
